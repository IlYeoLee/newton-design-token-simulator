import * as THREE from 'three';
import { WALL_Z } from './scene.js';
import { renderDesignCanvas } from './studio/design.js';

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
const LAYOUT = {
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
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = '700 84px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
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
  constructor(radius, color, surface /* 'floor'|'wall' */) {
    this.group = new THREE.Group();
    this.radius = radius;
    this.color = color;
    this.surface = surface;

    this.fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), flatMat(color, 0.22));
    this.edge = new THREE.Mesh(new THREE.RingGeometry(radius * 0.88, radius, 44), flatMat(color, 0.95));
    this.cd   = new THREE.Mesh(new THREE.RingGeometry(radius * 0.93, radius, 44), flatMat(0xffffff, 0.9));
    this.num  = null;

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
  }
  clearArt() {
    if (this.art) { this.group.remove(this.art); this.art.material.dispose(); this.art = null; }
    this.fill.visible = true; this.edge.visible = true;
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
    if (contract === 'avoid') {
      this.edge.visible = false;
      this.avoidArt = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz),
        new THREE.MeshBasicMaterial({ map: makeDashedRingTexture(this.color), transparent: true, depthWrite: false }));
      this.avoidArt.position.z = 0.003;
      this.group.add(this.avoidArt);
    } else {
      this.edge.visible = true;
    }
    if (contract === 'hold' || holdRing) {
      this.holdArt = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz),
        new THREE.MeshBasicMaterial({ map: makeHoldRingTexture(this.color, 0.66), transparent: true, depthWrite: false }));
      this.holdArt.position.z = 0.0035;
      this.group.add(this.holdArt);
    }
  }
  /** phase: hidden|preview|countdown|linger  progress: 0..1 */
  render(phase, progress, orderIdx, sizeScale) {
    const g = this.group;
    if (phase === 'hidden') { g.visible = false; return; }
    g.visible = true;
    g.scale.setScalar(sizeScale * TCFG.markScale);
    if (this.art) this.art.material.opacity = phase === 'preview' ? (this.strongPreview ? 1 : 0.55) : 1;

    const fade = FADE_STEPS[Math.min(orderIdx, FADE_STEPS.length - 1)];
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
    }
    // 계약 오버레이(점선/holdRing)는 링 강도를 따라감
    if (this.avoidArt) this.avoidArt.material.opacity = Math.min(1, this.edge.material.opacity + 0.1);
    if (this.holdArt) this.holdArt.material.opacity = Math.min(1, this.edge.material.opacity + 0.05);
  }
}

// ── 방향 화살표 ───────────────────────────────────────────────
// tip = 화살표 끝(촉) 모양: triangle(▲) · chevron(》) · diamond(◆) · bar(▬) · none(선만)
function makeArrow(color, len = 0.55, tip = 'triangle') {
  const g = new THREE.Group();
  const w = 0.09, hw = 0.24, hl = 0.22;
  const mesh = (geo) => { const m = new THREE.Mesh(geo, flatMat(color, 0.85)); g.add(m); return m; };
  const shape = (build) => { const s = new THREE.Shape(); build(s); return new THREE.ShapeGeometry(s); };

  // 자루(shaft) — 촉이 있으면 촉 밑동까지, 없으면 끝까지
  const shaftLen = tip === 'none' ? len : Math.max(0.02, len - hl * 0.55);
  const shaft = mesh(new THREE.PlaneGeometry(w, shaftLen));
  shaft.position.y = shaftLen / 2;

  const hy = len - hl;   // 촉 밑동 y
  if (tip === 'triangle') {
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

  /** 제작자 모드: 드롭인 아트를 모든 지면 마커에 적용/해제 */
  setMarkerArt(tex) {
    this.markerArt = tex;
    for (const ev of this.events) {
      if (!ev.marker || ev.surface === 'wall') continue;
      tex ? ev.marker.setArt(tex) : ev.marker.clearArt();
    }
  }

  setParams(p) { Object.assign(this.params, p); }

  setPack(packData) {
    // 기존 비주얼 제거
    this.floorRoot.clear();
    this.wallRoot.clear();
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
          const mk = new Marker(radius, color, isWall ? 'wall' : 'floor');
          // MARK 계약 변조 (도달/회피/유지) — 벽 불즈아이는 도달 전용
          if (!isWall && (tk.contract && tk.contract !== 'reach' || tk.holdRing)) mk.setContract(tk.contract, tk.holdRing);
          // 토큰 비주얼 디자인(그라디언트·블러·SVG) → CanvasTexture 아트로 교체
          if (!isWall && tk.design) {
            const tex = new THREE.CanvasTexture(renderDesignCanvas(tk.design, 256));
            tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
            mk.setArt(tex);
            if (tk.design.shape === 'number') mk._skipNumber = true;
          } else if (this.markerArt && !isWall) mk.setArt(this.markerArt);
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
        if (this.markerArt) mk.setArt(this.markerArt);
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
  }

  _mapFloor(tk) {
    const L = this.layout;
    if (L.mode === 'spatial') return { x: tk.nx * L.SCALE, z: tk.ny * L.SCALE };
    if (L.mode === 'static')  return { x: tk.nx * L.FLOOR_SCALE, z: -tk.ny * L.FLOOR_SCALE };
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
      // 러닝: 진행 방향 중앙 대시 라인
      const len = L.V * packData.duration + 3;
      const pts = [];
      for (let z = 1.2; z > -len; z -= 0.45) pts.push(new THREE.Vector3(0, 0.012, z));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineDashedMaterial({
          color: COLORS.lane, dashSize: 0.16, gapSize: 0.24,
          transparent: true, opacity: 0.55,
        })
      );
      line.computeLineDistances();
      this.floorRoot.add(line);
      this._applyClip(line, this._floorClipFor());
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
    for (const ev of this.events) { ev.fired = false; ev._wasVisible = false; }
    this.stats = { inGaze: 0, total: 0 };
  }

  /** 무릎 투사 흔들림 오프셋 — 바닥 토큰 전체에 적용 */
  setShake(dx, dz) {
    this.floorRoot.position.x = dx;
    this.floorRoot.position.z = dz;
  }

  update(now, dt) {
    const { lead, size, maxVisible } = this.params;
    const L = this.layout;
    if (!L) return;

    // 다가오는 이벤트 순서 계산 (preview 투명도 감쇠용)
    const upcoming = this.events.filter(e => e.t >= now - TCFG.linger);
    const orderOf = new Map();
    upcoming.forEach((e, i) => orderOf.set(e, i));

    for (const ev of this.events) {
      const order = orderOf.get(ev) ?? 99;
      let phase = 'hidden', progress = 0;

      if (now >= ev.t && now < ev.t + TCFG.linger) {
        phase = 'linger';
        progress = (now - ev.t) / TCFG.linger;
        if (!ev.fired) {
          ev.fired = true;
          this._fire(ev);
        }
      } else if (now >= ev.t - lead && now < ev.t) {
        phase = 'countdown';
        progress = (now - (ev.t - lead)) / lead;
      } else if (now < ev.t - lead && order < maxVisible) {
        phase = 'preview';
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
            const visNow = phase !== 'hidden';
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
          a.obj.traverse(o => { if (o.material) o.material.opacity = op; });   // 자루+촉 여러 메시
          a.obj.scale.setScalar(size);
        }
      }
    }
  }

  _fire(ev) {
    const pos = ev.marker
      ? ev.marker.group.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3();
    const normal = ev.surface === 'wall' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const b = ev.srcToken?.design?.burst;   // 토큰별 터짐 조절 (없으면 기본 버스트)
    this.effects.burst(pos, ev.color, normal, (b && b.on) ? b : {});
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
