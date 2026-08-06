import puppeteer from 'puppeteer';
const ST=process.env.ST;
const b=await puppeteer.launch({headless:'new',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const p=await b.newPage(); await p.setViewport({width:1400,height:800});
await p.goto(`http://127.0.0.1:5199/?fxq=1&scene=${ST}`,{waitUntil:'networkidle2',timeout:180000});
await p.waitForFunction('!!window.__dbg?.floorGL',{timeout:120000});
await p.evaluate(s=>{window.__ST=s;},ST);
await p.waitForFunction(()=>window.__dbg.session.curStage?.id===window.__ST,{timeout:60000,polling:300}).catch(()=>{});
await new Promise(r=>setTimeout(r,6000));
const r=await p.evaluate(()=>{
  const f=window.__dbg.floorGL,c=f.canvas,ctx=f.ctx;
  // 알약 밴드 전체(y 150~560) 를 행별로 — '판이 채워졌나'는 **행 채움률**이 말한다
  const y0=150,h=430,d=ctx.getImageData(0,y0,c.width,h).data;
  let best={fill:0,y:-1};
  const rows=[];
  for(let y=0;y<h;y++){ let n=0,x0=1e9,x1=-1;
    for(let x=0;x<c.width;x++){const a=d[(y*c.width+x)*4+3]; if(a>60){n++;if(x<x0)x0=x;if(x>x1)x1=x;}}
    const span=x1-x0; const fill=span>0?n/span:0;
    if(span>500&&fill>best.fill) best={fill:+fill.toFixed(3),y:y0+y,span};
    if(n>3) rows.push([y0+y,n,x0,x1,+fill.toFixed(2)]);
  }
  const top=rows[0]?.[0], bot=rows[rows.length-1]?.[0];
  return {stage:window.__dbg.session.curStage?.id, 잉크세로:[top,bot],
    최대행채움률:best, 표본행:rows.filter((_,i)=>i%40===0).slice(0,10)};
});
console.log(JSON.stringify(r)); await b.close();
