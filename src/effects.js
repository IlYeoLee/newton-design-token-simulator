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

  burst(pos, colorHex, normal) {
    const isFloor = Math.abs(normal.y) > 0.5;

    const clipPlanes = isFloor ? this.floorClipPlanes : this.wallClipPlanes;
    const make = (geo, opacity) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity,
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

    // 확산 리플 링 2겹 (시차) + 중심 글로우
    const items = [
      { mesh: make(new THREE.RingGeometry(0.13, 0.155, 48), 0.85), endScale: 2.4, delay: 0 },
      { mesh: make(new THREE.RingGeometry(0.10, 0.118, 48), 0.6),  endScale: 1.9, delay: 0.09 },
      { mesh: make(new THREE.CircleGeometry(0.15, 40), 0.4),       endScale: 1.5, delay: 0 },
    ];
    for (const it of items) {
      this.items.push({ ...it, life: 0, maxLife: 0.55, isFloor });
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
      if (it.isFloor && this.clip && !this.clip(it.mesh.position.x, it.mesh.position.z)) {
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
      it.mesh.material.opacity = it.mesh.material.opacity * 0 + (1 - k) * (it.endScale > 2 ? 0.85 : 0.45);
    }
  }
}
