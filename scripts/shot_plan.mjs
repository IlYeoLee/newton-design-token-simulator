// 평면(top-down) UI 추출 — 시나리오 화면을 원근 없이 뽑아 조판·미감을 판단한다.
//   유저: "정면이라기보다 평면으로 UI를 뽑을 거라구."
//   __setTopView 는 이미 있는 수직 바닥뷰 훅(6636263). 여기선 그걸 켜고 UI 만 남긴다.
//   사용: node scripts/shot_plan.mjs BK_B1 [초]
import puppeteer from 'puppeteer';
const DIR = process.env.SHOT_DIR || '/private/tmp/claude-501/-Users-iil-yeo/470bab8d-790a-4a73-a1f4-7b8eaed4ec18/scratchpad';
const stage = process.argv[2] || 'BK_B1';
const at = +(process.argv[3] || 8);
const b = await puppeteer.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setCacheEnabled(false);
await p.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
await p.goto(`http://localhost:5199/?scene=${stage}&cb=` + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 12000));
await p.evaluate(async (at) => {
  const s = window.__sess;
  for (let i = 0; i < 400 && s.t < at; i++) await new Promise(r => setTimeout(r, 50));
  window.__setTopView?.(true);                       // 수직 바닥뷰
  document.querySelectorAll('button, .hud, #lab-panel').forEach(el => { el.style.visibility = 'hidden'; });
  await new Promise(r => setTimeout(r, 1200));       // 카메라 안착
}, at);
await p.screenshot({ path: `${DIR}/plan-${stage}.png` });
console.log(`plan-${stage}.png · errors:`, errs.slice(0, 2));
await b.close();
