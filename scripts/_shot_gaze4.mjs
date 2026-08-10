// 실제 토큰을 그 자리에서 확대해 찍는다 — 잘리는 경계가 무엇인지 눈으로 확정.
//   판 네 모서리 화면좌표도 같이 찍어 '판 경계인가'를 숫자로 가른다.
import puppeteer from 'puppeteer';
const W=1100,H=1250;
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({width:W,height:H});
p.on('pageerror', e => console.log('ERR', e.message.slice(0,160)));
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle2', timeout:90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout:90000 });
await new Promise(r=>setTimeout(r,7000));
await p.evaluate(()=>{ document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ window.__dbg.session.start('basketball'); });
await new Promise(r=>setTimeout(r,1500));
await p.evaluate(()=>{ const s=window.__dbg.session; const i=s.stages.findIndex(x=>x.id==='BK_T1'); if(i>=0){s.stageIdx=i;s.t=0;s._enter();} });

await p.evaluate((W,H)=>{
  window.__uvScreen = (co, u, v) => { const T=window.__dbg.THREE;
    const g=co.geometry.parameters; const q=new T.Vector3((u-0.5)*g.width, (v-0.5)*g.height, 0);
    co.localToWorld(q); const s=q.project(window.__cam);
    return [Math.round((s.x*0.5+0.5)*W), Math.round((-s.y*0.5+0.5)*H)]; };
}, W, H);
let hit=null;
await new Promise(r=>setTimeout(r,6000));   // 시선 각도 이징(τ=0.9s) 안정화 — 안 기다리면 프레이밍이 거짓말한다
for (let i=0;i<50;i++){
  await new Promise(r=>setTimeout(r,200));
  hit = await p.evaluate(()=>{ let co=null; window.__scene.traverse(o=>{ if(o.material?.uniforms?.uGaze && o.visible) co=o; });
    if(!co) return null; const g=co.material.uniforms.uGaze.value; if(g.z<=0.03) return null;
    return { g:[+g.x.toFixed(3),+g.y.toFixed(3),+g.z.toFixed(3),+g.w.toFixed(3)],
      c: window.__uvScreen(co,g.x,g.y),
      corners: [[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>window.__uvScreen(co,u,v)),
      edge: { L: window.__uvScreen(co, g.x-g.z, g.y), R: window.__uvScreen(co, g.x+g.z, g.y),
              D: window.__uvScreen(co, g.x, g.y-g.w), U: window.__uvScreen(co, g.x, g.y+g.w) } }; });
  if (hit) break;
}
if(!hit){ console.log('토큰 켜진 프레임 못 잡음'); await b.close(); process.exit(1); }
console.log('uGaze', hit.g);
console.log('중심 화면', hit.c, '· 좌우', hit.edge.L, hit.edge.R, '· 아래위', hit.edge.D, hit.edge.U);
console.log('판 네 모서리 (uv 00,10,11,01)', JSON.stringify(hit.corners));
const [cx,cy]=hit.c, R=110;
await p.screenshot({ path:'scratch_g4.png', clip:{ x:Math.max(0,cx-R), y:Math.max(0,cy-R), width:2*R, height:2*R } });
await b.close();
