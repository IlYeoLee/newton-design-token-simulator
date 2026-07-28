// 바닥 UI를 WebGL로 (B안) — floor-scene.html을 canvas 2D → CanvasTexture 평면으로 다시 그린다.
//
// 왜: CSS3DRenderer가 그리는 바닥 UI는 별도 DOM 레이어라 WebGL 깊이 버퍼를 공유하지 못해
// x봇 위로 통과한다(마스크 오버레이는 원리적 임시방편). 같은 씬의 평면이면 깊이 테스트가
// 공짜로 해결한다.
//
// 인터페이스는 기존과 동일하게 유지한다 — `doc.getElementById(id).textContent/style.…`를
// main.js 구동 코드가 그대로 쓴다(노드 = 그리기 스펙 겸 DOM 스텁). 이식 비용을 여기 한 파일에 가둔다.
import * as THREE from 'three';

const W = 1600, H = 2670;   // 대지 px (floor-scene.html과 동일)
// ponytail: 캔버스는 대지의 절반 해상도(1px = 1.46mm 실물). 텍스트가 흐리면 K만 올린다.
// 전체 해상도는 프레임당 17MB 업로드라 과하다.
const K = 0.5;

const CX = W / 2;
const RED = '#fa3030';
const sans = "'Supreme','Freesentation','Pretendard',sans-serif";
const dot9 = "'OffBit','Supreme',sans-serif";
const F = (w, s, fam = sans) => `${w} ${s}px ${fam}`;

const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

function node(id, o) {
  return Object.assign({
    id, style: {}, textContent: '', isConnected: true, _attr: {},
    setAttribute(k, v) { this._attr[k] = String(v); },
    getAttribute(k) { return this._attr[k] ?? null; },
  }, o);
}

// ── 개별 요소 그리기 ────────────────────────────────────────────────────────────
// 각 타입은 { h(n) → 높이, draw(ctx, n, y) } — 폭은 항상 중앙(CX) 정렬.

function drawText(ctx, n, y) {
  ctx.font = F(n.weight, n.size, n.fam || sans);
  ctx.fillStyle = n.style.color || n.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = (n.ls || 0) + 'px';
  ctx.fillText(n.textContent, CX, y);
  ctx.letterSpacing = '0px';
}

function ringGeom(size) {   // SVG viewBox 604 · r275 규약 → 캔버스 px
  const s = size / 604;
  return { r: 275 * s, wTrack: 6 * s, wArc: 11 * s, dash: [0.5 * s, 20.5 * s] };
}

function drawRing(ctx, n, y, prog, color) {
  const { r, wTrack, wArc, dash } = ringGeom(n.size);
  const cx = CX, cy = y + n.size / 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = wTrack;
  ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  if (prog > 0.001) {
    ctx.strokeStyle = color || '#fff'; ctx.lineWidth = wArc;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
  }
  // ponytail: 회전 팁 = timer_tip.svg 대신 같은 자리 빨간 점. 이 크기(28px)에선 실루엣이 같다.
  const a = -Math.PI / 2 + prog * Math.PI * 2;
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), n.size * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCenteredNum(ctx, text, cx, cy, size) {
  ctx.font = F(700, size, dot9);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

// ── 스테이지 → 노드 열 구성 (floor-scene.html의 <script> 분기와 1:1) ──────────────
function buildScene(stage, p) {
  const S = (window.FLOOR_SCENES || {})[stage] || { title: stage, cue: '' };
  const isP = /^P\d$/.test(stage);
  const isC = /^C[2-5]$/.test(stage);
  const hasPrev = /^(A2|A3|BK_A[23]|BK_B[12345])$/.test(stage);
  const isStep = /^BK_B[2345]$/.test(stage);
  const col = [];
  const m = /^BK_B([2345])$/.exec(stage);
  if (m) col.push(node('s-cap', { type: 'text', textContent: (+m[1] - 1) + ' / 4', size: 46, weight: 700, ls: 6, color: 'rgba(255,255,255,.62)', mb: -38 }));
  if (!isC) col.push(node('s-title', { type: 'text', textContent: S.title, size: 120, weight: 700, ls: -4, color: '#fff' }));
  col.push(node('s-cue', { type: 'text', textContent: S.cue || '', size: 52, weight: 500, color: 'rgba(255,255,255,.72)', style: { display: 'none' } }));
  if (isC) col.push(node('km', { type: 'km' }));
  if (hasPrev) col.push(node('prev-row', { type: 'prevRow', pv: p.pv || 3, pvn: p.pvn || 0 }));
  col.push(node('s-dots', { type: 'dots', dur: p.dur || 8, delay: hasPrev ? (p.pv || 3) + 0.15 : 0 }));
  if (isP) col.push(node('train-row', { type: 'trainRow', ring: /^P[23]$/.test(stage) }));
  if (isC) col.push(node('live-row', { type: 'liveRow' }));
  col.push(node('s-succ', { type: 'succ', style: { display: 'none' } }));
  return { col, hasPrev, isStep, pv: p.pv || 3 };
}

export class FloorGL {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(W * K); this.canvas.height = Math.round(H * K);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      // depthWrite:false — 반투명 UI. depthTest는 켠 채로 두는 게 이 이식의 전부다(x봇에 가려짐).
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    this.stage = null; this.map = new Map(); this.col = []; this.t = 0; this._sig = null;
    // 캔버스 fillText는 웹폰트 로드를 촉발하지 않는다 — 명시 로드 후 한 번 다시 그린다.
    for (const f of ['700 100px Supreme', '500 100px Supreme', '400 100px Supreme',
                     '700 100px OffBit', '700 100px Freesentation', '400 100px Freesentation'])
      document.fonts?.load(f).then(() => { this._sig = null; }).catch(() => {});
    this.doc = {
      getElementById: id => this.map.get(id) || null,
      querySelector: s => this.map.get(({ '.dclip': 's-dots', '#prev-ring .arc': 'prev-arc', '#prev-ring .tip': 'prev-tip' })[s] || s.replace(/^[#.]/, '')) || null,
    };
  }

  // floor-scene.html에서 다루는 스테이지인가 (그 외는 기존 CSS3D 경로 유지)
  static handles(src) { return src.includes('floor-scene.html'); }

  load(stage, params) {
    const b = buildScene(stage, params);
    this.stage = stage; this.col = b.col; this.b = b; this.t = 0; this._sig = null; this._lastPaint = -1;
    this.map.clear();
    for (const n of b.col) {
      this.map.set(n.id, n);
      for (const k of n.type === 'prevRow' ? ['prev-num', 'prev-arc', 'prev-tip', 'prev-row'] : []) if (!this.map.has(k)) this.map.set(k, node(k));
      if (n.type === 'prevRow') { this.map.set('prev-num', node('prev-num', { textContent: params.pvn ? '0/' + params.pvn : String(params.pv || 3) })); }
      if (n.type === 'succ') for (const k of ['succ-n', 'succ-arc', 'succ-dot']) this.map.set(k, node(k, { textContent: '3' }));
      if (n.type === 'trainRow' || n.type === 'liveRow') for (const k of ['spm-me', 'spm-tgt', 'tp-arc', 'tp-tip', 'tp-num', 'pace-me', 'pace-tgt'])
        this.map.set(k, node(k, { textContent: '--' }));
      if (n.type === 'km') this.map.set('km-n', node('km-n', { textContent: '0.00' }));
    }
    this.map.set('prev-row', b.col.find(n => n.type === 'prevRow') || node('prev-row'));
  }

  // 변경 없으면 다시 안 그린다 — 1600×2670 텍스처 업로드가 프레임 예산을 먹는 걸 막는다.
  _sigOf() {
    let s = String(Math.round(this.t * 20));
    for (const n of this.map.values()) s += '|' + n.textContent + JSON.stringify(n.style) + JSON.stringify(n._attr || {});
    return s;
  }

  update(dt) {
    if (!this.stage) return;
    this.t += dt;
    // 텍스처 업로드(≈4MB)는 프레임 예산을 먹는다 — 최대 22fps로 제한. 읽는 UI라 이 이상 필요 없다.
    if (this.t - (this._lastPaint ?? -1) < 0.045) return;
    const sig = this._sigOf();
    if (sig === this._sig) return;
    this._sig = sig; this._lastPaint = this.t;
    this._paint();
    this.tex.needsUpdate = true;
  }

  _paint() {
    const ctx = this.ctx;
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let y = 176;
    for (const n of this.col) {
      if (n.style.display === 'none') continue;
      const h = this._h(n);
      if (n.mt) y += n.mt;
      if (n.style.visibility !== 'hidden') {
        ctx.save();
        ctx.globalAlpha = numOr(n.style.opacity, 1) * this._intro(n);
        if (ctx.globalAlpha > 0.004) this._draw(n, y);
        ctx.restore();
      }
      y += h + 72 + (n.mb || 0);
    }
  }

  // 등장 = 제자리 페이드(원본 sUpFlat/chIn의 요지). 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다.
  _intro(n) {
    const d = { 's-cap': 0.18, 's-title': 0.1, 's-cue': 0.28, 's-dots': 0.42 }[n.id] ?? 0.2;
    return Math.max(0, Math.min(1, (this.t - d) / 0.55));
  }

  _h(n) {
    switch (n.type) {
      case 'text': return n.size * 1.06;
      case 'dots': return 60;
      case 'prevRow': return 200;
      case 'trainRow': return n.ring ? 200 : 112;
      case 'liveRow': return 112;
      case 'km': return 180;
      case 'succ': return 400;
      default: return 0;
    }
  }

  _draw(n, y) {
    const ctx = this.ctx;
    switch (n.type) {
      case 'text': return drawText(ctx, n, y);
      case 'dots': return this._dots(n, y);
      case 'prevRow': return this._prevRow(n, y);
      case 'trainRow': return this._trainRow(n, y);
      case 'liveRow': return this._liveRow(n, y);
      case 'km': return this._km(n, y);
      case 'succ': return this._succ(n, y);
    }
  }

  // 도트 프로그래스 — 회색 10개 위 빨강 10개를 좌→우 클립(러닝·농구 동일 컴포넌트)
  _dots(n, y) {
    const ctx = this.ctx, x0 = CX - 300;
    // main.js가 width를 직접 쓰면(반복형 스테이지) 그 값이 우선, 아니면 --dur 시간 진행.
    const w = n.style.width != null ? numOr(n.style.width, 0)
      : 600 * Math.max(0, Math.min(1, (this.t - n.delay) / n.dur));
    for (let i = 0; i < 10; i++) { ctx.fillStyle = '#d0d0d0'; this._pill(x0 + i * 60, y, 60, 60); }
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y, w, 60); ctx.clip();
    for (let i = 0; i < 10; i++) { ctx.fillStyle = RED; this._pill(x0 + i * 60, y, 60, 60); }
    ctx.restore();
  }

  _pill(x, y, w, h) {
    const ctx = this.ctx, r = Math.min(w, h) / 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }

  // Preview 필 + 카운트다운 링 (Figma 122:270)
  _prevRow(n, y) {
    const ctx = this.ctx;
    const arc = this.map.get('prev-arc'), tip = this.map.get('prev-tip'), num = this.map.get('prev-num');
    // main.js(스텝백)가 dashoffset을 직접 구동하면 그 값, 아니면 CSS arcFill 시간 진행.
    const prog = arc?.style.strokeDashoffset != null
      ? 1 - numOr(arc.style.strokeDashoffset, 0) / 1727.9
      : ((this.t - 0.15) / (n.pvn ? n.pv / n.pvn : n.pv)) % 1;
    const gap = 120, ringW = 200;
    ctx.font = F(700, 60); const tw = ctx.measureText('Preview').width;
    const pillW = 40 + tw + 20 + 60 + 30, pillH = 100;
    const total = pillW + gap + ringW, x0 = CX - total / 2;
    const py = y + (ringW - pillH) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; this._pill(x0, py, pillW, pillH);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Preview', x0 + 40, py + pillH / 2);
    // 화살표 →
    const ax = x0 + 40 + tw + 20, ay = py + pillH / 2;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax + 10, ay); ctx.lineTo(ax + 48, ay);
    ctx.moveTo(ax + 33, ay - 15); ctx.lineTo(ax + 48, ay); ctx.lineTo(ax + 33, ay + 15); ctx.stroke();
    const save = CX; // 링은 중앙 정렬 헬퍼를 쓰므로 잠시 위치를 옮겨 그린다
    this._ringAt(x0 + pillW + gap + ringW / 2, y, ringW, prog, '#fff');
    drawCenteredNum(ctx, num?.textContent || '', x0 + pillW + gap + ringW / 2, y + ringW / 2, n.pvn ? 62 : 96);
    void save;
  }

  _ringAt(cx, y, size, prog, color) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(cx - CX, 0);
    drawRing(ctx, { size }, y, Math.max(0, Math.min(1, prog)), color);
    ctx.restore();
  }

  // 케이던스 컴포넌트 — "150 / 150" + 라벨
  _lstat(cx, y, me, tgt, label) {
    const ctx = this.ctx;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.font = F(700, 60);
    const a = me || '--', b = tgt || '--';
    const wa = ctx.measureText(a).width, wSlash = ctx.measureText(' / ').width;
    const wb = ctx.measureText(b).width, tot = wa + wSlash + 36 + wb;
    let x = cx - tot / 2;
    ctx.textAlign = 'left'; ctx.fillStyle = this.map.get('spm-me')?.style.color || '#fff';
    ctx.fillText(a, x, y + 60); x += wa + 18;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = F(400, 60);
    ctx.fillText('/', x, y + 60); x += wSlash + 18;
    ctx.fillText(b, x, y + 60);
    ctx.font = F(400, 40); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(label, cx, y + 112);
  }

  _trainRow(n, y) {
    const me = this.map.get('spm-me')?.textContent, tgt = this.map.get('spm-tgt')?.textContent;
    if (!n.ring) return this._lstat(CX, y, me, tgt, 'SPM');
    const gap = 110, statW = 300, total = statW + gap + 200, x0 = CX - total / 2;
    this._lstat(x0 + statW / 2, y + 44, me, tgt, 'SPM');
    const arc = this.map.get('tp-arc');
    const prog = 1 - numOr(arc?.style.strokeDashoffset, 1727.9) / 1727.9;
    this._ringAt(x0 + statW + gap + 100, y, 200, prog, arc?.getAttribute('stroke') || '#fff');
    drawCenteredNum(this.ctx, this.map.get('tp-num')?.textContent || '—', x0 + statW + gap + 100, y + 100, 96);
  }

  _liveRow(n, y) {
    const g = id => this.map.get(id)?.textContent;
    this._lstat(CX - 180, y, g('spm-me'), g('spm-tgt'), 'SPM');
    this._lstat(CX + 180, y, g('pace-me'), g('pace-tgt'), 'Pace');
  }

  _km(n, y) {
    const ctx = this.ctx;
    ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = F(700, 180, dot9);
    const v = this.map.get('km-n')?.textContent || '0.00';
    const wv = ctx.measureText(v).width;
    ctx.font = F(400, 180, dot9); const wu = ctx.measureText('km').width;
    const x0 = CX - (wv + wu) / 2;
    ctx.textAlign = 'left'; ctx.font = F(700, 180, dot9); ctx.fillText(v, x0, y);
    ctx.font = F(400, 180, dot9); ctx.fillText('km', x0 + wv, y);
  }

  // Success 컴포넌트(Figma 130-2984) — 배지 + 점선 카운트다운 링
  _succ(n, y) {
    const ctx = this.ctx;
    ctx.font = F(700, 52, dot9);
    const t = 'Success!', tw = ctx.measureText(t).width + 44 + 40 + 80;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; this._pill(CX - tw / 2, y, tw, 88);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#525252';
    ctx.font = '44px sans-serif'; ctx.fillText('🔥', CX - tw / 2 + 40, y + 44);
    ctx.font = F(700, 52, dot9); ctx.fillText(t, CX - tw / 2 + 40 + 44 + 14, y + 44);
    const arc = this.map.get('succ-arc');
    const frac = numOr(arc?.style.strokeDashoffset, 0) / 615.7;   // 원본은 offset이 곧 남은 비율
    const ry = y + 88 + 56;
    this._ringAt(CX, ry, 220, frac, '#fff');
    drawCenteredNum(ctx, this.map.get('succ-n')?.textContent || '', CX, ry + 110, 88);
  }
}
