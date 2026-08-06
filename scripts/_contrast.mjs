import puppeteer from 'puppeteer';
const b = await puppeteer.launch({protocolTimeout:180000, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false);
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.goto('http://localhost:5199/?scene=BK_B1&cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,12000));
const meas = async (mode) => await p.evaluate(async (mode) => {
  const fx = (await import('/src/fxlut.js')).FXP;
  fx.markBlend = mode; fx.day = (mode === 'ink');
  await new Promise(r=>setTimeout(r, 800));
  const m = window.__sess?.bkB1?.mat;
  const cv = m._prim?._bloomCv || m.material.map?.image;
  const N=cv.width, d=cv.getContext('2d').getImageData(0,0,N,N).data;
  const BG=[0x8B,0x90,0x80], lum=(r,g,bl)=>r*0.299+g*0.587+bl*0.114, bgL=lum(...BG);
  let n=0,sum=0,mx=0,dn=0;
  for(let i=0;i<d.length;i+=4){ const a=d[i+3]/255; if(a<0.06) continue;
    const r=d[i]*a+BG[0]*(1-a), g=d[i+1]*a+BG[1]*(1-a), bl=d[i+2]*a+BG[2]*(1-a);
    const dl=lum(r,g,bl)-bgL; n++; sum+=Math.abs(dl); mx=Math.max(mx,Math.abs(dl)); if(dl<0) dn++; }
  return {평균대비:+(sum/n).toFixed(1), 최대대비:+mx.toFixed(1), 어두운쪽:+(dn/n*100).toFixed(0)+'%'};
}, mode);
console.log('가산(전):', JSON.stringify(await meas('add')));
console.log('잉크(후):', JSON.stringify(await meas('ink')));
console.log('err:', errs.slice(0,1));
await b.close();
