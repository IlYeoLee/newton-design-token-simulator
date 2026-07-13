import * as THREE from 'three';
import { WALL_Z } from './scene.js';
import { renderDesignCanvas } from './studio/design.js';
import { getLUT, FXP, FX_GLSL, GLYPHS, drawGlyph, footSDFTexture } from './fxlut.js';

// ── MARK 파동 셰이더 (FX Lab 이식) — 재료는 열 하나, 상태는 파동의 위상 ──
const MARKFX_VERT = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const MARKFX_FRAG = `
#include <common>
#include <clipping_planes_pars_fragment>
` + FX_GLSL + `
uniform float uPhase, uProg, uFade, uStrong, uContract, uTime, uSeed;
uniform float uW, uHalo, uPool, uSweepA, uWobble, uGain, uDay;
uniform float uShape;               // 0=존 원 / 1=발형 (FX Lab markShape)
uniform sampler2D uSDF;             // 발형 실루엣 SDF (FOOT 슬롯 SVG)
varying vec2 vUv;
// 시안 보드 팔레트 (발모양 자체 이펙트 시안.svg 그대로)
#define FXC_RED   vec3(0.980, 0.188, 0.188)
#define FXC_CORAL vec3(0.996, 0.431, 0.235)
#define FXC_SAND  vec3(0.996, 0.765, 0.537)
#define FXC_CREAM vec3(0.996, 0.886, 0.776)
#define FXC_ICE   vec3(0.820, 0.996, 1.000)
void main() {
  #include <clipping_planes_fragment>
  vec2 uv = (vUv - 0.5) * 2.0;
  float d = length(uv);
  float ang = atan(uv.y, uv.x);
  float u1 = fxundul(ang + uSeed, uTime * 1.6);
  float Rz = 0.72;                                     // 쿼드 로컬 존 반경
  float sd;
  if (uShape > 0.5) {
    vec2 suv = uv * 0.5 + 0.5;
    sd = (texture2D(uSDF, vec2(suv.x, 1.0 - suv.y)).r - 0.5019) * 0.5 + u1 * uWobble * 0.02;   // 인코드 범위 ±N/4와 짝
  } else {
    sd = d * (1.0 + u1 * uWobble * 0.05) - Rz;
  }
  // ── 시안 '발모양 자체 이펙트' 보드 그대로 — 상태별 라디얼 필, 모션은 그 안에서만 (FX Lab MARK_FRAG와 동일 문법)
  float inside = smoothstep(0.012, -0.012, sd);
  float outPos = max(sd, 0.0);
  float dashM = uContract > 0.5 ? smoothstep(0.15, 0.55, 0.5 + 0.5 * sin(ang * 18.0 + u1)) : 1.0;   // 회피 점선
  float ext = uShape > 0.5 ? 0.60 : Rz;
  vec2 gcBall = uShape > 0.5 ? vec2(0.0, 0.17) : vec2(0.0);
  float fillGain = clamp(uPool * 1.6, 0.0, 1.2);
  vec3 col = vec3(0.0);
  if (uPhase < 0.5) {            // Preview: 샌드 아웃라인 ↔ 크림 필 — uStrong이 차오름을 구동
    float f = uStrong;
    float breath = 1.0 + 0.05 * sin(uTime * 2.0);
    float q = length(uv - gcBall) / (ext * 0.98 * breath);
    vec3 fillCol = mix(FXC_CREAM, mix(FXC_CORAL, FXC_SAND, smoothstep(0.0, 0.733, q)), f);
    col = fillCol * inside * mix(0.30, 0.70, f) * fillGain;
    col += FXC_SAND * exp(-pow(sd / (0.03 * uW), 2.0)) * dashM * (0.85 - 0.5 * f);
    col *= uFade;
  } else if (uPhase < 1.5) {     // Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 이벤트)
    float gradR = uShape > 0.5 ? 1.45 : ext * 1.38;            // 발형은 얼음빛이 가장자리 자락만
    float q = length(uv - gcBall) / gradR;
    vec3 fc = mix(FXC_RED, FXC_CORAL, smoothstep(0.0, 0.479, q));
    fc = mix(fc, FXC_SAND, smoothstep(0.479, 0.607, q));
    fc = mix(fc, FXC_ICE, smoothstep(0.607, 0.750, q));
    col = fc * inside * min(fillGain * 1.15, 1.0);
    float hw = max((0.22 - 0.16 * uProg) * uW, 0.035);
    float h = exp(-pow(outPos / hw, 1.3)) * (1.0 - inside);
    col += mix(FXC_SAND, FXC_ICE, smoothstep(0.15, 0.9, outPos / hw)) * h * uHalo * 0.5 * dashM;
  } else if (uPhase < 2.5) {     // Success 잔상: 진홍 블룸 + 얼음빛 림 플래시 → 소멸
    float e = 1.0 - pow(1.0 - uProg, 2.6);
    float q = length(uv - gcBall) / (uShape > 0.5 ? 1.5 : ext * 1.3) / (0.55 + 0.55 * e);
    vec3 fc = mix(FXC_RED, FXC_CORAL, smoothstep(0.47, 0.70, q));
    fc = mix(fc, FXC_SAND, smoothstep(0.70, 0.843, q));
    fc = mix(fc, FXC_ICE, smoothstep(0.843, 0.931, q));
    float fillA = (uProg < 0.4 ? 1.0 : pow(1.0 - (uProg - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    col = fc * inside * fillA;
    col += FXC_ICE * exp(-pow(abs(sd) / (0.04 * uW), 2.0)) * exp(-uProg * 9.0) * 0.8;
  } else if (uPhase < 3.5) {     // Locked: 회색 고스트 + 순번 — 시퀀스 전체가 먼저 보인다 (시안 보드)
    col = vec3(0.90) * inside * 0.12 * fillGain;
    col += vec3(0.80) * exp(-pow(sd / (0.028 * uW), 2.0)) * 0.55 * dashM;
    col *= uFade;
  } else if (uPhase > 4.5) {     // Hold: 코닉 진행 림 + 열이 아래로 고임 — uProg = 유지/회전/카운트 진행
    float pr = clamp(uProg, 0.0, 1.0);
    vec2 gcHeel = uShape > 0.5 ? vec2(0.0, -0.28) : vec2(0.0, -0.5 * ext);
    float qh = max(length(uv - mix(gcBall, gcHeel, pr)) / (ext * 1.02) - 0.24 * pr, 0.0);
    vec3 fc = mix(FXC_RED, FXC_CORAL, smoothstep(0.0, 0.23, qh));
    fc = mix(fc, FXC_SAND, smoothstep(0.23, 1.0, qh));
    col = fc * inside * min(fillGain, 1.0) * 0.5;
    float a01 = fract(0.25 - ang / 6.2832);
    float rim = exp(-pow((sd - 0.012) / (0.05 * uW), 2.0));
    float prog = smoothstep(pr + 0.045, pr - 0.045, a01);
    vec3 rimCol = mix(vec3(0.42), mix(FXC_RED, FXC_CORAL, clamp(a01 / max(pr, 0.001), 0.0, 1.0)), prog);
    col += rimCol * rim * mix(0.25, 0.95, prog) * dashM;
    col *= uFade;
  } else {                       // Miss: 온기가 식어 회색 고스트 → 무음 소멸 (판정 verdict 연동)
    float cool = smoothstep(0.0, 0.35, uProg);
    float gone = pow(1.0 - max(uProg - 0.45, 0.0) / 0.55, 1.6);
    float q = length(uv - gcBall) / ext;
    vec3 fc = mix(mix(FXC_CORAL, FXC_SAND, smoothstep(0.0, 0.733, q)), vec3(0.86), cool);
    col = fc * inside * mix(0.45, 0.20, cool) * gone * fillGain;
    col += vec3(0.80) * exp(-pow(sd / (0.03 * uW), 2.0)) * 0.5 * gone;
  }
  col *= uGain;
  // 주간 = 풀컬러 잉크(제품 스토리: 주광 가시 풀컬러 투사) — 가산은 밝은 바닥에서
  // 채널 클리핑으로 흰색으로 뭉개진다. 색상 보존 + 커버리지 알파로 표면색을 '대체'.
  if (uDay > 0.5) {
    float mc = max(col.r, max(col.g, col.b));
    gl_FragColor = vec4(col / max(mc, 1e-4), clamp(mc * 1.45, 0.0, 1.0));   // 잉크 커버리지 부스트 — 거의 풀컬러
  } else {
    gl_FragColor = vec4(col, 1.0);   // 야간: 가산 광 — 검정 = 무기여
  }
}`;
// ── 레인 광류 셰이더 — LINE 최소 토큰 소비 (스타일·두께·속도·간격·온도·글로우·꼬리) ──
//    FX Lab의 LINE 스테이션과 같은 문법: solid=연속 광류 / dash·dot=행진 / chevron=꺾쇠 트레인 / comet=백열 순회 / taper
const LANEFX_FRAG = `
#include <common>
#include <clipping_planes_pars_fragment>
` + FX_GLSL + `
uniform float uTime, uLen, uW, uHalo, uGain, uDay;
uniform float uLStyle, uLSpeed, uLGap, uLHeat, uLTail;
varying vec2 vUv;
void main() {
  #include <clipping_planes_fragment>
  float lat = (vUv.x - 0.5) * 2.0;                     // 폭방향 -1..1
  float along = vUv.y * uLen;                          // 진행 좌표 (m)
  lat += sin(along * 2.1 + uTime * 1.4) * 0.06;        // 미세 측면 웨이브
  float pulse = 1.0;
  float latEff = lat;
  float wEff = uW;
  if (uLStyle < 0.5) {                                 // solid — 연속 광류 (은은한 명멸)
    pulse = 0.55 + 0.25 * sin(along * 0.8 - uTime * 2.0 * uLSpeed);
  } else if (uLStyle < 1.5) {                          // dash — 행진 펄스 (간격 = uLGap)
    pulse = 0.28 + 0.72 * smoothstep(0.22, 0.58, 0.5 + 0.5 * sin(along * (9.0 / uLGap) - uTime * 5.2 * uLSpeed));
  } else if (uLStyle < 2.5) {                          // dot — 짧고 또렷한 점 행진
    pulse = smoothstep(0.75, 0.95, 0.5 + 0.5 * sin(along * (12.0 / uLGap) - uTime * 5.2 * uLSpeed));
    wEff *= 1.3;
  } else if (uLStyle < 3.5) {                          // chevron — 전방(^) 꺾쇠 트레인
    float alongEff = along + abs(lat) * 0.34;           // 팔이 뒤로 = 촉이 전방(-z 진행 방향)
    float cf = fract(alongEff * (1.5 / uLGap) - uTime * 1.2 * uLSpeed);
    float band = exp(-pow((cf - 0.30) / (0.055 * uW), 2.0));   // 꺾쇠 획 두께
    float armW = smoothstep(1.0, 0.86, abs(lat));       // 레인 폭 안에서만
    pulse = band * armW * (0.75 + 0.25 * sin(along * 0.7 - uTime * 1.8 * uLSpeed));
    latEff = 0.0;                                       // 형상은 band가 담당 (코어 가우시안 무력화)
  } else if (uLStyle < 4.5) {                          // comet — 백열 머리 + 감쇠 꼬리 순회
    float head = fract(uTime * 0.22 * uLSpeed) * uLen;
    float d = head - along;
    if (d < 0.0) d += uLen;
    float f = exp(-d / max(0.4, uLen * uLTail * 0.6));
    pulse = f * 1.6 + 0.10;
    wEff *= (0.7 + f * 0.9);
  } else {                                             // taper — 전방으로 갈수록 넓게
    wEff *= (0.35 + vUv.y * 1.4);
    pulse = 0.5 + 0.2 * sin(along * 0.8 - uTime * 1.6 * uLSpeed);
  }
  float core = exp(-pow(latEff / (0.10 * wEff), 2.0)) + exp(-pow(latEff / (0.42 * wEff), 2.0)) * 0.30 * uHalo;
  float heat = core * pulse * 0.5;
  heat *= smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
  float sweep = 0.12 * sin(along * 0.9 - uTime * 1.7);
  vec3 col = lut(clamp(uLHeat - 0.08 + sweep + heat * 0.25, 0.0, 1.0)) * heat * uGain;
  if (uDay > 0.5) {   // 주간 = 풀컬러 잉크 (MARKFX와 동일 규약)
    float mc = max(col.r, max(col.g, col.b));
    gl_FragColor = vec4(col / max(mc, 1e-4), clamp(mc * 1.45, 0.0, 1.0));   // 잉크 커버리지 부스트 — 거의 풀컬러
  } else {
    gl_FragColor = vec4(col, 1.0);
  }
}`;
const LINE_STYLE_IDX = { solid: 0, dash: 1, dot: 2, chevron: 3, comet: 4, taper: 5 };
function makeLaneFXMaterial(lenM) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: MARKFX_VERT,
    fragmentShader: LANEFX_FRAG,
    uniforms: {
      uLUT: { value: getLUT() },
      uTime: { value: 0 },
      uLen: { value: lenM },
      uW: { value: 1 },
      uHalo: { value: 0.9 },
      uGain: { value: 1 },
      uLStyle: { value: 1 }, uLSpeed: { value: 1 }, uLGap: { value: 1 }, uLHeat: { value: 0.5 }, uLTail: { value: 0.55 },
      uDay: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.clipping = true;
  return mat;
}

export function makeMarkFXMaterial(footTex = null) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: MARKFX_VERT,
    fragmentShader: MARKFX_FRAG,
    uniforms: {
      uLUT: { value: getLUT() },
      uShape: { value: footTex ? 1 : 0 },
      uSDF: { value: footTex || getLUT() },
      uPhase: { value: 0 }, uProg: { value: 0 }, uFade: { value: 1 },
      uStrong: { value: 0 }, uContract: { value: 0 },
      uTime: { value: 0 }, uSeed: { value: Math.random() * 6.2832 },
      uW: { value: 1 }, uHalo: { value: 0.9 }, uPool: { value: 0.55 }, uGain: { value: 1 },
      uSweepA: { value: 1 }, uWobble: { value: 0.5 }, uDay: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.clipping = true;
  return mat;
}

// ─────────────────────────────────────────────────────────────
// 디자인 토큰 공식 (공통)
//   출현 시점  = 이벤트 시점 − 선행 시간
//   토큰 크기  = 기본 크기 × sizeScale
//   투명도    = 순서별 감쇠 [1.0, 0.6, 0.35, 0.2]
//   소멸      = 이벤트 순간 → 버스트 → 0.35s 성공색 잔상
// ─────────────────────────────────────────────────────────────

// NEWTON 브랜드: 색 = 상태 전용 (좌/우 구분에 색 쓰지 않음 — 와이어프레임 v2 원칙)
export const COLORS = {
  left:  0xfa3030,   // NEWTON RED — Active
  right: 0xfa3030,
  target: 0xfa3030,  // 벽면 타겟 — 히트형도 RED
  guide: 0xfe6e3c,   // CORAL — 전환 화살표
  lane:  0xfa3030,
  success: 0xd1feff, // PRISM — 성공 잔상
};

const FADE_STEPS = [1.0, 0.6, 0.35, 0.2];
// 1인칭(러너 눈): 바닥 그래픽이 시선 각도에서 수직으로 눌려 감쇠가 증발 —
// 뒤 순번 감쇠를 완화한 전용 계단 + 전체 게인 보정 (setFp가 fpGain 스위치)
const FADE_STEPS_FP = [1.0, 0.78, 0.58, 0.42];
let FP_VIEW = false;
export function setFPView(on) { FP_VIEW = !!on; }

// 에디터 v2에서 실시간 조절되는 토큰 지오메트리·상태 파라미터 (라이브 반영)
export const TCFG = {
  markScale: 1.0,       // 마크 전체 크기 배율
  fillOpacity: 0.20,    // Active 채움 기본 투명도
  previewEdge: 0.5,     // 프리뷰(NEXT) 윤곽 강도
  cdContractFrom: 1.9,  // 수축 링 시작 배율 (1.9 → 1.0)
  cdGain: 0.6,          // 수축 링 강도
  lingerEdge: 0.9,      // 성공 잔상 윤곽 강도
  linger: 0.35,         // 성공 잔상 지속(s)
};
const LINGER = TCFG.linger;   // (초기 참조 — 루프에서는 TCFG.linger 직접 사용)

// 팩별 공간 매핑 (정규화 nx/ny → 월드 좌표)
export const LAYOUT = {
  running: {
    mode: 'advance',         // 실제 전진: 마크는 지면 고정, 러너가 접근해서 밟음
    V: 2.5,                  // 러너 전진 속도 (m/s — Fukuchi 2.5m/s 실측)
    STRIKE_AHEAD: 0.15,      // 착지 순간 발이 몸 중심보다 앞서는 거리
    X_SCALE: 2.0,
    LANE_W: 1.6,
    // 판정 계측 캘리브레이션 (실측 발 위치 − 마크 위치의 계통 오차 역보정)
    CAL: { right: { x: -0.187, z: 0.049 }, left: { x: 0.128, z: 0 } },
  },
  boxing: {
    mode: 'static',
    FLOOR_SCALE: 1.6,
    // Y0: 판정 계측 캘리브레이션 — 훅 임팩트 실측 높이 (주먹이 타겟보다 37cm 아래 도달)
    WALL: { XS: 2.2, Y0: 0.73, YS: 1.2 },
  },
  basketball: {
    mode: 'spatial',
    SCALE: 5.0,      // 실제 컷·스텝백은 2m+ 이동 — 봇이 눈에 띄게 움직이게 (봇 경로 동일)
  },
};
export const BK_SCALE = 5.0;   // xbot 경로와 공유 (봇·토큰 좌표 일치)

// ── 텍스처 유틸 ───────────────────────────────────────────────
function makeNumberTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  // 커스텀 글리프(FX Lab 슬롯 SVG) 우선 — 없으면 웜 크림 타이포 (동일 온도 언어)
  if (!drawGlyph(ctx, String(n), 64, 64, 96)) {
    ctx.fillStyle = 'rgba(255,240,220,0.95)';
    ctx.font = '300 86px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(254,150,90,0.75)';
    ctx.shadowBlur = 14;
    ctx.fillText(String(n), 64, 70);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/** 소형 표기 라벨 — 웜 크림 타이포, 캡션 위계 (수치 표기 전용: 큐보다 항상 어둡다) */
function makeSmallLabel(text) {
  const capPx = 56, pad = 20;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4;
  let ctx = c.getContext('2d');
  ctx.font = `400 ${capPx}px -apple-system, 'Apple SD Gothic Neo', sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width);
  c.width = w + pad * 2; c.height = capPx * 1.7;
  ctx = c.getContext('2d');
  ctx.font = `400 ${capPx}px -apple-system, 'Apple SD Gothic Neo', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(254,163,95,.7)'; ctx.shadowBlur = capPx * 0.25;
  ctx.fillStyle = '#FFF3DC';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, aspect: c.width / c.height };
}

function makeBullseyeTexture(colorHex) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = '#' + colorHex.toString(16).padStart(6, '0');
  ctx.strokeStyle = col;
  for (const [r, w, a] of [[112, 7, 0.95], [76, 5, 0.6], [40, 4, 0.45]]) {
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 0.9; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(128, 128, 12, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(c);
}

// 회피(avoid) = 점선 반전 링 — 도달과 같은 그림 금지(정반대 계약)
function makeDashedRingTexture(colorHex) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = '#' + colorHex.toString(16).padStart(6, '0');
  ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'butt';
  ctx.setLineDash([26, 20]);
  ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

// 유지(hold) = holdRing 채움 — 시계방향 채움(진행률). 정적 프리뷰는 표본 66%.
function makeHoldRingTexture(colorHex, frac = 0.66) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = '#' + colorHex.toString(16).padStart(6, '0');
  // 트랙(옅은 전체 링)
  ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 20;
  ctx.beginPath(); ctx.arc(128, 128, 96, 0, Math.PI * 2); ctx.stroke();
  // 채움 호 (12시부터 시계방향)
  ctx.globalAlpha = 0.95; ctx.lineCap = 'round';
  const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * Math.max(0, Math.min(1, frac));
  ctx.beginPath(); ctx.arc(128, 128, 96, a0, a1); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

function makeLaneTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(250,48,48,0.05)';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = 'rgba(250,48,48,0.55)';
  ctx.fillRect(2, 0, 3, 256);   // 좌측 경계
  ctx.fillRect(59, 0, 3, 256);  // 우측 경계
  ctx.fillRect(30, 20, 4, 60);  // 중앙 대시
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function flatMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    depthWrite: false, side: THREE.DoubleSide,
  });
}

// ── 마커 비주얼: 채움 원 + 테두리 + 카운트다운 링 + 숫자 ──────
class Marker {
  constructor(radius, color, surface /* 'floor'|'wall' */, footRight = false) {
    this._footRight = footRight;
    this.group = new THREE.Group();
    this.radius = radius;
    this.color = color;
    this.surface = surface;

    this.fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), flatMat(color, 0.22));
    this.edge = new THREE.Mesh(new THREE.RingGeometry(radius * 0.88, radius, 44), flatMat(color, 0.95));
    this.cd   = new THREE.Mesh(new THREE.RingGeometry(radius * 0.93, radius, 44), flatMat(0xffffff, 0.9));
    this.num  = null;

    // 파동 셰이더 존 (FX Lab 언어) — 발형 표현형(markShape=1)이면 FOOT 슬롯 SDF 위에서 같은 상태 머신
    let footTex = null;
    if (surface === 'floor' && FXP.markShape === 1) {
      try { footTex = footSDFTexture(this._footRight === true); } catch (e) { footTex = null; }
    }
    this._isFoot = !!footTex;
    this.fx = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.78, radius * 2.78), makeMarkFXMaterial(footTex));
    this.fx.position.z = 0.002;
    // 벽면은 열화상 고스트 위 가산이라 과노출 방지 게인
    this._baseGain = surface === 'wall' ? 0.6 : 1.0;
    this.fx.material.uniforms.uGain.value = this._baseGain;
    this.fill.visible = this.edge.visible = this.cd.visible = false;
    this.group.add(this.fx);

    this.group.add(this.fill, this.edge, this.cd);
    if (surface === 'floor') {
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.012;
    }
    this.group.renderOrder = 5;
  }
  /** 제작자 모드: 형태를 외부 아트로 교체 — 상태(cd 링)는 엔진 유지 */
  setArt(tex) {
    this.clearArt();
    this.art = new THREE.Mesh(new THREE.PlaneGeometry(this.radius * 2.2, this.radius * 2.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.art.position.z = 0.003;
    this.art.material.clippingPlanes = this.edge.material.clippingPlanes;
    this.group.add(this.art);
    this.fill.visible = false; this.edge.visible = false;
    this.fx.visible = false;   // 커스텀 아트가 존 비주얼을 대체
  }
  clearArt() {
    if (this.art) { this.group.remove(this.art); this.art.material.dispose(); this.art = null; }
    this.fx.visible = true;    // 기본 존 = 파동 셰이더 (구 벡터 링은 계속 숨김)
  }
  /** 에디터 v3: 3D 직접 선택 윤곽 (흰 링 — 피그마 선택 박스의 투사면 등가물) */
  setSelected(on) {
    if (on && !this.sel) {
      // 2톤(흰 코어 + 다크 림) — 주간·실물 배경에서도 보이는 선택 윤곽
      this.sel = new THREE.Group();
      const ring = (r0, r1, color, op, order) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
        m.renderOrder = order;
        return m;
      };
      this.sel.add(ring(this.radius * 1.44, this.radius * 1.58, 0x0c0e12, 0.85, 6));
      this.sel.add(ring(this.radius * 1.32, this.radius * 1.44, 0xffffff, 0.95, 7));
      this.sel.position.z = 0.005;
      this.group.add(this.sel);
    }
    if (this.sel) this.sel.visible = !!on;
  }
  setNumber(n) {
    const m = new THREE.MeshBasicMaterial({
      map: makeNumberTexture(n), transparent: true, depthWrite: false,
    });
    this.num = new THREE.Mesh(new THREE.PlaneGeometry(this.radius * 1.1, this.radius * 1.1), m);
    this.num.position.z = 0.004;
    // 바닥 눕힘(rx=-90°)만으로 글자 위쪽이 -Z(전방) = 유저가 읽는 방향 (rz 추가 회전 없음)
    this.group.add(this.num);
  }
  /** MARK 계약 변조: reach(실선) / avoid(점선 반전) / hold(holdRing 채움) */
  setContract(contract = 'reach', holdRing = false) {
    this.contract = contract;
    if (this.avoidArt) { this.group.remove(this.avoidArt); this.avoidArt.material.dispose(); this.avoidArt = null; }
    if (this.holdArt) { this.group.remove(this.holdArt); this.holdArt.material.dispose(); this.holdArt = null; }
    const sz = this.radius * 2.35;
    // 회피 = 파동 셰이더의 점선 반전 (별도 오버레이 불필요)
    this.fx.material.uniforms.uContract.value = contract === 'avoid' ? 1 : 0;
    if (contract === 'hold' || holdRing) {
      this.holdArt = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz),
        new THREE.MeshBasicMaterial({ map: makeHoldRingTexture(this.color, 0.66), transparent: true, depthWrite: false }));
      this.holdArt.position.z = 0.0035;
      this.group.add(this.holdArt);
    }
  }
  /** phase: hidden|locked|preview|countdown|linger  progress: 0..1 */
  render(phase, progress, orderIdx, sizeScale) {
    const g = this.group;
    if (phase === 'hidden') { g.visible = false; return; }
    g.visible = true;
    g.scale.setScalar(sizeScale * TCFG.markScale);
    if (this.art) this.art.material.opacity = phase === 'locked' ? 0.30 : phase === 'preview' ? (this.strongPreview ? 1 : 0.55) : 1;

    const steps = FP_VIEW ? FADE_STEPS_FP : FADE_STEPS;
    const fade = steps[Math.min(orderIdx, steps.length - 1)];

    // 파동 셰이더 구동 — FXP.mark 라이브 파라미터 (프로 편집 모드)
    if (this.fx.visible) {
      const U = this.fx.material.uniforms;
      U.uTime.value = performance.now() / 1000;
      U.uPhase.value = phase === 'preview' ? 0 : phase === 'countdown' ? 1 : phase === 'locked' ? 3 : phase === 'miss' ? 4 : 2;
      U.uProg.value = progress;
      U.uFade.value = fade;
      U.uStrong.value = this.strongPreview ? 1 : 0;
      U.uW.value = FXP.mark.core;
      U.uHalo.value = FXP.mark.halo;
      U.uPool.value = FXP.mark.pool;
      U.uSweepA.value = FXP.mark.sweep;
      U.uWobble.value = FXP.mark.wobble;
      U.uGain.value = this._baseGain * FXP.gainBoost * (FP_VIEW ? 1.35 : 1);   // 주간 부스트 · 1인칭 = 시선 각도 눌림 보정
      // 주간 = 풀컬러 잉크 모드: 가산 → 노멀 블렌딩 (색 보존 알파 합성, 셰이더 규약과 짝)
      const day = FXP.day ? 1 : 0;
      if (U.uDay.value !== day) {
        U.uDay.value = day;
        this.fx.material.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;
        this.fx.material.needsUpdate = true;
      }
    }
    if (phase === 'preview') {
      // 저작 프리뷰: 전 토큰을 또렷한 상시 강도로 (위계 감쇠 없음)
      const strong = this.strongPreview;
      this.fill.material.opacity = (strong ? 0.2 : 0.03) * fade;
      this.edge.material.opacity = (strong ? 0.95 : TCFG.previewEdge) * fade;
      this.edge.material.color.setHex(this.color);
      this.fill.material.color.setHex(this.color);
      this.cd.visible = false;
      if (this.num) this.num.material.opacity = (strong ? 1.0 : 0.5) * fade;
    } else if (phase === 'countdown') {
      this.fill.material.opacity = TCFG.fillOpacity + 0.15 * progress;
      this.edge.material.opacity = 1.0;
      this.edge.material.color.setHex(this.color);
      this.fill.material.color.setHex(this.color);
      this.cd.visible = true;
      const s = TCFG.cdContractFrom - (TCFG.cdContractFrom - 1) * progress; // 시작배율 → 1.0 수축
      this.cd.scale.setScalar(s);
      this.cd.material.opacity = 0.35 + TCFG.cdGain * progress;
      if (this.num) this.num.material.opacity = 1.0;
    } else if (phase === 'linger') {
      const k = 1 - progress;
      this.fill.material.color.setHex(COLORS.success);
      this.edge.material.color.setHex(COLORS.success);
      this.fill.material.opacity = 0.3 * k;
      this.edge.material.opacity = TCFG.lingerEdge * k;
      this.cd.visible = false;
      if (this.num) this.num.material.opacity = 0.4 * k;
    } else if (phase === 'locked') {
      // 시퀀스 예고 — 회색 고스트(셰이더) + 순번만. 레거시 링은 침묵.
      this.fill.material.opacity = 0;
      this.edge.material.opacity = 0;
      this.cd.visible = false;
      if (this.num) this.num.material.opacity = 0.48 * fade;
    } else if (phase === 'miss') {
      // 놓친 마크 — 셰이더 고스트만, 벌색·X 금지 (무음이 신호)
      this.fill.material.opacity = 0;
      this.edge.material.opacity = 0;
      this.cd.visible = false;
      if (this.num) this.num.material.opacity = 0.3 * (1 - progress);
    }
    // 계약 오버레이(점선/holdRing)는 링 강도를 따라감
    if (this.avoidArt) this.avoidArt.material.opacity = Math.min(1, this.edge.material.opacity + 0.1);
    if (this.holdArt) this.holdArt.material.opacity = Math.min(1, this.edge.material.opacity + 0.05);
    // 발형 숫자 앵커 — FX Lab 지정(컨텍스트별 1개, 왼발 기준 저장). 오른발 = x 미러. 없으면 중심 유지.
    if (this.num && this._isFoot && FXP.numFoot) {
      const NF = FXP.numFoot;
      const a = NF[FXP.footCtx === 'in' ? 'in' : 'out']
        || NF.L || (NF.R ? { x: 1 - NF.R.x, y: NF.R.y, s: NF.R.s } : null);   // 레거시 {L,R} 폴백
      if (a) {
        const S = this.radius * 2.78;   // fx 쿼드 = 랩 캔버스와 같은 정규 좌표계
        const ax = this._footRight ? 1 - a.x : a.x;
        this.num.position.set((ax - 0.5) * S, (0.5 - a.y) * S, 0.004);
        this.num.scale.setScalar(a.s || 1);
      }
    }
  }
}

// ── 방향 화살표 ───────────────────────────────────────────────
// tip = 화살표 끝(촉) 모양: triangle(▲) · chevron(》) · diamond(◆) · bar(▬) · none(선만)
const TIP_SLOT = { triangle: 'TIP_TRI' };   // 커스텀 촉은 삼각 머리 1종만 (유저 확정)
export function makeArrow(color, len = 0.55, tip = 'triangle') {
  const g = new THREE.Group();
  // 커스텀 촉 SVG (FX Lab TIP 슬롯) — 촉(머리)만 교체, 자루는 LINE 스타일을 계속 따름
  const slotImg = GLYPHS.img(TIP_SLOT[tip]);
  const customTip = !!slotImg;
  const w = 0.09, hw = 0.24, hl = 0.22;
  const mesh = (geo) => {
    const m = new THREE.Mesh(geo, flatMat(color, 0.85));
    m.material.blending = THREE.AdditiveBlending;   // 광류 언어 — 블룸이 살림
    g.add(m); return m;
  };
  const shape = (build) => { const s = new THREE.Shape(); build(s); return new THREE.ShapeGeometry(s); };

  // 자루(shaft) — 라인 스타일(FX Lab state.arrow) 소비: solid|dash|dot|taper
  const shaftLen = tip === 'none' ? len : Math.max(0.02, len - hl * 0.55);
  const A = FXP.arrow || { line: 'solid', w: 1 };
  const sw = w * (A.w || 1);
  if (A.line === 'dash') {
    const seg = 0.085, gap = 0.055;
    for (let y = 0; y + seg * 0.5 < shaftLen; y += seg + gap) {
      const d = mesh(new THREE.PlaneGeometry(sw, Math.min(seg, shaftLen - y)));
      d.position.y = y + Math.min(seg, shaftLen - y) / 2;
    }
  } else if (A.line === 'dot') {
    const gap = 0.11;
    for (let y = gap / 2; y < shaftLen; y += gap) {
      const d = mesh(new THREE.CircleGeometry(sw * 0.55, 16));
      d.position.y = y;
    }
  } else if (A.line === 'chevron') {
    // 꺾쇠 트레인 (정적 근사 — 애니는 레인 셰이더가 담당)
    const step = 0.13 * (A.gap || 1);
    for (let y = step * 0.5; y < shaftLen; y += step) {
      const ch = mesh(shape(sp => {
        sp.moveTo(-sw * 0.9, -0.035); sp.lineTo(0, 0.035); sp.lineTo(sw * 0.9, -0.035);
        sp.lineTo(sw * 0.9, -0.075); sp.lineTo(0, -0.005); sp.lineTo(-sw * 0.9, -0.075);
        sp.closePath();
      }));
      ch.position.y = y;
    }
  } else if (A.line === 'comet') {
    // 백열 머리 + 테이퍼 꼬리 (정적 근사)
    mesh(shape(sp => {
      sp.moveTo(-sw * 0.1, 0); sp.lineTo(sw * 0.1, 0);
      sp.lineTo(sw * 0.55, shaftLen * 0.92); sp.lineTo(-sw * 0.55, shaftLen * 0.92);
      sp.closePath();
    }));
    const head = mesh(new THREE.CircleGeometry(sw * 0.7, 20));
    head.position.y = shaftLen * 0.92;
  } else if (A.line === 'taper') {
    mesh(shape(sp => {
      sp.moveTo(-sw * 0.12, 0); sp.lineTo(sw * 0.12, 0);
      sp.lineTo(sw * 0.72, shaftLen); sp.lineTo(-sw * 0.72, shaftLen);
      sp.closePath();
    }));
  } else {
    const shaft = mesh(new THREE.PlaneGeometry(sw, shaftLen));
    shaft.position.y = shaftLen / 2;
  }

  const hy = len - hl;   // 촉 밑동 y
  if (customTip) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    drawGlyph(c.getContext('2d'), TIP_SLOT[tip], 64, 64, 112);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const tipM = new THREE.Mesh(new THREE.PlaneGeometry(hl * 2.1, hl * 2.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tipM.position.y = len - hl * 0.2;
    g.add(tipM);
  } else if (tip === 'triangle') {
    mesh(shape(s => { s.moveTo(-hw / 2, hy); s.lineTo(hw / 2, hy); s.lineTo(0, len); s.closePath(); }));
  } else if (tip === 'chevron') {
    // 열린 꺾쇠(^) — 얇은 두 막대로 확실히 구분되게
    const armLen = hl * 1.35, arm = (sx) => {
      const bar = mesh(new THREE.PlaneGeometry(0.06, armLen));
      bar.position.set(sx * hw * 0.26, len - hl * 0.5, 0);
      bar.rotation.z = sx * 0.62;
    };
    arm(1); arm(-1);
  } else if (tip === 'diamond') {
    const cy = len - hl * 0.5, r = hl * 0.62;
    mesh(shape(s => { s.moveTo(0, cy - r); s.lineTo(r, cy); s.lineTo(0, cy + r); s.lineTo(-r, cy); s.closePath(); }));
  } else if (tip === 'bar') {
    const bar = mesh(new THREE.PlaneGeometry(hw, 0.06));
    bar.position.y = len - 0.03;
  } // 'none' → 자루만

  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.014;
  g.renderOrder = 6;
  return g;
}

// ─────────────────────────────────────────────────────────────
export class TokenSystem {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.params = { lead: 0.45, size: 1.0, maxVisible: 3 };
    this.root = new THREE.Group();
    scene.add(this.root);
    this.floorRoot = new THREE.Group();  // 바닥 토큰 — 무릎 투사 흔들림 대상
    this.wallRoot = new THREE.Group();   // 벽면 토큰 — 후방 스테이션 (흔들림 없음)
    this.root.add(this.floorRoot, this.wallRoot);
    this.events = [];       // 이벤트 그룹 (t 기준)
    this.ambient = [];      // 상시 표시 토큰
    this.pack = null;
    this.layout = null;
    this.duration = 0;
    this.onEvent = null;       // (group) => void  — 이벤트 발화 콜백
    this.footprintTest = null; // (x,z)=>bool — 투사 풋프린트 내부 판정 (무릎 팩)
    this.gazeTest = null;      // (x,z)=>bool — 시선 낙하 영역 내부 판정
    this.stats = { inGaze: 0, total: 0 };  // 마크 첫 출현 시 시야 내 여부
    this.floorClip = null;     // 풋프린트 클리핑 플레인 (rig 공유 참조)
    this.wallClip = null;      // 벽면 클리핑 플레인
  }

  /** 재질에 투사면 클리핑 적용 — 가장자리도 투사면 밖은 GPU에서 잘림 */
  _applyClip(obj, planes) {
    if (!planes) return;
    obj.traverse(o => {
      if (o.material) o.material.clippingPlanes = planes;
    });
  }

  // 저작 프리뷰에서는 지면 풋프린트 클리핑을 끔 — 트랙 전체 배치가 보여야 함
  // (풋프린트는 러너와 함께 이동하는 작은 창이라 정적 프리뷰엔 부적합)
  _floorClipFor() { return this.layoutPreview ? null : this.floorClip; }

  /** 비교 오버레이 — 기준 팩의 stepMark를 회색 점선 고스트로 상시 표시.
      변형 팩(전문가/영상/커리)에서 "무엇이 달라졌는가"를 투사면 안에서 직접 보여준다.
      투사 원칙 준수: 지면 2D 광 패턴 + 풋프린트 클리핑 (공중 그래픽 아님). */
  setCompare(basePack) {
    if (this._compareRoot) {
      for (const g of this._compareRoot) g.removeFromParent();
      this._compareRoot = null;
    }
    if (!basePack || !this.pack || basePack.sport !== this.pack.sport) return;
    const floorG = new THREE.Group();   // 지면 고스트 — 무릎 흔들림 동승
    const wallG = new THREE.Group();    // 벽면 고스트 — 스테이션 고정
    const tex = makeDashedRingTexture(0x9aa3ad);   // 무음 그레이 — 판정색과 혼동 없음
    const mat = () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false });
    for (const tk of basePack.tokens) {
      if (tk.type === 'stepMark') {
        const p = this._mapFloor(tk);              // 같은 종목 = 같은 매핑
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.40), mat());
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x, 0.011, p.z);
        m.renderOrder = 3;
        this._applyClip(m, this._floorClipFor());
        floorG.add(m);
      } else if (tk.type === 'targetMark' && this.pack.hasWall) {
        const p = this._mapWall(tk);               // 벽면 고스트 (기본 팩 타겟 위치)
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mat());
        m.position.set(p.x, p.y, p.z - 0.005);
        m.renderOrder = 3;
        this._applyClip(m, this.wallClip);
        wallG.add(m);
      }
    }
    this.floorRoot.add(floorG);
    this.wallRoot.add(wallG);
    this._compareRoot = [floorG, wallG];
  }

  /** 에디터: 팔레트 변경을 기존 마커·화살표에 즉시 반영 */
  recolor() {
    for (const ev of this.events) {
      if (ev.marker) {
        const c = COLORS[ev.marker.role] ?? COLORS.left;
        ev.marker.color = c; ev.color = c;
        ev.marker.fill.material.color.setHex(c);
        if (ev.marker.bullseye) { ev.marker.bullseye.material.map = makeBullseyeTexture(c); ev.marker.bullseye.material.needsUpdate = true; }
      }
      if (ev.arrow) ev.arrow.obj.traverse(o => o.material?.color?.setHex(COLORS.guide));
    }
  }

  setParams(p) { Object.assign(this.params, p); }

  setPack(packData) {
    // 기존 비주얼 제거
    this.floorRoot.clear();
    this.wallRoot.clear();
    this._compareRoot = null;   // 비교 오버레이도 floorRoot.clear()로 제거
    this.laneFX = null;
    this.floorRoot.position.set(0, 0, 0);
    this.events = [];
    this.ambient = [];
    this.pack = packData;
    this.layout = LAYOUT[packData.sport];
    this.duration = packData.duration;

    const L = this.layout;
    const groups = new Map(); // t(ms) → { t, tokens[] }

    for (const tk of packData.tokens) {
      const isAmbient =
        tk.type === 'pathLane' ||
        (tk.lifetime >= packData.duration * 0.85);
      if (isAmbient) { this.ambient.push(tk); continue; }
      const key = Math.round(tk.t * 1000);
      if (!groups.has(key)) groups.set(key, { t: tk.t, tokens: [] });
      groups.get(key).tokens.push(tk);
    }

    // ── 이벤트 그룹 비주얼 생성 ──
    // 복싱: 바닥 투사 없음 — 벽면 타겟만 (숫자는 벽면 타겟 위에)
    const isBoxing = packData.sport === 'boxing';
    for (const g of [...groups.values()].sort((a, b) => a.t - b.t)) {
      const ev = { t: g.t, fired: false, marker: null, arrow: null, surface: 'floor', pos: new THREE.Vector3(), color: 0xffffff, foot: null };
      let pendingNum = null;

      for (const tk of g.tokens) {
        if (isBoxing) {
          if (tk.type === 'orderPulse') pendingNum = tk.n;
          if (tk.type !== 'targetMark') continue;
        }
        if (tk.type === 'stepMark' || tk.type === 'targetMark' || (tk.type === 'orderPulse' && !ev.marker)) {
          const isWall = tk.type === 'targetMark' && this.pack.hasWall;
          const color = tk.type === 'targetMark' ? COLORS.target : COLORS[tk.foot] ?? COLORS.left;
          // 반경 = 판정 허용창 (저작값 radiusCm 우선)
          const radius = tk.radiusCm ? tk.radiusCm / 100 : (tk.type === 'targetMark' ? 0.20 : 0.17);
          const mk = new Marker(radius, color, isWall ? 'wall' : 'floor', tk.foot === 'right');
          // MARK 계약 변조 (도달/회피/유지) — 벽 불즈아이는 도달 전용
          if (!isWall && (tk.contract && tk.contract !== 'reach' || tk.holdRing)) mk.setContract(tk.contract, tk.holdRing);
          // 토큰 비주얼 디자인(그라디언트·블러·SVG) → CanvasTexture 아트로 교체
          if (!isWall && tk.design) {
            const tex = new THREE.CanvasTexture(renderDesignCanvas(tk.design, 256));
            tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
            mk.setArt(tex);
            if (tk.design.shape === 'number') mk._skipNumber = true;
          }
          if (isWall) {
            // 벽면 불즈아이 텍스처 추가
            const bt = new THREE.Mesh(
              new THREE.PlaneGeometry(radius * 2.4, radius * 2.4),
              new THREE.MeshBasicMaterial({ map: makeBullseyeTexture(color), transparent: true, depthWrite: false })
            );
            bt.position.z = 0.003;
            mk.group.add(bt);
            mk.bullseye = bt;
          }
          mk.role = tk.type === 'targetMark' ? 'target' : (tk.foot ?? 'left');
          ev.marker = mk;
          ev.surface = isWall ? 'wall' : 'floor';
          ev.color = color;
          ev.foot = tk.foot ?? null;
          ev.srcToken = tk;
          (isWall ? this.wallRoot : this.floorRoot).add(mk.group);
          this._applyClip(mk.group, isWall ? this.wallClip : this._floorClipFor());
        }
        if (tk.type === 'orderPulse' && ev.marker && !ev.marker.num && !ev.marker._skipNumber) {
          ev.marker.setNumber(tk.n);
        }
        if (tk.type === 'directionGuide') {
          const arrow = makeArrow(COLORS.guide, packData.sport === 'basketball' ? 0.9 : 0.55, tk.tip || 'triangle');
          const p = this._mapFloor(tk);
          arrow.position.x = p.x; arrow.position.z = p.z;
          // angle: 0 = 전방(-Z). 시계 방향 회전.
          // angle 0 = 전방(-Z). 로컬 +Y가 rx=-90° 후 월드 -Z로 매핑됨.
          arrow.rotation.z = THREE.MathUtils.degToRad(-(tk.angle ?? 0));
          ev.arrow = { obj: arrow, t: tk.t, lifetime: tk.lifetime };
          this.floorRoot.add(arrow);
          this._applyClip(arrow, this._floorClipFor());
        }
      }
      if (isBoxing && ev.marker && pendingNum != null && !ev.marker.num) {
        ev.marker.setNumber(pendingNum);
        this._applyClip(ev.marker.group, this.wallClip);
      }
      if (ev.marker || ev.arrow) this.events.push(ev);
    }

    // ── 농구 컷인 문법: 실측 다음-마크 방향 화살표 + 진입 방향 감속 스트라이프 ──
    if (packData.sport === 'basketball') {
      const floorEvs = this.events
        .filter(e => e.surface === 'floor' && e.marker)
        .sort((a, b) => a.t - b.t);
      for (let i = 0; i < floorEvs.length; i++) {
        const cur = floorEvs[i], nxt = floorEvs[i + 1], prv = floorEvs[i - 1];
        const cp = this._mapFloor(cur.srcToken);
        // 화살표: 데이터상 다음 플랜트 마크의 실제 방향으로 (마크 위치 기준)
        if (cur.arrow && nxt) {
          const np = this._mapFloor(nxt.srcToken);
          const dx = np.x - cp.x, dz = np.z - cp.z;
          cur.arrow.obj.rotation.z = Math.atan2(-dx, -dz);
          cur.arrow.obj.position.x = cp.x;
          cur.arrow.obj.position.z = cp.z;
        }
        // 감속 스트라이프: 진입 방향에서 마크 앞 3줄 — "여기서 브레이크"
        if (prv) {
          const pp = this._mapFloor(prv.srcToken);
          let dx = cp.x - pp.x, dz = cp.z - pp.z;
          const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
          const g = new THREE.Group();
          const yaw = Math.atan2(-dx, -dz);
          for (let s = 0; s < 3; s++) {
            const bar = new THREE.Mesh(
              new THREE.PlaneGeometry(0.5, 0.07),
              flatMat(0xfe6e3c, 0.55 - s * 0.13)
            );
            bar.rotation.x = -Math.PI / 2;
            bar.rotation.z = yaw;
            bar.position.set(
              cp.x - dx * (0.4 + s * 0.24), 0.011,
              cp.z - dz * (0.4 + s * 0.24)
            );
            bar.renderOrder = 4;
            g.add(bar);
          }
          cur.stripes = g;
          this.floorRoot.add(g);
          this._applyClip(g, this._floorClipFor());
        }
      }
    }

    // ── 상시 토큰 비주얼 ──
    for (const tk of this.ambient) {
      if (tk.type === 'pathLane') this._buildLane(packData);
      if (tk.type === 'stepMark' && !isBoxing) {
        // 복싱 스탠스 발판 (상시)
        const mk = new Marker(0.16, COLORS[tk.foot] ?? COLORS.left, 'floor');
        mk.role = tk.foot ?? 'left';
        const p = this._mapFloor(tk);
        mk.group.position.x = p.x; mk.group.position.z = p.z;
        mk.render('preview', 0, 0, 1);
        mk.fill.material.opacity = 0.16;
        mk.edge.material.opacity = 0.7;
        mk.isStance = true;
        this.floorRoot.add(mk.group);
        this._applyClip(mk.group, this._floorClipFor());
        this.stanceMarks = this.stanceMarks || [];
        this.stanceMarks.push(mk);
      }
    }

    // ── 데이터 시그니처 추출 — 케이던스(스텝 간격 중앙값)·보폭. 레인 메트로놈·리듬 큐가 소비 ──
    {
      const ts = (packData.tokens || []).filter(t => t.type === 'stepMark' && t.t != null).map(t => t.t).sort((a, b) => a - b);
      const dts = [];
      for (let i = 1; i < ts.length; i++) { const d = ts[i] - ts[i - 1]; if (d > 0.05) dts.push(d); }
      dts.sort((a, b) => a - b);
      this._beatT = dts.length ? dts[Math.floor(dts.length / 2)] : 0;
      this._strideM = (L.mode === 'advance' && this._beatT) ? L.V * this._beatT : 0;
    }

    // ── 복싱: 콤보 순번 자동 부여 (타깃 3개가 항상 1·2·3으로 먼저 보인다) + 타깃 높이 표기 ──
    if (isBoxing && this.pack.hasWall) {
      const tgts = this.events.filter(e => e.surface === 'wall' && e.marker).sort((a, b) => a.t - b.t);
      tgts.forEach((e, i) => { if (!e.marker.num && !e.marker._skipNumber) e.marker.setNumber(i + 1); });
      if (tgts.length) {
        const ty = tgts.reduce((s, e) => s + this._mapWall(e.srcToken).y, 0) / tgts.length;
        const W = this.layout.WALL;
        // 높이 캘리브레이션 라인 — 데이터의 타격 높이가 그대로 벽의 눈금이 된다
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-W.XS * 0.72, ty, WALL_Z + 0.012),
            new THREE.Vector3(W.XS * 0.72, ty, WALL_Z + 0.012)]),
          new THREE.LineDashedMaterial({ color: 0xfec389, dashSize: 0.05, gapSize: 0.07, transparent: true, opacity: 0.30 }));
        line.computeLineDistances();
        this.wallRoot.add(line);
        this._applyClip(line, this.wallClip);
        const lbl = makeSmallLabel(`타깃 ${Math.round(ty * 100)}cm`);
        const lm = new THREE.Mesh(new THREE.PlaneGeometry(lbl.aspect * 0.075, 0.075),
          new THREE.MeshBasicMaterial({ map: lbl.tex, transparent: true, opacity: 0.55, depthWrite: false }));
        lm.position.set(W.XS * 0.72 - lbl.aspect * 0.075 / 2, ty + 0.065, WALL_Z + 0.012);
        this.wallRoot.add(lm);
        this._applyClip(lm, this.wallClip);
      }
    }
  }

  _mapFloor(tk) {
    const L = this.layout;
    if (L.mode === 'spatial') return { x: tk.nx * L.SCALE, z: tk.ny * L.SCALE };
    if (L.mode === 'static')  return { x: tk.nx * L.FLOOR_SCALE, z: -tk.ny * L.FLOOR_SCALE + (this.stanceOffsetZ || 0) };
    // advance: 이벤트 시각의 러너 위치 앞에 지면 고정 (+ 실측 캘리브레이션)
    const c = (L.CAL && L.CAL[tk.foot]) || { x: 0, z: 0 };
    return { x: tk.nx * L.X_SCALE + c.x, z: -L.V * tk.t - L.STRIKE_AHEAD + c.z };
  }

  _mapWall(tk) {
    const W = this.layout.WALL;
    return { x: tk.nx * W.XS, y: W.Y0 + tk.ny * W.YS, z: WALL_Z + 0.02 };
  }

  _buildLane(packData) {
    // 경로 토큰: 전체 형상을 그리되 GPU 클리핑으로 투사 풋프린트 안에서만 보임
    const L = this.layout;
    if (L.mode === 'advance') {
      // 러닝: 진행 방향 광류 레인 (셰이더 — 흐르는 대시 펄스 + 코어·헤일로)
      const len = L.V * packData.duration + 3 + 1.2;
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.55, len), makeLaneFXMaterial(len));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(0, 0.010, 1.2 - len / 2);   // z=1.2 → -len 구간, 로컬 +y = 전방(-z)
      lane.renderOrder = 3;
      this.floorRoot.add(lane);
      this._applyClip(lane, this._floorClipFor());
      this.laneFX = lane;
    } else if (L.mode === 'spatial') {
      // 농구: 컷인 경로 곡선 대시
      const pts = this.pack.tokens
        .filter(t => t.type === 'stepMark')
        .sort((a, b) => a.t - b.t)
        .map(t => new THREE.Vector3(t.nx * L.SCALE, 0.012, t.ny * L.SCALE));
      if (pts.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
          color: COLORS.lane, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.7,
        }));
        line.computeLineDistances();
        this.floorRoot.add(line);
        this._applyClip(line, this._floorClipFor());
      }
    }
    // boxing: 바닥 투사 없음
  }

  resetLoop() {
    for (const ev of this.events) { ev.fired = false; ev._wasVisible = false; ev._verdict = null; }
    this.stats = { inGaze: 0, total: 0 };
  }

  /** 무릎 투사 흔들림 오프셋 — 바닥 토큰 전체에 적용 */
  setShake(dx, dz) {
    this.floorRoot.position.x = dx;
    this.floorRoot.position.z = dz + (this.loopShiftZ || 0);   // 심리스 루프: 마크 필드 전체 이동
  }

  update(now, dt) {
    const { lead, size, maxVisible } = this.params;
    const L = this.layout;
    if (!L) return;
    if (this.laneFX) {
      const LU = this.laneFX.material.uniforms;
      const A = FXP.arrow || {};
      LU.uTime.value = performance.now() / 1000;
      LU.uW.value = FXP.graphics.width * (A.w || 1);
      LU.uHalo.value = FXP.graphics.halo * (A.glow ?? 1);
      LU.uGain.value = FXP.gainBoost * (FP_VIEW ? 1.25 : 1);
      LU.uLStyle.value = LINE_STYLE_IDX[(FXP.lane && FXP.lane.style) || 'dash'] ?? 1;   // 레인 전용 스타일
      LU.uLSpeed.value = A.speed ?? 1;
      LU.uLGap.value = A.gap ?? 1;
      // 러닝: 레인 = 데이터 메트로놈 — 대시 간격=실측 보폭, 통과 주기=스텝 간격(케이던스)
      // 대시가 러너와 같은 속도로 흐른다 (보폭/스텝 = 2.5m/s = 페이스 라이트)
      if (this.pack?.sport === 'running' && this._beatT > 0 && this._strideM > 0) {
        const si = LU.uLStyle.value;
        if (si === 1 || si === 2) {                       // dash·dot 행진만 (파형 계수: dash 9, dot 12)
          const wave = si === 1 ? 9.0 : 12.0;
          LU.uLGap.value = wave * this._strideM / (2 * Math.PI);
          LU.uLSpeed.value = (2 * Math.PI) / (5.2 * this._beatT);
        }
      }
      LU.uLHeat.value = A.heat ?? 0.5;
      LU.uLTail.value = A.tail ?? 0.55;
      const dayL = FXP.day ? 1 : 0;
      if (LU.uDay.value !== dayL) {
        LU.uDay.value = dayL;
        this.laneFX.material.blending = dayL ? THREE.NormalBlending : THREE.AdditiveBlending;
        this.laneFX.material.needsUpdate = true;
      }
    }

    // 다가오는 이벤트 순서 계산 (preview 투명도 감쇠용)
    const upcoming = this.events.filter(e => e.t >= now - TCFG.linger);
    const orderOf = new Map();
    upcoming.forEach((e, i) => orderOf.set(e, i));

    for (const ev of this.events) {
      const order = orderOf.get(ev) ?? 99;
      let phase = 'hidden', progress = 0;

      const missDur = TCFG.linger + 0.6;   // miss 고스트는 잔상보다 길게 식는다 (verdict는 t+0.32에 확정)
      if (ev._verdict === 'miss' && now >= ev.t && now < ev.t + missDur) {
        phase = 'miss';
        progress = (now - ev.t) / missDur;
        if (!ev.fired) { ev.fired = true; this._fire(ev); }
      } else if (now >= ev.t && now < ev.t + TCFG.linger) {
        phase = 'linger';
        progress = (now - ev.t) / TCFG.linger;
        if (!ev.fired) {
          ev.fired = true;
          this._fire(ev);
        }
      } else if (now >= ev.t - lead && now < ev.t) {
        phase = 'countdown';
        progress = (now - (ev.t - lead)) / lead;
      } else if (now < ev.t - lead) {
        // 시퀀스 상시 가시화: 가까운 maxVisible개 = Preview(데워짐), 그 뒤 = Locked(회색+순번)
        // — 경로 전체가 먼저 보이고, 지금 밟을 곳이 데워진다 (시안 보드 상태 순환)
        phase = order < maxVisible ? 'preview' : 'locked';
      }

      // 스튜디오 저작 프리뷰: 지면 토큰 전체를 시간·풋프린트 무관 상시 윤곽 표시
      // (저작한 공간 배치를 3D에서 즉시 확인 — 2D 캔버스와 파리티)
      if (this.layoutPreview && ev.surface !== 'wall') phase = 'preview';

      if (ev.marker) {
        // 위치 갱신
        if (ev.surface === 'wall') {
          const p = this._mapWall(ev.srcToken);
          ev.marker.group.position.set(p.x, p.y, p.z);
        } else {
          const p = this._mapFloor(ev.srcToken);
          ev.marker.group.position.set(p.x, 0.012, p.z);
          // 투사 풋프린트 여유 판정 — UI는 통째로 들어올 때만 등장 (잘림 금지)
          if (this.footprintTest && phase !== 'hidden' && !this.layoutPreview) {
            const wx = p.x + this.floorRoot.position.x;
            const wz = p.z + this.floorRoot.position.z;
            const inset = ev.marker.radius * size * 1.15;
            if (!this.footprintTest(wx, wz, inset)) phase = 'hidden';
            // 첫 출현 순간: 시선 낙하 영역 안에서 나타났는가? (배치 원칙 검증 지표)
            // locked 고스트는 제외 — 지표는 '데워진 큐'의 등장 위치만 잰다
            const visNow = phase === 'preview' || phase === 'countdown';
            if (visNow && !ev._wasVisible) {
              const inGaze = this.gazeTest ? this.gazeTest(wx, wz) : true;
              this.stats.total++;
              if (inGaze) this.stats.inGaze++;
            }
            ev._wasVisible = visNow;
          }
        }
        // 동시 표시 개수 제한: preview 단계에만 적용 (저작 프리뷰는 전체 표시)
        if (phase === 'preview' && order >= maxVisible && !this.layoutPreview) phase = 'hidden';
        // 저작 프리뷰: 순서 감쇠 없이 전 토큰 균일 강도(orderIdx 0)로 또렷하게
        const oIdx = this.layoutPreview ? 0 : Math.min(order, FADE_STEPS.length - 1);
        ev.marker.strongPreview = this.layoutPreview;
        ev.marker.render(phase, progress, oIdx, size);
        // 감속 스트라이프는 해당 플랜트 카운트다운 동안만
        if (ev.stripes) ev.stripes.visible = phase === 'countdown' || phase === 'linger';
      }

      if (ev.arrow) {
        const a = ev.arrow;
        // 저작 프리뷰: 화살표도 시간·풋프린트 무관 상시 표시 (마크와 파리티 — 방향/촉 편집이 바로 보이게)
        let vis = this.layoutPreview || (now >= a.t - lead && now < a.t + a.lifetime);
        if (vis && this.footprintTest && !this.layoutPreview) {
          vis = this.footprintTest(
            a.obj.position.x + this.floorRoot.position.x,
            a.obj.position.z + this.floorRoot.position.z
          );
        }
        a.obj.visible = vis;
        if (vis) {
          const k = this.layoutPreview ? 1 : Math.min(1, (now - (a.t - lead)) / Math.max(lead, 0.001));
          const op = 0.35 + 0.55 * k;
          const aBlend = FXP.day ? THREE.NormalBlending : THREE.AdditiveBlending;   // 주간 = 풀컬러 잉크
          a.obj.traverse(o => {
            if (!o.material) return;
            o.material.opacity = op;   // 자루+촉 여러 메시
            if (o.material.blending !== aBlend) { o.material.blending = aBlend; o.material.needsUpdate = true; }
          });
          a.obj.scale.setScalar(size);
        }
      }
    }
  }

  _fire(ev) {
    // 루프 시작 순간(t≈0) 이벤트는 랩 아티팩트 — 매 루프 화면이 번쩍이므로 버스트 억제
    // (마크 자체의 잔상·판정은 그대로, 폭발 이펙트만 생략)
    const wrapArtifact = ev.t < 0.15;
    const pos = ev.marker
      ? ev.marker.group.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3();
    const normal = ev.surface === 'wall' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const b = ev.srcToken?.design?.burst;   // 토큰별 터짐 조절 (없으면 기본 버스트)
    const opts = (b && b.on) ? { ...b } : {};
    if (ev.surface === 'wall') {
      // 벽 파문은 타겟 크기에 비례 — 전역 크기(지면 기준 1.5m)를 그대로 쓰면 벽 절반을 덮음
      opts.sizeM = (ev.marker?.radius ?? 0.15) * 3.4;
      opts.intensity = (opts.intensity ?? 1) * 0.8;
      opts.speed = (opts.speed ?? 1) * 1.35;   // 잽 리듬에 맞게 짧게
    }
    if (ev.surface !== 'wall' && this.layout?.mode === 'advance') {
      // 러닝(전진 레인): 무릎 패드가 착지점을 지나치므로 파문은 전방 반파로 방출
      opts.forward = true;
      pos.z -= 0.18;   // 반파 중심을 살짝 전방으로 — 빔 안에서 사는 시간 확보
    }
    if (!wrapArtifact) this.effects.burst(pos, ev.color, normal, opts);
    if (this.onEvent) this.onEvent(ev);
  }

  /** 스튜디오 터짐 미리보기 — 시간 정지 상태에서 해당 MARK 위치에 버스트 1회 (풋프린트 무관) */
  studioBurst(mark) {
    if (!this.layout || !mark) return;
    const p = this._mapFloor({ nx: mark.nx, ny: mark.ny ?? 0, t: mark.t, foot: mark.foot });
    const pos = new THREE.Vector3(p.x + this.floorRoot.position.x, 0.02, p.z + this.floorRoot.position.z);
    const b = mark.design?.burst;
    const color = mark.design?.fill?.c0 || '#fa3030';
    this.effects.burst(pos, color, new THREE.Vector3(0, 1, 0), { ...((b && b.on) ? b : {}), noClip: true });
  }
}
