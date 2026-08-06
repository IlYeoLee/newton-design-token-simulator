// 드리블 매트 토큰 단독 프리뷰 — 룩 랩과 같은 ENV 로 평면 렌더. dev 서버(5199) 필요.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded', timeout: 60000 });
const url = await p.evaluate(async () => {
  const fx = await import('/src/fx-core.js');
  const lut = await import('/src/fxlut.js');
  const W = 1000;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const g = cv.getContext('2d');
  g.fillStyle = '#141414'; g.fillRect(0, 0, W, W);
  const ENV = {
    lut: lut.lutColor,
    arrow: { line: 'solid', w: 1, speed: 1, gap: 1, glow: 1, heat: 0.5, tail: 0.55 },
    num: (gg, ch, x, y, size, fontPx) => {
      gg.font = `700 ${fontPx}px 'OffBit', 'Supreme', sans-serif`;
      gg.fillStyle = 'rgba(255,255,255,0.96)';
      gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillText(String(ch), x, y);
    },
  };
  const P = {
    round: 0.35, bracket: 1, chev: 1, prog: 0.62,
    mat: { nx: 0.50, fx: 0.86, ny: -0.80, fy: 0.80 },
    center: { x: 0, y: 0.00, r: 0.28, label: 'ACTIVE\nTARGET' },
    targets: [
    { x: -0.42, y: 0.36, n: 1, r: 0.19, on: true },
    { x: 0.42, y: 0.36, n: 2, r: 0.19, on: true },
    { x: -0.32, y: -0.48, n: 3, r: 0.19, on: true, live: true },
    { x: 0.32, y: -0.48, n: 4, r: 0.19, on: false },
    ],
    ruler: { w: 1.6, h: 2.2 }, title: 'STEP-BACK DRILL', brand: 'NEWTON',
  };
  const off = document.createElement('canvas'); off.width = off.height = W;
  fx.drawDribbleMat(off.getContext('2d'), W, P, { halo: 1 }, 1.2, ENV);
  g.drawImage(off, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(6px)'; g.globalAlpha = 0.35; g.drawImage(off, 0, 0);
  g.filter = 'blur(20px)'; g.globalAlpha = 0.25; g.drawImage(off, 0, 0);
  g.restore();
  return cv.toDataURL('image/png');
});
if (errs.length) console.log('ERR', errs.slice(0, 3));
fs.writeFileSync('C:/Users/user/AppData/Local/Temp/claude/C--Users-user/e22b4c85-8b4a-4d3b-a8c3-0d5452cb94fa/scratchpad/mat-token.png',
  Buffer.from(url.split(',')[1], 'base64'));
console.log('ok');
await b.close();
