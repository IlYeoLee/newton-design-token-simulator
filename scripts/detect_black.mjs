// 검은 사각 플리커 자동 재현기 — CDP screencast로 프레임 단위 캡처, 근-검정 대형 블록 검출
// 사용: node scripts/detect_black.mjs [urlQuery] [durMs] [dsf] [advMs]
//   예: node scripts/detect_black.mjs "" 90000 2 7000
//       node scripts/detect_black.mjs "?nocss=1" 90000 2
// 검출 프레임 PNG + 로그 → $OUT_DIR (기본 scratchpad/blackdet)
import puppeteer from 'puppeteer';
import fs from 'fs';

const [, , Q = '', DUR = '90000', DSF = '2', ADV = '7000'] = process.argv;
const OUT = process.env.OUT_DIR || '/private/tmp/claude-501/-Users-iil-yeo/fed9f4e6-abcd-410e-abe6-29d8bcb75e36/scratchpad/blackdet';
fs.mkdirSync(OUT, { recursive: true });

const STRESS = process.env.STRESS === '1';   // 빠른 탭 연타 + 1/3인칭 토글 + 창 리사이즈 + 세션 루프
const HEADFUL = process.env.HEADFUL === '1'; // 실 GPU(Metal) 래스터 재현용 — headless SwiftShader에선 컴포지터 플래시가 안 나올 수 있음
// 헤드풀 = 실 윈도우 그대로(defaultViewport null) — setViewport 에뮬 뷰포트(1280)와 실제 창(1440)이
// 어긋나며 우측에 검은 데드밴드가 생겨 전부 오검출됐음(크롭 기준 innerWidth vs 캡처 기준 창폭 불일치).
const browser = await puppeteer.launch({
  headless: HEADFUL ? false : 'new',
  defaultViewport: HEADFUL ? null : undefined,
  args: ['--window-size=1440,900', '--enable-gpu'],
});
const page = await browser.newPage();
if (!HEADFUL) await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: +DSF });
await page.goto('http://localhost:5199/' + Q, { waitUntil: 'networkidle2' });
await page.waitForFunction('!!window.__dbg && !!window.__sess', { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
await page.waitForFunction('!!window.__dbg?.xbot?.actions?.cmu_crossover_shot', { timeout: 120000 });
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => document.getElementById('btn-session').click());
await new Promise(r => setTimeout(r, 1500));

// 분석 전용 두 번째 페이지 — 메인 페이지 evaluate로 렌더 타이밍 오염 방지
const ana = await browser.newPage();
await ana.goto('about:blank');
await ana.evaluate(() => {
  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d', { willReadFrequently: true });
  // 셀 그리드: 셀 전체 샘플이 RGB<20이면 '검정 셀' → 최대 연결 성분 면적비 반환
  // crop = 페이지 CSS px 기준 캔버스 rect + 페이지 innerW — 우측 검정 UI 사이드바 오검출 배제
  window.analyze = (b64, crop) => new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const k = img.width / crop.innerW;   // screencast px ↔ CSS px 스케일
      const sx = crop.x * k, sy = crop.y * k, sw = crop.w * k, sh = crop.h * k;
      cv.width = Math.max(1, sw | 0); cv.height = Math.max(1, sh | 0);
      cx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      const GW = 48, GH = 30, cw = cv.width / GW, ch = cv.height / GH;
      const black = new Uint8Array(GW * GH);
      for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
        let ok = 1;
        for (let sy = 0; sy < 3 && ok; sy++) for (let sx = 0; sx < 3; sx++) {
          const x = Math.min(cv.width - 1, (gx + (sx + 0.5) / 3) * cw | 0);
          const y = Math.min(cv.height - 1, (gy + (sy + 0.5) / 3) * ch | 0);
          const i = (y * cv.width + x) * 4;
          if (d[i] >= 20 || d[i + 1] >= 20 || d[i + 2] >= 20) { ok = 0; break; }
        }
        black[gy * GW + gx] = ok;
      }
      // BFS 최대 연결 성분
      const seen = new Uint8Array(GW * GH); let max = 0, total = 0;
      for (let i = 0; i < GW * GH; i++) {
        if (!black[i] || seen[i]) continue;
        let n = 0; const st = [i]; seen[i] = 1;
        while (st.length) {
          const c = st.pop(); n++;
          const cx2 = c % GW, cy2 = c / GW | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx2 + dx, ny = cy2 + dy;
            if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
            const j = ny * GW + nx;
            if (black[j] && !seen[j]) { seen[j] = 1; st.push(j); }
          }
        }
        if (n > max) max = n;
      }
      for (let i = 0; i < GW * GH; i++) total += black[i];
      res({ frac: max / (GW * GH), blackFrac: total / (GW * GH) });
    };
    img.src = 'data:image/jpeg;base64,' + b64;
  });
});

let curStage = '?', running = true;
page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV(리로드?)', Date.now()); });
const stagePoll = (async () => {
  while (running) {
    // 세션 비활성(리로드 직후 로딩 화면 등)은 IDLE — 로딩 검은 배경 오검출 배제
    try { curStage = await page.evaluate(() => window.__sess?.active ? window.__sess.curStage?.id : 'IDLE'); crop = await getCrop(); } catch { curStage = '?'; }
    await new Promise(r => setTimeout(r, 400));
  }
})();
const advancer = (async () => {   // BK_A1 → … → BK_FIN 자연 진행 (+FIN이면 처음으로 루프)
  let n = 0;
  while (running) {
    await new Promise(r => setTimeout(r, STRESS ? 2500 : +ADV));
    if (!running) break;
    n++;
    try {
      const alive = await page.evaluate(() => {
        const s = window.__sess;
        if (!s?.active) return false;
        if (/FIN$/.test(s.stage)) { s.stageIdx = 0; s.t = 0; s._enter(); }
        else s.tapAdvance();
        return true;
      });
      if (!alive) {   // 리로드 복구 — 농구 재선택 + 세션 재시작
        try {
          await page.waitForFunction('!!window.__dbg && !!window.__sess', { timeout: 30000 });
          await page.evaluate(() => document.querySelector('[data-pack=basketball]')?.click());
          await page.waitForFunction('!!window.__dbg?.xbot?.actions?.cmu_crossover_shot', { timeout: 60000 });
          await new Promise(r => setTimeout(r, 1200));
          await page.evaluate(() => document.getElementById('btn-session').click());
        } catch {}
      }
      if (STRESS) {
        if (n % 2 === 0) {   // 연타 — 전환 직후 재전환(더블버퍼 스왑 연쇄)
          await new Promise(r => setTimeout(r, 450));
          await page.evaluate(() => { const s = window.__sess; if (s?.active && !/FIN$/.test(s.stage)) s.tapAdvance(); });
        }
        if (n % 4 === 0) await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('인칭'))?.click());
        if (!HEADFUL && n % 6 === 0) await page.setViewport({ width: n % 12 === 0 ? 1280 : 1024, height: n % 12 === 0 ? 800 : 900, deviceScaleFactor: +DSF });
      }
    } catch {}
  }
})();

await page.bringToFront();   // screencast는 포그라운드 탭만 스트림 — ana 탭이 포커스 뺏은 것 복구
const getCrop = () => page.evaluate(() => {
  const c = [...document.querySelectorAll('canvas')].find(el => el.getBoundingClientRect().width > 300);
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, innerW: innerWidth };
});
let crop = await getCrop();
const cdp = await page.createCDPSession();
const queue = []; let nFrames = 0, nHits = 0, maxFrac = 0, maxStage = ''; const hits = [];
cdp.on('Page.screencastFrame', async ev => {
  nFrames++;
  queue.push({ b64: ev.data, t: Date.now(), stage: curStage, crop });
  // 백프레셔 — 분석이 밀리면 ack 지연으로 캡처 페이스 조절 (무한 큐 OOM 방지)
  while (queue.length > 120) await new Promise(r => setTimeout(r, 20));
  cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });

const t0 = Date.now();
const analyzer = (async () => {
  while (running || queue.length) {
    const f = queue.shift();
    if (!f) { await new Promise(r => setTimeout(r, 10)); continue; }
    const r = await ana.evaluate((b, c) => window.analyze(b, c), f.b64, f.crop);
    if (f.stage === '?' || f.stage === 'IDLE') continue;   // 리로드/로딩 아티팩트 제외
    if (r.frac > maxFrac) { maxFrac = r.frac; maxStage = f.stage; }
    if (r.frac >= 0.15) {
      nHits++;
      const name = `hit_${String(nHits).padStart(3, '0')}_${f.stage}_${f.t - t0}ms_${(r.frac * 100) | 0}pct.jpg`;
      fs.writeFileSync(`${OUT}/${name}`, Buffer.from(f.b64, 'base64'));
      hits.push({ name, stage: f.stage, tMs: f.t - t0, frac: +r.frac.toFixed(3) });
      console.log('HIT', name);
    }
  }
})();

await new Promise(r => setTimeout(r, +DUR));
await cdp.send('Page.stopScreencast').catch(() => {});
running = false;
await analyzer; await stagePoll; await advancer;
console.log(JSON.stringify({ query: Q, dsf: +DSF, durMs: +DUR, frames: nFrames, hits: nHits, maxFrac: +maxFrac.toFixed(3), maxStage, detail: hits.slice(0, 40) }, null, 1));
await browser.close();
