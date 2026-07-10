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
  leverRatio: P(1.8, 'ratio', 'ID 추정: 무릎 퍽의 몸 기준 횡편차 → 지면 투사점 편차 증폭비(사거리/무릎높이 기하). 유도값 아님 — 확정 도면으로 교체', 'assumed'),

  // ── 짐벌 조향 한계 (포화하면 바닥 조준을 잃고 투사가 붕괴) ──
  gimbalSteerRangeDeg: P(81.4, 'deg', 'ID 추정: 정강이 하향축 기준 짐벌 조향 각범위. 초과 시(킥·큰 스윙) 바닥 조준 상실. 확정 짐벌 스펙으로 교체', 'assumed'),
  gimbalBreakGain: P(3.5, 'ratio', '포화 후 투사점이 정강이 수평방향으로 붕괴하는 속도(시각화 게인). 유도값 아님', 'assumed'),

  // ── 마운트 (커프↔경골 연부조직) ──
  mountWobbleDeg: P(0.8, 'deg', '가정: 경골능(앞정강이) 참조 밴드의 연부조직 유효 회전. 근복 장착 대비 작음. 실측 필요', 'assumed'),

  // ── 운동학 그라운드트루스 (실측 데이터셋) ──
  omegaStanceDps: P(44, 'deg/s', '측정: Bandai 런 모캡 정강이 FK 각속도 최소(스탠스 부근)', 'measured'),
  omegaSwingDps: P(480, 'deg/s', '측정: Bandai 런 모캡 정강이 FK 각속도 피크(스윙)', 'measured'),
  // 물리 상한 — 오차항이 아니라 신호 유효성 게이트. 이보다 큰 순간 변화는
  // 사람의 움직임일 수 없으므로 클립 랩/전환에 의한 포즈 불연속으로 본다.
  omegaMaxDps: P(1500, 'deg/s', '문헌: 스프린트 정강이 각속도 상한 대표값(~1200~1500°/s). 초과 = 모션 아님', 'assumed'),
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

// 위상 경계 = 실측 스탠스·스윙 각속도의 기하평균. 임의로 고른 임계값이 아니라
// 측정된 두 극값 사이의 로그중점 — 위상은 '선언'이 아니라 ω의 결과다.
export const PHASE_BOUNDARY_DPS = Math.sqrt(v('omegaStanceDps') * v('omegaSwingDps'));
export const phaseFor = omegaDps => (omegaDps >= PHASE_BOUNDARY_DPS ? 'swing' : 'stance');

// 실측 ω로 계산하는 연속 예산 (RSS). 위상은 라벨일 뿐 입력이 아니다.
export function budgetFromOmega(omegaDps) {
  const terms = {
    attitude: attitudeError(),
    latency: latencyError(omegaDps),
    range: rangeError(),
    mount: mountError(),
    optical: opticalError(),
  };
  const totalM = Math.hypot(...Object.values(terms));
  return {
    phase: phaseFor(omegaDps),
    omegaDps: +omegaDps.toFixed(1),
    termsM: terms,
    termsCm: Object.fromEntries(Object.entries(terms).map(([k, m]) => [k, +(m * 100).toFixed(2)])),
    totalCm: +(totalM * 100).toFixed(2),
  };
}

// 위상별 예산 — 실측 각속도 극값을 budgetFromOmega에 먹인 특수 케이스
export function computeBudget(phase = 'stance') {
  return budgetFromOmega(phase === 'swing' ? v('omegaSwingDps') : v('omegaStanceDps'));
}

// ── 런타임(projector.js) 소비 훅 — 매직상수를 대체한다 ──
// 지연 잔차 크기(m). 방향은 호출부가 실제 무릎 편차에서 가져온다.
export const latencyErrorM = omegaDps => latencyError(omegaDps);
// 서보 랙 중 속도 피드포워드가 지우지 못한 나머지 비율 (구 FEEDFWD_LAG)
export const residualFrac = () => 1 - v('ffCancelFrac');
// 저주파 wander σ: 자세 추정 잔차 + 커프 연부조직 (보행 주파수대, 바이어스성)
export const slowSigmaM = () => Math.hypot(attitudeError(), mountError());
// 고주파 σ: 투사 픽셀 양자화
export const fastSigmaM = () => opticalError();
export const leverRatio = () => v('leverRatio');
// 신호 유효성 게이트: 이 값을 넘는 순간 ω는 포즈 불연속(클립 랩/전환)이지 운동이 아니다
export const omegaMaxDps = () => v('omegaMaxDps');
// 짐벌 포화 문턱: 정강이 하향 성분(-shin.y)이 이 값 밑이면 바닥 조준 상실
export const gimbalMinDown = () => Math.cos(v('gimbalSteerRangeDeg') * DEG);
export const gimbalBreakGain = () => v('gimbalBreakGain');

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
