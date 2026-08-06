import puppeteer from 'puppeteer';
const b = await puppeteer.launch({protocolTimeout:180000, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setCacheEnabled(false);
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.goto('http://localhost:5199/?scene=BK_B1&cb='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,11000));
console.log(await p.evaluate(async () => {
  const fx = await import('/src/fx-core.js');
  const { lutColor, FXP } = await import('/src/fxlut.js');
  const P = window.__sess?.bkB1?.mat?._prim?.P;
  if (!P) return 'no P';
  const meas = (day) => {
    const N=512, c=document.createElement('canvas'); c.width=c.height=N;
    const g=c.getContext('2d');
    fx.drawDribbleMat(g, N, P, { halo: 1 }, 3.0, { lut: lutColor, arrow: FXP.arrow, day });
    const d=g.getImageData(0,0,N,N).data;
    const BG=[0x8B,0x90,0x80], lum=(r,gg,bl)=>r*0.299+gg*0.587+bl*0.114, bgL=lum(...BG);
    let n=0,sum=0,mx=0,dn=0;
    for(let i=0;i<d.length;i+=4){ const a=d[i+3]/255; if(a<0.06) continue;
      const r=d[i]*a+BG[0]*(1-a), gg=d[i+1]*a+BG[1]*(1-a), bl=d[i+2]*a+BG[2]*(1-a);
      const dl=lum(r,gg,bl)-bgL; n++; sum+=Math.abs(dl); mx=Math.max(mx,Math.abs(dl)); if(dl<0) dn++; }
    return { 잉크화소:n, 평균대비:+(sum/n).toFixed(1), 최대대비:+mx.toFixed(1), 어두운쪽:+(dn/n*100).toFixed(0)+'%' };
  };
  return JSON.stringify({ 밤_day0: meas(0), 낮_day1: meas(1) }, null, 1);
}));
console.log('err:', errs.slice(0,1));
await b.close();
