// 지면 콘텐츠 배치 검사 — 인물 크기 통일 · 마크가 UI 밴드를 침범하지 않는가.
//
//   증상(유저 2026-08-06): 농구 4/4 화살표가 엠버 영역에 삐져나오고, 인물은 어떤 건 너무 크고
//   어떤 건 너무 작다. 실측하니 인물 실높이가 0.439~0.713 m 로 **62% 흔들리고** 있었다.
//   원인: w/h 를 화면 보며 손으로 맞췄다. 각 값은 개별 문제(머리 겹침·발 잘림)를 푼 결과라
//   개별로는 타당하지만 **인물 크기라는 공통 축이 없어서** 모아놓으면 제각각이 된다.
//
//   지침 전문: docs/FLOOR-CONTENT-PLACEMENT.md
//   실행: node scripts/check_content_fit.mjs   (통과 exit 0)
//
// ponytail: main.js COACH 표를 여기 옮겨 적었다(중복 = 드리프트 위험). COACH 를 고치면 여기도
//   고쳐야 한다 — 그 대신 얻는 건 **시뮬을 안 띄우고 도는 회귀 검사**다. 자동 동기가 필요해지면
//   COACH 를 별도 모듈로 빼서 양쪽이 import 하게 할 것.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── 기준값 (docs/FLOOR-CONTENT-PLACEMENT.md §2) ────────────────────────────
const PERSON_H = 0.55;    // 기준 인물 실높이 (m) — 스텝백이 이미 이 값
const TOL = 0.08;         // 허용 편차 ±8%

// main.js COACH 에서 인물 크기에 관계된 필드만
const COACH = {
  READY:    { w: 0.432, h: 0.578, ph: 0.76 },
  BK_READY: { w: 0.432, h: 0.578, ph: 0.76 },
  A1:       { w: 0.62,  h: 0.64,  ph: 0.83 },
  A2:       { w: 0.9,   h: 0.9,   ph: 0.65, zoom: 0.86 },
  A3:       { w: 0.82,  h: 0.82,  ph: 0.87 },
  BK_A1:    { w: 0.62,  h: 0.64,  ph: 0.80 },
  BK_A3:    { w: 0.9,   h: 0.9 },                       // ph 없음 — 검사에 걸린다
  BK_B1:    { w: 0.55,  h: 0.98,  ph: 0.62 },
  BK_B2:    { w: 1.04,  h: 0.87,  ph: 0.63 },
  BK_B3:    { w: 1.04,  h: 0.87,  ph: 0.63 },
  BK_B4:    { w: 1.04,  h: 0.87,  ph: 0.63 },
  BK_B5:    { w: 1.04,  h: 0.87,  ph: 0.63 },
  BK_C2:    { w: 1.04,  h: 0.87,  ph: 0.63 },
};

// 대지 밴드 → 전방 거리 (러닝 기본: fpNear .3 · fpFar 2.0 · sUni 0.000687)
//   ★ 농구는 fpFar 2.4 라 이 환산이 다르다 — 미검증으로 남긴다(지침 §2 ★).
const SUNI = 0.000687, BOARD_FWD = 1.084;
const yToFwd = y => BOARD_FWD + (1335 - y) * SUNI;

const fails = [], warns = [];
const F = (m) => fails.push(m);
const W = (m) => warns.push(m);

// ── ① 인물 높이 통일 ───────────────────────────────────────────────────────
console.log('① 인물 실높이 = h × ph × zoom   (기준 ' + PERSON_H + 'm ±' + (TOL * 100) + '%)\n');
console.log('   스테이지     판 h    ph     zoom   실높이    기준대비');
for (const [id, c] of Object.entries(COACH)) {
  if (c.ph == null) {
    console.log('   ' + id.padEnd(11) + String(c.h).padEnd(7) + '—      —      미정의');
    F(`${id}: ph 가 없다 — 인물 크기가 미정의다. 소스에서 실측해 넣을 것`);
    continue;
  }
  const H = c.h * c.ph * (c.zoom ?? 1);
  const rel = H / PERSON_H;
  const bad = Math.abs(rel - 1) > TOL;
  console.log('   ' + id.padEnd(11) + String(c.h).padEnd(7) + String(c.ph).padEnd(7)
    + String(c.zoom ?? 1).padEnd(7) + (H.toFixed(3) + 'm').padEnd(10)
    + (rel * 100).toFixed(0) + '%' + (bad ? '   ← 벗어남' : ''));
  if (bad) {
    const want = PERSON_H / (c.ph * (c.zoom ?? 1));
    F(`${id}: 인물 ${H.toFixed(3)}m (기준의 ${(rel * 100).toFixed(0)}%). `
      + `h 를 ${c.h} → ${want.toFixed(3)} 으로. **크기 대신 fwd 로 겹침을 풀 것**`);
  }
}

// ── ② 소스 종횡비 — w/h 가 소스 비율을 지키는가 (9:16 클립이 섞여 있다) ────
console.log('\n② 판 종횡비 (w/h) — 같은 소스를 쓰는 스테이지끼리 같아야 한다\n');
const bySrc = { '스텝백 720×1280': ['BK_B2', 'BK_B3', 'BK_B4', 'BK_B5', 'BK_C2'] };
for (const [name, ids] of Object.entries(bySrc)) {
  const ars = ids.map(i => +(COACH[i].w / COACH[i].h).toFixed(4));
  const uniq = [...new Set(ars)];
  console.log('   ' + name.padEnd(18) + ids.join(' ') + '  →  ' + uniq.join(' / '));
  if (uniq.length > 1) F(`${name}: 같은 소스인데 종횡비가 ${uniq.length}가지다`);
}

// ── ③ 마크가 콘텐츠 밴드 안인가 ────────────────────────────────────────────
//   LAYOUT 정본을 읽어 밴드를 만든다(상수 복사 금지 — 그게 이 리포가 세 번 겪은 사고다).
const gl = readFileSync(resolve(ROOT, 'src/floorgl.js'), 'utf8');
const num = (re, d) => { const m = gl.match(re); return m ? +m[1] : d; };
const headY = num(/headY:\s*([0-9.]+)/, 176);
const ring = num(/fsTimer:\s*([0-9.]+)/, 112) * num(/ringRatio:\s*([0-9.]+)/, 1.6) / 2;
const pad = num(/\n\s*pad:\s*([0-9.]+)/, 52);
const leadK = num(/titleLeadK:\s*([0-9.]+)/, 1.25);
const gapHP = num(/gapHP:\s*([0-9.]+)/, 96);
const progH = num(/progH:\s*([0-9.]+)/, 155);
const gapPC = num(/gapPC:\s*([0-9.]+)/, 120);
// 가장 큰 알약(lead 배율)이 최악이다 — 그걸 기준으로 밴드를 잡는다
const capH = Math.round((ring * 2 + pad * 2) * leadK);
const headBot = headY + capH;
const contentY0 = headBot + gapHP + progH + gapPC;

console.log('\n③ 밴드 (floorgl LAYOUT 에서 파생 · 러닝 환산)\n');
for (const [n, y] of [['HEAD 상단', headY], ['알약 하단', headBot],
                      ['CONTENT 상단', contentY0], ['FOOT', num(/footY:\s*([0-9.]+)/, 1980)],
                      ['CONTENT 하단', num(/contentY1:\s*([0-9.]+)/, 2330)]])
  console.log('   ' + n.padEnd(14) + ('y' + Math.round(y)).padEnd(8) + yToFwd(y).toFixed(3) + ' m');

// session.js 에 **상수로 적힌** 마크 z 만 검사한다(런타임 계산분은 미검증)
const sess = readFileSync(resolve(ROOT, 'src/session.js'), 'utf8');
const MARKS = [];
for (const m of sess.matchAll(/position\.z\s*=\s*(-?[0-9.]+)/g)) MARKS.push(['position.z', +m[1]]);
for (const m of sess.matchAll(/floorArrow\(\s*[-0-9.]+\s*,\s*(-?[0-9.]+)/g)) MARKS.push(['floorArrow', +m[1]]);
const FOOT_Z = sess.match(/FOOT_Z\s*=\s*(-?[0-9.]+)/);
if (FOOT_Z) MARKS.push(['FOOT_Z', +FOOT_Z[1]]);

const nearLim = yToFwd(contentY0);   // 이보다 멀면 UI 침범
console.log('\n   session.js 상수 마크 — 콘텐츠 상단 ' + nearLim.toFixed(3) + 'm 보다 가까워야 한다\n');
if (!MARKS.length) console.log('   (상수로 적힌 마크 z 없음)');
for (const [what, z] of MARKS) {
  const fwd = Math.abs(z);
  const bad = fwd > nearLim;
  console.log('   ' + what.padEnd(14) + (z + '').padEnd(8) + fwd.toFixed(3) + ' m'
    + (bad ? '   ← UI 밴드 침범' : '   ok'));
  if (bad) F(`${what} z=${z}: 전방 ${fwd.toFixed(3)}m — 콘텐츠 상단(${nearLim.toFixed(3)}m)보다 멀다`);
}
W('농구 밴드는 fpFar 2.4 라 이 환산이 다르다 — 농구 모드에서 rig 를 읽어 재측정 필요(지침 §2 ★)');
W('스텝백 발 위치는 _beamLocal 런타임 계산이라 여기서 못 본다 — 시뮬 계측이 필요');

// ── 결과 ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(72));
if (warns.length) { console.log('\n미검증'); warns.forEach(w => console.log('  · ' + w)); }
if (fails.length) {
  console.log('\n실패 ' + fails.length + '건');
  fails.forEach(f => console.log('  ✗ ' + f));
  console.log('\n지침: docs/FLOOR-CONTENT-PLACEMENT.md');
  process.exit(1);
}
console.log('\n통과 — 인물 크기·마크 배치 이상 없음');
