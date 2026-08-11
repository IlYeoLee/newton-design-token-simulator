// READY 시작화면 2D 캔버스 캡처 — 글로우 SVG 가 로드된 뒤 다시 그린다(shot_ui.mjs 는 1회 페인트라 광이 빈다)
import puppeteer from 'puppeteer';
const [kind = 'ready', out = 'ready.png', tv = '3.2'] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
const FINAL = process.argv.includes('--final');   // ⑨ 최종확정 안(READY_OPT.final)으로 캡처
await p.evaluate(async (kind, T, FINAL) => {
  const wall = kind === 'wall';   // 복싱 벽 시작화면(ready-view/index.html)
  const M = await import((wall ? '/src/wallgl.js?v=' : '/src/floorgl.js?v=') + Date.now());
  if (FINAL && M.READY_OPT) M.READY_OPT.final = true;
  const G = wall ? new M.WallGL() : new M.FloorGL();
  G.load('READY', { src: wall ? 'ready-view/index.html' : kind === 'ready' ? 'floor.html' : `floor-${kind}.html`, dur: 11, pv: 3 });
  G.t = T;
  await Promise.all(['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'].map(f => document.fonts.load(f).catch(() => {})));
  await document.fonts.ready;
  G._paint();                       // 1차 — 이미지 로드 트리거
  window.__G = G;
  const c = G.canvas;
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, background: '#14171d',
    width: c.width + 'px', height: c.height + 'px' });   // 대지 원치수(1600×2670)로 저장
  c.id = '__shot';
  document.body.appendChild(c);
}, kind, +tv, FINAL);
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => { window.__G._sig = null; window.__G._lastPaint = -1; window.__G._paint(); });
await new Promise(r => setTimeout(r, 300));
await (await p.$('#__shot')).screenshot({ path: out });
console.log('saved', out);
await b.close();
