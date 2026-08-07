// 드리블 매트 토큰 **알파 시퀀스** 내보내기 — 합성용.
//   규약은 export_stance_alpha.mjs 와 같다(HANDOFF-0807-STANCE-TOKEN 8절). 새로 만들지 않았다.
//
//   npx vite --port 5401 띄운 상태에서:
//     node scripts/export_mat_alpha.mjs                     # 3840×1080 · 29.97fps · 0~10s
//     node scripts/export_mat_alpha.mjs --mov               # ProRes 4444 로 묶기
//     node scripts/export_mat_alpha.mjs --spot 1 --t1 20    # 때릴 자리 · 길이
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
const OUT = arg('out', 'out/mat_alpha');
const URL = process.env.URL || 'http://127.0.0.1:5401';

const q = new URLSearchParams({ w: W, h: H, bg: 'none', spot: SPOT, loop: 0 });
if (PER != null) q.set('per', PER);

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
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS),
    '-i', path.join(OUT, 'f%04d.png'), '-c:v', 'prores_ks', '-profile:v', '4444',
    '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', mov], { stdio: 'inherit' });
  console.log(`✅ ${mov}  — 에펙에서 알파를 **Straight** 로 해석할 것`);
}
