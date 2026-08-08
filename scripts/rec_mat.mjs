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
// ★ HMR 차단 — vite 클라이언트가 붙어 있으면 파일이 하나만 바뀌어도 페이지를 새로고침해
//   캡처 도중 'Execution context was destroyed' 로 죽는다(실측 3회). 녹화엔 HMR 이 필요 없다.
await p.setRequestInterception(true);
p.on('request', r => (/@vite\/client/.test(r.url()) ? r.abort() : r.continue()));
await p.goto(`http://localhost:${PORT}/matcast.html?bg=000&size=${SIZE}&spot=${SPOT}&cb=` + Date.now(),
  { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));                    // 폰트·로고 로드
await p.evaluate(() => document.body.classList.add('rec'));     // 안내 문구 숨김

const N = Math.round(DUR * FPS);
console.log(`▶ ${SIZE}x${SIZE} · ${FPS.toFixed(2)}fps · ${DUR}s = ${N}프레임 · spot ${SPOT} (결정론)`);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  // 페이지 안에서 한 프레임을 **동기로** 그리고 데이터 URL 을 받는다 — rAF·스크린샷 왕복 없음
  const url = await p.evaluate(t => window.__render(t), i / FPS);
  fs.writeFileSync(`${TMP}/${String(i + 1).padStart(5, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  if ((i + 1) % 20 === 0) {
    const el = (Date.now() - t0) / 1000, per = el / (i + 1);
    process.stdout.write(`  ${i + 1}/${N} · ${per.toFixed(2)}s/프레임 · 남은 ${((N - i - 1) * per / 60).toFixed(1)}분   \r`);
  }
}
const el = (Date.now() - t0) / 1000;
console.log(`\n캡처 완료 · 예외 ${errs.length ? errs[0] : '없음'}`);
await b.close();

await new Promise((res, rej) => {
  const f = spawn('ffmpeg', ['-y', '-framerate', String(FPS), '-i', `${TMP}/%05d.png`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', OUT], { stdio: ['ignore','ignore','ignore'] });
  f.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c)));
});
console.log('저장:', OUT);
