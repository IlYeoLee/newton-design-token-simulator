import puppeteer from 'puppeteer';
import fs from 'fs';
const OUT = process.env.TMP + '/pills.png';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:5202/tokens.html?uiscale=1.0', { waitUntil: 'networkidle0', timeout: 40000 });
await new Promise(r => setTimeout(r, 2500));
const preset = process.argv[2];
const shots = await p.evaluate(async (preset) => {
  if (preset) document.querySelector('#p-' + preset)?.click();
  document.querySelector('#play').click();               // 정지
  await new Promise(r => setTimeout(r, 300));
  const out = [];
  for (const id of ['A2', 'P1', 'BK_B1', 'BK_B5']) {
    for (const [tag, tt] of [['관찰', 1.5], ['따라하기', 5.0]]) {
      const c = window.__cells.find(x => x.st.id === id); if (!c) continue;
      c.gl.resetAnim(); c.gl.t = 0;
      for (let s = 0; s < tt + 0.23; s += 1 / 30) { c.gl.t = s; c.gl._sig = null; c.gl._lastPaint = -1; try { c.gl.update(1 / 30); } catch {} }
      const cv = c.gl.canvas, g = cv.getContext('2d');
      // 알약 실측 박스 주변만 잘라낸다
      const bx = (c.gl._boxes || []).find(v => v.k === 'pill');
      const X = bx ? Math.max(0, bx.x - 60) : 0, Y = bx ? Math.max(0, bx.y - 120) : 100;
      const W = bx ? Math.min(cv.width - X, bx.w + 120) : 1200, H = bx ? bx.h + 200 : 500;
      const t2 = document.createElement('canvas'); t2.width = W; t2.height = H;
      t2.getContext('2d').drawImage(cv, X, Y, W, H, 0, 0, W, H);
      out.push({ id, tag, w: W, h: H, url: t2.toDataURL() });
    }
  }
  return out;
}, preset);
// 세로로 이어붙인 시트
const html = `<body style="margin:0;background:#3a3a3e;font:11px sans-serif;color:#fff">` +
  shots.map(s => `<div style="padding:4px 8px;background:#111">${s.id} · ${s.tag} · ${s.w}×${s.h}</div><img src="${s.url}" style="display:block">`).join('') + `</body>`;
const p2 = await b.newPage();
await p2.setContent(html);
await p2.setViewport({ width: Math.round(Math.max(...shots.map(s => s.w))) + 20, height: 400 });
await p2.screenshot({ path: OUT, fullPage: true });
console.log(OUT);
await b.close();
