// 투사 UI 대지를 PNG 로 굽는다 — 3D·카메라 없이 캔버스 2D 만 쓰므로 헤드리스에서 정확하다.
//
// 왜 이게 필요한가:
//   이 앱의 WebGL 백버퍼는 `preserveDrawingBuffer:false` 라 헤드리스/원격에서 픽셀을 못 읽는다.
//   하지만 벽·바닥 UI 는 **캔버스 2D** 로 그린 뒤 텍스처로 올리는 구조라, 그 캔버스만 따로
//   그리게 하면 정확한 픽셀을 얻을 수 있다. "화면에서 잘려 보이는 게 조판 문제냐 카메라
//   프레이밍 문제냐" 를 캡처 한 장으로 가른다.
//
// 사용:
//   node scripts/shot_ui.mjs                              → 벽 BX_C2 scene, t=4
//   node scripts/shot_ui.mjs BX_T1 transition out.png 6   → 스테이지·종류·파일·시각 지정
//   node scripts/shot_ui.mjs --floor T1 transition f.png 3
//
// 사전 조건: `npm run dev` 가 5199 에서 떠 있어야 한다.
import puppeteer from 'puppeteer';

const argv = process.argv.slice(2);
const floor = argv[0] === '--floor';
const [stage = floor ? 'T1' : 'BX_C2', kind = 'scene', out = 'tmp_ui.png', tv = '4'] =
  floor ? argv.slice(1) : argv;

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 140)));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });

await p.evaluate(async (stage, kind, T, floor) => {
  const M = await import((floor ? '/src/floorgl.js?v=' : '/src/wallgl.js?v=') + Date.now());
  const G = floor ? new M.FloorGL() : new M.WallGL();
  G.stage = stage; G.kind = kind; G.t = T; G.params = { dur: 11 };
  // 웹폰트가 오기 전에 그리면 조판이 달라진다 — 캔버스 fillText 는 폰트 로드를 촉발하지 않는다.
  await Promise.all(['700 100px Supreme', '400 100px Supreme', '700 100px OffBit']
    .map(f => document.fonts.load(f).catch(() => {})));
  await document.fonts.ready;
  G._paint();
  const c = G.canvas;
  Object.assign(c.style, {
    position: 'fixed', left: '0', top: '0', zIndex: 99999, background: '#14171d',
    width: '1300px', height: Math.round(1300 * c.height / c.width) + 'px',
  });
  c.id = '__shot';
  document.body.appendChild(c);
}, stage, kind, +tv, floor);

await new Promise(r => setTimeout(r, 400));
await (await p.$('#__shot')).screenshot({ path: out });
console.log('saved', out);
await b.close();
