// 타이틀 알약이 **빔 안**에 있는가 — 종목·스테이지별 실측.
//   대지는 빔보다 멀리 뻗는다(far 쪽). 대지 안이라고 안전한 게 아니다 — 잘림은 빔 경계에서 난다.
//   canvasY → 메시 로컬(1335-y) → 월드 → 풋프린트 전방거리 d. d > fpFar 면 그만큼 잘린다.
import puppeteer from 'puppeteer';
const RUN = ['READY','A1','A2','A3'];
const BK  = ['BK_READY','BK_A1','BK_A2','BK_T1','BK_B1','BK_B2','BK_B3','BK_B4','BK_C2'];
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:1000,height:820});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
const fails = [];
for (const [pack, ids] of [['basketball', BK], ['running', RUN]]) {
  await p.evaluate((pk)=>{ document.querySelector(`[data-pack=${pk}]`)?.click(); }, pack);
  await new Promise(r=>setTimeout(r,2500));
  await p.evaluate((pk)=>{ window.__dbg.session.start(pk); }, pack);
  await new Promise(r=>setTimeout(r,2000));
  console.log(`\n${pack}`);
  for (const id of ids) {
    await p.evaluate((id)=>{ const s=window.__dbg.session; const i=s.stages.findIndex(x=>x.id===id); if(i<0) return; s.stageIdx=i; s.t=0; s._enter(); }, id);
    await new Promise(r=>setTimeout(r,2200));
    const r = await p.evaluate(async ()=>{
      const M = await import('/src/floorgl.js');
      const D = window.__dbg, R = D.rig, mesh = D.floorGL?.mesh, THREE = D.THREE;
      if (!mesh || !mesh.visible || !R._fp) return null;
      const fp = R._fp, v = new THREE.Vector3();
      // canvasY → 풋프린트 전방거리(m)
      const dAt = (cy) => { v.set(0, 1335 - cy, 0); mesh.localToWorld(v);
        return (v.x - fp.ox) * fp.fx + (v.z - fp.oz) * fp.fz; };
      const top = M.TOK.headY, bot = M.TOK.headY + M.LAYOUT.CAPHEAD_H;
      return { headY: top, botY: bot, dTop: +dAt(top).toFixed(3), dBot: +dAt(bot).toFixed(3),
        d0: +dAt(0).toFixed(3), near: R.fpNear, far: R.fpFar };
    });
    if (!r) { console.log(`   --   ${id.padEnd(10)} 대지 없음(건너뜀)`); continue; }
    const over = r.dTop - r.far;               // 알약 위끝이 빔 far 를 넘은 양(m)
    const ok = over <= 0;
    if (!ok) fails.push(`${id} 알약 위끝이 빔 밖 ${(over*100).toFixed(1)}cm`);
    console.log(`   ${ok?'ok':'✗ '}   ${id.padEnd(10)} 알약 y${r.headY}~${r.botY} → d ${r.dTop}~${r.dBot}m · 빔 far ${r.far}m · 여유 ${(-over*100).toFixed(1)}cm  (대지 far끝 d ${r.d0}m)`);
  }
}
await b.close();
console.log('\n' + '─'.repeat(64));
if (fails.length) { console.log('실패:\n  · ' + fails.join('\n  · ')); process.exit(1); }
console.log('통과 — 타이틀 알약이 전부 빔 안에 있다');
