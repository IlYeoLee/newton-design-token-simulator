// 관찰 → 따라하기로 넘어갈 때 **투사 범위가 튀는가**(유저 08-07: 비정상적으로 넓어진다).
//   빔 창은 rig 가 매 프레임 다시 계산한다. 관찰 중엔 봇이 idle 로 고정되고(main _clip='idle')
//   따라하기에 들어가면 실제 동작 클립이 돌면서 **무릎 위치·전방 벡터가 바뀐다** —
//   투사기가 무릎에 붙어 있으므로 그게 곧 창의 위치·폭이다. 얼마나 바뀌는지가 이 검수다.
//   하네스 함정은 audit_fp_framing.mjs 머리말 참고(팩 탭 · 리로드 · btn-view).
//   실행: node scripts/audit_beam_jump.mjs [스테이지]
import puppeteer from 'puppeteer';
const STAGE = process.argv[2] || 'BK_B2';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
await p.goto('http://localhost:5199/', { waitUntil:'networkidle2', timeout:60000 });
await p.waitForFunction('!!window.__dbg?.session', { timeout: 60000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,8000));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='농구')?.click());
await p.waitForFunction('!!window.__dbg?.session && !!window.__dbg?.rig', { timeout: 60000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,6000));
await p.evaluate((STAGE) => { const S = window.__dbg.session; S.start('basketball');
  for (let i=0;i<40 && S.stages[S.stageIdx].id!==STAGE;i++) S.next(true); }, STAGE);

const rows = [];
for (let i = 0; i < 26; i++) {
  await new Promise(r=>setTimeout(r,600));
  rows.push(await p.evaluate(() => {
    const D = window.__dbg, S = D.session, R = D.rig, fp = R?._fp;
    return { t: +(S.t||0).toFixed(2), watch: !!S.demoActive, latch: !!S._followLatch,
      near: R?.fpNear, far: R?.fpFar,
      hN: fp ? +R._halfAt(R.fpNear).toFixed(3) : null,
      hF: fp ? +R._halfAt(R.fpFar).toFixed(3) : null,
      ox: fp ? +fp.ox.toFixed(3) : null, oz: fp ? +fp.oz.toFixed(3) : null,
      area: fp ? +(((R._halfAt(R.fpNear) + R._halfAt(R.fpFar)) * (R.fpFar - R.fpNear))).toFixed(3) : null,
      // 내용 폭 — 빔이 안 변해도 **마크가 벌어지면** 화면에선 '투사가 넓어졌다'로 읽힌다.
      //   SB_POSE 실측: 준비 스탠스 0.39m → 착지 스탠스 0.92m (2.4배).
      span: (() => { const g = S.G?.[S.stage]; if (!g) return null;
        let lo = 9, hi = -9;
        g.traverse(o => { if (!o.isMesh) return;
          let v = o, ok = true; while (v) { if (!v.visible) { ok = false; break; } v = v.parent; }
          if (!ok) return;
          const a = o.material?.uniforms?.uFade?.value ?? o.material?.opacity ?? 1;
          if (a < 0.05) return;
          const w = new D.THREE.Vector3(); o.getWorldPosition(w);
          lo = Math.min(lo, w.x); hi = Math.max(hi, w.x); });
        return hi > lo ? +(hi - lo).toFixed(3) : null; })() };
  }));
}
console.log(`\n${STAGE} · 관찰→따라하기 구간 빔 창 추적\n`);
console.log('  t     관찰  래치   반폭N   반폭F   면적    마크폭   판정');
let prev = null;
for (const r of rows) {
  let flag = '';
  if (prev && r.area != null && prev.area != null) {
    const d = r.area - prev.area;
    if (Math.abs(d) > 0.25) flag = `  ★ 면적 ${d > 0 ? '+' : ''}${d.toFixed(2)} 급변`;
    else if (prev.watch && !r.watch) flag = '  ← 따라하기 전환';
  }
  console.log(`  ${String(r.t).padEnd(6)}${String(r.watch).padEnd(6)}${String(r.latch).padEnd(7)}${String(r.hN).padEnd(8)}${String(r.hF).padEnd(8)}${String(r.area).padEnd(8)}${String(r.span).padEnd(9)}${flag}`);
  prev = r;
}
const areas = rows.map(r => r.area).filter(a => a != null);
if (areas.length) {
  const lo = Math.min(...areas), hi = Math.max(...areas);
  console.log(`\n면적 ${lo.toFixed(3)} ~ ${hi.toFixed(3)}  (변동폭 ${(hi - lo).toFixed(3)} = ${((hi/lo - 1)*100).toFixed(0)}%)`);
  console.log(hi / lo > 1.25 ? '★ 투사 범위가 실제로 튄다 — 25% 이상 변한다' : '변동 25% 미만 — 눈에 띄는 튐은 아니다');
}
await b.close();
