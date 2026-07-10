// ─────────────────────────────────────────────────────────────
// 장면 스코프 — 스테이지 GUI 요소를 '토큰과 같은 방식으로' 편집한다.
//
//   이전: 드롭다운으로 45장 중 하나 고르고 → 리스트에서 요소 고르고 → 속성.
//   지금: 2D 투사면에서 보이는 걸 클릭 → 같은 속성 패널.
//
//   좌표: 지면 스테이지는 전방이 -Z(요소 z<0) → 캔버스 세로 v = -z.
//         벽면 스테이지는 높이 y → v = y. 가로는 둘 다 x.
//   덮어쓰기는 DesignStore가 보관하고(전역=기본값 규칙), 3D 반영은
//   session.patchElement가 맡는다. 이 모듈은 둘을 잇는 얇은 층이다.
// ─────────────────────────────────────────────────────────────

const GLYPH = {
  text: '𝐓', foot: '👣', ring: '◎', arc: '◜', arrow: '➤',
  stripe: '▬', lane: '┆', box: '▢', group: '⧉', mesh: '◆', line: '─',
};
const TYPE_KO = {
  text: '글자', foot: '발자국', ring: '링', arc: '아크', arrow: '화살표',
  stripe: '스트라이프', lane: '레인', box: '박스', group: '그룹', mesh: '도형', line: '선',
};

const S_ROW = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;font-size:11px;';
const S_BTN = 'padding:2px 7px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--dim);font-size:9.5px;cursor:pointer;';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class SceneScope {
  constructor(session, store, opts = {}) {
    this.s = session;
    this.store = store;
    this.sport = opts.sport || 'running';
    this.stageId = null;
    this.sel = -1;
    this.onDirty = opts.onDirty || (() => {});
  }

  get wall() { return this.sport === 'boxing'; }

  stages() { return this.s.stagesFor(this.sport) || []; }

  setSport(sport) {
    this.sport = sport;
    this.sel = -1;
    const st = this.stages();
    this.setStage(st[0]?.id ?? null);
  }

  setStage(stageId) {
    this.stageId = stageId;
    this.sel = -1;
    if (stageId) this.s.previewStage(stageId);
  }

  leave() { this.s.endPreview(); }

  _target(idx = this.sel) { return { kind: 'el', stageId: this.stageId, idx }; }

  // ── 캔버스 공급 ──
  items() {
    if (!this.stageId) return [];
    return this.s.sceneElements(this.stageId).map(({ i, o, el }) => {
      const type = el.type || 'mesh';
      return {
        key: i,
        h: o.position.x,
        v: this.wall ? o.position.y : -o.position.z,
        glyph: GLYPH[type] || '◆',
        label: type === 'text' ? (el.content || '글자') : TYPE_KO[type] || type,
        sel: i === this.sel,
      };
    });
  }

  pick(key) { this.sel = key ?? -1; }

  dragTo(key, h, v) {
    const patch = this.wall ? { x: h, y: v } : { x: h, z: -v };
    this.s.patchElement(this.stageId, key, patch);
    for (const [k, val] of Object.entries(patch)) this.store.setOverride(this._target(key), k, val);
    this.onDirty();
  }

  /** 한 속성만 기본값(원본 디자인)으로 — 나머지 덮어쓰기는 살린다 */
  revert(prop) {
    const t = this._target();
    this.store.clearOverride(t, prop);
    this.s.resetElement(this.stageId, this.sel);
    const bag = this.store.stageStore(this.stageId).patches[this.sel] || {};
    this.s.patchElement(this.stageId, this.sel, bag);
    this.onDirty();
  }

  set(prop, value) {
    this.s.patchElement(this.stageId, this.sel, { [prop]: value });
    this.store.setOverride(this._target(), prop, value);
    this.onDirty();
  }

  setText(patch) {
    const cur = this.store.stageStore(this.stageId).patches[this.sel]?.text || {};
    const text = { ...cur, ...patch };
    this.s.patchElement(this.stageId, this.sel, { text });
    this.store.setOverride(this._target(), 'text', text);
    this.onDirty();
  }

  // ── 속성 패널 (마크 패널과 같은 어휘: 모양·색·크기·흐림·투명도 + ▾고급) ──
  renderProps(host, onRerender) {
    if (!this.stageId) { host.innerHTML = ''; return; }
    if (this.sel < 0) {
      host.innerHTML = `<div style="padding:12px 14px;font-size:11px;color:var(--dim);line-height:1.7;">
        <b style="color:var(--text);">이 장면의 요소를 편집합니다.</b><br>
        ① 위 화면에서 <b style="color:var(--accent);">네모(요소)를 클릭</b><br>
        ② 아래에서 색·크기·글자를 바꾸면<br>
        ③ 오른쪽 3D에 바로 반영됩니다.</div>`;
      return;
    }
    const els = this.s.sceneElements(this.stageId);
    const cur = els.find(e => e.i === this.sel);
    if (!cur) { host.innerHTML = ''; return; }
    const type = cur.el.type || 'mesh';
    const bag = this.store.stageStore(this.stageId).patches[this.sel] || {};
    const has = p => this.store.isOverridden(this._target(), p);
    const tag = p => has(p)
      ? `<button class="sc-rv" data-p="${p}" style="${S_BTN}color:var(--accent);border-color:var(--accent);">↺ 기본값</button>`
      : `<span style="font-size:9.5px;color:var(--dim);opacity:.7;">기본값 따름</span>`;

    const o = cur.o;
    const color = bag.color || '#fa3030';
    const scale = bag.scale ?? o.scale.x;
    const opacity = bag.opacity ?? 1;
    const rot = bag.rot ?? (o.rotation.z * 180 / Math.PI);
    const hidden = bag.hidden ?? !o.visible;

    host.innerHTML = `
      <div style="padding:10px 14px;max-height:38vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="font-size:12px;">${GLYPH[type] || '◆'} ${TYPE_KO[type] || type}</b>
          <span style="font-size:10px;color:var(--dim);">#${this.sel}</span>
        </div>

        ${type === 'text' ? `
        <div style="${S_ROW}"><span>글자</span>${tag('text')}</div>
        <input id="sc-text" value="${esc(bag.text?.content ?? cur.el.content ?? '')}"
          style="width:100%;padding:6px;margin-bottom:9px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:5px;font-size:11px;">` : ''}

        <div style="${S_ROW}"><span>색</span>${tag('color')}</div>
        <input id="sc-color" type="color" value="${color}" style="width:100%;height:28px;margin-bottom:9px;border:1px solid var(--line);border-radius:5px;background:var(--panel2);cursor:pointer;">

        <div style="${S_ROW}"><span>크기 <b id="sc-sv" style="color:var(--accent);">${scale.toFixed(2)}×</b></span>${tag('scale')}</div>
        <input id="sc-scale" type="range" min="20" max="300" value="${Math.round(scale * 100)}" style="width:100%;margin-bottom:9px;">

        <div style="${S_ROW}"><span>투명도 <b id="sc-ov" style="color:var(--accent);">${opacity.toFixed(2)}</b></span>${tag('opacity')}</div>
        <input id="sc-opacity" type="range" min="0" max="100" value="${Math.round(opacity * 100)}" style="width:100%;margin-bottom:10px;">

        <details style="margin-top:2px;">
          <summary style="font-size:11px;color:var(--dim);cursor:pointer;">▾ 고급 설정</summary>
          <div style="padding-top:8px;">
            <div style="${S_ROW}"><span>회전 <b id="sc-rv2" style="color:var(--accent);">${Math.round(rot)}°</b></span>${tag('rot')}</div>
            <input id="sc-rot" type="range" min="-180" max="180" value="${Math.round(rot)}" style="width:100%;margin-bottom:9px;">
            <label style="display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;">
              <input id="sc-hidden" type="checkbox" ${hidden ? 'checked' : ''}> 이 요소 숨기기
            </label>
          </div>
        </details>
      </div>`;

    const $ = s => host.querySelector(s);
    const live = (sel, evt, fn) => $(sel)?.addEventListener(evt, fn);

    host.querySelectorAll('.sc-rv').forEach(b => b.addEventListener('click', () => {
      this.revert(b.dataset.p); onRerender();
    }));
    live('#sc-color', 'input', e => this.set('color', e.target.value));
    live('#sc-scale', 'input', e => { const v = e.target.value / 100; $('#sc-sv').textContent = v.toFixed(2) + '×'; this.set('scale', v); });
    live('#sc-opacity', 'input', e => { const v = e.target.value / 100; $('#sc-ov').textContent = v.toFixed(2); this.set('opacity', v); });
    live('#sc-rot', 'input', e => { const v = +e.target.value; $('#sc-rv2').textContent = Math.round(v) + '°'; this.set('rot', v); });
    live('#sc-hidden', 'change', e => { this.set('hidden', e.target.checked); onRerender(); });
    live('#sc-text', 'input', e => this.setText({ content: e.target.value }));
    // '↺ 기본값' 버튼은 덮어쓰기가 생겨야 나타난다 → 값 확정 시 다시 그린다.
    // input이 아닌 change에 거는 이유: 슬라이더/색 드래그 중 리렌더하면 입력이 끊긴다.
    for (const s of ['#sc-color', '#sc-scale', '#sc-opacity', '#sc-rot', '#sc-text']) live(s, 'change', onRerender);
  }
}
