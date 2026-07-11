// 좌측 패널: 팩 탭 / 원본 정보 / 타임라인 / 토큰 슬라이더 / 범례
import { LAYOUT } from './tokens.js';

// 팩 시그니처 — 토큰 데이터에서 계산한 수치 요약 (팩 간 차이를 언어로 보여줌).
// 도메인 하드코딩 없음: stepMark의 t·nx에서 유도 (advance=레인 폭, spatial=이동 범위).
function packSignature(packData) {
  const L = LAYOUT[packData.sport] || {};
  // 벽 타겟 팩(복싱류): 펀치 수·리듬·타겟 높이 범위
  const targets = (packData.tokens || []).filter(t => t.type === 'targetMark');
  if (targets.length >= 3 && L.WALL) {
    const ts = targets.map(t => t.t).sort((a, b) => a - b);
    const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter(g => g > 0.05).sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    const hs = targets.map(t => L.WALL.Y0 + t.ny * L.WALL.YS);
    return [`타겟 ${targets.length}개`,
            med ? `간격 ${med.toFixed(2)}s` : '',
            `높이 ${(Math.min(...hs) * 100).toFixed(0)}~${(Math.max(...hs) * 100).toFixed(0)}cm`]
      .filter(Boolean).join(' · ');
  }
  const marks = (packData.tokens || []).filter(t => t.type === 'stepMark' && t.foot);
  if (marks.length < 2) return '';
  const ts = marks.map(m => m.t).sort((a, b) => a - b);
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter(g => g > 0.05);
  const med = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const parts = [`마크 ${marks.length}개`];
  if (med) parts.push(`스텝 간격 ${med.toFixed(2)}s (${Math.round(60 / med)}spm)`);
  const xs = f => marks.filter(m => m.foot === f).map(m => m.nx);
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const lp = xs('left'), rp = xs('right');
  if (L.X_SCALE && lp.length && rp.length) {
    parts.push(`좌우 폭 ${Math.abs((avg(rp) - avg(lp)) * L.X_SCALE * 100).toFixed(0)}cm`);
  } else if (L.SCALE) {
    const nx = marks.map(m => m.nx), ny = marks.map(m => m.ny);
    parts.push(`이동 범위 ${((Math.max(...nx) - Math.min(...nx)) * L.SCALE * 100).toFixed(0)}×${((Math.max(...ny) - Math.min(...ny)) * L.SCALE * 100).toFixed(0)}cm`);
  }
  return parts.join(' · ');
}

const TYPE_COLORS = {
  stepMark: '#4fc3f7',
  orderPulse: '#ffffff',
  directionGuide: '#b388ff',
  targetMark: '#ff5c8a',
  pathLane: '#2a86b8',
};

const LEGEND = {
  running: [
    ['#4fc3f7', '왼발 착지 마크 + 카운트다운 링'],
    ['#ffb74d', '오른발 착지 마크 + 카운트다운 링'],
    ['#ffffff', '순서 숫자 (orderPulse)'],
    ['#2a86b8', '트레드밀 레인 (pathLane)'],
  ],
  boxing: [
    ['#ff5c8a', '벽면 펀치 타겟 (targetMark)'],
    ['#4fc3f7', '스탠스 발판 — 왼발'],
    ['#ffb74d', '스탠스 발판 — 오른발'],
    ['#b388ff', '방향 가이드 화살표'],
  ],
  basketball: [
    ['#4fc3f7', '플랜트 풋 마크 — 왼발'],
    ['#ffb74d', '플랜트 풋 마크 — 오른발'],
    ['#b388ff', '컷인 방향 화살표'],
    ['#2a86b8', '이동 경로 점선 (pathLane)'],
  ],
};

export class Panel {
  constructor(callbacks) {
    this.cb = callbacks;
    this.duration = 1;
    this.events = [];
    this.tlCanvas = document.getElementById('timeline');
    this.tlCtx = this.tlCanvas.getContext('2d');

    // 팩 탭 — data-pack 있는 버튼만 (⭐커리 등 변형 토글은 main.js가 직접 처리)
    document.querySelectorAll('#pack-tabs button[data-pack]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#pack-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        callbacks.onPack(btn.dataset.pack);
      });
    });

    // 슬라이더
    const bind = (id, vid, fmt, fn) => {
      const el = document.getElementById(id);
      const val = document.getElementById(vid);
      const apply = () => { val.textContent = fmt(el.value); fn(Number(el.value)); };
      el.addEventListener('input', apply);
      apply();
    };
    bind('s-lead', 'v-lead', v => `${v}ms`, v => callbacks.onLead(v / 1000));
    bind('s-size', 'v-size', v => `${(v / 100).toFixed(2)}×`, v => callbacks.onSize(v / 100));
    bind('s-count', 'v-count', v => `${v}개`, v => callbacks.onCount(v));
    bind('s-speed', 'v-speed', v => `${(v / 100).toFixed(2)}×`, v => callbacks.onSpeed(v / 100));

    // 재생/일시정지
    this.playBtn = document.getElementById('btn-play');
    this.playBtn.addEventListener('click', () => callbacks.onTogglePlay());

    // 타임라인 클릭 시크
    this.tlCanvas.addEventListener('click', e => {
      const r = this.tlCanvas.getBoundingClientRect();
      const k = (e.clientX - r.left) / r.width;
      callbacks.onSeek(k * this.duration);
    });

    this.clockEl = document.getElementById('clock');
    this.hudEl = document.getElementById('hud');
    this.flashEl = document.getElementById('event-flash');
    this._flashTimer = null;
  }

  setPack(packData, tokenEvents) {
    this.duration = packData.duration;
    this.events = tokenEvents;

    const s = packData.source || {};
    const sig = packSignature(packData);
    document.getElementById('source-info').innerHTML = `
      <b>${packData.packName ?? packData.sport}</b>
      ${s.name ?? ''}<br>
      ${s.dataType ?? ''}<br>
      상태: <span style="color:#69f0ae">${packData.dataStatus}</span> · ${s.licenseNote ?? ''}
      ${sig ? `<br>시그니처: <span style="color:#fec389">${sig}</span>` : ''}
    `;

    document.getElementById('token-legend').innerHTML =
      (LEGEND[packData.sport] || [])
        .map(([c, t]) => `<div><span class="chip" style="background:${c}"></span>${t}</div>`)
        .join('');

    this.hudEl.innerHTML = `
      <b>${packData.packName}</b><br>
      데이터: ${s.name ?? '—'}<br>
      <span id="geom-info" style="color:#4fc3f7;font-variant-numeric:tabular-nums;"></span>
    `;
  }

  setPlaying(playing) {
    this.playBtn.textContent = playing ? '⏸ 일시정지' : '▶ 재생';
  }

  flash(text) {
    this.flashEl.textContent = text;
    this.flashEl.style.opacity = '1';
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => { this.flashEl.style.opacity = '0'; }, 450);
  }

  drawTimeline(now, judgeMarks) {
    const ctx = this.tlCtx;
    const W = this.tlCanvas.width, H = this.tlCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // 판정 누적 점 (hit 초록 / near 앰버 / miss 레드) — 구간별 약점 시각화
    if (judgeMarks) {
      const VC = { hit: '#69f0ae', near: '#ffc94d', miss: '#ff5c6c' };
      for (const m of judgeMarks) {
        ctx.fillStyle = VC[m.verdict] || '#888';
        ctx.beginPath();
        ctx.arc((m.t / this.duration) * W, H - 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 이벤트 마커
    for (const ev of this.events) {
      const x = (ev.t / this.duration) * W;
      const color = ev.surface === 'wall' ? TYPE_COLORS.targetMark
        : ev.foot === 'right' ? '#ffb74d'
        : ev.foot === 'left' ? '#4fc3f7' : TYPE_COLORS.directionGuide;
      ctx.fillStyle = color;
      const hit = now >= ev.t && now < ev.t + 0.35;
      ctx.globalAlpha = hit ? 1 : 0.65;
      const h = hit ? 26 : 18;
      ctx.fillRect(x - 1.5, H / 2 - h / 2, 3, h);
    }
    ctx.globalAlpha = 1;

    // 플레이헤드
    const px = (now / this.duration) * W;
    ctx.fillStyle = '#e8eaf0';
    ctx.fillRect(px - 0.75, 4, 1.5, H - 8);

    this.clockEl.textContent = `${now.toFixed(2)} / ${this.duration.toFixed(2)}s`;
  }
}
