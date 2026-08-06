// 지면 조판 밴드 검사 — docs/FLOOR-LAYOUT-SPEC.md 의 규칙을 **코드가 지키는지** 실측한다.
//
//   왜 필요한가(유저 2026-08-07): "매번 뭐가 타이틀 위로 올라와 있고 아무런 체계가 없다."
//   규칙을 문서에만 적으면 다음 세션이 또 어긴다 — 이 파일이 그 규칙의 집행자다.
//   순수 산술이라 시뮬을 안 띄우고 돈다(빔 경계만 리그 실측값을 상수로 받는다).
//
//   실행: node scripts/check_floor_bands.mjs      (통과 exit 0)

import { readFileSync } from 'fs';

const src = readFileSync(new URL('../src/floorgl.js', import.meta.url), 'utf8');
const num = (k) => {
  const m = new RegExp(`\\b${k}:\\s*([0-9.]+)`).exec(src);
  if (!m) throw new Error(`TOK.${k} 를 못 찾았다 — 이름이 바뀌었으면 이 검사기도 고칠 것`);
  return +m[1];
};
const T = {};
for (const k of ['headY', 'ringRatio', 'fsTimer', 'pad', 'gapHP', 'progH', 'gapPC',
                 'safePad', 'footY', 'contentY1', 'fsTitle', 'fsTitlePv', 'fsBadge', 'gapPv']) T[k] = num(k);

const W = 1600, H = 2670;
const BEAM_FAR_Y = 289;            // 러닝 기본 리그 실측(2026-08-07). 팩·리그가 바뀌면 다시 재야 한다.
const ring = T.fsTimer * T.ringRatio / 2;
const CAPHEAD_H = ring * 2 + T.pad * 2;
const band = {
  '① 투사밖':  [0, BEAM_FAR_Y],
  '② 라벨':    [BEAM_FAR_Y, T.headY],
  '③ 타이틀':  [T.headY, T.headY + CAPHEAD_H],
  '④ 진행':    [T.headY + CAPHEAD_H + T.gapHP, T.headY + CAPHEAD_H + T.gapHP + T.progH],
  '⑤ 콘텐츠':  [T.headY + CAPHEAD_H + T.gapHP + T.progH + T.gapPC, T.footY],
  '⑥ 발밑':    [T.footY, H - T.safePad],
};
const fails = [];
const ok = [];

// 규칙① 밴드는 겹치지 않고, 순서대로 늘어서며, 대지를 벗어나지 않는다
const names = Object.keys(band);
for (let i = 0; i < names.length; i++) {
  const [a, b] = band[names[i]];
  if (b < a) fails.push(`${names[i]} 밴드가 음수 폭이다 (${a}~${b}) — 간격 값이 너무 크다`);
  if (i > 0) {
    const prevEnd = band[names[i - 1]][1];
    if (a < prevEnd) fails.push(`${names[i - 1]} ↔ ${names[i]} 가 ${prevEnd - a}px 겹친다`);
  }
}
if (band['⑤ 콘텐츠'][1] > band['⑥ 발밑'][0]) fails.push('콘텐츠 밴드가 발밑을 침범한다');
if (T.contentY1 > T.footY) fails.push(`contentY1(${T.contentY1}) 이 footY(${T.footY}) 를 넘는다 — 규칙①`);

// 규칙② 타이틀 위로 올라가는 것은 ② 라벨 하나뿐이며, ①을 침범할 수 없다
const prevBaseline = T.headY - T.gapPv;
if (prevBaseline < BEAM_FAR_Y) fails.push(`PREVIEW 라벨(baseline ${prevBaseline}) 이 투사 밖(<${BEAM_FAR_Y})이다 — gapPv 를 줄이거나 headY 를 내릴 것`);
else ok.push(`② 라벨 baseline ${prevBaseline} — 투사 안`);

// 규칙③ 알약 높이는 상수 — 코드가 높이에 배율을 곱하지 않는지
if (/const h = Math\.round\(\(TOK\.ring \* 2 \+ TOK\.pad \* 2\) \* K2\)/.test(src))
  fails.push('알약 높이에 K2 를 곱하고 있다 — 규칙③ 위반(높이는 전 화면 공통 상수)');
else ok.push('③ 알약 높이 = 상수');

// 규칙④ 링 지름은 값 글자 수와 무관
if (/_ringRFor[\s\S]{0,400}?measureText/.test(src))
  fails.push('_ringRFor 가 글자 폭을 재고 있다 — 규칙④ 위반(링 지름 고정)');
else ok.push('④ 링 지름 = 고정');

// 규칙③ 활자 위계 — 2급이 가독 하한 위인가
const minFs = 68 - 40 * (T.headY / H);
if (T.fsBadge < minFs) fails.push(`2급(${T.fsBadge}) 이 y${T.headY} 가독 하한(${minFs.toFixed(0)}) 미달`);
else ok.push(`③ 2급 ${T.fsBadge} ≥ 하한 ${minFs.toFixed(0)}`);

console.log('\n■ 밴드 (측정)');
for (const [n, [a, b]] of Object.entries(band)) console.log(`  ${n.padEnd(9)} ${String(Math.round(a)).padStart(4)} ~ ${String(Math.round(b)).padStart(4)}   (${Math.round(b - a)}px)`);
console.log('\n■ 통과'); ok.forEach(s2 => console.log('  ✓ ' + s2));
if (fails.length) { console.log('\n■ 위반'); fails.forEach(s2 => console.log('  ✗ ' + s2)); console.log(`\n총 ${fails.length}건 — docs/FLOOR-LAYOUT-SPEC.md 참조`); process.exit(1); }
console.log('\n✅ 규칙 위반 없음');
