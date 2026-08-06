import { PAL, NEU, vec3 } from './palette.js';
import MARK_LOOK_JSON from './mark-look.json';   // 랩 '코드에 저장' 정본 — GLYPH_LOOK 이 이걸 읽어야 랩→시뮬 이식이 된다
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
export const SIL_FIT = 0.52;   // 실루엣이 쿼드의 2/3 만 쓴다 — 나머지가 파동·헤일로의 여유
export const QUAD_K = SIL_FIT_REF / SIL_FIT;

/** 존 원의 글리프는 발형보다 조금 크다 — 원은 실루엣이 글자를 안 받쳐 줘서 같은 비율이면
 *  발형보다 작아 보인다. 몇 % 키우는 것이 기본 원칙(유저 확정). */
export const ZONE_GLYPH_K = 1.18;

/** ── 마크 글리프 룩 정본 — 출처는 footlab.html 하나뿐 (유저 확정) ──────────────
 *  크기는 유니폼이 아니라 **호스트가 캔버스로 그리는** 값이라 별도 이식이 필요했다.
 *  값을 바꾸려면 footlab 에서 잡고 여기로 옮긴다. */
// ★ 정본은 mark-look.json(footlab '코드에 저장') — 예전엔 여기 하드코딩이라 랩에서 옮긴
//   글자 위치가 시뮬에 전혀 반영되지 않았다(유저: 100% 이식 안 됨의 뿌리).
//   좌/우 독립 키(gxL/gyL/rotL·gxR/gyR/rotR)가 있으면 그걸 쓰고, 없으면 구 키(gx/gy/grot)
//   = 왼발 기준 + 오른발 미러 로 해석한다(하위 호환).
const _ML = MARK_LOOK_JSON || {};
export const GLYPH_LOOK = {
  size: _ML.gsize ?? 0.85,
  gx: _ML.gx ?? -0.025, gy: _ML.gy ?? 0.195,
  rot: _ML.grot ?? 6,
  gxL: _ML.gxL, gyL: _ML.gyL, rotL: _ML.grotL,
  gxR: _ML.gxR, gyR: _ML.gyR, rotR: _ML.grotR,
  shadow: _ML.gShadow ?? 'glow',
  shadowK: _ML.gsh ?? 0.75,
  blend: _ML.gBlend ?? 'add',
};
/** 발 좌/우별 글리프 오프셋·회전 — 독립값 우선, 없으면 구 키 미러 규약 */
export function glyphFor(right, look = GLYPH_LOOK) {
  if (right) return { gx: look.gxR ?? -look.gx, gy: look.gyR ?? look.gy, rot: look.rotR ?? -look.rot };
  return { gx: look.gxL ?? look.gx, gy: look.gyL ?? look.gy, rot: look.rotL ?? look.rot };
}

/** 마크 글리프를 캔버스에 그린다 — **랩과 시뮬이 같은 이 함수를 쓴다.**
 *  예전엔 랩(glyphTexture)과 시뮬(floorNum)이 각자 그려서 그림자·합성이 랩에만 있었다.
 *  @param draw  (ctx, ch, x, y, sizePx, opts) => bool   — drawNumber 또는 drawGlyph
 *  @returns true = 'knock' 이라 호출부가 반전본으로 써야 함 */
export function drawMarkGlyph(ctx, label, N, draw, look = GLYPH_LOOK) {
  const S = Math.round(N * 0.75);
  const sh = look.shadow === 'none' ? 0 : (look.shadowK ?? 0.75);
  const put = (opts) => draw(ctx, String(label), N / 2, N / 2, S, opts);
  if (look.shadow === 'drop' && sh > 0.001) {
    // 드롭 = 아래로 밀린 어두운 사본 위에 본체. 각인이 '떠 있는' 느낌을 준다.
    ctx.save(); ctx.globalAlpha = Math.min(1, sh * 0.7); ctx.translate(N * 0.018, N * 0.024);
    put({ color: 'rgba(120,18,18,.95)', glow: 0, glowColor: 'rgba(0,0,0,0)' });
    ctx.restore();
    put({ glow: 0, glowColor: 'rgba(0,0,0,0)' });
  } else {
    put(look.shadow === 'glow' ? { glow: 26 * sh, glowColor: 'rgba(255,140,90,.85)' }
                               : { glow: 0, glowColor: 'rgba(0,0,0,0)' });
  }
  return look.blend === 'knock';
}

/** 파냄 합성용 반전 — 글자 자리를 검게, 나머지를 희게. 곱하기 블렌딩으로 구멍이 된다. */
export function invertGlyphCanvas(ctx, N) {
  const src = ctx.getImageData(0, 0, N, N);
  const out = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const a = src.data[i * 4 + 3] / 255;
    const v = Math.round(255 * (1 - a));
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

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
/** 인물 영상 그레이딩 · 4변 페이드 — dab2n figma-prototype `setup-injury` 정본 이식.
 *  원본(styles/setup.css .injury-stage video):
 *    filter: saturate(1.55) contrast(1.05)   ← 이식하지 않았다. 원본은 multiply 로 죽은
 *      **그 클립의** 색을 되살리는 보정이다. 시뮬 인물의 색은 뉴턴 LUT 가 만들므로 같은
 *      배수를 먹이면 레드가 더 쨍해질 뿐 레퍼런스에 가까워지지 않는다(실측 — 순빨강이 됐다).
 *    mask-image: linear-gradient(to right,  transparent, #000 14%, #000 86%, transparent)
 *                linear-gradient(to bottom, transparent, #000 10%, #000 92%, transparent)
 *    mask-composite: intersect
 *  좌우 페이드가 원본의 핵심이다 — 없으면 클립 자체의 조명이 사각 박스를 그린다(원본 주석).
 *  ※ uv.y 는 아래가 0 이라 CSS 의 to-bottom 과 위아래가 뒤집힌다: 상단 10% · 하단 8%.
 */
export const REF_LOOK_GLSL = `
float refEdge(vec2 uv){
  float h = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
  float v = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.90, uv.y);
  return h * v;                        // mask-composite: intersect
}`;

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
// 디포커스 비중 — 0 이면 순수 마스크 페더(형태 완전 보존), 1 이면 옛 방식(형태 뭉갬).
//   유저 지적으로 0.22 까지 내렸다: 바닥에 닿는 끝만 살짝 풀리고 다리 실루엣은 남는다.
#define CUT_DEFOCUS 0.22
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
  // ★ 디포커스(실루엣 → 넓은 가우시안 크로스페이드)를 주력으로 쓰면 **형태가 뭉개진다** —
  //   다리 두 개가 한 덩이로 붙어 '인위적인 블러'로 읽혔다(유저 스샷). 이제 주력은 **마스크 페더**다:
  //   실루엣은 끝까지 유지되고 밀도만 사라진다. 디포커스는 가장 아래에서 살짝만 거든다.
  //   길이도 늘렸다 — 짧은 페더는 경계가 선으로 보여서 결국 '잘렸다'로 읽힌다.
  float a = smoothstep(0.0, band * 2.30, y);
  a = a * a * (3.0 - 2.0 * a);            // 부드러운 S — 시작이 급하면 그 자체가 가로선이 된다
  float d = smoothstep(band * 1.15, 0.0, y) * CUT_DEFOCUS;
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
//   uPHi = 대역 상단. **면마다 다르다** — 낮출수록 레드~오렌지(채도 0.73~0.79)에만 머물러 쨍해진다.
//          ⚠ '0.86 이면 SAND(#FEC389)에 닿는다'고 적혀 있었으나 **틀렸다**(07-31 실측):
//            t = pow(0.86, P_GAMMA) * P_GAIN = 0.807 로, SAND 스톱(t 0.86)에 못 닿는다.
//            그래서 벽 인물에 중황이 면적 0.0% 였고 램프 위쪽 절반이 통째로 코랄 근방이었다.
//          벽 인물 0.95(중황이 실재하는 최소치) / 바닥 코치판·데모판 0.64.
//          게인·알파로는 못 바꾼다 — 명도가 이미 0.92 라 곱해봐야 클리핑될 뿐이다(실측).
// 런타임 유니폼 — 이 GLSL 을 include 하는 호스트 3곳(바닥 코치판·데모판·벽 인물)이 전부
//   uniforms 에 선언하고 매 프레임 주입한다. 하나라도 빠지면 그 인물만 0(=무채·대역없음)이 된다.
//   uPSat   = 룩 채도. 구 '#define P_SAT 1.32' 고정값이 기본이다.
//             (여기에 백틱을 쓰면 이 GLSL 템플릿 리터럴이 끊겨 앱이 통째로 죽는다 — 실제 사고.)
//             (바닥 코치판엔 uSat 유니폼이 있었는데 셰이더 본문에서 한 번도 안 읽혔다 — 죽은 손잡이.
//              "채도 슬라이더 하나가 인물·마크 둘 다 움직인다"는 주석이 실제로는 마크만 움직였다.)
//   uPSweep = 세로 열 그라디언트 폭. **0 이면 도입 전과 픽셀 동일** — 안전한 롤백 지점.
uniform float uPSat, uPSweep, uPHi, uPDepth;
//   uPExp = **이 클립의 마스크 안쪽 평균 휘도**(호스트가 4Hz 로 실측해 주입). 0.5 = 무보정.
//     클립마다 노출이 달라 같은 셰이더가 다른 색을 냈다 — 복싱(어두운 탱크톱)은 진하고
//     러닝(밝은 옷·햇빛)은 하얗게. 셰이더 안의 어떤 값으로도 못 맞춘다: 입력 분포가 다르니까.
//     그래서 색을 정하기 **전에** 두 소스를 같은 밝기 분포로 옮긴다.
uniform float uPExp;
//   uPForm = **레퍼런스 규약**(public/refs/person, 유저 확정 08-01). 0 = 현행 · 1 = 깊이 기반.
//     레퍼런스 다섯 장의 공통 성질은 하나다: **밝기가 형태(깊이)에서 나온다.**
//     가장자리는 검정으로 떨어지고 안쪽 두꺼운 곳이 밝다. 사진의 결(모공·옷 무늬)은 밝기를
//     정하지 않는다 — 지금 매핑의 정반대다(현행은 가장자리가 밝고 안쪽이 진하다).
//     무채축(검정→흰색)을 그대로 쓰면 규칙 ①(유채 4색)을 깬다. 그래서 **뉴턴 LUT 를
//     명도축으로** 쓴다: 깊이 0 → RED 를 어둡게 · 중간 → CORAL/SAND · 최심부 → PRISM(거의 흰빛).
uniform float uPForm;
uniform float uPLo, uPHiL;   // 클립 휘도 실측 범위 — 룩2 의 p5~p95 스트레치(클립 노출·대비 차 상쇄)
uniform float uPLumLin;      // 1 = 이 판의 비디오 텍스처가 sRGB 디코드되어 셰이더 휘도가 **리니어**.
                             //   코치판(SRGBColorSpace)=1 · 데모판(미지정)=0. 측정(lo/hi)은 sRGB 라
                             //   리니어 입력은 sRGB 로 되돌려 **모든 판이 같은 공간**에서 룩2를 탄다.
// 룩2 캘리브레이션 노브 — 재빌드 없이 FXP.person.cal 로 조정, 수렴값이 곧 정본.
uniform float uPCalWave;     // 웨이브 진폭 배율 (기본 1 · 캘리브레이션 시 0)
uniform float uPCalD;        // d(결 신호) 이득
uniform float uPCalW;        // 흰 레이어 전역 이득
uniform float uPCalB;        // band(톤) 오프셋
//   uPInk / uPInkT = **명암 잉크** (유저 확정 07-31: "바닥 지면에 뉴턴 빨간 레드를 실제 인물의
//     명암이 진한 부분에 잉크로 넣어라 — 아직도 밝다"). 세기 · 문턱(이 밝기 아래를 그늘로 본다).
//     uPInk 0 = 도입 전과 픽셀 동일(롤백 지점). 바닥(personLook)에만 걸린다 — 벽은 personColor 직행.
uniform float uPInk, uPInkT;
// 얼굴 아래 밝기 리프트 — 기본 0(끔). 복싱 벽 인물만 켠다. uFaceE = 얼굴 타원(패널 uv, xy=중심 zw=반경)
uniform float uFaceLift;
uniform vec4 uFaceE;
// 잉크 색 = 팔레트 RED 그 자체. **LUT 를 경유하지 않는다** — personColor 의 대역 하한이 P_LO(0.40)
//   이라 t 는 아무리 낮춰도 0.33 아래로 못 가고, LUT 의 순수 RED 평지(t ≤ 0.30)에 영영 못 닿는다.
//   T 를 미는 방식으로 '더 빨갛게'를 시도하면 여기서 막힌다 — 그게 '아직도 밝다'의 구조적 원인이다.
#define P_INK ${vec3(PAL.red)}
//   uPDepth = 영상의 국소 대비(옷 주름·결)를 온도로 옮기는 양 = '은은한 디테일 밀도'.
//             벽 매핑엔 이 경로가 아예 없다(높이만 본다) — 좌우 랩에서 보이는 질감 차이가 이것.
//             0.88 이 원래 값인데 밝은 맨살이 뽀얗게 뜨는 걸 막으려 0.34 로 내렸었다. 지금은
//             명도 상한·세로 램프가 그 문제를 따로 막으므로 올려도 된다.
//   uPCoral = **코랄 억제**(유저 규약: "RED · 중황 · 코랄이 고루 보이되 코랄 양은 일부만").
//     코랄은 LUT 램프의 한가운데(t 0.56)에 앉는다. T 가 고르게 퍼지면 한가운데가 곧 최대 면적이고,
//     특히 벽은 T 가 '높이'라 코랄이 **몸통**(사람에서 가장 넓은 부위)에 그대로 깔린다.
//     그래서 코랄이 앉는 T 를 피벗으로 잡고 양쪽으로 밀어낸다 — 머리는 RED 평지까지, 발은 SAND 까지
//     내려가/올라가고 코랄은 좁은 띠로 남는다. 새 색을 만들지 않는다: 배분만 바꾼다.
//     0 = 도입 전과 픽셀 동일(롤백 지점).
uniform float uPCoral;
//   ★ 주목 강조(농구 스텝백 가이드, 유저 08-06) — **새 색을 만들지 않는다. 대역 상단만 바꾼다.**
//     전신은 uPHiPale(높음 → LUT 위쪽 = 거의 흰 연핑크), 강조 타원 안만 uPHi(현행 = 붉음).
//     LUT 램프 위를 어디에 앉힐지의 문제라 뉴턴 4색 규칙을 안 깬다.
//     uHotE = 강조 타원(xy 패널 uv 중심 · zw 반경) · uHot = 세기.
//     **uPHiPale = 0 이면 도입 전과 픽셀 동일**(롤백 지점) — 이 리포의 유니폼 규약 그대로다.
uniform vec4 uHotE;
uniform vec4 uGaze;        // 시선 토큰(xy 중심 · zw 반경). z<=0 = 끔. 반경이 둘인 건 판이 정사각이 아니라서 —
                           //   하나로 두면 uv 원이 월드에선 타원이 된다(w1.04 × h0.87).
uniform sampler2D uTokTex; // 토큰 원본 이미지(body-ring.png). 재구현 대신 **그 파일 그대로** 쓴다.
//   uPHiHot = 강조 부위 대역 상단. **낮을수록 쨍하다**(위 uPHi 주석의 실측) — 강조는
//     '지금 색 그대로'가 아니라 **더 붉게** 가야 한다(유저: 엄청 메인컬러로 변하면서).
uniform float uHot, uPHiPale, uPHiHot;
//   프래그먼트 전역 — 호출 체인(personLook → personColor)이 uv 를 안 물고 다닌다.
//   호스트 main() 이 첫머리에 gHot = hotAt(uv) 로 세운다. 안 세우면 0 = 종전 동작.
float gHot = 0.0;
/** 강조장 — **가우시안**이다(유저 레퍼런스: 발바닥 열화상).
 *  ★ smoothstep 을 쓰면 안 된다. 아무리 부드럽게 잡아도 **끝나는 반경**이 있어서 경계가 서고,
 *    그 순간 '열이 오른 자리'가 아니라 '붙여 놓은 스티커'로 읽힌다. 레퍼런스의 성질은
 *    경계가 없다는 것 하나다 — 중심이 제일 진하고 사방으로 끝없이 풀린다.
 *  g(넓은 열) + core(중심 심지) 2겹. core 가 '제일 빨간 곳'을 만든다(레퍼런스의 노란 심지 자리). */
float hotAt(vec2 uv){
  if (uHotE.z <= 0.0 || uHot <= 0.0) return 0.0;
  vec2 d = (uv - uHotE.xy) / max(uHotE.zw, vec2(1e-4));
  float r2 = dot(d, d);
  //   ★ **평지 + 치마** 구조. 가우시안을 1 이상으로 밀어 올리고 clamp 하면 안쪽은 통째로 1 이
  //     되고(= 확 빨간 덩어리) 바깥만 부드럽게 풀린다(= 블러 가장자리). 순수 가우시안은
  //     꼭짓점 하나만 최대라 '작고 흐린 점'이 되고, 유저가 반복해서 지적한 게 그거다.
  return uHot * clamp(exp(-r2 * 1.35) * 1.32, 0.0, 1.0);
}
/** 이 프래그먼트가 쓸 대역 상단. uPHiPale 0 = 기능 끔. */
float pHi(){ return uPHiPale > 0.0 ? mix(uPHiPale, uPHiHot > 0.0 ? uPHiHot : uPHi, gHot) : uPHi; }
/** 시선 토큰 = dab2n setup-injury 의 assets/icons/body-ring.png **그 파일 그대로**.
 *  ★ 재구현하지 않는다. 원본을 픽셀로 재 보니 내가 짐작했던 부드러운 글로우가 아니라
 *    **딱딱한 2톤 원반**이었다(104×104 실측):
 *      r/R 0.00~0.36  #FFFFFF 순백 코어(불투명)   ·  0.36~0.40 좁은 전이
 *      r/R 0.40~0.94  #FFC494 주황 링            ← 팔레트 sand(#FEC389)와 사실상 같은 색
 *      r/R 0.94~1.00  밝은 테두리 + 알파 255→96
 *    글로우로 흉내 내면 이 딱딱한 경계가 사라져서 '토큰'이 아니라 '빛번짐'이 된다.
 *  붉은 낙하 그림자는 원본 CSS 그대로: drop-shadow(0 2px 8px rgba(250,48,48,.45)) = 뉴턴 RED.
 *  인물 알파에 안 갇힌다 — 몸 밖으로 나가도 보여야 지시가 된다. */
vec4 gazeToken(vec2 uv, float t){
  if (uGaze.z <= 0.0) return vec4(0.0);
  vec2 d = (uv - uGaze.xy) / max(uGaze.zw, vec2(1e-4));
  // 그림자는 원본과 같은 방향(아래로 2px ≈ 반경의 5%)·같은 색·같은 세기.
  float sh = (1.0 - smoothstep(0.60, 1.70, length(d + vec2(0.0, 0.05)))) * 0.45;
  vec4 o = vec4(P_INK, sh);
  if (abs(d.x) <= 1.0 && abs(d.y) <= 1.0) {
    vec4 tk = texture2D(uTokTex, d * vec2(0.5, -0.5) + 0.5);   // y 뒤집기 — 패널 uv 는 위가 +
    o.rgb = mix(o.rgb, tk.rgb, tk.a);
    o.a = max(o.a, tk.a);
  }
  return o;
}
/** 가이드 룩 — **하드코딩 2단 램프**(유저 08-06: 하드코딩해서라도 확실히 보이게).
 *  LUT 대역(uPHi)을 밀어서 연하게 만드는 방식은 간접적이라 '얼마나 연해지나'가 안 잡혔다.
 *  여기선 두 램프를 못박고 gHot 으로 갈아탄다 — 화면에서 무슨 색이 나올지가 코드에 그대로 있다.
 *    연(전신)   거의 흰빛 → sand(#FEC389)   = 유저가 말하는 '연연한 주황·맑은 코랄'
 *    진(강조)   coral(#FE6E3C) → red(#FA3030) = 뉴턴 메인컬러로 **찐해진다**
 *  T 는 높을수록 밝은 쪽이다(LUT 방향과 같음) — 두 램프 다 그 방향을 지킨다.
 *  ⚠ 네 색 전부 R≈1.0 이다. 투사광 불변식(알파 = min(aOut, lum×1.6))에 안 걸린다 —
 *    어느 픽셀도 어두워지지 않으므로 뒤 바닥이 배어 오르지 않는다. 색을 바꿀 땐 이걸 먼저 본다. */
//   연 = **흰끼 도는 연주황**(유저). sand 를 흰색 쪽으로 45% 끌어와 하드코딩한다 —
//     sand 원색 그대로면 '연한 주황'이 아니라 그냥 주황이라, 강조와의 대비가 안 선다.
#define G_PALE_D vec3(1.000, 0.871, 0.745)
#define G_PALE_L vec3(1.000, 0.980, 0.969)
//   진 = **제일 빨간 곳**. 위아래 폭을 좁게 잡아 강조 영역이 통째로 RED 로 읽히게 한다.
#define G_DEEP_D ${vec3(PAL.red)}
#define G_DEEP_L vec3(1.000, 0.353, 0.227)
vec3 personGuideColor(float T){
  T = clamp(T, 0.0, 1.0);
  vec3 pale = mix(G_PALE_D, G_PALE_L, T);
  // ★ 강조는 영상 밝기에 **덜 흔들린다**(T×0.35). 열화상의 붉은 덩어리는 옷 주름을 따라
  //   얼룩지지 않는다 — 그대로 두면 강조 안에서 밝은 픽셀이 연해져 '덩어리'가 안 뭉친다.
  vec3 deep = mix(G_DEEP_D, G_DEEP_L, T * 0.35);
  // ★ 대비 곡선. 선형이면 중간값이 넓게 깔려 '살짝 붉다'로만 읽힌다(유저 반복 지적).
  //   smoothstep 으로 중간을 양끝으로 밀어 **연한 곳은 더 연하게, 붉은 곳은 확실히 붉게**.
  float k = clamp(gHot, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  return mix(pale, deep, k);
}
vec3 personColor(float T){
  if (uPHiPale > 0.0) return personGuideColor(T);   // 가이드 모드 = LUT 를 안 탄다
  T = clamp(T, 0.0, 1.0);
  float hiN = pHi();
  if (uPCoral > 0.001) {
    // 코랄이 앉는 T 를 감마·게인·대역에서 역산한다 — uPHi 를 바꿔도 피벗이 따라온다(상수로 박으면 어긋난다).
    float tc = pow(0.56 / P_GAIN, 1.0 / P_GAMMA);
    float Tc = clamp((tc - P_LO) / max(hiN - P_LO, 1e-4), 0.0, 1.0);
    T = clamp(Tc + (T - Tc) * (1.0 + uPCoral * 1.6), 0.0, 1.0);
  }
  float t = P_LO + T * (hiN - P_LO);   // 공용 대역으로 정규화
  t = pow(t, P_GAMMA) * P_GAIN;
  vec3 c = lut(clamp(t, 0.0, 1.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, uPSat), 0.0, 1.0);
}
// 인물 룩 — 바닥 코치판·데모판이 쓰는 톤 결정자.
//   ⚠ '복싱·러닝·농구가 공유하는 단 하나의 톤 결정자'라고 적혀 있었지만 **사실이 아니었다**.
//     벽 인물(main.js bxPerson)은 이 함수를 호출하지 않고 personColor(세로 램프)를 직접 쓴다.
//     그래서 같은 사람인데 바닥은 두께로, 벽은 높이로 색이 정해졌고 팔다리 색이 갈렸다(유저 지적).
//     지금은 아래 vHeat 로 같은 세로 램프를 쓴다 — 매핑은 사실상 통일됐지만, '한 함수'는 아직 아니다.
//   규칙: ① 얼굴만 완전 블러(이목구비 소거) ② 몸은 옷주름·결이 살아있되 매끄럽게
//        ③ 말단·가장자리는 뽀얀 우유빛으로 빠지고 코어만 채도 높게(그라디언트)
//        ④ 어두운 덩어리 금지 — 고키. 투사광이라 검정은 곧 '빛 없음'이다.
//   thick = 두께장(블러 마스크·방사 필드, 가장자리 0 → 코어 1)
//   lumS  = 원본 휘도(선명 — 몸의 결)      lumB = 블러 휘도(얼굴용)
//   mIn   = 내부 침식 마스크               face = 얼굴 대역 가중
#define P_MILK  0.28    // 하이라이트·얼굴이 우유빛으로 빠지는 양(전신 희석 금지)
//   ⚠ 밝기를 깎아 그늘을 만들면 안 된다. 알파가 min(aOut, lum*1.6)로 밝기에 묶여 있어
//     어두운 옷 픽셀만 알파 0.85로 떨어지고 뒤 벽·그리드가 비친다(실측: 0.985→0.847, 유저 신고).
//     투사광에선 '어둡게' = '투명하게'다. 그래서 그늘은 LUT 상단(딥레드)으로, 하이라이트는
//     하단(샌드)으로 — 양끝 다 R≈1이라 알파는 어디서도 안 떨어진다.
#define P_TEX   4.2     // 국소 대비(옷 결·주름)를 온도로 옮기는 배율.
                        //   6.8 은 대비를 포화시켜 밝은 옷·햇빛 받은 다리가 통째로 램프 꼭대기(흰)로 갔다.
                        //   ★ 질감은 **여기서** 가져온다 — 국소 평균과의 차이라 클립 노출에
                        //   무관하다. 절대 밝기(P_ABS)로 가져오면 밝게 찍은 클립이 통째로
                        //   램프 위로 밀려 러닝 코치만 하얘진다(유저: 다리색이 다르다).
#define P_ABS   0.26    // 절대 밝기를 반영하는 비율 — 낮을수록 클립 노출차에 둔감.
                        //   07-31 에 질감 살리려고 0.72 까지 올렸다가 되돌린다(0.18 → 0.72 → 0.26).
                        //   질감은 P_TEX(국소 대비)가 담당한다. 노출은 클립마다 다르지만
                        //   국소 대비는 다르지 않다 — 그게 두 종목 인물 색을 맞추는 유일한 길.
#define P_LUMLED 0.72   // T 를 '영상의 밝기'가 얼마나 주도하나. 0 = 종전(형상장 단독).
#define P_VERTMIX 0.35   // 1.0(세로 램프 단독 = 1차원)에서 낮춤 — 두께가 다시 색을 만든다(유저)   // T 결정에서 '세로 램프'가 차지하는 비중. 1 = 벽 인물과 완전 동일 매핑(유저 확정:
                         //   '벽면이 좋아 벽면스타일대로 바닥을 고쳐줘'). 0 으로 내리면 옛 두께 기반으로 돌아간다.
#define P_PIVOT 0.34    // 대역 확장 피벗 — 코어 실사용 T(≈0.15)보다 위. 이 값 기준으로 T 가 벌어진다.
vec3 personLook(float thick, float lumS, float lumB, float mIn, float face, float vTop){
  // 노출 정규화 — 이 클립의 평균을 0.5 로 옮긴다. 대비(=질감)는 비율이라 그대로 살아남고,
  //   '어떤 카메라로 얼마나 밝게 찍었나'만 상쇄된다.
  float kExp = 0.5 / max(uPExp, 0.06);
  lumS *= kExp; lumB *= kExp;
  // (uPForm=1 은 이 함수를 타지 않는다 — 호출부에서 personAura 로 분기. 아래 정의 참조.)
  // 절대 휘도를 그대로 읽으면 클립 노출차가 곧 색차가 된다 — 밝게 찍은 러닝·농구 코치가
  //   통째로 LUT 밝은 쪽(SAND)으로 밀려 하얘졌다(유저: "왜 러닝 농구는 더 하얘?").
  //   피부색이 아니라 노출이다. 그래서 국소 평균(lumB)은 노출로 보고 대부분 상쇄하고,
  //   국소 대비(lumS - lumB)만 결로 읽는다 — 옷 주름·미묘한 톤차가 여기 다 들어있다.
  float d = (lumS - lumB) * (1.0 - face) * P_TEX;       // 얼굴은 결 제거(이목구비 은닉)
  // 소프트 새추레이션 — clamp 로 자르면 큰 대비 영역이 통째로 양 끝에 붙어 종이장처럼
  //   포스터화된다(유저 스샷). x/(1+|x|)는 작은 결은 그대로, 큰 대비만 압축한다.
  float detail = d / (1.0 + abs(d) * 1.6);
  float base = mix(0.5, lumB, P_ABS);                   // 절대 밝기는 34%만
  // 하이키 — 07-31 에 감마 0.62 로 중간톤을 밀어 올렸는데, 그건 **전역 리프트**라
  //   어두운 소스(복싱 탱크톱)는 버티고 밝은 소스(러닝 코치의 밝은 옷·햇빛 다리)만
  //   램프 꼭대기로 밀려 하얘졌다 — 두 종목 인물 톤이 갈리던 나머지 절반(유저).
  //   0.88 = 거의 선형. 밝기 배분은 소스가 정하고, 우리는 대역만 정한다.
  float shade = pow(clamp(smoothstep(0.08, 0.80, base) + detail, 0.0, 1.0), 0.88);
  float lum = mix(mix(lumS, lumB, 0.50), lumB, face);   // 우유빛 하이라이트 판정용
  // LUT 실측 방향: T=0 → RED(#FA3030) · T≈0.86 → SAND(#FEC389) · T=1 → ICE.
  //   즉 T가 낮을수록 진하다. 두꺼운 코어·그늘 = 낮은 T(진한 코랄레드),
  //   얇은 말단·하이라이트·얼굴 = 높은 T(뽀얀 살구).
  float th = smoothstep(0.25, 0.95, thick);   // 두께장 정규화 — H의 실사용 범위가 좁다
  // 코어(th=1)는 딥코랄 t≈0.42, 사지(th≈0.4)는 코랄 t≈0.60, 말단·얼굴은 뽀얀 살구.
  //   구 1.0 - th*0.60 은 두께장이 1에 못 닿는 실제 값에서 전신을 살구빛으로 띄웠다(유저).
    // ★ 두께장 단독으로 T 를 정하면 안 된다(07-31 유저 지적). 벽 인물은 T 를 '높이'로 정하는데
  //   바닥만 '두께'로 정하고 있었다 — 같은 사람인데 팔다리 색이 완전히 갈렸다:
  //     몸통 t≈0.47(코랄레드) / 팔·다리 t≈0.82(샌드). 얇은 부위가 두 번 벌받는 구조였다.
  //   벽과 같은 세로 램프(머리 0.06 → 발 0.98)를 주 결정자로 두고, 두께는 보조로만 남긴다.
  //   P_VERTMIX 0 이면 옛 동작(두께 단독), 1 이면 벽과 완전 동일. 0.85 = 거의 벽 매핑.
  float vHeat = pow(clamp(1.0 - vTop, 0.0, 1.0), 1.35) * 0.92 + 0.06;
  // 형상장(두께·높이)은 바탕으로 남기고, **영상의 밝기(shade)가 색을 주도**한다 = 듀오톤.
  //   밝을수록 램프 위(흰빛), 어두울수록 아래(코랄레드) — 레퍼런스의 질감이 여기서 나온다.
  float form = mix(0.95 - th * 0.80, vHeat, P_VERTMIX);
  float T0 = mix(form, shade, P_LUMLED)
           + (shade - 0.5) * uPDepth * mIn * (1.0 - face * 0.7) + face * 0.26;
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
  // 우유빛에서 **두께 항을 뺐다**(계수 0). 벽 인물엔 이 항이 아예 없고, 이게 팔다리를 크림색으로
  //   띄운 나머지 절반이었다(두께 0.35 인 팔이 흰색 9.6%). 얼굴 항은 남긴다 — 이목구비 은닉은
  //   제품 요구사항이고 벽과의 차이가 아니라 바닥 코치판의 역할이다.
  float milk = clamp(pow(1.0 - clamp(thick, 0.0, 1.0), 4.5) * 0.0
                     + face * 0.9 + smoothstep(0.72, 1.00, shade) * mIn * 0.0, 0.0, 1.0);   // 하이라이트 항도 0 —
  //   밝은 맨살(팔·다리)이 이 항으로 크림색이 됐다. 벽 인물엔 우유빛 자체가 없다. 얼굴만 남긴다.
  c = clamp(mix(c, vec3(1.0, 0.95, 0.90), milk * P_MILK), 0.0, 1.0);
  // ── 명암 잉크 — 실제 인물의 그늘을 뉴턴 RED 로 ─────────────────────────────
  //   왜 위의 shade 로는 안 되는가: shade 는 절대 밝기를 P_ABS(0.18)만 반영한다. 노출차에 안 흔들리는
  //   톤을 얻으려고 그렇게 설계했지만, 그 대가로 **실제 명암이 색에 거의 안 실린다** — 순흑에서
  //   순백까지 가도 shade 는 0.42~0.75 밖에 안 움직이고, uPDepth(0.34)를 곱하면 T 이동은 ±0.05 뿐이다.
  //   그래서 어두운 옷·그늘이 밝은 살구로 나온다. 잉크는 그 억제를 우회해 **원본 블러 휘도(lumB)** 를
  //   직접 본다 — 블러라서 이목구비·주름이 아니라 '명암 덩어리'만 잡힌다(유저 표현 그대로).
  //   ★ 밝기를 깎지 않는다(위 ⚠ 규약): RED 는 R=0.98 이라 알파 게이트 min(aOut, lum*1.6)에 안 걸린다.
  //     그늘이 어두워지는 게 아니라 **빨개진다** — 투사광에서 검정은 '빛 없음'이고 그건 그늘이 아니다.
  //   ★ 얼굴은 0.3 배만 — 이목구비 은닉이 제품 요구사항이라, 잉크가 얼굴 명암을 되살리면 안 된다.
  float dark = 1.0 - smoothstep(uPInkT - 0.20, uPInkT + 0.20, lumB);
  //   ★ 연핑크 모드에선 잉크도 **강조 부위에만** 남는다. 안 그러면 전신을 뽀얗게 띄워 놓고
  //     그늘만 빨간 얼룩으로 남아, '연해진 게 아니라 지저분해진' 걸로 읽힌다(대역 상단만 바꾼
  //     의도가 잉크에서 되돌아온다). uPHiPale 0(기능 끔)이면 이 항은 1 = 종전 그대로.
  float inkK = uPHiPale > 0.0 ? mix(0.10, 1.0, gHot) : 1.0;
  float ink = clamp(dark * mIn * (1.0 - face * 0.7) * uPInk * inkK, 0.0, 1.0);
  return clamp(mix(c, P_INK, ink), 0.0, 1.0);
}
// ═══ 레퍼런스 규약(uPForm=1) — 마스크 공유 5중 레이어 합성 ══════════════════════
//   injury-check.mp4 픽셀 실측(08-02): 색상 12° 고정 · 명도 0.80~0.95 · 채도만 이동,
//   픽셀 75% 가 mix(흰색, #E0542F, k) 한 축 위. 이 그림은 LUT 램프를 훑어서는 안 나온다 —
//   **같은 실루엣을 여러 겹으로 쌓아야** 나온다(외곽광·중간광·본체·디테일 screen·내부 흰광).
//   재료는 전부 기존 파이프라인에 있다: mBody = 침식 마스크(크리스프 실루엣),
//   wide/narrow = 마스크·휘도 블러 피라미드(CSS 의 blur 42px / 17px 역할).
//   레퍼런스의 흰 배경만 이식하지 않는다 — 투사광에서 흰 배경 = 판 전체 점등이다.
//   screen 합성(1-(1-a)(1-b))은 '흰색으로 희석'과 같은 축이라 실측 구조가 보존된다.
// ═══ 룩2 이식(uPForm=1) — 유저 확정 열화상 룩(인물 필터 앱 2026-08-02)의 GLSL 번역 ═══
//   벽·바닥·전 종목이 이 한 함수로 통일된다(유저: "바닥 벽 동일한 값으로").
//   앱 파이프라인 대응: 표면블러 1(lumS↔lumB 바이래터럴 근사) · 감마0.59/대비0.8/밝기0.5 ·
//   웨이브(세기1.04·속도1.32·밴드1.95, 얼굴·경계 통과 금지) · 얼굴 = 블러휘도+감산(이목구비 소거) ·
//   이너섀도 0.28 · 내부라인 0.14 · 적응 디더 · 아우라 0. 팔레트 = 룩2 스톱 그대로.
//   ⚠ 스톱 #FF4000·#FF8E5E·#FF3300 은 뉴턴 4색 밖 — 유저가 앱에서 확정한 값을 우선 이식했다.
vec3 look2Ramp(float t){
  // [흰색, #FA3030, #FF4000, #FF8E5E, #FF3300] 균등 스톱 (앱 LUT 규약: t=0 이 배경 흰색)
  vec3 c = mix(vec3(1.0), vec3(0.980, 0.188, 0.188), clamp(t * 4.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.251, 0.0), clamp(t * 4.0 - 1.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.557, 0.369), clamp(t * 4.0 - 2.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.2, 0.0), clamp(t * 4.0 - 3.0, 0.0, 1.0));
  return c;
}
vec4 personAura(float mBody, float wide, float lumSharp, float lumBase, float face, vec2 uv, float tSec){
  // ★ lumSharp = **비디오 원본 전해상 휘도**(디스필 적용, 호출부 계산). 저해상 필드 RT 휘도를
  //   쓰면 판이 작은 바닥 코치일수록 결이 사전에 뭉개져 뿌옇게 떴다(유저 진단 정확).
  //   lumBase = 좁은 블러장 휘도(앱 표면블러의 base 역할). 이제 신호가 앱과 같은 구조라
  //   우회 보정(임계 축소·d 이득·숄더) 없이 앱 상수를 그대로 쓴다.
  face = max(face, smoothstep(0.80, 0.90, uv.y));   // 정수리 — 판별 얼굴 대역 상단(0.84)과 크라운 사이 틈이 검붉은 반점으로 남던 것(복싱 실측)
  face = min(1.0, face * 1.5);   // 전이 구간(0.7~0.85)에서 이마 광택이 새어나와 반점 — 빠르게 포화
  if (uPLumLin > 0.5) {
    lumSharp = pow(clamp(lumSharp, 0.0, 1.0), 0.4545);
    lumBase = pow(clamp(lumBase, 0.0, 1.0), 0.4545);
  }
  float lo = uPLo;
  float hi = max(uPHiL, lo + 0.05);
  float ls = clamp((lumSharp - lo) / (hi - lo), 0.0, 1.0);
  float lb = clamp((lumBase - lo) / (hi - lo), 0.0, 1.0);
  // 표면 블러(surface 1, 앱 th=10/255 그대로): 약한 결은 base 로, 강한 경계만 복원
  float d = (ls - lb) * 1.1 * uPCalD;   // 수렴값(08-02 2차 캘리브레이션)
  float keep = clamp((abs(d) - 0.039) / 0.031, 0.0, 1.0);
  keep *= keep;
  float lum = lb + d * keep;
  lum = mix(lum, lb, face);   // 얼굴: 결 제거
  // 톤(룩2): 감마 0.59 → 대비 0.8 → 밝기 +0.5 → 인물 대역 0.3~1.0 (앱과 동일)
  float band = 0.3 + 0.7 * clamp((pow(clamp(lum, 0.0, 1.0), 0.59) - 0.5) * 0.8 + 0.72 + uPCalB, 0.0, 1.0);
  float bandB = 0.3 + 0.7 * clamp((pow(clamp(lb, 0.0, 1.0), 0.59) - 0.5) * 0.8 + 0.72 + uPCalB, 0.0, 1.0);
  band = mix(band, 0.17, face * 0.92);   // 얼굴 저열 — 0.10 은 광나는 구슬처럼 떴다(유저). 살짝 톤을 남긴다
  // ★ 얼굴 아래 리프트 — 가드를 올리면 얼굴·목·가슴이 한 덩어리로 붙어 글러브와 구분이
  //   안 됐다(유저 08-04). 실측: 얼굴 휘도 108 · 가슴 110 — 둘이 사실상 같은 색이었다.
  //   (글러브는 148~159 로 이미 충분히 밝다 — 문제는 얼굴↔가슴이었다)
  //   은닉 범위를 좁히는 걸로는 못 푼다. 좁히면 이목구비가 뜨고 넓히면 글러브를 먹는다.
  //   그래서 **얼굴 타원 바로 아래**만 band 를 올려 목–턱에 경계를 만든다.
  //   uFaceLift = 0 이면 이 항이 통째로 죽는다 — 러닝·농구는 손대지 않는다(기본 0).
  if (uFaceLift > 0.0 && uFaceE.z > 0.0) {
    float dx = (uv.x - uFaceE.x) / max(uFaceE.z, 1e-4);
    float below = (uFaceE.y - uv.y) / max(uFaceE.w, 1e-4);   // 얼굴 아래로 얼마나 (uv.y 는 위로 +)
    //   가로는 얼굴 폭 안, 세로는 타원 아래 0.6~2.4 반경 구간. 얼굴 자체(face)에는 안 건다.
    float lift = smoothstep(0.6, 1.3, below) * (1.0 - smoothstep(2.0, 2.8, below))
               * (1.0 - smoothstep(0.9, 1.7, abs(dx))) * (1.0 - face);
    band = min(1.0, band + uFaceLift * lift);
  }
  // 얇은 부위(팔·다리) 심화 — wide 낮음 = 얇음. 유저: "다리만 조금 더 진하게"
  band = min(1.0, band + 0.115 * (1.0 - smoothstep(0.40, 0.75, wide)) * (1.0 - face));   // 다리가 최심 주황(#FF3300 대)까지 닿게(유저)
  // ⚠ 세로 부위 프로파일(허리·무릎·종아리 대역)은 **폐기** — A1 처럼 크롭된 판에선 uv 가
  //   신체 좌표가 아니라서 허리 밴드가 셔츠 밑단의 붉은 줄무늬로 찍혔다(같은 프레임 대조 실측).
  //   부위 대비는 포즈 없인 안전하게 재현 불가 — stdG 일부 손해를 감수한다.
  // 최상단 소프트 숄더 — 최고열 포화 완화(러닝 hot-tail p10 실측 보정)
  band -= 0.06 * smoothstep(0.88, 1.0, band);
  // Contour 림(룩2 1.0 · 앱 rim = (열−아우라열)·0.9) — 아우라열 근사 = base 톤
  // 림은 두꺼운 부위(몸통)에서만 — 얇은 팔다리에선 위쪽 모서리를 따라 진한 줄이 생겨
  //   면이 두 줄로 갈라져 보였다(유저 #70). wide(마스크 블러)가 낮은 곳 = 얇은 부위.
  float rim = max(0.0, band - bandB) * 0.45 * (1.0 - face) * smoothstep(0.40, 0.75, wide);
  // 웨이브(세기 1.04 · 속도 1.32 · 밴드 1.95) — 얼굴·반투명 경계 통과 금지
  float ta = tSec * 1.32;
  float wc = uv.y / 1.95;
  float wave = 1.0 + 1.04 * uPCalWave * (-0.13
    + 0.18 * sin(6.2832 * (wc * 1.4 - ta * 0.10))
    + 0.09 * sin(6.2832 * (wc * 3.1 + ta * 0.07) + uv.x * 2.0));
  wave = mix(wave, 1.0, face);
  float t = band * mix(1.0, wave, mBody * mBody) + rim;
  // ★ 디더는 **정적**으로 — 시드에 시간(ta)을 섞으면 그레인이 매 프레임 기어다닌다
  //   (유저: "자글자글 너무 싫어"). 밴딩 해소엔 고정 패턴이면 충분하다. 진폭도 축소.
  float dth = (fract(sin(dot(uv * 1483.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5)
            * (0.006 + face * 0.010);
  vec3 c = look2Ramp(clamp(t + dth, 0.0, 1.0));
  // 채도 부스트(유저 최종 요청: "제발 채도 올려줘") — 무채 축 기준 1.28배.
  //   회색 바닥·밝은 코트 위에서 살몬이 먼지빛으로 읽히는 것을 원천 보정.
  float cGray = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(mix(vec3(cGray), c, 1.28), 0.0, 1.0);
  // 흰 레이어 3종 — 앱 원값(이너섀도 0.28×0.75 · 라인 0.24×0.9 · 내부라인 0.14)
  // 피더는 **가장자리로만** — 얇은 팔다리는 마스크 블러가 안쪽까지 번져 (m−wide)가 사지
  //   전체에서 커지고, 흰 띠가 다리 전면을 덮어 하얗게 떴다(유저: 다리가 너무 하얗다).
  float feather = pow(clamp((mBody - wide) * 2.0, 0.0, 1.0), 2.0);
  c = mix(c, vec3(1.0), clamp(feather * 0.24 * uPCalW, 0.0, 1.0));
  // ★ 라인 강도 = 앱 스펙으로 복원(0.41→0.22 · 0.27→0.14). 어느 시점에 ~2배로 드리프트돼
  //   얇은 다리 윗 실루엣이 두꺼운 흰 줄로 떴다(유저 스샷 08-04, A2 런지). 룩2 원값:
  //   라인 0.24×0.9 · 내부라인 0.14 — 앱 화면(유저가 '이쁘다'한 그 그림)의 절반 강도가 정답.
  float line = pow(4.0 * mBody * (1.0 - mBody), 1.5) * smoothstep(0.35, 0.6, mBody);
  c = mix(c, vec3(1.0), clamp(line * 0.22 * uPCalW, 0.0, 1.0));
  float lineIn = sqrt(clamp(abs(ls - lb) * 2.6, 0.0, 1.0)) * (1.0 - face);
  c = mix(c, vec3(1.0), clamp(lineIn * 0.14 * uPCalW, 0.0, 1.0));
  return vec4(clamp(c, 0.0, 1.0) * mBody, mBody);
}
`;

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
//   uImpDotCol: 각인 **도트** 팔레트 선택(0 흰 · 1 샌드 · 2 코랄 · 3 레드). 예전엔 C_CREAM(=SAND)
//   하드코딩이라 랩에서 만질 수가 없었다(유저 08-05). 음영·파동과 같은 palPick 규약.
// 필 전용 불투명도 — 랩 '투명도 op'. uFade 는 **전부**를 깎아 도트·라인·글리프까지 같이 사라졌다
//   (유저 08-05). op 는 말 그대로 '필(코랄 면)만' 투명해져야 하므로 필 알파에만 곱한다.
uniform float uFillOp;
uniform vec2 uImpCtr, uImpOff;
uniform float uImpDotCol;
// 파동(리플) — 실루엣 **등거리선**을 따라 퍼진다. uRip 0 = 도입 전과 픽셀 동일.
//   유저 지적: 지금 파동이 단순 원형 파장이라 발자국 위에서 따로 놀고, 퍼짐이 과하거나 쨍하다.
//   부호거리로 몰면 파면이 형태를 따라간다 — 발형은 발 모양, 원형은 원. 토큰이 늘어도 파동은 하나다.
//   uRipGrad: 파동을 단색 대신 **뉴턴 LUT 그라디언트**로. 0 = 단색(uRipCol) · 1 = 완전 LUT.
//     갓 나온 파면이 상단(백열)이고 퍼질수록 하단(적)으로 식는다 — "모든 것은 온도다" 규약을
//     파동에도 그대로 적용한 것. 색을 새로 만드는 게 아니라 있는 LUT 를 훑는다.
uniform float uRip, uRipSpeed, uRipWidth, uRipReach, uRipCol, uRipGrad;
// Success 파문 전용 시계 — **성공한 시각**(호스트 uTime 과 같은 시계). -999 = 미설정.
//   왜 필요한가: Success 파문은 원래 prog 로 돌았는데, Success 의 prog 는 0 에 **고정**이다
//   (FootMark.glow: "k=1 이면 진행도 0 = 가장 진한 상태로 고정" — 유저가 못박은 규칙).
//   그래서 파면이 front=0 에 얼어붙어 '터지지 않고 멈춘 링'이 됐다. 색은 고정, 파문은 흘러야 한다.
uniform float uSuccT;
// 진행 아크의 감김 — 0 이면 기존(로컬 12시에서 시계방향), 1 이면 화면 기준으로 뒤집는다.
//   지면 토큰은 쿼드가 바닥에 누워(−90° X) 감김이 반대로 읽혀 '먼 쪽에서 반시계로 크게
//   그리며' 등장했다(유저 신고). 종목마다 원하는 게 달라 유니폼으로 뺀다 — 지금은 농구만 1.
uniform float uArcRev;
// ── 족저 압력장 · 등고선 ────────────────────────────────────────────────────
//   유저 레퍼런스: Nike Free 압력맵 / 인솔 프레셔 맵. 핵심은 색이 아니라 **색을 정하는 입력**이다.
//   지금까지는 '중심에서의 거리'였다 — 그래서 아무리 색을 풍부하게 해도 압력 분포가 아니라
//   그라디언트 칠한 원반으로 읽혔다(유저: 너무 도형 같다 · 섬세한 미학이 없다).
//   uPlantar: 압력장 혼합(0 = 옛 방사 · 1 = 압력장). 발형은 해부학 핫스팟, 원형은 중심 압력.
//   uBands:   등고선 단계 수(0 = 연속). 레퍼런스의 계단 밴드가 '데이터'로 읽히게 하는 장치.
//   uBandSoft: 밴드 경계 무름(0 = 칼금 · 1 = 뭉근).
uniform float uPlantar, uBands, uBandSoft;
uniform float uPressA;   // 압력 투명도 — 0 = 끔(기본). 저압부를 은은하게 비워 입체감을 낸다
// 접지 창(CoP) — 지금 실제로 바닥에 닿아 있는 자리. 걷기는 하중의 세기만 변하는 게 아니라
//   **닿는 면적이 뒤꿈치 바깥에서 엄지로 옮겨 간다**(보행 문헌의 gait line / butterfly diagram).
//   uCop = 압력중심 위치 · uCopR = 그 시점 접지 타원의 반지름(초기접지 작게 → 중간입각 크게)
//   uCopA = 0 이면 예전 그대로 해부학 블롭 고정(기본) — 다른 화면은 아무것도 안 바뀐다.
uniform vec2 uCop, uCopR; uniform float uCopA;
//   uLoadBall/Heel/Toe = **하중 배분**(marklang LOAD). 기본값이 곧 옛 상수라 안 건드리면 픽셀 동일.
//     이게 없어서 압력장이 전 상태 공통 한 벌이었다 — "앞꿈치에 힘 실어라"를 그림이 말할 수 없었다.
uniform float uLoadBall, uLoadHeel, uLoadToe;
//   uLoadGain = 하중 세기 · uLoadBase = 비접지 바닥(낮출수록 접지 대비가 산다) · uFlow = 딛는 흐름.
//     기본 1 / 0.30 / 0 이면 도입 전과 픽셀 동일(롤백 지점). 색은 손대지 않는다 —
//     앞볼 피크는 이미 lut(0.076)=#FA3030(팔레트 최강)이고, 별도 램프는 금지다(fillT 주석).
//     세지는 길은 **면적과 대비**뿐이다.
uniform float uLoadGain, uLoadBase, uFlow;
// uSilFit: 실루엣이 쿼드에서 차지하는 비율(기준 0.78 대비). 1 = 옛 그대로.
//   ext·해부학 좌표는 '0.78 로 구웠을 때' 기준의 uv 값이라, 채움비가 바뀌면 같이 줄어야 한다.
uniform float uEdgeShade, uEdgeW, uEdgeSoft, uDither, uSilFit;
uniform float uEdgeShadeW, uEdgeShadeCol;   // 실루엣 이너 섀도우 면적 배율 · 팔레트 색(0흰/1샌드/2코랄/3레드) — 유저: 면적·색 조정
uniform float uIceOld;   // 1 = 아이스 컷 이전(하늘색) 램프 — 비교 미리보기용 토글(유저)
uniform float uTLo, uTHi, uDotMode;   // 상태 온도 창(색 축) — 0 = 미설정(각 상태 기본 창)
uniform float uEdgeShadeGrad, uEdgeShadeG0, uEdgeShadeG1;   // 이너 섀도우 LUT 그라디언트(0 단색) · 시작/끝 LUT 위치 — 섬세 조정(유저)
// uShadeRed / uShadeRedW: **음영 자리에 까는 뉴턴 RED 블룸** (유저: 바닥 색에 가장 빨간 뉴턴 레드가
//   부족하다 — 음영 지는 부분에 은은한 블러로). 이너 섀도우는 LUT 상단(PRISM)이라 형태는 잡아도
//   화면에서 빨강이 옅다. 같은 자리에 훨씬 **넓은 가우시안**으로 RED 를 한 겹 깔면, 경계선이 아니라
//   '음영의 온도'로 읽힌다. 새 색이 아니다 — 팔레트 RED 그대로다(규칙 ①).
//   uShadeRed 0 = 도입 전과 픽셀 동일(롤백 지점). uShadeRedW = 엣지 폭의 배수(클수록 더 흐리게 번짐).
uniform float uShadeRed, uShadeRedW;
/** 압력 0~1 (1 = 최고압). 발형은 자국 깊이 × 해부학 가중, 원형은 중심이 최고압.
 *  좌표는 uv[-1,1]. 오른발은 실루엣 SDF 자체가 미러라 별도 분기가 필요 없다. */
float plantar(vec2 pQ, float sdIn, float sd){
  // 해부학 좌표는 채움비 0.78 기준으로 잡은 값이라, 쿼드가 넓어지면 되돌려 읽어야 자리가 맞는다.
  vec2 p = pQ / max(uSilFit, 0.05);
  float blob;
  if (uShape < 0.5) {                       // 존 원 — 해부학이 없다. 중심 압력 + 약한 비대칭.
    float r = length(p) / max(0.46 * uRadius, 1e-3);   // p 는 이미 uSilFit 로 되돌려 읽은 좌표
    return clamp(1.0 - r * r * 0.92, 0.0, 1.0);
  }
  // 압력장은 **신발 전체**에 깔린다. 자국 깊이만 쓰면 자국 바깥(신발 안)이 전부 압력 0 =
  //   최저 대역으로 깔려서 그라디언트가 실루엣의 일부만 덮는다(유저 지적).
  //   겉(신발) 깊이가 바탕이고, 자국 안쪽이 실제 접지라 그 위에서 압력이 올라간다.
  float sfd = max(uSilFit, 0.05);   // 깊이 램프도 실루엣 축척을 따라간다
  float dShoe = clamp(-sd / (0.30 * sfd), 0.0, 1.0);
  float dFoot = clamp(-sdIn / (0.13 * sfd), 0.0, 1.0);
  float depth = dShoe * (0.42 + 0.58 * dFoot);
  // 해부학 핫스팟: 앞꿈치 볼(최대) · 뒤꿈치(중간) · 엄지(부분). 레퍼런스의 적/황 자리.
  vec2 b = (p - vec2(0.02, 0.30)) / vec2(0.34, 0.20);  float ball = exp(-dot(b, b));
  vec2 h = (p - vec2(0.00, -0.44)) / vec2(0.26, 0.22); float heel = exp(-dot(h, h));
  vec2 g = (p - vec2(0.17, 0.56)) / vec2(0.15, 0.13);  float toe  = exp(-dot(g, g));
  vec2 a = (p - vec2(-0.13, -0.02)) / vec2(0.22, 0.26); float arch = exp(-dot(a, a));
  blob = uLoadBase + (uLoadBall * ball + uLoadHeel * heel + uLoadToe * toe) * uLoadGain - 0.34 * arch;
  // ── 접지 창 — 해부학 블롭 위에 **움직이는 타원**을 씌운다 ─────────────────────
  //   해부학 자리(볼·뒤꿈치·엄지)는 고정이라 세기만 바꾸면 같은 그림이 밝아졌다 어두워질 뿐이다.
  //   실제 걸음은 닿는 자리가 옮겨 간다 — 그 이동을 CoP 타원이 맡고, 해부학 블롭은 그 안에서
  //   '어디가 더 눌리는가'만 담당한다(곱한다). 그래서 발 모양은 유지된 채 접지면이 흐른다.
  if (uCopA > 0.001) {
    vec2 dC = (p - uCop) / max(uCopR, vec2(0.06));
    float win = exp(-dot(dC, dC));
    //   ★ 창은 **맨발 프린트 안에서만** 접지한다. 안 그러면 깔창 위에 둥근 얼룩이 떠다니고
    //     발가락·아치가 안 나온다 — depth 의 0.42 바닥이 프린트 밖에도 절반을 남기기 때문.
    //     이 곱으로 접지면이 발 모양(발가락 갈라짐·움푹 팬 아치)을 갖는다.
    win *= mix(0.14, 1.0, smoothstep(0.02, -0.05, sdIn));
    //   창 안은 램프의 레드 끝까지 닿아야 한다 — 1.45 로는 접지 중심도 주황에서 멈췄다(실측).
    blob = mix(blob, (0.30 + 0.70 * clamp(blob, 0.0, 1.4)) * win * 2.6, clamp(uCopA, 0.0, 1.0));
  }
  // ── 딛는 흐름 ─────────────────────────────────────────────────────────────
  //   하중 중심(발 장축)에서 **뒤로 길게 끌리고 앞은 짧게 끊긴다**. 앞뒤 비대칭이 곧 방향이다 —
  //   대칭이면 그냥 얼룩이고, 비대칭이라야 체중이 뒤에서 앞으로 구르는 중으로 읽힌다.
  //   중심은 선언하지 않는다: 하중 배분(uLoad*)에서 자동으로 나온다. 두 벌이 되면 반드시 어긋난다.
  if (uFlow > 0.001) {
    float wsum = max(uLoadBall + uLoadHeel + uLoadToe, 1e-3);
    float cy = (uLoadBall * 0.30 + uLoadHeel * (-0.44) + uLoadToe * 0.56) / wsum;
    float dy = p.y - cy;
    float tail = exp(-pow(max(-dy, 0.0) / 0.62, 2.0));   // 지나온 쪽 — 길게 남는다
    float head = exp(-pow(max( dy, 0.0) / 0.22, 2.0));   // 가는 쪽 — 짧게 끊긴다
    blob += uFlow * max(tail * 0.55, head);
  }
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
  // 0 PRISM(#D1FEFF · 하늘빛) · 1 SAND · 2 CORAL · 3 RED · 4 순백
  //   ★ 4(순백)는 나중에 붙였다 — 랩 버튼이 0 을 '흰'이라 불렀지만 실제로는 PRISM 이라,
  //     발자국 각인·이너 섀도우가 통째로 푸른끼를 띠었다(유저 08-05). 인덱스 0~3 의미는
  //     저장본 호환을 위해 건드리지 않고, 진짜 흰색을 4 로 추가한다.
  return i < 0.5 ? C_ICE : i < 1.5 ? C_SAND : i < 2.5 ? C_CORAL : i < 3.5 ? C_RED : vec3(1.0);
}
/** 디더용 자립 해시 — 호스트의 fxhash 에 기대면 fxlab·parity 처럼 자체 공통부를 쓰는 곳에서
 *  셰이더가 통째로 죽는다(실제로 죽였다). MARK_GLSL 은 lut 외에는 자립해야 한다. */
float mkHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mkUndul(float ang, float t){
  return sin(ang*2.0 + t*1.1)*0.45 + sin(ang*3.0 - t*0.73 + 1.7)*0.33 + sin(ang*5.0 + t*0.41 + 4.2)*0.22;
}
// 일반화 부호 거리 — 존 원 / 발형이 같은 상태 머신을 공유 (1.9922 = float SDF 디코드 정본 계수)
float mkSD(vec2 p, float u1){
  // ★ 존 원은 SDF 가 아니라 **해석적 원**이라 채움비를 자동으로 안 따라간다. uSilFit 을 안 곱하면
  //   평면만 QUAD_K 배로 커지고 원은 그대로여서 원이 1.5배로 부푼다(유저: 원형이 과하게 커졌다).
  if (uShape < 0.5) return length(p) * (1.0 + u1 * uNoise * 0.04) - 0.46 * uRadius * max(uSilFit, 0.05);
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
#define T_PREV_HI mix(0.93, 0.99, uIceOld)   // 아이스 컷(신) ↔ 구 하늘 램프 — uIceOld 토글
#define T_HOT_LO  0.10
#define T_HOT_HI  mix(0.94, 1.00, uIceOld)
#define T_ACT_LO  0.06
#define T_ACT_HI  0.86   // 몸체 상한 = SAND 정점 — 더 진한 주황(유저 2차)
#define T_HOLD_LO 0.04
#define T_HOLD_HI mix(0.89, 0.92, uIceOld)
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
// ★★ **상태 색 축**(유저: 색 조합을 쨍한 빨강부터 연한 주황까지 그라디언트로 구분).
//   상태의 정체성은 '온도 창(lo~hi)'이 정한다고 이 파일이 이미 적어 뒀는데, 그 창이 #define
//   컴파일 상수라 **상태별로 못 움직였다** — 그래서 Active·Warning·Success 가 같은 대역에서
//   뭉쳐 구분이 안 갔고(유저), 결국 외곽선·해칭 같은 **다른 축으로 구분하려는 시도**가 생겼다.
//   창을 uniform 으로 열면 색 하나로 갈린다: uTHi 0 = 미설정 → 각 상태의 기존 창 그대로(픽셀 동일).
//   ※ 규칙은 그대로다 — 새 색을 만들지 않는다. 같은 뉴턴 LUT 의 **다른 구간**을 쓸 뿐이다.
vec3 fillWin(float q, float lo, float hi){
  return (uTHi > 0.0001) ? fillT(q, uTLo, uTHi) : fillT(q, lo, hi);
}
vec3 fillPreview(float q){ return fillWin(q, T_PREV_LO, T_PREV_HI); }
vec3 fillHot(float q){     return fillWin(q, T_HOT_LO,  T_HOT_HI);  }
vec3 fillActive(float q){  return fillWin(q, T_ACT_LO,  T_ACT_HI);  }
vec3 fillHold(float q){    return fillWin(q, T_HOLD_LO, T_HOLD_HI); }
// Success 는 코어가 가장 뜨겁고(하한이 낮다) 바깥이 백열로 열린다 — 승리의 온도.
// 상한을 1.0(순백) 이 아니라 0.92 로 — 순백까지 열면 코어와 분리된 흰 링이 생긴다(유저: 아이스 과함).
vec3 fillSuccess(float q){ return fillWin(q, mix(0.02, 0.03, uIceOld), mix(0.78, 1.00, uIceOld)); }   // 신 = 피그마 성공 정본(163:8908) 쨍한 레드-코랄 · 구 = 백열/아이스
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
  // 진행 각도 — 12시에서 시작해 **시계방향**.
  //   지면 토큰은 쿼드가 바닥에 누워(−90° X) 있어 감김이 뒤집힌다. 그래서 화면에서는
  //   '먼 쪽에서 반시계로 크게 그리며' 등장하는 것으로 읽혔다(유저 신고). 부호를 뒤집어
  //   화면 기준 시계방향으로 맞춘다.
  //   uArcRev 1 = 앞쪽(가까운 쪽)에서 시작해 화면 기준 시계방향. 지금은 농구만.
  float a01 = uArcRev > 0.5 ? fract(0.75 + ang / 6.2832) : fract(0.25 - ang / 6.2832);
  float u1 = mkUndul(ang + uSeed, t * 1.6);
  float sd = mkSD(uv, u1);
  float aa = max(fwidth(sd), 0.004) * 1.4;     // 화면공간 AA
  float inside = smoothstep(aa, -aa, sd);
  // 필 전용 소프트 엣지 — 우리 UI 의 강점은 그라디언트의 부드러움인데, 하드 마스크가 경계에
  //   선을 그어 원반처럼 보이게 했다(유저). 안쪽으로 uEdgeW 만큼 페더링해 형태가 색으로 읽히게.
  float feath = smoothstep(0.0, max(uEdgeW, 1e-4), -sd);
  float inFill = mix(inside, inside * feath, clamp(uEdgeSoft, 0.0, 1.0)) * clamp(uFillOp, 0.0, 1.0);
  // 압력 투명도(uPressA) — 색만으로 그리던 압력을 **알파에도** 태운다. 눌린 자리는 그대로
  //   차 있고 덜 눌린 자리(아치·가장자리)가 은은하게 비쳐서, 판때기가 아니라 입체로 읽힌다.
  //   ★ 여기 한 줄이 7상태 전부에 걸린다 — 아래 lay(...) 가 모두 inFill 을 곱하기 때문.
  //     상태마다 따로 넣으면 반드시 어긋난다.
  //   0 = 예전 그대로(기본). 완전히 뚫지 않는다 — 바닥 0.30 은 형태가 끊기지 않을 만큼만 남긴다.
  //   ★ prA 를 그대로 곱하면 **토큰 전체가 흐려진다**(유저). 압력장은 실제로 1 까지 안 올라와서
  //     (실측 peak ≈ 0.6) 가장 진한 자리마저 30% 깎였다. 어느 정도 눌린 자리는 **1 로 포화**시키고,
  //     덜 눌린 자리만 비운다 — 색은 그대로 두고 알파만 빠지는 게 요점이다.
  if (uPressA > 0.001) {
    float prA = smoothstep(0.05, 0.50, plantar(uv, mkSDIn(uv), sd));
    inFill *= mix(1.0, 0.42 + 0.58 * prA, clamp(uPressA, 0.0, 1.0));
  }
  float outPos = max(sd, 0.0);
  // 점선 = 회피 계약 (일렁임과 분리한 저주기 — '털 뜯김' 방지 확정판)
  float dashM = (uContract > 0.5 && uContract < 1.5)
              ? smoothstep(0.30, 0.60, 0.5 + 0.5 * sin(ang * 10.0)) : 1.0;
  float sf = max(uSilFit, 0.05);
  float ext = (uShape < 0.5 ? 0.46 * uRadius : 0.72) * sf;
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
    lay(A, hCol, h * uHalo * (0.50 + 0.14 * sin(t * 5.0)) * dashM);   // 0.34 로 내렸다가 흐려졌다(유저) — 복귀
  } else if (state < 2.5) {     // ── Hold: 실루엣 아웃라인을 따라 그려지는 진행 스트로크
    float pr = prog;
    vec2 gc = mix(gcBall, gcHeel, pr);
    float q = mkR(uv, gc, ext * 1.02, sd);
    float qh = max(q - 0.24 * pr, 0.0);
    lay(A, fillHold(qh), inFill * min(fillGain, 1.0) * 0.95);
    // ── Hold 전용 아웃라인 (유저 확정 방향) ────────────────────────────────
    //   예전 구조는 '중심에서 각도로 훑는 레이저 감지' 였다: 미완주 구간까지 무채 트랙(C_RIMG)을
    //   깔았고, 그 회색이 밝은 이너 섀도우 **위에** 얹혀 12시 자리에 홈이 파였다(유저 확대 스샷).
    //   이제 트랙을 아예 그리지 않는다 — **지나온 구간만** 실루엣 등거리선 위에 스트로크로 그린다.
    //   ① 스트로크는 실루엣을 따라간다(sd 기준이라 발이면 발 모양, 원이면 원)
    //   ② 길이를 따라 색이 흐른다(진한 빨강 → 선단 민트)
    //   ③ 양끝은 가우시안으로 흐려진다 — 폭과 알파를 **함께** 줄여야 잘린 끝이 안 생긴다
    float fw = max(fwidth(sd), 1e-5);
    // 굵기 1.55배 — 얇은 스트로크가 실사 바닥 텍스처에 묻혀 홀드 진행이 안 읽혔다(유저).
    float strokeW = max(0.040 * uW, 1.6 * fw);
    float dRim = abs(sd + 0.008);              // 실루엣 살짝 안쪽에 얹는다
    // 진행 좌표: 0(시작) → pr(선단). 양끝 블러 폭은 각도 단위.
    // 마감 수렴(유저): 진행이 끝나는 순간 링이 12시에서 '한 바퀴 닫혔다'로 읽혀야 한다.
    //   평시 블러 0.16(≈58°)은 부드럽지만, 그대로면 선단·시작 페이드가 12시에서 겹쳐 끝까지
    //   틈이 남는다 → 막판(86%~)에 양끝 블러를 조여 원이 닫히고, 완주 프레임은 풀 링.
    // ── 미완주 가이드 트랙 (유저 08-06: 홀드 들어가면 라인이 확 줄어 화면이 빈다) ──
    //   예전 트랙을 지운 이유는 '트랙이 있어서'가 아니라 **무채(C_RIMG)라서** 였다 —
    //   회색이 밝은 이너 섀도우 위에 얹혀 12시에 홈이 파였다. 그래서 색만 바꿔 되살린다:
    //   어둡게가 아니라 **밝게 옅게**(빛 언어 원칙 — 어두운 외곽선 금지). LUT 상단 연주황을
    //   아주 낮은 알파로 실루엣 한 바퀴. 지나온 스트로크가 그 위를 덮어 진행이 그대로 읽힌다.
    float rnT = dRim / max(strokeW * 0.62, 1e-5);
    lay(A, lut(0.86), exp(-rnT * rnT * 1.1) * dashM * uW * (0.13 + 0.03 * sin(t * 1.7)));
    float closeK = smoothstep(0.86, 1.0, pr);
    float BLUR = mix(0.16, 0.035, closeK);
    float head = clamp(pr, 0.0, 1.0);
    float aIn  = smoothstep(0.0, BLUR, a01);                    // 시작 쪽 블러
    float aOut = smoothstep(head + BLUR * 0.10, head - BLUR, a01);  // 선단 쪽 블러
    float body = max(aIn * aOut, step(0.9975, pr)) * smoothstep(0.0, 0.04, pr);
    // 폭도 같이 좁아진다 — 알파만 줄이면 '가늘어지지 않고 흐려지기만' 해서 잘린 끝으로 읽힌다.
    float wk = mix(0.16, 1.0, body);
    float rn = dRim / max(strokeW * wk, 1e-5);
    float stroke = exp(-rn * rn * 1.5) * dashM;
    // 소프트 글로우 겹 — 스트로크보다 3배 넓고 옅은 후광. 복잡한 실사 위에서 궤적의 존재를
    //   먼저 잡아주는 층(빛 언어 유지 — 어두운 외곽선 금지 원칙).
    float glowRim = exp(-rn * rn * 0.17) * dashM;
    // 길이 방향 그라디언트 — 지나온 쪽은 LUT 저역(진한 빨강), 선단으로 갈수록 상단(민트)
    vec3 strokeCol = lut(clamp(mix(0.02, 1.0, clamp(a01 / max(head, 0.001), 0.0, 1.0)), 0.0, 1.0));
    holdC = strokeCol;
    holdA = max(stroke * body * 0.95, glowRim * body * 0.34);
    // 선단 광점 — 지금 어디까지 왔는지 한 점으로 읽히게. 가우시안이라 각이 안 진다.
    float hd = (a01 - head) / 0.12;   // 광점 0.09→0.12 — '지금 어디'가 실사에서도 잡히게
    float tip = exp(-hd * hd) * step(0.02, pr) * step(pr, 0.995);
    holdC = mix(holdC, lut(1.0), clamp(tip, 0.0, 1.0));
    holdA = max(holdA, max(stroke, glowRim * 0.6) * tip);
    // ── 홀드 숨쉬기 (유저 08-06: 애니메이팅도 줄었다) ──
    //   session.js 가 홀드 중 마크 **위치**를 의도적으로 잠근다(흔들리는 물체 방지) — 그건 유지.
    //   대신 스트로크 밝기만 느리게 맥동시켜 '멈춘 화면'이 아니라 '버티는 중'으로 읽히게 한다.
    //   위치는 그대로라 흔들림은 안 돌아온다. 2.0Hz = 홀드 5초에 10번, 호흡 리듬.
    holdA *= 0.88 + 0.12 * sin(t * 2.0);
  } else if (state < 3.5) {     // ── Success: 진홍 블룸 → 잔상 소멸
    float e = 1.0 - pow(1.0 - prog, 2.6);
    float q = mkR(uv, gcBall, uShape < 0.5 ? ext * 1.3 : 1.75, sd);
    float fillA = (prog < 0.4 ? 1.0 : pow(1.0 - (prog - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    // ── Success 숨쉬기 (유저 08-06: 발자국 석세스가 다 정지 화면으로 보인다) ──
    //   라이브 Success 는 prog 를 **0 에 못 박는다**(FootMark.glow: "가장 진한 상태로 고정").
    //   그래서 이 분기의 모든 값이 상수가 되고, 파문 0.62초가 끝나면 완전 정지 화면이 된다.
    //   랩(shot_mark_seq·footlab)은 prog 를 0→1 로 훑기 때문에 항상 움직여 보였다 — 그래서
    //   "랩은 맞는데 앱만 죽어 있다"가 반복됐다. 오늘 아침 화살표·드리블과 **같은 함정**이다.
    //   Hold 가 쓰는 그 문법을 그대로 빌린다(holdA *= 0.88 + 0.12*sin). 색·진하기는 안 건드리고
    //   밝기만 느리게 맥동한다 — "저절로 흐려지지 않는다"(유저 규칙)를 깨지 않는다.
    //   ★ **밝기만 흔들면 안 된다.** 실측(잉크 면적/반경): 밝기 맥동만 넣은 Success 는
    //     면적 변화 ±0.0% — 사람 눈엔 완전한 정지 화면이다. 픽셀 해시로는 '움직임'이 나와서
    //     내가 이걸 네 번 놓쳤다. 형태(필 반경)를 같이 흔들어야 '살아 있다'로 읽힌다.
    //     대조군: Hold 는 진행 2% 에 멈춰 있어도 면적이 ±6.4% 흔들려 정지로 안 보인다.
    //   ★ 필 반경을 흔들어 봐야 **형태는 안 변한다** — 필은 실루엣 inFill 안에 갇혀 있어서
    //     커버리지가 그대로다(실측 면적 ±0.0%). 형태를 바꾸는 건 실루엣 **바깥**으로 나가는
    //     파문뿐이다. 그래서 살아있게 만드는 일은 아래 파동 분기에서 한다.
    //   ※ 이 파일의 GLSL 은 **템플릿 문자열**이다 — 주석에도 백틱 금지. 백틱이 문자열을 끊어
    //     뒤쪽 셰이더가 JS 로 파싱되고, 모듈이 죽어 **앱 전체가 안 뜬다**(inFill 사고, 08-06).
    fillA *= 0.88 + 0.12 * sin(t * 1.6);               // 밝기 맥동(보조 — 이것만으론 정지로 읽힌다)
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
  // 음영 적열 블룸 — 섀도우보다 **먼저** 얹는다. 위에 프리즘이 와야 형태를 잡는 경계는 그대로고,
  //   빨강은 그 뒤로 넓게 번진다(순서를 뒤집으면 빨간 테두리가 생겨 아웃라인으로 읽힌다).
  //   ★ A.a 를 곱해 **이미 그려진 자리에서만** 달군다 — 빈 곳에 빨강을 새로 켜면 그건 음영이 아니라
  //     또 하나의 토큰이다. Miss·Locked 처럼 필이 옅은 상태에선 자동으로 같이 옅어진다.
  if (uShadeRed > 0.001) {
    float rw = max(uEdgeW * max(uShadeRedW, 0.2), 1e-4);
    float bl = exp(-pow(max(-sd, 0.0) / rw, 2.0)) * inside;   // 가우시안 = 각이 안 지는 번짐
    lay(A, C_RED, bl * uShadeRed * A.a);
  }
  if (uEdgeShade > 0.001) {
    float shW = max(uEdgeW * 0.9 * clamp(uEdgeShadeW, 0.05, 6.0), 1e-4);
    float ins = exp(-pow(max(-sd, 0.0) / shW, 1.1)) * inside;
    // 섀도우 색 = 팔레트 단색(uEdgeShadeCol) ↔ 뉴턴 LUT 그라디언트(uEdgeShadeGrad).
    //   그라디언트는 **라인을 따라** 흐른다(유저: 깊이 방향이 아니라 윤곽선 자체에 아름답게) —
    //   앞꿈치(G0)→뒤꿈치(G1)로 발 길이 방향을 LUT 로 훑는다. 색을 새로 만들지 않는다(팔레트 규약).
    float shAlong = clamp(uv.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 shCol = mix(palPick(uEdgeShadeCol), lut(mix(uEdgeShadeG0, uEdgeShadeG1, shAlong)), clamp(uEdgeShadeGrad, 0.0, 1.0));
    lay(A, shCol, ins * uEdgeShade);
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
    float sfi = max(uSilFit, 0.05);
    float aaI  = max(max(fwidth(sdIn) * mix(3.4, 0.9, clamp(uImpSharp, 0.0, 1.0)),
                         mix(0.055, 0.004, clamp(uImpSharp, 0.0, 1.0)) * sfi), 0.0015);
    float inIn = smoothstep(aaI, -aaI, sdIn) * inside;   // 신발 안 ∩ 맨발 안
    float pit  = max(uImpPitch, 0.008);
    // 도트 격자 — 프로토타입 foot-*-dots.svg 규약: 정사각 격자, 점 지름 = 피치의 50%
    //   (실측: 간격 1.8px · 지름 0.9px on 48px 폭). 그래서 uImpDot 기본 0.25(=반지름/피치).
    vec2  cc  = fract(uv / pit) - 0.5;
    float dd  = length(cc) * pit;
    // 상한 0.5 = 점이 셀 안에 갇힌다 → 아무리 키워도 **격자가 남는다**. 1.0 까지 열어 두면
    //   같은 각인 채널을 도트가 아니라 **채움**으로도 쓸 수 있다(기본 0.25 는 그대로).
    //   셀 모서리까지 덮으려면 반지름이 대각선 절반(0.707) + 아래 dSoft(≈0.14) 를 넘어야 한다
    //   → uImpDot ≳ 0.86 부터 완전한 채움. 0.75 는 아직 격자가 비쳐 보인다(실측).
    float rad = pit * clamp(uImpDot, 0.03, 1.0);
    float dAA = max(fwidth(dd), 1e-5) * 1.2;
    float dSoft = max(pit * mix(0.34, 0.12, clamp(uImpSharp, 0.0, 1.0)), dAA);
    float dotM = smoothstep(rad + dSoft, rad - dSoft, dd);
    // 자국 안쪽 깊이 — 가장자리는 옅고 안으로 갈수록 또렷(프린트 잉크가 고인 느낌).
    //   전면 균일하게 찍으면 도트가 실루엣을 무시하고 격자만 보인다.
    //   선명하게 갈수록 램프도 같이 좁아져야 한다 — 안 그러면 경계만 또렷하고 안쪽이 무르다.
    float depR = mix(0.185, 0.018, clamp(uImpSharp, 0.0, 1.0)) * sfi;
    float dep = smoothstep(0.0, depR, -sdIn);
    // 가장자리에서 0.34 로 남으면 도트 영역이 그 밝기로 뚝 끊긴다 — 0 까지 내려 배경과 어우러지게.
    // ★ 도트 농도 = 압력 (유저 08-06 레퍼런스: 나이키 깔창 — 도트 농도가 곧 압력이다).
    //   전엔 dep(경계로부터의 깊이)만 썼다. plantar 가 만든 볼·뒤꿈치·아치 분포가 **도트에는
    //   하나도 안 실려서**, 압력은 필 색 램프에만 은근히 있고 도트는 발 전체에 균일하게 깔렸다.
    //   격자·피치·점 크기·이너 섀도우는 그대로 두고(스타일 동결) **압력 없는 자리에서 도트를
    //   걷어내기만** 한다 — 아치가 비는 순간 그림이 발자국으로 읽힌다.
    //   최대치 1.0 유지 = 고압부는 도입 전과 동일. uPlantar 0 이면 전 픽셀 동일(롤백 지점).
    float prI = plantar(uv, sdIn, sd);
    float press = mix(1.0, 0.16 + 0.84 * prI, clamp(uPlantar, 0.0, 1.0));
    // 도트 색 = 압력 온도. 전엔 단색이라 알파만 압력을 탔고, 고압부의 지정색(레드)이
    //   그 아래 필(연주황)과 색이 안 이어져 해칭이 통째로 끊겨 보였다(유저 08-06).
    //   압력이 빠질수록 LUT 를 따라 주황(coral t=0.56) → 연주황(sand t=0.86) 으로 식는다 —
    //   필이 이미 그 구간에 있으므로 경계가 사라진다. 새 색은 만들지 않는다(유채 4색 규칙).
    //   ※ 지정 팔레트색(uImpDotCol)은 **극성을 뒤집는 원인**이라 도트에서 은퇴했다(유저 08-06).
    //     선언은 남겨 둔다 — 저장본 호환(랩 버튼)과 다른 소비처가 있다.
    // ★ 도트 색 = **3안 비교용 유니폼**(유저: 버전들 버튼으로 눌러 보게 해줘).
    //   0 = 단색 순백(09:25 저장본 · 각인이 필과 다른 색이라 발가락·아치 형태가 산다)
    //   1 = 압력 온도 그라디언트(13:31) — 저압 연주황 → 고압 순백
    //   2 = 상태 온도 창 안으로 클램프(14:23) — 필과 같은 계열, 극성 고정
    //   기본 0. 랩에서만 갈아 끼운다(mark-look.json dotMode 로도 저장 가능).
    float dotT = clamp(press * dep, 0.0, 1.0);
    vec3 dotSolid = palPick(uImpDotCol);
    vec3 dotGrad  = mix(lut(mix(0.86, 0.56, dotT)), palPick(uImpDotCol), smoothstep(0.72, 1.0, dotT));
    float dwHi = (uTHi > 0.0001) ? uTHi : 0.86;
    float dwLo = (uTHi > 0.0001) ? uTLo : 0.56;
    vec3 dotWin   = lut(mix(dwHi, mix(dwHi, dwLo, 0.65), dotT));
    vec3 dotC = (uDotMode < 0.5) ? dotSolid : (uDotMode < 1.5 ? dotGrad : dotWin);
    lay(A, dotC, inIn * dotM * uImp * (0.06 + 0.94 * dep) * press);
    // 이너 섀도우 — 경계 **안쪽**에서 최대, 안으로 갈수록 사라진다. 자국이 '눌려 들어간' 자리로 읽힌다.
    //   빛을 빼지 않는다(위 uImpShade 주석): LUT 저역(RED)을 얹어 어느 바닥에서도 그림자로 읽히게.
    // 각인 음영에도 같은 블룸을 — 음영은 실루엣이든 자국이든 하나의 언어여야 한다.
    //   세기 0.7 배: 자국 음영은 실루엣 음영 **안에** 겹쳐 앉으므로 같은 값이면 두 겹이 쌓여 과열된다.
    if (uShadeRed > 0.001) {
      float rwI = max(uImpEdge * max(uShadeRedW, 0.2), 1e-4);
      float blI = exp(-pow(max(-sdIn, 0.0) / rwI, 2.0)) * inIn;
      lay(A, C_RED, blI * uShadeRed * uImp * 0.7);
    }
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
    // ★ **시각으로 돈다**(유저 08-06: 서세스 애니메이팅이 안 돌아간다).
    //   prog 구동은 Success 에서 구조적으로 불가능하다 — 그 상태의 prog 는 0 고정이 규칙이라
    //   ripCyc 가 항상 0, 파면이 front 0 에 얼어붙는다. 정지한 링이 화면에 남던 게 이것이다.
    //   uSuccT 가 있으면 성공 순간부터 0.62초에 걸쳐 한 번 퍼지고 끝난다(단발 규약 유지).
    //   미설정(-999)이면 옛 식 그대로 — 다른 호스트(fxlab·footlab 데모)는 영향 없다.
    // ★ 구동자가 하나도 없으면(시계 미설정 + prog 0) **정지하지 말고 루프로 떨어진다.**
    //   옛 식은 그 경우 cyc 0 에 얼어붙어 실루엣에 딱 붙은 링이 영원히 남았다 — 오늘 하루
    //   "석세스가 멈춰 있다"의 정체다. 값이 없으면 조용히 굳는 대신 살아 있는 쪽이 기본이어야 한다.
    float shot = uSuccT > -900.0 ? clamp((t - uSuccT) / 0.62, 0.0, 1.0)
               : (prog > 0.001 ? clamp(prog / 0.80, 0.0, 1.0) : 1.0);
    if (shot < 1.0) {                        // ① 성공 순간 = 한 번 크게 '팡'
      ripCyc = shot; ripK = 1.9;
    } else {                                 // ② 그 뒤 = 잔잔히 반복 — 여기가 '살아있음'이다
      // Success 는 prog 가 0 에 고정이라 필·실루엣이 전부 상수다(실측 면적 ±0.0%).
      // Hold 가 정지로 안 보이는 이유는 파문을 **루프**로 돌리기 때문이다(fract(t*uRipSpeed)).
      // 같은 문법을 Success 에도 준다 — 세기·거리를 낮춰 '팡'과 구분되게.
      ripAmt = uRip * 0.5; ripCyc = fract(t * 0.40); ripK = 1.2;
    }
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
  const sw = s * (opts.scale ?? 1);                   // 두께·촉만의 배율(길이는 캔버스 그대로)
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
  const w0 = 1.1 * sw * AW, w1 = 13 * sw * AW;        // 뿌리 폭(거의 0) → 꼭짓점 폭
  // ★ 스템 턱(tuck) — 촉이 보이면 스템 끝을 촉 뒤로 당겨 숨긴다. 촉 SVG는 뒤가 파인
  //   셰브런이라, 스템 머리(w1)가 그 파임 사이로 삐져나와 막대가 뚫고 나온 것처럼
  //   보였다(유저 스샷 08-04 '제발'). 촉 알파 램프와 같은 속도로 당겨 점프가 없다.
  const tipS0 = 42 * sw * (0.7 + 0.3 * AW);   // 촉 크기 — 곡선(drawCurveArrow)과 동일 정본. 직선만 34로 남아 갈렸었다(유저)
  const tuck = (!opts.noTip && draw > 0.28) ? Math.min(1, (draw - 0.28) / 0.22) * tipS0 * 0.42 : 0;
  const yHead = yEnd + tuck;
  const grad = g.createLinearGradient(0, y0, 0, yHead);
  // 뿌리는 알파 0으로 사라지되(유저 확정) 몸통은 금방 진해진다 — 예전 램프(0.10/0.38)는 스템 대부분이
  // 반투명이라 지면에 투사하면 통째로 흐려 보였음(유저: 화살표가 왜 이렇게 흐려졌어).
  // 뿌리 투명 구간 연장(0.10→0.18 에서야 첫 스톱) — 출발점이 딱 끊겨 보였다(유저: 부드럽게)
  grad.addColorStop(0.00, rgba(0.55, 0));
  grad.addColorStop(0.18, rgba(0.64, 0.30 * A0));
  grad.addColorStop(0.40, rgba(0.76, 0.80 * A0));
  grad.addColorStop(0.65, rgba(0.88, 0.98 * A0));
  grad.addColorStop(1.00, rgba(0.97, A0));
  // 볼류메트릭 언더글로우 — 같은 폴리곤을 1.9배 넓혀 블러 밴드로. shadowBlur 없이 스템이
  //   판에 붙은 종이처럼 평평했다(유저: 발자국 토큰과 감도 차이). 링의 volRing 과 같은 취지.
  // ★ 도트 스템의 흐름 — **점 목록을 한 번 계산**해 언더글로우와 본체가 같은 점을 쓴다.
  //   따로 계산하던 시절엔 개수 상수(13)를 한쪽만 고쳐 글로우와 점이 어긋났다.
  //   유저 08-06: "더 촤르르륵 · 더 쫀뜩 · 끝에는 약간 투명도".
  //     촤르르륵 = 점이 뿌리→머리로 **흘러간다**(간격 유지, 한 칸 주기로 순환)
  //     쫀뜩     = 촘촘하게(13→9.5) + 흐름을 타고 **뭉쳤다 늘어나는** 사인 스퀴즈
  //     끝 투명  = 머리 쪽 마지막 구간 알파를 깎는다. 순환하는 점이 머리에서 툭 사라지는
  //                이음매를 가리는 일도 같이 한다(뿌리 쪽 소멸은 그라디언트가 이미 한다).
  const dotList = opts.dots ? (() => {
    const seg = Math.abs(yHead - y0);
    const N = Math.max(3, Math.round(seg / (9.5 * sw)));
    const dph = (t * 1.15 * speed) % 1;
    const sm = (a2, b2, x) => { const u = Math.max(0, Math.min(1, (x - a2) / (b2 - a2))); return u * u * (3 - 2 * u); };
    const out = [];
    for (let i = 0; i < N; i++) {
      const u = ((i + 0.5) / N + dph / N) % 1;
      const squeeze = 1 + 0.22 * Math.sin((u * 3 - dph * 2) * Math.PI * 2);
      out.push({ y: y0 + (yHead - y0) * u,
                 r: (w0 / 2 + (w1 / 2 - w0 / 2) * u) * squeeze,
                 // 끝 투명 = '약간'(0.72~0.92 에서 −35%) + **머리 끝은 0 으로**(0.92~1).
                 //   0 이 안 되면 순환하는 점이 알파 0.5 에서 툭 사라져 흐름이 끊겨 보인다
                 //   (유저: 애니메이팅 끊기는 느낌). 이음매는 알파 0 에서만 안 보인다.
                 a: (1 - 0.35 * sm(0.72, 0.92, u)) * (1 - sm(0.92, 1, u)) });
    }
    return out;
  })() : null;
  g.save(); g.filter = `blur(${7 * sw}px)`; g.globalAlpha = opts.dots ? 0.30 : 0.55;
  g.fillStyle = grad;
  if (opts.dots) {
    // 도트 모드에선 언더글로우도 점으로. 폴리곤 밴드를 깔면 점 사이가 메워져 다시 막대가 된다.
    const gA = g.globalAlpha;
    for (const d of dotList) {
      g.globalAlpha = gA * d.a;
      g.beginPath(); g.arc(cx, d.y, Math.max(1.4 * sw, d.r * 1.5), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = gA;
  } else {
    g.beginPath();
    g.moveTo(cx - w0, y0); g.lineTo(cx + w0, y0);
    g.lineTo(cx + w1 * 0.95, yHead); g.lineTo(cx - w1 * 0.95, yHead);
    g.closePath(); g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
  g.fillStyle = grad;
  if (opts.dots) {
    // ★ 도트 스템(지면 전용, 유저 08-05) — 벽은 이어진 테이퍼 자루, **바닥은 점렬**이다.
    //   같은 토큰·같은 촉·같은 램프를 쓰고 자루의 '재질'만 바꾼다(문법 공유, 렌더만 절제).
    //   점 크기는 스템 폭 테이퍼를 그대로 따라 뿌리에서 머리로 굵어진다 = 방향이 점에서도 읽힌다.
    for (const d of dotList) {
      g.globalAlpha = d.a;
      g.beginPath(); g.arc(cx, d.y, Math.max(0.9 * sw, d.r * 0.92), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  } else {
    g.beginPath();
    g.moveTo(cx - w0 / 2, y0); g.lineTo(cx + w0 / 2, y0);
    g.lineTo(cx + w1 / 2, yHead); g.lineTo(cx - w1 / 2, yHead);
    g.closePath(); g.fill();
  }
  g.globalAlpha = A0;
  if (draw > 0.28 && !opts.noTip) {   // noTip = 촉 없는 자루(감속 바 등)
    // 촉은 '자라는 머리'에 항상 붙는다(고정 위치 X) → 자라는 동안에도 화살표로 읽힌다.
    const tipS = tipS0;   // 촉 크기(유저 3회 축소) — 스템:촉 비율 정본
    const tipA = Math.min(1, (draw - 0.28) / 0.22) * A0;
    const ty = yEnd + tipS * 0.30;                     // 머리보다 살짝 뒤 = 촉 끝이 스템 끝과 맞음
    g.globalAlpha = tipA;
    const go = { color: lut(0.95), glowColor: lut(0.85), glow: 12 * glowK };
    const ok = ENV.glyph && (ENV.glyph(g, 'LIFT_TIP', cx, ty, tipS, go)
                          || ENV.glyph(g, 'TIP_TRI', cx, ty, tipS * 0.93, go));
    if (!ok) {                                        // 글리프 미로드 폴백 = 같은 비율 스트로크 촉
      g.strokeStyle = lut(0.95); g.lineWidth = 13 * sw * AW; g.lineCap = 'round'; g.lineJoin = 'round';
      g.shadowColor = lut(0.9); g.shadowBlur = 18 * sw * glowK;
      g.beginPath(); g.moveTo(cx - 26 * sw, ty + 14 * sw); g.lineTo(cx, ty - 16 * sw); g.lineTo(cx + 26 * sw, ty + 14 * sw); g.stroke();
    }
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
}

/** 곡선 화살표 — LINE 정본(스템+촉)의 경로 버전. 유저 가이드 스케치의 '궤적 표시':
 *  출발 원(반대편 지면)에서 시작해 곡선으로 흘러 들린 발마크로 들어가고, 머리에 같은 촉 글리프가 붙는다.
 *  pts01 = [[x,y],...] 정규화 캔버스 좌표(0..1, y는 아래로). 2차/3차 무관 — 통과점을 카트멀롬 보간.
 *  opts.prog = 진행도(0..1). 스템과 같은 언어: 뿌리 알파 0 → 머리 최대.
 *  opts.scale = 두께·촉 배율(길이는 그대로) — 캔버스가 덮는 실측 크기가 다른 판끼리
 *    벽에서의 물리 두께·촉 크기를 맞출 때 쓴다(session.LINE_M). opts.alpha = 전체 알파. */
export function drawCurveArrow(g, W, H, pts01, t, ENV, opts = {}) {
  const lut = ENV.lut, A = ENV.arrow || {};
  const AW = A.w ?? 1, glowK = A.glow ?? 1;
  const s = (H / 256) * (opts.scale ?? 1);
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
  const A0 = opts.alpha ?? 1;
  // tail = 꼬리가 스러지는 구간(경로 비율). 게이지 아크(floorgl arcGauge tailFade)와 같은 규약 —
  //   짧게 끊으면 선이 '뚝' 잘려 보인다(유저: 꼬리 끝이 어색). 회전은 0.54 로 길게 흘린다.
  const tail = opts.tail ?? 0.22;
  // 선 — 뿌리 알파 0 → 머리 최대. 두께·색 램프는 drawStemArrow 와 같은 값(1.1→13px, lut 0.55→0.97).
  //   예전엔 여기만 1.6→4.8px 라 같은 LINE 토큰인데 직선은 굵고 곡선은 실처럼 얇았다(유저: A1·B2 화살표가 너무 다르다).
  g.lineCap = 'round';
  // ★ 촉 크기 34→42 + 선 턱(tuck) — 곡선의 굵은 머리(13px)가 셰브런 파임 사이로 삐져나와
  //   촉이 촉으로 안 읽혔다(유저, 회전 큐). 촉 뒤 0.42배 구간의 선을 잘라 숨긴다.
  //   등장 램프와 동속으로 잘라 온셋 프레임에 선-촉 사이 틈이 없다(스템 규약과 동일).
  const tipS = 42 * s * (0.7 + 0.3 * AW);
  let cut = head;
  if (prog > 0.28) {
    let acc = 0;
    const need = tipS * 0.42 * Math.min(1, (prog - 0.28) / 0.22);
    while (cut > 1 && acc < need) { acc += Math.hypot(path[cut][0] - path[cut - 1][0], path[cut][1] - path[cut - 1][1]); cut--; }
  }
  // 언더글로우 밴드(넓고 옅게) → 본선 — 스템의 볼류메트릭 규약과 동일 취지.
  //   2.8배·0.28 은 회전 호가 통통해 보였다(유저) — 1.9배·0.16 로 슬림. 뿌리 쪽은
  //   k² 로 한 번 더 눌러 출발 지점이 더 투명하고 부드럽게 태어난다.
  for (const pass of [0, 1]) {
    for (let i = 1; i <= cut; i++) {
      const k = i / head;
      const f = Math.min(1, k / tail);
      const a = f * f * (3 - 2 * f) * A0;
      g.globalAlpha = pass ? a : a * 0.16 * k;
      g.strokeStyle = lut(0.55 + 0.42 * k);
      g.lineWidth = (1.1 + 11.9 * k) * s * AW * (pass ? 1 : 1.9);
      g.beginPath(); g.moveTo(path[i - 1][0], path[i - 1][1]); g.lineTo(path[i][0], path[i][1]); g.stroke();
    }
  }
  // 촉 — 머리에서 접선 정렬(글리프 규약 ↑=전방). 등장 시점은 스템과 동일.
  if (prog > 0.28) {
    const px = path[Math.max(0, head - 2)][0], py = path[Math.max(0, head - 2)][1];
    const ang = Math.atan2(path[head][1] - py, path[head][0] - px) + Math.PI / 2;
    // 촉을 머리보다 tipS*0.30 뒤로 물린다 = 촉 '끝'이 경로 끝과 맞는다(스템 규약).
    const hx = path[head][0] - Math.sin(ang) * tipS * 0.30, hy = path[head][1] + Math.cos(ang) * tipS * 0.30;
    g.save(); g.translate(hx, hy); g.rotate(ang); g.globalAlpha = Math.min(1, (prog - 0.28) / 0.22) * A0;
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
  // ── 코멧 스트링(c3 시안 C안 — 유저 확정: "코멧 방식이 더 좋다, 직선 별로") ──────────
  //   상시 연결 직선·플로우 획 폐기 — 이동은 **코멧 헤드 + 테이퍼 꼬리**로만 말한다.
  //   순서 읽기는 노드 숫자 1·2·3 이 담당(직선 없이도 성립 — c3 라이브 검증).
  const at = (u) => { const i = Math.max(0, Math.min(pts.length - 2, Math.floor(u))), f = u - i;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; };
  // 가이드 레일(유저) — 코멧이 달릴 아주 연한 점 레일. 진한 상시 직선은 기각, 존재감만 남긴다
  //   (c3 D안 track 문법의 절제판 — 라운드캡 + 0길이 대시 = 점열).
  // 전용 축(footlab 슬라이더): comet=코멧 크기 · tailLen=꼬리 길이(경로 비율) · rail=레일 진하기
  const cometK = P.comet != null ? P.comet : 1;
  const tailL = P.tailLen != null ? P.tailLen : 0.5;
  g.save(); g.shadowBlur = 0; g.globalAlpha = P.rail != null ? P.rail : 0.22;
  g.strokeStyle = lut(0.6); g.lineWidth = 2.2 * s; g.lineCap = 'round';
  g.setLineDash([0.01, 8 * s]);
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  g.setLineDash([]); g.restore();
  if (pr > 0.02) {
    // 꼬리 — **소프트 도트**(radial gradient 폴오프). 민무늬 원 + 균일 알파는 도트 경계가 남아
    //   페이드가 투박했다(유저 — 특히 밝은 벽의 노멀 블렌딩에서 중간 알파가 탁하게 앉는다).
    const rgbaT = (v, a) => lut(v).replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`);
    for (let k = 0; k < 26; k++) {
      const f = k / 25, u = pr - tailL * f;
      if (u <= 0) break;
      const p2 = at(u);
      const r = 4.7 * s * cometK * (1 - f * 0.75), ro = r * 2.1;
      const a = (1 - f) * (1 - f) * 0.8;
      const gr = g.createRadialGradient(p2[0], p2[1], 0, p2[0], p2[1], ro);
      gr.addColorStop(0, rgbaT(0.55 - 0.18 * f, a));
      gr.addColorStop(0.5, rgbaT(0.50 - 0.18 * f, a * 0.35));
      gr.addColorStop(1, rgbaT(0.45 - 0.18 * f, 0));
      g.save(); g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = gr;
      g.beginPath(); g.arc(p2[0], p2[1], ro, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (pr < pts.length - 1 - 0.001 && pr - Math.floor(pr) > 0.03) {   // 헤드 — 노드 도착 중엔 숨김
      const hp = at(pr);
      g.save();
      g.fillStyle = lut(0.62); g.shadowColor = lut(0.8); g.shadowBlur = 11 * s * cometK;
      g.beginPath(); g.arc(hp[0], hp[1], 5.6 * s * cometK, 0, Math.PI * 2); g.fill();
      g.fillStyle = lut(0.95); g.globalAlpha = 0.95;
      g.beginPath(); g.arc(hp[0], hp[1], 2.1 * s * cometK, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  g.globalAlpha = 1; g.lineCap = 'butt';
  // 노드 상태 = 마크 토큰 규칙(Figma 잽잽훅 279:3203): 대기(빈 링) · 판정 완료(채움 = 서세스 마크).
  //   '지금 노릴 곳'은 수축 링이 말한다 — 여기서 또 밝히면 같은 정보가 두 벌이 된다.
  const driven = P.done != null, done = P.done || 0;   // driven = 세션이 판정을 먹인다(랩 데모는 자체 순환)
  // 판정은 **노드 자리에서** 말한다. 화면 구석 뱃지는 운동 중엔 아무도 안 본다(유저) —
  //   눈은 코치 몸에 붙어 있고, 노드가 바로 그 자리다. 색은 panel.js 판정 정본:
  //   hit=prism · near=sand · miss=lo(무채). 채움은 붉은 서세스 마크 그대로 두고 **링**이
  //   판정을 말한다 — 밝은 색으로 채우면 투사면에서 하얘져 안 읽힌다(아래 0.86 주석과 같은 이유).
  const VD = P.vd || [];
  // 리듬 = 크기로도 보인다. 잽·잽은 가볍고 훅은 무겁다 — 마지막 노드를 키워 두면
  //   정지 화면에서도 '짧 짧 · 강'이 읽힌다(간격만으로는 리듬이 안 보인다, 유저).
  const acc = P.acc != null ? P.acc : pts.length - 1;
  pts.forEach(([x, y], i) => {
    const hit = i < done;
    const v = VD[i] || null;
    const active = !hit && i === cur && !driven;   // 구동 중엔 '노릴 곳'을 수축 링이 말한다
    const pulse = active ? 1 + Math.sin(t * 6) * 0.14 : 1;
    // 임팩트 킥 — 방금 맞은 노드가 순간 부풀었다 제자리로(0.3s). 링 자체가 '맞았다'를 몸으로 말한다
    const kick = (P.pop != null && i === done - 1 && P.pop < 0.3) ? 1 + 0.35 * (1 - P.pop / 0.3) : 1;
    const R = 12 * P.node * pulse * kick * s * (i === acc ? 1.34 : 1);
    if (hit && v !== 'miss') {                   // 서세스 마크 = 붉은 채움(규칙 198/225 = 0.88)
      //   LUT 저역이 레드다 — 0.86(백열)로 채웠더니 '더 붉어진다'가 아니라 하얘졌다(유저).
      //   놓친 노드는 성공 마크가 아니다 — 채우지 않고 무채 링만 남긴다.
      g.shadowBlur = GB * 1.4; g.shadowColor = lut(0.5);
      g.fillStyle = lut(v === 'near' ? 0.5 : 0.36);   // near = 반만 온 것 → 램프 위쪽으로 한 칸
      g.beginPath(); g.arc(x, y, R * 0.88, 0, Math.PI * 2); g.fill();
    }
    // 볼류메트릭 밴드(정본 발광 문법) — 스트로크+shadowBlur 만으로는 평평했다(유저: 발자국과 감도 차이).
    //   ★ 판정 완료 노드는 밴드 생략 — 채움+밴드+블룸이 겹치면 백열로 포화해 숫자가 사라진다(유저 스샷).
    if (!hit) {
      g.save(); g.translate(x, y);
      volRing(g, lut, R, active ? 0.8 : 0.5, active ? 0.9 : 0.5, LNW * 0.9, GB);
      g.restore();
    }
    g.strokeStyle = v === 'hit' ? PAL.prism : v === 'near' ? PAL.sand : v === 'miss' ? NEU.lo
      : lut(hit ? 0.62 : active ? 0.8 : 0.45);
    g.lineWidth = LNW * (active ? 1.3 : v ? 1.15 : 0.9);
    g.shadowBlur = active ? GB * 1.6 : v && v !== 'miss' ? GB * 1.3 : GB * 0.6;
    if (v && v !== 'miss') g.shadowColor = v === 'hit' ? PAL.prism : PAL.sand;
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
    if (ENV.num) {
      if (hit && v !== 'miss') {
        // ★ 완료 노드 숫자 = **파냄**(destination-out) — 붉은 채움·글로우·블룸이 아무리 밝아도
        //   숫자가 배경으로 뚫려 항상 읽힌다(유저: 숫자가 사라짐). 각인(knock)과 같은 문법.
        g.save(); g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 0;
        ENV.num(g, String(i + 1), x, y, 16 * P.numS * pulse * s, Math.round(14 * P.numS * s));
        g.restore();
      } else {
        g.globalAlpha = i <= cur ? 1 : 0.6;   // 0.45 는 먼 노드 숫자가 안 보였다(유저 스샷 3번)
        ENV.num(g, String(i + 1), x, y, 16 * P.numS * pulse * s, Math.round(14 * P.numS * s));
        g.globalAlpha = 1;
      }
    }
  });
  // ── 임팩트 플래시('팡', 유저) — 방금 판정된 노드에서 백열 버스트 + 팽창 쇼크 링.
  //   가속 도착(채찍 v2)만으로는 타격이 안 터졌다 — 도착 '순간'의 시각 사건이 있어야 팡이다.
  //   P.pop = 비트 이후 경과 초(호스트 주입). 0.32s 만에 완전 소멸, 이후 비용 0.
  if (P.pop != null && P.pop < 0.38 && done > 0 && pts[done - 1]) {
    const [ix, iy] = pts[done - 1];
    const k = 1 - P.pop / 0.38, ke = k * k;                 // 급감쇠 — 번쩍하고 사라져야 타격
    const R0 = 12 * P.node * s * (done - 1 === (P.acc != null ? P.acc : pts.length - 1) ? 1.34 : 1);
    g.save();
    // 백열 코어 버스트 — v2: 더 크고 밝게(유저: 아직 안 찰짐)
    const BR = R0 * (1.6 + 1.9 * (1 - k));
    const fg = g.createRadialGradient(ix, iy, 0, ix, iy, BR);
    fg.addColorStop(0, `rgba(255,255,255,${Math.min(1, 1.2 * ke).toFixed(3)})`);
    fg.addColorStop(0.35, lut(0.92).replace('rgb(', 'rgba(').replace(')', `,${(0.8 * ke).toFixed(3)})`));
    fg.addColorStop(1, lut(0.7).replace('rgb(', 'rgba(').replace(')', ',0)'));
    g.fillStyle = fg;
    g.beginPath(); g.arc(ix, iy, BR, 0, Math.PI * 2); g.fill();
    // 팽창 쇼크 링 ×2 — 본 링 + 반박자 늦은 에코
    g.strokeStyle = lut(0.92); g.globalAlpha = ke;
    g.lineWidth = Math.max(1, 6 * s * k);
    g.shadowColor = lut(0.85); g.shadowBlur = 24 * s * ke;
    g.beginPath(); g.arc(ix, iy, R0 * (1.1 + 3.4 * (1 - k)), 0, Math.PI * 2); g.stroke();
    const k2 = Math.max(0, k - 0.35) / 0.65;
    if (k2 > 0) {
      g.globalAlpha = k2 * k2 * 0.6; g.lineWidth = Math.max(1, 3.5 * s * k2);
      g.beginPath(); g.arc(ix, iy, R0 * (1.1 + 2.0 * (1 - k2)), 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
  g.shadowBlur = 0;
}
/** 어프로치 링 — 타이밍 토큰(파생). 시스템 공통 언어(소프트 열 글로우·파문)로 통일 —
 *  하드 지오메트리 없이, 부드러운 글로우 링이 바깥 R → 타겟 Rt로 '수축'(뒤에 파문 에코 잔상),
 *  타겟과 맞물리는 순간 = 동작 타이밍 → 소프트 핑이 퍼진다. prog 0..1(비트). 색은 룩 LUT만. */
/** 볼류메트릭 글로우 링 — radial gradient 밴드(부피 발광) + 크리스프 코어 스트로크.
 *  approachRing 에서 추출한 시스템 공통 발광 문법 — shadowBlur 한 겹은 폴오프가 밋밋해
 *  프리미엄 감도가 안 났다(유저: 발자국 토큰과 감도 차이). 원점 기준 — 호출자가 translate. */
function volRing(g, lut, r, v, a, lw, GB, wMul = 1) {
  if (r <= 0.6) return;
  const rgba = (vv, aa) => lut(vv).replace('rgb(', 'rgba(').replace(')', `,${aa})`);
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
}
/** 드리블 매트 — 훈련 판 영역 토큰.
 *
 *  재질은 **유리 알약과 같은 레시피**다(floorgl _glassPill 정본): 아주 옅은 채움 +
 *  안쪽으로 스며드는 넓은 광 + 위(먼 쪽)가 밝고 아래(가까운 쪽)가 어두운 림 그라디언트.
 *  네온 윤곽선이 아니다 — 이 시스템의 면은 '빛나는 선'이 아니라 '빛을 머금은 유리'다.
 *
 *  ★ **색은 판정만 말한다**(TOK.ember = 0 과 같은 규율). 판·표적·눈금·글자는 전부 무채(크림
 *    HUD 잉크)이고, 화면에서 유일한 색 사건은 **지금 겨눌 자리(액티브 타깃)** 하나다.
 *    표적 네 개를 색으로 구분하면 '어느 게 지금이냐'가 안 읽힌다 — 정체성은 번호가 말한다.
 *
 *  서체 규약: 숫자는 OffBit(ENV.num) · 라틴 단어는 Supreme **400/700 두 굵기만**.
 *
 *  P.mat     = { nx, fx, ny, fy } 판 정규좌표(-1..1, +y = 먼 쪽). nx = fx 면 직사각
 *  P.targets = [{ x, y, n, r, on, live }]  on = 이 단계에서 쓰는가 · live = 지금 겨눌 표적(색)
 *  P.center  = { x, y, r, label, ring }    액티브 타깃. ring:0 = 링은 3D 존 마크가 그린다
 *  P.title / P.brand / P.ruler{w,h} / P.chev / P.bracket / P.round / P.prog
 */
const eOutQuint = u => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 5);
export function drawDribbleMat(g, W, P, look, t, ENV) {
  const lut = ENV.lut, s = W / 512;
  const AW = (ENV.arrow && ENV.arrow.w) || 1;
  const rgbaL0 = (v, a) => lut(v).replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
  const INK = (a, v) => rgbaL0(v == null ? 0.86 : v, a);   // 크롬 = LUT 밝은 끝. 하드코딩 크림 폐기
  const LNW = 4 * AW * s;                                  // LINE 두께 정본 — 모든 선이 여기서 파생
  g.clearRect(0, 0, W, W); g.lineJoin = 'round'; g.lineCap = 'round';
  const M = P.mat || { nx: 0.86, fx: 0.86, ny: -0.86, fy: 0.86 };
  // 등장/퇴장 — 허브 먼저, 노드는 스태거로 뒤따른다. 닫힐 땐 역순(코치가 다음 부위를 짚을 때).
  const IN = P.in == null ? 1 : Math.max(0, Math.min(1, P.in));
  const hubK = eOutQuint(IN / 0.45);
  const nodeK = i => eOutQuint((IN - 0.28 - i * 0.09) / 0.42);
  // 접촉 펄스 — 공이 닿은 뒤 0.34s 동안 허브가 한 번 부풀었다 돌아온다(파문은 세션이 따로 쏜다)
  const hit = P.hit == null ? 9 : P.hit;
  const hitK = hit < 0.34 ? Math.sin(Math.PI * (hit / 0.34)) : 0;
  const X = u => W / 2 + u * W / 2, Y = v => W / 2 - v * W / 2;
  const halfAt = v => M.nx + (M.fx - M.nx) * (v - M.ny) / Math.max(1e-4, M.fy - M.ny);
  const rgbaL = (v, a) => lut(v).replace('rgb(', 'rgba(').replace(')', ',' + a + ')');

  // 자간 있는 대문자 라벨 — Supreme 700/400 만(유저 확정 2종)
  const label = (txt, cx, cy, px, col, track, weight) => {
    g.font = (weight === 400 ? 400 : 700) + ' ' + px + 'px "Supreme", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ch = Array.from(String(txt)), tr = px * (track == null ? 0.3 : track);
    let wSum = -tr;
    for (const c of ch) wSum += g.measureText(c).width + tr;
    let x = cx - wSum / 2;
    g.fillStyle = col;
    for (const c of ch) { const w = g.measureText(c).width; g.fillText(c, x + w / 2, cy); x += w + tr; }
  };

  /** 유리 면 — floorgl `_glassPill` 과 같은 3단(채움 · 안쪽 광 · 림). k = 크기 배율.
   *  대지(1600px/1.07m)의 blur37·lw80·rim2.5 를 이 판의 px/m 로 환산한 값이다. */
  const glass = (path, k, alpha) => {
    const a = alpha == null ? 1 : alpha;
    g.save(); path(); g.clip();
    g.fillStyle = INK(0.055 * a); g.fillRect(0, 0, W, W);
    g.filter = 'blur(' + 14 * s * k + 'px)';
    g.strokeStyle = INK(0.25 * a); g.lineWidth = 30 * s * k;
    path(); g.stroke(); g.filter = 'none';
    g.restore();
    const rim = g.createLinearGradient(0, Y(M.fy), 0, Y(M.ny));   // 먼 쪽이 밝다(알약 위쪽과 같은 규약)
    rim.addColorStop(0, INK(0.95 * a));
    rim.addColorStop(0.45, INK(0.22 * a));
    rim.addColorStop(1, INK(0.06 * a));
    g.strokeStyle = rim; g.lineWidth = LNW * 0.55; path(); g.stroke();
  };

  // ── 판 경로(모서리 라운드 사다리꼴) ─────────────────────────────────────
  const r = 0.05 * (P.round != null ? P.round / 0.35 : 1);
  const pts = [];
  const arcP = (cu, cv, a0, a1) => { for (let i = 0; i <= 6; i++) {
    const a = a0 + (a1 - a0) * i / 6; pts.push([X(cu + r * Math.cos(a)), Y(cv + r * Math.sin(a))]); } };
  arcP(-M.fx + r, M.fy - r, Math.PI / 2, Math.PI);
  arcP(-M.nx + r * 0.6, M.ny + r, Math.PI, Math.PI * 1.5);
  arcP(M.nx - r * 0.6, M.ny + r, -Math.PI / 2, 0);
  arcP(M.fx - r, M.fy - r, 0, Math.PI / 2);
  pts.push(pts[0]);
  const path = () => { g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  // ★ 판(마름모꼴) 제거 — 프로젝터는 매트가 아니다. 사각형을 그려 '여기 있다'를 증명할
  //   필요가 없다(유저). 빛이 닿는 자리가 곧 판이다. path 는 진행 아크 계산에만 남는다.

  const cU = P.center ? P.center.x : 0, cV = P.center ? P.center.y : 0;
  const CR = (P.center && P.center.r != null ? P.center.r : 0.26) * W / 2
    * hubK * (1 + 0.055 * hitK + 0.008 * Math.sin(t * 2.4));   // 등장 + 접촉 펄스 + 상시 호흡


  // ── 레일 — 노드 순서를 잇는 점열. 잽잽훅 가이드 레일과 같은 값(0길이 대시 · 라운드캡 · 0.22)
  const NODES = (P.targets || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0));
  if (NODES.length) {
    g.save(); g.shadowBlur = 0; g.globalAlpha = 0.22 * eOutQuint(IN / 0.9);
    g.strokeStyle = lut(0.6); g.lineWidth = 2.2 * s; g.lineCap = 'round';
    g.setLineDash([0.01, 8 * s]);
    for (const q of NODES) {
      const qx = X(q.x), qy = Y(q.y), dx = X(cU) - qx, dy = Y(cV) - qy;
      const L = Math.hypot(dx, dy) || 1;
      const NR = (q.r != null ? q.r : 0.20) * W / 2 * 1.16;   // 노드 림 바깥에서 시작
      g.beginPath();
      g.moveTo(qx + dx / L * NR, qy + dy / L * NR);
      g.lineTo(X(cU) - dx / L * CR * 1.12, Y(cV) - dy / L * CR * 1.12);   // 허브 림 앞에서 멈춤
      g.stroke();
    }
    g.setLineDash([]); g.restore();
  }
  // ── 코멧 — 타깃이 옮겨 갈 때 레일 위를 달린다. P.travel = { from, to, k 0..1 }
  const TR = P.travel;
  if (TR && TR.k > 0.001 && TR.k < 1) {
    const a = NODES.find(q => q.n === TR.from), b = NODES.find(q => q.n === TR.to);
    if (a && b) {
      // 두 구간(노드 → 허브 → 노드). 가로지르지 않고 가운데를 찍고 간다.
      const ax = X(a.x), ay = Y(a.y), bx = X(b.x), by = Y(b.y), mx = X(cU), my = Y(cV);
      const e = eOutQuint(TR.k);
      const at = u => u < 0.5
        ? [ax + (mx - ax) * (u / 0.5), ay + (my - ay) * (u / 0.5)]
        : [mx + (bx - mx) * ((u - 0.5) / 0.5), my + (by - my) * ((u - 0.5) / 0.5)];
      const [hx, hy] = at(e);
      const [tx, ty] = at(Math.max(0, e - 0.28));
      const gr = g.createLinearGradient(tx, ty, hx, hy);
      gr.addColorStop(0, lut(0.5).replace('rgb(', 'rgba(').replace(')', ',0)'));
      gr.addColorStop(1, lut(0.85).replace('rgb(', 'rgba(').replace(')', ',0.85)'));
      g.strokeStyle = gr; g.lineWidth = 3.2 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = lut(0.62); g.shadowColor = lut(0.8); g.shadowBlur = 11 * s;
      g.beginPath(); g.arc(hx, hy, 5.6 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = lut(0.95); g.globalAlpha = 0.95; g.shadowBlur = 0;
      g.beginPath(); g.arc(hx, hy, 2.1 * s, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }

  // ── 노드 = 잽잽훅 노드와 **같은 레시피**. 채움 + volRing + 헤일로 — 윤곽선을 긋지 않는다.
  const GB = 13 * look.halo;
  for (const tg of (P.targets || [])) {
    const on = tg.on !== false, live = !!tg.live;
    const k = nodeK(tg.n ? tg.n - 1 : 0);
    if (k <= 0.001) continue;
    const cx = X(tg.x), cy = Y(tg.y);
    const R = (tg.r != null ? tg.r : 0.20) * W / 2 * (live ? 1.34 : 1) * (0.9 + 0.1 * k);
    g.globalAlpha = k * (on ? 1 : 0.45);
    g.shadowBlur = GB * 1.4; g.shadowColor = lut(0.5);
    g.fillStyle = lut(live ? 0.5 : 0.36);
    g.beginPath(); g.arc(cx, cy, R * 0.88, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.save(); g.translate(cx, cy);
    volRing(g, lut, R, live ? 0.8 : 0.5, live ? 0.9 : 0.5, LNW * 0.9, GB);
    g.restore();
    ENV.num(g, tg.n, cx, cy, R * 0.9, Math.round(R * 0.78));
    g.globalAlpha = 1;
  }

  // ── 액티브 타깃 — 화면에서 **유일한 색 사건**. 지금 겨눌 자리
  if (P.center) {
    const cx = X(cU), cy = Y(cV);
    const pool = g.createRadialGradient(cx, cy, CR * 0.1, cx, cy, CR * 1.6);
    pool.addColorStop(0, rgbaL(0.42, 0.30)); pool.addColorStop(0.6, rgbaL(0.35, 0.12));
    pool.addColorStop(1, rgbaL(0.3, 0));
    g.fillStyle = pool; g.beginPath(); g.arc(cx, cy, CR * 1.6, 0, Math.PI * 2); g.fill();
    if (P.center.ring !== 0) {
      g.strokeStyle = rgbaL(0.3, 0.30); g.lineWidth = LNW * 0.85;   // 미진행 트랙 — 진행 획이 위를 덮는다
      g.shadowColor = lut(0.42); g.shadowBlur = 18 * s;
      g.beginPath(); g.arc(cx, cy, CR, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    }
    if (P.brand && ENV.logo && ENV.logo.complete && ENV.logo.naturalWidth) {
      const lw = CR * 1.05, lh = lw * ENV.logo.naturalHeight / ENV.logo.naturalWidth;
      g.globalAlpha = 0.5 * hubK;                 // 허브 정중앙 — 판정 링 안이 브랜드 자리다
      g.drawImage(ENV.logo, cx - lw / 2, cy - lh / 2, lw, lh);
      g.globalAlpha = 1;
    }
    if (P.center.label) {
      const ls = String(P.center.label).split('\n');
      ls.forEach((ln, i) => label(ln, cx, cy + (i - (ls.length - 1) / 2) * 15 * s, 12 * s, INK(0.9), 0.14));
    }
  }

  // ── 방향 셰브론 — 다음이 어느 쪽인지. 크롬이라 무채, 호흡만 준다
  if (P.chev) {
    const chev = (cy, dir) => {
      for (let k = 0; k < 2; k++) {
        const o = k * 9 * s, w = 11 * s, h = 7 * s, yy = cy + dir * o;
        g.beginPath(); g.moveTo(X(cU) - w, yy - dir * h); g.lineTo(X(cU), yy);
        g.lineTo(X(cU) + w, yy - dir * h); g.stroke();
      }
    };
    g.strokeStyle = INK(0.45 + 0.3 * Math.sin(t * 2.4)); g.lineWidth = 2.2 * AW * s;
    chev(Y(cV) - CR * 2.0, -1); chev(Y(cV) + CR * 2.0, 1);
  }

  // ── 워드마크 — 실물 매트가 브랜드를 박는 그 자리. 4급이라 가장 옅다

  // ── 진행 = 허브 바깥 아크 게이지. 판 테두리를 채우던 걸 여기로 옮긴다 —
  //    테두리는 '판이 어디까지인가'를 말하는 선이지 진행 막대가 아니다. 진행은 판정 옆에 붙는다.
  if (P.prog > 0.001 && P.center) {
    const cx = X(cU), cy = Y(cV);
    // 링 = 진행이다. 별도 게이지 원을 하나 더 그리지 않는다(줄이 둘이면 어느 쪽이 상태인지 갈린다).
    //   접촉 직후엔 같은 획이 한 번 밝아지며 훑고 지나간다 — 선 자체가 반응한다.
    const sweep = hitK;
    g.strokeStyle = rgbaL(0.34, 0.9 + 0.1 * sweep); g.lineWidth = LNW * (0.85 + 0.5 * sweep);
    g.lineCap = 'round';
    g.shadowColor = lut(0.42); g.shadowBlur = (10 + 16 * sweep) * s;
    g.beginPath();
    g.arc(cx, cy, CR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, P.prog));
    g.stroke(); g.shadowBlur = 0;
  }
}
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
  const glowRing = (r, v, a, wMul = 1) => volRing(g, lut, r, v, a, lw, GB, wMul);   // 정본 발광 문법(위 volRing)

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
/** 회전 — 관절 돌리기 토큰(파생) = LINE 정본(drawCurveArrow)을 '원호 경로'로 그린 것.
 *  두께·색 램프·촉 글리프·draw-on 박자가 직선 화살표(drawStemArrow)와 같은 코드에서 나온다.
 *  예전엔 여기만 따로 그려서(꼬리 페이드 호 + 가이드 링 + 피벗 점 + 상시 회전) 같은 벽에 뜨는
 *  좌우 화살표와 스타일·두께·촉·인터랙션이 전부 달랐다(유저: A1 화살표와 B2 화살표가 너무 다르다).
 *  dir: 1=시계 · -1=반시계 · sweep=호 길이 · width=굵기 · scale=벽 물리 크기 보정. */
export function drawRotate(g, W, P, look, t, ENV, prog) {
  const r = P.r != null ? P.r : 0.3, dir = P.dir != null ? P.dir : 1;
  const sweep = (P.sweep != null ? P.sweep : 0.66) * Math.PI * 2;
  // 회전은 '자랐다 사라지는' draw-on 이 아니라 **끝까지 돌아 이어지는 루프**다(유저).
  //   길이 sweep 인 호를 통째로 돌린다 — 꼬리는 알파 0(스템 뿌리와 같은 페더)이라
  //   한 바퀴가 끝나도 이음매가 없다. p 는 wrap 만 하면 되고 리셋 깜빡임이 없다.
  const p = prog != null ? prog : (t * (P.tempo != null ? P.tempo : 0.5)) % 1;
  const head = -Math.PI / 2 + dir * p * Math.PI * 2;              // 12시에서 dir 방향으로
  const N = 16, pts = [];
  for (let i = 0; i <= N; i++) {
    const a = head - dir * (1 - i / N) * sweep;                   // 꼬리 → 머리
    pts.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
  }
  drawCurveArrow(g, W, W, pts, t, ENV, {
    prog: 1,
    tail: P.tail != null ? P.tail : 0.68,   // 게이지 아크와 같은 꼬리 페이드(유저 레퍼런스)
    scale: (P.scale != null ? P.scale : 1) * (P.width != null ? P.width : 1),
  });
}

/** ── 연결 토큰(LINK) — 두 발자국을 잇는 지면 전용 기호 ──────────────────────────
 *  왜 별도 토큰인가: 마크(발형)는 '어디'를 말하고, 연결선은 '여기서 저기로'를 말한다.
 *  A2 종아리 프레스(정적 스탠스 = 보폭), 농구 스텝백(순차 이동 = 경로) 둘 다 이 하나로 읽힌다.
 *
 *  ★ 길이 무관 규격 — **점 개수를 고정**하고 간격을 길이에서 파생한다.
 *    간격을 고정하면 실측 구간 편차(농구 0.16m ~ 0.92m = 5.7배)에서 짧은 건 점 하나,
 *    긴 건 여섯 개가 되어 같은 기호로 안 읽힌다.
 *
 *  style — 시안 비교용(footlab '연결 토큰' 패널에서 전환):
 *    dots   균일 점렬            — 가장 절제. 거리만 말한다.
 *    taper  중앙 작고 끝이 굵다   — '벌어짐'이 점 크기로 읽힌다(스트레치).
 *    chain  점 + 잇는 헤어라인    — 두 발이 한 세트임이 가장 분명(레퍼런스 line+dot).
 *    pulse  중앙→양끝 밝기 파동   — 순차 이동(농구 경로)에 방향감을 준다.
 */
export function drawLinkDots(g, ax, ay, bx, by, t, o = {}) {
  const N = Math.max(2, Math.round(o.count ?? 7));
  const R = o.r ?? 4.4;
  const flow = o.flow ?? 0.35;
  const hair = o.hair ?? 0.26;
  const style = o.style || 'chain';
  const col = o.color || '255,246,234';
  const inset = o.inset ?? 0.12;              // 양끝(발) 여백 비율
  const A = o.alpha ?? 1;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3 || A <= 0.004) return;
  const ux = dx / len, uy = dy / len;
  const x0 = ax + dx * inset, y0 = ay + dy * inset;
  const span = len * (1 - inset * 2);
  if (span <= 0) return;
  g.save();
  if (style === 'chain' && hair > 0) {         // 점을 잇는 실 — 굵기는 점보다 훨씬 얇게
    g.strokeStyle = `rgba(${col},${(hair * A).toFixed(3)})`;
    g.lineWidth = Math.max(1, R * 0.34);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ux * span, y0 + uy * span); g.stroke();
  }
  const ph = (t * flow) % 1;                   // 중앙에서 바깥으로 흐른다
  for (let i = 0; i < N; i++) {
    let u = (i + 0.5) / N;
    if (style === 'pulse' || style === 'dots' || style === 'chain') {
      const c = u - 0.5;                       // 중앙 기준 부호
      u = 0.5 + c + Math.sign(c) * ((ph / N) % (1 / N));   // 바깥 방향 미세 이동
      if (u < 0 || u > 1) continue;
    }
    const px = x0 + ux * span * u, py = y0 + uy * span * u;
    const c2 = Math.abs(u - 0.5) * 2;          // 0 중앙 → 1 끝
    let r = R, a = A;
    if (style === 'taper') r = R * (0.55 + 0.75 * c2);
    if (style === 'pulse') {
      const w = ((c2 - ph) % 1 + 1) % 1;
      a = A * (0.35 + 0.65 * Math.max(0, 1 - Math.abs(w - 0) * 3));
    }
    g.fillStyle = `rgba(${col},${(a * 0.96).toFixed(3)})`;
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
