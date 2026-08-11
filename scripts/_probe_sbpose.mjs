// SB_POSE 재저작 검증 — BK_B4 따라하기에서 봇 발(IK)과 발자국 마크가 실측 안무대로 움직이는지
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 1100, height: 900 });
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 150)));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__cam, { timeout: 30000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => {
  const s = window.__sess;
  s.stageIdx = s.stages.findIndex(x => x.id === 'BK_B4'); s.t = 0; s._enter();
});
// 따라하기 진입까지 대기 후, 한 바퀴 동안 봇 발 좌표 샘플 + 스샷
await p.waitForFunction(() => window.__sess._followLatch === true, { timeout: 20000 });
const rows = [];
for (let i = 0; i < 10; i++) {
  const r = await p.evaluate(() => {
    const s = window.__sess, q = s.xbot.getProbes();
    return { st: s.stage, vt: +(s.stepVidT ?? -1).toFixed(2),
      Lz: +q.footL.z.toFixed(2), Rz: +q.footR.z.toFixed(2), Rx: +q.footR.x.toFixed(2) };
  }).catch(() => null);
  if (r) rows.push(r);
  await p.screenshot({ path: `scratch_sb_${i}.png` });
  if (r && r.st !== 'BK_B4') break;
  await new Promise(r2 => setTimeout(r2, 350));
}
await b.close();
for (const r of rows) console.log(`${r.st} vt=${r.vt}  R(x${r.Rx}, z${r.Rz})  L(z${r.Lz})`);
const zs = rows.filter(r => r.st === 'BK_B4').map(r => r.Rz);
console.log(`R발 z 스팬(따라하기): ${Math.min(...zs).toFixed(2)} ~ ${Math.max(...zs).toFixed(2)} (${(Math.max(...zs) - Math.min(...zs)).toFixed(2)}m)`);
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
