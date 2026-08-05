// '발모양 파형'(MARK 셰이더 Success 의 uRip)을 AE 용 시퀀스로 굽는다 — 같은 수식.
//
//   왜 굽나: 이 파형은 원형 팡과 달리 **마크 셰이더 안에** 있어서 --layer 로 못 뺀다.
//   그래서 뽑을 때는 --norip 으로 끄고, 여기서 따로 구워 에펙에서 가산으로 얹는다.
//   (팡·파형 둘 다 가산광이라 잉크로 얹으면 바닥을 어둡게 칠한다 — 실측.)
//
//   원본 수식 (src/fx-core.js MARK_GLSL, state Success):
//     ripAmt = uRip × 1.6 ,  cyc = clamp(prog/0.80, 0, 1) ,  ripK = 1.9
//     front  = cyc × uRipReach × ripK
//     band   = exp(−((outPos − front) / uRipWidth)²)          outPos = 실루엣 **바깥** 거리
//     lt     = clamp(0.34 + (1−cyc)×0.52 + band×0.22, 0, 1)
//     색      = lut(lt)  (ripGrad 1 = 완전 LUT)
//     알파    = band × (1−cyc)^1.6 × ripAmt × 0.5
//
//   값 출처: src/mark-look.json (rip .5 · ripReach .34 · ripWidth .1 · ripGrad 1)
//            × SF = SIL_FIT/SIL_FIT_REF = 0.52/0.78 = 0.6667  (fx-core)
//
//   실루엣은 **뽑아둔 판에서 딴다** — 발 SDF 를 다시 만들 필요가 없고, 실제로 나온 그림과
//   1:1 로 맞는다. 파형이 없는 프레임(Hold 구간)을 쓰면 본체만 깨끗이 잡힌다.
//
//   사용: node scripts/bake_footrip.mjs <판PNG> [--out 폴더] [--px 512] [--dur 1] [--gain 1]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('발자국이 보이는 판 PNG 를 주세요'); process.exit(1); }
const OUT = arg('out', 'out/FOOTRIP_BAKE');
const PXW = +arg('px', 512);
const DUR = +arg('dur', 1.0);
const FPS = +arg('fps', 29.97);
const GAIN = +arg('gain', 1);

// ── 셰이더 상수 ──
const SF = 0.52 / 0.78;
const RIP = 0.5, RIP_REACH = 0.34 * SF, RIP_WIDTH = 0.1 * SF, RIP_K = 1.9;
const SIL_FIT = 0.52;                       // 실루엣이 쿼드 uv 의 ±0.52 를 쓴다

// ── 뉴턴 LUT (bake_burst.mjs 와 같은 것) ──
const PAL = { red: '#FA3030', coral: '#FE6E3C', sand: '#FEC389', prism: '#D1FEFF' };
const STOPS = [[PAL.red, 0], [PAL.red, 0.30], [PAL.coral, 0.56], [PAL.sand, 0.86], [PAL.prism, 1]];
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const l2s = c => Math.max(0, Math.min(255, Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))));
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2ok = (r, g, b) => { r = s2l(r); g = s2l(g); b = s2l(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]; };
const ok2rgb = (L, a, b) => { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)]; };
const LUT = new Uint8Array(256 * 3);
{ const st = [...STOPS].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < 256; i++) { const v = i / 255; let j = 0;
    while (j < st.length - 2 && v > st[j + 1][1]) j++;
    const [c0, p0] = st[j], [c1, p1] = st[j + 1];
    const f = Math.max(0, Math.min(1, (v - p0) / Math.max(1e-5, p1 - p0)));
    const A = rgb2ok(...hex2rgb(c0)), B = rgb2ok(...hex2rgb(c1));
    LUT.set(ok2rgb(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f), i * 3); } }
const lut = v => { const i = Math.max(0, Math.min(255, Math.round(v * 255))) * 3; return [LUT[i], LUT[i + 1], LUT[i + 2]]; };

// ── 판에서 발자국 하나를 딴다 ──
fs.mkdirSync(OUT, { recursive: true });
const TMP = path.join(OUT, '_s.raw');
const dim = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
  'stream=width,height', '-of', 'csv=p=0', SRC]).toString().trim().split(',');
const SW = +dim[0], SH = +dim[1];
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-pix_fmt', 'rgba', '-f', 'rawvideo', TMP]);
const P = fs.readFileSync(TMP);

// 아래 65% 에서 알파 덩어리를 라벨링 → 가장 큰 것 하나
const lab = new Int32Array(SW * SH).fill(-1);
const y0 = Math.floor(SH * 0.35);
let best = null, id = 0;
const stack = [];
for (let y = y0; y < SH; y++) for (let x = 0; x < SW; x++) {
  const i = y * SW + x;
  if (lab[i] !== -1 || P[i * 4 + 3] < 120) continue;
  let n = 0, minx = x, maxx = x, miny = y, maxy = y;
  stack.push(i); lab[i] = id;
  while (stack.length) {
    const c = stack.pop(), cx = c % SW, cy = (c / SW) | 0;
    n++; if (cx < minx) minx = cx; if (cx > maxx) maxx = cx;
    if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < y0 || nx >= SW || ny >= SH) continue;
      const k = ny * SW + nx;
      if (lab[k] === -1 && P[k * 4 + 3] >= 120) { lab[k] = id; stack.push(k); }
    }
  }
  if (!best || n > best.n) best = { id, n, minx, maxx, miny, maxy };
  id++;
}
if (!best) { console.error('발자국을 못 찾았습니다 — 파형이 없는 프레임(Hold 구간)을 주세요'); process.exit(1); }
const fw = best.maxx - best.minx + 1, fh = best.maxy - best.miny + 1;
console.log(`발자국 ${fw}×${fh}px (판 ${SW}×${SH}) · 픽셀 ${best.n}`);

// uv 환산 — 실루엣 긴 변의 절반이 uv 0.52 다
const halfLong = Math.max(fw, fh) / 2;
const UVPX = halfLong / SIL_FIT;                       // uv 1.0 이 몇 px 인가
const MARG = Math.ceil(RIP_REACH * RIP_K * UVPX) + 8;  // 파형이 나가는 최대 거리
const CW = fw + MARG * 2, CH = fh + MARG * 2;
const SCALE = PXW / CW;
const OW = PXW, OH = Math.round(CH * SCALE);

// 실루엣 마스크(캔버스 좌표) + 바깥 거리장 — 2패스 체버쇼프 근사 후 유클리드 보정
const inside = new Uint8Array(CW * CH);
for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
  const i = (best.miny + y) * SW + (best.minx + x);
  if (lab[i] === best.id) inside[(y + MARG) * CW + (x + MARG)] = 1;
}
// 정확한 유클리드 거리(브루트포스는 느리다) — 8방향 2패스 chamfer
const INF = 1e9, dist = new Float64Array(CW * CH).fill(INF);
for (let i = 0; i < CW * CH; i++) if (inside[i]) dist[i] = 0;
const D1 = 1, D2 = Math.SQRT2;
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  const i = y * CW + x; let v = dist[i];
  if (x > 0) v = Math.min(v, dist[i - 1] + D1);
  if (y > 0) v = Math.min(v, dist[i - CW] + D1);
  if (x > 0 && y > 0) v = Math.min(v, dist[i - CW - 1] + D2);
  if (x < CW - 1 && y > 0) v = Math.min(v, dist[i - CW + 1] + D2);
  dist[i] = v;
}
for (let y = CH - 1; y >= 0; y--) for (let x = CW - 1; x >= 0; x--) {
  const i = y * CW + x; let v = dist[i];
  if (x < CW - 1) v = Math.min(v, dist[i + 1] + D1);
  if (y < CH - 1) v = Math.min(v, dist[i + CW] + D1);
  if (x < CW - 1 && y < CH - 1) v = Math.min(v, dist[i + CW + 1] + D2);
  if (x > 0 && y < CH - 1) v = Math.min(v, dist[i + CW - 1] + D2);
  dist[i] = v;
}

// ── 프레임 굽기 ──
const N = Math.max(1, Math.round(DUR * FPS));
const buf = Buffer.alloc(OW * OH * 4);
const raw = path.join(OUT, '_t.raw');
for (let f = 0; f < N; f++) {
  const prog = f / (N - 1 || 1);
  const cyc = Math.max(0, Math.min(1, prog / 0.80));
  const front = cyc * RIP_REACH * RIP_K;
  const decay = (1 - cyc) ** 1.6 * RIP * 1.6 * 0.5 * GAIN;
  for (let oy = 0; oy < OH; oy++) {
    const cy = Math.min(CH - 1, Math.floor(oy / SCALE));
    for (let ox = 0; ox < OW; ox++) {
      const cx = Math.min(CW - 1, Math.floor(ox / SCALE));
      const outPos = dist[cy * CW + cx] / UVPX;          // px → uv
      const band = Math.exp(-(((outPos - front) / RIP_WIDTH) ** 2));
      const a = band * decay;
      const q = (oy * OW + ox) * 4;
      if (a < 0.002) { buf[q] = buf[q + 1] = buf[q + 2] = buf[q + 3] = 0; continue; }
      const lt = Math.max(0, Math.min(1, 0.34 + (1 - cyc) * 0.52 + band * 0.22));
      const c = lut(lt);
      // 가산광 — 알파를 곱해 저장(프리멀티플). 가산이면 그대로, Normal 이면 알파가 받쳐 준다.
      buf[q] = Math.min(255, c[0] * a); buf[q + 1] = Math.min(255, c[1] * a); buf[q + 2] = Math.min(255, c[2] * a);
      buf[q + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  fs.writeFileSync(raw, buf);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${OW}x${OH}`,
    '-i', raw, path.join(OUT, `f${String(f).padStart(4, '0')}.png`)]);
}
fs.unlinkSync(raw); fs.unlinkSync(TMP);
console.log(`✅ ${OUT}  ${N}장 · ${OW}×${OH} · ${DUR}초 @${FPS}fps`);
console.log(`   판에 얹을 크기: ${(CW).toFixed(0)}×${(CH).toFixed(0)}px (원래 판 좌표계 기준)`);
console.log(`   중심: 발자국 중심과 맞추면 된다 (여백 ${MARG}px 이 파형 자리)`);
