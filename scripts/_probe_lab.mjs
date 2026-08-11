import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
const buf = (await import('fs')).readFileSync(process.argv[2]).toString('base64');
console.log(await p.evaluate(async b64 => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data;
  const L = (x, y) => { const k = (y * im.width + x) * 4; return d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114; };
  // 발 한가운데 가로줄에서 밝기 극대점(도트 중심) 개수와 간격
  const scan = y => { const pk = []; for (let x = 2; x < im.width - 2; x++) { const v = L(x, y); if (v > 40 && v >= L(x - 1, y) && v > L(x + 1, y)) pk.push(x); } return pk; };
  const out = {};
  for (const y of [70, 110, 150, 190]) { const pk = scan(y); const gaps = pk.slice(1).map((v, i) => v - pk[i]).filter(g2 => g2 > 1);
    gaps.sort((a, b2) => a - b2);
    out[y] = { n: pk.length, span: pk.length ? pk[pk.length - 1] - pk[0] : 0, median: gaps[Math.floor(gaps.length / 2)] }; }
  // 가장자리 vs 중심 밝기(이너 글로우 확인) — 같은 줄에서 도트 피크의 평균 휘도
  const rim = [], core = [];
  for (const y of [90, 120, 150]) { const pk = scan(y); if (pk.length < 6) continue;
    rim.push(L(pk[0], y), L(pk[1], y), L(pk[pk.length - 1], y), L(pk[pk.length - 2], y));
    const m = Math.floor(pk.length / 2); core.push(L(pk[m], y), L(pk[m - 1], y)); }
  const avg = a => Math.round(a.reduce((s, v) => s + v, 0) / (a.length || 1));
  return JSON.stringify({ size: [im.width, im.height], rows: out, rimLum: avg(rim), coreLum: avg(core) });
}, buf));
await b.close();
