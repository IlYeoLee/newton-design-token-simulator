// BK_B1 드리블 매트 초안용 실측 — 빔 사다리꼴 · 대지 밴드 · 현재 B1 요소 좌표를 한 번에 뽑는다.
//   npx vite --port 5199 띄운 상태에서:  node scripts/_probe_b1mat.mjs
import puppeteer from 'puppeteer';
const URL = process.env.URL || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => { document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r => setTimeout(r, 2500));
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
// 팩 전환이 부트를 다시 돌린다 — __dbg 가 몇 번 사라졌다 나타나므로 붙을 때까지 재시도.
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
  clearInterval(window.__vtPin);
  window.__vtPin = setInterval(() => { s._followLatch = true; s._aWatchEnd = 0; }, 8);
});
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(async () => {
  const D = window.__dbg, THREE = D.THREE, s = D.session, rig = s.rig, fp = rig._fp;
  const wpos = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
  const toBeam = v => ({ d: +(fp.oz - v.z).toFixed(3), x: +(v.x - fp.ox).toFixed(3) });
  const H = s.bkB1;
  const el = {};
  for (const [k, o] of [['ring', H.zone], ['num', H.num], ['mat', H.mat], ['footL', H.sL.group], ['footR', H.sR.group]])
    if (o) el[k] = { ...toBeam(wpos(o)), z: +wpos(o).z.toFixed(3) };
  // 대지(캔버스 UI) 밴드 → 전방 거리. main.js 와 같은 식.
  const dMid = (rig.fpNear + rig.fpFar) / 2;
  const laneW = 2 * rig._halfAt(dMid);
  const FG = await import('/src/floorgl.js');
  const L = FG.LAYOUT;
  const band = { HEAD_Y: L.HEAD.y, CAPHEAD_H: L.CAPHEAD_H, PROG_Y: L.PROG_Y,
    CONTENT_Y0: L.CONTENT_Y0, CONTENT_Y1: L.CONTENT_Y1, FOOT_Y: L.FOOT_Y };
  const fView = { w: 1600, h: 2670 };
  const sUni = laneW / fView.w;
  const boardFwd = sUni != null ? (rig.fpFar - 0.12) - (1335 - 176) * sUni : null;
  const yFwd = {};
  for (const y of Object.values(band)) if (sUni != null) yFwd[y] = +(boardFwd + (1335 - y) * sUni).toFixed(3);
  if (sUni != null) for (const y of [176, 490, 586, 861, 1335, 1980, 2330])
    yFwd[y] = +(boardFwd + (1335 - y) * sUni).toFixed(3);
  const half = {};
  for (let d = 0.4; d <= rig.fpFar + 0.001; d += 0.1) half[d.toFixed(1)] = +rig._halfAt(d).toFixed(3);
  return { fpNear: rig.fpNear, fpFar: rig.fpFar, fixedPad: rig.fixedPad,
    fp: { ox: +fp.ox.toFixed(3), oz: +fp.oz.toFixed(3), fx: +fp.fx.toFixed(3), fz: +fp.fz.toFixed(3) },
    viewW: fView?.w ?? null, sUni: sUni && +sUni.toFixed(6), boardFwd: boardFwd && +boardFwd.toFixed(3),
    band, yFwd, half, el };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
