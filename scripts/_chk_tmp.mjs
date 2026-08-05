import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
await p.goto('http://localhost:5199/?scene=READY',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,10000));
const r = await p.evaluate(async ()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const s=window.__dbg.session;
  const snap=()=>{const F=s.readyFeet;const U=F[0].plane.material.uniforms;
    return { tl:+((s.t||0)%8).toFixed(2), vis:F[0].group.visible,
      x:+F[0].group.position.x.toFixed(3), x2:+F[1].group.position.x.toFixed(3),
      sc:+F[0].group.scale.x.toFixed(3), fade:+U.uFade.value.toFixed(2), gain:+U.uGain.value.toFixed(2) };};
  const out=[];
  for (const [lo,hi] of [[3.5,3.9],[4.05,4.2],[4.35,4.5],[5.0,5.4],[6.5,7.0]]) {
    for(let i=0;i<2500;i++){ const tl=(s.t||0)%8; if(tl>lo&&tl<hi) break; await wait(12); }
    out.push(snap());
  }
  return out;
});
console.log(JSON.stringify(r)); console.log('errors:',errs.slice(0,3));
await b.close();
