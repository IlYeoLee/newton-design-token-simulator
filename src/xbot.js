import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BK_SCALE } from './tokens.js';   // 농구 경로 스케일 — 토큰과 공유(봇·마크 좌표 일치)
import { buildDrillClips } from './drills.js';   // 절차적 준비운동 드릴(A단계)

import xbotUrl from '../assets/xbot.fbx?url';
import runUrl from '../assets/anim-standard-run.fbx?url';
import hookUrl from '../assets/anim-hook.fbx?url';
import dribbleUrl from '../assets/anim-basketball-dribble.fbx?url';
import sidestepUrl from '../assets/anim-basketball-sidestep.fbx?url';
import warmupUrl from '../assets/warming_up.fbx?url';   // Mixamo 'Warming Up' — 스트레칭 검증용
// Bandai Namco Research MotionDataset (CC BY-NC) — BVH 실측 리타겟 클립
import bkRunClipJson from '../assets/mocap/xclip-run_normal.json';
import bkDashClipJson from '../assets/mocap/xclip-dash_normal.json';
import bkKickClipJson from '../assets/mocap/xclip-kick_normal.json';

// X Bot = 투사된 토큰 UI를 "따라하는 사람" 역할.
// 모든 안무는 팩 시간(packTime)의 순수 함수 → 루프/시크/속도 변경에 안전.

const RUN_PHASE_R = 0.47;   // 런 클립 오른발 착지 위상 — 판정 계측 2차 캘리브레이션 (잔차 +90ms 반영)
const HOOK_IMPACT = 0.34;   // 훅 클립에서 임팩트 지점 위상 (시각 튜닝값)

export class XBot {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();   // 팩별 루트 이동용
    scene.add(this.group);
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.mode = null;
    this.schedule = null;
    this.feet = [];
  }

  async load() {
    const loader = new FBXLoader();
    const [xbot, runFbx, hookFbx, dribbleFbx, sidestepFbx, warmupFbx] = await Promise.all([
      loader.loadAsync(xbotUrl),
      loader.loadAsync(runUrl),
      loader.loadAsync(hookUrl),
      loader.loadAsync(dribbleUrl),
      loader.loadAsync(sidestepUrl),
      loader.loadAsync(warmupUrl),
    ]);

    xbot.scale.setScalar(0.01);
    xbot.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        if (o.material) {
          o.material = new THREE.MeshStandardMaterial({
            color: 0x9aa4b5, roughness: 0.55, metalness: 0.25,
          });
        }
      }
      if (o.isBone && /ToeBase$|Foot$/.test(o.name)) this.feet.push(o);
    });
    this.model = xbot;
    this.group.add(xbot);

    this.mixer = new THREE.AnimationMixer(xbot);
    const reg = (name, fbx) => {
      const clip = fbx.animations[0];
      if (!clip) return;
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions[name] = { action, dur: clip.duration };
    };
    reg('run', runFbx);
    reg('hook', hookFbx);
    reg('dribble', dribbleFbx);
    reg('sidestep', sidestepFbx);
    reg('warmup', warmupFbx);

    // 실측 모캡 클립 (Bandai BVH → 오프라인 리타겟)
    const regJson = (name, json) => {
      const clip = THREE.AnimationClip.parse(json);
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions[name] = { action, dur: clip.duration };
    };
    regJson('bkRun', bkRunClipJson);
    regJson('bkDash', bkDashClipJson);
    regJson('bkKick', bkKickClipJson);

    this._hips = xbot.getObjectByName('mixamorigHips');
    this._kneeR = xbot.getObjectByName('mixamorigRightLeg');
    this._head = xbot.getObjectByName('mixamorigHead');
    this._footL = xbot.getObjectByName('mixamorigLeftToeBase') || xbot.getObjectByName('mixamorigLeftFoot');
    this._footR = xbot.getObjectByName('mixamorigRightToeBase') || xbot.getObjectByName('mixamorigRightFoot');
    this._wristR = xbot.getObjectByName('mixamorigRightHand');
    this._shoulderR = xbot.getObjectByName('mixamorigRightArm');
    this._elbowR = xbot.getObjectByName('mixamorigRightForeArm');

    // 손가락+손목 본 — 모캡 리타겟 시 벌어지는(splay)·꺾이는 아티팩트 방지:
    // 로드 직후 바인드(기본) 포즈 쿼터니언을 캡처해 매 프레임 그 중립으로 고정.
    this._fingerBones = [];
    xbot.traverse(o => {
      if (o.isBone && /Hand(Thumb|Index|Middle|Ring|Pinky)\d|Hand$/.test(o.name)) {
        o.userData.rest = o.quaternion.clone();   // 바인드 포즈
        this._fingerBones.push(o);
      }
    });

    this._buildDrills();   // 절차적 준비운동 드릴 등록 (봇이 실제 그 동작 수행)
  }

  /** 준비운동(A단계) 드릴 클립을 스켈레톤에 저작·등록. warmup 프레임0=중립 서있는 포즈 */
  _buildDrills() {
    const wa = this.actions.warmup; if (!wa) return;
    for (const k in this.actions) { const a = this.actions[k].action; a.stop(); a.setEffectiveWeight(k === 'warmup' ? 1 : 0); a.play(); a.paused = true; }
    wa.action.time = 0; this.mixer.update(0);
    const want = [
      'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead',
      'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot',
      'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigRightArm', 'mixamorigRightForeArm',
    ];
    const neutral = {};
    for (const n of want) { const b = this.model.getObjectByName(n); if (b) neutral[n] = b.quaternion.clone(); }
    const clips = buildDrillClips(neutral);
    for (const id in clips) {
      const action = this.mixer.clipAction(clips[id]);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions[id] = { action, dur: clips[id].duration };
    }
    for (const k in this.actions) { this.actions[k].action.stop(); this.actions[k].action.setEffectiveWeight(1); }
  }

  /** 손가락·손목을 바인드 중립으로 고정 — 클립의 벌어진 손 아티팩트 덮어씀 */
  _lockFingers() {
    for (const b of this._fingerBones) b.quaternion.copy(b.userData.rest);
  }

  /** 판정용 실측 지점 (왼발/오른발/리드 주먹/몸 중심) */
  getProbes() {
    const w = o => o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
    return { footL: w(this._footL), footR: w(this._footR), wrist: w(this._wristR), hips: w(this._hips) };
  }

  /** 그림자 검증용 오른팔 세그먼트 (어깨·팔꿈치·손목 월드 좌표) */
  getRightArm() {
    const w = o => o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
    return { shoulder: w(this._shoulderR), elbow: w(this._elbowR), wrist: w(this._wristR) };
  }

  /** 눈 위치 (머리 본 + 오프셋) — 1인칭 시점/시야 콘 기준. 헤드밥은 본 추적으로 자동 반영 */
  getEyeWorld() {
    if (!this._head) return null;
    return new THREE.Vector3().setFromMatrixPosition(this._head.matrixWorld)
      .add(new THREE.Vector3(0, 0.11, 0));
  }

  /** 오른 무릎 본 월드 위치 (무릎 장착 프로젝터 모듈 기준점) */
  getKneeWorld() {
    if (!this._kneeR) return null;
    return new THREE.Vector3().setFromMatrixPosition(this._kneeR.matrixWorld);
  }

  /** 오른 정강이 방향(무릎→발목, 정규화) — 프로젝터 사출 축. 아래로 향할수록 y<0 */
  getRightShinDir() {
    if (!this._kneeR || !this._footR) return null;
    const knee = new THREE.Vector3().setFromMatrixPosition(this._kneeR.matrixWorld);
    const ankle = new THREE.Vector3().setFromMatrixPosition(this._footR.matrixWorld);
    return ankle.sub(knee).normalize();
  }

  /** X Bot 몸체(그룹) 월드 위치 — 무릎 편차 계산의 기준 */
  getBodyPos() {
    return this.group.position.clone();
  }

  /** 몸 전방 벡터 (월드, 수평) — 클립 본 회전과 무관한 팩 기준 방향 */
  getForward() {
    if (this.mode === 'basketball') {
      // model.rotY(PI) 포함: 전방 = -sin/-cos(groupYaw) — 실제 컷 방향 따라감
      const yaw = this.group.rotation.y;
      return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    }
    return new THREE.Vector3(0, 0, -1);  // 러닝/복싱: 전진·벽 방향
  }

  /** 팩 전환: 이벤트 스케줄에서 안무 데이터 구축 */
  setPack(packData, tokenEvents) {
    this._lastPack = [packData, tokenEvents];
    this.verifyClip = null;
    // 모든 액션 정지 + 가중치 복원 (stop()은 weight를 리셋하지 않음 — 검증 모드 잔재 방지)
    for (const k in this.actions) { const x = this.actions[k]; x.action.stop(); x.action.setEffectiveWeight(1); }
    this.mode = packData.sport;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);

    if (this.mode === 'running') {
      const rights = tokenEvents.filter(e => e.foot === 'right').map(e => e.t);
      const stride = rights.length >= 2
        ? (rights[rights.length - 1] - rights[0]) / (rights.length - 1)
        : 0.76;
      this.schedule = { t0: rights[0] ?? 0, stride, V: 2.5 };  // 실측 2.5m/s 전진
      const a = this.actions.run;
      a.action.play(); a.action.paused = true;
      this.model.rotation.y = Math.PI;   // -Z(전진 방향) 바라보기
    }

    if (this.mode === 'boxing') {
      const punches = tokenEvents.filter(e => e.surface === 'wall').map(e => e.t).sort((x, y) => x - y);
      const a = this.actions.hook;
      // 클립의 유효 구간만 사용 (도입/마무리 잘라내 과속 재생 방지)
      const seg0 = a.dur * 0.12, seg1 = a.dur * 0.78;
      let minGap = Infinity;
      for (let i = 1; i < punches.length; i++) minGap = Math.min(minGap, punches[i] - punches[i - 1]);
      const ts = Math.max(1, (seg1 - seg0) / Math.max(0.5, (isFinite(minGap) ? minGap : 1) * 0.92));
      this.schedule = { punches, ts, seg0, effDur: (seg1 - seg0) / ts };
      this._bxT = 0;
      a.action.play(); a.action.paused = true;
      this.model.rotation.y = Math.PI;
    }

    if (this.mode === 'basketball') {
      // 스텝 마크 경로: (t, x, z) 시퀀스
      const pts = tokenEvents
        .filter(e => e.surface === 'floor' && e.marker)
        .map(e => ({ t: e.t, x: e.srcToken.nx * BK_SCALE, z: e.srcToken.ny * BK_SCALE }))
        .sort((a, b) => a.t - b.t);
      // 플랜트 이벤트: 경로 방향 전환각 > 35°인 마크 = 컷 순간 (사이드 런지 원샷)
      const plants = [];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const v1 = Math.atan2(b.x - a.x, b.z - a.z);
        const v2 = Math.atan2(c.x - b.x, c.z - b.z);
        let dA = Math.abs(v2 - v1);
        if (dA > Math.PI) dA = Math.PI * 2 - dA;
        if (dA > THREE.MathUtils.degToRad(35)) plants.push(pts[i].t);
      }
      // 플랜트+가속 원샷: 실측 dash (정지→폭발 출발 = 컷인 본질)
      const ss = this.actions.bkDash || this.actions.sidestep;
      const SS_EFF = ss ? ss.dur : 0.55;
      const ssTs = 1;
      this.schedule = { path: pts, plants, ssTs, ssEff: SS_EFF, ssImpact: 0.35 };

      // 발-지면 동기: 이동 거리로 런 위상을 굴림 (풋 스케이팅 제거)
      this._bkPhase = 0;
      this._bkPrev = null;
      this._bkYaw = 0;    // model PI 기준: 초기 진행(-Z) = group yaw 0
      this._bkRunW = 0;
      this._bkPlantW = 0;
      const run = this.actions.bkRun || this.actions.run;
      const drb = this.actions.dribble;
      run.action.play(); run.action.paused = true; run.action.setEffectiveWeight(0);
      drb.action.play(); drb.action.paused = true; drb.action.setEffectiveWeight(1);
      if (ss) { ss.action.play(); ss.action.paused = true; ss.action.setEffectiveWeight(0); }
      this.model.rotation.y = Math.PI;
    }
  }

  setVerify(name) {
    this.verifyClip = name || null;
    this._vT = 0;
    if (!name && this._lastPack) this.setPack(this._lastPack[0], this._lastPack[1]);
  }

  /** 세션 비실전 단계 시연 — 지정 클립을 제자리 재생(코치가 동작을 보여줌) */
  playDemo(name, dt) {
    const key = this.actions[name] ? name : (this.actions.warmup ? 'warmup' : null);
    if (!key) return;
    for (const k in this.actions) { const x = this.actions[k]; x.action.play(); x.action.paused = true; x.action.setEffectiveWeight(k === key ? 1 : 0); }
    const a = this.actions[key];
    this._demoT = (this._demoT || 0) + dt;
    a.action.time = this._demoT % a.dur;
    this.group.position.set(0, 0, 0);
    this.mixer.update(0);
    this._lockInPlace?.();
  }

  update(packTime, dt = 0.016) {
    if (!this.model || !this.mode) return;
    this._dt = dt;

    // 모션 검증: 실측 모캡을 제자리 재생 — 무릎 투사가 버티는지 rig가 측정
    if (this.verifyClip && this.actions[this.verifyClip]) {
      for (const k in this.actions) {
        const x = this.actions[k];
        x.action.play(); x.action.paused = true;
        x.action.setEffectiveWeight(k === this.verifyClip ? 1 : 0);
      }
      const a = this.actions[this.verifyClip];
      this._vT = (this._vT || 0) + dt;
      a.action.time = this._vT % a.dur;
      this.mixer.update(0);
      this.group.position.set(0, 0, 0);
      this._lockInPlace?.();
      return;
    }

    if (this.mode === 'running') {
      const { t0, stride, V } = this.schedule;
      const a = this.actions.run;
      const phase = (((packTime - t0) / stride) % 1 + 1) % 1;
      a.action.time = ((phase + RUN_PHASE_R) % 1) * a.dur;
      this.mixer.update(0);
      // 실제 전진: 지면 고정 마크를 향해 이동
      this.group.position.z = -V * packTime;
      this._lockInPlace();
    }

    if (this.mode === 'boxing') {
      const { punches, ts, seg0, effDur } = this.schedule;
      const a = this.actions.hook;
      let target = 0;  // 기본: 가드 포즈
      for (const tp of punches) {
        const start = tp - HOOK_IMPACT * effDur;
        if (packTime >= start && packTime < start + effDur) {
          target = seg0 + (packTime - start) * ts;
          break;
        }
      }
      // 펀치 진행은 즉시(타이밍 유지), 가드 복귀는 부드럽게 (스냅 방지)
      if (target >= this._bxT) this._bxT = target;
      else this._bxT += (target - this._bxT) * Math.min(1, dt * 7);
      a.action.time = Math.min(this._bxT, a.dur - 0.001);
      this.mixer.update(0);
      this._lockInPlace();
    }

    if (this.mode === 'basketball') {
      const { path } = this.schedule;
      const run = this.actions.bkRun || this.actions.run;
      const drb = this.actions.dribble;

      if (path.length >= 2) {
        const p = this._samplePath(packTime);
        // 이동량 → 런 위상 (발이 구른 만큼만 전진 = 스케이팅 제거)
        let speed = 0;
        if (this._bkPrev) {
          const md = Math.hypot(p.x - this._bkPrev.x, p.z - this._bkPrev.z);
          const STRIDE = 1.9;                      // Bandai run 1사이클 이동 거리 (m)
          this._bkPhase = (this._bkPhase + md / STRIDE) % 1;
          speed = dt > 0.0001 ? md / dt : 0;
        }
        this._bkPrev = { x: p.x, z: p.z };
        this.group.position.set(p.x, 0, p.z);

        // 플랜트 윈도: 실측 dash 원샷 (임팩트 = 플랜트 이벤트 정렬)
        const { plants, ssTs, ssEff, ssImpact } = this.schedule;
        const ss = this.actions.bkDash || this.actions.sidestep;
        let inPlant = false, plantAnimT = 0;
        for (const tp of plants) {
          const s = tp - ssImpact * ssEff;
          if (packTime >= s && packTime < s + ssEff) {
            inPlant = true;
            plantAnimT = (packTime - s) * ssTs;
            break;
          }
        }

        // 3-way 크로스페이드: 플랜트 > 런(이동) > 드리블(정지)
        const plantTarget = inPlant ? 1 : 0;
        this._bkPlantW += (plantTarget - this._bkPlantW) * Math.min(1, dt * 10);
        const speedW = Math.min(1, Math.max(0, (speed - 0.35) / 0.8));
        this._bkRunW += (speedW - this._bkRunW) * Math.min(1, dt * 8);
        const pw = this._bkPlantW;
        const rw = this._bkRunW * (1 - pw);
        run.action.setEffectiveWeight(rw);
        drb.action.setEffectiveWeight(Math.max(0, 1 - pw - rw));
        if (ss) {
          ss.action.setEffectiveWeight(pw);
          if (inPlant) ss.action.time = Math.min(plantAnimT, ss.dur - 0.001);
        }
        run.action.time = this._bkPhase * run.dur;
        drb.action.time = packTime % drb.dur;

        // 농구 선수는 스텝백·컷 중에도 정면(수비/골대)을 향한다 — 이동만 하고 회전 안 함.
        // (이동 방향으로 회전시키면 스텝백 때 뒤를 보게 되고 빔프가 뒤로 쏨)
        this.group.rotation.y = 0;   // model.rotY(PI)로 -Z 정면 유지
      }
      this.mixer.update(0);
      this._lockInPlace();
    }

    this._clampFeet();
  }

  _samplePath(t) {
    const path = this.schedule.path;
    if (t <= path[0].t) return { ...path[0], dirX: 0, dirZ: 0 };
    if (t >= path[path.length - 1].t) return { ...path[path.length - 1], dirX: 0, dirZ: 0 };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / Math.max(b.t - a.t, 0.001);
        const e = k * k * (3 - 2 * k); // smoothstep — 스텝 간 가감속
        return {
          x: a.x + (b.x - a.x) * e,
          z: a.z + (b.z - a.z) * e,
          dirX: b.x - a.x,
          dirZ: b.z - a.z,
        };
      }
    }
    return { ...path[0], dirX: 0, dirZ: 0 };
  }

  /** 루트 모션 제거: 골반 XZ를 그룹 원점에 고정 */
  _lockInPlace() {
    this._lockFingers();
    if (!this._hips) return;
    this.model.position.x = 0;
    this.model.position.z = 0;
    this.model.updateMatrixWorld(true);
    const hw = new THREE.Vector3().setFromMatrixPosition(this._hips.matrixWorld);
    const gw = new THREE.Vector3();
    this.group.getWorldPosition(gw);
    this.model.position.x = -(hw.x - gw.x);
    this.model.position.z = -(hw.z - gw.z);
  }

  /** 발이 바닥 아래로 파고들거나 공중부양하지 않도록 Y 보정 (스무딩 — 프레임 팝 방지) */
  _clampFeet() {
    if (!this.feet.length) return;
    this.model.position.y = 0;
    this.model.updateMatrixWorld(true);
    let minY = Infinity;
    const v = new THREE.Vector3();
    for (const f of this.feet) {
      v.setFromMatrixPosition(f.matrixWorld);
      minY = Math.min(minY, v.y);
    }
    if (!isFinite(minY)) return;
    const targetY = Math.abs(minY) > 0.005 ? -minY + 0.02 : 0;
    if (this._yOff === undefined) this._yOff = targetY;
    this._yOff += (targetY - this._yOff) * Math.min(1, (this._dt ?? 0.016) * 12);
    this.model.position.y = this._yOff;
  }
}
