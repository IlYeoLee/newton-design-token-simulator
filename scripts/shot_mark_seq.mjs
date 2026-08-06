// 마크(발형·존원)를 **상태별 투명 PNG 시퀀스**로 뽑는다 — 알파 추출본을 파일로 확인하는 용도.
//
//   왜 이 경로인가: readPixels 는 프리멀티플라이드라 반투명 픽셀이 어둡게 읽힌다(08-06 실측).
//   canvas.toDataURL('image/png') 는 **스트레이트 알파**로 인코딩하므로 색이 그대로 남는다.
//   전체 화면 추출(export_video)과 달리 마크 재질만 직접 렌더해 다른 레이어가 안 섞인다 —
//   "마크가 문제냐, 합성이 문제냐"를 가르는 게 이 스크립트의 목적이다.
//   (홀드 검정 그림자 건: 격리 렌더가 잉크 밝기 1.000 · 어두운 픽셀 0.0% 로 나와 마크는 무죄였다.)
//
//   실행:  npx vite --port 5199 --strictPort 띄운 상태에서
//     node scripts/shot_mark_seq.mjs                              # 홀드 · 2초 · 24fps · 512px
//     node scripts/shot_mark_seq.mjs --state active --foot right
//     node scripts/shot_mark_seq.mjs --all --sec 1.5 --px 384     # 7토큰 전부, 상태별 폴더
//     node scripts/shot_mark_seq.mjs --state success --out out/success
//
//   ★ out/ 은 vite watch 제외 목록이라 렌더 중 리로드가 안 걸린다(vite.config.js 참조).
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

// 판정 토큰 번호 — footlab.html STATES · shot_mark.mjs 와 **같은 표**를 쓴다(따로 적으면 갈린다).
//   ★ Success·Miss 는 prog 0 이 가장 진한 순간이다(FootMark.glow 규약) — 0→1 스윕이
//     "터졌다 스러진다"가 된다. 나머지는 0→1 이 "차오른다"다. 의도된 차이다.
const STATES = { preview: 0, active: 1, success: 2, locked: 3, miss: 4, hold: 5, warning: 6 };
// ★ tap — READY 탭2 어포던스. 판정 상태가 아니라 **8번째 룩 토큰**이라 위 표에 없다.
//   FootMark.tapHint 규약: uPhase 3(Locked)·uProg 0 **고정**이고 상태는 안 바뀐다.
//   움직이는 건 투명도·게인뿐 — 5.6s 주기로 3.6s·4.35s 에 폭 0.55s 사인 펄스 두 번.
//   그래서 다른 상태와 달리 prog 스윕이 아니라 **시계**를 흘려야 한다.
const TAP = { T: 5.6, W: 0.55, P1: 3.6, P2: 4.35 };

const SEC = +arg('sec', 2), FPS = +arg('fps', 24), PX = +arg('px', 512);
const FOOT = arg('foot', 'left');          // left | right | zone(발 없이 존 원)
const ALL = process.argv.includes('--all');
const ST = String(arg('state', 'hold')).toLowerCase();
const OUT0 = arg('out', '');
// --glyph : 마크 안에 넣을 글리프. 기본 = 뉴턴 로고. 'none' 이면 안 넣는다.
var GLYPH = String(arg('glyph', '/newton-logo.svg'));
if (GLYPH === 'none') GLYPH = '';
// --glyphk : 글리프 크기 배수(기본 1 = 앱 규약). 워드마크처럼 가로로 긴 로고는 키워야 읽힌다.
const GLYPHK = +arg('glyphk', 1);
// --htpitch : 하프톤 격자 간격(기본 0.055 = 앱값). 글리프를 또렷하게 하려면 줄인다.
const HTP = +arg('htpitch', 0);
const N = Math.max(1, Math.round(SEC * FPS));

if (!ALL && !(ST in STATES) && ST !== 'tap') {
  console.error('  --state 는 ' + Object.keys(STATES).join(' | ') + ' | tap  중 하나 (또는 --all)');
  process.exit(1);
}
const JOBS = ALL ? [...Object.keys(STATES), 'tap'] : [ST];

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 200)));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));   // 디자인 스토어 + 글리프 로드 대기

for (const name of JOBS) {
  const OUT = (OUT0 && !ALL) ? OUT0 : path.join('out', 'mark_' + name);
  fs.mkdirSync(OUT, { recursive: true });
  const frames = await p.evaluate(async (N, PX, FOOT, SEC, PHASE, IS_TAP, TAP, GLYPH, GLYPHK, HTP) => {
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
    // tap 은 판정 상태가 아니라 룩 토큰 — mark-look.json 의 `tap` 을 재질에 입힌다(session.js tapHint 와 같은 호출).
    if (IS_TAP) T.applyMarkLookTo(mat, T.MARK_LOOK.tap || {});
    U.uPhase.value = PHASE;
    U.uSeed.value = 0.9;
    U.uOut.value = 0;               // 컴포저 없이 직접 렌더 = raw 컨텍스트
    if (U.uDay) U.uDay.value = 1;   // 추출 경로 = 주간 잉크(main.js dayOn 기본 true)
    // ── 글리프(뉴턴 로고) — 셰이더 안으로 물린다 ─────────────────────────────
    //   원과 **한 몸으로** 움직여야 한다. 위에 따로 얹으면 원이 밝아질 때 로고만 정지해
    //   둘이 따로 노는 그림이 된다(컨셉 영상에선 그게 바로 티가 난다).
    //   uNumTex 에 넣으면 하프톤 스킨이 로고에도 먹고, 잉크·글로우가 같이 간다.
    //   크기 규약은 tokens.js:759 와 같다 — 쿼드(=2) 의 MARK_NUM.RATIO/0.75 배,
    //   존 원은 실루엣이 글자를 안 받쳐 줘서 ZONE_GLYPH_K 로 한 번 더 키운다.
    if (GLYPH) {
      const FX = await import('/src/fx-core.js');
      const img = new Image();
      img.src = GLYPH;
      await new Promise(function (r) { img.onload = r; img.onerror = r; setTimeout(r, 4000); });
      if (img.naturalWidth) {
        const gc = document.createElement('canvas');
        gc.width = gc.height = 512;
        const g2 = gc.getContext('2d');
        const s = Math.min(512 / img.naturalWidth, 512 / img.naturalHeight) * 0.96;
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        g2.drawImage(img, (512 - dw) / 2, (512 - dh) / 2, dw, dh);
        const gt = new THREE.CanvasTexture(gc);
        gt.colorSpace = THREE.SRGBColorSpace;
        U.uNumTex.value = gt;
        U.uNumOn.value = 1;
        // ★ 글리프는 **하프톤이 켜져 있어야** 보인다. 방식이 '오버레이'가 아니라
        //   '도트 격자에서 글자 자리의 점을 빼는 것'이라(tokens.js:116 rad *= 1−inN),
        //   uHT 가 0 이면 격자가 없어 뺄 점도 없다 → 로고가 통째로 안 보인다(실측 08-06).
        if (U.uHT && U.uHT.value < 0.01) U.uHT.value = 1;
        if (HTP > 0 && U.uHTPitch) U.uHTPitch.value = HTP;
        U.uNumScale.value = FX.MARK_NUM.RATIO / 0.75 * (FOOT === 'zone' ? FX.ZONE_GLYPH_K : 1) * GLYPHK;
        U.uNumOff.value.set(0, 0);
      }
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh);

    const out = [];
    for (let i = 0; i < N; i++) {
      const u = i / Math.max(1, N - 1);
      if (IS_TAP) {
        // 시계를 5.6s 주기로 흘린다 — prog 는 고정, 펄스 두 번이 전부다.
        const tc = u * SEC, ph = tc % TAP.T;
        const bl = t0 => { const k = (ph - t0) / TAP.W; return (k >= 0 && k <= 1) ? Math.sin(k * Math.PI) : 0; };
        const bb = Math.max(bl(TAP.P1), bl(TAP.P2));
        U.uProg.value = 0;
        U.uFade.value = 0.72 + 0.28 * bb;
        if (U.uGain) U.uGain.value = 1.35 + 0.45 * bb;
        U.uTime.value = 1.7 + tc;
      } else {
      U.uProg.value = u;
      U.uTime.value = 1.7 + u * SEC;   // 일렁임·명멸도 같이 흐른다
      }
      renderer.render(scene, cam);
      out.push(rc.toDataURL('image/png'));   // ★ 스트레이트 알파
    }
    mesh.geometry.dispose(); mat.dispose(); renderer.dispose();
    return out;
  }, N, PX, FOOT, SEC, name === 'tap' ? STATES.locked : STATES[name], name === 'tap', TAP, GLYPH, GLYPHK, HTP);

  frames.forEach((d, i) =>
    fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')));
  console.log(`  ${name.padEnd(8)} → ${OUT}/f00000.png ~ f${String(N - 1).padStart(5, '0')}.png  (${N}장)`);
}
await b.close();

console.log(`\n  검수: 흰 배경·검은 배경 양쪽에 올려 비교(에펙은 스트레이트 알파로 임포트).`);
console.log(`  ffmpeg 로 합치려면:`);
console.log(`    ffmpeg -framerate ${FPS} -i out/mark_<state>/f%05d.png \\`);
console.log(`      -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out/mark_<state>.mov`);
