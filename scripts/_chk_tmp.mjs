import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
await p.goto('http://localhost:5199/?scene=READY',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,10000));
const r = await p.evaluate(async ()=>{
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const s=window.__dbg.session, rows=[];
  for(let i=0;i<700;i++){
    const F=s.readyFeet, U=F[0].plane.material.uniforms;
    rows.push([+((s.t||0)%8).toFixed(2), F[0].group.visible?1:0,
      +F[0].group.position.x.toFixed(3), +F[0].group.scale.x.toFixed(3),
      +U.uFade.value.toFixed(2), +U.uGain.value.toFixed(2)]);
    await wait(25);
  }
  const at=t=>rows.reduce((a,r2)=>Math.abs(r2[0]-t)<Math.abs(a[0]-t)?r2:a, rows[0]);
  return [3.8,4.02,4.15,4.35,4.7,5.5,6.8].map(at);
});
console.log(JSON.stringify(r));
await b.close();
