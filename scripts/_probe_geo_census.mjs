// 지오메트리 센서스 — 살아 있는 BufferGeometry/Texture 를 타입·파라미터별로 집계해
//   투어 한 바퀴 전후 증분으로 '무엇이 어디서 새는지'를 특정한다 (CDP queryObjects).
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__dbg, { timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));

const census = async () => {
  const cdp = await p.createCDPSession();
  await cdp.send('HeapProfiler.collectGarbage');
  const geoProto = await p.evaluateHandle(() => window.__dbg.THREE.BufferGeometry.prototype);
  const geos = await p.queryObjects(geoProto);
  const gBy = await p.evaluate((list) => {
    const by = {};
    for (const g of list) {
      const par = g.parameters ? Object.values(g.parameters).filter(v => typeof v === 'number').map(v => +v.toFixed(3)).join('x') : '';
      const k = `${g.type}(${par})${g._disposedTag || ''}`;
      by[k] = (by[k] || 0) + 1;
    }
    return by;
  }, geos);
  const texProto = await p.evaluateHandle(() => window.__dbg.THREE.Texture.prototype);
  const texs = await p.queryObjects(texProto);
  const tBy = await p.evaluate((list) => {
    const by = {};
    for (const t of list) {
      let k;
      try {
        const im = t.image;
        k = `${t.constructor?.name || 'Texture'}(${im ? (im.width || im.videoWidth || '?') + 'x' + (im.height || im.videoHeight || '?') : 'noimg'})`;
      } catch { k = `${t.constructor?.name || 'Texture'}(disposed-src)`; }
      by[k] = (by[k] || 0) + 1;
    }
    return by;
  }, texs);
  await geos.dispose(); await texs.dispose(); await cdp.detach();
  const info = await p.evaluate(() => ({ geo: window.__dbg.renderer.info.memory.geometries, tex: window.__dbg.renderer.info.memory.textures }));
  return { gBy, tBy, info };
};

const tourOnce = async () => {
  // 투어 시작(또는 재시작) → 다시 세션이 꺼질 때까지(3종목 완주) 대기.
  //   체류 시간은 누수와 무관하고 전환 횟수가 전부이므로, 스테이지 시계를 감아 3배속으로 돈다.
  await p.evaluate(() => document.getElementById('btn-demo')?.click());
  await new Promise(r => setTimeout(r, 3000));
  const t0 = Date.now();
  while (Date.now() - t0 < 9 * 60000) {
    await new Promise(r => setTimeout(r, 1500));
    const active = await p.evaluate(() => {
      const s = window.__sess;
      if (s?.active && typeof s.t === 'number') s.t += 3;   // 빨리감기 — 전환 경로는 그대로
      return !!s?.active;
    });
    if (!active) return true;
  }
  return false;
};

console.log('한 바퀴째…');
if (!(await tourOnce())) { console.log('투어 미완주'); await b.close(); process.exit(1); }
const A = await census();
console.log(`바퀴1 후: GPU geo=${A.info.geo} tex=${A.info.tex}`);
console.log('두 바퀴째…');
if (!(await tourOnce())) { console.log('투어 미완주'); await b.close(); process.exit(1); }
const B = await census();
console.log(`바퀴2 후: GPU geo=${B.info.geo} tex=${B.info.tex}`);

const diff = (a, b) => Object.entries(b)
  .map(([k, v]) => [k, v - (a[k] || 0)])
  .filter(([, d]) => d !== 0)
  .sort((x, y) => y[1] - x[1]);
console.log('--- 지오메트리 증분 (바퀴1→2, 타입(파라미터): +개수) ---');
for (const [k, d] of diff(A.gBy, B.gBy).slice(0, 20)) console.log(`  ${d > 0 ? '+' : ''}${d}  ${k}`);
console.log('--- 텍스처 증분 ---');
for (const [k, d] of diff(A.tBy, B.tBy).slice(0, 20)) console.log(`  ${d > 0 ? '+' : ''}${d}  ${k}`);
await b.close();
