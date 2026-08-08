// 스테이지 감사 — 알약 높이·폭·채움률·채도를 한 표로. 러닝·복싱·농구 전부.
import puppeteer from 'puppeteer';
const STAGES = (process.env.LIST||'A1,A2,A3,BX_B1,BX_B2,BK_B3,BK_B4,BK_C2').split(',');
const b=await puppeteer.launch({headless:'new',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const rows=[];
for (const ST of STAGES){
  const p=await b.newPage(); await p.setViewport({width:1200,height:700});
  try{
    await p.goto(`http://127.0.0.1:5199/?fxq=1&scene=${ST}`,{waitUntil:'networkidle2',timeout:180000});
    await p.waitForFunction('!!window.__dbg?.floorGL',{timeout:120000});
    await p.evaluate(s=>{window.__ST=s;},ST);
    await p.waitForFunction(()=>window.__dbg.session.curStage?.id===window.__ST,{timeout:45000,polling:300}).catch(()=>{});
    const r=await p.evaluate(async()=>{
      const f=window.__dbg.floorGL,c=f.canvas,ctx=f.ctx,S=window.__dbg.session;
      const snap=()=>{ const y0=120,h=520,d=ctx.getImageData(0,y0,c.width,h).data;
        let top=-1,bot=-1,bestFill=0,bestSpan=0,R=0,G=0,B=0,n=0,sat=0;
        for(let y=0;y<h;y++){ let m=0,x0=1e9,x1=-1;
          for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,a=d[i+3];
            if(a>60){m++;if(x<x0)x0=x;if(x>x1)x1=x;
              const r0=d[i],g0=d[i+1],b0=d[i+2];R+=r0;G+=g0;B+=b0;n++;
              sat+=Math.max(r0,g0,b0)-Math.min(r0,g0,b0);}}
          const span=x1-x0;
          if(m>3){ if(top<0) top=y0+y; bot=y0+y; }
          if(span>420&&m/span>bestFill){bestFill=m/span;bestSpan=span;} }
        return {top,bot,h:bot-top,fill:+bestFill.toFixed(2),span:bestSpan,
          sat:n?+(sat/n).toFixed(1):-1, rgb:n?[Math.round(R/n),Math.round(G/n),Math.round(B/n)]:null}; };
      // ★ 알약 높이는 **페인터가 그린 좌표**로 잰다(_boxes k:'pill'). 잉크 세로 범위로 재면
      //   크럼·PREVIEW 라벨·아크가 섞여 스테이지마다 다른 값이 나온다(내 첫 감사가 그랬다).
      const pills=[];
      const out=[]; const t0=performance.now();
      while(performance.now()-t0<9000){ await new Promise(r=>setTimeout(r,700)); out.push(snap());
        const b=(f._boxes||[]).find(o=>o.k==='pill'); const ib=(f._boxes||[]).find(o=>o.k==='inner');
        // 가운데정렬 검수 — 알약 중심과 내용 중심의 차(px). 0 이면 정렬, +면 내용이 오른쪽.
        if(b) pills.push([Math.round(b.h),Math.round(b.w),Math.round(b.y),
          ib?Math.round((ib.x+ib.w/2)-(b.x+b.w/2)):null]); }
      const pv=out.find(o=>o.fill>0)||out[0];
      const mx=out.reduce((a,o)=>o.span>a.span?o:a,out[0]);
      const mn=out.reduce((a,o)=>(o.span&&o.span<a.span?o:a),mx);
      const ph=pills.map(p=>p[0]), pw=pills.map(p=>p[1]), py=pills.map(p=>p[2]);
      return {stage:S.curStage?.id, 알약높이:pills.length?[Math.min(...ph),Math.max(...ph)]:null,
        알약폭:pills.length?[Math.min(...pw),Math.max(...pw)]:null,
        알약상단:pills.length?[Math.min(...py),Math.max(...py)]:null,
        중심오차:pills.length?[Math.min(...pills.map(p=>p[3]??0)),Math.max(...pills.map(p=>p[3]??0))]:null,
        잉크세로:[Math.min(...out.map(o=>o.h)),Math.max(...out.map(o=>o.h))],
        폭:[mn.span,mx.span], 채움:[Math.min(...out.map(o=>o.fill)),Math.max(...out.map(o=>o.fill))],
        채도:[Math.min(...out.map(o=>o.sat)),Math.max(...out.map(o=>o.sat))], 상단:pv.top};
    });
    rows.push({요청:ST, ...r});
  }catch(e){ rows.push({요청:ST, 오류:String(e).slice(0,60)}); }
  await p.close();
}
for(const r of rows) console.log(JSON.stringify(r));
await b.close();
