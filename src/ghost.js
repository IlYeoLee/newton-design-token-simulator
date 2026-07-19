import * as THREE from 'three';
import { WALL_Z } from './scene.js';
import { thermalColor, heatBlob, composeThermal, ensureGooFilter } from './thermal.js';

// 벽면 고스트 v3 — 열화상(depth-map) 실루엣.
// 본 사이 블롭을 관절 깊이(z)로 색칠(가까움=핫핑크 → 멀음=샌드) → gooey 융합으로
// 한 덩어리 면 → 소프트 헤일로 + 그레인. (레퍼런스: depth 컬러맵 실루엣)
// 잽 최대 신전(피크)이 벽면 타겟 이벤트 순간과 일치 — 타이밍 로직은 v2와 동일.

// [본A, 본B, 블롭 수, 반지름(m, 키 1.7 기준)]
const SEGS = [
  ['hips', 'neck', 7, 0.16],            // 몸통
  ['neck', 'head', 2, 0.10],
  ['head', 'head', 1, 0.13],            // 머리
  ['right_shoulder', 'right_elbow', 4, 0.078],
  ['right_elbow', 'right_wrist', 4, 0.062],
  ['left_shoulder', 'left_elbow', 4, 0.078],
  ['left_elbow', 'left_wrist', 4, 0.062],
  ['hips', 'right_knee', 5, 0.10],
  ['right_knee', 'right_ankle', 5, 0.074],
  ['hips', 'left_knee', 5, 0.10],
  ['left_knee', 'left_ankle', 5, 0.074],
];

// 깊이 정규화 범위(m) — 잽 신전 시 손목이 몸 앞 ~0.7m
const Z_MIN = -0.35, Z_MAX = 0.72;

const CW = 384, CH = 512;   // 오프스크린 해상도

export class WallGhost {
  constructor(scene) {
    ensureGooFilter();
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 4;
    scene.add(this.group);

    // 캔버스 파이프라인: shape(블롭) → goo(융합) → out(헤일로+그레인)
    this.cShape = document.createElement('canvas'); this.cShape.width = CW; this.cShape.height = CH;
    this.cGoo = document.createElement('canvas'); this.cGoo.width = CW; this.cGoo.height = CH;
    this.cOut = document.createElement('canvas'); this.cOut.width = CW; this.cOut.height = CH;
    this.tex = new THREE.CanvasTexture(this.cOut);
    this.tex.colorSpace = THREE.SRGBColorSpace;

    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, opacity: 0.92,
      depthWrite: false, toneMapped: false,
      // goo(SVG 필터) 알파 매트릭스가 캔버스 전면에 미세 알파 바닥을 깔아
      // 플레인이 '사각 박스'로 비치던 문제 — 저알파 프래그먼트 폐기 (유저 전수검사)
      alphaTest: 0.04,
    });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.plane.renderOrder = 4;
    this.group.add(this.plane);

    // 블롭 정의 (렌더는 캔버스에서)
    this.blobs = [];
    for (const [a, b, n, r] of SEGS)
      for (let i = 0; i < n; i++)
        this.blobs.push({ a, b, k: n === 1 ? 0.5 : i / (n - 1), r });

    this.data = null;
    this.punches = [];
    this._lastDraw = -1;
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
    // 벽면 플레인: 높이=wallH, 폭=캔버스 종횡비 유지
    this.wallH = wallH;
    const w = wallH * CW / CH;
    this.plane.scale.set(w, wallH, 1);
    this.plane.position.set(this.cx, this.y0 + wallH / 2, WALL_Z + 0.02);
    this.pxPerM = CH / wallH;
  }

  setClip(planes) { this.mat.clippingPlanes = planes; }

  update(t) {
    if (!this.data || !this.group.visible || !this.wallH) return;
    if (Math.abs(t - this._lastDraw) < 1 / 45) return;   // 45Hz 상한 (캔버스 비용 절약)
    this._lastDraw = t;

    let ct = 0;
    for (const tp of this.punches) {
      const s = tp - this.peakT;
      if (t >= s && t < s + this.jabEnd) { ct = t - s; break; }
    }
    const fr = this._sample(ct);

    // ── 1) shape: 블롭을 깊이 색으로, 먼 것부터(painter's) ──
    const sc = this.cShape.getContext('2d');
    sc.clearRect(0, 0, CW, CH);
    const items = [];
    for (const b of this.blobs) {
      const pa = fr[this.ji[b.a]], pb = fr[this.ji[b.b]];
      const x = pa[0] + (pb[0] - pa[0]) * b.k;
      const y = pa[1] + (pb[1] - pa[1]) * b.k;
      const z = pa[2] + (pb[2] - pa[2]) * b.k;
      items.push({
        px: CW / 2 + x * this.S * this.pxPerM,
        py: CH - (y * this.S + 0.04) * this.pxPerM,
        pr: Math.max(4, b.r * this.S * this.pxPerM * 1.18),
        t: (z - Z_MIN) / (Z_MAX - Z_MIN),
      });
    }
    items.sort((a, b) => a.t - b.t);                    // 먼 것 먼저 → 가까운 게 위
    for (const it of items) heatBlob(sc, it.px, it.py, it.pr, it.t);

    // ── 2) goo 융합 + 헤일로 + 그레인 ──
    composeThermal(this.cShape, this.cGoo, this.cOut, { halo: 16, haloA: 0.5, bodyBlur: 1.5, grain: 0.09 });

    // 발 밑 열 고임 (지면 접촉 글로우 — 레퍼런스의 바닥 풀)
    const oc = this.cOut.getContext('2d');
    for (const ank of ['right_ankle', 'left_ankle']) {
      const p = fr[this.ji[ank]];
      if (!p) continue;
      const px = CW / 2 + p[0] * this.S * this.pxPerM;
      const py = CH - 6;
      const g = oc.createRadialGradient(px, py, 2, px, py, 46);
      g.addColorStop(0, thermalColor(0.55, 0.4));
      g.addColorStop(1, thermalColor(0.3, 0));
      oc.fillStyle = g;
      oc.save(); oc.translate(px, py); oc.scale(1, 0.32); oc.translate(-px, -py);
      oc.beginPath(); oc.arc(px, py, 46, 0, Math.PI * 2); oc.fill(); oc.restore();
    }

    this.tex.needsUpdate = true;
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
