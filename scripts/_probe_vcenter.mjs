import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const p=await b.newPage(); await p.setViewport({width:1700,height:900});
await p.goto('http://127.0.0.1:5210/tokens.html?uiscale=1.0',{waitUntil:'networkidle0',timeout:40000});
await new Promise(r=>setTimeout(r,2500));
const rows=await p.evaluate(()=>{
  document.querySelector('#play').click();
  const out=[];
  for(const id of ['A2','A1','P1','BK_C2']){
    const c=window.__cells.find(x=>x.st.id===id); if(!c) continue;
    c.gl.resetAnim(); for(let s=0;s<4.63;s+=1/30){c.gl.t=s;c.gl._sig=null;c.gl._lastPaint=-1;window.__feed&&window.__feed(c,s);try{c.gl.update(1/30);}catch{}}
    const pill=(c.gl._boxes||[]).find(v=>v.k==='pill'), inn=(c.gl._boxes||[]).find(v=>v.k==='inner');
    if(!pill) continue;
    const cv=c.gl.canvas,g=cv.getContext('2d');
    const scan=(x0,ww)=>{ // 세로 잉크 경계
      const y0=Math.round(pill.y), hh=Math.round(pill.h);
      const d=g.getImageData(Math.round(x0),y0,Math.round(ww),hh).data;
      let T=1e9,B=-1;
      for(let i=0;i<d.length;i+=4){ if(d[i+3]>200 && (d[i]+d[i+1]+d[i+2])/3>190){ const yy=Math.floor((i/4)/Math.round(ww)); if(yy<T)T=yy; if(yy>B)B=yy; } }
      return T<1e9?{t:y0+T,b:y0+B,c:y0+(T+B)/2}:null;
    };
    const ringSlot = inn ? scan(inn.x, Math.min(240, inn.w*0.35)) : null;      // 링·숫자 영역
    const textSlot = inn ? scan(inn.x+inn.w*0.42, inn.w*0.58) : null;          // 타이틀 영역
    out.push({ id, pillC: Math.round(pill.y+pill.h/2),
      ring: ringSlot?Math.round(ringSlot.c):null, text: textSlot?Math.round(textSlot.c):null,
      textTB: textSlot?[Math.round(textSlot.t),Math.round(textSlot.b)]:null });
  }
  return out;
});
console.log('스테이지  알약중심  링중심  글자중심   링어긋남 글자어긋남  글자[상,하]');
for(const r of rows) console.log(r.id.padEnd(9),String(r.pillC).padStart(8),String(r.ring).padStart(7),String(r.text).padStart(8),
  String(r.ring!=null?r.ring-r.pillC:'-').padStart(9), String(r.text!=null?r.text-r.pillC:'-').padStart(9), '  '+JSON.stringify(r.textTB));
await b.close();
