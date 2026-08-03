// ─────────────────────────────────────────────────────────────
// 실사 배경 영상 프록시 — 무거운 원본을 브라우저가 먹을 수 있는 형태로 바꾼다.
//
//   원본(4096×2160 h264 long-GOP, 100~200MB)을 그대로 물리면 두 가지가 터진다:
//     ① 내보내기는 프레임마다 currentTime 을 찍어 시크한다. long-GOP 는 시크마다 앞
//        키프레임부터 다시 디코드해서 프레임당 수 초가 든다 → 8초 클립이 몇 시간.
//     ② 4096×2160 디코드 버퍼가 GPU 예산을 먹는다. 예산을 넘으면 크롬은 에러 없이
//        조용히 텍스처를 버린다 — '전부 빈 프레임'(HANDOFF-0802 ⑥ 과 같은 증상).
//
//   → 출력 크기로 미리 줄이고 **전 프레임 키프레임(-g 1)** 으로 다시 묶는다. 시크가 즉시 끝난다.
//     화면 미리보기(scenes.html)와 내보내기가 **같은 파일**을 쓰므로 '보이는 대로' 가 성립한다.
//
//   사용:
//     node scripts/make_bg_proxy.mjs --src "C:\...\Pace ON+Boost On _ #2-2.mov" --w 2560
//     node scripts/make_bg_proxy.mjs --src <dir>            폴더 안 .mov 전부
//
//   결과: public/_bg/<이름>_<가로>.mp4  (vite 가 /_bg/... 로 서빙)
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
};
const SRC = String(arg('src', ''));
const W = +arg('w', 2560);
const H = Math.round(W * 9 / 16 / 2) * 2;          // 씬 스테이지는 16:9 (--flat 이 아닌 경로)
const CRF = +arg('crf', 12);                        // docs/SCENE-VIDEO-PIPELINE.md §4 정본값. 전 키프레임이라 용량이 큰 게 정상
if (!SRC || !fs.existsSync(SRC)) { console.error('✗ --src 파일/폴더가 없습니다:', SRC); process.exit(1); }

const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const files = fs.statSync(SRC).isDirectory()
  ? fs.readdirSync(SRC).filter(f => /\.(mov|mp4|mxf|m4v)$/i.test(f)).map(f => path.join(SRC, f))
  : [SRC];

const dir = path.join('public', '_bg');
fs.mkdirSync(dir, { recursive: true });

for (const src of files) {
  // 파일명에 한글·공백·특수문자가 섞여 있다 — URL 로 나가므로 안전한 이름으로 바꾼다.
  const base = path.basename(src).replace(/\.[^.]+$/, '').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');
  const dst = path.join(dir, `${base}_${W}.mp4`);
  if (fs.existsSync(dst) && !arg('force', false)) { console.log(`· 건너뜀(이미 있음): ${path.basename(dst)}`); continue; }
  console.log(`▶ ${path.basename(src)} → ${path.basename(dst)}`);
  const t0 = Date.now();
  execFileSync(FF, ['-y', '-i', src,
    // 원본 4096×2160(17:9)을 16:9 로 — 늘리지 않고 가운데를 잘라 낸다
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    '-an',                                  // 소리는 합성에 안 쓴다
    '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'medium',
    '-g', '1', '-bf', '0',                  // ★ 전 프레임 키프레임 — 프레임 단위 시크가 즉시 끝난다
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  const mb = (fs.statSync(dst).size / 1048576).toFixed(0);
  console.log(`  ✓ ${W}×${H} · ${mb}MB · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  console.log(`  scenes.html BGS 에: ['/_bg/${path.basename(dst)}', '<보일 이름>'],`);
}
