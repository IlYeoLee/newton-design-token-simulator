// 투명 플레이트를 **잉크 한 장 + 빛 한 장**으로 가른다. 재렌더 없음.
//
//   왜: 인물·발자국·원형토큰은 잉크(Normal)로 얹어야 색이 살고 예쁘다(유저 확정).
//       그런데 판정 '팡'은 마크 셰이더가 그리는 **넓고 어두운 적갈색 필드**를 달고 있어서,
//       잉크로 얹으면 그게 바닥을 칠해 빨간 그림자 박스가 된다.
//       (블룸인 줄 알고 꺼봤지만 그대로였다 — 후처리가 아니라 셰이더가 그리는 실체다.)
//
//   가르는 기준은 휘도다. 밝고 진한 것 = 실체(잉크), 어둡고 넓게 깔린 것 = 빛(가산).
//   경계에서 이음매가 보이지 않게 부드럽게 섞는다.
//
//   두 장을 Normal + Add 로 겹치면 원본과 거의 같되, 어두운 필드가 배경을 깎지 않는다.
//
//   사용:
//     node scripts/split_ink_light.mjs <PNG시퀀스> --out <폴더> [--lo 0.20] [--hi 0.42]
//       --lo 아래는 100% 빛 · --hi 위는 100% 잉크 · 사이는 부드럽게
//       (팡의 필드가 남으면 --hi 를 올리고, 인물이 옅어지면 --hi 를 내린다)

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('PNG 시퀀스 폴더를 주세요'); process.exit(1); }
const OUT = arg('out', SRC.replace(/[\\/]$/, '') + '_split');
const LO = +arg('lo', 0.20), HI = +arg('hi', 0.42);

const files = fs.readdirSync(SRC).filter(f => /\.png$/i.test(f)).sort();
const dim = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
  'stream=width,height', '-of', 'csv=p=0', path.join(SRC, files[0])]).toString().trim().split(',');
const W = +dim[0], H = +dim[1];
const DI = path.join(OUT, 'INK_알파_Normal'), DL = path.join(OUT, 'LIGHT_검정_Add');
fs.mkdirSync(DI, { recursive: true }); fs.mkdirSync(DL, { recursive: true });
const TI = path.join(OUT, '_i.raw'), TA = path.join(OUT, '_a.raw'), TB = path.join(OUT, '_b.raw');
console.log(`${files.length}장 · ${W}×${H} · lo ${LO} hi ${HI}`);

const smooth = t => t * t * (3 - 2 * t);
const t0 = Date.now();
for (let n = 0; n < files.length; n++) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SRC, files[n]),
    '-pix_fmt', 'rgba', '-f', 'rawvideo', TI]);
  const P = fs.readFileSync(TI);
  const ink = Buffer.alloc(W * H * 4), lit = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const q = i * 4, j = i * 3;
    const r = P[q], g = P[q + 1], b = P[q + 2], a = P[q + 3] / 255;
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // s = 1 이면 잉크, 0 이면 빛
    const s = l <= LO ? 0 : l >= HI ? 1 : smooth((l - LO) / (HI - LO));
    ink[q] = r; ink[q + 1] = g; ink[q + 2] = b;
    ink[q + 3] = Math.round(a * s * 255);
    // 빛 = 남은 몫. 가산이라 미리 알파를 곱해 둔다(= 검정 배경 위의 그 빛 그대로).
    const k = a * (1 - s);
    lit[j] = r * k; lit[j + 1] = g * k; lit[j + 2] = b * k;
  }
  fs.writeFileSync(TA, ink); fs.writeFileSync(TB, lit);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`,
    '-i', TA, path.join(DI, files[n])]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`,
    '-i', TB, path.join(DL, files[n])]);
  if ((n + 1) % 20 === 0 || n === files.length - 1)
    process.stdout.write(`\r  ${n + 1}/${files.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s  `);
}
for (const f of [TI, TA, TB]) fs.unlinkSync(f);
console.log(`\n✅ ${DI}\n✅ ${DL}`);
