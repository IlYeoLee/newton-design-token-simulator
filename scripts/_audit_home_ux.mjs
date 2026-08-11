// 홈(제품 뷰) 기본 웹 UX 전수 계측 — 외관 감사용 (스크린샷·산출물은 리포 밖 %TEMP%)
//   잡는 것: ① 터치 타깃 44px 미만 인터랙티브 요소 ② cursor:pointer 누락 ③ 10px 미만 활자
//   ④ 뷰포트 밖으로 넘치는 요소. 판단·수정은 코드에서 — 이 스크립트는 숫자만 뱉는다.
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const SHOT = (process.env.TEMP || '.').replace(/\\/g, '/') + '/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess, { timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const audit = () => p.evaluate(() => {
  const out = { small: [], noCursor: [], tinyText: [], overflow: [] };
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = el => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')
    + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  document.querySelectorAll('button, a, input, select, [onclick], [role=button]').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.width < 40 || r.height < 32) out.small.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (s.cursor !== 'pointer' && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') out.noCursor.push(label(el));
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1) out.overflow.push(`${label(el)} @${Math.round(r.left)},${Math.round(r.top)}`);
    const fs = parseFloat(s.fontSize);
    if (fs && fs < 10 && (el.textContent || '').trim()) out.tinyText.push(`${label(el)} ${fs}px`);
  });
  return out;
});

console.log('=== 홈(제품 뷰) ===');
console.log(JSON.stringify(await audit(), null, 1));
await p.screenshot({ path: SHOT + 'audit_home.png' });

// 디자인 랩 오버레이 열어서 같은 감사
const opened = await p.evaluate(() => {
  const a = document.querySelector('.lab-embed');
  if (!a) return false; a.click(); return true;
});
if (opened) {
  await new Promise(r => setTimeout(r, 2500));
  console.log('=== 랩 임베드 오버레이 ===');
  console.log(JSON.stringify(await audit(), null, 1));
  const x = await p.evaluate(() => {
    const el = document.getElementById('lab-embed-close');
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), right: Math.round(innerWidth - r.right), font: getComputedStyle(el).fontSize };
  });
  console.log('X버튼 실측:', JSON.stringify(x));
  await p.screenshot({ path: SHOT + 'audit_overlay.png' });
}
await b.close();
