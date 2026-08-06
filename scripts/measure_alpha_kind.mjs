// 알파의 **성격**을 잰다 — 프리멀티플라이드인가, 스트레이트인가, 커버리지 매트인가.
//   왜: 에펙에서 "가장자리에 검은 테가 뜬다 / 색이 뜬다" 는 대개 Interpret Footage 의
//   알파 해석이 틀린 것이다. 눈으로는 못 가리고, 이 한 수치로 즉시 갈린다.
//
//   판정 기준 — 프리멀티플라이드(검정 매트)면 정의상 **RGB ≤ alpha** 다(RGB = 색 × 알파).
//     평균 max(RGB)/alpha ≈ 1.0  이고  RGB>alpha 픽셀 ≈ 0%   → Premultiplied
//     평균이 1 을 넘고 RGB>alpha 가 유의미하게 있다            → Straight (Unmatted)
//
//   뉴턴 파이프라인은 알파를 휘도에서 뽑는다(scene.js: alpha = 휘도 × 1.8)라
//   **스트레이트**로 나온다. 자세한 근거는 KNOWN-ISSUES.md 의 '알파는 매트가 아니라 빛의 세기'.
//
//   node scripts/measure_alpha_kind.mjs <PNG파일>
import fs from 'fs';
import pkg from 'pngjs';
const { PNG } = pkg;

const file = process.argv[2];
if (!file) { console.error('사용법: node scripts/measure_alpha_kind.mjs <PNG파일>'); process.exit(1); }
const p = PNG.sync.read(fs.readFileSync(file));

const A_MIN = 8;   // 알파 8 미만은 사실상 투명(export_video.mjs coverage 와 같은 기준)
let n = 0, sum = 0, over = 0, full = 0, semi = 0;
const bins = new Array(10).fill(0);
for (let i = 0; i < p.data.length; i += 4) {
  const a = p.data[i + 3];
  if (a < A_MIN) continue;
  const L = Math.max(p.data[i], p.data[i + 1], p.data[i + 2]);
  if (a >= 250) full++; else semi++;
  if (L > a) over++;
  sum += L / a;
  n++;
  bins[Math.min(9, Math.floor(a / 25.6))]++;
}
if (!n) { console.log('내용이 없다(전 픽셀 투명).'); process.exit(0); }

const ratio = sum / n, overPct = over / n * 100;
console.log(`${file}  ${p.width}×${p.height}`);
console.log(`내용 픽셀 ${n}  |  완전불투명 ${full}  |  반투명 ${semi}`);
console.log(`평균 max(RGB)/alpha = ${ratio.toFixed(3)}   (1.0 = 프리멀티플라이드)`);
console.log(`RGB > alpha 인 픽셀 ${over} (${overPct.toFixed(2)}%)   (프리멀티면 0% 여야 한다)`);
console.log(`알파 히스토그램(0→255, 10칸) ${bins.join(' ')}`);
console.log(`\n판정: ${overPct < 1 && Math.abs(ratio - 1) < 0.05 ? 'Premultiplied — AE 에서 프리멀티(검정 매트)로 읽을 것'
  : 'Straight (Unmatted) — AE 에서 직선으로 읽고 Add/Screen 으로 얹을 것'}`);
