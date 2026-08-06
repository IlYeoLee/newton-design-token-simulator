// SB_BOX 전/후 대조 — **한 세션 안에서** 값만 바꿔 두 장을 찍는다.
//   파일을 되돌렸다 다시 고치는 방식은 vite 리로드가 끼어들어 두 장의 조건이 달라진다.
//   SB_BOX 는 export 된 객체라 속성이 런타임에 바뀐다 — 그걸 그대로 쓴다.
//   하네스 함정은 audit_fp_framing.mjs 머리말 참고(팩 탭 · 리로드 · btn-view 문구).
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
const OUT = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user/139e2466-2b63-4488-a7b2-cdc869b09bf1/scratchpad/fp_cmp.png';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
await p.goto('http://localhost:5199/', { waitUntil:'networkidle2', timeout:60000 });
await new Promise(r=>setTimeout(r,16000));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='농구')?.click());
await p.waitForFunction('!!window.__dbg?.session && !!window.__dbg?.rig', { timeout: 60000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,6000));

const shots = [];
for (const [label, v0, v1] of [['이전  v0 0.24 · v1 0.72', 0.24, 0.72], ['이후  v0 0.42 · v1 0.90', 0.42, 0.90]]) {
  const info = await p.evaluate(async (v0, v1) => {
    const S = await import('/src/session.js');
    S.SB_BOX.v0 = v0; S.SB_BOX.v1 = v1;
    const sess = window.__dbg.session;
    sess.start('basketball');
    for (let i=0;i<40 && sess.stages[sess.stageIdx].id!=='BK_B2';i++) sess.next(true);
    return sess.stages[sess.stageIdx].id;
  }, v0, v1);
  await new Promise(r=>setTimeout(r,7000));
  const m = await p.evaluate(() => {
    const D = window.__dbg, S = D.session, THREE = D.THREE, cam = D.activeCam || D.camera;
    const box = new THREE.Box3(); let lo = 9;
    S.G?.[S.stage]?.traverse(o => {
      if (!o.isMesh) return;
      let v = o, ok = true; while (v) { if (!v.visible) { ok = false; break; } v = v.parent; }
      if (!ok) return;
      const a = o.material?.uniforms?.uFade?.value ?? o.material?.opacity ?? 1;
      if (a < 0.02) return;
      box.setFromObject(o); if (!isFinite(box.min.x)) return;
      for (const cx of [box.min.x, box.max.x]) for (const cz of [box.min.z, box.max.z])
        lo = Math.min(lo, new THREE.Vector3(cx, 0.011, cz).project(cam).y);
    });
    return +lo.toFixed(3);
  });
  console.log(`${label}  → ${info}  최하단 화면y ${m}${m < -1 ? '  ★ 잘림' : ''}`);
  shots.push({ label: `${label}   최하단 y ${m}${m < -1 ? '  ★잘림' : ''}`, png: await p.screenshot({ type:'png', clip: { x: 300, y: 0, width: 900, height: 800 } }) });
}

// 두 장을 가로로 붙인다 (브라우저 캔버스로 — 노드 이미지 라이브러리를 새로 안 들인다)
const merged = await p.evaluate(async (a, b, la, lb) => {
  const load = d => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = d; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  const c = document.createElement('canvas'); c.width = A.width + B.width; c.height = A.height + 34;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(A, 0, 34); g.drawImage(B, A.width, 34);
  g.fillStyle = '#fff'; g.font = '600 17px sans-serif';
  g.fillText(la, 14, 23); g.fillText(lb, A.width + 14, 23);
  g.strokeStyle = '#fec389'; g.lineWidth = 2; g.beginPath(); g.moveTo(A.width, 34); g.lineTo(A.width, c.height); g.stroke();
  return c.toDataURL('image/png');
}, 'data:image/png;base64,' + shots[0].png.toString('base64'),
   'data:image/png;base64,' + shots[1].png.toString('base64'),
   shots[0].label, shots[1].label);
writeFileSync(OUT, Buffer.from(merged.split(',')[1], 'base64'));
console.log('저장: ' + OUT);
await b.close();
