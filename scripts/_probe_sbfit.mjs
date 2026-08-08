// 스텝백 발자국 vs 타이틀 알약 — 겹침을 전방거리(m)로 잰다. 검사기가 "런타임이라 못 본다"고 한 그 값.
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message.slice(0,160)));
await p.setViewport({ width:1600, height:900 });
await p.goto('http://127.0.0.1:5199/',{waitUntil:'networkidle2',timeout:120000});
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)',{timeout:60000});
await new Promise(r=>setTimeout(r,6000));
await p.evaluate(()=>document.querySelector('[data-pack=basketball]')?.click());
await new Promise(r=>setTimeout(r,3000));
for(let i=0;i<25;i++){const ok=await p.evaluate(()=>{try{window.__dbg.session.start('basketball');return true;}catch{return false;}});if(ok)break;await new Promise(r=>setTimeout(r,800));}
await new Promise(r=>setTimeout(r,4000));
const STAGE = process.argv[2] || 'BK_B3';
await p.evaluate(id=>{const s=window.__dbg.session; const i=s.stages.findIndex(x=>x.id===id);
  if(i>=0){s.stageIdx=i;s.t=1.2;s._enter?.();}},STAGE);
await new Promise(r=>setTimeout(r,3000));
const out = await p.evaluate(async (id)=>{
  const D=window.__dbg, THREE=D.THREE, rig=D.session.rig, fp=rig._fp;
  const fwd = v => +(fp.oz - v.z).toFixed(3);          // 빔 원점 기준 전방거리(m)
  // 타이틀 알약의 전방거리 — floorgl LAYOUT + 대지 균일 스케일(=_probe_b1mat 와 같은 식)
  const FG = await import('/src/floorgl.js'); const L = FG.LAYOUT;
  const dMid=(rig.fpNear+rig.fpFar)/2, laneW=2*rig._halfAt(dMid), sUni=laneW/1600;
  const boardFwd=(rig.fpFar-0.12)-(1335-176)*sUni;
  const yF = y => +(boardFwd + (1335-y)*sUni).toFixed(3);
  const marks=[]; const v=new THREE.Vector3();
  D.scene.traverse(o=>{ const e=o.userData?.el; if(e?.type==='foot' && o.visible){
    o.getWorldPosition(v); marks.push({side:e.side, d:fwd(v), x:+(v.x-fp.ox).toFixed(3)}); }});
  return { stage:id, fpNear:rig.fpNear, fpFar:rig.fpFar, sUni:+sUni.toFixed(5),
    title:{ HEAD_y:L.HEAD.y, capH:L.CAPHEAD_H, top:yF(L.HEAD.y - L.CAPHEAD_H/2), bot:yF(L.HEAD.y + L.CAPHEAD_H/2) },
    content:{ y0:yF(L.CONTENT_Y0), y1:yF(L.CONTENT_Y1) }, marks };
}, STAGE);
console.log(JSON.stringify(out,null,1));
const t=out.title, ms=out.marks;
// ★ **중심이 아니라 실루엣 끝**으로 잰다. 중심만 보면 검사기가 통과하는데 화면은 겹친다
//   (유저 스샷: SLIDE BACK 알약을 발자국이 뚫고 올라옴). FOOT_LEN_M 0.30 → 반길이 0.15,
//   여기에 마크 블룸(반경 ~0.12)이 더 붙는다.
if (ms.length) { const HALF=0.15, BLOOM=0.12;
  const far=Math.max(...ms.map(m=>m.d)), edge=far+HALF, glow=far+HALF+BLOOM;
  console.log(`\n타이틀 알약 전방 ${t.bot}~${t.top} m`);
  console.log(`가장 먼 발자국 중심 ${far} m · 실루엣 끝 ${edge.toFixed(3)} m · 블룸 끝 ${glow.toFixed(3)} m`);
  console.log(edge >= t.bot ? `✗ 겹친다 — 실루엣이 알약 하단(${t.bot}m)을 ${(edge-t.bot).toFixed(3)}m 침범`
                            : `○ 안 겹친다 (실루엣 여유 ${(t.bot-edge).toFixed(3)}m)`); }
await b.close();
