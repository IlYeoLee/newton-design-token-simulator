// 색보정 갤러리 — 합성본을 원본 실사 톤으로 옮기는 후보를 한 장에 펼쳐 보고 고른다.
//
//   왜: "조금 더 뉴트럴하게"를 말로 주고받으면 왕복이 길다. 후보를 격자로 깔아 놓고
//   번호로 고르면 한 번에 끝난다. 고른 값은 그대로 에펙 Lumetri/Color Balance 에 넣는다.
//
//   기준(2026-08-05 실측):
//     원본 실사(인물 영상) 벽  rgb(186~191, 188~195, 189~197)   R−B −3 ~ −6
//     합성본 벽                rgb(192,188,180)                  R−B +12
//   → 누런기를 빼는 방향. 여기서는 **B 게인만 올리는** 축으로 후보를 만든다
//     (R 을 내리면 어두워지고, B 를 올리면 밝기를 지키며 색만 이동한다).
//
//   사용:
//     node scripts/make_grade_gallery.mjs --src <이미지>
//     node scripts/make_grade_gallery.mjs --src out/BOXING/BX_A1/..._png/f00100.png --out out/GRADE
//
//   출력: <out>/갤러리.png (번호 붙은 격자) + 후보별 개별 PNG + 값 표

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = arg('src', '');
const OUT = arg('out', 'out/GRADE');
if (!SRC || !fs.existsSync(SRC)) { console.error('사용: node scripts/make_grade_gallery.mjs --src <이미지>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// 후보 — [이름, R게인, G게인, B게인]. 왼쪽 위가 원본, 오른쪽 아래로 갈수록 뉴트럴/쿨.
const CAND = [
  ['0 원본',        1.000, 1.000, 1.000],
  ['1 살짝',        0.997, 1.003, 1.020],
  ['2 약하게',      0.994, 1.006, 1.035],
  ['3 중간',        0.990, 1.010, 1.052],   // ← 실측 목표(R−B −4)에 가장 가까움
  ['4 조금 세게',   0.986, 1.012, 1.068],
  ['5 세게',        0.980, 1.015, 1.085],
  ['6 매우 세게',   0.974, 1.018, 1.105],
  ['7 쿨',          0.968, 1.020, 1.125],
];

const tiles = [];
console.log(`원본: ${SRC}`);
console.log('번호  이름          R게인   G게인   B게인   결과 벽색        R−B');
for (const [name, r, g, b] of CAND) {
  const f = path.join(OUT, name.split(' ')[0] + '.png');
  execFileSync('ffmpeg', ['-v', 'error', '-i', SRC,
    '-vf', `colorchannelmixer=rr=${r}:gg=${g}:bb=${b}`, '-y', f]);
  // 좌상 모서리(배경) 색을 재서 표에 같이 낸다
  const px = execFileSync('ffmpeg', ['-v', 'error', '-i', f,
    '-vf', 'crop=60:60:20:20,scale=1:1,format=rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 22 });
  const [R, G, B] = [px[0], px[1], px[2]];
  console.log(`  ${name.padEnd(14)} ${r.toFixed(3)}  ${g.toFixed(3)}  ${b.toFixed(3)}   rgb(${R},${G},${B})`.padEnd(72) + `  ${R - B}`);
  tiles.push(f);
}

// 격자 — 4×2
const args = [];
for (const t of tiles) args.push('-i', t);
const n = tiles.length, cols = 4;
let fc = tiles.map((_, i) => `[${i}]scale=520:-1,drawtext=text='${CAND[i][0]}':x=14:y=14:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8[t${i}]`).join(';');
fc += ';' + tiles.map((_, i) => `[t${i}]`).join('') + `concat=n=${n}:v=1:a=0,` + `null[x]`;
// concat 은 세로로 이어붙지 않으므로 tile 필터를 쓴다
const fc2 = tiles.map((_, i) => `[${i}]scale=520:-1,drawtext=text='${CAND[i][0]}':x=14:y=14:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8[t${i}]`).join(';')
  + ';' + tiles.map((_, i) => `[t${i}]`).join('') + `xstack=inputs=${n}:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0`;
const gal = path.join(OUT, '갤러리.png');
try {
  execFileSync('ffmpeg', ['-v', 'error', ...args, '-filter_complex', fc2, '-frames:v', '1', '-y', gal]);
  console.log(`\n갤러리: ${gal}`);
} catch (e) {
  // drawtext(폰트) 없는 환경 대비 — 글자 없이라도 낸다
  const plain = tiles.map((_, i) => `[${i}]scale=520:-1[t${i}]`).join(';')
    + ';' + tiles.map((_, i) => `[t${i}]`).join('') + `xstack=inputs=${n}:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0`;
  execFileSync('ffmpeg', ['-v', 'error', ...args, '-filter_complex', plain, '-frames:v', '1', '-y', gal]);
  console.log(`\n갤러리(글자 없음): ${gal}`);
}

console.log('\n고른 번호의 게인을 에펙에 넣는다:');
console.log('  Effect › Color Correction › Color Balance (또는 Lumetri › Temperature 음수)');
console.log('  또는 이 스크립트가 만든 개별 PNG 를 그대로 써도 된다.');
