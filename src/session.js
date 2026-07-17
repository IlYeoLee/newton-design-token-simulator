import * as THREE from 'three';
import { WALL_Z } from './scene.js';
import { lutColor, GLYPHS, drawGlyph, footSlot, footSDFTexture, FXP } from './fxlut.js';
import { MARK_NUM, drawSweepBand, drawStanceBox, drawPunchLine } from './fx-core.js';
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
export const SCFG = { a1Rep: 2.0, a2Hold: 10, a3Swing: 1.8, a4Beat: 0.6, b1Beat: 0.6, b2Beat: 0.7, b3Step: 1.1, b4Beat: 0.55 };   // A 템포 = 실제 스트레칭 속도 (발목 1바퀴 2s·펌프 1.6s·스윙 1.8s — 빠르면 못 따라함)
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
  if (!drawGlyph(g2, String(text), 64, 64, 96)) {
    g2.fillStyle = 'rgba(255,240,220,0.95)';
    g2.font = '300 86px -apple-system, sans-serif';
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
  return g;
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
  sweepBand: { w: 1, glow: 1, tempo: 1, h: 1, base: 0.3, edge: 1 },
  stanceBox: { w: 1, glow: 1, tempo: 1, dash: 1, round: 0.2, feet: 1 },
  punchLine: { w: 1, glow: 1, tempo: 1, node: 1, numS: 1, dash: 0 },
};
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
  const panel = { kind, c, tex, m, prog: null, pts: null };
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
    const P = (FXP.prims && FXP.prims[p.kind]) || PRIM_DEFAULTS[p.kind];
    if (p.kind === 'sweepBand') drawSweepBand(g, 256, P, look, t, livePrimEnv(), p.prog);
    else if (p.kind === 'stanceBox') drawStanceBox(g, 256, P, look, t, livePrimEnv());
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
  // 파생 ② 스탠스 박스 — fx-core 정본 드로잉 (LINE 상속 둘레 + MARK 헤일로 + FOOT 글리프)
  const m = primPanel('stanceBox', w / 0.636, true);   // 캔버스 내 박스 폭비 140/220
  m.material.opacity = op;
  m.position.set(x, y, WZ); return m;
}
function sweepBand(x0, y0, x1, y1, color) {
  // 파생 ① 스윕 밴드 — fx-core 정본 (트랙+진행 채움+전연 백열). prog는 장면이 구동(_prim.prog).
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const m = primPanel('sweepBand', (dist + 0.4) / 0.782, true);   // 캔버스 내 밴드 길이비
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WZ + 0.001);
  m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  m.renderOrder = 5; return m;
}
function wallTap() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.07, 32), flatMat(BRAND.prism, 0.95)); r.position.x = (i - 0.5) * 0.18; g.add(r); }   // 탭 = 입력 어포던스(토큰 아님) 원복
  const label = makeTextPlane('TAP ×2', { size: 0.055, color: CS.prism }); label.position.set(0, -0.16, 0.001); g.add(label);
  g.position.z = WZ; g.renderOrder = 7; g.userData.el = { type: 'tap', wall: true }; return g;
}

// ─────────────────────────────────────────────────────────────
// 종목별 스테이지 스크립트. 공통 로직은 데이터 필드로 구동:
//   live=실전 팩 재생 · boost=가속 · cooldown=감속정지 · count=카운트다운
// 스테이지별 고유 비주얼은 sport-dispatch(_build/_enter/_update)로 처리.
export const STAGES = {
  running: [
    { id:'READY', label:'준비 — 발 두 번 구르면 시작', voice:['시스템','션의 마지막 1km 페이스로 달려 볼 거예요. 준비되면 제자리에서 발을 두 번 굴러 주세요.'], wear:'SAFE 대기', foot:'발 두 번 구르기 → 시작' },
    { id:'A1', label:'A · 준비운동 1/4 — 발목 돌리기', voice:['션','먼저 발목부터 풀어요. 한쪽 발끝을 앞의 링에 올리고, 링을 따라 발목으로 크게 원을 그려요 — 왼발 여덟 번, 오른발 여덟 번.'], wear:'개입 없음 (가동범위 측정)' },
    { id:'A2', label:'A · 준비운동 2/4 — 까치발 들었다 내리기', voice:['션','이번엔 종아리예요. 왼발을 앞 발자국에 올리고, 뒤꿈치를 천천히 들어 까치발 — 그리고 바닥까지 내려요. 열 번.'], hap:'10회 종료 진동 1회' },
    { id:'A3', label:'A · 준비운동 3/4 — 다리 앞뒤로 흔들기', voice:['션','골반에 손을 얹고 한쪽 다리에 힘을 빼요. 시계추처럼 앞뒤로 — 발끝이 빛나는 원까지 갔다 오면 딱 좋아요. 열 번.'], foot:'완료 후 두 번 구르기 → 다음' },
    { id:'A4', label:'A · 준비운동 4/4 — 박자 맞춰 제자리 걷기', voice:['션','이제 내 걸음 박자로 제자리 걷기예요. 발자국이 켜지는 쪽 발을 그 박자에 맞춰 밟아요. 처음엔 천천히 — 점점 빨라져요.'], hap:'워밍업 박자 (약)', wear:'낮은 강도 보조 시작' },
    { id:'T1', label:'몸풀기 끝 — 다음은 미리 익히기', voice:['시스템','몸 다 풀렸어요. 발 두 번 구르면 다음으로 가요.'], foot:'발 두 번 구르기 → 미리 익히기' },
    { id:'B1', label:'B · 미리 익히기 1/5 — 박자 듣기', voice:['션','이게 마지막 1km에서 쓸 박자예요. 아직 발은 가만히 — 소리와 불빛만 느껴요. 하나, 둘.'], hap:'박자 동기 (약)' },
    { id:'BW', label:'B · 미리 익히기 2/5 — 션의 발자국 구경', voice:['션','이제 내 걸음을 보여줄게요. 발자국이 찍히는 속도와 간격을 눈으로만 따라와요.'], cue:'고스트 발자국 리플레이 (보기 전용)' },
    { id:'B2', label:'B · 미리 익히기 3/5 — 발자국 따라 밟기', voice:['션','내 발자국이 반 보 앞에 미리 떠요. 링이 다 닫히는 순간, 그 위를 가볍게 콕 밟았다 돌아와요.'], cue:'고스트 예고 → 성공 순간만 글로우' },
    { id:'B3', label:'B · 미리 익히기 4/5 — 세 걸음 이어 밟기', voice:['션','이제 진짜로 걸어요. 숫자 1, 2, 3 순서대로 앞으로 세 걸음.'], cue:'스텝 콤보 ×2세트' },
    { id:'B4', label:'B · 미리 익히기 5/5 — 말 없이 박자만', voice:['션','이제 설명은 끝. 불빛 박자만 보고 리듬을 지켜요.'], foot:'발 두 번 구르기 → 실전 준비' },
    { id:'T2', label:'5초 뒤 실전 시작', voice:['션','5초 뒤에 진짜 달리기예요. 준비됐으면 발 두 번 구르면 바로 가요.'], dur:5, count:true, foot:'두 번 구르기 = 바로 시작 · 가만히 있으면 자동' },
    { id:'C1', dur:3, label:'C · 실전 — 출발 카운트', voice:['시스템','3, 2, 1.'], hap:'시작 타이밍 진동', foot:'두 번 구르기 → 출발 (이후 잠금)' },
    { id:'C2', dur:7, live:true, label:'C · 실전 — 션과 나란히 달리기', voice:['션','좋아요, 그 박자 그대로. 앞의 광점이 나예요 — 옆에 붙어요.'], wear:'SAFE 착지 안정화' },
    { id:'C3', dur:7, live:true, label:'C · 실전 — 흔들리면 다시 붙기', voice:['션','박자! 나한테 다시 맞춰요.'], hap:'착지 보조 2박' },
    { id:'C4', dur:7, live:true, boost:true, label:'C · 실전 — 마지막 1km 스퍼트', voice:['션','여기서부터 마지막 1km. 나한테 붙어요.'], wear:'BOOST 추진 보조 · 리듬 저하 시 강도↑', cue:'구간 종료 일치율 표시' },
    { id:'C5', live:true, cooldown:true, label:'C · 실전 — 천천히 멈추기', voice:['시스템','여기까지. 잘 달렸어요.'], hap:'완료 진동' },
    { id:'FIN', label:'오늘의 리포트', voice:['시스템','기록을 앱으로 보냈어요. 바닥에 내 착지와 션의 발자국을 겹쳐 봤어요.'], cue:'션 발자국 위에 내 착지 겹쳐 보기' },
  ],
  basketball: [
    { id:'BK_READY', label:'0 · READY — 준비', voice:['시스템','커리의 스텝백 3점 팩. 준비되면 발을 두 번 탭하세요.'], wear:'SAFE 대기', foot:'두 번 탭 → 시작' },
    { id:'BK_A1', label:'A · 준비운동 1/3 — 스탠스·무릎', voice:['커리','어깨너비 스탠스. 무릎 살짝 굽히고 발끝은 앞.'], wear:'개입 없음 (자세 측정)' },
    { id:'BK_A2', label:'A · 준비운동 2/3 — 사이드 풋워크', voice:['커리','좌우로 사이드 스텝. 발이 안 꼬이게, 넓게.'], hap:'스텝 박자 (약)' },
    { id:'BK_A3', label:'A · 준비운동 3/3 — 리듬 드리블', voice:['커리','제자리 드리블로 리듬 잡아요. 하나, 둘.'], wear:'낮은 강도 보조 시작' },
    { id:'BK_T1', label:'T-1 · STAGE CLEAR → 사전 익히기', voice:['시스템','몸 풀렸어요. 탭 두 번이면 다음으로.'], foot:'두 번 탭 → 사전 익히기' },
    { id:'BK_B1', label:'B · 사전 익히기 1/3 — 스텝백 궤적 보기', voice:['커리','내 스텝백 발 궤적이에요. 먼저 눈으로 따라가요.'], cue:'Ghost 궤적 리플레이' },
    { id:'BK_B2', label:'B · 사전 익히기 2/3 — 스텝 분해 밟기', voice:['커리','순서대로 밟아요. 하나 — 뒤로 — 셋.'], cue:'Step Combo ×3' },
    { id:'BK_B3', label:'B · 사전 익히기 3/3 — 컷 방향·감속', voice:['커리','디딤발에서 확 멈춰요. 감속이 슛의 시작이에요.'], foot:'두 번 탭 → 실전 준비' },
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
    // 페이스 라이트 — '션의 현재 위치' 광점 (C 실전 상설, 소형 존 원 = 마크와 크기·위치로 구분).
    // 페이스 일치 = 발앞 1.6m 고정, 내가 늦으면 멀어짐(션이 앞서감) — 타이밍 오차의 공간 번역.
    this.paceLight = floorRing(0, -1.6, 0.09, 0.105, BRAND.red, 0.85);
    this.paceLight.visible = false;
    this.dirSlot = new THREE.Group();   // C 방향 피드백 글리프 (착지점 추종, _dirCue)
    this.root.add(this.slotFS, this.slotFL, this.slotFM, this.dirSlot, this.paceLight);

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
    this.a1L = new FootMark('left').at(0, -1.00, 1.15); g.add(this.a1L.group);
    this.a1R = new FootMark('right').at(0, -1.00, 1.15); g.add(this.a1R.group);
    this.a1arc = floorArc(0, -1.00, BRAND.sand); g.add(this.a1arc);

    g = this._mk('A2');
    this.a2 = [];
    for (let i = 0; i < 2; i++) {          // 0=왼발 앞, 1=오른발 앞 (좌우 교대)
      const pg = new THREE.Group(); g.add(pg);
      const sx = i === 0 ? 1 : -1;
      const front = new FootMark(i === 0 ? 'left' : 'right').at(-0.13 * sx, -1.30);
      const back = new FootMark(i === 0 ? 'right' : 'left').at(0.14 * sx, -1.00);
      // 뒤꿈치 펌프 진행은 back 발형 자신의 Hold 코닉 림(발 테두리를 따라 도는 라인)이 전담.
      // 예전에 여기 있던 히트색 floorRing은 MARK Preview 상태(숨쉬는 필+윤곽)로 통째로
      // 렌더돼 발형 Hold 위에 "원형 홀드처럼 보이는 별개 토큰"이 겹침 — 발·링·글로우
      // 3겹이 뭉개져 저품질로 보이던 주범(유저 스크린샷 확인). 링 제거, 발형만.
      pg.add(front.group, back.group);
      this.a2.push({ pg, front, back });
    }

    g = this._mk('A3');
    // 다리 스윙 = 지면이 판정 못 하는 공중 동작 — 판정형 화살표 대신 '스윙 종점 존' 2개가
    // 진폭을 공간으로 보여주고 교대 글로우가 박자를 보여줌 (축발 + 존 2 = 단서 3개).
    this.a3foot = new FootMark('left').at(-0.05, -1.14, 1.1); g.add(this.a3foot.group);
    this.a3zones = [floorRing(0.22, -0.92, 0.10, 0.115, BRAND.red, 0.3), floorRing(0.22, -1.42, 0.10, 0.115, BRAND.red, 0.3)];
    g.add(this.a3zones[0], this.a3zones[1]);

    g = this._mk('A4');
    this.a4L = new FootMark('left').at(-0.17, -1.14); g.add(this.a4L.group);
    this.a4R = new FootMark('right').at(0.17, -1.14); g.add(this.a4R.group);

    g = this._mk('T1');
    this.tap1 = this._tap('running'); this.tap1.position.set(0, 0.013, -1.1); g.add(this.tap1);

    g = this._mk('B1');
    // 박자 메트로놈 = MARK 원형 하나(카탈로그 그대로 — 링 2겹 스택은 카탈로그에 없는 종이었음)
    // + 숫자 글리프 1·2는 마크 '안' 오버레이(글리프 단독 부유 금지 — 토큰 조합 규약)
    this.b1ring = floorRing(0, -1.35, 0.24, 0.26, BRAND.red, 0.9);
    this.b1nums = [floorNum('1', 0, -1.35, 0.15), floorNum('2', 0, -1.35, 0.15)];
    g.add(this.b1ring, this.b1nums[0], this.b1nums[1]);

    // BW 션 발자국 보기 — '시범' 단계: 션의 실측 케이던스·보폭이 발자국으로 찍히며 멀어짐.
    // 학습 사이클(보기→듣기→겹쳐→혼자)의 '보기' 공백을 메움 — 유일한 단서 = 발자국 3개.
    g = this._mk('BW');
    this.bwFeet = [];
    for (let i = 0; i < 3; i++) {
      const fm = new FootMark(i % 2 ? 'right' : 'left');
      fm.op(0); g.add(fm.group); this.bwFeet.push(fm);
    }

    g = this._mk('B2');
    // 반 보 앞 스텝터치 드릴 — '겹쳐 밟기' 마크는 반드시 도달 부채꼴(0.5~1.15m) '안'에.
    // 구 z=1.14는 도달 한계선(런지급) — 제자리에서 못 밟는 위치에 밟기 서사를 붙인 거짓이었음
    // (유저 지적). 진짜 제자리 착지점(자기 발밑)은 무릎 빔이 원리적으로 못 비춤 — 그래서
    // 이 단계의 정직한 동작 정의는 '반 보 앞 터치'(실존 러닝 드릴)다.
    this.b2L = new FootMark('left').at(-0.17, -1.0); g.add(this.b2L.group);
    this.b2R = new FootMark('right').at(0.17, -1.0); g.add(this.b2R.group);

    g = this._mk('B3');
    g.add(laneLine(BRAND.red, 0.2, -3.0));
    this.b3 = []; this.b3nums = [];
    const bp = [[-0.17, -1.14], [0.18, -1.37], [-0.14, -1.60]];
    for (let i = 0; i < 3; i++) {
      const right = i % 2 === 1;
      const fm = new FootMark(right ? 'right' : 'left').at(bp[i][0], bp[i][1]);
      g.add(fm.group);
      this.b3.push(fm); this.b3nums.push(attachMarkNum(fm, i + 1, right));
    }

    g = this._mk('B4');
    g.add(laneLine(BRAND.red, 0.2, -3.0));
    this.b4foot = new FootMark('left').at(0.05, -1.14); g.add(this.b4foot.group);
    this.b4rings = [floorRing(-0.05, -1.39, 0.15, 0.17, BRAND.red, 0.6), floorRing(0.05, -1.56, 0.15, 0.17, BRAND.red, 0.35)];
    g.add(this.b4rings[0], this.b4rings[1]);

    g = this._mk('C1');
    g.add(floorRing(0.03, -2.6, 0.15, 0.17, BRAND.red, 0.5));

    this._mk('C2');  // 라이브 — 팩 토큰이 그대로 흐름 (오버레이 없음)

    g = this._mk('C3');  // 라이브 + F-CUE 오버레이 (러너를 따라감)
    this.c3cue = floorText('박자', 0.45, -2.1, { size: 0.13, color: CS.red, weight: 800 }); g.add(this.c3cue);

    g = this._mk('C4');  // 라이브 + BOOST 프리즘 레인 오버레이
    g.add(laneLine(BRAND.prism, 0.4, -3.2));

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

    // A1 스탠스·무릎 — 어깨너비 두 발 기준형(중립) + 무릎 굽힘 아크
    g = this._mk('BK_A1');
    this.bkA1L = new FootMark('left').at(-0.22, -1.9); g.add(this.bkA1L.group);
    this.bkA1R = new FootMark('right').at(0.22, -1.9); g.add(this.bkA1R.group);
    g.add(floorArc(0, -2.25, BRAND.sand));

    // A2 사이드 풋워크 — 좌우 존으로 스텝 이동
    g = this._mk('BK_A2');
    this.bkA2foot = new FootMark('left').at(0, -1.9); g.add(this.bkA2foot.group);
    this.bkA2L = floorRing(-0.42, -1.9, 0.16, 0.18, BRAND.red, 0.4); g.add(this.bkA2L);
    this.bkA2R = floorRing(0.42, -1.9, 0.16, 0.18, BRAND.red, 0.4); g.add(this.bkA2R);

    // A3 리듬 드리블 — 제자리 스탠스 + 박자 링
    g = this._mk('BK_A3');
    g.add(new FootMark('left').at(-0.2, -1.9).group);
    g.add(new FootMark('right').at(0.2, -1.9).group);
    this.bkA3ring = floorRing(0, -1.5, 0.10, 0.12, BRAND.red, 0.8); g.add(this.bkA3ring);

    g = this._mk('BK_T1');
    this.bkTap1 = this._tap('boxing'); this.bkTap1.position.set(0, 0.013, -1.1); g.add(this.bkTap1);

    // B1 스텝백 궤적 보기 — 3발 궤적 + 곡선 레인 (Ghost 리플레이)
    g = this._mk('BK_B1');
    const bkp = [[-0.1, -1.6], [0.05, -2.15], [0.3, -2.05]];  // 컷인 → 스텝백(뒤로 옆)
    this.bkB1 = [];
    for (let i = 0; i < 3; i++) {
      const fm = new FootMark(i % 2 === 0 ? 'left' : 'right').at(bkp[i][0], bkp[i][1]);
      g.add(fm.group); this.bkB1.push(fm);
    }
    this.bkPath = bkp;

    // B2 스텝 분해 밟기 — 같은 3발 + 순서 숫자는 발 '안' 글리프 오버레이 (MARK_NUM 규약,
    // 러닝 B3와 동일 — 발 옆 부유 글리프는 카탈로그에 없는 조합)
    g = this._mk('BK_B2');
    this.bkB2 = []; this.bkB2nums = [];
    for (let i = 0; i < 3; i++) {
      const right = i % 2 === 1;
      const fm = new FootMark(right ? 'right' : 'left').at(bkp[i][0], bkp[i][1]);
      g.add(fm.group);
      this.bkB2.push(fm); this.bkB2nums.push(attachMarkNum(fm, i + 1, right));
    }

    // B3 컷 방향·감속 — 디딤발 + 감속 스트라이프 + 방향 화살표
    g = this._mk('BK_B3');
    this.bkB3foot = new FootMark('right').at(0.28, -2.0, 1.15); g.add(this.bkB3foot.group);
    g.add(floorArrow(-0.1, -1.5, -35, BRAND.coral, 0.42));
    this.bkB3stripes = [];
    for (let i = 0; i < 3; i++) { const st = floorStripe(0.28, -1.6 - i * 0.26, 0.42 - i * 0.06, BRAND.coral, 0.7 - i * 0.15); g.add(st); this.bkB3stripes.push(st); }

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
    // 가드 존 기준: 얼굴 앞 (y≈1.35), 타겟은 그 위 (y≈1.14 실제 판정 높이 Y0=0.73+ny)
    const TX = -0.13, TY = 1.14;   // 벽 타겟 중심 (tokens LAYOUT.boxing WALL 매핑)
    let g = this._mk('BX_READY');
    g.add(guardBox(0, 1.35, 0.5, 0.42, BRAND.dim, 0.7));
    this.bxTap = wallTap(); this.bxTap.position.set(0, 0.9, WZ); g.add(this.bxTap);

    // A1 목·어깨 — 회전 아크(어깨 좌우)
    g = this._mk('BX_A1');
    this.bxA1arcL = wallArc(-0.35, 1.4, 0.14, 0.165, BRAND.sand, Math.PI*0.15, Math.PI*1.4); g.add(this.bxA1arcL);
    this.bxA1arcR = wallArc(0.35, 1.4, 0.14, 0.165, BRAND.sand, Math.PI*0.15, Math.PI*1.4); g.add(this.bxA1arcR);

    // A2 스텝 인·아웃 — 위/아래 방향 존
    g = this._mk('BX_A2');
    this.bxA2near = wallRing(0, 1.0, 0.14, 0.16, BRAND.red, 0.4); g.add(this.bxA2near);
    this.bxA2far = wallRing(0, 1.5, 0.14, 0.16, BRAND.red, 0.4); g.add(this.bxA2far);

    // A3 잽 폼 — 스윕 + 타겟
    g = this._mk('BX_A3');
    g.add(sweepBand(0.15, 1.15, TX, TY, BRAND.red));
    this.bxA3ring = wallRing(TX, TY, 0.12, 0.14, BRAND.red, 0.8); g.add(this.bxA3ring);

    g = this._mk('BX_T1');
    this.bxTap1 = wallTap(); this.bxTap1.position.set(0, 0.9, WZ); g.add(this.bxTap1);

    // B1 가드 유지 — 가드 박스 + 홀드 링 (채움)
    g = this._mk('BX_B1');
    g.add(guardBox(0, 1.35, 0.5, 0.42, BRAND.red, 0.8));
    // 카탈로그 Hold 림은 회색 트랙+진행 스윕을 한 림에 내장 — 배경 링 별도 스택 금지(러닝 B1과 동일 정리)
    this.bxHold = wallArc(0, 1.35, 0.20, 0.235, BRAND.sand, Math.PI/2, 0.001, 0); g.add(this.bxHold);

    // B2 회피 스텝 — 회피형 점선 존(공격 범위) 좌우
    g = this._mk('BX_B2');
    // 회피 존 = MARK 원형 + 회피 계약(uContract=1 → 카탈로그 점선 변조) — 사제 LineDashed 점선 은퇴
    this.bxDodgeL = wallRing(-0.34, 1.45, 0.17, 0.19, BRAND.coral, 0.95); g.add(this.bxDodgeL);
    this.bxDodgeR = wallRing(0.34, 1.45, 0.17, 0.19, BRAND.coral, 0.95); g.add(this.bxDodgeR);
    this.bxDodgeL.material.uniforms.uContract.value = 1;
    this.bxDodgeR.material.uniforms.uContract.value = 1;
    g.add(wallText('피해요', 0, 1.02, { size: 0.09, color: CS.coral, weight: 800 }));

    // B3 잽 스윕 — 스윕 밴드 + 타겟(수축 링)
    g = this._mk('BX_B3');
    this.bxSweep = sweepBand(0.15, 1.15, TX, TY, BRAND.red); g.add(this.bxSweep);
    this.bxB3ring = wallRing(TX, TY, 0.18, 0.205, BRAND.red, 0.8); g.add(this.bxB3ring);
    this.bxB3cd = wallRing(TX, TY, 0.18, 0.205, BRAND.prism, 0); g.add(this.bxB3cd);

    this._mk('BX_T2');

    g = this._mk('BX_C1');
    g.add(guardBox(0, 1.35, 0.5, 0.42, BRAND.red, 0.5));

    this._mk('BX_C2');       // 라이브 — 벽 타겟 팩 흐름
    g = this._mk('BX_C3');   // 라이브 콤비 (가속) + 파생 ③ 펀치 라인 (콤보 연결·순서)
    this.bxCombo = primPanel('punchLine', 1.15, true);
    this.bxCombo.position.set(0, 1.35, WZ + 0.002);
    g.add(this.bxCombo);

    g = this._mk('BX_C4');
    g.add(wallText('숨 고르기', 0, 1.2, { size: 0.09, color: CS.mute }));

    g = this._mk('BX_FIN');
    g.add(wallText('오늘의 잽', 0, 1.55, { size: 0.11, color: CS.ink }));
    g.add(wallText('Pack 일치도 71% · 가드 유지율 82%', 0, 1.3, { size: 0.06, color: CS.dim }));
    g.add(wallText('회피 후 복귀가 반 박자 느림', 0, 1.12, { size: 0.055, color: CS.mute }));
    g.add(wallText('다음: 회피→잽 3박자 +1세트', 0, 0.95, { size: 0.055, color: CS.prism }));
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
    this.say?.(who, line);
  }
  /** 페이스 라이트 틱 — 최근 판정 3개의 평균 타이밍 오차를 거리(×팩속도 2.5m/s)로 번역 */
  _paceTick() {
    this.paceLight.visible = true;
    const R = this.judge?.results || [];
    let err = 0;
    for (let i = Math.max(0, R.length - 3); i < R.length; i++) err += R[i].terr;
    err /= Math.min(3, Math.max(1, R.length));
    const z = -1.6 - Math.max(-0.5, Math.min(1.0, err * 2.5));
    this.paceLight.position.z += (z - this.paceLight.position.z) * 0.05;   // 부드러운 추종
  }
  _packBeat(mult = 1, fb = 0.6) {
    const b = this.tokens?._beatT;
    return (b > 0.2 && b < 1.5) ? b * mult : fb;
  }
  stop() { this.active = false; this.root.visible = false; this.tokens.root.visible = true; this.liveSpeed = 1; this.bobY = 0; }
  tapAdvance() {
    if (!this.active) return;
    if (!/FIN$/.test(this.stage)) this._next();   // count 스테이지 탭 = 즉시 다음(= 실전 출발)
  }
  next() { if (this.active && this.stageIdx < this.stages.length - 1) { this.stageIdx++; this.t = 0; this._enter(); } }
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
    this._saidKeys?.clear();          // 단계 중간 음성 큐 리셋
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
    while (this.wCount.children.length) { const c = this.wCount.children.pop(); c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose(); }
    if (n == null) return;
    const p = makeTextPlane(String(n), { size: 0.28, color, weight: 800 }); this._clip(p, true); this.wCount.add(p);
  }

  _enterRunning(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'READY': FS('션 · 마지막 1KM'); FL('READY'); break;   // 푸터 제거: CTA 라벨과 중복 + CTA 근접 이동으로 겹침
      case 'A1': FS('준비운동 1/4'); FL('발끝을 링에 올리고 · 발목으로 원 그리기'); FM('먼저 보세요 — 이 속도로 돌려요', CS.sand); break;
      case 'A2': FS('준비운동 2/4'); FL('까치발 — 뒤꿈치 천천히 들었다 내리기'); FM('먼저 보세요 — 링이 차는 동안 올려요', CS.sand); break;
      case 'A3': FS('준비운동 3/4'); FL('한쪽 다리를 시계추처럼 앞뒤로'); FM('먼저 보세요 — 원이 켜지는 쪽으로'); break;
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
      case 'BK_A1': FS('WARM 1/3'); FL('스탠스 · 무릎 굽히기'); FM('어깨너비 · 발끝 앞', CS.sand); break;
      case 'BK_A2': FS('WARM 2/3'); FL('사이드 스텝'); FM('좌우 6회', CS.sand); break;
      case 'BK_A3': FS('WARM 3/3'); FL('제자리 리듬 드리블'); FM('하나, 둘'); break;
      case 'BK_T1': FS('T-1'); S(this.slotFL, 'STAGE CLEAR', { size: 0.12, color: CS.prism }); break;
      case 'BK_B1': FS('LEARN 1/3'); FL('스텝백 궤적 보기'); FM('눈으로 따라가요'); break;
      case 'BK_B2': FS('LEARN 2/3'); FL('순서대로 밟기'); FM('맞춘 스텝 0 / 3'); break;
      case 'BK_B3': FS('LEARN 3/3'); FL('디딤발에서 감속'); FM('감속이 슛의 시작'); break;
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
    for (const m of WAVE_MATS) {
      const U = m.uniforms;
      U.uTime.value = t;
      U.uW.value = MK.core;
      U.uHalo.value = MK.halo;
      U.uPool.value = MK.pool;
      U.uSweepA.value = MK.sweep;
      U.uNoise.value = MK.wobble;
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
    this.root.position.z = live ? (this.tokens.floorRoot.position.z + bodyZ) : 0;
    // 스테이지 카드 조판 라이브 소비 (룩 '스테이지 카드' 슬라이더 — 위치는 즉시, 캡은 다음 텍스트 갱신 시)
    const CARD = FXP.card || {};
    this.slotFL.position.z = -(CARD.titleZ ?? 2.68);
    this.slotFS.position.z = -((CARD.titleZ ?? 2.68) + (CARD.eyebrow ?? 0.30));
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

    if (this.sport === 'boxing') this._updateBoxing(id, st, beat, FMU);
    else if (this.sport === 'basketball') this._updateBasketball(id, st, beat, FMU);
    else this._updateRunning(id, st, beat, FMU);

    if (this.auto && st.dur && this.t >= st.dur && !st.count) this._next();
  }

  _updateRunning(id, st, beat, FMU) {
    // 박자 시점 바운스 — 몸이 살아있는 느낌 (라이브는 실제 모캡 눈이 담당)
    if (id === 'A4' || id === 'B2') this.bobY = 0.028 * Math.abs(Math.sin(Math.PI * this.t / 0.6));
    else if (id === 'B1' || id === 'B3') this.bobY = 0.018 * Math.abs(Math.sin(Math.PI * this.t / 0.55));
    else if (id[0] === 'A') this.bobY = 0.007 * Math.sin(this.t * 1.8);   // 호흡
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
      // 발목 돌리기 — 코칭 3층(목적→세팅→동작): 시범(2바퀴 보기만) → "이제 같이" → 좌 8회·우 8회
      const REP = SCFG.a1Rep, DEMO = 2 * REP, half = 8 * REP;
      this.a1arc.setProg((this.t % REP) / REP);   // MARK Hold 진행 림 = 발목 회전 속도 (시범부터 동일)
      if (this.t < DEMO) {
        this.a1L.group.visible = true; this.a1R.group.visible = false; this.a1arc.visible = true;
        this.demoActive = true;   // 실사 클립은 휴면 — 시범 = 링 리듬 시각
        FMU('먼저 보세요 — 링 속도가 내 발목 속도', CS.sand);
      } else {
        this.a1arc.visible = true;
        this._say('a1go', '션', '이제 같이 — 발끝 올리고, 링 따라 천천히 여덟 번.');
        const t2 = this.t - DEMO, side = t2 < half ? 0 : 1;
        this.a1L.group.visible = side === 0; this.a1R.group.visible = side === 1;
        const rep = Math.min(8, Math.floor((t2 - side * half) / REP) + 1);
        FMU(`${side === 0 ? '왼발' : '오른발'} ${rep} / 8`, CS.sand);
        if (t2 >= 2 * half + 0.6) { this.next(); return; }
      }
    } else if (id === 'A2') {
      // 종아리 펌프 — 시범(2박 보기) → "이제 같이" → 좌우 각 10회 (동적 웜업)
      const BT = 1.6, REPS = 10, DEMO = 2 * BT, PH = REPS * BT + 0.9;
      if (this.t < DEMO) {
        this.a2[0].pg.visible = true; this.a2[1].pg.visible = false;
        const k0 = (this.t % BT) / BT;
        this.a2[0].back.setHold(Math.max(0.001, k0));   // 회당 1회 채움 시범
        this.demoActive = true;
        FMU('먼저 보세요 — 링이 차는 동안 뒤꿈치 올리기', CS.sand);
      } else {
        this._say('a2go', '션', '이제 같이 — 까치발 서듯 뒤꿈치를 올렸다, 바닥까지 내려요.');
        const t2 = this.t - DEMO;
        const phase = t2 < PH ? 0 : 1;
        this.a2[0].pg.visible = phase === 0; this.a2[1].pg.visible = phase === 1;
        const lt = t2 - phase * PH;
        const pair = this.a2[phase];
        const k = (lt % BT) / BT;
        pair.back.setHold(lt < REPS * BT ? Math.max(0.001, k) : 0.001);   // 홀드 림 = 회당 1회 채움 (핑퐁 은퇴 — 진행은 역주행하지 않는다)
        if (lt >= REPS * BT) pair.back.glow(Math.max(0, 1 - (lt - REPS * BT) / 0.6));
        const rep = Math.min(REPS, Math.floor(lt / BT) + 1);
        FMU(`${phase === 0 ? '왼발 앞' : '오른발 앞'} · 까치발 ${rep} / ${REPS}`, CS.sand);
        if (t2 >= 2 * PH) { this.next(); return; }
      }
    } else if (id === 'A3') {
      // 다리 스윙 — 시범(2왕복 보기) → "이제 같이" → 열 번 (종점 존 교대 글로우 = 박자·진폭)
      const SW = SCFG.a3Swing, DEMO = 2 * SW, ph = beat(SW);
      const fwd = ph < 0.5, k = fwd ? ph * 2 : (ph - 0.5) * 2;
      const inDemo = this.t < DEMO;
      this.a3zones[0].visible = true; this.a3zones[1].visible = true;
      this.a3foot.group.visible = true;
      this.a3zones[0].setOp(fwd ? 0.3 + 0.65 * k : 0.3);
      this.a3zones[1].setOp(!fwd ? 0.3 + 0.65 * k : 0.3);
      if (inDemo) {
        this.demoActive = true;
        FMU('먼저 보세요 — 원이 켜지는 쪽으로 갔다 오기');
      } else {
        this._say('a3go', '션', '이제 골반을 잡고 — 다리를 시계추처럼 앞뒤로, 가볍게 열 번.');
        const t2 = this.t - DEMO;
        FMU(`${Math.min(10, Math.floor(t2 / SW) + 1)} / 10`);
        if (t2 >= 10 * SW + 0.5) { this.next(); return; }
      }
    } else if (id === 'A4') {
      // 션 박자 램프 — 팩 케이던스 80%로 8스텝 → 100%로 8스텝 (웜업부터 팩 Core 소비)
      const base = this._packBeat(1, SCFG.a4Beat);
      const BT1 = base * 1.25, T1 = 8 * BT1;
      const seg2 = this.t >= T1;
      const BT = seg2 ? base : BT1, lt = seg2 ? this.t - T1 : this.t;
      const idx = Math.min(15, (seg2 ? 8 : 0) + Math.floor(lt / BT));
      const b = idx % 2, ph = 1 - (lt % BT) / BT;
      this.a4L.countdown(b === 0 ? ph : -1); this.a4R.countdown(b === 1 ? ph : -1);
      FMU(`${b === 0 ? '하나' : '둘'} · ${idx + 1} / 16 — ${seg2 ? '션 속도!' : '천천히 시작'}`);
      if (this.t >= T1 + 8 * base + 0.4) { this.next(); return; }
    } else if (id === 'B1') {
      const BT = this._packBeat(1, SCFG.b1Beat), k = 1 - beat(BT);
      this.b1ring.setOp(0.45 + 0.55 * k);
      // 마크 안 숫자 1·2 교대 펄스 (하나-둘이 눈에 보이는 메트로놈)
      const bn = Math.floor(this.t / BT) % 2;
      this.b1nums.forEach((n, i) => { const on = i === bn; n.userData.plane.material.opacity = on ? 0.35 + 0.65 * k : 0; n.scale.setScalar(on ? 1 + 0.2 * k : 0.9); });
      FMU(`박자 ${Math.min(8, Math.floor(this.t / BT) + 1)} / 8 — 아직 발은 가만히`);
      if (this.t >= 8 * BT + 0.3) { this.next(); return; }
    } else if (id === 'BW') {
      // 션 발자국 리플레이 — 실측 케이던스(BT)·보폭으로 3발자국이 찍히며 멀어짐.
      // 착지 순간만 Success 펄스 → 곧장 무채 고스트로 식음: 케이던스가 눈에 박히는 단계.
      const BT = this._packBeat(1, SCFG.b1Beat);
      const stride = Math.min(0.78, (this.tokens._strideM || 0.8) * 0.8);   // 표시구간 1.05~2.6m 안
      const half = Math.max(0.1, this._packLaneHalf());   // 션 실측 좌우폭 (표시 최소 10cm)
      const cyc = 3 * BT + 1.1, lt = this.t % cyc;
      this.bwFeet.forEach((fm, i) => {
        fm.group.position.set((i % 2 ? 1 : -1) * half, 0.013, -1.05 - i * stride);
        const t0 = i * BT;
        if (lt < t0) fm.op(0);
        else if (lt < t0 + 0.25) { fm.op(1); fm.glow(1 - (lt - t0) / 0.25); }
        else { fm.op(0.85); fm.ghost(); }
      });
      FMU(`션의 걸음 ${Math.min(4, Math.floor(this.t / cyc) + 1)} / 4 — 눈으로만 따라오기`);
      if (this.t >= 4 * cyc + 0.3) { this.next(); return; }
    } else if (id === 'B2') {
      // 겹쳐 밟기 — 션의 다음 발자국이 고스트로 '먼저' 찍히고(예고), 유저가 그 위를 밟는다.
      const BT = this._packBeat(1.15, SCFG.b2Beat), b = Math.floor(this.t / BT) % 2, ph = beat(BT);
      const cur = b === 0 ? this.b2L : this.b2R, nxt = b === 0 ? this.b2R : this.b2L;
      cur.op(1); cur.countdown(ph);
      nxt.ghost(); nxt.op(0.4 + 0.45 * ph);   // 다음 발 예고가 박자 따라 차오름
      if (ph > 0.9) cur.glow(1);
      const hits = Math.min(8, Math.floor(this.t / BT));
      FMU(`맞춘 터치 ${hits} / 8${this._b2Half < 0.08 ? ' · 션 좌우폭 6cm' : ''}`, hits >= 8 ? CS.prism : CS.dim);
      if (this.t >= 8 * BT + 0.5) { this.next(); return; }
    } else if (id === 'B3') {
      const ST = SCFG.b3Step, cyc = 3 * ST, lt = this.t % cyc, W = ST * 0.82;
      this.b3.forEach((f, i) => {
        const t0 = i * ST;
        let ph;   // 숫자 표시 = fx-core MARK_NUM.opacity(상태) — FX Lab drawMarkNumOn과 동일 규약
        if (lt >= t0 && lt < t0 + W) { f.countdown((lt - t0) / W); ph = 1; }
        else if (lt >= t0 + W && lt < t0 + ST) { f.glow(1 - (lt - t0 - W) / (ST - W)); ph = 2; }
        else { f.countdown(-1); ph = 0; }
        this.b3nums[i].material.opacity = MARK_NUM.opacity(ph);
        placeMarkNum(this.b3nums[i]);
      });
      FMU(`세트 ${Math.min(2, Math.floor(this.t / cyc) + 1)} / 2`);
      if (this.t >= 2 * cyc + 0.4) { this.next(); return; }
    } else if (id === 'B4') {
      // 구간 리듬 — 발밑 → 전방 존 2개로 리듬이 흘러감
      const per = this._packBeat(1, SCFG.b4Beat), seq = Math.floor(this.t / per) % 3, k = 1 - beat(per);
      this.b4foot.op(seq === 0 ? 0.7 + 0.3 * k : 0.7);
      this.b4rings[0].setOp(seq === 1 ? 0.3 + 0.65 * k : 0.35);
      this.b4rings[1].setOp(seq === 2 ? 0.3 + 0.65 * k : 0.25);
      if (this.t >= 9 * per + 0.3) { this._gateAdvance(); return; }
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
      // 스탠스·무릎 — 두 발 기준형 유지 + 무릎 굽힘 안내(6초 홀드)
      FMU(`무릎 굽히고 유지 · ${Math.max(0, Math.ceil(6 - this.t))}초`, CS.sand);
      if (this.t >= 6) { this.next(); return; }
    } else if (id === 'BK_A2') {
      // 사이드 풋워크 — 발이 좌우 존 사이 이동, 6회 카운트
      const per = 0.8, side = Math.floor(this.t / per) % 2;
      this.bkA2foot.at(side === 0 ? -0.42 : 0.42, -1.9);
      this.bkA2L.setOp(side === 0 ? 0.9 : 0.35);
      this.bkA2R.setOp(side === 1 ? 0.9 : 0.35);
      FMU(`좌우 ${Math.min(6, Math.floor(this.t / per) + 1)} / 6`, CS.sand);
      if (this.t >= 6 * per + 0.4) { this.next(); return; }
    } else if (id === 'BK_A3') {
      // 리듬 드리블 — 링 펄스, 8박
      const BT = 0.5, k = 1 - beat(BT);
      this.bkA3ring.setOp(0.3 + 0.6 * k); this.bkA3ring.scale.setScalar(0.8 + 0.6 * (1 - k));
      FMU(`${Math.floor(this.t / BT) % 2 === 0 ? '하나' : '둘'} · ${Math.min(8, Math.floor(this.t / BT) + 1)} / 8`);
      if (this.t >= 8 * BT + 0.4) { this.next(); return; }
    } else if (id === 'BK_B1') {
      // 스텝백 궤적 보기 — 3발 순차 강조(고스트 리플레이), 2회 루프
      const ST = 0.9, cyc = 3 * ST, lt = this.t % cyc;
      this.bkB1.forEach((f, i) => { const t0 = i * ST; f.op(lt >= t0 && lt < t0 + ST ? 0.95 : 0.55); if (lt >= t0 && lt < t0 + ST * 0.8) f.countdown((lt - t0) / (ST * 0.8)); else f.countdown(-1); });
      FMU(`궤적 ${Math.min(2, Math.floor(this.t / cyc) + 1)} / 2 — 눈으로`);
      if (this.t >= 2 * cyc + 0.3) { this.next(); return; }
    } else if (id === 'BK_B2') {
      // 스텝 분해 밟기 — 순서 카운트다운 링, 맞춘 스텝 x/3
      const ST = 1.0, cyc = 3 * ST, lt = this.t % cyc, W = ST * 0.82;
      this.bkB2.forEach((f, i) => {
        const t0 = i * ST; let ph;   // 숫자 표시 = MARK_NUM.opacity(상태) — 카탈로그 규약
        if (lt >= t0 && lt < t0 + W) { f.countdown((lt - t0) / W); ph = 1; }
        else if (lt >= t0 + W && lt < t0 + ST) { f.glow(1 - (lt - t0 - W) / (ST - W)); ph = 2; }
        else { f.countdown(-1); ph = 0; }
        this.bkB2nums[i].material.opacity = MARK_NUM.opacity(ph);
        placeMarkNum(this.bkB2nums[i]);
      });
      const hits = Math.min(3, Math.floor((this.t % cyc) / ST) + 3 * Math.floor(this.t / cyc));
      FMU(`맞춘 스텝 ${Math.min(3, Math.floor(this.t / ST))} / 3`, this.t >= cyc ? CS.prism : CS.dim);
      if (this.t >= 2 * cyc + 0.3) { this.next(); return; }
    } else if (id === 'BK_B3') {
      // 컷 감속 — 스트라이프 웨이브 + 디딤발 글로우
      this.bkB3stripes.forEach((s, i) => { s.material._gainK = (0.7 - i * 0.15) * (0.5 + 0.5 * Math.sin(this.t * 4 - i)); });
      this.bkB3foot.op(0.7 + 0.3 * (0.5 + 0.5 * Math.sin(this.t * 3)));
      if (this.t >= 5) { this._gateAdvance(); return; }
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
      // 목·어깨 회전 아크
      this.bxA1arcL.rotation.z = this.t * 2; this.bxA1arcR.rotation.z = -this.t * 2;
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
      // 잽 폼 — 타겟 링 펄스
      const BT = 0.75, k = 1 - beat(BT);
      this.bxA3ring.material.opacity = 0.3 + 0.6 * k; this.bxA3ring.scale.setScalar(0.8 + 0.5 * (1 - k));
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
      const BT = 0.9, ph = beat(BT);
      this.bxSweep._prim.prog = ph;   // 잽 뻗기 진행 = 정본 밴드 채움
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
