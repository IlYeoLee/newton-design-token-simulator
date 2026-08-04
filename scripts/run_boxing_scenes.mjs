// 복싱 씬 일괄 추출 — 한 번 걸어두고 손 떼는 용도.
//
//   씬마다 브라우저를 새로 띄운다(익스포터가 씬당 1회 실행되므로 자동). 각 씬의 --dur 은
//   **앱의 루프 주기**에 맞췄다: _period = ceil(sceneloop / 스테이지dur) * 스테이지dur
//   (main.js). 주기와 다른 길이로 뽑으면 마지막 바퀴가 중간에서 잘린다.
//
//   ★ 반드시 익스포트 전용 서버(5200)에 붙일 것. 개발 서버(5199)에 붙이면 누가 소스를
//     한 번만 저장해도 렌더가 통째로 죽는다(vite always-full-reload).
//       npm run dev:export
//
//   ★ 렌더가 도는 동안 리포에 아무것도 쓰지 말 것 — 위와 같은 이유로 죽는다.
//
//   사용:
//     node scripts/run_boxing_scenes.mjs                    # 기본 5씬
//     node scripts/run_boxing_scenes.mjs --only BX_C3       # 하나만
//     node scripts/run_boxing_scenes.mjs --w 3840           # 4K
//     node scripts/run_boxing_scenes.mjs --out out/BX_FINAL

import { spawn, execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = arg('w', '2560');
const FPS = arg('fps', '29.97');
const OUT = arg('out', 'out/BOXING');
const URL = arg('url', 'http://127.0.0.1:5200/');
const ONLY = arg('only', '');

// dur = 앱의 루프 주기. 스테이지 dur 이 있으면 sceneloop(8) 을 그 배수로 올림한 값이다.
const SCENES = [
  { id: 'BX_READY', dur: 8.00,  title: 'Bring the Ring Home' },
  { id: 'BX_A1',    dur: 12.08, title: 'NECK & SHOULDER ROLLS' },   // 코치 클립 6.04 × 2바퀴
  { id: 'BX_B2',    dur: 10.50, title: 'SLIP & EVADE' },            // 클립 길이 10.5
  { id: 'BX_C1',    dur: 9.00,  title: 'Round 1 of 6' },            // 스테이지 3 → 9 (3바퀴)
  { id: 'BX_C3',    dur: 12.08, title: 'COMBINATION' },             // 클립 6.04 × 2바퀴 (잽·잽·쉼·훅)
].filter(s => !ONLY || s.id === ONLY);

const run = (s) => new Promise((res) => {
  // ★ 씬마다 제 폴더에 넣는다 — 익스포터의 파일명(boxing_<w>p<fps>)에 씬 ID 가 안 들어가서
  //   같은 폴더로 뽑으면 **앞 씬을 조용히 덮어쓴다**(실측: A1 뽑고 B2 뽑으면 A1 이 사라진다).
  const args = ['scripts/export_video.mjs', '--url', URL, '--scene', s.id, '--sport', 'boxing',
    '--play', '--dur', String(s.dur), '--fps', FPS, '--w', W, '--ss', '1', '--out', `${OUT}/${s.id}`];
  const t0 = Date.now();
  const ch = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '', miss = null;
  const eat = (d) => {
    const t = d.toString();
    tail = (tail + t).slice(-4000);
    const m = /시크 실패 (\d+)건/.exec(t); if (m) miss = +m[1];
    if (/시크 전부 성공/.test(t)) miss = 0;
  };
  ch.stdout.on('data', eat); ch.stderr.on('data', eat);
  ch.on('close', (code) => {
    const secs = Math.round((Date.now() - t0) / 1000);
    res({ ...s, code, secs, miss, tail });
  });
});

// ★ 렌더 전에 클립이 전부 올-인트라인지 먼저 본다. 아니면 인물이 조용히 사라지고,
//   그걸 알아채는 건 한 시간 뒤 산출물을 눈으로 볼 때다(2026-08-04 에 그렇게 8시간을 썼다).
try {
  execFileSync('node', ['scripts/check_clips_intra.mjs'], { stdio: 'pipe' });
  console.log('클립 검사 통과 — 전부 올-인트라\n');
} catch (e) {
  console.error((e.stdout || '').toString());
  console.error('★ 클립이 올-인트라가 아닙니다. 이대로 뽑으면 인물이 사라집니다.');
  console.error('   node scripts/check_clips_intra.mjs --fix   로 고친 뒤 다시 실행하세요.');
  process.exit(1);
}

const total = SCENES.reduce((a, s) => a + Math.round(s.dur * parseFloat(FPS)), 0);
console.log(`복싱 ${SCENES.length}씬 · 총 ${total}프레임 · ${W}px ${FPS}fps → ${OUT}`);
console.log(`서버 ${URL}\n`);

const done = [];
for (let i = 0; i < SCENES.length; i++) {
  const s = SCENES[i];
  const frames = Math.round(s.dur * parseFloat(FPS));
  process.stdout.write(`[${i + 1}/${SCENES.length}] ${s.id.padEnd(9)} ${s.title.padEnd(24)} ${s.dur}초 ${frames}프레임 … `);
  const r = await run(s);
  done.push(r);
  const mm = Math.floor(r.secs / 60), ss = r.secs % 60;
  if (r.code !== 0) {
    console.log(`✗ 실패(코드 ${r.code}) ${mm}분 ${ss}초`);
    console.log(r.tail.split('\n').slice(-6).map(l => '      ' + l).join('\n'));
  } else {
    console.log(`✓ ${mm}분 ${ss}초` + (r.miss === 0 ? ' · 인물 전 구간 유지' : r.miss > 0 ? `  ⚠ 시크 실패 ${r.miss}건` : ''));
  }
}

const secs = done.reduce((a, r) => a + r.secs, 0);
console.log(`\n총 ${Math.floor(secs / 60)}분 ${secs % 60}초`);
const bad = done.filter(r => r.code !== 0 || (r.miss ?? 0) > 0);
if (bad.length) {
  console.log('확인 필요:');
  for (const r of bad) console.log(`  · ${r.id} — ` + (r.code !== 0 ? `실패(코드 ${r.code})` : `시크 실패 ${r.miss}건 = 그만큼 인물이 빠졌을 수 있음`));
  process.exit(1);
}
console.log('전부 정상 — 인물 빠진 프레임 없음');
