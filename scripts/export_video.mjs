// ─────────────────────────────────────────────────────────────
// 초고화질 영상 내보내기 — 실사 합성용
//
//   화면 녹화를 쓰지 않는 이유: rAF 가 실시간에 묶여 프레임이 빠지고(이 프로젝트에서
//   반복 확인됨), 모니터 해상도에 갇히고, 녹화 코덱이 한 번 더 압축한다.
//   대신 시계를 우리가 밀면서 한 프레임씩 렌더한다 → 드롭 0 · 4K 자유 · 무손실.
//
//   PNG 는 최종물이 아니라 중간 단계다. ffmpeg 가 바로 영상으로 묶는다.
//
//   사용:
//     node scripts/export_video.mjs --sport running --dur 3 --fps 30 --w 2560
//     node scripts/export_video.mjs --sport boxing --dur 5 --fps 60 --w 3840 --beam
//     node scripts/export_video.mjs --sport boxing --flat --dur 6 --fps 60 --w 2600   ← 정면 직교
//
//   옵션
//     --sport  running|boxing|basketball   기본 running
//     --dur    초 (기본 3)     --fps 기본 30      --w 가로 px (기본 2560, 16:9)
//     --flat   원근 없는 정면 직교 뷰. 카메라를 투사면 법선에 정렬한다.
//              2D 캔버스만 뽑는 export_ui.mjs 와 달리 판정 토큰(3D 셰이더 메시)이 들어온다.
//              화면비는 투사면 대지 비율(벽 2600x1600 · 지면 1600x2670) — 16:9 로 두면 늘어난다.
//     --ss     수퍼샘플링 배율 1~3 (기본: --flat 이면 2, 아니면 1).
//              N배로 렌더하고 영상만 줄인다 — 셰이더 가장자리·얇은 선의 계단이 여기서 죽는다.
//              PNG 시퀀스는 줄이지 않는다(에펙엔 원본을 주는 게 낫다).
//     --uiscale 대지 캔버스 배율. 기본은 '출력'의 1.5배(--flat 기준).
//              ⚠ 렌더 해상도(--ss 배)에 맞추지 말 것: 벽 기준 5200x3200 = 66MB 텍스처를 매 프레임
//              올리게 되고 블룸 타깃까지 겹쳐 74프레임에서 GPU 컨텍스트를 잃는다(실측).
//     --beam   투사광만 — 바닥·벽·봇·씬을 끄고 검은 배경. 에펙에서 Screen 으로 얹으면 된다.
//     --ht     하프톤 스킨 켜기
//     --alpha  배경 투명 (PNG/ProRes 4444). 기본은 검은 배경(가산 합성용)
//     --session  세션 시작(1인칭). 기본은 시작 화면(팩 타임라인)
//     --out    산출 경로 (기본 out/)
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
};
const SPORT = arg('sport', 'running');
const DUR = +arg('dur', 3);
const FPS = +arg('fps', 30);
const W = +arg('w', 2560);
// ★ --flat : 원근 없는 정면 뷰. 카메라를 직교로 바꿔 투사면 법선에 정렬한다.
//   2D 캔버스만 뽑는 export_ui.mjs 와 달리 판정 토큰(3D 셰이더 메시, 면 앞 z −1.05~−1.43)이
//   그대로 들어온다. 화면비는 투사면 대지 비율을 따른다 — 16:9 로 두면 늘어난다.
const FLAT = !!arg('flat', false);
const FBASE = SPORT === 'boxing' ? [2600, 1600] : [1600, 2670];   // 벽 / 지면 대지 px
// 수퍼샘플링 — N배로 렌더하고 영상만 줄인다. 셰이더 가장자리·얇은 선의 계단이 여기서 죽는다.
// PNG 시퀀스는 줄이지 않는다(에펙에 원본을 주는 게 항상 낫다).
const SS = Math.min(3, Math.max(1, +arg('ss', FLAT ? 2 : 1)));
const H = FLAT ? Math.round(W * FBASE[1] / FBASE[0]) : Math.round(W * 9 / 16);
const BEAM = !!arg('beam', false);
const HT = !!arg('ht', false);
const SESSION = !!arg('session', false);
const OUT = arg('out', 'out');
const URLBASE = arg('url', 'http://127.0.0.1:5199/');
// UI 캔버스 배율 — 실시간 기본 0.75. 4K 내보내기엔 2 이상이어야 확대 흐림이 없다.
// 평면 뷰는 투사면이 화면을 꽉 채우므로 대지 1px = 출력 1px 이상이어야 한다.
// 평면 뷰는 투사면이 화면을 꽉 채운다 — 대지 캔버스를 '출력'의 1.5배로 잡는다.
//   렌더 해상도(SS 배)에 맞추면 벽 기준 5200×3200 = 66MB 텍스처를 매 프레임 올리게 되고,
//   블룸 타깃까지 겹쳐 GPU 가 74프레임에서 컨텍스트를 잃었다(실측). 어차피 줄여서 내보내므로
//   출력의 1.5배면 선예도는 그대로고 메모리는 절반이다.
const UISCALE = +arg('uiscale', FLAT ? Math.min(3, Math.max(1, W / FBASE[0] * 1.5))
                                     : (W >= 3000 ? 2 : 1.25));
const ALPHA = !!arg('alpha', false);   // 배경 투명 PNG/ProRes 4444

const TMP = fs.mkdtempSync('/tmp/newton_export_');
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
const tag = `${SPORT}${SESSION ? '_session' : ''}${FLAT ? '_flat' : ''}${BEAM ? '_beam' : ''}${HT ? '_ht' : ''}${ALPHA ? '_alpha' : ''}_${W}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (출력 ${W}×${H} · 렌더 ${W * SS}×${H * SS}(SS×${SS}) · ${FPS}fps · ${DUR}s · UI 배율 ${UISCALE}${FLAT ? ' · 평면 직교' : ''})`);

// GPU 우선(맥은 metal). 실패하면 소프트웨어로 떨어진다 — 느리지만 결과는 같다.
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=metal', '--enable-gpu',
    '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
// ★ 가상 시계 — 페이지의 모든 시간을 우리가 민다.
//   이게 없으면 셰이더 uTime·three.Clock 이 '실시간'으로 돈다. 프레임 하나 렌더에 1~2초가
//   걸리므로 애니메이션이 그만큼 앞질러 가고, 결과 영상이 미친 듯이 빨라진다(유저: 너무 빠름).
//   performance.now·Date.now·rAF 타임스탬프를 전부 __vt 로 묶으면 시간은 우리 것이 된다.
await page.evaluateOnNewDocument(() => {
  window.__vt = 0;
  const P = performance;
  P.now = () => window.__vt;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(window.__vt));
  const D0 = 1735689600000;
  Date.now = () => D0 + window.__vt;
});
await page.setViewport({ width: W, height: H, deviceScaleFactor: SS });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto(`${URLBASE}?dev=1&uiscale=${UISCALE}${ALPHA ? '&alpha=1' : ''}`, { waitUntil: 'networkidle2', timeout: 180000 });
await page.waitForFunction('!!window.__dbg?.session', { timeout: 120000 });
// 부팅 동안에도 가상 시계를 밀어 준다 — 안 그러면 초기화가 시간 0 에 얼어붙는다.
const warm = async (ms, step = 16.7) => {
  for (let v = 0; v < ms; v += step) {
    await page.evaluate(vv => { window.__vt = vv; }, v);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  }
};
await new Promise(r => setTimeout(r, 9000));   // 에셋 로드(실시간 대기)
await warm(1200);                              // 가상 시계로 초기 애니메이션 워밍업

await page.evaluate(a => { window.__wantAlpha = a; }, ALPHA);
await page.evaluate(({ sport, beam, ht, session }) => {
  const d = window.__dbg;
  // 화면 정리 — 캔버스 말고는 전부 숨긴다.
  //   개별 선택자로 지우면 자막·클립 미리보기·빌드 스탬프처럼 빠뜨린 게 반드시 새어 나온다(실측).
  //   반대로 간다: 캔버스를 품은 조상만 남기고 나머지 DOM 을 통째로 숨긴다.
  //   ★ 한 번만 쓸면 안 된다 — session.start() 나 클립 재생이 '나중에' 새 DOM 을 만든다.
  //     실측: 클립 미리보기 패널(rgba(14,16,21,.92) z=30, 안에 <video>)이 우상단에 검은 알약으로
  //     남았다. 세션 시작이 청소 뒤라 청소를 피해 간 것. 그래서 함수로 두고 매 프레임 다시 쓴다.
  //   ★ 인라인 style 로 숨기면 안 된다 — 앱이 el.style.display 를 다시 쓰면 !important 까지 통째로
  //     날아간다(main.js:2854 ghostPrev). 스타일시트의 !important 규칙은 인라인 일반 선언을 이긴다.
  if (!document.getElementById('__exp')) {
    const st = document.createElement('style'); st.id = '__exp';
    st.textContent = '.__exphide{display:none!important}';
    document.head.appendChild(st);
  }
  window.__sweep = () => {
    const cvs = d.renderer.domElement;
    const keep = new Set();
    for (let el = cvs; el && el !== document.documentElement; el = el.parentElement) keep.add(el);
    document.querySelectorAll('body *').forEach(el => {
      if (!keep.has(el) && !el.contains(cvs)) el.classList.add('__exphide');
    });
    keep.forEach(el => { el.style.setProperty('background', 'transparent', 'important'); });
    document.body.style.background = window.__wantAlpha ? 'transparent' : '#000';
    if (window.__wantAlpha) { const st = document.getElementById('stage'); if (st) st.style.background = 'transparent'; }
  };
  window.__sweep();
  // 종목 전환은 좌측 버튼을 눌러야 한다 — state.pack 대입만으로는 씬이 안 바뀐다.
  const packBtn = { running: '러닝', boxing: '복싱', basketball: '농구' }[sport];
  [...document.querySelectorAll('button')].find(b => b.textContent.trim() === packBtn)?.click();
  if (ht) document.getElementById('btn-ht')?.click();
  if (session) d.session.start(sport);
  if (beam) {
    // ── 투사광만 ─────────────────────────────────────────────────────────────
    //   실사 합성용. 우리가 '쏘는 빛'만 남기고 무대(바닥·벽·봇·골대·그리드)를 전부 끈다.
    //   판별 기준은 재질이다 — 투사광은 ShaderMaterial(MARKFX·LANEFX·인물) 이거나
    //   맵을 가진 MeshBasicMaterial(투사 UI 평면)이다. PBR 재질은 전부 무대다.
    // background 를 null 로 두면 setSurfaces/applyDayAmbience 가 .setHex 를 부르다 죽는다
    //   (실측: 페이지 에러 2건). 검은 Color 로 둔다 — 결과는 같고 에러가 없다.
    if (d.scene.background?.setHex) d.scene.background.setHex(0x000000);
    if (d.scene.fog?.color?.setHex) d.scene.fog.color.setHex(0x000000);
    if (window.__wantAlpha) {
      // ★ 컴포저(EffectComposer)가 프레임 전체를 알파 1 로 덮는다 — 이게 '투명이 안 되던' 이유다.
      //   RenderPass.clearAlpha 를 0 으로 두면 배경이 비어 있는 채로 블룸·그레이드를 탄다.
      d.scene.background = null;
      d.renderer.setClearColor(0x000000, 0);
      const rp = d.composer?.passes?.[0];
      if (rp) rp.clearAlpha = 0;
      d.FXP && (d.FXP.__x = 1);
      // 알파는 그레이드 패스가 휘도에서 뽑는다(scene.js FX.alphaOut)
      import('/src/scene.js').then(m => { m.FX.alphaOut = true; }).catch(() => {});
    }
    else d.renderer.setClearColor(0x000000, 1);
    if (d.xbot?.root) d.xbot.root.visible = false;
    d.scene.traverse(o => {
      if (o.isLight) { o.intensity = 0; return; }
      if (/Grid|Axes|Box3/.test(o.type)) { o.visible = false; return; }
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      const keep = m.type === 'ShaderMaterial'
                || (m.type === 'MeshBasicMaterial' && !!m.map)
                || o.type === 'Line' || o.type === 'LineSegments';
      if (!keep) o.visible = false;
    });
  }
  window.__sweep();   // ★ session.start 뒤에 한 번 더 — 클립 미리보기 패널이 그때 생긴다
}, { sport: SPORT, beam: BEAM, ht: HT, session: SESSION });

if (FLAT) await page.evaluate(sport => {
  // ── 평면 정면 뷰 ────────────────────────────────────────────────────────
  //   투사면(벽 또는 지면) 메시의 로컬 축을 월드로 옮겨 그 법선 위에 직교 카메라를 세운다.
  //   원근이 0이므로 대지 좌표가 화면 좌표로 1:1 사상된다 — 피그마 프레임과 같은 그림.
  //   판정 토큰은 면 앞 z −1.05~−1.43 에 있어 이 절두체 안에 그대로 들어온다.
  const d = window.__dbg, T = d.THREE;
  const surf = sport === 'boxing' ? d.wallGL?.mesh : d.floorGL?.mesh;
  if (!surf) { window.__flatErr = '투사면 메시 없음'; return; }
  surf.visible = true;
  surf.updateWorldMatrix(true, false);
  const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  surf.matrixWorld.decompose(p, q, s);
  const g = surf.geometry.parameters;                       // PlaneGeometry(대지 px)
  const hw = g.width * s.x / 2, hh = g.height * s.y / 2;
  const n = new T.Vector3(0, 0, 1).applyQuaternion(q);      // 면 법선(앞쪽)
  const dist = Math.max(hw, hh) * 4 + 5;
  const cam = new T.OrthographicCamera(-hw, hw, hh, -hh, 0.01, dist * 3);
  cam.position.copy(p).addScaledVector(n, dist);
  cam.up.copy(new T.Vector3(0, 1, 0).applyQuaternion(q));
  cam.lookAt(p);
  cam.updateMatrixWorld(true);
  // 렌더 카메라만 갈아 끼운다 — 앱은 매 틱 자기 camera 를 움직이지만 그건 이제 안 쓰인다.
  (d.sceneScope?.setRenderCamera ?? (c => { d.composer.passes[0].camera = c; }))(cam);
  d.composer.passes[0].camera = cam;
  window.__flatCam = cam;
}, SPORT);

await page.evaluate(() => {
  // 좌패널을 숨겨도 캔버스는 예전 폭으로 굳어 있다 — 리사이즈를 강제해 뷰포트를 꽉 채운다(검은 띠 제거).
  const st = document.getElementById('stage');
  if (st) { st.style.position = 'fixed'; st.style.inset = '0'; st.style.width = '100%'; st.style.height = '100%'; }
  window.dispatchEvent(new Event('resize'));
});
await new Promise(r => setTimeout(r, 2500));
// 안정화 동안 늦게 붙은 DOM 까지 마지막으로 한 번. (매 프레임 쓸면 800개 스타일 재계산으로
// 프레임 시간이 2.7s→5.6s 로 뛰고 컨텍스트도 더 일찍 잃는다 — 실측.)
await page.evaluate(() => window.__sweep?.());

const t0 = Date.now();
let done = 0;
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  // ★ 4K + 큰 uiscale 은 GPU 메모리를 넘겨 컨텍스트를 잃는다(실측: 3840·배율2.5 에서 11프레임째
  //   __dbg 통째로 소실). 죽으면 조용히 끝내고 여기까지 뽑은 프레임으로 영상을 묶는다.
  const alive = await page.evaluate(() => !!window.__dbg?.state).catch(() => false);
  if (!alive) { console.log(`\n⚠ ${i}프레임에서 페이지 소실(컨텍스트 손실 추정) — uiscale 을 낮추세요.`); break; }
  await page.evaluate(tt => new Promise(res => {
    const d = window.__dbg;
    window.__vt = 1200 + tt * 1000;          // 가상 시계 — 셰이더·클록이 전부 이걸 본다
    if (window.__flatCam) d.composer.passes[0].camera = window.__flatCam;   // 앱이 되돌려 놓지 못하게
    d.state.playing = false;
    d.state.time = tt;
    if (d.session?.active) d.session.t = tt;
    requestAnimationFrame(() => requestAnimationFrame(res));
  }), t);
  await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(5, '0')}.png`), type: 'png', omitBackground: ALPHA });
  done = i + 1;
  if (i % 10 === 0 || i === N - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${i + 1}/${N}  ${el.toFixed(0)}s  (${(el / (i + 1)).toFixed(2)}s/프레임)   `);
  }
}
process.stdout.write('\n');
// 렌더가 끝난 시점에 캔버스 밖 DOM 이 아직 보이면 그건 프레임에 새어 든 것이다 — 조용히 넘기지 않는다.
const leaked = await page.evaluate(() => {
  const cvs = window.__dbg?.renderer?.domElement; if (!cvs) return [];
  return [...document.querySelectorAll('body *')]
    .filter(el => !el.contains(cvs) && getComputedStyle(el).display !== 'none'
                  && el.getBoundingClientRect().width > 0)
    .map(el => `${el.tagName}#${el.id || ''}.${el.className || ''}`.slice(0, 60)).slice(0, 8);
}).catch(() => []);
if (leaked.length) console.log(`⚠ 캔버스 밖에서 보이는 요소 ${leaked.length}건 — 프레임에 섞였을 수 있습니다:`, leaked);
if (!done) { console.log('프레임이 하나도 없습니다 — 중단.'); await browser.close(); process.exit(1); }
if (done < N) console.log(`  (${done}/${N} 프레임으로 묶습니다 — ${(done / FPS).toFixed(1)}초)`);

// ProRes 4444 — 에펙에 그대로 임포트. 알파는 안 쓴다(가산 합성이라 검은 배경이면 충분).
// SS 배로 렌더했으면 여기서 줄인다 — lanczos 로 내리는 게 GPU 안티에일리어싱보다 깨끗하다.
const DOWN = SS > 1 ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : [];
const mov = path.join(OUT, `${tag}.mov`);
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
  ...DOWN, '-c:v', 'prores_ks', '-profile:v', '4444',
  '-pix_fmt', ALPHA ? 'yuva444p10le' : 'yuv444p10le', mov], { stdio: ['ignore','ignore','inherit'] });
// 미리보기용 H.264
const mp4 = path.join(OUT, `${tag}_preview.mp4`);
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
  '-vf', `scale=${W}:${H}:flags=lanczos`,
  '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', mp4], { stdio: ['ignore','ignore','inherit'] });

if (ALPHA) {   // 알파는 PNG 시퀀스가 가장 확실하다 — 에펙에서 그대로 임포트
  const seq = path.join(OUT, `${tag}_png`);
  fs.rmSync(seq, { recursive: true, force: true });
  fs.renameSync(TMP, seq);
  console.log(`   ${seq}/  (PNG 시퀀스 · 알파 보존)`);
} else fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n✅ ${mov}\n   ${mp4}`);
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
