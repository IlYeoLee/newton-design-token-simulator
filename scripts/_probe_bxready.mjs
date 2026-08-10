// 복싱 시작화면 시점 왕복 — 3초마다 1인칭↔3인칭, 글라이드가 도착하는가.
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:1000,height:800});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
await p.evaluate(()=>{ document.querySelector('[data-pack=boxing]')?.click(); });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ window.__dbg.session.start('boxing'); });
await p.evaluate(()=>{
  window.__mo=[]; clearInterval(window.__t);
  window.__t=setInterval(()=>{ const S=window.__dbg.session, c=window.__cam;
    window.__mo.push({ t:+S.t.toFixed(1), id:S.stage,
      fp:/3인칭/.test(document.getElementById('btn-view')?.textContent||''),
      x:+c.position.x.toFixed(2), y:+c.position.y.toFixed(2), z:+c.position.z.toFixed(2), fov:+c.fov.toFixed(1) }); },100);
});
await new Promise(r=>setTimeout(r,13000));
const rows = await p.evaluate(()=>{clearInterval(window.__t); return window.__mo;});
await b.close();
console.log('  세션t  스테이지     1인칭  cam(x,y,z)             fov');
let prev=null;
for(const r of rows){ const moved = !prev || Math.hypot(r.x-prev.x,r.y-prev.y,r.z-prev.z)>0.02 || r.fp!==prev.fp;
  if(moved) console.log(`  ${String(r.t).padStart(5)}  ${r.id.padEnd(11)}${String(r.fp).padEnd(7)}${`${r.x}, ${r.y}, ${r.z}`.padEnd(23)}${r.fov}`);
  prev=r; }
