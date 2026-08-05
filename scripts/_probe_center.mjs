import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1900, height: 1200 });
await p.goto('http://127.0.0.1:5202/tokens.html?uiscale=0.34', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));
const rows = await p.evaluate(async () => {
  const K = 0.34, cells = window.__cells;
  // 광을 끄고 정지시켜 잉크만 남긴다 — 배경 광이 전폭에 깔려 측정이 오염된다
  document.querySelector('#play').click();
  window.__TOK.ember = 0; window.__TOK.bgGlow = 0;
  for (const c of cells) { c.gl._sig = null; c.gl._lastPaint = -1; try { c.gl.update(0); } catch {} }
  await new Promise(r => setTimeout(r, 200));
  return cells.map(c => {
    const gl = c.gl, box = (gl._boxes || []).find(x => x.k === 'pill');
    if (!box) return null;
    const cv = gl.canvas, g = cv.getContext('2d');
    const y0 = Math.round((box.y + box.h * 0.30) * K), hh = Math.max(2, Math.round(box.h * 0.40 * K));
    const d = g.getImageData(0, y0, cv.width, hh).data;
    let L = 1e9, R = -1;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 150) { const xx = (i / 4) % cv.width; if (xx < L) L = xx; if (xx > R) R = xx; }
    }
    const pl = box.x * K, pr = (box.x + box.w) * K;
    return { id: c.st.id, w: Math.round(box.w),
      left: Math.round((L - pl) / K), right: Math.round((pr - R) / K) };
  }).filter(Boolean);
});
console.log('스테이지     알약폭   좌여백  우여백   차이');
for (const r of rows) {
  const d = r.right - r.left;
  console.log(r.id.padEnd(11), String(r.w).padStart(6), String(r.left).padStart(8), String(r.right).padStart(7),
    String(d).padStart(7), Math.abs(d) > 20 ? '  ← 비대칭' : '  ok');
}
await b.close();
