// 조립 후 재계측 — 봇 발 실이동 + **마크와 봇의 같은-시계 동기**(발 x 를 stepVidT 축에서 비교).
import puppeteer from 'puppeteer';
const IDS = ['BK_T1','BK_B2','BK_B3','BK_B4','BK_C2'];
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
await p.evaluate(async()=>{ window.__sess = await import('/src/session.js'); });
console.log('장면      클립          발L이동  발R이동  동기상관(봇발x↔가이드u)');
for (const id of IDS) {
  await p.evaluate((id)=>{
    const s = window.__dbg.session;
    const i = s.stages.findIndex(x=>x.id===id); if(i>=0){ s.stageIdx=i; s.t=0; s._enter(); }
    clearInterval(window.__pin);
    window.__pin = setInterval(()=>{ s._followLatch = true; s._aWatchEnd = 0; }, 50);
    window.__mo = [];
    clearInterval(window.__moT);
    window.__moT = setInterval(()=>{
      const X = window.__dbg.xbot, S = window.__dbg.session, pr = X.getProbes?.();
      if (!pr?.footL) return;
      const P = window.__sess.sbPoseAt(S.stepVidT ?? 0, false);
      window.__mo.push({ clip: X._demoKey, vt: S.stepVidT ?? 0,
        bL: pr.footL.x - pr.hips.x, bR: pr.footR.x - pr.hips.x,
        gL: P.L.u, gR: P.R.u,
        fLx: pr.footL.x, fLz: pr.footL.z, fRx: pr.footR.x, fRz: pr.footR.z });
    }, 50);
  }, id);
  await new Promise(r=>setTimeout(r,7000));
  const r = await p.evaluate(()=>{
    clearInterval(window.__moT);
    const m = window.__mo||[]; if (!m.length) return null;
    const span=(g)=>{let lo=1e9,hi=-1e9;for(const s of m){const v=g(s);lo=Math.min(lo,v);hi=Math.max(hi,v);}return hi-lo;};
    const corr=(a,b2)=>{const n=a.length,ma=a.reduce((x,y)=>x+y,0)/n,mb=b2.reduce((x,y)=>x+y,0)/n;
      let sa=0,sb=0,sc=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b2[i]-mb;sa+=x*x;sb+=y*y;sc+=x*y;}
      return sc/Math.max(1e-9,Math.sqrt(sa*sb));};
    const cL=corr(m.map(s=>s.bL),m.map(s=>s.gL)), cR=corr(m.map(s=>s.bR),m.map(s=>s.gR));
    const cLM=corr(m.map(s=>-s.bR),m.map(s=>s.gL)), cRM=corr(m.map(s=>-s.bL),m.map(s=>s.gR));
    return { clip:m[m.length-1].clip,
      L:+Math.hypot(span(s=>s.fLx),span(s=>s.fLz)).toFixed(3),
      R:+Math.hypot(span(s=>s.fRx),span(s=>s.fRz)).toFixed(3),
      c:+((cL+cR)/2).toFixed(3), cM:+((cLM+cRM)/2).toFixed(3) };
  });
  if (r) console.log(`${(await p.evaluate(()=>window.__dbg.session.stage)).padEnd(10)}${String(r.clip).padEnd(14)}${String(r.L).padStart(7)}${String(r.R).padStart(9)}    정 ${r.c} / 미러 ${r.cM}`);
}
await b.close();
