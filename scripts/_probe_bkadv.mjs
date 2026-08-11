// 농구 스테이지 자동 진행 실측 — 각 스테이지에 점프해 다음으로 넘어가는지·언제·왜를 기록
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const TARGETS = process.argv[3] ? process.argv[3].split(',') : ['BK_T1', 'BK_B2', 'BK_B3', 'BK_B4'];
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__cam, { timeout: 30000 });
await p.evaluate(() => document.querySelector('[data-pack=basketball]')?.click() || [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));

for (const tgt of TARGETS) {
  const ok = await p.evaluate((tgt) => {
    const s = window.__sess;
    const i = s.stages.findIndex(x => x.id === tgt);
    if (i < 0) return false;
    s.stageIdx = i; s.t = 0; s._enter();
    return true;
  }, tgt);
  if (!ok) { console.log(`${tgt}: 스테이지 없음`); continue; }
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 90000) {
    await new Promise(r => setTimeout(r, 1000));
    const s = await p.evaluate(() => ({ st: window.__sess.stage, t: +window.__sess.t.toFixed(1), fl: !!window.__sess._followLatch, pv: window.__sess._pvLoops ?? null, rl: window.__sess.repLeft ?? null }));
    const line = `  ${((Date.now() - t0) / 1000).toFixed(0)}s  stage=${s.st} t=${s.t} follow=${s.fl} pvLoops=${s.pv} repLeft=${s.rl}`;
    if (line.replace(/^\s*\d+s/, '') !== last.replace(/^\s*\d+s/, '')) console.log(line);
    last = line;
    if (s.st !== tgt) { console.log(`${tgt} → ${s.st}  (${((Date.now() - t0) / 1000).toFixed(1)}s 후 진행)`); break; }
  }
  if (last && (await p.evaluate(() => window.__sess.stage)) === tgt) console.log(`${tgt}: 90초 동안 진행 안 함 (멈춤)`);
}
await b.close();
