// 뽑기 전 검수 — 씬마다 루프 전체를 한 장의 컨택트 시트로.
//
//   왜: 14분짜리 렌더를 끝내고 나서 "구버전이네 / 이거 아닌데"를 아는 건 너무 비싸다.
//   같은 서버·같은 씬·같은 가상 시계로 몇 컷만 찍어 보면 30초 안에 갈린다.
//   ★ 익스포터와 **같은 경로**(?dev=1&scene=)로 띄우므로, 여기서 보이는 게 뽑히는 것이다.
//
//   사용:
//     node scripts/preview_scenes.mjs                  # 5씬 전부
//     node scripts/preview_scenes.mjs --only BX_C3     # 하나만
//     node scripts/preview_scenes.mjs --n 12           # 컷 수(기본 8)
//
//   결과: out/PREVIEW/<씬ID>.png  — 루프를 균등 분할한 컷을 가로로 이어 붙인 시트.
//   끝나면 폴더를 열어 준다.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5200/');
const ONLY = arg('only', '');
const N = +arg('n', 8);
const OUT = arg('out', 'out/PREVIEW');
const W = 1280;   // 검수용 — 빠르게. 뽑을 때 해상도와 무관하게 배치·색·문구는 그대로다.

// run_boxing_scenes.mjs 와 같은 목록·같은 루프 주기
const SCENES = [
  { id: 'BX_READY', dur: 8.00,  title: 'Bring the Ring Home' },
  { id: 'BX_A1',    dur: 12.08, title: 'NECK & SHOULDER ROLLS' },
  { id: 'BX_B2',    dur: 10.50, title: 'SLIP & EVADE' },
  { id: 'BX_C1',    dur: 9.00,  title: 'Round 1 of 6' },
  { id: 'BX_C3',    dur: 9.00,  title: 'COMBINATION' },
].filter(s => !ONLY || s.id === ONLY);

fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'newton_prev_'));

console.log(`검수 — ${SCENES.length}씬 × ${N}컷 · 서버 ${URL}\n`);

const browser = await puppeteer.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

for (const s of SCENES) {
  process.stdout.write(`  ${s.id.padEnd(9)} ${s.title.padEnd(24)} … `);
  const p = await browser.newPage();
  await p.setCacheEnabled(false);          // 캐시 때문에 구버전을 보는 일이 없게
  await p.setViewport({ width: W, height: Math.round(W * 1600 / 2600) });
  await p.evaluateOnNewDocument(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get() { return false; }, configurable: true });
  });
  await p.goto(`${URL}index.html?dev=1&uiscale=1&scene=${s.id}`, { waitUntil: 'networkidle2', timeout: 120000 });
  await p.waitForFunction('!!window.__dbg?.session', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 11000));   // 에셋·클립 로드

  const shots = [];
  for (let i = 0; i < N; i++) {
    const tt = (i + 0.5) * (s.dur / N);
    await p.evaluate(async t => {
      window.__vt = 1200 + t * 1000;
      const d = window.__dbg;
      d.state.playing = false; d.state.time = t;
      if (d.session?.active) d.session.t = t;
      const v = d.demoVideo;
      if (v && isFinite(v.duration) && v.duration > 0) {
        const want = v.loop ? (t % v.duration) : Math.min(t, v.duration);
        await new Promise(r => {
          let done = false; const fin = () => { if (!done) { done = true; r(); } };
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(fin);
          else v.addEventListener('seeked', fin, { once: true });
          v.currentTime = want; setTimeout(fin, 3000);
        });
      }
      await new Promise(r => requestAnimationFrame(() => { window.__isolate3d?.(); window.__fitFlat?.(); requestAnimationFrame(r); }));
    }, tt);
    const f = path.join(TMP, `${s.id}_${String(i).padStart(2, '0')}.png`);
    await p.screenshot({ path: f });
    shots.push(f);
  }
  await p.close();

  // 가로로 이어 붙인다 — 시간 흐름이 왼쪽에서 오른쪽으로 읽히게
  const sheet = path.join(OUT, `${s.id}.png`);
  const cols = Math.min(4, N), rows = Math.ceil(N / cols);
  execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(TMP, `${s.id}_%02d.png`),
    '-vf', `scale=640:-1,tile=${cols}x${rows}`, '-frames:v', '1', '-y', sheet]);
  console.log(`✓ ${path.basename(sheet)}`);
}

await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });

console.log(`\n${OUT} 에 저장했습니다. 눈으로 확인한 뒤 뽑으세요:`);
console.log('  npm run export:boxing');
try { execFileSync('explorer.exe', [path.resolve(OUT)]); } catch { /* 폴더 열기 실패는 무시 */ }
