// ─────────────────────────────────────────────────────────────
// NEWTON 팔레트 — 단일 소스 (유저 확정, 2026-07-28)
//
//   규칙 ①  유채색은 아래 4개뿐이다. 다른 유채색을 새로 쓰지 않는다.
//   규칙 ②  무채(흰·회)는 상태 부호(Locked·Miss·잉크)로만 쓴다 — 색이 아니다.
//   규칙 ③  채도는 건드리지 않는다. LUT의 sat은 1 고정.
//   규칙 ④  무대(미장센)는 팔레트 대상이 아니다 — 러닝 트랙 초록·복싱 나무 바닥은
//           '실제 공간'이지 투사광이 아니다. 팔레트는 프로젝터가 쏘는 빛(UI·토큰·잉크)만 지배한다.
//           그래서 화면 픽셀의 색은 팔레트와 다를 수 있다(초록 트랙에 빨강을 쏘면 합성색이 나온다).
//           규칙 준수는 픽셀이 아니라 '코드에 팔레트 밖 유채색이 없는가'로 검증한다(tmp_audit_palette.mjs).
//
// 이 파일이 hex/숫자/GLSL vec3/CSS 네 형식을 모두 파생한다 —
// 예전엔 같은 빨강이 tokens.COLORS · session.BRAND · session.CS · index.html 네 곳에
// 따로 적혀 있었고, 셰이더엔 팔레트에 없는 9번째 색(#FEE2C6)까지 박혀 있었다.
// ─────────────────────────────────────────────────────────────

/** 유채 4색 — CMYK는 인쇄 사양(문서용), 코드는 HEX가 정본 */
export const PAL = {
  red:   '#FA3030',   // NEWTON RED · CMYK 0/90/78/0 · rgb(250,48,48)
  coral: '#FE6E3C',   // Coral       · CMYK 0/71/74/0 · rgb(254,110,60)
  sand:  '#FEC389',   // Sand        · CMYK 0/32/48/0 · rgb(254,195,137)
  prism: '#D1FEFF',   // Prism       · CMYK 21/0/6/0  · rgb(209,254,255)
};

/** 무채 — 색이 아니라 상태 부호(잠김·실패·잉크). 두 단계로 통일. */
export const NEU = {
  ink:     '#FFFFFF',   // 밝은 잉크(어두운 바탕) — 구 웜크림 3변종 은퇴
  inkDark: '#0A0A0A',   // 어두운 잉크(흰 카드 위) — 구 #050a0a(청록 끼) 정규화
  hi:      '#ECECEC',   // Miss 필 · Locked 필
  lo:      '#D0D0D0',   // Locked 림 · 비활성 도트
  paper:   '#FAFAFA',   // 카드 위 보조 텍스트(밝은)
  surface: '#F2F2F2',   // 카드 안 셀 배경
  t1:      '#3B3B3B',   // 카드 섹션 제목
  t2:      '#757575',   // 카드 캡션
  t3:      '#525252',   // 배지 텍스트
};

const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** 0xRRGGBB 숫자 (three.js Color) */
export const NUM = Object.fromEntries(
  Object.entries({ ...PAL, ...NEU }).map(([k, v]) => [k, parseInt(v.slice(1), 16)]));

/** GLSL vec3 리터럴 (0~1) — 셰이더 #define 주입용 */
export const vec3 = h => { const c = hx(h); return `vec3(${c.map(v => (v / 255).toFixed(4)).join(', ')})`; };

/** rgba() 문자열 — 캔버스용 */
export const rgba = (h, a = 1) => `rgba(${hx(h).join(',')},${a})`;

// ── 히트 LUT 스톱 ────────────────────────────────────────────
// 4색만으로 만든 램프. 좌표를 팔레트 색에 정확히 맞춰 놓았기 때문에
// session.deriveSessionPalette 의 lut(0.30)/lut(0.56)/lut(0.86)이 각각 red/coral/sand 그대로 나온다.
// (예전 스톱은 #B7231F·#FEA35F·#FFF3DC 세 개가 팔레트 밖이었다)
export const STOPS = [
  [PAL.red, 0], [PAL.red, 0.30], [PAL.coral, 0.56], [PAL.sand, 0.86], [PAL.prism, 1],
];
export const SAT = 1;   // 규칙 ③ — 채도 고정

/** 팔레트 밖 유채색이 섞였는지 검사 (개발 중 회귀 방지용) */
export function isPaletteColor(hex) {
  const h = String(hex).toUpperCase();
  if (/^#([0-9A-F])\1\1\1\1\1$/.test(h)) return true;   // 무채(r=g=b)는 상태 부호
  if (Object.values(NEU).some(n => n.toUpperCase() === h)) return true;
  return Object.values(PAL).some(p => p.toUpperCase() === h);
}

/** 저장된 룩이 팔레트 밖 색이나 채도를 들고 있어도 규칙 ①·③을 강제한다.
 *  (localStorage 에 남은 옛 룩 때문에 팔레트가 무너지는 걸 코드에서 막는다 —
 *   데이터 파일만 고치면 이미 저장본이 있는 브라우저에선 적용이 안 된다.) */
export function enforcePalette(st) {
  if (!st) return st;
  const bad = !Array.isArray(st.stops) || !st.stops.every(([c]) => isPaletteColor(c));
  if (bad) st.stops = STOPS.map(x => [...x]);
  st.sat = SAT;
  return st;
}
