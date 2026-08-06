import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false);
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await p.goto('http://localhost:5199/?scene=BK_B4&cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,10000));
const r = await p.evaluate(async () => {
  const g=[];
  for(let i=0;i<45;i++){
    let mx=0; window.__scene?.traverse(o=>{ if(o._gain!=null && o.visible) mx=Math.max(mx,o._gain); });
    g.push(+mx.toFixed(2)); await new Promise(r=>setTimeout(r,110));
  }
  return g.join(' ');
});
console.log('화살표 최대밝기:', r);
console.log('errors:', errs.slice(0,2));
await b.close();
