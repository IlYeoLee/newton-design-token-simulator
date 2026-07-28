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
// 코치는 팩과 무관하게 같은 남성 보이스·같은 톤(유저: 농구도 러닝과 똑같이).
const COACH = ['ko-KR-HyunsuMultilingualNeural', '+15%', '-6Hz'];
const VOICE = { '션': COACH, '커리': COACH, '고수': COACH, '시스템': ['ko-KR-SunHiNeural', '-4%'] };
const src = fs.readFileSync('src/session.js', 'utf8');
const only = (() => { const i = process.argv.indexOf('--only'); return i < 0 ? null : new Set(process.argv[i + 1].split(',')); })();

const jobs = [];
// 스테이지 진입 대사: { id:'A1', ... voice:['션','...'] }
for (const m of src.matchAll(/id\s*:\s*'([A-Z0-9_]+)'[^{}]*?voice\s*:\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)) {   // [^{}]=멀티라인 허용(객체 경계 내), P3 등 여러 줄 엔트리 누락 방지
  jobs.push({ file: `${m[1]}.mp3`, who: m[2], text: m[3] });
}
// 중간 코칭: this._say('key', '션', '대사')
for (const m of src.matchAll(/_say\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)) {
  jobs.push({ file: `say_${m[1]}.mp3`, who: m[2], text: m[3] });
}

let n = 0;
for (const j of jobs) {
  if (only && !only.has(j.file.replace('.mp3', ''))) continue;
  const [voice, rate, pitch] = VOICE[j.who] || VOICE['시스템'];
  const text = j.text.replace(/—/g, ',');   // 대시는 쉼(pause)으로
  const args = ['-v', voice, `--rate=${rate}`];
  if (pitch) args.push(`--pitch=${pitch}`);
  execFileSync(TTS, [...args, '--text', text, '--write-media', `public/voice/${j.file}`]);
  console.log('생성', j.file, `[${j.who}]`, text.slice(0, 30));
  n++;
}
console.log('완료:', n, '파일');
