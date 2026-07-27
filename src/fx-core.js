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

// ─────────────────────────────────────────────────────────────
// MARK 7상태 GLSL 코어 — 룩 카탈로그(fxlab)와 라이브(tokens.js)가 같은 문자열을 포함.
//   순수 상태 함수: markState(uv, state, prog, strong, t) → vec4(빛 premultiplied, 커버리지)
//   호스트가 합성 결정: fxlab = bg*(1-a)+rgb (배경 위), 라이브 = rgb 가산광 / 주간 잉크.
//   상태 번호는 카탈로그 기준(0 Preview·1 Active·2 Hold·3 Success·4 Miss·5 Warning·6 Locked)
//   — 라이브는 자기 uPhase를 이 번호로 매핑해 호출.
//   전제: 호스트 공통부가 uW·uHalo·uNoise(float)를 선언. 여기가 uRadius·uPool·uContract·
//   uShape·uSeed·uSDF2·uSDFWarn을 선언(호스트 헤더에서 중복 선언 금지).
// ─────────────────────────────────────────────────────────────
export const MARK_GLSL = `
uniform float uRadius, uPool, uContract, uShape, uSeed;
uniform sampler2D uSDF2, uSDFWarn;
#define C_RED   vec3(0.980, 0.188, 0.188)
#define C_CORAL vec3(0.996, 0.431, 0.235)
#define C_SAND  vec3(0.996, 0.765, 0.537)
#define C_CREAM vec3(0.996, 0.886, 0.776)
#define C_ICE   vec3(0.820, 0.996, 1.000)
#define C_GRAYF vec3(0.925, 0.925, 0.925)
#define C_GRAYL vec3(0.816, 0.816, 0.816)
#define C_RIMG  vec3(0.816, 0.804, 0.800)
#define C_WINE  vec3(0.318, 0.094, 0.082)
#define C_BRICK vec3(0.718, 0.212, 0.184)
#define C_EXCL  vec3(0.933, 0.157, 0.153)
float mkUndul(float ang, float t){
  return sin(ang*2.0 + t*1.1)*0.45 + sin(ang*3.0 - t*0.73 + 1.7)*0.33 + sin(ang*5.0 + t*0.41 + 4.2)*0.22;
}
// 일반화 부호 거리 — 존 원 / 발형이 같은 상태 머신을 공유 (1.9922 = float SDF 디코드 정본 계수)
float mkSD(vec2 p, float u1){
  if (uShape < 0.5) return length(p) * (1.0 + u1 * uNoise * 0.04) - 0.46 * uRadius;
  vec2 suv = p * 0.5 + 0.5;
  return texture2D(uSDF2, vec2(suv.x, 1.0 - suv.y)).r * 1.9922 / max(uRadius, 0.3) + u1 * uNoise * 0.02;
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
vec3 fillPreview(float q){ return okmix(C_CORAL, C_SAND, smoothstep(0.0, 0.733, q)); }
vec3 fillHot(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.0, 0.45, q));
  return okmix(c, C_SAND, smoothstep(0.45, 1.0, q));
}
vec3 fillActive(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.0, 0.479, q));
  c = okmix(c, C_SAND, smoothstep(0.479, 0.607, q));
  return okmix(c, C_ICE, smoothstep(0.607, 0.750, q));
}
vec3 fillHold(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.0, 0.23, q));
  return okmix(c, C_SAND, smoothstep(0.23, 1.0, q));
}
vec3 fillSuccess(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.47, 0.70, q));
  c = okmix(c, C_SAND, smoothstep(0.70, 0.843, q));
  return okmix(c, C_ICE, smoothstep(0.843, 0.931, q));
}
// over 연산 누적 (premultiplied) — 원본 mix(col, X, k) 체인의 기계적 등가 변환
void lay(inout vec4 A, vec3 X, float k){ A.rgb = A.rgb * (1.0 - k) + X * k; A.a = A.a * (1.0 - k) + k; }
vec4 markState(vec2 uv, float state, float prog, float strong, float t){
  float ang = atan(uv.y, uv.x);
  float a01 = fract(0.25 - ang / 6.2832);      // 12시 기준 시계방향
  float u1 = mkUndul(ang + uSeed, t * 1.6);
  float sd = mkSD(uv, u1);
  float aa = max(fwidth(sd), 0.004) * 1.4;     // 화면공간 AA
  float inside = smoothstep(aa, -aa, sd);
  float outPos = max(sd, 0.0);
  // 점선 = 회피 계약 (일렁임과 분리한 저주기 — '털 뜯김' 방지 확정판)
  float dashM = (uContract > 0.5 && uContract < 1.5)
              ? smoothstep(0.30, 0.60, 0.5 + 0.5 * sin(ang * 10.0)) : 1.0;
  float ext = uShape < 0.5 ? 0.46 * uRadius : 0.72;
  vec2 gcBall = uShape < 0.5 ? vec2(0.0) : vec2(0.0, 0.20);
  vec2 gcHeel = uShape < 0.5 ? vec2(0.0, -0.5 * ext) : vec2(0.0, -0.32);
  vec4 A = vec4(0.0);
  float fillGain = clamp(uPool * 1.6, 0.0, 1.35);

  if (state < 0.5) {            // ── Preview: 아웃라인 → 소프트 필 차오름 (strong=라이브 '다음' 적열 강조)
    float f = prog;
    float breath = 1.0 + 0.05 * sin(t * 2.0) * (0.4 + uNoise);
    // 중심 핫스팟 완화(유저 재지적: 가운데 원 또렷) — 하한↑ + 폴오프 넓혀 부드러운 전이(하드 원 제거)
    float q = 0.36 + 0.64 * length(uv - gcBall) / (ext * 1.18 * breath);
    vec3 fillCol = mix(C_CREAM, mix(fillPreview(q), fillHot(q), strong), f);
    float fillA = mix(0.42, 0.82, f) * fillGain;
    lay(A, fillCol, fillA * inside);
    float ow = 0.016 * uW;
    float stroke = exp(-pow(sd / ow, 2.0)) * dashM;
    lay(A, C_SAND, stroke * (0.95 - 0.62 * f));
  } else if (state < 1.5) {     // ── Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 타이밍)
    float gradR = uShape < 0.5 ? ext * 1.75 : 2.15;   // 폴오프 넓힘 = 중앙 적열 원 완화(유저)
    float q = 0.34 + 0.66 * length(uv - gcBall) / gradR;   // 중심 하한↑ — 적열이 은은하게 퍼짐
    q *= 1.0 + 0.025 * sin(t * 3.1 + q * 5.0) * uNoise;
    lay(A, fillActive(q), inside * min(fillGain * 1.15, 1.0));
    float hw = max((0.115 - 0.075 * prog) * uW, 0.018);
    float h = exp(-pow(outPos / hw, 1.3)) * (1.0 - inside);
    vec3 hCol = mix(C_SAND, C_ICE, smoothstep(0.15, 0.9, outPos / hw));
    lay(A, hCol, h * uHalo * (0.50 + 0.14 * sin(t * 5.0)) * dashM);
  } else if (state < 2.5) {     // ── Hold: 코닉 진행 림 + 열이 뒤꿈치로 고임
    float pr = prog;
    vec2 gc = mix(gcBall, gcHeel, pr);
    float q = length(uv - gc) / (ext * 1.02);
    float qh = max(q - 0.24 * pr, 0.0);
    lay(A, fillHold(qh), inside * min(fillGain, 1.0) * 0.95);
    float distToRim = abs(sd - 0.012);
    float fw = max(fwidth(sd), 1e-5);
    // 림 폭: 카탈로그 20px(고정 캔버스) ≡ 실루엣 비례 sd 0.03 — 화면 크기가 가변인
    // 라이브에서도 같은 비율. 원거리 앨리어싱만 fwidth 하한.
    float rimW = max(0.03 * uW, 1.5 * fw);
    float rim = (1.0 - smoothstep(0.0, rimW, distToRim)) * dashM;
    float angDist = a01 - pr; angDist -= floor(angDist + 0.5);   // 랩어라운드 제거
    float pgo = smoothstep(0.09, -0.09, angDist);
    vec3 arcCol = mix(C_RED, C_CORAL, clamp(a01 / max(pr, 0.001), 0.0, 1.0));
    lay(A, mix(C_RIMG, arcCol, pgo), rim * mix(0.42, 0.92, pgo));
    // 진행 선단 = 밝은 '시계 바늘' — 12시서 시계방향으로 도는 게 명확히 읽히게(유저: 타이머처럼 싹)
    float head = smoothstep(0.05, 0.0, abs(angDist)) * step(0.01, pr) * step(pr, 0.995);
    lay(A, C_CREAM, rim * head * 0.95);
  } else if (state < 3.5) {     // ── Success: 진홍 블룸 → 잔상 소멸
    float e = 1.0 - pow(1.0 - prog, 2.6);
    float q = length(uv - gcBall) / (uShape < 0.5 ? ext * 1.3 : 1.75);
    float fillA = (prog < 0.4 ? 1.0 : pow(1.0 - (prog - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    lay(A, fillSuccess(q / (0.55 + 0.55 * e)), inside * fillA);
    float flash = exp(-prog * 9.0);
    lay(A, C_ICE, exp(-pow(abs(sd) / (0.02 * uW), 2.0)) * flash * 0.8);
  } else if (state < 4.5) {     // ── Miss: 온기가 식어 회색 고스트 → 무음 소멸
    float cool = smoothstep(0.0, 0.4, prog);
    float gone = pow(1.0 - max(prog - 0.45, 0.0) / 0.55, 1.6);
    float q = length(uv - gcBall) / ext;
    lay(A, mix(fillPreview(q), C_GRAYF, cool), inside * mix(0.55, 0.24, cool) * gone * fillGain);
    lay(A, mix(C_SAND, C_GRAYL, cool), exp(-pow(sd / (0.014 * uW), 2.0)) * 0.85 * gone);
  } else if (state < 5.5) {     // ── Warning: 암적 리니어 + 느낌표(유저 SVG) 점멸
    float ly = clamp(0.5 - uv.y / (2.2 * ext), 0.0, 1.0);
    lay(A, mix(C_WINE, C_BRICK, ly), inside * min(fillGain * 1.05, 1.0));
    float wScale = 0.44 * ext;
    vec2 wuv = uv / wScale * 0.5 + 0.5;
    float wSD = texture2D(uSDFWarn, vec2(wuv.x, 1.0 - wuv.y)).r * (2.0 * wScale);
    float aaW = max(fwidth(wSD), 0.0015);
    float exM = smoothstep(aaW, -aaW, wSD) * inside;
    lay(A, C_EXCL * 1.25, exM * (0.85 + 0.15 * sin(t * 5.5)));
  } else {                       // ── Locked: 회색 아웃라인 + (숫자는 호스트 오버레이)
    lay(A, C_GRAYF, inside * 0.30 * fillGain);
    lay(A, C_GRAYL, exp(-pow(sd / (0.015 * uW), 2.0)) * 0.8 * dashM);
  }
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
    g.fillStyle = 'rgba(255,243,220,0.95)';
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

  // 1) 경로 힌트 — 아주 옅은 넓은 글로우(어디로 갈지 암시만, 또렷한 선 아님)
  g.globalAlpha = 0.045 * outA; g.strokeStyle = lut(0.46); g.lineWidth = 9 * base;
  g.shadowColor = lut(0.6); g.shadowBlur = GB * 2.0;
  g.beginPath(); path.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.shadowBlur = 0;

  // 2) 리본 — 헤드(앞)는 진하고 또렷, 꼬리로 갈수록만 연해지고 흐려져 소멸(끝만 흐릿).
  const M = 40, u0 = Math.max(0, headU - tail * (1 - catchUp)), win = [];
  for (let i = 0; i <= M; i++) win.push(at(u0 + (headU - u0) * (i / M)));
  const ribbon = () => { g.beginPath(); win.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const grad = () => { const gr = g.createLinearGradient(win[0][0], win[0][1], win[M][0], win[M][1]);
    gr.addColorStop(0, rgba(0.55, 0)); gr.addColorStop(0.45, rgba(0.58, 0.05));
    gr.addColorStop(0.82, rgba(0.62, 0.18)); gr.addColorStop(1, rgba(0.68, 0.4)); return gr; };
  const spr = 1 + 0.5 * spd;
  // 소프트 글로우(꼬리 투명→헤드 진함) — 꼬리쪽만 흐릿한 잔상. 벽 투사용으로 두툼하게.
  g.globalAlpha = outA; g.strokeStyle = grad(); g.lineWidth = (20 + 10 * spd) * base * wid;
  g.shadowColor = lut(0.72); g.shadowBlur = GB * 2.2; ribbon();
  g.strokeStyle = grad(); g.lineWidth = (10 + 5 * spd) * base * wid; g.shadowBlur = GB * 1.0; ribbon(); g.shadowBlur = 0;
  // 또렷한 코어 — 두툼·균일(smooth) → 꼬리로만 알파·폭 감소. 앞은 진한 선, 끝은 흐릿 소멸.
  for (let i = 1; i <= M; i++) {
    const f = i / M;
    g.globalAlpha = Math.pow(f, 1.35) * 0.95 * outA; g.strokeStyle = lut(0.55 + 0.38 * f);
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
