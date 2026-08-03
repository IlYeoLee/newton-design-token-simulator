// BX_A1 회전 큐 순서 검증 — 목 1개 → (전환) → 어깨 2개.
//   ① 어느 시점에도 목·어깨가 같이 뜨지 않는다(등장 번쩍임 방지)
//   ② 큐가 하나도 없는 구간이 없다
//   ③ 전환 시점이 클립 실측(BX_A1_CLIP)의 절반 + 0.6s 이다
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
const CLIP = Number(src.match(/const BX_A1_CLIP = ([\d.]+)/)[1]);
assert.ok(CLIP > 0, 'BX_A1_CLIP 를 못 읽었다');

const STAGE = 8 * 0.7;              // BX_A1 스테이지 길이(= 8회 × 0.7s)
const shOn = t => t > CLIP * 0.5 + 0.6;
const neckOn = t => !shOn(t);

let both = 0, none = 0, flip = null;
for (let t = 0; t <= STAGE; t += 0.02) {
  const n = neckOn(t), s = shOn(t);
  if (n && s) both++;
  if (!n && !s) none++;
  if (s && flip === null) flip = +t.toFixed(2);
}
console.log(`클립 ${CLIP}s · 스테이지 ${STAGE}s · 전환 ${flip}s`);
console.log(`목 단독 0~${flip}s → 어깨 2개 ${flip}~${STAGE}s`);

assert.equal(both, 0, '목과 어깨가 동시에 뜨는 구간이 있다(번쩍임)');
assert.equal(none, 0, '큐가 하나도 없는 구간이 있다');
assert.ok(flip > 0 && flip < STAGE, `전환이 스테이지 안에서 일어나야 한다 (flip=${flip})`);
assert.ok(Math.abs(flip - (CLIP * 0.5 + 0.6)) < 0.05, '전환 시점이 클립 실측과 안 맞는다');
console.log('OK — 목 1개 → 어깨 2개, 겹침·공백 없음');
