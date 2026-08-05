import puppeteer from 'puppeteer';
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
await p.goto('http://localhost:5199/?scene=READY',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,10000));
await p.evaluate(()=>{ window.__o=null; const s=window.__dbg.session, f=window.__dbg.floorGL;
  const id=setInterval(()=>{ const tl=(s.t||0)%8; if(tl>2.5&&tl<7&&!window.__o){
    const cv=f.canvas||f.ctx.canvas, g=cv.getContext('2d'), K=cv.width/1600;
    // 상단 영역 전체에서 '따뜻한' 화소(R>G>B, R>150)를 x 로 묶어 좌→우 색 변화를 본다
    const buckets={};
    for(let y=60;y<=700;y+=3){ const d=g.getImageData(0,Math.round(y*K),cv.width,1).data;
      for(let i=0;i<d.length;i+=4){ if(d[i+3]>170 && d[i]>150 && d[i]>d[i+2]+30){
        const x=Math.round(((i/4)/K)/100)*100; (buckets[x]=buckets[x]||[]).push([d[i],d[i+1],d[i+2]]); } } }
    const avg={}; for(const k in buckets){ const a=buckets[k];
      avg[k]=a.reduce((s2,c)=>[s2[0]+c[0],s2[1]+c[1],s2[2]+c[2]],[0,0,0]).map(v=>Math.round(v/a.length)).join(','); }
    window.__o={tl:+tl.toFixed(2), avg}; clearInterval(id);} },40); });
await new Promise(r=>setTimeout(r,12000));
console.log(JSON.stringify(await p.evaluate(()=>window.__o)));
await b.close();
