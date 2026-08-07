// A2 판을 '바닥에 누운 것처럼' 미리 눌러서 굽는다 — 에펙에서 3D·코너핀 안 쓰고 그냥 얹는 용도.
//
//   왜: 유저가 원한 건 공간에 넣는 게(3D 회전·코너핀) 아니라 **이미 납작한 판** 하나다.
//       그걸 실사 위에 올려서 위치·크기만 맞추면 끝나게.
//
//   각도는 실사 실측에서 온다(measure_track_vp.mjs · 소실점 잔차 0.6%):
//       하향각 31.61° · 세로화각 60°
//   눈높이 1.55m 는 추정이다 — **기울기가 아니라 크기만** 정한다.
//
//   출력: 사다리꼴로 눌린 시퀀스. 위가 좁고(멀어서) 아래가 넓다. 세로가 크게 압축된다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2];                       // PNG 시퀀스 폴더
const OUT = arg('out', 'out/A2_GROUND');
// 바탕화면에서 돌아도 리포의 ffmpeg-static 을 쓴다(전역 ffmpeg 은 이 기계에 없다)
import { createRequire } from 'node:module';
const _req = createRequire('C:/Users/Administrator/projects/newton-design-token-simulator/package.json');
const FFMPEG = _req('ffmpeg-static');

const PITCH = +arg('pitch', 31.61) * Math.PI / 180;   // 하향각(실측)
const VFOV  = +arg('vfov', 60) * Math.PI / 180;
const EYE   = +arg('eye', 1.55);                      // m — 크기만 정한다
const NEAR  = +arg('near', 0.60);                     // 판 앞 모서리까지 거리(m)
const MPP   = 0.000687 * 1.25;                        // 대지 1px = 0.687mm · --pad 1.25 반영

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort();
const first = files[0];
// 크기는 PNG IHDR 에서 (ffprobe 안 쓴다)
const hd = Buffer.alloc(24);
{ const fd = fs.openSync(path.join(SRC, first), 'r'); fs.readSync(fd, hd, 0, 24, 0); fs.closeSync(fd); }
const SW = hd.readUInt32BE(16), SH = hd.readUInt32BE(20);

const WM = SW * MPP, DM = SH * MPP;                   // 판의 실제 크기(m)
const FAR = NEAR + DM;

// ── 핀홀 투영: 깊이 d 의 지면점이 화면 어디에 오나
const project = (d, halfW) => {
  const phi = Math.atan(EYE / d);                     // 내려다보는 각
  const a = phi - PITCH;                              // 광축에서 벗어난 각
  const r = Math.hypot(EYE, d);
  return { yRatio: Math.tan(a), wRatio: halfW / (r * Math.cos(a)) };   // f 로 나누기 전 비율
};
const nearP = project(NEAR, WM / 2), farP = project(FAR, WM / 2);

// 출력 캔버스: 가로는 근거리 폭이 꽉 차게, 세로는 투영된 만큼만
const OW = SW;
const f = (OW / 2) / nearP.wRatio;                    // 근거리 폭 = 캔버스 폭
const yNear = f * nearP.yRatio, yFar = f * farP.yRatio;
const OH = Math.max(8, Math.round(Math.abs(yNear - yFar)));
const halfNear = f * nearP.wRatio, halfFar = f * farP.wRatio;

// 사다리꼴 네 점 (좌상 우상 좌하 우하) — 위가 먼 쪽
const cx = OW / 2;
const pts = [
  Math.round(cx - halfFar), 0,
  Math.round(cx + halfFar), 0,
  Math.round(cx - halfNear), OH,
  Math.round(cx + halfNear), OH,
];

console.log(`판 ${SW}x${SH}px = ${WM.toFixed(2)}m x ${DM.toFixed(2)}m · 거리 ${NEAR}~${FAR.toFixed(2)}m`);
console.log(`하향 ${(PITCH * 180 / Math.PI).toFixed(2)}° · 눈높이 ${EYE}m`);
console.log(`출력 ${OW}x${OH}  (세로 ${(OH / SH * 100).toFixed(1)}% 로 눌림)`);
console.log(`위 폭 ${Math.round(halfFar * 2)}px · 아래 폭 ${Math.round(halfNear * 2)}px  (수렴비 ${(halfFar / halfNear).toFixed(3)})`);

fs.mkdirSync(OUT, { recursive: true });
const seq = path.join(OUT, 'ground_png');
fs.mkdirSync(seq, { recursive: true });

// perspective 는 sense=destination 으로 '원본 네 귀퉁이를 이 좌표로 보낸다'
const vf = `scale=${OW}:${OH},perspective=${pts.join(':')}:sense=destination`;
execFileSync(FFMPEG, ['-v', 'error', '-y', '-framerate', '30000/1001',
  '-i', path.join(SRC, 'f%05d.png'), '-vf', vf,
  path.join(seq, 'f%05d.png')], { stdio: 'inherit' });

const mov = path.join(OUT, `A2_GROUND_${OW}x${OH}_ProRes422HQ.mov`);
execFileSync(FFMPEG, ['-v', 'error', '-y', '-framerate', '30000/1001',
  '-i', path.join(seq, 'f%05d.png'), '-c:v', 'prores_ks', '-profile:v', '3',
  '-pix_fmt', 'yuv422p10le', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-colorspace', 'bt709', mov], { stdio: 'inherit' });

console.log(`\n✅ ${mov}`);
console.log(`   ${seq}  (${files.length}장)`);
