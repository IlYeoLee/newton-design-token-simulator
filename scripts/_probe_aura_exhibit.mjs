// 전시 캐러셀 실측 — 카드 존재·클릭 전환·에러·스크린샷
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const SHOT = (process.env.TEMP || '.').replace(/\\/g, '/') + '/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
const errs = [];
p.on('pageerror', e => errs.push('[pageerror] ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));   // 세그먼터 로드 + 첫 클립
const info = await p.evaluate(() => ({
  cards: document.querySelectorAll('.ex-card').length,
  looks: document.querySelectorAll('.ex-looks .chip').length,
  edit: !!document.querySelector('.ex-edit'),
  panelHidden: !document.querySelector('.pg-panel'),
  active: document.querySelector('.ex-card.on span')?.textContent,
  canvas: !!document.querySelector('.pg-canvas'),
}));
console.log('초기:', JSON.stringify(info));
await p.screenshot({ path: SHOT + 'aura_ex_1.png' });
// 3번째 카드(복싱 잽 대련) 클릭 → 전환 확인
await p.evaluate(() => document.querySelectorAll('.ex-card')[2]?.click());
await new Promise(r => setTimeout(r, 5000));
const after = await p.evaluate(() => ({
  active: document.querySelector('.ex-card.on span')?.textContent,
}));
console.log('클릭 후:', JSON.stringify(after));
await p.screenshot({ path: SHOT + 'aura_ex_2.png' });
// 편집 토글
await p.evaluate(() => document.querySelector('.ex-edit')?.click());
await new Promise(r => setTimeout(r, 500));
console.log('편집 열림:', await p.evaluate(() => !!document.querySelector('.pg-panel')));
console.log('errors:', errs.length ? errs.join(' | ') : '(없음)');
await b.close();
