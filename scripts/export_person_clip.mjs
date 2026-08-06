// ─────────────────────────────────────────────────────────────
// 인물 룩 단독 추출 — 임의의 그린스크린 클립을 바닥 코치 판과 같은 룩으로, 화면 가득, 알파로.
//
//   export_video.mjs 는 앱의 무대(대지·판 프레이밍)를 통째로 뽑는다. 인물만 크게 필요할 때는
//   판이 프레임을 정해 버려서 안 된다 — 그래서 personout.html(같은 PERSON_GLSL·같은 FXP 토큰,
//   판 프레이밍만 제거)을 한 프레임씩 시크하며 찍는다.
//
//   ★ 소스는 반드시 올-인트라여야 한다(프레임 시크). 아니면 인물이 조용히 사라진다.
//      ffmpeg -i 원본.mp4 -c:v libx264 -crf 14 -g 1 -pix_fmt yuv420p -an 출력.mp4
//   ★ 렌더 중 리포에 파일을 쓰지 말 것 — vite 가 새로고침해 렌더가 죽는다. 전용 서버:
//      npm run dev:export   (5200)
//
//   사용:
//     node scripts/export_person_clip.mjs --src "C:\...\clip_intra.mp4" \
//       --w 3840 --h 2160 --fps 24 --dur 5.04 --fs 0.30 --out out/PERSON_BK
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
const SRC  = String(arg('src', ''));
const W    = +arg('w', 2560), H = +arg('h', 1440);
const FPS  = +arg('fps', 24);
const T0   = +arg('t0', 0) || 0;
const DUR  = +arg('dur', 3);
const FS   = +arg('fs', 0.30);
const HI   = +arg('hi', 0.86);
const TONE = +arg('tone', 0);
const OUT  = String(arg('out', 'out/PERSON'));
const URLBASE = String(arg('url', 'http://127.0.0.1:5200/'));
const NAME = String(arg('name', '')) || path.basename(SRC || 'person').replace(/\.[^.]+$/, '').replace(/[^\w.\-]/g, '_');

if (!SRC) { console.error('--src 가 필요합니다(그린스크린 클립, 올-인트라).'); process.exit(1); }
if (!fs.existsSync(SRC)) { console.error(`✗ 소스가 없습니다: ${SRC}`); process.exit(1); }

// 브라우저는 로컬 절대경로를 못 연다 — public/_bg 로 옮겨 vite 가 서빙하게 한다.
//   ★ 렌더가 시작되기 **전에** 복사한다(렌더 중 public/ 쓰기 = 새로고침 = 렌더 사망).
const bgDir = path.join('public', '_bg');
fs.mkdirSync(bgDir, { recursive: true });
let dst = path.resolve(SRC);
if (path.dirname(dst) !== path.resolve(bgDir)) {
  dst = path.join(bgDir, path.basename(SRC).replace(/[^\w.\-]/g, '_'));
  fs.copyFileSync(SRC, dst);
}
const SRCURL = '/_bg/' + path.basename(dst);

const N = Math.round(DUR * FPS);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'newton_person_'));
fs.mkdirSync(OUT, { recursive: true });
const tag = `${NAME}_person_alpha_${W}x${H}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (${W}×${H} · ${FPS}fps · ${DUR}s · fs ${FS} · hi ${HI})`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`,
    '--enable-gpu', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`,
    '--force-gpu-mem-available-mb=4096', '--disable-gpu-program-cache'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e.message || e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

const url = `${URLBASE}personout.html?src=${encodeURIComponent(SRCURL)}&w=${W}&h=${H}&fs=${FS}&hi=${HI}&tone=${TONE}`;
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction('window.__po && (window.__po.ready || window.__po.err)', { timeout: 60000 });
const err0 = await page.evaluate('window.__po.err');
if (err0) { console.error('✗ 페이지 오류:', err0); await browser.close(); process.exit(1); }
const meta = await page.evaluate('window.__po.meta()');
console.log(`  소스 ${meta.vw}×${meta.vh} · ${meta.dur.toFixed(2)}s · 노출 ${meta.look.exp.toFixed(3)} (p5 ${meta.look.lo.toFixed(3)} ~ p95 ${meta.look.hi.toFixed(3)})`);
if (T0 + DUR > meta.dur + 1e-3) console.log(`  ⚠ 소스가 ${meta.dur.toFixed(2)}s 인데 ${(T0 + DUR).toFixed(2)}s 까지 요청했습니다 — 뒤쪽은 마지막 프레임이 반복됩니다.`);

let saved = 0, fail = 0;
const t00 = Date.now();
for (let i = 0; i < N; i++) {
  const t = T0 + i / FPS;
  try { await page.evaluate(tt => window.__po.frame(tt), Math.min(t, Math.max(0, meta.dur - 1e-3))); }
  catch (e) { fail++; }
  await page.screenshot({ path: path.join(TMP, `f${String(saved).padStart(5, '0')}.png`), type: 'png', omitBackground: true });
  saved++;
  if (i % 10 === 0 || i === N - 1) {
    const el = (Date.now() - t00) / 1000;
    process.stdout.write(`\r  ${i + 1}/${N} · ${(el / (i + 1)).toFixed(2)}초/프레임 · 남은 ${((N - i - 1) * el / (i + 1) / 60).toFixed(1)}분   `);
  }
}
console.log('');
if (fail) console.log(`  ⚠ 비디오 시크 실패 ${fail}건 — 소스가 올-인트라인지 확인하세요.`);

// 프레임을 먼저 건지고 나서 인코딩한다(인코딩 실패가 렌더를 날리지 않게).
const seq = path.join(OUT, `${tag}_png`);
fs.rmSync(seq, { recursive: true, force: true });
fs.renameSync(TMP, seq);
const PAT = path.join(seq, 'f%05d.png');
const made = [`${seq}${path.sep}  (PNG 시퀀스 ${saved}장 · ${W}×${H} · 알파 보존)`];

const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const enc = (label, out, args) => {
  try { execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', PAT, ...args, out], { stdio: ['ignore', 'ignore', 'ignore'] }); made.push(out); }
  catch { console.log(`⚠ ${label} 인코딩 실패 — 건너뜁니다(PNG 시퀀스는 위에 있습니다).`); }
};
enc('ProRes', path.join(OUT, `${tag}.mov`), ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']);
const PV = path.join(OUT, 'preview_black_bg_NOT_for_AE');
fs.mkdirSync(PV, { recursive: true });
enc('H.264 미리보기', path.join(PV, `${tag}_preview.mp4`),
  ['-vf', `scale=${W - (W % 2)}:${H - (H % 2)}:flags=lanczos`, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p']);

// ── 검수 — 배경이 정말 투명한가 · 빈 프레임은 없는가 ─────────────────────────
const { PNG } = await import('pngjs');
const step = Math.max(1, Math.floor(saved / 20));
const pick = [...new Set([...Array(saved).keys()].filter(i => i % step === 0).concat(saved - 1))];
const rep = [];
for (const i of pick) {
  const f = path.join(seq, `f${String(i).padStart(5, '0')}.png`);
  if (!fs.existsSync(f)) continue;
  const png = PNG.sync.read(fs.readFileSync(f));
  let n = 0;
  for (let k = 3; k < png.data.length; k += 4) if (png.data[k] >= 8) n++;
  const at = (x, y) => png.data[(y * png.width + x) * 4 + 3];
  rep.push({ i, cov: n / (png.width * png.height) * 100,
    corner: Math.max(at(0, 0), at(png.width - 1, 0), at(0, png.height - 1), at(png.width - 1, png.height - 1)) });
}
const covs = rep.map(r => r.cov);
const worst = rep.reduce((a, b) => (b.corner > a.corner ? b : a), rep[0]);
console.log(`  검수 ${rep.length}장 · 불투명 ${Math.min(...covs).toFixed(2)}~${Math.max(...covs).toFixed(2)}% · 모서리 알파 최대 ${worst.corner} (f${worst.i})`);
const bad = rep.filter(r => r.cov < 0.05 || r.corner > 8);
for (const r of bad) console.log(`  ✗ f${r.i}: 불투명 ${r.cov.toFixed(2)}% · 모서리 알파 ${r.corner}`);
console.log(bad.length ? `⚠ 검수 실패 ${bad.length}건` : '  ✓ 배경 투명 · 내용 있음');

console.log('\n✅ ' + made.join('\n   '));
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
