import * as THREE from 'three';
import { WALL_Z } from './scene.js';

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
const LINGER = 0.35;

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
    SCALE: 2.6,   // 컷인 확산을 무릎 투사면(≤4m)에 맞춤 — 투사 범위 밖 UI 방지
  },
};

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
  setNumber(n) {
    const m = new THREE.MeshBasicMaterial({
      map: makeNumberTexture(n), transparent: true, depthWrite: false,
    });
    this.num = new THREE.Mesh(new THREE.PlaneGeometry(this.radius * 1.1, this.radius * 1.1), m);
    this.num.position.z = 0.004;
    // 바닥 눕힘(rx=-90°)만으로 글자 위쪽이 -Z(전방) = 유저가 읽는 방향 (rz 추가 회전 없음)
    this.group.add(this.num);
  }
  /** phase: hidden|preview|countdown|linger  progress: 0..1 */
  render(phase, progress, orderIdx, sizeScale) {
    const g = this.group;
    if (phase === 'hidden') { g.visible = false; return; }
    g.visible = true;
    g.scale.setScalar(sizeScale);

    const fade = FADE_STEPS[Math.min(orderIdx, FADE_STEPS.length - 1)];
    if (phase === 'preview') {
      // NEXT 단계 = 윤곽만 (위계: NOW 풀강도 / NEXT 윤곽)
      this.fill.material.opacity = 0.03 * fade;
      this.edge.material.opacity = 0.5 * fade;
      this.edge.material.color.setHex(this.color);
      this.fill.material.color.setHex(this.color);
      this.cd.visible = false;
      if (this.num) this.num.material.opacity = 0.5 * fade;
    } else if (phase === 'countdown') {
      this.fill.material.opacity = 0.20 + 0.15 * progress;
      this.edge.material.opacity = 1.0;
      this.edge.material.color.setHex(this.color);
      this.fill.material.color.setHex(this.color);
      this.cd.visible = true;
      const s = 1.9 - 0.9 * progress; // 1.9 → 1.0 수축
      this.cd.scale.setScalar(s);
      this.cd.material.opacity = 0.35 + 0.6 * progress;
      if (this.num) this.num.material.opacity = 1.0;
    } else if (phase === 'linger') {
      const k = 1 - progress;
      this.fill.material.color.setHex(COLORS.success);
      this.edge.material.color.setHex(COLORS.success);
      this.fill.material.opacity = 0.3 * k;
      this.edge.material.opacity = 0.9 * k;
      this.cd.visible = false;
      if (this.num) this.num.material.opacity = 0.4 * k;
    }
  }
}

// ── 방향 화살표 ───────────────────────────────────────────────
function makeArrow(color, len = 0.55) {
  const s = new THREE.Shape();
  const w = 0.10, hw = 0.22, hl = 0.24;
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, len - hl); s.lineTo(-hw / 2, len - hl);
  s.lineTo(0, len); s.lineTo(hw / 2, len - hl); s.lineTo(w / 2, len - hl);
  s.lineTo(w / 2, 0); s.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), flatMat(color, 0.85));
  const g = new THREE.Group();
  g.add(mesh);
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
          const radius = tk.type === 'targetMark' ? 0.20 : 0.17;
          const mk = new Marker(radius, color, isWall ? 'wall' : 'floor');
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
          ev.marker = mk;
          ev.surface = isWall ? 'wall' : 'floor';
          ev.color = color;
          ev.foot = tk.foot ?? null;
          ev.srcToken = tk;
          (isWall ? this.wallRoot : this.floorRoot).add(mk.group);
          this._applyClip(mk.group, isWall ? this.wallClip : this.floorClip);
        }
        if (tk.type === 'orderPulse' && ev.marker && !ev.marker.num) {
          ev.marker.setNumber(tk.n);
        }
        if (tk.type === 'directionGuide') {
          const arrow = makeArrow(COLORS.guide, packData.sport === 'basketball' ? 0.9 : 0.55);
          const p = this._mapFloor(tk);
          arrow.position.x = p.x; arrow.position.z = p.z;
          // angle: 0 = 전방(-Z). 시계 방향 회전.
          // angle 0 = 전방(-Z). 로컬 +Y가 rx=-90° 후 월드 -Z로 매핑됨.
          arrow.rotation.z = THREE.MathUtils.degToRad(-(tk.angle ?? 0));
          ev.arrow = { obj: arrow, t: tk.t, lifetime: tk.lifetime };
          this.floorRoot.add(arrow);
          this._applyClip(arrow, this.floorClip);
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
          this._applyClip(g, this.floorClip);
        }
      }
    }

    // ── 상시 토큰 비주얼 ──
    for (const tk of this.ambient) {
      if (tk.type === 'pathLane') this._buildLane(packData);
      if (tk.type === 'stepMark' && !isBoxing) {
        // 복싱 스탠스 발판 (상시)
        const mk = new Marker(0.16, COLORS[tk.foot] ?? COLORS.left, 'floor');
        const p = this._mapFloor(tk);
        mk.group.position.x = p.x; mk.group.position.z = p.z;
        mk.render('preview', 0, 0, 1);
        mk.fill.material.opacity = 0.16;
        mk.edge.material.opacity = 0.7;
        mk.isStance = true;
        this.floorRoot.add(mk.group);
        this._applyClip(mk.group, this.floorClip);
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
      this._applyClip(line, this.floorClip);
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
        this._applyClip(line, this.floorClip);
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
    const upcoming = this.events.filter(e => e.t >= now - LINGER);
    const orderOf = new Map();
    upcoming.forEach((e, i) => orderOf.set(e, i));

    for (const ev of this.events) {
      const order = orderOf.get(ev) ?? 99;
      let phase = 'hidden', progress = 0;

      if (now >= ev.t && now < ev.t + LINGER) {
        phase = 'linger';
        progress = (now - ev.t) / LINGER;
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

      if (ev.marker) {
        // 위치 갱신
        if (ev.surface === 'wall') {
          const p = this._mapWall(ev.srcToken);
          ev.marker.group.position.set(p.x, p.y, p.z);
        } else {
          const p = this._mapFloor(ev.srcToken);
          ev.marker.group.position.set(p.x, 0.012, p.z);
          // 투사 풋프린트 여유 판정 — UI는 통째로 들어올 때만 등장 (잘림 금지)
          if (this.footprintTest && phase !== 'hidden') {
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
        // 동시 표시 개수 제한: preview 단계에만 적용
        if (phase === 'preview' && order >= maxVisible) phase = 'hidden';
        ev.marker.render(phase, progress, Math.min(order, FADE_STEPS.length - 1), size);
        // 감속 스트라이프는 해당 플랜트 카운트다운 동안만
        if (ev.stripes) ev.stripes.visible = phase === 'countdown' || phase === 'linger';
      }

      if (ev.arrow) {
        const a = ev.arrow;
        let vis = now >= a.t - lead && now < a.t + a.lifetime;
        if (vis && this.footprintTest) {
          vis = this.footprintTest(
            a.obj.position.x + this.floorRoot.position.x,
            a.obj.position.z + this.floorRoot.position.z
          );
        }
        a.obj.visible = vis;
        if (vis) {
          const k = Math.min(1, (now - (a.t - lead)) / Math.max(lead, 0.001));
          a.obj.children[0].material.opacity = 0.35 + 0.55 * k;
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
    this.effects.burst(pos, ev.color, normal);
    if (this.onEvent) this.onEvent(ev);
  }
}
