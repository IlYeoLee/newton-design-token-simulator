// 잘림의 정체 — 유니폼·가시성을 **잠가서**(앱이 못 덮어쓰게) 토큰을 판 한복판에 크게 박는다.
//   판 중앙에서도 잘리면 = 바깥 가림(깊이·다른 면). 온전한 원이면 = 좌표/경계.
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:1100,height:850});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
await p.evaluate(()=>{ document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ window.__dbg.session.start('basketball'); });
await new Promise(r=>setTimeout(r,1500));
await p.evaluate(()=>{ const s=window.__dbg.session; const i=s.stages.findIndex(x=>x.id==='BK_T1'); if(i>=0){s.stageIdx=i;s.t=0;s._enter();} });
await p.waitForFunction(()=>{ let f=false; window.__scene.traverse(o=>{ if(o.material?.uniforms?.uGaze && o.visible) f=true; }); return f; }, { timeout:30000 });
const info = await p.evaluate(()=>{
  const out=[]; const T=window.__dbg.THREE;
  window.__scene.traverse(o=>{ if(!o.material?.uniforms?.uGaze) return;
    const U=o.material.uniforms;
    const V=U.uGaze.value.clone(); V.set(0.5, 0.72, 0.20, 0.20);
    try{ Object.defineProperty(U.uGaze,'value',{get:()=>V,set:()=>{}}); }catch(e){}
    try{ Object.defineProperty(o,'visible',{get:()=>true,set:()=>{}}); }catch(e){}
    const w=new T.Vector3(); o.getWorldPosition(w);
    const s=w.clone().project(window.__cam);
    out.push({ name:o.name||'(무명)', vis:o.visible, pos:[+w.x.toFixed(2),+w.y.toFixed(2),+w.z.toFixed(2)],
      sx:Math.round((s.x*0.5+0.5)*1100), sy:Math.round((-s.y*0.5+0.5)*850),
      geo:[o.geometry?.parameters?.width, o.geometry?.parameters?.height] });
  });
  return out;
});
console.log('판', info);
await new Promise(r=>setTimeout(r,2500));
await p.screenshot({ path: 'scratch_g3.png' });
await b.close();
