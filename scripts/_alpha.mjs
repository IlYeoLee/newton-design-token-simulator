import puppeteer from 'puppeteer';
const D='/private/tmp/claude-501/-Users-iil-yeo/470bab8d-790a-4a73-a1f4-7b8eaed4ec18/scratchpad';
const b = await puppeteer.launch({protocolTimeout:150000, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false); await p.setViewport({width:1000,height:1000});
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await p.goto('http://localhost:5199/matcast.html?bg=none&size=900&cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,4500));
const r = await p.evaluate(() => {
  const cv=document.getElementById('cv'), g=cv.getContext('2d');
  const N=cv.width, d=g.getImageData(0,0,N,N).data;
  let a0=0, aFull=0, aMid=0, sum=0, minA=255, maxA=0;
  // 모서리 16x16 = 배경이어야 한다
  let cornerMax=0;
  for(let y=0;y<16;y++) for(let x=0;x<16;x++) cornerMax=Math.max(cornerMax, d[(y*N+x)*4+3]);
  for(let i=0;i<d.length;i+=4){ const a=d[i+3];
    if(a===0) a0++; else if(a===255) aFull++; else aMid++;
    sum+=a; if(a<minA)minA=a; if(a>maxA)maxA=a; }
  const tot=d.length/4;
  return { 캔버스:N+'x'+N, 완전투명:+(a0/tot*100).toFixed(1)+'%',
    반투명:+(aMid/tot*100).toFixed(1)+'%', 불투명:+(aFull/tot*100).toFixed(1)+'%',
    모서리최대알파:cornerMax, 평균알파:+(sum/tot).toFixed(1) };
});
console.log(JSON.stringify(r), '| err:', errs.slice(0,1));
// 투명 PNG 로 저장 — 그대로 AE 로 넣어볼 수 있게
const buf = await p.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
const fs = await import('fs');
fs.writeFileSync(D+'/mat-alpha.png', Buffer.from(buf.split(',')[1],'base64'));
await b.close();
