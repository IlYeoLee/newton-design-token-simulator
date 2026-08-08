// 시퀀스 전체에서 '내용이 실제로 있는 영역'을 잰다 — 판의 대부분이 검정이면 잘라낼 수 있다.
//   자르면 ① 발이 프레임 대비 커지고 ② 용량이 준다. 둘이 같은 조치다.
//   문턱은 추측하지 않는다: 코너가 1~5 였으므로 12 위면 확실히 내용이다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const { PNG } = require('pngjs');

const DIR = process.argv[2];
const TH = +(process.argv[3] ?? 12);
const STEP = +(process.argv[4] ?? 12);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();

let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, W = 0, H = 0;
for (let i = 0; i < files.length; i += STEP) {
  const png = PNG.sync.read(fs.readFileSync(path.join(DIR, files[i])));
  W = png.width; H = png.height;
  const d = png.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      if (Math.max(d[p], d[p + 1], d[p + 2]) > TH) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
}

const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
console.log(`판 ${W}x${H} · 문턱 ${TH} · ${Math.ceil(files.length / STEP)}장 검사\n`);
console.log(`내용 영역  x ${x0}~${x1}  y ${y0}~${y1}`);
console.log(`           ${bw} x ${bh}   (판의 ${(bw / W * 100).toFixed(0)}% x ${(bh / H * 100).toFixed(0)}%)`);
console.log(`빈 여백    좌 ${x0} · 우 ${W - 1 - x1} · 상 ${y0} · 하 ${H - 1 - y1}`);
console.log(`\n화소 수    ${(W * H / 1e6).toFixed(2)}M → ${(bw * bh / 1e6).toFixed(2)}M  (${(bw * bh / (W * H) * 100).toFixed(0)}%)`);

// 여유 8% 를 두고 짝수로 맞춘 crop (ProRes 는 짝수 치수를 좋아한다)
const padX = Math.round(bw * 0.08), padY = Math.round(bh * 0.08);
const cx0 = Math.max(0, x0 - padX), cy0 = Math.max(0, y0 - padY);
const cw = Math.min(W - cx0, bw + padX * 2) & ~1;
const ch = Math.min(H - cy0, bh + padY * 2) & ~1;
console.log(`\n권장 crop (여유 8%):  ${cw}x${ch}+${cx0}+${cy0}`);
console.log(`  ffmpeg -vf "crop=${cw}:${ch}:${cx0}:${cy0}"`);
console.log(`  → 화소 ${(cw * ch / 1e6).toFixed(2)}M · 원본의 ${(cw * ch / (W * H) * 100).toFixed(0)}%`);
