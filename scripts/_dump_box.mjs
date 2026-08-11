import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('http://127.0.0.1:5210/tokens.html?uiscale=0.5',{waitUntil:'networkidle0',timeout:40000});
await new Promise(r=>setTimeout(r,2500));
console.log(await p.evaluate(()=>{
  document.querySelector('#play').click();
  const c=window.__cells.find(x=>x.st.id==='P1');
  const out=[];
  c.gl.resetAnim();
  for(let s=0;s<1.2;s+=1/30){
    c.gl.t=s; c.gl._sig=null; c.gl._lastPaint=-1;
    if(window.__feed)window.__feed(c,s);
    try{c.gl.update(1/30);}catch(e){out.push('ERR '+e.message);}
    if(Math.abs(s-0.0)<0.02||Math.abs(s-0.35)<0.02||Math.abs(s-0.9)<0.02){
      const B=c.gl._boxes||[];
      const pill=B.find(v=>v.k==='pill'), inn=B.find(v=>v.k==='inner');
      const title=c.gl.map.get('s-title')?.textContent;
      out.push(`t=${s.toFixed(2)} title="${title}" pill=${pill?Math.round(pill.x)+'w'+Math.round(pill.w):'-'} inner=${inn?Math.round(inn.x)+'w'+Math.round(inn.w):'-'} headW=${Math.round(c.gl._headW||0)}`);
    }
  }
  return out.join('\n');
}));
await b.close();
