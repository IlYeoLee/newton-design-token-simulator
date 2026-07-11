import * as THREE from 'three';
import { createScene, WALL_Z } from './scene.js';
import { TokenSystem, COLORS, TCFG } from './tokens.js';
import { Effects } from './effects.js';
import { XBot } from './xbot.js';
import { Panel } from './panel.js';
import { ProjectorRig } from './projector.js';
import { WallGhost } from './ghost.js';
import { Judge } from './judge.js';
import { Session, SCFG } from './session.js';
import { StudioDoc } from './studio/doc.js';
import { StudioCanvas } from './studio/canvas.js';
import { StudioProps } from './studio/props.js';
import { SceneScope } from './studio/scene-scope.js';
import { DesignStore } from './studio/store.js';
import { loadSvg } from './studio/design.js';
import { initBudgetPanel } from './budgetPanel.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;
const PACK_FILES = {
  running: `${BASE}packs/running_cadence_real.json`,
  boxing: `${BASE}packs/boxing_jab_real.json`,
  basketball: `${BASE}packs/basketball_cutin_real.json`,
  // 전문가 이식 자동 팩 — 커리 실경기 스텝백 (expert_pipeline_bk.mjs 산출).
  // 별도 종목이 아니라 농구 팩의 변형으로 스왑된다(종목 로직 공유).
  basketball_curry: `${BASE}packs/basketball_curry_stepback_auto.json`,
  // 러닝 전문가 자동 팩 — Bandai run_normal.bvh 발 접지 FK 추출 (expert_pipeline.mjs 산출).
  // botClip: 'bkRun' = 같은 BVH의 리타겟 클립 → 봇이 원본 러너 모션을 그대로 재생.
  running_expert: `${BASE}packs/running_expert_auto.json`,
};

const state = {
  pack: 'running',
  packs: {},
  time: 0,
  speed: 1,
  playing: true,
};

async function boot() {
  const stage = document.getElementById('stage');
  const { renderer, scene, camera, controls, setPackEnvironment, resize } = createScene(stage);

  let sessionSkillSink = null;   // 슬라이더가 session 생성 전 초기 apply 시 TDZ 회피
  let refreshEditorStages = null; // switchPack → 에디터 스테이지 편집기 갱신 훅
  const effects = new Effects(scene);
  const tokens = new TokenSystem(scene, effects);
  const xbot = new XBot(scene);
  const rig = new ProjectorRig(scene, xbot);
  const ghost = new WallGhost(scene);
  const judge = new Judge();

  // 판정 색상 피드백: hit 초록 / near 앰버 / miss 레드 — 마커 링 + 실제 착지점 도트
  judge.onVerdict = (ev, verdict, best) => {
    const col = verdict === 'hit' ? 0xd1feff : verdict === 'near' ? 0xfec389 : 0x9b9b9b; // 프리즘/샌드/무음 그레이
    const pos = ev.marker.group.getWorldPosition(new THREE.Vector3());
    const n = ev.surface === 'wall' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    effects.burst(pos, col, n);
    if (best) {
      const dotPos = ev.surface === 'wall'
        ? new THREE.Vector3(best.px, best.p2, WALL_Z + 0.03)
        : new THREE.Vector3(best.px, 0.016, best.p2);
      effects.dot(dotPos, col, n);
    }
    // 실전 다운시프트: 세션 라이브 중 연속 Miss 누적 → 익히기 복귀
    session.reportVerdict(verdict);
  };

  // 허용 오차 슬라이더 + 리포트 렌더
  const reportEl = document.getElementById('report');
  function renderReport(rep) {
    if (!rep) return;
    const w = rep.worst;
    reportEl.innerHTML = `
      <b style="color:var(--text);font-size:14px;">Pack 일치도 <span style="color:${rep.matchPct >= 70 ? 'var(--ok)' : '#ffc94d'}">${rep.matchPct}%</span></b>
      <span style="color:var(--dim)"> (${rep.hits}/${rep.n} hit)</span><br>
      평균 타이밍 오차 ±${rep.avgTms.toFixed(0)}ms · 평균 위치 오차 ${rep.avgPcm.toFixed(1)}cm<br>
      어려웠던 구간: t=${w ? w.t.toFixed(2) : '—'}s (${w ? (w.perr * 100).toFixed(1) : '—'}cm, ${w ? w.verdict : '—'})
    `;
  }

  // 투사면 GPU 클리핑 공유 — 모든 토큰/이펙트가 투사면 안에서만 그려짐
  tokens.floorClip = rig.floorClip;
  tokens.wallClip = rig.wallClip;
  effects.floorClipPlanes = rig.floorClip;
  effects.wallClipPlanes = rig.wallClip;

  // 흔들림 보정 토글
  const stabBtn = document.getElementById('btn-stab');
  const stabErr = document.getElementById('stab-err');
  const stabPhase = document.getElementById('stab-phase');
  const stabOmega = document.getElementById('stab-omega');
  const stabBudget = document.getElementById('stab-budget');
  initBudgetPanel();   // 🛡 오차예산·가정 출처 (defensibility)
  stabBtn.addEventListener('click', () => {
    rig.stabilize = !rig.stabilize;
    stabBtn.textContent = rig.stabilize ? '보정 ON' : '보정 OFF';
    stabBtn.style.borderColor = rig.stabilize ? 'var(--ok)' : '#ff5c8a';
    stabBtn.style.color = rig.stabilize ? 'var(--ok)' : '#ff5c8a';
    stabBtn.style.background = rig.stabilize ? 'rgba(105,240,174,.12)' : 'rgba(255,92,138,.12)';
  });

  const panel = new Panel({
    onPack: p => switchPack(p),
    onLead: v => tokens.setParams({ lead: v }),
    onSize: v => tokens.setParams({ size: v }),
    onCount: v => tokens.setParams({ maxVisible: v }),
    onSpeed: v => { state.speed = v; },
    onTogglePlay: () => { state.playing = !state.playing; panel.setPlaying(state.playing); },
    onSeek: t => { state.time = t; tokens.resetLoop(); markFiredBefore(t); },
  });

  // 데이터 + X Bot + 고스트 포즈 병렬 로드
  const [packEntries, posePayload] = await Promise.all([
    Promise.all(Object.entries(PACK_FILES).map(async ([k, url]) => {
      const res = await fetch(url);
      return [k, await res.json()];
    })),
    fetch(`${BASE}packs/boxing_pose_timeline.json`).then(r => r.json()),
    xbot.load(),
  ]);
  for (const [k, v] of packEntries) state.packs[k] = v;
  const ORIGINAL_PACKS = {
    running: structuredClone(state.packs.running),
    boxing: structuredClone(state.packs.boxing),
    basketball: structuredClone(state.packs.basketball),
  };  // Studio 원본 복원용

  // 통합 디자인 저장소 — 팩 토큰 + 장면 오버라이드 + 전역 설정이 한 키(newton_design_v1).
  // 레거시 3분할 키는 최초 1회 자동 이행된다(store.js).
  const { store: designStore, migrated } = DesignStore.load();
  if (migrated.length) console.log('[design store] 레거시 이행:', migrated.join(', '));
  for (const sp of ['running', 'boxing', 'basketball']) {
    const p = designStore.getPack(sp);
    if (!p) continue;
    try {
      await Promise.all((p.tokens || []).filter(t => t.design?.svgUrl).map(t => loadSvg(t.design)));  // svg 동기 렌더 대비
      state.packs[sp] = p;
    } catch (e) { console.warn('[design store] 팩 복원 실패', sp, e); }
  }
  function saveStudio(sport, pack) {
    designStore.setPack(sport, pack);
    designStore.save();
  }
  function saveScenes() { designStore.save(); }

  // 농구 팩 변형 토글: 실경기 컷인(기본) ↔ 커리 스텝백 자동추출.
  // state.pack 키는 'basketball' 유지 — 종목 분기 로직을 전부 그대로 탄다.
  const bkVariants = { real: state.packs.basketball, curry: state.packs.basketball_curry };
  let bkVariant = 'real';
  const curryBtn = document.getElementById('bk-curry');
  curryBtn?.addEventListener('click', () => {
    bkVariant = bkVariant === 'curry' ? 'real' : 'curry';
    state.packs.basketball = bkVariants[bkVariant];
    document.querySelector('[data-pack=basketball]')?.click();   // 탭 활성+switchPack (전 버튼 active 초기화)
    curryBtn.classList.toggle('active', bkVariant === 'curry');  // 초기화 뒤에 붙여야 살아남는다
  });

  // 러닝 팩 변형 토글: 실측 케이던스(기본) ↔ 전문가 자동추출 (커리 토글과 동일 패턴).
  const runVariants = { real: state.packs.running, expert: state.packs.running_expert };
  let runVariant = 'real';
  const expertBtn = document.getElementById('run-expert');
  expertBtn?.addEventListener('click', () => {
    runVariant = runVariant === 'expert' ? 'real' : 'expert';
    state.packs.running = runVariants[runVariant];
    document.querySelector('[data-pack=running]')?.click();
    expertBtn.classList.toggle('active', runVariant === 'expert');
  });

  ghost.setData(posePayload);

  // 이벤트 문구 출력 없음 — 착지마다 뜨는 텍스트는 과잉 개입 (지면 리플 이펙트만)

  function markFiredBefore(t) {
    for (const ev of tokens.events) ev.fired = ev.t < t;
  }

  function switchPack(p) {
    if (typeof stopSession === 'function') stopSession();  // 팩 전환 시 세션 종료
    state.pack = p;
    state.time = 0;
    const data = state.packs[p];
    tokens.setPack(data);
    xbot.setPack(data, tokens.events);
    rig.setPack(data.sport, tokens.events);
    const isKneePack = data.sport === 'running' || data.sport === 'basketball';
    tokens.footprintTest = isKneePack ? (x, z, inset) => rig.contains(x, z, inset) : null;
    effects.clip = isKneePack ? (x, z) => rig.contains(x, z) : null;

    // 팩별 투사면 기본값 — 농구 스텝은 발치 좁은 구역(2.4m), 러닝은 전방 3m
    const farEl = document.getElementById('s-fpfar');
    farEl.value = data.sport === 'basketball' ? 240 : 300;
    farEl.dispatchEvent(new Event('input'));

    // 정보 위계: 농구는 NOW+NEXT 2개만 (공간 위계 혼잡 방지)
    const countEl = document.getElementById('s-count');
    countEl.value = data.sport === 'basketball' ? 2 : 3;
    countEl.dispatchEvent(new Event('input'));

    judge.setPack(tokens.events, data.sport);
    reportEl.innerHTML = '루프 1회 완료 시 리포트 생성…';

    // 벽면 고스트 → 실제 모션 고스트봇으로 대체 (실루엣은 보조로 끔)
    ghost.group.visible = false;
    if (data.sport === 'boxing') { ensureGhostBot(); computeStation(); }
    if (ghostLayer) ghostLayer.visible = data.sport === 'boxing';
    if (data.sport === 'boxing') {
      const punchTimes = tokens.events.filter(e => e.surface === 'wall').map(e => e.t);
      ghost.configure(punchTimes, rig._wallCenter, rig.wallH);
      ghost.setClip(rig.wallClip);
    }
    setPackEnvironment(p, data.hasWall);
    panel.setPack(data, tokens.events);
    tokens.resetLoop();
    lastBodyZ = 0;

    // 세션 가용성 표시 — 러닝·농구·복싱 지원
    const availEl = document.getElementById('session-avail');
    const btnEl = document.getElementById('btn-session');
    const label = { running: '러닝', basketball: '농구', boxing: '복싱' }[p];
    const ok = !!label;
    if (availEl) availEl.textContent = ok ? `· ${label} 세션` : '· 준비 중';
    if (btnEl) { btnEl.style.opacity = ok ? '1' : '0.5'; btnEl.style.pointerEvents = ok ? 'auto' : 'none'; }
    refreshEditorStages?.();   // 에디터 스테이지 타임라인 갱신
  }

  // ── 시야 콘 (자연 시선, 조절 가능) ──────────────
  let gazePitch = THREE.MathUtils.degToRad(-18);
  const FOV_V = THREE.MathUtils.degToRad(60);  // 인간 유효 수직 시야
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
  const fovCone = new THREE.LineSegments(coneGeo,
    new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.55 }));
  fovCone.visible = false;
  fovCone.frustumCulled = false;
  scene.add(fovCone);

  function updateFovCone() {
    const eye = xbot.getEyeWorld();
    if (!eye) { fovCone.visible = false; return; }
    const fwd = xbot.getForward();
    const look = new THREE.Vector3(
      fwd.x * Math.cos(gazePitch), Math.sin(gazePitch), fwd.z * Math.cos(gazePitch)).normalize();
    const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, look).normalize();
    const tV = Math.tan(FOV_V / 2), tH = tV * 1.5;
    const dirs = [
      look.clone().addScaledVector(right, -tH).addScaledVector(up, tV).normalize(),
      look.clone().addScaledVector(right, tH).addScaledVector(up, tV).normalize(),
      look.clone().addScaledVector(right, tH).addScaledVector(up, -tV).normalize(),
      look.clone().addScaledVector(right, -tH).addScaledVector(up, -tV).normalize(),
    ];
    const far = dirs.map(d => {
      if (d.y >= -0.01) return eye.clone().addScaledVector(d, 3.5);
      const t = (0.015 - eye.y) / d.y;
      return t > 0 && t < 8 ? eye.clone().addScaledVector(d, t) : eye.clone().addScaledVector(d, 3.5);
    });
    const near = dirs.map(d => eye.clone().addScaledVector(d, 0.8));
    const buf = fovCone.geometry.attributes.position.array;
    let i = 0;
    const s = p => { buf[i++] = p.x; buf[i++] = p.y; buf[i++] = p.z; };
    dirs.forEach((_, c) => { s(eye); s(far[c]); });
    for (let c = 0; c < 4; c++) { s(far[c]); s(far[(c + 1) % 4]); }
    for (let c = 0; c < 4; c++) { s(near[c]); s(near[(c + 1) % 4]); }
    fovCone.geometry.attributes.position.needsUpdate = true;
  }

  // ── 밟을 수 있는 영역 (보폭 도달 범위) — 몸 앞 반경 0.5~1.15m 부채꼴 ──
  const reach = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1.15, 36, 1, Math.PI / 6, Math.PI * 2 / 3),
    new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
  );
  reach.rotation.x = -Math.PI / 2;
  reach.renderOrder = 1;
  scene.add(reach);

  // ── 복싱 스테이션 유닛 (인물 앞 바닥, 등맞댐: 앞면=벽 투사 / 뒷면=카메라 인식) ──
  // 유저는 원점(z=0), 벽은 z=WALL_Z. 유닛은 그 사이(인물 앞)에 놓인다.
  const PROJ_V = THREE.MathUtils.degToRad(62);  // 프로젝터 수직 화각
  const CAM_V = THREE.MathUtils.degToRad(50), CAM_H = THREE.MathUtils.degToRad(64);
  const LENS_H = 0.34;   // 바닥 유닛 렌즈 높이 (m)
  const opt = { zU: -0.3, dProj: 1.5, tilt: 60, standZ: 1.6, dCam: 1.9 };

  // 카메라 인식 볼륨(연한 반투명) + 뒷면 카메라 렌즈 표식 + 최적 위치 링
  const trackVol = new THREE.Mesh(new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x6ad4de, transparent: true, opacity: 0.055,
      side: THREE.DoubleSide, depthWrite: false }));
  const trackEdge = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x6ad4de, transparent: true, opacity: 0.30 }));
  trackVol.frustumCulled = trackEdge.frustumCulled = false;
  trackVol.renderOrder = 2;
  const optRing = new THREE.Mesh(
    new THREE.RingGeometry(0.30, 0.345, 48),
    new THREE.MeshBasicMaterial({ color: 0x6ad4de, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  optRing.rotation.x = -Math.PI / 2;
  const camMark = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.015, 16),
    new THREE.MeshStandardMaterial({ color: 0x6ad4de, emissive: 0x2f8a92, emissiveIntensity: 1.4 }));
  camMark.rotation.x = Math.PI / 2;
  trackVol.visible = trackEdge.visible = optRing.visible = camMark.visible = false;
  scene.add(trackVol, trackEdge, optRing, camMark);

  // ── 농구 방향·리듬 큐 — 무릎유닛은 정밀 플랜트를 못 쏘므로(전방투사 한계)
  //    방향·리듬이 실제 가이드. 패드를 채우게 크게: 중앙 큰 화살표 + 깊이 따라
  //    흐르는 리듬 비트 3개 + 좌우 레인. ──
  const bkArrow = (() => {
    const s = new THREE.Shape(); const w = 0.2, hw = 0.5, hl = 0.42, len = 1.25;
    s.moveTo(-w / 2, 0); s.lineTo(-w / 2, len - hl); s.lineTo(-hw / 2, len - hl);
    s.lineTo(0, len); s.lineTo(hw / 2, len - hl); s.lineTo(w / 2, len - hl); s.lineTo(w / 2, 0); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s),
      new THREE.MeshBasicMaterial({ color: 0xfe6e3c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    const g = new THREE.Group(); g.add(m); m.rotation.x = -Math.PI / 2; g.position.y = 0.018; g.renderOrder = 5;
    g.visible = false; scene.add(g); return g;
  })();
  const bkBeats = [];   // 깊이 따라 3개 리듬 비트 링
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.215, 36),
      new THREE.MeshBasicMaterial({ color: 0xfa3030, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.021; r.renderOrder = 6; r.visible = false;
    scene.add(r); bkBeats.push(r);
  }
  const bkLane = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0xfe6e3c, dashSize: 0.14, gapSize: 0.12, transparent: true, opacity: 0.45 }));
  bkLane.renderOrder = 5; bkLane.visible = false; scene.add(bkLane);

  // ── 복싱 그림자 검증: 스테이션 빔이 만드는 주먹/팔 그림자가 벽 타겟을 가리는가 ──
  // 스테이션(인물 앞)에서 벽으로 투사 → 유저 팔이 빔을 가로지르면 벽 타겟 위에 그림자.
  const shadowMesh = new THREE.Mesh(new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
  shadowMesh.frustumCulled = false; shadowMesh.renderOrder = 3; shadowMesh.visible = false;
  const shTargetRing = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.205, 40),
    new THREE.MeshBasicMaterial({ color: 0xd1feff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  shTargetRing.renderOrder = 4; shTargetRing.visible = false;
  scene.add(shadowMesh, shTargetRing);
  const boxShadow = { on: false, total: 0, occ: 0, peakCov: 0, curOcc: false, curCov: 0 };
  const WB = { XS: 2.2, Y0: 0.73, YS: 1.2 };          // tokens.js LAYOUT.boxing.WALL
  const TARGET_R = 0.20;                                // 벽 타겟 반경 (판정 허용창)
  function projToWall(P, S) {                           // S에서 P를 벽면(z=WALL_Z)으로 투영
    const dz = P.z - S.z;
    if (dz >= -1e-4) return null;                       // P가 스테이션 뒤(유저측) → 그림자 없음
    const t = (WALL_Z - S.z) / dz;                      // t>=1 : P가 스테이션과 벽 사이
    if (t < 1) return null;
    return { x: S.x + t * (P.x - S.x), y: S.y + t * (P.y - S.y), t };
  }
  function updateBoxShadow() {
    if (!boxShadow.on || state.pack !== 'boxing') { shadowMesh.visible = shTargetRing.visible = false; return; }
    const S = rig.stationPos;                           // 프로젝터 렌즈 (인물 앞)
    const arm = xbot.getRightArm();
    const tx = (state.packs.boxing.tokens.find(t => t.type === 'targetMark')?.nx ?? -0.06) * WB.XS;
    const ty = WB.Y0 + (state.packs.boxing.tokens.find(t => t.type === 'targetMark')?.ny ?? 0.34) * WB.YS;
    shTargetRing.position.set(tx, ty, WALL_Z + 0.028); shTargetRing.visible = true;

    // 시뮬은 봇을 z=0에 렌더하지만 설계상 유저는 standZ(스테이션 뒤)에 선다.
    // 그림자 판정은 '설계 거리'로: 팔 좌표를 standZ만큼 유저측(+z)으로 이동해 평가.
    const OFF = opt.standZ;   // 봇(z=0) → 설계 서기 위치
    const arm2 = {
      elbow: arm.elbow.clone().setZ(arm.elbow.z + OFF),
      wrist: arm.wrist.clone().setZ(arm.wrist.z + OFF),
    };
    // 접근 통계: 주먹이 빔에 도달하는가 (스테이션보다 벽쪽 = z < stationZ)
    boxShadow.total++;
    boxShadow.minReachGap = Math.min(boxShadow.minReachGap ?? 99, arm2.wrist.z - S.z);   // >0 이면 빔 뒤(그림자 없음)

    const el = projToWall(arm2.elbow, S), wr = projToWall(arm2.wrist, S);
    if (!wr) { shadowMesh.visible = false; boxShadow.curOcc = false; boxShadow.curCov = 0; return; }
    const foreR = 0.055, fistR = 0.07;
    const wHW = fistR * wr.t, eHW = el ? foreR * el.t : wHW;
    // 그림자 = 팔뚝(elbow'→wrist') 두꺼운 사각 + 주먹(wrist') 원
    const a = el || wr, b = wr;
    let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = -dy, ny = dx;
    const verts = [];
    const quad = (p1, p2, p3, p4) => { verts.push(p1.x,p1.y,WALL_Z+0.025, p2.x,p2.y,WALL_Z+0.025, p3.x,p3.y,WALL_Z+0.025,  p1.x,p1.y,WALL_Z+0.025, p3.x,p3.y,WALL_Z+0.025, p4.x,p4.y,WALL_Z+0.025); };
    quad({x:a.x+nx*eHW,y:a.y+ny*eHW},{x:b.x+nx*wHW,y:b.y+ny*wHW},{x:b.x-nx*wHW,y:b.y-ny*wHW},{x:a.x-nx*eHW,y:a.y-ny*eHW});
    for (let i=0;i<16;i++){ const a0=i/16*Math.PI*2, a1=(i+1)/16*Math.PI*2;
      verts.push(b.x,b.y,WALL_Z+0.025, b.x+Math.cos(a0)*wHW,b.y+Math.sin(a0)*wHW,WALL_Z+0.025, b.x+Math.cos(a1)*wHW,b.y+Math.sin(a1)*wHW,WALL_Z+0.025); }
    shadowMesh.geometry.dispose();
    shadowMesh.geometry = new THREE.BufferGeometry();
    shadowMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    shadowMesh.visible = true;

    // 타겟 가림 측정 — 팔뚝 세그먼트까지 최소거리 vs (타겟R + 그림자 폭)
    const dist = distPointSeg(tx, ty, a.x, a.y, b.x, b.y);
    const cover = Math.max(0, (TARGET_R + wHW - dist) / (2 * TARGET_R));   // 0~1 대략 커버율
    boxShadow.curOcc = dist < TARGET_R + wHW;
    boxShadow.curCov = Math.min(1, cover);
    // 주먹이 실제로 빔에 도달한 프레임에서만 가림 집계 (total은 위에서 전체 카운트)
    if (boxShadow.curOcc) boxShadow.occ++;
    boxShadow.peakCov = Math.max(boxShadow.peakCov, boxShadow.curCov);
  }
  function distPointSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx*dx + dy*dy;
    let t = l2 ? ((px-ax)*dx + (py-ay)*dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax+t*dx), py - (ay+t*dy));
  }

  // 최적 유닛 위치·인식 볼륨 재계산 (벽 크기 슬라이더 반영)
  function computeStation() {
    const cy = (rig._wallCenter?.cy) ?? 1.4;
    const dProj = (rig.wallH / 2) / Math.tan(PROJ_V / 2);      // 벽 세로 커버 최소 투사거리
    const zU = WALL_Z + dProj;                                 // 유닛 z (인물 앞)
    const tilt = Math.atan2(cy - LENS_H, dProj) * 180 / Math.PI;
    const dCamReq = (1.8 / 2) / Math.tan(CAM_V / 2);           // 전신 프레이밍 최소 거리
    const standZ = zU + dCamReq;                               // 유저가 서야 할 z (유닛 뒤)
    Object.assign(opt, { zU, dProj, tilt, standZ, dCam: dCamReq });

    rig.setStation(new THREE.Vector3(0, LENS_H, zU));
    camMark.position.set(0, LENS_H, zU + 0.06);
    optRing.position.set(0, 0.013, standZ);

    // 뒷면 카메라 인식 프러스텀 (유닛 → +Z, 유저 방향)
    const A = new THREE.Vector3(0, LENS_H, zU);
    const D = dCamReq + 0.7, zf = zU + D;
    const yT = LENS_H + D * Math.tan(CAM_V / 2);
    const yB = Math.max(0.01, LENS_H - D * Math.tan(CAM_V / 2) * 0.4);
    const xH = D * Math.tan(CAM_H / 2);
    const c = [ new THREE.Vector3(-xH, yB, zf), new THREE.Vector3(xH, yB, zf),
               new THREE.Vector3(xH, yT, zf), new THREE.Vector3(-xH, yT, zf) ];
    const tv = []; const tri=(a,b,cc)=>tv.push(a.x,a.y,a.z,b.x,b.y,b.z,cc.x,cc.y,cc.z);
    for (let i=0;i<4;i++) tri(A, c[i], c[(i+1)%4]);
    trackVol.geometry.dispose();
    trackVol.geometry = new THREE.BufferGeometry();
    trackVol.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tv, 3));
    const ev=[]; for (const k of c) ev.push(A.x,A.y,A.z,k.x,k.y,k.z);
    for (let i=0;i<4;i++) ev.push(c[i].x,c[i].y,c[i].z,c[(i+1)%4].x,c[(i+1)%4].y,c[(i+1)%4].z);
    trackEdge.geometry.dispose();
    trackEdge.geometry = new THREE.BufferGeometry();
    trackEdge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(ev, 3));
  }

  // ── 1인칭 / 시야 콘 토글 ──
  let fpMode = false, coneOn = false;
  let lastBodyZ = 0;
  const fpBtn = document.getElementById('btn-fp');
  const coneBtn = document.getElementById('btn-cone');
  const setBtnActive = (btn, on) => {
    btn.style.background = on ? 'var(--accent)' : 'var(--panel2)';
    btn.style.color = on ? '#06202e' : 'var(--text)';
    btn.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
  };
  function setFp(on) {
    fpMode = on;
    setBtnActive(fpBtn, fpMode);
    controls.enabled = !fpMode;
    // 진짜 눈 시점: 자기 몸은 시야를 가리지 않음 + 인간 유효 시야각
    xbot.model.visible = !fpMode;
    camera.fov = fpMode ? 85 : 50;
    camera.updateProjectionMatrix();
    const vb = document.getElementById('btn-view');
    if (vb) vb.textContent = fpMode ? '3인칭 보기' : '1인칭 보기';
    if (!fpMode) {
      const data = state.packs[state.pack];
      setPackEnvironment(state.pack, data.hasWall);
      const bz = xbot.group.position.z;
      camera.position.z += bz;
      controls.target.z += bz;
      lastBodyZ = bz;
    }
  }
  fpBtn.addEventListener('click', () => setFp(!fpMode));
  coneBtn.addEventListener('click', () => {
    coneOn = !coneOn;
    setBtnActive(coneBtn, coneOn);
  });

  // 1인칭 VOR 안정화 상태 (인간 눈: 머리 요동을 시선이 상쇄)
  const fpPos = new THREE.Vector3();
  let fpInit = false;

  // 시야∩투사면 교집합 하이라이트 + 시선 낙하 범위
  const gazeRange = { near: 0, far: 0 };
  const gazeMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0x69f0ae, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  gazeMesh.renderOrder = 4;
  gazeMesh.frustumCulled = false;
  gazeMesh.visible = false;
  scene.add(gazeMesh);

  tokens.gazeTest = (x, z) => {
    const d = rig.forwardDist(x, z);
    return d >= gazeRange.near && d <= gazeRange.far;
  };

  // 투사면·시선 슬라이더
  const bindSlider = (id, vid, fmt, fn) => {
    const el = document.getElementById(id), val = document.getElementById(vid);
    const apply = () => { val.textContent = fmt(el.value); fn(Number(el.value)); };
    el.addEventListener('input', apply);
    apply();
  };
  bindSlider('s-tolt', 'v-tolt', v => `±${v}ms`, v => { judge.tolT = v / 1000; });
  bindSlider('s-tolp', 'v-tolp', v => `${v}cm`, v => { judge.tolP = v / 100; });
  bindSlider('s-skill', 'v-skill', v => `${v}%`, v => { judge.skill = v / 100; sessionSkillSink?.setSkill(v / 100); });
  bindSlider('s-pitch', 'v-pitch', v => `${v}°`, v => { gazePitch = THREE.MathUtils.degToRad(v); });
  bindSlider('s-fpnear', 'v-fpnear', v => `${v}cm`, v => rig.setFootprint(v / 100, rig.fpFar));
  bindSlider('s-fpfar', 'v-fpfar', v => `${v}cm`, v => rig.setFootprint(rig.fpNear, v / 100));
  bindSlider('s-wallw', 'v-wallw', v => `${v}cm`, v => { rig.setWallSize(v / 100, rig.wallH); if (state.pack === 'boxing') computeStation(); });
  bindSlider('s-wallh', 'v-wallh', v => `${v}cm`, v => { rig.setWallSize(rig.wallW, v / 100); if (state.pack === 'boxing') computeStation(); });

  // ── 세션 흐름 프로토 (러닝) — 와이어프레임 v2 A→B→C ──
  const sessionStageEl = document.getElementById('session-stage');
  const captionEl = document.getElementById('voice-caption');
  const veilEl = document.getElementById('stage-veil');
  const wearFxEl = document.getElementById('wear-fx');
  let captionTimer = null;

  // ── 음성: 사전 생성 뉴럴 보이스(mp3) 우선, 없으면 브라우저 TTS 폴백 ──
  let ttsOn = true;
  const voiceAudio = new Audio();
  function speak(who, text, stageId) {
    if (!ttsOn) return;
    voiceAudio.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (stageId) {
      voiceAudio.src = `${BASE}voice/${stageId}.mp3`;
      voiceAudio.play().catch(() => speakFallback(who, text));
      return;
    }
    speakFallback(who, text);
  }
  function speakFallback(who, text) {
    if (!('speechSynthesis' in window)) return;
    const clean = text.replace(/\(.*?\)/g, '').replace(/[—·"']/g, ' ');
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ko-KR';
    const ko = speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
    if (ko) u.voice = ko;
    u.rate = 1.0;
    setTimeout(() => speechSynthesis.speak(u), 60);   // cancel 직후 드롭 회피
  }
  // ── 전환 베일: 단계 전환 시 부드러운 암전 ──
  function veil() {
    if (!veilEl) return;
    veilEl.style.opacity = '0.5';
    setTimeout(() => { veilEl.style.opacity = '0'; }, 130);
  }
  // ── 웨어러블 개입 글로우: 모드 색으로 화면 가장자리 펄스 ──
  let wearTimer = null;
  function wearPulse(color, ms = 1300) {
    if (!wearFxEl) return;
    wearFxEl.style.boxShadow = `inset 0 0 150px 24px ${color}`;
    wearFxEl.style.opacity = '0.55';
    clearTimeout(wearTimer);
    wearTimer = setTimeout(() => { wearFxEl.style.opacity = '0'; }, ms);
  }
  function showCaption(who, text) {
    if (!captionEl) return;
    captionEl.innerHTML = `<b>🔊 ${who}</b> · ${text}`;
    captionEl.style.opacity = '1';
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { captionEl.style.opacity = '0'; }, 4500);
  }
  const sessionHud = document.getElementById('session-hud');
  const hudStageEl = document.getElementById('hud-stage');
  const hudIdxEl = document.getElementById('hud-idx');
  const session = new Session(scene, tokens, xbot, rig, st => {
    const sig = [];
    if (st.hap) sig.push(`<span style="color:var(--warn)">햅틱</span> ${st.hap}`);
    if (st.wear) sig.push(`<span style="color:var(--ok)">웨어러블</span> ${st.wear}`);
    if (st.cue) sig.push(`<span style="color:#fa3030">보상</span> ${st.cue}`);
    if (st.foot) sig.push(`<span style="color:var(--accent)">발</span> ${st.foot}`);
    const html = `<b style="color:var(--text)">${st.label}</b>` +
      (sig.length ? `<br><span style="font-size:11px">${sig.join(' · ')}</span>` : '');
    if (sessionStageEl) sessionStageEl.innerHTML = html;
    if (hudStageEl) hudStageEl.innerHTML = html;
    if (hudIdxEl) hudIdxEl.textContent = `${session.stageIdx + 1} / ${session.total}`;
    veil();  // 단계 전환 암전 (끊김 → 의도된 전환으로)
    if (st.voice) { showCaption(st.voice[0], st.voice[1]); speak(st.voice[0], st.voice[1], st.id); }
    if (st.wear) {
      const w = st.wear;
      const c = w.includes('BOOST') ? '#d1feff' : w.includes('LOAD') ? '#fec389'
              : w.includes('SAFE') ? '#8fd8de' : '#9b9b9b';
      wearPulse(c);
    } else if (wearFxEl) wearFxEl.style.opacity = '0';
    // 데모 투어: READY 진입 시 자동 시작(탭), FIN 도달 시 다음 종목으로
    if (demoTour) {
      if (/READY$/.test(st.id)) setTimeout(() => { if (demoTour && session.active) session.tapAdvance(); }, 1400);
      if (/FIN$/.test(st.id)) setTimeout(() => demoAdvance(), 4500);
    }
  });
  // 게이트/다운시프트 안내 자막 + 웨어러블 신호
  sessionSkillSink = session;
  session.setSkill(parseInt(document.getElementById('s-skill')?.value ?? '70', 10) / 100);
  session.onGate = (type) => {
    if (type === 'fail') { showCaption('시스템', '아직 폼이 덜 익었어요 — 익히기 한 번 더.'); wearPulse('#fec389', 1600); }
    else if (type === 'downshift') { showCaption('시스템', '폼이 흔들려요 — 익히기로 되돌립니다.'); wearPulse('#fec389', 1600); }
  };
  const sessionBtn = document.getElementById('btn-session');
  const demoBtn = document.getElementById('btn-demo');
  let demoTour = null;   // { queue:[sports], i }
  // ── 장면 스코프 — ✎ 디자인 안의 [장면] 탭. 별도 에디터가 아니다. ──
  const sceneScope = new SceneScope(session, designStore, { onDirty: saveScenes });
  session.applySceneStore(designStore.sceneStore());   // 저장된 장면 편집 부팅 복원

  function startSessionFor(sport) {
    // 스튜디오가 좌측 패널을 숨긴 채 남았을 수 있음 — 세션 시작 시 항상 복원(스틱 방지)
    if (typeof exitStudio === 'function' && studioActive) exitStudio();
    const panelEl = document.getElementById('panel');
    if (panelEl) panelEl.style.display = 'flex';
    if (state.pack !== sport) switchPack(sport);
    state.time = 0; tokens.resetLoop();
    session.start(sport);
    sessionBtn.textContent = '세션 중지';
    if (sessionHud) sessionHud.style.display = 'block';
    setFp(true);
  }
  function stopSession() {
    if (!session.active) return;
    session.stop();
    voiceAudio.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    sessionBtn.textContent = '세션 시작 (1인칭 전환)';
    if (sessionStageEl) sessionStageEl.textContent = '—';
    if (sessionHud) sessionHud.style.display = 'none';
    setFp(false);           // 중단 → X봇 3인칭 복귀
  }
  // ── 데모 투어: 러닝→복싱→농구 자동 순회 (영상 녹화용) ──
  function demoAdvance() {
    if (!demoTour) return;
    demoTour.i++;
    if (demoTour.i >= demoTour.queue.length) { demoTour = null; demoBtn.textContent = '🎬 데모 투어 (3종목 자동 순회)'; stopSession(); return; }
    session.stop();
    startSessionFor(demoTour.queue[demoTour.i]);
  }
  demoBtn?.addEventListener('click', () => {
    if (demoTour) { demoTour = null; demoBtn.textContent = '🎬 데모 투어 (3종목 자동 순회)'; stopSession(); return; }
    demoTour = { queue: ['running', 'boxing', 'basketball'], i: 0 };
    demoBtn.textContent = '⏹ 데모 투어 중지';
    if (session.active) session.stop();
    startSessionFor(demoTour.queue[0]);
  });
  sessionBtn?.addEventListener('click', () => {
    if (session.active) { demoTour = null; demoBtn.textContent = '🎬 데모 투어 (3종목 자동 순회)'; stopSession(); return; }
    // 러닝·농구·복싱 세션 지원
    const sport = ['running', 'basketball', 'boxing'].includes(state.pack) ? state.pack : 'running';
    startSessionFor(sport);
  });
  document.getElementById('btn-tap')?.addEventListener('click', () => session.tapAdvance());
  document.getElementById('btn-stage-prev')?.addEventListener('click', () => session.prev());
  document.getElementById('btn-stage-next')?.addEventListener('click', () => session.next());
  document.getElementById('btn-session-stop')?.addEventListener('click', () => stopSession());
  document.getElementById('btn-view')?.addEventListener('click', () => setFp(!fpMode));
  // ── 토큰 에디터 드로어: 팔레트·세션 타이밍 라이브 편집 + JSON 내보내기 ──
  const editorEl = document.getElementById('editor');
  document.getElementById('btn-editor')?.addEventListener('click', () => { editorEl.style.display = 'block'; });
  document.getElementById('editor-close')?.addEventListener('click', () => { editorEl.style.display = 'none'; });
  document.getElementById('ed-open-doc')?.addEventListener('click', e => { e.preventDefault(); window.open(`${BASE}docs/newton-wireframe.html`, '_blank'); });

  const COLOR_ROLES = [
    ['left', '스텝 마크 (좌)'], ['right', '스텝 마크 (우)'], ['target', '벽면 타겟'],
    ['guide', '방향 화살표'], ['lane', '레인'], ['success', '성공 (프리즘)'],
  ];
  const colWrap = document.getElementById('ed-colors');
  for (const [k, label] of COLOR_ROLES) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;font-size:12px;';
    row.innerHTML = `<span>${label}</span><input type="color" data-role="${k}" value="#${COLORS[k].toString(16).padStart(6, '0')}" style="width:52px;height:26px;border:1px solid var(--line);border-radius:5px;background:var(--panel2);cursor:pointer;">`;
    colWrap.appendChild(row);
    row.querySelector('input').addEventListener('input', e => {
      COLORS[e.target.dataset.role] = parseInt(e.target.value.slice(1), 16);
      tokens.recolor();
    });
  }

  const TIMINGS = [
    ['a1Rep', 'A1 발목 1회전', 0.4, 2.5], ['a2Hold', 'A2 홀드 길이', 3, 15],
    ['a3Swing', 'A3 스윙 왕복', 0.6, 3], ['a4Beat', 'A4 걷기 박자', 0.3, 1.2],
    ['b1Beat', 'B1 듣기 박자', 0.3, 1.2], ['b2Beat', 'B2 스텝 박자', 0.3, 1.4],
    ['b3Step', 'B3 걸음 간격', 0.5, 2], ['b4Beat', 'B4 리듬 박자', 0.3, 1.2],
  ];
  const timWrap = document.getElementById('ed-timings');
  for (const [k, label, mn, mx] of TIMINGS) {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:9px;font-size:12px;';
    row.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>${label}</span><span style="color:var(--accent);font-variant-numeric:tabular-nums;" id="edv-${k}">${SCFG[k]}s</span></div>
      <input type="range" min="${mn * 100}" max="${mx * 100}" value="${SCFG[k] * 100}" style="width:100%;">`;
    timWrap.appendChild(row);
    row.querySelector('input').addEventListener('input', e => {
      SCFG[k] = parseInt(e.target.value, 10) / 100;
      document.getElementById(`edv-${k}`).textContent = SCFG[k].toFixed(2) + 's';
    });
  }

  // ── 토큰 지오메트리·상태 슬라이더 (TCFG 라이브 반영) ──
  const GEOM = [
    ['markScale', '마크 크기', 0.5, 2, 'x'], ['fillOpacity', '채움 투명도', 0.05, 0.6, ''],
    ['previewEdge', '프리뷰 윤곽', 0.1, 1, ''], ['cdContractFrom', '수축 시작 배율', 1.2, 3, 'x'],
    ['cdGain', '수축 링 강도', 0.2, 1, ''], ['lingerEdge', '성공 잔상', 0.3, 1.5, ''],
    ['linger', '잔상 지속', 0.15, 1, 's'],
  ];
  const geomWrap = document.getElementById('ed-geom');
  for (const [k, label, mn, mx, unit] of GEOM) {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:9px;font-size:12px;';
    row.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>${label}</span><span style="color:var(--accent);font-variant-numeric:tabular-nums;" id="edg-${k}">${TCFG[k]}${unit}</span></div>
      <input type="range" min="${mn * 100}" max="${mx * 100}" value="${TCFG[k] * 100}" style="width:100%;">`;
    geomWrap.appendChild(row);
    row.querySelector('input').addEventListener('input', e => {
      TCFG[k] = parseInt(e.target.value, 10) / 100;
      document.getElementById(`edg-${k}`).textContent = TCFG[k].toFixed(2) + unit;
    });
  }

  // ── 스테이지 타임라인 편집기 (현재 팩의 종목) ──
  const stagesWrap = document.getElementById('ed-stages');
  const stageSportEl = document.getElementById('ed-stage-sport');
  function renderStageEditor() {
    const sport = ['running', 'basketball', 'boxing'].includes(state.pack) ? state.pack : 'running';
    const stages = session.stagesFor(sport);
    stageSportEl.textContent = `· ${{ running: '러닝', basketball: '농구', boxing: '복싱' }[sport]}`;
    stagesWrap.innerHTML = '';
    stages.forEach((st, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:5px 0;border-bottom:1px solid var(--line);font-size:11px;';
      const dur = st.dur != null ? st.dur : '';
      row.innerHTML =
        `<div style="display:flex;gap:6px;align-items:center;margin-bottom:3px;">
          <span style="color:var(--dim);width:14px;">${i + 1}</span>
          <span style="flex:1;color:var(--text);">${st.label.split('—').pop().trim().slice(0, 22)}</span>
          <input type="number" step="0.5" placeholder="auto" value="${dur}" title="지속(초)" style="width:48px;padding:3px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:4px;font-size:11px;">
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          <input type="text" value="${(st.voice?.[1] || '').replace(/"/g, '&quot;')}" title="멘트" style="flex:1;padding:3px;background:var(--panel2);color:var(--dim);border:1px solid var(--line);border-radius:4px;font-size:10px;">
          <span id="edm-${i}" style="color:#ffc94d;font-size:9px;visibility:hidden;">🔊재생성</span>
        </div>`;
      const [durEl, txtEl] = row.querySelectorAll('input');
      durEl.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v > 0) st.dur = v; else if (e.target.value === '') delete st.dur;
      });
      txtEl.addEventListener('input', e => {
        if (st.voice) { st.voice[1] = e.target.value; document.getElementById(`edm-${i}`).style.visibility = 'visible'; }
      });
      stagesWrap.appendChild(row);
    });
  }
  refreshEditorStages = renderStageEditor;
  renderStageEditor();

  // ── 프리셋 저장/불러오기 (JSON 파일) ──
  function collectPreset() {
    return {
      _newton: 'token-preset', version: 2,
      palette: Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')])),
      sessionTiming: { ...SCFG },
      geometry: { ...TCFG },
      token: {
        leadMs: parseInt(document.getElementById('s-lead').value, 10),
        sizeScale: parseInt(document.getElementById('s-size').value, 10) / 100,
        maxVisible: parseInt(document.getElementById('s-count').value, 10),
      },
      judge: {
        tolTimeMs: parseInt(document.getElementById('s-tolt').value, 10),
        tolPosCm: parseInt(document.getElementById('s-tolp').value, 10),
      },
    };
  }
  function applyPreset(p) {
    if (p.palette) for (const [k, v] of Object.entries(p.palette)) if (k in COLORS) COLORS[k] = parseInt(v.slice(1), 16);
    if (p.sessionTiming) Object.assign(SCFG, p.sessionTiming);
    if (p.geometry) Object.assign(TCFG, p.geometry);
    tokens.recolor();
    // 슬라이더 UI 동기화
    for (const [k] of GEOM) { const el = document.getElementById(`edg-${k}`); if (el) el.textContent = TCFG[k].toFixed(2); }
    document.querySelectorAll('#ed-geom input').forEach((el, i) => { el.value = TCFG[GEOM[i][0]] * 100; });
    document.querySelectorAll('#ed-timings input').forEach((el, i) => { el.value = SCFG[TIMINGS[i][0]] * 100; });
    document.querySelectorAll('#ed-colors input').forEach(el => { el.value = '#' + COLORS[el.dataset.role].toString(16).padStart(6, '0'); });
  }
  document.getElementById('ed-save')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(collectPreset(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `newton-preset-${Date.now()}.json`; a.click();
  });
  document.getElementById('ed-load')?.addEventListener('click', () => document.getElementById('ed-file').click());
  document.getElementById('ed-file')?.addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    try { applyPreset(JSON.parse(await f.text())); } catch (err) { console.warn('[preset]', err); }
    e.target.value = '';
  });

  document.getElementById('ed-export')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(collectPreset(), null, 2));
    const msg = document.getElementById('ed-export-msg');
    msg.style.visibility = 'visible'; setTimeout(() => { msg.style.visibility = 'hidden'; }, 2000);
  });

  // ── 제작자 모드: 이미지 드롭 → 토큰 아트 즉시 교체 (다빈 에셋 검수 리그) ──
  const dropTarget = document.getElementById('drop-target');
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', async e => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f || !/(image|svg)/.test(f.type)) return;
    const tex = await new THREE.TextureLoader().loadAsync(URL.createObjectURL(f));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (dropTarget?.value === 'foot') session.setFootArt(tex);
    else tokens.setMarkerArt(tex);
  });
  document.getElementById('drop-reset')?.addEventListener('click', () => {
    tokens.setMarkerArt(null); session.setFootArt(null);
  });

  // ── NEWTON Studio — 2D 저작 캔버스 (러닝 지면 수직 슬라이스) ──
  let studioActive = false;
  let studioDoc = null, studioCanvas = null, studioProps = null, studioPlayingWas = true;
  let studioRebuildTimer = null;
  const studioEl = document.getElementById('studio');
  const studioCanvasEl = document.getElementById('studio-canvas');

  // 편집 팩을 러닝 파이프라인에 재적용 (시간 연속성 유지 — switchPack 대비 경량)
  let studioSport = 'running';
  function rebuildPack(sport, pack) {
    state.packs[sport] = pack;
    tokens.setPack(pack);
    xbot.setPack(pack, tokens.events);
    rig.setPack(sport, tokens.events);
    tokens.footprintTest = (x, z, inset) => rig.contains(x, z, inset);
    effects.clip = (x, z) => rig.contains(x, z);
    judge.setPack(tokens.events, sport);
    tokens.resetLoop();
    panel.setPack(pack, tokens.events);
    lastBodyZ = xbot.group.position.z;
    saveStudio(sport, pack);   // 편집 자동 저장 (새로고침해도 유지)
  }
  function scheduleStudioRebuild() {
    clearTimeout(studioRebuildTimer);
    studioRebuildTimer = setTimeout(() => { if (studioDoc) rebuildPack(studioSport, studioDoc.toPack()); }, 110);
  }

  function studioTopView() {
    if (studioSport === 'boxing') {
      // 벽면 정면 뷰
      camera.position.set(0.9, 1.5, 2.2);
      controls.target.set(0, 1.1, -2.6);
    } else {
      // 3/4 버드아이 — 좌측 스튜디오 패널을 피해 트랙이 우측 3D에 또렷이 들어오게.
      camera.position.set(-4.4, 3.4, 3.6);
      controls.target.set(0.8, 0, -2.6);
    }
    controls.update();
  }

  // ── 스코프: [토큰] = 팩 MARK / [장면] = 스테이지 GUI 요소 ──
  // 진입점·캔버스·속성 패널은 하나. 스코프가 '무엇을 편집 중인가'만 바꾼다.
  let studioScope = 'pack';
  const propsHost = () => document.getElementById('studio-props');
  const seg = (b, on) => {
    b.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
    b.style.background = on ? 'rgba(250,48,48,.16)' : 'var(--panel2)';
    b.style.color = on ? 'var(--accent)' : 'var(--text)';
  };
  function renderScopeProps() { if (studioScope === 'scene') sceneScope.renderProps(propsHost(), renderScopeProps); }
  function fillStageSelect() {
    const sel = document.getElementById('studio-stage');
    sel.innerHTML = sceneScope.stages().map(s => `<option value="${s.id}">${s.id}${s.title ? ' · ' + s.title : ''}</option>`).join('');
    if (sceneScope.stageId) sel.value = sceneScope.stageId;
  }
  function setScope(scope) {
    if (!studioActive) return;
    studioScope = scope;
    const scene = scope === 'scene';
    document.getElementById('studio-palette').style.display = scene ? 'none' : 'flex';
    document.getElementById('studio-scene-palette').style.display = scene ? 'flex' : 'none';
    document.getElementById('studio-stage').style.display = scene ? 'block' : 'none';
    const tip = document.getElementById('studio-tip');
    if (tip && scene) tip.style.display = 'none';
    document.querySelectorAll('.stsc').forEach(b => seg(b, b.dataset.scope === scope));

    // 두 패널이 같은 호스트를 공유한다 — doc.onChange가 장면 패널을 덮어쓰지 않도록
    // 토큰 패널은 장면 스코프에서 아예 파괴한다.
    if (scene) {
      studioProps?.destroy(); studioProps = null;
      sceneScope.setSport(studioSport);
      fillStageSelect();
    } else {
      sceneScope.leave();
      if (!studioProps) {
        studioProps = new StudioProps(propsHost(), studioDoc, {
          onEdit: scheduleStudioRebuild,
          onPreviewBurst: (mark) => { rebuildPack(studioSport, studioDoc.toPack()); tokens.studioBurst(mark); },
        });
      }
    }
    studioCanvas?.setExtrasOnly(scene);
    if (scene) renderScopeProps();
  }
  function switchStudioSport(sp) {
    if (sp === studioSport || !studioActive) return;
    const keep = studioScope;
    exitStudio();
    switchPack(sp);
    enterStudio();
    document.querySelectorAll('.stsp').forEach(b => seg(b, b.dataset.sport === sp));
    if (keep === 'scene') setScope('scene');
  }
  document.querySelectorAll('.stsc').forEach(b => b.addEventListener('click', () => setScope(b.dataset.scope)));
  document.querySelectorAll('.stsp').forEach(b => b.addEventListener('click', () => switchStudioSport(b.dataset.sport)));
  document.getElementById('studio-stage')?.addEventListener('change', e => {
    sceneScope.setStage(e.target.value);
    studioCanvas?.draw();
    renderScopeProps();
  });
  document.getElementById('studio-settings')?.addEventListener('click', () => {
    document.getElementById('editor').style.display = 'block';
  });
  document.querySelectorAll('.stadd').forEach(b => b.addEventListener('click', () => {
    if (studioScope !== 'scene' || !sceneScope.stageId) return;
    const spec = { kind: b.dataset.k, props: {} };
    if (!session.createElement(sceneScope.stageId, spec)) return;   // 벽면에 화살표/발 등 불가 조합
    designStore.stageStore(sceneScope.stageId).added.push(spec);
    saveScenes();
    studioCanvas?.draw();
  }));

  function enterStudio() {
    if (studioActive) return;
    studioSport = ['running', 'boxing', 'basketball'].includes(state.pack) ? state.pack : 'running';
    if (state.pack !== studioSport) switchPack(studioSport);
    studioActive = true;
    studioPlayingWas = state.playing;
    state.playing = false; panel.setPlaying(false);
    tokens.layoutPreview = true;               // 지면 토큰 상시 표시(시간·풋프린트 무관)
    tokens.setParams({ maxVisible: 99 });
    const stLabel = document.querySelector('#studio b span');
    if (stLabel) stLabel.textContent = '· ' + ({ running: '러닝 지면', boxing: '복싱 벽면', basketball: '농구 코트' })[studioSport];
    studioDoc = new StudioDoc(state.packs[studioSport]);
    studioCanvas = new StudioCanvas(studioCanvasEl, studioDoc, {
      onEdit: scheduleStudioRebuild,
      onTool: t => setStudioToolUI(t),         // 배치 후 자동 선택복귀 시 팔레트 동기화
      getWindow: () => null,                   // 러닝 창은 러너와 함께 이동 — 고정 밴드 미표시(정직)
      // 장면 스코프: 같은 캔버스에 스테이지 요소를 올려 직접 클릭·드래그
      extras: () => sceneScope.items(),
      onPickExtra: (key) => { sceneScope.pick(key); renderScopeProps(); studioCanvas.draw(); },
      onDragExtra: (key, h, v) => sceneScope.dragTo(key, h, v),
    });
    studioProps = new StudioProps(document.getElementById('studio-props'), studioDoc, {
      onEdit: scheduleStudioRebuild,
      onPreviewBurst: (mark) => { rebuildPack(studioSport, studioDoc.toPack()); tokens.studioBurst(mark); },
    });
    // 안내 팁: 토큰을 처음 고르면 사라짐
    const tipEl = document.getElementById('studio-tip');
    if (tipEl) { tipEl.style.display = 'block'; studioDoc.onChange(d => { tipEl.style.display = d.selection ? 'none' : 'block'; }); }
    rebuildPack(studioSport, studioDoc.toPack());        // layoutPreview 반영 리빌드(클리핑 해제)
    studioScope = 'pack';
    document.querySelectorAll('.stsc').forEach(b => seg(b, b.dataset.scope === 'pack'));
    document.querySelectorAll('.stsp').forEach(b => seg(b, b.dataset.sport === studioSport));
    document.getElementById('studio-palette').style.display = 'flex';
    document.getElementById('studio-scene-palette').style.display = 'none';
    document.getElementById('studio-stage').style.display = 'none';
    studioCanvas.setExtrasOnly(false);
    studioEl.style.display = 'flex';
    // 저작 포커스 모드: 좌측 컨트롤 패널 숨김 → 3D 프리뷰에 공간 확보 (캔버스 | 3D 스플릿)
    document.getElementById('panel').style.display = 'none';
    resize();
    studioCanvas.refresh();   // 드로어가 보인 뒤 실제 크기 반영 (RO 타이밍 비의존)
    studioTopView();
  }
  function exitStudio() {
    if (!studioActive) return;
    studioActive = false;
    if (studioScope === 'scene') sceneScope.leave();   // 스테이지 프리뷰 해제
    studioScope = 'pack';
    studioCanvas?.destroy(); studioCanvas = null;
    studioProps?.destroy(); studioProps = null; studioDoc = null;
    tokens.layoutPreview = false;
    tokens.setParams({ maxVisible: Number(document.getElementById('s-count').value) || 3 });
    studioEl.style.display = 'none';
    document.getElementById('panel').style.display = 'flex';
    resize();
    switchPack(studioSport);                   // 클리핑·카메라·시간 정상 복원
    state.playing = studioPlayingWas; panel.setPlaying(studioPlayingWas);
  }
  document.getElementById('btn-studio')?.addEventListener('click', () => studioActive ? exitStudio() : enterStudio());
  document.getElementById('studio-close')?.addEventListener('click', exitStudio);
  document.getElementById('studio-top')?.addEventListener('click', studioTopView);

  // 팔레트 도구 선택 (선택 / 마크 배치)
  function setStudioToolUI(tool) {
    document.querySelectorAll('#studio-palette .stpal').forEach(b => {
      const on = b.dataset.tool === tool;
      b.classList.toggle('active', on);
      b.style.background = on ? 'rgba(250,48,48,.16)' : 'var(--panel2)';
      b.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
      b.style.color = on ? 'var(--accent)' : (b.dataset.tool === 'select' ? 'var(--accent)' : 'var(--text)');
    });
  }
  document.querySelectorAll('#studio-palette .stpal').forEach(btn => {
    btn.addEventListener('click', () => { setStudioToolUI(btn.dataset.tool); studioCanvas?.setTool(btn.dataset.tool); });
  });
  // 레인 토글
  const laneBtn = document.getElementById('studio-lane');
  laneBtn?.addEventListener('click', () => {
    if (!studioDoc) return;
    studioDoc.setLane(!studioDoc.laneOn);
    const on = studioDoc.laneOn;
    laneBtn.style.color = on ? 'var(--accent)' : 'var(--dim)';
    laneBtn.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
    scheduleStudioRebuild();
  });
  // 되돌리기 / 다시하기
  function studioUndo() {
    if (studioScope === 'scene') { if (sceneScope.undo()) { studioCanvas?.draw(); renderScopeProps(); } return; }
    if (studioDoc?.undo()) scheduleStudioRebuild();
  }
  function studioRedo() {
    if (studioScope === 'scene') { if (sceneScope.redo()) { studioCanvas?.draw(); renderScopeProps(); } return; }
    if (studioDoc?.redo()) scheduleStudioRebuild();
  }
  document.getElementById('studio-undo')?.addEventListener('click', studioUndo);
  document.getElementById('studio-redo')?.addEventListener('click', studioRedo);
  window.addEventListener('keydown', (e) => {
    if (!studioActive) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      // 코드 textarea 안에서는 브라우저 기본 실행취소를 존중
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.shiftKey ? studioRedo() : studioUndo();
    } else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); studioRedo(); }
  });
  // 원본 팩 복원 (되돌리기 가능)
  document.getElementById('studio-reset')?.addEventListener('click', () => {
    if (!studioDoc) return;
    studioDoc._snap();
    studioDoc.load(structuredClone(ORIGINAL_PACKS[studioSport] || ORIGINAL_PACKS.running), true);
    scheduleStudioRebuild();
  });
  // 편집 결과 팩 JSON 복사
  document.getElementById('studio-export')?.addEventListener('click', async () => {
    if (!studioDoc) return;
    await navigator.clipboard.writeText(JSON.stringify(studioDoc.toPack(), (k, v) => k === '_img' ? undefined : v, 2));
    const b = document.getElementById('studio-export');
    const prev = b.textContent; b.textContent = '✓ 복사됨';
    setTimeout(() => { b.textContent = prev; }, 1500);
  });

  // ── 모션 검증: 실측 킥 모캡으로 무릎 투사 스트레스 테스트 ──
  document.getElementById('verify-kick')?.addEventListener('click', () => {
    stopSession();
    if (state.pack !== 'running') { document.querySelector('[data-pack=running]')?.click(); }
    xbot.setVerify('bkKick');
  });
  document.getElementById('verify-warmup')?.addEventListener('click', () => {
    stopSession();
    if (state.pack !== 'running') { document.querySelector('[data-pack=running]')?.click(); }
    xbot.setVerify('warmup');
  });
  document.getElementById('verify-off')?.addEventListener('click', () => { xbot.setVerify(null); boxShadow.on = false; });
  document.getElementById('verify-boxshadow')?.addEventListener('click', () => {
    xbot.setVerify(null);
    stopSession();
    if (state.pack !== 'boxing') switchPack('boxing');
    boxShadow.on = true; boxShadow.total = 0; boxShadow.occ = 0; boxShadow.peakCov = 0;
    state.playing = true; panel.setPlaying(true);
  });

  const ttsBtn = document.getElementById('btn-tts');
  ttsBtn?.addEventListener('click', () => {
    ttsOn = !ttsOn;
    ttsBtn.textContent = ttsOn ? '🔊' : '🔇';
    if (!ttsOn) { voiceAudio.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  });

  // ── 복싱 고스트 = 벽면 UI 2D 레이어 (열화상 depth-map 실루엣) ──
  // 훅 모션 봇을 오프스크린 정면 직교 카메라로 렌더. 봇 재질 = 깊이→열 LUT 셰이더
  // (가까움=핫핑크 → 멀음=샌드), RT 블러 체인으로 소프트 글로우 + 그레인 합성.
  let ghostMixer = null, ghostRT = null, ghostScene = null, ghostCam = null, ghostLayer = null;
  let ghostFx = null;   // { rtA, rtB, rtFinal, quadScene, quadCam, blurMat, compMat }
  const GHOST_LUT_GLSL = `
    vec3 gLut(float t){
      vec3 sand=vec3(0.996,0.765,0.537), coral=vec3(0.996,0.431,0.235),
           red=vec3(0.980,0.188,0.188), pink=vec3(1.000,0.184,0.557);
      t=clamp(t,0.0,1.0);
      if(t<0.45) return mix(sand,coral,t/0.45);
      else if(t<0.75) return mix(coral,red,(t-0.45)/0.30);
      else return mix(red,pink,(t-0.75)/0.25);
    }`;
  function ensureGhostBot() {
    if (ghostLayer) return;
    ghostScene = new THREE.Scene();
    const bot = SkeletonUtils.clone(xbot.model);
    // 깊이→열화상 재질: 카메라와의 거리로 몸 표면을 색칠 (레퍼런스: depth-map 실루엣)
    const thermalMat = new THREE.ShaderMaterial({
      uniforms: { zNear: { value: 2.15 }, zFar: { value: 3.45 } },
      vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        varying float vVZ;
        void main(){
          #include <skinbase_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vVZ = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vVZ; uniform float zNear, zFar;
        ${GHOST_LUT_GLSL}
        void main(){
          float t = 1.0 - clamp((vVZ - zNear) / (zFar - zNear), 0.0, 1.0);
          gl_FragColor = vec4(gLut(t), 1.0);
        }`,
    });
    bot.traverse(o => { if (o.isMesh) o.material = thermalMat; });
    bot.position.set(0, 0, 0);
    bot.rotation.y = Math.PI; // 카메라(+Z)를 마주봄
    ghostScene.add(bot);
    ghostMixer = new THREE.AnimationMixer(bot);
    const clip = xbot.actions.hook?.action.getClip();
    if (clip) ghostMixer.clipAction(clip).play();

    const RW = 512, RH = 768;
    ghostRT = new THREE.WebGLRenderTarget(RW, RH, { samples: 2 });
    const W = 1.6, H = 2.1;
    ghostCam = new THREE.OrthographicCamera(-W / 2, W / 2, H, 0, 0.1, 10);
    ghostCam.position.set(0, 0, 3);
    ghostCam.lookAt(0, 0, 0);

    // ── 후처리 체인: 하프해상 2패스 가우시안 → 글로우, 본체+글로우+그레인 합성 ──
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const blurMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, texel: { value: new THREE.Vector2(2 / RW, 2 / RH) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir, texel;
        void main(){
          float w[5]; w[0]=0.227027; w[1]=0.194594; w[2]=0.121621; w[3]=0.054054; w[4]=0.016216;
          vec4 c = texture2D(tex, vUv) * w[0];
          for (int i = 1; i < 5; i++) {
            vec2 o = dir * texel * float(i) * 2.4;
            c += texture2D(tex, vUv + o) * w[i];
            c += texture2D(tex, vUv - o) * w[i];
          }
          gl_FragColor = c;
        }`,
      depthTest: false, depthWrite: false,
    });
    const compMat = new THREE.ShaderMaterial({
      uniforms: { sharp: { value: ghostRT.texture }, glow: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D sharp, glow;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec4 s = texture2D(sharp, vUv);
          vec4 g = texture2D(glow, vUv);
          vec3 col = s.rgb * s.a + g.rgb * 0.9 * (1.0 - s.a);   // 본체 위주 + 가장자리 글로우
          float a = clamp(s.a * 0.96 + g.a * 0.62, 0.0, 1.0);
          col += (hash(vUv * vec2(383.1, 517.7)) - 0.5) * 0.07 * a;   // 필름 그레인
          gl_FragColor = vec4(col, a);
        }`,
      depthTest: false, depthWrite: false, transparent: true,
    });
    const quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(quadGeo, blurMat);
    quadScene.add(quad);
    ghostFx = {
      rtA: new THREE.WebGLRenderTarget(RW / 2, RH / 2),
      rtB: new THREE.WebGLRenderTarget(RW / 2, RH / 2),
      rtFinal: new THREE.WebGLRenderTarget(RW, RH),
      quadScene, quad, quadCam, blurMat, compMat,
    };

    ghostLayer = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.85, H * 0.85),
      new THREE.MeshBasicMaterial({
        map: ghostFx.rtFinal.texture, transparent: true, opacity: 0.92,
        depthWrite: false, toneMapped: false,
      })
    );
    ghostLayer.position.set(-0.55, H * 0.85 / 2, WALL_Z + 0.025);
    ghostLayer.renderOrder = 4;
    if (rig.wallClip) ghostLayer.material.clippingPlanes = rig.wallClip;
    scene.add(ghostLayer);
  }
  function renderGhostLayer() {
    if (!ghostLayer || !ghostLayer.visible) return;
    const prevTarget = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    // 1) 본체 (열화상 봇)
    renderer.setRenderTarget(ghostRT);
    renderer.clear();
    renderer.render(ghostScene, ghostCam);
    // 2) 하프해상 가우시안 H → V (글로우)
    const fx = ghostFx;
    fx.quad.material = fx.blurMat;
    fx.blurMat.uniforms.tex.value = ghostRT.texture;
    fx.blurMat.uniforms.dir.value.set(1, 0);
    renderer.setRenderTarget(fx.rtA); renderer.clear(); renderer.render(fx.quadScene, fx.quadCam);
    fx.blurMat.uniforms.tex.value = fx.rtA.texture;
    fx.blurMat.uniforms.dir.value.set(0, 1);
    renderer.setRenderTarget(fx.rtB); renderer.clear(); renderer.render(fx.quadScene, fx.quadCam);
    // 3) 본체+글로우+그레인 합성
    fx.quad.material = fx.compMat;
    fx.compMat.uniforms.glow.value = fx.rtB.texture;
    renderer.setRenderTarget(fx.rtFinal); renderer.clear(); renderer.render(fx.quadScene, fx.quadCam);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevAlpha);
  }

  switchPack('running');
  document.getElementById('loading').style.display = 'none';

  const clock = new THREE.Clock();

  // 비실전 단계 봇 시연 클립 매핑 (가진 클립으로 근사 — 코치가 동작을 보여줌)
  function demoClipFor(sport, id) {
    // 준비운동(A) 단계 = 절차적 드릴 — 봇이 실제 그 동작을 수행 (기존엔 전부 warmup/dribble)
    const DRILL = {
      // 러닝 준비운동 = 절차 드릴 (Mixamo에 매칭 없음)
      A1: 'run_ankle', A2: 'run_calf', A3: 'run_swing', A4: 'run_march',
      // 복싱 = Mixamo 실측 모캡 (목풀기만 절차)
      BX_A1: 'bx_neck', BX_A2: 'boxGuard', BX_A3: 'boxJab',
      BX_B1: 'boxGuard', BX_B2: 'boxGuard', BX_B3: 'boxCombo',
      BX_READY: 'boxGuard', BX_T1: 'boxGuard', BX_T2: 'boxGuard',
      // 농구 = 실측 스탠스 + 기존 사이드스텝·드리블
      BK_A1: 'bkStance', BK_A2: 'sidestep', BK_A3: 'dribble',
    };
    if (DRILL[id] && xbot.actions[DRILL[id]]) return DRILL[id];
    if (sport === 'basketball') return 'dribble';           // 그 외 제자리 드리블
    if (sport === 'boxing') return /B\d/.test(id) ? 'hook' : 'warmup';
    // 러닝: 익히기(B)=제자리 스텝(run), 전환 등=warmup
    if (/^B\d/.test(id)) return 'run';
    return 'warmup';
  }

  // 시뮬 1스텝 (서브스텝 단위 — 백그라운드 탭 스로틀에도 정속·정밀 유지)
  function stepSim(h) {
    const data = state.packs[state.pack];
    if (!data) return;
    // 세션 비실전 단계: 팩 시간 정지, 봇은 단계별 동작을 제자리 시연(코치)
    if (session.active && !session.isLive) {
      session.update(h);
      state.time = 0;
      tokens.update(0, 0);
      xbot.playDemo(demoClipFor(session.sport, session.stage), h);
      rig.update(0, h);
      tokens.setShake(rig.shake.x, rig.shake.y);
      return;
    }
    if (session.active) session.update(h);
    state.time += h;
    if (state.time >= data.duration) {
      state.time %= data.duration;
      tokens.resetLoop();
      rig.resetOmega();   // 되감기 = 포즈 순간이동. ω 미분을 한 샘플 건너뛴다

      renderReport(judge.finishLoop());   // 세션 리포트 (문서 03 루프)
    }
    tokens.update(state.time, h);
    xbot.update(state.time, h);
    rig.update(state.time, h);
    tokens.setShake(rig.shake.x, rig.shake.y);
    if (ghostMixer && ghostLayer?.visible) ghostMixer.update(h);
    judge.update(state.time, xbot.getProbes());
    if (state.pack === 'boxing') {
      ghost.configure(ghost.punches, rig._wallCenter, rig.wallH);
      ghost.update(state.time);
    }
  }

  // 백그라운드 탭: rAF 정지 → 인터벌로 시뮬 지속 (판정·리포트가 멈추지 않게)
  let bgLast = performance.now();
  setInterval(() => {
    const nowMs = performance.now();
    const el = Math.min(2, (nowMs - bgLast) / 1000);
    bgLast = nowMs;
    if (!document.hidden || !state.playing) return;
    const total = el * state.speed * (session.active ? session.liveSpeed : 1);
    const steps = Math.min(120, Math.max(1, Math.ceil(total / 0.02)));
    const h = total / steps;
    for (let i = 0; i < steps; i++) stepSim(h);
  }, 200);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) clock.getDelta();  // 숨김 구간 이중 진행 방지
    bgLast = performance.now();
  });

  if (import.meta.env.DEV) window.__dbg = {
    rig, xbot, state, session, sceneScope,
    get canvas() { return studioCanvas; },
    get scope() { return studioScope; },
  };

  function loop() {
    requestAnimationFrame(loop);
    const rawDt = Math.min(clock.getDelta(), 2.0);

    if (state.playing) {
      // 큰 프레임은 1/50s 서브스텝으로 분할 — rAF 스로틀 시에도 판정 샘플링 정확
      const total = rawDt * state.speed * (session.active ? session.liveSpeed : 1);
      const steps = Math.min(120, Math.max(1, Math.ceil(total / 0.02)));
      const h = total / steps;
      for (let i = 0; i < steps; i++) stepSim(h);
    } else {
      tokens.update(state.time, 0);
      xbot.update(state.time, 0.016);
      rig.update(state.time, 0.016);
      tokens.setShake(rig.shake.x, rig.shake.y);
      if (state.pack === 'boxing') {
        ghost.configure(ghost.punches, rig._wallCenter, rig.wallH);
        ghost.update(state.time);
      }
    }
    stabErr.textContent = `${rig.errorCm.toFixed(1)}cm`;
    // 위상은 rig가 정강이 각속도에서 유도한 값 — 여기서 선언하지 않는다
    if (stabPhase && rig.budget) {
      const swing = rig.phase === 'swing';
      stabPhase.textContent = swing ? '스윙' : '착지';
      stabPhase.style.color = swing ? 'var(--accent)' : 'var(--ok)';
      stabPhase.style.borderColor = swing ? 'var(--accent)' : 'var(--ok)';
      stabOmega.textContent = rig.omegaDps.toFixed(0);
      stabBudget.textContent = rig.budget.totalCm.toFixed(2);
    }
    if (wearFxEl && session.active && session.curStage?.boost && session.isLive) {
      wearFxEl.style.boxShadow = 'inset 0 0 170px 30px #d1feff';
      wearFxEl.style.opacity = String(0.26 + 0.14 * Math.sin(performance.now() / 280));
    }
    effects.update(rawDt);
    panel.drawTimeline(state.time, judge.marks);

    // 도달 범위 = 분석 오버레이 (투사 그래픽 아님) — 시야 콘 토글에서만 표시
    const body = xbot.getBodyPos();
    reach.visible = coneOn && state.pack !== 'boxing';
    reach.position.set(body.x, 0.009, body.z);

    // ── 세션 중 봇 표시: 3인칭에선 항상 코치로 보임(동작 시연), 1인칭에선 자기 몸이라 숨김 ──
    const inSessionPreview = session.active && !session.isLive;
    if (session.active) {
      xbot.model.visible = !fpMode;
    }
    // 카메라는 강제하지 않음 — 3인칭(궤도 자유회전) / 1인칭 모두 사용 가능.
    // 러닝 전진 팔로우는 실제 재생(비세션 or 실전)일 때만.
    if (!inSessionPreview && !studioActive && state.pack === 'running' && !fpMode) {
      const bz = xbot.group.position.z;
      const dz = bz - lastBodyZ;
      camera.position.z += dz;
      controls.target.z += dz;
      lastBodyZ = bz;
    }

    // 1인칭 = X Bot의 눈 + VOR 안정화
    // 인간 눈은 머리 요동을 전정안반사로 상쇄 — 수직은 강하게, 수평은 가볍게 저역필터
    if (fpMode) {
      const eye = xbot.getEyeWorld();
      if (eye) {
        const fwd = xbot.getForward();
        const tx = eye.x + fwd.x * 0.05, ty = eye.y + (session.active ? session.bobY : 0), tz = eye.z + fwd.z * 0.05;
        if (!fpInit || Math.abs(tz - fpPos.z) > 3 || Math.abs(tx - fpPos.x) > 3) {
          fpPos.set(tx, ty, tz);
          fpInit = true;
        }
        const kY = 1 - Math.exp(-rawDt / 0.35);   // 수직 강한 안정화
        const kXZ = 1 - Math.exp(-rawDt / 0.06);  // 전진은 거의 실시간 추종
        fpPos.x += (tx - fpPos.x) * kXZ;
        fpPos.z += (tz - fpPos.z) * kXZ;
        fpPos.y += (ty - fpPos.y) * kY;
        camera.position.copy(fpPos);
        camera.lookAt(
          fpPos.x + fwd.x * Math.cos(gazePitch),
          fpPos.y + Math.sin(gazePitch),
          fpPos.z + fwd.z * Math.cos(gazePitch)
        );
      }
    } else {
      fpInit = false;
    }

    // 시야 콘 (1인칭에서는 숨김 — 시야 그 자체가 화면)
    fovCone.visible = coneOn && !fpMode;
    if (fovCone.visible) updateFovCone();

    // 시선 낙하 범위 (눈높이·pitch·유효시야에서 바닥 가시 구간 계산)
    const isKnee = state.pack !== 'boxing';
    if (isKnee) {
      const eyeNow = xbot.getEyeWorld();
      const eyeH = eyeNow ? eyeNow.y : 1.6;
      const lowAng = -gazePitch + FOV_V / 2;   // 시야 하단 경계 (수평선 아래 각)
      const topAng = -gazePitch - FOV_V / 2;   // 시야 상단 경계
      gazeRange.near = eyeH / Math.tan(lowAng);
      gazeRange.far = topAng > 0.03 ? eyeH / Math.tan(topAng) : 20;

      // 교집합 하이라이트 (분석 오버레이 — 시야 콘 토글 시)
      const s0 = Math.max(rig.fpNear, gazeRange.near);
      const s1 = Math.min(rig.fpFar, gazeRange.far);
      if (coneOn && !fpMode && s1 > s0) {
        const c = rig.segmentCorners(s0, s1);
        if (c) {
          const v = [];
          for (const idx of [0, 1, 2, 0, 2, 3]) v.push(c[idx].x, c[idx].y, c[idx].z);
          gazeMesh.geometry.dispose();
          gazeMesh.geometry = new THREE.BufferGeometry();
          gazeMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
          gazeMesh.visible = true;
        }
      } else gazeMesh.visible = false;
    } else gazeMesh.visible = false;

    // 투사 기하 HUD + 시야 내 출현률
    const geomEl = document.getElementById('geom-info');
    if (geomEl && rig.geom && isKnee) {
      const g = rig.geom;
      const st = tokens.stats;
      const gazeInfo = st.total > 0 ? ` · 시야 내 출현 ${st.inGaze}/${st.total}` : '';
      geomEl.textContent =
        `무릎 h ${(g.kneeH * 100).toFixed(0)}cm · 틸트 ${g.aFar.toFixed(0)}~${g.aNear.toFixed(0)}° · FOV ${g.fovNeed.toFixed(0)}°`
        + ` · 시야 낙하 ${gazeRange.near.toFixed(1)}~${Math.min(gazeRange.far, 9.9).toFixed(1)}m${gazeInfo}`;
    } else if (geomEl && state.pack === 'boxing') {
      geomEl.textContent =
        `프로젝터 유닛(인물 앞): 벽앞 ${opt.dProj.toFixed(2)}m · 렌즈높이 ${(LENS_H*100).toFixed(0)}cm · 상향틸트 ${opt.tilt.toFixed(0)}° · 뒷면 카메라 FOV ${THREE.MathUtils.radToDeg(CAM_V).toFixed(0)}°×${THREE.MathUtils.radToDeg(CAM_H).toFixed(0)}° · 전신 인식 최적 거리 ${opt.dCam.toFixed(2)}m (링에 서기)`;
    } else if (geomEl) geomEl.textContent = '';
    const boxOn = state.pack === 'boxing' && !fpMode;
    trackVol.visible = trackEdge.visible = boxOn;   // 연하게 상시 표시
    optRing.visible = camMark.visible = boxOn;

    // 농구 방향·리듬 큐 — 패드를 채우게: 중앙 큰 화살표 + 깊이 따라 흐르는 비트 3개 + 레인
    const bkOn = state.pack === 'basketball' && rig._fp;
    bkArrow.visible = bkLane.visible = bkOn;
    bkBeats.forEach(b => b.visible = bkOn);
    if (bkOn) {
      const f = rig._fp;
      const cp = tokens.floorClip;
      const P = (d) => [f.ox + f.fx * d, 0.02, f.oz + f.fz * d];   // 정면 방향 d미터 앞
      // 중앙 화살표 (패드 근~중)
      const [ax, , az] = P(0.25);
      bkArrow.position.set(ax, 0.018, az);
      bkArrow.rotation.y = Math.atan2(f.fx, f.fz);
      bkArrow.children[0].material.clippingPlanes = cp;
      // 리듬 비트 3개 — 깊이 0.4/0.85/1.3m, 순차로 밝아짐(박자가 앞으로 흐름)
      const beatT = performance.now() / 1000;
      const depths = [0.4, 0.85, 1.3];
      bkBeats.forEach((b, i) => {
        const [bx, , bz] = P(depths[i]);
        b.position.set(bx, 0.021, bz);
        const ph = (beatT * 1.6 - i * 0.33) % 1;   // 앞으로 흐르는 박자
        const glow = Math.max(0, 1 - Math.abs(ph) * 3);
        b.material.opacity = 0.3 + 0.6 * glow;
        b.scale.setScalar(0.85 + 0.35 * glow);
        b.material.clippingPlanes = cp;
      });
      // 중앙 레인 (깊이 방향 점선)
      const [nx, , nz] = P(0.1), [fx2, , fz2] = P(1.5);
      bkLane.geometry.setFromPoints([new THREE.Vector3(nx, 0.017, nz), new THREE.Vector3(fx2, 0.017, fz2)]);
      bkLane.computeLineDistances();
      bkLane.material.clippingPlanes = cp;
    }

    // 복싱 그림자 검증 — 매 프레임 그림자 갱신 + 판독
    updateBoxShadow();
    if (boxShadow.on && geomEl) {
      const occPct = boxShadow.total > 0 ? (boxShadow.occ / boxShadow.total * 100) : 0;
      const roomDepth = (opt.standZ - WALL_Z + 0.5);   // 유저(권장 서기)~벽 + 후퇴 0.5m
      const gap = boxShadow.minReachGap ?? 99;         // 주먹 최대 도달과 빔의 간격(m)
      const verdict = gap > 0.1 ? 'PASS — 주먹이 빔에 도달 안 함(그림자 없음)'
                    : occPct < 8 ? 'PASS — 가림 미미' : 'FAIL — 타겟 가림';
      geomEl.textContent =
        `복싱 그림자 검증 [${verdict}] · 타겟 가림 ${occPct.toFixed(0)}%`
        + ` · 주먹–빔 간격 ${gap > 90 ? '—' : gap.toFixed(2) + 'm'} (유저가 빔보다 뒤)`
        + ` · 필요 공간 깊이 ${roomDepth.toFixed(1)}m (유저–벽 ${(opt.standZ - WALL_Z).toFixed(1)}m)`;
    }

    // 1인칭에서만 OrbitControls 스킵 — 세션 3인칭에선 자유 회전 허용
    if (!fpMode) controls.update();
    renderGhostLayer();
    renderer.render(scene, camera);
  }
  loop();
}

boot().catch(err => {
  console.error('[Newton] boot failed:', err);
  document.getElementById('loading').innerHTML =
    `<span style="color:#ff5c8a">로드 실패: ${err.message}</span>`;
});
