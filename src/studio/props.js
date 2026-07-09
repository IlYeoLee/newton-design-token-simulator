// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 편집 패널 (쉬운 버전)
//   기본 화면엔 색·모양·크기 같은 '디자인 기본기'만. 전문용어(계약·채널)는
//   '더 보기'로 접어둠. 아무것도 선택 안 하면 무엇을 하면 되는지 단계 안내.
// ─────────────────────────────────────────────────────────────
import { CONTRACTS, DIRECTION_TYPES } from './doc.js';
import { runMap } from './doc.js';
import { defaultDesign, renderDesignCanvas, loadSvg } from './design.js';

const SHAPES = [['zone', '● 동그라미'], ['foot', '👣 발자국'], ['ring', '◎ 링'], ['number', '① 숫자'], ['svg', '🖼 그림']];
// 쉬운 말 라벨
const ROLES = [['reach', '밟기'], ['avoid', '피하기'], ['hold', '버티기']];
const DIRS = [['none', '없음'], ['transition', '전환'], ['rotation', '회전'], ['reciprocation', '좌우']];

export class StudioProps {
  constructor(container, doc, opts = {}) {
    this.el = container;
    this.doc = doc;
    this.onEdit = opts.onEdit || (() => {});
    this._selfEdit = false;
    this._renderedId = undefined;
    this.showAdv = false;
    this._unsub = doc.onChange((d, reason) => {
      if (this._selfEdit) return;
      if (this.doc.selection !== this._renderedId || ['load', 'remove', 'add'].includes(reason)) this.render();
      else this._sync();
    });
    this.render();
  }
  destroy() { this._unsub?.(); this.el.innerHTML = ''; }

  // 아직 디자인 안 한 토큰은 3D의 기본 동그라미와 맞춰 'zone'으로 표시
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

  _sync() {
    const m = this.doc.selected(); if (!m) return;
    const q = s => this.el.querySelector(s);
    const set = (s, v) => { const e = q(s); if (e) e.textContent = v; };
    set('#pr-szv', `${m.radiusCm}cm`);
    const d = this._dsn(m);
    set('#pr-blv', `${d.blur}`);
    set('#pr-opv', `${Math.round(d.opacity * 100)}%`);
    this._drawPreview();
  }

  render() {
    const prevScroll = this.el.querySelector('.pr-scroll')?.scrollTop || 0;
    this._renderedId = this.doc.selection;
    const m = this.doc.selected();

    if (!m) {
      this.el.innerHTML = `<div style="padding:14px 16px;font-size:12px;color:var(--dim);line-height:1.7;">
        <div style="font-size:13px;color:var(--text);font-weight:700;margin-bottom:10px;">🎨 토큰을 디자인해요</div>
        <div style="display:flex;gap:9px;margin-bottom:7px;"><span style="color:var(--accent);font-weight:700;">1</span><span>아래 트랙에서 <b style="color:var(--text)">동그라미(토큰) 하나</b>를 클릭하세요.</span></div>
        <div style="display:flex;gap:9px;margin-bottom:7px;"><span style="color:var(--accent);font-weight:700;">2</span><span>여기서 <b style="color:var(--text)">색·모양·크기</b>를 바꾸면</span></div>
        <div style="display:flex;gap:9px;margin-bottom:12px;"><span style="color:var(--accent);font-weight:700;">3</span><span>오른쪽 <b style="color:var(--text)">3D 화면에 바로</b> 나타나요.</span></div>
        <div style="padding-top:10px;border-top:1px solid var(--line);color:var(--dim);">새 토큰을 넣으려면 위의 <b style="color:var(--text)">＋ 토큰 넣기</b>를 누르고 트랙을 클릭하세요.</div>
      </div>`;
      return;
    }

    const d = this._dsn(m);
    const seg = (opts, cur, cls, attr) => opts.map(([v, label]) =>
      `<button class="${cls}" data-attr="${attr}" data-val="${v}" style="padding:6px 9px;border:1px solid ${v === cur ? 'var(--accent)' : 'var(--line)'};border-radius:6px;background:${v === cur ? 'rgba(250,48,48,.16)' : 'var(--panel2)'};color:${v === cur ? 'var(--accent)' : 'var(--dim)'};font-size:11px;cursor:pointer;white-space:nowrap;">${label}</button>`).join('');
    const grad = d.fill.type !== 'solid';

    this.el.innerHTML = `
      <div class="pr-scroll" style="padding:12px 14px;overflow-y:auto;max-height:360px;font-size:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <canvas id="pr-preview" width="80" height="80" style="width:46px;height:46px;background:#0c0e12;border:1px solid var(--line);border-radius:8px;flex:none;"></canvas>
          <div><div style="font-weight:700;color:var(--text);">이 토큰 편집</div><div style="color:var(--dim);font-size:11px;">바꾸면 3D에 바로 반영돼요</div></div>
        </div>

        <div style="color:var(--dim);margin-bottom:5px;">모양</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:${d.shape === 'svg' ? '6' : '12'}px;">${seg(SHAPES, d.shape, 'pr-shape', 'shape')}</div>
        ${d.shape === 'svg' ? `<button id="pr-svg" style="width:100%;margin-bottom:12px;padding:8px 0;border:1px dashed var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:11px;cursor:pointer;">${d.svgUrl ? '✓ 그림 바꾸기 (SVG)' : '⬆ 그림 올리기 (SVG 파일)'}</button><input id="pr-svgfile" type="file" accept=".svg,image/svg+xml" style="display:none;">` : ''}

        <div style="color:var(--dim);margin-bottom:5px;">색</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
          <input id="pr-c0" type="color" value="${d.fill.c0}" style="width:40px;height:30px;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer;">
          ${grad ? `<span style="color:var(--dim);">→</span><input id="pr-c1" type="color" value="${d.fill.c1}" style="width:40px;height:30px;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer;">` : ''}
          <label style="margin-left:auto;display:flex;align-items:center;gap:6px;color:var(--dim);cursor:pointer;"><input id="pr-grad" type="checkbox" ${grad ? 'checked' : ''}> 그라데이션</label>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">크기</span><span id="pr-szv" style="color:var(--accent);">${m.radiusCm}cm</span></div>
        <input id="pr-size" type="range" min="9" max="30" step="1" value="${m.radiusCm}" style="width:100%;margin-bottom:10px;">

        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">흐림(블러)</span><span id="pr-blv" style="color:var(--accent);">${d.blur}</span></div>
        <input id="pr-blur" type="range" min="0" max="20" step="1" value="${d.blur}" style="width:100%;margin-bottom:10px;">

        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:var(--dim);">투명도</span><span id="pr-opv" style="color:var(--accent);">${Math.round(d.opacity * 100)}%</span></div>
        <input id="pr-op" type="range" min="10" max="100" step="5" value="${Math.round(d.opacity * 100)}" style="width:100%;margin-bottom:6px;">

        <button id="pr-adv" style="width:100%;margin-top:8px;padding:7px 0;border:1px solid var(--line);border-radius:6px;background:none;color:var(--dim);font-size:11px;cursor:pointer;">${this.showAdv ? '▴ 고급 설정 접기' : '▾ 고급 설정 (역할·순서·방향)'}</button>
        ${this.showAdv ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
          <div style="color:var(--dim);margin-bottom:5px;">이 자리에서 뭘 하나요?</div>
          <div style="display:flex;gap:4px;margin-bottom:10px;">${seg(ROLES, m.contract, 'pr-role', 'role')}</div>
          <label style="display:flex;align-items:center;gap:7px;margin-bottom:7px;cursor:pointer;"><input id="pr-order" type="checkbox" ${m.order ? 'checked' : ''}> 순서 숫자 보이기</label>
          <label style="display:flex;align-items:center;gap:7px;margin-bottom:10px;cursor:pointer;"><input id="pr-hold" type="checkbox" ${m.holdRing ? 'checked' : ''}> 버티기 링(채워지는 원)</label>
          <div style="color:var(--dim);margin-bottom:5px;">방향 화살표</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">${seg(DIRS, m.direction?.type || 'none', 'pr-dir', 'dir')}</div>
          ${(m.direction && m.direction.type !== 'none') ? `<input id="pr-angle" type="range" min="-180" max="180" step="5" value="${m.direction.angle || 0}" style="width:100%;margin-top:8px;">` : ''}
        </div>` : ''}

        <button id="pr-del" style="width:100%;margin-top:14px;padding:9px 0;border:1px solid #ff5c8a;border-radius:6px;background:rgba(255,92,138,.1);color:#ff5c8a;font-size:12px;font-weight:700;cursor:pointer;">🗑 이 토큰 지우기</button>
      </div>`;
    this._bind();
    this._drawPreview();
    const sc = this.el.querySelector('.pr-scroll'); if (sc) sc.scrollTop = prevScroll;
  }

  _drawPreview() {
    const cv = this.el.querySelector('#pr-preview'); const m = this.doc.selected();
    if (!cv || !m) return;
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(renderDesignCanvas(this._dsn(m), 128), 0, 0, cv.width, cv.height);
  }

  _bind() {
    const on = (sel, ev, fn) => { const el = this.el.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    // 모양
    this.el.querySelectorAll('.pr-shape').forEach(b => b.addEventListener('click', () => { this._editDesign({ shape: b.dataset.val }); this.render(); }));
    on('#pr-svg', 'click', () => this.el.querySelector('#pr-svgfile').click());
    on('#pr-svgfile', 'change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
      const design = { ...this._dsn(this.doc.selected()), svgUrl: url, shape: 'svg' };
      await loadSvg(design);
      this._editDesign(design); this.render();
    });
    // 색
    on('#pr-c0', 'input', e => this._editFill({ c0: e.target.value }));
    on('#pr-c1', 'input', e => this._editFill({ c1: e.target.value }));
    on('#pr-grad', 'change', e => { this._editFill({ type: e.target.checked ? 'radial' : 'solid' }); this.render(); });
    // 크기·흐림·투명도
    on('#pr-size', 'input', e => { this._edit({ radiusCm: Number(e.target.value) }); const v = this.el.querySelector('#pr-szv'); if (v) v.textContent = e.target.value + 'cm'; });
    on('#pr-blur', 'input', e => { this._editDesign({ blur: Number(e.target.value) }); const v = this.el.querySelector('#pr-blv'); if (v) v.textContent = e.target.value; });
    on('#pr-op', 'input', e => { this._editDesign({ opacity: Number(e.target.value) / 100 }); const v = this.el.querySelector('#pr-opv'); if (v) v.textContent = e.target.value + '%'; });
    // 고급
    on('#pr-adv', 'click', () => { this.showAdv = !this.showAdv; this.render(); });
    this.el.querySelectorAll('.pr-role').forEach(b => b.addEventListener('click', () => { this._edit({ contract: b.dataset.val }); this.render(); }));
    on('#pr-order', 'change', e => this._edit({ order: e.target.checked }));
    on('#pr-hold', 'change', e => this._edit({ holdRing: e.target.checked }));
    this.el.querySelectorAll('.pr-dir').forEach(b => b.addEventListener('click', () => {
      const val = b.dataset.val, m = this.doc.selected();
      this._edit({ direction: val === 'none' ? null : { type: val, angle: m.direction?.angle || 0 } });
      this.render();
    }));
    on('#pr-angle', 'input', e => { const m = this.doc.selected(); this._edit({ direction: { type: m.direction?.type || 'transition', angle: Number(e.target.value) } }); });
    on('#pr-del', 'click', () => { const id = this.doc.selection; this._selfEdit = true; this.doc.remove(id); this.onEdit(); this._selfEdit = false; this.render(); });
  }
}
