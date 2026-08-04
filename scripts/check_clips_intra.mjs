// 코치 클립이 전부 올-인트라인지 검사 — 인물 실종 버그 재발 방지.
//
//   익스포터는 프레임마다 video.currentTime 을 직접 찍어 시크한다. 키프레임이 드문 클립은
//   시크할 때마다 맨 앞부터 다시 디코드하고, 그 비용이 익스포터의 3초 안전장치를 넘기면
//   **디코드 전 상태로 스크린샷이 찍힌다 = 그 프레임에 인물이 없다.**
//   2026-08-04 에 이걸로 8시간을 썼다(240프레임 중 132장 실종). 자세한 내막은
//   docs/SCENE-VIDEO-PIPELINE.md §4 경고 블록.
//
//   그래서 규칙은 하나다 — **키프레임 수 == 전체 프레임 수.**
//
//   사용:
//     node scripts/check_clips_intra.mjs            # 검사만 (렌더 전에 돌릴 것)
//     node scripts/check_clips_intra.mjs --fix      # 어긋난 것을 그 자리에서 변환
//
//   새 클립을 넣을 때도 이걸로 확인하면 된다. 변환 명령은 --fix 가 쓰는 것과 같다:
//     ffmpeg -i 원본.mp4 -c:v libx264 -crf 16 -g 1 -pix_fmt yuv420p -movflags +faststart -an 출력.mp4

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const FIX = process.argv.includes('--fix');
const DIRS = ['public/ghost', 'public/_bg'];
// 백업·변형본은 앱이 안 쓴다 — 용량만 불린다.
const SKIP = /\.(prev|palindrome|1x|full|orig)\./;

const probe = (f, args) => {
  try { return execFileSync('ffprobe', ['-v', 'error', ...args, f], { encoding: 'utf8' }).trim(); }
  catch { return ''; }
};

const rows = [];
for (const d of DIRS) {
  if (!fs.existsSync(d)) continue;
  for (const name of fs.readdirSync(d)) {
    if (!/\.(mp4|mov|webm)$/i.test(name) || SKIP.test(name)) continue;
    const f = path.join(d, name);
    const kf = (probe(f, ['-select_streams', 'v:0', '-show_entries', 'frame=key_frame', '-of', 'csv=p=0'])
      .split('\n').filter(l => l.startsWith('1')).length);
    const tot = +probe(f, ['-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0']) || 0;
    rows.push({ f, name, kf, tot, ok: tot > 0 && kf === tot });
  }
}

const bad = rows.filter(r => !r.ok);
for (const r of rows) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(30)} 키프레임 ${r.kf}/${r.tot}` + (r.ok ? '' : '  ← 올-인트라 아님'));
}

if (!bad.length) { console.log(`\n${rows.length}개 전부 올-인트라 — 인물 실종 조건 없음`); process.exit(0); }

if (!FIX) {
  console.log(`\n★ ${bad.length}개가 올-인트라가 아닙니다. 이대로 뽑으면 인물이 사라질 수 있습니다.`);
  console.log('   고치려면: node scripts/check_clips_intra.mjs --fix');
  process.exit(1);
}

console.log(`\n${bad.length}개 변환합니다…`);
for (const r of bad) {
  const tmp = r.f + '.intra.tmp.mp4';
  execFileSync('ffmpeg', ['-v', 'error', '-i', r.f, '-c:v', 'libx264', '-crf', '16', '-g', '1',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-y', tmp]);
  fs.renameSync(tmp, r.f);
  const kf = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=key_frame', '-of', 'csv=p=0', r.f], { encoding: 'utf8' })
    .split('\n').filter(l => l.startsWith('1')).length;
  console.log(`  ✓ ${r.name}  →  키프레임 ${kf}`);
}
console.log('완료 — 다시 검사해서 확인하세요.');
