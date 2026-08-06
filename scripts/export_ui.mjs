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
//     --uiscale 대지 캔버스 배율(기본 = 출력/대지 × 2, 최대 3).
//              앱은 실시간 예산 때문에 기본 K=0.75 로 그린다 — 그대로 뽑으면 2600 출력에
//              1950 원본을 늘리는 꼴이라 흐리다(유저 지적). 출력보다 크게 그린 뒤 줄인다.
//     --out     기본 out/
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import os from 'os';
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
// --live : 판이 읽는 값(SPM 등)을 프레임마다 주입한다.
//   이 경로는 세션을 안 돌려서 안 넣으면 '--' 로 그려진다. 판은 2D 캔버스라 값만 넣으면 그려진다.
//   기본 곡선 = 2026-08-06 P1 세션 실측(목표 137 · 175→140 수렴 후 143~150 진동).
const LIVE = process.argv.includes('--live') ? {
  tgt: +arg('spmtgt', 137), me0: +arg('spm0', 175), base: +arg('spmbase', 145),
  amp: +arg('spmamp', 4.5), w: +arg('spmw', 1.9), dur: +arg('stagedur', 11),
} : null;

const MAP = SURF === 'wall' ? WALL : FLOOR;
const src = MAP[STAGE];
if (!src) { console.error(`알 수 없는 화면: ${STAGE}\n  --list 로 목록을 보세요.`); process.exit(1); }

// 대지 원본 비율 — 지면 1600×2670 · 벽 2600×1600
const BASE_W = SURF === 'wall' ? 2600 : 1600;
const BASE_H = SURF === 'wall' ? 1600 : 2670;
const W = +arg('w', BASE_W);
const H = Math.round(W * BASE_H / BASE_W);
// ★ 대지 캔버스는 실시간 예산 때문에 기본 K=0.75 로 그려진다(대지 대비 축소).
//   그대로 뽑으면 2600 출력에 1950 원본을 늘리는 꼴이라 흐리다(실측: 유저 지적).
//   출력보다 크게 그린 뒤 줄인다 — 수퍼샘플링이라 가장자리가 오히려 깨끗해진다.
const UISCALE = Math.min(3, +arg('uiscale', Math.min(3, (W / BASE_W) * 2)));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'newton_ui_'));
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
const tag = `ui_${STAGE}_${W}x${H}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (${W}×${H} · ${FPS}fps · ${DUR}s · 대지 ${BASE_W}×${BASE_H} · 캔버스 배율 ${UISCALE} = ${Math.round(BASE_W * UISCALE)}px)`);

const browser = await puppeteer.launch({
  headless: 'new',
  // ANGLE 백엔드는 OS 마다 다르다 — 맥은 metal, 윈도는 d3d11 (틀리면 소프트웨어로 떨어진다)
  args: ['--no-sandbox', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`,
    '--enable-gpu', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto(`${URLBASE}?dev=1&uiscale=${UISCALE}`, { waitUntil: 'networkidle2', timeout: 180000 });
await page.waitForFunction('!!window.__dbg?.floorGL', { timeout: 120000 });
await new Promise(r => setTimeout(r, 9000));   // 폰트·이미지 준비

await page.evaluate(({ surf, stage, src, w, h }) => {
  const d = window.__dbg;
  const g = surf === 'wall' ? d.wallGL : d.floorGL;
  // ★ 재생 자체를 막는다 — 앱이 매 틱 play() 를 다시 부르므로 pause() 만으론 부족하다.
  //   (HANDOFF-0802 ①. 이 스크립트는 그 수정을 못 받아서 READY 의 코치 카드가 배속됐다.)
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  g.load(stage, { dur: 8, pv: 3, src: `ready-view/${src}?stage=${stage}` });
  // 내보내기 전용 출력 캔버스 — 대지 캔버스를 원하는 해상도로 리샘플해 담는다
  const o = document.createElement('canvas');
  o.width = w; o.height = h; o.id = '__uiout';
  Object.assign(o.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999' });
  document.body.appendChild(o);
  // 워밍업 페인트 — `_pvid` 는 첫 _paint 에서 만들어진다. 미리 만들어 둬야 0번 프레임부터
  //   시크가 걸린다(안 그러면 첫 장만 엉뚱한 시각의 영상이 박힌다).
  g.t = 0; g._lastPaint = -1; g._sig = null; g._paint();
  window.__uiG = g;
}, { surf: SURF, stage: STAGE, src, w: W, h: H });
await new Promise(r => setTimeout(r, 1500));

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  // ★ 시계를 우리가 민다 — 렌더 루프에 의존하지 않으므로 드롭이 원천적으로 없다.
  //   _lastPaint 를 무효화해 UI_FPS 스로틀을 우회하고 매 프레임 새로 그린다.
  const dataUrl = await page.evaluate(async ({ tt, alpha, live }) => {
    const g = window.__uiG;
    // ── 라이브 값 주입 ────────────────────────────────────────────────────────
    //   이 경로는 세션을 안 돌리므로 판이 읽는 노드(spm-me 등)가 비어 '--' 로 그려진다.
    //   판 자체는 2D 캔버스라 값만 넣으면 그대로 그려진다 — 세션 실측 곡선을 프레임마다 먹인다.
    //   숫자는 rollNum 이 오도미터로 굴리고, 편차 눈금 지시선도 그 값에서 파생된다.
    if (live) {
      const set = (id, v) => { const n = g.map.get(id); if (n) n.textContent = String(v); };
      // 실측(2026-08-06 P1 세션): 목표 137 고정 · 내 SPM 175→158→140 수렴 후 143~150 진동
      const TGT = live.tgt;
      let me;
      if (tt < 0.5) me = live.me0;
      else if (tt < 2.8) me = Math.round(live.me0 + (live.base - live.me0) * ((tt - 0.5) / 2.3));
      else me = Math.round(live.base + live.amp * Math.sin((tt - 2.8) * live.w)
                                     + live.amp * 0.45 * Math.sin((tt - 2.8) * live.w * 2.7));
      set('spm-me', me);
      set('spm-tgt', TGT);
      // 진행 아크 — 스테이지 시간 비율. main.js 가 style.width 를 쓰면 그게 우선이다.
      const dn = g.map.get('s-dots');
      if (dn) dn.style.width = String(600 * Math.max(0, Math.min(1, tt / live.dur)));
    }
    // ★ <video> 는 미디어 클록으로 돈다 — 우리가 t 를 밀어도 안 따라온다. 그대로 두면 프레임 한 장
    //   렌더에 걸리는 실제 시간(0.2~0.5s)만큼 영상이 앞질러 가 **인물만 배속**된다.
    //   프레임마다 currentTime 을 직접 찍고, **디코드가 끝날 때까지 기다린다** — 안 기다리면
    //   빈 디코드가 그대로 찍혀 깜빡인다(HANDOFF-0802 ①의 교훈 그대로).
    const v = g._pvid;
    if (v && v.duration > 0) {
      // 정지는 **한 번만**. 매 프레임 부르면 진행 중인 시크를 취소해서 깜빡인다.
      if (!v._expPaused) { v._expPaused = true; v.autoplay = false; try { HTMLMediaElement.prototype.pause.call(v); } catch (e) {} }
      await new Promise(r => {
        let done = false; const fin = () => { if (done) return; done = true; r(); };
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(fin);
        else v.addEventListener('seeked', fin, { once: true });
        v.currentTime = tt % v.duration;   // loop:true 라 나머지로 감는다
        setTimeout(fin, 4000);             // 디코더가 응답 없으면 그냥 진행 — 훅이 멈추면 안 된다
      });
      // ★ 시크 콜백이 왔어도 readyState 가 잠깐 2 아래로 떨어진다. _paint_ready 는
      //   `readyState >= 2 && videoWidth` 일 때만 인물을 그리므로, 그 틈에 그리면 **인물이 통째로
      //   빠진 프레임**이 나온다(실측 08-06: t=1.0·2.0 두 장이 인물 없이 배경만). 게이트가
      //   열릴 때까지 기다린다.
      for (let k = 0; k < 60 && !(v.readyState >= 2 && v.videoWidth); k++)
        await new Promise(r => setTimeout(r, 16));
    }
    g.t = tt; g._lastPaint = -1; g._sig = null;
    g._paint();
    const o = document.getElementById('__uiout');
    const x = o.getContext('2d');
    x.clearRect(0, 0, o.width, o.height);
    if (!alpha) { x.fillStyle = '#000'; x.fillRect(0, 0, o.width, o.height); }
    x.imageSmoothingQuality = 'high';
    x.drawImage(g.canvas, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, { tt: t, alpha: ALPHA, live: LIVE });
  fs.writeFileSync(path.join(TMP, `f${String(i).padStart(5, '0')}.png`),
    Buffer.from(dataUrl.split(',')[1], 'base64'));
  if (i % 20 === 0 || i === N - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${i + 1}/${N}  ${el.toFixed(0)}s  (${(el / (i + 1)).toFixed(3)}s/프레임)   `);
  }
}
process.stdout.write('\n');

// ffmpeg 는 선택 — 에펙 최종물은 PNG 시퀀스다. 없으면 시퀀스만 남긴다.
const hasFF = (() => {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
})();
const made = [];
if (hasFF) {
  const mov = path.join(OUT, `${tag}.mov`);
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
    '-c:v', 'prores_ks', '-profile:v', '4444',
    '-pix_fmt', ALPHA ? 'yuva444p10le' : 'yuv444p10le', mov], { stdio: ['ignore', 'ignore', 'inherit'] });
  // ★ 프리뷰는 **검정 위에 합성해서** 만든다. 알파를 그냥 버리면(구 코드) 글로우가 통째로 깨진다 —
  //   이 글로우는 RGB 는 거의 순수 빨강이고 부드러운 falloff 을 **알파가** 담당한다. 알파를 떼면
  //   그 빨강이 100% 강도로 나타나고 알파 0 지점에서 뚝 잘려, 계단 모양 빨간 판이 된다
  //   (실측 08-06: READY 프리뷰가 상단에 하드 클리핑된 빨간 띠 + 무지개 프린징). PNG·mov 는 멀쩡했다.
  const mp4 = path.join(OUT, `${tag}_preview.mp4`);
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
    '-filter_complex', `color=c=black:s=${W}x${H}:r=${FPS}[bg];[bg][0:v]overlay=shortest=1,`
      + 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-c:v', 'libx264', '-crf', '16', mp4], { stdio: ['ignore', 'ignore', 'inherit'] });
  made.push(mov, mp4);
} else console.log('ⓘ ffmpeg 없음 — PNG 시퀀스만 냅니다(에펙은 이걸 그대로 읽습니다).');

if (ALPHA || !hasFF) {
  const seq = path.join(OUT, `${tag}_png`);
  fs.rmSync(seq, { recursive: true, force: true });
  fs.renameSync(TMP, seq);
  made.unshift(`${seq}${path.sep}  (PNG 시퀀스 ${N}장 · ${W}×${H}${ALPHA ? ' · 알파 보존' : ''})`);
} else fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n✅ ' + made.join('\n   '));
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
