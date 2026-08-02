// 격리 프로브 — --flat --alpha 상태에서 '실제로 그려지는 것'이 무엇인지 이름으로 뽑는다.
//   유지 필터가 재질 휴리스틱 + 이름 블랙리스트라 새 무대 요소가 계속 샌다(코트 라인·그리드).
//   화이트리스트로 뒤집으려면 먼저 목록을 봐야 한다.
//   사용: node scripts/probe_isolate.mjs --sport boxing --stage BX_C2
import puppeteer from 'puppeteer';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const SPORT = arg('sport', 'boxing'), STAGE = arg('stage', '');

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 700 });
await page.goto('http://127.0.0.1:5199/?dev=1&alpha=1', { waitUntil: 'networkidle2', timeout: 180000 });
await page.waitForFunction('!!window.__dbg?.session', { timeout: 120000 });
await new Promise(r => setTimeout(r, 9000));

const out = await page.evaluate(({ sport, stage }) => {
  const d = window.__dbg;
  const btn = { running: '러닝', boxing: '복싱', basketball: '농구' }[sport];
  [...document.querySelectorAll('button')].find(b => b.textContent.trim() === btn)?.click();
  d.session.start(sport);
  if (stage) {
    const i = (d.session.stages || []).map(s => s.id).indexOf(stage);
    if (i >= 0) { d.session.stageIdx = i; d.session.t = 0; d.session._enter(); }
  }
  return new Promise(res => setTimeout(() => {
    const rows = [];
    // 계보 = 이 개체가 어느 루트에 매달려 있는지. 화이트리스트는 결국 루트 단위가 된다.
    const roots = new Map();
    const tag = (o, name) => { o.traverse(x => { if (!roots.has(x)) roots.set(x, name); }); };
    if (d.tokens?.root) tag(d.tokens.root, 'tokens.root');
    if (d.tokens?.floorRoot) tag(d.tokens.floorRoot, 'tokens.floorRoot');
    if (d.tokens?.wallRoot) tag(d.tokens.wallRoot, 'tokens.wallRoot');
    if (d.floorGL?.mesh) tag(d.floorGL.mesh, 'floorGL.mesh');
    if (d.wallGL?.mesh) tag(d.wallGL.mesh, 'wallGL.mesh');
    if (d.xbot?.root) tag(d.xbot.root, 'xbot.root');
    if (d.rig?.root) tag(d.rig.root, 'rig.root');
    d.scene.traverse(o => {
      if (!o.visible || (!o.isMesh && !o.isLine && !o.isPoints)) return;
      let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
      if (!vis) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const frag = (m?.fragmentShader || '').slice(0, 4000);
      const u = m?.uniforms ? Object.keys(m.uniforms).slice(0, 6).join(',') : '';
      rows.push({ n: o.name || '(무명)', t: o.type, mat: m?.type || '-', root: roots.get(o) || '(scene 직속)',
        map: !!m?.map, u, mark: /uTrail|uCropOff|uHeat|uProg|uPhase|uW/.test(frag) ? frag.match(/u[A-Z]\w+/g)?.slice(0, 4).join(',') : '' });
    });
    res({ rows, stage: d.session.stage, keys: Object.keys(d.tokens || {}).filter(k => /root|Root/.test(k)) });
  }, 4000));
}, { sport: SPORT, stage: STAGE });

console.log(`스테이지 ${out.stage} · tokens 루트 키: ${out.keys.join(', ')}`);
console.log(`보이는 개체 ${out.rows.length}개`);
for (const r of out.rows) console.log(`  ${r.root.padEnd(18)} ${r.t.padEnd(13)} ${r.mat.padEnd(15)} ${r.n.padEnd(14)} ${r.mark || r.u}`);
await browser.close();
