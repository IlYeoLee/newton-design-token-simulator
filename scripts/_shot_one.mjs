import puppeteer from 'puppeteer';
const OUT = process.env.TMP + '/one.png';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width:1700, height:900 });
await p.goto('http://127.0.0.1:5202/tokens.html?uiscale=1.0', { waitUntil:'networkidle0', timeout:40000 });
await new Promise(r=>setTimeout(r,2500));
const shots = await p.evaluate((ids) => {
  document.querySelector('#play').click();
  return ids.map(id => {
    const c = window.__cells.find(x=>x.st.id===id); if(!c) return null;
    c.gl.resetAnim(); for(let s=0;s<5;s+=1/30){c.gl.t=s;c.gl._sig=null;c.gl._lastPaint=-1;try{c.gl.update(1/30);}catch{}}
    const pill=(c.gl._boxes||[]).find(v=>v.k==='pill');
    const inn=(c.gl._boxes||[]).find(v=>v.k==='inner');
    const cv=c.gl.canvas;
    const M=90, X=Math.max(0,Math.round(pill.x-M)), W=Math.min(cv.width-X,Math.round(pill.w+M*2));
    const Y=Math.max(0,Math.round(pill.y-30)), H=Math.round(pill.h+60);
    const t2=document.createElement('canvas'); t2.width=W; t2.height=H;
    const g=t2.getContext('2d');
    g.drawImage(cv,X,Y,W,H,0,0,W,H);
    // 검수선 — 알약 중심(청록) · 내용박스 경계(주황)
    g.strokeStyle='#00e5ff'; g.lineWidth=2; g.setLineDash([6,6]);
    g.beginPath(); g.moveTo(pill.x+pill.w/2-X,0); g.lineTo(pill.x+pill.w/2-X,H); g.stroke();
    if(inn){ g.setLineDash([]); g.strokeStyle='#ff8c3c';
      g.strokeRect(inn.x-X, 30, inn.w, pill.h); }
    return { id, w:W, h:H, url:t2.toDataURL() };
  }).filter(Boolean);
}, ['P1','BK_C2']);
const html=`<body style="margin:0;background:#2b2b30;font:11px sans-serif;color:#fff">`+
  shots.map(s=>`<div style="padding:4px 8px;background:#111">${s.id} — 청록=알약 중심선 · 주황=내용 박스</div><img src="${s.url}" style="display:block">`).join('')+`</body>`;
const p2=await b.newPage(); await p2.setContent(html);
await p2.setViewport({ width:Math.round(Math.max(...shots.map(s=>s.w)))+20, height:400 });
await p2.screenshot({ path:OUT, fullPage:true });
console.log(OUT); await b.close();
