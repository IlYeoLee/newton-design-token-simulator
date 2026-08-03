// 새 발 소스를 기존 foot_shape.png 의 캔버스 규격(종횡비·발 위치·크기)에 맞춰 다시 굽는다.
//   이 에셋은 마스크로 쓰인다(wallgl _tinted source-in · ready-view CSS mask-image).
//   그래서 중요한 건 색이 아니라 **알파 실루엣이 프레임 안 어디에 얼마만큼 있는가** 다.
//   종횡비가 다른 걸 그냥 끼우면 발이 늘어나거나 자리가 밀린다.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

const bbox = (png) => {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(png.width * y + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

const OLD = process.argv[2], NEW = process.argv[3], OUT = process.argv[4];
const SCALE = +(process.argv[5] || 2);   // 출력 배율 — 화질을 올리는 게 목적이다

const o = PNG.sync.read(readFileSync(OLD));
const n = PNG.sync.read(readFileSync(NEW));
const ob = bbox(o), nb = bbox(n);
console.log(`기존 ${o.width}x${o.height}  발 bbox ${ob.w}x${ob.h} @(${ob.x0},${ob.y0})`);
console.log(`신규 ${n.width}x${n.height}  발 bbox ${nb.w}x${nb.h} @(${nb.x0},${nb.y0})`);

// 출력 캔버스 = 기존 규격 × SCALE (종횡비 유지 → 그리는 코드는 손댈 필요 없다)
const W = Math.round(o.width * SCALE), H = Math.round(o.height * SCALE);
// 새 발을 기존 발과 같은 상대 위치·크기로. 가로/세로 배율 중 작은 쪽을 써서 안 늘어나게.
const k = Math.min((ob.w / o.width) * W / nb.w, (ob.h / o.height) * H / nb.h);
const dw = nb.w * k, dh = nb.h * k;
const dx = (ob.x0 / o.width) * W + ((ob.w / o.width) * W - dw) / 2;
// ★ 세로는 가운데가 아니라 **발바닥 기준선**에 맞춘다. 바로 아래에 footprint_shadow 가
//   따로 그려지기 때문에, 발이 위로 뜨면 그림자와 떨어져 공중에 뜬 것처럼 보인다.
//   대신 위쪽(잘린 종아리)에 여백이 생기는데, 원래도 프레임 밖으로 나가는 부분이라 덜 눈에 띈다.
const dy = ((ob.y1 + 1) / o.height) * H - dh;
console.log(`출력 ${W}x${H}  발 ${Math.round(dw)}x${Math.round(dh)} @(${Math.round(dx)},${Math.round(dy)})  배율 ${k.toFixed(3)}`);

// 이중선형 리샘플 — 마스크라 알파 경계가 부드러워야 한다(최근접이면 계단이 그대로 남는다)
const out = new PNG({ width: W, height: H });
out.data.fill(0);
for (let y = 0; y < H; y++) {
  const sy = (y - dy) / k + nb.y0;
  if (sy < 0 || sy >= n.height - 1) continue;
  const y0 = Math.floor(sy), fy = sy - y0;
  for (let x = 0; x < W; x++) {
    const sx = (x - dx) / k + nb.x0;
    if (sx < 0 || sx >= n.width - 1) continue;
    const x0 = Math.floor(sx), fx = sx - x0;
    const di = (W * y + x) * 4;
    for (let c = 0; c < 4; c++) {
      const p = (i, j) => n.data[(n.width * j + i) * 4 + c];
      out.data[di + c] = Math.round(
        p(x0, y0) * (1 - fx) * (1 - fy) + p(x0 + 1, y0) * fx * (1 - fy) +
        p(x0, y0 + 1) * (1 - fx) * fy + p(x0 + 1, y0 + 1) * fx * fy);
    }
  }
}
// 잘린 종아리를 캔버스 위 끝까지 잇는다. 새 소스는 옛것보다 다리를 덜 담고 있어서,
//   발바닥을 맞추면 위쪽에 여백이 생기고 다리가 허공에서 뚝 끊긴 것처럼 보인다(실측 19%).
//   소스의 맨 윗줄이 이미 수평 절단면이라, 그 줄을 위로 이어 붙이면 원래처럼 '프레임 밖으로
//   나가는 다리'가 된다. 늘리는 게 아니라 같은 단면을 연장하는 것이라 왜곡이 없다.
const top = Math.ceil(dy);
if (top > 0 && top < H) {
  const row = out.data.slice((W * top) * 4, (W * (top + 1)) * 4);
  for (let y = 0; y < top; y++) out.data.set(row, (W * y) * 4);
  console.log(`종아리 연장: 0~${top}px (캔버스의 ${(top / H * 100).toFixed(1)}%)`);
}
writeFileSync(OUT, PNG.sync.write(out));
const ro = bbox(PNG.sync.read(readFileSync(OUT)));
console.log(`검산: 결과 발 bbox ${ro.w}x${ro.h} @(${ro.x0},${ro.y0})`);
console.log(`      상대위치 기존 (${(ob.x0 / o.width).toFixed(3)},${(ob.y0 / o.height).toFixed(3)}) → 신규 (${(ro.x0 / W).toFixed(3)},${(ro.y0 / H).toFixed(3)})`);
