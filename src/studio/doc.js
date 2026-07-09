// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 편집 문서 모델 (Document)
//   설계 계약: 상호작용 지점은 단 하나의 MARK 디자인이다.
//   MARK = 존 원(반경=판정 허용창) + 수축 링(timingRing).
//   계약이 갈라질 때만 최소 변조:
//     · 도달(reach) = 실선            · 회피(avoid) = 점선 반전
//     · 유지(hold)  = holdRing 채움    · 발형(foot)  = Step-type 티칭 스킨
//   채널 4개(토큰 아님, MARK에 부착):
//     ② 순서(order) · ③ 방향(direction) · ④ 경로(path=lane/sweep) · ⑥ 폼(ghost)
//   모디파이어: timingRing(Active 기본) · holdRing(유지 진행, 직접 부착)
//
//   Week 1 슬라이스 = 러닝 지면. nx=레인, t=깊이(depth=V·t+STRIKE_AHEAD).
// ─────────────────────────────────────────────────────────────

import { loadSvg, defaultDesign } from './design.js';

// 러닝 매핑 상수 — tokens.js LAYOUT.running 과 반드시 일치
export const RUN = {
  X_SCALE: 2.0,
  V: 2.5,
  STRIKE_AHEAD: 0.15,
  LANE_W: 1.6,
  STEP_LIFETIME: 1.19,
};

// 저작 ↔ 월드 좌표 (러닝) — 캔버스·검증이 공유하는 단일 매핑
export const runMap = {
  nxToLane: nx => nx * RUN.X_SCALE,
  laneToNx: x => x / RUN.X_SCALE,
  tToDepth: t => RUN.V * t + RUN.STRIKE_AHEAD,
  depthToT: d => Math.max(0, (d - RUN.STRIKE_AHEAD) / RUN.V),
};

// MARK 계약 · 채널 카탈로그 (팔레트·속성 패널이 참조)
export const CONTRACTS = [
  ['reach', '도달', '실선 · 밟기/치기'],
  ['avoid', '회피', '점선 반전 · 피하기'],
  ['hold',  '유지', 'holdRing 채움 · 가드/스탠스'],
];
export const DIRECTION_TYPES = [
  ['none', '없음'],
  ['transition', '전환형'],   // C·농구 — ±윈도만
  ['rotation', '회전 아크'],  // A 스트레칭 — 관절 회전
  ['reciprocation', '왕복형'],// A — 무게 이동·스윙
];
export const DEFAULT_RADIUS_CM = 17;

let _uid = 1;
const nextId = () => 'm' + _uid++;

export class StudioDoc {
  constructor(pack) {
    this.listeners = new Set();
    this.selection = null;   // 선택된 mark id
    this._undo = [];         // 되돌리기 스택 (직전 상태 스냅샷)
    this._redo = [];         // 다시하기 스택
    this._lastTag = null;    // 연속 편집 병합용 태그 (슬라이더 드래그 = 1스텝)
    this._lastChangeTime = 0;
    this.load(pack);
  }

  // ── 되돌리기/다시하기 (Undo/Redo) ──
  _serialize() {
    // design._img(런타임 Image 캐시)는 복제 불가 → 제외 후 깊은 복사
    const marks = this.marks.map(m => structuredClone({ ...m, design: m.design ? { ...m.design, _img: null } : null }));
    return { marks, laneOn: this.laneOn, selection: this.selection };
  }
  // 이산 편집(추가/삭제/레인/번호매기기): 항상 1스텝 스냅샷
  _snap() {
    this._undo.push(this._serialize());
    if (this._undo.length > 80) this._undo.shift();
    this._redo = []; this._lastTag = null;
  }
  // 연속 편집(슬라이더 드래그): 같은 태그 0.6s 내면 1스텝으로 병합
  _snapCoalesced(tag) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this._lastTag === tag && now - this._lastChangeTime < 600) { this._lastChangeTime = now; return; }
    this._undo.push(this._serialize());
    if (this._undo.length > 80) this._undo.shift();
    this._redo = [];
    this._lastTag = tag; this._lastChangeTime = now;
  }
  _applyState(st) {
    this.marks = st.marks.map(m => structuredClone(m));
    this.laneOn = st.laneOn;
    this.selection = this.get(st.selection) ? st.selection : null;
    for (const m of this.marks) if (m.design?.svgUrl) loadSvg(m.design).then(() => this.emit('svg'));
    this._lastTag = null;
    this.renumber();
    this.emit('load');   // 'load' = 패널·캔버스 전체 리렌더
  }
  undo() { if (!this._undo.length) return false; this._redo.push(this._serialize()); this._applyState(this._undo.pop()); return true; }
  redo() { if (!this._redo.length) return false; this._undo.push(this._serialize()); this._applyState(this._redo.pop()); return true; }
  get canUndo() { return this._undo.length > 0; }
  get canRedo() { return this._redo.length > 0; }

  // 모든 토큰에 0→N 숫자 레터링 (t 순서대로 0,1,2,…)
  numberSequence(start = 0) {
    this._snap();
    [...this.marks].sort((a, b) => a.t - b.t).forEach((m, i) => {
      m.design = { ...(m.design || defaultDesign('number')), shape: 'number', glyph: String(start + i) };
      if (m.design.svgUrl) loadSvg(m.design).then(() => this.emit('svg'));
    });
    this.emit('load');
  }

  // 팩 → MARK 목록. stepMark/targetMark = MARK 본체, 동일 t 의
  // orderPulse(순서)·directionGuide(방향)는 그 MARK에 부착된 채널로 흡수.
  load(pack, keepHistory = false) {
    this.base = { ...pack };
    this.sport = pack.sport;
    this.marks = [];
    this.laneOn = false;
    const byKey = new Map();       // tkey → mark (같은 t 채널 병합)
    for (const tk of (pack.tokens || [])) {
      if (tk.type === 'pathLane') { this.laneOn = true; continue; }
      const key = Math.round(tk.t * 1000);
      if (tk.type === 'stepMark' || tk.type === 'targetMark') {
        const m = {
          id: nextId(),
          surface: tk.type === 'targetMark' ? 'wall' : 'floor',
          foot: tk.foot ?? null,
          nx: tk.nx, ny: tk.ny ?? 0, t: tk.t,
          contract: tk.contract || 'reach',
          radiusCm: tk.radiusCm || DEFAULT_RADIUS_CM,
          holdRing: !!tk.holdRing,
          order: false, n: null,
          direction: null,
          design: tk.design ? { ...tk.design, _img: null } : null,   // 비주얼 디자인 스펙
        };
        this.marks.push(m);
        byKey.set(key, m);
        if (m.design?.svgUrl) loadSvg(m.design).then(() => this.emit('svg'));
      }
    }
    // 채널 부착 (본체 생성 뒤)
    for (const tk of (pack.tokens || [])) {
      const key = Math.round(tk.t * 1000);
      const m = byKey.get(key);
      if (!m) continue;
      if (tk.type === 'orderPulse') { m.order = true; m.n = tk.n; }
      if (tk.type === 'directionGuide') m.direction = { type: tk.dirType || 'transition', angle: tk.angle || 0, tip: tk.tip || 'triangle' };
    }
    // 러닝 기본: 스텝은 순서 채널을 단다 (케이던스 1-2-3)
    if (this.sport === 'running') for (const m of this.marks) if (m.order === false && m.n == null) m.order = true;
    if (!keepHistory) { this._undo = []; this._redo = []; this._lastTag = null; }
    this.renumber();
    this.emit('load');
  }

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit(reason) { for (const cb of this.listeners) cb(this, reason); }

  get(id) { return this.marks.find(m => m.id === id) || null; }
  selected() { return this.get(this.selection); }

  // ── 저작 연산 ──
  addMark(nx, t, opts = {}) {
    this._snap();
    const foot = opts.foot !== undefined ? opts.foot : (nx < 0 ? 'left' : 'right');  // 레인 쪽=발형 스킨
    const m = {
      id: nextId(), surface: 'floor', foot,
      nx, ny: 0, t: Math.max(0, t),
      contract: 'reach', radiusCm: DEFAULT_RADIUS_CM, holdRing: false,
      order: this.sport === 'running', n: null, direction: null, design: null,
    };
    this.marks.push(m);
    this.selection = m.id;
    this.renumber();
    this.emit('add');
    return m.id;
  }

  update(id, patch) {
    const m = this.get(id); if (!m) return;
    // 슬라이더 드래그 등 연속 편집은 같은 필드끼리 1스텝으로 병합
    this._snapCoalesced('update:' + id + ':' + Object.keys(patch).sort().join(','));
    Object.assign(m, patch);
    if ('t' in patch) m.t = Math.max(0, m.t);
    this.renumber();
    this.emit('update');
  }
  move(id, nx, t) { this.update(id, { nx, t }); }

  remove(id) {
    this._snap();
    this.marks = this.marks.filter(m => m.id !== id);
    if (this.selection === id) this.selection = null;
    this.renumber();
    this.emit('remove');
  }

  select(id) { this.selection = id; this.emit('select'); }
  setLane(on) { this._snap(); this.laneOn = on; this.emit('lane'); }

  // 순서 채널(order) 번호를 t 순 1-2-3 재부여
  renumber() {
    const ordered = this.marks.filter(m => m.order).sort((a, b) => a.t - b.t);
    ordered.forEach((m, i) => { m.n = (i % 3) + 1; });
  }

  duration() {
    let maxT = 0;
    for (const m of this.marks) maxT = Math.max(maxT, m.t);
    return Math.max(this.base.duration || 0, maxT + 0.5, 1.5);
  }

  // ── 직렬화 → 팩 JSON (엔진 스키마 + MARK 계약/모디파이어 필드) ──
  toPack() {
    const dur = this.duration();
    const out = [];
    if (this.laneOn) out.push({ t: 0, type: 'pathLane', nx: 0, ny: 0, lifetime: dur });
    for (const m of this.marks) {
      const life = RUN.STEP_LIFETIME;
      out.push({
        t: m.t, type: m.surface === 'wall' ? 'targetMark' : 'stepMark',
        foot: m.foot, nx: m.nx, ny: m.ny ?? 0, lifetime: life,
        contract: m.contract, radiusCm: m.radiusCm, holdRing: m.holdRing,
        design: m.design || undefined,   // 비주얼 디자인(_img 런타임 캐시 포함 — 내보내기 시 제거)
      });
      if (m.order) out.push({ t: m.t, type: 'orderPulse', n: m.n ?? 1, nx: m.nx, ny: m.ny ?? 0, lifetime: life });
      if (m.direction && m.direction.type !== 'none')
        out.push({ t: m.t, type: 'directionGuide', nx: m.nx, ny: m.ny ?? 0, angle: m.direction.angle || 0, dirType: m.direction.type, tip: m.direction.tip || 'triangle', lifetime: life });
    }
    out.sort((a, b) => a.t - b.t);
    return { ...this.base, sport: this.sport, duration: dur, hasWall: false, tokens: out, _authored: true };
  }
}
