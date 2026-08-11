// 내 합성 텍스처를 피그마 원본과 같은 지표로 잰다 — 도트 피치 · 테두리:안쪽 휘도
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
console.log(await p.evaluate(async () => {
  const M = await import('/src/floorgl.js?v=' + Date.now());
  const G = new M.FloorGL();
  G.load('READY', { src: 'floor.html', dur: 11, pv: 3 });
  await new Promise(r => setTimeout(r, 2500));
  G.t = 5; G._sig = null; G._lastPaint = -1; G._paint();
  await new Promise(r => setTimeout(r, 1200));
  G._sig = null; G._lastPaint = -1; G._paint();
  G.canvas.width = 1600; G._footTex = null;
  const tex = G._readyFootTex();   // K=1 → 95px, 피그마 원본과 같은 자
  if (!tex) return 'no tex';
  // 피그마 원본 크기(95×229)로 되돌려 같은 자로 잰다
  const c = document.createElement('canvas'); c.width = 95; c.height = 229;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 95, 229);
  g.drawImage(tex, 0, 0);
  const d = g.getImageData(0, 0, 95, 229).data;
  const L = (x, y) => { const k = (y * 95 + x) * 4; return d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114; };
  const scan = y => { const pk = []; for (let x = 2; x < 93; x++) { const v = L(x, y); if (v > 40 && v >= L(x - 1, y) && v > L(x + 1, y)) pk.push(x); } return pk; };
  const rim = [], core = []; const rows = {};
  for (const y of [70, 190]) { const pk = scan(y); const gaps = pk.slice(1).map((v, i) => v - pk[i]).filter(x => x > 1).sort((a, b2) => a - b2);
    rows[y] = { n: pk.length, median: gaps[Math.floor(gaps.length / 2)] }; }
  for (const y of [90, 120, 150]) { const pk = scan(y); if (pk.length < 6) continue;
    rim.push(L(pk[0], y), L(pk[1], y), L(pk[pk.length - 1], y), L(pk[pk.length - 2], y));
    const m = Math.floor(pk.length / 2); core.push(L(pk[m], y), L(pk[m - 1], y)); }
  const avg = a => Math.round(a.reduce((s, v) => s + v, 0) / (a.length || 1));
  return JSON.stringify({ texSize: [tex.width, tex.height], rows, rimLum: avg(rim), coreLum: avg(core) });
}));
await b.close();
