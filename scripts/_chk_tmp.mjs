import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await p.goto('http://localhost:5199/?scene=A2',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,12000));
const r = await p.evaluate(()=>{
  const d=window.__dbg, T=d.THREE, s=d.session, P=s.a2press;
  if(!P?.arBack) return {e:'no arrows'};
  const a=P.arBack;
  const probe=(rz)=>{ a.rotation.z=rz; a.updateMatrixWorld(true);
    const bx=new T.Box3().setFromObject(a); const c=bx.getCenter(new T.Vector3());
    return { rz:+rz.toFixed(2), off:[+(c.x-a.position.x).toFixed(3), +(c.z-a.position.z).toFixed(3)],
             size:[+(bx.max.x-bx.min.x).toFixed(3), +(bx.max.z-bx.min.z).toFixed(3)] }; };
  const was=a.rotation.z, wasV=a.visible; a.visible=true;
  const out=[probe(0), probe(Math.PI/2), probe(Math.PI), probe(-Math.PI/2)];
  a.rotation.z=was; a.visible=wasV;
  return { out, feet:{ L:[+P.fmL.group.position.x.toFixed(3),+P.fmL.group.position.z.toFixed(3)],
                       R:[+P.fmR.group.position.x.toFixed(3),+P.fmR.group.position.z.toFixed(3)] },
           arBackPos:[+P.arBack.position.x.toFixed(3),+P.arBack.position.z.toFixed(3)],
           arKneePos:[+P.arKnee.position.x.toFixed(3),+P.arKnee.position.z.toFixed(3)] };
});
console.log(JSON.stringify(r)); console.log('errors:',errs.slice(0,2));
await b.close();
