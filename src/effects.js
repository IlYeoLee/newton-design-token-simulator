import * as THREE from 'three';

// 성공 이펙트 = 프로젝터가 실제로 그릴 수 있는 2D 광 패턴만.
// 파티클(공중 입자)은 빔프로젝터로 표현 불가 → 표면 위 확산 리플 + 글로우 페이드.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.clip = null;        // (x,z)=>bool — 중심점 기준 급속 소멸용
    this.floorClipPlanes = null;  // GPU 클리핑 — 리플 가장자리도 투사면 밖은 잘림
    this.wallClipPlanes = null;
  }

  // opts (토큰별 터짐 조절): { intensity, speed, rings, color, noClip }
  //   intensity = 확산 크기·밝기 배율 · speed = 진행 속도(빠를수록 짧게) · rings = 링 겹수(1~4)
  burst(pos, colorHex, normal, opts = {}) {
    const isFloor = Math.abs(normal.y) > 0.5;
    const intensity = Math.max(0.2, opts.intensity ?? 1);
    const speed = Math.max(0.25, opts.speed ?? 1);
    const rings = Math.max(1, Math.min(4, Math.round(opts.rings ?? 2)));
    const col = (opts.color != null && opts.color !== '') ? opts.color : colorHex;
    const noClip = !!opts.noClip;
    const maxLife = 0.55 / speed;

    const clipPlanes = noClip ? null : (isFloor ? this.floorClipPlanes : this.wallClipPlanes);
    const make = (geo, opacity) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
        clippingPlanes: clipPlanes,
      }));
      m.position.copy(pos);
      if (isFloor) {
        m.rotation.x = -Math.PI / 2;
        m.position.y = Math.max(pos.y, 0) + 0.014;
      } else {
        m.position.z += 0.025;
      }
      m.renderOrder = 8;
      this.scene.add(m);
      return m;
    };

    // 확산 리플 링 N겹 (시차) + 중심 글로우 — 크기·밝기는 intensity로 스케일
    const items = [];
    for (let r = 0; r < rings; r++) {
      const r0 = 0.13 - r * 0.022;
      items.push({ mesh: make(new THREE.RingGeometry(r0, r0 + 0.025, 48), 0.85), endScale: 1 + (1.4 - r * 0.3) * intensity, delay: r * 0.09, glow: false });
    }
    items.push({ mesh: make(new THREE.CircleGeometry(0.15, 40), 0.4 * Math.min(1.6, intensity)), endScale: 1 + 0.5 * intensity, delay: 0, glow: true });
    for (const it of items) {
      this.items.push({ ...it, life: 0, maxLife, isFloor, noClip });
    }
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
    this.scene.add(m);
    this.items.push({ mesh: m, life: 0, maxLife: 1.4, endScale: 1.0, delay: 0, isFloor });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      // 풋프린트 이탈(러너 전진) 시 리플 급속 소멸 — 빔이 더 이상 그 자리를 비추지 않음
      // (noClip = 스튜디오 터짐 미리보기: 풋프린트 무관하게 온전히 보여줌)
      if (it.isFloor && !it.noClip && this.clip && !this.clip(it.mesh.position.x, it.mesh.position.z)) {
        it.life += dt * 5;
      }
      const t = it.life - it.delay;
      if (t < 0) { it.mesh.visible = false; continue; }
      it.mesh.visible = true;
      const k = t / (it.maxLife - it.delay);
      if (k >= 1) {
        this.scene.remove(it.mesh);
        it.mesh.geometry.dispose();
        it.mesh.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      // easeOut 확산 + 페이드
      const e = 1 - Math.pow(1 - k, 2.2);
      it.mesh.scale.setScalar(1 + (it.endScale - 1) * e);
      it.mesh.material.opacity = (1 - k) * (it.glow ? 0.45 : 0.85);
    }
  }
}
