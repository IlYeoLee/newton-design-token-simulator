// 지면 정면 UI 일괄 추출 — 한 번 걸어두고 손 떼는 용도. (복싱 씬용 run_boxing_scenes.mjs 의 지면판)
//
//   무엇을 뽑나: 투사 UI 를 **대지 원본 2D 캔버스에서 정면 그대로** 뽑는다(export_ui.mjs).
//   3D 씬을 안 거치므로 앨리어싱·검은 띠·프레임 드롭이 원천적으로 없다. 에펙에서 코너핀으로
//   투사면에 맞추고 Screen 으로 얹는다(투사는 가산광).
//
//   ★ --scene(씬 스테이지) 경로와 **다른 물건**이다. 저쪽은 1인칭 실사 합성용이라
//     public/_presets.json 을 읽지만, 이 정면 UI 경로는 프리셋을 안 쓴다 — 대지 캔버스가
//     카메라를 안 타기 때문이다. 그래서 여기 세팅은 전부 아래 표에 있다.
//
//   ★ 반드시 익스포트 전용 서버(5200)에 붙일 것. 개발 서버(5199)에 붙이면 누가 소스를
//     한 번만 저장해도 렌더가 통째로 죽는다(vite always-full-reload).
//       npm run dev:export
//   ★ 렌더가 도는 동안 리포에 아무것도 쓰지 말 것 — 같은 이유로 죽는다.
//
//   사용:
//     npm run export:ui                          # 핵심 6화면, 대지 원본(1600)
//     node scripts/run_floor_ui.mjs --w 4602     # 4K 합성용(대지 ×2.88)
//     node scripts/run_floor_ui.mjs --only P1
//     node scripts/run_floor_ui.mjs --pack bk    # 농구만  (run | bk)

import { spawn, execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = arg('w', '1600');            // 대지 원본. 비율(1600×2670)은 익스포터가 지킨다
const FPS = arg('fps', '30');
const OUT = arg('out', 'out/UI');
const URL = arg('url', 'http://127.0.0.1:5200/');
const ONLY = arg('only', '');
const PACK = arg('pack', '');

// ── 스테이지 길이는 **지어내지 않는다.** export_ui.mjs:140 이 앱에 넘기는 스테이지 dur 이
//    max(8, pvOf(id)) 이고, 그게 곧 그 화면의 한 바퀴다. 같은 식을 여기서도 쓴다.
//      pvOf = (STEP_SEG[id] / stepRate + stepHold) × stepLoops   (스텝백 계열만 해당)
//    ※ STEP_SEG 는 export_ui.mjs 가 session.js 에서 베껴 둔 사본이다(그 파일 주석이 밝혀 둠).
//      여기서 또 베끼면 사본이 셋이 된다 — 그래서 값은 export_ui 에 맡기고, 이 러너는
//      **같은 식을 쓴다는 사실만** 기록한다. dur 을 안 넘기면 익스포터 기본 8초가 온다.
const STEP_SEG = { BK_B2: 0.60, BK_B3: 1.44, BK_B4: 1.81, BK_B5: 3.10, BK_C2: 3.10 };
const stepLoops = id => (id === 'BK_C2' ? 1 : 2);
const pvOf = id => (STEP_SEG[id] ? (STEP_SEG[id] / 0.5 + 1.0) * stepLoops(id) : 0);
const durOf = id => Math.max(8, pvOf(id));

// ── 핵심 화면 = scenes.html 이 관리하는 지면 씬 그대로(복싱 BX_* 는 벽이라 제외).
//    시작화면 8초 루프는 floorgl.js:2359 _paint_ready 규약이고, 위 durOf 가 그 값을 준다.
const STAGES = [
  { id: 'READY',    pack: 'run', title: '시작 — Pace Strategy' },
  { id: 'A2',       pack: 'run', title: '준비운동 2/3 — 종아리 늘리기' },
  // --live : 판이 읽는 SPM 을 프레임마다 주입한다. 안 넣으면 '--' 로 그려진다(세션을 안 돌리므로).
  { id: 'P1',       pack: 'run', title: '러닝 P1 — SPM 실시간', live: true },
  { id: 'BK_READY', pack: 'bk',  title: '시작 — Step Back' },
  { id: 'BK_B1',    pack: 'bk',  title: '준비운동 3/3 — 제자리 드리블' },
  // ★ BK_B5 → BK_B4: 농구 개편으로 BK_B5 는 세션 STAGES 에서 빠졌다(죽은 스테이지 — 뽑으면
  //   알약에 'BK_B5' 라고 id 가 찍힌다). 스텝백 마지막 조각은 BK_B4(Gather and Rise) 다.
  //   ※ 스테이지 목록이 이 파일까지 **넷째 사본**이다 — check_floor_bands 규칙⑦이 이제 여기도 본다.
  { id: 'BK_B4',    pack: 'bk',  title: '스텝백 3/3 — 모아서 올라가기' },
  { id: 'BK_T1',    pack: 'bk',  title: '전체 재생 — The Whole Move' },
].filter(s => (!ONLY || s.id === ONLY) && (!PACK || s.pack === PACK));

const run = (s) => new Promise((res) => {
  const args = ['scripts/export_ui.mjs', '--url', URL, '--surface', 'floor', '--stage', s.id,
    '--dur', String(durOf(s.id)), '--fps', FPS, '--w', W,
    '--alpha',                       // 에펙 합성용 — 알파 보존(ProRes 4444 + PNG 시퀀스)
    '--out', OUT];
  if (s.live) args.push('--live');
  const t0 = Date.now();
  const ch = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  const eat = d => { tail = (tail + d.toString()).slice(-4000); };
  ch.stdout.on('data', eat); ch.stderr.on('data', eat);
  ch.on('close', code => res({ ...s, code, secs: Math.round((Date.now() - t0) / 1000), tail }));
});

// ★ 렌더 전에 클립이 전부 올-인트라인지 먼저 본다. 아니면 인물이 조용히 사라지고, 그걸
//   알아채는 건 한참 뒤 산출물을 눈으로 볼 때다. 시작화면(READY·BK_READY)은 캔버스에
//   인물 영상을 얹으므로 이 경로에도 그대로 해당한다.
try {
  execFileSync('node', ['scripts/check_clips_intra.mjs'], { stdio: 'pipe' });
  console.log('클립 검사 통과 — 전부 올-인트라\n');
} catch (e) {
  console.error((e.stdout || '').toString());
  console.error('★ 클립이 올-인트라가 아닙니다. 이대로 뽑으면 인물이 사라집니다.');
  console.error('   node scripts/check_clips_intra.mjs --fix   로 고친 뒤 다시 실행하세요.');
  process.exit(1);
}

const total = STAGES.reduce((a, s) => a + Math.round(durOf(s.id) * parseFloat(FPS)), 0);
console.log(`지면 정면 UI ${STAGES.length}화면 · 총 ${total}프레임 · ${W}px ${FPS}fps · 알파 보존 → ${OUT}`);
console.log(`서버 ${URL}\n`);

const done = [];
for (let i = 0; i < STAGES.length; i++) {
  const s = STAGES[i], d = durOf(s.id);
  process.stdout.write(`[${i + 1}/${STAGES.length}] ${s.id.padEnd(9)} ${s.title.padEnd(26)} ${d}초 ${Math.round(d * parseFloat(FPS))}프레임 … `);
  const r = await run(s);
  done.push(r);
  const mm = Math.floor(r.secs / 60), ss = r.secs % 60;
  if (r.code !== 0) {
    console.log(`✗ 실패(코드 ${r.code}) ${mm}분 ${ss}초`);
    console.log(r.tail.split('\n').slice(-6).map(l => '      ' + l).join('\n'));
  } else console.log(`✓ ${mm}분 ${ss}초`);
}

const secs = done.reduce((a, r) => a + r.secs, 0);
console.log(`\n총 ${Math.floor(secs / 60)}분 ${secs % 60}초`);
const bad = done.filter(r => r.code !== 0);
if (bad.length) {
  console.log('확인 필요:');
  for (const r of bad) console.log(`  · ${r.id} — 실패(코드 ${r.code})`);
  process.exit(1);
}
console.log(`전부 정상 — ${OUT} 에 화면당 PNG 시퀀스 + .mov`);
