// 복싱 벽 UI를 WebGL로 — ready-view/{index,scene,timer,transition,report}.html 를
// canvas 2D → CanvasTexture 평면으로 다시 그린다. 바닥(floorgl.js)과 같은 B안.
//
// 왜: 벽 UI는 CSS3DRenderer가 그리는 별도 DOM 레이어(zIndex 6)라 WebGL 깊이 버퍼를 공유하지
// 못한다 → 벽 앞에 선 x봇 위로 UI가 그대로 통과한다. 같은 씬의 평면이면 깊이 테스트가 해결한다.
// 덤으로 빔 페더·차폐 소등 같은 투사 파이프라인을 자동 상속한다.
//
// 모션은 각 원본 HTML의 @keyframes를 그대로 옮겼다. 바닥과 달리 벽은 '서 있는' 프레임이라
// 세로 translate가 원근상 왜곡되지 않는다 → 원본 translateY를 그대로 쓴다.
import * as THREE from 'three';
import { PAL, NEU, rgba } from './palette.js';
import { clamp01, eOut, cycle, kf, intro, drawChars, drawBadge, insetGlow, checkBadge, growBar, arcGauge, ringGauge } from './floorgl.js';

const W = 2600, H = 1600;   // 대지 px (벽 2.6×1.6m 실측 1:1)
// 캔버스 해상도 — 대지 대비 배율. 화질 vs 업로드 비용의 저울.
// ?uiscale=N 으로 올릴 수 있다 — 4K 영상 내보내기용. 실시간에선 0.75 가 예산이다
// (대지 통짜 업로드라 배율을 올리면 프레임당 MB가 제곱으로 는다).
const K = Math.min(3, Math.max(0.4,
  +(new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('uiscale')) || 0.75));             // 캔버스 해상도 — 바닥과 같은 저울(화질 vs 업로드 비용)
// UI 재도색 주기. 모션을 이식한 뒤로 정지 화면이 없어져 매 틱 9.4~9.6MB 텍스처가 올라간다
// (24fps = 230MB/s). 씬 애니메이션이 '드드드득' 끊긴 원인 — UI 프레임을 씬보다 낮게 잡고
// 남는 예산을 봇·영상에 돌려준다. ?uifps=N 으로 8~60 비교 가능.
const UI_FPS = Math.max(4, Math.min(60, +(new URLSearchParams(location.search).get('uifps')) || 12));
const CX = W / 2;
const INF = Infinity;

// 투사 UI 서체 규칙(유저 확정): Supreme 두 굵기만 — Bold 700 · Regular 400.
// Freesentation·Pretendard 폴백은 은퇴(투사 UI는 영문 조판이고, 폴백이 끼면 자간이 달라진다).
const sans = "'Supreme',sans-serif";
// 수치 전용 페이스. 이걸 sans 로 바꾸면 문서 전체가 Supreme 2종만 남는다(유저가 원하면 한 줄).
const dot9 = "'OffBit','Supreme',sans-serif";
// 투사 UI 공통 타이포 스케일 — 대지 실값이 화면에선 조금 컸다(유저). 조판 좌표는 그대로 두고
// 글자만 줄인다. ?type=1 로 원래 크기.
const TS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('type') === '1' ? 1 : 0.92;
const F = (w, s, fam = sans) => `${w} ${(s * TS).toFixed(2)}px ${fam}`;
const RED = PAL.red;

// 텍스트 한 줄 — CSS의 (font-size, weight, color, letter-spacing, align)을 한 줄로
function txt(ctx, s, x, y, size, weight, color, o = {}) {
  ctx.font = F(weight, size, o.fam || sans);
  ctx.fillStyle = color;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'top';
  ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}
function rrPath(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }
function rrFill(ctx, x, y, w, h, r, fill) { ctx.fillStyle = fill; rrPath(ctx, x, y, w, h, r); ctx.fill(); }
// 세로 그라디언트 (Figma 빨강→주황→살구→하늘 규약)
function gradV(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [p, c] of stops) g.addColorStop(clamp01(p), c);
  return g;
}
// 0 → target 카운트업 (원본 countUp: 지연 뒤 cd초 동안 ease-out). 숫자가 아니면 그대로.
function countUp(target, t, delay, cd) {
  const m = String(target).match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return String(target);
  const end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length;
  const e = eOut(clamp01((t - delay) / cd));
  return dec ? (end * e).toFixed(dec) : String(Math.round(end * e));
}

// ── 원본 <script>의 데이터 상수 ─────────────────────────────────────────────────
const PHASES = ['START', 'WARM UP', 'DRILL', 'FIGHT'];
const SCENES = {
  BX_A1: { title: 'NECK & SHOULDER ROLLS', phase: 1, sub: '1/3', coach: { num: '8', unit: 'Rolls' }, you: { num: '8', unit: 'Rolls' },
    say: 'Roll your neck and shoulders, slow', cues: ['Slow…', 'Big circles', 'Other way', 'Easy — breathe'], combos: [] },
  BX_A2: { title: 'IN & OUT FOOTWORK', phase: 1, sub: '2/3', coach: { num: '6', unit: 'Steps' }, you: { num: '6', unit: 'Steps' },
    say: 'Light on your feet — front and back', cues: ['Light feet', 'Forward…', 'And back', 'Stay bouncy'], combos: [] },
  BX_A3: { title: 'LIGHT JAB', phase: 1, sub: '3/3', coach: { num: '6', unit: 'Jabs' }, you: { num: '6', unit: 'Jabs' },
    say: 'Extend from the shoulder, snap back', cues: ['Jab!', 'Snap back', 'Again!', 'From the shoulder'], combos: [] },
  BX_B1: { title: 'HOLD YOUR GUARD', phase: 2, sub: '1/3', coach: { num: '3.0', unit: 'Sec' }, you: { num: '3.0', unit: 'Sec' },
    say: 'Keep your fists in the box', cues: ['Fists up', 'Hold it…', 'Tight guard', 'Steady'], combos: [] },
  BX_B2: { title: 'SLIP & EVADE', phase: 2, sub: '2/3', coach: { num: '6', unit: 'Slips' }, you: { num: '6', unit: 'Slips' },
    say: 'Slip your head left and right', cues: ['Slip right!', 'And left!', 'Under it', 'Keep moving'], combos: [] },
  BX_B3: { title: 'JAB SWEEP', phase: 2, sub: '3/3', coach: { num: '6', unit: 'Sweeps' }, you: { num: '6', unit: 'Sweeps' },
    say: 'Follow the sweep, hit the target', cues: ['Follow it', 'Jab!', 'On target', 'Again!'], combos: [] },
  BX_C1: { title: 'START SIGNAL', phase: 3, sub: '', coach: { num: '3', unit: 'Go' }, you: { num: '', unit: '' },
    say: '3, 2, 1 — spar!', cues: [], combos: [] },
  BX_C2: { title: 'JAB SPAR', phase: 3, sub: '1/3', coach: { num: '8', unit: 'Thrown' }, you: { num: '5', unit: 'Landed' },
    say: 'Jab when the target shows', cues: ['Target up!', 'Jab!', 'Nice', 'Reset', 'Again!'], combos: ['Jab!'] },
  BX_C3: { title: 'COMBINATION', phase: 3, sub: '2/3', coach: { num: '4', unit: 'Openings' }, you: { num: '2', unit: 'Combo' },
    say: 'Keep the rhythm — jab, jab, hook', cues: ['Jab, jab…', 'Hook!', 'Rhythm!', 'Don’t stop'], combos: ['2x Combo!'] },
  BX_C4: { title: 'COOL DOWN', phase: 3, sub: '3/3', coach: { num: '', unit: '' }, you: { num: '', unit: '' },
    say: 'Breathe, drop your guard. Well done', cues: ['Breathe…', 'Guard down', 'Well done', 'Good work'], combos: [] },
};
const TR = {
  BX_T1: { sub: 'Boxing Basic Jab Combo', title: 'Warm-Up Done!',
    done: { lbl: 'Stretch', time: '5min', img: 'boxer_stretch.png' },
    next: { lbl: 'Learn', time: '10min', img: 'boxer_learn.png', badge: 'Next' } },
  BX_T2: { sub: 'Boxing Basic Jab Combo', title: 'Learning complete!',
    done: { lbl: 'Learn', time: '10min', img: 'boxer_learn.png' },
    next: { lbl: 'Let’s Fight!', time: '10min', img: 'boxer_fight.png', badge: 'Next' } },
};
const TM = { BX_C1: { sub: 'Boxing Basic Jab Combo', title: 'Session Complete' } };
const RP = { BX_FIN: { sub: 'Boxing Basic Jab Combo', title: 'Session Complete', pct: 100,
  stats: [['Jabs Landed', '12'], ['Best Combo', '×5'], ['Avg Jab Speed', '7.2']] } };
const BTN = 'Tap X2 For Retry!';
const READY_TITLE = 'Guard Up & Ready';

export class WallGL {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(W * K); this.canvas.height = Math.round(H * K);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      // depthTest는 켠 채로 — 이 이식의 전부다(벽 앞의 x봇에 가려진다). depthWrite는 반투명 UI라 끈다.
      // opacity 1 — 구 0.95('투사 UI 5% 균일 투명도')는 밝은 실내 벽에선 카드·판이 통째로
      // 벽 색과 섞여 뿌예지는 값이었다(유저: 알파합성 취소). 텍셀 알파는 그대로 살아 있다.
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }),
    );
    this.mesh.visible = false;
    // 벽 이펙트(빔 그리드·판정 토큰)는 z −1.05~−1.43에 있고 전부 transparent·depthWrite:false 라
    // 투명 정렬(뒤→앞)에서 벽면(−1.75)의 UI보다 나중에 그려진다 → UI 위를 덮는다.
    // 평면을 앞으로 당기면 벽 정합이 깨지므로 '그리기 순서'만 이펙트(최대 14) 위로 올린다.
    // 깊이 테스트는 켠 채라 x봇(z≈1.5, 불투명·깊이 기록)에는 그대로 가려진다 — 이 이식의 목적은 유지.
    this.mesh.renderOrder = 20;
    this.stage = null; this.kind = null; this.t = 0; this._lastPaint = -1;
    // 캔버스 fillText는 웹폰트 로드를 촉발하지 않는다 — 명시 로드 후 다시 그린다.
    for (const f of ['700 100px Supreme', '400 100px Supreme', '700 100px OffBit'])
      document.fonts?.load(f).then(() => { this._lastPaint = -1; }).catch(() => {});
  }

  // 이 경로가 담당하는 벽 뷰인가 (DESIGN_FRAMES의 src)
  static handles(src) { return /ready-view\/(index|scene|timer|transition|report)\.html/.test(src); }

  /** 이 UI가 쓰는 이미지 전부 — 진입 전에 미리 굽는다.
   *  첫 _paint 가 로드를 촉발하면 진입 직후 몇 프레임이 이미지 없이 그려지고 툭 나타난다
   *  (유저: 첫 화면 인터랙션 딜레이 — 화면 녹화에 그대로 찍힌다). */
  static ASSETS = [
    'arrow-right.svg',
    'bg_glow.svg',
    'boxer_fight.png',
    'boxer_learn.png',
    'boxer_stretch.png',
    'check.svg',
    'coach_a.png',
    'coach_b.png',
    'flame.svg',
    'foot_shape.png',
    'footprint_shadow.svg',
    'glow.svg',
    'you_avatar.png', 'newton-logo.svg'];
  preload() { for (const a of WallGL.ASSETS) this._img(a); }

  _img(rel) {
    this._imgs = this._imgs || new Map();
    let im = this._imgs.get(rel);
    if (!im) {
      im = new Image();
      im.onload = () => { this._lastPaint = -1; };
      im.src = (import.meta.env?.BASE_URL || '/') + 'ready-view/assets/' + rel;
      this._imgs.set(rel, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  // 마스크 이미지를 그라디언트로 채운 오프스크린 (CSS mask-image + background-image 근사)
  _tinted(rel, w, h, stops) {
    this._tints = this._tints || new Map();
    const key = rel + w + h;
    let c = this._tints.get(key);
    const im = this._img(rel);
    if (!im) return null;
    if (!c || c._src !== im) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-in';
      const g = x.createLinearGradient(0, 0, c.width * 0.2, c.height);
      for (const [p, col] of stops) g.addColorStop(p, col);
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      c._src = im;
      this._tints.set(key, c);
    }
    return c;
  }

  load(stage, params = {}) {
    this.stage = stage;
    this.params = params;
    this.kind = /transition\.html/.test(params.src) ? 'transition'
      : /timer\.html/.test(params.src) ? 'timer'
      : /report\.html/.test(params.src) ? 'report'
      : /scene\.html/.test(params.src) ? 'scene' : 'ready';
    this.t = 0; this._lastPaint = -1; this._numLast = null; this._numT = 0;
  }

  update(dt) {
    if (!this.stage) return;
    this.t += dt;
    // 24fps — 벽 UI는 상시 모션(글로우 드리프트·웨이브)이라 서명 비교로 걸러질 게 없다.
    // ponytail: 정적/동적 평면 분리는 바닥과 같은 계획(HANDOFF). 지금은 한 장.
    if (this.t - this._lastPaint < 1 / UI_FPS) return;
    this._lastPaint = this.t;
    this._paint();
    this.tex.needsUpdate = true;
  }

  _paint() {
    const ctx = this.ctx;
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    this['_paint_' + this.kind]();
  }

  // ── 공통 조각 ───────────────────────────────────────────────────────────────
  // 배경 글로우 + glowDrift 15s ∞. 원본은 컨테이너 라디얼 마스크로 사각 모서리를 잘라낸다.
  _bgGlow() {
    const ctx = this.ctx, im = this._img('bg_glow.svg');
    if (!im) return;
    const w = 2050, h = w * (im.naturalHeight / im.naturalWidth);
    ctx.save();
    const p = cycle(this.t, 0, 15, INF);
    if (p != null) {
      const dx = kf(p, [[0, 0], [.25, -.09], [.5, .08], [.75, -.05], [1, 0]]) * w;
      const dy = kf(p, [[0, 0], [.25, .06], [.5, -.08], [.75, .05], [1, 0]]) * h;
      const s = kf(p, [[0, 1], [.25, 1.14], [.5, 1.05], [.75, 1.16], [1, 1]]);
      const r = kf(p, [[0, 0], [.25, 5], [.5, -4], [.75, 3], [1, 0]]) * Math.PI / 180;
      ctx.translate(CX + dx, H / 2 + dy); ctx.rotate(r); ctx.scale(s, s); ctx.translate(-CX, -H / 2);
    }
    ctx.drawImage(im, CX - w / 2, H / 2 - h / 2, w, h);
    ctx.restore();
    // 라디얼 마스크: 66%×62% at (50%, 44%), #000 20% → transparent 90%
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.translate(CX, H * 0.44); ctx.scale(1, (0.62 * H) / (0.66 * W));
    const rMax = 0.66 * W;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rMax);
    g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.9, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 2, H * 2);
    ctx.restore();
  }

  // 서브타이틀 + 큰 타이틀 + charWave. titleIn(.8s .1s, translateY 40→0 + scale)
  // 반환 = 그룹 아래 y
  _titleGroup(y, sub, ttl, dly = 0.1, dur = 0.8, ty0 = 40) {
    const ctx = this.ctx, t = this.t;
    const subH = 48 * 1.2, gap = 8, ttlH = 120 * 1.05, gh = subH + gap + ttlH;
    const p = eOut(intro(t, dly, dur));
    ctx.save();
    ctx.globalAlpha *= kf(p, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(p, [[0, .94], [.7, 1.02], [1, 1]]);
    ctx.translate(0, kf(p, [[0, ty0], [.7, 0], [1, 0]]));
    ctx.translate(CX, y + gh / 2); ctx.scale(k, k); ctx.translate(-CX, -(y + gh / 2));
    txt(ctx, sub, CX, y, 48, 400, 'rgba(255,255,255,.8)', { ls: -4.2, align: 'center' });
    ctx.font = F(700, 120); ctx.fillStyle = '#fff';
    drawChars(ctx, ttl, CX, y + subH + gap, 120, -4.8, i => {
      const c = cycle(t, 0.9 + i * 0.05, 2.4, INF);
      return { dy: c == null ? 0 : kf(c, [[0, 0], [.29, -16], [.58, 0], [1, 0]]), alpha: 1, scale: 1 };
    });
    ctx.restore();
    return y + gh;
  }

  // 흰 pill 버튼 (전환·리포트 공통). e=등장 · dy=떠오름 · glow=펄스
  _button(y, text, e = 1, dy = 0, glow = 0) {
    const ctx = this.ctx, w = 802, h = 72 * 1.2 + 42.614 * 2;
    ctx.save();
    ctx.globalAlpha *= e;
    ctx.translate(0, dy);
    if (glow > 0.002) { ctx.shadowColor = `rgba(255,255,255,${0.35 * glow})`; ctx.shadowBlur = 60 * glow; }
    rrFill(ctx, CX - w / 2, y, w, h, 999, '#fff');
    ctx.shadowBlur = 0;
    txt(ctx, text, CX, y + h / 2, 72, 700, NEU.inkDark, { ls: -1.33, align: 'center', base: 'middle' });
    ctx.restore();
    return y + h;
  }

  // ── BX_READY (index.html) ──────────────────────────────────────────────────
  _paint_ready() {
    const ctx = this.ctx, t = this.t;
    const ROW_Y = 103, LX = 100, LW = 1040;
    // 좌/우 그룹 상시 둥둥 (floatY 6.5s / floatY2 7.5s, delay 1.8s)
    const fl = cycle(t, 1.8, 6.5, INF), fr = cycle(t, 1.8, 7.5, INF);
    const lDy = fl == null ? 0 : kf(fl, [[0, -7], [.5, 9], [1, -7]]);
    const rDy = fr == null ? 0 : kf(fr, [[0, -10], [.5, 8], [1, -10]]);

    // ══ 좌측 컬럼 ══
    ctx.save(); ctx.translate(0, lDy);
    // 헤더 카드 — slideInLeft .85s .15s
    const hdrH = 257.054;
    ctx.save();
    const he = eOut(intro(t, .15, .85));
    ctx.globalAlpha *= he; ctx.translate(-90 * (1 - he), 0);
    rrFill(ctx, LX, ROW_Y, LW, hdrH, 64, '#fff');
    const ph = 217.054, px = LX + 20, py = ROW_Y + 20;
    ctx.save(); rrPath(ctx, px, py, ph, ph, 54); ctx.clip();
    const ca = this._img('coach_a.png'), cb = this._img('coach_b.png');
    for (const im of [ca, cb]) if (im) ctx.drawImage(im, px - 28.09, py - 74.05, 275.305, 511.608);
    ctx.restore();
    const tx = px + ph + 40.857;
    txt(ctx, 'Boxing Basic Jab Combo', tx, py + 24, 52, 700, NEU.inkDark, { ls: -2.55 });
    txt(ctx, 'Skilled User Pack · Boxing ·Quite On', tx, py + 24 + 52 * 1.2 + 20.429, 32, 400, NEU.t2, { ls: -.96 });
    ctx.restore();

    // 스탯 카드 — slideInLeft .85s .35s
    const stY = ROW_Y + hdrH + 24, stH = 1113;
    ctx.save();
    const se = eOut(intro(t, .35, .85));
    ctx.globalAlpha *= se; ctx.translate(-90 * (1 - se), 0);
    rrFill(ctx, LX, stY, LW, stH, 76, NEU.surface);
    // ★ 투사 거리 가독 하한 — 벽 대지는 1.00 mm/px(PROJECTION-SPEC 6절)라 24px = 실물 24mm.
    // 2~4m 에서 24mm 캡션은 안 읽힌다(유저: "너무 작아서 안 보임"). 캡션류를 32 이상으로,
    // 체크 배지는 40 → 58 로 올렸다. 폰 레이아웃을 1:1 로 벽에 옮긴 값이라 원래 작았던 것.
    const ix = LX + 20, iw = 1000;
    // 카드 안 왼쪽 텍스트 기준선 — 하나로 통일(유저: "왼쪽정렬 안 됨").
    // 전엔 30/min 은 ix+24.26, Fight! 는 ix+34.26(트랙이 ix+10 에서 시작 + 24.26),
    // Setup 라벨 ix+30, Connected 라벨 ix+20 으로 넷이 갈려 있었다.
    const PADL = 24.256;
    // 흰 박스 안쪽 여백 — 셀이 모서리에 딱 붙어 있던 것(유저: "양옆 마진 0")만 해결한다.
    // 셀 사이 간격은 Figma 실값(10·8) 유지 — 24 로 넓혀 봤더니 카드가 아래로 넘쳤다(유저 기각).
    // 셀 안 텍스트 패딩은 PADL − CPAD 로 줘서 바깥 축(ix + PADL)은 그대로 유지된다.
    const CPAD = 14, CIN = PADL - CPAD, CGAP = 10, DGAP = 8;
    let y = stY + 32;
    // ── Total
    txt(ctx, 'Total', ix + PADL, y + 6, 34, 400, NEU.t1, { ls: -1.13 });
    y += 48 + 8;
    const totH = 378.393;
    rrFill(ctx, ix, y, iw, totH, 64, '#fff');
    // 그래프 3단 (우측 정렬, 위에서부터 stretch/learn/run)
    const gY = y + 10, gH = totH - 20, gR = ix + iw - 10;
    const barH = (gH - 4.851 * 2) / 3;
    // graphReveal — 오른쪽 끝에 붙은 채 왼쪽으로 자란다.
    // 전엔 ctx.rect().clip() 리빌이라 자라는 동안 40px 라운드가 직각으로 썰렸다(유저 지적).
    // 앱은 폭 자체를 애니메이션한다(creator.css `@keyframes bar-grow`) → 라운드가 끝을 달고 간다.
    const bar = (i, bw, label, delay, solid) => {
      const by = gY + i * (barH + 4.851);
      growBar(ctx, gR - bw, by, bw, barH, eOut(intro(t, delay, .7)), {
        anchor: 'right', track: null, r: 40, pad: 24.256, fs: 36, ls: -1.21, num: label,
        stops: [[.63, PAL.red], [.9, PAL.coral], [1, PAL.sand]], fill: solid,
      });
    };
    bar(0, 194.048, '5min', 1.0);
    bar(1, 388.095, '10min', 1.15);
    // run 행 = 회색 트랙 + Fight! + 우측 learn-abs
    const ry = gY + 2 * (barH + 4.851);
    rrFill(ctx, gR - (iw - 20), ry, iw - 20, barH, 40, NEU.surface);   // r 40 = 막대와 동일(유저: r 값 안 맞음)
    ctx.save(); ctx.globalAlpha *= 0.7;
    txt(ctx, 'Fight!', ix + PADL, ry + barH / 2, 32, 700, NEU.inkDark, { ls: -1.21, base: 'middle' });
    ctx.restore();
    bar(2, 582.143, '15min', 1.3);
    // 좌측 큰 숫자 오버레이
    txt(ctx, '30', ix + PADL, y + 24.256, 145.536, 700, NEU.inkDark, { fam: dot9 });
    ctx.save(); ctx.globalAlpha *= 0.6;
    txt(ctx, 'min', ix + PADL, y + 24.256 + 145.536, 32, 700, NEU.inkDark, { ls: -1.21 });
    ctx.restore();
    y += totH + 32;
    // ── Setup
    txt(ctx, 'Setup', ix + PADL, y + 6, 34, 400, NEU.t1, { ls: -1.13 });
    y += 48 + 8;
    const setH = 235;
    rrFill(ctx, ix, y, iw, setH, 64, '#fff');
    // 흰 박스 안쪽 여백 — 셀이 모서리에 딱 붙어 있었다(유저: "양옆 마진 0").
    // 셀 안 텍스트 패딩은 PADL - CPAD 로 줘서 바깥 축(ix + PADL)은 그대로 유지된다.
    const cw = (iw - CPAD * 2 - CGAP) / 2;
    // ★ 한 줄 압축 — 라벨+값 두 줄이던 걸 자기설명적 한 줄로 줄이고 그만큼 키웠다(유저:
    // "글씨 크기를 키우란 게 아니라 글자 수를 줄이면서 내용은 유지"). 투사면은 읽는 화면이
    // 아니라 훑는 화면이라 라벨은 값 안에 녹인다. 'Quite On' → 'Quiet On' 오타도 함께 정정.
    const cells = [['Indoor · Standard', 103], ['Condition · Usual', 103],
                   ['Quiet On', 102], ['Main 15m', 102]];
    cells.forEach(([val, ch], i) => {
      const cx0 = ix + CPAD + (i % 2) * (cw + CGAP), cy0 = y + 12 + (i < 2 ? 0 : 111);
      const e = eOut(intro(t, .95 + i * .10, .55));
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, 26 * (1 - e));
      const k = 0.95 + 0.05 * e;
      ctx.translate(cx0 + cw / 2, cy0 + ch / 2); ctx.scale(k, k); ctx.translate(-(cx0 + cw / 2), -(cy0 + ch / 2));
      rrFill(ctx, cx0, cy0, cw, ch, 48, NEU.surface);
      txt(ctx, val, cx0 + CIN, cy0 + ch / 2, 38, 700, '#000', { ls: -1.27, base: 'middle' });
      ctx.restore();
    });
    y += setH + 32;
    // ── Connected
    txt(ctx, 'Connected', ix + PADL, y + 6, 34, 400, NEU.t1, { ls: -1.13 });
    y += 48 + 8;
    const devH = 203.607, dw = (iw - CPAD * 2 - DGAP * 2) / 3;
    // 아이콘 88 + 간격 14 + 글자 38 = 147.6 을 카드(203.607) 안에서 위아래 대칭으로 앉힌다
    // (전엔 위 16 / 아래 47 로 어긋나 있었다 — 유저 지적).
    const DTOP = (devH - (88 + 14 + 38 * 1.2)) / 2;
    // 같은 규칙 — 이름+상태 두 줄을 한 줄로. 상태가 곧 이름을 설명한다.
    const devs = [['icon_wearable.png', 'Wearable 99%'],
                  ['icon_station.png', 'Station Ready'],
                  ['icon_device.png', 'Watch Ready']];
    devs.forEach(([ic, n], i) => {
      const dx = ix + CPAD + i * (dw + DGAP);
      const e = eOut(intro(t, 1.3 + i * .13, .55));
      ctx.save();
      ctx.globalAlpha *= e; ctx.translate(0, 26 * (1 - e));
      rrFill(ctx, dx, y, dw, devH, 64, '#fff');
      // 아이콘 — 웨어러블만 원본 컬러, 나머지는 열화상 그라디언트 마스크
      const tim = i === 0 ? this._img(ic) : this._tinted(ic, 88, 88, [[0, PAL.red], [.6, PAL.coral], [.85, PAL.sand], [1, PAL.prism]]);
      if (tim) ctx.drawImage(tim, dx + CIN, y + DTOP, 88, 88);
      txt(ctx, n, dx + CIN, y + DTOP + 88 + 14, 38, 700, NEU.inkDark, { ls: -1.27 });
      const chk = this._img('check.svg');
      if (chk) ctx.drawImage(chk, dx + dw - CIN - 58, y + DTOP, 58, 58);   // 40 → 58 (투사 거리에서 안 보였다)
      ctx.restore();
    });
    ctx.restore();   // /stats
    ctx.restore();   // /leftcol float

    // ══ 우측 ══
    ctx.save(); ctx.translate(0, rDy);
    const RX = LX + LW + 24, RW = W - LX - RX, RRight = RX + RW;
    // 로고만 — 우측 정렬. 여기 있던 진행 게이지는 READY 에 아직 진행할 게 없어 의미가
    // 없었고(유저), "Guard Up & Ready" 타이틀도 뺐다(유저: "그냥 로고만 우측정렬 깔끔하게").
    // 이 화면의 안내는 아래 발 블록("Tap your foot Twice")이 이미 하고 있다 — 중복이었다.
    const lg = this._img('newton-logo.svg');
    if (lg) {
      const lw = 300, lh = lw * (1353 / 4635), le = eOut(intro(t, .35, .7));
      ctx.save();
      ctx.globalAlpha *= le; ctx.translate(0, 26 * (1 - le));
      ctx.drawImage(lg, RRight - lw, ROW_Y + 40, lw, lh);
      ctx.restore();
    }
    // 발 블록 — slideInUp .9s .6s
    const FX = RX + RW / 2 - 40, FY = ROW_Y + 570;   // 로고 우측정렬에 맞춰 100px 오른쪽으로(유저)
    ctx.save();
    const fe = eOut(intro(t, .6, .9));
    ctx.globalAlpha *= fe; ctx.translate(0, 52 * (1 - fe));
    // 글로우 — glowPulse 4.6s ∞
    const gl = this._img('glow.svg'), gp = cycle(t, 0, 4.6, INF);
    if (gl) {
      ctx.save();
      ctx.globalAlpha *= gp == null ? .86 : kf(gp, [[0, .86], [.5, 1], [1, .86]]);
      const gs = gp == null ? 1 : kf(gp, [[0, 1], [.5, 1.055], [1, 1]]);
      const gcx = FX - 70 + 450, gcy = FY - 70 + 455;
      ctx.translate(gcx, gcy); ctx.scale(gs, gs); ctx.translate(-gcx, -gcy);
      ctx.drawImage(gl, FX - 70, FY - 70, 900, 910);
      ctx.restore();
    }
    // 발 — footBob 5.5s 2.2s ∞
    const fb = cycle(t, 2.2, 5.5, INF);
    const fdy = fb == null ? 0 : kf(fb, [[0, 0], [.10, 34], [.20, 6], [.32, 31], [.44, 0], [.70, 0], [1, 0]]);
    const foot = this._tinted('foot_shape.png', 300, 400, [[0, rgba(PAL.sand, 0)], [.37, rgba(PAL.sand, .35)], [.94, RED], [1, RED]]);
    if (foot) { ctx.save(); ctx.globalAlpha *= .9; ctx.drawImage(foot, FX + 380 - 150, FY + 275 + fdy, 300, 400); ctx.restore(); }
    // 원반 — floatY 5s 2.2s ∞
    const disc = this._img('footprint_shadow.svg'), fy2 = cycle(t, 2.2, 5, INF);
    if (disc) {
      const dh = 370 * (disc.naturalHeight / disc.naturalWidth);
      const dd = fy2 == null ? 0 : kf(fy2, [[0, -7], [.5, 9], [1, -7]]);
      ctx.drawImage(disc, FX + 380 - 185, FY + 678 + dd, 370, dh);
    }
    // CTA
    const ar = this._img('arrow-right.svg');
    if (ar) ctx.drawImage(ar, FX + 380 - 31, FY + 100, 62, 62);
    txt(ctx, 'Tap your foot Twice', FX + 380, FY + 100 + 62 + 26, 64, 700, '#fff', { ls: -4.57, align: 'center' });
    txt(ctx, 'with the Wearable on', FX + 380, FY + 100 + 62 + 26 + 64 * 1.1 + 14, 32, 400, 'rgba(255,255,255,.8)', { align: 'center' });
    ctx.restore();
    ctx.restore();   // /rightcol float
  }

  // ── 운동중 (scene.html) ────────────────────────────────────────────────────
  _paint_scene() {
    const ctx = this.ctx, t = this.t;
    const S = SCENES[this.stage] || SCENES.BX_A1;
    const dur = this.params.dur || 8;
    const isEntry = (S.sub === '' || /^1\//.test(S.sub));
    const mid = !isEntry;   // 같은 페이즈 후속 단계 = 골격 고정

    // 타이틀 — titleIn .8s .1s (translateY 40 + scale .94→1.02→1)
    const tp = eOut(intro(t, .1, .8));
    ctx.save();
    ctx.globalAlpha *= kf(tp, [[0, 0], [.7, 1], [1, 1]]);
    ctx.translate(0, kf(tp, [[0, 40], [.7, 0], [1, 0]]));
    const tk = kf(tp, [[0, .94], [.7, 1.02], [1, 1]]);
    // 중앙 정렬 — 게이지를 중앙에 놓자 좌측 타이틀 끝과 맞붙었다(실측: 타이틀 우단 ≈1060,
    // 게이지 좌단 1000). 타이틀까지 중앙으로 올려 [타이틀 → 게이지 → 코치 → 큐] 세로 축을 세운다.
    // 페이즈 열은 우측 그대로 — 축 하나 + 우측 상태열이 좌우 대칭을 깨지 않는다.
    // 위계: 단계(24/28) ≪ 제목(80) — 제목이 이 화면의 주인공이고 단계는 머리말이다(유저).
    // 한때 56 까지 줄였는데 단계(32/40)와 차이가 안 나 둘 다 어중간했다. 배수 ≈2.9 로 벌린다.
    ctx.translate(CX, 72 + 48); ctx.scale(tk, tk); ctx.translate(-CX, -(72 + 48));
    txt(ctx, S.title, CX, 72, 80, 700, NEU.ink, { align: 'center', ls: -2.7 });
    ctx.restore();

    // 진행 게이지 — 대지 중앙. 상단이 [타이틀(좌) · 게이지(중) · 페이즈(우)] 3단이 된다.
    // 타이틀 밑 좌측에 붙였더니 좌측만 무겁고 중앙이 비어 보였다(유저).
    // 타이틀(중앙, 56px) 바로 아래.
    // 수치·끝라벨은 뺀다 — 아래가 코치 머리라 숫자가 겹치고, 여긴 시간 진행이라 눈금이 불필요.
    // 폭 480 · y0 164 — 브레드크럼(30) → 타이틀(96~152) → 게이지. 잉크 하단 ≈275
    const gW = 480, dY = 176;
    const de = eOut(intro(t, .20, .6));
    ctx.save();
    ctx.globalAlpha *= de; ctx.translate(0, 48 * (1 - de));
    arcGauge(ctx, CX - gW / 2, dY, gW, t / dur);
    ctx.restore();

    // 페이즈 — 상단 중앙 가로 브레드크럼. 전엔 우측 세로 열이었는데 타이틀·게이지가
    // 중앙으로 오면서 오른쪽에만 덩그러니 남아 어색했다(유저).
    // 앱의 단계 표시(setup-condition 하단 바)도 가로 3단이다 — 세로가 아니라 가로가 정본.
    // 타이틀 위에 놓아 [단계 → 제목 → 진행] 위에서 아래로 읽히는 머리말 묶음이 된다.
    {
      const items = PHASES.map((label, i) => {
        const active = i === S.phase;
        const str = active ? label + (S.sub ? ' ' + S.sub : '') : label;
        ctx.font = F(active ? 700 : 400, active ? 28 : 24);
        return { str, active, far: i > S.phase + 1, w: ctx.measureText(str).width };
      });
      const GAP = 40, total = items.reduce((a, b) => a + b.w, 0) + GAP * (items.length - 1);
      let px = CX - total / 2;
      items.forEach((it, i) => {
        const e = (isEntry && !mid) ? eOut(intro(t, .15 + i * .07, .6)) : 1;
        ctx.save();
        ctx.globalAlpha *= e; ctx.translate(0, 20 * (1 - e));   // 가로 열이라 등장도 아래→위
        if (it.active) {
          const pu = cycle(t, 1.2, 2.4, INF);
          if (pu != null) ctx.globalAlpha *= kf(pu, [[0, 1], [.5, .6], [1, 1]]);
          ctx.shadowColor = 'rgba(255,255,255,.45)'; ctx.shadowBlur = 28;
          txt(ctx, it.str, px, 34, 28, 700, '#fff');
        } else {
          txt(ctx, it.str, px, 36, 24, 400, it.far ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.7)');
        }
        ctx.restore();
        px += it.w + GAP;
      });
    }

    // 아바타 — sLeft/sRight .8s .28s (후속 단계는 고정)
    const av = (x, img, dir) => {
      const e = mid ? 1 : eOut(intro(t, .28, .8));
      ctx.save();
      ctx.globalAlpha *= e; ctx.translate(dir * 70 * (1 - e), 0);
      // 흰 링 10px → 5px (유저). 앱 프로필(my.css .avatar)엔 테두리가 아예 없지만
      // 밝은 벽에 사진만 얹으면 경계가 사라져 얇은 선은 남긴다.
      // 사진은 링이 얇아진 만큼(113.5/108.5) 중심 기준으로 키워 원판을 채운다.
      const RING = 5, R = 118.5 - RING, K2 = R / 108.5, cx0 = x + 118.5, cy0 = 855 + 118.5;
      rrFill(ctx, x, 855, 237, 237, 999, '#fff');
      ctx.save();
      ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, Math.PI * 2); ctx.clip();
      for (const rel of img) {
        const im = this._img(rel);
        if (im) ctx.drawImage(im, cx0 + (10 - 28.09 - R) * K2, cy0 + (10 - 74.05 - R) * K2, 275.305 * K2, 511.608 * K2);
      }
      ctx.restore();
      ctx.restore();
    };
    av(100, ['coach_a.png', 'coach_b.png'], -1);
    av(2263, ['you_avatar.png'], 1);

    // You 배지 — sPop .6s .62s
    const be = mid ? 1 : eOut(intro(t, .62, .6));
    ctx.save();
    ctx.globalAlpha *= kf(be, [[0, 0], [.6, 1], [1, 1]]);
    const bk = kf(be, [[0, .5], [.6, 1.12], [1, 1]]);
    ctx.font = F(400, 47.28);
    const bw = ctx.measureText('You').width + 63.04, bh = 47.28 * 1.2 + 31.52;
    ctx.translate(2319 + bw / 2, 1043 + bh / 2); ctx.scale(bk, bk); ctx.translate(-(2319 + bw / 2), -(1043 + bh / 2));
    rrFill(ctx, 2319, 1043, bw, bh, 80, 'rgba(255,255,255,.9)');
    txt(ctx, 'You', 2319 + bw / 2, 1043 + bh / 2, 47.28, 400, NEU.t3, { ls: -.5, align: 'center', base: 'middle' });
    ctx.restore();

    // 큰 숫자 — sPop .7s .48s + 카운트업 / 단위 — sUp .6s .58s
    const ne = eOut(intro(t, .48, .7));
    // 값이 없는 구간(쿨다운)은 '—' 를 띄우지 않고 자리를 비운다 — 멈춘 숫자는 고장으로 읽힌다.
    const num = (x, align, val, delay, cd) => {
      if (val === '' || val == null) return;
      ctx.save();
      ctx.globalAlpha *= kf(ne, [[0, 0], [.6, 1], [1, 1]]);
      const nk = kf(ne, [[0, .5], [.6, 1.12], [1, 1]]);
      ctx.translate(x, 1148 + 100); ctx.scale(nk, nk); ctx.translate(-x, -(1148 + 100));
      txt(ctx, countUp(val, t, delay, cd), x, 1148, 200, 700, '#fff', { fam: dot9, ls: -8, align });
      ctx.restore();
    };
    num(100, 'left', S.coach.num, .62, 1.0);
    num(2500, 'right', S.you.num, .76, Math.max(1.5, dur * 0.8));
    const ue = eOut(intro(t, .58, .6));
    ctx.save();
    ctx.globalAlpha *= ue; ctx.translate(0, 48 * (1 - ue));
    txt(ctx, S.coach.unit, 100, 1368, 64, 400, '#fff', { ls: -2.56 });
    txt(ctx, S.you.unit, 2500, 1368, 64, 400, '#fff', { ls: -2.56, align: 'right' });
    ctx.restore();

    // 코치 자막 — sUpC .8s .68s 등장 + 교체마다 cueSwap .5s
    const seq = (S.cues && S.cues.length) ? [S.say, ...S.cues] : [S.say];
    const every = Math.max(1.1, dur / (seq.length + 0.5));
    const idx = seq.length > 1 ? Math.floor(t / every) % seq.length : 0;
    const swapT = seq.length > 1 ? t - Math.floor(t / every) * every : t;
    const say = seq[idx];
    const ce = eOut(intro(t, .68, .8));
    const cs = eOut(clamp01(swapT / .5));
    ctx.save();
    ctx.globalAlpha *= ce * kf(cs, [[0, 0], [.6, 1], [1, 1]]);
    ctx.translate(0, 48 * (1 - ce));
    ctx.font = F(400, 56);
    const sw = Math.min(1600, ctx.measureText(say).width + 64), sh = 56 * 1.2 + 48;
    const sk = kf(cs, [[0, .9], [.6, 1.06], [1, 1]]);
    // 자막을 투사 영역 맨 아래로 (1370 → 대지 하단에서 40px 띄움). 가운데 여백을 비운다(유저).
    const cueY = H - sh - 40;
    ctx.translate(CX, cueY + sh / 2); ctx.scale(sk, sk); ctx.translate(-CX, -(cueY + sh / 2));
    rrFill(ctx, CX - sw / 2, cueY, sw, sh, 9999, '#fff');
    txt(ctx, say, CX, cueY + sh / 2, 56, 400, '#000', { ls: -2.24, align: 'center', base: 'middle' });
    ctx.restore();

    // 콤보 팝업 — comboIn .6s (1.0 + i*.5) + comboGlow 1.6s ∞
    (S.combos || []).forEach((c, i) => {
      const y0 = 1202 + i * (114.26 + 16), d = 1.0 + i * 0.5;
      const e = eOut(intro(t, d, .6));
      if (e <= 0) return;
      const gl = cycle(t, d + 0.6, 1.6, INF);
      ctx.save();
      const gy = 0;
      ctx.globalAlpha *= kf(e, [[0, 0], [.5, 1], [1, 1]]);
      const sc = kf(e, [[0, .3], [.5, 1.22], [.72, .94], [1, 1]]);
      const rot = kf(e, [[0, -8], [.5, 3], [.72, -1.5], [1, 0]]) * Math.PI / 180;
      const gl2 = gl == null ? 0 : kf(gl, [[0, 0], [.5, 1], [1, 0]]);
      ctx.translate(CX, y0 + 114.26 / 2 + 34 * (1 - e) + (gl == null ? 0 : kf(gl, [[0, 0], [.5, -7], [1, 0]])));
      ctx.rotate(rot); ctx.scale(sc, sc);
      // 성취 배지 = 지면 Success 와 같은 컴포넌트(floorgl.drawBadge)
      drawBadge(ctx, 0, 0, c, { scale: 1, icon: this._img('flame.svg'), glow: .55 + .35 * gl2 });
      ctx.restore();
    });
  }

  // ── 카운트다운 (timer.html) ────────────────────────────────────────────────
  _paint_timer() {
    const ctx = this.ctx, t = this.t, M = TM[this.stage] || TM.BX_C1, dur = this.params.dur || 3;
    this._bgGlow();
    const y = this._titleGroup(341, M.sub, M.title) + 80;
    const cy = y + 274.319, r = 250 * (548.638 / 549);
    const rem = dur - t, val = rem > 0.05 ? String(Math.ceil(rem)) : 'GO';
    // ringPop .8s .35s + ringBreath 3s 1.2s ∞
    const e = eOut(intro(t, .35, .8)), br = cycle(t, 1.2, 3, INF);
    ctx.save();
    ctx.globalAlpha *= kf(e, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(e, [[0, .6], [.7, 1.05], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(k, k); ctx.translate(-CX, -cy);
    if (br != null) {
      const g = kf(br, [[0, 0], [.5, 1], [1, 0]]);
      ctx.shadowColor = `rgba(255,255,255,${.35 * g})`; ctx.shadowBlur = 26 * g;
    }
    ringGauge(ctx, CX, cy, r, clamp01(t / dur));
    ctx.shadowBlur = 0;
    // numPulse — 숫자가 바뀔 때마다 .45s
    if (val !== this._numLast) { this._numLast = val; this._numT = t; }
    const q = clamp01((t - this._numT) / .45), nk = kf(q, [[0, 1.5], [1, 1]], eOut);
    ctx.save();
    ctx.globalAlpha *= kf(q, [[0, 0], [.35, 1], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(nk, nk); ctx.translate(-CX, -cy);
    txt(ctx, val, CX, cy, 200, 700, '#fff', { fam: dot9, align: 'center', base: 'middle' });
    ctx.restore();
    ctx.restore();
  }

  // ── 전환 (transition.html) ────────────────────────────────────────────────
  _paint_transition() {
    const ctx = this.ctx, t = this.t, TR_ = TR[this.stage] || TR.BX_T1;
    this._bgGlow();
    this._titleGroup(221, TR_.sub, TR_.title, .1, .85, 44);
    const S = 654.902, GAP = 26.196, y = 532, x0 = CX - (S * 2 + GAP) / 2;
    const card = (x, d, fd, fdur, D, done) => {
      const e = eOut(intro(t, d, .8)), c = cycle(t, fd, fdur, INF);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, 70 * (1 - e) + (c == null ? 0 : kf(c, [[0, 0], [.5, -13], [1, 0]])));
      const k = 0.92 + 0.08 * e;
      ctx.translate(x + S / 2, y + S / 2); ctx.scale(k, k); ctx.translate(-(x + S / 2), -(y + S / 2));
      this._card(x, y, S, D, done);
      ctx.restore();
    };
    card(x0, .38, 1.5, 4, TR_.done, true);
    card(x0 + S + GAP, .54, 1.85, 4.4, TR_.next, false);
    // sUpC .8s .95s + btnFloatC 3.6s 1.9s ∞ + btnPulse 3s 1.9s ∞
    const be = eOut(intro(t, .95, .8)), bf = cycle(t, 1.9, 3.6, INF), bp = cycle(t, 1.9, 3, INF);
    this._button(1226, BTN, be,
      54 * (1 - be) + (bf == null ? 0 : kf(bf, [[0, 0], [.5, -18], [1, 0]])),
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }

  _card(x, y, S, D, done) {
    const ctx = this.ctx, P = 52.392;
    ctx.save();
    rrPath(ctx, x, y, S, S, 65.49); ctx.clip();
    // 선택 카드 = 온보딩 셀렉 컴포넌트(onboarding.css `.ob-card.sel`) 실값.
    // linear-gradient(180deg, #FA3030 48%, #FE6E3C 77.6%, #FEC389 100.5%, #D1FEFF 107.5%)
    // — 마지막 두 스톱이 박스 밖(100% 초과)이라 바닥이 sand 에 '닿기 직전'에서 끝난다.
    // 캔버스 스톱은 0~1 이므로 그라디언트 길이를 1.075배로 잡아 그대로 재현한다.
    if (done) {
      const g = ctx.createLinearGradient(0, y, 0, y + S * 1.075);
      g.addColorStop(0, PAL.red); g.addColorStop(.48 / 1.075, PAL.red);
      g.addColorStop(.776 / 1.075, PAL.coral); g.addColorStop(1.005 / 1.075, PAL.sand);
      g.addColorStop(1, PAL.prism);
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, S, S);
    const im = this._img(D.img);
    // ★ 인물 블렌드 = plus-lighter(캔버스 'lighter'). 정본은 투사 대지 Figma 와 이식 원본 CSS
    //   (`.card.done .person{mix-blend-mode:plus-lighter}`) — 검은 옷이 빨강을 그대로 통과시켜
    //   인물이 붉게 물든다. 한때 온보딩 셀렉 카드(multiply)를 참조해 바꿨었는데, 그러면 옷이
    //   검게 앉아 카드가 죽는다(유저 Figma 대조). 지면 카드도 같은 'lighter' 다.
    if (im) {
      const w = 687, h = w * (im.naturalHeight / im.naturalWidth);
      ctx.save(); if (done) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(im, x + S / 2 - w / 2, y - 55, w, h);
      ctx.restore();
    }
    if (!done) {   // 인물 위 빨강→주황 틴트
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradV(ctx, y, y + S, [[0, PAL.red], [1, PAL.coral]]);
      ctx.fillRect(x, y, S, S); ctx.restore();
    } else {
      // 내부 글로우 = 원본 CSS 실값 inset 0 0 52.392px 19.647px rgba(255,255,255,.6)
      ctx.save();
      rrPath(ctx, x, y, S, S, 65.49); ctx.clip();
      insetGlow(ctx, x, y, S, S, 65.49, rgba(NEU.ink, 0.6), 52.392, 19.647);
      ctx.restore();
    }
    ctx.restore();
    // 우상단 배지 — sPop .6s (.95 / 1.0)
    const sp = eOut(intro(this.t, done ? .95 : 1.0, .6));
    ctx.save();
    ctx.globalAlpha *= kf(sp, [[0, 0], [.6, 1], [1, 1]]);
    const spk = kf(sp, [[0, .5], [.6, 1.12], [1, 1]]);
    if (done) {
      const c = x + S - P - 45.8, cy = y + P + 45.8;
      ctx.translate(c, cy); ctx.scale(spk, spk); ctx.translate(-c, -cy);
      checkBadge(ctx, c, cy, 45.8);
    } else {
      ctx.font = F(400, 52);
      const bw = ctx.measureText(D.badge || 'Next').width + 52.392, bh = 52 * 1.2 + 26.196;
      const bx = x + S - P - bw / 2, by = y + P + bh / 2;
      ctx.translate(bx, by); ctx.scale(spk, spk); ctx.translate(-bx, -by);
      ctx.save();   // Figma 뱃지 그림자 0 0 39.294px rgba(0,0,0,.12)
      ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 39.294;
      rrFill(ctx, x + S - P - bw, y + P, bw, bh, 80, 'rgba(255,255,255,.9)');
      ctx.restore();
      txt(ctx, D.badge || 'Next', bx, by, 52, 400, NEU.t3, { ls: -1.6, align: 'center', base: 'middle' });
    }
    ctx.restore();
    // 좌하단 메타
    txt(ctx, D.time, x + P, y + S - P, 36, 400, done ? NEU.paper : NEU.t2, { ls: -1.64, base: 'bottom' });
    txt(ctx, D.lbl.toUpperCase(), x + P, y + S - P - 36 * 1.2 - 13.098, 64, 700, done ? '#fff' : NEU.inkDark, { ls: -3.27, base: 'bottom' });
  }

  // ── 리포트 (report.html) ──────────────────────────────────────────────────
  _paint_report() {
    const ctx = this.ctx, t = this.t, RP_ = RP[this.stage] || RP.BX_FIN;
    this._bgGlow();
    const y = this._titleGroup(200, RP_.sub, RP_.title) + 70;
    const cy = y + 250, r = 230;
    // ringPop .8s .35s + ringBreath 3s 1.3s ∞ / arcFill 1.3s .5s
    const e = eOut(intro(t, .35, .8)), br = cycle(t, 1.3, 3, INF);
    const p = eOut(clamp01((t - .5) / 1.3)) * (RP_.pct / 100);
    ctx.save();
    ctx.globalAlpha *= kf(e, [[0, 0], [.7, 1], [1, 1]]);
    const k = kf(e, [[0, .6], [.7, 1.05], [1, 1]]);
    ctx.translate(CX, cy); ctx.scale(k, k); ctx.translate(-CX, -cy);
    if (br != null) {
      const g = kf(br, [[0, 0], [.5, 1], [1, 0]]);
      ctx.shadowColor = `rgba(255,255,255,${.35 * g})`; ctx.shadowBlur = 26 * g;
    }
    ringGauge(ctx, CX, cy, r, p, { trackW: 16, arcW: 16, trackA: .22 });
    ctx.shadowBlur = 0;
    // % 카운트업
    const n = String(Math.round(RP_.pct * eOut(clamp01((t - .5) / 1.3))));
    ctx.font = F(700, 128.5, dot9); const nw = ctx.measureText(n).width;
    ctx.font = F(700, 90.3, dot9); const sw = ctx.measureText('%').width;
    txt(ctx, n, CX - (nw + sw + 8) / 2, cy, 128.5, 700, '#fff', { fam: dot9, ls: -3.57, base: 'middle' });
    txt(ctx, '%', CX - (nw + sw + 8) / 2 + nw + 8, cy + 12, 90.3, 700, '#fff', { fam: dot9, ls: -2.5, base: 'middle' });
    ctx.restore();
    // 통계 3열 — stat sUp .7s (1.0/1.15/1.3), sep sepGrow .6s 1.1s
    const sy = cy + 250 + 70, sW = 281, gap = 12;
    const total = sW * 3 + gap * 4 + 2;
    let x = CX - total / 2;
    RP_.stats.forEach(([kk, v], i) => {
      if (i) {
        const se = eOut(intro(t, 1.1, .6));
        ctx.save();
        ctx.globalAlpha *= se;
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x + gap, sy + 49.775 * (1 - se), 1, 99.55 * se);
        ctx.restore();
        x += gap * 2 + 1;
      }
      const e2 = eOut(intro(t, 1.0 + i * .15, .7));
      ctx.save();
      ctx.globalAlpha *= e2; ctx.translate(0, 48 * (1 - e2));
      txt(ctx, kk, x + sW / 2, sy, 39.2, 400, 'rgba(255,255,255,.7)', { ls: -1.5, align: 'center' });
      txt(ctx, v, x + sW / 2, sy + 39.2 * 1.2 + 18, 64, 700, '#fff', { ls: -1.5, align: 'center', fam: dot9 });   // 수치 = 도트폰트(유저 규칙)
      ctx.restore();
      x += sW;
    });
    // 버튼 — sUp .8s 1.4s + btnFloat 3.6s 2.3s ∞ + btnPulse 3s 2.3s ∞
    const be = eOut(intro(t, 1.4, .8)), bf = cycle(t, 2.3, 3.6, INF), bp = cycle(t, 2.3, 3, INF);
    this._button(sy + 141.8 + 70, BTN, be,
      48 * (1 - be) + (bf == null ? 0 : kf(bf, [[0, 0], [.5, -18], [1, 0]])),
      bp == null ? 0 : kf(bp, [[0, 0], [.5, 1], [1, 0]]));
  }
}
