// 농구 발마크가 **타이틀 알약을 침범하는가** — 유저 강제규칙(08-09)의 감시기.
//   같은 자로 잰다: 마크 월드좌표 → floorGL.mesh 로컬(px) → canvasY = 1335 - localY.
//   알약 밴드 = TOK.headY ~ headY + LAYOUT.CAPHEAD_H (canvasY 작을수록 먼 쪽 = 화면 위).
//   실행: npm run dev 를 띄운 뒤  node scripts/check_title_clear.mjs   (통과 exit 0)
//   상한 자체는 session.js `_uiCapV` 가 대지 조판에서 파생한다 — 여기선 결과만 확인한다.
//   고침 전 실측(08-09): 잉크 앞끝 y426~452 → 알약(y200~516)을 64~90px 먹고 있었다.
import puppeteer from 'puppeteer';
const fails = [];
const STAGES = { BK_T1: [0, 3.10], BK_B2: [0, 0.60], BK_B3: [0, 1.44], BK_B4: [0, 1.81], BK_C2: [0, 3.10] };
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => { document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => { window.__dbg.session.start('basketball'); });
await new Promise(r => setTimeout(r, 1500));

const info = await p.evaluate(async () => {
  const M = await import('/src/floorgl.js'); window.__fg = M;
  const D = window.__dbg, R = D.rig, mesh = D.floorGL?.mesh, THREE = D.THREE;
  const v = new THREE.Vector3();
  // 빔 창 far 끝(월드) → canvasY
  const fp = R._fp, M2 = 0.18;
  const dFar = R.fpNear + M2 + (R.fpFar - R.fpNear - M2 * 2) * 1;
  const dNear = R.fpNear + M2;
  const cy = d => { v.set(fp.ox, 0.012, fp.oz - d); mesh.worldToLocal(v); return Math.round(1335 - v.y); };
  return { fpNear: R.fpNear, fpFar: R.fpFar, dNear: +dNear.toFixed(3), dFar: +dFar.toFixed(3),
    cyNear: cy(dNear), cyFar: cy(dFar), cy1: cy(1.0), cy15: cy(1.5),
    headY: M.TOK.headY, capH: M.LAYOUT.CAPHEAD_H, contentY0: Math.round(M.LAYOUT.CONTENT_Y0) };
});
console.log('빔/대지:', info);
console.log('  → 알약 하단 canvasY', info.headY + info.capH, '· 픽셀당 m =', ((info.dFar - info.dNear) / (info.cyNear - info.cyFar)).toFixed(5));

for (const [id, [a, z]] of Object.entries(STAGES)) {
  await p.evaluate(({ id, a, z }) => {
    const s = window.__dbg.session;
    const i = s.stages.findIndex(x => x.id === id); if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); }
    clearInterval(window.__vtPin);
    const t0 = performance.now();
    window.__vtPin = setInterval(() => {
      s.stepVidT = a + ((performance.now() - t0) / 1000 * 0.5) % Math.max(0.01, z - a);
      s._followLatch = true; s._aWatchEnd = 0;
    }, 8);
    window.__samp = [];
    clearInterval(window.__sampT);
    window.__sampT = setInterval(() => {
      const D = window.__dbg, S = D.session, THREE = D.THREE, mesh = D.floorGL?.mesh, R = D.rig;
      const H = { BK_T1: S.bkT1x, BK_B2: S.bkB2x, BK_B3: S.bkB3x, BK_B4: S.bkB4x, BK_C2: S.bkC2x }[id];
      if (!H || !mesh) return;
      const v = new THREE.Vector3(), wp = new THREE.Vector3();
      const RV = 0.165;   // SB_FIT_V — 발 잉크 앞뒤 반경
      for (const k of ['fLl', 'fLr', 'fRl', 'fRr', 'fC', 'sL2', 'sR2', 'cL', 'cR', 'gh']) {
        const fm = H[k]; if (!fm?.group) continue;
        const al = fm.plane?.material?.uniforms?.uFade?.value ?? 1;
        if (al < 0.06) continue;
        fm.group.getWorldPosition(wp);
        const d = R._fp.oz - wp.z;                      // 전방 거리(월드)
        v.copy(wp); v.y = 0.012; mesh.worldToLocal(v);
        const cyC = 1335 - v.y;
        v.set(wp.x, 0.012, wp.z - RV); mesh.worldToLocal(v);
        const cyF = 1335 - v.y;
        window.__samp.push({ k, d: +d.toFixed(3), cyC: Math.round(cyC), cyF: Math.round(cyF), al: +al.toFixed(2) });
      }
    }, 60);
  }, { id, a, z });
  await new Promise(r => setTimeout(r, (z - a) / 0.5 * 1000 + 1200));
  const out = await p.evaluate(() => {
    clearInterval(window.__sampT); clearInterval(window.__vtPin);
    const s = window.__samp || []; if (!s.length) return null;
    const byK = {};
    for (const r of s) { const q = byK[r.k] || (byK[r.k] = { k: r.k, cyF: 1e9, cyC: 1e9, d: 0 }); if (r.cyF < q.cyF) { q.cyF = r.cyF; q.cyC = r.cyC; q.d = r.d; } }
    return Object.values(byK).sort((x, y) => x.cyF - y.cyF);
  });
  const pillBot = info.headY + info.capH;
  console.log(`\n${id}`);
  if (out) for (const w of out) {
    const bad = w.cyF < pillBot;
    if (bad) fails.push(`${id} ${w.k}: 잉크 앞끝 y${w.cyF} — 알약 하단(y${pillBot})을 ${pillBot - w.cyF}px 침범`);
    console.log(`   ${w.k.padEnd(4)} d ${w.d}m · 중심 y${w.cyC} · 잉크앞끝 y${w.cyF}` + (bad ? `   ← 알약(≤${pillBot}) 침범 ${pillBot - w.cyF}px` : '   ok'));
  }
}
await b.close();
console.log('\n' + '─'.repeat(64));
if (fails.length) {
  console.log('실패 ' + fails.length + '건 — 발이 타이틀을 먹는다');
  fails.forEach(f => console.log('  ✗ ' + f));
  console.log('\n상한은 session.js `_uiCapV` 가 대지 조판에서 파생한다. 마크를 손으로 옮기지 말 것.');
  process.exit(1);
}
console.log('통과 — 농구 발마크가 타이틀 알약을 침범하지 않는다');
