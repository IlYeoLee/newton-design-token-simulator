import * as THREE from 'three';
import { getLUT, FXP, FX_GLSL } from './fxlut.js';

// 성공 이펙트 = 프로젝터가 실제로 그릴 수 있는 2D 광 패턴만.
// 파티클(공중 입자)은 빔프로젝터로 표현 불가 → 표면 위 열 파문 (FX Lab 리퀴드 스타일).
//
// v2: 벡터 링(RingGeometry) 폐기 → 셰이더 쿼드 1장.
//   얇은 코어+와이드 헤일로 · 하모닉 굴곡(도메인 워프) · 잔물결 1겹 · 잔열 · 코어 열점.
//   색 = 공유 히트 LUT (터지는 순간 백황 → 퍼지며 식음). 블룸이 잔광을 살림.
const BURST_VERT = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const BURST_FRAG = `
#include <common>
#include <clipping_planes_pars_fragment>
` + FX_GLSL + `
uniform float uT, uW, uHalo, uNoise, uEmber, uIntensity, uSeed, uForward;
varying vec2 vUv;
void main() {
  #include <clipping_planes_fragment>
  vec2 uv = (vUv - 0.5) * 2.0;
  // 전방 반파: 무릎 패드는 착지점을 지나치므로 파문은 빔이 비추는 전방으로만 방출
  float fwdGate = mix(1.0, smoothstep(-0.10, 0.30, uv.y), uForward);
  float d0 = length(uv);
  float ang = atan(uv.y, uv.x);
  float t = clamp(uT, 0.0, 1.0);
  float ein = smoothstep(0.0, 0.06, t);
  float e = 1.0 - pow(1.0 - t, 2.6);
  float fade = pow(1.0 - t, 1.5) * ein;
  // 일렁임: 사인 하모닉 + fbm 소량 — 거리장 워프 (형태가 액체처럼)
  float u1 = fxundul(ang + uSeed, t * 2.2);
  float wob = u1 + (fxfbm(vec2(ang * 1.3 + t + uSeed, d0 * 2.0)) - 0.5) * 0.5;
  float d = d0 * (1.0 + wob * uNoise * 0.10);
  // 본류 + 잔물결 1겹 (리퀴드)
  // 기저 에너지 재캘리브레이션 — Air 절제 파라미터(글로우 .35·잔열 .15)에서도 파문이 읽히게
  // (링 폭 1.4배 + 헤일로 항 상향 + 전체 게인 1.45: 임계 이하로 꺼지던 문제 보정)
  float R = 0.06 + e * 0.84;
  float W = (0.028 + e * 0.09) * uW * 1.4;
  float heat = exp(-pow((d - R) / W, 2.0)) + exp(-pow((d - R) / (W * 4.6), 2.0)) * 0.6 * uHalo;
  float e2 = 1.0 - pow(1.0 - clamp(t - 0.14, 0.0, 1.0) / 0.86, 2.6);
  float R2 = 0.06 + e2 * 0.9 * 0.84;
  heat += (exp(-pow((d - R2) / W, 2.0)) + exp(-pow((d - R2) / (W * 4.6), 2.0)) * 0.6 * uHalo) * 0.38;
  heat *= fade;
  // 잔열 + 코어 열점
  heat += smoothstep(R, R * 0.2, d0) * uEmber * fade * (0.8 + 0.2 * wob);
  heat += exp(-d0 * 6.5) * pow(1.0 - t, 2.2) * 1.15;
  heat *= uIntensity * fwdGate * 1.45;
  // 새벽빛 스윕
  float sweep = 0.09 * sin(ang - t * 2.4) + 0.05 * sin(ang * 2.0 + t * 1.1);
  vec3 col = lut(clamp(heat * (0.95 - 0.28 * t) + sweep * min(heat, 1.0), 0.0, 1.0)) * min(heat, 1.4);
  gl_FragColor = vec4(col, 1.0);   // additive: 검정 = 무기여
}`;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.clip = null;        // (x,z)=>bool — 중심점 기준 급속 소멸용
    this.floorClipPlanes = null;  // GPU 클리핑 — 이펙트도 투사면 밖은 잘림
    this.wallClipPlanes = null;
  }

  _makeMat(clipPlanes) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: BURST_VERT,
      fragmentShader: BURST_FRAG,
      uniforms: {
        uLUT: { value: getLUT() },
        uT: { value: 0 },
        uW: { value: FXP.graphics.width },
        uHalo: { value: FXP.graphics.halo },
        uNoise: { value: FXP.graphics.noise },
        uEmber: { value: FXP.graphics.ember },
        uIntensity: { value: 1 },
        uForward: { value: 0 },
        uSeed: { value: Math.random() * 6.2832 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      clippingPlanes: clipPlanes || null,
    });
    mat.clipping = true;   // ShaderMaterial GPU 클리핑 활성 (파라미터로는 안 먹는 케이스 방지)
    return mat;
  }

  // opts (토큰별 터짐 조절): { intensity, speed, rings, color, noClip }
  //   intensity = 크기·밝기 배율 · speed = 진행 속도 · rings는 v2에선 헤일로 배율로 흡수
  burst(pos, colorHex, normal, opts = {}) {
    const isFloor = Math.abs(normal.y) > 0.5;
    const intensity = Math.max(0.2, opts.intensity ?? 1);
    const speed = Math.max(0.25, opts.speed ?? 1);
    const noClip = !!opts.noClip;
    const maxLife = FXP.graphics.duration / speed;   // 랩 체감 유지 — 접지 간격보다 길어 파문이 겹치며 흐름
    const clipPlanes = noClip ? null : (isFloor ? this.floorClipPlanes : this.wallClipPlanes);

    const size = opts.sizeM ?? FXP.graphics.size * Math.sqrt(intensity);   // 파문 도달 반경 (m) — 벽은 타겟 비례
    const mat = this._makeMat(clipPlanes);
    mat.uniforms.uIntensity.value = Math.min(1.5, intensity) * FXP.gainBoost;
    mat.uniforms.uForward.value = opts.forward ? 1 : 0;
    if (opts.rings != null) mat.uniforms.uHalo.value = FXP.graphics.halo * (0.5 + 0.35 * opts.rings);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), mat);
    m.position.copy(pos);
    if (isFloor) {
      m.rotation.x = -Math.PI / 2;
      m.position.y = Math.max(pos.y, 0) + 0.014;
    } else {
      m.position.z += 0.025;
    }
    m.renderOrder = 8;
    this.scene.add(m);
    this.items.push({ mesh: m, mat, life: 0, maxLife, isFloor, noClip, shader: true, forward: !!opts.forward });
  }

  /** 착지점 도트 — 학습자의 실제 도달 위치 표시 (작은 채움 원, 서서히 소멸) */
  dot(pos, colorHex, normal) {
    const isFloor = Math.abs(normal.y) > 0.5;
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 24),
      new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false,
        clippingPlanes: isFloor ? this.floorClipPlanes : this.wallClipPlanes,
      })
    );
    m.position.copy(pos);
    if (isFloor) { m.rotation.x = -Math.PI / 2; m.position.y = Math.max(pos.y, 0) + 0.016; }
    else m.position.z += 0.03;
    m.renderOrder = 9;
    this.items.push({ mesh: m, life: 0, maxLife: 1.4, isFloor });
    this.scene.add(m);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      // 풋프린트 이탈(러너 전진) 시 가속 소멸 — 물리적 잘림은 GPU 클리핑이 담당.
      // 전방 반파는 중심이 원래 패드 뒷전(착지점)이므로 중심 판정으로 죽이지 않는다 —
      // 파문의 몸통은 전방(빔 안)에 있고, GPU 클리핑이 밖 부분을 정직하게 자른다.
      if (it.isFloor && !it.noClip && !it.forward && this.clip && !this.clip(it.mesh.position.x, it.mesh.position.z)) {
        it.life += dt * 2.5;
      }
      const k = it.life / it.maxLife;
      if (k >= 1) {
        this.scene.remove(it.mesh);
        it.mesh.geometry.dispose();
        it.mesh.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.shader) {
        it.mat.uniforms.uT.value = k;
        // 라이브 파라미터 반영 (프로 편집 모드)
        it.mat.uniforms.uW.value = FXP.graphics.width;
        it.mat.uniforms.uNoise.value = FXP.graphics.noise;
        it.mat.uniforms.uEmber.value = FXP.graphics.ember;
      } else {
        const e = 1 - Math.pow(1 - k, 2.2);
        it.mesh.scale.setScalar(1 + 0.5 * e);
        it.mesh.material.opacity = (1 - k) * 0.85;
      }
    }
  }
}
