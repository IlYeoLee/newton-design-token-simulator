// ─────────────────────────────────────────────────────────────
// 실전 러닝 플로어 UI — 스위처블 5안 (C1~C5 라이브 전용)
//
//   FXP.liveUI(1~5)로 즉시 전환. 모든 색 = Newton 히트 LUT(lutColor).
//   투사면 안(z -0.5..-2.3, 앵커 x = rig._fp.ox)만 사용 — 밖 그래픽 금지 원칙.
//   1 페이스 라인 · 2 비트 펄스 링 · 3 셰브론 플로우 · 4 스트라이드 도트 · 5 데이터 스트립
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeLaneFXMaterial } from './tokens.js';
import { lutColor, getLUT, FX_GLSL } from './fxlut.js';

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

export class LiveUI {
  constructor(scene, tokens, rig) {
    this.tokens = tokens;
    this.rig = rig;
    this.group = new THREE.Group();
    this.group.name = 'liveui';
    this.group.visible = false;
    scene.add(this.group);

    this._t = 0;          // 누적 시간 (레인 셰이더 uTime)
    this._beatAcc = 0;    // 비트 시계 (V2 펄스 · V4 도트 공유)
    this._tickZ = -1.4;   // V1 페이서 틱 로우패스 상태
    this._pulseT = 1;     // V2 펄스 경과 (1 = 휴면)
    this._dotSide = 0;    // V4 활성 도트 (0=좌 1=우)
    this._dotAge = 0;     // V4 활성 도트 경과
    this._stripAcc = 1;   // V5 10Hz 리드로 타이머 (첫 프레임 즉시 그림)

    // 가산 블렌드 평면 재료 — 야간 투사 룩 (주간은 v1에선 가산 유지, 허용 범위)
    const basic = (v, op) => new THREE.MeshBasicMaterial({
      color: new THREE.Color(lutColor(v)), transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    // 바닥 평면 공통: 눕히고 살짝 띄움 (z-파이팅 회피, y 0.012~0.016 층 분리)
    const flat = (mesh, y) => { mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; return mesh; };

    // ── V1 페이스 라인: 얇은 레인 + 페이서 틱(션) + 내 위치 노치 ──
    this.v1 = new THREE.Group();
    this.v1Lane = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.10, 1.8), makeLaneFXMaterial(1.8)), 0.012);
    this.v1Lane.material.uniforms.uLStyle.value = 0;   // solid
    this.v1Lane.position.z = -1.4;
    this.v1Tick = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.06), basic(0.95, 0.95)), 0.015);
    this.v1Notch = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.06), basic(0.7, 0.38)), 0.014);
    this.v1Notch.position.z = -1.0;   // 내 위치 = 고정 기준선 — 틱과의 간격이 앞섬/처짐
    this.v1.add(this.v1Lane, this.v1Tick, this.v1Notch);

    // ── V2 비트 펄스 링: 베이스 링(상시 은은) + 비트마다 확장·소멸 펄스 ──
    this.v2 = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.26, 0.315, 48);
    this.v2Base = flat(new THREE.Mesh(ringGeo, basic(0.55, 0.18)), 0.013);
    this.v2Pulse = flat(new THREE.Mesh(ringGeo.clone(), basic(0.55, 0)), 0.014);
    this.v2Base.position.z = this.v2Pulse.position.z = -1.2;
    this.v2.add(this.v2Base, this.v2Pulse);
    this._c2on = new THREE.Color(lutColor(0.55));    // 온페이스 온도
    this._c2off = new THREE.Color(lutColor(0.15));   // 오프페이스 = 딥 레드로 식힘

    // ── V3 셰브론 플로우: 션 속도로 흐르는 셰브론 레인 ──
    this.v3 = new THREE.Group();
    this.v3Lane = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.0), makeLaneFXMaterial(2.0)), 0.012);
    const U3 = this.v3Lane.material.uniforms;
    U3.uLStyle.value = 3;   // chevron
    U3.uW.value = 1; U3.uHalo.value = 0.9;
    this.v3Lane.position.z = -1.4;
    this.v3.add(this.v3Lane);

    // ── V4 스트라이드 도트: 비트마다 좌/우 교대 팝인 + 반대편 프리뷰 ──
    this.v4 = new THREE.Group();
    this.v4Dots = [0, 1].map(i => {
      const d = flat(new THREE.Mesh(new THREE.CircleGeometry(0.115, 32), basic(0.8, 0)), 0.013);
      d.position.x = i ? 0.12 : -0.12;
      this.v4.add(d);
      return d;
    });
    this._c4act = new THREE.Color(lutColor(0.8));    // 활성 도트
    this._c4pre = new THREE.Color(lutColor(0.4));    // 프리뷰 도트

    // ── V5 데이터 스트립: 캔버스 트랙 바 + 페이스 마커 + SPM 텍스트 ──
    this.v5 = new THREE.Group();
    this._cv = document.createElement('canvas');
    this._cv.width = 512; this._cv.height = 96;
    this._c2d = this._cv.getContext('2d');
    this._cvTex = new THREE.CanvasTexture(this._cv);
    this.v5Strip = flat(new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.24),
      new THREE.MeshBasicMaterial({
        map: this._cvTex, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })), 0.016);
    this.v5Strip.position.z = -0.85;
    this.v5.add(this.v5Strip);

    // inner = 인트로 연출용 로컬 오프셋 · group = 투사면 원점 추종 (실전에서 러너가 전진 → 월드 고정이면 즉시 투사면 밖)
    this.inner = new THREE.Group();
    this.inner.add(this.v1, this.v2, this.v3, this.v4, this.v5);
    this.group.add(this.inner);

    // ── C4 부스트 배경(테스트, 유저): hyperspeed풍 흐르는 그리드 + 그라디언트 글로우 —
    //    복싱 벽 배경 문법의 지면판. 투사면(uFP 페이드) 안에서만, 은은하게(저알파). ──
    this.boostBG = flat(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.4), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uLUT: { value: getLUT() }, uTime: { value: 0 },
        uFPOrigin: { value: new THREE.Vector3() }, uFPFwd: { value: new THREE.Vector3(0, 0, -1) }, uFPRight: { value: new THREE.Vector3(1, 0, 0) },
        uFPNear: { value: -1e6 }, uFPFar: { value: 1e6 }, uFPHalfN: { value: 1e6 }, uFPHalfF: { value: 1e6 }, uFPFadeM: { value: 0.3 },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vWorldPos;
        void main(){ vUv = uv; vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: FX_GLSL + `
        uniform float uTime;
        uniform vec3 uFPOrigin, uFPFwd, uFPRight;
        uniform float uFPNear, uFPFar, uFPHalfN, uFPHalfF, uFPFadeM;
        varying vec2 vUv; varying vec3 vWorldPos;
        float fpFade(vec3 wp){
          vec2 rel = wp.xz - uFPOrigin.xz;
          float d = rel.x*uFPFwd.x + rel.y*uFPFwd.z, h = rel.x*uFPRight.x + rel.y*uFPRight.z;
          float half_ = mix(uFPHalfN, uFPHalfF, clamp((d-uFPNear)/max(0.01,uFPFar-uFPNear),0.,1.));
          return smoothstep(uFPNear,uFPNear+uFPFadeM,d)*smoothstep(uFPFar,uFPFar-uFPFadeM,d)*smoothstep(half_,half_-uFPFadeM,abs(h));
        }
        void main(){
          float t = uTime;
          // 흘러오는 가로줄(질주) + 고정 세로줄 — 원근 그리드
          float lz = smoothstep(0.90, 1.0, fract(vUv.y*9.0 + t*2.6));
          float lx = smoothstep(0.955, 1.0, 1.0 - abs(fract(vUv.x*7.0)-0.5)*2.0);
          float grid = max(lz*0.75, lx*0.4);
          // 중앙 그라디언트 글로우(복싱 배경 문법)
          float rad = clamp(1.0 - length((vUv-vec2(0.5,0.55))*vec2(1.7,1.25)), 0.0, 1.0);
          vec3 col = lut(0.22 + 0.5*rad);
          float a = (0.085*rad + grid*0.16) * fpFade(vWorldPos);
          gl_FragColor = vec4(col * a * 1.5, 1.0);   // 가산광 — 은은
        }`,
    })), 0.010);
    this.boostBG.position.z = -1.3;
    this.boostBG.visible = false;
    this.inner.add(this.boostBG);
  }

  /** 레인 재료에 투사면 소프트 페이드 주입 — tokens.js 레인과 동일 규약 */
  _feedFP(U) {
    const fp = this.rig?._fp;
    if (!fp || !U.uFPNear) return;
    U.uFPOrigin.value.set(fp.ox, 0, fp.oz);
    U.uFPFwd.value.set(fp.fx, 0, fp.fz);
    U.uFPRight.value.set(fp.rx, 0, fp.rz);
    U.uFPNear.value = this.rig.fpNear;
    U.uFPFar.value = this.rig.fpFar;
    U.uFPHalfN.value = this.rig._halfAt(this.rig.fpNear);
    U.uFPHalfF.value = this.rig._halfAt(this.rig.fpFar);
  }

  update(dt, ctx) {
    if (!ctx.active) {
      if (this.group.visible) this.group.visible = false;   // 비활성 = 그룹 통째로 숨김 (싸게)
      this._wasActive = false;
      return;
    }
    this.group.visible = true;
    const v = ctx.variant || 1;
    this.v1.visible = v === 1; this.v2.visible = v === 2; this.v3.visible = v === 3;
    this.v4.visible = v === 4; this.v5.visible = v === 5;
    // ── 투사면 원점 추종 (로우패스 τ0.25 — 발걸음 흔들림은 거르고 전진만 따라감) ──
    const fp = this.rig?._fp;
    if (fp) {
      if (!this._wasActive) { this._ax = fp.ox; this._az = fp.oz; this._pz = fp.oz; this._vz = 0; }   // 재진입 = 스냅
      const k = 1 - Math.exp(-dt / 0.25);
      this._ax += (fp.ox - this._ax) * k;
      this._az += (fp.oz - this._az) * k;
      if (dt > 0) this._vz += ((fp.oz - this._pz) / dt - this._vz) * k;   // 전진 속도 추정
      this._pz = fp.oz;
      this.group.position.set(this._ax, 0, this._az + this._vz * 0.25);   // 로우패스 지연(v·τ) 보상 — 흔들림은 걸러지고 전진 lag만 상쇄
    }
    // ── 등장 '휙' 인트로(유저): 복싱 궤적 토큰처럼 멀리서 곡선 궤적으로 날아와 오버슈트로 꽂힘 ──
    if (!this._wasActive || v !== this._lastV) { this._introT = 0; this._landed = false; }
    this._wasActive = true; this._lastV = v;
    this._introT = (this._introT ?? 1) + dt;
    const ki = Math.min(1, this._introT / 0.55);
    const c1 = 1.70158, c3 = c1 + 1;
    const eb = 1 + c3 * Math.pow(ki - 1, 3) + c1 * Math.pow(ki - 1, 2);   // easeOutBack = 꽂히는 반동
    this.inner.position.x = Math.sin(ki * Math.PI) * 0.28 * (1 - ki);   // 곡선 스윕(궤적)
    this.inner.position.z = (1 - eb) * -1.5;                            // 먼 곳에서 날아옴
    this.inner.scale.setScalar(0.72 + 0.28 * eb);
    if (!this._landed && ki >= 1) {
      this._landed = true;
      this.inner.position.z = 0; this.inner.scale.setScalar(1);
      this.onLand?.(new THREE.Vector3(this._ax ?? 0, 0.015, (this._az ?? 0) - 1.3));   // 착지 순간 = 지면 버스트(꽂힘 타격감)
    }

    this._t += dt;
    // C4 부스트 배경 — 마지막 1km에서만 은은히 (uFP 페이드로 투사면 안)
    this.boostBG.visible = !!ctx.boost;
    if (ctx.boost) {
      const BU = this.boostBG.material.uniforms;
      BU.uTime.value = this._t;
      const fp = this.rig?._fp;
      if (fp) {
        BU.uFPOrigin.value.set(fp.ox, 0, fp.oz); BU.uFPFwd.value.set(fp.fx, 0, fp.fz); BU.uFPRight.value.set(fp.rx, 0, fp.rz);
        BU.uFPNear.value = this.rig.fpNear; BU.uFPFar.value = this.rig.fpFar;
        BU.uFPHalfN.value = this.rig._halfAt(this.rig.fpNear); BU.uFPHalfF.value = this.rig._halfAt(this.rig.fpFar);
      }
    }
    const beatT = Math.max(0.2, ctx.beatT || 0.39);
    this._beatAcc += dt;
    const beat = this._beatAcc >= beatT;   // 이번 프레임에 비트 발화?
    if (beat) this._beatAcc %= beatT;

    if (v === 1) {
      // 페이서 틱: 션 z를 로우패스(τ 0.15) 추종, 투사 범위로 클램프
      const target = THREE.MathUtils.clamp(ctx.seanZ, -2.2, -0.6);
      this._tickZ += (target - this._tickZ) * (1 - Math.exp(-dt / 0.15));
      this.v1Tick.position.z = this._tickZ;
      const U = this.v1Lane.material.uniforms;
      U.uTime.value = this._t;
      U.uDay.value = ctx.day ? 1 : 0;
      this._feedFP(U);
    } else if (v === 2) {
      // 비트 펄스: scale 1→1.35 · opacity 0.9→0 (0.45s easeOutCubic)
      if (beat) this._pulseT = 0;
      this._pulseT = Math.min(1, this._pulseT + dt / 0.45);
      const e = easeOutCubic(this._pulseT);
      this.v2Pulse.scale.setScalar(1 + 0.35 * e);
      this.v2Pulse.material.opacity = 0.9 * (1 - e);
      // 오프페이스(|션-기준|>0.35m)일수록 딥 레드로
      const k = THREE.MathUtils.clamp((Math.abs(ctx.seanZ + 1.0) - 0.35) / 0.6, 0, 1);
      this.v2Base.material.color.lerpColors(this._c2on, this._c2off, k);
      this.v2Pulse.material.color.copy(this.v2Base.material.color);
    } else if (v === 3) {
      // 셰브론 흐름 = '상대속도'(리서치 확정: Beryl·Audi 문법 + optic flow 안전) —
      //   션이 앞서면 셰브론이 앞으로 흘러 끌어당기고, 페이스 일치 = 흐름 정지 + 윤곽 또렷('락온').
      //   절대속도 흐름은 optic flow 과잉으로 어지러움 유발(리서치) — 기각.
      const err = ctx.seanZ + 1.0;                       // 기준 -1.0m 대비 션 위치(음수=앞섬)
      this._v3Err = (this._v3Err ?? 0) + (err - (this._v3Err ?? 0)) * (1 - Math.exp(-dt / 0.8));   // 3~5s 이동평균 급 스무딩
      const rel = THREE.MathUtils.clamp(-this._v3Err * 2.2, -1.6, 1.6);   // 앞섬 → 전방 흐름
      const lock = Math.abs(this._v3Err) < 0.15;         // 페이스 일치 존
      const U = this.v3Lane.material.uniforms;
      U.uTime.value = this._t;
      U.uLSpeed.value = lock ? 0 : rel;
      U.uGain.value = lock ? 1.35 : 1.0;                 // 락온 = 윤곽 또렷(멈춤이 보상)
      U.uHalo.value = lock ? 0.55 : 0.9;                 // 락온 = 번짐 줄여 샤프하게
      U.uDay.value = ctx.day ? 1 : 0;
      this._feedFP(U);
    } else if (v === 4) {
      // 비트마다 교대: 활성 도트 팝인(z -0.95) → beatT 동안 페이드, 반대편은 프리뷰(z -1.25)
      if (beat) { this._dotSide ^= 1; this._dotAge = 0; }
      this._dotAge += dt;
      const act = this.v4Dots[this._dotSide], pre = this.v4Dots[1 - this._dotSide];
      const pop = easeOutCubic(Math.min(1, this._dotAge / 0.12));
      act.position.z = -0.95;
      act.scale.setScalar(0.5 + 0.5 * pop);
      act.material.opacity = Math.max(0, 1 - this._dotAge / beatT);
      act.material.color.copy(this._c4act);
      pre.position.z = -1.25;
      pre.scale.setScalar(1);
      pre.material.opacity = 0.35;
      pre.material.color.copy(this._c4pre);
    } else if (v === 5) {
      // 10Hz 리드로 — 매 프레임 캔버스 갱신은 낭비
      this._stripAcc += dt;
      if (this._stripAcc >= 0.1) { this._stripAcc = 0; this._drawStrip(ctx); }
    }
  }

  /** V5 스트립 드로잉: 트랙 바 + 센터 노치 + 페이스 마커 + SPM */
  _drawStrip(ctx) {
    const g = this._c2d, W = 512, H = 96, cy = 62;
    g.clearRect(0, 0, W, H);
    g.shadowColor = lutColor(0.6); g.shadowBlur = 8;   // 은은한 글로우
    // 트랙 바 (전폭 라운드 렉트, 높이 22px)
    g.strokeStyle = lutColor(0.45); g.globalAlpha = 0.5; g.lineWidth = 2;
    g.beginPath();
    g.roundRect(4, cy - 11, W - 8, 22, 11);
    g.stroke();
    g.globalAlpha = 1;
    // 센터 노치 (온페이스 기준점)
    g.fillStyle = '#fff';
    g.fillRect(W / 2 - 1.5, cy - 15, 3, 30);
    // 페이스 마커: 션 z 오프셋(기준 -1.0, ±0.5m) → 좌우 위치. 앞섬 = 오른쪽
    const off = THREE.MathUtils.clamp(-(ctx.seanZ + 1.0) / 0.5, -1, 1);
    g.fillStyle = lutColor(0.85);
    g.beginPath();
    g.arc(W / 2 + off * (W / 2 - 40), cy, 9, 0, Math.PI * 2);
    g.fill();
    // 내 케이던스 (우상단)
    g.fillStyle = lutColor(0.9);
    g.font = '700 34px Supreme, sans-serif';
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillText(`${ctx.spmMine || '--'} SPM`, W - 10, 36);
    g.shadowBlur = 0;
    this._cvTex.needsUpdate = true;
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.group.traverse(o => {
      o.geometry?.dispose?.();
      if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); }
    });
  }
}
