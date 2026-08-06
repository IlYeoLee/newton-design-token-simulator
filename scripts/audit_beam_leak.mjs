// 지면 전수 검수 — 투사면 밖으로 새는 재질을 **이름·부모 사슬까지** 찍는다.
//   ★ 판정 둘로 나눈다:
//     (A) 프래그먼트 페이드 없음 (uFPNear 미보유) = 재질 차원에서 못 막는다 — 진짜 구멍
//     (B) 보유하지만 미주입 = rig._fp 가 null 인 순간 (헤드리스 한정일 수 있음)
//   ★ 그리고 **커지는 것**을 따로 센다: 오브젝트 알파 페이드는 중심만 보므로,
//     반경이 자라는 링/파문은 중심이 빔 안이면 가장자리가 나가도 절대 안 걸린다.
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
await p.goto('http://localhost:5199/', { waitUntil:'networkidle2', timeout:60000 });
await new Promise(r=>setTimeout(r,16000));
const out = await p.evaluate(async () => {
  const S = window.__dbg.session, THREE = window.__dbg.THREE, rows = [];
  const chain = o => { const a = []; let c = o; while (c && a.length < 5) { a.push(c.name || c.type); c = c.parent; } return a.join(' < '); };
  S.start('basketball');
  const seen = new Set();
  for (const want of ['BK_T1','BK_B2','BK_B3','BK_B4','BK_C2']) {
    for (let i=0;i<40 && S.stages[S.stageIdx].id!==want;i++) S.next(true);
    if (S.stages[S.stageIdx].id !== want) continue;
    await new Promise(r=>setTimeout(r,600));
    const roots = [S.root, window.__dbg.tokens?.floorRoot, window.__dbg.effects?.group].filter(Boolean);
    for (const r of roots) r.traverse(o => {
      if (!o.isMesh) return;
      let v = o, ok = true; while (v) { if (!v.visible) { ok = false; break; } v = v.parent; }
      if (!ok) return;
      const m = o.material; if (!m || Array.isArray(m)) return;
      const q = o.getWorldQuaternion(new THREE.Quaternion());
      const up = new THREE.Vector3(0,0,1).applyQuaternion(q);
      if (Math.abs(up.y) <= 0.7) return;                       // 지면(수평) 메시만
      const key = chain(o) + '|' + m.type;
      if (seen.has(key)) return; seen.add(key);
      const U = m.uniforms || {};
      if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const sc = Math.max(...[0,5,10].map(i=>Math.abs(o.matrixWorld.elements[i])));
      rows.push({ stage: want, chain: chain(o), mat: m.type,
        hasFP: !!U.uFPNear, grows: !!(U.uProg || U.uT || U.uRip || U.uPhase),
        radius: +(((o.geometry?.boundingSphere?.radius) ?? 0) * sc).toFixed(2) });
    });
  }
  return rows;
});
const noFP = out.filter(r => !r.hasFP);
console.log(`지면 메시 ${out.length}종 검수\n  프래그먼트 페이드 보유 ${out.length-noFP.length}  ·  **미보유 ${noFP.length}**\n`);
console.log('── 재질에 uFPNear 가 아예 없는 것 (오브젝트 알파로만 막힌다) ──');
for (const r of noFP) console.log(`  ✗ ${r.mat.padEnd(20)} r=${String(r.radius).padEnd(6)} ${r.grows?'[커짐] ':'       '}${r.chain}   [${r.stage}]`);
const grow = out.filter(r => r.grows && !r.hasFP);
console.log(`\n★ 커지면서 프래그먼트 페이드도 없는 것 = 반드시 샌다: ${grow.length}종`);
await b.close();
