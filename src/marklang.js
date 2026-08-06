// ─────────────────────────────────────────────────────────────
// MARK LANGUAGE — 발자국·존원의 **공통 언어** (유저 2026-08-06)
//
//   왜: 마크 시스템이 지금 둘이다.
//     ① tokens.js TokenSystem  — 리듬 판정 어휘(preview·countdown·linger·locked·miss)
//     ② session.js _sbPlace     — 발 물리 어휘(step·slide·moving·plantT·toe), 농구 4단계 전용
//   ②가 사용자가 원하는 것(체공·슬라이드·타닥 두 박·오버슈트)을 이미 갖고 있는데 ①의 API 로
//   번역해서 쓴다 — 슬라이드가 countdown 이고 체공이 ghost 다. 그래서 상태 하나를 만지면
//   어느 화면이 바뀌는지 아무도 모른다.
//
//   이 파일은 그 어휘를 **다섯 축**으로 못박는다. 축은 서로 직교한다 —
//   한 축을 바꿔도 다른 축의 의미가 안 변해야 하고, 안 그러면 축을 잘못 자른 것이다.
//
//   ★ 이 파일은 좌표를 하나도 갖지 않는다. 정본은 session.js 의 SB_POSE 하나다.
//     (tokenlab.js 첫 주석과 같은 규율 — 여기 값을 복사하면 시뮬과 갤러리가 갈린다.)
// ─────────────────────────────────────────────────────────────

/** ① LOAD — 발에 실린 하중과 **그 위치**. 렌더는 plantar 핫스팟 가중 + 도트 농도로 받는다. */
export const LOAD = {
  off:   { label: '없음',   ball: 0.00, heel: 0.00, toe: 0.00, ink: 0.18, desc: '체공 — 하중 0' },
  heel:  { label: '뒤꿈치', ball: 0.25, heel: 1.00, toe: 0.10, ink: 0.75, desc: '접지 첫 박' },
  flat:  { label: '전면',   ball: 0.80, heel: 0.80, toe: 0.45, ink: 1.00, desc: '두 발로 버팀' },
  toe:   { label: '앞볼',   ball: 1.00, heel: 0.15, toe: 0.70, ink: 0.95, desc: '뒤꿈치 들고 버팀' },
  drive: { label: '밀기',   ball: 1.00, heel: 0.05, toe: 1.00, ink: 1.15, desc: '바닥을 밀어낸다' },
};

/** ② MOVE — 자리에서 자리로 가는 방식. 이징이 여기서 파생된다(발 종류가 곡선을 정한다). */
export const MOVE = {
  hold:  { label: '고정', ease: f => f,                                     desc: '안 움직인다' },
  step:  { label: '스텝', ease: f => (f < 0.5 ? 2*f*f : 1 - Math.pow(-2*f+2, 2)/2), lift: 1, desc: '들어서 옮긴다 — 뗐다·확·딱' },
  slide: { label: '슬라이드', ease: f => 1 - Math.pow(1 - f, 2.6),          lift: 0, desc: '바닥에 붙은 채 밀린다 — 초반에 확, 길게 감속' },
};

/** ③ ENTER / EXIT — 마크가 화면에 들고 나는 방식. */
export const ENTER = {
  rise:  { label: '차오름', dur: 0.55, desc: '아웃라인 → 필이 차오른다' },
  pop:   { label: '팝',     dur: 0.38, desc: '0.55 → 1.08 → 1 오버슈트' },
  stamp: { label: '찍힘',   dur: 0.26, desc: '타닥 두 박 — 앞볼 0.18s + 0.10s 뒤 뒤꿈치 0.16s' },
};
export const EXIT = {
  fade:  { label: '페이드', dur: 0.35 },
  ghost: { label: '고스트', dur: 0.30, desc: '옅게 남아 자리를 기억시킨다' },
  hold:  { label: '유지',   dur: 0,    desc: '안 사라진다 — 그 단계의 목표라서' },
};

/** ④ STATE — **2층**이다. 물리가 사실이고 평가는 그 위에 얹는다.
 *    지금 코드는 이 둘을 한 줄에 섞어(preview·countdown·linger·locked·miss) 표현력이 모자란다. */
export const PHYS = {
  air:     { label: '체공',  desc: '들려 있다 — 궤적 중간에서 가장 크고 흐리다' },
  sliding: { label: '슬라이드', desc: '닿은 채 밀린다 — 흐려지되 고스트는 아니다' },
  planted: { label: '접지',  desc: '방금 닿았다 — 하중이 실리는 순간' },
  resting: { label: '유지',  desc: '닿아 있다 — 이 단계의 목표 자리' },
};
export const VERDICT = {
  neutral: { label: '중립', desc: '아직 평가 없음 — 학습 단계의 기본' },
  good:    { label: '적중', desc: '목표와 일치' },
  miss:    { label: '빗나감', desc: '목표 밖' },
};

/** ⑤ LINK — 마크 **사이**를 잇는 부가 표시. 마크의 속성이지 별도 물건이 아니다. */
export const LINK = {
  none:  { label: '없음' },
  arrow: { label: '화살표', desc: '출발 → 도착. 도트 스템(지면 규약)' },
  trail: { label: '자취',   desc: '지나온 경로를 옅게 남긴다' },
  pair:  { label: '스탠스', desc: '좌우를 잇는 선 — 폭이 곧 지시다' },
};

/** 농구 4/4단계 매핑 — **session.js 의 cue 문구와 SB_POSE 에서 파생**했다.
 *  이게 언어의 첫 시험대다: 네 단계가 이 어휘로 남김없이 적히면 언어가 성립한 것이고,
 *  못 적히는 칸이 나오면 축이 모자란 것이다. (검증: scripts/check_mark_lang.mjs) */
export const BK_STEPBACK = {
  // ★ 3조각 재편(08-06 실측) — 구 1/4 'Fake the Layup' 은 클립에서 **발이 안 움직이는 구간**이라
  //   문법이 전부 hold 였다(가르칠 게 없는 단계). 나머지 셋이 그대로 1/3·2/3·3/3 이 된다.
  BK_T1: {
    n: null, title: 'The Whole Move', cue: '딛고 · 빠지고 · 모으고',
    L: { load: 'drive', move: 'slide', enter: 'rise', exit: 'hold' },
    R: { load: 'heel',  move: 'step',  enter: 'stamp', exit: 'hold' },
    link: 'arrow',
  },
  BK_B2: {
    n: '1/3', title: 'Cross Step', cue: 'R 크로스 · L 버팀',
    L: { load: 'toe',   move: 'hold', enter: 'rise',  exit: 'hold' },   // SB_POSE t1.47 L[2]=1 = 앞볼 접지
    R: { load: 'heel',  move: 'step', enter: 'stamp', exit: 'hold' },
    link: 'arrow',  // R 의 출발 → 도착
  },
  BK_B3: {
    n: '2/3', title: 'Slide Back', cue: 'L 크게 벌림 · 두 손 개더',
    L: { load: 'drive', move: 'slide', enter: 'rise', exit: 'hold' },   // SB_POSE t1.70 L[3]='slide'
    R: { load: 'toe',   move: 'hold',  enter: 'rise', exit: 'hold' },
    link: 'arrow',
  },
  BK_B4: {
    n: '3/3', title: 'Gather and Rise', cue: 'R 모음 · 수직 상승',
    L: { load: 'flat', move: 'hold', enter: 'rise',  exit: 'hold' },
    R: { load: 'flat', move: 'step', enter: 'stamp', exit: 'hold' },
    link: 'pair',
  },
};

/** 물리 상태는 **선언하지 않는다** — MOVE 와 진행률에서 파생된다.
 *  (선언하면 두 벌이 되고 반드시 어긋난다. 지금 tokens.js 가 그 상태다.) */
export function physOf(move, f, landedAge) {
  if (move === 'hold') return 'resting';
  if (f > 0.001 && f < 0.999) return move === 'slide' ? 'sliding' : 'air';
  if (landedAge != null && landedAge < 0.26) return 'planted';   // ENTER.stamp.dur
  return 'resting';
}

// ═══ 디자인 이식 — 어휘가 어떤 실물 값으로 내려가는가 ════════════════════════
//   ★ 값을 복사하지 않는다. 전부 정본에서 import 한다(tokens.js · mark-look.json).
//     여기 숫자를 적으면 시뮬과 갈린다 — tokenlab.js 첫 주석과 같은 규율.

/** 크기 — 발 길이 하나가 존 반경까지 지배한다(ZONE 이 발 배수). */
export { FOOT_LEN_M, ZONE } from './tokens.js';

/** 발자국 룩 — footlab 이 굽는 mark-look.json 이 정본. */
export { default as MARK_LOOK_JSON } from './mark-look.json';

/** ★ 화살표 토큰 — **MOVE 에서 파생한다**. 화살표는 마크의 속성이지 별도 물건이 아니다.
 *  두께·촉은 drawStemArrow 규약(scale 1 에서 뿌리 1.1px → 머리 13px · 촉 42px)을 그대로 탄다.
 *  ★★ 점 리듬은 **발자국 도트 피치에서 파생**한다. 따로 정하면 두 물건으로 읽힌다
 *     (유저 08-05: "벽은 이어진 테이퍼 자루, 바닥은 점렬" — 지면은 도트가 공용 언어다). */
export const ARROW = {
  hold:  null,                                                    // 안 움직이면 화살표도 없다
  step:  { scale: 0.85, tips: 1, dots: true, label: '스텝',     desc: '들어 옮김 — 가늘고 또렷' },
  slide: { scale: 1.35, tips: 1, dots: true, label: '슬라이드', desc: '밀어냄 — 굵게. 이 동작의 힘이 여기 있다' },
};
/** 점 피치 = 발자국 도트 피치 × 2.2 — 같은 리듬인데 성기다(선이라 밀도가 낮아야 선으로 읽힌다). */
export const ARROW_DOT_K = 2.2;
/** 길이는 이동 거리에서 자동. 두께만 거리에 살짝 비례 — 큰 슬라이드가 굵게 읽혀야 한다. */
export function arrowFor(move, dist01) {
  const a = ARROW[move];
  if (!a) return null;
  return { ...a, scale: a.scale * (0.85 + 0.35 * Math.min(1, dist01)) };
}

/** ── 스테이지 타이밍 **정본** (2026-08-06) ───────────────────────────────────
 *  왜 여기인가: 이 값들이 지금까지 **세 파일에 각각** 적혀 있었고 서로 달랐다.
 *    main.js:4211  HOLD = 3.0        (실제 구동값)
 *    main.js:4207  holdSec: 3.0      (관찰 구간용으로 또 적음)
 *    session.js    cyc?.holdSec ?? 5 (마크 안 숫자 기본값 — 5초)
 *    floorgl.js    cyc?.holdSec ?? 3 (지면 링 기본값 — 3초)
 *  → a2Cyc 가 한 프레임이라도 비면 **숫자는 5초, 링은 3초** 기준으로 그려졌다.
 *    관찰 길이 5.8 도 session.js(DEMO)·main.js(A2_WATCH) 두 곳에 있어, 한쪽만 고치면
 *    "시범이 끝났는데 화살표가 안 뜨는" 사각지대가 생겼다(그 파일 주석이 이미 경고한 그것).
 *  규칙: 소비자는 **fallback 을 두지 않는다.** 값이 없으면 조용히 다른 숫자로 도는 대신
 *    여기에 스테이지를 추가하라는 뜻이다. */
export const STAGE_TIME = {
  // ★ 홀드 2.15 = 실사 실측(레퍼런스 9초·60fps, 노란 상의 bbox 추적으로 구간 분리).
  //   3.0 은 근거 없이 잡힌 값이었다. 2.15 여도 3·2·1 은 다 보인다 — a2Rem 이 남은 초가 아니라
  //   **진행률 3등분**(각 0.717s)으로 세기 때문이다. 초로 올림하면 '3' 이 0.15초만 번쩍한다.
  A2: { hold: 2.15, watch: 5.8, reps: 2 },   // 종아리 늘리기 — 홀드 2.15초(실측) · 시범 5.8초 · 2렙
};
/** 스테이지 타이밍 조회 — 없는 스테이지는 기본 관찰 3초만 준다(홀드는 그 스테이지에 없다는 뜻). */
export const stageTime = id => STAGE_TIME[id] || { hold: 0, watch: 3.0, reps: 0 };

export const AXES = [
  ['LOAD',    '힘',        LOAD],
  ['MOVE',    '이동',      MOVE],
  ['ENTER',   '등장',      ENTER],
  ['EXIT',    '퇴장',      EXIT],
  ['PHYS',    '물리 상태', PHYS],
  ['VERDICT', '평가',      VERDICT],
  ['LINK',    '부가 표시', LINK],
  ['ARROW',   '화살표',    ARROW],
];
