// 판에서 발자국 토큰만 **중앙 고정**으로 잘라낸다 — 재렌더 없음.
//
//   왜: 발자국은 x봇의 발을 따라가게 돼 있어서 평면 판에서 프레임마다 흔들린다(실측 543px).
//   실사 합성에서는 그 움직임을 **에펙에서 직접** 주는 게 맞다 — 실제 인물의 런지 타이밍은
//   시뮬 봇과 다르기 때문이다. 그래서 여기서는 흔들림을 없애고(중앙 고정) 조각으로 낸다.
//   상태 흐름(대기 → 활성 → 홀드 카운트 5→1 → 성공)은 판에 이미 다 들어 있으므로 그대로 딸려온다.
//
//   추적은 연결요소로 한다. 프레임마다 좌우 판정을 새로 하면 뒤집힐 수 있으므로(빔 마스크
//   꼭짓점이 뒤집혀 우글거리던 것과 같은 종류) **직전 위치에 가장 가까운 것**으로 잇는다.
//
//   사용: node scripts/cut_footmarks.mjs <판PNG폴더> [--out 폴더] [--size 560]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('판 PNG 시퀀스 폴더를 주세요'); process.exit(1); }
const OUT = arg('out', 'out/FOOTMARK_CUT');
const SIZE = +arg('size', 560);          // 잘라낼 정사각 창(판 px). 발자국 227×489 + 여유

const files = fs.readdirSync(SRC).filter(f => /\.png$/i.test(f)).sort();
const d0 = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
  'stream=width,height', '-of', 'csv=p=0', path.join(SRC, files[0])]).toString().trim().split(',');
const W = +d0[0], H = +d0[1];
const A = path.join(OUT, 'A'), B = path.join(OUT, 'B');
fs.mkdirSync(A, { recursive: true }); fs.mkdirSync(B, { recursive: true });
const TI = path.join(OUT, '_i.raw'), TO = path.join(OUT, '_o.raw');

// 발자국 후보 찾기 — 세로로 긴 중간 크기 덩어리
function blobs(P) {
  const lab = new Int32Array(W * H).fill(-1), st = [], res = [];
  let id = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = y * W + x;
    if (lab[q] !== -1 || P[q * 4 + 3] < 140) continue;
    let n = 0, sx = 0, sy = 0, mnx = x, mxx = x, mny = y, mxy = y;
    st.push(q); lab[q] = id;
    while (st.length) {
      const c = st.pop(), cx = c % W, cy = (c / W) | 0;
      n++; sx += cx; sy += cy;
      if (cx < mnx) mnx = cx; if (cx > mxx) mxx = cx;
      if (cy < mny) mny = cy; if (cy > mxy) mxy = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (lab[k] === -1 && P[k * 4 + 3] >= 140) { lab[k] = id; st.push(k); }
      }
    }
    const w = mxx - mnx + 1, h = mxy - mny + 1;
    if (n > 8000 && n < 120000 && h > w * 1.3 && h < H * 0.35) res.push({ x: sx / n, y: sy / n, n, id });
    id++;
  }
  return { res, lab };
}

const track = [null, null];     // 직전 위치 (A, B)
let logged = 0;
const t0 = Date.now();
for (let n = 0; n < files.length; n++) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SRC, files[n]),
    '-pix_fmt', 'rgba', '-f', 'rawvideo', TI]);
  const P = fs.readFileSync(TI);
  const { res: bs, lab } = blobs(P);
  // 직전 위치에 가장 가까운 것으로 잇는다(좌우 뒤집힘 방지). 첫 프레임은 x 순.
  let pick = [null, null];
  if (!track[0] && bs.length >= 2) { bs.sort((a, b) => a.x - b.x); pick = [bs[0], bs[1]]; }
  else {
    for (let k = 0; k < 2; k++) {
      if (!track[k]) continue;
      let best = null, bd = 1e9;
      for (const b of bs) { const d = Math.hypot(b.x - track[k].x, b.y - track[k].y); if (d < bd) { bd = d; best = b; } }
      if (best && bd < W * 0.25) pick[k] = best;
    }
  }
  for (let k = 0; k < 2; k++) if (pick[k]) track[k] = pick[k];

  for (let k = 0; k < 2; k++) {
    const c = pick[k] || null;          // 이번 프레임에 실제로 찾은 것만 그린다
    const win = track[k];               // 창 위치는 직전 값을 유지해 튀지 않게
    const out = Buffer.alloc(SIZE * SIZE * 4);
    if (c && win) {
      // ★ 그 덩어리에 속한 픽셀만 복사한다. 안 그러면 발자국이 사라진 뒤 인물이 창에 들어와
      //   같이 잘려 나온다(실측: 뒤쪽 프레임에 코치 실루엣이 끼어들었다).
      const x0 = Math.round(win.x - SIZE / 2), y0 = Math.round(win.y - SIZE / 2);
      for (let y = 0; y < SIZE; y++) {
        const sy = y0 + y; if (sy < 0 || sy >= H) continue;
        for (let x = 0; x < SIZE; x++) {
          const sx = x0 + x; if (sx < 0 || sx >= W) continue;
          const si = sy * W + sx;
          if (lab[si] !== c.id) continue;
          const s = si * 4, dst = (y * SIZE + x) * 4;
          out[dst] = P[s]; out[dst + 1] = P[s + 1]; out[dst + 2] = P[s + 2]; out[dst + 3] = P[s + 3];
        }
      }
    }
    fs.writeFileSync(TO, out);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
      '-s', `${SIZE}x${SIZE}`, '-i', TO, path.join(k ? B : A, files[n])]);
  }
  if ((n + 1) % 30 === 0 || n === files.length - 1) {
    process.stdout.write(`\r  ${n + 1}/${files.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s  ` +
      `발자국 ${bs.length}개 인식  `);
  }
}
fs.unlinkSync(TI); fs.unlinkSync(TO);
console.log(`\n✅ ${A}\n✅ ${B}   ${SIZE}×${SIZE} · 중앙 고정`);
