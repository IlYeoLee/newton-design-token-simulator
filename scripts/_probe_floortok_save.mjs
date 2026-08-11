// 지면 레이아웃 랩(tokens.html) 저장 경로 실측 — 콘솔 에러 · 슬라이더 반응 · 저장 결과
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/tokens.html';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('[pageerror] ' + e.message));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
const info = await p.evaluate(() => {
  const save = document.querySelector('#save');
  const sliders = document.querySelectorAll('input[type=range]').length;
  return { hasSave: !!save, saveText: save?.textContent?.trim(), sliders,
    saveVisible: save ? save.getBoundingClientRect().height > 0 : false,
    bodyH: document.body.scrollHeight, winH: innerHeight };
});
console.log('lab:', JSON.stringify(info));
// 슬라이더 하나 살짝 움직였다가 원복 없이 저장 눌러 본다 (diff 유무와 무관하게 응답이 와야 함)
const saved = await p.evaluate(async () => {
  const save = document.querySelector('#save');
  if (!save) return 'no #save';
  save.click();
  await new Promise(r => setTimeout(r, 1200));
  return document.querySelector('#savemsg')?.textContent || '(savemsg 없음)';
});
console.log('save result:', saved);
console.log('console errors:', errs.length ? errs.join(' | ') : '(없음)');
await b.close();
