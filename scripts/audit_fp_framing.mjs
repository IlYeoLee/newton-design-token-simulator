// 1인칭 농구 뷰에서 **아래가 잘리는가** — 화면 좌표(NDC)로 잰다. 감으로 안 고친다.
//
//  ★ 하네스 함정 두 개 (여기서 반나절 날렸다):
//    ① 팩 탭을 눌러야 rig.mode 가 바뀐다. session.start() 만으로는 mode 가 boxing 으로 남고,
//       projector.update 가 벽 분기로 빠져 **rig._fp 가 영영 null** 이다 → 빔 좌표를 못 잰다.
//    ② 팩 전환은 리로드를 일으킨다. __dbg 가 날아가므로 waitForFunction 으로 다시 기다려야 한다.
//    ③ btn-view 문구는 **다음 상태**를 말한다. '3인칭 보기'가 떠 있으면 지금이 1인칭이다.
//       누르면 또 리로드된다 — 기본 상태가 1인칭이므로 누르지 않는다.
//
//  실행:  node scripts/audit_fp_framing.mjs [스테이지]     (기본 BK_B2)
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
const STAGE = process.argv[2] || 'BK_B2';
const SHOT = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user/139e2466-2b63-4488-a7b2-cdc869b09bf1/scratchpad/fp.png';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
await p.goto('http://localhost:5199/', { waitUntil:'networkidle2', timeout:60000 });
await new Promise(r=>setTimeout(r,16000));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='농구')?.click());
await p.waitForFunction('!!window.__dbg?.session && !!window.__dbg?.rig', { timeout: 60000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,6000));
// vite HMR 리로드가 겹칠 수 있다 — 한 번 더 기다린다.
await p.waitForFunction('!!window.__dbg?.session && !!window.__dbg?.rig', { timeout: 60000 }).catch(()=>{});
await p.evaluate((STAGE) => { const S = window.__dbg.session; S.start('basketball');
  for (let i=0;i<40 && S.stages[S.stageIdx].id!==STAGE;i++) S.next(true); }, STAGE);
await new Promise(r=>setTimeout(r,7000));   // 코치 영상·마크가 실제로 배치될 시간

const res = await p.evaluate(() => {
  const D = window.__dbg, S = D.session, R = D.rig, THREE = D.THREE;
  const cam = D.activeCam || D.camera, fp = R?._fp;
  const P = new THREE.Vector3(), box = new THREE.Box3();
  const ndc = v => { const q = v.clone().project(cam); return { x:+q.x.toFixed(3), y:+q.y.toFixed(3) }; };
  // ── 빔 창 ──
  const beam = [];
  if (fp) {
    const fwd = new THREE.Vector3(fp.fx,0,fp.fz), right = new THREE.Vector3(fp.rx,0,fp.rz);
    for (const d of [R.fpNear, 1.15, R.fpFar]) {
      const h = R._halfAt(d);
      beam.push({ d:+d.toFixed(2), half:+h.toFixed(3),
        c: ndc(new THREE.Vector3(fp.ox+fwd.x*d, 0.011, fp.oz+fwd.z*d)) });
    }
  }
  // ── 실제로 화면에 있는 지면 토큰들의 **하단 NDC** ──
  const items = [];
  const g = S.G?.[S.stage];
  if (g) g.traverse(o => {
    if (!o.isMesh) return;
    let v = o, ok = true; while (v) { if (!v.visible) { ok = false; break; } v = v.parent; }
    if (!ok) return;
    const a = o.material?.uniforms?.uFade?.value ?? o.material?.opacity ?? 1;
    if (a < 0.02) return;
    box.setFromObject(o);
    if (!isFinite(box.min.x)) return;
    let lo = 9, hi = -9;
    for (const cx of [box.min.x, box.max.x]) for (const cz of [box.min.z, box.max.z]) {
      const q = ndc(new THREE.Vector3(cx, 0.011, cz)); lo = Math.min(lo, q.y); hi = Math.max(hi, q.y);
    }
    o.getWorldPosition(P);
    items.push({ name: o.name || o.material?.type, bottom:+lo.toFixed(3), top:+hi.toFixed(3),
                 wz:+P.z.toFixed(2), alpha:+(+a).toFixed(2) });
  });
  items.sort((a,b) => a.bottom - b.bottom);
  return { stage: S.stage, mode: R?.mode, camY:+cam.position.y.toFixed(2), fov: cam.fov,
           fpNear: R?.fpNear, fpFar: R?.fpFar, beam, items: items.slice(0, 12), n: items.length };
});

console.log(`\n${res.stage} · rig.mode=${res.mode} · fov ${res.fov}° · 카메라 y ${res.camY}m · 빔 ${res.fpNear}~${res.fpFar}m`);
console.log('\n빔 중심선 화면y (NDC · -1 = 화면 하단)');
for (const r of res.beam) console.log(`  전방 ${String(r.d).padEnd(5)} 반폭 ${String(r.half).padEnd(7)} → y ${r.c.y}`);
console.log(`\n지면 토큰 ${res.n}개 · 화면 아래쪽부터 12개`);
console.log('  하단y    상단y    월드z    알파   이름');
for (const it of res.items) {
  const cut = it.bottom < -1 ? '  ★ 화면 밖(잘림)' : it.bottom < -0.9 ? '  △ 가장자리' : '';
  console.log(`  ${String(it.bottom).padEnd(8)} ${String(it.top).padEnd(8)} ${String(it.wz).padEnd(8)} ${String(it.alpha).padEnd(6)} ${it.name}${cut}`);
}
const cut = res.items.filter(i => i.bottom < -1);
console.log(`\n★ 화면 아래로 잘린 토큰: ${cut.length}개` + (cut.length ? `  (가장 깊은 것 y=${Math.min(...cut.map(c=>c.bottom)).toFixed(3)})` : ''));
writeFileSync(SHOT, await p.screenshot({ type:'png' }));
console.log('스샷: ' + SHOT);
await b.close();
