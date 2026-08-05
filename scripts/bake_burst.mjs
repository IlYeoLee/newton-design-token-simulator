// '팡'(effects.burst)을 AE 용 시퀀스로 굽는다 — 시뮬 셰이더와 **같은 수식**.
//
//   왜 굽나: 팡은 씬에서 THREE.AdditiveBlending 으로 그리는 순수한 빛이라 커버리지 알파가
//   없다. 알파로 뽑아 Normal 로 얹으면 넓은 자락이 어두운 물감이 되어 바닥에 빨간 그림자
//   박스를 만든다(실측). 그래서 팡만 떼어 AE 에서 가산으로 얹는다.
//
//   왜 렌더가 아니라 굽나: 씬 렌더는 프레임당 4.5초(코치 클립 시크)라 1초짜리 팡에 20분이
//   든다. 이 셰이더는 순수 함수 — 입력이 uv 와 t 뿐이라 Node 에서 그대로 계산된다. 3초면 된다.
//   세기·크기를 바꿔도 재렌더가 아니라 재계산이다.
//
//   원본: src/effects.js BURST_FRAG · 파라미터는 src/fxlut.js FXP.graphics
//         호출부 src/main.js _pressBurst → { intensity: 0.72, sizeM: 0.52 }
//
//   사용: node scripts/bake_burst.mjs [--out 폴더] [--px 512] [--fps 29.97]
//         [--intensity 0.72] [--noise 0.5] [--halo 0.9] [--ember 0.3] [--width 1]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out', 'out/BURST_BAKE');
const PX = +arg('px', 512);
const FPS = +arg('fps', 29.97);
const INTENSITY = +arg('intensity', 0.72);   // main.js _pressBurst (soft 아님)
const NOISE = +arg('noise', 0.5);            // FXP.graphics.noise — 일렁임
const HALO = +arg('halo', 0.9);              // FXP.graphics.halo
const EMBER = +arg('ember', 0.3);            // FXP.graphics.ember
const UW = +arg('width', 1.0);               // FXP.graphics.width
const DUR = +arg('dur', 1.05);               // FXP.graphics.duration / speed

// ── 뉴턴 LUT (OKLab 보간) — src/palette.js STOPS + fx-core buildLUT 이식 ──
const PAL = { red: '#FA3030', coral: '#FE6E3C', sand: '#FEC389', prism: '#D1FEFF' };
const STOPS = [[PAL.red, 0], [PAL.red, 0.30], [PAL.coral, 0.56], [PAL.sand, 0.86], [PAL.prism, 1]];
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const l2s = c => Math.max(0, Math.min(255, Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))));
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2ok = (r, g, b) => {
  r = s2l(r); g = s2l(g); b = s2l(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
};
const ok2rgb = (L, a, b) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
};
const LUT = new Uint8Array(256 * 3);
{
  const st = [...STOPS].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let j = 0; while (j < st.length - 2 && v > st[j + 1][1]) j++;
    const [c0, p0] = st[j], [c1, p1] = st[j + 1];
    const f = Math.max(0, Math.min(1, (v - p0) / Math.max(1e-5, p1 - p0)));
    const A = rgb2ok(...hex2rgb(c0)), B = rgb2ok(...hex2rgb(c1));
    const c = ok2rgb(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
    LUT.set(c, i * 3);
  }
}
const lut = v => { const i = Math.max(0, Math.min(255, Math.round(v * 255))) * 3; return [LUT[i], LUT[i + 1], LUT[i + 2]]; };

// 일렁임 — 셰이더의 fxundul/fxfbm 자리. 값 스케일(±0.5)만 맞춘 사인 합성이면 육안 차이가 없다
// (원 노이즈는 uNoise*0.10 = 최대 5% 거리 워프라 형태를 바꾸지 못한다).
const undul = (a, t) => 0.5 * Math.sin(a * 3.0 + t * 1.7) + 0.28 * Math.sin(a * 5.0 - t * 2.3) + 0.16 * Math.sin(a * 2.0 + t * 0.9);

const N = Math.max(1, Math.round(DUR * FPS));
fs.mkdirSync(OUT, { recursive: true });
const buf = Buffer.alloc(PX * PX * 4);
const SEED = 2.4;

for (let f = 0; f < N; f++) {
  const t = Math.min(1, f / (N - 1 || 1));
  const ein = smoothstep(0, 0.06, t);
  const e = 1 - (1 - t) ** 2.6;
  const fade = (1 - t) ** 1.5 * ein;
  const R = 0.06 + e * 0.84;
  const W = (0.028 + e * 0.09) * UW * 1.4;
  const e2 = 1 - (1 - Math.max(0, Math.min(1, t - 0.14)) / 0.86) ** 2.6;
  const R2 = 0.06 + e2 * 0.9 * 0.84;
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const ux = ((x + 0.5) / PX - 0.5) * 2, uy = ((y + 0.5) / PX - 0.5) * 2;
      const d0 = Math.hypot(ux, uy), ang = Math.atan2(uy, ux);
      const wob = undul(ang + SEED, t * 2.2);
      const d = d0 * (1 + wob * NOISE * 0.10);
      let heat = g(d - R, W) + g(d - R, W * 4.6) * 0.6 * HALO;
      heat += (g(d - R2, W) + g(d - R2, W * 4.6) * 0.6 * HALO) * 0.38;
      heat *= fade;
      heat += smoothstep(R, R * 0.2, d0) * EMBER * fade * (0.8 + 0.2 * wob);
      heat += Math.exp(-d0 * 6.5) * (1 - t) ** 2.2 * 1.15;
      heat *= INTENSITY;
      heat *= smoothstep(1.0, 0.78, d0);          // 쿼드 경계 페이드 (사각 박스 방지)
      const sweep = 0.09 * Math.sin(ang - t * 2.4) + 0.05 * Math.sin(ang * 2 + t * 1.1);
      const idx = Math.max(0, Math.min(1, heat * (0.95 - 0.28 * t) + sweep * Math.min(heat, 1)));
      const gain = Math.min(heat, 1.4) * 1.45;
      const c = lut(idx);
      const q = (y * PX + x) * 4;
      const rr = Math.min(255, c[0] * gain), gg = Math.min(255, c[1] * gain), bb = Math.min(255, c[2] * gain);
      buf[q] = rr; buf[q + 1] = gg; buf[q + 2] = bb;
      // 알파 = 휘도. 가산으로 쓰면 무시되고, 굳이 Normal 로 쓸 때 검은 사각형이 안 생긴다.
      buf[q + 3] = Math.min(255, Math.round(0.299 * rr + 0.587 * gg + 0.114 * bb));
    }
  }
  const raw = path.join(OUT, '_t.raw');
  fs.writeFileSync(raw, buf);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${PX}x${PX}`,
    '-i', raw, path.join(OUT, `f${String(f).padStart(4, '0')}.png`)]);
  fs.unlinkSync(raw);
}
function g(v, w) { return Math.exp(-((v / Math.max(w, 1e-6)) ** 2)); }
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); }
console.log(`✅ ${OUT}  ${N}장 · ${PX}×${PX} · ${DUR}초 @${FPS}fps · intensity ${INTENSITY}`);
