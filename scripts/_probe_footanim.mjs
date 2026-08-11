// footlab 애니메이션 실측 — 확대(hero)·스트립·바닥 캔버스가 실제로 프레임마다 바뀌는지 잰다.
//   "정지처럼 보인다"를 눈이 아니라 픽셀 변화량으로 가른다.
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.setViewport({ width: 1600, height: 1100 });
await p.goto('http://127.0.0.1:5199/footlab.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4500));

const shot = () => p.evaluate(() => {
  const out = {};
  for (const c of document.querySelectorAll('canvas')) {
    const id = c.id || 'anon' + [...document.querySelectorAll('canvas')].indexOf(c);
    try { out[id] = c.toDataURL('image/png').length + ':' + c.toDataURL('image/png').slice(1000, 1120); }
    catch { out[id] = 'x'; }
  }
  return out;
});
const a = await shot();
await new Promise(r => setTimeout(r, 1400));
const c = await shot();
for (const k of Object.keys(a)) console.log(`${k.padEnd(12)} ${a[k] === c[k] ? '정지 (1.4초 동안 픽셀 동일)' : '움직임 있음'}`);
await b.close();
