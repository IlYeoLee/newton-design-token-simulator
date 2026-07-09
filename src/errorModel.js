// ─────────────────────────────────────────────────────────────
// NEWTON 투사 정확도 — 오차예산 모델 (defensible error budget)
//
//   목적: "보정 오차 ±Xcm"를 손으로 넣은 매직상수가 아니라, 확정 하드웨어
//   블록의 스펙에서 *유도*한다. 모든 파라미터는 {value, source, status}를
//   달고, status='assumed'(대표 데이터시트/문헌값) → 확정 스펙 오면 'confirmed'.
//
//   기기 구조(ID 반영): 정강이 외측 커프에 프로젝터 퍽(하향-전방 사출).
//   프로젝터-IMU 동일 강체. 발목 커프에 보조 IMU+ToF. 안정화 = 짐벌(저주파)
//   + OIS(고주파) 2단. ToF로 실제 지면 거리 측정.
//
//   오차 항(독립 가정, RSS 합):
//     E_attitude : 자세 추정·안정화 잔차 × 투사거리   (지향 오차)
//     E_latency  : motion-to-photon 지연 × 사지 각속도 × 투사거리  (위상 의존)
//     E_range    : ToF 측距 오차 → 스케일/키스톤 잔차
//     E_mount    : 커프↔경골 연부조직 회전 (센서-프로젝터는 강체라 제외)
//     E_optical  : 작업거리에서 투사 픽셀 크기 (양자화)
//
//   ⚠️ status:'assumed' 값은 확정 부품 스펙으로 교체 대상. 그 전까지는
//   "대표값 기반 모델"이지 "측정된 정확도"가 아님 — 표기를 지키는 게 방어의 핵심.
// ─────────────────────────────────────────────────────────────

// P(value, unit, source, status) — 프로비넌스 태그된 파라미터
const P = (value, unit, source, status = 'assumed') => ({ value, unit, source, status });

export const PARAMS = {
  // ── 자세 추정 (이중 IMU 정강이+발목 → 운동학 제약 AHRS) ──
  attitudeRmsDeg: P(1.0, 'deg', '대표 MEMS AHRS 동적 자세 RMS (예: ICM-42688급 + 상보/EKF, 이중 IMU 제약). 문헌 0.5~1.5°', 'assumed'),

  // ── 2단 안정화 ──
  gimbalBandwidthHz: P(20, 'Hz', '소형 BLDC 짐벌 대표 대역폭 (10~30Hz)', 'assumed'),
  oisRangeDeg: P(1.5, 'deg', '스마트폰 OIS 대표 보정 각범위 ±1.0~1.5°', 'assumed'),
  oisBandwidthHz: P(100, 'Hz', '스마트폰 OIS 대표 대역폭 (~100Hz+)', 'assumed'),

  // ── 지연 예산 (motion-to-photon, 단계 합) ──
  latencyMs: P(30, 'ms', '센서(1ms)+퓨전(2ms)+명령+짐벌/OIS 응답+프로젝터 프레임의 합. 대표 25~45ms', 'assumed'),
  ffCancelFrac: P(0.67, 'ratio', '측정: 등각속도 예측기 검증(Bandai 런 모캡 FK, 33ms 호라이즌, 스윙 10.9→3.6cm). 보수적 하한 — 고레이트 IMU+학습예측기는 더 높음', 'measured'),

  // ── 거리 측정 (ToF) ──
  tofAccuracyMm: P(10, 'mm', '멀티존 ToF 대표 측距 오차 (예: VL53L5CX급, 근거리 ±(5~15)mm)', 'assumed'),

  // ── 프로젝터 광학 ──
  projResolution: P(854, 'px(가로)', '대표 소형 레이저/LED 프로젝터 가로 해상도', 'assumed'),

  // ── 기하 (ID 렌더에서 추정 — 확정 도면으로 교체) ──
  throwDistanceM: P(0.5, 'm', 'ID 추정: 정강이 중단 퍽 → 지면 발 앞 투사점 사거리', 'assumed'),
  footprintWidthM: P(0.5, 'm', 'ID 추정: 지면 투사 풋프린트 폭', 'assumed'),

  // ── 마운트 (커프↔경골 연부조직) ──
  mountWobbleDeg: P(0.8, 'deg', '가정: 경골능(앞정강이) 참조 밴드의 연부조직 유효 회전. 근복 장착 대비 작음. 실측 필요', 'assumed'),

  // ── 운동학 그라운드트루스 (실측 데이터셋) ──
  omegaStanceDps: P(44, 'deg/s', '측정: Bandai 런 모캡 정강이 FK 각속도 최소(스탠스 부근)', 'measured'),
  omegaSwingDps: P(480, 'deg/s', '측정: Bandai 런 모캡 정강이 FK 각속도 피크(스윙)', 'measured'),
};

const v = k => PARAMS[k].value;
const DEG = Math.PI / 180;

// 지연×각속도 오차: 지연 τ 동안 사지가 ω·τ 만큼 회전 → 지향 어긋남.
// 속도 피드포워드가 ffCancel 만큼 예측 상쇄, 나머지(각가속 2차항)가 잔차.
// 스탠스(ω≈0)엔 무시할 수준, 스윙(ω 큼)엔 지배적 — 위상 의존의 핵심 항.
function latencyError(omegaDps) {
  const dtheta = omegaDps * (v('latencyMs') / 1000);   // deg, 지연 중 회전각
  const residualDeg = dtheta * (1 - v('ffCancelFrac'));
  return Math.tan(residualDeg * DEG) * v('throwDistanceM');   // m
}

// 자세 지향 오차: 자세 추정 RMS는 안정화로도 못 줄임(모르는 걸 못 고침).
function attitudeError() {
  return Math.tan(v('attitudeRmsDeg') * DEG) * v('throwDistanceM');   // m
}

// 거리 오차: ToF 측距 오차 → 하향 사출 입사각에서의 지면 위치 잔차(러프 1:1 근사)
function rangeError() {
  return v('tofAccuracyMm') / 1000;   // m
}

// 마운트: 커프 연부조직 회전 × 사거리
function mountError() {
  return Math.tan(v('mountWobbleDeg') * DEG) * v('throwDistanceM');   // m
}

// 광학: 작업거리에서 픽셀 크기 = 풋프린트폭 / 해상도
function opticalError() {
  return v('footprintWidthM') / v('projResolution');   // m (픽셀 1개 크기)
}

// 위상별 예산 (RSS). phase: 'stance' | 'swing'
export function computeBudget(phase = 'stance') {
  const omega = phase === 'swing' ? v('omegaSwingDps') : v('omegaStanceDps');
  const terms = {
    attitude: attitudeError(),
    latency: latencyError(omega),
    range: rangeError(),
    mount: mountError(),
    optical: opticalError(),
  };
  const totalM = Math.hypot(...Object.values(terms));
  return {
    phase,
    omegaDps: omega,
    termsCm: Object.fromEntries(Object.entries(terms).map(([k, m]) => [k, +(m * 100).toFixed(2)])),
    totalCm: +(totalM * 100).toFixed(2),
  };
}

// 민감도: 한 파라미터를 배수로 흔들 때 total 변화
export function sensitivity(key, factors = [0.5, 1, 2], phase = 'stance') {
  const base = PARAMS[key].value;
  const out = factors.map(f => {
    PARAMS[key].value = base * f;
    return { factor: f, totalCm: computeBudget(phase).totalCm };
  });
  PARAMS[key].value = base;
  return out;
}

// 가정·출처 표 (반박 방패) — 확정 안 된 값이 한눈에 보이게
export function assumptionsTable() {
  return Object.entries(PARAMS).map(([key, p]) => ({
    param: key, value: p.value, unit: p.unit, status: p.status, source: p.source,
  }));
}
