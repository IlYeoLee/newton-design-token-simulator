// 발자국이 실제로 고정됐는지 — **좌/우 마크를 따로** 잰다.
//   앞 버전은 프레임 전체 무게중심 하나만 봤다. 그러면 발 교대로 활성 마크가 좌↔우로
//   바뀌는 것까지 '이동'으로 잡힌다(화소 수가 2만~50만으로 요동친 게 그 신호였다).
//   여기서는 화면을 좌우로 갈라 각 마크 **본체**(진한 살구색 덩어리)의 중심만 본다.
//   글로우 웅덩이는 어둡고 붉어서 문턱에 안 걸린다 — 본체만 남는다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const { PNG } = require('pngjs');

const DIR = process.argv[2];
const STEP = +(process.argv[3] ?? 20);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();

const rows = [];
for (let i = 0; i < files.length; i += STEP) {
  const png = PNG.sync.read(fs.readFileSync(path.join(DIR, files[i])));
  const { width: w, height: h, data } = png;
  const mid = w / 2;
  const acc = [{ sx: 0, sy: 0, n: 0 }, { sx: 0, sy: 0, n: 0 }];   // 0=좌 1=우
  for (let y = Math.floor(h * 0.40); y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4, r = data[p], g = data[p + 1], b = data[p + 2];
      // 마크 본체 = 밝은 살구색. 글로우(어두운 로즈)·알약 글자(흰색)는 안 걸린다.
      if (r > 228 && g > 165 && g < 220 && b > 90 && b < 185) {
        const k = x < mid ? 0 : 1;
        acc[k].sx += x; acc[k].sy += y; acc[k].n++;
      }
    }
  }
  rows.push({
    f: files[i], t: (i / 30).toFixed(2),
    L: acc[0].n > 400 ? { x: acc[0].sx / acc[0].n, y: acc[0].sy / acc[0].n, n: acc[0].n } : null,
    R: acc[1].n > 400 ? { x: acc[1].sx / acc[1].n, y: acc[1].sy / acc[1].n, n: acc[1].n } : null,
  });
}

console.log('프레임        t(s)    왼쪽 마크 (x, y)       오른쪽 마크 (x, y)');
console.log('─'.repeat(66));
const fmt = m => m ? `${m.x.toFixed(0).padStart(6)},${m.y.toFixed(0).padStart(6)}` : '     — 없음  ';
for (const r of rows) console.log(`${r.f.padEnd(12)} ${r.t.padStart(6)}   ${fmt(r.L)}        ${fmt(r.R)}`);

const rng = (arr, k) => { const v = arr.filter(Boolean).map(m => m[k]); return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0; };
const Ls = rows.map(r => r.L), Rs = rows.map(r => r.R);
console.log('─'.repeat(66));
console.log(`왼쪽  x 범위 ${rng(Ls, 'x').toFixed(0)}px · y 범위 ${rng(Ls, 'y').toFixed(0)}px  (${Ls.filter(Boolean).length}장)`);
console.log(`오른쪽 x 범위 ${rng(Rs, 'x').toFixed(0)}px · y 범위 ${rng(Rs, 'y').toFixed(0)}px  (${Rs.filter(Boolean).length}장)`);
const worst = Math.max(rng(Ls, 'x'), rng(Ls, 'y'), rng(Rs, 'x'), rng(Rs, 'y'));
console.log(worst < 25 ? `\n→ 고정됨 (최대 ${worst.toFixed(0)}px · 핀 작동)` : `\n→ ★ 아직 움직인다 (최대 ${worst.toFixed(0)}px)`);
