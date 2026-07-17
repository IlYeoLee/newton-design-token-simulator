// MARK 패리티 하니스 — 카탈로그(FX Lab) vs 라이브 셰이더 픽셀 diff.
// 사용: npm run parity [-- serverURL]  (기본 http://127.0.0.1:5199)
// 통과 기준: 7상태 × 존원/발형 전부 FAIL(평균 절대차 8/255) 미만.
import puppeteer from 'puppeteer';

const base = process.argv[2] || 'http://127.0.0.1:5199';
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
await page.goto(`${base}/parity.html`, { waitUntil: 'networkidle0', timeout: 60000 });
const result = await page.waitForFunction('window.__parityResult', { timeout: 45000 })
  .then(h => h.jsonValue());
await browser.close();

let fail = false;
console.log('상태        존원   발형   판정');
for (const r of result) {
  console.log(`${r.state.padEnd(10)} ${r.zone.toFixed(2).padStart(6)} ${r.foot.toFixed(2).padStart(6)}  ${r.verdict}`);
  if (r.verdict === 'FAIL') fail = true;
}
console.log(fail ? '\n❌ 패리티 실패 — 카탈로그와 라이브 셰이더가 갈라졌습니다.' : '\n✅ 패리티 통과 — 룩 = 시뮬.');
process.exit(fail ? 1 : 0);
