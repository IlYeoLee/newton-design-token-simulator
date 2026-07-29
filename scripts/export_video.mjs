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
//
//   옵션
//     --sport  running|boxing|basketball   기본 running
//     --dur    초 (기본 3)     --fps 기본 30      --w 가로 px (기본 2560, 16:9)
//     --beam   투사광만 — 바닥·벽·봇·씬을 끄고 검은 배경. 에펙에서 Screen 으로 얹으면 된다.
//     --ht     하프톤 스킨 켜기
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
const H = Math.round(W * 9 / 16);
const BEAM = !!arg('beam', false);
const HT = !!arg('ht', false);
const SESSION = !!arg('session', false);
const OUT = arg('out', 'out');
const URLBASE = arg('url', 'http://127.0.0.1:5199/');
// UI 캔버스 배율 — 실시간 기본 0.75. 4K 내보내기엔 2 이상이어야 확대 흐림이 없다.
const UISCALE = +arg('uiscale', W >= 3000 ? 2 : 1.25);

const TMP = fs.mkdtempSync('/tmp/newton_export_');
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
const tag = `${SPORT}${SESSION ? '_session' : ''}${BEAM ? '_beam' : ''}${HT ? '_ht' : ''}_${W}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (${W}×${H} · ${FPS}fps · ${DUR}s · UI 배율 ${UISCALE})`);

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
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto(`${URLBASE}?dev=1&uiscale=${UISCALE}`, { waitUntil: 'networkidle2', timeout: 180000 });
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

await page.evaluate(({ sport, beam, ht, session }) => {
  const d = window.__dbg;
  // 화면 정리 — 3D 만 남긴다
  for (const sel of ['#panel', '#insp', '.dev-only', '#hud', '#toast']) {
    document.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important'));
  }
  document.body.style.background = '#000';
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
    d.renderer.setClearColor(0x000000, 1);
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
}, { sport: SPORT, beam: BEAM, ht: HT, session: SESSION });
await page.evaluate(() => {
  // 좌패널을 숨겨도 캔버스는 예전 폭으로 굳어 있다 — 리사이즈를 강제해 뷰포트를 꽉 채운다(검은 띠 제거).
  const st = document.getElementById('stage');
  if (st) { st.style.position = 'fixed'; st.style.inset = '0'; st.style.width = '100%'; st.style.height = '100%'; }
  window.dispatchEvent(new Event('resize'));
});
await new Promise(r => setTimeout(r, 2500));

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  await page.evaluate(tt => new Promise(res => {
    const d = window.__dbg;
    window.__vt = 1200 + tt * 1000;          // 가상 시계 — 셰이더·클록이 전부 이걸 본다
    d.state.playing = false;
    d.state.time = tt;
    if (d.session?.active) d.session.t = tt;
    requestAnimationFrame(() => requestAnimationFrame(res));
  }), t);
  await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(5, '0')}.png`), type: 'png' });
  if (i % 10 === 0 || i === N - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${i + 1}/${N}  ${el.toFixed(0)}s  (${(el / (i + 1)).toFixed(2)}s/프레임)   `);
  }
}
process.stdout.write('\n');

// ProRes 4444 — 에펙에 그대로 임포트. 알파는 안 쓴다(가산 합성이라 검은 배경이면 충분).
const mov = path.join(OUT, `${tag}.mov`);
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
  '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', mov], { stdio: 'inherit' });
// 미리보기용 H.264
const mp4 = path.join(OUT, `${tag}_preview.mp4`);
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.png'),
  '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', mp4], { stdio: 'inherit' });

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n✅ ${mov}\n   ${mp4}`);
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
