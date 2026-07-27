import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// 절차적 준비운동 드릴 — mixamorig 스켈레톤에 관절 회전 클립을 저작한다.
//   목적: 세션 A(준비운동) 단계에서 봇이 "발목 돌리기/종아리 스트레치/다리 스윙/
//   제자리 걷기" 같은 실제 그 동작을 수행하게 (기존엔 전부 warmup 루프였음).
//   중립 서있는 포즈(warmup 프레임0에서 캡처)를 base로, 드릴별 지정 본만 흔든다.
//   축 규약(브라우저 실측 프로빙): UpLeg 로컬 X+ = 고관절 굴곡(무릎을 앞으로 든다).
// ─────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const rot = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG);
const TWO_PI = Math.PI * 2;

// 씬 가이드 리듬(session.js SCFG)과 반드시 일치 — 코치 동작 1회 = 씬 링/카운트 1회.
// 클립 duration = 1회 주기로 만들고(LoopRepeat), playDemo가 session.t에 위상 잠금 → 완전 동기.
const A1_PERIOD = 2.0;   // = SCFG.a1Rep (발목 한 바퀴 2s)
const A2_PERIOD = 1.6;   // = 씬 A2 BT (까치발 1회 1.6s)
const A3_PERIOD = 1.8;   // = SCFG.a3Swing (다리 한 왕복 1.8s)

// 드릴 스펙 → AnimationClip. drive(name,t01) → 로컬 delta 쿼터니언(없으면 null=중립 유지)
function makeClip(id, neutral, duration, drive, fps = 30) {
  const frames = Math.max(2, Math.round(duration * fps));
  const names = Object.keys(neutral);
  const times = new Array(frames + 1);
  const buf = {}; for (const n of names) buf[n] = new Array((frames + 1) * 4);
  const q = new THREE.Quaternion();
  for (let f = 0; f <= frames; f++) {
    const t = f / frames;
    times[f] = t * duration;
    for (const n of names) {
      const base = neutral[n];
      const d = drive(n, t);
      if (d) q.copy(base).multiply(d); else q.copy(base);
      const o = f * 4;
      buf[n][o] = q.x; buf[n][o + 1] = q.y; buf[n][o + 2] = q.z; buf[n][o + 3] = q.w;
    }
  }
  const tracks = names.map(n => new THREE.QuaternionKeyframeTrack(n + '.quaternion', times, buf[n]));
  return new THREE.AnimationClip('drill_' + id, duration, tracks);
}

const R = {
  hipL: 'mixamorigLeftUpLeg', kneeL: 'mixamorigLeftLeg', footL: 'mixamorigLeftFoot',
  hipR: 'mixamorigRightUpLeg', kneeR: 'mixamorigRightLeg', footR: 'mixamorigRightFoot',
  spine: 'mixamorigSpine', spine1: 'mixamorigSpine1', neck: 'mixamorigNeck', head: 'mixamorigHead',
  armL: 'mixamorigLeftArm', foreL: 'mixamorigLeftForeArm',
  shL: 'mixamorigLeftShoulder', shR: 'mixamorigRightShoulder',
  armR: 'mixamorigRightArm', foreR: 'mixamorigRightForeArm',
};

// ── 러닝 준비운동 (A1~A4) ──
function runningDrills(neutral) {
  return {
    // A1 '발자국 눌러보기' — 앞발을 앞 마크에 올리고(리치·접지), 몸무게를 실어 마크를 지그시 눌러 내림(프레스 딥).
    //   그 누름(press)으로 hold 링이 차오른다. 앞발은 마크에 계속 접지(공중부양 없음) — 누름=몸이 앞발/마크로 내려앉음.
    //   각도는 공중부양 실측 보정 노브 — footL_y≈0(접지) 유지되게 브라우저 검증하며 튜닝.
    run_press: makeClip('run_press', neutral, 3.6, (n, t) => {
      const h = t < 0.3 ? t / 0.3 : (t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1);         // 리치(앞발 마크로 접지)
      const press = (t > 0.35 && t < 0.85) ? Math.sin((t - 0.35) / 0.5 * Math.PI) : 0;   // 지그시 눌러 내림(0→1→0)
      if (n === R.kneeR) return rot(X, -(52 * h + 14 * press));   // 축무릎 굴곡 + 프레스 딥(몸무게 내려 누름)
      if (n === R.hipR)  return rot(X, 24 * h + 6 * press);       // 뒷다리
      if (n === R.footR) return rot(X, 18 * h);                   // 뒷발 토우 접지
      if (n === R.hipL)  return rot(X, 28 * h + 4 * press);       // 앞다리(마크로)
      if (n === R.kneeL) return rot(X, 12 * h - 8 * press);       // 프레스 시 앞무릎 굽혀 무게 실어 누름
      if (n === R.footL) return rot(X, -16 * h);                  // 앞발 뒤꿈치↓ 마크 접지
      if (n === R.spine) return rot(X, 8 * h + 10 * press);       // 상체 앞·아래(누르는 무게중심)
      if (n === R.armL)  return rot(X, 30 * h);
      return null;
    }),
    // A2 교대 런지 프레스 — 오른발·왼발 각 1회씩 천천히 앞으로 딛고 꾹 눌러 내림(유저 확정).
    //   run_press의 '지그시 눌러 내림' 문법을 좌우 교대(8s=우4s+좌4s)로 확장.
    //   손 = 합장(가슴 앞 모음) 고정 — CMU 클립의 '얼굴막기' 팔 제거 사유(유저).
    lunge_press: makeClip('lunge_press', neutral, 8.0, (n, t) => {
      const p1 = t < 0.5, u = (p1 ? t : t - 0.5) * 2;                                   // 앞발: 1막=왼발, 2막=오른발
      const h = u < 0.22 ? u / 0.22 : (u < 0.88 ? 1 : (1 - u) / 0.12);                  // 내딛기 램프
      const press = (u > 0.3 && u < 0.82) ? Math.sin((u - 0.3) / 0.52 * Math.PI) : 0;   // 천천히 꾹(0→1→0)
      const F = p1;                                                                      // F=왼발 앞
      // 손 = 중립(자연스럽게 늘어뜨림) — 절차 합장이 계속 어색(유저 2회 지적) → 팔 미구동.
      // 미구동 본은 중립 서있기 포즈 유지 + playDemo 호흡 레이어가 미세 생동감을 준다.
      // 보폭 넓게 + 앞무릎 깊은 굴곡(정면 가독) — 유저 확정. 뒷다리는 뒤로 뻗기(신전).
      if (n === (F ? R.hipL : R.hipR))   return rot(X, 44 * h + 6 * press);   // 앞다리 크게 내딛기
      if (n === (F ? R.kneeL : R.kneeR)) return rot(X, -(14 * h + 30 * press)); // 앞무릎 굽혀 깊이 누름
      if (n === (F ? R.footL : R.footR)) return rot(X, -20 * h);              // 앞발 뒤꿈치↓ 접지
      if (n === (F ? R.hipR : R.hipL))   return rot(X, -(10 * h) + 4 * press); // 뒷다리 뒤로 뻗음(신전)
      if (n === (F ? R.kneeR : R.kneeL)) return rot(X, -(26 * h + 14 * press)); // 뒷무릎은 완만히
      if (n === (F ? R.footR : R.footL)) return rot(X, 26 * h);               // 뒷발 토우
      if (n === R.spine) return rot(X, 5 * h + 7 * press);                    // 상체는 곧게, 무게만 아래로
      return null;
    }),
    // 싱글레그 쿼드 스트레치 — 오른발 접지, 왼무릎 완전 굴곡(발뒤꿈치↑ 엉덩이로), 왼손이 뒤로 발목 잡기, 홀드.
    //   Sketchfab 'Single-Leg Quad Stretch' 스캔 레퍼런스 → 정지 홀드 포즈라 절차적이 적합(한 발 접지=공중부양 없음).
    //   각도는 브라우저 검증 노브(손-발 근접·균형).
    run_quad: makeClip('run_quad', neutral, 3.2, (n, t) => {
      const h = t < 0.3 ? t / 0.3 : (t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1);
      if (n === R.kneeL) return rot(X, -125 * h);   // 왼무릎 완전 굴곡(뒤꿈치↑)
      if (n === R.hipL)  return rot(X, -6 * h);      // 왼허벅지 거의 수직(살짝 뒤)
      if (n === R.footL) return rot(X, 18 * h);      // 발끝
      if (n === R.armL)  return rot(X, -28 * h);     // 왼팔 뒤로(발목 잡으러)
      if (n === R.foreL) return rot(X, -75 * h);     // 팔꿈치 굽혀 손이 뒤 발로
      if (n === R.armR)  return rot(X, 14 * h);       // 오른팔 균형
      if (n === R.spine) return rot(X, -3 * h);       // 상체 곧게(살짝 신전)
      return null;
    }),
    // A2 까치발(힐레이즈) — 뒤꿈치를 올렸다 바닥까지 1회(클립=1주기, 씬 BT와 동기). 음성과 동작 일치.
    //   두 발목 플랜타플렉션 → _clampFeet가 몸을 토우 위로 들어올림(까치발). 무릎/힙은 곧게 유지.
    run_calf: makeClip('run_calf', neutral, A2_PERIOD, (n, t) => {
      const lift = 0.5 - 0.5 * Math.cos(t * TWO_PI);   // 0→1→0 : 올렸다 내림 1회
      const ang = 36 * lift;
      if (n === R.footL || n === R.footR) return rot(X, ang);   // 플랜타플렉션(뒤꿈치↑) — 부호 브라우저 검증
      if (n === R.spine) return rot(X, 2 * lift);
      return null;
    }),
    // A3 다리 스윙 — 오른다리 앞뒤 진자 1왕복(클립=1주기, 씬 스윙과 동기)
    run_swing: makeClip('run_swing', neutral, A3_PERIOD, (n, t) => {
      const a = Math.sin(t * TWO_PI);   // 한 클립 = 한 왕복(앞뒤)
      if (n === R.hipR) return rot(X, 40 * a);
      if (n === R.kneeR) return rot(X, -14 * Math.max(0, a));
      if (n === R.spine) return rot(X, 4);
      return null;
    }),
    // 하이니 — 좌우 교대로 무릎을 골반 높이까지 빠르게 (러닝 워밍업: 고관절·코어 활성·심박↑, 스트라이드 무릎드라이브 리허설).
    //   접지: 한 발 딛고 반대 무릎 UP(교대). 팔은 러닝 암(팔꿈치 90°) 카운터 스윙. 클립=2사이클(빠름).
    run_highknees: makeClip('run_highknees', neutral, 2.0, (n, t) => {
      const s = Math.sin(t * 2 * TWO_PI);
      const upR = Math.max(0, s), upL = Math.max(0, -s);
      if (n === R.hipR)  return rot(X, 82 * upR);    // 무릎을 골반 높이까지
      if (n === R.kneeR) return rot(X, -72 * upR);
      if (n === R.hipL)  return rot(X, 82 * upL);
      if (n === R.kneeL) return rot(X, -72 * upL);
      if (n === R.armR)  return rot(X, 34 * -s);     // 러닝 암 카운터 스윙
      if (n === R.armL)  return rot(X, 34 * s);
      if (n === R.foreR) return rot(X, -55);         // 팔꿈치 ~90°
      if (n === R.foreL) return rot(X, -55);
      if (n === R.spine) return rot(X, 4);
      return null;
    }),
    // 버트킥 — 좌우 교대로 뒤꿈치를 엉덩이로 차올림 (햄스트링·후면사슬 워밍업, 빠른 발회전).
    //   접지: 딛는 발 그대로, 반대 무릎 완전 굴곡(뒤꿈치↑). 허벅지는 거의 수직(살짝 신전). 팔 카운터.
    run_buttkicks: makeClip('run_buttkicks', neutral, 1.8, (n, t) => {
      const s = Math.sin(t * 2 * TWO_PI);
      const kR = Math.max(0, s), kL = Math.max(0, -s);
      if (n === R.kneeR) return rot(X, -125 * kR);   // 뒤꿈치 엉덩이로
      if (n === R.hipR)  return rot(X, -8 * kR);      // 허벅지 약간 뒤(신전)
      if (n === R.kneeL) return rot(X, -125 * kL);
      if (n === R.hipL)  return rot(X, -8 * kL);
      if (n === R.armR)  return rot(X, 30 * -s);
      if (n === R.armL)  return rot(X, 30 * s);
      if (n === R.foreR) return rot(X, -50);
      if (n === R.foreL) return rot(X, -50);
      if (n === R.spine) return rot(X, 3);
      return null;
    }),
    // A4 박자 걷기 — 좌우 교대 무릎 들기 (제자리 마칭), 팔 카운터 스윙
    run_march: makeClip('run_march', neutral, 3.2, (n, t) => {
      const s = Math.sin(t * 4 * TWO_PI);
      const upR = Math.max(0, s), upL = Math.max(0, -s);
      if (n === R.hipR) return rot(X, 42 * upR);
      if (n === R.kneeR) return rot(X, -52 * upR);
      if (n === R.hipL) return rot(X, 42 * upL);
      if (n === R.kneeL) return rot(X, -52 * upL);
      if (n === R.armR) return rot(X, 16 * -s);
      if (n === R.armL) return rot(X, 16 * s);
      return null;
    }),
  };
}

// ── 복싱 준비운동 (BX_A1~A3) — 섀도복싱 ──
function boxingDrills(neutral) {
  return {
    // 목·어깨 풀기 — 목을 크게 완전한 원으로 돌리기 + 양 어깨 원 돌리기(롤)
    //  목: X=끄덕(아래/뒤), Z=옆기울임 을 90° 위상차로 → 아래→옆→뒤→옆 원.
    //  어깨: 상완(Arm)을 원뿔로 굴려 어깨 롤 표현(팔은 아래로). 좌우 대칭(Z 부호 반전).
    bx_neck: makeClip('bx_neck', neutral, 5.0, (n, t) => {
      const nph = t * 2 * TWO_PI;   // 목 원 2바퀴
      const sph = t * 3 * TWO_PI;   // 어깨 롤 3바퀴(경쾌)
      // 진폭 강화(유저: '더 적극적인 모션') — 목 28°/머리 11° 원, 어깨 롤 22°/18°
      if (n === R.neck) return rot(X, 28 * Math.cos(nph)).multiply(rot(Z, 28 * Math.sin(nph)));
      if (n === R.head) return rot(X, 11 * Math.cos(nph)).multiply(rot(Z, 11 * Math.sin(nph)));
      if (n === R.spine1) return rot(Z, 8 * Math.sin(nph));
      if (n === R.armR) return rot(X, 22 * Math.cos(sph)).multiply(rot(Z, -18 * Math.sin(sph)));
      if (n === R.armL) return rot(X, 22 * Math.cos(sph)).multiply(rot(Z, 18 * Math.sin(sph)));
      return null;
    }),
    // 목→어깨 순차 풀기 (러닝 A1 전용, 유저 지정: '목을 먼저 크게 돌리고 → 그 다음 어깨')
    //  1막(0~4s): 목 크게 원 2바퀴(팔 중립) → 2막(4~8s): 어깨 롤 3바퀴(목 중립).
    //  막 경계 점프 방지: 각 막 양끝 10% 램프 엔벨로프로 진폭 0→1→0.
    neckShoulder: makeClip('neckShoulder', neutral, 8.0, (n, t) => {
      const p1 = t < 0.5, u = (p1 ? t : t - 0.5) * 2;
      const env = u < 0.1 ? u / 0.1 : (u > 0.9 ? (1 - u) / 0.1 : 1);
      if (p1) {
        const nph = u * 2 * TWO_PI;
        if (n === R.neck) return rot(X, 30 * env * Math.cos(nph)).multiply(rot(Z, 30 * env * Math.sin(nph)));
        if (n === R.head) return rot(X, 12 * env * Math.cos(nph)).multiply(rot(Z, 12 * env * Math.sin(nph)));
      } else {
        // 어깨 '돌리기' = 쇄골 원운동(올림→뒤→내림→앞)이 주(진짜 어깨 롤), 상완은 소폭 수동 추종
        const sph = u * 3 * TWO_PI;
        if (n === R.shR) return rot(Z, -12 * env * Math.cos(sph)).multiply(rot(X, 10 * env * Math.sin(sph)));
        if (n === R.shL) return rot(Z, 12 * env * Math.cos(sph)).multiply(rot(X, 10 * env * Math.sin(sph)));
        if (n === R.armR) return rot(X, 12 * env * Math.cos(sph)).multiply(rot(Z, -8 * env * Math.sin(sph)));
        if (n === R.armL) return rot(X, 12 * env * Math.cos(sph)).multiply(rot(Z, 8 * env * Math.sin(sph)));
        if (n === R.spine1) return rot(Z, 6 * env * Math.sin(sph * 2 / 3));
      }
      return null;
    }),
    // 무릎 올리며 몸통 비틀기 (러닝 A3, 유저 이미지 147) — 한쪽 무릎을 골반 높이로 올리며
    //  상체를 반대로 비틀어 반대쪽 팔꿈치를 무릎 쪽으로. 연속 교대(sin, 데드포인트 없음 = 매끄러움).
    kneeTwist: makeClip('kneeTwist', neutral, 2.4, (n, t) => {
      // 한 클립 = 좌우 1왕복. sin 연속 → 한 무릎 내려올 때 다른 무릎 올라감(마칭, 중간 멈춤 없음 — 유저 '덜 부드러움' 해소)
      const s = Math.sin(t * TWO_PI);                     // -1(왼무릎)…+1(오른무릎)
      const upR = Math.max(0, s), upL = Math.max(0, -s);  // 무릎 올림(연속)
      // 퀸틱(smootherstep) 이즈 — 가감속 양끝이 더 완만(유저: 움직임 더 부드럽게)
      const q = u => u * u * u * (u * (u * 6 - 15) + 10);
      const eR = q(upR), eL = q(upL);
      if (n === R.hipR)  return rot(X, 96 * eR);
      if (n === R.kneeR) return rot(X, -88 * eR);
      if (n === R.hipL)  return rot(X, 96 * eL);
      if (n === R.kneeL) return rot(X, -88 * eL);
      if (n === R.spine)  return rot(Y, -6 * s);           // 비틀기 최소(직립)
      if (n === R.spine1) return rot(Y, -3 * s);
      // 팔 위상 좌우 스왑 — 화면상 같은발-같은손으로 보이던 것(유저): 반대팔이 무릎과 교차
      if (n === R.armL)  return rot(X, 44 * eL).multiply(rot(Z, -22 * eL)).multiply(rot(Z, 30 * eR));
      if (n === R.foreL) return rot(X, -60 * eL);
      if (n === R.armR)  return rot(X, 44 * eR).multiply(rot(Z, 22 * eR)).multiply(rot(Z, -30 * eL));
      if (n === R.foreR) return rot(X, -60 * eR);
      return null;
    }),
    // 스텝 인·아웃 — 상체 앞뒤 무게 이동 + 살짝 바운스
    bx_stepio: makeClip('bx_stepio', neutral, 3.0, (n, t) => {
      const s = Math.sin(t * 3 * TWO_PI);
      const bob = Math.abs(Math.sin(t * 6 * TWO_PI)) * 4;
      if (n === R.spine) return rot(X, 6 * s);
      if (n === R.hipR) return rot(X, 8 + bob);
      if (n === R.hipL) return rot(X, 8 + bob);
      if (n === R.kneeR) return rot(X, -12 - bob);
      if (n === R.kneeL) return rot(X, -12 - bob);
      return null;
    }),
    // 잽 폼(BX_A3)은 실측 펀치 모캡(hook)으로 매핑 — 팔 절차 저작은 축 불확실로 보류
  };
}

// ── 농구 준비운동 (BK_A1 스탠스) — 사이드풋워크/드리블은 기존 클립 사용 ──
function basketballDrills(neutral) {
  return {
    // 크로스오버 드릴(B2) — 제자리·무릎 굽힘·와이드 스탠스에서 양손 교차 드리블.
    //   CMU 재고 전수 스캔 결과 '제자리 크로스오버'는 없음(06_12 이동·06_13 프리스타일·06_14 전환 0회)
    //   → 절차 저작(유저 결정). 사이클 1.6s = 0.4s/바운스(커리 150BPM 실측), 반사이클마다 손 교대.
    //   공(v5)은 낮은 손을 추적하므로 팔 스윙이 곧 공 궤적 — 별도 동기 불필요.
    //   축: hip X+=굴곡·Z±=벌림(L+/R−) · Leg X−=무릎 · Arm Z+=하전방(L, R은 미러) — 전부 실측 캘리브레이션.
    bk_crossover: makeClip('bk_crossover', neutral, 1.6, (n, t) => {
      const dribL = t >= 0.5;                    // 전반=오른손, 후반=왼손
      const u = (t * 2) % 1;                     // 반사이클 위상
      const pump = Math.sin(u * TWO_PI * 2);     // 0.4s당 1펌프(손목 상하)
      const crossK = u > 0.76 ? (u - 0.76) / 0.24 : 0;
      const cs = Math.sin(crossK * Math.PI * 0.5);   // 반말미: 안쪽 크로스 스윕(다음 반사이클이 받음)
      // 하체 — 고정 크라우치 + 와이드 (bk_stance 계보, 바운스 없음: 하체 고정이 드릴 핵심)
      if (n === R.hipL) return rot(X, 30).multiply(rot(Z, 11));
      if (n === R.hipR) return rot(X, 30).multiply(rot(Z, -11));
      if (n === R.kneeL || n === R.kneeR) return rot(X, -46);
      if (n === R.footL || n === R.footR) return rot(X, 17);
      if (n === R.spine) return rot(X, 15).multiply(rot(Z, (dribL ? -4 : 4)));
      // 팔 — 드리블 손: 하전방 + 펌프 + 반말미 안쪽 스윕 / 반대 손: 가드(앞-아래)
      if (n === R.armL) {
        if (dribL) return rot(Z, 50 + 13 * pump).multiply(rot(X, 34 * cs));
        return rot(Z, 34).multiply(rot(X, 24));
      }
      if (n === R.foreL) return rot(X, dribL ? 16 : 30);
      if (n === R.armR) {
        if (!dribL) return rot(Z, -50 - 13 * pump).multiply(rot(X, -34 * cs));
        return rot(Z, -34).multiply(rot(X, -24));
      }
      if (n === R.foreR) return rot(X, !dribL ? 16 : 30);
      return null;
    }),
    // 스탠스·무릎 — 애슬레틱 스탠스(양 무릎 굽힘) + 미세 바운스
    bk_stance: makeClip('bk_stance', neutral, 3.0, (n, t) => {
      const bob = (Math.sin(t * 3 * TWO_PI) + 1) / 2 * 6;
      if (n === R.hipR) return rot(X, 20 + bob);
      if (n === R.hipL) return rot(X, 20 + bob);
      if (n === R.kneeR) return rot(X, -34 - bob);
      if (n === R.kneeL) return rot(X, -34 - bob);
      if (n === R.spine) return rot(X, 14);
      return null;
    }),
  };
}

// 스켈레톤 중립 포즈(서있는 자세) → 준비운동 드릴 클립 맵
export function buildDrillClips(neutral) {
  return { ...runningDrills(neutral), ...boxingDrills(neutral), ...basketballDrills(neutral) };
}
