// 5200 이 정말 '리로드 안 하는 서버'인지 실측 — 소스를 건드려 보고 네비게이션을 센다
import puppeteer from 'puppeteer';
import fs from 'fs';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
let nav = 0;
p.on('framenavigated', f => { if (f === p.mainFrame()) { nav++; console.log(`  navigate #${nav}  ${new Date().toISOString().slice(11,19)}`); } });
await p.goto('http://127.0.0.1:5300/', { waitUntil: 'networkidle2', timeout: 60000 });
console.log('로드 완료 — 이제 20초 관찰(아무것도 안 건드림)');
await new Promise(r => setTimeout(r, 20000));
const base = nav;
console.log(`  가만히 뒀을 때 네비게이션: ${base - 1}회`);
const f = 'src/floorgl.js', s = fs.readFileSync(f, 'utf8');
fs.writeFileSync(f, s + '\n');            // 무해한 개행 하나
console.log('소스 저장함 — 10초 관찰');
await new Promise(r => setTimeout(r, 10000));
fs.writeFileSync(f, s);                    // 되돌림
await new Promise(r => setTimeout(r, 4000));
console.log(`  소스 저장 후 네비게이션: ${nav - base}회`);
await b.close();
