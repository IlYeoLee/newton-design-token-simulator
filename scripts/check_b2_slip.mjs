// BX_B2 검증 — 회피 비트표가 코치 클립(bx_b2_slip.mp4)의 설계와 어긋나지 않는지.
//   ① 스테이지 dur 이 클립 길이에 걸려 있다 (예전엔 per 1.1×6=6.9s 로 12s 클립 한복판에서 잘렸다)
//   ② 비트가 시간순이고 전부 클립 안에 있으며 프레임 격자(24fps) 위에 있다
//   ③ 좌·우가 엄격히 교대하고 '좌'로 시작한다 (유저 정본: 중립 → 좌 → 우 → 반복)
//   ④ 템포가 일정하다 — 구 클립이 편차 32% 로 실패했던 지점이다
//   ⑤ 첫 비트 앞에 인트로(중립 정면에서 가드 올리기) 자리가 남아 있다
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
const CLIP = Number(src.match(/const BX_B2_CLIP = ([\d.]+)/)[1]);
assert.ok(CLIP > 0, 'BX_B2_CLIP 를 못 읽었다');
assert.ok(/id:'BX_B2',[^}]*dur:BX_B2_CLIP/.test(src), 'BX_B2 스테이지에 dur 가 클립으로 안 걸려 있다');

const body = src.match(/const BX_B2_BEATS = \[([\s\S]*?)\n\];/)[1];
const beats = [...body.matchAll(/\{\s*t:\s*([\d.]+),\s*side:\s*([+-]?\d)\s*\}/g)]
  .map(m => ({ t: +m[1], side: +m[2] }));
assert.equal(beats.length, 6, `슬립은 6회여야 한다 (지금 ${beats.length})`);

const FPS = 24;
for (let i = 0; i < beats.length; i++) {
  const b = beats[i];
  assert.ok(b.t > 0 && b.t <= CLIP, `비트 ${i + 1} 이 클립(0~${CLIP}s) 밖: ${b.t}`);
  assert.ok(b.side === 1 || b.side === -1, `비트 ${i + 1} side 는 ±1 이어야 한다: ${b.side}`);
  if (i) assert.ok(b.t > beats[i - 1].t, `비트 ${i + 1} 이 시간순이 아니다`);
  const f = b.t * FPS;
  assert.ok(Math.abs(f - Math.round(f)) < 0.02, `비트 ${i + 1}(${b.t}s)이 프레임 격자에 없다 → f=${f.toFixed(2)}`);
}
// ③ 좌로 시작 + 엄격 교대 — 구 클립은 좌·우·우·우·좌 였다
assert.equal(beats[0].side, -1, '첫 슬립은 왼쪽이어야 한다(유저 정본: 좌부터)');
for (let i = 1; i < beats.length; i++)
  assert.notEqual(beats[i].side, beats[i - 1].side, `비트 ${i} 와 ${i + 1} 의 방향이 같다 — 좌우가 교대해야 한다`);

// ④ 일정 템포 — 편차 3% 이내(조립본이라 원래 딱 떨어진다). 구 클립은 32% 였다.
const gaps = beats.slice(1).map((b, i) => b.t - beats[i].t);
const avg = gaps.reduce((a, g) => a + g, 0) / gaps.length;
const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - avg) ** 2, 0) / gaps.length);
assert.ok(sd / avg < 0.03, `템포가 일정하지 않다 — 간격 ${gaps.join('/')} 편차 ${(sd / avg * 100).toFixed(0)}%`);

// ⑤ 인트로 자리
const intro = beats[0].t - avg;
assert.ok(intro > 0.2, `첫 비트 앞에 인트로(중립→가드) 자리가 없다: ${intro.toFixed(2)}s`);
assert.ok(Math.abs(beats[beats.length - 1].t - CLIP) < 0.05,
  `마지막 비트(${beats[beats.length - 1].t}s)가 클립 끝(${CLIP}s)과 안 맞는다`);

console.log(`클립 ${CLIP}s · ${Math.round(CLIP * FPS)}프레임 · 인트로 ${intro.toFixed(2)}s`);
console.log(`비트 ${beats.length}회 · 간격 ${avg.toFixed(2)}s (편차 ${(sd / avg * 100).toFixed(1)}%) — ${beats.map(b => `${b.t}${b.side < 0 ? '좌' : '우'}`).join(' · ')}`);
console.log('OK — dur 이 클립에 걸렸고, 좌로 시작해 좌우가 교대하며 템포가 일정하다');
