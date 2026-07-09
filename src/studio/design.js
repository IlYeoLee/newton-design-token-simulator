// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 토큰 비주얼 디자인 렌더러
//   토큰 하나하나의 "실제 디자인"을 편집: 모양(존원·발자국·링·숫자·업로드 SVG)
//   + 채움(단색/선형·방사 그라디언트) + 블러 + 테두리 + 투명도.
//   Canvas2D로 그려 CanvasTexture로 3D 마커에 바로 입힌다.
//   (블러는 오프스크린 → 필터 합성, SVG는 source-in 그라디언트 틴트)
// ─────────────────────────────────────────────────────────────

export function defaultDesign(kind = 'zone') {
  return {
    shape: kind,                                   // zone|foot|ring|number|svg
    fill: { type: 'solid', c0: '#fa3030', c1: '#fe6e3c', angle: 45 },
    blur: 0,                                        // 0..20 (px @256)
    stroke: { on: true, width: 6, color: '#fa3030' },
    opacity: 1,
    glyph: '1',                                     // shape==='number'
    svgUrl: null,                                   // 업로드 SVG dataURL (직렬화됨)
    _img: null,                                     // 런타임 캐시(직렬화 제외)
  };
}

// dataURL SVG → Image (비동기 1회 로드, 이후 sync 렌더)
export function loadSvg(design) {
  return new Promise((res) => {
    if (!design.svgUrl) { design._img = null; return res(design); }
    const img = new Image();
    img.onload = () => { design._img = img; res(design); };
    img.onerror = () => { design._img = null; res(design); };
    img.src = design.svgUrl;
  });
}

function makeFill(ctx, f, S) {
  if (f.type === 'linear') {
    const a = (f.angle || 0) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    const g = ctx.createLinearGradient(S / 2 - dx * S / 2, S / 2 - dy * S / 2, S / 2 + dx * S / 2, S / 2 + dy * S / 2);
    g.addColorStop(0, f.c0); g.addColorStop(1, f.c1); return g;
  }
  if (f.type === 'radial') {
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.04, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, f.c0); g.addColorStop(1, f.c1); return g;
  }
  return f.c0;
}

// 발자국 실루엣 (전족구 + 뒤꿈치) — 프리셋 (SVG 업로드로 교체 가능)
function footPath(ctx, S) {
  const cx = S / 2;
  ctx.beginPath();
  ctx.ellipse(cx, S * 0.40, S * 0.24, S * 0.28, 0, 0, Math.PI * 2);   // 전족구
  ctx.ellipse(cx, S * 0.76, S * 0.15, S * 0.16, 0, 0, Math.PI * 2);   // 뒤꿈치
}

// 디자인 스펙 → 캔버스 (블러는 오프스크린 합성)
export function renderDesignCanvas(spec, S = 256) {
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = S;
  const t = tmp.getContext('2d');
  const fill = makeFill(t, spec.fill, S);
  const cx = S / 2, cy = S / 2, R = S * 0.42;

  t.globalAlpha = 1;
  if (spec.shape === 'svg' && spec._img) {
    t.drawImage(spec._img, S * 0.08, S * 0.08, S * 0.84, S * 0.84);
    // 그라디언트/색 틴트: SVG 실루엣 안쪽만 채움
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = fill; t.fillRect(0, 0, S, S);
    t.globalCompositeOperation = 'source-over';
  } else if (spec.shape === 'number') {
    t.fillStyle = fill; t.textAlign = 'center'; t.textBaseline = 'middle';
    t.font = `800 ${S * 0.72}px -apple-system, sans-serif`;
    t.fillText(String(spec.glyph ?? '1'), cx, cy + S * 0.03);
  } else if (spec.shape === 'ring') {
    t.strokeStyle = fill; t.lineWidth = S * 0.14;
    t.beginPath(); t.arc(cx, cy, R * 0.82, 0, Math.PI * 2); t.stroke();
  } else if (spec.shape === 'foot') {
    t.fillStyle = fill; footPath(t, S); t.fill();
  } else { // zone
    t.fillStyle = fill; t.beginPath(); t.arc(cx, cy, R, 0, Math.PI * 2); t.fill();
  }

  // 테두리 (숫자엔 미적용)
  if (spec.stroke?.on && spec.shape !== 'number' && spec.shape !== 'svg') {
    t.strokeStyle = spec.stroke.color; t.lineWidth = spec.stroke.width * S / 256;
    if (spec.shape === 'foot') { footPath(t, S); t.stroke(); }
    else if (spec.shape !== 'ring') { t.beginPath(); t.arc(cx, cy, R, 0, Math.PI * 2); t.stroke(); }
  }

  // 블러 + 투명도 합성
  const out = document.createElement('canvas'); out.width = out.height = S;
  const o = out.getContext('2d');
  o.globalAlpha = spec.opacity ?? 1;
  o.filter = spec.blur > 0 ? `blur(${spec.blur * S / 256}px)` : 'none';
  o.drawImage(tmp, 0, 0);
  return out;
}
