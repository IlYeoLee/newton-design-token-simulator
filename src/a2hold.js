// A2(종아리 늘리기) 홀드 진행 — **없는 상태를 0 으로 뭉개지 않는다.**
//
//   왜 따로 있나: 이 한 줄이 "타이머가 3 에서 멈춰 있다"(유저 08-06)의 원인이었다.
//   예전 식은 `cyc?.inHold ? clamp01(cyc.prog) : 0` 이었는데, 0 은 '홀드를 막 시작했다'는
//   뜻이라 링이 3 으로 되돌아간다. 실제 사이클(main.js A2)은 이렇게 생겼다:
//
//     하강 1.1s → 홀드 3.0s → 상승 1.6s   (CYC 5.7s) · 그 앞에 관찰 5.8s
//
//   inHold 가 true 인 건 3.0s 뿐이다. 나머지 2.7s 와 관찰 5.8s 가 전부 0 으로 떨어져,
//   A2 는 **대부분의 시간을 '3' 으로 서 있었다**. 카운트가 도는 구간이 오히려 소수였다.
//
//   상태를 셋으로 나눈다:
//     하강  0     아직 안 눌렀다
//     홀드  prog  누르는 중 (3·2·1 이 여기서 나온다)
//     상승  1     다 눌렀다 — 0 으로 되돌리면 안 된다
//     모름  null  관찰 구간이거나 세션이 없다(갤러리·익스포터).
//                 **숫자를 지어내지 않는다** — floorgl 의 reps 분기가 세운 규약과 같다:
//                 셀 게 없으면 안 센다. null 이면 A2 분기를 건너뛰고 관찰 카운트로 간다.
//
//   node 에서 그대로 import 된다(의존 0) — scripts/check_a2_hold.mjs 가 이 표를 검증한다.
//   floorgl 에 인라인으로 두면 THREE 때문에 검사를 못 돌린다.

/** @param cyc main.js 가 매 프레임 채우는 session.a2Cyc */
export function a2Hold(cyc) {
  if (!cyc || cyc.watching) return null;
  if (cyc.inHold) return Math.max(0, Math.min(1, cyc.prog ?? 0));
  return cyc.descending ? 0 : 1;
}

/** 링에 찍히는 값 — 3·2·1. hp 가 null 이면 이 함수를 부르지 않는다(호출자가 건너뛴다). */
export const a2Rem = hp => String(Math.min(3, Math.max(1, Math.ceil(3 * (1 - hp)))));
