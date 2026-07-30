// 깔창 각인 발자국 — 변형 테스트 시트.
// 겉(신발 실루엣) + 안(맨발 자국 도트)의 파라미터를 훑어서 눈으로 고르기 위한 도구.
//
//   node scripts/shot_foot_var.mjs tmp_foot_var.png
//
// 사전 조건: npx vite --port 5199 --strictPort 가 떠 있어야 한다.
import puppeteer from 'puppeteer';

const [out = 'tmp_foot_var.png'] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 220)));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const res = await p.evaluate(async () => {
  const THREE = window.__dbg?.THREE;
  if (!THREE) throw new Error('window.__dbg.THREE 없음 — 부트 실패');
  const T = await import('/src/tokens.js');
  const L = await import('/src/fxlut.js');
  L.FXP.footCtx = 'out';
  L.FXP.markShape = 1;
  for (let i = 0; i < 60; i++) {
    if (L.GLYPHS.img('FOOT_OUT_L') && L.GLYPHS.img('FOOT_IN_L')) break;
    await new Promise(r => setTimeout(r, 200));
  }

  const TILE = 260, PAD = 8, LW = 128, HDR = 26;
  // 기본값 = tokens.js makeMarkFXMaterial 의 각인 기본치
  const D = { imp: 1.0, pitch: 0.027, dot: 0.25, glow: 0.30, edge: 0.030 };
  const ROWS = [
    { label: '① 정렬 확인', kind: 'align', tiles: ['겉 = 신발', '안 = 맨발', '겹침'] },
    { label: '② 각인 없음/있음', tiles: [
      { t: '각인 OFF (지금)', phase: 1, prog: 0.6, o: { imp: 0 } },
      { t: '각인 ON', phase: 1, prog: 0.6, o: {} },
      { t: '도트 없이 자국만', phase: 1, prog: 0.6, o: { dot: 0.5, glow: 0.55 } },
    ] },
    { label: '③ 도트 간격', tiles: [
      { t: '촘촘 0.018', phase: 1, prog: 0.6, o: { pitch: 0.018 } },
      { t: '기본 0.027', phase: 1, prog: 0.6, o: { pitch: 0.027 } },
      { t: '굵게 0.040', phase: 1, prog: 0.6, o: { pitch: 0.040 } },
      { t: '아주굵게 0.055', phase: 1, prog: 0.6, o: { pitch: 0.055 } },
    ] },
    { label: '④ 점 크기', tiles: [
      { t: '가늘 0.16', phase: 1, prog: 0.6, o: { dot: 0.16 } },
      { t: '기본 0.25', phase: 1, prog: 0.6, o: { dot: 0.25 } },
      { t: '굵 0.34', phase: 1, prog: 0.6, o: { dot: 0.34 } },
      { t: '거의채움 0.44', phase: 1, prog: 0.6, o: { dot: 0.44 } },
    ] },
    { label: '⑤ 자국 윤곽 글로우', tiles: [
      { t: '0 (없음)', phase: 1, prog: 0.6, o: { glow: 0 } },
      { t: '0.30 기본', phase: 1, prog: 0.6, o: { glow: 0.30 } },
      { t: '0.60', phase: 1, prog: 0.6, o: { glow: 0.60 } },
      { t: '1.00', phase: 1, prog: 0.6, o: { glow: 1.0 } },
    ] },
    { label: '⑥ 상태 전체(기본값)', tiles: [
      { t: 'Preview', phase: 0, prog: 0.55, o: {} },
      { t: 'Active 0.35', phase: 1, prog: 0.35, o: {} },
      { t: 'Hold 0.6', phase: 5, prog: 0.6, o: {} },
      { t: 'Success', phase: 2, prog: 0, o: {} },
      { t: 'Locked', phase: 3, prog: 0, o: {} },
    ] },
  ];

  const cols = Math.max(...ROWS.map(r => r.tiles.length));
  const W = LW + cols * (TILE + PAD) + PAD;
  const H = PAD + ROWS.length * (TILE + PAD + HDR) + PAD;
  const sheet = document.createElement('canvas');
  sheet.width = W; sheet.height = H;
  const s = sheet.getContext('2d');
  s.fillStyle = '#0d1014'; s.fillRect(0, 0, W, H);

  const rc = document.createElement('canvas'); rc.width = rc.height = TILE;
  const renderer = new THREE.WebGLRenderer({ canvas: rc, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 2;

  const tex = L.footSDFTexture(false);   // 왼발
  if (!tex) throw new Error('발형 SDF 베이크 실패');

  const drawFX = (tile, x, y) => {
    const mat = T.makeMarkFXMaterial(tex);
    const U = mat.uniforms;
    U.uPhase.value = tile.phase; U.uProg.value = tile.prog;
    U.uTime.value = 1.7; U.uSeed.value = 0.9; U.uOut.value = 0;
    const o = { ...D, ...tile.o };
    U.uImp.value = o.imp; U.uImpPitch.value = o.pitch; U.uImpDot.value = o.dot;
    U.uImpGlow.value = o.glow; U.uImpEdge.value = o.edge;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.rotation.z = 8 * Math.PI / 180;
    scene.add(mesh);
    renderer.render(scene, cam);
    s.drawImage(rc, x, y);
    scene.remove(mesh); mesh.geometry.dispose(); mat.dispose();
  };

  // 정렬 확인 — SDF 두 채널을 2D 로 직접 그린다(셰이더를 안 거치므로 겹침 자체를 본다)
  const drawAlign = (which, x, y) => {
    const N = tex.image.width, data = tex.image.data;
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    const g = c.getContext('2d');
    const id = g.createImageData(TILE, TILE);
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const sx = Math.floor(px / TILE * N), sy = Math.floor(py / TILE * N);
      const i = (sy * N + sx) * 2;
      const so = data[i] * 1.9922, si = data[i + 1] * 1.9922;
      const inO = so < 0, inI = si < 0;
      const o = (py * TILE + px) * 4;
      let r = 13, gg = 16, bb = 20;
      if (which !== 1 && inO) { r = 250; gg = 48; bb = 48; }                 // 겉 = 브랜드 RED
      if (which !== 0 && inI) { r = 255; gg = 240; bb = 225; }               // 안 = 크림
      id.data[o] = r; id.data[o + 1] = gg; id.data[o + 2] = bb; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    s.drawImage(c, x, y);
  };

  s.textBaseline = 'middle';
  let y = PAD;
  for (const row of ROWS) {
    s.font = "600 15px -apple-system, 'Malgun Gothic', sans-serif";
    s.fillStyle = '#c9ced6'; s.textAlign = 'left';
    s.fillText(row.label, PAD, y + HDR + TILE / 2);
    row.tiles.forEach((tile, i) => {
      const x = LW + i * (TILE + PAD);
      s.font = "500 13px -apple-system, 'Malgun Gothic', sans-serif";
      s.fillStyle = '#8d949e'; s.textAlign = 'center';
      s.fillText(typeof tile === 'string' ? tile : tile.t, x + TILE / 2, y + HDR / 2);
      if (row.kind === 'align') drawAlign(i, x, y + HDR);
      else drawFX(tile, x, y + HDR);
    });
    y += HDR + TILE + PAD;
  }

  const wrap = document.createElement('div');
  wrap.id = '__sheet';
  Object.assign(wrap.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999' });
  sheet.style.display = 'block';
  wrap.appendChild(sheet);
  document.body.appendChild(wrap);
  return { w: W, h: H, hasInner: !!tex._hasInner, chans: tex.image.data.length / (tex.image.width * tex.image.width) };
}, );

console.log('안(맨발) 채널:', res.hasInner ? '정상' : '없음 — 각인 비활성', '/ 채널수', res.chans);
await p.setViewport({ width: res.w, height: res.h });
await new Promise(r => setTimeout(r, 300));
await (await p.$('#__sheet')).screenshot({ path: out });
console.log('saved', out);
await b.close();
