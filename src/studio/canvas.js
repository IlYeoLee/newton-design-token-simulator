// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 2D 저작 캔버스 (피그마式, 러닝 지면 = 탑다운)
//   가로축 = 레인(m), 세로축 = 전방 깊이(m, 아래=러너 발치, 위=전방).
//   깊이는 곧 시간(t)이다: depth = V·t + STRIKE_AHEAD.
//   토큰을 클릭 배치 / 선택 / 드래그 이동 / Delete 삭제 → doc mutate → 3D rebuild.
// ─────────────────────────────────────────────────────────────
import { RUN, runMap } from './doc.js';

const PAD = { l: 46, r: 16, t: 16, b: 26 };  // 축 라벨 여백
const HIT_PX = 20;

export class StudioCanvas {
  constructor(canvasEl, doc, opts = {}) {
    this.el = canvasEl;
    this.doc = doc;
    this.onEdit = opts.onEdit || (() => {});
    this.getWindow = opts.getWindow || (() => null);
    this.tool = 'select';
    this.laneHalf = RUN.LANE_W / 2 + 0.25;   // 가로 가시 범위(±m)
    this.drag = null;

    this._onDown = this._down.bind(this);
    this._onMove = this._move.bind(this);
    this._onUp = this._up.bind(this);
    this._onKey = this._key.bind(this);
    this._onResize = () => { this._resize(); this.draw(); };

    this.el.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('keydown', this._onKey);
    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(this.el);

    this._unsub = doc.onChange(() => this.draw());
    this._resize();
    this.draw();
  }

  setTool(t) {
    this.tool = t;
    this.el.style.cursor = t === 'select' ? 'default' : 'crosshair';
  }

  destroy() {
    this.el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('keydown', this._onKey);
    this._ro.disconnect();
    this._unsub?.();
  }

  // ── 깊이 범위(세로) — 토큰 최대 깊이 + 여백, 최소 6m ──
  _depthMax() {
    let m = 5;
    for (const g of this.doc.groups()) m = Math.max(m, runMap.tToDepth(g.t));
    return Math.ceil((m + 1.2) / 0.5) * 0.5;
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.el.clientWidth || 400, h = this.el.clientHeight || 600;
    this.el.width = Math.round(w * dpr);
    this.el.height = Math.round(h * dpr);
    this.ctx = this.el.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = h;
  }

  // ── 좌표 변환 ──
  worldToPx(laneX, depth) {
    const iw = this.W - PAD.l - PAD.r, ih = this.H - PAD.t - PAD.b;
    const px = PAD.l + ((laneX + this.laneHalf) / (2 * this.laneHalf)) * iw;
    const py = PAD.t + ih - (depth / this._dMax) * ih;   // 아래=depth 0
    return [px, py];
  }
  pxToWorld(px, py) {
    const iw = this.W - PAD.l - PAD.r, ih = this.H - PAD.t - PAD.b;
    const laneX = ((px - PAD.l) / iw) * (2 * this.laneHalf) - this.laneHalf;
    const depth = (1 - (py - PAD.t) / ih) * this._dMax;
    return [laneX, depth];
  }

  _hit(px, py) {
    let best = null, bd = HIT_PX;
    for (const g of this.doc.groups()) {
      const [gx, gy] = this.worldToPx(runMap.nxToLane(g.nx), runMap.tToDepth(g.t));
      const d = Math.hypot(px - gx, py - gy);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  _evPx(e) {
    const r = this.el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  _down(e) {
    const [px, py] = this._evPx(e);
    if (px < PAD.l - 8 || px > this.W - PAD.r + 8) return;
    if (this.tool === 'select') {
      const g = this._hit(px, py);
      this.doc.select(g ? g.gid : null);
      if (g) this.drag = { gid: g.gid };
    } else if (this.tool === 'left' || this.tool === 'right') {
      let [laneX, depth] = this.pxToWorld(px, py);
      laneX = Math.max(-this.laneHalf, Math.min(this.laneHalf, laneX));
      const nx = runMap.laneToNx(laneX);
      const t = runMap.depthToT(Math.max(0, depth));
      const gid = this.doc.addStep(this.tool, nx, t);
      this.drag = { gid };
      this.onEdit();
    }
    this.el.setPointerCapture?.(e.pointerId);
  }

  _move(e) {
    if (!this.drag) return;
    const [px, py] = this._evPx(e);
    let [laneX, depth] = this.pxToWorld(px, py);
    laneX = Math.max(-this.laneHalf, Math.min(this.laneHalf, laneX));
    this.doc.moveGroup(this.drag.gid, runMap.laneToNx(laneX), runMap.depthToT(Math.max(0, depth)));
    this.onEdit();
  }

  _up() { if (this.drag) { this.drag = null; this.onEdit(); } }

  _key(e) {
    if (!this.doc.selection) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.doc.remove(this.doc.selection);
      this.onEdit();
    }
  }

  // ── 렌더 ──
  draw() {
    if (!this.ctx) return;
    this._dMax = this._depthMax();
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    // 트랙 배경
    const [x0] = this.worldToPx(-this.laneHalf, 0);
    const [x1] = this.worldToPx(this.laneHalf, 0);
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(PAD.l, PAD.t, W - PAD.l - PAD.r, H - PAD.t - PAD.b);

    // 레인 경계 + 중앙 대시
    const half = RUN.LANE_W / 2;
    ctx.strokeStyle = 'rgba(250,48,48,0.35)'; ctx.lineWidth = 2;
    for (const lx of [-half, half]) {
      const [lpx] = this.worldToPx(lx, 0);
      ctx.beginPath(); ctx.moveTo(lpx, PAD.t); ctx.lineTo(lpx, H - PAD.b); ctx.stroke();
    }
    const [cpx] = this.worldToPx(0, 0);
    ctx.strokeStyle = 'rgba(250,48,48,0.28)'; ctx.setLineDash([6, 9]);
    ctx.beginPath(); ctx.moveTo(cpx, PAD.t); ctx.lineTo(cpx, H - PAD.b); ctx.stroke();
    ctx.setLineDash([]);

    // 깊이 그리드 + 라벨 (1m 간격)
    ctx.fillStyle = '#6b7180'; ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let d = 0; d <= this._dMax; d += 1) {
      const [, gy] = this.worldToPx(0, d);
      ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(W - PAD.r, gy); ctx.stroke();
      ctx.fillText(`${d}m`, PAD.l - 6, gy);
    }

    // 투사 창(near..far) 밴드 — 하드웨어 가시 구간 힌트
    const win = this.getWindow();
    if (win) {
      const [, ny] = this.worldToPx(0, win.near);
      const [, fy] = this.worldToPx(0, win.far);
      ctx.fillStyle = 'rgba(105,212,222,0.08)';
      ctx.fillRect(PAD.l, fy, W - PAD.l - PAD.r, ny - fy);
      ctx.strokeStyle = 'rgba(105,212,222,0.4)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      for (const yy of [ny, fy]) { ctx.beginPath(); ctx.moveTo(PAD.l, yy); ctx.lineTo(W - PAD.r, yy); ctx.stroke(); }
      ctx.setLineDash([]);
    }

    // 러너 시작점 (깊이 0)
    const [rx, ry] = this.worldToPx(0, 0);
    ctx.fillStyle = 'rgba(232,234,240,0.6)';
    ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#8b93a3';
    ctx.fillText('러너', rx, ry + 12);

    // 레인 연결선 (스텝 순서)
    const groups = this.doc.groups();
    if (groups.length >= 2) {
      ctx.strokeStyle = 'rgba(250,48,48,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath();
      groups.forEach((g, i) => {
        const [gx, gy] = this.worldToPx(runMap.nxToLane(g.nx), runMap.tToDepth(g.t));
        i ? ctx.lineTo(gx, gy) : ctx.moveTo(gx, gy);
      });
      ctx.stroke();
    }

    // 스텝 토큰
    for (const g of groups) {
      const [gx, gy] = this.worldToPx(runMap.nxToLane(g.nx), runMap.tToDepth(g.t));
      const sel = g.gid === this.doc.selection;
      const r = 13;
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,48,48,0.18)'; ctx.fill();
      ctx.lineWidth = sel ? 3 : 2;
      ctx.strokeStyle = sel ? '#d1feff' : '#fa3030'; ctx.stroke();
      // 좌/우 표식
      ctx.fillStyle = '#e8eaf0'; ctx.font = '700 11px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.foot === 'right' ? 'R' : 'L', gx, gy - 0.5);
      // 비트 번호
      if (g.n) {
        ctx.fillStyle = '#8b93a3'; ctx.font = '9px -apple-system, sans-serif';
        ctx.fillText(String(g.n), gx + r + 6, gy);
      }
    }

    // 축 라벨
    ctx.fillStyle = '#6b7180'; ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('← 레인(m) →', (PAD.l + W - PAD.r) / 2, H - 6);
  }
}
