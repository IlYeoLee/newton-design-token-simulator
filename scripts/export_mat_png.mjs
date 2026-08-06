// 합성용 매트 판 내보내기 — 1 px = 1 mm, 알파 투명.
//   node scripts/export_mat_png.mjs  →  public/textures/bk_dribble_mat_D.png
import puppeteer from 'puppeteer';
import fs from 'node:fs';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e.message)));
await p.goto('file:///C:/Users/user/dev/newton-design-token-simulator/docs/bk-b1-dribble-mat-look.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 700));
const url = await p.evaluate(() => window.__matPNG('D'));
if (errs.length) console.log('ERR', errs);
fs.mkdirSync('public/textures', { recursive: true });
fs.writeFileSync('public/textures/bk_dribble_mat_D.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote public/textures/bk_dribble_mat_D.png', (url.length / 1365).toFixed(0) + ' KB');
await b.close();
