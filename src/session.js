import * as THREE from 'three';
import bkStepContacts from '../assets/mocap/contacts-cmu_crossover_shot.json';   // 접지 자동 추출 산출물 (scripts/extract_contacts.mjs)
import { WALL_Z } from './scene.js';
import { lutColor, GLYPHS, drawGlyph, drawNumber, footSlot, footSDFTexture, FXP } from './fxlut.js';
import { MARK_NUM, drawStanceBox, drawPunchLine, drawApproachRing, drawTrajectory, drawRotate, drawStemArrow, drawCurveArrow } from './fx-core.js';
import { makeMarkFXMaterial, makeLaneFXMaterial, makeFlowArrow, tickFlowArrows, beamAlphaAt, COLORS } from './tokens.js';

// 피그마 CTA 임포트 — StageCard/베이스 컴포넌트의 cta 노드를 다운로드한 에셋(150×44 원 비율).
// 절차: 피그마에서 download_assets → public/textures/<sport>_running.png → 여기서 텍스처로 소비.
// 새 디자인으로 갈아끼울 땐 같은 파일명으로 재수출 후 배포하면 끝(코드 변경 없음).
const CTA_ASSET = { running: 'cta_running.png' };
const _ctaTex = {};
function ctaTexture(sport) {
  const file = CTA_ASSET[sport];
  if (!file) return null;
  if (_ctaTex[sport] === undefined) {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(`${import.meta.env.BASE_URL}textures/${file}`, () => {}, undefined, () => { _ctaTex[sport] = null; });
    tex.colorSpace = THREE.SRGBColorSpace;
    _ctaTex[sport] = tex;
  }
  return _ctaTex[sport];
}

// ─────────────────────────────────────────────────────────────
// 러닝 세션 흐름 — 와이어프레임 v2 전체 15프레임 이식
//   READY → A스트레칭(발목·종아리·다리스윙·박자걷기) → T-1
//   → B익히기(박자듣기·제자리·3스텝·구간유지) → T-2(카운트다운)
//   → C실전(출발·페이스·흔들림보정·BOOST·감속) → 리포트
//   목적: "UI가 이렇게 나오는가 / 이 단계를 거치는가 / 1인칭에서 어떻게 보이는가".
//   비실전 단계는 팩 시간·봇 정지 (따라하기 검증 아님).
//   규칙: 발형(Step-type A·B) / 존형(Prediction C) · 색=상태 · 타이포 고정 슬롯
//   선택은 제스처(카운트다운+발 두 번 탭) — 지면엔 카메라 없음.
// ─────────────────────────────────────────────────────────────

// 에디터에서 실시간 조절되는 세션 타이밍 (초)
export const SCFG = { a1Rep: 2.0, a2Hold: 10, a3Swing: 1.55, a4Beat: 0.6, b1Beat: 0.6, b2Beat: 0.7, b3Step: 1.1, b4Beat: 0.55 };   // a3Swing=햇지런 영상 실측 스윙 주기 1.55s (FK 제로크로싱 측정 — 코치 클립과 카운트 동기)
// 타이틀·발형이 물리적으로 겹치는 장면(빔 원경계 ~2.85m 안에 실측 운동 요소가 타이틀 깊이까지 뻗음) — 이 셋뿐
const DENSE_STAGES = new Set(['B3', 'B4', 'C5']);

const BRAND = { red: 0xfa3030, coral: 0xfe6e3c, sand: 0xfec389, prism: 0xd1feff, ink: 0xffffff, dim: 0x9b9b9b };
export { BRAND };
// 히트 계열(red·coral·sand)은 룩 LUT의 정준 위치에서 파생 — 기본 Vivid 룩에선 기존 값과 동일,
// 룩 팔레트를 바꾸면 세션 45컷이 함께 따라온다 (부트 시 파생 — 룩 저장 후 새 세션/새로고침 반영).
// prism(판정·성공)·ink(잉크)는 상태 부호화 전용이라 고정 (색=상태 원칙).
const CS = { red:'#fa3030', coral:'#fe6e3c', sand:'#fec389', prism:'#d1feff', ink:'#ffffff', dim:'#c9c9c9', mute:'#9b9b9b' };
export function deriveSessionPalette() {
  const toHex = css => { const m = css.match(/rgb\((\d+),(\d+),(\d+)\)/); return m ? (+m[1] << 16) | (+m[2] << 8) | +m[3] : 0xfa3030; };
  CS.red = lutColor(0.30);
  CS.coral = lutColor(0.56);
  CS.sand = lutColor(0.86);
  BRAND.red = toHex(CS.red);
  BRAND.coral = toHex(CS.coral);
  BRAND.sand = toHex(CS.sand);
}

function flatMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

// ── 지면 텍스트 (눕힘만으로 -Z 전방이 위 = 유저 읽는 방향) ──
// 장면 에디터: family(폰트)까지 편집 가능 — userData.el 메타 + redraw로 라이브 갱신
export const FONT_FAMILIES = [
  ['Pretendard, -apple-system, sans-serif', '기본 (Pretendard)'],
  ['"Noto Sans KR", sans-serif', '노토 산스'],
  ['"Noto Serif KR", serif', '노토 세리프 (명조)'],
  ['"Black Han Sans", sans-serif', '블랙한산스 (헤비)'],
  ['"Gowun Dodum", sans-serif', '고운돋움 (라운드)'],
  ['Georgia, "Times New Roman", serif', '세리프 (라틴)'],
  ['Menlo, "SF Mono", monospace', '모노'],
];
function drawTextTex(text, { size = 0.10, color = '#FFF3DC', weight = 700, family = FONT_FAMILIES[0][0] } = {}) {
  // 장면 UI 잉크 규정과 동일 언어 (sceneui.makeTextTexture): 웜 크림 + 웜 글로우 — 세션만 따로 놀던 사제 잉크 은퇴
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = `${weight} 64px ${family}`;
  ctx.font = font;
  c.width = Math.max(8, Math.ceil(ctx.measureText(text).width) + 44); c.height = 96;
  const x = c.getContext('2d'); x.font = font; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(254,163,95,.9)'; x.shadowBlur = 19;
  x.fillStyle = color;
  x.fillText(text, 22, 50);
  x.shadowBlur = 0;
  x.fillText(text, 22, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, aspect: c.width / c.height };
}
function makeTextMesh(text, opts = {}) {
  const o = { size: 0.10, color: '#FFF3DC', weight: 700, family: FONT_FAMILIES[0][0], ...opts };
  const { tex, aspect } = drawTextTex(text, o);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(o.size * aspect, o.size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const g = new THREE.Group(); g.add(plane); g.rotation.x = -Math.PI / 2; g.position.y = 0.013; g.renderOrder = 7;
  g.userData.plane = plane;
  const el = { type: 'text', content: text, ...o };
  const redraw = (patch) => {
    Object.assign(el, patch);
    const r = drawTextTex(el.content, el);
    plane.material.map.dispose(); plane.material.map = r.tex; plane.material.needsUpdate = true;
    plane.geometry.dispose(); plane.geometry = new THREE.PlaneGeometry(el.size * r.aspect, el.size);
  };
  g.userData.el = el; g.userData.redraw = redraw;
  plane.userData.el = el; plane.userData.redraw = redraw;   // makeTextPlane 경유해도 유지
  return g;
}
function makeTextPlane(text, opts = {}) { const g = makeTextMesh(text, opts); const p = g.userData.plane; g.remove(p); return p; }

// 구 발형 마크 v2(족저 압력 히트맵 캔버스 텍스처) 삭제 — FootMark가 MARK 발형 셰이더로
// 대체한 뒤 호출처 0인 죽은 코드였음 (룩 시스템 외 사제 렌더의 마지막 잔재).
class FootMark {
  // 세션 발자국 = MARK 발형 상태 머신 소비 (시안 보드 7상태 그대로).
  // 열화상 사제 텍스처·flatMat 카운트다운 링·홀드 호 전부 은퇴 — 룩 시스템이 유일한 형태:
  //   대기=Preview 소프트 필 · 카운트다운=Active 헤일로 수축 · 유지=Hold 코닉 림 · 성공=Success 블룸
  constructor(foot) {
    this.foot = foot;
    this.group = new THREE.Group();
    let tex = null;
    try { tex = footSDFTexture(foot === 'right'); } catch (e) { tex = null; }
    const mat = makeMarkFXMaterial(tex);
    this._U = mat.uniforms;
    this._U.uPhase.value = 0;
    this._U.uFade.value = 1;
    WAVE_MATS.push(mat);   // uTime·주간 잉크 규약 틱 동승
    const S = 0.46;        // 실루엣 시각 높이 ≈ 0.36m (기존 0.29m보다 약간 큼 — MARK 존 기준)
    // ponytail: at(x,z,s)의 s는 씬마다 손으로 박은 매직넘버(페어 1.05 / 라인 0.62 / 커서 0.42).
    //   규격은 이 S=0.46 하나뿐. 나중에 배율 상수 하나로 통일하기로 함(유저, 07-28).
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat);
    this.group.add(this.plane);
    this.group.rotation.x = -Math.PI / 2; this.group.position.y = 0.013; this.group.renderOrder = 6;
    this.plane.rotation.z = foot === 'left' ? THREE.MathUtils.degToRad(8) : THREE.MathUtils.degToRad(-8);
    this.plane.renderOrder = 4;   // 궤적 토큰(9)이 항상 발자국 '위'에 겹쳐 그려지도록 순서 못박음(유저)
    this.group.userData.el = { type: 'foot', side: foot };
  }
  at(x, z, s = 1) { this.group.position.set(x, 0.013, z); this.group.scale.setScalar(s); return this; }
  op(k) { this._U.uFade.value = k; }
  setHold(p) { this._U.uPhase.value = 5; this._U.uProg.value = Math.max(0.001, p); }   // Hold 코닉 진행 림
  countdown(p) {
    if (p < 0) { this._U.uPhase.value = 0; this._U.uProg.value = 0; return; }          // 대기 = Preview 숨쉬기
    this._U.uPhase.value = 1; this._U.uProg.value = p;                                 // Active — 헤일로 수축 = 타이밍
  }
  // Success = '색이 진해진 상태' 그 자체다(유저 정의). 저절로 흐려지지 않는다 —
  //   러닝에서 성공 후 사라지는 건 토큰의 성질이 아니라 다음 마크로 넘어가는 '전환 모션'이다.
  //   k=1 이면 진행도 0 = 가장 진한 상태로 고정. 흐리게 하고 싶은 호출부만 k를 낮춘다.
  glow(k = 1) { this._U.uPhase.value = 2; this._U.uProg.value = Math.min(1, 1 - k); }
  toe(k) { this._U.uToe.value = k; }   // 1 = 앞꿈치만 접지(뒤꿈치 투명·앞 강조)
  ghost() { this._U.uPhase.value = 3; this._U.uProg.value = 0; }                        // Locked 무채 고스트 — 션 발자국 시범·예고
}

// ── 지면 프리미티브 (userData.el = 장면 에디터 메타) ──
function floorRing(x, z, rIn, rOut, color, op = 0.9) {
  // 링 = MARK 존 원: 히트색 → Preview 파동 · 무채(dim) → Locked 고스트
  const m = waveRingMesh(rIn, rOut, color, op, false, isHeatColor(color) ? 0 : 3);
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.013, z);
  m.userData.el = { type: 'ring' }; return m;
}
function floorArc(x, z, color) {
  // 회전·카운트 진행 = MARK Hold 코닉 진행 림 (사제 아크 도형 은퇴 — 토큰 매핑 확정)
  const m = waveRingMesh(0.20, 0.235, color, 0.95, false, 5);
  m.material._auto = true;   // setProg 구동자가 없으면 시연 루프
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0135, z); m.renderOrder = 6;
  m.userData.el = { type: 'arc' }; return m;
}
/** 하이니 리프트 큐 3안(유저: 룩시스템 화살표 짜침 → 외부 패턴 리서치 이식, 뉴턴 LUT 색).
 *  1=셰브론 캐스케이드(scroll-cue 계열) · 2=테이퍼 스템 draw-on · 3=트리플 바 등화. FXP.a3Arrow로 토글. */
function drawLiftCue(g, style, t, pulse, W = 128, Hh = 256) {
  g.clearRect(0, 0, W, Hh);
  const cx = W / 2, col = v => lutColor(v);
  if (style === 2) {
    // 테이퍼 스템 + SVG 촉 draw-on = LINE 토큰 정본(fx-core drawStemArrow). 지면 화살표·랩 프리뷰와
    // 같은 코드 한 벌 — 유저 확정 디자인이라 여기(리프트 큐 2안)가 그 정본의 원본이었다.
    if (!GLYPHS.map.LIFT_TIP) { GLYPHS.map.LIFT_TIP = import.meta.env.BASE_URL + 'ready-view/assets/lift_tip.svg'; GLYPHS.set(GLYPHS.map); }
    drawStemArrow(g, W, Hh, t, { lut: lutColor, glyph: drawGlyph, arrow: FXP.arrow || {} }, { pulse });
  } else if (style === 3) {   // 트리플 바 — 위로 갈수록 좁아지며 순차 점등
    for (let i = 0; i < 3; i++) {
      const w = [66, 46, 28][i], y = [206, 148, 92][i];
      const on = ((t * 2 + i * 0.25) % 1) < 0.5 ? 1 : 0.35;
      g.fillStyle = col(0.5 + 0.18 * i); g.globalAlpha = (0.25 + 0.75 * on) * (0.5 + 0.5 * pulse);
      g.shadowColor = col(0.85); g.shadowBlur = 12;
      g.beginPath(); g.roundRect(cx - w / 2, y, w, 18, 9); g.fill();
    }
  } else {                    // 1(기본) 셰브론 캐스케이드 — 아래→위 페이드 웨이브
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.4 + i * 0.33) % 1;
      const y = 198 - i * 62, a = Math.sin(Math.PI * Math.min(1, ph / 0.85)) * (0.35 + 0.65 * pulse);
      g.strokeStyle = col(0.55 + 0.3 * (1 - i / 3)); g.lineWidth = 15; g.lineCap = 'round'; g.lineJoin = 'round';
      g.globalAlpha = Math.max(0.08, a);
      g.shadowColor = col(0.8); g.shadowBlur = 13 * (0.5 + pulse);
      g.beginPath(); g.moveTo(cx - 33, y + 22); g.lineTo(cx, y); g.lineTo(cx + 33, y + 22); g.stroke();
    }
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
}
function floorArrow(x, z, deg, color, len = 0.4) {
  // 방향 = LINE ① 경로 추종 화살표 — 카탈로그 구성 통째(광류 자루 + 이동 촉, tokens.makeFlowArrow).
  // 촉 끝 주차·정적 통화살표는 카탈로그에 없는 종 (유저 지적 2회 — 촉은 경로 위를 이동).
  const g = makeFlowArrow(len);
  g.position.set(x, 0.014, z);
  g.rotation.z = THREE.MathUtils.degToRad(deg);
  g.userData.el = { type: 'arrow' }; return g;
}
function floorStripe(x, z, w, color, op) {
  // 감속 리듬 바 = LINE ④ — LANEFX 광류 자루(촉 없음), 강조는 _gainK(페이드 규약)
  const mat = makeLaneFXMaterial(w);
  mat._arrowStyle = true; mat._gainK = op;
  LANE_MATS.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, w), mat);
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2;   // 가로 바 방향 유지
  m.position.set(x, 0.012, z); m.renderOrder = 4;
  m.userData.el = { type: 'stripe' }; return m;
}
function floorText(text, x, z, opts) { const g = makeTextMesh(text, opts); g.position.set(x, 0.013, z); return g; }
function floorNum(text, x, z, size, color) {
  // 숫자 = 글리프 슬롯 소비 (시뮬 마크 숫자와 동일 언어 — 커스텀 SVG 우선, 웜 크림 폴백)
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g2 = c.getContext('2d');
  if (!drawNumber(g2, String(text), 64, 64, 96)) {
    g2.fillStyle = 'rgba(255,240,220,0.95)';
    g2.font = `300 ${String(text).length > 1 ? 60 : 86}px -apple-system, sans-serif`;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.shadowColor = 'rgba(254,150,90,0.75)'; g2.shadowBlur = 14;
    g2.fillText(String(text), 64, 70);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, size * 1.5),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(p); g.rotation.x = -Math.PI / 2; g.position.set(x, 0.013, z); g.renderOrder = 7; g.userData.plane = p;
  g.userData.el = { type: 'text', content: String(text) };
  p.userData.canvas = c; p.userData.tex = tex;   // 카운트다운 갱신용 노출
  return g;
}
/** 발 안 숫자 글리프 갱신 (카운트다운 5→1) — 캔버스 재드로 */
function redrawFootNum(p, n) {
  const c = p.userData.canvas, g2 = c.getContext('2d');
  g2.clearRect(0, 0, 128, 128);
  if (!drawNumber(g2, String(n), 64, 64, 96)) {
    g2.fillStyle = 'rgba(255,240,220,0.95)'; g2.font = `300 ${String(n).length > 1 ? 60 : 86}px -apple-system, sans-serif`;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.shadowColor = 'rgba(254,150,90,0.75)'; g2.shadowBlur = 14; g2.fillText(String(n), 64, 70);
  }
  p.userData.tex.needsUpdate = true;
}
// 발 안 순서 숫자 — 카탈로그 조합 그대로 '기울어진 발 플레인'의 자식으로 부착:
// 발이 기울면 숫자도 통째로 기울고(구성 고정), 크기 = 랩 공식 140·radius·s/600,
// 앵커 폴백 = 랩과 동일(실루엣 무게중심). (유저 원칙: 이식은 구성 고정 + 스케일만)
function attachMarkNum(fm, label, right) {
  const S = 0.46;   // FootMark 쿼드
  const p = floorNum(String(label), 0, 0, S * MARK_NUM.RATIO / 0.75 / 1.5, CS.ink).userData.plane;
  p._numRight = right;
  p._numFm = fm;
  p.renderOrder = 7;
  fm.plane.add(p);
  placeMarkNum(p);
  return p;
}
// 앵커·스케일은 매 프레임 룩 값에서 — 세션 그래픽은 부트에 빌드되는데 applyLabState
// (numFoot·mark.radius 주입)는 그 뒤라, 빌드 시 1회 읽기는 항상 폴백에 박제됐음.
function placeMarkNum(p) {
  const tex = p._numFm._U.uSDF2.value;
  const a = (FXP.numFoot && FXP.numFoot[FXP.footCtx === 'in' ? 'in' : 'out'])
         || { x: tex?._cx ?? 0.5, y: tex?._cy ?? 0.42, s: 1 };
  const off = MARK_NUM.anchor(a, p._numRight, 0.46);
  p.position.set(off.x, off.y, 0.002);
  p.scale.setScalar((off.s || 1) * (FXP.mark.radius || 1));
}
// 파동 링 재질 틱 목록 (프리뷰·세션 공통 — main 루프가 tickWaves 호출)
const WAVE_MATS = [];
function isHeatColor(c) { return c === BRAND.red || c === BRAND.coral || c === BRAND.sand; }
/** 링·아크 = 전부 MARK 존 원의 상태 (사제 도형 금지 — 룩 시스템이 유일한 최소 단위):
    히트색=Preview 파동 · 무채=Locked 고스트 · 진행(구 아크·홀드링)=Hold 코닉 림.
    setOp/setProg/setPhase가 상태 구동 표준 — .material.opacity 직접 조작 금지(셰이더 무효). */
function waveRingMesh(rIn, rOut, color, op, wall, phase = 0) {
  const quadR = rOut / 0.72;
  const mat = makeMarkFXMaterial();
  const U = mat.uniforms;
  U.uPhase.value = phase;
  U.uFade.value = op;
  U.uGain.value = wall ? 0.6 : 1.0;
  mat._wall = wall;   // 벽 마크는 지면 풋프린트 페이드 미적용(tickWaves 게이트)
  // 오버라이드 금지 — 세션 링 = 카탈로그의 MARK 원형 그대로(반경·상태·진행만 이 자리서 지정).
  // 예전엔 uPool=0.1 하드코딩 + rIn/rOut로 uW 재계산해 카탈로그와 다른 '새 종'처럼 보였음
  // (유저: "룩 시스템 토큰으로 진행되고 있지 않다" — 정확한 지적). 룩 값은 tickWaves가
  // 팩 마커(tokens.js)와 동일하게 매 프레임 FXP.mark에서 직결 주입.
  WAVE_MATS.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(quadR * 2, quadR * 2), mat);
  m.renderOrder = 5;
  m.setOp = k => { U.uFade.value = k; };
  m.setProg = p => { mat._auto = false; U.uProg.value = p; };
  m.setPhase = ph => { U.uPhase.value = ph; };
  return m;
}
function laneLine(color, z0 = 1.0, z1 = -3.2) {
  // 레인 = LINE 토큰 소비 — 시뮬 레인과 동일 LANEFX 셰이더 (스타일·속도·간격·온도 전부 룩 시스템).
  // LineDashedMaterial 사제 점선 은퇴.
  const len = z0 - z1;
  const mat = makeLaneFXMaterial(len);
  LANE_MATS.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, len), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.011, (z0 + z1) / 2);
  m.renderOrder = 4;
  m.userData.el = { type: 'lane' };
  return m;
}
const LANE_MATS = [];   // 세션 레인 재질 틱 (tickWaves가 uTime·LINE 스타일 동승)

// ── 파생 프리미티브 = fx-core 정본 캔버스 소비 (랩과 같은 코드 — 100% 동일 이식) ──
const PRIM_DEFAULTS = {
  stanceBox: { w: 1, glow: 1, tempo: 1, dash: 1, round: 0.2, feet: 1 },
  punchLine: { w: 1, glow: 1, tempo: 1, node: 1, numS: 1, dash: 0 },
  approachRing: { w: 1, glow: 1, tempo: 0.6, r: 0.42, rt: 0.36 },
  trajectory: { w: 1, glow: 1, tempo: 0.5, spread: 1, width: 1.4, tail: 1, taper: 1.6, spark: 0.6 },
  rotate: { w: 1, glow: 1, tempo: 0.5, r: 0.3, sweep: 0.66, dir: 1, width: 1 },
};
// 잽 궤적 방향 세트 — 렙마다 바꿔 정면·크로스·좌우 다양한 잽(정규 제어점, 가드 아래→타겟 위)
const JAB_PATHS = [
  [[-0.15, 0.82], [0, 0.05], [0.12, -0.72]],    // 정면 스트레이트
  [[0.35, 0.72], [0.05, 0.0], [-0.3, -0.62]],   // 오른쪽에서 → 왼쪽 크로스
  [[-0.35, 0.72], [-0.05, 0.0], [0.3, -0.62]],  // 왼쪽에서 → 오른쪽
  [[-0.06, 0.85], [0.2, 0.1], [-0.04, -0.82]],  // 안쪽으로 감아치는 훅 느낌
];
const SWEEP_PATHS = [
  [[-0.55, 0.5], [0, -0.2], [0.55, 0.5]],   // 좌 → 우 스윕
  [[0.55, 0.5], [0, -0.2], [-0.55, 0.5]],   // 우 → 좌 스윕
];
function livePrimEnv() {
  return {
    arrow: FXP.arrow,
    lut: lutColor,
    num: (g, ch, x, y, size, fontPx) => {
      if (drawGlyph(g, String(ch), x, y, size)) return;
      g.font = `300 ${fontPx}px -apple-system, sans-serif`;
      g.fillStyle = 'rgba(255,240,220,0.95)';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(ch), x, y);
    },
    foot: (g, right, x, y, size) => {
      if (drawGlyph(g, footSlot(right), x, y, size)) return;
      g.beginPath(); g.ellipse(x, y, size * 0.28, size * 0.48, 0, 0, Math.PI * 2); g.stroke();
    },
  };
}
const PRIM_PANELS = [];
function primPanel(kind, sizeM, wall) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const isTraj = kind === 'trajectory';
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sizeM, sizeM),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
      // 궤적만 일반 블렌딩 — 가산은 '순서'가 결과에 영향을 안 준다(빛의 합). 발마크 빨강이 포화라
      // renderOrder/depthTest를 아무리 올려도 궤적이 묻혔던 근본(유저 4회 지적).
      blending: isTraj ? THREE.NormalBlending : THREE.AdditiveBlending,
      toneMapped: false, depthTest: !isTraj }));
  if (!wall) m.rotation.x = -Math.PI / 2;
  // 궤적은 항상 발자국 '위'. renderOrder만으로는 깊이 테스트에 걸려 뒤로 밀릴 수 있어
  // depthTest까지 끈다(유저 3회 지적: 아직도 궤적이 뒤에 있다).
  m.renderOrder = isTraj ? 14 : 6;
  m.userData.el = { type: kind, wall: !!wall };
  const panel = { kind, c, tex, m, prog: null, pts: null, P: null, t0: 0 };   // P=인스턴스 파라미터 · t0=사이클 시작 시각(개별 트리거)
  m._prim = panel;
  PRIM_PANELS.push(panel);
  return m;
}
/** 궤적 사이클 트리거 — 그 발이 '올라가기 시작하는' 순간(임계 상향 교차) 사이클을 리셋한다.
 *  좌우가 각자 자기 발 타이밍에 맞춰 뻗는다(전역 시계 공유 시 동시에 움직이던 문제). */
function tjTrigger(H, side, p) {
  // 자체 래치 — 호출부에서 prev를 넘겨받는 방식은 바로 윗줄에서 _prevP*가 이미 갱신돼 있어
  // 상향 교차가 영원히 성립하지 않았다(유저: 아직도 좌우가 동시에 움직인다).
  const k = '_tjUp' + side;
  const up = p > 0.10;
  if (up && !H[k]) {
    const tj = side === 'L' ? H.tjL : H.tjR;
    if (tj && tj._prim) tj._prim.t0 = performance.now() / 1000;
  }
  H[k] = up;
}
let _primLastT = 0;
function tickPrims(t) {
  if (t - _primLastT < 1 / 30) return;   // 캔버스 비용 — 30Hz면 충분
  _primLastT = t;
  for (const p of PRIM_PANELS) {
    let o = p.m, vis = true;
    while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
    if (!vis || !p.m.parent) continue;
    const g = p.c.getContext('2d');
    const look = { halo: FXP.mark.halo };
    const base = (FXP.prims && FXP.prims[p.kind]) || PRIM_DEFAULTS[p.kind];
    const P = p.P ? { ...base, ...p.P } : base;
    if (p.kind === 'stanceBox') drawStanceBox(g, 256, P, look, t, livePrimEnv());
    else if (p.kind === 'approachRing') drawApproachRing(g, 256, P, look, t, livePrimEnv(), p.prog);
    else if (p.kind === 'trajectory') drawTrajectory(g, 256, P, look, t - (p.t0 || 0), livePrimEnv(), p.prog, p.pts);
    else if (p.kind === 'rotate') drawRotate(g, 256, P, look, t, livePrimEnv(), p.prog);
    else if (p.kind === 'curveArrow') drawCurveArrow(g, 256, 256, p.pts || [[0.5, 0.9], [0.5, 0.1]], t, livePrimEnv(), { prog: p.prog });
    else drawPunchLine(g, 256, P, look, t, livePrimEnv(), p.pts, p.prog);
    p.tex.needsUpdate = true;
  }
}

// ── 벽면 프리미티브 (복싱 — z=WALL_Z 세워진 평면, 유저(+z) 바라봄, 눕힘 없음) ──
const WZ = WALL_Z + 0.03;
function wallRing(x, y, rIn, rOut, color, op = 0.9) {
  const m = waveRingMesh(rIn, rOut, color, op, true, isHeatColor(color) ? 0 : 3);
  m.position.set(x, y, WZ); m.userData.el = { type: 'ring', wall: true }; return m;
}
function wallArc(x, y, rIn, rOut, color, a0, len, op = 0.9) {
  // 벽 회전·유지 진행 = MARK Hold 코닉 림 (지면과 동일 토큰) — 부분호 길이는 uProg로
  const m = waveRingMesh(rIn, rOut, color, op, true, 5);
  if (len > 0.01) { m.material.uniforms.uProg.value = Math.min(1, len / (Math.PI * 2)); }
  else m.material._auto = true;
  m.position.set(x, y, WZ + 0.001); m.renderOrder = 6; m.userData.el = { type: 'arc', wall: true }; return m;
}
function wallText(text, x, y, opts) {
  const p = makeTextPlane(text, opts); p.position.set(x, y, WZ + 0.002); p.renderOrder = 7;
  if (p.userData.el) p.userData.el.wall = true; return p;
}
/** 가드 존 박스 — 신체 부위가 머물 영역 (스탠스 박스 파생: FX Lab round·dash 소비) */
function guardBox(x, y, w, h, color, op = 0.8) {
  // 가드 박스 = 스탠스 박스 파생(LINE 둘레 + MARK 헤일로)이되, 가드는 발이 아니라 주먹/얼굴이므로
  // FOOT 글리프 제거(feet:0) + 모서리 둥글게. (발자국은 스텝/스탠스 전용)
  const m = primPanel('stanceBox', w / 0.636, true);   // 캔버스 내 박스 폭비 140/220
  m._prim.P = { feet: 0, round: 0.5 };
  m.material.opacity = op;
  m.position.set(x, y, WZ); return m;
}
/** 벽면 방향 화살표 = 룩 시스템 LINE 촉이동 토큰(makeFlowArrow, 수직면).
 *  (x,y)에서 자루가 뻗고 angleDeg로 지시 방향 회전 — 0=위 · 90=왼쪽 · -90=오른쪽 · 180=아래.
 *  촉·자루 애니메이션은 tickFlowArrows(세션 tickWaves 내부)가 매 프레임 급이. */
function wallArrow(x, y, len, angleDeg = 0) {
  const a = makeFlowArrow(len, { wall: true });
  a.position.set(x, y, WZ + 0.004);
  a.rotation.z = THREE.MathUtils.degToRad(angleDeg);
  return a;
}
function wallTap() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.07, 32), flatMat(BRAND.prism, 0.95)); r.position.x = (i - 0.5) * 0.18; g.add(r); }   // 탭 = 입력 어포던스(토큰 아님) 원복
  g.position.z = WZ; g.renderOrder = 7; g.userData.el = { type: 'tap', wall: true }; return g;
}

// ─────────────────────────────────────────────────────────────
// 종목별 스테이지 스크립트. 공통 로직은 데이터 필드로 구동:
//   live=실전 팩 재생 · boost=가속 · cooldown=감속정지 · count=카운트다운
// 스테이지별 고유 비주얼은 sport-dispatch(_build/_enter/_update)로 처리.
// 농구 스텝 가이드 — cmu_crossover_shot(CMU 06_14) FK 접지 추출: 스텝 4 + 양발 슛 착지 2
// 실측 스텝 가이드 = 접지 자동 추출 데이터(contacts-*.json)에서 생성 — 하드코딩 좌표 금지.
// 필터: 시작 스탠스(t<0.15)·슛 후 착지(t>3.0) 제외 → 학습 6접지(스텝4+양발 착지).
const BK_GUIDE = bkStepContacts.contacts.filter(c => c.t >= 0.15 && c.t <= 3.0);
const BK_STAND = -1.85;   // B1~B3 봇 배치(z) — 가이드 전체(마크·링·텍스트)가 투사존(-1.2~-2.8) 안에 들어오는 후퇴 위치
// 학습 가이드 확대 계수 — 실측 무브 반경(~0.5m)을 그대로 그리면 1인칭 원근에서 발자국이
// 한 덩어리로 뭉쳐 읽을 수 없음(유저 검수). 형태·순서는 실측 그대로, 간격만 2.2배 확대.
const BK_ZOOM = 2.2;

// 농구 워밍업 = 동적 웜업 3동작(하나의 실제 루틴 cmu13_30을 구간별로 반복).
// 봇은 각 구간 루프(main.js phase), 코치 영상은 COACH_CFG(BK_A*)가 바닥 투사, 지면은 반복 카운트.
// seg = auto_cmu13_30 클립 시간구간(초), per = 1회 주기, reps = 목표 횟수.
// 워밍업 반복 규칙(정본, 유저): 동작마다 목표 횟수를 정하고 지면 숫자는 '남은 횟수'를 카운트다운,
// 0이 되면 다음 스테이지로 자동 진행. A2는 양발 합계 기준(왼·오른 번갈아 총 N회).
const BK_REPS = { BK_A1: 2, BK_A2: 10, BK_A3: 6 };   // A3=6: 음성('여섯 번')과 일치 — 10은 워밍업 과다(유저 대조 지적)
                                                     // A1=2 (×2.4s ≈ 5s) — 옆구리는 8회(19s)가 너무 길다(유저)
// B단계 리듬 = 커리 SportVU 실측(2015-10-31 GSW@NOP, 53득점 경기). 두 소유 구간의 바운스 간격이
// 각각 0.400s·0.395s로 독립 수렴 → 150 BPM. data/curry_stepback_sportvu.json 에서 추출.
const BK_BEAT = 0.40, BK_B1_REPS = 8;
// B 가이드 심도 시프트 — 실측 빔 창(origin 몸앞 0.35m + near 0.3 + far 1.9)은 z −2.5~−4.1.
// 몸 바로 앞(0.3~0.55m)은 투사 불가 구간이라, 가이드는 '발 위치'가 아니라 '앞의 도식'으로 0.75m 깊이 배치.
const BDEEP = 0.75;
const BK_SQUAT_REPS = BK_REPS.BK_A3;
// 시범(관찰) 길이 — 프리뷰 타이머 링·장면 시간·main.js A2_WATCH·floor-scene.html이 전부 이 값(3초, 유저)
const A_WATCH = 3.0;
// 따라하기(스텝백 1/4·2/4) 지면 배치 — 한 곳에서만 고친다.
//   V=빔 창 앞뒤(작을수록 화면 하단) · UX=발 페어 좌우 반간격(어깨너비 이상, 실제 농구 스탠스)
//   S=발자국 배율(농구 지면 UI 공통 1.0)

// ── 스텝백 1/4~4/4 — 단계별 누적 포즈 ────────────────────────────────────────
// 규약(유저): 1/4의 상태를 유지한 채 2/4에서 그 다음 이동을 '더하고', 3/4·4/4도 같은 식으로 쌓는다.
//   각 단계는 [이전 포즈 → 이 단계 포즈]만 움직이며, 안 움직이는 발은 자리를 지킨다.
//   좌표는 마크 프레임 단위(u -1~1 가로, v -1~1 앞뒤. +v = 멀리/앞). 빔 창 안으로 자동 클램프.
export const STEP_SEG = { BK_B2: 0.60, BK_B3: 1.44, BK_B4: 1.81, BK_B5: 3.10 };   // 각 단계가 보여주는 영상 구간 끝(초)
const SB_POSE = [
  { t: 0.00, L: [-0.75, -0.50], R: [0.75, -0.50] },                      // 시작 = 어깨너비보다 넓게 나란히(앞줄)
  { t: 0.60, L: [-0.75, -0.50], R: [0.75, -0.50] },                      // 1/4 무릎 굽혀 페이크 — 발은 그대로
  { t: 1.44, L: [-0.75, -0.50, 1], R: [0.34, 1.00] },                    // 2/4 오른발을 살짝 왼쪽 대각선 앞으로(유저) — 왼발은 앞볼 접지
  { t: 1.81, L: [-1.00, -0.90, 0, 'slide'], R: [0.34, 1.00] },           // 3/4 왼발이 왼쪽·뒤로 '쓰윽' 미끄러진다(스텝백)
  { t: 1.95, L: [-1.00, -0.90], R: [-0.25, -0.60] },                     // 4/4 오른발을 싹 끌어와 모음(0.14s — 유저: 더 빠르게)
  { t: 3.10, L: [-1.00, -0.90], R: [-0.25, -0.60] },                     //     그 자세로 슛까지 유지
];
// 판정 마크 프레임 = 빔 창 안 고정 영역. 어떤 단계·어떤 프레임에서도 이 밖으로 안 나간다.
const SB_BOX = { u: 0.80, v0: 0.14, v1: 0.62 };   // 앞뒤 폭을 넓혀 '앞으로 쭉' 내딛는 거리를 확보(유저)
const sbU = u => Math.max(-SB_BOX.u, Math.min(SB_BOX.u, u * SB_BOX.u));
const sbV = v => {
  const c = (SB_BOX.v0 + SB_BOX.v1) / 2, h = (SB_BOX.v1 - SB_BOX.v0) / 2;
  return Math.max(SB_BOX.v0, Math.min(SB_BOX.v1, c + v * h));
};
/** 영상 시각 vt의 두 발 상태. holdAirborne = 컷에서 아직 다 옮기지 않은 발은 이전 자리 유지 */
function sbPoseAt(vt, holdAirborne) {
  let i = 0;
  while (i < SB_POSE.length - 2 && SB_POSE[i + 1].t <= vt - 1e-6) i++;   // 컷과 키가 같은 시각이면 '도착한' 구간을 유지 — 안 그러면 착지 이벤트를 건너뛴다
  const a = SB_POSE[i], b = SB_POSE[i + 1];
  let f = Math.max(0, Math.min(1, (vt - a.t) / Math.max(0.01, b.t - a.t)));
  const one = (side) => {
    const p0 = a[side], p1 = b[side];
    const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const step = dist > 0.05;
    const slide = p1[3] === 'slide';   // 스텝백 = 바닥에 붙은 채 쓰윽 밀린다(들었다 놓는 스텝과 다름)
    let ff = f;
    if (step) {
      if (holdAirborne && ff > 0 && ff < 1) ff = 0;          // 아직 안 딛었으면 이전 자리
      else if (!slide) ff = Math.max(0, Math.min(1, (ff - 0.35) / 0.65));   // 구간 후반 65%에 몰아서 '확'
    }
    // 스텝 = 뗐다 → 빠르게 → 딱 멈춤 / 슬라이드 = 초반에 확 밀고 길게 감속(쓰윽)
    const ez = slide ? 1 - Math.pow(1 - ff, 2.6)
                     : (ff < 0.5 ? 2 * ff * ff : 1 - Math.pow(-2 * ff + 2, 2) / 2);
    return {
      u: sbU(p0[0] + (p1[0] - p0[0]) * ez), v: sbV(p0[1] + (p1[1] - p0[1]) * ez),
      tu: sbU(p1[0]), tv: sbV(p1[1]),
      toe: (ez < 0.5 ? (p0[2] || 0) : (p1[2] || 0)), slide,
      f: ez, dist, step, plantT: b.t, moving: step && ez > 0.001 && ez < 0.999,
    };
  };
  return { L: one('L'), R: one('R') };
}
const FOLLOW_S = 1.0;   // 따라하기 발자국 배율(농구 지면 UI 공통)

const BK_STR = {
  BK_A1: { per: 2.4, reps: BK_REPS.BK_A1, side: true, noMark: true, fm: '옆구리 스트레치', say: '팔을 위로 뻗어 옆으로 쭉쭉. 왼쪽 오른쪽 번갈아 허리를 늘려요.' },
  // BK_A2(니 드라이브)는 러닝 A3(하이니) 컴포넌트 전용 핸들러 — bkA2hk
  // BK_A3(스쿼트)는 러닝 A2 방식(관찰5초→따라하기 홀드필+카운트) 별도 핸들러 — bkSquat
};

export const STAGES = {
  running: [
    { id:'READY', label:'준비 — 발 두 번 구르면 시작', voice:['션','안녕! 션이에요. 오늘 가볍게 1킬로 뛰어볼까요? 발 두 번 구르면 시작!'], wear:'SAFE 대기', foot:'발 두 번 구르기 → 시작' },
    { id:'A1', label:'A · 준비운동 1/3 — 목·어깨 풀기', voice:['션','먼저 몸부터 깨울게요. 편하게 서서 목과 어깨를 크게, 천천히 돌려요. 링이 다 찰 때까지!'], wear:'개입 없음 (자세 측정)' },
    { id:'A2', label:'A · 준비운동 2/3 — 종아리 늘리기(앞무릎 굽히고 뒷다리 쭉)', voice:['션','좋아요! 앞무릎 굽히고 뒷다리 쭉, 종아리를 늘려요.'], foot:'앞으로 딛고 버티기 · 발 교대' },
    { id:'A3', label:'A · 준비운동 3/3 — 하이니(제자리 무릎 올리기)', voice:['션','마지막! 하이니예요.'], foot:'완료 후 두 번 구르기 → 다음' },
    { id:'T1', label:'몸풀기 끝 — 페이스 훈련 시작', voice:['션','몸이 다 풀렸네요, 최고예요! 이제 페이스를 끌어올리는 훈련 네 가지를 순서대로 해볼게요. 발 두 번 구르면 시작!'], foot:'발 두 번 구르기 → 훈련 시작' },
    // 페이스 향상 훈련법 4종 (GQ '페이스를 끌어올리는 방법' 편입) — 타이틀+설명으로 배우며 실전 전 몸에 익힘.
    // id는 P* 유지 = 메트로놈·판정 마크·페이스 게이트(/^P\d$/) 그대로 동작. 소리(메트로놈)+원형 마크 UI 공통.
    // phases = 훈련 구간 패턴(눈·귀로 진행이 보이게): n 라벨·c 케이던스배속·i 강도(0~1)·f 사이클 비중. loop=반복 횟수.
    { id:'P1', dur:11, live:true, label:'훈련 1 · 이지 런 — 편한 페이스로 몸 깨우기',
      desc:'대화할 수 있을 만큼 편안한 속도로 달려요. 본격 훈련 전 워밍업이자, 다음 강도를 위한 회복 러닝이에요.',
      voice:['션','먼저 이지 런이에요. 숨이 편안한 속도로 가볍게 — 제 박자에 발만 살살 맞춰요.'], wear:'낮은 강도 보조 시작',
      loop:1, phases:[{ n:'EASY', c:0.9, i:0.32, f:1, sec:180 }] },
    // 타이머 = 처방 초로 세팅 후 1초씩 감소(유저): phase의 sim 길이 = sec가 되도록 dur=Σsec, loop 1, f=sec/dur.
    { id:'P2', dur:14, live:true, label:'훈련 2 · 스트라이드 — 10초 가속 · 감속',
      desc:'80% 힘으로 10초간 시원하게 가속했다가 짧게 감속해요. 다리 회전 속도와 러닝 폼을 다듬는 훈련이에요.',
      voice:['션','스트라이드 갑니다! 10초만 경쾌하게 가속했다가 스르륵 풀어요. 발을 빠르게 굴리는 느낌!'], wear:'SAFE 착지 안정화',
      loop:1, phases:[{ n:'ACCELERATE', c:1.4, i:0.92, f:10/14, sec:10 }, { n:'DECELERATE', c:0.9, i:0.32, f:4/14, sec:4 }] },
    { id:'P3', dur:50, live:true, label:'훈련 3 · 인터벌 — 30초 전력 · 회복',
      desc:'짧고 강하게 달린 뒤 회복해요. 심폐 지구력과 스피드를 동시에 끌어올리는 핵심 훈련이에요.',
      voice:['션','인터벌이에요! 30초 전력으로 갔다가, 회복하며 숨 고르기 — 이 반복이 스피드를 만들어요.'], wear:'BOOST 추진 보조',
      loop:1, phases:[{ n:'SPRINT', c:1.55, i:1.0, f:30/50, sec:30 }, { n:'RECOVER', c:0.78, i:0.28, f:20/50, sec:20 }] },
    // 쓰레숄드(구 P4) 제거(유저: 전시에 너무 길고 지루). 훈련 = 이지런·스트라이드·인터벌 3종.
    { id:'T2', label:'훈련 끝 — 5초 뒤 실전 시작', voice:['션','훈련 완벽했어요! 이제 배운 걸로 진짜 달려볼게요. 5초 뒤 시작 — 준비되면 발 두 번, 가만히 있어도 제가 시작할게요.'], dur:5, count:true, foot:'두 번 구르기 = 바로 시작 · 가만히 있으면 자동' },
    { id:'C1', dur:3, label:'C · 실전 — 출발 카운트', voice:['션','갑니다 — 셋, 둘, 하나!'], hap:'시작 타이밍 진동', foot:'두 번 구르기 → 출발 (이후 잠금)' },
    { id:'C2', dur:7, live:true, label:'C · 실전 — 션과 나란히 달리기', voice:['션','좋아요, 그 박자 그대로! 제 옆에 딱 붙어서 같이 가요.'], wear:'SAFE 착지 안정화' },
    { id:'C3', dur:7, live:true, label:'C · 실전 — 흔들리면 다시 붙기', voice:['션','박자! 흔들려도 괜찮아요 — 저한테 다시 맞추면 돼요.'], hap:'착지 보조 2박' },
    { id:'C4', dur:7, live:true, boost:true, label:'C · 실전 — 마지막 1km 스퍼트', voice:['션','여기서부터 마지막 1킬로미터예요! 힘내요, 저만 보고 따라와요!'], wear:'BOOST 추진 보조 · 리듬 저하 시 강도↑', cue:'구간 종료 일치율 표시' },
    { id:'C5', live:true, cooldown:true, label:'C · 실전 — 천천히 멈추기', voice:['션','여기까지! 와, 오늘 정말 잘 달렸어요. 천천히 숨 고르면서 멈춰요.'], hap:'완료 진동' },
    { id:'FIN', label:'오늘의 리포트 · 쿨다운', voice:['션','오늘 기록은 앱으로 보내 뒀어요. 리포트 보는 동안 허벅지 앞을 잡고 천천히 풀어 주세요. 오늘 함께해서 즐거웠어요 — 다음에 또 같이 달려요!'], cue:'션 발자국 위에 내 착지 겹쳐 보기 · 쿼드 쿨다운' },
  ],
  basketball: [
    { id:'BK_READY', label:'0 · READY — 준비', voice:['시스템','커리의 핸들 팩. 준비되면 발을 두 번 탭하세요.'], wear:'SAFE 대기', foot:'두 번 탭 → 시작' },
    { id:'BK_A1', label:'A · 준비운동 1/3 — 몸풀기(옆구리)', voice:['커리','팔을 위로 뻗어 옆으로 쭉쭉 늘려요. 왼쪽 오른쪽 번갈아 — 허리부터 풀어요.'], wear:'개입 없음 (자세 측정)' },
    { id:'BK_A3', label:'A · 준비운동 2/3 — 스쿼트', voice:['커리','마지막! 천천히 앉았다 일어나요. 점프와 착지의 힘을 깨워요.'], wear:'낮은 강도 보조 시작' },
    { id:'BK_B1', label:'A · 준비운동 3/3 — 제자리 드리블', voice:['커리','공부터 손에 익혀요 — 무릎 굽히고 낮게, 열 번.'], cue:'낮은 자세 · 10회' },
    { id:'BK_T1', label:'T-1 · STAGE CLEAR → 사전 익히기', voice:['시스템','몸 풀렸어요. 탭 두 번이면 다음으로.'], foot:'두 번 탭 → 사전 익히기' },
    { id:'BK_B2', label:'B · 스텝백 1/4 — 무릎 구부려 공을 넣는 척', voice:['커리','무릎 구부리고 들어가는 척부터. 눈과 어깨로 레이업을 파세요.'], cue:'L·R 나란히 · 낮은 자세' },
    { id:'BK_B3', label:'B · 스텝백 2/4 — 오른발 딛고 드리블', voice:['커리','오른발을 딛으면서 공을 왼쪽으로 밀어요. 공 위치를 보세요.'], cue:'R 앞 · L 뒤 · 공은 왼쪽' },
    { id:'BK_B4', label:'B · 스텝백 3/4 — 왼발 뻗으며 공 잡기', voice:['커리','왼발을 크게 뻗으면서 두 손으로 공을 잡아요.'], cue:'L 크게 벌림 · 두 손 개더' },
    { id:'BK_B5', label:'B · 스텝백 4/4 — 오른발 모으며 슛 준비', voice:['커리','오른발을 모으고 그대로 올라가요 — 슛!'], cue:'L·R 모음 · 수직 상승', foot:'두 번 탭 → 실전 준비' },
    { id:'BK_T2', label:'T-2 · 5초 뒤 실전 자동 진행 (두 번 탭 = 바로)', voice:['커리','5초 뒤 넘어가요. 준비됐으면 두 번 탭.'], dur:5, count:true, foot:'두 번 탭 = 즉시 · 무입력 = 자동' },
    { id:'BK_C1', dur:3, label:'C · 실전 1/2 — 트리거', voice:['시스템','3, 2, 1. 실전 갑니다.'], hap:'컷 시작 진동', foot:'두 번 탭 → 출발' },
    { id:'BK_C2', dur:26, live:true, label:'C · 실전 2/2 — 스텝백 3점', voice:['커리','어디로 빠질지는 그때 알려줄게요. 착지하고 바로 올라가요 — 슛!'], wear:'BOOST 측면 추진', cue:'무작위 방향 ×3' },
    { id:'BK_FIN', label:'B-F · 리포트', voice:['시스템','리포트를 앱으로 보냈어요.'], cue:'Ghost Review — 커리 궤적과 내 스텝 겹쳐 보기' },
  ],
  boxing: [
    { id:'BX_READY', wall:true, label:'0 · READY — 가드·거리', voice:['시스템','섀도복싱 잽 팩. 가드 올리고 발을 두 번 탭하세요.'], wear:'SAFE 대기', foot:'두 번 탭 → 시작' },
    { id:'BX_A1', wall:true, label:'A · 준비운동 1/3 — 목·어깨 풀기', voice:['고수','목이랑 어깨 크게 돌려요. 천천히.'], wear:'개입 없음' },
    { id:'BX_A2', wall:true, label:'A · 준비운동 2/3 — 스텝 인·아웃', voice:['고수','앞뒤로 가볍게. 무게는 앞발에.'], hap:'스텝 박자 (약)' },
    { id:'BX_A3', wall:true, label:'A · 준비운동 3/3 — 잽 폼 가볍게', voice:['고수','어깨에서 뻗고 바로 회수. 가볍게 여섯 번.'], wear:'낮은 강도 보조 시작' },
    { id:'BX_T1', wall:true, label:'T-1 · STAGE CLEAR → 사전 익히기', voice:['시스템','몸 풀렸어요. 탭 두 번이면 다음으로.'], foot:'두 번 탭 → 사전 익히기' },
    { id:'BX_B1', wall:true, gate:true, label:'B · 사전 익히기 1/3 — 가드 유지', voice:['고수','가드 박스 안에 주먹 유지. 링이 찰 때까지.'], cue:'Hold Ring — 가드 존' },
    { id:'BX_B2', wall:true, gate:true, label:'B · 사전 익히기 2/3 — 회피 스텝', voice:['고수','머리를 좌우로 슬립. 존 밖으로 피해요.'], cue:'회피형 점선 존' },
    { id:'BX_B3', wall:true, gate:true, label:'B · 사전 익히기 3/3 — 잽 스윕', voice:['고수','스윕 따라 주먹 뻗고 타겟에 정렬.'], foot:'두 번 탭 → 실전 준비' },
    { id:'BX_T2', wall:true, label:'T-2 · 5초 뒤 실전 자동 진행 (두 번 탭 = 바로)', voice:['고수','5초 뒤 넘어가요. 준비됐으면 두 번 탭.'], dur:5, count:true, foot:'두 번 탭 = 즉시 · 무입력 = 자동' },
    { id:'BX_C1', wall:true, dur:3, label:'C · 실전 1/4 — 시작 신호', voice:['시스템','3, 2, 1. 대련 시작.'], hap:'시작 진동', foot:'두 번 탭 → 시작' },
    { id:'BX_C2', wall:true, dur:6, live:true, label:'C · 실전 2/4 — 잽 대련 라이브', voice:['고수','타겟 뜨면 바로 잽.'], wear:'SAFE 가드 안정화' },
    { id:'BX_C3', wall:true, dur:6, live:true, boost:true, label:'C · 실전 3/4 — 콤비네이션 (라이브·가속)', voice:['고수','잽-잽-훅! 리듬 놓치지 말고.'], wear:'BOOST 스텝 추진', cue:'구간 종료 Match Rate' },
    { id:'BX_C4', wall:true, live:true, cooldown:true, label:'C · 실전 4/4 — 마무리·정지', voice:['시스템','가드 내리고 숨 고르기. 좋았어요.'], hap:'완료 진동' },
    { id:'BX_FIN', wall:true, label:'B-F · 리포트', voice:['시스템','리포트를 앱으로 보냈어요.'], cue:'Ghost Review — 고수 잽과 내 폼 겹쳐 보기' },
  ],
};

export class Session {
  constructor(scene, tokens, xbot, rig, onStage) {
    deriveSessionPalette();   // 룩 LUT → 세션 히트 팔레트 (빌드 전에)
    this._CS = CS;   // 디버그 노출
    this.tokens = tokens; this.xbot = xbot; this.rig = rig; this.onStage = onStage;
    this.active = false; this.stageIdx = 0; this.t = 0; this.auto = false;
    this.sport = 'running'; this.stages = STAGES.running;
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.G = {}; this._lastCount = null;
    this.liveSpeed = 1;   // 실전 라이브 속도 배율 (BOOST/감속)
    this.bobY = 0;        // 박자 시점 바운스 (스트레칭·익히기)
    this._build();
  }
  get stage() { return this.stages[this.stageIdx].id; }
  get curStage() { return this.stages[this.stageIdx]; }
  get total() { return this.stages.length; }
  /** 실전 라이브 — 팩 재생이 실제로 돌아가는 단계 (데이터 필드 구동) */
  get isLive() { return !!this.stages[this.stageIdx].live; }
  _clip(o, wall = false) {
    const planes = wall ? this.tokens.wallClip : this.tokens.floorClip;
    if (!planes) return;
    o.traverse(x => { if (x.material) x.material.clippingPlanes = planes; });
  }
  /** 지면 토큰 소프트 페더 — 클리핑 평면은 백스톱으로 두고, 그 전에 알파가 0으로 스러지게 한다.
   *  (화살표만 페더였고 발마크·링·패널은 사각 프레임으로 뚝 잘렸음 — 유저 지적)
   *  핸들러가 매 프레임 새로 쓰는 값(_bb)과 우리가 쓴 값(_bw)을 구분해 곱이 누적되지 않게 한다. */
  /** 투사창 정규좌표 → 세션 로컬 좌표. u(-1~1)=가로, v(0~1)=근거리→원거리.
   *  창 밖으로 나가 토큰이 사라지던 사고를 끝내려고 만든 단일 규칙 — 모든 훈련 UI가 이걸 쓴다.
   *  실측(rig): near 0.3 / far 1.9 / 반폭 0.55~0.85, 세션 루트→월드 z 오프셋 -1.25 */
  // 빔 창 정규좌표(u -1~1, v 0=가까움~1=멂) → 주어진 참조 오브젝트와 같은 그룹의 로컬 좌표.
  //   그룹마다 부모 오프셋이 달라 로컬 z를 손으로 계산하면 창 밖으로 나간다(실측 fade 0.00).
  /** 스텝백 따라하기 배치 — 영상 재생 위치 그대로. 1/4~4/4가 이 한 함수를 쓴다.
   *  발마다 자기 리프트/플랜트 타이밍이라 왼발이 먼저 닿고 오른발이 뒤따른다(실측).
   *  뜬 발 = Locked 고스트 + 살짝 커짐(들린 느낌) · 닿는 순간 = 임팩트 팝 + 작은 파문(따닥).
   *  전부 '영상이 지금 어디냐'만 본다 = 시범. 유저 수행 판정(Success 블룸)은 별도다. */
  _sbPlace(H, id, fmL, fmR, arrows) {
    const seg = STEP_SEG[id] || 0;
    const raw = Math.max(0, this.stepVidT ?? 0);
    const vt = Math.min(seg, raw);
    // 단계 컷이 한 발의 체공 중간에서 끊긴다(2/4 컷 1.47s = 오른발이 딛는 순간, 왼발은 아직 공중).
    //   그 발은 '아직 옮기지 않은 발'이므로 마지막으로 딛었던 자리에 그대로 둔다 —
    //   공중에서 얼어붙은 고스트도, 다음 단계 자리로 미리 가버리는 것도 아니다(유저).
    const P = sbPoseAt(vt, raw >= seg - 1e-3);
    const key = '_sbP' + id;
    const st = H[key] || (H[key] = { L: -9, R: -9, pL: 0, pR: 0 });
    const one = (side, fm, ar) => {
      const q = P[side];
      fm.plane.rotation.z = 0;   // 스텝백 스탠스는 발이 평행(유저) — 기본 ±8° 벌림 해제
      const p = this._beamLocal(q.u, q.v, H.mL);
      // 착지 순간 래치 — 플랜트 시각을 지나면 1회 블룸 + 파문(따닥)
      // 영상이 되감겨 그 발이 다시 출발점으로 가면 래치를 푼다 — 안 그러면 파문이 첫 루프에만 뜬다.
      if (q.step && q.f < 0.2 && st[side] === q.plantT) { st[side] = -9; st['p' + side] = -9; }
      // Success = 그 발을 옮겨 지면에 닿은 순간(유저 정의). 그 자리에 작은 파문 1회.
      if (q.step && st[side] !== q.plantT && q.f >= 0.999) {
        st[side] = q.plantT; st['p' + side] = this.t;
        const wp = new THREE.Vector3(); fm.group.getWorldPosition(wp);
        this.onBurst?.(wp, 0.26, COLORS.success);   // PRISM = 성공 잔상 색
      }
      // ── 착지 물리 — '타닥' 두 박 ────────────────────────────────────────────
      //   ① 앞꿈치 접지 = 큰 팝(0.18s, 빠른 감쇠)  ② 뒤꿈치가 따라 내려앉는 작은 팝(0.10s 뒤 0.16s)
      //   여기에 착지 직전 6% 오버슈트 → 되돌아옴을 더해 체중이 실리는 느낌을 만든다. 전 단계 공통.
      const age = this.t - (st['p' + side] || -9);
      const pop1 = Math.max(0, 1 - age / 0.18), pop2 = Math.max(0, 1 - Math.abs(age - 0.10) / 0.16);
      const pop = Math.max(pop1, pop2 * 0.5);
      const landed = st[side] === q.plantT;   // 이 단계 목표에 이미 딛었나
      if (q.moving && q.slide) {
        // 슬라이드(스텝백) = 바닥에 붙은 채 밀린다 — 들리지 않으니 고스트로 바꾸지 않고,
        //   밀리는 동안만 살짝 흐려져 '쓰윽' 하는 잔상감을 준다.
        const spd = Math.max(0, 1 - q.f);
        fm.countdown(1); fm.op(0.70 + 0.25 * (1 - spd));
        fm.at(p.x, p.z, FOLLOW_S);
      } else if (q.moving) {
        // 이동 중 = 들린 발. 궤적 중간에서 가장 크고 흐리다(유리판 미끄러짐 방지).
        const air = Math.sin(Math.PI * q.f);
        const over = q.f > 0.85 ? (q.f - 0.85) / 0.15 * 0.06 : 0;   // 착지 직전 살짝 지나쳤다가
        fm.ghost(); fm.op(0.30 + 0.25 * (1 - air));
        const px = p.x + (q.tu - q.u) * over, pz = p.z + (q.tv - q.v) * over;
        fm.at(px, pz, FOLLOW_S * (1 + 0.08 * air));   // 체공은 아주 살짝만
      } else if (pop > 0) {
        fm.glow(1);   // 착지 = Success 블룸 (그 단계 목표라 흐려지지 않는다)
        fm.op(1); fm.at(p.x, p.z, FOLLOW_S);   // 착지 크기 변화 없음 — 한 번 더 구르는 걸로 읽힌다(유저)
      } else if (landed) {
        fm.glow(1); fm.op(1); fm.at(p.x, p.z, FOLLOW_S);   // 딛은 뒤 Success 유지 — 잔상처럼 흐려지지 않게 진행도 0 고정(유저)
      } else {
        fm.countdown(1); fm.op(0.95); fm.at(p.x, p.z, FOLLOW_S);
      }
      fm.toe(q.toe || 0);   // 앞꿈치 접지 구간이면 뒤꿈치가 스러진다
      // 화살표 = '그 발이' 갈 방향. 안 움직이는 발엔 절대 안 붙는다(유저: 왼발에 화살표 뜸).
      if (!ar) return;
      const du = q.tu - q.u, dv = q.tv - q.v;
      const settled = age > 0 && age < 1e6 ? age : 0;
      // 착지 후 2초가 지나면 다음 루프 예고로 다시 켠다(유저). 그 전에는 이동 중에만.
      const cue = q.step && (q.moving || (landed && settled > 2.0));
      if (!cue) { ar._gain = 0; return; }
      // 위치: 내딛는 스텝은 목표 지점 '앞쪽'(같은 좌우 라인).
      //   슬라이드(뒤로 빠지기)는 두 발 사이에서 빠질 방향을 가리킨다 — 미리 알려주는 큐(유저 지시).
      const other = side === 'L' ? P.R : P.L;
      // 슬라이드 큐는 고정이다 — 발을 따라 움직이면 화살표가 흔들려 읽기 어렵다(유저).
      //   기준점·방향 모두 '멈춰 있는 발 ↔ 목표'로만 계산해 한 방향으로 흐르기만 한다.
      const au = q.slide ? (other.u + q.tu) / 2 : q.tu;
      const av = q.slide ? (other.v + q.tv) / 2 : q.tv + 0.14;
      const pa = this._beamLocal(Math.max(-SB_BOX.u, Math.min(SB_BOX.u, au)),
                                Math.max(SB_BOX.v0, Math.min(SB_BOX.v1, av)), H.mL);
      ar.position.set(pa.x, 0.014, pa.z);
      ar.rotation.z = q.slide
        ? -Math.atan2(q.tu - other.u, q.tv - other.v)          // 고정 방향(멈춘 발 → 목표)
        : -Math.atan2(du, Math.max(0.001, dv));                // 이동 방향(주로 전진 = 0°)
      ar._gain = q.slide ? 0.75 : (q.moving ? 0.30 + 0.60 * (1 - q.f) : 0.55);   // 슬라이드 큐는 일정한 밝기로 흐른다
    };
    one('L', fmL, arrows[0]);
    one('R', fmR, arrows[1]);
    return P;
  }

  _beamLocal(u, v, ref) {
    const w = this.beamUV(u, v), rz = this.root?.position?.z ?? 0;
    const wp = new THREE.Vector3(); ref.getWorldPosition(wp);
    const g = ref.position || ref.group.position;
    return { x: w.x - (wp.x - g.x), z: (w.z + rz) - (wp.z - g.z) };
  }

  beamUV(u, v) {
    const r = this.rig, fp = r?._fp;
    if (!fp) return { x: u * 0.5, z: -2.0 - v * 1.2 };
    const M = 0.18;                                     // 가장자리 페더 여유
    const d = r.fpNear + M + (r.fpFar - r.fpNear - M * 2) * v;
    const half = r._halfAt(d) - M;
    // 월드 z를 세션 로컬로 되돌린다. 보정을 상수로 두면 창 밖으로 새므로(실측 dist 2.02)
    //   루트 위치를 빼서 매번 계산 — 이러면 어떤 스테이지에서도 창 안이 보장된다.
    const worldZ = fp.oz - d;
    const rootZ = this.root?.position.z ?? 0;
    return { x: fp.ox + u * half, z: worldZ - rootZ };
  }

  _beamFade(rig) {
    if (!rig?._fp) return;
    const g = this.G[this.stage];
    if (!g || !g.visible) return;
    const wp = this._bfWp || (this._bfWp = new THREE.Vector3());
    g.traverse(o => {
      const m = o.material;
      if (!o.isMesh || !m || Array.isArray(m)) return;
      const uf = m.uniforms && m.uniforms.uFade;
      if (!uf && !m.transparent) return;
      if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldPosition(wp);
      const sc = Math.max(Math.abs(o.matrixWorld.elements[0]), Math.abs(o.matrixWorld.elements[5]), Math.abs(o.matrixWorld.elements[10]));
      const pad = Math.min(0.5, (o.geometry?.boundingSphere?.radius ?? 0) * sc);
      const k = beamAlphaAt(rig, wp, pad);
      const cur = uf ? uf.value : m.opacity;
      if (o._bw == null || Math.abs(cur - o._bw) > 1e-4) o._bb = cur;   // 핸들러가 새로 쓴 값 = 기준
      const v = (o._bb ?? cur) * k;
      if (uf) uf.value = v; else m.opacity = v;
      o._bw = v;
    });
  }
  get _beamZOff() { return 1.25; }   // 세션 로컬 z → 월드 z 실측 보정(로컬 -3.5 = 월드 -4.75)

  _mk(id) { const g = new THREE.Group(); g.visible = false; this.root.add(g); this.G[id] = g; return g; }

  _build() {
    // 스테이지 카드 대지 (지면 1.8×1.9m): 아이브로(-2.98) → 타이틀(-2.68) → CTA·운동 존 → 푸터(-1.28) ⚠️ 빔 실측 한계 ~2.85m(무릎41cm·틸트8°): 존 위 헤더 밴드 불가 — 정보 설계 v3 논의 중
    // — 흩어진 좌표·극소 타이포를 UI 조판으로 (유저: 타이틀+보조+CTA/운동 영역 구조)
    this.slotFS = new THREE.Group(); this.slotFS.position.set(0, 0, -2.98);
    this.slotFL = new THREE.Group(); this.slotFL.position.set(0, 0, -2.68);
    this.slotFM = new THREE.Group(); this.slotFM.position.set(0, 0, -1.28);
    // 페이스 라이트 — 션의 현재 위치 지면 마커 (쫓기·동기). 내가 늦으면 멀어짐.
    this.paceLight = floorRing(0, -1.6, 0.19, 0.235, BRAND.red, 0.95);
    this.paceLight.visible = false;
    // 션 발자국 페이서 — "프로의 발자국을 그의 페이스로 따라 밟기". 추상 레인 폐기(정보값 0)하고
    //   ① 동기(프로 발자국 밟기·쫓기) + ② 페이스 학습(발자국 도착 리듬=케이던스, 간격=보폭)을 동시에.
    //   기존 디자인 토큰 FootMark(MARK 발형 셰이더) 재사용 — 좌/우 교대로 앞에서 켜지며 흘러옴.
    this.paceFeet = [];
    for (let i = 0; i < 6; i++) {
      const fm = new FootMark(i % 2 === 0 ? 'left' : 'right');
      fm.group.visible = false;
      this.paceFeet.push(fm);
      this.root.add(fm.group);
    }
    // 실전 페이스 레인 — 러너 앞으로 뻗는 밝은 광류(모든 라이브 스테이지 상설). '달리는 느낌'·판정 흐름 담당(유저 되돌림).
    this.paceLane = laneLine(BRAND.red, 0.4, -3.2);
    this.paceLane.material._gainK = 1.7;
    this.paceLane.visible = false;
    this.dirSlot = new THREE.Group();   // C 방향 피드백 글리프 (착지점 추종, _dirCue)
    this.root.add(this.slotFS, this.slotFL, this.slotFM, this.dirSlot, this.paceLight, this.paceLane);

    this.countGroup = new THREE.Group(); this.countGroup.position.set(0, 0, -1.1);
    this.countRing = floorRing(0, -1.1, 0.30, 0.335, BRAND.red, 0);
    this.root.add(this.countGroup, this.countRing);

    // 벽면 텍스트 슬롯 (복싱) — 세워진 평면, 유저 방향
    this.wSlotFS = new THREE.Group(); this.wSlotFS.position.set(-0.62, 1.72, WZ + 0.002);
    this.wSlotFL = new THREE.Group(); this.wSlotFL.position.set(0, 1.72, WZ + 0.002);
    this.wSlotFM = new THREE.Group(); this.wSlotFM.position.set(0, 0.55, WZ + 0.002);
    this.wCount = new THREE.Group(); this.wCount.position.set(0, 1.15, WZ + 0.004);
    this.root.add(this.wSlotFS, this.wSlotFL, this.wSlotFM, this.wCount);

    this._buildRunning();
    this._buildBasketball();
    this._buildBoxing();

    for (const id in this.G) this._clip(this.G[id], id.startsWith('BX_'));
    this._clip(this.countGroup);
  }

  _buildRunning() {
    let g = this._mk('READY');
    g.add(floorRing(0, -1.1, 0.20, 0.225, BRAND.dim, 0.9));
    this.tap = this._tap('running'); this.tap.position.set(0, 0.013, -1.1); g.add(this.tap);

    // A1~B4 발형/화살표 그래픽 z — "그래픽=가까운 존(눈앞~발앞), 타이틀=그 뒤(위)"
    // 원칙(유저 지적, 반대로 짰던 이전 시도 정정)에 맞춰 가까운 존(1.0~1.6m)으로 압축.
    // 원래 1.28~2.7m 대역을 상대 간격·순서 보존한 선형 압축(스케일 0.423)으로 이동 —
    // title(2.0m)·eyebrow(2.3m, FIGMA_CARD)보다 항상 0.4m+ 앞(가까움), footer(0.7m)
    // 보다는 0.3m+ 뒤(멂). CTA(1.1m, READY/T1 전용)와는 애초에 같은 스테이지에 안 나옴.
    g = this._mk('A1');
    // 목·어깨 풀기 — 마크·판정 토큰 없음(유저 확정): 중앙은 코치 실루엣 패널(main.js a1Coach) 단독.
    // 진행 표시는 플로어 프레임의 도트 로딩바 + FMU % 텍스트가 전담.

    g = this._mk('A2');
    // 런지 프레스 = 룩 시스템 발형(MARK 상태머신) — Hold 코닉 림(차오르는 라인) + 숫자 5→1 카운트
    // + 완료 Success 블룸(리퀴드). A안=앞발 바로 아래 추종 / B안=전방 고정 (a2Guide 토글).
    // 좌·우 발형(FootMark = 룩시스템 발형 SDF, A3와 동일 방식·사이즈) 나란히 지면 고정.
    // 상태 = countdown/setHold/glow/ghost로 Preview/Active/Hold/Success/Locked. 숫자는 발형 자식.
    // 전방 투사존 — 타이틀·도트(상단, 먼 z) 아래 열린 콘텐츠 존에 나란히 (겹침 방지)
    const fmL = new FootMark('left').at(-0.16, -1.15, 1.05), fmR = new FootMark('right').at(0.16, -1.15, 1.05);
    // 숫자 = 룩시스템 attachMarkNum(발 plane 자식·MARK_NUM 크기·numFoot 앵커) — 삐짐 없는 정본 이식
    const numL = attachMarkNum(fmL, '5', false), numR = attachMarkNum(fmR, '5', true);
    numL.visible = false; numR.visible = false;
    const a2cd = floorNum(0, 0, -1.35, 0.22); a2cd.visible = false;   // 시범→따라하기 3-2-1 카운트다운
    this.a2press = { fmL, fmR, numL, numR, cd: a2cd, fill: 0, _cnt: 5, _succ: 0, _succFM: null };
    g.add(fmL.group, fmR.group, a2cd);

    g = this._mk('A3');
    // High Knees 지면 가이드 = 두 질문에 답: (1)뭘 하나 (2)몇 개 했나.
    //   앞: 좌·우 발형(A2와 동일 언어)이 번갈아 켜짐 = "좌우 무릎 번갈아 올려"(템포·순서).
    //   뒤: 큰 중앙 숫자 = 누적 횟수(카운트업) + 감싸는 얇은 링이 30초 시계방향 진행.
    // 하이니 재설계(유저): 원형 은퇴 — 발형 2개(안에 각자 카운트) + LINE 리프트 화살표 + 양발 각 10회.
    const a3L = new FootMark('left').at(-0.17, -1.05, 1.05), a3R = new FootMark('right').at(0.17, -1.05, 1.05);
    const a3nL = attachMarkNum(a3L, '0', false), a3nR = attachMarkNum(a3R, '0', true);
    // 리프트 큐 = 발 '옆'에 캔버스 플레인(drawLiftCue 3안, FXP.a3Arrow 토글)
    const mkLift = (x) => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 256;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.34),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.014, -1.05); m.renderOrder = 7;
      m._g = c.getContext('2d'); m._tex = tex; return m;
    };
    const arL = mkLift(-0.46), arR = mkLift(0.46);
    // 4안(기본): 궤적 토큰 — 룩시스템 trajectory(잽 경로와 동일 정본). 코멧 prog = 실제 발 높이 직결.
    const mkTraj = (x, mirror) => {
      // 경로 = 발이 실제로 지나갈 길. 정지 위치(z -1.05)에서 정점(z -1.55)까지, 발자국 위를 지난다.
      //   예전엔 패널이 z -1.38이고 끝점이 '가까운 쪽'이라 prog=1에서 코멧이 마크와 반대편에 있었다
      //   (마크는 들리면 멀어지는데 코멧은 다가옴 — 유저: 궤적 토큰이 제대로 안 쓰였다).
      //   ctrl y = Δz / (0.42 × 패널크기) → 0.7m 패널에서 ±0.25m = ±0.85
      const m = primPanel('trajectory', 0.7, false);
      m.position.set(x, 0.017, -1.30);   // 정지(-1.05)와 정점(-1.55)의 중간
      m._prim.pts = [[0, 0.85], [mirror ? 0.22 : -0.22, 0], [0, -0.85]];
      m._prim.P = { width: 1.5, tail: 1.2, taper: 1.6 };
      m._prim.prog = 0;
      return m;
    };
    const tjL = mkTraj(-0.17, false), tjR = mkTraj(0.17, true);
    this.a3hk = {
      fmL: a3L, fmR: a3R, numL: a3nL, numR: a3nR, arL, arR, tjL, tjR,
      sec: 0, cntL: 0, cntR: 0, _prevLeft: undefined, _beat: 0, _pop: 0,
    };
    g.add(a3L.group, a3R.group, arL, arR, tjL, tjR);

    g = this._mk('T1');
    this.tap1 = this._tap('running'); this.tap1.position.set(0, 0.013, -1.1); g.add(this.tap1);

    // 페이스 잡기 — 정지 학습(구 B1~B4) 폐기. 러닝은 뛰면서 페이스로 익힌다.
    // 가이드 = 흐르는 페이스 레인 + 공유 paceLight + 페이서 봇(따라 달리기). 밟기 마크 아님.
    g = this._mk('P1');   // 페이스 레인은 션 발자국 페이서(_paceFeetTick)가 전담

    g = this._mk('P2');

    g = this._mk('C1');
    g.add(floorRing(0.03, -2.6, 0.15, 0.17, BRAND.red, 0.5));

    this._mk('C2');  // 라이브 — 팩 토큰이 그대로 흐름 (오버레이 없음)

    g = this._mk('C3');  // 라이브 + F-CUE 오버레이 (러너를 따라감)
    // c3cue '박자' 텍스트 은퇴(실전 무텍스트 — 유저): 흔들림 복귀는 페이스 라이트 거리·음성이 전달
    this.c3cue = new THREE.Group(); this.c3cue.userData = {};

    this._mk('C4');  // 라이브 — 션 발자국 페이서가 전담 (BOOST는 liveSpeed·음성으로)

    g = this._mk('C5');
    this.c5stripes = [];   // 가로선·STOP 링·STOP 텍스트(레거시 룩시스템) 제거(유저) — 쿨다운은 봇 감속+빛 이펙트만

    g = this._mk('FIN');
    // Ghost Review 실체화 — 션 발자국(무채 고스트) 위에 내 착지점(소형 존 원)을 오차 벡터만큼
    // 어긋나게 겹쳐 투사 (도식 격자 — 리뷰는 오차'만' 말한다). 데이터 = judge 최근 판정 4개.
    this.finGhost = []; this.finMine = [];
    for (let i = 0; i < 4; i++) {
      const fm = new FootMark(i % 2 ? 'right' : 'left');
      fm.ghost(); fm.op(0.75); g.add(fm.group); this.finGhost.push(fm);
      const r = floorRing(0, 0, 0.05, 0.062, BRAND.red, 0.9);
      g.add(r); this.finMine.push(r);
    }
    g.add(floorText('오늘의 러닝', 0, -1.7, { size: 0.11, color: CS.ink }));
    g.add(floorText('Pack 일치도 78% · 숙련 근접도 64% (+6%)', 0, -2.05, { size: 0.07, color: CS.dim }));
    g.add(floorText('후반 리듬 800m부터 흔들림', 0, -2.3, { size: 0.06, color: CS.mute }));
    g.add(floorText('다음: 사전 익히기 +1세트 · BOOST 타이밍 보정', 0, -2.55, { size: 0.06, color: CS.prism }));
  }

  _buildBasketball() {
    let g = this._mk('BK_READY');
    g.add(floorRing(0, -1.1, 0.20, 0.225, BRAND.dim, 0.9));
    this.bkTap = this._tap('boxing'); this.bkTap.position.set(0, 0.013, -1.1); g.add(this.bkTap);

    // A1 옆구리 = 마크 없이 코치 영상만(noMark) — ring/arc는 최소 생성(핸들러가 숨김).
    this.bkStretch = {};
    g = this._mk('BK_A1');
    { const ring = floorRing(0, -1.85, 0.20, 0.225, BRAND.red, 0.45); g.add(ring);
      const arc = floorArc(0, -1.85, BRAND.sand); g.add(arc);
      // 옆구리 = 좌우 리치 방향 큐(LINE ① 화살표·유저 SVG 촉). 굽히는 쪽으로 촉이 흐름.
      const arrow = floorArrow(0, -1.55, 90, BRAND.coral, 0.34); g.add(arrow);   // 짧게 — 길면 코치 몸을 가로지른다(유저)
      this.bkStretch['BK_A1'] = { ring, arc, arrow }; }
    // A2 니 드라이브 = 러닝 A3(하이니) 컴포넌트 그대로 이식 — 발형2+숫자+리프트큐+궤적토큰. 트위스트=코멧 크로스바디.
    g = this._mk('BK_A2');
    const k2L = new FootMark('left').at(-0.17, -1.85, FOLLOW_S), k2R = new FootMark('right').at(0.17, -1.85, FOLLOW_S);   // 투사존(-1.2~-2.8) 안
    const k2nL = attachMarkNum(k2L, '0', false), k2nR = attachMarkNum(k2R, '0', true);
    const mkLift2 = (x) => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 256;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.34),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.014, -1.85); m.renderOrder = 7;
      m._g = c.getContext('2d'); m._tex = tex; return m;
    };
    const ar2L = mkLift2(-0.46), ar2R = mkLift2(0.46);
    // 러닝 A3(하이니) 컴포넌트를 그대로 이식 — 발형2 + 각자 숫자 + 리프트 큐 + 궤적 토큰.
    //   자체 구현(트위스트·교차·출발원+스템)은 전량 폐기(유저 지시). z 기준만 농구 존(-1.85)으로.
    const mkTraj2 = (x, mirror) => {
      const m = primPanel('trajectory', 0.7, false);
      m.position.set(x, 0.017, -2.10);   // 정지(-1.85)와 정점(-2.35)의 중간 — 러닝 A3와 같은 규약
      m._prim.pts = [[0, 0.85], [mirror ? 0.22 : -0.22, 0], [0, -0.85]];
      m._prim.P = { width: 1.5, tail: 1.2, taper: 1.6 };
      m._prim.prog = 0;
      return m;
    };
    const tj2L = mkTraj2(-0.17, false), tj2R = mkTraj2(0.17, true);
    this.bkA2hk = { fmL: k2L, fmR: k2R, numL: k2nL, numR: k2nR, arL: ar2L, arR: ar2R, tjL: tj2L, tjR: tj2R,
      sec: 0, cntL: 0, cntR: 0, _lastLeft: undefined, _pop: 0 };
    g.add(k2L.group, k2R.group, ar2L, ar2R, tj2L, tj2R);
    // A3 스쿼트(유저 2안) = 발자국 없이 중앙 링 + 깊이 채움 아크 + 남은 횟수 카운트다운.
    //   발이 제자리 고정이라 발마크는 정보 없음 → 깊이·횟수에 집중.
    //   크기는 룩 시스템 원형 토큰 표준(0.20/0.225) 그대로 — 확대·깊이 펄스는 유저가 반려(흰 테두리 펄스).
    g = this._mk('BK_A3');
    const sqRing = floorRing(0, -1.85, 0.20, 0.225, BRAND.red, 0.45);
    const sqArc = floorArc(0, -1.85, BRAND.sand);   // 깊이 채움(표준 링 크기)
    const nc = document.createElement('canvas'); nc.width = nc.height = 128;   // 중앙 카운트다운 숫자
    const nmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    nmesh.material.map.colorSpace = THREE.SRGBColorSpace;
    nmesh.userData.canvas = nc; nmesh.userData.tex = nmesh.material.map;
    nmesh.rotation.x = -Math.PI / 2; nmesh.position.set(0, 0.015, -1.85); nmesh.renderOrder = 7;
    g.add(sqRing, sqArc, nmesh);
    this.bkSquat = { ring: sqRing, arc: sqArc, num: nmesh, count: 0, _wasDeep: false, _shown: -1 };

    g = this._mk('BK_T1');
    this.bkTap1 = this._tap('boxing'); this.bkTap1.position.set(0, 0.013, -1.1); g.add(this.bkTap1);

    // B1·B2 스텝 가이드 = 실측 접지 시퀀스 — 코치 클립(cmu_crossover_shot 06_14)에서 FK로
    // 발 접지(t,x,z,좌우)를 추출해 그대로 배치. 봇이 그 클립을 재생하므로 마크를 정의상
    // 정확히 밟고, 유저는 진짜 따라 밟을 수 있는 순서·위치·좌우발을 본다.
    // (모델 rotY π → world=(-x, BK_STAND-z), BK_STAND = 봇 후퇴 배치로 투사존 정합)
    g = this._mk('BK_B1');
    // B1 · 로우 드리블 — 유저 확정 프로세스: ①원형 마크 토큰에 맞춰 10회(바닥 보며) →
    //   ②중앙 안내 '시선은 바깥으로' → ③이후엔 UI 없음, 공 닿는 지점에 파형 이펙트만.
    //   발마크·비트바·라벨은 전부 은퇴(유저: 그래픽 후두둑·발모양 들락날락).
    const b1zone = floorRing(0, BK_STAND - 0.55 - BDEEP, 0.16, 0.20, BRAND.coral, 0.5);   // 원형 마크 — 중앙 정렬(유저)
    const b1c = document.createElement('canvas'); b1c.width = b1c.height = 128;              // 잔여 카운트 = 링 중앙
    const b1num = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.20),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(b1c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    b1num.material.map.colorSpace = THREE.SRGBColorSpace;
    b1num.userData.canvas = b1c; b1num.userData.tex = b1num.material.map;
    b1num.rotation.x = -Math.PI / 2; b1num.position.set(0, 0.016, BK_STAND - 0.55 - BDEEP); b1num.renderOrder = 8;
    // 셋업 막 발자국 — 어깨보다 넓게(0.56m, wikiHow 기본기). 4초간만 보였다 퇴장(상시 아님).
    const b1sL = new FootMark('left').at(-0.14, BK_STAND - 0.40 - BDEEP, FOLLOW_S);   // 모은 자세에서 시작 → 틱이 벌린다
    const b1sR = new FootMark('right').at(0.14, BK_STAND - 0.40 - BDEEP, FOLLOW_S);
    const b1aL = floorArrow(-0.20, BK_STAND - 0.40 - BDEEP, 90, BRAND.sand, 0.22);    // ← 룩 화살표(스템+SVG촉)
    const b1aR = floorArrow(0.20, BK_STAND - 0.40 - BDEEP, -90, BRAND.sand, 0.22);    // →
    b1aL._gain = 0; b1aR._gain = 0;
    this.bkB1 = { zone: b1zone, num: b1num, sL: b1sL, sR: b1sR, aL: b1aL, aR: b1aR,
      count: 0, _shown: -1, _wasLow: false, _popT: -9, _p2t: 0, _setupDone: false };
    g.add(b1zone, b1num, b1sL.group, b1sR.group, b1aL, b1aR);   // 지시문은 피그마 프레임 헤더가 담당(유저)

    g = this._mk('BK_B2');
    // B2 · 크로스오버 — 좌우 바운스 존 교대 점등. '공이 우리 평면에 닿는 지점'이 곧 커서라
    //   가림이 판정 신호가 된다(광학 검수 결론). 존 위치는 커리 실측 바운스 거리(0.44~0.83m) 안.
    // (측면 스텝백 Break Down — 레퍼런스 영상 콘 3개의 디지털 승격, 좌우 일렬)
    //   착지(좌 -0.55)·플랜트(중)·시작(우 +0.55) + 착지/시작 발자국 페어 + '내 발 커서'(근거리 행,
    //   발↔골반 상대 x 1:1 미러 — 빔은 발밑에 못 그리므로 커서로 '밟기'를 성립시킨다).
    const SBZ = -1.95;   // 월드 환산 z≈-3.2 = 빔 dist 1.0(창 중앙). -3.50은 월드 -4.75로 far 1.9를 넘어 사라졌다(실측)
    const sbm = (x, r) => floorRing(x, SBZ, r, r + 0.028, BRAND.coral, 0.18);
    const mL = sbm(-0.55, 0.13), mC = sbm(0, 0.10), mR = sbm(0.55, 0.13);
    const fp = (x, dz, foot) => new FootMark(foot).at(x, SBZ + dz, 0.62);
    const sL1 = fp(-0.69, 0.02, 'left'), sR1 = fp(-0.41, 0.02, 'right');   // 착지 페어(어깨너비)
    const sL2 = fp(0.41, 0.02, 'left'), sR2 = fp(0.69, 0.02, 'right');     // 시작 페어
    // 따라하기(1/4) 발자국 안 L·R 글리프 — 숫자 슬롯과 같은 규약(발이 기울면 같이 기운다)
    const sn2L = attachMarkNum(sL2, 'L', false), sn2R = attachMarkNum(sR2, 'R', true);
    const rise = floorRing(-0.55, SBZ, 0.21, 0.25, BRAND.red, 0);           // 상승 링(비트④=슛)
    const cL = new FootMark('left').at(-0.1, SBZ + 0.52, 0.42), cR = new FootMark('right').at(0.1, SBZ + 0.52, 0.42);
    cL.ghost(); cR.ghost();   // 커서 = Locked 고스트 톤(목표와 구분)
    // 따라하기(피그마 143:444) 전용 — 영상 아래 L·R 페어 양옆의 위아래 화살표.
    //   던질까 말까 망설이는 순간 = 마크가 들썩이고 ↓/↑가 번갈아 밝아진다.
    const b2aD = floorArrow(-0.60, SBZ + 0.45, 180, BRAND.sand, 0.30);
    const b2aU = floorArrow(0.60, SBZ + 0.45, 0, BRAND.sand, 0.30);
    b2aD._gain = 0; b2aU._gain = 0;
    this.bkB2x = { mL, mC, mR, sL1, sR1, sL2, sR2, numL: sn2L, numR: sn2R, rise, cL, cR, aD: b2aD, aU: b2aU,
      beat: 0, _dwell: 0, _beatT: 0, _popT: -9, _prevHy: 0 };
    g.add(mL, mC, mR, sL1.group, sR1.group, sL2.group, sR2.group, rise, cL.group, cR.group, b2aD, b2aU);

    // B3·B4·C2 = B2와 같은 레이아웃(공유 팩토리). 단계 차이는 속도·판정·마크 크기뿐.
    const buildStepback = (id, big) => {
      const gg = this._mk(id);
      const K = big ? 1.25 : 1;   // 정속·실전은 굵고 크게 — 주변시 인지(시선 정면 유도)
      const m = (x, r) => floorRing(x, SBZ, r * K, (r + 0.028) * K, BRAND.coral, 0.18);   // 얇은 림(러닝 판정 마크 규격)
      const H = { mL: m(0.03, 0.13), mC: m(0.36, 0.10), mR: m(0.02, 0.13),   // 링은 액센트(착지 중심·플랜트·시작 중심)
        rise: floorRing(-0.55, SBZ, 0.21 * K, 0.25 * K, BRAND.red, 0),
        gh: new FootMark('right').at(-0.55, SBZ, 0.62),   // 고스트 = 착지 오차 잔상
        beat: 0, _beatT: 0, _popT: -9, _prevHy: 0, count: 0, _side: -1, _ghT: -9 };
      H.gh.op(0);
      // 발자국 좌표 = 레퍼런스 영상 MediaPipe 실측(골반 기준 상대, 미터). 임의값 아님.
      //   측정: 67프레임 / 스텝백 1사이클. 발 수평속도로 접지 구간을 골라 좌표를 읽었다.
      //   시작 스탠스 L(-0.17) R(+0.22) 폭 0.39m → 착지 스탠스 L(-0.40) R(+0.46) 폭 0.86m
      //   플랜트(리드 발 최대 전개) R(+0.36). 깊이는 MP z를 씬 z로 부호 반전해 반영.
      const F = (x, dz, foot) => new FootMark(foot).at(x, SBZ + dz, 0.58 * K);
      // 4국면 대표 자세(영상 67프레임 실측, 골반 기준·미터. MP z는 씬 z로 부호 반전)
      //   ① 준비  L(-0.17,-0.05) R(+0.22,+0.06) 폭 0.39
      //   ② 플랜트 L(-0.09,-0.12) R(+0.33,-0.06) 폭 0.42   t=1.20s
      //   ③ 착지  L(-0.43,+0.09) R(+0.49,+0.32) 폭 0.92   t=1.87s ← 무브의 핵심
      //   ④ 리셋  L(-0.19,-0.12) R(+0.02,+0.18) 폭 0.21
      H.fRl = F(-0.17, 0.05, 'left');  H.fRr = F(0.22, -0.06, 'right');   // ① 준비 페어
      H.fC  = F(0.33, 0.06, 'right');                                      // ② 플랜트 리드 발
      H.fLl = F(-0.43, -0.09, 'left'); H.fLr = F(0.49, -0.32, 'right');   // ③ 착지 페어(폭 0.92)
      for (const k of ['fLl', 'fLr', 'fRl', 'fRr', 'fC']) { H[k].ghost(); H[k].op(0.10); }   // 대기 = Locked 고스트(crisp 실루엣)
      // 따라하기 페어 안 L·R 글리프 — 1/4과 같은 슬롯(숫자 규약). 표시는 따라하기에서만.
      H.numL = attachMarkNum(H.fRl, 'L', false); H.numR = attachMarkNum(H.fRr, 'R', true);
      H.numL.visible = false; H.numR.visible = false;
      // 이동 경로 화살표 — 발자국만으로는 '무슨 동작인지' 안 읽힌다(유저). 순서와 방향을 선으로.
      //   a1: 준비 → 플랜트(오른쪽으로 밀고 들어감) · a2: 플랜트 → 착지(반대로 크게 빠짐)
      H.a1 = floorArrow(0.28, SBZ + 0.02, -90, BRAND.prism, 0.26);
      H.a2 = floorArrow(-0.05, SBZ - 0.02, 90, BRAND.red, 0.62);
      H.a1._gain = 0; H.a2._gain = 0;
      gg.add(H.mL, H.mC, H.mR, H.rise, H.gh.group, H.a1, H.a2,
        H.fLl.group, H.fLr.group, H.fRl.group, H.fRr.group, H.fC.group);
      if (!big) {   // 훈련 단계만 커서 표시 — 실전은 시선 부담 최소화(유저 확정)
        H.cL = new FootMark('left').at(-0.1, SBZ + 0.52, 0.42);
        H.cR = new FootMark('right').at(0.1, SBZ + 0.52, 0.42);
        H.cL.ghost(); H.cR.ghost();
        gg.add(H.cL.group, H.cR.group);
      }
      return H;
    };
    this.bkB3x = buildStepback('BK_B3', false);
    this.bkB4x = buildStepback('BK_B4', true);
    this.bkB5x = buildStepback('BK_B5', false);
    this.bkC2x = buildStepback('BK_C2', true);

    g = this._mk('BK_T2');   // 카운트 공통(countGroup) 사용 — 별도 지오메트리 없음

    // 실전 라이브 — 무릎 빔프가 봇 컷을 따라 움직이며 팩 토큰 투사 (오버레이 최소)
    g = this._mk('BK_C1');
    g.add(floorRing(0.03, -2.4, 0.15, 0.17, BRAND.red, 0.5));

    g = this._mk('BK_C4');
    g.add(floorRing(0, -2.6, 0.20, 0.225, BRAND.dim, 0.9));
    g.add(floorText('SHOOT', 0, -2.6, { size: 0.09, color: CS.mute }));


    g = this._mk('BK_FIN');
    g.add(floorText('오늘의 스텝백', 0, -1.7, { size: 0.11, color: CS.ink }));
    g.add(floorText('Pack 일치도 74% · 숙련 근접도 58% (+5%)', 0, -2.05, { size: 0.07, color: CS.dim }));
    g.add(floorText('감속 타이밍 살짝 늦음', 0, -2.3, { size: 0.06, color: CS.mute }));
    g.add(floorText('다음: 스텝 분해 +1세트 · 릴리즈 밸런스', 0, -2.55, { size: 0.06, color: CS.prism }));
  }

  _buildBoxing() {
    // ── 좌표 기준: 인물(주황 전문가)이 벽 정중앙 (0, 1.4)에 서 있고, 실측 투사 결과 신체가
    //    세계 y ≈ 발 1.10 ~ 머리 1.75 (중심 ≈1.42)에 나타남. 토큰은 그 부위 존에 정렬 —
    //    머리≈1.74 · 어깨≈1.66 · 가드(주먹)≈1.60 · 가슴≈1.55 · 허리≈1.42 · 무릎≈1.28 · 발≈1.12,
    //    좌우 반폭 어깨±0.18·발 0·회피±0.26. (Phase 1: 정적 정렬. Phase 2 = x봇 관절 추종 이후.)
    //    방향성 동작은 룩 시스템 화살표(wallArrow)로 지시.
    const TX = 0, TY = 1.58;   // 잽 타겟 중심 (가슴~얼굴 앞)
    let g = this._mk('BX_READY');
    this.bxTap = wallTap();   // 미부착 — 원·발판·라벨 중복 제거 (HUD CTA 버튼 전담, 유저)

    // A1 목·어깨 돌리기 — 어깨 좌우 '회전 토큰'(관절 피벗 + 회전 화살표) = 돌리기 명확 지시
    g = this._mk('BX_A1');
    this.bxA1rotL = primPanel('rotate', 0.42, true); this.bxA1rotL.position.set(-0.2, 1.66, WZ + 0.004);
    this.bxA1rotL._prim.P = { dir: -1, r: 0.28 }; g.add(this.bxA1rotL);
    this.bxA1rotR = primPanel('rotate', 0.42, true); this.bxA1rotR.position.set( 0.2, 1.66, WZ + 0.004);
    this.bxA1rotR._prim.P = { dir: 1, r: 0.28 }; g.add(this.bxA1rotR);

    // A2 스텝 인·아웃 — 발밑 근/원 존 + 전진(위쪽) 방향 화살표(LINE 토큰)
    g = this._mk('BX_A2');
    this.bxA2near = wallRing(0, 1.12, 0.11, 0.13, BRAND.red, 0.4); g.add(this.bxA2near);
    this.bxA2far  = wallRing(0, 1.30, 0.11, 0.13, BRAND.red, 0.4); g.add(this.bxA2far);
    g.add(wallArrow(0, 1.10, 0.22, 0));   // 앞으로(in) — 발밑에서 위로

    // A3 잽 폼 — 어프로치 링(타겟+타이밍: 맞물릴 때 잽) + 잽 궤적 토큰(가드→타겟 뻗기, 진하게)
    g = this._mk('BX_A3');
    this.bxA3ap = primPanel('approachRing', 0.5, true);
    this.bxA3ap.position.set(TX, TY, WZ + 0.003);
    g.add(this.bxA3ap);
    this.bxA3jab = primPanel('trajectory', 1.05, true);
    this.bxA3jab.position.set(0, 1.46, WZ + 0.004);
    this.bxA3jab._prim.P = { width: 2.0 };   // 벽 투사용으로 진하게
    this.bxA3jab._prim.pts = [[-0.16, 0.82], [0, 0.08], [0.12, -0.74]];   // 가드(아래)→타겟(위) 뻗기
    g.add(this.bxA3jab);

    g = this._mk('BX_T1');
    this.bxTap1 = wallTap();   // 미부착 — HUD CTA 전담

    // B1 가드 유지 — 얼굴+주먹 가드 박스 + 홀드 링(채움)
    g = this._mk('BX_B1');
    g.add(guardBox(0, 1.62, 0.42, 0.36, BRAND.red, 0.8));
    this.bxHold = wallArc(0, 1.62, 0.17, 0.20, BRAND.sand, Math.PI/2, 0.001, 0); g.add(this.bxHold);

    // B2 회피 슬립 — 머리 좌우 회피 존(점선 계약) + 좌/우 슬립 화살표
    g = this._mk('BX_B2');
    this.bxDodgeL = wallRing(-0.26, 1.72, 0.12, 0.14, BRAND.coral, 0.95); g.add(this.bxDodgeL);
    this.bxDodgeR = wallRing( 0.26, 1.72, 0.12, 0.14, BRAND.coral, 0.95); g.add(this.bxDodgeR);
    this.bxDodgeL.material.uniforms.uContract.value = 1;
    this.bxDodgeR.material.uniforms.uContract.value = 1;
    g.add(wallArrow(-0.08, 1.72, 0.17, 90));    // 왼쪽 슬립
    g.add(wallArrow( 0.08, 1.72, 0.17, -90));   // 오른쪽 슬립

    // B3 잽 스윕 — 잽 궤적 토큰(스윕 아크) + 타겟 수축 링
    g = this._mk('BX_B3');
    this.bxB3jab = primPanel('trajectory', 1.2, true);
    this.bxB3jab.position.set(0, 1.46, WZ + 0.004);
    this.bxB3jab._prim.P = { width: 2.0 };   // 벽 투사용으로 진하게
    this.bxB3jab._prim.pts = [[-0.55, 0.5], [0, -0.18], [0.55, 0.5]];   // 잽 스윕 아크
    g.add(this.bxB3jab);
    this.bxB3ring = wallRing(TX, TY, 0.14, 0.16, BRAND.red, 0.8); g.add(this.bxB3ring);
    this.bxB3cd = wallRing(TX, TY, 0.14, 0.16, BRAND.prism, 0); g.add(this.bxB3cd);

    this._mk('BX_T2');

    g = this._mk('BX_C1');
    g.add(guardBox(0, 1.62, 0.42, 0.36, BRAND.red, 0.5));

    this._mk('BX_C2');   // 라이브 — 벽 타겟은 TokenSystem 팩 흐름이 전담 (어프로치 링은 라이브 타겟과 중복이라 제외)
    g = this._mk('BX_C3');   // 라이브 콤비 (가속) + 파생 ③ 펀치 라인 (콤보 연결·순서), 주먹 높이
    this.bxCombo = primPanel('punchLine', 0.9, true);
    this.bxCombo.position.set(0, 1.52, WZ + 0.002);
    g.add(this.bxCombo);

    g = this._mk('BX_C4');
    // '숨 고르기' 3D 텍스트 은퇴 — HUD 코너 아이덴티티가 전담 (EN 미번역 잔재 제거)

    g = this._mk('BX_FIN');   // 결과 화면 = 벽 HUD 세로 리포트 전담 (구 벽 텍스트 제거 — 중복)

    // 판정 토큰은 인물(demoPanel renderOrder 7) '앞'에 그려 부위 지시가 인물에 가리지 않게.
    // (인물 셰이더 depthWrite=false → 가림은 draw order = renderOrder로 결정)
    for (const id of ['BX_A1','BX_A2','BX_A3','BX_B1','BX_B2','BX_B3','BX_C1','BX_C3']) {
      this.G[id]?.traverse(o => { if (o.isMesh) o.renderOrder = 9; });
    }
  }

  _tap(sport) {
    // CTA 유닛 — 피그마 StageCard/베이스 cta 노드를 다운로드한 에셋이 있으면 그걸로, 없으면
    // 절차적 도트+라벨로 폴백(탭 = 입력 어포던스, 토큰 아님 — 기존 분류 유지)
    const g = new THREE.Group();
    const tex = ctaTexture(sport);
    if (tex) {
      const aspect = 150 / 44;   // 피그마 cta 노드 실측 비율
      const h = 0.30, w = h * aspect;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      g.add(plane); g.userData._ctaPlane = plane;
    } else {
      for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.072, 0.092, 36), flatMat(BRAND.prism, 0.95)); r.position.set((i - 0.5) * 0.24, 0.055, 0); g.add(r); }
      const label = makeTextPlane('TAP ×2', { size: 0.085, color: CS.prism, weight: 800 }); label.position.set(0, -0.13, 0.001); g.add(label);
    }
    g.rotation.x = -Math.PI / 2; g.position.y = 0.013; g.renderOrder = 7; g.userData.el = { type: 'tap' }; return g;
  }
  _setCount(n, color = CS.red) {
    while (this.countGroup.children.length) { const c = this.countGroup.children.pop(); c.traverse?.(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); }
    if (n == null) { this.countRing.setOp(0); return; }
    const m = floorNum(String(n), 0, 0, 0.34, color); this._clip(m); this.countGroup.add(m);
  }
  _slot(slot, text, opts) {
    while (slot.children.length) { const c = slot.children.pop(); c.traverse?.(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); }
    if (!text) return; const m = makeTextMesh(text, opts); this._clip(m); slot.add(m);
  }

  start(sport = 'running') {
    this.sport = STAGES[sport] ? sport : 'running';
    this.stages = STAGES[this.sport];
    this.active = true; this.stageIdx = 0; this.t = 0; this._missStreak = 0; this.root.visible = true; this._enter();
  }
  /** 에디터: 종목별 스테이지 배열 (편집 대상) */
  stagesFor(sport) { return STAGES[sport] || STAGES.running; }

  // ══ 장면 디자인 에디터 API ══════════════════════════════════
  // 전략: _build*가 만든 요소(userData.el 메타)를 그대로 두고, 패치(오버라이드)를
  // 객체에 직접 적용 — 무편집 시 픽셀 파리티 100%. 추가 요소는 spec으로 재생성.
  _isWallStage(id) { return id.startsWith('BX_'); }

  /** 세션 비활성 상태에서 특정 장면만 표시 (에디터 프리뷰) */
  previewStage(stageId) {
    this._previewId = stageId;
    this.root.visible = true;
    this.root.position.set(0, 0, 0);
    for (const id in this.G) this.G[id].visible = id === stageId;
    this.countGroup.visible = false; this.countRing.visible = false;
    // 편집 미리보기 = 클리핑 해제 — 정지 시점 풋프린트에 장면이 잘려 안 보이는 문제
    // (스튜디오 layoutPreview가 팩 토큰에 하는 것과 동일 원칙: 전체 형상을 보고 편집)
    this.G[stageId]?.traverse(m => {
      if (m.material && m.material.clippingPlanes) {
        m.userData._clipKeep = m.material.clippingPlanes;
        m.material.clippingPlanes = null;
      }
    });
  }
  endPreview() {
    this._previewId = null;
    // 클리핑 복원 — 실제 세션에선 투사 정직성(풋프린트 안에서만) 유지
    for (const id in this.G) this.G[id].traverse(m => {
      if (m.userData._clipKeep) { m.material.clippingPlanes = m.userData._clipKeep; delete m.userData._clipKeep; }
    });
    if (!this.active) { this.root.visible = false; for (const id in this.G) this.G[id].visible = false; }
  }

  /** 그룹 안 어디든 편집 가능한 텍스트(makeTextMesh)가 있으면 그 el을 찾아준다.
   *  세션 프롬프트(TAP ×2 등)는 텍스트를 자식으로 품은 복합 그룹이라 최상위 메타가 없다. */
  _findTextEl(o) {
    let found = null;
    o.traverse(c => { if (!found && c.userData?.el?.type === 'text' && c.userData?.redraw) found = c.userData.el; });
    return found;
  }

  /** 장면의 편집 가능 요소 목록: [{i, o, el}]. el.type이 UI 라벨·편집 분기를 결정한다. */
  sceneElements(stageId) {
    const g = this.G[stageId]; if (!g) return [];
    return g.children.map((o, i) => {
      let el = o.userData.el;
      if (!el) {
        const txt = this._findTextEl(o);
        if (txt) el = { type: 'text', content: txt.content, _proxy: true };   // 메타없는 그룹 속 텍스트
        else {
          // 정체불명 그룹 — 최소한 뭘로 이뤄졌는지 알려준다("그룹"만으론 알 수 없다는 피드백)
          const kinds = new Set();
          o.traverse(c => { if (c.userData?.el?.type) kinds.add(c.userData.el.type); });
          el = { type: o.isGroup ? 'group' : (o.isLine ? 'line' : 'mesh'), parts: [...kinds] };
        }
      }
      return { i, o, el };
    });
  }

  /** 요소 패치: {x,z,y,rot,scale,color,opacity,hidden, text:{content,size,color,weight,family}} */
  patchElement(stageId, idx, patch) {
    const g = this.G[stageId]; const o = g?.children[idx]; if (!o) return;
    const el = o.userData.el || {};
    if (!o.userData._orig) {
      // 재질 스냅샷 — 이게 없으면 '색·투명도 되돌리기'가 성립하지 않는다.
      // 첫 패치 시점에 잡으므로 applySceneStore(부팅 복원)보다 먼저 = 원본 그대로.
      const mats = [];
      o.traverse(m => { if (m.material) mats.push({ m, c: m.material.color?.getHex(), op: m.material.opacity, tr: m.material.transparent }); });
      o.userData._orig = {
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rz: o.rotation.z, s: o.scale.x, visible: o.visible,
        el: el.type === 'text' ? { ...el } : null,
        mats,
      };
    }
    const wall = !!el.wall || this._isWallStage(stageId);
    if (patch.x !== undefined) o.position.x = patch.x;
    if (wall) { if (patch.y !== undefined) o.position.y = patch.y; }
    else if (patch.z !== undefined) o.position.z = patch.z;
    if (patch.rot !== undefined) o.rotation.z = THREE.MathUtils.degToRad(patch.rot);
    if (patch.scale !== undefined) o.scale.setScalar(patch.scale);
    if (patch.hidden !== undefined) o.visible = !patch.hidden;
    if (patch.opacity !== undefined) {
      if (el.type === 'foot') { const p = o.children[0]; if (p?.material) p.material.opacity = patch.opacity; }
      else o.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = patch.opacity; } });
    }
    if (patch.color !== undefined && el.type !== 'text' && el.type !== 'foot')
      o.traverse(m => { if (m.material?.color) m.material.color.set(patch.color); });
    if (patch.text) {
      // 최상위 redraw(1급 텍스트) 우선, 없으면 그룹 안 텍스트 자식들을 갱신
      if (o.userData.redraw) o.userData.redraw(patch.text);
      else if (o.userData.plane?.userData.redraw) o.userData.plane.userData.redraw(patch.text);
      else o.traverse(c => { if (c !== o && c.userData?.redraw) c.userData.redraw(patch.text); });
    }
  }

  /** 원본 복원 (첫 패치 전 스냅샷으로) */
  resetElement(stageId, idx) {
    const o = this.G[stageId]?.children[idx]; const s = o?.userData._orig; if (!s) return;
    o.position.set(s.px, s.py, s.pz); o.rotation.z = s.rz; o.scale.setScalar(s.s); o.visible = s.visible;
    for (const r of s.mats || []) {
      if (r.c !== undefined) r.m.material.color?.setHex(r.c);
      r.m.material.opacity = r.op;
      r.m.material.transparent = r.tr;
    }
    if (s.el && (o.userData.redraw || o.userData.plane?.userData.redraw))
      (o.userData.redraw || o.userData.plane.userData.redraw)(s.el);
    o.userData._orig = null;
  }

  /** 요소 추가: spec={kind:'text'|'ring'|'arrow'|'foot', props} → 그룹 끝에 append */
  createElement(stageId, spec) {
    const g = this.G[stageId]; if (!g) return null;
    const wall = this._isWallStage(stageId);
    const p = spec.props || {};
    let o = null;
    if (spec.kind === 'text') {
      o = wall
        ? wallText(p.content || '텍스트', p.x ?? 0, p.y ?? 1.2, { size: p.size ?? 0.12, color: p.color || '#ffffff', weight: p.weight ?? 700, family: p.family })
        : floorText(p.content || '텍스트', p.x ?? 0, p.z ?? -1.8, { size: p.size ?? 0.12, color: p.color || '#ffffff', weight: p.weight ?? 700, family: p.family });
    } else if (spec.kind === 'ring') {
      o = wall ? wallRing(p.x ?? 0, p.y ?? 1.2, 0.15, 0.175, p.color || BRAND.red, 0.9)
               : floorRing(p.x ?? 0, p.z ?? -1.8, 0.15, 0.175, p.color || BRAND.red, 0.9);
    } else if (spec.kind === 'arrow' && !wall) {
      o = floorArrow(p.x ?? 0, p.z ?? -1.8, p.rot ?? 0, p.color || 0xfe6e3c, 0.4);
    } else if (spec.kind === 'foot' && !wall) {
      const fm = new FootMark(p.side || 'left').at(p.x ?? 0, p.z ?? -1.8);
      fm.op(0.95);
      o = fm.group;
    }
    if (!o) return null;
    o.userData.addedSpec = spec;
    g.add(o);
    this._clip(o, wall);
    return o;
  }

  removeElement(stageId, idx) {
    const g = this.G[stageId]; const o = g?.children[idx]; if (!o) return false;
    if (!o.userData.addedSpec) { this.patchElement(stageId, idx, { hidden: true }); return false; }   // 내장 요소=숨김
    g.remove(o);
    return true;
  }

  /** 저장된 오버라이드 전체 재적용 (부팅 시) — store={ [stageId]: {patches:{idx:patch}, added:[spec]} } */
  applySceneStore(store) {
    if (!store) return;
    for (const [id, st] of Object.entries(store)) {
      if (!this.G[id]) continue;
      for (const spec of st.added || []) this.createElement(id, spec);
      for (const [idx, patch] of Object.entries(st.patches || {})) this.patchElement(id, Number(idx), patch);
    }
  }
  /** 학습자 실력(0~1) — 게이트/다운시프트 구동 (판정 슬라이더와 동기) */
  setSkill(v) { this.skill = v; }
  get skill() { return this._skill ?? 0.7; }
  set skill(v) { this._skill = v; }
  _firstBIdx() { return this.stages.findIndex(s => /B1$/.test(s.id)); }
  /** 익히기 마지막 단계 종료 — 게이트: 실력 미달 시 T-2로 안 가고 익히기 반복 */
  _gateAdvance() {
    if (this.skill >= 0.6) { this.onGate?.('pass'); this.next(); }
    else {
      const i = this._firstBIdx();
      this.onGate?.('fail');
      if (i >= 0) { this.stageIdx = i; this.t = 0; this._enter(); } else this.next();
    }
  }
  /** 실전 다운시프트 — 폼이 연속으로 흔들리면(non-hit ×2) 익히기로 복귀 */
  reportVerdict(verdict, terr, best) {
    if (!this.active || !this.isLive) return;
    if (this.sport === 'basketball') return;   // 농구 판정(hips 프로브) 미보정 — 다운시프트 보류

    if (verdict !== 'hit' && best && this.sport === 'running') this._dirCue(terr, best);
    this._missStreak = verdict !== 'hit' ? this._missStreak + 1 : 0;
    if (this._missStreak >= 2) {
      this._missStreak = 0;
      const i = this._firstBIdx();
      if (i >= 0 && this.stageIdx > i) { this.onGate?.('downshift'); this.liveSpeed = 1; this.stageIdx = i; this.t = 0; this._enter(); }
    }
  }
  /** C 방향 피드백 — non-hit 착지점 앞에 왜 틀렸는지(빠름/늦음/위치) 글리프. GLYPH 잉크 토큰 소비. */
  _dirCue(terr, best) {
    if (this._dirT0 != null && this.t - this._dirT0 < 1.4) return;   // 과밀 방지
    this._dirT0 = this.t;
    const msg = terr > 0.03 ? '늦었어요' : terr < -0.03 ? '빨랐어요' : '간격';
    this._slot(this.dirSlot, msg, { size: 0.11, color: CS.sand, weight: 800 });
    // best.px/p2는 월드 좌표, dirSlot은 root 자식(라이브 중 러너 추종) — 로컬로 환산
    this.dirSlot.position.set(best.px - this.root.position.x, 0, best.p2 - 0.55 - this.root.position.z);
  }
  /** 팩 시그니처 파생 — 좌우폭 반치(스텝 마크 |nx| 평균 × X_SCALE 2.0). 팩 없으면 기본 0.17. */
  _packLaneHalf() {
    const evs = (this.tokens?.pack?.tokens || this.tokens?.pack?.events || []).filter(e => e.type === 'stepMark' && typeof e.nx === 'number');
    if (!evs.length) return 0.17;
    const m = evs.reduce((s, e) => s + Math.abs(e.nx), 0) / evs.length * 2.0;
    return Math.min(0.25, Math.max(0.03, m));
  }
  /** 팩 케이던스 파생 — 스텝 간격 중앙값(초). 범위 밖이면 폴백. */
  /** 단계 중간 음성 큐 — 스테이지당 1회 (같은 key 중복 발화 방지, _enter가 리셋) */
  _say(key, who, line) {
    if (!this._saidKeys) this._saidKeys = new Set();
    if (this._saidKeys.has(key)) return;
    this._saidKeys.add(key);
    this.say?.(who, line, 'say_' + key);   // 사전 생성 mp3(voice/say_<key>.mp3) — 브라우저 기계음 TTS 회피
  }
  /** 페이스 라이트 틱 — 최근 판정 3개의 평균 타이밍 오차를 거리(×팩속도 2.5m/s)로 번역 */
  _paceTick() {
    // 실전=연습 통일(유저): 화려한 광점·레인·발자국 페이서 전부 은퇴. P·C 모두 '흐르는 원형 판정
    // 마크 + 소리(메트로놈)'만으로. paceLight.position은 오차 추종 소스로만 유지(비가시).
    this.paceLight.visible = false;
    this.paceLane.visible = false;
    this.paceFeet.forEach(fm => fm.group.visible = false);
    const R = this.judge?.results || [];
    let err = 0;
    for (let i = Math.max(0, R.length - 3); i < R.length; i++) err += R[i].terr;
    err /= Math.min(3, Math.max(1, R.length));
    const z = -1.6 - Math.max(-0.5, Math.min(1.0, err * 2.5));
    this.paceLight.position.z += (z - this.paceLight.position.z) * 0.05;   // 부드러운 추종
    this._paceFeetTick(err);
  }

  /** 션 발자국 페이서 — 좌/우 발자국이 션의 스텝 간격으로 앞에 놓여 그의 속도로 흘러옴.
      '지금 밟아' 라인 근처에서 밝게 켜짐 → 도착 리듬=케이던스, 간격=보폭을 몸으로 익힘.
      투사면(fpFar) 안에만 상주 — 밖 그래픽 금지 원칙. err(페이스 오차)로 전체 온도(밝기) 조절. */
  _paceFeetTick(err = 0) {
    const feet = this.paceFeet; if (!feet.length) return;
    // 실전=연습 통일(유저): 션 발자국 페이서 은퇴 — P·C 모두 원형 판정 토큰+이펙트만.
    feet.forEach(fm => fm.group.visible = false); return;
    const stride = Math.max(0.55, this.tokens?._strideM || 0.98);   // 션 보폭(1스텝, m)
    const beat = Math.max(0.2, this.tokens?._beatT || 0.39);        // 션 스텝 간격(s) = 케이던스
    const speed = stride / beat;                                    // 션 속도(m/s)
    const far = Math.min(2.2, (this.rig?.fpFar ?? 2.2) - 0.1);      // 투사 안쪽 끝
    const zNear = 0.35, zFar = -far, span = zNear - zFar;
    const stepLine = -0.95;                                         // '지금 밟아' 라인 (밝기 정점)
    const N = Math.max(2, Math.min(feet.length, Math.floor(span / stride)));
    this._paceScroll = (this._paceScroll || 0) + (this._dt || 0.016) * (this.liveSpeed || 1) * speed;
    const warm = 1 - Math.min(0.7, Math.max(0, err) * 1.4);        // 처지면 식음(온도↓)
    for (let i = 0; i < feet.length; i++) {
      const fm = feet[i];
      if (i >= N) { fm.group.visible = false; continue; }
      const z = zFar + (((i * stride + this._paceScroll) % span) + span) % span;
      const g = Math.max(0, 1 - Math.abs(z - stepLine) / (stride * 0.7));   // 스텝라인서 최대
      fm.group.visible = true;
      // z는 러너(월드 원점) 기준 흐름 — root(팩 스크롤 추종)의 z를 상쇄해 이중 스크롤 방지, 션 속도만큼만.
      fm.group.position.set(i % 2 === 0 ? -0.12 : 0.12, 0.013, z - this.root.position.z);
      // 션 발자국: 멀리선 회색 예고(다가옴) → 스텝라인서 착지 블룸(진홍)으로 '지금 밟아' → 케이던스 리듬이 또렷.
      if (g > 0.42) fm.glow(g); else fm.ghost();
      fm.op((0.42 + 0.58 * g * g) * warm);   // 예고 발자국도 잘 보이게(줄지어 다가오는 게 읽히도록)
    }
  }
  _packBeat(mult = 1, fb = 0.6) {
    const b = this.tokens?._beatT;
    return (b > 0.2 && b < 1.5) ? b * mult : fb;
  }
  stop() { this.active = false; this.root.visible = false; this.tokens.root.visible = true; this.liveSpeed = 1; if (this.xbot) this.xbot.decelK = 0; this.bobY = 0; FXP.hideOrderNums = false; if (this._c3Skill != null && this.judge) { this.judge.skill = this._c3Skill; this._c3Skill = null; } }
  tapAdvance() {
    if (!this.active) return;
    if (!/FIN$/.test(this.stage)) this.next(true);   // 유저 탭 = 즉시 다음(음성 대기 무시)
  }
  // 자동 전환은 준비된 음성이 다 끝난 뒤에만 넘어감(voiceBusy=main.js 주입). 유저 탭(force)은 즉시.
  next(force = false) {
    // 음성 재생 중 = 보류(완료 조건 유지 → 다음 프레임 재시도). 단 무한 대기는 금지:
    // TTS가 'end'를 못 뱉으면(음소거·오디오 미허용·큐 적체) voiceBusy가 계속 true라 스테이지가
    // 영영 안 넘어간다 — 스쿼트가 0인데 안 넘어가던 근본(유저 실측: voiceBusy=true, next(true)는 즉시 전환).
    if (!force && this.voiceBusy?.()) {
      const now = performance.now();
      if (!this._waitStart) this._waitStart = now;
      if (now - this._waitStart < 2500) return;
    }
    this._waitStart = 0;
    if (this.active && this.stageIdx < this.stages.length - 1) { this.stageIdx++; this.t = 0; this._enter(); }
  }
  prev() { if (this.active && this.stageIdx > 0) { this.stageIdx--; this.t = 0; this._enter(); } }
  _next() { this.next(); }

  _enter() {
    const st = this.stages[this.stageIdx];
    this.onStage?.(st);
    this.tokens.root.visible = !!st.live;      // 라이브 = 실제 팩 토큰이 흐른다
    this.liveSpeed = st.boost ? 1.18 : 1;
    if (this.xbot) this.xbot.decelK = 0;   // C5 감속 잔재 제거 (다운시프트·FIN 진입 안전망)
    this._waitStart = 0;    // 음성 게이트 대기 타이머 리셋
    this.bkB1EyesUp = false; this.bkB1Setup = false; this.bkB1Succ = null; this.bkB1Widen = null; this.bkB1P2t = null; // B1 신호 리셋
    this._bkStrId = null;   // 워밍업 스트레칭 재진입 리셋 (스테이지 전환 시 홀드 카운트 0)
    this.repLeft = null; this.repTotal = null; this.repFrac = null;   // 반복 진행바 — 스테이지마다 초기화
    if (this._c3Skill != null && this.judge) { this.judge.skill = this._c3Skill; this._c3Skill = null; }   // C3 중 탭 스킵 시 skill 0.35 영구 잠김 방지
    this.bobY = 0;
    for (const id in this.G) this.G[id].visible = false;
    this.paceLight.visible = false;   // C 실전 틱(_paceTick)이 프레임마다 다시 켬
    this.paceLane.visible = false;
    this.paceFeet.forEach(fm => fm.group.visible = false);
    this._saidKeys?.clear();          // 단계 중간 음성 큐 리셋
    this._followLatch = false;        // 관찰→따라하기 래치 리셋(스테이지마다)
    this._aWatchEnd = undefined;      // 관찰 종료 시각(음성 끝) 리셋
    this._followT0 = null;            // 3-2-1 카운트다운 기준 시각 리셋
    this._a2cdShown = null;           // A2 카운트다운 표시 숫자 리셋
    this.demoActive = false;          // A 시범 구간 신호 (실사 클립 패널 소비)
    this._setCount(null); this._setCountWall(null);
    if (this.G[st.id]) this.G[st.id].visible = true;
    // FIN Ghost Review — 션 발자국 격자 + 내 착지점(판정 오차 벡터, ±30cm 클램프)
    if (st.id === 'FIN' && this.finGhost) {
      const R = (this.judge?.results || []).filter(r => r.surface === 'floor').slice(-4);
      this.finGhost.forEach((fm, i) => {
        const r = R[i];
        const on = !!r;
        fm.op(on ? 0.75 : 0);
        this.finMine[i].setOp(on ? 0.9 : 0);
        if (!on) return;
        const x = (r.foot === 'right' ? 1 : -1) * 0.13, z = -0.95 - i * 0.18;
        fm.group.position.set(x, 0.013, z);
        this.finMine[i].position.set(
          x + Math.max(-0.3, Math.min(0.3, r.dx)), 0.014,
          z + Math.max(-0.3, Math.min(0.3, r.dz)));
      });
    }
    this._lastCount = null;
    // 지면/벽 슬롯 전환
    const wall = !!st.wall;
    [this.slotFS, this.slotFL, this.slotFM].forEach(s => s.visible = !wall);
    [this.wSlotFS, this.wSlotFL, this.wSlotFM].forEach(s => s.visible = wall);

    if (wall) {
      const W = (slot, t, opts) => this._slotWall(slot, t, opts);
      const H = {
        S: W,
        FS: t => W(this.wSlotFS, t, { size: 0.05, color: CS.mute }),
        FL: t => W(this.wSlotFL, t, { size: 0.09, color: CS.ink }),
        FM: (t, c = CS.dim) => W(this.wSlotFM, t, { size: 0.06, color: c }),
      };
      H.FS(''); H.FL(''); H.FM('');
      if (st.count) this._setCountWall(5);
      this._enterBoxing(st, H);
    } else {
      const S = this._slot.bind(this);
      const H = {
        S,
        // 폰트는 피그마 StageCard/베이스와 실제 일치(임포트 파이프라인, 번들: public/fonts/)
        FS: t => S(this.slotFS, t, { size: (FXP.card?.eyeCap ?? 0.07), color: CS.mute, weight: 500, family: 'Supreme, sans-serif' }),   // 아이브로
        FL: t => S(this.slotFL, t, { size: (FXP.card?.titleCap ?? 0.17), color: CS.ink, weight: 700, family: 'Pretendard, sans-serif' }),  // 타이틀
        FM: (t, c = CS.dim) => S(this.slotFM, t, { size: (FXP.card?.footCap ?? 0.095), color: c }),      // 푸터·카운터
      };
      H.FS(''); H.FL(''); H.FM('');
      if (st.count) this._setCount(5);
      if (this.sport === 'basketball') this._enterBasketball(st, H);
      else this._enterRunning(st, H);
    }
    this._fmCache = null;
    this._slot(this.dirSlot, ''); this._dirT0 = null;   // 방향 큐는 스테이지 경계에서 정리
  }

  _slotWall(slot, text, opts) {
    while (slot.children.length) { const c = slot.children.pop(); c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose(); }
    if (!text) return;
    const p = makeTextPlane(text, opts); this._clip(p, true); slot.add(p);
  }
  _setCountWall(n, color = CS.red) {
    // 벽 카운트다운 = HUD 마일스톤(정중앙 대형)이 전담 — 3D 텍스트 플레인 중복 은퇴
    while (this.wCount.children.length) { const c = this.wCount.children.pop(); c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose(); }
  }

  _enterRunning(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'READY': FS('션 · 마지막 1KM'); FL('READY'); break;   // 푸터 제거: CTA 라벨과 중복 + CTA 근접 이동으로 겹침
      case 'A1': FS('준비운동 1/3'); FL('목·어깨 크게 천천히 돌리기'); FM('제자리에 서서 — 링이 찰 때까지', CS.sand); break;
      case 'A2': FS('준비운동 2/3'); FL('앞무릎 굽히고 뒷다리 쭉 — 종아리 늘리기'); FM('링이 차면 발 교대', CS.sand); break;
      case 'A3': FS('준비운동 3/3'); FL('무릎 좌우 번갈아 높이 올리기'); FM('켜지는 발 박자로 · 30초', CS.sand); break;
      case 'A4': FS('준비운동 4/4'); FL('켜지는 발자국 박자로 제자리 걷기'); FM('처음엔 천천히 — 점점 빨라져요'); break;
      case 'T1': FS('잠깐'); S(this.slotFL, '몸풀기 끝!', { size: 0.12, color: CS.prism }); break;   // 푸터 제거: CTA 라벨과 중복
      case 'B1': FS('미리 익히기 1/5'); FL('발은 가만히 — 박자만 들어요'); FM('귀로 먼저 배워요'); break;
      case 'BW': FS('미리 익히기 2/5'); FL('션이 달리는 발자국 — 보기만'); FM('찍히는 속도와 간격을 눈으로'); break;
      case 'B2': { const h = this._packLaneHalf(); this._b2Half = h; this.b2L.group.position.x = -h; this.b2R.group.position.x = h; FS('미리 익히기 3/5'); FL(h < 0.08 ? '반 보 앞 — 일자로 콕 밟기' : '링이 닫힐 때 — 발자국을 콕 밟기'); FM('맞춘 터치 0 / 8'); } break;
      case 'B3': FS('미리 익히기 4/5'); FL('1 → 2 → 3 순서로 세 걸음'); FM('세트 1 / 2'); break;
      case 'B4': FS('미리 익히기 5/5'); FL('박자만 보고 리듬 유지'); FM('링이 켜지는 순서대로'); break;
      case 'T2': FS('T-2'); FM('두 번 구르면 바로 · 가만히 있으면 자동'); break;
      // 실전(C) = 무텍스트(유저 확정): 음성+빛 언어(페이스 라이트·발자국·버스트)만. 예외 = C1 3·2·1 글리프.
      case 'C1': case 'C2': case 'C3': case 'C4': case 'C5': break;
      case 'FIN': FS('리포트'); break;
    }
  }

  _enterBasketball(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'BK_READY': FS('CURRY · STEP-BACK 3'); FL('READY'); break;
      case 'BK_A1': FS('WARM-UP 1/3'); FL('옆구리 스트레치 — 팔 뻗어 좌우로'); FM('허리 늘리기 · 번갈아', CS.sand); break;
      case 'BK_A2': FS('WARM-UP 2/3'); FL('니 드라이브 — 무릎↑ 반대손 터치'); FM('상체 비틀며', CS.sand); break;
      case 'BK_A3': FS('WARM-UP 3/3'); FL('스쿼트 — 천천히 앉았다 일어나기'); FM('무릎은 발끝 방향', CS.sand); break;
      case 'BK_T1': FS('T-1'); S(this.slotFL, 'STAGE CLEAR', { size: 0.12, color: CS.prism }); break;
      case 'BK_B1': FS('HANDLE 1/3'); FL('로우 드리블 — 낮게, 커리 리듬'); FM('발은 마크 위 · 10회'); break;
      case 'BK_B2': FS('HANDLE 2/3'); FL('크로스오버 — 켜진 존에 바운스'); FM('좌 ↔ 우 · 10회'); break;
      case 'BK_B3': FS('HANDLE 3/3'); FL('다리 사이 — 라인 통과 후 반대 존'); FM('통과 → 바운스 · 8회'); break;
      case 'BK_T2': FS('T-2'); FM('두 번 탭 = 바로 · 가만히 있으면 자동'); break;
      case 'BK_C1': FS('GAME 3·2·1'); break;
      case 'BK_C2': FS('CUT-IN · SAFE'); FM('수비 앞으로'); break;
      case 'BK_C3': S(this.slotFS, 'STEP-BACK · BOOST', { size: 0.055, color: CS.prism }); FM('뒤로 빼서 공간', CS.prism); break;
      case 'BK_C4': FS('RELEASE'); FM('밸런스 · 슛'); break;
      case 'BK_FIN': FS('REPORT'); break;
    }
  }

  _enterBoxing(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'BX_READY': FS('SHADOW · JAB'); FL('가드 올리고 READY'); FM('발 두 번 탭 → 시작'); break;
      case 'BX_A1': FS('WARM 1/3'); FL('목·어깨 돌리기'); FM('천천히 크게', CS.sand); break;
      case 'BX_A2': FS('WARM 2/3'); FL('스텝 인·아웃'); FM('앞뒤 6회', CS.sand); break;
      case 'BX_A3': FS('WARM 3/3'); FL('잽 폼 가볍게'); FM('뻗고 회수 6회'); break;
      case 'BX_T1': FS('T-1'); S(this.wSlotFL, 'STAGE CLEAR', { size: 0.11, color: CS.prism }); FM('탭 두 번 → 사전 익히기'); break;
      case 'BX_B1': FS('LEARN 1/3'); FL('가드 유지'); FM('가드 존 · 3초 유지'); break;
      case 'BX_B2': FS('LEARN 2/3'); FL('회피 슬립'); FM('점선 존 밖으로'); break;
      case 'BX_B3': FS('LEARN 3/3'); FL('잽 스윕'); FM('맞춘 잽 0 / 6'); break;
      case 'BX_T2': FS('T-2'); FM('두 번 탭 = 바로 · 가만히 있으면 자동'); break;
      case 'BX_C1': FS('SPAR 00:00'); break;
      case 'BX_C2': FS('SPAR · SAFE'); FM('타겟 뜨면 잽'); break;
      case 'BX_C3': S(this.wSlotFS, 'COMBO · BOOST', { size: 0.05, color: CS.prism }); break;
      case 'BX_C4': FS('COOL DOWN'); break;
      case 'BX_FIN': FS('REPORT'); break;
    }
  }

  /** 파동 링 시계 — 프리뷰(에디터)·세션 공통, main 루프가 매 프레임 호출 */
  tickWaves() {
    const t = performance.now() / 1000;
    const day = FXP.day ? 1 : 0;
    const MK = FXP.mark;   // 룩 시스템 MARK 슬라이더 — 팩 마커(tokens.js)와 동일하게 세션 재질도 라이브 소비
    const fp = this.rig?._fp;   // 투사면 프레임 — 마크 글로우를 경계 전에 소프트 페이드(레인과 동일)
    for (const m of WAVE_MATS) {
      const U = m.uniforms;
      U.uTime.value = t;
      U.uW.value = MK.core;
      U.uHalo.value = MK.halo;
      U.uPool.value = MK.pool;
      U.uSweepA.value = MK.sweep;
      U.uNoise.value = MK.wobble;
      if (fp && U.uFPNear && !m._wall) {   // 지면 마크만: 벽 마크는 기본 1e6(무효) 유지
        U.uFPOrigin.value.set(fp.ox, 0, fp.oz);
        U.uFPFwd.value.set(fp.fx, 0, fp.fz);
        U.uFPRight.value.set(fp.rx, 0, fp.rz);
        U.uFPNear.value = this.rig.fpNear;
        U.uFPFar.value = this.rig.fpFar;
        U.uFPHalfN.value = this.rig._halfAt(this.rig.fpNear);
        U.uFPHalfF.value = this.rig._halfAt(this.rig.fpFar);
      }
      if (m._auto) U.uProg.value = (t * 0.3) % 1;   // 구동자 없는 Hold = 시연 루프
      if (U.uDay.value !== day) {   // 주간 풀컬러 잉크 규약 (마커와 동일)
        U.uDay.value = day;
        m.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;
        m.needsUpdate = true;
      }
    }
    // 세션 레인·화살표·감속바 = LINE 토큰 라이브 소비 (시뮬 laneFX와 동일 규약)
    const A = FXP.arrow || {};
    const IDX = { solid: 0, dash: 1, dot: 2, chevron: 3, comet: 4, taper: 5 };
    const styleIdx = IDX[(FXP.lane && FXP.lane.style) || 'dash'] ?? 1;
    const arrowIdx = IDX[A.line || 'solid'] ?? 0;   // 화살표·감속바는 arrow 라인 스타일
    for (const m of LANE_MATS) {
      const U = m.uniforms;
      U.uTime.value = t;
      U.uLStyle.value = m._arrowStyle ? arrowIdx : styleIdx;
      U.uW.value = FXP.graphics.width * (A.w || 1);
      U.uHalo.value = FXP.graphics.halo * (A.glow ?? 1);
      U.uLSpeed.value = A.speed ?? 1;
      U.uLGap.value = A.gap ?? 1;
      U.uLHeat.value = A.heat ?? 0.5;
      U.uLTail.value = A.tail ?? 0.55;
      U.uGain.value = FXP.gainBoost * (m._gainK ?? 1);   // _gainK = 장면 강조/페이드 (허용 매개변수)
      if (fp && U.uFPNear) {   // 투사면 경계 소프트 페이드 — 페이스 레인이 투사영역 밖으로 뻗던 것(유저)
        U.uFPOrigin.value.set(fp.ox, 0, fp.oz);
        U.uFPFwd.value.set(fp.fx, 0, fp.fz);
        U.uFPRight.value.set(fp.rx, 0, fp.rz);
        U.uFPNear.value = this.rig.fpNear;
        U.uFPFar.value = this.rig.fpFar;
        U.uFPHalfN.value = this.rig._halfAt(this.rig.fpNear);
        U.uFPHalfF.value = this.rig._halfAt(this.rig.fpFar);
      }
      if (U.uDay.value !== day) {
        U.uDay.value = day;
        m.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;
        m.needsUpdate = true;
      }
    }
    tickFlowArrows(t, this.rig);   // 화살표(세션+팩) — 촉 이동 + 자루 LINE 유니폼 + 투사면 페이드 (단일 급이자)
    this._beamFade(this.rig);      // 나머지 지면 토큰(발마크·링·아크·패널)도 같은 페더로 — 사각 하드컷 제거
    tickPrims(t);        // 파생 프리미티브 — fx-core 정본 캔버스 (30Hz)
  }

  update(dt) {
    if (!this.active) return;
    this._dt = dt;   // 페이서 스크롤 등 dt 소비자용
    const st = this.stages[this.stageIdx]; this.t += dt; const id = st.id;
    const wall = !!st.wall;
    // 오버레이 좌표: 벽면(복싱)은 고정, 지면은 러너/컷을 따라감.
    // 비실전 단계(READY·스트레칭 등, !isLive)는 러너가 실제로 전진하지 않으므로 원점 고정.
    // tokens.floorRoot는 대기 루프의 loopShiftZ(무한 트랙 심리스 시프트)를 그대로 갖고 있어서
    // — 세션 시작 리셋 타이밍과 살짝 어긋나면 카드가 실제로 수십m 밖에 지어져 타이틀·아이브로
    // 글자가 화면상 훨씬 작게 보였음(유저 "1인칭 글자 작아보인다" 신고, 실측 각크기 24arcmin
    // 미만으로 확인). bodyZ와 동일하게 isLive로 게이팅해 비실전 단계엔 아예 안 건드림.
    const live = !wall && this.isLive;
    const bodyZ = live ? this.xbot.getBodyPos().z : 0;
    this.root.position.x = live ? this.tokens.floorRoot.position.x : 0;
    // 페이스·판정 마크는 러너에 앵커 = bodyZ(러너 월드 z). floorRoot.z(무한트랙 스크롤)를 더하면
    // 전진 이동을 이중 계산해 마크가 러너의 2배 거리(지평선 밖)에 남았음(유저: '저 멀리 마크 판정 토큰').
    this.root.position.z = live ? bodyZ : 0;
    // 투사 흔들림 → 세션 가이드: 저역통과(τ0.35s) 잔류만 — 하이니 무릎 스윙 같은 고주파는
    // 보정 알고리즘이 잡는다는 가정(유저: 가이드가 봇 동작 따라 춤추면 안 됨, 바닥 투사로 읽혀야).
    // 물리 정직성은 저주파 드리프트로 유지.
    if (this.rig?.shake) {
      if (!this._shk) this._shk = { x: 0, z: 0 };
      const aS = 1 - Math.exp(-(dt || 0.016) / 0.35);
      this._shk.x += (this.rig.shake.x - this._shk.x) * aS;
      this._shk.z += (this.rig.shake.y - this._shk.z) * aS;
      this.root.position.x = this._shk.x;
      this.root.position.z += this._shk.z;
    }
    // 스테이지 카드 조판 라이브 소비 (룩 '스테이지 카드' 슬라이더 — 위치는 즉시, 캡은 다음 텍스트 갱신 시)
    const CARD = FXP.card || {};
    // 헤더 밴드(타이틀+아이브로)는 빔 투사 풋프린트 안에만 상주 — 고정 z(2.0/2.3m)는 풋프린트가
    // 작으면(fpFar↓) 오렌지 밖 먼 존으로 떠 보였음(유저: "사람 위 둥둥"). 가장 먼 요소(아이브로)를
    // 끝단 안쪽으로 클램프하고 타이틀은 간격 유지하며 함께 당김. fpFar 크면 기존값 그대로.
    const eyeGap = CARD.eyebrow ?? 0.30;
    const far = this.rig?.fpFar ?? 3.0;
    const eyeZ = Math.min((CARD.titleZ ?? 2.68) + eyeGap, far - 0.10);
    this.slotFL.position.z = -(eyeZ - eyeGap);
    this.slotFS.position.z = -eyeZ;
    this.slotFM.position.z = -(CARD.footerZ ?? 1.28);
    // 타이틀·아이브로 페이드는 딱 3장면(B3·B4·C5)에만 — 실측 운동 요소가 타이틀 깊이(~2.68~2.98m)까지
    // 뻗어 물리적으로 자리가 겹치는 곳은 이 셋뿐(빔 도달 한계 ~2.85m 안에 둘 다 못 들어감).
    // 나머지 14장면은 겹칠 이유가 없는데 지시 자막을 없앨 이유도 없음 — 전체 페이드는 과했음(유저 지적).
    if (!wall && DENSE_STAGES.has(id)) {
      const titleFade = Math.max(0, 1 - Math.max(0, this.t - 1.0) / 0.6);
      const flMesh = this.slotFL.children[0]?.children[0], fsMesh = this.slotFS.children[0]?.children[0];
      if (flMesh?.material) flMesh.material.opacity = titleFade;
      if (fsMesh?.material) fsMesh.material.opacity = titleFade * 0.85;
    } else if (!wall) {
      const flMesh = this.slotFL.children[0]?.children[0], fsMesh = this.slotFS.children[0]?.children[0];
      if (flMesh?.material) flMesh.material.opacity = 1;
      if (fsMesh?.material) fsMesh.material.opacity = 0.85;
    }
    const ctaS = CARD.cta ?? 1;
    if (this.tap) this.tap.scale.setScalar(ctaS);
    if (this.tap1) this.tap1.scale.setScalar(ctaS);
    const beat = (per) => (this.t % per) / per;
    // 방향 피드백 글리프 페이드아웃 (1.2s)
    if (this._dirT0 != null) {
      const a = 1 - (this.t - this._dirT0) / 1.2;
      const m = this.dirSlot.children[0]?.userData?.plane?.material;
      if (m) m.opacity = Math.max(0, Math.min(1, a * 1.2));
      if (a <= 0) { this._slot(this.dirSlot, ''); this._dirT0 = null; }
    }
    // FM 슬롯 갱신 헬퍼 — 값이 바뀔 때만 텍스처 재생성 (벽/지면 자동)
    const FMU = (text, color) => {
      if (text === this._fmCache) return; this._fmCache = text;
      if (wall) this._slotWall(this.wSlotFM, text, { size: 0.06, color: color || CS.dim });
      else this._slot(this.slotFM, text, { size: 0.07, color: color || CS.dim });
    };

    // 공통: 카운트다운 스테이지(T2류) — 무입력 = 자동 진행 (무한 루프 없음)
    if (st.count) {
      const rem = Math.max(0, st.dur - this.t), n = Math.max(1, Math.ceil(rem));
      if (n !== this._lastCount) { wall ? this._setCountWall(n) : this._setCount(n); this._lastCount = n; }
      if (!wall) { const f = rem - Math.floor(rem); this.countRing.setOp(0.3 + 0.5 * f); this.countRing.scale.setScalar(0.8 + 0.6 * f); }
      this.bobY = 0;
      if (this.t >= st.dur) { this.next(); return; }
      return;
    }

    // 실전=연습 통일(유저): 러닝 P·C 모두 '흐르는 원형 판정 마크 + 소리(메트로놈)'로 동일.
    // 예전엔 C에서 마크를 숨기고 LiveUI 셰브론으로 대체 → 화려하고 안 예뻐서 은퇴. 이제 C도 마크 흐름.
    this.tokens.liveHideFloorMarks = false;
    // 러닝 라이브 = 순번 숫자 숨김(케이던스는 리듬이지 시퀀스가 아님 — 유저 확인)
    FXP.hideOrderNums = (this.sport === 'running' && !!st.live);
    // 러닝 라이브 = 중앙 레인 라인 제거 — 박자·마크에 집중(P·C 공통)
    this.tokens.liveHideLane = (this.sport === 'running' && !!st.live);
    if (this.sport === 'boxing') this._updateBoxing(id, st, beat, FMU);
    else if (this.sport === 'basketball') this._updateBasketball(id, st, beat, FMU);
    else this._updateRunning(id, st, beat, FMU);

    if (this.auto && st.dur && this.t >= st.dur && !st.count) this._next();
  }

  _updateRunning(id, st, beat, FMU) {
    // 박자 시점 바운스 — 몸이 살아있는 느낌 (라이브는 실제 모캡 눈이 담당)
    if (id[0] === 'A') this.bobY = 0.007 * Math.sin(this.t * 1.8);   // 호흡
    else this.bobY = 0;

    if (id === 'READY' || id === 'T1') {
      const tap = id === 'READY' ? this.tap : this.tap1; const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      if (tap.userData._ctaPlane) {
        tap.userData._ctaPlane.material.opacity = 0.75 + 0.25 * k;   // 피그마 CTA 에셋 — 통째로 맥동
      } else {
        tap.children[0].material.opacity = 0.5 + 0.45 * k; tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
      }
      if (id === 'T1' && this.t >= 4.5) { this.next(); return; }
    } else if (id === 'A1') {
      // 목·어깨 풀기 — 지면 프로브가 없는 상체 동작: 시간 홀드 아크(DUR 차면 완료).
      // 발폭 마크는 '제자리 고정' 지시 — 발이 마크를 벗어나면 아크 일시정지(자세 이탈 피드백).
      const DUR = 12, DEMO = 3.0;
      const dt = Math.max(0, this.t - (this._a1t ?? this.t));
      if ((this._a1t ?? 0) > this.t) this._a1fill = 0;   // 재진입 리셋
      this._a1t = this.t;
      const pb = this.xbot?.getProbes?.();
      const planted = pb && (pb.footL?.y ?? 1) < 0.12 && (pb.footR?.y ?? 1) < 0.12;
      this._a1fill = Math.min(1, (this._a1fill || 0) + (planted ? dt / DUR : 0));
      // 시각 진행바 = 플로어 프레임 도트 로딩바 전담 (A1 마크·판정 토큰 제거 — 유저 확정)
      if (this.t < DEMO) {
        this.demoActive = true;
        FMU('먼저 보세요 — 목과 어깨를 크게 천천히', CS.sand);
      } else {
        // 중간 재안내 음성 제거 — 진입 긴 문장 하나로 충분 (유저: '2번 나오는 거 제거')
        FMU(`목·어깨 풀기 ${Math.round((this._a1fill || 0) * 100)}%`, CS.sand);
        if ((this._a1fill || 0) >= 1) { this.next(); return; }
      }
    } else if (id === 'A2') {
      // 런지 — 앞의 원을 크게 딛어 밟고 버티면 홀드 아크가 차오름 (구 A1 프레스 문법).
      // 프로브 구동(왼/오른발 무관): 발이 접지 + 원 반경 안 = 버티는 중.
      const REPS = 2, DEMO = 4.6;   // 왼발 1 + 오른발 1 = 2회 (유저: 왜 2번씩? → 각 1회)
      const dt = Math.max(0, this.t - (this._a2t ?? this.t));
      if ((this._a2t ?? 0) > this.t) { this.a2count = 0; this.a2press.fill = 0; }   // 재진입 리셋
      this._a2t = this.t;
      const pb = this.xbot?.getProbes?.();
      const P = this.a2press;
      // ── 룩시스템 MARK 토큰 상태머신 (유저 스케치 흐름 그대로) ──
      //   Preview(둘 다) → 딛는 발 Active(뻗을때) → 밟는 순간 Hold+숫자 5→1(이펙트 점점 커짐)
      //   → 끝나면 Success → 반대발 되면 상태 바뀜, 대기발은 Locked.
      // 판정 = 봇 다리 상태(발 접지+런지 깊이)로만 구동 — 고정 마크와의 거리 게이트 없음.
      if ((this._a2t ?? 0) > this.t) { P._doneL = false; P._doneR = false; P.sec = 0; P._press = false; P._cnt = 5; P._repLatch = false; this.a2count = 0; }   // 재진입 리셋(a2count 미리셋=조기 전환 버그였음)
      // ── 발자국이 x봇 실제 발을 따라 런지처럼 이동 (고정 배치는 별로 — 유저 확정, 추적 복원) ──
      const CZ = -1.15, SC = 0.42;
      if (pb) {
        const fL = pb.footL, fR = pb.footR;
        const lft = fL.x <= fR.x ? fL : fR, rgt = fL.x <= fR.x ? fR : fL;
        const mz = (fL.z + fR.z) / 2;
        const tgt = (fm, baseX, f) => {
          const tx = baseX, tz = CZ + (f.z - mz) * SC;
          const g = fm.group; const a = 1 - Math.exp(-(dt || 0.016) / 0.08);
          g.position.x += (tx - g.position.x) * a; g.position.z += (tz - g.position.z) * a;
        };
        tgt(P.fmL, -0.16, lft); tgt(P.fmR, 0.16, rgt);
        P._frontLeft = lft.z < rgt.z;
      }
      // ── 홀드 = UI 기준 타이머(5초). x봇 사이클(main a2Cyc)에 직결 — 봇 멈춤 5s와 정확 동기 ──
      // (스프레드 측정은 노이즈(5.7/6.3/3.2s 불규칙)라 폐기 → 봇 사이클 prog 직결)
      const cyc = this.a2Cyc;
      const HOLD_SEC = cyc?.holdSec ?? 5;
      const isL = cyc ? cyc.isLeft : (P._frontLeft !== false);   // 첫 회차 왼발
      const inHold = !!cyc?.inHold;
      const act = isL ? P.fmL : P.fmR, oth = isL ? P.fmR : P.fmL;
      const actNum = isL ? P.numL : P.numR, othNum = isL ? P.numR : P.numL;
      const othDone = isL ? P._doneR : P._doneL;
      // 뉴턴 전환 문법: [시범 = 영상만·도트바] → [마크 Preview 워밍 등장 + '이제 같이' 음성] → [따라하기]
      P.cd.visible = false;
      if (!cyc || cyc.watching) {
        P.fmL.group.visible = false; P.fmR.group.visible = false; P.numL.visible = false; P.numR.visible = false;
        FMU('먼저 보세요', CS.prism);   // 진행표시 = 프레임 미니 타이머 링 전담
        this.demoActive = true;
        return;
      }
      this._say('a2follow', '션', '자, 이제 같이! 앞무릎 굽히고 뒷다리 쭉 펴서 버텨요.');
      P.fill = inHold ? cyc.prog : 0;   // 0→1 정확히 5초(봇 최심 정지 구간)
      placeMarkNum(P.numL); placeMarkNum(P.numR);
      P._pop = Math.max(0, (P._pop || 0) - dt * 3.8);
      P.fmL.group.visible = true; P.fmR.group.visible = true;   // 따라하기 = 마크 표시

      // 딛는 발: 둘 다 Active(빈 링). 홀드 중이면 같은 Hold 페이즈에서 uProg만 0→1 채워짐(부드러운 전환, 팝 없음)
      act.setHold(Math.max(0.02, P.fill));   // 0.02 = 빈 링(Active 모양) → prog 채움
      act.op(0.6 + 0.4 * P.fill);
      if (inHold) {
        const n = Math.max(1, Math.ceil(HOLD_SEC - P.fill * HOLD_SEC));   // 5→1 (UI 5초 타이머)
        if (n !== P._cnt) { redrawFootNum(actNum, n); P._cnt = n; P._pop = 1; }
        actNum.visible = true;
        actNum.scale.multiplyScalar(1 + 0.42 * P._pop);   // 숫자 전환 팝
      } else { actNum.visible = false; P._cnt = HOLD_SEC; }
      // 반대 발: 완료면 채움 유지, 아니면 Active 빈 링(둘 다 액티브 — 유저)
      oth.setHold(othDone ? 1 : 0.02); oth.op(othDone ? 0.5 : 0.6);
      othNum.visible = false;

      // 완료 = 홀드 100% 도달(회차당 1회 래치). 왼발 1·오른발 1 = 총 2회
      if (inHold && P.fill >= 0.995 && !P._repLatch) {
        P._repLatch = true; this.a2count = (this.a2count || 0) + 1;
        if (isL) P._doneL = true; else P._doneR = true;
        const wp = new THREE.Vector3(); act.group.getWorldPosition(wp); this.onPress?.(wp, false);
      }
      if (!inHold) P._repLatch = false;   // 다음 홀드 위해 래치 해제
      if (this.t < DEMO) {
        this.demoActive = true;
        FMU('먼저 보세요 — 앞으로 크게 딛고 버티기', CS.sand);
      } else {
        // 중간 재안내 제거 — 진입 문장 하나로 (유저: '목소리 2개 안 나오게')
        FMU(`런지 ${Math.min(REPS, this.a2count || 0)} / ${REPS}`, CS.sand);
        // 4회 완료 후에도 '서기 복귀'까지 대기 — 런지 자세 중 다음 단계로 튀지 않게 (유저)
        if ((this.a2count || 0) >= REPS) {
          const stand = pb?.footL && pb?.footR && Math.abs(pb.footL.z - pb.footR.z) < 0.18 && pb.footL.y < 0.09 && pb.footR.y < 0.09;
          if (stand) { this.next(); return; }
        }
      }
    } else if (id === 'A3') {
      // ── High Knees(재설계): 발형 2개(안에 각자 카운트) + LINE 리프트 화살표 + 양발 각 10회, 스피디 ──
      const PER_FOOT = 10, MAXSEC = 40;
      const H = this.a3hk;
      const dt = Math.max(0, this.t - (this._a3t ?? this.t));
      if ((this._a3t ?? 0) > this.t) { H.sec = 0; H.cntL = 0; H.cntR = 0; H._upL = false; H._upR = false; H._lastLeft = undefined; H._shownL = -1; H._shownR = -1; }
      this._a3t = this.t;

      const guide = [H.fmL.group, H.fmR.group, H.arL, H.arR, H.tjL, H.tjR];
      // 뉴턴 전환 문법: 시범(영상만) → 마크 워밍 등장 + '이제 같이' 음성 → 따라하기
      if (!this._followLatch) {
        for (const o of guide) o.visible = false;
        this.demoActive = true;
        FMU('먼저 보세요', CS.prism);
        return;
      }
      this._say('a3follow', '션', '자, 이제 같이! 무릎을 배 높이까지, 좌우 번갈아 올려요.');
      for (const o of guide) o.visible = true;
      placeMarkNum(H.numL); placeMarkNum(H.numR);
      H.sec = Math.min(MAXSEC, H.sec + dt);
      H._pop = Math.max(0, H._pop - dt * 5);
      // ── 안무(유저): 발 드는 순간 코멧이 '쉬잉' 마크로 활강(저역 τ0.13) → 무릎 정점(prog 0.88 돌파)
      //    딱 그 타이밍에 '팡'(카운트+블룸 팝+버스트). 1:1 하드 매핑 아님 — 부드러운 추종 + 정점 트리거.
      const pb = this.xbot?.getProbes?.();
      const lY = pb?.footL?.y ?? 0, rY = pb?.footR?.y ?? 0, TH = 0.12;
      const lUp = lY > TH, rUp = rY > TH;
      const aUp = 1 - Math.exp(-dt / 0.13);
      H._pL = (H._pL ?? 0) + (Math.min(1, lY / 0.30) - (H._pL ?? 0)) * aUp;
      H._pR = (H._pR ?? 0) + (Math.min(1, rY / 0.30) - (H._pR ?? 0)) * aUp;
      const apex = (isL2, p, prev, fm) => {
        if (p > 0.88 && prev <= 0.88) {   // 정점 도달 순간 = 팡
          if (isL2) H.cntL = Math.min(PER_FOOT, H.cntL + 1); else H.cntR = Math.min(PER_FOOT, H.cntR + 1);
          H._pop = 1; H._lastLeft = isL2;
          const wp = new THREE.Vector3(); fm.group.getWorldPosition(wp);
          this.onPress?.(wp, false);      // 룩시스템 버스트 팡
        }
      };
      apex(true, H._pL, H._prevPL ?? 0, H.fmL); apex(false, H._pR, H._prevPR ?? 0, H.fmR);
      H._prevPL = H._pL; H._prevPR = H._pR;
      // 발자국 '슈욱' 상승(유저): 실제 그 다리가 올라가면 그쪽 발형이 전방(시야상 위)으로 과감히
      // 활강 상승 + 살짝 커짐 — 무릎이 위로 올라간 뉘앙스. A2(정적 추적)보다 다이내믹, 저역이라 부드러움.
      H.fmL.group.position.z = -1.05 - 0.5 * H._pL;
      H.fmR.group.position.z = -1.05 - 0.5 * H._pR;
      H.fmL.group.scale.setScalar(1.05 * (1 + 0.16 * H._pL));
      H.fmR.group.scale.setScalar(1.05 * (1 + 0.16 * H._pR));
      const leftNow = lUp ? true : (rUp ? false : (H._lastLeft ?? true));   // 지금 올라간 발(없으면 마지막)
      const onFM = leftNow ? H.fmL : H.fmR, offFM = leftNow ? H.fmR : H.fmL;
      onFM.glow(0.6 + 0.4 * H._pop); onFM.op(1);
      offFM.ghost(); offFM.op(0.45);
      // 리프트 큐(발 옆) — 4안: 궤적 토큰(코멧 prog = 실제 발 높이) / 1~3안: 캔버스 큐 (FXP.a3Arrow)
      const st3 = FXP.a3Arrow || 4, useTraj = st3 === 4;
      H.arL.visible = !useTraj; H.arR.visible = !useTraj;
      H.tjL.visible = useTraj; H.tjR.visible = useTraj;
      if (useTraj) {
        // 룩 시스템 루프 그대로(prog=null) — 다만 두 궤적이 같은 전역 시계를 쓰면 좌우가 동시에
        //   움직인다(유저). 각 궤적에 t0(사이클 시작 시각)를 주고, '그 발이 올라가기 시작하는'
        //   순간 t0을 지금으로 찍어 사이클을 그 발 타이밍에 맞춰 다시 출발시킨다.
        H.tjL._prim.prog = null; H.tjR._prim.prog = null;
        tjTrigger(H, 'L', H._pL); tjTrigger(H, 'R', H._pR);
      } else {
        const nowT = performance.now() / 1000;
        if (nowT - (this._a3cueT || 0) > 1 / 30) {
          this._a3cueT = nowT;
          drawLiftCue(H.arL._g, st3, nowT, leftNow ? H._pop : 0.15); H.arL._tex.needsUpdate = true;
          drawLiftCue(H.arR._g, st3, nowT + 0.4, leftNow ? 0.15 : H._pop); H.arR._tex.needsUpdate = true;
        }
      }
      // 발 안 숫자 = 각자 카운트(1→10)
      if (H.cntL !== H._shownL) { redrawFootNum(H.numL, H.cntL); H._shownL = H.cntL; }
      if (H.cntR !== H._shownR) { redrawFootNum(H.numR, H.cntR); H._shownR = H.cntR; }
      H.numL.visible = true; H.numR.visible = true;
      FMU(`하이니 — 왼 ${H.cntL} · 오른 ${H.cntR} / ${PER_FOOT}`, CS.sand);
      if ((H.cntL >= PER_FOOT && H.cntR >= PER_FOOT) || H.sec >= MAXSEC) { this.next(); return; }
    } else if (id === 'P1' || id === 'P2') {
      // 페이스 잡기 — 뛰면서 페이스로 익힌다: 페이서 봇 + 흐르는 페이스 라이트에 리듬 맞추기.
      // (정지 학습 A4·B1~B4 폐기. 라이브 워밍업 런 = C 실전과 동일 머신 재사용.)
      this._paceTick();
      FMU(id === 'P1' ? '페이서에 붙어 — 이 리듬으로' : '페이스 잠금 — 곧 실전', CS.prism);
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'C1') {
      const n = Math.max(1, 3 - Math.floor(this.t)); if (n !== this._lastCount) { this._setCount(n, CS.ink); this._lastCount = n; }
      if (this.t >= st.dur) { this.next(); return; }   // 출발!
    } else if (id === 'C2') {
      this._paceTick();
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'C3') {
      // 흔들림 보정 시연 — 2.0~4.5s 구간 실력 하락 주입(진짜 miss 발생) → 페이스 라이트가
      // 멀어지고 음성·F-CUE 개입 → 복귀. 요소 추가 0, 판정·리포트에 정직하게 반영.
      const J = this.judge;
      if (J) {
        if (this._c3Skill == null) this._c3Skill = J.skill;
        const wobble = this.t >= 2.0 && this.t < 4.5;
        J.skill = wobble ? Math.min(this._c3Skill, 0.35) : this._c3Skill;
      }
      this._paceTick();
      if (this.c3cue.userData.plane) this.c3cue.userData.plane.material.opacity = (this.t % 1.4) < 1.0 ? 1 : 0;
      if (this.t >= st.dur) { if (J && this._c3Skill != null) { J.skill = this._c3Skill; this._c3Skill = null; } this.next(); return; }
    } else if (id === 'C4') {
      this._paceTick();
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'C5') {
      // 자연 감속 — 슬로모(liveSpeed) 대신 봇이 런→조깅→걷기로 크로스페이드하며 실제로 느려진다 (xbot.decelK)
      if (this.xbot) this.xbot.decelK = Math.min(1, this.t / 2.8);
      this.c5stripes.forEach((s, i) => { s.material._gainK = (0.7 - i * 0.13) * (0.5 + 0.5 * Math.sin(this.t * 3 - i)); });
      if (this.t > 4.0) { if (this.xbot) this.xbot.decelK = 0; this.stageIdx = this.stages.findIndex(s2 => s2.id === 'FIN'); this.t = 0; this._enter(); return; }
    }
  }

  _updateBasketball(id, st, beat, FMU) {
    // 박자 바운스
    if (id === 'BK_B2' || id === 'BK_C2') this.bobY = 0.026 * Math.abs(Math.sin(Math.PI * this.t / 0.7));
    else if (id === 'BK_C3') this.bobY = 0.022 * Math.abs(Math.sin(Math.PI * this.t / 0.55));
    else if (id[3] === 'A' || id[3] === 'B') this.bobY = 0.007 * Math.sin(this.t * 1.8);
    else this.bobY = 0;

    if (id === 'BK_READY' || id === 'BK_T1') {
      const tap = id === 'BK_READY' ? this.bkTap : this.bkTap1; const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      tap.children[0].material.opacity = 0.5 + 0.45 * k; tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
      if (id === 'BK_T1' && this.t >= 4.5) { this.next(); return; }
    } else if (id === 'BK_A3') {
      // 스쿼트(2안) = 발자국 없이 큰 중앙 링 + 깊이 채움 아크 + 중앙 큰 카운트 + 깊이 펄스(발 고정이라 발마크 무의미).
      const S = this.bkSquat;
      if ((this._bkStrT ?? 0) > this.t || this._bkStrId !== 'BK_A3') { S.count = 0; S._wasDeep = false; S._shown = -1; }   // 재진입 리셋
      this._bkStrT = this.t; this._bkStrId = 'BK_A3';
      const watching = !this._followLatch && this.t < A_WATCH;   // main.js A2_WATCH와 동기
      if (watching) {
        this.demoActive = true;                              // 코치 영상 시범 — 토큰 전부 숨김(코치+타이머만)
        S.ring.setOp(0); S.arc.visible = false; S.num.visible = false;
        FMU('먼저 보세요 — 스쿼트', CS.sand);
      } else {
        this._say('bksqgo', '커리', '이제 같이 — 천천히 앉았다 일어나요. 여섯 번.');
        S.arc.visible = true; S.num.visible = true;
        const hy = this.xbot?.getProbes?.()?.hips?.y ?? 1.0;
        const depth = Math.max(0, Math.min(1, (0.98 - hy) / (0.98 - 0.82)));   // 서기 0.98 ~ 바닥 0.82
        const deep = hy < 0.85;   // 검증된 스쿼트 바닥 임계(구 DOWN=0.85)
        S.arc.setProg(Math.max(0.001, depth));      // 깊이는 아크 채움만으로 — 링 밝기·크기 펄스는 유저 반려
        if (deep && !S._wasDeep) {   // 바닥 도달 순간 1회 카운트 + 보상 버스트
          S.count = (S.count || 0) + 1;
          S._spinT = this.t;         // 이펙트 터지는 순간 = 아크 한 바퀴 팡(유저)
          const wp = new THREE.Vector3(); S.ring.getWorldPosition(wp); this.onPress?.(wp, false);
        }
        S._wasDeep = deep;
        // 12시 시작은 토큰 셰이더가 이미 보장(fract(0.25 − ang/2π) = 12시 기준 시계방향).
        // 카운트 순간에만 한 바퀴 — 뒤로 갈수록 느려지는 감속(ease-out)으로 '팡' 하고 멎는다.
        const sp = Math.min(1, Math.max(0, (this.t - (S._spinT ?? -9)) / 0.42));
        S.arc.rotation.z = sp < 1 ? -2 * Math.PI * (1 - Math.pow(1 - sp, 3)) : 0;
        // 남은 횟수 카운트다운(6→0, 유저) — 숫자는 룩 SVG 글리프(drawNumber), 갱신 순간만 팝.
        const left = Math.max(0, BK_SQUAT_REPS - (S.count || 0));
        if (left !== S._shown) { redrawFootNum(S.num, left); S._shown = left; S._popT = this.t; }
        const pk = Math.min(1, Math.max(0, (this.t - (S._popT ?? -9)) / 0.26));
        S.num.scale.setScalar(1 + 0.5 * (1 - pk) * (1 - pk));
        this.repLeft = left; this.repTotal = BK_SQUAT_REPS;
        this.repFrac = Math.min(1, ((S.count || 0) + depth) / BK_SQUAT_REPS);   // 앉는 깊이만큼 연속으로 찬다
        FMU(`스쿼트 남은 ${left}회`, left === 0 ? CS.prism : CS.sand);
        if (left === 0 || this.t >= 32) { this.next(); return; }   // 안전장치: 32초 캡
      }
    } else if (id === 'BK_A2') {
      // 니 드라이브 = 러닝 A3(하이니) 컴포넌트 이식: 발높이 프로브→궤적 코멧→정점 카운트, 좌우 교대.
      //   트위스트 = 코멧 크로스바디(빌드 pts) + 올라간 발이 중앙으로 쏠림(x이동).
      const TOTAL = BK_REPS.BK_A2, MAXSEC = 36;   // 양발 합계(유저) — 남은 횟수 차감식
      const H = this.bkA2hk;
      const dt = Math.max(0, this.t - (this._bkA2t ?? this.t));
      if ((this._bkA2t ?? 0) > this.t) { H.sec = 0; H.cntL = 0; H.cntR = 0; H._lastLeft = undefined; H._shownL = -1; H._shownR = -1; H._pL = 0; H._pR = 0; }
      this._bkA2t = this.t;
      const guide = [H.fmL.group, H.fmR.group, H.arL, H.arR, H.tjL, H.tjR];
      if (!this._followLatch) {   // 관찰 5초 = 코치 영상만(가이드 전부 숨김)
        for (const o of guide) o.visible = false;
        this.demoActive = true;
        FMU('먼저 보세요 — 니 드라이브', CS.prism);
        return;
      }
      this._say('bka2go', '커리', '이제 같이 — 무릎 올리며 반대손으로 터치, 상체를 비틀어요.');
      for (const o of guide) o.visible = true;
      placeMarkNum(H.numL); placeMarkNum(H.numR);
      H.sec = Math.min(MAXSEC, H.sec + dt);
      H._pop = Math.max(0, H._pop - dt * 5);
      // ── 이하 러닝 A3(하이니) 로직 그대로 — 발높이 프로브 → 궤적 코멧 prog → 정점에서 팡 ──
      const pb = this.xbot?.getProbes?.();
      const lY = pb?.footL?.y ?? 0, rY = pb?.footR?.y ?? 0, TH = 0.12;
      const lUp = lY > TH, rUp = rY > TH;
      const aUp = 1 - Math.exp(-dt / 0.13);
      H._pL = (H._pL ?? 0) + (Math.min(1, lY / 0.30) - (H._pL ?? 0)) * aUp;
      H._pR = (H._pR ?? 0) + (Math.min(1, rY / 0.30) - (H._pR ?? 0)) * aUp;
      const apex = (isL2, p, prev, fm) => {
        if (p > 0.88 && prev <= 0.88) {
          if (isL2) H.cntL += 1; else H.cntR += 1;
          H._pop = 1; H._lastLeft = isL2;
          const wp = new THREE.Vector3(); fm.group.getWorldPosition(wp); this.onPress?.(wp, false);
        }
      };
      apex(true, H._pL, H._prevPL ?? 0, H.fmL); apex(false, H._pR, H._prevPR ?? 0, H.fmR);
      H._prevPL = H._pL; H._prevPR = H._pR;
      H.fmL.group.position.z = -1.85 - 0.5 * H._pL;
      H.fmR.group.position.z = -1.85 - 0.5 * H._pR;
      H.fmL.group.scale.setScalar(1.05 * (1 + 0.16 * H._pL));
      H.fmR.group.scale.setScalar(1.05 * (1 + 0.16 * H._pR));
      const leftNow = lUp ? true : (rUp ? false : (H._lastLeft ?? true));
      const onFM = leftNow ? H.fmL : H.fmR, offFM = leftNow ? H.fmR : H.fmL;
      onFM.glow(0.6 + 0.4 * H._pop); onFM.op(1);
      offFM.ghost(); offFM.op(0.45);
      const st3 = FXP.a3Arrow || 4, useTraj = st3 === 4;
      H.arL.visible = !useTraj; H.arR.visible = !useTraj;
      H.tjL.visible = useTraj; H.tjR.visible = useTraj;
      if (useTraj) {   // 룩 시스템 루프 그대로 + 발별 트리거 — 러닝 A3와 같은 규약
        H.tjL._prim.prog = null; H.tjR._prim.prog = null;
        tjTrigger(H, 'L', H._pL); tjTrigger(H, 'R', H._pR);
      } else {
        const nowT = performance.now() / 1000;
        if (nowT - (this._a3cueT || 0) > 1 / 30) {
          this._a3cueT = nowT;
          drawLiftCue(H.arL._g, st3, nowT, leftNow ? H._pop : 0.15); H.arL._tex.needsUpdate = true;
          drawLiftCue(H.arR._g, st3, nowT + 0.4, leftNow ? 0.15 : H._pop); H.arR._tex.needsUpdate = true;
        }
      }
      // 남은 횟수(양발 합계) 카운트다운 — 두 발 마크에 같은 숫자를 띄운다(지금 몇 번 남았는지 하나로 읽힘)
      const leftA2 = Math.max(0, TOTAL - (H.cntL + H.cntR));
      if (leftA2 !== H._shownL) { redrawFootNum(H.numL, leftA2); redrawFootNum(H.numR, leftA2); H._shownL = H._shownR = leftA2; }
      H.numL.visible = true; H.numR.visible = true;
      this.repLeft = leftA2; this.repTotal = TOTAL;   // 지면 UI 진행바 소비
      this.repFrac = Math.min(1, (H.cntL + H.cntR + Math.max(H._pL, H._pR)) / TOTAL);   // 발 높이만큼 연속
      FMU(`니 드라이브 — 남은 ${leftA2}회`, leftA2 === 0 ? CS.prism : CS.sand);
      if (leftA2 === 0 || H.sec >= MAXSEC) { this.next(); return; }
    } else if (BK_STR[id]) {
      // 워밍업 동적 3동작(비틀기·하이니·스쿼트). 코치 영상 상시 투사(COACH_CFG) + 지면 반복 카운트.
      const cfg = BK_STR[id], S = this.bkStretch[id];
      if ((this._bkStrT ?? 0) > this.t || this._bkStrId !== id) { S.count = 0; S.latch = -1; }   // 재진입/전환 리셋
      this._bkStrT = this.t; this._bkStrId = id;
      this.demoActive = true;
      if (cfg.watch && !this._followLatch && this.t < A_WATCH) {   // 관찰(코치+Preview 타이머만, 마크 숨김) → 따라하기
        S.ring.setOp(0); S.arc.visible = false;
        FMU('먼저 보세요 — ' + cfg.fm, CS.sand);
        return;
      }
      const t0 = cfg.watch ? (this._aWatchEnd ?? A_WATCH) : 0;   // 관찰형은 시범 종료 후부터 카운트
      const tt = Math.max(0, this.t - t0);
      const per = cfg.per, inRep = (tt % per) / per, rep = Math.floor(tt / per);
      if (cfg.noMark) {   // 옆구리 = 판정 링/아크 대신 좌우 방향 화살표(LINE) — 굽히는 쪽으로 촉이 흐름
        S.ring.setOp(0); S.arc.visible = false;
        // 타이밍 = 유저 지정 스케줄: 왼쪽 2초(그려진 뒤 다 채워진 상태로 멈춤) → 오른쪽 4초 → 반복.
        //   자유 루프(drawStemArrow 내부 ph)로 두면 좌우와 무관하게 계속 다시 그려져 '뚝뚝' 끊겨 보였다.
        //   _prog로 외부 구동하면 draw-on이 끝난 뒤 그 상태로 정지한다.
        const L_SEC = 2, R_SEC = 4, DRAW = 0.45;
        const cyc = (tt % (L_SEC + R_SEC));
        const isL = cyc < L_SEC;
        const local = isL ? cyc : cyc - L_SEC;
        if (S.arrow) {
          S.arrow.visible = true;
          S.arrow._prog = Math.min(1, local / DRAW);
          S.arrow.rotation.z = THREE.MathUtils.degToRad(isL ? 90 : -90);
          S.arrow.position.x = isL ? -0.10 : 0.10;   // 코치 영상에 더 붙게 안쪽으로(유저) — 다리 위는 여전히 안 가림
        }
        this.bkA1Side = isL;   // 텍스트·봇 미러가 화살표와 같은 소스를 쓰도록
      } else {
        S.arc.visible = true;
        S.arc.setProg(Math.max(0.001, inRep));                    // 한 동작 진행도
        S.ring.setOp(0.4 + 0.5 * Math.abs(Math.sin(Math.PI * inRep)));   // 박자 펄스
      }
      if (rep > S.latch) {   // 1회 완료 순간 = 접지 보상 버스트(마크 있을 때만)
        S.latch = rep; S.count = rep;
        if (rep > 0 && !cfg.noMark) { const wp = new THREE.Vector3(); S.ring.getWorldPosition(wp); this.onPress?.(wp, false); }
      }
      // 좌우 표시도 영상 실측 방향과 같은 소스로 (텍스트·화살표·봇 미러가 따로 놀지 않게)
      if (cfg.side) this.bkStrSide = this.bkA1Side != null ? this.bkA1Side : rep % 2 === 0;
      const sideTxt = cfg.side ? (this.bkStrSide ? '왼쪽 · ' : '오른쪽 · ') : '';
      const leftStr = Math.max(0, cfg.reps - S.count);
      this.repLeft = leftStr; this.repTotal = cfg.reps;
      this.repFrac = Math.min(1, (S.count + inRep) / cfg.reps);   // 진행바는 연속값 — 정수 회차만 쓰면 뚝뚝 끊긴다(유저)
      FMU(`${cfg.fm} · ${sideTxt}남은 ${leftStr}회`, leftStr === 0 ? CS.prism : CS.sand);
      if (S.count >= cfg.reps) { this.next(); return; }
    } else if (id === 'BK_B1') {
      // ① 원형 마크에 10회(바닥 보며) → ② 중앙 안내 '시선 바깥' → ③ 접점 파형만.
      const H = this.bkB1, TOTAL = 10, P2SEC = 8, MAXSEC = 45;
      if (this._bkStrId !== 'BK_B1') { H.count = 0; H._shown = -1; H._wasLow = false; H._popT = -9; H._p2t = 0; H._eyeK = 0; H._setupDone = false; }
      this._bkStrId = 'BK_B1';
      const dtB = Math.max(0, Math.min(0.1, this.t - (this._bkB1t ?? this.t)));
      this._bkB1t = this.t;
      if (!this._followLatch) {   // 관찰 5초 — 코치 실루엣+Preview 필만, 가이드 전부 숨김(유저: 훈련 전체)
        H.sL.op(0); H.sR.op(0); H.aL._gain = 0; H.aR._gain = 0;
        H.zone.setOp?.(0); H.num.material.opacity = 0;
        this.bkB1Setup = false; this.bkB1Succ = null; this.bkB1Widen = null;
        this.demoActive = true;
        FMU('먼저 보세요 — 로우 드리블', CS.prism);
        this.repLeft = null; this.repTotal = null;
        return;
      }
      const tB = this.t - (this._aWatchEnd ?? A_WATCH);   // 셋업 타임라인 = 관찰 종료 기준
      // 막0 · 스탠스 셋업(4초): 넓은 발자국 2개만 보여주고 밟게 한다 — 이후 퇴장(페이드)
      // 셋업 타임라인(유저·피그마 130-2984): 0~0.8 모은 자세 → 0.8~3.0 ←→ 화살표와 함께 벌어짐
      //   → 3.0 Success(마크 블룸+파형+피그마 배지) → 3~6 카운트다운 링 3·2·1 → 본 연습.
      const W_END = 3.0, SETUP = 6.0, inSetup = tB < SETUP;
      this.bkB1Setup = inSetup;
      const wk = tB < 0.8 ? 0 : Math.min(1, (tB - 0.8) / (W_END - 0.8));
      const we = wk * wk * (3 - 2 * wk);
      this.bkB1Widen = -0.25 + 1.40 * we;   // 봇: 모은 다리(-0.25) → 어깨너비+(1.15)
      const sK = Math.max(0, Math.min(1, (W_END + 1.2 - tB) / 0.9));   // Success 블룸 여운 후 퇴장
      H.sL.op(sK); H.sR.op(sK);
      if (inSetup) {
        const half = 0.14 + 0.14 * we;                    // 발자국도 실제로 벌어진다
        H.sL.group.position.x = -half; H.sR.group.position.x = half;
        // ← → 룩 화살표: draw-on 진행(_prog)을 '발자국이 실제 벌어지는 진행'에 직접 물린다(유저).
        //   벌어짐과 동시에 촉이 바깥으로 자라고, 끝나면 완성 상태로 잠깐 머물다 소등.
        const aOn = tB > 0.7 && tB < W_END + 0.5 ? 1 : 0;
        H.aL._gain = aOn; H.aR._gain = aOn;
        H.aL._prog = Math.max(0.15, we); H.aR._prog = Math.max(0.15, we);
        // 촉 끝이 빔 측면 페더를 넘으면 알파 0(실측 사고) — 짧은 화살표를 마크 바로 옆에.
        H.aL.position.x = -(half + 0.05); H.aR.position.x = half + 0.05;
        if (tB < W_END) {
          H.sL.countdown(this.t / W_END); H.sR.countdown(this.t / W_END);
          this._say('bkb1st', '커리', '발은 어깨보다 넓게 — 발자국 위에 서 볼까요. 무릎은 굽히고.');
          FMU('발은 어깨보다 넓게 — 발자국 위에', CS.sand);
          this.bkB1Succ = null;
        } else {
          if (!H._setupDone) {   // Success 전이: 블룸 + 접지 파형 + 피그마 배지 등장
            H._setupDone = true;
            H.sL.glow(1); H.sR.glow(1);
            const wp = new THREE.Vector3();
            H.sL.group.getWorldPosition(wp); this.onPress?.(wp.clone(), false);
            H.sR.group.getWorldPosition(wp); this.onPress?.(wp.clone(), false);
          }
          this.bkB1Succ = Math.max(1, Math.ceil(SETUP - tB));   // 3·2·1 (프레임 링)
          this.bkB1SuccFrac = Math.max(0, Math.min(1, (tB - W_END) / (SETUP - W_END)));
          FMU('Success! — 곧 시작해요', CS.prism);
        }
        this.repLeft = null; this.repTotal = null;
        H.zone.setOp?.(0); H.num.material.opacity = 0;
        return;
      }
      this.bkB1Succ = null;
      H.aL._gain = 0; H.aR._gain = 0;
      const phase2 = H.count >= TOTAL;
      H._eyeK = Math.max(0, Math.min(1, (H._eyeK ?? 0) + (phase2 ? dtB : -dtB) * 1.6));
      const vK = 1 - H._eyeK;
      this.bkB1EyesUp = phase2;   // main: 봇 고개 정면 + 메트로놈
      this.bkB1P2t = phase2 ? H._p2t : null;   // main: 봇 연출(정지→재개) 타이밍 소스
      if (phase2) {
        H._p2t += dtB;
        this._say('bkb1up', '커리', '좋아요 — 이제 시선은 앞으로. 공은 안 봐도 돼요, 리듬만.');
      }
      // 바운스 검출 — 공 y 최저 통과. ①에선 카운트+링 펄스, ②에선 접점 파형만.
      const ball = this.xbot?.ball;
      const isLow = !!ball?.visible && ball.position.y < 0.20;
      if (isLow && !H._wasLow) {
        // 광학 정직성(유저 지적): 실측 바운스(몸앞 0.44~0.83m)의 절반은 빔 시작선(0.65m) 안쪽 —
        //   접점 파형은 투사 불가능한 거짓말이다. ① 파형은 '존 위치'(빔 안 1.3m, 시선도 거기)에서.
        //   ③(시선 바깥)은 바닥 이펙트 전면 제거 — 주변시는 작은 파형을 못 보고, 피드백은 메트로놈이 전담.
        H._zHit = this.t;
        if (!phase2) {
          H.count += 1; H._popT = this.t;
          const wp = new THREE.Vector3(); H.zone.getWorldPosition(wp); this.onPress?.(wp, false);
        }
      }
      H._wasLow = isLow;
      // 원형 판정 토큰: 평소 Preview(숨쉬기) → 공이 탕 떨어지는 순간 Success 블룸으로 전이(유저)
      const zU = H.zone.material.uniforms;
      const zk = Math.max(0, 1 - (this.t - (H._zHit ?? -9)) / 0.45);
      if (zk > 0) { zU.uPhase.value = 2; zU.uProg.value = Math.min(1, 1.2 - zk); }
      else { zU.uPhase.value = 0; zU.uProg.value = 0; }
      H.zone.setOp?.((0.45 + 0.4 * zk) * vK);
      const left1 = Math.max(0, TOTAL - H.count);
      if (left1 !== H._shown) { redrawFootNum(H.num, left1); H._shown = left1; }
      H.num.material.opacity = vK;
      this.repLeft = left1; this.repTotal = TOTAL;
      this.repFrac = phase2 ? Math.min(1, (TOTAL + H._p2t / P2SEC * 2) / (TOTAL + 2)) : Math.min(1, H.count / TOTAL);
      FMU(phase2 ? '시선은 바깥으로 — 리듬만 유지' : `원형 마크에 맞춰 튕겨요 — 남은 ${left1}회`, phase2 ? CS.prism : CS.sand);
      if (H._p2t >= P2SEC || this.t >= MAXSEC) { this.next(); return; }
    } else if (id === 'BK_B2') {
      // B2 · 측면 스텝백 Break Down — 비트별 정지 학습. 커서(발 미러)가 마크에 머물면 다음 비트.
      //   ①시작(우) ②플랜트(중) ③착지(좌, 어깨너비) ④슛(상승 링) = 1세트로 종료.
      const H = this.bkB2x, MAXSEC = 60;
      if (this._bkStrId !== 'BK_B2') { H.beat = 0; H._dwell = 0; H._beatT = this.t; H._popT = -9; }
      this._bkStrId = 'BK_B2';
      // 화살표는 관찰(프리뷰) 때도 뜬다 — 첫 진입에서만 안 보이던 원인이 여기(_gain이 따라하기
      //   분기에서만 세팅돼 초기값 0. 재진입 때는 이전 값이 남아 '보였다'). 배치를 먼저 잡는다.
      // 배치·박자 = 영상 재생 위치에서 자동(_sbPlace). 관찰 중에도 잡아 화살표가 처음부터 뜬다.
      this._sbPlace(H, 'BK_B2', H.sL2, H.sR2, [null, null]);   // 1/4은 제자리 = 화살표 없음(유저)
      H.aD._gain = 0; H.aU._gain = 0;
      if (!this._followLatch) {   // 관찰 — 실루엣+Preview+화살표만, 마크 숨김
        for (const k of ['mL', 'mC', 'mR']) H[k].setOp?.(0);
        for (const k of ['sL1', 'sR1', 'sL2', 'sR2']) H[k].op(0);
        H.numL.visible = false; H.numR.visible = false;   // 글리프는 자체 재질 — op(0)로 안 꺼진다
        H.rise.setOp?.(0); H.cL.op(0); H.cR.op(0);
        this.demoActive = true;
        FMU('먼저 보세요 — 스텝백', CS.prism);
        return;
      }
      this._say('bkb2go', '커리', '이제 같이 — 발부터, 한 박자씩 갑니다.');
      // 커서 = 발↔골반 상대 x 1:1 미러 (근거리 행). 깊이는 고정 — 측면 정보만 가르친다.
      const pr = this.xbot?.getProbes?.();
      let ex = 0, exL = 0, exR = 0;
      if (pr?.hips && pr.footL && pr.footR) {
        exL = pr.footL.x - pr.hips.x; exR = pr.footR.x - pr.hips.x;
        ex = (exL + exR) / 2 + (pr.hips.x - (pr.footL.x + pr.footR.x) / 2) * 2;   // 체중 쏠림 증폭 반영
        ex = Math.max(-0.75, Math.min(0.75, ex * 2.2));   // 클립 진폭(±0.2)을 마크 스케일(±0.55)로 증폭
      }
      const CZ = (H.mL.position.z) + 0.52;
      H.cL.at(ex - 0.14, CZ, 0.42); H.cR.at(ex + 0.14, CZ, 0.42);
      // 비트 목표: 0=시작(+0.55) 1=플랜트(0) 2=착지(-0.55) 3=슛(상승)
      const TGT = [0.55, 0, -0.55][Math.min(H.beat, 2)];
      // 따라하기 화면(143:444) = 코치 영상 아래 L·R 마크 한 쌍 + 좌 ↓ / 우 ↑.
      //   비트 릴레이(존 3개)는 이 단계에선 안 쓴다 — 1/4은 '자리 잡고 망설이기'다.
      placeMarkNum(H.numL); placeMarkNum(H.numR);   // 앵커·스케일은 매 프레임 룩 값에서
      H.numL.visible = true; H.numR.visible = true;
      for (const k of ['sL1', 'sR1']) H[k].op(0);
      H.mL.setOp?.(0); H.mR.setOp?.(0); H.mC.setOp?.(0);   // 링은 표시 안 함(판정 좌표로만 쓴다)
      H.cL.op(0); H.cR.op(0);
      H.rise.setOp?.(0);   // 상승 링(파형) 제외 — 1/4은 자리 잡기라 링 없이 발자국+화살표만(유저)
      const dtB2 = Math.max(0, Math.min(0.1, this.t - (this._bkB2t ?? this.t))); this._bkB2t = this.t;
      if (H.beat <= 2) {
        // 커서가 목표 마크 근방에 머물면(0.8s) 통과. 봇 시연이 늦으면 6s 후 자동 진행(데모 안전장치).
        if (Math.abs(ex - TGT) < 0.22) H._dwell += dtB2; else H._dwell = Math.max(0, H._dwell - dtB2 * 2);
        if (H._dwell > 0.8 || this.t - H._beatT > 6) {
          H.beat += 1; H._dwell = 0; H._beatT = this.t; H._popT = this.t;
          // 접지 버스트(파형 이펙트) 없음 — 1/4은 발자국+화살표만(유저)
        }
      } else {
        // 비트④ 슛 — 골반 상승 전환 감지(점프 릴리즈)
        const hy = pr?.hips?.y ?? 1;
        if (hy - (H._prevHy || hy) > 0.012 || this.t - H._beatT > 6) {
          this._say('bkb2shot', '커리', '슛! 그 리듬이에요.');
          this.next(); return;
        }
        H._prevHy = hy;
      }
      const BEATN = ['시작 자리', '플랜트 — 안으로', '스텝백! — 빠지기', '슛!'];
      FMU(`Break Down · ${H.beat + 1}/4 — ${BEATN[H.beat]}`, CS.sand);
      this.repLeft = 4 - H.beat; this.repTotal = 4; this.repFrac = H.beat / 4;
      if (this.t >= MAXSEC) { this.next(); return; }
    } else if (id === 'BK_B3' || id === 'BK_B4' || id === 'BK_B5' || id === 'BK_C2') {
      // 스텝백 연속 단계 — 같은 판정, 파라미터만 다르다.
      //   B3 0.5배속·3회 / B4 정속·5회 / C2 실전(무작위 방향·릴리즈 판정)·3회
      const LIVE = id === 'BK_C2';
      const CFG = { BK_B3: { per: 2.2, need: 3 }, BK_B4: { per: 2.2, need: 3 }, BK_B5: { per: 2.0, need: 3 }, BK_C2: { per: 0.9, need: 3 } }[id];
      const H = { BK_B3: this.bkB3x, BK_B4: this.bkB4x, BK_B5: this.bkB5x, BK_C2: this.bkC2x }[id];
      if (this._bkStrId !== id) { H.beat = 0; H.count = 0; H._beatT = this.t; H._popT = -9; H._side = -1; H._ghT = -9; }
      this._bkStrId = id;
      if (!this._followLatch && !LIVE) {   // 훈련만 관찰 국면
        for (const k of ['mL', 'mC', 'mR']) H[k].setOp?.(0);
        for (const k of ['fLl', 'fLr', 'fRl', 'fRr', 'fC']) H[k]?.op(0);
        if (H.numL) { H.numL.visible = false; H.numR.visible = false; }   // 글리프는 op(0)로 안 꺼진다
        H.rise.setOp?.(0); H.gh.op(0); H.cL?.op(0); H.cR?.op(0);
        this.demoActive = true;
        FMU('먼저 보세요 — 스텝백', CS.prism);
        return;
      }
      this.clipRate = 1;   // 봇은 정속(유저) — 느리게 보여줄 건 코치 영상 playbackRate 쪽이다
      const pr = this.xbot?.getProbes?.();
      let ex = 0;
      if (pr?.hips && pr.footL && pr.footR) {
        ex = (pr.footL.x + pr.footR.x) / 2 - pr.hips.x + (pr.hips.x - (pr.footL.x + pr.footR.x) / 2) * 3;
        ex = Math.max(-0.75, Math.min(0.75, ex * 2.2));
      }
      if (H.cL) { const CZ = H.mL.position.z + 0.52; H.cL.at(ex - 0.14, CZ, 0.42); H.cR.at(ex + 0.14, CZ, 0.42); H.cL.op(0.5); H.cR.op(0.5); }
      // 비트 진행: 시간 구동(연속 흐름). per = 비트 간격
      const cyc = (this.t - H._beatT) / CFG.per;
      const beat = Math.min(3, Math.floor(cyc));
      if (beat !== H.beat) {
        H.beat = beat; H._popT = this.t;
        if (beat === 2 && LIVE) H._side = Math.random() < 0.5 ? -1 : 1;   // 실전 = 착지 방향 무작위
      }
      const landX = LIVE ? H._side * 0.55 : -0.55;
      H.mL.position.x = LIVE ? landX : -0.55;
      H.rise.position.x = landX;
      // 점등 = 항상 '다음 목표 하나'. 실전은 시작→착지→상승 링 릴레이만 남긴다(유저 확정).
      const pk = Math.max(0, 1 - (this.t - H._popT) / 0.25);
      // 피그마 훈련01~04(141:204/230/252/274)의 L·R 마크 좌표를 프레임 폭 1600 기준으로 정규화한 값.
      //   u = 가로(-1~1), dv = 앞뒤 오프셋. 임의 배치가 아니라 레퍼런스 실좌표다.
      const POSE = !LIVE && !!STEP_SEG[id];   // 따라하기(1/4~4/4)만 자동 배치 — 실전(C2)은 마크 릴레이 유지
      H.mR.setOp?.(POSE ? 0 : (H.beat === 0 ? 0.5 : 0));
      H.mC.setOp?.(POSE ? 0 : (H.beat === 1 ? 0.5 : 0));
      H.mL.setOp?.(POSE ? 0 : (H.beat === 2 ? 0.5 : 0));
      // 발자국 페어 — 시작(우)은 비트0, 착지(좌)는 비트2에 밝게. 실전은 착지 쪽만.
      const fpOn = (k, on) => { const f = H[k]; if (!f) return;
        if (on) { f.countdown(Math.min(1, 0.35 + (this.t - H._popT) / 0.35)); f.op(0.95); }   // 헤일로 수축 시작점을 당겨 번짐 축소
        else { f.ghost(); f.op(LIVE ? 0 : 0.10); } };
      if (POSE) {
        // 4단계 학습 화면(피그마 레퍼런스): 해당 단계의 L·R 발자국은 '항상' 보인다.
        //   비트는 강조(Active 헤일로)만 담당 — 꺼버리면 어디에 서야 할지가 사라진다.
        for (const k of ['fRl', 'fRr']) { const f = H[k];
          f.countdown(Math.min(1, 0.55 + (this.t - H._beatT) / 1.2)); f.op(1); }
        for (const k of ['fC', 'fLl', 'fLr']) H[k]?.op(0);
      } else {
        fpOn('fRl', H.beat === 0); fpOn('fRr', H.beat === 0);
        fpOn('fC', H.beat === 1);
        fpOn('fLl', H.beat >= 2); fpOn('fLr', H.beat >= 2);
      }
      if (LIVE) { const sgn = H._side < 0 ? -1 : 1;   // 실전 착지 페어는 무작위 방향으로 이동
        H.fLl.at(sgn * 0.55 - 0.14, SBZ + 0.03, 0.58 * 1.25); H.fLr.at(sgn * 0.55 + 0.14, SBZ + 0.03, 0.58 * 1.25); }
      // 비트④ = 착지 마크가 그 자리에서 상승 링으로 '변신', 수축이 곧 릴리즈 카운트다운(0.4s)
      if (H.beat === 3) {
        const rp = Math.min(1, (this.t - H._popT) / 0.4);
        H.rise.setOp?.(0.9 * (1 - rp * 0.5)); H.rise.scale.setScalar(1 - 0.45 * rp);
        H.mL.setOp?.(0);
      } else { H.rise.setOp?.(0); H.rise.scale.setScalar(1); }
      // 판정 — 착지(측면 변위) + 릴리즈(골반 상승)
      const hy = pr?.hips?.y ?? 1;
      const spread = pr ? Math.abs(pr.footR.x - pr.footL.x) : 0;
      if (H.beat >= 2 && !H._landed && spread > 0.64) {   // 실측 착지 폭 0.92m의 70%
        H._landed = true; H._landT = this.t; H._landErr = spread - 0.92;
        // 따라하기(1/4~4/4)에서는 판정 버스트를 쓰지 않는다 — 발자국이 없는 링 자리에서
        //   난데없이 터져 보였다(유저). 파문은 '발이 닿는 순간' 그 발자국 자리에서만.
        if (!POSE) {
          const wp = new THREE.Vector3(); H.mL.getWorldPosition(wp); this.onPress?.(wp, false);
          H.gh.at(ex, H.mL.position.z, 0.62); H.gh.ghost(); H._ghT = this.t;   // 고스트 = 실제 착지 위치
        }
      }
      if (H._landed && hy - (H._prevHy || hy) > 0.010 && this.t - H._landT < 0.6) {
        H.count += 1; H._landed = false;
        const wp = new THREE.Vector3(); H.rise.getWorldPosition(wp);
        if (!POSE) this.onPress?.(wp, true);
        this._say('sbshot' + H.count, '커리', '슛! 좋아요.');
        H._beatT = this.t; H.beat = 0;
      }
      H._prevHy = hy;
      if (this.t - H._beatT > CFG.per * 4.6) { H._beatT = this.t; H.beat = 0; H._landed = false; }   // 놓치면 다음 사이클
      H.gh.op(Math.max(0, 1 - (this.t - H._ghT) / 0.6) * 0.65);   // 오차 잔상 0.6초
      // 화살표 = 한 박자 앞서 켜서 '다음에 어디로'를 알린다
      H.a1._gain = H.beat === 0 ? 0.9 : (H.beat === 1 ? 0.35 : 0);
      H.a2._gain = H.beat === 1 ? 0.95 : (H.beat === 2 ? 0.5 : 0);
      // 봇 구동 = 실측 4국면. 폭(스탠스)만으론 '스텝백을 한다'가 안 보인다(유저) —
      //   루트를 실제로 옆으로 옮기고(밀기 +0.22 → 빠지기 -0.34), 마지막에 점프까지 시킨다.
      const WID = [0.39, 0.42, 0.92, 0.55];     // 스탠스 폭(m) — 영상 실측
      const SHF = [0.00, 0.22, -0.34, -0.30];   // 루트 측면 이동(m) — 밀고 들어갔다 반대로 빠짐
      const bp = Math.max(0, Math.min(1, (this.t - H._popT) / (CFG.per * 0.55)));
      const ez = bp * bp * (3 - 2 * bp);
      const pi = Math.max(0, H.beat - 1);
      this.sbWidth = WID[pi] + (WID[H.beat] - WID[pi]) * ez;
      this.sbShift = SHF[pi] + (SHF[H.beat] - SHF[pi]) * (H.beat === 2 ? Math.min(1, bp * 1.8) : ez);   // 스텝백은 빠르게
      // 비트④ = 슛: 짧은 수직 점프(0.35s)
      const jt = H.beat === 3 ? (this.t - H._popT) : -1;
      this.sbJump = jt >= 0 && jt < 0.35 ? Math.sin((jt / 0.35) * Math.PI) * 0.16 : 0;
      // 단계별 발자국 배치 = 피그마 레퍼런스 4장 그대로 (L/R 상대 위치·간격)
      //   1) 무릎 구부려 넣는 척: L·R 나란히 어깨너비   2) 오른발 딛고 드리블: R 앞·L 뒤, 공은 왼쪽
      //   3) 왼발 뻗으며 공 잡기: L 크게 왼쪽·R 제자리   4) 오른발 모으며 슛: L·R 모음
      if (POSE) {
        // 1/4~4/4 공통 — 좌표·박자 전부 영상 재생 위치에서 자동(_sbPlace). 손좌표 표 폐기(유저).
        this._sbPlace(H, id, H.fRl, H.fRr, [H.a1, H.a2]);
        for (const k of ['fC', 'fLl', 'fLr']) H[k]?.op(0);
        if (H.numL) { placeMarkNum(H.numL); placeMarkNum(H.numR); H.numL.visible = H.numR.visible = true; }
        H.mL.setOp?.(0); H.mR.setOp?.(0); H.mC.setOp?.(0);
        H.rise.setOp?.(0); H.gh.op(0); H.cL?.op(0); H.cR?.op(0);
      }
      const BEATN = { BK_B2: ['① 무릎 구부리고', '② 낮은 자세 유지', '③ 들어가는 척!', '④ 그대로 준비'],
        BK_B3: ['① 준비', '② 오른발 딛고', '③ 공을 왼쪽으로!', '④ 시선 유지'],
        BK_B4: ['① 준비', '② 왼발 크게 뻗어', '③ 두 손으로 잡기!', '④ 밸런스'],
        BK_B5: ['① 준비', '② 오른발 모으고', '③ 수직으로!', '④ 슛!'],
        BK_C2: ['① 시작 자리', '② 플랜트 — 안으로', '③ 스텝백!', '④ 슛!'] }[id] || ['①', '②', '③', '④'];
      const left = Math.max(0, CFG.need - H.count);
      this.repLeft = left; this.repTotal = CFG.need; this.repFrac = Math.min(1, H.count / CFG.need);
      FMU(LIVE ? `스텝백 3점 — 남은 ${left}회` : `${BEATN[H.beat]} · 남은 ${left}회`, LIVE ? CS.red : CS.sand);
      if (left === 0) { this.next(); return; }
    } else if (id === 'BK_C1') {
      const n = Math.max(1, 3 - Math.floor(this.t)); if (n !== this._lastCount) { this._setCount(n, CS.ink); this._lastCount = n; }
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BK_C2') {
      // 실전 핸들 프레이즈 — B2와 같은 판정(공 추종 존), 풀템포. 8히트 또는 dur 종료 시 진행.
      const H = this.bkC2, TOTAL = 8;
      if (this._bkStrId !== 'BK_C2') { H.count = 0; H._shown = -1; H._wasLow = false; H._popT = -9; }
      this._bkStrId = 'BK_C2';
      H._tgtL = (this.xbot?.ball?.position.x ?? 0) - (this.xbot?.group?.position.x ?? 0) < 0;
      const onZ = H._tgtL ? H.zL : H.zR, offZ = H._tgtL ? H.zR : H.zL;
      const pkc = Math.max(0, 1 - (this.t - H._popT) / 0.2);
      onZ.setOp?.(0.55 + 0.4 * pkc); offZ.setOp?.(0.12);
      const bc = this.xbot?.ball;
      const lowC = !!bc?.visible && bc.position.y < 0.20;
      if (lowC && !H._wasLow) {
        const wp = new THREE.Vector3(); onZ.getWorldPosition(wp);
        if (Math.abs(bc.position.x - wp.x) < 0.30) { H.count += 1; H._popT = this.t; this.onPress?.(wp, false); }
      }
      H._wasLow = lowC;
      const leftC = Math.max(0, TOTAL - H.count);
      if (leftC !== H._shown) { redrawFootNum(H.num, leftC); H._shown = leftC; }
      this.repLeft = leftC; this.repTotal = TOTAL; this.repFrac = Math.min(1, H.count / TOTAL);
      FMU(`풀템포 프레이즈 — 남은 ${leftC}회`, CS.sand);
      if (leftC === 0 || this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BK_C3') {
      // 사이드스텝 — 봇(사이드 드리블)이 좌우로 넘는 게이트 라인. 넘은 쪽 라인이 팡, 4회.
      const H = this.bkC3, TOTAL = 4;
      if (this._bkStrId !== 'BK_C3') { H.count = 0; H._shown = -1; H._side = 0; H._popT = -9; }
      this._bkStrId = 'BK_C3';
      const bx3 = this.xbot?.getAnchor?.()?.x ?? 0;
      const side = bx3 < -0.4 ? -1 : bx3 > 0.4 ? 1 : 0;   // 게이트 라인(±0.55) 근접 판정(여유 0.15)
      if (side !== 0 && side !== H._side) {
        H._side = side; H.count += 1; H._popT = this.t;
        const gate = side < 0 ? H.gL : H.gR;
        const wp = new THREE.Vector3(); gate.getWorldPosition(wp); this.onPress?.(wp, false);
      }
      const pk3 = Math.max(0, 1 - (this.t - H._popT) / 0.3);
      H.gL.material._gainK = 0.4 + (H._side < 0 ? 0.6 * pk3 : 0);
      H.gR.material._gainK = 0.4 + (H._side > 0 ? 0.6 * pk3 : 0);
      const left3 = Math.max(0, TOTAL - H.count);
      if (left3 !== H._shown) { redrawFootNum(H.num, left3); H._shown = left3; }
      this.repLeft = left3; this.repTotal = TOTAL; this.repFrac = Math.min(1, H.count / TOTAL);
      FMU(`사이드스텝 — 게이트 ${left3}회 남음`, CS.prism);
      if (left3 === 0 || this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BK_C4') {
      this.liveSpeed = Math.max(0.12, 1 - this.t / 2.4);   // 릴리즈 감속
      if (this.liveSpeed <= 0.13 && this.t > 2.8) { this.liveSpeed = 1; this.stageIdx = this.stages.findIndex(s2 => s2.id === 'BK_FIN'); this.t = 0; this._enter(); return; }
    }
  }

  _updateBoxing(id, st, beat, FMU) {
    this.bobY = 0;   // 벽면 종목 — 1인칭 시점 흔들림은 모캡이 담당
    if (id === 'BX_READY' || id === 'BX_T1') {
      const tap = id === 'BX_READY' ? this.bxTap : this.bxTap1; const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      tap.children[0].material.opacity = 0.5 + 0.45 * k; tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
      if (id === 'BX_T1' && this.t >= 4.5) { this.next(); return; }
    } else if (id === 'BX_A1') {
      // 목·어깨 회전 토큰 = 자체 회전(데모 루프)으로 '돌리기' 표시. 카운트만 갱신.
      FMU(`${Math.min(8, Math.floor(this.t / 0.7) + 1)} / 8`, CS.sand);
      if (this.t >= 8 * 0.7) { this.next(); return; }
    } else if (id === 'BX_A2') {
      // 스텝 인·아웃 — 근/원 존 교대
      const per = 0.7, near = Math.floor(this.t / per) % 2 === 0;
      this.bxA2near.material.opacity = near ? 0.9 : 0.35;
      this.bxA2far.material.opacity = near ? 0.35 : 0.9;
      FMU(`앞뒤 ${Math.min(6, Math.floor(this.t / per) + 1)} / 6`, CS.sand);
      if (this.t >= 6 * per + 0.4) { this.next(); return; }
    } else if (id === 'BX_A3') {
      // 잽 폼 — 어프로치 링(타이밍) + 잽 궤적. 렙마다 방향을 바꿔 다양한 잽(정면·크로스·좌우)
      const BT = 0.9, rep = Math.floor(this.t / BT), ph = (this.t % BT) / BT;
      if (rep !== this._jabRep) { this._jabRep = rep; this.bxA3jab._prim.pts = JAB_PATHS[rep % JAB_PATHS.length]; }
      this.bxA3ap._prim.prog = ph;    // 링이 맞물리는 순간 = 잽 타이밍
      this.bxA3jab._prim.prog = ph;   // 잽 궤적 뻗기
      FMU(`잽 ${Math.min(6, Math.floor(this.t / BT) + 1)} / 6`);
      if (this.t >= 6 * BT + 0.4) { this.next(); return; }
    } else if (id === 'BX_B1') {
      // 가드 유지 — 홀드 링 3초 채움 × 게이트(3회)
      const HOLD = 3, rep = Math.floor(this.t / (HOLD + 0.5));
      const lt = this.t - rep * (HOLD + 0.5), p = Math.min(1, lt / HOLD);
      this.bxHold.setProg(p);   // MARK Hold 코닉 림 = 가드 유지 진행 (지오메트리 재조립 은퇴)
      this.bxHold.setOp(0.95);
      const done = Math.min(3, rep + (p >= 1 ? 1 : 0));
      FMU(`가드 유지 ${done} / 3 ✓`, done >= 3 ? CS.prism : CS.sand);
      this._gate = done;
      if (done >= 3) { this.next(); return; }
    } else if (id === 'BX_B2') {
      // 회피 슬립 — 좌우 점선 존 교대 위협
      const per = 1.0, left = Math.floor(this.t / per) % 2 === 0;
      this.bxDodgeL.setOp(left ? 0.95 : 0.3);
      this.bxDodgeR.setOp(left ? 0.3 : 0.95);
      FMU(`슬립 ${Math.min(6, Math.floor(this.t / per) + 1)} / 6`, CS.coral);
      if (this.t >= 6 * per + 0.3) { this.next(); return; }
    } else if (id === 'BX_B3') {
      // 잽 스윕 — 스윕 밴드 밝기 + 타겟 수축 링, 맞춘 잽 카운트
      const BT = 0.9, rep = Math.floor(this.t / BT), ph = (this.t % BT) / BT;
      if (rep !== this._jabRep) { this._jabRep = rep; this.bxB3jab._prim.pts = SWEEP_PATHS[rep % SWEEP_PATHS.length]; }   // 좌우 번갈아 스윕
      this.bxB3jab._prim.prog = ph;   // 잽 궤적 스윕
      this.bxB3cd.setOp(0.4 + 0.55 * ph); this.bxB3cd.scale.setScalar(1.9 - 0.9 * ph);   // setOp 규약 (구 .opacity는 셰이더에 무효 — 링이 안 보였음)
      const hits = Math.min(6, Math.floor(this.t / BT));
      FMU(`맞춘 잽 ${hits} / 6`, hits >= 6 ? CS.prism : CS.dim);
      if (this.t >= 6 * BT + 0.4) { this._gateAdvance(); return; }
    } else if (id === 'BX_C1') {
      const n = Math.max(1, 3 - Math.floor(this.t)); if (n !== this._lastCount) { this._setCountWall(n, CS.ink); this._lastCount = n; }
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BX_C2' || id === 'BX_C3') {
      if (id === 'BX_C3' && this.bxCombo) this.bxCombo._prim.prog = (this.t % 2.4) / 2.4;   // 콤보 사이클
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BX_C4') {
      this.liveSpeed = Math.max(0.12, 1 - this.t / 2.4);
      if (this.liveSpeed <= 0.13 && this.t > 2.8) { this.liveSpeed = 1; this.stageIdx = this.stages.findIndex(s2 => s2.id === 'BX_FIN'); this.t = 0; this._enter(); return; }
    }
  }
}
