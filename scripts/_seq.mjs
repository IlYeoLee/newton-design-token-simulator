import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false);
await p.goto('http://localhost:5199/?scene=A2&cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,7000));
console.log(await p.evaluate(async () => {
  for (let i=0;i<200 && !window.__fgl;i++) await new Promise(r=>setTimeout(r,100));
  const f=window.__fgl, s=window.__sess, out=[]; let last=null;
  for(let i=0;i<900;i++){
    const r=f._numLast2, c=s?.a2Cyc;
    if(r!==last){ out.push(`t${f.t.toFixed(1)} "${r}"${c?.watching?'(관찰)':c?.inHold?'(홀드)':''}`); last=r; }
    if(f.t>16) break;
    await new Promise(r=>setTimeout(r,40));
  }
  return JSON.stringify({dbg:!!window.__dbg, seq:out});
}));
await b.close();
