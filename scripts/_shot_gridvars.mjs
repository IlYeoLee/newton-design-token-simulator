// 코치 판 뒤 배경 4안 — **익스포터 경로**로 뽑는다(투사 화면). 값을 소스에 넣고 렌더를 반복한다.
//   node scripts/_shot_gridvars.mjs <out디렉토리> [스테이지=A1]
import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';

const OUT = process.argv[2] || '.', STAGE = process.argv[3] || 'A1';
const SRC = 'src/main.js';
const VARS = [
  { n: 'A_line-thin',  lineOn: 1, lineW: 0.30, boost: 1.0 },
  { n: 'B_line-faint', lineOn: 1, lineW: 0.20, boost: 0.6 },
  { n: 'C_line-only',  lineOn: 1, lineW: 0.30, boost: 0.0 },
  { n: 'D_glow-only',  lineOn: 0, lineW: 0.30, boost: 1.0 },
];
const orig = fs.readFileSync(SRC, 'utf8');
const patch = v => {
  let s = orig;
  s = s.replace(/gu\.uLineOn\.value = [\d.]+;/, `gu.uLineOn.value = ${v.lineOn};`);
  s = s.replace(/gu\.uLineW\.value = [\d.]+;/, `gu.uLineW.value = ${v.lineW};`);
  // uBoost 는 매 프레임 판 페이드로 덮이므로, 그 대입에 배율을 곱해 변주한다
  s = s.replace(/gu\.uBoost\.value = \(co\.mat\.uniforms\.uFade\?\.value \?\? 1\);/,
                `gu.uBoost.value = (co.mat.uniforms.uFade?.value ?? 1) * ${v.boost};`);
  fs.writeFileSync(SRC, s);
};
try {
  for (const v of VARS) {
    patch(v);
    const outDir = path.join('out', '_GV_' + v.n);
    execFileSync('node', ['scripts/export_video.mjs', '--sport', STAGE.startsWith('BK_') ? 'basketball' : 'running',
      '--session', '--stage', STAGE, '--play', '--flat', '--w', '760', '--ss', '1', '--fps', '1', '--dur', '1',
      '--t0', '3.5', '--out', outDir, '--url', 'http://127.0.0.1:5200/'], { stdio: 'ignore' });
    const dir = fs.readdirSync(outDir).find(d => d.endsWith('_png'));
    const png = fs.readdirSync(path.join(outDir, dir))[0];
    fs.copyFileSync(path.join(outDir, dir, png), path.join(OUT, `gv_${v.n}.png`));
    console.log('saved', v.n);
  }
} finally {
  fs.writeFileSync(SRC, orig);   // ★ 원본 복구 — 실패해도 소스를 남기지 않는다
  console.log('소스 복구 완료');
}
