// 러닝·농구 운동중 지면 화면 데이터 — floor-scene.html에 stage별 주입 (복싱 scenes.js의 지면 버전).
//   phase: 0=워밍업(A) · 1=학습/페이스(B) · 2=실전(C). 하단 스트립에서 현재 phase 볼드 + sub(n/N).
//   title = 짧은 지시 가이드 문구(긴 글 지양 — 상세 가이드는 지면 음성). 실제 A/B/C 동작에 맞춤.
//   중앙은 콘텐츠 영역(발자국·가이드 = WebGL 토큰) — 여기선 안 그림.
window.FLOOR_PHASES = {
  running:    ['WARM UP', 'PACE', 'RUN'],
  basketball: ['WARM UP', 'DRILL', 'GAME'],
};
// cue = 발자국 아래 있던 보조설명을 타이틀 밑으로 올린 짧은 지시(긴 글 지양 — 상세는 지면 음성).
window.FLOOR_SCENES = {
  // ── 러닝 ──
  // A · 준비운동 (WARM UP)
  A1: { title: 'Full-Body Warm-Up', phase: 0, sub: '1/3', cue: 'Roll head · shoulders · arms · legs' },   // 동적 전신 풀기 (CMU 42_01 실측)
  A2: { title: 'Jumping Jacks',    phase: 0, sub: '2/3', cue: 'Arms up, feet wide · 10x' },   // 점핑잭 (심박 활성)
  A3: { title: 'Leg Swings',       phase: 0, sub: '3/3', cue: 'Swing front to back · 10x' },   // 다리 앞뒤로 흔들기
  // B · 페이스 잡기 (PACE = 러닝의 학습 구간)
  P1: { title: 'Catch the Pace',   phase: 1, sub: '1/2', cue: 'Ease into a light jog' },       // 페이서 붙어 가볍게 뛰기
  P2: { title: 'Lock the Pace',    phase: 1, sub: '2/2', cue: 'Match the pacer’s rhythm' },    // 페이스 잠금
  // C · 실전 (RUN)
  C1: { title: 'Get Set',          phase: 2, sub: '1/5', cue: '3 · 2 · 1' },                   // 3·2·1 출발 카운트
  C2: { title: 'Run with Sean',    phase: 2, sub: '2/5', cue: 'Stay beside the light' },       // 나란히 달리기
  C3: { title: 'Back on Pace',     phase: 2, sub: '3/5', cue: 'Find the beat again' },         // 흔들리면 다시 붙기
  C4: { title: 'Final Kilometer',  phase: 2, sub: '4/5', cue: 'Push — last 1 km' },            // 마지막 1km 스퍼트
  C5: { title: 'Cool Down',        phase: 2, sub: '5/5', cue: 'Slow down, breathe' },          // 천천히 멈추기

  // ── 농구 ──
  // A · 준비운동 (WARM UP)
  BK_A1: { title: 'Stance & Knees',    phase: 0, sub: '1/3', cue: 'Shoulder-width, soft knees' }, // 스탠스·무릎
  BK_A2: { title: 'Side Footwork',     phase: 0, sub: '2/3', cue: 'Side steps, stay wide' },      // 사이드 풋워크
  BK_A3: { title: 'Rhythm Dribble',    phase: 0, sub: '3/3', cue: 'Dribble the rhythm' },         // 리듬 드리블
  // B · 사전 익히기 (DRILL)
  BK_B1: { title: 'Read the Step-Back', phase: 1, sub: '1/3', cue: 'Watch the step-back path' },  // 스텝백 궤적 보기
  BK_B2: { title: 'Step Through',       phase: 1, sub: '2/3', cue: 'Step through in order' },     // 스텝 분해 밟기
  BK_B3: { title: 'Plant & Brake',      phase: 1, sub: '3/3', cue: 'Plant hard, decelerate' },    // 컷 방향·감속
  // C · 실전 (GAME)
  BK_C1: { title: 'Trigger',            phase: 2, sub: '1/4', cue: '3 · 2 · 1 — cut' },           // 3·2·1 컷 트리거
  BK_C2: { title: 'Drive the Cut',      phase: 2, sub: '2/4', cue: 'Drive into the defender' },   // 컷인 라이브
  BK_C3: { title: 'Step Back',          phase: 2, sub: '3/4', cue: 'Step back, make space' },     // 스텝백 라이브
  BK_C4: { title: 'Release',            phase: 2, sub: '4/4', cue: 'Balance, then release' },     // 릴리즈·정지
};
