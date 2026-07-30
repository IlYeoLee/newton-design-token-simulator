// MARK 토큰(발형 · 존 원)이 **실제 셰이더로** 어떻게 그려지는지 상태별 대조 시트.
// 발자국 디자인을 고칠 때마다 이걸 돌려 눈으로 확인한다 (추측 금지).
//
//   node scripts/shot_mark.mjs out.png          # 발형(신발) + 존 원
//   node scripts/shot_mark.mjs out.png in       # 발형(맨발) 컨텍스트
//
// 사전 조건: npx vite --port 5199 --strictPort 가 떠 있어야 한다.
import puppeteer from 'puppeteer';

const [out = 'tmp_mark.png', ctx = 'out'] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 1560, height: 1120 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 160)); });
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));   // 디자인 스토어 + 글리프 SVG 로드 대기

const res = await p.evaluate(async (ctx) => {
  // 앱 자신의 THREE 인스턴스 — 별도 import 는 두 번째 인스턴스가 되어 재질이 섞인다
  const THREE = window.__dbg?.THREE;
  if (!THREE) throw new Error('window.__dbg.THREE 없음 — DEV 서버가 아니거나 부트 미완료');
  const T = await import('/src/tokens.js');
  const L = await import('/src/fxlut.js');
  L.FXP.footCtx = ctx;
  L.FXP.markShape = 1;

  // 글리프 SVG 로드 대기 (SDF 베이커가 이미지를 요구)
  for (let i = 0; i < 60; i++) {
    if (L.GLYPHS.img(L.footSlot(false)) && L.GLYPHS.img(L.footSlot(true))) break;
    await new Promise(r => setTimeout(r, 200));
  }

  const TILE = 340, PAD = 10;
  // 열 = 상태, 행 = 표현형
  const STATES = [
    { name: 'Preview 대기',    phase: 0, prog: 0.55 },
    { name: 'Active 0.35',     phase: 1, prog: 0.35 },
    { name: 'Active 0.80',     phase: 1, prog: 0.80 },
    { name: 'Hold 유지 0.6',   phase: 5, prog: 0.60 },
    { name: 'Success 성공',    phase: 2, prog: 0.00 },
    { name: 'Locked 고스트',   phase: 3, prog: 0.00 },
  ];
  const ROWS = [
    { name: '발 · 왼쪽', foot: 'left' },
    { name: '발 · 오른쪽', foot: 'right' },
    { name: '존 원(참고)', foot: null },
  ];

  const W = PAD + ROWS.length * 0 + 150 + STATES.length * (TILE + PAD);
  const H = 34 + ROWS.length * (TILE + PAD + 22) + PAD;
  const sheet = document.createElement('canvas');
  sheet.width = W; sheet.height = H;
  const s = sheet.getContext('2d');
  s.fillStyle = '#0d1014'; s.fillRect(0, 0, W, H);   // 투사 대상면(어두운 실내 바닥) 근사

  // 오프스크린 렌더러 하나로 타일을 반복 렌더
  const rc = document.createElement('canvas'); rc.width = rc.height = TILE;
  const renderer = new THREE.WebGLRenderer({ canvas: rc, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 2;

  const drawTile = (foot, st, x, y) => {
    let tex = null;
    if (foot) tex = L.footSDFTexture(foot === 'right');
    const mat = T.makeMarkFXMaterial(tex);
    const U = mat.uniforms;
    U.uPhase.value = st.phase; U.uProg.value = st.prog;
    U.uTime.value = 1.7;          // 고정 시각 = 결정론적 프레임
    U.uSeed.value = 0.9;
    U.uOut.value = 0;             // 컴포저 없이 직접 렌더 = raw 컨텍스트
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    if (foot) mesh.rotation.z = (foot === 'left' ? 8 : -8) * Math.PI / 180;
    scene.add(mesh);
    renderer.render(scene, cam);
    s.drawImage(rc, x, y);
    scene.remove(mesh);
    mesh.geometry.dispose(); mat.dispose();
    return !!tex;
  };

  s.font = "600 15px -apple-system, 'Malgun Gothic', sans-serif";
  s.fillStyle = '#8d949e'; s.textBaseline = 'middle';
  STATES.forEach((st, i) => {
    s.textAlign = 'center';
    s.fillText(st.name, 150 + i * (TILE + PAD) + TILE / 2, 18);
  });
  let sdfOk = true;
  ROWS.forEach((row, r) => {
    const y = 34 + r * (TILE + PAD + 22);
    s.textAlign = 'left'; s.fillStyle = '#c9ced6';
    s.fillText(row.name, PAD, y + TILE / 2);
    STATES.forEach((st, i) => {
      const ok = drawTile(row.foot, st, 150 + i * (TILE + PAD), y);
      if (row.foot && !ok) sdfOk = false;
    });
  });

  const wrap = document.createElement('div');
  wrap.id = '__sheet';
  Object.assign(wrap.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999' });
  sheet.style.display = 'block';
  wrap.appendChild(sheet);
  document.body.appendChild(wrap);
  return { sdfOk, w: W, h: H, slotL: L.GLYPHS.map[L.footSlot(false)], footLen: T.FOOT_LEN_M, plane: T.FOOT_PLANE_M };
}, ctx);

console.log('SDF 베이크:', res.sdfOk ? '정상' : '실패(글리프 미로드 — 폴백 발이 그려졌을 수 있음)');
console.log('왼발 슬롯:', res.slotL);
console.log('발 실치수:', res.footLen, 'm / 평면:', res.plane.toFixed(4), 'm');
await p.setViewport({ width: res.w, height: res.h });
await new Promise(r => setTimeout(r, 300));
await (await p.$('#__sheet')).screenshot({ path: out });
console.log('saved', out);
await b.close();
