// ══ 랩 개발자 게이트 — 정본 하나 ═══════════════════════════════════════════════
//   유저 08-11: "개발자모드랑 비개발자 모드, 랩 3개 파일 다 구분해서. 개발자 모드에도
//   진입 경로는 되, 편집+실시간 살아있는 파이프라인을 배포본이랑 명확하게 구분지어."
//
//   규약은 index.html(시뮬)과 **같다**. 값이 두 벌이면 그게 버그라, 판정식을 여기 한 벌로
//   두고 랩 셋(footlab·fxlab·tokens)이 전부 이걸 부른다.
//     ?dev=1/0  >  localStorage('newton.dev')  >  기본값(로컬 = on · 배포 = off)
//   배포(비로컬)에서는 **아예 켤 수 없다** — 쿼리로도 안 켜지고 localStorage 도 지운다.
//   (시뮬 index.html 주석과 같은 판단: "실제 웹에서 절대 안 보이게".)
//
//   ── 파이프라인 구분 ────────────────────────────────────────────────────────
//   dev  : 랩에서 만진 값이 BroadcastChannel/localStorage 로 **시뮬에 실시간 반영**되고
//          '코드에 저장'으로 정본(mark-look.json 등)에 쓸 수 있다.  = 편집 파이프라인
//   비dev: 랩은 **자기 캔버스만** 그린다(로컬 프리뷰). 송신부는 이 모듈이 막고,
//          수신부(시뮬)는 ae198c5 의 전시 가드가 또 막는다 — 양쪽 이중 차단.
//          = 배포본. 전시 관람객이 만져도 시뮬은 안 변한다.

/** 이 문서가 개발자 모드인가. body.dev 클래스도 함께 세운다(CSS 로 섹션 숨김 가능). */
export function initLabDev() {
  const q = new URLSearchParams(location.search).get('dev');
  const local = /^(localhost|127\.|192\.168\.)/.test(location.hostname);
  if (!local) {                                    // 배포 = 개발자 모드 없음
    document.body.classList.remove('dev');
    try { localStorage.removeItem('newton.dev'); } catch {}
    return false;
  }
  const on = q != null ? q !== '0'
    : (localStorage.getItem('newton.dev') ?? '1') === '1';
  if (q != null) { try { localStorage.setItem('newton.dev', on ? '1' : '0'); } catch {} }
  document.body.classList.toggle('dev', on);
  return on;
}

/** 지금 dev 인가 — 매번 다시 읽는다(D 키 토글이 살아 있으므로 캐시하지 않는다). */
export const isLabDev = () => document.body.classList.contains('dev');

/** 송신 게이트. dev 가 아니면 fn 을 아예 안 부른다.
 *  랩의 '시뮬로 보내기' 경로(BroadcastChannel·postMessage·localStorage 쓰기)를 이걸로 감싼다. */
export function devOnly(fn) {
  return (...a) => { if (isLabDev()) return fn(...a); };
}

/** 비dev 에서 통째로 숨길 섹션 표시 — 개발 전용 UI(버전 비교·정본 저장 등).
 *  CSS 한 줄과 짝이다:  body:not(.dev) [data-devonly] { display:none !important; } */
export function markDevOnly(root = document) {
  if (isLabDev()) return;
  root.querySelectorAll('[data-devonly]').forEach(el => { el.style.display = 'none'; });
}
