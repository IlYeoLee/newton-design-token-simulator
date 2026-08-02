// 깜빡임 계측 — PNG 시퀀스의 프레임 간 변화량을 숫자로 본다.
//   '깜빡인다'는 눈의 보고다. 고치기 전에 어느 프레임이 얼마나 튀는지 수치로 잡아야
//   무엇을 되돌렸을 때 사라졌는지 말할 수 있다.
//   사용: node scripts/measure_flicker.mjs out/xxx_png
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.error('사용: node scripts/measure_flicker.mjs <PNG 시퀀스 폴더>'); process.exit(1); }
const files = fs.readdirSync(dir).filter(f => /^f\d+\.png$/.test(f)).sort();

let prev = null, prevCov = null;
const rows = [];
for (const f of files) {
  const p = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  let opaque = 0, lum = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    const a = p.data[i + 3];
    if (a >= 8) { opaque++; lum += (p.data[i] * 0.299 + p.data[i + 1] * 0.587 + p.data[i + 2] * 0.114) * (a / 255); }
  }
  const cov = opaque / (p.width * p.height) * 100;
  // 프레임 간 절대차 — 알파 채널만 본다(인물이 사라졌다 나타나는 게 깜빡임의 정의)
  let d = 0;
  if (prev) { for (let i = 3; i < p.data.length; i += 4) d += Math.abs(p.data[i] - prev[i]); }
  const diff = prev ? d / (p.width * p.height) / 255 * 100 : 0;
  rows.push({ f, cov, diff, dcov: prevCov == null ? 0 : cov - prevCov });
  prev = p.data; prevCov = cov;
}
const diffs = rows.slice(1).map(r => r.diff);
const med = [...diffs].sort((a, b) => a - b)[Math.floor(diffs.length / 2)] || 0;
const maxD = Math.max(...rows.slice(1).map(r => Math.abs(r.dcov)));
console.log(`${files.length}프레임 · 알파 변화량 중앙값 ${med.toFixed(2)}% · 커버리지 최대 변화 ${maxD.toFixed(2)}%p`);
// ★ '깜빡임'의 정의는 **내용이 사라졌다 나타나는 것**이다. 알파 변화량만 보면 안 된다 —
//   화면이 안정적일수록 중앙값이 0 에 가까워져서 미세한 변화도 '중앙값의 3배'를 넘는다
//   (실측: 커버리지가 ±0.02%p 밖에 안 움직이는데 튄 프레임 18개로 잡혔다 — 거짓 경보).
//   그래서 **커버리지가 실제로 크게 움직였는지**를 함께 요구한다. 진짜 깜빡임은
//   커버리지가 몇 %p 단위로 오르내린다(실측: 인물이 사라지던 판본은 ±5%p).
const spikes = rows.slice(1).filter(r => r.diff > Math.max(med * 3, 1.0) && Math.abs(r.dcov) >= 1.0);
console.log(`튄 프레임 ${spikes.length}개${spikes.length ? ':' : ' — 깜빡임 없음'}`);
for (const r of spikes.slice(0, 20)) console.log(`  ${r.f}  알파변화 ${r.diff.toFixed(2)}%  커버리지 ${r.cov.toFixed(2)}% (${r.dcov >= 0 ? '+' : ''}${r.dcov.toFixed(2)})`);
