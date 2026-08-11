// 랩 개발자/배포 파이프라인 게이트 검사기 — 배포본에서 랩이 시뮬을 못 건드리는지 실측한다.
//   왜 검사기인가: '전시엔 안 새게' 는 눈으로 못 본다(안 새는 걸 어떻게 보나). 코드가 지킨다.
//   실행: 5199 띄운 채 `node scripts/check_lab_gate.mjs`   (npm run check:labgate)
import puppeteer from 'puppeteer';

const LABS = ['footlab.html', 'fxlab.html', 'tokens.html'];
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
let fail = 0;

for (const lab of LABS) {
  for (const dev of [1, 0]) {
    const p = await b.newPage();
    const sent = [];
    // 송신 채널 세 가지를 전부 가로챈다 — BroadcastChannel · postMessage · localStorage
    await p.evaluateOnNewDocument(() => {
      window.__sent = [];
      const BC = window.BroadcastChannel;
      window.BroadcastChannel = function (n) {
        const c = new BC(n);
        const post = c.postMessage.bind(c);
        c.postMessage = (m) => { window.__sent.push('bc:' + n); return post(m); };
        return c;
      };
      const pm = window.parent.postMessage.bind(window.parent);
      try { window.parent.postMessage = (m, o) => { window.__sent.push('pm'); return pm(m, o); }; } catch {}
      const si = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => { window.__sent.push('ls:' + k); return si(k, v); };
    });
    await p.goto(`http://127.0.0.1:5199/${lab}?dev=${dev}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));   // 주기 송신(fxlab 400ms)까지 충분히 돈다
    const out = await p.evaluate(() => ({
      sent: [...new Set(window.__sent || [])],
      isDev: document.body.classList.contains('dev'),
      hidden: [...document.querySelectorAll('[data-devonly]')].filter(e => getComputedStyle(e).display === 'none').length,
      total: document.querySelectorAll('[data-devonly]').length,
    }));
    await p.close();

    const label = `${lab.padEnd(14)} dev=${dev}`;
    if (dev === 0) {
      // 시뮬이 실제로 소비하는 채널만 '누수'다. 게이트 자기 기록(newton.dev)과
      //   랩 로컬 UI 상태(footlab.heroSize·prims 등)는 시뮬이 안 읽으므로 세지 않는다.
      const SIM_KEYS = ['newton_design_v1', 'newton-ht', 'footlab.params'];
      const leaked = out.sent.filter(s =>
        s.startsWith('bc:') || s === 'pm' || SIM_KEYS.some(k => s === 'ls:' + k));
      const okHide = out.total === 0 || out.hidden === out.total;
      const ok = leaked.length === 0 && !out.isDev && okHide;
      if (!ok) fail++;
      console.log(`${ok ? '✓' : '✗'} ${label}  송신 ${leaked.length ? leaked.join(',') : '없음'} · body.dev ${out.isDev} · devonly숨김 ${out.hidden}/${out.total}`);
    } else {
      // dev 는 '살아 있어야' 한다 — 편집 파이프라인이 죽으면 그것도 회귀다
      const ok = out.isDev;
      if (!ok) fail++;
      console.log(`${ok ? '✓' : '✗'} ${label}  송신 ${out.sent.length ? out.sent.join(',') : '없음'} · body.dev ${out.isDev} · devonly ${out.total}개 표시`);
    }
  }
}
await b.close();
console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과 — 배포본은 시뮬을 못 건드리고, dev 는 편집이 산다');
process.exit(fail ? 1 : 0);
