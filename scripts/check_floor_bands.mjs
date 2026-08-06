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
// ★ 상단 금지선은 **상수가 아니라 식**이다(2026-08-07 재측정).
//   main.js 배치: boardFwd = (fpFar − 0.12) − (1335 − 176)·sUni  ⇒ 대지 y176 이 빔 far − 0.12m 에 앵커된다.
//   따라서  y_금지 = 176 − 0.12 / sUni,  sUni = 2·halfAt(dMid) / 1600.
//     러닝 fpFar 2.0 → sUni .000687 → y ≥ 1      농구 fpFar 2.4 → .000754 → y ≥ 17
//   팩 중 가장 보수적인 값(농구 17)을 쓴다. 리그가 또 바뀌면 이 표만 갱신하면 된다.
const RIGS = { 러닝: { far: 2.0, hN: 0.32, hF: 0.779 }, 농구: { far: 2.4, hN: 0.32, hF: 0.887 } };
const yForbid = (r) => {
  const dMid = (0.3 + r.far) / 2;
  const half = r.hN + (r.hF - r.hN) * (dMid - 0.3) / (r.far - 0.3);
  const sUni = 2 * half / W;
  return 176 - 0.12 / sUni;
};
const BEAM_FAR_Y = Math.max(...Object.values(RIGS).map(yForbid));
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


// ── 규칙⑤ 타이머·카운트는 한 화면에 하나 ────────────────────────────────────────
//   유저 2026-08-07: "어느 화면은 타이머가 이미 있거나 중복되는 것도 잡아, 모두."
//   정본: floorgl 의 ADV(무엇을 세나) + showArc/showRing(어디에 그리나) + CAPS.pv(관찰 링).
//   같은 값을 두 곳에서 세면 화면이 "어느 게 진짜 타이머냐" 를 묻게 된다(유저 #177 과 같은 사고).
const advM = /const ADV = \{([\s\S]*?)\};/.exec(src);
if (advM) {
  const ADV = {};
  for (const m of advM[1].matchAll(/([A-Z0-9_]+)\s*:\s*'(\w+)'/g)) ADV[m[1]] = m[2];
  const capsM = /const CAPS = \{([\s\S]*?)\n\};/.exec(src);
  const PV = new Set();
  if (capsM) for (const m of capsM[1].matchAll(/(\w+)\s*:\s*\{[^}]*\bpv:\s*true/g)) PV.add(m[1]);
  const dup = [];
  for (const [st, adv] of Object.entries(ADV)) {
    const src2 = [];
    if (adv === 'time') src2.push('아크(시간)');
    if (['segment', 'hold', 'reps'].includes(adv)) src2.push(`링(${adv})`);
    // ★ 관찰 링(pv)은 **중복이 아니다** — '영상이 몇 초/몇 회 남았나'는 따라하기 시계와
    //   시간대가 겹치지 않는 다른 값이다(floorgl 주석의 정본 규약). 따라하기 시계만 센다.
    if (st === 'A2') src2.push('마크 안 숫자');       // 코드 특수: work 발에 카운트다운
    if (src2.length > 1) dup.push(`${st}: ${src2.join(' + ')}`);
  }
  if (dup.length) { console.log('\n■ 타이머 중복 (규칙⑤)'); dup.forEach(d => console.log('  ✗ ' + d)); fails.push(...dup.map(d => '타이머 중복 — ' + d)); }
  else ok.push('⑤ 타이머 중복 없음');
}

console.log('\n■ 밴드 (측정)');
for (const [n, [a, b]] of Object.entries(band)) console.log(`  ${n.padEnd(9)} ${String(Math.round(a)).padStart(4)} ~ ${String(Math.round(b)).padStart(4)}   (${Math.round(b - a)}px)`);
console.log('\n■ 통과'); ok.forEach(s2 => console.log('  ✓ ' + s2));
if (fails.length) { console.log('\n■ 위반'); fails.forEach(s2 => console.log('  ✗ ' + s2)); console.log(`\n총 ${fails.length}건 — docs/FLOOR-LAYOUT-SPEC.md 참조`); process.exit(1); }
console.log('\n✅ 규칙 위반 없음');
