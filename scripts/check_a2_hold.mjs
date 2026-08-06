// A2 링이 실제로 도는가 — "타이머가 3 에서 멈춰 있다"(유저 08-06)의 회귀 검사.
//
//   버그였던 식:  hp = cyc?.inHold ? clamp01(cyc.prog) : 0
//   0 은 '홀드 막 시작' 이라 링이 3 으로 되돌아간다. inHold 가 true 인 건 사이클 5.7s 중
//   3.0s 뿐이고, 나머지 2.7s + 관찰 5.8s 가 전부 3 이었다 — 즉 대부분의 시간이 '3'.
//
//   여기서 main.js A2 사이클을 그대로 재현해 링 값 수열을 뽑고, 두 가지를 증명한다:
//     ① 홀드 구간에서 3 → 2 → 1 로 **실제로 내려간다**
//     ② 홀드 밖에서 3 으로 **되돌아가지 않는다**
//   그리고 값이 없는 상태(관찰·세션 없음)에서 숫자를 지어내지 않는지도 본다.
//
//   실행: node scripts/check_a2_hold.mjs   (통과 exit 0)

import assert from 'assert';
import { a2Hold, a2Rem } from '../src/a2hold.js';

// main.js:4370 과 같은 값 — 바뀌면 여기도 같이 바뀌어야 한다(그래서 값을 여기 적는다).
const T0 = 5.4, TD = 6.5, T1 = 8.1, HOLD = 3.0;
const DESC = TD - T0, RISE = T1 - TD, CYC = DESC + HOLD + RISE;

/** main.js:4387 이 채우는 a2Cyc 를 그대로 만든다. */
const cycAt = tt => {
  const c = tt % CYC;
  return { inHold: c >= DESC && c < DESC + HOLD,
           prog: Math.max(0, Math.min(1, (c - DESC) / HOLD)),
           descending: c < DESC, holdSec: HOLD };
};

const ringAt = tt => { const hp = a2Hold(cycAt(tt)); return hp == null ? null : a2Rem(hp); };

const fails = [];
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); }
  catch (e) { fails.push(name + ' — ' + e.message); console.log('  ✗ ' + name); } };

console.log(`A2 사이클 ${CYC.toFixed(1)}s = 하강 ${DESC.toFixed(1)} + 홀드 ${HOLD} + 상승 ${RISE.toFixed(1)}\n`);

check('홀드 구간에서 3 → 2 → 1 로 내려간다', () => {
  const seq = [0.1, 1.1, 2.1, 2.9].map(d => ringAt(DESC + d));
  assert.deepStrictEqual(seq, ['3', '2', '1', '1'], '실제: ' + JSON.stringify(seq));
});

check('상승 구간에서 3 으로 되돌아가지 않는다', () => {
  for (let d = 0.05; d < RISE; d += 0.1) {
    const v = ringAt(DESC + HOLD + d);
    assert.strictEqual(v, '1', `상승 +${d.toFixed(2)}s 에서 '${v}' — 홀드는 이미 끝났다`);
  }
});

check('하강 구간은 3 (아직 안 눌렀다)', () => {
  assert.strictEqual(ringAt(0.05), '3');
  assert.strictEqual(ringAt(DESC - 0.05), '3');
});

check('한 사이클에서 3 이 아닌 값이 과반이다', () => {
  let n = 0, three = 0;
  for (let tt = 0; tt < CYC; tt += 0.05) { n++; if (ringAt(tt) === '3') three++; }
  const pct = three / n;
  // 버그 때는 하강+상승(2.7s/5.7s = 47%)에 더해 홀드 앞부분까지 3 이라 과반이었다.
  assert.ok(pct < 0.5, `3 인 시간이 ${(pct * 100).toFixed(0)}% — 절반을 넘으면 '멈춰 있다'로 보인다`);
});

check('관찰 구간엔 값이 없다 (홀드 카운트를 띄우지 않는다)', () => {
  assert.strictEqual(a2Hold({ watching: true, holdSec: HOLD, watchProg: .4 }), null);
});

check('세션이 없으면 숫자를 지어내지 않는다 (갤러리·익스포터)', () => {
  assert.strictEqual(a2Hold(null), null);
  assert.strictEqual(a2Hold(undefined), null);
});

// ── 값이 맞아도 **그릴 그릇이 없으면** 화면은 그대로다 ──────────────────────────
//   실제로 그랬다: ADV.A2='time' → showRing false → 링이 접혀 사라지는데, 그 사라진
//   링에 3·2·1 을 하드코딩해 넣고 있었다. 두 결정이 서로를 무효화한 것이라, 값 검사만
//   통과시키면 같은 사고가 또 난다. 소스에서 직접 읽어 확인한다.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/floorgl.js'), 'utf8');

check('A2 링이 켜져 있다 (ADV.A2 가 showRing 목록 안)', () => {
  const m = SRC.match(/A1:\s*'time',\s*A2:\s*'(\w+)'/);
  assert.ok(m, 'ADV 표에서 A2 를 못 찾았다');
  assert.ok(['segment', 'hold', 'reps'].includes(m[1]),
    `ADV.A2 = '${m[1]}' → showRing false → 링이 접혀 사라진다. 3·2·1 을 계산해도 안 보인다`);
});

console.log('\n' + '─'.repeat(60));
if (fails.length) {
  console.log('\n실패 ' + fails.length + '건');
  fails.forEach(f => console.log('  ✗ ' + f));
  console.log('\n근거: src/a2hold.js');
  process.exit(1);
}
console.log('\n통과 — A2 링이 돈다');
