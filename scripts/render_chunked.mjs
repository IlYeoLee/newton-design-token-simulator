// 청크 렌더 — WebGL 컨텍스트가 죽으면 **죽은 프레임부터** 브라우저를 새로 띄워 이어 붙인다.
//
//   왜 필요한가: export_video 는 프레임당 시간이 자라다가(1.8→2.6s) 컨텍스트를 잃는다.
//   자원은 평평하고(누수 아님) 해상도를 낮춰도 더 빨리 죽기도 한다(상한 아님) — 원인 미규명.
//   죽는 프레임 수가 15~120 으로 들쭉날쭉해 고정 청크로는 못 나눈다. 그래서 **살아남은 만큼
//   받고 커서를 그만큼 민다.** 오래 버티면 왕복이 줄고, 일찍 죽어도 진도는 나간다.
//
//   ★ 스크럽 모드(--play 없음)에서만 옳다. 시각의 순수 함수라 t0 을 옮겨도 같은 프레임이 나온다.
//     --play 는 상태 누적형이라 중간부터 시작하면 재현이 안 된다.
//
// 사용: node scripts/render_chunked.mjs --scene A2 --dur 17.2 --w 1600 --out out/A2_FULL [기타 export_video 인자]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const DUR = +arg('dur', 17.2), FPS = +arg('fps', 30), OUT = arg('out', 'out/CHUNKED');
const CHUNK = +arg('chunk', 4);          // 한 번에 요청할 초 — 살아남으면 그만큼 다 받는다
const TRIES = +arg('tries', 4);          // 같은 자리에서 연속 실패 허용 횟수
const N = Math.round(DUR * FPS);
const pass = argv.filter((_, i) =>       // export_video 로 그대로 넘길 인자 (여기서 쓰는 건 뺀다)
  !['--dur', '--out', '--chunk', '--tries'].includes(argv[i - 1]) &&
  !['--dur', '--out', '--chunk', '--tries'].includes(argv[i]));

const MASTER = path.join(OUT, 'frames');
fs.mkdirSync(MASTER, { recursive: true });
const has = () => fs.readdirSync(MASTER).filter(f => f.endsWith('.png')).length;

let cursor = has();                      // 이미 받은 프레임 = 재개 지점 (중단하고 다시 돌려도 이어진다)
let stuck = 0;
console.log(`목표 ${N}프레임 (${DUR}s @${FPS}) · 시작 ${cursor}`);

while (cursor < N) {
  const t0 = cursor / FPS;
  const want = Math.min(CHUNK, (N - cursor) / FPS);
  const tmp = path.join(OUT, '_chunk');
  fs.rmSync(tmp, { recursive: true, force: true });

  const r = spawnSync('node', ['scripts/export_video.mjs', ...pass,
    '--t0', String(t0), '--dur', String(want), '--fps', String(FPS),
    '--nomov', '--out', tmp], { stdio: 'inherit' });
  if (r.error) { console.error(r.error); break; }

  // 살아남은 PNG 를 마스터로 옮기며 전역 번호를 다시 매긴다
  const dir = fs.existsSync(tmp) ? fs.readdirSync(tmp).find(d => d.endsWith('_png')) : null;
  const got = dir ? fs.readdirSync(path.join(tmp, dir)).filter(f => f.endsWith('.png')).sort() : [];
  for (const f of got) fs.renameSync(path.join(tmp, dir, f),
    path.join(MASTER, 'f' + String(cursor++).padStart(5, '0') + '.png'));
  fs.rmSync(tmp, { recursive: true, force: true });

  if (!got.length) {
    if (++stuck >= TRIES) { console.error(`\n✗ t=${t0.toFixed(2)}s 에서 ${TRIES}회 연속 0프레임 — 중단`); break; }
    console.log(`  ↻ 0프레임 — 재시도 ${stuck}/${TRIES}`);
  } else { stuck = 0; }
  console.log(`\n── ${cursor}/${N} 프레임 (${(cursor / N * 100).toFixed(1)}%)\n`);
}

console.log(`\n${has()}/${N} 프레임 → ${MASTER}`);
if (has() === N) {
  const mov = path.join(OUT, `chunked_${FPS}fps.mov`);
  spawnSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(MASTER, 'f%05d.png'),
    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', mov], { stdio: 'inherit' });
  console.log(`✅ ${mov}`);
}
