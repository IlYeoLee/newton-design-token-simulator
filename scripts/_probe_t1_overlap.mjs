// BK_T1 실측 — 인물 영상(코치 판)과 발자국 마크가 같은 프레임에 떠 있는가.
//   기대: [관찰] 코치판 보임 · 마크 0  →  [따라하기] 코치판 없음 · 마크 보임.
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess, { timeout: 30000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => { const s = window.__sess; const i = s.stages.findIndex(x => x.id === 'BK_T1');
  s.stageIdx = i; s.t = 0; s._enter(); });
const t0 = Date.now();
console.log('  wall  stage      t   follow demo pvLoops  코치판  마크최대α');
while (Date.now() - t0 < 26000) {
  await new Promise(r => setTimeout(r, 700));
  const s = await p.evaluate(() => {
    const s = window.__sess;
    const H = s.bkT1x || {};
    // 발자국 마크(fLl·fLr·fRl·fRr·fC) + 존 마크(mL·mC·mR)의 최대 불투명도
    const ops = [];
    for (const k of ['fLl','fLr','fRl','fRr','fC','mL','mC','mR']) {
      const o = H[k]; if (!o) continue;
      const m = o.mesh || o.g || o;
      const u = m?.material?.uniforms;
      ops.push(u?.uGain?.value ?? u?.uFade?.value ?? m?.material?.opacity ?? 0);
    }
    const co = window.__coach;
    return { st: s.stage, t: +(s.t ?? 0).toFixed(1), fl: !!s._followLatch, demo: !!s.demoActive,
             pv: s._pvLoops ?? null, plane: co?.plane ? !!co.plane.visible : null,
             mark: +Math.max(0, ...ops.map(Number).filter(Number.isFinite)).toFixed(2) };
  });
  console.log(`  ${((Date.now()-t0)/1000).toFixed(1).padStart(4)}s ${String(s.st).padEnd(9)} ${String(s.t).padStart(5)} ${String(s.fl).padStart(6)} ${String(s.demo).padStart(5)} ${String(s.pv).padStart(6)}   ${String(s.plane).padStart(5)}   ${s.mark}`);
  if (s.st !== 'BK_T1') { console.log('  → 스테이지 이탈'); break; }
}
await b.close();
