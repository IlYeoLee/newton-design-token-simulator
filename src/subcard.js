// ═══ 코치 자막 카드 — 에펙 정본(AE_Sub_{복싱,러닝,농구}.jsx)의 웹 이식 ══════════════
//   세 스크립트는 디자인이 **동일**하고 대사와 아바타만 다르다. 그래서 여기도 한 벌이고
//   종목은 아바타 경로만 갈아끼운다.
//
//   구조(에펙과 같은 순서로 쌓인다):
//     ROW  = 아바타(원형) + 간격 + 미니 파형(7 캡슐 막대)      ← 카드 **바깥 위쪽**
//     CARD = 완전 알약(라운드 = 높이/2), 검정 30%, 안에 EN 한 줄
//
//   치수는 전부 컴프 높이 H 비율이다(에펙 CFG 그대로). 웹에선 스테이지 높이를 H 로 쓰고
//   리사이즈마다 다시 만든다 — 비율이 정본이라 화면이 커져도 같은 그림이 나온다.
const CFG = {
  enSize: 0.026, krSize: 0.019, krOn: false, krOpacity: 80,
  enTracking: -0.020, krTracking: -0.020,          // 에펙 1/1000 em → em
  avatarR: 0.016, avatarGap: 0.014,
  cardOpacity: 0.30, padX: 0.055, padY: 0.030,
  edgePct: 0.045, minTextW: 0.16,
  springFreq: 17, springDecay: 9, openFrom: 0.55,
  gapRowCard: 0.007, gapEnKr: 0.012,
  fadeIn: 0.45, fadeOut: 0.35, riseDist: 0.022, overshoot: 1.1,
  inDur: 0.45, krDelay: 0.08, txtRise: 0.013,
  barCount: 7, loopDur: 3.2, waveAmp: 1.4, idleFloor: 0.08,
  barW: 0.0028, barGap: 2.2, barMaxH: 0.018, barMinH: 0.0028,
  // 종목별 아바타 — 에펙 CFG 의 avatarPath/Focus/Crop 을 그대로 옮긴 것
  avatars: {
    boxing:     { src: 'avatars/boxing.png',     focus: [0.490, 0.455], crop: 0.72 },
    running:    { src: 'avatars/running.png',    focus: [0.590, 0.405], crop: 0.78 },
    basketball: { src: 'avatars/basketball.png', focus: [0.492, 0.285], crop: 0.31 },
  },
};

export function createSubCard(root, baseUrl = '') {
  const el = {
    wrap: root,
    row:  root.querySelector('.vc-row'),
    av:   root.querySelector('.vc-av'),
    avImg: root.querySelector('.vc-av img'),
    wave: root.querySelector('.vc-wave'),
    card: root.querySelector('.vc-card'),
    en:   root.querySelector('#vc-text'),
    kr:   root.querySelector('#vc-kr'),
  };
  const bars = [];
  for (let i = 0; i < CFG.barCount; i++) { const b = document.createElement('i'); el.wave.appendChild(b); bars.push(b); }

  let H = 0, R = 0, minTextW = 0, padX = 0;
  let sport = null;   // null 로 시작해야 첫 setSport 가 실제로 아바타를 건다(같은 값이면 조기 반환한다)
  let shownAt = -1e9, hideAt = -1e9;      // 초 단위 (performance.now/1000)
  let wPrev = 0, wCur = 0, wFirst = true; // 카드 폭 스프링
  let speaking = false;

  /** 치수를 다시 잡는다. 에펙은 H(컴프 높이) 비율이므로 여기서도 스테이지 높이만 본다. */
  function layout() {
    H = root.parentElement?.clientHeight || window.innerHeight;
    R = Math.round(H * CFG.avatarR);
    padX = Math.round(H * CFG.padX);
    minTextW = Math.round(H * CFG.minTextW);
    const padY = Math.round(H * CFG.padY);
    const enPx = Math.round(H * CFG.enSize);
    const krPx = Math.round(H * CFG.krSize);

    el.av.style.cssText = `width:${R * 2}px;height:${R * 2}px`;
    el.row.style.gap = `${Math.round(H * CFG.avatarGap)}px`;
    el.row.style.marginBottom = `${Math.round(H * CFG.gapRowCard)}px`;
    el.wave.style.height = `${Math.round(H * CFG.barMaxH)}px`;
    el.wave.style.gap = `${(H * CFG.barW * (CFG.barGap - 1)).toFixed(2)}px`;
    for (const b of bars) { b.style.width = `${(H * CFG.barW).toFixed(2)}px`; b.style.borderRadius = `${(H * CFG.barW / 2).toFixed(2)}px`; }

    el.card.style.padding = `${padY}px ${padX}px`;
    el.card.style.borderRadius = '999px';                 // 완전한 알약(에펙: 라운드 = 높이/2)
    el.en.style.cssText = `font-size:${enPx}px;letter-spacing:${CFG.enTracking}em`;
    el.kr.style.cssText = `font-size:${krPx}px;letter-spacing:${CFG.krTracking}em;` +
      `opacity:${CFG.krOpacity / 100};margin-top:${Math.round(H * CFG.gapEnKr)}px;` +
      `display:${CFG.krOn ? 'block' : 'none'}`;
    root.style.setProperty('--vc-rise', `${Math.round(H * CFG.riseDist)}px`);
    root.style.setProperty('--vc-txt-rise', `${Math.round(H * CFG.txtRise)}px`);

    fitAvatar();
  }

  /** 에펙 아바타 규약: focus 지점이 원의 중심, crop 비율만큼의 이미지 폭이 지름이 된다. */
  function fitAvatar() {
    const a = CFG.avatars[sport] || CFG.avatars.boxing;
    if (!a) return;
    const iw = el.avImg.naturalWidth, ih = el.avImg.naturalHeight;
    if (!iw || !ih) return;
    const w = (R * 2) / a.crop, h = w * ih / iw;
    el.avImg.style.cssText =
      `width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;` +
      `left:${(R - a.focus[0] * w).toFixed(1)}px;top:${(R - a.focus[1] * h).toFixed(1)}px`;
  }

  function setSport(s) {
    if (!CFG.avatars[s] || s === sport) return;
    sport = s;
    el.avImg.src = baseUrl + CFG.avatars[s].src;
    el.avImg.onload = fitAvatar;
  }

  /** 문장 폭 실측 — 카드가 글자에 맞춰 늘고 줄기 때문에 매번 잰다(에펙 sourceRectAtTime). */
  const ruler = document.createElement('span');
  ruler.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
  function measure(text) {
    ruler.style.font = getComputedStyle(el.en).font;
    ruler.style.letterSpacing = getComputedStyle(el.en).letterSpacing;
    ruler.textContent = text;
    if (!ruler.parentNode) document.body.appendChild(ruler);
    return Math.max(ruler.getBoundingClientRect().width, minTextW) + padX * 2;
  }

  function show(text, sportId) {
    if (sportId) setSport(sportId);
    if (!H) layout();
    el.en.textContent = text;
    // 카드 폭 스프링 — 이전 폭에서 새 폭으로 가되 목표를 지나쳤다 몇 번 튕기고 잦아든다.
    //   첫 등장엔 직전 폭이 없으므로 좁은 폭(openFrom)에서 열린다(에펙과 같은 규약).
    wPrev = wFirst ? measure(text) * CFG.openFrom : wCur;
    wCur = measure(text);
    wFirst = false;
    shownAt = performance.now() / 1000;
    hideAt = 1e9;
    speaking = true;
    root.classList.add('on');
  }

  function hide() { hideAt = performance.now() / 1000; speaking = false; }

  /** 매 프레임 — 폭 스프링 · 등장 오버슈트 · 파형. 전부 에펙 표현식과 같은 식이다. */
  function tick() {
    requestAnimationFrame(tick);
    if (!H) return;
    const now = performance.now() / 1000;
    const e = now - shownAt;
    if (e < 0) return;

    // ① 카드 폭 — 감쇠 스프링. sin 항이 있어야 e=0 에서 속도가 0 이라 출발이 안 튄다.
    const f = CFG.springFreq, d = CFG.springDecay;
    const g = Math.exp(-d * e) * (Math.cos(f * e) + (d / f) * Math.sin(f * e));
    const w = wCur + (wPrev - wCur) * g;
    if (isFinite(w) && w > 0) el.card.style.width = `${w.toFixed(1)}px`;

    // ② 덩어리 등장 — easeOutBack. 목표를 살짝 지나쳤다 되돌아와 안착한다(쫀득함).
    const fi = CFG.fadeIn * 1.5;
    const t = Math.min(Math.max(e / fi, 0), 1);
    const c1 = CFG.overshoot, c3 = c1 + 1;
    const pOut = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    const fadeOutK = hideAt < 1e8 ? Math.min(Math.max((now - hideAt) / CFG.fadeOut, 0), 1) : 0;
    const op = Math.min(Math.min(e / CFG.fadeIn, 1), 1 - fadeOutK);
    root.style.opacity = op.toFixed(3);
    root.style.transform = `translateX(-50%) translateY(calc(var(--vc-rise) * ${(1 - pOut).toFixed(4)}))`;
    if (op <= 0) { root.classList.remove('on'); return; }

    // ③ 글자 줄 — 아래에서 올라오며 나타난다(줄 통째로. 글자별이면 다 뜰 때까지 못 읽는다).
    const kTxt = Math.min(Math.max(e / CFG.inDur, 0), 1);
    const kEase = kTxt * kTxt * (3 - 2 * kTxt);
    el.en.style.transform = `translateY(calc(var(--vc-txt-rise) * ${(1 - kEase).toFixed(4)}))`;
    el.en.style.opacity = Math.min(1, e / (CFG.inDur * 0.75)).toFixed(3);

    // ④ 미니 파형 — 루프 주기의 정수배 하모닉만 써서 loopDur 마다 정확히 반복된다.
    //    말하는 동안만 살아 있고, 끝나면 idleFloor 로 잦아든다.
    const A = CFG.waveAmp, wOmega = Math.PI * 2 / CFG.loopDur;
    const live = speaking ? 1 : 0.25;
    for (let s = 0; s < bars.length; s++) {
      const P = s * 2.399963;                       // 황금각 위상 — 막대가 같이 안 움직인다
      let v = 0.5
        + 0.32 * A * Math.sin(wOmega * 1 * now + P * 1.7)
        + 0.14 * A * Math.sin(wOmega * 2 * now + P * 2.9 + 1.1)
        + 0.06 * A * Math.sin(wOmega * 3 * now + P * 4.1 + 2.3);
      v = Math.max(CFG.idleFloor, Math.min(1, v)) * live;
      const weight = 0.32 + 0.68 * Math.sin(Math.PI * (s + 0.5) / bars.length);   // 가운데가 높은 종 모양
      const hPx = H * CFG.barMinH + (H * CFG.barMaxH * weight - H * CFG.barMinH) * v;
      bars[s].style.height = `${hPx.toFixed(2)}px`;
    }
  }

  layout();
  window.addEventListener('resize', layout);
  el.avImg.addEventListener('load', fitAvatar);
  setSport('boxing');
  requestAnimationFrame(tick);
  return { show, hide, setSport, layout };
}
