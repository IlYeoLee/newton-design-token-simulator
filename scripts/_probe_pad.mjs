// 패널 안 토글(details)의 좌우 여백 감사 — 글이 카드 벽에 붙은 곳을 실측으로 찾는다.
// 유저 08-11: "아직도 메뉴 안의 메뉴에 패딩 0인 것들 많다".
//   node scripts/_probe_pad.mjs [--min 10]
import puppeteer from 'puppeteer';

const mi = process.argv.indexOf('--min');
const MIN = mi > 0 ? +process.argv[mi + 1] : 10;
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 1000 });
// 랩 패널은 **제품 뷰** 전용이다 — 로컬은 기본이 dev 라 ?dev=0 으로 열어야 패널이 보인다.
// --dev 를 주면 개발자 뷰(유저가 5199 에서 기본으로 보는 화면)를 잰다.
const DEV = process.argv.includes('--dev');
const ui = process.argv.indexOf('--url');
const URL_ = ui > 0 ? process.argv[ui + 1] : `/?dev=${DEV ? 1 : 0}`;
const si = process.argv.indexOf('--sel');
if (si > 0) await p.evaluateOnNewDocument(s => { window.__padSel = s; }, process.argv[si + 1]);
await p.goto('http://localhost:5199' + URL_, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const rows = await p.evaluate((MIN) => {
  // 모든 토글을 연다(중첩 포함) — 닫힌 건 잴 수 없다.
  document.querySelectorAll('details').forEach(d => d.open = true);
  const out = []; let N = 0;
  // '카드' = 배경이나 테두리를 가진 조상. 글이 그 안쪽 벽에 얼마나 붙었는지가 문제다.
  const isCard = el => {
    const s = getComputedStyle(el);
    const bg = s.backgroundColor;
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    return hasBg || parseFloat(s.borderLeftWidth) > 0;
  };
  for (const el of document.querySelectorAll(window.__padSel || '#lab-panel *, #play-panel *, #panel *, aside *')) {
    if (window.__padDetailsOnly && !el.closest('details')) continue;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;                                          // 직접 글을 가진 노드만
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    N++;
    let card = el.parentElement;
    while (card && !isCard(card)) card = card.parentElement;
    if (!card) continue;
    const cr = card.getBoundingClientRect(), cs = getComputedStyle(card), es = getComputedStyle(el);
    // 재는 건 **글이 시작하는 자리**(콘텐츠 박스)다 — 요소 박스로 재면 자기 padding-inline:14px 가
    // 안 세어져 멀쩡한 곳이 전부 0 으로 나온다.
    // 카드 **벽**(테두리 안쪽)부터 글까지. 카드가 주든 요소가 주든 합쳐서 여백이면 된다 —
    // 카드 콘텐츠 박스 기준으로 재면 카드가 padding 을 다 주는 정상 케이스가 0 으로 잡힌다.
    const L = (r.left + parseFloat(es.paddingLeft) + parseFloat(es.borderLeftWidth))
            - (cr.left + parseFloat(cs.borderLeftWidth));
    const R = (cr.right - parseFloat(cs.borderRightWidth))
            - (r.right - parseFloat(es.paddingRight) - parseFloat(es.borderRightWidth));
    if (Math.min(L, R) >= MIN) continue;
    const path = e => { const a = []; for (let n = e; n && n.id !== 'lab-panel' && n.id !== 'play-panel'; n = n.parentElement) a.unshift(n.id ? '#' + n.id : n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : '')); return a.join('>'); };
    out.push({ text: txt.slice(0, 32), L: +L.toFixed(1), R: +R.toFixed(1), card: path(card) || 'panel', sel: path(el) });
  }
  return { out, scanned: N };
}, MIN);

console.log(`글 노드 ${rows.scanned}개 중 좌우 여백 ${MIN}px 미만 = ${rows.out.length}건\n`);
for (const r of rows.out) console.log(`  L${String(r.L).padStart(6)} R${String(r.R).padStart(6)}  "${r.text}"\n      ${r.sel}\n      card: ${r.card}`);
await b.close();
