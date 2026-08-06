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
// ★ 사본이었던 COACH 표는 src/coach-cfg.js 로 승격했다(08-06). 사본 시절 **BK_A2 가 빠져 있어서**
//   인물 실높이 139% 인 스테이지가 이 검사에 한 번도 안 걸렸다 — 위에 적혀 있던 '고치면 여기도
//   고쳐야 한다'가 그대로 현실이 된 경우다. 이제 main.js 와 같은 파일을 읽는다.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── 기준값 — 정본은 src/coach-cfg.js (docs/FLOOR-CONTENT-PLACEMENT.md §2) ──
// ★ READY·BK_READY 는 **검사 대상이 아니다.** 3D 코치 판을 안 켠다 —
//   시작화면 인물은 캔버스 영상 오버레이(floorgl _paint_ready)가 전담하고, COACH 표의 항목은
//   꺼진 경로의 잔재다(main.js `&& !/READY$/.test(id)`). 캡슐 안에 들어가는 **썸네일 카드**지
//   바닥에서 동작을 보여주는 코치가 아니라서 같은 잣대로 재면 안 된다(유저 지적).
import { COACH_CFG as COACH, COACH_SKIP as SKIP, PERSON_H, PERSON_TOL as TOL, personH }
  from '../src/coach-cfg.js';

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
  if (SKIP.has(id)) {
    console.log('   ' + id.padEnd(11) + String(c.h).padEnd(7) + String(c.ph).padEnd(7)
      + '1      —         (시작화면 썸네일 — 3D 코치 판 안 씀)');
    continue;
  }
  if (c.ph == null) {
    console.log('   ' + id.padEnd(11) + String(c.h).padEnd(7) + '—      —      미정의');
    F(`${id}: ph 가 없다 — 인물 크기가 미정의다. 소스에서 실측해 넣을 것`);
    continue;
  }
  const H = personH(c);
  const rel = H / PERSON_H;
  const bad = Math.abs(rel - 1) > TOL;
  console.log('   ' + id.padEnd(11) + String(c.h).padEnd(7) + String(c.ph).padEnd(7)
    + String(c.zoom ?? 1).padEnd(7) + (H.toFixed(3) + 'm').padEnd(10)
    + (rel * 100).toFixed(0) + '%' + (bad ? '   ← 벗어남' : ''));
  if (bad) {
    // ★ w·h 를 **같은 배율**로 건다. 예전엔 h 만 풀라고 안내했는데(want = PERSON_H/(ph*zoom)),
    //   그러면 종횡비가 깨져 인물이 늘거나 눌린다 — 크기 교정이 아니라 왜곡이다.
    //   A2 는 정방(1.0), BK_B1 은 9:16 이 클립 제약이라 실제로 밟을 뻔했다(08-06).
    const k = PERSON_H / H;
    F(`${id}: 인물 ${H.toFixed(3)}m (기준의 ${(rel * 100).toFixed(0)}%). `
      + `w·h 를 ×${k.toFixed(4)} → ${(c.w * k).toFixed(3)}/${(c.h * k).toFixed(3)} `
      + `(지금 ${c.w}/${c.h}). **종횡비 유지 · 겹침은 크기 말고 fwd 로**`);
  }
}

// ── ② 소스 종횡비 — w/h 가 소스 비율을 지키는가 (9:16 클립이 섞여 있다) ────
console.log('\n② 판 종횡비 (w/h) — 같은 소스를 쓰는 스테이지끼리 같아야 한다\n');
// 소스 실측 760×637(08-06 ffprobe) — 주석의 720×1280 은 옛 값이었다.
const bySrc = { '스텝백 760×637': ['BK_T1', 'BK_B2', 'BK_B3', 'BK_B4', 'BK_C2'] };
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
