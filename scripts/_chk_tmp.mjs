import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
await p.goto('http://localhost:5199/?scene=A2',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,10000));
await p.evaluate(()=>{ window.__r=[]; const s=window.__dbg.session;
  window.__id=setInterval(()=>{ const P=s.a2press; if(!P?.arBack) return;
    window.__r.push([+s.t.toFixed(2), P.arBack.visible?1:0,
      +(P.arBack._mesh?.material.opacity??-1).toFixed(3),
      +(P.arKnee._mesh?.material.opacity??-1).toFixed(3),
      +(P.arBack.userData.prog??-1).toFixed(2)]);
  },120); });
await new Promise(r=>setTimeout(r,22000));
const v=await p.evaluate(()=>{clearInterval(window.__id);return window.__r;});
const on=v.filter(x=>x[1]===1);
console.log('vis',on.length,'/',v.length);
if(on.length){ const ops=on.map(x=>x[2]);
  console.log('arBack opacity', Math.min(...ops).toFixed(3),'~',Math.max(...ops).toFixed(3));
  console.log('head',JSON.stringify(on.slice(0,5))); }
console.log('errors:',errs.slice(0,2));
await b.close();
