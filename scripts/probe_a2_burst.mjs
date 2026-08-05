// A2(종아리 늘리기)에서 '발 꾹 눌러 팡' 이 언제 터지는지 시각을 잰다.
//   팡 = session.js A2 분기의 `P.fill>=0.995` 래치 → a2count 증가 → onPress(버스트).
//   렌더 전에 이 시각을 알아야 그 구간만 뽑는다(20초를 통째로 뽑는 건 낭비다).
import puppeteer from 'puppeteer';

const DUR = +(process.argv[2] || 26);
const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://127.0.0.1:5200/?alpha=1&scene=A2', { waitUntil: 'networkidle2', timeout: 120000 });
await page.evaluate(() => new Promise(r => {
  const w = () => (window.__dbg?.session ? r() : setTimeout(w, 200)); w();
}));

const log = await page.evaluate(async (DUR) => {
  const d = window.__dbg, out = [];
  let prev = -1, prevHold = null;
  const t0 = performance.now();
  while ((performance.now() - t0) / 1000 < DUR) {
    const s = d.session;
    const c = s?.a2count ?? 0, f = s?.a2press?.fill ?? 0, hold = !!s?.a2Cyc?.inHold;
    if (c !== prev) { out.push({ ev: '팡', n: c, t: +(s.t).toFixed(2) }); prev = c; }
    if (hold !== prevHold) { out.push({ ev: hold ? '홀드시작' : '홀드끝', t: +(s.t).toFixed(2), fill: +f.toFixed(2) }); prevHold = hold; }
    await new Promise(r => setTimeout(r, 50));
  }
  out.push({ ev: '끝', t: +(d.session.t).toFixed(2) });
  return out;
}, DUR);

for (const e of log) console.log(JSON.stringify(e));
await browser.close();
