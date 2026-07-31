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
import os from 'os';
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
const ALPHA0 = !!arg('alpha', false);   // 배경 투명 PNG/ProRes 4444
// ★ --alpha 는 --beam 을 함축한다. 알파를 휘도에서 뽑는 방식(scene.js FX.alphaOut)이라
//   무대(바닥·벽·봇)가 켜져 있으면 밝은 무대까지 불투명해진다 — 투명 매트가 안 나온다.
//   예전엔 알파 코드가 if(beam) 안에만 있어서 --alpha 단독은 조용히 검은 배경이 나왔다.
const BEAM = !!arg('beam', false) || ALPHA0;
const HT = !!arg('ht', false);
const SESSION = !!arg('session', false);
// ★ --stage — 세션은 READY 에서 '발 두 번 탭' 게이트를 기다린다. 헤드리스엔 그 입력이 없으므로
//   --session 만 주면 인트로 1.1초 재생 뒤 화면이 완전히 정지한다(실측: 러닝 5초 300프레임 중
//   69프레임째부터 231장이 바이트 단위로 동일). 판정 토큰은 애초에 READY 에 없다.
//   실전 스테이지로 바로 넣으려면 id 를 지정한다. --liststages 로 목록.
const STAGE = arg('stage', '');
const LISTSTAGES = !!arg('liststages', false);
// --play : 시뮬을 실제로 돌린다(봇·물리). 스크럽으로 못 살리는 상태 누적형 화면용 — 위 루프 주석 참조.
const PLAY = !!arg('play', false);
// --alphafloor : 이 밝기(0~1) 아래는 완전 투명. 대지 패널의 검정 배경이 옅은 알파로 남아
//   투사면 사각형이 통째로 비쳐 보이던 것(유저 지적)을 잘라 낸다. 0.06~0.12 부터 시도.
const AFLOOR = +arg('alphafloor', 0) || 0;
const OUT = arg('out', 'out');
const URLBASE = arg('url', 'http://127.0.0.1:5199/');
// UI 캔버스 배율 — 실시간 기본 0.75. 4K 내보내기엔 2 이상이어야 확대 흐림이 없다.
// 평면 뷰는 투사면이 화면을 꽉 채우므로 대지 1px = 출력 1px 이상이어야 한다.
// 평면 뷰는 투사면이 화면을 꽉 채운다 — 대지 캔버스를 '출력'의 1.5배로 잡는다.
//   렌더 해상도(SS 배)에 맞추면 벽 기준 5200×3200 = 66MB 텍스처를 매 프레임 올리게 되고,
//   블룸 타깃까지 겹쳐 GPU 가 74프레임에서 컨텍스트를 잃었다(실측). 어차피 줄여서 내보내므로
//   출력의 1.5배면 선예도는 그대로고 메모리는 절반이다.
// ★ 기본값은 '대지 ≥ 출력'에 여유 5% 만. 예전 기본(출력의 1.5배)은 4K 에서 한계를 넘었다:
//   러닝 2302 → 배율 2.16 → 대지 3453×5762 ≈ 80MB, 복싱 3840 → 2.22 → 5759×3544 ≈ 82MB.
//   위 주석의 66MB 함정 그대로다. 증상이 고약하다 — 컨텍스트 손실 에러도, 삼각형 0 도 아니고
//   그냥 '완전 투명한 프레임'이 480장 쌓인다(실측: 8초 4K 러닝·복싱 전량 손실).
//   대지가 출력보다 크기만 하면 선예도는 같다. 그 이상은 어차피 줄이면서 버려진다.
const UISCALE = +arg('uiscale', FLAT ? Math.min(3, Math.max(1, W / FBASE[0] * 1.05))
                                     : (W >= 3000 ? 2 : 1.25));
const ALPHA = ALPHA0;

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'newton_export_'));
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
const tag = `${SPORT}${SESSION ? '_session' : ''}${FLAT ? '_flat' : ''}${BEAM ? '_beam' : ''}${HT ? '_ht' : ''}${ALPHA ? '_alpha' : ''}_${W}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (출력 ${W}×${H} · 렌더 ${W * SS}×${H * SS}(SS×${SS}) · ${FPS}fps · ${DUR}s · UI 배율 ${UISCALE}${FLAT ? ' · 평면 직교' : ''})`);

// GPU 우선(맥은 metal). 실패하면 소프트웨어로 떨어진다 — 느리지만 결과는 같다.
const browser = await puppeteer.launch({
  headless: 'new',
  // ANGLE 백엔드는 OS 마다 다르다 — 맥은 metal, 윈도는 d3d11. 틀린 값을 주면 조용히
  // 소프트웨어(SwiftShader)로 떨어져 프레임당 수 초씩 느려진다.
  args: ['--no-sandbox', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`,
    '--enable-gpu', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
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
  // ★ <video> 는 미디어 클록으로 돈다 — performance.now 를 가로채도 안 묶인다.
  //   재생을 그대로 두면 프레임 한 장 렌더에 걸리는 실제 시간(0.2~0.5초)만큼 영상이 앞질러 가
  //   인물만 12~30배로 빨라진다(유저: "16배속한 것처럼"). 루프에서 pause() 만으론 부족하다 —
  //   앱이 매 틱 play() 를 다시 부른다(실측: bhandle_pp.mp4 가 계속 paused:false).
  //   재생 자체를 막고, 프레임마다 currentTime 을 우리가 직접 찍는다.
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
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

await page.evaluate(p => { window.__play = p; }, PLAY);
await page.evaluate(v => { window.__afloor = v; }, AFLOOR);
await page.evaluate(a => { window.__wantAlpha = a; }, ALPHA);
// ★ stage 를 구조분해에 반드시 넣을 것 — 빠뜨리면 브라우저 전역의 #stage DOM 요소가 잡힌다
//   (id 를 가진 요소는 window 의 프로퍼티가 된다). 실측: '없는 스테이지: [object HTMLElement]'.
await page.evaluate(({ sport, beam, ht, session, stage, listStages }) => {
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
  if (session) {
    d.session.start(sport);
    if (stage || listStages) {
      const ids = (d.session.stages || []).map(s => s.id);
      window.__stages = ids;
      if (stage) {
        const i = ids.indexOf(stage);
        // 스테이지 점프는 세션이 스스로 쓰는 관용구 그대로 (session.js _gateAdvance)
        if (i >= 0) { d.session.stageIdx = i; d.session.t = 0; d.session._enter(); }
        else window.__stageErr = `없는 스테이지: ${stage}`;
      }
    }
  }
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
      import('/src/scene.js').then(m => { m.FX.alphaOut = true; m.FX.alphaFloor = window.__afloor || 0; }).catch(() => {});
    }
    else d.renderer.setClearColor(0x000000, 1);
    if (d.xbot?.root) d.xbot.root.visible = false;
    d.scene.traverse(o => {
      if (o.isLight) { o.intensity = 0; return; }
      if (/Grid|Axes|Box3/.test(o.type)) { o.visible = false; return; }
      // ★ 이름으로 지목하는 무대. 재질만 보면 놓친다 — 코트 라인·존은 SDF(ShaderMaterial)라
      //   '셰이더 = 투사광' 규칙에 걸리고, 골대의 슈터스 스퀘어·그물은 LineSegments 라
      //   '선 = 투사광' 규칙에 걸린다. 둘 다 무대지 우리가 쏘는 빛이 아니다
      //   (유저: 평면 뷰 배경에 코트 원·대각선이 남아 보임).
      if (/^(courtLines|courtZones|hoop)$/.test(o.name)) { o.visible = false; return; }
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      const keep = m.type === 'ShaderMaterial'
                || (m.type === 'MeshBasicMaterial' && !!m.map)
                || o.type === 'Line' || o.type === 'LineSegments';
      if (!keep) o.visible = false;
    });
  }
  window.__sweep();   // ★ session.start 뒤에 한 번 더 — 클립 미리보기 패널이 그때 생긴다
}, { sport: SPORT, beam: BEAM, ht: HT, session: SESSION, stage: STAGE, listStages: LISTSTAGES });

if (SESSION && (STAGE || LISTSTAGES)) {
  const { ids, err } = await page.evaluate(() => ({ ids: window.__stages, err: window.__stageErr }));
  if (LISTSTAGES) { console.log(`${SPORT} 스테이지: ${(ids || []).join(' ')}`); await browser.close(); process.exit(0); }
  if (err) { console.error(`✗ ${err}\n  있는 것: ${(ids || []).join(' ')}`); await browser.close(); process.exit(1); }
  console.log(`  스테이지 ${STAGE} 진입`);
}

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
  // ★ 매 프레임 투사면에 다시 맞춘다 — 한 번만 계산하면 안 된다.
  //   러닝은 주자가 전진하면서 지면 UI 평면이 z 로 계속 움직인다(main.js followFloor·loopShiftZ).
  //   고정 카메라는 곧 평면을 절두체 밖으로 흘려보내 화면이 통째로 빈다
  //   (실측: 러닝 C2·A3·P2 전부 0.4~1초 뒤 평균 알파 28 → 0.4, 즉 빈 프레임).
  //   벽(복싱)·농구는 투사면이 제자리라 이 버그가 안 드러났다.
  //   대지 크기·스케일은 안 변하므로 절두체는 그대로 두고 위치·자세만 다시 잡는다.
  window.__fitFlat = () => {
    surf.updateWorldMatrix(true, false);
    surf.matrixWorld.decompose(p, q, s);
    const nn = new T.Vector3(0, 0, 1).applyQuaternion(q);
    cam.position.copy(p).addScaledVector(nn, dist);
    cam.up.copy(new T.Vector3(0, 1, 0).applyQuaternion(q));
    cam.lookAt(p);
    cam.updateMatrixWorld(true);
  };
  window.__fitFlat();
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
// ★ --flat 이 실제로 걸렸는지 한 번 확인하고 넘어간다. 조용히 실패하면 원근 그림이 나오는데,
//   그건 '조금 이상한 영상'이라 눈으로는 버그로 안 보이고 카메라 각도 문제처럼 보인다.
if (FLAT) {
  const st = await page.evaluate(() => ({
    err: window.__flatErr, cam: window.__dbg?.composer?.passes?.[0]?.camera?.type,
    same: window.__dbg?.composer?.passes?.[0]?.camera === window.__flatCam,
  }));
  if (st.err) { console.error(`✗ --flat 실패: ${st.err}`); process.exit(1); }
  if (st.cam !== 'OrthographicCamera' || !st.same) {
    console.error(`✗ --flat 실패: 렌더 카메라가 ${st.cam} (직교로 안 바뀜)`); process.exit(1);
  }
  console.log(`  평면 직교 카메라 적용됨`);
}

const t0 = Date.now();
let done = 0;
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  // ★ 4K + 큰 uiscale 은 GPU 메모리를 넘겨 컨텍스트를 잃는다(실측: 3840·배율2.5 에서 11프레임째
  //   __dbg 통째로 소실). 죽으면 조용히 끝내고 여기까지 뽑은 프레임으로 영상을 묶는다.
  // ★ __dbg?.state 만 보면 안 된다 — WebGL 컨텍스트를 잃어도 JS 객체는 멀쩡히 남는다.
  //   그러면 렌더만 조용히 죽어 '완전 투명한 프레임'이 계속 쌓인다(실측: 4K 세 종목을 연달아
  //   돌렸더니 2·3번째가 480장 전부 불투명 픽셀 0.00% — 20분을 통째로 날렸다).
  //   컨텍스트를 직접 물어본다.
  const alive = await page.evaluate(() => {
    const d = window.__dbg; if (!d?.state) return false;
    const gl = d.renderer?.getContext?.();
    return !(gl && gl.isContextLost && gl.isContextLost());
  }).catch(() => false);
  if (!alive) { console.log(`\n⚠ ${i}프레임에서 WebGL 컨텍스트 손실 — uiscale 을 낮추거나 종목을 하나씩 돌리세요.`); break; }
  await page.evaluate(tt => new Promise(res => {
    const d = window.__dbg;
    window.__vt = 1200 + tt * 1000;          // 가상 시계 — 셰이더·클록이 전부 이걸 본다
    // ★ 투사 UI 강제 재도색 — 게이트가 두 겹이라 둘 다 풀어야 한다(export_ui.mjs 와 같은 수법).
    //   ① _lastPaint: UI_FPS(기본 12) 스로틀. 실시간 예산용인데 내보내기는 프레임당 수 초 걸리는
    //      오프라인 렌더라 의미가 없다. ?uifps=60 으로 올려도 안 된다 — 가상 시계 간격이 정확히
    //      1/60 이라 `t - _lastPaint < 1/UI_FPS` 가 부동소수점 경계에 걸려 한 프레임 걸러 스킵한다.
    //   ② _sig: floorgl 의 서명 비교. _sigOf() 가 시간을 Math.round(t*24) 로 24Hz 양자화하므로
    //      60fps 로 뽑아도 지면 UI 는 24fps 로 덜컹인다.
    //   실측: 이 두 줄 없이 러닝 5초 299쌍 중 232쌍이 완전 중복 — 씬은 도는데 UI 만 멈춰 있다.
    for (const g of [d.floorGL, d.wallGL]) if (g) { g._lastPaint = -1; g._sig = null; }
    if (window.__flatCam) d.composer.passes[0].camera = window.__flatCam;   // 앱이 되돌려 놓지 못하게
    // ★ 시간 모델 두 가지.
    //   기본(스크럽): playing=false 로 두고 t 를 직접 꽂는다. 앱이 시간의 순수 함수인 부분
    //     (셰이더 토큰·UI 트윈)은 이걸로 완벽히 재현된다.
    //   --play(시뮬): 재생을 켜고 가상 시계가 밀게 둔다. 봇·물리처럼 '상태를 쌓아 가는' 것은
    //     스크럽으로 되살릴 수 없다 — 실측: 러닝 C2 는 스크럽에서 0.95초 뒤 완전 정지한다
    //     (라이브 수치가 봇 프로브에서 오는데 봇이 얼어 있어서). 가상 시계가 우리 것이라
    //     재생을 켜도 결정론은 그대로다: 같은 명령 = 같은 프레임.
    if (window.__play) { d.state.playing = true; }
    else { d.state.playing = false; d.state.time = tt; if (d.session?.active) d.session.t = tt; }
    // ★ <video> 를 가상 시계에 묶는다 — 이게 '16배속'의 진짜 원인이었다.
    //   performance.now·Date.now·rAF 는 우리가 가로챘지만 미디어 클록은 못 가로챈다.
    //   비디오는 실제 시간으로 계속 재생되는데 프레임 한 장 렌더에 0.2~0.5초가 걸리므로,
    //   내보낸 1/60초 사이에 영상은 0.2~0.5초어치 진행한다(실측: 가상 시계 +0.0167s 동안
    //   bhandle_pp.mp4 의 currentTime 이 1.0초 이동). 인물 실루엣만 12~30배로 빨라진다.
    //   UI·토큰은 가상 시계라 정상 속도 → '사람만 미친 듯이 빠른' 그림이 된다.
    //   재생을 멈추고 프레임마다 currentTime 을 직접 찍는다. 시크는 비동기라 기다려야 한다.
    const vids = [...document.querySelectorAll('video')].filter(v => isFinite(v.duration) && v.duration > 0);
    Promise.all(vids.map(v => new Promise(r => {
      if (!v.paused) v.pause();
      const want = v.loop ? (tt % v.duration) : Math.min(tt, v.duration);
      if (Math.abs(v.currentTime - want) < 1e-3) return r();
      const done = () => { v.removeEventListener('seeked', done); r(); };
      v.addEventListener('seeked', done);
      v.currentTime = want;
      setTimeout(done, 250);          // 시크가 안 끝나도 렌더는 진행 — 멈추는 것보단 낫다
    }))).then(() => {
      // 첫 rAF 는 앱의 갱신·렌더가 끝난 뒤에 돈다(앱 루프가 먼저 등록돼 있다) — 거기서 카메라를
      // 이번 프레임의 투사면 위치에 다시 맞추면, 두 번째 틱의 렌더가 그 카메라로 그린다.
      requestAnimationFrame(() => { window.__fitFlat?.(); requestAnimationFrame(res); });
    });
  }), t);
  await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(5, '0')}.png`), type: 'png', omitBackground: ALPHA });
  // ★ 첫 프레임에 아무것도 안 그려졌으면 즉시 멈춘다. 컨텍스트가 살아 있어도 씬이 통째로
  //   비어 있으면(무대 끄기가 과했거나 카메라가 엉뚱한 곳을 보면) 끝까지 빈 프레임만 쌓인다.
  if (i === 0) {
    const tri = await page.evaluate(() => window.__dbg?.renderer?.info?.render?.triangles ?? -1);
    if (tri === 0) {
      console.error('✗ 첫 프레임에 그려진 삼각형이 0개 — 빈 영상이 됩니다. 중단합니다.');
      await browser.close(); process.exit(1);
    }
    // ★ 삼각형이 0 이 아니어도 결과가 텅 빌 수 있다 — GPU 메모리가 모자라 텍스처 업로드가
    //   조용히 실패하면 컨텍스트도 안 죽고 에러도 안 나는데 화면만 비어 있다(실측: 4K 러닝).
    //   ponytail: PNG 파일 크기로 판별한다. 완전 투명한 4K 프레임은 40KB 대로 압축되고
    //   내용이 있으면 300KB 를 넘는다 — 정밀하진 않지만 이 실패를 확실히 잡고 비용이 0이다.
    //   더 정확히 보려면 프레임을 디코드해 알파를 재야 한다(그러자고 의존성을 늘릴 값어치는 없다).
    const kb = fs.statSync(path.join(TMP, 'f00000.png')).size / 1024;
    if (W * H > 2e6 && kb < 80) {
      console.error(`✗ 첫 프레임이 사실상 비어 있습니다(${kb.toFixed(0)}KB) — GPU 메모리 부족으로 추정.`);
      console.error(`  --uiscale 을 낮추세요(지금 ${UISCALE.toFixed(2)}). 4K 지면은 1.2 안팎이 안전합니다.`);
      await browser.close(); process.exit(1);
    }
  }
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

// ffmpeg 는 선택이다 — 에펙에 얹을 최종물은 PNG 시퀀스이고, .mov 는 편의용 사본일 뿐이다.
// (윈도엔 시스템 ffmpeg 가 없는 기기가 있다 — 그때 여기서 죽으면 뽑아 둔 프레임까지 날린다.
//  ffmpeg-static 이 깔려 있으면 그 바이너리를 쓴다: 시스템 설치 없이 .mov/.mp4 가 나온다.)
const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const hasFF = (() => {
  try { execFileSync(FF, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
})();
// ★ 프레임을 먼저 산출 폴더로 옮기고 나서 인코딩한다 — 순서가 중요하다.
//   예전엔 TMP 에서 바로 인코딩하고 그 뒤에 옮겼다. mp4 인코딩이 실패하면 예외가 스크립트를
//   죽여 20분치 4K 프레임이 임시 폴더에 갇혔다(실측: 홀수 높이 3841 로 libx264 가 죽음).
//   렌더가 끝난 프레임은 무조건 먼저 건진다. 인코딩은 그다음 문제다.
const seq = path.join(OUT, `${tag}_png`);
fs.rmSync(seq, { recursive: true, force: true });
fs.renameSync(TMP, seq);
const SRC = path.join(seq, 'f%05d.png');
const made = [`${seq}${path.sep}  (PNG 시퀀스 ${done}장 · ${W * SS}×${H * SS}${ALPHA ? ' · 알파 보존' : ''})`];

// 인코딩은 실패해도 넘어간다 — 최종물은 PNG 시퀀스이고 .mov/.mp4 는 편의용 사본이다.
const enc = (label, out, args) => {
  try { execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', SRC, ...args, out],
    { stdio: ['ignore', 'ignore', 'ignore'] }); made.push(out); }
  catch { console.log(`⚠ ${label} 인코딩 실패 — 건너뜁니다(PNG 시퀀스는 위에 있습니다).`); }
};
if (hasFF) {
  // ProRes 4444 — 에펙에 그대로 임포트. 홀수 크기도 받는다.
  // SS 배로 렌더했으면 여기서 줄인다 — lanczos 로 내리는 게 GPU 안티에일리어싱보다 깨끗하다.
  const DOWN = SS > 1 ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : [];
  enc('ProRes', path.join(OUT, `${tag}.mov`),
    [...DOWN, '-c:v', 'prores_ks', '-profile:v', '4444',
     '-pix_fmt', ALPHA ? 'yuva444p10le' : 'yuv444p10le']);
  // 미리보기용 H.264 — ★ 짝수 크기로 내려야 한다. 평면 뷰는 대지 비율을 따르므로 홀수가 흔하다
  //   (벽 3840×2363 · 지면 2302×3841). libx264 는 홀수 높이를 못 쓴다.
  enc('H.264 미리보기', path.join(OUT, `${tag}_preview.mp4`),
    ['-vf', `scale=${W - (W % 2)}:${H - (H % 2)}:flags=lanczos`,
     '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p']);
} else console.log('ⓘ ffmpeg 없음 — PNG 시퀀스만 냅니다(에펙은 이걸 그대로 읽습니다).');
console.log('\n✅ ' + made.join('\n   '));
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
