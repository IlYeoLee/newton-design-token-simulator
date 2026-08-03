// ─────────────────────────────────────────────────────────────
// 코치 클립의 '펀치 순간'을 찾는다 — 마커 박자를 눈대중으로 맞추지 않기 위해.
//
//   마커(session.js 의 AT)와 실루엣이 어긋나면 "타이밍이 아무것도 안 맞는" 화면이 된다.
//   클립을 갈거나 자를 때마다 이걸로 다시 재서 AT 를 고쳐라. 추측하지 말 것.
//
//   원리: 프레임 간 밝기 차이의 국소 최대 = 몸이 가장 빨리 움직인 순간 = 뻗는 순간.
//         같은 펀치의 '뻗음/거둠'이 두 봉우리로 나오므로 0.45초 안쪽은 하나로 합친다.
//
//   사용: node scripts/find_clip_beats.mjs public/ghost/bx_c3_combo.mp4 [--graph]
// ─────────────────────────────────────────────────────────────
import { execFileSync } from 'child_process';
import fs from 'fs';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('사용: node scripts/find_clip_beats.mjs <클립>'); process.exit(1); }
const GRAPH = process.argv.includes('--graph');
const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const W = 64, H = 64, FPS = 30;   // 64×64 회색이면 충분하다 — 우린 '얼마나 움직였나'만 본다

const raw = execFileSync(FF, ['-v', 'error', '-i', src,
  '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
const N = Math.floor(raw.length / (W * H));
const d = [];
for (let f = 1; f < N; f++) {
  let s = 0;
  for (let i = 0; i < W * H; i++) s += Math.abs(raw[f * W * H + i] - raw[(f - 1) * W * H + i]);
  d.push(s / (W * H));
}
// 3프레임 이동평균 — 압축 잡음이 만드는 잔떨림이 가짜 봉우리를 만든다
const sm = d.map((_, i) => (d[Math.max(0, i - 1)] + d[i] + d[Math.min(d.length - 1, i + 1)]) / 3);
const peaks = [];
for (let i = 2; i < sm.length - 2; i++)
  if (sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > sm[i - 2] && sm[i] > sm[i + 2] && sm[i] > 1.5)
    peaks.push([+((i + 1) / FPS).toFixed(2), +sm[i].toFixed(2)]);
const merged = [];
for (const p of peaks) {
  const l = merged[merged.length - 1];
  if (l && p[0] - l[0] < 0.45) { if (p[1] > l[1]) merged[merged.length - 1] = p; }
  else merged.push(p);
}

console.log(`${src} — ${(N / FPS).toFixed(2)}초`);
console.log('동작 봉우리:', merged.map(p => `${p[0]}s(${p[1]})`).join('  ') || '없음');
if (merged.length >= 2) {
  const gaps = merged.slice(1).map((p, i) => +(p[0] - merged[i][0]).toFixed(2));
  console.log('간격:', gaps.join(' · ') + '초');
}
console.log('→ session.js 의 AT 에 이 시각을 그대로 넣는다. CY 는 클립 길이와 같게.');
if (GRAPH) {
  const max = Math.max(...sm);
  for (let f = 0; f < sm.length; f += 3)
    console.log(((f + 1) / FPS).toFixed(2).padStart(5), '█'.repeat(Math.round(sm[f] / max * 46)), sm[f].toFixed(1));
}
