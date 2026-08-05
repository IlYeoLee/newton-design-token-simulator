// 마크 움직임 추출 회귀 검사 — **값이 안 바뀌었는가**.
//
//   markmotion.js 는 session.js `_sbPlace`/`sbPoseAt` 안에 인라인으로 박혀 있던 식을
//   그대로 뽑아낸 것이다. 재설계가 아니라 이사다(유저 08-06: 먼저 옮기고, 그다음 고친다).
//   이사 도중에 값이 바뀌면 "고치기 전"과 "고친 후"를 구분할 수 없게 된다 — 그걸 막는다.
//
//   아래 EXPECT 는 **옮기기 전 session.js 원본 식**이다. 여기 손대면 검사의 의미가 없다.
//   나중에 모션을 의도적으로 바꿀 땐 이 파일도 같이 고치고, 커밋 메시지에 왜 바꿨는지 남길 것.
//
//   실행: npm run check:motion   (통과 exit 0)

import { easeMove, stepDelay, stampPop, airK, airAlpha, airScale, overshoot, slideAlpha }
  from '../src/markmotion.js';

// ── 옮기기 전 원본 식 (session.js 2026-08-06 이전) ────────────────────────────
const EXPECT = {
  easeStep:  f => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2),
  easeSlide: f => 1 - Math.pow(1 - f, 2.6),
  stepDelay: f => Math.max(0, Math.min(1, (f - 0.35) / 0.65)),
  stampPop:  a => Math.max(Math.max(0, 1 - a / 0.18), Math.max(0, 1 - Math.abs(a - 0.10) / 0.16) * 0.5),
  airK:      f => Math.sin(Math.PI * f),
  airAlpha:  f => 0.30 + 0.25 * (1 - Math.sin(Math.PI * f)),
  airScale:  f => 1 + 0.08 * Math.sin(Math.PI * f),
  overshoot: f => (f > 0.85 ? (f - 0.85) / 0.15 * 0.06 : 0),
  slideAlpha: f => 0.70 + 0.25 * (1 - Math.max(0, 1 - f)),
};

const EPS = 1e-9;
const fails = [];
const N = 201;

const cmp = (name, got, want, xs) => {
  let worst = 0, at = 0;
  for (const x of xs) {
    const d = Math.abs(got(x) - want(x));
    if (d > worst) { worst = d; at = x; }
  }
  const ok = worst <= EPS;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(11)} 최대 오차 ${worst.toExponential(1)}${ok ? '' : `  (x=${at.toFixed(3)})`}`);
  if (!ok) fails.push(`${name}: x=${at.toFixed(3)} 에서 ${worst.toExponential(2)} 차이 — 추출이 값을 바꿨다`);
};

const unit = Array.from({ length: N }, (_, i) => i / (N - 1));
const ages = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 0.6);

console.log('\n  markmotion 추출 = 원본 식과 동일한가\n');
cmp('easeMove step',  f => easeMove(false, f), EXPECT.easeStep,  unit);
cmp('easeMove slide', f => easeMove(true, f),  EXPECT.easeSlide, unit);
cmp('stepDelay',      stepDelay,  EXPECT.stepDelay,  unit);
cmp('stampPop',       stampPop,   EXPECT.stampPop,   ages);
cmp('airK',           airK,       EXPECT.airK,       unit);
cmp('airAlpha',       airAlpha,   EXPECT.airAlpha,   unit);
cmp('airScale',       airScale,   EXPECT.airScale,   unit);
cmp('overshoot',      overshoot,  EXPECT.overshoot,  unit);
cmp('slideAlpha',     slideAlpha, EXPECT.slideAlpha, unit);

// 성질 검사 — 값이 같은 것과 별개로 '움직임'이 성립하는지
const props = [
  ['스텝 이징은 0→0 · 1→1',      Math.abs(easeMove(false, 0)) < EPS && Math.abs(easeMove(false, 1) - 1) < EPS],
  ['슬라이드 이징도 0→0 · 1→1',   Math.abs(easeMove(true, 0)) < EPS && Math.abs(easeMove(true, 1) - 1) < EPS],
  ['슬라이드가 초반에 더 빠르다',  easeMove(true, 0.25) > easeMove(false, 0.25)],
  ['타닥이 두 박이다',            (() => { let peaks = 0; for (let i = 1; i < 200; i++) { const a = i / 400;
      if (stampPop(a) > stampPop(a - 1 / 400) && stampPop(a) >= stampPop(a + 1 / 400)) peaks++; } return peaks >= 1; })()],
  ['체공은 중간에서 최대',        airK(0.5) > airK(0.1) && airK(0.5) > airK(0.9)],
  ['오버슈트는 착지 직전에만',    overshoot(0.5) === 0 && overshoot(0.95) > 0],
];
console.log('');
for (const [n, ok] of props) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}`);
  if (!ok) fails.push(n);
}

if (fails.length) { console.error('\n실패:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\n통과 — 추출이 값을 바꾸지 않았다. 여기서부터 고치면 된다.');
