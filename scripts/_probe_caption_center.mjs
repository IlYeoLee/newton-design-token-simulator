// 자막 중앙 정렬 실측 — 뷰포트 폭별로 .vc-card 중심 vs 창 중심 오차(px)
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
for (const W of [1600, 1920, 2560, 3840]) {
  const p = await b.newPage();
  await p.setViewport({ width: W, height: Math.round(W * 9 / 16) });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForFunction(() => window.__sess, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));
  await p.evaluate(() => document.body.classList.remove('dev'));
  // 자막 강제 표출 — 세션 시작 음성
  await p.evaluate(() => document.getElementById('btn-session')?.click());
  await p.waitForFunction(() => {
    const c = document.querySelector('#voice-caption .vc-card');
    return c && c.getBoundingClientRect().width > 50;
  }, { timeout: 20000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 600));
  const m = await p.evaluate(() => {
    const card = document.querySelector('#voice-caption .vc-card');
    const root = document.getElementById('voice-caption');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return {
      cardCx: +((r.left + r.right) / 2).toFixed(1),
      winCx: innerWidth / 2,
      off: +(((r.left + r.right) / 2) - innerWidth / 2).toFixed(1),
      zoom: getComputedStyle(root).zoom,
      cardW: Math.round(r.width),
    };
  });
  console.log(`${W}px:`, m ? JSON.stringify(m) : '(자막 미표출)');
  await p.close();
}
await b.close();
