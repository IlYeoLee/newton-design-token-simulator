// 러닝·농구 운동중 지면 화면 데이터 — floor-scene.html에 stage별 주입 (복싱 scenes.js의 지면 버전).
//   phase: 0=워밍업(A) · 1=학습/페이스(B) · 2=실전(C). 하단 스트립에서 현재 phase 볼드 + sub(n/N).
//   title = 짧은 지시 가이드 문구(긴 글 지양 — 상세 가이드는 지면 음성). 실제 A/B/C 동작에 맞춤.
//   중앙은 콘텐츠 영역(발자국·가이드 = WebGL 토큰) — 여기선 안 그림.
window.FLOOR_PHASES = {
  running:    ['WARM UP', 'PACE', 'RUN'],
  basketball: ['WARM UP', 'DRILL', 'GAME'],
};
// cue = 발자국 아래 있던 보조설명을 타이틀 밑으로 올린 짧은 지시(긴 글 지양 — 상세는 지면 음성).
// ★ 타이틀 길이 상한 = 400px @ 52px Bold(-2 트래킹) — 헤더 폭을 고정하되 짧은 이름에
//   허전한 여백이 남지 않는 지점(유저: 고정폭이 미적으로 안 예쁘다, 차라리 타이틀을 줄이자).
//   기존 최장 'Neck & Shoulders' 392px 가 기준이 됐다. 농구 스텝 4개는 한 줄에 지시가 둘이라
//   상한을 넘었는데, **타이틀은 동작의 이름 · 두 번째 지시는 cue** 로 나눠 담는 게 원래 맞다
//   (데이터 모델에 이미 두 필드가 있다). 새 타이틀을 추가할 땐 이 상한을 먼저 확인할 것.
window.FLOOR_SCENES = {
  // ── 러닝 ──
  // A · 준비운동 (WARM UP)
  A1: { title: 'Neck & Shoulders', phase: 0, sub: '1/3', cue: 'Roll big, slow circles' },      // 목·어깨 크게 돌리기
  A2: { title: 'Calf Stretch',     phase: 0, sub: '2/3', cue: 'Bend front knee · back leg straight' }, // 런지 자세 종아리 스트레칭
  A3: { title: 'High Knees',       phase: 0, sub: '3/3', cue: 'Drive knees up · keep the pace' }, // 하이니(제자리 무릎 올리기)
  // B · 페이스 훈련 (TRAINING = 페이스를 끌어올리는 훈련법 4종)
  // 러닝 학습 3종(쓰레숄드 제거·유저). 타이틀은 main.js가 구간명으로 라이브 갱신하지만, 초기값 유지.
  P1: { title: 'Easy Run',   phase: 1, sub: '1/3', cue: 'Relaxed · conversational' },   // 이지 런
  P2: { title: 'Strides',    phase: 1, sub: '2/3', cue: 'Accelerate 10s · ease off' },  // 스트라이드
  P3: { title: 'Intervals',  phase: 1, sub: '3/3', cue: 'Sprint · recover · repeat' },  // 인터벌
  // C · 실전 (RUN)
  C1: { title: 'Get Set',          phase: 2, sub: '1/5', cue: '3 · 2 · 1' },                   // 3·2·1 출발 카운트
  C2: { title: 'Run with Sean',    phase: 2, sub: '2/5', cue: 'Stay beside the light' },       // 나란히 달리기
  C3: { title: 'Back on Pace',     phase: 2, sub: '3/5', cue: 'Find the beat again' },         // 흔들리면 다시 붙기
  C4: { title: 'Final Kilometer',  phase: 2, sub: '4/5', cue: 'Push — last 1 km' },            // 마지막 1km 스퍼트
  C5: { title: 'Cool Down',        phase: 2, sub: '5/5', cue: 'Slow down, breathe' },          // 천천히 멈추기

  // ── 농구 ──
  // A · 준비운동 (WARM UP)
  BK_A1: { title: 'Side Stretch',      phase: 0, sub: '1/3', cue: 'I always start here — open up your sides' }, // 옆구리 스트레치
  BK_A3: { title: 'Squats',            phase: 0, sub: '2/3', cue: 'Slow down, drive up — wake the legs I shoot with' },                // 스쿼트
  // B · 사전 익히기 (DRILL)
  BK_B1: { title: 'Low Dribble',    phase: 0, sub: '3/3', cue: "Stay low — ride my beat, 10 reps" },  // 로우 드리블
  BK_B2: { title: 'Fake the Layup', phase: 1, sub: '1/4', cue: 'Bend your knees — sell it with your eyes and shoulders' },
  BK_B3: { title: 'Right Foot Down', phase: 1, sub: '2/4', cue: 'Plant it out front — push the ball across, left foot holds' },
  BK_B4: { title: 'Left Foot Out', phase: 1, sub: '3/4', cue: 'Push off and slide back — gather with both hands' },
  BK_B5: { title: 'Set to Shoot', phase: 1, sub: '4/4', cue: 'Snap it in and rise straight up — my step-back' },
  // C · 실전 (GAME)
  BK_C1: { title: 'Trigger',          phase: 2, sub: '1/2', cue: '3 · 2 · 1 — let\'s go' },
  BK_C2: { title: 'Full Step-Back',   phase: 2, sub: '2/2', cue: 'Run it with me ×3 — plant, slide, gather, shoot' },   // 실전 = 정속 연속 1회(유저 개편)
};
