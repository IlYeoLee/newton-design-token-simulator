// 스테이지 1인칭 스샷 — 타이틀 잘림·겹침 육안 검수용. 인자로 스테이지 나열.
import puppeteer from 'puppeteer';
const IDS = process.argv.slice(2);
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:1000,height:820});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
await p.evaluate(()=>{ document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ window.__dbg.session.start('basketball'); });
await new Promise(r=>setTimeout(r,2000));
for (const id of IDS) {
  await p.evaluate((id)=>{ const s=window.__dbg.session; const i=s.stages.findIndex(x=>x.id===id); if(i>=0){s.stageIdx=i;s.t=0;s._enter();} }, id);
  await new Promise(r=>setTimeout(r,3500));
  await p.screenshot({ path: `scratch_${id}.png`, clip: { x: 300, y: 0, width: 700, height: 820 } });
  console.log('찍음', id);
}
await b.close();
