// 세션 음성 전량 재생성 — ElevenLabs TTS
//   스테이지 진입: public/voice/<stageId>.mp3  (session.js STAGES voice에서 추출)
//   중간 코칭(_say): public/voice/say_<key>.mp3 (session.js _say 호출에서 추출)
//   화자 매핑: 션/커리/고수 = 코치(남), 시스템 = 안내(여)
// 사용: ELEVENLABS_API_KEY=... node scripts/gen_voice.mjs [--only A1,say_a1go] [--voices]
import fs from 'fs';

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
const S = { stability: 0.4, similarity_boost: 0.8, style: 0.35, speed: 1.05 };
const VOICE = {
  '션':   { id: 'PLACEHOLDER_RUN',  settings: S },   // 러닝
  '커리': { id: 'PLACEHOLDER_BK',   settings: S },   // 농구
  '고수': { id: 'PLACEHOLDER_BX',   settings: S },   // 복싱
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

let n = 0;
for (const j of jobs) {
  if (only && !only.has(j.file.replace('.mp3', ''))) continue;
  const v = VOICE[j.who] || FALLBACK;
  const text = j.text.replace(/—/g, ',');   // 대시는 쉼(pause)으로
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: v.settings }),
  });
  if (!res.ok) { console.error('실패', j.file, res.status, await res.text()); process.exit(1); }
  fs.writeFileSync(`public/voice/${j.file}`, Buffer.from(await res.arrayBuffer()));
  console.log('생성', j.file, `[${j.who}]`, text.slice(0, 30));
  n++;
}
console.log('완료:', n, '파일');
