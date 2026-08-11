// 'Tap your foot Twice' 를 그리는 순간의 gco/filter/alpha 를 실측
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://127.0.0.1:5300/', { waitUntil: 'networkidle2', timeout: 60000 });
console.log(await p.evaluate(async () => {
  const M = await import('/src/floorgl.js?v=' + Date.now());
  const out = [];
  for (const src of ['floor.html', 'floor-bk.html']) {
    const G = new M.FloorGL();
    G.load('READY', { src, dur: 11, pv: 3 });
    await new Promise(r => setTimeout(r, 1500));
    const ctx = G.ctx, orig = ctx.fillText.bind(ctx);
    ctx.fillText = function (t, x, y) {
      if (/^(Tap|your|foot|Twice)$/.test(String(t)))
        out.push({ src, t, gco: ctx.globalCompositeOperation, filter: ctx.filter, a: +ctx.globalAlpha.toFixed(3), fill: ctx.fillStyle });
      return orig(t, x, y);
    };
    G.t = 5; G._sig = null; G._lastPaint = -1; G._paint();
    ctx.fillText = orig;
  }
  return JSON.stringify(out, null, 1);
}));
await b.close();
