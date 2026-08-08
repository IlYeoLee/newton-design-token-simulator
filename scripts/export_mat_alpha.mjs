// 드리블 매트 토큰 **알파 시퀀스** 내보내기 — 합성용.
//   규약은 export_stance_alpha.mjs 와 같다(HANDOFF-0807-STANCE-TOKEN 8절). 새로 만들지 않았다.
//
//   npx vite --port 5401 띄운 상태에서:
//     node scripts/export_mat_alpha.mjs                     # 3840×1080 · 29.97fps · 0~10s
//     node scripts/export_mat_alpha.mjs --mov               # ProRes 4444 로 묶기
//     node scripts/export_mat_alpha.mjs --spot 1 --t1 20    # 때릴 자리 · 길이
//     node scripts/export_mat_alpha.mjs --bg 000 --mov      # 검정 배경(Add 합성용, h264)
//
// 왜 검은 배경 mp4 가 아니라 이건가 (유저: 기본 3D 레이어 살리면서 가져오라고)
//   검정으로 구워 버리면 ① 알파가 없어 실사 위에 못 얹고 ② 원근을 픽셀에 박아 넣어 AE 카메라가
//   할 일이 사라진다. 리포 규약은 **평면 알파로 뽑고 AE 3D 레이어(X회전 90° 지면)에 얹는 것**이다.
//   그래야 ae_stance_tilt.jsx 가 세운 카메라(눈높이 1.69m · 하향 −55°)의 원근이 그대로 걸린다.
//
// 알파
//   toDataURL('image/png') = **straight alpha**. 에펙에서 Straight 로 해석할 것 —
//   Premultiplied 로 잡히면 가산광 가장자리가 검게 먹는다(ae_import.jsx 가 밟은 함정).
//   내보내기 URL 은 bg=none 이라 배경을 안 깐다 → 캔버스 알파가 곧 투사광 커버리지다.
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);

const W = +arg('w', 3840), H = +arg('h', 1080);      // 목표 판 띠 — 실측 3840×1080 (화면 정확히 절반)
const FPS = +arg('fps', 30000 / 1001);               // 소스 클립과 같은 29.97
const T0 = +arg('t0', 0), T1 = +arg('t1', 10);
const SPOT = +arg('spot', 1);                        // 실측: 공이 몸 중심 좌 28cm → 1번
const PER = arg('per', null);                        // 기본은 공 추적 실측 0.467
// ★ 배경 — 두 경로 다 정당하다(HANDOFF-0807-STANCE-TOKEN 8절).
//   none : straight alpha. 밝은 바닥에 Normal 로 얹는다. 문턱을 추측할 일이 없다.
//   000  : 검정. **Add 합성**이면 이게 맞다 — 가산에서 검정 = 빛 없음 = 안 보임이라
//          알파 없이 그대로 얹힌다. alpha_floor.mjs 로 사후에 깎을 수도 있다.
const BG = arg('bg', 'none');
// ★ 여백 — matcast 의 ?pad. 넘기지 않아 기본 0.72 로만 뽑히고 있었다(2026-08-07).
//   pad 는 '매트를 프레임의 몇 배로 그리나'다. 나머지 띠가 수축 링(1.9R)·플래시(3.3R)가
//   뻗을 자리다 — 실측(2048² · 55프레임): 0.72 → 여백 11.3%, 0.58 → 18.6%. 둘 다 잘림 0.
const PAD = arg('pad', null);
const OUT = arg('out', BG === 'none' ? 'out/mat_alpha' : 'out/mat_' + BG);
const URL = process.env.URL || 'http://127.0.0.1:5401';

// ★ 래스터 품질 — 추출 경로는 FXQ 를 올린다(export_stance_alpha 와 같은 이유·같은 규약).
const FXQ = arg('fxq', 3);
const q = new URLSearchParams({ w: W, h: H, bg: BG, spot: SPOT, loop: 0, fxq: FXQ });
if (PER != null) q.set('per', PER);
if (PAD != null) q.set('pad', PAD);

fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.setViewport({ width: Math.min(W, 1920), height: Math.min(H, 1080) });
// HMR 차단 — 파일 하나만 바뀌어도 새로고침해 캡처가 죽는다(실측 3회)
await p.setRequestInterception(true);
p.on('request', r => (/@vite\/client/.test(r.url()) ? r.abort() : r.continue()));
await p.goto(`${URL}/matcast.html?${q}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction('!!window.__shot', { timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));          // 폰트·로고 도착 대기

const n = Math.round((T1 - T0) * FPS) + 1;
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const url = await p.evaluate(tt => window.__shot(tt), T0 + i / FPS);
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(4, '0')}.png`),
    Buffer.from(url.split(',')[1], 'base64'));
  if ((i + 1) % 20 === 0 || i === n - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${i + 1}/${n}  ${el.toFixed(0)}s  남은 ${((n - i - 1) * el / (i + 1) / 60).toFixed(1)}분  `);
  }
}
await b.close();
console.log(`\n✅ ${OUT}  (${W}×${H} · ${FPS.toFixed(2)}fps · ${T0}~${T1}s · spot ${SPOT})`);

if (has('mov')) {
  const mov = OUT + '.mov';
  // 검정 배경이면 알파가 필요 없다 — h264 로 가볍게. 알파면 ProRes 4444.
  const args = BG === 'none'
    ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16']
    : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow'];
  const dst = BG === 'none' ? mov : OUT + '.mp4';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS),
    '-i', path.join(OUT, 'f%04d.png'), ...args, dst], { stdio: 'inherit' });
  console.log(`✅ ${dst}` + (BG === 'none' ? '  — 에펙에서 알파를 **Straight** 로 해석할 것'
                                          : '  — Add 로 얹을 것(검정 = 빛 없음)'));
}
