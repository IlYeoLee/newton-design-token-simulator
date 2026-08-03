// 타이머 씬(BX_C1) 미리보기 검증.
//   ① 카운트다운이 3 → 2 → 1 → GO 로 다 나온다
//   ② 링 게이지가 100% 까지 찬다(예전엔 dur 에 닿는 순간 다음 씬으로 넘어가 못 봤다)
//   ③ 씬 고정 중에는 session.next() 가 스테이지를 넘기지 않는다 — 넘긴 뒤 되돌리면
//      그 사이 한 프레임이 다음 씬으로 그려져 인물·링이 비친다(유저).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

// ③ 은 소스 순서로 본다 — 못(pinStage) 검사가 stageIdx++ 보다 **앞**에 있어야 의미가 있다.
const sess = readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
const pin = sess.indexOf('if (this.pinStage) return;');
const adv = sess.indexOf('this.stageIdx++; this.t = 0; this._enter();');
assert.ok(pin > 0, 'next() 에 pinStage 가드가 없다');
assert.ok(pin < adv, 'pinStage 가드가 stageIdx++ 뒤에 있다 — 막지 못한다');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
assert.ok(/session\.pinStage = S\.scene/.test(main), '씬 고정 시 못을 박는 곳이 없다');

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:5199/scenes.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

const out = await p.evaluate(async () => {
  const { WallGL } = await import('/src/wallgl.js');
  const w = new WallGL();
  const DUR = 3;
  w.load('BX_C1', { dur: DUR, src: 'ready-view/timer.html' });
  const seq = [], errs = [];
  let ringMax = 0;
  for (let t = 0; t <= 8; t += 0.05) {
    w.t = t;
    try { w._paint(); } catch (e) { errs.push(`t=${t.toFixed(2)} ${e.message}`); break; }
    const rem = DUR - t, val = rem > 0.05 ? String(Math.ceil(rem)) : 'GO';
    ringMax = Math.max(ringMax, Math.min(1, t / DUR));
    if (val !== seq[seq.length - 1]?.v) seq.push({ t: +t.toFixed(2), v: val });
  }
  return { kind: w.kind, seq, errs, ringMax };
});

console.log('kind =', out.kind);
console.log('errors =', out.errs.length ? out.errs : 'none');
console.log('카운트:', out.seq.map(s => `${s.v}@${s.t}s`).join('  '));
console.log('링 최대:', (out.ringMax * 100).toFixed(0) + '%');

assert.equal(out.kind, 'timer', '타이머 UI 로 안 들어갔다');
assert.equal(out.errs.length, 0, '렌더 예외: ' + out.errs.join(' | '));
assert.deepEqual(out.seq.map(s => s.v), ['3', '2', '1', 'GO'], '3·2·1·GO 가 다 안 나온다');
assert.ok(out.ringMax >= 0.999, `링이 100% 까지 안 찬다 (${out.ringMax})`);
console.log('OK — 3·2·1·GO 전부, 링 100%, 씬 고정 중 스테이지 이동 없음');
await b.close();
