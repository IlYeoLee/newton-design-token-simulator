// ─────────────────────────────────────────────────────────────
// 투사 UI 레이어 — 60fps 모션의 토대
//
// 왜 만들었나:
//   지금까지 지면/벽 UI는 대지 한 장(9.6MB)을 통째로 캔버스에 그리고 텍스처로 올렸다.
//   글자 하나가 1px 움직여도 9.6MB 를 다시 올려야 해서 60fps 는 576MB/s 가 된다.
//   그래서 프레임을 12~24로 낮췄고, 그 결과 모션이 계단처럼 보였다(유저: 매끄럽지 않다).
//
//   그런데 이 UI 모션의 거의 전부는 '변환'이다 — 등장(translate+scale+alpha),
//   떠오름, 펄스, 글로우 드리프트. 픽셀이 실제로 바뀌는 건 도트바·링·숫자뿐이고
//   그것도 작은 영역이다.
//
//   요소마다 자기 평면을 주면 모션은 3D 변환이라 업로드가 0이다. 60fps 가 공짜가 된다.
//   내용이 바뀌는 요소만 자기 작은 캔버스를 다시 그린다(수십~수백 KB).
//
// 좌표 규약: 대지 px 그대로 쓴다. (0,0)=좌상단, y는 아래로. 보드가 px→m 스케일을 갖는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const DPR = 1;   // 캔버스는 대지 px 기준 — 보드 스케일이 실물 크기를 정한다

export class Layer {
  /** @param {number} w @param {number} h  대지 px 크기 (내용이 들어갈 상자) */
  constructor(w, h, { k = 1, renderOrder = 4 } = {}) {
    this.w = w; this.h = h; this.k = k;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.round(w * k * DPR));
    this.canvas.height = Math.max(1, Math.round(h * k * DPR));
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, depthWrite: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.renderOrder = renderOrder;
    this.mesh.frustumCulled = false;
    this._sig = null;      // 내용 서명 — 바뀔 때만 다시 그린다
    this._x = 0; this._y = 0;   // 대지 좌표(좌상단 기준)
  }

  /** 보드 좌표(좌상단 기준 px)에 놓는다 — 평면은 중심 기준이라 절반씩 보정 */
  at(x, y, boardW, boardH) {
    this._x = x; this._y = y;
    this.mesh.position.set(x + this.w / 2 - boardW / 2, boardH / 2 - (y + this.h / 2), 0);
    return this;
  }

  /** 내용 그리기 — sig 가 같으면 건너뛴다(업로드 0). fn(ctx, w, h) 는 로컬 좌표. */
  paint(sig, fn) {
    if (sig != null && sig === this._sig) return false;
    this._sig = sig;
    const g = this.ctx;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    fn(g, this.w, this.h);
    this.tex.needsUpdate = true;
    return true;
  }

  /** 매 프레임 모션 — 변환만 건드린다. 업로드 없음 = 60fps 공짜. */
  motion({ dx = 0, dy = 0, scale = 1, alpha = 1, rot = 0, ox = 0.5, oy = 0.5 } = {}) {
    const m = this.mesh;
    m.visible = alpha > 0.004;
    if (!m.visible) return;
    this.mat.opacity = Math.min(1, alpha);
    // 기준점(ox,oy: 0~1) 중심 스케일 — 평면 중심이 (0.5,0.5)라 그만큼 되민다
    const px = (ox - 0.5) * this.w, py = (0.5 - oy) * this.h;
    m.position.x = this._x + this.w / 2 - this._bw / 2 + dx + px * (1 - scale);
    m.position.y = this._bh / 2 - (this._y + this.h / 2) + dy + py * (1 - scale);
    m.scale.set(scale, scale, 1);
    m.rotation.z = rot;
  }

  dispose() { this.tex.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); }
}

/** 레이어 묶음 = 한 화면. 보드 좌표계(대지 px)를 갖고 레이어를 자식으로 단다. */
export class Board {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.root = new THREE.Group();
    this.layers = new Map();
  }

  /** 이름으로 레이어를 얻는다(없으면 만든다). 크기가 바뀌면 새로 만든다. */
  layer(name, w, h, opts) {
    const cur = this.layers.get(name);
    if (cur && cur.w === w && cur.h === h) return cur;
    if (cur) { this.root.remove(cur.mesh); cur.dispose(); }
    const L = new Layer(w, h, opts);
    L._bw = this.W; L._bh = this.H;
    this.root.add(L.mesh);
    this.layers.set(name, L);
    return L;
  }

  /** 이번 프레임에 안 쓴 레이어는 숨긴다 */
  begin() { this._used = new Set(); }
  use(name) { this._used?.add(name); }
  end() {
    if (!this._used) return;
    for (const [n, L] of this.layers) if (!this._used.has(n)) L.mesh.visible = false;
  }

  clear() {
    for (const [, L] of this.layers) { this.root.remove(L.mesh); L.dispose(); }
    this.layers.clear();
  }
}
