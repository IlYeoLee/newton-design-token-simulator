import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for (const u of ['http://localhost:5199/footlab.html','http://localhost:5199/?scene=A2']) {
  const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,9000));
  const extra = u.includes('footlab') ? await p.evaluate(()=>({ ov:Object.keys(window.__flab.OV),
    btn:!!document.getElementById('saveFloor') })) : null;
  console.log(u, 'errors:', errs.slice(0,2), extra?JSON.stringify(extra):'');
  await p.close();
}
await b.close();
