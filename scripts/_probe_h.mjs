import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('http://127.0.0.1:5210/tokens.html?uiscale=0.5',{waitUntil:'networkidle0',timeout:40000});
await new Promise(r=>setTimeout(r,2500));
console.log(await p.evaluate(()=>{
  document.querySelector('#play').click();
  const out=['스테이지     진입 h   늦은 h   링'];
  for(const c of window.__cells){
    const H=T=>{c.gl.resetAnim();for(let s=0;s<T;s+=1/30){c.gl.t=s;c.gl._sig=null;c.gl._lastPaint=-1;if(window.__feed)window.__feed(c,s);try{c.gl.update(1/30);}catch{}}
      const B=c.gl._boxes||[];const pill=B.find(v=>v.k==='pill');return pill?Math.round(pill.h):0;};
    const e=H(1.0), l=H(7.5);
    if(!e && !l) continue;
    out.push('  '+c.st.id.padEnd(11)+String(e).padStart(6)+String(l).padStart(9));
  }
  return out.join('\n');
}));
await b.close();
