// 농구 1인칭에서 코치 판이 프레임에 다 들어오는가 — 실측하고, 안 들어오면 값을 푼다.
//   유저 08-07: "농구 1인칭일 때 아래가 너무 잘려서 보이지도 않아."
//   npx vite --port 5199 띄운 상태에서:  node scripts/_grid_bkcoach.mjs
import puppeteer from 'puppeteer';
const URL = process.env.URL || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.setViewport({ width: 1600, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
await new Promise(r => setTimeout(r, 3000));
for (let i=0;i<25;i++){ const ok=await p.evaluate(()=>{try{window.__dbg.session.start('basketball');return true;}catch{return false;}}); if(ok)break; await new Promise(r=>setTimeout(r,800)); }
await new Promise(r => setTimeout(r, 5000));
// 1인칭 강제 + READY 고정
await p.evaluate(() => { const D=window.__dbg; D.setFpMode?.(true); const s=D.session;
  const i=s.stages.findIndex(x=>x.id==='BK_READY'); if(i>=0){s.stageIdx=i;s.t=0.5;s._enter?.();} });
await new Promise(r => setTimeout(r, 3500));

const out = await p.evaluate(() => {
  const D=window.__dbg, THREE=D.THREE, cam=D.camera;
  // 코치 판 찾기 — 이름이 없으면 비디오 텍스처를 든 평면으로 판별
  const C=D.coaches||{};
  let pl = C.BK_READY?.plane || null;
  if(!pl) for(const k in C) if(C[k]?.plane?.visible) { pl=C[k].plane; break; }
  if(!pl) return { err:'코치 판을 못 찾음 — __dbg.coaches 키: '+Object.keys(C).join(',') };
  const g=pl.geometry.parameters;
  const ndc=(obj)=>{ const bb=new THREE.Box3().setFromObject(obj); if(bb.isEmpty())return null;
    const v=[]; for(const X of[bb.min.x,bb.max.x])for(const Y of[bb.min.y,bb.max.y])for(const Z of[bb.min.z,bb.max.z])
      v.push(new THREE.Vector3(X,Y,Z).project(cam));
    return { x:[Math.min(...v.map(a=>a.x)),Math.max(...v.map(a=>a.x))],
             y:[Math.min(...v.map(a=>a.y)),Math.max(...v.map(a=>a.y))] }; };
  const base=ndc(pl);
  const p0=pl.position.clone(), s0=pl.scale.clone();
  // 스윕 ① 판을 뒤로(z 감소 = 더 멀리) ② 축소
  const sweep=[];
  for (const dz of [0,-0.1,-0.2,-0.3,-0.4,-0.5]) {
    for (const k of [1,0.9,0.8,0.7]) {
      pl.position.set(p0.x,p0.y,p0.z+dz); pl.scale.set(s0.x*k,s0.y*k,s0.z*k);
      pl.updateMatrixWorld(true);
      const r=ndc(pl);
      sweep.push({dz,k, y:[+r.y[0].toFixed(3),+r.y[1].toFixed(3)], x:[+r.x[0].toFixed(3),+r.x[1].toFixed(3)],
        fits: r.y[0]>=-1 && r.y[1]<=1 && r.x[0]>=-1 && r.x[1]<=1});
    }
  }
  pl.position.copy(p0); pl.scale.copy(s0); pl.updateMatrixWorld(true);
  return { size:{w:g.width,h:g.height}, pos:[+p0.x.toFixed(3),+p0.y.toFixed(3),+p0.z.toFixed(3)],
    base:{y:[+base.y[0].toFixed(3),+base.y[1].toFixed(3)], x:[+base.x[0].toFixed(3),+base.x[1].toFixed(3)]}, sweep };
});
if (out.err) { console.log(out.err); await b.close(); process.exit(1); }
console.log(`코치 판  ${out.size.w}×${out.size.h}m  위치 (${out.pos})`);
console.log(`현재 NDC  y ${out.base.y[0]} ~ ${out.base.y[1]}   x ${out.base.x[0]} ~ ${out.base.x[1]}`);
console.log(`          (프레임 = ±1. y 하한이 -1 보다 작으면 아래가 잘린 것)\n`);
console.log('dz(뒤로m)  배율   ndcY 하단   상단    프레임');
for (const r of out.sweep)
  console.log(`  ${String(r.dz).padStart(5)}   ${r.k.toFixed(1)}   ${String(r.y[0]).padStart(7)}  ${String(r.y[1]).padStart(6)}    ${r.fits?'○ 다 들어옴':'✗'}`);
const ok=out.sweep.filter(r=>r.fits);
console.log(ok.length ? `\n최소 조정: dz ${ok[0].dz}m · 배율 ${ok[0].k}` : '\n이 범위에선 다 들어오는 조합이 없다 — 시선각을 같이 봐야 한다');
await b.close();
