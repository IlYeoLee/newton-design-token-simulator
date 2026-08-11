// 발자국 영역만 크게 — 시뮬과 같은 경로(FloorGL._paint)로 그린 뒤 그 부분만 확대해서 본다
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 500 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await p.evaluate(async () => {
  const M = await import('/src/floorgl.js?v=' + Date.now());
  const G = new M.FloorGL();
  G.load('READY', { src: 'floor.html', dur: 11, pv: 3 });
  await Promise.all(['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'].map(f => document.fonts.load(f).catch(() => {})));
  G.t = 5; G._paint();
  await new Promise(r => setTimeout(r, 2500));
  G._sig = null; G._lastPaint = -1; G._paint();
  const K = G.canvas.width / 1600;
  const out = document.createElement('canvas'); out.width = 840; out.height = 420;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;                 // 확대는 최근접 — 실제 픽셀을 본다
  g.fillStyle = '#0a0c10'; g.fillRect(0, 0, 840, 420);
  g.drawImage(G.canvas, Math.round(470 * K), Math.round(1700 * K), Math.round(280 * K), Math.round(140 * K), 0, 0, 840, 420);
  Object.assign(out.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999 });
  out.id = '__z'; document.body.appendChild(out);
});
await new Promise(r => setTimeout(r, 400));
await (await p.$('#__z')).screenshot({ path: process.argv[2] });
console.log('saved');
await b.close();
