// C2(잽 대련) 처음부터 자연 재생 → C3(잽잽훅) 전환 실측 — 전환 직후 자막·마크 잔재와
//   콘솔 에러, 예기치 않은 리로드를 기록 + 스크린샷(감시 트리 밖에 저장 — 루트에 쓰면
//   vite always-full-reload 가 그 파일 변경으로 페이지를 리로드시켜 실험을 오염시킨다).
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const SHOT = process.env.TEMP ? `${process.env.TEMP.replace(/\\/g, '/')}/` : './';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
const errs = [];
p.on('console', m => {
  const t = m.text();
  if (m.type() === 'error') errs.push(`[error] ${t}`);
  if (/vite|reload/i.test(t)) console.log(`  [console@${Date.now() % 100000}] ${t}`);
});
p.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
p.on('framenavigated', f => { if (f === p.mainFrame()) console.log(`  [NAV@${Date.now() % 100000}] ${f.url()}`); });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__cam, { timeout: 30000 });
await p.evaluate(() => document.querySelector('[data-pack=boxing]')?.click() || [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '복싱')?.click());
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1200));
await p.waitForFunction(() => window.__sess && window.__sess.stages, { timeout: 30000 });

const ok = await p.evaluate(() => {
  const s = window.__sess;
  const i = s.stages.findIndex(x => x.id === 'BX_C2');
  if (i < 0) return false;
  s.stageIdx = i; s.t = 0; s._enter();
  return true;
});
if (!ok) { console.log('BX_C2 없음'); await b.close(); process.exit(1); }

const state = () => p.evaluate(() => {
  const s = window.__sess;
  if (!s) return { stage: '(reload!)', t: -1 };
  const cap = document.getElementById('voice-caption');
  return {
    stage: s.stage, t: +s.t.toFixed(2),
    caption: cap ? cap.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : null,
    voiceBusy: s.voiceBusy?.() ?? null,
  };
});

// C2 진행을 관찰하며 C3 진입 순간을 잡는다
const t0 = Date.now();
let prev = '';
while (Date.now() - t0 < 40000) {
  await new Promise(r => setTimeout(r, 250));
  const st = await state();
  const line = `${((Date.now() - t0) / 1000).toFixed(1)}s ${st.stage} t=${st.t} busy=${st.voiceBusy} cap="${st.caption}"`;
  const key = line.replace(/^[\d.]+s /, '').replace(/t=[\d.]+ /, '');
  if (key !== prev) { console.log(line); prev = key; }
  if (st.stage === 'BX_C3') break;
}
const st1 = await state();
if (st1.stage !== 'BX_C3') { console.log('C3 미진입 — 종료'); console.log(errs.join('\n')); await b.close(); process.exit(1); }

await p.screenshot({ path: SHOT + 'scratch_c3n_t0.png' });
console.log('C3 entry:', JSON.stringify(st1));
await new Promise(r => setTimeout(r, 1500));
console.log('C3 +1.5s:', JSON.stringify(await state()));
await p.screenshot({ path: SHOT + 'scratch_c3n_t15.png' });
await new Promise(r => setTimeout(r, 2000));
console.log('C3 +3.5s:', JSON.stringify(await state()));
await p.screenshot({ path: SHOT + 'scratch_c3n_t35.png' });
// C3 가 온전히 살아남는지 — 끝날 때까지 지켜보고 다음 스테이지를 기록
const t1 = Date.now();
while (Date.now() - t1 < 40000) {
  await new Promise(r => setTimeout(r, 500));
  const st = await state();
  if (st.stage !== 'BX_C3') { console.log(`C3 종료 → ${st.stage} (진입 후 ${((Date.now() - t1) / 1000).toFixed(1)}s + 3.5s)`, JSON.stringify(st)); break; }
}
console.log('--- console errors ---');
console.log(errs.length ? errs.join('\n') : '(없음)');
await b.close();
