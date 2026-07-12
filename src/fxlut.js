// ─────────────────────────────────────────────────────────────
// FX 공유 인프라 — 히트 LUT + 셰이더 청크 + 라이브 파라미터
//
//   FX Lab(아티팩트)에서 확정한 룩의 본체 이식.
//   원칙: "모든 것은 온도다" — 마크·이펙트·레인·고스트가 하나의 LUT를 공유.
//   OKLab 보간(RGB 직선 보간의 탁한 갈색 구간 제거) + 채도 스케일(회색조 혼합).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ── OKLab ↔ sRGB ──────────────────────────────
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const l2s = c => { c = Math.max(0, Math.min(1, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); };
function rgb2ok(r, g, b) {
  r = s2l(r); g = s2l(g); b = s2l(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function ok2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ── 라이브 파라미터 (프로 편집 모드가 조절, 프레임마다 읽힘) ──
export const FXP = {
  // 팔레트: NEWTON Vivid — 브랜드 풀채도 (유저 확정 레퍼런스)
  stops: [['#B7231F', 0], ['#FA3030', .3], ['#FE6E3C', .56], ['#FEA35F', .74], ['#FEC389', .86], ['#FFF3DC', 1]],
  sat: 1.0,
  graphics: { width: 1.0, halo: 0.9, noise: 0.5, ember: 0.3, duration: 1.05, size: 1.5 },
  mark: { radius: 1.0, core: 1.0, halo: 0.9, pool: 0.55, sweep: 1.0, wobble: 0.5 },
  person: { blur: 1.0, glow: 0.9, flow: 0.55, decay: 0.62 },
  gainBoost: 1.0,   // 주간 모드 투사 게인 (주광 가시 = 제품 스토리)
  arrow: { line: 'solid', w: 1 },   // 화살표 라인 스타일 (FX Lab에서 편집)
};

// ── LUT 256×1 DataTexture (전 셰이더 공유) ─────
const lutData = new Uint8Array(256 * 4);
let lutTex = null;
export function rebuildLUT() {
  const st = [...FXP.stops].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let j = 0;
    while (j < st.length - 2 && v > st[j + 1][1]) j++;
    const [c0, p0] = st[j], [c1, p1] = st[j + 1];
    const f = Math.max(0, Math.min(1, (v - p0) / Math.max(1e-5, p1 - p0)));
    const a = rgb2ok(...hex2rgb(c0)), b = rgb2ok(...hex2rgb(c1));
    const rgb = ok2rgb(a[0] + (b[0] - a[0]) * f,
                       (a[1] + (b[1] - a[1]) * f) * FXP.sat,
                       (a[2] + (b[2] - a[2]) * f) * FXP.sat);
    lutData.set([...rgb, 255], i * 4);
  }
  if (lutTex) lutTex.needsUpdate = true;
  return lutData;
}
export function getLUT() {
  if (!lutTex) {
    rebuildLUT();
    lutTex = new THREE.DataTexture(lutData, 256, 1, THREE.RGBAFormat);
    lutTex.minFilter = lutTex.magFilter = THREE.LinearFilter;
    lutTex.wrapS = lutTex.wrapT = THREE.ClampToEdgeWrapping;
    lutTex.needsUpdate = true;
  }
  return lutTex;
}
/** 캔버스 2D용 색 조회 (발자국 텍스처 등) */
export function lutColor(v) {
  const i = Math.max(0, Math.min(255, Math.round(v * 255))) * 4;
  if (!lutTex) rebuildLUT();
  return `rgb(${lutData[i]},${lutData[i + 1]},${lutData[i + 2]})`;
}

// ── GLSL 공용 청크 (FX Lab과 동일 수식) ────────
export const FX_GLSL = `
uniform sampler2D uLUT;
vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
float fxhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxvn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(fxhash(i), fxhash(i+vec2(1,0)), f.x), mix(fxhash(i+vec2(0,1)), fxhash(i+vec2(1,1)), f.x), f.y);
}
float fxfbm(vec2 p){ return fxvn(p)*0.55 + fxvn(p*2.13+7.7)*0.28 + fxvn(p*4.31+3.1)*0.17; }
// 세련된 일렁임: 저주파 사인 하모닉 (노이즈 양배추 금지)
float fxundul(float ang, float t){
  return sin(ang*2.0 + t*1.1)*0.45 + sin(ang*3.0 - t*0.73 + 1.7)*0.33 + sin(ang*5.0 + t*0.41 + 4.2)*0.22;
}`;

// ── 커스텀 글리프 (FX Lab 슬롯 교체 SVG → 시뮬 소비) ─────────
//   슬롯 키: '0'~'9', '+','−','×','%', 'FOOT_L/R', 'TIP_*'. 값 = dataURL.
export const GLYPHS = {
  map: {},
  flip: {},
  imgs: new Map(),
  _listeners: new Set(),
  setFlips(flips) { this.flip = flips || {}; },
  set(map) {
    this.map = map || {};
    for (const url of Object.values(this.map)) {
      if (this.imgs.has(url)) continue;
      const img = new Image();
      img.src = url;
      img.onload = () => { for (const cb of this._listeners) cb(); };
      this.imgs.set(url, img);
    }
  },
  onLoad(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); },
  /** ch 슬롯의 로드 완료된 이미지 (없거나 미로드면 null) */
  img(ch) {
    const url = this.map[ch];
    if (!url) return null;
    const img = this.imgs.get(url);
    return (img && img.complete && img.naturalWidth) ? img : null;
  },
};
/** SVG → 비트맵 래스터 + 실픽셀 타이트 바운딩 (viewBox 여백 비대칭 보정) — 이미지별 1회 캐시.
 *  주의: SVG에 9인자 drawImage(소스 사각형)는 브라우저 래스터 버그가 있어
 *  반드시 비트맵으로 구운 뒤 캔버스에서 크롭한다. */
function glyphRaster(img) {
  if (img._raster) return img._raster;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const sc = Math.min(S / img.naturalWidth, S / img.naturalHeight);
  g.drawImage(img, 0, 0, img.naturalWidth * sc, img.naturalHeight * sc);
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
    if (d[(y * S + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  img._raster = x1 < 0 ? { canvas: c, x: 0, y: 0, w: S, h: S } :
    { canvas: c, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return img._raster;
}
/** 캔버스에 커스텀 글리프를 웜 크림 틴트+글로우로 (x,y) 중심 렌더. 성공 시 true. */
export function drawGlyph(ctx, ch, x, y, sizePx, { color = 'rgba(255,240,220,0.95)', glowColor = 'rgba(254,150,90,0.75)', glow = 14 } = {}) {
  const img = GLYPHS.img(ch);
  if (!img) return false;
  const off = document.createElement('canvas');
  off.width = off.height = sizePx;
  const og = off.getContext('2d');
  const R = glyphRaster(img);
  const sc = Math.min(sizePx / R.w, sizePx / R.h);
  const w = R.w * sc, h = R.h * sc;
  if (GLYPHS.flip[ch]) { og.save(); og.translate(0, sizePx); og.scale(1, -1); }
  og.drawImage(R.canvas, R.x, R.y, R.w, R.h, (sizePx - w) / 2, (sizePx - h) / 2, w, h);
  if (GLYPHS.flip[ch]) og.restore();
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = color;
  og.fillRect(0, 0, sizePx, sizePx);
  ctx.shadowColor = glowColor; ctx.shadowBlur = glow;
  ctx.drawImage(off, x - sizePx / 2, y - sizePx / 2);
  ctx.shadowBlur = 0;
  ctx.drawImage(off, x - sizePx / 2, y - sizePx / 2);
  return true;
}

/** 발형 슬롯 선택 — 투사면 컨텍스트: 잔디·트랙·보도블럭=야외, 그 외=실내 */
export function footSlot(right) {
  const outdoor = ['grass', 'track', 'paving'].includes(FXP.bg);
  return (outdoor ? 'FOOT_OUT_' : 'FOOT_IN_') + (right ? 'R' : 'L');
}
