// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 속성 패널 (선택 MARK 하나하나 개별 편집)
//   카탈로그 그대로: 계약(도달·회피·유지) · 발형 스킨 · 판정 허용창(반경)
//   · 채널 ②순서 ③방향 · 모디파이어 holdRing · 삭제.
//   변경은 doc.update → 즉시 3D/캔버스 반영. 슬라이더 드래그 중 리렌더 방지.
// ─────────────────────────────────────────────────────────────
import { CONTRACTS, DIRECTION_TYPES } from './doc.js';
import { runMap } from './doc.js';
import { defaultDesign, renderDesignCanvas, loadSvg } from './design.js';

const SHAPES = [['zone', '존원'], ['foot', '발자국'], ['ring', '링'], ['number', '숫자'], ['svg', 'SVG']];
const FILLS = [['solid', '단색'], ['linear', '선형'], ['radial', '방사']];

export class StudioProps {
  constructor(container, doc, opts = {}) {
    this.el = container;
    this.doc = doc;
    this.onEdit = opts.onEdit || (() => {});
    this._selfEdit = false;
    this._renderedId = undefined;
    this._unsub = doc.onChange((d, reason) => {
      if (this._selfEdit) return;
      if (this.doc.selection !== this._renderedId || reason === 'load' || reason === 'remove' || reason === 'add') this.render();
      else this._sync();
    });
    this.render();
  }
  destroy() { this._unsub?.(); this.el.innerHTML = ''; }

  _edit(patch) {
    const id = this.doc.selection; if (!id) return;
    this._selfEdit = true;
    this.doc.update(id, patch);
    this.onEdit();
    this._selfEdit = false;
    this._sync();
  }

  _sync() {
    const m = this.doc.selected(); if (!m) return;
    const q = s => this.el.querySelector(s);
    const dEl = q('#pr-depth'); if (dEl) dEl.textContent = `${runMap.tToDepth(m.t).toFixed(2)}m · ${runMap.nxToLane(m.nx).toFixed(2)}m`;
    const rEl = q('#pr-radv'); if (rEl) rEl.textContent = `±${m.radiusCm}cm`;
    const aEl = q('#pr-angv'); if (aEl && m.direction) aEl.textContent = `${m.direction.angle || 0}°`;
  }

  render() {
    const prevScroll = this.el.querySelector('div')?.scrollTop || 0;   // 스크롤 위치 보존
    this._renderedId = this.doc.selection;
    const m = this.doc.selected();
    if (!m) {
      this.el.innerHTML = `<div style="padding:12px 14px;font-size:11px;color:var(--dim);line-height:1.6;">
        <b style="color:var(--text)">마크</b> 도구로 트랙을 클릭해 배치하고, <b style="color:var(--text)">선택</b> 후 여기서 계약·채널을 편집하세요.
        선택 후 드래그로 이동, <b style="color:var(--text)">Delete</b> 또는 아래 삭제 버튼.</div>`;
      return;
    }
    const seg = (opts, cur, attr) => opts.map(([v, label]) =>
      `<button class="pr-seg" data-attr="${attr}" data-val="${v}" style="flex:1;padding:5px 2px;border:1px solid ${v === cur ? 'var(--accent)' : 'var(--line)'};border-radius:5px;background:${v === cur ? 'rgba(250,48,48,.16)' : 'var(--panel2)'};color:${v === cur ? 'var(--accent)' : 'var(--dim)'};font-size:10px;cursor:pointer;white-space:nowrap;">${label}</button>`).join('');
    const dir = m.direction?.type || 'none';

    this.el.innerHTML = `
      <div style="padding:10px 14px;overflow-y:auto;max-height:340px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="font-size:12px;color:var(--text);">MARK 편집</b>
          <span id="pr-depth" style="color:var(--dim);font-variant-numeric:tabular-nums;"></span>
        </div>

        <div style="color:var(--dim);letter-spacing:.5px;margin:4px 0 4px;">계약</div>
        <div style="display:flex;gap:4px;">${seg(CONTRACTS.map(c => [c[0], c[1]]), m.contract, 'contract')}</div>

        <div style="color:var(--dim);letter-spacing:.5px;margin:12px 0 4px;">발형 스킨 (Step-type)</div>
        <div style="display:flex;gap:4px;">${seg([['', '없음'], ['left', '왼발'], ['right', '오른발']], m.foot || '', 'foot')}</div>

        <div style="display:flex;justify-content:space-between;margin:12px 0 3px;"><span style="color:var(--dim);">판정 허용창 (반경)</span><span id="pr-radv" style="color:var(--accent);font-variant-numeric:tabular-nums;">±${m.radiusCm}cm</span></div>
        <input id="pr-radius" type="range" min="9" max="30" step="1" value="${m.radiusCm}" style="width:100%;">

        <div style="color:var(--dim);letter-spacing:.5px;margin:12px 0 6px;">채널 · 모디파이어</div>
        <label style="display:flex;align-items:center;gap:7px;margin-bottom:7px;cursor:pointer;"><input id="pr-order" type="checkbox" ${m.order ? 'checked' : ''}> <span>② 순서 번호 (케이던스 1-2-3)</span></label>
        <label style="display:flex;align-items:center;gap:7px;margin-bottom:9px;cursor:pointer;"><input id="pr-hold" type="checkbox" ${m.holdRing ? 'checked' : ''}> <span>holdRing 채움 (유지 진행)</span></label>

        <div style="color:var(--dim);letter-spacing:.5px;margin:4px 0 4px;">③ 방향</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">${seg(DIRECTION_TYPES, dir, 'dir')}</div>
        <div id="pr-angwrap" style="${dir === 'none' ? 'display:none;' : ''}margin-top:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">방향각</span><span id="pr-angv" style="color:var(--accent);">${m.direction?.angle || 0}°</span></div>
          <input id="pr-angle" type="range" min="-180" max="180" step="5" value="${m.direction?.angle || 0}" style="width:100%;">
        </div>

        <div style="border-top:1px solid var(--line);margin:14px 0 0;padding-top:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <b style="font-size:11px;color:var(--text);">🎨 비주얼 디자인</b>
            ${m.design ? '<button id="pr-dsoff" style="border:none;background:none;color:var(--dim);font-size:10px;cursor:pointer;text-decoration:underline;">기본으로</button>' : ''}
          </div>
          ${m.design ? this._designHtml(m) : `<button id="pr-dson" style="width:100%;margin-top:8px;padding:8px 0;border:1px solid var(--accent);border-radius:6px;background:rgba(250,48,48,.1);color:var(--accent);font-size:12px;cursor:pointer;">디자인 편집 켜기 (그라디언트·블러·SVG)</button>`}
        </div>

        <button id="pr-del" style="width:100%;margin-top:14px;padding:8px 0;border:1px solid #ff5c8a;border-radius:6px;background:rgba(255,92,138,.1);color:#ff5c8a;font-size:12px;font-weight:700;cursor:pointer;">🗑 이 마크 삭제</button>
      </div>`;
    this._sync();
    this._bind();
    const sc = this.el.querySelector('div'); if (sc) sc.scrollTop = prevScroll;   // 스크롤 복원
  }

  _designHtml(m) {
    const d = m.design, f = d.fill;
    const seg = (opts, cur, attr) => opts.map(([v, label]) =>
      `<button class="pr-dseg" data-attr="${attr}" data-val="${v}" style="flex:1;padding:5px 2px;border:1px solid ${v === cur ? 'var(--accent)' : 'var(--line)'};border-radius:5px;background:${v === cur ? 'rgba(250,48,48,.16)' : 'var(--panel2)'};color:${v === cur ? 'var(--accent)' : 'var(--dim)'};font-size:10px;cursor:pointer;">${label}</button>`).join('');
    const grad = f.type !== 'solid';
    return `
      <div style="display:flex;gap:10px;margin-top:8px;align-items:flex-start;">
        <canvas id="pr-preview" width="72" height="72" style="width:56px;height:56px;background:#0c0e12;border:1px solid var(--line);border-radius:6px;flex:none;"></canvas>
        <div style="flex:1;">
          <div style="color:var(--dim);margin-bottom:4px;">모양</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;">${seg(SHAPES, d.shape, 'shape')}</div>
        </div>
      </div>
      ${d.shape === 'svg' ? `<div style="margin-top:8px;"><button id="pr-svg" style="width:100%;padding:7px 0;border:1px dashed var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:11px;cursor:pointer;">${d.svgUrl ? '✓ SVG 교체' : '⬆ SVG 업로드'}</button><input id="pr-svgfile" type="file" accept=".svg,image/svg+xml" style="display:none;"></div>` : ''}

      <div style="color:var(--dim);margin:12px 0 4px;">채움</div>
      <div style="display:flex;gap:3px;">${seg(FILLS, f.type, 'filltype')}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
        <input id="pr-c0" type="color" value="${f.c0}" style="width:36px;height:26px;border:1px solid var(--line);border-radius:5px;background:none;cursor:pointer;">
        ${grad ? `<span style="color:var(--dim);">→</span><input id="pr-c1" type="color" value="${f.c1}" style="width:36px;height:26px;border:1px solid var(--line);border-radius:5px;background:none;cursor:pointer;">` : ''}
        ${f.type === 'linear' ? `<span style="color:var(--dim);margin-left:auto;">각 ${f.angle || 0}°</span>` : ''}
      </div>
      ${f.type === 'linear' ? `<input id="pr-angf" type="range" min="0" max="180" step="5" value="${f.angle || 0}" style="width:100%;margin-top:6px;">` : ''}

      <div style="display:flex;justify-content:space-between;margin:12px 0 3px;"><span style="color:var(--dim);">블러</span><span id="pr-blurv" style="color:var(--accent);">${d.blur}px</span></div>
      <input id="pr-blur" type="range" min="0" max="20" step="1" value="${d.blur}" style="width:100%;">

      <div style="display:flex;justify-content:space-between;margin:12px 0 3px;"><span style="color:var(--dim);">투명도</span><span id="pr-opv" style="color:var(--accent);">${Math.round(d.opacity * 100)}%</span></div>
      <input id="pr-op" type="range" min="10" max="100" step="5" value="${Math.round(d.opacity * 100)}" style="width:100%;">

      <label style="display:flex;align-items:center;gap:7px;margin-top:10px;cursor:pointer;"><input id="pr-strokeon" type="checkbox" ${d.stroke.on ? 'checked' : ''}> <span>테두리</span>
        <input id="pr-strokecol" type="color" value="${d.stroke.color}" style="width:30px;height:22px;border:1px solid var(--line);border-radius:4px;background:none;cursor:pointer;margin-left:auto;">
      </label>`;
  }

  _drawPreview() {
    const cv = this.el.querySelector('#pr-preview'); const m = this.doc.selected();
    if (!cv || !m?.design) return;
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(renderDesignCanvas(m.design, 128), 0, 0, cv.width, cv.height);
  }

  _editDesign(patch) {
    const m = this.doc.selected(); if (!m?.design) return;
    this._selfEdit = true;
    this.doc.update(m.id, { design: { ...m.design, ...patch } });
    this.onEdit();
    this._selfEdit = false;
    this._drawPreview();
  }
  _editFill(patch) { const m = this.doc.selected(); this._editDesign({ fill: { ...m.design.fill, ...patch } }); }

  _bind() {
    const on = (sel, ev, fn) => { const el = this.el.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    this.el.querySelectorAll('.pr-seg').forEach(b => b.addEventListener('click', () => {
      const attr = b.dataset.attr, val = b.dataset.val;
      if (attr === 'contract') this._edit({ contract: val });
      else if (attr === 'foot') this._edit({ foot: val || null });
      else if (attr === 'dir') {
        const m = this.doc.selected();
        this._edit({ direction: val === 'none' ? null : { type: val, angle: m.direction?.angle || 0 } });
      }
      this.render();   // 세그먼트는 즉시 리렌더 (활성 상태 갱신)
    }));
    on('#pr-radius', 'input', e => this._edit({ radiusCm: Number(e.target.value) }));
    on('#pr-order', 'change', e => this._edit({ order: e.target.checked }));
    on('#pr-hold', 'change', e => this._edit({ holdRing: e.target.checked }));
    on('#pr-angle', 'input', e => {
      const m = this.doc.selected();
      this._edit({ direction: { type: m.direction?.type || 'transition', angle: Number(e.target.value) } });
    });
    on('#pr-del', 'click', () => { const id = this.doc.selection; this._selfEdit = true; this.doc.remove(id); this.onEdit(); this._selfEdit = false; this.render(); });

    // ── 비주얼 디자인 ──
    on('#pr-dson', 'click', () => { const m = this.doc.selected(); this._edit({ design: defaultDesign(m.foot ? 'foot' : 'zone') }); this.render(); });
    on('#pr-dsoff', 'click', () => { this._edit({ design: null }); this.render(); });
    this.el.querySelectorAll('.pr-dseg').forEach(b => b.addEventListener('click', () => {
      const attr = b.dataset.attr, val = b.dataset.val;
      if (attr === 'shape') this._editDesign({ shape: val });
      else if (attr === 'filltype') this._editFill({ type: val });
      this.render();
    }));
    on('#pr-svg', 'click', () => this.el.querySelector('#pr-svgfile').click());
    on('#pr-svgfile', 'change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
      const m = this.doc.selected(); const design = { ...m.design, svgUrl: url, shape: 'svg' };
      await loadSvg(design);
      this._edit({ design }); this.render();
    });
    on('#pr-c0', 'input', e => this._editFill({ c0: e.target.value }));
    on('#pr-c1', 'input', e => this._editFill({ c1: e.target.value }));
    on('#pr-angf', 'input', e => this._editFill({ angle: Number(e.target.value) }));
    on('#pr-blur', 'input', e => { this._editDesign({ blur: Number(e.target.value) }); const v = this.el.querySelector('#pr-blurv'); if (v) v.textContent = e.target.value + 'px'; });
    on('#pr-op', 'input', e => { this._editDesign({ opacity: Number(e.target.value) / 100 }); const v = this.el.querySelector('#pr-opv'); if (v) v.textContent = e.target.value + '%'; });
    on('#pr-strokeon', 'change', e => { const m = this.doc.selected(); this._editDesign({ stroke: { ...m.design.stroke, on: e.target.checked } }); });
    on('#pr-strokecol', 'input', e => { const m = this.doc.selected(); this._editDesign({ stroke: { ...m.design.stroke, color: e.target.value } }); });

    this._drawPreview();
  }
}
