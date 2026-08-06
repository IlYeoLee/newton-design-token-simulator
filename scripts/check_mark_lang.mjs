// ─────────────────────────────────────────────────────────────
// 마크 공통 언어 감시자 — marklang.js 가 지목해 놓고 **없던** 그 스크립트다.
//
//   왜 이게 필요한가(2026-08-06 농구 4건이 전부 같은 모양이었다):
//     ① 화살표 밝기  — 비트 메트로놈이 안 죽고 남아 영상 시계(_sbPlace)를 매 프레임 덮어썼다
//     ② 드리블 숫자  — 정본(session.repLeft)을 못 읽어 **스테이지 시계로 역산**하고 있었다
//     ③ LINK.pair    — marklang 에 선언만 있고 소비자가 없었다
//     ④ BK_B1 관찰   — CAPS 는 '관찰 없음'인데 session 은 3초 관찰을 돌렸다
//   공통 원인 하나: **정본을 새로 만들고, 옛 경로를 안 끄고, 폴백을 남겼다.**
//   폴백이 그럴듯한 값을 내니 화면이 안 죽는다 — 그래서 조용히 계속 틀린다.
//
//   marklang.js 가 이미 규칙을 적어 놨다:
//     "소비자는 fallback 을 두지 않는다. 값이 없으면 조용히 다른 숫자로 도는 대신
//      여기에 스테이지를 추가하라는 뜻이다."
//   이 파일은 그 규칙의 **감시자**다. 규칙만 적고 감시자를 안 만들면 또 샌다.
//
//   실행:  node scripts/check_mark_lang.mjs   (= npm run check:lang)
//   ponytail: 정적 텍스트 분석이다. marklang.js 는 tokens.js → three 를 끌고 와서
//     node 에서 import 가 안 된다. 파서를 붙이는 대신 선언부만 읽는다 —
//     오탐이 나면 그때 파서를 단다.
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 랩 페이지는 검사 대상이 아니다 — 정본을 직접 import 하므로 **원래 항상 맞다**.
//   ("랩엔 정확히 있는데 실제로 플레이하면 없다"가 반복되는 이유가 정확히 이 비대칭이다.)
const LAB = new Set(['marklab.js', 'tokenlab.js', 'marklang.js', 'markmotion.js']);
const SRC = fs.readdirSync(path.join(ROOT, 'src'))
  .filter(f => f.endsWith('.js') && !LAB.has(f))
  .map(f => ({ f: 'src/' + f, s: rd('src/' + f) }));

const fails = [];
const warns = [];
const line = (s, i) => s.slice(0, i).split('\n').length;

// ── ① 죽은 어휘 — marklang 축에 선언됐는데 앱이 안 쓰는 키 ────────────────────
//   ③ LINK.pair 가 걸렸던 자리. 선언은 설계 의도이고, 소비가 0 이면 그 의도가 화면에 없다.
//   ★ 검사 대상은 **스테이지 스펙이 이름으로 고르는 축**뿐이다(LOAD·MOVE·LINK·ARROW).
//     PHYS·VERDICT·ENTER·EXIT 는 physOf() 처럼 **파생**되는 축이라 코드에 문자열로 안 나온다 —
//     거기까지 세면 오탐이 20건씩 쏟아지고, 오탐이 쏟아지는 검사는 아무도 안 본다(그래서 샜다).
const ML = rd('src/marklang.js');
const axes = {};
for (const m of ML.matchAll(/export const (LOAD|MOVE|LINK|ARROW) = \{([\s\S]*?)\n\};/g)) {
  axes[m[1]] = [...m[2].matchAll(/^\s{2}(\w+):/gm)].map(k => k[1]);
}
console.log('① 죽은 어휘 — 선언은 있는데 앱에 소비자가 없는 키\n');
// 스테이지 스펙(BK_STEPBACK)이 이름으로 고른 값들 — 여기 적힌 키는 **데이터로 소비된다**.
const SPEC = new Set([...ML.matchAll(/(?:load|move|enter|exit|link):\s*'(\w+)'/g)].map(m => m[1]));
for (const [ax, keys] of Object.entries(axes)) {
  // 축을 통째로 동적 인덱싱하는가( LOAD[key] ) — 그러면 스펙에 적힌 키는 이름 없이도 소비된다.
  const dyn = SRC.some(x => new RegExp(`\\b${ax}\\[`).test(x.s));
  for (const k of keys) {
    // 문자열 값으로 쓰이는가( 'pair' / "pair" ) 또는 축.키 로 참조되는가( LINK.pair )
    const re = new RegExp(`['"\`]${k}['"\`]|\\b${ax}\\.${k}\\b`);
    const hit = SRC.filter(x => re.test(x.s)).map(x => x.f);
    const via = !hit.length && dyn && SPEC.has(k) ? `${ax}[…] ← BK_STEPBACK` : null;
    const mark = (hit.length || via) ? 'ok  ' : 'FAIL';
    if (!hit.length && !via) fails.push(`${ax}.${k}: marklang 에 선언됐는데 앱 소비자가 0 곳 — 설계 의도가 화면에 없다`);
    console.log(`   ${mark} ${(ax + '.' + k).padEnd(16)} ${hit.length ? hit.join(' ') : (via || '—')}`);
  }
}

// ── ② 두 주인 — 같은 구동 필드에 대입하는 곳이 여러 군데인가 ──────────────────
//   ① 화살표 _gain 이 걸렸던 자리. 한 프레임에 둘이 쓰면 **나중에 쓴 쪽이 화면**이고,
//   어느 쪽이 이기는지는 코드를 다 읽기 전엔 아무도 모른다.
//   ★ **스테이지 핸들러 단위**로 센다. 파일 전체로 세면 _gain 이 22곳으로 나와 쓸모가 없다 —
//     서로 다른 스테이지가 각자 자기 화살표를 쓰는 건 정상이기 때문이다. 문제는 **한 스테이지
//     안에서** 같은 필드를 두 번 쓰는 것이고, 그게 화살표 버그의 정확한 모양이었다.
const DRIVEN = ['_gain', '_prog', '_scale', 'stepVidT', 'repLeft', 'repTotal', 'repFrac'];
console.log('\n② 두 주인 — 한 스테이지 핸들러 안에서 같은 구동 필드를 여러 번 쓰는가\n');
{
  const SE = rd('src/session.js');
  // 핸들러 경계 = `id === 'XXX'` 분기. 다음 분기 직전까지가 그 스테이지의 몫이다.
  const cuts = [...SE.matchAll(/id === '([A-Z][A-Z0-9_]*)'/g)].map(m => ({ id: m[1], i: m.index }));
  let any = false;
  for (let c = 0; c < cuts.length; c++) {
    const blk = SE.slice(cuts[c].i, cuts[c + 1]?.i ?? SE.length);
    if (blk.length > 12000) continue;   // 경계를 못 잡은 덩어리는 세지 않는다(거짓 경보 방지)
    for (const fld of DRIVEN) {
      const hits = [...blk.matchAll(new RegExp(`^[^/\\n]*\\.${fld}\\s*(?:=|\\+=)[^=]`, 'gm'))];
      if (hits.length < 2) continue;
      any = true;
      const at = hits.map(h => line(SE, cuts[c].i + h.index)).join(' · ');
      console.log(`   WARN ${cuts[c].id.padEnd(8)} ${fld.padEnd(9)} ${hits.length}회  src/session.js:${at}`);
      warns.push(`${cuts[c].id} ${fld}: 한 핸들러에서 ${hits.length}번 쓴다 — 같은 프레임에 겹치면 나중 것이 이긴다`);
    }
  }
  if (!any) console.log('   ok   한 핸들러에서 두 번 쓰는 구동 필드 없음');
}

// ── ③ 조용한 폴백 — 정본을 못 읽었을 때 **다른 값으로 도는** 자리 ─────────────
//   ②·④ 가 걸렸던 자리. 여기서 걸리는 건 전부 "값이 없으면 화면이 조용히 거짓말한다"는 뜻이다.
//   정본 심볼은 여기 명시한다 — 늘려야 하면 늘리되, 늘리는 것 자체가 규율이다.
//   ★ 걸러야 할 건 `X || 0` 같은 **인덱스 가드**가 아니라, 정본을 못 읽었을 때
//     **시계로 값을 지어내는** 자리다. rep-n 버그가 정확히 그것이었다:
//        numOr(map.get('rep-n')?.textContent, Math.round((t - PV)/(dur - PV) * N))
//     → 카운터가 없으면 경과시간으로 횟수를 만들어 냈다. 화면은 안 죽고 조용히 거짓말한다.
//     그래서 조건을 좁힌다: **정본 심볼 + 폴백 + 그 줄에 시계**. 셋이 같이 있을 때만.
const CANON = ['stageTime\\(', 'holdSec', 'repLeft', 'repTotal', 'repFrac', 'rep-n', 'MARK_LOOK'];
const CANON_RE = new RegExp('(' + CANON.join('|') + ')');
const CLOCK_RE = /\bthis\.t\b|\bt\s*-\s*PV\b|\bdur\s*-\s*t\b|performance\.now\(\)|\/\s*dur\b/;
console.log('\n③ 조용한 폴백 — 정본이 비면 **시계로 값을 지어내는** 자리\n');
let fb = 0;
for (const { f, s } of SRC) {
  s.split('\n').forEach((ln, i) => {
    const T = ln.trim();
    if (T.startsWith('//') || T.startsWith('*')) return;
    if (!CANON_RE.test(ln) || !CLOCK_RE.test(ln)) return;
    if (!/(\?\?|\|\||numOr\()/.test(ln)) return;
    fb++;
    fails.push(`${f}:${i + 1}  정본이 비면 시계로 값을 만든다 — 값이 없으면 **안 그리는 게** 맞다`);
    console.log(`   FAIL ${f}:${i + 1}  ${T.slice(0, 96)}`);
  });
}
if (!fb) console.log('   ok   없음');

// ── ④ 설정 vs 동작 — CAPS 의 관찰 선언과 session 의 관찰 분기가 맞는가 ─────────
//   ④ BK_B1 이 걸렸던 자리. floorgl 은 '관찰 없음'이라 믿고 session 은 관찰을 돈다.
console.log('\n④ 설정 vs 동작 — 관찰(pv) 선언과 실제 관찰 분기\n');
{
  const FG = rd('src/floorgl.js'), SE = rd('src/session.js');
  const caps = FG.match(/const CAPS = \{([\s\S]*?)\n\};/)?.[1] || '';
  for (const m of caps.matchAll(/^\s{2}(\w+):\s*\{([^}]*)\}/gm)) {
    const [, id, body] = m;
    const declared = /\bpv:\s*true/.test(body);
    // session 이 그 스테이지에서 _followLatch 관찰 분기를 도는가
    const blk = SE.split(new RegExp(`id === '${id}'`))[1]?.slice(0, 2600) || '';
    const runs = /!this\._followLatch/.test(blk);
    const ok = declared === runs;
    if (!ok) fails.push(`${id}: CAPS pv=${declared} 인데 session 관찰 분기=${runs} — 알약과 세션이 다른 화면을 믿는다`);
    console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(8)} CAPS pv=${String(declared).padEnd(5)} session 관찰=${runs}`);
  }
}

// ── 결과 ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(72));
if (warns.length) { console.log('\n경고 ' + warns.length + '건 (사람이 판단)'); warns.forEach(w => console.log('  · ' + w)); }
if (fails.length) {
  console.log('\n실패 ' + fails.length + '건');
  fails.forEach(f => console.log('  ✗ ' + f));
  console.log('\n규칙: src/marklang.js — "소비자는 fallback 을 두지 않는다."');
  process.exitCode = 1;
} else {
  console.log('\n통과 — 죽은 어휘·두 주인·조용한 폴백·설정 불일치 없음');
}
