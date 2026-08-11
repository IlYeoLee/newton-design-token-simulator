// 홀드 링이 알파 추출에서 왜 어두운 그림자가 되는가 — 실측 프로브(임시).
//   추측 금지(shot_mark.mjs 규율). 마크 재질을 투명 배경에 직접 렌더해 RGBA 를 그대로 읽는다.
//   찾는 것: **알파는 높은데 RGB 는 어두운 픽셀** = ProRes 스트레이트 알파에서 검정 그림자.
//   실행: npx vite --port 5199 --strictPort 떠 있는 상태에서  node scripts/_probe_hold_alpha.mjs
import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 800, height: 600 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const res = await p.evaluate(async () => {
  const THREE = window.__dbg?.THREE || (await import('/node_modules/three/build/three.module.js'));
  const T = await import('/src/tokens.js');
  const L = await import('/src/fxlut.js');
  const TILE = 256;
  const rc = document.createElement('canvas'); rc.width = rc.height = TILE;
  const renderer = new THREE.WebGLRenderer({ canvas: rc, alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 2;

  // shot_mark 와 같은 phase 표: Hold=5 · Active=1 · Success=2 (대조군)
  const CASES = [['Hold', 5, 0.60], ['Active', 1, 0.80], ['Success', 2, 0.00]];
  const out = [];
  for (const [name, phase, prog] of CASES) {
    const mat = T.makeMarkFXMaterial(L.footSDFTexture(false));
    const U = mat.uniforms;
    U.uPhase.value = phase; U.uProg.value = prog;
    U.uTime.value = 1.7; U.uSeed.value = 0.9; U.uOut.value = 0;
    if (U.uDay) U.uDay.value = 1;   // 추출 경로 = 주간 잉크(main.js dayOn 기본 true)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh); renderer.render(scene, cam);
    const g = rc.getContext('2d'); // WebGL 캔버스는 2d 컨텍스트가 없다 → readPixels 사용
    const buf = new Uint8Array(TILE * TILE * 4);
    renderer.getContext().readPixels(0, 0, TILE, TILE, 0x1908 /*RGBA*/, 0x1401 /*UNSIGNED_BYTE*/, buf);
    scene.remove(mesh); mesh.geometry.dispose(); mat.dispose();

    let n = 0, dark = 0, worst = null, sumA = 0, sumL = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const a = buf[i + 3] / 255; if (a < 0.02) continue;
      const r = buf[i] / 255, gg = buf[i + 1] / 255, bb = buf[i + 2] / 255;
      const lum = Math.max(r, gg, bb);
      n++; sumA += a; sumL += lum;
      // 검정 그림자 판정: 알파는 실한데 빛이 없다 = 뒤를 지우기만 하는 픽셀
      if (a > 0.25 && lum < 0.35) { dark++; if (!worst || lum < worst.lum) worst = { a, lum, r, g: gg, b: bb }; }
    }
    out.push({ name, n, dark, pct: n ? (dark / n * 100) : 0, avgA: n ? sumA / n : 0, avgL: n ? sumL / n : 0, worst });
  }
  return out;
});
await b.close();

console.log('\n  알파 있는 픽셀 중 "알파>0.25 인데 밝기<0.35" = 추출 시 검정 그림자\n');
for (const r of res) {
  console.log(`  ${r.name.padEnd(8)} 픽셀 ${String(r.n).padStart(6)}  검정 ${r.pct.toFixed(1)}%  평균알파 ${r.avgA.toFixed(3)}  평균밝기 ${r.avgL.toFixed(3)}`
    + (r.worst ? `   최악 a=${r.worst.a.toFixed(2)} lum=${r.worst.lum.toFixed(3)} rgb(${(r.worst.r*255)|0},${(r.worst.g*255)|0},${(r.worst.b*255)|0})` : ''));
}
