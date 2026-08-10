// 주목 비트 — **따라다니지 않는다.** 동작이 일어날 때 '거기 하나'가 생기고, 도착에 딱 붙는다.
//   비트마다 { 시작, 도착, 도착 지점(고정), 부위, 보이스 }. 좌표·시각 전부 랜드마크 실측.
//   출력: public/stepback-hotspots.json   원본: assets/mocap/<클립>-landmarks.json
//   실행: node scripts/build_stepback_hotspots.mjs [클립.mp4]  — **지금 재생 중인 클립**을 준다.
//   ★ 랜드마크는 클립별이다. 08-07 클립 교체(stepback_fwd → stepback_pack) 후에도 구 클립
//     실측으로 굽고 있어서 원이 발에 안 붙었다(유저 스샷) — 크롭·패딩이 다르면 uv 가 어긋난다.
import { readFileSync, writeFileSync } from 'fs';
const SRC = process.argv[2] || 'stepback_pack.mp4';
const D = JSON.parse(readFileSync(`assets/mocap/${SRC.replace(/\.\w+$/, '')}-landmarks.json`, 'utf8'));
const F = D.frames.filter(f => f.lm);
const at = t => F.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a);
const spd = (i, k) => i <= 0 ? 0 : Math.hypot(F[i].lm[k][0] - F[i-1].lm[k][0], F[i].lm[k][1] - F[i-1].lm[k][1]) * D.fps;
const uv = ([x, y]) => [+x.toFixed(4), +(1 - y).toFixed(4)];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// 국면 정의 = 실측 속도 버스트 3개. 각 국면에서 **움직이는 관절**과 탐색 창만 준다 —
//   시작/도착 시각은 속도 문턱으로 찾는다(손으로 안 찍는다).
const TH = 0.35;   // /초. 정지 구간 잡음(≤0.10)보다 충분히 위, 버스트 최저(1.16)보다 아래
const PHASES = [
  { key: 'R1', joint: 28, win: [1.10, 1.52], part: '오른발', voice: '오른발' },
  { key: 'L',  joint: 27, win: [1.45, 1.80], part: '왼발',   voice: '왼발' },
  { key: 'R2', joint: 28, win: [1.78, 2.20], part: '모으기', voice: '모아' },
];
const beats = PHASES.map(p => {
  const idx = F.map((f, i) => i).filter(i => F[i].t >= p.win[0] && F[i].t <= p.win[1]);
  const hot = idx.filter(i => spd(i, p.joint) > TH);
  const iOn = hot[0], iLand = hot[hot.length - 1];
  const fLand = F[iLand];
  // 도착 지점 = **그 발이 멈춘 자리**(모으기는 두 발 중점 — 지시가 '모아'니까)
  const pt = p.key === 'R2' ? mid(fLand.lm[27], fLand.lm[28]) : fLand.lm[p.joint];
  const peak = Math.max(...hot.map(i => spd(i, p.joint)));
  return { key: p.key, part: p.part, voice: p.voice,
    tOn: +F[iOn].t.toFixed(3), tLand: +fLand.t.toFixed(3),
    at: uv(pt), r: +(0.055 + Math.min(0.045, peak * 0.012)).toFixed(4), peak: +peak.toFixed(2) };
});
const out = { src: SRC, t0: 1.05, t1: 2.20, th: TH, beats };
writeFileSync('public/stepback-hotspots.json', JSON.stringify(out, null, 1));
for (const b of beats)
  console.log(`${b.key.padEnd(3)} ${b.part.padEnd(5)} 시작 ${b.tOn} → 도착 ${b.tLand} (${(b.tLand-b.tOn).toFixed(2)}s)  지점(${b.at[0]}, ${b.at[1]})  r=${b.r}  최고속도 ${b.peak}  "${b.voice}"`);
console.log(`\n0.5배속 실시간: ${((out.t1-out.t0)*2).toFixed(2)}s · 비트 간격 ${beats.map((b,i)=>i?((b.tOn-beats[i-1].tOn)*2).toFixed(2)+'s':'').filter(Boolean).join(' / ')}`);
