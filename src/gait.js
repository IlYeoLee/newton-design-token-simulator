// ═══ 걸음(입각기) 정본 — 한 걸음 동안 하중이 어떻게 구르는가 ═════════════════
//   보행 문헌의 입각기 구간을 marklang LOAD 어휘로 적은 것. 좌표·색은 여기 없다 —
//   하중만 있고, 접지 창은 tokens.setMarkLoad 가 그 무게중심에서 만든다.
//   여기 표가 유일본이다. 페이지마다 다시 적으면 시뮬과 갈린다.
import { LOAD } from './marklang.js';

/** 입각기 진행 u(0..1) → 하중 프리셋 이름. t 는 구간 시작점(입각기 비율). */
export const STANCE = [
  { t: 0.00, load: 'heel'  },   // 초기접지 — 뒤꿈치 바깥이 먼저 닿는다
  { t: 0.12, load: 'flat'  },   // 하중수용 — 발바닥 전체로 받는다
  { t: 0.45, load: 'flat'  },   // 중간입각 — 중심이 발 위를 지난다
  { t: 0.62, load: 'toe'   },   // 말기입각 — 뒤꿈치가 들린다
  { t: 0.85, load: 'drive' },   // 전유각 — 엄지로 민다
  { t: 1.00, load: 'off'   },   // 유각 — 체공
];

const lerp = (a, b, f) => a + (b - a) * f;

/** 입각기 진행 u(0..1)의 하중 배분. 구간 사이는 smoothstep 으로 흐른다(하중은 안 끊긴다). */
export function stanceLoad(u) {
  const x = Math.max(0, Math.min(1, u));
  let i = 0; while (i < STANCE.length - 2 && x > STANCE[i + 1].t) i++;
  const a = LOAD[STANCE[i].load], b = LOAD[STANCE[i + 1].load];
  const f = Math.max(0, Math.min(1, (x - STANCE[i].t) / Math.max(1e-4, STANCE[i + 1].t - STANCE[i].t)));
  const e = f * f * (3 - 2 * f);
  return { ball: lerp(a.ball, b.ball, e), heel: lerp(a.heel, b.heel, e),
           toe: lerp(a.toe, b.toe, e),   ink: lerp(a.ink, b.ink, e) };
}
