import puppeteer from 'puppeteer';
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
await p.evaluate(()=>{
  const s = window.__dbg.session;
  const i = s.stages.findIndex(x=>x.id==='BK_T1'); if(i>=0){ s.stageIdx=i; s.t=0; s._enter(); }
  window.__gz=[];
  clearInterval(window.__gt);
  window.__gt=setInterval(()=>{
    let co=null; window.__scene.traverse(o=>{ if(o.material?.uniforms?.uGaze && o.visible) co=o; });
    if(!co) return;
    const g=co.material.uniforms.uGaze.value, e=co.material.uniforms.uHotE.value;
    window.__gz.push({vt:+(window.__dbg.session.stepVidT??0).toFixed(2),
      gx:+g.x.toFixed(3), gy:+g.y.toFixed(3), grx:+g.z.toFixed(4), gry:+g.w.toFixed(4),
      pw:co.geometry.parameters.width, ph:co.geometry.parameters.height, vis:co.visible});
  },100);
});
await new Promise(r=>setTimeout(r,9000));
const rows = await p.evaluate(()=>{clearInterval(window.__gt); return window.__gz;});
await b.close();
const on = rows.filter(r=>r.grx>0);
console.log('샘플', rows.length, '토큰켜짐', on.length, '판', rows[0]?.pw, 'x', rows[0]?.ph);
const seen=new Set();
for(const r of on){ const k=`${r.gx},${r.gy}`; if(seen.has(k))continue; seen.add(k);
  console.log(`vt ${r.vt}  중심(${r.gx}, ${r.gy})  반경(${r.grx}, ${r.gry})  → uv범위 x[${(r.gx-r.grx).toFixed(3)}, ${(r.gx+r.grx).toFixed(3)}] y[${(r.gy-r.gry).toFixed(3)}, ${(r.gy+r.gry).toFixed(3)}]`); }
