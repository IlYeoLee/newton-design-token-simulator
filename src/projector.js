import * as THREE from 'three';
import { WALL_Z } from './scene.js';
import {
  budgetFromOmega, residualFrac, slowSigmaM, fastSigmaM,
  leverRatio, gimbalMinDown, gimbalBreakGain, omegaMaxDps,
} from './errorModel.js';

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

// 보정 ON 잔여 오차는 errorModel.js가 하드웨어 스펙에서 유도한다 (매직상수 제거).
// 정강이 각속도 ω를 매 프레임 실측해 지연항에 먹이므로, 스탠스/스윙 위상 의존성이
// 하드코딩이 아니라 물리에서 나온다.
// ω 저역통과 시정수(s). 접지 구간(~0.2s)보다 충분히 짧아야 한다 —
// 50ms로 두면 스윙 피크에서 내려오다 못 내려온 채 다시 올라가 접지의 골을
// 뭉개고, 위상이 영구 '스윙'으로 굳는다(실측: 접지 검출률 7.5%).
const OMEGA_TAU = 0.02;
// 합성 사인의 RMS가 σ와 일치하도록 하는 진폭 계수: RMS(a·sin+b·sin)=√((a²+b²)/2)
const J_A = 1.2288, J_B = 0.7000, J_C = Math.SQRT2;

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
    this.omegaDps = 0;                  // 실측 정강이 각속도 (오차모델 지연항 입력)
    this.phase = 'stance';              // ω에서 유도된 보행 위상 (선언 아님)
    this.budget = null;                 // 현 프레임 오차예산 (errorModel)
    this._shinPrev = null;

    // 무릎 모듈 하우징 — 하드웨어는 무채색 (NEWTON RED는 판정 큐 전용: 장면 위계 원칙).
    // 렌즈 도트만 작게 발광 — 장비임을 알리되 마크와 경쟁하지 않는다.
    this.kneeBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.065, 0.065),
      new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.45, metalness: 0.55 })
    );
    const kneeLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.008, 14),
      new THREE.MeshStandardMaterial({ color: 0xfa3030, emissive: 0xb32222, emissiveIntensity: 1.3 })
    );
    kneeLens.rotation.x = Math.PI / 2;
    kneeLens.position.set(0, -0.018, -0.034);
    this.kneeBox.add(kneeLens);
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
    this.stationPos = STATION_POS.clone();
    this.station.position.copy(this.stationPos);
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
    this.wallW = 2.8;     // 벽면 투사 가로 (m) — 전신 고스트+측면 큐 (유저 확정: 잘림 금지)
    this.wallH = 2.5;     // 벽면 투사 세로 (m) — 하단 0.15m부터: 전신 스탠딩 수용

    // GPU 클리핑 플레인 — 모든 투사 UI 재질에 공유 (참조 유지, 값만 갱신)
    this.floorClip = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
    this.wallClip = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
  }

  setFootprint(nearM, farM) {
    this.fpNear = nearM;
    this.fpFar = Math.max(nearM + 0.3, farM);
  }

  setWallSize(w, h) { this.wallW = w; this.wallH = h; }

  setStation(v) { this.stationPos.copy(v); this.station.position.copy(v); }

  _halfAt(d) {
    if (this.fixedPad) {   // 농구 고정 패드: near→far 선형 보간 (넓은 코트)
      const t = (d - this.fpNear) / Math.max(0.01, this.fpFar - this.fpNear);
      return this.fixedPad.halfNear + (this.fixedPad.halfFar - this.fixedPad.halfNear) * Math.max(0, Math.min(1, t));
    }
    return FP_HALF_NEAR + FP_SPREAD * Math.max(0, d - this.fpNear);
  }

  /** 팩 되감기 등 포즈가 순간이동하는 시점 — 다음 1샘플을 버려 가짜 ω를 막는다 */
  resetOmega() {
    // 루프 랩 = 포즈·위치 순간이동: ω 미분뿐 아니라 투사 방향/이동 스무딩도 스냅 —
    // 안 하면 저역통과(0.6s)가 옛 위치→새 위치를 보간하며 패드가 화면을 크게 휩쓴다
    this._shinPrev = null;
    this._smFwd = null;
    this._travelDir = null;
    this._bodyPrev = null;
  }

  setPack(sport, tokenEvents) {
    this.mode = sport;
    this.initialized = false;
    this._shinPrev = null;
    this.omegaDps = 0;
    this.shake.set(0, 0);
    this.errorCm = 0;
    this.events = tokenEvents;

    const isKnee = sport === 'running' || sport === 'basketball';
    this._sport = sport;
    const viz = this.visualize !== false;   // 실물 뷰: 커버리지 시각화 숨김 (실제 눈엔 투사 UI만 보임)
    this.kneeBox.visible = isKnee;
    this.floorBeam.visible = isKnee && viz;
    this.footFill.visible = isKnee && viz;
    this.station.visible = sport === 'boxing';
    this.wallBeam.visible = sport === 'boxing' && viz;
    this.wallFill.visible = sport === 'boxing' && viz;
    if (!isKnee) this._fp = null;

    // 농구 무릎 유닛: 컷 중 스윙을 줄이려 적당한 폭(발 앞 근접 존). 러닝은 스트리밍 레인.
    if (sport === 'basketball') {
      this.fixedPad = { halfNear: 0.55, halfFar: 0.85 };
      this.fpNear = 0.05; this.fpFar = 1.6;
      this._smFwd = null; this._travelDir = null; this._bodyPrev = null;   // 스무딩 리셋
    } else {
      this.fixedPad = null;
    }

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
    setBeam(this.wallBeam, this.stationPos, corners);
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
    // 농구도 무릎 착용 유닛(러닝과 동일 하드웨어). 스트리밍 레인 대신 넓은 풋워크
    // 풋프린트(fixedPad 폭)를 강한 보정으로 몸 앞에 안정적으로 유지 — 아래 무릎 경로 공용.

    // ── 무릎 모듈 월드 위치 — 오른 무릎 바깥 옆면에 착 부착 ──
    const knee = this.xbot.getKneeWorld();
    if (!knee) return;
    // 농구: 투사 방향을 저역통과 스무딩 — 매 컷·스텝마다 홱 도는 스윙 억제
    const fwdInst = this.xbot.getForward();
    if (this.mode === 'basketball') {
      if (!this._smFwd) this._smFwd = fwdInst.clone();
      this._smFwd.lerp(fwdInst, 1 - Math.exp(-dt / 0.6)).normalize();
    }
    const fwd0 = (this.mode === 'basketball' && this._smFwd) ? this._smFwd : fwdInst;
    const rightV = new THREE.Vector3(-fwd0.z, 0, fwd0.x);   // 몸 오른쪽(오른 무릎 바깥) 방향
    const kneeModule = knee.clone()
      .addScaledVector(rightV, 0.055)                       // 바깥 옆면 — 부착감 (0.10은 떨어져 보임)
      .addScaledVector(fwd0, 0.02)
      .add(new THREE.Vector3(0, 0.015, 0));
    this.kneeBox.position.copy(kneeModule);
    // 다리 방향으로 회전(강체 부착 느낌) — 무릎이 굽으면 함께 기울어짐
    this.kneeBox.rotation.set(0, Math.atan2(fwd0.x, fwd0.z), 0);

    const body = this.xbot.getBodyPos();
    const stableLocal = this._stableLocal(now, body);
    const kneeH = Math.max(0.15, kneeModule.y);

    // ── 정강이 각속도 ω 실측 — 오차모델 지연항의 입력 ──
    // 위상(스탠스/스윙)을 코드가 선언하지 않는다. ω를 재고, 위상은 그 결과로 나온다.
    const shinDir = this.xbot.getRightShinDir?.();
    if (shinDir) {
      if (this._shinPrev && dt > 1e-4) {
        const c = Math.max(-1, Math.min(1, this._shinPrev.dot(shinDir)));
        const inst = (Math.acos(c) * 180 / Math.PI) / dt;   // deg/s
        // 사람이 낼 수 없는 순간 변화 = 클립 랩/전환에 의한 포즈 불연속.
        // 운동이 아니므로 신호로 받지 않고 직전 ω를 유지한다(가짜 스파이크 차단).
        if (inst <= omegaMaxDps()) {
          this.omegaDps += (inst - this.omegaDps) * (1 - Math.exp(-dt / OMEGA_TAU));
        }
      }
      this._shinPrev = shinDir.clone();
    }
    this.budget = budgetFromOmega(this.omegaDps);
    this.phase = this.budget.phase;

    // 보정 OFF 기준: 무릎 스윙 편차(몸 기준 로컬)가 지렛대 배율로 투사 중심에 전달
    const kneeLocal = { x: kneeModule.x - body.x, z: kneeModule.z - body.z };
    const NEUTRAL = { x: 0.13, z: -0.05 };
    const LEVER = leverRatio();
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

      // ── 잔여 오차 = 오차모델이 유도한 3항의 합 (매직상수 없음) ──
      // ① 서보 랙: 속도 피드포워드가 지우지 못한 나머지(1 − ffCancel, 실측 0.67)
      const lag = this.qStab.clone().sub(stableLocal).multiplyScalar(residualFrac());
      // ② 지연 잔차: 크기는 ω 의존 지연항(모델), 방향은 실제 무릎 편차
      const dev = new THREE.Vector3(rawLocal.x - stableLocal.x, 0, rawLocal.z - stableLocal.z);
      if (dev.lengthSq() > 1e-8) dev.normalize();
      dev.multiplyScalar(this.budget.termsM.latency);
      // ③ 지향 잔차: 저주파 wander(자세+커프) + 고주파(광학 양자화).
      //    σ는 2D 벡터 크기 기준이므로 축당 σ/√2로 나눠 총 RMS가 σ와 같게 한다.
      const sSlow = slowSigmaM() / Math.SQRT2, sFast = fastSigmaM() / Math.SQRT2;
      const t = performance.now() / 1000;
      const jx = (J_A * Math.sin(t * 7.3) + J_B * Math.sin(t * 13.1)) * sSlow + J_C * Math.sin(t * 41.3) * sFast;
      const jz = J_C * Math.cos(t * 8.7) * sSlow + J_C * Math.cos(t * 37.9) * sFast;
      offLocal = new THREE.Vector3(lag.x + dev.x + jx, 0, lag.z + dev.z + jz);
    } else {
      offLocal = rawLocal.clone().sub(stableLocal);
      offLocal.y = 0;
    }

    // ── 짐벌 포화(정직한 물리) — 프로젝터는 정강이 축으로 사출. 정강이가 아래를
    //    충분히 안 향하면(킥·큰 스윙) 짐벌이 포화돼 바닥 투사가 정강이 수평 방향으로
    //    크게 붕괴한다. 스탠스(정강이 아래)엔 안정, 킥엔 무너짐. ──
    // 짐벌 포화(투사 붕괴)는 '모션 검증' 모드에서만 시연 — 정상 주행 gameplay는
    // 스탠스 동기 UI라 매끄러워야 하고(발 떼는 순간 튀면 안 됨), 하드웨어 한계는
    // 검증 버튼(킥 등)으로 정직히 드러낸다.
    const shin = this.xbot.verifyClip ? this.xbot.getRightShinDir?.() : null;
    const gimbalBreak = new THREE.Vector3();
    if (shin) {
      const down = -shin.y;                 // 1=완전아래, 0=수평, 음수=위(킥)
      const GIMBAL_MIN = gimbalMinDown();   // = cos(짐벌 조향 각범위)
      if (down < GIMBAL_MIN) {
        const over = (GIMBAL_MIN - down);
        const horiz = new THREE.Vector3(shin.x, 0, shin.z);
        if (horiz.lengthSq() > 1e-4) horiz.normalize();
        gimbalBreak.copy(horiz).multiplyScalar(over * gimbalBreakGain());
      }
    }

    // 토큰에 전달할 흔들림 오프셋 + HUD 오차
    this.shake.set(offLocal.x + gimbalBreak.x, offLocal.z + gimbalBreak.z);
    this.errorCm = Math.hypot(offLocal.x + gimbalBreak.x, offLocal.z + gimbalBreak.z) * 100;

    // ── 사다리꼴 풋프린트 (월드 좌표) ──
    let fwd, ox, oz;
    if (this.mode === 'basketball') {
      // 농구: 빔프는 선수 정면(-Z, getForward) 기준으로 몸 앞에 투사. 무릎 크라우치·
      // LEVER 증폭 무시하고 몸 지면 위치에 앵커 → 스텝백(뒤로 이동)해도 투사는 앞에.
      fwd = this.xbot.getForward();   // 정면(봇이 회전 안 하므로 -Z 고정)
      ox = body.x + fwd.x * 0.35 + gimbalBreak.x;   // 짐벌 붕괴 반영(정직)
      oz = body.z + fwd.z * 0.35 + gimbalBreak.z;
      this.shake.set(0, 0);
      this.errorCm = Math.hypot(gimbalBreak.x, gimbalBreak.z) * 100;
    } else {
      fwd = fwd0;
      ox = body.x + offLocal.x + gimbalBreak.x;
      oz = body.z + offLocal.z + gimbalBreak.z;
    }
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
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

  /** 실물 뷰 토글 — 빔·커버리지 시각화 on/off (하드웨어·투사 UI는 유지) */
  setVisualize(on) {
    this.visualize = !!on;
    const isKnee = this._sport === 'running' || this._sport === 'basketball';
    this.floorBeam.visible = isKnee && this.visualize;
    this.footFill.visible = isKnee && this.visualize;
    this.wallBeam.visible = this._sport === 'boxing' && this.visualize;
    this.wallFill.visible = this._sport === 'boxing' && this.visualize;
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
