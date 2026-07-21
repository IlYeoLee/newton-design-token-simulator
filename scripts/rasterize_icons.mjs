import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const RUN = resolve(__dir, '../public/ready-view/assets/run');

// 아이콘 SVG → 투명 PNG (240px). 17MB earbuds SVG를 웹용 경량 PNG로.
const jobs = [
  { src: 'ic_a.svg', out: 'ic_earbuds.png', size: 240 },
  { src: 'ic_b.svg', out: 'ic_watch.png', size: 240 },
  { src: 'ic_glasses.svg', out: 'ic_glasses.png', size: 300 }, // glasses wide
];

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 400, deviceScaleFactor: 2 });
for (const j of jobs) {
  const url = `http://127.0.0.1:5200/ready-view/assets/run/${j.src}`;
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
     <img id="i" src="${url}" style="display:block;width:${j.size}px;height:${j.size}px">
     </body></html>`,
    { waitUntil: 'domcontentloaded' });
  // 이미지 실제 로드 완료까지 폴링(임베드 래스터 무거움)
  await page.waitForFunction(() => { const i = document.getElementById('i'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 60000 });
  const el = await page.$('#i');
  await el.screenshot({ path: resolve(RUN, j.out), omitBackground: true });
  console.log('wrote', j.out);
}
await browser.close();
console.log('done');
