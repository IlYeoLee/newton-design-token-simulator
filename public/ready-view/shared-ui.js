/* ─────────────────────────────────────────────────────────────
   shared-ui.js — 뉴턴 투사 UI 공용 JS 헬퍼 (복싱 씬에서 검증).
   바닥(러닝·농구) UI 편집 시 <script src="shared-ui.js"></script> 로 재사용.
   window.NewtonUI.countUp / charWave 로 노출. 모션 키프레임은 shared-motions.css.
   ───────────────────────────────────────────────────────────── */
window.NewtonUI = window.NewtonUI || {};

/** 숫자 카운트업 0→target (reactbits 톤, ease-out-cubic). 정수/소수 자동, '—'·'' 등은 그대로.
 *  el: 대상 요소 · target: 목표값 · delay: 시작 지연(ms) · cdur: 상승 시간(ms) */
window.NewtonUI.countUp = function (el, target, delay = 0, cdur = 950) {
  const m = String(target).match(/^(\d+(?:\.\d+)?)$/);
  if (!m) { el.textContent = target; return; }
  const end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length;
  el.textContent = dec ? (0).toFixed(dec) : '0';   // 폭 고정 → 시프트 방지
  setTimeout(() => { const t0 = performance.now();
    (function tick(now) { const p = Math.min(1, (now - t0) / cdur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = dec ? (end * e).toFixed(dec) : Math.round(end * e);
      if (p < 1) requestAnimationFrame(tick); })(performance.now());
  }, delay);
};

/** 타이틀 글자별 span 분해 + 루프 웨이브('촤라락'). shared-motions.css의 @keyframes charWave 필요.
 *  el: 타이틀 요소 · text: 문자열 · opts.dur(2.4s)·opts.stagger(0.05s)·opts.delay(0.9s) */
window.NewtonUI.charWave = function (el, text, opts = {}) {
  const dur = opts.dur || 2.4, stagger = opts.stagger || 0.05, delay0 = opts.delay || 0.9;
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.style.display = 'inline-block';
    s.textContent = /\s/.test(ch) ? String.fromCharCode(160) : ch;   // inline-block 공백 붕괴 방지
    s.style.animation = `charWave ${dur}s ${(delay0 + i * stagger).toFixed(2)}s ease-in-out infinite`;
    el.appendChild(s);
  });
};
