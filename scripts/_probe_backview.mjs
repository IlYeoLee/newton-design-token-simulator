// 복싱 3인칭 = 등 뒤 프레이밍 검증 — 카메라가 봇 뒤(+Z)에 있고, 봇이 화면 안에 잡히는지 실측
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5391/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__cam && window.__setFp, { timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));   // 팩·모델 로드 여유
p.on('console', m => console.log('[page]', m.text()));

const r = await p.evaluate(() => {
  window.__setFp(false);   // 3인칭
  const cam = window.__cam;
  // 봇 앵커(골반)를 화면 좌표로
  const scene = window.__scene;
  let bot = null;
  scene.traverse(o => { if (!bot && o.isSkinnedMesh) bot = o; });
  const THREE_V = new (Object.getPrototypeOf(cam.position).constructor)();
  let botPos = null, visible = null;
  if (bot) {
    bot.skeleton.bones[0].getWorldPosition(THREE_V);
    botPos = { x: +THREE_V.x.toFixed(2), y: +THREE_V.y.toFixed(2), z: +THREE_V.z.toFixed(2) };
    const ndc = THREE_V.clone().project(cam);
    visible = { ndcX: +ndc.x.toFixed(2), ndcY: +ndc.y.toFixed(2), inFrame: Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1 };
    let m = bot; while (m) { if (m.visible === false) visible.hiddenBy = m.name || m.type; m = m.parent; }
  }
  return { cam: { x: +cam.position.x.toFixed(2), y: +cam.position.y.toFixed(2), z: +cam.position.z.toFixed(2) }, botPos, visible };
});
console.log(JSON.stringify(r, null, 2));
console.log(r.cam.z > (r.botPos?.z ?? 0) ? 'PASS: 카메라가 봇 뒤(+Z)' : 'FAIL: 카메라가 봇 앞');
console.log(r.visible?.inFrame && !r.visible?.hiddenBy ? 'PASS: 봇이 화면 안에 보임' : 'FAIL: 봇이 화면에 없음 ' + JSON.stringify(r.visible));
await p.screenshot({ path: 'scratch_backview.png' });
await b.close();
