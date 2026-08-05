import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
await p.goto('http://127.0.0.1:5202/tokens.html?uiscale=1.0', { waitUntil: 'networkidle0', timeout: 40000 });
await new Promise(r => setTimeout(r, 2500));
const rows = await p.evaluate(async () => {
  document.querySelector('#play').click();
  const out = [];
  for (const id of ['P1','P2','P3','A1','A2','BK_C2','C1']) {
    const c = window.__cells.find(x => x.st.id === id); if (!c) continue;
    c.gl.resetAnim(); for (let s = 0; s < 5; s += 1/30) { c.gl.t = s; c.gl._sig=null; c.gl._lastPaint=-1; try{c.gl.update(1/30);}catch{} }
    const pill = (c.gl._boxes||[]).find(v=>v.k==='pill');
    const inn  = (c.gl._boxes||[]).find(v=>v.k==='inner');
    if (!pill) { out.push({id, none:true}); continue; }
    out.push({ id, w: Math.round(pill.w), h: Math.round(pill.h),
      L: inn ? Math.round(inn.x - pill.x) : null,
      R: inn ? Math.round((pill.x + pill.w) - (inn.x + inn.w)) : null,
      cxPill: Math.round(pill.x + pill.w/2), cxInner: inn ? Math.round(inn.x + inn.w/2) : null });
  }
  return out;
});
console.log('스테이지   알약     좌여백 우여백  차이   알약중심 내용중심  어긋남');
for (const r of rows) {
  if (r.none) { console.log(r.id.padEnd(10),' 알약 없음'); continue; }
  const d = (r.R ?? 0) - (r.L ?? 0), off = (r.cxInner ?? 0) - r.cxPill;
  console.log(r.id.padEnd(10), (r.w+'×'+r.h).padEnd(9),
    String(r.L).padStart(5), String(r.R).padStart(6), String(d).padStart(6),
    String(r.cxPill).padStart(8), String(r.cxInner).padStart(8), String(off).padStart(7),
    Math.abs(off) > 3 ? ' ← 어긋남' : ' ok');
}
await b.close();
