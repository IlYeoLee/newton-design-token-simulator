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
  BK_A1: { title: 'Side Stretch',      phase: 0, sub: '1/3', cue: 'Reach up · stretch side to side' }, // 옆구리 스트레치
  BK_A3: { title: 'Squats',            phase: 0, sub: '2/3', cue: 'Slow down and up' },                // 스쿼트
  // B · 사전 익히기 (DRILL)
  BK_B1: { title: 'Low Dribble',    phase: 0, sub: '3/3', cue: "Stay low — Curry's beat, 10 reps" },  // 로우 드리블
  BK_B2: { title: 'Bend Knees, Fake the Layup', phase: 1, sub: '1/4', cue: 'Sell the drive with eyes and shoulders' },
  BK_B3: { title: 'Right Foot Down, Dribble', phase: 1, sub: '2/4', cue: 'Plant it — push the ball across' },
  BK_B4: { title: 'Left Foot Out, Catch the Ball', phase: 1, sub: '3/4', cue: 'Reach and gather with both hands' },
  BK_B5: { title: 'Right Foot In, Set to Shoot', phase: 1, sub: '4/4', cue: 'Bring it back — rise straight up' },
  // C · 실전 (GAME)
  BK_C1: { title: 'Trigger',          phase: 2, sub: '1/2', cue: '3 · 2 · 1 — go' },
  BK_C2: { title: 'Full Step-Back',   phase: 2, sub: '2/2', cue: 'One take — plant, slide, gather, shoot' },   // 실전 = 정속 연속 1회(유저 개편)
};
