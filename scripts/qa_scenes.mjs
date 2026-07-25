// 세션 장면 전수 검수 캡처 — 스테이지별 x봇 동작 + 지면 가이드 UI 동시 확인용
// 사용: node scripts/qa_scenes.mjs [--sport running] [--frames 5] [--step 900] [--out /tmp/newton_scenes]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const SPORT = arg('sport', 'running');
const N = +arg('frames', 5);
const STEP = +arg('step', 900);
const OUT = path.join(arg('out', '/tmp/newton_scenes'), SPORT);
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=960,540', '--use-gl=angle'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle2' });
await page.waitForFunction('!!window.__dbg && !!window.__dbg.session', { timeout: 20000 });
await new Promise(r => setTimeout(r, 1800));

const stages = await page.evaluate((sport) => {
  const d = window.__dbg;
  // 정식 시작 경로(팩 전환·원점 리셋 포함) = 팩 카드 클릭 + 세션 버튼
  document.querySelector(`[data-pack=${sport}]`)?.click();
  document.getElementById('btn-session')?.click();
  document.getElementById('panel')?.style.setProperty('display', 'none');
  // 자동 진행 정지: 전 스테이지 dur 무력화(수동 next로만 이동) — 캡처 중 스테이지 이탈 방지
  for (const s of d.session.stages) { s._durOrig = s.dur; s.dur = 99999; }
  d.state.playing = true;
  return d.session.stages.map(s => s.id);
}, SPORT);
console.log('stages:', stages.join(' '));

for (let si = 0; si < stages.length; si++) {
  const id = stages[si];
  if (si > 0) await page.evaluate(() => window.__dbg.session.next());
  await new Promise(r => setTimeout(r, 700));   // _enter 빌드·크로스페이드 여유
  for (let i = 0; i < N; i++) {
    await page.evaluate(() => {
      const d = window.__dbg;
      const hip = d.xbot._hips;
      const p = new d.THREE.Vector3(); hip.getWorldPosition(p);
      // 3/4 상후방 — 봇 전신 + 발 앞 투사존(전방 -z 2m)이 한 화면에
      d.camera.position.set(p.x + 1.9, 2.1, p.z + 2.3);
      d.controls.target.set(p.x, 0.5, p.z - 0.9);
      d.controls.update();
    });
    await page.screenshot({ path: path.join(OUT, `${String(si).padStart(2, '0')}_${id}_${i}.png`) });
    await new Promise(r => setTimeout(r, STEP));
  }
  console.log('captured', id);
}
await browser.close();
console.log('DONE', OUT);
