// ─────────────────────────────────────────────────────────────
// 실전 러닝 플로어 UI — 스위처블 5안 (C1~C5 라이브 전용)
//
//   FXP.liveUI(1~5)로 즉시 전환. 모든 색 = Newton 히트 LUT(lutColor).
//   투사면 안(z -0.5..-2.3, 앵커 x = rig._fp.ox)만 사용 — 밖 그래픽 금지 원칙.
//   1 페이스 라인 · 2 비트 펄스 링 · 3 셰브론 플로우 · 4 스트라이드 도트 · 5 데이터 스트립
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PAL, NEU, rgba } from './palette.js';
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

    // 소프트 글로우 재료 — 화이트-핫 코어 + LUT 컬러 바디 + 헤일로 (룩시스템 마크 문법).
    // 민짜 단색 평면(저퀄)의 근본 교체. uShape: 0=도트 1=링 2=캡슐. 가산 블렌드.
    const soft = (shape, v, op, asp = 1) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(lutColor(v)) }, uOp: { value: op },
        uShape: { value: shape }, uAsp: { value: asp },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOp, uShape, uAsp;
        varying vec2 vUv;
        void main(){
          vec2 p = (vUv - 0.5) * 2.0;
          float core, halo, hot;
          if (uShape < 0.5) {              // 도트: 핫코어 + 바디 + 넓은 헤일로
            float d = length(p);
            hot  = exp(-pow(d*5.5, 2.0));
            core = exp(-pow(d*2.4, 2.0));
            halo = exp(-pow(d*1.25, 2.0)) * 0.38;
          } else if (uShape < 1.5) {       // 링: 가우시안 밴드 + 안팎 번짐
            float d = abs(length(p) - 0.62);
            hot  = exp(-pow(d*16.0, 2.0)) * 0.6;
            core = exp(-pow(d*8.0, 2.0));
            halo = exp(-pow(d*3.2, 2.0)) * 0.35;
          } else {                         // 캡슐: 라이트 튜브 (얇은 발광심 + 글로우)
            p.x *= uAsp;
            vec2 q = vec2(max(abs(p.x) - (uAsp - 1.0), 0.0), p.y);
            float d = length(q);
            hot  = exp(-pow(d*3.4, 2.0)) * 0.7;
            core = exp(-pow(d*1.9, 2.0));
            halo = exp(-pow(d*0.95, 2.0)) * 0.35;
          }
          // 평면 경계 윈도우 — 헤일로 잔광이 지오메트리 모서리에 사각으로 잘리는 것 방지
          vec2 b = abs(vUv - 0.5) * 2.0;
          float win = smoothstep(1.0, 0.72, max(b.x, b.y));
          // 핫스팟 하이라이트 = 무채 잉크(규칙 ②) — 구 웜화이트 vec3(1.0,0.96,0.88) 은 팔레트 밖이었다
          vec3 col = (uColor * (core + halo) + vec3(1.0) * hot * 0.6) * win;
          gl_FragColor = vec4(col * uOp, 1.0);
        }`,
    });
    // 바닥 평면 공통: 눕히고 살짝 띄움 (z-파이팅 회피, y 0.012~0.016 층 분리)
    const flat = (mesh, y) => { mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; return mesh; };

    // ── V1 페이스 라인: 얇은 레인 + 페이서 틱(션) + 내 위치 노치 ──
    this.v1 = new THREE.Group();
    this.v1Lane = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.10, 1.8), makeLaneFXMaterial(1.8)), 0.012);
    this.v1Lane.material.uniforms.uLStyle.value = 0;   // solid
    this.v1Lane.position.z = -1.4;
    this.v1Tick = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), soft(2, 0.95, 0.95, 3.3)), 0.015);
    this.v1Notch = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), soft(2, 0.7, 0.38, 3.3)), 0.014);
    this.v1Notch.position.z = -1.0;   // 내 위치 = 고정 기준선 — 틱과의 간격이 앞섬/처짐
    this.v1.add(this.v1Lane, this.v1Tick, this.v1Notch);

    // ── V2 비트 펄스 링: 베이스 링(상시 은은) + 비트마다 확장·소멸 펄스 ──
    this.v2 = new THREE.Group();
    const ringGeo = new THREE.PlaneGeometry(0.95, 0.95);
    this.v2Base = flat(new THREE.Mesh(ringGeo, soft(1, 0.55, 0.26)), 0.013);
    this.v2Pulse = flat(new THREE.Mesh(ringGeo.clone(), soft(1, 0.55, 0)), 0.014);
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
      const d = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), soft(0, 0.8, 0)), 0.013);
      d.position.x = i ? 0.14 : -0.14;
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
      new THREE.PlaneGeometry(1.35, 0.26),
      new THREE.MeshBasicMaterial({
        map: this._cvTex, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })), 0.016);
    this.v5Strip.position.z = -1.35;   // z-0.85는 1인칭 시선각이 얕아 뭉개짐 — 프레임 UI 깊이로
    this.v5.add(this.v5Strip);

    // inner = 인트로 연출용 로컬 오프셋 · group = 투사면 원점 추종 (실전에서 러너가 전진 → 월드 고정이면 즉시 투사면 밖)
    this.inner = new THREE.Group();
    this.inner.add(this.v1, this.v2, this.v3, this.v4, this.v5);
    this.group.add(this.inner);

    // ── C4 부스트 배경(유저): reactbits hyperspeed 참조 — 질주하는 빛줄기 트레일
    //    (밝은 머리 + 긴 꼬리, 소실점 수렴 원근) + 은은한 그라디언트 베드. uFP 페이드 안에서만. ──
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
        float hashf(float n){ return fract(sin(n*127.1)*43758.5453); }
        void main(){
          float t = uTime;
          // 강한 소실점 수렴 = 도로 원근 (참조: hyperspeed의 '열로'감)
          float pers = mix(1.0, 0.24, vUv.y);
          float x = (vUv.x - 0.5) / pers;
          vec3 acc = vec3(0.0);
          // 도로 레일: 러너 레인(중앙) 양옆 경계선 — 연속 라인이 도로 구조를 만든다
          for (int s = 0; s < 2; s++){
            float sx = s == 0 ? -0.145 : 0.145;
            float rail = exp(-pow((x - sx)/0.008, 2.0)) + 0.25*exp(-pow((x - sx)/0.03, 2.0));
            float flow = 0.75 + 0.25*sin(vUv.y*24.0 + t*7.0 + float(s)*3.14);
            acc += lut(s == 0 ? 0.16 : 0.8) * rail * 0.12 * flow;
          }
          // 양옆을 스쳐 지나가는 빛줄기 — 왼쪽 딥레드 · 오른쪽 크림 (참조의 좌우 광적).
          // 중앙 코리도(|x|<0.145)는 비워서 러너 발밑 UI 가독 확보.
          for (int i = 0; i < 14; i++){
            float fi = float(i);
            float side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
            float lane = side * (0.19 + hashf(fi*3.7) * 0.30);
            float spd  = 2.2 + hashf(fi*9.1) * 3.0;
            float ph   = fract(vUv.y*0.85 + t*spd*0.45 + hashf(fi*5.3));   // +t = 시청자 쪽으로 질주
            float head = smoothstep(0.02, 0.07, ph) * smoothstep(0.24, 0.08, ph);
            float tail = smoothstep(0.07, 0.10, ph) * pow(max(0.0, 1.0 - (ph-0.10)/0.62), 2.0);
            float core = exp(-pow((x - lane)/(0.009 + 0.006*hashf(fi*7.7)), 2.0));
            float halo = 0.35 * exp(-pow((x - lane)/0.05, 2.0));
            float hue  = side < 0.0 ? 0.10 + 0.14*hashf(fi*2.3) : 0.72 + 0.24*hashf(fi*2.3);
            acc += lut(hue) * (core + halo) * (head*1.25 + tail*0.55);
          }
          // 도로면 시트글로우: 코리도가 은은히 밝고 바깥으로 감쇠 — 도로 볼륨감
          float road = exp(-pow(x/0.30, 2.0)) * (0.35 + 0.65*vUv.y);
          acc += lut(0.3) * road * 0.05;
          gl_FragColor = vec4(acc * 0.9 * fpFade(vWorldPos), 1.0);
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
      // 융합 펄스: 틱·노치가 겹치면(|Δz|<0.08) 하나로 '합쳐지는' 순간 보상 — 스케일 1→1.25→1 + 밝기 상승
      const fused = Math.abs(this._tickZ - this.v1Notch.position.z) < 0.08;
      if (fused && !this._v1Fused) this._fuseT = 0;   // 겹침 진입 순간 발화
      this._v1Fused = fused;
      this._fuseT = Math.min(1, (this._fuseT ?? 1) + dt / 0.3);
      const fs = 1 + 0.25 * Math.sin(this._fuseT * Math.PI);
      this.v1Tick.scale.setScalar(fs);
      this.v1Notch.scale.setScalar(fs);
      this.v1Tick.material.uniforms.uOp.value = fused ? 1.0 : 0.95;
      this.v1Notch.material.uniforms.uOp.value = fused ? 0.9 : 0.38;   // 융합 = 노치도 밝게, 두 요소가 하나로
      const U = this.v1Lane.material.uniforms;
      U.uTime.value = this._t;
      U.uDay.value = ctx.day ? 1 : 0;
      this._feedFP(U);
    } else if (v === 2) {
      // 비트 펄스: scale 1→1.35 · opacity 0.9→0 (0.45s easeOutCubic)
      if (beat) this._pulseT = 0;
      this._pulseT = Math.min(1, this._pulseT + dt / 0.45);
      const e = easeOutCubic(this._pulseT);
      // 오프페이스(|션-기준|>0.35m)일수록 딥 레드로
      const k = THREE.MathUtils.clamp((Math.abs(ctx.seanZ + 1.0) - 0.35) / 0.6, 0, 1);
      const q = 0.5 + 0.5 * k;   // 온페이스(k=0) = 진폭·불투명도 절반 — '조용해지는 링'이 일치의 보상
      this.v2Pulse.scale.setScalar(1 + 0.35 * q * e);
      this.v2Pulse.material.uniforms.uOp.value = 0.9 * q * (1 - e);
      this.v2Base.material.uniforms.uColor.value.lerpColors(this._c2on, this._c2off, k);
      this.v2Pulse.material.uniforms.uColor.value.copy(this.v2Base.material.uniforms.uColor.value);
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
      act.position.z = -1.15;   // 얕은 시선각(z-0.95)에서 뭉개지던 것 — 깊이로 이동
      act.scale.setScalar(0.5 + 0.5 * pop);
      act.material.uniforms.uOp.value = Math.max(0, 1 - this._dotAge / beatT);
      act.material.uniforms.uColor.value.copy(this._c4act);
      pre.position.z = -1.5;
      pre.scale.setScalar(1);
      pre.material.uniforms.uOp.value = 0.45;
      pre.material.uniforms.uColor.value.copy(this._c4pre);
    } else if (v === 5) {
      // SPM 표시: 페이스 이탈 시에만 슬라이드 인(0.3s), 일치 시 페이드 아웃 — 달리는 중 글자 최소화
      const offPace = Math.abs(ctx.seanZ + 1.0) >= 0.35;
      this._spmK = THREE.MathUtils.clamp((this._spmK ?? 0) + (offPace ? dt : -dt) / 0.3, 0, 1);
      // 10Hz 리드로 — 매 프레임 캔버스 갱신은 낭비 (단, SPM 애니 중엔 즉시 리드로)
      this._stripAcc += dt;
      if (this._stripAcc >= 0.1 || this._spmK !== this._spmDrawnK) { this._stripAcc = 0; this._drawStrip(ctx); }
    }
  }

  /** V5 스트립 드로잉: 그라디언트 트랙 바 + 글로우 노치 + 라디얼 마커 + SPM */
  _drawStrip(ctx) {
    const g = this._c2d, W = 512, H = 96, cy = 62;
    g.clearRect(0, 0, W, H);
    // 트랙 바: 중앙이 따뜻하게 밝아지는 그라디언트 필 + 글로우 윤곽 (민짜 스트로크 교체)
    const bar = g.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, lutColor(0.18)); bar.addColorStop(0.5, lutColor(0.5)); bar.addColorStop(1, lutColor(0.18));
    g.shadowColor = lutColor(0.55); g.shadowBlur = 14;
    g.fillStyle = bar; g.globalAlpha = 0.30;
    g.beginPath(); g.roundRect(4, cy - 11, W - 8, 22, 11); g.fill();
    g.globalAlpha = 0.8; g.strokeStyle = lutColor(0.62); g.lineWidth = 1.5; g.stroke();
    g.globalAlpha = 1;
    // 센터 노치: 하드 렉트 → 글로우 라인
    g.shadowBlur = 10; g.shadowColor = '#fff';
    g.fillStyle = rgba(NEU.ink, 0.95);
    g.beginPath(); g.roundRect(W / 2 - 1.5, cy - 16, 3, 32, 1.5); g.fill();
    // 페이스 마커: 화이트-핫 코어 → LUT 바디 → 투명 라디얼 (션 z 오프셋 기준 -1.0, ±0.5m. 앞섬 = 오른쪽)
    const off = THREE.MathUtils.clamp(-(ctx.seanZ + 1.0) / 0.5, -1, 1);
    const mx = W / 2 + off * (W / 2 - 40);
    const mg = g.createRadialGradient(mx, cy, 0, mx, cy, 17);
    mg.addColorStop(0, NEU.ink); mg.addColorStop(0.35, lutColor(0.85)); mg.addColorStop(1, 'rgba(0,0,0,0)');
    g.shadowBlur = 0;
    g.fillStyle = mg;
    g.beginPath(); g.arc(mx, cy, 17, 0, Math.PI * 2); g.fill();
    g.shadowColor = lutColor(0.6); g.shadowBlur = 8;
    // 내 케이던스 (우상단): 페이스 이탈 시에만 오른쪽에서 슬라이드 인 — _spmK(0=숨김, 1=정착)
    const sk = this._spmK ?? 1;
    if (sk > 0.01) {
      g.fillStyle = lutColor(0.9);
      g.font = '700 34px Supreme, sans-serif';
      g.textAlign = 'right'; g.textBaseline = 'alphabetic';
      g.globalAlpha = sk;
      g.fillText(`${ctx.spmMine || '--'} SPM`, W - 10 + (1 - easeOutCubic(sk)) * 80, 36);
      g.globalAlpha = 1;
    }
    this._spmDrawnK = sk;
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
