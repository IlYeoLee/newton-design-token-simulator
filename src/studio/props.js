// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 속성 패널 (선택 MARK 하나하나 개별 편집)
//   카탈로그 그대로: 계약(도달·회피·유지) · 발형 스킨 · 판정 허용창(반경)
//   · 채널 ②순서 ③방향 · 모디파이어 holdRing · 삭제.
//   변경은 doc.update → 즉시 3D/캔버스 반영. 슬라이더 드래그 중 리렌더 방지.
// ─────────────────────────────────────────────────────────────
import { CONTRACTS, DIRECTION_TYPES } from './doc.js';
import { runMap } from './doc.js';

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

        <button id="pr-del" style="width:100%;margin-top:14px;padding:8px 0;border:1px solid #ff5c8a;border-radius:6px;background:rgba(255,92,138,.1);color:#ff5c8a;font-size:12px;font-weight:700;cursor:pointer;">🗑 이 마크 삭제</button>
      </div>`;
    this._sync();
    this._bind();
  }

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
  }
}
