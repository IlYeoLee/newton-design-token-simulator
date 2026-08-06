import puppeteer from 'puppeteer';
const D='/private/tmp/claude-501/-Users-iil-yeo/470bab8d-790a-4a73-a1f4-7b8eaed4ec18/scratchpad';
const b = await puppeteer.launch({protocolTimeout:150000, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false); await p.setViewport({width:1300,height:1200});
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.goto('http://localhost:5199/footlab.html?cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,9000));
const r1 = await p.evaluate(() => { const b=document.getElementById('mPlay'); if(!b) return 'no btn'; b.click(); return b.textContent; });
await new Promise(r=>setTimeout(r,2500));
const r2 = await p.evaluate(() => ({ play: window._mPlay, live: window._mLive, per: window._mPer }));
// 재생 중 프레임 두 장 — 달라야 정상
await p.evaluate(() => document.querySelector('#mat')?.scrollIntoView({block:'center'}));
await new Promise(r=>setTimeout(r,400));
await p.screenshot({path:D+'/play1.png'});
console.log('버튼:', r1, '| 상태:', JSON.stringify(r2), '| err:', errs.slice(0,1));
await b.close();
