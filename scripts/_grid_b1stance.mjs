// BK_B1 셋업(발 벌리기) 토큰이 **초광각 띠 프레임**에 들어오는 시선각을 실측으로 푼다.
//   유저 레퍼런스 1816×510 = 3.561:1 — 16:9 렌더의 중앙 49.9% 띠(레터박스)로 본다.
//   각도 그리드 = 눈에서 본 요소별 하향각(수평선 아래) · 방위각 · 그 각이 띠 안에 앉는 pitch 구간.
//
//   npx vite --port 5199 띄운 상태에서:  node scripts/_grid_b1stance.mjs [비율] [vfov] [렌더aspect]
import puppeteer from 'puppeteer';

const RATIO = +(process.argv[2] || 1816 / 510);   // 목표 띠 비율
const VFOV  = +(process.argv[3] || 60);           // 1인칭 카메라 세로 화각 (main.js: fpMode 지면 = 60)
const ASP   = +(process.argv[4] || 16 / 9);       // 렌더 프레임 비율
const BAND  = ASP / RATIO;                        // 띠가 차지하는 세로 비율 → |ndcY| 상한

const URL = process.env.URL || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
for (let i = 0; i < 30; i++) {
  const ok = await p.evaluate(() => { try { window.__dbg.session.start('basketball'); return true; } catch { return false; } });
  if (ok) break;
  await new Promise(r => setTimeout(r, 1000));
}
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => {
  const s = window.__dbg.session;
  const i = s.stages.findIndex(x => x.id === 'BK_B1');
  if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); }
});
// 벌림이 끝난 시점(tB≈3.2s, we=1 · 화살표 _prog 최대)에서 잰다
await new Promise(r => setTimeout(r, 3400));

const out = await p.evaluate(({ VFOV, ASP, BAND }) => {
  const D = window.__dbg, THREE = D.THREE, s = D.session, H = s.bkB1;
  const eye = D.xbot.getEyeWorld().clone();
  const box = o => { const bb = new THREE.Box3().setFromObject(o); return bb.isEmpty() ? null : bb; };
  const parts = { footL: H.sL.group, footR: H.sR.group, arrowL: H.aL, arrowR: H.aR };

  // 각도 그리드 — 눈 기준. d = 전방거리(-z), 하향각 = atan(eyeY / d)
  const grid = {}, pts = [];
  for (const [k, o] of Object.entries(parts)) {
    const bb = box(o); if (!bb) continue;
    const cs = [];
    for (const X of [bb.min.x, bb.max.x]) for (const Z of [bb.min.z, bb.max.z]) {
      const P = new THREE.Vector3(X, (bb.min.y + bb.max.y) / 2, Z);
      cs.push(P); pts.push({ k, P });
    }
    const dN = eye.z - bb.max.z, dF = eye.z - bb.min.z;   // 전방 -z
    grid[k] = {
      d: [+dN.toFixed(3), +dF.toFixed(3)],
      x: [+(bb.min.x - eye.x).toFixed(3), +(bb.max.x - eye.x).toFixed(3)],
      dep: [+(Math.atan2(eye.y, dN) * 180 / Math.PI).toFixed(2),    // 가까운 변 = 더 깊은 하향각
            +(Math.atan2(eye.y, dF) * 180 / Math.PI).toFixed(2)],
      azi: [+(Math.atan2(bb.min.x - eye.x, (dN + dF) / 2) * 180 / Math.PI).toFixed(2),
            +(Math.atan2(bb.max.x - eye.x, (dN + dF) / 2) * 180 / Math.PI).toFixed(2)],
    };
  }

  // pitch 스윕 — 실제 PerspectiveCamera 로 투영해서 띠(|ndcY| ≤ BAND) 안인지 본다
  const cam = new THREE.PerspectiveCamera(VFOV, ASP, 0.05, 60);
  const probe = deg => {
    const g = deg * Math.PI / 180;
    cam.position.copy(eye);
    cam.lookAt(eye.x, eye.y + Math.sin(g), eye.z - Math.cos(g));
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    let yMin = 9, yMax = -9, xMax = 0;
    const per = {};
    for (const { k, P } of pts) {
      const v = P.clone().project(cam);
      yMin = Math.min(yMin, v.y); yMax = Math.max(yMax, v.y); xMax = Math.max(xMax, Math.abs(v.x));
      const e = per[k] || (per[k] = { y0: 9, y1: -9, x: 0 });
      e.y0 = Math.min(e.y0, v.y); e.y1 = Math.max(e.y1, v.y); e.x = Math.max(e.x, Math.abs(v.x));
    }
    return { deg, yMin: +yMin.toFixed(3), yMax: +yMax.toFixed(3), xMax: +xMax.toFixed(3),
      span: +(yMax - yMin).toFixed(3), mid: +((yMax + yMin) / 2).toFixed(3),
      fits: yMax <= BAND && yMin >= -BAND && xMax <= 1,
      per: Object.fromEntries(Object.entries(per).map(([k, e]) =>
        [k, [+e.y0.toFixed(3), +e.y1.toFixed(3), +e.x.toFixed(3)]])) };
  };

  const sweep = [];
  for (let d = -75; d <= -25; d += 1) sweep.push(probe(d));
  const ok = sweep.filter(r => r.fits);
  // 최적 = 띠 정중앙에 오는 각(0.1° 해상도로 재탐색)
  let best = null;
  for (let d = -75; d <= -25; d += 0.1) {
    const r = probe(+d.toFixed(1));
    if (!best || Math.abs(r.mid) < Math.abs(best.mid)) best = r;
  }
  return { eye: { x: +eye.x.toFixed(3), y: +eye.y.toFixed(3), z: +eye.z.toFixed(3) },
    grid, band: BAND, sweep, okRange: ok.length ? [ok[0].deg, ok[ok.length - 1].deg] : null, best };
}, { VFOV, ASP, BAND });

const f = n => (n >= 0 ? '+' : '') + n.toFixed(3);
console.log(`목표 띠 ${RATIO.toFixed(3)}:1 · vfov ${VFOV}° · 렌더 ${ASP.toFixed(3)}:1 → 띠 |ndcY| ≤ ${BAND.toFixed(4)}`);
console.log(`눈 (x ${out.eye.x}, y ${out.eye.y}, z ${out.eye.z})\n`);
console.log('── 각도 그리드 (눈 기준) ───────────────────────────────────────');
console.log('요소       전방 d(m)        하향각(°)         방위각(°)');
for (const [k, g] of Object.entries(out.grid))
  console.log(`${k.padEnd(9)} ${String(g.d[0]).padStart(5)}~${String(g.d[1]).padEnd(6)} ` +
    `${String(g.dep[0]).padStart(6)}~${String(g.dep[1]).padEnd(7)} ${String(g.azi[0]).padStart(7)}~${g.azi[1]}`);
console.log('\n── pitch 스윕 (ndcY, 띠 밖이면 ✗) ──────────────────────────────');
console.log('pitch   yMin    yMax    span   |x|max  띠');
for (const r of out.sweep) if (r.deg % 2 === 0)
  console.log(`${String(r.deg).padStart(4)}°  ${f(r.yMin)}  ${f(r.yMax)}  ${r.span.toFixed(3)}  ${r.xMax.toFixed(3)}   ${r.fits ? '○' : '✗'}`);
console.log(`\n띠 안에 다 들어오는 구간: ${out.okRange ? `${out.okRange[0]}° ~ ${out.okRange[1]}°` : '없음'}`);
console.log(`정중앙 정렬각: ${out.best.deg}°  (yMin ${f(out.best.yMin)} / yMax ${f(out.best.yMax)} / span ${out.best.span})`);
console.log(`  요소별 [y0, y1, |x|max]: ${JSON.stringify(out.best.per)}`);

await b.close();
