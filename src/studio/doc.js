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
    this.load(pack);
  }

  // 팩 → MARK 목록. stepMark/targetMark = MARK 본체, 동일 t 의
  // orderPulse(순서)·directionGuide(방향)는 그 MARK에 부착된 채널로 흡수.
  load(pack) {
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
        };
        this.marks.push(m);
        byKey.set(key, m);
      }
    }
    // 채널 부착 (본체 생성 뒤)
    for (const tk of (pack.tokens || [])) {
      const key = Math.round(tk.t * 1000);
      const m = byKey.get(key);
      if (!m) continue;
      if (tk.type === 'orderPulse') { m.order = true; m.n = tk.n; }
      if (tk.type === 'directionGuide') m.direction = { type: tk.dirType || 'transition', angle: tk.angle || 0 };
    }
    // 러닝 기본: 스텝은 순서 채널을 단다 (케이던스 1-2-3)
    if (this.sport === 'running') for (const m of this.marks) if (m.order === false && m.n == null) m.order = true;
    this.renumber();
    this.emit('load');
  }

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit(reason) { for (const cb of this.listeners) cb(this, reason); }

  get(id) { return this.marks.find(m => m.id === id) || null; }
  selected() { return this.get(this.selection); }

  // ── 저작 연산 ──
  addMark(nx, t, opts = {}) {
    const foot = opts.foot !== undefined ? opts.foot : (nx < 0 ? 'left' : 'right');  // 레인 쪽=발형 스킨
    const m = {
      id: nextId(), surface: 'floor', foot,
      nx, ny: 0, t: Math.max(0, t),
      contract: 'reach', radiusCm: DEFAULT_RADIUS_CM, holdRing: false,
      order: this.sport === 'running', n: null, direction: null,
    };
    this.marks.push(m);
    this.selection = m.id;
    this.renumber();
    this.emit('add');
    return m.id;
  }

  update(id, patch) {
    const m = this.get(id); if (!m) return;
    Object.assign(m, patch);
    if ('t' in patch) m.t = Math.max(0, m.t);
    this.renumber();
    this.emit('update');
  }
  move(id, nx, t) { this.update(id, { nx, t }); }

  remove(id) {
    this.marks = this.marks.filter(m => m.id !== id);
    if (this.selection === id) this.selection = null;
    this.renumber();
    this.emit('remove');
  }

  select(id) { this.selection = id; this.emit('select'); }
  setLane(on) { this.laneOn = on; this.emit('lane'); }

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
      });
      if (m.order) out.push({ t: m.t, type: 'orderPulse', n: m.n ?? 1, nx: m.nx, ny: m.ny ?? 0, lifetime: life });
      if (m.direction && m.direction.type !== 'none')
        out.push({ t: m.t, type: 'directionGuide', nx: m.nx, ny: m.ny ?? 0, angle: m.direction.angle || 0, dirType: m.direction.type, lifetime: life });
    }
    out.sort((a, b) => a.t - b.t);
    return { ...this.base, sport: this.sport, duration: dur, hasWall: false, tokens: out, _authored: true };
  }
}
