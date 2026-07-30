// ─────────────────────────────────────────────────────────────
// FX 공유 인프라 — 히트 LUT + 셰이더 청크 + 라이브 파라미터
//
//   FX Lab(아티팩트)에서 확정한 룩의 본체 이식.
//   원칙: "모든 것은 온도다" — 마크·이펙트·레인·고스트가 하나의 LUT를 공유.
//   OKLab 보간(RGB 직선 보간의 탁한 갈색 구간 제거) + 채도 스케일(회색조 혼합).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { sdfFromAlpha, glyphRaster, bakeGlyphSDF, buildLUT } from './fx-core.js';
import { STOPS, SAT, PAL, NEU, rgba } from './palette.js';
// OKLab 변환·LUT 빌더는 fx-core(정본)에서 — 중복 2벌 폐기.

// ── 라이브 파라미터 (프로 편집 모드가 조절, 프레임마다 읽힘) ──
export const FXP = {
  // 팔레트 = src/palette.js 단일 소스 (유채 4색 · 채도 고정)
  stops: STOPS.map(s => [...s]),
  sat: SAT,
  graphics: { width: 1.0, halo: 0.9, noise: 0.5, ember: 0.3, duration: 1.05, size: 1.5 },
  mark: { radius: 1.0, core: 1.0, halo: 0.9, pool: 0.55, sweep: 1.0, wobble: 0.5 },
  // 인물 = 뉴턴톤만 살리고 나머지 0 (유저 07-30). 얼룩·잔상·그레인은 전부 아티팩트 원천이었고,
  //   부드러움은 슬라이더가 아니라 필드 RT 가우시안(코드)이 만든다. 음영만 남긴다.
  person: { blur: 0, glow: 0, flow: 0, decay: 0, detail: 0.25, grain: 0, tone: 1 },
  gainBoost: 1.0,   // 주간 모드 투사 게인 (주광 가시 = 제품 스토리)
  a3Arrow: 4,       // 하이니 리프트 큐 (1 셰브론 · 2 스템+SVG촉 · 3 바 · 4 궤적 토큰=기본)
  liveUI: 3,   // 실전 UI 기본 = 3안 셰브론 플로우(리서치 확정: 상대속도 흐름·락온)        // 실전 러닝 플로어 UI 5안 (1 페이스라인 · 2 펄스링 · 3 셰브론 · 4 도트 · 5 스트립)
  arrow: { line: 'solid', w: 1, speed: 1, gap: 1, glow: 1, heat: 0.5, tail: 0.55 },   // LINE 최소 토큰 (FX Lab)
  lane: { style: 'dash' },   // 레인 전용 스타일 — 화살표와 분리 (재료 파라미터는 arrow 공유)
  card: { titleZ: 2.68, eyebrow: 0.30, footerZ: 1.28, titleCap: 0.13, eyeCap: 0.07, footCap: 0.065, cta: 1.0 },   // 스테이지 카드 조판 — 피그마 StageCard/베이스 실측 임포트(v15 파이프라인)
};

// ── LUT 256×1 DataTexture (전 셰이더 공유) ─────
const lutData = new Uint8Array(256 * 4);
let lutTex = null;
export function rebuildLUT() {
  buildLUT(FXP.stops, FXP.sat, lutData);   // fx-core 정본 — FX Lab과 같은 코드로 굽는다
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
// ── 정본 글리프 (다듬은 SVG, 저장소 동봉) ──────────────────────────────
// 규칙: 이 맵은 디자인 스토어 저장본보다 **우선한다**. 예전엔 저장본이 뒤에 와서
// 덮었고(심지어 GLYPHS.set(st.glyphs) 는 맵을 통째 교체했다), 그 바람에 랩에서
// 한 번이라도 글리프를 올린 브라우저는 다듬은 정본이 영영 안 보였다.
// 정본에 없는 슬롯(연산 기호 + − × %, TIP_*, WARN_EXCL 등)은 저장본이 채운다.
const _G = import.meta.env.BASE_URL + 'ready-view/assets/glyphs/';
export const DEFAULT_GLYPHS = {
  L: import.meta.env.BASE_URL + 'ready-view/assets/glyph_L.svg',
  R: import.meta.env.BASE_URL + 'ready-view/assets/glyph_R.svg',
  '0': _G + 'num-0.svg', '1': _G + 'num-1.svg', '2': _G + 'num-2.svg',
  '3': _G + 'num-3.svg', '4': _G + 'num-4.svg', '5': _G + 'num-5.svg',
  '6': _G + 'num-6.svg', '7': _G + 'num-7.svg', '8': _G + 'num-8.svg',
  '9': _G + 'num-9.svg',
  // 실내=맨발(FOOT_IN) · 야외=신발(FOOT_OUT) — footSlot() 규약
  FOOT_IN_L:  _G + 'foot-in-l.svg',  FOOT_IN_R:  _G + 'foot-in-r.svg',
  FOOT_OUT_L: _G + 'foot-out-l.svg', FOOT_OUT_R: _G + 'foot-out-r.svg',
};

// SVG 래스터·SDF 베이커는 fx-core(정본, FX Lab 구현 승격)에서 — 중복 2벌 폐기.
/** 캔버스에 커스텀 글리프를 웜 크림 틴트+글로우로 (x,y) 중심 렌더. 성공 시 true. */
export function drawGlyph(ctx, ch, x, y, sizePx, { color = rgba(NEU.ink, 0.95), glowColor = rgba(PAL.coral, 0.75), glow = 14 } = {}) {
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

/** 여러 자리 숫자 — 글리프로 커닝·자동 축소해 한 폭 안에 그림(마크 카운트 10~99 대응).
 *  1자리는 drawGlyph 그대로. 2자리↑는 각 글리프 자연 종횡비로 폭을 재고 전체가 sizePx 안에
 *  들도록 축소 + 미세 커닝('1'처럼 좁은 글리프는 자연 폭이라 자동으로 붙음). */
export function drawNumber(ctx, num, cx, cy, sizePx, opts = {}) {
  const s = String(num);
  if (s.length <= 1) return drawGlyph(ctx, s, cx, cy, sizePx, opts);
  const ds = sizePx * (s.length === 2 ? 0.66 : 0.48);   // 자리당 크기 축소(2자리는 급하지 않게 0.66)
  const adv = ds * 0.66;                                 // 자간 = 넉넉히(너무 붙지 않게)
  let x = cx - adv * (s.length - 1) / 2, ok = true;
  for (let i = 0; i < s.length; i++) { ok = drawGlyph(ctx, s[i], x, cy, ds, opts) && ok; x += adv; }
  return ok;
}

/** 발형 슬롯 선택 — FX Lab 발 컨텍스트 칩(footCtx) 기준, 야외(신발) 기본 */
export function footSlot(right) {
  return (FXP.footCtx === 'in' ? 'FOOT_IN_' : 'FOOT_OUT_') + (right ? 'R' : 'L');
}

/** float SDF → three.js 텍스처 (무손실 d/N — 8bit 양자화 폐기가 지글거림의 근본 해결) */
function sdfTexture(FS) {
  const tex = new THREE.DataTexture(FS.data, FS.N, FS.N, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  tex._cx = FS.cx; tex._cy = FS.cy;   // 실루엣 무게중심 — 마크 숫자 폴백 앵커(랩과 동일 규약)
  return tex;
}
const _sdfCache = new Map();
/** 발형 SDF 텍스처 — fx-core 베이커(FX Lab과 같은 코드) 소비. */
export function footSDFTexture(right) {
  const slot = footSlot(right);
  const url = GLYPHS.map[slot];
  const flip = !!GLYPHS.flip[slot];
  const key = (url ? url.length : 'builtin') + '|' + slot + '|' + flip;
  if (_sdfCache.has(key)) return _sdfCache.get(key);
  const img = url ? GLYPHS.img(slot) : null;
  if (url && !img) return null;   // 로드 전 — onLoad 리베이크가 재시도
  const N = 768;
  let FS;
  if (img) {
    FS = bakeGlyphSDF(img, N, flip);
  } else {
    // 내장 발 폴백 (fxlab footSDF 드로잉과 동일)
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.save(); g.translate(N / 2, N / 2); g.scale(N / 128, N / 128); g.rotate(-0.09);
    if (right) g.scale(-1, 1);
    g.beginPath(); g.ellipse(-1, -16, 13, 18, 0.06, 0, 7); g.fill();
    g.beginPath(); g.ellipse(3, 24, 9.5, 12, -0.05, 0, 7); g.fill();
    g.beginPath(); g.ellipse(1, 4, 8, 14, 0, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) {
      const a = -1.0 + i * 0.44;
      g.beginPath(); g.arc(Math.sin(a) * 15 - 1, -37 - Math.cos(a) * 3.5 + Math.abs(a) * 6, 4.4 - Math.abs(i - 1.4) * 0.55, 0, 7); g.fill();
    }
    g.restore();
    FS = sdfFromAlpha(g.getImageData(0, 0, N, N).data, N);
  }
  const tex = sdfTexture(FS);
  _sdfCache.set(key, tex);
  return tex;
}
/** 워닝 느낌표 SDF — WARN_EXCL 슬롯, fx-core 베이커 소비. 싱글턴 캐시. */
let _warnTex = null, _warnKey = null;
export function warnSDFTexture() {
  const url = GLYPHS.map.WARN_EXCL;
  if (!url) return null;
  const img = GLYPHS.img('WARN_EXCL');
  if (!img) return null;   // 로드 전 — onLoad 리베이크가 재시도
  const key = url.length;
  if (_warnTex && _warnKey === key) return _warnTex;
  _warnTex = sdfTexture(bakeGlyphSDF(img, 512));
  _warnKey = key;
  return _warnTex;
}
