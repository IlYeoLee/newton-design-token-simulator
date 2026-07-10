// ─────────────────────────────────────────────────────────────
// 통합 디자인 저장소 — 세 에디터(스튜디오·장면·에디터)가 각자 쓰던 저장소를 하나로.
//
//   이전:  newton_studio_<종목>  (팩 토큰)
//          newton_scene_overrides (스테이지 요소)
//          전역 설정(COLORS·TCFG·SCFG)은 저장조차 안 됨 — 새로고침하면 소실
//
//   지금:  newton_design_v1 = { global, packs, scenes }
//
//   규칙: 전역 = 기본값, 개별 = 덮어쓰기.
//   개별 값이 '없음'이면 전역을 따른다. 지웠다 ≠ 0으로 설정했다 —
//   이 구분이 무너지면 "기본값으로 되돌리기"가 불가능해진다. 그래서 삭제는
//   delete로, 값은 undefined가 아닌 것만 덮어쓰기로 친다.
//
//   마크와 장면 요소는 덮어쓰기를 서로 다른 곳에 저장한다
//   (마크=packs[종목].tokens[].design, 요소=scenes[스테이지].patches[idx]).
//   호출부가 그 차이를 알 필요는 없다 → _bag()이 흡수한다.
// ─────────────────────────────────────────────────────────────

export const DESIGN_KEY = 'newton_design_v1';
export const LEGACY_SCENE_KEY = 'newton_scene_overrides';
export const LEGACY_STUDIO_KEY = sport => `newton_studio_${sport}`;
export const SPORTS = ['running', 'boxing', 'basketball'];

export const emptyStore = () => ({
  version: 1,
  global: { colors: {}, tcfg: {}, scfg: {} },
  packs: {},     // sport → pack JSON (tokens[].design 안에 개별 덮어쓰기)
  scenes: {},    // stageId → { patches: {idx: patch}, added: [spec] }
});

const isSet = v => v !== undefined && v !== null;

/** 레거시 3분할 저장소 → 통합 스키마. 원본은 지우지 않는다(롤백 여지). */
export function migrate(getItem) {
  const store = emptyStore();
  const migrated = [];

  for (const sp of SPORTS) {
    const raw = getItem(LEGACY_STUDIO_KEY(sp));
    if (!raw) continue;
    try { store.packs[sp] = JSON.parse(raw); migrated.push(LEGACY_STUDIO_KEY(sp)); }
    catch { /* 깨진 항목은 조용히 버린다 — 편집본 하나 때문에 부팅이 죽으면 안 됨 */ }
  }

  const rawScenes = getItem(LEGACY_SCENE_KEY);
  if (rawScenes) {
    try { store.scenes = JSON.parse(rawScenes) || {}; migrated.push(LEGACY_SCENE_KEY); }
    catch {}
  }
  return { store, migrated };
}

export class DesignStore {
  constructor(data) {
    this.d = data || emptyStore();
    this.listeners = new Set();
  }

  /** v1이 있으면 그대로, 없으면 레거시에서 1회 이행 */
  static load(storage = localStorage) {
    const get = k => { try { return storage.getItem(k); } catch { return null; } };
    const raw = get(DESIGN_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && d.version === 1) return { store: new DesignStore(d), migrated: [] };
      } catch {}
    }
    const { store, migrated } = migrate(get);
    return { store: new DesignStore(store), migrated };
  }

  save(storage = localStorage) {
    // _img = 런타임 Image 캐시. 직렬화하면 저장소가 터진다.
    try { storage.setItem(DESIGN_KEY, JSON.stringify(this.d, (k, v) => (k === '_img' ? undefined : v))); }
    catch (e) { console.warn('[design store] save 실패', e); return false; }
    return true;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this.d); }

  // ── 전역 기본값 (ns: 'colors' | 'tcfg' | 'scfg') ──
  globalGet(ns, key, fallback) {
    const v = this.d.global[ns]?.[key];
    return isSet(v) ? v : fallback;
  }
  globalSet(ns, key, value) {
    (this.d.global[ns] ||= {})[key] = value;
    this._emit();
  }
  globalReset(ns, key) {
    if (this.d.global[ns]) delete this.d.global[ns][key];
    this._emit();
  }

  // ── 개별 덮어쓰기 ──
  // target = {kind:'mark', sport, id} | {kind:'el', stageId, idx}
  _bag(target, create = false) {
    if (target.kind === 'mark') {
      const pack = this.d.packs[target.sport];
      const tk = pack?.tokens?.find(t => t.id === target.id);
      if (!tk) return null;
      if (!tk.design && !create) return null;
      return (tk.design ||= {});
    }
    if (target.kind === 'el') {
      const sc = this.d.scenes[target.stageId];
      if (!sc && !create) return null;
      const st = (this.d.scenes[target.stageId] ||= { patches: {}, added: [] });
      if (!st.patches[target.idx] && !create) return null;
      return (st.patches[target.idx] ||= {});
    }
    return null;
  }

  /** 이 속성이 개별 지정됐나? (전역 기본값을 따르는 중이면 false) */
  isOverridden(target, prop) {
    const bag = this._bag(target);
    return !!bag && isSet(bag[prop]);
  }

  /** 실효값 = 개별 덮어쓰기 ?? 전역 기본값 ?? fallback */
  resolve(target, prop, ns, globalKey, fallback) {
    const bag = this._bag(target);
    if (bag && isSet(bag[prop])) return bag[prop];
    return this.globalGet(ns, globalKey ?? prop, fallback);
  }

  setOverride(target, prop, value) {
    const bag = this._bag(target, true);
    if (!bag) return false;
    bag[prop] = value;
    this._emit();
    return true;
  }

  /** 기본값으로 되돌리기 — 0을 넣는 것과 다르다 */
  clearOverride(target, prop) {
    const bag = this._bag(target);
    if (!bag) return false;
    delete bag[prop];
    this._emit();
    return true;
  }

  // ── 팩 / 장면 접근 ──
  getPack(sport) { return this.d.packs[sport] || null; }
  setPack(sport, pack) { this.d.packs[sport] = pack; this._emit(); }
  sceneStore() { return this.d.scenes; }
  stageStore(stageId) { return (this.d.scenes[stageId] ||= { patches: {}, added: [] }); }
  clearStage(stageId) { delete this.d.scenes[stageId]; this._emit(); }
}
