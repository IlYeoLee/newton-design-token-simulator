import * as THREE from 'three';
import { WALL_Z } from './scene.js';

// 벽면 고스트 v2 — 전문가 전신 소프트 실루엣 (참조: 그린 글로우 면 실루엣)
// 본을 따라 radial-gradient 블롭을 겹쳐 메타볼식 면으로 표현.
// 잽 최대 신전(피크)이 벽면 타겟 이벤트 순간과 일치.

// [본, 블롭 수, 반지름(m, 키 1.7 기준)]
const SEGS = [
  ['hips', 'neck', 6, 0.15],            // 몸통
  ['neck', 'head', 2, 0.10],
  ['head', 'head', 1, 0.125],           // 머리
  ['right_shoulder', 'right_elbow', 3, 0.075],
  ['right_elbow', 'right_wrist', 3, 0.062],
  ['left_shoulder', 'left_elbow', 3, 0.075],
  ['left_elbow', 'left_wrist', 3, 0.062],
  ['hips', 'right_knee', 4, 0.095],
  ['right_knee', 'right_ankle', 4, 0.072],
  ['hips', 'left_knee', 4, 0.095],
  ['left_knee', 'left_ankle', 4, 0.072],
];

function makeBlobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class WallGhost {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 4;
    scene.add(this.group);

    const tex = makeBlobTexture();
    this.mat = new THREE.MeshBasicMaterial({
      map: tex, color: 0x8dff5e, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.blobs = [];   // { mesh, segIdx, k(0..1 along segment), r }
    for (const [a, b, n, r] of SEGS) {
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
        mesh.renderOrder = 4;
        this.group.add(mesh);
        this.blobs.push({ mesh, a, b, k: n === 1 ? 0.5 : i / (n - 1), r });
      }
    }
    this.data = null;
    this.punches = [];
  }

  get mesh() { return this.group; }   // 기존 인터페이스 호환 (visible 제어)

  setData(tl) {
    this.data = tl;
    this.ji = {};
    tl.joints.forEach((j, i) => { this.ji[j] = i; });
    const jab = tl.clips.find(c => c.name === 'jab');
    this.jabEnd = jab ? jab.end : tl.frames[tl.frames.length - 1].t;
    let best = -Infinity, bt = 0;
    for (const f of tl.frames) {
      if (f.t > this.jabEnd) break;
      const z = f.pos[this.ji.right_wrist][2];
      if (z > best) { best = z; bt = f.t; }
    }
    this.peakT = bt;
  }

  configure(punches, center, wallH) {
    this.punches = punches;
    this.cx = center.cx;
    this.S = (wallH * 0.88) / 1.7;
    this.y0 = center.cy - wallH / 2 + 0.04;
  }

  setClip(planes) { this.mat.clippingPlanes = planes; }

  update(t) {
    if (!this.data || !this.group.visible) return;
    let ct = 0;
    for (const tp of this.punches) {
      const s = tp - this.peakT;
      if (t >= s && t < s + this.jabEnd) { ct = t - s; break; }
    }
    const fr = this._sample(ct);
    for (const b of this.blobs) {
      const pa = fr[this.ji[b.a]], pb = fr[this.ji[b.b]];
      const x = pa[0] + (pb[0] - pa[0]) * b.k;
      const y = pa[1] + (pb[1] - pa[1]) * b.k;
      b.mesh.position.set(this.cx + x * this.S, this.y0 + y * this.S, WALL_Z + 0.02);
      const d = b.r * this.S * 2 * 2.4;   // 그라디언트 여백 포함 지름
      b.mesh.scale.set(d, d, 1);
    }
  }

  _sample(t) {
    const F = this.data.frames;
    if (t <= F[0].t) return F[0].pos;
    for (let i = 0; i < F.length - 1; i++) {
      if (t >= F[i].t && t <= F[i + 1].t) {
        const k = (t - F[i].t) / Math.max(F[i + 1].t - F[i].t, 1e-4);
        return F[i].pos.map((p, idx) => [
          p[0] + (F[i + 1].pos[idx][0] - p[0]) * k,
          p[1] + (F[i + 1].pos[idx][1] - p[1]) * k,
          p[2] + (F[i + 1].pos[idx][2] - p[2]) * k,
        ]);
      }
    }
    return F[F.length - 1].pos;
  }
}
