// 지면 가이드 밴드 vs 실제 콘텐츠 실측 — 러닝 스테이지별 지면 마크의 대지 y 범위를 재서
//   CONTENT 밴드(LAYOUT.CONTENT_Y0~Y1)와 대조한다. fwd→y 역환산은 session.boardMap 사용.
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://127.0.0.1:5199/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__sess && window.__dbg, { timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => document.querySelector('[data-pack=running]')?.click());
await new Promise(r => setTimeout(r, 1800));
await p.evaluate(() => document.getElementById('btn-session')?.click());
await new Promise(r => setTimeout(r, 1500));

const layout = await p.evaluate(async () => {
  const { LAYOUT, TOK } = await import('/src/floorgl.js');
  return { y0: LAYOUT.CONTENT_Y0, y1: LAYOUT.CONTENT_Y1, foot: LAYOUT.FOOT_Y, progY: LAYOUT.PROG_Y, headY: TOK.headY };
});
console.log('LAYOUT:', JSON.stringify(layout));

for (const stage of ['A2', 'A3', 'P1', 'C2']) {
  const r = await p.evaluate(async (stage) => {
    const s = window.__sess;
    const i = s.stages.findIndex(x => x.id === stage);
    if (i < 0) return null;
    s.stageIdx = i; s.t = 0; s._enter(); s.t = 4;   // 관찰 지나 콘텐츠가 떠 있는 시각
    await new Promise(r2 => setTimeout(r2, 1200));
    const bm = s.boardMap; if (!bm) return { stage, err: 'boardMap 없음' };
    const THREE = window.__dbg.THREE;
    const v = new THREE.Vector3();
    const fwds = [];
    s.root.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      let vis = true, par = o;
      while (par) { if (par.visible === false) { vis = false; break; } par = par.parent; }
      if (!vis) return;
      o.getWorldPosition(v);
      if (v.y > 0.2) return;            // 지면 것만(벽 토큰 제외)
      const op = o.material?.opacity ?? 1;
      if (op < 0.05) return;
      fwds.push(-v.z);                   // 정면(-z) 전방 거리 근사
    });
    if (!fwds.length) return { stage, n: 0 };
    const yOf = f => Math.round(1335 - (f - bm.fwd) / bm.s);
    const fMin = Math.min(...fwds), fMax = Math.max(...fwds);
    return { stage, n: fwds.length, fwd: [fMin.toFixed(2), fMax.toFixed(2)], yTop: yOf(fMax), yBot: yOf(fMin) };
  }, stage);
  console.log(stage + ':', JSON.stringify(r));
}
await b.close();
