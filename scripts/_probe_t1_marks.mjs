// BK_T1 마크 실측 — 래퍼가 아니라 **실제 메시의 유니폼**을 훑는다(uGain/uFade/opacity).
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess, { timeout: 30000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => { const s = window.__sess; s.stageIdx = s.stages.findIndex(x => x.id === 'BK_T1'); s.t = 0; s._enter(); });
const snap = () => p.evaluate(() => {
  const s = window.__sess, g = s.G?.BK_T1;
  let vis = 0, n = 0, peak = 0;
  g?.traverse?.(o => {
    if (!o.isMesh || !o.visible) return;
    let par = o, on = true;
    while (par) { if (par.visible === false) { on = false; break; } par = par.parent; }
    if (!on) return;
    const m = o.material, u = m?.uniforms;
    const a = u?.uGain?.value ?? u?.uFade?.value ?? u?.uOp?.value ?? (m?.transparent ? m.opacity : 1);
    n++; if (a > 0.02) { vis++; peak = Math.max(peak, a); }
  });
  return { t: +(s.t ?? 0).toFixed(1), demo: !!s.demoActive, fl: !!s._followLatch, pv: s._pvLoops ?? 0,
           meshes: n, 보이는마크: vis, 최대α: +peak.toFixed(2), groupVis: !!g?.visible };
});
console.log('  wall   t  demo follow pv  메시  보이는마크  최대α');
const t0 = Date.now();
while (Date.now() - t0 < 15000) {
  await new Promise(r => setTimeout(r, 900));
  const s = await snap();
  console.log(`  ${((Date.now()-t0)/1000).toFixed(1).padStart(4)}s ${String(s.t).padStart(4)} ${String(s.demo).padStart(5)} ${String(s.fl).padStart(6)} ${String(s.pv).padStart(2)} ${String(s.meshes).padStart(5)} ${String(s.보이는마크).padStart(8)} ${String(s.최대α).padStart(7)}`);
}
await b.close();
