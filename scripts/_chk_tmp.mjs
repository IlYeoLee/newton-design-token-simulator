import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
await p.goto('http://localhost:5199/?scene=A2',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,14000));
const r = await p.evaluate(()=>{
  const s=window.__dbg.session, P=s.a2press;
  const g=m=>{const U=m.uniforms;const o={};
    for(const x of ['uHalo','uImpGlow','uFillOp','uEdgeShade','uImpDot','uEdgeSoft','uDither']) o[x]=+(U[x]?.value??-1).toFixed(3);
    return o;};
  return { A2_floor:g(P.fmL.plane.material), A3_base: s.a3hk? g(s.a3hk.fmL.plane.material):null };
});
console.log(JSON.stringify(r,null,0)); console.log('errors:',errs.slice(0,2));
await b.close();
