// 스텝백 발 궤적 실측 — 정본 클립(cmu124_06)이 실제로 그리는 발 좌표를 **힙 기준**으로 뽑는다.
//   왜 힙 기준인가: 가이드 마크는 화면 고정 박스 안에 그려지므로, 봇이 월드에서 얼마나
//   이동했는지가 아니라 '몸에 대해 발이 어디로 가는가'가 안무다. 루트 이동은 카메라·대지가 먹는다.
//   출력: 가이드 시각(stepVidT) · 힙기준 발L/발R (x=좌우, z=앞뒤, 미터) · 스탠스 폭 · 깊이 스팬.
//   쓰는 곳: session.js SB_POSE 재저작 근거. **좌표를 손으로 적지 말 것 — 이 표에서 나온다.**
//   실행: 5199 띄운 채 `node scripts/_probe_sbfeet.mjs [스테이지ID]`
import puppeteer from 'puppeteer';

const STAGE = process.argv[2] || 'BK_C2';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1000, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 90000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => window.__dbg.session.start('basketball'));
await new Promise(r => setTimeout(r, 1200));

await p.evaluate((id) => {
  const s = window.__dbg.session;
  const i = s.stages.findIndex(x => x.id === id);
  if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); }
  clearInterval(window.__pin);
  window.__pin = setInterval(() => { s._followLatch = true; s._aWatchEnd = 0; }, 50);   // 관찰 건너뛰고 따라하기로
  window.__rec = [];
  clearInterval(window.__recT);
  window.__recT = setInterval(() => {
    const X = window.__dbg.xbot, S = window.__dbg.session, pr = X.getProbes?.();
    if (!pr || !pr.hips || !pr.footL || !pr.footR) return;
    window.__rec.push({
      vt: +(S.stepVidT ?? 0).toFixed(3),
      lx: +(pr.footL.x - pr.hips.x).toFixed(4), lz: +(pr.footL.z - pr.hips.z).toFixed(4),
      rx: +(pr.footR.x - pr.hips.x).toFixed(4), rz: +(pr.footR.z - pr.hips.z).toFixed(4),
      hx: +pr.hips.x.toFixed(4), hz: +pr.hips.z.toFixed(4),      // 루트 이동(월드) — 클립이 도는지
      clip: X._clipName || X.clip || '?', mt: +((X._mixer?.time) ?? -1).toFixed(2),
    });
  }, 40);
}, STAGE);

await new Promise(r => setTimeout(r, 14000));
const rec = await p.evaluate(() => { clearInterval(window.__recT); return window.__rec; });
await b.close();

if (!rec.length) { console.log('샘플 0 — 스테이지/클립 확인 필요'); process.exit(1); }

// 가이드 시각별로 접어서(같은 vt 는 평균) 안무 한 바퀴를 만든다
const bin = new Map();
for (const s of rec) {
  const k = Math.round(s.vt * 20) / 20;                 // 0.05s 격자
  const a = bin.get(k) || { n: 0, lx: 0, lz: 0, rx: 0, rz: 0 };
  a.n++; a.lx += s.lx; a.lz += s.lz; a.rx += s.rx; a.rz += s.rz;
  bin.set(k, a);
}
const rows = [...bin.entries()].sort((a, b2) => a[0] - b2[0])
  .map(([k, a]) => ({ vt: k, lx: a.lx / a.n, lz: a.lz / a.n, rx: a.rx / a.n, rz: a.rz / a.n }));

const span = (arr) => Math.max(...arr) - Math.min(...arr);
console.log(`\n스테이지 ${STAGE} · 샘플 ${rec.length} · 격자 ${rows.length}\n`);
console.log('  vt     L(x,z)              R(x,z)              스탠스폭  깊이차');
for (const r of rows) {
  console.log(`  ${r.vt.toFixed(2)}   (${r.lx.toFixed(3)},${r.lz.toFixed(3)})   (${r.rx.toFixed(3)},${r.rz.toFixed(3)})   ` +
    `${Math.abs(r.rx - r.lx).toFixed(3)}     ${Math.abs(r.rz - r.lz).toFixed(3)}`);
}
const uniqClips = [...new Set(rec.map(r => r.clip))];
const mtSpan = span(rec.map(r => r.mt));
console.log(`\n── 구동 상태 ──`);
console.log(`  클립: ${uniqClips.join(', ')}   믹서시간 스팬 ${mtSpan.toFixed(2)}s   ` +
  `루트이동 x ${span(rec.map(r => r.hx)).toFixed(3)}m  z ${span(rec.map(r => r.hz)).toFixed(3)}m`);
console.log('\n── 스팬(안무 크기) ──');
console.log(`  L  x ${span(rows.map(r => r.lx)).toFixed(3)}m   z ${span(rows.map(r => r.lz)).toFixed(3)}m`);
console.log(`  R  x ${span(rows.map(r => r.rx)).toFixed(3)}m   z ${span(rows.map(r => r.rz)).toFixed(3)}m`);
console.log(`  가로:세로 종횡비 = ${(span([...rows.map(r => r.lx), ...rows.map(r => r.rx)]) / span([...rows.map(r => r.lz), ...rows.map(r => r.rz)])).toFixed(3)}`);
console.log('  → SB_POSE 는 이 종횡비를 **등비로** 보존해야 안무 모양이 산다(축마다 다른 게인 금지).\n');
