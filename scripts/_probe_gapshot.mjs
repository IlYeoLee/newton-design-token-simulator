// 2안 세로 간격을 **그림으로** — 잉크 띠를 찾아 경계선·간격 치수를 화면에 얹어 캡처
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1000, height: 1200 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://127.0.0.1:5300/', { waitUntil: 'networkidle2', timeout: 60000 });
await p.evaluate(async () => {
  const M = await import('/src/floorgl.js?v=' + Date.now());
  const G = new M.FloorGL();
  G.load('READY', { src: 'floor.html', dur: 11, pv: 3 });
  await Promise.all(['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'].map(f => document.fonts.load(f).catch(() => {})));
  G.t = 5; G._paint();
  await new Promise(r => setTimeout(r, 2500));
  G._sig = null; G._lastPaint = -1; G._paint();
  const cv = G.canvas, K = cv.width / 1600;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const rows = new Array(cv.height).fill(0);
  for (let y = 0; y < cv.height; y++) { let n = 0;
    for (let x = 0; x < cv.width; x++) { const k = (y * cv.width + x) * 4; if (d[k + 3] < 120) continue;
      const r = d[k], g2 = d[k + 1], b2 = d[k + 2], mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2);
      if (mx > 150 && mx - mn < 45) n++; } rows[y] = n; }
  const bands = []; let s = -1;
  for (let y = 0; y <= cv.height; y++) { const on = rows[y] > 8;
    if (on && s < 0) s = y;
    if (!on && s >= 0) { const b0 = s / K, b1 = (y - 1) / K; const last = bands[bands.length - 1];
      if (last && b0 - last[1] < 6) last[1] = b1; else bands.push([b0, b1]); s = -1; } }
  const B = bands.filter(([a, z]) => z - a > 6);
  const NAMES = ['타이틀 1행', '타이틀 2행', '숫자 + km', 'Pace On', 'Tap your foot Twice', '십자 가이드', '발자국'];

  // 주석 캔버스 — 대지 좌표계로 그린다
  const out = document.createElement('canvas');
  const SC = 0.36;                                  // 보기 좋은 축소
  out.width = Math.round(1600 * SC) + 300; out.height = Math.round(2670 * SC);
  const o = out.getContext('2d');
  o.fillStyle = '#0A0C10'; o.fillRect(0, 0, out.width, out.height);
  o.drawImage(cv, 0, 0, Math.round(1600 * SC), Math.round(2670 * SC));
  const Y = v => v * SC, RX = Math.round(1600 * SC);
  o.font = '13px system-ui'; o.textBaseline = 'middle';
  B.forEach(([a, z], i) => {
    o.strokeStyle = 'rgba(80,200,255,.9)'; o.lineWidth = 1; o.setLineDash([4, 3]);
    o.beginPath(); o.moveTo(0, Y(a)); o.lineTo(out.width, Y(a));
    o.moveTo(0, Y(z)); o.lineTo(out.width, Y(z)); o.stroke(); o.setLineDash([]);
    o.fillStyle = '#7fe3ff'; o.textAlign = 'left';
    o.fillText(`${NAMES[i] || ''}  ${Math.round(a)}–${Math.round(z)}`, RX + 8, Y((a + z) / 2));
    if (i > 0) {                                    // 위 띠와의 간격 치수
      const pz = B[i - 1][1], gap = a - pz, my = Y((pz + a) / 2);
      o.strokeStyle = '#FF5A5A'; o.lineWidth = 2;
      o.beginPath(); o.moveTo(RX - 26, Y(pz)); o.lineTo(RX - 26, Y(a)); o.stroke();
      o.beginPath(); o.moveTo(RX - 32, Y(pz) + 1); o.lineTo(RX - 20, Y(pz) + 1);
      o.moveTo(RX - 32, Y(a) - 1); o.lineTo(RX - 20, Y(a) - 1); o.stroke();
      o.fillStyle = '#FF5A5A'; o.font = 'bold 15px system-ui'; o.textAlign = 'right';
      o.fillText(String(Math.round(gap)), RX - 36, my);
      o.font = '13px system-ui';
    }
  });
  o.fillStyle = '#fff'; o.font = 'bold 15px system-ui'; o.textAlign = 'left';
  o.fillText('2안 세로 간격 (대지 단위 · 그려진 픽셀 실측)', 8, 16);
  o.fillStyle = '#FF5A5A'; o.fillText('빨강 = 띠 사이 간격', 8, 36);
  Object.assign(out.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999 });
  out.id = '__gap'; document.body.appendChild(out);
});
await new Promise(r => setTimeout(r, 400));
await (await p.$('#__gap')).screenshot({ path: process.argv[2] });
console.log('saved');
await b.close();
