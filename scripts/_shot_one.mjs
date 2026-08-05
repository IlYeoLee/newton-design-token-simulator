import puppeteer from 'puppeteer';
const OUT = process.env.TMP + '/one.png';
const IDS = (process.argv[2] || 'A2,P1').split(',');
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width:1700, height:900 });
await p.goto('http://127.0.0.1:5210/tokens.html?uiscale=1.0', { waitUntil:'networkidle0', timeout:40000 });
await new Promise(r=>setTimeout(r,2500));
const shots = await p.evaluate((ids) => {
  document.querySelector('#play').click();
  const out = [];
  for (const id of ids) {
    const c = window.__cells.find(x=>x.st.id===id); if(!c) continue;
    c.gl.resetAnim();
    for (let s=0; s<4.63; s+=1/30) {
      c.gl.t=s; c.gl._sig=null; c.gl._lastPaint=-1;
      if (window.__feed) window.__feed(c, s);
      try { c.gl.update(1/30); } catch(e) {}
    }
    const pill=(c.gl._boxes||[]).find(v=>v.k==='pill'); if(!pill) continue;
    const inn=(c.gl._boxes||[]).find(v=>v.k==='inner');
    const cv=c.gl.canvas;
    const X=0, W=cv.width;
    const Y=Math.max(0,Math.round(pill.y-40)), H=Math.round(pill.h+80);
    const t2=document.createElement('canvas'); t2.width=W; t2.height=H;
    const g=t2.getContext('2d');
    g.drawImage(cv,X,Y,W,H,0,0,W,H);
    g.lineWidth=2; g.setLineDash([8,8]);
    g.strokeStyle='#00e5ff';                       // 알약 세로·가로 중심선
    g.beginPath(); g.moveTo(800-X,0); g.lineTo(800-X,H); g.stroke();
    g.beginPath(); g.moveTo(0,pill.y+pill.h/2-Y); g.lineTo(W,pill.y+pill.h/2-Y); g.stroke();
    if (inn) { g.setLineDash([]); g.strokeStyle='#ff8c3c'; g.strokeRect(inn.x-X, pill.y-Y, inn.w, pill.h); }
    out.push({ id, w:W, h:H, url:t2.toDataURL() });
  }
  return out;
}, IDS);
const html=`<body style="margin:0;background:#2b2b30;font:11px sans-serif;color:#fff">`+
  shots.map(s=>`<div style="padding:4px 8px;background:#111">${s.id} — 청록=알약 중심(가로·세로) · 주황=내용 박스</div><img src="${s.url}" style="display:block">`).join('')+`</body>`;
const p2=await b.newPage(); await p2.setContent(html);
await p2.setViewport({ width:Math.round(Math.max(...shots.map(s=>s.w)))+20, height:400 });
await p2.screenshot({ path:OUT, fullPage:true });
console.log(OUT); await b.close();
