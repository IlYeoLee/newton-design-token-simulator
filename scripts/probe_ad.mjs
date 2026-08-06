// ?ad=1 발표 프리셋 계측기 — **헤드리스**라 "탭이 뒤에 있으면 rAF 가 멈춘다"를 안 탄다.
//   (씬 스테이지는 렌더 루프 안에서 돌기 때문에, 백그라운드 탭에서는 스테이지 점프조차 안 된다.
//    원격에서 크롬을 앞에 세워 재려다 여러 번 실패했다 — 그래서 이 스크립트를 남긴다.)
//   화살표는 "그 발이 움직이는 동안만" 뜨는 물건이라 **한 순간만 보면 0 이 나온다.**
//   12초를 훑어 max 와 뜬 프레임 수를 같이 낸다.
//   사용: node scripts/probe_ad.mjs

import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 800, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('  PAGEERROR:', String(e).slice(0,150)));
await p.goto('http://127.0.0.1:5199/?fxq=1&scene=BK_C2&ad=1', { waitUntil: 'networkidle2', timeout: 180000 });
await p.waitForFunction('!!window.__dbg?.session', { timeout: 120000 });
const ok = await p.waitForFunction(() => window.__dbg.session.curStage?.id === 'BK_C2',
  { timeout: 60000, polling: 300 }).then(()=>true).catch(()=>false);
console.log(ok ? '도달 OK' : '⚠ 못 감');
// 12초 동안 훑는다 — 화살표는 '움직이는 동안만' 뜨는 물건이라 한 순간만 보면 0 이 나온다
const r = await p.evaluate(async () => {
  const s = window.__dbg.session, H = s.bkC2x || {};
  const max = { a1:0, a2:0, zone:0, lkA:0, trA:0, trB:0, trC:0 };
  const seen = { a1:0, a2:0, zone:0 };   // gain>0.02 인 프레임 수
  let n = 0, tmin = 9e9, tmax = -9e9;
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise(r => requestAnimationFrame(r));
    n++; tmin = Math.min(tmin, s.t); tmax = Math.max(tmax, s.t);
    for (const k of ['a1','a2','trA','trB','trC','lkA'])
      if (H[k]) max[k] = Math.max(max[k], H[k]._gain || 0);
    max.zone = Math.max(max.zone, H._zFade || 0);
    if ((H.a1?._gain||0) > 0.02) seen.a1++;
    if ((H.a2?._gain||0) > 0.02) seen.a2++;
    if ((H._zFade||0) > 0.02) seen.zone++;
  }
  return { frames:n, tRange:[+tmin.toFixed(2), +tmax.toFixed(2)], max, 뜬프레임: seen,
    존생성: !!H.zTgt, 링크생성: !!H.lkA, latch: !!s._followLatch, stage: s.curStage?.id };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
