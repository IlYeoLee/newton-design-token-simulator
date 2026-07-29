// 바닥 UI를 WebGL로 (B안) — floor-*.html 전부를 canvas 2D → CanvasTexture 평면으로 다시 그린다.
//
// 왜: CSS3DRenderer가 그리는 바닥 UI는 별도 DOM 레이어라 WebGL 깊이 버퍼를 공유하지 못해
// x봇 위로 통과한다(마스크 오버레이는 원리적 임시방편). 같은 씬의 평면이면 깊이 테스트가
// 공짜로 해결한다.
//
// 인터페이스는 기존과 동일하게 유지한다 — `doc.getElementById(id).textContent/style.…`를
// main.js 구동 코드가 그대로 쓴다(노드 = 그리기 스펙 겸 DOM 스텁). 이식 비용을 여기 한 파일에 가둔다.
import * as THREE from 'three';
import { PAL, NEU, rgba } from './palette.js';

const W = 1600, H = 2670;   // 대지 px (floor-scene.html과 동일)
// 캔버스 해상도 — 화질과 업로드 비용의 저울.
//   0.5 = 글자가 흐리다(유저) / 1.0 = 프레임당 17MB 업로드라 전체가 느려진다(유저).
//   0.75(1200×2002, 9.6MB)가 두 불만을 모두 피하는 지점. 업로드는 값이 바뀐 프레임에만 일어난다.
// 캔버스 해상도 — 대지 대비 배율. 화질 vs 업로드 비용의 저울.
// ?uiscale=N 으로 올릴 수 있다 — 4K 영상 내보내기용. 실시간에선 0.75 가 예산이다
// (대지 통짜 업로드라 배율을 올리면 프레임당 MB가 제곱으로 는다).
const K = Math.min(3, Math.max(0.4,
  +(new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('uiscale')) || 0.75));
// UI 재도색 주기. 모션을 이식한 뒤로 정지 화면이 없어져 매 틱 9.4~9.6MB 텍스처가 올라간다
// (24fps = 230MB/s). 씬 애니메이션이 '드드드득' 끊긴 원인 — UI 프레임을 씬보다 낮게 잡고
// 남는 예산을 봇·영상에 돌려준다. ?uifps=N 으로 8~60 비교 가능.
const UI_FPS = Math.max(4, Math.min(60, +(new URLSearchParams(location.search).get('uifps')) || 12));

const CX = W / 2;
// 투사 UI 서체 규칙(유저 확정): Supreme 두 굵기만 — Bold 700 · Regular 400.
// Freesentation·Pretendard 폴백은 은퇴(투사 UI는 영문 조판이고, 폴백이 끼면 자간이 달라진다).
const sans = "'Supreme',sans-serif";
// 수치 전용 페이스. 이걸 sans 로 바꾸면 문서 전체가 Supreme 2종만 남는다(유저가 원하면 한 줄).
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
  stroke: 6, dot: 39, core: 15.17,         // report.css .arc-dot / .arc-dot span
  clampL: 64, clampR: 316,                 // gauge.js — 마커는 페이드 구간 밖으로 안 나간다
  trackA: 0.85, trackR: 324.79 * 0.4264,   // trackFade 라디얼: 크라운 .85 → 양끝 0
  inkTop: 4, inkBot: 72,                   // 크라운의 마커 위끝 ~ 우측 끝 마커 아래끝
};
const arcY = ax => ARC.top + ARC.ry * (1 - Math.sqrt(Math.max(0, 1 - ((ax - ARC.cx) / ARC.rx) ** 2)));
/** 폭 w(= viewBox 360 에 대응) 게이지의 높이 */
export const gaugeH = w => Math.round(w / ARC.vw * (ARC.inkBot - ARC.inkTop));

const _gsCv = typeof document !== 'undefined' ? document.createElement('canvas') : null;

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
  glassDot(ctx, hx, hy, ARC.dot / 2 * s);
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
  glassDot(ctx, cx + r * Math.cos(a), cy + r * Math.sin(a), o.dot ?? 26 * s);
  ctx.restore();
}


/** 성취 배지 — 지면 Success 와 복싱 콤보가 같은 물건이라 한 정의로 통일(유저 지적).
 *  전엔 지면은 흰 필 + 🔥 이모지, 벽은 히트 그라디언트 필 + SVG 불꽃이라 딴판이었다.
 *  정본 = 벽 콤보 쪽(더 설계된 형태). 등장·회전 같은 모션은 호출자가 변환으로 감싼다. */
export function drawBadge(ctx, cx, cy, text, o = {}) {
  const S = o.scale || 1, H = 114.26 * S, R = 47.28 * S;
  const fs = 59.1 * S, pad = 36 * S, icon = 47.28 * S, gap = 15.76 * S;
  ctx.font = `700 ${(fs * TS).toFixed(2)}px 'OffBit','Supreme',sans-serif`;
  const w = ctx.measureText(text).width + icon + gap + pad * 2;
  const glow = o.glow ?? 0.55;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = rgba(PAL.coral, glow); ctx.shadowBlur = 44 * S * (0.5 + glow);
  const g = ctx.createLinearGradient(-w / 2, -H / 2, w / 2, H / 2);
  g.addColorStop(0, rgba(PAL.red, .4)); g.addColorStop(1, rgba(PAL.coral, .28));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -H / 2, w, H, R); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2 * S;
  ctx.beginPath(); ctx.roundRect(-w / 2, -H / 2, w, H, R); ctx.stroke();
  if (o.icon) ctx.drawImage(o.icon, -w / 2 + pad, -icon * 0.55, icon, icon * 1.1);
  ctx.shadowColor = rgba(PAL.sand, .75); ctx.shadowBlur = 22 * S;
  ctx.fillStyle = NEU.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, -w / 2 + pad + icon + gap, 0);
  ctx.restore();
  return w;
}


/** 카드 내부 글로우 — 캔버스엔 CSS 의 inset box-shadow 가 없다.
 *  오프스크린을 글로우 색으로 채우고, 안쪽(spread 만큼 줄인 모양)을 블러로 지워내면
 *  가장자리에만 부드러운 빛이 남는다 = inset. (스트로크+blur 근사는 테두리가 딱딱하고 얼룩진다)
 *  CSS blur 는 지름 규약이라 캔버스 filter(시그마)에는 절반을 준다. */
const _isCv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
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
const READY = {
  // meta = 모바일 홈 카드의 '팩 · 시간' 표기(home.html 원본) — 지면도 같은 조판 규칙을 쓴다
  'floor.html':    { title: "Sean's Final 1km Pace", meta: 'Creator Pack · 30 min', time: '30min', mode: 'Pace & Boost On', modeSm: true },
  'floor-bk.html': { title: "Curry's Handle Pack",   meta: 'Pro Pack · 23 min',     time: '23min',     mode: 'Press On' },
};
const TR = {
  T1: { sub: 'Sean’s Final 1km Pace', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'run/run_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'run/run_learn.png' } },
  T2: { sub: 'Sean’s Final 1km Pace', title: 'Learning Complete!',
    done: { lbl: 'Learn', time: '10min', img: 'run/run_learn.png' },
    next: { lbl: 'Run!', time: '10min', img: 'run/run_run.png' } },
  BK_T1: { sub: 'Curry’s Signature Move', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'bk/bk_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'bk/bk_learn.png' } },
  BK_T2: { sub: 'Curry’s Signature Move', title: 'Learning Complete!',
    done: { lbl: 'Learn', time: '10min', img: 'bk/bk_learn.png' },
    next: { lbl: 'Play!', time: '10min', img: 'bk/bk_play.png' } },
};
const TM = { C1: { sub: 'Sean’s Final 1km Pace', title: 'Session Complete' },
             BK_C1: { sub: 'Curry’s Signature Move', title: 'Session Complete' } };
const RP = {
  FIN: { sub: 'Sean’s Final 1km Pace', title: 'Session Complete',
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

function drawCenteredNum(ctx, text, cx, cy, size) {
  ctx.font = F(700, size, dot9);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

// ── 스테이지 → 노드 열 구성 (floor-scene.html의 <script> 분기와 1:1) ──────────────
function buildScene(stage, p) {
  const S = (window.FLOOR_SCENES || {})[stage] || { title: stage, cue: '' };
  const isP = /^P\d$/.test(stage);
  const isC = /^C[2-5]$/.test(stage);
  const hasPrev = /^(A2|A3|BK_A[23]|BK_B[12345])$/.test(stage);
  const isStep = /^BK_B[2345]$/.test(stage);
  const col = [];
  const m = /^BK_B([2345])$/.exec(stage);
  if (m) col.push(node('s-cap', { type: 'text', textContent: (+m[1] - 1) + ' / 4', size: 46, weight: 700, ls: 6, color: 'rgba(255,255,255,.62)', mb: -38 }));
  if (!isC) col.push(node('s-title', { type: 'text', textContent: S.title, size: 120, weight: 700, ls: -4, color: '#fff', cascade: true }));
  col.push(node('s-cue', { type: 'text', textContent: S.cue || '', size: 52, weight: 400, color: 'rgba(255,255,255,.72)', style: { display: 'none' } }));
  if (isC) col.push(node('km', { type: 'km' }));
  if (hasPrev) col.push(node('prev-row', { type: 'prevRow', pv: p.pv || 3, pvn: p.pvn || 0 }));
  // 도트 진행바 — 원본 HTML의 노출 규칙 두 가지를 그대로 따른다.
  //  ① 시범(Preview) 동안은 감춘다. 공간도 차지하지 않는다 — 프리뷰가 그 자리를 쓰기 때문.
  //  ② 스텝백 따라하기(BK_B2~B5)엔 아예 없다. 진행은 상단 n/4 가 담당(유저 확정).
  if (!isStep) col.push(node('s-dots', { type: 'dots', mt: -38, dur: p.dur || 8, hideUntil: hasPrev ? (p.pv || 3) : 0, delay: hasPrev ? (p.pv || 3) + 0.15 : 0 }));
  if (isP) col.push(node('train-row', { type: 'trainRow', ring: /^P[23]$/.test(stage) }));
  if (isC) col.push(node('live-row', { type: 'liveRow' }));
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
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (this.kind && this.kind !== 'scene') return this['_paint_' + this.kind]();
    let y = 176;   // Figma 대지 실좌표
    for (const n of this.col) {
      if (n.style.display === 'none') continue;
      if (n.hideUntil && this.t < n.hideUntil) continue;   // 시범 중 도트바 — 자리도 비운다
      const h = this._h(n);
      if (n.mt) y += n.mt;
      if (n.style.visibility !== 'hidden') {
        const e = this._intro(n);
        ctx.save();
        ctx.globalAlpha = numOr(n.style.opacity, 1) * e * this._outro(n);
        if (e < 1 && !n.cascade) {   // 제자리 스케일 인(원본 sUpFlat) — 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다
          const k = 0.94 + 0.06 * e;
          ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2));
        }
        if (ctx.globalAlpha > 0.004) this._draw(n, y);
        ctx.restore();
      }
      y += h + 72 + (n.mb || 0);
    }
  }

  // 등장 = 제자리 페이드(원본 sUpFlat/chIn의 요지). 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다.
  _intro(n) {
    const d = { 's-cap': 0.18, 's-title': 0.1, 's-cue': 0.28, 's-dots': 0.42 }[n.id] ?? 0.2;
    return Math.max(0, Math.min(1, (this.t - d) / 0.55));
  }

  // 프리뷰 행은 시범이 끝나면 사라진다(원본 demoOutFlat .45s @ --pvOut = pv + 0.05)
  _outro(n) {
    return n.type === 'prevRow' ? 1 - clamp01((this.t - (n.pv + 0.05)) / 0.45) : 1;
  }

  _h(n) {
    switch (n.type) {
      case 'text': return n.size * 1.06;
      case 'dots': return gaugeH(760);
      case 'prevRow': return 200;
      case 'trainRow': return n.ring ? 200 : 112;
      case 'liveRow': return 112;
      case 'km': return 180;
      case 'succ': return 400;
      default: return 0;
    }
  }

  _draw(n, y) {
    const ctx = this.ctx;
    switch (n.type) {
      case 'text': return drawText(ctx, n, y, this.t);
      case 'dots': return this._dots(n, y);
      case 'prevRow': return this._prevRow(n, y);
      case 'trainRow': return this._trainRow(n, y);
      case 'liveRow': return this._liveRow(n, y);
      case 'km': return this._km(n, y);
      case 'succ': return this._succ(n, y);
    }
  }

  // 도트 프로그래스 — 공통 컴포넌트(dotProgress). 지면·벽이 같은 물건이다.
  _dots(n, y) {
    const x0 = CX - 380;   // 폭 760(= viewBox 360 대응). 구 도트바 600 자리와 비슷
    // main.js가 width를 직접 쓰면(반복형 스테이지) 그 값이 우선, 아니면 --dur 시간 진행.
    const w = n.style.width != null ? numOr(n.style.width, 0)
      : 600 * clamp01((this.t - n.delay) / n.dur);
    arcGauge(this.ctx, x0, y, 760, w / 600);
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
    ctx.font = F(700, 60); const tw = ctx.measureText('Preview').width;
    const pillW = 40 + tw + 20 + 60 + 30, pillH = 100;
    const total = pillW + gap + ringW, x0 = CX - total / 2;
    const py = y + (ringW - pillH) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; this._pill(x0, py, pillW, pillH);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Preview', x0 + 40, py + pillH / 2);
    // 화살표 →
    const ax = x0 + 40 + tw + 20, ay = py + pillH / 2;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax + 10, ay); ctx.lineTo(ax + 48, ay);
    ctx.moveTo(ax + 33, ay - 15); ctx.lineTo(ax + 48, ay); ctx.lineTo(ax + 33, ay + 15); ctx.stroke();
    const save = CX; // 링은 중앙 정렬 헬퍼를 쓰므로 잠시 위치를 옮겨 그린다
    this._ringAt(x0 + pillW + gap + ringW / 2, y, ringW, prog, '#fff');
    drawCenteredNum(ctx, num?.textContent || '', x0 + pillW + gap + ringW / 2, y + ringW / 2, n.pvn ? 62 : 96);
    void save;
  }

  _ringAt(cx, y, size, prog, color) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(cx - CX, 0);
    drawRing(ctx, { size }, y, Math.max(0, Math.min(1, prog)), color);
    ctx.restore();
  }

  // 케이던스 컴포넌트 — "150 / 150" + 라벨
  _lstat(cx, y, me, tgt, label) {
    const ctx = this.ctx;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.font = F(700, 60);
    const a = me || '--', b = tgt || '--';
    const wa = ctx.measureText(a).width, wSlash = ctx.measureText(' / ').width;
    const wb = ctx.measureText(b).width, tot = wa + wSlash + 36 + wb;
    let x = cx - tot / 2;
    ctx.textAlign = 'left'; ctx.fillStyle = this.map.get('spm-me')?.style.color || '#fff';
    ctx.fillText(a, x, y + 60); x += wa + 18;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = F(400, 60);
    ctx.fillText('/', x, y + 60); x += wSlash + 18;
    ctx.fillText(b, x, y + 60);
    ctx.font = F(400, 40); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(label, cx, y + 112);
  }

  _trainRow(n, y) {
    const me = this.map.get('spm-me')?.textContent, tgt = this.map.get('spm-tgt')?.textContent;
    if (!n.ring) return this._lstat(CX, y, me, tgt, 'SPM');
    const gap = 110, statW = 300, total = statW + gap + 200, x0 = CX - total / 2;
    this._lstat(x0 + statW / 2, y + 44, me, tgt, 'SPM');
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

  _km(n, y) {
    const ctx = this.ctx;
    ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = F(700, 180, dot9);
    const v = this.map.get('km-n')?.textContent || '0.00';
    const wv = ctx.measureText(v).width;
    ctx.font = F(400, 180, dot9); const wu = ctx.measureText('km').width;
    const x0 = CX - (wv + wu) / 2;
    ctx.textAlign = 'left'; ctx.font = F(700, 180, dot9); ctx.fillText(v, x0, y);
    ctx.font = F(400, 180, dot9); ctx.fillText('km', x0 + wv, y);
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
    ctx.drawImage(im, CX - w / 2, topY - h / 2, w, h);
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
    ctx.fillStyle = NEU.inkDark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  _paint_ready() {
    const SY = 520;   // 상태 한 줄 y (메타 줄·Connection 칸 폐기 — 정보량 축소, 유저)
    const ctx = this.ctx, D = READY[/floor-bk/.test(this.params.src) ? 'floor-bk.html' : 'floor.html'], t = this.t;
    // glowLive 7s ×3 — 숨쉬기 + 드리프트
    const gl = this._img('fig/big_glow.svg');
    if (gl) {
      const g = cycle(t, 0, 7, 3);
      ctx.save();
      ctx.globalAlpha = g == null ? 0.85 : kf(g, [[0, .85], [.5, 1], [1, .85]]);
      if (g != null) {
        const s = kf(g, [[0, 1], [.5, 1.06], [1, 1]]);
        ctx.translate(CX + kf(g, [[0, 0], [.5, -16], [1, 0]]), 1400 + kf(g, [[0, 0], [.5, 10], [1, 0]]));
        ctx.scale(s, s); ctx.translate(-CX, -1400);
      }
      ctx.drawImage(gl, CX - 510, 1400 - 465, 1020, 930);
      ctx.restore();
    }
    // 팩 대표 이미지 — 모바일 카드의 크리에이터 프로필 원형 크롭(지름 168 = 모바일 38 ×4.44)
    {
      const pk = this._img(/floor-bk/.test(this.params.src) ? 'photos/cardbg-curry.png' : 'photos/creator-profile-sean.png');
      const R = 84, py = 12;
      ctx.save();
      ctx.beginPath(); ctx.arc(CX, py + R, R, 0, Math.PI * 2); ctx.clip();
      if (pk) {
        const sc = Math.max(2 * R / pk.naturalWidth, 2 * R / pk.naturalHeight);
        ctx.drawImage(pk, CX - pk.naturalWidth * sc / 2, py + R - pk.naturalHeight * sc / 2,
                      pk.naturalWidth * sc, pk.naturalHeight * sc);
      } else { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(CX - R, py, 2 * R, 2 * R); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(CX, py + R, R, 0, Math.PI * 2); ctx.stroke();
    }
    // 팩 칩 = pyeongso .tag-pill (creator.css) — 제목 대비 비율 그대로(15/26). ×4.6 스케일.
    {
      const LB = /floor-bk/.test(this.params.src) ? 'Pro Pack' : 'Creator Pack';
      ctx.save(); this._fadeIn(204, 129, eOut(intro(t, .18, .8)));
      ctx.font = F(700, 69); ctx.letterSpacing = '-2.3px';
      const tw = ctx.measureText(LB).width, pw = tw + 74, ph = 129;
      this._roundRectPath(CX - pw / 2, 204, pw, ph, 55);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(LB, CX, 204 + ph / 2 + 2);
      ctx.letterSpacing = '0px'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.restore();
    }
    // 타이틀 글자 웨이브 — charLoop 3s ×3, 글자마다 .09s 지연
    ctx.fillStyle = '#fff'; ctx.font = F(700, 120);
    drawChars(ctx, D.title, CX, 348, 120, -4, i => {
      const p = cycle(t, i * 0.09, 3, 3);
      return p == null ? { dy: 0, alpha: 1, scale: 1 } : {
        dy: kf(p, [[0, 0], [.12, -16], [.26, 0], [.58, 0], [1, 0]]),
        alpha: kf(p, [[0, .5], [.12, 1], [.26, 1], [.58, .5], [1, .5]]), scale: 1,
      };
    });
    // 상태 한 줄 = 모바일 공통 .stats-row (creator.css) — label + value 텍스트 3칸.
    //   칩을 셀 안에 넣었던 판은 철회: .stats-row .stat 은 텍스트 전용이고 칩은 .chip-row 소속,
    //   둘을 섞으면 두 컴포넌트 계약을 다 깬다(유저). 디바이스 배터리는 폐기 —
    //   모바일 ready-to-start.html 에도 없고, 'Connection · Good' 과 같은 말이었다.
    //   칸 폭 = 내용 크기(구 flex:1 + nowrap 은 값이 옆 칸을 파고들었다 — 실측).
    ctx.save(); this._fadeIn(SY, 212, eOut(intro(t, .35, .8)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const cells = [['Time', D.time, false], ['Connection', 'Good', false], ['Mode', D.mode, D.modeSm]];
    const cellW = (lbl, val, sm) => {
      ctx.font = F(400, 58); const a = ctx.measureText(lbl).width;
      ctx.font = F(700, sm ? 66 : 80); return Math.max(a, ctx.measureText(val).width) + 60;
    };
    const cw2 = cells.map(([l, v, sm]) => cellW(l, v, sm));
    let sx = CX - (cw2.reduce((a, b) => a + b, 0) + 76) / 2;   // 구분선 2개 × (4 + 여백 34)
    cells.forEach(([lbl, val, sm], i2) => {
      if (i2) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(sx + 17, SY + 32, 4, 147); sx += 38; }
      const w2 = cw2[i2];
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = F(400, 58); ctx.letterSpacing = '-2.2px';
      ctx.fillText(lbl, sx + w2 / 2, SY + 14);
      ctx.fillStyle = '#fff'; ctx.font = F(700, sm ? 66 : 80); ctx.letterSpacing = '-2.4px';
      ctx.fillText(val, sx + w2 / 2, SY + 14 + 70 + 27);
      sx += w2;
    });
    ctx.letterSpacing = '0px';
    ctx.restore();
    // CTA = 모바일 .rts-prompt 컴포넌트(ready.css) 2줄 스택 이식 — 지시(m) / 캡션(s). 복싱 벽(wallgl:497)과 같은 2줄.
    //   제목과 같은 흰 볼드 한 줄이라 구분이 안 됐다(유저). 비율은 모바일 그대로(s/m=0.5),
    //   절대 크기는 지면 타입스케일 유지(m 88). 글로우+발은 이 화면의 시그니처라 존치.
    ctx.save(); this._fadeIn(1057, 300, eOut(intro(t, .7, .9)));
    const bob = cycle(t, 1.5, 3, 3);
    const ady = bob == null ? 0 : kf(bob, [[0, 0], [.12, 14], [.25, 0], [.4, 13], [.52, 0], [.58, 0], [1, 0]]);
    const ar = this._img('run/arrow.svg');
    if (ar) ctx.drawImage(ar, CX - 43, 1057 + ady, 86, 86);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    let hy = 1057 + 86 + 30;
    ctx.fillStyle = '#fff'; ctx.font = F(700, 88); ctx.letterSpacing = '-4.7px';
    ctx.fillText('Tap your foot Twice', CX, hy); hy += 88 * 1.2 + 19;
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = F(400, 44); ctx.letterSpacing = '-1.3px';
    ctx.fillText('with the Wearable on', CX, hy);
    ctx.letterSpacing = '0px';
    ctx.restore();
    // 발 — 탭 모션(footBob)
    ctx.save(); this._fadeIn(1140, 539, eOut(intro(t, .7, .9)));
    const foot = this._img('run/foot.svg');
    const fdy = bob == null ? 0 : kf(bob, [[0, 0], [.12, 46], [.25, 6], [.4, 44], [.52, 0], [.58, 0], [1, 0]]);
    if (foot) ctx.drawImage(foot, 606, 1140 + fdy, 400, 539);
    ctx.restore();
  }

  // 제자리 scale+fade 등장 — 호출자가 save()한 상태에서 부른다
  _fadeIn(y, h, e) {
    const ctx = this.ctx;
    ctx.globalAlpha *= e;
    const k = 0.94 + 0.06 * e;
    ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2));
  }

  // ── 전환 (floor-transition.html) ───────────────────────────────────────────
  _paint_transition() {
    const ctx = this.ctx, TR_ = TR[this.stage] || TR.T1, t = this.t;
    this._bgGlow(1160);
    this._titleGroup(500, TR_.sub, TR_.title);
    const S = 589.4, GAP = 23.6, P = 52.392, y = 850;   // 벽과 같은 10% 축소(유저) — 러닝·농구 전환도 이 경로
    const x0 = CX - (S * 2 + GAP) / 2;
    // cardIn .8s (.38/.54) + cardFloat 4s/4.4s ×3 — 카드는 이미 바닥에 붙어 있어 '떠오름'은 원본대로 translate
    const card = (x, d, fd, fdur, D, done) => {
      const e = eOut(intro(t, d, 0.8)), c = cycle(t, fd, fdur, 3);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, c == null ? 0 : kf(c, [[0, 0], [.5, -13], [1, 0]]));
      const k = 0.9 + 0.1 * e;
      ctx.translate(x + S / 2, y + S / 2); ctx.scale(k, k); ctx.translate(-(x + S / 2), -(y + S / 2));
      this._card(x, y, S, 65.49, P, D, done);
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
      insetGlow(ctx, x, y, S, S, R, rgba(NEU.ink, 0.6), 52.392, 19.647);
      ctx.restore();
    }
    ctx.restore();
    // 우상단 배지 — sPop .6s (.95/1.0) 로 튀어나온다
    const sp = eOut(intro(this.t, done ? 0.95 : 1.0, 0.6));
    ctx.save();
    ctx.globalAlpha *= kf(sp, [[0, 0], [.6, 1], [1, 1]]);
    const spk = kf(sp, [[0, .5], [.6, 1.12], [1, 1]]);
    if (done) {
      const c = x + S - P - 45.8, cy = y + P + 45.8;
      ctx.translate(c, cy); ctx.scale(spk, spk); ctx.translate(-c, -cy);
      checkBadge(ctx, c, cy, 45.8);
    } else {
      ctx.font = F(400, 52); const bw = ctx.measureText('Next').width + 52.4, bh = 52 * 1.2 + 26.2;
      const bx = x + S - P - bw / 2, by = y + P + bh / 2;
      ctx.translate(bx, by); ctx.scale(spk, spk); ctx.translate(-bx, -by);
      ctx.save();   // Figma 뱃지 그림자 0 0 39.294px rgba(0,0,0,.12)
      ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 39.294;
      ctx.fillStyle = 'rgba(255,255,255,.9)'; this._pill(x + S - P - bw, y + P, bw, bh);
      ctx.restore();
      ctx.fillStyle = NEU.t3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Next', bx, by);
    }
    ctx.restore();
    // 좌하단 메타
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = done ? NEU.paper : NEU.t2; ctx.font = F(400, 36); ctx.letterSpacing = '-1.64px';
    ctx.fillText(D.time, x + P, y + S - P);
    ctx.fillStyle = done ? '#fff' : NEU.inkDark; ctx.font = F(700, 64); ctx.letterSpacing = '-3.27px';
    ctx.fillText(D.lbl.toUpperCase(), x + P, y + S - P - 36 * 1.2 - 13.1);
    ctx.letterSpacing = '0px';
  }

  // ── 실전 직전 카운트다운 (floor-timer.html) ────────────────────────────────
  _paint_timer() {
    const ctx = this.ctx, M = TM[this.stage] || TM.C1, dur = this.params.dur || 3, t = this.t;
    this._bgGlow(1160);
    const y = this._titleGroup(600, M.sub, M.title) + 88;
    const cy = y + 302, rem = dur - t, txt = rem > 0.05 ? String(Math.ceil(rem)) : 'GO';
    // ringPop .8s .35s + ringBreath 3s 1.2s ×3
    const e = eOut(intro(t, .35, .8)), br = cycle(t, 1.2, 3, 3);
    ctx.save();
    ctx.globalAlpha *= kf(e, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(e, [[0, .6], [.7, 1.05], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(k, k); ctx.translate(-CX, -cy);
    if (br != null) {
      const g = kf(br, [[0, 0], [.5, 1], [1, 0]]);
      ctx.shadowColor = `rgba(255,255,255,${.35 * g})`; ctx.shadowBlur = 26 * g;
    }
    drawRing(ctx, { size: 604 }, y, clamp01(t / dur), '#fff');
    ctx.shadowBlur = 0;
    // numPulse — 숫자가 바뀔 때마다 .5s
    if (txt !== this._numLast) { this._numLast = txt; this._numT = t; }
    const q = clamp01((t - this._numT) / 0.5), nk = kf(q, [[0, 1.5], [1, 1]], eOut);
    ctx.save();
    ctx.globalAlpha *= kf(q, [[0, 0], [.35, 1], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(nk, nk); ctx.translate(-CX, -cy);
    drawCenteredNum(ctx, txt, CX, cy, 220);
    ctx.restore();
    ctx.restore();
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
    ctx.font = F(700, 128.5, dot9); const nTxt = String(Math.round(100 * e));
    const nw = ctx.measureText(nTxt).width;
    ctx.font = F(700, 90.3, dot9); const sw = ctx.measureText('%').width;
    ctx.textAlign = 'left';
    ctx.font = F(700, 128.5, dot9); ctx.fillText(nTxt, CX - (nw + sw + 8) / 2, cy);
    ctx.font = F(700, 90.3, dot9); ctx.fillText('%', CX - (nw + sw + 8) / 2 + nw + 8, cy + 14);
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
      ctx.fillStyle = '#fff'; ctx.font = F(700, st[2] === 'sm' ? 42 : 64, dot9);   // 수치 = 도트폰트(유저 규칙)
      ctx.fillText(st[1], x + cw / 2, y + 39 * 1.2 + 18);
      ctx.letterSpacing = '0px';
      x += cw;
    });
    ctx.restore();
    // sUp .7s 1.35s + btnPulse 3s 2s ×3
    const bp = cycle(t, 2, 3, 3);
    this._button(y + 39 * 1.2 + 18 + 64 * 1.2 + 16, BTN, eOut(intro(t, 1.35, .7)), 0,
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }

  // Success 컴포넌트(Figma 130-2984) — 배지 + 점선 카운트다운 링
  _succ(n, y) {
    const ctx = this.ctx;
    // 성취 배지 = 복싱 콤보와 같은 컴포넌트(drawBadge). 구 흰 필 + 이모지는 은퇴.
    const S = 88 / 114.26;   // 지면 배지 높이 88 에 맞춘 스케일
    drawBadge(ctx, CX, y + 44, 'Success!', { scale: S, icon: this._img('flame.svg') });
    const arc = this.map.get('succ-arc');
    const frac = numOr(arc?.style.strokeDashoffset, 0) / 615.7;   // 원본은 offset이 곧 남은 비율
    const ry = y + 88 + 56;
    this._ringAt(CX, ry, 220, frac, '#fff');
    drawCenteredNum(ctx, this.map.get('succ-n')?.textContent || '', CX, ry + 110, 88);
  }

}
