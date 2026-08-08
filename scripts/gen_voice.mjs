// 세션 음성 전량 재생성 — ElevenLabs TTS
//   스테이지 진입: public/voice/<stageId>.mp3  (session.js STAGES voice에서 추출)
//   중간 코칭(_say): public/voice/say_<key>.mp3 (session.js _say 호출에서 추출)
//   화자 매핑: 션/커리/고수 = 코치(남), 시스템 = 안내(여)
// 사용: ELEVENLABS_API_KEY=... node scripts/gen_voice.mjs [--only A1,say_a1go] [--voices]
import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY 없음'); process.exit(1); }
const MODEL = 'eleven_multilingual_v2';

// 계정 보이스 목록만 보고 싶을 때
if (process.argv.includes('--voices')) {
  const r = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', { headers: { 'xi-api-key': KEY } });
  const { voices } = await r.json();
  for (const v of voices) console.log(v.voice_id, v.name, `[${v.labels?.gender || ''} ${v.labels?.language || v.labels?.accent || ''}]`);
  process.exit(0);
}

// 종목별로 코치 보이스가 다르다 (2026-08-08 유저 변경: 팩마다 따로).
// voice_settings 는 일부러 보내지 않는다 — 보내면 유저가 웹 UI에서 튜닝해 저장한 값
// (커리: stability 0.84 / similarity 1.0)을 덮어써서 발음이 흔들리고 느려진다.
const VOICE = {
  '션':   'blEc5AHNgW8gLsLqMQxJ',   // 러닝
  '커리': '4fn3GuOPJxLqoJQzNA0f',   // 농구
  '고수': 'j7e3J6ksqsziQcIGyAWI',   // 복싱 (Valentina)
};
const FALLBACK = VOICE['션'];

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

// 문장 사이 쉼(초). <break> 태그는 multilingual_v2 도 v3 도 무시한다(실측: 8.67→8.62초).
// 그래서 문장별로 따로 합성한 뒤 무음을 끼워 붙인다.
// 기본 0 = 쉼 없이 통으로 합성(유저 선택). --gap 0.35 처럼 주면 문장 사이에 무음을 끼운다.
const GAP = (() => { const i = process.argv.indexOf('--gap'); return i < 0 ? 0 : Number(process.argv[i + 1]); })();

async function tts(id, text, prev, next) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    // voice_settings 생략 = 보이스 저장값 사용. 보내면 유저가 UI에서 맞춰둔 튜닝을 덮어써서 발음이 흔들린다.
    // previous/next_text = 문장을 쪼개 합성해도 억양이 끊기지 않게 앞뒤 문맥을 넘긴다.
    body: JSON.stringify({ text, model_id: MODEL, previous_text: prev || undefined, next_text: next || undefined }),
  });
  if (!res.ok) { console.error('실패', text.slice(0, 20), res.status, await res.text()); process.exit(1); }
  return Buffer.from(await res.arrayBuffer());
}

let n = 0;
for (const j of jobs) {
  if (only && !only.has(j.file.replace('.mp3', ''))) continue;
  const id = VOICE[j.who] || FALLBACK;
  const text = j.text.replace(/—/g, ',');   // 대시는 쉼(pause)으로
  const out = `public/voice/${j.file}`;
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (parts.length === 1 || GAP <= 0) {
    fs.writeFileSync(out, await tts(id, text));
  } else {
    const tmp = [];
    for (let i = 0; i < parts.length; i++) {
      const f = `${os.tmpdir()}/gv_${process.pid}_${i}.mp3`;
      fs.writeFileSync(f, await tts(id, parts[i], parts.slice(0, i).join(' '), parts.slice(i + 1).join(' ')));
      tmp.push(f);
    }
    // 조각 사이에만 무음을 끼운다: [0] sil [1] sil [2] ...
    const inputs = tmp.flatMap(f => ['-i', f]);
    const sil = tmp.length - 1;
    const silIn = Array.from({ length: sil }, () => ['-f', 'lavfi', '-t', String(GAP), '-i', 'anullsrc=r=44100:cl=mono']).flat();
    const order = [];
    for (let i = 0; i < tmp.length; i++) {
      order.push(`[${i}:a]`);
      if (i < sil) order.push(`[${tmp.length + i}:a]`);
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, ...silIn,
      '-filter_complex', `${order.join('')}concat=n=${order.length}:v=0:a=1[o]`,
      '-map', '[o]', '-c:a', 'libmp3lame', '-b:a', '128k', out]);
    tmp.forEach(f => fs.unlinkSync(f));
  }
  console.log('생성', j.file, `[${j.who}]`, parts.length > 1 && GAP > 0 ? `${parts.length}문장·gap ${GAP}s` : '', text.slice(0, 26));
  n++;
}
console.log('완료:', n, '파일');
