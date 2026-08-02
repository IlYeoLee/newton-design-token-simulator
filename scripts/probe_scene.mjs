// 씬 스테이지 상태 진단 — 콘솔 오류와 배경 적용 여부를 실제로 확인한다.
//   사용: node scripts/probe_scene.mjs [scene] [bgUrl]
import puppeteer from 'puppeteer';
const SCENE = process.argv[2] || 'BX_READY';
const BG = process.argv[3] || '/_bg/wall.png';

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });

const url = `http://127.0.0.1:5199/?alpha=1&scene=${SCENE}&bg=${encodeURIComponent(BG)}&bgdim=0`;
console.log('열기:', url);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise(r => setTimeout(r, 12000));

const st = await page.evaluate(() => {
  // WebGL 캔버스를 정확히 — 첫 캔버스는 타임라인 UI 다(같은 함정을 프로브도 밟았다).
  const cv = window.__dbg?.renderer?.domElement
    || [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const host = cv?.parentElement;
  const cs = host ? getComputedStyle(host) : null;
  return {
    hasCanvas: !!cv,
    hooks: { setSceneBg: typeof window.__setSceneBg, sceneAdj: !!window.__sceneAdj, setFp: typeof window.__setFp },
    hostTag: host ? host.tagName + '#' + (host.id || '') : null,
    hostBgImage: cs?.backgroundImage?.slice(0, 60),
    bodyBg: getComputedStyle(document.body).backgroundImage?.slice(0, 60),
    canvasOpacity: cv ? getComputedStyle(cv).opacity : null,
    canvasBlend: cv ? getComputedStyle(cv).mixBlendMode : null,
    sceneBgNull: window.__dbg ? (window.__dbg.scene.background === null) : 'no __dbg',
  };
});
console.log(JSON.stringify(st, null, 2));
console.log(errs.length ? '오류 ' + errs.length + '건:\n  ' + errs.slice(0, 6).join('\n  ') : '오류 없음');
// 실제 화면 두 장 — 0.8초 간격. 반짝임(프레임 간 변화)을 눈으로 가릴 수 있게.
const SHOT = process.env.SHOT_DIR || '.';
await page.screenshot({ path: `${SHOT}/scene_a.png` });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: `${SHOT}/scene_b.png` });
console.log('스크린샷 2장 저장:', SHOT);
await browser.close();
