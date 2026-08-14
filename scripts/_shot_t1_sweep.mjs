// BK_T1 경계 스윕 — 관찰→따라하기 넘어가는 프레임에 인물과 발자국이 같이 뜨는지.
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
const clip = { x: 376, y: 0, width: 696, height: 900 };   // 무대(투사면)만 — 좌우 패널 제외
for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 800));
  const s = await p.evaluate(() => ({ t: +window.__sess.t.toFixed(1), st: window.__sess.stage,
    demo: !!window.__sess.demoActive, fl: !!window.__sess._followLatch, pv: window.__sess._pvLoops ?? 0 }));
  await p.screenshot({ path: `tmp_t1s_${String(i).padStart(2,'0')}.png`, clip });
  console.log(`${String(i).padStart(2)}  t=${String(s.t).padStart(5)}  ${s.st}  demo=${s.demo} follow=${s.fl} pv=${s.pv}`);
  if (s.st !== 'BK_T1') break;
}
await b.close();
