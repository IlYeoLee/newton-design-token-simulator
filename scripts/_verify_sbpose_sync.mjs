// SB_POSE ↔ 봇 발 동기 검증 — 같은 stepVidT 에서 마크(sbPoseAt)와 봇 발(getProbes)을 나란히
//   찍어 상관을 잰다. 마크가 봇의 실제 발에서 재생성됐다면(_probe_sbfeet → SB_POSE) 상관은
//   u↔x · v↔z 모두 +0.9 대여야 한다. 틀어지면 좌표 부호나 표가 다시 갈린 것.
//   실행: 5199 띄운 채 `node scripts/_verify_sbpose_sync.mjs`
import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1000, height: 800 });
let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message.slice(0, 160)); });
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 90000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => window.__dbg.session.start('basketball'));
await new Promise(r => setTimeout(r, 1200));

await p.evaluate(async () => {
  window.__sess = await import('/src/session.js');
  const s = window.__dbg.session;
  const i = s.stages.findIndex(x => x.id === 'BK_T1');
  if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); }
  clearInterval(window.__pin);
  window.__pin = setInterval(() => { s._followLatch = true; s._aWatchEnd = 0; }, 50);
  window.__rec = [];
  clearInterval(window.__recT);
  window.__recT = setInterval(() => {
    const X = window.__dbg.xbot, S = window.__dbg.session, pr = X.getProbes?.();
    if (!pr || !pr.hips) return;
    const vt = S.stepVidT ?? 0;
    const P = window.__sess.sbPoseAt(vt, false);
    window.__rec.push({
      vt: +vt.toFixed(3),
      mLu: P.L?.u ?? P.u, // sbPoseAt 반환형 확인용 — 아래서 정리
      pose: { Lu: window.__sess.sbPoseAt(vt, false), },
      lx: pr.footL.x - pr.hips.x, lz: pr.footL.z - pr.hips.z,
      rx: pr.footR.x - pr.hips.x, rz: pr.footR.z - pr.hips.z,
    });
  }, 40);
});
await new Promise(r => setTimeout(r, 12000));
const raw = await p.evaluate(() => {
  clearInterval(window.__recT);
  // sbPoseAt 는 {u,v,...} 를 side 별로 만든다 — 원형 그대로 다시 뽑는다
  return window.__rec.map(s => {
    const L = window.__sess.sbPoseAt(s.vt, false);
    return { vt: s.vt, lx: s.lx, lz: s.lz, rx: s.rx, rz: s.rz };
  });
});
// sbPoseAt 반환 구조를 페이지에서 한 번 확인
const shape = await p.evaluate(() => JSON.stringify(Object.keys(window.__sess.sbPoseAt(1.6, false))));
const marks = await p.evaluate(() => {
  const out = [];
  for (let vt = 1.05; vt <= 2.2 + 1e-6; vt += 0.05) {
    const m = window.__sess.sbPoseAt(vt, false);
    out.push({ vt: +vt.toFixed(2), Lu: m.L.u, Lv: m.L.v, Ru: m.R.u, Rv: m.R.v });
  }
  return out;
});
await b.close();

const corr = (A, B) => {
  const n = Math.min(A.length, B.length);
  const ma = A.reduce((s, v) => s + v, 0) / n, mb = B.reduce((s, v) => s + v, 0) / n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const a = A[i] - ma, b2 = B[i] - mb; sa += a * a; sb += b2 * b2; sab += a * b2; }
  return sab / Math.sqrt(sa * sb || 1);
};
// 봇 샘플을 0.05 격자로 접고 마크 격자와 짝 맞춤
const bin = new Map();
for (const s of raw) {
  const k = Math.round(s.vt * 20) / 20;
  const a = bin.get(k) || { n: 0, lx: 0, lz: 0, rx: 0, rz: 0 };
  a.n++; a.lx += s.lx; a.lz += s.lz; a.rx += s.rx; a.rz += s.rz; bin.set(k, a);
}
const pairs = marks.map(m => { const b2 = bin.get(m.vt); return b2 ? { m, b: { lx: b2.lx / b2.n, lz: b2.lz / b2.n, rx: b2.rx / b2.n, rz: b2.rz / b2.n } } : null; }).filter(Boolean);
console.log(`sbPoseAt 반환 키: ${shape}`);
console.log(`짝 샘플 ${pairs.length} · 페이지에러 ${errs}`);
console.log(`상관  L.v↔발L.z  ${corr(pairs.map(p2 => p2.m.Lv), pairs.map(p2 => p2.b.lz)).toFixed(3)}`);
console.log(`상관  R.v↔발R.z  ${corr(pairs.map(p2 => p2.m.Rv), pairs.map(p2 => p2.b.rz)).toFixed(3)}`);
console.log(`상관  L.u↔발L.x  ${corr(pairs.map(p2 => p2.m.Lu), pairs.map(p2 => p2.b.lx)).toFixed(3)}`);
console.log(`상관  R.u↔발R.x  ${corr(pairs.map(p2 => p2.m.Ru), pairs.map(p2 => p2.b.rx)).toFixed(3)}`);
