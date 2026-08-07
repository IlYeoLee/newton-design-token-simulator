// 프레임 간 차분 — 애니메이션이 실제로 도는지. 잉크 비율은 같아도 형태가 움직이면 차분이 뜬다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const { PNG } = require('pngjs');

const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
const read = f => PNG.sync.read(fs.readFileSync(path.join(DIR, f)));

// 5프레임 간격으로 훑어 인접 차분을 낸다 — 정지 구간이 있으면 0 이 연속으로 나온다
const STEP = 12;
let prev = null, prevName = '';
const rows = [];
for (let i = 0; i < files.length; i += STEP) {
  const png = read(files[i]);
  if (prev) {
    let diff = 0, moved = 0;
    for (let p = 0; p < png.data.length; p += 4) {
      const d = Math.abs(png.data[p] - prev[p])
              + Math.abs(png.data[p + 1] - prev[p + 1])
              + Math.abs(png.data[p + 2] - prev[p + 2]);
      if (d > 24) { moved++; diff += d; }
    }
    rows.push({ a: prevName, b: files[i], moved, pct: moved / (png.width * png.height) * 100 });
  }
  prev = png.data; prevName = files[i];
}

console.log('구간                     변한 화소      비율');
console.log('─'.repeat(50));
for (const r of rows) {
  const bar = '█'.repeat(Math.min(20, Math.round(r.pct * 4)));
  console.log(`${r.a}→${r.b}  ${String(r.moved).padStart(9)}  ${r.pct.toFixed(2).padStart(6)}%  ${bar}`);
}
const still = rows.filter(r => r.pct < 0.01).length;
console.log('─'.repeat(50));
console.log(`정지 구간 ${still}/${rows.length}`);
