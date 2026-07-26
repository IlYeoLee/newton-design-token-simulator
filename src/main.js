import * as THREE from 'three';
import { createScene, WALL_Z, FX } from './scene.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TokenSystem, COLORS, TCFG, setFPView, makeMarkFXMaterial, makeLaneFXMaterial, makeFlowArrow } from './tokens.js';
import { Effects } from './effects.js';
import { XBot } from './xbot.js';
import { Panel } from './panel.js';
import { ProjectorRig } from './projector.js';
import { WallGhost } from './ghost.js';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { extractPose, retargetToClip } from './posemocap.js';   // 무료 로컬 비디오 모캡
import { Judge } from './judge.js';
import { Session, SCFG, STAGES } from './session.js';
import { StudioDoc } from './studio/doc.js';
import { StudioCanvas } from './studio/canvas.js';
import { StudioProps } from './studio/props.js';
import { SceneScope } from './studio/scene-scope.js';
import { DesignStore } from './studio/store.js';
import { loadSvg } from './studio/design.js';
import { initBudgetPanel } from './budgetPanel.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getLUT, FXP, rebuildLUT, lutColor, GLYPHS, FX_GLSL } from './fxlut.js';
import { drawRotate } from './fx-core.js';
import { createEditor3D } from './editor3d.js';
import { LiveUI } from './liveui.js';
import { SceneUI } from './sceneui.js';

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
  // 영상 자동 팩 — monocular 포즈 추출 (video_pose_extract.py 산출). botClip 없음(표준 클립).
  running_video: `${BASE}packs/running_video_auto.json`,
  // 복싱 영상 자동 팩 — 실사 섀도복싱(Pexels)에서 펀치 리듬·타겟 추출.
  boxing_video: `${BASE}packs/boxing_video_auto.json`,
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
  const { renderer, scene, camera, controls, setPackEnvironment, resize, renderFrame, setSurfaces, setDaylight, followFloor, wall, wallGroup, hoop, setRenderCamera } = createScene(stage);

  let sessionSkillSink = null;   // 슬라이더가 session 생성 전 초기 apply 시 TDZ 회피
  let refreshEditorStages = null; // switchPack → 에디터 스테이지 편집기 갱신 훅
  // ── 직교 편집 카메라 — 편집은 정면(평면도/정면도)에서: 회전 없음, 팬/줌만 (피그마 모델) ──
  const editCam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
  const editControls = new OrbitControls(editCam, renderer.domElement);
  editControls.enableRotate = false;
  editControls.screenSpacePanning = true;
  editControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  editControls.enabled = false;

  const effects = new Effects(scene);
  const tokens = new TokenSystem(scene, effects);
  const xbot = new XBot(scene);
  const rig = new ProjectorRig(scene, xbot);
  const ghost = new WallGhost(scene);
  // ── 관절 추종 마커 (증명 데모): X봇 실제 주먹 관절에 앵커 — 고정 좌표 아님 ──
  const fistRing = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 32),
    new THREE.MeshBasicMaterial({ color: 0xfa3030, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }));
  fistRing.renderOrder = 20; fistRing.visible = false; scene.add(fistRing);
  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.11, 40),
    new THREE.MeshBasicMaterial({ color: 0xfec389, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide }));
  impactRing.renderOrder = 21; scene.add(impactRing);
  const armLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xfe6e3c, transparent: true, opacity: 0.7, depthTest: false }));
  armLine.renderOrder = 19; armLine.visible = false; scene.add(armLine);
  let _fistPrevZ = 0, _impactT = 0;
  function renderJointMarkers() {
    const on = jointDemo && !fpMode && session.active && state.pack === 'boxing' && xbot.model;   // 3인칭 전용
    fistRing.visible = armLine.visible = !!on;
    if (!on) { impactRing.material.opacity = 0; return; }
    const arm = xbot.getRightArm();
    if (!arm.wrist) return;
    // 주먹 추종 링 — 카메라를 향하게 (빌보드)
    fistRing.position.copy(arm.wrist);
    fistRing.quaternion.copy(camera.quaternion);
    // 어깨→팔꿈치→손목 궤적 라인
    armLine.geometry.setFromPoints([arm.shoulder, arm.elbow, arm.wrist]);
    armLine.geometry.attributes.position.needsUpdate = true;
    // 최대 신전(전방 속도 피크) = 타격 지점 → 임팩트 링 방출
    const vz = arm.wrist.z - _fistPrevZ; _fistPrevZ = arm.wrist.z;
    if (vz < -0.006 && performance.now() / 1000 - _impactT > 0.4) {
      _impactT = performance.now() / 1000;
      impactRing.position.copy(arm.wrist);
    }
    const age = performance.now() / 1000 - _impactT;
    impactRing.quaternion.copy(camera.quaternion);
    impactRing.material.opacity = Math.max(0, 1 - age / 0.5) * 0.9;
    impactRing.scale.setScalar(1 + age * 3);
  }
  let jointDemo = true;   // 관절 추종 마커 데모 토글
  const judge = new Judge();
  // 장면 UI 시스템 — 타이틀·지시문·상태의 고정 슬롯 (풋프린트-상대 + 클리핑)
  const sceneUI = new SceneUI(scene, WALL_Z);
  sceneUI.setClip(rig.floorClip, rig.wallClip);

  // 판정 색상 피드백: 착지점 도트만 (프리즘/샌드/무음 그레이).
  // 판정 버스트는 제거 — 마크 발화 버스트와 이중 발사였고, t=0 이벤트의 판정이
  // 랩 직후 확정되며 매 루프 화면 번쩍임을 만들던 진범.
  judge.onVerdict = (ev, verdict, best, terr) => {
    const col = verdict === 'hit' ? 0xd1feff : verdict === 'near' ? 0xfec389 : 0x9b9b9b;
    const n = ev.surface === 'wall' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    if (best) {
      const dotPos = ev.surface === 'wall'
        ? new THREE.Vector3(best.px, best.p2, WALL_Z + 0.03)
        : new THREE.Vector3(best.px, 0.016, best.p2);
      effects.dot(dotPos, col, n);
    }
    // 실전 다운시프트: 세션 라이브 중 연속 Miss 누적 → 익히기 복귀
    session.reportVerdict(verdict, terr, best);
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
  tokens.rig = rig;   // 레인 글로우 소프트 페이드용 — 풋프린트 경계를 GPU 하드클립 전에 미리 죽인다

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
    onTogglePlay: () => {
      state.playing = !state.playing;
      panel.setPlaying(state.playing, session.active);
      // 일시정지 = 세계 전체 동결 — 화면에 명시해 '버그 정지'로 오인되지 않게
      let chip = document.getElementById('pause-chip');
      if (!chip) {
        chip = document.createElement('div');
        chip.id = 'pause-chip';
        chip.style.cssText = 'position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:30;padding:8px 16px;border:1px solid #fec389;border-radius:20px;background:rgba(16,19,24,.92);color:#fec389;font-size:12.5px;font-weight:700;pointer-events:none;';
        document.body.appendChild(chip);
      }
      chip.textContent = session.active ? '⏸ 세션 일시정지 — ▶ 버튼으로 재개' : '⏸ 일시정지 — ▶ 버튼으로 재개';
      chip.style.display = state.playing ? 'none' : 'block';
    },
    onSeek: t => { state.time = t; state.loop = 0; tokens.loopShiftZ = 0; tokens.resetLoop(); markFiredBefore(t); },
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
  // 기본 스토어(design-default.json — 리포에 굳힌 팩 편집·장면·룩·글리프) 시드:
  //   새 방문자 = 통째 시드 / 기존 방문자 = '없는 항목만' 보강 (글리프·프리미티브·시스템 — 저장값은 절대 안 덮음)
  try {
    const r0 = await fetch(`${BASE}design-default.json`, { cache: 'no-cache' });
    if (r0.ok) {
      const def = await r0.json();
      const raw = localStorage.getItem('newton_design_v1');
      if (!raw) {
        localStorage.setItem('newton_design_v1', JSON.stringify(def));
      } else {
        const cur = JSON.parse(raw);
        const lab = cur?.global?.fx?.lab;
        const dlab = def?.global?.fx?.lab;
        if (lab && dlab) {
          let changed = false;
          // 룩 리비전 — 배포로 기본 룩이 바뀌면(rev↑) 기존 방문자도 로드 시 최신 룩으로 자동 갱신(구버전 고착 방지).
          //   뷰어는 룩 편집 안 하므로 통째 교체 안전. 개발자는 로컬(다른 오리진)에서 자유 편집.
          if (dlab.rev != null && lab.rev !== dlab.rev) { cur.global.fx.lab = dlab; changed = true; }
          else if (dlab.arrow) {
            lab.arrow = lab.arrow || {};
            for (const ak in dlab.arrow) if (lab.arrow[ak] == null) { lab.arrow[ak] = dlab.arrow[ak]; changed = true; }
          }
          for (const k of ['prims', 'sys', 'lane']) {
            const empty = lab[k] == null || (typeof lab[k] === 'object' && Object.keys(lab[k]).length === 0);
            if (dlab[k] && empty) { lab[k] = dlab[k]; changed = true; }
          }
          // 글리프는 키 단위 보강 — 기본값에 새 슬롯(발형·촉 등)이 추가되면 기존 방문자도 받음
          if (dlab.glyphs) {
            lab.glyphs = lab.glyphs || {};
            for (const gk in dlab.glyphs) if (!lab.glyphs[gk]) { lab.glyphs[gk] = dlab.glyphs[gk]; changed = true; }
          }
          if (changed) localStorage.setItem('newton_design_v1', JSON.stringify(cur));
        } else if (dlab && cur?.global?.fx && !lab) {
          cur.global.fx.lab = dlab;
          localStorage.setItem('newton_design_v1', JSON.stringify(cur));
        }
      }
    }
  } catch (e) { /* 기본 스토어 없음 = 내장 디폴트 */ }
  const { store: designStore, migrated } = DesignStore.load();
  if (migrated.length) console.log('[design store] 레거시 이행:', migrated.join(', '));
  // 일회 정화: 저작 잔해가 시딩에 섞여 배포됐던 스테이지 장면(v11.10 이전) —
  // '빈 props added가 5개 이상'인 스테이지는 전부 디버그 잔해로 판정, 오버라이드 리셋.
  // (READY에 링·"텍스트" 무더기가 깔리던 사고 — 정상 저작은 이 패턴이 나올 수 없음)
  {
    let purged = false;
    for (const [sid, st] of Object.entries(designStore.d.scenes || {})) {
      const empties = (st.added || []).filter(a => !a.props || !Object.keys(a.props).length).length;
      if (empties >= 5) { designStore.d.scenes[sid] = { patches: {}, added: [] }; purged = true; }
    }
    if (purged) { designStore.save(); console.log('[design store] 스테이지 장면 잔해 정화'); }
  }
  // 저장본이 없으면 리포에 굳힌 기본 룩(look-default.json)을 시드 — 서버 불필요, 깃이 기본값 보관
  if (!designStore.globalGet('fx', 'lab', null)) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}look-default.json`, { cache: 'no-cache' });
      if (r.ok) {
        const def = await r.json();
        designStore.globalSet('fx', 'lab', def);   // save()는 안 함 — 유저가 편집하는 순간부터 본인 저장본
      }
    } catch (e) { /* 기본값 파일 없음 = 내장 디폴트 */ }
  }
  // 저장된 룩의 LUT·글리프를 먼저 시드 — 세션 45컷(팔레트 파생 + 발형 텍스처)이 빌드 시 사용
  {
    const lab0 = designStore.globalGet('fx', 'lab', null);
    if (lab0?.stops) { FXP.stops = lab0.stops.map(x => [...x]); FXP.sat = lab0.sat ?? 1; }
    rebuildLUT();
    if (lab0?.glyphs) {
      FXP.bg = lab0.bg;
      FXP.footCtx = lab0.footCtx || 'out';
      FXP.customGlyphs = lab0.glyphs;
      GLYPHS.set(lab0.glyphs);
      GLYPHS.setFlips(lab0.glyphFlip || {});
      // dataURL 디코드 완료 대기 (수 ms — 발형 텍스처가 빌드 시점에 읽을 수 있게)
      await Promise.race([
        Promise.all([...GLYPHS.imgs.values()].map(img => img.complete ? null : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }))),
        new Promise(res => setTimeout(res, 1500)),
      ]);
    }
  }
  // 전역 기본값 복원 — v4에서 레거시 드로어 해체와 함께 영속화된 값들
  for (const [k, v] of Object.entries(designStore.d.global.colors || {})) if (k in COLORS) COLORS[k] = v;
  Object.assign(TCFG, designStore.d.global.tcfg || {});
  Object.assign(SCFG, designStore.d.global.scfg || {});
  tokens.recolor?.();
  // v15: 마크별 손편집(tokens[].design) 팩 복원 은퇴 — 구 스튜디오(✎ 편집) 진입점을 걷어내며
  // 소비 경로를 안 죽였더니, 예전에 만든 커스텀 아트(setArt)가 마크의 상태 셰이더(fx)를
  // 영구히 가려버리는 좀비가 남아있었음(판정 상태 불문 고정된 flat 원 — 유저 "새빨간 애" 신고로 발견).
  // 지금 원칙: 마크 형태·색은 룩 시스템만, 마크 좌표·간격은 팩 파생만 — 개별 손편집 자리가 없다.
  // 기존에 저장돼 있던 오버라이드도 여기서 일괄 정화(재부팅마다 재확인 필요 없게 즉시 지움).
  if (designStore.d.packs && Object.keys(designStore.d.packs).length) {
    designStore.d.packs = {};
    designStore.save();
    console.log('[design store] 팩 손편집(마크 아트) 잔해 정화 — 룩 시스템/피그마로 이관 완료');
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
    tokens.setCompare(bkVariant === 'curry' ? bkVariants.real : null);  // 기본 팩 고스트 = 차이 가시화
  });

  // 러닝 팩 변형 토글: 실측 케이던스(기본) ↔ 전문가(BVH) ↔ 영상 추출 (커리 토글과 동일 패턴).
  const runVariants = { real: state.packs.running, expert: state.packs.running_expert, video: state.packs.running_video };
  let runVariant = 'real';
  const runBtns = { expert: document.getElementById('run-expert'), video: document.getElementById('run-video') };
  for (const [key, btn] of Object.entries(runBtns)) {
    btn?.addEventListener('click', () => {
      runVariant = runVariant === key ? 'real' : key;
      state.packs.running = runVariants[runVariant];
      document.querySelector('[data-pack=running]')?.click();
      for (const [k, b] of Object.entries(runBtns)) b?.classList.toggle('active', runVariant === k);
      tokens.setCompare(runVariant !== 'real' ? runVariants.real : null);  // 기본 팩 고스트 = 차이 가시화
    });
  }

  // 복싱 팩 변형 토글: IMU 잽 리듬(기본) ↔ 실사 영상 추출 (동일 패턴).
  const bxVariants = { real: state.packs.boxing, video: state.packs.boxing_video };
  let bxVariant = 'real';
  const bxVideoBtn = document.getElementById('bx-video');
  bxVideoBtn?.addEventListener('click', () => {
    bxVariant = bxVariant === 'video' ? 'real' : 'video';
    state.packs.boxing = bxVariants[bxVariant];
    document.querySelector('[data-pack=boxing]')?.click();
    bxVideoBtn.classList.toggle('active', bxVariant === 'video');
    tokens.setCompare(bxVariant === 'video' ? bxVariants.real : null);
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
    state.loop = 0;
    tokens.loopShiftZ = 0;
    const data = state.packs[p];
    tokens.setPack(data);
    xbot.setPack(data, tokens.events);
    rig.setPack(data.sport, tokens.events);
    const isKneePack = data.sport === 'running' || data.sport === 'basketball';
    window.__updateSurfAvail?.();   // 실내 테마 = 복싱 전용 게이트
    window.__applySurfDefault?.(p);   // 팩별 기본 투사면 자동 적용
    tokens.footprintTest = isKneePack ? (x, z, inset) => rig.contains(x, z, inset) : null;
    effects.clip = isKneePack ? (x, z) => rig.contains(x, z) : null;

    // 팩별 투사면 기본값 — 농구 스텝은 발치 좁은 구역(2.4m), 러닝은 전방 2.0m
    // (구 3m은 비스듬 각도상 far가 과하게 눌려 가독 최악 + 대지 프레임 뒤 빈 빔이 길었음 — 유저 지적).
    const farEl = document.getElementById('s-fpfar');
    farEl.value = data.sport === 'basketball' ? 240 : 200;
    farEl.dispatchEvent(new Event('input'));

    // 정보 위계: 농구는 NOW+NEXT 2개만 (공간 위계 혼잡 방지)
    const countEl = document.getElementById('s-count');
    countEl.value = data.sport === 'basketball' ? 2 : 3;
    countEl.dispatchEvent(new Event('input'));

    judge.setPack(tokens.events, data.sport);
    reportEl.innerHTML = '루프 1회 완료 시 리포트 생성…';

    // 벽면 고스트 → 실제 모션 고스트봇으로 대체 (실루엣은 보조로 끔)
    ghost.group.visible = false;
    if (data.sport === 'boxing') {
      ensureGhostBot(); computeStation();
      // 설계 정합: 유저(봇)는 유닛 뒤 전신 인식 최적 링(standZ)에 선다 — z=0(유닛 코앞) 아님
      xbot.group.position.z = opt.standZ;
    }
    if (ghostLayer) ghostLayer.visible = false;   // 열화상 봇 시연 은퇴 — 실사 그라디언트 코치가 대체 (유저 확정)
    if (data.sport === 'boxing') {
      const punchTimes = tokens.events.filter(e => e.surface === 'wall').map(e => e.t);
      ghost.configure(punchTimes, rig._wallCenter, rig.wallH);
      ghost.setClip(rig.wallClip);
    }
    setPackEnvironment(p, data.hasWall);
    panel.setPack(data, tokens.events);
    tokens.resetLoop();
    lastBodyZ = 0;

    // 장면 UI 시스템: PRIME 면 재규정 (복싱만 벽이 PRIME)
    // 브랜드 타이틀(NEWTON·종목) 은퇴 — 투사면은 훈련 큐 전용, 브랜딩은 투사면 밖(앱/하드웨어)에서
    sceneUI.setSport(data.sport, data.sport === 'boxing');
    sceneUI.setTitle('');
    sceneUI.setStatus('');
    // 시그니처 스탬프 은퇴(v15) — 같은 정보(팩 출처·시그니처)가 좌측 패널 '원본 데이터'에
    // 이미 상시 표기됨(panel.js packSignature). 투사면 중앙에 또 띄울 이유가 없고,
    // '투사면=훈련 큐 전용, 지속 수치 금지' 원칙과도 어긋남(유저: "굳이 UI 중앙에 떠야하냐").
    sceneUI.setSub('');

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
  // ── 세션 단계별 시선 각도 (문헌 도출) ─────────────────────────
  // 근거: ①Matthis·Yates·Hayhoe 2018(Current Biology) — 보행자는 약 2보 앞(~1.5s 시간창)을
  //   응시. 평지+가이드에선 더 멀리 → 실전 C = -18°(낙하점 ~5m, 안정 시선 10–20° 하향 범위).
  // ②시각 인간공학(ISO 9241 계열) — 지속 주시 편안 범위 수평 아래 0–35°, 지속 목 굴곡은
  //   ~20° 이내 권장, 단시간 깊은 굴곡은 허용 → 학습 단계만 깊게, 실전은 얕게.
  // ③학습자는 발 근처를 봄(novice 근거리 주시): 익히기 B = -38°(낙하점 ≈2.1m, 마크 시인),
  //   스트레칭 A = -42°(발 앞 ~1.8m 마크, 동작 10초 단위라 지속 굴곡 아님), 전환 T = -30°.
  const STAGE_GAZE_DEG = { R: -46, A: -42, B: -38, T: -30, C: -18 };   // R=READY: 발앞 UI 화면 채우게 더 내려봄
  function sessionGazeTarget() {
    // 벽 종목(복싱): 시선은 벽 정면 — 코치(y≈1.0~1.7)·타겟(y≈1.14)이 전부 시야에 안정적으로.
    // 눈높이 1.6m·벽앞 1.75m 기준 -8° ≈ 벽 중심 응시 (버그였음: 'BX_'의 B가 익히기 -38°로 매칭돼 바닥만 봄)
    if (session.curStage?.wall) return -8;
    const id = session.curStage?.id || '';
    // 전환·타이머·리포트(지면 풀스크린 화면) = x봇이 바닥의 화면을 보도록 게이즈 하향(세션 컴플리트·실전 직전).
    if (/^(T1|T2|C1|FIN|BK_T1|BK_T2|BK_C1|BK_FIN)$/.test(id)) return -44;
    if (id === 'A1') return -30;   // 전방 리치 홀드 — 투사각을 앞으로 눕혀 발 앞 가이드까지 보이게(미래 알고리즘 보정 가정)
    return STAGE_GAZE_DEG[id[0]] ?? -30;   // READY/FIN 등 = 중간값
  }
  let manualGazeDeg = -18;   // 유저 수동 설정값 (세션 종료 시 복귀 기준)
  let sessionDroveGaze = false;
  function updateSessionGaze(h) {
    sessionDroveGaze = true;
    // 단계별 시선 각도로 부드럽게 (τ=0.9s) — 수동 슬라이더는 세션 밖에서만
    const tgt = THREE.MathUtils.degToRad(sessionGazeTarget());
    gazePitch += (tgt - gazePitch) * (1 - Math.exp(-h / 0.9));
    const sl = document.getElementById('s-pitch'), lb = document.getElementById('v-pitch');
    const deg = Math.round(THREE.MathUtils.radToDeg(gazePitch));
    if (sl) sl.value = deg;
    if (lb) lb.textContent = `${deg}°`;
  }
  const FOV_V = THREE.MathUtils.degToRad(60);  // 인간 유효 수직 시야
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
  const fovCone = new THREE.LineSegments(coneGeo,
    new THREE.LineBasicMaterial({ color: 0xfec389, transparent: true, opacity: 0.55 }));
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
    new THREE.MeshBasicMaterial({ color: 0xd1feff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
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
    new THREE.MeshBasicMaterial({ color: 0xd1feff, transparent: true, opacity: 0.055,
      side: THREE.DoubleSide, depthWrite: false }));
  const trackEdge = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xd1feff, transparent: true, opacity: 0.30 }));
  trackVol.frustumCulled = trackEdge.frustumCulled = false;
  trackVol.renderOrder = 2;
  const optRing = new THREE.Mesh(
    new THREE.RingGeometry(0.30, 0.345, 48),
    new THREE.MeshBasicMaterial({ color: 0xd1feff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  optRing.rotation.x = -Math.PI / 2;
  const camMark = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.015, 16),
    new THREE.MeshStandardMaterial({ color: 0xd1feff, emissive: 0x21585c, emissiveIntensity: 1.4 }));
  camMark.rotation.x = Math.PI / 2;
  trackVol.visible = trackEdge.visible = optRing.visible = camMark.visible = false;
  scene.add(trackVol, trackEdge, optRing, camMark);

  // ── 농구 방향·리듬 큐 — 룩 시스템 최소 토큰만 (룩 이전 사제 3종 은퇴:
  //    ShapeGeometry 통화살표·RingGeometry 비트 링·LineDashed 레인 →
  //    LINE ① 이동 촉·MARK 존 원 Preview·LANEFX 광류).
  //    기능(풋프린트 추종·데이터 케이던스 글로우)은 그대로, 렌더만 카탈로그. ──
  const bkArrow = makeFlowArrow(1.25);
  bkArrow.visible = false; scene.add(bkArrow);
  const bkBeats = [];   // 깊이 따라 3개 리듬 비트 = MARK 존 원 (박자 글로우 = uFade)
  for (let i = 0; i < 3; i++) {
    const mat = makeMarkFXMaterial();
    mat.uniforms.uPhase.value = 0;   // Preview — 숨쉬는 존 원
    const quad = (0.215 / 0.72) * 2;   // 구 링 외경 0.215 유지 (MARK 쿼드 환산)
    const r = new THREE.Mesh(new THREE.PlaneGeometry(quad, quad), mat);
    r.rotation.x = -Math.PI / 2; r.position.y = 0.021; r.renderOrder = 6; r.visible = false;
    scene.add(r); bkBeats.push(r);
  }
  // ── 앰비언트 토포그래피 라인 (농구 공간 2면) — Vanta TOPOLOGY 계열 기법의 GLSL 포팅:
  //    fbm 고도장 → fract 등고선 밴드가 은은히 흐름. 룩 LUT 팔레트·순수 가산(그림자 불가)·P4 감마.
  function makeTopoMaterial(scale) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uLUT: { value: getLUT() }, uGain: { value: 0.34 }, uScale: { value: scale } },
      vertexShader: `#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <clipping_planes_vertex>
}`,
      fragmentShader: `#include <common>
#include <clipping_planes_pars_fragment>
varying vec2 vUv;
uniform float uTime, uGain, uScale;
uniform sampler2D uLUT;
vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
` + FX_GLSL.replace('uniform sampler2D uLUT;', '').replace('vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }', '') + `
void main(){
  #include <clipping_planes_fragment>
  vec2 p = vUv * uScale;
  float h = fxfbm(p + vec2(uTime * 0.04, uTime * 0.023));
  h += 0.35 * fxfbm(p * 2.3 - vec2(uTime * 0.031, 0.0));
  float band = abs(fract(h * 7.0) - 0.5) * 2.0;           // 등고선 밴드
  float line = smoothstep(0.13, 0.0, band);
  float major = smoothstep(0.07, 0.0, abs(fract(h * 1.75) - 0.5) * 2.0);   // 굵은 주 등고선
  float glow = smoothstep(0.5, 0.0, band) * 0.22;
  float e0 = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x)
           * smoothstep(0.0, 0.10, vUv.y) * smoothstep(1.0, 0.90, vUv.y);  // 가장자리 페이드
  vec3 col = lut(clamp(0.30 + h * 0.35, 0.0, 1.0)) * (line * 0.85 + major * 0.6 + glow) * uGain * e0;
  col = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
  gl_FragColor = vec4(col, 1.0);
}`,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
  }
  const bkTopoFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.2), makeTopoMaterial(3.4));
  bkTopoFloor.rotation.x = -Math.PI / 2;
  bkTopoFloor.position.set(0, 0.005, -1.1);
  bkTopoFloor.renderOrder = 3; bkTopoFloor.visible = false;
  scene.add(bkTopoFloor);
  const bkTopoWall = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), makeTopoMaterial(2.8));
  bkTopoWall.renderOrder = 3; bkTopoWall.visible = false;
  scene.add(bkTopoWall);
  const bkLaneMat = makeLaneFXMaterial(1.4);
  const bkLane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), bkLaneMat);
  bkLane.rotation.x = -Math.PI / 2; bkLane.renderOrder = 5; bkLane.visible = false;
  scene.add(bkLane);

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
    const OFF = opt.standZ - xbot.group.position.z;   // 봇이 설계 위치에 서면 0
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
    // UI 전체 가시 거리: 벽 가로가 편안한 수평 시야(~55°)에 들어오는 최소 거리 (유저 교정:
    // 'UI 전체를 봐야 하니 뒤로') — 벽으로부터의 거리 기준이라 유닛 z에서 환산
    const dView = (rig.wallW / 2) / Math.tan(55 / 2 * Math.PI / 180);
    const standZ = Math.max(zU + dCamReq, WALL_Z + dView);     // 유저가 서야 할 z (유닛 뒤)
    Object.assign(opt, { zU, dProj, tilt, standZ, dCam: dCamReq });
    tokens.stanceOffsetZ = standZ;   // 복싱 스탠스 발판 = 서기 위치 기준

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
  let fpMode = false, coneOn = false, fpUserSet = false;   // fpUserSet = 유저 수동 시점 선택(스테이지 강제전환 억제)
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
    setFPView(on);   // 1인칭 가독 보정 — 순번 감쇠 완화 + 마크·레인 게인 (시선 각도 눌림)
    setBtnActive(fpBtn, fpMode);
    controls.enabled = !fpMode;
    // 진짜 눈 시점: 자기 몸은 시야를 가리지 않음 + 인간 유효 시야각
    xbot.model.visible = !fpMode;
    // 1인칭 화각 = 종목별: 복싱(벽 응시) 58°. 러닝도 광각(85°)이면 발앞 투사 UI가 과소하게 멀리·작게
    // 보임(유저) → 사람 유효 중심시야(~55°)에 맞춰 좁힘. 62→60°로 살짝 더 좁혀 화면을 더 채움.
    // (56~58°까지 좁히면 지면 near-edge가 화면 밖으로 밀리고 훈련 정보가 페이스 발자국 3D 마크와 겹침 —
    //  스크린샷 검증. '생생한 크기'는 fov 과좁힘이 아니라 near-field 훈련정보 블록의 큰 타이포가 담당.)
    camera.fov = fpMode ? (state.pack === 'boxing' ? 58 : 60) : 50;
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
  fpBtn.addEventListener('click', () => { fpUserSet = true; setFp(!fpMode); });
  coneBtn.addEventListener('click', () => {
    coneOn = !coneOn;
    setBtnActive(coneBtn, coneOn);
  });

  // ── 배치 편집(유저): 편집 모드에서 드래그로 '빔프로젝터 유닛(rig.station)'·인물만 이동. 벽 고정.
  //    프레임마다 재적용해 세션 덮어쓰기 후에도 유지. 더블클릭 = 리셋(되돌리기). ──
  const editBtn = document.getElementById('btn-edit');
  let editMode = false;
  const _edit = { botX: null, botZ: null, projX: null, projZ: null };   // 수동 위치(설정 시 매 프레임 재적용)
  const _ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _dragPlane = new THREE.Plane();
  const _hit = new THREE.Vector3();
  const _tmpV = new THREE.Vector3();
  let _dragTarget = null, _dragOff = new THREE.Vector3();
  const getProj = () => { const st = rig?.station; return st && st.visible ? st : null; };   // 빔프로젝터 유닛(복싱/농구 스테이션 = 검은 박스). 러닝=무릎모듈이라 미해당
  function pickAt(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    _ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    _ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    _ray.setFromCamera(_ndc, camera);
    _dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
    return _ray.ray.intersectPlane(_dragPlane, _hit) ? _hit : null;
  }
  editBtn?.addEventListener('click', () => {
    editMode = !editMode;
    setBtnActive(editBtn, editMode);
    if (editMode && fpMode) setFp(false);   // 편집은 3인칭에서
    controls.enabled = !editMode;
    renderer.domElement.style.cursor = editMode ? 'grab' : '';
  });
  renderer.domElement.addEventListener('mousedown', ev => {
    if (!editMode) return;
    const p = pickAt(ev); if (!p) return;   // 지면 클릭점(드래그 이동용)
    // 선택은 화면공간 근접 — 고도 있는 프로젝터도 정확히 잡힘
    const r = renderer.domElement.getBoundingClientRect();
    const cx = ev.clientX - r.left, cy = ev.clientY - r.top;
    const scr = pos => { const v = pos.clone().project(camera); return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height]; };
    const botP = xbot?.group?.position;
    const proj = getProj();
    const projWP = proj ? proj.getWorldPosition(_tmpV.clone()) : null;
    // 인물은 몸통(발 위 ~0.9m)을 스크린 기준점으로
    const botMid = botP ? botP.clone().add(new THREE.Vector3(0, 0.9, 0)) : null;
    const dBot = botMid ? (([x, y]) => Math.hypot(x - cx, y - cy))(scr(botMid)) : 1e9;
    const dProj = projWP ? (([x, y]) => Math.hypot(x - cx, y - cy))(scr(projWP)) : 1e9;
    if (Math.min(dBot, dProj) > 150) return;   // 150px 이내 클릭만
    _dragTarget = dBot <= dProj ? 'bot' : 'proj';
    const base = _dragTarget === 'bot' ? botP : projWP;
    _dragOff.set(base.x - p.x, 0, base.z - p.z);   // 지면 오프셋(고도 오차 흡수 = 상대 드래그)
    controls.enabled = false;
    renderer.domElement.style.cursor = 'grabbing';
    ev.preventDefault();
  });
  window.addEventListener('mousemove', ev => {
    if (!editMode || !_dragTarget) return;
    const p = pickAt(ev); if (!p) return;
    const nx = p.x + _dragOff.x, nz = p.z + _dragOff.z;
    if (_dragTarget === 'bot') { _edit.botX = nx; _edit.botZ = nz; }
    else { _edit.projX = nx; _edit.projZ = nz; }
  });
  window.addEventListener('mouseup', () => {
    if (_dragTarget) { _dragTarget = null; renderer.domElement.style.cursor = editMode ? 'grab' : ''; }
  });
  // 배치 리셋(되돌리기, 유저) — 수동 위치 해제 + 프로젝터 빔 원점 원복. 버튼·더블클릭 공용.
  let _origStatPos = null;
  function resetEdit() {
    _edit.botX = _edit.botZ = _edit.projX = _edit.projZ = null;
    if (_origStatPos && rig?.stationPos) { rig.stationPos.copy(_origStatPos); rig.station?.position.copy(_origStatPos); }
  }
  document.getElementById('btn-edit-reset')?.addEventListener('click', resetEdit);
  renderer.domElement.addEventListener('dblclick', () => { if (editMode) resetEdit(); });
  // 매 프레임 수동 위치 재적용 (세션/리그가 덮어써도 유지) — applyEditOverrides()가 렌더 루프에서 호출
  function applyEditOverrides() {
    if (_edit.botX != null && xbot?.group) { xbot.group.position.x = _edit.botX; xbot.group.position.z = _edit.botZ; }
    if (_edit.projZ != null && rig) {
      if (!_origStatPos && rig.stationPos) _origStatPos = rig.stationPos.clone();   // 첫 이동 시 원점 백업(리셋용)
      // 빔 발사 원점(stationPos)까지 이동 → 실제 프로젝션이 함께 따라감(유저). 유닛 박스도 동기.
      if (rig.stationPos) { rig.stationPos.x = _edit.projX; rig.stationPos.z = _edit.projZ; }
      if (rig.station) { rig.station.position.x = _edit.projX; rig.station.position.z = _edit.projZ; }
    }
  }
  window.__applyEditOverrides = applyEditOverrides;

  // 1인칭 VOR 안정화 상태 (인간 눈: 머리 요동을 시선이 상쇄)
  const fpPos = new THREE.Vector3();
  let fpInit = false;
  const FP_FWD_FIXED = new THREE.Vector3(0, 0, -1);   // 세션 1인칭 시선 방위 (전 종목 전방 -z)

  // 시야∩투사면 교집합 하이라이트 + 시선 낙하 범위
  const gazeRange = { near: 0, far: 0 };
  const gazeMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xd1feff, transparent: true, opacity: 0.13,
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
  bindSlider('s-pitch', 'v-pitch', v => `${v}°`, v => { gazePitch = THREE.MathUtils.degToRad(v); manualGazeDeg = v; });
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
  let _metroCtx = null, _metroPh = -1;   // P 케이던스 메트로놈 (WebAudio 클릭)
  const _strikeTs = []; let _lcPrev = false, _rcPrev = false, _spmUpd = 0;   // 내 케이던스 실측(접지 간격)
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
    // 음성 문장을 바닥에 복제하던 지시문 슬롯 은퇴 — 3중 중복(음성+하단 캡션+바닥)이었고,
    // 거대 문장이 잘린 채 발자국·가이드를 덮는 주범 (세션 짧은 구 카피 FL이 바닥 지시 담당)
    if (!captionEl) return;
    // 실전(C1~C5) = 무자막(유저 확정): 음성만. 달리며 글 읽기 금지 — 빛 언어가 전달.
    if (session?.active && /^C\d$/.test(session.stage || '')) return;
    captionEl.innerHTML = `<b>🔊 ${who}</b> · ${text}`;
    captionEl.style.opacity = '1';
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { captionEl.style.opacity = '0'; }, 4500);
  }
  const sessionHud = document.getElementById('session-hud');
  const hudStageEl = document.getElementById('hud-stage');
  const hudIdxEl = document.getElementById('hud-idx');
  // 세션이 판정 오차를 소비 (페이스 라이트 = 타이밍 오차의 공간 번역, C3 흔들림 시연)
  // 프레스 완료(원 다 채움) → 지면 버스트 — '누르면 반응하는 바닥'의 보상감 (기존 파문 이펙트 재사용)
  const _pressBurst = (wp, soft) => effects.burst(wp, 0xfec389, new THREE.Vector3(0, 1, 0),
    soft ? { intensity: 0.28, sizeM: 0.32 } : { intensity: 0.72, sizeM: 0.52 });   // soft = 홀드 중 은은한 틱
  // 리프트 큐 3안 미리보기 픽커 — A3(하이니)에서만 좌하단 표시, 클릭 즉시 전환(유저: 버튼으로)
  const cuePick = document.createElement('div');
  cuePick.id = 'a3cue-picker';
  cuePick.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:60;display:none;gap:6px;align-items:center;'
    + 'background:rgba(20,22,28,.88);border:1px solid #333;border-radius:10px;padding:8px 12px;font:600 12px sans-serif;color:#ccc';
  cuePick.innerHTML = '<span style="margin-right:4px">리프트 큐</span>';
  [1, 2, 3, 4].forEach(n => {
    const b = document.createElement('button'); b.textContent = n;
    b.style.cssText = 'width:30px;height:30px;border-radius:8px;border:1px solid #444;background:' + (n === (FXP.a3Arrow || 1) ? '#fa3030' : '#1c1f26') + ';color:#eee;cursor:pointer;font:700 13px sans-serif';
    b.onclick = () => { FXP.a3Arrow = n; [...cuePick.querySelectorAll('button')].forEach((x, i) => x.style.background = (i + 1 === n) ? '#fa3030' : '#1c1f26'); };
    cuePick.appendChild(b);
  });
  document.body.appendChild(cuePick);
  // 실전 UI 5안 픽커 — C 실전에서만 좌하단 표시, 클릭 즉시 전환 (a3cue-picker 패턴 복제)
  const livePick = document.createElement('div');
  livePick.id = 'liveui-picker';
  livePick.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:60;display:none;gap:6px;align-items:center;'
    + 'background:rgba(20,22,28,.88);border:1px solid #333;border-radius:10px;padding:8px 12px;font:600 12px sans-serif;color:#ccc';
  livePick.innerHTML = '<span style="margin-right:4px">실전 UI</span>';
  [1, 2, 3, 4, 5].forEach(n => {
    const b = document.createElement('button'); b.textContent = n;
    b.style.cssText = 'width:30px;height:30px;border-radius:8px;border:1px solid #444;background:' + (n === (FXP.liveUI || 1) ? '#fa3030' : '#1c1f26') + ';color:#eee;cursor:pointer;font:700 13px sans-serif';
    b.onclick = () => { FXP.liveUI = n; [...livePick.querySelectorAll('button')].forEach((x, i) => x.style.background = (i + 1 === n) ? '#fa3030' : '#1c1f26'); };
    livePick.appendChild(b);
  });
  document.body.appendChild(livePick);
  // 현재 훈련 구간 계산 — session.t/dur를 loop만큼 순환, f 비중으로 구간 선택.
  // 표시는 화면 오버레이가 아니라 '지면 투사 프레임(floor-scene.html)' 안에 편입(유저) — updateFloorTrainPhase.
  const trainPhase = () => {
    const st = session.curStage; const ph = st?.phases;
    if (!ph || !session.active || session.sport !== 'running') return null;
    const dur = STAGE_DUR[st.id] ?? st.dur ?? 8;
    let cyc = (((session.t / dur) * (st.loop || 1)) % 1 + 1) % 1;
    let acc = 0;
    for (const p of ph) { const lo = acc; acc += p.f; if (cyc <= acc + 1e-4) return { ...p, prog: (cyc - lo) / Math.max(1e-4, p.f) }; }
    const last = ph[ph.length - 1]; return { ...last, prog: 1 };
  };
  const session = new Session(scene, tokens, xbot, rig, st => {
    cuePick.style.display = st.id === 'A3' ? 'flex' : 'none';
    livePick.style.display = 'none';   // 실전=연습 통일(유저): LiveUI 변형 은퇴 → 픽커 숨김
    const sig = [];
    if (st.hap) sig.push(`<span style="color:var(--warn)">햅틱</span> ${st.hap}`);
    if (st.wear) sig.push(`<span style="color:var(--ok)">웨어러블</span> ${st.wear}`);
    if (st.cue) sig.push(`<span style="color:#fa3030">보상</span> ${st.cue}`);
    if (st.foot) sig.push(`<span style="color:var(--accent)">발</span> ${st.foot}`);
    const html = `<b style="color:var(--text)">${st.label}</b>` +
      (st.desc ? `<br><span style="font-size:11.5px;color:var(--dim);line-height:1.5">${st.desc}</span>` : '') +
      (sig.length ? `<br><span style="font-size:11px">${sig.join(' · ')}</span>` : '');
    if (sessionStageEl) sessionStageEl.innerHTML = html;
    if (hudStageEl) hudStageEl.innerHTML = html;
    if (hudIdxEl) hudIdxEl.textContent = `${session.stageIdx + 1} / ${session.total}`;
    // 준비운동(A) 단계 = 코치가 리깅으로 실제 스트레칭 수행(발목 원·종아리·스윙) → 3인칭으로 '먼저 보고 따라'
    //   하게 x봇을 보임. 1인칭은 내가 곧 x봇이라 코치 동작이 안 보였음(유저 지적). 실전·전환 = 1인칭 몰입.
    if (!fpUserSet) setFp(!/A\d$/.test(st.id));   // 유저가 수동 토글했으면 그 선택 유지(스테이지마다 강제전환 금지)
    // 스테이지 라벨을 바닥에 문장으로 깔던 상태 슬롯 은퇴 — 세션 HUD 카드 + 세션 FS 슬롯('LEARN 3/4')과
    // 3중 중복이었고 발자국·가이드를 덮는 두 번째 주범. 투사면 = 훈련 큐 전용 원칙.
    veil();  // 단계 전환 암전 (끊김 → 의도된 전환으로)
    // 전환/타이머/리포트(풀스크린 지면 화면)는 하단이 화면 콘텐츠(버튼)라 음성 캡션을 상단으로 이동(겹침 방지).
    if (captionEl) {
      const ff = /^(T1|T2|C1|FIN|BK_T1|BK_T2|BK_C1|BK_FIN)$/.test(st.id);
      captionEl.style.top = ff ? '7%' : ''; captionEl.style.bottom = ff ? 'auto' : '';
    }
    if (st.voice) { showCaption(st.voice[0], st.voice[1]); speak(st.voice[0], st.voice[1], st.id); }
    if (st.wear) {
      const w = st.wear;
      const c = w.includes('BOOST') ? '#d1feff' : w.includes('LOAD') ? '#fec389'
              : w.includes('SAFE') ? '#d1feff' : '#9b9b9b';
      wearPulse(c);
    } else if (wearFxEl) wearFxEl.style.opacity = '0';
    // 데모 투어: READY 진입 시 자동 시작(탭), FIN 도달 시 다음 종목으로
    if (demoTour) {
      if (/READY$/.test(st.id)) setTimeout(() => { if (demoTour && session.active) session.tapAdvance(); }, 1400);
      if (/FIN$/.test(st.id)) setTimeout(() => demoAdvance(), 4500);
    }
  });
  session.judge = judge;   // 판정 오차 소비 (페이스 라이트·FIN 겹쳐보기·C3 흔들림)
  if (import.meta.env.DEV) { window.__sess = session; window.__cam = camera; window.__rig = rig; window.__scene = scene; window.__hoop = hoop; }   // 디버그 훅 — 콘솔에서 스테이지 고정·검수용

  // 단계 중간 음성 큐 — 시범→실행 전환("이제 같이") 등 코칭 3층 문법의 동작 큐 채널
  session.say = (who, line, vkey) => { showCaption(who, line); speak(who, line, vkey || 'cue:' + line.slice(0, 16)); };
  // 자동 장면 전환 게이트: 준비된 음성(mp3 또는 폴백 TTS)이 재생 중이면 true → 세션이 자동 넘어가기 보류.
  //   play() 직후 currentTime은 잠깐 0이지만 paused는 즉시 false → currentTime 조건 제거(시작 직후 잘림 방지).
  session.voiceBusy = () => (ttsOn && !voiceAudio.paused && !voiceAudio.ended)
    || (('speechSynthesis' in window) && speechSynthesis.speaking);
  // 게이트/다운시프트 안내 자막 + 웨어러블 신호
  sessionSkillSink = session;
  session.setSkill(parseInt(document.getElementById('s-skill')?.value ?? '70', 10) / 100);
  session.onGate = (type) => {
    if (type === 'fail') { showCaption('시스템', '아직 폼이 덜 익었어요 — 익히기 한 번 더.'); wearPulse('#fec389', 1600); }
    else if (type === 'downshift') { showCaption('시스템', '폼이 흔들려요 — 익히기로 되돌립니다.'); wearPulse('#fec389', 1600); }
  };
  session.onPress = _pressBurst;   // 프레스 완료 버스트 연결
  // 실전 러닝 플로어 UI 5안 모듈 — C 라이브에서만 렌더 루프가 update
  const liveUI = new LiveUI(scene, tokens, rig);
  liveUI.onLand = wp => effects.burst(wp, 0xfec389, new THREE.Vector3(0, 1, 0), { intensity: 0.6, sizeM: 0.5 });   // 인트로 '꽂힘' 버스트
  if (import.meta.env.DEV) window.__liveUI = liveUI;   // 헤드리스 검수 훅
  const sessionBtn = document.getElementById('btn-session');
  const demoBtn = document.getElementById('btn-demo');
  let demoTour = null;   // { queue:[sports], i }
  // ── 장면 스코프 — ✎ 디자인 안의 [장면] 탭. 별도 에디터가 아니다. ──
  const sceneScope = new SceneScope(session, designStore, { onDirty: saveScenes });
  {
    const _ss = designStore.sceneStore();
    // A1·A2 재설계됨(목돌리기 영상 패널 / 런지 발형) — 낡은 패치가 요소 위치를 봇 뒤로 끌어당김. 폐기.
    if (_ss) { delete _ss.A1; delete _ss.A2; }
    session.applySceneStore(_ss);   // 저장된 장면 편집 부팅 복원
  }

  function startSessionFor(sport) {
    // 스튜디오가 좌측 패널을 숨긴 채 남았을 수 있음 — 세션 시작 시 항상 복원(스틱 방지)
    if (typeof exitStudio === 'function' && studioActive) exitStudio();
    const panelEl = document.getElementById('panel');
    if (panelEl) panelEl.style.display = 'flex';
    if (state.pack !== sport) switchPack(sport);
    // 세션은 반드시 원점에서 시작 — 데모 루프의 심리스 시프트를 전부 리셋.
    // (미리셋 시 세션 UI가 loopShiftZ만큼 밀린 곳(-8m×루프수)에 지어지고
    //  풋프린트 스무딩이 순간이동을 뒤쫓다 전부 클리핑 → 'UI가 하나도 안 보임' 버그)
    state.time = 0; state.loop = 0;
    tokens.loopShiftZ = 0;
    tokens.resetLoop();
    rig.resetOmega();
    lastBodyZ = 0;
    sceneUI.setSub('');   // 스펙 스탬프는 도입부 전용 — 운동 중엔 큐만
    // 재생 상태 강제 복구 — 일시정지가 끼어든 채 세션을 시작하면 t=0에 언 채로 시작됨
    // (유저 '세션이 뿌옇게/봇 정지' 계열의 뿌리: 모드 전환은 반드시 재생 상태에서)
    state.playing = true;
    document.getElementById('pause-chip')?.style.setProperty('display', 'none');
    // 복싱: 유저(봇)를 카메라 전신 인식 최적 링(standZ)으로 후퇴 배치 (유저: 세션 시작 시 인물 뒤로)
    if (sport === 'boxing') { computeStation(); xbot.demoStandZ = opt.standZ; xbot.group.position.z = opt.standZ; }
    else xbot.demoStandZ = 0;
    session.start(sport);
    panel.setPlaying(true, true);
    sessionBtn.textContent = '세션 중지';
    if (sessionHud) sessionHud.style.display = 'block';
    // 세션 = 화면 집중: 좌측 패널·팩 카드 숨김 (중지 시 복귀)
    document.getElementById('panel')?.style.setProperty('display', 'none');
    document.getElementById('hud')?.style.setProperty('display', 'none');
    fpUserSet = false;   // 새 세션 = 자동 시점부터 (이후 유저 토글 시 고정)
    setFp(true);
  }
  function stopSession() {
    if (!session.active) return;
    session.stop();
    voiceAudio.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    sessionBtn.textContent = '세션 시작 (1인칭 전환)';
    // 세션 중지 = 데모 루프 재개 — 일시정지 잔존으로 봇이 얼어 보이던 문제
    state.playing = true;
    document.getElementById('pause-chip')?.style.setProperty('display', 'none');
    panel.setPlaying(true, false);
    if (sessionStageEl) sessionStageEl.textContent = '—';
    if (sessionHud) sessionHud.style.display = 'none';
    sceneUI.setStatus('');
    sceneUI.setInstruction('');
    xbot.demoStandZ = 0;
    document.getElementById('panel')?.style.removeProperty('display');
    document.getElementById('hud')?.style.removeProperty('display');
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
  document.getElementById('btn-view')?.addEventListener('click', () => { fpUserSet = true; setFp(!fpMode); });
  // ── FX 룩 프로 패널 — FX Lab 컨트롤을 시뮬 안에 (실물 3D 실시간 반영 + 자동 저장) ──
  const FX_PRESETS = {
    'NEWTON Vivid': [['#B7231F', 0], ['#FA3030', .3], ['#FE6E3C', .56], ['#FEA35F', .74], ['#FEC389', .86], ['#FFF3DC', 1]],
    'NEWTON Dawn':  [['#0B0710', 0], ['#6E0E1E', .18], ['#FA3030', .4], ['#FE6E3C', .62], ['#FEC389', .82], ['#D1FEFF', 1]],
    'NEWTON Heat':  [['#120609', 0], ['#8E1121', .26], ['#FA3030', .5], ['#FE6E3C', .7], ['#FEC389', .88], ['#FFF6E8', 1]],
    'Silhouette':   [['#141114', 0], ['#41232A', .24], ['#B03A44', .48], ['#FA5A50', .68], ['#FFC9A6', .86], ['#FFFFFF', 1]],
  };
  // ── 🔥 룩 스튜디오 = FX Lab 페이지 통째 임베드 ──────────────
  // 랩에서 만지는 모든 값이 400ms 주기로 전송 → 시뮬 적용 + designStore 저장.
  /** 커스텀 글리프/화살표 변경 → 현재 팩 리베이크 — 디바운스 (이미지 19장 로드·슬라이더 드래그마다 풀 리빌드 방지) */
  let glyphRefreshTimer = null;
  function refreshGlyphConsumers() {
    clearTimeout(glyphRefreshTimer);
    glyphRefreshTimer = setTimeout(() => {
      const data = state.packs[state.pack];
      if (!data) return;
      tokens.setPack(data);
      // 소비자 재연결 — setPack은 마커를 전부 새로 만든다. 미연결 시 judge·rig가
      // 부모 잃은 옛 마커(월드=로컬, 루프 시프트 미적용)를 계속 판정 →
      // "Pack 일치도 0% · 위치 오차 8만cm" 버그의 원인이었음.
      judge.setPack(tokens.events, state.pack);
      rig.events = tokens.events;
      tokens.resetLoop();
    }, 280);
  }
  GLYPHS.onLoad(() => refreshGlyphConsumers());
  let openFxLab = () => {};   // 아래 FX 블록에서 실제 구현 주입 (스튜디오 룩 탭·인스펙터 공용)
  let stageDark = null;       // 다크 저작 스테이지 — 편집 중 주간/투사면을 통제 (아래 FX 블록에서 주입)
  let updateSurfChipsOut = () => {};   // 패널 투사면 칩 동기 (룩 패널 공용)
  function applyLabState(st) {
    if (!st) return;
    if (st.stops) FXP.stops = st.stops.map(s => [...s]);
    if (st.sat != null) FXP.sat = st.sat;
    if (st.g) {
      FXP.graphics.width = st.g.width ?? FXP.graphics.width;
      FXP.graphics.halo = st.g.halo ?? FXP.graphics.halo;
      FXP.graphics.noise = st.g.noise ?? FXP.graphics.noise;
      FXP.graphics.ember = st.g.ember ?? FXP.graphics.ember;
      FXP.graphics.size = st.g.size ?? FXP.graphics.size;
      if (st.g.speed) FXP.graphics.duration = +(2.6 / st.g.speed).toFixed(2);   // 랩 속도 → 파문 지속
    }
    if (st.m) {
      Object.assign(FXP.mark, { core: st.m.core, halo: st.m.halo, pool: st.m.pool, sweep: st.m.sweep, wobble: st.m.wobble });
      if (st.m.radius) TCFG.markScale = st.m.radius;   // 존 반경 → 마크 크기 배율
    }
    if (st.p) Object.assign(FXP.person, { blur: st.p.blur, glow: st.p.glow, flow: st.p.flow, decay: st.p.decay });
    // 화면 룩(블룸·노출·그레인) 은퇴 — 저장값(st.s) 무시, 엔진 고정 룩만.
    // (은퇴 전 저장된 그레인 등이 좀비처럼 남는 것 방지 — 포스트프로세싱은 토큰이 아님)
    Object.assign(FX, { bloomStrength: 0.14, bloomThreshold: 0.85, bloomRadius: 0.4, exposure: 0.95, grain: 0, vignette: 0.08 });   // 블룸 축소 — 소형 고휘도 코어가 문대지며 '과한 블러'로 보이던 것 (랩=블룸 거의 없음)
    if (st.bg !== undefined) { FXP.bg = st.bg; setSurfaces(st.bg === 'none' ? null : st.bg); }   // 투사면 칩 → 실물 바닥/벽 (+발형 컨텍스트)
    if (st.prims) FXP.prims = st.prims;   // 프리미티브 파라미터 → 세션 스테이지 빌드 소비 (리로드 반영)
    const stPerson = st.person || st.p;   // 라이브 스냅샷은 'p', 내보내기는 'person'
    if (stPerson) Object.assign(FXP.person, stPerson);   // 인물(코치) 룩 — 음영·잔상·흐름 동기
    if (st.lane) FXP.lane = st.lane;      // 레인 전용 스타일 (화살표 LINE과 분리 — 유저 확정)
    // markShape(랩 표현형 토글)는 미리보기용 — 시뮬 루프 마크는 설계대로 존 원 고정
    // (발형 SDF 인프라는 세션 티칭 컨텍스트용으로 보존: fxlut.footSDFTexture)
    if (st.arrow) {
      const changed = JSON.stringify(st.arrow) !== JSON.stringify(FXP.arrow);
      Object.assign(FXP.arrow, st.arrow);
      if (changed) refreshGlyphConsumers();   // 화살표 자루 리빌드
    }
    if (st.glyphs && typeof st.glyphs === 'object') {
      const changed = JSON.stringify(st.glyphs) !== JSON.stringify(GLYPHS.map);
      FXP.customGlyphs = st.glyphs;
      GLYPHS.set(st.glyphs);
      GLYPHS.setFlips(st.glyphFlip || {});
      FXP.footCtx = st.footCtx || 'out';
      FXP.numFoot = st.numFoot || null;   // 발형 숫자 앵커 (FX Lab 드래그 지정)
      if (st.card) FXP.card = { ...FXP.card, ...st.card };   // 스테이지 카드 조판
      if (changed) refreshGlyphConsumers();   // 순서 숫자 텍스처 리베이크
    }
    if (st.sys) {   // 시스템 설정 이관분: 판정·역할 색 / TCFG / SCFG (fxlab → 시뮬 실시간 + 영속)
      if (st.sys.roles) {
        for (const [k, v] of Object.entries(st.sys.roles)) if (k in COLORS) {
          COLORS[k] = parseInt(String(v).slice(1), 16);
          designStore.globalSet('colors', k, COLORS[k]);
        }
        tokens.recolor();
      }
      if (st.sys.tcfg) for (const [k, v] of Object.entries(st.sys.tcfg)) { TCFG[k] = v; designStore.globalSet('tcfg', k, v); }
      if (st.sys.scfg) for (const [k, v] of Object.entries(st.sys.scfg)) { SCFG[k] = v; designStore.globalSet('scfg', k, v); }
    }
    rebuildLUT();
  }
  {
    // ☀️ 주간 모드 — 주광 가시 투사(제품 스토리) 시연: 밝은 환경 + 투사 게인 부스트
    let dayOn = !!designStore.globalGet('fx', 'day', true);   // 기본 = 주간(라이트) 모드 — 배포 첫 화면 기준 (유저 확정)
    const dayBtn = document.getElementById('btn-day');
    const applyDay = () => {
      setDaylight(dayOn);
      // 주간 = 풀컬러 잉크 모드(FXP.day → 셰이더 노멀 블렌딩): 게인 부스트로 클리핑시키지 않는다
      // (구 1.55 부스트가 밝은 바닥 + 가산에서 흰색 뭉개짐의 원인이었음)
      FXP.day = dayOn;
      FXP.gainBoost = dayOn ? 1.15 : 1.0;
      if (dayBtn) { dayBtn.textContent = dayOn ? '🌙' : '☀️'; dayBtn.style.borderColor = dayOn ? '#fec389' : 'var(--line)'; }
    };
    applyDay();
    dayBtn?.addEventListener('click', () => {
      dayOn = !dayOn;
      applyDay();
      designStore.globalSet('fx', 'day', dayOn);
      designStore.save();
    });
    // 👁 실물 뷰 — 투사 커버리지 시각화 숨김 (실제 러너의 눈: 투사된 UI만)
    let realView = !!designStore.globalGet('fx', 'realview', false);
    const realBtn = document.getElementById('btn-real');
    const applyReal = () => {
      rig.setVisualize(!realView);
      if (realBtn) { realBtn.style.borderColor = realView ? '#fec389' : 'var(--line)'; realBtn.style.color = realView ? '#fec389' : 'var(--text)'; }
    };
    applyReal();
    realBtn?.addEventListener('click', () => {
      realView = !realView;
      applyReal();
      designStore.globalSet('fx', 'realview', realView);
      designStore.save();
    });
    // 투사면 퀵 칩 — 룩 스튜디오 안 열고도 바닥/벽 테마 전환
    const SURF_DEFS = [['none', '다크'], ['indoor', '실내'], ['grass', '잔디'], ['track', '트랙'], ['court_gray', '코트(회색)'], ['court_black', '코트(검정)'], ['court', '코트(우드)'], ['paving', '보도블럭'], ['dirt', '흙길']];
    const surfWrap = document.getElementById('surf-chips');
    function updateSurfChips(key) {
      surfWrap?.querySelectorAll('button').forEach(b => {
        const on = b.dataset.key === (key || 'none');
        b.style.borderColor = on ? '#fec389' : 'var(--line)';
        b.style.color = on ? '#fec389' : 'var(--dim)';
      });
    }
    if (surfWrap) {
      for (const [key, label] of SURF_DEFS) {
        const b = document.createElement('button');
        b.dataset.key = key;
        b.textContent = label;
        b.style.cssText = 'padding:5px 11px;border:1px solid var(--line);border-radius:99px;background:none;color:var(--dim);font-size:11px;font-weight:600;cursor:pointer;';
        b.addEventListener('click', () => {
          if (b.disabled) return;
          setSurfaces(key === 'none' ? null : key);
          updateSurfChips(key);
          const st = designStore.globalGet('fx', 'lab', null) || {};
          st.bg = key;
          designStore.globalSet('fx', 'lab', st);
          designStore.save();
        });
        surfWrap.appendChild(b);
      }
    }
    // 실내 테마 = 복싱 전용 (자취방 벽 시나리오) — 러닝·농구에선 선택 불가 + 자동 해제
    window.__updateSurfAvail = () => {
      const ok = state.pack === 'boxing';
      const b = surfWrap?.querySelector('button[data-key="indoor"]');
      if (!b) return;
      b.disabled = !ok;
      b.style.opacity = ok ? '1' : '0.35';
      b.style.cursor = ok ? 'pointer' : 'not-allowed';
      b.title = ok ? '' : '실내 테마는 복싱 전용';
      const st = designStore.globalGet('fx', 'lab', null) || {};
      if (!ok && st.bg === 'indoor') {
        setSurfaces(null); updateSurfChips('none');
        st.bg = 'none'; designStore.globalSet('fx', 'lab', st); designStore.save();
      }
    };
    window.__updateSurfAvail();
    // 팩별 기본 투사면 — 매번 수동 선택 제거 (유저): 러닝=잔디 · 복싱=실내 · 농구=트랙
    const SURF_DEFAULT = { running: 'track', boxing: 'indoor', basketball: 'court_gray' };   // 러닝=트랙·농구=회색코트 기본(유저)
    window.__applySurfDefault = (pack) => {
      const key = SURF_DEFAULT[pack];
      if (!key) return;
      setSurfaces(key);
      updateSurfChips(key);
      const st = designStore.globalGet('fx', 'lab', null) || {};
      st.bg = key;
      designStore.globalSet('fx', 'lab', st);
      designStore.save();
    };
    const savedLab = designStore.globalGet('fx', 'lab', null);
    // 피그마 카드 임포트 파이프라인 — StageCard/베이스(fileKey 92a2mffNpTZ5PltLln7cgq, node 26:139) 실측값을
    // 정본으로 강제(브라우저에 저장된 구 랩 편집값보다 우선). 재실행 시 이 상수만 갱신하면 전원 반영.
    // titleZ 2.68→1.05→0.68→1.8→2.0 (최종): 겹침만 보고 네 번 연속 잘못 고쳤음 —
    // ①원래 2.68은 빔 끝단(fpFar 3.0m) 여유 0.3m뿐 ②1.05는 A1~B4 그래픽과 겹침
    // ③0.68은 CTA(1.1)와 겹침, 게다가 시선각 67°(발끝을 거의 수직으로 봐야 함) ④1.8로
    // 시선각은 고쳤지만 이번엔 **그래픽을 title보다 더 멀리(2.3~2.75m) 보내는 방향
    // 자체가 거꾸로**였음(유저 지적: "그래픽 존은 눈앞~발앞까지고 타이틀이 그 위로
    // 가야" — 그래픽=가까운 존, 타이틀=그 뒤(화면상 위)여야 함, 그 반대가 아님).
    // 최종: **그래픽(A1~B4)을 가까운 존(1.0~1.6m)으로 압축**(session.js), 타이틀
    // (2.0m,≈39°)·아이브로(2.3m,≈35°)는 그래픽보다 뒤에서 편안한 시선각 유지, 푸터
    // (0.7m,≈66°)만 그래픽보다 앞(CTA 55°와 비슷한 성격 — 순간 카운터라 허용).
    const FIGMA_CARD = { titleZ: 2.0, eyebrow: 0.30, footerZ: 0.7, titleCap: 0.13, eyeCap: 0.07, footCap: 0.065, cta: 1.0 };
    if (savedLab) {
      const changed = JSON.stringify(savedLab.card || null) !== JSON.stringify(FIGMA_CARD);
      savedLab.card = FIGMA_CARD;
      if (changed) { designStore.globalSet('fx', 'lab', savedLab); designStore.save(); }
    }
    // 발형 숫자 글리프 크기 고정 — FX Lab에서 휠로 조정한 최종값을 정본으로 강제
    // (유저 결정: 마크마다/유저마다 제각각이던 글리프 크기를 통일). FIGMA_CARD와 동일 패턴.
    const FIXED_NUMFOOT = {
      in:  { x: 0.5094339330826735, y: 0.3757961753613217, s: 0.7873316243260334 },
      out: { x: 0.46862160868866765, y: 0.37879042550329767, s: 0.9548249031726418 },
    };
    if (savedLab) {
      const changedNF = JSON.stringify(savedLab.numFoot || null) !== JSON.stringify(FIXED_NUMFOOT);
      savedLab.numFoot = FIXED_NUMFOOT;
      if (changedNF) { designStore.globalSet('fx', 'lab', savedLab); designStore.save(); }
    }
    updateSurfChips(savedLab?.bg || 'none');
    updateSurfChipsOut = updateSurfChips;
    if (savedLab) applyLabState(savedLab);

    // 다크 저작 스테이지 — 투사는 가산광: 편집은 통제된 다크 위에서만 성립.
    // enter/exit는 뷰 상태만 바꾸고 designStore는 불변 — exit가 store를 재독해 복원.
    stageDark = {
      active: false,
      enter() {
        this.active = true;
        setDaylight(false);
        FXP.day = false;   // 강제 다크 스테이지 = 야간 가산 광 규약
        FXP.gainBoost = 1.0;
        setSurfaces(null);
        // 직교 편집 카메라는 40m 거리 — 씬 안개(9~20m)가 바닥을 전부 삼킨다 → 편집 중 차단
        if (scene.fog) { this._fog = scene.fog; scene.fog = null; }
        scene.background = new THREE.Color(0x14181F);   // 캔버스 스테이지 차콜 (피그마 다크 보드)
        if (dayBtn) dayBtn.style.display = 'none';   // 강제 다크와 싸우는 유일한 컨트롤 봉인
      },
      /** 유저의 실제 주간/투사면 상태 재적용 (편집 중 '실물 배경으로 확인' + 편집 종료) */
      applyUser() {
        if (this._fog) { scene.fog = this._fog; this._fog = null; }   // setDaylight가 fog 색을 만지므로 선복원
        dayOn = !!designStore.globalGet('fx', 'day', true);
        applyDay();
        const bg = designStore.globalGet('fx', 'lab', null)?.bg;
        setSurfaces(!bg || bg === 'none' ? null : bg);
      },
      exit() {
        this.active = false;
        this.applyUser();
        if (dayBtn) dayBtn.style.display = '';
      },
    };
    const overlay = document.getElementById('fxlab-overlay');
    const frame = document.getElementById('fxlab-frame');
    let lastJson = savedLab ? JSON.stringify(savedLab) : '';
    let saveTimer = null;
    openFxLab = () => {
      if (!frame.src) frame.src = `${BASE}fxlab.html`;   // 최초 열 때 로드
      overlay.style.display = 'block';
    };
    document.getElementById('studio-look')?.addEventListener('click', openFxLab);
    document.getElementById('fxlab-close')?.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    window.addEventListener('message', ev => {
      const d = ev.data;
      if (d?.type === 'fxlab-ready') {
        const labInit = { ...(designStore.globalGet('fx', 'lab', null) || {}) };
        labInit.sys = {   // 시스템 설정 현재값 — 랩이 이어서 편집
          roles: Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')])),
          tcfg: { fillOpacity: TCFG.fillOpacity, previewEdge: TCFG.previewEdge, cdContractFrom: TCFG.cdContractFrom, cdGain: TCFG.cdGain, lingerEdge: TCFG.lingerEdge, linger: TCFG.linger },
          scfg: { a1Rep: SCFG.a1Rep, a2Hold: SCFG.a2Hold, a3Swing: SCFG.a3Swing, a4Beat: SCFG.a4Beat, b1Beat: SCFG.b1Beat, b2Beat: SCFG.b2Beat, b3Step: SCFG.b3Step, b4Beat: SCFG.b4Beat },
        };
        frame.contentWindow?.postMessage({ type: 'fxlab-init', state: labInit }, '*');
      } else if (d?.type === 'fxlab-state') {
        if (overlay.style.display !== 'block') return;   // 닫힌 랩의 주기 전송 무시
        const json = JSON.stringify(d.state);
        if (json === lastJson) return;
        lastJson = json;
        applyLabState(d.state);
        updateSurfChips(d.state?.bg || 'none');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { designStore.globalSet('fx', 'lab', d.state); designStore.save(); }, 400);
      }
    });
  }

  // 시스템 설정(판정색·지오메트리·세션 타이밍·프리셋)은 v6.2에서 FX Lab으로 이관 — 브리지 st.sys 참조
  refreshEditorStages = () => { if (studioActive) renderCutBoard(); };

  // 제작자 모드 에셋 드롭인 은퇴 (v12.2) — 룩 시스템 이전 시대의 검수 도구.
  // 드롭 아트가 setArt로 MARK 상태 셰이더를 꺼버려 토큰 원칙과 충돌했음.
  // 대체: 발형 SVG=룩 글리프 FOOT 슬롯 · 마크 형태=MARK 토큰 · 토큰별 아트=스튜디오 디자인.
  // 화면 드래그는 이제 무동작 (실수 드롭이 장면을 바꾸는 사고 방지).
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  // ── NEWTON Studio — 2D 저작 캔버스 (러닝 지면 수직 슬라이스) ──
  let studioActive = false;
  let studioDoc = null, studioCanvas = null, studioProps = null, studioPlayingWas = true;
  let studioRebuildTimer = null;
  const studioEl = document.getElementById('studio');
  const studioCanvasEl = document.getElementById('studio-canvas');

  // 에디터 v3 Phase A — 라이브 3D 뷰에서 직접 선택·드래그 (피그마 모델)
  const editor3d = createEditor3D({
    dom: renderer.domElement, tokens,
    getCamera: () => (studioActive ? editCam : camera),
    getControls: () => (studioActive ? editControls : controls),
    getDoc: () => studioDoc,
    onEdit: () => scheduleStudioRebuild(),
    // 장면(컷) 스코프일 때 3D에서 세션 요소(글자·링·화살표…)를 직접 선택·드래그
    getScene: () => (studioActive && studioScope === 'scene' && sceneScope.stageId) ? { scope: sceneScope, session } : null,
    onSceneChange: (phase) => {
      if (phase !== 'drag') { renderScopeProps(); fillLayers(); }   // 드래그 중엔 패널 재렌더 생략
      if (phase === 'text') {                    // 더블클릭 = 글자 바로 편집
        const t = document.getElementById('sc-text');
        if (t) { t.focus(); t.select(); }
      }
    },
  });

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
    // saveStudio 은퇴(v15) — 팩 손편집 저장 경로 자체를 제거(위 부팅 정화 참조)
    editor3d.syncSelection();  // 리빌드로 마커가 새로 생겼으니 3D 선택 윤곽 재적용
  }
  function scheduleStudioRebuild() {
    clearTimeout(studioRebuildTimer);
    studioRebuildTimer = setTimeout(() => { if (studioDoc) rebuildPack(studioSport, studioDoc.toPack()); }, 110);
  }

  // 편집 보드 — 평면도의 "아트보드": 차콜 맷 + 0.5m 그리드 + 깊이 눈금(m·s)
  const editBoard = new THREE.Group();
  editBoard.visible = false;
  scene.add(editBoard);
  function buildEditBoard(box) {
    editBoard.clear();
    const margin = 1.2;
    const w = box.max.x - box.min.x + margin * 2, l = box.max.z - box.min.z + margin * 2;
    const size = Math.max(w, l);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: 0x1A1F27 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(cx, 0.003, cz);
    editBoard.add(mat);
    const grid = new THREE.GridHelper(size, Math.max(2, Math.round(size * 2)), 0x323A47, 0x252B35);
    grid.position.set(cx, 0.005, cz);
    editBoard.add(grid);
    // 깊이 눈금 — 1m마다 "Nm · Ns" (러닝: 시간=거리/V — 평면도가 곧 타임라인)
    const L = tokens.layout;
    const V = L?.mode === 'advance' ? L.V : null;
    const pxPerM = 96;
    const stripW = 1.6;                          // 눈금 스트립 실폭 (m)
    const cv = document.createElement('canvas');
    cv.width = Math.round(stripW * pxPerM); cv.height = Math.max(64, Math.round(l * pxPerM));
    const ctx = cv.getContext('2d');
    ctx.font = '500 15px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    const zTop = cz - l / 2;   // 캔버스 top = 전방(먼 쪽)
    for (let k = Math.ceil(-(zTop + l)); k <= Math.floor(-zTop); k++) {
      if (k < 0) continue;
      const y = (-k - zTop) * pxPerM;
      ctx.fillStyle = 'rgba(120,132,150,.5)';
      ctx.fillRect(cv.width - 16, y - 1, 16, 2);
      ctx.fillStyle = 'rgba(150,162,180,.75)';
      ctx.textAlign = 'right';
      ctx.fillText(`${k}m${V ? ` · ${Math.max(0, (k - 0.15) / V).toFixed(1)}s` : ''}`, cv.width - 22, y);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(stripW, l),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    strip.rotation.set(-Math.PI / 2, 0, 0);   // 화면 위 = 전방 정렬 (편집 카메라 기준 정방향 텍스트)
    strip.position.set(box.min.x - 0.55 - stripW / 2, 0.007, cz);   // 콘텐츠 왼쪽 바깥
    editBoard.add(strip);
  }

  /** 직교 정면 프레이밍 — 바닥=평면도(화면 위=전방), 벽=정면도. 회전 없음. */
  function frameEditView() {
    const wallMode = (studioScope === 'scene') ? !!sceneScope.wall : studioSport === 'boxing';
    const aspect = window.innerWidth / window.innerHeight;
    let halfH, halfW;
    if (wallMode) {
      const wc = rig._wallCenter || { cx: 0, cy: 1.4 };
      const w = rig.wallW || 3.4, h = rig.wallH || 2.4;
      editBoard.visible = false;
      halfH = Math.max(h / 2 + 0.4, (w / 2 + 0.6) / aspect);
      halfW = halfH * aspect;
      const dwL = document.getElementById('studio')?.offsetWidth || 0;
      const dwR = document.getElementById('inspector')?.offsetWidth || 0;
      const shift = (((dwL - dwR) / 2) * 2 * halfW) / window.innerWidth;   // 좌우 드로어 사이 중앙
      editCam.up.set(0, 1, 0);
      editCam.position.set(wc.cx - shift, wc.cy, WALL_Z + 40);
      editControls.target.set(wc.cx - shift, wc.cy, WALL_Z);
    } else {
      const box = new THREE.Box3();
      if (studioScope === 'scene' && sceneScope.stageId) {
        for (const { o } of session.sceneElements(sceneScope.stageId)) if (o.visible) box.expandByObject(o);
      } else box.setFromObject(tokens.floorRoot);
      if (box.isEmpty()) { box.min.set(-2, 0, -5); box.max.set(2, 0, 1); }
      buildEditBoard(box);
      editBoard.visible = studioActive;
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      halfH = Math.max(size.z / 2 + 1.4, (size.x / 2 + 1.4) / aspect, 2.2);
      halfW = halfH * aspect;
      const dwL = document.getElementById('studio')?.offsetWidth || 0;
      const dwR = document.getElementById('inspector')?.offsetWidth || 0;
      const shift = (((dwL - dwR) / 2) * 2 * halfW) / window.innerWidth;
      editCam.up.set(0, 0, -1);                              // 화면 위 = 전방(-Z) — 러너 진행 방향
      editCam.position.set(c.x - shift, 40, c.z);
      editControls.target.set(c.x - shift, 0, c.z);
    }
    editCam.left = -halfW; editCam.right = halfW; editCam.top = halfH; editCam.bottom = -halfH;
    editCam.zoom = 1;
    editCam.updateProjectionMatrix();
    editControls.update();
  }
  const studioTopView = frameEditView;   // 기존 호출부 호환
  window.addEventListener('resize', () => { if (studioActive) frameEditView(); });

  // ── 스코프: [토큰] = 팩 MARK / [장면] = 스테이지 GUI 요소 ──
  // 진입점·캔버스·속성 패널은 하나. 스코프가 '무엇을 편집 중인가'만 바꾼다.
  let studioScope = 'pack';
  const propsHost = () => document.getElementById('studio-props');
  const seg = (b, on) => {
    b.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
    b.style.background = on ? 'rgba(250,48,48,.16)' : 'var(--panel2)';
    b.style.color = on ? 'var(--accent)' : 'var(--text)';
  };
  /** '이 컷' 카드 — 현재 스테이지의 지속·멘트를 컷 단위로 편집 (레거시 스테이지 타임라인 이관) */
  function buildCutCard() {
    const st = (session.stagesFor(studioSport) || []).find(x => x.id === sceneScope.stageId);
    if (!st) return null;
    const el = document.createElement('div');
    el.style.cssText = 'margin:8px 14px 0;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);';
    // 설계문서의 컷 메타 어휘 그대로: VOICE(편집) · HAPT · WEAR · CUE · FOOT
    const metaRow = (k, v, tone) => v ? `<div style="display:flex;gap:7px;margin-top:4px;font-size:10px;line-height:1.45;">
        <span style="flex:0 0 34px;color:${tone};font-weight:700;letter-spacing:.3px;">${k}</span>
        <span style="color:var(--dim);">${v}</span></div>` : '';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:11.5px;color:var(--text);font-weight:700;">🎬 이 컷 · ${st.id.replace('BX_', '')}</span>
        <span style="display:flex;gap:5px;align-items:center;font-size:10px;color:var(--dim);">지속
          <input id="cut-dur" type="number" step="0.5" placeholder="auto" value="${st.dur ?? ''}" style="width:52px;padding:3px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:4px;font-size:11px;">s</span>
      </div>
      <div style="display:flex;gap:7px;align-items:center;font-size:10px;">
        <span style="flex:0 0 34px;color:#FA3030;font-weight:700;letter-spacing:.3px;">VOICE</span>
        <input id="cut-voice" type="text" value="${(st.voice?.[1] || '').replace(/"/g, '&quot;')}" placeholder="코치 멘트" style="flex:1;padding:4px;background:var(--panel);color:var(--dim);border:1px solid var(--line);border-radius:4px;font-size:10.5px;">
      </div>
      <div id="cut-voice-msg" style="text-align:right;color:#ffc94d;font-size:9px;visibility:hidden;">🔊 멘트 재생성 필요</div>
      ${metaRow('HAPT', st.hap, '#FEC389')}
      ${metaRow('WEAR', st.wear, '#d1feff')}
      ${metaRow('CUE', st.cue, '#FE6E3C')}
      ${metaRow('FOOT', st.foot, '#d1feff')}`;
    el.querySelector('#cut-dur').addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v > 0) st.dur = v; else if (e.target.value === '') delete st.dur;
    });
    el.querySelector('#cut-voice').addEventListener('input', e => {
      if (st.voice) { st.voice[1] = e.target.value; el.querySelector('#cut-voice-msg').style.visibility = 'visible'; }
      renderCutBoard();   // 지속·멘트가 카드 메타에도 반영
    });
    return el;
  }
  function renderScopeProps() {
    if (studioScope !== 'scene') return;
    sceneScope.getCutEl = () => buildCutCard();
    sceneScope.renderProps(propsHost(), () => { renderScopeProps(); fillLayers(); });
  }

  // ── 룩 편집 = FX Lab 전체 페이지 (유저 확정 — 프리뷰 셀이 있는 그 페이지가 룩의 본진) ──
  const inspTab = 'design';   // 인스펙터는 디자인 전용, 룩 버튼은 런처
  document.getElementById('insp-tab-look')?.addEventListener('click', () => openFxLab());

  // ── 컷 보드 — 설계문서의 컷 카드처럼: 미니 평면 다이어그램 + 지속 + 시그널 배지 ──
  const CUT_TONE = { R: '#9aa4b2', A: '#FEC389', T: '#D1FEFF', B: '#FE6E3C', C: '#FA3030' };
  /** 컷 썸네일 — 스테이지 요소(발자국·링·글자…)를 설계문서식 미니 다이어그램으로 */
  function drawCutThumb(cv, stageId) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#14181F';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80,92,110,.28)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 14) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 14) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    const els = session.sceneElements(stageId).filter(e => e.o.visible !== false);
    if (!els.length) {
      ctx.fillStyle = 'rgba(140,150,165,.5)';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('요소 없음', W / 2, H / 2);
      return;
    }
    // 면 판정: 평균 높이가 크면 벽면(x·y), 아니면 지면(x·z — 위=전방)
    const avgY = els.reduce((a, e) => a + Math.abs(e.o.position.y), 0) / els.length;
    const wall = avgY > 0.4;
    const pts = els.map(e => wall ? { x: e.o.position.x, v: -e.o.position.y } : { x: e.o.position.x, v: e.o.position.z });
    let minX = Infinity, maxX = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p2 of pts) { minX = Math.min(minX, p2.x); maxX = Math.max(maxX, p2.x); minV = Math.min(minV, p2.v); maxV = Math.max(maxV, p2.v); }
    const spanX = Math.max(0.8, maxX - minX), spanV = Math.max(0.8, maxV - minV);
    const sc = Math.min((W - 26) / spanX, (H - 22) / spanV);
    const px = p2 => ({ x: W / 2 + (p2.x - (minX + maxX) / 2) * sc, y: H / 2 + (p2.v - (minV + maxV) / 2) * sc });
    els.forEach((e, i) => {
      const p2 = px(pts[i]);
      const t = e.el.type || 'mesh';
      ctx.strokeStyle = lutColor(0.32); ctx.fillStyle = lutColor(0.32); ctx.lineWidth = 1.6;
      if (t === 'foot' || (t === 'group' && (e.el.parts || []).includes('foot'))) {
        ctx.beginPath(); ctx.ellipse(p2.x, p2.y + 1.5, 3.2, 4.4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(p2.x, p2.y - 4.6, 2.1, 1.7, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (t === 'ring' || t === 'arc') {
        ctx.beginPath(); ctx.arc(p2.x, p2.y, 5.5, t === 'arc' ? Math.PI * 0.15 : 0, t === 'arc' ? Math.PI * 0.85 : Math.PI * 2); ctx.stroke();
      } else if (t === 'arrow') {
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y + 5); ctx.lineTo(p2.x, p2.y - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p2.x - 3, p2.y - 2); ctx.lineTo(p2.x, p2.y - 6); ctx.lineTo(p2.x + 3, p2.y - 2); ctx.fill();
      } else if (t === 'text') {
        ctx.fillStyle = 'rgba(255,243,220,.9)';
        ctx.font = '600 8px -apple-system, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(e.el.content || '텍스트').slice(0, 8), p2.x, p2.y);
      } else {
        ctx.strokeRect(p2.x - 4, p2.y - 4, 8, 8);
      }
    });
  }
  /** 루프(팩) 썸네일 — 마크 트랙 미니 평면도 */
  function drawPackThumb(cv) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#14181F'; ctx.fillRect(0, 0, W, H);
    const marks = studioDoc?.marks || [];
    if (!marks.length) return;
    const depth = m => (tokens.layout?.mode === 'advance') ? m.t * (tokens.layout.V || 2.5) : (m.ny ?? 0);
    let maxD = 0.8; for (const m of marks) maxD = Math.max(maxD, depth(m));
    ctx.strokeStyle = 'rgba(250,48,48,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2, 4); ctx.lineTo(W / 2, H - 4); ctx.stroke();   // 레인
    for (const m of marks) {
      const x = W / 2 + m.nx * (W * 0.34);
      const y = H - 8 - (depth(m) / maxD) * (H - 16);    // 위=전방
      ctx.strokeStyle = lutColor(0.32); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }
  function renderCutBoard() {
    const host = document.getElementById('cut-board');
    if (!host) return;
    const stages = session.stagesFor(studioSport) || [];
    const cur = studioScope === 'scene' ? sceneScope.stageId : 'pack';
    host.innerHTML = '';
    const mkCard = (key, tone, top, title, meta, badges) => {
      const b = document.createElement('button');
      b.className = 'cutcard';
      b.dataset.cut = key;
      const on = cur === key;
      b.style.cssText = `flex:0 0 auto;display:flex;flex-direction:column;gap:3px;padding:6px 7px 5px;border-radius:8px;cursor:pointer;width:118px;text-align:left;
        border:1px solid ${on ? tone : 'var(--line)'};background:${on ? 'rgba(255,255,255,.06)' : 'var(--panel2)'};`;
      b.innerHTML = `
        <span style="display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:9px;font-weight:700;letter-spacing:.4px;color:${tone};">${top}</span>
          <span style="font-size:8.5px;color:var(--dim);">${meta}</span>
        </span>
        <canvas width="104" height="58" style="width:104px;height:58px;border-radius:4px;display:block;"></canvas>
        <span style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <span style="font-size:9.5px;color:${on ? 'var(--text)' : 'var(--dim)'};line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
          <span style="font-size:8px;flex:none;">${badges}</span>
        </span>`;
      b.addEventListener('click', () => selectCut(key));
      host.appendChild(b);
      return b.querySelector('canvas');
    };
    // 루프 카드
    drawPackThumb(mkCard('pack', 'var(--accent)', '루프', '토큰 트랙', `${studioDoc?.marks?.length ?? 0}마크`, ''));
    // 세션 컷 카드 — 설계문서처럼: 다이어그램 + 지속 + 시그널
    for (const st of stages) {
      const tone = CUT_TONE[st.id.replace('BX_', '')[0]] || '#9aa4b2';
      const [top, ...rest] = (st.label || st.id).split(' — ');
      const badges = [st.voice && '🔊', st.hap && '📳', st.wear && '⌚', st.cue && '✨', st.foot && '👣'].filter(Boolean).join('');
      drawCutThumb(mkCard(st.id, tone, st.id.replace('BX_', ''), (rest.join(' — ') || top), st.dur ? `${st.dur}s` : 'auto', badges), st.id);
    }
  }
  function selectCut(key) {
    if (key === 'pack') setScope('pack');
    else { setScope('scene', key); }
    studioTopView();
  }

  // ── 레이어 패널 — 현재 컷의 컴포넌트 목록 (클릭=선택, 피그마 레이어) ──
  function fillLayers() {
    const host = document.getElementById('scene-layers');
    if (!host) return;
    if (studioScope !== 'scene' || !sceneScope.stageId) { host.style.display = 'none'; return; }
    host.style.display = 'flex';
    const items = sceneScope.items();
    host.innerHTML = items.length ? items.map(it => `
      <button class="lyr" data-key="${it.key}" style="display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:5px;cursor:pointer;text-align:left;
        border:1px solid ${it.sel ? 'var(--accent)' : 'transparent'};background:${it.sel ? 'rgba(250,48,48,.12)' : 'transparent'};">
        <span style="font-size:11px;width:16px;text-align:center;">${it.glyph}</span>
        <span style="font-size:11px;color:${it.sel ? 'var(--text)' : 'var(--dim)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${it.label}</span>
      </button>`).join('')
      : '<div style="font-size:10.5px;color:var(--dim);padding:4px 8px;">이 컷에는 편집 요소가 없어요 — 위 ＋버튼으로 추가</div>';
    host.querySelectorAll('.lyr').forEach(b => b.addEventListener('click', () => {
      sceneScope.pick(Number(b.dataset.key));
      refreshSceneSel();
    }));
  }
  /** 장면 선택 변경을 모든 뷰(3D 링·레이어·속성·2D)에 전파 — 하나의 선택 */
  function refreshSceneSel() {
    renderScopeProps();
    fillLayers();
    editor3d.syncSelection();
  }

  function setScope(scope, stageId) {
    if (!studioActive) return;
    studioScope = scope;
    const scene = scope === 'scene';
    document.getElementById('studio-palette').style.display = scene ? 'none' : 'flex';
    document.getElementById('studio-scene-palette').style.display = scene ? 'flex' : 'none';
    const tip = document.getElementById('studio-tip');
    if (tip && scene) tip.style.display = 'none';

    // 두 패널이 같은 호스트를 공유한다 — doc.onChange가 장면 패널을 덮어쓰지 않도록
    // 토큰 패널은 장면 스코프에서 아예 파괴한다.
    if (scene) {
      studioProps?.destroy(); studioProps = null;
      if (sceneScope.sport !== studioSport) sceneScope.setSport(studioSport);
      if (stageId && stageId !== sceneScope.stageId) sceneScope.setStage(stageId);
      else if (!sceneScope.stageId) sceneScope.setSport(studioSport);
    } else {
      sceneScope.leave();
      if (!studioProps) {
        studioProps = new StudioProps(propsHost(), studioDoc, {
          onEdit: scheduleStudioRebuild,
          onPreviewBurst: (mark) => { rebuildPack(studioSport, studioDoc.toPack()); tokens.studioBurst(mark); },
        });
      }
    }
    // 장면 컷 = 그 장면만 미리보기 (팩 트랙·봇이 가리지 않게) — 설계문서 컷 원칙
    tokens.root.visible = !scene;
    xbot.group.visible = !scene;
    // 2D 트랙 캔버스 은퇴 — 직교 평면도 + 깊이 눈금(m·s)이 그 역할을 본화면에서 수행
    const wrap = document.getElementById('studio-canvas-wrap');
    if (wrap) wrap.style.display = 'none';
    const layersEl = document.getElementById('scene-layers');
    if (layersEl) layersEl.style.maxHeight = '40vh';
    renderCutBoard();
    fillLayers();
    if (scene) renderScopeProps();
    editor3d.syncSelection();
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
  document.querySelectorAll('.stsp').forEach(b => b.addEventListener('click', () => switchStudioSport(b.dataset.sport)));
  document.querySelectorAll('.stadd').forEach(b => b.addEventListener('click', () => {
    if (studioScope !== 'scene' || !sceneScope.stageId) return;
    const spec = { kind: b.dataset.k, props: {} };
    if (!session.createElement(sceneScope.stageId, spec)) return;   // 벽면에 화살표/발 등 불가 조합
    designStore.stageStore(sceneScope.stageId).added.push(spec);
    saveScenes();
    // 새 요소 즉시 선택 — 넣자마자 만질 수 있게
    sceneScope.pick(sceneScope.items().length - 1);
    refreshSceneSel();
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
      onTool: t => { setStudioToolUI(t); editor3d.setTool?.(t); },   // 3D·2D 도구 동기
      getWindow: () => null,                   // 러닝 창은 러너와 함께 이동 — 고정 밴드 미표시(정직)
    });
    studioProps = new StudioProps(document.getElementById('studio-props'), studioDoc, {
      onEdit: scheduleStudioRebuild,
      onPreviewBurst: (mark) => { rebuildPack(studioSport, studioDoc.toPack()); tokens.studioBurst(mark); },
    });
    // 안내 팁: 토큰을 처음 고르면 사라짐
    const tipEl = document.getElementById('studio-tip');
    if (tipEl) { tipEl.style.display = 'block'; studioDoc.onChange(d => { tipEl.style.display = d.selection ? 'none' : 'block'; }); }
    // 3D 직접 편집: 어디서 선택하든(3D·2D·속성) 윤곽 동기
    studioDoc.onChange((d, reason) => { if (['select', 'load', 'remove', 'add', 'undo', 'redo'].includes(reason)) editor3d.syncSelection(); });
    editor3d.setEnabled(true);
    stageDark?.enter();                        // 편집 = 통제된 다크 스테이지 (가산광 전제)
    setRenderCamera(editCam);                  // 편집 = 직교 정면 뷰 (회전 없음, 팬/줌만)
    controls.enabled = false;
    editControls.enabled = true;
    bgPreviewOn = false; syncBgPreviewBtn();
    rebuildPack(studioSport, studioDoc.toPack());        // layoutPreview 반영 리빌드(클리핑 해제)
    studioScope = 'pack';
    document.querySelectorAll('.stsp').forEach(b => seg(b, b.dataset.sport === studioSport));
    document.getElementById('studio-palette').style.display = 'flex';
    document.getElementById('studio-scene-palette').style.display = 'none';
    renderCutBoard();
    fillLayers();
    studioEl.style.display = 'flex';
    document.getElementById('inspector').style.display = 'flex';
    // 저작 포커스 모드: 좌측 컨트롤 패널 숨김 → 3D 프리뷰에 공간 확보 (캔버스 | 3D 스플릿)
    document.getElementById('panel').style.display = 'none';
    resize();
    studioCanvas.refresh();   // 드로어가 보인 뒤 실제 크기 반영 (RO 타이밍 비의존)
    studioTopView();
  }
  // ☀️ 실물 배경으로 확인 — 편집 중 유저의 주간/투사면 상태를 잠깐 적용
  let bgPreviewOn = false;
  function syncBgPreviewBtn() {
    const b = document.getElementById('studio-bgpreview');
    if (!b) return;
    b.style.borderColor = bgPreviewOn ? '#fec389' : 'var(--line)';
    b.style.color = bgPreviewOn ? '#fec389' : 'var(--dim)';
  }
  document.getElementById('studio-bgpreview')?.addEventListener('click', () => {
    if (!studioActive || !stageDark) return;
    bgPreviewOn = !bgPreviewOn;
    if (bgPreviewOn) stageDark.applyUser();
    else stageDark.enter();
    syncBgPreviewBtn();
  });

  function exitStudio() {
    if (!studioActive) return;
    studioActive = false;
    editor3d.setEnabled(false);
    stageDark?.exit();
    setRenderCamera(camera);
    editControls.enabled = false;
    controls.enabled = true;
    editBoard.visible = false;
    tokens.root.visible = true;
    xbot.group.visible = true;
    if (studioScope === 'scene') sceneScope.leave();   // 스테이지 프리뷰 해제
    studioScope = 'pack';
    studioCanvas?.destroy(); studioCanvas = null;
    studioProps?.destroy(); studioProps = null; studioDoc = null;
    tokens.layoutPreview = false;
    tokens.setParams({ maxVisible: Number(document.getElementById('s-count').value) || 3 });
    studioEl.style.display = 'none';
    document.getElementById('inspector').style.display = 'none';
    document.getElementById('panel').style.display = 'flex';
    // 캔버스 리사이즈 강제 — 편집 중 전체 폭으로 커진 캔버스가 남아 부모가 뷰포트보다 넓어지고,
    // 우측 앵커 버튼들(👁·☀️·설계·편집)이 화면 밖으로 밀려 '장면 명세만 남는' 버그
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
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
    btn.addEventListener('click', () => { setStudioToolUI(btn.dataset.tool); studioCanvas?.setTool(btn.dataset.tool); editor3d.setTool(btn.dataset.tool); });
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

  // 🎬 모션 미리보기 — 이식된 실측 클립을 첫 화면에서 바로 재생 (콘솔 불필요)
  {
    const CLIPS = [
      ['lb_dribble', '★★ 르브론 드리블 (Sketchfab·mixamorig 네이티브)'],
      ['bp_dribble', '★★ 드리블 루프 2 (Sketchfab·네이티브 1.6s)'],
      ['bl_crossover', '(검증용) 코르크스크류 플립 — 곡예, 농구 아님 (Fab→Blender)'],
      ['cmu_dribble_fwd', '★★ 전진 드리블 (CMU 06_02·이동)'],
      ['cmu_dribble_back', '★★ 후진 드리블 (CMU 06_06·이동)'],
      ['cmu_dribble_side', '★★ 사이드 드리블 (CMU 06_08·이동)'],
      ['mf_dribble', '★ 농구 드리블 10s (Motifect)'],
      ['mf_block', '★ 블록 점프 — 수비 (Motifect)'],
      ['mf_chest_pass', '★ 체스트 패스 (Motifect)'],
      ['mf_sprint_start', '★ 스프린트 스타트 — 전진 (Motifect·이동)'],
      ['rk_stepback', '★ 스텝백 튜토리얼 (Rokoko AI 모캡·이동)'],
      ['quadStretch', '쿼드 스트레치 (실사 영상)'],
      ['hj_legswing', '레그 스윙 (햇지런 영상)'],
      ['hj_jjack', '점핑잭 (햇지런 영상)'],
      ['hj_squat', '스쿼트 (햇지런 영상)'],
      ['hj_sidelunge', '사이드 런지 (햇지런 영상)'],
      ['hj_kneehug', '니 허그 (햇지런 영상)'],
      ['hj_sidebend', '사이드 밴드 (햇지런 영상)'],
      ['cmu_stretch', '전신 풀기 (CMU)'],
      ['jumpingJacks', '점핑잭 (Mixamo)'],
      ['sfu_jumprope', '줄넘기 (SFU 무료)'],
      ['sfu_jogging', '조깅 (SFU 무료·이동)'],
      ['stomp_press', '스톰프 프레스 — 원 꾹 밟기 (Mixamo 합성)'],
      ['jogging', '조깅 (Mixamo)'],
      ['bkBlock', '농구 점프 블록 (Mixamo)'],
      ['neckStretch', '목 스트레칭 (Mixamo)'],
      ['armStretch', '팔 스트레칭 (Mixamo)'],
      ['airSquat', '에어 스쿼트 (Mixamo)'],
      ['cmu_stretch2', '스트레칭 2 (CMU 77_21)'],
      ['cmu_stretch3', '스트레칭 3·장편 (CMU 83_22)'],
      ['cmu_warmup_routine', '워밍업 루틴 44s (CMU 14_06)'],
      ['cmu_dribble_low', '로우 드리블 (CMU)'],
      ['cmu_crossover_shot', '크로스오버+슛 (CMU)'],
      ['cmu_crossover_turn', '크로스오버+90°턴 드리블 (CMU·이동)'],
      ['cmu_dribble_shot', '드리블→슛 (CMU)'],
      ['mf_jump_shot', '점프샷 (Motifect)'],
      ['mf_layup', '레이업 (Motifect)'],
      ['mf_marathon', '마라톤 런 (Motifect)'],
      ['mf_boxing_footwork', '복싱 풋워크 (Motifect·이동)'],
    ];
    // 대량 리타겟 자동 노출 (assets/mocap/auto/auto-manifest.json)
    try {
      const aman = (await import('../assets/mocap/auto/auto-manifest.json')).default;
      for (const [nm, meta] of Object.entries(aman)) { if (!meta.qaFail) CLIPS.push(['auto_' + nm, `🎞 ${nm} (${meta.cat || 'CMU'} · ${meta.dur}s)`]); }
    } catch (e) {}
    // 인제스트 산출 자동 노출 (assets/imported/manifest.json)
    try {
      const man = (await import('../assets/imported/manifest.json')).default;
      for (const [nm, meta] of Object.entries(man)) CLIPS.push(['imp_' + nm, `📦 ${nm} (이식 · ${meta.rig} · ${meta.dur}s)`]);
    } catch (e) {}
    const sel = document.getElementById('mocap-preview-sel');
    const btn = document.getElementById('mocap-preview-btn');
    if (sel && btn) {
      for (const [k, label] of CLIPS) { const o = document.createElement('option'); o.value = k; o.textContent = label; sel.appendChild(o); }
      btn.addEventListener('click', () => {
        if (xbot.verifyClip) { xbot.setVerify(null); btn.textContent = '▶ 재생'; return; }
        if (!xbot.actions[sel.value]) { btn.textContent = '클립 없음(새로고침)'; setTimeout(() => { btn.textContent = '▶ 재생'; }, 1600); return; }
        stopSession();
        // 어떤 상태(타 종목·일시정지·1인칭)에서 눌러도 보이게 — verify-warmup과 동일 정규화
        if (state.pack !== 'running') document.querySelector('[data-pack=running]')?.click();
        state.playing = true; panel.setPlaying(true);
        xbot.setVerify(sel.value);
        btn.textContent = '⏹ 정지';
      });
      sel.addEventListener('change', () => { if (xbot.verifyClip && xbot.actions[sel.value]) xbot.setVerify(sel.value); });
    }
  }
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
    // 공유 히트 LUT + 세로 그라디언트(위 어둡고 아래로 밝게 — 유저 확정 레퍼런스)
    // 깊이는 보조 변조: 가까운 부위(뻗는 주먹)가 살짝 더 뜨겁게.
    const thermalMat = new THREE.ShaderMaterial({
      uniforms: { zNear: { value: 2.15 }, zFar: { value: 3.45 }, uLUT: { value: getLUT() }, uH: { value: 2.1 } },
      vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        varying float vVZ; varying float vWY;
        void main(){
          #include <skinbase_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vVZ = -mv.z;
          vWY = (modelMatrix * vec4(transformed, 1.0)).y;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vVZ; varying float vWY;
        uniform float zNear, zFar, uH;
        uniform sampler2D uLUT;
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
        void main(){
          float depth = 1.0 - clamp((vVZ - zNear) / (zFar - zNear), 0.0, 1.0);
          float vert = pow(1.0 - clamp(vWY / uH, 0.0, 1.0), 1.6) * 0.96 + 0.03;    // 아래 밝게, 상부 딥레드
          float heat = clamp(vert * 0.9 + (depth - 0.5) * 0.22, 0.0, 1.0);         // 깊이는 ±변조만
          gl_FragColor = vec4(lut(heat), 1.0);
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
    ghostLayer.position.set(-0.55, H * 0.85 / 2, WALL_Z + 0.035);
    ghostLayer.renderOrder = 4;
    if (rig.wallClip) ghostLayer.material.clippingPlanes = rig.wallClip;
    scene.add(ghostLayer);
  }
  // ── A1 바닥 코치 패널 — 션 실사 영상(힉스필드 생성, 그린스크린)을 크로마키로 바닥에 투사.
  //    목 먼저 2바퀴 → 어깨 롤 (10s 루프). 위치·회전은 매 프레임 타이틀 프레임(floorObj) 앵커에 글루.
  // 룩시스템 열화상 코치 패널(A1 목·어깨, A2 런지 공용) — 그린스크린 영상 → 복싱 벽 톤 열화상.
  //   cfg: { src, cropOff, cropScale(세로 크롭 창), w, h, fwd }  crop을 uniform으로 빼 스테이지별 대응.
  const COACH_CFG = {
    A1: { src: 'ready-view/assets/sean_neck_shoulder.webm', cropOff: 0.40, cropScale: 0.58, w: 0.88, h: 0.9, fwd: 0.16 },   // A2 런지와 크기 맞춤(유저: 너무 작음)
    A2: { src: 'ready-view/assets/sean_lunge.webm', cropOff: 0.0, cropScale: 1.0, w: 0.9, h: 0.9, fwd: 0.10 },   // 런지 전신 측면
    A3: { src: 'ready-view/assets/sean_highknee.webm', cropOff: 0.0, cropScale: 1.0, w: 0.9, h: 0.9, fwd: 0.10 },   // 하이니 전신 정면
  };
  const _coaches = {};   // stageId → { video, plane, _fwd }
  function ensureCoach(id) {
    if (_coaches[id]) return _coaches[id];
    const cfg = COACH_CFG[id];
    const video = document.createElement('video');
    video.src = import.meta.env.BASE_URL + cfg.src;   // VP9 — 전 브라우저 디코드
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    video.style.display = 'none'; document.body.appendChild(video);
    video.play().catch(() => {});
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: tex }, uLUT: { value: getLUT() }, uTime: { value: 0 },
        uCropOff: { value: cfg.cropOff }, uCropScale: { value: cfg.cropScale },
        uSat: { value: 1.32 }, uPulse: { value: 0.05 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D map; uniform sampler2D uLUT; uniform float uTime, uCropOff, uCropScale, uSat, uPulse;
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
        vec2 crop(vec2 uv){ return vec2(uv.x, uCropOff + uv.y * uCropScale); }
        float mask1(vec2 uv){ vec3 c = texture2D(map, crop(uv)).rgb; float k = c.g - max(c.r, c.b); return 1.0 - smoothstep(0.04, 0.14, k); }
        float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(ch(i),ch(i+vec2(1,0)),f.x),mix(ch(i+vec2(0,1)),ch(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 uv = vUv;
          vec3 c = texture2D(map, crop(uv)).rgb;
          // 깜빡임 방지는 tickA1Coach의 readyState 게이트가 전담 — 픽셀 검은-discard는 어두운 셔츠·그림자에
          // 구멍을 뚫으므로 제거(유저). 크로마키만: 초록 초과분으로 배경만 판정.
          float m = mask1(uv);
          float mEro = smoothstep(0.30, 0.68, m);
          if (mEro < 0.02) discard;
          // 복싱 벽(138) 딥레드 톤: 방사형 두께 코어 + S커브 대비 + 채도. 맨살 흰색 튐 억제(휘도 0.22·캡·pow1.5)
          float H = clamp(1.18 - length(vec2((uv.x-0.5)*1.35, (uv.y-0.5)*1.02)), 0.0, 1.0);
          float flow = vn(vec2(uv.x*3.2 + sin(uTime*0.4)*0.3, uv.y*2.4 - uTime*0.5));
          H *= 1.0 + (flow - 0.5) * 0.28;
          float dlum = dot(c, vec3(0.299, 0.587, 0.114));
          dlum = smoothstep(0.28, 0.72, dlum);   // 완만한 대비(구 0.34~0.62는 미드톤이 눌려 색이 턱턱 끊김)
          float mIn = smoothstep(0.55, 0.95, m);
          float faceW = smoothstep(0.80, 0.92, uv.y) * (1.0 - smoothstep(0.97, 1.0, uv.y));
          float baseT = clamp(H * 0.74 + (dlum - 0.5) * 0.22 * mIn * (1.0 - faceW), 0.04, 0.90);
          baseT = pow(baseT, 1.5);
          // LUMA PULSE — 휘도를 따라 흐르는 그라디언트 펄스(effect.app 느낌, 뉴턴 LUT 안에서만 이동)
          float pulse = uPulse * sin(uTime * 2.0 - dlum * 7.0);
          // 디더 — 8bit 영상 양자화가 LUT 위에서 밴딩으로 드러나는 것을 픽셀 노이즈로 분해(색 사이 이음)
          float dth = (ch(gl_FragCoord.xy + vec2(uTime, uTime * 1.3)) - 0.5) / 255.0;
          float T = clamp(baseT + pulse + dth, 0.0, 1.0);
          vec3 col = lut(T) * mEro * 1.12;
          float cl = dot(col, vec3(0.299, 0.587, 0.114));
          col = clamp(mix(vec3(cl), col, uSat), 0.0, 1.0);   // 채도 = 마크 LUT와 같은 FXP.sat 소스(인물만 따로 놀던 1.32 상수 은퇴)
          float alpha = mEro * 0.95 * smoothstep(0.0, 0.22, uv.y);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0.015, -1.35);
    plane.visible = false;
    scene.add(plane);
    const co = _coaches[id] = { video, plane, _fwd: new THREE.Vector3(), fwd: cfg.fwd };
    // A1: 코치 영상 위에 회전 큐 2개(drawRotate 룩시스템) — 목(위·작게) + 어깨(아래·크게) 동시에 돌리기 지시.
    if (id === 'A1') {
      const mkCue = (size, x, y) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
        mesh.position.set(x, y, 0.02);   // 부모 로컬: x=좌우, +y=머리쪽, +z=바닥 위로 띄움
        mesh.renderOrder = 30;           // 코치 영상 레이어보다 앞(유저: 판정 토큰이 인물 앞에)
        plane.add(mesh);
        return { g, tex, mesh };
      };
      // 목 1개(중앙·위) + 어깨 작게 2개(좌·우) — 목 돌리고 어깨 돌리는 지시(유저)
      co.rotCues = [mkCue(0.22, 0, 0.19), mkCue(0.15, -0.12, 0.08), mkCue(0.15, 0.12, 0.08)];
      // 어깨 회전 방향 = 좌우 미러(유저 스케치): 왼어깨 반시계 · 오른어깨 시계 (대칭 롤)
      co.rotCues[0].dir = 1; co.rotCues[1].dir = -1; co.rotCues[2].dir = 1;
    }
    return co;
  }
  function tickA1Coach() {
    // 어떤 스테이지 코치를 켤지: A1 = 전 구간, A2 = 진입 후 ~3s 데모(런지 따라하기 전 시범)
    const st = session.active && !session.isLive && state.pack === 'running' ? session.stage : null;
    const showA1 = st === 'A1';
    // 시범 문법: A2/A3 코치 영상은 시범(관찰) 동안만 — 따라하기 = 토큰 전용(작은 투사·초점 하나).
    const showA2 = st === 'A2' && !session._followLatch;
    const showA3 = st === 'A3' && !session._followLatch;
    const activeId = showA1 ? 'A1' : (showA2 ? 'A2' : (showA3 ? 'A3' : null));
    for (const id of ['A1', 'A2', 'A3']) {
      const c = _coaches[id];
      if (id === activeId) {
        const co = ensureCoach(id);
        if (co.video.paused) co.video.play().catch(() => {});
        // 영상 실제 프레임이 들어오기 전엔 숨김 — 검은/균일 텍스처가 크로마키 통과 못 해
        // 빨간 방사형 사각형으로 0.x초 깜빡이던 것 방지(유저). readyState≥3(HAVE_FUTURE_DATA)+재생 시작 후.
        co.plane.visible = co.video.readyState >= 3 && co.video.currentTime > 0.03;
        co.plane.material.uniforms.uTime.value = performance.now() / 1000;
        // 채도는 마크 LUT와 같은 소스(FXP.sat)에서 — 인물·발자국 룩 통일(슬라이더 하나가 둘 다 이동)
        co.plane.material.uniforms.uSat.value = 1.0 + (FXP.sat ?? 1) * 0.32;
        if (co.rotCues) {   // 회전 큐 = 영상 타이밍 동기(유저): 전반(목 돌리기)=목 큐만, 후반(어깨 롤)=어깨 큐 2개만
          const now = performance.now() / 1000;
          const vd = co.video.duration || 10, ct = co.video.currentTime % vd;
          const neckPhase = ct < vd * 0.5;       // 영상 = 목 2바퀴 → 어깨 롤 (절반 분기)
          const shoulderOn = ct > vd * 0.5 + 2;  // 어깨 큐는 분기 +2초 뒤부터(유저)
          co.rotCues.forEach((c, i) => {
            const on = co.plane.visible && (i === 0 ? neckPhase : shoulderOn);
            c.mesh.visible = on;
            if (on) {
              drawRotate(c.g, 256, { r: 0.30, width: 1.1, dir: c.dir ?? 1, sweep: 0.62, tempo: 0.42 },
                { halo: FXP.mark.halo }, now, { lut: lutColor, arrow: FXP.arrow });
              c.tex.needsUpdate = true;
            }
          });
        }
        if (floorObj.visible) {
          co.plane.quaternion.copy(floorObj.quaternion);
          co._fwd.set(0, 1, 0).applyQuaternion(floorObj.quaternion);
          // 시범 = 코치 영상 중앙 크게(초점 하나) — 원래 관찰 배치
          co.plane.scale.setScalar(1);
          co.plane.position.set(floorObj.position.x + co._fwd.x * co.fwd, 0.015, floorObj.position.z + co._fwd.z * co.fwd);
        }
      } else if (c) { c.plane.visible = false; if (!c.video.paused) c.video.pause(); }
    }
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

  // ── 시범 인물 = FX Lab PERSON_FRAG 정본 이식 (인물 — 실사 + 잔상) ──────────
  //    실사 영상(실루엣 촬영: 밝은 배경·검은 인물)에서 움직임만 따오고, 렌더는 룩 시스템
  //    person 언어 그대로: 역키잉 마스크 → 소프트엣지 → 세로 그라디언트(머리 근흑→발 근백)
  //    + 내부 열 대류(fbm) → 공유 히트 LUT. 잔상은 핑퐁 RT 누적(max(cur, prev·decay)) —
  //    랩의 과거 프레임 3탭과 시각 등가. 룩 슬라이더(person.decay/flow) 라이브 소비.
  const demoVideo = document.createElement('video');
  demoVideo.src = import.meta.env.BASE_URL + 'coach_chroma.mp4';   // 'Angry boxer' 그린스크린 (Wavebreak/Magnific 무료)
  demoVideo.muted = true; demoVideo.loop = true; demoVideo.playsInline = true;
  demoVideo.crossOrigin = 'anonymous';
  const demoTex = new THREE.VideoTexture(demoVideo);
  const DPW = 256, DPH = 384;
  // 인물 마스크 = MediaPipe ImageSegmenter (밝기 키잉 은퇴 — 임의 실사에서 인물만 분리).
  // 모델·wasm 로컬 번들(public/models, public/mediapipe-wasm) — 런타임 CDN 의존 없음.
  const demoMaskCanvas = document.createElement('canvas');
  const demoMaskTex = new THREE.CanvasTexture(demoMaskCanvas);
  demoMaskTex.minFilter = THREE.LinearFilter; demoMaskTex.magFilter = THREE.LinearFilter;
  let demoSeg = null, demoSegInit = false, demoSegFail = false;
  async function initDemoSeg() {
    demoSegInit = true;
    try {
      const fileset = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + 'mediapipe-wasm');
      demoSeg = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: import.meta.env.BASE_URL + 'models/selfie_segmenter.tflite' },
        runningMode: 'VIDEO', outputConfidenceMasks: true,
      });
    } catch (e) {
      demoSegFail = true;   // 밝기 키잉 폴백으로 (아래) — 코치가 어떤 환경에서도 뜬다
      console.warn('[코치] 세그 초기화 실패 — 키잉 폴백', e);
    }
  }
  setTimeout(initDemoSeg, 1200);   // 부트 선초기화 — 세션 시작 즉시 코치 등장
  const MASK_GLSL = `
    uniform sampler2D tex;   // 비디오 (그린스크린 소스)
    uniform vec2 uCropC, uCropS;
    float pmask(vec2 uv){
      vec2 vuv = uCropC + (uv - 0.5) * uCropS;
      if (vuv.x < 0.0 || vuv.x > 1.0 || vuv.y < 0.0 || vuv.y > 1.0) return 0.0;
      vec3 c = texture2D(tex, vuv).rgb;
      float k = c.g - max(c.r, c.b);                     // 그린 우세도 — 결정론적 크로마 키
      float m = 1.0 - smoothstep(0.05, 0.16, k);         // 임계값 = 랩 mask1 정본
      m *= smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);
      return m;
    }`;
  const trailRTs = [new THREE.WebGLRenderTarget(DPW, DPH), new THREE.WebGLRenderTarget(DPW, DPH)];
  let trailFlip = 0;
  const trailMat = new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: demoTex }, prev: { value: trailRTs[1].texture }, uDecay: { value: 0.9 },
      uCropC: { value: new THREE.Vector2(0.5, 0.5) }, uCropS: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D prev; uniform float uDecay;
      ` + MASK_GLSL + `
      void main(){
        float m = pmask(vUv);
        float t = max(m, texture2D(prev, vUv).r * uDecay);
        gl_FragColor = vec4(t, 0.0, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const trailQuadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const trailScene = new THREE.Scene();
  trailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMat));
  // 열 필드 = 마스크의 진짜 가우시안 확산 (저해상 128×192, 분리형 3회 반복 — 탭 클럼프 근절)
  const heatRTs = [0, 1].map(() => new THREE.WebGLRenderTarget(128, 192));
  const heatMaskMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: demoTex }, uCropC: { value: new THREE.Vector2(0.5, 0.5) }, uCropS: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv;\n' + MASK_GLSL + '\nvoid main(){ gl_FragColor = vec4(pmask(vUv), 0.0, 0.0, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  const heatBlurMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uStep: { value: 3 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 uDir; uniform float uStep;
      void main(){
        vec2 px = uDir * uStep / vec2(128.0, 192.0);
        float s = texture2D(tex, vUv).r * 0.227;
        s += (texture2D(tex, vUv + px * 1.385).r + texture2D(tex, vUv - px * 1.385).r) * 0.3165;
        s += (texture2D(tex, vUv + px * 3.23).r + texture2D(tex, vUv - px * 3.23).r) * 0.070;
        gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const demoPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.93),   // 세로 카드 (영상 세로 프레이밍)
    new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: demoTex }, uTrail: { value: trailRTs[0].texture }, uHeat: { value: heatRTs[0].texture }, uLUT: { value: getLUT() },
        uTime: { value: 0 }, uNoise: { value: 0.55 }, uW: { value: 1 }, uDetail: { value: 0.62 }, uTrailGain: { value: 1 }, uGrain: { value: 0 }, uTone: { value: 0 }, uLive: { value: 0 },
        uCropC: { value: new THREE.Vector2(0.5, 0.5) }, uCropS: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: `#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`,
      fragmentShader: `#include <common>
#include <clipping_planes_pars_fragment>
        varying vec2 vUv;
        uniform sampler2D uTrail, uLUT, uHeat; uniform float uTime, uNoise, uW, uDetail, uTrailGain, uGrain, uTone, uLive;
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
        ` + FX_GLSL.replace('uniform sampler2D uLUT;', '').replace('vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }', '') + `
        ` + MASK_GLSL + `
        vec3 thermo(float h){
          // 확산 유리 열화상 램프 — 랩 PERSON_FRAG thermo()와 동일 상수 (레퍼런스 확정 2026-07-18)
          h = clamp(h, 0.0, 1.0);
          vec3 c = mix(vec3(0.0), vec3(0.45, 0.01, 0.0), smoothstep(0.08, 0.30, h));
          c = mix(c, vec3(0.90, 0.16, 0.0), smoothstep(0.30, 0.48, h));
          c = mix(c, vec3(1.0, 0.52, 0.0), smoothstep(0.48, 0.60, h));
          c = mix(c, vec3(1.0, 0.93, 0.05), smoothstep(0.60, 0.70, h));
          c = mix(c, vec3(0.25, 0.82, 0.15), smoothstep(0.70, 0.82, h));
          c = mix(c, vec3(0.05, 0.75, 0.70), smoothstep(0.82, 0.95, h));
          return mix(c, vec3(0.45, 0.90, 0.95), smoothstep(0.95, 1.0, h));
        }
        void main(){
          #include <clipping_planes_fragment>
          vec2 uv = vUv;
          float m = pmask(uv);
          float trail = texture2D(uTrail, uv).r * (1.0 - m) * uTrailGain;
          // 열화상 v4: 형태(실루엣)와 온도(확산 필드) 분리 — 몸 테두리 크리스프, 얼굴만 은닉
          float H = texture2D(uHeat, uv).r;
          float flow = fxfbm(vec2(uv.x * 3.2 + sin(uTime * 0.4) * 0.3, uv.y * 2.4 - uTime * 0.5));
          H *= 1.0 + (flow - 0.5) * uNoise * 0.5;
          float T = clamp(H * 1.25, 0.0, 1.0);   // 온도 = 두께 필드
          vec2 dvuv = uCropC + (uv - 0.5) * uCropS;
          float dlum = dot(texture2D(tex, clamp(dvuv, 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
          // 원본 밝기 대비 선보정 = 극대화 (급경사 S-커브: 밝음/어두움을 거의 이진 분리)
          dlum = smoothstep(0.36, 0.60, dlum);
          // 얼굴 대역(상단) = 이목구비 의도적 은닉 — 실사 결 제거 + 강한 확산
          float faceW = smoothstep(0.70, 0.84, uv.y) * (1.0 - smoothstep(0.965, 1.0, uv.y));
          // 실사 결 = 주 텍스처 — 내부 침식 마스크(mIn)로만: 엣지 반투명 픽셀이 그린 배경
          // 밝기를 온도로 읽어 실루엣 둘레에 밝은 테두리가 생기던 것 차단
          float mIn = smoothstep(0.55, 0.95, m);
          T = clamp(T * 0.72 + (dlum - 0.42) * uDetail * 1.5 * mIn * (1.0 - faceW), 0.0, 1.0);
          T = pow(T, 1.38);   // 밀도 대비 — 어두운 부위를 더 깊게 (레퍼런스: 그늘진 팔이 암색으로 잠김)
          T = max(T, trail * 0.6);
          // 형태: 전신 크리스프 실루엣만 — 헤일로·확산 완전 제거 (유저 확정: 그림자 금지)
          // 마스크 침식: 크로마키가 불완전한 클립(비순수 그린 배경)에서 마스크 바닥값(~0.2)이
          // 쿼드 전체를 반투명 워시 박스로 칠하던 근본 원인 — 저신뢰 마스크는 0으로
          float mEro = smoothstep(0.30, 0.68, m);
          float shapeA = mEro * 0.92;   // 알파용 형태 = 실루엣만 (잔상 제외)
          float shape = max(shapeA, trail * 0.5 * smoothstep(0.06, 0.22, trail));
          vec3 col = mix(thermo(T), lut(clamp(T * 0.96, 0.0, 1.0)), uTone) * shape;   // 뉴턴톤 기본 = 룩 팔레트
          float cl = dot(col, vec3(0.299, 0.587, 0.114));
          col = clamp(mix(vec3(cl), col, 1.32), 0.0, 1.0);   // 채도 부스트 — 룩시스템 '쟁한' 고채도 유지
          col += (fxhash(uv * 977.0 + uTime) - 0.5) * (2.0 / 255.0);
          col += (fxhash(uv * 1661.0 + uTime * 3.0) - 0.5) * uGrain;
          // 프레임 원천 제거(유저): 타원 페더 — 잔여 배경·워시가 직선 경계 없이 곡선으로 소멸
          float rE = length(vec2((uv.x - 0.5) * 2.0, (uv.y - 0.5) * 1.84));
          float field = 1.0 - smoothstep(0.88, 1.0, rE);
          col *= field;
          // 프레임 게이트(uLive: CPU에서 비디오 재생 상태) — 블랙/정지/미로드 프레임 기여 0.
          // 픽셀 휘도 게이트는 인물 내부 어두운 부위(그늘·옷)까지 깎아 투명해짐 → 기각(유저)
          float live = uLive;
          // 컴포저 OutputPass(linear→sRGB) 역변환 상쇄 (tokens.js uOut=1 규약)
          col = clamp(col, 0.0, 1.0);
          col = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
          // 잔상 = 순수 가산광 (알파 0 = 절대 어둡게 못 함) — 잔상 구름이 잉크 알파를 갖고
          // 벽을 어둑한 사각으로 덮던 문제('터질 때 박스') 종결. 실루엣만 잉크 불투명.
          gl_FragColor = vec4(col * live, clamp(shapeA * 1.2, 0.0, 1.0) * field * live * 0.985);
        }`,
      transparent: true, depthWrite: false,
      // out = col + dst·(1−a) — 랩의 base·(1−a·0.88)+col 과 동일 (프리멀티 커스텀 블렌딩)
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  demoPanel.rotation.x = -Math.PI / 2;
  demoPanel.position.set(0, 0.016, -1.45);
  demoPanel.renderOrder = 7;   // 인물 = HUD 위 맨 앞 (버튼만 그 위 — 유저)
  demoPanel.visible = false;
  scene.add(demoPanel);
  let demoLastT = 0;
  let demoLiveHold = 0;   // uLive 유예 — 영상 루프 순간 readyState 1프레임 하락에도 인물 유지(깜빡임 방지)
  const demoCrop = { cx: 0.5, cy: 0.5, sx: 1, sy: 1 };
  // 실사 시범 모드: 'off' | 'floor'(러닝 A 시범 — 휴면) | 'wall'(복싱 벽 실사 시험).
  // 실시간 세그 실사는 기각(구멍·플리커·프레임 드랍 — 스톡 다수로 실증). 'wall'은
  // 사전에 매트를 구운 소스(알파 영상/스틸 시퀀스)가 준비된 경우에만 켠다.
  const DEMO_CLIP_MODE = 'wall';   // 크로마 코치 가동 (그린스크린 실사 — Magnific/Freepik 무료)
  const GHOST_H = 1.5;             // 고스트 패널 세로(m) — 벽 1.63m 안 (자취방 스케일). 유저 확정 스케일 유지.
  const GHOST_PAD = 1.22;          // 프레임 여백 배수 — 페더가 인물이 아닌 여백에서만 작동 (유저)
  // ── 스테이지별 고스트 클립 (유저 AI 크로마 소스 반입 지점) ──────────────────
  //    public/ghost/<파일명>에 떨어뜨리면 코드 수정 없이 스테이지 전환 시 자동 교체.
  //    파일 없음(404) → 기본 클립 폴백. 스펙·프롬프트 = docs/ghost-clips.md
  const GHOST_DEFAULT = import.meta.env.BASE_URL + 'coach_chroma.mp4';
  //    맵에 없는 스테이지(BX_T1 전환·BX_FIN 리포트) = 고스트 자체를 안 띄움 (인물 불필요 장면)
  // 10-클립 풀세트 (힉스필드 생성 타겟). 역할 = 혼합: A·B 코치 시범 / C 상대 스파링.
  //   미반입 파일은 자동으로 GHOST_DEFAULT 폴백 → 생성된 mp4를 public/ghost/에 드롭만 하면 반영.
  const GHOST_CLIPS = {
    BX_READY: ['bx_b1_guard.mp4', '대기 — 가드 자세'],
    BX_A1:    ['bx_a1_neck.mp4',    '시범 — 목·어깨 풀기'],
    BX_A2:    ['bx_a2_step.mp4',    '시범 — 스텝 인·아웃'],
    BX_A3:    ['bx_a3_jab.mp4',     '시범 — 잽 폼'],
    BX_B1:    ['bx_b1_guard.mp4',   '시범 — 가드 유지'],
    BX_B2:    ['bx_b2_slip.mp4',    '시범 — 회피 슬립'],
    BX_B3:    ['bx_b3_jab.mp4',     '시범 — 잽 스윕'],
    BX_C2:    ['bx_c2_spar.mp4',    '상대 — 잽 대련'],
    BX_C3:    ['bx_c3_combo.mp4',   '상대 — 잽잽훅 콤비'],
    BX_C4:    ['bx_c4_cooldown.mp4','상대 — 마무리 호흡'],
  };
  let ghostClipCur = '', ghostClipWant = null;
  // 반입 검사: HEAD + content-type — 데브 서버는 없는 파일에 404 대신 index.html(SPA 폴백)을
  // 주므로 미디어 error 이벤트만으론 감지 불가(검정 화면·전면 마스크 회귀의 원인).
  const ghostClipBad = new Set(), ghostClipOk = new Set(), ghostClipChecking = new Set();
  function setGhostClip(stageId) {
    const ent = GHOST_CLIPS[stageId];
    ghostClipWant = ent || null;
    const url = ent ? import.meta.env.BASE_URL + 'ghost/' + ent[0] : GHOST_DEFAULT;
    const tgt = ghostClipBad.has(url) ? GHOST_DEFAULT : url;
    if (tgt !== GHOST_DEFAULT && !ghostClipOk.has(tgt)) {
      if (!ghostClipChecking.has(tgt)) {
        ghostClipChecking.add(tgt);
        fetch(tgt, { method: 'HEAD' })
          .then(r => (r.ok && /video|octet-stream/.test(r.headers.get('content-type') || '') ? ghostClipOk : ghostClipBad).add(tgt))
          .catch(() => ghostClipBad.add(tgt));
      }
      // 검사 완료 전엔 기본 클립 유지 (다음 프레임 호출에서 승격)
      if (ghostClipCur !== GHOST_DEFAULT) { ghostClipCur = GHOST_DEFAULT; demoVideo.src = GHOST_DEFAULT; demoVideo.play().catch(() => {}); }
      return;
    }
    if (tgt === ghostClipCur) return;
    ghostClipCur = tgt;
    demoVideo.src = tgt;
    demoVideo.play().catch(() => {});
  }
  // 소형 미리보기 — 지금 벽에 나가는 원본 클립이 무엇인지 (원본 영상 그대로 + 파일명)
  const ghostPrev = document.createElement('div');
  ghostPrev.style.cssText = 'position:absolute;right:14px;top:196px;z-index:30;display:none;width:158px;background:rgba(14,16,21,.92);border:1px solid #2a2f38;border-radius:10px;padding:8px;box-sizing:border-box';
  demoVideo.style.cssText = 'width:100%;border-radius:6px;display:block;background:#000';
  const ghostPrevLb = document.createElement('div');
  ghostPrevLb.style.cssText = 'margin-top:6px;font-size:10.5px;line-height:1.45;color:#c9ced6;font-family:inherit;word-break:break-all';
  ghostPrev.append(demoVideo, ghostPrevLb);
  document.body.appendChild(ghostPrev);
  demoVideo.addEventListener('error', () => {   // 클립 미반입 → 기본 클립 폴백
    if (ghostClipCur !== GHOST_DEFAULT) {
      ghostClipBad.add(ghostClipCur);
      ghostClipCur = GHOST_DEFAULT; demoVideo.src = GHOST_DEFAULT; demoVideo.play().catch(() => {});
    }
  });
  if (DEMO_CLIP_MODE === 'wall') {
    demoPanel.rotation.x = 0;                          // 벽 = 직립
    // 가상 상대(스파링 고스트) = 전신·실제 키 스케일 — 패널 9:16 세로, 발이 벽 하단에 닿게.
    // 소스 규약: 전신이 다 담긴 크로마 영상(상하 여백 ~10%) → 인물 실높이 ≈ 1.75m.
    // 크롭은 커버핏(9:16 창) — 랩 카드와 같은 인물 프레이밍에 그라디언트가 걸림.
    demoPanel.scale.set(GHOST_H * (9 / 16) / 0.62 * GHOST_PAD, GHOST_H / 0.93 * GHOST_PAD, 1);
    demoVideo.addEventListener('loadedmetadata', () => {
      const A = 9 / 16, va = demoVideo.videoWidth / demoVideo.videoHeight;
      const s = va > A ? [A / va, 1] : [1, va / A];
      trailMat.uniforms.uCropS.value.set(s[0] * GHOST_PAD, s[1] * GHOST_PAD);
      heatMaskMat.uniforms.uCropS.value.set(s[0] * GHOST_PAD, s[1] * GHOST_PAD);
      demoPanel.material.uniforms.uCropS.value.set(s[0] * GHOST_PAD, s[1] * GHOST_PAD);
    });
  }
  function renderDemoPanel() {
    const on = DEMO_CLIP_MODE !== 'off' && session.active
      && (DEMO_CLIP_MODE === 'wall'
        ? state.pack === 'boxing' && !!GHOST_CLIPS[session.curStage?.id]   // 맵에 없는 장면 = 인물 제거
        : (!session.isLive && session.demoActive));
    if (DEMO_CLIP_MODE === 'wall') {
      if (rig.wallClip && demoPanel.material.clippingPlanes !== rig.wallClip)
        demoPanel.material.clippingPlanes = rig.wallClip;   // 투사면 밖 금지 — 벽 클리핑
      // 유저 정면 = 벽 투사 중심 추종 (시선 높이) — 코치를 마주 보고 따라한다
      const wc = rig._wallCenter;
      // 전신 스탠딩: 패널 바닥 = 벽 투사 하단. 반반 미러 스테이지(학습)는 좌측 80%
      // (피그마 WallUI 확정 레이아웃 — 우측은 '내 자세' 슬롯)
      const wallBot = (wc?.cy ?? 1.4) - rig.wallH / 2;
      const mir = HUD_MIRROR.has(session.curStage?.id);   // 수납 크기 유지
      const gsc = mir ? 0.8 : 1;   // 중앙 단독 — 벽을 당당히 채우는 등신 (쿼드 1.57m)
      demoPanel.scale.set(GHOST_H * (9 / 16) / 0.62 * gsc * GHOST_PAD, GHOST_H / 0.93 * gsc * GHOST_PAD, 1);
      demoPanel.position.set((wc ? wc.cx : 0) + (mir ? 0 : 0), wallBot + GHOST_H * gsc / 2 + (mir ? 0.02 : 0.01), WALL_Z + 0.035);
    }
    demoPanel.visible = !!on;
    if (on) setGhostClip(session.curStage?.id);   // 스테이지별 클립 자동 전환 (404 → 기본)
    ghostPrev.style.display = on ? 'block' : 'none';
    if (on && ghostClipWant) {
      ghostPrevLb.style.whiteSpace = 'pre-line';
      const fallback = ghostClipCur === GHOST_DEFAULT;
      ghostPrevLb.textContent = fallback
        ? `🎬 기본 클립 (미반입: ${ghostClipWant[0]})\n${ghostClipWant[1]}`
        : `🎬 ${ghostClipWant[0]}\n${ghostClipWant[1]}`;
    }
    if (on) { if (demoVideo.paused) demoVideo.play().catch(() => {}); }
    else { if (!demoVideo.paused) demoVideo.pause(); return; }
    const now = performance.now() / 1000;
    // 프레임 게이트 — 재생 가능한 살아있는 프레임일 때만 인물 기여 (블랙/정지 = 박스 방지)
    // uLive 게이트: ①올바른 클립일 때만 표시 → 전환 중 기본 클립(근육질 남자) 번쩍 방지
    //   ②올바른 클립이면 루프 순간 readyState 하락에 8프레임 유예 → 깜빡임 제거
    const wantUrl = ghostClipWant ? (import.meta.env.BASE_URL + 'ghost/' + ghostClipWant[0]) : GHOST_DEFAULT;
    const onCorrectClip = (ghostClipCur === wantUrl) || ghostClipBad.has(wantUrl);   // 원하는 클립이거나, 미반입이라 기본 폴백된 경우만
    if (!onCorrectClip) {
      demoLiveHold = 0;   // 전환 중/잘못된 클립 = 즉시 숨김(유예 없음)
    } else {
      const demoLiveNow = (demoVideo.readyState >= 2 && !demoVideo.ended && !demoVideo.paused);
      demoLiveHold = demoLiveNow ? 8 : Math.max(0, demoLiveHold - 1);
    }
    demoPanel.material.uniforms.uLive.value = demoLiveHold > 0 ? 1 : 0;
    if (now - demoLastT < 1 / 45) return;
    demoLastT = now;
    if (demoVideo.readyState < 2) return;
    // 잔상 누적 (핑퐁) — 룩 person.decay 라이브 소비
    // 랩 잔상 시맨틱 등가: 랩은 6.7fps 탭 decay^j — 45Hz 연속 누적으로 환산(decay^(1/5.7)).
    // 0이면 완전 꺼짐 (구 매핑은 바닥 0.62가 있어 랩에서 꺼도 시뮬에 잔상이 남던 버그).
    const pd = FXP.person?.decay ?? 0.6;
    // pd<0.1 = 지각상 꺼짐 — 잔상 경로 완전 차단(하드 0: 1틱 지연 림·엣지 잔광까지 소멸)
    const trailOff = pd < 0.1;
    demoPanel.material.uniforms.uTrailGain.value = trailOff ? 0 : Math.min(1, pd * 2.2);
    trailMat.uniforms.uDecay.value = trailOff ? 0 : Math.pow(pd, 1 / 5.7);
    trailMat.uniforms.prev.value = trailRTs[1 - trailFlip].texture;
    const prevT = renderer.getRenderTarget();
    renderer.setRenderTarget(trailRTs[trailFlip]);
    renderer.render(trailScene, trailQuadCam);
    // 열 필드 확산: 마스크 → 분리형 가우시안 ×3 반복 (128×192)
    const fxQuad = trailScene.children[0];
    fxQuad.material = heatMaskMat;
    renderer.setRenderTarget(heatRTs[0]); renderer.render(trailScene, trailQuadCam);
    heatBlurMat.uniforms.uStep.value = 1.4 + 2.4 * (FXP.person?.blur ?? 1);
    fxQuad.material = heatBlurMat;
    for (let i = 0; i < 3; i++) {
      heatBlurMat.uniforms.tex.value = heatRTs[0].texture; heatBlurMat.uniforms.uDir.value.set(1, 0);
      renderer.setRenderTarget(heatRTs[1]); renderer.render(trailScene, trailQuadCam);
      heatBlurMat.uniforms.tex.value = heatRTs[1].texture; heatBlurMat.uniforms.uDir.value.set(0, 1);
      renderer.setRenderTarget(heatRTs[0]); renderer.render(trailScene, trailQuadCam);
    }
    fxQuad.material = trailMat;
    renderer.setRenderTarget(prevT);
    const PU = demoPanel.material.uniforms;
    PU.uTrail.value = trailRTs[trailFlip].texture;
    PU.uTime.value = now;
    PU.uNoise.value = FXP.person?.flow ?? 0.55;
    PU.uDetail.value = FXP.person?.detail ?? 0.62;
    PU.uW.value = FXP.person?.blur ?? 1;   // 엣지 블러 — 랩 person 슬라이더 (누락돼 기본 1.0으로 돌던 버그)
    PU.uGrain.value = FXP.person?.grain ?? 0;
    PU.uTone.value = FXP.person?.tone ?? 0;
    trailFlip = 1 - trailFlip;
  }

  // ── 벽면 게임 HUD (피그마 WallUI 이식: A·B 학습=반반 미러 룸, C 실전=복싱 링) ──
  //    캔버스 1600×1000 = 벽 3.2×2.0m (500px/m, 피그마 좌표 1:1). 프레임리스 —
  //    발광 요소만(배경·프레임 박스 금지), 검정=투명. 합성·감마 = 고스트 동일 규약(P4).
  const HUDW = 1600, HUDH = 1000;
  // 수치 전용 디스플레이 폰트 — 도트폰트(OffBit) 은퇴(유저) → Supreme으로. 'OffBit' 별칭에 Supreme 파일 로드.
  const offbit = new FontFace('OffBit', `url(${import.meta.env.BASE_URL}fonts/OffBitTrial-DotBold.woff2)`);
  offbit.load().then(f => document.fonts.add(f)).catch(() => {});
  const NUMF = (w, s) => `${w} ${s}px OffBit, Supreme, Pretendard, sans-serif`;
  // 한/영 벽 텍스트 — EN은 Overused Grotesk(모바일 UI 정합), 라틴만 커버라 KO엔 무영향
  for (const [w, f] of [[500, 'OverusedGrotesk-Medium'], [600, 'OverusedGrotesk-SemiBold'], [700, 'OverusedGrotesk-Bold'], [800, 'OverusedGrotesk-Bold'], [900, 'OverusedGrotesk-Bold']]) {
    const ff = new FontFace('Overused', `url(${import.meta.env.BASE_URL}fonts/${f}.ttf)`, { weight: String(w) });
    ff.load().then(x => document.fonts.add(x)).catch(() => {});
  }
  let HUD_LANG = localStorage.getItem('newton-lang') || 'ko';
  const EN_MAP = {
    "0 · 준비": "0 · Ready", "5초 뒤 실전": "Live in 5", "PACK 일치도 — 지난번 +6%": "Pack match — +6% vs last",
    "m — 링에 서기": "m — stand on the ring", "가드 · 거리 재기": "Guard · find range",
    "가드 내리고 숨 고르기": "Guard down — breathe", "가드 박스 안에 주먹 유지 — 링이 찰 때까지": "Keep fists in the box — till the ring fills",
    "가드 올리고 READY": "GUARD UP & READY", "가드 올리기": "Guard up", "가드 유지": "Hold your guard",
    "내 기록": "My count", "내 자세": "My form", "다시보기 — 코치 잽과 내 자세 겹쳐 보기 →": "Replay — overlay coach's jab & my form →",
    "두 번 탭 → 바로": "Tap twice → go now", "두 번 탭 → 익히기": "Tap twice → learn",
    "들숨 — 링 따라 크게": "Inhale — follow the ring", "마무리": "Cool-down", "맞힌 잽": "Jabs landed",
    "목·어깨 돌리기": "Neck & shoulder rolls", "몸 풀렸어요 — 다음: 사전 익히기": "Warmed up — next: learn the moves",
    "몸풀기 1/3": "Warm-up 1/3", "몸풀기 2/3": "Warm-up 2/3", "몸풀기 3/3": "Warm-up 3/3", "몸풀기 끝!": "Warm-up done!",
    "발 두 번 탭해서 시작": "Tap twice to start", "상대 — 맞서세요": "Opponent — square up",
    "섀도복싱 · 잽": "Shadowboxing · Jab", "섀도복싱 · 잽 — 오늘의 결과": "Shadowboxing · Jab — today's result",
    "세션 완료": "Session complete", "스윕 따라 — 열리면 잽": "Follow the sweep — jab the opening",
    "스텝 인·아웃": "Step in & out", "실전 라운드": "Live round", "실전 시작 전": "Before the round",
    "심박 회복": "HR recovery", "심박 회복 132 → 118": "HR recovery 132 → 118",
    "앞뒤 6회 — 무게는 앞발에": "6 steps — weight on the front foot", "어깨에서 뻗고 바로 회수": "Punch from the shoulder, snap back",
    "연속 성공": "Streak", "웨어러블 안전 모드": "Wearable safe mode",
    "익히기 1/3": "Learn 1/3", "익히기 2/3": "Learn 2/3", "익히기 3/3": "Learn 3/3",
    "잽 빠르기 m/s": "Jab speed m/s", "잽 스윕": "Jab sweep", "잽 폼 가볍게": "Easy jab form",
    "잽-잽-훅 — 리듬 놓치지 말고": "Jab-jab-hook — keep the rhythm", "정확도": "Accuracy",
    "주먹 온다 — 점선 존 밖으로 슬립": "Punch incoming — slip outside the zone", "주먹 온다!": "Punch incoming!",
    "천천히 크게 — 따라 하세요": "Slow and big — follow along", "최고 콤보": "Best combo",
    "콤보 · 12번 맞힘": "Combo · 12 landed", "콤보 — 속도 올라감": "Combo — speeding up",
    "타겟 뜨면 바로 잽": "Jab when the target lights", "평균 잽 속도": "Avg jab speed", "회피 슬립": "Slip the punch",
    "코치 — 따라 하세요": "Coach — follow along",
    "실전 2/4": "Live 2/4", "잽 대련": "Jab sparring", "실전 3/4": "Live 3/4", "콤비 가속": "Combo speed-up",
    "실전!": "GO!", "가드 올리고 — 타겟 뜨면 잽": "Guard up — jab when the target lights",
    "잽": "Jab", "훅": "Hook",
    "목표": "Goal", "목표 박자": "Target BPM", "목표 잽": "Target jabs", "버티기 목표": "Hold goal", "열리는 횟수": "Openings",
    "회": " reps", "초": "s",
  };
  const T = s => HUD_LANG === 'en' ? (EN_MAP[s] ?? s) : s;
  {
    const lb = document.getElementById('btn-lang');
    const sync = () => { if (lb) lb.textContent = HUD_LANG === 'en' ? '한' : 'EN'; };
    lb?.addEventListener('click', () => {
      HUD_LANG = HUD_LANG === 'en' ? 'ko' : 'en';
      localStorage.setItem('newton-lang', HUD_LANG);
      hudStageId = '';   // 즉시 리드로 (전환 모션 재생)
      sync();
    });
    sync();
  }
  const NUM_RE = /[0-9.%×+→:·\/±]/;
  function mixedText(g, text, x, y, w, s, align = 'center') {
    // 숫자·글리프 런 = OffBit / 나머지 = Pretendard (유저: 퍼센트·글리프도 반영)
    const runs = [];
    let buf = '', num = null;
    for (const ch of String(text)) {
      const isN = NUM_RE.test(ch);
      if (num === null || isN !== num) { if (buf) runs.push([num, buf]); buf = ch; num = isN; }
      else buf += ch;
    }
    if (buf) runs.push([num, buf]);
    const fonts = runs.map(([n]) => n ? NUMF(w, s) : `${w} ${s}px Overused, Pretendard, sans-serif`);
    let total = 0;
    runs.forEach(([, t], i) => { g.font = fonts[i]; total += g.measureText(t).width; });
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const pa = g.textAlign; g.textAlign = 'left';
    runs.forEach(([, t], i) => { g.font = fonts[i]; g.fillText(t, cx, y); cx += g.measureText(t).width; });
    g.textAlign = pa;
  }
  // SS=2 + 밉맵: 레티나(DPR2)에선 SS1이 확대 블러가 됨 — 밉맵 복원이 정답
  // (밉맵 재생성 비용은 감수 — 가독이 우선. 다른 최적화 항목은 유지)
  const HUD_SS = 2;
  const hudCanvas = document.createElement('canvas');
  hudCanvas.width = HUDW * HUD_SS; hudCanvas.height = HUDH * HUD_SS;
  const hudCtx = hudCanvas.getContext('2d');
  hudCtx.scale(HUD_SS, HUD_SS);   // 드로 코드는 1600×1000 좌표계 유지
  // ── 글리프 라이브러리 재질 전역 강제: 무엇을 그리든 [컬러 = 네온 글로우, 코어 = 크림-화이트]
  //    (룩 시스템 숫자 글리프 스타일 — 유저 확정. 개별 드로 코드는 순수 컬러만 지정하면 됨)
  let hudInkCore = false;   // 밝은 벽 = 코어를 채도 풀컬러로 (토큰 uDay 잉크 규약)
  function neonize(g) {
    // 코어 = 웜화이트에 그 컬러 30% 틴트 — 순백 코어는 '컬러 아웃라인만 친' 위화감 (유저 기각)
    const coreCache = {};
    const coreOf = c => typeof c === 'string'
      ? (coreCache[c] ??= `color-mix(in srgb, ${c} 30%, rgba(255,250,244,0.98) 70%)`)
      : c;
    const rawFillText = g.fillText.bind(g), rawFill = g.fill.bind(g);
    g.__rawFillText = rawFillText;   // 앰비언트(워터마크 등) = 네온 멀티패스 우회용
    g.__rawFill = rawFill;           // 플랫 면(그림자 등) = 글로우·코어 우회
    const rawStroke = g.stroke.bind(g), rawFillRect = g.fillRect.bind(g);
    g.__rawStroke = rawStroke;       // 플랫 스트로크 = 동일 우회
    g.fillText = function (t, x, y) {
      const c = this.fillStyle;
      // 글로우 = 폰트 크기 비례 (고정 14px는 작은 글자를 뭉갬 — 유저 가독 지적)
      const px = parseFloat((this.font.match(/([0-9.]+)px/) || [0, 34])[1]);
      this.shadowColor = c; this.shadowBlur = Math.min(14, Math.max(3, px * 0.22)) * hudGlowK;
      rawFillText(t, x, y); rawFillText(t, x, y);
      this.shadowBlur = 0; this.fillStyle = hudInkCore ? c : coreOf(c); rawFillText(t, x, y); rawFillText(t, x, y);
      this.fillStyle = c;
    };
    g.fill = function (p) {
      const c = this.fillStyle;
      this.shadowColor = c; this.shadowBlur = 12 * hudGlowK; p ? rawFill(p) : rawFill();
      this.shadowBlur = 0; this.fillStyle = hudInkCore ? c : coreOf(c); p ? rawFill(p) : rawFill();
      this.fillStyle = c;
    };
    g.fillRect = function (x, y, w, h) {
      const c = this.fillStyle;
      this.shadowColor = c; this.shadowBlur = 10 * hudGlowK; rawFillRect(x, y, w, h);
      this.shadowBlur = 0; this.fillStyle = hudInkCore ? c : coreOf(c); rawFillRect(x, y, w, h);
      this.fillStyle = c;
    };
    g.stroke = function (p) {
      const c = this.strokeStyle, w = this.lineWidth;
      this.shadowColor = c; this.shadowBlur = Math.max(6, w * 2.2) * hudGlowK; p ? rawStroke(p) : rawStroke();
      this.shadowBlur = 0; this.strokeStyle = hudInkCore ? c : coreOf(c); this.lineWidth = Math.max(1, w * 0.5);
      p ? rawStroke(p) : rawStroke();
      this.strokeStyle = c; this.lineWidth = w;
    };
  }
  neonize(hudCtx);
  // CTA 전용 오버레이 캔버스 — 인물(7)보다 위(8)에 버튼만 얹는 층
  const ctaCanvas = document.createElement('canvas');
  ctaCanvas.width = HUDW * HUD_SS; ctaCanvas.height = HUDH * HUD_SS;
  const ctaCtx = ctaCanvas.getContext('2d');
  ctaCtx.scale(HUD_SS, HUD_SS);
  neonize(ctaCtx);
  const hudTex = new THREE.CanvasTexture(hudCanvas);
  hudTex.minFilter = THREE.LinearMipmapLinearFilter;
  hudTex.magFilter = THREE.LinearFilter;
  hudTex.generateMipmaps = true;
  hudTex.anisotropy = 8;
  const hudPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.0),
    new THREE.ShaderMaterial({
      uniforms: { tex: { value: hudTex }, uBoost: { value: 1.8 } },
      vertexShader: `#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <clipping_planes_vertex>
}`,
      fragmentShader: `#include <common>
#include <clipping_planes_pars_fragment>
varying vec2 vUv; uniform sampler2D tex; uniform float uBoost;
void main(){
  #include <clipping_planes_fragment>
  vec4 t = texture2D(tex, vUv);
  vec3 col = clamp(t.rgb * t.a, 0.0, 1.0);
  col = clamp(col * uBoost, 0.0, 1.0);
  // 풀컬러 레이저 전제: 강한 픽셀 = 벽을 덮는 불투명 잉크(급경사 알파),
  // 약한 글로우 = 가산에 수렴(알파≈0) — 반투명 워시 종결 + 갈색 프린지 회피
  float lum = max(col.r, max(col.g, col.b));
  if (lum < 0.004) discard;   // ponytail 최적화: 빈 픽셀(캔버스 대부분) 블렌딩 탈락
  float aInk = smoothstep(0.20, 0.65, lum) * 0.68;   // 벽 HUD = 빛 투과 잉크 (풀 불투명은 '합성한 느낌' 기각)
  col = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
  gl_FragColor = vec4(col, aInk);
}`,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,   // 잉크 하이브리드
    }));
  hudPanel.renderOrder = 6;
  const ctaTex = new THREE.CanvasTexture(ctaCanvas);
  ctaTex.minFilter = THREE.LinearMipmapLinearFilter;
  ctaTex.magFilter = THREE.LinearFilter;
  ctaTex.generateMipmaps = true;
  ctaTex.anisotropy = 8;
  const ctaPanel = new THREE.Mesh(hudPanel.geometry, hudPanel.material.clone());
  ctaPanel.material.uniforms.tex.value = ctaTex;
  // 버튼 = 최고 위계 풀 잉크 (인물 0.985와 동급 이상 — 유저: '사람보다 쨍하게')
  ctaPanel.material.fragmentShader = ctaPanel.material.fragmentShader.replace(
    'smoothstep(0.20, 0.65, lum) * 0.68', 't.a');
  ctaPanel.material.needsUpdate = true;
  ctaPanel.renderOrder = 8;   // 인물(7) 위 — 버튼만 최상층
  hudPanel.visible = false;
  scene.add(hudPanel);
  scene.add(ctaPanel);
  ctaPanel.visible = false;
  // ── GridScan 배경 (reactbits GridScan 포팅) — 복싱 벽 배경 라인의 정본.
  //    레이캐스트 코리도(바닥·천장·좌우벽 그리드) + 깊이로 진행하는 가우시안 스캔 펄스.
  //    파라미터 = 유저 확정: softness 4, jitter 0, post 없음. 컬러 = 뉴턴 시스템.
  const gridScanPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.0),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 }, uGrid: { value: 1 },   // uGrid=0 → 퍼스펙티브 그리드 끔(바닥판)
        uLines: { value: new THREE.Color(0.55, 0.28, 0.14) },
        uScan: { value: new THREE.Color(0.98, 0.19, 0.19) },
        uAccent: { value: new THREE.Color(0.13, 0.80, 0.86) },
      },
      vertexShader: `#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <clipping_planes_vertex>
}`,
      fragmentShader: `#include <common>
#include <clipping_planes_pars_fragment>
varying vec2 vUv;
uniform float uTime, uBoost, uGrid;
uniform vec3 uLines, uScan, uAccent;
// ── reactbits Prism 정본 (height 3.5 / baseWidth 5.5 / scale 3.6) ──
vec4 tanh4(vec4 x){ vec4 e2x = exp(2.0 * x); return (e2x - 1.0) / (e2x + 1.0); }
float sdPyramid(vec3 p){
  vec3 q = vec3(abs(p.x) * 0.36364, abs(p.y) * 0.28571, abs(p.z) * 0.36364);
  float oct = (q.x + q.y + q.z - 1.0) * 2.75 * 0.57735;
  return max(oct, -p.y);
}
float gridLine(vec2 guv){
  vec2 f = fract(guv);
  vec2 a = min(f, 1.0 - f);
  vec2 w = fwidth(guv) * 0.7;
  vec2 l = 1.0 - smoothstep(w, w * 2.4, a);
  return max(l.x, l.y);
}
void main(){
  #include <clipping_planes_fragment>
  // ponytail 최적화: 테두리 페더가 0으로 만드는 픽셀은 레이마치 전 조기 탈락 (시각 동일)
  float vignE = smoothstep(0.0, 0.24, vUv.x) * smoothstep(0.0, 0.24, 1.0 - vUv.x)
              * smoothstep(0.0, 0.28, vUv.y) * smoothstep(0.0, 0.28, 1.0 - vUv.y);
  if (vignE < 0.004) discard;
  vec2 suv = vUv * 2.0 - 1.0;
  // 원본 GridScan 구도: 단일 바닥 평면이 지평선으로 물러나는 퍼스펙티브 그리드
  vec3 ro = vec3(0.0, 0.34, 0.0);
  vec3 rd = normalize(vec3(suv.x * 0.9, suv.y * 0.55 - 0.22, 1.0));
  vec3 col = vec3(0.0);
  float cyc = mod(uTime, 4.0);
  float phase = clamp(cyc / 2.0, 0.0, 1.0);
  float scanZ = phase * 9.0;
  float win = smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.88, 1.0, phase)) * step(cyc, 2.0);
  if (rd.y < -0.001) {
    float t = -ro.y / rd.y;
    vec3 h = ro + rd * t;
    if (h.z > 0.0 && h.z < 12.0) {
      vec2 guv = h.xz / 0.30;
      float line = gridLine(guv) * (1.0 - smoothstep(3.5, 11.0, h.z));   // 뒤로 뻗을수록 연하게 소멸
      float fog = exp(-h.z * 0.20);
      float dz = h.z - scanZ;
      float sigma = 0.18 * 4.0;
      float band = exp(-0.5 * dz * dz / (sigma * sigma)) * win;
      float aura = exp(-0.5 * dz * dz / (sigma * sigma * 4.0)) * 0.25 * win;
      col += uLines * line * fog * 1.15 * uGrid;   // 배경선 업 3차 (유저) · uGrid=0이면 그리드 제거
      col += uScan * (line * band * 1.1 + aura * fog * 0.5) * uGrid;
    }
  }
  // 지평선 은은한 라인
  float hz = exp(-abs(suv.y * 0.55 - 0.22) * 26.0) * 0.10;
  col += uLines * hz * uGrid;
  // reactbits Prism 정본 레이마치 — 채널 위상 누적을 뉴턴 칩 가중으로 매핑 (칩 조합 그라디언트만)
  vec2 fp = (vUv - vec2(0.5, 0.70)) * vec2(1.6, 1.0) * 4.1;
  float zz = 5.0;
  vec4 acc = vec4(0.0);
  float tp = uTime * 0.5;
  mat2 wob = mat2(cos(tp), cos(tp + 33.0), cos(tp + 11.0), cos(tp));
  for (int i = 0; i < 100; i++) {
    vec3 pp = vec3(fp, zz);
    pp.xz = wob * pp.xz;
    vec3 qq = pp; qq.y += 0.875;
    float dd = 0.1 + 0.2 * abs(sdPyramid(qq));
    zz -= dd;
    acc += (sin((pp.y + zz) + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / dd;
  }
  vec4 op = tanh4(acc * acc / 1e5);
  vec3 pr = op.x * vec3(0.980, 0.188, 0.188)     // FA3030
          + op.y * vec3(0.996, 0.431, 0.235)     // FE6E3C
          + op.z * vec3(0.996, 0.765, 0.537);    // FEC389
  float prL = dot(pr, vec3(0.2126, 0.7152, 0.0722));
  pr = clamp(mix(vec3(prL), pr, 1.85), 0.0, 1.0);   // 컬러감 2차 업 (유저)
  col += pr * 0.24;
  col = clamp(col * uBoost, 0.0, 1.0);
  // 테두리 페더 — 사각 경계가 안 보이게 가장자리로 갈수록 블러 소멸
  col *= vignE;
  float lumG = max(col.r, max(col.g, col.b));
  float aInk = smoothstep(0.16, 0.60, lumG) * 0.72;   // 배경 그리드 투과 완화 (유저: 너무 투명)
  // 감마 변환 제거 — 리니어화가 주황 칩(FE6E3C·FEC389)의 G/B를 죽여 레드로 표류시킴
  gl_FragColor = vec4(col, aInk);
}`,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  gridScanPanel.renderOrder = 5;
  gridScanPanel.visible = false;
  scene.add(gridScanPanel);
  let HUD_MAIN = '#ff6b21', HUD_CREAM = '#fff3e2', HUD_CYAN = '#21ccdb', hudGlowK = 1;
  const HUD_INK = '#fff6ea';   // 뉴트럴 잉크 — 모바일 '블랙 타이포'의 벽 등가 (정보는 뉴트럴, 레드는 악센트)
  function hudSyncPalette() {
    // 룩 시스템 완전 연동: 팔레트=LUT 샘플, 시안=역할색 user, 글로우 강도=마크 halo 슬라이더
    HUD_MAIN = '#fe6e3c';    // 주황 칩 고정 (LUT 샘플 표류 기각)
    HUD_CREAM = '#fff3e2';   // 중성 웜화이트
    HUD_CYAN = '#' + (COLORS.user ?? 0x21ccdb).toString(16).padStart(6, '0');
    hudGlowK = (FXP.mark?.halo ?? 0.9) / 0.9;
  }
  const HUD_MIRROR = new Set(['BX_A1', 'BX_A2', 'BX_A3', 'BX_B1', 'BX_B3']);
  // 내 폼 미니뷰 — 스테이션 후면 카메라가 보는 유저(X봇)를 '내 자세' 존(1008,180,452,616)에
  // 시안 실루엣 라이브로 투사 (제품 서사: 비전 인식 미리보기). 봇은 장면 드릴을 실연 중.
  const mirrorRT = new THREE.WebGLRenderTarget(226, 308);
  const mirrorCam = new THREE.PerspectiveCamera(48, 452 / 616, 0.1, 12);   // 실루엣 ≈ 1.0m — 코치와 등신 일치
  const MIRROR_MAT = new THREE.MeshBasicMaterial({ color: 0xd1feff });
  const mirrorPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: mirrorRT.texture, transparent: true, opacity: 0.92, depthWrite: false }));
  mirrorPanel.renderOrder = 6;
  mirrorPanel.visible = false;
  scene.add(mirrorPanel);
  function renderMirrorView() {
    const st = session.active && state.pack === 'boxing' ? session.curStage : null;
    const ready = !!st && st.id === 'BX_READY';
    const on = ready && xbot.model;   // 실루엣 = READY 가드 확인 전용 (A·B 기각 — 시선 단일 초점)
    mirrorPanel.visible = on;
    if (!on) return;
    if (!xbot._mirrorTagged) { xbot.model.traverse(o => o.layers.enable(7)); xbot._mirrorTagged = true; }
    // 미터 정합: RT = 봇 0~1.75m 정확 프레임 → 패널 = 코치와 동일 높이·동일 바닥선
    const wc = rig._wallCenter;
    const wallBot = (wc?.cy ?? 1.4) - rig.wallH / 2;
    // 미러 = 프레임 내부 수납 1.16m / READY = 우열 미니뷰 0.60m
    const hS = ready ? 0.60 : GHOST_H * 0.667;   // 코치 실측 등신(≈1.0m)과 일치
    const wS = hS * (452 / 616);
    const botCanvas = ready ? 632 : 980;             // 프레임 바닥선(캔버스) — 프레임 안 8px 여백
    const yBot = wallBot + (1000 - botCanvas) / 1000 * rig.wallH;
    const zx = (1321 - 800) / 1600 * rig.wallW;      // 축 = 우측 카드 중심(1321)
    mirrorPanel.position.set((wc ? wc.cx : 0) + zx, yBot + hS / 2, WALL_Z + 0.026);
    mirrorPanel.scale.set(wS, hS, 1);
    if (rig.wallClip && mirrorPanel.material.clippingPlanes !== rig.wallClip)
      mirrorPanel.material.clippingPlanes = rig.wallClip;
    // 스테이션 후면 카메라 — 봇 [0, 1.75m]를 수직으로 딱 프레임 (FOV 48 → d=1.97)
    const bx = xbot.group.position;
    // 프레임 [-0.08, 1.80]m — 하단 8cm 여백 (발 잘림 방지), FOV48 → d=2.11
    mirrorCam.position.set(bx.x - 0.06, 0.86, bx.z - 2.11);
    mirrorCam.lookAt(bx.x - 0.06, 0.86, bx.z);
    // 실루엣 패스 (봇 전용 레이어 + 플랫 시안) — 1인칭에선 봇이 숨겨져 있어 패스 동안만 강제 표시
    const prevVis = xbot.model.visible;
    xbot.model.visible = true;
    const prevBg = scene.background, prevFog = scene.fog;
    scene.background = null; scene.fog = null;
    scene.overrideMaterial = MIRROR_MAT;
    mirrorCam.layers.set(7);
    const prevRT = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(mirrorRT);
    renderer.clear();
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(prevRT);
    renderer.setClearAlpha(prevAlpha);
    scene.overrideMaterial = null;
    scene.background = prevBg; scene.fog = prevFog;
    xbot.model.visible = prevVis;
  }
  const HUD_RING = new Set(['BX_C1', 'BX_C2', 'BX_C3', 'BX_C4']);
  // 스테이지별 목표치 (피그마 스탯패널 사양)
  const HUD_GOALS = { BX_A1: ['목표', 8, '회'], BX_A2: ['목표 박자', 153, ''], BX_A3: ['목표 잽', 6, ''], BX_B1: ['버티기 목표', 3.0, '초'], BX_B3: ['열리는 횟수', 6, ''] };
  function hudChip(g, x, y, w, h, r, col, text, tx, ty) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
    g.strokeStyle = col; g.lineWidth = 3; g.stroke();
    if (text) { g.fillStyle = col; g.fillText(text, tx, ty); }
  }
  function hudGlass(g, x, y, w, h, r, border) {
    // (스탯 존 표기용 최소 잔존 — 면 없이 테두리만)
    g.beginPath(); g.roundRect(x, y, w, h, r);
    g.strokeStyle = border || HUD_MAIN; g.lineWidth = 3; g.stroke();
  }
  function hudText(g, text, x, y, rim, rimW) {
    g.fillStyle = rim || HUD_MAIN;
    g.fillText(text, x, y);
  }
  // ── VR 스포츠 UI 모션 프리미티브 (SkyTrak·TV 트레이서·GYM 레퍼런스 문법) ──
  let HUD_T = 0;   // 스테이지 경과 시간 — drawStage가 세팅, 모든 등장 모션의 시계
  const easeO = x => { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 4); };
  const easeQ = x => { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 5); };
  const aIn = (d, dur = 0.75) => easeQ((HUD_T - d) / dur);   // 바뀌는 요소만 소프트 슬라이드-인 (유저 확정)
  function hudCountUp(num, d = 0.25, dur = 0.9) {
    // 수치 카운트업 — '116'·'4.2' 형은 굴리고, '4/8' 같은 복합 문자열은 그대로
    const s = String(num), n = parseFloat(s);
    if (!isFinite(n) || String(n) !== s) return s;
    const k = easeQ((HUD_T - d) / dur);   // reactbits count-up — 등장 시 숫자 굴림
    const dec = (s.split('.')[1] || '').length;
    return (n * k).toFixed(dec);
  }
  // ── 카드 낙아웃 (모바일 정합 3단계): 밝은 카드 광면 + 무광 텍스트 = 투사식 '검정 타이포' ──
  //    프로젝터는 검정을 못 쏘지만, 밝은 광면 안에서 빛을 안 쏜 영역은 검정으로 읽힌다 (유저 사진 원리)
  function hudCard(g, x, y, w, h, r, a) {
    // 조도 적응 카드: 밝은 벽 = 화이트 카드 / 어두운 벽 = 프로스티드 글래스 (유저)
    const day = !!FXP.day;
    g.save();
    g.beginPath(); g.roundRect(x, y, w, h, r);
    // 통일: 양 조도 모두 프로스티드 글래스 (유저) — 주간은 막·보더를 한 단계 강하게
    g.fillStyle = `rgba(255,250,244,${((day ? 0.20 : 0.13) * a).toFixed(3)})`;
    g.__rawFill();
    g.strokeStyle = `rgba(255,246,234,${((day ? 0.45 : 0.30) * a).toFixed(3)})`;
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(x + 1, y + 1, w - 2, h - 2, r - 1);
    g.__rawStroke();
    g.restore();
  }
  const cardInk = (a = 1) => `rgba(255,250,244,${0.97 * a})`;   // 글래스 통일 = 항상 화이트 잉크
  function hudKnock(g, text, font, x, y, align = 'left') {
    // '낙아웃' 렌더 = 다크 잉크 솔리드 — 진짜 구멍은 시뮬 레이어상 뒤 인물이 비쳐 지저분
    // (실물 프로젝터에선 카드 영역에서 인물 광이 꺼져 구멍=벽색 — 그 지각을 다크 잉크로 재현)
    g.save();
    g.font = font; g.textAlign = align;
    g.fillStyle = cardInk();
    g.__rawFillText(text, x, y);
    g.restore();
  }
  function hudStat(_g, x, label, num, col, frac, yTop = 56) {
    // 스탯 카드 = 오버레이 레이어(인물 위) — 방송 그래픽 규율: 정보 카드가 최상층
    const g = ctaCtx;
    ctaDrawn = true; ctaHas = true;
    const k = aIn(0.2 + (yTop / 1000) * 0.3);   // 상→하 스태거 등장
    if (k <= 0) return;
    g.save();
    g.translate(0, (1 - k) * 26);             // 라이즈 인
    const y0 = yTop, ch = 160;
    hudCard(g, x, y0, 430, ch, 30, k);
    hudKnock(g, label, '600 28px Overused, Pretendard, sans-serif', x + 32, y0 + 44);
    hudKnock(g, hudCountUp(num), NUMF(800, 76), x + 32, y0 + 118);
    if (frac != null) {
      g.fillStyle = 'rgba(255,250,244,0.22)';
      g.beginPath(); g.roundRect(x + 32, y0 + 140, 366, 8, 4); g.__rawFill();
      g.fillStyle = col;
      g.beginPath(); g.roundRect(x + 32, y0 + 140, Math.max(10, 366 * Math.min(1, frac)), 8, 4); g.__rawFill();
    }
    g.restore();
  }
  function hudTag(_g, cx, text, col, ty = 916) {
    // 역할 태그 = 하단 행 · 원샷 · 오버레이(인물 위 이름표 — 방송 네임플레이트 규율)
    const g = ctaCtx;
    ctaDrawn = true; ctaHas = true;
    const k = aIn(0.15);
    const out = 1 - easeQ((HUD_T - 3.2) / 0.7);
    if (k <= 0 || out <= 0) return;
    g.save();
    g.globalAlpha = k * out;
    g.font = '700 28px Overused, Pretendard, sans-serif'; g.textAlign = 'center';
    const w = g.measureText(text).width + 48;
    hudChip(g, cx - w / 2, ty, w, 46, 23, col, text, cx, ty + 31);
    g.restore();
  }
  function hudLine(g, x1, y1, x2, y2, wd, alpha) {
    g.globalAlpha = alpha * HUD_AMBIENT; g.lineWidth = wd;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.globalAlpha = 1;
  }
  const HUD_AMBIENT = 0.55;   // 광량 위계: 앰비언트 구조선 = 핵심 대비 55%
  function drawHudRoom(g) {
    g.strokeStyle = HUD_MAIN;
    const BW = 1040, BX0 = 280, BY = 120, BBOT = 730;
    hudLine(g, 0, HUDH, BX0, BBOT, 3, 0.55);
    hudLine(g, HUDW, HUDH, BX0 + BW, BBOT, 3, 0.55);
    for (const f of [0.26, 0.5, 0.72, 0.88, 1.0]) {
      const xl = BX0 * f, xr = HUDW - BX0 * f;
      const yF = HUDH - (HUDH - BBOT) * f;
      const a = f === 1.0 ? 0.55 : 0.34;
      hudLine(g, xl, yF, xr, yF, 2.5, a);
      hudLine(g, xl, yF - 60, xl, yF, 2.5, a * 0.8);
      hudLine(g, xr, yF - 60, xr, yF, 2.5, a * 0.8);
    }
    g.globalAlpha = 0.55; g.lineWidth = 3;
    g.strokeRect(BX0, BY, BW, BBOT - BY);
    g.globalAlpha = 1;
    for (let i = 1; i < 4; i++) hudLine(g, BX0 + (BW / 4) * i, BY, BX0 + (BW / 4) * i, BBOT, 1.5, 0.22);
    for (const f of [0.14, 0.38, 0.62, 0.86]) {
      const y1 = HUDH - (HUDH - BBOT) * f, y2 = HUDH - (HUDH - BBOT) * (f + 0.11);
      hudLine(g, HUDW / 2, y1, HUDW / 2, y2, 4, 0.45);
    }
  }
  function drawHudRing(g) {
    g.strokeStyle = HUD_MAIN; g.fillStyle = HUD_MAIN; g.lineCap = 'round';
    function post(x, yT, yB, w, a) {
      g.globalAlpha = a;
      g.beginPath(); g.roundRect(x - w / 2, yT, w, yB - yT, w / 2); g.fill();
      g.globalAlpha = 1;
    }
    post(120, 430, 985, 18, 0.85); post(1480, 430, 985, 18, 0.85);
    post(470, 500, 800, 12, 0.6); post(1130, 500, 800, 12, 0.6);
    for (const t of [0.30, 0.55, 0.80]) {
      const yF = 430 + 555 * t, yB = 500 + 300 * t;
      const wd = 5 - t * 1.5;
      hudLine(g, 120, yF, 470, yB, wd, 0.7);
      hudLine(g, 1480, yF, 1130, yB, wd, 0.7);
      hudLine(g, 470, yB, 1130, yB, wd * 0.85, 0.55);
    }
    hudLine(g, 120, 985, 1480, 985, 4, 0.5);
    hudLine(g, 120, 985, 470, 800, 3, 0.4);
    hudLine(g, 1480, 985, 1130, 800, 3, 0.4);
    hudLine(g, 470, 800, 1130, 800, 3, 0.4);
  }
  // 보조 드로어 (피그마 컴포넌트 1:1)
  // ── 리본 궤적 (reactbits Ribbons 포팅: count1·thickness40·fade·waves off·maxAge~0.5s) ──
  //    펀치 방향·이동 경로의 빠른 흐름 시각화 — 뉴턴 램프(꼬리 연주황→머리 레드), 오버레이 레이어
  function hudRibbon(tS, x0, y0, x1, y1, period) {
    const g = ctaCtx;
    const u = (tS % period) / period;
    const LIFE = 0.55, FADE = 0.3;
    if (u > LIFE + FADE) return;
    ctaDrawn = true; ctaHas = true;
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 240;    // 넓은 아크 (반경 업)
    const P = t => { const a = 1 - t; return [a*a*x0 + 2*a*t*mx + t*t*x1, a*a*y0 + 2*a*t*my + t*t*y1]; };
    const head = Math.min(1, u / LIFE);
    const tail = Math.max(0, head - 0.85);                    // 긴 잔류 — 경로 전체가 리본으로
    const fade = u > LIFE ? 1 - (u - LIFE) / FADE : 1;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const N = 26;
    // 그라디언트 충실: 획마다 stop이 아니라 경로를 따라 연속 램프 (딥레드→레드→주황→연주황)
    const ramp = k => {
      const s = [[146,15,15],[250,48,48],[254,110,60],[254,195,137]];
      const p = k * 3, i = Math.min(2, Math.floor(p)), f = p - i;
      return s[i].map((c, j) => Math.round(c + (s[i+1][j] - c) * f));
    };
    for (let i = 0; i < N; i++) {
      const [xa, ya] = P(tail + (head - tail) * (i / N));
      const [xb, yb] = P(tail + (head - tail) * ((i + 1) / N));
      const k = i / N;
      g.lineWidth = 10 + 70 * Math.sin(Math.PI * (0.15 + 0.85 * k) * 0.6 + 0.35);   // 폭 넓게(최대 ~80), 부드러운 테이퍼
      const [r, gg, b] = ramp(k);
      g.strokeStyle = `rgba(${r},${gg},${b},${(0.10 + 0.72 * k) * fade})`;
      g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb);
      g.__rawStroke();
    }
    g.restore();
  }
  // ── 스피드 스트릭 (펀치 방향 모션블러 잔상선) — 리본 대체안 B ──
  //    주먹→전방으로 빠르게 뻗었다 소멸. 평행 잔상선 다발 + 뉴턴 램프(머리 레드/꼬리 연주황).
  function hudStreak(tS, x0, y0, x1, y1, period) {
    const g = ctaCtx;
    const u = (tS % period) / period;
    const STRIKE = 0.11, HOLD = 0.24, FADE = 0.22;
    if (u > HOLD + FADE) return;
    ctaDrawn = true; ctaHas = true;
    const eo = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
    const ext = eo(u / STRIKE);                              // 리드가 전방으로 쏘는 진행
    const tailF = Math.max(0, ext - 0.62);                   // 세그먼트 길이 (다발 몸통)
    const fade = u > HOLD ? 1 - (u - HOLD) / FADE : 1;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = dx / L, ny = dy / L, px = -ny, py = nx;       // 진행·수직 단위
    const ramp = k => {                                      // 꼬리(연주황)→머리(레드)
      const s = [[254,195,137],[254,110,60],[250,48,48]];
      const p = k * 2, i = Math.min(1, Math.floor(p)), f = p - i;
      return s[i].map((c, j) => Math.round(c + (s[i+1][j] - c) * f));
    };
    g.save(); g.lineCap = 'round';
    const N = 12;
    for (const off of [-26, -13, 0, 13, 26]) {               // 평행 잔상 다발
      const oa = 1 - Math.abs(off) / 34;                     // 가운데 진할수록
      for (let i = 0; i < N; i++) {
        const f0 = tailF + (ext - tailF) * (i / N);
        const f1 = tailF + (ext - tailF) * ((i + 1) / N);
        const ox = px * off, oy = py * off;
        const ax = x0 + dx * f0 + ox, ay = y0 + dy * f0 + oy;
        const bx = x0 + dx * f1 + ox, by = y0 + dy * f1 + oy;
        const k = i / N;                                     // 0=꼬리 → 1=머리
        g.lineWidth = 3 + 15 * k;
        const [r, gg, b] = ramp(k);
        g.strokeStyle = `rgba(${r},${gg},${b},${(0.06 + 0.7 * k) * oa * fade})`;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.__rawStroke();
      }
    }
    g.restore();
  }
  function hudMilestone(g, eyebrow, title, sub) {
    // 전환 인터스티셜 공통계 (T1·T2·C1 — FIN 히어로와 동일 문법: 정중앙·대형·수직)
    const ke = aIn(0.0), kt = aIn(0.1), ks = aIn(0.3);
    const numeric = /^[0-9]+$/.test(String(title));
    g.textAlign = 'center';
    if (eyebrow && ke > 0) {
      g.save(); g.globalAlpha = ke; g.translate(0, (1 - ke) * -14);
      g.fillStyle = '#fec389'; g.font = '500 34px Overused, Pretendard, sans-serif';
      g.fillText(eyebrow, 800, numeric ? 240 : 386);   // 워드형 = 타이틀 캡 위 40px — 리듬 정합
      g.restore();
    }
    if (kt > 0) {
      g.save(); g.globalAlpha = kt; g.translate(0, (1 - kt) * 26);
      g.fillStyle = HUD_INK;
      g.font = numeric ? NUMF(800, 220) : '700 104px Overused, Pretendard, sans-serif';
      g.fillText(String(title), 800, numeric ? 560 : 500);
      g.restore();
    }
    // 도트 룰 제거 — 이중 점선 지각(유저) + 타이포 위계만으로 충분
    if (sub && ks > 0) {
      g.save(); g.globalAlpha = ks; g.translate(0, (1 - ks) * 16);
      g.fillStyle = '#fec389'; g.font = '500 34px Overused, Pretendard, sans-serif';
      g.fillText(sub, 800, 612);
      g.restore();
    }
  }
  function hudLockupCorner(g, eyebrow, title) {
    // 좌상 아이덴티티 블록 — 중앙(인물 존)과 절대 불겹침 (애플식 정돈: 텍스트는 존 밖)
    const ke = aIn(0.0), kt = aIn(0.12), kr = aIn(0.35, 0.55);
    g.textAlign = 'left';
    if (eyebrow && ke > 0) {
      g.save(); g.globalAlpha = ke; g.translate(0, (1 - ke) * -12);
      g.fillStyle = '#fec389'; g.font = '500 30px Overused, Pretendard, sans-serif';
      g.fillText(eyebrow, 64, 84);
      g.restore();
    }
    if (kt > 0) {
      g.save(); g.globalAlpha = kt; g.translate(0, (1 - kt) * 18);
      g.font = '700 46px Overused, Pretendard, sans-serif';
      hudText(g, title, 64, 138, HUD_INK, 8);
      g.restore();
    }
    if (kr > 0) {
      g.fillStyle = '#fec389'; g.globalAlpha = 0.85;
      for (let dx = 0; dx <= 240 * kr; dx += 16) { g.beginPath(); g.arc(64 + dx, 166, 2.2, 0, 6.284); g.fill(); }
      g.globalAlpha = 1;
    }
    g.textAlign = 'center';
  }
  function hudLockup(g, eyebrow, title) {
    g.textAlign = 'center';
    const ke = aIn(0.0), kt = aIn(0.12), kr = aIn(0.35, 0.55);
    if (eyebrow && ke > 0) {
      g.save(); g.globalAlpha = ke; g.translate(0, (1 - ke) * -14);
      g.fillStyle = '#fec389'; g.font = '500 30px Overused, Pretendard, sans-serif';
      g.fillText(eyebrow, 800, 88);
      g.restore();
    }
    if (kt > 0) {
      g.save(); g.globalAlpha = kt; g.translate(0, (1 - kt) * 22);
      g.font = '700 58px Overused, Pretendard, sans-serif';
      hudText(g, title, 800, 152, HUD_INK, 8);
      g.restore();
    }
    if (kr > 0) {
      // 타이틀 하단 룰 — 중앙에서 양측으로 드로-인, 도트 터미널 (GYM 라인 문법)
      const half = 150 * kr;
      g.strokeStyle = '#fec389'; g.lineWidth = 2; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(800 - half, 176); g.lineTo(800 + half, 176); g.stroke();
      g.fillStyle = '#fec389';
      g.beginPath(); g.arc(800 - half, 176, 4, 0, 6.284); g.fill();
      g.beginPath(); g.arc(800 + half, 176, 4, 0, 6.284); g.fill();
      g.globalAlpha = 1;
    }
  }
  function hudCaption(_g, text) {
    // 지시 캡션 = CTA 오버레이 레이어(인물 위) — 인물 존과 겹쳐도 항상 가독
    const g = ctaCtx;
    ctaDrawn = true; ctaHas = true;
    const k = aIn(0.3);
    if (k <= 0) return;
    g.save(); g.globalAlpha = k; g.translate(0, (1 - k) * 20);
    g.font = '700 30px Overused, Pretendard, sans-serif'; g.textAlign = 'center';
    const w = g.measureText(text).width + 64;
    hudChip(g, 800 - w / 2, 912, w, 54, 27, HUD_MAIN, text, 800, 948);
    g.restore();
  }
  let ctaDrawn = true;    // 이번 프레임에 CTA를 그렸는가
  let ctaHas = false;     // 캔버스에 내용 잔존 여부 (스틱 방지)
  function hudCTA(g, text, y, tS) {
    ctaDrawn = true; ctaHas = true;
    // 최종 하이브리드: 고인 빛 웅덩이(아우라·재질) + 발광 코어 필(어포던스·가독)
    const LABEL = text || T('발 두 번 탭해서 시작');   // 장면별 카피 존중
    g.font = '700 34px Overused, Pretendard, sans-serif'; g.textAlign = 'center';
    const tw = g.measureText(LABEL).width;
    const yy = y ?? 908, cy = yy + 30;
    const t = tS ?? 0, cyc = t % 2.6;
    const bump = t0 => { const u = (cyc - t0) / 0.42; return u >= 0 && u <= 1 ? Math.sin(Math.PI * u) ** 2 : 0; };
    const p = Math.max(bump(0), bump(0.55));   // 둥·둥 → 쉼
    const K = hudGlowK;
    g.save();
    g.translate(800, cy);
    // ① 웅덩이 아우라 — 뉴턴 새벽 램프 방사 (은은, 배경과 필 사이의 빛 재질층)
    g.save();
    g.translate(0, 10);
    g.scale(1 + 0.03 * p, 0.34 * (1 + 0.02 * p));
    const RW = tw * 0.72 + 80;
    const pool = [
      [RW * 1.15, `rgba(146,15,15,${0.34 + 0.05 * p})`],
      [RW * 0.85, `rgba(250,48,48,${0.50 + 0.06 * p})`],
      [RW * 0.52, `rgba(254,110,60,${0.44 + 0.06 * p})`],
    ];
    for (const [r, c] of pool) {
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
      rg.addColorStop(0, c); rg.addColorStop(0.55, c.replace(/[\d.]+\)$/, a => (parseFloat(a) * 0.55).toFixed(3) + ')'));
      rg.addColorStop(1, 'rgba(250,48,48,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(0, 0, r, 0, 6.284); g.__rawFill();
    }
    g.restore();
    // ② 발광 코어 필 — 작고 단단한 캡슐 (텍스트는 항상 이 안 = 가독 불변)
    const s = 1 + 0.025 * p;
    g.scale(s, s);
    const w = tw + 76, h = 62, R = 31;
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, R);
    const gf = g.createLinearGradient(0, h / 2, 0, -h / 2);
    gf.addColorStop(0, '#FA3030'); gf.addColorStop(1, '#FE6E3C');
    g.fillStyle = gf; g.__rawFill();
    // 상단 시트 (발광체의 은은한 윗광)
    g.save();
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, R); g.clip();
    const hl = g.createLinearGradient(0, -h / 2, 0, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0.20)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h * 0.5, R); g.__rawFill();
    g.restore();
    // ③ 라벨 — 크리스프 화이트 (필 안 고정 = 배경 무관 가독)
    g.shadowColor = 'rgba(146,15,15,0.5)'; g.shadowBlur = 4;
    g.fillStyle = '#ffffff';
    g.__rawFillText(LABEL, 0, 12);
    g.shadowBlur = 0;
    g.__rawFillText(LABEL, 0, 12);
    g.restore();
    g.textAlign = 'center';
  }
  function hudPhaseDots(g, cx, y, active) {
    const names = 4;
    for (let i = 0; i < names; i++) {
      g.beginPath(); g.arc(cx + i * 46, y, 8, 0, 6.284);
      g.fillStyle = i === active ? HUD_MAIN : 'rgba(255,148,71,0.3)';
      g.fill();
    }
  }
  function hudArc(g, cx, cy, r, frac, wd, col) {
    g.strokeStyle = 'rgba(255,148,71,0.28)'; g.lineWidth = wd;
    g.beginPath(); g.arc(cx, cy, r, 0, 6.284); g.stroke();
    g.strokeStyle = col; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, r, -1.5708, -1.5708 + 6.283 * Math.min(1, frac)); g.stroke();
    g.lineCap = 'butt';
  }
  function drawStage(g, id, tS) {
    HUD_T = tS;   // 등장 모션 시계 (스테이지 전환마다 0부터)
    const R = judge.lastReport;
    const pct = R?.matchPct ?? 84;
    switch (id) {
      case 'BX_READY': {
        hudLockupCorner(g, T('섀도복싱 · 잽'), T('가드 올리고 READY'));
        hudTag(g, 800, T('상대 — 맞서세요'), HUD_MAIN);
        // 좌열 중단: 페이즈 블록 (아이덴티티 아래 — 존 규율)
        g.textAlign = 'left'; g.fillStyle = HUD_MAIN;
        mixedText(g, T('0 · 준비'), 64, 252, 700, 34, 'left');
        hudPhaseDots(g, 72, 284, 0);
        g.fillStyle = '#fec389'; g.font = '500 26px Overused, Pretendard, sans-serif';
        g.fillText(T('가드 · 거리 재기'), 64, 322);
        // 우상: 링 거리 + 웨어러블
        g.textAlign = 'right'; g.fillStyle = HUD_INK;
        g.font = NUMF(700, 64); g.fillText('1.93', 1536, 108);
        g.font = '500 28px Overused, Pretendard, sans-serif'; g.fillStyle = '#fec389';
        g.fillText(T('m — 링에 서기'), 1536, 142);
        g.font = '700 24px Overused, Pretendard, sans-serif';
        const wtxt = T('웨어러블 안전 모드');
        const ww = g.measureText(wtxt).width + 40;
        g.beginPath(); g.roundRect(1536 - ww, 166, ww, 38, 19);
        g.strokeStyle = '#fec389'; g.lineWidth = 1.5; g.stroke();   // 웨어러블 = 시스템 (시안 회수)
        g.fillStyle = '#fec389'; g.textAlign = 'center';
        g.fillText(wtxt, 1536 - ww / 2, 191);
        // 내 폼 미니뷰 — '가드 올리고' 지시의 폐루프 (카메라가 내 가드를 비춤)
        g.strokeStyle = HUD_CYAN; g.setLineDash([10, 10]); g.globalAlpha = 0.5; g.lineWidth = 2.5;
        g.beginPath(); g.roundRect(1106, 240, 430, 400, 16); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
        hudTag(g, 1321, T('내 자세'), HUD_CYAN, 656);
        hudCTA(ctaCtx, T('발 두 번 탭해서 시작'), 916, tS);
        // 우하: 가드 브래킷 + 카피
        g.strokeStyle = HUD_MAIN; g.lineWidth = 4;
        const bx = 1372, by = 830, bw = 64, bh = 54, L = 16;
        for (const [px, py, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
          g.beginPath(); g.moveTo(px + sx * L, py); g.lineTo(px, py); g.lineTo(px, py + sy * L); g.stroke();
        }
        g.fillStyle = HUD_MAIN; g.textAlign = 'left';
        g.font = '700 30px Overused, Pretendard, sans-serif'; g.fillText(T('가드 올리기'), 1372, 930);
        break;
      }
      case 'BX_A1': case 'BX_A2': case 'BX_A3': case 'BX_B1': case 'BX_B3': {
        const LOCK = {
          BX_A1: [T('몸풀기 1/3'), T('목·어깨 돌리기'), T('천천히 크게 — 따라 하세요')],
          BX_A2: [T('몸풀기 2/3'), T('스텝 인·아웃'), T('앞뒤 6회 — 무게는 앞발에')],
          BX_A3: [T('몸풀기 3/3'), T('잽 폼 가볍게'), T('어깨에서 뻗고 바로 회수')],
          BX_B1: [T('익히기 1/3'), T('가드 유지'), T('가드 박스 안에 주먹 유지 — 링이 찰 때까지')],
          BX_B3: [T('익히기 3/3'), T('잽 스윕'), T('스윕 따라 — 열리면 잽')],
        }[id];
        const goal = HUD_GOALS[id];
        // 워터마크 (요소들보다 먼저 = 뒤)
        g.fillStyle = HUD_MAIN; g.globalAlpha = 0.10;
        g.font = NUMF(700, 560); g.textAlign = 'center';
        g.__rawFillText(String(goal[1]).padStart(2, '0'), 800, 700);   // 앰비언트 = 네온 우회
        g.globalAlpha = 1;
        hudLockup(g, LOCK[0], LOCK[1]);
        hudTag(g, 279, T('코치 — 따라 하세요'), HUD_MAIN);   // 하단 — 인물 위 이름표(오버레이)
        const mine = id === 'BX_B1' ? (tS % 4).toFixed(1) : Math.min(goal[1], Math.floor(tS / 2.2));
        g.textAlign = 'left';
        hudStat(g, 64, T(goal[0]), goal[1] + T(goal[2]), HUD_MAIN, null, 56);
        hudStat(g, 1106, T('내 기록'), mine + T(goal[2]), HUD_CYAN, (parseFloat(mine) || 0) / goal[1], 56);
        if (id === 'BX_A2') {
          for (let i = 0; i < 6; i++) {
            const lit = i < (Math.floor(tS / 1.6) % 7);
            g.fillStyle = lit ? HUD_MAIN : 'rgba(255,148,71,0.25)';
            g.beginPath(); g.roundRect(660 + i * 50, 764, 40, 12, 4); g.fill();
          }
        }
        if (id === 'BX_B3') {
          for (let i = 0; i < 12; i++) {
            const lit = i < (tS * 1.8) % 13;
            g.fillStyle = lit ? HUD_MAIN : 'rgba(255,148,71,0.25)';
            g.beginPath(); g.roundRect(240 + i * 34, 430, 26, 10, 4); g.fill();
          }
        }
        window.__mirDbg = (window.__mirDbg || 0) + 1;
        hudCaption(g, LOCK[2]);
        break;
      }
      case 'BX_B2': {
        hudLockupCorner(g, T('익히기 2/3'), T('회피 슬립'));
        hudTag(g, 800, T('코치 — 따라 하세요'), HUD_MAIN);   // B단계=코치 시범(혼합 설계) — C부터 상대
        for (const [x, ar] of [[120, '←'], [1240, '→']]) {
          g.strokeStyle = HUD_CYAN; g.setLineDash([10, 10]); g.lineWidth = 3; g.globalAlpha = 0.7;
          g.beginPath(); g.roundRect(x, 300, 240, 420, 24); g.stroke();
          g.setLineDash([]); g.globalAlpha = 1;
          g.fillStyle = HUD_CYAN; g.font = '700 72px Overused, Pretendard, sans-serif'; g.textAlign = 'center';
          g.fillText(ar, x + 120, 540);
        }
        // 주먹 온다! 경고 (박자 점멸) — 좌열, 인물 존 밖
        if (Math.sin(tS * 6.4) > -0.2) {
          g.font = '700 30px Overused, Pretendard, sans-serif';
          const wt = T('주먹 온다!');
          const ww2 = g.measureText(wt).width + 36;
          g.fillStyle = '#fa3030';
          g.beginPath(); g.roundRect(64, 200, ww2, 48, 10); g.__rawFill();
          g.fillStyle = '#ffffff'; g.textAlign = 'left';
          g.__rawFillText(wt, 82, 233);
        }
        hudCaption(g, T('주먹 온다 — 점선 존 밖으로 슬립'));
        break;
      }
      case 'BX_T1': {
        hudMilestone(g, T('섀도복싱 · 잽'), T('몸풀기 끝!'), T('몸 풀렸어요 — 다음: 사전 익히기'));
        hudPhaseDots(g, 800 - 69, 660, 1);   // 진행 도트 = 서브 아래·CTA 위 (룰과 이중 점선 해소)
        hudCTA(ctaCtx, T('두 번 탭 → 익히기'), 700, tS);   // 서브(612) 아래 88px — 밀착 해소
        break;
      }
      case 'BX_T2': {
        const remain = Math.max(0, 5 - tS);
        hudMilestone(g, T('5초 뒤 실전'), String(Math.ceil(remain)), null);
        hudArc(g, 800, 480, 190, remain / 5, 10, HUD_MAIN);
        hudCTA(ctaCtx, T('두 번 탭 → 바로'), 908, tS);
        break;
      }
      case 'BX_C1': {
        // T2가 이미 5초 카운트 — 연속 이중 카운트다운 중복 제거(유저), 'GO' 플래시로
        hudMilestone(g, null, T('실전!'), T('가드 올리고 — 타겟 뜨면 잽'));
        break;
      }
      case 'BX_C2': {
        hudLockupCorner(g, T('실전 2/4'), T('잽 대련'));
        hudTag(g, 800, T('상대 — 맞서세요'), HUD_MAIN);
        g.textAlign = 'right'; g.fillStyle = HUD_INK;
        g.font = NUMF(700, 96);
        g.fillText(pct + '%', 1536, 140);
        g.font = '500 28px Overused, Pretendard, sans-serif'; g.globalAlpha = 0.85;
        g.fillText(T('정확도'), 1536, 176); g.globalAlpha = 1;
        g.textAlign = 'left'; g.fillStyle = HUD_INK;   // 타이머 = 시스템 정보 (시안 회수)
        g.font = NUMF(700, 54);
        g.fillText('0:' + String(Math.floor(tS)).padStart(2, '0'), 64, 252);
        g.fillStyle = HUD_MAIN; g.font = '500 30px Overused, Pretendard, sans-serif'; g.globalAlpha = 0.85;
        g.fillText(T('실전 라운드'), 64, 290); g.globalAlpha = 1;
        // 우하: 잽 빠르기 + 세그
        g.fillStyle = HUD_INK; g.font = NUMF(700, 84);
        g.fillText('7.2', 1106, 800);
        g.font = '500 28px Overused, Pretendard, sans-serif'; g.globalAlpha = 0.85;
        g.fillText(T('잽 빠르기 m/s'), 1106, 836); g.globalAlpha = 1;
        for (let i = 0; i < 10; i++) {
          g.fillStyle = i < 7 ? HUD_MAIN : 'rgba(255,148,71,0.25)';
          g.beginPath(); g.roundRect(1106 + i * 34, 856, 30, 12, 4); g.fill();
        }
        g.fillStyle = HUD_INK; g.font = NUMF(700, 60);
        g.fillText('×3', 64, 840);
        g.font = '500 28px Overused, Pretendard, sans-serif'; g.globalAlpha = 0.85;
        g.fillText(T('콤보 · 12번 맞힘'), 64, 876); g.globalAlpha = 1;
        const side2 = Math.floor(tS / 1.95) % 2;
        hudStreak(tS, side2 ? 690 : 910, 300, side2 ? 610 : 990, 560, 1.95);
        hudCaption(g, T('타겟 뜨면 바로 잽'));
        break;
      }
      case 'BX_C3': {
        hudLockupCorner(g, T('실전 3/4'), T('콤비 가속'));
        hudTag(g, 800, T('상대 — 맞서세요'), HUD_MAIN);
        g.font = '700 26px Overused, Pretendard, sans-serif';
        const bt = T('콤보 — 속도 올라감');
        const bw2 = g.measureText(bt).width + 32;
        g.fillStyle = HUD_CYAN;
        g.beginPath(); g.roundRect(64, 210, bw2, 40, 8); g.__rawFill();
        g.fillStyle = '#091212'; g.textAlign = 'left';
        g.__rawFillText(bt, 80, 237);
        const chips = [T('잽'), T('잽'), T('훅')];
        const litN = Math.floor(tS * 1.4) % 4;
        let cx0 = 64;
        for (let i = 0; i < 3; i++) {
          g.font = '700 32px Overused, Pretendard, sans-serif';
          const cw = g.measureText(chips[i]).width + 44;
          if (i < litN) {
            g.fillStyle = HUD_MAIN;
            g.beginPath(); g.roundRect(cx0, 274, cw, 58, 12); g.__rawFill();
            g.fillStyle = '#091212';
          } else {
            g.strokeStyle = 'rgba(255,148,71,0.5)'; g.lineWidth = 2;
            g.beginPath(); g.roundRect(cx0, 274, cw, 58, 12); g.stroke();
            g.fillStyle = '#fec389';
          }
          g.fillText(chips[i], cx0 + 22, 350);
          cx0 += cw + 24;
        }
        g.fillStyle = HUD_INK; g.textAlign = 'right';
        g.font = NUMF(700, 96);
        g.fillText('×5', 1536, 140);
        g.font = '500 28px Overused, Pretendard, sans-serif'; g.globalAlpha = 0.85;
        g.fillText(T('연속 성공'), 1536, 176); g.globalAlpha = 1;
        const side3 = Math.floor(tS / 1.2) % 2;
        hudStreak(tS, side3 ? 690 : 910, 300, side3 ? 600 : 1000, 560, 1.2);
        hudCaption(g, T('잽-잽-훅 — 리듬 놓치지 말고'));
        break;
      }
      case 'BX_C4': {
        hudLockupCorner(g, T('마무리'), T('가드 내리고 숨 고르기'));
        const br = 1 + 0.25 * Math.sin(tS * 1.05);
        for (const [r0, a] of [[130, 0.2], [100, 0.45], [75, 0.9]]) {
          g.strokeStyle = '#fec389'; g.globalAlpha = a; g.lineWidth = 4;   // 호흡 = 가이드 (시안 회수)
          g.beginPath(); g.arc(300, 480, r0 * br, 0, 6.284); g.stroke();
          g.globalAlpha = 1;
        }
        g.fillStyle = '#fec389'; g.textAlign = 'center';
        g.font = '500 30px Overused, Pretendard, sans-serif';
        g.fillText(T('들숨 — 링 따라 크게'), 300, 660);
        g.fillStyle = HUD_INK; g.textAlign = 'right';
        g.font = NUMF(700, 64);
        g.fillText('118 ↓', 1536, 128);
        g.font = '500 28px Overused, Pretendard, sans-serif'; g.globalAlpha = 0.85;
        g.fillText(T('심박 회복'), 1536, 164); g.globalAlpha = 1;
        break;
      }
      case 'BX_FIN': {
        // 세션 결과 — 세로 원컬럼 구성 (Nike 결과 카드 히어로 배지 + Strava 아이브로 수치 + Track Info 룰)
        const cx = 800;
        // ① 아이브로 + 타이틀 + 도티드 룰
        const k1 = aIn(0.0), k2 = aIn(0.12), k3 = aIn(0.3, 0.5);
        g.textAlign = 'center';
        if (k1 > 0) {
          g.save(); g.globalAlpha = k1;
          g.fillStyle = '#fec389'; g.font = '600 30px Overused, Pretendard, sans-serif';
          g.fillText(T('섀도복싱 · 잽 — 오늘의 결과'), cx, 96);
          g.restore();
        }
        if (k2 > 0) {
          g.save(); g.globalAlpha = k2; g.translate(0, (1 - k2) * 20);
          g.fillStyle = HUD_INK; g.font = '700 54px Overused, Pretendard, sans-serif';
          g.fillText(T('세션 완료'), cx, 160);
          g.restore();
        }
        if (k3 > 0) {
          g.fillStyle = '#fec389'; g.globalAlpha = 0.9;
          const half = 170 * k3;
          for (let dx = -half; dx <= half; dx += 18) { g.beginPath(); g.arc(cx + dx, 186, 2.4, 0, 6.284); g.fill(); }
          g.globalAlpha = 1;
        }
        // ② 히어로 메달 배지 — 아크 게이지 스윕 + 대수치 카운트업 (Nike 배지)
        const by = 400, br = 150;
        const kb = aIn(0.35, 0.9);
        // 도티드 외곽 링
        g.save(); g.globalAlpha = 0.85 * Math.min(1, kb * 1.5);
        g.strokeStyle = '#fec389'; g.lineWidth = 2.5; g.setLineDash([2, 12]);
        g.beginPath(); g.arc(cx, by, br + 22, 0, 6.284); g.stroke();
        g.setLineDash([]); g.restore();
        // 베이스 링 + 게이지 스윕
        g.strokeStyle = HUD_MAIN; g.globalAlpha = 0.25; g.lineWidth = 10;
        g.beginPath(); g.arc(cx, by, br, 0, 6.284); g.stroke(); g.globalAlpha = 1;
        g.lineCap = 'round'; g.lineWidth = 10;
        g.strokeStyle = HUD_MAIN;
        g.beginPath(); g.arc(cx, by, br, -1.5708, -1.5708 + 6.283 * (pct / 100) * kb); g.stroke();
        g.lineCap = 'butt';
        // 대수치 — 링 내접 (초과 금지: OffBit 104px '67%' ≈ 300 < 지름 350)
        g.fillStyle = HUD_INK; g.font = NUMF(800, 104);
        g.fillText(Math.round(pct * kb) + '%', cx, by + 36);
        // 캡션 = 링 밖 아래 (링 안 텍스트는 수치 하나만 — 영역 초과 방지)
        g.fillStyle = '#fec389';
        mixedText(g, T('PACK 일치도 — 지난번 +6%'), cx, by + br + 64, 600, 25);
        // ③ 수치 3열 — 아이브로 위·대수치 아래 (Strava 위계)
        const cols = [[T('맞힌 잽'), '12'], [T('최고 콤보'), '×5'], [T('평균 잽 속도'), '7.2']];
        cols.forEach(([lab, val], i) => {
          const kc = aIn(0.7 + i * 0.12);
          if (kc <= 0) return;
          const colx = cx + (i - 1) * 300;
          g.save(); g.globalAlpha = kc; g.translate(0, (1 - kc) * 24);
          g.fillStyle = '#fec389'; g.font = '600 28px Overused, Pretendard, sans-serif';
          g.fillText(lab, colx, 660);
          g.fillStyle = HUD_INK; g.font = NUMF(800, 64);
          g.fillText(val, colx, 730);
          g.restore();
        });
        // 열 구분 수선
        const kd = aIn(0.95, 0.5);
        if (kd > 0) {
          g.strokeStyle = '#fec389'; g.globalAlpha = 0.5 * kd; g.lineWidth = 2;
          for (const dx of [-150, 150]) {
            g.beginPath(); g.moveTo(cx + dx, 700 - 32 * kd); g.lineTo(cx + dx, 700 + 32 * kd); g.stroke();
          }
          g.globalAlpha = 1;
        }
        // ④ 하단 심박 회복 + 다시보기
        const k5 = aIn(1.1);
        if (k5 > 0) {
          g.save(); g.globalAlpha = k5;
          g.fillStyle = '#fec389';
          mixedText(g, T('심박 회복 132 → 118'), cx, 812, 600, 24);
          g.fillStyle = HUD_CYAN; g.font = '500 30px Overused, Pretendard, sans-serif';
          g.fillText(T('다시보기 — 코치 잽과 내 자세 겹쳐 보기 →'), cx, 872);
          g.restore();
        }
        break;
      }
    }
  }
  let hudLastT = 0, hudStageT0 = 0, hudStageId = '';
  function renderWallHUD() {
    const st = session.active && state.pack === 'boxing' ? session.curStage : null;
    const on = !!st && st.id?.startsWith('BX_');
    hudPanel.visible = on;
    ctaPanel.visible = on;
    if (!on) gridScanPanel.visible = false;
    // 구 벽 텍스트 시스템 중복 억제 (복싱 = HUD가 록업·자막 담당)
    if (state.pack === 'boxing') {
      for (const s of [session.wSlotFS, session.wSlotFL, session.wSlotFM]) if (s) s.visible = s.visible && !on;
    }
    if (!on) return;
    if (rig.wallClip && hudPanel.material.clippingPlanes !== rig.wallClip)
      hudPanel.material.clippingPlanes = rig.wallClip;
    const wc = rig._wallCenter;
    hudPanel.scale.set(rig.wallW / 3.2, rig.wallH / 2.0, 1);   // 캔버스 1600×1000 = 벽 전체 추종
    hudPanel.position.set(wc ? wc.cx : 0, ((wc?.cy ?? 1.4) - rig.wallH / 2) + rig.wallH / 2, WALL_Z + 0.028);
    hudInkCore = false;   // 채도 코어 기각(유저: 흰색이 노랑으로 물듦) — 코어는 항상 화이트
    hudPanel.material.uniforms.uBoost.value = FXP.day ? 2.6 : 1.7;   // 자연광 풀컬러 레이저 전제 = 당당한 풀 광량
    ctaPanel.material.uniforms.uBoost.value = FXP.day ? 1.45 : 1.15;   // 주변 광량과 위계 정합 (2.6은 블로우아웃)
    ctaPanel.position.copy(hudPanel.position); ctaPanel.scale.copy(hudPanel.scale);
    if (rig.wallClip && ctaPanel.material.clippingPlanes !== rig.wallClip)
      ctaPanel.material.clippingPlanes = rig.wallClip;
    gridScanPanel.visible = true;
    gridScanPanel.position.copy(hudPanel.position); gridScanPanel.position.z -= 0.006;
    gridScanPanel.scale.copy(hudPanel.scale);
    if (rig.wallClip && gridScanPanel.material.clippingPlanes !== rig.wallClip)
      gridScanPanel.material.clippingPlanes = rig.wallClip;
    const GU = gridScanPanel.material.uniforms;
    GU.uTime.value = performance.now() / 1000;
    GU.uBoost.value = FXP.day ? 1.15 : 0.85;
    GU.uLines.value.setHex(0xfec389);   // 연주황 칩 (레드 기각 — 유저)
    GU.uScan.value.setHex(0xfe6e3c);    // 주황 칩
    GU.uAccent.value.setHex(COLORS.user ?? 0x21ccdb);
    const now = performance.now() / 1000;
    if (st.id !== hudStageId) { hudStageId = st.id; hudStageT0 = now; }
    if (now - hudLastT < 1 / 15) return;
    hudLastT = now;
    const tS = now - hudStageT0;
    const g = hudCtx;
    hudSyncPalette();
    g.clearRect(0, 0, HUDW, HUDH);
    // CTA: 매 리드로 클리어, 업로드는 [그린 프레임] 또는 [잔존 제거 1회]만 —
    // 이전 게이트가 안 그린 프레임에 클리어를 생략해 버튼이 전 장면에 잔류(유저)
    ctaCtx.clearRect(0, 0, HUDW, HUDH);
    ctaDrawn = false;
    drawStage(g, st.id, tS);
    hudTex.needsUpdate = true;
    if (ctaDrawn) { ctaTex.needsUpdate = true; }
    else if (ctaHas) { ctaTex.needsUpdate = true; ctaHas = false; }
  }

  // ── 복싱 벽면 인물 시범 = FX Lab PERSON_FRAG 정본 포트 (인물 — 실사 복서 + 잔상) ──
  //    소스: 랩 카드와 동일한 실사 스틸 8장(public/person/) → 4×2 아틀라스, 같은 수식·같은 LUT.
  //    잔상 = 아틀라스 과거 프레임 3탭 (랩 그대로 — 핑퐁 불필요). 출력만 가산광(라이브 규약).
  // 코치 소스 = 외부 실사 영상의 '사전 베이크' 마스크 아틀라스 (오프라인 세그+EMA — 런타임 세그 0회)
  //   bx_2161 워밍업 → 64프레임 @15fps, 8×8 그리드 200×112. 재베이크: __bakeStep 시퀀스(메모리 (140)).
  // 코치 기본 = 정본 스틸(검증된 미학). 크로마키/알파 실사 소스가 확보되면 COACH만 교체:
  //   { url:'person/coach_mask_atlas.png', cols:8, rows:8, n:64, fps:15, direct:1 } (베이크 절차 = 메모리 (140))
  const COACH = { stills: true, cols: 4, rows: 2, n: 8, fps: 1000 / 150, direct: 0 };
  const bxAtlas = document.createElement('canvas'); bxAtlas.width = 176 * 4; bxAtlas.height = 288 * 2;
  const bxAtlasTex = new THREE.CanvasTexture(bxAtlas);
  bxAtlasTex.flipY = false;   // 캔버스 y-다운 규약 (tileUV가 1-uv.y 플립)
  bxAtlasTex.minFilter = THREE.LinearFilter; bxAtlasTex.magFilter = THREE.LinearFilter;
  let bxPersonReady = false;
  {
    const ag = bxAtlas.getContext('2d');
    let loaded = 0;
    for (let i = 0; i < 8; i++) {
      const im = new Image();
      im.src = import.meta.env.BASE_URL + 'person/boxer_' + i + '.jpg';
      im.onload = () => {
        ag.drawImage(im, (i % 4) * 176, Math.floor(i / 4) * 288, 176, 288);
        if (++loaded === 8) { bxAtlasTex.needsUpdate = true; bxPersonReady = true; }
      };
    }
  }
  const bxPerson = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7 * 176 / 288, 1.7),   // 스틸 타일 종횡비 × 실신장 1.7m
    new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: bxAtlasTex }, uLUT: { value: getLUT() },
        uFrame: { value: 0 }, uDecay: { value: 0.6 }, uTime: { value: 0 },
        uCols: { value: COACH.cols }, uRows: { value: COACH.rows }, uN: { value: COACH.n }, uDirect: { value: COACH.direct },
        uW: { value: 1 }, uNoise: { value: 0.55 },
      },
      vertexShader: `#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`,
      fragmentShader: `#include <common>
#include <clipping_planes_pars_fragment>
        varying vec2 vUv;
        uniform sampler2D uAtlas, uLUT;
        uniform float uFrame, uDecay, uTime, uW, uNoise, uCols, uRows, uN, uDirect;
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
        float phash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float pvn(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f*f*f*(f*(f*6.0-15.0)+10.0);
          return mix(mix(phash(i), phash(i+vec2(1,0)), f.x), mix(phash(i+vec2(0,1)), phash(i+vec2(1,1)), f.x), f.y);
        }
        float pfbm(vec2 p){ return pvn(p)*0.55 + pvn(p*2.13+7.7)*0.28 + pvn(p*4.31+3.1)*0.17; }
        vec2 tileUV(vec2 uv, float f){
          float ff = mod(f + uN * 2.0, uN);
          float cx = mod(ff, uCols), cy = floor(ff / uCols);
          return (vec2(uv.x, 1.0 - uv.y) + vec2(cx, cy)) / vec2(uCols, uRows);
        }
        float mask1(vec2 uv, float f){
          vec3 rgb = texture2D(uAtlas, tileUV(uv, f)).rgb;
          float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
          float m = uDirect > 0.5 ? smoothstep(0.30, 0.55, lum) : smoothstep(0.52, 0.34, lum);
          m *= smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);
          return m;
        }
        float maskF(vec2 uv, float fk){
          float f0 = floor(fk);
          return mix(mask1(uv, f0), mask1(uv, f0 + 1.0), fract(fk));
        }
        void main(){
          #include <clipping_planes_fragment>
          vec2 uv = vUv;
          float m = maskF(uv, uFrame);
          float trail = 0.0;
          for (int j = 1; j <= 3; j++) {
            float w = pow(uDecay, float(j));
            trail = max(trail, maskF(uv, uFrame - float(j) * 0.85) * w);
          }
          trail *= (1.0 - m);
          float mSoft = m * 0.36;
          for (int k = 0; k < 4; k++) {
            float a = 1.5708 * float(k) + 0.7;
            mSoft += maskF(uv + vec2(cos(a), sin(a)) * 0.011 * uW, uFrame) * 0.16;
          }
          float flow = pfbm(vec2(uv.x * 3.2 + sin(uTime * 0.4) * 0.3, uv.y * 2.4 - uTime * 0.5));
          float flow2 = pfbm(vec2(uv.x * 6.5 - uTime * 0.22, uv.y * 5.2 - uTime * 0.9));
          float vert = pow(1.0 - uv.y, 1.35) * 0.92 + 0.06;
          float heat = mix(vert, clamp(vert + (flow - 0.5) * 0.55 + (flow2 - 0.5) * 0.25, 0.0, 1.0), uNoise);
          heat += clamp(m - mSoft, 0.0, 1.0) * 0.10;
          vec3 col = lut(clamp(heat, 0.0, 1.0)) * mSoft * 1.12;
          col += lut(clamp(heat * 0.45, 0.0, 1.0)) * trail * 0.38;
          // 알파 = 실루엣 마스크 추종 — 알파 1.0 고정이 흰 벽에서 쿼드 사각 박스로 드러났음 (유저)
          gl_FragColor = vec4(col, clamp(max(mSoft * 1.15, trail * 0.5), 0.0, 1.0));
        }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    }));
  bxPerson.material.clipping = true;
  bxPerson.position.set(0.42, 1.7 / 2 + 0.12, WALL_Z + 0.03);   // 투사 영역 안 (클리핑이 최종 보증)
  bxPerson.renderOrder = 5;
  bxPerson.visible = false;
  scene.add(bxPerson);
  function renderBxPerson() {
    const on = bxPersonReady && state.pack === 'boxing' && session.active && !session.isLive
      && DEMO_CLIP_MODE !== 'wall';   // 실사 벽 시험 중엔 아틀라스 복서 숨김
    bxPerson.visible = !!on;
    if (!on) return;
    if (rig.wallClip && bxPerson.material.clippingPlanes !== rig.wallClip) bxPerson.material.clippingPlanes = rig.wallClip;
    const wc = rig._wallCenter;
    bxPerson.position.set(wc ? wc.cx : 0, 1.7 / 2 + 0.12, WALL_Z + 0.03);   // 유저 정면 = 벽 중심 추종
    const U = bxPerson.material.uniforms;
    const ms = performance.now();
    U.uFrame.value = (ms / 1000 * COACH.fps) % COACH.n;
    U.uTime.value = ms / 1000;
    U.uDecay.value = FXP.person?.decay ?? 0.6;
    U.uNoise.value = FXP.person?.flow ?? 0.55;
    U.uW.value = FXP.person?.blur ?? 1;
  }

  switchPack('running');
  document.getElementById('loading').style.display = 'none';

  const clock = new THREE.Clock();



  // 비실전 단계 봇 시연 클립 매핑 (가진 클립으로 근사 — 코치가 동작을 보여줌)
  function demoClipFor(sport, id) {
    // 준비운동(A) 단계 = 절차적 드릴 — 봇이 실제 그 동작을 수행 (기존엔 전부 warmup/dribble)
    const DRILL = {
      // 러닝 준비운동 = 동적 워밍업(스포츠과학: 러닝 전 정적 홀드 비권장). A1=CMU 42_01 실측
      // 전신 풀기, A2=Mixamo 점핑잭 실측, A3=다리 스윙(동적 드릴 유지). FIN=쿨다운 쿼드
      // 스트레치(quad_src.mp4 실사 비디오모캡 — 정적 스트레치의 올바른 위치는 운동 후).
      // A단계 v2(유저 기준: 퀄리티·지면 가이드 매력·설명 용이) — 전부 햇지런 실측 + 프로브 구동 UI.
      // A1 사이드 런지 프레스(원 눌러 채우기) · A2 레그 스윙 · A3 니 허그. T1 대기=CMU 스트레칭, FIN=쿨다운 쿼드.
      // 러닝 A 3종 확정(유저 지정): A1 목·어깨(Mixamo 실측) · A2 교대 런지(CMU 144_17, 유저 요청 확보) · A3 서서 쿼드 잡기(실사 모캡)
      // A1 목·어깨: neckShoulder(목 먼저 2바퀴 → 어깨 롤 3바퀴, 순차 저작 — 유저 지정).
      // 주의: imp_warming_up_1_은 라벨과 달리 복싱 가드 동작(인제스트 라벨 오류) — 사용 금지.
      // A2: cmu144_17 실측 런지(다리 자연스러움) + 팔만 중립 덮어쓰기(_relaxArms) — 절차 런지는 다리가 어색(유저)
      A1: 'neckShoulder',              // 목 먼저 → 어깨 (순차)
      A2: 'auto_cmu144_11',            // Left_Lunges — 무릎 15cm 깊은 실측 런지
      A3: 'kneeTwist',                 // 무릎 올리며 몸통 비틀기 (절차·리듬 1.2s/rep — cmu14_20엔 클린 하이니 없음)
      T1: 'neckStretch', T2: 'armStretch', FIN: 'quadStretch',
      // 복싱 = Mixamo 실측 모캡 (목풀기만 절차)
      BX_A1: 'bx_neck', BX_A2: 'boxGuard', BX_A3: 'boxJab',
      BX_B1: 'boxGuard', BX_B2: 'boxGuard', BX_B3: 'boxCombo',
      BX_READY: 'boxGuard', BX_T1: 'boxGuard', BX_T2: 'boxGuard', BX_C1: 'boxGuard',
      // 농구 — CMU 06 실측: A3 로우 프리스타일 드리블, B1·B2 크로스오버+슛(시그니처 무브 시범/분해),
      // B3 컷·감속(드리블 컷 구간 창). 시작 화면(READY)은 러닝과 동일 calm idle(공 없음)
      // 농구 A단계 v2: A1 스쿼트·A2 사이드 런지 프레스(햇지런 실측) · A3 리듬 드리블(CMU)
      BK_READY: 'idle', BK_A1: 'airSquat', BK_A2: 'stomp_press', BK_A3: 'cmu_dribble_low',
      // B1 시범 = 06_15 드리블→슛(온전한 무브 원테이크), B2 분해 = 06_14 크로스오버+슛 위상잠금
      BK_B1: 'cmu_crossover_shot', BK_B2: 'cmu_crossover_shot', BK_B3: 'cmu_crossover_shot',
    };
    if (DRILL[id] && xbot.actions[DRILL[id]]) return DRILL[id];
    if (sport === 'basketball') return 'dribble';           // 그 외 제자리 드리블
    if (sport === 'boxing') return /B\d/.test(id) ? 'hook' : 'warmup';
    // 러닝: 대기·전환(READY/T1/T2/FIN)=자연 호흡 idle(Mixamo Breathing Idle, 손 내림). 완전정지 어색(유저) → 재생.
    if (['READY', 'T1', 'T2', 'FIN'].includes(id)) return 'idle';
    return 'run';
  }

  // 시뮬 1스텝 (서브스텝 단위 — 백그라운드 탭 스로틀에도 정속·정밀 유지)
  function stepSim(h) {
    const data = state.packs[state.pack];
    if (!data) return;
    // 러닝 준비운동(A 스트레치): 빔을 앞발 지면에 락 — 무게이동으로 빔다리(뒷발) 흔들려도 앞발 링 고정(미래 짐벌 보정).
    // 투사 정책(실측 근거): 데모 스테이지 중 정강이 ω가 경계권인 농구 드리블(BK_A3 avg 143dps·
    // 스윙 41%, BK_B3 137dps·44%)도 러닝 A단계처럼 빔을 앞발 지면에 락 — 무릎 원점 요동 격리.
    rig.beamGroundLock = session.active && (
      (session.sport === 'running' && /^A\d/.test(session.stage || '')) ||
      (session.sport === 'basketball' && /^BK_[AB]\d/.test(session.stage || '')));
    if (rig.beamGroundLock) {
      const pb = xbot.getProbes?.();
      if (pb?.footL && pb?.footR) {
        // 제자리 동작(A2 런지·A3 하이니 등 발이 크게 움직이는)은 몸(hips) 기준 안정 앵커 —
        //   앞발 앵커면 발이 위아래·앞뒤로 튈 때 투사면이 같이 흔들림(유저 A3 흔들림 지적).
        //   A1(목·어깨, 발 고정)만 앞발 그대로.
        const anchor = /^(A2|A3|BK_A2|BK_A3)$/.test(session.stage || '') && pb.hips
          ? { x: pb.hips.x, z: pb.hips.z } : (pb.footL.z < pb.footR.z ? pb.footL : pb.footR);
        if (!rig._beamTgt) rig._beamTgt = { x: anchor.x, z: anchor.z };
        rig._beamTgt.x += (anchor.x - rig._beamTgt.x) * 0.08;          // 저역통과(지터 제거)
        rig._beamTgt.z += (anchor.z - rig._beamTgt.z) * 0.08;
        rig.beamTarget = rig._beamTgt;
      }
      // 정직한 투사각(유저: 빔프는 종아리 우측 옆 단일 유닛, 바로 아래는 못 비춤):
      // near 시작을 몸 앞 0.3m로 — 종아리 높이/최대 하향각이 정하는 최소 투사 거리(수직 투사 금지).
      rig.fpNear = 0.30; rig.fpFar = Math.max(1.9, rig.fpNear + 0.3);
    } else {
      rig.beamTarget = null; rig._beamTgt = null;
      // 라이브(P/C) = 전방 투사 연장(유저: 시선 앞에 미리 보여야) — near 0.4/far 2.4m.
      // 달릴 땐 정강이가 뒤로 차올려져 하향각 여유가 생김 + 짐벌 틸트 보정 가정(5년 뒤 스펙).
      if (session.active && session.isLive && session.sport === 'running') {
        // near 0.25 = 착지점(발밑) 커버(유저: 밟는 순간 글로우가 잘리면 안 됨) — 정강이 후방 스윙
        // 순간 하향각 + 알고리즘 보정 가정. far 2.4 = 시선 앞 선행 마크.
        rig.fpNear = 0.25; rig.fpFar = 2.4;
      } else rig.fpNear = 0.05;
    }
    // BK_C4 릴리즈 = 실측 점프샷 원샷 (xbot 농구 라이브 경로에서 크로스페이드)
    xbot.bkShot = session.active && session.stage === 'BK_C4';
    // 팩 판정 토큰 필드 정책(검증된 경로): 세션 비실전 전면 숨김 + 라이브 중 릴리즈(C4)도 숨김.
    // 비실전 복귀(라이브 진입) 시에만 다시 켬 — 스트레칭·학습·전환 화면의 무관 마커 원천 차단.
    if (session.active) tokens.floorRoot.visible = session.isLive && session.stage !== 'BK_C4';
    // 스톰프 프레스 스테이지: 봇을 뒤로 당겨 착지(전방 0.38m)가 프레스 원 위에 정확히 떨어지게
    if (session.active && !session.isLive && data.sport !== 'boxing') {
      // A2 런지: 봇을 뒤로 당겨 전방 착지가 프레스 원(-1.30) 위에 오게 (교대 런지 보폭 ≈0.7m 가정, 시각 검수로 보정)
      xbot.demoStandZ = session.stage === 'A2' ? -1.0 : (session.stage === 'BK_A2' ? -1.22 : (session.stage === 'BK_A3' ? -1.9 : (/^BK_B[123]$/.test(session.stage) ? -1.85 : 0)));
    }
    // 지면 풀스크린 화면(세션 컴플리트·전환·카운트다운) = 3인칭 봇도 바닥의 화면을 응시(머리 숙임).
    xbot.headPitch = (session.active && /^(T1|T2|C1|FIN|BK_T1|BK_T2|BK_C1|BK_FIN)$/.test(session.stage || ''))
      ? THREE.MathUtils.degToRad(24) : 0;
    if (!session.active && sessionDroveGaze) {
      // 세션 종료 → 수동 시선각 복귀 (세션이 남긴 단계값이 디폴트처럼 굳는 것 방지)
      sessionDroveGaze = false;
      gazePitch = THREE.MathUtils.degToRad(manualGazeDeg);
      const sl = document.getElementById('s-pitch'), lb = document.getElementById('v-pitch');
      if (sl) sl.value = manualGazeDeg;
      if (lb) lb.textContent = `${manualGazeDeg}°`;
    }
    // 세션 비실전 단계: 팩 시간 정지, 봇은 단계별 동작을 제자리 시연(코치)
    if (session.active && !session.isLive) {
      session.update(h);
      updateSessionGaze(h);
      state.time = 0;
      // 비실전 단계엔 러너가 전진하지 않으므로 무한트랙 시프트를 원점 고정 — 재시도로 누적된
      // loopShiftZ 드리프트가 P/스트레치 단계에서 마크·판정 토큰을 지평선 밖에 남기던 문제.
      if (data.sport === 'running' || data.sport === 'basketball') { tokens.loopShiftZ = 0; state.loop = 0; }
      tokens.update(0, 0);
      // hold=포즈 고정(복싱 READY 가드 유지). 러닝 대기는 idle 재생(호흡)이라 hold 안 함.
      // 러닝 준비운동(A) = 코치 드릴을 세션 스테이지 시간(session.t)에 위상 잠금 → 씬 링·카운트·음성과 동기(유저: '타이밍 하나하나 맞춰')
      if (session.stage !== 'A2' && xbot.group.scale.x !== 1) xbot.group.scale.x = 1;   // A2 미러 잔류 방지
      let _clip = demoClipFor(session.sport, session.stage);
      // A2/A3 = 2단계 흐름(유저): [0~5s 관찰] 봇은 가만히 서서(idle) 전문가 영상 보기 → [5s~ 따라하기].
      // 뉴턴 전환 문법(유저 확정): 시범(영상만·도트바) → 마크 Preview 워밍 등장+음성 → 따라하기.
      //   3·2·1은 실전 트리거(C1) 전용 — 학습 내 전환엔 안 씀(복싱 문법과 통일).
      const A2_WATCH = 5.0;   // 시범 = 무조건 5초(유저: 3초는 너무 짧음) — 미니 타이머 링과 동기
      const _watchWin = /^(A2|A3)$/.test(session.stage || '') && !session._followLatch;
      const aWatching = _watchWin && session.t < A2_WATCH;
      if (_watchWin && !aWatching) { session._followLatch = true; session._aWatchEnd = session.t; }
      if (aWatching) { _clip = 'idle'; xbot.group.scale.x = 1; xbot.lungeDeepen = 0; xbot.headPitch = THREE.MathUtils.degToRad(-32); }
      // 위상잠금: 씬 링·카운트와 코치 동작을 같은 시간축에 — 절차 드릴 + A1 전신풀기·A2 점핑잭(주기=씬 BT).
      // BK_B2 = 분해 밟기: 씬 3s 사이클당 크로스오버 1회(마크 1-2-3과 사이클 동기).
      // BK_B3 = 컷·감속: 로우 드리블 클립의 컷 구간(16~21s) 창 반복. 그 외 실측 모캡은 자연 속도(왜곡 방지).
      let _phase = null;
      if (_clip === 'stomp_press') _phase = session.t;
      else if (session.stage === 'A1') _phase = session.t;   // A1 neckShoulder 목부터 시작 (잔여 _demoT 위상 오류 방지)
      else if (session.stage === 'A3') _phase = Math.max(0, session.t - (session._aWatchEnd ?? A2_WATCH));   // 시범 후 하이니 (1.6배속 철회 — 동작 딱딱해짐)
      else if (session.sport === 'running' && (/^run_|^hj_/.test(_clip) || _clip === 'cmu_stretch' || _clip === 'jumpingJacks')) _phase = session.t;
      else if (session.stage === 'A2') {
        if (aWatching) { session.a2Cyc = { watching: true, watchProg: Math.max(0, Math.min(1, session.t / A2_WATCH)) }; }
        else {
        // 실측 사이클(cmu144_11) — 시범 종료 후부터(tt): 첫 홀드가 깔끔히 시작.
        const tt = session.t - (session._aWatchEnd ?? A2_WATCH);
        const T0 = 5.4, TD = 6.5, T1 = 8.1, HOLD = 5.0;
        const DESC = TD - T0, RISE = T1 - TD, CYC = DESC + HOLD + RISE;
        const c = tt % CYC;
        _phase = c < DESC ? T0 + c : (c < DESC + HOLD ? TD + Math.sin(tt * 1.6) * 0.07 : TD + (c - DESC - HOLD));
        xbot.group.scale.x = (Math.floor(tt / CYC) % 2) ? -1 : 1;
        const _hs = Math.max(0, Math.min(1, (c - DESC) / 0.6)), _he = Math.max(0, Math.min(1, (DESC + HOLD - c) / 0.6));
        xbot.lungeDeepen = 0.35 * Math.min(_hs, _he);
        session.a2Cyc = { inHold: c >= DESC && c < DESC + HOLD, prog: Math.max(0, Math.min(1, (c - DESC) / HOLD)),
          holdSec: HOLD, isLeft: (Math.floor(tt / CYC) % 2) === 0, descending: c < DESC };
        }
      }
      else if (session.stage === 'BK_B1') _phase = session.t;
      else if (session.stage === 'BK_B2') _phase = Math.min((session.t * 0.5) % 3.2, 2.2);   // 플랜트까지 + 홀드(슛 제거)
      else if (session.stage === 'BK_B3') _phase = 1.55 + ((session.t * 0.55) % 2.45);   // 플랜트→백스텝→착지→슛 구간 0.55배 반복
      if (session.stage === 'BK_B3') xbot.stepbackDemo(h);   // 합성 시연(드리블→백스텝 분리→실측 점프샷)
      else xbot.playDemo(_clip, h, session.stage === 'BX_READY', _phase);
      rig.update(0, h);
      tokens.setShake(rig.shake.x, rig.shake.y);
      // 이 분기는 아래 followFloor 호출을 건너뛰어(early return) 무한 지면(그리드·바닥)이
      // 세션 시작 직전 스튜디오 대기 루프가 드리프트시킨 옛 z에 멈춰있었음 — 1인칭 카메라는
      // xbot의 새로 리셋된 위치를 따라가는데 바닥만 수백m 밖에 남아 "그냥 뿌옇게"(사실은 바닥
      // 자체가 시야 밖) 보였던 원인. READY/준비 단계에서도 동기화.
      if (data.sport === 'running') followFloor(xbot.group.position.z);
      return;
    }
    // 라이브 진입 에지(러닝/농구): 무한트랙 시프트(loopShiftZ)를 러너에 재정렬. 재시도·스테이지 점프로
    // 누적된 드리프트가 페이스 레인을 수십m 밖(지평선 오렌지 글로우)에 두던 문제 — 투사면 밖 그래픽 금지.
    const _liveNow = session.active && session.isLive && (data.sport === 'running' || data.sport === 'basketball');
    if (_liveNow && !_wasLive) { tokens.loopShiftZ = 0; state.loop = 0; state.time = 0; tokens.resetLoop?.(); }
    _wasLive = _liveNow;
    if (session.active) {
      session.update(h);
      updateSessionGaze(h);
    }
    state.time += h;
    if (state.time >= data.duration) {
      state.time %= data.duration;
      tokens.resetLoop();
      if (data.sport === 'running') {
        // 심리스 루프: 러너는 계속 전진, 마크 필드가 다음 구간으로 이동 — 텔레포트 없음
        state.loop = (state.loop || 0) + 1;
        tokens.loopShiftZ = -2.5 * data.duration * state.loop;
      } else {
        rig.resetOmega();   // 되감기 = 포즈 순간이동. ω 미분을 한 샘플 건너뛴다
      }
      renderReport(judge.finishLoop());   // 세션 리포트 (문서 03 루프)
    }
    tokens.update(state.time, h);
    // 러닝: 봇은 연속 시간으로 구동 (z = -V·t 영원히 전진, 클립 위상은 % 주기라 동일)
    const xbotT = data.sport === 'running' ? state.time + (state.loop || 0) * data.duration : state.time;
    xbot.update(xbotT, h);
    if (data.sport === 'running') followFloor(xbot.group.position.z);
    rig.update(state.time, h);
    // 1인칭 실물 뷰(visualize off) = 빔 볼륨·커버리지 숨김(실제 눈엔 투사 UI 광만). 단 커버리지 모드(👁 visualize on)면
    // 1인칭에서도 빔 그리드는 유지 — 훈련 중 투사 영역 확인용(유저: 눈 켜도 빨간 그리드 안 나옴).
    if (fpMode && rig.visualize === false) { rig.floorBeam.visible = false; rig.footFill.visible = false; }
    tokens.setShake(rig.shake.x, rig.shake.y);
    if (ghostMixer && ghostLayer?.visible) ghostMixer.update(h);
    // C5 쿨다운: 봇이 실제 감속해 마크에서 떨어진다 — 판정 시 가짜 miss가 리포트를 오염하므로 보류
    // (관찰 없이 지난 이벤트는 finishLoop에서 _jBest 없음 → 리포트 제외)
    if (!(session.active && session.stages?.[session.stageIdx]?.id === 'C5')) judge.update(state.time, xbot.getProbes());
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

  // ── 🗺 장면 명세 보드 — 실제 씬 그래프에서 자동 생성 (도식 근사 금지: 어긋날 수 없음) ──
  //    스테이지마다 "무엇이 뜨는지 + 어디서 고치는지"를 한눈에. READY 잔해 사고 재발 감시 겸용.
  {
    const SPEC_ROW = {
      text:  n => ['T', `"${n.userData.el.content ?? '텍스트'}"`, '고정 카피 — 장면 UI 규정 (session.js)'],
      foot:  () => ['👣', 'MARK 발형', '룩 › 글리프 FOOT 슬롯 · MARK 파라미터'],
      ring:  n => {
        const ph = n.material?.uniforms?.uPhase?.value;
        return ph === 3 ? ['◎', 'MARK Locked 고스트 존', '룩 › MARK']
             : ph === 5 ? ['◉', 'MARK Hold 진행 림', '룩 › MARK']
             : ['◉', 'MARK Preview 파동 존', '룩 › MARK 파라미터·팔레트'];
      },
      arc:   () => ['◉', 'MARK Hold 진행 림 (회전·유지·카운트)', '룩 › MARK'],
      arrow: () => ['➤', 'LINE 방향 화살표', '룩 › LINE (자루 스타일·촉 슬롯)'],
      stripe: () => ['―', 'LINE 자루 — 감속 리듬', '룩 › LINE'],
      box:   () => ['▭', '가드/스탠스 박스', '룩 › 프리미티브 › 스탠스'],
      sweep: () => ['▬', '스윕 밴드', '룩 › 프리미티브 › 스윕'],
      tap:   () => ['⊙', '두 번 탭 시작 계약 (입력 어포던스)', '고정 — 토큰 아님·장면 UI 규정'],
    };
    function collectSpecs(group) {
      const rows = [];
      const stack = [...(group?.children || [])];
      while (stack.length) {
        const n = stack.pop();
        const el = n.userData?.el;
        if (n.userData?.addedSpec) { rows.push(['✚', n.userData.addedSpec.kind, '스튜디오 추가 (이 장면에만)']); continue; }
        if (el && SPEC_ROW[el.type]) { rows.push(SPEC_ROW[el.type](n)); continue; }
        stack.push(...(n.children || []));
      }
      // 동일 행 집계 (링 ×3 처럼)
      const agg = new Map();
      for (const [ic, nm, src] of rows) {
        const k = ic + nm + src;
        if (agg.has(k)) agg.get(k).n++; else agg.set(k, { ic, nm, src, n: 1 });
      }
      return [...agg.values()];
    }
    let specEl = null;
    function openSpecMap() {
      if (specEl) { specEl.remove(); specEl = null; return; }
      const SPORT_KO = { running: '러닝', basketball: '농구', boxing: '복싱' };
      let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div><b style="font-size:15px">🗺 장면 명세</b>
        <span style="color:#8a8f98;font-size:11.5px;margin-left:10px">실제 씬 그래프에서 자동 생성 — 각 장면에 무엇이 뜨고, 어디서 고치는지</span></div>
        <button id="spec-close" style="background:none;border:1px solid #333;border-radius:6px;color:#ccc;padding:4px 10px;cursor:pointer">닫기</button></div>`;
      for (const [sport, stages] of Object.entries(STAGES)) {
        html += `<div style="font-weight:800;color:#fec389;margin:14px 0 6px">${SPORT_KO[sport] || sport}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px">`;
        for (const st of stages) {
          const rows = collectSpecs(session.G[st.id]);
          const ov = designStore.d.scenes?.[st.id];
          const ovN = (ov?.added?.length || 0) + Object.keys(ov?.patches || {}).length;
          html += `<div style="border:1px solid #262b33;border-radius:8px;padding:8px 10px;background:#12151b">
            <div style="font-size:11.5px;font-weight:700;margin-bottom:5px">${st.id} <span style="color:#8a8f98;font-weight:400">${st.label || ''}</span></div>
            ${rows.length ? rows.map(r => `<div style="font-size:11px;color:#cdd3da;margin:2px 0">${r.ic} ${r.nm}${r.n > 1 ? ` <b style="color:#fec389">×${r.n}</b>` : ''} <span style="color:#7b828c">— ${r.src}</span></div>`).join('') : '<div style="font-size:11px;color:#5b6069">투사 요소 없음 (음성·타이밍만)</div>'}
            ${st.cue ? `<div style="font-size:10.5px;color:#8fd0d8;margin-top:4px">큐: ${st.cue}</div>` : ''}
            ${ovN ? `<div style="font-size:10.5px;color:#fea35f;margin-top:4px">✎ 스튜디오 오버라이드 ${ovN}건</div>` : ''}
          </div>`;
        }
        html += '</div>';
      }
      specEl = document.createElement('div');
      specEl.style.cssText = 'position:absolute;inset:24px;z-index:40;background:rgba(10,12,16,.98);border:1px solid #2a2f38;border-radius:12px;padding:16px 18px;overflow:auto;color:#e8ebef;font-family:inherit';
      specEl.innerHTML = html;
      document.body.appendChild(specEl);
      specEl.querySelector('#spec-close').onclick = () => { specEl.remove(); specEl = null; };
    }
    document.getElementById('btn-specmap')?.addEventListener('click', openSpecMap);
  }

  if (import.meta.env.DEV) window.__dbg = {
    extractPose, retargetToClip,   // 비디오 모캡 (dev)
    rig, xbot, state, session, sceneScope, camera, controls, tokens, effects, scene, editor3d, sceneUI, FXP, designStore, TCFG, editCam, editControls, judge, THREE,
    renderer, demoVideo, renderDemoPanel, renderBxPerson,
    get floorObj() { return floorObj; },
    get demoSeg() { return demoSeg; }, initDemoSeg,
    makeImageSegmenter: async () => {
      const fileset = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + 'mediapipe-wasm');
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: import.meta.env.BASE_URL + 'models/selfie_segmenter.tflite' },
        runningMode: 'IMAGE', outputConfidenceMasks: true,
      });
    },
    get activeCam() { return studioActive ? editCam : camera; },
    get doc() { return studioDoc; },
    get canvas() { return studioCanvas; },
    get scope() { return studioScope; },
  };


  // 빌드 스탬프 — 캐시된 구버전 확인용 (좌하단 미세 표기)
  {
    const bs = document.createElement('div');
    bs.textContent = `build ${typeof __BUILD_TAG__ !== 'undefined' ? __BUILD_TAG__ : 'dev'}`;
    bs.style.cssText = 'position:absolute;bottom:4px;left:306px;z-index:29;font-size:9.5px;color:rgba(140,146,156,.55);pointer-events:none;font-family:monospace';
    document.body.appendChild(bs);
  }

  function loop() {
    requestAnimationFrame(loop);
    const rawDt = Math.min(clock.getDelta(), 2.0);
    _uiDt = Math.min(rawDt, 0.05);   // UI 앵커 스무딩용 실시간 dt (프레임 튐 방지 클램프)

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
    if (rig._fp) effects._fp = { ...rig._fp, near: rig.fpNear, far: rig.fpFar, halfN: rig._halfAt(rig.fpNear), halfF: rig._halfAt(rig.fpFar) };
    // ── 러닝 학습(Figma 122-308): 타이틀=구간명(라이브) + 내SPM/전문가SPM. 링(카운트다운)=스트라이드·인터벌만. ──
    {
      const tp = trainPhase();
      try {
        const fdoc = floorIframe.contentDocument;
        if (tp) {
          const col = tp.i > 0.7 ? '#ff8a5a' : tp.i > 0.45 ? '#ffcf9a' : '#fff';   // 강도 온도색
          // 타이틀 = 현재 구간명(리커버/스프린트 등). 보조텍스트 없음(유저).
          const title = fdoc?.getElementById('s-title');
          if (title && title.textContent !== tp.n) title.textContent = tp.n;
          // 내SPM / 전문가SPM (유저: 전문가 기준 대비 내가 몇). 전문가=기본 SPM×구간배속, 내=실측(없으면 대시).
          const tgtSpm = Math.round(60 / (tokens._beatT || 0.39) * tp.c);
          const me = fdoc?.getElementById('spm-me'); if (me) { const v = window.__mySpm ? String(window.__mySpm) : '--'; if (me.textContent !== v) me.textContent = v; }
          const tg = fdoc?.getElementById('spm-tgt'); if (tg && tg.textContent !== String(tgtSpm)) tg.textContent = tgtSpm;
          // 링(있을 때만 = P2/P3): arc 진행 + 회전 팁 + 실초 카운트다운
          const arc = fdoc?.getElementById('tp-arc');
          if (arc) {
            arc.style.strokeDashoffset = (1727.9 * (1 - (tp.prog || 0))).toFixed(1);
            if (arc.getAttribute('stroke') !== col) arc.setAttribute('stroke', col);
            const tip = fdoc.getElementById('tp-tip');
            if (tip) tip.style.transform = 'rotate(' + ((tp.prog || 0) * 360).toFixed(1) + 'deg)';
            // 카운트다운 = 처방 초(sec)에서 1초씩 감소(유저: 30/10초 세팅). phase sim길이=sec라 실제 1초/1sec.
            const num = fdoc.getElementById('tp-num');
            if (num) { const rem = String(Math.max(0, Math.ceil((tp.sec || 8) * (1 - (tp.prog || 0))))); if (num.textContent !== rem) num.textContent = rem; }
          }
        }
      } catch (e) { /* iframe 로드 전 */ }
      if (tp) {
        // 마크·봇이 실제로 빨라지고 느려짐 — liveSpeed 변조(session.t와 독립이라 구간 타이밍 안전). 부드럽게 추종.
        session._trainSpd = (session._trainSpd ?? tp.c) + (tp.c - (session._trainSpd ?? tp.c)) * 0.09;
        session.liveSpeed = session._trainSpd;
      } else { session._trainSpd = undefined; }
    }
    // 케이던스 메트로놈(사운드 우선 — 러닝 교수법: 목표 SPM은 귀로 먼저). 팩 박자 동기 클릭.
    // 실전=연습 통일(유저): P뿐 아니라 C 실전에서도 소리가 페이스를 가르친다.
    if (session.active && /^[PC]\d$/.test(session.stage || '') && session.sport === 'running' && ttsOn && tokens._beatT > 0.2) {
      // 훈련 구간 케이던스 = 메트로놈 템포에 반영 (전력 빠르게·회복 느리게). 소리가 페이스를 가르침.
      const metroBeatT = tokens._beatT / (trainPhase()?.c || session.curStage?.cadence || 1);
      const ph = Math.floor(state.time / metroBeatT);
      if (ph !== _metroPh) {
        _metroPh = ph;
        try {
          if (!_metroCtx) _metroCtx = new (window.AudioContext || window.webkitAudioContext)();
          const o = _metroCtx.createOscillator(), gn = _metroCtx.createGain();
          o.frequency.value = 1700; gn.gain.setValueAtTime(0.06, _metroCtx.currentTime);
          gn.gain.exponentialRampToValueAtTime(0.001, _metroCtx.currentTime + 0.05);
          o.connect(gn); gn.connect(_metroCtx.destination);
          o.start(); o.stop(_metroCtx.currentTime + 0.05);
        } catch (e) { /* 오디오 정책 — 제스처 후 재생 */ }
      }
      // 내 케이던스 실측 vs 목표(유저: 학습자는 항상 목표와 다름 — 비교가 학습) — 접지 간격→SPM
      const pbc = xbot.getProbes?.(), nowS = performance.now() / 1000;
      const lc = (pbc?.footL?.y ?? 1) < 0.05, rc = (pbc?.footR?.y ?? 1) < 0.05;
      if (lc && !_lcPrev) _strikeTs.push(nowS);
      if (rc && !_rcPrev) _strikeTs.push(nowS);
      _lcPrev = lc; _rcPrev = rc;
      while (_strikeTs.length > 7) _strikeTs.shift();
      if (nowS - _spmUpd > 0.5) {
        _spmUpd = nowS;
        let my = 0;
        if (_strikeTs.length >= 3) {
          const iv2 = (_strikeTs[_strikeTs.length - 1] - _strikeTs[0]) / (_strikeTs.length - 1);
          if (iv2 > 0.15 && iv2 < 2) my = Math.round(60 / iv2);
        }
        window.__mySpm = my;   // 실전 플로어 UI(V5 스트립)가 소비

        try {
          const me = floorIframe.contentDocument?.getElementById('spm-me');
          if (me && my) {
            me.textContent = my;
            const tgt2 = Math.round(60 / (tokens._beatT || 0.39));
            me.style.color = Math.abs(my - tgt2) <= 8 ? '#d1feff' : '#fff';   // 근접=아이스(성공 온도)
          }
        } catch (e) { /* iframe 로드 전 */ }
      }
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
        // 세션 중엔 시선 방위 고정(-z 전방) — 데모 봇의 골반 회전(제자리 달리기·걷기)이
        // 카메라를 좌우로 요잉시켜 프레임을 무너뜨리던 문제. 피치는 세션 단계값이 계속 담당.
        let fwd = session.active ? FP_FWD_FIXED : xbot.getForward();
        // 단, 비실전 '데모' 단계(목돌리기·스트레치)에선 실제 머리 회전을 시선에 붙임 —
        // 눈이 머리에 달렸으니 목을 돌리면 시야도 함께 흔들려야(유저). 골반 요잉이 없는 구간만.
        if (session.active && !session.isLive) {
          const sw = xbot.getHeadSwing?.();
          if (sw) {
            const s = new THREE.Quaternion().slerp(sw, 0.25);   // 감쇠 25% — A3 상체 비틀림 따라 카메라 과하게 돌던 것 완화(유저)
            fwd = FP_FWD_FIXED.clone().applyQuaternion(s);
          }
        } else { xbot.resetHeadSwing?.(); }
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
        // 복싱 벽 스테이지: UI 벽면 전체(좌우·상하 끝)가 한눈에 들어오는 최소 후퇴 강제
        // (유저 교정: '1인칭에서 벽 끝이 다 보여야') — 실제 카메라 FOV로 산출
        if (session.active && state.pack === 'boxing' && session.curStage?.wall) {
          const vf = camera.fov * Math.PI / 180;
          const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
          const needH = (rig.wallW / 2 + 0.12) / Math.tan(hf / 2);
          const needV = (rig.wallH * 0.64 + 0.12) / Math.tan(vf / 2);
          fpPos.z = Math.max(fpPos.z, WALL_Z + Math.max(needH, needV));
        }
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
    // 장비 시각화(인식 볼륨·최적 링)는 커버리지 시각화와 같은 층 — 실물 뷰(👁)에선 숨김.
    // 훈련 장면의 주인공은 투사 UI: 설비 설명 그래픽이 큐를 압도하지 않는다.
    const boxOn = state.pack === 'boxing' && !fpMode && rig.visualize !== false;
    trackVol.visible = trackEdge.visible = boxOn;
    optRing.visible = camMark.visible = boxOn;

    // 농구 방향·리듬 큐 — 렌더는 전부 카탈로그 토큰 (화살표 촉·자루는 tickFlowArrows가 급이)
    // 시작 페이지(BK_READY)에선 방향/리듬 큐 숨김 — floor UI가 전담(유저: mark 판정 토큰 제거).
    // A/B/C 운동중엔 이 큐가 중앙 콘텐츠(발자국·가이드)라 유지.
    // 세션 중엔 전면 OFF — 세션은 자체 가이드(실측 스텝·프레스)가 전담. 이 레거시 큐가
    // 모든 농구 세션 화면에 '존원 3개+화살표+레인'으로 남아 정체불명 마커로 보이던 근본
    // (유저 스크린샷 다수 — 원인 추적 최종 확정).
    const bkOn = state.pack === 'basketball' && rig._fp && !session.active;
    bkArrow.visible = bkLane.visible = bkOn;
    // 앰비언트 토포 공간 (농구 두 투사면 — 세션·재생 중 상시 은은)
    // 앰비언트 토포 필드 기각(유저): 존 경계 없는 전면 랜덤 라인 = 바닥 얼룩으로 보임.
    // 재질(makeTopoMaterial)은 보존 — 존 '내부' 채움으로만 재사용할 것.
    bkTopoFloor.visible = false;
    bkTopoWall.visible = false;
    bkBeats.forEach(b => b.visible = bkOn);
    if (bkOn) {
      const f = rig._fp;
      const cp = tokens.floorClip;
      const P = (d) => [f.ox + f.fx * d, 0.02, f.oz + f.fz * d];   // 정면 방향 d미터 앞
      const heading = Math.atan2(-f.fx, -f.fz);   // rx=-90° 후 z-회전 = 지면 헤딩 (팩 화살표와 동일 규약)
      const tNow = performance.now() / 1000;
      const dayOn = FXP.day ? 1 : 0;
      // 중앙 화살표 (LINE ① 이동 촉)
      const [ax, , az] = P(0.25);
      bkArrow.position.set(ax, 0.018, az);
      bkArrow.rotation.z = heading;
      bkArrow._mat.clippingPlanes = cp;
      for (const tp of bkArrow._tips) tp.material.clippingPlanes = cp;
      // 리듬 비트 3개 — 깊이 0.4/0.85/1.3m, 박자 = 팩 실측 스텝 간격. 글로우 = uFade(허용 매개변수)
      const MK = FXP.mark;
      const stepT = tokens._beatT || 0.625;
      const beatT = tNow / stepT;
      const depths = [0.4, 0.85, 1.3];
      bkBeats.forEach((b, i) => {
        const [bx, , bz] = P(depths[i]);
        b.position.set(bx, 0.021, bz);
        const ph = (beatT - i * 0.33) % 1;   // 앞으로 흐르는 박자 — 데이터 케이던스
        const glow = Math.max(0, 1 - Math.abs(ph) * 3);
        const U = b.material.uniforms;
        U.uTime.value = tNow;
        U.uFade.value = 0.3 + 0.6 * glow;
        U.uW.value = MK.core; U.uHalo.value = MK.halo; U.uPool.value = MK.pool;
        U.uSweepA.value = MK.sweep; U.uNoise.value = MK.wobble;
        U.uGain.value = FXP.gainBoost;
        if (U.uDay.value !== dayOn) {
          U.uDay.value = dayOn;
          b.material.blending = dayOn ? THREE.NormalBlending : THREE.AdditiveBlending;
          b.material.needsUpdate = true;
        }
        b.scale.setScalar(0.85 + 0.35 * glow);
        b.material.clippingPlanes = cp;
      });
      // 중앙 레인 = LANEFX 광류 (구 LineDashed 은퇴) — 레인 스타일·룩 값 라이브 소비
      const [lx, , lz] = P(0.8);
      bkLane.position.set(lx, 0.017, lz);
      bkLane.rotation.z = heading;
      const LU = bkLaneMat.uniforms;
      const A = FXP.arrow || {};
      const LS = { solid: 0, dash: 1, dot: 2, chevron: 3, comet: 4, taper: 5 };
      LU.uTime.value = tNow;
      LU.uLStyle.value = LS[(FXP.lane && FXP.lane.style) || 'dash'] ?? 1;
      LU.uW.value = FXP.graphics.width * (A.w || 1);
      LU.uHalo.value = FXP.graphics.halo * (A.glow ?? 1);
      LU.uLSpeed.value = A.speed ?? 1; LU.uLGap.value = A.gap ?? 1;
      LU.uLHeat.value = A.heat ?? 0.5; LU.uLTail.value = A.tail ?? 0.55;
      LU.uGain.value = FXP.gainBoost * 0.7;
      if (LU.uDay.value !== dayOn) {
        LU.uDay.value = dayOn;
        bkLaneMat.blending = dayOn ? THREE.NormalBlending : THREE.AdditiveBlending;
        bkLaneMat.needsUpdate = true;
      }
      bkLaneMat.clippingPlanes = cp;
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
    sceneUI.update(rawDt, rig);       // 장면 UI 슬롯 — 풋프린트 추종 재배치 + 페이드
    // 실전=연습 통일(유저): LiveUI 셰브론/변형/부스트 오버레이 은퇴 — 러닝은 P·C 모두
    // '흐르는 원형 판정 마크 + 소리(메트로놈)'로. active:false로 그룹 통째 숨김.
    liveUI.update(rawDt, { active: false });
    session.tickWaves();              // 스테이지 파동 링 시계 (프리뷰 포함)
    renderGhostLayer();
    tickA1Coach();
    renderDemoPanel();   // A 시범 구간 실사 클립 (휴면)
    renderWallHUD();     // 벽면 게임 HUD (피그마 WallUI 이식)
    renderMirrorView();  // 내 폼 존 = 스테이션 카메라 실루엣 라이브
    renderBxPerson();    // 복싱 벽면 인물 시범 (정본 포트)
    renderJointMarkers();   // 관절 추종 마커 (증명 데모)
    renderDesignFrame();  // 벽 = 스테이지별 대지 프레임(CSS3D). 프레임 스테이지는 기존 벽 UI 숨김(사람+배경만)
    applyEditOverrides();  // 배치 편집(유저): 드래그로 옮긴 벽·인물 위치를 세션 덮어쓰기 후 재적용
    renderFrame(clock.elapsedTime);   // 블룸 + 그레인·비네트 컴포저 (scene.js FX)
  }

  // ── 벽 대지 프레임 시스템: 스테이지별 대지(2600×1600) 뷰를 벽 평면에 CSS3D로 얹음 ──
  //   프레임 스테이지 = 기존 벽/바닥 UI 전부 숨김(사람+배경만) → 다른 각도에서도 "벽에 프레임 하나 붙은 것"으로 인지.
  //   iframe 배경 투명 → 프레임 밖은 벽 배경이 비침. 투사면=벽 크기라 밖 안 나감.
  const DESIGN_FRAMES = {   // 스테이지 → 대지 프레임. A~C는 공통 템플릿(scene.html) + ?stage= 데이터(scenes.js)
    BX_READY: 'ready-view/index.html',
    BX_A1: 'ready-view/scene.html?stage=BX_A1', BX_A2: 'ready-view/scene.html?stage=BX_A2', BX_A3: 'ready-view/scene.html?stage=BX_A3',
    BX_B1: 'ready-view/scene.html?stage=BX_B1', BX_B2: 'ready-view/scene.html?stage=BX_B2', BX_B3: 'ready-view/scene.html?stage=BX_B3',
    BX_C1: 'ready-view/timer.html?stage=BX_C1',   // 실전 직전 3·2·1 카운트다운 타이머
    BX_C2: 'ready-view/scene.html?stage=BX_C2', BX_C3: 'ready-view/scene.html?stage=BX_C3', BX_C4: 'ready-view/scene.html?stage=BX_C4',
    BX_T1: 'ready-view/transition.html?stage=BX_T1',   // 스트레칭 → 학습 전환
    BX_T2: 'ready-view/transition.html?stage=BX_T2',   // 학습 → 실전 전환
    BX_FIN: 'ready-view/report.html?stage=BX_FIN',     // 세션 리포트
  };
  // 장면별 자동재생 지속시간(초) — 로딩바·카운트다운이 0→100% 차오르는 시간.
  // ponytail: 근사값 (복싱 A/B는 beat 기반이라 템포 따라 소폭 변동, B1은 rep 게이트). 필요 시 튜닝.
  const STAGE_DUR = { A1: 12, A2: 16, A3: 24, BX_A1: 5.6, BX_A2: 4.6, BX_A3: 4, BX_B1: 9, BX_B2: 4.5, BX_B3: 4, BX_C1: 3, BX_C2: 6, BX_C3: 6, BX_C4: 4, BX_T1: 4.5, BX_T2: 5 };
  const FRAME_W = 2600, FRAME_H = 1600;   // 디자인 대지 px (벽 2.6×1.6m 실측 1:1) — 모든 DESIGN_FRAMES 뷰는 이 대지로 저작
  const cssRenderer = new CSS3DRenderer();
  Object.assign(cssRenderer.domElement.style, { position: 'fixed', pointerEvents: 'none', zIndex: '6' });
  document.body.appendChild(cssRenderer.domElement);   // 크기·위치는 매 프레임 WebGL 캔버스에 정합(아래 renderDesignFrame)
  const frameIframe = document.createElement('iframe');
  frameIframe.setAttribute('scrolling', 'no');
  // 투사 UI = 솔리드 그대로(검정 글자 검정으로) + 전체에 딱 5%만 균일 투명도(opacity 0.95) → 벽에 은은한 투사감.
  Object.assign(frameIframe.style, { width: FRAME_W + 'px', height: (FRAME_W * 1600 / 2600) + 'px', border: '0', background: 'transparent', opacity: '0.95' });
  const frameCssScene = new THREE.Scene();
  const frameObj = new CSS3DObject(frameIframe);
  frameObj.visible = false;
  frameCssScene.add(frameObj);
  let loadedView = null;

  // ── 바닥 프레임 occlusion 오버레이 ──
  //   CSS3D(z6)는 DOM 레이어라 3D 깊이가 없어 x봇 다리 위로 둥둥 뜸. 해결: x봇만 투명 배경으로
  //   프레임 위(z7)에 재렌더 → 프레임이 다리 뒤로 사라져 "발밑에 밟히는" 착시. HTML 모션은 그대로 유지.
  const OCCL_LAYER = 1;
  const occlRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  occlRenderer.setPixelRatio(window.devicePixelRatio || 1);
  occlRenderer.setClearColor(0x000000, 0);
  Object.assign(occlRenderer.domElement.style, { position: 'fixed', pointerEvents: 'none', zIndex: '7', display: 'none' });
  document.body.appendChild(occlRenderer.domElement);
  const occlCam = camera.clone();
  // 오버레이 = 프레임 위 몸을 재렌더해 프레임을 몸에 가림(발밑 밟힘). 2번째 GL이라 메인 IBL(PMREM) 재사용
  // 불가 → 원본 재질은 검게 나옴. Lambert 대체재질 + 씬 조명을 오버레이 레이어에도 켜서 3D 음영 유지(2D 방지).
  const OCCL_MAT = new THREE.MeshLambertMaterial({ color: 0xb9bcc4 });
  let occlLightsReady = false;
  function renderFloorOcclusion(active) {
    occlRenderer.domElement.style.display = active ? 'block' : 'none';
    if (!active || !xbot.model) return;
    const cvr = renderer.domElement.getBoundingClientRect();
    if (occlRenderer._sw !== cvr.width || occlRenderer._sh !== cvr.height) {
      occlRenderer.setSize(cvr.width, cvr.height);
      occlRenderer._sw = cvr.width; occlRenderer._sh = cvr.height;
    }
    occlRenderer.domElement.style.left = cvr.left + 'px';
    occlRenderer.domElement.style.top = cvr.top + 'px';
    // x봇 본만 오클루전 레이어에 등록(로드/팩교체 대응 — 본 수십개라 가벼움). 오버레이 카메라는 이 레이어만 렌더.
    xbot.group.traverse(o => o.layers.enable(OCCL_LAYER));
    // 씬 조명도 오버레이 레이어에 켜서 Lambert 음영이 살아나게(2D 평면화 방지). 메인 레이어0는 그대로 유지.
    if (!occlLightsReady) { scene.traverse(o => { if (o.isLight) o.layers.enable(OCCL_LAYER); }); occlLightsReady = true; }
    occlCam.copy(camera); occlCam.layers.set(OCCL_LAYER);
    // 배경은 오버레이에서 렌더 금지 — x봇 픽셀만 불투명, 그 외 투명이어야 프레임이 몸에만 가려짐.
    const bg = scene.background; scene.background = null;
    scene.overrideMaterial = OCCL_MAT;   // 바디톤 평면색 실루엣 (IBL 없이 검게 나오는 것 회피)
    occlRenderer.clear();
    occlRenderer.render(scene, occlCam);
    scene.overrideMaterial = null; scene.background = bg;
  }

  // ── 바닥 대지 프레임 (러닝/농구): 복싱 벽 프레임과 동일한 CSS3D HTML 방식 (CSS 모션 그대로 재생).
  //    벽=사람 뒤라 가림 문제 없음 / 바닥=발밑이라 x봇 실루엣만큼 클립해 다리 뒤로 사라지게(occlusion 근사).
  //    스테이지 → { src, w, h } (대지 px). 러닝 1600×2000(세로). HTML/CSS 모션 = Figma export 프레임 자리.
  const FLOOR_FRAMES = {
    READY: { src: 'ready-view/floor.html', w: 1600, h: 2670 },        // 러닝 시작 (세로) — 2m 안정투사 꽉 채움
    BK_READY: { src: 'ready-view/floor-bk.html', w: 1600, h: 2670 },  // 농구 시작 — 러닝 첫화면 이식(폭은 균일스케일 자동 조정)
  };
  // 운동중 A/B/C 지면 화면 — 세로 공통 프레임(floor-scene.html)에 stage 주입. 시작화면과 달리 중앙 발자국은 유지.
  for (const id of ['A1', 'A2', 'A3', 'P1', 'P2', 'P3', 'C2', 'C3', 'C4', 'C5',
                    'BK_A1', 'BK_A2', 'BK_A3', 'BK_B1', 'BK_B2', 'BK_B3', 'BK_C2', 'BK_C3', 'BK_C4']) {
    FLOOR_FRAMES[id] = { src: 'ready-view/floor-scene.html?stage=' + id, w: 1600, h: 2670 };
  }
  // 전환 화면 (스트레칭→학습·학습→실전) — Figma [러닝/농구] 세로 전환 템플릿 (복싱 transition.html 이식)
  for (const id of ['T1', 'T2', 'BK_T1', 'BK_T2']) {
    FLOOR_FRAMES[id] = { src: 'ready-view/floor-transition.html?stage=' + id, w: 1600, h: 2670 };
  }
  // 실전 직전 3·2·1 카운트다운 타이머 (복싱 timer.html 세로 이식) — 러닝 C1 · 농구 BK_C1
  for (const id of ['C1', 'BK_C1']) {
    FLOOR_FRAMES[id] = { src: 'ready-view/floor-timer.html?stage=' + id, w: 1600, h: 2670 };
  }
  // 세션 종료 리포트 (복싱 report.html 세로 이식) — 러닝 FIN · 농구 BK_FIN
  for (const id of ['FIN', 'BK_FIN']) {
    FLOOR_FRAMES[id] = { src: 'ready-view/floor-report.html?stage=' + id, w: 1600, h: 2670 };
  }
  const floorIframe = document.createElement('iframe');
  floorIframe.setAttribute('scrolling', 'no');
  // 배경 투명(html/body transparent)이라 별도 루마키 불필요. filter:url(#ui-lumakey)는 정의 없는 댕글링 참조라
  // Chrome이 iframe을 통째 안 그렸음(운동중 프레임 안 보이던 원인) → 제거.
  Object.assign(floorIframe.style, { border: '0', background: 'transparent' });
  const floorObj = new CSS3DObject(floorIframe);
  floorObj.visible = false;
  frameCssScene.add(floorObj);
  let loadedFloorView = null;
  let _uiDt = 0.016;      // loop에서 매 프레임 실시간 dt 주입 (UI 앵커 저역통과용)
  let _wasLive = false;   // 라이브 진입 에지 감지 — loopShiftZ 드리프트 재정렬용
  let _fpSmooth = null;   // 프레임·발자국 앵커용 저역통과 풋프린트 — 빔 흔들림(투사오차 지터) 제거해 글자 삐걱임 방지
  const _rV = new THREE.Vector3(), _fV = new THREE.Vector3(), _uV = new THREE.Vector3(0, 1, 0), _mBasis = new THREE.Matrix4();
  function renderDesignFrame() {
    // CSS3D 레이어 = WebGL 캔버스에 매 프레임 정확 정합 — 창≠캔버스(크기·aspect)여도 원근·스케일 일치
    //   (이게 안 맞으면 디자인이 벽보다 크게 부풀어 프레임영역 밖으로 넘침 — 유저 창 크기 의존 버그의 원인)
    const cvr = renderer.domElement.getBoundingClientRect();
    if (cssRenderer._sw !== cvr.width || cssRenderer._sh !== cvr.height) {
      cssRenderer.setSize(cvr.width, cvr.height);
      cssRenderer._sw = cvr.width; cssRenderer._sh = cvr.height;
    }
    cssRenderer.domElement.style.left = cvr.left + 'px';
    cssRenderer.domElement.style.top = cvr.top + 'px';
    const view = (session.active && state.pack === 'boxing') ? DESIGN_FRAMES[session.curStage?.id] : null;
    const wc = view ? rig._wallCenter : null;
    frameObj.visible = !!view && !!wc;   // 벽 좌표 준비 전엔 숨김 — 재진입 초기 _wallCenter undefined일 때 프레임이 (0,1.4) '중앙'으로 튀는 플래시 방지
    if (frameObj.visible) {
      if (view !== loadedView) {   // 다른 뷰만 로드(같은 뷰 재진입=그대로)
        const dur = STAGE_DUR[session.curStage?.id] ?? session.curStage?.dur ?? 8;
        const needsDur = view.includes('scene.html') || view.includes('timer.html');
        frameIframe.src = import.meta.env.BASE_URL + view + (needsDur ? '&dur=' + dur : '');
        loadedView = view;
      }
      // 매 프레임 벽 정합 — 대지 2600×1600 → 벽(wallW×wallH), x/y 독립 스케일(aspect 무관, 이식 안전)
      frameObj.position.set(wc.cx, wc.cy, WALL_Z + 0.02);
      frameObj.rotation.set(0, 0, 0);
      frameObj.scale.set(rig.wallW / FRAME_W, rig.wallH / FRAME_H, 1);
      // 구 UI 선별 숨김 — 유지: demoPanel(주황 전문가)·격자 배경 / 숨김: 거울"나"·HUD·세션 큐
      mirrorPanel.visible = false;
      hudPanel.visible = ctaPanel.visible = false;
      optRing.visible = camMark.visible = false;
      // A/B/C 씬 = 룩 시스템 판정 토큰(현재 스테이지 G그룹: 아크·링·가드박스·스윕·화살표) 유지.
      //   디자인 UI가 이미 표시하는 레거시 벽 텍스트·카운트 슬롯만 숨김(중복 방지).
      //   그 외(타이머·전환·리포트) = 세션 마크 전체 숨김.
      const isSceneFrame = view.includes('scene.html');
      session.root.visible = isSceneFrame;
      if (isSceneFrame) {
        // 토큰은 대지 설계 기준 (0, 1.4)에 저작 — 인물 실제 중심(wc.cx, wc.cy)으로 그룹을 통째 이동해
        // 어깨·발·머리 존이 창 크기·벽 중심과 무관하게 인물에 정렬 (하드코딩 1.4 가정 제거).
        // z(+0.012) = 인물(demoPanel, WALL_Z+0.035) '앞'으로 — 판정 토큰이 인물에 가리지 않고 부위 지시.
        session.root.position.set(wc.cx, wc.cy - 1.4, 0.012);
        [session.slotFS, session.slotFL, session.slotFM, session.dirSlot, session.paceLight,
         session.countGroup, session.countRing, session.wSlotFS, session.wSlotFL, session.wSlotFM, session.wCount]
          .forEach(o => { if (o) o.visible = false; });
      } else {
        session.root.position.set(0, 0, 0);
      }
      if (session.curStage?.id === 'BX_READY') {
        demoPanel.position.x += rig.wallW * 0.12;   // READY = 기존 우측 슬롯 (유저 확정 레이아웃)
      } else {
        // A/B/C = 주황 전문가를 벽 정중앙에 크게. 단, 쿼드(GHOST_H·PAD·DBIG)가 벽 높이를 넘으면
        // 벽 클리핑에 머리·발이 잘리고 과확대로 흐려짐 → 벽 안에 딱 맞는 상한(DBIG)으로 선명·미절단.
        const DBIG = 0.88;   // 1.5·1.22·0.88 ≈ 1.61m ≤ 벽 1.63m (uncut) — 과확대 블러 해소
        demoPanel.scale.set(GHOST_H * (9 / 16) / 0.62 * GHOST_PAD * DBIG, GHOST_H / 0.93 * GHOST_PAD * DBIG, 1);
        demoPanel.position.set(wc.cx, wc.cy, WALL_Z + 0.035);
      }
    }
    // ── 바닥 대지 프레임 정합 (러닝/농구) — WebGL 평면, 직사각형, x봇에 자동 가려짐 ──
    const isFloorSport = session.active && (session.sport === 'running' || session.sport === 'basketball');
    // 실전 라이브 러닝에서도 플로어 프레임(타이틀·큐·판정 헤더) 유지 — 껐더니 러닝 UI·판정토큰이 사라져 화면이 비었음(유저 되돌림).
    const fView = isFloorSport ? FLOOR_FRAMES[session.curStage?.id] : null;
    const fp = rig._fp;   // 무릎 투사 풋프린트 (rig.update가 매 프레임 세팅)
    floorObj.visible = !!fView && !!fp;
    // 👁 커버리지 채움판(footFill, 원시 빔 추종)과 플로어 프레임(저역통과 앵커)이 같은 자리에
    // 미세 오프셋 2겹으로 보임(유저) → 프레임 표시 중엔 채움판 숨김, 빔 라인(floorBeam)은 유지
    if (rig.footFill) rig.footFill.visible =
      (state.pack === 'running' || state.pack === 'basketball') && rig.visualize !== false && !floorObj.visible;
    // 시작 페이지(READY/BK_READY)=발자국까지 전부 숨김(UI 전담). A/B/C 운동중=발자국은 콘텐츠라 유지, 프레임은 헤더만 대체.
    const isStartPage = session.curStage?.id === 'READY' || session.curStage?.id === 'BK_READY';
    // 팩 판정 토큰 필드 표시 정책(단일 소스): 세션 중엔 라이브에만, 릴리즈(C4)는 슛 집중 위해 제외.
    // 비실전(스트레칭·전환·리포트)에 무관한 마커가 떠 있던 근본(유저 전 화면 검수 지적).
    if (isFloorSport) tokens.floorRoot.visible = !(floorObj.visible && isStartPage)
      && (!session.active || (session.isLive && session.stage !== 'BK_C4'));
    if (floorObj.visible) {
      if (fView.src !== loadedFloorView) {
        floorIframe.style.width = fView.w + 'px';
        floorIframe.style.height = fView.h + 'px';
        // 운동중 프레임(floor-scene.html)엔 장면 지속시간 전달 — 도트 로딩바가 이 시간 동안 0→100% 차오름
        const dur = STAGE_DUR[session.curStage?.id] ?? session.curStage?.dur ?? 8;
        let durSuffix = fView.src.includes('floor-scene.html') ? '&dur=' + dur : '';
        // SPM 숫자 위젯 은퇴(유저): 텍스트가 3D 마크와 겹쳐 뭉침 + 케이던스는 소리(메트로놈)가 가르침.
        // 바닥은 흐르는 원형 마크만 — 미니멀·프리미엄.
        floorIframe.src = import.meta.env.BASE_URL + fView.src + durSuffix;
        loadedFloorView = fView.src;
        _fpSmooth = null;   // 스테이지 전환 = 앵커 스냅(슬라이딩 방지)
      }
      // 읽는 UI(프레임·발자국)는 빔 흔들림(투사오차 지터, 무릎 각속도 비례 — 다리 스윙 때 최대)을 그대로
      // 따르면 글자가 삐걱임(유저). 앵커를 저역통과(≈90ms 시정수)해 인물 총체 이동만 남기고 지터 제거.
      // 빔·토큰은 원본 rig._fp 그대로라 '정직한 흔들림' 유지 — 읽기용 콘텐츠만 안정화.
      if (!_fpSmooth) _fpSmooth = { ox: fp.ox, oz: fp.oz, fx: fp.fx, fz: fp.fz };
      const aUI = 1 - Math.exp(-_uiDt / 0.05);   // 저역통과 완화(0.09→0.05) — 매트가 종아리 잔여를 더 따라감(유저: 박힌 느낌)
      _fpSmooth.ox += (fp.ox - _fpSmooth.ox) * aUI;
      _fpSmooth.oz += (fp.oz - _fpSmooth.oz) * aUI;
      _fpSmooth.fx += (fp.fx - _fpSmooth.fx) * aUI;
      _fpSmooth.fz += (fp.fz - _fpSmooth.fz) * aUI;
      const _fl = Math.hypot(_fpSmooth.fx, _fpSmooth.fz) || 1;
      const sfp = { ox: _fpSmooth.ox, oz: _fpSmooth.oz, fx: _fpSmooth.fx / _fl, fz: _fpSmooth.fz / _fl };
      sfp.rx = -sfp.fz; sfp.rz = sfp.fx;   // right = (-fwd.z, fwd.x) — projector와 동일 규약
      // 풋프린트 중앙(전방 fpNear~fpFar 중간)에 대지 중심을 앵커. 직사각형(어핀) — 복싱 벽과 동일.
      const dMid = (rig.fpNear + rig.fpFar) / 2;
      const cx = sfp.ox + sfp.fx * dMid, cz = sfp.oz + sfp.fz * dMid;
      // 로컬축 → 월드: 대지 폭(+X)→풋프린트 우측, 대지 높이(+Y=위쪽/제목)→전방(far), 법선(+Z)→상방.
      _rV.set(sfp.rx, 0, sfp.rz); _fV.set(sfp.fx, 0, sfp.fz);
      _mBasis.makeBasis(_rV, _fV, _uV);
      floorObj.quaternion.setFromRotationMatrix(_mBasis);
      floorObj.position.set(cx, 0.012, cz);
      // 균일 스케일(비율 유지) — 폭에 맞춤. 독립 x/y 스케일은 대지(0.8)와 풋프린트(≈0.49) 종횡비가
      // 달라 글자가 세로로 늘고 가로로 짜부됐음(유저 지적). 깊이는 대지 비율 그대로 → 세로도 짧아짐.
      const laneW = 2 * rig._halfAt(dMid), sUni = laneW / fView.w;
      floorObj.scale.set(sUni, sUni, 1);
      session.frameSlots = null;   // 슬롯 카드 레이아웃 은퇴(유저: 시범→따라하기 순차 문법으로 확정)
      try {
        // 라이브(B 페이스·C 실전) = 최소 UI(유저): 진입 2.5s 후 타이틀·큐·도트 페이드 — 판정 큐만 남김.
        const doc = floorIframe.contentDocument;
        if (doc) {
          // 훈련(P1~P4)은 정보 학습 단계 → 페이드 제외(타이틀·설명·하단 라이브 정보 상시 유지).
          // B 페이스·C 실전만 진입 2.5s 후 최소 UI로 페이드.
          const hide = !!session.curStage?.live && session.t > 2.5 && !/^P\d$/.test(session.curStage.id);
          for (const eid of ['s-title', 's-cue', 's-dots']) {
            const el = doc.getElementById(eid);
            if (el) { el.style.transition = 'opacity .7s'; el.style.opacity = hide ? '0' : '1'; }
          }
        }
      } catch (e) { /* iframe 로드 전 */ }
      // 프레임이 헤더(타이틀·큐·페이즈)를 담으므로 발자국 아래 3D 보조 텍스트 슬롯 전부 숨김(중복 제거, 유저).
      // 발자국 마크(G그룹)는 중앙 콘텐츠라 유지 — 슬롯만 끈다.
      [session.slotFS, session.slotFL, session.slotFM, session.dirSlot,
       session.countGroup, session.countRing].forEach(o => { if (o) o.visible = false; });
      // 라이브(C 실전)는 _paceTick이 광점·페이스레인을 매 프레임 관리 — 프레임 켜져도 끄지 않음(러닝·판정 비주얼 유지).
      if (!session.isLive && session.paceLight) session.paceLight.visible = false;
      // 전환·타이머·리포트 = 풀스크린 지면 그래픽 → 옛 운동 3D UI(발자국·가이드·레인·리포트 텍스트) 전부 숨김(겹침 방지).
      const fullFrame = /floor-(transition|timer|report)\.html/.test(fView.src);
      if (fullFrame) {
        tokens.floorRoot.visible = false;
        [session.a1arc, session.a1L, session.a1R, session.a3foot, session.paceLane, session.paceLight,
         ...(session.a3zones || []), ...(session.paceFeet || []).map(f => f && f.group), ...(session.a2 || []).map(a => a && a.pg)]
          .forEach(o => { if (o) o.visible = false; });
      }
      // 발자국 판정 마크(G그룹) 정렬. 시작 페이지·풀스크린 프레임=숨김.
      const stageG = session.G && session.G[session.curStage?.id];
      if (stageG) {
        if (isStartPage || fullFrame) {
          stageG.visible = false;
        } else if (session.isLive) {
          // 실전(라이브)은 세션 root가 인물 이동을 추종 — G그룹은 저작 기본(원점·무회전) 유지.
          stageG.position.set(0, 0, 0); stageG.quaternion.identity();
        } else if (/^(A1|BK_A2|BK_A3|BK_B1|BK_B2|BK_B3)$/.test(session.curStage?.id || '')) {
          // 봇-정합 스테이지: 재앵커(밴드 시프트) 제외 + 스테이지별 전방 오프셋만 —
          // 투사 법칙(가이드는 서기 앞 0.4~2.1m 창 안): 실측 감사에서 B1 28/30·B2 16/17
          // 메쉬가 존 밖(반달 절단)이라 필드 통째 전진. 원점 고정이 여기서 오프셋을 매 프레임
          // 지우고 있었으므로 오프셋을 이 브랜치가 직접 소유한다(단일 출처).
          const FWD = { BK_B1: -1.1, BK_B2: -1.25, BK_A3: -0.85 };
          stageG.position.set(0, 0, FWD[session.curStage?.id] || 0); stageG.quaternion.identity();
        } else {
          // 데모 단계: 발자국을 프레임과 '같은' 무릎 풋프린트 기준계에 실어 인물 흔들림에 함께 따라가게 함
          // (기존엔 세션 원점 고정 → 프레임·타이틀만 흔들리고 발자국은 완전 고정, 유저 지적).
          // 저작 로컬(+x=우, -z=전방, m) → 풋프린트 축(우, 상, -전방). 원점은 밴드 시프트(저작중심→dMid)만큼 뒤로:
          //   농구 발자국은 먼 존(z −1.5~−2.6)에 저작돼 프레임 타이틀(≈2.24m)·도트(≈1.95m)존 침범 → dMid로 당김.
          const S = (state.pack === 'basketball' ? 2.05 : 1.20) - dMid;
          _mBasis.makeBasis(_rV, _uV, _fV.set(-sfp.fx, 0, -sfp.fz));   // sfp=저역통과 앵커(프레임과 동일)
          stageG.quaternion.setFromRotationMatrix(_mBasis);
          stageG.position.set(sfp.ox - sfp.fx * S, 0.012, sfp.oz - sfp.fz * S);
        }
      }
    }
    // 세션 비실전(+릴리즈 C4) = 팩 판정 토큰 필드 최종 강제 숨김 — 프레임별 어떤 경로가
    // 다시 켜도 여기서 정리(무관 토큰이 스트레칭·학습 화면에 떠 있던 재발 방지, 최종 승자).
    if (session.active && (!session.isLive || session.stage === 'BK_C4')) tokens.floorRoot.visible = false;
    // 항상 렌더 — 표시/숨김 전환에도 CSS3D transform 항상 동기(재진입 시 위치 어긋남·잔류 방지)
    cssRenderer.render(frameCssScene, camera);
    // ── 바닥 프레임 occlusion: x봇만 투명 오버레이로 프레임(z6) 위(z7)에 다시 그려 다리 뒤로 밟히게 ──
    renderFloorOcclusion(floorObj.visible);
  }

  loop();
}

boot().catch(err => {
  console.error('[Newton] boot failed:', err);
  document.getElementById('loading').innerHTML =
    `<span style="color:#ff5c8a">로드 실패: ${err.message}</span>`;
});
