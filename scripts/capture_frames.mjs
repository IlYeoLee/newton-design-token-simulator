// ─────────────────────────────────────────────────────────────
// 헤드리스 결정적 프레임 캡처 — 시뮬 봇을 "정답을 아는 영상"으로
//
//   유저 브라우저 탭은 hidden이면 rAF가 죽고, 유저 조작이 계측을 오염시킴
//   → puppeteer 헤드리스에서 state.time을 1/fps씩 고정 스텝하며 캡처.
//
//   사용: node scripts/capture_frames.mjs [--expert] [--fps 30] [--dur 3.2]
//         [--url http://localhost:5199/] [--out /tmp/frames]
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const arg = (k, dflt) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? dflt : (process.argv[i + 1]?.startsWith('--') || !process.argv[i + 1] ? true : process.argv[i + 1]);
};
const URL = arg('url', 'http://localhost:5199/');
const FPS = +arg('fps', 30);
const DUR = +arg('dur', 3.2);
const OUT = arg('out', '/tmp/newton_frames');
const EXPERT = !!arg('expert', false);

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1280,720'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction('!!window.__dbg', { timeout: 20000 });
await new Promise(r => setTimeout(r, 800));   // 에셋 로드 여유

if (EXPERT) {
  await page.evaluate(() => {
    const btn = document.getElementById('run-expert');
    if (btn && !btn.classList.contains('active')) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));
}

// 좌패널 숨김 — 순수 3D 장면만 (포즈 추출 입력)
await page.evaluate(() => {
  document.getElementById('panel')?.style.setProperty('display', 'none');
  window.__dbg.state.playing = false;
});

// --side: 측면 카메라 (monocular 포즈 추출은 측면이 정석 — 후면 3/4는 반대발 오클루전)
if (arg('side', false)) {
  await page.evaluate(() => {
    const { camera, controls } = window.__dbg;
    camera.position.set(4.2, 1.4, -1.2);   // 러너 우측면, 무릎높이 약간 위
    controls.target.set(0, 0.9, -1.2);
    controls.update();
  });
}

const meta = await page.evaluate(() => ({
  pack: window.__dbg.state.packs[window.__dbg.state.pack].packName,
  strikes: (window.__dbg.xbot._lastPack?.[1] || []).filter(e => e.foot).map(e => ({ t: e.t, foot: e.foot })),
}));

const N = Math.round(DUR * FPS);
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  await page.evaluate(tt => new Promise(res => {
    window.__dbg.state.time = tt;
    requestAnimationFrame(() => requestAnimationFrame(res));
  }), t);
  await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(4, '0')}.jpg`), quality: 80, type: 'jpeg' });
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ ...meta, fps: FPS, dur: DUR }, null, 2));
console.log(`캡처 ${N}프레임 → ${OUT}  (팩: ${meta.pack}, 접지 ${meta.strikes.length}건)`);
await browser.close();
