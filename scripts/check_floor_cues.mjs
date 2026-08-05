// 지면 큐 회귀 검사 — 유저가 두 번 지적한 두 가지를 값으로 잡아 둔다(2026-08-06).
//
//   ① BK_B1 ←→ 스탠스 화살표 "너무 흐려"
//      원인: 꼬리를 발마크 바깥(half+0.05)에 두어 촉이 빔 측면 페더로 나갔다.
//            실측 d=1.15m 에서 창 반폭 0.549 · 페더 0.25 → 최종 알파 0.58 → 0 (벌어질수록 어두워짐).
//      지금: 마크 앞 0.26m · 꼬리 ±0.04 고정 → 벌어짐 전 구간에서 알파 ≈1.
//
//   ② A2 종아리 누르기 스탠스 라인 "찌그러져 있고 가운데는 비어있고 / 룩시스템 언어를 안 썼다"
//      옛 구현: 캔버스에 직접 구운 도트 스트립 + repeat/offset 손수학. repeat.x = max(1, seg/0.16)
//            이 타일을 4.4배 눌러 도트가 5×22mm 세로 슬리버(사다리 발판)가 되고, 여백 IN 을
//            중점 배치로 줘 중앙에 0.1m 구멍이 났다.
//      지금: LINE 토큰(makeFlowArrow, 촉 없는 지면 점렬 자루)으로 편입 — 길이는 draw-on(_prog),
//            위치는 두 발의 중점. UV 수학이 없어 그 종류의 버그가 구조적으로 불가능하다.
//
//   실행: 데브 서버를 띄운 상태에서  node scripts/check_floor_cues.mjs [--base http://127.0.0.1:5199]
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:5199');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fails = [];
const check = (ok, what, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  — ' + detail : '')); if (!ok) fails.push(what); };

const b = await puppeteer.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

/** 씬 스테이지를 띄우고 매 프레임 sample() 을 돌려 값이 잡힌 프레임만 모은다. */
async function collect(scene, sample, n = 70, gap = 200) {
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(`${BASE}/?scene=${scene}&sceneloop=40`, { waitUntil: 'networkidle2', timeout: 60000 });
  for (let i = 0; i < 40; i++) { await sleep(1000); if (await p.evaluate(s => window.__dbg?.session?.stage === s, scene) === true) break; }
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = await p.evaluate(sample);
    if (r) rows.push(r);
    await sleep(gap);
  }
  await p.close();
  return rows;
}

// ── ① BK_B1 ←→ 화살표 ────────────────────────────────────────────────────────
{
  const rows = await collect('BK_B1', () => {
    const S = window.__dbg?.session, H = S?.bkB1;
    if (!H || !S.bkB1Setup || !(H.aL._gain > 0)) return null;
    const one = g => ({ op: +g._mesh.material.opacity.toFixed(3), dots: !!g._dots, scale: g._scale });
    return { widen: +(S.bkB1Widen ?? 0).toFixed(2), L: one(H.aL), R: one(H.aR) };
  });
  console.log(`\n[BK_B1 ←→ 화살표]  켜진 샘플 ${rows.length}`);
  check(rows.length >= 4, '셋업 구간에서 화살표가 켜진다', `샘플 ${rows.length}`);
  if (rows.length) {
    const minOp = Math.min(...rows.flatMap(r => [r.L.op, r.R.op]));
    const wide = rows.filter(r => r.widen > 0.8);
    const minWide = wide.length ? Math.min(...wide.flatMap(r => [r.L.op, r.R.op])) : 0;
    check(minOp > 0.85, '전 구간 알파 > 0.85 (빔 측면 페더 밖)', `최소 ${minOp}`);
    check(minWide > 0.85, '가장 벌어진 순간에도 안 흐려진다', `최소 ${minWide} (샘플 ${wide.length})`);
    check(rows[0].L.dots && rows[0].R.dots, '지면 점렬 자루 (러닝과 같은 규약)');
    check(rows[0].L.scale > 1.4, '두께 정규화 scale (0.34m 화살표와 같은 실측 두께)', `scale ${rows[0].L.scale}`);
  }
}

// ── ② A2 스탠스 라인 (발자국을 잇는 도트 라인) ─────────────────────────────────
{
  const rows = await collect('A2', () => {
    const S = window.__dbg?.session, P = S?.a2press;
    if (!P?.linkA?.visible || !P.linkB?.visible) return null;
    const one = m => ({
      look: !!m._canvas && !!m._tex,          // LINE 토큰인가(캔버스·텍스처 핸들은 makeFlowArrow 가 심는다)
      dots: !!m._dots, noTip: !!m._noTip,     // 지면 점렬 자루 · 촉 없음
      prog: +(m._prog ?? -1).toFixed(3), gain: +(m._gain ?? -1).toFixed(3),
      op: +m._mesh.material.opacity.toFixed(3),
      x: +m.position.x.toFixed(4), z: +m.position.z.toFixed(4),
    });
    const a = P.fmL.group.position, b2 = P.fmR.group.position;
    const mid = { x: (a.x + b2.x) / 2, z: (a.z + b2.z) / 2 };
    const holeOf = m => +Math.hypot(m.position.x - mid.x, m.position.z - mid.z).toFixed(4);
    return { spread: +(Math.abs(a.z - b2.z)).toFixed(3), A: one(P.linkA), B: one(P.linkB),
      holeA: holeOf(P.linkA), holeB: holeOf(P.linkB) };
  });
  console.log(`\n[A2 스탠스 라인]  보이는 샘플 ${rows.length}`);
  check(rows.length >= 4, '런지 구간에서 라인이 뜬다', `샘플 ${rows.length}`);
  if (rows.length) {
    const r0 = rows[0];
    const hole = Math.max(...rows.flatMap(r => [r.holeA, r.holeB]));
    const maxOp = Math.max(...rows.flatMap(r => [r.A.op, r.B.op]));
    const progs = rows.map(r => r.A.prog);
    const wide = rows.filter(r => r.spread > 0.35), narrow = rows.filter(r => r.spread < 0.2);
    check(r0.A.look && r0.B.look, '룩 시스템 LINE 토큰이다 (makeFlowArrow/drawStemArrow)');
    check(r0.A.dots && r0.A.noTip, '지면 점렬 자루 · 촉 없음 (보폭 표시, 방향 지시 아님)');
    check(hole < 0.002, '두 반쪽이 정확히 두 발 중점에서 만난다', `중앙 이격 ${hole}m`);
    check(maxOp > 0.5, '투사창 안에서 알파가 산다', `최대 ${maxOp}`);
    // 길이는 _prog 가 표현한다 — 스케일이 아니라 draw-on 이라, 두께는 보폭과 무관하게 일정하다.
    check(Math.max(...progs) <= 1 && Math.min(...progs) > 0.05, 'draw-on 이 살아있고 포화하지 않는다',
      `_prog ${Math.min(...progs)} → ${Math.max(...progs)}`);
    if (wide.length && narrow.length) {
      const w = Math.max(...wide.map(r => r.A.prog)), n = Math.max(...narrow.map(r => r.A.prog));
      check(w > n, '벌어질수록 길어진다', `좁을 때 ${n} < 넓을 때 ${w}`);
    } else console.log(`  ..    보폭 양극단 샘플 부족 — 단조성 검사 생략 (넓 ${wide.length} / 좁 ${narrow.length})`);
  }
}

await b.close();
console.log(fails.length ? `\n${fails.length}건 실패` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
