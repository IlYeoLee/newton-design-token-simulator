// 라이브 세션의 지면 UI 캔버스를 알파 보존으로 뽑는다 — '실제로 그 상태로 돌고 있는' 구간 전용.
//
//   export_ui.mjs 와 다른 점: 그 스크립트는 세션을 **돌리지 않고** 시계를 직접 밀어 결정론을 얻는다.
//   그래서 관찰(프리뷰) 구간처럼 **세션 상태가 만드는 화면**은 재현이 안 된다(유저: 0/2 링이 도는
//   5초를 뽑아 달라 → export_ui 로는 빈 알약·엉뚱한 숫자가 나왔다).
//   여기서는 앱을 그대로 돌리고, 원하는 스테이지·조건이 될 때까지 기다린 뒤 프레임을 긁는다.
//
//   사용: node scripts/export_live_ui.mjs --stage BK_B5 --dur 5 --fps 30 --w 2048 [--wait-loops 1]
//     --wait-loops N   관찰 재생 횟수가 N 이 될 때까지 기다린다(1 = '1/2' 로 도는 구간)
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const STAGE = arg('stage', 'BK_B5'), DUR = +arg('dur', 5), FPS = +arg('fps', 30);
const W = +arg('w', 2048), WAIT = +arg('wait-loops', 1), OUT = arg('out', 'out');
const PIN = process.argv.includes('--pin-loops') ? +arg('pin-loops', 1) : null;   // 관찰 상태 고정
const N = Math.round(DUR * FPS);
const HEADED = process.argv.includes('--headed');   // 코치 mp4 가 실제로 재생돼야 관찰 구간이 재현된다
const b = await puppeteer.launch({ headless: HEADED ? false : 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:5199/?dev=1&uiscale=2', { waitUntil: 'networkidle2', timeout: 180000 });
await p.waitForFunction('!!window.__dbg?.floorGL && !!window.__dbg?.session', { timeout: 120000 });
await new Promise(r => setTimeout(r, 8000));
// 농구 팩 → 세션 시작 → 목표 스테이지까지 강제 전진
await p.evaluate(async (stage) => {
  const d = window.__dbg, s = d.session;
  [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '농구')?.click();
  await new Promise(r => setTimeout(r, 1500));
  document.getElementById('btn-session')?.click();
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 20 && s.stages[s.stageIdx].id !== stage; i++) { s.next(true); await new Promise(r => setTimeout(r, 400)); }
}, STAGE);
// 관찰 재생 횟수가 목표에 닿을 때까지 대기 — 이게 '1/2 로 돌고 있다'의 정의다
await p.waitForFunction((n) => (window.__dbg.session._pvLoops ?? 0) >= n, { timeout: 120000, polling: 200 }, WAIT);
const info = await p.evaluate(() => ({ stage: window.__dbg.session.stages[window.__dbg.session.stageIdx].id,
  loops: window.__dbg.session._pvLoops, cw: window.__dbg.floorGL.ctx.canvas.width, ch: window.__dbg.floorGL.ctx.canvas.height }));
console.log('  기점:', JSON.stringify(info));
const H = Math.round(W * info.ch / info.cw);
const dir = path.join(OUT, `live_${STAGE}_${W}x${H}p${FPS}_png`);
fs.mkdirSync(dir, { recursive: true });
for (let i = 0; i < N; i++) {
  const url = await p.evaluate(({ w, h, pin }) => {
    // ★ 관찰 상태 **고정**(--pin-loops) — 헤들리스엔 코치 영상이 디지드되지 않아 관찰 구간이
    //   숬식간에 끝난다(실재: loops 1 지후 모프). 그런데 유저가 원하는 건 '그 콴포넌트가 1/2 에서
    //   **도는** 5초' 다. 링의 회전은 시간 구동(prog = 1 − (t % per)/per)이라 영상과 무관하게
    //   계속 돌므로, 재생 횜수와 관찰 플래그만 붙잡아 두면 그 구간이 그대로 재현된다.
    if (pin != null) {
      const s = window.__dbg.session, g = window.__dbg.floorGL;
      s._pvLoops = pin; s.demoActive = true;
      // ★ 핀을 세운 **뒤 다시 그린다** — 캔버스는 이미 지난 프레임에 그려져 있어서, 플래그만
      //   바꾸고 읽으면 아무 효과가 없다(실측: 핀을 걸어도 헤더가 계속 찍혔다).
      //   앱의 UI 스로틀도 우회한다(export_ui 와 같은 규약).
      g._lastPaint = -1; g._sig = null; g._paint();
    }
    const src = window.__dbg.floorGL.ctx.canvas;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const g = o.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
    return o.toDataURL('image/png');
  }, { w: W, h: H, pin: PIN });
  fs.writeFileSync(path.join(dir, `f${String(i).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  await new Promise(r => setTimeout(r, 1000 / FPS));
  if ((i + 1) % 30 === 0) process.stdout.write(`\r  ${i + 1}/${N}  `);
}
await b.close();
const mov = path.join(OUT, `live_${STAGE}_${W}x${H}p${FPS}.mov`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.png'),
  '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', mov]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.png'),
  '-vf', 'scale=720:-2', '-pix_fmt', 'yuv420p', mov.replace('.mov', '_preview.mp4')]);
console.log(`\n✅ ${dir}/  (PNG ${N}장 · ${W}×${H} · 알파)\n   ${mov}\n   ${mov.replace('.mov','_preview.mp4')}`);
