// 토큰이 잘리는가 — 실제 화면을 찍는다. 1인칭·정지 프레임에서 토큰 주변만 크롭.
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
// 토큰이 제일 클 때(도착 직후)를 노린다 — 켜짐 프레임에서 찍는다
for (let i=0;i<40;i++){
  await new Promise(r=>setTimeout(r,250));
  const r = await p.evaluate(()=>{ let co=null; window.__scene.traverse(o=>{ if(o.material?.uniforms?.uGaze && o.visible) co=o; });
    return co ? { z: co.material.uniforms.uGaze.value.z, w: co.material.uniforms.uGaze.value.w } : null; });
  if (r && r.z > 0.03) break;
}
await p.screenshot({ path: 'scratch_gaze.png' });
await b.close();
console.log('찍음 scratch_gaze.png');
