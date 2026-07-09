// ─────────────────────────────────────────────────────────────
// 열화상(depth-map) 실루엣 공용 유틸 — 고스트·발자국이 공유
//   레퍼런스: depth→그라디언트 컬러맵 + gooey 필터(블롭 융합) + 소프트 헤일로 + 그레인.
//   gooey = feGaussianBlur + feColorMatrix 알파 대비 스냅 (Codrops/CSS-Tricks 표준 기법)
//   — 겹친 블롭들이 한 덩어리 매끈한 면으로 붙는다.
//   팔레트는 NEWTON 브랜드 열계열: 가까움(热) 핫핑크 → RED → CORAL → SAND(멀음).
// ─────────────────────────────────────────────────────────────

let _gooInjected = false;
export function ensureGooFilter() {
  if (_gooInjected || typeof document === 'undefined') return;
  _gooInjected = true;
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
  div.innerHTML = `<svg width="0" height="0"><defs>
    <filter id="newton-goo" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
      <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/>
    </filter>
    <filter id="newton-goo-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
      <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -5"/>
    </filter>
  </defs></svg>`;
  document.body.appendChild(div);
}

// NEWTON 열화상 LUT — t=1 가까움/뜨거움(핫핑크) → t=0 멀음/식음(샌드)
const STOPS = [
  [0.00, [0xfe, 0xc3, 0x89]],   // SAND
  [0.45, [0xfe, 0x6e, 0x3c]],   // CORAL
  [0.75, [0xfa, 0x30, 0x30]],   // NEWTON RED
  [1.00, [0xff, 0x2f, 0x8e]],   // HOT PINK (열 정점)
];
export function thermalColor(t, alpha = 1) {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < STOPS.length - 2 && t > STOPS[i + 1][0]) i++;
  const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1];
  const k = (t - t0) / Math.max(t1 - t0, 1e-6);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * k);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * k);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * k);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 필름 그레인 패턴 (1회 생성, overlay 합성용)
let _grain = null;
export function grainPattern(ctx) {
  if (!_grain) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    _grain = c;
  }
  return ctx.createPattern(_grain, 'repeat');
}

/** 소프트 열 블롭: 중심 뜨겁고 가장자리로 식는 radial */
export function heatBlob(ctx, x, y, r, t, coreA = 0.95) {
  const g = ctx.createRadialGradient(x, y, r * 0.06, x, y, r);
  g.addColorStop(0, thermalColor(t, coreA));
  g.addColorStop(0.62, thermalColor(Math.max(0, t - 0.18), coreA * 0.55));
  g.addColorStop(1, thermalColor(Math.max(0, t - 0.3), 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** shape 캔버스 → goo 융합 → [헤일로 + 본체 + 그레인] 합성. out 캔버스에 그림 */
export function composeThermal(shape, goo, out, { halo = 18, haloA = 0.55, bodyBlur = 1.5, grain = 0.1, soft = false } = {}) {
  ensureGooFilter();
  const gc = goo.getContext('2d');
  gc.clearRect(0, 0, goo.width, goo.height);
  gc.filter = `url(#${soft ? 'newton-goo-soft' : 'newton-goo'})`;
  gc.drawImage(shape, 0, 0);
  gc.filter = 'none';

  const oc = out.getContext('2d');
  oc.clearRect(0, 0, out.width, out.height);
  oc.globalAlpha = haloA;
  oc.filter = `blur(${halo}px)`;
  oc.drawImage(goo, 0, 0);
  oc.globalAlpha = 1;
  oc.filter = bodyBlur > 0 ? `blur(${bodyBlur}px)` : 'none';
  oc.drawImage(goo, 0, 0);
  oc.filter = 'none';
  if (grain > 0) {
    // source-atop = 기존 실루엣 알파 안에만 그레인 (overlay는 투명영역에 α막을 만들어 플레인 박스가 비침)
    oc.globalCompositeOperation = 'source-atop';
    oc.globalAlpha = grain;
    oc.fillStyle = grainPattern(oc);
    oc.fillRect(0, 0, out.width, out.height);
    oc.globalCompositeOperation = 'source-over';
    oc.globalAlpha = 1;
  }
  return out;
}
