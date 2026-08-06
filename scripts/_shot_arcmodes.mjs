// 아크 라벨 배치 3안을 한 장으로 — head(머리·접선) / mid(중앙·접선) / flat(머리·수평)
//   node scripts/_shot_arcmodes.mjs <ready|bk> <out.png> [t]
import puppeteer from 'puppeteer';
const [kind = 'ready', out = 'arcmodes.png', tv = '3.9'] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.setViewport({ width: 1500, height: 700 });
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await p.evaluate(async (kind, T) => {
  const M = await import('/src/floorgl.js?v=' + Date.now());
  window.__M = M;
  await Promise.all(['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'].map(f => document.fonts.load(f).catch(() => {})));
  await document.fonts.ready;
  const wrap = document.createElement('div');
  wrap.id = 'wrap';
  Object.assign(wrap.style, { position: 'fixed', left: 0, top: 0, display: 'flex', gap: '10px', background: '#14171d', padding: '10px', zIndex: 99999 });
  document.body.appendChild(wrap);
  window.__G = [];
  for (const mode of ['head', 'mid', 'flat']) {
    const G = new M.FloorGL();
    G.load('READY', { src: kind === 'ready' ? 'floor.html' : `floor-${kind}.html`, dur: 11, pv: 3 });
    G.t = T;
    const box = document.createElement('div');
    const cap = document.createElement('div');
    cap.textContent = mode; Object.assign(cap.style, { color: '#fff', font: '600 14px system-ui', padding: '2px 4px' });
    box.appendChild(cap); box.appendChild(G.canvas);
    Object.assign(G.canvas.style, { width: '460px', height: 'auto', display: 'block' });
    wrap.appendChild(box);
    window.__G.push({ G, mode });
  }
}, kind, +tv);
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => {
  for (const { G, mode } of window.__G) {
    window.__M.READY_OPT.arcLabelMode = mode;
    G._sig = null; G._lastPaint = -1; G._paint();
  }
});
await new Promise(r => setTimeout(r, 400));
await (await p.$('#wrap')).screenshot({ path: out });
console.log('saved', out);
await b.close();
