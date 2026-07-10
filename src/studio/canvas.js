// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 2D 저작 캔버스 (피그마式, 러닝 지면 = 탑다운)
//   가로축 = 레인(m), 세로축 = 전방 깊이(m). depth = V·t + STRIKE_AHEAD.
//   단일 MARK 배치/선택/드래그/삭제. 계약(도달·회피·유지)·반경(판정창)·
//   순서/방향 채널을 그대로 반영해 그린다. 세부 편집은 속성 패널(props.js).
// ─────────────────────────────────────────────────────────────
import { RUN, runMap, mapFor } from './doc.js';

const PAD = { l: 46, r: 16, t: 16, b: 26 };
const HIT_PX = 20;

export class StudioCanvas {
  constructor(canvasEl, doc, opts = {}) {
    this.el = canvasEl;
    this.doc = doc;
    this.onEdit = opts.onEdit || (() => {});
    this.onTool = opts.onTool || (() => {});
    this.tool = 'select';                    // 'select' | 'mark'
    this.laneHalf = RUN.LANE_W / 2 + 0.25;
    this.drag = null;

    // ── 장면 레이어 훅 ──
    // 캔버스는 MARK만 알던 것에서, 스테이지 GUI 요소도 같은 미터 좌표계에
    // 올려 그리고 집을 수 있게 확장된다. 리스트에서 고르던 걸 클릭으로.
    this.extras = opts.extras || null;                 // () => [{key,h,v,kind,label,sel}]
    this.onPickExtra = opts.onPickExtra || (() => {});
    this.onDragExtra = opts.onDragExtra || (() => {});
    this.extrasOnly = false;                           // 장면 스코프: MARK 숨김

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

  setTool(t) { this.tool = t; this.el.style.cursor = t === 'select' ? 'default' : 'crosshair'; this.onTool(t); }

  /** 숨겨진 채 생성되면 clientW/H=0 → 폴백 크기가 박힌다. 드로어를 연 뒤 한 번 호출.
   *  ResizeObserver는 렌더링 기회가 있어야 콜백하므로 타이밍에 의존하면 안 된다. */
  refresh() { this._resize(); this.draw(); }

  /** 장면 스코프 전환 — MARK 대신 스테이지 요소를 그리고 집는다 */
  setExtrasOnly(v) { this.extrasOnly = !!v; if (v) this.setTool('select'); this.draw(); }
  _extras() { return (this.extrasOnly && this.extras) ? (this.extras() || []) : []; }
  /** 스테이지 요소는 그룹 원점이 겹치는 경우가 흔하다(예: 발 2개+아크가 모두 z=-1.9).
   *  가장 가까운 하나만 주면 나머지는 영영 선택할 수 없다 → 클릭할 때마다 순환. */
  _hitExtra(px, py) {
    const near = [];
    for (const it of this._extras()) {
      const [gx, gy] = this.worldToPx(it.h, it.v);
      const d = Math.hypot(px - gx, py - gy);
      if (d < HIT_PX) near.push({ it, d });
    }
    if (!near.length) return null;
    near.sort((a, b) => a.d - b.d);
    const cur = near.findIndex(o => o.it.sel);
    return near[(cur + 1) % near.length].it;
  }

  // ── 종목별 좌표: H(mk)/V(mk) = 캔버스 가로/세로(m) ──
  _map() { return mapFor(this.doc.sport); }
  _H(mk) { const M = this._map(); return M ? M.H(mk) : runMap.nxToLane(mk.nx); }
  _V(mk) { const M = this._map(); return M ? M.V(mk) : runMap.tToDepth(mk.t); }
  _hHalf() { const M = this._map(); return M ? M.hHalf : this.laneHalf; }
  _applyPos(id, hx, vy, isAdd = false) {
    const M = this._map();
    if (!M) {
      const laneX = Math.max(-this.laneHalf, Math.min(this.laneHalf, hx));
      if (isAdd) return this.doc.addMark(runMap.laneToNx(laneX), runMap.depthToT(Math.max(0, vy)));
      this.doc.move(id, runMap.laneToNx(laneX), runMap.depthToT(Math.max(0, vy)));
      return id;
    }
    const { nx, ny } = M.fromPx(Math.max(-M.hHalf, Math.min(M.hHalf, hx)), vy);
    if (isAdd) {
      let maxT = 0; for (const m of this.doc.marks) maxT = Math.max(maxT, m.t);
      const newId = this.doc.addMark(nx, maxT + 0.6);
      this.doc.moveXY(newId, nx, ny);
      return newId;
    }
    this.doc.moveXY(id, nx, ny);
    return id;
  }

  destroy() {
    this.el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('keydown', this._onKey);
    this._ro.disconnect();
    this._unsub?.();
  }

  _depthMax() {
    const M = this._map();
    if (M?.vMax) return M.vMax;
    let m = M ? 3 : 5;
    if (!this.extrasOnly) for (const mk of this.doc.marks) m = Math.max(m, this._V(mk));
    for (const it of this._extras()) m = Math.max(m, it.v);
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

  _pxPerM() { return (this.W - PAD.l - PAD.r) / (2 * this._hHalf()); }

  worldToPx(laneX, depth) {
    const hh = this._hHalf(), v0 = this._map()?.vMin ?? 0;
    const iw = this.W - PAD.l - PAD.r, ih = this.H - PAD.t - PAD.b;
    const px = PAD.l + ((laneX + hh) / (2 * hh)) * iw;
    const py = PAD.t + ih - ((depth - v0) / (this._dMax - v0)) * ih;
    return [px, py];
  }
  pxToWorld(px, py) {
    const hh = this._hHalf(), v0 = this._map()?.vMin ?? 0;
    const iw = this.W - PAD.l - PAD.r, ih = this.H - PAD.t - PAD.b;
    const laneX = ((px - PAD.l) / iw) * (2 * hh) - hh;
    const depth = v0 + (1 - (py - PAD.t) / ih) * (this._dMax - v0);
    return [laneX, depth];
  }

  _hit(px, py) {
    let best = null, bd = HIT_PX;
    for (const mk of this.doc.marks) {
      const [gx, gy] = this.worldToPx(this._H(mk), this._V(mk));
      const d = Math.hypot(px - gx, py - gy);
      if (d < bd) { bd = d; best = mk; }
    }
    return best;
  }

  _evPx(e) { const r = this.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  _down(e) {
    const [px, py] = this._evPx(e);
    if (px < PAD.l - 8 || px > this.W - PAD.r + 8) return;
    if (this.extrasOnly) {
      const it = this._hitExtra(px, py);
      this.onPickExtra(it ? it.key : null);
      if (it) this.drag = { extra: it.key };
      try { this.el.setPointerCapture?.(e.pointerId); } catch {}
      return;
    }
    if (this.tool === 'mark') {
      const [hx, vy] = this.pxToWorld(px, py);
      const id = this._applyPos(null, hx, vy, true);
      this.drag = { id };
      this.setTool('select');                // 배치 즉시 선택 모드 — 이어서 조정/드래그
      this.onEdit();
    } else {
      const mk = this._hit(px, py);
      this.doc.select(mk ? mk.id : null);
      if (mk) this.drag = { id: mk.id };
    }
    try { this.el.setPointerCapture?.(e.pointerId); } catch {}
  }

  _move(e) {
    if (!this.drag) return;
    const [px, py] = this._evPx(e);
    const [hx, vy] = this.pxToWorld(px, py);
    if (this.drag.extra !== undefined) { this.onDragExtra(this.drag.extra, hx, vy); this.draw(); return; }
    this._applyPos(this.drag.id, hx, vy);
    this.onEdit();
  }

  _up() {
    if (!this.drag) return;
    const wasExtra = this.drag.extra !== undefined;   // 장면 요소는 팩 리빌드 대상이 아님
    this.drag = null;
    if (!wasExtra) this.onEdit();
  }

  _key(e) {
    if (this.extrasOnly) return;
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
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(PAD.l, PAD.t, W - PAD.l - PAD.r, H - PAD.t - PAD.b);

    // 레인 경계 + 중앙 대시 (러닝 전용)
    const SM = this._map();
    if (!SM) {
      const half = RUN.LANE_W / 2;
      ctx.strokeStyle = 'rgba(250,48,48,0.35)'; ctx.lineWidth = 2;
      for (const lx of [-half, half]) {
        const [lpx] = this.worldToPx(lx, 0);
        ctx.beginPath(); ctx.moveTo(lpx, PAD.t); ctx.lineTo(lpx, H - PAD.b); ctx.stroke();
      }
      const [cpx] = this.worldToPx(0, 0);
      ctx.strokeStyle = this.doc.laneOn ? 'rgba(250,48,48,0.3)' : 'rgba(120,120,130,0.18)';
      ctx.setLineDash([6, 9]);
      ctx.beginPath(); ctx.moveTo(cpx, PAD.t); ctx.lineTo(cpx, H - PAD.b); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 깊이 그리드 + 라벨
    ctx.fillStyle = '#6b7180'; ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let d = Math.ceil(SM?.vMin ?? 0); d <= this._dMax; d += 1) {
      const [, gy] = this.worldToPx(0, d);
      ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(W - PAD.r, gy); ctx.stroke();
      ctx.fillText(`${d}m`, PAD.l - 6, gy);
    }

    // 기준점 (러너 / 플레이어 / 가드 높이)
    const [rx, ry] = this.worldToPx(0, SM?.wall ? 0.73 : 0);
    ctx.fillStyle = 'rgba(232,234,240,0.6)';
    ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#8b93a3';
    ctx.fillText(SM?.origin || '러너', rx, ry + 12);

    // 순서 연결선 (order 채널이 달린 마크만) — 장면 스코프에선 MARK가 없으므로 생략
    const ordered = this.extrasOnly ? [] : this.doc.marks.filter(m => m.order).sort((a, b) => a.t - b.t);
    if (ordered.length >= 2) {
      ctx.strokeStyle = 'rgba(250,48,48,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
      ordered.forEach((m, i) => {
        const [gx, gy] = this.worldToPx(this._H(m), this._V(m));
        i ? ctx.lineTo(gx, gy) : ctx.moveTo(gx, gy);
      });
      ctx.stroke();
    }

    // 장면 요소 (스테이지 GUI) — MARK와 같은 미터 좌표계 위에
    if (this.extrasOnly) {
      const all = this._extras();
      // 겹친 요소 수 집계 → 배지로 노출(안 보이면 있는 줄도 모른다)
      const stack = new Map();
      for (const it of all) {
        const [gx, gy] = this.worldToPx(it.h, it.v);
        const k = `${Math.round(gx)},${Math.round(gy)}`;
        stack.set(k, (stack.get(k) || 0) + 1);
      }
      // 선택된 요소를 마지막에 그려 위로 올린다
      for (const it of [...all].sort((a, b) => (a.sel ? 1 : 0) - (b.sel ? 1 : 0))) {
        const [gx, gy] = this.worldToPx(it.h, it.v);
        const s = it.sel;
        ctx.fillStyle = s ? 'rgba(209,254,255,0.16)' : 'rgba(254,195,137,0.10)';
        ctx.strokeStyle = s ? '#d1feff' : '#fec389';
        ctx.lineWidth = s ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(gx - 13, gy - 13, 26, 26, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = s ? '#d1feff' : '#fec389';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.glyph || '◆', gx, gy);
        if (it.label) {
          ctx.fillStyle = s ? '#e8eaf0' : '#8b93a3';
          ctx.font = '9px -apple-system, sans-serif';
          ctx.fillText(it.label.slice(0, 12), gx, gy + 22);
        }
        const n = stack.get(`${Math.round(gx)},${Math.round(gy)}`) || 1;
        if (n > 1) {   // 겹침 — 클릭하면 순환 선택된다는 신호
          ctx.beginPath(); ctx.arc(gx + 13, gy - 13, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#fa3030'; ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 9px -apple-system, sans-serif';
          ctx.fillText(String(n), gx + 13, gy - 13);
        }
      }
      ctx.fillStyle = '#6b7180'; ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(SM?.hLabel || '← 레인(m) →', (PAD.l + W - PAD.r) / 2, H - 6);
      return;
    }

    // MARK
    const pxM = this._pxPerM();
    for (const mk of this.doc.marks) {
      const [gx, gy] = this.worldToPx(this._H(mk), this._V(mk));
      const sel = mk.id === this.doc.selection;
      const rZone = Math.max(10, Math.min(48, (mk.radiusCm / 100) * pxM));  // 판정 허용창(반경)
      const col = mk.contract === 'avoid' ? '#fec389' : '#fa3030';

      // 존 원 (반경=판정창)
      ctx.beginPath(); ctx.arc(gx, gy, rZone, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,48,48,0.06)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = col;
      if (mk.contract === 'avoid') ctx.setLineDash([6, 5]); else ctx.setLineDash([]);
      ctx.stroke(); ctx.setLineDash([]);

      // holdRing (유지 채움 표본 66%)
      if (mk.contract === 'hold' || mk.holdRing) {
        ctx.beginPath();
        ctx.arc(gx, gy, rZone - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.66);
        ctx.lineWidth = 3; ctx.strokeStyle = '#d1feff'; ctx.stroke();
      }

      // 방향 채널 화살표
      if (mk.direction && mk.direction.type !== 'none') {
        const a = (mk.direction.angle || 0) * Math.PI / 180;
        const dx = Math.sin(a), dy = -Math.cos(a);   // 0°=전방(위)
        ctx.strokeStyle = '#fe6e3c'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + dx * (rZone + 14), gy + dy * (rZone + 14)); ctx.stroke();
      }

      // 중심 핸들 + 발형/번호
      ctx.beginPath(); ctx.arc(gx, gy, sel ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = sel ? '#d1feff' : col; ctx.fill();
      if (sel) { ctx.lineWidth = 2; ctx.strokeStyle = '#d1feff'; ctx.beginPath(); ctx.arc(gx, gy, rZone + 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#e8eaf0'; ctx.font = '700 10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (mk.foot) ctx.fillText(mk.foot === 'right' ? 'R' : 'L', gx, gy - rZone - 8);
      if (mk.order && mk.n) { ctx.fillStyle = '#8b93a3'; ctx.font = '9px -apple-system, sans-serif'; ctx.fillText(String(mk.n), gx + rZone + 8, gy); }
    }

    ctx.fillStyle = '#6b7180'; ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(SM?.hLabel || '← 레인(m) →', (PAD.l + W - PAD.r) / 2, H - 6);
  }
}
