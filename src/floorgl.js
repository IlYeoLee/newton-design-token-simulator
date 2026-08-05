// 바닥 UI를 WebGL로 (B안) — floor-*.html 전부를 canvas 2D → CanvasTexture 평면으로 다시 그린다.
//
// 왜: CSS3DRenderer가 그리는 바닥 UI는 별도 DOM 레이어라 WebGL 깊이 버퍼를 공유하지 못해
// x봇 위로 통과한다(마스크 오버레이는 원리적 임시방편). 같은 씬의 평면이면 깊이 테스트가
// 공짜로 해결한다.
//
// 인터페이스는 기존과 동일하게 유지한다 — `doc.getElementById(id).textContent/style.…`를
// main.js 구동 코드가 그대로 쓴다(노드 = 그리기 스펙 겸 DOM 스텁). 이식 비용을 여기 한 파일에 가둔다.
import * as THREE from 'three';
import { arc as d3arc } from 'd3-shape';
import { PAL, NEU, rgba } from './palette.js';

const W = 1600, H = 2670;
const _mp = new THREE.Vector3(), _mf = new THREE.Vector3(), _mr = new THREE.Vector3();   // uiMask 임시   // 대지 px (floor-scene.html과 동일)
// 캔버스 해상도 — 화질과 업로드 비용의 저울.
//   0.5 = 글자가 흐리다(유저) / 1.0 = 프레임당 17MB 업로드라 전체가 느려진다(유저).
//   0.75(1200×2002, 9.6MB)가 두 불만을 모두 피하는 지점. 업로드는 값이 바뀐 프레임에만 일어난다.
// 캔버스 해상도 — 대지 대비 배율. 화질 vs 업로드 비용의 저울.
// ?uiscale=N 으로 올릴 수 있다 — 4K 영상 내보내기용. 실시간에선 0.75 가 예산이다
// (대지 통짜 업로드라 배율을 올리면 프레임당 MB가 제곱으로 는다).
// 씬 스테이지(?scene=)는 투사면이 화면 전체를 채우는 정면 뷰 — 기본 2 (벽 wallgl 과 동일 근거).
const _q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
// ★ 씬 스테이지 기본 2 → 1 (wallgl 과 같은 이유 — 실시간 전용 폴백이다. 익스포터는
//   항상 ?uiscale= 명시라 이 값을 안 탄다). 러닝 대지 1600×2670 은 K=2 에서 68MB/프레임이었다.
const K = Math.min(3, Math.max(0.4, +_q.get('uiscale') || (_q.get('scene') ? 1 : 0.75)));
// UI 재도색 주기. 모션을 이식한 뒤로 정지 화면이 없어져 매 틱 9.4~9.6MB 텍스처가 올라간다
// (24fps = 230MB/s). 씬 애니메이션이 '드드드득' 끊긴 원인 — UI 프레임을 씬보다 낮게 잡고
// 남는 예산을 봇·영상에 돌려준다. ?uifps=N 으로 8~60 비교 가능.
const UI_FPS = Math.max(4, Math.min(60, +(new URLSearchParams(location.search).get('uifps')) || 12));

const CX = W / 2;
// ── 세이프 밴드 — 빔이 실제로 닿는 캔버스 세로 구간(유저 승인 08-05) ────────────
//   커버리지 깊이 1.7m ÷ 캔버스 대응 깊이 2.47m ≈ 0.69. 대지 중앙 기준 그 폭만 쓴다.
//   SAFE.y0~y1 밖에 그린 요소는 투사면 밖으로 새므로, 새 조판은 반드시 이 안에서.
export const SAFE = { y0: 0, y1: 2480, get h() { return this.y1 - this.y0; } };   // 실측(대지 깊이 0.17~2.0m · near 0.30) — 아래 약 190px 만 빔 밖
// 투사 UI 서체 규칙(유저 확정): Supreme 두 굵기만 — Bold 700 · Regular 400.
// Freesentation·Pretendard 폴백은 은퇴(투사 UI는 영문 조판이고, 폴백이 끼면 자간이 달라진다).
const sans = "'Supreme',sans-serif";
// 수치 전용 페이스. 이걸 sans 로 바꾸면 문서 전체가 Supreme 2종만 남는다(유저가 원하면 한 줄).
const INF2 = Infinity;
const dot9 = "'OffBit','Supreme',sans-serif";
// 투사 UI 공통 타이포 스케일 — 대지 실값이 화면에선 조금 컸다(유저). 조판 좌표는 그대로 두고
// 글자만 줄인다. ?type=1 로 원래 크기.
export const TS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('type') === '1' ? 1 : 0.92;
const F = (w, s, fam = sans) => `${w} ${(s * TS).toFixed(2)}px ${fam}`;

const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

// ── 모션 ────────────────────────────────────────────────────────────────────
// 원본 floor-*.html의 @keyframes를 캔버스로 옮기기 위한 최소 도구.
// CSS는 타이밍 함수를 '키프레임 구간마다' 적용한다 — kf()도 그렇게 한다.
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const eOut = t => 1 - Math.pow(1 - t, 3);                           // cubic-bezier(.22,1,.36,1) 근사
export const eInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// `animation: X dur delay n` 의 진행도(0~1). 구간 밖이면 null(= 정적 스타일). n=Infinity면 무한 반복.
export const cycle = (t, delay, dur, n) => { const u = t - delay; return u < 0 || u >= dur * n ? null : (u % dur) / dur; };
// @keyframes 보간 — stops = [[0~1 위치, 값], …]
export const kf = (p, stops, ease = eInOut) => {
  for (let i = 1; i < stops.length; i++) {
    const [a, va] = stops[i - 1], [b, vb] = stops[i];
    if (p <= b) return va + (vb - va) * ease(b === a ? 1 : (p - a) / (b - a));
  }
  return stops[stops.length - 1][1];
};
// `both` fill 등장 애니메이션의 선형 진행도
export const intro = (t, delay, dur) => clamp01((t - delay) / dur);


/** 진행 게이지 — 지면(러닝·농구)과 벽(복싱)의 도트바를 이걸로 갈아끼웠다.
 *  정본 = 모바일 앱 기록 화면의 스코어 게이지(figma-prototype assets/gauge.js + report.css).
 *  도트 10개를 유지한 채 노브만 얹는 시안은 기각 — 도트는 '칸이 찼다'를 말하고 앱 게이지는
 *  '지금 여기까지 왔다'를 말한다. 형태를 바꿔야 규약이 같아진다(유저).
 *
 *  옮긴 공통 요소 다섯:
 *    ① 얕게 휜 호 — 앱의 타원(cx 180 · rx 261 · ry 188.5 · top 24, x 19~341) 그대로.
 *       322 단위를 폭 w 로 스케일하므로 휨 비율이 대지와 무관하게 같다.
 *    ② 꼬리 — 지나온 선이 머리에서 100%, 길이의 54% 뒤에서 0. 채운 트랙이 남지 않는다.
 *       (앱 tailFade: x1=머리, x2=호 시작. '끌려오는 자국'이지 별개 물건이 아니다.)
 *    ③ 글래스 노브 — 지름 39 안에 흰 코어 19(비율 0.487) 그대로.
 *    ④ 수치는 노브 밑(+40)에 붙어 같이 이동 — 머무는 숫자가 없다. OffBit.
 *    ⑤ 0 / max 끝 라벨.
 *  ★ 따뜻한 그라디언트 필드는 '칠'이 아니라 '빛'으로 옮겼다 — 어두운 투사면에 붉은 판을
 *    깔면 그 아래 무대가 죽는다. 머리 주변 팔레트 블룸이 앱 필드의 등가물이다.
 *
 *  ★ 진행도는 이징하지 않는다. 이 게이지들은 스테이지 시간(dur)에 묶인 '시계'라
 *    eOut 을 먹이면 남은 시간을 속인다. 앱의 eOut/LEAD 는 값이 '바뀔 때'의 규약 —
 *    값 구동 게이지가 생기면 GAUGE 로 같은 곡선을 쓸 것.
 *
 *  x0,y = 게이지 박스 좌상단 · w = 폭 · p = 0~1. 박스 높이는 gaugeH(w). */
/** 진행 바 — 지면·벽 도트바(회색 10개 위 빨강 10개를 rect 로 클립)의 대체.
 *  정본 = 앱 팩 상세의 process-graph 막대(figma-prototype styles/creator.css:139~176).
 *
 *  ★ 유저가 짚은 핵심: 저 그래프는 '채워지는' 게 아니라 **폭 자체가 자란다**.
 *    `@keyframes bar-grow { from { width: var(--start) } }` — 그래서 12px 라운드가
 *    끝을 달고 같이 이동하고 어디서도 잘리지 않는다. 구 도트바는 ctx.rect() 클립이라
 *    자란 끝이 직각으로 썰렸다. 여기선 클립을 안 쓴다 — roundRect 의 폭을 직접 준다.
 *
 *  같이 옮긴 것: 팔레트 램프(FA3030 58.3% → FE6E3C 83% → FEC389 93.5% → D1FEFF 100%,
 *  머리 끝만 prism 으로 밝아진다) · 좌측 수치/우측 라벨 인셋 조판 · 라벨은 다 자란 뒤 등장
 *  (앱 label-in delay .66s = 성장 .62s 직후) · 최소 폭(--start)은 수치가 읽힐 만큼.
 *  치수는 전부 앱 막대(h 53 · r 12 · pad 14 · 수치 15 · 라벨 13)의 h 대비 비율. */
export function growBar(ctx, x, y, w, h, p, o = {}) {
  const P = clamp01(p), r = o.r ?? h * 0.226, pad = o.pad ?? h * 0.264;
  const fs = o.fs ?? h * 0.283, ls = o.ls ?? -fs * 0.0333;   // 앱 −0.5px/15px = −3.33%
  const right = o.anchor === 'right';
  // --start: 수치가 들어갈 만큼은 항상 열려 있다. 여기서 0 부터 자라면 라운드가 접혀
  //          납작한 알약이 잠깐 보인다(앱도 스텁 26~47%를 두는 이유).
  ctx.font = F(o.numWeight ?? 400, fs);
  const stub = o.num != null ? Math.min(w, pad * 2 + ctx.measureText(String(o.num)).width) : r * 2;
  const bw = stub + (w - stub) * P;
  const bx = right ? x + w - bw : x;
  if (o.track !== null) {   // 앱은 카드 배경이 트랙이다 — 투사면은 어두우니 옅은 면으로
    ctx.fillStyle = o.track || 'rgba(255,255,255,.10)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  // 막대 — 클립 없음. roundRect(bw) 자체가 자란다 → r 이 끝을 달고 같이 간다.
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  for (const [s, c] of (o.stops || [[0, PAL.red], [.583, PAL.red], [.83, PAL.coral], [.935, PAL.sand], [1, PAL.prism]]))
    g.addColorStop(s, c);
  ctx.fillStyle = o.fill || g;
  ctx.beginPath(); ctx.roundRect(bx, y, bw, h, r); ctx.fill();
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = ls.toFixed(2) + 'px';
  if (o.num != null) {
    ctx.font = F(o.numWeight ?? 400, fs); ctx.fillStyle = o.numColor || '#fff'; ctx.textAlign = 'left';
    ctx.fillText(String(o.num), bx + pad, y + h / 2);
  }
  if (o.label) {   // 다 자란 뒤에야 내려앉는다 — 앱의 label-in(성장 .62s 직후 .66s)
    const la = clamp01((P - 0.88) / 0.12);
    ctx.globalAlpha *= la;
    ctx.font = F(700, o.labFs ?? h * 0.245); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.textAlign = 'right';
    ctx.letterSpacing = (-(o.labFs ?? h * 0.245) * 0.0333).toFixed(2) + 'px';
    ctx.fillText(o.label, bx + bw - pad + h * 0.19 * (1 - la), y + h / 2);
  }
  ctx.restore();
  ctx.letterSpacing = '0px';
}

export const GAUGE = { travel: 0.78, lead: 0.15, tail: 0.54 };   // 초 · 초 · 지나온 길이 대비 꼬리
// 앱 SVG viewBox 360×130 그대로. 호 = M 19 64 A 261 188.5 0 0 1 341 64.
// 다만 박스는 **잉크에 딱 맞춘다**(inkTop~inkBot): 원본 viewBox 는 위로 크라운 여백 21,
// 아래로 눈금 라벨 자리 59 를 들고 있었는데 라벨을 뺐다 → 그 빈 띠가 타이틀·게이지 사이
// 간격으로 보였다(유저: "간격이 과하게 넓어"). 호 자체 좌표는 그대로다.
const ARC = {
  vw: 360, x0: 19, x1: 341, cx: 180, rx: 261, ry: 188.5, top: 24,
  stroke: 6, dot: 46, core: 15.17,         // 60 → 46 (gauge.js 원치수로 복귀) — 마커가 과했다(유저).
                                           //   core 는 dot 비례(0.3298) 유지. 화면별로 더 줄이려면 o.dotK.
  clampL: 64, clampR: 316,                 // gauge.js — 마커는 페이드 구간 밖으로 안 나간다
  trackA: 0.85, trackR: 324.79 * 0.4264,   // trackFade 라디얼: 크라운 .85 → 양끝 0
  inkTop: 4, inkBot: 72,                   // 크라운의 마커 위끝 ~ 우측 끝 마커 아래끝
};
// ═══ 투사 안전폭 — 대지는 직사각이지만 투사면은 **사다리꼴**이다 ══════════════════
//  대지(1600×2670)는 mid 행에서 콘 폭에 맞춰 스케일된다. 그래서 mid 위쪽은 콘이 더 넓어
//  여유가 있고, **아래쪽은 콘이 좁아져 대지가 콘 밖으로 나간다**. 대지 안이라고 안전한 게 아니다.
//  실측(러닝 기본 fpNear .3 / fpFar 2.0 · 0.687mm/px, 2026-08-05):
//     y  176 → 2174px   |  y 1335 → 1548px
//     y  300 → 2107px   |  y 1800 → 1297px
//     y  500 → 1999px   |  y 2100 → 1135px
//     y  900 → 1783px   |  y 2430 →  957px
//                       |  y 2670 →  932px
//  → 상단은 대지(1600)보다 넓지만 **y 1300 아래부터는 대지가 콘을 넘는다**.
//    하단에 1000px 짜리를 놓으면 양끝이 빔 밖으로 잘린다(실측: y2430 안전폭 957).
const SAFE_TBL = [[176, 2174], [300, 2107], [500, 1999], [900, 1783], [1335, 1548],
                  [1800, 1297], [2100, 1135], [2430, 957], [2670, 932]];
export function safeW(y) {
  if (y <= SAFE_TBL[0][0]) return SAFE_TBL[0][1];
  for (let i = 1; i < SAFE_TBL.length; i++) {
    const [y0, w0] = SAFE_TBL[i - 1], [y1, w1] = SAFE_TBL[i];
    if (y <= y1) return w0 + (w1 - w0) * (y - y0) / (y1 - y0);
  }
  return SAFE_TBL[SAFE_TBL.length - 1][1];
}
// ═══ 지면 가독 규약 — 165cm 사용자 기준 최소 글자 크기 ════════════════════════════
//  왜 한 숫자가 아닌가: 대지는 **눕혀져** 있다. 화면 위(먼 쪽)는 시거리가 멀고 시선각이
//  얕아 세로획이 눌리고, 발밑(가까운 쪽)은 거의 정면으로 본다. 같은 px 이라도 위에 있으면
//  훨씬 작게 보인다 — 미감으로 크기를 정하면 위쪽 글자가 조용히 안 읽히게 된다.
//
//  실측(러닝 기본 투사, 2026-08-05):
//    레인폭 2·halfAt(1.15m) = 1.098m ÷ 대지 1600px  →  MM_PER_PX = 0.686
//    눈높이 1.55m(신장 165cm) · 대지는 발 앞 0.17m(y=2670) ~ 1.88m(y=176)
//    캡높이 0.5°(글랜스 가독선) 확보에 필요한 폰트:
//      y=176   시거리 2.43m · 단축 0.64 → 68px
//      y=1335  시거리 1.89m · 단축 0.82 → 41px
//      y=2670  시거리 1.56m · 단축 0.99 → 28px
//  → 위에서 아래로 68 → 28 선형. 이 아래로는 '작게 보여서 예쁜' 게 아니라 안 읽히는 것이다.
export const MM_PER_PX = 0.686;
export const minFs = y => 68 - 40 * Math.min(1, Math.max(0, y / 2670));
// 계측기 — ?legaudit=1 로 켜면 이번 페인트의 모든 fillText 를 규약과 대조해 모은다.
//   추측으로 폰트를 뒤지지 않는다: 실제로 그려진 좌표·크기를 그대로 잡는다.
const LEG_AUDIT = _q.get('legaudit') === '1';
export const legFindings = [];
function legWatch(ctx) {
  if (!LEG_AUDIT || ctx.__legOn) return;
  ctx.__legOn = true;
  const orig = ctx.fillText.bind(ctx);
  ctx.fillText = (txt, x, y, ...r) => {
    try {
      const m = ctx.getTransform();
      // ★ 회전 텍스트는 m.d(=cosθ)만 보면 안 된다 — 호 위 라벨이 실제보다 작게 측정돼
      //   있지도 않은 위반을 만든다. 회전+스케일의 실제 배율은 hypot(m.b, m.d).
      const by = (m.f + m.d * y) / K, fs = (parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1]) || 0) * Math.hypot(m.b, m.d) / K;
      const need = minFs(by);
      // 단위(m·min·sec·km·%)는 규약 대상이 아니다 — 큰 수치에 붙어 맥락으로 읽힌다.
      const isUnit = /^(m|min|sec|km|%)$/.test(String(txt).trim());
      if (fs > 0 && !isUnit && fs < need - 0.5 && String(txt).trim())
        legFindings.push({ txt: String(txt).slice(0, 24), y: Math.round(by), fs: +fs.toFixed(1), need: +need.toFixed(1) });
    } catch { /* 계측이 페인트를 죽이면 안 된다 */ }
    return orig(txt, x, y, ...r);
  };
}
const arcY = ax => ARC.top + ARC.ry * (1 - Math.sqrt(Math.max(0, 1 - ((ax - ARC.cx) / ARC.rx) ** 2)));
/** 폭 w(= viewBox 360 에 대응) 게이지의 높이 */
export const gaugeH = w => Math.round(w / ARC.vw * (ARC.inkBot - ARC.inkTop));

const _gsCv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const _rollCv = typeof document !== 'undefined' ? document.createElement('canvas') : null;   // rollNum 롤 페더 버퍼

/** 기록 화면 스코어 게이지 — progress.html + report.css + gauge.js 1:1 이식.
 *  근사로 옮겼던 것들을 실값으로 되돌렸다(유저: "컴포넌트 그대로 이식한 거지?").
 *    · 트랙은 스트로크 6, 색이 trackFade 라디얼이라 **양 끝에서 스스로 사라진다**.
 *      전엔 균일 알파라 끝이 뚝 끊겨 보였다.
 *    · 지나온 선 = tailFade(마커에서 흰색 → 54% 뒤 투명). 팔레트 착색은 앱에 없다 — 뺐다.
 *    · 마커는 **글라스**다. backdrop-filter: blur(2.6px) — 캔버스엔 그게 없어서
 *      디스크 아래를 떠서 블러해 되돌린다(트랙이 디스크를 통과해 비쳐야 한다는 게 요지).
 *      림 2겹: 컨닉 헤어라인(135°·315° 가 밝다) + 그 안쪽 넓고 옅은 헤일로.
 *    · 마커 x 는 64~316 으로 클램프 — 페이드로 사라진 구간엔 안 올라간다.
 *    · 수치·끝라벨은 Supreme 12 / 11(#757575). OffBit 아니다.
 *  o.ease 면 gauge.js 의 이동 곡선(1-(1-p)^3)을 진행도에 먹인다. */
export function arcGauge(ctx, x0, y, w, p, o = {}) {
  const P = clamp01(p), s = w / ARC.vw;
  const e = o.ease ? eOut(P) : P;
  const X = ax => x0 + ax * s, Y = vy => y + (vy - ARC.inkTop) * s;
  // 마커 위치 = 앱과 같은 클램프 (gauge.js place())
  const mx = ARC.clampL + (ARC.clampR - ARC.clampL) * e;
  const hx = X(mx), hy = Y(arcY(mx));
  const path = (a0, a1) => {
    ctx.beginPath();
    const n = Math.max(2, Math.round(Math.abs(a1 - a0) / 3));
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; i ? ctx.lineTo(X(a), Y(arcY(a))) : ctx.moveTo(X(a), Y(arcY(a))); }
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = ARC.stroke * s;
  // ① 트랙 — trackFade: 크라운(180,12)에서 밝고 양 끝으로 가며 사라진다
  const tf = ctx.createRadialGradient(X(ARC.cx), Y(12), 0, X(ARC.cx), Y(12), ARC.trackR * s);
  tf.addColorStop(0, `rgba(255,255,255,${ARC.trackA})`); tf.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = tf; path(ARC.x0, ARC.x1); ctx.stroke();
  // ② 지나온 선 — tailFade: 마커에서 흰색, 54% 뒤 투명
  if (e > 0.002) {
    const tg = ctx.createLinearGradient(hx, 0, X(ARC.x0), 0);
    tg.addColorStop(0, '#fff'); tg.addColorStop(o.tail ?? GAUGE.tail, 'rgba(255,255,255,0)');
    ctx.strokeStyle = tg; path(ARC.x0, mx); ctx.stroke();
  }
  // ③ 마커 = 글라스
  glassDot(ctx, hx, hy, ARC.dot / 2 * s * (o.dotK ?? 1));   // dotK — 화면별 마커 축소(기본 1 = 타 화면 불변)
  ctx.restore();
}

/** 진행 마커 = 글라스 디스크 (report.css .arc-dot).
 *  캔버스엔 backdrop-filter 가 없으니 디스크 아래를 떠서 블러해 되돌린다
 *  (트랙이 디스크를 통과해 비쳐야 한다는 게 요지).
 *  림 2겹: 컨닉 헤어라인(135°·315° 가 밝다) + 그 안쪽 넓고 옅은 헤일로. */
export function glassDot(ctx, hx, hy, R) {
  const s = R / (ARC.dot / 2);
  ctx.save();
  ctx.shadowBlur = 0;   // 호출자가 링 브레스 글로우를 켜둔 채 부를 수 있다 — 마커엔 안 먹인다
  if (_gsCv) {
    const m = ctx.getTransform(), k = m.a, pad = 6 * s;
    const sx = (hx - R - pad) * k + m.e, sy = (hy - R - pad) * k + m.f, sz = (R + pad) * 2 * k;
    if (sz > 2 && sx > -sz && sy > -sz) {
      _gsCv.width = _gsCv.height = Math.ceil(sz);
      const g = _gsCv.getContext('2d');
      g.clearRect(0, 0, _gsCv.width, _gsCv.height);
      g.filter = `blur(${(2.6 * s * k).toFixed(2)}px)`;
      g.drawImage(ctx.canvas, sx, sy, sz, sz, 0, 0, sz, sz);
      g.filter = 'none';
      ctx.save();
      ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(_gsCv, hx - R - pad, hy - R - pad, (R + pad) * 2, (R + pad) * 2);
      ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,.18)';                       // background
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.fill();
  // 림 ① 컨닉 헤어라인 — 0deg 가 위이므로 캔버스 각도에서 −90°
  if (ctx.createConicGradient) {
    const cg = ctx.createConicGradient(-Math.PI / 2, hx, hy);
    for (const [d, a] of [[0, .30], [45, .06], [90, .34], [135, .96], [180, .34], [225, .06], [270, .34], [315, .98], [360, .30]])
      cg.addColorStop(d / 360, `rgba(255,255,255,${a})`);
    ctx.strokeStyle = cg; ctx.lineWidth = Math.max(0.6, 1.4 * s);
    ctx.beginPath(); ctx.arc(hx, hy, R - 0.7 * s, 0, Math.PI * 2); ctx.stroke();
  }
  // 림 ② 안쪽 넓고 옅은 헤일로 (::after)
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = Math.max(0.6, 3 * s);
  ctx.beginPath(); ctx.arc(hx, hy, R - 2.4 * s, 0, Math.PI * 2); ctx.stroke();
  // 코어
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(hx, hy, ARC.core / 2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 원형 진행 게이지 — 기록 게이지(arcGauge)의 원형판. 타이머가 벽·지면·바닥에서 공통으로 쓴다.
 *  · 트랙: 12시 이음매에서 양 끝이 스스로 사라진다(예전 점선 대신). arcGauge 의 trackFade 와 같은 뜻.
 *  · 지나온 선: 마커에서 흰색 → tail 만큼 뒤에서 투명(tailFade).
 *  · 머리: 글라스 마커(빨간 점 아님).
 *  치수 기본값은 SVG viewBox 604 · r275 규약 — r 만 주면 스트로크·마커가 같이 스케일한다. */
export function ringGauge(ctx, cx, cy, r, prog, o = {}) {
  const p = clamp01(prog), A0 = -Math.PI / 2, s = r / 275, TAU = Math.PI * 2;
  const ta = o.trackA ?? 0.28, fade = o.fade ?? 0.07;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = o.trackW ?? 6 * s;
  if (ctx.createConicGradient) {
    const tg = ctx.createConicGradient(A0, cx, cy);
    tg.addColorStop(0, 'rgba(255,255,255,0)');
    tg.addColorStop(fade, `rgba(255,255,255,${ta})`);
    tg.addColorStop(1 - fade, `rgba(255,255,255,${ta})`);
    tg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = tg;
  } else ctx.strokeStyle = `rgba(255,255,255,${ta})`;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  if (p > 0.002) {
    ctx.lineWidth = o.arcW ?? 11 * s;
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(A0, cx, cy), t0 = p * (1 - (o.tail ?? GAUGE.tail));
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(t0, 'rgba(255,255,255,0)');
      g.addColorStop(Math.min(1, p), o.color || '#fff');
      if (p < 0.999) g.addColorStop(Math.min(1, p + 0.001), 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
    } else ctx.strokeStyle = o.color || '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, r, A0, A0 + p * TAU); ctx.stroke();
  }
  const a = A0 + p * TAU;
  glassDot(ctx, cx + r * Math.cos(a), cy + r * Math.sin(a), o.dot ?? 31 * s);   // 26 → 31 (유저: 조금만 더 크게)
  ctx.restore();
}


/** 성취 배지 — 지면 Success 와 복싱 콤보가 같은 물건이라 한 정의로 통일(유저 지적).
 *  전엔 지면은 흰 필 + 🔥 이모지, 벽은 히트 그라디언트 필 + SVG 불꽃이라 딴판이었다.
 *  정본 = 벽 콤보 쪽(더 설계된 형태). 등장·회전 같은 모션은 호출자가 변환으로 감싼다. */
export function drawBadge(ctx, cx, cy, text, o = {}) {
  // ── 아웃라인 필 + 윙(선·점) 문법(유저 확정, NEXT GOAL WINS/FINAL SHOT 레퍼런스) ──
  //   채움 폐기 — 얇은 발광 아웃라인 + 좌우 '— ·' 윙. o.ext(0~1) = 액션·콤보 등 이벤트에
  //   윙 라인이 바깥으로 은은하게 뻗는 축(바깥 끝은 알파 0으로 소멸).
  const S = o.scale || 1, H = 114.26 * S, R = 47.28 * S;
  const fs = 59.1 * S, pad = 36 * S, icon = 47.28 * S, gap = 15.76 * S;
  // 배지 문구는 'Success!'·'HOLD' 같은 낱말이라 본문 영문 — 도트는 숫자와 마크 R·L 뿐(유저 규약).
  ctx.font = F(700, fs, /\d/.test(String(text)) ? dot9 : sans);
  const iw = o.icon ? icon + gap : 0;   // 아이콘 없을 땐 그 여백도 없다 — 중심 정렬이 틀어지던 것
  const w = ctx.measureText(text).width + iw + pad * 2;
  const glow = o.glow ?? 0.55;
  // ── 레퍼런스 실측 재현(FINAL SHOT, 20.png 픽셀 계측) ─────────────────────────
  //   라인 = 채도 낮은 웜 피치(실측 #E7BEA2 — 배경 대비 +47R 정도의 '살짝 밝은 온기').
  //   두께 얇게(2.5), 글로우는 좁고 은은하게(±4px 폴오프 실측). 진한 코랄·두꺼운 선·강한 블룸이
  //   레퍼런스 느낌을 계속 깨던 원인이었다(유저: 연구해서 제대로).
  //   톤 규칙: 강조어(success/match rate/combo/boost/final/strike)는 글로우만 코랄로 더 데운다.
  const tone = o.tone || (/success|match rate|combo|boost|final|strike/i.test(String(text)) ? 'coral' : 'white');
  const line = 'rgba(255,222,194,.95)';   // 웜 피치 — 실측 앵커
  const glowC = tone === 'coral' ? PAL.coral : PAL.sand;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = line;
  ctx.lineWidth = 4 * S;   // 3.2 → 4 — 합성 화면에서 아직 덜 들어옴(유저). 레퍼런스 계열 유지 한계선
  // 은은한 이중 글로우(좁게) + 크리스프 — 레퍼런스의 '살짝 배어나는' 헤일로
  ctx.shadowColor = rgba(glowC, .9); ctx.shadowBlur = 14 * S;
  ctx.beginPath(); ctx.roundRect(-w / 2, -H / 2, w, H, R); ctx.stroke();
  ctx.shadowColor = rgba(glowC, .5); ctx.shadowBlur = 30 * S * (0.5 + glow);
  ctx.beginPath(); ctx.roundRect(-w / 2, -H / 2, w, H, R); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.roundRect(-w / 2, -H / 2, w, H, R); ctx.stroke();
  // 윙 — 같은 피치 라인, 얇게, 바깥으로 알파 페이드. ext 로 뻗는다.
  const ext = clamp01(o.ext ?? 0);
  const m = 34 * S, wing = 96 * S * (1 + 1.8 * ext);
  ctx.lineCap = 'round'; ctx.lineWidth = 2.5 * S;
  for (const dir of [-1, 1]) {
    const xs = dir * (w / 2 + m), xe = xs + dir * wing;
    const lg = ctx.createLinearGradient(xs, 0, xe, 0);
    lg.addColorStop(0, line);
    lg.addColorStop(1, rgba(glowC, 0));
    ctx.strokeStyle = lg;
    ctx.shadowColor = rgba(glowC, .5); ctx.shadowBlur = 9 * S;
    ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xe, 0); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  if (o.icon) ctx.drawImage(o.icon, -w / 2 + pad, -icon * 0.55, icon, icon * 1.1);
  ctx.shadowColor = rgba(PAL.sand, .75); ctx.shadowBlur = 22 * S;
  ctx.fillStyle = NEU.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, -w / 2 + pad + iw, 0);
  ctx.restore();
  return w;
}


/** 카드 내부 글로우 — 캔버스엔 CSS 의 inset box-shadow 가 없다.
 *  오프스크린을 글로우 색으로 채우고, 안쪽(spread 만큼 줄인 모양)을 블러로 지워내면
 *  가장자리에만 부드러운 빛이 남는다 = inset. (스트로크+blur 근사는 테두리가 딱딱하고 얼룩진다)
 *  CSS blur 는 지름 규약이라 캔버스 filter(시그마)에는 절반을 준다. */
const _isCv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
// ── 도트 숫자 카운트업 (정본) ────────────────────────────────────────────────
// 규칙(유저): 도트 폰트 + 숫자면 전부 이걸로 그린다. 값을 그냥 갈아끼우면 숫자가 툭 튀어
//   '계기'가 아니라 '텍스트'로 읽힌다. 원래 wallgl 리포트에서만 쓰던 것을 정본으로 올렸다.
// 동작 — 진입 후 delay 초 뒤 cd 초 동안 0 → target 으로 이징(reactbits CountUp 규약).
//   cd 가 지나면 cur === target 이므로, 살아 움직이는 값(km·SPM)도 그대로 따라가며
//   자릿수만 굴러간다. 정적 숫자와 실시간 값 양쪽에 같은 함수가 쓰인다.
export function rollNum(ctx, target, t, delay, cd, x, y, size, o = {}) {
  const str = String(target);
  if (!/\d/.test(str)) {   // 숫자가 한 자도 없으면(예: '--'·'—') 그대로 — 카운트업 대상이 아니다
    ctx.save();
    ctx.font = F(o.weight || 700, size, sans);   // 숫자가 아니면 도트 금지(유저 규약)
    ctx.textBaseline = o.base || 'top';
    ctx.textAlign = o.align || 'left';
    ctx.fillStyle = o.fill || '#fff';
    ctx.fillText(str, x, y);
    ctx.restore();
    return;
  }
  const e = eOut(clamp01((t - delay) / cd));
  // 휠은 '문자열의 글자'와 1:1 로 붙는다 — 숫자 자리는 굴러가고, 기호(. ’ ” :)는 제자리에 그려진다.
  //   구현이 순수 숫자(/^\d+(\.\d+)?$/)만 받던 탓에 페이스("5’42”")처럼 기호가 낀 계기는
  //   통째로 문자 취급 → 카운트업이 아예 안 걸렸다(유저: 페이스 숫자가 안 넘어가고 멈춤).
  //   ① 순수 숫자는 소수점을 무시하고 한 덩어리로 굴린다('1.00' → 100 이 올라야 소수 자리가 같이 오른다)
  //   ② 기호가 섞이면 숫자 덩어리마다 따로 굴린다(5’42” = '5' 와 '42' 가 각자 0 에서 올라온다)
  const runs = [];
  if (/^\d+(?:\.\d+)?$/.test(str)) {
    const idx = [];
    for (let i = 0; i < str.length; i++) if (str[i] !== '.') idx.push(i);
    runs.push({ idx, val: Math.round(parseFloat(str) * Math.pow(10, (str.split('.')[1] || '').length)) });
  } else {
    for (let i = 0; i < str.length;) {
      if (str[i] >= '0' && str[i] <= '9') {
        const idx = [];
        while (i < str.length && str[i] >= '0' && str[i] <= '9') idx.push(i++);
        runs.push({ idx, val: parseInt(idx.map(k => str[k]).join(''), 10) });
      } else i++;
    }
  }
  // 자리마다 '보일 숫자(d)'와 '굴림 위상(f)'. 오도미터는 아랫자리부터 위로 물려 돈다 —
  //   맨 아랫자리만 연속으로 돌고, 윗자리는 **바로 아랫자리가 9 일 때만** 같은 위상으로 따라 돈다.
  //   (자리마다 소수부를 그대로 쓰면 198 의 백의 자리가 1.98 → 98% 넘어간 채 굳는다.
  //    9 를 낀 값에서 늘 반쯤 넘어간 숫자가 보이던 원인 — 유저: 안 넘어가고 멈춤.)
  const wheel = new Array(str.length).fill(null);
  for (const r of runs) {
    const cur = e >= 1 ? r.val : r.val * e, L = r.idx.length;
    let f = cur - Math.floor(cur);   // 맨 아랫자리 = 연속 회전
    for (let p = 0; p < L; p++) {
      const d = Math.floor(cur / Math.pow(10, p)) % 10;
      wheel[r.idx[L - 1 - p]] = { d, f };
      f = d === 9 ? f : 0;           // 9 에서만 윗자리로 물린다
    }
  }
  ctx.save();
  // 서체 규약(유저 확정): **도트(OffBit)는 숫자 0~9 와 마크 글리프 R·L 뿐이다.**
  //   같은 문자열 안이라도 기호(’ ” . : % /)와 단위는 본문 영문(Supreme)으로 넘긴다 —
  //   ctx.font 하나로 통째로 그리던 탓에 페이스의 분·초 기호까지 도트로 찍히고 있었다.
  const NF = F(o.weight || 700, size, o.fam || dot9);   // 숫자
  const SF = F(o.weight || 700, size, sans);            // 기호
  ctx.font = NF;
  ctx.textBaseline = 'top';
  // 정렬은 반드시 left — 자리 x(px)를 이 함수가 직접 계산하고 자리마다 창을 clip 하기 때문이다.
  //   호출부(_lstat)가 걸어둔 textAlign='center' 가 남아 있으면 글자가 창보다 반 칸 왼쪽에 찍혀
  //   왼쪽 획이 잘린다 — SPM '178' 이 '173' 으로, '1' 이 'L' 로 보이던 원인.
  ctx.textAlign = 'left';
  // 기본 흰색 — 승격 전 rollNum 은 내부에서 '#fff' 를 강제했다. o.fill 있을 때만 칠하게 바꿨더니
  //   색을 안 넘긴 호출부가 캔버스 기본색(검정)으로 떨어졌다(유저: 흰 폰트여야 하는 게 검정).
  ctx.fillStyle = o.fill || '#fff';
  ctx.letterSpacing = (o.ls || 0) + 'px';
  // 자리 폭 = '최종 문자열을 통째로 그렸을 때의 실제 진행 폭'에서 뽑는다.
  //   한 자씩 measureText 하면 커닝이 사라져 자간이 벌어지고(유저: 억지로 늘어남),
  //   ctx.letterSpacing 이 이미 걸려 있으므로 o.ls 를 또 더하면 이중 적용이었다.
  //   숫자·기호가 서체를 달리 쓰므로 폭도 서체가 같은 구간끼리 재야 커닝이 살아 있다.
  const ws = new Array(str.length).fill(0);
  for (let i0 = 0; i0 < str.length;) {
    const isNum = wheel[i0] != null;
    let i1 = i0; while (i1 < str.length && (wheel[i1] != null) === isNum) i1++;
    ctx.font = isNum ? NF : SF;
    let prev = 0;
    for (let k = i0; k < i1; k++) {
      const cum = ctx.measureText(str.slice(i0, k + 1)).width;
      ws[k] = cum - prev; prev = cum;
    }
    i0 = i1;
  }
  const total = ws.reduce((a, b) => a + b, 0);
  let px = o.align === 'right' ? x - total : o.align === 'center' ? x - total / 2 : x;
  const H = size * 0.84;   // 휠 한 칸 = 글리프 잉크 높이(글자 상자가 아니라) — 두 자리가 겹쳐 보이지 않게
  // ── 롤 중에만 상·하단 페더(유저 08-05) — 도는 동안 위아래가 부드럽게 잦아들어 '릴'로 읽히고,
  //   카운팅이 끝나면(e→1) 페더 두께가 0 으로 줄며 은은하게 사라진다. 정지 상태 비용 0.
  const fk = 1 - clamp01((e - 0.72) / 0.28);
  const WH = size * 0.92, PADX = 8, PADY = Math.ceil(size * 0.10);
  const px0 = px;
  let g2 = ctx, dx = 0, dy = 0;
  if (fk > 0.01 && _rollCv) {
    _rollCv.width = Math.ceil(total + PADX * 2);
    _rollCv.height = Math.ceil(WH + PADY * 2);
    g2 = _rollCv.getContext('2d');
    g2.font = NF; g2.textBaseline = 'top'; g2.textAlign = 'left';
    g2.fillStyle = o.fill || '#fff'; g2.letterSpacing = (o.ls || 0) + 'px';
    dx = PADX - px0; dy = PADY - y;   // 본 좌표 → 오프스크린 좌표
  }
  for (let i = 0; i < str.length; i++) {
    const w = wheel[i];
    if (w == null) { g2.font = SF; g2.fillText(str[i], px + dx, y + dy); px += ws[i]; continue; }
    g2.font = NF;
    const d = w.d, f = w.f;
    g2.save();
    g2.beginPath(); g2.rect(px + dx - 4, y + dy, ws[i] + 8, WH); g2.clip();   // 창 = 딱 한 자리
    g2.fillText(String(d % 10), px + dx, y + dy - f * H);                     // 나가는 자리 = 위로
    if (f > 0.03) g2.fillText(String((d + 1) % 10), px + dx, y + dy + (1 - f) * H);   // 들어오는 자리 = 아래에서
    g2.restore();
    px += ws[i];
  }
  if (g2 !== ctx) {
    const fpx = size * 0.20 * fk;                       // 페더 두께 — fk 가 줄면 저절로 사라진다
    g2.globalCompositeOperation = 'destination-in';
    const mg = g2.createLinearGradient(0, PADY, 0, PADY + WH);
    mg.addColorStop(0, 'rgba(0,0,0,0)');
    mg.addColorStop(Math.min(.49, fpx / WH), '#000');
    mg.addColorStop(Math.max(.51, 1 - fpx / WH), '#000');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = mg; g2.fillRect(0, 0, _rollCv.width, _rollCv.height);
    ctx.drawImage(_rollCv, px0 - PADX, y - PADY);
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
  return total;
}
/** rollNum 이 실제로 차지할 폭 — 숫자는 도트, 기호는 본문 영문이라 한 서체로 재면 틀린다.
 *  단위를 값 옆에 붙이는 조판(_km 등)이 이걸로 자리를 잡는다. */
export function rollWidth(ctx, target, size, o = {}) {
  const str = String(target);
  const NF = F(o.weight || 700, size, o.fam || dot9), SF = F(o.weight || 700, size, sans);
  ctx.save();
  ctx.letterSpacing = (o.ls || 0) + 'px';
  let total = 0;
  for (let i0 = 0; i0 < str.length;) {
    const isNum = /\d/.test(str[i0]);
    let i1 = i0; while (i1 < str.length && /\d/.test(str[i1]) === isNum) i1++;
    ctx.font = isNum ? NF : SF;
    total += ctx.measureText(str.slice(i0, i1)).width;
    i0 = i1;
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
  return total;
}
/** 계기 값 → 비교 가능한 수. 페이스("5’42”")는 parseFloat 이 5 에서 끊겨 목표와 늘 같아 보였다(편차 바가
 *  항상 정중앙). 분’초” 는 초로 환산해야 SPM 과 같은 규칙으로 편차를 잰다. */
export function statVal(s) {
  const m = String(s ?? '').match(/^\s*(\d+)\s*[’'′:]\s*(\d{1,2})/);
  return m ? +m[1] * 60 + +m[2] : parseFloat(s);
}
/** 값만 필요한 곳(문자열 반환) — 그리기는 호출부가 한다. 숫자가 아니면 그대로 돌려준다. */
export function countUp(target, t, delay, cd) {
  const m = String(target).match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return String(target);
  const end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length;
  const e = eOut(clamp01((t - delay) / cd));
  return dec ? (end * e).toFixed(dec) : String(Math.round(end * e));
}

export function insetGlow(ctx, x, y, w, h, r, color, blur, spread) {
  if (!_isCv) return;
  const m = Math.ceil(blur) + 8;
  _isCv.width = Math.ceil(w) + m * 2; _isCv.height = Math.ceil(h) + m * 2;
  const g = _isCv.getContext('2d');
  g.clearRect(0, 0, _isCv.width, _isCv.height);
  g.fillStyle = color;
  g.beginPath(); g.roundRect(m, m, w, h, r); g.fill();
  g.globalCompositeOperation = 'destination-out';
  // ★ 지우개는 반드시 알파 1 이어야 한다. 위에서 쓴 fillStyle(글로우색 알파 .6)을 그대로 두면
  //   destination-out 이 dst 알파를 (1−.6)=40% 만 남기고 끝나 카드 **전체**에 흰 24% 가 깔린다
  //   (실측: #FA3030 중앙이 rgb(251,98,98)). 림만 남아야 할 inset 글로우가 통짜 베일이 됐던 원인.
  g.fillStyle = '#000';
  g.filter = `blur(${(blur / 2).toFixed(1)}px)`;
  g.beginPath(); g.roundRect(m + spread, m + spread, w - spread * 2, h - spread * 2, Math.max(0, r - spread)); g.fill();
  g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  ctx.drawImage(_isCv, x - m, y - m);
}

// 글자별 그리기 — fn(i) → {dy, alpha, scale}. charLoop·charWave·chIn 공통.
// align: 'center'(cx=중앙) | 'right'(cx=오른쪽 끝) | 'left'
export function drawChars(ctx, txt, cx, y, h, ls, fn, align = 'center') {
  ctx.letterSpacing = (ls || 0) + 'px';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const total = ctx.measureText(txt).width;
  let x = align === 'center' ? cx - total / 2 : align === 'right' ? cx - total : cx, vis = 0;
  for (const ch of txt) {
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') {
      const a = fn(vis++);
      if (a.alpha > 0.004) {
        ctx.save();
        ctx.globalAlpha *= a.alpha;
        ctx.translate(x + w / 2, y + h / 2 + (a.dy || 0));
        if (a.scale !== 1) ctx.scale(a.scale, a.scale);
        ctx.fillText(ch, -w / 2, -h / 2);
        ctx.restore();
      }
    }
    x += w;
  }
  ctx.letterSpacing = '0px';
}

// ── 나머지 문서(시작화면·전환·카운트다운·리포트) 데이터 — 각 HTML의 상수를 그대로 옮긴 것 ──
// 러닝·농구 시작화면 = UI 한 벌(유저 08-05). 종목이 바꾸는 건 아래 다섯 필드뿐 —
//   lines(제목 2줄) · sub(부제) · total(도트 히어로 분) · arcs(세그먼트 값·라벨·아이콘) · badge(선행 배지).
//   레이아웃·모션·색은 _paint_ready 하나가 전담한다. Figma 시작화면 353:7066 정본.
//   scale/pivotY 는 디자인이 아니라 투사 콘 맞춤 노브 — 농구 콘이 얕아 원치수는 잘린다(유저 실측).
//   폐기: title·today·time·mode·comp(_paint_ready 가 안 읽던 잔재) · vid(코치 판은 main.js COACH_CFG 전담).
// 배터리 잔량 — **세션당 한 번** 뽑아 고정(유저): 웨어러블 62~96 · 이어폰 38~88.
//   기기마다 값이 달라야 '진짜 상태'로 읽힌다. 매 프레임 뽑으면 다이얼이 떤다.
//   ※ 커밋 b3185e7 이 이 정의 없이 사용부만 들어와 페인트가 통째로 죽었다(동시 편집 유실) — 복구.
const BATT = {
  glasses: Math.round(62 + Math.random() * 34),
  buds: Math.round(38 + Math.random() * 50),
};
const READY = {
  // lbl = 분 표기 통일 'Nm'(유저 08-05) — 'min' 혼용 폐기. 글자 크기도 세그먼트 공통(LBL_FS/LBL_MS).
  // 팩 정본(유저 08-05 팩 상세): 크리에이터 Sean · 팩명 **Sean's Pace Strategy** · Creator Pack 18m
  //   프로세스 = STRETCH 8 + LEARN 10 = 18m 팩(고정) + RUN! 30m(유저 선택) → Main Workout 5km · 48m
  //   부제 'Pace On' = Level & Mode.
  'floor.html':    { r2: { lines: ["Sean's", 'Pace Strategy'], sub: 'Pace On', total: '48',
                           arcs: [{ v: 8, lbl: '8m', muted: true, chipText: '8m' }, { v: 10, lbl: '10m', icon: 'feet', pad: 8 }, { v: 30, lbl: '30m', icon: 'run' }] } },   // 8+10+30 = 48 (10m 은 영상용 pad 8°)
  'floor-bk.html': { r2: {   // 종목 공통 스펙으로 통합 — 농구 전용 콘텐츠 보정 폐기(유저 승인 08-05)
                           lines: ["Curry's", 'Handle Pack'], sub: 'Press On', total: '23',
                           arcs: [{ v: 5, lbl: '5m', muted: true, chipText: '5m' }, { v: 8, lbl: '8m', icon: 'bkTrain' }, { v: 10, lbl: '10m', icon: 'bkPlay' }] } },   // 스트레칭도 비례 세그먼트(유저)
};
const TR = {
  T1: { sub: 'Sean’s Pace Strategy', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'run/run_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'run/run_learn.png' } },
  T2: { sub: 'Sean’s Pace Strategy', title: 'Learning Complete!',
    done: { lbl: 'Learn', time: '10min', img: 'run/run_learn.png' },
    next: { lbl: 'Run!', time: '10min', img: 'run/run_run.png' } },
  BK_T1: { sub: 'Curry’s Signature Move', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'bk/bk_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'bk/bk_learn.png' } },
  BK_T2: { sub: 'Curry’s Signature Move', title: 'Learning Complete!',
    done: { lbl: 'Learn', time: '10min', img: 'bk/bk_learn.png' },
    next: { lbl: 'Play!', time: '10min', img: 'bk/bk_play.png' } },
};
// 실전 직전 카운트다운 캡션. 전엔 아래 RP(리포트) 문구가 그대로 복사돼 있어서, 시작도 안 한
//   화면이 'Session Complete' 라고 말했다. 벽 타이머와 같은 규칙으로 — 부제=구성·시간, 제목=지금 시작하는 구간.
// ── 씬 캡슐 시스템(docs/SCENE-CAPSULE-SYSTEM.md, 유저 2026-08-05) — 스테이지별 옵트인.
//   variant: preview(관찰: 큰 캡슐+Preview 배지+셰브론 힌트) — 이후 video/floor/mini 확장.
// ★ 시작화면 광(엠버) 정본 — 피그마 익스포트 4겹 + 블렌드 모드. READY 캡슐 기준 좌표계
//   (캡슐 박스 x291 y285 w1018 h1541)에서 잡혀 있다. 프리뷰·따라하기 알약도 **이 광을 그대로**
//   쓴다(유저) — 같은 불이 캡슐을 따라 줄어드는 것이지 비슷한 그라디언트를 새로 그리는 게 아니다.
// ═══ 지면 레이아웃 규약 — **여기서만 정한다** ══════════════════════════════════════
//  왜: 화면마다 좌표를 손으로 박으니 요소가 서로를 가리고, 그때마다 말로 고쳐야 했다(유저).
//  아래 밴드가 정본이고 페인터는 전부 여기서 파생한다. 새 요소를 놓을 자리는 밴드로 정한다.
//
//    y 176   ┌ HEAD   타이틀 영역(헤더 알약 1320×330)
//    y 506   └
//        +56   GAP_HP
//    y 562   ┌ PROG   진행(아크) h143 · 폭은 safeW 로 깎는다
//    y 705   └
//       +120   GAP_PC
//    y 825   ┌ CONTENT  콘텐츠(인물 영상·판정 마크)가 쓰는 영역. 여기 위로는 아무것도 안 올라온다.
//    y 2330  └          (아래로 더 내려가면 투사 콘이 급격히 좁아진다 — safeW 참고)
//    y 1980    FOOT     발자국 안정 영역(콘텐츠 하단). 3D 발마크는 이 y 를 기준으로 놓는다.
//
//  타입 최소치는 minFs(y) 규약과 함께 쓴다 — 타이틀은 시작화면과 같은 98, 캡션/단위는 64 하한.
export const LAYOUT = {
  PAD: 60,
  HEAD: { y: 176, w: 1320, h: 330 },
  GAP_HP: 56,
  PROG: { h: 143, wMax: 1048 },
  GAP_PC: 120,
  CONTENT_Y1: 2330,
  FOOT_Y: 1980,
  TYPE: { title: 98, unit: 64, caption: 64, minCaption: 56 },
  PREVIEW: { morph: 0.9, fade: 0.45 },   // 카운트 종료 → 둥근 컨테이너가 알약으로 · 인물 크로스페이드
  get PROG_Y() { return this.HEAD.y + this.HEAD.h + this.GAP_HP; },
  get CONTENT_Y0() { return this.PROG_Y + this.PROG.h + this.GAP_PC; },
};
/** 대지 y → **전방 거리(m)**. 3D 요소(코치 판·발마크)를 레이아웃 밴드에 맞출 때 쓴다.
 *  대지는 mid(y1335)가 boardFwd 에 놓이고 위로 갈수록 멀어진다 → fwd = boardFwd + (1335 - y)*sUni.
 *  main.js 가 boardFwd·sUni 를 알고 있으므로 그 둘을 넘겨받아 계산만 해준다.
 *  ★ 이게 없어서 3D 는 스테이지마다 z 를 손으로 박았고(-0.48/-1.05/-1.85 …), 그래서 지면 UI와
 *    겹치는지 여부가 순전히 운이었다. 밴드에서 파생시키면 겹칠 수 없게 된다. */
export const yToFwd = (y, boardFwd, sUni) => boardFwd + (1335 - y) * sUni;
// 실측(러닝 기본 fpNear .3 / fpFar 2.0 · sUni 0.000687) — 밴드를 전방 거리로 환산하면:
//   HEAD 1.88~1.653m · PROG 1.615m · CONTENT 1.434~0.40m · FOOT 0.641m
// 현재 스테이지들이 손으로 박아 둔 발마크 z 와 대조한 결과:
//   A2 -0.48 → CONTENT 안(다만 FOOT 밴드보다 앞) · A3 -1.05 → CONTENT 안
// ★ 정정 — 위 환산은 **러닝 투사(fpFar 2.0)** 기준이다. 농구는 fpFar 2.4 라 대지 스케일(sUni)도
//   밴드의 실거리도 달라진다. 농구 마크(-1.85 ~ -3.13)를 러닝 표로 재면 전부 '밴드 밖'으로
//   나오지만, 그건 표가 틀린 것이지 마크가 틀린 게 아닐 수 있다(농구 투사존은 -1.2~-2.8 로
//   따로 잡혀 있다). **농구 값은 농구 모드에서 rig 를 직접 읽어 재측정한 뒤에 손댈 것.**
//
// 그리고 유저 스샷의 '발자국이 헤더/진행을 가린다'는 A2(러닝, 마크 0.48m)였는데,
//   그때 진행 아크가 y2180(= 0.505m)에 있었다 — **마크와 같은 자리**였다. 진행을 y562(1.615m)로
//   올리면서 그 충돌은 해소된다. 즉 원인은 마크 z 가 아니라 진행의 위치였다.
//   남은 검수 대상은 농구 스테이지뿐이고, 그건 위 정정대로 실측이 먼저다.
const READY_GLOWS = [
  ['glow-subtract.svg', 167.2, 1069.2, 1265.6, 931.6, 'hard-light'],
  ['glow-hl1.svg', 211.6, 1453.6, 1176.8, 458.8, 'color-dodge'],
  ['glow-hl2.svg', 310.4, 1380.4, 979.2, 541.2, 'lighter'],
  // ★ 컬러 영역 = 피그마 377:3209 실측(유저: 위로 올려서 키웠어). 노드 (·,227) 811x1232 에
      //   블리드 inset -29.43%/-19.37% → 이미지 1288.4x2009.3, 캡슐 시각상단 기준 +66.3.
      //   구값(1189.3, 1300x871)에서 **838px 위로 · 높이 2.3배**. 어림 스케일은 폐기.
      //   ※ 유저 #159 '안 잘리게 위로 올려' — 피그마 정위치(351.3)면 이미지 아래 534px 이
      //     캡슐 바닥에서 잘려 밝은 코어가 잘린 면으로 읽힌다. 우리 캡슐은 CUT 50 만큼 더
      //     짧아 피그마보다 불리하다. 코어를 위로 180 올려 잘리는 구간이 이미 어두워지게 한다.
      //   ※ 2.3배로 커진 뒤 hard-light 가 캡슐 내부를 통째로 흰색으로 태웠다(실측: 세로
      //     프로파일 300~1620 전 구간 휘도 255). 피그마는 캡슐 자체 필 위에 합성되지만
      //     캔버스는 투명 위라 hard-light 가 곧 발광이 된다 → 이 겹만 알파를 낮춰 '색을
      //     입히는' 역할로 되돌린다(7번째 항목 = 레이어 알파).
      //   ★ 블렌드 정정(유저 질문 '하드라이트 제대로 한 거야' → 아니었다).
      //     CSS mix-blend-hard-light 는 **backdrop** 과 섞인다(피그마: 캡슐 필 + 아트보드 #666).
      //     우리 캔버스는 투명한 **투사광 레이어**라 backdrop 이 없다 → hard-light 가 곧 발광이
      //     되어 캡슐 내부가 전 구간 휘도 255 로 탔다(실측).
      //     투사광에서 옳은 번역은 '가산 틴트' — source-over 로 색만 얹는다. 빔은 어차피 실제
      //     바닥 위에서 가산되므로, 최종 합성은 그쪽에서 피그마의 hard-light 역할을 대신한다.
      ['glow-ell.svg', 155.8, 171.3, 1288.4, 2009.3, 'hard-light', 1.0],   // backdrop 합성 경로(위 isField)
];
const READY_CAP = { x: 291, y: 285, w: 1018, h: 1541 };
const CAPS = {
  A1: { variant: 'preview',  },
  BK_A1: { variant: 'preview',  },
  // 실전 3분화(유저): video = 영상 보며 따라하기(타이머 배지) · floor = 바닥 가이드(호 + 토큰 존)
  // · mini = 복잡 스텝(작은 영상 미리보기 + 진행 배지 + 타이틀 축소)
  A3: { variant: 'video',  },
  A2: { variant: 'floor',  },
  BK_B2: { variant: 'mini', step: '1/4' },   // clip: 알파/그린 소스 확보 후(stepback_fwd 는 실사 배경 — 검은 박스 실측)
  BK_B3: { variant: 'mini', step: '2/4' },
  BK_B4: { variant: 'mini', step: '3/4' },
  BK_B5: { variant: 'mini', step: '4/4' },
};
const TM = { C1: { sub: 'Run 10 min · Final 1 km', title: 'Run with Sean' },
             BK_C1: { sub: 'Play 10 min · 3 attempts', title: 'Step-Back 1 of 3' } };
const RP = {
  FIN: { sub: 'Sean’s Pace Strategy', title: 'Session Complete',
    stats: [['Distance', '1.00 km'], ['Avg Pace', '5’42”'], ['Cadence', '174 spm']] },
  BK_FIN: { sub: 'Curry Step-Back Pack', title: 'Step-Back Locked In',
    stats: [['Step-Back 3PT', '2 / 3'], ['Step Accuracy', '86 %'], ['Release', '0.42 s', 'sm']] },
};
const BTN = 'Tap X2 For Retry!';

function node(id, o) {
  return Object.assign({
    id, style: {}, textContent: '', isConnected: true, _attr: {},
    setAttribute(k, v) { this._attr[k] = String(v); },
    getAttribute(k) { return this._attr[k] ?? null; },
  }, o);
}

// ── 개별 요소 그리기 ────────────────────────────────────────────────────────────
// 각 타입은 { h(n) → 높이, draw(ctx, n, y) } — 폭은 항상 중앙(CX) 정렬.

function drawText(ctx, n, y, t) {
  ctx.font = F(n.weight, n.size, n.fam || sans);
  ctx.fillStyle = n.style.color || n.color;
  ctx.textBaseline = 'top';
  ctx.letterSpacing = (n.ls || 0) + 'px';
  const txt = n.textContent || '';
  // 타이틀만 글자 캐스케이드(원본 chIn: 좌→우로 하나씩 제자리 스케일+페이드)
  if (n.cascade && t != null && t < 2.2 && txt) {
    drawChars(ctx, txt, CX, y, n.size, n.ls || 0, i => {
      const e = eOut(clamp01((t - (0.10 + i * 0.045)) / 0.6));
      return { dy: 0, alpha: e, scale: 0.82 + 0.18 * e };
    });
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(txt, CX, y);
  }
  ctx.letterSpacing = '0px';
}

// ── 캡슐 대지 배경 — 투명(기본) / 단색 / 그라디언트. 씬 편집기(scenes.html '대지 배경')가
//   window.__capBg = { mode, hex, alpha, hex2 } 를 라이브로 바꾸고, 씬 저장본에도 실린다.
export function capFill(ctx, pathFn, x, y, w, h) {
  const C = (typeof window !== 'undefined' && window.__capBg) || null;
  const mode = C?.mode || 'none';
  const a = C?.alpha ?? 0.18;
  const hex = C?.hex || '#D9D9D9', hex2 = C?.hex2 || '#FFFFFF';
  const toRgba = (hx, al) => {
    const n = parseInt(hx.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`;
  };
  if (mode === 'solid') ctx.fillStyle = toRgba(hex, a);
  else if (mode === 'gradient') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, toRgba(hex, a));
    g.addColorStop(1, toRgba(hex2, a * 0.15));
    ctx.fillStyle = g;
  } else ctx.fillStyle = 'rgba(217,217,217,.01)';   // 투명(정본 기본)
  pathFn(); ctx.fill();
}

// ── 부채꼴 조판 프리미티브 (READY 반원 레이아웃) ───────────────────────────────
export function arcSegFill(ctx, cx, cy, r0, r1, a0, a1, fill, round) {
  // d3.arc 정석 — cornerRadius 를 라이브러리가 처리한다(유저: 하드코딩 금지).
  //   각도 변환: 이 파일은 +x 축 기준(캔버스 arc), d3 는 12시 기준 시계방향 → +90°.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  ctx.beginPath();
  d3arc().context(ctx)
    .innerRadius(r0).outerRadius(r1)
    .startAngle(a0 + Math.PI / 2).endAngle(a1 + Math.PI / 2)
    .cornerRadius(round ?? (r1 - r0) * 0.42)({});
  ctx.fill();
  ctx.restore();
}

// 완료 체크 배지 — Figma 52:3178 정본: 흰 원(글로우) + 뉴턴 레드 체크.
// 원본 HTML은 반투명 흰 원 + 흰 체크였는데 그게 Figma와 달랐다(유저 지적).
export function checkBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.shadowColor = rgba(NEU.ink, 0.55); ctx.shadowBlur = r * 0.86;
  ctx.fillStyle = NEU.ink;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const k = r / 45.8;
  ctx.strokeStyle = PAL.red; ctx.lineWidth = 8.2 * k; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 19 * k, cy + 1 * k); ctx.lineTo(cx - 6 * k, cy + 14 * k); ctx.lineTo(cx + 19 * k, cy - 14 * k);
  ctx.stroke();
}

// SVG viewBox 604 · r275 규약 → 캔버스 px. 그림 자체는 공통 ringGauge 가 그린다.
function drawRing(ctx, n, y, prog, color) {
  ringGauge(ctx, CX, y + n.size / 2, 275 * n.size / 604, prog, { color });
}

/** 3·2·1 카운트다운 링 — **정본 컴포넌트**. floor-timer.html(_paint_timer)이 쓰던 코드를
 *  그대로 꺼낸 것이라 링 규격(604 · r275)·도트 숫자(220)·모션(ringPop 0.6→1.05→1 ·
 *  ringBreath 3회 · numPulse 1.5→1)이 전부 원본과 같다.
 *  왜 뺐나(유저 2회 지적): 다른 화면에서 카운트다운이 필요할 때마다 링과 숫자를 **다시 그리면**
 *  같은 물건이 화면마다 다른 물건이 된다. 쓰는 쪽은 이 함수만 부른다.
 *  o.t = 컴포넌트 로컬 시간(등장 모션용) · o.pulse = 숫자 바뀐 뒤 경과(0~1, numPulse) ·
 *  o.k = 크기 배율(1 = 604) · o.alpha · o.morph(0~1) = 링→알약 형태 변환(0 이면 순수 링). */
export function countRing(ctx, cx, cy, prog, txt, o = {}) {
  const t = o.t ?? 99, K2 = o.k ?? 1, mo = clamp01(o.morph ?? 0);
  const e = eOut(intro(t, .35, .8)), br = cycle(t, 1.2, 3, 3);
  ctx.save();
  ctx.globalAlpha *= kf(e, [[0, 0], [.7, 1], [1, 1]]) * (o.alpha ?? 1);
  const k = kf(e, [[0, .6], [.7, 1.05], [1, 1]]);
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  if (br != null && mo < .5) {
    const g2 = kf(br, [[0, 0], [.5, 1], [1, 0]]) * (1 - mo * 2);
    ctx.shadowColor = `rgba(255,255,255,${.35 * g2})`; ctx.shadowBlur = 26 * g2;
  }
  const R2 = 275 * K2;
  if (mo <= 0) {
    //   링 굵기는 호출자가 줄 수 있다 — 작아진 링(헤더 슬롯)은 기본 굵기로는 바닥에서 흐려진다.
    ringGauge(ctx, cx, cy, R2, prog, { color: '#fff', ...(o.ring || {}) });
  } else {
    // 형태 변환 — 링(정사각 roundRect, r=반지름)에서 알약(폭 pw · 높이 100k · r 50k)으로.
    //   같은 패스를 채움 0→.34 · 외곽선 1→0 으로 넘기면 '선으로 그린 링'이 '채워진 알약'이 된다.
    const pw = (o.pillW ?? 200) * K2, ph = 100 * K2;
    const L = (a, b) => a + (b - a) * mo;
    const w2 = L(R2 * 2, pw), h2 = L(R2 * 2, ph), r2 = L(R2, 50 * K2);
    const path = () => { ctx.beginPath(); ctx.roundRect(cx - w2 / 2, cy - h2 / 2, w2, h2, r2); };
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = 34 * mo;
    ctx.fillStyle = `rgba(255,255,255,${.34 * mo})`; path(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(255,255,255,${.38 * (1 - mo)})`; ctx.lineWidth = 3; path(); ctx.stroke();
    if (mo < .9) {   // 진행 광점 — 링일 때만
      const pa = prog * Math.PI * 2 - Math.PI / 2;
      ctx.save(); ctx.globalAlpha *= 1 - mo / .9;
      ctx.beginPath(); ctx.arc(cx + Math.cos(pa) * w2 / 2, cy + Math.sin(pa) * h2 / 2, 9 * K2, 0, 7);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    }
  }
  ctx.shadowBlur = 0;
  // numPulse — 숫자가 바뀔 때 1.5 → 1
  const q = clamp01(o.pulse ?? 1), nk = kf(q, [[0, 1.5], [1, 1]], eOut);
  ctx.save();
  ctx.globalAlpha *= kf(q, [[0, 0], [.35, 1], [1, 1]]);
  ctx.translate(cx, cy); ctx.scale(nk, nk); ctx.translate(-cx, -cy);
  // 카운트다운은 'GO' 까지 도트(유저 확정) — 숫자-전용 규약의 명시적 예외.
  //   ★ 단위(유저: 여기서 12가 의미하는 게 뭐냐) — 숫자만 있으면 초인지 횟수인지 알 수 없다.
  //     이 슬롯은 '지금 세고 있는 값'이고, 동작 유형에 따라 초/횟수/세트가 들어간다.
  //     그래서 단위를 값의 일부로 붙인다. 링(카운트다운) 구간엔 안 붙는다 — 3·2·1 은 자명하다.
  //   알약 상태의 글자 크기는 호출자가 정한다(o.pillFs, 기본 68 = 정본 배지 규격).
  //   타이머가 주인공이어야 하는 화면에선 더 키운다(유저: 시간이 읽히기나 해?).
  const fs2 = (220 - (220 - (o.pillFs ?? 68)) * mo) * K2;
  ctx.font = F(700, fs2, dot9);
  ctx.fillStyle = o.fill || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const uk = o.unit && mo > .55 ? (mo - .55) / .45 : 0;
  if (uk > 0) {
    const nw2 = ctx.measureText(txt).width;
    ctx.font = F(400, fs2 * .46);
    const uw = ctx.measureText(o.unit).width, gap2 = fs2 * .16;
    ctx.font = F(700, fs2, dot9);
    ctx.fillText(txt, cx - (uw + gap2) / 2, cy);
    ctx.save(); ctx.globalAlpha *= Math.min(1, uk);
    ctx.font = F(400, fs2 * .46); ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.fillText(o.unit, cx + (nw2 + gap2) / 2, cy + fs2 * .17);
    ctx.restore();
  } else ctx.fillText(txt, cx, cy);
  ctx.restore();
  ctx.restore();
}
/** 눈금 스케일 — 연속 값 하나를 '많은 얇은 눈금 + 밝은 지시선'으로 읽힌다.
 *  왜 필요한가: 편차 바(_devBar)는 선 하나 + 점 하나라 투사면에서 점이 어디쯤인지 가늠할
 *  기준이 없다(양끝이 페이드라 끝도 안 보인다). 눈금이 촘촘하면 **얼마나** 벗어났는지가
 *  거리 감각으로 잡히고, 지시선 하나만 밝으면 시선이 거기로 바로 간다.
 *  dev = -1~+1 (0 = 목표) · o.n 눈금 수 · o.h 눈금 높이 · o.col 지시선 색.
 *  ★ 매체 주의: 원본 레퍼런스는 '밝은 블룸 + 어두운 코어'인데 바닥은 밝은 트랙 위 가산 투사라
 *    어두운 값을 못 만든다. 그래서 코어는 빼고 **눈금 구조만** 가져온다. */
export function tickScale(ctx, cx, by, w, dev, o = {}) {
  // ★ 바닥 튜닝(유저: 바닥에서도 더 잘 읽히게) — 밝은 트랙(#8B9080) 위 가산 투사에서는
  //   얇고 흐린 흰 선이 그냥 사라진다. 화면 UI 감각으로 잡은 3px/.30 은 투사면에서 워시아웃.
  //   ① 눈금 수를 줄여(29→21) 칸을 벌리고 ② 그만큼 굵게(3→6, 중앙 8) ③ 알파를 올리고(.30→.48)
  //   ④ 높이를 키운다(34→46). 촘촘함보다 **한 칸이 보이는 것**이 먼저다.
  //   ★ 눈금 **수**를 고정하면 안 된다(유저: 2단 그리드는 어떻게 대응하지). 실전 스탯은
  //     2단으로 앉아 칼럼이 232~460px 로 좁아지는데, 21개를 그대로 넣으면 6px 획이 붙어
  //     회색 띠가 된다. 고정할 것은 개수가 아니라 **간격(pitch)** 이다 — 획 6 + 여백 16 = 22.
  //     n 은 폭에서 파생하고 **항상 홀수**로 만든다(가운데 목표 눈금이 없으면 기준이 사라진다).
  const PITCH = o.pitch ?? 22;
  const nAuto = Math.max(5, Math.floor(w / PITCH) | 1);
  const n = o.n ?? nAuto, h = o.h ?? 46, col = o.col || '#fff';
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = cx - w / 2 + w * u;
    const edge = Math.sin(u * Math.PI);                 // 양끝으로 갈수록 흐리고 짧게
    const mid = Math.abs(u - .5) < .001;
    ctx.strokeStyle = rgba(NEU.paper, (mid ? .88 : .48) * (0.34 + 0.66 * edge));
    ctx.lineWidth = mid ? 8 : 6;
    const hh = h * (mid ? 1.30 : (.66 + .34 * edge));
    ctx.beginPath(); ctx.moveTo(x, by - hh / 2); ctx.lineTo(x, by + hh / 2); ctx.stroke();
  }
  if (o.on === false) { ctx.restore(); return; }
  // 지시선 — 눈금과 같은 어휘(세로 선)지만 더 길고 더 밝다. 점이 아니라 선이라 눈금 사이에
  //   있어도 '어느 칸'인지가 읽힌다.
  const px = cx + Math.max(-1, Math.min(1, dev)) * (w / 2);
  //   지시선도 같이 키운다 — 눈금이 굵어진 만큼 더 굵고 더 길어야 '하나만 밝다'가 성립한다.
  ctx.shadowColor = col; ctx.shadowBlur = 30;
  ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, by - h * .88); ctx.lineTo(px, by + h * .88); ctx.stroke();
  ctx.shadowBlur = 0;   // 코어 한 번 더 — 글로우만 남으면 투사에서 뭉개진다
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(px, by - h * .78); ctx.lineTo(px, by + h * .78); ctx.stroke();
  ctx.restore();
}
function drawCenteredNum(ctx, text, cx, cy, size) {
  // 도트는 숫자에만 — 값이 없어 '—' 를 띄우는 순간까지 도트로 찍히면 안 된다(유저 규약).
  ctx.font = F(700, size, /\d/.test(String(text)) ? dot9 : sans);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

// ── 스테이지 → 노드 열 구성 (floor-scene.html의 <script> 분기와 1:1) ──────────────
const SCRIM_TYPES = new Set(['text', 'trainRow', 'liveRow', 'km', 'dots', 'paceErr', 'paceSub']);

/** 페이스 유지 팩 — 실전 지면의 수치 구성이 케이던스 팩과 다르다. ?pacepack=1 로 갈아 끼운다.
 *  두 팩은 목표가 다르므로 필요한 수치도 다르다:
 *    · 케이던스 팩(현행) = SPM 이 주인공. 메트로놈·편차 바가 전부 케이던스를 가르친다.
 *    · 페이스 유지 팩    = '목표 대비 지금 몇 초'가 주인공. SPM 은 수단이라 화면에서 뺀다.
 *  현행 화면이 복잡했던 이유가 이것이다(유저) — 두 팩의 수치가 한 화면에 같이 올라가 있었고,
 *  게다가 Pace 는 SPM 에서 계산된 값이라 넷 중 둘이 같은 말을 하고 있었다. */
const PACE_PACK = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('pacepack') === '1';

function buildScene(stage, p) {
  const S = (window.FLOOR_SCENES || {})[stage] || { title: stage, cue: '' };
  const isP = /^P\d$/.test(stage);
  const isC = /^C[2-5]$/.test(stage);
  const hasPrev = /^(A2|A3|BK_A[23]|BK_B[12345])$/.test(stage);
  const isStep = /^BK_B[2345]$/.test(stage);
  const col = [];
  // 머리말 = 벽(wallgl _paint_scene)과 같은 [단계 → 제목 → 진행] 묶음.
  //   데이터(FLOOR_PHASES · phase · sub)는 처음부터 있었는데 그리질 않아 지면만 제목 하나로
  //   휑했다 — 유저: "바닥 UI가 왜 벽면이랑 다르고 투박하냐". 구 s-cap('n / 4' 단독)은
  //   여기 sub 가 그대로 담으므로 폐기(같은 정보 두 벌 금지).
  // 페이즈 브레드크럼 — 정본 레퍼런스(유저 #110 실사 합성본)에 포함, 복원.
  const PH = (typeof window !== 'undefined' ? window.FLOOR_PHASES : null)
    || { running: ['WARM UP', 'PACE', 'RUN'], basketball: ['WARM UP', 'DRILL', 'GAME'] };
  const phases = PH[/^BK_/.test(stage) ? 'basketball' : 'running'];
  if (!isC && phases && S.phase != null)
    col.push(node('s-crumb', { type: 'crumb', phases, phase: S.phase, sub: S.sub || '', mb: -34 }));
  // ★ 프리뷰(관찰) A안 확정(유저) — 제목만 크게 놓던 것을 **미니 캡슐 헤더**로 바꾼다:
  //   유리 알약 + 왼쪽에 카운트 링(정본 countRing) + 동작명. 시작화면 캡슐이 작아져 올라온
  //   것으로 읽히고, 카운트다운 링이 형태를 안 바꾸고 그 자리에 앉는다.
  //   타이머는 기존 컴포넌트 그대로 — 새로 그리지 않는다.
  if (!isC) col.push(node('s-head', { type: 'capHead', title: S.title, dur: p.dur || 8 }));
  // ★ 가이드 문구는 대문자(유저 08-05) — 복싱(벽)이 세션마다 대문자라 지면도 같은 규약으로.
  //   한글은 toUpperCase 가 무영향이라 그대로 지나간다. 이름·수치는 대상이 아니다.
  col.push(node('s-cue', { type: 'text', textContent: String(S.cue || '').toUpperCase(), size: 52, weight: 400, color: 'rgba(255,255,255,.72)', style: { display: 'none' } }));
  // 실전 상단 — 케이던스 팩은 누적 거리, 페이스 팩은 '목표 대비 지금 몇 초'.
  //   페이스 팩에서 누적 거리를 안 쓰는 이유: 달리는 중에 필요한 건 이미 한 양이 아니라 남은 양이다
  //   (남은 거리는 아래 paceSub 로 내려간다). 누적은 리포트에서 볼 값.
  if (isC) col.push(PACE_PACK ? node('pace-err', { type: 'paceErr' }) : node('km', { type: 'km' }));
  if (hasPrev) col.push(node('prev-row', { type: 'prevRow', pv: p.pv || 3, pvn: p.pvn || 0 }));
  // 도트 진행바 — 원본 HTML의 노출 규칙 두 가지를 그대로 따른다.
  //  ① 시범(Preview) 동안은 감춘다. 공간도 차지하지 않는다 — 프리뷰가 그 자리를 쓰기 때문.
  //  ② 스텝백 따라하기(BK_B2~B5)엔 아예 없다. 진행은 상단 n/4 가 담당(유저 확정).
  //  ③ 자리를 이어받는 노드는 앞 노드가 다 비운 뒤(아웃로 0.05+0.45) 나타난다 — 안 그러면 슬라이드로 보인다.
  if (!isStep) col.push(node('s-dots', { type: 'dots', mt: -38, dur: p.dur || 8, hideUntil: hasPrev ? (p.pv || 3) + 0.5 : 0, delay: hasPrev ? (p.pv || 3) + 0.15 : 0 }));
  if (isP) col.push(node('train-row', { type: 'trainRow', ring: /^P[23]$/.test(stage) }));
  if (isC) col.push(PACE_PACK ? node('pace-sub', { type: 'paceSub' }) : node('live-row', { type: 'liveRow' }));
  col.push(node('s-succ', { type: 'succ', style: { display: 'none' } }));
  return { col, hasPrev, isStep, pv: p.pv || 3 };
}

export class FloorGL {
  static uploads = 0;
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(W * K); this.canvas.height = Math.round(H * K);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      // depthWrite:false — 반투명 UI. depthTest는 켠 채로 두는 게 이 이식의 전부다(x봇에 가려짐).
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    this.stage = null; this.map = new Map(); this.col = []; this.t = 0; this._sig = null;
    this._textBand = { y0: 1e9, y1: -1e9 };   // 이번 프레임 텍스트가 차지한 세로 구간(대지 px)
    // 캔버스 fillText는 웹폰트 로드를 촉발하지 않는다 — 명시 로드 후 한 번 다시 그린다.
    for (const f of ['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'])
      document.fonts?.load(f).then(() => { this._sig = null; }).catch(() => {});
    this.doc = {
      getElementById: id => this.map.get(id) || null,
      querySelector: s => this.map.get(({ '.dclip': 's-dots', '#prev-ring .arc': 'prev-arc', '#prev-ring .tip': 'prev-tip' })[s] || s.replace(/^[#.]/, '')) || null,
    };
  }

  // 모든 바닥 문서를 이 경로가 담당한다(CSS3D 바닥 프레임은 남은 게 없다)
  static handles(src) { return /floor(-scene|-transition|-timer|-report|-bk)?\.html/.test(src); }

  /** 이 UI가 쓰는 이미지 전부 — 진입 전에 미리 굽는다.
   *  예전엔 첫 _paint 가 로드를 촉발해서 진입 직후 몇 프레임이 이미지 없이 그려지고 툭 나타났다
   *  (유저: 첫 화면 인터랙션 딜레이 — 화면 녹화에선 그대로 찍힌다). */
  static ASSETS = ['bg_glow.svg', 'fig/big_glow.svg', 'run/arrow.svg', 'run/foot.svg', 'flame.svg',
    // 데이터에서 오는 것들(_img 리터럴이 아니라 TR/READY 테이블) — 빠뜨리면 카드가 늦게 뜬다
    'run/ic_glasses.png', 'run/ic_watch.png', 'run/ic_earbuds.png',
    'run/run_stretch.png', 'run/run_learn.png', 'run/run_run.png',
    'bk/bk_stretch.png', 'bk/bk_learn.png', 'bk/bk_play.png'];
  preload() { for (const a of FloorGL.ASSETS) this._img(a); }

  // 이미지(글로우·아이콘·인물 카드) — 로드되면 한 번 다시 그린다
  _img(rel) {
    this._imgs = this._imgs || new Map();
    let im = this._imgs.get(rel);
    if (!im) {
      im = new Image();
      im.onload = () => { this._sig = null; };
      im.src = (import.meta.env?.BASE_URL || '/') + 'ready-view/assets/' + rel;
      this._imgs.set(rel, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  load(stage, params) {
    this.stage = stage;   // ★ 이게 빠져 있었다 — 스테이지가 영원히 옛값이라 화면-세션 동기 검증이 전부 오작동(지면 고착의 뿌리)
    this.kind = /floor-transition/.test(params.src) ? 'transition'
      : /floor-timer/.test(params.src) ? 'timer'
      : /floor-report/.test(params.src) ? 'report'
      : /floor(-bk)?\.html/.test(params.src) ? 'ready' : 'scene';
    this.params = params;
    this._numLast = null; this._numT = 0;   // numPulse(카운트다운 숫자) 상태
    if (this.kind !== 'scene') {
      this.stage = stage; this.col = []; this.map.clear();
      this.t = 0; this._sig = null; this._lastPaint = -1;
      return;
    }
    const b = buildScene(stage, params);
    this.stage = stage; this.col = b.col; this.b = b; this.t = 0; this._sig = null; this._lastPaint = -1;
    this.map.clear();
    for (const n of b.col) {
      this.map.set(n.id, n);
      for (const k of n.type === 'prevRow' ? ['prev-num', 'prev-arc', 'prev-tip', 'prev-row'] : []) if (!this.map.has(k)) this.map.set(k, node(k));
      if (n.type === 'prevRow') { this.map.set('prev-num', node('prev-num', { textContent: params.pvn ? '0/' + params.pvn : String(params.pv || 3) })); }
      if (n.type === 'succ') for (const k of ['succ-n', 'succ-arc', 'succ-dot']) this.map.set(k, node(k, { textContent: '3' }));
      if (n.type === 'trainRow' || n.type === 'liveRow') for (const k of ['spm-me', 'spm-tgt', 'tp-arc', 'tp-tip', 'tp-num', 'pace-me', 'pace-tgt'])
        this.map.set(k, node(k, { textContent: '--' }));
      if (n.type === 'km') this.map.set('km-n', node('km-n', { textContent: '0.00' }));
      // 페이스 팩이 먹는 값 — main 이 같은 id 로 써 넣는다. km-tgt(목표 거리)·pace-bank(구간 누적 편차 초)는 새 값.
      if (n.type === 'paceErr' || n.type === 'paceSub')
        for (const [k, v] of [['pace-me', '--'], ['pace-tgt', '--'], ['km-n', '0.00'], ['km-tgt', '5.00'], ['pace-bank', '0']])
          if (!this.map.has(k)) this.map.set(k, node(k, { textContent: v }));
    }
    this.map.set('prev-row', b.col.find(n => n.type === 'prevRow') || node('prev-row'));
  }

  // 변경 없으면 다시 안 그린다 — 1600×2670 텍스처 업로드가 프레임 예산을 먹는 걸 막는다.
  _sigOf() {
    let s = String(Math.round(this.t * 24));
    for (const n of this.map.values()) s += '|' + n.textContent + JSON.stringify(n.style) + JSON.stringify(n._attr || {});
    return s;
  }

  update(dt) {
    if (!this.stage) return;
    this.t += dt;
    // 24fps — 22fps는 끊겨 보였고 60fps는 업로드(9.6MB/장)가 프레임 예산을 먹었다(유저 양쪽 신고).
    // 값이 안 바뀌면 아래 서명 비교에서 또 걸러지므로 정지 화면은 업로드 0이다(실측 0.9회/초).
    // ponytail: 진짜 해법은 정적 텍스트와 움직이는 요소(도트·링)를 별도 평면으로 쪼개는 것 —
    //   그러면 매 프레임 올리는 텍스처가 수백 KB로 떨어진다. HANDOFF에 계획으로 남김.
    if (this.t - (this._lastPaint ?? -1) < 1 / UI_FPS) return;
    const sig = this._sigOf();
    if (sig === this._sig) return;
    this._sig = sig; this._lastPaint = this.t;
    FloorGL.uploads++;   // 계측용 — 실제 텍스처 업로드 횟수
    this._paint();
    this.tex.needsUpdate = true;
  }

  _paint() {
    const ctx = this.ctx;
    legWatch(ctx);
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this._textBand.y0 = 1e9; this._textBand.y1 = -1e9;   // 매 프레임 재수집
    if (this.kind && this.kind !== 'scene') return this['_paint_' + this.kind]();
    const cap2 = CAPS[this.stage];
    if (cap2) return this._paint_capsule(cap2);   // 신규 캡슐 시스템(옵트인) — 레거시 조판 대체
    let y = LAYOUT.HEAD.y;   // 레이아웃 규약
    for (const n of this.col) {
      if (n.style.display === 'none') continue;
      if (n.hideUntil && this.t < n.hideUntil) continue;   // 시범 중 도트바 — 자리도 비운다
      // 조판 규칙: **안 보이는 노드는 자리도 안 차지한다.** display:none·hideUntil 이 이미
      // 그렇고, 사라지는 중(아웃로)도 같다 — 자리를 폭만큼 같이 줄인다. 안 그러면 시범이 끝난
      // 뒤 프리뷰 행 200 + 간격 72 가 빈 채로 남아 제목과 진행바가 300px 넘게 벌어졌다(유저).
      const o = this._outro(n);
      if (o < 0.004) continue;
      const h = this._h(n) * o;
      if (n.mt) y += n.mt;
      // Success 는 흐름에서 빼고 대지 비율로 못박는다 — 앞 노드가 숨으면 같이 튀었다(유저).
      const yFlow = y;
      if (n.type === 'succ') y = Math.round(H * 0.42);
      // ★ 진행 게이지는 **흐름 그대로** 둔다 — 헤더(capHead) 바로 다음 자리가 이미 y≈586 이라
      //   '헤더 아래'가 저절로 성립한다. 좌표로 못박았더니 뒤 노드(trainRow)가 그 자리로
      //   올라와 겹쳤다(실측: P1 에서 SPM 이 아크 위에 얹혔다).
      if (n.style.visibility !== 'hidden') {
        const e = this._intro(n);
        ctx.save();
        ctx.globalAlpha = numOr(n.style.opacity, 1) * e * o;
        if (e < 1 && !n.cascade) {   // 제자리 스케일 인(원본 sUpFlat) — 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다
          const k = 0.94 + 0.06 * e;
          ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2));
        }
        if (ctx.globalAlpha > 0.004) { this._band(n, y, h); this._draw(n, y); }
        ctx.restore();
      }
      y = (n.type === 'succ' ? yFlow : y + h + (72 + (n.mb || 0)) * o);
    }
  }

  // 등장 = 제자리 페이드(원본 sUpFlat/chIn의 요지). 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다.
  _intro(n) {
    const d = { 's-crumb': 0.04, 's-cap': 0.18, 's-title': 0.1, 's-cue': 0.28, 's-dots': 0.42 }[n.id] ?? 0.2;
    return Math.max(0, Math.min(1, (this.t - d) / 0.55));
  }

  // 프리뷰 행은 시범이 끝나면 사라진다(원본 demoOutFlat .45s @ --pvOut = pv + 0.05)
  _outro(n) {
    return n.type === 'prevRow' ? 1 - clamp01((this.t - (n.pv + 0.05)) / 0.45) : 1;
  }

  _h(n) {
    switch (n.type) {
      case 'crumb': return 50;
      case 'capHead': return 250;
      case 'text': return n.size * 1.06;
      case 'dots': return gaugeH(760);
      case 'prevRow': return 200;
      case 'trainRow': return n.ring ? 236 : 228;   // 새 스탯 컴포넌트(값 132 + 편차바 + 라벨) 실높이
      case 'liveRow': return 228;
      case 'paceErr': return 300;   // 값 200 + 편차 바 + 목표 라벨
      case 'paceSub': return 150;   // 남은 거리 · 구간 누적 편차 두 칸
      case 'km': return 180;
      case 'succ': return 400;
      default: return 0;
    }
  }

  // 텍스트가 차지한 세로 구간을 대지 px 로 적어 둔다 — 마크 토큰이 이 구간을 지날 때
  //   토큰 쪽에서 알파를 블러 마스크로 깎기 위한 입력(main 이 월드로 변환해 셰이더에 넣는다).
  //   ★ 옅은 흰 플레이트를 얹어 뒤를 뭉개는 방식은 기각 — 빔은 빛을 '더할' 뿐이라 그 방식은
  //     화면에 없던 광량을 만들어 낸다(유저: '빛을 더하고 그런 개념이 아니라 마스킹을 블러로').
  //     가릴 게 아니라 '그 자리엔 토큰을 안 쏜다'가 물리적으로도 맞다.
  _band(n, y, h) {
    if (!SCRIM_TYPES.has(n.type)) return;
    const b = this._textBand;
    if (b.y0 > b.y1) { b.y0 = y; b.y1 = y + h; } else { b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y + h); }
  }

  /** 텍스트 구간 → 월드 공간 마스크 파라미터. main 이 UI_MASK 에 복사해 마크 셰이더로 보낸다.
   *  프레임은 바닥에 눕혀 floorObj 에 글루돼 있으므로 로컬 +y 가 월드 수평 진행축이 된다. */
  uiMask(out) {
    const b = this._textBand;
    if (!this.mesh.visible || b.y0 > b.y1) return null;
    const m = this.mesh;
    m.updateMatrixWorld();
    _mp.set(0, H / 2 - (b.y0 + b.y1) * 0.5, 0).applyMatrix4(m.matrixWorld);
    _mf.set(0, 1, 0).transformDirection(m.matrixWorld); _mf.y = 0; _mf.normalize();
    _mr.set(1, 0, 0).transformDirection(m.matrixWorld); _mr.y = 0; _mr.normalize();
    out.ox = _mp.x; out.oz = _mp.z;
    out.fx = _mf.x; out.fz = _mf.z;
    out.rx = _mr.x; out.rz = _mr.z;
    out.halfL = (b.y1 - b.y0) * 0.5 * Math.abs(m.scale.y) + 0.06;   // 글자 높이 + 여유
    out.halfW = 560 * Math.abs(m.scale.x);                          // 열 최대폭(SPM 행) 기준
    out.feather = 0.18;   // 경계 페더(m) — 이게 '블러 마스크'의 번짐 폭이다
    out.amt = 0.85;       // 완전 0 까지는 안 깎는다 — 토큰이 뒤에 있다는 건 보여야 한다
    return out;
  }

  _draw(n, y) {
    const ctx = this.ctx;
    switch (n.type) {
      case 'crumb': return this._crumb(n, y);
      case 'capHead': return this._capHead(n, y);
      case 'text': return drawText(ctx, n, y, this.t);
      case 'dots': return this._dots(n, y);
      case 'prevRow': return this._prevRow(n, y);
      case 'trainRow': return this._trainRow(n, y);
      case 'liveRow': return this._liveRow(n, y);
      case 'km': return this._km(n, y);
      case 'paceErr': return this._paceErr(n, y);
      case 'paceSub': return this._paceSub(n, y);
      case 'succ': return this._succ(n, y);
    }
  }

  /** 미니 캡슐 헤더 — [유리 알약] 왼쪽 카운트 링 + 동작명. 프리뷰 A안 정본(유저 확정).
   *  폭은 고정(840) — 스테이지마다 헤더가 커졌다 작아지면 '같은 물건이 자리를 옮긴다'가 깨진다.
   *  타이틀 상한 400px 은 floor-scenes.js 에서 지킨다(농구 스텝 4개를 그 규칙으로 줄였다). */
  _capHead(n, y) {
    // ★ 위계 정정(유저: 타이머도 개 작아지고 sec 보이지도 않고 타이틀도 줄었다 — 이게 맞냐).
    //   맞지 않았다. 250 높이 알약에 셋을 우겨넣어 전부 작아졌고, 특히 **타이머 숫자(67)가
    //   타이틀(72)보다 작았다** — 따라하기 중 계속 봐야 하는 값이 제일 작았다는 뜻이다.
    //   'sec' 40px 는 minFs(≈63) 미달이라 애초에 안 보이는 게 정상이었다.
    //   → 알약을 키우고(1140×330) 링을 키워(RR 120 → 숫자 96) 타이머를 주인공으로 되돌린다.
//   ★ 타이틀 크기는 **시작화면 것을 그대로 유지**한다(유저) — 같은 물건이 줄어드는 것인데
    //     글자만 작아지면 다른 화면이 된다. READY 타이틀 98px 을 프리뷰(100)·헤더 모두 같이 쓴다.
    //     'Neck & Shoulders' 가 98px 에서 739px 이라 알약 폭은 1320 이 필요하다(y176 안전폭 2174).
    const ctx = this.ctx, W2 = LAYOUT.HEAD.w, HH = LAYOUT.HEAD.h, x = CX - W2 / 2;
    const path = () => { ctx.beginPath(); ctx.roundRect(x, y, W2, HH, HH / 2); };
    ctx.save();
    path(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fillRect(x, y, W2, HH);
    ctx.filter = 'blur(37px)'; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 80;
    path(); ctx.stroke(); ctx.filter = 'none';
    ctx.restore();
    const rim = ctx.createLinearGradient(0, y, 0, y + HH);
    rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.45, 'rgba(255,255,255,.22)');
    rim.addColorStop(1, 'rgba(255,255,255,.06)');
    ctx.strokeStyle = rim; ctx.lineWidth = 2.5; path(); ctx.stroke();
    // 카운트 링 — 정본 컴포넌트 그대로(형태 변환 없음, 자리만 여기다)
    const RR = 130, cyR = y + HH / 2, cxR = x + 64 + RR;   // 숫자 104 — 타이틀 98 보다 살짝 크게
    const dur = n.dur || 8, rem = Math.max(0, Math.ceil(dur - this.t));
    if (String(rem) !== this._numLast2) { this._numLast2 = String(rem); this._numT2 = this.t; }
    countRing(ctx, cxR, cyR, clamp01(1 - this.t / dur), String(rem),
      { t: 99, k: RR / 275, pulse: clamp01((this.t - (this._numT2 || 0)) / 0.5),
        ring: { trackW: 10, arcW: 10, trackA: .26 } });
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = F(400, LAYOUT.TYPE.unit);
    ctx.fillText('sec', cxR + RR + 22, cyR + 10);
    // 52 → 72(유저: 타이틀이 너무 작다). 최장 'Neck & Shoulders' 가 72px 에서 543px —
    //   폭 1000 의 타이틀 예산(≈560) 안에 들어간다. y176 안전폭은 2174 라 여유는 충분하다.
    ctx.fillStyle = '#fff'; ctx.font = F(700, LAYOUT.TYPE.title); ctx.letterSpacing = '-4px';
    const tx = cxR + RR + 22 + 128 + 46;   // 링 우측 → sec → 타이틀 (실폭에서 파생)
    // 쉼표가 있으면 의미 단위로 두 줄(농구 스텝) — 지금 데이터엔 없지만 규칙은 남긴다.
    const ci = (n.title || '').indexOf(', ');
    if (ci > 0) { ctx.fillText(n.title.slice(0, ci + 1), tx, cyR - 56); ctx.fillText(n.title.slice(ci + 2), tx, cyR + 56); }
    else ctx.fillText(n.title || '', tx, cyR);
    ctx.letterSpacing = '0px';
    // 스텝 배지(n/4) — 농구 분해 스텝만. 헤더 오른쪽 끝에 조용히.
    if (n.step) {
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = F(400, 44);
      ctx.fillText(n.step, x + W2 - 56, cyR);
    }
  }

  /** 단계 브레드크럼 — 벽(wallgl)과 **같은 규약**: 현재 단계만 볼드 + 글로우 + 숨쉬기,
   *  나머지는 흐리게(두 칸 이상 뒤는 더 흐리게). 치수만 지면 대지 비율로 1.5배(벽 28/24 → 42/36). */
  _crumb(n, y) {
    // 지면은 '지금'만 말한다(유저) — 예정 단계(PACE·RUN) 나열 없이 현재 페이즈 + 진행만.
    //   "WARM UP 1/3" 한 조각. 볼드 + 글로우 + 숨쉬기는 기존 활성 규약 그대로.
    const ctx = this.ctx;
    const str = (n.phases[n.phase] || '') + (n.sub ? ' ' + n.sub : '');
    ctx.save();
    const pu = cycle(this.t, 1.2, 2.4, 9999);
    if (pu != null) ctx.globalAlpha *= kf(pu, [[0, 1], [.5, .6], [1, 1]]);
    ctx.shadowColor = 'rgba(255,255,255,.45)'; ctx.shadowBlur = 42;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    //   42 → 66 — 대지 최상단(y176)은 가장 멀고 가장 눕혀 보이는 자리라 minFs 가 65 를 요구한다.
    //   '미감상 작게'가 가장 위험해지는 지점이다(유저). 트래킹 6 → 4 로 폭 증가를 눌렀다.
    ctx.font = F(700, 66); ctx.fillStyle = '#fff';
    ctx.letterSpacing = '4px';
    ctx.fillText(str, CX + 3, y);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  // 도트 프로그래스 — 공통 컴포넌트(dotProgress). 지면·벽이 같은 물건이다.
  _dots(n, y) {
    // 폭은 투사 안전폭에서 깎는다 — 하단은 콘이 좁아 760 도 위험할 수 있다(safeW 참고).
    const wD = Math.min(760, safeW(y) - 48), x0 = CX - wD / 2;
    // main.js가 width를 직접 쓰면(반복형 스테이지) 그 값이 우선, 아니면 --dur 시간 진행.
    const w = n.style.width != null ? numOr(n.style.width, 0)
      : 600 * clamp01((this.t - n.delay) / n.dur);
    arcGauge(this.ctx, x0, y, wD, w / 600);
  }

  _pill(x, y, w, h) {
    const ctx = this.ctx, r = Math.min(w, h) / 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }

  // Preview 필 + 카운트다운 링 (Figma 122:270)
  _prevRow(n, y) {
    const ctx = this.ctx;
    const arc = this.map.get('prev-arc'), tip = this.map.get('prev-tip'), num = this.map.get('prev-num');
    // main.js(스텝백)가 dashoffset을 직접 구동하면 그 값, 아니면 CSS arcFill 시간 진행.
    const prog = arc?.style.strokeDashoffset != null
      ? 1 - numOr(arc.style.strokeDashoffset, 0) / 1727.9
      : ((this.t - 0.15) / (n.pvn ? n.pv / n.pvn : n.pv)) % 1;
    const gap = 120, ringW = 200;
    ctx.font = F(700, 70); const tw = ctx.measureText('PREVIEW').width;   // 60 → 70 (minFs(475)=61)   // 가이드=대문자(유저)
    const pillW = 40 + tw + 20 + 60 + 30, pillH = 100;
    const total = pillW + gap + ringW, x0 = CX - total / 2;
    const py = y + (ringW - pillH) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; this._pill(x0, py, pillW, pillH);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('PREVIEW', x0 + 40, py + pillH / 2);
    // 화살표 →
    const ax = x0 + 40 + tw + 20, ay = py + pillH / 2;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax + 10, ay); ctx.lineTo(ax + 48, ay);
    ctx.moveTo(ax + 33, ay - 15); ctx.lineTo(ax + 48, ay); ctx.lineTo(ax + 33, ay + 15); ctx.stroke();
    const save = CX; // 링은 중앙 정렬 헬퍼를 쓰므로 잠시 위치를 옮겨 그린다
    this._ringAt(x0 + pillW + gap + ringW / 2, y, ringW, prog, '#fff');
    drawCenteredNum(ctx, num?.textContent || '', x0 + pillW + gap + ringW / 2, y + ringW / 2, n.pvn ? 70 : 96);   // 62 → 70 (minFs(y≈130)=66)
    void save;
  }

  _ringAt(cx, y, size, prog, color) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(cx - CX, 0);
    drawRing(ctx, { size }, y, Math.max(0, Math.min(1, prog)), color);
    ctx.restore();
  }

  // 케이던스·페이스 컴포넌트 — 큰 도트 숫자 하나 + 편차 바 + 작은 라벨.
  //   구 "224 / 214  SPM"은 같은 크기의 숫자 둘과 슬래시가 나란한 '텍스트 나열'이라 달리는 중엔
  //   초점을 맞춰야 읽혔다(유저: '운동중에 방해만 되는 느낌'). 러닝 워치가 공통으로 쓰는 규칙을 따른다 —
  //     ① 값 하나가 압도적으로 크다(한눈에 = 초점 이동 없음)
  //     ② 목표와의 '관계'는 숫자로 또 쓰지 않고 그래픽(위치·색)으로 읽힌다
  //     ③ 라벨은 작고 조용하게, 값의 주인공 자리를 뺏지 않는다
  //   활자 규약(유저 확정): **숫자만 도트(OffBit), 라벨·단위는 본문 영문(Supreme).**
  _lstat(cx, y, me, tgt, label) {
    const ctx = this.ctx;
    const mv = statVal(me), tv = statVal(tgt);
    const ok = Number.isFinite(mv) && Number.isFinite(tv) && tv > 0;
    const dev = ok ? (mv - tv) / tv : 0;              // 목표 대비 상대 편차
    const off = Math.min(1, Math.abs(dev) / 0.12);    // ±12% 를 만점으로 본다
    const col = !ok ? NEU.paper : off < 0.35 ? PAL.sand : off < 0.72 ? PAL.coral : PAL.red;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // ① 값 — 도트 숫자 = 카운트업(유저 규칙). 진입 후 0.6s 동안 세어 오르고, 그 뒤엔 실시간 값을
    //   그대로 따라가며 자릿수만 굴러간다. '--'(미측정)는 숫자가 아니라 그대로 그려진다.
    //   색은 싣지 않는다(흰색 고정) — 편차는 아래 ②의 점이 이미 위치로 말한다. 숫자에까지 색을
    //   태우면 ⓐ 학습자는 늘 목표와 어긋나 있어 빨강이 기본 상태가 되고(경고가 경고를 잃는다),
    //   ⓑ 가산 투사에서 적색이 가장 먼저 대비를 잃어 '많이 틀어진 순간'에 제일 안 읽힌다.
    rollNum(ctx, me || '--', this.t, 0, 0.6, cx, y + 118 - 132 * 0.78, 132,
            { fam: dot9, align: 'center', fill: NEU.paper });
    // ② 편차 바 — 가운데 눈금이 목표, 점이 현재. 관계를 '위치'로 읽는다. (_devBar 공용)
    const BW = 232, BY = y + 154;
    this._devBar(cx, BY, BW, dev / 0.12, col, ok);
    // ③ 라벨 — 본문 영문. 숫자가 아니므로 도트 금지(유저 규약).
    ctx.font = F(400, 58); ctx.letterSpacing = '7px';   // 34 → 58 (minFs(y≈817)=56) — 안 읽히던 라벨
    ctx.fillStyle = rgba(NEU.paper, 0.6);
    ctx.fillText(String(label).toUpperCase(), cx + 3.5, BY + 60);
    ctx.letterSpacing = '0px';
  }

  _trainRow(n, y) {
    const me = this.map.get('spm-me')?.textContent, tgt = this.map.get('spm-tgt')?.textContent;
    if (!n.ring) return this._lstat(CX, y, me, tgt, 'SPM');
    const gap = 96, statW = 300, total = statW + gap + 200, x0 = CX - total / 2;
    this._lstat(x0 + statW / 2, y, me, tgt, 'SPM');
    const arc = this.map.get('tp-arc');
    const prog = 1 - numOr(arc?.style.strokeDashoffset, 1727.9) / 1727.9;
    this._ringAt(x0 + statW + gap + 100, y, 200, prog, arc?.getAttribute('stroke') || '#fff');
    drawCenteredNum(this.ctx, this.map.get('tp-num')?.textContent || '—', x0 + statW + gap + 100, y + 100, 96);
  }

  _liveRow(n, y) {
    const g = id => this.map.get(id)?.textContent;
    this._lstat(CX - 180, y, g('spm-me'), g('spm-tgt'), 'SPM');
    this._lstat(CX + 180, y, g('pace-me'), g('pace-tgt'), 'Pace');
  }

  // 편차 바 — 가운데 눈금이 목표, 점이 현재. _lstat 과 같은 물건이라 규칙을 한 곳에 둔다.
  //   dev = 목표 대비 상대량(-1~1 로 잘린다), col = 점 색.
  _devBar(cx, by, w, dev, col, on) {
    // ★ 선+점 → **눈금 스케일**(유저 확정). 선 하나에 점 하나는 '얼마나' 벗어났는지 가늠할
    //   기준이 없었다. 눈금은 폭에서 파생되므로 2단 그리드(232px 칼럼)에서도 그대로 성립한다.
    tickScale(this.ctx, cx, by, w, dev, { col, on, h: w < 320 ? 38 : 46 });
  }


  /** 부호 붙은 초(±N”) — 페이스 팩의 기본 활자 단위.
   *  기호(+ − ”)는 본문 영문이라 도트 숫자와 크기·무게가 안 맞는다. 같은 크기로 두면
   *  솔리드 글리프가 구멍 많은(=시각적으로 가벼운) 도트 숫자를 눌러 부호가 주인공이 된다.
   *  기호만 0.55배로 낮추고, 부호는 숫자 잉크 중앙에·” 는 위에 건다. */
  _signedSec(cx, y, secs, size, delay = 0) {
    const ctx = this.ctx;
    const SS = size * 0.55, INK = size * 0.84;
    if (!Number.isFinite(secs)) {
      ctx.font = F(400, size, sans); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = rgba(NEU.paper, 0.6); ctx.fillText('--', cx, y);
      return;
    }
    const n = String(Math.abs(Math.round(secs))), sign = secs < 0 ? '−' : '+';
    ctx.font = F(400, SS, sans);
    const wSign = ctx.measureText(sign).width + size * 0.05, wQ = ctx.measureText('”').width;
    const wNum = rollWidth(ctx, n, size);
    const x0 = cx - (wSign + wNum + wQ) / 2;
    ctx.fillStyle = NEU.paper; ctx.textAlign = 'left';
    ctx.font = F(400, SS, sans); ctx.textBaseline = 'middle';
    ctx.fillText(sign, x0, y + INK * 0.5);
    rollNum(ctx, n, this.t, delay, 0.5, x0 + wSign, y, size, { fam: dot9, fill: NEU.paper });
    ctx.font = F(400, SS, sans); ctx.textBaseline = 'top';
    ctx.fillStyle = NEU.paper; ctx.fillText('”', x0 + wSign + wNum, y);
  }

  // ── 페이스 유지 팩: 주인공 = '목표 대비 지금 몇 초' ────────────────────────────
  //   절대 페이스(5’42”)만 주면 러너가 달리면서 목표를 빼야 한다. 부호 붙은 초 하나면
  //   지금 뭘 해야 하는지가 바로 나온다(+ = 느림 → 밀어야, − = 빠름 → 힘 아껴).
  //   숫자엔 색을 싣지 않는다 — 판정은 아래 편차 바의 점이 위치로 한다(_lstat 과 같은 규칙).
  _paceErr(n, y) {
    const ctx = this.ctx;
    const mv = statVal(this.map.get('pace-me')?.textContent);
    const tv = statVal(this.map.get('pace-tgt')?.textContent);
    const ok = Number.isFinite(mv) && Number.isFinite(tv) && tv > 0;
    const d = ok ? Math.round(mv - tv) : 0;
    const BAND = 20;                                  // ±20초/km 를 바 만점으로 본다
    const off = Math.min(1, Math.abs(d) / BAND);
    const col = !ok ? NEU.paper : off < 0.35 ? PAL.sand : off < 0.72 ? PAL.coral : PAL.red;
    this._signedSec(CX, y, ok ? d : NaN, 200, 0);
    this._devBar(CX, y + 232, 460, d / BAND, col, ok);
    // 목표 페이스는 조용히 — 주인공은 '차이'지 절대값이 아니다.
    ctx.font = F(400, 40); ctx.letterSpacing = '2px';
    ctx.fillStyle = rgba(NEU.paper, 0.6); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`TARGET ${this.map.get('pace-tgt')?.textContent || '--'}`, CX, y + 300);
    ctx.letterSpacing = '0px';
  }

  // 남은 거리 · 구간 누적 편차 — 페이스 배분에 필요한 둘.
  //   남은 거리: '이 페이스를 얼마나 더 버티나'. 누적 편차: 앞에서 벌어놨으면 지금 늦어도 된다
  //   (순간값 하나에 과잉 반응하는 걸 막는 값이라, 작게 둔다).
  _paceSub(n, y) {
    const ctx = this.ctx;
    const num = id => statVal(this.map.get(id)?.textContent);
    const left = Math.max(0, (num('km-tgt') || 0) - (num('km-n') || 0));
    const bank = Math.round(num('pace-bank') || 0);
    const label = (cx, s) => {
      ctx.font = F(400, 32); ctx.letterSpacing = '6px';
      ctx.fillStyle = rgba(NEU.paper, 0.55); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(s, cx + 3, y + 122);
      ctx.letterSpacing = '0px';
    };
    // 남은 거리 — 값(도트) + 단위(본문 영문). 단위는 값 옆에 붙으므로 두 서체 섞인 실폭으로 자리 잡는다.
    const cxL = CX - 230, v = left.toFixed(2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const wv = rollWidth(ctx, v, 88);
    ctx.font = F(400, 40); const wu = ctx.measureText(' km').width;
    const x0 = cxL - (wv + wu) / 2;
    rollNum(ctx, v, this.t, 0.15, 0.6, x0, y, 88, { fam: dot9, fill: NEU.paper });
    ctx.font = F(400, 40); ctx.fillStyle = rgba(NEU.paper, 0.7);
    ctx.fillText(' km', x0 + wv, y + 40);
    label(cxL, 'LEFT');
    this._signedSec(CX + 230, y, bank, 88, 0.15);
    label(CX + 230, 'TOTAL');
  }

  _km(n, y) {
    const ctx = this.ctx;
    ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    // 활자 규약(유저 확정): 숫자만 도트, 단위 'km' 은 본문 영문. 크기도 낮춰 값이 주인공이 되게.
    const v = this.map.get('km-n')?.textContent || '0.00';
    const wv = rollWidth(ctx, v, 180);   // 소수점이 본문 영문이라 도트 한 서체로 재면 어긋난다
    ctx.font = F(400, 78); const wu = ctx.measureText(' km').width;
    const x0 = CX - (wv + wu) / 2;
    ctx.textAlign = 'left';
    // 도트 숫자 = 카운트업(유저 규칙). km 은 라이브 중 계속 오르므로, 0.7s 진입 이징 뒤
    //   실제 값을 따라가며 소수 자리가 계속 굴러간다 — 오도미터와 같은 움직임.
    rollNum(ctx, v, this.t, 0, 0.7, x0, y, 180, { fam: dot9, fill: '#fff' });
    ctx.font = F(400, 78); ctx.fillStyle = rgba(NEU.paper, 0.7);
    ctx.fillText(' km', x0 + wv, y + 92);
  }

  // ── 공통 조각 ───────────────────────────────────────────────────────────────
  // 빔 글로우 — 원본은 radial 마스크로 사각 모서리를 잘라낸다. 그린 뒤 같은 마스크를 destination-out으로.
  _bgGlow(topY, w = 2200) {
    const ctx = this.ctx, im = this._img('bg_glow.svg');
    if (!im) return;
    const h = w * (im.naturalHeight / im.naturalWidth);
    ctx.save();
    // glowDrift 15s ×3 — 원본 translate는 자기 크기의 %라 그대로 환산
    const p = cycle(this.t, 0, 15, 3);
    if (p != null) {
      const dx = kf(p, [[0, 0], [.25, -.06], [.5, .06], [.75, -.03], [1, 0]]) * w;
      const dy = kf(p, [[0, 0], [.25, .04], [.5, -.05], [.75, .04], [1, 0]]) * h;
      const s = kf(p, [[0, 1], [.25, 1.12], [.5, 1.05], [.75, 1.13], [1, 1]]);
      const r = kf(p, [[0, 0], [.25, 4], [.5, -3], [.75, 3], [1, 0]]) * Math.PI / 180;
      ctx.translate(CX + dx, topY + dy); ctx.rotate(r); ctx.scale(s, s); ctx.translate(-CX, -topY);
    }
    // 에셋 빛덩이가 뷰박스 정중앙에 없다 — 드리프트를 끄고 렌더 픽셀 무게중심을 재면 −42 대지px
    //   왼쪽(벽 glow.svg 와 같은 종류의 치우침). 안 넣으면 빨강이 콘텐츠보다 왼쪽에 앉는다(유저).
    //   보정량 ≠ 이동량 — 마스크(중심 50%)가 오른쪽 falloff 를 깎아 109px(4.95%) 밀어야 42px 움직인다.
    ctx.drawImage(im, CX - w / 2 + w * 0.0495, topY - h / 2, w, h);
    ctx.restore();
    ctx.save();
    const g = ctx.createRadialGradient(CX, H * 0.43, 0, CX, H * 0.43, W * 0.58);
    g.addColorStop(0.22, 'rgba(0,0,0,0)'); g.addColorStop(0.82, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 서브타이틀 + 큰 타이틀 (전환·타이머·리포트 공통 그룹). 반환 = 그룹 아래 y
  _titleGroup(y, sub, ttl) {
    const ctx = this.ctx, t = this.t;
    const ty = y + 64 * 1.2 + 8.8, gh = 64 * 1.2 + 8.8 + 140 * 1.05;
    const p = eOut(intro(t, 0.1, 0.8));   // titleIn .8s .1s — 제자리 scale+fade
    ctx.save();
    ctx.globalAlpha *= kf(p, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(p, [[0, .9], [.7, 1.02], [1, 1]]);
    ctx.translate(CX, y + gh / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + gh / 2));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = F(400, 64); ctx.letterSpacing = '-4.6px';
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(sub, CX, y);
    ctx.font = F(700, 140); ctx.fillStyle = '#fff';
    // charWave 2.4s ×3, 글자마다 .05s 지연
    drawChars(ctx, ttl, CX, ty, 140, -5.6, i => {
      const c = cycle(t, 0.9 + i * 0.05, 2.4, 3);
      return { dy: c == null ? 0 : kf(c, [[0, 0], [.29, -16], [.58, 0], [1, 0]]), alpha: 1, scale: 1 };
    });
    ctx.letterSpacing = '0px';
    ctx.restore();
    return ty + 140 * 1.05;
  }

  // 흰 pill 버튼 (전환·리포트 공통). e=등장 진행도 · dy=떠오름 · glow=펄스 세기
  _button(y, text, e = 1, dy = 0, glow = 0) {
    const ctx = this.ctx, w = 802, h = 80 * 1.2 + 42.614 * 2;
    ctx.save();
    ctx.globalAlpha *= e;
    ctx.translate(0, dy);
    if (e < 1) { const k = 0.92 + 0.08 * e; ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2)); }
    if (glow > 0.002) { ctx.shadowColor = `rgba(255,255,255,${0.35 * glow})`; ctx.shadowBlur = 60 * glow; }
    ctx.fillStyle = '#fff'; this._pill(CX - w / 2, y, w, h);
    ctx.shadowBlur = 0;
    ctx.font = F(700, 80); ctx.letterSpacing = '-1.33px';
    ctx.fillStyle = NEU.t1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, CX, y + h / 2);
    ctx.letterSpacing = '0px';
    ctx.restore();
    return y + h;
  }

  // object-fit:cover 로 이미지를 사각형에 채운다
  _cover(im, x, y, w, h, oy = 0.08) {
    const ctx = this.ctx, r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * r, dh = im.naturalHeight * r;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) * oy, dw, dh);
  }

  _roundRectPath(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, r); }

  // ── 시작화면 (floor.html / floor-bk.html) ──────────────────────────────────
  // ═══ READY = Figma 정본 이식 (파일 a2Zo9mBTQojjGKaSerQzUa · 노드 342:3057 '시작화면', 2026-08-05) ═══
  //   좌표·크기·자간 전부 피그마 실값(캔버스 1600×2670 동일 좌표계, 타입스케일 미적용 = 원치수).
  //   글로우·아크·아이콘·신발은 피그마 익스포트 SVG/PNG 를 fig/ready2/ 에 커밋해 그대로 그린다
  //   (에셋 URL 7일 만료 → 로컬 박제). 발자국 토큰(FootMark)은 이 화면에선 미사용 — 정본이 신발 실루엣.

  // 마스크 이미지를 그라디언트/단색으로 채운 오프스크린 (피그마 mask+fill 재현)
  _tinted2(rel, w, h, fillFn) {
    this._tints = this._tints || new Map();
    const key = rel + 'x' + w + 'x' + h;
    let c = this._tints.get(key);
    const im = this._img(rel);
    if (!im) return null;
    if (!c || c._src !== im) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = fillFn(x, c.width, c.height);
      x.fillRect(0, 0, c.width, c.height);
      c._src = im;
      this._tints.set(key, c);
    }
    return c;
  }

  _paint_ready() {
    const ctx = this.ctx;
    // ★ 시작화면 = **8초 루프**(유저 애니메이션 메모 08-05):
    //    0~2s  팩 이름 + 인물 실루엣 · 하단 원 2개(배터리) → 1.2s 부터 이어폰 칸이 가로 확장 + 코치
    //    2~4s  인물 out · 숫자 촤라락 → 오늘 총 운동시간(30 min)
    //    4~8s  Tap your foot Twice (4초) → 처음으로
    const LOOP = 8, TP2 = 3.0, TP3 = 4.6;   // 인물 3초 유지(유저) → 숫자 촤라락 → CTA
    const t = this.t % LOOP;
    const D = READY[/floor-bk/.test(this.params.src) ? 'floor-bk.html' : 'floor.html'], R2 = D.r2;
    const bk = /floor-bk/.test(this.params.src);   // 종목 분기(칩 잉크 등) — 미정의로 페인트가 통째로 죽었다
    const RAD = Math.PI / 180;
    // 콘텐츠 스케일 — 프레임(=커버리지)은 절대 못 줄인다. 종목별 실물 크기 동급화는 여기서.
    const CK = R2.scale || 1, PV = R2.pivotY ?? 1400;
    ctx.save();
    // 조판 기준 — 피그마 367:10132 정본: 캡슐 상단이 캔버스 51 에 앉는다(285-234).
    //   밴드 중심 자동정렬은 콘텐츠를 아래로 밀어 화면이 통째로 내려앉았다(유저 #111) → 폐기.
    //   SAFE 는 넘침 감시용 상수로만 쓴다.
    ctx.translate(0, -254);   // -234 → -254 — 최대 투사영역에 맞춰 20 더 위로(유저)
    if (CK !== 1) { ctx.translate(800, PV); ctx.scale(CK, CK); ctx.translate(-800, -PV); }
    // ── 페이즈 타임라인 — 등장(왼→오 촤라락) 완료 후 2초 뒤 페이즈2(실루엣·코치 프로필) ──
    const p2 = eOut(intro(t, TP2, .7));            // 인물 out ↔ 숫자 in
    const p3 = eOut(intro(t, TP3, .55)) * (1 - eOut(intro(t, LOOP - .45, .45)));   // CTA in/out
    // '두 번'을 글자 말고 **빛으로** 말한다 — CTA 구간에서만 톡·톡 두 번. 빼려면 0 으로 두면 끝.
    const tapB = (() => {
      if (t < TP3) return 0;
      const ph = (t - TP3) % 2.0;
      const bl = t0 => { const u = (ph - t0) / .34; return (u >= 0 && u <= 1) ? Math.sin(u * Math.PI) : 0; };
      return Math.max(bl(.10), bl(.55));
    })();
    const RF = (w, s, fam = sans) => `${w} ${s}px ${fam}`;   // 피그마 원치수(타입스케일 미적용)
    const img = rel => this._img('fig/ready2/' + rel);
    // ── 등장 이징(유저: 더 쫀득하고 부드럽게) ──────────────────────────────────
    //   전엔 전 요소가 같은 cubic-out(1-(1-t)³) 알파 페이드 하나였다. 시작이 무르고
    //   끝이 짧아 '툭 나타났다 멈춘다'로 읽힌다. 두 가지만 바꾼다:
    //     ① quint-out — 초반은 더 빠르게 붙고 꼬리가 길어 **부드럽게 안착**한다(오버슈트 없음:
    //        칩 오버슈트는 유저가 이미 폐기했다. 여긴 튀지 않고 '녹아드는' 쫀득함).
    //     ② 알파만 움직이던 걸 **위치 보조 모션**과 묶는다 — 몇 px 떠 있다가 제자리로.
    //        사람 눈은 알파 변화보다 위치 변화에서 '속도'를 읽는다.
    const eOut5 = u => 1 - Math.pow(1 - u, 5);
    const e0 = (d, dur = .9) => eOut5(intro(t, d, dur));
    const rise = (d, dur, px) => (1 - e0(d, dur)) * px;   // 등장 시 아래에서 올라와 앉는다
    // ── ① 캡슐 대지 — x291 y285 w1018 h1591 r509, 흰 1px 보더 + 내부 화이트 글로우(74/40 25%) ──
    // ★ CUT — '30 min' 아래 빈 공간이 넓어 캡슐 하단을 잘라내고, 그만큼 하단 요소를 끌어올린다(유저).
    //   한 상수로 캡슐·글로우·상태패널·CTA 가 함께 움직인다(따로 만지면 반드시 어긋난다).
    const CUT = 50;   // 130 → 50 — 하단이 좁았다(유저), 캡슐 80 되돌림
    const CAP = { x: 291, y: 285, w: 1018, h: 1591 - CUT };
    const capPath = () => { ctx.beginPath(); ctx.roundRect(CAP.x, CAP.y, CAP.w, CAP.h, CAP.w / 2); };
    ctx.save(); ctx.globalAlpha *= e0(.05);
    capFill(ctx, capPath, CAP.x, CAP.y, CAP.w, CAP.h);
    ctx.save(); capPath(); ctx.clip();
    ctx.filter = 'blur(37px)';
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 80;
    capPath(); ctx.stroke();
    ctx.filter = 'none';
    ctx.restore();
    // 아웃라인 — 단색이 아니라 유리 림: 위·아래 하이라이트, 측면은 투명하게 잦아드는 세로 그라디언트(유저)
    const rim = ctx.createLinearGradient(0, CAP.y, 0, CAP.y + CAP.h);
    //   ★ 하단은 알파 0 으로 소멸(유저) — 바닥 쪽 테두리 선이 보이면 캡슐이 '오려붙인 판'으로
    //     읽힌다. 위(크라운)만 유리 하이라이트를 남기고 아래로 갈수록 사라진다.
    rim.addColorStop(0, 'rgba(255,255,255,.95)');
    rim.addColorStop(.28, 'rgba(255,255,255,.28)');
    rim.addColorStop(.55, 'rgba(255,255,255,.16)');
    rim.addColorStop(.80, 'rgba(255,255,255,.05)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = rim; ctx.lineWidth = 2.5;
    capPath(); ctx.stroke();
    ctx.restore();
    // ── ② 캡슐 하단 엠버 글로우 — 피그마 익스포트 4겹, 블렌드 모드 그대로 ──
    const GLOWS = READY_GLOWS;
    ctx.save(); ctx.globalAlpha *= e0(.15, 1.2) * (1 + .3 * tapB);   // 탭 박자에 하단 빛이 두 번 부푼다
    ctx.translate(0, -CUT);   // 캡슐 바닥이 올라간 만큼 하단 빛도 함께(에셋은 원 좌표계)
    // ★ 캡슐 마스크 **해제**(유저 08-05, 이식 초기 디자인 복원 — 스샷 #154).
    //   9019151 이 capPath 클립으로 빛을 캡슐 안에 가뒀는데, 그러면 림에서 **칼같이 잘린다**.
    //   원래 이식본은 피그마 4겹 익스포트가 캡슐보다 큰 박스를 그대로 써서 빛이 림을 넘어
    //   **퍼지는** 형태였고, 그게 홈 화면의 정체성이었다(투사광은 경계에서 끊기지 않는다).
    //   ※ 사각 rect 로 반원 블룸을 덧대는 방식(33088c5 폐기)과는 다르다 — 그건 이음매가 드러났다.
    //     여기선 클립을 걷어낼 뿐이라 에셋 자체의 소프트 falloff 가 그대로 살아난다.
    for (const [rel, gx, gy, gw, gh, blend, la] of GLOWS) {
      const im = img(rel);
      if (!im) continue;
      // ★ **컬러 면(glow-ell)만 캡슐 안으로 가둔다**(유저 #158: 잘리잖아 → 실은 넘쳐서 터진 것).
      //   피그마 377:3209 로 이 레이어가 811x1232(이미지 1288x2009)로 커졌는데, 클립이 없으면
      //   캡슐 밖까지 hard-light 로 번져 화면이 통째로 하얗게 날아간다.
      //   나머지 3겹(하단 엠버)은 그대로 클립 없이 — 림을 넘어 퍼지는 게 홈 화면의 정체성이다(#154).
      const isField = rel === 'glow-ell.svg';
      if (isField) {
        // ★ **하드라이트를 제대로** — CSS mix-blend-hard-light 는 backdrop 과 섞인다. 우리 캔버스는
        //   투명한 투사광 레이어라 backdrop 이 없어서, 그냥 hard-light 를 걸면 소스가 곧 발광이 되어
        //   캡슐 내부가 통째로 탄다(실측 휘도 255). source-over 로 바꾸는 건 블렌드를 '포기'하는 것.
        //   → 오프스크린에 피그마와 **같은 backdrop(#666 아트보드)** 을 깔고 그 위에서 hard-light 를
        //     계산한 뒤, difference 로 backdrop 을 빼서 **이 레이어가 더하는 빛만** 남긴다.
        //     그 증분을 캡슐 안에 얹으면 결과가 피그마와 일치하면서 투사광 규약(가산)도 지킨다.
        const FW = 512, FH = Math.round(FW * CAP.h / CAP.w), k = FW / CAP.w;
        const fc = this._fieldCv || (this._fieldCv = document.createElement('canvas'));
        if (fc.width !== FW) { fc.width = FW; fc.height = FH; }
        const fg2 = fc.getContext('2d');
        fg2.globalCompositeOperation = 'source-over';
        fg2.fillStyle = '#666666'; fg2.fillRect(0, 0, FW, FH);
        fg2.globalCompositeOperation = 'hard-light';
        fg2.drawImage(im, (gx - CAP.x) * k, (gy - (CAP.y - CUT)) * k, gw * k, gh * k);
        fg2.globalCompositeOperation = 'difference';
        fg2.fillStyle = '#666666'; fg2.fillRect(0, 0, FW, FH);
        fg2.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.save(); ctx.translate(0, CUT); capPath(); ctx.restore(); ctx.clip();
        if (la != null) ctx.globalAlpha *= la;
        ctx.drawImage(fc, CAP.x, CAP.y - CUT, CAP.w, CAP.h);
        ctx.restore();
      } else {
        ctx.save();
        if (la != null) ctx.globalAlpha *= la;
        ctx.globalCompositeOperation = blend;
        ctx.drawImage(im, gx, gy, gw, gh);
        ctx.restore();
      }
    }
    ctx.restore();
    // ── ②' 림 바깥 초승달 블룸 = **폐기**(유저 08-05). '칼같이 잘리는' 걸 풀려고 반원
    //   그라디언트를 림 밖에 얹었는데, 클립 사각(rect)의 윗변이 그대로 직선 이음매로 드러나고
    //   빛이 캡슐 밖 좌우로 번져 더 이상해졌다. 캡슐 밖으로 새는 광은 만들지 않는다.
    // ── ②'' 인물 = **캔버스 plus-lighter 오버레이**(유저, 모바일 일치도 · 스샷 #156/#157).
    //   ★ 배치 근거(스샷 실측): 캡슐 1018×1591 이 스샷에서 683×940(=0.671배)로 찍혔고,
    //     머리 꼭대기가 캡슐 상단에서 455px → 캡슐 로컬 678 → 그려지는 좌표 285+678 = 963.
    //     어깨 폭은 캡슐의 44% = 447px 인데 소스(720×1280) 인물 어깨가 ≈446px 이므로 **1:1 배율**.
    //     소스 머리 꼭대기가 y≈40 이라 판 상단 = 963-40 = 923. 아래는 캡슐 밖으로 나가므로 클립.
    //   ★ 검정 배경이 사각으로 드러나던 것(유저 #155): 'lighter' 는 어두운 값도 **더한다**.
    //     압축 노이즈로 배경이 순수 0 이 아니라 판 전체가 회색 사각으로 떴다. 오프스크린에서
    //     자기 자신을 multiply 해 값을 제곱하면 어두운 곳은 0 으로 죽고 밝은 인물만 남는다.
    if (p2 < 0.995) {
      const v = this._readyVid || (this._readyVid = (() => {
        const el = document.createElement('video');
        el.src = (import.meta.env?.BASE_URL || '/') + (bk ? 'ready-view/assets/proto/curry-card.mp4'
                                                          : 'ready-view/assets/proto/sean-card.mp4');
        el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true;
        el.play?.().catch(() => {});
        return el;
      })());
      if (v.readyState >= 2 && v.videoWidth) {
        const OW = 360, OH = Math.round(OW * v.videoHeight / v.videoWidth);
        const oc = this._readyCv || (this._readyCv = document.createElement('canvas'));
        if (oc.width !== OW) { oc.width = OW; oc.height = OH; }
        const og = oc.getContext('2d');
        og.globalCompositeOperation = 'source-over';
        og.clearRect(0, 0, OW, OH);
        og.drawImage(v, 0, 0, OW, OH);
        og.globalCompositeOperation = 'multiply';   // 값 제곱 — 배경(어두움)만 0 으로 떨어진다
        og.drawImage(oc, 0, 0);
        // ★ 가장자리 페더(유저 #160: 아직도 잘린다) — roundRect 하드 클립은 경계가 그대로 선으로
        //   드러난다. 알파를 가장자리에서 0 으로 떨어뜨려 '빛이 스며드는' 형태로 만든다.
        og.globalCompositeOperation = 'destination-in';
        const fg = og.createRadialGradient(OW / 2, OH * 0.42, OW * 0.18, OW / 2, OH * 0.42, OW * 0.78);
        fg.addColorStop(0, 'rgba(0,0,0,1)');
        fg.addColorStop(.62, 'rgba(0,0,0,.92)');
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        og.fillStyle = fg; og.fillRect(0, 0, OW, OH);
        og.globalCompositeOperation = 'source-over';
        // ★ 피그마 377:3251 'sean-card 1' 실측: 캡슐 프레임 기준 (59, 630) 901x878 · r 495 ·
        //   mix-blend-plus-lighter. 캡슐 시각상단(우리 285 = 피그마 51)이라 오프셋 +234.
        //   → 우리 좌표 (350, 993) 901x878. r 이 있다(모서리 495) — 사각 박스가 아니다.
        const BX = 350, BY = CAP.y + 708, BW = 901, BH = 878, BR = 495;
        const sc = Math.max(BW / oc.width, BH / oc.height);   // cover — 여백이 더해지면 안 된다
        const dw = oc.width * sc, dh = oc.height * sc;
        ctx.save();
        //   알파 0.52 — plus-lighter 는 밝은 상의에서 곧바로 포화된다(실측: 흰 덩어리).
        //   피그마는 캡슐 필 위 합성이라 여유가 있지만 캔버스는 투명 위라 더 낮춰야 한다.
        ctx.globalAlpha *= e0(.30, .9) * (1 - p2) * 0.52;
        ctx.beginPath(); ctx.roundRect(BX, BY, BW, BH, BR); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(oc, BX + (BW - dw) / 2, BY, dw, dh);   // 위 정렬 = 얼굴이 박스 상단에 온다
        ctx.restore();
      }
    }
    // ── ③ 캡슐 텍스트 — 제목 2줄(100/Bold/ls-4) · Pace On(64/.8) · 도트 30(384) + min(64) ──
    // 제목 두 줄은 줄 단위로 아주 살짝 어긋나게(0.04s) — 한 덩어리로 뜨는 것보다 결이 산다.
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = NEU.ink; ctx.font = RF(700, 98); ctx.letterSpacing = '-4px';   // 100→98(유저: 첫 진입 타이틀이 빡빡)
    for (const [i, ln] of R2.lines.entries()) {
      const d = .26 + i * .04;
      ctx.save(); ctx.globalAlpha *= e0(d, .85);
      ctx.fillText(ln, 800, 778 + (i ? 60 : -60) + rise(d, .85, 22));
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha *= e0(.36, .85);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = RF(400, 64); ctx.letterSpacing = '-2.56px';
    ctx.fillText(R2.sub, 800.5, 971 + rise(.36, .85, 18));
    ctx.restore();
    ctx.letterSpacing = '0px';
    // ★ 순서 반전(유저 08-05): 페이즈1 = 팩 이름 + **사람 형체**, 페이즈2(2초 뒤) = **몇 분인지**.
    //   전엔 도트 숫자가 먼저 뜨고 인물이 그 자리를 밀어냈다 — 첫 화면이 '무슨 팩인지'를 못 보여줬다.
    //   인물은 main.js COACH_CFG.READY 판이 캡슐 뒤에 선다(캔버스엔 안 그린다) — 페이드아웃도 거기서.
    if (p2 > 0.01) {
      ctx.save(); ctx.globalAlpha *= p2;
      ctx.translate(0, (1 - p2) * 26);   // 숫자도 살짝 떠 있다가 앉는다(알파 단독보다 속도가 읽힌다)
      // 도트 카운팅 촤라락 — 복싱과 같은 rollNum 정본 (자릿수 롤)
      // rollNum 은 자릿수 합 폭을 돌려준다 — 단위 위치를 여기서 파생시킨다.
      const nw = rollNum(ctx, R2.total, t, TP2, .9, 800, 1277, 384, { fam: dot9, align: 'center', fill: NEU.ink });
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      // 단위는 숫자의 부속 — 위계 낮춤(유저): 흰 100%/700 → 55%/400. 숫자만 주인공으로 남는다.
      // ★ x 를 하드코딩(1085)하면 안 된다 — '30' 기준으로 잡은 값이라 더 넓은 '48' 에서 숫자와
      //   딱 붙어 버렸다(유저: 묘하게 가운데정렬이 아닌 것 같다). 숫자 오른끝에서 파생시킨다.
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = RF(400, 64); ctx.letterSpacing = '-1.51px';
      ctx.fillText('min', 800 + nw / 2 + 24, 1315);   // 숫자 상단과 top 정렬(피그마 353:7084)
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
    // ── ④ 비례 세그먼트 아크 차트 — 데이터 파생형(r=999 캡슐 아크 언어).
    //   반원 하단 정렬: 배지 중심각(A0)과 마지막 세그먼트 끝각(A1)이 270° 대칭 — 양끝이 같은
    //   기준선에 앉는다. 등장 = 왼쪽(배지)에서 오른쪽으로 호를 따라 차오르는 스윕 + 아이콘 팝 +
    //   글자 순차 리빌. 모든 좌표·타이밍은 value→각도 누적과 스윕 각도에서만 파생.
    {
      const CXA = 800, CYA = 810, R = 375, LWA = 130, GAPA = 3;   // 갭 3°(유저: 더 타이트)
      const A0 = 196, A1 = 344;                       // 270° 대칭 → 하단 정렬
      const polar = (deg, r = R) => ({ x: CXA + Math.cos(deg * RAD) * r, y: CYA + Math.sin(deg * RAD) * r });
      const capA = (LWA / 2) / R / RAD;
      const segStart = A0;   // 배지 폐기 — 스트레칭이 첫 세그먼트(유저)
      const segs = R2.arcs, totalV = segs.reduce((s2, x) => s2 + x.v, 0);
      // ★ 배분은 **시각 길이** 기준이다(유저: 8·10·30 인데 10 이 8 보다 안 길다).
      //   중간 세그는 둥근 캡이 자기 각도 안으로 들어오지만(sA=s0+capA, eA=s1-capA),
      //   차트 양끝단은 끝 정렬 규약 때문에 캡이 밖으로 삐져나온다 → 각도를 값에 비례해
      //   나눠도 첫/마지막이 capA(≈10°)씩 더 길어 보인다. 실측: 8m 이 33.6°, 10m 이 29.6°
      //   로 그려져 **작은 값이 더 길었다**. 그래서 양끝 두 세그의 몫에서 캡을 미리 뺀다.
      const availV = (A1 - segStart) + 2 * capA - GAPA * (segs.length - 1);
      // ★ 전 세그 **한 벌 램프**(유저 08-05) — 구간마다 색을 달리하던 위계(흰/단색빨강/그라디언트)는
      //   폐기. 차트 **전체 각도**에 뉴턴 램프를 한 번 깔고, 각 세그먼트는 자기 구간 색을 집는다.
      //   그래서 끊긴 알약들이 하나의 연속된 열 램프로 읽힌다(구간마다 램프를 따로 돌리면 줄무늬가 된다).
      //   위계는 이제 길이·아이콘·칩이 맡는다.
      const RAMP = (() => {
        const a0d = segStart - capA, a1d = A1 + capA;
        const span = (a1d - a0d) / 360;
        const at = u => Math.min(1, Math.max(0, u * span));
        const stops = [[0, PAL.red], [at(.40), PAL.red], [at(.68), PAL.coral],
                       [at(.88), '#FE9A61'], [at(1), PAL.sand]];
        if (!ctx.createConicGradient) {   // 원뿔 미지원 폴백 — 차트 양끝을 잇는 선형
          const q0 = polar(a0d), q1 = polar(a1d);
          const g2 = ctx.createLinearGradient(q0.x, q0.y, q1.x, q1.y);
          for (const [o, c] of [[0, PAL.red], [.40, PAL.red], [.68, PAL.coral], [.88, '#FE9A61'], [1, PAL.sand]])
            g2.addColorStop(o, c);
          return g2;
        }
        const g2 = ctx.createConicGradient(a0d * RAD, CXA, CYA);
        for (const [o, c] of stops) g2.addColorStop(o, c);
        if (span < 1) g2.addColorStop(1, PAL.sand);   // 캡 뒤쪽이 한 바퀴 돌아 첫 스톱을 집지 않게
        return g2;
      })();
      // 스윕 — 배지 팝 후 세그먼트 시작각에서 끝각까지 호를 따라 차오른다
      const sweep = segStart + (A1 - segStart) * eOut5(intro(t, .5, 1.45));   // 꼬리 긴 감속 — 끝이 급했다
      ctx.save(); ctx.globalAlpha *= e0(.4, .5);
      let cur = segStart;
      // ★ pad(°) — 값 비례를 **의도적으로 깨는** 하드코딩(유저 승인, 영상 추출·합성 전용).
      //   짧은 세그에서 라벨이 끝 캡에 바짝 붙는 게 합성본에서 거슬린다는 판단. 데이터 정직성을
      //   포기하는 대신 총 각도(A0~A1)는 유지한다 — 더한 만큼 **가장 긴 세그에서 뺀다**.
      //   영상용이 아니라면 config 의 pad 를 지우면 원래 비례로 돌아온다.
      const padSum = segs.reduce((a, x) => a + (x.pad || 0), 0);
      const iLong = segs.reduce((bi, x, i) => (x.v > segs[bi].v ? i : bi), 0);
      segs.forEach((seg, si) => {
        const isFirst = si === 0, isLast = si === segs.length - 1;
        const da = seg.v / totalV * availV - (isFirst ? capA : 0) - (isLast ? capA : 0)
                 + (seg.pad || 0) - (si === iLong ? padSum : 0);
        const s0 = cur, s1 = cur + da, mid = (s0 + s1) / 2;
        cur = s1 + GAPA;
        // 아크 — 스윕이 지나간 만큼만(왼→오 차오름). 세그먼트 '사이'만 캡 인셋, 차트 양끝단은
        //   캡 중심이 끝각에 앉는다 — 마지막 캡 중심(A1)이 배지 중심(A0)의 미러 = 하단 정렬(유저 #64).
        // 차트 양끝단은 캡 인셋을 빼지 않는다 — 첫 캡 중심 = A0, 마지막 캡 중심 = A1 이라야
        //   두 끝이 정확히 같은 높이에 앉는다(유저 #93: 끝 높이 맞춰라, sin196°=sin344°).
        const sA = isFirst ? s0 : s0 + capA, eA = isLast ? s1 : s1 - capA;
        const end = Math.min(eA, sweep);
        if (end > sA + 0.5) {
            const p0 = polar(sA), p1 = polar(eA);
          ctx.save();
          // 전 세그 동일 — 차트 전체에 깔린 램프에서 자기 구간 색을 집는다(유저 08-05).
          //   블룸은 0 유지: 번지면 칩·라벨 글자가 죽는다(유저 #98).
          ctx.shadowBlur = 0;
          ctx.strokeStyle = RAMP;
          ctx.lineWidth = LWA; ctx.lineCap = 'round';
          // ★ 링 밴드 마스크(유저) — 원뿔 그라디언트는 평면 전체를 칠하고 블룸까지 얹혀서
          //   색이 스트로크 **바깥으로 번져** 호가 지저분해졌다. 반경 밴드(R±LWA/2)로 클립하면
          //   둥근 캡(각도 방향)은 그대로 살고 **반경 방향 유출만** 잘린다 = 깔끔한 원형 띠.
          ctx.beginPath();
          ctx.arc(CXA, CYA, R + LWA / 2, 0, Math.PI * 2);
          ctx.arc(CXA, CYA, R - LWA / 2, 0, Math.PI * 2, true);
          ctx.clip('evenodd');
          ctx.beginPath(); ctx.arc(CXA, CYA, R, sA * RAD, end * RAD); ctx.stroke();
          ctx.restore();
        }
        // 아이콘 칩 — 스윕이 시작각을 지나면 팝(스케일 오버슈트)
        const ip = (seg.icon || seg.chipText) ? Math.max(0, Math.min(1, (sweep - s0) / 14)) : 0;
        if (ip > 0) {
          const ik = kf(eOut(ip), [[0, .4], [1, 1]]);   // 오버슈트 폐기(유저) — 작게 등장 → 최종 크기로 남는다
          const pc = polar(seg === segs[0] ? s0 : s0 + capA);   // 첫 세그는 아래 끝(캡 중심)에(유저 #99)
          ctx.save(); ctx.globalAlpha *= Math.min(1, ip * 2.5);
          const ca = (seg === segs[0] ? s0 : s0 + capA) + 90;
          ctx.translate(pc.x, pc.y); ctx.rotate(ca * RAD); ctx.scale(ik, ik);
          // 칩은 전 세그 공통 규격 — 스트레칭만 불투명 흰 원이라 동그란 자리만 뜬 것처럼 보였다(유저 #136).
          ctx.fillStyle = 'rgba(255,255,255,.3)';
          ctx.beginPath(); ctx.arc(0, 0, 61, 0, Math.PI * 2); ctx.fill();
          if (seg.chipText) {   // 5분 구간 = 원형 칩 안에 글자만(유저)
            // ★ 칩은 접선 방향으로 회전돼 있다 — 글자는 그 회전을 되돌려 **똑바로** 세운다.
            //   (안 그러면 '5m' 이 옆으로 누워 안 읽힌다 — 유저 #98 의 진짜 원인)
            ctx.rotate(-ca * RAD);
            ctx.shadowBlur = 0;
            ctx.fillStyle = NEU.ink;   // 반투명 칩 위 = 흰 글자(아이콘 배지와 같은 잉크)
            ctx.font = RF(700, 62); ctx.letterSpacing = '-1.8px';   // 46 → 62 (minFs(455)=61)
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(seg.chipText, 0, 2);
            ctx.letterSpacing = '0px';
          } else {
          // 아이콘 규격 통일 — 전부 높이 58 박스에 종횡비 유지(러닝·농구 여백 톤 일치, 유저)
          const IH2 = 58;
          if (seg.icon === 'feet') {
            ctx.save(); ctx.scale(IH2 / 69.5, IH2 / 69.5);
            const l = img('ic-foot-l.svg'), r2i = img('ic-foot-r.svg');
            if (l) ctx.drawImage(l, -38.85, -34.73, 34.064, 69.458);
            if (r2i) { ctx.save(); ctx.translate(21.8, 0); ctx.rotate(Math.PI); ctx.scale(1, -1); ctx.drawImage(r2i, -17.03, -34.73, 34.064, 69.458); ctx.restore(); }
            ctx.restore();
          } else {
            const file = seg.icon === 'run' ? 'ic-run.svg' : seg.icon === 'stretch' ? 'ic-stretch.svg'
              : seg.icon === 'bkTrain' ? 'ic-bk-train.svg' : 'ic-bk-play.svg';
            const im2 = seg.icon === 'run' ? img(file)
              : this._tinted2('fig/ready2/' + file, 96, 96, () => (seg.muted ? NEU.t3 : '#fff'));   // 흰 판 위 = 어두운 잉크(가독)
            if (im2) {
              const nw = im2.naturalWidth || im2.width, nh = im2.naturalHeight || im2.height;
              const iw2 = IH2 * (nw && nh ? nw / nh : 1);
              ctx.drawImage(im2, -iw2 / 2, -IH2 / 2, iw2, IH2);
            }
          }
          }
          ctx.restore();
        }
        // 라벨 — 호 추종 활자. 칩에 글자를 넣은 세그(5분)는 중복이라 생략(유저)
        if (!seg.chipText) {
          ctx.save();
          ctx.fillStyle = NEU.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          // 라벨 영역 = 아이콘 칩 구간을 제외한 나머지 호(겹침 방지, 유저) — 칩 반각 + 여유 2°
          //   ★ 여백이 과해 10m 이 못 들어갔다(유저: '이 정도는 밖으로 빼지 말고 안에 넣자').
          //     실측 — 글자 81px 인데 잡힌 자리가 17px. 원인 둘: ① 칩 뒤 여유 2° ② 끝쪽에서
          //     capA(9.93°)를 통째로 뺀 것. 그런데 중간 세그의 **시각 끝**은 s1 이다(둥근 캡이
          //     자기 각도 안으로 들어온다) — capA 를 뺄 이유가 없다. 마지막 세그는 캡이 밖으로
          //     나가므로 s1 까지 그대로 쓴다. 이렇게 잡으면 10m 자리가 85px 가 되어 들어간다.
          const iconHalf = seg.icon ? 61 / R / RAD : 0;
          const l0 = s0 + capA + (seg.icon ? iconHalf + 0.5 : 0), l1 = isLast ? s1 : s1 - 1.0;
          const lmid = (l0 + l1) / 2;
          // 크기 통일(유저 08-05) — 세그먼트 길이에 따라 44→26 으로 줄이던 자동 축소 폐기.
          //   숫자는 LBL_FS 고정, 단위 m 만 작게. dy = 작은 m 을 숫자 베이스라인에 맞추는 보정.
          //   ★ 56/34 → 66/40 — minFs(y≈210~305)가 64 를 요구한다. 10m 은 pad 8° 덕에 자리가
          //     137px 라 66px 글자(95px)가 들어간다. 30m·농구 세그는 원래 여유가 크다.
          const LBL_FS = 66, LBL_MS = 40;
          const fontOf = c => RF(700, c === 'm' ? LBL_MS : LBL_FS);
          const dyOf = c => (c === 'm' ? (LBL_FS - LBL_MS) * 0.3 : 0);
          ctx.letterSpacing = '-1px';
          const chars = [...seg.lbl];
          const ws = chars.map(c => { ctx.font = fontOf(c); return ctx.measureText(c).width - 1; });
          const totalW = ws.reduce((a2, b) => a2 + b, 0);
          const arcLen = (l1 - l0) * RAD * R;
          // 세그먼트가 짧아 호에 못 눕히면(스트레칭 5m) 아이콘 자리에 한 덩어리로 — 크기는 그대로(유저).
          if (totalW > arcLen) {
            // ★ 호에 못 눕히는 짧은 세그(유저: 10m 에서 아이콘과 글자가 겹친다).
            //   전엔 ac = s0 + capA — **아이콘과 정확히 같은 각**이라 무조건 겹쳤다.
            //   (5m 는 chipText 라 라벨을 안 그려서 이 경로를 안 밟았고, 그래서 안 드러났다.)
            //   각도로는 피할 자리가 없다 → 반경으로 뺀다: 링 바깥에 세그 중앙 정렬로 놓는다.
            const ac = mid, RO = R + LWA / 2 + 52;
            const cp2 = Math.max(0, Math.min(1, (sweep - ac) / 10));
            if (cp2 > 0) {
              const ce = eOut(cp2), pc2 = polar(ac, RO + (1 - ce) * 16);
              ctx.save(); ctx.globalAlpha *= ce; ctx.textAlign = 'left';
              ctx.translate(pc2.x, pc2.y); ctx.rotate((ac + 90) * RAD);
              let x2 = -totalW / 2;
              chars.forEach((c, k) => { ctx.font = fontOf(c); ctx.fillText(c, x2, dyOf(c)); x2 += ws[k]; });
              ctx.restore();
            }
          } else {
            let a = lmid - (totalW / 2) / R / RAD;
            chars.forEach((c, k) => {
              const am = a + (ws[k] / 2) / R / RAD;
              a += ws[k] / R / RAD;
              const cp2 = Math.max(0, Math.min(1, (sweep - am) / 10));   // 스윕 통과 후 10° 에 걸쳐 페이드
              if (cp2 <= 0) return;
              const ce = eOut(cp2);
              const pch = polar(am, R + (1 - ce) * 16);                  // 바깥에서 제자리로 안착
              ctx.save(); ctx.globalAlpha *= ce;
              ctx.translate(pch.x, pch.y); ctx.rotate((am + 90) * RAD);
              ctx.font = fontOf(c);
              ctx.fillText(c, 0, dyOf(c)); ctx.restore();
            });
          }
          ctx.restore();
        }
      });
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
    // ── ⑤ 하단 상태 패널 — 피그마 367:10132 정본 + 유저 애니메이션 메모(08-05).
    //    ⓐ 0s~   : 작은 원 두 개(안경·이어폰)가 배터리 상태를 든다. 피그마 실측 Ø186 · 간격 73.2 · cy 1827.4
    //    ⓑ 1.2s~ : **이어폰 쪽이 가로로 확장**되어 알약이 되고 그 안에 코치 인물이 들어온다(연결).
    //              늘어난 폭만큼 그룹을 다시 중앙정렬 — 화면 중심축이 안 흔들린다.
    //    ⓒ TP3   : 이 자리를 CTA 에 통째로 내주고 사라진다(같은 슬롯을 나눠 쓴다).
    {
      // 간격(유저 #133): 개체 **사이는 좁게**(73.2→44) · 캡슐과의 **위아래는 넓게**(+40).
      const DD = 186, RD = DD / 2, GAPD = 44, CY = 1867.4 + 234 - CUT;
      // 확장 → (CTA 전환) **되감기**: 알약이 다시 원으로 줄면서 동시에 페이드아웃(유저).
      //   그냥 사라지면 늘어난 채로 뚝 끊긴다 — 들어온 길로 되돌아 나가야 부드럽다.
      const EXP = eOut(intro(t, 1.2, .9)) * (1 - eOut(intro(t, TP3 - .55, .5)));
      const WE = DD + DD * EXP;                     // 이어폰 칸 폭 186 → 372
      const x0 = 800 - (DD + GAPD + WE) / 2;        // 늘어나도 중앙 유지
      const eB = e0(.35, .6) * (1 - eOut(intro(t, TP3 - .45, .45)));   // 원 두 개는 초반에 이미 서 있어야 한다
      if (eB > 0.004) {
        // ★ 충전량 다이얼 = **12시에서 시계방향**(유저) — 10시에서 시작하던 것은 게이지의
        //   출발점이 어디인지 안 읽혀 어색했다. 배터리는 시계처럼 위에서 출발해 한 바퀴가 만충.
        const DA0 = -90, DA1 = 270;
        const glass = (pathFn, cx0, r0, rimK = 1) => {
          ctx.save(); pathFn(); ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,.01)'; ctx.fill();
          ctx.filter = 'blur(22px)';
          ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 44;
          pathFn(); ctx.stroke(); ctx.filter = 'none'; ctx.restore();
          const rg = ctx.createLinearGradient(cx0 - r0, CY + r0, cx0 + r0, CY - r0);
          rg.addColorStop(0, 'rgba(255,255,255,.16)');
          rg.addColorStop(.45, 'rgba(255,255,255,.5)');
          rg.addColorStop(1, 'rgba(255,255,255,.95)');
          if (rimK > 0.01) {
            ctx.save(); ctx.globalAlpha *= rimK;
            ctx.strokeStyle = rg; ctx.lineWidth = 5; pathFn(); ctx.stroke();
            ctx.restore();
          }
        };
        // 배터리 다이얼 + 끝점 도트 — 림이 곧 충전량(피그마 상태점 = 게이지 끝)
        const dial = (cx, pct, d0) => {
          const RR = RD - 5, gp = eOut(intro(t, d0, .8));
          const a1 = (DA0 + (DA1 - DA0) * (pct / 100) * gp) * RAD;
          ctx.save();
          ctx.strokeStyle = NEU.ink; ctx.lineWidth = 8; ctx.lineCap = 'round';
          ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(cx, CY, RR, DA0 * RAD, a1); ctx.stroke();
          ctx.shadowBlur = 0; ctx.fillStyle = NEU.ink;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a1) * RR, CY + Math.sin(a1) * RR, 9.3, 0, Math.PI * 2);
          ctx.fill(); ctx.restore();
        };
        ctx.save(); ctx.globalAlpha *= Math.min(1, eB * 1.6);
        const k = .92 + .08 * Math.min(1, eB * 1.6);
        ctx.translate(800, CY); ctx.scale(k, k); ctx.translate(-800, -CY);
        // ⓐ 안경 — 늘 원
        const gx = x0 + RD;
        glass(() => { ctx.beginPath(); ctx.arc(gx, CY, RD - 2.5, 0, Math.PI * 2); }, gx, RD);
        dial(gx, BATT.glasses, .95);
        { const gl2 = img('ic-glasses.png'); if (gl2) ctx.drawImage(gl2, gx - 55, CY - 37, 110, 74); }
        // ⓑ 이어폰 — 원 → 알약. 왼끝은 제자리, 오른쪽으로 자란다.
        const ex = x0 + DD + GAPD;
        // 확장하며 **전체 컨테이너 아웃라인은 지운다**(유저) — 인물이 들어오면 테두리가 두 요소를
        //   한 상자에 가두는 것처럼 보였다. 원일 땐 테두리가 있고, 늘어나면서 녹아 없어진다.
        glass(() => { ctx.beginPath(); ctx.roundRect(ex + 2.5, CY - RD + 2.5, WE - 5, DD - 5, RD); },
              ex + WE / 2, RD, 1 - EXP);
        dial(ex + RD, BATT.buds, 1.05);
        { const eb = this._tinted2('fig/ready2/ic-earbuds.png', 102, 88, () => '#fff');
          if (eb) ctx.drawImage(eb, ex + RD - 51, CY - 44, 102, 88); }
        // 코치 인물 — 확장이 만든 오른쪽 빈칸에 채워진다(연결됨)
        if (EXP > 0.02) {
          const pk = this._img('photos/creator-profile-sean.png');
          const ccx = ex + WE - RD, CRR = RD - 12;
          ctx.save(); ctx.globalAlpha *= EXP;
          ctx.beginPath(); ctx.arc(ccx, CY, CRR, 0, Math.PI * 2); ctx.clip();
          if (pk) {
            const sc = Math.max(CRR * 2 / pk.naturalWidth, CRR * 2 / pk.naturalHeight);
            ctx.drawImage(pk, ccx - pk.naturalWidth * sc / 2, CY - pk.naturalHeight * sc / 2,
                          pk.naturalWidth * sc, pk.naturalHeight * sc);
          }
          ctx.restore();
        }
        ctx.restore();
      }
    }
    // ⑥ 발 실루엣 = 폐기(유저 08-05) — 러닝·농구 양쪽에서 뺀다.
    //   3D FootMark 는 시작페이지에서 이미 숨김이라 잔상 없음. 복원은 #81 커밋.
    // ── ⑦ CTA — 페이즈2(인물 등장)와 함께. 문구·위계는 **복싱(벽)과 한 벌**(유저 08-05):
    //    작은 눈금 'To start' 위 → 큰 지시 'Tap your foot Twice' 아래. wallgl _paint_ready 와 동일.
    if (p3 > 0.01) {
      ctx.save(); ctx.globalAlpha *= p3;
      // 하단 빛 침대 폐기(유저 08-05) — 'Tap Twice' 뒤 배경 그라디언트를 없앤다.
      //   캡슐 자체 글로우만으로 충분하고, 한 겹 더 깔면 글자 대비가 오히려 죽었다.
      ctx.globalAlpha *= .9 + .1 * tapB;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // 하단 슬롯(피그마 367 의 원 두 개 자리)을 그대로 물려받는다 — 블록 중심 = 2061.
      //   빛 위로 올라와 대비가 낮아진 만큼 눈금 불투명도 .55 → .68.
      // 타이틀 98 기준 위계(유저 08-05): 지시 74 · 눈금 38(= 지시의 0.5, 복싱 벽 32/64 와 같은 비).
      ctx.fillStyle = 'rgba(255,255,255,.68)'; ctx.font = RF(400, 44); ctx.letterSpacing = '-1px';   // 38 → 44 (minFs 42.4)
      //   ★ CTA 는 대문자 규약에서 뺀다(유저) — 세션 가이드(PREVIEW·큐)와 달리 이건 발밑에서
      //     읽는 지시문이고, 대문자로 올리니 두 줄이 다 소리치는 톤이 됐다.
      ctx.fillText('To start', 800.15, 2014 - CUT);
      // 바닥 버전 축약(유저) — 벽은 'Tap your foot Twice'(멀리서 읽는 안내), 지면은 발밑이라
      //   '무엇으로'가 자명하다. 짧아진 만큼 글자를 키워 한 덩어리로 읽힌다.
      ctx.fillStyle = NEU.ink; ctx.font = RF(700, 74); ctx.letterSpacing = '-4.25px';
      ctx.fillText('Tap Twice', 800.15, 2102 - CUT);
      ctx.letterSpacing = '0px'; ctx.restore();
    }
    ctx.restore();   // /콘텐츠 스케일
  }


  // ── 씬 캡슐 프레임(신규 시스템) — READY 캡슐 지오메트리에서 부드럽게 성장 + 배지·게이지·타이틀.
  //   좌표는 피그마 실측(343:3496): 캡슐 (162,-15) 1276×1955, 배지 y+25, 게이지 y+56 w1048, 타이틀 y+415.
  _paint_capsule(cfg) {
    // ★ 관찰 → 따라하기는 **한 물체의 변형**이다(유저). 앞서 헤더 알약만 남기고 프리뷰 원형
    //   캡슐을 통째로 없앴던 건 실수 — 관찰 구간엔 큰 원형 캡슐(PREVIEW + 동작명 + 카운트 링)이
    //   서고, 관찰이 끝나면 그게 **가로 알약 헤더로 줄어들며 올라간다**. 링은 형태를 안 바꾸고
    //   왼쪽 슬롯으로 옮겨 앉는다(관찰 3·2·1 → 따라하기 남은 시간, 같은 컴포넌트).
    const ctx = this.ctx, t = this.t;
    // ★ 프리뷰가 **없는** 스테이지가 있다(유저: 넥앤숄더는 프리뷰 없이 바로 따라하기).
    //   판정은 buildScene 과 같은 규약을 쓴다 — hasPrev 목록에 없으면 관찰 구간 자체가 없으므로
    //   처음부터 가로 알약 헤더로 선다(원형 캡슐을 띄웠다 지우면 없는 단계를 만든 셈이 된다).
    const HAS_PREV = /^(A2|A3|BK_A[23]|BK_B[12345])$/.test(this.stage || '');
    const dur = this.params?.dur || 8, PV = HAS_PREV ? (this.params?.pv || 3) : 0, MOVE = LAYOUT.PREVIEW.morph;
    const mo = HAS_PREV ? eOut(clamp01((t - PV) / MOVE)) : 1;
    // ★ 타이틀은 **FLOOR_SCENES 가 정본**이다(유저: 농구 적용 안 된 게 많다 → 감사 결과).
    //   CAPS 가 title 을 따로 들고 있어서 두 벌이 어긋나 있었다. 실제 어긋남:
    //     A2  CAPS 'Lunge Press'   vs  scenes 'Calf Stretch'   ← 아예 다른 동작명
    //     A1  'Neck And Shoulder'  vs  'Neck & Shoulders'
    //     BK_A1 'Side Bend'        vs  'Side Stretch'
    //     BK_B2~5 'Step-Back n/4'  vs  'Fake the Layup' / 'Right Foot Down' / … (축약본 미반영)
    //   CAPS 는 이제 variant·step 만 든다. 타이틀을 두 곳에 두면 반드시 또 어긋난다.
    const S2 = (typeof window !== 'undefined' ? window.FLOOR_SCENES : null)?.[this.stage];
    const title = S2?.title || (Array.isArray(cfg.title) ? cfg.title.join(' ') : String(cfg.title || ''));
    const L = (p, q) => p + (q - p) * mo;
    // 지오메트리 — 원형(760×820) → 가로 알약(840×250). **y 는 176 고정**: 위를 붙박아 두면
    //   아래로만 접히므로 코치 판(지면 중앙에 서는 3D 인물)과 안 겹친다.
    //   전엔 y300·h1080 이라 캡슐이 화면 중앙까지 내려와 인물 몸통을 덮었다(유저 스샷).
    // ★ 프리뷰 캡슐 높이 900 → 620(유저: 캡슐이 인물 머리를 덮는다).
    //   기하적으로 서 있는 사람의 머리는 화면에서 **먼 바닥**과 같은 높이로 투영된다 —
    //   1.7m 키가 카메라 부각 ~40°에서 바닥 2.0m 앞과 같은 자리에 찍힌다. 즉 캡슐이 아래로
    //   내려올수록(=near 쪽으로 커질수록) 머리와 겹칠 수밖에 없다. 위(y176)를 붙박은 채
    //   **아래 끝을 끌어올리는 것**만이 구조적 해법이다: 하단 y1076 → 796(1.26m → 1.45m).
    const w1 = L(760, LAYOUT.HEAD.w), h1 = L(620, LAYOUT.HEAD.h), y1 = LAYOUT.HEAD.y;
    // ★ 진입 = **시작화면 캡슐이 줄어드는 것**(유저: 두 번 탭하면 같은 요소가 줄어들며 넘어간다).
    //   스테이지가 바뀔 때 캡슐을 새로 띄우면 '다른 물건이 나타난' 걸로 읽힌다. READY 캡슐
    //   지오메트리(x291 y285 w1018 h1491)에서 출발해 0.9s 동안 이 스테이지의 캡슐로 접힌다.
    const en = eOut(clamp01(t / .9));
    const E = (p, q) => p + (q - p) * en;
    const w = E(1018, w1), h = E(1491, h1), y = E(285, y1), x = CX - w / 2;
    const r = Math.min(w, h) / 2;
    const path = () => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    ctx.save(); ctx.globalAlpha *= eOut(intro(t, .05, .7));
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fillRect(x, y, w, h);
    ctx.filter = 'blur(37px)'; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 80;
    path(); ctx.stroke(); ctx.filter = 'none';
    // ★ 엠버 = **시작화면 광 정본 그대로**(유저) — 같은 불이 캡슐을 따라 줄어드는 것이지
    //   비슷한 그라디언트를 새로 그리는 게 아니다. READY 캡슐 박스를 지금 캡슐 박스로 매핑해
    //   4겹 에셋을 그대로 얹는다(블렌드 모드 포함). 캡슐 패스로 클립하니 밖으로 안 샌다.
    {
      ctx.save();
      ctx.globalAlpha *= 1 - mo * .55;   // 알약이 돼도 끄지 않는다 — 끄는 순간 다른 물건이 된다
      ctx.translate(x, y);
      ctx.scale(w / READY_CAP.w, h / READY_CAP.h);
      ctx.translate(-READY_CAP.x, -READY_CAP.y);
      for (const [rel, gx, gy, gw, gh, blend] of READY_GLOWS) {
        const im = this._img('fig/ready2/' + rel);
        if (!im) continue;
        ctx.save(); ctx.globalCompositeOperation = blend;
        ctx.drawImage(im, gx, gy, gw, gh);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
    const rim = ctx.createLinearGradient(0, y, 0, y + h);
    rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.45, 'rgba(255,255,255,.22)');
    rim.addColorStop(1, 'rgba(255,255,255,.06)');
    ctx.strokeStyle = rim; ctx.lineWidth = 2.5; path(); ctx.stroke();
    // 카운트 링 — 정본 countRing. 관찰: 캡슐 중앙 아래 / 따라하기: 헤더 왼쪽 슬롯. 형태는 안 바뀐다.
    const RR = L(112, 130);
    const rx = L(CX, x + 64 + RR), ry2 = L(y + h * .70, y + h / 2);
    const rem = mo < .5 ? Math.max(1, Math.ceil(PV - t)) : Math.max(0, Math.ceil(dur - t));
    if (String(rem) !== this._numLast2) { this._numLast2 = String(rem); this._numT2 = t; }
    countRing(ctx, rx, ry2, mo < .5 ? clamp01(1 - t / PV) : clamp01(1 - (t - PV) / Math.max(.1, dur - PV)),
      String(rem), { t: 99, k: RR / 275, pulse: clamp01((t - (this._numT2 || 0)) / 0.5),
                     ring: { trackW: 11, arcW: 11, trackA: .26 } });
    // PREVIEW 라벨 · 동작명 — 순차 크로스페이드(옛 것이 먼저 빠지고 새 것이 든다)
    const outA = 1 - clamp01(mo / .45), inA = clamp01((mo - .55) / .45);
    if (outA > 0) {
      ctx.save(); ctx.globalAlpha *= outA;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = F(400, 46); ctx.letterSpacing = '6px';
      ctx.fillText('PREVIEW', CX + 3, y + h * .16);
      ctx.letterSpacing = '-4px'; ctx.fillStyle = '#fff'; ctx.font = F(700, 100);
      // 2줄 분할도 정본 타이틀에서 파생 — CAPS 의 하드코딩 배열을 안 쓴다.
      const ci2 = title.indexOf(', ');
      const ls = ci2 > 0 ? [title.slice(0, ci2 + 1), title.slice(ci2 + 2)]
        : (title.length > 12 ? (() => { const w2 = title.split(' ');
            const m = Math.ceil(w2.length / 2); return [w2.slice(0, m).join(' '), w2.slice(m).join(' ')]; })()
          : [title]);
      ls.forEach((ln, i) => ctx.fillText(ln, CX, y + h * .40 + (i - (ls.length - 1) / 2) * 112));
      ctx.letterSpacing = '0px'; ctx.restore();
    }
    if (inA > 0) {
      ctx.save(); ctx.globalAlpha *= inA;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = F(400, LAYOUT.TYPE.unit);
      ctx.fillText('sec', rx + RR + 22, ry2 + 10);
      ctx.fillStyle = '#fff'; ctx.font = F(700, LAYOUT.TYPE.title); ctx.letterSpacing = '-4px';
      ctx.fillText(title, rx + RR + 22 + 128 + 46, ry2);
      ctx.letterSpacing = '0px';
      if (cfg.step) {
        ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = F(400, 44);
        ctx.fillText(cfg.step, x + w - 56, ry2);
      }
      ctx.restore();
    }
    ctx.restore();
    // 진행 — 따라하기 구간에만, 헤더 바로 아래
    if (mo > .5) {
      ctx.save(); ctx.globalAlpha *= (mo - .5) / .5;
      const ay = LAYOUT.PROG_Y, wA = Math.min(LAYOUT.PROG.wMax, safeW(ay) - 48);
      arcGauge(ctx, CX - wA / 2, ay, wA, clamp01((t - PV) / Math.max(.1, dur - PV)), { dotK: 0.6 });
      ctx.restore();
    }
  }

  _paint_transition() {
    const ctx = this.ctx, TR_ = TR[this.stage] || TR.T1, t = this.t;
    this._bgGlow(1160);
    this._titleGroup(500, TR_.sub, TR_.title);
    // 카드 크기 — 벽(2600 가로)에서 쓰던 589.4를 그대로 들고 왔던 게 문제였다. 지면 대지는 1600 폭이라
    //   같은 값이 폭의 75%를 먹어 카드가 화면을 채워 버린다(유저). 폭의 ~63%로 줄이고, 줄어든 만큼
    //   블록을 원래 밴드(850~1439) 안에서 세로 중앙에 다시 앉힌다 — 타이틀·버튼은 건드리지 않는다.
    const S = 496, GAP = 22, P = 52.392 * (S / 654.902), y = 897;
    const x0 = CX - (S * 2 + GAP) / 2;
    // cardIn .8s (.38/.54) + cardFloat 4s/4.4s ×3 — 카드는 이미 바닥에 붙어 있어 '떠오름'은 원본대로 translate
    const card = (x, d, fd, fdur, D, done) => {
      const e = eOut(intro(t, d, 0.8)), c = cycle(t, fd, fdur, 3);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, c == null ? 0 : kf(c, [[0, 0], [.5, -13], [1, 0]]));
      const k = 0.9 + 0.1 * e;
      ctx.translate(x + S / 2, y + S / 2); ctx.scale(k, k); ctx.translate(-(x + S / 2), -(y + S / 2));
      this._card(x, y, S, 65.49 * (S / 654.902), P, D, done);
      ctx.restore();
    };
    card(x0, 0.38, 1.5, 4, TR_.done, true);
    card(x0 + S + GAP, 0.54, 1.85, 4.4, TR_.next, false);
    // sUpC .8s .95s + btnFloatC 3.6s 1.9s ×3 + btnPulse 3s 1.9s ×3
    const bf = cycle(t, 1.9, 3.6, 3), bp = cycle(t, 1.9, 3, 3);
    this._button(1636, BTN, eOut(intro(t, .95, .8)),
      bf == null ? 0 : kf(bf, [[0, 0], [.5, -18], [1, 0]]),
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }

  _card(x, y, S, R, P, D, done) {
    const ctx = this.ctx;
    const k = S / 654.902;   // 대지 실값(Figma 654.902) 대비 배율 — 조판·배지·글자도 카드와 같이 줄어든다
    ctx.save();
    this._roundRectPath(x, y, S, S, R); ctx.clip();
    if (done) {
      const g = ctx.createLinearGradient(0, y, 0, y + S);
      g.addColorStop(0.48, PAL.red); g.addColorStop(0.776, PAL.coral); g.addColorStop(1, PAL.sand);
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, S, S);
    const im = this._img(D.img);
    // plus-lighter는 완료 카드(빨강 배경 위)만 — 다음 카드는 흰 배경이라 lighter면 인물이 통째로 날아간다.
    if (im) { ctx.save(); if (done) ctx.globalCompositeOperation = 'lighter'; this._cover(im, x, y, S, S); ctx.restore(); }
    if (!done) {   // 다음 카드 = 인물 위에 빨강→주황 틴트
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createLinearGradient(0, y, 0, y + S);
      g2.addColorStop(0, PAL.red); g2.addColorStop(1, PAL.coral);
      ctx.fillStyle = g2; ctx.fillRect(x, y, S, S); ctx.restore();
    } else {
      // 완료 카드 내부 글로우 = 원본 CSS 실값 inset 0 0 52.392px 19.647px rgba(255,255,255,.6)
      ctx.save();
      this._roundRectPath(x, y, S, S, R); ctx.clip();
      insetGlow(ctx, x, y, S, S, R, rgba(NEU.ink, 0.6), 52.392 * k, 19.647 * k);
      ctx.restore();
    }
    ctx.restore();
    // 우상단 배지 — sPop .6s (.95/1.0) 로 튀어나온다
    const sp = eOut(intro(this.t, done ? 0.95 : 1.0, 0.6));
    ctx.save();
    ctx.globalAlpha *= kf(sp, [[0, 0], [.6, 1], [1, 1]]);
    const spk = kf(sp, [[0, .5], [.6, 1.12], [1, 1]]);
    if (done) {
      const r = 45.8 * k, c = x + S - P - r, cy = y + P + r;
      ctx.translate(c, cy); ctx.scale(spk, spk); ctx.translate(-c, -cy);
      checkBadge(ctx, c, cy, r);
    } else {
      ctx.font = F(400, 52 * k); const bw = ctx.measureText('Next').width + 52.4 * k, bh = (52 * 1.2 + 26.2) * k;
      const bx = x + S - P - bw / 2, by = y + P + bh / 2;
      ctx.translate(bx, by); ctx.scale(spk, spk); ctx.translate(-bx, -by);
      ctx.save();   // Figma 뱃지 그림자 0 0 39.294px rgba(0,0,0,.12)
      ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 39.294 * k;
      ctx.fillStyle = 'rgba(255,255,255,.9)'; this._pill(x + S - P - bw, y + P, bw, bh);
      ctx.restore();
      ctx.fillStyle = NEU.t3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Next', bx, by);
    }
    ctx.restore();
    // 좌하단 메타
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = done ? NEU.paper : NEU.t2; ctx.font = F(400, 36 * k); ctx.letterSpacing = (-1.64 * k).toFixed(2) + 'px';
    ctx.fillText(D.time, x + P, y + S - P);
    ctx.fillStyle = done ? '#fff' : NEU.t1; ctx.font = F(700, 64 * k); ctx.letterSpacing = (-3.27 * k).toFixed(2) + 'px';
    ctx.fillText(D.lbl.toUpperCase(), x + P, y + S - P - 36 * k * 1.2 - 13.1 * k);
    ctx.letterSpacing = '0px';
  }

  // ── 실전 직전 카운트다운 (floor-timer.html) ────────────────────────────────
  _paint_timer() {
    const ctx = this.ctx, M = TM[this.stage] || TM.C1, dur = this.params.dur || 3, t = this.t;
    // 벽 타이머와 같은 규칙 — 정렬 기준은 '타이틀+링 블록'이 아니라 **링**이다.
    //   블록을 top 600 에 놓으면 링 중심이 글로우 중심보다 73px 내려가 빨강이 링 윗동만 덮었다(유저).
    //   링 중심 = 글로우 중심으로 못 박고 타이틀은 GAP 만큼 위에. GAP 88 → 48.
    const GLOW_Y = 1160, RING = 604, GAP = 48, TGH = 64 * 1.2 + 8.8 + 140 * 1.05;
    this._bgGlow(GLOW_Y);
    const y = this._titleGroup(GLOW_Y - RING / 2 - GAP - TGH, M.sub, M.title) + GAP;
    const cy = y + RING / 2, rem = dur - t, txt = rem > 0.05 ? String(Math.ceil(rem)) : 'GO';
    // ★ 여기 있던 링·숫자·모션 코드가 countRing 정본 컴포넌트가 됐다(유저: 컴포넌트 자체를 재사용).
    //   출력은 동일 — 규격(604·220)과 모션(ringPop·breath·numPulse)을 그대로 옮겼다.
    if (txt !== this._numLast) { this._numLast = txt; this._numT = t; }
    countRing(ctx, CX, cy, clamp01(t / dur), txt, { t, pulse: clamp01((t - this._numT) / 0.5) });
  }

  // ── 세션 리포트 (floor-report.html) ────────────────────────────────────────
  _paint_report() {
    const ctx = this.ctx, RP_ = RP[this.stage] || RP.FIN, t = this.t;
    this._bgGlow(1080);
    let y = this._titleGroup(640, RP_.sub, RP_.title) + 80;
    // 100% 링 (0.5s 뒤 1.4s 동안 채움)
    const p = clamp01((t - 0.5) / 1.4), e = eOut(p);
    const cy = y + 250, r = 230;
    // ringPop .8s .35s + ringBreath 3.4s 1.4s ×3
    const rp = eOut(intro(t, .35, .8)), br = cycle(t, 1.4, 3.4, 3);
    ctx.save();
    ctx.globalAlpha *= kf(rp, [[0, 0], [.7, 1], [1, 1]]);
    const rk = kf(rp, [[0, .6], [.7, 1.05], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(rk, rk); ctx.translate(-CX, -cy);
    if (br != null) {
      const g = kf(br, [[0, 0], [.5, 1], [1, 0]]);
      ctx.shadowColor = `rgba(255,255,255,${.45 * g})`; ctx.shadowBlur = 26 * g;
    }
    ringGauge(ctx, CX, cy, r, e, { trackW: 14, arcW: 14, trackA: .16 });
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    // % — 링 게이지와 같은 진행(e)을 쓰던 것을 정본 카운트업으로. 값 보간만 있고 자릿수 롤이 없었다.
    ctx.font = F(700, 128.5, dot9); const nTxt = '100';
    const nw = ctx.measureText(nTxt).width;
    ctx.font = F(400, 76); const sw = ctx.measureText('%').width;   // 단위 = 본문 영문(유저 규약)
    ctx.textAlign = 'left';
    rollNum(ctx, nTxt, this.t, 0.4, 1.3, CX - (nw + sw + 8) / 2, cy - 128.5 * 0.5, 128.5, { fam: dot9, fill: '#fff' });
    ctx.font = F(400, 76); ctx.fillText('%', CX - (nw + sw + 8) / 2 + nw + 8, cy + 18);
    ctx.shadowBlur = 0;
    ctx.restore();
    y = cy + 250 + 80;
    // 통계 3열 (등폭 + 구분선) — sUp .7s 1.15s
    ctx.save(); this._fadeIn(y, 100, eOut(intro(t, 1.15, .7)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const total = 920, cw = (total - 24) / 3;
    let x = CX - total / 2;
    RP_.stats.forEach((st, i) => {
      if (i) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 5, y, 2, 100); x += 12; }
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = F(400, 39); ctx.letterSpacing = '-1.5px';
      ctx.fillText(st[0], x + cw / 2, y);
      // 수치 = 도트폰트(유저 규칙) → 카운트업. 항목마다 조금씩 늦게 세어 오른다.
      //   "5’42”"·"1.00 km" 처럼 단위·기호가 붙은 값은 숫자가 아니라 rollNum 이 그대로 그린다.
      const sz = st[2] === 'sm' ? 42 : 64;
      rollNum(ctx, st[1], this.t, 0.5 + i * 0.12, 0.9, x + cw / 2, y + 39 * 1.2 + 18, sz,
              { fam: dot9, align: 'center', fill: '#fff' });
      ctx.letterSpacing = '0px';
      x += cw;
    });
    ctx.restore();
    // sUp .7s 1.35s + btnPulse 3s 2s ×3
    const bp = cycle(t, 2, 3, 3);
    this._button(y + 39 * 1.2 + 18 + 64 * 1.2 + 16, BTN, eOut(intro(t, 1.35, .7)), 0,
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }

  // Success 컴포넌트(Figma 130-2984) — 카운트다운 링 + 배지
  // ★ 두 가지를 고쳤다(유저: "위치도 애매하고 인터랙션도 애매하다").
  //   ① 인터랙션: 3·2·1 이 도는 동안 배지가 'Success!' 라고 먼저 말해버려, 성공을 알리는지
  //      더 버티라는지 알 수 없었다. 카운트 중엔 'HOLD'(유지하라는 상태),
  //      다 채운 뒤에만 'Success!'(일어난 사건). 복싱과 같은 규약 — 상태는 계속, 사건은 순간.
  //   ② 위치: 열 마지막 노드라 앞 노드(도트바 등)가 숨으면 같이 올라와 스테이지마다 튀었다.
  //      대지 비율 고정(_succY)으로 못박는다.
  _succ(n, y) {
    const ctx = this.ctx;
    const arc = this.map.get('succ-arc');
    const frac = numOr(arc?.style.strokeDashoffset, 0) / 615.7;   // 원본은 offset이 곧 남은 비율
    const done = frac <= 0.001;
    const S = 88 / 114.26;   // 지면 배지 높이 88 에 맞춘 스케일
    // 성공 순간 윙이 뻗는다 — 사건(성공)마다 라인이 자라는 문법(유저: 액션·콤보에 은은한 라인)
    if (done && !this._succT) this._succT = performance.now();
    if (!done) this._succT = 0;
    const ext = done ? Math.min(1, (performance.now() - this._succT) / 450) : 0;
    drawBadge(ctx, CX, y + 44, done ? 'Success!' : 'HOLD',
      { scale: S, icon: done ? this._img('flame.svg') : null, glow: done ? .55 : .3, ext });
    const ry = y + 88 + 56;
    this._ringAt(CX, ry, 220, frac, '#fff');
    drawCenteredNum(ctx, this.map.get('succ-n')?.textContent || '', CX, ry + 110, 88);
  }

}
