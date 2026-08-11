// 장시간 열화 기제 실측 — 가짜 시계로 '기동 N시간 후'를 즉시 재현해 비교한다.
//   조건: A 기준(0h) · B 시계 +4h(셰이더 uTime 정밀도) · C 시계 +4h + 러닝 루프 누적(좌표 정밀도)
//   지표: FPS · 연속 2프레임 픽셀 차(정지 요소 지터 — 클수록 흔들린다) · 스크린샷
import puppeteer from 'puppeteer';
import { PNG } from 'pngjs';
import { readFileSync } from 'fs';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const SHOT = (process.env.TEMP || '.').replace(/\\/g, '/') + '/';

async function run(tag, offsetSec, bigLoop) {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 720 });
  if (offsetSec) {
    await p.evaluateOnNewDocument((off) => {
      const orig = performance.now.bind(performance);
      performance.now = () => orig() + off * 1000;
    }, offsetSec);
  }
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForFunction(() => window.__sess && window.__dbg, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  // 러닝 세션 → P3 고정 (파동·페이스 라이트·발자국이 다 사는 장면)
  await p.evaluate(() => {
    document.querySelector('[data-pack=running]')?.click() || [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '러닝')?.click();
  });
  await new Promise(r => setTimeout(r, 1800));
  await p.evaluate(() => document.getElementById('btn-session')?.click());
  await new Promise(r => setTimeout(r, 1200));
  await p.evaluate(() => {
    const s = window.__sess;
    const i = s.stages.findIndex(x => x.id === 'P3');
    if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); s.t = 5; }
  });
  if (bigLoop) {
    await p.evaluate(() => {
      const D = window.__dbg;
      // 4시간 연속 재생 등가 — 루프 누적을 직접 주입(러닝 z = -V·t 영원 전진 경로)
      D.state.loop = 900;                      // 팩 duration ~16s × 900 ≈ 4h
      D.state.time = 10;
    });
  }
  await new Promise(r => setTimeout(r, 2500));
  const fps = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(Math.round(n / 1.5)); };
    requestAnimationFrame(tick);
  }));
  // 연속 프레임 페어 3장 — 정지 배경 포함 전체 픽셀 차 평균(지터 지표)
  const diffs = [];
  for (let i = 0; i < 3; i++) {
    const f1 = `${SHOT}lr_${tag}_${i}a.png`, f2 = `${SHOT}lr_${tag}_${i}b.png`;
    await p.screenshot({ path: f1 });
    await new Promise(r => setTimeout(r, 90));
    await p.screenshot({ path: f2 });
    const A = PNG.sync.read(readFileSync(f1)), B = PNG.sync.read(readFileSync(f2));
    let sum = 0; const n = A.width * A.height;
    for (let j = 0; j < n * 4; j += 4) sum += Math.abs(A.data[j] - B.data[j]) + Math.abs(A.data[j + 1] - B.data[j + 1]) + Math.abs(A.data[j + 2] - B.data[j + 2]);
    diffs.push(+(sum / n).toFixed(2));
    await new Promise(r => setTimeout(r, 400));
  }
  const stage = await p.evaluate(() => window.__sess.stage);
  console.log(`${tag}: fps=${fps} frameDiff=[${diffs.join(', ')}] stage=${stage}`);
  await b.close();
}

await run('base', 0, false);
await run('t4h', 4 * 3600, false);
await run('t4h_loop', 4 * 3600, true);
console.log('완료 — 스크린샷: %TEMP%/lr_*.png');
