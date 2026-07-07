import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// 세션 흐름 프로토 (러닝) — 와이어프레임 v2 이식
//   READY → A 스트레칭(2동작) → T-1 브릿지 → B 사전 익히기 → T-2 브릿지 → C 실전(기존 루프)
//   목적: "UI가 이렇게 나오는가 / 이 단계를 거치는가 / 1인칭에서 어떻게 보이는가" 검증.
//   X봇은 비실전 단계에서 정지(따라하기 검증 아님).
// 규칙 이식:
//   - Step-type(A·B) = 발형 마크(발끝 박스+뒤꿈치) + 문장 허용, DEAD 존 면제
//   - 타이포 고정 슬롯: F-S 좌상단 / F-L PRIME 상단 중앙 / F-M 하단 밴드
//   - 색 = 상태 전용 (Active 레드 / Hold·보조 샌드 / 성공 프리즘)
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  red: 0xfa3030, coral: 0xfe6e3c, sand: 0xfec389, prism: 0xd1feff,
  ink: 0xffffff, dim: 0x9b9b9b,
};

function flatMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  });
}

// ── 지면 텍스트 스프라이트 (고정 슬롯용) ──────────────────────
function makeTextMesh(text, { size = 0.10, color = '#ffffff', weight = 700 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${weight} 64px Pretendard, -apple-system, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = 88;
  const ctx2 = c.getContext('2d');
  ctx2.font = font;
  ctx2.fillStyle = color;
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, 12, 46);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  const aspect = c.width / c.height;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size * aspect, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  plane.rotation.z = Math.PI; // 유저(-Z 전진)가 읽는 방향 — 마커 숫자와 동일 패턴
  const g = new THREE.Group();
  g.add(plane);
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.013;
  g.renderOrder = 7;
  g.userData.plane = plane;
  return g;
}

// 눕힌 그룹 내부용 텍스트 평면 (rz=PI만)
function makeTextPlane(text, opts = {}) {
  const g = makeTextMesh(text, opts);
  const plane = g.userData.plane;
  g.remove(plane);
  return plane;
}

// ── 발형 마크 (Step-type ① stepMark 발형 표현형) ─────────────
function makeFootTexture(mirror) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#fa3030';
  ctx.fillStyle = 'rgba(250,48,48,0.16)';
  ctx.lineWidth = 9;
  if (mirror) { ctx.translate(128, 0); ctx.scale(-1, 1); }
  // 발끝 박스(위) — 진행 방향
  ctx.beginPath();
  ctx.moveTo(64, 14);
  ctx.bezierCurveTo(106, 14, 116, 52, 110, 96);
  ctx.bezierCurveTo(107, 122, 102, 138, 102, 156);
  ctx.bezierCurveTo(102, 176, 84, 186, 64, 186);
  ctx.bezierCurveTo(44, 186, 26, 176, 26, 156);
  ctx.bezierCurveTo(26, 138, 21, 122, 18, 96);
  ctx.bezierCurveTo(12, 52, 22, 14, 64, 14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 분리 뒤꿈치(아래)
  ctx.beginPath();
  ctx.moveTo(42, 206);
  ctx.lineTo(86, 206);
  ctx.quadraticCurveTo(96, 206, 94, 220);
  ctx.quadraticCurveTo(90, 242, 64, 242);
  ctx.quadraticCurveTo(38, 242, 34, 220);
  ctx.quadraticCurveTo(32, 206, 42, 206);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

class FootMark {
  constructor(foot /* 'left'|'right' */) {
    this.group = new THREE.Group();
    const tex = makeFootTexture(foot === 'right');
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.145, 0.29),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    // 타이밍/홀드 링
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.215, 44), flatMat(BRAND.prism, 0.0));
    this.ring.position.z = 0.001;
    // 홀드 채움 아크 (샌드) — thetaLength를 진행도로
    this.holdGeo = null;
    this.hold = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.215, 44, 1, Math.PI / 2, 0.001), flatMat(BRAND.sand, 0.0));
    this.hold.position.z = 0.002;
    this.group.add(this.plane, this.ring, this.hold);
    this.group.rotation.x = -Math.PI / 2;
    this.group.position.y = 0.013;
    this.group.renderOrder = 6;
    // 발끝이 진행 방향(-Z)을 향하게 + 좌우 자연 각도 — 평면에만 적용 (링은 대칭)
    const yaw = foot === 'left' ? THREE.MathUtils.degToRad(8) : THREE.MathUtils.degToRad(-8);
    this.plane.rotation.z = Math.PI + yaw;
  }
  setOpacity(k) {
    this.plane.material.opacity = k;
  }
  /** hold 진행 0..1 — 채움 링 (되감김 가능) */
  setHold(p) {
    this.hold.geometry.dispose();
    this.hold.geometry = new THREE.RingGeometry(0.19, 0.215, 44, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
    this.hold.material.opacity = p > 0 ? 0.95 : 0;
  }
  /** 타이밍 링 수축 progress 0..1 */
  setCountdown(p) {
    if (p < 0) { this.ring.material.opacity = 0; return; }
    this.ring.material.opacity = 0.35 + 0.6 * p;
    this.ring.scale.setScalar(1.9 - 0.9 * p);
  }
  flashSuccess(k /* 1→0 */) {
    this.ring.material.color.setHex(BRAND.prism);
    this.ring.material.opacity = 0.95 * k;
    this.ring.scale.setScalar(1 + 0.4 * (1 - k));
  }
}

// ── TAP ×2 프롬프트 (① 선택형 + ② 카운트 조합 — 항상 같은 자리) ──
function makeTapPrompt() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.07, 32), flatMat(BRAND.prism, 0.95));
    ring.position.x = (i - 0.5) * 0.18;
    g.add(ring);
  }
  const label = makeTextPlane('TAP ×2', { size: 0.055, color: '#d1feff' });
  label.position.set(0, -0.16, 0.001);
  g.add(label);
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.013;
  g.renderOrder = 7;
  return g;
}

// ─────────────────────────────────────────────────────────────
const STAGES = [
  // voice: 자막 영역으로 노출 (누가 · 무슨 멘트)
  { id: 'READY',    label: '0 · READY — 발 두 번 탭 → 시작',        dur: 5, voice: ['시스템','션의 마지막 1km 페이스 팩. 준비되면 발을 두 번 탭하세요.'] },
  { id: 'STR1',     label: 'A · STRETCH 1/2 — 종아리 늘리기 (Hold)', dur: 9, voice: ['션','앞 원에 왼발. 뒤꿈치는 바닥 — 종아리가 당기면 잘 된 거예요.'] },
  { id: 'STR2',     label: 'A · STRETCH 2/2 — 제자리 박자 걷기',     dur: 8, voice: ['션','이제 내 걸음 박자로 제자리 걷기. 하나, 둘, 하나, 둘.'] },
  { id: 'BRIDGE1',  label: 'T-1 · STAGE CLEAR → 사전 익히기',        dur: 5, voice: ['시스템','몸 다 풀렸어요. 탭 두 번이면 다음으로.'] },
  { id: 'LEARN',    label: 'B · LEARN — 3스텝 이어 밟기 (발형+숫자)', dur: 14, voice: ['션','링이 닫힐 때 밟아요. 지금 — 좋아요, 그 박자예요.'] },
  { id: 'BRIDGE2',  label: 'T-2 · 한 번 더 / 실전 — 밟아서 선택',     dur: 5, voice: ['션','한 번 더 갈까요, 넘어갈까요?'] },
  { id: 'REAL',     label: 'C · REAL RUN — 실전 (존형·문장 금지)',    dur: Infinity, voice: ['션','박자만.'] },
];

export class Session {
  constructor(scene, tokens, xbot, rig, onStage) {
    this.tokens = tokens;
    this.xbot = xbot;
    this.rig = rig;
    this.onStage = onStage;
    this.active = false;
    this.stageIdx = 0;
    this.t = 0;
    this.auto = false;  // 수동 미리보기 모드 기본 — ◀/▶로 단계 탐색

    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    this._build();
  }

  get stage() { return STAGES[this.stageIdx].id; }

  _clip(obj) {
    if (!this.tokens.floorClip) return;
    obj.traverse(o => { if (o.material) o.material.clippingPlanes = this.tokens.floorClip; });
  }

  _build() {
    // ── 타이포 고정 슬롯 (러너 시작 위치 기준, -Z 전방) ──
    // F-S 상태: PRIME 좌측 / F-L 지시문: PRIME 상단 중앙(2.3m) / F-M 보조: 하단 밴드(1.5m)
    this.slotFS = new THREE.Group(); this.slotFS.position.set(-0.72, 0, -2.6);
    this.slotFL = new THREE.Group(); this.slotFL.position.set(0, 0, -2.3);
    this.slotFM = new THREE.Group(); this.slotFM.position.set(0, 0, -1.45);
    this.root.add(this.slotFS, this.slotFL, this.slotFM);

    // READY: 기준형 시작 원 + TAP
    this.readyRing = new THREE.Mesh(new THREE.RingGeometry(0.20, 0.225, 48), flatMat(BRAND.dim, 0.9));
    this.readyRing.rotation.x = -Math.PI / 2;
    this.readyRing.position.set(0, 0.012, -1.8);
    this.tap = makeTapPrompt();
    this.tap.position.set(0, 0.013, -1.8);
    this.root.add(this.readyRing, this.tap);

    // A-1 종아리: 앞발(L) + 뒷발(R, Hold)
    this.strFrontL = new FootMark('left');  this.strFrontL.group.position.set(-0.12, 0.013, -1.95);
    this.strBackR  = new FootMark('right'); this.strBackR.group.position.set(0.14, 0.013, -1.25);
    // A-2 제자리: 좌우
    this.walkL = new FootMark('left');  this.walkL.group.position.set(-0.16, 0.013, -1.6);
    this.walkR = new FootMark('right'); this.walkR.group.position.set(0.16, 0.013, -1.6);
    // B: 3스텝 (발형 + 숫자)
    this.learn = [];
    const learnPos = [[-0.16, -1.7], [0.18, -2.25], [-0.14, -2.8]];
    for (let i = 0; i < 3; i++) {
      const fm = new FootMark(i % 2 === 0 ? 'left' : 'right');
      fm.group.position.set(learnPos[i][0], 0.013, learnPos[i][1]);
      const num = makeTextPlane(String(i + 1), { size: 0.11, color: '#ffffff' });
      num.position.set(-0.17, 0.17, 0.002);
      fm.group.add(num);
      this.learn.push(fm);
      this.root.add(fm.group);
    }
    // T-2 선택 존
    this.chAgain = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.18, 40), flatMat(BRAND.sand, 0.9));
    this.chNext  = new THREE.Mesh(new THREE.CircleGeometry(0.18, 40), flatMat(BRAND.red, 0.35));
    this.chNextEdge = new THREE.Mesh(new THREE.RingGeometry(0.165, 0.185, 40), flatMat(BRAND.red, 0.95));
    for (const [m, x] of [[this.chAgain, -0.45], [this.chNext, 0.45], [this.chNextEdge, 0.45]]) {
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, -1.8);
      this.root.add(m);
    }
    this.chLabelA = makeTextMesh('한 번 더', { size: 0.07 });
    this.chLabelA.position.set(-0.45, 0.013, -2.12);
    this.chLabelN = makeTextMesh('실전', { size: 0.07 });
    this.chLabelN.position.set(0.45, 0.013, -2.12);
    this.root.add(this.strFrontL.group, this.strBackR.group, this.walkL.group, this.walkR.group,
      this.chLabelA, this.chLabelN);

    this._texts = [];
    this._clip(this.root);
  }

  _setSlot(slot, text, opts) {
    // 슬롯 내용 교체
    while (slot.children.length) {
      const c = slot.children.pop();
      c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose();
    }
    if (!text) return;
    const m = makeTextMesh(text, opts);
    this._clip(m);
    slot.add(m);
  }

  start() {
    this.active = true;
    this.stageIdx = 0;
    this.t = 0;
    this.root.visible = true;
    this._enterStage();
  }
  stop() {
    this.active = false;
    this.root.visible = false;
    this.tokens.root.visible = true;
  }
  tapAdvance() {
    if (!this.active) return;
    if (this.stage !== 'REAL') this._next();
  }
  next() { if (this.active && this.stageIdx < STAGES.length - 1) { this.stageIdx++; this.t = 0; this._enterStage(); } }
  prev() { if (this.active && this.stageIdx > 0) { this.stageIdx--; this.t = 0; this._enterStage(); } }

  _next() {
    if (this.stageIdx < STAGES.length - 1) {
      this.stageIdx++;
      this.t = 0;
      this._enterStage();
    }
  }

  _enterStage() {
    const id = this.stage;
    this.onStage?.(STAGES[this.stageIdx]);
    // 전부 숨김
    for (const o of [this.readyRing, this.tap, this.strFrontL.group, this.strBackR.group,
      this.walkL.group, this.walkR.group, this.chAgain, this.chNext, this.chNextEdge,
      this.chLabelA, this.chLabelN, ...this.learn.map(l => l.group)]) o.visible = false;

    // 실전: 세션 오버레이 내리고 팩 토큰으로
    this.tokens.root.visible = (id === 'REAL');
    this.root.visible = (id !== 'REAL');
    if (id === 'REAL') { this._setSlot(this.slotFS); this._setSlot(this.slotFL); this._setSlot(this.slotFM); return; }

    if (id === 'READY') {
      this.readyRing.visible = this.tap.visible = true;
      this._setSlot(this.slotFS, 'SEAN · LAST 1KM PACE', { size: 0.06, color: '#9b9b9b' });
      this._setSlot(this.slotFL, 'READY', { size: 0.13 });
      this._setSlot(this.slotFM, '발 두 번 탭 → 시작', { size: 0.075, color: '#c9c9c9' });
    } else if (id === 'STR1') {
      this.strFrontL.group.visible = this.strBackR.group.visible = true;
      this.strFrontL.setOpacity(1); this.strBackR.setOpacity(1);
      this._setSlot(this.slotFS, 'STRETCH 1/2', { size: 0.055, color: '#9b9b9b' });
      this._setSlot(this.slotFL, '앞 원에 왼발', { size: 0.115 });
      this._setSlot(this.slotFM, '뒤꿈치는 바닥에 · 10초', { size: 0.07, color: '#fec389' });
    } else if (id === 'STR2') {
      this.walkL.group.visible = this.walkR.group.visible = true;
      this._setSlot(this.slotFS, 'STRETCH 2/2', { size: 0.055, color: '#9b9b9b' });
      this._setSlot(this.slotFL, '제자리 걷기 — 내 박자로', { size: 0.10 });
      this._setSlot(this.slotFM, '하나, 둘, 하나, 둘', { size: 0.07, color: '#c9c9c9' });
    } else if (id === 'BRIDGE1') {
      this.tap.visible = true;
      this._setSlot(this.slotFS, 'T-1', { size: 0.055, color: '#9b9b9b' });
      this._setSlot(this.slotFL, 'STAGE CLEAR', { size: 0.12, color: '#d1feff' });
      this._setSlot(this.slotFM, '탭 두 번 → 사전 익히기', { size: 0.07, color: '#c9c9c9' });
    } else if (id === 'LEARN') {
      for (const l of this.learn) { l.group.visible = true; l.setOpacity(1); l.setHold(0); }
      this._setSlot(this.slotFS, 'LEARN 3/4', { size: 0.055, color: '#9b9b9b' });
      this._setSlot(this.slotFL, '링이 닫힐 때 밟기', { size: 0.10 });
      this._setSlot(this.slotFM, '숫자 순서대로', { size: 0.07, color: '#c9c9c9' });
    } else if (id === 'BRIDGE2') {
      this.chAgain.visible = this.chNext.visible = this.chNextEdge.visible = true;
      this.chLabelA.visible = this.chLabelN.visible = true;
      this._setSlot(this.slotFS, 'T-2', { size: 0.055, color: '#9b9b9b' });
      this._setSlot(this.slotFL, '밟아서 선택', { size: 0.10 });
      this._setSlot(this.slotFM, '왼쪽 = 한 번 더 · 오른쪽 = 실전', { size: 0.065, color: '#c9c9c9' });
    }
  }

  update(dt) {
    if (!this.active) return;
    const st = STAGES[this.stageIdx];
    this.t += dt;
    const id = st.id;

    // 무릎 투사 흔들림 동기 (팩 토큰과 동일 좌표계)
    this.root.position.x = this.tokens.floorRoot.position.x;
    this.root.position.z = this.tokens.floorRoot.position.z;

    if (id === 'READY' || id === 'BRIDGE1') {
      // TAP 링 맥동
      const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      this.tap.children[0].material.opacity = 0.5 + 0.45 * k;
      this.tap.children[1].material.opacity = 0.5 + 0.45 * (1 - k);
    } else if (id === 'STR1') {
      // Hold 채움 (7초) + 마지막 프리즘 플래시
      const p = Math.min(1, this.t / 7);
      this.strBackR.setHold(p);
      if (p >= 1) this.strBackR.flashSuccess(Math.max(0, 1 - (this.t - 7) / 0.6));
    } else if (id === 'STR2') {
      // 좌우 교대 박자 펄스 (몸풀기 리듬)
      const beat = Math.floor(this.t / 0.6) % 2;
      const ph = (this.t % 0.6) / 0.6;
      const pulse = 1 - ph;
      this.walkL.setCountdown(beat === 0 ? pulse : -1);
      this.walkR.setCountdown(beat === 1 ? pulse : -1);
    } else if (id === 'LEARN') {
      // 2.2s 간격 순차 수축 → 성공 플래시, 2회 반복
      const cyc = 3 * 2.2 + 1.4;
      const lt = this.t % cyc;
      this.learn.forEach((l, i) => {
        const t0 = i * 2.2;
        if (lt >= t0 && lt < t0 + 1.8) l.setCountdown((lt - t0) / 1.8);
        else if (lt >= t0 + 1.8 && lt < t0 + 2.6) l.flashSuccess(1 - (lt - t0 - 1.8) / 0.8);
        else l.setCountdown(-1);
      });
    } else if (id === 'BRIDGE2') {
      const k = 0.75 + 0.25 * Math.sin(this.t * 3);
      this.chNextEdge.material.opacity = k;
    }

    if (this.auto && this.t >= st.dur) this._next();
  }
}
