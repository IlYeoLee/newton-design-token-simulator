// 마크 공통 언어 갤러리 — marks.html 의 구동부.
//   tokens.html(지면 토큰)과 같은 규율: **이 파일은 값을 하나도 갖지 않는다.**
//   좌표 정본 = session.js SB_POSE · 어휘 정본 = marklang.js. 여기 복사하면 갈린다.
//
//   보는 것: 농구 4/4단계(BK_B2~B5)를 공통 언어로 적었을 때 남김없이 적히는가.
//   못 적히는 칸이 나오면 축이 모자란 것이고, 그게 이 페이지의 목적이다.
//
// ponytail: 발 그림은 **도식**이다(실루엣 SDF 를 안 쓴다 — 실물 셰이더 뷰는 footlab.html).
//   여기서 검증하는 건 픽셀이 아니라 어휘다. 실물과 붙여봐야 하면 그때 footlab 을 옆에 연다.

import { SB_POSE, SB_BOX, sbPoseAt, STEP_SEG } from './session.js';
// ★ 화살표는 **정본 렌더러를 그대로 부른다**(유저 08-06: 룩 시스템 걸 이식하면 되잖아).
//   drawStemArrow 는 캔버스 2D 함수라 여기서 바로 쓸 수 있다 — 도식으로 다시 그리면 두 벌이 된다.
import { drawStemArrow } from './fx-core.js';
import { lutColor, drawGlyph, FXP } from './fxlut.js';
import { LOAD, MOVE, ENTER, EXIT, PHYS, VERDICT, LINK, BK_STEPBACK, physOf, AXES,
         FOOT_LEN_M, ZONE, MARK_LOOK_JSON, ARROW_DOT_K, arrowFor } from './marklang.js';

// ★ 빔 반폭(m) — 발/스탠스 **비율**을 실치수로 맞추기 위한 유일한 외부 값.
//   정확히는 projector rig 의 _halfAt(FOOT 밴드 거리)인데 랩은 정지 화면이라 상수로 둔다.
//   ponytail: 틀리면 발 크기 대 스탠스 폭 비율만 어긋난다. rig 연결이 필요해지면 그때 잇는다.
const BEAM_HALF_M = 0.62;
const LK = MARK_LOOK_JSON;   // footlab 이 굽는 정본 — 도트 피치·세기·색이 여기서 온다

const $ = s => document.querySelector(s);

// 단계별 영상 구간 = 이전 단계 끝 → 이 단계 끝 (STEP_SEG 가 끝점만 갖는다)
const IDS = ['BK_B2', 'BK_B3', 'BK_B4', 'BK_B5'];
const SEG = IDS.map((id, i) => ({ id, t0: i === 0 ? 0 : STEP_SEG[IDS[i - 1]], t1: STEP_SEG[id] }));
const COLS = [0, 0.25, 0.5, 0.75, 1];

// ── 좌표 변환 — 빔 박스(SB_BOX)를 칸에 맞춘다 ────────────────────────────────
const PADX = 0.14;
// ★ 두 축이 **같은 배율**을 써야 한다. 전엔 세로를 칸 높이에 꽉 채워 늘렸는데, 실측 박스는
//   가로 1.60(±0.80) · 세로 0.48 로 **3.3배 납작하다**. 그래서 화면에서 세로가 2.9배 늘어나
//   보폭·스탠스 간격이 통째로 왜곡됐다(유저 08-06: 다리 사이 간격이 어색하다 · 세로뷰가 너무 길다).
const uPer = W => (W * (1 - PADX * 2)) / (SB_BOX.u * 2);   // px / 빔단위 — 양축 공용
const VMID = (SB_BOX.v0 + SB_BOX.v1) / 2;
const toXY = (u, v, W, H) => { const k = uPer(W);
  return { x: W / 2 + u * k, y: H / 2 - (v - VMID) * k }; };
/** 칸 높이도 박스 비율에서 나온다 — 감으로 정한 190px 이 왜곡의 출발점이었다. */
export const cellH = W => Math.round((SB_BOX.v1 - SB_BOX.v0) * uPer(W) + FOOT_PX_PAD * 2);
const FOOT_PX_PAD = 34;   // 발 반길이 + 여백(발이 박스 경계에 걸쳐도 안 잘리게)

// ── 발 도식 — 실루엣이 아니라 **압력 도트**가 주인공이다 ──────────────────────
//   해부 좌표는 fx-core plantar 와 같은 자리를 쓴다(볼 +0.30 · 뒤꿈치 −0.44 · 발가락 +0.56).
const HOT = { ball: [0.02, 0.30, 0.34, 0.20], heel: [0.00, -0.44, 0.26, 0.22], toe: [0.17, 0.56, 0.16, 0.13] };

function drawFoot(g, x, y, len, load, opts = {}) {
  const { alpha = 1, right = false, ghost = false } = opts;
  const w = len * 0.40, sx = right ? 1 : -1;
  g.save(); g.translate(x, y); g.scale(sx, 1); g.globalAlpha = alpha;

  // 실루엣 — 얇은 윤곽만(도식). 압력이 주인공이라 여기서 힘주지 않는다.
  g.beginPath();
  g.ellipse(0, 0, w * 0.62, len * 0.5, 0, 0, Math.PI * 2);
  g.strokeStyle = ghost ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.28)';
  g.lineWidth = 1; g.stroke();

  // 압력 도트 — 격자에 찍고, 각 점의 알파 = 그 자리의 압력.
  //   ★ 피치·점 크기는 **mark-look.json 정본**에서 온다(uImpPitch=pitch · uImpDot=dot=반지름/피치).
  //     쿼드 좌표(±1 = FOOT_PLANE)를 이 칸의 발 길이로 환산해 실물과 같은 밀도로 찍는다.
  const pit = Math.max(2.2, LK.pitch * (len / 0.727) * 2);   // 0.727 = FOOT_FILL(실루엣 세로 채움비)
  for (let py = -len * 0.5; py <= len * 0.5; py += pit) {
    for (let px = -w * 0.62; px <= w * 0.62; px += pit) {
      const nx = px / (w * 0.62), ny = py / (len * 0.5);
      if (nx * nx + ny * ny > 1) continue;
      let p = 0;
      for (const k of ['ball', 'heel', 'toe']) {
        const [cx, cy, sxx, syy] = HOT[k];
        const dx = (nx * 0.5 - cx) / sxx, dy = (-ny * 0.6 - cy) / syy;
        p = Math.max(p, load[k] * Math.exp(-(dx * dx + dy * dy)));
      }
      if (p < 0.04) continue;   // 아치가 비는 자리 — 이게 발자국으로 읽히는 결정적 특징
      g.beginPath();
      g.arc(px, py, pit * Math.min(0.5, LK.dot), 0, Math.PI * 2);   // uImpDot = 반지름/피치 정본
      // 알파에 압력을 싣는 건 fx-core.js:1041 과 같은 규약(0.16 + 0.84*pr) — 화면과 랩이 같은 식
      g.fillStyle = `rgba(255,${Math.round(90 + 70 * (1 - p))},${Math.round(40 * (1 - p))},${(0.16 + 0.84 * p) * load.ink * LK.imp})`;
      g.fill();
    }
  }
  g.restore();
}

/** 화살표 = **LINE 정본(drawStemArrow) 그대로**. 토큰(marklang ARROW)은 두께·촉·점렬만 정한다.
 *  tokens.js makeFlowArrow 와 같은 규약: 128×256 캔버스에 위로 그린 뒤 방향으로 눕힌다. */
const _arrCv = document.createElement('canvas'); _arrCv.width = 128; _arrCv.height = 256;
const _arrCtx = _arrCv.getContext('2d');
const ARR_ENV = { lut: lutColor, glyph: drawGlyph, arrow: FXP.arrow || {} };
const ARR_USABLE = (256 - 24 - 58) / 256;   // 정본 스템이 캔버스에서 쓰는 세로 비율(y0=H-24 → y1=58)

function drawArrow(g, x0, y0, x1, y1, move, footLenPx, t, a = 0.85) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 6) return;
  const tok = arrowFor(move, Math.min(1, L / (footLenPx * 3)));
  if (!tok) return;
  // 정본 렌더 — prog 1 = 다 그려진 상태(draw-on 은 실물 시계가 돌린다)
  drawStemArrow(_arrCtx, 128, 256, t, ARR_ENV,
    { scale: tok.scale, dots: tok.dots, noTip: !tok.tips, prog: 1 });
  // 캔버스 '위'(0,-1)를 진행 방향으로 돌린다. 스템이 쓰는 구간만 L 이 되도록 h 를 늘린다.
  const h = L / ARR_USABLE, w = h / 2;
  g.save(); g.globalAlpha = a;
  g.translate(x0, y0); g.rotate(Math.atan2(dx, -dy));
  g.drawImage(_arrCv, -w / 2, -h + h * (24 / 256), w, h);   // 뿌리(y0=H-24)를 출발점에 맞춘다
  g.restore();
}

/** 한 칸 = 한 시각의 두 발. 반환값 = 그 시각의 어휘(패널·검증이 같이 읽는다). */
function drawCell(cv, id, vt, atEnd) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  // 빔 박스 — 어떤 단계·어떤 프레임에서도 마크가 이 밖으로 안 나간다(SB_BOX 규약)
  const a = toXY(-SB_BOX.u, SB_BOX.v0, W, H), b = toXY(SB_BOX.u, SB_BOX.v1, W, H);
  g.setLineDash([3, 3]); g.strokeStyle = 'rgba(90,200,255,.22)'; g.lineWidth = 1;
  g.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y); g.setLineDash([]);

  const P = sbPoseAt(vt, atEnd);
  const spec = BK_STEPBACK[id];
  // ★ 발 크기는 **실치수에서 나온다** — 감으로 정한 픽셀이 아니다.
  //   빔 반폭(BEAM_HALF_M)이 칸 안에서 몇 px 인지 알면 FOOT_LEN_M 이 몇 px 인지도 정해진다.
  //   그래야 "발자국 대 스탠스 폭" 비율이 화면과 같아지고, 크기 상한을 여기서 눈으로 판단할 수 있다.
  const pxPerM = (W * (1 - PADX * 2)) / (BEAM_HALF_M * 2);
  const len = FOOT_LEN_M * pxPerM;
  const out = {};

  for (const side of ['L', 'R']) {
    const q = P[side], s = spec[side];
    const ph = physOf(s.move, q.f, null);
    const here = toXY(q.u, q.v, W, H), dst = toXY(q.tu, q.tv, W, H);
    // 체공/슬라이드면 하중이 빠진다 — LOAD 는 '목표 하중'이고 실제는 물리가 정한다
    const load = (ph === 'air') ? LOAD.off : (ph === 'sliding' ? LOAD.drive : LOAD[s.load]);
    const air = ph === 'air' ? Math.sin(Math.PI * q.f) : 0;
    if (spec.link === 'arrow' && q.step) drawArrow(g, here.x, here.y, dst.x, dst.y, s.move, len, vt, ph === 'resting' ? 0.25 : 0.9);
    drawFoot(g, here.x, here.y, len * (1 + 0.10 * air), load,
      { alpha: ph === 'air' ? 0.30 + 0.25 * (1 - air) : ph === 'sliding' ? 0.72 : 1, right: side === 'R', ghost: ph === 'air' });
    out[side] = { phys: ph, load: (ph === 'air') ? 'off' : (ph === 'sliding' ? 'drive' : s.load), f: q.f, xy: here };
  }
  // 스탠스 선 — 폭 자체가 지시다(B2 '어깨너비보다 넓게', B5 '모음')
  if (spec.link === 'pair') {
    g.save(); g.setLineDash([2, 4]); g.strokeStyle = 'rgba(255,180,120,.45)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(out.L.xy.x, out.L.xy.y); g.lineTo(out.R.xy.x, out.R.xy.y); g.stroke();
    const mid = { x: (out.L.xy.x + out.R.xy.x) / 2, y: (out.L.xy.y + out.R.xy.y) / 2 };
    g.setLineDash([]); g.fillStyle = 'rgba(255,180,120,.75)'; g.font = '9px ui-monospace,monospace';
    g.textAlign = 'center';
    // 스탠스 폭은 **cm 로 적는다** — 이게 지시이므로 픽셀이 아니라 실치수여야 판단이 된다
    g.fillText(`${(Math.abs(out.L.xy.x - out.R.xy.x) / pxPerM * 100).toFixed(0)}cm`, mid.x, mid.y - 5);
    g.restore();
  }
  // 판정 존(발 배수) 참조 — 발 대 존 관계가 한 화면에 있어야 크기 상한이 읽힌다
  g.save(); g.globalAlpha = 0.30; g.setLineDash([2, 3]); g.strokeStyle = 'rgba(90,200,255,.7)';
  g.beginPath(); g.arc(out.R.xy.x, out.R.xy.y, ZONE.base * pxPerM, 0, Math.PI * 2); g.stroke();
  g.restore();
  return out;
}

// ── 그리드 ────────────────────────────────────────────────────────────────
const grid = $('#grid');
const cells = [];
for (const s of SEG) {
  const spec = BK_STEPBACK[s.id];
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div class="rowhd">
      <b>${spec.n}</b> <i>${spec.title}</i>
      <span class="cue">${spec.cue}</span>
      <span class="vocab">L ${spec.L.load}/${spec.L.move} · R ${spec.R.load}/${spec.R.move} · ${spec.link}</span>
      <span class="seg">${s.t0.toFixed(2)}~${s.t1.toFixed(2)}s</span>
    </div><div class="cols"></div>`;
  const colsEl = row.querySelector('.cols');
  for (const f of COLS) {
    const c = document.createElement('div');
    c.className = 'cell';
    const cv = document.createElement('canvas');
    cv.width = 230; cv.height = cellH(230);
    c.appendChild(cv);
    const cap = document.createElement('div'); cap.className = 'cap';
    c.appendChild(cap);
    colsEl.appendChild(c);
    cells.push({ id: s.id, vt: s.t0 + (s.t1 - s.t0) * f, atEnd: f >= 1, cv, cap });
  }
  grid.appendChild(row);
}

function paintGrid() {
  for (const c of cells) {
    const o = drawCell(c.cv, c.id, c.vt, c.atEnd);
    c.cap.textContent = `${c.vt.toFixed(2)}s  L:${PHYS[o.L.phys].label}/${LOAD[o.L.load].label}  R:${PHYS[o.R.phys].label}/${LOAD[o.R.load].label}`;
  }
}

// ── 라이브 스크럽 — 전 구간을 한 칸에서 이어 본다(움직임이 곧 검증) ───────────
const live = $('#live'), liveCap = $('#livecap'), slider = $('#t');
let T = 0, playing = true;
function paintLive() {
  const s = SEG.find(x => T <= x.t1) || SEG[SEG.length - 1];
  const o = drawCell(live, s.id, T, T >= s.t1 - 1e-3);
  liveCap.textContent = `${s.id} ${BK_STEPBACK[s.id].n} — ${T.toFixed(2)}s   `
    + `L ${PHYS[o.L.phys].label}·${LOAD[o.L.load].label}   R ${PHYS[o.R.phys].label}·${LOAD[o.R.load].label}`;
}
slider.max = String(STEP_SEG.BK_B5);
slider.addEventListener('input', () => { playing = false; T = +slider.value; paintLive(); $('#play').classList.remove('on'); });
$('#play').addEventListener('click', e => { playing = !playing; e.target.classList.toggle('on', playing); });

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing) { T = (T + dt) % STEP_SEG.BK_B5; slider.value = String(T); }
  paintLive();
  requestAnimationFrame(tick);
}

// ── 좌 패널 — 어휘 정의(marklang.js 가 정본, 여기선 나열만) ────────────────────
$('#panel').innerHTML = `<h1>마크 공통 언어</h1>
  <div class="sub">발자국·존원이 같이 쓰는 어휘. 테스트 모델 = 농구 4/4단계.<br>
    좌표 정본 <code>session.js SB_POSE</code> · 어휘 정본 <code>src/marklang.js</code></div>`
  + AXES.map(([k, ko, set]) => `<div class="grp"><h2>${k} — ${ko}</h2>`
      // ★ null 이 값이다 — ARROW.hold = null(안 움직이면 화살표도 없다). 없음도 어휘라서 지운 게 아니다.
      + Object.entries(set).map(([n, v]) =>
          `<div class="row2"><b>${n}</b><span>${v?.label ?? '없음'}</span><i>${v?.desc || ''}</i></div>`).join('')
      + `</div>`).join('')
  + `<div class="grp"><h2>SB_POSE — 좌표 정본</h2>`
  + SB_POSE.map(p => `<div class="row2 mono"><b>${p.t.toFixed(2)}s</b><span>L ${p.L.slice(0,2).join(',')}${p.L[3] ? ' ' + p.L[3] : ''}${p.L[2] ? ' toe' : ''}</span><i>R ${p.R.slice(0,2).join(',')}${p.R[2] ? ' toe' : ''}</i></div>`).join('')
  + `</div>`;

paintGrid();
requestAnimationFrame(tick);
