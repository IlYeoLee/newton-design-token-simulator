// 아무 페이지나 그대로 스크린샷 — 랩 UI 버그 확인용
//   node scripts/_shot_page.mjs footlab.html out.png [wait ms] [width] [height]
import puppeteer from 'puppeteer';
const [page_ = 'footlab.html', out = 'page.png', wait = '3000', W = '1600', H = '1000'] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
await p.setViewport({ width: +W, height: +H, deviceScaleFactor: 1 });
const URL_ = /^https?:\/\//.test(page_) ? page_ : 'http://127.0.0.1:5199/' + page_;   // 외부 레퍼런스도 찍을 수 있게
await p.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, +wait));
await p.screenshot({ path: out, fullPage: true });
console.log('saved', out);
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await b.close();
