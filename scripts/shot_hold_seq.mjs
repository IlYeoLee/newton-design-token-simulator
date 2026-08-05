// 홀드 상태만 **투명 PNG 시퀀스**로 뽑는다 — 알파 추출에서 링이 어떻게 나오는지 파일로 확인용.
//
//   왜 이 경로인가: readPixels 는 프리멀티플라이드라 반투명 픽셀이 어둡게 읽힌다(실측 확인).
//   canvas.toDataURL('image/png') 는 **스트레이트 알파**로 인코딩하므로 색이 그대로 남는다.
//   전체 화면 추출(export_video)과 달리 마크 재질만 직접 렌더해 다른 요소가 안 섞인다.
//
//   실행:  npx vite --port 5199 --strictPort 띄운 상태에서
//     node scripts/shot_hold_seq.mjs                    # 2초 · 24fps · 512px · out/hold_png
//     node scripts/shot_hold_seq.mjs --sec 3 --fps 30 --px 768 --out out/hold3s
//
//   결과 폴더에 f00000.png ~ 가 쌓이고, 끝에 알파 통계를 찍는다.
//   ★ out/ 은 vite watch 제외 목록이라 렌더 중 리로드가 안 걸린다(vite.config.js 참조).
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEC = +arg('sec', 2), FPS = +arg('fps', 24), PX = +arg('px', 512);
const OUT = arg('out', 'out/hold_png');
const FOOT = arg('foot', 'left');          // left | right | zone(발 없이 존 원)
const N = Math.max(1, Math.round(SEC * FPS));

fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));   // 디자인 스토어 + 글리프 로드 대기

console.log(`  홀드 시퀀스 — ${SEC}s · ${FPS}fps · ${N}프레임 · ${PX}px · ${FOOT}`);

const frames = await p.evaluate(async (N, PX, FOOT, SEC) => {
  const THREE = window.__dbg?.THREE || (await import('/node_modules/three/build/three.module.js'));
  const T = await import('/src/tokens.js');
  const L = await import('/src/fxlut.js');
  const rc = document.createElement('canvas'); rc.width = rc.height = PX;
  const renderer = new THREE.WebGLRenderer({ canvas: rc, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);            // 완전 투명 — 검정을 깔지 않는다
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 2;

  const tex = FOOT === 'zone' ? null : L.footSDFTexture(FOOT === 'right');
  const mat = T.makeMarkFXMaterial(tex);
  const U = mat.uniforms;
  U.uPhase.value = 5;          // 홀드 (shot_mark.mjs 상태표와 동일)
  U.uSeed.value = 0.9;
  U.uOut.value = 0;            // 컴포저 없이 직접 렌더 = raw 컨텍스트
  if (U.uDay) U.uDay.value = 1;   // 추출 경로 = 주간 잉크(main.js dayOn 기본 true)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(mesh);

  const out = [];
  for (let i = 0; i < N; i++) {
    const u = i / Math.max(1, N - 1);
    U.uProg.value = u;                 // 링이 0 → 한 바퀴
    U.uTime.value = 1.7 + u * SEC;     // 일렁임·명멸도 같이 흐른다
    renderer.render(scene, cam);
    out.push(rc.toDataURL('image/png'));   // ★ 스트레이트 알파
  }
  mesh.geometry.dispose(); mat.dispose(); renderer.dispose();
  return out;
}, N, PX, FOOT, SEC);
await b.close();

let semi = 0, opaque = 0, total = 0;
frames.forEach((d, i) => {
  const buf = Buffer.from(d.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.png`), buf);
});
console.log(`  → ${OUT}/f00000.png ~ f${String(N - 1).padStart(5, '0')}.png  (${N}장)`);
console.log(`  검수: 에펙에 스트레이트 알파로 임포트 · 흰 배경/검은 배경 양쪽에 올려 비교.`);
console.log(`  ffmpeg 로 합치려면(프리멀티 왕복 = 알파 경계에서 색 안 번짐):`);
console.log(`    ffmpeg -framerate ${FPS} -i ${OUT}/f%05d.png -vf premultiply=inplace=1,unpremultiply=inplace=1 \\`);
console.log(`      -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le ${OUT}.mov`);
