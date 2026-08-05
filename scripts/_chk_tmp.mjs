import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
await p.goto('http://localhost:5199/?scene=READY',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,11000));
await p.evaluate(()=>{ window.__b=null; const f=window.__dbg.floorGL, s=window.__dbg.session;
  const cv=f.canvas||f.ctx.canvas,g=cv.getContext('2d'),K=cv.width/1600;
  window.__id=setInterval(()=>{ const tl=(s.t||0)%8; if(tl<1.5||tl>3.5) return;
    const px=(x,y)=>{const d=g.getImageData(Math.round(x*K),Math.round((y-254)*K),1,1).data;
      return `${d[0]},${d[1]},${d[2]}/${d[3]}`;};
    window.__b={tl:+tl.toFixed(1), y500:px(800,500), y800:px(800,800), y1100:px(800,1100),
      y1400:px(800,1400), y1700:px(800,1700), out:px(200,900)};
  },70); });
await new Promise(r=>setTimeout(r,15000));
console.log(JSON.stringify(await p.evaluate(()=>{clearInterval(window.__id);return window.__b;})));
console.log('errors:',errs.slice(0,2));
await b.close();
