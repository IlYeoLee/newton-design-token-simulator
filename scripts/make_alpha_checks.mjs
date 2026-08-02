// 알파 검수용 합성본 — 07-30 릴리스 규약(_CHECKER)을 가볍게.
//   숫자 검수(모서리 알파)는 통과했는데 에펙에선 검게 보인다는 신고가 반복됐다. 그럴 땐 파일이
//   아니라 임포트 쪽 문제인데, **더블클릭 한 번으로 가르는 파일**이 있으면 그 왕복이 사라진다:
//   체커 위에서 배경이 비치면 알파가 살아 있는 것이다.
//
//   ★ 확인용이지 납품물이 아니다. 작고 빠른 게 전부다 — 긴 변 960 · 1.5초.
//     처음엔 64px 체커를 tile 로 4096 까지 깔고 리샘플했는데 파일이 34MB 에 몇 분씩 걸렸다.
//     체커는 최종 크기에서 geq 로 바로 굽고, 칸을 크게(80px) 잡아야 압축도 붙는다.
//
//   사용: node scripts/make_alpha_checks.mjs out/AE_4K/*.mov
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const files = process.argv.slice(2).filter(f => /\.mov$/i.test(f) && fs.existsSync(f));
if (!files.length) { console.error('사용: node scripts/make_alpha_checks.mjs <알파 .mov …>'); process.exit(1); }

const CHK = "geq=lum='if(eq(mod(floor(X/80)+floor(Y/80),2),0),210,145)':cb=128:cr=128";

for (const f of files) {
  const dir = path.dirname(f), base = path.basename(f, '.mov');
  const out = path.join(dir, 'alpha_check');
  fs.mkdirSync(out, { recursive: true });
  const dst = path.join(out, `${base}_CHECKER.mp4`);
  const t0 = Date.now();
  try {
    execFileSync(FF, ['-y', '-v', 'error',
      '-t', '1.5', '-i', f,                       // ★ -t 를 입력 앞에 — 3초 전체를 디코드하지 않는다
      '-filter_complex',
      // 알파 영상을 먼저 960 으로 줄이고(이후 연산이 전부 싸진다), 같은 크기 체커를 만들어 깐다
      `[0:v]scale=960:-2,format=rgba[v];[v]split[v1][v2];`
      + `[v1]${CHK},format=gbrp[bg];[bg][v2]overlay=format=auto,format=yuv420p`,
      '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast', dst],
      { stdio: ['ignore', 'ignore', 'inherit'] });
    const mb = (fs.statSync(dst).size / 1048576).toFixed(1);
    console.log(`  ✓ ${path.basename(dst)}  (${mb}MB · ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } catch { console.log(`  ✗ 실패 — ${base}`); }
}
console.log('\n체커 위에서 배경이 비치면 알파가 살아 있는 것입니다. 검게 덮여 있으면 알파가 없는 파일입니다.');
