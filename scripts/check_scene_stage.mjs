// 씬 스테이지 회귀 검사 — 2026-08-03 에 한 번에 터진 세 가지를 다시 못 나게 잡아 둔다.
//
//   ① 씬 전환이 삼켜짐 — scenes.html 에서 버튼을 눌러도 화면은 계속 BX_READY.
//      f.src 만 바뀌고 문서는 안 바뀌었다. 원인: 배경 없는 씬에서 pushAll → __setSceneBg('')
//      → 앱이 무조건 location.reload() → 새 씬으로 가던 이동이 취소.
//   ② 정보 UI 실종 — UI 판 배율 원본을 첫 프레임(아직 (1,1,1))에 굳혀서 매 프레임 1 로 덮어씀.
//      지오메트리 2600×1600 이라 UI 판이 2600m 로 그려져 화면 밖.
//   ③ 뷰 쪼그라듦 — scenes.html 의 main{flex:1} / iframe{100%} 규칙이 지워져 iframe 이 300×150.
//
//   셋 다 "화면이 그냥 안 나온다"로만 보여서 원인 찾는 데 오래 걸렸다. 값으로 잡아 둔다.
//
//   실행: 데브 서버를 띄운 상태에서
//     node scripts/check_scene_stage.mjs            (기본 http://127.0.0.1:5199)
//     node scripts/check_scene_stage.mjs --base http://127.0.0.1:5200
//   통과하면 exit 0, 하나라도 깨지면 exit 1 + 무엇이 왜 틀렸는지 출력.

import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:5199');
const SCENES = arg('--scenes', 'BX_A1,BX_C3,BK_B1').split(',');   // 복싱 둘 + 종목 전환 하나
const BOOT_MS = 14000;   // 룩 데이터·클립 로드까지

const fails = [];
const check = (ok, what, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  — ' + detail : ''));
  if (!ok) fails.push(what + (detail ? ' — ' + detail : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message.split('\n')[0]));
await page.setViewport({ width: 1440, height: 860 });

console.log('씬 스테이지 회귀 검사 —', BASE);
await page.goto(BASE + '/scenes.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);

// ③ 뷰 크기 — iframe 이 main 을 채우는가 (기본 300×150 으로 떨어지지 않는가)
const rect = await page.evaluate(() => {
  const r = document.getElementById('f').getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});
check(rect.w > 900 && rect.h > 600, 'iframe 이 뷰를 채운다', `${rect.w}×${rect.h} (기본값 300×150 이면 CSS 규칙 유실)`);

// ①② 씬마다 — 문서가 실제로 그 씬으로 갔는가 + UI 판이 제 배율인가
for (const want of SCENES) {
  console.log(`\n[${want}]`);
  const clicked = await page.evaluate(s => {
    const b = [...document.querySelectorAll('button.s')].find(x => x.dataset.s === s);
    if (!b) return false;
    b.click(); return true;
  }, want);
  check(clicked, '씬 버튼이 있다');
  if (!clicked) continue;
  await sleep(BOOT_MS);

  const got = await page.evaluate(() => {
    const f = document.getElementById('f');
    const out = { attr: f.getAttribute('src'), inner: null, stage: null, view: null, scale: null, geom: null };
    try {
      const w = f.contentWindow;
      out.inner = new URLSearchParams(w.location.search).get('scene');
      out.stage = w.__dbg?.session?.curStage?.id ?? null;
      const wm = w.__dbg?.wallGL?.mesh, fm = w.__dbg?.floorGL?.mesh;
      const m = wm?.visible ? wm : fm?.visible ? fm : null;
      if (m) {
        out.view = wm?.visible ? 'wall' : 'floor';
        out.scale = +m.scale.x.toFixed(6);
        out.geom = m.geometry?.parameters?.width ?? null;
      }
    } catch (e) { out.inner = 'x-origin:' + e.message; }
    return out;
  });

  // ① 속성만 바뀌고 문서가 안 바뀌는 것이 증상이었다 — 둘 다 본다
  check(got.inner === want, '문서가 그 씬으로 이동했다', `src=${String(got.attr).slice(-14)} · 문서=${got.inner}`);
  check(got.stage === want, '세션이 그 스테이지에 있다', `curStage=${got.stage}`);

  // ② UI 판이 대지 크기(2600 등)를 실제 벽/바닥 크기(m)로 줄이는 배율을 갖는가.
  //    배율 1 = 원본을 잘못 잡은 것 → 2600m 짜리 판이 되어 화면 밖으로 나간다.
  if (got.scale == null) {
    check(false, 'UI 판을 찾았다', '보이는 wallGL/floorGL 메시가 없다');
  } else {
    const sane = got.scale > 0 && got.scale < 0.1;
    check(sane, 'UI 판 배율이 제정신이다', `${got.view} scale=${got.scale} · geometry=${got.geom}`);
  }
}

if (pageErrors.length) {
  console.log('\n페이지 예외:');
  for (const e of [...new Set(pageErrors)]) console.log('  ' + e);
}

await browser.close();
console.log('\n' + (fails.length ? `실패 ${fails.length}건\n` + fails.map(f => ' · ' + f).join('\n') : '전부 통과'));
process.exit(fails.length ? 1 : 0);
