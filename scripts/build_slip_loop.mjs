// 회피 스텝(B2) 코치 클립 조립기 — 생성 모델이 못 지키는 '정확한 횟수·일정 템포'를 편집으로 만든다.
//
// 왜 이런 방식인가: 영상 모델은 "좌우 6회를 일정 템포로"를 못 지킨다. 실측으로 확인했다
//   (구 bx_b2_slip.mp4: 템포 편차 32% · 12초에 왕복 1.5회 · 뒤 절반은 역재생 팰린드롬).
//   그래서 모델에는 '전이 한 번'만 시키고(시작·끝 포즈를 이미지로 못 박아서), 박자는 여기서 만든다.
//
//   node scripts/build_slip_loop.mjs <A.mp4> <LR.mp4> <RL.mp4> <out.mp4> [beat=1.0]
//
//     A   중립 정면(팔 내림) → 가드 올리기 → 좌 슬립   ※ 인트로와 1회차가 한 클립에 들어 있다
//     LR  좌 슬립 → 우 슬립
//     RL  우 슬립 → 좌 슬립
//
//   출력  [인트로] + 좌 우 좌 우 좌 우  = 중립에서 시작해 매 회 정확히 beat 초
//
// 구간은 눈이 아니라 프레임에서 찾는다: 크로마 배경을 걷어내고 머리 x 를 재서 움직이는 구간만 남긴다.
//   A 의 '팔 올리기'는 머리가 거의 안 움직이므로 이 기준에서 자동으로 인트로 쪽으로 갈린다.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const FF = createRequire(import.meta.url)('ffmpeg-static');
const [A, LR, RL, OUT, beatArg] = process.argv.slice(2);
if (!OUT) { console.error('사용: node scripts/build_slip_loop.mjs <A> <LR> <RL> <out.mp4> [beat=1.0]'); process.exit(1); }
const BEAT = +(beatArg || 1.0), FPS = 24, W = 1080, H = 1920, NF = Math.round(BEAT * FPS);
const tmp = mkdtempSync(path.join(tmpdir(), 'slip-'));
const run = a => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...a]);

/** 프레임별 머리 위치 {x,y}(0..1) — 크로마 그린 제거 후 인물 최상단 밴드의 무게중심 + 정수리 높이.
 *  y 가 필요한 이유: 슬립은 옆으로만 가는 게 아니라 '웅크리며' 간다. A(중립→좌)는 앞 2초 동안
 *  팔만 올리는데 머리 x 는 0.499 로 못 박혀 있고, 웅크림(정수리 y)이 먼저 움직인다.
 *  x 만 보면 그 2초를 슬립으로 오인해 인트로가 사라진다(실제로 밟았다). */
function headTrack(src) {
  const w = 120, h = 213, raw = path.join(tmp, path.basename(src) + '.rgb');
  run(['-i', src, '-vf', `fps=${FPS},scale=${w}:${h}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', raw]);
  const buf = readFileSync(raw), n = buf.length / (w * h * 3), out = [];
  for (let f = 0; f < n; f++) {
    const off = f * w * h * 3, m = new Uint8Array(w * h);
    let bot = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = off + (y * w + x) * 3;
      if (buf[i + 1] > 90 && buf[i + 1] - buf[i] > 40 && buf[i + 1] - buf[i + 2] > 40) continue;
      m[y * w + x] = 1; if (y > bot) bot = y;
    }
    let top = -1;
    for (let y = 0; y < h && top < 0; y++) { let c = 0; for (let x = 0; x < w; x++) c += m[y * w + x]; if (c >= 3) top = y; }
    if (top < 0 || bot <= top) { out.push(out[out.length - 1] ?? 0.5); continue; }
    const band = Math.max(1, Math.round((bot - top) * 0.10));
    let sx = 0, sn = 0;
    for (let y = top; y < top + band; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { sx += x; sn++; }
    const prev = out[out.length - 1];
    out.push({ x: sn ? (sx / sn) / w : (prev?.x ?? 0.5), y: top / h });
  }
  return out;
}

/** 머리가 실제로 움직이는 구간 [s,e]. 머리 궤적의 '누적 이동거리'로 잡는다 —
 *  가로만 보면 웅크림이 안 잡히고, 세로만 보면 좌우 이동이 안 잡힌다. 양끝의 정지 홀드는 버린다. */
function motionWindow(H2) {
  const cum = [0];
  for (let i = 1; i < H2.length; i++) {
    const dx = H2[i].x - H2[i - 1].x, dy = H2[i].y - H2[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const tot = cum[cum.length - 1];
  if (tot < 0.02) return [0, H2.length - 1];
  const EDGE = 0.06;
  let s = 0, e = H2.length - 1;
  while (s < e && cum[s] / tot < EDGE) s++;
  while (e > s && cum[e] / tot > 1 - EDGE) e--;
  return [Math.max(0, s - 1), Math.min(H2.length - 1, e + 1)];
}

/** 한 프레임의 인물 치수 — 키·바닥선·발 x, 그리고 배경 그린 평균색.
 *  소스마다 레퍼런스 이미지의 프레이밍이 달라서(실측: 발 위치가 세로 12.8% 어긋났다)
 *  이걸 재서 맞추지 않으면 이어붙이는 순간 인물이 위아래로 튄다. */
function metrics(src, frame) {
  const w = 120, h = 213, raw = path.join(tmp, 'm' + path.basename(src) + '.rgb');
  run(['-i', src, '-vf', `fps=${FPS},scale=${w}:${h}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', raw]);
  const buf = readFileSync(raw), off = frame * w * h * 3, m = new Uint8Array(w * h);
  let bot = -1, gr = 0, gg = 0, gb = 0, gn = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = off + (y * w + x) * 3, r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (g > 90 && g - r > 40 && g - b > 40) { if (y < h * 0.12) { gr += r; gg += g; gb += b; gn++; } continue; }
    m[y * w + x] = 1; if (y > bot) bot = y;
  }
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) { let c = 0; for (let x = 0; x < w; x++) c += m[y * w + x]; if (c >= 3) top = y; }
  let fx = 0, fn = 0;
  for (let y = bot - Math.max(1, Math.round((bot - top) * 0.05)); y <= bot; y++)
    for (let x = 0; x < w; x++) if (m[y * w + x]) { fx += x; fn++; }
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return { hgt: (bot - top) / h, bot: bot / h, footX: fx / fn / w,
           bg: '0x' + hex(gr / gn) + hex(gg / gn) + hex(gb / gn) };
}

const frameDirs = new Map();
/** 원본을 PNG 시퀀스로 한 번만 펼친다. align 이 있으면 기준 소스에 맞춰 크기·위치를 정렬한다:
 *  자기 배경색으로 칠한 캔버스 위에 스케일한 영상을 얹는다(overlay 는 음수 좌표도 받는다). */
function frames(src, align) {
  if (frameDirs.has(src)) return frameDirs.get(src);
  const dir = path.join(tmp, 'f' + frameDirs.size);
  mkdirSync(dir, { recursive: true });
  const vf = align
    ? `fps=${FPS},scale=${Math.round(W * align.k)}:${Math.round(H * align.k)}`
    : `fps=${FPS},scale=${W}:${H}`;
  const args = align
    ? ['-f', 'lavfi', '-i', `color=c=${align.bg}:s=${W}x${H}:r=${FPS}`, '-i', src,
       '-filter_complex', `[1:v]${vf}[fg];[0:v][fg]overlay=${Math.round(align.dx)}:${Math.round(align.dy)}:shortest=1`,
       '-start_number', '0', '-y', path.join(dir, 'f%04d.png')]
    : ['-i', src, '-vf', vf, '-start_number', '0', '-y', path.join(dir, 'f%04d.png')];
  run(args);
  frameDirs.set(src, dir);
  return dir;
}

/** [s,e] 를 정확히 NF 프레임으로 리샘플.
 *  ★ 등속(ease=false)이 기본이다. ease-in-out 을 걸었더니 양끝(느린 구간)에서 같은 원본
 *  프레임을 여러 번 집어 26~30% 가 중복 프레임이 됐고 그게 '뚝뚝 끊김'으로 보였다(유저).
 *  소스에 이미 자연스러운 가감속이 들어 있으므로 등속으로 뽑아야 그 곡선이 그대로 산다. */
function seg(src, s, e, tag, ease = false, align = null) {
  const dir = frames(src, align), lines = [];
  for (let i = 0; i < NF; i++) {
    const u = NF === 1 ? 0 : i / (NF - 1);
    const k = ease ? (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2) : u;
    const f = Math.round(s + k * (e - s));
    lines.push(`file '${path.join(dir, 'f' + String(f).padStart(4, '0') + '.png').replace(/\\/g, '/')}'`);
    lines.push(`duration ${(1 / FPS).toFixed(6)}`);
  }
  const lf = path.join(tmp, `${tag}.txt`);
  writeFileSync(lf, lines.join('\n') + '\n');
  const out = path.join(tmp, `${tag}.mp4`);
  run(['-f', 'concat', '-safe', '0', '-i', lf, '-r', String(FPS), '-c:v', 'libx264', '-crf', '14',
       '-pix_fmt', 'yuv420p', '-g', '1', '-an', '-y', out]);
  return out;
}

const rep = (n, t, [s, e]) => console.log(
  `${n}  ${t.length}프레임 · 움직임 ${s}~${e} (${((e - s) / FPS).toFixed(2)}s) · ` +
  `머리x ${Math.min(...t.map(p => p.x)).toFixed(3)}~${Math.max(...t.map(p => p.x)).toFixed(3)} · ` +
  `정수리y ${Math.min(...t.map(p => p.y)).toFixed(3)}~${Math.max(...t.map(p => p.y)).toFixed(3)}`);
const trA = headTrack(A), [sA, eA] = motionWindow(trA);
rep('A ', trA, [sA, eA]);
console.log(`   → 인트로 0~${sA} (${(sA / FPS).toFixed(2)}s 정지·팔 올리기) · 1회차 슬립 ${sA}~${eA}`);
const trLR = headTrack(LR), winLR = motionWindow(trLR); rep('LR', trLR, winLR);
const trRL = headTrack(RL), winRL = motionWindow(trRL); rep('RL', trRL, winRL);

// ── 프레이밍 정렬 — A(기준) 의 슬립 끝 자세에 LR·RL 을 맞춘다 ──────────────────
// 소스마다 레퍼런스 이미지의 인물 크기·위치가 달랐다(실측: 발 위치 세로 12.8% 차이).
// 그대로 이으면 매 비트마다 인물이 위아래로 튄다.
// ★ 반드시 '같은 자세'끼리 비교해야 한다. 기준은 A 의 끝 = 좌 슬립이므로
//   LR 은 좌에서 시작하니 그 시작 프레임을, RL 은 좌로 끝나니 그 끝 프레임을 잰다.
//   자세가 다른 프레임끼리 재면 스탠스가 좌우 대칭이라 발 x 가 189px 이나 어긋난다(실제로 밟았다).
const ref = metrics(A, eA);
function alignTo(src, at) {
  const m = metrics(src, at);
  const k = ref.hgt / m.hgt;                                   // 키를 기준에 맞춘다
  const dy = (ref.bot - m.bot * k) * H;                        // 바닥선(발 접지)을 맞춘다
  const dx = (ref.footX - m.footX * k) * W;                    // 발 x 를 맞춘다
  console.log(`정렬 ${path.basename(src)}: 배율 ${k.toFixed(4)} · dx ${dx.toFixed(0)}px · dy ${dy.toFixed(0)}px · 배경 ${m.bg}`);
  return { k, dx, dy, bg: m.bg };
}
const alLR = alignTo(LR, winLR[0]), alRL = alignTo(RL, winRL[1]);   // 둘 다 '좌 슬립' 프레임

const parts = [
  seg(A, 0, sA, 'intro', false),                       // 인트로 = 중립 정면에서 가드 올리기(등속)
  seg(A, sA, eA, 'b1', false),                                // 1 좌
  seg(LR, winLR[0], winLR[1], 'b2', false, alLR),       // 2 우
  seg(RL, winRL[0], winRL[1], 'b3', false, alRL),       // 3 좌
  seg(LR, winLR[0], winLR[1], 'b4', false, alLR),       // 4 우
  seg(RL, winRL[0], winRL[1], 'b5', false, alRL),       // 5 좌
  seg(LR, winLR[0], winLR[1], 'b6', false, alLR),       // 6 우
];
const cl = path.join(tmp, 'all.txt');
writeFileSync(cl, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n');
const joined = path.join(tmp, 'joined.mp4');
run(['-f', 'concat', '-safe', '0', '-i', cl, '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p',
     '-r', String(FPS), '-an', '-y', joined]);

// ── 마무리 프레이밍 — 인물이 화면을 채우게 잘라 낸다 ────────────────────────────
// 생성물은 머리 위에 빈 그린이 34% 남아 코치가 작게 나온다(실측 키 0.600).
// 구 클립은 0.75~0.88 이었다 — 그대로 쓰면 벽에서 코치만 25% 작아진다.
// 전 프레임의 인물 bbox 합집합을 구해 위 6% · 아래 4% 여백만 남기고 자른다.
{
  const w = 120, h = 213, raw = path.join(tmp, 'fin.rgb');
  run(['-i', joined, '-vf', `fps=${FPS},scale=${w}:${h}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', raw]);
  const buf = readFileSync(raw), n = buf.length / (w * h * 3);
  let top = h, bot = -1, left = w, right = -1;
  for (let f = 0; f < n; f++) {
    const off = f * w * h * 3;
    for (let y = 0; y < h; y++) { let c = 0;
      for (let x = 0; x < w; x++) {
        const i = off + (y * w + x) * 3;
        if (buf[i + 1] > 90 && buf[i + 1] - buf[i] > 40 && buf[i + 1] - buf[i + 2] > 40) continue;
        c++; if (x < left) left = x; if (x > right) right = x;
      }
      if (c >= 3) { if (y < top) top = y; if (y > bot) bot = y; }
    }
  }
  const t0 = top / h, b0 = bot / h, cxN = ((left + right) / 2) / w;
  const cropTop = Math.max(0, t0 - 0.06), cropBot = Math.min(1, b0 + 0.04);
  const ch = Math.round((cropBot - cropTop) * H), cw = Math.round(ch * W / H);
  const cy = Math.round(cropTop * H);
  const cx = Math.max(0, Math.min(W - cw, Math.round(cxN * W - cw / 2)));
  console.log(`\n마무리 크롭: 인물 y ${t0.toFixed(3)}~${b0.toFixed(3)} → crop ${cw}x${ch}+${cx}+${cy} → ${W}x${H} (키 ${(b0 - t0).toFixed(3)} → ${((b0 - t0) / (cropBot - cropTop)).toFixed(3)})`);
  run(['-i', joined, '-vf', `crop=${cw}:${ch}:${cx}:${cy},scale=${W}:${H}:flags=lanczos`,
       '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-y', OUT]);
}

const beats = Array.from({ length: 6 }, (_, i) => +((i + 2) * BEAT).toFixed(3));
console.log(`\n완성: ${OUT}`);
console.log(`  인트로 ${BEAT}s + 슬립 6회 × ${BEAT}s = ${(7 * BEAT).toFixed(2)}s · ${FPS}fps · ${W}x${H}`);
console.log(`  비트(슬립이 가장 깊은 순간) = ${beats.join(' · ')}s`);
console.log('\nsrc/session.js 에 넣을 값:');
console.log(`  const BX_B2_CLIP = ${(7 * BEAT).toFixed(2)};`);
console.log('  const BX_B2_BEATS = [');
beats.forEach((t, i) => console.log(`    { t: ${t.toFixed(3)}, side: ${i % 2 === 0 ? '-1' : '+1'} },   // ${i + 1} ${i % 2 === 0 ? '좌' : '우'}`));
console.log('  ];');
