// 뽑힌 PNG 시퀀스 검수 — 검정 배경 위에 실제로 잉크가 있는지, 코너가 순검정인지.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// 스크래치패드에서 도니 리포의 node_modules 를 명시적으로 가리킨다
const require = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const { PNG } = require('pngjs');

const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
const pick = [0, Math.floor(files.length * 0.25), Math.floor(files.length / 2),
              Math.floor(files.length * 0.75), files.length - 1];

console.log(`총 ${files.length}장 · ${DIR}\n`);
console.log('프레임          크기       비검정%   최대휘도  코너(RGB)      용량');
console.log('─'.repeat(72));

for (const i of pick) {
  const f = files[i];
  const buf = fs.readFileSync(path.join(DIR, f));
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  let nz = 0, max = 0;
  for (let p = 0; p < data.length; p += 4) {
    const l = Math.max(data[p], data[p + 1], data[p + 2]);
    if (l > 8) nz++;
    if (l > max) max = l;
  }
  const total = w * h;
  const c = [data[0], data[1], data[2]];   // 좌상단 코너
  console.log(
    `${f.padEnd(14)} ${w}x${h}  ${(nz / total * 100).toFixed(2).padStart(6)}%   `
    + `${String(max).padStart(6)}   ${c.join(',').padEnd(12)}  ${(buf.length / 1024 / 1024).toFixed(2)}MB`
  );
}

const bytes = files.reduce((a, f) => a + fs.statSync(path.join(DIR, f)).size, 0);
console.log('─'.repeat(72));
console.log(`시퀀스 전체 ${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`);
