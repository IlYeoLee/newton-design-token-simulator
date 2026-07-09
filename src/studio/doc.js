// ─────────────────────────────────────────────────────────────
// NEWTON Studio — 편집 문서 모델 (Document)
//   팩 JSON을 편집 가능한 단일 소스로 승격. 토큰마다 안정 id,
//   CRUD, 변경 이벤트, ↔ 팩 직렬화. 에디터가 mutate → 3D가 rebuild.
//
//   Week 1: 러닝 지면 수직 슬라이스.
//   러닝 advance 매핑에서 ny는 미사용 — 지면 깊이는 t로 결정된다.
//     world.x = nx · X_SCALE            (레인 가로 오프셋)
//     world.z = -(V·t + STRIKE_AHEAD)   (전방 깊이 = 시간)
//   따라서 2D 저작 캔버스의 세로축 = 깊이(=시간), 가로축 = 레인.
// ─────────────────────────────────────────────────────────────

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

let _uid = 1;
const nextId = () => `t${_uid++}`;

export class StudioDoc {
  constructor(pack) {
    this.listeners = new Set();
    this.selection = null;   // 선택된 gid
    this.load(pack);
  }

  // 팩 → 편집 토큰(안정 id + 그룹). 스텝(stepMark)+비트(orderPulse)는
  // 동일 t 를 공유하므로 tkey 로 묶어 하나의 저작 단위(gid)로 취급.
  load(pack) {
    this.base = { ...pack };            // sport/duration/hasWall 등 메타 보존
    this.sport = pack.sport;
    this.tokens = [];
    this.laneOn = false;
    for (const tk of (pack.tokens || [])) {
      if (tk.type === 'pathLane') { this.laneOn = true; continue; }
      const gid = 'g' + Math.round(tk.t * 1000);
      this.tokens.push({ ...tk, _id: nextId(), gid });
    }
    this.renumber();
    this.emit('load');
  }

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit(reason) { for (const cb of this.listeners) cb(this, reason); }

  // ── 조회 ──
  groups() {
    // gid → { gid, t, nx, foot, n } (스텝 단위 저작 뷰)
    const map = new Map();
    for (const tk of this.tokens) {
      let g = map.get(tk.gid);
      if (!g) { g = { gid: tk.gid, t: tk.t, nx: tk.nx, foot: null, n: null }; map.set(tk.gid, g); }
      if (tk.type === 'stepMark') { g.foot = tk.foot; g.t = tk.t; g.nx = tk.nx; }
      if (tk.type === 'orderPulse') g.n = tk.n;
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }
  group(gid) { return this.groups().find(g => g.gid === gid) || null; }

  // ── 저작 연산 ──
  addStep(foot, nx, t) {
    const gid = 'g' + nextId();
    this.tokens.push({ _id: nextId(), gid, type: 'stepMark', foot, nx, ny: 0, t, lifetime: RUN.STEP_LIFETIME });
    this.tokens.push({ _id: nextId(), gid, type: 'orderPulse', n: 0, nx, ny: 0, t, lifetime: RUN.STEP_LIFETIME });
    this.renumber();
    this.selection = gid;
    this.emit('add');
    return gid;
  }

  moveGroup(gid, nx, t) {
    t = Math.max(0, t);
    for (const tk of this.tokens) {
      if (tk.gid !== gid) continue;
      tk.nx = nx; tk.t = t;
    }
    this.renumber();
    this.emit('move');
  }

  setFoot(gid, foot) {
    for (const tk of this.tokens) if (tk.gid === gid && tk.type === 'stepMark') tk.foot = foot;
    this.emit('foot');
  }

  remove(gid) {
    this.tokens = this.tokens.filter(tk => tk.gid !== gid);
    if (this.selection === gid) this.selection = null;
    this.renumber();
    this.emit('remove');
  }

  select(gid) { this.selection = gid; this.emit('select'); }

  setLane(on) { this.laneOn = on; this.emit('lane'); }

  // 비트 번호(orderPulse.n)를 t 순서로 1-2-3-1-2-3 재부여 (원본 케이던스 문법)
  renumber() {
    const gids = this.groups().map(g => g.gid);
    const order = new Map(gids.map((gid, i) => [gid, (i % 3) + 1]));
    for (const tk of this.tokens) {
      if (tk.type === 'orderPulse') tk.n = order.get(tk.gid) ?? 1;
    }
  }

  duration() {
    let maxT = 0;
    for (const tk of this.tokens) maxT = Math.max(maxT, tk.t);
    return Math.max(this.base.duration || 0, maxT + 0.5, 1.5);
  }

  // ── 직렬화 → 팩 JSON (엔진이 소비하는 스키마) ──
  toPack() {
    const dur = this.duration();
    const out = [];
    if (this.laneOn) out.push({ t: 0, type: 'pathLane', nx: 0, ny: 0, lifetime: dur });
    for (const tk of this.tokens) {
      const { _id, gid, ...clean } = tk;
      out.push(clean);
    }
    out.sort((a, b) => a.t - b.t);
    return {
      ...this.base,
      sport: this.sport,
      duration: dur,
      hasWall: false,
      tokens: out,
      _authored: true,
    };
  }
}
