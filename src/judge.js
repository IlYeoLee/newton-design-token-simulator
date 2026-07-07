import * as THREE from 'three';

// 판정 루프 (문서 03: Pack과의 차이 값 계산 → Pack 일치도)
// X Bot의 실제 발/주먹 위치를 매 프레임 실측 → 이벤트별 최근접 거리·시점 기록
//   타이밍 오차 = 최근접 시점 − 이벤트 시점
//   위치 오차   = 최근접 거리 (바닥: XZ / 벽면: XY)
// 허용 오차 내 = hit, 한쪽만 = near, 둘 다 밖 = miss

const WINDOW = 0.32;   // 이벤트 전후 판정 관찰 구간 (s)

// 결정적 의사난수 (이벤트×루프 시드) — 같은 실력이면 같은 오차 재현
function seededGauss(seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  // Box-Muller
  const u = Math.max(rnd(), 1e-6), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Judge {
  constructor() {
    this.tolT = 0.12;    // 타이밍 허용 (s)
    this.tolP = 0.15;    // 위치 허용 (m)
    this.skill = 0.7;    // 학습자 실력 0.3~1.0 (1.0 = 완벽한 팔로워)
    this.onVerdict = null;
    this.events = [];
    this.results = [];
    this.marks = [];     // 타임라인 표시용 {t, verdict}
    this.lastReport = null;
    this.loopN = 0;
  }

  setPack(events, sport) {
    this.sport = sport;
    this.events = events;
    this.results = [];
    this.marks = [];
    this.lastReport = null;
    this.loopN = 0;
    for (const ev of this.events) { ev._jBest = null; ev._judged = false; }
  }

  /** 학습자 오차 (이벤트별 결정적): 실력이 낮을수록 σ 증가 */
  _noise(evIdx) {
    const k = 1 - this.skill;             // 0(완벽)~0.7(서투름)
    const seed = (evIdx + 1) * 7919 + this.loopN * 104729;
    return {
      dt: seededGauss(seed) * 0.15 * k,           // 타이밍 σ 최대 150ms
      dx: seededGauss(seed + 1) * 0.12 * k,       // 위치 σ 최대 12cm
      dy: seededGauss(seed + 2) * 0.12 * k,
    };
  }

  /** probes: { footL, footR, wrist } 월드 좌표 */
  update(now, probes) {
    const v = new THREE.Vector3();
    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i];
      if (ev._judged || !ev.marker) continue;
      const dtE = now - ev.t;
      if (dtE < -WINDOW) continue;
      if (dtE <= WINDOW) {
        // 농구: SportVU 원본이 몸 트래킹 → 플랜트 판정도 몸 중심 기준
        const probe = ev.surface === 'wall'
          ? probes.wrist
          : this.sport === 'basketball'
            ? probes.hips
            : (ev.foot === 'left' ? probes.footL : probes.footR);
        if (!probe) continue;
        // 학습자 위치 오차 주입 (판정 프로브 = 실측 본 + 모델 오차)
        const n = this._noise(i);
        const px = probe.x + n.dx;
        const p2 = ev.surface === 'wall' ? probe.y + n.dy : probe.z + n.dy;
        ev.marker.group.getWorldPosition(v);
        const d = ev.surface === 'wall'
          ? Math.hypot(px - v.x, p2 - v.y)
          : Math.hypot(px - v.x, p2 - v.z);
        if (!ev._jBest || d < ev._jBest.d) {
          ev._jBest = { d, t: now, px, p2, surface: ev.surface };
        }
        // 계통 오차 계측용 (노이즈 미포함 원시값, 부호 유지)
        const dRaw = ev.surface === 'wall'
          ? Math.hypot(probe.x - v.x, probe.y - v.y)
          : Math.hypot(probe.x - v.x, probe.z - v.z);
        if (!ev._jRaw || dRaw < ev._jRaw.d) {
          ev._jRaw = {
            d: dRaw, t: now,
            dx: probe.x - v.x,
            dz: ev.surface === 'wall' ? probe.y - v.y : probe.z - v.z,
          };
        }
      } else {
        this._finalize(ev, i);
      }
    }
  }

  _finalize(ev, idx) {
    ev._judged = true;
    if (!ev._jBest) return;
    const n = this._noise(idx ?? 0);
    const terr = (ev._jBest.t - ev.t) + n.dt;   // 학습자 타이밍 오차 주입
    const perr = ev._jBest.d;
    const okT = Math.abs(terr) <= this.tolT;
    const okP = perr <= this.tolP;
    const verdict = okT && okP ? 'hit' : (okT || okP ? 'near' : 'miss');
    this.results.push({ t: ev.t, terr, perr, verdict, surface: ev.surface });
    // 타임라인 마크 (같은 t 기존 항목 교체)
    const mi = this.marks.findIndex(m => m.t === ev.t);
    const mark = { t: ev.t, verdict };
    if (mi >= 0) this.marks[mi] = mark; else this.marks.push(mark);
    if (ev._jRaw) {
      this._calib = this._calib || [];
      this._calib.push({
        f: ev.foot || 'w',
        tms: Math.round((ev._jRaw.t - ev.t) * 1000),
        x: +(ev._jRaw.dx * 100).toFixed(1),
        z: +(ev._jRaw.dz * 100).toFixed(1),
      });
    }
    if (this.onVerdict) this.onVerdict(ev, verdict, ev._jBest);
  }

  /** 루프 종료: 리포트 생성 + 다음 루프 준비 */
  finishLoop() {
    this.events.forEach((ev, i) => { if (!ev._judged && ev.marker) this._finalize(ev, i); });
    this.loopN++;
    if (this._calib?.length) {
      console.log('[CALIB]', this.sport, JSON.stringify(this._calib));
      this._calib = [];
    }
    for (const ev of this.events) ev._jRaw = null;
    const R = this.results;
    if (R.length) {
      const hits = R.filter(r => r.verdict === 'hit').length;
      const worst = R.reduce((w, r) => (r.perr > (w?.perr ?? -1) ? r : w), null);
      this.lastReport = {
        n: R.length,
        hits,
        matchPct: Math.round((hits / R.length) * 100),
        avgTms: (R.reduce((s, r) => s + Math.abs(r.terr), 0) / R.length) * 1000,
        avgPcm: (R.reduce((s, r) => s + r.perr, 0) / R.length) * 100,
        worst,
      };
    }
    this.results = [];
    for (const ev of this.events) { ev._jBest = null; ev._judged = false; }
    return this.lastReport;
  }
}
