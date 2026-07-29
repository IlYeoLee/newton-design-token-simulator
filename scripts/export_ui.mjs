// ─────────────────────────────────────────────────────────────
// 투사 UI만 초고화질 영상으로 — 실사 합성용
//
//   3D 씬을 거치지 않는다. 투사 UI 는 이미 대지 원본 해상도의 2D 캔버스에 그려진다:
//     지면 1600×2670 (러닝·농구) · 벽 2600×1600 (복싱)
//   그 캔버스를 직접 뽑으면 3D 렌더의 앨리어싱·검은 띠·프레임 드롭이 원천적으로 없다.
//   시계도 우리가 t 를 직접 밀므로 완전히 결정론적이다 — 같은 명령 = 같은 프레임.
//
//   에펙에서 코너핀으로 투사면에 맞추고 Screen 으로 얹으면 된다(투사는 가산광).
//
//   사용:
//     node scripts/export_ui.mjs --stage A3 --dur 8 --fps 60 --w 2160
//     node scripts/export_ui.mjs --surface wall --stage BX_T1 --dur 8 --fps 60
//     node scripts/export_ui.mjs --list          ← 뽑을 수 있는 화면 목록
//
//   옵션
//     --surface floor|wall   기본 floor
//     --stage   화면 이름 (기본 A3)      --dur 초 (기본 8)   --fps 기본 60
//     --w       가로 px — 대지 비율 유지. 기본 = 대지 원본(지면 1600 · 벽 2600)
//     --alpha   알파 채널 유지(ProRes 4444). 기본은 검은 배경(가산 합성용)
//     --out     기본 out/
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
};

// 화면 → 원본 HTML (floorgl/wallgl 의 kind 판별에 쓰인다)
const FLOOR = {
  READY: 'floor.html', A1: 'floor-scene.html', A2: 'floor-scene.html', A3: 'floor-scene.html',
  P1: 'floor-scene.html', P2: 'floor-scene.html', P3: 'floor-scene.html',
  C1: 'floor-timer.html', C2: 'floor-scene.html', C3: 'floor-scene.html',
  C4: 'floor-scene.html', C5: 'floor-scene.html',
  T1: 'floor-transition.html', T2: 'floor-transition.html', FIN: 'floor-report.html',
  BK_READY: 'floor-bk.html', BK_A2: 'floor-scene.html', BK_A3: 'floor-scene.html',
  BK_B1: 'floor-scene.html', BK_B2: 'floor-scene.html', BK_B3: 'floor-scene.html',
  BK_B4: 'floor-scene.html', BK_B5: 'floor-scene.html',
  BK_T1: 'floor-transition.html', BK_T2: 'floor-transition.html', BK_FIN: 'floor-report.html',
};
const WALL = {
  BX_READY: 'index.html', BX_A1: 'scene.html', BX_A2: 'scene.html', BX_A3: 'scene.html',
  BX_B1: 'scene.html', BX_B2: 'scene.html', BX_B3: 'scene.html',
  BX_C1: 'timer.html', BX_C2: 'scene.html', BX_C3: 'scene.html', BX_C4: 'scene.html',
  BX_T1: 'transition.html', BX_T2: 'transition.html', BX_FIN: 'report.html',
};

if (arg('list', false)) {
  console.log('지면(floor):', Object.keys(FLOOR).join(' '));
  console.log('벽(wall)  :', Object.keys(WALL).join(' '));
  process.exit(0);
}

const SURF = arg('surface', 'floor');
const STAGE = arg('stage', SURF === 'wall' ? 'BX_T1' : 'A3');
const DUR = +arg('dur', 8);
const FPS = +arg('fps', 60);
const ALPHA = !!arg('alpha', false);
const OUT = arg('out', 'out');
const URLBASE = arg('url', 'http://127.0.0.1:5199/');

const MAP = SURF === 'wall' ? WALL : FLOOR;
const src = MAP[STAGE];
if (!src) { console.error(`알 수 없는 화면: ${STAGE}\n  --list 로 목록을 보세요.`); process.exit(1); }

// 대지 원본 비율 — 지면 1600×2670 · 벽 2600×1600
const BASE_W = SURF === 'wall' ? 2600 : 1600;
const BASE_H = SURF === 'wall' ? 1600 : 2670;
const W = +arg('w', BASE_W);
const H = Math.round(W * BASE_H / BASE_W);

const TMP = fs.mkdtempSync('/tmp/newton_ui_');
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
const tag = `ui_${STAGE}_${W}x${H}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (${W}×${H} · ${FPS}fps · ${DUR}s · 대지 ${BASE_W}×${BASE_H})`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=metal', '--enable-gpu', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto(URLBASE + '?dev=1', { waitUntil: 'networkidle2', timeout: 180000 });
await page.waitForFunction('!!window.__dbg?.floorGL', { timeout: 120000 });
await new Promise(r => setTimeout(r, 9000));   // 폰트·이미지 준비

await page.evaluate(({ surf, stage, src, w, h }) => {
  const d = window.__dbg;
  const g = surf === 'wall' ? d.wallGL : d.floorGL;
  g.load(stage, { dur: 8, pv: 3, src: `ready-view/${src}?stage=${stage}` });
  // 내보내기 전용 출력 캔버스 — 대지 캔버스를 원하는 해상도로 리샘플해 담는다
  const o = document.createElement('canvas');
  o.width = w; o.height = h; o.id = '__uiout';
  Object.assign(o.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999' });
  document.body.appendChild(o);
  window.__uiG = g;
}, { surf: SURF, stage: STAGE, src, w: W, h: H });
await new Promise(r => setTimeout(r, 1500));

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  // ★ 시계를 우리가 민다 — 렌더 루프에 의존하지 않으므로 드롭이 원천적으로 없다.
  //   _lastPaint 를 무효화해 UI_FPS 스로틀을 우회하고 매 프레임 새로 그린다.
  const dataUrl = await page.evaluate(({ tt, alpha }) => {
    const g = window.__uiG;
    g.t = tt; g._lastPaint = -1; g._sig = null;
    g._paint();
    const o = document.getElementById('__uiout');
    const x = o.getContext('2d');
    x.clearRect(0, 0, o.width, o.height);
    if (!alpha) { x.fillStyle = '#000'; x.fillRect(0, 0, o.width, o.height); }
    x.imageSmoothingQuality = 'high';
    x.drawImage(g.canvas, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, { tt: t, alpha: ALPHA });
  fs.writeFileSync(path.join(TMP, `f${String(i).padStart(5, '0')}.png`),
    Buffer.from(dataUrl.split(',')[1], 'base64'));
  if (i % 20 === 0 || i === N - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${i + 1}/${N}  ${el.toFixed(0)}s  (${(el / (i + 1)).toFixed(3)}s/프레임)   `);
  }
}
process.stdout.write('\n');

const mov = path.join(OUT, `${tag}.mov`);
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
  '-c:v', 'prores_ks', '-profile:v', '4444',
  '-pix_fmt', ALPHA ? 'yuva444p10le' : 'yuv444p10le', mov], { stdio: ['ignore', 'ignore', 'inherit'] });
const mp4 = path.join(OUT, `${tag}_preview.mp4`);
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
  '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4], { stdio: ['ignore', 'ignore', 'inherit'] });

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n✅ ${mov}\n   ${mp4}`);
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
