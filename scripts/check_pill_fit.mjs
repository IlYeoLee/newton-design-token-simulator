// 알약 조판 감사 — 타이틀·링 숫자가 **그릇을 넘은 곳**을 전 씬에서 찾는다.
//
//   증상(유저 2026-08-06 스샷): 농구 로우드리블 링 안 '0/10' 이 링을 좌우로 삐져나왔다.
//   원인: 링 숫자 크기가 글자 수와 무관한 고정값(fsTimer 112)이었다 — '3' 기준으로 잡은 값이
//   네 글자에서는 링 지름의 1.4배가 된다.
//   구조: floorgl 의 fitDraw / countRing 이 넘칠 때 **줄여 그리고**(구조대) 그 순간을
//   window.__fitLog 에 남긴다. 이 스크립트는 갤러리(tokens.html)를 통째로 돌려 그 로그를 모은다.
//   → 눈으로 훑는 검수가 아니라 실측이다. 새 문구·새 종목이 들어와도 자동으로 걸린다.
//
//   실행: npm run dev (5199) 를 띄운 뒤  node scripts/check_pill_fit.mjs
//   통과 = exit 0 (로그가 비었다). over 1.0 초과 항목이 있으면 exit 1.

import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5199/tokens.html';
const SECONDS = Number(process.env.SECONDS || 26);   // 씬 타임라인 8초 × 3바퀴 + 여유

const b = await puppeteer.launch({ headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 1000 });
await p.goto(URL, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, SECONDS * 1000));   // 전 씬이 프리뷰→따라하기 모프를 한 번씩 지나가야 한다
const log = await p.evaluate(() => window.__fitLog || []);
await b.close();

if (!log.length) { console.log('통과 — 넘친 곳 없음 (타이틀·링 숫자 전부 그릇 안)'); process.exit(0); }

log.sort((a, c) => c.over - a.over);
console.log('\n■ 그릇을 넘어 줄여 그린 곳 (over = 실폭 ÷ 안쪽폭)\n');
for (const e of log) {
  console.log(`  ${(e.over).toFixed(2)}×  ${e.kind.padEnd(5)} ${String(e.tag).padEnd(7)} "${e.txt}"  ${e.w}px / ${e.avail}px`);
}
console.log(`\n총 ${log.length}건 — over 가 1.3 을 넘으면 문구나 토큰(fsTimer·pad)을 고칠 것.`);
process.exit(1);
