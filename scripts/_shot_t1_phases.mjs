// BK_T1 두 국면 스크린샷 — 관찰(영상만) vs 따라하기(발자국만)
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://127.0.0.1:5199/?dev=0', { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess, { timeout: 30000 });
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '농구')?.click());
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => { const s = window.__sess; s.stageIdx = s.stages.findIndex(x => x.id === 'BK_T1'); s.t = 0; s._enter(); });
const shot = async (name) => {
  const s = await p.evaluate(() => ({ t: +window.__sess.t.toFixed(1), demo: !!window.__sess.demoActive, fl: !!window.__sess._followLatch, pv: window.__sess._pvLoops ?? 0 }));
  await p.screenshot({ path: `tmp_t1_${name}.png` });
  console.log(`${name}: t=${s.t} demo=${s.demo} follow=${s.fl} pvLoops=${s.pv}`);
};
await new Promise(r => setTimeout(r, 3000)); await shot('watch');
await new Promise(r => setTimeout(r, 5000)); await shot('follow');
await b.close();
