// 발 벌리기 토큰 **알파 시퀀스** 내보내기 — 합성용.
//
//   npx vite --port 5199 띄운 상태에서:
//     node scripts/export_stance_alpha.mjs                    # 3840×1080 · 30fps · 0~4.4s
//     node scripts/export_stance_alpha.mjs --blend add        # 야간(가산) 플레이트용
//     node scripts/export_stance_alpha.mjs --w 1920 --h 540   # 절반 해상도
//     node scripts/export_stance_alpha.mjs --mov              # ProRes 4444 로 묶기(ffmpeg)
//
// 왜 export_ui.mjs 가 아니라 이건가
//   export_ui 는 결정론을 위해 **세션을 안 돌린다** — 셋업 막처럼 세션이 만드는 화면은 재현 불가다.
//   export_live_ui 는 세션을 돌리지만 띠 크롭이 없다. stancelab 은 이미 세션과 **같은 곡선**
//   (session.bkB1SetupPose)을 t 로 직접 구동하므로, 세션 없이도 결정론적이고 프레임이 정확하다.
//   랩에서 본 그 화면이 그대로 나온다 — 랩과 산출물이 다른 코드를 타면 반드시 어긋난다.
//
// 알파가 왜 성립하나
//   렌더러가 alpha:true 이고 내보내기 모드는 배경을 안 깐다 → 캔버스 알파가 곧 투사광의 커버리지다.
//   toDataURL('image/png') 은 **straight alpha** 를 준다(에펙에서 Straight 로 해석할 것 —
//   Premultiplied 로 잡히면 가산광 가장자리가 검게 먹는다. ae_import.jsx 가 밟은 그 함정).
//   ★ 잉크(기본)와 가산(--blend add)은 합성 방식이 다르다:
//     잉크  = 밝은 바닥(주간). 레이어를 Normal 로 얹는다.
//     가산  = 어두운 실내·야간. 레이어를 Add 로 얹는다.
//   플레이트 밝기를 보고 고른다 — 밝은 판에 가산을 쏘면 씻겨 안 보인다.
//
// 목표 판 규격(실측, tmp_measure_plate 기준)
//   03-[농구]합성전.mp4 = 3840×2160 · 30fps. 실사/띠 솔기 y=1080 = **정확히 화면 절반**.
//   띠 3840×1080 = 3.556:1 — 이 리포가 계산한 프레임(3.561:1)과 사실상 같다.
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);

const W = +arg('w', 3840), H = +arg('h', 1080);
const FPS = +arg('fps', 30);
const T0 = +arg('t0', 0), T1 = +arg('t1', 4.4);      // 셋업 막: 대기 → 벌림 → Success → 퇴장
const BLEND = arg('blend', 'ink');
const PITCH = arg('pitch', null);                     // 기본은 정본(-55°) — 랩 슬라이더 초기값
const OUT = arg('out', 'out/stance_alpha');
const URL = process.env.URL || 'http://127.0.0.1:5199';

// ★ 래스터 품질 — 추출 경로는 FXQ 를 올린다(fx-core FXQ 주석: "추출 경로만 이 값을 올린다").
//   이 스크립트가 fxq 를 안 넘겨서 08-07 추출분이 전부 실시간 기본값 1 로 뽑혔다.
//   글리프 래스터 512→512k · 마크 글리프 캔버스 128→128k · 발 실루엣 SDF 768→768k.
const FXQ = arg('fxq', 3);
const q = new URLSearchParams({ w: W, h: H, blend: BLEND, fxq: FXQ });
if (PITCH != null) q.set('pitch', PITCH);

fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.setViewport({ width: Math.min(W, 1920), height: Math.min(H, 1080) });
await p.goto(`${URL}/stancelab.html?${q}`, { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!window.__shot', { timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));          // 글리프·LUT 도착 대기(랩이 기다리지만 여유)

if (PITCH != null) await p.evaluate(v => {
  const s = document.getElementById('s-p'); s.value = v; s.dispatchEvent(new Event('input'));
}, PITCH);

const n = Math.round((T1 - T0) * FPS) + 1;
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const t = T0 + i / FPS;
  const url = await p.evaluate(tt => window.__shot(tt), t);
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(4, '0')}.png`),
    Buffer.from(url.split(',')[1], 'base64'));
  if ((i + 1) % 15 === 0 || i === n - 1)
    process.stdout.write(`\r  ${i + 1}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s  `);
}
await b.close();
console.log(`\n✅ ${OUT}  (${W}×${H} · ${FPS}fps · ${T0}~${T1}s · ${BLEND})`);

if (has('mov')) {
  // ProRes 4444 = 알파를 들고 갈 수 있는 코덱. -alpha_bits 16, 프로파일 4444.
  const mov = OUT + '.mov';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS),
    '-i', path.join(OUT, 'f%04d.png'), '-c:v', 'prores_ks', '-profile:v', '4444',
    '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', mov], { stdio: 'inherit' });
  console.log(`✅ ${mov}  — 에펙에서 알파를 **Straight** 로 해석할 것`);
}
