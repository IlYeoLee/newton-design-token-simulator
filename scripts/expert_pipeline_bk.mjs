// ─────────────────────────────────────────────────────────────
// 전문가 이식 파이프라인 — 농구 스텝백 (커리 실경기)
//
//   소스: NBA SportVU 25fps 실경기 트래킹, 2015-10-31 GSW at NOP
//   (커리 53득점 경기). data/curry_stepback_sportvu.json — 표본 3개:
//   커리 3Q 스텝백(메인) · 커리 1Q 스텝백(같은 선수 다른 순간) ·
//   Anthony Davis 유사동작(타 선수 대조군).
//
//   러닝 파일럿과 같은 폐루프에 더해, 여기선 두 질문을 정량으로 답한다:
//     ① 커리의 다른 스텝백이 이 가이드에 높게 나오는가
//        → 높으면 "커리 스텝백 = 재현 가능한 시그니처" = 팩으로 팔 수 있는 지식
//     ② 타 선수의 동작은 낮게 나오는가 → 가이드가 커리 고유성을 담는다는 증거
//
//   앵커 추출(기계, 손 배치 0): 궤적에서 플랜트(림 최근접·감속 최대) →
//   스텝백 착지(후방 분리 극대) → 릴리스(공 z 상승) 3점 + 타이밍.
//   좌표는 패드 프레임(원점=플랜트, 전방=림 방향)으로 정규화 —
//   코트 어디서 했는지가 아니라 "동작 자체"를 비교한다.
//
//   한계(정직): SportVU는 무게중심 x/y만 있다(발 위치 아님). 앵커는
//   신체 중심 기준이고 25fps라 타이밍 분해능 ±40ms — 판정창에 반영.
// ─────────────────────────────────────────────────────────────
import fs from 'fs';

const SRC = JSON.parse(fs.readFileSync(new URL('../data/curry_stepback_sportvu.json', import.meta.url)));
const FT = 0.3048;                      // ft → m
const BK_SCALE = 5;                     // mapFor(basketball): world m = n × 5

// ── 앵커: { plant, land(스텝백 착지), release } (t초, 패드좌표 m) ──
// land·release 프레임은 검출기(scripts/extract_sportvu_stepback.py)가 검증한 값
// (릴리스 = 공 9ft 상향돌파 시 선수 4.5ft 이내 + 정점≥12ft + 림 접근 — 킥아웃 패스 배제).
// plant = 드라이브~착지 구간의 림 최근접(감속 전환점)을 여기서 계산.
function extractAnchors(sample) {
  const R = sample.rows;
  const hoop = sample.hoop;
  const dist = (r) => Math.hypot(r.x - hoop[0], r.y - hoop[1]);
  const rr = R.map(dist);
  const { drive, land: il, release: ir } = sample.anchors;
  let ip = drive;
  for (let i = drive; i <= il; i++) if (rr[i] < rr[ip]) ip = i;
  // 패드 프레임: 원점=플랜트 위치, +전방=림 방향
  const fx = (hoop[0] - R[ip].x), fy = (hoop[1] - R[ip].y);
  const fl = Math.hypot(fx, fy); const ux = fx / fl, uy = fy / fl;   // 전방 단위벡터
  const toPad = (r) => {
    const dx = (r.x - R[ip].x) * FT, dy = (r.y - R[ip].y) * FT;
    return { fwd: dx * ux + dy * uy, lat: -dx * uy + dy * ux };      // (전방, 좌우) m
  };
  const t0 = R[ip].t;
  const A = (i, name) => ({ name, t: +(R[i].t - t0).toFixed(3), ...toPad(R[i]) });
  return {
    anchors: [A(ip, 'plant'), A(il, 'stepback'), A(ir, 'release')],
    meta: {
      approachSpeed: +((rr[Math.max(0, ip - 12)] - rr[ip]) / (R[ip].t - R[Math.max(0, ip - 12)].t + 1e-9) * FT).toFixed(2),
      separationM: +((rr[il] - rr[ip]) * FT).toFixed(2),
      releaseAfterLandMs: Math.round((R[ir].t - R[il].t) * 1000),
      defBefore: R[ip].dd, defAfter: R[il].dd,
      hoopDistM: +(rr[ip] * FT).toFixed(1),
    },
  };
}

// ── 팩 생성 (시뮬 농구 규약: nx=측방/5m, ny=-전방/5m) ──
function buildPack(ex, src) {
  const toN = (a) => ({ nx: +(a.lat / BK_SCALE).toFixed(4), ny: +(-a.fwd / BK_SCALE).toFixed(4) });
  const [plant, land, release] = ex.anchors;
  const dur = release.t + 1.2;
  const tokens = [
    { t: 0, type: 'pathLane', nx: 0, ny: 0, lifetime: dur * 0.95 },
    { t: plant.t, type: 'stepMark', foot: 'right', ...toN(plant), lifetime: 0.9 },
    { t: plant.t, type: 'orderPulse', n: 1, ...toN(plant), lifetime: 0.9 },
    { t: plant.t, type: 'directionGuide', angle: 180, ...toN(plant), lifetime: 0.9 },  // 후방
    { t: land.t, type: 'stepMark', foot: 'left', ...toN(land), lifetime: 0.9 },
    { t: land.t, type: 'orderPulse', n: 2, ...toN(land), lifetime: 0.9 },
    { t: release.t, type: 'stepMark', foot: 'right', ...toN(release), lifetime: 0.9 },
    { t: release.t, type: 'orderPulse', n: 3, ...toN(release), lifetime: 0.9 },
  ];
  return {
    sport: 'basketball',
    packName: '농구 / 커리 스텝백 자동추출 Pack',
    dataStatus: 'auto-extracted',
    source: {
      name: 'NBA SportVU — ' + SRC.provenance.game + ' (커리 ' + SRC.provenance.curry_pts + '득점)',
      moment: src.name, playerid: src.playerid,
      dataType: '25fps 무게중심 트래킹 → 플랜트/스텝백/릴리스 앵커 기계 추출 (손 배치 0)',
      licenseNote: SRC.provenance.license,
      pipeline: 'scripts/expert_pipeline_bk.mjs',
      limits: '무게중심 기준(발 위치 아님) · 25fps = 타이밍 분해능 ±40ms',
      metrics: ex.meta,
    },
    duration: +dur.toFixed(3),
    hasWall: false,
    tokenCombination: ['pathLane', 'stepMark', 'orderPulse', 'directionGuide'],
    tokens, cues: [],
  };
}

// ── 폐루프 채점: 앵커 3점을 (상대시간, 패드좌표)로 비교 ──
// 25fps 분해능(±40ms)이 있으므로 타이밍 창 ±120ms(러닝 ±60ms보다 넓힘, 근거 명시).
function score(guide, probe, radiusCm, dtWinMs = 120) {
  let hit = 0;
  for (let i = 0; i < guide.length; i++) {
    const g = guide[i], p = probe[i];
    if (!p) continue;
    const dtms = Math.abs((g.t - guide[0].t) - (p.t - probe[0].t)) * 1000;   // 플랜트 기준 상대시간
    const dcm = Math.hypot(g.fwd - p.fwd, g.lat - p.lat) * 100;
    if (dtms <= dtWinMs && dcm <= radiusCm) hit++;
  }
  return +(100 * hit / guide.length).toFixed(0);
}

function perturbAnchors(anchors, sigmaMs, sigmaCm, seed = 11) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1; };
  return anchors.map(a => ({ ...a, t: a.t + rnd() * sigmaMs / 1000 * 1.7, fwd: a.fwd + rnd() * sigmaCm / 100 * 1.7, lat: a.lat + rnd() * sigmaCm / 100 * 1.7 }));
}

// ── 실행 ──
const main = extractAnchors(SRC.main);
const alt = extractAnchors(SRC.curry_alt);
const other = extractAnchors(SRC.other);

console.log('■ 추출 (커리 3Q 스텝백 — ' + SRC.provenance.game + ')');
console.log('  접근속도', main.meta.approachSpeed + 'm/s · 후방 분리', main.meta.separationM + 'm · 수비거리',
  main.meta.defBefore + 'ft →', main.meta.defAfter + 'ft · 림거리', main.meta.hoopDistM + 'm');
for (const a of main.anchors) console.log(`  ${a.name}: t=${a.t}s 전방=${(a.fwd*100).toFixed(0)}cm 측방=${(a.lat*100).toFixed(0)}cm`);

const pack = buildPack(main, SRC.main);
console.log('  → 팩 자동 생성: 토큰', pack.tokens.length + '개 (손 배치 0)\n');

console.log('■ 폐루프 — 앵커 3점(플랜트→스텝백→릴리스), 타이밍 ±120ms(25fps 분해능 반영)');
const tiers = [['입문 ±40cm', 40], ['기본 ±25cm', 25], ['근접 ±15cm', 15]];
const cases = [
  ['커리 원본 자신 (충실도)', main.anchors],
  ['커리 다른 스텝백 (1Q, 시그니처 일관성)', alt.anchors],
  ['일반인 모델 (100ms·20cm σ)', perturbAnchors(main.anchors, 100, 20)],
  [SRC.other.name + ' (타 선수)', other.anchors],
];
const table = [];
for (const [label, probe] of cases) {
  const row = { 대상: label };
  for (const [tn, r] of tiers) row[tn] = score(main.anchors, probe, r) + '%';
  table.push(row);
}
console.table(table);
console.log('참고 — 커리 alt 메트릭: 분리', alt.meta.separationM + 'm, 접근', alt.meta.approachSpeed + 'm/s');
console.log('       ' + SRC.other.name + ' 메트릭: 분리', other.meta.separationM + 'm, 접근', other.meta.approachSpeed + 'm/s');

const outArg = process.argv.indexOf('--out');
if (outArg > 0) {
  fs.writeFileSync(process.argv[outArg + 1], JSON.stringify(pack, null, 1));
  console.log('\n팩 저장:', process.argv[outArg + 1]);
}
