// auto-manifest 32종 전수 시각 QA — 클립당 6프레임 캡처 (판독은 사람이/클로드가)
// 사용: node scripts/qa_auto_clips.mjs [--out /tmp/qa] [--only cmu06_03,cmu124_04]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const OUT = arg('out', '/tmp/newton_qa');
const ONLY = arg('only', '')?.split(',').filter(Boolean);
const N = 6;

const manifest = JSON.parse(fs.readFileSync('assets/mocap/auto/auto-manifest.json', 'utf8'));
const names = Object.keys(manifest).filter(n => !ONLY?.length || ONLY.includes(n));
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=960,540', '--use-gl=angle'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle2' });
await page.waitForFunction('!!window.__dbg && !!window.__dbg.xbot', { timeout: 20000 });
await new Promise(r => setTimeout(r, 1500));

await page.evaluate(() => {
  document.getElementById('panel')?.style.setProperty('display', 'none');
  document.querySelector('[data-pack=running]')?.click();
  window.__dbg.state.playing = true;
});
await new Promise(r => setTimeout(r, 500));

for (const nm of names) {
  const key = 'auto_' + nm;
  const ok = await page.evaluate(k => !!window.__dbg.xbot.actions[k], key);
  if (!ok) { console.log('SKIP(클립없음)', nm); continue; }
  await page.evaluate(k => { window.__dbg.xbot.setVerify(k); }, key);
  await new Promise(r => setTimeout(r, 300));
  const dur = manifest[nm].dur;
  for (let i = 0; i < N; i++) {
    const t = dur * (i + 0.5) / N;
    await page.evaluate((tt) => {
      const d = window.__dbg;
      d.xbot._vT = tt;
      // 카메라가 봇 힙을 따라감 (이동 클립이 프레임 밖으로 나가는 것 방지)
      const hip = d.xbot._hips || d.xbot.model;
      const p = new d.THREE.Vector3(); hip.getWorldPosition(p);
      d.camera.position.set(p.x + 2.4, 1.6, p.z + 2.4);
      d.controls.target.set(p.x, 0.9, p.z);
      d.controls.update();
    }, t);
    await new Promise(r => setTimeout(r, 120));
    // _vT가 rAF로 몇십 ms 흘렀어도 무방 — 정지 스틸 QA 목적
    await page.screenshot({ path: path.join(OUT, `${nm}_${i}.png`) });
  }
  console.log('captured', nm);
}
await page.evaluate(() => window.__dbg.xbot.setVerify(null));
await browser.close();
console.log('DONE', OUT);
