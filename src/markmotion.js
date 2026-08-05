// ─────────────────────────────────────────────────────────────
// MARK MOTION — 마크의 **움직임 느낌** 정본 (유저 2026-08-06)
//
//   왜: 이 규칙들이 session.js `_sbPlace`/`sbPoseAt` 안에 갇혀 있었다. 농구 스텝백 4단계
//   전용 로컬 코드인데, 정작 "발자국이 생생하게 찍히는 느낌"의 전부가 여기 들어 있다 —
//   스텝/슬라이드 이징 · 타닥 두 박 착지 · 착지 직전 오버슈트 · 체공 고스트.
//   러닝·워밍업·존원은 이 느낌을 하나도 못 쓴다. 그래서 룩 시스템 쪽으로 올린다.
//
//   ★ 판정 8토큰(Preview·Active·Hold·Success·Miss·Warning·Locked·Tap2)은 **안 건드린다**(유저).
//     여기는 상태가 아니라 **움직임**만 다룬다. 두 축은 직교한다 —
//     같은 Active 라도 스텝으로 올 수도 슬라이드로 올 수도 있다.
//
//   ★★ 이 파일은 추출이지 재설계가 아니다. 숫자는 _sbPlace 원본 그대로다.
//      바꾸는 건 그다음 — 먼저 옮기고, 화면이 같은지 확인하고, 그때 고친다(유저).
//
//   튜닝: mark-look.json 의 `motion` 섹션이 있으면 그 값이 이긴다(footlab 이 굽는다).
// ─────────────────────────────────────────────────────────────

import LOOK from './mark-look.json' with { type: 'json' };

const M = LOOK.motion || {};
const v = (k, d) => (M[k] != null ? M[k] : d);

/** 이동 이징 — **발 종류가 곡선을 정한다.**
 *  step  = 뗐다 → 빠르게 → 딱 멈춤 (easeInOutQuad)
 *  slide = 초반에 확 밀고 길게 감속 ('쓰윽' — 바닥에 붙어 있으니 관성이 다르다) */
export function easeMove(slide, f) {
  const t = Math.max(0, Math.min(1, f));
  return slide ? 1 - Math.pow(1 - t, v('slideDecay', 2.6))
               : (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
}

/** 스텝 지연 — 구간 후반 65%에 몰아서 '확' 옮긴다. 앞 35%는 아직 안 뗀 상태.
 *  (구간 전체에 고르게 퍼뜨리면 발이 스르륵 흘러가 스텝으로 안 읽힌다) */
export function stepDelay(f) {
  const lead = v('stepLead', 0.35);
  return Math.max(0, Math.min(1, (f - lead) / (1 - lead)));
}

/** 착지 = **타닥 두 박**. ① 앞꿈치 접지 큰 팝 ② 뒤꿈치가 따라 내려앉는 작은 팝.
 *  한 박으로 하면 '툭' 이고, 두 박이라야 체중이 실려 구르는 걸로 읽힌다. */
export function stampPop(age) {
  const p1 = Math.max(0, 1 - age / v('popA', 0.18));
  const p2 = Math.max(0, 1 - Math.abs(age - v('popBAt', 0.10)) / v('popB', 0.16));
  return Math.max(p1, p2 * 0.5);
}
/** 타닥이 끝나는 시각(s) — 물리 상태 `planted` 의 수명이기도 하다. */
export const STAMP_DUR = v('popBAt', 0.10) + v('popB', 0.16);

/** 체공 — 궤적 중간에서 가장 크고 가장 흐리다(유리판 위를 미끄러지는 인상 방지). */
export const airK = f => Math.sin(Math.PI * Math.max(0, Math.min(1, f)));
export const airAlpha = f => 0.30 + 0.25 * (1 - airK(f));
export const airScale = f => 1 + v('airScale', 0.08) * airK(f);

/** 착지 직전 살짝 지나쳤다가 되돌아온다 — 체중이 앞으로 실리는 느낌. */
export function overshoot(f) {
  const at = v('overAt', 0.85);
  return f > at ? (f - at) / (1 - at) * v('over', 0.06) : 0;
}

/** 슬라이드 — 들리지 않으니 고스트로 안 바꾼다. 밀리는 동안만 살짝 흐려져 잔상감을 준다. */
export const slideAlpha = f => 0.70 + 0.25 * (1 - Math.max(0, 1 - f));

/** 등장/타격 팝 — Marker.render 가 쓰던 값(여기로 모아 둔다, 아직 호출부는 그대로). */
export const SPAWN = { dur: v('spawnDur', 0.38), from: 0.55, over: 0.10 };
export const HIT   = { dur: v('hitDur', 0.30), amp: 0.30 };
export function spawnScale(age) {
  const e = age / SPAWN.dur;
  if (e >= 1 || e < 0) return 1;
  const k = 1 - Math.pow(1 - e, 3);
  return SPAWN.from + (1 - SPAWN.from) * k + SPAWN.over * Math.sin(Math.min(1, e) * Math.PI);
}
export function hitScale(age) {
  const e = age / HIT.dur;
  return e >= 1 || e < 0 ? 1 : 1 + HIT.amp * (1 - e) * (1 - e);
}
