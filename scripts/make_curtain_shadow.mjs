// 창빛(커튼 그림자) 오버레이 생성 — 평탄화하면서 지운 자연광을 합성 단계에서 되돌린다.
//
//   배경을 평탄화하면 판 경계는 사라지지만 창빛·커튼 그림자도 같이 지워져 벽이 밋밋해진다.
//   그건 배경에 굽지 말고 **합성에서 맨 위에 얹는 게** 맞다 — 세기를 그때 조절할 수 있고,
//   투사 UI 위에 와야 "빛이 방에 든다"로 읽힌다.
//
//   구조(레퍼런스 실측): 창에서 들어온 빛이 벽에 **기울어진 사각형**으로 찍히고,
//   그 안에 창살·커튼이 만드는 **곧은 세로 띠**가 평행하게 흐른다. 띠는 빛 사각형과
//   같은 각도로 기울고, 위로 갈수록 넓어진다(원근). 경계는 전부 매우 부드럽다.
//
//   결과: 회색조 PNG. 255 = 가장 밝은 창빛 · 어두울수록 그늘.
//   에펙에서 **Multiply**(곱하기)로 얹고 불투명도로 세기를 맞춘다.
//
//   사용:
//     node scripts/make_curtain_shadow.mjs
//     node scripts/make_curtain_shadow.mjs --strength 0.3 --slats 7 --tilt 30
//
//   손잡이:
//     --tilt      빛이 기우는 각도(도) — 창이 높을수록 크다               기본 27
//     --slats     세로 띠 개수                                            기본 6
//     --gap       띠 사이 그늘 비중 0~1 (클수록 띠가 가늘다)              기본 0.45
//     --strength  전체 대비 0~1                                           기본 0.30
//     --soft      경계 부드러움(px)                                       기본 40
//     --x --y     빛 사각형 중심(0~1)                                     기본 0.30 / 0.40
//     --sx --sy   빛 사각형 크기(0~1)                                     기본 0.46 / 0.62
//     --w --h     출력 크기                                    기본 8208 × 5348
//     --out       출력 경로                     기본 Documents/커튼그림자.png

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 8208), H = +arg('h', 5348);
const TILT = +arg('tilt', 27) * Math.PI / 180;
const SLATS = +arg('slats', 6);
const GAP = +arg('gap', 0.45);
const STRENGTH = +arg('strength', 0.30);
const SOFT = +arg('soft', 40);
const CX = +arg('x', 0.30), CY = +arg('y', 0.40);
const SX = +arg('sx', 0.46), SY = +arg('sy', 0.62);
const OUT = arg('out', 'C:/Users/user/Documents/커튼그림자.png');

// 저해상도로 만들고 마지막에 키운다 — 아주 부드러운 그림이라 원본 해상도 루프는 낭비다.
const SW = 1400, SH = Math.round(SW * H / W);
const buf = Buffer.allocUnsafe(SW * SH);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const u = x / SW, v = y / SH;
    // 빛 사각형 — 기울어진 좌표계. rx = 띠가 흐르는 방향의 수직축(= 띠 번호축)
    const dx = u - CX, dy = v - CY;
    const rx =  dx * Math.cos(TILT) + dy * Math.sin(TILT);
    const ry = -dx * Math.sin(TILT) + dy * Math.cos(TILT);

    // ① 빛 덩어리: 가장자리를 길게 페이드(창빛은 경계가 흐리다). 위쪽이 더 밝다.
    const patch = sm(SX, SX * 0.18, Math.abs(rx)) * sm(SY, SY * 0.20, Math.abs(ry));
    if (patch <= 0.001) { buf[y * SW + x] = Math.round((1 - STRENGTH) * 255); continue; }

    // ② 세로 띠 — rx 를 따라 주기적. 원근으로 위(ry<0)에서 살짝 넓어진다.
    const persp = 1 + 0.22 * ry;                    // 위쪽이 넓다
    const phase = (rx / Math.max(0.05, persp)) * SLATS * Math.PI * 2;
    //   사각 띠에 가깝게 — 사인만 쓰면 물결이라 창살로 안 읽힌다. 문턱으로 눌러 평평한 띠를 만든다.
    const raw = 0.5 + 0.5 * Math.sin(phase);
    const band = sm(GAP - 0.16, GAP + 0.16, raw);   // 0 = 그늘 · 1 = 밝은 띠
    //   띠 대비는 빛 중심부에서 가장 세고 가장자리에서 사라진다
    const bandW = band * patch + (1 - patch);

    // ③ 합성: 빛 밖은 그늘, 빛 안은 띠에 따라
    const lit = 1 - STRENGTH * (1 - patch) * 0.55;  // 빛 밖 기본 그늘
    const g = lit * (1 - STRENGTH * (1 - bandW));
    buf[y * SW + x] = Math.max(0, Math.min(255, Math.round(g * 255)));
  }
}

const TMP = os.tmpdir();
const rawP = path.join(TMP, 'curtain.raw');
fs.writeFileSync(rawP, buf);
const sig = Math.max(0.6, SOFT * SW / W);
execFileSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${SW}x${SH}`,
  '-i', rawP, '-vf', `gblur=sigma=${sig.toFixed(2)},scale=${W}:${H}:flags=lanczos,format=gray`,
  '-y', OUT]);
fs.rmSync(rawP);

const st = fs.statSync(OUT);
console.log(`창빛 오버레이 — ${OUT}`);
console.log(`  ${W}×${H} · ${(st.size / 1048576).toFixed(1)}MB · 회색조`);
console.log(`  기울기 ${(TILT * 180 / Math.PI).toFixed(0)}° · 띠 ${SLATS}개 · 세기 ${STRENGTH} · 부드러움 ${SOFT}px`);
console.log('\n에펙: 맨 위 레이어 · 블렌딩 Multiply · 불투명도 40~70%');
