// 베이크 클립(json)에서 시간 창을 잘라 독립 클립 생성 + 힙 XZ 순이동 리베이스(루프 이음새 무이동)
// 사용: node scripts/trim_clip.mjs <src> <dst> <t0> <t1> [cat]
import fs from 'fs';
const [src, dst, T0s, T1s, cat] = process.argv.slice(2);
const T0 = +T0s, T1 = +T1s;
const clip = JSON.parse(fs.readFileSync(`assets/mocap/auto/${src}.json`, 'utf8'));
const out = { ...clip, name: dst, duration: T1 - T0, tracks: [] };
for (const t of clip.tracks) {
  const stride = t.name.endsWith('.quaternion') ? 4 : 3;
  const idx = [];
  for (let i = 0; i < t.times.length; i++) if (t.times[i] >= T0 - 1e-6 && t.times[i] <= T1 + 1e-6) idx.push(i);
  const times = idx.map(i => t.times[i] - T0);
  const values = [];
  for (const i of idx) for (let k = 0; k < stride; k++) values.push(t.values[i * stride + k]);
  // 힙 포지션: XZ 순이동 선형 제거 — 창 끝 위치 = 창 시작 위치 (루프 시 몸 순간이동 방지)
  if (t.name === 'mixamorigHips.position' && idx.length > 1) {
    const n = idx.length, dx = values[(n - 1) * 3] - values[0], dz = values[(n - 1) * 3 + 2] - values[2];
    for (let j = 0; j < n; j++) { const w = j / (n - 1); values[j * 3] -= dx * w; values[j * 3 + 2] -= dz * w; }
  }
  out.tracks.push({ ...t, times, values });
}
fs.writeFileSync(`assets/mocap/auto/${dst}.json`, JSON.stringify(out));
const MP = 'assets/mocap/auto/auto-manifest.json';
const man = JSON.parse(fs.readFileSync(MP, 'utf8'));
man[dst] = { ...(man[src] || {}), dur: +(T1 - T0).toFixed(2), cat: cat || man[src]?.cat };
fs.writeFileSync(MP, JSON.stringify(man, null, 1));
console.log('생성', dst, (T1 - T0).toFixed(1) + 's');
