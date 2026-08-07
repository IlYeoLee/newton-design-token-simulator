// 매트 녹화 — **결정론 렌더**. 실시간이 아니라 고정 시간 스텝으로 한 프레임씩 그린다.
//   리포 규약과 같은 식: t = i / FPS (export_ui.mjs 참고). 렌더러가 느려도 프레임이 안 빠진다.
//   실시간 스크린캐스트는 헤드리스 소프트 렌더러에서 12fps 로 떨어졌다(실측) — 한 박 0.467s 에
//   5.6프레임, 임팩트 플래시 0.22s 는 2프레임이라 사라졌다.
//   사용: node scripts/rec_mat.mjs [초] [size] [fps] [port]
import puppeteer from 'puppeteer';
import fs from 'fs';
import { spawn } from 'child_process';
const OUT  = process.env.OUT || '/Users/iil-yeo/Desktop/mat-black.mp4';
const DUR  = +(process.argv[2] || 10);
const SIZE = +(process.argv[3] || 1080);
const FPS  = +(process.argv[4] || 30000 / 1001);   // 소스 클립과 같은 29.97
const SPOT = +(process.argv[5] || 1);              // 때릴 자리 — 실측: 공이 몸 중심 좌 28cm → 1번
const PORT = +(process.argv[6] || 5401);
const TMP  = '/private/tmp/claude-501/-Users-iil-yeo/470bab8d-790a-4a73-a1f4-7b8eaed4ec18/scratchpad/recf';
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });

const b = await puppeteer.launch({ protocolTimeout: 600000,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: SIZE, height: SIZE });
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await p.goto(`http://localhost:${PORT}/matcast.html?bg=000&size=${SIZE}&spot=${SPOT}&cb=` + Date.now(),
  { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));                    // 폰트·로고 로드
await p.evaluate(() => document.body.classList.add('rec'));     // 안내 문구 숨김

const N = Math.round(DUR * FPS);
const cv = await p.$('#cv');
console.log(`▶ ${SIZE}x${SIZE} · ${FPS.toFixed(2)}fps · ${DUR}s = ${N}프레임 (결정론)`);
for (let i = 0; i < N; i++) {
  // 시각을 밀고 **그 프레임이 실제로 그려질 때까지** 기다린다 — 안 기다리면 이전 그림을 찍는다
  await p.evaluate(t => { window.__t = t; }, i / FPS);
  await p.evaluate(() => new Promise(r => {
    const n0 = window.__drawn; const tick = () => window.__drawn > n0 + 1 ? r() : requestAnimationFrame(tick); tick();
  }));
  await cv.screenshot({ path: `${TMP}/${String(i + 1).padStart(5, '0')}.png`, captureBeyondViewport: false });
  if ((i + 1) % 30 === 0) process.stdout.write(`  ${i + 1}/${N}\r`);
}
console.log(`\n캡처 완료 · 예외 ${errs.length ? errs[0] : '없음'}`);
await b.close();

await new Promise((res, rej) => {
  const f = spawn('ffmpeg', ['-y', '-framerate', String(FPS), '-i', `${TMP}/%05d.png`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', OUT], { stdio: ['ignore','ignore','ignore'] });
  f.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c)));
});
console.log('저장:', OUT);
