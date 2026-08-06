// 알파 bbox 전수 스캔 — 투명 PNG 시퀀스에서 **내용이 실제로 차지하는 사각형**을 프레임마다 잰다.
//   왜: 에펙에 넘길 소재는 대지 전체가 아니라 그 안의 한 요소(발자국·화살표)일 때가 많다.
//   크롭 박스를 눈대중으로 잡으면 모션 중에 가장자리가 잘린다 — 벌어지는 발자국이 특히 그렇다.
//   전 프레임의 합집합을 내주므로 그 값으로 자르면 어느 프레임도 안 잘린다.
//   덤으로 **모션의 시작·끝 프레임**이 폭 변화로 그대로 읽힌다(벌어지다 멈추면 폭이 고정된다).
//
//   node scripts/measure_bbox.mjs <PNG폴더> [yCut]
//     yCut = 이 y 위쪽은 무시. 위에 얹힌 타이틀 알약을 빼고 아래 요소만 잴 때 쓴다(기본 0).
import fs from 'fs';
import path from 'path';
import pkg from 'pngjs';
const { PNG } = pkg;

const [dir, yCutS = '0'] = process.argv.slice(2);
if (!dir) { console.error('사용법: node scripts/measure_bbox.mjs <PNG폴더> [yCut]'); process.exit(1); }
const yCut = +yCutS || 0;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
if (!files.length) { console.error('PNG 가 없다: ' + dir); process.exit(1); }

const A_MIN = 8;   // 알파 8 미만은 사실상 투명(export_video.mjs coverage 와 같은 기준)
let U = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
let prevW = null;

for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = yCut; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] < A_MIN) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { console.log(`${f}  빈 프레임`); prevW = null; continue; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // 폭이 멈춘 지점 = 모션이 끝난 지점. 구간을 손으로 찾지 않아도 되게 표시한다.
  const mark = prevW == null ? '' : (w === prevW ? '  ·정지' : (w > prevW ? `  ▲+${w - prevW}` : `  ▼${w - prevW}`));
  console.log(`${f}  x${x0}-${x1} (w${w})  y${y0}-${y1} (h${h})${mark}`);
  prevW = w;
  U = { x0: Math.min(U.x0, x0), y0: Math.min(U.y0, y0), x1: Math.max(U.x1, x1), y1: Math.max(U.y1, y1) };
}

if (U.x1 < 0) { console.log('\n전 프레임이 비어 있다.'); process.exit(0); }
const w = U.x1 - U.x0 + 1, h = U.y1 - U.y0 + 1;
console.log(`\n합집합  x${U.x0}-${U.x1}  y${U.y0}-${U.y1}  (${w}×${h})`);
// ffmpeg crop 은 짝수 폭·높이를 요구하는 코덱이 있다 — 바로 붙여 쓸 수 있게 짝수로 올려 준다.
const ew = w + (w % 2), eh = h + (h % 2);
console.log(`ffmpeg  -vf "crop=${ew}:${eh}:${U.x0}:${U.y0}"`);
