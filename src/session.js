import * as THREE from 'three';

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

export const BRAND = { red: 0xfa3030, coral: 0xfe6e3c, sand: 0xfec389, prism: 0xd1feff, ink: 0xffffff, dim: 0x9b9b9b };
const CS = { red:'#fa3030', coral:'#fe6e3c', sand:'#fec389', prism:'#d1feff', ink:'#ffffff', dim:'#c9c9c9', mute:'#9b9b9b' };

function flatMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

// ── 지면 텍스트 (눕힘만으로 -Z 전방이 위 = 유저 읽는 방향) ──
function makeTextMesh(text, { size = 0.10, color = '#ffffff', weight = 700 } = {}) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = `${weight} 64px Pretendard, -apple-system, sans-serif`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width) + 24; c.height = 88;
  const x = c.getContext('2d'); x.font = font; x.fillStyle = color; x.textBaseline = 'middle';
  x.fillText(text, 12, 46);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * c.width / c.height, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const g = new THREE.Group(); g.add(plane); g.rotation.x = -Math.PI / 2; g.position.y = 0.013; g.renderOrder = 7;
  g.userData.plane = plane;
  return g;
}
function makeTextPlane(text, opts = {}) { const g = makeTextMesh(text, opts); const p = g.userData.plane; g.remove(p); return p; }

// ── 발형 마크 (발끝 박스 위 + 뒤꿈치 아래 = -Z 전방) ──
function makeFootTexture(mirror) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d'); ctx.strokeStyle = '#fa3030'; ctx.fillStyle = 'rgba(250,48,48,0.16)'; ctx.lineWidth = 9;
  if (mirror) { ctx.translate(128, 0); ctx.scale(-1, 1); }
  ctx.beginPath();
  ctx.moveTo(64,14); ctx.bezierCurveTo(106,14,116,52,110,96); ctx.bezierCurveTo(107,122,102,138,102,156);
  ctx.bezierCurveTo(102,176,84,186,64,186); ctx.bezierCurveTo(44,186,26,176,26,156);
  ctx.bezierCurveTo(26,138,21,122,18,96); ctx.bezierCurveTo(12,52,22,14,64,14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(42,206); ctx.lineTo(86,206); ctx.quadraticCurveTo(96,206,94,220);
  ctx.quadraticCurveTo(90,242,64,242); ctx.quadraticCurveTo(38,242,34,220); ctx.quadraticCurveTo(32,206,42,206);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  return new THREE.CanvasTexture(c);
}
class FootMark {
  constructor(foot) {
    this.group = new THREE.Group();
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(0.145, 0.29),
      new THREE.MeshBasicMaterial({ map: makeFootTexture(foot === 'right'), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.215, 44), flatMat(BRAND.prism, 0)); this.ring.position.z = 0.001;
    this.hold = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.215, 44, 1, Math.PI / 2, 0.001), flatMat(BRAND.sand, 0)); this.hold.position.z = 0.002;
    this.group.add(this.plane, this.ring, this.hold);
    this.group.rotation.x = -Math.PI / 2; this.group.position.y = 0.013; this.group.renderOrder = 6;
    this.plane.rotation.z = foot === 'left' ? THREE.MathUtils.degToRad(8) : THREE.MathUtils.degToRad(-8);
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

// ── 지면 프리미티브 ──
function floorRing(x, z, rIn, rOut, color, op = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 48), flatMat(color, op));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.013, z); m.renderOrder = 5; return m;
}
function floorArc(x, z, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.20, 0.235, 40, 1, Math.PI * 0.15, Math.PI * 1.4), flatMat(color, 0.85));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0135, z); m.renderOrder = 6; return m;
}
function floorArrow(x, z, deg, color, len = 0.4) {
  const s = new THREE.Shape(); const w = 0.09, hw = 0.2, hl = 0.2;
  s.moveTo(-w/2,0); s.lineTo(-w/2,len-hl); s.lineTo(-hw/2,len-hl); s.lineTo(0,len);
  s.lineTo(hw/2,len-hl); s.lineTo(w/2,len-hl); s.lineTo(w/2,0); s.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), flatMat(color, 0.85));
  const g = new THREE.Group(); g.add(mesh); g.rotation.x = -Math.PI/2; g.position.set(x, 0.014, z);
  g.rotation.z = THREE.MathUtils.degToRad(deg); g.renderOrder = 6; return g;
}
function floorStripe(x, z, w, color, op) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.06), flatMat(color, op));
  m.rotation.x = -Math.PI/2; m.position.set(x, 0.012, z); m.renderOrder = 4; return m;
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
  l.computeLineDistances(); l.renderOrder = 4; return l;
}

// ─────────────────────────────────────────────────────────────
const STAGES = [
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
  { id:'T2', label:'T-2 · 5초 뒤 실전 준비로 자동 진행 (두 번 탭 = 바로)', voice:['션','5초 뒤에 넘어갈게요. 준비됐으면 두 번 탭으로 바로 가요.'], dur:5, foot:'두 번 탭 = 즉시 · 무입력 = 자동 진행 — 반복은 게이트·다운시프트가 담당' },
  { id:'C1', dur:3, label:'C · 실전 1/5 — 출발', voice:['시스템','3, 2, 1.'], hap:'시작 타이밍 진동', foot:'두 번 탭 → 출발 (이후 잠금)' },
  { id:'C2', dur:7, label:'C · 실전 2/5 — 페이스 유지 (라이브)', voice:['션','박자만. (간헐)'], wear:'SAFE 착지 안정화' },
  { id:'C3', dur:7, label:'C · 실전 3/5 — 흔들림 보정 (라이브)', voice:['션','박자. (한 단어)'], hap:'착지 보조 2박' },
  { id:'C4', dur:7, label:'C · 실전 4/5 — 마지막 1km BOOST (라이브·가속)', voice:['션','여기서부터 마지막 1km. 나한테 붙어요.'], wear:'BOOST 추진 보조 · 리듬 저하 시 강도↑', cue:'구간 종료 Match Rate' },
  { id:'C5', label:'C · 실전 5/5 — 종료 감속 (라이브·감속→정지)', voice:['시스템','여기까지. 잘 달렸어요.'], hap:'완료 진동' },
  { id:'FIN', label:'R-F · 리포트', voice:['시스템','리포트를 앱으로 보냈어요.'], cue:'Ghost Review — 션 박자와 내 착지 겹쳐 보기' },
];

export class Session {
  constructor(scene, tokens, xbot, rig, onStage) {
    this.tokens = tokens; this.xbot = xbot; this.rig = rig; this.onStage = onStage;
    this.active = false; this.stageIdx = 0; this.t = 0; this.auto = false;
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.G = {}; this._lastCount = null;
    this.liveSpeed = 1;   // 실전 라이브 속도 배율 (BOOST/감속)
    this.bobY = 0;        // 박자 시점 바운스 (스트레칭·익히기)
    this._build();
  }
  get stage() { return STAGES[this.stageIdx].id; }
  get total() { return STAGES.length; }
  /** 실전 라이브 — 팩 재생이 실제로 돌아가는 단계 */
  get isLive() { return ['C2','C3','C4','C5'].includes(this.stage); }
  _clip(o) { if (!this.tokens.floorClip) return; o.traverse(x => { if (x.material) x.material.clippingPlanes = this.tokens.floorClip; }); }
  _mk(id) { const g = new THREE.Group(); g.visible = false; this.root.add(g); this.G[id] = g; return g; }

  _build() {
    this.slotFS = new THREE.Group(); this.slotFS.position.set(-0.74, 0, -2.55);
    this.slotFL = new THREE.Group(); this.slotFL.position.set(0, 0, -2.3);
    this.slotFM = new THREE.Group(); this.slotFM.position.set(0, 0, -1.4);
    this.root.add(this.slotFS, this.slotFL, this.slotFM);

    this.countGroup = new THREE.Group(); this.countGroup.position.set(0, 0, -1.85);
    this.countRing = floorRing(0, -1.85, 0.30, 0.335, BRAND.red, 0);
    this.root.add(this.countGroup, this.countRing);

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

    for (const id in this.G) this._clip(this.G[id]);
    this._clip(this.countGroup);
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

  start() { this.active = true; this.stageIdx = 0; this.t = 0; this.root.visible = true; this._enter(); }
  stop() { this.active = false; this.root.visible = false; this.tokens.root.visible = true; this.liveSpeed = 1; this.bobY = 0; }
  tapAdvance() {
    if (!this.active) return;
    if (this.stage === 'T2') { this.stageIdx = STAGES.findIndex(s => s.id === 'C1'); this.t = 0; this._enter(); return; }
    if (this.stage !== 'FIN') this._next();
  }
  next() { if (this.active && this.stageIdx < STAGES.length - 1) { this.stageIdx++; this.t = 0; this._enter(); } }
  prev() { if (this.active && this.stageIdx > 0) { this.stageIdx--; this.t = 0; this._enter(); } }
  _next() { this.next(); }

  _enter() {
    const st = STAGES[this.stageIdx];
    this.onStage?.(st);
    const live = ['C2','C3','C4','C5'].includes(st.id);
    this.tokens.root.visible = live;     // 라이브 = 실제 팩 토큰이 흐른다
    this.liveSpeed = st.id === 'C4' ? 1.18 : 1;
    this.bobY = 0;
    for (const id in this.G) this.G[id].visible = false;
    this._setCount(null);
    if (this.G[st.id]) this.G[st.id].visible = true;
    this._lastCount = null;

    const S = this._slot.bind(this);
    const FS = t => S(this.slotFS, t, { size: 0.055, color: CS.mute });
    const FL = t => S(this.slotFL, t, { size: 0.10, color: CS.ink });
    const FM = (t, c = CS.dim) => S(this.slotFM, t, { size: 0.07, color: c });
    FS(''); FL(''); FM('');
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
      case 'T2': FS('T-2'); FM('두 번 탭 = 바로 · 가만히 있으면 자동 진행'); this._setCount(5); break;
      case 'C1': FS('RUN 00:00'); break;
      case 'C2': FS('RUN 04:12 · SAFE'); FM('발밑 비움 · 전방 선행 발자국'); break;
      case 'C3': FS('RUN 08:40'); break;
      case 'C4': S(this.slotFS, 'LAST 1KM · BOOST', { size: 0.055, color: CS.prism }); break;
      case 'C5': FS('COOL DOWN'); break;
      case 'FIN': FS('REPORT'); break;
    }
    this._fmCache = null;
  }

  update(dt) {
    if (!this.active) return;
    const st = STAGES[this.stageIdx]; this.t += dt; const id = st.id;
    const live = this.isLive;
    // 오버레이 좌표: 라이브면 러너를 따라감(전방 슬롯 유지), 아니면 원점 고정
    const bodyZ = live ? this.xbot.getBodyPos().z : 0;
    this.root.position.x = this.tokens.floorRoot.position.x;
    this.root.position.z = this.tokens.floorRoot.position.z + bodyZ;
    const beat = (per) => (this.t % per) / per;

    // 박자 시점 바운스 — 몸이 살아있는 느낌 (라이브는 실제 모캡 눈이 담당)
    if (id === 'A4' || id === 'B2') this.bobY = 0.028 * Math.abs(Math.sin(Math.PI * this.t / 0.6));
    else if (id === 'B1' || id === 'B3') this.bobY = 0.018 * Math.abs(Math.sin(Math.PI * this.t / 0.55));
    else if (id[0] === 'A') this.bobY = 0.007 * Math.sin(this.t * 1.8);   // 호흡
    else this.bobY = 0;

    // FM 슬롯 갱신 헬퍼 — 값이 바뀔 때만 텍스처 재생성
    const FMU = (text, color) => {
      if (text === this._fmCache) return; this._fmCache = text;
      this._slot(this.slotFM, text, { size: 0.07, color: color || CS.dim });
    };

    if (id === 'READY' || id === 'T1') {
      const tap = id === 'READY' ? this.tap : this.tap1; const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      tap.children[0].material.opacity = 0.5 + 0.45 * k; tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
      if (id === 'T1' && this.t >= 4.5) { this.next(); return; }
    } else if (id === 'A1') {
      // 발목 돌리기 — 아크가 실제로 돌며 좌 8회 → 우 8회 카운트
      const REP = 1.0, half = 8 * REP;
      const side = this.t < half ? 0 : 1;
      this.a1L.group.visible = side === 0; this.a1R.group.visible = side === 1;
      this.a1arc.rotation.z = -((this.t % REP) / REP) * Math.PI * 2;
      const rep = Math.min(8, Math.floor((this.t - side * half) / REP) + 1);
      FMU(`${side === 0 ? '왼발' : '오른발'} ${rep} / 8`, CS.sand);
      if (this.t >= 2 * half + 0.6) { this.next(); return; }
    } else if (id === 'A2') {
      // 종아리 — 10초 홀드 채움 + 초 카운트, 좌우 교대
      const HOLD = 10, PH = HOLD + 0.9;
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
      const SW = 1.5, fwd = beat(SW) < 0.5;
      const fm2 = this.a3fwd.children[0].material, bm = this.a3bwd.children[0].material;
      fm2.opacity = fwd ? 0.95 : 0.22; bm.opacity = fwd ? 0.22 : 0.95;
      fm2.color.setHex(fwd ? BRAND.coral : BRAND.dim); bm.color.setHex(fwd ? BRAND.dim : BRAND.coral);
      FMU(`${Math.min(10, Math.floor(this.t / SW) + 1)} / 10`);
      if (this.t >= 10 * SW + 0.5) { this.next(); return; }
    } else if (id === 'A4') {
      const b = Math.floor(this.t / 0.6) % 2, ph = 1 - beat(0.6);
      this.a4L.countdown(b === 0 ? ph : -1); this.a4R.countdown(b === 1 ? ph : -1);
      FMU(`${b === 0 ? '하나' : '둘'} · ${Math.min(16, Math.floor(this.t / 0.6) + 1)} / 16`);
      if (this.t >= 16 * 0.6 + 0.4) { this.next(); return; }
    } else if (id === 'B1') {
      const k = 1 - beat(0.6); this.b1outer.material.opacity = 0.2 + 0.5 * k; this.b1inner.material.opacity = 0.5 + 0.4 * k;
      this.b1outer.scale.setScalar(0.7 + 0.5 * (1 - k));
      FMU(`박자 ${Math.min(8, Math.floor(this.t / 0.6) + 1)} / 8 — 듣기만`);
      if (this.t >= 8 * 0.6 + 0.3) { this.next(); return; }
    } else if (id === 'B2') {
      const b = Math.floor(this.t / 0.7) % 2, ph = beat(0.7);
      this.b2L.countdown(b === 0 ? ph : -1); this.b2R.countdown(b === 1 ? ph : -1);
      const gl = ph > 0.9 ? 1 : 0; if (gl) (b === 0 ? this.b2L : this.b2R).glow(1);
      const hits = Math.min(8, Math.floor(this.t / 0.7));
      FMU(`맞춘 스텝 ${hits} / 8`, hits >= 8 ? CS.prism : CS.dim);
      if (this.t >= 8 * 0.7 + 0.5) { this.next(); return; }
    } else if (id === 'B3') {
      const cyc = 3 * 1.1, lt = this.t % cyc;
      this.b3.forEach((f, i) => { const t0 = i * 1.1; if (lt >= t0 && lt < t0 + 0.9) f.countdown((lt - t0) / 0.9); else if (lt >= t0 + 0.9 && lt < t0 + 1.1) f.glow(1 - (lt - t0 - 0.9) / 0.2); else f.countdown(-1); });
      FMU(`세트 ${Math.min(2, Math.floor(this.t / cyc) + 1)} / 2`);
      if (this.t >= 2 * cyc + 0.4) { this.next(); return; }
    } else if (id === 'B4') {
      // 구간 리듬 — 발밑 → 전방 존 2개로 리듬이 흘러감
      const per = 0.55, seq = Math.floor(this.t / per) % 3, k = 1 - beat(per);
      this.b4foot.op(seq === 0 ? 0.45 + 0.55 * k : 0.45);
      this.b4rings[0].material.opacity = seq === 1 ? 0.3 + 0.65 * k : 0.35;
      this.b4rings[1].material.opacity = seq === 2 ? 0.3 + 0.65 * k : 0.25;
      if (this.t >= 9 * per + 0.3) { this.next(); return; }
    } else if (id === 'T2') {
      const rem = Math.max(0, st.dur - this.t), n = Math.max(1, Math.ceil(rem));
      if (n !== this._lastCount) { this._setCount(n); this._lastCount = n; }
      const f = rem - Math.floor(rem); this.countRing.material.opacity = 0.3 + 0.5 * f; this.countRing.scale.setScalar(0.8 + 0.6 * f);
      if (this.t >= st.dur) { this.next(); return; }   // 무입력 = 자동 진행 (무한 루프 없음)
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
      if (this.liveSpeed <= 0.13 && this.t > 3.2) { this.liveSpeed = 1; this.stageIdx = STAGES.findIndex(s2 => s2.id === 'FIN'); this.t = 0; this._enter(); return; }
    }
    if (this.auto && st.dur && this.t >= st.dur && id !== 'T2') this._next();
  }
}
