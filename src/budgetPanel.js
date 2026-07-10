// ─────────────────────────────────────────────────────────────
// 🛡 오차예산 패널 — "임의 고정값 아니냐"에 대한 방패
//
//   숫자 자체를 방어하지 않는다. 무엇이 측정값이고 무엇이 가정인지,
//   각 값이 어디서 왔는지를 드러내는 것이 방어다. assumed 항목을 숨기면
//   그 순간 이 패널은 마케팅 자료가 된다.
// ─────────────────────────────────────────────────────────────
import { computeBudget, assumptionsTable, PHASE_BOUNDARY_DPS, PARAMS } from './errorModel.js';

const TERM_KO = {
  attitude: '자세 추정 잔차',
  latency: '지연 × 각속도',
  range: 'ToF 측距',
  mount: '커프 연부조직',
  optical: '광학 양자화',
};

const STATUS = {
  measured: { ko: '측정', color: '#69f0ae', bg: 'rgba(105,240,174,.12)' },
  assumed: { ko: '가정', color: '#fec389', bg: 'rgba(254,195,137,.12)' },
  confirmed: { ko: '확정', color: '#d1feff', bg: 'rgba(209,254,255,.12)' },
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 항 하나를 막대 + 수치로 */
function termRow(key, cm, maxCm) {
  const w = Math.max(1, (cm / maxCm) * 100);
  const hot = key === 'latency' && cm > 2;
  return `
    <div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:11px;">
      <span style="width:96px;color:var(--dim);flex:none;">${TERM_KO[key] || key}</span>
      <span style="flex:1;height:7px;background:var(--panel2);border-radius:4px;overflow:hidden;">
        <span style="display:block;height:100%;width:${w}%;background:${hot ? 'var(--accent)' : '#4fc3f7'};"></span>
      </span>
      <b style="width:46px;text-align:right;flex:none;font-variant-numeric:tabular-nums;color:${hot ? 'var(--accent)' : 'var(--text)'};">${cm.toFixed(2)}</b>
    </div>`;
}

function budgetBlock(phase, label, note) {
  const b = computeBudget(phase);
  const maxCm = Math.max(...Object.values(b.termsCm));
  const rows = Object.entries(b.termsCm).map(([k, cm]) => termRow(k, cm, maxCm)).join('');
  return `
    <div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--panel2);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <b style="font-size:12px;">${label} <span style="color:var(--dim);font-weight:400;">ω=${b.omegaDps}°/s</span></b>
        <span style="font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;color:${b.totalCm > 3 ? 'var(--accent)' : 'var(--ok)'};">${b.totalCm.toFixed(2)}<span style="font-size:11px;font-weight:400;">cm</span></span>
      </div>
      ${rows}
      <p style="font-size:10.5px;color:var(--dim);line-height:1.55;margin:7px 0 0;">${note}</p>
    </div>`;
}

function assumptionRows() {
  return assumptionsTable()
    .slice()
    .sort((a, b) => (a.status === 'measured' ? -1 : 1) - (b.status === 'measured' ? -1 : 1))
    .map(p => {
      const s = STATUS[p.status] || STATUS.assumed;
      return `
      <tr style="border-top:1px solid var(--line);">
        <td style="padding:6px 6px 6px 0;vertical-align:top;">
          <code style="font-size:10.5px;color:var(--text);">${esc(p.param)}</code>
        </td>
        <td style="padding:6px;vertical-align:top;white-space:nowrap;font-variant-numeric:tabular-nums;">
          <b>${esc(p.value)}</b> <span style="color:var(--dim);font-size:10px;">${esc(p.unit)}</span>
        </td>
        <td style="padding:6px;vertical-align:top;">
          <span style="padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;color:${s.color};background:${s.bg};">${s.ko}</span>
        </td>
        <td style="padding:6px 0 6px 6px;color:var(--dim);font-size:10.5px;line-height:1.5;">${esc(p.source)}</td>
      </tr>`;
    }).join('');
}

export function initBudgetPanel() {
  const btn = document.getElementById('btn-budget');
  if (!btn) return null;

  const tbl = assumptionsTable();
  const nMeasured = tbl.filter(p => p.status === 'measured').length;
  const nAssumed = tbl.filter(p => p.status === 'assumed').length;

  const el = document.createElement('div');
  el.id = 'budget-panel';
  el.style.cssText = `position:fixed;inset:0;z-index:60;display:none;
    background:rgba(6,8,11,.72);backdrop-filter:blur(3px);`;
  el.innerHTML = `
    <div style="position:absolute;top:0;right:0;bottom:0;width:min(560px,94vw);overflow-y:auto;
                background:var(--panel);border-left:1px solid var(--line);padding:16px 18px 40px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <b style="font-size:14px;">🛡 투사 정확도 — 오차예산</b>
        <button id="budget-close" style="border:none;background:none;color:var(--dim);font-size:17px;cursor:pointer;">✕</button>
      </div>
      <p style="font-size:11px;color:var(--dim);line-height:1.6;margin:0 0 12px;">
        아래 수치는 하드웨어 블록 스펙에서 <b style="color:var(--text)">유도</b>한 예측입니다.
        시뮬레이터가 그려 보이는 흔들림도 이 모델에서 나옵니다(매직상수 없음).
      </p>

      <div style="border:1px solid rgba(254,195,137,.35);background:rgba(254,195,137,.08);
                  border-radius:8px;padding:10px 12px;margin-bottom:14px;">
        <b style="font-size:11.5px;color:#fec389;">⚠️ 이것은 측정된 정확도가 아닙니다</b>
        <p style="font-size:10.5px;color:var(--dim);line-height:1.6;margin:5px 0 0;">
          파라미터 ${tbl.length}개 중 <b style="color:#69f0ae;">${nMeasured}개만 측정값</b>,
          <b style="color:#fec389;">${nAssumed}개는 대표 데이터시트·문헌 기반 가정</b>입니다.
          확정 부품 스펙이 들어오면 <code>PARAMS</code>의 값과 status를 교체하세요.
          그 전까지 이 모델은 <b style="color:var(--text)">"대표값 기반 예측"</b>이지
          <b style="color:var(--text)">"실측 정확도"</b>가 아닙니다.
        </p>
      </div>

      <h3 style="font-size:12px;margin:0 0 8px;color:var(--text);">위상별 예산 (독립 가정, RSS 합)</h3>
      ${budgetBlock('stance', '착지 (스탠스)', '정강이가 거의 정지 → 각속도가 0에 수렴하므로 <b style="color:var(--text)">지연항이 죽는다</b>. 세션 UI를 착지 위상에 동기시키는 이유가 이것이다.')}
      ${budgetBlock('swing', '스윙', '다리가 빠르게 회전 → 지연항이 지배적. <b style="color:var(--text)">이 위상은 게이트하지 않고 정직하게 크게 둔다.</b> 감추면 방어가 무너진다.')}

      <div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:14px;">
        <b style="font-size:11.5px;">핵심 방어 논리</b>
        <p style="font-size:10.5px;color:var(--dim);line-height:1.65;margin:5px 0 0;">
          ① 지연 오차 = 지연 × 각속도. 착지에서 ω≈0이면 이 항은 스스로 사라진다 —
          보정이 잘나서가 아니라 <b style="color:var(--text)">물리가 그렇다</b>.<br>
          ② 속도 피드포워드 상쇄율 <code>ffCancelFrac=${PARAMS.ffCancelFrac.value}</code>은
          가정이 아니라 <b style="color:#69f0ae;">실측 러닝 모캡(BVH) FK로 검증</b>했다
          (스윙 지연오차 10.9 → 3.6cm). 보수적 하한값이다.<br>
          ③ 위상 경계 <code>${PHASE_BOUNDARY_DPS.toFixed(1)}°/s</code>도 임의 임계값이 아니라
          측정된 스탠스·스윙 각속도의 기하평균이다.
        </p>
      </div>

      <h3 style="font-size:12px;margin:0 0 2px;color:var(--text);">가정과 출처 (전체 ${tbl.length}개)</h3>
      <p style="font-size:10.5px;color:var(--dim);margin:0 0 8px;">반박당했을 때 꺼낼 표. 숨기지 않는 것이 요점.</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="color:var(--dim);font-size:10px;text-align:left;">
            <th style="padding:0 6px 5px 0;font-weight:600;">파라미터</th>
            <th style="padding:0 6px 5px;font-weight:600;">값</th>
            <th style="padding:0 6px 5px;font-weight:600;">상태</th>
            <th style="padding:0 0 5px 6px;font-weight:600;">출처</th>
          </tr>
        </thead>
        <tbody>${assumptionRows()}</tbody>
      </table>
    </div>`;
  document.body.appendChild(el);

  const close = () => { el.style.display = 'none'; };
  btn.addEventListener('click', () => { el.style.display = 'block'; });
  el.querySelector('#budget-close').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });

  return { open: () => { el.style.display = 'block'; }, close };
}
