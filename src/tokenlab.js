// 지면 디자인 토큰 갤러리 — tokens.html 의 구동부.
//   왜: 값 하나를 말로 주고받으며 "간격 줄여 / 가운데정렬 다시 / 넘친다"를 반복하고 있었다(유저).
//   여기서 토큰을 만지면 러닝·농구 **전 지면이 동시에** 다시 그려진다. 화면으로 확정한다.
//
// ★ 이 파일은 값을 하나도 갖지 않는다. 정본은 floorgl.js 의 TOK 하나뿐이다.
//   여기에 기본값을 복사해 두면 시뮬과 갤러리가 갈린다 — 그게 지금까지 반복된 사고다.
import { FloorGL, TOK, LAYOUT, safeW, minFs } from './floorgl.js';

// 캔버스 20장을 원본 배율(K 0.75 → 1200×2002)로 띄우면 텍스처만 190MB 다. 갤러리는 작게 본다.
//   K 는 floorgl 이 **모듈 로드 시점에** location.search 에서 읽으므로 import 전에 정해져야 한다
//   → 파라미터가 없으면 붙여서 한 번 리로드한다(이 파일이 실행됐다는 건 이미 늦었으므로 최상단).
if (!new URLSearchParams(location.search).has('uiscale')) {
  const u = new URL(location.href); u.searchParams.set('uiscale', '0.34');
  location.replace(u.toString());
}

const $ = s => document.querySelector(s);
const SRC = {
  scene:      'ready-view/floor-scene.html',
  ready:      'ready-view/floor.html',
  readyBk:    'ready-view/floor-bk.html',
  transition: 'ready-view/floor-transition.html',
  timer:      'ready-view/floor-timer.html',
  report:     'ready-view/floor-report.html',
};
// 전 지면 목록 — floor-scenes.js(FLOOR_SCENES)와 main.js FLOOR_VIEWS 를 합친 것.
//   pv 가 있는 스테이지 = 관찰(프리뷰) 구간이 있는 것들. main.js 규약과 같은 정규식으로 판정한다.
const HAS_PV = /^(A2|A3|BK_A[23]|BK_B[12345])$/;
const STAGES = [
  { id: 'READY',   pack: 'run', src: SRC.ready,      note: '시작' },
  { id: 'A1',      pack: 'run' }, { id: 'A2', pack: 'run' }, { id: 'A3', pack: 'run' },
  { id: 'T1',      pack: 'run', src: SRC.transition, note: '전환' },
  { id: 'P1',      pack: 'run' }, { id: 'P2', pack: 'run' }, { id: 'P3', pack: 'run' },
  { id: 'C1',      pack: 'run', src: SRC.timer,      note: '카운트' },
  { id: 'C2',      pack: 'run' }, { id: 'C3', pack: 'run' }, { id: 'C4', pack: 'run' }, { id: 'C5', pack: 'run' },
  { id: 'FIN',     pack: 'run', src: SRC.report,     note: '리포트' },
  { id: 'BK_READY', pack: 'bk', src: SRC.readyBk,    note: '시작' },
  { id: 'BK_A1',   pack: 'bk' }, { id: 'BK_A3', pack: 'bk' }, { id: 'BK_B1', pack: 'bk' },
  { id: 'BK_B2',   pack: 'bk' }, { id: 'BK_B3', pack: 'bk' }, { id: 'BK_B4', pack: 'bk' }, { id: 'BK_B5', pack: 'bk' },
  { id: 'BK_C1',   pack: 'bk', src: SRC.timer,       note: '카운트' },
  { id: 'BK_C2',   pack: 'bk' },
  { id: 'BK_FIN',  pack: 'bk', src: SRC.report,      note: '리포트' },
];

// ── 되돌리기용 원본. TOK 를 건드리기 전에 딱 한 번 뜬다.
const BASE = { ...TOK };
// 제안안 = 이 대화에서 합의된 값. 지금 값과의 **차이만** 적는다(전체 복사 금지 — 갈린다).
const PROPOSED = { ember: 0, bgGlow: 0, collapse: 1, crumb: 0 };
// ── 확정안 — 감이 아니라 **계산 결과**다. 근거 전문: docs/FLOOR-LEGIBILITY.md
//
//  목표 시각도를 정하고 거기서 크기를 역산했다(반대가 아니다).
//    1급(타이틀·타이머 숫자)  0.55°  = ISO 9241-303 권장(20~22arcmin=0.37°)의 1.5배
//                                     운동 중 움직임 · 저대비 투사면 · 곁눈 훑기 3중 감점 보정
//    2급(배지·단위)           0.37°  = ISO 권장 그대로
//    절대 하한                0.20°  = Legge & Bigelow 2011 임계 활자 크기
//  링 지름 = 숫자 폰트 × 1.45 (원형 진행 표시 통상 비례. 지금은 2.5배라 링이 알약 높이의 67%를 먹었다)
//
//  ★ 신장 160~180cm 에서 필요 크기가 거의 같다 — 눈이 높아지면 거리도 같이 멀어져 상쇄된다.
//    한 벌로 전 사용자를 덮는다(실측: 160cm 72px / 180cm 72px).
//
//  결과 (러닝 0.687mm/px 기준)
//    알약  1183×388 → 787×200      81×27cm → 54×14cm     세로 −48% · 가로 −33%
//    시선점유(콘텐츠 면적 대비)      23.7% → 8.1%
//    타이틀 98px(0.79°) → 72px(0.56°)  — 임계의 2.8배, ISO 권장의 1.5배로 여전히 여유
//  유저: "콘텐츠 영역보다 타이틀 영역에 과하게 눈이 간다" → 그 비율이 3배 가까이 내려간다.
const COMPACT = {
  ...PROPOSED,
  ring: 52, pad: 48, gapT: 44,
  fsTitle: 72, fsTitlePv: 90, fsBadge: 48,
};

// ── 지면 인스턴스 ─────────────────────────────────────────────────────────
const DUR = 8;
const cells = [];
const grid = $('#grid');

for (const st of STAGES) {
  const src = st.src || SRC.scene;
  const gl = new FloorGL();
  const pv = HAS_PV.test(st.id) ? 3 : 0;
  const cell = document.createElement('div');
  cell.className = 'cell pack-' + st.pack;
  const label = st.note || (window.FLOOR_SCENES?.[st.id]?.title ?? '');
  cell.innerHTML = `<div class="hd"><b>${st.id}</b><i>${label}</i></div>
    <div class="stage"><div class="cv"></div></div>`;
  const stageEl = cell.querySelector('.cv');
  stageEl.appendChild(gl.canvas);
  grid.appendChild(cell);
  cells.push({ st, gl, src, pv, cell, stageEl, label, err: null });
}

/** 스테이지 재적재 — 토큰 중 **조판 구조**를 바꾸는 것(브레드크럼 유무 등)은 buildScene 이
 *  load() 때 한 번만 도므로 다시 태워야 반영된다. 값만 바꾸는 토큰은 repaint 로 충분하다. */
function reload() {
  for (const c of cells) {
    c.gl.load(c.st.id, { dur: DUR, pv: c.pv || 3, pvn: 0, src: c.src });
    c.gl.t = T;
  }
  repaint();
}
/** 한 지면의 페인트 — **반드시 격리한다.**
 *  한 스테이지가 던지면 루프가 통째로 죽어 나머지 24개가 빈 칸으로 남고, RAF 체인까지 끊겨
 *  시계가 0 에 얼어붙는다(실제로 그렇게 됐다 — `_paint_report` 의 `this._fadeIn` 부재).
 *  갤러리는 **깨진 화면을 보여주는 게 일**이므로, 죽은 스테이지는 칸에 표시하고 넘어간다. */
function safeUpdate(c, dt) {
  try { c.gl.update(dt); if (c.err) { c.err = null; c.cell.classList.remove('bad'); c.cell.querySelector('i').textContent = c.label; } }
  catch (e) {
    if (c.err !== String(e)) {
      c.err = String(e); c.cell.classList.add('bad');
      c.cell.querySelector('i').textContent = '⚠ ' + String(e.message || e).slice(0, 40);
      console.error(c.st.id, e);
    }
  }
}
/** 강제 다시 그리기 — FloorGL 은 서명이 같으면 페인트를 건너뛴다(텍스처 업로드 절약).
 *  토큰은 그 서명에 안 들어가므로 여기서 서명을 무효화해 준다. */
function repaint() {
  for (const c of cells) { c.gl._sig = null; c.gl._lastPaint = -1; safeUpdate(c, 0); }
  drawBands();
  dump();
}

// ── 시간 ─────────────────────────────────────────────────────────────────
// t=0 은 **모든 요소가 페이드 인 전**이라 화면이 통째로 비어 있다(유저: 보이지도 않는다).
//   기본값을 4.0 으로 둔다 — 관찰(pv 3s)이 끝나 따라하기 상태가 서 있는 시점.
let T = 4.0, playing = true, last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) {
    // ★ 되감기는 **상태 초기화가 동반돼야 한다**(유저: 루프 처음으로 돌아가도 첫 애니메이션이
    //   재생 안 됨). 시계만 0 으로 되돌리면 페인터 래치(_moT·_headW·_lastPaint …)가 끝난 상태로
    //   남아 등장 모션이 통째로 건너뛰어진다. FloorGL.resetAnim() 이 그걸 전부 지운다.
    const wrapped = T + dt >= DUR;
    T = (T + dt) % DUR;
    for (const c of cells) {
      if (wrapped) c.gl.resetAnim();
      c.gl.t = T - dt; safeUpdate(c, dt);
    }
    $('#scrub').value = T.toFixed(2);
    $('#tlabel').textContent = `t ${T.toFixed(2)} / ${DUR.toFixed(2)}`;
  }
  requestAnimationFrame(tick);
}

// ── 영역 오버레이 ─────────────────────────────────────────────────────────
//  유저: "이미지 재생영역 / 실제 눈에 들어오는 가시영역이 표시가 안 되니 구분이 안 간다.
//         컨텐츠 영역에 비해 얼마나 큰지를 알아야 하지 않나."  맞다 — 그래서 넷을 겹쳐 그린다.
//
//   ① 투사 콘   = 프로젝터 빛이 **닿는** 범위(safeW). 대지는 직사각인데 투사면은 사다리꼴이라
//                 아래로 갈수록 좁다. ★ 이건 '가시영역'이 아니다 — 빛이 닿아도 안 읽히는 구간이 있다.
//   ①' 가독     = 눈에 **읽히는** 범위. 바닥은 스치는 각도로 보여 먼 쪽(대지 위쪽)이 심하게 눌린다.
//                 minFs(y) = 68 − 40·(y/2670) 이 그 모델이다(165cm 사용자 기준 최소 활자).
//                 y 가 작을수록(멀수록) 더 큰 글자를 요구한다 → 상단이 가장 위험하다.
//                 유저: "레디 화면도 1인칭에선 끝이 잘릴 정도로 안 보인다" — 그 구간을 칠해서 보여준다.
//   ② 콘텐츠    = CONTENT 밴드. LAYOUT 주석이 "인물 영상·판정 마크가 쓰는 영역" 이라고
//                 스스로 선언한 자리다. 코치 영상 크기를 따로 추정하지 않는다(추정은 틀린다).
//   ③ 알약      = **측정값**. 페인터가 `_boxes` 에 넣은 실제 좌표 그대로.
//   ④ 밴드선    = HEAD / 알약끝 / PROG / CONTENT / FOOT 경계
const PW = 1600, PH = 2670;
const NS = 'http://www.w3.org/2000/svg';
const OV = { cone: true, legible: true, content: true, pill: true, band: false };
// 대지 1px = 몇 mm 인가. floorgl 주석 실측(러닝 fpNear .3 / fpFar 2.0 → sUni 0.000687 m/px).
//   ★ 농구는 fpFar 가 2.4 라 이 값이 아니다 — 그 값은 **농구 모드에서 rig 를 읽어 재야** 한다
//     (floorgl LAYOUT 주석도 같은 경고를 달고 있다). 그래서 여기선 손으로 바꾸게 열어 둔다.
let MMPX = 0.687;
const cm = px => (px * MMPX / 10).toFixed(0);

// ── 가독 모델 (외부 근거 기반) ─────────────────────────────────────────────
//  ★ 기존 `minFs(y) = 68 − 40·(y/2670)` 은 **출처가 없는 선형식**이다. 실측해 보니 가장 엄격한
//    외부 기준보다도 1.7~2.5배 보수적이었다 — 우연히 안전한 쪽이었을 뿐 근거가 아니다.
//    여기서는 시각도로 다시 세운다.
//
//  바닥 글자는 스치는 각도로 눌린다. 눈높이 E, 바닥점까지 수평거리 x 일 때
//    d = √(E² + x²)   ·   sinα = E/d   ·   θ ≈ h·sinα/d = h·E/d²
//    ⇒ 필요 물리 높이  h = θ·d²/E
//
//  기준 (검증 2026-08-06):
//    0.20°  임계 활자 크기(critical print size) · **x-height** 기준
//           Legge & Bigelow 2011, Journal of Vision 11(5):8 · doi 10.1167/11.5.8
//           유창 독서 범위는 x-height 0.2°~2° (10배 구간)
//    0.27~0.37° (16~22 arcmin) · **문자 높이** 기준 · ISO 9241-303
//           "최소 16 arcmin, 시스템은 20~22 arcmin 제공 가능해야 한다"
//    0.083° (5 arcmin) = 20/20 판별 한계(Snellen 정의) — 읽기가 아니라 '보이느냐'의 선
//  눈높이 = 신장 × 0.936 (Drillis & Contini 1966 인체분절 비율)
//
//  ★ 두 기준의 측정 대상이 다르다 — Legge 는 x-height, ISO 는 문자 높이.
//    지면 타이틀은 **전부 대문자** 규약이므로 문자 높이 = 대문자 높이로 보고,
//    폰트 크기 → 대문자 높이는 0.72 배로 환산한다(Supreme 계열 sans 통상값).
const CAP_RATIO = 0.72;
let STATURE = 170, FAR = 2.0, TARGET_DEG = 0.37;
const eyeH = () => STATURE / 100 * 0.936;
/** 대지 y → 발 앞 수평거리(m). main.js boardFwd 식과 같은 규약:
 *  대지 상단(y176)이 투사 far 끝에서 0.12m 앞에 온다. */
const yToFwd = y => (FAR - 0.12) - (y - 176) * (MMPX / 1000);
/** 그 자리에서 목표 시각도를 채우는 데 필요한 **대문자 높이**(cm) */
function needCm(y, deg = TARGET_DEG) {
  const E = eyeH(), x = Math.max(0.05, yToFwd(y));
  return deg * Math.PI / 180 * (E * E + x * x) / E * 100;
}
/** 폰트 크기(대지 px) → 그 자리에서의 실제 시각도(°) */
function angleOf(fs, y) {
  const E = eyeH(), x = Math.max(0.05, yToFwd(y));
  return (fs * CAP_RATIO * MMPX / 1000) * E / (E * E + x * x) * 180 / Math.PI;
}
/** 목표 시각도를 채우는 최소 폰트 크기(대지 px) */
const needFs = (y, deg = TARGET_DEG) => needCm(y, deg) * 10 / MMPX / CAP_RATIO;

function drawOverlay() {
  for (const c of cells) {
    c.stageEl.querySelector('svg.ov')?.remove();
    const box = (c.gl._boxes || []).find(b => b.k === 'pill');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ov');
    svg.setAttribute('viewBox', `0 0 ${PW} ${PH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const add = (tag, attrs, txt) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (txt != null) e.textContent = txt;
      svg.appendChild(e); return e;
    };
    if (OV.cone) {
      const L = [], R = [];
      for (let i = 0; i <= 20; i++) {
        const y = PH * i / 20, hw = safeW(y) / 2;
        L.push(`${(PW / 2 - hw).toFixed(0)},${y.toFixed(0)}`);
        R.unshift(`${(PW / 2 + hw).toFixed(0)},${y.toFixed(0)}`);
      }
      add('polygon', { points: [...L, ...R].join(' '), fill: 'none',
        stroke: 'rgba(120,220,255,.8)', 'stroke-width': 5, 'stroke-dasharray': '26 18' });
      // 상단은 콘이 대지보다 **넓다**(y176 → 2174 > 1600) — 잘려 안 보이므로 글로 적는다.
      //   하단은 반대로 콘이 좁아 대지가 콘 밖으로 나간다. 그게 이 오버레이의 요점이다.
      add('text', { x: 16, y: 120, fill: 'rgba(120,220,255,.95)', 'font-size': 50,
        'font-family': 'sans-serif' }, `↑ y176 가시폭 ${Math.round(safeW(176))} (대지 1600 밖)`);
      add('text', { x: PW / 2 - safeW(PH * .93) / 2 + 16, y: PH * .93, fill: 'rgba(120,220,255,.95)',
        'font-size': 52, 'font-family': 'sans-serif' },
        `↓ 가시폭 ${Math.round(safeW(PH * .93))} · 대지 1600 이 콘 밖으로`);
    }
    // 가독 위험 구간 — 지금 타이틀 크기(TOK.fsTitle)가 minFs(y) 를 **못 넘는** y 범위를 칠한다.
    //   minFs 는 y 가 작을수록 커지므로, 못 넘는 구간은 언제나 대지 **위쪽**의 띠가 된다.
    //   ★ 이건 '빛이 안 닿는다'가 아니라 '닿아도 안 읽힌다' 다. 투사 콘과 다른 축이다.
    if (OV.legible) {
      // 시각도 모델(§ docs/FLOOR-LEGIBILITY.md)로 판정한다 — 출처 없는 minFs 가 아니라.
      let yCut = 0;
      for (let y = 0; y <= PH; y += 10) { if (needFs(y) > TOK.fsTitle) yCut = y; else break; }
      if (yCut > 0) {
        add('rect', { x: 0, y: 0, width: PW, height: yCut, fill: 'rgba(255,70,70,.16)' });
        add('line', { x1: 0, y1: yCut, x2: PW, y2: yCut, stroke: 'rgba(255,90,90,.9)', 'stroke-width': 6 });
        add('text', { x: 16, y: yCut - 18, fill: 'rgba(255,120,110,1)', 'font-size': 52,
          'font-family': 'sans-serif' },
          `${TARGET_DEG.toFixed(2)}° 미달 — y<${yCut} 은 ${Math.ceil(needFs(0))}px 필요 (지금 ${TOK.fsTitle})`);
      }
    }
    if (OV.content) {
      const y0 = LAYOUT.CONTENT_Y0, y1 = LAYOUT.CONTENT_Y1, hw = safeW((y0 + y1) / 2) / 2;
      add('rect', { x: PW / 2 - hw, y: y0, width: hw * 2, height: y1 - y0,
        fill: 'rgba(110,240,150,.07)', stroke: 'rgba(110,240,150,.75)', 'stroke-width': 5 });
      add('text', { x: PW / 2 - hw + 16, y: y0 + 62, fill: 'rgba(110,240,150,.95)',
        'font-size': 52, 'font-family': 'sans-serif' },
        `콘텐츠(인물·마크) ${Math.round(hw * 2)}×${Math.round(y1 - y0)}  ${cm(hw * 2)}×${cm(y1 - y0)}cm`);
    }
    if (OV.pill && box) {
      add('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: Math.min(box.w, box.h) / 2,
        fill: 'rgba(255,140,60,.10)', stroke: 'rgba(255,140,60,.95)', 'stroke-width': 6 });
      add('text', { x: box.x, y: box.y - 22, fill: 'rgba(255,170,90,1)',
        'font-size': 54, 'font-family': 'sans-serif' },
        `알약 ${Math.round(box.w)}×${Math.round(box.h)}  ${cm(box.w)}×${cm(box.h)}cm`);
    }
    if (OV.band) {
      for (const [label, y] of [['HEAD', LAYOUT.HEAD.y], ['알약끝', LAYOUT.HEAD.y + LAYOUT.CAPHEAD_H],
                                ['PROG', LAYOUT.PROG_Y], ['CONTENT', LAYOUT.CONTENT_Y0], ['FOOT', LAYOUT.FOOT_Y]]) {
        add('line', { x1: 0, y1: y, x2: PW, y2: y, stroke: 'rgba(255,255,255,.45)',
          'stroke-width': 3, 'stroke-dasharray': '14 12' });
        add('text', { x: 10, y: y - 12, fill: 'rgba(255,255,255,.7)', 'font-size': 44,
          'font-family': 'sans-serif' }, `${label} ${Math.round(y)}`);
      }
    }
    c.stageEl.appendChild(svg);
  }
  // 비율 요약 — "콘텐츠에 비해 얼마나 큰가" 를 숫자로 한 줄
  const b = cells.find(c => (c.gl._boxes || []).some(x => x.k === 'pill'))?.gl._boxes.find(x => x.k === 'pill');
  const cy0 = LAYOUT.CONTENT_Y0, cy1 = LAYOUT.CONTENT_Y1, chw = safeW((cy0 + cy1) / 2);
  const cArea = chw * (cy1 - cy0);
  $('#ratio').textContent = b
    ? `알약 ${Math.round(b.w)}×${Math.round(b.h)} (${cm(b.w)}×${cm(b.h)}cm) · 콘텐츠 면적의 ${(b.w * b.h / cArea * 100).toFixed(1)}%`
    : '알약 없음';
}
const drawBands = drawOverlay;   // 기존 호출부 이름 유지

// ── 패널 바인딩 ───────────────────────────────────────────────────────────
const fmt = v => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
function syncUI() {
  document.querySelectorAll('[data-t]').forEach(el => { el.value = TOK[el.dataset.t]; });
  document.querySelectorAll('[data-v]').forEach(el => { el.textContent = fmt(TOK[el.dataset.v]); });
  document.querySelectorAll('[data-s]').forEach(el => { el.checked = !!TOK[el.dataset.s]; });
}
function dump() {
  const diff = Object.keys(TOK).filter(k => TOK[k] !== BASE[k])
    .map(k => `  ${k}: ${fmt(TOK[k])},   // was ${fmt(BASE[k])}`);
  $('#dump').value = diff.length
    ? `// src/floorgl.js  TOK 에 반영할 값\n${diff.join('\n')}`
    : '// 기본값과 같음 — 바꾼 토큰이 없습니다';
}

document.querySelectorAll('[data-t]').forEach(el => {
  el.addEventListener('input', () => {
    TOK[el.dataset.t] = +el.value;
    document.querySelector(`[data-v="${el.dataset.t}"]`).textContent = fmt(TOK[el.dataset.t]);
    repaint();
  });
});
// 구조 스위치 — buildScene 을 다시 태워야 반영된다
document.querySelectorAll('[data-s]').forEach(el => {
  el.addEventListener('change', () => { TOK[el.dataset.s] = el.checked ? 1 : 0; reload(); });
});
document.querySelectorAll('[data-ov]').forEach(el => {
  el.checked = OV[el.dataset.ov];
  el.addEventListener('change', () => { OV[el.dataset.ov] = el.checked; drawOverlay(); });
});
$('#mmpx').addEventListener('input', e => { MMPX = +e.target.value || 0.687; applyZoom(); drawOverlay(); });
// ★ 크롭은 **기본 꺼짐**이다. 대지는 1600×2670 = 세로로 긴 판인데 y1500 에서 잘라 보여주면
//   정사각처럼 보인다 — 비율을 재려고 만든 화면에서 비율을 속이는 짓이다(유저 지적).
//   콘텐츠가 세로로 길게 투사된다는 사실 자체가 이 화면이 보여줘야 할 정보다.
$('#sw-crop').addEventListener('change', e => grid.classList.toggle('crop', e.target.checked));

// ── 실측 배율 ─────────────────────────────────────────────────────────────
//  유저: "시스템 미리보기도 아예 실제 투사 대지영역 사이즈로 보게 해줘."
//  칸 폭을 화면 임의 값이 아니라 **물리 치수에서** 만든다:
//     대지 1600px × MMPX mm/px = 물리 폭(mm) → cm → CSS px(96dpi) → × 배율
//  배율 100% 면 모니터에 자를 대고 잰 값이 실제 바닥 투사 크기다.
//  ★ 96dpi 는 CSS 규약값이지 실제 패널 DPI 가 아니다. 정확히 맞추려면 모니터에서 한 번 재고
//    mm/px 를 보정할 것 — 그래서 그 칸을 손으로 고칠 수 있게 열어 뒀다.
const CSSPX_PER_CM = 96 / 2.54;   // 37.795
let zoom = 0.05;
function applyZoom() {
  const plateCm = PW * MMPX / 10;                   // 1600px → cm
  const wpx = plateCm * CSSPX_PER_CM * zoom;
  for (const c of cells) c.cell.style.width = wpx.toFixed(1) + 'px';
  $('#zoomv').textContent = Math.round(zoom * 100) + '%';
  $('#realnote').textContent =
    `대지 ${plateCm.toFixed(1)}×${(PH * MMPX / 10).toFixed(1)}cm · 칸 폭 ${wpx.toFixed(0)}px @96dpi`;
}
$('#zoom').addEventListener('input', e => { zoom = +e.target.value; applyZoom(); });
$('#real').addEventListener('click', () => { zoom = 1; $('#zoom').value = 1; applyZoom(); });

function preset(obj, btn) {
  Object.assign(TOK, BASE, obj);
  document.querySelectorAll('#p-now,#p-new,#p-compact').forEach(b => b.classList.remove('on'));
  btn?.classList.add('on');
  syncUI(); reload();
}
$('#p-now').addEventListener('click', e => preset({}, e.target));
$('#p-new').addEventListener('click', e => preset(PROPOSED, e.target));
$('#p-compact').addEventListener('click', e => preset(COMPACT, e.target));
$('#p-reset').addEventListener('click', () => preset({}, $('#p-now')));
$('#copy').addEventListener('click', () => navigator.clipboard?.writeText($('#dump').value));

$('#play').addEventListener('click', e => {
  playing = !playing; e.target.classList.toggle('on', playing);
  e.target.textContent = playing ? '⏸ 정지' : '▶ 재생';
});
$('#scrub').addEventListener('input', e => {
  playing = false; $('#play').classList.remove('on'); $('#play').textContent = '▶ 재생';
  T = +e.target.value;
  $('#tlabel').textContent = `t ${T.toFixed(2)} / ${DUR.toFixed(2)}`;
  for (const c of cells) { c.gl.t = T; }
  repaint();
});

// ── 가독 근거 패널 ────────────────────────────────────────────────────────
const LEG_ROWS = [
  ['알약', () => LAYOUT.HEAD.y], ['아크', () => LAYOUT.PROG_Y],
  ['콘텐츠', () => LAYOUT.CONTENT_Y0], ['발자국', () => LAYOUT.FOOT_Y],
];
function syncLeg() {
  $('#statv').textContent = STATURE; $('#farv').textContent = FAR.toFixed(2);
  $('#angv').textContent = TARGET_DEG.toFixed(2);
  const E = eyeH();
  let h = `<tr style="color:#8a8a94"><td>자리</td><td align=right>앞거리</td><td align=right>스침각</td>`
        + `<td align=right>필요</td><td align=right>지금</td></tr>`;
  for (const [name, fy] of LEG_ROWS) {
    const y = fy(), x = Math.max(0.05, yToFwd(y)), a = Math.asin(E / Math.hypot(E, x)) * 180 / Math.PI;
    const need = needCm(y), have = TOK.fsTitle * CAP_RATIO * MMPX / 10;
    const ok = have >= need;
    h += `<tr style="border-top:1px solid #26262b"><td>${name}</td>`
       + `<td align=right>${x.toFixed(2)}m</td><td align=right>${a.toFixed(0)}°</td>`
       + `<td align=right>${need.toFixed(1)}cm</td>`
       + `<td align=right style="color:${ok ? '#8de08d' : '#ff7b6b'}">${have.toFixed(1)}cm</td></tr>`;
  }
  $('#legtbl').innerHTML = h;
}
for (const [id, set] of [['stat', v => STATURE = v], ['far', v => FAR = v], ['ang', v => TARGET_DEG = v]])
  $('#' + id).addEventListener('input', e => { set(+e.target.value); syncLeg(); drawOverlay(); });

// 근거 문서 — 리포에 있는 docs/FLOOR-LEGIBILITY.md 를 그대로 띄운다(정본 하나).
$('#openref').addEventListener('click', async () => {
  const GH = 'https://github.com/IlYeoLee/newton-design-token-simulator/blob/main/docs/FLOOR-LEGIBILITY.md';
  let md = null;
  try { const r = await fetch('/docs/FLOOR-LEGIBILITY.md'); if (r.ok) md = await r.text(); } catch {}
  if (!md) return void window.open(GH, '_blank');
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99;overflow:auto;padding:32px';
  bg.innerHTML = `<article style="max-width:820px;margin:0 auto;background:#16161a;border:1px solid #2c2c34;
    border-radius:10px;padding:28px 34px;line-height:1.75;font-size:14px;color:#dcdce2"></article>`;
  // 최소 마크다운 — 이 문서에 쓴 문법만 처리한다(표·제목·코드·굵게·링크·목록·수평선)
  const esc = t => t.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const inl = t => esc(t).replace(/`([^`]+)`/g, '<code style="background:#0d0d10;padding:1px 5px;border-radius:3px;color:#8de08d">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b style="color:#fff">$1</b>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#78dcff">$1</a>');
  const out = []; let inCode = false, tbl = null;
  for (const ln of md.split('\n')) {
    if (/^```/.test(ln)) { out.push(inCode ? '</pre>' : '<pre style="background:#0d0d10;border:1px solid #26262b;border-radius:6px;padding:12px;overflow-x:auto;font-size:12px;line-height:1.5;color:#9fd4ff">'); inCode = !inCode; continue; }
    if (inCode) { out.push(esc(ln)); continue; }
    const isRow = /^\|/.test(ln);
    if (isRow && /^\|[\s:|-]+\|$/.test(ln)) continue;
    if (isRow) {
      const cells = ln.split('|').slice(1, -1).map(c => `<td style="padding:5px 9px;border-top:1px solid #2c2c34;vertical-align:top">${inl(c.trim())}</td>`).join('');
      if (!tbl) { tbl = true; out.push('<table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0">'); }
      out.push('<tr>' + cells + '</tr>'); continue;
    }
    if (tbl) { out.push('</table>'); tbl = null; }
    const hm = /^(#{1,4})\s+(.*)$/.exec(ln);
    if (hm) { const s = [26, 20, 16, 14][hm[1].length - 1]; out.push(`<h${hm[1].length} style="font-size:${s}px;margin:22px 0 8px;color:#fff">${inl(hm[2])}</h${hm[1].length}>`); continue; }
    if (/^---+$/.test(ln)) { out.push('<hr style="border:0;border-top:1px solid #2c2c34;margin:20px 0">'); continue; }
    if (/^[-*]\s+/.test(ln)) { out.push(`<div style="padding-left:16px">• ${inl(ln.replace(/^[-*]\s+/, ''))}</div>`); continue; }
    if (/^>\s?/.test(ln)) { out.push(`<div style="border-left:3px solid #fa6030;padding:2px 0 2px 12px;margin:6px 0;color:#b8b8c2">${inl(ln.replace(/^>\s?/, ''))}</div>`); continue; }
    out.push(ln.trim() ? `<p style="margin:8px 0">${inl(ln)}</p>` : '');
  }
  if (tbl) out.push('</table>');
  bg.querySelector('article').innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
       <a href="${GH}" target="_blank" style="color:#78dcff;font-size:12px">GitHub 에서 보기 ↗</a>
       <button style="background:#26262d;color:#e8e8ea;border:1px solid #35353d;border-radius:6px;padding:5px 12px;cursor:pointer">닫기</button>
     </div>` + out.join('\n');
  bg.querySelector('button').onclick = () => bg.remove();
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  document.body.appendChild(bg);
});

function packFilter(which, btn) {
  document.querySelectorAll('#pk-all,#pk-run,#pk-bk').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  for (const c of cells) c.cell.style.display = (which === 'all' || c.st.pack === which) ? '' : 'none';
}
$('#pk-all').addEventListener('click', e => packFilter('all', e.target));
$('#pk-run').addEventListener('click', e => packFilter('run', e.target));
$('#pk-bk').addEventListener('click', e => packFilter('bk', e.target));

// 웹폰트가 붙기 전에 그리면 시스템 폰트로 한 번 찍힌다 — 로드 후 다시 그린다.
Promise.all(['700 100px Supreme', '500 100px Supreme', '700 100px OffBit']
  .map(f => document.fonts?.load(f).catch(() => {}))).then(repaint);

syncUI();
applyZoom();
reload();
requestAnimationFrame(tick);
window.__cells = cells;
window.__TOK = TOK;
