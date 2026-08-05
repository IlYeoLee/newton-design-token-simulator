import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
await p.goto('http://localhost:5199/?scene=READY',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,10000));
const r = await p.evaluate(async ()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const s=window.__dbg.session, out=[];
  const snap=()=>{const F=s.readyFeet,U=F[0].plane.material.uniforms;
    return {tl:+((s.t||0)%8).toFixed(2),vis:F[0].group.visible,
      x:+F[0].group.position.x.toFixed(3),sc:+F[0].group.scale.x.toFixed(3),
      fade:+U.uFade.value.toFixed(2),gain:+U.uGain.value.toFixed(2)};};
  // 8초 루프를 촘촘히 샘플링해서 등장 구간을 잡는다
  for(let i=0;i<900;i++){ out.push(snap()); await wait(30); }
  const seen=new Map(); for(const o of out){ const k=Math.floor(o.tl*10)/10; if(!seen.has(k)) seen.set(k,o); }
  const pick=[3.8,4.0,4.1,4.3,4.6,5.0,6.5];
  return pick.map(t=>seen.get(t)||seen.get(+(t+0.1).toFixed(1))||null);
});
console.log(JSON.stringify(r));
await b.close();
