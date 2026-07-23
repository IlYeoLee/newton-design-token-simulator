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
      if (n === R.neck) return rot(X, 20 * Math.cos(nph)).multiply(rot(Z, 20 * Math.sin(nph)));
      if (n === R.head) return rot(X, 8 * Math.cos(nph)).multiply(rot(Z, 8 * Math.sin(nph)));
      if (n === R.spine1) return rot(Z, 6 * Math.sin(nph));
      if (n === R.armR) return rot(X, 13 * Math.cos(sph)).multiply(rot(Z, -11 * Math.sin(sph)));
      if (n === R.armL) return rot(X, 13 * Math.cos(sph)).multiply(rot(Z, 11 * Math.sin(sph)));
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
