// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 편집 패널
//   두 모드 토글: [쉬움] 슬라이더  /  [</> 코드] 라이브 파라미터 창.
//   코드 모드 = 선택 토큰의 스펙(JSON)을 직접 타이핑 → 3D 즉시 반영.
//   그라디언트(선형/방사·각도)·터짐 이펙트·화살표 촉 모양·0→N 숫자 지원.
// ─────────────────────────────────────────────────────────────
import { defaultDesign, renderDesignCanvas, loadSvg } from './design.js';

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
    this.getLookEl = opts.getLookEl || null;   // 비선택 = 전역 룩 (LookPanel 영속 DOM 마운트)
    this._selfEdit = false;
    this._renderedId = undefined;
    this._renderedMode = undefined;
    this.showAdv = false;
    this.mode = opts.startMode || 'code';   // 유저 선택: 라이브 코드 창 기본
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
    const d = this._dsn(m);
    set('#pr-szv', `${m.radiusCm}cm`);
    set('#pr-blv', `${d.blur}`);
    set('#pr-opv', `${Math.round(d.opacity * 100)}%`);
    this._drawPreview();
  }

  // ── 렌더 ──
  render() {
    this._renderedId = this.doc.selection;
    this._renderedMode = this.mode;
    const m = this.doc.selected();

    if (!m) {
      // 피그마 모델: 아무것도 선택 안 됨 = 전역(장면 룩) 편집 컨텍스트 — LookPanel 인라인
      this.el.innerHTML = `<div style="padding:10px 14px 0;font-size:11px;color:var(--dim);line-height:1.6;">
        3D 장면의 마크를 <b style="color:var(--text)">클릭=선택 · 드래그=이동</b>. 선택이 없을 땐 아래에서 전역 룩을 다듬어요.
      </div>`;
      const lk = this.getLookEl?.();
      if (lk) this.el.appendChild(lk);
      return;
    }
    (this.mode === 'code' ? this._renderCode : this._renderEasy).call(this, m);
  }

  _header(m) {
    const other = this.mode === 'code' ? '쉬움' : '</> 코드';
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <canvas id="pr-preview" width="80" height="80" style="width:46px;height:46px;background:#0c0e12;border:1px solid var(--line);border-radius:8px;flex:none;"></canvas>
      <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--text);">이 토큰 편집</div><div style="color:var(--dim);font-size:11px;">바꾸면 3D에 바로 반영돼요</div></div>
      <button id="pr-mode" style="padding:5px 9px;border:1px solid var(--accent);border-radius:6px;background:rgba(250,48,48,.14);color:var(--accent);font-size:11px;cursor:pointer;white-space:nowrap;">${other}</button>
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
    const d = this._dsn(m);
    const b = d.burst || defaultDesign().burst;
    const seg = (opts, cur, cls, attr) => opts.map(([v, label]) =>
      `<button class="${cls}" data-attr="${attr}" data-val="${v}" style="padding:6px 9px;border:1px solid ${v === cur ? 'var(--accent)' : 'var(--line)'};border-radius:6px;background:${v === cur ? 'rgba(250,48,48,.16)' : 'var(--panel2)'};color:${v === cur ? 'var(--accent)' : 'var(--dim)'};font-size:11px;cursor:pointer;white-space:nowrap;">${label}</button>`).join('');
    const grad = d.fill.type !== 'solid';

    this.el.innerHTML = `
      <div class="pr-scroll" style="padding:12px 14px;overflow-y:auto;max-height:380px;font-size:12px;">
        ${this._header(m)}

        <div style="color:var(--dim);margin-bottom:5px;">모양</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:${d.shape === 'svg' ? '6' : '12'}px;">${seg(SHAPES, d.shape, 'pr-shape', 'shape')}</div>
        ${d.shape === 'svg' ? `<button id="pr-svg" style="width:100%;margin-bottom:12px;padding:8px 0;border:1px dashed var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:11px;cursor:pointer;">${d.svgUrl ? '✓ 그림 바꾸기 (SVG)' : '⬆ 그림 올리기 (SVG 파일)'}</button><input id="pr-svgfile" type="file" accept=".svg,image/svg+xml" style="display:none;">` : ''}

        <div style="color:var(--dim);margin-bottom:5px;">색 · 그라디언트</div>
        <div style="display:flex;gap:4px;margin-bottom:8px;">${seg(GRADS, d.fill.type, 'pr-grad', 'grad')}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:${d.fill.type === 'linear' ? '8' : '10'}px;">
          <input id="pr-c0" type="color" value="${d.fill.c0}" style="width:40px;height:30px;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer;">
          ${grad ? `<span style="color:var(--dim);">→</span><input id="pr-c1" type="color" value="${d.fill.c1}" style="width:40px;height:30px;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer;">` : '<span style="color:var(--dim);font-size:11px;">단색</span>'}
        </div>
        ${d.fill.type === 'linear' ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">그라디언트 각도</span><span id="pr-agv" style="color:var(--accent);">${d.fill.angle}°</span></div><input id="pr-angle-g" type="range" min="0" max="360" step="5" value="${d.fill.angle}" style="width:100%;margin-bottom:10px;">` : ''}

        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">크기</span><span id="pr-szv" style="color:var(--accent);">${m.radiusCm}cm</span></div>
        <input id="pr-size" type="range" min="9" max="30" step="1" value="${m.radiusCm}" style="width:100%;margin-bottom:10px;">

        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">흐림(블러)</span><span id="pr-blv" style="color:var(--accent);">${d.blur}</span></div>
        <input id="pr-blur" type="range" min="0" max="20" step="1" value="${d.blur}" style="width:100%;margin-bottom:10px;">

        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">투명도</span><span id="pr-opv" style="color:var(--accent);">${Math.round(d.opacity * 100)}%</span></div>
        <input id="pr-op" type="range" min="10" max="100" step="5" value="${Math.round(d.opacity * 100)}" style="width:100%;margin-bottom:8px;">

        <label style="display:flex;align-items:center;gap:7px;margin:6px 0 4px;cursor:pointer;color:var(--text);"><input id="pr-bon" type="checkbox" ${b.on ? 'checked' : ''}> 💥 터지는 이펙트</label>
        ${b.on ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">세기</span><span id="pr-biv" style="color:var(--accent);">${b.intensity.toFixed(1)}</span></div>
        <input id="pr-bi" type="range" min="0.3" max="2.5" step="0.1" value="${b.intensity}" style="width:100%;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">속도</span><span id="pr-bsv" style="color:var(--accent);">${b.speed.toFixed(1)}</span></div>
        <input id="pr-bs" type="range" min="0.3" max="2.5" step="0.1" value="${b.speed}" style="width:100%;margin-bottom:6px;">` : ''}

        <button id="pr-adv" style="width:100%;margin-top:8px;padding:7px 0;border:1px solid var(--line);border-radius:6px;background:none;color:var(--dim);font-size:11px;cursor:pointer;">${this.showAdv ? '▴ 고급 설정 접기' : '▾ 고급 설정 (역할·순서·방향)'}</button>
        ${this.showAdv ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
          <div style="color:var(--dim);margin-bottom:5px;">이 자리에서 뭘 하나요?</div>
          <div style="display:flex;gap:4px;margin-bottom:10px;">${seg(ROLES, m.contract, 'pr-role', 'role')}</div>
          <label style="display:flex;align-items:center;gap:7px;margin-bottom:7px;cursor:pointer;"><input id="pr-order" type="checkbox" ${m.order ? 'checked' : ''}> 순서 숫자 보이기</label>
          <label style="display:flex;align-items:center;gap:7px;margin-bottom:10px;cursor:pointer;"><input id="pr-hold" type="checkbox" ${m.holdRing ? 'checked' : ''}> 버티기 링(채워지는 원)</label>
          <div style="color:var(--dim);margin-bottom:5px;">방향 화살표</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:${(m.direction && m.direction.type !== 'none') ? '8' : '0'}px;">${seg(DIRS, m.direction?.type || 'none', 'pr-dir', 'dir')}</div>
          ${(m.direction && m.direction.type !== 'none') ? `
          <div style="color:var(--dim);margin:6px 0 4px;">화살표 끝(촉) 모양</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${seg(TIPS, m.direction.tip || 'triangle', 'pr-tip', 'tip')}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">방향 각도</span><span style="color:var(--accent);">${m.direction.angle || 0}°</span></div>
          <input id="pr-angle" type="range" min="-180" max="180" step="5" value="${m.direction.angle || 0}" style="width:100%;">` : ''}
        </div>` : ''}

        ${this._footBtns()}
      </div>`;
    this._bindEasy();
    this._bindCommon();
    this._drawPreview();
    const sc = this.el.querySelector('.pr-scroll'); if (sc) sc.scrollTop = prevScroll;
  }

  _drawPreview() {
    const cv = this.el.querySelector('#pr-preview'); const m = this.doc.selected();
    if (!cv || !m) return;
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(renderDesignCanvas(this._dsn(m), 128), 0, 0, cv.width, cv.height);
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
    this.el.querySelectorAll('.pr-shape').forEach(b => b.addEventListener('click', () => { this._editDesign({ shape: b.dataset.val }); this.render(); }));
    on('#pr-svg', 'click', () => this.el.querySelector('#pr-svgfile').click());
    on('#pr-svgfile', 'change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
      const design = { ...this._dsn(this.doc.selected()), svgUrl: url, shape: 'svg' };
      await loadSvg(design);
      this._editDesign(design); this.render();
    });
    // 그라디언트 타입 · 색
    this.el.querySelectorAll('.pr-grad').forEach(b => b.addEventListener('click', () => { this._editFill({ type: b.dataset.val }); this.render(); }));
    on('#pr-c0', 'input', e => this._editFill({ c0: e.target.value }));
    on('#pr-c1', 'input', e => this._editFill({ c1: e.target.value }));
    on('#pr-angle-g', 'input', e => { this._editFill({ angle: Number(e.target.value) }); const v = this.el.querySelector('#pr-agv'); if (v) v.textContent = e.target.value + '°'; });
    // 크기·흐림·투명도
    on('#pr-size', 'input', e => { this._edit({ radiusCm: Number(e.target.value) }); const v = this.el.querySelector('#pr-szv'); if (v) v.textContent = e.target.value + 'cm'; });
    on('#pr-blur', 'input', e => { this._editDesign({ blur: Number(e.target.value) }); const v = this.el.querySelector('#pr-blv'); if (v) v.textContent = e.target.value; });
    on('#pr-op', 'input', e => { this._editDesign({ opacity: Number(e.target.value) / 100 }); const v = this.el.querySelector('#pr-opv'); if (v) v.textContent = e.target.value + '%'; });
    // 터짐
    on('#pr-bon', 'change', e => { this._editBurst({ on: e.target.checked }); this.render(); });
    on('#pr-bi', 'input', e => { this._editBurst({ intensity: Number(e.target.value) }); const v = this.el.querySelector('#pr-biv'); if (v) v.textContent = Number(e.target.value).toFixed(1); });
    on('#pr-bs', 'input', e => { this._editBurst({ speed: Number(e.target.value) }); const v = this.el.querySelector('#pr-bsv'); if (v) v.textContent = Number(e.target.value).toFixed(1); });
    // 고급
    on('#pr-adv', 'click', () => { this.showAdv = !this.showAdv; this.render(); });
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
