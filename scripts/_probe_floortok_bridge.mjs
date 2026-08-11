// 지면 레이아웃 실시간 브리지 실측 — 랩(tokens.html) 슬라이더 → 시뮬 TOK 즉시 반영 확인
import puppeteer from 'puppeteer';
const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const sim = await b.newPage();
await sim.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await sim.waitForFunction(() => window.__sess, { timeout: 30000 });
const lab = await b.newPage();
await lab.goto(BASE + 'tokens.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1000));

const readSim = k => sim.evaluate(async k => (await import('/src/floorgl.js')).TOK[k], k);
const first = await lab.evaluate(() => {
  const el = document.querySelector('input[data-t]');
  if (!el) return null;
  const k = el.dataset.t, before = +el.value;
  const next = before === +el.max ? +el.min : Math.min(+el.max, before + (+el.step || 1) * 5);
  el.value = next;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return { k, before, next };
});
if (!first) { console.log('랩 슬라이더 없음'); await b.close(); process.exit(1); }
await new Promise(r => setTimeout(r, 600));
const dev = await sim.evaluate(() => document.body.classList.contains('dev'));
const got = await readSim(first.k);
console.log(`devView=${dev} · 랩 ${first.k}: ${first.before} → ${first.next} · 시뮬 TOK.${first.k} = ${got}`);
const devOk = got === first.next;
console.log(devOk ? '✓ dev 뷰 실시간 반영' : '✗ dev 뷰 반영 안 됨');

// 전시 가드 — dev 클래스를 떼고 다시 쏘면 시뮬 값이 변하면 안 된다
await sim.evaluate(() => document.body.classList.remove('dev'));
const second = await lab.evaluate(() => {
  const el = document.querySelector('input[data-t]');
  const k = el.dataset.t;
  el.value = +el.min;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return { k, sent: +el.min };
});
await new Promise(r => setTimeout(r, 600));
const got2 = await readSim(second.k);
const guardOk = got2 === got && got2 !== second.sent;
console.log(`비dev 뷰: 랩이 ${second.sent} 를 쐈지만 시뮬 TOK.${second.k} = ${got2}`);
console.log(guardOk ? '✓ 전시 가드 — 비dev 뷰 차단 확인' : '✗ 가드 실패 — 비dev 뷰에서 값이 변함');
await b.close();
process.exit(devOk && guardOk ? 0 : 1);
