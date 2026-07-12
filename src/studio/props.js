// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 편집 패널
//   두 모드 토글: [쉬움] 슬라이더  /  [</> 코드] 라이브 파라미터 창.
//   코드 모드 = 선택 토큰의 스펙(JSON)을 직접 타이핑 → 3D 즉시 반영.
//   그라디언트(선형/방사·각도)·터짐 이펙트·화살표 촉 모양·0→N 숫자 지원.
// ─────────────────────────────────────────────────────────────
import { defaultDesign, renderDesignCanvas, loadSvg } from './design.js';
import { lutColor, FXP, GLYPHS, drawGlyph } from '../fxlut.js';

const SHAPES = [['zone', '● 동그라미'], ['foot', '👣 발자국'], ['ring', '◎ 링'], ['number', '① 숫자'], ['svg', '🖼 그림']];
const GRADS  = [['solid', '단색'], ['linear', '선형'], ['radial', '방사']];
const ROLES  = [['reach', '밟기'], ['avoid', '피하기'], ['hold', '버티기']];
const DIRS   = [['none', '없음'], ['transition', '전환'], ['rotation', '회전'], ['reciprocation', '좌우']];
const TIPS   = [['triangle', '▲ 삼각'], ['chevron', '》 꺾쇠'], ['diamond', '◆ 마름모'], ['bar', '▬ 바'], ['none', '│ 선만']];

export class StudioProps {
  constructor(container, doc, opts = {}) {
    this.el = container;
    this.doc = doc;
    this.onEdit = opts.onEdit || (() => {});
    this.onPreviewBurst = opts.onPreviewBurst || (() => {});
    this._selfEdit = false;
    this._renderedId = undefined;
    this._renderedMode = undefined;
    this.showAdv = false;
    this.mode = opts.startMode || 'easy';   // 기본 = 쉬움(슬라이더+미리보기) — 코드 창은 토글로
    this._unsub = doc.onChange((d, reason) => {
      if (this._selfEdit) return;
      if (this.doc.selection !== this._renderedId || this.mode !== this._renderedMode || ['load', 'remove', 'add'].includes(reason)) this.render();
      else this._sync();
    });
    this.render();
  }
  destroy() { this._unsub?.(); this.el.innerHTML = ''; }

  _dsn(m) { return m.design || defaultDesign('zone'); }

  _edit(patch) {
    const id = this.doc.selection; if (!id) return;
    this._selfEdit = true; this.doc.update(id, patch); this.onEdit(); this._selfEdit = false; this._sync();
  }
  _editDesign(patch) {
    const m = this.doc.selected(); if (!m) return;
    this._selfEdit = true;
    this.doc.update(m.id, { design: { ...this._dsn(m), ...patch } });
    this.onEdit(); this._selfEdit = false; this._drawPreview();
  }
  _editFill(patch) { const m = this.doc.selected(); this._editDesign({ fill: { ...this._dsn(m).fill, ...patch } }); }
  _editBurst(patch) { const m = this.doc.selected(); this._editDesign({ burst: { ...(this._dsn(m).burst || defaultDesign().burst), ...patch } }); }

  _sync() {
    const m = this.doc.selected(); if (!m) return;
    if (this.mode === 'code') { this._drawPreview(); return; }
    const q = s => this.el.querySelector(s);
    const set = (s, v) => { const e = q(s); if (e) e.textContent = v; };
    const setV = (s, v) => { const e = q(s); if (e && document.activeElement !== e) e.value = v; };   // 3D 드래그 → 수치 라이브 동기
    set('#pr-szv', `${m.radiusCm}cm`);
    setV('#pr-nx', (m.nx ?? 0).toFixed(2));
    setV('#pr-t', (m.t ?? 0).toFixed(2));
    setV('#pr-ny', (m.ny ?? 0).toFixed(2));
    this._drawPreview();
  }

  // ── 렌더 ──
  render() {
    this._renderedId = this.doc.selection;
    this._renderedMode = this.mode;
    const m = this.doc.selected();

    if (!m) {
      // 피그마 모델: 아무것도 선택 안 됨 = 전역(장면 룩) 편집 컨텍스트 — LookPanel 인라인
      this.el.innerHTML = `<div style="padding:12px 14px;font-size:10.5px;color:var(--dim);line-height:1.7;">
        캔버스에서 토큰을 <b style="color:var(--text)">클릭=선택 · 드래그=이동</b>.<br>전체 분위기(팔레트·파동·투사면)는 위 <b style="color:#fec389">🔥 룩</b> — 전용 페이지가 열려요.</div>`;
      return;
    }
    this._renderEasy(m);
  }

  _header(m) {
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <canvas id="pr-preview" width="80" height="80" style="width:46px;height:46px;background:#0c0e12;border:1px solid var(--line);border-radius:8px;flex:none;"></canvas>
      <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--text);">토큰 인스턴스</div><div style="color:var(--dim);font-size:10.5px;">비주얼은 🔥 룩 시스템 — 여기선 배치·판정만</div></div>
    </div>`;
  }

  _footBtns() {
    return `<div style="display:flex;gap:6px;margin-top:12px;">
        <button id="pr-burst" style="flex:1;padding:8px 0;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:11px;cursor:pointer;">💥 터짐 미리보기</button>
        <button id="pr-num" style="flex:1;padding:8px 0;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:11px;cursor:pointer;">0→N 숫자</button>
      </div>
      <button id="pr-del" style="width:100%;margin-top:8px;padding:9px 0;border:1px solid #ff5c8a;border-radius:6px;background:rgba(255,92,138,.1);color:#ff5c8a;font-size:12px;font-weight:700;cursor:pointer;">🗑 이 토큰 지우기</button>`;
  }

  // ── 코드(라이브 파라미터) 뷰 ──
  _renderCode(m) {
    const spec = this._specObject(m);
    this.el.innerHTML = `<div style="padding:12px 14px;font-size:12px;">
      ${this._header(m)}
      <div style="color:var(--dim);margin-bottom:5px;">파라미터 (직접 타이핑 → 3D 즉시 반영)</div>
      <textarea id="pr-code" spellcheck="false" style="width:100%;height:250px;box-sizing:border-box;background:#0c0e12;color:#d8e0ea;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;white-space:pre;overflow:auto;">${JSON.stringify(spec, null, 2)}</textarea>
      <div id="pr-cerr" style="display:none;margin-top:6px;color:#ff5c8a;font-size:11px;"></div>
      <div style="margin-top:6px;color:var(--dim);font-size:10px;line-height:1.6;">
        gradient: solid·linear·radial · angle(선형 각도) · burst.on true면 터짐 켜짐<br>
        arrow.tip: triangle·chevron·diamond·bar·none · role: reach·avoid·hold
      </div>
      ${this._footBtns()}
    </div>`;
    this._bindCommon();
    const ta = this.el.querySelector('#pr-code');
    const err = this.el.querySelector('#pr-cerr');
    let timer = null;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        let s; try { s = JSON.parse(ta.value); } catch (e) { err.style.display = 'block'; err.textContent = '⚠ JSON 오류: ' + e.message; return; }
        err.style.display = 'none';
        this._applySpec(m, s);
      }, 250);
    });
    this._drawPreview();
  }

  _specObject(m) {
    const d = this._dsn(m);
    const b = d.burst || defaultDesign().burst;
    return {
      shape: d.shape,                       // zone|foot|ring|number|svg
      color: d.fill.c0,
      color2: d.fill.c1,
      gradient: d.fill.type,                // solid|linear|radial
      angle: d.fill.angle,
      number: d.glyph,
      sizeCm: m.radiusCm,
      blur: d.blur,
      opacity: d.opacity,
      stroke: { on: d.stroke?.on !== false, width: d.stroke?.width ?? 6, color: d.stroke?.color || d.fill.c0 },
      role: m.contract,                     // reach|avoid|hold
      orderNumber: !!m.order,
      holdRing: !!m.holdRing,
      arrow: m.direction ? { type: m.direction.type, angle: m.direction.angle || 0, tip: m.direction.tip || 'triangle' } : 'none',
      burst: { on: !!b.on, intensity: b.intensity ?? 1, speed: b.speed ?? 1, rings: b.rings ?? 2, color: b.color || null },
    };
  }

  _applySpec(m, s) {
    if (!s || typeof s !== 'object') return;
    const d = this._dsn(m);
    const design = { ...d, fill: { ...d.fill }, stroke: { ...d.stroke }, burst: { ...(d.burst || defaultDesign().burst) } };
    if (s.shape) design.shape = s.shape;
    if (s.color != null) design.fill.c0 = s.color;
    if (s.color2 != null) design.fill.c1 = s.color2;
    if (s.gradient != null) design.fill.type = s.gradient;
    if (s.angle != null) design.fill.angle = Number(s.angle) || 0;
    if (s.number != null) design.glyph = String(s.number);
    if (s.blur != null) design.blur = Math.max(0, Number(s.blur) || 0);
    if (s.opacity != null) design.opacity = Math.max(0, Math.min(1, Number(s.opacity)));
    if (s.stroke && typeof s.stroke === 'object')
      design.stroke = { on: !!s.stroke.on, width: Number(s.stroke.width) || 6, color: s.stroke.color || design.fill.c0 };
    if (s.burst && typeof s.burst === 'object')
      design.burst = { on: !!s.burst.on, intensity: Number(s.burst.intensity) || 1, speed: Number(s.burst.speed) || 1, rings: Number(s.burst.rings) || 2, color: s.burst.color || null };

    const patch = { design };
    if (s.sizeCm != null) patch.radiusCm = Math.max(1, Number(s.sizeCm) || d.radiusCm);
    if (s.role) patch.contract = s.role;
    if (typeof s.orderNumber === 'boolean') patch.order = s.orderNumber;
    if (typeof s.holdRing === 'boolean') patch.holdRing = s.holdRing;
    if (s.arrow === 'none' || s.arrow == null) patch.direction = null;
    else if (typeof s.arrow === 'object')
      patch.direction = { type: s.arrow.type || 'transition', angle: Number(s.arrow.angle) || 0, tip: s.arrow.tip || 'triangle' };

    if (design.svgUrl && !design._img) loadSvg(design);
    this._edit(patch);
  }

  // ── 쉬움(슬라이더) 뷰 ──
  _renderEasy(m) {
    const prevScroll = this.el.querySelector('.pr-scroll')?.scrollTop || 0;
    const seg = (opts, cur, cls, attr) => opts.map(([v, label]) =>
      `<button class="${cls}" data-attr="${attr}" data-val="${v}" style="padding:6px 9px;border:1px solid ${v === cur ? 'var(--accent)' : 'var(--line)'};border-radius:6px;background:${v === cur ? 'rgba(250,48,48,.16)' : 'var(--panel2)'};color:${v === cur ? 'var(--accent)' : 'var(--dim)'};font-size:11px;cursor:pointer;white-space:nowrap;">${label}</button>`).join('');
    const isWall = m.surface === 'wall';
    const numRow = (label, id, val, min, max, step, unit) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="color:var(--dim);">${label}</span>
        <span style="display:flex;align-items:center;gap:4px;">
          <input id="${id}" type="number" value="${val}" min="${min}" max="${max}" step="${step}"
            style="width:74px;padding:5px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:5px;font-size:11.5px;text-align:right;">
          <span style="color:var(--dim);font-size:10.5px;width:18px;">${unit}</span>
        </span>
      </div>`;

    this.el.innerHTML = `
      <div class="pr-scroll" style="padding:12px 14px;font-size:12px;">
        ${this._header(m)}

        <div style="color:var(--dim);margin:2px 0 6px;font-weight:600;">배치 · 타이밍</div>
        ${numRow('가로 위치 (레인)', 'pr-nx', (m.nx ?? 0).toFixed(2), -1, 1, 0.01, 'nx')}
        ${isWall
          ? numRow('높이', 'pr-ny', (m.ny ?? 0).toFixed(2), -1, 1.2, 0.01, 'ny')
          : numRow('타이밍', 'pr-t', (m.t ?? 0).toFixed(2), 0, 99, 0.05, 's')}

        <div style="display:flex;justify-content:space-between;margin:10px 0 3px;"><span style="color:var(--dim);font-weight:600;">판정 반경 (허용창)</span><span id="pr-szv" style="color:var(--accent);">${m.radiusCm}cm</span></div>
        <input id="pr-size" type="range" min="9" max="30" step="1" value="${m.radiusCm}" style="width:100%;margin-bottom:10px;">

        ${!isWall && m.foot ? `
        <div style="color:var(--dim);margin-bottom:5px;font-weight:600;">발</div>
        <div style="display:flex;gap:4px;margin-bottom:10px;">${seg([['left', '왼발'], ['right', '오른발']], m.foot, 'pr-foot', 'foot')}</div>` : ''}

        <div style="color:var(--dim);margin-bottom:5px;font-weight:600;">이 자리에서 뭘 하나요? (계약)</div>
        <div style="display:flex;gap:4px;margin-bottom:8px;">${seg(ROLES, m.contract, 'pr-role', 'role')}</div>
        <label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;cursor:pointer;"><input id="pr-order" type="checkbox" ${m.order ? 'checked' : ''}> 순서 숫자 보이기</label>
        <label style="display:flex;align-items:center;gap:7px;margin-bottom:10px;cursor:pointer;"><input id="pr-hold" type="checkbox" ${m.holdRing ? 'checked' : ''}> 버티기 링(채워지는 원)</label>

        <div style="color:var(--dim);margin-bottom:5px;font-weight:600;">방향 화살표</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:${(m.direction && m.direction.type !== 'none') ? '8' : '0'}px;">${seg(DIRS, m.direction?.type || 'none', 'pr-dir', 'dir')}</div>
        ${(m.direction && m.direction.type !== 'none') ? `
        <div style="color:var(--dim);margin:6px 0 4px;">화살표 끝(촉) 모양</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${seg(TIPS, m.direction.tip || 'triangle', 'pr-tip', 'tip')}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">방향 각도</span><span style="color:var(--accent);">${m.direction.angle || 0}°</span></div>
        <input id="pr-angle" type="range" min="-180" max="180" step="5" value="${m.direction.angle || 0}" style="width:100%;">` : ''}

        ${this._footBtns()}
      </div>`;
    this._bindEasy();
    this._bindCommon();
    this._drawPreview();
    const sc = this.el.querySelector('.pr-scroll'); if (sc) sc.scrollTop = prevScroll;
  }

  _drawPreview() {
    // 룩 시스템 반영 미리보기 — LUT 팔레트 + 마크 파라미터 + 커스텀 글리프 (마크 파동 언어의 정지 근사)
    const cv = this.el.querySelector('#pr-preview'); const m = this.doc.selected();
    if (!cv || !m) return;
    const g = cv.getContext('2d'); const W = cv.width;
    g.clearRect(0, 0, W, W);
    const cx = W / 2, r = W * 0.30 * (FXP.mark.radius || 1);
    g.strokeStyle = lutColor(0.45);
    g.lineWidth = 3.5 * (FXP.mark.core || 1);
    g.shadowColor = lutColor(0.68);
    g.shadowBlur = 9 * (FXP.mark.halo || 1);
    if (m.contract === 'avoid') g.setLineDash([5, 4]);   // 회피 = 점선 (계약 변조)
    g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    if (m.holdRing || m.contract === 'hold') {           // 유지 = 차오르는 내부 광
      g.globalAlpha = 0.45; g.fillStyle = lutColor(0.30);
      g.beginPath(); g.arc(cx, cx, r * 0.82, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (m.order) {                                       // 순서 숫자 — 커스텀 글리프 우선
      const n = String(m.n ?? 1);
      if (!drawGlyph(g, n, cx, cx, r * 1.1)) {
        g.font = `300 ${Math.round(r * 0.95)}px -apple-system, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(254,150,90,0.75)'; g.shadowBlur = 8;
        g.fillStyle = 'rgba(255,240,220,0.95)';
        g.fillText(n, cx, cx + 1);
      }
    }
    g.shadowBlur = 0;
  }

  // 모드 토글·삭제·미리보기·0→N — 두 뷰 공통
  _bindCommon() {
    const on = (sel, ev, fn) => { const el = this.el.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    on('#pr-mode', 'click', () => { this.mode = this.mode === 'code' ? 'easy' : 'code'; this.render(); });
    on('#pr-del', 'click', () => { const id = this.doc.selection; this._selfEdit = true; this.doc.remove(id); this.onEdit(); this._selfEdit = false; this.render(); });
    on('#pr-burst', 'click', () => { const m = this.doc.selected(); if (m) this.onPreviewBurst(m); });
    on('#pr-num', 'click', () => { this.doc.numberSequence(0); this.onEdit(); });
  }

  _bindEasy() {
    const on = (sel, ev, fn) => { const el = this.el.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    // 배치·타이밍 수치 입력
    on('#pr-nx', 'input', e => { const v = Number(e.target.value); if (!isNaN(v)) this._edit({ nx: Math.max(-1, Math.min(1, v)) }); });
    on('#pr-t', 'input', e => { const v = Number(e.target.value); if (!isNaN(v) && v >= 0) this._edit({ t: v }); });
    on('#pr-ny', 'input', e => { const v = Number(e.target.value); if (!isNaN(v)) this._edit({ ny: Math.max(-1, Math.min(1.2, v)) }); });
    // 판정 반경
    on('#pr-size', 'input', e => { this._edit({ radiusCm: Number(e.target.value) }); const v = this.el.querySelector('#pr-szv'); if (v) v.textContent = e.target.value + 'cm'; });
    // 발 · 계약 · 채널
    this.el.querySelectorAll('.pr-foot').forEach(b => b.addEventListener('click', () => { this._edit({ foot: b.dataset.val }); this.render(); }));
    this.el.querySelectorAll('.pr-role').forEach(b => b.addEventListener('click', () => { this._edit({ contract: b.dataset.val }); this.render(); }));
    on('#pr-order', 'change', e => this._edit({ order: e.target.checked }));
    on('#pr-hold', 'change', e => this._edit({ holdRing: e.target.checked }));
    this.el.querySelectorAll('.pr-dir').forEach(b => b.addEventListener('click', () => {
      const val = b.dataset.val, m = this.doc.selected();
      this._edit({ direction: val === 'none' ? null : { type: val, angle: m.direction?.angle || 0, tip: m.direction?.tip || 'triangle' } });
      this.render();
    }));
    this.el.querySelectorAll('.pr-tip').forEach(b => b.addEventListener('click', () => {
      const m = this.doc.selected();
      this._edit({ direction: { type: m.direction?.type || 'transition', angle: m.direction?.angle || 0, tip: b.dataset.val } });
      this.render();
    }));
    on('#pr-angle', 'input', e => { const m = this.doc.selected(); this._edit({ direction: { type: m.direction?.type || 'transition', angle: Number(e.target.value), tip: m.direction?.tip || 'triangle' } }); });
  }

}
