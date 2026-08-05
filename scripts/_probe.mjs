import puppeteer from 'puppeteer'; import fs from 'fs';
const DIR='/private/tmp/claude-501/-Users-iil-yeo/470bab8d-790a-4a73-a1f4-7b8eaed4ec18/scratchpad';
const st = process.argv[2] || 'P3', want = +(process.argv[3] || 7);
const b = await puppeteer.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage();
await p.goto(`http://localhost:5199/?scene=${st}`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,5000));
const r = await p.evaluate(async (want) => {
  for (let i=0;i<200 && !window.__fgl;i++) await new Promise(r=>setTimeout(r,100));
  const f = window.__fgl; if (!f) return {err:'no __fgl'};
  for (let i=0;i<400 && !(f.t>=want);i++) await new Promise(r=>setTimeout(r,50));
  const src = f.ctx.canvas;
  const o = document.createElement('canvas'); o.width=src.width; o.height=src.height;
  const g = o.getContext('2d');
  g.fillStyle = '#8B9080'; g.fillRect(0,0,o.width,o.height);
  g.drawImage(src,0,0);
  return { t:+f.t.toFixed(2), url:o.toDataURL('image/png') };
}, want);
if (r.err) console.log(r.err);
else { fs.writeFileSync(`${DIR}/comp_${st}.png`, Buffer.from(r.url.split(',')[1],'base64')); console.log(st,'t',r.t,'saved'); }
await b.close();
