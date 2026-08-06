import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.setViewport({ width: 1280, height: 800 });
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => { document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r => setTimeout(r, 2500));
for (let i = 0; i < 30; i++) {
  const ok = await p.evaluate(() => { try { window.__dbg.session.start('basketball'); return true; } catch { return false; } });
  if (ok) break; await new Promise(r => setTimeout(r, 1000));
}
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => {
  const s = window.__dbg.session;
  const i = s.stages.findIndex(x => x.id === 'BK_B1');
  if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); }
  clearInterval(window.__vtPin);
  // 셋업(6초)을 지나 본 연습 상태로 고정 — 매트가 다 켜진 그림을 본다
  window.__vtPin = setInterval(() => { s.stageIdx = i; s._followLatch = true; s._aWatchEnd = 0; if (s.t < 8) s.t = 8.5; if (s.bkB1) s.bkB1.count = 6; }, 8);
});
// 다크 바닥으로 — 투사 룩을 제대로 본다
await p.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === '다크') b.click(); });
await new Promise(r => setTimeout(r, 3500));
// 개발 UI 숨김 — 그림만 본다

await new Promise(r => setTimeout(r, 800));
const OUT = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user/e22b4c85-8b4a-4d3b-a8c3-0d5452cb94fa/scratchpad/';
await p.screenshot({ path: OUT + 'sim-b1.png', clip: { x: 310, y: 150, width: 960, height: 650 } });
const info = await p.evaluate(() => {
  const H = window.__dbg.session.bkB1;
  return { op: H.mat.material.opacity, prog: H.mat._prim.P.prog, vis: H.mat.visible,
    parent: !!H.mat.parent, z: +H.mat.position.z.toFixed(3), count: H.count };
});
console.log(JSON.stringify(info), 'errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
