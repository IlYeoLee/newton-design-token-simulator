// BX_A1 검증 — 큐 순서(목 1개 → 어깨 2개)와 8회 카운트가 스테이지 안에서 끝나는지.
//   ① 목·어깨가 동시에 뜨는 구간이 없다(등장 번쩍임 방지)
//   ② 큐가 하나도 없는 구간이 없다
//   ③ 카운트가 1 에서 시작해 8 까지 다 나오고, 8 이 스테이지 끝까지 유지된다
//   ④ 전환이 클립 한가운데(영상의 목→어깨 지점)에 맞는다
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
const CLIP = Number(src.match(/const BX_A1_CLIP = ([\d.]+)/)[1]);
assert.ok(CLIP > 0, 'BX_A1_CLIP 를 못 읽었다');
assert.ok(/id:'BX_A1',\s*wall:true,\s*dur:BX_A1_CLIP/.test(src), 'BX_A1 스테이지에 dur 가 안 걸려 있다');

const dur = CLIP, HALF = dur / 2, per = dur / 8;
const shOn = t => t >= HALF;
const count = t => Math.min(8, Math.floor(t / per) + 1);

let both = 0, none = 0, flip = null;
const seen = new Set();
for (let t = 0; t < dur; t += 0.01) {
  const n = !shOn(t), s = shOn(t);
  if (n && s) both++;
  if (!n && !s) none++;
  if (s && flip === null) flip = +t.toFixed(2);
  seen.add(count(t));
}
const last = count(dur - 0.001);
console.log(`클립·스테이지 ${dur}s · 회당 ${per.toFixed(3)}s · 전환 ${flip}s`);
console.log(`목 1개 0~${flip}s (1~4회) → 어깨 2개 ${flip}~${dur}s (5~8회) · 마지막 카운트 ${last}`);

assert.equal(both, 0, '목과 어깨가 동시에 뜨는 구간이 있다(번쩍임)');
assert.equal(none, 0, '큐가 하나도 없는 구간이 있다');
assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], '1~8 이 다 안 나온다');
assert.equal(last, 8, '스테이지가 8 에 닿기 전에 끝난다');
assert.ok(Math.abs(flip - HALF) < 0.02, '전환이 클립 한가운데가 아니다');
console.log('OK — 1~8 전부 나오고 8 로 끝난다, 큐 겹침·공백 없음');
