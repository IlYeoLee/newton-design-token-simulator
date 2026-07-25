// 세션 음성 전량 재생성 — 자연스러운 무료 뉴럴 TTS만 남기기
//   스테이지 진입: public/voice/<stageId>.mp3  (session.js STAGES voice에서 추출)
//   중간 코칭(_say): public/voice/say_<key>.mp3 (session.js _say 호출에서 추출)
//   화자 매핑: 션/커리/고수 = ko-KR-HyunsuMultilingualNeural(-8%), 시스템 = ko-KR-SunHiNeural(-4%)
// 사용: node scripts/gen_voice.mjs [--only A1,say_a1go]
import fs from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';

const TTS = path.join(os.homedir(), 'Library/Python/3.9/bin/edge-tts');
const VOICE = { '션': ['ko-KR-HyunsuMultilingualNeural', '-8%'], '커리': ['ko-KR-HyunsuMultilingualNeural', '-8%'], '고수': ['ko-KR-HyunsuMultilingualNeural', '-8%'], '시스템': ['ko-KR-SunHiNeural', '-4%'] };
const src = fs.readFileSync('src/session.js', 'utf8');
const only = (() => { const i = process.argv.indexOf('--only'); return i < 0 ? null : new Set(process.argv[i + 1].split(',')); })();

const jobs = [];
// 스테이지 진입 대사: { id:'A1', ... voice:['션','...'] }
for (const m of src.matchAll(/id\s*:\s*'([A-Z0-9_]+)'[^\n]*?voice\s*:\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)) {
  jobs.push({ file: `${m[1]}.mp3`, who: m[2], text: m[3] });
}
// 중간 코칭: this._say('key', '션', '대사')
for (const m of src.matchAll(/_say\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)) {
  jobs.push({ file: `say_${m[1]}.mp3`, who: m[2], text: m[3] });
}

let n = 0;
for (const j of jobs) {
  if (only && !only.has(j.file.replace('.mp3', ''))) continue;
  const [voice, rate] = VOICE[j.who] || VOICE['시스템'];
  const text = j.text.replace(/—/g, ',');   // 대시는 쉼(pause)으로
  execFileSync(TTS, ['-v', voice, `--rate=${rate}`, '--text', text, '--write-media', `public/voice/${j.file}`]);
  console.log('생성', j.file, `[${j.who}]`, text.slice(0, 30));
  n++;
}
console.log('완료:', n, '파일');
