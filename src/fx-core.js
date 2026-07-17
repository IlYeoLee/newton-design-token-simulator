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
