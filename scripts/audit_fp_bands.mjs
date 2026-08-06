// 1인칭 화면에서 **누가 어느 띠를 먹고 있나** — 코치 판 · 지면 UI 프레임(타이틀) · 판정 마크.
//   세 층이 같은 바닥을 나눠 쓰는데 각자 다른 좌표계로 배치돼 있어서, 하나를 옮기면
//   다른 하나를 침범한다(08-07 실제 사고: 마크를 앞으로 밀었더니 타이틀을 먹었다).
//   그래서 **셋을 같은 자로 잰다** = 화면 NDC y.
//   하네스 함정은 audit_fp_framing.mjs 머리말 참고.
//   실행: node scripts/audit_fp_bands.mjs [스테이지]
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
const STAGE = process.argv[2] || 'BK_B4';
const SHOT = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user/139e2466-2b63-4488-a7b2-cdc869b09bf1/scratchpad/bands.png';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
await p.goto('http://localhost:5199/', { waitUntil:'networkidle2', timeout:60000 });
await new Promise(r=>setTimeout(r,16000));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='농구')?.click());
await p.waitForFunction('!!window.__dbg?.session && !!window.__dbg?.rig', { timeout: 60000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,6000));
await p.waitForFunction('!!window.__dbg?.session', { timeout: 30000 }).catch(()=>{});
await p.evaluate((STAGE) => { const S = window.__dbg.session; S.start('basketball');
  for (let i=0;i<40 && S.stages[S.stageIdx].id!==STAGE;i++) S.next(true); }, STAGE);
await new Promise(r=>setTimeout(r,8000));

const res = await p.evaluate(() => {
  const D = window.__dbg, S = D.session, R = D.rig, THREE = D.THREE;
  const cam = D.activeCam || D.camera, box = new THREE.Box3();
  const yOf = o => { box.setFromObject(o); if (!isFinite(box.min.x)) return null;
    let lo = 9, hi = -9;
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
      const q = new THREE.Vector3(x, 0.011, z).project(cam); lo = Math.min(lo, q.y); hi = Math.max(hi, q.y);
    }
    return { lo:+lo.toFixed(3), hi:+hi.toFixed(3) }; };
  const vis = o => { let v = o, ok = true; while (v) { if (!v.visible) { ok = false; break; } v = v.parent; } return ok; };
  const out = { stage: S.stage, camY:+cam.position.y.toFixed(2), fov: cam.fov, fpNear: R?.fpNear, fpFar: R?.fpFar, layers: [] };
  // ① 코치 판 (인물 영상) — 3D 판이라 씬 어딘가에 있다. 이름이 없으니 재질에 uCropOff 로 찾는다.
  D.scene.traverse(o => {
    if (!o.isMesh || !vis(o)) return;
    if (o.material?.uniforms?.uCropOff) { const y = yOf(o); if (y) out.layers.push({ 층:'코치 판(인물 영상)', ...y }); }
  });
  // ② 지면 UI 프레임 (타이틀 알약이 그려지는 캔버스 판)
  //   ★ 텍스처 폭으로 찾으면 못 잡는다(캔버스가 리사이즈된다). **판 실치수**로 찾는다 —
  //     대지 1600x2670 이 그대로 비율이라 세로/가로 = 1.669 인 큰 수평 판이 그것이다.
  const sz = new THREE.Vector3();
  D.scene.traverse(o => {
    if (!o.isMesh || !vis(o)) return;
    box.setFromObject(o); if (!isFinite(box.min.x)) return;
    box.getSize(sz);
    const ar = sz.z / Math.max(sz.x, 1e-4);
    if (sz.x > 0.6 && sz.x < 2.2 && ar > 1.45 && ar < 1.95) {
      const y = yOf(o);
      if (y) out.layers.push({ 층:'지면 UI 프레임(타이틀)', ...y, 판: `${sz.x.toFixed(2)}x${sz.z.toFixed(2)}m` });
    }
  });
  // ③ 판정 마크 (세션 스테이지 그룹)
  let lo = 9, hi = -9, n = 0;
  S.G?.[S.stage]?.traverse(o => {
    if (!o.isMesh || !vis(o)) return;
    const a = o.material?.uniforms?.uFade?.value ?? o.material?.opacity ?? 1;
    if (a < 0.05) return;
    const y = yOf(o); if (!y) return; lo = Math.min(lo, y.lo); hi = Math.max(hi, y.hi); n++;
  });
  if (n) out.layers.push({ 층:`판정 마크 (${n}개)`, lo:+lo.toFixed(3), hi:+hi.toFixed(3) });
  return out;
});

console.log(`\n${res.stage} · 눈높이 ${res.camY}m · fov ${res.fov}° · 빔 ${res.fpNear}~${res.fpFar}m`);
console.log('화면 NDC y  (+1 상단 · -1 하단)\n');
console.log('  하단y     상단y     층');
for (const L of res.layers) {
  const flag = L.lo < -1 ? '  ★ 화면 아래로 잘림' : L.lo < -0.93 ? '  △ 하단 가장자리' : '';
  console.log(`  ${String(L.lo).padEnd(9)} ${String(L.hi).padEnd(9)} ${L.층}${L.tex ? ' [' + L.tex + ']' : ''}${flag}`);
}
// 겹침 판정
for (let i = 0; i < res.layers.length; i++) for (let j = i+1; j < res.layers.length; j++) {
  const A = res.layers[i], B = res.layers[j];
  const ov = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo);
  if (ov > 0) console.log(`\n★ 겹침 ${ov.toFixed(3)} :  ${A.층}  ↔  ${B.층}`);
}
writeFileSync(SHOT, await p.screenshot({ type:'png' }));
console.log('\n스샷: ' + SHOT);
await b.close();
