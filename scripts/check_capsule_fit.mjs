// 캡슐 모프 중 타이틀이 알약 밖으로 나가지 않는가 — 순수 산술 회귀 검사.
//
//   증상(유저 스샷 2026-08-06): 러닝 A2 '종아리 늘리기'가 프리뷰 원형 캡슐 → 가로 알약으로
//   바뀌는 도중 'LEFT CALF STRETCH' 가 알약 오른쪽으로 300px 가까이 삐져나왔다.
//   원인: 알약 폭과 타이포가 같은 진행값(mo)을 썼다. 폭은 900→1379 로 천천히 벌어지는데
//   타이포는 이미 최종 크기(98)·최종 좌표(링 옆 슬롯)에 가 있었다.
//   해법: 기하는 앞당긴 진행(moG), 타이포는 늦춘 진행(moT) — 컨테이너가 내용보다 먼저 자리를 만든다.
//
//   실행: node scripts/check_capsule_fit.mjs   (통과 exit 0)
//
// ponytail: floorgl._paint_capsule 의 식을 여기 옮겨 적었다(중복 = 드리프트 위험).
//   글자폭은 최종 98px 기준 실측치를 넣고 폰트 크기에 선형 비례한다고 본다 — letterSpacing
//   보정을 무시하므로 약간 보수적(=실제보다 조금 넓게 잡힘)이다. 렌더 계측이 필요해지면
//   scripts/check_scene_stage.mjs 처럼 puppeteer 로 옮긴다.

const CX = 800, PAD = 64, RR = 130, GAP_T = 56, TITLE_FS = 98, PREV_FS = 124;
const eOut = t => 1 - Math.pow(1 - t, 3);
const clamp01 = v => Math.max(0, Math.min(1, v));

// 98px 기준 타이틀 실폭 — 짧은 것부터 최악(농구 긴 이름)까지.
const TITLES = [
  ['CALF STRETCH', 660],
  ['LEFT CALF STRETCH', 935],
  ['RIGHT CALF STRETCH', 980],
  ['NECK & SHOULDERS', 739],
  ['FAKE THE LAYUP', 690],
];

const eQ = u => 1 - Math.pow(1 - clamp01(u), 4);

const fails = [];
for (const [name, tw98] of TITLES) {
  const WHp = Math.max(720, PAD + RR * 2 + GAP_T + tw98 + PAD);   // 헤더 목표폭
  // 프리뷰 폭 기준(고정 900)으로 1줄/2줄이 갈린다 — 이 판정은 모프 중에 바뀌면 안 된다.
  const oneLine = tw98 * (PREV_FS / TITLE_FS) <= 900 - PAD * 2;
  let worst = -1e9, worstAt = 0;
  for (let i = 0; i <= 200; i++) {
    const moU = i / 200;
    const moG = eOut(clamp01(moU / 0.55));          // 기하 — 앞당김
    const moT = eOut(clamp01((moU - 0.22) / 0.78)); // 타이포 — 늦춤

    const w = 900 + (WHp - 900) * moG, x = CX - w / 2;
    const rx = CX + (x + PAD + RR - CX) * moG;
    const dstX = rx + RR + GAP_T;
    const lim = x + w - PAD;                         // 알약 안쪽 오른쪽 끝

    let x0, tw;
    if (oneLine) {
      // 한 물체가 그대로 이동 — 크기·좌표를 moT 로 보간
      const fs = PREV_FS + (TITLE_FS - PREV_FS) * moT;
      tw = tw98 * (fs / TITLE_FS);
      x0 = (CX - tw / 2) + (dstX - (CX - tw / 2)) * moT;
    } else {
      // 2줄 → 1줄 크로스페이드. 삐져나온 건 **들어오는 한 줄**(최종 98px, 좌측정렬)이다.
      const inA = eQ((moT - 0.46) / 0.54);
      if (inA <= 0) continue;
      tw = tw98; x0 = dstX;
    }
    // fitDraw 와 같은 규칙 — 먼저 밀고, 그래도 넘치면 줄인다.
    const xa = Math.max(x + PAD, Math.min(x0, lim - tw));
    const k = Math.min(1, (lim - xa) / Math.max(1, tw));
    const over = xa + tw * k - lim;
    // 클램프가 얼마나 개입했는지도 본다 — 상시 개입하면 이징 순서가 잘못된 것이다.
    if (x0 - xa > 1 && moU > 0.6) fails.push(`${name}: mo=${moU.toFixed(2)} 에서도 클램프가 민다(${(x0 - xa).toFixed(0)}px) — 이징 순서 재검토`);
    if (k < 0.999) fails.push(`${name}: mo=${moU.toFixed(2)} 에서 글자 축소(k=${k.toFixed(3)}) — 알약 안쪽 폭 부족`);
    if (over > worst) { worst = over; worstAt = moU; }
  }
  const ok = worst <= 0;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(20)} ${oneLine ? '1줄' : '2줄→1줄'} 여유 ${(-worst).toFixed(0)}px (최악 mo=${worstAt.toFixed(2)})`);
  if (!ok) fails.push(`${name}: mo=${worstAt.toFixed(2)} 에서 ${worst.toFixed(0)}px 초과`);
}

// 음성 대조군 — 기하와 타이포가 **같은 진행값**을 쓰던 옛 식은 반드시 삐져나와야 한다.
//   이게 통과해 버리면 위 검사가 무의미해진 것이다(임계값이 헐거워졌거나 식이 어긋났다).
{
  const tw98 = 935, WHp = PAD + RR * 2 + GAP_T + tw98 + PAD;   // 'LEFT CALF STRETCH'
  let worst = -1e9;
  for (let i = 0; i <= 200; i++) {
    const mo = eOut(i / 200);
    const w = 900 + (WHp - 900) * mo, x = CX - w / 2;
    const dstX = CX + (x + PAD + RR - CX) * mo + RR + GAP_T;
    const inA = eQ((mo - 0.46) / 0.54);
    if (inA <= 0) continue;
    worst = Math.max(worst, dstX - (dstX - CX) * 0.18 * (1 - inA) + tw98 - (x + w - PAD));
  }
  if (worst < 100) fails.push(`음성 대조군이 안 터진다(최대 ${worst.toFixed(0)}px) — 검사가 무의미해졌다`);
  else console.log(`  (대조군: 옛 식은 ${worst.toFixed(0)}px 삐져나옴 — 유저 스샷과 일치)`);
}

if (fails.length) { console.error('\n실패:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\n통과 — 모프 전 구간에서 타이틀이 알약 안에 있다.');
