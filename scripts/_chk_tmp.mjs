import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for (const sc of ['READY','BK_READY']) {
  const p = await b.newPage(); const errs=[], net=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  p.on('response',r=>{ if(/card\.mp4/.test(r.url())) net.push(r.status()); });
  await p.goto('http://localhost:5199/?scene='+sc,{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,11000));
  const v = await p.evaluate(()=>[...document.querySelectorAll('video')]
    .filter(x=>/card\.mp4/.test(x.src)).map(x=>({f:x.src.split('/').pop(),rs:x.readyState,w:x.videoWidth,h:x.videoHeight})));
  console.log(sc,'http:',net.slice(0,2),'video:',JSON.stringify(v),'errors:',errs.slice(0,2));
  await p.close();
}
await b.close();
