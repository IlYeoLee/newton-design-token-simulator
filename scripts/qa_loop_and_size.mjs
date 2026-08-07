// ① 루프가 어디서 되감기는지 (f0 와 같은 그림이 다시 나오는 지점)
// ② 용량이 왜 큰지 — 휘도 히스토그램. 거의-검정이 얼마나 깔려 있나.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const { PNG } = require('pngjs');

const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
const read = i => PNG.sync.read(fs.readFileSync(path.join(DIR, files[i])));

// ── ① 되감김 지점: f0 와 후보 프레임들의 차이
const base = read(0).data;
const cmp = (i) => {
  const d = read(i).data;
  let moved = 0;
  for (let p = 0; p < d.length; p += 4) {
    if (Math.abs(d[p] - base[p]) + Math.abs(d[p + 1] - base[p + 1]) + Math.abs(d[p + 2] - base[p + 2]) > 24) moved++;
  }
  return moved / (d.length / 4) * 100;
};
console.log('f0 대비 차이 — 0 에 가까우면 그 지점이 루프 시작');
console.log('─'.repeat(46));
for (const i of [420, 426, 432, 438, 444, 456, 480, 504, files.length - 1]) {
  if (i >= files.length) continue;
  console.log(`  f0 ↔ ${files[i].padEnd(12)} ${cmp(i).toFixed(2).padStart(6)}%  (t=${(i / 30).toFixed(2)}s)`);
}

// ── ② 휘도 분포 (중간 프레임)
const mid = read(Math.floor(files.length / 2));
const bins = new Array(9).fill(0);
const edges = [0, 4, 8, 16, 32, 64, 128, 192, 255];
for (let p = 0; p < mid.data.length; p += 4) {
  const l = Math.max(mid.data[p], mid.data[p + 1], mid.data[p + 2]);
  let b = edges.findIndex((e, k) => k > 0 && l <= e) - 1;
  if (b < 0) b = bins.length - 1;
  bins[b]++;
}
const total = mid.width * mid.height;
console.log('\n휘도 분포 (중간 프레임) — 낮은 칸이 두꺼우면 그게 용량의 정체');
console.log('─'.repeat(46));
let cum = 0;
for (let i = 0; i < bins.length - 1; i++) {
  cum += bins[i];
  const pct = bins[i] / total * 100;
  console.log(`  ${String(edges[i]).padStart(3)}~${String(edges[i + 1]).padStart(3)}  ${pct.toFixed(2).padStart(6)}%  누적 ${(cum / total * 100).toFixed(1).padStart(5)}%  ${'▏'.repeat(Math.min(30, Math.round(pct / 2)))}`);
}
const sz = files.reduce((a, f) => a + fs.statSync(path.join(DIR, f)).size, 0);
console.log(`\n시퀀스 ${files.length}장 · ${(sz / 1024 / 1024 / 1024).toFixed(2)}GB · 장당 ${(sz / files.length / 1024 / 1024).toFixed(1)}MB`);
