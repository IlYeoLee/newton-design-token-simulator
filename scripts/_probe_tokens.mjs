import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1900, height: 1200 });
const bad = [];
p.on('requestfailed', r => bad.push('FAIL ' + r.url()));
p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
p.on('pageerror', e => bad.push('PAGEERROR ' + (e.stack || e.message).split('\n').slice(0,3).join(' | ')));
await p.goto('http://127.0.0.1:5201/tokens.html?uiscale=0.34', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
const rows = await p.evaluate(() => [...document.querySelectorAll('.cell')].map(c => {
  const cv = c.querySelector('canvas');
  const g = cv.getContext('2d');
  const d = g.getImageData(0, 0, cv.width, Math.min(cv.height, Math.round(cv.height * 0.56))).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 12) n++;
  return { id: c.querySelector('b').textContent, note: c.querySelector('i').textContent,
           ink: +(n / (d.length / 4) * 100).toFixed(2), bad: c.classList.contains('bad') };
}));
console.log('id'.padEnd(10), 'ink%'.padStart(7), ' 상태');
for (const r of rows) console.log(r.id.padEnd(10), String(r.ink).padStart(7), ' ', r.bad ? '⚠ ' + r.note : (r.ink < 0.05 ? '빈 화면' : ''));
console.log('\n' + (bad.length ? [...new Set(bad)].slice(0,8).join('\n') : '요청 오류 없음'));
await b.close();
