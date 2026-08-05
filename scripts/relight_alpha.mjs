// 투명 플레이트의 '탁한 자락' 제거 — 알파를 빛으로 다시 인코딩한다.
//
//   왜 탁해지나: 알파 오버는  결과 = C·a + 배경·(1-a)  다.
//   C 가 어두우면 **배경을 어둡게 칠한다.** 그런데 투사광은 어둡게 만들 수 없다 —
//   블룸의 바깥 자락(어두운 적갈색)이 밝은 바닥 위에서 때처럼 낀다(유저: "안 이쁘네").
//   `--alphagamma 0.5` 는 그 어두운 자락의 알파를 오히려 **들어올려서** 더 심하게 만든다.
//
//   고치는 법: 색을 휘도로 정규화해 '최대 밝기의 그 색'으로 저장하고, 알파 = 휘도로 둔다.
//     결과 = (C/L)·L + 배경·(1-L) = C + 배경·(1-L)
//   가산(배경 + C)에 가장 가까운 오버 합성이다. 어두운 픽셀은 알파가 낮아 거의 안 칠하고,
//   칠하더라도 밝은 색이라 바닥을 더럽히지 않는다.
//
//   AE 블렌딩 모드로는 안 된다(실측): Add 는 밝은 바닥에서 통째로 날아가고,
//   Screen 은 파문이 사라질 만큼 옅어진다. 알파를 고치는 게 맞다.
//
//   사용:
//     node scripts/relight_alpha.mjs <PNG시퀀스 폴더> [--out 폴더] [--gain 1] [--keep 0.30]
//
//     --gain  파문 세기 (1 = 그대로, 1.3 = 진하게)
//     --keep  이 휘도 위는 원래 색·밀도를 지킨다(인물이 너무 옅어지면 올린다. 0 = 전부 빛으로)

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('PNG 시퀀스 폴더를 주세요'); process.exit(1); }
const OUT = arg('out', SRC.replace(/[\\/]$/, '') + '_relit');
const GAIN = +arg('gain', 1) || 1;
const KEEP = +arg('keep', 0.30);

const files = fs.readdirSync(SRC).filter(f => /\.png$/i.test(f)).sort();
if (!files.length) { console.error('PNG 이 없습니다'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// 크기는 첫 장에서 읽는다
const dim = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(SRC, files[0])]).toString().trim().split(',');
const W = +dim[0], H = +dim[1];
const TMP_I = path.join(OUT, '_i.raw'), TMP_O = path.join(OUT, '_o.raw');
console.log(`${files.length}장 · ${W}×${H} · gain ${GAIN} · keep ${KEEP}`);

const t0 = Date.now();
for (let n = 0; n < files.length; n++) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SRC, files[n]),
    '-pix_fmt', 'rgba', '-f', 'rawvideo', TMP_I]);
  const P = fs.readFileSync(TMP_I);
  for (let i = 0; i < W * H; i++) {
    const q = i * 4, r = P[q], g = P[q + 1], b = P[q + 2];
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (l < 1e-4) { P[q] = P[q + 1] = P[q + 2] = P[q + 3] = 0; continue; }
    // KEEP 위쪽(밝은 본체=인물·마크)은 손대지 않는다. 아래쪽(자락)만 빛으로 정규화.
    const w = l >= KEEP ? 0 : 1 - l / KEEP;
    const kMax = Math.min(255 / Math.max(r, g, b, 1), 1 / l);
    const k = 1 + w * (kMax - 1);
    const a = w * l + (1 - w) * Math.pow(l, 0.5);   // 자락 = 휘도, 본체 = 기존 감마0.5 유지
    P[q] = Math.min(255, r * k); P[q + 1] = Math.min(255, g * k); P[q + 2] = Math.min(255, b * k);
    P[q + 3] = Math.max(0, Math.min(255, Math.round(a * GAIN * 255)));
  }
  fs.writeFileSync(TMP_O, P);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
    '-s', `${W}x${H}`, '-i', TMP_O, path.join(OUT, files[n])]);
  if ((n + 1) % 20 === 0 || n === files.length - 1) {
    const s = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${n + 1}/${files.length}  ${s.toFixed(0)}s  `);
  }
}
fs.unlinkSync(TMP_I); fs.unlinkSync(TMP_O);
console.log(`\n✅ ${OUT}`);
