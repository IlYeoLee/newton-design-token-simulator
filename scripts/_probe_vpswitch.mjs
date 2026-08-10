// 스텝백 시점 자동 전환 — 관찰=3인칭 / 따라하기=1인칭 이 실제로 갈리는가 + 글라이드가 도착하는가.
//   fpMode 는 안 노출돼 있어 btn-view 라벨로 읽는다('3인칭 보기' = 지금 1인칭).
import puppeteer from 'puppeteer';
const ID = process.argv[2] || 'BK_T1';
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
    const S = window.__dbg.session, c = window.__cam;
    window.__mo.push({ ms: performance.now(), demo: !!S.demoActive, latch: !!S._followLatch,
      fp: /3인칭/.test(document.getElementById('btn-view')?.textContent||''),
      x:+c.position.x.toFixed(2), y:+c.position.y.toFixed(2), z:+c.position.z.toFixed(2), fov:+c.fov.toFixed(1) });
  }, 100);
}, ID);
await new Promise(r=>setTimeout(r,14000));
const rows = await p.evaluate(()=>{ clearInterval(window.__moT); return window.__mo||[]; });
await b.close();
const t0 = rows[0]?.ms ?? 0;
console.log(`${ID}   t     demo   latch  1인칭  cam(x,y,z)              fov`);
let prev = null;
for (const r of rows) {
  const key = `${r.demo}|${r.latch}|${r.fp}`;
  const near = prev && Math.hypot(r.x-prev.x, r.y-prev.y, r.z-prev.z) < 0.01 && Math.abs(r.fov-prev.fov) < 0.05;
  if (key !== (prev?key:null) || !near) {   // 상태가 바뀌었거나 카메라가 움직이는 구간만 찍는다
    console.log(`   ${((r.ms-t0)/1000).toFixed(1).padStart(5)}  ${String(r.demo).padEnd(7)}${String(r.latch).padEnd(7)}${String(r.fp).padEnd(7)}${`${r.x}, ${r.y}, ${r.z}`.padEnd(24)}${r.fov}`);
  }
  prev = r; prev.key = key;
}
