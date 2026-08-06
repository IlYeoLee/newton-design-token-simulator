// 강조 타원(원형 토큰) 궤적 — 랜드마크 실측에서 굽는다. 추측 좌표 금지.
//   출력: public/stepback-hotspots.json  { fps, t0, t1, pts:[{t, foot:[x,y], gaze:[x,y], r}] }
//   좌표계 = **패널 uv** (x 그대로 · y 는 1-y : 영상 y 아래 → uv y 위)
import { readFileSync, writeFileSync } from 'fs';
const D = JSON.parse(readFileSync('assets/mocap/stepback_fwd-landmarks.json', 'utf8'));
const F = D.frames.filter(f => f.lm);
const T0 = 1.05, T1 = 2.20;                       // STEP_SEG 전체 재생 구간(정본과 같은 값)
const uv = ([x, y]) => [+x.toFixed(4), +(1 - y).toFixed(4)];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
// 국면 = 실측 속도 경계. 각 국면에서 '지금 움직이는 발'이 주목 대상이다.
const phaseOf = t => (t < 1.50 ? 'R' : t < 1.75 ? 'L' : 'BOTH');
const pts = [];
for (const f of F) {
  if (f.t < T0 - 1e-6 || f.t > T1 + 1e-6) continue;
  const ph = phaseOf(f.t);
  const A = { L: f.lm[27], R: f.lm[28] };         // 발목
  const foot = ph === 'BOTH' ? mid(A.L, A.R) : A[ph];
  // 시선이 닿아야 할 곳 = 공(두 손목 사이). 개더 전엔 드리블 손, 개더 후엔 두 손 사이 그대로.
  const gaze = mid(f.lm[15], f.lm[16]);
  // 반경 = 그 국면 발 이동량에 비례(움직임이 클수록 크게) — 최소 0.055
  const nx = F[Math.min(F.length - 1, F.indexOf(f) + 3)];
  const spd = nx ? Math.hypot(nx.lm[ph === 'L' ? 27 : 28][0] - f.lm[ph === 'L' ? 27 : 28][0],
                              nx.lm[ph === 'L' ? 27 : 28][1] - f.lm[ph === 'L' ? 27 : 28][1]) : 0;
  pts.push({ t: f.t, ph, foot: uv(foot), gaze: uv(gaze), r: +Math.min(0.13, 0.055 + spd * 0.9).toFixed(4) });
}
const out = { src: 'stepback_fwd.mp4', fps: D.fps, t0: T0, t1: T1, n: pts.length, pts };
writeFileSync('public/stepback-hotspots.json', JSON.stringify(out));
console.log(`${pts.length} 프레임 · ${T0}~${T1}s`);
for (const p of pts.filter((_, i) => i % 4 === 0))
  console.log(`  t=${p.t.toFixed(3)} ${p.ph.padEnd(4)} 발(${p.foot[0].toFixed(3)}, ${p.foot[1].toFixed(3)}) 공(${p.gaze[0].toFixed(3)}, ${p.gaze[1].toFixed(3)}) r=${p.r}`);
