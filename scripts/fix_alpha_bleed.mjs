// 알파 컷아웃 PNG 의 '투명 영역 흰색' 제거 — 알파는 손대지 않고 RGB 만 가장자리에서 바깥으로 번지게(edge extend).
//
// 왜 필요한가: bk/*.png 는 투명 영역 RGB 가 [252,252,252] 흰색이다(실측). 알파가 0 인 픽셀은
//   이론상 안 보이지만, ① 반투명 테두리(0<a<1)에서는 그 흰색이 알파에 비례해 그대로 섞이고
//   ② 축소 리샘플·블러·가산 합성에서 이웃 흰 픽셀이 딸려 들어온다. 결과가 '인물 둘레 흰 테'다.
//   실측: 반투명 대역 RGB [200,180,174] vs 불투명 인물 [136,103,93] — 가장자리가 1.5배 밝다.
// 무엇을 바꾸나: 알파 채널은 **단 1비트도 안 건드린다**. 불투명 픽셀의 색을 이웃으로 반복 확산해
//   투명·반투명 픽셀의 RGB 를 인물 색으로 갈아 끼운다. 형태·투명도는 그대로, 흰 테만 사라진다.
//
// 사용: node scripts/fix_alpha_bleed.mjs public/ready-view/assets/bk/*.png
//       node scripts/fix_alpha_bleed.mjs --dry public/ready-view/assets/bk   (디렉터리도 가능)
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.filter(a => !a.startsWith('--'));
const PASSES = 24;   // 번짐 반경(px). 1254px 원본을 카드 크기로 줄일 때의 리샘플 커널을 넉넉히 덮는다.
const SOLID = 248;   // 이 알파 이상만 '원본 색'으로 신뢰한다

const files = targets.flatMap(t => fs.statSync(t).isDirectory()
  ? fs.readdirSync(t).filter(f => f.endsWith('.png')).map(f => path.join(t, f)) : [t]);

for (const file of files) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data } = png;
  // filled = 이 픽셀의 RGB 를 신뢰할 수 있는가
  let filled = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) if (data[i + 3] >= SOLID) filled[p] = 1;
  const before = { n: 0, r: 0, g: 0, b: 0 };
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] > 0 && data[i + 3] < SOLID) { before.n++; before.r += data[i]; before.g += data[i + 1]; before.b += data[i + 2]; }
  }
  for (let pass = 0; pass < PASSES; pass++) {
    const next = filled.slice();
    let grew = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (filled[p]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!filled[q]) continue;
        const j = q << 2; r += data[j]; g += data[j + 1]; b += data[j + 2]; n++;
      }
      if (!n) continue;
      const i = p << 2;
      data[i] = Math.round(r / n); data[i + 1] = Math.round(g / n); data[i + 2] = Math.round(b / n);
      next[p] = 1; grew++;
    }
    filled = next;
    if (!grew) break;
  }
  const after = { n: 0, r: 0, g: 0, b: 0 };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 3] < SOLID) { after.n++; after.r += data[i]; after.g += data[i + 1]; after.b += data[i + 2]; }
  }
  const m = t => t.n ? `[${Math.round(t.r / t.n)},${Math.round(t.g / t.n)},${Math.round(t.b / t.n)}]` : '—';
  console.log(`${path.basename(file)}  반투명 RGB ${m(before)} → ${m(after)}${dry ? '  (dry)' : ''}`);
  if (!dry) fs.writeFileSync(file, PNG.sync.write(png));
}
