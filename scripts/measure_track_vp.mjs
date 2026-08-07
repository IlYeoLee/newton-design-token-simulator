// 러닝 트랙 실사 → 소실점 → 카메라 하향각.
//
//   v1 은 '밝은 화소'로 잡아 펜스·잔디까지 47개를 주웠다. 트랙은 초록(G>R)이고
//   레인선은 흰색(무채)이다 — **색으로 가르는 게 밝기로 가르는 것보다 정확하다.**
//   그 다음 아래 행에서 위로 선을 따라가며(추적) 실제로 이어지는 것만 남긴다.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const { PNG } = require('pngjs');

const SRC = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = png;
const px = (x, y) => { const p = (y * W + x) * 4; return [data[p], data[p + 1], data[p + 2]]; };

const X0 = Math.round(W * 0.02), X1 = Math.round(W * 0.80);   // 좌 펜스·우 잔디 제외
const Y0 = Math.round(H * 0.55), Y1 = Math.round(H * 0.99);   // 트랙이 크게 보이는 아래쪽
const ROWS = 44;

// 레인선 = 밝고(그 행 중앙값보다) + 무채(최대-최소 채널 차가 작다)
function peaks(y) {
  const L = [], neutral = [];
  for (let x = X0; x < X1; x++) {
    const [r, g, b] = px(x, y);
    L.push(0.299 * r + 0.587 * g + 0.114 * b);
    neutral.push(Math.max(r, g, b) - Math.min(r, g, b));
  }
  const s = [...L].sort((a, b) => a - b), med = s[Math.floor(s.length / 2)];
  const th = med + 22;
  const out = []; let run = -1;
  for (let i = 0; i < L.length; i++) {
    const ok = L[i] > th && neutral[i] < 16;            // ★ 무채 조건이 초록 트랙을 걷어낸다
    if (ok) { if (run < 0) run = i; }
    else if (run >= 0) { const w = i - run; if (w >= 2 && w <= W * 0.05) out.push(X0 + (run + i - 1) / 2); run = -1; }
  }
  if (run >= 0) out.push(X0 + (run + L.length - 1) / 2);
  return out;
}

const rows = [];
for (let k = 0; k < ROWS; k++) {
  const y = Math.round(Y1 - (Y1 - Y0) * k / (ROWS - 1));    // 아래→위
  rows.push({ y, p: peaks(y) });
}
console.log(`이미지 ${W}x${H} · 관심영역 x[${X0},${X1}] y[${Y0},${Y1}] · ${ROWS}행`);
console.log(`행별 봉우리 수: ${rows.map(r => r.p.length).join(',')}`);

// ── 선 추적: 맨 아래 행의 봉우리를 씨앗으로, 위로 올라가며 가장 가까운 봉우리를 잇는다
const tracks = rows[0].p.map(x => ({ pts: [[x, rows[0].y]], last: x, slope: 0 }));
for (let k = 1; k < rows.length; k++) {
  const { y, p } = rows[k], used = new Set();
  const dy = y - rows[k - 1].y;
  for (const t of tracks) {
    if (t.dead) continue;
    const pred = t.last + t.slope * dy;
    let best = -1, bd = 1e9;
    for (let i = 0; i < p.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(p[i] - pred);
      if (d < bd) { bd = d; best = i; }
    }
    const tol = Math.max(6, W * 0.012);
    if (best >= 0 && bd <= tol) {
      used.add(best);
      t.slope = (p[best] - t.last) / dy;
      t.last = p[best];
      t.pts.push([p[best], y]);
    } else t.miss = (t.miss || 0) + 1;
    if ((t.miss || 0) > 4) t.dead = true;
  }
}

// 최소제곱 직선 적합 — x = a·y + b
const fit = pts => {
  const n = pts.length; let sy = 0, sx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sy += y; sx += x; syy += y * y; sxy += x * y; }
  const den = n * syy - sy * sy; if (Math.abs(den) < 1e-9) return null;
  return { a: (n * sxy - sy * sx) / den, b: (sx * syy - sy * sxy) / den, n };
};
const lines = tracks.filter(t => t.pts.length >= ROWS * 0.35).map(t => fit(t.pts)).filter(Boolean);
console.log(`\n살아남은 선 ${lines.length}개 (추적 길이 ${ROWS * 0.35 | 0}행 이상)`);
lines.forEach((l, i) => console.log(`  선${i + 1}  x = ${l.a.toFixed(4)}·y + ${l.b.toFixed(1)}   (점 ${l.n}개)`));
if (lines.length < 3) { console.log('\n선이 3개 미만 — 관심영역이나 문턱을 조정해야 합니다.'); process.exit(1); }

// ── 소실점 = 모든 직선에 가장 가까운 점 (최소제곱).
//    쌍별 교점의 중앙값은 거의 평행한 두 선이 끼면 값이 튄다 — 그래서 전체를 한 번에 푼다.
//    직선 x - a·y - b = 0 의 법선은 (1, -a)/√(1+a²).
let S11 = 0, S12 = 0, S22 = 0, T1 = 0, T2 = 0;
for (const l of lines) {
  const w = 1 / Math.sqrt(1 + l.a * l.a);
  const nx = 1 * w, ny = -l.a * w, c = -l.b * w;     // nx·X + ny·Y + c = 0
  S11 += nx * nx; S12 += nx * ny; S22 += ny * ny;
  T1 -= nx * c;   T2 -= ny * c;
}
const det = S11 * S22 - S12 * S12;
const VPx = (T1 * S22 - T2 * S12) / det;
const VPy = (S11 * T2 - S12 * T1) / det;
console.log(`\n최소제곱 소실점 (${VPx.toFixed(1)}, ${VPy.toFixed(1)})`);
console.log('  선별 잔차(소실점까지의 수직거리):');
let worst = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i], w = 1 / Math.sqrt(1 + l.a * l.a);
  const d = Math.abs((VPx - l.a * VPy - l.b) * w);
  worst = Math.max(worst, d);
  console.log(`    선${i + 1}  ${d.toFixed(1)}px`);
}
console.log(`  최대 잔차 ${worst.toFixed(1)}px — 작을수록 한 점에서 만난다`);

const cx = W / 2, cy = H / 2;
console.log(`\n화면 중심 (${cx}, ${cy}) · 지평선이 중심보다 ${(cy - VPy).toFixed(1)}px ${VPy < cy ? '위' : '아래'}`);
console.log('\n세로화각   f(px)    하향각      원본6688폭 기준 f');
console.log('─'.repeat(52));
for (const vfov of [40, 45, 50, 55, 60, 65, 70]) {
  const f = (H / 2) / Math.tan(vfov * Math.PI / 360);
  const pitch = Math.atan((cy - VPy) / f) * 180 / Math.PI;
  console.log(`  ${String(vfov).padStart(2)}°    ${f.toFixed(0).padStart(6)}   ${pitch.toFixed(2).padStart(6)}°       ${(f * 6688 / W).toFixed(0)}`);
}
console.log(`\nVP(원본 6688x3764 기준) = (${(VPx * 6688 / W).toFixed(0)}, ${(VPy * 3764 / H).toFixed(0)})`);
