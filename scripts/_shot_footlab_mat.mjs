import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.setViewport({ width: 1400, height: 1100, deviceScaleFactor: 1.4 });
await p.goto('http://127.0.0.1:5199/footlab.html', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 4000));
const h = await p.$('#mat');
if (h) { await h.scrollIntoView(); await new Promise(r => setTimeout(r, 500));
  await h.screenshot({ path: 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user/e22b4c85-8b4a-4d3b-a8c3-0d5452cb94fa/scratchpad/footlab-mat.png' }); }
else console.log('#mat not found');
console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
