// ─────────────────────────────────────────────────────────────
// 장면 디자인 에디터 — 3종목 전 스테이지(~45장)의 투사 GUI를 요소 단위로 편집.
//   세션 Scene API(previewStage/sceneElements/patchElement/createElement…) 위에서
//   동작. 이동·회전·크기·색·투명도·숨김 + 텍스트(내용·폰트·굵기·크기) + 요소 추가.
//   저장 = localStorage 오버라이드(무편집 시 원본과 픽셀 동일), 내보내기 = JSON.
// ─────────────────────────────────────────────────────────────
import { FONT_FAMILIES } from '../session.js';

const KEY = 'newton_scene_overrides';
const TYPE_LABEL = {
  text: '𝐓 텍스트', foot: '👣 발자국', ring: '◎ 링', arc: '◜ 아크', arrow: '➤ 화살표',
  stripe: '▬ 스트라이프', lane: '┆ 레인', box: '▢ 박스', group: '⧉ 그룹', mesh: '◆ 도형', line: '─ 선',
};
const SPORTS = [['running', '러닝'], ['boxing', '복싱'], ['basketball', '농구']];

export class SceneEditor {
  constructor(session, opts = {}) {
    this.s = session;
    this.opts = opts;               // { onOpen, onClose, viewFor(sport) }
    this.store = this._load();
    this.sport = 'running';
    this.stageId = null;
    this.sel = -1;
    this._buildDom();
  }

  _load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.store)); } catch {} }
  stageStore() {
    const id = this.stageId;
    return this.store[id] || (this.store[id] = { patches: {}, added: [] });
  }

  // ── DOM ──
  _buildDom() {
    const el = this.el = document.createElement('div');
    el.style.cssText = 'position:absolute;top:0;right:0;bottom:0;width:340px;background:rgba(12,14,18,.98);border-left:1px solid var(--line);z-index:30;display:none;flex-direction:column;font-size:12px;color:var(--text);';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px 8px;border-bottom:1px solid var(--line);">
        <b style="font-size:13px;">🎬 장면 디자인 <span style="color:var(--dim);font-weight:400;font-size:11px;">· 전 종목</span></b>
        <button id="sce-close" style="border:none;background:none;color:var(--dim);font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div id="sce-sports" style="display:flex;gap:5px;padding:9px 14px;border-bottom:1px solid var(--line);"></div>
      <select id="sce-stage" style="margin:9px 14px 4px;padding:7px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;"></select>
      <div style="display:flex;gap:5px;padding:4px 14px 9px;border-bottom:1px solid var(--line);flex-wrap:wrap;">
        <button class="sce-add" data-k="text" style="${BTN}">＋𝐓 글자</button>
        <button class="sce-add" data-k="ring" style="${BTN}">＋◎ 링</button>
        <button class="sce-add" data-k="arrow" style="${BTN}">＋➤ 화살표</button>
        <button class="sce-add" data-k="foot" style="${BTN}">＋👣 발</button>
      </div>
      <div id="sce-list" style="flex:0 0 auto;max-height:30%;overflow-y:auto;border-bottom:1px solid var(--line);"></div>
      <div id="sce-props" style="flex:1;overflow-y:auto;padding:10px 14px;"></div>
      <div style="display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--line);">
        <button id="sce-export" style="${BTN}flex:1;">⧉ 전체 JSON 복사</button>
        <button id="sce-clear" style="${BTN}flex:1;color:#ff5c8a;">↺ 이 장면 초기화</button>
      </div>
      <div style="padding:0 14px 10px;font-size:10px;color:var(--dim);">✓ 자동 저장 — 새로고침해도 유지. 초기화=원본 디자인.</div>`;
    document.body.appendChild(el);

    el.querySelector('#sce-close').addEventListener('click', () => this.close());
    el.querySelector('#sce-export').addEventListener('click', async () => {
      await navigator.clipboard.writeText(JSON.stringify(this.store, null, 2));
      const b = el.querySelector('#sce-export'); const t = b.textContent; b.textContent = '✓ 복사됨'; setTimeout(() => b.textContent = t, 1400);
    });
    el.querySelector('#sce-clear').addEventListener('click', () => this._clearStage());
    el.querySelectorAll('.sce-add').forEach(b => b.addEventListener('click', () => this._add(b.dataset.k)));

    const tabs = el.querySelector('#sce-sports');
    for (const [id, label] of SPORTS) {
      const b = document.createElement('button');
      b.textContent = label; b.dataset.sport = id; b.style.cssText = BTN + 'flex:1;';
      b.addEventListener('click', () => { this.sport = id; this._syncTabs(); this._fillStages(); });
      tabs.appendChild(b);
    }
    el.querySelector('#sce-stage').addEventListener('change', e => this._selectStage(e.target.value));
  }
  _syncTabs() {
    this.el.querySelectorAll('#sce-sports button').forEach(b => {
      const on = b.dataset.sport === this.sport;
      b.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
      b.style.color = on ? 'var(--accent)' : 'var(--dim)';
      b.style.background = on ? 'rgba(250,48,48,.14)' : 'var(--panel2)';
    });
  }

  open() {
    this.opts.onOpen?.();
    this.el.style.display = 'flex';
    this._syncTabs();
    this._fillStages();
  }
  close() {
    this.el.style.display = 'none';
    this.s.endPreview();
    this.opts.onClose?.();
  }
  get isOpen() { return this.el.style.display === 'flex'; }

  _fillStages() {
    const sel = this.el.querySelector('#sce-stage');
    sel.innerHTML = '';
    for (const st of this.s.stagesFor(this.sport)) {
      const o = document.createElement('option');
      o.value = st.id; o.textContent = st.label;
      sel.appendChild(o);
    }
    this._selectStage(sel.value);
    this.opts.viewFor?.(this.sport);
  }
  _selectStage(id) {
    this.stageId = id;
    this.sel = -1;
    this.s.previewStage(id);
    this._fillList();
    this._fillProps();
  }
  _fillList() {
    const list = this.el.querySelector('#sce-list');
    list.innerHTML = '';
    for (const { i, o, el } of this.s.sceneElements(this.stageId)) {
      const row = document.createElement('div');
      const name = el.type === 'text' ? `𝐓 "${(el.content || '').slice(0, 14)}"` : (TYPE_LABEL[el.type] || el.type);
      row.textContent = `${i} · ${name}${o.userData.addedSpec ? ' ✚' : ''}${o.visible ? '' : ' (숨김)'}`;
      row.style.cssText = `padding:6px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);color:${i === this.sel ? 'var(--accent)' : (o.visible ? 'var(--text)' : 'var(--dim)')};background:${i === this.sel ? 'rgba(250,48,48,.1)' : 'none'};`;
      row.addEventListener('click', () => { this.sel = i; this._flash(o); this._fillList(); this._fillProps(); });
      list.appendChild(row);
    }
  }
  _flash(o) {   // 선택 표시: 잠깐 스케일 펄스
    const s0 = o.scale.x; let k = 0;
    const tick = () => { k += 0.12; o.scale.setScalar(s0 * (1 + 0.18 * Math.sin(Math.min(k, Math.PI)))); if (k < Math.PI) requestAnimationFrame(tick); else o.scale.setScalar(s0); };
    tick();
  }

  // ── 속성 패널 ──
  _fillProps() {
    const box = this.el.querySelector('#sce-props');
    const items = this.s.sceneElements(this.stageId);
    const it = items[this.sel];
    if (!it) { box.innerHTML = `<div style="color:var(--dim);line-height:1.7;">위 목록에서 요소를 고르면<br>여기서 위치·크기·색·글자를 편집해요.<br><br>＋ 버튼으로 글자·링·화살표·발자국을<br>이 장면에 추가할 수 있어요.</div>`; return; }
    const { o, el } = it;
    const wall = !!el.wall || this.stageId.startsWith('BX_');
    const deg = Math.round(o.rotation.z * 180 / Math.PI);
    const rows = [];
    rows.push(slider('x', '↔ 가로', o.position.x, -2.5, 2.5, 0.01));
    rows.push(wall ? slider('y', '↕ 높이', o.position.y, 0, 2.4, 0.01) : slider('z', '↕ 깊이', o.position.z, -4.5, 1.0, 0.01));
    rows.push(slider('rot', '⟳ 회전', deg, -180, 180, 1, '°'));
    rows.push(slider('scale', '⤢ 크기', o.scale.x, 0.2, 3, 0.05, '×'));
    rows.push(slider('opacity', '◐ 투명도', this._elOpacity(o, el), 0, 1, 0.05));
    if (el.type !== 'text' && el.type !== 'foot')
      rows.push(`<div style="display:flex;align-items:center;gap:8px;margin:8px 0;"><span style="color:var(--dim);width:64px;">색</span><input type="color" data-p="color" value="${this._elColor(o)}" style="width:44px;height:28px;border:1px solid var(--line);border-radius:6px;background:none;"></div>`);
    if (el.type === 'text') {
      rows.push(`<div style="margin:10px 0 4px;color:var(--dim);">글자</div>
        <input type="text" data-t="content" value="${(el.content || '').replace(/"/g, '&quot;')}" style="${INP}width:100%;box-sizing:border-box;">
        <div style="display:flex;gap:6px;margin-top:6px;">
          <select data-t="family" style="${INP}flex:1.4;">${FONT_FAMILIES.map(([v, l]) => `<option value='${v}' ${v === el.family ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select data-t="weight" style="${INP}flex:0.8;">${[400, 700, 800].map(w => `<option ${w === el.weight ? 'selected' : ''}>${w}</option>`).join('')}</select>
          <input type="color" data-t="color" value="${el.color?.startsWith('#') ? el.color : '#ffffff'}" style="width:38px;height:30px;border:1px solid var(--line);border-radius:6px;background:none;">
        </div>`);
      rows.push(slider('tsize', '𝐓 크기', el.size, 0.04, 0.5, 0.005));
    }
    rows.push(`<label style="display:flex;align-items:center;gap:7px;margin:10px 0;cursor:pointer;"><input type="checkbox" data-p="hidden" ${o.visible ? '' : 'checked'}> 숨기기</label>`);
    rows.push(`<div style="display:flex;gap:6px;margin-top:8px;">
      <button id="sce-reset" style="${BTN}flex:1;">↺ 이 요소 원본</button>
      <button id="sce-del" style="${BTN}flex:1;color:#ff5c8a;">🗑 삭제</button></div>`);
    box.innerHTML = rows.join('');

    box.querySelectorAll('[data-p]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.p;
      const v = inp.type === 'checkbox' ? inp.checked : (inp.type === 'color' ? inp.value : Number(inp.value));
      this._patch({ [k]: v });
      const lab = box.querySelector(`[data-v="${k}"]`); if (lab) lab.textContent = fmt(v, inp.dataset.suffix);
    }));
    box.querySelectorAll('[data-t]').forEach(inp => inp.addEventListener('input', () => {
      const t = {}; t[inp.dataset.t] = inp.dataset.t === 'weight' ? Number(inp.value) : inp.value;
      this._patch({ text: t });
      if (inp.dataset.t === 'content') this._fillList();
    }));
    const ts = box.querySelector('[data-p="tsize"]');
    if (ts) { ts.dataset.p = ''; ts.addEventListener('input', () => { this._patch({ text: { size: Number(ts.value) } }); const lab = box.querySelector('[data-v="tsize"]'); if (lab) lab.textContent = fmt(Number(ts.value)); }); }
    box.querySelector('#sce-reset')?.addEventListener('click', () => { this.s.resetElement(this.stageId, this.sel); delete this.stageStore().patches[this.sel]; this._save(); this._fillProps(); this._fillList(); });
    box.querySelector('#sce-del')?.addEventListener('click', () => this._delete());
  }
  _elColor(o) {
    let hex = '#fa3030';
    o.traverse(m => { if (m.material?.color && hex === '#fa3030') hex = '#' + m.material.color.getHexString(); });
    return hex;
  }
  _elOpacity(o, el) {
    if (el.type === 'foot') return o.children[0]?.material?.opacity ?? 1;
    let op = 1; o.traverse(m => { if (m.material) op = m.material.opacity; });
    return op;
  }

  // ── 편집 적용 + 저장 ──
  _patch(patch) {
    const { o } = this.s.sceneElements(this.stageId)[this.sel] || {};
    if (!o) return;
    this.s.patchElement(this.stageId, this.sel, patch);
    if (o.userData.addedSpec) {   // 추가 요소 = spec.props에 직접 기록 (store와 동일 참조)
      const p = o.userData.addedSpec.props;
      if (patch.text) Object.assign(p, patch.text);
      for (const k of ['x', 'z', 'y', 'rot', 'scale', 'color', 'opacity']) if (patch[k] !== undefined) p[k] = patch[k];
    } else {
      const st = this.stageStore();
      const cur = st.patches[this.sel] || (st.patches[this.sel] = {});
      if (patch.text) cur.text = { ...(cur.text || {}), ...patch.text };
      for (const k of ['x', 'z', 'y', 'rot', 'scale', 'color', 'opacity', 'hidden']) if (patch[k] !== undefined) cur[k] = patch[k];
    }
    this._save();
  }
  _add(kind) {
    if (!this.stageId) return;
    const wall = this.stageId.startsWith('BX_');
    const spec = { kind, props: kind === 'text' ? { content: '새 텍스트', x: 0, [wall ? 'y' : 'z']: wall ? 1.4 : -1.6, size: 0.12, color: '#ffffff', weight: 700 } : { x: 0.3, [wall ? 'y' : 'z']: wall ? 1.0 : -1.6 } };
    const o = this.s.createElement(this.stageId, spec);
    if (!o) return;
    this.stageStore().added.push(spec);
    this._save();
    this.sel = this.s.sceneElements(this.stageId).length - 1;
    this._fillList(); this._fillProps();
  }
  _delete() {
    const { o } = this.s.sceneElements(this.stageId)[this.sel] || {};
    if (!o) return;
    if (o.userData.addedSpec) {
      const st = this.stageStore();
      const i = st.added.indexOf(o.userData.addedSpec);
      if (i >= 0) st.added.splice(i, 1);
      this.s.removeElement(this.stageId, this.sel);
    } else {
      this._patch({ hidden: true });   // 내장 요소 = 숨김으로 기록
    }
    this._save();
    this.sel = -1; this._fillList(); this._fillProps();
  }
  _clearStage() {
    const st = this.store[this.stageId];
    if (st) {
      for (const idx of Object.keys(st.patches)) this.s.resetElement(this.stageId, Number(idx));
      for (const { o, i } of [...this.s.sceneElements(this.stageId)].reverse()) if (o.userData.addedSpec) this.s.removeElement(this.stageId, i);
      delete this.store[this.stageId];
      this._save();
    }
    this.sel = -1; this._fillList(); this._fillProps();
  }
}

const BTN = 'padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:11px;cursor:pointer;';
const INP = 'padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:12px;';
const fmt = (v, suf = '') => (typeof v === 'number' ? (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)) : v) + (suf || '');
function slider(key, label, val, min, max, step, suf = '') {
  return `<div style="display:flex;justify-content:space-between;margin:7px 0 2px;"><span style="color:var(--dim);">${label}</span><span data-v="${key}" style="color:var(--accent);">${fmt(val, suf)}</span></div>
  <input type="range" data-p="${key}" data-suffix="${suf}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%;">`;
}
