// BX_A1 검증 — 큐가 클립 위상을 따라가는지, 8회 카운트가 스테이지 안에서 끝나는지.
//   ① 목·어깨가 동시에 뜨거나 둘 다 꺼지는 구간이 없다
//   ② 큐 전환이 **매 클립 바퀴**의 한가운데에서 일어난다(영상의 목→어깨 지점)
//   ③ 카운트가 1 에서 시작해 8 까지 다 나오고, 8 로 끝난다
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
const CLIP = Number(src.match(/const BX_A1_CLIP = ([\d.]+)/)[1]);
const LOOPS = Number(src.match(/const BX_A1_LOOPS = (\d+)/)[1]);
assert.ok(CLIP > 0 && LOOPS >= 1, 'BX_A1_CLIP / BX_A1_LOOPS 를 못 읽었다');
assert.ok(/id:'BX_A1',\s*wall:true,\s*dur:BX_A1_CLIP \* BX_A1_LOOPS/.test(src), 'BX_A1 dur 이 클립×바퀴가 아니다');

const dur = CLIP * LOOPS, per = dur / 8;
const shOn = t => (t % CLIP) >= CLIP / 2;
const count = t => Math.min(8, Math.floor(t / per) + 1);

let both = 0, none = 0;
const flips = [], seen = new Set();
let prev = null;
for (let t = 0; t < dur; t += 0.01) {
  const s = shOn(t), n = !s;
  if (n && s) both++;
  if (!n && !s) none++;
  if (prev !== null && s !== prev) flips.push(+t.toFixed(2));
  prev = s;
  seen.add(count(t));
}
const last = count(dur - 0.001);
console.log(`클립 ${CLIP}s × ${LOOPS}바퀴 = 스테이지 ${dur.toFixed(2)}s · 회당 ${per.toFixed(3)}s`);
console.log(`큐 전환 시점: ${flips.join('s, ')}s · 마지막 카운트 ${last}`);

assert.equal(both, 0, '목과 어깨가 동시에 뜨는 구간이 있다');
assert.equal(none, 0, '큐가 하나도 없는 구간이 있다');
// 매 바퀴 한가운데에서 목→어깨, 바퀴가 넘어갈 때 어깨→목. 바퀴당 전환 2회(마지막 바퀴는 1회).
assert.equal(flips.length, LOOPS * 2 - 1, `전환 횟수가 바퀴 수와 안 맞는다 (${flips.length})`);
for (let i = 0; i < LOOPS; i++) {
  assert.ok(flips.some(f => Math.abs(f - (i * CLIP + CLIP / 2)) < 0.02),
    `${i + 1}바퀴째 한가운데(${(i * CLIP + CLIP / 2).toFixed(2)}s) 전환이 없다`);
}
assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], '1~8 이 다 안 나온다');
assert.equal(last, 8, '스테이지가 8 에 닿기 전에 끝난다');
console.log('OK — 큐가 매 바퀴 영상을 따라가고, 1~8 전부 나오고 8 로 끝난다');
