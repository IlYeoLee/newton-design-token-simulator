import { PAL, NEU, vec3 } from './palette.js';
// ─────────────────────────────────────────────────────────────
// fx-core — 룩 시스템(FX Lab)과 시뮬레이터가 공유하는 단일 정본.
//
//   여기 있는 코드의 원산지는 전부 fxlab.html(룩 카탈로그) — FX Lab이 디자인 정본이므로
//   구현도 FX Lab 것을 그대로 승격. 시뮬 쪽 중복본(fxlut.js 등)은 이 모듈 소비로 대체.
//   존재 이유: 셰이더·SDF·규약이 손복사 2벌로 갈라져 있던 것이 "룩과 시뮬이 다르게
//   보인다" 계열 버그 전부의 구조적 원인이었음(±1.9922 디코드 누락, N=256 vs 768,
//   글리프 크기 1.43× 등 — 전부 2벌 사이 드리프트).
//
// ── 셰이더 작성 규칙 (어겼다가 '검은 판' 버그로 5턴 태움 · KNOWN-ISSUES 참조) ──
//   ① pow() 의 밑에는 반드시 max(base, 0.0) 또는 abs(). GLSL 은 밑<0 에서 NaN 을 낸다.
//   ② 외부에서 오는 진행값(prog·t·정규화 좌표)은 진입 즉시 clamp. 구동자를 믿지 않는다
//      — 실제로 uProg 가 1.0000002 로 들어와 밑이 음수가 됐다.
//   ③ 분모에는 max(·, 1e-4). 룩 슬라이더(uW 등)는 0 까지 내려간다.
//   ④ NaN 을 밖으로 내보내지 않는다. 마지막에 step() 스크럽 한 줄
//      (NaN 비교는 항상 false 라 step 이 0 을 고른다 — GLSL ES 1.0 의 유일한 신뢰 수단).
//   왜 치명적인가: NaN 한 픽셀이 색·알파를 타고 흘러 판 전체를 rgba(0,0,0,255) 로 만든다.
//   야간(가산)엔 안 보이고 주간 잉크(NormalBlending)에서만 터져 재현이 어렵다.
// ─────────────────────────────────────────────────────────────

// ── 정밀 EDT (Felzenszwalb) — 부호 거리장의 정본 ──
export function edt1d(f, d, v, z, n) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
export function edt2d(f, N) {
  const d = new Float32Array(N), v = new Int32Array(N), z = new Float32Array(N + 1), q = new Float32Array(N);
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) q[y] = f[y * N + x];
    edt1d(q, d, v, z, N);
    for (let y = 0; y < N; y++) f[y * N + x] = d[y];
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) q[x] = f[y * N + x];
    edt1d(q, d, v, z, N);
    for (let x = 0; x < N; x++) f[y * N + x] = d[x];
  }
}

/** 알파 채널 → float SDF (d/N 무손실 — 8bit 양자화 폐기가 지글거림의 근본 해결이었음).
 *  반환: { data: Float32Array(N*N), N, cx, cy(실루엣 무게중심 0..1) } */
export function sdfFromAlpha(imgData, N) {
  const INF = 1e20;
  const gO = new Float32Array(N * N), gI = new Float32Array(N * N);
  let cx = 0, cy = 0, cn = 0;
  for (let i = 0; i < N * N; i++) {
    const a = imgData[i * 4 + 3] / 255;
    gO[i] = a >= 1 ? 0 : a <= 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
    gI[i] = a >= 1 ? INF : a <= 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
    if (a > 0.5) { cx += i % N; cy += (i / N) | 0; cn++; }
  }
  edt2d(gO, N); edt2d(gI, N);
  const out = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) out[i] = (Math.sqrt(gO[i]) - Math.sqrt(gI[i])) / N;
  return { data: out, N, cx: cn ? cx / cn / N : 0.5, cy: cn ? cy / cn / N : 0.5 };
}

/** SVG → 비트맵 래스터 + 실픽셀 타이트 바운딩 (9인자 drawImage의 SVG 버그 회피).
 *  해상도별 이미지 캐시 — 저해상 캐시가 고해상 요청을 누르던 병목 방지. */
export function glyphRaster(img, S = 512) {
  const key = '_raster' + S;
  if (img[key]) return img[key];
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const sc = Math.min(S / img.naturalWidth, S / img.naturalHeight);
  g.drawImage(img, 0, 0, img.naturalWidth * sc, img.naturalHeight * sc);
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
    if (d[(y * S + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  img[key] = x1 < 0 ? { canvas: c, x: 0, y: 0, w: S, h: S } :
    { canvas: c, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return img[key];
}

/** 글리프 이미지 → float SDF 굽기 (78% fit 중앙 배치 — FX Lab updateFootSDF와 동일 레시피). */
export function bakeGlyphSDF(img, N, flip = false) {
  const R = glyphRaster(img, N);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const sc = Math.min((N * SIL_FIT) / R.w, (N * SIL_FIT) / R.h);
  const w = R.w * sc, h = R.h * sc;
  if (flip) { g.translate(0, N); g.scale(1, -1); }
  g.drawImage(R.canvas, R.x, R.y, R.w, R.h, (N - w) / 2, (N - h) / 2, w, h);
  return sdfFromAlpha(g.getImageData(0, 0, N, N).data, N);
}

/** 발자국 = 겉(신발 실루엣) + 안(맨발 자국) 두 장을 **한 프레임에서** 구워 RG 로 묶는다.
 *  유저 레퍼런스: '디자인이 이쁜 깔창을 밟는다' — 깔창 외곽 안에 맨발 압력 자국이 도트로 찍힌 구성.
 *
 *  ★ 함정: bakeGlyphSDF 를 두 번 부르면 안 된다. glyphRaster 가 **이미지별 타이트 바운딩**을
 *    잡고 각자 78% 로 맞추므로, 맨발이 신발과 같은 크기로 정규화돼 겹침이 통째로 깨진다.
 *    두 SVG 는 같은 550 viewBox 라서 glyphRaster 캔버스가 좌표계를 공유한다 —
 *    그래서 크롭 창을 **겉(신발) bbox 하나로 고정**하면 상대 위치·크기가 원본 그대로 남는다.
 *
 *  반환: { data: Float32Array(N*N*2) [R=겉, G=안], N, cx, cy(겉 무게중심), inCx, inCy(안 무게중심) } */
export function bakeFootPairSDF(imgOuter, imgInner, N, flip = false) {
  const RO = glyphRaster(imgOuter, N);
  const RI = imgInner ? glyphRaster(imgInner, N) : null;
  const sc = Math.min((N * SIL_FIT) / RO.w, (N * SIL_FIT) / RO.h);
  const w = RO.w * sc, h = RO.h * sc;
  const dx = (N - w) / 2, dy = (N - h) / 2;
  const bake = (R) => {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    if (flip) { g.translate(0, N); g.scale(1, -1); }
    g.drawImage(R.canvas, RO.x, RO.y, RO.w, RO.h, dx, dy, w, h);   // 크롭 창은 항상 겉 bbox
    return sdfFromAlpha(g.getImageData(0, 0, N, N).data, N);
  };
  const A = bake(RO);
  const B = RI ? bake(RI) : null;
  const data = new Float32Array(N * N * 2);
  for (let i = 0; i < N * N; i++) {
    data[i * 2] = A.data[i];
    data[i * 2 + 1] = B ? B.data[i] : 1;   // 안이 없으면 '어디도 안쪽 아님'(각인 자동 비활성)
  }
  return { data, N, cx: A.cx, cy: A.cy, inCx: B ? B.cx : A.cx, inCy: B ? B.cy : A.cy, hasInner: !!B };
}

// ── 셰이더 디코드 계수 — raw d/N(텍스처 span 기준)을 uv([-1,1]) 기준으로.
//    구 8bit 인코딩(range=N/4, 127/255)의 유효 배율 역산값. 이 계수가 빠지면
//    발형 등고선 효과 전부가 2배 폭으로 퍼짐 (실제 사고 이력 있음 — (117)).
export const SDF_DECODE = 1.9922;

// ── 실루엣이 SDF 텍스처에서 차지하는 비율 ─────────────────────────────────
//   기준 0.78 은 옛 고정값. 낮추면 실루엣이 쿼드에서 작아지고 남는 자리가 파동·헤일로 여유가 된다.
//   (유저 신고: 파동이 위아래로 잘려 좌우만 보인다 — 발이 세로로 길어 여유가 0.10 뿐이었다.)
//   호스트가 평면을 QUAD_K 배로 키워 상쇄하므로 **실제 크기는 그대로**다.
export const SIL_FIT_REF = 0.78;
export const SIL_FIT = 0.78;   // 기준치와 동일 = 지금까지와 픽셀 동일(안전 기본값)
export const QUAD_K = SIL_FIT_REF / SIL_FIT;

// ── 마크 안 숫자(글리프 오버레이) 규약 — FX Lab drawMarkNumOn 정본 수치 ──
export const MARK_NUM = {
  RATIO: 140 / 600,   // 글리프 크기 = 마크 쿼드의 0.2333배
  /** 상태별 표시 불투명도: Locked·Active·Hold=1, Preview=0.5, Success·Miss=숨김 */
  opacity(phase) {
    if (phase === 0) return 0.5;                 // Preview
    if (phase === 2 || phase === 4) return 0;    // Success · Miss
    return 1;                                    // Active · Locked · Hold · Warning
  },
  /** numFoot 앵커(0..1 텍스처 좌표, 왼발 기준 저장) → 쿼드 로컬 오프셋. right=x 미러. */
  anchor(a, right, quadSize) {
    const ax = right ? 1 - a.x : a.x;
    return { x: (ax - 0.5) * quadSize, y: (0.5 - a.y) * quadSize, s: a.s || 1 };
  },
};

// ── OKLab LUT 빌더 — "모든 것은 온도다"의 정본 (룩·시뮬이 같은 256×1 LUT를 굽는다) ──
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const l2s = c => { c = Math.max(0, Math.min(1, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); };
export function rgb2ok(r, g, b) {
  r = s2l(r); g = s2l(g); b = s2l(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function ok2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
export const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgb2hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

/** 스탑 배열 + 채도 → 256×1 RGBA LUT. out을 주면 제자리 갱신(텍스처 재업로드용). */
export function buildLUT(stops, sat = 1, out = new Uint8Array(256 * 4)) {
  const st = [...stops].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let j = 0;
    while (j < st.length - 2 && v > st[j + 1][1]) j++;
    const [c0, p0] = st[j], [c1, p1] = st[j + 1];
    const f = Math.max(0, Math.min(1, (v - p0) / Math.max(1e-5, p1 - p0)));
    const a = rgb2ok(...hex2rgb(c0)), b = rgb2ok(...hex2rgb(c1));
    const rgb = ok2rgb(a[0] + (b[0] - a[0]) * f,
                       (a[1] + (b[1] - a[1]) * f) * sat,
                       (a[2] + (b[2] - a[2]) * f) * sat);
    out.set([...rgb, 255], i * 4);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// MARK 7상태 GLSL 코어 — 룩 카탈로그(fxlab)와 라이브(tokens.js)가 같은 문자열을 포함.
//   순수 상태 함수: markState(uv, state, prog, strong, t) → vec4(빛 premultiplied, 커버리지)
//   호스트가 합성 결정: fxlab = bg*(1-a)+rgb (배경 위), 라이브 = rgb 가산광 / 주간 잉크.
//   상태 번호는 카탈로그 기준(0 Preview·1 Active·2 Hold·3 Success·4 Miss·5 Warning·6 Locked)
//   — 라이브는 자기 uPhase를 이 번호로 매핑해 호출.
//   전제: 호스트 공통부가 uW·uHalo·uNoise(float)를 선언. 여기가 uRadius·uPool·uContract·
//   uShape·uSeed·uSDF2·uSDFWarn을 선언(호스트 헤더에서 중복 선언 금지).
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 인물 영상 하단 잘림 페더 — 코치·데모 패널·고스트 공용 단일 정의.
//   크롭 창이 허벅지를 가로지르면 마스크가 프레임 하단에서 딱 끊겨 다리가 칼자국이 된다(유저 스샷).
//   ★ 열 단위 자동 판정: 그 열의 **하단 경계에 실루엣이 살아 있을 때만** 페더가 걸린다.
//     발이 프레임 안에 다 들어온 열은 botM=0 이라 손대지 않는다 —
//     '발 접지는 또렷해야 한다'(유저 확정 규칙)와 플래그 없이 양립한다.
//   페더 두께가 열마다·시간마다 아주 느리게 숨쉰다 = 은은한 애니메이션(유저).
//   호출자는 페더값을 알파뿐 아니라 '결→넓은 블러' 크로스페이드에도 먹여야 한다 —
//   그래야 흐려지며 사라지는 블러로 읽히고, 그냥 투명해지는 페이드로 안 보인다.
export const CUT_FEATHER_GLSL = `
#define CUT_BAND 0.13
// 하단 잘림 처리 — 알파로 지우는 게 아니라 **아래로 갈수록 초점이 나가며 배경에 녹는다**
//   (유저 레퍼런스: 확산 유리 실루엣). 호출자는 .y(디포커스)로 날카로운 마스크를 넓은 블러
//   쪽으로 크로스페이드하고, .x(알파)를 마지막에 곱한다. 디포커스가 알파보다 훨씬 위에서
//   시작해야 '흐려지다 녹는다'로 읽힌다 — 같이 시작하면 그냥 페이드아웃이다.
// ★ botM 은 반드시 **폭 전체 평균**이어야 한다. 열마다 판정하면 프레임 안에서 끝나는 열
//   (팔·손)만 또렷이 남아 세로로 찢어진 조각처럼 보인다 — 실제 사고(유저 스샷).
//   잘림은 프레임의 성질이지 열의 성질이 아니다.
vec2 cutFade(float x, float y, float botM, float t){
  float cut = smoothstep(0.04, 0.26, botM);   // 이 프레임이 몸을 가로질렀나
  if (cut < 0.01) return vec2(1.0, 0.0);
  // 저주파만 — x 고주파를 넣으면 그게 곧 세로 줄무늬다. 은은한 숨쉬기가 목적.
  float wob = 0.5 * sin(x * 1.7 + t * 0.45) + 0.5 * sin(t * 0.31);
  float band = CUT_BAND * (0.88 + 0.14 * wob);
  float a = smoothstep(0.0, band * 0.85, y) * (0.55 + 0.45 * smoothstep(0.0, band * 2.6, y));
  float d = smoothstep(band * 3.0, 0.0, y);
  return vec2(mix(1.0, clamp(a, 0.0, 1.0), cut), d * cut);
}`;

// 인물 색 — 바닥(demoPanel)·벽(bxPerson) 공용 단일 정의.
//   예전엔 둘이 같은 LUT를 쓰면서도 온도 곡선·채도가 달라 바닥은 주황, 벽은 빨강으로 보였다
//   (유저: "복싱 인물이랑 농구 러닝 바닥 인물 색이 너무 다르다").
//   전제: 호스트가 vec3 lut(float) 를 이미 선언한다.
// ─────────────────────────────────────────────────────────────
export const PERSON_GLSL = `
#define P_GAMMA 1.15    // 온도 곡선 (1.38은 대역을 LUT 평지로 밀어넣었다)
#define P_GAIN  0.96    // LUT 상단 여유(순백 방지)
#define P_LO    0.40    // LUT t=0~0.3 은 RED 단색 평지 — 대역 하한이 그 위여야 계조가 산다
#define P_HI    0.86
// 런타임 유니폼 — 이 GLSL 을 include 하는 호스트 3곳(바닥 코치판·데모판·벽 인물)이 전부
//   uniforms 에 선언하고 매 프레임 주입한다. 하나라도 빠지면 그 인물만 0(=무채·대역없음)이 된다.
//   uPSat   = 룩 채도. 구 '#define P_SAT 1.32' 고정값이 기본이다.
//             (여기에 백틱을 쓰면 이 GLSL 템플릿 리터럴이 끊겨 앱이 통째로 죽는다 — 실제 사고.)
//             (바닥 코치판엔 uSat 유니폼이 있었는데 셰이더 본문에서 한 번도 안 읽혔다 — 죽은 손잡이.
//              "채도 슬라이더 하나가 인물·마크 둘 다 움직인다"는 주석이 실제로는 마크만 움직였다.)
//   uPSweep = 세로 열 그라디언트 폭. **0 이면 도입 전과 픽셀 동일** — 안전한 롤백 지점.
uniform float uPSat, uPSweep;
vec3 personColor(float T){
  float t = P_LO + clamp(T, 0.0, 1.0) * (P_HI - P_LO);   // 공용 대역으로 정규화
  t = pow(t, P_GAMMA) * P_GAIN;
  vec3 c = lut(clamp(t, 0.0, 1.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, uPSat), 0.0, 1.0);
}
// 인물 룩 — 복싱·러닝·농구가 공유하는 단 하나의 톤 결정자(유저 레퍼런스: setup-injury 프로토).
//   규칙: ① 얼굴만 완전 블러(이목구비 소거) ② 몸은 옷주름·결이 살아있되 매끄럽게
//        ③ 말단·가장자리는 뽀얀 우유빛으로 빠지고 코어만 채도 높게(그라디언트)
//        ④ 어두운 덩어리 금지 — 고키. 투사광이라 검정은 곧 '빛 없음'이다.
//   thick = 두께장(블러 마스크·방사 필드, 가장자리 0 → 코어 1)
//   lumS  = 원본 휘도(선명 — 몸의 결)      lumB = 블러 휘도(얼굴용)
//   mIn   = 내부 침식 마스크               face = 얼굴 대역 가중
#define P_MILK  0.28    // 하이라이트·얼굴이 우유빛으로 빠지는 양(전신 희석 금지)
#define P_DEPTH 0.88    // 그늘이 '진해지는' 양 — 밝기가 아니라 온도로만
//   ⚠ 밝기를 깎아 그늘을 만들면 안 된다. 알파가 min(aOut, lum*1.6)로 밝기에 묶여 있어
//     어두운 옷 픽셀만 알파 0.85로 떨어지고 뒤 벽·그리드가 비친다(실측: 0.985→0.847, 유저 신고).
//     투사광에선 '어둡게' = '투명하게'다. 그래서 그늘은 LUT 상단(딥레드)으로, 하이라이트는
//     하단(샌드)으로 — 양끝 다 R≈1이라 알파는 어디서도 안 떨어진다.
#define P_TEX   3.0     // 국소 대비(옷 결·주름)를 온도로 옮기는 배율
#define P_ABS   0.18    // 절대 밝기를 반영하는 비율 — 낮을수록 클립 노출차에 둔감
#define P_PIVOT 0.34    // 대역 확장 피벗 — 코어 실사용 T(≈0.15)보다 위. 이 값 기준으로 T 가 벌어진다.
vec3 personLook(float thick, float lumS, float lumB, float mIn, float face){
  // 절대 휘도를 그대로 읽으면 클립 노출차가 곧 색차가 된다 — 밝게 찍은 러닝·농구 코치가
  //   통째로 LUT 밝은 쪽(SAND)으로 밀려 하얘졌다(유저: "왜 러닝 농구는 더 하얘?").
  //   피부색이 아니라 노출이다. 그래서 국소 평균(lumB)은 노출로 보고 대부분 상쇄하고,
  //   국소 대비(lumS - lumB)만 결로 읽는다 — 옷 주름·미묘한 톤차가 여기 다 들어있다.
  float d = (lumS - lumB) * (1.0 - face) * P_TEX;       // 얼굴은 결 제거(이목구비 은닉)
  // 소프트 새추레이션 — clamp 로 자르면 큰 대비 영역이 통째로 양 끝에 붙어 종이장처럼
  //   포스터화된다(유저 스샷). x/(1+|x|)는 작은 결은 그대로, 큰 대비만 압축한다.
  float detail = d / (1.0 + abs(d) * 1.6);
  float base = mix(0.5, lumB, P_ABS);                   // 절대 밝기는 34%만
  float shade = clamp(smoothstep(0.08, 0.80, base) + detail, 0.0, 1.0);
  float lum = mix(mix(lumS, lumB, 0.50), lumB, face);   // 우유빛 하이라이트 판정용
  // LUT 실측 방향: T=0 → RED(#FA3030) · T≈0.86 → SAND(#FEC389) · T=1 → ICE.
  //   즉 T가 낮을수록 진하다. 두꺼운 코어·그늘 = 낮은 T(진한 코랄레드),
  //   얇은 말단·하이라이트·얼굴 = 높은 T(뽀얀 살구).
  float th = smoothstep(0.25, 0.95, thick);   // 두께장 정규화 — H의 실사용 범위가 좁다
  // 코어(th=1)는 딥코랄 t≈0.42, 사지(th≈0.4)는 코랄 t≈0.60, 말단·얼굴은 뽀얀 살구.
  //   구 1.0 - th*0.60 은 두께장이 1에 못 닿는 실제 값에서 전신을 살구빛으로 띄웠다(유저).
  float T0 = 0.95 - th * 0.80 + (shade - 0.5) * P_DEPTH * mIn * (1.0 - face * 0.7) + face * 0.26;
  // 대역 확장(uPSweep) — 왜 필요한가:
  //   두께장은 블러된 실루엣이라 몸통 '안쪽'이 전부 1.0 에 포화한다. 그래서 T 가 좁은 구간
  //   (코어 ≈0.15 ~ 말단 ≈0.63)에만 앉고, 그 대부분이 LUT 중·상단(살구~샌드)이라 면적으로 보면
  //   뽀얀 색이 지배한다 — 유저가 본 "바닥 인물은 채도가 낮고 흐리멍텅".
  //   벽 인물은 T 를 세로로 0.06~0.98 훑어서 진한 레드가 큰 면적을 차지한다. 채도 배수(uPSat)는
  //   원래부터 양쪽이 같았다 — 차이는 '대역을 얼마나 쓰는가'였다.
  //   ⚠ 시도 1(기각) — 벽처럼 세로 그라디언트를 더했다. T 를 뽀얀 쪽으로만 밀어 더 창백해졌다:
  //     평균채도 0.592 → 0.568 (실측, sweep 0 → 0.8).
  //   ⚠ 시도 2(아래 구현, 기본 0) — 피벗 기준 양방향 대비 확장. 평균채도는 0.593 → 0.584 로 내려가지만
  //     국소 Δ색상은 0.581 → 0.748 (+29%) 로 올라간다. 즉 '평균 채도'가 아니라 '대비'를 벌리는 손잡이다.
  //     처음에 이걸 뭉뚱그려 기각이라고 적었는데 부정확했다 — 용도가 다른 것이었다.
  //     이유: LUT 램프(RED #FA3030 → SAND #FEC389 → ICE)는 구간마다 채도가 비슷하다. T 를 어디로
  //     옮겨도 '색상'만 바뀌고 '채도'는 안 오른다 — 대역 확장은 채도 문제의 해법이 아니었다.
  //     실제로 채도를 올리는 손잡이는 uPSat 하나뿐이다(sat 1→2 에서 0.594 → 0.636 실측).
  //   그래도 손잡이는 남긴다: 색상·명암 대비를 벌리는 용도로는 유효하고, 같은 시도의 반복을 막는다.
  //   sweep = 0 이면 gain 1.0 → 도입 전과 픽셀 동일(현재 기본값).
  float T = clamp(P_PIVOT + (T0 - P_PIVOT) * (1.0 + uPSweep * 1.6), 0.0, 1.0);
  vec3 c = personColor(T);
  // 얇은 곳(손·머리카락)과 얼굴, 그리고 하이라이트만 우유빛 — 2.2제곱이라 몸통은 거의 안 뜬다.
  float milk = clamp(pow(1.0 - clamp(thick, 0.0, 1.0), 2.2) * 0.9
                     + face * 0.9 + smoothstep(0.72, 1.00, shade) * mIn * 0.6, 0.0, 1.0);
  return clamp(mix(c, vec3(1.0, 0.95, 0.90), milk * P_MILK), 0.0, 1.0);
}`;

export const MARK_GLSL = `
uniform float uRadius, uPool, uContract, uShape, uSeed;
uniform sampler2D uSDF2, uSDFWarn;
// 깔창 각인 — 겉(신발) 안에 찍히는 맨발 자국. uSDF2.g 가 그 실루엣의 SDF.
//   uImp 0 = 완전 비활성(각인 도입 전과 픽셀 동일 — 안전한 롤백 지점)
//   uImpScale/uImpCtr: 자국을 무게중심 기준으로 축소해 깔창 여백을 만든다.
//     실측(같은 550 프레임): 신발 184×373 / 맨발 157×374 — **세로 여백이 0**(맨발이 1px 더 길다).
//     그래서 1:1 로 겹치면 발가락·뒤꿈치가 외곽선에 붙어 삐져나온 것으로 읽힌다.
//     균일 침식(sd + inset)으로 줄이면 안 된다 — 발가락 같은 작은 덩이가 먼저 소멸한다.
//     축소는 비율을 지키므로 발가락이 남는다.
//   uImpOff: 미세 이동. 축소만으로는 안 되는 국소 불일치가 있다 — 실측: 신발 발가락 박스가
//     맨발 엄지발가락보다 좁아서, 축소 0.93 에서도 **엄지 하나만** 외곽 밖으로 나갔다(8.5% 면적).
//     좌우 미러는 x 부호를 뒤집어야 하므로 호스트가 오른발에서 x 를 반전해 주입한다.
//   uImpRot: 각인 기울기(rad). 신발 실루엣과 맨발 자국은 원본에서 축이 미세하게 다르다 —
//     크기·위치만으로는 안 맞는 자리가 남아서 회전이 따로 필요하다. 좌우 미러는 부호가 뒤집힌다.
//   uImpShade: 자국 이너 섀도우 세기. 경계 **안쪽**에서 최대, 안으로 갈수록 사라진다.
//     **빛을 빼서** 만들지 않는다 — 잉크 모드에서는 알파가 줄면 바닥이 비쳐 '밝은 선'이 되고,
//     가산 모드에서는 애초에 뺄 수가 없다. 색을 얹어서 만든다(기본 흰색 = 프로토타입 규약).
//   uImpSharp: 자국 아웃라인 선명도(0 무름 ~ 1 또렷). AA 폭과 도트 가장자리 페이드를 같이 조인다.
//   uImpShadeCol · uRipCol: 팔레트 색 선택(0 흰 · 1 샌드 · 2 코랄 · 3 레드) — 새 색은 안 만든다.
uniform float uImp, uImpPitch, uImpDot, uImpGlow, uImpEdge, uImpScale, uImpRot, uImpShade, uImpSharp, uImpShadeCol;
uniform vec2 uImpCtr, uImpOff;
// 파동(리플) — 실루엣 **등거리선**을 따라 퍼진다. uRip 0 = 도입 전과 픽셀 동일.
//   유저 지적: 지금 파동이 단순 원형 파장이라 발자국 위에서 따로 놀고, 퍼짐이 과하거나 쨍하다.
//   부호거리로 몰면 파면이 형태를 따라간다 — 발형은 발 모양, 원형은 원. 토큰이 늘어도 파동은 하나다.
//   uRipGrad: 파동을 단색 대신 **뉴턴 LUT 그라디언트**로. 0 = 단색(uRipCol) · 1 = 완전 LUT.
//     갓 나온 파면이 상단(백열)이고 퍼질수록 하단(적)으로 식는다 — "모든 것은 온도다" 규약을
//     파동에도 그대로 적용한 것. 색을 새로 만드는 게 아니라 있는 LUT 를 훑는다.
uniform float uRip, uRipSpeed, uRipWidth, uRipReach, uRipCol, uRipGrad;
// ── 족저 압력장 · 등고선 ────────────────────────────────────────────────────
//   유저 레퍼런스: Nike Free 압력맵 / 인솔 프레셔 맵. 핵심은 색이 아니라 **색을 정하는 입력**이다.
//   지금까지는 '중심에서의 거리'였다 — 그래서 아무리 색을 풍부하게 해도 압력 분포가 아니라
//   그라디언트 칠한 원반으로 읽혔다(유저: 너무 도형 같다 · 섬세한 미학이 없다).
//   uPlantar: 압력장 혼합(0 = 옛 방사 · 1 = 압력장). 발형은 해부학 핫스팟, 원형은 중심 압력.
//   uBands:   등고선 단계 수(0 = 연속). 레퍼런스의 계단 밴드가 '데이터'로 읽히게 하는 장치.
//   uBandSoft: 밴드 경계 무름(0 = 칼금 · 1 = 뭉근).
uniform float uPlantar, uBands, uBandSoft;
// uSilFit: 실루엣이 쿼드에서 차지하는 비율(기준 0.78 대비). 1 = 옛 그대로.
//   ext·해부학 좌표는 '0.78 로 구웠을 때' 기준의 uv 값이라, 채움비가 바뀌면 같이 줄어야 한다.
uniform float uEdgeShade, uEdgeW, uEdgeSoft, uDither, uSilFit;
/** 압력 0~1 (1 = 최고압). 발형은 자국 깊이 × 해부학 가중, 원형은 중심이 최고압.
 *  좌표는 uv[-1,1]. 오른발은 실루엣 SDF 자체가 미러라 별도 분기가 필요 없다. */
float plantar(vec2 pQ, float sdIn, float sd){
  // 해부학 좌표는 채움비 0.78 기준으로 잡은 값이라, 쿼드가 넓어지면 되돌려 읽어야 자리가 맞는다.
  vec2 p = pQ / max(uSilFit, 0.05);
  float blob;
  if (uShape < 0.5) {                       // 존 원 — 해부학이 없다. 중심 압력 + 약한 비대칭.
    float r = length(p) / max(0.46 * uRadius, 1e-3);
    return clamp(1.0 - r * r * 0.92, 0.0, 1.0);
  }
  // 압력장은 **신발 전체**에 깔린다. 자국 깊이만 쓰면 자국 바깥(신발 안)이 전부 압력 0 =
  //   최저 대역으로 깔려서 그라디언트가 실루엣의 일부만 덮는다(유저 지적).
  //   겉(신발) 깊이가 바탕이고, 자국 안쪽이 실제 접지라 그 위에서 압력이 올라간다.
  float dShoe = clamp(-sd / 0.30, 0.0, 1.0);
  float dFoot = clamp(-sdIn / 0.13, 0.0, 1.0);
  float depth = dShoe * (0.42 + 0.58 * dFoot);
  // 해부학 핫스팟: 앞꿈치 볼(최대) · 뒤꿈치(중간) · 엄지(부분). 레퍼런스의 적/황 자리.
  vec2 b = (p - vec2(0.02, 0.30)) / vec2(0.34, 0.20);  float ball = exp(-dot(b, b));
  vec2 h = (p - vec2(0.00, -0.44)) / vec2(0.26, 0.22); float heel = exp(-dot(h, h));
  vec2 g = (p - vec2(0.17, 0.56)) / vec2(0.15, 0.13);  float toe  = exp(-dot(g, g));
  vec2 a = (p - vec2(-0.13, -0.02)) / vec2(0.22, 0.26); float arch = exp(-dot(a, a));
  blob = 0.30 + 1.00 * ball + 0.62 * heel + 0.50 * toe - 0.34 * arch;
  return clamp(depth * blob, 0.0, 1.0);
}
/** 윤곽선 — **두 겹**이다: 얇고 또렷한 코어 라인 + 그 밖으로 넓게 풀리는 소프트.
 *  한 겹 가우시안(exp(-(sd/w)^2))은 굵기만 있고 위계가 없어 투박하다(유저: 촌스러운 아웃라인).
 *  코어 폭에 fwidth 하한을 둬 어느 배율에서도 1~2px 로 유지되고, 소프트가 그 밖을 받아
 *  '칼로 자른 띠'가 아니라 그려진 선으로 읽힌다. */
float edgeLine(float sd, float w){
  float fw = max(fwidth(sd), 1e-5);
  float cw = max(w * 0.42, 1.4 * fw);
  float sw = max(w * 2.30, 3.2 * fw);
  float c = exp(-pow(abs(sd) / cw, 2.0));
  float s = exp(-pow(abs(sd) / sw, 1.5));
  return clamp(c + s * 0.30, 0.0, 1.0);
}
/** 등고선 — 연속 온도를 N단으로 계단화하되 경계는 무르게. 0이면 그대로 통과. */
float contour(float t){
  if (uBands < 0.5) return t;
  float n = floor(uBands + 0.5);
  float s = t * n;
  float f = fract(s);
  // ★ 화면공간 하한 — 고정 uv 무름만 두면 확대할수록 밴드 경계가 계단으로 드러난다(유저: 면으로 드드득).
  float aa = max(fwidth(s), 1e-5) * 1.25;
  float soft = max(clamp(uBandSoft, 0.02, 1.0) * 0.5, aa);
  return (floor(s) + smoothstep(0.5 - soft, 0.5 + soft, f)) / n;
}
// 색 = src/palette.js 단일 소스. 유채는 4색뿐(규칙 ①), 무채는 상태 부호(규칙 ②).
//   은퇴: C_CREAM(#FEE2C6 — 팔레트에 없던 9번째 색) → SAND
//         C_WINE·C_BRICK(암적) → SAND·CORAL  (유저: 워닝에 어두운색 금지)
//         C_EXCL(#EE2827) → RED · C_RIMG(미세 웜그레이) → 무채 lo 로 통합
#define C_RED   ${vec3(PAL.red)}
#define C_CORAL ${vec3(PAL.coral)}
#define C_SAND  ${vec3(PAL.sand)}
#define C_ICE   ${vec3(PAL.prism)}
#define C_CREAM C_SAND
#define C_GRAYF ${vec3(NEU.hi)}
#define C_GRAYL ${vec3(NEU.lo)}
#define C_RIMG  C_GRAYL
#define C_WINE  C_SAND
#define C_BRICK C_CORAL
#define C_EXCL  C_RED
/** 팔레트 색 선택 — 유채는 4색뿐이라는 규칙(palette.js ①)을 셰이더에서도 그대로 강제한다.
 *  0 흰(PRISM) · 1 샌드 · 2 코랄 · 3 레드. 인덱스 밖은 흰색으로 떨어진다.
 *  ★ 반드시 위 #define C_* 뒤에 와야 한다 — 앞에 두면 색 상수가 아직 없어 셰이더가 통째로 죽는다. */
vec3 palPick(float i){
  return i < 0.5 ? C_ICE : i < 1.5 ? C_SAND : i < 2.5 ? C_CORAL : C_RED;
}
/** 디더용 자립 해시 — 호스트의 fxhash 에 기대면 fxlab·parity 처럼 자체 공통부를 쓰는 곳에서
 *  셰이더가 통째로 죽는다(실제로 죽였다). MARK_GLSL 은 lut 외에는 자립해야 한다. */
float mkHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mkUndul(float ang, float t){
  return sin(ang*2.0 + t*1.1)*0.45 + sin(ang*3.0 - t*0.73 + 1.7)*0.33 + sin(ang*5.0 + t*0.41 + 4.2)*0.22;
}
// 일반화 부호 거리 — 존 원 / 발형이 같은 상태 머신을 공유 (1.9922 = float SDF 디코드 정본 계수)
float mkSD(vec2 p, float u1){
  if (uShape < 0.5) return length(p) * (1.0 + u1 * uNoise * 0.04) - 0.46 * uRadius;
  vec2 suv = p * 0.5 + 0.5;
  return texture2D(uSDF2, vec2(suv.x, 1.0 - suv.y)).r * 1.9922 / max(uRadius, 0.3) + u1 * uNoise * 0.02;
}
// 안쪽(맨발 자국) 부호거리 — 겉과 **같은 프레임**에서 구운 G 채널이라 좌표 변환이 필요 없다.
//   일렁임(u1)은 안 얹는다: 각인은 프린트라 겉 윤곽처럼 숨쉬면 '두 장이 따로 논다'로 읽힌다.
float mkSDIn(vec2 p){
  float s = max(uImpScale, 0.05);
  // 샘플 좌표라 변환은 전부 **역방향**이다 — 자국을 +θ 로 돌려 보이려면 좌표를 −θ 로 돌린다.
  vec2 d = p - uImpOff - uImpCtr;
  float ca = cos(uImpRot), sa = sin(uImpRot);
  d = vec2(d.x * ca + d.y * sa, -d.x * sa + d.y * ca);
  vec2 q = d / s + uImpCtr;                         // s<1 → 더 바깥을 읽으므로 자국이 작아진다
  vec2 suv = q * 0.5 + 0.5;
  // 거리에 s 를 되곱해야 p 공간의 참 거리가 된다 — 안 곱하면 축소할수록 AA·글로우 폭이 함께 부푼다
  return texture2D(uSDF2, vec2(suv.x, 1.0 - suv.y)).g * 1.9922 / max(uRadius, 0.3) * s;
}
/** 필 램프 좌표 0..1 — 존 원은 중심거리, **발형은 실루엣 안쪽 깊이(sd)**.
 *  발 위에 원형 그라디언트를 씌우면 발가락·아치·뒤꿈치가 램프를 가로질러 잘려서
 *  '빨간 원에 발 마스크를 덮은 얼룩'으로 읽힌다(유저: 발자국 퀄리티·튄다).
 *  깊이 기반이면 빛이 실루엣을 따라 고여서 발 모양 자체가 읽힌다. */
float mkR(vec2 uv, vec2 gc, float scale, float sd){
  float r = length(uv - gc) / max(scale, 1e-4);
  // 깊이가 주(主), 중심 거리는 종(從) — 무게중심 이동(Hold 뒤꿈치 고임·Success 블룸)은 남긴다.
  float base = uShape < 0.5 ? r : clamp(mix(clamp(1.0 + sd / 0.40, 0.0, 1.0), r, 0.28), 0.0, 1.4);
  if (uPlantar < 0.001) return base;
  // 압력장으로 갈아탄다 — q 는 '차가운 정도'라 1-압력이다. 그 위에 등고선을 씌운다.
  float pr = plantar(uv, mkSDIn(uv), sd);
  return contour(clamp(mix(base, 1.0 - pr, clamp(uPlantar, 0.0, 1.0)), 0.0, 1.4));
}
// OKLab 지각 보간 — RGB mix는 중간톤이 회색으로 죽어 '종이 자르듯 턱턱'(유저). OKLab은 채도 유지하며 부드럽게.
// (buildLUT의 rgb2ok/ok2rgb와 동일 규약: 입력을 그대로 OKLab으로 — LUT와 색 일관)
vec3 _l2ok(vec3 c){
  float l=0.4122214708*c.r+0.5363325363*c.g+0.0514459929*c.b;
  float m=0.2119034982*c.r+0.6806995451*c.g+0.1073969566*c.b;
  float s=0.0883024619*c.r+0.2817188376*c.g+0.6299787005*c.b;
  l=pow(max(l,0.0),0.33333333); m=pow(max(m,0.0),0.33333333); s=pow(max(s,0.0),0.33333333);
  return vec3(0.2104542553*l+0.7936177850*m-0.0040720468*s,
              1.9779984951*l-2.4285922050*m+0.4505937099*s,
              0.0259040371*l+0.7827717662*m-0.8086757660*s);
}
vec3 _ok2l(vec3 lab){
  float l=lab.x+0.3963377774*lab.y+0.2158037573*lab.z;
  float m=lab.x-0.1055613458*lab.y-0.0638541728*lab.z;
  float s=lab.x-0.0894841775*lab.y-1.2914855480*lab.z;
  l=l*l*l; m=m*m*m; s=s*s*s;
  return vec3(4.0767416621*l-3.3077115913*m+0.2309699292*s,
             -1.2684380046*l+2.6097574011*m-0.3413193965*s,
             -0.0041960863*l-0.7034186147*m+1.7076147010*s);
}
vec3 okmix(vec3 a, vec3 b, float t){ return _ok2l(mix(_l2ok(a), _l2ok(b), t)); }
// ── 필 램프 = 뉴턴 LUT 한 벌 ────────────────────────────────────────────────
//   예전엔 상태마다 손으로 짠 2~3스톱 okmix 였다(Preview 는 CORAL→SAND 딱 2스톱).
//   그래서 ① 스톱 사이 smoothstep 이음매가 띠로 보이고 ② 쓰는 색이 2개뿐이라 단색처럼 읽혔다
//   (유저: "부드럽지 않은 그라디언트 + 색이 풍부하지 않다"). 정작 이 프로젝트 원칙은
//   "모든 것은 온도다 — 하나의 LUT를 공유"인데 MARK 필만 그 밖에 있었다.
//   LUT 는 OKLab 으로 256스텝 보간해 구운 것이라 이음매가 원천적으로 없고 4색을 다 지난다.
//   상태의 정체성은 이제 색 조합이 아니라 **온도 창(lo~hi)** 이 정한다.
#define T_PREV_LO 0.30
#define T_PREV_HI 0.99
#define T_HOT_LO  0.10
#define T_HOT_HI  1.00
#define T_ACT_LO  0.06
#define T_ACT_HI  1.00
#define T_HOLD_LO 0.04
#define T_HOLD_HI 0.97
// 온도 → 색. **뉴턴 LUT 한 벌만** 쓴다.
vec3 fillT(float q, float lo, float hi){
  float x = clamp(mix(lo, hi, clamp(q, 0.0, 1.0)), 0.0, 1.0);
  // ★ 밴딩(유저: 드드득)의 정체는 등고선이 아니라 **LUT 가 8비트 256단계**라는 것이다.
  //   원처럼 넓고 완만한 그라디언트에서는 인접 단계 사이가 눈에 보이는 띠가 된다.
  //   화면공간 해시로 조회 좌표를 1단계 미만 흔들면 띠가 잡티로 흩어져 사라진다(디더링 정석).
  x = clamp(x + (mkHash(gl_FragCoord.xy) - 0.5) * uDither, 0.0, 1.0);
  // 뉴턴 LUT 만 쓴다 — 유채는 RED·CORAL·SAND·PRISM 4색뿐이라는 규칙 ①(palette.js).
  //   압력맵용 별도 계열 램프를 넣었다가 유저 지적으로 되돌렸다. 다시 만들지 말 것.
  return lut(x);
}
vec3 fillPreview(float q){ return fillT(q, T_PREV_LO, T_PREV_HI); }
vec3 fillHot(float q){     return fillT(q, T_HOT_LO,  T_HOT_HI);  }
vec3 fillActive(float q){  return fillT(q, T_ACT_LO,  T_ACT_HI);  }
vec3 fillHold(float q){    return fillT(q, T_HOLD_LO, T_HOLD_HI); }
// Success 는 코어가 가장 뜨겁고(하한이 낮다) 바깥이 백열로 열린다 — 승리의 온도.
// 상한을 1.0(순백) 이 아니라 0.92 로 — 순백까지 열면 코어와 분리된 흰 링이 생긴다(유저: 아이스 과함).
vec3 fillSuccess(float q){ return fillT(q, 0.03, 1.00); }
// over 연산 누적 (premultiplied) — 원본 mix(col, X, k) 체인의 기계적 등가 변환
void lay(inout vec4 A, vec3 X, float k){ A.rgb = A.rgb * (1.0 - k) + X * k; A.a = A.a * (1.0 - k) + k; }
vec4 markState(vec2 uv, float state, float prog, float strong, float t){
  // ★ GLSL pow(x,y) 는 x<0 에서 정의되지 않는다(대개 NaN). 아래 Success·Miss 분기는
  //   pow(1.0 - prog, ...) · pow(1.0 - (prog-0.4)/0.6, ...) 처럼 prog 로 밑을 만든다.
  //   구동자가 prog 를 1 을 아주 살짝 넘겨 주면(1.0000002) 밑이 음수 → NaN 이 나오고,
  //   NaN 은 색·알파를 타고 흘러 판 전체를 rgba(0,0,0,255) 로 만든다.
  //   야간(가산)에선 0 이 더해져 안 보이지만, 주간 잉크(NormalBlending)에선 알파가 채워져
  //   그 자리를 통째로 검게 지운다 — 유저가 다섯 번 신고한 '드리블 중 검정 판'의 실체.
  prog = clamp(prog, 0.0, 1.0);
  float ang = atan(uv.y, uv.x);
  float a01 = fract(0.25 - ang / 6.2832);      // 12시 기준 시계방향
  float u1 = mkUndul(ang + uSeed, t * 1.6);
  float sd = mkSD(uv, u1);
  float aa = max(fwidth(sd), 0.004) * 1.4;     // 화면공간 AA
  float inside = smoothstep(aa, -aa, sd);
  // 필 전용 소프트 엣지 — 우리 UI 의 강점은 그라디언트의 부드러움인데, 하드 마스크가 경계에
  //   선을 그어 원반처럼 보이게 했다(유저). 안쪽으로 uEdgeW 만큼 페더링해 형태가 색으로 읽히게.
  float feath = smoothstep(0.0, max(uEdgeW, 1e-4), -sd);
  float inFill = mix(inside, inside * feath, clamp(uEdgeSoft, 0.0, 1.0));
  float outPos = max(sd, 0.0);
  // 점선 = 회피 계약 (일렁임과 분리한 저주기 — '털 뜯김' 방지 확정판)
  float dashM = (uContract > 0.5 && uContract < 1.5)
              ? smoothstep(0.30, 0.60, 0.5 + 0.5 * sin(ang * 10.0)) : 1.0;
  float sf = max(uSilFit, 0.05);
  float ext = uShape < 0.5 ? 0.46 * uRadius : 0.72 * sf;
  vec2 gcBall = uShape < 0.5 ? vec2(0.0) : vec2(0.0, 0.20) * sf;
  vec2 gcHeel = uShape < 0.5 ? vec2(0.0, -0.5 * ext) : vec2(0.0, -0.32) * sf;
  vec4 A = vec4(0.0);
  // Hold 진행 아크는 **이너 섀도우 뒤에** 얹어야 한다 — 섀도우가 훨씬 넓고 밝아서 얇은 림을
  //   덮어버리고, 삐져나온 조각만 남아 '떠 있는 초승달' 로 읽혔다(유저 확대 스샷).
  float holdA = 0.0; vec3 holdC = vec3(0.0);
  float fillGain = clamp(uPool * 1.6, 0.0, 1.35);

  if (state < 0.5) {            // ── Preview: 아웃라인 → 소프트 필 차오름 (strong=라이브 '다음' 적열 강조)
    float f = prog;
    float breath = 1.0 + 0.05 * sin(t * 2.0) * (0.4 + uNoise);
    // 중심 핫스팟 완화(유저 재지적: 가운데 원 또렷) — 하한↑ + 폴오프 넓혀 부드러운 전이(하드 원 제거)
    // 하한(0.36)은 옛 방사 그라디언트의 중앙 핫스팟을 눌러 두려던 것이다. 압력장에선 중앙이
    //   이미 부드러우므로 그 하한이 램프 상단(고압)을 통째로 잘라 먹는다 — 켜지면 걷어낸다.
    float q = mix(0.36, 0.02, clamp(uPlantar, 0.0, 1.0)) + (1.0 - mix(0.36, 0.02, clamp(uPlantar, 0.0, 1.0))) * mkR(uv, gcBall, ext * 1.18 * breath, sd);
    vec3 fillCol = mix(C_CREAM, mix(fillPreview(q), fillHot(q), strong), f);
    float fillA = mix(0.42, 0.82, f) * fillGain;
    lay(A, fillCol, fillA * inFill);
    // 아웃라인 폐기(유저 지시) — 형태는 아래 이너 섀도우가 잡는다. Hold 진행 림만 예외.

  } else if (state < 1.5) {     // ── Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 타이밍)
    float gradR = uShape < 0.5 ? ext * 1.75 : 2.15;   // 폴오프 넓힘 = 중앙 적열 원 완화(유저)
    float qf = mix(0.34, 0.02, clamp(uPlantar, 0.0, 1.0));
    float q = qf + (1.0 - qf) * mkR(uv, gcBall, gradR, sd);    // 중심 하한↑ — 적열이 은은하게 퍼짐
    q *= 1.0 + 0.025 * sin(t * 3.1 + q * 5.0) * uNoise;
    lay(A, fillActive(q), inFill * min(fillGain * 1.15, 1.0));
    // 헤일로 폭: 발형은 실루엣이 얇아 존 원과 같은 폭이면 윤곽을 통째로 삼킨다(유저: 튄다)
    float hw = max((uShape < 0.5 ? 0.115 - 0.075 * prog : 0.062 - 0.040 * prog) * uW, 0.014);
    // 헤일로는 필의 **연장**이다 — 예전엔 SAND→ICE 별도 로브를 위에 얹어서 실루엣 경계에
    //   색이 튀는 띠(유저: "아이스링 경계가 너무 세서 하나로 자연스럽게 안 이어진다")가 생겼다.
    //   같은 LUT 를 필의 상한(T_ACT_HI)에서 이어받아 1.0 까지 올리면 경계에서 색이 연속이다.
    //   감쇠도 지수 1.3(어깨가 각짐) → 2.0 가우시안으로 바꿔 꼬리가 부드럽게 풀린다.
    float hk = clamp(outPos / max(hw, 1e-4), 0.0, 3.0);
    float h = exp(-hk * hk * 0.9) * (1.0 - inside);
    // ★ 헤일로 꼭대기를 LUT 1.0(순백)까지 올리지 않는다 — 그게 '과한 아이스'의 실체였다.
    //   0.90 에서 멈추면 흰 링이 아니라 뜨거운 모래빛 잔광이 되고, 필과 계속 한 몸으로 읽힌다.
    //   세기도 0.50 → 0.34 로. 밝기로 존재감을 내면 형태가 먹힌다.
    vec3 hCol = lut(clamp(mix(T_ACT_HI, 0.90, smoothstep(0.0, 1.6, hk)), 0.0, 1.0));
    lay(A, hCol, h * uHalo * (0.34 + 0.10 * sin(t * 5.0)) * dashM);
  } else if (state < 2.5) {     // ── Hold: 코닉 진행 림 + 열이 뒤꿈치로 고임
    float pr = prog;
    vec2 gc = mix(gcBall, gcHeel, pr);
    float q = mkR(uv, gc, ext * 1.02, sd);
    float qh = max(q - 0.24 * pr, 0.0);
    lay(A, fillHold(qh), inFill * min(fillGain, 1.0) * 0.95);
    // 림을 실루엣 **안쪽**으로 — 예전엔 sd-0.012 라 원 밖으로 삐져나와 초승달이 얹힌 것처럼 보였다.
    float distToRim = abs(sd + 0.010);
    float fw = max(fwidth(sd), 1e-5);
    // 림 폭: 카탈로그 20px(고정 캔버스) ≡ 실루엣 비례 sd 0.03 — 화면 크기가 가변인
    // 라이브에서도 같은 비율. 원거리 앨리어싱만 fwidth 하한.
    float rimW = max(0.03 * uW, 1.5 * fw);
    // 림 단면을 선형 컷 → 가우시안으로. 예전엔 폭 끝에서 값이 뚝 끊겨 '칼로 자른 모서리'로 보였다.
    float rn  = distToRim / max(rimW, 1e-5);
    float rim = exp(-rn * rn * 1.6) * dashM;
    float angDist = a01 - pr; angDist -= floor(angDist + 0.5);   // 랩어라운드 제거
    // 선단 앞은 빠르게 꺼지고 뒤(지나온 쪽)는 길게 남는다 — 대칭 페이드는 양끝이 똑같이 잘린다.
    // 선단은 부드럽게 꺼지고, **시작점(a01=0)** 도 페이드한다 — 예전엔 시작에 페이드가 아예 없어
    //   12시 자리에서 대각으로 뚝 잘렸다(유저 확대 스샷). 진행 끝(pr 근처)도 같이 테이퍼.
    // 양끝 페이드를 길게 — 27도(0.075)면 민트에서 빨강으로 급히 갈아타 칼금으로 보인다(유저).
    //   시작 72도(0.20) · 선단 120도(0.34)에 걸쳐 풀면 어디서 시작하고 끝나는지가 안 보인다.
    float pgo = smoothstep(0.34, 0.04, angDist) * smoothstep(0.0, 0.20, a01) * smoothstep(0.0, 0.03, pr);
    // 아크 색도 LUT — 지나온 쪽이 식고 선단이 뜨겁다(필과 같은 온도 언어)
    // 진행은 **밝기**로 읽힌다 — 붉은 필 위에 붉은 아크를 얹으면 대비가 안 난다.
    //   지나온 쪽이 LUT 상단(민트)이고 아직인 쪽은 무채 트랙이다.
    // 지나온 쪽이 **진한 빨강**(LUT 저역)이고 선단으로 갈수록 민트로 달아오른다.
    //   0.86~1.0 로 잡았다가 빨강이 통째로 사라졌다(유저 지적) — 저역부터 열어야 한다.
    vec3 arcCol = lut(clamp(mix(0.02, 1.0, clamp(a01 / max(pr, 0.001), 0.0, 1.0)), 0.0, 1.0));
    holdC = mix(C_RIMG, arcCol, pgo);
    holdA = rim * mix(0.22, 0.82, pgo);   // 최대 알파도 낮춰 아래 섀도우와 섞이게
    // 진행 선단 = 밝은 '시계 바늘' — 12시서 시계방향으로 도는 게 명확히 읽히게(유저: 타이머처럼 싹)
    //   선단도 가우시안으로 — smoothstep 은 폭 끝에서 각이 진다.
    float hd = abs(angDist) / 0.11;
    float head = exp(-hd * hd) * step(0.01, pr) * step(pr, 0.995);
    holdC = mix(holdC, lut(1.0), clamp(head, 0.0, 1.0));
    holdA = max(holdA, rim * head * 0.95);
  } else if (state < 3.5) {     // ── Success: 진홍 블룸 → 잔상 소멸
    float e = 1.0 - pow(1.0 - prog, 2.6);
    float q = mkR(uv, gcBall, uShape < 0.5 ? ext * 1.3 : 1.75, sd);
    float fillA = (prog < 0.4 ? 1.0 : pow(1.0 - (prog - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    lay(A, fillSuccess(q / (0.55 + 0.55 * e)), inFill * fillA);
    float flash = exp(-prog * 9.0);
    // 성공 섬광 — 예전엔 순 ICE 0.8 이라 흰 띠가 코어와 분리돼 보였다(유저: 아이스가 과하다).
    //   LUT 상단(0.88)으로 낮추고 세기도 절반 — 필의 온도 연장이라 경계가 안 생긴다.
    // 섬광 아웃라인 폐기 — 이너 섀도우가 대신한다

  } else if (state < 4.5) {     // ── Miss: 온기가 식어 회색 고스트 → 무음 소멸
    float cool = smoothstep(0.0, 0.4, prog);
    float gone = pow(1.0 - max(prog - 0.45, 0.0) / 0.55, 1.6);
    float q = mkR(uv, gcBall, ext, sd);
    lay(A, mix(fillPreview(q), C_GRAYF, cool), inFill * mix(0.55, 0.24, cool) * gone * fillGain);


  } else if (state < 5.5) {     // ── Warning: 사구→코랄 리니어 + 느낌표 점멸 (유저: 어두운색 금지 → 암적 폐기)
    float ly = clamp(0.5 - uv.y / (2.2 * ext), 0.0, 1.0);
    // 워닝도 같은 램프를 쓴다 — 예전엔 SAND→CORAL 세로 선형이라 혼자 다른 그림이었다(유저: 촌스러움).
    lay(A, fillT(mix(ly, mkR(uv, gcBall, ext * 1.1, sd), 0.55), 0.10, 0.72), inFill * min(fillGain * 1.05, 1.0));
    float wScale = 0.44 * ext;
    vec2 wuv = uv / wScale * 0.5 + 0.5;
    float wSD = texture2D(uSDFWarn, vec2(wuv.x, 1.0 - wuv.y)).r * (2.0 * wScale);
    float aaW = max(fwidth(wSD), 0.0015);
    float exM = smoothstep(aaW, -aaW, wSD) * inside;
    lay(A, C_EXCL * 1.25, exM * (0.85 + 0.15 * sin(t * 5.5)));
  } else {                       // ── Locked: 회색 아웃라인 + (숫자는 호스트 오버레이)
    lay(A, C_GRAYF, inFill * 0.30 * fillGain);


  }
  // ── 실루엣 이너 섀도우 (아웃라인 대체) ──────────────────────────────────
  //   유저 지시: 아웃라인은 전부 빼고(Hold 진행 림만 남김) 이너 섀도우로 세련되게.
  //   선을 긋지 않고 **경계 안쪽을 눌러** 형태를 만든다. 그리는 선이 없으니 '촌스러운 아웃라인'이
  //   원천적으로 생기지 않고, 부드러운 그라디언트라는 이 UI 의 강점과 같은 언어가 된다.
  //   색은 압력 램프의 **저역**(가장 어두운 쪽)이라 색과 형태가 한 몸이다 — 따로 노는 회색 선이 아니다.
  if (uEdgeShade > 0.001) {
    float ins = exp(-pow(max(-sd, 0.0) / max(uEdgeW * 0.9, 1e-4), 1.1)) * inside;
    // 섀도우 색 = LUT 상단(PRISM · 하얀 민트). 빛으로 그리는 매체에서 어두운 색을 얹으면
    //   그건 그림자가 아니라 때다 — 이미 밝고 화사한 팔레트라 밝은 쪽으로 눌러야 형태가 산다(유저).
    lay(A, lut(1.0), ins * uEdgeShade);
  }
  if (holdA > 0.001) lay(A, holdC, holdA);   // 진행 아크를 섀도우 위로 — 덮이지 않게
  // ── 깔창 각인 (발형 전용) ────────────────────────────────────────────────
  //   유저 레퍼런스: 나이키 깔창 — 매끈한 깔창 외곽 **안**에 맨발 압력 자국이 도트로 프린트.
  //   구성: 겉(R 채널)이 토큰 본체·상태를 그리고, 안(G 채널)이 그 위에 무늬로 얹힌다.
  //   ★ 새 색을 만들지 않는다 — 정본 팔레트(CREAM·ICE)만 밝기로 얹는다(유채 4색 규칙).
  //   ★ 상태를 침범하지 않는다 — 각인은 '무늬'라서 Preview~Locked 어디서든 같은 그림이고,
  //     세기만 상태 알파(A.a)를 따라간다. 상태마다 다른 각인을 주면 토큰이 두 종류가 된다.
  if (uShape > 0.5 && uImp > 0.001) {
    float sdIn = mkSDIn(uv);
    // 아웃라인 선명도 — uImpSharp 1 이면 AA 를 화면 최소폭까지 조여 '깔끔하게 잘린' 경계가 된다.
    // 무름 범위를 크게 넓힌다 — 예전엔 sharp 0.75 에서 계수가 1 이라 사실상 1픽셀 칼금이었다(유저).
    //   경계를 sd 단위로도 풀어야 확대해도 부드럽다: 화면 AA 만으로는 항상 1px 경계다.
    float aaI  = max(max(fwidth(sdIn) * mix(3.4, 0.9, clamp(uImpSharp, 0.0, 1.0)),
                         mix(0.055, 0.004, clamp(uImpSharp, 0.0, 1.0))), 0.0015);
    float inIn = smoothstep(aaI, -aaI, sdIn) * inside;   // 신발 안 ∩ 맨발 안
    float pit  = max(uImpPitch, 0.008);
    // 도트 격자 — 프로토타입 foot-*-dots.svg 규약: 정사각 격자, 점 지름 = 피치의 50%
    //   (실측: 간격 1.8px · 지름 0.9px on 48px 폭). 그래서 uImpDot 기본 0.25(=반지름/피치).
    vec2  cc  = fract(uv / pit) - 0.5;
    float dd  = length(cc) * pit;
    float rad = pit * clamp(uImpDot, 0.03, 0.5);
    float dAA = max(fwidth(dd), 1e-5) * 1.2;
    float dSoft = max(pit * mix(0.34, 0.12, clamp(uImpSharp, 0.0, 1.0)), dAA);
    float dotM = smoothstep(rad + dSoft, rad - dSoft, dd);
    // 자국 안쪽 깊이 — 가장자리는 옅고 안으로 갈수록 또렷(프린트 잉크가 고인 느낌).
    //   전면 균일하게 찍으면 도트가 실루엣을 무시하고 격자만 보인다.
    //   선명하게 갈수록 램프도 같이 좁아져야 한다 — 안 그러면 경계만 또렷하고 안쪽이 무르다.
    float depR = mix(0.185, 0.018, clamp(uImpSharp, 0.0, 1.0));
    float dep = smoothstep(0.0, depR, -sdIn);
    // 가장자리에서 0.34 로 남으면 도트 영역이 그 밝기로 뚝 끊긴다 — 0 까지 내려 배경과 어우러지게.
    lay(A, C_CREAM, inIn * dotM * uImp * (0.06 + 0.94 * dep));
    // 이너 섀도우 — 경계 **안쪽**에서 최대, 안으로 갈수록 사라진다. 자국이 '눌려 들어간' 자리로 읽힌다.
    //   빛을 빼지 않는다(위 uImpShade 주석): LUT 저역(RED)을 얹어 어느 바닥에서도 그림자로 읽히게.
    if (uImpShade > 0.001) {
      float ins = exp(-pow(max(-sdIn, 0.0) / max(uImpEdge, 1e-4), 1.15)) * inIn;
      lay(A, palPick(uImpShadeCol), ins * uImpShade * uImp);
    }
    // 윤곽 글로우는 이제 선택 사항(기본 0) — 이너 섀도우가 경계를 만드는 쪽이 정본이다.
    if (uImpGlow > 0.001) {
      float rimIn = exp(-pow(abs(sdIn) / max(uImpEdge, 1e-4), 1.6)) * inside;
      lay(A, C_ICE, rimIn * uImpGlow * uImp);
    }
  }
  // ── 파동(리플) — 윤곽에서 바깥으로 나아가는 한 겹의 파면 ────────────────────
  //   outPos = max(sd,0) 이라 파면은 실루엣 **바깥**으로만 간다(안쪽 필을 안 건드린다).
  //   fade 로 퍼질수록 옅어져야 '은은하게'가 된다 — 등속·등세기면 그게 곧 '쨍함'이다.
  // ── 파동은 **상태가 정한다** ──────────────────────────────────────────────
  //   전 상태에 같은 파동을 얹으면 아무 뜻도 안 된다(유저 지적). 상태마다 말하는 게 다르다:
  //     Hold    = 진행에 따라 서서히 차오르는 연속 파면 (유지가 쌓인다)
  //     Success = 한 번 터지고 끝나는 단발 (진행이 곧 파면 위치 — 반복하지 않는다)
  //     나머지  = 없음. Active 의 타이밍은 헤일로 수축이 이미 말하고 있다.
  float ripAmt = 0.0, ripCyc = 0.0, ripK = 1.0;
  if (state > 1.5 && state < 2.5) {          // Hold — 차오름
    ripAmt = uRip * (0.20 + 0.80 * prog);
    ripCyc = fract(t * max(uRipSpeed, 0.01) + uSeed * 0.159);
  } else if (state > 2.5 && state < 3.5) {   // Success — 단발
    ripAmt = uRip * 1.6;
    ripCyc = clamp(prog / 0.80, 0.0, 1.0);
    ripK   = 1.9;                            // 더 멀리 나간다 ('팡')
  }
  if (ripAmt > 0.001) {
    // 시각은 인자 t 로 받는다 — 호스트가 uTime 을 MARK_GLSL 뒤에 선언하므로 여기선 못 쓴다.
    float cyc = ripCyc;
    float front = cyc * uRipReach * ripK;
    float band = exp(-pow((outPos - front) / max(uRipWidth, 1e-3), 2.0));
    // 온도: 갓 나온 파면이 뜨겁고(상단) 퍼질수록 식는다(하단). band 로 파면 중심을 한 겹 더 달군다.
    float lt  = clamp(0.34 + (1.0 - cyc) * 0.52 + band * 0.22, 0.0, 1.0);
    vec3  rc  = mix(palPick(uRipCol), lut(lt), clamp(uRipGrad, 0.0, 1.0));
    lay(A, rc, band * pow(1.0 - cyc, 1.6) * ripAmt * 0.5 * dashM);
  }
  // NaN 스크럽 — 위 분기 어디서든 비정상 값이 새면 '보이지 않음'으로 떨어뜨린다.
  //   NaN 과의 비교는 항상 false 이므로 step() 이 0 을 골라 준다(GLSL ES 1.0 에서 신뢰 가능한 유일한 방법).
  //   투사 UI 는 가산광이라 '없음'이 안전한 기본값이다 — 검은 판보다 백 배 낫다.
  A *= step(vec4(-1.0), A) * step(A, vec4(1e6));
  return A;
}`;

// ═══ 파생 프리미티브 정본 (FX Lab drawPrims 승격 — 랩·라이브가 같은 코드로 그린다) ═══
//   ENV = { arrow: {line,w,speed,gap,glow,heat,tail}, lut: v→cssColor,
//           num?: (g,ch,x,y,size,fontPx)→void, foot?: (g,right,x,y,size)→void }
//   look = { core, halo, wobble } (MARK 상속) — 파생은 스타일을 부모에게서 상속(위계 원칙).
export function applyLineStyle(g, AW, flowT, ENV) {
  g.lineWidth = 4 * AW;
  const A2 = ENV.arrow;
  if (A2.line === 'dash') g.setLineDash([12 * AW * A2.gap, 10 * A2.gap]);
  else if (A2.line === 'dot') { g.setLineDash([0.5, 12 * A2.gap]); g.lineCap = 'round'; g.lineWidth = 5 * AW; }
  else g.setLineDash([]);
  if (flowT != null && A2.line !== 'solid' && A2.line !== 'taper') g.lineDashOffset = -flowT * 40 * A2.speed;
}
/** LINE 정본 화살표 — 테이퍼 스템 + SVG 촉 draw-on.
 *  유저 확정 디자인 = 러닝 A3 '리프트 큐 2안'. 랩 프리뷰·지면 화살표가 이 함수 하나를 공유한다
 *  (예전엔 랩은 캔버스 스트로크, 시뮬은 LANEFX 셰이더로 따로 그려서 룩을 바꿔도 모양이 안 맞았음).
 *  캔버스 좌표: 스템은 아래(H)에서 위(0)로 자라고 촉이 꼭짓점에 붙는다 → +Y가 전방.
 *  ENV = { lut(v), glyph(ctx, slot, x, y, sizePx, opts)->bool, arrow{w,glow,speed,heat} }
 *  opts.prog: 외부 구동(0..1). 없으면 자체 draw-on 루프. */
export function drawStemArrow(g, W, H, t, ENV, opts = {}) {
  const lut = ENV.lut, A = ENV.arrow || {};
  const AW = A.w ?? 1, speed = A.speed ?? 1, glowK = A.glow ?? 1;
  const pulse = opts.pulse ?? 1;
  const s = H / 256;                                  // 기준 캔버스(128×256) 대비 스케일
  const cx = W / 2;
  const ph = (t * 0.9 * speed) % 1;
  // draw-on을 0.55에 끝내고 나머지는 '완성된 화살표'로 머문다. 예전엔 0.7까지 자라며 촉이 0.9 전까지
  // 안 나와서, 자라는 동안 잘린 막대처럼 보였음(유저: '중간에 나오다가 잘리는 애들').
  const draw = opts.prog != null ? Math.max(0, Math.min(1, opts.prog)) : Math.min(1, ph / 0.55);
  const fade = opts.prog != null ? 1 : (ph > 0.88 ? (1 - ph) / 0.12 : 1);
  g.clearRect(0, 0, W, H);
  const A0 = fade * (0.45 + 0.55 * pulse);
  const y0 = H - 24 * s, y1 = 58 * s, yEnd = y0 + (y1 - y0) * draw;
  // 스템 = 폴리곤 + 세로 그라디언트 한 번. 예전의 '세그먼트 스트로크 반복'은 라운드캡이 겹쳐
  // 구슬처럼 뭉치고 뿌리도 덜 사라졌음(유저: 출발 끝을 더 투명하게). 폭 테이퍼는 폴리곤이,
  // 소멸은 알파 그라디언트가 담당 — 뿌리 알파 0에서 시작해 위로 갈수록 뜨거워진다.
  const rgba = (v, a) => lut(v).replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`);
  const w0 = 1.1 * s * AW, w1 = 13 * s * AW;          // 뿌리 폭(거의 0) → 꼭짓점 폭
  const grad = g.createLinearGradient(0, y0, 0, yEnd);
  // 뿌리는 알파 0으로 사라지되(유저 확정) 몸통은 금방 진해진다 — 예전 램프(0.10/0.38)는 스템 대부분이
  // 반투명이라 지면에 투사하면 통째로 흐려 보였음(유저: 화살표가 왜 이렇게 흐려졌어).
  grad.addColorStop(0.00, rgba(0.55, 0));
  grad.addColorStop(0.10, rgba(0.64, 0.45 * A0));
  grad.addColorStop(0.32, rgba(0.76, 0.85 * A0));
  grad.addColorStop(0.62, rgba(0.88, 0.98 * A0));
  grad.addColorStop(1.00, rgba(0.97, A0));
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx - w0 / 2, y0); g.lineTo(cx + w0 / 2, y0);
  g.lineTo(cx + w1 / 2, yEnd); g.lineTo(cx - w1 / 2, yEnd);
  g.closePath(); g.fill();
  g.globalAlpha = A0;
  if (draw > 0.28 && !opts.noTip) {   // noTip = 촉 없는 자루(감속 바 등)
    // 촉은 '자라는 머리'에 항상 붙는다(고정 위치 X) → 자라는 동안에도 화살표로 읽힌다.
    const tipS = 34 * s * (0.7 + 0.3 * AW);   // 촉 크기(유저 3회 축소) — 스템:촉 비율 정본
    const tipA = Math.min(1, (draw - 0.28) / 0.22) * A0;
    const ty = yEnd + tipS * 0.30;                     // 머리보다 살짝 뒤 = 촉 끝이 스템 끝과 맞음
    g.globalAlpha = tipA;
    const go = { color: lut(0.95), glowColor: lut(0.85), glow: 12 * glowK };
    const ok = ENV.glyph && (ENV.glyph(g, 'LIFT_TIP', cx, ty, tipS, go)
                          || ENV.glyph(g, 'TIP_TRI', cx, ty, tipS * 0.93, go));
    if (!ok) {                                        // 글리프 미로드 폴백 = 같은 비율 스트로크 촉
      g.strokeStyle = lut(0.95); g.lineWidth = 13 * s * AW; g.lineCap = 'round'; g.lineJoin = 'round';
      g.shadowColor = lut(0.9); g.shadowBlur = 18 * s * glowK;
      g.beginPath(); g.moveTo(cx - 26 * s, ty + 14 * s); g.lineTo(cx, ty - 16 * s); g.lineTo(cx + 26 * s, ty + 14 * s); g.stroke();
    }
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
}

/** 곡선 화살표 — LINE 정본(스템+촉)의 경로 버전. 유저 가이드 스케치의 '궤적 표시':
 *  출발 원(반대편 지면)에서 시작해 곡선으로 흘러 들린 발마크로 들어가고, 머리에 같은 촉 글리프가 붙는다.
 *  pts01 = [[x,y],...] 정규화 캔버스 좌표(0..1, y는 아래로). 2차/3차 무관 — 통과점을 카트멀롬 보간.
 *  opts.prog = 진행도(0..1). 스템과 같은 언어: 뿌리 알파 0 → 머리 최대. */
export function drawCurveArrow(g, W, H, pts01, t, ENV, opts = {}) {
  const lut = ENV.lut, A = ENV.arrow || {};
  const AW = A.w ?? 1, glowK = A.glow ?? 1;
  const s = H / 256;
  g.clearRect(0, 0, W, H);
  const P = pts01.map(([x, y]) => [x * W, y * H]);
  if (P.length < 2) return;
  // 카트멀롬 샘플링(끝점 복제) — 통과점이 2개면 직선
  const N = 48, path = [];
  const at = (u) => {
    if (P.length === 2) return [P[0][0] + (P[1][0] - P[0][0]) * u, P[0][1] + (P[1][1] - P[0][1]) * u];
    const q = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(q)), f = q - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
  };
  for (let i = 0; i <= N; i++) path.push(at(i / N));
  const prog = Math.max(0, Math.min(1, opts.prog != null ? opts.prog : ((t * 0.55) % 1)));
  const head = Math.max(1, Math.round(N * prog));
  // 선 — 뿌리 알파 0 → 머리 최대 (스템과 같은 페더 언어)
  g.lineCap = 'round';
  for (let i = 1; i <= head; i++) {
    const k = i / head;
    g.globalAlpha = Math.pow(k, 1.5);
    g.strokeStyle = lut(0.45 + 0.5 * k);
    g.lineWidth = (1.6 + 3.2 * k) * s * AW;
    g.beginPath(); g.moveTo(path[i - 1][0], path[i - 1][1]); g.lineTo(path[i][0], path[i][1]); g.stroke();
  }
  // 촉 — 머리에서 접선 정렬(글리프 규약 ↑=전방)
  if (prog > 0.25) {
    const hx = path[head][0], hy = path[head][1];
    const px = path[Math.max(0, head - 2)][0], py = path[Math.max(0, head - 2)][1];
    const ang = Math.atan2(hy - py, hx - px) + Math.PI / 2;
    const tipS = 30 * s * (0.7 + 0.3 * AW);
    g.save(); g.translate(hx, hy); g.rotate(ang); g.globalAlpha = Math.min(1, (prog - 0.25) / 0.2);
    const go = { color: lut(0.95), glowColor: lut(0.85), glow: 12 * glowK };
    if (!(ENV.glyph && (ENV.glyph(g, 'LIFT_TIP', 0, 0, tipS, go) || ENV.glyph(g, 'TIP_TRI', 0, 0, tipS * 0.93, go)))) {
      g.strokeStyle = lut(0.95); g.lineWidth = 9 * s * AW; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-18 * s, 12 * s); g.lineTo(0, -14 * s); g.lineTo(18 * s, 12 * s); g.stroke();
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

export function strokeFlowPath(g, pts, t, AW, opts, ENV) {
  opts = opts || {};
  const lut = ENV.lut;
  const style = opts.style || ENV.arrow.line;
  const closed = !!opts.closed;
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1] || 1;
  const at = (d) => {
    d = ((d % total) + total) % total;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const f = (d - L[i - 1]) / Math.max(1e-4, L[i] - L[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
            pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
            Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])];
  };
  const A = ENV.arrow;
  if (style === 'chevron') {
    const gap = (26 * AW + 8) * A.gap;
    const n = Math.max(2, Math.floor(total / gap));
    g.shadowColor = lut(Math.min(1, A.heat + 0.2)); g.shadowBlur = 8 * AW * A.glow;
    for (let k = 0; k < n; k++) {
      const d = k * gap + (t * 42 * A.speed) % gap;
      if (!closed && d > total - 4) continue;
      const [x, y, a] = at(d);
      const w = 7.5 * AW, h = 8.5 * AW;
      const glow = 0.45 + 0.4 * Math.sin((d / total) * 6.283 - t * 2.2 * A.speed);
      g.strokeStyle = lut(A.heat - 0.05 + glow * 0.3);
      g.lineWidth = 3.2 * AW; g.lineJoin = 'round'; g.lineCap = 'round';
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(-h * 0.5, -w); g.lineTo(h * 0.5, 0); g.lineTo(-h * 0.5, w); g.stroke();
      g.restore();
    }
    return true;
  }
  if (style === 'comet') {
    const head = (t * 0.35 * A.speed % 1) * total;
    const tail = total * A.tail;
    const seg = Math.max(24, pts.length * 2);
    g.lineCap = 'round';
    for (let k = 0; k < seg; k++) {
      const d0 = head - (k / seg) * tail, d1 = head - ((k + 1) / seg) * tail;
      if (!closed && d1 < 0) break;
      const f = 1 - k / seg;
      const [x0, y0] = at(d0), [x1, y1] = at(d1);
      if (!closed && Math.hypot(x1 - x0, y1 - y0) > total * 0.4) continue;
      g.globalAlpha = Math.pow(f, 1.6);
      g.strokeStyle = lut(Math.max(0.05, A.heat - 0.2) + f * 0.55);
      g.lineWidth = (1.5 + f * 4.5) * AW;
      if (f > 0.72) { g.shadowColor = lut(Math.min(1, A.heat + 0.3)); g.shadowBlur = f * 12 * AW * A.glow; }
      else g.shadowBlur = 0;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.globalAlpha = 1; g.lineCap = 'butt'; g.shadowBlur = 0;
    const [hx, hy] = at(head);
    g.fillStyle = rgba(NEU.ink, 0.95);
    g.shadowColor = lut(0.9); g.shadowBlur = 16 * AW;
    g.beginPath(); g.arc(hx, hy, 2.6 * AW, 0, 7); g.fill();
    g.shadowBlur = 0;
    return true;
  }
  g.strokeStyle = opts.color || lut(A.heat);
  g.shadowColor = lut(Math.min(1, A.heat + 0.15)); g.shadowBlur = (opts.glow ?? 8) * AW * A.glow;
  if (style === 'taper') {
    for (let i = 1; i < pts.length; i++) {
      g.lineWidth = (0.5 + (i / pts.length) * 4.5) * AW;
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    }
  } else {
    applyLineStyle(g, AW, t, ENV);
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    if (closed) g.closePath();
    g.stroke();
  }
  g.setLineDash([]); g.lineCap = 'butt'; g.lineDashOffset = 0; g.shadowBlur = 0;
  return true;
}
/** 스탠스 박스 — 서는 영역 (LINE 상속 둘레 + FOOT 글리프) */
export function drawStanceBox(g, W, P, look, t, ENV) {
  const GB = 13 * look.halo;
  const lut = ENV.lut;
  g.clearRect(0, 0, W, W); g.lineJoin = 'round';
  const s = W / 220, C = W / 2;
  const rr = 18 * P.round * s;
  const bx0 = 40 * s, by0 = 48 * s, bw = W - 80 * s, bh = W - 96 * s;
  const box = [];
  const edge = (x0, y0, x1, y1) => { for (let f = 0; f <= 1; f += 0.12) box.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]); };
  edge(bx0 + rr, by0, bx0 + bw - rr, by0); edge(bx0 + bw, by0 + rr, bx0 + bw, by0 + bh - rr);
  edge(bx0 + bw - rr, by0 + bh, bx0 + rr, by0 + bh); edge(bx0, by0 + bh - rr, bx0, by0 + rr);
  g.shadowColor = lut(0.6); g.shadowBlur = GB * 0.8;
  const LNW = 4 * ENV.arrow.w * s;
  if (ENV.arrow.line === 'solid') {
    g.setLineDash([10 * P.dash * s, 8 * s]); g.lineDashOffset = -t * 22 * s;
    g.strokeStyle = lut(0.45); g.lineWidth = LNW;
    g.beginPath(); g.roundRect(bx0, by0, bw, bh, rr); g.stroke();
    g.setLineDash([]); g.lineDashOffset = 0;
  } else {
    strokeFlowPath(g, box, t, ENV.arrow.w * s, { color: lut(0.45), closed: true }, ENV);
  }
  // 유지 진행 = 테두리 자체가 차오른다(P.prog 0..1). 박스 안에 원형 게이지를 따로 놓으면
  //   형태 언어가 어긋난다(유저: "가드 박스인데 안에 동그란 원이 있으니 어색").
  //   ★ 차오르는 것도 **도트를 유지한 채** 차야 한다(유저) — 실선으로 채우면 테두리가 딴 물건이 된다.
  //     그래서 '긴 대시 하나'가 아니라, 상단 중앙에서 시계방향으로 진행 길이만큼 잘라낸 **부분 경로**를
  //     원래 도트 패턴으로 긋는다. 점 개수가 늘어나며 한 바퀴를 채운다.
  if (P.prog != null && P.prog > 0.001) {
    const pts = [];
    const line = (x0, y0, x1, y1, n) => { for (let i = 1; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    const arc = (cx0, cy0, a0, a1, n) => { for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx0 + rr * Math.cos(a), cy0 + rr * Math.sin(a)]); } };
    const HP = Math.PI / 2, xR = bx0 + bw, yB = by0 + bh, cxm = bx0 + bw / 2;
    pts.push([cxm, by0]);
    line(cxm, by0, xR - rr, by0, 8);
    arc(xR - rr, by0 + rr, -HP, 0, 6);
    line(xR, by0 + rr, xR, yB - rr, 10);
    arc(xR - rr, yB - rr, 0, HP, 6);
    line(xR - rr, yB, bx0 + rr, yB, 14);
    arc(bx0 + rr, yB - rr, HP, Math.PI, 6);
    line(bx0, yB - rr, bx0, by0 + rr, 10);
    arc(bx0 + rr, by0 + rr, Math.PI, Math.PI + HP, 6);
    line(bx0 + rr, by0, cxm, by0, 8);
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const want = total * Math.min(1, P.prog);
    g.save();
    g.setLineDash([10 * P.dash * s, 8 * s]);   // 바탕 테두리와 같은 도트 리듬
    // 위상 맞춤 — 바탕은 roundRect(좌상단 시작)에 -t*22*s 로 흐르고, 이 경로는 상단 중앙에서 시작한다.
    //   시작점 차이(bw/2 − rr)를 빼 주지 않으면 밝은 점이 바탕 점 사이에 앉아 두 겹으로 보인다.
    g.lineDashOffset = -(bw / 2 - rr) - t * 22 * s;
    g.strokeStyle = lut(0.9); g.lineWidth = LNW * 1.3; g.lineCap = 'round';
    g.shadowColor = lut(0.92); g.shadowBlur = GB * 1.3;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    let acc = 0;
    for (let i = 1; i < pts.length && acc < want; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + d <= want) { g.lineTo(pts[i][0], pts[i][1]); acc += d; }
      else { const f = (want - acc) / d; g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f); acc = want; }
    }
    g.stroke();
    g.setLineDash([]);
    g.restore();
  }
  if (P.feet > 0.05 && ENV.foot) {
    ENV.foot(g, false, C - 16 * P.feet * s, C + 6 * s, 26 * P.feet * s);
    ENV.foot(g, true, C + 16 * P.feet * s, C + 6 * s, 26 * P.feet * s);
  }
  g.shadowBlur = 0;
}
/** 펀치 라인 — 콤보 연결·순서 (노드=MARK 상속 링, 선=LINE, 숫자=GLYPH). prog 0..1(콤보 진행) */
export function drawPunchLine(g, W, P, look, t, ENV, ptsIn, prog) {
  const GB = 13 * look.halo;
  const LNW = 4 * ENV.arrow.w * (W / 220);
  const lut = ENV.lut;
  g.clearRect(0, 0, W, W); g.lineJoin = 'round';
  const s = W / 220;
  const pts = ptsIn || [[45 * s, 130 * s], [110 * s, 60 * s], [175 * s, 110 * s]];
  const cyc = prog != null ? prog : (t * 0.5) % 1;
  const pr = Math.min(1, cyc * 1.25) * (pts.length - 1);
  const cur = Math.min(pts.length - 1, Math.floor(pr + 0.35));
  g.shadowColor = lut(0.7); g.shadowBlur = GB;
  const passed = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i <= pts.length - 1; i++) {
    const seg = Math.max(0, Math.min(1, pr - (i - 1)));
    if (seg <= 0) break;
    passed.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * seg,
                 pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * seg]);
  }
  if (passed.length > 1) strokeFlowPath(g, passed, t, ENV.arrow.w * s, { color: lut(0.62) }, ENV);
  g.setLineDash([4 * s, 7 * s]); g.lineDashOffset = 0; g.globalAlpha = 0.3;
  g.strokeStyle = lut(0.45); g.lineWidth = LNW;
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  g.globalAlpha = 1; g.setLineDash([]); g.lineCap = 'butt'; g.lineDashOffset = 0;
  pts.forEach(([x, y], i) => {
    const active = i === cur;
    const pulse = active ? 1 + Math.sin(t * 6) * 0.14 : 1;
    g.strokeStyle = lut(active ? 0.8 : 0.45);
    g.lineWidth = LNW * (active ? 1.3 : 0.9);
    g.shadowBlur = active ? GB * 1.6 : GB * 0.6;
    g.beginPath(); g.arc(x, y, 12 * P.node * pulse * s, 0, Math.PI * 2); g.stroke();
    if (ENV.num) {
      g.globalAlpha = i <= cur ? 1 : 0.45;
      ENV.num(g, String(i + 1), x, y, 16 * P.numS * pulse * s, Math.round(14 * P.numS * s));
      g.globalAlpha = 1;
    }
  });
  g.shadowBlur = 0;
}
/** 어프로치 링 — 타이밍 토큰(파생). 시스템 공통 언어(소프트 열 글로우·파문)로 통일 —
 *  하드 지오메트리 없이, 부드러운 글로우 링이 바깥 R → 타겟 Rt로 '수축'(뒤에 파문 에코 잔상),
 *  타겟과 맞물리는 순간 = 동작 타이밍 → 소프트 핑이 퍼진다. prog 0..1(비트). 색은 룩 LUT만. */
export function drawApproachRing(g, W, P, look, t, ENV, prog) {
  const lut = ENV.lut, GB = 13 * look.halo, s = W / 220, C = W / 2;
  const AW = (ENV.arrow && ENV.arrow.w) || 1;
  const rgba = (v, a) => lut(v).replace('rgb(', 'rgba(').replace(')', `,${a})`);
  g.clearRect(0, 0, W, W); g.lineJoin = 'round'; g.lineCap = 'round';
  const R = (P.r != null ? P.r : 0.42) * W;                 // 접근 시작(최외곽) 반경
  const Rt = R * (P.rt != null ? P.rt : 0.36);              // 타겟 반경(수축 도착점)
  const lw = 3.4 * AW * s;
  const p = prog != null ? Math.max(0, Math.min(1, prog)) : (t * (P.tempo || 0.6)) % 1;
  const e = Math.pow(p, 1.6);                               // 가속 진입 = 기대감 상승
  const lock = Math.max(0, (p - 0.9) / 0.1);               // 도착 순간 = 비트

  g.save(); g.translate(C, C);
  // 볼류메트릭 글로우 링 — radial gradient 밴드(부피감 있는 발광) + 크리스프 코어(정의).
  //   shadowBlur 스트로크보다 부드럽고 프리미엄한 발광 폴오프. 형태는 순수 원(시스템 공통 언어).
  const glowRing = (r, v, a, wMul = 1) => {
    if (r <= 0.6) return;
    const w = lw * 2.6 * wMul, inner = Math.max(0.1, r - w), outer = r + w;
    const grad = g.createRadialGradient(0, 0, inner, 0, 0, outer);
    grad.addColorStop(0, rgba(v - 0.05, 0));
    grad.addColorStop(0.5, rgba(v, a * 0.85));
    grad.addColorStop(1, rgba(v - 0.05, 0));
    g.globalAlpha = 1; g.fillStyle = grad; g.shadowBlur = 0;
    g.beginPath(); g.arc(0, 0, outer, 0, Math.PI * 2); g.fill();
    g.globalAlpha = Math.min(1, a * 1.1); g.lineWidth = lw * 0.85;
    g.strokeStyle = lut(Math.min(0.98, v + 0.12)); g.shadowColor = lut(0.88); g.shadowBlur = GB * 0.6;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  };

  // 타겟 존 — 내부 풀 글로우(soft radial fill, 잠금 때 차오름) + 링(은은한 호흡)
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, Rt * 1.08);
  pool.addColorStop(0, rgba(0.6, 0.10 + 0.18 * lock));
  pool.addColorStop(0.65, rgba(0.5, 0.05 + 0.08 * lock));
  pool.addColorStop(1, rgba(0.5, 0));
  g.globalAlpha = 1; g.fillStyle = pool; g.beginPath(); g.arc(0, 0, Rt * 1.08, 0, Math.PI * 2); g.fill();
  const breath = 1 + 0.02 * Math.sin(t * 2.6);
  glowRing(Rt * breath, 0.55 + 0.4 * lock, 0.5 + 0.45 * lock, 0.9);

  // 수축 링(주역) — R→Rt. 실키 트레일(2겹 후행 잔상) + 히트업(접근할수록 밝고 하얗게)
  for (let k = 2; k >= 0; k--) {
    const pe = Math.pow(Math.max(0, p - k * 0.05), 1.6);   // k>0 = 살짝 이전(바깥) 위치 = 잔상
    const rr = R - (R - Rt) * pe;
    const a = k === 0 ? (0.6 + 0.4 * e) : (0.18 / k) * (1 - lock);
    glowRing(rr, 0.55 + 0.4 * e, a * (1 - lock * 0.45), 1.15 - 0.35 * e);
  }

  // 잠금 — 팽창 블룸 핑(밖으로 퍼지며 소멸)
  if (lock > 0.01) glowRing(Rt * (1 + 1.4 * lock), 0.9, (1 - lock) * 0.8, 1.1);

  // 중심 핍 — 히트업
  g.globalAlpha = 0.6 + 0.3 * lock; g.shadowColor = lut(0.85); g.shadowBlur = GB * (0.9 + lock);
  g.fillStyle = lut(0.62 + 0.3 * lock);
  g.beginPath(); g.arc(0, 0, lw * 0.85 + 3 * s * lock, 0, Math.PI * 2); g.fill();

  g.restore();
  g.globalAlpha = 1; g.shadowBlur = 0;
}
/** 궤적 — 동작 경로 토큰(파생). 동작이 지나갈 곡선 경로를 빛으로 '그리며' 코멧 헤드가 훑고,
 *  꼬리는 테이퍼+페이드(라이트페인팅), 헤드엔 블룸+스파크. LINE 광류 언어의 대형 궤적 확장.
 *  prog 0..1 = 헤드가 경로 시작→끝. ptsIn = 정규[-1,1] 제어점(팩 실동작 좌표로 대체 가능). */
export function drawTrajectory(g, W, P, look, t, ENV, prog, ptsIn) {
  const lut = ENV.lut, GB = 13 * look.halo, s = W / 220, C = W / 2;
  const AW = (ENV.arrow && ENV.arrow.w) || 1, base = AW * s;
  const rgba = (v, a) => lut(v).replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
  g.clearRect(0, 0, W, W); g.lineJoin = 'round'; g.lineCap = 'round';
  const sc = W * 0.42 * (P.spread != null ? P.spread : 1);
  const ctrl = ptsIn || [[-0.95, 0.5], [-0.48, -0.42], [0, -0.8], [0.48, -0.42], [0.95, 0.5]];   // 매끈한 대칭 아크
  const CP = ctrl.map(([x, y]) => [C + x * sc, C + y * sc]);
  const N = 80, path = [];
  for (let i = 0; i <= N; i++) {                         // Catmull-Rom 스플라인 샘플(부드러운 곡선)
    const u = i / N * (CP.length - 1), k = Math.min(CP.length - 2, Math.floor(u)), f = u - k;
    const a = CP[Math.max(0, k - 1)], b = CP[k], c = CP[k + 1], d = CP[Math.min(CP.length - 1, k + 2)];
    const cr = (A, B, Cc, D) => 0.5 * (2 * B + (-A + Cc) * f + (2 * A - 5 * B + 4 * Cc - D) * f * f + (-A + 3 * B - 3 * Cc + D) * f * f * f);
    path.push([cr(a[0], b[0], c[0], d[0]), cr(a[1], b[1], c[1], d[1])]);
  }
  const at = u => { const q = Math.max(0, Math.min(N, u * N)), i = Math.floor(q), f = q - i, a = path[i], b = path[Math.min(N, i + 1)]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
  // ── 사이클: 스윕(경로를 그림) → 소멸(끝 도착 후 꼬리가 헤드로 수렴하며 페이드=증발) → 빈 갭 → 반복.
  //    prog 주어지면 스윕만(세션 비트 구동). null이면 데모 루프가 전체 사이클을 돈다.
  const SW = 0.68;
  let sweep, outA, catchUp;
  if (prog != null) { sweep = Math.max(0, Math.min(1, prog)); outA = 1; catchUp = 0; }
  else {
    const c = (t * (P.tempo || 0.42)) % 1;
    if (c < SW) { sweep = c / SW; outA = 1; catchUp = 0; }
    else { const o = (c - SW) / (1 - SW); sweep = 1; outA = 1 - o * o; catchUp = o; }
  }
  if (outA <= 0.012) return;                                 // 완전 소멸 = 빈 프레임(자연 갭)
  const headU = sweep * sweep * sweep * (sweep * (6 * sweep - 15) + 10);   // smootherstep 휘핑
  const spd = Math.min(1, 16 * sweep * sweep * (1 - sweep) * (1 - sweep)); // 속도(중앙 최대, 끝=0)
  const taper = P.taper != null ? P.taper : 1.6;
  const tail = 0.36 * (P.tail != null ? P.tail : 1);
  const wid = P.width != null ? P.width : 1;

  // 1) 경로 힌트 — 아주 옅은 넓은 글로우(어디로 갈지 암시만). 예전엔 경로 전체에 '균일 알파'라
  //    꼬리 끝에도 같은 농도의 뿌연 자국이 남았다(유저: 끝 연한 부분을 아예 알파 0으로).
  //    양 끝이 0으로 스러지는 그라디언트로 바꿔 자국 없이 빠진다.
  {
    const hg = g.createLinearGradient(path[0][0], path[0][1], path[N][0], path[N][1]);
    hg.addColorStop(0.00, rgba(0.46, 0));
    hg.addColorStop(0.30, rgba(0.46, 0.030 * outA));
    hg.addColorStop(0.80, rgba(0.46, 0.045 * outA));
    hg.addColorStop(1.00, rgba(0.46, 0));
    g.globalAlpha = 1; g.strokeStyle = hg; g.lineWidth = 9 * base;
    g.shadowColor = lut(0.6); g.shadowBlur = GB * 2.0;
    g.beginPath(); path.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.shadowBlur = 0;
  }

  // 2) 리본 — 헤드(앞)는 진하고 또렷, 꼬리로 갈수록만 연해지고 흐려져 소멸(끝만 흐릿).
  const M = 40, u0 = Math.max(0, headU - tail * (1 - catchUp)), win = [];
  for (let i = 0; i <= M; i++) win.push(at(u0 + (headU - u0) * (i / M)));
  const ribbon = () => { g.beginPath(); win.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const grad = () => { const gr = g.createLinearGradient(win[0][0], win[0][1], win[M][0], win[M][1]);
    // 꼬리 40%는 완전 투명 — 끝이 '연하게 남는' 게 아니라 없어진다(유저).
    gr.addColorStop(0, rgba(0.55, 0)); gr.addColorStop(0.40, rgba(0.56, 0));
    gr.addColorStop(0.68, rgba(0.60, 0.09)); gr.addColorStop(0.88, rgba(0.64, 0.24));
    gr.addColorStop(1, rgba(0.68, 0.44)); return gr; };
  const spr = 1 + 0.5 * spd;
  // 소프트 글로우(꼬리 투명→헤드 진함) — 꼬리쪽만 흐릿한 잔상. 벽 투사용으로 두툼하게.
  g.globalAlpha = outA; g.strokeStyle = grad(); g.lineWidth = (20 + 10 * spd) * base * wid;
  g.shadowColor = lut(0.72); g.shadowBlur = GB * 2.2; ribbon();
  g.strokeStyle = grad(); g.lineWidth = (10 + 5 * spd) * base * wid; g.shadowBlur = GB * 1.0; ribbon(); g.shadowBlur = 0;
  // 또렷한 코어 — 두툼·균일(smooth) → 꼬리로만 알파·폭 감소. 앞은 진한 선, 끝은 흐릿 소멸.
  for (let i = 1; i <= M; i++) {
    const f = i / M;
    g.globalAlpha = Math.pow(f, 2.2) * 0.95 * outA; g.strokeStyle = lut(0.55 + 0.38 * f);   // 지수↑ = 꼬리가 더 빨리 0으로
    g.lineWidth = (1.6 + 6.5 * Math.pow(f, 0.7)) * base * wid * spr;
    g.beginPath(); g.moveTo(win[i - 1][0], win[i - 1][1]); g.lineTo(win[i][0], win[i][1]); g.stroke();
  }

  // 3) 헤드 = 코멧 헤드(헤일로 + 흰 코어). 이 토큰의 정의가 'LINE 광류 + 코멧 헤드 + 스파크'다 —
  //    한때 LINE 촉 글리프로 바꿨더니 글리프 미로드 시 글로우만 남아 뭉개진 공이 됐다(유저 지적).
  const hx = win[M][0], hy = win[M][1];
  g.globalAlpha = 0.8 * outA; g.fillStyle = lut(0.6); g.shadowColor = lut(0.8); g.shadowBlur = GB * 1.6;
  g.beginPath(); g.arc(hx, hy, (9 + 5 * spd) * base * wid, 0, Math.PI * 2); g.fill();
  g.globalAlpha = outA; g.fillStyle = lut(0.93); g.shadowBlur = GB * 0.6;
  g.beginPath(); g.arc(hx, hy, (3.4 + 1.8 * spd) * base * wid, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1; g.shadowBlur = 0;
}
/** 회전 — 관절 돌리기 토큰(파생). 관절(피벗) 둘레를 곡선 화살촉이 도는 회전 화살표 + 가이드 링.
 *  '목·어깨 돌리기'처럼 회전 동작을 명확히 지시. dir: 1=시계 · -1=반시계. prog/tempo로 회전. */
export function drawRotate(g, W, P, look, t, ENV, prog) {
  const lut = ENV.lut, GB = 13 * look.halo, s = W / 220, C = W / 2;
  const AW = (ENV.arrow && ENV.arrow.w) || 1;
  g.clearRect(0, 0, W, W); g.lineJoin = 'round'; g.lineCap = 'round';
  const R = (P.r != null ? P.r : 0.3) * W;
  const wid = (P.width != null ? P.width : 1), lw = 4.2 * AW * s * wid;
  const dir = (P.dir != null ? P.dir : 1);
  const arcLen = (P.sweep != null ? P.sweep : 0.66) * Math.PI * 2;   // 밝은 호(꼬리) 길이
  const p = prog != null ? Math.max(0, Math.min(1, prog)) : (t * (P.tempo || 0.5)) % 1;
  const head = -Math.PI / 2 + dir * p * Math.PI * 2;                // 12시에서 dir 방향으로 회전

  g.save(); g.translate(C, C);
  // 가이드 링(희미) — 회전 경로
  g.globalAlpha = 0.16; g.lineWidth = lw * 0.7; g.strokeStyle = lut(0.44);
  g.shadowColor = lut(0.6); g.shadowBlur = GB * 0.4;
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  // 회전 호 — 선단 밝음 → 꼬리 페이드(모션). dir 방향으로 도는 게 곧 '돌리기'.
  const seg = 16;
  for (let i = 0; i < seg; i++) {
    const f = i / (seg - 1), a = head - dir * f * arcLen, b = head - dir * (f + 1.2 / seg) * arcLen;
    g.globalAlpha = (1 - f) * 0.9; g.strokeStyle = lut(0.55 + 0.35 * (1 - f));
    g.lineWidth = lw * (0.55 + 0.55 * (1 - f)); g.shadowColor = lut(0.8); g.shadowBlur = GB * (0.4 + 0.5 * (1 - f));
    g.beginPath(); g.arc(0, 0, R, Math.min(a, b), Math.max(a, b), false); g.stroke();
  }
  g.shadowBlur = 0;
  // 선단 화살촉 — 접선 방향(회전 방향 지시). LINE 3토큰이 같은 촉 SVG를 쓴다(글리프 없으면 스트로크 폴백).
  const hx = Math.cos(head) * R, hy = Math.sin(head) * R, tang = head + dir * Math.PI / 2;
  const ah = 8 * s * wid;
  g.save(); g.translate(hx, hy); g.rotate(tang + Math.PI / 2);   // 글리프 규약 ↑=전방 → +90°
  g.globalAlpha = 1;
  const tipS = 3.4 * ah * (0.7 + 0.3 * AW);
  const go = { color: lut(0.96), glowColor: lut(0.9), glow: GB * 1.2 };
  if (!(ENV.glyph && (ENV.glyph(g, 'LIFT_TIP', 0, 0, tipS, go) || ENV.glyph(g, 'TIP_TRI', 0, 0, tipS * 0.93, go)))) {
    g.rotate(-Math.PI / 2);   // 폴백 스트로크는 전방 +x 기준
    g.strokeStyle = lut(0.96); g.lineWidth = lw * 0.9; g.shadowColor = lut(0.9); g.shadowBlur = GB * 1.2;
    g.beginPath(); g.moveTo(-ah, -ah * 0.9); g.lineTo(ah * 0.5, 0); g.lineTo(-ah, ah * 0.9); g.stroke();
  }
  g.restore();
  // 중심 피벗(관절)
  g.globalAlpha = 0.62; g.shadowColor = lut(0.75); g.shadowBlur = GB * 0.6; g.fillStyle = lut(0.6);
  g.beginPath(); g.arc(0, 0, lw * 0.6, 0, Math.PI * 2); g.fill();
  g.restore(); g.globalAlpha = 1; g.shadowBlur = 0;
}
