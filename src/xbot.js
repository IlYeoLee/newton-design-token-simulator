import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import xbotUrl from '../assets/xbot.fbx?url';
import runUrl from '../assets/anim-standard-run.fbx?url';
import hookUrl from '../assets/anim-hook.fbx?url';
import dribbleUrl from '../assets/anim-basketball-dribble.fbx?url';

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
    const [xbot, runFbx, hookFbx, dribbleFbx] = await Promise.all([
      loader.loadAsync(xbotUrl),
      loader.loadAsync(runUrl),
      loader.loadAsync(hookUrl),
      loader.loadAsync(dribbleUrl),
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

    this._hips = xbot.getObjectByName('mixamorigHips');
    this._kneeR = xbot.getObjectByName('mixamorigRightLeg');
    this._head = xbot.getObjectByName('mixamorigHead');
    this._footL = xbot.getObjectByName('mixamorigLeftToeBase') || xbot.getObjectByName('mixamorigLeftFoot');
    this._footR = xbot.getObjectByName('mixamorigRightToeBase') || xbot.getObjectByName('mixamorigRightFoot');
    this._wristR = xbot.getObjectByName('mixamorigRightHand');
  }

  /** 판정용 실측 지점 (왼발/오른발/리드 주먹/몸 중심) */
  getProbes() {
    const w = o => o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
    return { footL: w(this._footL), footR: w(this._footR), wrist: w(this._wristR), hips: w(this._hips) };
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

  /** X Bot 몸체(그룹) 월드 위치 — 무릎 편차 계산의 기준 */
  getBodyPos() {
    return this.group.position.clone();
  }

  /** 몸 전방 벡터 (월드, 수평) — 클립 본 회전과 무관한 팩 기준 방향 */
  getForward() {
    if (this.mode === 'basketball') {
      const yaw = this.group.rotation.y;
      return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }
    return new THREE.Vector3(0, 0, -1);  // 러닝/복싱: 전진·벽 방향
  }

  /** 팩 전환: 이벤트 스케줄에서 안무 데이터 구축 */
  setPack(packData, tokenEvents) {
    // 모든 액션 정지
    for (const k in this.actions) this.actions[k].action.stop();
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
        .map(e => ({ t: e.t, x: e.srcToken.nx * 4.0, z: e.srcToken.ny * 4.0 }))
        .sort((a, b) => a.t - b.t);
      this.schedule = { path: pts };
      const a = this.actions.dribble;
      a.action.play(); a.action.paused = true;
    }
  }

  update(packTime, dt = 0.016) {
    if (!this.model || !this.mode) return;
    this._dt = dt;

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
      const a = this.actions.dribble;
      a.action.time = (packTime * 1.0) % a.dur;
      this.mixer.update(0);

      if (path.length >= 2) {
        const p = this._samplePath(packTime);
        this.group.position.set(p.x, 0, p.z);
        if (p.dirX !== 0 || p.dirZ !== 0) {
          // 모델 원시 전방 = +Z → 진행 방향으로 회전
          this.group.rotation.y = Math.atan2(p.dirX, p.dirZ);
        }
      }
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
