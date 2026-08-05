import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('http://127.0.0.1:5202/tokens.html?uiscale=1.0',{waitUntil:'networkidle0',timeout:40000});
await new Promise(r=>setTimeout(r,2000));
console.log(await p.evaluate(()=>{
  const T=window.__TOK;
  const c=window.__cells.find(x=>x.st.id==='P1');
  c.gl.resetAnim(); for(let s=0;s<4.6;s+=1/30){c.gl.t=s;c.gl._sig=null;c.gl._lastPaint=-1;try{c.gl.update(1/30);}catch{}}
  return JSON.stringify({ember:T.ember,bgGlow:T.bgGlow,fsTimer:T.fsTimer,ring:T.ring,
    P1_rem:c.gl._numLast2, P1_numT2:+c.gl._numT2?.toFixed(2), t:+c.gl.t.toFixed(2)});
}));
await b.close();
