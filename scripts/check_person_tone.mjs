// 종목 간 인물(코치 시범 영상) 채도가 맞는가 — 클립 실측.
//
//   반복된 증상: "왜 러닝 농구는 더 하얘?"(fx-core.js:440) · "농구 시범 영상이 덜 쨍하다"(유저 08-06).
//   재는 값은 **결과 색의 평균 채도(HSV S)** 다. 클립 휘도 → personAura 의 band → look2Ramp 를
//   그대로 따라가 색을 만들고 그 S 를 평균낸다.
//
//   ⚠ 이 스크립트가 처음엔 'band 상단에서 포화한 픽셀 비율'을 쟀는데 **틀린 대리지표**였다.
//     look2Ramp 스톱이 [흰, #FA3030, #FF4000, #FF8E5E(S .63), #FF3300(S 1.0)] 라 채도가
//     단조롭지 않다 — 포화하는 자리가 곧 가장 쨍한 색이라, '평평한 면적'을 줄이면 오히려
//     창백한 살구(#FF8E5E) 지대가 늘어난다. 채도를 말하려면 색을 재야 한다.
//
//   실행: npm run check:person   (통과 exit 0)
//   COACH_CFG 의 tone 을 흔들어 봐도 S 는 1% 미만으로 움직인다 — tone 은 채도 손잡이가 아니다.
//   채도를 실제로 올리는 건 uPSat 하나뿐이고 그건 세 인물 셰이더 공용이다(fx-core.js:485).
//
// ponytail: 96x96 축소 24프레임 표본 · 그린 배경만 제외(앱 clipExposure 와 동일 규칙).
//   셰이더의 detail/블러/잉크 단계는 재현하지 않으므로 절대값이 아니라 **종목 간 상대 비교**로만 쓴다.

import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const ROOT = new URL('../public/', import.meta.url).pathname.replace(/^\//, '');
const SPREAD = 0.10;   // 러닝 기준값 대비 허용 편차(S) — 이보다 벌어지면 종목이 갈린 것

// COACH_CFG(main.js) 대조본 — 정본은 main.js 다.
const CLIPS = [
  ['러닝  A2  sean_lunge',      'ready-view/assets/sean_lunge.webm',     null,          0, true],
  ['러닝  A3  sean_highknee',   'ready-view/assets/sean_highknee.webm',  null,          0, true],
  ['농구  A1  bk_sidebend_pp',  'ready-view/assets/bk_sidebend_pp.webm', null,      0.045, false],
  ['농구  A2  bk_highknee',     'ready-view/assets/bk_highknee.webm',    null,          0, false],
  ['농구  A3  bk_squat',        'ready-view/assets/bk_squat.webm',       null,          0, false],
  ['농구  B1  bhandle_pp',      'bhandle_pp.mp4',                        null,          0, false],
  ['농구  B2~C2 stepback_fwd',  'stepback_fwd.mp4',            [0.03, 0.86],         0.09, false],
];

const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// fx-core.js look2Ramp 그대로
const look2Ramp = t => {
  let c = mix3([1, 1, 1], [0.980, 0.188, 0.188], cl(t * 4));
  c = mix3(c, [1, 0.251, 0], cl(t * 4 - 1));
  c = mix3(c, [1, 0.557, 0.369], cl(t * 4 - 2));
  return mix3(c, [1, 0.2, 0], cl(t * 4 - 3));
};
const hsvS = c => { const mx = Math.max(...c), mn = Math.min(...c); return mx <= 0 ? 0 : (mx - mn) / mx; };
// fx-core.js personAura 의 톤 단계
const band = (lum, tone) => 0.3 + 0.7 * cl((Math.pow(cl(lum), 0.59) - 0.5) * 0.8 + 0.72 + tone);

const rows = [];
for (const [label, rel, rng, tone, isRef] of CLIPS) {
  let buf;
  try {
    buf = execFileSync(ffmpegPath, ['-v', 'error', '-i', ROOT + rel,
      '-vf', `select='not(mod(n\\,10))',scale=96:96`, '-vsync', '0',
      '-frames:v', '24', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  } catch { console.log(`  SKIP ${label} — 디코드 실패(자산 없음?)`); continue; }
  const ls = [];
  for (let i = 0; i + 2 < buf.length; i += 3) {
    const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255;
    if (g - Math.max(r, b) > 0.10) continue;   // 그린 배경 제외
    ls.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  if (ls.length < 500) { console.log(`  SKIP ${label} — 표본 부족(${ls.length})`); continue; }
  ls.sort((a, b) => a - b);
  const lo = rng ? rng[0] : pct(ls, 0.05), hi = rng ? rng[1] : pct(ls, 0.95);
  let s = 0;
  for (const l of ls) s += hsvS(look2Ramp(band(cl((l - lo) / (hi - lo)), tone)));
  rows.push({ label, tone, S: s / ls.length, isRef });
}

const refs = rows.filter(r => r.isRef);
if (!refs.length) { console.error('러닝 기준 클립을 하나도 못 읽었다 — 비교 불가.'); process.exit(1); }
const ref = refs.reduce((a, r) => a + r.S, 0) / refs.length;

const fails = [];
console.log(`  결과 색 평균 채도(HSV S) — 러닝 기준 ${ref.toFixed(3)} ± ${SPREAD}\n`);
for (const r of rows) {
  const d = r.S - ref, ok = Math.abs(d) <= SPREAD;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.label.padEnd(24)} tone ${String(r.tone).padStart(6)}  S ${r.S.toFixed(3)}  (기준 대비 ${d >= 0 ? '+' : ''}${d.toFixed(3)})`);
  if (!ok) fails.push(`${r.label}: S ${r.S.toFixed(3)} — 러닝 기준 ${ref.toFixed(3)} 에서 ${d.toFixed(3)} 벗어남`);
}

if (fails.length) { console.error('\n실패:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\n통과 — 종목 간 인물 채도가 붙어 있다.');
