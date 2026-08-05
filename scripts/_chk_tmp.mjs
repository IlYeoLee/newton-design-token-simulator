import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for (const sc of ['READY','BK_READY']) {
  const p = await b.newPage();
  await p.goto('http://localhost:5199/?scene='+sc,{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,11000));
  const r = await p.evaluate(()=>{
    const pb=window.__dbg.xbot.getProbes?.()||{};
    const k=Object.keys(pb);
    const o={}; for(const n of k){ const v=pb[n]; if(v&&typeof v.x==='number') o[n]=[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)]; }
    return o;
  });
  console.log(sc, JSON.stringify(r));
  await p.close();
}
await b.close();
