// 강조 동그라미가 실제 발 위에 붙는지 — BK_T1 관찰 중 비트 도착 근방을 연속 캡처
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1100, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__cam, { timeout: 30000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => {
  const s = window.__sess;
  const i = s.stages.findIndex(x => x.id === 'BK_T1');
  s.stageIdx = i; s.t = 0; s._enter();
});
await p.evaluate(() => document.getElementById('btn-view')?.click());   // 1인칭 고정(fpUserSet) — 유저 스샷과 같은 시점
await p.evaluate(() => { if (!document.getElementById('btn-view')?.textContent.includes('3인칭')) document.getElementById('btn-view')?.click(); });
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 600));
  const vt = await p.evaluate(() => +(window.__sess?.stepVidT ?? -1).toFixed(2)).catch(() => -9);
  await p.screenshot({ path: `scratch_hot_${i}_vt${vt}.png` });
}
await b.close();
console.log('done');
