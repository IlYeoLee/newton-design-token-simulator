// footlab 겹침 실측 — 후보 (scale, offx, offy) 를 좌·우발에서 잰다(회전 포함).
import puppeteer from 'puppeteer';
const CAND = [[0.85, -0.054, -0.031], [0.93, -0.03, -0.030]];   // 예전 저장값 · 회전 반영 맞춤값
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.setViewport({ width: 1600, height: 1100 });
await p.goto('http://127.0.0.1:5199/footlab.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4000));
for (const foot of ['왼발', '오른발']) {
  for (const [s, ox, oy] of CAND) {
    const note = await p.evaluate(async (f, s, ox, oy) => {
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === f)?.click();
      await new Promise(r => setTimeout(r, 350));
      const P = window.__flab.P;
      P.scale = s; P.offx = ox; P.offy = oy;
      document.getElementById('scale').dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 250));
      return document.getElementById('alignNote').textContent;
    }, foot, s, ox, oy);
    console.log(`${foot} s=${s} ox=${ox} oy=${oy} → ${note}`);
  }
}
await b.close();
