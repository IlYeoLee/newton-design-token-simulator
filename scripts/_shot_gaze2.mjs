// 잘림의 정체 — 코치 판을 계속 켜 두고 토큰을 판 한복판에 크게 박아 본다.
//   ① 온전한 원이면 = 잘림은 판 밖(가림·경계)  ② 그대로 잘리면 = 셰이더/좌표
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:1280,height:900});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
await p.evaluate(()=>{ document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ window.__dbg.session.start('basketball'); });
await new Promise(r=>setTimeout(r,1500));
await p.evaluate(()=>{ const s=window.__dbg.session; const i=s.stages.findIndex(x=>x.id==='BK_T1'); if(i>=0){s.stageIdx=i;s.t=0;s._enter();} });
// 관찰 중(코치 판이 켜진 동안)에 판 참조를 잡는다
await p.waitForFunction(()=>{ let f=false; window.__scene.traverse(o=>{ if(o.material?.uniforms?.uGaze && o.visible) f=true; }); return f; }, { timeout:30000 });
await p.evaluate(()=>{
  let co=null; window.__scene.traverse(o=>{ if(o.material?.uniforms?.uGaze && o.visible) co=o; });
  clearInterval(window.__pin);
  window.__pin = setInterval(()=>{ co.visible = true; co.material.uniforms.uGaze.value.set(0.5, 0.5, 0.20, 0.20); }, 16);
  window.__coPos = () => { const v = co.position.clone().project(window.__cam);
    return { sx: Math.round((v.x*0.5+0.5)*1280), sy: Math.round((-v.y*0.5+0.5)*900) }; };
});
await new Promise(r=>setTimeout(r,2500));
const at = await p.evaluate(()=>window.__coPos());
console.log('판 중심 화면좌표', at);
await p.screenshot({ path: 'scratch_gaze2.png' });
await b.close();
