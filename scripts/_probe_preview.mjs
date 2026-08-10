// 관찰(PREVIEW) 구간에서 봇이 실제로 움직이는가 — 클립·발 이동량·플래그를 초 단위로 찍는다.
import puppeteer from 'puppeteer';
const ID = process.argv[2] || 'BK_B2';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:1000,height:800});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
await p.evaluate(()=>{ document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ window.__dbg.session.start('basketball'); });
await new Promise(r=>setTimeout(r,1500));
await p.evaluate((id)=>{
  const s = window.__dbg.session;
  const i = s.stages.findIndex(x=>x.id===id); if(i>=0){ s.stageIdx=i; s.t=0; s._enter(); }
  s._followLatch = false;
  window.__mo = [];
  clearInterval(window.__moT);
  window.__moT = setInterval(()=>{
    const X = window.__dbg.xbot, S = window.__dbg.session, pr = X.getProbes?.();
    if (!pr?.footL) return;
    window.__mo.push({ ms: performance.now(), clip: X._demoKey, demo: !!S.demoActive, latch: !!S._followLatch,
      pv: S._pvLoops, vt: +(S.stepVidT ?? 0).toFixed(2),
      fLx: pr.footL.x, fLz: pr.footL.z, fRx: pr.footR.x, fRz: pr.footR.z, hy: pr.hips.y });
  }, 100);
}, ID);
await new Promise(r=>setTimeout(r,16000));
const rows = await p.evaluate(()=>{ clearInterval(window.__moT); return window.__mo||[]; });
await b.close();
if (!rows.length) { console.log('샘플 0'); process.exit(1); }
const t0 = rows[0].ms;
// 1초 버킷으로 접어서: 그 초 동안 발이 얼마나 움직였나
const buck = new Map();
for (const r of rows) { const k = Math.floor((r.ms-t0)/1000); (buck.get(k) || buck.set(k,[]).get(k)).push(r); }
console.log(`${ID}  초  클립          demoActive latch pv  vt    발L이동  발R이동`);
for (const [k, g] of buck) {
  const sp = f => { let lo=1e9,hi=-1e9; for(const r of g){ lo=Math.min(lo,f(r)); hi=Math.max(hi,f(r)); } return hi-lo; };
  const mL = Math.hypot(sp(r=>r.fLx), sp(r=>r.fLz)), mR = Math.hypot(sp(r=>r.fRx), sp(r=>r.fRz));
  const l = g[g.length-1];
  console.log(`     ${String(k).padStart(3)}  ${String(l.clip).padEnd(14)}${String(l.demo).padEnd(11)}${String(l.latch).padEnd(6)}${String(l.pv).padEnd(4)}${String(l.vt).padEnd(6)}${mL.toFixed(3).padStart(7)}${mR.toFixed(3).padStart(9)}`);
}
