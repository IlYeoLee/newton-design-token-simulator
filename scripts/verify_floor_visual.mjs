// 플로어 프레임 시각 파리티 — 농구 주요 스테이지 스크린샷 (div 주입 전/후 비교용)
import puppeteer from 'puppeteer';
import fs from 'fs';
const OUT = process.argv[2] || '/private/tmp/claude-501/-Users-iil-yeo/fed9f4e6-abcd-410e-abe6-29d8bcb75e36/scratchpad/floorvis';
fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
p.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__dbg && !!window.__sess');
await p.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
await p.waitForFunction('!!window.__dbg?.xbot?.actions?.cmu_crossover_shot', { timeout: 120000 });
await new Promise(r => setTimeout(r, 1200));
await p.evaluate(() => document.getElementById('btn-session').click());
await new Promise(r => setTimeout(r, 1200));
for (const id of ['BK_READY', 'BK_A2', 'BK_B1', 'BK_T1', 'BK_C1', 'BK_FIN']) {
  await p.evaluate(sid => {
    const s = window.__sess;
    s.stageIdx = s.stages.findIndex(x => x.id === sid); s.t = 0; s._enter();
  }, id);
  await new Promise(r => setTimeout(r, 2600));
  fs.writeFileSync(`${OUT}/${id}.jpg`, await p.screenshot({ type: 'jpeg', quality: 75 }));
  console.log('shot', id);
}
await b.close();
