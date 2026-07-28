import fs from 'fs'; import path from 'path';
const files = [];
(function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name);
  if (e.isDirectory()) walk(p); else if (/\.(mp4|webm|mov)$/i.test(e.name)) files.push(p); } })('public');
const META = {
  'stepback_fwd.mp4':      ['농구','스텝백 1/4~4/4 · 실전 C2','커리 스텝백 원본(그린스크린) — 마크 타이밍·키프레임의 실측 소스'],
  'bhandle_pp.mp4':        ['농구','B1 제자리 드리블','로우 드리블 루프(핑퐁 베이크)'],
  'ready-view/assets/bk_sidebend_pp.webm': ['농구','A1 옆구리 스트레치','핑퐁 루프'],
  'ready-view/assets/bk_sidebend.webm':    ['농구','A1 원본','옆구리 스트레치 원본'],
  'ready-view/assets/bk_highknee.webm':    ['농구','A2 니 드라이브',''],
  'ready-view/assets/bk_squat.webm':       ['농구','A3 스쿼트',''],
  'ready-view/assets/sean_neck_shoulder.webm': ['러닝','A1 목·어깨 풀기',''],
  'ready-view/assets/sean_neck_shoulder.mp4':  ['러닝','A1 원본(mp4)',''],
  'ready-view/assets/sean_lunge.webm':     ['러닝','A2 종아리 늘리기',''],
  'ready-view/assets/sean_highknee.webm':  ['러닝','A3 하이니',''],
  'quad_src.mp4':          ['러닝','FIN 쿨다운 쿼드','실사 비디오모캡 소스(포즈 추출)'],
  'coach_chroma.mp4':      ['복싱','고스트 기본 클립','클립 미반입 시 폴백'],
  'ghost/bx_a1_neck.mp4':  ['복싱','BX_A1 목·어깨',''],
  'ghost/bx_a2_step.mp4':  ['복싱','BX_A2 스텝 인·아웃',''],
  'ghost/bx_a3_jab.mp4':   ['복싱','BX_A3 잽 폼',''],
  'ghost/bx_b1_guard.mp4': ['복싱','BX_READY · BX_B1 가드',''],
  'ghost/bx_b2_slip.mp4':  ['복싱','BX_B2 슬립',''],
  'ghost/bx_b3_jab.mp4':   ['복싱','BX_B3 잽 스윕',''],
  'ghost/bx_c2_spar.mp4':  ['복싱','BX_C2 잽 대련',''],
  'ghost/bx_c3_combo.mp4': ['복싱','BX_C3 콤비네이션',''],
  'ghost/bx_c4_cooldown.mp4':['복싱','BX_C4 마무리',''],
  'ghost/bx_idle_guard.mp4':['복싱','대기 가드(보관)',''],
  'bx_2161.mp4':           ['복싱','펀치 자동추출 소스','MediaPipe 33건 추출'],
};
const src = ['src/main.js','src/session.js','src/xbot.js','src/posemocap.js']
  .filter(f=>fs.existsSync(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const items = files.map(f => {
  const rel = f.replace(/^public\//,''), base = path.basename(f);
  const m = META[rel] || [];
  return { rel, base, pack: m[0] || '보관', use: m[1] || '미사용(참고 소스)', note: m[2] || '',
    used: src.includes(base), mb: +(fs.statSync(f).size/1048576).toFixed(1) };
});
const order = ['복싱','러닝','농구','보관'];
items.sort((a,b)=> order.indexOf(a.pack)-order.indexOf(b.pack) || a.rel.localeCompare(b.rel));
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NEWTON — 영상 소스 아카이브</title>
<style>
:root{--bg:#0b0d11;--card:#14171d;--line:#252a33;--text:#e8ebf0;--dim:#8b93a1;--accent:#fa3030;--prism:#d1feff}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);
  font-family:Pretendard,-apple-system,system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:rgba(11,13,17,.92);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line);padding:18px 24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
h1{margin:0;font-size:15px;letter-spacing:2.4px;font-weight:800}
.dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px rgba(250,48,48,.8)}
.sub{color:var(--dim);font-size:12px}
.filters{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.f{padding:7px 13px;border:1px solid var(--line);border-radius:9px;background:#161a21;color:var(--dim);
  font-size:12px;font-weight:700;cursor:pointer}
.f.on{border-color:var(--accent);color:#ff6b6b;background:rgba(250,48,48,.14)}
main{padding:22px 24px 60px;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.card video{width:100%;aspect-ratio:16/10;object-fit:contain;background:#000;display:block}
.body{padding:12px 14px 14px}
.tag{display:inline-block;padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:800;letter-spacing:.4px}
.t-복싱{background:rgba(250,48,48,.16);color:#ff7a7a} .t-러닝{background:rgba(209,254,255,.14);color:var(--prism)}
.t-농구{background:rgba(254,195,137,.16);color:#fec389} .t-보관{background:#1c2027;color:var(--dim)}
.name{font-size:13px;font-weight:800;margin:8px 0 3px;word-break:break-all}
.use{font-size:12px;color:var(--dim);line-height:1.5}
.note{font-size:11px;color:#6e7787;margin-top:4px;line-height:1.5}
.row{display:flex;gap:8px;align-items:center;margin-top:11px}
.dl{flex:1;text-align:center;padding:8px 0;border:1px solid var(--line);border-radius:9px;background:#181c23;
  color:var(--text);font-size:12px;font-weight:700;text-decoration:none}
.dl:hover{background:#1e232b}
.mb{font-size:11px;color:var(--dim)}
.off{opacity:.5}
</style></head><body>
<header>
  <span class="dot"></span><h1>NEWTON · 영상 소스 아카이브</h1>
  <span class="sub">${items.length}개 · 사용중 ${items.filter(i=>i.used).length}개 · 총 ${(items.reduce((s,i)=>s+i.mb,0)).toFixed(0)}MB</span>
  <div class="filters">
    <button class="f on" data-f="all">전체</button>
    <button class="f" data-f="복싱">복싱</button><button class="f" data-f="러닝">러닝</button>
    <button class="f" data-f="농구">농구</button><button class="f" data-f="보관">보관</button>
    <button class="f" data-f="used">사용중만</button>
    <button class="f" id="dlall">전체 저장</button>
  </div>
</header>
<main id="grid"></main>
<script>
const ITEMS = ${JSON.stringify(items)};
const grid = document.getElementById('grid');
function render(f) {
  grid.innerHTML = ITEMS.filter(i => f === 'all' ? true : f === 'used' ? i.used : i.pack === f).map(i => \`
    <div class="card\${i.used ? '' : ' off'}">
      <video src="\${i.rel}" controls preload="metadata" loop muted playsinline></video>
      <div class="body">
        <span class="tag t-\${i.pack}">\${i.pack}</span>
        <span class="mb" style="margin-left:6px">\${i.mb}MB\${i.used ? '' : ' · 미사용'}</span>
        <div class="name">\${i.base}</div>
        <div class="use">\${i.use}</div>
        \${i.note ? \`<div class="note">\${i.note}</div>\` : ''}
        <div class="row"><a class="dl" href="\${i.rel}" download>⤓ 저장</a></div>
      </div>
    </div>\`).join('');
}
render('all');
document.querySelectorAll('.f[data-f]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.f[data-f]').forEach(x => x.classList.toggle('on', x === b));
  render(b.dataset.f);
}));
document.getElementById('dlall').addEventListener('click', async () => {
  for (const i of ITEMS) {
    const a = document.createElement('a'); a.href = i.rel; a.download = i.base;
    document.body.appendChild(a); a.click(); a.remove();
    await new Promise(r => setTimeout(r, 350));   // 브라우저 동시 다운로드 제한 회피
  }
});
</script></body></html>`;
fs.writeFileSync('public/media.html', html);
console.log('public/media.html 생성 —', items.length, '개');
