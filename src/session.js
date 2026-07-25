import * as THREE from 'three';
import bkStepContacts from '../assets/mocap/contacts-cmu_crossover_shot.json';   // 접지 자동 추출 산출물 (scripts/extract_contacts.mjs)
import { WALL_Z } from './scene.js';
import { lutColor, GLYPHS, drawGlyph, drawNumber, footSlot, footSDFTexture, FXP } from './fxlut.js';
import { MARK_NUM, drawStanceBox, drawPunchLine, drawApproachRing, drawTrajectory, drawRotate } from './fx-core.js';
import { makeMarkFXMaterial, makeLaneFXMaterial, makeFlowArrow, tickFlowArrows } from './tokens.js';

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
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat);
    this.group.add(this.plane);
    this.group.rotation.x = -Math.PI / 2; this.group.position.y = 0.013; this.group.renderOrder = 6;
    this.plane.rotation.z = foot === 'left' ? THREE.MathUtils.degToRad(8) : THREE.MathUtils.degToRad(-8);
    this.group.userData.el = { type: 'foot', side: foot };
  }
  at(x, z, s = 1) { this.group.position.set(x, 0.013, z); this.group.scale.setScalar(s); return this; }
  op(k) { this._U.uFade.value = k; }
  setHold(p) { this._U.uPhase.value = 5; this._U.uProg.value = Math.max(0.001, p); }   // Hold 코닉 진행 림
  countdown(p) {
    if (p < 0) { this._U.uPhase.value = 0; this._U.uProg.value = 0; return; }          // 대기 = Preview 숨쉬기
    this._U.uPhase.value = 1; this._U.uProg.value = p;                                 // Active — 헤일로 수축 = 타이밍
  }
  glow(k) { this._U.uPhase.value = 2; this._U.uProg.value = Math.min(1, 1 - k); }      // Success 진홍 블룸 잔상
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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sizeM, sizeM),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  if (!wall) m.rotation.x = -Math.PI / 2;
  m.renderOrder = 6;
  m.userData.el = { type: kind, wall: !!wall };
  const panel = { kind, c, tex, m, prog: null, pts: null, P: null };   // P = 인스턴스별 파라미터 오버라이드
  m._prim = panel;
  PRIM_PANELS.push(panel);
  return m;
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
    else if (p.kind === 'trajectory') drawTrajectory(g, 256, P, look, t, livePrimEnv(), p.prog, p.pts);
    else if (p.kind === 'rotate') drawRotate(g, 256, P, look, t, livePrimEnv(), p.prog);
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

export const STAGES = {
  running: [
    { id:'READY', label:'준비 — 발 두 번 구르면 시작', voice:['션','안녕! 션이에요. 오늘 가볍게 1킬로 뛰어볼까요? 발 두 번 구르면 시작!'], wear:'SAFE 대기', foot:'발 두 번 구르기 → 시작' },
    { id:'A1', label:'A · 준비운동 1/3 — 목·어깨 풀기', voice:['션','먼저 몸부터 깨울게요. 편하게 서서 목과 어깨를 크게, 천천히 돌려요. 링이 다 찰 때까지!'], wear:'개입 없음 (자세 측정)' },
    { id:'A2', label:'A · 준비운동 2/3 — 런지(앞의 원 딛고 버티기)', voice:['션','좋아요! 이번엔 런지예요.'], foot:'앞으로 딛고 버티기 · 발 교대' },
    { id:'A3', label:'A · 준비운동 3/3 — 하이니(제자리 무릎 올리기)', voice:['션','마지막! 하이니예요.'], foot:'완료 후 두 번 구르기 → 다음' },
    { id:'T1', label:'몸풀기 끝 — 다음은 페이스 잡기', voice:['션','몸이 다 풀렸네요, 최고예요! 발 두 번 구르면 이제 페이스 잡으러 가요.'], foot:'발 두 번 구르기 → 페이스 잡기' },
    { id:'P1', dur:6, live:true, label:'페이스 잡기 — 페이서 붙어 가볍게 뛰기', voice:['션','자, 바로 가볍게 뛰기 시작할게요. 앞의 광점이 저예요 — 제 페이스에 한번 붙어 보세요!'], wear:'낮은 강도 보조 시작' },
    { id:'P2', dur:6, live:true, label:'페이스 잠금 → 실전 진입', voice:['션','오, 그 리듬 좋은데요! 몇 걸음만 더 맞추면 바로 실전이에요.'], wear:'SAFE 착지 안정화' },
    { id:'T2', label:'5초 뒤 실전 시작', voice:['션','5초 뒤에 진짜 달리기 시작할게요! 준비됐으면 발을 두 번 굴러요. 가만히 있어도 제가 시작할게요.'], dur:5, count:true, foot:'두 번 구르기 = 바로 시작 · 가만히 있으면 자동' },
    { id:'C1', dur:3, label:'C · 실전 — 출발 카운트', voice:['션','갑니다 — 셋, 둘, 하나!'], hap:'시작 타이밍 진동', foot:'두 번 구르기 → 출발 (이후 잠금)' },
    { id:'C2', dur:7, live:true, label:'C · 실전 — 션과 나란히 달리기', voice:['션','좋아요, 그 박자 그대로! 제 옆에 딱 붙어서 같이 가요.'], wear:'SAFE 착지 안정화' },
    { id:'C3', dur:7, live:true, label:'C · 실전 — 흔들리면 다시 붙기', voice:['션','박자! 흔들려도 괜찮아요 — 저한테 다시 맞추면 돼요.'], hap:'착지 보조 2박' },
    { id:'C4', dur:7, live:true, boost:true, label:'C · 실전 — 마지막 1km 스퍼트', voice:['션','여기서부터 마지막 1킬로미터예요! 힘내요, 저만 보고 따라와요!'], wear:'BOOST 추진 보조 · 리듬 저하 시 강도↑', cue:'구간 종료 일치율 표시' },
    { id:'C5', live:true, cooldown:true, label:'C · 실전 — 천천히 멈추기', voice:['션','여기까지! 와, 오늘 정말 잘 달렸어요. 천천히 숨 고르면서 멈춰요.'], hap:'완료 진동' },
    { id:'FIN', label:'오늘의 리포트 · 쿨다운', voice:['션','오늘 기록은 앱으로 보내 뒀어요. 리포트 보는 동안 허벅지 앞을 잡고 천천히 풀어 주세요. 오늘 함께해서 즐거웠어요 — 다음에 또 같이 달려요!'], cue:'션 발자국 위에 내 착지 겹쳐 보기 · 쿼드 쿨다운' },
  ],
  basketball: [
    { id:'BK_READY', label:'0 · READY — 준비', voice:['시스템','커리의 스텝백 3점 팩. 준비되면 발을 두 번 탭하세요.'], wear:'SAFE 대기', foot:'두 번 탭 → 시작' },
    { id:'BK_A1', label:'A · 준비운동 1/3 — 스쿼트', voice:['커리','마크 폭으로 서서 천천히 앉았다 일어나요. 무릎은 발끝 방향.'], wear:'개입 없음 (자세 측정)' },
    { id:'BK_A2', label:'A · 준비운동 2/3 — 런지 프레스', voice:['커리','앞으로 쭉 뻗어 원을 딛고 3초간 꾸욱. 왼발 오른발 번갈아.'], hap:'프레스 완료 진동 (약)' },
    { id:'BK_A3', label:'A · 준비운동 3/3 — 드리블 스팟', voice:['커리','발 앞의 스팟에 공을 튕겨요. 링에 정확히 — 열 번이면 리듬 완성.'], wear:'낮은 강도 보조 시작' },
    { id:'BK_T1', label:'T-1 · STAGE CLEAR → 사전 익히기', voice:['시스템','몸 풀렸어요. 탭 두 번이면 다음으로.'], foot:'두 번 탭 → 사전 익히기' },
    { id:'BK_B1', label:'B · 스텝 스쿨 1/3 — 드라이브 리듬 스텝', voice:['커리','한 번에 두 걸음만 갈게요. 오른발, 그리고 왼발 — 밝은 발자국 순서대로, 가볍게 리듬만 타요.'], cue:'스텝 ①② 반복 ×4' },
    { id:'BK_B2', label:'B · 스텝 스쿨 2/3 — 플랜트 & 브레이크', voice:['커리','이제 셋에서 디딤발이에요. 4번 발자국에서 확 — 잘 멈추는 게 슛의 시작이에요.'], cue:'③④ 플랜트 반복 ×4' },
    { id:'BK_B3', label:'B · 스텝 스쿨 3/3 — 백스텝 분리·릴리즈', voice:['커리','마지막이에요. 디딤발에서 뒤로 확 — 0.48미터 벌리고, 양발 착지하면 링이 닫히기 전에 쏘는 거예요.'], foot:'두 번 탭 → 실전 준비' },
    { id:'BK_T2', label:'T-2 · 5초 뒤 실전 자동 진행 (두 번 탭 = 바로)', voice:['커리','5초 뒤 넘어가요. 준비됐으면 두 번 탭.'], dur:5, count:true, foot:'두 번 탭 = 즉시 · 무입력 = 자동' },
    { id:'BK_C1', dur:3, label:'C · 실전 1/4 — 트리거', voice:['시스템','3, 2, 1. 컷 들어가요.'], hap:'컷 시작 진동', foot:'두 번 탭 → 출발' },
    { id:'BK_C2', dur:6, live:true, label:'C · 실전 2/4 — 컷인 라이브', voice:['커리','수비 앞으로 파고들어요.'], wear:'SAFE 컷 안정화' },
    { id:'BK_C3', dur:6, live:true, boost:true, label:'C · 실전 3/4 — 스텝백 (라이브·가속)', voice:['커리','뒤로 확! 공간 만들어요.'], wear:'BOOST 스텝백 추진', cue:'구간 종료 Match Rate' },
    { id:'BK_C4', live:true, cooldown:true, label:'C · 실전 4/4 — 릴리즈·정지', voice:['시스템','밸런스 잡고 릴리즈. 좋아요.'], hap:'릴리즈 완료 진동' },
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
    const arL = floorArrow(-0.17, -1.5, 0, BRAND.red, 0.3), arR = floorArrow(0.17, -1.5, 0, BRAND.red, 0.3);
    this.a3hk = {
      fmL: a3L, fmR: a3R, numL: a3nL, numR: a3nR, arL, arR,
      sec: 0, cntL: 0, cntR: 0, _prevLeft: undefined, _beat: 0, _pop: 0,
    };
    g.add(a3L.group, a3R.group, arL, arR);

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
    this.c3cue = floorText('박자', 0.45, -2.1, { size: 0.13, color: CS.red, weight: 800 }); g.add(this.c3cue);

    this._mk('C4');  // 라이브 — 션 발자국 페이서가 전담 (BOOST는 liveSpeed·음성으로)

    g = this._mk('C5');
    this.c5stripes = [];
    for (let i = 0; i < 4; i++) { const st = floorStripe(0, -1.6 - i * 0.32, 0.5 - i * 0.06, BRAND.coral, 0.7 - i * 0.13); g.add(st); this.c5stripes.push(st); }
    g.add(floorRing(0, -2.6, 0.20, 0.225, BRAND.dim, 0.9));
    g.add(floorText('STOP', 0, -2.6, { size: 0.09, color: CS.mute }));

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

    // A1 스쿼트 — 발폭 마크 2 + 회당 카운트 아크 (프로브: 골반 하강)
    g = this._mk('BK_A1');
    this.bkA1L = new FootMark('left').at(-0.22, -1.9); g.add(this.bkA1L.group);
    this.bkA1R = new FootMark('right').at(0.22, -1.9); g.add(this.bkA1R.group);
    this.bkA1arc = floorArc(0, -2.25, BRAND.sand); g.add(this.bkA1arc);

    // A2 사이드 런지 프레스 — 러닝 A1과 같은 '누르면 채워지는' 문법 (좌우 존원 + 홀드 아크)
    g = this._mk('BK_A2');
    this.bkA2press = { ring: floorRing(0, -1.85, 0.20, 0.225, BRAND.red, 0.45), arc: floorArc(0, -1.85, BRAND.sand), cx: 0, cz: -1.85, fill: 0 };
    g.add(this.bkA2press.ring); g.add(this.bkA2press.arc);

    // A3 리듬 드리블 — 제자리 스탠스 + 박자 링
    g = this._mk('BK_A3');
    g.add(new FootMark('left').at(-0.2, -1.9).group);
    g.add(new FootMark('right').at(0.2, -1.9).group);
    this.bkA3ring = floorRing(0.30, -1.33, 0.14, 0.16, BRAND.red, 0.8); g.add(this.bkA3ring);   // 스팟 = 실측 바운스 평균(0.30, -2.18w)
    // V자 공 경로(교본 드리블 일러스트 문법): 왼손↘바운스↗오른손 — 링(바운스 지점)에서 꺾임
    g.add(floorArrow(0.16, -1.45, 148, BRAND.coral, 0.26));
    g.add(floorArrow(0.44, -1.45, 32, BRAND.coral, 0.26));
    g.add(floorText('BOUNCE', 0.30, -1.60, { size: 0.055, color: CS.mute }));
    this.bkA3miss = floorRing(0.30, -1.33, 0.16, 0.175, BRAND.dim, 0); g.add(this.bkA3miss);   // 빗나간 바운스 위치 피드백

    g = this._mk('BK_T1');
    this.bkTap1 = this._tap('boxing'); this.bkTap1.position.set(0, 0.013, -1.1); g.add(this.bkTap1);

    // B1·B2 스텝 가이드 = 실측 접지 시퀀스 — 코치 클립(cmu_crossover_shot 06_14)에서 FK로
    // 발 접지(t,x,z,좌우)를 추출해 그대로 배치. 봇이 그 클립을 재생하므로 마크를 정의상
    // 정확히 밟고, 유저는 진짜 따라 밟을 수 있는 순서·위치·좌우발을 본다.
    // (모델 rotY π → world=(-x, BK_STAND-z), BK_STAND = 봇 후퇴 배치로 투사존 정합)
    g = this._mk('BK_B1');
    // 바닥만 보고 익히는 학습 언어: 발자국(좌우형) + 순서 숫자 + 스텝 연결 화살표 + 점프 착지 존
    this.bkGuideMarks = []; this.bkGuideNums = []; this.bkGuideArrows = [];
    BK_GUIDE.forEach((c, i) => {
      const fm = new FootMark(c.side === 'L' ? 'left' : 'right').at(-c.x * BK_ZOOM, BK_STAND - c.z * BK_ZOOM, 1.15);
      g.add(fm.group); this.bkGuideMarks.push(fm);
      this.bkGuideNums.push(attachMarkNum(fm, i + 1, c.side === 'R'));
    });
    for (let i = 0; i < 4; i++) {   // 스텝1→2→3→4 연결 화살표 (다음 발이 어디로 가는지)
      const a = BK_GUIDE[i], b = BK_GUIDE[i + 1];
      const ax = -a.x * BK_ZOOM, az = BK_STAND - a.z * BK_ZOOM, bx = -b.x * BK_ZOOM, bz = BK_STAND - b.z * BK_ZOOM;
      const ang = Math.atan2(bx - ax, bz - az) * 180 / Math.PI + 180;   // floorArrow 0°=-z 전방 기준
      const ar = floorArrow((ax + bx) / 2, (az + bz) / 2, ang, BRAND.coral, Math.max(0.2, Math.hypot(bx - ax, bz - az) * 0.55));
      g.add(ar); this.bkGuideArrows.push(ar);
    }
    // 점프 착지 존 — 양발(5·6) 동시 착지를 하나의 존으로 명시
    const jx = -(BK_GUIDE[4].x + BK_GUIDE[5].x) / 2 * BK_ZOOM, jz = BK_STAND - (BK_GUIDE[4].z + BK_GUIDE[5].z) / 2 * BK_ZOOM;
    this.bkJumpRing = floorRing(jx, jz, 0.3, 0.33, BRAND.prism, 0.0); g.add(this.bkJumpRing);
    this.bkJumpTxt = floorText('JUMP · LAND', jx, jz - 0.45, { size: 0.07, color: CS.prism }); g.add(this.bkJumpTxt);

    // B2 따라 밟기 + 플랜트·브레이크 — 같은 실측 마크·숫자에 플랜트(4번=마지막 딛기) 강조:
    // 브레이크 바(정지선) + 밟는 순간 감속 스트라이프가 발 뒤로 퍼짐 = '여기서 확 멈춘다'가 보임
    g = this._mk('BK_B2');
    this.bkB2 = []; this.bkB2nums = [];
    BK_GUIDE.forEach((c, i) => {
      const right = c.side === 'R';
      const fm = new FootMark(right ? 'right' : 'left').at(-c.x * BK_ZOOM, BK_STAND - c.z * BK_ZOOM, 1.15);
      g.add(fm.group);
      this.bkB2.push(fm); this.bkB2nums.push(attachMarkNum(fm, i + 1, right));
    });
    const plant = BK_GUIDE[3];   // t=1.95 오른발 = 플랜트(브레이크)
    const px = -plant.x * BK_ZOOM, pz = BK_STAND - plant.z * BK_ZOOM;
    this.bkBrakeBar = floorStripe(px, pz - 0.28, 0.6, BRAND.red, 0.85); g.add(this.bkBrakeBar);   // 발 앞 정지선
    this.bkBrakeStripes = [];
    for (let i = 0; i < 3; i++) { const st = floorStripe(px, pz + 0.22 + i * 0.2, 0.5 - i * 0.1, BRAND.coral, 0); g.add(st); this.bkBrakeStripes.push(st); }
    g.add(floorText('BRAKE', px, pz - 0.5, { size: 0.07, color: CS.red }));

    // B3 백스텝 분리 + 릴리즈 타이밍 — 커리 실측(SportVU): 분리 0.48m · 착지→릴리즈 0.16s.
    // 플랜트 발자국 → 분리 벡터 화살표 → 거리 눈금 링(0.3/0.48/0.6m, 0.48=프리즘 강조) →
    // 착지존 양발 → 릴리즈 수축 링('창이 닫히기 전에 슛') — 바닥만 보고 거리·방향·타이밍을 익힘
    g = this._mk('BK_B3');
    // B3 재창조(가독 우선): 세로 스토리 한 줄 — (멀리)플랜트 ④ → 굵은 후방 화살표 + 0.48m 자 눈금
    // → (가까이)착지존(양발+얇은 아웃라인) → 오른쪽 SHOOT 타이머 링.
    // 3중 눈금 링 폐기: 1인칭에서 겹쳐 '안개 원 덩어리'(유저 스크린샷 #73). 거리는 자(ruler)가 정직.
    // 발자국 간 실척 0.48m 유지 — 유저가 몸으로 재현할 실제 거리.
    const p3x = 0, p3z = -3.35;                   // 플랜트(멀리)
    const lmz = p3z + 0.48;                       // 착지 중심 = 0.48m 뒤(유저 쪽) — '뒤로'가 화면에서도 아래
    this.bkB3plant = new FootMark('right').at(p3x, p3z, 1.15); g.add(this.bkB3plant.group);
    attachMarkNum(this.bkB3plant, 'R', true);
    // 교본 언어(유저 제공 'YOU and BASKETBALL' 도식): X = 수비수. 스텝백의 '이유'를 한눈에 —
    // X에게서 뒤로 확 분리해 슛 공간을 만든다. X는 플랜트 너머(더 멀리).
    g.add(floorText('X', 0, p3z - 0.42, { size: 0.17, color: CS.ink, weight: 800 }));
    g.add(floorText('수비수', 0.28, p3z - 0.42, { size: 0.06, color: CS.mute }));
    this.bkSepArrow = floorArrow(0, (p3z + lmz) / 2, 180, BRAND.coral, 0.42); g.add(this.bkSepArrow);
    // 자 눈금 3틱(0 / 0.24 / 0.48m) — 분리 진행에 따라 순차 점등
    this.bkRuler = [];
    for (let i = 0; i < 3; i++) { const tk = floorStripe(-0.36, p3z + 0.24 * i, 0.18, BRAND.sand, 0.5); g.add(tk); this.bkRuler.push(tk); }
    g.add(floorText('0.48m', -0.50, lmz - 0.02, { size: 0.10, color: CS.prism }));
    g.add(floorText('X에게서 뒤로 확 —', -0.50, p3z + 0.10, { size: 0.065, color: CS.mute }));
    // 착지존: 양발 + 얇은 아웃라인(면 채움 없음 — 백열 방지)
    this.bkLand = [new FootMark('left').at(-0.17, lmz + 0.10, 1.1), new FootMark('right').at(0.17, lmz + 0.04, 1.1)];
    this.bkLand.forEach(f => g.add(f.group));
    attachMarkNum(this.bkLand[0], 'L', false); attachMarkNum(this.bkLand[1], 'R', true);
    // 릴리즈 타이머: 착지존 오른쪽 — 수축 링 + SHOOT (겹침 제로 배치)
    this.bkRelRing = floorRing(0.55, lmz + 0.07, 0.13, 0.165, BRAND.red, 0.0); g.add(this.bkRelRing);
    this.bkRelTxt = floorText('SHOOT 0.16s', 0.52, lmz + 0.40, { size: 0.075, color: CS.red }); g.add(this.bkRelTxt);
    // 고스트 스텝 — 반투명 발자국 쌍이 플랜트→착지존으로 실제 미끄러지는 반복 모션.
    // 정지 마크가 아니라 '움직임 그 자체'를 바닥이 시연 (유저: 이해되게끔 새 컴포넌트 창조).
    this.bkGhost = [new FootMark('left').at(-0.17, p3z, 1.0), new FootMark('right').at(0.17, p3z, 1.0)];
    this.bkGhost.forEach(f => { f.op(0.3); g.add(f.group); });
    this._bkGhostFrom = p3z; this._bkGhostTo = [lmz + 0.10, lmz + 0.04];
    // 단계 뱃지 — 지금 뭘 할 차례인지 한 단어로 (현재 단계만 점등)
    this.bkBadges = [
      floorText('1 PLANT', 0.52, p3z + 0.06, { size: 0.07, color: CS.ink }),
      floorText('2 BACK', 0.52, p3z + 0.30, { size: 0.07, color: CS.ink }),
      floorText('3 SHOOT', 0.52, lmz + 0.22, { size: 0.07, color: CS.ink }),
    ];
    this.bkBadges.forEach(b => g.add(b));

    g = this._mk('BK_T2');   // 카운트 공통(countGroup) 사용 — 별도 지오메트리 없음

    // 실전 라이브 — 무릎 빔프가 봇 컷을 따라 움직이며 팩 토큰 투사 (오버레이 최소)
    g = this._mk('BK_C1');
    g.add(floorRing(0.03, -2.4, 0.15, 0.17, BRAND.red, 0.5));
    this._mk('BK_C2');       // 라이브 — 팩 토큰 흐름
    this._mk('BK_C3');       // 라이브 스텝백 (가속)
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
    // P(실전 직전) = 션 발자국만 밟는 경험(유저: 광점 블롭 제거, 아래 보며 직접 밟기). 광점·레인은 C 실전 전용.
    const isC = /^C/.test(this.stage);
    this.paceLight.visible = isC;
    this.paceLane.visible = isC;   // 실전 상설 페이스 레인 (러너가 따라갈 밝은 광류 — 달리는 느낌)
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
    // P(페이스) = 원형 판정 토큰+이펙트만(유저) — 션 발자국 고스트는 C 실전 전용
    if (!/^C/.test(this.stage)) { feet.forEach(fm => fm.group.visible = false); return; }
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
  stop() { this.active = false; this.root.visible = false; this.tokens.root.visible = true; this.liveSpeed = 1; this.bobY = 0; }
  tapAdvance() {
    if (!this.active) return;
    if (!/FIN$/.test(this.stage)) this.next(true);   // 유저 탭 = 즉시 다음(음성 대기 무시)
  }
  // 자동 전환은 준비된 음성이 다 끝난 뒤에만 넘어감(voiceBusy=main.js 주입). 유저 탭(force)은 즉시.
  next(force = false) {
    if (!force && this.voiceBusy?.()) return;   // 음성 재생 중 = 이번 프레임 보류(완료 조건 유지 → 다음 프레임 재시도)
    if (this.active && this.stageIdx < this.stages.length - 1) { this.stageIdx++; this.t = 0; this._enter(); }
  }
  prev() { if (this.active && this.stageIdx > 0) { this.stageIdx--; this.t = 0; this._enter(); } }
  _next() { this.next(); }

  _enter() {
    const st = this.stages[this.stageIdx];
    this.onStage?.(st);
    this.tokens.root.visible = !!st.live;      // 라이브 = 실제 팩 토큰이 흐른다
    this.liveSpeed = st.boost ? 1.18 : 1;
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
      case 'A2': FS('준비운동 2/3'); FL('앞으로 크게 딛어 원 밟고 버티기'); FM('링이 차면 발 교대', CS.sand); break;
      case 'A3': FS('준비운동 3/3'); FL('무릎 좌우 번갈아 높이 올리기'); FM('켜지는 발 박자로 · 30초', CS.sand); break;
      case 'A4': FS('준비운동 4/4'); FL('켜지는 발자국 박자로 제자리 걷기'); FM('처음엔 천천히 — 점점 빨라져요'); break;
      case 'T1': FS('잠깐'); S(this.slotFL, '몸풀기 끝!', { size: 0.12, color: CS.prism }); break;   // 푸터 제거: CTA 라벨과 중복
      case 'B1': FS('미리 익히기 1/5'); FL('발은 가만히 — 박자만 들어요'); FM('귀로 먼저 배워요'); break;
      case 'BW': FS('미리 익히기 2/5'); FL('션이 달리는 발자국 — 보기만'); FM('찍히는 속도와 간격을 눈으로'); break;
      case 'B2': { const h = this._packLaneHalf(); this._b2Half = h; this.b2L.group.position.x = -h; this.b2R.group.position.x = h; FS('미리 익히기 3/5'); FL(h < 0.08 ? '반 보 앞 — 일자로 콕 밟기' : '링이 닫힐 때 — 발자국을 콕 밟기'); FM('맞춘 터치 0 / 8'); } break;
      case 'B3': FS('미리 익히기 4/5'); FL('1 → 2 → 3 순서로 세 걸음'); FM('세트 1 / 2'); break;
      case 'B4': FS('미리 익히기 5/5'); FL('박자만 보고 리듬 유지'); FM('링이 켜지는 순서대로'); break;
      case 'T2': FS('T-2'); FM('두 번 구르면 바로 · 가만히 있으면 자동'); break;
      case 'C1': FS('RUN 00:00'); break;
      case 'C2': FS('RUN 04:12 · SAFE'); FM('발자국 박자대로 · 앞 광점 = 션'); break;
      case 'C3': FS('RUN 08:40'); break;
      case 'C4': S(this.slotFS, '마지막 1KM · 스퍼트', { size: 0.055, color: CS.prism }); break;
      case 'C5': FS('마무리'); break;
      case 'FIN': FS('리포트'); break;
    }
  }

  _enterBasketball(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'BK_READY': FS('CURRY · STEP-BACK 3'); FL('READY'); break;
      case 'BK_A1': FS('WARM 1/3'); FL('스쿼트 — 마크 폭으로'); FM('천천히 8회', CS.sand); break;
      case 'BK_A2': FS('WARM 2/3'); FL('앞으로 뻗어 딛고 3초 꾸욱'); FM('링이 차면 발 교대', CS.sand); break;
      case 'BK_A3': FS('WARM 3/3'); FL('스팟에 공 튕기기 ×10'); FM('링에 정확히', CS.sand); break;
      case 'BK_T1': FS('T-1'); S(this.slotFL, 'STAGE CLEAR', { size: 0.12, color: CS.prism }); break;
      case 'BK_B1': FS('STEP 1/3'); FL('리듬 스텝 — ① 오른발 ② 왼발'); FM('가볍게, 리듬만'); break;
      case 'BK_B2': FS('STEP 2/3'); FL('③ 스텝 → ④ 디딤발 확!'); FM('멈춤이 슛의 시작'); break;
      case 'BK_B3': FS('LEARN 3/3'); FL('뒤로 0.48m — 링 닫히기 전 릴리즈'); FM('분리 → 착지 → 0.16초'); break;
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
    tickFlowArrows(t);   // 화살표(세션+팩) — 촉 이동 + 자루 LINE 유니폼 (단일 급이자)
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
    // 투사 흔들림을 세션 가이드에도 반영 — 토큰 필드(setShake)만 흔들리고 세션 존원·아크는
    // 고정이라 '새 가이드는 흔들림 미반영'(유저 지적). 같은 rig.shake를 동일 축으로 가산.
    if (this.rig?.shake) {
      this.root.position.x = this.rig.shake.x;
      this.root.position.z += this.rig.shake.y;
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

    // 실전 러닝(C)만 바닥 step 마크 숨김 — 달리며 밟을 과녁 제거(페이서·리듬만).
    // 페이스 익히기(P1/P2)는 1·2·3 밟기 마크 유지 = 연습 큐. "연습엔 큐, 실전엔 페이딩".
    // 농구 라이브는 제자리 스텝 드릴이라 스폿 유지 → 러닝 C에만 스코프.
    // P(페이스) = 원형 판정 토큰+이펙트만(유저 확정). C 실전만 마크 숨김(페이서·리듬 전용).
    this.tokens.liveHideFloorMarks = (this.sport === 'running' && !!st.live && id[0] === 'C');
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
      this._say('a2follow', '션', '자, 이제 같이 따라해봐요! 앞으로 크게 딛고 무릎 굽혀 버텨요.');
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
      if ((this._a3t ?? 0) > this.t) { H.sec = 0; H.cntL = 0; H.cntR = 0; H._beat = 0; H._prevLeft = undefined; H._shownL = -1; H._shownR = -1; }
      this._a3t = this.t;

      const guide = [H.fmL.group, H.fmR.group, H.arL, H.arR];
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
      // 비트 = x봇 하이니 케이던스(1.6배속 kneeTwist: 2.4/1.6=1.5s 사이클, 발당 0.75s)와 동기
      H._beat += dt;
      const PERIOD = 0.75, leftNow = (H._beat % (PERIOD * 2)) < PERIOD;
      // 올린 발 = Success 블룸으로 딱! + 그 발 카운트업. 반대발 = 고스트 대기.
      if (H._prevLeft !== undefined && leftNow !== H._prevLeft) {
        if (leftNow) H.cntL = Math.min(PER_FOOT, H.cntL + 1); else H.cntR = Math.min(PER_FOOT, H.cntR + 1);
        H._pop = 1;
      }
      H._prevLeft = leftNow;
      const onFM = leftNow ? H.fmL : H.fmR, offFM = leftNow ? H.fmR : H.fmL;
      onFM.glow(0.6 + 0.4 * H._pop); onFM.op(1);
      offFM.ghost(); offFM.op(0.45);
      // LINE 리프트 화살표 — 올리는 발 쪽이 펄스(크게), 반대쪽 은은
      const onAr = leftNow ? H.arL : H.arR, offAr = leftNow ? H.arR : H.arL;
      onAr.scale.setScalar(1 + 0.25 * H._pop); offAr.scale.setScalar(0.85);
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
      this.liveSpeed = Math.max(0.12, 1 - this.t / 2.8);   // 실제 감속
      this.c5stripes.forEach((s, i) => { s.material._gainK = (0.7 - i * 0.13) * (0.5 + 0.5 * Math.sin(this.t * 3 - i)); });
      if (this.liveSpeed <= 0.13 && this.t > 3.2) { this.liveSpeed = 1; this.stageIdx = this.stages.findIndex(s2 => s2.id === 'FIN'); this.t = 0; this._enter(); return; }
    }
  }

  _updateBasketball(id, st, beat, FMU) {
    // 박자 바운스
    if (id === 'BK_A2' || id === 'BK_B2' || id === 'BK_C2') this.bobY = 0.026 * Math.abs(Math.sin(Math.PI * this.t / 0.7));
    else if (id === 'BK_A3' || id === 'BK_C3') this.bobY = 0.022 * Math.abs(Math.sin(Math.PI * this.t / 0.55));
    else if (id[3] === 'A' || id[3] === 'B') this.bobY = 0.007 * Math.sin(this.t * 1.8);
    else this.bobY = 0;

    if (id === 'BK_READY' || id === 'BK_T1') {
      const tap = id === 'BK_READY' ? this.bkTap : this.bkTap1; const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      tap.children[0].material.opacity = 0.5 + 0.45 * k; tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
      if (id === 'BK_T1' && this.t >= 4.5) { this.next(); return; }
    } else if (id === 'BK_A1') {
      // 스쿼트 — 발폭 마크에 서서 골반 하강 시 아크 채움, 회당 카운트 (프로브: 골반 높이)
      const REPS = 8, DEMO = 3.0, DOWN = 0.85;
      const pb = this.xbot?.getProbes?.();
      const inSquat = pb?.hips && pb.hips.y < DOWN;
      if (inSquat && !this._bkSq) { this.bkA1count = (this.bkA1count || 0) + 1; }
      this._bkSq = inSquat;
      if ((this._bkA1t ?? 0) > this.t) this.bkA1count = 0;
      this._bkA1t = this.t;
      this.bkA1arc.setProg(Math.max(0.001, inSquat ? 1 : 0.001));
      if (this.t < DEMO) { this.demoActive = true; FMU('먼저 보세요 — 마크 폭으로 서서 스쿼트', CS.sand); }
      else {
        this._say('bka1go', '커리', '이제 같이 — 마크 폭으로 서서, 천천히 앉았다 일어나요. 여덟 번.');
        FMU(`스쿼트 ${Math.min(REPS, this.bkA1count || 0)} / ${REPS}`, CS.sand);
        if ((this.bkA1count || 0) >= REPS) { this.next(); return; }
      }
    } else if (id === 'BK_A2') {
      // 사이드 런지 프레스 — 러닝 A1과 동일 문법: 옆 원을 밟아 누르면 그쪽 아크 채움
      const NEED = 2.6, REPS = 4, DEMO = 4.6;
      const dt = Math.max(0, this.t - (this._bkA2t ?? this.t));
      if ((this._bkA2t ?? 0) > this.t) { this.bkA2count = 0; this.bkA2press.fill = 0; }
      this._bkA2t = this.t;
      const pb = this.xbot?.getProbes?.();
      const P = this.bkA2press;
      let pressing = false;
      if ((this.a2Guide || 'A') === 'A') {
        for (const f of [pb?.footL, pb?.footR]) {
          if (f && f.y < 0.09 && Math.hypot(f.x - P.cx, f.z - P.cz) < 0.27) pressing = true;
        }
      } else if (front && front.y < 0.09 && pb && Math.abs(pb.footL.z - pb.footR.z) > 0.4) {
        pressing = true;   // B안 판정 = 앞발 접지 + 런지 스프레드(깊이 유지 중)
      }
      P.fill = pressing ? Math.min(1, P.fill + dt / NEED) : Math.max(0, P.fill - dt * 0.6);
      P.arc.setProg(Math.max(0.001, P.fill));
      P.ring.setOp(pressing ? 0.95 : 0.45);
      if (P.fill >= 1) {
        this.bkA2count = (this.bkA2count || 0) + 1; P.fill = 0;
        const wp = new THREE.Vector3(); P.arc.getWorldPosition(wp); this.onPress?.(wp);
      }
      if (this.t < DEMO) { this.demoActive = true; FMU('먼저 보세요 — 앞으로 뻗어 딛고 3초 꾸욱', CS.sand); }
      else {
        this._say('bka2go', '커리', '이제 같이 — 앞으로 쭉 뻗어 딛고 3초간 꾸욱 눌러요.');
        FMU(`원 눌러 채우기 ${Math.min(REPS, this.bkA2count || 0)} / ${REPS}`, CS.sand);
        if ((this.bkA2count || 0) >= REPS) { this.next(); return; }
      }
    } else if (id === 'BK_A3') {
      // 드리블 스팟 — 공의 '실제 바운스 위치'를 감지해 스팟 명중 판정 (공 반응형 지면 UI).
      // 명중: 임팩트 버스트+카운트 / 빗나감: 그 지점에 흐릿한 링(어디에 튕겼는지 피드백).
      const BT = 0.5, k = 1 - beat(BT);
      this.bkA3ring.setOp(0.35 + 0.55 * k); this.bkA3ring.scale.setScalar(0.9 + 0.4 * (1 - k));
      const ball = this.xbot?.ball;
      if (ball && ball.visible) {
        const bw = new THREE.Vector3(); ball.getWorldPosition(bw);
        const desc = (this._a3py ?? bw.y) > bw.y;
        if (this._a3desc && !desc && bw.y < 0.35) {   // 하강→상승 전환 = 바운스 순간
          const rw = new THREE.Vector3(); this.bkA3ring.getWorldPosition(rw);
          if (Math.hypot(bw.x - rw.x, bw.z - rw.z) < 0.35) {
            this._a3hit = (this._a3hit || 0) + 1;
            this.bkA3ring.setOp(1); this.onPress?.(new THREE.Vector3(rw.x, 0.02, rw.z));
          } else {
            const lp = this.bkA3miss.parent.worldToLocal(new THREE.Vector3(bw.x, 0.013, bw.z));
            this.bkA3miss.position.x = lp.x; this.bkA3miss.position.z = lp.z; this._a3missT = this.t;
          }
        }
        this._a3desc = desc; this._a3py = bw.y;
      }
      this.bkA3miss.setOp(this._a3missT != null ? Math.max(0, 0.6 - 0.6 * (this.t - this._a3missT)) : 0);
      const hits = this._a3hit || 0;
      FMU(`스팟에 튕기기 · ${Math.min(10, hits)} / 10`, hits >= 10 ? CS.prism : CS.sand);
      if (hits >= 10 || this.t >= 26) { this.next(); return; }
    } else if (id === 'BK_B1') {
      // 스텝 스쿨 1막 — 드라이브 리듬 스텝: 한 번에 두 걸음(①②)만, 절반 속도 4회 반복.
      // 나머지 마크는 문맥 dim(전체 경로는 보이되 집중은 앞 두 발) — 배우기 쉬움 우선 재설계.
      const DUR = this.xbot?.actions?.cmu_crossover_shot?.dur || 4;
      const lt = this.t % DUR;
      this.bkGuideMarks.forEach((fm, i) => {
        if (i >= 2) {
          fm.op(0.32); fm.countdown(-1);
          this.bkGuideNums[i].material.opacity = 0.2; placeMarkNum(this.bkGuideNums[i]);
          return;
        }
        const d = BK_GUIDE[i].t - lt;
        if (d > 0.8 || d < -0.5) { fm.op(0.6); fm.countdown(-1); }
        else if (d > 0) { fm.op(1); fm.countdown(1 - d / 0.8); }
        else fm.glow(Math.max(0, 1 + d / 0.5));
        this.bkGuideNums[i].material.opacity = MARK_NUM.opacity(d > 0.8 || d < -0.5 ? 0 : (d > 0 ? 1 : 2));
        placeMarkNum(this.bkGuideNums[i]);
        // 접지 순간 1회 버스트 (보상 언어 통일)
        if (this._bkG1lt != null && this._bkG1lt < BK_GUIDE[i].t && lt >= BK_GUIDE[i].t) {
          const wp = new THREE.Vector3(); fm.group.getWorldPosition(wp); this.onPress?.(wp);
        }
      });
      // 연결 화살표: ①→② 전이만 활성 — '다음 발이 갈 곳'
      this.bkGuideArrows.forEach((ar, i) => {
        const on = i === 0 && lt >= BK_GUIDE[0].t;
        ar.traverse(o => { if (o.material) o.material.opacity = on ? 0.95 : 0.12; });
      });
      this.bkJumpRing.setOp(0.1);
      this.bkJumpTxt.userData.plane.material.opacity = 0.15;
      this._bkG1lt = lt < (this._bkG1lt ?? 0) ? -0.01 : lt;   // 사이클 랩 처리
      FMU(`리듬 스텝 ① 오른발 → ② 왼발 · ${Math.min(3, Math.floor(this.t / DUR) + 1)} / 3`, CS.sand);
      if (this.t >= 3 * DUR + 0.4) { this.next(); return; }
    } else if (id === 'BK_B2') {
      // 스텝 스쿨 2막 — 플랜트&브레이크: ③스텝→④디딤발 확! 구간 [0.9,2.2]만 절반 속도 4회.
      // ①②는 이미 익힌 문맥 dim, ⑤⑥은 다음 막 예고 dim.
      const RATE = 0.5, CYC = 3.2;   // 클립 0~2.2(플랜트) 재생 + 1s 플랜트 홀드 = 슛 없는 순수 감속 시연
      const ltc = Math.min((this.t * RATE) % CYC, 2.2);   // 클립 시간축(봇과 동일 매핑)
      let done = 0;
      this.bkB2.forEach((f, i) => {
        if (i < 2 || i > 3) {
          f.countdown(-1); f.op(0.32);
          this.bkB2nums[i].material.opacity = 0.2; placeMarkNum(this.bkB2nums[i]);
          return;
        }
        const d = BK_GUIDE[i].t - ltc; let ph;
        if (d > 1.0 || d < -0.6) { f.countdown(-1); f.op(0.6); ph = 0; }
        else if (d > 0) { f.op(1); f.countdown(1 - d); ph = 1; }
        else { f.glow(Math.max(0, 1 + d / 0.6)); ph = 2; }
        if (ltc > BK_GUIDE[i].t) done++;
        this.bkB2nums[i].material.opacity = MARK_NUM.opacity(ph);
        placeMarkNum(this.bkB2nums[i]);
      });
      // 플랜트(4번) 접지 순간 → 브레이크 스트라이프 발사(발 뒤로 퍼지는 감속 잔상)
      const dP = BK_GUIDE[3].t - ltc;
      this.bkBrakeBar.material._gainK = dP > 0 && dP < 1 ? 0.5 + 0.5 * (1 - dP) : (dP <= 0 && dP > -0.8 ? 1 : 0.45);
      this.bkBrakeStripes.forEach((st, i) => {
        const k = dP <= 0 && dP > -0.9 ? Math.max(0, 1 + dP / 0.9 - i * 0.18) : 0;
        st.material._gainK = k;
      });
      FMU(`③ 스텝 → ④ 디딤발에서 확! · ${Math.min(3, Math.floor(this.t * RATE / CYC) + 1)} / 3`, CS.sand);
      if (this.t >= 3 * CYC / RATE + 0.4) { this.next(); return; }
    } else if (id === 'BK_B3') {
      // 백스텝 분리·릴리즈 — 봇은 플랜트→백스텝→착지→슛 구간을 0.55배로 반복(위상은 main),
      // 바닥: 플랜트 카운트다운 → 분리 화살표 점등 → 착지존 글로우 → 릴리즈 링 수축(0.16s×5 슬로우)
      // 합성 시연 사이클(4.2s): 드리블 → 개더/플랜트 1.45 → 백스텝 분리 → 착지 1.95 → 릴리즈 2.35
      const CYC = 4.2, PLT = 1.45, LND = 1.95, REL = 2.35;
      const ltc = this.t % CYC;                   // 실속도(봇 stepbackDemo와 동일 시간축)
      const dPl = PLT - ltc;                      // 플랜트까지
      this.bkB3plant.op(0.6 + 0.4 * Math.max(0, 1 - Math.abs(dPl)));
      if (dPl > 0 && dPl < 0.5) this.bkB3plant.countdown(1 - dPl / 0.5); else this.bkB3plant.countdown(-1);
      const sepOn = ltc >= PLT && ltc < LND;
      this.bkSepArrow.traverse(o => { if (o.material) o.material.opacity = sepOn ? 0.95 : 0.3; });
      const sepProg = Math.max(0, Math.min(1, (ltc - PLT) / (LND - PLT)));
      this.bkRuler.forEach((tk, i) => { tk.material._gainK = ltc >= PLT && sepProg >= i / 2 ? 1 : 0.35; });
      // 고스트 스텝: 분리 구간 동안 플랜트→착지로 미끄러짐(이즈아웃), 그 외엔 플랜트에서 대기
      const ge = 1 - Math.pow(1 - sepProg, 2.2);
      this.bkGhost.forEach((f, i) => {
        f.group.position.z = this._bkGhostFrom + (this._bkGhostTo[i] - this._bkGhostFrom) * ge;
        f.op(sepOn ? 0.8 : (sepProg >= 1 ? 0.15 : 0.3));
      });
      // 단계 뱃지 점등: 지금 할 것 하나만 밝게
      const phase = ltc < PLT ? 0 : (sepProg < 1 ? 1 : 2);
      this.bkBadges.forEach((b, i) => { b.userData.plane.material.opacity = i === phase ? 0.95 : 0.25; });
      this.bkLand.forEach((f, i) => {
        const tL = LND + i * 0.05, dL = tL - ltc;
        if (dL > 0.6 || dL < -0.9) { f.op(0.55); f.countdown(-1); }
        else if (dL > 0) { f.op(0.95); f.countdown(1 - dL / 0.6); }
        else f.glow(Math.max(0, 1 + dL / 0.9));
      });
      // 릴리즈 링: 착지(2.93) 순간부터 0.16s×5(슬로우 환산) 동안 수축 — 닫히기 전 슛
      const relW = 0.16 * 5, dR = ltc - REL;   // 0.16s 릴리즈 창 ×5 슬로우 표시
      if (dR >= 0 && dR < relW + 0.35) {
        const k = Math.min(1, dR / relW);
        this.bkRelRing.setOp(0.95 - 0.5 * k);
        this.bkRelRing.scale.setScalar(1.35 - 0.75 * k);
        this.bkRelTxt.userData.plane.material.opacity = 0.95;
      } else { this.bkRelRing.setOp(0.12); this.bkRelRing.scale.setScalar(1.35); this.bkRelTxt.userData.plane.material.opacity = 0.4; }
      FMU(`분리 0.48m → 착지 → 0.16초 안에 릴리즈 · ${Math.min(3, Math.floor(this.t / CYC) + 1)} / 3`, CS.prism);
      if (this.t >= 3 * CYC + 0.5) { this._gateAdvance(); return; }
    } else if (id === 'BK_C1') {
      const n = Math.max(1, 3 - Math.floor(this.t)); if (n !== this._lastCount) { this._setCount(n, CS.ink); this._lastCount = n; }
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BK_C2' || id === 'BK_C3') {
      // 라이브 — 실제 컷 재생, 무릎 빔프가 봇 따라 움직임(팩 토큰이 주인공)
      if (this.t >= st.dur) { this.next(); return; }
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
