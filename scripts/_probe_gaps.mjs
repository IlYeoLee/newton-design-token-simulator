// 2안 세로 간격 감사 — 흰 활자/그래픽만 골라(저채도·고휘도) 잉크 띠를 찾고 사이 간격을 잰다.
// 광(붉은 면)은 채도가 높아 걸러진다. 좌표가 아니라 **그려진 픽셀**을 재는 게 요점.
import puppeteer from 'puppeteer';
const NDY = +(process.argv[2] ?? 80);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://127.0.0.1:5300/', { waitUntil: 'networkidle2', timeout: 60000 });
console.log(await p.evaluate(async () => {
  const M = await import('/src/floorgl.js?v=' + Date.now());
  const G = new M.FloorGL();
  G.load('READY', { src: 'floor.html', dur: 11, pv: 3 });
  await Promise.all(['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'].map(f => document.fonts.load(f).catch(() => {})));
  G.t = 5; G._paint();
  await new Promise(r => setTimeout(r, 2500));
  G._sig = null; G._lastPaint = -1; G._paint();
  const cv = G.canvas, K = cv.width / 1600;
  const g = cv.getContext('2d');
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const rows = new Array(cv.height).fill(0);
  for (let y = 0; y < cv.height; y++) {
    let n = 0;
    for (let x = 0; x < cv.width; x++) {
      const k = (y * cv.width + x) * 4, a = d[k + 3];
      if (a < 120) continue;
      const r = d[k], gg = d[k + 1], bb = d[k + 2];
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (mx > 150 && mx - mn < 45) n++;      // 흰 계열 활자만
    }
    rows[y] = n;
  }
  // 잉크 띠 = 연속 구간(가로 8px 이상). 사이 5px 미만 틈은 같은 띠로 붙인다.
  const bands = [];
  let s = -1;
  for (let y = 0; y <= cv.height; y++) {
    const on = rows[y] > 8;
    if (on && s < 0) s = y;
    if (!on && s >= 0) {
      const b0 = s / K, b1 = (y - 1) / K;
      const last = bands[bands.length - 1];
      if (last && b0 - last[1] < 6) last[1] = b1; else bands.push([b0, b1]);
      s = -1;
    }
  }
  const out = bands.filter(([a, z]) => z - a > 6)
    .map(([a, z]) => ({ y0: +a.toFixed(0), y1: +z.toFixed(0), h: +(z - a).toFixed(0) }));
  for (let i = 1; i < out.length; i++) out[i].gapAbove = +(out[i].y0 - out[i - 1].y1).toFixed(0);
  return JSON.stringify({ canvas: [cv.width, cv.height], K: +K.toFixed(2), bands: out }, null, 1);
}));
await b.close();
