import * as THREE from 'three';
import { WALL_Z } from './scene.js';
import { thermalColor, heatBlob, grainPattern } from './thermal.js';

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
export const SCFG = { a1Rep: 1.0, a2Hold: 10, a3Swing: 1.5, a4Beat: 0.6, b1Beat: 0.6, b2Beat: 0.7, b3Step: 1.1, b4Beat: 0.55 };

export const BRAND = { red: 0xfa3030, coral: 0xfe6e3c, sand: 0xfec389, prism: 0xd1feff, ink: 0xffffff, dim: 0x9b9b9b };
const CS = { red:'#fa3030', coral:'#fe6e3c', sand:'#fec389', prism:'#d1feff', ink:'#ffffff', dim:'#c9c9c9', mute:'#9b9b9b' };

function flatMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

// ── 지면 텍스트 (눕힘만으로 -Z 전방이 위 = 유저 읽는 방향) ──
// 장면 에디터: family(폰트)까지 편집 가능 — userData.el 메타 + redraw로 라이브 갱신
export const FONT_FAMILIES = [
  ['Pretendard, -apple-system, sans-serif', '기본 (Pretendard)'],
  ['Georgia, "Times New Roman", serif', '세리프'],
  ['Menlo, "SF Mono", monospace', '모노'],
  ['"Arial Black", "Avenir Black", sans-serif', '헤비 디스플레이'],
  ['"Brush Script MT", "Savoye LET", cursive', '스크립트'],
];
function drawTextTex(text, { size = 0.10, color = '#ffffff', weight = 700, family = FONT_FAMILIES[0][0] } = {}) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = `${weight} 64px ${family}`;
  ctx.font = font;
  c.width = Math.max(8, Math.ceil(ctx.measureText(text).width) + 24); c.height = 88;
  const x = c.getContext('2d'); x.font = font; x.fillStyle = color; x.textBaseline = 'middle';
  x.fillText(text, 12, 46);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
  return { tex, aspect: c.width / c.height };
}
function makeTextMesh(text, opts = {}) {
  const o = { size: 0.10, color: '#ffffff', weight: 700, family: FONT_FAMILIES[0][0], ...opts };
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

// ── 발형 마크 v2 — 족저 압력 히트맵 (열화상 실루엣: 핫스팟 + 소프트 헤일로) ──
// 발끝 박스 위 + 뒤꿈치 아래 = -Z 전방 (방향 규칙 유지)
function _footPaths() {
  const fore = new Path2D();
  fore.moveTo(64,14); fore.bezierCurveTo(106,14,116,52,110,96); fore.bezierCurveTo(107,122,102,138,102,156);
  fore.bezierCurveTo(102,176,84,186,64,186); fore.bezierCurveTo(44,186,26,176,26,156);
  fore.bezierCurveTo(26,138,21,122,18,96); fore.bezierCurveTo(12,52,22,14,64,14); fore.closePath();
  const heel = new Path2D();
  heel.moveTo(42,206); heel.lineTo(86,206); heel.quadraticCurveTo(96,206,94,220);
  heel.quadraticCurveTo(90,242,64,242); heel.quadraticCurveTo(38,242,34,220); heel.quadraticCurveTo(32,206,42,206);
  heel.closePath();
  return { fore, heel };
}
function makeFootTexture(mirror) {
  // 캔버스 384×640 = 콘텐츠(128×256)의 2배 해상도 + 헤일로 여백 32px(콘텐츠 좌표)
  const W = 384, H = 640;
  const shape = document.createElement('canvas'); shape.width = W; shape.height = H;
  const ctx = shape.getContext('2d');
  ctx.translate(64, 64); ctx.scale(2, 2);
  if (mirror) { ctx.translate(128, 0); ctx.scale(-1, 1); }
  const { fore, heel } = _footPaths();
  // 전족부: 은은한 바탕 + 압력 핫스팟(볼·발끝·외측)
  ctx.save(); ctx.clip(fore);
  ctx.fillStyle = thermalColor(0.3, 0.34); ctx.fill(fore);
  heatBlob(ctx, 64, 82, 54, 0.88, 0.92);    // 볼(ball) — 최대 압력
  heatBlob(ctx, 64, 34, 32, 0.6, 0.7);      // 발끝
  heatBlob(ctx, 98, 108, 27, 0.52, 0.55);   // 외측 아치
  heatBlob(ctx, 30, 108, 26, 0.46, 0.5);
  ctx.restore();
  // 뒤꿈치: 진한 핫스팟
  ctx.save(); ctx.clip(heel);
  ctx.fillStyle = thermalColor(0.35, 0.36); ctx.fill(heel);
  heatBlob(ctx, 64, 224, 32, 0.93, 0.95);
  ctx.restore();

  // 합성: 헤일로(빛 번짐) + 본체 소프트 + 그레인
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const oc = out.getContext('2d');
  oc.globalAlpha = 0.55; oc.filter = 'blur(11px)'; oc.drawImage(shape, 0, 0);
  oc.globalAlpha = 1; oc.filter = 'blur(2px)'; oc.drawImage(shape, 0, 0);
  oc.filter = 'none';
  oc.globalCompositeOperation = 'source-atop'; oc.globalAlpha = 0.08;   // 실루엣 안에만 그레인
  oc.fillStyle = grainPattern(oc); oc.fillRect(0, 0, W, H);
  oc.globalCompositeOperation = 'source-over'; oc.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
const FOOTMARKS = [];
class FootMark {
  constructor(foot) {
    this.foot = foot;
    this.group = new THREE.Group();
    // 캔버스에 헤일로 여백 포함(192×320 콘텐츠좌표) — 발 시각 크기는 기존과 동일 유지
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(0.145 * 192 / 128, 0.29 * 320 / 256),
      new THREE.MeshBasicMaterial({ map: makeFootTexture(foot === 'right'), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this._origMap = this.plane.material.map;
    FOOTMARKS.push(this);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.215, 44), flatMat(BRAND.prism, 0)); this.ring.position.z = 0.001;
    this.hold = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.215, 44, 1, Math.PI / 2, 0.001), flatMat(BRAND.sand, 0)); this.hold.position.z = 0.002;
    this.group.add(this.plane, this.ring, this.hold);
    this.group.rotation.x = -Math.PI / 2; this.group.position.y = 0.013; this.group.renderOrder = 6;
    this.plane.rotation.z = foot === 'left' ? THREE.MathUtils.degToRad(8) : THREE.MathUtils.degToRad(-8);
    this.group.userData.el = { type: 'foot', side: foot };
  }
  at(x, z, s = 1) { this.group.position.set(x, 0.013, z); this.group.scale.setScalar(s); return this; }
  op(k) { this.plane.material.opacity = k; }
  setHold(p) {
    this.hold.geometry.dispose();
    this.hold.geometry = new THREE.RingGeometry(0.19, 0.215, 44, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
    this.hold.material.opacity = p > 0 ? 0.95 : 0;
  }
  countdown(p) { if (p < 0) { this.ring.material.opacity = 0; return; } this.ring.material.color.setHex(BRAND.prism); this.ring.material.opacity = 0.35 + 0.6 * p; this.ring.scale.setScalar(1.9 - 0.9 * p); }
  glow(k) { this.ring.material.color.setHex(BRAND.prism); this.ring.material.opacity = 0.95 * k; this.ring.scale.setScalar(1 + 0.4 * (1 - k)); }
}

// ── 지면 프리미티브 (userData.el = 장면 에디터 메타) ──
function floorRing(x, z, rIn, rOut, color, op = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 48), flatMat(color, op));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.013, z); m.renderOrder = 5;
  m.userData.el = { type: 'ring' }; return m;
}
function floorArc(x, z, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.20, 0.235, 40, 1, Math.PI * 0.15, Math.PI * 1.4), flatMat(color, 0.85));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0135, z); m.renderOrder = 6;
  m.userData.el = { type: 'arc' }; return m;
}
function floorArrow(x, z, deg, color, len = 0.4) {
  const s = new THREE.Shape(); const w = 0.09, hw = 0.2, hl = 0.2;
  s.moveTo(-w/2,0); s.lineTo(-w/2,len-hl); s.lineTo(-hw/2,len-hl); s.lineTo(0,len);
  s.lineTo(hw/2,len-hl); s.lineTo(w/2,len-hl); s.lineTo(w/2,0); s.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), flatMat(color, 0.85));
  const g = new THREE.Group(); g.add(mesh); g.rotation.x = -Math.PI/2; g.position.set(x, 0.014, z);
  g.rotation.z = THREE.MathUtils.degToRad(deg); g.renderOrder = 6;
  g.userData.el = { type: 'arrow' }; return g;
}
function floorStripe(x, z, w, color, op) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.06), flatMat(color, op));
  m.rotation.x = -Math.PI/2; m.position.set(x, 0.012, z); m.renderOrder = 4;
  m.userData.el = { type: 'stripe' }; return m;
}
function floorText(text, x, z, opts) { const g = makeTextMesh(text, opts); g.position.set(x, 0.013, z); return g; }
function floorNum(text, x, z, size, color) {
  const g = new THREE.Group(); const p = makeTextPlane(text, { size, color, weight: 800 });
  g.add(p); g.rotation.x = -Math.PI/2; g.position.set(x, 0.013, z); g.renderOrder = 7; g.userData.plane = p; return g;
}
function laneLine(color, z0 = 1.0, z1 = -3.2) {
  const pts = []; for (let z = z0; z > z1; z -= 0.42) pts.push(new THREE.Vector3(0, 0.012, z));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.22, transparent: true, opacity: 0.5 }));
  l.computeLineDistances(); l.renderOrder = 4; l.userData.el = { type: 'lane' }; return l;
}

// ── 벽면 프리미티브 (복싱 — z=WALL_Z 세워진 평면, 유저(+z) 바라봄, 눕힘 없음) ──
const WZ = WALL_Z + 0.03;
function wallRing(x, y, rIn, rOut, color, op = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 48), flatMat(color, op));
  m.position.set(x, y, WZ); m.renderOrder = 5; m.userData.el = { type: 'ring', wall: true }; return m;
}
function wallArc(x, y, rIn, rOut, color, a0, len, op = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 40, 1, a0, len), flatMat(color, op));
  m.position.set(x, y, WZ + 0.001); m.renderOrder = 6; m.userData.el = { type: 'arc', wall: true }; return m;
}
function wallText(text, x, y, opts) {
  const p = makeTextPlane(text, opts); p.position.set(x, y, WZ + 0.002); p.renderOrder = 7;
  if (p.userData.el) p.userData.el.wall = true; return p;
}
/** 가드 존 박스 — 신체 부위가 머물 영역 (라운드 사각 아웃라인) */
function guardBox(x, y, w, h, color, op = 0.8) {
  const s = new THREE.Shape(); const r = 0.05;
  const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh); s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const pts = s.getPoints(48);
  const g = new THREE.Group();
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, 0))),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(s), flatMat(color, 0.08));
  g.add(fill, line); g.position.set(x, y, WZ); g.renderOrder = 5; g.userData.el = { type: 'box', wall: true }; return g;
}
/** 잽 스윕 밴드 — ④ pathLane 벽면 표현형: 부위가 지나갈 호(弧) 면적, 그라디언트=진행 방향 */
function sweepBand(x0, y0, x1, y1, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const gr = ctx.createLinearGradient(0, 128, 128, 0);
  const hex = '#' + color.toString(16).padStart(6, '0');
  gr.addColorStop(0, 'rgba(250,48,48,0.04)'); gr.addColorStop(1, hex);
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(12, 120); ctx.quadraticCurveTo(30, 40, 110, 24);
  ctx.lineTo(120, 52); ctx.quadraticCurveTo(52, 66, 34, 122); ctx.closePath(); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const w = Math.hypot(x1 - x0, y1 - y0) + 0.5;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WZ + 0.001); m.renderOrder = 5; return m;
}
function wallTap() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.07, 32), flatMat(BRAND.prism, 0.95)); r.position.x = (i - 0.5) * 0.18; g.add(r); }
  const label = makeTextPlane('TAP ×2', { size: 0.055, color: CS.prism }); label.position.set(0, -0.16, 0.001); g.add(label);
  g.position.z = WZ; g.renderOrder = 7; return g;
}

// ─────────────────────────────────────────────────────────────
// 종목별 스테이지 스크립트. 공통 로직은 데이터 필드로 구동:
//   live=실전 팩 재생 · boost=가속 · cooldown=감속정지 · count=카운트다운
// 스테이지별 고유 비주얼은 sport-dispatch(_build/_enter/_update)로 처리.
const STAGES = {
  running: [
    { id:'READY', label:'0 · READY — 준비', voice:['시스템','션의 마지막 1km 페이스 팩. 준비되면 발을 두 번 탭하세요.'], wear:'SAFE 대기', foot:'두 번 탭 → 시작' },
    { id:'A1', label:'A · 스트레칭 1/4 — 발목 돌리기', voice:['션','발목부터 풀어요. 원에 발끝 올리고 천천히 여덟 번.'], wear:'개입 없음 (가동범위 측정)' },
    { id:'A2', label:'A · 스트레칭 2/4 — 종아리 늘리기', voice:['션','앞 원에 왼발. 뒤꿈치는 바닥 — 종아리가 당기면 잘 된 거예요.'], hap:'10초 종료 진동 1회' },
    { id:'A3', label:'A · 스트레칭 3/4 — 다리 스윙', voice:['션','골반 잡고 다리를 앞뒤로. 가볍게 열 번.'], foot:'완료 후 두 번 탭 → 다음' },
    { id:'A4', label:'A · 스트레칭 4/4 — 몸풀기 박자 걷기', voice:['션','이제 내 걸음 박자로 제자리 걷기. 하나, 둘, 하나, 둘.'], hap:'워밍업 박자 (약)', wear:'낮은 강도 보조 시작' },
    { id:'T1', label:'T-1 · STAGE CLEAR → 사전 익히기', voice:['시스템','몸 다 풀렸어요. 탭 두 번이면 다음으로.'], foot:'두 번 탭 → 사전 익히기' },
    { id:'B1', label:'B · 사전 익히기 1/4 — 박자 듣기', voice:['션','마지막 1km에서 쓰는 박자예요. 먼저 듣기만. 하나, 둘.'], hap:'박자 동기 (약)' },
    { id:'B2', label:'B · 사전 익히기 2/4 — 제자리 스텝 맞추기', voice:['션','링이 닫힐 때 밟아요. 지금 — 좋아요, 그 박자예요.'], cue:'Hit Glow + Timing Pulse (성공 순간만)' },
    { id:'B3', label:'B · 사전 익히기 3/4 — 3스텝 이어 밟기', voice:['션','이제 앞으로 세 걸음, 숫자 순서대로.'], cue:'Step Combo ×2 ×3' },
    { id:'B4', label:'B · 사전 익히기 4/4 — 구간 리듬 유지', voice:['션','이제 문장은 그만할게요. 박자만 지켜요.'], foot:'두 번 탭 → 실전 준비 (발형→존형 전환)' },
    { id:'T2', label:'T-2 · 5초 뒤 실전 준비로 자동 진행 (두 번 탭 = 바로)', voice:['션','5초 뒤에 넘어갈게요. 준비됐으면 두 번 탭으로 바로 가요.'], dur:5, count:true, foot:'두 번 탭 = 즉시 · 무입력 = 자동 진행 — 반복은 게이트·다운시프트가 담당' },
    { id:'C1', dur:3, label:'C · 실전 1/5 — 출발', voice:['시스템','3, 2, 1.'], hap:'시작 타이밍 진동', foot:'두 번 탭 → 출발 (이후 잠금)' },
    { id:'C2', dur:7, live:true, label:'C · 실전 2/5 — 페이스 유지 (라이브)', voice:['션','좋아요, 그 박자 그대로.'], wear:'SAFE 착지 안정화' },
    { id:'C3', dur:7, live:true, label:'C · 실전 3/5 — 흔들림 보정 (라이브)', voice:['션','박자! 나한테 다시 맞춰요.'], hap:'착지 보조 2박' },
    { id:'C4', dur:7, live:true, boost:true, label:'C · 실전 4/5 — 마지막 1km BOOST (라이브·가속)', voice:['션','여기서부터 마지막 1km. 나한테 붙어요.'], wear:'BOOST 추진 보조 · 리듬 저하 시 강도↑', cue:'구간 종료 Match Rate' },
    { id:'C5', live:true, cooldown:true, label:'C · 실전 5/5 — 종료 감속 (라이브·감속→정지)', voice:['시스템','여기까지. 잘 달렸어요.'], hap:'완료 진동' },
    { id:'FIN', label:'R-F · 리포트', voice:['시스템','리포트를 앱으로 보냈어요.'], cue:'Ghost Review — 션 박자와 내 착지 겹쳐 보기' },
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
    this.slotFS = new THREE.Group(); this.slotFS.position.set(-0.74, 0, -2.55);
    this.slotFL = new THREE.Group(); this.slotFL.position.set(0, 0, -2.3);
    this.slotFM = new THREE.Group(); this.slotFM.position.set(0, 0, -1.4);
    this.root.add(this.slotFS, this.slotFL, this.slotFM);

    this.countGroup = new THREE.Group(); this.countGroup.position.set(0, 0, -1.85);
    this.countRing = floorRing(0, -1.85, 0.30, 0.335, BRAND.red, 0);
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
    g.add(floorRing(0, -1.8, 0.20, 0.225, BRAND.dim, 0.9));
    this.tap = this._tap(); this.tap.position.set(0, 0.013, -1.8); g.add(this.tap);

    g = this._mk('A1');
    this.a1L = new FootMark('left').at(0, -1.9, 1.15); g.add(this.a1L.group);
    this.a1R = new FootMark('right').at(0, -1.9, 1.15); g.add(this.a1R.group);
    this.a1arc = floorArc(0, -1.9, BRAND.sand); g.add(this.a1arc);

    g = this._mk('A2');
    this.a2 = [];
    for (let i = 0; i < 2; i++) {          // 0=왼발 앞, 1=오른발 앞 (좌우 교대)
      const pg = new THREE.Group(); g.add(pg);
      const sx = i === 0 ? 1 : -1;
      const front = new FootMark(i === 0 ? 'left' : 'right').at(-0.13 * sx, -2.0);
      const back = new FootMark(i === 0 ? 'right' : 'left').at(0.14 * sx, -1.28);
      pg.add(front.group, back.group, floorRing(0.14 * sx, -1.28, 0.235, 0.255, BRAND.sand, 0.5));
      this.a2.push({ pg, front, back });
    }

    g = this._mk('A3');
    this.a3foot = new FootMark('left').at(-0.05, -1.7, 1.1); g.add(this.a3foot.group);
    this.a3fwd = floorArrow(0.22, -1.35, 0, BRAND.dim, 0.34); g.add(this.a3fwd);
    this.a3bwd = floorArrow(0.22, -2.05, 180, BRAND.dim, 0.34); g.add(this.a3bwd);

    g = this._mk('A4');
    this.a4L = new FootMark('left').at(-0.17, -1.6); g.add(this.a4L.group);
    this.a4R = new FootMark('right').at(0.17, -1.6); g.add(this.a4R.group);

    g = this._mk('T1');
    this.tap1 = this._tap(); this.tap1.position.set(0, 0.013, -1.8); g.add(this.tap1);

    g = this._mk('B1');
    this.b1outer = floorRing(0, -1.8, 0.24, 0.26, BRAND.red, 0.6);
    this.b1inner = floorRing(0, -1.8, 0.12, 0.14, BRAND.red, 0.9);
    g.add(this.b1outer, this.b1inner);

    g = this._mk('B2');
    this.b2L = new FootMark('left').at(-0.17, -1.7); g.add(this.b2L.group);
    this.b2R = new FootMark('right').at(0.17, -1.7); g.add(this.b2R.group);

    g = this._mk('B3');
    g.add(laneLine(BRAND.red, 0.2, -3.0));
    this.b3 = [];
    const bp = [[-0.17, -1.6], [0.18, -2.15], [-0.14, -2.7]];
    for (let i = 0; i < 3; i++) {
      const fm = new FootMark(i % 2 === 0 ? 'left' : 'right').at(bp[i][0], bp[i][1]);
      g.add(fm.group); g.add(floorNum(String(i + 1), bp[i][0] - 0.22, bp[i][1] + 0.12, 0.12, CS.ink));
      this.b3.push(fm);
    }

    g = this._mk('B4');
    g.add(laneLine(BRAND.red, 0.2, -3.0));
    this.b4foot = new FootMark('left').at(0.05, -1.6); g.add(this.b4foot.group);
    this.b4rings = [floorRing(-0.05, -2.2, 0.15, 0.17, BRAND.red, 0.6), floorRing(0.05, -2.8, 0.15, 0.17, BRAND.red, 0.35)];
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
    g.add(floorRing(0, -2.9, 0.20, 0.225, BRAND.dim, 0.9));
    g.add(floorText('STOP', 0, -2.9, { size: 0.09, color: CS.mute }));

    g = this._mk('FIN');
    g.add(floorText('오늘의 러닝', 0, -1.7, { size: 0.11, color: CS.ink }));
    g.add(floorText('Pack 일치도 78% · 숙련 근접도 64% (+6%)', 0, -2.05, { size: 0.07, color: CS.dim }));
    g.add(floorText('후반 리듬 800m부터 흔들림', 0, -2.3, { size: 0.06, color: CS.mute }));
    g.add(floorText('다음: 사전 익히기 +1세트 · BOOST 타이밍 보정', 0, -2.55, { size: 0.06, color: CS.prism }));
  }

  _buildBasketball() {
    let g = this._mk('BK_READY');
    g.add(floorRing(0, -1.8, 0.20, 0.225, BRAND.dim, 0.9));
    this.bkTap = this._tap(); this.bkTap.position.set(0, 0.013, -1.8); g.add(this.bkTap);

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
    this.bkTap1 = this._tap(); this.bkTap1.position.set(0, 0.013, -1.8); g.add(this.bkTap1);

    // B1 스텝백 궤적 보기 — 3발 궤적 + 곡선 레인 (Ghost 리플레이)
    g = this._mk('BK_B1');
    const bkp = [[-0.1, -1.6], [0.05, -2.15], [0.3, -2.05]];  // 컷인 → 스텝백(뒤로 옆)
    this.bkB1 = [];
    for (let i = 0; i < 3; i++) {
      const fm = new FootMark(i % 2 === 0 ? 'left' : 'right').at(bkp[i][0], bkp[i][1]);
      g.add(fm.group); this.bkB1.push(fm);
    }
    this.bkPath = bkp;

    // B2 스텝 분해 밟기 — 같은 3발 + 순서 숫자
    g = this._mk('BK_B2');
    this.bkB2 = [];
    for (let i = 0; i < 3; i++) {
      const fm = new FootMark(i % 2 === 0 ? 'left' : 'right').at(bkp[i][0], bkp[i][1]);
      g.add(fm.group); g.add(floorNum(String(i + 1), bkp[i][0] - 0.22, bkp[i][1] + 0.12, 0.12, CS.ink));
      this.bkB2.push(fm);
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
    this.bxHoldBg = wallRing(0, 1.35, 0.20, 0.235, 0x3a3a38, 0.5); g.add(this.bxHoldBg);
    this.bxHold = wallArc(0, 1.35, 0.20, 0.235, BRAND.sand, Math.PI/2, 0.001, 0); g.add(this.bxHold);

    // B2 회피 스텝 — 회피형 점선 존(공격 범위) 좌우
    g = this._mk('BX_B2');
    this.bxDodgeL = this._dashRing(-0.34, 1.45, 0.19, BRAND.coral); g.add(this.bxDodgeL);
    this.bxDodgeR = this._dashRing(0.34, 1.45, 0.19, BRAND.coral); g.add(this.bxDodgeR);
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
    this._mk('BX_C3');       // 라이브 콤비 (가속)

    g = this._mk('BX_C4');
    g.add(wallText('숨 고르기', 0, 1.2, { size: 0.09, color: CS.mute }));

    g = this._mk('BX_FIN');
    g.add(wallText('오늘의 잽', 0, 1.55, { size: 0.11, color: CS.ink }));
    g.add(wallText('Pack 일치도 71% · 가드 유지율 82%', 0, 1.3, { size: 0.06, color: CS.dim }));
    g.add(wallText('회피 후 복귀가 반 박자 느림', 0, 1.12, { size: 0.055, color: CS.mute }));
    g.add(wallText('다음: 회피→잽 3박자 +1세트', 0, 0.95, { size: 0.055, color: CS.prism }));
  }

  _dashRing(x, y, r, color) {
    const seg = 32, pts = [];
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push(new THREE.Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, WZ + 0.001)); }
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.85 }));
    l.computeLineDistances(); l.renderOrder = 6; return l;
  }

  _tap() {
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.07, 32), flatMat(BRAND.prism, 0.95)); r.position.x = (i - 0.5) * 0.18; g.add(r); }
    const label = makeTextPlane('TAP ×2', { size: 0.055, color: CS.prism }); label.position.set(0, -0.16, 0.001); g.add(label);
    g.rotation.x = -Math.PI / 2; g.position.y = 0.013; g.renderOrder = 7; return g;
  }
  _setCount(n, color = '#fa3030') {
    while (this.countGroup.children.length) { const c = this.countGroup.children.pop(); c.traverse?.(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); }
    if (n == null) { this.countRing.material.opacity = 0; return; }
    const m = floorNum(String(n), 0, 0, 0.34, color); this._clip(m); this.countGroup.add(m);
  }
  _slot(slot, text, opts) {
    while (slot.children.length) { const c = slot.children.pop(); c.traverse?.(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); }
    if (!text) return; const m = makeTextMesh(text, opts); this._clip(m); slot.add(m);
  }

  /** 제작자 모드: 세션 발자국 아트 교체 (왼발 기준, 오른발은 미러) */
  setFootArt(tex) {
    for (const f of FOOTMARKS) {
      f.plane.material.map = tex || f._origMap;
      f.plane.scale.x = (tex && f.foot === 'right') ? -1 : 1;
      f.plane.material.needsUpdate = true;
    }
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
  }
  endPreview() {
    this._previewId = null;
    if (!this.active) { this.root.visible = false; for (const id in this.G) this.G[id].visible = false; }
  }

  /** 장면의 편집 가능 요소 목록: [{i, o, el}] */
  sceneElements(stageId) {
    const g = this.G[stageId]; if (!g) return [];
    return g.children.map((o, i) => ({ i, o, el: o.userData.el || { type: o.isGroup ? 'group' : (o.isLine ? 'line' : 'mesh') } }));
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
    if (patch.text && o.userData.redraw) o.userData.redraw(patch.text);
    else if (patch.text && o.userData.plane?.userData.redraw) o.userData.plane.userData.redraw(patch.text);
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
      o = wall ? wallRing(p.x ?? 0, p.y ?? 1.2, 0.15, 0.175, p.color || 0xfa3030, 0.9)
               : floorRing(p.x ?? 0, p.z ?? -1.8, 0.15, 0.175, p.color || 0xfa3030, 0.9);
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
  reportVerdict(verdict) {
    if (!this.active || !this.isLive) return;
    if (this.sport === 'basketball') return;   // 농구 판정(hips 프로브) 미보정 — 다운시프트 보류

    this._missStreak = verdict !== 'hit' ? this._missStreak + 1 : 0;
    if (this._missStreak >= 2) {
      this._missStreak = 0;
      const i = this._firstBIdx();
      if (i >= 0 && this.stageIdx > i) { this.onGate?.('downshift'); this.liveSpeed = 1; this.stageIdx = i; this.t = 0; this._enter(); }
    }
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
    this._setCount(null); this._setCountWall(null);
    if (this.G[st.id]) this.G[st.id].visible = true;
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
        FS: t => S(this.slotFS, t, { size: 0.055, color: CS.mute }),
        FL: t => S(this.slotFL, t, { size: 0.10, color: CS.ink }),
        FM: (t, c = CS.dim) => S(this.slotFM, t, { size: 0.07, color: c }),
      };
      H.FS(''); H.FL(''); H.FM('');
      if (st.count) this._setCount(5);
      if (this.sport === 'basketball') this._enterBasketball(st, H);
      else this._enterRunning(st, H);
    }
    this._fmCache = null;
  }

  _slotWall(slot, text, opts) {
    while (slot.children.length) { const c = slot.children.pop(); c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose(); }
    if (!text) return;
    const p = makeTextPlane(text, opts); this._clip(p, true); slot.add(p);
  }
  _setCountWall(n, color = '#fa3030') {
    while (this.wCount.children.length) { const c = this.wCount.children.pop(); c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose(); }
    if (n == null) return;
    const p = makeTextPlane(String(n), { size: 0.28, color, weight: 800 }); this._clip(p, true); this.wCount.add(p);
  }

  _enterRunning(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'READY': FS('SEAN · LAST 1KM'); FL('READY'); FM('발 두 번 탭 → 시작'); break;
      case 'A1': FS('STRETCH 1/4'); FL('발끝 올리고 돌리기'); FM('왼발 1 / 8', CS.sand); break;
      case 'A2': FS('STRETCH 2/4'); FL('앞 원에 왼발'); FM('뒤꿈치 바닥 · 10초', CS.sand); break;
      case 'A3': FS('STRETCH 3/4'); FL('다리 앞뒤 스윙'); FM('1 / 10'); break;
      case 'A4': FS('STRETCH 4/4'); FL('제자리 걷기 — 내 박자로'); FM('하나, 둘, 하나, 둘'); break;
      case 'T1': FS('T-1'); S(this.slotFL, 'STAGE CLEAR', { size: 0.12, color: CS.prism }); FM('탭 두 번 → 사전 익히기'); break;
      case 'B1': FS('LEARN 1/4'); FL('듣기만 해요'); FM('먼저 귀로 배워요'); break;
      case 'B2': FS('LEARN 2/4'); FL('링이 닫힐 때 밟기'); FM('맞춘 스텝 0 / 8'); break;
      case 'B3': FS('LEARN 3/4'); FL('세 걸음 · 순서대로'); FM('세트 1 / 2'); break;
      case 'B4': FS('LEARN 4/4'); FL('박자만'); FM('발밑=마지막 발형 · 전방=존 시작'); break;
      case 'T2': FS('T-2'); FM('두 번 탭 = 바로 · 가만히 있으면 자동 진행'); break;
      case 'C1': FS('RUN 00:00'); break;
      case 'C2': FS('RUN 04:12 · SAFE'); FM('발밑 비움 · 전방 선행 발자국'); break;
      case 'C3': FS('RUN 08:40'); break;
      case 'C4': S(this.slotFS, 'LAST 1KM · BOOST', { size: 0.055, color: CS.prism }); break;
      case 'C5': FS('COOL DOWN'); break;
      case 'FIN': FS('REPORT'); break;
    }
  }

  _enterBasketball(st, { S, FS, FL, FM }) {
    switch (st.id) {
      case 'BK_READY': FS('CURRY · STEP-BACK 3'); FL('READY'); FM('발 두 번 탭 → 시작'); break;
      case 'BK_A1': FS('WARM 1/3'); FL('스탠스 · 무릎 굽히기'); FM('어깨너비 · 발끝 앞', CS.sand); break;
      case 'BK_A2': FS('WARM 2/3'); FL('사이드 스텝'); FM('좌우 6회', CS.sand); break;
      case 'BK_A3': FS('WARM 3/3'); FL('제자리 리듬 드리블'); FM('하나, 둘'); break;
      case 'BK_T1': FS('T-1'); S(this.slotFL, 'STAGE CLEAR', { size: 0.12, color: CS.prism }); FM('탭 두 번 → 사전 익히기'); break;
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

  update(dt) {
    if (!this.active) return;
    const st = this.stages[this.stageIdx]; this.t += dt; const id = st.id;
    const wall = !!st.wall;
    // 오버레이 좌표: 벽면(복싱)은 고정, 지면은 러너/컷을 따라감
    const bodyZ = (!wall && this.isLive) ? this.xbot.getBodyPos().z : 0;
    this.root.position.x = wall ? 0 : this.tokens.floorRoot.position.x;
    this.root.position.z = wall ? 0 : (this.tokens.floorRoot.position.z + bodyZ);
    const beat = (per) => (this.t % per) / per;
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
      if (!wall) { const f = rem - Math.floor(rem); this.countRing.material.opacity = 0.3 + 0.5 * f; this.countRing.scale.setScalar(0.8 + 0.6 * f); }
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
      tap.children[0].material.opacity = 0.5 + 0.45 * k; tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
      if (id === 'T1' && this.t >= 4.5) { this.next(); return; }
    } else if (id === 'A1') {
      // 발목 돌리기 — 아크가 실제로 돌며 좌 8회 → 우 8회 카운트
      const REP = SCFG.a1Rep, half = 8 * REP;
      const side = this.t < half ? 0 : 1;
      this.a1L.group.visible = side === 0; this.a1R.group.visible = side === 1;
      this.a1arc.rotation.z = -((this.t % REP) / REP) * Math.PI * 2;
      const rep = Math.min(8, Math.floor((this.t - side * half) / REP) + 1);
      FMU(`${side === 0 ? '왼발' : '오른발'} ${rep} / 8`, CS.sand);
      if (this.t >= 2 * half + 0.6) { this.next(); return; }
    } else if (id === 'A2') {
      // 종아리 — 10초 홀드 채움 + 초 카운트, 좌우 교대
      const HOLD = SCFG.a2Hold, PH = HOLD + 0.9;
      const phase = this.t < PH ? 0 : 1;
      this.a2[0].pg.visible = phase === 0; this.a2[1].pg.visible = phase === 1;
      const lt = this.t - phase * PH, p = Math.min(1, lt / HOLD);
      const pair = this.a2[phase];
      pair.back.setHold(p);
      if (p >= 1) pair.back.glow(Math.max(0, 1 - (lt - HOLD) / 0.6));
      const secs = Math.max(0, Math.ceil(HOLD - lt));
      FMU(`${phase === 0 ? '왼발 앞' : '오른발 앞'} · 뒤꿈치 바닥 · ${secs}초`, CS.sand);
      if (this.t >= 2 * PH) { this.next(); return; }
    } else if (id === 'A3') {
      // 다리 스윙 — 앞/뒤 화살표 교대 강조 + 10회 카운트
      const SW = SCFG.a3Swing, fwd = beat(SW) < 0.5;
      const fm2 = this.a3fwd.children[0].material, bm = this.a3bwd.children[0].material;
      fm2.opacity = fwd ? 0.95 : 0.22; bm.opacity = fwd ? 0.22 : 0.95;
      fm2.color.setHex(fwd ? BRAND.coral : BRAND.dim); bm.color.setHex(fwd ? BRAND.dim : BRAND.coral);
      FMU(`${Math.min(10, Math.floor(this.t / SW) + 1)} / 10`);
      if (this.t >= 10 * SW + 0.5) { this.next(); return; }
    } else if (id === 'A4') {
      const BT = SCFG.a4Beat, b = Math.floor(this.t / BT) % 2, ph = 1 - beat(BT);
      this.a4L.countdown(b === 0 ? ph : -1); this.a4R.countdown(b === 1 ? ph : -1);
      FMU(`${b === 0 ? '하나' : '둘'} · ${Math.min(16, Math.floor(this.t / BT) + 1)} / 16`);
      if (this.t >= 16 * BT + 0.4) { this.next(); return; }
    } else if (id === 'B1') {
      const BT = SCFG.b1Beat, k = 1 - beat(BT);
      this.b1outer.material.opacity = 0.2 + 0.5 * k; this.b1inner.material.opacity = 0.5 + 0.4 * k;
      this.b1outer.scale.setScalar(0.7 + 0.5 * (1 - k));
      FMU(`박자 ${Math.min(8, Math.floor(this.t / BT) + 1)} / 8 — 듣기만`);
      if (this.t >= 8 * BT + 0.3) { this.next(); return; }
    } else if (id === 'B2') {
      const BT = SCFG.b2Beat, b = Math.floor(this.t / BT) % 2, ph = beat(BT);
      this.b2L.countdown(b === 0 ? ph : -1); this.b2R.countdown(b === 1 ? ph : -1);
      const gl = ph > 0.9 ? 1 : 0; if (gl) (b === 0 ? this.b2L : this.b2R).glow(1);
      const hits = Math.min(8, Math.floor(this.t / BT));
      FMU(`맞춘 스텝 ${hits} / 8`, hits >= 8 ? CS.prism : CS.dim);
      if (this.t >= 8 * BT + 0.5) { this.next(); return; }
    } else if (id === 'B3') {
      const ST = SCFG.b3Step, cyc = 3 * ST, lt = this.t % cyc, W = ST * 0.82;
      this.b3.forEach((f, i) => { const t0 = i * ST; if (lt >= t0 && lt < t0 + W) f.countdown((lt - t0) / W); else if (lt >= t0 + W && lt < t0 + ST) f.glow(1 - (lt - t0 - W) / (ST - W)); else f.countdown(-1); });
      FMU(`세트 ${Math.min(2, Math.floor(this.t / cyc) + 1)} / 2`);
      if (this.t >= 2 * cyc + 0.4) { this.next(); return; }
    } else if (id === 'B4') {
      // 구간 리듬 — 발밑 → 전방 존 2개로 리듬이 흘러감
      const per = SCFG.b4Beat, seq = Math.floor(this.t / per) % 3, k = 1 - beat(per);
      this.b4foot.op(seq === 0 ? 0.45 + 0.55 * k : 0.45);
      this.b4rings[0].material.opacity = seq === 1 ? 0.3 + 0.65 * k : 0.35;
      this.b4rings[1].material.opacity = seq === 2 ? 0.3 + 0.65 * k : 0.25;
      if (this.t >= 9 * per + 0.3) { this._gateAdvance(); return; }
    } else if (id === 'C1') {
      const n = Math.max(1, 3 - Math.floor(this.t)); if (n !== this._lastCount) { this._setCount(n, CS.ink); this._lastCount = n; }
      if (this.t >= st.dur) { this.next(); return; }   // 출발!
    } else if (id === 'C2') {
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'C3') {
      if (this.c3cue.userData.plane) this.c3cue.userData.plane.material.opacity = (this.t % 1.4) < 1.0 ? 1 : 0;
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'C4') {
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'C5') {
      this.liveSpeed = Math.max(0.12, 1 - this.t / 2.8);   // 실제 감속
      this.c5stripes.forEach((s, i) => { s.material.opacity = (0.7 - i * 0.13) * (0.5 + 0.5 * Math.sin(this.t * 3 - i)); });
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
      this.bkA2L.material.opacity = side === 0 ? 0.9 : 0.35;
      this.bkA2R.material.opacity = side === 1 ? 0.9 : 0.35;
      FMU(`좌우 ${Math.min(6, Math.floor(this.t / per) + 1)} / 6`, CS.sand);
      if (this.t >= 6 * per + 0.4) { this.next(); return; }
    } else if (id === 'BK_A3') {
      // 리듬 드리블 — 링 펄스, 8박
      const BT = 0.5, k = 1 - beat(BT);
      this.bkA3ring.material.opacity = 0.3 + 0.6 * k; this.bkA3ring.scale.setScalar(0.8 + 0.6 * (1 - k));
      FMU(`${Math.floor(this.t / BT) % 2 === 0 ? '하나' : '둘'} · ${Math.min(8, Math.floor(this.t / BT) + 1)} / 8`);
      if (this.t >= 8 * BT + 0.4) { this.next(); return; }
    } else if (id === 'BK_B1') {
      // 스텝백 궤적 보기 — 3발 순차 강조(고스트 리플레이), 2회 루프
      const ST = 0.9, cyc = 3 * ST, lt = this.t % cyc;
      this.bkB1.forEach((f, i) => { const t0 = i * ST; f.op(lt >= t0 && lt < t0 + ST ? 0.95 : 0.3); if (lt >= t0 && lt < t0 + ST * 0.8) f.countdown((lt - t0) / (ST * 0.8)); else f.countdown(-1); });
      FMU(`궤적 ${Math.min(2, Math.floor(this.t / cyc) + 1)} / 2 — 눈으로`);
      if (this.t >= 2 * cyc + 0.3) { this.next(); return; }
    } else if (id === 'BK_B2') {
      // 스텝 분해 밟기 — 순서 카운트다운 링, 맞춘 스텝 x/3
      const ST = 1.0, cyc = 3 * ST, lt = this.t % cyc, W = ST * 0.82;
      this.bkB2.forEach((f, i) => { const t0 = i * ST; if (lt >= t0 && lt < t0 + W) f.countdown((lt - t0) / W); else if (lt >= t0 + W && lt < t0 + ST) f.glow(1 - (lt - t0 - W) / (ST - W)); else f.countdown(-1); });
      const hits = Math.min(3, Math.floor((this.t % cyc) / ST) + 3 * Math.floor(this.t / cyc));
      FMU(`맞춘 스텝 ${Math.min(3, Math.floor(this.t / ST))} / 3`, this.t >= cyc ? CS.prism : CS.dim);
      if (this.t >= 2 * cyc + 0.3) { this.next(); return; }
    } else if (id === 'BK_B3') {
      // 컷 감속 — 스트라이프 웨이브 + 디딤발 글로우
      this.bkB3stripes.forEach((s, i) => { s.material.opacity = (0.7 - i * 0.15) * (0.5 + 0.5 * Math.sin(this.t * 4 - i)); });
      this.bkB3foot.op(0.5 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 3)));
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
      this.bxHold.geometry.dispose();
      this.bxHold.geometry = new THREE.RingGeometry(0.20, 0.235, 44, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
      this.bxHold.material.opacity = 0.95;
      const done = Math.min(3, rep + (p >= 1 ? 1 : 0));
      FMU(`가드 유지 ${done} / 3 ✓`, done >= 3 ? CS.prism : CS.sand);
      this._gate = done;
      if (done >= 3) { this.next(); return; }
    } else if (id === 'BX_B2') {
      // 회피 슬립 — 좌우 점선 존 교대 위협
      const per = 1.0, left = Math.floor(this.t / per) % 2 === 0;
      this.bxDodgeL.material.opacity = left ? 0.95 : 0.3;
      this.bxDodgeR.material.opacity = left ? 0.3 : 0.95;
      FMU(`슬립 ${Math.min(6, Math.floor(this.t / per) + 1)} / 6`, CS.coral);
      if (this.t >= 6 * per + 0.3) { this.next(); return; }
    } else if (id === 'BX_B3') {
      // 잽 스윕 — 스윕 밴드 밝기 + 타겟 수축 링, 맞춘 잽 카운트
      const BT = 0.9, ph = beat(BT);
      this.bxSweep.material.opacity = 0.4 + 0.5 * (1 - ph);
      this.bxB3cd.material.opacity = 0.4 + 0.55 * ph; this.bxB3cd.scale.setScalar(1.9 - 0.9 * ph);
      const hits = Math.min(6, Math.floor(this.t / BT));
      FMU(`맞춘 잽 ${hits} / 6`, hits >= 6 ? CS.prism : CS.dim);
      if (this.t >= 6 * BT + 0.4) { this._gateAdvance(); return; }
    } else if (id === 'BX_C1') {
      const n = Math.max(1, 3 - Math.floor(this.t)); if (n !== this._lastCount) { this._setCountWall(n, CS.ink); this._lastCount = n; }
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BX_C2' || id === 'BX_C3') {
      if (this.t >= st.dur) { this.next(); return; }
    } else if (id === 'BX_C4') {
      this.liveSpeed = Math.max(0.12, 1 - this.t / 2.4);
      if (this.liveSpeed <= 0.13 && this.t > 2.8) { this.liveSpeed = 1; this.stageIdx = this.stages.findIndex(s2 => s2.id === 'BX_FIN'); this.t = 0; this._enter(); return; }
    }
  }
}
