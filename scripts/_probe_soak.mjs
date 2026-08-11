// 장시간 재생 성능 소크 계측 — 데모 투어(전시 자동 순회)를 돌리며 주기 샘플링.
//   무엇이 단조 증가하는가: THREE 지오/텍스처/프로그램 · 드로콜 · 씬 객체 수 · JS 힙 · FPS.
//   사용: node scripts/_probe_soak.mjs [url] [분]
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const MIN = +(process.argv[3] || 6);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__dbg, { timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));
// 전시 시나리오 그대로 — 데모 투어(3종목 자동 순회)
await p.evaluate(() => document.getElementById('btn-demo')?.click());
await new Promise(r => setTimeout(r, 3000));

const sample = () => p.evaluate(async () => {
  const D = window.__dbg;
  const info = D.renderer.info;
  let objs = 0; D.scene.traverse(() => objs++);
  let mats = 0; try { mats = (await import('/src/session.js')).WAVE_MATS?.length ?? -1; } catch { mats = -2; }
  // FPS — 1.5초 rAF 실측
  const fps = await new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(Math.round(n / 1.5)); };
    requestAnimationFrame(tick);
  });
  return {
    fps,
    geo: info.memory.geometries, tex: info.memory.textures, prog: info.programs.length,
    calls: info.render.calls, tris: Math.round(info.render.triangles / 1000) + 'k',
    objs, waveMats: mats,
    judge: D.judge?.results?.length ?? -1, marks: D.judge?.marks?.length ?? -1,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
    canvases: document.querySelectorAll('canvas').length,
    videos: document.querySelectorAll('video').length,
    active: !!window.__sess?.active,
    stage: window.__sess?.stage, pack: D.state?.pack,
  };
});

console.log('t(s)\tfps\tgeo\ttex\tprog\tcalls\ttris\tobjs\twave\tjudge\theapMB\tcv\tstage');
const t0 = Date.now();
const rows = [];
while (Date.now() - t0 < MIN * 60000) {
  const s = await sample();
  rows.push(s);
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}\t${s.fps}\t${s.geo}\t${s.tex}\t${s.prog}\t${s.calls}\t${s.tris}\t${s.objs}\t${s.videos}v\t${s.judge}/${s.marks}\t${s.heapMB}\t${s.canvases}\t${s.pack}:${s.stage}`);
  // 투어가 한 바퀴 끝나 세션이 꺼졌으면 다시 시작 — 전시 무한 순회 등가
  if (!s.active) { await p.evaluate(() => document.getElementById('btn-demo')?.click()); console.log('(투어 재시작)'); }
  await new Promise(r => setTimeout(r, 20000));
}
const a = rows[0], z = rows[rows.length - 1];
console.log('--- 증분 (처음 → 끝) ---');
for (const k of ['fps', 'geo', 'tex', 'prog', 'objs', 'waveMats', 'heapMB', 'canvases']) console.log(`${k}: ${a[k]} → ${z[k]}`);
console.log('pageerrors:', errs.length ? [...new Set(errs)].slice(0, 5).join(' | ') : '(없음)');
await b.close();
