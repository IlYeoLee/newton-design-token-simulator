// ?ad=1 계측기 — 헤드리스라 '탭이 뒤에 있으면 rAF 가 멈춘다' 문제를 안 탄다.
//   사용: node probe_ad.mjs [--shot out.png]
import puppeteer from 'puppeteer';

const SHOT = process.argv.includes('--shot');
const b = await puppeteer.launch({ headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--use-gl=angle', '--enable-webgl'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 800, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('  PAGEERROR:', String(e).slice(0, 160)));
await p.goto('http://127.0.0.1:5199/?fxq=1&scene=BK_C2&ad=1', { waitUntil: 'networkidle2', timeout: 180000 });
await p.waitForFunction('!!window.__dbg?.session', { timeout: 120000 });

// 씬 스테이지가 스스로 농구→세션→BK_C2 로 데려간다(렌더 루프가 도는 한). 최대 60초 기다린다.
const ok = await p.waitForFunction(
  () => window.__dbg.session.curStage?.id === 'BK_C2' && window.__dbg.session.t > 2.0,
  { timeout: 60000, polling: 300 }).then(() => true).catch(() => false);

const r = await p.evaluate(() => {
  const s = window.__dbg.session, H = s.bkC2x || {};
  const g = k => H[k] ? { gain: +(H[k]._gain ?? 0).toFixed(2), prog: +(H[k]._prog ?? 0).toFixed(2),
    vis: H[k].visible, pos: [+H[k].position.x.toFixed(2), +H[k].position.z.toFixed(2)] } : null;
  const m = k => H[k]?.group ? { op: +(H[k]._U?.uFade?.value ?? -1).toFixed(2),
    pos: [+H[k].group.position.x.toFixed(2), +H[k].group.position.z.toFixed(2)] } : null;
  return { stage: s.curStage?.id, t: +s.t.toFixed(2), pin: s.pinStage, latch: !!s._followLatch,
    화살표: { a1: g('a1'), a2: g('a2') },
    링크: { lkA: g('lkA'), lkB: g('lkB') },
    존: H.zTgt ? { fade: +(H._zFade ?? 0).toFixed(2) } : null,
    경로선: { trA: g('trA'), trB: g('trB'), trC: g('trC') },
    마크: { fRl: m('fRl'), fRr: m('fRr'), fC: m('fC'), fLl: m('fLl'), fLr: m('fLr') } };
});
console.log(ok ? '도달 OK' : '⚠ BK_C2 에 못 갔다');
console.log(JSON.stringify(r, null, 1));
if (SHOT) { await p.screenshot({ path: '/private/tmp/claude-501/-Users-iil-yeo/7543d0d0-994f-4b2f-ad91-c098e8d76460/scratchpad/ad.png' }); console.log('shot 저장'); }
await b.close();
