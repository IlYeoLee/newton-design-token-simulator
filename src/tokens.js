import * as THREE from 'three';
import { NUM, PAL, NEU, rgba } from './palette.js';
import { WALL_Z } from './scene.js';
import { getLUT, FXP, FX_GLSL, GLYPHS, drawGlyph, lutColor, footSDFTexture, warnSDFTexture } from './fxlut.js';
import LOOK from './mark-look.json';   // ★ MARK 룩 정본 — footlab '코드에 저장'이 굽는 파일
import { MARK_NUM, MARK_GLSL, drawStemArrow, SIL_FIT, SIL_FIT_REF, QUAD_K, ZONE_GLYPH_K } from './fx-core.js';

// ── MARK 파동 셰이더 (FX Lab 이식) — 재료는 열 하나, 상태는 파동의 위상 ──
const MARKFX_VERT = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;   // 레인 풋프린트 소프트 페이드용 (LANEFX_FRAG 소비, MARKFX_FRAG는 미사용)
void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const MARKFX_FRAG = `
uniform float uHT, uHTPitch, uHTGain, uHTSoft, uHTWave, uHTGlow, uHTInner;
uniform sampler2D uNumTex; uniform float uNumOn, uNumScale; uniform vec2 uNumOff;   // 하프톤 스킨 — 후보랩 확정본
#include <common>
#include <clipping_planes_pars_fragment>
` + FX_GLSL + `
uniform float uW, uHalo, uNoise;
` + MARK_GLSL + `
uniform float uPhase, uProg, uFade, uStrong, uTime, uGain, uDay, uOut, uToe;
uniform vec3 uFPOrigin, uFPFwd, uFPRight;
uniform float uFPNear, uFPFar, uFPHalfN, uFPHalfF, uFPFadeM;
uniform vec3 uUIOrigin, uUIFwd, uUIRight;
uniform float uUIHalfL, uUIHalfW, uUIFeather, uUIAmt;
varying vec2 vUv;
varying vec3 vWorldPos;
// 투사면 경계 소프트 페이드(레인과 동일) — 클리핑 하드컷이 사각형으로 드러나기 전에 알파를 죽임.
float footprintFade(vec3 wp) {
  vec2 rel = wp.xz - uFPOrigin.xz;
  float d = rel.x * uFPFwd.x + rel.y * uFPFwd.z;
  float h = rel.x * uFPRight.x + rel.y * uFPRight.z;
  float half_ = mix(uFPHalfN, uFPHalfF, clamp((d - uFPNear) / max(0.01, uFPFar - uFPNear), 0.0, 1.0));
  float fadeLen = smoothstep(uFPNear, uFPNear + uFPFadeM, d) * smoothstep(uFPFar, uFPFar - uFPFadeM, d);
  float fadeW = smoothstep(half_, half_ - uFPFadeM, abs(h));
  return fadeLen * fadeW;
}
// 지면 UI 텍스트 마스크 — 제목·SPM·페이스가 앉은 구간에선 토큰 광을 깎는다.
//   토큰이 글자 위를 지나 가독성을 무너뜨리던 것(유저)의 해법. 흰 판을 덧대 뒤를 가리는 게
//   아니라 '그 자리엔 애초에 안 쏜다' — 빔은 빛을 더할 뿐이라 이쪽이 물리적으로도 맞다.
//   경계는 smoothstep 페더로 뭉갠다(= 블러 마스크). uUIAmt 0 이면 완전 무효.
float uiMaskFade(vec3 wp) {
  if (uUIAmt < 0.004) return 1.0;
  vec2 rel = wp.xz - uUIOrigin.xz;
  float d = rel.x * uUIFwd.x + rel.y * uUIFwd.z;      // 프레임 세로축
  float h = rel.x * uUIRight.x + rel.y * uUIRight.z;  // 프레임 가로축
  float f = max(uUIFeather, 0.001);
  float mL = 1.0 - smoothstep(uUIHalfL - f, uUIHalfL + f, abs(d));
  float mW = 1.0 - smoothstep(uUIHalfW - f, uUIHalfW + f, abs(h));
  return 1.0 - mL * mW * uUIAmt;
}
// 컴포저 OutputPass가 전 화면에 linear→sRGB 인코딩을 얹음(장면 PBR엔 옳지만 토큰 광은
// 카탈로그(raw)보다 미드톤이 ~30% 들떠 보임 — 패리티 하니스로 실측). 장면 파이프라인은
// 유지하고 토큰만 출력 직전 역변환으로 상쇄(uOut=1). raw 컨텍스트(패리티)는 uOut=0.
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  #include <clipping_planes_fragment>
  vec2 uv = (vUv - 0.5) * 2.0;
  // 라이브 판정 상태(uPhase) → 카탈로그 상태 번호 매핑 (fx-core MARK_GLSL 기준):
  //   0 Preview·1 Active·2 Success→3·3 Locked→6·4 Miss·5 Hold→2·6 Warning→5
  float st = uPhase < 0.5 ? 0.0 : uPhase < 1.5 ? 1.0 : uPhase < 2.5 ? 3.0
           : uPhase < 3.5 ? 6.0 : uPhase < 4.5 ? 4.0 : uPhase < 5.5 ? 2.0 : 5.0;
  // Preview의 진행: 카탈로그 데모시계(숨쉬기)가 바닥 — 구동자 없는 라이브 Preview가
  // prog=0에 얼어붙어 '얇은 정지 외곽선'(카탈로그에 없는 모습)으로 보이던 것의 근본 해결.
  // uStrong(다음 마크 강조)·uProg(판정 구동)는 max로 그 위에 얹힘.
  float breath = smoothstep(0.10, 0.88, fract(uTime * 0.45));
  float prog = uPhase < 0.5 ? max(breath, max(uStrong, uProg)) : clamp(uProg, 0.0, 1.0);
  vec4 r = markState(uv, st, prog, uStrong, uTime);
  // ── 하프톤 스킨 (uHT) — FX Lab 후보랩에서 확정한 '그라디언트 + 하프톤 마스크' ─────────
  //   정본 색(OKLab 램프)은 그대로 두고 균일한 점으로 뚫는다. 재현이 아니라 이식이다.
  //   ★ 알파를 r 에서 받지 않는다. r 의 알파는 경계에서 급히 끊겨, 그걸 곱하면 경계에 걸친
  //     점이 '잘려' 아웃라인이 생긴다. 색만 빌리고 알파는 넓은 페이드 × 점 마스크로 새로 만든다.
  if (uHT > 0.5) {
    float u1h  = mkUndul(atan(uv.y, uv.x) + uSeed, uTime * 1.6);
    float sdh  = mkSD(uv, u1h);
    float pit  = max(uHTPitch, 0.02);
    vec2  c2   = fract(uv / pit) - 0.5;
    float dd   = length(c2) * pit;
    float edge = smoothstep(0.20 * max(uHTSoft, 0.20), -0.04, sdh);
    // 파형 — 좁은 파면이 바깥으로 달리며 그 자리 점만 굵어진다(랩 '파형' 슬라이더).
    //   나머지 점은 제자리라 꿈틀거리지 않는다. uHTWave 0 이면 완전히 정지.
    float ext2 = uShape < 0.5 ? 0.46 * uRadius : 0.72;
    // 하프톤 파형도 실루엣 등거리선을 따른다 — 예전엔 length(uv) 라 **발 위에 원형 파장**이
    // 얹혀 형태와 따로 놀았다(유저 지적). sdh 는 윤곽에서 0 이므로 ext2 를 더하면 같은 대역이 된다.
    float rr2  = sdh + ext2;
    float fr   = fract(uTime * 0.40) * (ext2 * 2.30);
    float band = exp(-pow((rr2 - fr) / max(ext2 * 0.30, 1e-3), 2.0)) * (1.0 - fr * 0.20) * uHTWave;
    float rad  = pit * 0.5 * clamp((0.62 + 0.30 * band) * uHTGain * edge, 0.0, 1.0);
    // ── 글리프 구멍(임시) — 숫자 텍스처를 읽어 '그 점을 통째로' 뺀다 ────────────────
    //   ★ 격자는 셰이더가 깔았으니 셀 중심에서 읽어야 위상이 안 어긋난다.
    //     (마스크 쪽에서 뚫었다가 격자가 어긋나 역상이 나던 것의 교훈)
    //   숫자 평면은 쿼드의 MARK_NUM.RATIO/0.75 배 = 0.311 배를 차지한다(setNumber 규약).
    if (uNumOn > 0.5) {
      vec2 cc = (floor(uv / pit) + 0.5) * pit;                 // 이 점의 중심(uv)
      vec2 nq = (cc - uNumOff) / max(uNumScale, 1e-3) * 0.5 + 0.5;
      float inN = 0.0;
      if (nq.x > 0.0 && nq.x < 1.0 && nq.y > 0.0 && nq.y < 1.0)
        inN = texture2D(uNumTex, vec2(nq.x, 1.0 - nq.y)).a;
      rad *= 1.0 - smoothstep(0.25, 0.75, inN);                 // 글자 안이면 점이 사라진다
    }
    float m    = smoothstep(rad + pit * 0.11, rad - pit * 0.11, dd);
    // 닷 글로우 — 굵고 흐릿한 점을 아래에 깔아 더한다(랩 '닷 글로우'). 0 이면 완전히 꺼진다.
    if (uHTGlow > 0.001) {
      float rg = pit * 0.5 * clamp((0.62 + 0.30 * band) * uHTGain * 1.5 * edge, 0.0, 1.0);
      float hg = smoothstep(rg + pit * 0.36, rg - pit * 0.36, dd);
      m = clamp(m + hg * uHTGlow * 0.6, 0.0, 1.0);
    }
    float soft = smoothstep(0.13 * max(uHTSoft, 0.20), -0.05, sdh);
    float aOld = max(r.a, 1e-4);
    vec3  c0   = r.rgb / aOld;                 // 정본 색(언프리멀티)
    float aNew = clamp(soft * m, 0.0, 1.0);
    // 이너 음영 — 끝에서 최대, 안으로 급감(랩 '이너 음영'). +글로우 / −섀도우.
    if (abs(uHTInner) > 0.001) {
      float dep = clamp(-sdh / max(0.55 * uHTSoft, 1e-4), 0.0, 1.0);
      float ee  = pow(1.0 - dep, 2.4);
      aNew = clamp(aNew * (uHTInner > 0.0 ? mix(1.0, 1.0 + 0.80 * uHTInner, ee)
                                          : mix(1.0, 1.0 + 0.72 * uHTInner, ee)), 0.0, 1.0);
    }
    r = vec4(c0 * aNew, aNew);
  }
  // 쿼드 보더 페이드 — 원형 + 사각 경계(체비셰프) 이중: 어떤 경로에서도 평면 모서리가
  // 사각 박스로 드러나지 않게 (주간 잉크의 색 정규화가 원형 페이드를 상쇄하던 구멍 봉인)
  float border = smoothstep(1.0, 0.82, length(uv))
               * smoothstep(1.0, 0.84, max(abs(uv.x), abs(uv.y)))
               * footprintFade(vWorldPos)    // 투사면 밖으로 새는 글로우를 사각 하드컷 전에 페이드
               * uiMaskFade(vWorldPos);      // 지면 UI 텍스트 구간 = 토큰 광을 블러 마스크로 깎음
  vec3 col = r.rgb * uFade * uGain * border;
  // 앞꿈치 접지: 접지면(앞)만 남기고 뒤꿈치는 스러진다. 앞쪽은 조금 더 달궈 강조(유저).
  if (uToe > 0.001) {
    float toe = smoothstep(-0.80, 0.20, uv.y);
    col *= mix(1.0, toe * (1.0 + 0.55 * toe), uToe);
  }
  if (uDay > 0.5) {   // 주간 = 풀컬러 잉크 (색 보존 + 커버리지 알파)
    float mc = max(col.r, max(col.g, col.b));
    vec3 ink = col / max(mc, 1e-4);
    // ★ 커버리지(알파)가 **밝기에 묶여** 있다. 바닥 토큰의 밝기는 순번 페이드(uFade
    //   0.75/0.55/0.38) · uGain · 쿼드 보더 · 투사면 페이드를 다 지나 도착하는데, 벽엔 그
    //   감쇠 스택이 없다. 그래서 같은 잉크 모드인데도 벽은 쨍하고 바닥만 물빠진 것처럼 보였다
    //   (유저: "왜 벽면 채도는 쨍하고 바닥은 흐리멍텅해"). 색이 아니라 **덮는 양**의 문제다.
    //   배수를 올려 감쇠를 지나온 뒤에도 잔디를 제대로 덮게 한다. 색(ink)은 그대로다.
    gl_FragColor = vec4(uOut > 0.5 ? toLin(ink) : ink, clamp(mc * 2.30, 0.0, 1.0) * border);
  } else {
    gl_FragColor = vec4(uOut > 0.5 ? toLin(col) : col, 1.0);   // 야간: 가산 광
  }
}`;
// ── 레인 광류 셰이더 — LINE 최소 토큰 소비 (스타일·두께·속도·간격·온도·글로우·꼬리) ──
//    FX Lab의 LINE 스테이션과 같은 문법: solid=연속 광류 / dash·dot=행진 / chevron=꺾쇠 트레인 / comet=백열 순회 / taper
const LANEFX_FRAG = `
#include <common>
#include <clipping_planes_pars_fragment>
` + FX_GLSL + `
uniform float uTime, uLen, uW, uHalo, uGain, uDay;
uniform float uLStyle, uLSpeed, uLGap, uLHeat, uLTail, uOut;
// 풋프린트(투사면) 로컬 좌표계 — 무릎 원점 + 전방/우측 단위벡터(월드). 레인은 월드 고정
// 지오메트리라 매 프레임 러너가 지나가는 부분만 GPU 클리핑(floorClip)으로 하드컷됐는데,
// 가산 글로우가 꼬리 없이 뚝 잘려 사각형 프레임처럼 보였음(유저 스크린샷으로 확인).
// 클리핑 자체(투사 경계 밖 금지)는 원칙대로 유지하되, 그 경계에 닿기 전에 셰이더에서
// 먼저 알파를 죽여 하드컷이 안 보이게 한다.
uniform vec3 uFPOrigin, uFPFwd, uFPRight;
uniform float uFPNear, uFPFar, uFPHalfN, uFPHalfF, uFPFadeM;
varying vec2 vUv;
varying vec3 vWorldPos;
float footprintFade(vec3 wp) {
  vec2 rel = wp.xz - uFPOrigin.xz;
  float d = rel.x * uFPFwd.x + rel.y * uFPFwd.z;
  float h = rel.x * uFPRight.x + rel.y * uFPRight.z;
  float half_ = mix(uFPHalfN, uFPHalfF, clamp((d - uFPNear) / max(0.01, uFPFar - uFPNear), 0.0, 1.0));
  float fadeLen = smoothstep(uFPNear, uFPNear + uFPFadeM, d) * smoothstep(uFPFar, uFPFar - uFPFadeM, d);
  float fadeW = smoothstep(half_, half_ - uFPFadeM, abs(h));
  return fadeLen * fadeW;
}
void main() {
  #include <clipping_planes_fragment>
  float fpFade = footprintFade(vWorldPos);
  float lat = (vUv.x - 0.5) * 2.0;                     // 폭방향 -1..1
  float along = vUv.y * uLen;                          // 진행 좌표 (m)
  float heat;
  if (uLStyle > 0.5 && uLStyle < 1.5) {                // dash — 흐르는 캡슐 대시 (팩 레인 등 일반 dash)
    float baseW = 0.08 * uW;
    float base = exp(-pow(lat / baseW, 2.0)) + exp(-pow(lat / (baseW * 3.5), 2.0)) * 0.22 * uHalo;
    float ph = fract(along * (1.7 / uLGap) - uTime * 1.35 * uLSpeed);
    float cap = smoothstep(0.06, 0.24, ph) * smoothstep(0.60, 0.40, ph);
    float lead = smoothstep(0.34, 0.46, ph);
    float dashLat = exp(-pow(lat / (0.10 * uW), 2.0)) + exp(-pow(lat / (0.34 * uW), 2.0)) * 0.28 * uHalo;
    heat = base * 0.30 + cap * dashLat * (0.8 + 0.55 * lead);
  } else {
    lat += sin(along * 2.1 + uTime * 1.4) * 0.06;      // 미세 측면 웨이브
    float pulse = 1.0;
    float latEff = lat;
    float wEff = uW;
    if (uLStyle < 0.5) {                               // solid — 연속 광류 (은은한 명멸)
      pulse = 0.55 + 0.25 * sin(along * 0.8 - uTime * 2.0 * uLSpeed);
    } else if (uLStyle < 2.5) {                        // dot — 짧고 또렷한 점 행진
      pulse = smoothstep(0.75, 0.95, 0.5 + 0.5 * sin(along * (12.0 / uLGap) - uTime * 5.2 * uLSpeed));
      wEff *= 1.3;
    } else if (uLStyle < 3.5) {                        // chevron — 크리스프 화살촉 트레인 (프리미엄)
      float alongEff = along + abs(lat) * 0.42;         // 팔이 뒤로 = 촉이 전방(-z 진행 방향)
      float cf = fract(alongEff * (1.28 / uLGap) - uTime * 1.15 * uLSpeed);
      // 무른 가우시안 획 → 정의된 엣지: 크리스프 앞선(화이트-핫) + 채운 몸통 + 짧은 트레일.
      float edge = smoothstep(0.0, 0.022, cf) * smoothstep(0.12, 0.07, cf);   // 밝은 앞선
      float body = smoothstep(0.02, 0.06, cf) * smoothstep(0.44, 0.20, cf);   // 채운 몸통
      float armW = smoothstep(1.0, 0.80, abs(lat)) * smoothstep(0.995, 0.90, abs(lat)); // 크리스프 레인 엣지
      pulse = armW * (edge * 3.4 + body * 0.85);        // 앞선 고강도 → LUT 상단(화이트-핫)으로 크리스프
      latEff = 0.0;                                     // 형상은 edge/body가 담당 (코어 가우시안 무력화)
    } else if (uLStyle < 4.5) {                        // comet — 백열 머리 + 감쇠 꼬리 순회
      float head = fract(uTime * 0.22 * uLSpeed) * uLen;
      float d = head - along;
      if (d < 0.0) d += uLen;
      float f = exp(-d / max(0.4, uLen * uLTail * 0.6));
      pulse = f * 1.6 + 0.10;
      wEff *= (0.7 + f * 0.9);
    } else {                                           // taper — 전방으로 갈수록 넓게
      wEff *= (0.35 + vUv.y * 1.4);
      pulse = 0.5 + 0.2 * sin(along * 0.8 - uTime * 1.6 * uLSpeed);
    }
    float core = exp(-pow(latEff / (0.10 * wEff), 2.0)) + exp(-pow(latEff / (0.42 * wEff), 2.0)) * 0.30 * uHalo;
    heat = core * pulse * 0.5;
  }
  heat *= smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
  heat *= fpFade;   // 풋프린트 경계 소프트 페이드 — 뒤이은 GPU 하드클립 전에 이미 0 근처
  float sweep = 0.12 * sin(along * 0.9 - uTime * 1.7);
  vec3 col = lut(clamp(uLHeat - 0.08 + sweep + heat * 0.25, 0.0, 1.0)) * heat * uGain;
  vec3 outLin = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
  vec3 co = uOut > 0.5 ? outLin : col;   // OutputPass 인코딩 상쇄 (MARKFX와 동일 규약)
  if (uDay > 0.5) {   // 주간 = 풀컬러 잉크 (MARKFX와 동일 규약)
    float mc = max(co.r, max(co.g, co.b));
    gl_FragColor = vec4(co / max(mc, 1e-4), clamp(max(col.r, max(col.g, col.b)) * 1.45, 0.0, 1.0));
  } else {
    gl_FragColor = vec4(co, 1.0);
  }
}`;
const LINE_STYLE_IDX = { solid: 0, dash: 1, dot: 2, chevron: 3, comet: 4, taper: 5 };
// 지면 UI 텍스트 마스크 공용 상태 — main 이 매 프레임 채우고, 마크 유니폼 루프(session)가 읽어 간다.
//   amt 0 = 무효. 마스크가 필요 없는 화면(복싱 벽·시작화면 등)에선 0 이라 셰이더가 즉시 빠져나온다.
export const UI_MASK = { ox: 0, oz: 0, fx: 0, fz: -1, rx: 1, rz: 0, halfL: 0, halfW: 0, feather: 0.3, amt: 0 };

export function makeLaneFXMaterial(lenM) {
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
      uDay: { value: 0 }, uOut: { value: 1 },
      // 풋프린트 소프트 페이드 기본값 — rig 미연결(FX Lab 등) 시 항상 안 죽게 넉넉한 범위
      uFPOrigin: { value: new THREE.Vector3() }, uFPFwd: { value: new THREE.Vector3(0, 0, -1) }, uFPRight: { value: new THREE.Vector3(1, 0, 0) },
      uFPNear: { value: -1e6 }, uFPFar: { value: 1e6 }, uFPHalfN: { value: 1e6 }, uFPHalfF: { value: 1e6 }, uFPFadeM: { value: 0.15 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.clipping = true;
  mat._src = 'LANEFX';   // 진단용 출처 태그 (blackprobe 배지)
  return mat;
}

const SF = SIL_FIT / SIL_FIT_REF;   // uv 단위 거리 스케일 — 실루엣 채움비를 따라간다

/** ── MARK(발형·존원) 룩 정본 — 출처는 **footlab.html 하나뿐**이다 (유저 확정) ──────────
 *  예전엔 룩시스템 디자인 스토어(FXP.mark)가 매 프레임 uW·uHalo·uPool·uNoise 를 덮어써서,
 *  랩에서 잡은 디자인이 시뮬에서 헤일로 0.25(랩 0.9) 로 나왔다 — "랩에서 본 것보다 흐리다".
 *  이제 마크는 이 상수만 본다. 값을 바꾸려면 footlab 에서 잡고 여기로 옮긴다.
 *  (레인·이펙트·인물은 여전히 스토어를 쓴다 — 마크만 떼어낸 것이다.) */
// pool 은 필 알파를 직접 정한다: fillGain = clamp(pool * 1.6, 0, 1.35).
//   0.55 로 내렸다가 필이 0.88 로 35% 약해져 '개 흐리다'가 됐다(유저). 수정 전 0.9(=포화 1.35)로 복귀.
export const MARK_LOOK = { core: LOOK.w, halo: LOOK.halo, pool: LOOK.pool, sweep: 0.4, wobble: LOOK.noise };
export function makeMarkFXMaterial(footTex = null) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: MARKFX_VERT,
    fragmentShader: MARKFX_FRAG,
    uniforms: {
      uLUT: { value: getLUT() },
      // 지면 UI 텍스트 마스크 — main 이 매 프레임 UI_MASK 를 통해 넣는다. amt 0 = 무효(기본).
      uUIOrigin: { value: new THREE.Vector3() }, uUIFwd: { value: new THREE.Vector3(0, 0, -1) }, uUIRight: { value: new THREE.Vector3(1, 0, 0) },
      uUIHalfL: { value: 0 }, uUIHalfW: { value: 0 }, uUIFeather: { value: 0.3 }, uUIAmt: { value: 0 },
      uShape: { value: footTex ? 1 : 0 },
      // uRadius: 존 원은 실루엣 0.72(구 Rz)가 나오도록 0.72/0.46, 발형은 카탈로그 기준 1
      uRadius: { value: footTex ? 1.0 : 0.72 / 0.46 },
      uSDF2: { value: footTex || getLUT() },
      uSDFWarn: { value: warnSDFTexture() || getLUT() },
      // 깔창 각인 — 겉(신발) 안의 맨발 자국 도트 무늬. 발형에서만 의미가 있어 존 원은 0.
      //   uImpPitch: 도트 간격(uv 단위, 쿼드 폭 = 2). 프로토타입 실측비(피치/발폭 = 3.75%)를
      //   발 실루엣 폭 0.36×쿼드 에 대입 → 0.36*2*0.0375 ≈ 0.027.
      //   uImpDot: 반지름/피치. 프로토타입은 지름이 피치의 50% → 0.25.
      //   uImpCtr: 자국 무게중심(uv) — 축소 기준점. 텍스처 v 플립 규약과 같은 변환:
      //   x = 2·cx − 1, y = 1 − 2·cy (MARK_NUM.anchor 와 동일한 부호).
      //   uImpScale·uImpOff: footlab.html '자동 맞춤'이 계측한 값. 0.840 / (−0.060, −0.010) 에서
      //   좌·우발 모두 자국이 신발 밖으로 나간 면적 **0.00%** (그 위로는 엄지발가락이 삐져나온다 —
      //   신발 발가락 박스가 맨발 엄지보다 좁다). 눈으로 더듬지 말고 랩에서 다시 재서 옮길 것.
      // ★ uv 단위 거리값은 전부 SF 배 — 실루엣이 쿼드에서 작아진 만큼 같이 좁아져야 비율이 유지된다.
      //   (안 맞추면 도트가 굵어지고 핫스팟이 퍼져 다른 그림이 된다.)
      uImp: { value: footTex ? LOOK.imp : 0.0 }, uImpPitch: { value: LOOK.pitch * SF }, uImpDot: { value: LOOK.dot },
      // 경계는 이너 섀도우가 만든다(유저 확정) — 윤곽 글로우는 기본 0, 필요할 때만 켠다.
      uImpGlow: { value: LOOK.glow }, uImpShade: { value: LOOK.shade }, uImpSharp: { value: LOOK.sharp },
      uImpShadeCol: { value: LOOK.shadeCol },   // 0 흰 — 프로토타입 foot-*-dots.svg 의 white inner shadow 규약
      uImpEdge: { value: LOOK.edge * SF }, uImpScale: { value: LOOK.scale },
      uImpRot: { value: (footTex?._right ? -LOOK.irot : LOOK.irot) * Math.PI / 180 },   // 각인 기울기(rad) — 오른발은 미러라 부호가 뒤집힌다
      uImpCtr: { value: new THREE.Vector2(
        footTex ? (footTex._inCx ?? 0.5) * 2 - 1 : 0,
        footTex ? 1 - (footTex._inCy ?? 0.5) * 2 : 0) },
      // 미세 이동 — x 는 좌우 미러라 오른발에서 부호가 뒤집힌다(실루엣이 미러이므로 오프셋도 미러).
      // 축척(SIL_FIT)을 바꾸면 자동 맞춤도 다시 재야 한다 — 새 기준 실측: 축소 0.880 · 이동 (0,0).
      uImpOff: { value: new THREE.Vector2((footTex?._right ? -LOOK.offx : LOOK.offx) * SF, LOOK.offy * SF) },
      // 파동 — 실루엣 등거리선을 따라 바깥으로. 기본값은 '은은하게' 쪽으로 잡았다:
      //   reach 0.34(쿼드 반폭의 1/3만 나간다) · width 0.09(한 겹) · speed 0.45(느리게).
      //   예전 원형 파장이 과하게 크고 쨍하다는 지적의 실체는 '너무 멀리 · 너무 세게'였다.
      uRip: { value: LOOK.rip }, uRipSpeed: { value: LOOK.ripSpeed }, uRipWidth: { value: LOOK.ripWidth * SF }, uRipReach: { value: LOOK.ripReach * SF },
      // 족저 압력장·등고선 — 색을 정하는 입력을 '중심거리'에서 '압력'으로 바꾼다(유저 레퍼런스: 압력맵)
      // 압력 램프(데이터 계열) · 아웃라인 폐기 후 형태를 잡는 이너 섀도우 · 필 소프트 엣지
      uEdgeShade: { value: LOOK.edgeShade }, uEdgeW: { value: LOOK.edgeW * SF }, uEdgeSoft: { value: LOOK.edgeSoft },
      // 음영 적열 블룸 — 음영 자리에 뉴턴 RED 를 넓게 깐다(유저: 바닥에 가장 빨간 색이 부족하다).
      //   ?? 기본값은 옛 mark-look.json(키가 없는 저장본)에서도 NaN 이 안 나게 하는 안전판이다.
      uShadeRed: { value: LOOK.shadeRed ?? 0.34 }, uShadeRedW: { value: LOOK.shadeRedW ?? 3.4 },
      uDither: { value: LOOK.dither },   // LUT 8비트 밴딩 제거 — 조회 좌표를 1단계 미만 흔든다
      // uSilFit: SDF 베이크 채움비 / 기준치(0.78). 1 = 지금 그대로. 낮추면 실루엣이 쿼드에서
      //   작아져 파동·헤일로가 쓸 여유가 생긴다(호스트가 평면을 같은 배수로 키워 실제 크기 유지).
      uSilFit: { value: SIL_FIT / SIL_FIT_REF },
      uPlantar: { value: LOOK.plantar }, uBands: { value: LOOK.bands }, uBandSoft: { value: LOOK.bandSoft },
      uRipGrad: { value: LOOK.ripGrad },   // 1 = 뉴턴 LUT 그라디언트(기본) · 0 = 단색
      uRipCol: { value: LOOK.ripCol },   // 1 = 샌드(따뜻한 잔광). 0 흰 · 2 코랄 · 3 레드
      uPhase: { value: 0 }, uProg: { value: 0 }, uFade: { value: 1 },
      uToe: { value: 0 },   // 앞꿈치 접지 강조 — 앞은 진하게, 뒤꿈치는 투명하게(스텝백 2/4 왼발)
      uStrong: { value: 0 }, uContract: { value: 0 },
      uTime: { value: 0 }, uSeed: { value: Math.random() * 6.2832 },
      uW: { value: 1 }, uHalo: { value: 0.9 }, uPool: { value: 0.55 }, uGain: { value: 1 },
      // ★ uOut 1 — 마크의 유일한 출력 경로는 컴포저(OutputPass) 다. 실측(tmp_probe_cs.mjs):
      //     renderer.outputColorSpace='srgb' · working='srgb-linear' · RT=HalfFloat
      //     같은 값을 패스 없이(=랩) vs OutputPass 통과로 화면에 낸 결과
      //       (249,106,88)  → 랩 (249,106,88)  · 시뮬 (252,173,159)
      //       (248,183,135) → 랩 (248,183,135) · 시뮬 (252,220,192)
      //       (128,128,128) → 랩 128           · 시뮬 188
      //   즉 uOut=0 이면 마크만 화면에서 한 번 더 sRGB 인코딩돼 들뜨고 채도가 깎인다
      //   — 유저가 반복해 지적한 '랩보다 뿌옇고 채도 낮다'의 정체. toLin 역변환이 이를 상쇄해
      //   화면값이 랩과 같아진다. (LANEFX 는 처음부터 uOut=1 — 마크만 예외였다.)
      //   ※ 이전 주석의 '(241,37,25)' 는 OutputPass 이전 버퍼값을 잰 것 — toLin(249,106,88) 그 자체다.
      uSweepA: { value: 1 }, uNoise: { value: 0.5 }, uDay: { value: 0 }, uOut: { value: 1 },
      // 하프톤 스킨 — 기본 꺼짐. 랩에서 확정한 값이 기본값이다.
      uHT: { value: 0 }, uHTPitch: { value: 0.055 }, uHTGain: { value: 1.15 }, uHTSoft: { value: 0.55 }, uHTWave: { value: 0.6 }, uHTGlow: { value: 0 }, uHTInner: { value: 0 },
      uNumTex: { value: null }, uNumOn: { value: 0 }, uNumScale: { value: 0.311 }, uNumOff: { value: new THREE.Vector2() },
      // 투사면(풋프린트) 소프트 페이드 — 레인과 동일. 기본 1e6 = 무효(벽 마크·미주입 시 페이드 없음).
      uFPOrigin: { value: new THREE.Vector3() }, uFPFwd: { value: new THREE.Vector3(0, 0, -1) }, uFPRight: { value: new THREE.Vector3(1, 0, 0) },
      uFPNear: { value: -1e6 }, uFPFar: { value: 1e6 }, uFPHalfN: { value: 1e6 }, uFPHalfF: { value: 1e6 }, uFPFadeM: { value: 0.28 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.clipping = true;
  mat._src = footTex ? 'MARKFX(발형)' : 'MARKFX(존원)';   // 진단용 출처 태그
  // 블룸 제외 표식 — 랩 캔버스엔 후처리가 없다. 마크 안 흰 코어가 블룸 문턱을 넘어
  //   번지면서 채도를 떨어뜨렸다(유저: "랩에서 본 것과 1000% 동일하게"). scene.js 가 이 플래그로
  //   블룸 입력에서만 마크를 뺀다 — 최종 합성엔 그대로 들어가므로 몸 가림·깊이는 유지된다.
  mat._noBloom = true;
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
  left:  NUM.red,     // NEWTON RED — Active
  right: NUM.red,
  target: NUM.red,    // 벽면 타겟 — 히트형도 RED
  guide: NUM.coral,   // CORAL — 전환 화살표
  lane:  NUM.red,
  success: NUM.prism, // PRISM — 성공 잔상
  user: NUM.prism,    // PRISM — 유저 액션·내 것 (TAP·내 자세 미러·CTA)
};

const FADE_STEPS = [1.0, 0.75, 0.55, 0.38];   // 뒤 순번 파스텔 워시 완화 — 랩 대비 '뿌연 컬러' 주범 1
// 1인칭(러너 눈): 바닥 그래픽이 시선 각도에서 수직으로 눌려 감쇠가 증발 —
// 뒤 순번 감쇠를 완화한 전용 계단 + 전체 게인 보정 (setFp가 fpGain 스위치)
const FADE_STEPS_FP = [1.0, 0.78, 0.58, 0.42];
let FP_VIEW = false;
export function setFPView(on) { FP_VIEW = !!on; }

// ── 발형 실치수 (단일 출처) ────────────────────────────────────────────
// 지면 UI의 발자국은 '여기를 밟아라'는 지시고, 사용자가 그 위에 실제로 발을 올린다.
// 그래서 1:1 실치수로 간다 — 주차선·바닥 스티커가 실치수인 것과 같은 이유다.
// 값은 260mm: 기본 표현형이 신발 실루엣(FOOT_OUT)이고, 신발 겉창은 발 길이(240)보다
// 15~25mm 길다. 맨발(FOOT_IN)까지 한 값을 쓰므로 실내는 약간 큰 셈이다(유저 확정).
//   이전: session.js S=0.46(시각 0.36m) × 씬별 매직넘버(1.05/0.62/0.58/0.42)
//         → 실제 발자국이 0.15m~0.38m 로 2.5배 편차. 07-28 유저 메모의 '배율 상수
//         하나로 통일' 숙제가 이것이다. 크기 변경은 이제 이 한 줄이다.
// ── 실루엣이 쿼드에서 차지하는 비율 ─────────────────────────────────────────
//   SDF 를 구울 때 실루엣을 텍스처의 몇 %에 맞추느냐. 기준치는 0.78(옛 고정값)이다.
//   이걸 낮추면 실루엣이 쿼드 안에서 작아지고 **남는 자리가 파동·헤일로의 여유**가 된다.
//   유저 신고: 파동이 위아래로 잘려 좌우만 보인다 — 발이 세로로 길어 쿼드 여유가 0.10 뿐이었다.
//   실제 크기는 그대로다: 평면을 SIL_FIT_REF/SIL_FIT 배로 키워 상쇄한다.
export { SIL_FIT, SIL_FIT_REF, QUAD_K, ZONE_GLYPH_K } from './fx-core.js';

export const FOOT_LEN_M = 0.26;
/** 실루엣이 평면에서 차지하는 세로 비율 — 정본 SVG 4종 실측(신발 0.7266 · 맨발 0.7285) */
const FOOT_FILL = 0.727;
/** 발형 토큰 평면 한 변(m). 발 길이가 0.24m 로 나오도록 역산 ≈ 0.330 */
export const FOOT_PLANE_M = FOOT_LEN_M / FOOT_FILL;

// ── 판정 존 반경 3단계 (발 기준 배수) ──────────────────────────────────
// 원은 '얼마나 정확히 밟아야 하는가'다. 발과 무관한 숫자를 손으로 박으면 화면에서
// 아무 의미도 안 전해진다(실제로 저작 데이터의 radiusCm 은 18곳 전부 17 이었고,
// 코드 폴백만 0.16/0.17/0.20 세 개로 흩어져 있었다 — 1cm 차이는 구분도 안 된다).
// 발 길이의 배수로 묶으면 발자국과 원이 한 화면에 있을 때 관계가 읽힌다.
export const ZONE = {
  tight: FOOT_LEN_M * 0.50,   // 0.12m 반경 = 지름이 발 하나 — 정확히 밟아야 하는 곳
  base:  FOOT_LEN_M * 0.75,   // 0.18m
  loose: FOOT_LEN_M * 1.00,   // 0.24m — 존에 들어오기만 하면 되는 곳
};

// 에디터 v2에서 실시간 조절되는 토큰 지오메트리·상태 파라미터 (라이브 반영)
export const TCFG = {
  markScale: 1.0,       // 마크 전체 크기 배율
  fillOpacity: 0.20,    // Active 채움 기본 투명도
  previewEdge: 0.5,     // 프리뷰(NEXT) 윤곽 강도
  cdContractFrom: 1.9,  // 수축 링 시작 배율 (1.9 → 1.0)
  cdGain: 0.6,          // 수축 링 강도
  lingerEdge: 0.9,      // 성공→다음 마크 전환 모션의 윤곽 강도
  linger: 0.35,         // 전환 모션 지속(s) — Success 상태 자체의 수명이 아니다(유저 정의)
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
// 러닝 라이브: 순번 대신 발 L/R 글리프(어느 발로 밟는지 — 순번은 러닝 교수법에 없음, 유저 확인).
// 글리프 = 유저 제공 SVG(pace_foot.svg), 이전 글리프 스타일(웜 크림 틴트+글로우), 우측=미러.
const _footNumTex = {};
const _pfImg = new Image();
_pfImg.src = import.meta.env.BASE_URL + 'ready-view/assets/pace_foot.svg';
function makeFootGlyphTexture(right) {
  const k = right ? 'R' : 'L';
  if (_footNumTex[k]) return _footNumTex[k];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const ready = _pfImg.complete && _pfImg.naturalWidth;
  if (ready) {
    // 틴트: SVG → source-in 웜 크림 (이전 글리프와 동일 온도 언어)
    const off = document.createElement('canvas'); off.width = off.height = 128;
    const og = off.getContext('2d');
    const ar = _pfImg.naturalWidth / _pfImg.naturalHeight;
    const w = 100, h = w / ar;
    og.save(); if (right) { og.translate(128, 0); og.scale(-1, 1); }
    og.drawImage(_pfImg, (128 - w) / 2, (128 - h) / 2, w, h);
    og.restore();
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = rgba(NEU.ink, 0.95); og.fillRect(0, 0, 128, 128);
    ctx.shadowColor = rgba(PAL.coral, 0.75); ctx.shadowBlur = 12;
    ctx.drawImage(off, 0, 0); ctx.shadowBlur = 0; ctx.drawImage(off, 0, 0);
  } else {
    ctx.strokeStyle = rgba(NEU.ink, 0.95); ctx.lineWidth = 5;
    ctx.shadowColor = rgba(PAL.coral, 0.75); ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(64, 64, 20, 34, right ? 0.12 : -0.12, 0, Math.PI * 2); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  if (ready) _footNumTex[k] = tex;   // 로드 전 폴백은 캐시 안 함(로드 후 정본으로 재생성)
  return tex;
}
function makeNumberTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  // 커스텀 글리프(FX Lab 슬롯 SVG) 우선 — 없으면 웜 크림 타이포 (동일 온도 언어)
  if (!drawGlyph(ctx, String(n), 64, 64, 96)) {
    ctx.fillStyle = rgba(NEU.ink, 0.95);
    ctx.font = '300 86px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = rgba(PAL.coral, 0.75);
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
  ctx.shadowColor = rgba(PAL.coral, 0.7); ctx.shadowBlur = capPx * 0.25;
  ctx.fillStyle = NEU.ink;
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, aspect: c.width / c.height };
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
export class Marker {
  constructor(radius, color, surface /* 'floor'|'wall' */, footRight = false) {
    this._footRight = footRight;
    this.group = new THREE.Group();
    this.radius = radius;
    this.color = color;
    this.surface = surface;

    this.num  = null;
    // 룩 이전 벡터 링(fill/edge/cd)은 완전 은퇴 — 상태 비주얼은 fx 셰이더가 전담.

    // 파동 셰이더 존 (FX Lab 언어) — 발형 표현형(markShape=1)이면 FOOT 슬롯 SDF 위에서 같은 상태 머신
    let footTex = null;
    if (surface === 'floor' && FXP.markShape === 1) {
      try { footTex = footSDFTexture(this._footRight === true); } catch (e) { footTex = null; }
    }
    this._isFoot = !!footTex;
    // 발형이면 판정 반경과 무관하게 실치수(240mm)로 고정한다. 예전엔 radius×2.78 이라
    // 판정이 널널한 구간에서 발이 같이 커졌다 — 발은 발 크기고, 허용 반경은 원이 말한다.
    // 평면은 QUAD_K 배로 키운다 — 실루엣 채움비를 낮춘 만큼 상쇄해 **월드 크기는 그대로**,
    //   늘어난 여백이 파동·헤일로가 잘리지 않고 퍼질 자리가 된다.
    const planeSide = (this._isFoot ? FOOT_PLANE_M : radius * 2.78) * QUAD_K;
    this.fx = new THREE.Mesh(new THREE.PlaneGeometry(planeSide, planeSide), makeMarkFXMaterial(footTex));
    this.fx.position.z = 0.002;
    // 벽면은 열화상 고스트 위 가산이라 과노출 방지 게인
    this._baseGain = surface === 'wall' ? 0.6 : 1.0;
    this.fx.material.uniforms.uGain.value = this._baseGain;
    this.group.add(this.fx);
    if (surface === 'floor') {
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.012;
    }
    this.group.renderOrder = 5;
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
    this._numN = n;   // 발 글리프 ↔ 숫자 왕복 스왑용 원본 보존
    const m = new THREE.MeshBasicMaterial({
      map: makeNumberTexture(n), transparent: true, depthWrite: false,
    });
    // 크기 = FX Lab 규약: 글리프 = 쿼드(radius*2.78)의 MARK_NUM.RATIO배, 텍스처 채움률 0.75 보정
    // 존 원은 실루엣이 글자를 안 받쳐 줘서 같은 비율이면 발형보다 작아 보인다 — ZONE_GLYPH_K 로 보정.
    const numS = this.radius * 2.78 * MARK_NUM.RATIO / 0.75 * (this._isFoot ? 1 : ZONE_GLYPH_K);
    this.num = new THREE.Mesh(new THREE.PlaneGeometry(numS, numS), m);
    this.num.position.z = 0.004;
    // 하프톤 스킨이 켜지면 이 텍스처로 점을 빼 '구멍'을 만든다(오버레이 대신).
    const fu = this.fx?.material?.uniforms;
    if (fu?.uNumTex) { fu.uNumTex.value = m.map; fu.uNumScale.value = numS / (this.radius * 2.78); }
    // 바닥 눕힘(rx=-90°)만으로 글자 위쪽이 -Z(전방) = 유저가 읽는 방향 (rz 추가 회전 없음)
    this.group.add(this.num);
  }
  /** MARK 계약 변조: reach(실선) / avoid(점선 반전 — 셰이더 uContract).
      구 holdArt 캔버스 링은 은퇴(카탈로그에 없는 종·현행 팩 데이터 미사용) —
      유지 계약이 다시 필요해지면 fx Hold 상태(코닉 림)로 구동할 것. */
  setContract(contract = 'reach') {
    this.contract = contract;
    this.fx.material.uniforms.uContract.value = contract === 'avoid' ? 1 : 0;
  }
  /** phase: hidden|locked|preview|countdown|linger  progress: 0..1 */
  render(phase, progress, orderIdx, sizeScale) {
    const g = this.group;
    if (phase === 'hidden') { g.visible = false; this._lastPhase = 'hidden'; return; }
    g.visible = true;
    // ── 모션 고도화(유저: 기본 등장·타격 모션 밋밋) ──
    //   등장 = 스케일 오버슈트 팝(0.55→1.08→1, 0.38s) · 히트(linger 진입) = 반동 팝(1.30→1, 0.3s)
    const nowP = performance.now() / 1000;
    if (phase !== this._lastPhase) {
      if ((this._lastPhase === 'hidden' || this._lastPhase == null) && (phase === 'preview' || phase === 'countdown')) this._spawnT = nowP;
      if (phase === 'linger') this._hitT = nowP;
      this._lastPhase = phase;
    }
    let popS = 1;
    if (this._spawnT != null) {
      const e = (nowP - this._spawnT) / 0.38;
      if (e < 1) { const k = 1 - Math.pow(1 - e, 3); popS *= 0.55 + 0.45 * k + 0.10 * Math.sin(Math.min(1, e) * Math.PI); }
    }
    if (this._hitT != null) {
      const e = (nowP - this._hitT) / 0.3;
      if (e < 1) popS *= 1 + 0.30 * (1 - e) * (1 - e);
    }
    g.scale.setScalar(sizeScale * TCFG.markScale * popS);
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
      // ★ MARK 룩의 출처는 mark-look.json(footlab) 하나다 — 룩시스템 스토어(FXP.mark)를 안 본다.
      //   session.tickWaves 만 끊고 **여기를 빠뜨려서** 팩 마커는 계속 스토어 값으로 덮였다.
      //   같은 실수를 또 하지 않으려면: FXP.mark 를 마크 재질에 넣는 곳이 더 있는지 먼저 grep 할 것.
      U.uW.value = MARK_LOOK.core;
      U.uHalo.value = MARK_LOOK.halo;
      U.uPool.value = MARK_LOOK.pool;
      U.uSweepA.value = MARK_LOOK.sweep;
      U.uNoise.value = MARK_LOOK.wobble;
      if (U.uUIAmt) {   // 지면 UI 텍스트 구간 = 토큰 광을 블러 마스크로 깎는다(벽 마크는 제외)
        U.uUIOrigin.value.set(UI_MASK.ox, 0, UI_MASK.oz);
        U.uUIFwd.value.set(UI_MASK.fx, 0, UI_MASK.fz);
        U.uUIRight.value.set(UI_MASK.rx, 0, UI_MASK.rz);
        U.uUIHalfL.value = UI_MASK.halfL; U.uUIHalfW.value = UI_MASK.halfW;
        U.uUIFeather.value = UI_MASK.feather;
        U.uUIAmt.value = this.surface === 'wall' ? 0 : UI_MASK.amt;
      }
      // 밟는 순간(linger=Success 블룸) 게인 킥 — 룩시스템 글로우가 확 터지게(유저: 팡 부족)
      const hitKick = phase === 'linger' ? 1 + 0.9 * Math.max(0, 1 - progress * 2.2) : 1;
      U.uGain.value = this._baseGain * FXP.gainBoost * (FP_VIEW ? 1.35 : 1) * hitKick;   // 주간 부스트 · 1인칭 = 시선 각도 눌림 보정
      // 주간 = 풀컬러 잉크 모드: 가산 → 노멀 블렌딩 (색 보존 알파 합성, 셰이더 규약과 짝)
      const day = (FXP.day || FXP.markBlend === 'ink') ? 1 : 0;
      if (U.uDay.value !== day) {
        U.uDay.value = day;
        this.fx.material.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;
        this.fx.material.needsUpdate = true;
      }
    }
    // 숫자 = 마크 안 글리프, 표시 강도만 상태 연동 (MARK_NUM 규약) — 형태는 전부 fx 셰이더
    // 러닝 라이브(P/C) = 순번 숨김(FXP.hideOrderNums): 케이던스는 연속 리듬 — 1·2·3 순번은 콤보/스텝
    // 드릴(복싱·농구) 문법이지 러닝 교수법 아님(유저 확인). 박자 펄스·과녁만.
    if (this.num) {
      // hideOrderNums: 발 글리프로 스왑됐으면 정상 표시, 스왑 전(발 정보 없는 마커)만 숨김
      this.num.material.opacity = (FXP.hideOrderNums && !this._numFoot) ? 0 :
        phase === 'preview' ? (this.strongPreview ? 1.0 : 0.5) * fade
        : phase === 'countdown' ? 1.0
        : phase === 'linger' ? 0.4 * (1 - progress)
        : phase === 'locked' ? 0.48 * fade
        : phase === 'miss' ? 0.3 * (1 - progress) : 1.0;
    }
    // 발형 숫자 앵커 — FX Lab 지정(컨텍스트별 1개, 왼발 기준 저장). 오른발 = x 미러. 없으면 중심 유지.
    // 하프톤 스킨이면 숫자는 '구멍'으로 표현되므로 오버레이 평면은 숨긴다.
    if (this.num && this.fx?.material?.uniforms?.uHT) {
      const fu = this.fx.material.uniforms;
      const htOn = fu.uHT.value > 0.5;
      fu.uNumOn.value = (htOn && this.num.material.opacity > 0.01) ? 1 : 0;
      fu.uNumOff.value.set(this.num.position.x / (this.radius * 1.39),
                           this.num.position.y / (this.radius * 1.39));
      if (htOn) this.num.visible = false;
      else if (!this.num.visible) this.num.visible = true;
    }
    if (this.num && this._isFoot && FXP.numFoot) {
      const NF = FXP.numFoot;
      const a = NF[FXP.footCtx === 'in' ? 'in' : 'out']
        || NF.L || (NF.R ? { x: 1 - NF.R.x, y: NF.R.y, s: NF.R.s } : null);   // 레거시 {L,R} 폴백
      if (a) {
        // 앵커 기준은 '발 평면'이다. radius*2.78 을 쓰면 발형 평면을 FOOT_PLANE_M 고정으로
        //   떼어낸 뒤로는 어긋난다 — 판정 반경이 큰 구간에서 숫자가 발 밖으로 나간다.
        //   (session.js attachMarkNum/placeMarkNum 에 남아 있던 0.46 과 같은 종류의 어긋남)
        // 앵커는 쿼드 전체 기준 — 평면을 QUAD_K 배로 키웠으므로 여기도 같은 배수여야 자리가 맞는다.
        //   (session.placeMarkNum 은 맞췄는데 여기만 빠져 있었다.)
        const off = MARK_NUM.anchor(a, this._footRight, FOOT_PLANE_M * QUAD_K);   // fx-core 규약
        this.num.position.set(off.x, off.y, 0.004);
        this.num.scale.setScalar(off.s);
      }
    }
  }
}

// ── 방향 화살표 = LINE ① 경로 추종 (카탈로그 pathArrow 구성 그대로) ──────
//    광류 자루(LANEFX) + 경로 위를 '이동'하는 촉 3개(u = t·0.12 + i/3, 접선 정렬).
//    촉 크기 = 경로의 0.09 (랩 34px/380px 실측 비율 — 구성 고정, 스케일만 원칙).
//    구 makeArrow(flatMat 정적 도형 통화살표)와 '촉 끝 주차'는 카탈로그에 없는 종 — 은퇴.
export const FLOW_ARROWS = [];
export function makeFlowArrow(len, { tips = 1, wall = false, scale = 1 } = {}) {
  // LINE 토큰 = 테이퍼 스템 + SVG 촉 draw-on (유저 확정: 러닝 A3 리프트 큐 2안).
  // 랩 프리뷰와 같은 fx-core drawStemArrow 하나로 그린다 — 셰이더 자루/별도 촉 판 은퇴.
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;   // 리프트 큐 기준 캔버스
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.5, len),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.position.y = len / 2;
  g.add(mesh);
  g._len = len; g._canvas = c; g._tex = tex; g._mesh = mesh; g._paintT = -9; g._noTip = tips === 0; g._tips = [];
  g._scale = scale;   // 두께·촉 배율(길이는 그대로) — 길이가 달라도 실측 두께를 맞출 때
  // 바닥 = 수평면(x=-90°, 살짝 띄움). 벽 = 수직면 유지(x=0) → 자루가 +Y로 서고 caller가 rotation.z로 방향 지정.
  if (wall) { g.rotation.x = 0; g.position.y = 0; } else { g.rotation.x = -Math.PI / 2; g.position.y = 0.014; }
  g.renderOrder = 6;
  g._wall = !!wall;   // 벽 화살표는 투사면 페이드 미적용 (지면 전용)
  FLOW_ARROWS.push(g);
  return g;
}
/** 매 프레임 — LINE 정본(drawStemArrow)으로 화살표 캔버스 리페인트. 부모 잃은 화살표는 자동 정리.
 *  24fps 스로틀: 촉 글리프 래스터가 매 프레임 갈리면 화살표 10여 개에서 비용이 붙는다(draw-on은 이 정도면 매끄럽다). */
/** 투사창 소프트 페이드 계수 — 빔 사다리꼴 경계에서 알파가 0으로 스러진다(GPU 클리핑 하드컷 방지).
 *  pad = 오브젝트 반경. 중심만 보면 큰 판은 가장자리가 경계를 넘어 사각으로 잘리므로 반경만큼 미리 접는다. */
export function beamAlphaAt(rig, wp, pad = 0) {
  const fp = rig?._fp;
  if (!fp) return 1;
  const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const F = 0.25 + pad;
  const rx = wp.x - fp.ox, rz = wp.z - fp.oz;
  const d = rx * fp.fx + rz * fp.fz, h = rx * fp.rx + rz * fp.rz;
  const k = Math.max(0, Math.min(1, (d - rig.fpNear) / Math.max(0.01, rig.fpFar - rig.fpNear)));
  const half = rig._halfAt(rig.fpNear) + (rig._halfAt(rig.fpFar) - rig._halfAt(rig.fpNear)) * k;
  return sm(rig.fpNear, rig.fpNear + F, d) * sm(rig.fpFar, rig.fpFar - F, d) * sm(half, half - F, Math.abs(h));
}

export function tickFlowArrows(t, rig) {
  // 촉 SVG persistent 재등록 — GLYPHS.set(lab)가 맵을 통째 교체해도 살아남게
  if (!GLYPHS.map.TIP_TRI) { GLYPHS.map.TIP_TRI = import.meta.env.BASE_URL + 'ready-view/assets/arrow_tip.svg'; GLYPHS.set(GLYPHS.map); }
  if (!GLYPHS.map.LIFT_TIP) { GLYPHS.map.LIFT_TIP = import.meta.env.BASE_URL + 'ready-view/assets/lift_tip.svg'; GLYPHS.set(GLYPHS.map); }
  const day = (FXP.day || FXP.markBlend === 'ink') ? 1 : 0;
  const ENV = { lut: lutColor, glyph: drawGlyph, arrow: FXP.arrow || {} };
  for (let i = FLOW_ARROWS.length - 1; i >= 0; i--) {
    const g = FLOW_ARROWS[i];
    if (!g.parent) { FLOW_ARROWS.splice(i, 1); continue; }
    if (t - g._paintT >= 1 / 24) {
      g._paintT = t;
      // _prog 지정 = 자유 루프 대신 외부 구동(세션이 타이밍을 잡는 경우). 다 그려지면 그 상태로 멈춘다.
      drawStemArrow(g._canvas.getContext('2d'), 128, 256, t, ENV, { noTip: g._noTip, prog: g._prog, scale: g._scale });
      g._tex.needsUpdate = true;
    }
    // 투사면 소프트 페이드 — 셰이더를 버렸으니 CPU에서 판 전체 알파로 (경계에서 사각으로 잘리지 않게)
    const fp = rig?._fp;
    const m = g._mesh.material;
    if (fp && !g._wall) {
      // 투사창 페이드는 화살표의 '양 끝'(뿌리·촉)으로 계산해 더 약한 쪽을 쓴다.
      // 원점만 보면 촉이 창 경계를 넘어도 알파가 1이라 GPU 클리핑 하드컷(사각 잘림)이 그대로 보였음(유저).
      const at = (wp) => beamAlphaAt(rig, wp);
      const a0 = new THREE.Vector3(), a1 = new THREE.Vector3();
      g.getWorldPosition(a0); g._mesh.getWorldPosition(a1);
      a1.multiplyScalar(2).sub(a0);   // 촉 끝 ≈ 원점 + 2·(판 중심 − 원점)
      m.opacity = Math.min(at(a0), at(a1)) * (g._gain ?? 1);
    } else m.opacity = (g._gain ?? 1);
    if (m._day !== day) { m._day = day; m.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending; m.needsUpdate = true; }
  }
}

// ─────────────────────────────────────────────────────────────
export class TokenSystem {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.params = { lead: 0.7, size: 1.0, maxVisible: 3 };   // lead↑(0.45→0.7): active가 더 일찍 시작 → preview(희멀건) 시간↓, 발 가이드 선명(유저)
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
      }
      // 화살표는 LUT 히트색 소비(LANEFX) — 역할색 리컬러 대상 아님
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
          const radius = tk.radiusCm ? tk.radiusCm / 100 : (tk.type === 'targetMark' ? ZONE.loose : ZONE.base);
          const mk = new Marker(radius, color, isWall ? 'wall' : 'floor', tk.foot === 'right');
          // MARK 계약 변조 (도달/회피/유지) — 벽 불즈아이는 도달 전용
          if (!isWall && (tk.contract && tk.contract !== 'reach' || tk.holdRing)) mk.setContract(tk.contract);
          // 구 마크별 손편집(tk.design → setArt 캔버스 아트)은 소비 안 함 — 카탈로그 셰이더를
          // 영구히 가리는 좀비였음(v15에서 로컬 편집은 정화했지만 시드 팩 데이터가 남아 있었음).
          // 원칙: 마크 형태·색은 룩 시스템만, 팩은 좌표·시간만.
          // 구 벽면 불즈아이(사제 동심원 과녁 캔버스)는 은퇴 — 카탈로그에 없는 종.
          // 벽 타겟 = MARK 존 원 7상태 그대로 (지면과 동일 토큰, 숫자는 마크 안 글리프).
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
          const arrow = makeFlowArrow(packData.sport === 'basketball' ? 0.9 : 0.55);
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
          // 감속 바 = LINE 자루(촉 없음) 소비 — flatMat 사제 바 은퇴 (룩 시스템만 원칙)
          for (let s = 0; s < 3; s++) {
            const bar = makeFlowArrow(0.5, { tips: 0 });
            bar.rotation.z = yaw + Math.PI / 2;   // 진행에 직교하는 가로 바
            bar.position.set(
              cp.x - dx * (0.4 + s * 0.24), 0.011,
              cp.z - dz * (0.4 + s * 0.24)
            );
            bar.renderOrder = 4;
            bar._gain = 0.55 - s * 0.13;   // 화살표 페이드 (tickFlowArrows가 최종 알파에 곱함)
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
        const mk = new Marker(ZONE.base, COLORS[tk.foot] ?? COLORS.left, 'floor');   // 구 0.16 — base 와 1cm 차이라 구분 불가였다
        mk.role = tk.foot ?? 'left';
        const p = this._mapFloor(tk);
        mk.group.position.x = p.x; mk.group.position.z = p.z;
        mk.render('preview', 0, 0, 1);
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
      const dayL = (FXP.day || FXP.markBlend === 'ink') ? 1 : 0;
      if (LU.uDay.value !== dayL) {
        LU.uDay.value = dayL;
        this.laneFX.material.blending = dayL ? THREE.NormalBlending : THREE.AdditiveBlending;
        this.laneFX.material.needsUpdate = true;
      }
      // 풋프린트 경계 소프트 페이드 — 러너가 지나가며 매 프레임 이동하는 풋프린트를 반영
      const fp = this.rig?._fp;
      if (fp) {
        LU.uFPOrigin.value.set(fp.ox, 0, fp.oz);
        LU.uFPFwd.value.set(fp.fx, 0, fp.fz);
        LU.uFPRight.value.set(fp.rx, 0, fp.rz);
        LU.uFPNear.value = this.rig.fpNear;
        LU.uFPFar.value = this.rig.fpFar;
        LU.uFPHalfN.value = this.rig._halfAt(this.rig.fpNear);
        LU.uFPHalfF.value = this.rig._halfAt(this.rig.fpFar);
      }
    }

    // 팩 마커에도 풋프린트 소프트 페이드 — 세션 마크만 먹여 아이들/팩 마커 글로우가
    // 투사 경계에 하드컷(직선 프레임)되던 것(유저 반복 지적). 레인과 동일 주입.
    const fpm = this.rig?._fp;
    if (fpm) {
      const hn = this.rig._halfAt(this.rig.fpNear), hf = this.rig._halfAt(this.rig.fpFar);
      for (const ev of this.events) {
        const MU = ev.marker?.fx?.material?.uniforms;
        if (!MU || !MU.uFPNear) continue;
        MU.uFPOrigin.value.set(fpm.ox, 0, fpm.oz);
        MU.uFPFwd.value.set(fpm.fx, 0, fpm.fz);
        MU.uFPRight.value.set(fpm.rx, 0, fpm.rz);
        MU.uFPNear.value = this.rig.fpNear;
        MU.uFPFar.value = this.rig.fpFar;
        MU.uFPHalfN.value = hn; MU.uFPHalfF.value = hf;
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
      // 실전 러닝: 바닥 step 마크(1·2·3) 통째 숨김 — 달리며 밟을 과녁 제거(페이서·리듬만).
      // 판정 _fire는 위 linger/miss 블록에서 이미 실행 → 시각만 제거, 채점 그대로.
      if (this.liveHideFloorMarks && ev.surface !== 'wall') phase = 'hidden';
      // 박자 연습(P) = 중앙 레인 제거(유저: 박자에 집중) — 마크 데워짐+이펙트만
      if (this.laneFX) this.laneFX.visible = !this.liveHideLane;
      // 러닝 라이브 = 마크 안 순번 → 발 L/R 글리프 스왑(왕복) — 유저 SVG(pace_foot)
      const mkN = ev.marker;
      if (mkN?.num && ev.surface !== 'wall' && ev.foot) {
        const wantFoot = !!FXP.hideOrderNums;
        if (wantFoot !== !!mkN._numFoot) {
          mkN._numFoot = wantFoot;
          mkN.num.material.map = wantFoot ? makeFootGlyphTexture(ev.foot === 'right') : makeNumberTexture(mkN._numN ?? '');
          mkN.num.material.needsUpdate = true;
        }
      }

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
          a.obj._gain = op;   // 화살표 페이드 — tickFlowArrows가 투사면 페이드와 곱해 최종 알파로 반영
          a.obj.scale.setScalar(size);
        }
      }
    }
  }

  /** 그 면의 마커 필드가 실제로 화면에 있는가 — 파문·판정 도트가 뜰 수 있는 유일한 조건. */
  fieldVisible(surface) {
    return this.root.visible && (surface === 'wall' ? this.wallRoot : this.floorRoot).visible;
  }
  _fire(ev) {
    // 마커 필드가 숨겨진 상태(세션 비실전 등)에선 이펙트도 발화 금지 — 숨긴 마커의 버스트가
    // 씬 직속 쿼드로 계속 쌓여 '정체불명 원 마커'처럼 화면을 점유하던 근본(유저 검수 지적)
    // 벽도 지면과 같은 규칙 — 마커 필드가 꺼져 있으면 파문도 안 뜬다. 벽만 예외였고 공통 root 는
    //   아무도 안 봤던 탓에, 토큰이 통째로 숨겨진 씬(씬 스테이지·C3)에서도 팩 마커 자리에서
    //   파문이 계속 터졌다(유저: 파형이 왜 저기서 나와 — 1·2·3 아래에서 퍼져야지).
    if (!this.fieldVisible(ev.surface)) return;
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
      // 벽 파문은 타겟 크기에 비례 — 전역 크기(지면 기준 1.5m)를 그대로 쓰면 벽 절반을 덮음.
      //   비율은 마크 토큰 규칙(Figma 잽잽훅 279:3203)이 정본: 파형 지름 = 마크 지름 × 1.69.
      //   파문 도달 반경은 쿼드 반폭의 0.9 → sizeM = 반경 × 1.69 / 0.9 ≈ 1.9.
      //   3.4 였을 땐 파형이 마크의 6배로 퍼져 인물 프레임 밖으로 나갔다(유저).
      opts.sizeM = (ev.marker?.radius ?? 0.15) * 1.9;
      opts.intensity = (opts.intensity ?? 1) * 0.8;
      opts.speed = (opts.speed ?? 1) * 1.35;   // 잽 리듬에 맞게 짧게
    }
    if (ev.surface !== 'wall' && this.layout?.mode === 'advance') {
      // 러닝(전진 레인): 무릎 패드가 착지점을 지나치므로 파문은 전방 반파로 방출
      opts.forward = true;
      pos.z -= 0.18;   // 반파 중심을 살짝 전방으로 — 빔 안에서 사는 시간 확보
      // 실전 착지 팡팡(유저): 바닥 닿는 순간이 몸으로 느껴지게 — 강도·헤일로 부스트
      opts.intensity = (opts.intensity ?? 1) * 1.7;
      opts.rings = Math.max(opts.rings ?? 1, 1.8);
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
