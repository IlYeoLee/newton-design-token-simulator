// YOU 카운터 검증 — 씬 UI를 t 를 밀어가며 실제로 그려보고,
//   ① 렌더가 안 터지는지 ② YOU 숫자가 0 → 8 로 한 회씩 오르는지 확인한다.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:5199/scenes.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

const out = await p.evaluate(async () => {
  const { WallGL } = await import('/src/wallgl.js');
  const w = new WallGL();
  // dur 은 BX_A1 스테이지 실값(= 코치 클립 길이)과 같아야 한다 — 여기가 8 로 남아 있던
  //   동안 벽 카운터는 8s 로 페이싱하고 스테이지는 5.6s 에 끊겨 8 에 못 닿았다.
  w.load('BX_A1', { dur: 6.04, src: 'ready-view/scene.html' });
  // 씬 UI 가 맞는지
  const kind = w.kind;
  const seq = [], errs = [];
  for (let t = 0; t <= 6.041; t += 0.05) {
    w.t = t;
    try { w._paint(); } catch (e) { errs.push(`t=${t.toFixed(2)} ${e.message}`); break; }
    if (w._youLast !== seq[seq.length - 1]?.v) seq.push({ t: +t.toFixed(2), v: w._youLast });
  }
  return { kind, seq, errs };
});

console.log('kind =', out.kind);
console.log('errors =', out.errs.length ? out.errs : 'none');
console.log('YOU 스텝:', out.seq.map(s => `${s.v}@${s.t}s`).join('  '));

assert.equal(out.kind, 'scene', '씬 UI 로 안 들어갔다');
assert.equal(out.errs.length, 0, '렌더 예외: ' + out.errs.join(' | '));
const vals = out.seq.map(s => Number(s.v));
assert.deepEqual(vals, [0, 1, 2, 3, 4, 5, 6, 7, 8], 'YOU 가 0→8 로 한 회씩 오르지 않는다: ' + vals);
console.log('OK — 0 으로 등장해 8 까지 한 회씩, 예외 없음');
await b.close();
