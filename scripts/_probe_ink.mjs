import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width:1600, height:900 });
await p.goto('http://127.0.0.1:5202/tokens.html?uiscale=1.0', { waitUntil:'networkidle0', timeout:40000 });
await new Promise(r=>setTimeout(r,2500));
const rows = await p.evaluate(() => {
  document.querySelector('#play').click();
  const out=[];
  for (const id of ['P1','P2','A1','BK_C2']) {
    const c = window.__cells.find(x=>x.st.id===id); if(!c) continue;
    c.gl.resetAnim(); for(let s=0;s<5;s+=1/30){c.gl.t=s;c.gl._sig=null;c.gl._lastPaint=-1;try{c.gl.update(1/30);}catch{}}
    const pill=(c.gl._boxes||[]).find(v=>v.k==='pill'), inn=(c.gl._boxes||[]).find(v=>v.k==='inner');
    if(!pill) continue;
    const cv=c.gl.canvas, g=cv.getContext('2d');
    // 알약 내부만, 세로 중앙 40% 띠에서 **밝은 잉크**(글자·링)만 본다
    const y0=Math.round(pill.y+pill.h*0.30), hh=Math.round(pill.h*0.40);
    const x0=Math.max(0,Math.round(pill.x+4)), ww=Math.min(cv.width-x0, Math.round(pill.w-8));
    const d=g.getImageData(x0,y0,ww,hh).data;
    let L=1e9,R=-1;
    for(let i=0;i<d.length;i+=4){
      const a=d[i+3], lum=(d[i]+d[i+1]+d[i+2])/3;
      if(a>200 && lum>170){ const xx=(i/4)%ww; if(xx<L)L=xx; if(xx>R)R=xx; }
    }
    out.push({ id, pillX:Math.round(pill.x), pillW:Math.round(pill.w),
      innX: inn?Math.round(inn.x):null, innW: inn?Math.round(inn.w):null,
      inkL: L<1e9?Math.round(x0+L):null, inkR: R>=0?Math.round(x0+R):null });
  }
  return out;
});
console.log('스테이지  알약[x,w]        내용박스[x,w]      실잉크[L,R]      잉크 좌여백 우여백  차이');
for(const r of rows){
  const pl=r.inkL-r.pillX, pr=(r.pillX+r.pillW)-r.inkR;
  console.log(r.id.padEnd(9), `[${r.pillX},${r.pillW}]`.padEnd(16), `[${r.innX},${r.innW}]`.padEnd(18),
    `[${r.inkL},${r.inkR}]`.padEnd(16), String(pl).padStart(7), String(pr).padStart(6), String(pr-pl).padStart(6),
    Math.abs(pr-pl)>16?' ← 비대칭':' ok');
}
await b.close();
