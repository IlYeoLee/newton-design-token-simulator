// ─────────────────────────────────────────────────────────────
// 전문가 이식 파이프라인 파일럿 — "데이터가 스스로 가이드가 된다"의 증명
//
//   주장: 뉴턴은 전문가의 움직임을 이식한다. 지금까지 팩은 사람이 데이터를
//   보고 손으로 만들었다 → 이 스크립트는 실측 모캡(BVH)에서 발 접지를
//   기계적으로 추출해 stepMark 팩을 손 배치 0으로 생성한다.
//
//   검증(폐루프):
//     충실도  — 원본 모션의 접지를 생성된 팩 판정창에 다시 통과 → ~100% 기대
//     판별력  — ①다른 주법(dash) ②타이밍·공간 흐트러뜨린 변형을 같은 팩에
//               통과 → 점수가 뚜렷이 떨어져야 함.
//               떨어지지 않으면 가이드는 "그 사람"이 아니라 "아무나"를 담은 것.
//
//   사용: node scripts/expert_pipeline.mjs [--out public/packs/running_expert_auto.json]
// ─────────────────────────────────────────────────────────────
import fs from 'fs';

const D = Math.PI / 180;

// ── BVH 전체 FK (OFFSET + 위치/회전 채널 → 월드 위치) ──
function parseBVH(path) {
  const txt = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const joints = []; const stack = []; let cur = null;
  for (const raw of txt) {
    const line = raw.trim();
    if (/^(ROOT|JOINT)\s+(\S+)/.test(line)) {
      const j = { name: line.split(/\s+/)[1], parent: stack.length ? stack[stack.length - 1] : null, channels: [], offset: [0, 0, 0] };
      joints.push(j); cur = j;
    } else if (line === '{') stack.push(cur);
    else if (line === '}') stack.pop();
    else if (/^OFFSET/.test(line) && cur && stack[stack.length - 1] === cur) {
      cur.offset = line.split(/\s+/).slice(1, 4).map(Number);
    } else if (/^CHANNELS/.test(line)) {
      const p = line.split(/\s+/); cur.channels = p.slice(2, 2 + +p[1]);
    } else if (line.startsWith('End Site')) {
      // ⚠️ 여기서 push하면 안 된다. End Site 자체는 '{'가 대신 push하므로,
      // 미리 push하면 스택이 +1 초과 → 이후 형제 관절의 부모가 한 단계 어긋나
      // 다리가 흉부에 붙는다(발 FK가 가슴 높이로 뜨는 원인이었음).
      cur = { name: '__end', channels: [], offset: [0, 0, 0] };
    }
  }
  let col = 0; for (const j of joints) { j.col = col; col += j.channels.length; }
  const iF = txt.findIndex(l => /^Frames:/.test(l.trim()));
  const dt = +txt[iF + 1].trim().split(/\s+/)[2];
  const frames = txt.slice(iF + 2).filter(l => l.trim()).map(l => l.trim().split(/\s+/).map(Number));
  return { joints, byName: Object.fromEntries(joints.map(j => [j.name, j])), dt, frames };
}

const Rx = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = a => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const mm = (A, B) => A.map((r, i) => B[0].map((_, j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
const mv = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];

/** 관절 월드 위치: 부모 체인 따라 T(offset+poschan)·R 누적 */
function worldPos(bvh, name, f) {
  const chain = []; let j = bvh.byName[name];
  while (j) { chain.unshift(j); j = j.parent ? bvh.byName[j.parent.name] ? j.parent : null : null; }
  let pos = [0, 0, 0], R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const jj of chain) {
    // 위치 채널을 가진 관절(루트·힙)은 채널이 절대 로컬 위치 — OFFSET에 가산하면
    // 이중 가산으로 힙이 공중에 뜬다 (Bandai 실측: OFFSET 94cm + 채널 86cm = 1.8m 오류)
    const hasPos = jj.channels.some(c => c.endsWith('position'));
    let local = hasPos ? [0, 0, 0] : [...jj.offset];
    let M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let k = 0; k < jj.channels.length; k++) {
      const ch = jj.channels[k], v = f[jj.col + k];
      if (ch === 'Xposition') local[0] += v;
      else if (ch === 'Yposition') local[1] += v;
      else if (ch === 'Zposition') local[2] += v;
      else if (ch === 'Xrotation') M = mm(M, Rx(v * D));
      else if (ch === 'Yrotation') M = mm(M, Ry(v * D));
      else if (ch === 'Zrotation') M = mm(M, Rz(v * D));
    }
    pos = [pos[0] + R[0][0] * local[0] + R[0][1] * local[1] + R[0][2] * local[2],
           pos[1] + R[1][0] * local[0] + R[1][1] * local[1] + R[1][2] * local[2],
           pos[2] + R[2][0] * local[0] + R[2][1] * local[1] + R[2][2] * local[2]];
    R = mm(R, M);
  }
  return pos;
}

// ── 발 접지 추출 ──
// 접지 = 발 높이가 사이클 최저 근방 + 수평 속도 최소인 프레임.
// 루프 클립이므로 사이클당 발당 1회. 단위는 힙 높이로 자동 감지(cm→m).
function extractStrikes(path) {
  const bvh = parseBVH(path);
  const N = bvh.frames.length;
  const hipsY = worldPos(bvh, 'Hips', bvh.frames[0])[1];
  const scale = hipsY > 10 ? 0.01 : 1;          // cm 단위 감지
  const feet = { left: 'Foot_L', right: 'Foot_R' };
  const tracks = {};
  for (const [side, jn] of Object.entries(feet)) {
    tracks[side] = bvh.frames.map(f => worldPos(bvh, jn, f).map(v => v * scale));
  }
  // 전진 방향: 힙의 프레임간 평균 변위 (제자리면 스탠스 중 발의 후방 슬라이드로 대체)
  const hips = bvh.frames.map(f => worldPos(bvh, 'Hips', f).map(v => v * scale));
  const rootDrift = [hips[N - 1][0] - hips[0][0], hips[N - 1][2] - hips[0][2]];
  const strikes = [];
  for (const side of ['left', 'right']) {
    const tr = tracks[side];
    const ys = tr.map(p => p[1]);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const thr = yMin + (yMax - yMin) * 0.25;     // 하위 25% = 접지 후보
    // 수평 속도 (루프 랩 고려)
    const spd = tr.map((p, i) => {
      const q = tr[(i + 1) % N];
      return Math.hypot(q[0] - p[0], q[2] - p[2]) / bvh.dt;
    });
    // 후보 중 속도 최소 프레임 1개 = 미드스탠스(접지 대표점)
    let best = -1;
    for (let i = 0; i < N; i++) if (ys[i] <= thr && (best < 0 || spd[i] < spd[best])) best = i;
    if (best >= 0) strikes.push({ side, frame: best, t: best * bvh.dt, x: tr[best][0], z: tr[best][2], y: tr[best][1] });
  }
  strikes.sort((a, b) => a.t - b.t);
  return { strikes, dt: bvh.dt, cycleDur: N * bvh.dt, hips, rootDrift, scale };
}

// ── 접지 시퀀스 → 팩 (사이클 타일링) ──
// 시뮬 러닝 규약: 러너가 V(m/s)로 전진, stepMark는 t(초)·nx(레인 정규화, ×X_SCALE=m).
// nx = (발 x − 몸 중심선 x) / X_SCALE. 사이클을 K회 반복해 duration을 채운다.
const X_SCALE = 2.0, STEP_LIFETIME = 1.19;
function buildPack(src, K = 4) {
  const { strikes, cycleDur, hips } = src;
  const cx = hips.reduce((s, p) => s + p[0], 0) / hips.length;   // 몸 중심선
  const tokens = [{ t: 0, type: 'pathLane', nx: 0, ny: 0, lifetime: cycleDur * K * 0.98 }];
  let n = 1;
  const flat = [];
  for (let k = 0; k < K; k++) {
    for (const s of strikes) {
      const t = +(k * cycleDur + s.t).toFixed(4);
      const nx = +(((s.x - cx)) / X_SCALE).toFixed(4);
      tokens.push({ t, type: 'stepMark', foot: s.side, nx, ny: 0.35, lifetime: STEP_LIFETIME });
      tokens.push({ t, type: 'orderPulse', n: n++, nx, ny: 0.35, lifetime: STEP_LIFETIME });
      flat.push({ t, nx, foot: s.side });
    }
  }
  return {
    pack: {
      sport: 'running',
      packName: '러닝 / 전문가 자동추출 Pack',
      dataStatus: 'auto-extracted',
      source: {
        name: 'Bandai Namco Motiondataset — run_normal.bvh (실측 러너)',
        url: 'https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset',
        dataType: '30fps 풀스켈레톤 BVH → 발 접지 FK 자동 추출 (손 배치 0)',
        licenseNote: 'CC BY-NC-ND 4.0 (연구·프로토타입)',
        pipeline: 'scripts/expert_pipeline.mjs',
        extractedStrikesPerCycle: strikes.length,
        cycleDurSec: +cycleDur.toFixed(3),
      },
      duration: +(cycleDur * K).toFixed(3),
      hasWall: false,
      tokenCombination: ['pathLane', 'stepMark', 'orderPulse'],
      tokens,
      cues: [],
    },
    flat,
  };
}

// ── 판정: 접지 시퀀스를 팩 판정창에 통과 ──
// 시뮬 판정 규약 반영: 공간 허용 반경(입문 21 / 기본 15 / 근접 9cm) + 타이밍 ±60ms.
// 사이클 위상만 정렬(전문가도 시작 타이밍은 자유) — 시그니처(보폭 리듬·좌우 배치)로만 채점.
function score(flatGuide, flatProbe, radiusCm, dtWinMs = 60) {
  if (!flatProbe.length) return { hit: 0, n: 0, pct: 0 };
  const count = (off) => {
    let hit = 0;
    for (const p of flatProbe) {
      const pt = p.t + off;
      for (const g of flatGuide) {
        if (g.foot !== p.foot) continue;
        if (Math.abs(g.t - pt) * 1000 <= dtWinMs && Math.abs(g.nx - p.nx) * X_SCALE * 100 <= radiusCm) { hit++; break; }
      }
    }
    return hit;
  };
  // 최적 위상 정렬: 모든 (가이드, 프로브) 접지쌍 오프셋 후보 중 최고점.
  // 변형 케이스에 가장 유리한 정렬을 줘도 점수가 떨어져야 진짜 판별력이다.
  let best = 0;
  for (const g of flatGuide) for (const p of flatProbe) {
    if (g.foot !== p.foot) continue;
    best = Math.max(best, count(g.t - p.t));
  }
  return { hit: best, n: flatProbe.length, pct: +(100 * best / flatProbe.length).toFixed(1) };
}

/** 변형 모델: 일반인 흉내 — 타이밍 지터 σms, 좌우 흔들림 σcm (결정적 시드) */
function perturb(flat, sigmaMs, sigmaCm, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1; };
  return flat.map(p => ({
    t: p.t + rnd() * sigmaMs / 1000 * 1.7,      // ±약 σ 근사(균등)
    nx: p.nx + rnd() * sigmaCm / 100 / X_SCALE * 1.7,
    foot: p.foot,
  }));
}

// ── 실행 ──
const RUN = new URL('../public/mocap/run_normal.bvh', import.meta.url);
const DASH = new URL('../public/mocap/dash_normal.bvh', import.meta.url);

const runSrc = extractStrikes(RUN);
console.log('■ 추출 (run_normal.bvh)');
console.log('  사이클', runSrc.cycleDur.toFixed(3) + 's,', '접지', runSrc.strikes.length + '개/사이클:',
  runSrc.strikes.map(s => `${s.side}@${s.t.toFixed(2)}s x=${(s.x * 100).toFixed(1)}cm h=${(s.y * 100).toFixed(1)}cm`).join(' · '));

const { pack, flat: guide } = buildPack(runSrc, 4);
console.log('  → 팩 자동 생성: stepMark', guide.length + '개, duration', pack.duration + 's (손 배치 0)\n');

const dashSrc = extractStrikes(DASH);
const dashGuideLike = buildPack(dashSrc, Math.ceil(pack.duration / dashSrc.cycleDur)).flat;

console.log('■ 폐루프 검증 — 판정창: 타이밍 ±60ms, 공간(레인) 반경별');
const tiers = [['입문 ±21cm', 21], ['기본 ±15cm', 15], ['근접 ±9cm', 9]];
const cases = [
  ['원본 자신 (충실도)', guide],
  ['타이밍 +30ms σ 흔들림', perturb(guide, 30, 0)],
  ['일반인 모델 (60ms·8cm σ)', perturb(guide, 60, 8)],
  ['크게 흐트러짐 (120ms·15cm σ)', perturb(guide, 120, 15)],
  ['다른 주법 (dash_normal)', dashGuideLike],
];
const table = [];
for (const [label, probe] of cases) {
  const row = { 대상: label };
  for (const [tn, r] of tiers) row[tn] = score(guide, probe, r).pct + '%';
  table.push(row);
}
console.table(table);

console.log('해석: 원본=100%에 가깝고 아래로 갈수록 떨어지면, 이 가이드는');
console.log('"아무나의 러닝"이 아니라 이 러너의 시그니처(리듬+발 배치)를 인코딩한 것.\n');

const outArg = process.argv.indexOf('--out');
if (outArg > 0) {
  const out = process.argv[outArg + 1];
  fs.writeFileSync(out, JSON.stringify(pack, null, 1));
  console.log('팩 저장:', out);
}
