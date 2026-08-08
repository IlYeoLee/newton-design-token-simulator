import puppeteer from 'puppeteer';
const D='/private/tmp/claude-501/-Users-iil-yeo/470bab8d-790a-4a73-a1f4-7b8eaed4ec18/scratchpad';
const b = await puppeteer.launch({protocolTimeout:150000, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false); await p.setViewport({width:1300,height:1200});
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.goto('http://localhost:5199/footlab.html?cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,9000));
// 가운데(5번)로 지휘를 옮기고 접촉 발생
await p.evaluate(() => { for(let i=0;i<9;i++) document.getElementById('mLive').click(); });
await p.evaluate(() => { const L=window; document.getElementById('mHit').click(); });
await p.evaluate(() => document.querySelector('#mat')?.scrollIntoView({block:'center'}));
await new Promise(r=>setTimeout(r,250));
await p.screenshot({path:D+'/mc3.png'});
console.log('err:', errs.slice(0,1));
await b.close();
