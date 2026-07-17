// ─────────────────────────────────────────────────────────────
// LookPanel — 룩 네이티브 편집 (에디터 v4 Phase 4)
//
//   fxlab iframe의 본진 승격판: 인스펙터 "선택 없음 = 전역 룩" 자리에
//   실제 컨트롤을 인라인으로. 라이브 3D 장면이 곧 미리보기.
//   상태는 fxlab labSnapshot과 동형 {stops,sat,bg,g,m,p,s}
//   (프리셋·슬라이더 정의는 fxlab.html:159-213과 상호 복제 — 수정 시 양쪽).
//   적용은 main.js applyLabState 하나만 호출 (변환 로직 포크 금지).
//   영속 DOM: el을 1회 만들어 mount/sync — 인스펙터 리렌더에도 포커스 유지.
// ─────────────────────────────────────────────────────────────

export const LOOK_PRESETS = {
  'NEWTON Vivid': { stops: [['#B7231F', 0], ['#FA3030', .3], ['#FE6E3C', .56], ['#FEA35F', .74], ['#FEC389', .86], ['#FFF3DC', 1]] },
  'NEWTON Dawn': { stops: [['#0B0710', 0], ['#6E0E1E', .18], ['#FA3030', .4], ['#FE6E3C', .62], ['#FEC389', .82], ['#D1FEFF', 1]] },
  'NEWTON Heat': { stops: [['#120609', 0], ['#8E1121', .26], ['#FA3030', .5], ['#FE6E3C', .7], ['#FEC389', .88], ['#FFF6E8', 1]] },
  'Silhouette': { stops: [['#141114', 0], ['#41232A', .24], ['#B03A44', .48], ['#FA5A50', .68], ['#FFC9A6', .86], ['#FFFFFF', 1]] },
  'Prism Cool': { stops: [['#04070E', 0], ['#0E2A3E', .3], ['#3E7F96', .55], ['#8FD8DF', .78], ['#D1FEFF', .92], ['#F4FFFF', 1]] },
};

export function defaultLook() {
  return {
    stops: LOOK_PRESETS['NEWTON Vivid'].stops.map(s => [...s]),
    sat: 1.0,
    bg: 'none',
    g: { speed: 1.0, width: 1.0, halo: 0.9, noise: 0.5, ember: 0.3, size: 1.5 },
    m: { radius: 1.0, core: 1.0, halo: 0.9, pool: 0.55, sweep: 1.0, wobble: 0.5 },
    s: { bloomStrength: 0.55, bloomThreshold: 0.55, bloomRadius: 0.6, exposure: 1.0, grain: 0, vignette: 0.12 },
    p: { blur: 1.0, glow: 0.9, flow: 0.55, decay: 0.62 },
  };
}

const SLIDERS = {
  m: [['radius', '존 반경', 0.6, 1.35, 0.05], ['core', '코어 두께', 0.5, 2.2, 0.05], ['halo', '헤일로', 0, 2, 0.05],
      ['pool', '내부 광', 0, 1, 0.05], ['sweep', '색 스윕', 0, 2, 0.05], ['wobble', '일렁임', 0, 1, 0.05]],
  g: [['speed', '속도', 0.4, 1.8, 0.05], ['width', '블러(폭)', 0.4, 2.2, 0.05], ['halo', '글로우', 0, 2, 0.05],
      ['noise', '일렁임', 0, 1, 0.05], ['ember', '잔열', 0, 0.7, 0.05], ['size', '크기(m)', 0.6, 2.6, 0.05]],
  s: [['bloomStrength', '블룸 강도', 0, 1.5, 0.05], ['bloomThreshold', '블룸 문턱', 0, 1, 0.05], ['bloomRadius', '블룸 반경', 0, 1.2, 0.05],
      ['exposure', '노출', 0.6, 1.6, 0.05], ['grain', '그레인', 0, 0.1, 0.005], ['vignette', '비네트', 0, 0.5, 0.02]],
  p: [['blur', '엣지 블러', 0.3, 2.5, 0.05], ['glow', '글로우', 0, 2, 0.05], ['flow', '내부 흐름', 0, 1, 0.05], ['decay', '잔상', 0, 0.92, 0.02]],
};
const GROUP_LABEL = { m: '마크 (존·판정)', g: '그래픽 (터짐·발자국)', s: '화면 룩 (블룸·노출)', p: '인물 (열화상)' };
const BG_DEFS = [['none', '다크'], ['grass', '잔디'], ['track', '트랙'], ['paving', '보도블럭']];

const S = {
  chip: 'padding:4px 9px;border:1px solid var(--line);border-radius:99px;background:none;color:var(--dim);font-size:10.5px;cursor:pointer;',
  row: 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin:3px 0;font-size:11px;color:var(--dim);',
  h: 'font-size:12px;color:var(--text);font-weight:700;margin:0 0 6px;',
};

export class LookPanel {
  /** opts: { getSaved()→labState|null, apply(state), save(state), openLab() } */
  constructor(opts) {
    this.o = opts;
    const saved = opts.getSaved();
    this._virgin = !saved;               // 저장본 없음 = '기본값 따름' — 첫 편집 때만 저장 시작
    this.state = this._merge(saved);
    this._saveTimer = null;
    this.el = document.createElement('div');
    this.el.id = 'look-panel';
    this.el.style.cssText = 'padding:12px 14px;display:flex;flex-direction:column;gap:10px;';
    this._build();
    this.sync(this.state);
  }
  _merge(saved) {
    const d = defaultLook();
    if (!saved) return d;
    return {
      ...d, ...saved,
      stops: (saved.stops || d.stops).map(s => [...s]),
      g: { ...d.g, ...saved.g }, m: { ...d.m, ...saved.m },
      s: { ...d.s, ...saved.s }, p: { ...d.p, ...saved.p },
    };
  }

  _apply() { this.o.apply(this.state); this._drawLut(); }
  _save() {
    this._virgin = false;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.o.save(this.state), 400);
  }
  _edit() { this._apply(); this._save(); }

  _build() {
    const el = this.el;
    // ── 헤딩 ──
    const head = document.createElement('div');
    head.innerHTML = `<div style="${S.h}">🔥 룩 — 지금 이 장면에 실시간</div>
      <div style="font-size:10.5px;color:var(--dim);line-height:1.5;">선택이 없을 땐 장면 전체의 온도 언어를 다듬어요. 모든 조절이 옆 3D에 바로 반영됩니다.</div>`;
    el.appendChild(head);

    // ── 프리셋 ──
    const pr = document.createElement('div');
    pr.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;';
    for (const name of Object.keys(LOOK_PRESETS)) {
      const b = document.createElement('button');
      b.textContent = name.replace('NEWTON ', 'N·');
      b.style.cssText = S.chip;
      b.dataset.preset = name;
      b.addEventListener('click', () => {
        this.state.stops = LOOK_PRESETS[name].stops.map(x => [...x]);
        this._buildStops();
        this._edit();
      });
      pr.appendChild(b);
    }
    el.appendChild(pr);

    // ── LUT 바 + 스탑 에디터 ──
    this.lutBar = document.createElement('canvas');
    this.lutBar.width = 512; this.lutBar.height = 18;
    this.lutBar.style.cssText = 'width:100%;height:14px;border-radius:7px;display:block;';
    el.appendChild(this.lutBar);
    const stopsDet = document.createElement('details');
    stopsDet.innerHTML = `<summary style="font-size:11.5px;color:var(--text);font-weight:600;cursor:pointer;padding:3px 0;">팔레트 스탑 (색·위치)</summary>`;
    this.stopsHost = document.createElement('div');
    this.stopsHost.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    stopsDet.appendChild(this.stopsHost);
    el.appendChild(stopsDet);
    this._buildStops();

    // ── 채도 ──
    el.appendChild(this._slider('채도', 0, 1.6, 0.02,
      () => this.state.sat, v => { this.state.sat = v; }, 'lk-sat'));

    // ── 그룹 슬라이더 ──
    for (const gk of ['m', 'g', 's', 'p']) {
      const det = document.createElement('details');
      det.open = false;
      det.innerHTML = `<summary style="font-size:11.5px;color:var(--text);font-weight:600;cursor:pointer;padding:3px 0;">${GROUP_LABEL[gk]}</summary>`;
      for (const [key, label, min, max, step] of SLIDERS[gk])
        det.appendChild(this._slider(label, min, max, step,
          () => this.state[gk][key], v => { this.state[gk][key] = v; }, `lk-${gk}-${key}`));
      el.appendChild(det);
    }

    // ── 투사면 ──
    const bgWrap = document.createElement('div');
    bgWrap.innerHTML = `<div style="font-size:11.5px;color:var(--text);font-weight:600;margin-bottom:5px;">투사면 (바닥/벽 테마)</div>`;
    const chips = document.createElement('div');
    chips.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;';
    for (const [key, label] of BG_DEFS) {
      const b = document.createElement('button');
      b.textContent = label; b.dataset.bg = key; b.style.cssText = S.chip;
      b.addEventListener('click', () => { this.state.bg = key; this._syncBgChips(); this._edit(); });
      chips.appendChild(b);
    }
    bgWrap.appendChild(chips);
    this.bgChips = chips;
    el.appendChild(bgWrap);

    // ── 실험실 링크 (보조) ──
    const lab = document.createElement('button');
    lab.id = 'lk-openlab';
    lab.textContent = '🔬 실험실 크게 보기 (프리뷰 셀·발형·상태 탐구)';
    lab.style.cssText = 'width:100%;padding:7px 0;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--dim);font-size:11px;cursor:pointer;';
    lab.addEventListener('click', () => this.o.openLab());
    el.appendChild(lab);
  }

  _slider(label, min, max, step, get, set, id) {
    const row = document.createElement('div');
    row.style.cssText = S.row;
    const val = document.createElement('span');
    val.style.cssText = 'min-width:34px;text-align:right;color:var(--text);font-variant-numeric:tabular-nums;';
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.id = id;
    inp.style.cssText = 'flex:1;';
    inp.addEventListener('input', () => { set(+inp.value); val.textContent = (+inp.value).toFixed(2); this._edit(); });
    row.append(Object.assign(document.createElement('span'), { textContent: label }), inp, val);
    row._sync = () => { inp.value = get(); val.textContent = (+get()).toFixed(2); };
    (this._syncers ||= []).push(row._sync);
    return row;
  }

  _buildStops() {
    this.stopsHost.innerHTML = '';
    this.state.stops.forEach((st, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;';
      const col = document.createElement('input');
      col.type = 'color'; col.value = st[0];
      col.style.cssText = 'width:26px;height:20px;border:none;background:none;padding:0;cursor:pointer;';
      col.addEventListener('input', () => { st[0] = col.value; this._edit(); });
      const pos = document.createElement('input');
      pos.type = 'range'; pos.min = 0; pos.max = 1; pos.step = 0.01; pos.value = st[1];
      pos.style.cssText = 'flex:1;';
      pos.addEventListener('input', () => { st[1] = +pos.value; this._edit(); });
      row.append(col, pos);
      this.stopsHost.appendChild(row);
    });
  }

  _drawLut() {
    const cx = this.lutBar.getContext('2d');
    const gr = cx.createLinearGradient(0, 0, this.lutBar.width, 0);
    for (const [c, pos] of [...this.state.stops].sort((a, b) => a[1] - b[1])) gr.addColorStop(Math.max(0, Math.min(1, pos)), c);
    cx.fillStyle = gr;
    cx.fillRect(0, 0, this.lutBar.width, this.lutBar.height);
  }

  _syncBgChips() {
    this.bgChips.querySelectorAll('button').forEach(b => {
      const on = b.dataset.bg === (this.state.bg || 'none');
      b.style.borderColor = on ? '#fec389' : 'var(--line)';
      b.style.color = on ? '#fec389' : 'var(--dim)';
    });
  }

  /** 외부 상태(저장본·fxlab 왕복)를 UI에 반영 — 리렌더 없이 값만 */
  sync(state) {
    if (state) this.state = this._merge(state);
    for (const s of this._syncers || []) s();
    this._buildStops();
    this._syncBgChips();
    this._drawLut();
  }

  /** 인스펙터 호스트에 부착 (영속 DOM — 리스너·포커스 유지) */
  mount(host) { host.appendChild(this.el); }
}
