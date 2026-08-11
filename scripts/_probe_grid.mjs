// 코치 그리드가 왜 안 보이는지 — 메시 존재·가시성·유니폼·셰이더 컴파일을 한 번에 본다.
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.setViewport({ width: 1000, height: 700 });
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction('window.__dbg && window.__dbg.session', { timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(async () => {
  const D = window.__dbg, S = D.session;
  D.state.pack = 'running';
  if (!S.active) S.start('running');
  const i = (S.stages || []).findIndex(x => x.id === 'A1');
  if (i >= 0) { S.stageIdx = i; S.t = 0; S._enter(); }
  for (let k = 0; k < 60; k++) { S.t = 2 + k * 0.033; await new Promise(r => requestAnimationFrame(r)); }
  const res = [];
  D.scene.traverse(o => {
    if (!o.isMesh || !o.material?.uniforms?.uMode) return;
    const u = o.material.uniforms;
    let vis = o.visible; for (let q = o.parent; q; q = q.parent) vis = vis && q.visible;
    res.push({ vis, mode: u.uMode.value, alpha: u.uAlpha.value, gain: u.uGain.value,
      step: u.uStep.value, span: [u.uSpan.value.x, u.uSpan.value.y], clip: u.uClip.value,
      prog: !!o.material.program, diag: o.material.program?.diagnostics?.fragmentShader?.log?.slice(0, 200) || '' });
  });
  return res;
});
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 5).join('\n'));
await b.close();
