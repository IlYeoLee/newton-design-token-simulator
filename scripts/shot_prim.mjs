// 룩 시스템 프리미티브(fx-core) 진행 시트 — prog 0/.25/.5/.75/1 을 한 줄로 굽는다.
// 토큰이 '진행에 따라 제대로 변하는지'를 눈으로 확인하는 용도(가드 박스 도트 채움, 수축 링 등).
//
//   node scripts/shot_prim.mjs stanceBox tmp_prim.png
//   node scripts/shot_prim.mjs approachRing tmp_ring.png
//
// 사전 조건: `npm run dev` 가 5199 에서 떠 있어야 한다.
import puppeteer from 'puppeteer';

const [kind = 'stanceBox', out = 'tmp_prim.png'] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 320 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 140)));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });

await p.evaluate(async (kind) => {
  const FX = await import('/src/fx-core.js?v=' + Date.now());
  // LUT 는 앱 룩과 무관하게 읽히기만 하면 되므로 단순 램프로 대체(형태 검증용)
  const ENV = {
    lut: v => `rgb(${Math.round(255 * Math.min(1, .35 + v))},${Math.round(90 + 90 * v)},${Math.round(70 + 60 * v)})`,
    arrow: { w: 1, line: 'solid' }, foot: null,
  };
  const P = { w: 1, glow: 1, tempo: 1, dash: 1, round: 0.5, feet: 0, r: 0.42, rt: 0.36, width: 1.4, spread: 1 };
  const fn = { stanceBox: FX.drawStanceBox, approachRing: FX.drawApproachRing, rotate: FX.drawRotate }[kind];
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999, background: '#14171d', display: 'flex', gap: '8px', padding: '8px' });
  wrap.id = '__shot';
  for (const pr of [0, 0.25, 0.5, 0.75, 1]) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    c.style.width = c.style.height = '256px';
    fn(c.getContext('2d'), 256, { ...P, prog: pr }, { halo: 1 }, 0, ENV, pr);
    wrap.appendChild(c);
  }
  document.body.appendChild(wrap);
}, kind);

await new Promise(r => setTimeout(r, 300));
await (await p.$('#__shot')).screenshot({ path: out });
console.log('saved', out);
await b.close();
