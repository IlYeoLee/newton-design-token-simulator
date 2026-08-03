// 코치 클립의 '머리 위치'를 프레임 단위로 구워 낸다 → public/ghost/<이름>.face.json
//
// 왜 필요한가: 인물 셰이더의 얼굴 은닉이 uv.y 고정 밴드(smoothstep(0.56,0.96,uv.y))였다.
//   머리가 늘 화면 위쪽에 있다는 가정인데, 회피 슬립처럼 깊게 웅크리는 클립은 머리가
//   uv.y 0.65 까지 내려간다 — 거기선 마스크가 거의 0 이라 이목구비가 그대로 드러난다
//   (유저 08-03: "인물이 아래로 내려가면서 이목구비 가려지는 게 다 드러나 버렸어").
//   그래서 밴드 대신 '추적된 머리 타원'으로 가린다. 이 스크립트가 그 좌표를 만든다.
//
//   node scripts/bake_face_track.mjs public/ghost/bx_b2_slip.mp4
//
// 좌표계 = 영상 정규좌표(0..1), x 는 오른쪽 +, y 는 **아래쪽 +**(이미지 규약).
//   런타임에서 패널 uv 로 바꾸는 건 main.js 가 한다(uCropC/uCropS 를 아는 쪽이 거기라서).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const FF = createRequire(import.meta.url)('ffmpeg-static');
const SRC = process.argv[2];
if (!SRC) { console.error('사용: node scripts/bake_face_track.mjs <clip.mp4>'); process.exit(1); }
const FPS = 24, W = 180, H = 320;
const tmp = mkdtempSync(path.join(tmpdir(), 'face-'));
const raw = path.join(tmp, 'v.rgb');
execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-i', SRC,
  '-vf', `fps=${FPS},scale=${W}:${H}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', raw]);
const buf = readFileSync(raw), N = buf.length / (W * H * 3);

const rows = [];
for (let f = 0; f < N; f++) {
  const off = f * W * H * 3, m = new Uint8Array(W * H);
  let bot = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = off + (y * W + x) * 3;
    if (buf[i + 1] > 90 && buf[i + 1] - buf[i] > 40 && buf[i + 1] - buf[i + 2] > 40) continue;
    m[y * W + x] = 1; if (y > bot) bot = y;
  }
  let top = -1;
  for (let y = 0; y < H && top < 0; y++) { let c = 0; for (let x = 0; x < W; x++) c += m[y * W + x]; if (c >= 3) top = y; }
  if (top < 0 || bot <= top) { rows.push(rows[rows.length - 1] || { x: 0.5, y: 0.2, r: 0.1 }); continue; }
  const hgt = bot - top;
  // 머리 = 정수리부터 인물 높이의 14%. 얼굴은 그 안에 다 들어온다.
  const band = Math.max(2, Math.round(hgt * 0.14));
  let sx = 0, sn = 0;
  const runs = [];
  for (let y = top; y < Math.min(H, top + band); y++) {
    let run = 0, best = 0;
    for (let x = 0; x < W; x++) {
      if (m[y * W + x]) { sx += x; sn++; run++; if (run > best) best = run; } else run = 0;
    }
    if (best > 0) runs.push(best);
  }
  runs.sort((a, b) => a - b);
  const hw = runs[Math.floor(runs.length / 2)] || 1;      // 머리 폭 중앙값
  rows.push({
    x: +((sx / sn) / W).toFixed(4),                       // 머리 중심 x
    y: +((top + band * 0.5) / H).toFixed(4),              // 머리 중심 y (아래로 +)
    r: +((hw / 2) / W).toFixed(4),                        // 머리 반폭
    h: +(band / H).toFixed(4),                            // 머리 밴드 높이
  });
}
const out = SRC.replace(/\.mp4$/i, '.face.json');
writeFileSync(out, JSON.stringify({ fps: FPS, n: N, note: '머리 추적 — 영상 정규좌표(y 아래로 +)', rows }));
const rs = rows.map(r => r.r), ys = rows.map(r => r.y);
console.log(`${path.basename(SRC)} · ${N}프레임 @${FPS}fps → ${path.basename(out)}`);
console.log(`  머리 중심 y ${Math.min(...ys).toFixed(3)}~${Math.max(...ys).toFixed(3)}  (고정 밴드가 못 따라가던 범위)`);
console.log(`  머리 반폭   ${Math.min(...rs).toFixed(3)}~${Math.max(...rs).toFixed(3)}`);
