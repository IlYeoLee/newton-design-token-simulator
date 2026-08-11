// 각인 크기·위치 후보를 확대 뷰로 나란히 굽는다 — node scripts/_shot_footcmp.mjs <out디렉토리>
import puppeteer from 'puppeteer';
import path from 'path';
const OUT = process.argv[2] || '.';
const CAND = [['old', 0.85, -0.054, -0.031], ['new', 0.93, -0.03, -0.030]];
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.setViewport({ width: 1600, height: 1100 });
await p.goto('http://127.0.0.1:5199/footlab.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4500));
for (const [tag, s, ox, oy] of CAND) {
  await p.evaluate(async (s, ox, oy) => {
    const P = window.__flab.P;
    P.scale = s; P.offx = ox; P.offy = oy;
    document.getElementById('scale').dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 1200));
  }, s, ox, oy);
  await new Promise(r => setTimeout(r, 1200));
  const el = await p.$('#hero') || await p.$('canvas');
  await el.screenshot({ path: path.join(OUT, `foot_${tag}.png`) });
  console.log('saved', tag, s, ox, oy);
}
await b.close();
