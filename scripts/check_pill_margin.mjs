// 알약 상하좌우 마진 감사 — **실행 중인 앱**의 지면 캔버스에서 그릇 경계와 내용 잉크를
// 픽셀로 재서 좌·우·상·하 여백을 나란히 찍는다.
//
//   왜 픽셀인가: 조판 상수(PAD)와 눈에 보이는 여백은 다르다. 링은 옅은 트랙이라 기하 경계보다
//   안쪽에서 보이기 시작하고(광학 보정 optL 이 그래서 있다), 활자엔 letterSpacing·베어링이 붙는다.
//   유저 검수 기준은 '보이는 여백'이므로 그걸 잰다.
//   ★ FloorGL 을 따로 띄워 그리면 안 된다 — 모프(관찰↔따라하기)는 session 상태에서 나오므로
//     독립 인스턴스는 관찰 상태로 굳어 배지·활자 크기가 실제와 달라진다(그렇게 한 번 틀렸다).
//
//   실행: npm run dev (5199) 를 띄운 뒤  node scripts/check_pill_margin.mjs [--only A2]
import fs from 'fs';
import { PNG } from 'pngjs';
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const TMP = arg('tmp', 'C:/Users/user/AppData/Local/Temp/claude/pill');
const STAGES = (arg('only', '') || 'A1,A2,A3,BK_A1,BK_B1,BK_T1,BK_B2,BK_B3,BK_B4').split(',');
fs.mkdirSync(TMP, { recursive: true });

const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-swiftshader'] });
const rows = [];
for (const stage of STAGES) {
  const p = await b.newPage();
  await p.setViewport({ width: 900, height: 900 });
  p.on('pageerror', e => console.log('ERR', stage, e.message.slice(0, 120)));
  await p.goto(`http://127.0.0.1:5199/?scene=${stage}`, { waitUntil: 'networkidle2', timeout: 180000 });
  await p.waitForFunction('!!window.__dbg?.floorGL', { timeout: 120000 });
  await new Promise(r => setTimeout(r, 11000));
  // 따라하기(헤더) 상태에서 잰다 — 관찰은 알약이 아직 크고 배지가 없다.
  for (let i = 0; i < 40; i++) {
    const on = await p.evaluate(() => !!window.__dbg?.session?._followLatch);
    if (on) break;
    await new Promise(r => setTimeout(r, 400));
  }
  const meta = await p.evaluate(() => {
    const G = window.__dbg.floorGL; if (!G) return null;
    const c = G.canvas;
    const cl = document.createElement('canvas'); cl.width = c.width; cl.height = c.height;
    cl.getContext('2d').drawImage(c, 0, 0);
    const pill = (G._boxes || []).find(x => x.k === 'pill') || (G._boxes || []).find(x => x.k === 'inner');
    // 대지 캔버스는 1600×2670 이라 뷰포트를 넘는다 — 엘리먼트 스샷 대신 데이터URL 로 뽑는다.
    return { K: c.width / 1600, pad: G._headPAD, RR: G._headRR, uiK: G._uiK, pill, png: cl.toDataURL('image/png') };
  });
  if (!meta?.pill) { rows.push({ stage, err: '알약 상자 없음' }); await p.close(); continue; }
  const file = `${TMP}/${stage}.png`;
  fs.writeFileSync(file, Buffer.from(meta.png.split(',')[1], 'base64'));
  await p.close();

  const im = PNG.sync.read(fs.readFileSync(file));
  const K = im.width / 1600;                                  // 캔버스가 뷰포트에 잘렸을 수 있어 실제 파일에서 다시 낸다
  const box = meta.pill;
  const y0 = Math.max(0, Math.round((box.y + 6) * K)), y1 = Math.min(im.height, Math.round((box.y + box.h - 6) * K));
  let px0 = 1e9, px1 = -1, py0 = 1e9, py1 = -1, ix0 = 1e9, ix1 = -1, iy0 = 1e9, iy1 = -1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < im.width; x++) {
    const i = (y * im.width + x) * 4;
    const a = im.data[i + 3]; if (a < 8) continue;
    const l = (im.data[i] + im.data[i + 1] + im.data[i + 2]) / 3 * (a / 255);
    if (l > 6) { if (x < px0) px0 = x; if (x > px1) px1 = x; if (y < py0) py0 = y; if (y > py1) py1 = y; }
    if (l > 110) { if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y; }
  }
  const B = v => +(v / K).toFixed(0);
  rows.push({ stage, pad: meta.pad, RR: meta.RR, uiK: +(meta.uiK ?? 1).toFixed(2), band: [B(y0 / K * K / K), 0],
    L: B(ix0 - px0), R: B(px1 - ix1), Tm: B(iy0 - py0), Bm: B(py1 - iy1), pillW: B(px1 - px0) });
}
await b.close();

console.log('\n■ 알약 여백(대지 px) — 보이는 그릇 경계 → 내용 잉크\n');
console.log('  스테이지   pad  링R  uiK   좌     우     상     하    알약폭   좌우차');
for (const r of rows) {
  if (r.err) { console.log(`  ${r.stage.padEnd(8)} ${r.err}`); continue; }
  const dLR = Math.abs(r.L - r.R);
  console.log(`${dLR > 30 ? '✗' : ' '} ${r.stage.padEnd(8)} ${String(r.pad).padStart(3)} ${String(r.RR).padStart(4)} ${String(r.uiK).padStart(5)}  ${String(r.L).padStart(4)} ${String(r.R).padStart(6)} ${String(r.Tm).padStart(6)} ${String(r.Bm).padStart(5)}  ${String(r.pillW).padStart(6)}   ${String(dLR).padStart(5)}`);
}
console.log('\n※ 좌/우는 광학 보정(optL = 링R×0.12)만큼 의도적으로 다르다 — 그 이상 벌어지면 조판 문제.');
