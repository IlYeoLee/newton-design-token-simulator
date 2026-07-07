import * as THREE from 'three';
import { WALL_Z } from './scene.js';

// ─────────────────────────────────────────────────────────────
// 투사 리그 — 기존 Stabilizer Simulator에서 이식
//   러닝/농구: 오른 무릎 장착 모듈에서 바닥 투사
//     · 2차 스프링-댐퍼 안정화  K_s=22, K_d=9 (임계감쇠)
//     · 서보 속도 제한 300°/s × 무릎높이 → 바닥 선속도 상한
//     · 3m 초과 드리프트 시 스냅
//   복싱: 몸 뒤 스테이션 (−0.85, 1.3, 0.78)에서 벽면 투사
// ─────────────────────────────────────────────────────────────

const K_S = 22;
const K_D = 9;
const SRV_MAX_VEL_DEG = 300;
const KNEE_OFFSET = new THREE.Vector3(0.03, -0.03, 0.03);   // 오른 무릎 모듈
// 복싱 벽면 프로젝터: 인물 앞 바닥의 초단초점(UST) 스테이션
const STATION_POS = new THREE.Vector3(0.55, 0.13, WALL_Z + 0.55);

// 무릎 사출 사다리꼴 풋프린트 (몸 기준: 발끝 근처에서 좁게 시작 → 전방으로 퍼짐)
// 프로젝터는 이 풋프린트 밖에는 UI를 그릴 수 없다 — 토큰 렌더 범위의 물리적 한계
// 크기는 패널 슬라이더로 조절 (setFootprint / setWallSize)
const FP_HALF_NEAR = 0.32;
const FP_SPREAD = 0.27;     // 전방 1m당 반폭 증가량 (수평 확산각 ≈ 30°)

// 보정 ON 잔여 오차 — 실제 HW(IMU 노이즈+지연+칼만 후 잔차)의 실효 2~4cm 표현
const RESIDUAL_PASS = 0.06;   // 무릎 스윙 통과율
const FEEDFWD_LAG = 0.15;     // 타겟 전환 시 서보 랙 시각 반영률 (속도 피드포워드 가정)

function beamMesh(color) {
  const m = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.07,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  m.renderOrder = 3;
  m.frustumCulled = false;
  return m;
}

function setBeam(mesh, apex, corners) {
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    pts.push(apex.x, apex.y, apex.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BufferGeometry();
  mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

export class ProjectorRig {
  constructor(scene, xbot) {
    this.scene = scene;
    this.xbot = xbot;
    this.stabilize = true;
    this.mode = null;
    this.shake = new THREE.Vector2();   // 토큰에 적용할 (dx, dz)
    this.errorCm = 0;                   // HUD용 보정 오차

    // 무릎 모듈 하우징 (기존: 빨간 박스)
    this.kneeBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.065, 0.065),
      new THREE.MeshStandardMaterial({ color: 0xff2828, roughness: 0.4, emissive: 0x551010 })
    );
    scene.add(this.kneeBox);

    // 후방 스테이션 (복싱 벽면 투사용)
    this.station = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.14, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x2a303c, roughness: 0.5, metalness: 0.6 })
    );
    this.station.add(body);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.02, 18),
      new THREE.MeshStandardMaterial({ color: 0xff5c8a, emissive: 0xb83a5e, emissiveIntensity: 1.5 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.09;
    this.station.add(lens);
    this.station.position.copy(STATION_POS);
    scene.add(this.station);

    this.floorBeam = beamMesh(0xff4444);
    this.wallBeam = beamMesh(0xff5c8a);
    scene.add(this.floorBeam, this.wallBeam);

    // 투사 풋프린트 면 — 붉은 그라디언트 (무릎 쪽 진홍 → 원거리 연분홍, 참조 디자인)
    this.footFill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.30,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    this.footFill.renderOrder = 2;
    this.footFill.frustumCulled = false;
    scene.add(this.footFill);
    this._fp = null;

    // 복싱 벽면 투사면 (붉은 반투명 — 투사 범위 즉시 인지)
    this.wallFill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xff5c5c, transparent: true, opacity: 0.10,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    this.wallFill.renderOrder = 2;
    this.wallFill.frustumCulled = false;
    scene.add(this.wallFill);

    // 스프링 상태
    this.qStab = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.initialized = false;

    // 조절 가능한 투사면 파라미터
    this.fpNear = 0.05;   // 무릎(몸) 앞 시작 거리 (m)
    this.fpFar = 2.0;     // 끝 거리 (m)
    this.wallW = 1.8;     // 벽면 투사 가로 (m)
    this.wallH = 1.8;     // 벽면 투사 세로 (m)

    // GPU 클리핑 플레인 — 모든 투사 UI 재질에 공유 (참조 유지, 값만 갱신)
    this.floorClip = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
    this.wallClip = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
  }

  setFootprint(nearM, farM) {
    this.fpNear = nearM;
    this.fpFar = Math.max(nearM + 0.3, farM);
  }

  setWallSize(w, h) { this.wallW = w; this.wallH = h; }

  _halfAt(d) {
    return FP_HALF_NEAR + FP_SPREAD * Math.max(0, d - this.fpNear);
  }

  setPack(sport, tokenEvents) {
    this.mode = sport;
    this.initialized = false;
    this.shake.set(0, 0);
    this.errorCm = 0;
    this.events = tokenEvents;

    const isKnee = sport === 'running' || sport === 'basketball';
    this.kneeBox.visible = isKnee;
    this.floorBeam.visible = isKnee;
    this.footFill.visible = isKnee;
    this.station.visible = sport === 'boxing';
    this.wallBeam.visible = sport === 'boxing';
    this.wallFill.visible = sport === 'boxing';
    if (!isKnee) this._fp = null;

    if (sport === 'boxing') {
      // 벽면 타겟 평균 위치 저장 (빔/투사면은 update에서 실시간 계산 — 크기 슬라이더 반영)
      const wallEvs = tokenEvents.filter(e => e.surface === 'wall');
      let cx = 0, cy = 1.4;
      if (wallEvs.length) {
        cx = wallEvs.reduce((s, e) => s + e.srcToken.nx * 2.2, 0) / wallEvs.length;
        cy = wallEvs.reduce((s, e) => s + 1.1 + e.srcToken.ny * 1.2, 0) / wallEvs.length;
      }
      this._wallCenter = { cx, cy };
    }
  }

  _updateWall() {
    const { cx, cy } = this._wallCenter ?? { cx: 0, cy: 1.4 };
    const w = this.wallW, h = this.wallH;
    const corners = [
      new THREE.Vector3(cx - w / 2, cy - h / 2, WALL_Z + 0.01),
      new THREE.Vector3(cx + w / 2, cy - h / 2, WALL_Z + 0.01),
      new THREE.Vector3(cx + w / 2, cy + h / 2, WALL_Z + 0.01),
      new THREE.Vector3(cx - w / 2, cy + h / 2, WALL_Z + 0.01),
    ];
    setBeam(this.wallBeam, STATION_POS, corners);
    const wv = [];
    for (const idx of [0, 1, 2, 0, 2, 3]) wv.push(corners[idx].x, corners[idx].y, corners[idx].z);
    this.wallFill.geometry.dispose();
    this.wallFill.geometry = new THREE.BufferGeometry();
    this.wallFill.geometry.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));

    // 벽면 4변 클리핑 플레인
    this.wallClip[0].setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), new THREE.Vector3(cx - w / 2, 0, 0));
    this.wallClip[1].setFromNormalAndCoplanarPoint(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(cx + w / 2, 0, 0));
    this.wallClip[2].setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, cy - h / 2, 0));
    this.wallClip[3].setFromNormalAndCoplanarPoint(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, cy + h / 2, 0));
  }

  /** 벽면 투사면 내부 판정 (복싱 벽 토큰용) */
  wallContains(x, y) {
    const { cx, cy } = this._wallCenter ?? { cx: 0, cy: 1.4 };
    return Math.abs(x - cx) <= this.wallW / 2 && Math.abs(y - cy) <= this.wallH / 2;
  }

  /** 안정화 목표 — 몸 기준 로컬 오프셋 (전진 이동은 랙 없이 따라감) */
  _stableLocal(now, body) {
    if (this.mode === 'running') {
      // 풋프린트 중앙을 안정화 기준으로 (슬라이더 반영)
      return new THREE.Vector3(0 - body.x, 0.01, -(this.fpNear + this.fpFar) / 2);
    }
    // basketball: 다음(또는 마지막) 바닥 이벤트 마크를 몸 기준으로
    let target = null;
    for (const ev of this.events) {
      if (ev.surface !== 'floor' || !ev.marker) continue;
      target = ev;
      if (ev.t >= now) break;
    }
    if (!target) return new THREE.Vector3(0, 0.01, 0);
    return new THREE.Vector3(
      target.srcToken.nx * 4.0 - body.x,
      0.01,
      target.srcToken.ny * 4.0 - body.z
    );
  }

  update(now, dt) {
    if (!this.mode) return;
    if (this.mode === 'boxing') { this._updateWall(); return; }

    // ── 무릎 모듈 월드 위치 ──
    const knee = this.xbot.getKneeWorld();
    if (!knee) return;
    const kneeModule = knee.add(KNEE_OFFSET);
    this.kneeBox.position.copy(kneeModule);

    const body = this.xbot.getBodyPos();
    const stableLocal = this._stableLocal(now, body);
    const kneeH = Math.max(0.15, kneeModule.y);

    // 보정 OFF 기준: 무릎 스윙 편차(몸 기준 로컬)가 지렛대 배율로 투사 중심에 전달
    const kneeLocal = { x: kneeModule.x - body.x, z: kneeModule.z - body.z };
    const NEUTRAL = { x: 0.13, z: -0.05 };
    const LEVER = 1.8;
    const rawLocal = new THREE.Vector3(
      stableLocal.x + (kneeLocal.x - NEUTRAL.x) * LEVER,
      0.01,
      stableLocal.z + (kneeLocal.z - NEUTRAL.z) * LEVER
    );

    if (!this.initialized) {
      this.qStab.copy(stableLocal);
      this.vel.set(0, 0, 0);
      this.initialized = true;
    }

    let offLocal;   // stableLocal 대비 편차 = 토큰/빔에 반영할 흔들림
    if (this.stabilize) {
      if (this.qStab.distanceTo(stableLocal) > 3.0) {
        this.qStab.copy(stableLocal);
        this.vel.set(0, 0, 0);
      }
      // 2차 스프링-댐퍼 (서보 짐벌, 로컬 공간)
      const err = stableLocal.clone().sub(this.qStab);
      const acc = err.multiplyScalar(K_S).sub(this.vel.clone().multiplyScalar(K_D));
      this.vel.addScaledVector(acc, dt);
      const vMax = (SRV_MAX_VEL_DEG * Math.PI / 180) * kneeH;
      if (this.vel.length() > vMax) this.vel.setLength(vMax);
      this.qStab.addScaledVector(this.vel, dt);

      // 서보 랙(타겟 전환 시) 일부 + 무릎 스윙 잔여 통과 + 고주파 미세 지터
      const lag = this.qStab.clone().sub(stableLocal).multiplyScalar(FEEDFWD_LAG);
      const t = performance.now() / 1000;
      offLocal = new THREE.Vector3(
        lag.x + (rawLocal.x - stableLocal.x) * RESIDUAL_PASS + Math.sin(t * 7.3) * 0.007 + Math.sin(t * 13.1) * 0.004,
        0,
        lag.z + (rawLocal.z - stableLocal.z) * RESIDUAL_PASS + Math.cos(t * 8.7) * 0.007
      );
    } else {
      offLocal = rawLocal.clone().sub(stableLocal);
      offLocal.y = 0;
    }

    // 토큰에 전달할 흔들림 오프셋 + HUD 오차
    this.shake.set(offLocal.x, offLocal.z);
    this.errorCm = Math.hypot(offLocal.x, offLocal.z) * 100;

    // ── 무릎 사출 사다리꼴 풋프린트 (월드 좌표) ──
    const fwd = this.xbot.getForward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const ox = body.x + offLocal.x;
    const oz = body.z + offLocal.z;
    this._fp = { ox, oz, fx: fwd.x, fz: fwd.z, rx: right.x, rz: right.z };

    const pt = (d, h, sgn) => new THREE.Vector3(
      ox + fwd.x * d + right.x * h * sgn, 0.011,
      oz + fwd.z * d + right.z * h * sgn
    );
    const halfNear = this._halfAt(this.fpNear), halfFar = this._halfAt(this.fpFar);
    const corners = [
      pt(this.fpNear, halfNear, -1), pt(this.fpNear, halfNear, 1),
      pt(this.fpFar, halfFar, 1),    pt(this.fpFar, halfFar, -1),
    ];

    // 풋프린트 면 — 붉은 그라디언트 (near 진홍 → far 연분홍)
    const v = [], col = [];
    const NEAR_C = [0.55, 0.07, 0.07], FAR_C = [1.0, 0.72, 0.72];
    const CORNER_C = [NEAR_C, NEAR_C, FAR_C, FAR_C];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      v.push(corners[idx].x, corners[idx].y, corners[idx].z);
      col.push(...CORNER_C[idx]);
    }
    this.footFill.geometry.dispose();
    this.footFill.geometry = new THREE.BufferGeometry();
    this.footFill.geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.footFill.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

    setBeam(this.floorBeam, kneeModule, corners);

    // 풋프린트 4변 클리핑 플레인 갱신 (안쪽 방향 노멀)
    const up = new THREE.Vector3(0, 1, 0);
    const cP = new THREE.Vector3(
      (corners[0].x + corners[2].x) / 2, 0, (corners[0].z + corners[2].z) / 2);
    const setEdge = (plane, a, b) => {
      const e = new THREE.Vector3().subVectors(b, a); e.y = 0;
      const n = new THREE.Vector3().crossVectors(up, e).normalize();
      plane.setFromNormalAndCoplanarPoint(n, a);
      if (plane.distanceToPoint(cP) < 0) { plane.normal.negate(); plane.constant = -plane.constant; }
    };
    setEdge(this.floorClip[0], corners[0], corners[1]);
    setEdge(this.floorClip[1], corners[1], corners[2]);
    setEdge(this.floorClip[2], corners[2], corners[3]);
    setEdge(this.floorClip[3], corners[3], corners[0]);

    // 투사각/커버리지 (HUD용): 무릎 높이 → near/far 틸트각, 필요 수직 FOV
    const nearMid = pt(this.fpNear, 0, 1), farMid = pt(this.fpFar, 0, 1);
    const nearD = Math.max(0.05, Math.hypot(nearMid.x - kneeModule.x, nearMid.z - kneeModule.z));
    const farD  = Math.hypot(farMid.x - kneeModule.x, farMid.z - kneeModule.z);
    const aNear = Math.atan2(kneeH, nearD) * 180 / Math.PI;
    const aFar  = Math.atan2(kneeH, farD) * 180 / Math.PI;
    this.geom = { kneeH, aNear, aFar, fovNeed: Math.abs(aNear - aFar) };
  }

  /** 풋프린트 내 전방거리 d0~d1 구간의 사다리꼴 코너 (교집합 시각화용) */
  segmentCorners(d0, d1) {
    const f = this._fp;
    if (!f) return null;
    const pt = (d, h, sgn) => new THREE.Vector3(
      f.ox + f.fx * d + f.rx * h * sgn, 0.013,
      f.oz + f.fz * d + f.rz * h * sgn
    );
    return [
      pt(d0, this._halfAt(d0), -1), pt(d0, this._halfAt(d0), 1),
      pt(d1, this._halfAt(d1), 1),  pt(d1, this._halfAt(d1), -1),
    ];
  }

  /** (x,z)의 몸 기준 전방 거리 (시야 낙하 범위 판정용) */
  forwardDist(x, z) {
    const f = this._fp;
    if (!f) return 0;
    return (x - f.ox) * f.fx + (z - f.oz) * f.fz;
  }

  /** (x,z)가 현재 투사 풋프린트 안인가.
   *  inset: UI가 경계에 잘리지 않도록 요소 반지름만큼 안쪽으로 여유 판정 */
  contains(x, z, inset = 0) {
    const f = this._fp;
    if (!f) return true;
    const dx = x - f.ox, dz = z - f.oz;
    const d = dx * f.fx + dz * f.fz;
    if (d < this.fpNear + inset || d > this.fpFar - inset) return false;
    const lat = dx * f.rx + dz * f.rz;
    return Math.abs(lat) <= this._halfAt(d) - inset;
  }
}
