// ─────────────────────────────────────────────────────────────
// fx-core — 룩 시스템(FX Lab)과 시뮬레이터가 공유하는 단일 정본.
//
//   여기 있는 코드의 원산지는 전부 fxlab.html(룩 카탈로그) — FX Lab이 디자인 정본이므로
//   구현도 FX Lab 것을 그대로 승격. 시뮬 쪽 중복본(fxlut.js 등)은 이 모듈 소비로 대체.
//   존재 이유: 셰이더·SDF·규약이 손복사 2벌로 갈라져 있던 것이 "룩과 시뮬이 다르게
//   보인다" 계열 버그 전부의 구조적 원인이었음(±1.9922 디코드 누락, N=256 vs 768,
//   글리프 크기 1.43× 등 — 전부 2벌 사이 드리프트).
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
  const sc = Math.min((N * 0.78) / R.w, (N * 0.78) / R.h);
  const w = R.w * sc, h = R.h * sc;
  if (flip) { g.translate(0, N); g.scale(1, -1); }
  g.drawImage(R.canvas, R.x, R.y, R.w, R.h, (N - w) / 2, (N - h) / 2, w, h);
  return sdfFromAlpha(g.getImageData(0, 0, N, N).data, N);
}

// ── 셰이더 디코드 계수 — raw d/N(텍스처 span 기준)을 uv([-1,1]) 기준으로.
//    구 8bit 인코딩(range=N/4, 127/255)의 유효 배율 역산값. 이 계수가 빠지면
//    발형 등고선 효과 전부가 2배 폭으로 퍼짐 (실제 사고 이력 있음 — (117)).
export const SDF_DECODE = 1.9922;

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
