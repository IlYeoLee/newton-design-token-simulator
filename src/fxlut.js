// ─────────────────────────────────────────────────────────────
// FX 공유 인프라 — 히트 LUT + 셰이더 청크 + 라이브 파라미터
//
//   FX Lab(아티팩트)에서 확정한 룩의 본체 이식.
//   원칙: "모든 것은 온도다" — 마크·이펙트·레인·고스트가 하나의 LUT를 공유.
//   OKLab 보간(RGB 직선 보간의 탁한 갈색 구간 제거) + 채도 스케일(회색조 혼합).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { sdfFromAlpha, glyphRaster, bakeGlyphSDF, bakeFootPairSDF, buildLUT } from './fx-core.js';
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
  //   detail = 결(옷주름·톤차)의 세기. 셰이더에서 clamp(detail*2.4) 가 좁은블러 쪽 혼합비다
  //     (0.25 = 60% · 0.417 이상 = 100%). 저장본 0.15(=36%)에서 올렸지만 실측 결과 화면에선
  //     차이가 안 나온다 — 국소대비 0.0471 → 0.0472. 넓은 평균장을 80×120 에서 굽기 때문에
  //     애초에 벌어질 결 자체가 거의 없다. 코드 기본값과 저장본을 맞추는 의미만 있다.
  //   sweep = personLook 의 T 대역 확장 폭(피벗 기준 대비 확장). **기본 0 = 도입 전과 픽셀 동일.**
  //     '채도를 올린다'로는 안 듣는다(평균채도 0.593 → 0.584). LUT 램프는 구간마다 채도가 비슷해서
  //     T 를 옮기면 색상만 바뀐다 — 평균 채도를 올리는 건 sat(→uPSat)뿐이다. 다만 국소 Δ색상은
  //     0.581 → 0.748 (+29%) 로 오르므로 '대비를 벌리는' 손잡이로는 유효하다. 기본 0 은 취향 판단 보류.
  //     손잡이는 남겨 둔다 — 색상·명암 대비를 벌리고 싶을 때 쓰는 용도이고, 같은 시도를 또 하는 것을 막는다.
  //   ink/inkT = 명암 잉크: 실제 인물의 그늘(원본 블러 휘도 < inkT)을 뉴턴 RED 로 물들이는 양·문턱.
  //     depth(=uPDepth)로는 이게 안 된다 — 그 경로는 절대 밝기를 18% 만 반영하도록 설계돼 있어
  //     순흑도 T 를 0.05 밖에 못 민다. ink 는 LUT 대역(하한 P_LO 0.40)도 우회해 #FA3030 를 직접 얹는다.
  // ink 0.85 → 0.30: 문턱(0.42) 아래를 순수 RED 로 덮는 항이라, 실사 클립의 중간톤 대부분이
  //   걸려 몸 전체가 단색 빨강이 됐다(유저: 평면적·1차원적). 그늘 '강조'로만 남긴다.
  // form = 룩2(유저 확정 08-02) 기본 승격. 0 = 구 룩(롤백 지점). 랩 [현행/레퍼런스] 토글이 이 값.
  person: { form: 1, blur: 0, glow: 0, flow: 0, decay: 0, detail: 0.42, sweep: 0, depth: 0.34, grain: 0, tone: 1, ink: 0.30, inkT: 0.42,
    // 부위 강조 — k 0 = 도입 전과 픽셀 동일. t 0.25 = look2Ramp 의 브랜드 RED(#FA3030) 자리.
    //   몸통 밴드가 0.30~1.00 이라 붉은 구간을 안 지난다 — 그래서 강조는 t 를 **내린다**.
    // ⚠ **전역 기본값은 건드리지 않는다.** 여기 값을 바꾸면 복싱·러닝·농구가 **전부** 같이 간다
    //   (유저 08-07: 하드코딩하면서 복싱이랑 다른 것도 건드렸다 — 그러면 안 돼).
    //   강조는 '그 순간 그 부위'에 거는 것이지 룩의 기본 상태가 아니다. 켤 곳에서만 켠다.
    emph: { k: 0, t: 0.25, y0: 0, y1: 0.22, soft: 0.06 },
    // 몸통 대역 — 0.30/1.00 = 종전(전부 주황). 낮고 좁게 두면 흰-코랄로 간다.
    bandLo: 0.30, bandHi: 1.00,
    // 인물 전용 채도(무채축 대비 배율). null = 전역 FXP.sat 파생(1.32) 그대로 = 종전과 픽셀 동일.
    sat: null },
  gainBoost: 1.0,   // 주간 모드 투사 게인 (주광 가시 = 제품 스토리)
  a3Arrow: 4,       // 하이니 리프트 큐 (1 셰브론 · 2 스템+SVG촉 · 3 바 · 4 궤적 토큰=기본)
  liveUI: 3,   // 실전 UI 기본 = 3안 셰브론 플로우(리서치 확정: 상대속도 흐름·락온)        // 실전 러닝 플로어 UI 5안 (1 페이스라인 · 2 펄스링 · 3 셰브론 · 4 도트 · 5 스트립)
  arrow: { line: 'solid', w: 1, speed: 1, gap: 1, glow: 1, heat: 0.5, tail: 0.55 },   // LINE 최소 토큰 (FX Lab)
  lane: { style: 'dash' },   // 레인 전용 스타일 — 화살표와 분리 (재료 파라미터는 arrow 공유)
  card: { titleZ: 2.68, eyebrow: 0.30, footerZ: 1.28, titleCap: 0.13, eyeCap: 0.07, footCap: 0.065, cta: 1.0 },   // 스테이지 카드 조판 — 피그마 StageCard/베이스 실측 임포트(v15 파이프라인)
  // 마크 안 숫자를 무엇으로 그리나 — 'glyph'=슬롯 SVG(정본, 기본) · 'offbit'=OffBit 도트 폰트.
  // 도트 폰트는 이미 플로어 UI 수치(카운트다운·km)가 쓰는 것이라, 마크까지 같은 활자로
  // 통일해볼 수 있게 열어둔 스위치다. 랩 토글 → 브리지 → 시뮬 동일 경로.
  // 랩(footlab)에서 도트 폰트로 확정 — 시뮬 기본값도 같이 옮긴다(유저: 100% 그대로 이식).
  numSrc: 'offbit',
  // 마크 합성 — 'ink'(풀컬러 잉크·NormalBlending) / 'add'(가산광).
  //   가산은 밝은 바닥 위에서 대비가 구조적으로 떨어져 랩(어두운 캔버스)보다 뿌옇게 보인다.
  //   유저 지시: 잉크로 간다(필터는 나중에 조정). 주간 모드(FXP.day)는 원래도 잉크였다 — 같은 경로다.
  markBlend: 'ink',
};

/** OffBit 도트 폰트가 캔버스에서 쓸 수 있게 미리 로드 — floorgl/wallgl 과 같은 규약 */
/** OffBit 도트 폰트 로드. 반환 Promise 는 '실제로 쓸 수 있게 된 시점'이다 —
 *  숫자는 캔버스에 텍스처로 구워지는데, 굽는 시점에 폰트가 없으면 Supreme 으로 구워지고
 *  나중에 폰트가 도착해도 다시 굽지 않는다(유저: "폰트도 미반영"). 호출부가 이 Promise 뒤에
 *  refreshGlyphConsumers() 를 걸어 재굽기를 해야 한다. */
export function ensureOffBit() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve(false);
  const jobs = [];
  for (const f of ["700 100px 'OffBit'", "700 100px OffBit"]) {
    try { jobs.push(document.fonts.load(f)); } catch { /* 폰트 미선언 페이지 — 폴백으로 간다 */ }
  }
  return Promise.all(jobs).then(() => document.fonts.check("700 100px 'OffBit'")).catch(() => false);
}

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
/** 정본 세대. 정본 SVG 를 갈아끼울 때 올린다 — 저장본의 낡은 dataURL 을 '한 번만' 청소하는 기준. */
export const GLYPH_REV = 2;
/** 저장본 + 정본 병합. 세대가 낮으면 정본과 겹치는 저장본 항목을 버리고(1회 이행) 정본을 심는다.
 *  이행이 끝난 뒤에는 **저장본이 이긴다** — 그래야 랩에서 올린 SVG 가 반영된다.
 *  (정본을 항상 뒤에 두면 유저가 새 글리프를 올려도 화면이 안 바뀐다 — 실제로 그 버그를 만들었다.) */
export function mergeGlyphs(saved, savedRev) {
  const s = { ...(saved || {}) };
  if ((savedRev | 0) < GLYPH_REV) for (const k of Object.keys(DEFAULT_GLYPHS)) delete s[k];
  return { ...DEFAULT_GLYPHS, ...s };
}
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
  // ★ 러닝 판정 마크 안에 들어가는 **로고 글리프**. 전엔 tokens.js 가 이 SVG(pace_foot.svg)를
  //   직접 `new Image()` 로 물고 틴트·글로우·미러를 **따로 구현**하고 있었다 — 슬롯 시스템
  //   밖이라 랩에서 안 보이고, 룩(색·글로우)을 바꿔도 이 하나만 안 따라왔다(유저: 시스템화해라).
  //   이제 다른 글리프와 같은 슬롯이다: drawGlyph 한 벌이 그리고, 좌/우는 mirror 로 뒤집는다.
  LOGO: _G + 'logo.svg',
};

// 정본을 모듈 로드 시점에 즉시 깔아둔다. 예전엔 디자인 스토어를 읽고 병합한 뒤에야
// GLYPHS.set 이 불려서, 부팅 후 ~2초간 숫자 슬롯이 비어 있었다(실측: 0.5s·1.5s 는 빈
// 슬롯 → drawGlyph 실패 → 호출부가 시스템 폰트로 폴백, 3s 에 글리프 등록되며 리베이크).
// 그래서 숫자가 떴다가 순식간에 다른 활자로 바뀌었다(유저 신고). 나중에 오는 저장본은
// 이 위에 병합되므로 최종 결과는 그대로다.
GLYPHS.set({ ...DEFAULT_GLYPHS });

// SVG 래스터·SDF 베이커는 fx-core(정본, FX Lab 구현 승격)에서 — 중복 2벌 폐기.
/** OffBit 도트 폰트로 (x,y) 중심 렌더 — 글리프 SVG와 같은 틴트·글로우 규약을 그대로 쓴다.
 *  글리프 경로가 sizePx 를 '그려질 최대 크기'로 쓰므로 여기서도 같은 뜻으로 맞춘다:
 *  폰트 크기를 sizePx 로 두고 실측 폭이 넘치면 줄인다(두 자리 이상 대응). */
function drawOffBit(ctx, text, x, y, sizePx, { color = rgba(NEU.ink, 0.95), glowColor = rgba(PAL.coral, 0.75), glow = 14 } = {}) {
  const s = String(text);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = sizePx;
  ctx.font = `700 ${fs}px 'OffBit','Supreme',sans-serif`;
  const w = ctx.measureText(s).width;
  if (w > sizePx) { fs = sizePx * (sizePx / w); ctx.font = `700 ${fs}px 'OffBit','Supreme',sans-serif`; }
  ctx.fillStyle = color;
  ctx.shadowColor = glowColor; ctx.shadowBlur = glow;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(s, x, y);   // 글리프 경로와 동일하게 2패스(글로우 위에 본체)
  ctx.restore();
  return true;
}

/** 캔버스에 커스텀 글리프를 웜 크림 틴트+글로우로 (x,y) 중심 렌더. 성공 시 true. */
export function drawGlyph(ctx, ch, x, y, sizePx, { color = rgba(NEU.ink, 0.95), glowColor = rgba(PAL.coral, 0.75), glow = 14, mirror = false } = {}) {
  // ★★ 규약(유저 08-06, 3회 지적): **마크 안 영문·한글·숫자는 무조건 도트 폰트**.
  //   전엔 `/^[0-9]$/` 라 숫자만 도트로 가고 L·R 은 SVG 슬롯(glyph_L/R.svg 필기체)으로 갔다 —
  //   그게 "아직도 도트폰트 안 쓰냐"의 정체다. 한 글자 글자(영문·한글·숫자)는 전부 도트로 보낸다.
  //   **도형 슬롯은 그대로 SVG**다: LOGO·FOOT_OUT_L·TIP_TRI·WARN_EXCL 처럼 두 글자 이상인 이름과
  //   연산 기호(+ − × %)는 이 정규식에 안 걸린다 — 글자가 아니라 그림이기 때문이다.
  if (FXP.numSrc === 'offbit' && /^[0-9A-Za-z가-힣]$/.test(String(ch))) {
    return drawOffBit(ctx, ch, x, y, sizePx, { color, glowColor, glow });
  }
  const img = GLYPHS.img(ch);
  if (!img) return false;
  const off = document.createElement('canvas');
  off.width = off.height = sizePx;
  const og = off.getContext('2d');
  const R = glyphRaster(img);
  const sc = Math.min(sizePx / R.w, sizePx / R.h);
  const w = R.w * sc, h = R.h * sc;
  // flip = 슬롯 자체의 상하 반전(저작 값) · mirror = 호출부의 좌우 반전(왼발/오른발 같은 대칭 쌍)
  const tf = GLYPHS.flip[ch] || mirror;
  if (tf) { og.save(); og.translate(mirror ? sizePx : 0, GLYPHS.flip[ch] ? sizePx : 0);
            og.scale(mirror ? -1 : 1, GLYPHS.flip[ch] ? -1 : 1); }
  og.drawImage(R.canvas, R.x, R.y, R.w, R.h, (sizePx - w) / 2, (sizePx - h) / 2, w, h);
  if (tf) og.restore();
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
  // ★ **슬롯 이름이 오면 그 슬롯을 한 글자로 그린다**(LOGO·FOOT_OUT_L·TIP_TRI …).
  //   전엔 여기로 'LOGO' 가 들어오면 OffBit 도트로 "LOGO" 라고 쓰거나 L·O·G·O 네 글자로
  //   쪼개 그렸다 — 숫자만 가정한 함수에 도형 슬롯을 통과시킨 쪽의 사고다. 슬롯이 있으면 슬롯이다.
  //   ★ 판정 기준은 `map`(선언된 슬롯)이지 `img`(로드 끝난 이미지)가 아니다. img 로 보면
  //     **로드 전 한 프레임**에 'LOGO' 가 L·O·G·O 로 쪼개져 'L' 만 그려지고, 그 텍스처가
  //     캐시되어 영원히 L 로 남는다(유저: 또 로고 없어졌어 → 실제로 L 이 찍혀 있었다).
  //     선언된 슬롯이면 drawGlyph 가 미로드 시 false 를 돌려주고, 호출부는 로드 후 다시 굽는다.
  if (GLYPHS.map[s]) return drawGlyph(ctx, s, cx, cy, sizePx, opts);
  // OffBit 은 진짜 활자라 커닝이 폰트에 들어 있다 — 자리별로 쪼개지 말고 한 번에 그린다.
  if (FXP.numSrc === 'offbit' && /^[0-9]+$/.test(s)) return drawOffBit(ctx, s, cx, cy, sizePx, opts);
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

/** float SDF → three.js 텍스처 (무손실 d/N — 8bit 양자화 폐기가 지글거림의 근본 해결).
 *  채널: R = 겉(신발 실루엣) · G = 안(맨발 자국). 한 채널만 있으면 G 에 R 을 복사해
 *  셰이더가 어떤 경로에서도 .g 를 안전하게 읽게 한다(각인은 uImp 로 따로 끈다). */
function sdfTexture(FS) {
  const pair = FS.data.length === FS.N * FS.N * 2;
  const tex = pair
    ? new THREE.DataTexture(FS.data, FS.N, FS.N, THREE.RGFormat, THREE.FloatType)
    : new THREE.DataTexture(FS.data, FS.N, FS.N, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  tex._cx = FS.cx; tex._cy = FS.cy;   // 실루엣 무게중심 — 마크 숫자 폴백 앵커(랩과 동일 규약)
  tex._inCx = FS.inCx ?? FS.cx; tex._inCy = FS.inCy ?? FS.cy;   // 맨발 자국 무게중심
  tex._hasInner = !!FS.hasInner;
  return tex;
}
const _sdfCache = new Map();
/** 발형 SDF 텍스처 — fx-core 베이커(FX Lab과 같은 코드) 소비.
 *  겉은 footCtx 가 고른 슬롯(야외=신발/실내=맨발), 안은 **항상 맨발** — 깔창 각인의 그림이 맨발이다.
 *  실내(겉=맨발)면 겉과 안이 같은 그림이라 각인이 무의미하므로 안 채널을 비운다. */
export function footSDFTexture(right) {
  const slot = footSlot(right);
  const url = GLYPHS.map[slot];
  const flip = !!GLYPHS.flip[slot];
  const inSlot = 'FOOT_IN_' + (right ? 'R' : 'L');
  const inUrl = slot === inSlot ? null : GLYPHS.map[inSlot];
  const key = (url ? url.length : 'builtin') + '|' + slot + '|' + flip + '|' + (inUrl ? inUrl.length : 0);
  if (_sdfCache.has(key)) return _sdfCache.get(key);
  const img = url ? GLYPHS.img(slot) : null;
  if (url && !img) return null;   // 로드 전 — onLoad 리베이크가 재시도
  const inImg = inUrl ? GLYPHS.img(inSlot) : null;
  if (inUrl && !inImg) return null;   // 안쪽도 같이 기다린다 — 반쪽만 구우면 캐시가 그걸 박제한다
  const N = 768;
  let FS;
  if (img) {
    FS = bakeFootPairSDF(img, inImg, N, flip);
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
  tex._right = !!right;   // 각인 오프셋의 x 미러 판단 — 재질 팩토리는 이 텍스처만 받는다
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
