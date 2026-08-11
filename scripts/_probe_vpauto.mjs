// 자동 시점 전환 복원 검증 — BX_READY 에서 fov 가 58(1인칭)↔50(3인칭) 을 오가는지 실측
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__cam && window.__sess, { timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => document.getElementById('btn-session')?.click());
const samples = [];
for (let i = 0; i < 20; i++) {   // 10초 관찰 (0.5s 간격)
  await new Promise(r => setTimeout(r, 500));
  samples.push(await p.evaluate(() => ({ st: window.__sess.stage, t: +window.__sess.t.toFixed(1), fov: +window.__cam.fov.toFixed(1) })));
}
console.log(samples.map(s => `${s.st} t=${s.t} fov=${s.fov}`).join('\n'));
const fovs = new Set(samples.filter(s => s.st === 'BX_READY').map(s => Math.round(s.fov)));
console.log(fovs.size > 1 ? `PASS: BX_READY 에서 fov 왕복 (${[...fovs].join(',')})` : `FAIL: fov 고정 (${[...fovs].join(',')})`);
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
