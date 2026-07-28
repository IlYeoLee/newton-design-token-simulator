// 바닥 UI를 WebGL로 (B안) — floor-*.html 전부를 canvas 2D → CanvasTexture 평면으로 다시 그린다.
//
// 왜: CSS3DRenderer가 그리는 바닥 UI는 별도 DOM 레이어라 WebGL 깊이 버퍼를 공유하지 못해
// x봇 위로 통과한다(마스크 오버레이는 원리적 임시방편). 같은 씬의 평면이면 깊이 테스트가
// 공짜로 해결한다.
//
// 인터페이스는 기존과 동일하게 유지한다 — `doc.getElementById(id).textContent/style.…`를
// main.js 구동 코드가 그대로 쓴다(노드 = 그리기 스펙 겸 DOM 스텁). 이식 비용을 여기 한 파일에 가둔다.
import * as THREE from 'three';
import { PAL, NEU, rgba } from './palette.js';
import { T, R, sp, zone, NUM_S } from './ds.js';   // 조판 토큰 — 타이포·반경·간격·존

const W = 1600, H = 2670;   // 대지 px (floor-scene.html과 동일)
// 캔버스 해상도 — 화질과 업로드 비용의 저울.
//   0.5 = 글자가 흐리다(유저) / 1.0 = 프레임당 17MB 업로드라 전체가 느려진다(유저).
//   0.75(1200×2002, 9.6MB)가 두 불만을 모두 피하는 지점. 업로드는 값이 바뀐 프레임에만 일어난다.
const K = 0.75;
// UI 재도색 주기. 모션을 이식한 뒤로 정지 화면이 없어져 매 틱 9.4~9.6MB 텍스처가 올라간다
// (24fps = 230MB/s). 씬 애니메이션이 '드드드득' 끊긴 원인 — UI 프레임을 씬보다 낮게 잡고
// 남는 예산을 봇·영상에 돌려준다. ?uifps=N 으로 8~60 비교 가능.
const UI_FPS = Math.max(4, Math.min(60, +(new URLSearchParams(location.search).get('uifps')) || 12));

const CX = W / 2;
const RED = PAL.red;
// 투사 UI 서체 규칙(유저 확정): Supreme 두 굵기만 — Bold 700 · Regular 400.
// Freesentation·Pretendard 폴백은 은퇴(투사 UI는 영문 조판이고, 폴백이 끼면 자간이 달라진다).
const sans = "'Supreme',sans-serif";
// 수치 전용 페이스. 이걸 sans 로 바꾸면 문서 전체가 Supreme 2종만 남는다(유저가 원하면 한 줄).
const dot9 = "'OffBit','Supreme',sans-serif";
const F = (w, s, fam = sans) => `${w} ${s}px ${fam}`;

const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

// ── 모션 ────────────────────────────────────────────────────────────────────
// 원본 floor-*.html의 @keyframes를 캔버스로 옮기기 위한 최소 도구.
// CSS는 타이밍 함수를 '키프레임 구간마다' 적용한다 — kf()도 그렇게 한다.
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const eOut = t => 1 - Math.pow(1 - t, 3);                           // cubic-bezier(.22,1,.36,1) 근사
export const eInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// `animation: X dur delay n` 의 진행도(0~1). 구간 밖이면 null(= 정적 스타일). n=Infinity면 무한 반복.
export const cycle = (t, delay, dur, n) => { const u = t - delay; return u < 0 || u >= dur * n ? null : (u % dur) / dur; };
// @keyframes 보간 — stops = [[0~1 위치, 값], …]
export const kf = (p, stops, ease = eInOut) => {
  for (let i = 1; i < stops.length; i++) {
    const [a, va] = stops[i - 1], [b, vb] = stops[i];
    if (p <= b) return va + (vb - va) * ease(b === a ? 1 : (p - a) / (b - a));
  }
  return stops[stops.length - 1][1];
};
// `both` fill 등장 애니메이션의 선형 진행도
export const intro = (t, delay, dur) => clamp01((t - delay) / dur);

// 글자별 그리기 — fn(i) → {dy, alpha, scale}. charLoop·charWave·chIn 공통.
// align: 'center'(cx=중앙) | 'right'(cx=오른쪽 끝) | 'left'
export function drawChars(ctx, txt, cx, y, h, ls, fn, align = 'center') {
  ctx.letterSpacing = (ls || 0) + 'px';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const total = ctx.measureText(txt).width;
  let x = align === 'center' ? cx - total / 2 : align === 'right' ? cx - total : cx, vis = 0;
  for (const ch of txt) {
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') {
      const a = fn(vis++);
      if (a.alpha > 0.004) {
        ctx.save();
        ctx.globalAlpha *= a.alpha;
        ctx.translate(x + w / 2, y + h / 2 + (a.dy || 0));
        if (a.scale !== 1) ctx.scale(a.scale, a.scale);
        ctx.fillText(ch, -w / 2, -h / 2);
        ctx.restore();
      }
    }
    x += w;
  }
  ctx.letterSpacing = '0px';
}

// ── 나머지 문서(시작화면·전환·카운트다운·리포트) 데이터 — 각 HTML의 상수를 그대로 옮긴 것 ──
const READY = {
  'floor.html':    { title: "Sean's Final 1km Pace", mode: 'Pace & Boost On', modeSm: true },
  'floor-bk.html': { title: "Curry's Handle Pack",   mode: 'Press On' },
};
const TR = {
  T1: { sub: 'Sean’s Final 1km Pace', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'run/run_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'run/run_learn.png' } },
  T2: { sub: 'Sean’s Final 1km Pace', title: 'Learning Complete!',
    done: { lbl: 'Learn', time: '10min', img: 'run/run_learn.png' },
    next: { lbl: 'Run!', time: '10min', img: 'run/run_run.png' } },
  BK_T1: { sub: 'Curry’s Signature Move', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'bk/bk_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'bk/bk_learn.png' } },
  BK_T2: { sub: 'Curry’s Signature Move', title: 'Learning Complete!',
    done: { lbl: 'Learn', time: '10min', img: 'bk/bk_learn.png' },
    next: { lbl: 'Play!', time: '10min', img: 'bk/bk_play.png' } },
};
const TM = { C1: { sub: 'Sean’s Final 1km Pace', title: 'Session Complete' },
             BK_C1: { sub: 'Curry’s Signature Move', title: 'Session Complete' } };
const RP = {
  FIN: { sub: 'Sean’s Final 1km Pace', title: 'Session Complete',
    stats: [['Distance', '1.00 km'], ['Avg Pace', '5’42”'], ['Cadence', '174 spm']] },
  BK_FIN: { sub: 'Curry Step-Back Pack', title: 'Step-Back Locked In',
    stats: [['Step-Back 3PT', '2 / 3'], ['Step Accuracy', '86 %'], ['Release', '0.42 s', 'sm']] },
};
const BTN = 'Tap X2 For Retry!';

function node(id, o) {
  return Object.assign({
    id, style: {}, textContent: '', isConnected: true, _attr: {},
    setAttribute(k, v) { this._attr[k] = String(v); },
    getAttribute(k) { return this._attr[k] ?? null; },
  }, o);
}

// ── 개별 요소 그리기 ────────────────────────────────────────────────────────────
// 각 타입은 { h(n) → 높이, draw(ctx, n, y) } — 폭은 항상 중앙(CX) 정렬.

function drawText(ctx, n, y, t) {
  ctx.font = F(n.weight, n.size, n.fam || sans);
  ctx.fillStyle = n.style.color || n.color;
  ctx.textBaseline = 'top';
  ctx.letterSpacing = (n.ls || 0) + 'px';
  const txt = n.textContent || '';
  // 타이틀만 글자 캐스케이드(원본 chIn: 좌→우로 하나씩 제자리 스케일+페이드)
  if (n.cascade && t != null && t < 2.2 && txt) {
    drawChars(ctx, txt, CX, y, n.size, n.ls || 0, i => {
      const e = eOut(clamp01((t - (0.10 + i * 0.045)) / 0.6));
      return { dy: 0, alpha: e, scale: 0.82 + 0.18 * e };
    });
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(txt, CX, y);
  }
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
  if (!isC) col.push(node('s-title', { type: 'text', textContent: S.title, size: 120, weight: 700, ls: -4, color: '#fff', cascade: true }));
  col.push(node('s-cue', { type: 'text', textContent: S.cue || '', size: 52, weight: 400, color: 'rgba(255,255,255,.72)', style: { display: 'none' } }));
  if (isC) col.push(node('km', { type: 'km' }));
  if (hasPrev) col.push(node('prev-row', { type: 'prevRow', pv: p.pv || 3, pvn: p.pvn || 0 }));
  col.push(node('s-dots', { type: 'dots', dur: p.dur || 8, delay: hasPrev ? (p.pv || 3) + 0.15 : 0 }));
  if (isP) col.push(node('train-row', { type: 'trainRow', ring: /^P[23]$/.test(stage) }));
  if (isC) col.push(node('live-row', { type: 'liveRow' }));
  col.push(node('s-succ', { type: 'succ', style: { display: 'none' } }));
  return { col, hasPrev, isStep, pv: p.pv || 3 };
}

export class FloorGL {
  static uploads = 0;
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
    for (const f of ['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'])
      document.fonts?.load(f).then(() => { this._sig = null; }).catch(() => {});
    this.doc = {
      getElementById: id => this.map.get(id) || null,
      querySelector: s => this.map.get(({ '.dclip': 's-dots', '#prev-ring .arc': 'prev-arc', '#prev-ring .tip': 'prev-tip' })[s] || s.replace(/^[#.]/, '')) || null,
    };
  }

  // 모든 바닥 문서를 이 경로가 담당한다(CSS3D 바닥 프레임은 남은 게 없다)
  static handles(src) { return /floor(-scene|-transition|-timer|-report|-bk)?\.html/.test(src); }

  /** 이 UI가 쓰는 이미지 전부 — 진입 전에 미리 굽는다.
   *  예전엔 첫 _paint 가 로드를 촉발해서 진입 직후 몇 프레임이 이미지 없이 그려지고 툭 나타났다
   *  (유저: 첫 화면 인터랙션 딜레이 — 화면 녹화에선 그대로 찍힌다). */
  static ASSETS = ['bg_glow.svg', 'fig/big_glow.svg', 'run/arrow.svg', 'run/foot.svg',
    // 데이터에서 오는 것들(_img 리터럴이 아니라 TR/READY 테이블) — 빠뜨리면 카드가 늦게 뜬다
    'run/ic_glasses.png', 'run/ic_watch.png', 'run/ic_earbuds.png',
    'run/run_stretch.png', 'run/run_learn.png', 'run/run_run.png',
    'bk/bk_stretch.png', 'bk/bk_learn.png', 'bk/bk_play.png'];
  preload() { for (const a of FloorGL.ASSETS) this._img(a); }

  // 이미지(글로우·아이콘·인물 카드) — 로드되면 한 번 다시 그린다
  _img(rel) {
    this._imgs = this._imgs || new Map();
    let im = this._imgs.get(rel);
    if (!im) {
      im = new Image();
      im.onload = () => { this._sig = null; };
      im.src = (import.meta.env?.BASE_URL || '/') + 'ready-view/assets/' + rel;
      this._imgs.set(rel, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  load(stage, params) {
    this.kind = /floor-transition/.test(params.src) ? 'transition'
      : /floor-timer/.test(params.src) ? 'timer'
      : /floor-report/.test(params.src) ? 'report'
      : /floor(-bk)?\.html/.test(params.src) ? 'ready' : 'scene';
    this.params = params;
    this._numLast = null; this._numT = 0;   // numPulse(카운트다운 숫자) 상태
    if (this.kind !== 'scene') {
      this.stage = stage; this.col = []; this.map.clear();
      this.t = 0; this._sig = null; this._lastPaint = -1;
      return;
    }
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
    let s = String(Math.round(this.t * 24));
    for (const n of this.map.values()) s += '|' + n.textContent + JSON.stringify(n.style) + JSON.stringify(n._attr || {});
    return s;
  }

  update(dt) {
    if (!this.stage) return;
    this.t += dt;
    // 24fps — 22fps는 끊겨 보였고 60fps는 업로드(9.6MB/장)가 프레임 예산을 먹었다(유저 양쪽 신고).
    // 값이 안 바뀌면 아래 서명 비교에서 또 걸러지므로 정지 화면은 업로드 0이다(실측 0.9회/초).
    // ponytail: 진짜 해법은 정적 텍스트와 움직이는 요소(도트·링)를 별도 평면으로 쪼개는 것 —
    //   그러면 매 프레임 올리는 텍스처가 수백 KB로 떨어진다. HANDOFF에 계획으로 남김.
    if (this.t - (this._lastPaint ?? -1) < 1 / UI_FPS) return;
    const sig = this._sigOf();
    if (sig === this._sig) return;
    this._sig = sig; this._lastPaint = this.t;
    FloorGL.uploads++;   // 계측용 — 실제 텍스처 업로드 횟수
    this._paint();
    this.tex.needsUpdate = true;
  }

  _paint() {
    const ctx = this.ctx;
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (this.kind && this.kind !== 'scene') return this['_paint_' + this.kind]();
    let y = zone('title', H);   // 존 — 타이틀 밴드 (구 176)
    for (const n of this.col) {
      if (n.style.display === 'none') continue;
      const h = this._h(n);
      if (n.mt) y += n.mt;
      if (n.style.visibility !== 'hidden') {
        const e = this._intro(n);
        ctx.save();
        ctx.globalAlpha = numOr(n.style.opacity, 1) * e * this._outro(n);
        if (e < 1 && !n.cascade) {   // 제자리 스케일 인(원본 sUpFlat) — 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다
          const k = 0.94 + 0.06 * e;
          ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2));
        }
        if (ctx.globalAlpha > 0.004) this._draw(n, y);
        ctx.restore();
      }
      y += h + sp('s5', 'run') + (n.mb || 0);
    }
  }

  // 등장 = 제자리 페이드(원본 sUpFlat/chIn의 요지). 눕힌 프레임에서 translate는 '멀리서 날아옴'이 된다.
  _intro(n) {
    const d = { 's-cap': 0.18, 's-title': 0.1, 's-cue': 0.28, 's-dots': 0.42 }[n.id] ?? 0.2;
    return Math.max(0, Math.min(1, (this.t - d) / 0.55));
  }

  // 프리뷰 행은 시범이 끝나면 사라진다(원본 demoOutFlat .45s @ --pvOut = pv + 0.05)
  _outro(n) {
    return n.type === 'prevRow' ? 1 - clamp01((this.t - (n.pv + 0.05)) / 0.45) : 1;
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
      case 'text': return drawText(ctx, n, y, this.t);
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
    for (let i = 0; i < 10; i++) { ctx.fillStyle = NEU.lo; this._pill(x0 + i * 60, y, 60, 60); }
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
    ctx.font = F(700, T.head); const tw = ctx.measureText('Preview').width;
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
    ctx.font = F(700, T.head);
    const a = me || '--', b = tgt || '--';
    const wa = ctx.measureText(a).width, wSlash = ctx.measureText(' / ').width;
    const wb = ctx.measureText(b).width, tot = wa + wSlash + 36 + wb;
    let x = cx - tot / 2;
    ctx.textAlign = 'left'; ctx.fillStyle = this.map.get('spm-me')?.style.color || '#fff';
    ctx.fillText(a, x, y + 60); x += wa + 18;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = F(400, T.head);
    ctx.fillText('/', x, y + 60); x += wSlash + 18;
    ctx.fillText(b, x, y + 60);
    ctx.font = F(400, T.body); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.6)';
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
    ctx.font = F(700, NUM_S.lg.run, dot9);
    const v = this.map.get('km-n')?.textContent || '0.00';
    const wv = ctx.measureText(v).width;
    ctx.font = F(400, NUM_S.lg.run, dot9); const wu = ctx.measureText('km').width;
    const x0 = CX - (wv + wu) / 2;
    ctx.textAlign = 'left'; ctx.font = F(700, NUM_S.lg.run, dot9); ctx.fillText(v, x0, y);
    ctx.font = F(400, NUM_S.lg.run, dot9); ctx.fillText('km', x0 + wv, y);
  }

  // ── 공통 조각 ───────────────────────────────────────────────────────────────
  // 빔 글로우 — 원본은 radial 마스크로 사각 모서리를 잘라낸다. 그린 뒤 같은 마스크를 destination-out으로.
  _bgGlow(topY, w = 2200) {
    const ctx = this.ctx, im = this._img('bg_glow.svg');
    if (!im) return;
    const h = w * (im.naturalHeight / im.naturalWidth);
    ctx.save();
    // glowDrift 15s ×3 — 원본 translate는 자기 크기의 %라 그대로 환산
    const p = cycle(this.t, 0, 15, 3);
    if (p != null) {
      const dx = kf(p, [[0, 0], [.25, -.06], [.5, .06], [.75, -.03], [1, 0]]) * w;
      const dy = kf(p, [[0, 0], [.25, .04], [.5, -.05], [.75, .04], [1, 0]]) * h;
      const s = kf(p, [[0, 1], [.25, 1.12], [.5, 1.05], [.75, 1.13], [1, 1]]);
      const r = kf(p, [[0, 0], [.25, 4], [.5, -3], [.75, 3], [1, 0]]) * Math.PI / 180;
      ctx.translate(CX + dx, topY + dy); ctx.rotate(r); ctx.scale(s, s); ctx.translate(-CX, -topY);
    }
    ctx.drawImage(im, CX - w / 2, topY - h / 2, w, h);
    ctx.restore();
    ctx.save();
    const g = ctx.createRadialGradient(CX, H * 0.43, 0, CX, H * 0.43, W * 0.58);
    g.addColorStop(0.22, 'rgba(0,0,0,0)'); g.addColorStop(0.82, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 서브타이틀 + 큰 타이틀 (전환·타이머·리포트 공통 그룹). 반환 = 그룹 아래 y
  _titleGroup(y, sub, ttl) {
    const ctx = this.ctx, t = this.t;
    const ty = y + 64 * 1.2 + 8.8, gh = 64 * 1.2 + 8.8 + 140 * 1.05;
    const p = eOut(intro(t, 0.1, 0.8));   // titleIn .8s .1s — 제자리 scale+fade
    ctx.save();
    ctx.globalAlpha *= kf(p, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(p, [[0, .9], [.7, 1.02], [1, 1]]);
    ctx.translate(CX, y + gh / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + gh / 2));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = F(400, T.head); ctx.letterSpacing = '-4.6px';
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(sub, CX, y);
    ctx.font = F(700, T.display); ctx.fillStyle = '#fff';
    // charWave 2.4s ×3, 글자마다 .05s 지연
    drawChars(ctx, ttl, CX, ty, 140, -5.6, i => {
      const c = cycle(t, 0.9 + i * 0.05, 2.4, 3);
      return { dy: c == null ? 0 : kf(c, [[0, 0], [.29, -16], [.58, 0], [1, 0]]), alpha: 1, scale: 1 };
    });
    ctx.letterSpacing = '0px';
    ctx.restore();
    return ty + 140 * 1.05;
  }

  // 흰 pill 버튼 (전환·리포트 공통). e=등장 진행도 · dy=떠오름 · glow=펄스 세기
  _button(y, text, e = 1, dy = 0, glow = 0) {
    const ctx = this.ctx, w = 802, h = 80 * 1.2 + 42.614 * 2;
    ctx.save();
    ctx.globalAlpha *= e;
    ctx.translate(0, dy);
    if (e < 1) { const k = 0.92 + 0.08 * e; ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2)); }
    if (glow > 0.002) { ctx.shadowColor = `rgba(255,255,255,${0.35 * glow})`; ctx.shadowBlur = 60 * glow; }
    ctx.fillStyle = '#fff'; this._pill(CX - w / 2, y, w, h);
    ctx.shadowBlur = 0;
    ctx.font = F(700, T.title); ctx.letterSpacing = '-1.33px';
    ctx.fillStyle = NEU.inkDark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, CX, y + h / 2);
    ctx.letterSpacing = '0px';
    ctx.restore();
    return y + h;
  }

  // object-fit:cover 로 이미지를 사각형에 채운다
  _cover(im, x, y, w, h, oy = 0.08) {
    const ctx = this.ctx, r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * r, dh = im.naturalHeight * r;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) * oy, dw, dh);
  }

  _roundRectPath(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, r); }

  // ── 시작화면 (floor.html / floor-bk.html) ──────────────────────────────────
  _paint_ready() {
    const ctx = this.ctx, D = READY[/floor-bk/.test(this.params.src) ? 'floor-bk.html' : 'floor.html'], t = this.t;
    // glowLive 7s ×3 — 숨쉬기 + 드리프트
    const gl = this._img('fig/big_glow.svg');
    if (gl) {
      const g = cycle(t, 0, 7, 3);
      ctx.save();
      ctx.globalAlpha = g == null ? 0.85 : kf(g, [[0, .85], [.5, 1], [1, .85]]);
      if (g != null) {
        const s = kf(g, [[0, 1], [.5, 1.06], [1, 1]]);
        ctx.translate(CX + kf(g, [[0, 0], [.5, -16], [1, 0]]), 1400 + kf(g, [[0, 0], [.5, 10], [1, 0]]));
        ctx.scale(s, s); ctx.translate(-CX, -1400);
      }
      ctx.drawImage(gl, CX - 510, 1400 - 465, 1020, 930);
      ctx.restore();
    }
    // 타이틀 글자 웨이브 — charLoop 3s ×3, 글자마다 .09s 지연
    ctx.fillStyle = '#fff'; ctx.font = F(700, T.display);
    drawChars(ctx, D.title, CX, zone('title', H), T.display, -4, i => {
      const p = cycle(t, i * 0.09, 3, 3);
      return p == null ? { dy: 0, alpha: 1, scale: 1 } : {
        dy: kf(p, [[0, 0], [.12, -16], [.26, 0], [.58, 0], [1, 0]]),
        alpha: kf(p, [[0, .5], [.12, 1], [.26, 1], [.58, .5], [1, .5]]), scale: 1,
      };
    });
    // 3칸 정보 스트립 — fadeUpCentered .8s .35s (눕힌 프레임이라 translateY 대신 제자리 scale)
    ctx.save(); this._fadeIn(452, 130, eOut(intro(t, .35, .8)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    // ponytail: 원본 flex 폭을 고정폭으로 근사(좌우 400 · 가운데 360)
    const cols = [['Time', '30min', false], ['Connection', 'Good', false], ['Mode', D.mode, D.modeSm]];
    const w = [400, 360, 400], x0 = CX - (w[0] + w[1] + w[2] + 4) / 2;
    let x = x0;
    cols.forEach((c, i) => {
      if (i) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, 452 + 21, 2, 100); x += 2; }
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = F(400, T.body);
      ctx.fillText(c[0], x + w[i] / 2, 452 + 14);
      ctx.fillStyle = '#fff'; ctx.font = F(700, c[2] ? 52 : 64); ctx.letterSpacing = '-2px';
      ctx.fillText(c[1], x + w[i] / 2, 452 + 14 + 48 + 14);
      ctx.letterSpacing = '0px';
      x += w[i];
    });
    ctx.restore();
    // 디바이스 배터리 링 3개 (200×200, gap 28) — fadeUpCentered .8s .5s
    ctx.save(); this._fadeIn(654, 200, eOut(intro(t, .5, .8)));
    const devs = [[0.9, 'run/ic_glasses.png', 96], [0.3, 'run/ic_watch.png', 56], [0.6, 'run/ic_earbuds.png', 82]];
    const dx0 = CX - (200 * 3 + 28 * 2) / 2;
    devs.forEach(([pct, ic, iw], i) => {
      const cx = dx0 + i * 228 + 100, cy = 654 + 100, r = 76 * (200 / 170), lw = 13 * (200 / 170);
      ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const f = Math.max(0, Math.min(1, (t - (0.9 + i * 0.16)) / 1.5)) * pct;
      if (f > 0.002) { ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
      const im = this._img(ic);
      if (im) { const ih = iw * (im.naturalHeight / im.naturalWidth); ctx.drawImage(im, cx - iw / 2, cy - ih / 2, iw, ih); }
    });
    ctx.restore();
    // hero — fadeUpCentered .9s .7s. 발·화살표는 이미 바닥에 붙은 요소라 탭은 원본대로 translate.
    ctx.save(); this._fadeIn(1057, 622, eOut(intro(t, .7, .9)));
    const bob = cycle(t, 1.5, 3, 3);
    const foot = this._img('run/foot.svg');
    const fdy = bob == null ? 0 : kf(bob, [[0, 0], [.12, 46], [.25, 6], [.4, 44], [.52, 0], [.58, 0], [1, 0]]);
    if (foot) ctx.drawImage(foot, 606, 1140 + fdy, 400, 539);
    const ar = this._img('run/arrow.svg');
    const ady = bob == null ? 0 : kf(bob, [[0, 0], [.12, 14], [.25, 0], [.4, 13], [.52, 0], [.58, 0], [1, 0]]);
    if (ar) ctx.drawImage(ar, CX - 43, 1057 + ady, 86, 86);
    ctx.fillStyle = '#fff'; ctx.font = F(700, T.title); ctx.letterSpacing = '-5px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Tap your foot Twice', CX, 1057 + 86 + 30);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  // 제자리 scale+fade 등장 — 호출자가 save()한 상태에서 부른다
  _fadeIn(y, h, e) {
    const ctx = this.ctx;
    ctx.globalAlpha *= e;
    const k = 0.94 + 0.06 * e;
    ctx.translate(CX, y + h / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + h / 2));
  }

  // ── 전환 (floor-transition.html) ───────────────────────────────────────────
  _paint_transition() {
    const ctx = this.ctx, TR_ = TR[this.stage] || TR.T1, t = this.t;
    this._bgGlow(1160);
    this._titleGroup(zone('title', H), TR_.sub, TR_.title);
    const S = 654.902, GAP = sp('s3', 'run'), P = 52.392, y = zone('graphic', H);
    const x0 = CX - (S * 2 + GAP) / 2;
    // cardIn .8s (.38/.54) + cardFloat 4s/4.4s ×3 — 카드는 이미 바닥에 붙어 있어 '떠오름'은 원본대로 translate
    const card = (x, d, fd, fdur, D, done) => {
      const e = eOut(intro(t, d, 0.8)), c = cycle(t, fd, fdur, 3);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, c == null ? 0 : kf(c, [[0, 0], [.5, -13], [1, 0]]));
      const k = 0.9 + 0.1 * e;
      ctx.translate(x + S / 2, y + S / 2); ctx.scale(k, k); ctx.translate(-(x + S / 2), -(y + S / 2));
      this._card(x, y, S, R.lg, P, D, done);
      ctx.restore();
    };
    card(x0, 0.38, 1.5, 4, TR_.done, true);
    card(x0 + S + GAP, 0.54, 1.85, 4.4, TR_.next, false);
    // sUpC .8s .95s + btnFloatC 3.6s 1.9s ×3 + btnPulse 3s 1.9s ×3
    const bf = cycle(t, 1.9, 3.6, 3), bp = cycle(t, 1.9, 3, 3);
    this._button(zone('action', H), BTN, eOut(intro(t, .95, .8)),
      bf == null ? 0 : kf(bf, [[0, 0], [.5, -18], [1, 0]]),
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }

  _card(x, y, S, R, P, D, done) {
    const ctx = this.ctx;
    ctx.save();
    this._roundRectPath(x, y, S, S, R); ctx.clip();
    if (done) {
      const g = ctx.createLinearGradient(0, y, 0, y + S);
      g.addColorStop(0.48, PAL.red); g.addColorStop(0.776, PAL.coral); g.addColorStop(1, PAL.sand);
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, S, S);
    const im = this._img(D.img);
    // plus-lighter는 완료 카드(빨강 배경 위)만 — 다음 카드는 흰 배경이라 lighter면 인물이 통째로 날아간다.
    if (im) { ctx.save(); if (done) ctx.globalCompositeOperation = 'lighter'; this._cover(im, x, y, S, S); ctx.restore(); }
    if (!done) {   // 다음 카드 = 인물 위에 빨강→주황 틴트
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createLinearGradient(0, y, 0, y + S);
      g2.addColorStop(0, PAL.red); g2.addColorStop(1, PAL.coral);
      ctx.fillStyle = g2; ctx.fillRect(x, y, S, S); ctx.restore();
    } else {       // 완료 카드 = 흰 내부 글로우(원본 inset box-shadow 근사)
      ctx.save(); ctx.lineWidth = 40; ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.filter = 'blur(26px)'; this._roundRectPath(x, y, S, S, R); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // 우상단 배지 — sPop .6s (.95/1.0) 로 튀어나온다
    const sp = eOut(intro(this.t, done ? 0.95 : 1.0, 0.6));
    ctx.save();
    ctx.globalAlpha *= kf(sp, [[0, 0], [.6, 1], [1, 1]]);
    const spk = kf(sp, [[0, .5], [.6, 1.12], [1, 1]]);
    if (done) {
      const c = x + S - P - 45.8, cy = y + P + 45.8;
      ctx.translate(c, cy); ctx.scale(spk, spk); ctx.translate(-c, -cy);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(c, cy, 45.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 7.5; ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(c - 19, cy + 1); ctx.lineTo(c - 6, cy + 14); ctx.lineTo(c + 19, cy - 14); ctx.stroke();
    } else {
      ctx.font = F(400, T.sub); const bw = ctx.measureText('Next').width + 52.4, bh = 52 * 1.2 + 26.2;
      const bx = x + S - P - bw / 2, by = y + P + bh / 2;
      ctx.translate(bx, by); ctx.scale(spk, spk); ctx.translate(-bx, -by);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; this._pill(x + S - P - bw, y + P, bw, bh);
      ctx.fillStyle = NEU.t3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Next', bx, by);
    }
    ctx.restore();
    // 좌하단 메타
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = done ? NEU.paper : NEU.t2; ctx.font = F(400, T.label); ctx.letterSpacing = '-1.64px';
    ctx.fillText(D.time, x + P, y + S - P);
    ctx.fillStyle = done ? '#fff' : NEU.inkDark; ctx.font = F(700, T.head); ctx.letterSpacing = '-3.27px';
    ctx.fillText(D.lbl.toUpperCase(), x + P, y + S - P - 36 * 1.2 - 13.1);
    ctx.letterSpacing = '0px';
  }

  // ── 실전 직전 카운트다운 (floor-timer.html) ────────────────────────────────
  _paint_timer() {
    const ctx = this.ctx, M = TM[this.stage] || TM.C1, dur = this.params.dur || 3, t = this.t;
    this._bgGlow(1160);
    this._titleGroup(zone('title', H), M.sub, M.title);
    const y = zone('graphic', H);
    const cy = y + 302, rem = dur - t, txt = rem > 0.05 ? String(Math.ceil(rem)) : 'GO';
    // ringPop .8s .35s + ringBreath 3s 1.2s ×3
    const e = eOut(intro(t, .35, .8)), br = cycle(t, 1.2, 3, 3);
    ctx.save();
    ctx.globalAlpha *= kf(e, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(e, [[0, .6], [.7, 1.05], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(k, k); ctx.translate(-CX, -cy);
    if (br != null) {
      const g = kf(br, [[0, 0], [.5, 1], [1, 0]]);
      ctx.shadowColor = `rgba(255,255,255,${.35 * g})`; ctx.shadowBlur = 26 * g;
    }
    drawRing(ctx, { size: 604 }, y, clamp01(t / dur), '#fff');
    ctx.shadowBlur = 0;
    // numPulse — 숫자가 바뀔 때마다 .5s
    if (txt !== this._numLast) { this._numLast = txt; this._numT = t; }
    const q = clamp01((t - this._numT) / 0.5), nk = kf(q, [[0, 1.5], [1, 1]], eOut);
    ctx.save();
    ctx.globalAlpha *= kf(q, [[0, 0], [.35, 1], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(nk, nk); ctx.translate(-CX, -cy);
    drawCenteredNum(ctx, txt, CX, cy, 220);
    ctx.restore();
    ctx.restore();
  }

  // ── 세션 리포트 (floor-report.html) ────────────────────────────────────────
  _paint_report() {
    const ctx = this.ctx, RP_ = RP[this.stage] || RP.FIN, t = this.t;
    this._bgGlow(1080);
    this._titleGroup(zone('title', H), RP_.sub, RP_.title);
    let y = zone('graphic', H);
    // 100% 링 (0.5s 뒤 1.4s 동안 채움)
    const p = clamp01((t - 0.5) / 1.4), e = eOut(p);
    const cy = y + 250, r = 230;
    // ringPop .8s .35s + ringBreath 3.4s 1.4s ×3
    const rp = eOut(intro(t, .35, .8)), br = cycle(t, 1.4, 3.4, 3);
    ctx.save();
    ctx.globalAlpha *= kf(rp, [[0, 0], [.7, 1], [1, 1]]);
    const rk = kf(rp, [[0, .6], [.7, 1.05], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(rk, rk); ctx.translate(-CX, -cy);
    if (br != null) {
      const g = kf(br, [[0, 0], [.5, 1], [1, 0]]);
      ctx.shadowColor = `rgba(255,255,255,${.45 * g})`; ctx.shadowBlur = 26 * g;
    }
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.arc(CX, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (e > 0.002) { ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(CX, cy, r, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.font = F(700, NUM_S.md); const nTxt = String(Math.round(100 * e));
    const nw = ctx.measureText(nTxt).width;
    ctx.font = F(700, NUM_S.sm); const sw = ctx.measureText('%').width;
    ctx.textAlign = 'left';
    ctx.font = F(700, NUM_S.md); ctx.fillText(nTxt, CX - (nw + sw + 8) / 2, cy);
    ctx.font = F(700, NUM_S.sm); ctx.fillText('%', CX - (nw + sw + 8) / 2 + nw + 8, cy + 14);
    ctx.shadowBlur = 0;
    ctx.restore();
    y = cy + 250 + 80;
    // 통계 3열 (등폭 + 구분선) — sUp .7s 1.15s
    ctx.save(); this._fadeIn(y, 100, eOut(intro(t, 1.15, .7)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const total = 920, cw = (total - 24) / 3;
    let x = CX - total / 2;
    RP_.stats.forEach((st, i) => {
      if (i) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 5, y, 2, 100); x += 12; }
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = F(400, T.label); ctx.letterSpacing = '-1.5px';
      ctx.fillText(st[0], x + cw / 2, y);
      ctx.fillStyle = '#fff'; ctx.font = F(700, st[2] === 'sm' ? 42 : 64);
      ctx.fillText(st[1], x + cw / 2, y + 39 * 1.2 + 18);
      ctx.letterSpacing = '0px';
      x += cw;
    });
    ctx.restore();
    // sUp .7s 1.35s + btnPulse 3s 2s ×3
    const bp = cycle(t, 2, 3, 3);
    this._button(y + 39 * 1.2 + 18 + 64 * 1.2 + 16, BTN, eOut(intro(t, 1.35, .7)), 0,
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }

  // Success 컴포넌트(Figma 130-2984) — 배지 + 점선 카운트다운 링
  _succ(n, y) {
    const ctx = this.ctx;
    ctx.font = F(700, 52, dot9);
    const t = 'Success!', tw = ctx.measureText(t).width + 44 + 40 + 80;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; this._pill(CX - tw / 2, y, tw, 88);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = NEU.t3;
    ctx.font = '44px sans-serif'; ctx.fillText('🔥', CX - tw / 2 + 40, y + 44);
    ctx.font = F(700, 52, dot9); ctx.fillText(t, CX - tw / 2 + 40 + 44 + 14, y + 44);
    const arc = this.map.get('succ-arc');
    const frac = numOr(arc?.style.strokeDashoffset, 0) / 615.7;   // 원본은 offset이 곧 남은 비율
    const ry = y + 88 + 56;
    this._ringAt(CX, ry, 220, frac, '#fff');
    drawCenteredNum(ctx, this.map.get('succ-n')?.textContent || '', CX, ry + 110, 88);
  }
}
