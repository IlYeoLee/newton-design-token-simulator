// BK_B1 ←→ 스탠스 화살표 회귀 검사 — "화살표가 너무 흐려"(2026-08-06)를 값으로 잡아 둔다.
//
//   원인: 꼬리를 발마크 바깥(half+0.05)에 두어 촉이 빔 측면 페더로 나갔다.
//         실측 d=1.15m 에서 창 반폭 0.549 · 페더 0.25 → 최종 알파 0.58 → 0 (벌어질수록 어두워짐).
//   지금: 마크 앞 0.26m · 꼬리 ±0.04 고정 → 벌어짐 전 구간에서 알파 ≈1.
//
//   실행: 데브 서버를 띄운 상태에서  node scripts/check_b1_arrow.mjs [--base http://127.0.0.1:5199]
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:5199');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const b = await puppeteer.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
await p.goto(BASE + '/?scene=BK_B1&sceneloop=40', { waitUntil: 'networkidle2', timeout: 60000 });
for (let i = 0; i < 40; i++) { await sleep(1000); if (await p.evaluate(() => window.__dbg?.session?.stage) === 'BK_B1') break; }

const rows = [];
for (let i = 0; i < 70; i++) {
  const s = await p.evaluate(() => {
    const S = window.__dbg?.session, H = S?.bkB1;
    if (!H || !S.bkB1Setup) return null;
    const one = g => ({ gain: +(g._gain ?? 1).toFixed(2), op: +g._mesh.material.opacity.toFixed(3), dots: !!g._dots, scale: g._scale });
    return { widen: +(S.bkB1Widen ?? 0).toFixed(2), L: one(H.aL), R: one(H.aR) };
  });
  if (s && s.L.gain > 0) rows.push(s);
  await sleep(200);
}
await b.close();

const fails = [];
const check = (ok, what, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  — ' + detail : '')); if (!ok) fails.push(what); };

console.log('BK_B1 화살표 검사 —', BASE, `(켜진 샘플 ${rows.length})`);
check(rows.length >= 4, '셋업 구간에서 화살표가 켜진다', `샘플 ${rows.length}`);
if (rows.length) {
  const minOp = Math.min(...rows.flatMap(r => [r.L.op, r.R.op]));
  const wide = rows.filter(r => r.widen > 0.8);
  const minWide = wide.length ? Math.min(...wide.flatMap(r => [r.L.op, r.R.op])) : 0;
  check(minOp > 0.85, '전 구간 알파 > 0.85 (빔 측면 페더 밖)', `최소 ${minOp}`);
  check(minWide > 0.85, '가장 벌어진 순간에도 안 흐려진다', `최소 ${minWide} (샘플 ${wide.length})`);
  check(rows[0].L.dots && rows[0].R.dots, '지면 점렬 자루 (러닝과 같은 규약)');
  check(rows[0].L.scale > 1.4, '두께 정규화 scale (0.34m 화살표와 같은 실측 두께)', `scale ${rows[0].L.scale}`);
}
process.exit(fails.length ? 1 : 0);
