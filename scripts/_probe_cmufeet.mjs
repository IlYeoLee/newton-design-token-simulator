// cmu124_06(스텝백 정본 클립)의 발·골반 월드 좌표 실측 — SB_POSE 재저작 근거
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess?.xbot?.actions && window.__sess.xbot.model, { timeout: 30000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.waitForFunction(() => !!window.__sess.xbot.actions['auto_cmu124_06'], { timeout: 20000 });
const rows = await p.evaluate(() => {
  const xb = window.__sess.xbot;
  const out = [];
  for (let t = 1.20; t <= 2.62; t += 1 / 30) {
    xb.playDemo('auto_cmu124_06', 0.016, false, t);
    xb.mixer.update(0);
    xb.model.updateMatrixWorld(true);
    const q = xb.getProbes();
    out.push({ t: +t.toFixed(3),
      Lx: +q.footL.x.toFixed(3), Lz: +q.footL.z.toFixed(3),
      Rx: +q.footR.x.toFixed(3), Rz: +q.footR.z.toFixed(3),
      Hx: +q.hips.x.toFixed(3), Hz: +q.hips.z.toFixed(3) });
  }
  return out;
});
await b.close();
for (const r of rows) console.log(`${r.t}  L(${r.Lx},${r.Lz})  R(${r.Rx},${r.Rz})  H(${r.Hx},${r.Hz})`);
