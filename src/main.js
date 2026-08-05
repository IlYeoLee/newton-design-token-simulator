import * as THREE from 'three';
import { createScene, WALL_Z, FX } from './scene.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TokenSystem, COLORS, TCFG, setFPView, makeMarkFXMaterial, makeLaneFXMaterial, makeFlowArrow, UI_MASK, applyMarkLook } from './tokens.js';
import { Effects } from './effects.js';
import { XBot } from './xbot.js';
import { Panel } from './panel.js';
import { ProjectorRig } from './projector.js';
import { WallGhost } from './ghost.js';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { extractPose, retargetToClip } from './posemocap.js';   // 무료 로컬 비디오 모캡
import { Judge } from './judge.js';
import { Session, SCFG, STAGES, STEP_SEG , refreshMarkNums } from './session.js';
import { StudioDoc } from './studio/doc.js';
import { StudioCanvas } from './studio/canvas.js';
import { StudioProps } from './studio/props.js';
import { SceneScope } from './studio/scene-scope.js';
import { DesignStore } from './studio/store.js';
import { loadSvg } from './studio/design.js';
import { initBudgetPanel } from './budgetPanel.js';
import { enforcePalette } from './palette.js';   // 색 규칙 강제 — 저장된 룩이 팔레트를 무너뜨리지 못하게
import { FloorGL } from './floorgl.js';   // 바닥 UI WebGL 이식(B안) — ?floorgl=1
import { WallGL } from './wallgl.js';     // 복싱 벽 UI WebGL 이식(같은 B안) — ?wallgl=0 이면 옛 CSS3D
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getLUT, FXP, rebuildLUT, lutColor, GLYPHS, FX_GLSL, DEFAULT_GLYPHS, GLYPH_REV, mergeGlyphs, ensureOffBit, drawGlyph } from './fxlut.js';
import { drawRotate, drawStemArrow, PERSON_GLSL, CUT_FEATHER_GLSL, REF_LOOK_GLSL } from './fx-core.js';
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
  pack: 'boxing',   // 기본 진입 팩 = 복싱 (순서: 복싱 → 러닝 → 농구, 유저)
  packs: {},
  time: 0,
  speed: 1,
  playing: true,
};

async function boot() {
  const stage = document.getElementById('stage');
  const { renderer, scene, camera, controls, setPackEnvironment, resize, renderFrame, composer, setSurfaces, setDaylight, followFloor, wall, wallGroup, hoop, setRenderCamera } = createScene(stage);

  let sessionSkillSink = null;   // 슬라이더가 session 생성 전 초기 apply 시 TDZ 회피
  let sessionReady = false;      // session(const) 생성 완료 플래그 — 초기 팩 전환이 stopSession을 먼저 부르면 TDZ
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
    // impactRing은 depthTest:false(빌보드 임팩트 연출) — 씬에 켜둔 채 두면 러닝·농구에서
    // x봇 몸 위로 링이 그려진다(유저 스샷). 복싱 3인칭 데모가 아닐 땐 visible 자체를 끈다.
    fistRing.visible = armLine.visible = impactRing.visible = !!on;
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
  // 관절 추종 마커(주먹 링·팔 라인·임팩트 링) = 초기 증명용 데모. 기본 꺼둠 —
  // 복싱 장면에서 몸통에 붉은 링·선이 떠 투사 UI가 아닌 게 섞여 보였다(유저).
  let jointDemo = false;
  const judge = new Judge();
  // 장면 UI 시스템 — 타이틀·지시문·상태의 고정 슬롯 (풋프린트-상대 + 클리핑)
  const sceneUI = new SceneUI(scene, WALL_Z);
  sceneUI.setClip(rig.floorClip, rig.wallClip);

  // 판정 색상 피드백 = 마크 토큰이 전담한다(성공 채움 + 파형). 여기서 따로 그리지 않는다.
  //   구 '착지점 도트'(effects.dot · #d1feff) 제거 — 판정 좌표를 찍어 보던 실측기 잔재라,
  //   인물 발밑에 정체불명의 옅은 청록 원이 상시로 떠 있었다(유저: 처음 보는 터치영역 같은 게 왜 있냐).
  //   되살리려면 effects.dot(dotPos, col, n) 한 줄이면 된다(도트 헬퍼는 effects.js 에 그대로 있다).
  judge.onVerdict = (ev, verdict, best, terr) => {
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
          // 인물 룩(lab.p)만 좁게 1회 이행 — rev 통째 교체는 로컬 룩 편집을 다 날리므로 못 쓴다.
          //   저장본의 detail 0.15 는 blur·decay 가 켜져 있던 옛 파이프라인에서 authored 된 값이다.
          //   그 둘을 은퇴시킨 지금은 결이 36%만 남아 인물이 흐리멍텅해진다(유저 신고) → 정본으로 올린다.
          //   pRev 마커로 멱등 — 이행 후 유저가 다시 내려도 덮지 않는다.
          //   기본 p 를 다시 바꿀 때마다 이 숫자를 올린다(3 = detail 0.42 = 결 100%).
          if (dlab.p && lab.p && (lab.pRev || 0) < 3) {
            lab.p = { ...lab.p, ...dlab.p };
            lab.pRev = 3; changed = true;
          }
          // 마크 룩(lab.m)도 같은 방식으로 좁게 1회 이행. 저장본에 halo 0.25 · wobble 0.05 가
          //   박혀 있어서, 발자국 랩(footlab)에서 잡은 디자인이 시뮬에선 헤일로가 3.6배 낮게
          //   나왔다(유저: 랩에서 본 것보다 흐리고 연하다). uW·uHalo·uPool·uNoise 는 재질
          //   기본값이 아니라 이 저장본에서 **매 프레임 주입**되므로, 여기를 안 올리면 이식이 안 된다.
          //   mRev 로 멱등 — 이행 후 유저가 다시 내려도 덮지 않는다.
          if (dlab.m && lab.m && (lab.mRev || 0) < (dlab.mRev || 0)) {
            lab.m = { ...lab.m, ...dlab.m };
            lab.mRev = dlab.mRev; changed = true;
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
    // 마크 안 숫자 활자 — 기본값이 이미 'offbit' 이라 applyLabState 의 '바뀌었을 때만' 분기는
    //   신선한 브라우저에서 한 번도 안 탄다. 게다가 그 함수는 저장된 룩이 있을 때만 호출된다
    //   → 폰트가 로드되지 않아 Supreme 으로 폴백했다(유저: "폰트도 도트폰트였잖아").
    //   저장 룩 유무와 무관하게 부팅에서 건다.
    // 폰트가 도착한 뒤 이미 구워진 숫자 텍스처를 다시 굽는다 — 부팅 시점엔 아직 없어서
    //   Supreme 으로 구워졌다(실측: document.fonts 는 loaded 인데 화면은 일반 활자).
    if (FXP.numSrc === 'offbit') ensureOffBit().then(ok => {
      if (!ok) return;
      refreshGlyphConsumers();   // 팩 마커
      refreshMarkNums();         // 세션 발자국 숫자 — 이쪽이 안 걸려 있어 시뮬만 옛 활자였다
    });
    enforcePalette(lab0);
    if (lab0?.stops) { FXP.stops = lab0.stops.map(x => [...x]); FXP.sat = lab0.sat ?? 1; }
    rebuildLUT();
    // L·R 글리프 = 숫자 슬롯과 같은 규약(같은 크기·틴트·글로우). 지면 UI에서 floorNum('L'…)
    // 또는 attachMarkNum(fm,'L'…)로 숫자 대신 쓸 수 있다. 랩에서 교체하면 그 값이 우선.
    if (lab0?.glyphs) {
      FXP.bg = lab0.bg;
      FXP.footCtx = lab0.footCtx || 'out';
      FXP.customGlyphs = lab0.glyphs;
      // 정본을 '항상' 뒤에 두면 랩에서 새 SVG 를 올려도 새로고침마다 덮여 반영이 안 된다(유저 신고).
      //   세대(GLYPH_REV)로 한 번만 청소하고, 그 뒤로는 저장본이 이긴다 — pRev 이행과 같은 방식.
      if ((lab0.glyphRev | 0) < GLYPH_REV) {
        lab0.glyphs = mergeGlyphs(lab0.glyphs, lab0.glyphRev);
        lab0.glyphRev = GLYPH_REV;
        FXP.customGlyphs = lab0.glyphs;
        try { designStore.globalSet('fx', 'lab', lab0); designStore.save(); } catch (e) { /* 저장 실패해도 화면은 정상 */ }
      }
      GLYPHS.set(mergeGlyphs(lab0.glyphs, GLYPH_REV));
      GLYPHS.setFlips(lab0.glyphFlip || {});
      // dataURL 디코드 완료 대기 (수 ms — 발형 텍스처가 빌드 시점에 읽을 수 있게)
      await Promise.race([
        Promise.all([...GLYPHS.imgs.values()].map(img => img.complete ? null : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }))),
        new Promise(res => setTimeout(res, 1500)),
      ]);
    } else {
      GLYPHS.set(DEFAULT_GLYPHS);   // 저장된 랩 룩이 없어도 정본 글리프는 항상 있다
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
    if (!data) return;   // 팩 JSON 로드 전 호출 — 배포본에서 실제로 발생(느린 네트워크). 로드 후 다시 온다.
    tokens.setPack(data);
    xbot.setPack(data, tokens.events);
    rig.setPack(data.sport, tokens.events);
    // 3인칭 = 항상 기본 프레이밍으로 못박는다(유저 지정 뷰 — 복싱·농구 모두).
    // 팩을 갈아도 이전 종목에서 돌려놓은 궤도 각·거리가 그대로 남아 3인칭이 매번 딴 각도로 떴다.
    // (1인칭↔3인칭 토글·세션 중지 경로는 setFp 가 이미 같은 프레이밍을 부른다)
    // 부팅 첫 호출(모델 로드 전)엔 앵커가 없다 — 여기서 던지면 switchPack 나머지(투사면·풋프린트)가
    // 통째로 중단돼 UI가 안 뜬다. 프레이밍은 없어도 되는 부가 동작이라 감싼다.
    if (!fpMode && xbot.model) { try { frameThirdPerson(); } catch { /* 앵커 미준비 — 다음 setFp 에서 잡힌다 */ } }
    const isKneePack = data.sport === 'running' || data.sport === 'basketball';
    window.__updateSurfAvail?.();   // 실내 테마 = 복싱 전용 게이트
    window.__applySurfDefault?.(p);   // 팩별 기본 투사면 자동 적용
    // 저장된 랩 배경(bg)이 늦게 적용되며 기본값을 덮어써 농구에서 회색 코트가 튀던 문제 —
    //   팩 전환 직후 한 프레임 뒤 한 번 더 못박는다(로드 순서 레이스 차단).
    setTimeout(() => window.__applySurfDefault?.(state.pack), 60);
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
    lastBodyZ = 0; lastBodyX = 0;

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
  // 시선 사다리 — 4단, 10° 단위. 장면마다 값을 새로 고르지 않는다(유저: 공통 규칙).
  //   규칙 ① 그 장면에서 봐야 할 대상이 시야 중앙에 오는 단을 고른다
  //        ② 오래 지속되는 장면일수록 얕게(목 굴곡 20° 권장 — ISO 9241 계열)
  //        ③ 정밀 조작(발 위치 맞추기)일수록 깊게
  const GAZE = { FRONT: -8, FAR: -20, MID: -30, NEAR: -40 };   // 낙하점 11.4m / 4.4m / 2.8m / 1.9m
  const STAGE_GAZE_DEG = { R: GAZE.NEAR, A: GAZE.NEAR, B: GAZE.NEAR, T: GAZE.MID, C: GAZE.FAR };
  function sessionGazeTarget() {
    // 벽 종목(복싱): 시선은 벽 정면 — 코치(y≈1.0~1.7)·타겟(y≈1.14)이 전부 시야에 안정적으로.
    // 눈높이 1.6m·벽앞 1.75m 기준 -8° ≈ 벽 중심 응시 (버그였음: 'BX_'의 B가 익히기 -38°로 매칭돼 바닥만 봄)
    if (session.curStage?.wall) return GAZE.FRONT;
    // B1 2막 '시선 바깥' = 1인칭 카메라도 정면(-5도) — 지면 UI를 의도적으로 시야 밖으로(유저).
    if (session.bkB1EyesUp) return GAZE.FRONT;
    const id = session.curStage?.id || '';
    // 전환·타이머·리포트(지면 풀스크린 화면) = x봇이 바닥의 화면을 보도록 게이즈 하향(세션 컴플리트·실전 직전).
    if (/^(T1|T2|C1|FIN|BK_T1|BK_T2|BK_C1|BK_FIN)$/.test(id)) return GAZE.NEAR;
    if (id === 'A1') return GAZE.MID;   // 전방 리치 홀드 — 투사각을 앞으로 눕혀 발 앞 가이드까지 보이게(미래 알고리즘 보정 가정)
    // 종목 접두사를 떼고 판정. 안 떼면 'BK_A2'의 B가 익히기(-38°)로 매칭돼 농구 워밍업이 얕게 봤다
    // (복싱 'BX_'에서 같은 버그를 이미 잡아놨는데 농구는 남아 있었음 — 유저: 워밍업 시선 더 아래).
    const key = id.replace(/^(BK|BX)_/, '');
    return STAGE_GAZE_DEG[key[0]] ?? GAZE.MID;   // READY/FIN 등 = 중간값
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
  let lastBodyZ = 0, lastBodyX = 0;   // 3인칭 추종 기준(몸 앵커) — x도 함께
  const fpBtn = document.getElementById('btn-fp');
  const coneBtn = document.getElementById('btn-cone');
  const setBtnActive = (btn, on) => {
    btn.style.background = on ? 'var(--accent)' : 'var(--panel2)';
    btn.style.color = on ? '#06202e' : 'var(--text)';
    btn.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
  };
  // 기본 3인칭 프레이밍 — 대각선 위에서 내려다보는 고정 앵글(유저 지정 레퍼런스).
  //   봇과 그 앞 투사 UI가 한 화면에 크게 들어오는 거리·고도. 이후 궤도 조작은 자유.
  function frameThirdPerson() {
    // 기준은 추종 로직과 같은 앵커(골반 본)여야 한다 — 그룹 좌표로 잡으면 러닝에서 기준이 어긋나
    //   카메라가 봇에 붙어 인물이 잘리고 매 프레임 델타가 튀며 깜빡였다(유저 스샷).
    const a = xbot.getAnchor ? xbot.getAnchor() : { x: 0, z: 0 };
    // 복싱은 '등 뒤 약간 위'(유저 지정) — 대각선 옆에서 보면 봇이 벽 UI를 정면으로 가린다.
    //   봇은 -Z(벽)를 보므로 뒤 = +Z. 타깃을 벽 쪽으로 조금 밀어 벽 UI가 봇 머리 위로 들어온다.
    if (state.pack === 'boxing') {
      controls.target.set(a.x, 1.25, a.z - 1.0);
      camera.position.set(a.x, 2.00, a.z + 2.20);
    } else {
      controls.target.set(a.x, 0.95, a.z);
      camera.position.set(a.x + 2.05, 2.70, a.z + 2.35);   // ≈4.1m · 고도 40°(대각선 위)
    }
    camera.updateProjectionMatrix();
    controls.update?.();
    lastBodyX = a.x; lastBodyZ = a.z;   // 추종 델타 기준도 같은 프레임에 리셋
  }
  // 씬 스테이지에서 시점을 고를 수 있게 노출 — 카메라를 밖에서 새로 계산하면 종목별 화각·VOR·
  //   1인칭 가독 보정(setFPView)이 전부 빠진다. 앱의 토글을 그대로 쓰는 게 맞다.
  window.__setFp = (on) => setFp(!!on);
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
      const a = xbot.getAnchor();   // 1인칭 → 3인칭 복귀: 몸 앵커만큼 카메라 재정렬(추종과 같은 기준)
      lastBodyX = a.x; lastBodyZ = a.z;
      frameThirdPerson();           // 기본 3인칭 = 고정 프레이밍(대각선 위, 가깝게) — 유저 지정
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
  let _speakSeq = 0;   // 마지막 발화만 살린다 — 취소 뒤 60ms 지연 재생이 이전 대사를 되살려 겹쳤다(유저)
  function speak(who, text, stageId) {
    if (!ttsOn) return;
    const seq = ++_speakSeq;
    voiceAudio.pause(); voiceAudio.currentTime = 0;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (seq !== _speakSeq) return;
    if (stageId) {
      voiceAudio.src = `${BASE}voice/${stageId}.mp3`;
      voiceAudio.play().catch(() => speakFallback(who, text, seq));
      return;
    }
    speakFallback(who, text, seq);
  }
  function speakFallback(who, text, seq) {
    if (!('speechSynthesis' in window)) return;
    const clean = text.replace(/\(.*?\)/g, '').replace(/[—·"']/g, ' ');
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ko-KR';
    const ko = speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
    if (ko) u.voice = ko;
    u.rate = 1.0;
    setTimeout(() => { if (seq != null && seq !== _speakSeq) return; speechSynthesis.speak(u); }, 60);   // cancel 직후 드롭 회피 + 늦은 발화 차단
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
    // 화자 이름·스피커 아이콘 없이 문장만(유저). '들리는 것'이라는 신호는 모션이 담당한다 —
    // 아래에서 떠오르며 등장하고, 말하는 동안 문장 밑 음파 바가 움직인다.
    (captionEl._t || (captionEl._t = document.getElementById('vc-text'))).textContent = text;
    captionEl.style.opacity = '1';
    captionEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => {
      captionEl.style.opacity = '0';
      captionEl.style.transform = 'translateX(-50%) translateY(10px)';   // 떠올랐다 다시 가라앉으며 사라짐
    }, 4500);
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
    // ★ 복싱 시점 규칙(유저 지정): 시작·중간화면·좌우피하기(B2)·잽잽훅(C3)·리포트만 1인칭,
    //   나머지(A1~A3 · B1 · B3 · C1 · C2 · C4)는 3인칭.
    //   근거: 코치 동작을 봐야 따라 할 수 있어 기본은 3인칭이고, 1인칭은 '내 몸이 겪는 것'
    //   (슬립 회피·콤비네이션)과 전신을 쓰는 화면(시작·전환·리포트)에만 남긴다.
    //   다른 종목은 기존 규칙 유지 — 준비운동(A)만 3인칭.
    const BX_FP = new Set(['BX_READY', 'BX_T1', 'BX_T2', 'BX_B2', 'BX_C3', 'BX_FIN']);
    if (!fpUserSet) setFp(state.pack === 'boxing' ? BX_FP.has(st.id) : !/A\d$/.test(st.id));   // 유저가 수동 토글했으면 그 선택 유지(스테이지마다 강제전환 금지)
    // 스테이지 라벨을 바닥에 문장으로 깔던 상태 슬롯 은퇴 — 세션 HUD 카드 + 세션 FS 슬롯('LEARN 3/4')과
    // 3중 중복이었고 발자국·가이드를 덮는 두 번째 주범. 투사면 = 훈련 큐 전용 원칙.
    veil();  // 단계 전환 암전 (끊김 → 의도된 전환으로)
    // 전환/타이머/리포트(풀스크린 지면 화면)는 하단이 화면 콘텐츠(버튼)라 음성 캡션을 상단으로 이동(겹침 방지).
    // 자막은 항상 상단(우측 체험 패널과 같은 높이선) — 스테이지별 위치 분기 폐기.
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
  sessionReady = true;             // 이 아래부터는 session 접근 안전
  session.onPress = _pressBurst;   // 프레스 완료 버스트 연결
  // 크기 지정 파문 — 세션이 반경(m)을 직접 정할 때(2/4 작은 파형 등). opts로 세기·감쇠속도까지 지정 가능.
  //   opts.wall = 벽면 파문(법선 +z). 이게 없을 땐 무조건 바닥 법선이라, 벽 타겟에 쏜 파문이
  //   가슴 높이에 **눕혀진 원판**으로 떠서 정면에서는 거의 안 보였다(유저: 파형이 전혀 추가가 안 됐다).
  session.onBurst = (wp, sizeM, col, opts) => effects.burst(wp, col || 0xfec389,
    new THREE.Vector3(0, opts?.wall ? 0 : 1, opts?.wall ? 1 : 0),
    { intensity: 0.22, sizeM: sizeM || 0.32, ...(opts || {}) });
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
    if (state.pack !== sport) {
      switchPack(sport);
      // ★ 팩 전환은 비동기 로드 — 이전 팩 토큰인 채 세션을 시작하면 렙 판정이 즉시 완료로
      //   떨어져 스테이지가 연쇄 폭주한다(부팅 가드와 같은 병, 전환 경로 버전). 로드 완료까지 보류.
      if (tokens.pack?.sport !== sport) {
        const w = setInterval(() => {
          if (tokens.pack?.sport === sport) { clearInterval(w); if (!session.active) startSessionFor(sport); }
        }, 120);
        setTimeout(() => clearInterval(w), 5000);   // 로드 실패 안전망 — 5초 뒤 포기(다음 시도에 맡김)
        return;
      }
    }
    // 세션은 반드시 원점에서 시작 — 데모 루프의 심리스 시프트를 전부 리셋.
    // (미리셋 시 세션 UI가 loopShiftZ만큼 밀린 곳(-8m×루프수)에 지어지고
    //  풋프린트 스무딩이 순간이동을 뒤쫓다 전부 클리핑 → 'UI가 하나도 안 보임' 버그)
    state.time = 0; state.loop = 0;
    tokens.loopShiftZ = 0;
    tokens.resetLoop();
    rig.resetOmega();
    lastBodyZ = 0; lastBodyX = 0;
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
    if (!sessionReady || !session.active) return;   // 부트 중 팩 전환 → session 생성 전 호출(배포본 TDZ 실측)
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
  // ★ var — let 은 TDZ 라, 위쪽(300)의 ensureOffBit().then 이 톱레벨 await 틈에 먼저 돌면
  //   'Cannot access before initialization' 으로 죽어 숫자 리베이크가 통째로 빠졌다(블랙박스 실측).
  var glyphRefreshTimer = null;
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
    enforcePalette(st);   // 규칙 ①·③ — 팔레트 밖 색·채도 변경은 여기서 걸러진다
    // 룩 반영 카운터 — 프로덕션 빌드에서도 "룩 편집이 시뮬에 도달했는가"를 콘솔로 확인 가능(진단용 1줄)
    window.__lookRev = (window.__lookRev || 0) + 1;
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
    // 인물 파라미터는 저장 룩에서 복원하지 않는다(유저 07-30) — 예전에 저장된 값
    //   (엣지블러 0.8 · 글로우 0.8 · 흐름 0.35 · 잔상 0.4)이 새 인물 파이프라인에서
    //   얼룩·에코로 드러났다. 랩 슬라이더는 런타임에 FXP.person 을 직접 쓰므로 여전히 살아있다.
    // if (st.p) Object.assign(FXP.person, { blur: st.p.blur, glow: st.p.glow, flow: st.p.flow, decay: st.p.decay });
    // 화면 룩(블룸·노출·그레인) 은퇴 — 저장값(st.s) 무시, 엔진 고정 룩만.
    // (은퇴 전 저장된 그레인 등이 좀비처럼 남는 것 방지 — 포스트프로세싱은 토큰이 아님)
    Object.assign(FX, { bloomStrength: 0.14, bloomThreshold: 0.85, bloomRadius: 0.4, exposure: 0.95, grain: 0, vignette: 0.08 });   // 블룸 축소 — 소형 고휘도 코어가 문대지며 '과한 블러'로 보이던 것 (랩=블룸 거의 없음)
    if (st.bg !== undefined) { FXP.bg = st.bg; setSurfaces(st.bg === 'none' ? null : st.bg); }   // 투사면 칩 → 실물 바닥/벽 (+발형 컨텍스트)
    if (st.prims) FXP.prims = st.prims;   // 프리미티브 파라미터 → 세션 스테이지 빌드 소비 (리로드 반영)
    // 인물(코치) 룩 — 라이브 스냅샷은 'p', 내보내기는 'person'.
    //   ★ 위(1230)에서 st.p 복원을 막아 놨는데 여기서 `|| st.p` 로 도로 들여오고 있었다 —
    //     은퇴시킨 아티팩트 파라미터가 그대로 부활하던 경로. 실측(design-default.json lab.p):
    //     blur .8 · glow .8 · flow .35 · decay .4 · grain .07 → 인물 영상에 잔상(핑퐁 RT 누적)과
    //     필름 그레인이 계속 걸려 있었다. 07-30 결정("인물 = 뉴턴톤만, 나머지 0")대로 걸러 받는다.
    //     저장본이 무엇이든 런타임은 항상 이 규칙 — 좀비 값이 다시 살아날 경로를 없앤다.
    const PERSON_KEEP = ['detail', 'tone', 'sweep', 'ink', 'inkT'];   // 음영·톤·세로대역 = 룩 토큰 / blur·glow·flow·decay·grain = 아티팩트(은퇴)
    const stPerson = st.person || st.p;
    if (stPerson) {
      for (const k of PERSON_KEEP) if (stPerson[k] != null) FXP.person[k] = stPerson[k];
      Object.assign(FXP.person, { blur: 0, glow: 0, flow: 0, decay: 0, grain: 0 });
    }
    if (st.lane) FXP.lane = st.lane;      // 레인 전용 스타일 (화살표 LINE과 분리 — 유저 확정)
    // markShape(랩 표현형 토글)는 미리보기용 — 시뮬 루프 마크는 설계대로 존 원 고정
    // (발형 SDF 인프라는 세션 티칭 컨텍스트용으로 보존: fxlut.footSDFTexture)
    if (st.arrow) {
      const changed = JSON.stringify(st.arrow) !== JSON.stringify(FXP.arrow);
      Object.assign(FXP.arrow, st.arrow);
      if (changed) refreshGlyphConsumers();   // 화살표 자루 리빌드
    }
    // 마크 숫자 활자 = **OffBit 정본 확정(유저)** — 저장 룩의 numSrc 는 더 이상 채택하지 않는다.
    //   구버전 랩 저장분(localStorage)에 'glyph'(SVG 활자)가 박혀 있어 부팅마다 정본을
    //   되돌렸다(실측: 두 기기 모두 발자국 숫자가 옛 활자). 랩 안 실시간 토글은 랩 창 전용.
    if (st.glyphs && typeof st.glyphs === 'object') {
      const changed = JSON.stringify(st.glyphs) !== JSON.stringify(GLYPHS.map);
      FXP.customGlyphs = st.glyphs;
      // 통째 교체였다 — 그러면 정본은 물론 L·R 까지 사라진다(실측: 두 슬롯이 '없음'이었다).
      // 랩에서 실시간으로 오는 상태 — 세대가 같으면 저장본(=랩에서 방금 올린 것)이 이긴다.
      GLYPHS.set(mergeGlyphs(st.glyphs, st.glyphRev));
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
    // 촬영지 톤 3종(실내·타일코트·트랙)을 앞에 둔다 — 실제 촬영 장소와 톤앤매너를 맞춘 프리셋(유저 레퍼런스 사진).
    const SURF_DEFS = [['none', '다크'], ['indoor', '실내'], ['court_tile', '코트(타일)'], ['track', '트랙'], ['grass', '잔디'], ['court_gray', '코트(회색)'], ['court_black', '코트(검정)'], ['court', '코트(우드)'], ['paving', '보도블럭'], ['dirt', '흙길']];
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
    // 종목별 기본 투사면 = 실제 촬영 장소와 같은 공간(유저 레퍼런스 사진).
    //   농구는 court_black(네이비)이 기본이었는데 촬영지는 밝은 조립식 타일 코트다 — 톤이 정반대라 교체.
    //   구 프리셋(검정·회색·우드)은 칩에 그대로 남아 있다.
    const SURF_DEFAULT = { running: 'track', boxing: 'indoor', basketball: 'court_tile' };
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
    // 룩 저장 = rev 보존이 필수. 랩 스냅샷(labSnapshot)엔 rev가 없어서 저장할 때마다 rev가 사라지고,
    // 다음 로드의 룩 리비전 검사(`lab.rev !== dlab.rev`)가 '구버전'으로 판정해 유저가 편집한 룩을
    // design-default.json으로 통째 되돌렸음 (유저: '새로고침하면 룩 적용된 게 초기화돼').
    const saveLab = (st) => {
      const cur = designStore.globalGet('fx', 'lab', null);
      const withRev = (st.rev == null && cur?.rev != null) ? { ...st, rev: cur.rev } : st;
      designStore.globalSet('fx', 'lab', withRev); designStore.save();
    };
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
        saveTimer = setTimeout(() => saveLab(d.state), 400);
      }
    });
    // 별도 탭에서 연 룩 시스템(standalone fxlab)은 postMessage 부모가 없어 자기 localStorage에만 저장 →
    // 시뮬에 반영이 안 됐음(유저: '수정한 화살표가 실시간 반영 안 돼'). storage 이벤트는 '다른 탭'의
    // 쓰기에만 발생하므로 그대로 룩 브리지가 된다 (랩 자동저장 주기 0.8s = 반영 지연 상한).
    window.addEventListener('storage', ev => {
      if (ev.key !== 'newton_fxlab_v1' || !ev.newValue || ev.newValue === lastJson) return;
      let st = null;
      try { st = JSON.parse(ev.newValue); } catch (e) { return; }
      lastJson = ev.newValue;
      applyLabState(st);
      updateSurfChips(st?.bg || 'none');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveLab(st), 400);
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
    { const _a = xbot.getAnchor(); lastBodyX = _a.x; lastBodyZ = _a.z; }
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
      ['cmu_crossover_shot', '★★★ 06_14 크로스오버+슛 (CMU) — B2 검증 요청분'],
      ['cmu_crossover_turn', '★★★ 06_12 전진드리블+90°턴+크로스오버 (CMU·이동) — 검증 요청분'],
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
    // READY 페이즈2(등장 후 2초) — A1 원본 데모판을 그대로 UI 캡슐 뒤에. 캔버스 사제 비디오 폐기(유저).
    // 시작화면 인물 = 힉스필드 kling i2v 그린스크린 전신 루프(828×1108 = 3:4, 유저 08-05).
    //   운동 데모(목·어깨 / 스쿼트)가 아니라 '그 종목을 하는 사람' — 시작화면은 아직 동작 지시가 없다.
    //   전신 소스라 크롭 창 없음(cropOff 0 · cropScale 1). w/h = 3:4 유지, ph 0.83 = 인물이 프레임에 찬 비율.
    // ★ 잘림의 원인은 배치가 아니라 **소스 여백**이었다(유저 반복 지적). 힉스필드 원본은 인물이
    //   프레임에 꽉 차서 발끝·머리가 refEdge 4변 페이드(하단 8%·상단 10%)와 cutFade 하단 경계
    //   판정에 그대로 걸린다 — w/h/fwd 를 아무리 옮겨도 페이드는 플레인 비율에 걸려 따라온다.
    //   그래서 클립 자체를 0.78 로 줄여 순수 그린(#00FF00)으로 사방 11% 패딩(ffmpeg, 828×1108 유지).
    //   패딩은 키에서 100% 빠지므로 페이드는 여백만 먹는다. w/h 는 1/0.78 배로 올려 화면 크기 보존.
    // 인물 1.2배 + 위로(유저 08-05: 캡슐 하단 130 축소 후 인물이 빛에 묻혀 안 보인다)
    READY:    { src: 'ready-view/assets/run/runner_green.mp4', cropOff: 0.0, cropScale: 1.0, w: 0.432, h: 0.578, fwd: 0.10, ph: 0.76 },
    BK_READY: { src: 'ready-view/assets/bk/dribble_green.mp4', cropOff: 0.0, cropScale: 1.0, w: 0.432, h: 0.578, fwd: 0.10, ph: 0.76 },   // 러닝과 동일 규격
    A1: { src: 'ready-view/assets/sean_neck_shoulder.webm', cropOff: 0.40, cropScale: 0.58, w: 0.62, h: 0.64, fwd: 0.02, ph: 0.83 },   // 프리뷰 캡슐 안 — 타이틀 안 가리게 축소·아래(유저 08-05)
    A2: { src: 'ready-view/assets/sean_lunge.webm', cropOff: 0.0, cropScale: 1.0, w: 0.9, h: 0.9, fwd: -0.02, zoom: 0.86, ph: 0.65 },   // fwd .10→-.02 = 0.12m(≈175px) 아래로 — 머리가 캡슐 하단과 겹쳤다(유저 #151)   // 런지 전신 측면 — 축소로 뒷발이 프레임 페이드에 안 걸리게(유저)
    A3: { src: 'ready-view/assets/sean_highknee.webm', cropOff: 0.0, cropScale: 1.0, w: 0.82, h: 0.82, fwd: -0.04, ph: 0.87 },   // 하이니 — 캡슐 카드 아래로(머리 겹침 방지, 캡슐 시스템)
    // 농구 워밍업 코치 영상(kling i2v·그린스크린 960²) — 러닝 A2/A3와 동일 크기(w/h 0.9). 인물이 프레임 채워 1.2는 넘침(유저).
    // _pp = 정방향+역방향 이어붙인 핑퐁 클립(ffmpeg reverse) — 끝에서 뚝 끊고 처음으로 점프하던 것 제거(유저).
    //   loop=true 그대로 두고 자산만 교체 = 런타임 역재생(currentTime 역주행 시킹) 비용 0.
    BK_A1: { src: 'ready-view/assets/bk_sidebend_pp.webm', cropOff: 0.0, cropScale: 1.0, w: 0.62, h: 0.64, fwd: 0.02, ph: 0.80, tone: 0.045 },   // 프리뷰 캡슐 규격(유저 08-05)   // 옆구리 스트레치
    BK_A2: { src: 'ready-view/assets/bk_highknee.webm', cropOff: 0.0, cropScale: 1.0, w: 0.9, h: 0.9, fwd: 0.10, ph: 0.85 },   // 무릎 들기
    // 훈련 관찰 공통 — 이게진짜.mp4(그린스크린 정면 로우 드리블) 핑퐁 베이크(_pp, ffmpeg reverse concat)
    BK_B1: { src: 'bhandle_pp.mp4', cropOff: 0.0, cropScale: 1.0, w: 0.55, h: 0.98, fwd: 0.22, ph: 0.62 },   // 워밍업 위계와 크기·거리 통일(유저 #75) — 0.42/fwd0.45 는 작고 멀었다. 9:16 유지
    BK_B2: { src: 'stepback_fwd.mp4', cropOff: 0.0, cropScale: 1.0, w: 1.04, h: 0.87, fwd: 0.10, ph: 0.63, rng: [0.03, 0.86], tone: 0.09 },   // 소스 720x1280 · rng = 인물 블롭 실측(골대·콘이 측정 오염)
    BK_B5: { src: 'stepback_fwd.mp4', cropOff: 0.0, cropScale: 1.0, w: 1.04, h: 0.87, fwd: 0.10, ph: 0.63, rng: [0.03, 0.86], tone: 0.09 },
    BK_B4: { src: 'stepback_fwd.mp4', cropOff: 0.0, cropScale: 1.0, w: 1.04, h: 0.87, fwd: 0.10, ph: 0.63, rng: [0.03, 0.86], tone: 0.09 },
    BK_B3: { src: 'stepback_fwd.mp4', cropOff: 0.0, cropScale: 1.0, w: 1.04, h: 0.87, fwd: 0.10, ph: 0.63, rng: [0.03, 0.86], tone: 0.09 },   // 소스 720x1280 — 9:16 유지
    BK_C2: { src: 'stepback_fwd.mp4', cropOff: 0.0, cropScale: 1.0, w: 1.04, h: 0.87, fwd: 0.10, ph: 0.63, rng: [0.03, 0.86], tone: 0.09 },   // 실전 = 같은 클립을 타이밍 소스로만
    BK_A3: { src: 'ready-view/assets/bk_squat.webm',    cropOff: 0.0, cropScale: 1.0, w: 0.9, h: 0.9, fwd: 0.10 },   // 스쿼트
  };
  const _coaches = {};   // stageId → { video, plane, _fwd }
  // ── 코치 두께·휘도 필드 = 저해상 RT + 분리형 가우시안 (복싱 판 uHeat와 같은 방식) ──
  //   프래그먼트 링 탭(8방향)으로 대신했더니 반경을 키우자마자 팔각형 면이 드러났다
  //   ("필름지 붙인 것 같다" — 유저). 링 샘플링으로는 넓은 블러를 못 만든다.
  //   rt.r = 마스크(두께장) · rt.g = 마스크로 프리멀티한 휘도 → 셰이더에서 g/r 로 복원.
  // ── 클립 노출 실측 — 두 종목 인물 톤을 맞추는 유일한 지점 ────────────────────
  //   같은 셰이더인데 복싱(어두운 탱크톱)은 진하고 러닝(밝은 옷·햇빛)은 하얗게 나왔다.
  //   원인은 파라미터가 아니라 **입력 분포**다 — 클립마다 노출이 다르다. 셰이더 값으로는
  //   못 맞춘다(여러 번 시도해 확인). 색을 정하기 전에 소스를 같은 밝기로 옮긴다.
  //   그린 배경은 셰이더 크로마와 같은 판정으로 제외 — 배경이 평균에 섞이면 보정이 어긋난다.
  const _expCv = document.createElement('canvas'); _expCv.width = _expCv.height = 96;
  const _expCtx = _expCv.getContext('2d', { willReadFrequently: true });
  function clipExposure(v, st) {
    const now = performance.now();
    if (now - (st._expT || 0) < 250) return st._exp ?? 0.5;   // 4Hz — 노출은 프레임마다 안 변한다
    st._expT = now;
    if (!v || !v.videoWidth) return st._exp ?? 0.5;
    try {
      // 16×16 은 블록 평균이라 휘도 극값(p5·p95)을 뭉갠다 — 실측: hi 0.735 vs 실제 0.864.
      //   96×96 이면 개별 픽셀에 충분히 가깝고 4Hz 비용은 무시 가능.
      _expCtx.drawImage(v, 0, 0, 96, 96);
      const px = _expCtx.getImageData(0, 0, 96, 96).data;
      let sum = 0, n = 0;
      const lums = [];
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
        if (g - Math.max(r, b) > 0.10) continue;   // 그린 배경 제외
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += l; n++; lums.push(l);
      }
      if (n > 12) {
        st._exp = sum / n;
        // 룩2(uPForm)용 범위 실측 — 평균만 맞추면 명암 폭이 좁은 클립이 통째로 상한에
        // 붙어 민짜가 된다(유저: 러닝만 디테일 실종). 앱의 p5~p95 스트레치 대응.
        lums.sort((a, b) => a - b);
        st._lo = lums[Math.floor(lums.length * 0.05)];   // 앱과 동일 p5
        st._hi = lums[Math.floor(lums.length * 0.95)];
      }
    } catch (e) { /* 크로스오리진 — 보정 없이 간다 */ }
    return st._exp ?? 0.5;
  }

  // ── PERSON_GLSL 공용 유니폼 주입 (단일 소스) ───────────────────────────────
  //   이 GLSL 을 include 하는 셰이더는 셋이다: 바닥 코치판 · 데모판 · 벽 인물.
  //   uPSat/uPSweep 을 세 군데서 각자 세팅하면 반드시 한 곳이 빠지고, 빠진 인물만 무채가 된다.
  //   그래서 주입은 이 함수 하나로 못박는다 — 새 인물 셰이더를 붙일 때도 여기만 부르면 된다.
  //     uPSat   = 채도. 마크 LUT와 같은 소스(FXP.sat)에서 — 슬라이더 하나가 인물·발자국 둘 다 이동.
  //     uPSweep = 세로 열 그라디언트 폭(0 = 도입 전과 픽셀 동일).
  //     coral   = 코랄 억제(면별). 코랄은 램프 한가운데라 T 가 고르면 최대 면적을 먹는다 —
  //               벽은 T 가 높이라 그게 곧 몸통이다. 0 = 도입 전과 픽셀 동일.
  const setPersonUniforms = (U, hi = 0.86, coral = 0, exp = 0.5, lo = 0.12, hiL = 0.85, lumLin = 0, tone = 0) => {   // hi = 대역 상단 · exp = 노출 · lo/hiL = 휘도 범위 · lumLin = 텍스처 리니어 · tone = 클립별 톤 트림
    if (!U) return;
    if (U.uPExp) U.uPExp.value = exp;
    if (U.uPLo) U.uPLo.value = lo;
    if (U.uPHiL) U.uPHiL.value = hiL;
    if (U.uPLumLin) U.uPLumLin.value = lumLin;
    // ★ cal 이 없어도 **무조건 리셋** — 조건부 리셋이던 동안 클립 tone 가산이 매 프레임
    //   누적돼 발산했다(실측: 1초에 +0.27 씩). 유니폼은 절대값 대입만.
    const cal = FXP.person?.cal;
    if (U.uPCalWave) U.uPCalWave.value = cal?.wave ?? 1;
    if (U.uPCalD) U.uPCalD.value = cal?.d ?? 1;
    if (U.uPCalW) U.uPCalW.value = cal?.w ?? 1;
    if (U.uPCalB) U.uPCalB.value = (cal?.b ?? 0) + tone;
    if (U.uPForm) U.uPForm.value = FXP.person?.form ?? 0;   // 레퍼런스 규약 토글(랩에서 켠다)
    if (U.uPCoral) U.uPCoral.value = coral;
    if (U.uPSat) U.uPSat.value = 1.0 + (FXP.sat ?? 1) * 0.32;
    if (U.uPSweep) U.uPSweep.value = FXP.person?.sweep ?? 0;
    if (U.uPHi) U.uPHi.value = hi;
    if (U.uPDepth) U.uPDepth.value = FXP.person?.depth ?? 0.34;
    //     uPInk/uPInkT = 명암 잉크(그늘 → 뉴턴 RED). 0 = 도입 전과 픽셀 동일.
    if (U.uPInk) U.uPInk.value = FXP.person?.ink ?? 0.30;
    if (U.uPInkT) U.uPInkT.value = FXP.person?.inkT ?? 0.42;
  };
  // ── 인물 필드 공용 규칙 ────────────────────────────────────────────────────
  //   인물 경로가 둘이다: 벽 데모 판(uHeat)과 바닥 코치 판(uField). 구조가 같은데 값이 따로
  //   놀아서, 08-03 에 복싱에서 잡은 것들이 러닝·농구에는 안 들어가 있었다. 한 곳에 모은다.
  //   여기 값을 바꾸면 **모든 인물 뷰**에 같이 적용된다. 다시 갈라지지 않게 하는 게 목적이다.
  const PERSON_FIELD = {
    // ① 반정밀도 — 8비트로 두면 detail 증폭 단계에서 1/255 계단이 몇 배로 벌어져
    //    밝은 면이 물감 자국처럼 갈라진다(유저: "부드러운 면이 사라지고 거친 면").
    rt: { type: THREE.HalfFloatType },
    // ② 결(detail) 상한 — 셰이더가 clamp(uDetail * 2.4) 라 **0.417 이상이면 좁은 필드 100%** 다.
    //    저해상 필드를 3~4배 확대해 쓰는 비율이라, 포화시키면 평평한 면에서 저해상 구조가
    //    덩어리로 드러난다(유저: 얼룩덜룩 + 과질감). 0.45 배로 눌러 46% 근처에 둔다.
    DETAIL_K: 0.45,
    detail: () => (FXP.person?.detail ?? 0.42) * 0.45,
    // ③ 넓은 필드(국소 평균)의 폭은 룩 슬라이더에서 **떼어 놓는다**.
    //    person.blur 에 묶어 두면 07-30 "인물 = 나머지 0" 결정으로 blur=0 이 될 때 폭이
    //    좁은 필드와 붙어 DoG(밴드패스)가 되고, 주름 대신 압축 노이즈를 증폭한다.
    WIDE_STEP: 3.8,
  };
  let _cf = null;
  function coachField() {
    if (_cf) return _cf;
    // 씬 스테이지(?scene=)는 인물이 화면을 크게 채운다 — 필드 격자를 2배로(찌글임 완화, 유저).
    // ★ 블러 σ 는 UV 기준 보존: 텍셀 간격을 '기준 해상도(480×720)'로 고정하고 RT 만 키운다.
    //   σ 가 좁아지면 룩2 캘리브레이션(표면블러 keep·detail)이 통째로 틀어진다.
    // ★ 상시 2배 — 씬 스테이지에만 2배였는데, 제품 뷰도 인물 판이 작아 1배 필드(넓은장 120×180)가
    //   다리 같은 얇은 부위에서 블록 계단으로 드러났다(유저: 화질저하). σ 는 텍셀 기준이라 룩 불변.
    const HQ = 2;
    const RW = 480 * HQ, RH = 720 * HQ;   // 320×480 은 960² 소스의 미세 결(저지 주름)을 3배 다운샘플로 죽였다 — 룩2 stdG 병목(실측 16 vs 27)
    // (renderCoachField 의 가로 등방 보정이 이 값을 읽는다)
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const src = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uCropOff: { value: 0 }, uCropScale: { value: 1 } },
      vertexShader: vs,
      fragmentShader: `varying vec2 vUv; uniform sampler2D map; uniform float uCropOff, uCropScale;
        void main(){
          vec3 c = texture2D(map, vec2(vUv.x, uCropOff + vUv.y * uCropScale)).rgb;
          float m = 1.0 - smoothstep(0.04, 0.14, c.g - max(c.r, c.b));
          gl_FragColor = vec4(m, dot(c, vec3(0.299, 0.587, 0.114)) * m, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const blur = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uStep: { value: 2 },
        uTexel: { value: new THREE.Vector2(1 / RW, 1 / RH) } },   // 탭 간격 — 크면 블러가 아니라 엣지 에코가 된다
      vertexShader: vs,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 uDir, uTexel; uniform float uStep;
        void main(){
          vec2 px = uDir * uStep * uTexel;
          vec2 s = texture2D(tex, vUv).rg * 0.227;
          s += (texture2D(tex, vUv + px * 1.385).rg + texture2D(tex, vUv - px * 1.385).rg) * 0.3165;
          s += (texture2D(tex, vUv + px * 3.23).rg + texture2D(tex, vUv - px * 3.23).rg) * 0.070;
          gl_FragColor = vec4(s, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const sc = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), src);
    sc.add(quad);
    // 공용 규칙(PERSON_FIELD) — 벽 데모 판과 같은 정밀도. 8비트로 두면 detail 증폭 단계에서
    //   1/255 계단이 몇 배로 벌어져 밝은 면이 물감 자국처럼 갈라진다(유저 08-03, 복싱에서 먼저 확인).
    const mk = (w = RW, h = RH) => new THREE.WebGLRenderTarget(w, h, PERSON_FIELD.rt);
    // 넓은 평균 전용 저해상 그리드(80x120).
    //   ⚠ 해상도를 올려봐야 소용없다(실측). >>1(160x240) + 블러 스텝 2배로 σ 를 보존하면
    //     결과가 기준과 픽셀 수준으로 같다: 채도μ 0.587→0.586 · 국소Δ색상 0.581→0.586.
    //     당연한 결과다 — W 는 정의상 '국소 평균'이라 어느 격자에서 굽든 같은 값에 수렴한다.
    //     σ 를 안 보존하고 해상도만 올리면 값은 변하지만(채도μ 0.633) 그게 바로 아래 주석이
    //     말하는 DoG 얼룩이다. '인물이 흐리멍텅하다'의 해법은 이쪽이 아니라 uDetail 이었다
    //     (0.25→0.42 에서 국소Δ색상 0.581→0.701). 같은 시도를 또 하지 않도록 남긴다.
    const LW = RW >> 2, LH = RH >> 2;
    // A/B = 핑퐁, N = 1회 블러(좁음 — 이목구비·모공만 지운 '결'), W = 3회 블러(넓음 — 두께장·노출)
    _cf = { rts: [mk(), mk(), mk(), mk()], lo: [mk(LW, LH), mk(LW, LH)],
            texel: [HQ / RW, HQ / RH, HQ / LW, HQ / LH],   // 기준 해상도 텍셀 — σ 보존(위 주석)
            rw: RW, rh: RH,   // 가로 등방 보정(renderCoachField)이 읽는다
            cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), src, blur, sc, quad };
    return _cf;
  }
  function renderCoachField(co) {
    const f = coachField();
    const prev = renderer.getRenderTarget();
    f.src.uniforms.map.value = co.mat.uniforms.map.value;
    f.src.uniforms.uCropOff.value = co.mat.uniforms.uCropOff.value;
    f.src.uniforms.uCropScale.value = co.mat.uniforms.uCropScale.value;
    f.quad.material = f.src;
    renderer.setRenderTarget(f.rts[0]); renderer.clear(); renderer.render(f.sc, f.cam);
    f.quad.material = f.blur;
    // 분리형 가우시안 — 1회차 결과(N)는 '결', 3회차 결과(W)는 '두께장·노출'로 따로 쓴다.
    //   원본 영상을 직접 샘플링하면 모공·이목구비까지 색에 실려 '주황 필터 씌운 사진'이 된다(유저).
    const [A, B, N] = f.rts, [L0, L1] = f.lo;
    // ★ 가로 보정 — 블러 반경은 **텍셀 기준**인데 이 필드는 소스를 비등방으로 짜 넣는다.
    //   실측(08-01): 코치 소스 960×960 을 세로 crop 0.58 만 잘라(960×557) 320×480 RT 에 굽는다.
    //     가로 텍셀밀도 320/960 = 0.333 /px · 세로 480/557 = 0.862 /px → **2.6배 비등방**.
    //   같은 uStep 이 가로에선 소스 2.6배 폭을 먹는다 = 인물이 가로로만 과하게 뭉갠다
    //   (유저: "바닥은 프레임에서 인물이 작아서 블러가 과하게 먹는 것 같다" — 맞다).
    //   벽 데모 판은 인물에 딱 맞춰 crop 하므로(0.386×1.22) 이 왜곡이 거의 없다.
    const vid = co.mat.uniforms.map.value?.image;
    const srcW = vid?.videoWidth || vid?.width || 1;
    const srcH = (vid?.videoHeight || vid?.height || 1) * (co.mat.uniforms.uCropScale.value || 1);
    // 가로 스텝을 이 비율만큼 줄이면 소스 픽셀 기준으로 등방이 된다
    const kx = Math.min(1, (srcH / f.rh) / Math.max(srcW / f.rw, 1e-4));
    // ★ 인물 비례 반경 — 반경이 RT 고정이라 인물이 프레임에서 작을수록(광각 클립) 상대
    //   블러가 커져 결이 뭉개지고 흰 레이어가 퍼져 단조로워졌다(유저 #73). 클립별 실측
    //   인물 높이(cfg.ph, 기준 0.83)에 비례시켜 어떤 프레이밍이든 같은 결 스케일.
    const kp = (co.cfg?.ph ?? 0.8) / 0.83;
    const pass = (srcRT, dstRT, dir, lo) => {
      f.blur.uniforms.tex.value = srcRT.texture; f.blur.uniforms.uDir.value.set(dir[0], dir[1]);
      const tx = (lo ? f.texel[2] : f.texel[0]) * (dir[0] ? kx : 1) * kp;
      f.blur.uniforms.uTexel.value.set(tx, (lo ? f.texel[3] : f.texel[1]) * kp);
      renderer.setRenderTarget(dstRT); renderer.clear(); renderer.render(f.sc, f.cam);
    };
    // N(좁음) = 고해상 1회. detail = N - W 인데 두 σ가 가까우면 DoG(밴드패스)가 되어
    //   옷 주름이 아니라 중간주파 압축 노이즈를 골라 증폭한다 — 얼룩덜룩의 정체(유저).
    //   그래서 W 는 1/4 해상도 그리드에서 굽는다: σ가 4배로 벌어져 진짜 '국소 평균'이 된다.
    pass(A, B, [1, 0]); pass(B, N, [0, 1]);                    // 좁음 → N
    pass(N, L0, [1, 0], true); pass(L0, L1, [0, 1], true);     // 1/4 그리드로 낮추며 블러
    pass(L1, L0, [1, 0], true); pass(L0, L1, [0, 1], true);
    pass(L1, L0, [1, 0], true); pass(L0, L1, [0, 1], true);    // → L1 = 넓은 평균
    renderer.setRenderTarget(prev);
    co.mat.uniforms.uField.value = L1.texture;
    co.mat.uniforms.uFieldN.value = N.texture;
  }
  function ensureCoach(id) {
    if (_coaches[id]) return _coaches[id];
    const cfg = COACH_CFG[id];
    const video = document.createElement('video');
    video.src = import.meta.env.BASE_URL + cfg.src;   // VP9 — 전 브라우저 디코드
    // 소스가 없으면 인물이 통째로 사라진다(실측: runner_green.mp4 미커밋 상태) — 폴백을 건다.
    video.addEventListener('error', () => {
      if (video.dataset.fb) return;
      video.dataset.fb = '1';
      video.src = import.meta.env.BASE_URL + (cfg.fallback || 'ready-view/assets/sean_neck_shoulder.webm');
      video.play().catch(() => {});
      console.warn('[coach] 소스 없음 → 폴백:', cfg.src);
    }, { once: false });
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    video.style.display = 'none'; document.body.appendChild(video);
    video.play().catch(() => {});
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    // ★ 밉맵 — 바닥 판은 960² 소스를 화면 ~250px 로 **축소** 샘플링한다. 밉 없는 Linear 축소는
    //   앨리어싱이라 크로마 경계·결이 블록으로 깨졌다(유저: "심각한 화질저하"). WebGL2 라 비POT 허용.
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: tex }, uLUT: { value: getLUT() }, uTime: { value: 0 }, uReady: { value: 0 }, uZoom: { value: cfg.zoom ?? 1 },
        uField: { value: coachField().lo[1].texture }, uFieldN: { value: coachField().rts[2].texture },
        uCropOff: { value: cfg.cropOff }, uCropScale: { value: cfg.cropScale }, uDetail: { value: 0.25 },
        // uPulse 0 — 복싱 인물엔 루마 펄스가 없다(톤을 흔드는 원인이라 끈다).
        // uPSat·uPSweep = PERSON_GLSL 공용(구 uSat 은 죽은 유니폼이라 폐기).
        uPSat: { value: 1.32 }, uPSweep: { value: 0 }, uPHi: { value: 0.86 }, uPDepth: { value: 0.34 }, uPCoral: { value: 0 }, uPExp: { value: 0.5 }, uPForm: { value: 0 }, uPLo: { value: 0.12 }, uPHiL: { value: 0.85 }, uPLumLin: { value: 0 }, uPCalWave: { value: 1 }, uPCalD: { value: 1 }, uPCalW: { value: 1 }, uPCalB: { value: 0 },
        uPInk: { value: 0.85 }, uPInkT: { value: 0.42 }, uPulse: { value: 0.0 }, uEnter: { value: 99 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D map, uLUT, uField, uFieldN; uniform float uTime, uCropOff, uCropScale, uPulse, uReady, uDetail, uEnter;
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
        ` + PERSON_GLSL + CUT_FEATHER_GLSL + REF_LOOK_GLSL + `
        uniform float uZoom;   // 1 = 원본. <1 = 인물 축소(하단 고정) — 발이 프레임 가장자리 페이드에 걸리는 장면용
        vec2 crop(vec2 uv){
          uv.x = (uv.x - 0.5) / uZoom + 0.5;
          uv.y = uv.y / uZoom;   // 하단 고정 — 발 접지 유지, 위·옆으로만 여백 생성
          return vec2(uv.x, uCropOff + uv.y * uCropScale); }
        // 그린 제거만. (빈 프레임 방지는 픽셀 휘도가 아니라 프레임 단위 uReady가 담당 —
        //  픽셀로 자르면 그림자·모자·옷주름이 통째로 뚫린다: 실측 피사체 14% 소실)
        float mask1(vec2 uv){ vec3 c = texture2D(map, crop(uv)).rgb; float k = c.g - max(c.r, c.b);
          // 접지 그림자(어두운 초록)는 그린 우세가 약해 키를 반쯤 통과 → 발밑 흙탕(유저).
          //   어두울수록 우세 판정을 증폭해 배경으로 — 인물의 어두운 옷(네이비 등)은 g<max(r,b)라 무관.
          float lum1 = dot(c, vec3(0.299, 0.587, 0.114));
          k *= mix(1.45, 1.0, smoothstep(0.08, 0.30, lum1));   // 2.4 는 어두운 반바지의 그린 반사까지 먹어 구멍(실측)
          return 1.0 - smoothstep(0.04, 0.14, k); }
        // 크로마키 안티에일리어싱 — 소스가 전부 yuv420p(크로마 절반 해상도)라 단일 탭 키는
        //   확대 시 2px 블록 계단으로 드러난다(유저 스샷). 대칭 5탭 평균이라 엣지 위치는 안 움직인다.
        float maskAA(vec2 uv){
          float s = mask1(uv) * 0.36;
          for (int k = 0; k < 4; k++) {
            vec2 d = vec2(cos(1.5708 * float(k) + 0.785), sin(1.5708 * float(k) + 0.785));
            s += mask1(uv + d * 0.0018) * 0.16;
          }
          return s;
        }
        float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(ch(i),ch(i+vec2(1,0)),f.x),mix(ch(i+vec2(0,1)),ch(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 uv = vUv;
          vec3 c = texture2D(map, crop(uv)).rgb;
          // 깜빡임 방지는 tickA1Coach의 readyState 게이트가 전담 — 픽셀 검은-discard는 어두운 셔츠·그림자에
          // 구멍을 뚫으므로 제거(유저). 크로마키만: 초록 초과분으로 배경만 판정.
          float m = maskAA(uv);
          float mEro = smoothstep(0.26, 0.44, m);   // 결정적 마스크 — 어두운 신발+그린스필이 중간 대역에 남아 회색 뭉침(유저 #68). 얇은 구조(골대 림)는 일부 손해
          // 상단 잘림 페더 — 크롭 창이 몸통을 가로지르면 마스크가 프레임 경계에서 딱 끊겨
          //   허리가 칼로 자른 듯 보인다(유저 스샷). 위쪽 12%만 부드럽게 소멸.
          //   하단은 건드리지 않는다 — 발 접지는 또렷해야 한다(유저 확정).
          mEro *= refEdge(uv);   // 4변 페이드(레퍼런스 정본) — 구 상단 12% 페더를 대체
          // 두께장·블러휘도 = 저해상 RT 가우시안 필드(복싱 판 uHeat와 같은 파이프라인)
          vec2 fld = texture2D(uField, uv).rg;    // 넓은 블러 = 두께장·노출
          vec2 fldN = texture2D(uFieldN, uv).rg;  // 좁은 블러 = 이목구비 지워진 결
          // 하단 잘림 — 초점이 서서히 나가며 배경에 녹는다(fx-core cutFade).
          //   '이 프레임이 잘렸나'는 하단 경계를 폭 전체 8탭으로 평균 내 판정한다(열별 판정 금지).
          float botC = 0.0;
          for (int i = 0; i < 8; i++) botC += smoothstep(0.16, 0.52, mask1(vec2((float(i) + 0.5) / 8.0, 0.006)));
          vec2 cf = cutFade(uv.x, uv.y, botC * 0.125, uTime);
          mEro = mix(mEro, smoothstep(0.06, 0.55, fld.r), cf.y) * cf.x;   // 날카로운 실루엣 → 넓은 가우시안
          // 레퍼런스 규약(uPForm)은 실루엣 **밖**에 블룸을 그린다 — 블러장이 남은 곳은 살린다.
          if (max(mEro, step(0.5, uPForm) * fld.r) < 0.02) discard;
          float H = clamp(fld.r * 1.25, 0.0, 1.0);   // 복싱(demoPanel)과 동일 — 1.60 은 코어를 과포화시켜 톤이 갈렸다
          float flow = vn(vec2(uv.x*3.2 + sin(uTime*0.4)*0.3, uv.y*2.4 - uTime*0.5));
          H *= 1.0 + (flow - 0.5) * 0.11;   // 대류 얼룩 최소 — 매끄러운 질감(유저 레퍼런스)
          float lumB = fld.g / max(fld.r, 0.02);          // 국소 평균 = 노출
          // 결 = 좁은 블러. 룩 슬라이더 '음영'(uDetail)이 결의 세기 — 0 이면 완전 평면.
          float lumS = mix(lumB, fldN.g / max(fldN.r, 0.02), clamp(uDetail * 1.6, 0.0, 1.0)   /* 복싱과 동일 */);
          lumS = mix(lumB, lumS, 1.0 - cf.y);   // 초점 나간 구간은 결도 넓은 블러로 녹는다
          float dlum = mix(lumS, lumB, 0.5);            // 펄스 위상용 대표 휘도
          float mIn = smoothstep(0.55, 0.95, m);
          float vy = min(uv.y / uZoom, 1.0);   // 얼굴 대역은 비디오 공간 기준 — 줌 시 어긋나 정수리 반점(실측)
          float faceW = smoothstep(0.80, 0.92, vy) * (1.0 - smoothstep(0.99, 1.0, vy));
          // LUMA PULSE — 휘도를 따라 흐르는 그라디언트 펄스(effect.app 느낌, 뉴턴 LUT 안에서만 이동)
          float pulse = uPulse * sin(uTime * 2.0 - dlum * 7.0);
          // 디더 — 8bit 영상 양자화가 LUT 위에서 밴딩으로 드러나는 것을 픽셀 노이즈로 분해(색 사이 이음)
          float dth = (ch(gl_FragCoord.xy + vec2(uTime, uTime * 1.3)) - 0.5) / 255.0;
          // 색 = fx-core.personLook 공용 정의 — 복싱 인물과 같은 대역·채도·명암 규칙.
          //   구 인라인 lut(pow(baseT,1.5))는 LUT 하단(샌드~코랄)에만 앉아, 상단(레드)에 앉는
          //   복싱 인물과 톤이 갈렸다(유저: "왜 복싱만 과하게 빨갛지").
          // 복싱 인물과 **같은 식**으로 맞춘다: personLook(...) * (실루엣 마스크). 게인·명도상한 없음.
          //   1.12 게인과 V 상한 0.90 은 복싱엔 없는 것이라 톤이 갈렸다(유저: '시뮬레이터 보면 존나 다르다').
          vec3 col; float cov;
          if (uPForm > 0.5) {   // 레퍼런스 규약 — 5중 레이어 합성(fx-core.personAura)
            // 룩2: 전해상 원본 휘도(디스필) — 저해상 필드 휘도는 바닥 판에서 결이 사전에 뭉개진다
            vec3 srcC = texture2D(map, crop(uv)).rgb;
            float lumSharp = dot(vec3(srcC.r, min(srcC.g, max(srcC.r, srcC.b)), srcC.b), vec3(0.299, 0.587, 0.114));
            float lumNRaw = fldN.g / max(fldN.r, 0.02);
            vec4 aura = personAura(mEro, fld.r, lumSharp, lumNRaw, faceW, vec2(uv.x, vy), uTime);
            col = aura.rgb; cov = aura.a;
            // 하단 컷 페이드 — 코랄↔바닥 직접 보간은 중간에서 흙색을 지난다(유저: 손끝 흙탕).
            //   앱(흰 배경)처럼 **흰빛으로 바래며** 소멸시킨다. cf.y = 컷 디포커스 양.
            col = mix(col, vec3(1.0) * cov, cf.y * 0.9);
          } else {
            col = personLook(clamp(H + pulse + dth, 0.0, 1.0), lumS, lumB, mIn, faceW, uv.y) * mEro;
            cov = mEro;
          }
          // ── 등장 워시(유저 08-04): 첫 등장에 다리가 연하게 뜨는 대신, 최심 주황(#FF3300)이
          //   발끝에서 차올라 몸을 한 번 훑고 정상 룩으로 풀린다. uEnter ≥ 1.4s 면 비용 0.
          float et = clamp(uEnter / 1.4, 0.0, 1.0);
          if (et < 1.0) {
            float front = 0.45 + et * 1.1;                      // 시작부터 다리(vy≤0.45) 덮고 → 머리로 전진
            float wash = smoothstep(front, front - 0.34, vy);   // 파면 아래가 진한 주황
            col = mix(col, vec3(1.0, 0.2, 0.0) * cov, wash * (1.0 - et * et) * 0.85);
          }
          // uReady=0 = 아직 실제 프레임이 없다. 이때 그리면 빈 텍스처가 크로마키를 통과해
          //   판이 통째로 검은 사각형/붉은 판으로 보인다(유저 스샷). 아예 안 그린다.
            // 알파도 벽과 동일(구 0.95). 0.95 는 코어에서도 배경을 5% 비치게 해, 밝은 타일 코트 위에서
          //   그대로 물빠짐이 됐다(유저: '왜 이렇게 안 쨍해'). 벽은 mSoft*1.15 라 코어가 완전 불투명이다.
          float alpha = clamp(cov * 1.15, 0.0, 1.0) * uReady;   // (복싱: max(mSoft*1.15, ...))   // 하단 페더 제거(유저) — 발끝까지 또렷하게
          // 빛이 없으면 알파도 0 — 프리멀티(One / OneMinusSrcAlpha)에서 col=0·alpha=1 은 순수 검정이다.
          //   크로마가 흔들리는 프레임에서 판이 통째로 검은 사각형으로 찍히던 근본(유저 3회 신고).
          // 투사광 불변식: 알파는 빛보다 클 수 없다. 프리멀티(One/OneMinusSrcAlpha)에서 알파는
          //   '뒤를 지우는 양'이라, 어두운 픽셀이 큰 알파를 가지면 그만큼 판이 검게 뚫린다.
          //   문턱값 게이트(lum<0.02)로는 lum=0.05 같은 '거의 검정'이 통과해 검은 사각형이 남았다.
          //   빛에 비례해 가림을 묶는다 — 빛이 없으면 가림도 없다.
          alpha = min(alpha, max(col.r, max(col.g, col.b)) * mix(1.6, 1.05, uPForm));   // 룩2: 페이드 구간 알파>빛 = 흙탕 밴드(유저)
          // ★ 컴포저 OutputPass 가 화면 전체에 linear→sRGB 를 얹는다. 벽 인물(데모 판)은 출력 직전
          //   역변환으로 그걸 상쇄하는데(main.js ~3039) **코치 판에는 그 줄이 없었다**.
          //   그래서 바닥 인물만 중간톤이 들려 연하게 보였다 — 값 문제가 아니라 색공간 문제다.
          //   (실측 08-01: 벽 명도 0.820 / 러닝 0.906 / 농구 0.984)
          col = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0.015, -1.35);
    plane.visible = false;
    scene.add(plane);
    // 루프 되감기(시크) 동안 디코더가 프레임을 비우면 판이 검게 깜빡인다(유저).
    //   시크 직전 프레임을 캔버스에 떠서 그걸 대신 물려두고, 새 프레임이 들어오면 되돌린다.
    const fz = document.createElement('canvas'); fz.width = 2; fz.height = 2;
    const fzTex = new THREE.CanvasTexture(fz); fzTex.colorSpace = THREE.SRGBColorSpace;
    const co = _coaches[id] = { video, plane, _fwd: new THREE.Vector3(), fwd: cfg.fwd,
      tex, mat, fz, fzTex, _frozen: false, cfg };   // cfg = ph(인물 높이)·rng(범위 오버라이드) 등
    // A1: 코치 영상 위에 회전 큐 2개(drawRotate 룩시스템) — 목(위·작게) + 어깨(아래·크게) 동시에 돌리기 지시.
    if (id === 'A1') {
      const mkCue = (size, x, y) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        // depthTest 는 켜둔다. 껐더니 깊이를 무시하고 3D 러너의 몸까지 뚫고 그려져,
        // 러너가 카메라와 토큰 사이에 설 때 토큰이 목·어깨 위에 겹쳐 '공중에 뜬' 것처럼 보였다(유저 신고).
        // '코치 영상보다 앞'이라는 원래 의도는 실제 높이(패널 y=0.015 < 큐 y=0.035)와
        // renderOrder 30 이 이미 보장한다 — depthTest 를 끌 이유가 없었다.
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
          // 노멀 블렌딩 — 프림 판 공통 규약(session.primPanel과 동일): 가산은 밝은 면에서 워시아웃(유저)
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending }));
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
    // A2 런지: **코치 판 위**에 방향 큐 2개(유저 스케치 #145) — 지면 발자국 옆이 아니라 인물에 붙는다.
    //   A1 회전 큐와 같은 구조(부모=코치 plane · 노멀 블렌딩 · renderOrder 30 · 판 블룸)에
    //   그림만 drawStemArrow(LINE 토큰 정본)로 바꾼다. 새 문법을 만들지 않는다.
    //   방향(패널 로컬 +y=머리쪽): 뒷다리 = 왼쪽·아래(다리 선을 따라 쭉) · 앞무릎 = 아래(눌러 굽혀).
    if (id === 'A2') {
      const mkArr = (len, x, y, rotZ) => {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
        const g = cv.getContext('2d');
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.5, len),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true,
            blending: THREE.NormalBlending }));
        mesh.position.set(x, y, 0.02);
        mesh.rotation.z = rotZ;      // 화살표는 로컬 +Y 로 뻗는다 → 방향 = (−sinθ, cosθ)
        mesh.renderOrder = 30;
        plane.add(mesh);
        return { g, tex, mesh };
      };
      // 앞무릎 큐 x 0.17 → 0.23 (유저 #146: 오른쪽 화살표를 더 다리 쪽으로).
      //   실측 환산: 큐 두 개(로컬 ∓0.17)가 스샷에서 x 60 / 258px → 1 로컬 = 582px,
      //   로컬 0 = 159px. 앞무릎이 스샷 295px → 로컬 0.234.
      co.a2Cues = [mkArr(0.30, -0.17, -0.03, 2.03),   // 뒷다리 — 왼쪽·아래(−0.9,−0.35)
                   mkArr(0.22, 0.23, -0.08, Math.PI)]; // 앞무릎 — 아래(0,−1)
    }
    return co;
  }
  // 시크 직전 프레임 고정 / 새 프레임 도착 시 해제 — 루프 순간 검은 깜빡임 방지
  // 프레임이 실제로 '그림'인지 8×8 축소 샘플로 확인(4Hz) — 디코딩 공백/빈 프레임이면 평균 휘도 ≈ 0.
  const _blankCv = document.createElement('canvas'); _blankCv.width = _blankCv.height = 8;
  const _blankCtx = _blankCv.getContext('2d', { willReadFrequently: true });
  function frameHasImage(co) {
    const now = performance.now();
    if (now - (co._blankT || 0) < 250) return co._frameOk !== false;
    co._blankT = now;
    const v = co.video;
    if (!v.videoWidth) return (co._frameOk = false);
    try {
      _blankCtx.drawImage(v, 0, 0, 8, 8);
      const px = _blankCtx.getImageData(0, 0, 8, 8).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
      co._frameOk = (sum / 64) > 0.02;
    } catch (e) { co._frameOk = true; }   // 크로스오리진 등 판독 불가 시엔 통과
    return co._frameOk;
  }
  function freezeCoach(co) {
    const v = co.video;
    if (!v.videoWidth || co._frozen) return;
    co._fzT = performance.now();
    if (co.fz.width !== v.videoWidth) { co.fz.width = v.videoWidth; co.fz.height = v.videoHeight; }
    try { co.fz.getContext('2d').drawImage(v, 0, 0); } catch (e) { return; }
    co.fzTex.needsUpdate = true;
    co.mat.uniforms.map.value = co.fzTex;
    co._frozen = true;
  }
  function unfreezeCoach(co) { if (!co._frozen) return; co.mat.uniforms.map.value = co.tex; co._frozen = false; }
  let _coachSeekId = null, _coachSeekT0 = null;   // BK_A1 진입 시 시크 래치(+타임아웃)
  // 스텝백 프리뷰 = '영상 N회 재생'. 벽시계로 재면 배속·시작 위상·버퍼링에 어긋난다 —
  //   실제 재생 위치에서 루프 수와 진행률을 뽑아 타이머(링·분수)와 관찰 종료를 같은 값으로 구동한다.
  let _stepId = null, _stepLoops = 0, _stepFrac = 0;
  function tickA1Coach() {
    // 어떤 스테이지 코치를 켤지: 러닝 A1·농구 워밍업 전부 = 전 구간 상시, 러닝 A2/A3 = 시범(관찰) 중에만.
    // 실전(BK_C2)도 같은 클립을 타이밍 소스로 쓴다 — 라이브라고 끊으면 마크가 안 움직인다.
    const st = session.active && (!session.isLive || session.stage === 'BK_C2')
      && (state.pack === 'running' || state.pack === 'basketball') ? session.stage : null;
    const COACH_IDS = ['READY', 'BK_READY', 'A1', 'A2', 'A3', 'BK_A1', 'BK_A2', 'BK_A3', 'BK_B1', 'BK_B2', 'BK_B3', 'BK_B4', 'BK_B5', 'BK_C2'];
    // 관찰이 끝나면(followLatch) 코치를 끄는 게 기존 규약이었다. 단 스텝백 4페이즈(BK_B2~B5)는
    //   따라하기 화면에도 같은 실루엣이 축소되어 남아야 한다(피그마 143:444) — 예외로 계속 켠다.
    const activeId = COACH_IDS.find(id => id === st
      && !(/^(A2|A3|BK_A2|BK_A3|BK_B1)$/.test(id) && session._followLatch)
      // ★ READY 실루엣은 **첫 화면**이다 — 팩 이름 + 사람 형체로 시작하고 2초 뒤 도트 '30 min'
      //   이 자리를 받는다. 시작화면 전체가 8초 루프라(floorgl _paint_ready) 여기도 같은 주기로
      //   껐다 켠다 — % 를 빼면 첫 8초 뒤 인물이 영영 안 돌아온다.
      // ★ READY 실루엣은 첫 화면이다 — 팩 이름 + 사람 형체로 시작하고 2초 뒤 도트 숫자가
      //   자리를 받는다. 시작화면 전체가 8초 루프라 여기도 같은 주기로 껐다 켠다.
      // ★ READY 인물은 **캔버스 영상 오버레이**가 전담(floorgl _paint_ready · 유저 #161).
      //   LUT 3D 판까지 켜면 같은 자리에 두 사람이 겹친다.
      && !/READY$/.test(id)) || null;
    for (const id of COACH_IDS) {
      const c = _coaches[id];
      if (id === activeId) {
        const co = ensureCoach(id);
        // 두께·휘도 필드 갱신 — 활성 코치 1개뿐이라 RT 한 쌍을 공유한다(프레임당 7패스, 128×192)
        if (co.video.readyState >= 2) renderCoachField(co);
        // 옆구리: 스테이지에 들어올 때마다 '왼쪽으로 기우는' 지점에서 시작(유저 필수 요구).
        //   영상 엘리먼트는 스테이지 사이에도 계속 돌아서, 안 잡으면 진입 시점이 매번 달랐다.
        //   왼쪽 굽힘 = 원본 0.00~0.25s → 0.10s에서 시작(0프레임은 가시성 체크 통과 못 함).
        // 프레임 실측(24fps, 몽타주 육안 확인): 0.00~0.25s=왼쪽 굽힘 최고점 · 0.75s 직립 ·
        //   1.7~3.5s=오른쪽 굽힘. 좌우 반전 없음(한때 반전이라 판단했으나, 그 근거로 삼은 캡처가
        //   '시크가 안 먹은 상태의 임의 프레임'이었음 — 잘못된 추론이었다).
        //   readyState<1이면 currentTime 대입이 조용히 무시된다 — 실제로 먹었을 때만 래치.
        //   (안 그러면 한 번 시도하고 끝나서 매번 아무 데서나 시작했음 — 유저: 아직도 오른쪽부터)
        if (id === 'BK_A1' && _coachSeekId !== id) {
          if (_coachSeekT0 == null) _coachSeekT0 = performance.now();
          if (co.video.readyState >= 1) {
            try { co.video.currentTime = 0.10; } catch (e) {}
            if (Math.abs(co.video.currentTime - 0.10) < 0.5) _coachSeekId = id;
          }
          if (performance.now() - _coachSeekT0 > 2500) _coachSeekId = id;   // 안전장치: 영상 없이도 화면은 나와야
        }
        if (id !== 'BK_A1') { _coachSeekId = null; _coachSeekT0 = null; }
        // 단계별 구간 루프 — 4페이즈로 쪼갰으면 각 단계는 '그 구간만' 반복해야 한다(유저).
        //   실측(3.33s 정방향): 준비 0~0.60 · 오른발 딛고 드리블 0.60~1.25 ·
        //   왼발 뻗어 공 잡기 1.25~1.80 · 오른발 모으며 슛 1.80~3.10
        // 2번째(오른발 딛고 드리블)는 유저 지정 1.47s에서 끊는다 — 그 프레임이 '딛는 순간'
        // 누적식(유저) — 구간만 반복하면 앞 동작과 이어지지 않아 따라하기 어렵다.
        //   1단계 0~0.60 / 2단계 0~1.47 / 3단계 0~1.81 / 4단계 0~3.10 = 매 단계가 처음부터 다시.
        const PHW = STEP_SEG[id] ? [0, STEP_SEG[id]] : null;

        if (PHW && co.video.readyState >= 2) {
          const [a, b] = PHW;
          const RATE = stepRate(id), HOLD = stepHold(id);
          if (co.video.playbackRate !== RATE) co.video.playbackRate = RATE;
          const now = performance.now();
          session._pvLoops = _stepLoops;   // 진단용 노출
          if (_stepId !== id) {   // 단계 진입 = 루프 카운터 리셋 + 구간 처음부터
            _stepId = id; _stepLoops = 0; _stepFrac = 0;
            co._holdUntil = 0; freezeCoach(co); try { co.video.currentTime = a; } catch (e) {}
          }
          // 링은 '재생 + 끝프레임 정지'를 하나의 한 바퀴로 본다 — 100%에서 1초 멈췄다 뚝 되감기면
          //   회차 사이가 끊겨 보인다(유저). 정지 구간에도 남은 각도를 채워 다음 재생 시작과 정확히 맞물린다.
          const _playWall = Math.max(0.05, (b - a) / RATE), _share = _playWall / (_playWall + HOLD);
          if (co._holdUntil) {
            const hp = Math.max(0, Math.min(1, 1 - (co._holdUntil - now) / (Math.max(0.001, HOLD) * 1000)));
            _stepFrac = _share + (1 - _share) * hp;
            session.stepVidT = b;   // 정지 구간 = 구간 끝 자세 유지
          } else {
            _stepFrac = _share * Math.max(0, Math.min(1, (co.video.currentTime - a) / Math.max(0.05, b - a)));
            session.stepVidT = co.video.currentTime;   // 마크 배치가 이 값을 그대로 따라간다
          }
          if (co._holdUntil) {
            // 마지막 프레임 1초 정지 후 처음으로 되감아 루프(유저)
            if (now >= co._holdUntil) {
              co._holdUntil = 0; _stepLoops += 1;   // 되감기 시점 = 링이 한 바퀴를 다 돈 순간 = 1회 완료
              freezeCoach(co);
              try { co.video.currentTime = a; } catch (e) {} co.video.play().catch(() => {});
            } else co.video.pause();
          } else if (co.video.currentTime >= b - 0.033) {
            // 30fps라 정확히 b에서 멈출 수 없다 — 한 프레임 앞서 잡고 정지. 시킹은 하지 않는다:
            //   시킹 중엔 비디오 텍스처가 비어 균일색이 되고, 크로마 마스크를 통과 못 해
            //   판 전체가 붉게 칠해졌다(유저 스샷). 현재 프레임 그대로 얼리는 게 안전하다.
            if (HOLD > 0) { co._holdUntil = now + HOLD * 1000; co.video.pause(); }
            else { _stepLoops += 1; freezeCoach(co); try { co.video.currentTime = a; } catch (e) {} }   // 실전 = 정지 없이 바로 이어서
          } else {
            if (co.video.currentTime < a - 0.05) { freezeCoach(co); try { co.video.currentTime = a; } catch (e) {} }
            if (co.video.paused) co.video.play().catch(() => {});
          }
        }
        // 새 프레임이 실제로 들어왔으면 고정 해제
        if (co._frozen && ((!co.video.seeking && co.video.readyState >= 3
            && co.video.currentTime > (PHW ? PHW[0] : 0) + 0.03) || performance.now() - (co._fzT || 0) > 350)) unfreezeCoach(co);
        if (!PHW && co.video.playbackRate !== 1) co.video.playbackRate = 1;   // 그 외 단계는 정속
        if (co.video.paused && !co._holdUntil) co.video.play().catch(() => {});
        // 영상 실제 프레임이 들어오기 전엔 숨김 — 검은/균일 텍스처가 크로마키 통과 못 해
        // 빨간 방사형 사각형으로 0.x초 깜빡이던 것 방지(유저). readyState≥3(HAVE_FUTURE_DATA)+재생 시작 후.
        // 루프 순간 currentTime이 0으로 되감겨 매 루프 1~2프레임 숨김 → 깜빡임(유저). 첫 표시 후 래치.
        co.mat.uniforms.uReady.value = ((co._frozen ? (co.fz.width > 2 ? 1 : 0)
          : (co.video.readyState >= 2 && co.video.videoWidth > 0 && !co.video.seeking
             && co.video.currentTime > 0.03 && frameHasImage(co))) ? 1 : 0)
          // READY 는 페이즈2(도트 숫자 등장)에 맞춰 부드럽게 빠진다 — uReady 가 곧 알파 계수라
          //   셰이더를 안 건드리고 페이드가 된다. 하드컷이면 사람이 툭 사라진다. 8초 루프 동기.
          * (/READY$/.test(id) ? Math.max(0, Math.min(1, (2.7 - ((session.t ?? 0) % 8)) / 0.7)) : 1)
          // A2 도 같은 규약 — 감상이 끝나는 **그 순간에 0** 이 되도록 0.55s 에 걸쳐 뺀다.
          //   전엔 followLatch 가 뜨는 프레임에 판이 통째로 꺼져 인물이 툭 사라졌다(유저: 타이밍이 이상).
          * (id === 'A2' ? Math.max(0, Math.min(1, ((session._a2WatchSec ?? 5.8) - (session.t ?? 0)) / 0.55)) : 1);
        const coLive = co.video.readyState >= 3 && !co.video.seeking && co.video.currentTime > 0.03
                    && (id !== 'BK_A1' || _coachSeekId === id);   // 시크 전 프레임은 보여주지 않는다
        if (coLive) co._live = true;
        // 실전은 영상도 화면에서 뺀다 — 타이밍 소스로만 돌린다(유저).
        //   시크·되감기 직후엔 텍스처가 비어 크로마키를 통과, 판 전체가 LUT 붉은색이 된다 → 그 사이 숨김.
        {
          // 등장 워시 트리거 — 판이 새로 보이거나 스테이지가 재진입(t 역행)하면 리셋.
          //   씬 프리뷰(?scene=)는 같은 스테이지를 루프해 visible 이 안 꺼진다 — t 역행이 그 감지다.
          // ★ now 미정의 참조가 A1 진입 순간부터 매 프레임 ReferenceError 를 던져 루프 후반부
          //   (지면 프레임 갱신 포함)를 전멸시켰다 — '화면이 READY 에 얼어붙음'의 진범(유저 블랙박스).
          const now = performance.now();
          const vis = !!co._live && id !== 'BK_C2';
          const st = session.t ?? 0;
          if ((vis && !co.plane.visible) || st < (co._lastSt ?? Infinity)) co._showT = now;
          co._lastSt = st;
          // 소스가 아직(또는 영영) 없으면 검은 판이 그대로 보인다(유저: 검은 사각형) — 준비된 뒤에만 켠다.
          co.plane.visible = vis && co.video.readyState >= 2;
          if (co.mat.uniforms.uEnter) co.mat.uniforms.uEnter.value = (now - (co._showT || 0)) / 1000;
        }
        co.plane.material.uniforms.uTime.value = performance.now() / 1000;
        co.plane.material.uniforms.uDetail.value = PERSON_FIELD.detail();   // 공용 규칙 — 아래 정의
        // 채도는 마크 LUT와 같은 소스(FXP.sat)에서 — 인물·발자국 룩 통일(슬라이더 하나가 둘 다 이동).
        //   이제 진짜로 이동한다: 구 uSat 은 선언만 되고 셰이더가 안 읽어 슬라이더가 죽어 있었다.
        // 바닥은 0.64 — 0.86 은 LUT 의 SAND(#FEC389, 채도 0.46)에 닿아 밝은 자리가 물빠진 살구가 된다.
        //   벽(0.86)과 맞춘다고 올려놨었는데, 벽은 세로 램프로 T 를 0.06~0.98 훑어 진한 쪽 면적이
        //   크고 바닥은 안 그렇다 — 같은 상한이 두 면에서 다른 결과를 낸다. fx-core 주석의 원래 값.
        {
          const exp2 = clipExposure(co.video, co);
          const lo2 = co.cfg?.rng ? co.cfg.rng[0] : (co._lo ?? 0.12);
          const hi2 = co.cfg?.rng ? co.cfg.rng[1] : (co._hi ?? 0.85);
          setPersonUniforms(co.plane.material.uniforms, 0.86, 0, exp2, lo2, hi2, 1, co.cfg?.tone ?? 0);   // rng·tone = 클립별 오버라이드
        }
        // 옆구리(BK_A1) 방향 화살표 = 코치 영상 실제 타이밍에 동기.
        //   bk_sidebend.webm 24fps 84프레임을 그린스크린 마스크로 프레임별 상체/하체 x중심을 재서
        //   기우는 쪽을 실측(scripts 없이 ffmpeg+마스크 1회 측정). 아래 표는 원본 3.5s 클립 기준 전이 시각.
        //   재생 자산은 핑퐁(정방향 3.5s + 역방향)이라 3.5s 이후는 되감기 시간으로 환산한다.
        if (id === 'BK_A1' && session.active && co.video.readyState >= 3 && co.video.currentTime > 0.03) {
          const dur = co.video.duration || 6.917;
          const FWD = 3.5;                                    // 원본 구간 길이
          const ct = co.video.currentTime % dur;
          // 리드 0.28s — 큐는 '지금'이 아니라 '가는 쪽'을 가리켜야 한다(유저: 왼쪽으로 넘어가는 중인데 오른쪽 가리킴).
          const LEAD = 0.28;
          let ot = ct <= FWD ? ct : Math.max(0, dur - ct);   // 역재생 구간 → 원본 시간
          ot = ct <= FWD ? Math.min(FWD, ot + LEAD) : Math.max(0, ot - LEAD);   // 되감기 중엔 시간이 거꾸로 흐름
          let lean = -1;
          if (ot >= 0.79 && ot < 1.15) lean = 1;
          else if (ot >= 1.15 && ot < 1.63) lean = -1;
          else if (ot >= 1.63) lean = 1;
          // 부호 반전: 마스크 실측표는 '무게중심이 쏠린 쪽'이라 화면에서 몸이 굽는 쪽과 반대였다.
          // (유저 캡처 증거: 0.30s에서 몸은 화면 오른쪽으로 굽는데 화살표는 왼쪽을 가리킴)
          session.bkA1Lean = -lean;
        }
        if (co.rotCues) {   // 회전 큐 = 영상 타이밍 동기(유저): 전반(목 돌리기)=목 큐만, 후반(어깨 롤)=어깨 큐 2개만
          const now = performance.now() / 1000;
          const vd = co.video.duration || 10, ct = co.video.currentTime % vd;
          const neckPhase = ct < vd * 0.5;       // 영상 = 목 2바퀴 → 어깨 롤 (절반 분기)
          const shoulderOn = ct > vd * 0.5 + 2;  // 어깨 큐는 분기 +2초 뒤부터(유저)
          co.rotCues.forEach((c, i) => {
            const on = co.plane.visible && (i === 0 ? neckPhase : shoulderOn);
            c.mesh.visible = on;
            if (on) {
              // 판 자체 블룸 — 프림 공통 규약(session.tickPrims와 동일 이중 가우시안 lighter)
              const off = (c._bloomCv ||= document.createElement('canvas'));
              if (off.width !== 256) { off.width = off.height = 256; }
              const og = off.getContext('2d');
              og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, 256, 256);
              drawRotate(og, 256, { r: 0.30, width: 1.1, dir: c.dir ?? 1, sweep: 0.62, tempo: 0.42 },
                { halo: FXP.mark.halo }, now, { lut: lutColor, arrow: FXP.arrow, glyph: drawGlyph });
              c.g.setTransform(1, 0, 0, 1, 0, 0); c.g.clearRect(0, 0, 256, 256);
              c.g.drawImage(off, 0, 0);
              const bk = FXP.primBloom != null ? FXP.primBloom : 0.125;   // footlab '블룸 세기' 연동
              c.g.save(); c.g.globalCompositeOperation = 'lighter';
              c.g.filter = 'blur(2px)'; c.g.globalAlpha = Math.min(0.8, bk * 2.4); c.g.drawImage(off, 0, 0);
              c.g.filter = 'blur(7px)'; c.g.globalAlpha = Math.min(0.7, bk * 2.0); c.g.drawImage(off, 0, 0);
              c.g.restore(); c.g.filter = 'none'; c.g.globalAlpha = 1;
              c.tex.needsUpdate = true;
            }
          });
        }
        if (co.a2Cues) {   // A2 방향 큐 — 코치 판이 보이는 동안 계속(시범을 보며 방향을 읽는다)
          const now2 = performance.now() / 1000;
          const PERC = 1.8, cyc = (now2 % PERC) / PERC;
          const u = Math.min(1, cyc / 0.72);
          const prog = cyc < 0.72 ? 1 - Math.pow(1 - u, 3) : 1;
          const fade = cyc < 0.72 ? 1 : 1 - (cyc - 0.72) / 0.28;
          co.a2Cues.forEach(c => {
            c.mesh.visible = co.plane.visible;
            if (!c.mesh.visible) return;
            c.mesh.material.opacity = Math.max(0, fade);
            const off = (c._bloomCv ||= document.createElement('canvas'));
            if (off.width !== 128) { off.width = 128; off.height = 256; }
            const og = off.getContext('2d');
            og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, 128, 256);
            drawStemArrow(og, 128, 256, now2, { lut: lutColor, glyph: drawGlyph, arrow: FXP.arrow || {} },
              { prog, scale: 0.9, dots: true });   // 지면 동작 토큰 = 점렬 자루(유저)
            c.g.setTransform(1, 0, 0, 1, 0, 0); c.g.clearRect(0, 0, 128, 256);
            c.g.drawImage(off, 0, 0);
            const bk2 = FXP.primBloom != null ? FXP.primBloom : 0.125;
            c.g.save(); c.g.globalCompositeOperation = 'lighter';
            c.g.filter = 'blur(2px)'; c.g.globalAlpha = Math.min(0.8, bk2 * 2.4); c.g.drawImage(off, 0, 0);
            c.g.filter = 'blur(7px)'; c.g.globalAlpha = Math.min(0.7, bk2 * 2.0); c.g.drawImage(off, 0, 0);
            c.g.restore(); c.g.filter = 'none'; c.g.globalAlpha = 1;
            c.tex.needsUpdate = true;
          });
        }
        if (floorObj.userData.shown) {   // CSS3D·WebGL 어느 경로든 프레임이 떠 있으면 코치 패널도 같은 기준계
          co.plane.quaternion.copy(floorObj.quaternion);
          co._fwd.set(0, 1, 0).applyQuaternion(floorObj.quaternion);
          // 시범 = 코치 영상 중앙 크게(초점 하나) — 원래 관찰 배치
          co.plane.scale.setScalar(1);
          co.plane.position.set(floorObj.position.x + co._fwd.x * co.fwd, 0.015, floorObj.position.z + co._fwd.z * co.fwd);
          // 스텝백 4페이즈 = 2분할(피그마 레퍼런스): 영상은 상단(원거리), 발자국은 하단(근거리).
          //   시선이 먼 영상 → 발밑 발자국으로 자연스럽게 내려오고, 둘을 동시에 볼 수 있다.
          if (/^BK_B[2345]$/.test(id)) {
            // 관찰(프리뷰)은 이전 버전 그대로 — 위치·크기 손대지 않는다(유저).
            //   따라하기 국면에서만 축소 후 창 상단(beamUV v 0.80)으로 올리고 아래를 발자국에 내준다.
            const following = !!session._followLatch;
            if (following) {
              // ★ 따라하기 국면엔 인물을 **뺀다**(유저 08-05). 46%로 줄인 실루엣은 가르치기엔 작고
              //   무시하기엔 커서 시선만 갈랐다. 투사 물리로도 손해다 — 실루엣은 넓은 그라디언트
              //   면이라 46% 축소 = 발광 면적 21%. 야외 주광에서 제일 먼저 사라지는 형태인데,
              //   그 대비는 판정 마크(선·점 = 고대비)가 써야 한다. 시범→따라하기 문법상으로도
              //   프리뷰가 이미 '보여주기'를 끝냈고, 이 국면의 과제는 '발밑을 보라'다.
              //   기억 보조가 필요하면 피그마 343:6447 의 미니 프리뷰(상단 카드 안 작은 루프)가 그 자리다.
              //   영상은 계속 돈다 — 마크 타이밍 소스라 끄면 판정이 멈춘다. 화면에서만 뺀다.
              co.plane.visible = false;
            } else {
              co.plane.scale.set(1, 1, 1);   // 프리뷰 = 기존 배치 유지
            }
          }
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
  const MASK_GLSL = CUT_FEATHER_GLSL + REF_LOOK_GLSL + `
    uniform sampler2D tex;   // 비디오 (그린스크린 소스)
    uniform vec2 uCropC, uCropS;
    float praw(vec2 uv){
      vec2 vuv = uCropC + (uv - 0.5) * uCropS;
      if (vuv.x < 0.0 || vuv.x > 1.0 || vuv.y < 0.0 || vuv.y > 1.0) return 0.0;
      vec3 c = texture2D(tex, vuv).rgb;
      float k = c.g - max(c.r, c.b);                     // 그린 우세도 — 결정론적 크로마 키
      float lum1 = dot(c, vec3(0.299, 0.587, 0.114));
      k *= mix(1.45, 1.0, smoothstep(0.08, 0.30, lum1));  // 접지 그림자(어두운 초록) 배경 판정 — 1.45(과증폭은 옷에 구멍)
      return 1.0 - smoothstep(0.05, 0.16, k);            // 임계값 = 랩 mask1 정본
    }
    // 마스크 빌더는 깨끗하게 둔다 — 하단 잘림 처리는 최종 인물 셰이더가 담당한다.
    //   여기서 미리 지우면 이 마스크로 굽는 블러 필드까지 같이 죽어, 디포커스가 녹일 대상이 없어진다.
    float pmask(vec2 uv){
      return praw(uv) * refEdge(uv);   // 4변 페이드(레퍼런스 정본)
    }
    // 블러 휘도 — 이목구비·옷주름을 뭉개 명암 덩어리만 남긴다(유저 레퍼런스: 확산 유리 실루엣)
    float plum(vec2 uv){
      vec2 vuv = clamp(uCropC + (uv - 0.5) * uCropS, 0.0, 1.0);
      return dot(texture2D(tex, vuv).rgb, vec3(0.299, 0.587, 0.114));
    }
    // ★ 휘도의 정의를 **코치 판과 통일**한다 — 마스크로 정규화한 국소 평균(fld.g / fld.r 규약).
    //   구 pblur 는 원본 영상을 그냥 블러해서 그린 배경까지 섞였다. 코치는 마스크로 나눠
    //   '몸 안쪽의 평균 노출'을 재는데, 이름만 같고 뜻이 달랐다.
    //   P_ABS 를 0.72 로 올려 '영상의 밝기가 색을 주도'하게 된 뒤로는 이 정의 차이가 곧
    //   바닥·벽 색 차이였다(유저: 색감이 너무 다르다). 값 튜닝으로는 절대 안 맞는 지점.
    //   반환 .r = 마스크 블러 · .g = (마스크 × 휘도) 블러 → 호출부에서 g/r 로 복원.
    vec2 pblurRG(vec2 uv){
      float m0 = praw(uv);
      vec2 s = vec2(m0, plum(uv) * m0) * 0.30;
      for (int k = 0; k < 4; k++) { float a = 1.5708 * float(k) + 0.7;
        vec2 o1 = vec2(cos(a), sin(a)) * 0.014;
        vec2 o2 = vec2(cos(a + 0.785), sin(a + 0.785)) * 0.026;
        float m1 = praw(uv + o1), m2 = praw(uv + o2);
        s += vec2(m1, plum(uv + o1) * m1) * 0.125;
        s += vec2(m2, plum(uv + o2) * m2) * 0.05;
      }
      return s;
    }
    // 좁은 블러 — 5탭으로는 압축 블록이 남아 결이 얼룩덜룩 찢어졌다(유저: 더거덕).
    //   코치 판은 이 자리에 **풀해상 분리형 가우시안 RT**(uFieldN)를 쓴다. 여기선 RT 를 더
    //   만들지 않고 링 2겹 12탭으로 근사한다 — 탭 수와 반경 둘 다 올려야 블록을 넘긴다.
    vec2 pblurRGN(vec2 uv){
      float m0 = praw(uv);
      vec2 s = vec2(m0, plum(uv) * m0) * 0.16;
      for (int r = 1; r <= 2; r++) {
        float rad = 0.013 * float(r), wgt = r == 1 ? 0.09 : 0.05;
        for (int k = 0; k < 6; k++) {
          float a = 1.0472 * float(k) + float(r) * 0.5;
          vec2 o = vec2(cos(a), sin(a)) * rad;
          float m1 = praw(uv + o);
          s += vec2(m1, plum(uv + o) * m1) * wgt;
        }
      }
      return s;
    }
    // 좁은 블러 — 센서·압축 노이즈만 지우고 옷 주름은 남긴다(국소 대비 게인이 올라가면서
    //   원본 직접 샘플링(plum)의 픽셀 노이즈가 색 얼룩으로 증폭됐다 — 유저 신고)
    float pblurN(vec2 uv){
      float s = plum(uv) * 0.36;
      for (int k = 0; k < 4; k++) { float a = 1.5708 * float(k) + 0.7;
        s += plum(uv + vec2(cos(a), sin(a)) * 0.005) * 0.16; }
      return s;
    }
    float pblur(vec2 uv){
      float s = plum(uv) * 0.30;
      for (int k = 0; k < 4; k++) { float a = 1.5708 * float(k) + 0.7;
        s += plum(uv + vec2(cos(a), sin(a)) * 0.014) * 0.125;
        s += plum(uv + vec2(cos(a + 0.785), sin(a + 0.785)) * 0.026) * 0.05; }
      return s;
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
  // ★ 해상도 = 코치 판 필드(320×480)와 동일. 128×192 로 굽던 것을 셰이더가 휘도(dLumB)의
  //   출처로 쓰기 시작하면서, 640px 로 확대될 때 3~5배 업스케일이 그대로 **계단**으로 드러났다
  //   (유저: 다리 윤곽이 더거덕). 소스 영상은 2276×1280 로 멀쩡했다 — 병목은 이 RT 였다.
  // ★ 반정밀도(HalfFloat) — 물감 자국의 정체는 해상도가 아니라 **8비트 양자화**였다.
  //   이 필드는 셰이더에서 detail(=lumS−lumB) × P_TEX 4.2 로 증폭된다. 8비트의 1/255 계단이
  //   그대로 4배로 벌어져, 밝은 구간에서 부드러운 면이 뭉텅이로 갈라져 보인다
  //   (유저: "밝게 변하면서 부드러운 면이 사라지고 물감처럼 거친 면"). σ·해상도는 그대로라
  //   룩은 안 바뀌고 계조만 살아난다.
  const HEAT_RT = PERSON_FIELD.rt;   // 공용 규칙 — 바닥 코치 판과 같은 정밀도
  const HEAT_W = 320, HEAT_H = 480;
  const heatRTs = [0, 1].map(() => new THREE.WebGLRenderTarget(HEAT_W, HEAT_H, HEAT_RT));
  // 좁은 필드 — 코치 판 uFieldN 의 등가물. **분리형 가우시안 1회**로 굽는다.
  //   셰이더 안 링 12탭으로 대신했더니 그 링 배치가 그대로 무늬로 찍혔다(로제트) —
  //   detail(= lumS − lumB) × P_TEX 4.2 로 증폭되면서 몸에 사선 직조 패턴이 됐다(유저:
  //   "복싱이 유독 텍스처가 별로야"). 링 샘플링은 가우시안이 아니다.
  const heatNarrowRT = new THREE.WebGLRenderTarget(HEAT_W, HEAT_H);
  const heatMaskMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: demoTex }, uCropC: { value: new THREE.Vector2(0.5, 0.5) }, uCropS: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    // ★ .g 에 마스크×휘도를 같이 굽는다 — 아래 분리형 가우시안이 두 채널을 함께 흐려 주면
    //   셰이더에서 g/r 로 **진짜 국소 평균**을 복원할 수 있다(코치 판 uField 와 같은 규약).
    //   셰이더 안 9탭 블러로 대신하던 동안 압축 블록이 그대로 통과해 벽 인물만 텍스처가
    //   덕지덕지 찢어져 보였다(유저: 복싱은 더거덕, 바닥은 부드러워).
    fragmentShader: 'varying vec2 vUv;\n' + MASK_GLSL
      + '\nvoid main(){ float m = pmask(vUv); gl_FragColor = vec4(m, plum(vUv) * m, 0.0, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  const heatBlurMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uStep: { value: 3 }, uTexel: { value: new THREE.Vector2(HEAT_W, HEAT_H) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 uDir, uTexel; uniform float uStep;
      void main(){
        vec2 px = uDir * uStep / uTexel;
        vec2 s = texture2D(tex, vUv).rg * 0.227;   // rg 를 함께 흐린다(마스크 · 마스크×휘도)
        s += (texture2D(tex, vUv + px * 1.385).rg + texture2D(tex, vUv - px * 1.385).rg) * 0.3165;
        s += (texture2D(tex, vUv + px * 3.23).rg + texture2D(tex, vUv - px * 3.23).rg) * 0.070;
        gl_FragColor = vec4(s, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const demoPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.93),   // 세로 카드 (영상 세로 프레이밍)
    new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: demoTex }, uTrail: { value: trailRTs[0].texture }, uHeat: { value: heatRTs[0].texture }, uHeatN: { value: heatNarrowRT.texture }, uLUT: { value: getLUT() },
        uTime: { value: 0 }, uNoise: { value: 0 }, uW: { value: 1 }, uDetail: { value: 0.62 }, uTrailGain: { value: 1 }, uGrain: { value: 0 }, uTone: { value: 0 }, uLive: { value: 0 },
        uFace: { value: new THREE.Vector4(0, 0, 0, 0) },   // scripts/bake_face_track.mjs 산출물이 채운다
        uPSat: { value: 1.32 }, uPSweep: { value: 0 }, uPHi: { value: 0.86 }, uPDepth: { value: 0.34 }, uPCoral: { value: 0 }, uPExp: { value: 0.5 }, uPForm: { value: 0 }, uPLo: { value: 0.12 }, uPHiL: { value: 0.85 }, uPLumLin: { value: 0 }, uPCalWave: { value: 1 }, uPCalD: { value: 1 }, uPCalW: { value: 1 }, uPCalB: { value: 0 },
        uPInk: { value: 0.85 }, uPInkT: { value: 0.42 },   // PERSON_GLSL 공용 — setPersonUniforms 가 주입
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
        uniform sampler2D uTrail, uLUT, uHeat, uHeatN; uniform float uTime, uNoise, uW, uDetail, uTrailGain, uGrain, uTone, uLive;
        uniform vec4 uFace;   // 머리 추적 타원(패널 uv) — xy 중심 · zw 반경. z<=0 = 추적 없음
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
        ` + PERSON_GLSL + `
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
          H *= 1.0 + (flow - 0.5) * uNoise * 0.16;   // 대류 얼룩 최소 — 밝아진 톤에서 노이즈가 얼룩으로 드러남(유저)
          float T = clamp(H * 1.25, 0.0, 1.0);   // 온도 = 두께 필드
          // 선명 = 옷주름·결(몸) / 블러 = 얼굴 소거용. 룩 슬라이더 person.detail = 결의 세기.
          // 국소 평균 = **RT 가우시안 필드**에서 복원한다(코치 판 uField 와 같은 규약).
          //   셰이더 안 9탭으로 대신하던 동안 압축 블록이 통과해 텍스처가 찢어졌다(유저).
          vec2 fB = texture2D(uHeat, uv).rg;
          float dLumB = fB.g / max(fB.r, 0.02);
          //   결(detail)도 RT 에서 — 링 탭은 그 배치가 무늬로 찍힌다(로제트). 가우시안만 쓴다.
          vec2 fN = texture2D(uHeatN, uv).rg;
          float dLumS = mix(dLumB, fN.g / max(fN.r, 0.02), clamp(uDetail * 2.4, 0.0, 1.0));
          float dlum = mix(dLumS, dLumB, 0.5);
          // 얼굴 대역(상단) = 이목구비 의도적 은닉 — 실사 결 제거 + 강한 확산
          // ★ 상단 falloff 를 프레임 맨 끝으로 밀었다(0.965→0.99). 벽 판은 GHOST_PAD 1.22
          //   여백이 있어 머리 꼭대기가 uv.y 0.96 근처에 오는데, 예전 값은 그 경계가
          //   **모자를 가로질러** 묘한 가로선을 만들었다(유저 08-03).
          //   바닥 코치 판은 같은 함정을 이미 0.99 로 고쳐 놨었다("정수리 반점", main.js:2603).
          //   ★ 램프를 넓게 편다(0.70~0.84 = 14% → 0.56~0.96 = 40%). 얼굴 대역은 이목구비를
          //   은닉하려고 룩을 꽤 바꾸는데, 좁은 구간에서 0→1 로 올라가면 그 전이가 **가로 단차**로
          //   보인다 — 유저가 모자 중간에 선을 그어 지적한 그 위치가 정확히 램프 상단(0.84)이다.
          //   smoothstep 은 C1 연속이라 수학적으론 매끈하지만, 바뀌는 양이 크면 눈에는 경계로 읽힌다.
          //   ★ 08-03: 고정 밴드는 '머리가 늘 화면 위쪽'이라는 가정이다. 회피 슬립처럼 깊게
          //   웅크리는 클립은 머리가 uv.y 0.63 까지 내려가는데 거기선 이 값이 0.09 라
          //   이목구비가 그대로 드러났다(유저: "아래로 내려가면서 다 드러나 버렸어").
          //   추적 데이터(<클립>.face.json → uFace)가 있으면 머리 타원으로 가린다.
          //   uFace.z <= 0 = 추적 없음 → 예전 밴드 그대로(다른 클립 회귀 방지).
          float faceW;
          if (uFace.z > 0.0) {
            vec2 fd = (uv - uFace.xy) / max(uFace.zw, vec2(1e-4));
            //   ★ 램프를 아주 길게 + 최대치를 낮춘다.
            //   face 는 결만 지우는 게 아니다. personAura 가 band 를 0.17 로 밀어(톤 강제)
            //   얼굴이 '분홍 덩어리'가 되고, 거기다 face*1.5 로 램프를 되-포화시켜
            //   내가 넓힌 램프를 다시 날카롭게 만든다 — 히잡처럼 보이던 정체다(유저 2회).
            //   그래서 (a) 페이드를 반경의 1.55배까지 끌고 (b) 최대 0.50 으로 눌렀다.
            //   0.82 로도 안 됐다 — aura 의 ×1.5 가 그걸 1.0 으로 포화시켜 톤 강제가 그대로 걸린다.
            //   0.50 이면 ×1.5 해도 0.75 라 톤이 몸과 이어지고, 결은 좁은 블러가 맡아 이목구비는 안 보인다.
            //   ※ 값을 올릴 땐 반드시 화면으로 확인할 것. 숫자로는 티가 안 나고 경계로만 드러난다.
            faceW = (1.0 - smoothstep(0.28, 1.55, length(fd))) * 0.50;
          } else {
            faceW = smoothstep(0.56, 0.96, uv.y) * (1.0 - smoothstep(0.99, 1.0, uv.y));
          }
          // 실사 결 = 주 텍스처 — 내부 침식 마스크(mIn)로만: 엣지 반투명 픽셀이 그린 배경
          // 밝기를 온도로 읽어 실루엣 둘레에 밝은 테두리가 생기던 것 차단
          float mIn = smoothstep(0.55, 0.95, m);
          T = max(T, trail * 0.6);
          // 형태: 전신 크리스프 실루엣만 — 헤일로·확산 완전 제거 (유저 확정: 그림자 금지)
          // 마스크 침식: 크로마키가 불완전한 클립(비순수 그린 배경)에서 마스크 바닥값(~0.2)이
          // 쿼드 전체를 반투명 워시 박스로 칠하던 근본 원인 — 저신뢰 마스크는 0으로
          float mEro = smoothstep(0.26, 0.44, m);   // 결정적 마스크 — 어두운 신발+그린스필이 중간 대역에 남아 회색 뭉침(유저 #68). 얇은 구조(골대 림)는 일부 손해
          // ※ 안쪽 침식 페더는 폐기(07-31 도입 → 08-01 철회). 링 최솟값은 마스크가 국소적으로
          //   조금만 내려가도(압축 노이즈·모션블러) 그 자리에 **구멍**을 뚫는다 —
          //   인물이 종이처럼 찢어져 보이던 것(유저 스샷). 부드러움은 이런 식으로 얻을 수 없다.
          // 하단 잘림 — 코치 판과 같은 처리(fx-core cutFade): 아래로 갈수록 초점이 나가 열 필드로 녹는다.
          float botC = 0.0;
          for (int i = 0; i < 8; i++) botC += praw(vec2((float(i) + 0.5) / 8.0, 0.006));
          vec2 cf = cutFade(uv.x, uv.y, botC * 0.125, uTime);
          mEro = mix(mEro, smoothstep(0.06, 0.55, texture2D(uHeat, uv).r), cf.y) * cf.x;
          dLumS = mix(dLumB, dLumS, 1.0 - cf.y);
          float shapeA = mEro * 0.92;   // 알파용 형태 = 실루엣만 (잔상 제외)
          float shape = max(shapeA, trail * 0.5 * smoothstep(0.06, 0.22, trail));
          // 색 = fx-core.personColor 공용 정의 (벽 인물과 같은 곡선·대역·채도).
          // 구 mix(thermo…) 은 은퇴 — uTone=1 이라 실제로 안 쓰였고, 무지개 램프는 팔레트 밖이었다.
          vec3 col; float covA;
          if (uPForm > 0.5) {   // 룩2(기본) — fx-core.personAura
            // 전해상 원본 휘도(디스필) — 데모판 비디오는 tex/uCropC·uCropS 규약
            vec3 srcC = texture2D(tex, uCropC + (uv - 0.5) * uCropS).rgb;
            float lumSharp = dot(vec3(srcC.r, min(srcC.g, max(srcC.r, srcC.b)), srcC.b), vec3(0.299, 0.587, 0.114));
            float lumNRaw = fN.g / max(fN.r, 0.02);
            vec4 aura = personAura(mEro, fB.r, lumSharp, lumNRaw, faceW, uv, uTime);
            col = aura.rgb; covA = aura.a;
            // 하단 컷 페이드 — 흰빛으로 바래며 소멸(코치판과 동일 규약)
            col = mix(col, vec3(1.0) * covA, cf.y * 0.9);
            // 잔상(trail) 복원 — 복싱 버스트의 가산광 궤적. 룩2 앵커색으로 은은하게.
            col = max(col, trail * vec3(0.98, 0.25, 0.06) * 0.55);
            covA = max(covA, trail * 0.3);
          } else {
            col = personLook(T, dLumS, dLumB, mIn, faceW, uv.y) * shape;
            covA = shapeA;
          }
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
          float lumSrgb = max(col.r, max(col.g, col.b));   // ★ 알파 게이트용 — 반드시 변환 **전**에 (아래 설명)
          col = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
          // 잔상 = 순수 가산광 (알파 0 = 절대 어둡게 못 함) — 잔상 구름이 잉크 알파를 갖고
          // 벽을 어둑한 사각으로 덮던 문제('터질 때 박스') 종결. 실루엣만 잉크 불투명.
          // 빛이 없으면 그리지 않는다 — 투사 UI 는 가산광이라 '검정'은 곧 '없음'이다.
          //   shape(색용)와 shapeA(알파용)가 따로 계산돼서, 마스크가 흔들리면 색은 0인데
          //   알파만 1이 되어 판이 통째로 검은 사각형으로 찍혔다(유저 스샷: 드리블 중 검정 박스).
          // 투사광 불변식: 알파는 빛보다 클 수 없다. 프리멀티(One/OneMinusSrcAlpha)에서 알파는
          //   '뒤를 지우는 양'이라, 어두운 픽셀이 큰 알파를 가지면 그만큼 판이 검게 뚫린다.
          //   문턱값 게이트(lum<0.02)로는 lum=0.05 같은 '거의 검정'이 통과해 검은 사각형이 남았다.
          //   빛에 비례해 가림을 묶는다 — 빛이 없으면 가림도 없다.
          // ★ 게이트는 **표시색(sRGB)** 으로 잰다 — lumS 를 위 linear 변환 **전에** 잡아 둔 이유.
          //   그 변환은 OutputPass(linear→sRGB) 상쇄용이지 '빛의 양'을 다시 정의하려던 게 아닌데,
          //   변환 뒤 값으로 재는 바람에 같은 픽셀의 lum 이 절반 이하로 줄었다(0.55 → 0.26).
          //   알파가 그만큼 무너지고, 프리멀티 합성 out = col + dst·(1−a) 로 **뒤 바닥이 배어 올라온다**.
          //   복싱 기본 바닥은 아이보리 마루(rgb 238,226,212)라 그 유출이 곧 '허옇게 뜬다'였다.
          //   같은 사고가 코치판에서 이미 한 번 났다(위 2497: '밝은 타일 코트 위에서 물빠짐').
          // ★ 0.985 도 걷어낸다 — 코어에서 1.5% 를 비치게 할 이유가 없다. 코치판은 이미 1.0 이다.
          float aOut = clamp(covA * 1.2, 0.0, 1.0) * field * live;
          gl_FragColor = vec4(col * live, min(aOut, lumSrgb * mix(1.6, 1.05, uPForm)));
        }`,
      transparent: true, depthWrite: false,
      // out = col + dst·(1−a) — 랩의 base·(1−a·0.88)+col 과 동일 (프리멀티 커스텀 블렌딩)
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  demoPanel.name = 'demoPanel';   // 씬 편집기 '개체 삭제'·익스포터 --hide 에서 인물 판을 집는 키
  demoPanel.rotation.x = -Math.PI / 2;
  demoPanel.position.set(0, 0.016, -1.45);
  demoPanel.renderOrder = 7;   // 인물 = HUD 위 맨 앞 (버튼만 그 위 — 유저)
  demoPanel.visible = false;
  scene.add(demoPanel);
  let demoLastT = 0;
  const _demoProbe = { video: null };   // frameHasImage 용 래퍼 — 검은 프레임 판별
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
    // READY 는 전용 클립 — 예전엔 B1 과 같은 파일을 봤는데, 첫 장면만 교체하려 해도
    //   B1(가드 유지)까지 같이 바뀌었다. 분리해 둔다.
    BX_READY: ['bx_ready_guard.mp4', '대기 — 가드 자세'],
    BX_A1:    ['bx_a1_neck.mp4',    '시범 — 목·어깨 풀기'],
    BX_A2:    ['bx_a2_step.mp4',    '시범 — 스텝 인·아웃'],
    BX_A3:    ['bx_a3_jab.mp4',     '시범 — 잽 폼'],
    BX_B1:    ['bx_b1_guard.mp4',   '시범 — 가드 유지'],
    BX_B2:    ['bx_b2_slip.mp4',    '시범 — 회피 슬립'],
    BX_B3:    ['bx_b3_jab.mp4',     '시범 — 잽 스윕'],
    BX_C2:    ['bx_c2_spar.mp4',    '상대 — 잽 대련'],
    BX_C3:    ['bx_c3_combo.mp4',   '상대 — 잽잽훅 콤비'],
    BX_C4:    ['bx_c4_cooldown.mp4','고수 — 마무리 호흡'],
  };
  // 스테이지별 인물 크기 미세 조정 — 1 = 손대지 않음. 여기 없는 스테이지는 전부 1 이다.
  //   클립을 갈아서 인물이 벽 상단/하단에 닿을 때만 이 표에 한 줄 추가한다.
  const GHOST_TRIM = { BX_A1: 0.95 };   // 머리가 벽 위에 닿아 5% 만 낮춤(유저: 많이 줄이긴 싫다)
  let ghostClipCur = '', ghostClipWant = null;
  let faceTrack = null;   // <클립>.face.json — 프레임별 머리 위치(영상 정규좌표, y 아래로 +)
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
    // 머리 추적 데이터 — 있으면 얼굴 은닉을 고정 밴드 대신 이 좌표로 구동한다.
    //   없는 클립은 그대로 밴드를 쓴다(404 는 정상 경로다).
    faceTrack = null;
    fetch(tgt.replace(/\.mp4$/i, '.face.json'))
      .then(r => (r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null))
      .then(j => { if (j && ghostClipCur === tgt) faceTrack = j; })
      .catch(() => {});
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
      // 스테이지별 미세 트림 — 클립마다 인물이 프레임을 채우는 비율이 다르다. 패널은
      //   9:16 커버핏이라, 소스가 세로로 꽉 찬 클립일수록 같은 gsc 에서도 인물이 커진다.
      //   BX_A1 은 코치 클립을 세로 프레이밍(934×1660)으로 갈면서 머리가 벽 상단에 닿았다(유저).
      //   발은 wallBot 에 고정이라 줄이면 위에서만 내려온다 — 서 있는 자리는 안 변한다.
      const gsc = (mir ? 0.8 : 1) * (GHOST_TRIM[session.curStage?.id] ?? 1);   // 중앙 단독 — 벽을 당당히 채우는 등신 (쿼드 1.57m)
      demoPanel.scale.set(GHOST_H * (9 / 16) / 0.62 * gsc * GHOST_PAD, GHOST_H / 0.93 * gsc * GHOST_PAD, 1);
      demoPanel.position.set((wc ? wc.cx : 0) + (mir ? 0 : 0), wallBot + GHOST_H * gsc / 2 + (mir ? 0.02 : 0.01), WALL_Z + 0.035);
    }
    demoPanel.visible = !!on;
    if (on) setGhostClip(session.curStage?.id);   // 스테이지별 클립 자동 전환 (404 → 기본)
    // 코치 클립의 재생 시각을 세션에 넘긴다 — 프레임 실측으로 박자를 잡는 스테이지(B2 회피)가
    //   session.t 대신 이걸 본다. 씬 고정 모드는 8초마다 session.t 를 0 으로 되돌리는데
    //   같은 클립이면 setGhostClip 이 조기 반환해 영상은 계속 흐른다 → 두 시계가 어긋난다.
    //   '코치가 지금 무슨 자세인가'는 영상 시계만 안다.
    session.clipT = on && demoVideo.duration ? (demoVideo.currentTime || 0) : null;
    // 코치 머리의 가로 위치(영상 정규 0..1)도 같이 넘긴다. 회피 스테이지가 '위협은 머리 반대편'을
    //   시간(비트표)이 아니라 **지금 머리가 어디 있는지**로 정하게 하려는 것 — 시계가 한 틱만
    //   어긋나도 마크가 머리와 같은 쪽에 서던 문제의 근본 해결(유저 3회 지적).
    if (session.clipT != null && faceTrack) {
      const i = Math.max(0, Math.min(faceTrack.rows.length - 1, Math.round(session.clipT * faceTrack.fps)));
      session.clipHeadX = faceTrack.rows[i].x;
    } else session.clipHeadX = null;
    // 클립 소스 미리보기 카드 = 개발용 진단(파일명·반입 여부). 제품 뷰에선 숨긴다(유저).
    const devNow = document.body.classList.contains('dev');
    ghostPrev.style.display = (on && devNow) ? 'block' : 'none';
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
    _demoProbe.video = demoVideo;
    // 프레임 게이트 — 재생 가능한 살아있는 프레임일 때만 인물 기여 (블랙/정지 = 박스 방지)
    // uLive 게이트: ①올바른 클립일 때만 표시 → 전환 중 기본 클립(근육질 남자) 번쩍 방지
    //   ②올바른 클립이면 루프 순간 readyState 하락에 8프레임 유예 → 깜빡임 제거
    const wantUrl = ghostClipWant ? (import.meta.env.BASE_URL + 'ghost/' + ghostClipWant[0]) : GHOST_DEFAULT;
    const onCorrectClip = (ghostClipCur === wantUrl) || ghostClipBad.has(wantUrl);   // 원하는 클립이거나, 미반입이라 기본 폴백된 경우만
    if (!onCorrectClip) {
      demoLiveHold = 0;   // 전환 중/잘못된 클립 = 즉시 숨김(유예 없음)
    } else {
      // readyState 만으론 부족하다 — 디코더가 '준비됨'이라 보고하면서 빈(검은) 프레임을 내주는
      // 구간이 있고, 그게 크로마키를 통과해 판이 통째로 검은 사각형이 된다(유저: 드리블 중 검정 박스).
      // A1 코치와 같은 8×8 휘도 샘플로 '진짜 그림인가'를 4Hz 로 확인한다.
      const demoLiveNow = (demoVideo.readyState >= 2 && !demoVideo.ended && !demoVideo.paused
        && frameHasImage(_demoProbe));
      demoLiveHold = demoLiveNow ? 8 : Math.max(0, demoLiveHold - 1);
    }
    demoPanel.material.uniforms.uLive.value = demoLiveHold > 0 ? 1 : 0;
    // ★ 스로틀 폐기(유저 08-03) — 필드는 **매 프레임** 다시 굽는다.
    //   본체 셰이더는 매 프레임 현재 영상 텍스처로 실루엣 마스크(pmask)를 뽑는데, 톤·두께 필드
    //   (uHeat/uHeatN)만 45Hz 로 갱신하면 60fps 화면에서 한 프레임 걸러 스킵된다. 그 프레임은
    //   마스크는 새 자세, 필드는 이전 자세라 **둘이 어긋난 자리에 이전 실루엣 가장자리가 밝게 남는다**
    //   (유저: "어떤 투명도 프레임이 그 자리에 머물러 빛반사를 계속 이룬다").
    //   익스포터에서 덜 보였던 것도 같은 이유다 — 가상 시계가 33ms 씩 뛰어 매번 통과했다.
    //   비용은 필드 패스 몇 개뿐이고, 마스크와 필드가 항상 같은 영상 프레임에서 나오는 게 옳다.
    demoLastT = now;
    if (demoVideo.readyState < 2) return;
    // 잔상 누적 (핑퐁) — 룩 person.decay 라이브 소비
    // 랩 잔상 시맨틱 등가: 랩은 6.7fps 탭 decay^j — 45Hz 연속 누적으로 환산(decay^(1/5.7)).
    // 0이면 완전 꺼짐 (구 매핑은 바닥 0.62가 있어 랩에서 꺼도 시뮬에 잔상이 남던 버그).
    // ★ 복싱 벽 인물 잔상 = 영구 차단(유저 08-03). 07-30 에 "인물 = 뉴턴톤만, 잔상은 아티팩트"로
    //   결론이 났는데 벽 데모 판만 자기 경로(uTrailGain·핑퐁 RT)를 따로 갖고 있어 예외로 남아 있었다.
    //   기본값(FXP.person.decay=0)으로는 이미 꺼져 있었지만 랩 슬라이더로 되살아날 수 있었다 —
    //   되살아날 경로를 없앤다. 다시 켜려면 이 줄만 되돌리면 된다.
    const pd = 0;
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
    fxQuad.material = heatBlurMat;
    // ① 좁은 필드 — 압축 블록을 지우고 옷 주름은 남긴다(결의 출처).
    //   ★ 1.0 → 1.8. 생성 클립이 예전 소스보다 훨씬 선명해서 스텝 1.0 으로는 이목구비가
    //   그대로 통과했다(유저: 중간에 얼굴 보이는 장면이 있다). 얼굴 은닉을 face 톤 강제에
    //   기대면 분홍 덩어리가 되므로, 결 자체를 여기서 지우는 게 맞다. 주름은 이 폭에서 살아남는다.
    heatBlurMat.uniforms.uStep.value = 1.8;
    heatBlurMat.uniforms.tex.value = heatRTs[0].texture; heatBlurMat.uniforms.uDir.value.set(1, 0);
    renderer.setRenderTarget(heatRTs[1]); renderer.render(trailScene, trailQuadCam);
    heatBlurMat.uniforms.tex.value = heatRTs[1].texture; heatBlurMat.uniforms.uDir.value.set(0, 1);
    renderer.setRenderTarget(heatNarrowRT); renderer.render(trailScene, trailQuadCam);
    // ② 넓은 필드 — 국소 평균(노출). 원래대로 3회 반복.
    // ★ 넓은 필드의 폭을 person.blur 에서 떼어낸다 — 얼룩덜룩의 진짜 원인.
    //   이 식은 blur≈1 을 전제로 쓰였는데(→3.8), 07-30 "인물 = 뉴턴톤만, 나머지 0" 결정으로
    //   blur 가 0 이 되면서 폭이 1.4 로 주저앉았다. 좁은 필드가 1.0 이니 두 σ 가 거의 같아지고,
    //   detail = 좁음 − 넓음 이 DoG(밴드패스)가 되어 옷 주름이 아니라 중간주파 압축 노이즈를
    //   골라 증폭했다(코치 판에서 이미 겪고 1/4 그리드로 고친 것과 같은 함정).
    //   '국소 평균'은 정의상 넓어야 한다 — 룩 슬라이더가 붙잡을 값이 아니다.
    heatBlurMat.uniforms.uStep.value = PERSON_FIELD.WIDE_STEP;
    for (let i = 0; i < 3; i++) {
      heatBlurMat.uniforms.tex.value = heatRTs[0].texture; heatBlurMat.uniforms.uDir.value.set(1, 0);
      renderer.setRenderTarget(heatRTs[1]); renderer.render(trailScene, trailQuadCam);
      heatBlurMat.uniforms.tex.value = heatRTs[1].texture; heatBlurMat.uniforms.uDir.value.set(0, 1);
      renderer.setRenderTarget(heatRTs[0]); renderer.render(trailScene, trailQuadCam);
    }
    fxQuad.material = trailMat;
    renderer.setRenderTarget(prevT);
    const PU = demoPanel.material.uniforms;
    PU.uHeatN.value = heatNarrowRT.texture;
    PU.uTrail.value = trailRTs[trailFlip].texture;
    PU.uTime.value = now;
    PU.uNoise.value = 0;   // 대류 얼룩 영구 차단(유저 08-03) — 시간축으로 흘러가는 노이즈가 0.x초 주기 얼룩으로 보였다. 07-30 "인물 = 뉴턴톤만, 나머지 0" 규칙과 통일.
    // ★ 벽 인물만 결 비중을 낮춘다(바닥 코치 판은 2795 줄에서 원래 값 그대로).
    //   셰이더가 clamp(uDetail * 2.4) 라 0.417 이상이면 **좁은 필드 100%** 다. 그 좁은 필드는
    //   320×480 을 1200px 로 3.75배 확대해 쓰는 비율(fN.g/fN.r)이라, 배·브라처럼 평평한 면에서
    //   저해상 구조가 덩어리로 드러났다(유저: 얼룩덜룩 + 과질감). 0.42 → 0.19 = 결 46%.
    PU.uDetail.value = PERSON_FIELD.detail();
    // 얼굴 은닉 타원 — 구운 머리 좌표(영상 정규)를 패널 uv 로 옮긴다.
    //   패널 uv = 0.5 + (영상uv − 0.5) / uCropS  (셰이더의 vuv 식을 뒤집은 것)
    //   영상 y 는 아래로 +, 텍스처 v 는 위로 + 라 1−y 로 뒤집는다.
    if (faceTrack && demoVideo.duration) {
      const i = Math.max(0, Math.min(faceTrack.rows.length - 1,
        Math.round((demoVideo.currentTime || 0) * faceTrack.fps)));
      const r = faceTrack.rows[i], cs = PU.uCropS.value;
      PU.uFace.value.set(
        0.5 + (r.x - 0.5) / cs.x,
        0.5 + ((1 - r.y) - 0.5) / cs.y,
        (r.r * 1.7) / cs.x,     // 머리 반폭보다 넉넉히 — 경계가 얼굴을 가로지르면 단차로 보인다
        (r.h * 1.5) / cs.y,
      );
    } else PU.uFace.value.set(0, 0, 0, 0);
    PU.uW.value = FXP.person?.blur ?? 1;   // 엣지 블러 — 랩 person 슬라이더 (누락돼 기본 1.0으로 돌던 버그)
    PU.uGrain.value = FXP.person?.grain ?? 0;
    PU.uTone.value = FXP.person?.tone ?? 0;
    // 대역 상단은 **면마다** 다르다. 데모 판은 DEMO_CLIP_MODE='wall' 이면 실제로 벽에 서므로
    //   벽 값(0.91 + 코랄 억제 0.9)을 써야 한다. 여태 바닥 값 0.64 가 박혀 있어서 램프가
    //   t 0.33~0.58 = **레드~코랄 구간에만** 갇혀 있었다 — 중황·프리즘이 면적 0%.
    //   그래서 어떤 자세를 취해도 붉은 판 하나로 보였다(유저: 평면적이고 1차원적).
    //   ※ 지금 복싱 벽에 보이는 인물이 이 데모 판이다(bxPerson 아틀라스는 wall 모드에선 숨는다).
    const wallMode = DEMO_CLIP_MODE === 'wall';
    //   상단 0.86 = SAND(#FEC389, 따뜻한 살구빛)가 하이라이트의 끝. 0.98 은 PRISM(#D1FEFF,
    //   거의 흰빛)까지 닿아서 밝은 피부·팔·다리가 통째로 **하얗게** 빠졌다(유저 스샷).
    //   ★ 두 면에 **같은 값**을 준다 — 면마다 다른 대역을 주면 톤이 갈릴 수밖에 없다.
    setPersonUniforms(PU, 0.86, 0, clipExposure(demoVideo, demoPanel), demoPanel._lo ?? 0.12, demoPanel._hi ?? 0.85, 0);   // 데모판 텍스처는 미지정 = sRGB 그대로
    trailFlip = 1 - trailFlip;
  }

  // ── 복싱 벽 배경 그리드 (reactbits GridScan 포팅) ─────────────────────────────
  //    구 벽 HUD(hudPanel·ctaPanel·mirrorPanel)는 제거됨 — wallgl.js 가 벽 UI 전담이고
  //    그 경로가 매 프레임 셋을 숨기고 있었다(실측: 복싱 14스테이지 전수 visible=false).
  //    같이 사라진 것: Overused Grotesk 34곳 · HUD_INK #fff6ea · 한/영 토글(btn-lang).
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
  // 빛이 없으면 알파도 0 (프리멀티에서 검정 판 방지)
  aInk = min(aInk, max(col.r, max(col.g, col.b)) * 1.6);   // 투사광 불변식 — 알파는 빛보다 클 수 없다
  gl_FragColor = vec4(col, aInk);
}`,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  gridScanPanel.renderOrder = 5;
  gridScanPanel.visible = false;
  scene.add(gridScanPanel);
  const HUD_MIRROR = new Set(['BX_A1', 'BX_A2', 'BX_A3', 'BX_B1', 'BX_B3']);   // renderDemoPanel 이 반반 미러 배치에 씀

  function renderWallGrid() {
    const st = session.active && state.pack === 'boxing' ? session.curStage : null;
    const on = !!st && st.id?.startsWith('BX_');
    gridScanPanel.visible = on;
    // 구 벽 텍스트 슬롯 중복 억제 (복싱 = 디자인 UI가 록업·자막 담당)
    if (state.pack === 'boxing')
      for (const s of [session.wSlotFS, session.wSlotFL, session.wSlotFM]) if (s) s.visible = s.visible && !on;
    if (!on) return;
    const wc = rig._wallCenter;
    // 대지 3.2×2.0m 기준 → 벽 실측 크기로. z 는 구 hudPanel(+0.028) 뒤 0.006.
    gridScanPanel.scale.set(rig.wallW / 3.2, rig.wallH / 2.0, 1);
    gridScanPanel.position.set(wc ? wc.cx : 0, wc?.cy ?? 1.4, WALL_Z + 0.022);
    if (rig.wallClip && gridScanPanel.material.clippingPlanes !== rig.wallClip)
      gridScanPanel.material.clippingPlanes = rig.wallClip;
    const GU = gridScanPanel.material.uniforms;
    GU.uTime.value = performance.now() / 1000;
    GU.uBoost.value = FXP.day ? 1.15 : 0.85;
    GU.uLines.value.setHex(0xfec389);   // 연주황 칩 (레드 기각 — 유저)
    GU.uScan.value.setHex(0xfe6e3c);    // 주황 칩
    GU.uAccent.value.setHex(COLORS.user ?? 0x21ccdb);
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
        uPSat: { value: 1.32 }, uPSweep: { value: 0 }, uPHi: { value: 0.86 }, uPDepth: { value: 0.34 }, uPCoral: { value: 0 }, uPExp: { value: 0.5 }, uPForm: { value: 0 }, uPLo: { value: 0.12 }, uPHiL: { value: 0.85 }, uPLumLin: { value: 0 }, uPCalWave: { value: 1 }, uPCalD: { value: 1 }, uPCalW: { value: 1 }, uPCalB: { value: 0 },
        uPInk: { value: 0 }, uPInkT: { value: 0.42 },   // PERSON_GLSL 공용 — 벽은 personColor 만 쓰지만 선언은 필수(안 하면 무채). 잉크는 바닥 전용이라 0.
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
        ` + PERSON_GLSL + CUT_FEATHER_GLSL + REF_LOOK_GLSL + `
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
        float mraw(vec2 uv, float f){
          vec3 rgb = texture2D(uAtlas, tileUV(uv, f)).rgb;
          float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
          return uDirect > 0.5 ? smoothstep(0.30, 0.55, lum) : smoothstep(0.52, 0.34, lum);
        }
        float mask1(vec2 uv, float f){   // 하단 잘림 처리는 main 이 담당(빌더는 깨끗하게)
          return mraw(uv, f) * refEdge(uv);   // 4변 페이드(레퍼런스 정본)
        }
        float maskF(vec2 uv, float fk){
          float f0 = floor(fk);
          return mix(mask1(uv, f0), mask1(uv, f0 + 1.0), fract(fk));
        }
        void main(){
          #include <clipping_planes_fragment>
          vec2 uv = vUv;
          float m = maskF(uv, uFrame);
          // 하단 잘림 — 코치·데모 판과 같은 언어(fx-core cutFade). 여긴 가우시안 필드가 없으므로
          //   반경이 아래로 갈수록 커지는 다탭 블러로 초점을 뺀다.
          float botC = 0.0;
          for (int i = 0; i < 8; i++) botC += mraw(vec2((float(i) + 0.5) / 8.0, 0.006), uFrame);
          vec2 cf = cutFade(uv.x, uv.y, botC * 0.125, uTime);
          if (cf.y > 0.01) {
            float sBlur = 0.0;
            for (int k = 0; k < 6; k++) { float a = 1.0472 * float(k);
              sBlur += maskF(uv + vec2(cos(a), sin(a)) * 0.06 * cf.y, uFrame); }
            m = mix(m, sBlur / 6.0, cf.y);
          }
          m *= cf.x;
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
          // 색 = fx-core.personColor 공용 정의 (바닥 인물과 같은 곡선·대역·채도).
          // 구 lut(heat) 직결은 대역이 달라 바닥은 주황, 벽은 빨강으로 갈렸다.
          vec3 col = personColor(heat) * mSoft * 1.12;
          col += personColor(heat * 0.45) * trail * 0.38;
          // 알파 = 실루엣 마스크 추종 — 알파 1.0 고정이 흰 벽에서 쿼드 사각 박스로 드러났음 (유저)
          // 같은 원리 — 빛이 없는 픽셀은 알파도 0 (검은 판 방지)
          float lum2 = max(col.r, max(col.g, col.b));
          gl_FragColor = vec4(col, min(clamp(max(mSoft * 1.15, trail * 0.5), 0.0, 1.0), lum2 * 1.6));   // 투사광 불변식
        }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    }));
  // 인물 축소 배수 — 상단 UI(단계·제목·게이지) 세로 여백 확보용 조절 손잡이.
  // 발은 바닥(0.12m)에 붙인 채 키만 줄인다 → 머리 위로만 여백이 생긴다.
  // 1.0 이면 실신장 1.7m. 0.92 = 1.564m, 머리 top 1.82 → 1.684m (대지 기준 ≈136px 확보).
  const BXP_K = 0.92;
  // 발 높이(m). 0.12 → 0.05 로 낮춰 인물을 조금 더 내린다 — 상단 여백을 더 벌기 위해(유저).
  // 축소(0.92)와 합쳐 머리 top 1.82 → 1.61m.
  const BXP_FOOT = 0.05;
  bxPerson.scale.set(BXP_K, BXP_K, 1);
  bxPerson.material.clipping = true;
  bxPerson.position.set(0.42, 1.7 * BXP_K / 2 + BXP_FOOT, WALL_Z + 0.02);   // 투사 영역 안 (클리핑이 최종 보증)
  // ★ 복싱 벽은 한 겹이다 — 벽 UI(20)·인물·판정 토큰이 전부 같은 renderOrder 를 쓰고
  //   순서는 '깊이'가 정한다(three 는 같은 renderOrder 의 투명체를 뒤→앞으로 정렬).
  //   전엔 인물 5 · 토큰 9 · UI 20 이라 벽면(z −1.8)의 UI 가 3cm 앞의 인물 위에 덮여 그려졌다
  //   — 유저가 본 '레이어가 다 따로 논다'의 정체. z 를 −0.01 물려 UI < 인물 < 토큰(WZ +0.03) 순서를 못박는다.
  bxPerson.renderOrder = 20;
  bxPerson.visible = false;
  scene.add(bxPerson);
  function renderBxPerson() {
    const on = bxPersonReady && state.pack === 'boxing' && session.active && !session.isLive
      && DEMO_CLIP_MODE !== 'wall';   // 실사 벽 시험 중엔 아틀라스 복서 숨김
    bxPerson.visible = !!on;
    if (!on) return;
    if (rig.wallClip && bxPerson.material.clippingPlanes !== rig.wallClip) bxPerson.material.clippingPlanes = rig.wallClip;
    const wc = rig._wallCenter;
    bxPerson.position.set(wc ? wc.cx : 0, 1.7 * BXP_K / 2 + BXP_FOOT, WALL_Z + 0.02);   // 유저 정면 = 벽 중심 추종
    const U = bxPerson.material.uniforms;
    const ms = performance.now();
    U.uFrame.value = (ms / 1000 * COACH.fps) % COACH.n;
    U.uTime.value = ms / 1000;
    U.uDecay.value = FXP.person?.decay ?? 0.6;
    U.uNoise.value = FXP.person?.flow ?? 0.55;
    U.uW.value = FXP.person?.blur ?? 1;
    // 벽 = 대역 상단 0.91 · 중간 억제 0.9.
    //   ⚠ 이름 주의: palette.js 의 키 이름이 통념과 **반대**다. `coral`(#FE6E3C, 휘도 147)이
    //     진한 주황이고, `sand`(#FEC389, 휘도 206)가 연한 코랄이다. 유저 규약의 '코랄'은 **연한 쪽**,
    //     즉 코드의 sand 다. 이걸 뒤집어 읽으면 목표와 정반대 값을 넣게 된다(실제로 한 번 그랬다).
    //   유저 규약: RED · 주황 · 코랄이 고루 보이되 **연한 코랄은 일부만**.
    //   실측 배분(personlab 우측 = 벽 매핑, 인물 픽셀 17.3k · 유저 이름 기준):
    //     0.86 / 0    → RED 46.9  주황 53.1  코랄  0.0   ← 종전. 연한 코랄이 아예 없다
    //     0.91 / 0.9  → RED 41.1  주황 39.8  코랄 19.1   ← 채택. 셋 고루 + 코랄은 일부
    //     0.95 / 1.3  → RED 36.5  주황 30.5  코랄 33.1   ← 코랄 과다. 규약 위반
    //   ★ 상단이 0.86 이면 감마·게인을 거친 t 가 0.807 에서 멈춰 sand 스톱(t 0.86)에 **못 닿는다** —
    //     그래서 연한 코랄이 면적 0.0% 였다. 0.91 이 그 스톱에 막 닿는 값이다.
    setPersonUniforms(U, 0.91, 0.9);   // 채도·세로대역 = 세 인물 셰이더 공용
  }

  switchPack(state.pack);   // 기본 진입 팩(복싱) — 순서 복싱 → 러닝 → 농구(유저)
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
      T1: 'neckStretch', T2: 'armStretch',   // FIN=quadStretch 제거 → idle(Breathing Idle=자연 서기, 3876행 폴백). 유저: 리포트에선 자연스럽게 서있게.
      // 복싱 = Mixamo 실측 모캡 (목풀기만 절차)
      BX_A1: 'bx_neck', BX_A2: 'boxGuard', BX_A3: 'boxJab',
      BX_B1: 'boxGuard', BX_B2: 'boxGuard', BX_B3: 'boxCombo',
      BX_READY: 'boxGuard', BX_T1: 'boxGuard', BX_T2: 'boxGuard', BX_C1: 'boxGuard',
      // 농구 — CMU 06 실측: A3 로우 프리스타일 드리블, B1·B2 크로스오버+슛(시그니처 무브 시범/분해),
      // B3 컷·감속(드리블 컷 구간 창). 시작 화면(READY)은 러닝과 동일 calm idle(공 없음)
      // 농구 A단계 v5: A1 옆구리 스트레치(hj_sidebend) + A2·A3 = cmu13_30 구간(무릎들기 5.5–9.8s·스쿼트 9.8–14.2s)
      BK_READY: 'idle', BK_A1: 'hj_sidebend', BK_A2: 'auto_cmu13_30', BK_A3: 'auto_cmu13_30',
      BK_T1: 'idle', BK_T2: 'idle',   // 전환 화면 둘 다 자연 서기 — T2 조깅이 뒤돌며 움직였음(유저: 그럴 필요 없다)
      BK_C1: 'vm_crossover',             // 실전 트리거 = 드리블 루프2(유저: 이게 더 낫다)
      BK_C2: 'vm_crossover',             // 실전 핸들 프레이즈 = B2와 같은 실사 클립(풀템포 느낌은 판정 템포가 담당)
      BK_C3: 'cmu_dribble_side',         // 사이드스텝 = CMU 06_08 사이드 드리블(루트 이동)
      // B1 시범 = 06_15 드리블→슛(온전한 무브 원테이크), B2 분해 = 06_14 크로스오버+슛 위상잠금
      // B단계 = 공을 튄다 → 튀기며 움직인다 → 튀기다 멈추고 뒤로(BK-B-CURRICULUM.md)
      BK_B1: 'bp_dribble',            // 드리블 루프 2(Sketchfab 네이티브 1.6s) — 유저: 이걸로 교체
      BK_B2: 'bkStance',              // 깨끗한 애슬레틱 스탠스 + sbWidth 실측 구동(모캡 지터 회피)
      BK_B3: 'bkStance', BK_B4: 'bkStance', BK_B5: 'bkStance',   // 스텝백 4단계 — 폭·크라우치는 sbWidth
      BK_C2: 'bkStance',              // 실전 — 릴리즈는 판정으로
    };
    // 실전 대기(C1)부터 실전 종료·리포트까지 봇은 가만히 서 있는다(유저). 동작 연출 없음.
    if (/^(BK_)?C\d$/.test(id) || /^BX_C\d$/.test(id) || /FIN$/.test(id)) return 'idle';
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
        const anchor = /^(A2|A3|BK_A[23])$/.test(session.stage || '') && pb.hips
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
        // 순간 하향각 + 알고리즘 보정 가정. far 2.6 = 시선 앞 선행 마크(3.2는 너무 길다 유저 → 2.6로).
        rig.fpNear = 0.25; rig.fpFar = 2.6;
      } else {
        // fpNear 만 되돌리고 fpFar 를 안 건드리던 자리 — 러닝 라이브(2.6)를 한 번 지나오면
        //   그 값이 종목을 바꿔도 그대로 남았다. 실측: 농구 READY 의 fpFar 가 코드값 1.6 이
        //   아니라 2.4. 1인칭에서 농구 UI 만 멀리 밀려 보이던 원인이다(유저 신고).
        //   3인칭에선 위에서 내려다봐 0.4m 가 원근으로 눌려 안 보였다.
        //   종목 기본값으로 함께 복원한다 — 농구는 발 앞 근접 존(1.6), 나머지는 리그 기본(2.0).
        // near 0.30 — 비라이브 구간(READY·스트레칭·전환)은 밟을 게 없으니 발밑을 커버할
        //   이유가 없다(유저). 0.05 는 발밑을 거의 수직으로 비추는 값이라, 그걸 보려면 고개를
        //   깊이 숙여야 한다 — 실제로 세션 시선각이 -36° 까지 내려간다(권장 목 굴곡 20° 안팎).
        //   무릎 유닛이 바로 아래를 못 비추는 실제 제약과도 맞고(위 '정직한 투사각'과 같은 근거),
        //   시작을 앞으로 밀면 near 쪽 극단 사다리꼴 왜곡 구간도 안 쓴다.
        //   착지 마크가 있는 러닝 라이브(P/C)만 위 분기에서 0.25 로 따로 당긴다.
        rig.fpNear = 0.30;
        rig.fpFar = 2.0;   // 종목 공통(유저 승인 08-05) — 농구 1.6 분기 폐기, 농구는 앞쪽 구간만 쓴다
      }
    }
    // BK_C4 릴리즈 = 실측 점프샷 원샷 (xbot 농구 라이브 경로에서 크로스페이드)
    xbot.bkShot = session.active && session.stage === 'BK_C4';
    // 팩 판정 토큰 필드 정책(검증된 경로): 세션 비실전 전면 숨김 + 라이브 중 릴리즈(C4)도 숨김.
    // 비실전 복귀(라이브 진입) 시에만 다시 켬 — 스트레칭·학습·전환 화면의 무관 마커 원천 차단.
    // BX_C2(잽 대련)도 제외 — 판정은 벽의 수축 링이 전담한다. 팩 마크가 같이 떠 있으면
    //   바닥 고정 마크 하나가 '실질적으로 때리는 곳'으로 읽힌다(유저 스샷).
    // BX_C3(잽·잽·훅)도 같은 이유로 제외 — 마크는 1·2·3 한 컴포넌트(펀치라인 + 수축 링)가 전담한다.
    //   벽 토큰이 같이 뜨면 화면 아래에 숫자 원이 하나 더 서고, 지면 토큰이 뜨면 진입 순간
    //   화면 한복판(대지 원점)에 흰 마크와 파문이 떠 있다(유저 스샷 4회). 두 면 다 끈다.
    const PACK_OFF = session.stage === 'BX_C2' || session.stage === 'BX_C3';
    if (session.active) tokens.floorRoot.visible = session.isLive && session.stage !== 'BK_C4' && !PACK_OFF;
    if (session.active) tokens.wallRoot.visible = !PACK_OFF;
    // 스톰프 프레스 스테이지: 봇을 뒤로 당겨 착지(전방 0.38m)가 프레스 원 위에 정확히 떨어지게
    if (session.active && !session.isLive && data.sport !== 'boxing') {
      // A2 런지: 봇을 뒤로 당겨 전방 착지가 프레스 원(-1.30) 위에 오게 (교대 런지 보폭 ≈0.7m 가정, 시각 검수로 보정)
      // 농구 워밍업(BK_A*)은 READY와 같은 자리(0) — 스테이지 진입마다 봇이 앞으로 1.15m 순간이동하던 것
      // (유저: '농구 시작위치는 여긴데 스트레칭하면 앞으로 이동해'). 한 운동 장면 = 제자리 수행.
      xbot.demoStandZ = session.stage === 'A2' ? -1.0 : (/^BK_B[12345]$/.test(session.stage) ? -1.85 : 0);
    }
    // 지면 풀스크린 화면(세션 컴플리트·전환·카운트다운) = 3인칭 봇도 바닥의 화면을 응시(머리 숙임).
    // B1 2막(시선 바깥) = 봇도 고개를 정면으로 들어 시범(유저) — bkB1EyesUp이 최우선.
    xbot.headPitch = session.bkB1EyesUp ? THREE.MathUtils.degToRad(-14)
      : (session.active && session.stage === 'BK_B1') ? THREE.MathUtils.degToRad(-10)   // 기본기 시범 = 스테이지 내내 시선 멀리(유저·wikiHow)
      : (session.active && /^(T1|T2|C1|FIN|BK_T1|BK_T2|BK_C1|BK_FIN)$/.test(session.stage || ''))
      ? THREE.MathUtils.degToRad(24) : 0;
    // B1 2막 메트로놈 — 박자를 소리가 이끈다(공 소리 추종이 아니라 리드). WebAudio 클릭.
    if (session.bkB1EyesUp) {
      if (!window.__metCtx) window.__metCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = window.__metCtx, PER = 0.8;   // 커리 150BPM의 반템포 — 배우기 우선
      if (window.__metNext == null || window.__metNext < ctx.currentTime - 1) window.__metNext = ctx.currentTime + 0.1;
      while (window.__metNext < ctx.currentTime + 0.25) {
        const o = ctx.createOscillator(), g2 = ctx.createGain();
        o.frequency.value = 880; g2.gain.setValueAtTime(0.12, window.__metNext);
        g2.gain.exponentialRampToValueAtTime(0.001, window.__metNext + 0.07);
        o.connect(g2); g2.connect(ctx.destination);
        o.start(window.__metNext); o.stop(window.__metNext + 0.08);
        window.__metNext += PER;
      }
    } else window.__metNext = null;
    if (!session.active && sessionDroveGaze) {
      // 세션 종료 → 수동 시선각 복귀 (세션이 남긴 단계값이 디폴트처럼 굳는 것 방지)
      sessionDroveGaze = false;
      gazePitch = THREE.MathUtils.degToRad(manualGazeDeg);
      const sl = document.getElementById('s-pitch'), lb = document.getElementById('v-pitch');
      if (sl) sl.value = manualGazeDeg;
      if (lb) lb.textContent = `${manualGazeDeg}°`;
    }
    // 세션 비실전 단계: 팩 시간 정지, 봇은 단계별 동작을 제자리 시연(코치)
    // 실전(BK_C2)도 이 블록을 탄다 — 프리뷰 1회 → 따라하기 래치가 여기서 결정된다(유저 개편).
    if (session.active && (!session.isLive || session.stage === 'BK_C2')) {
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
      xbot.stanceWiden = /^BK_B[13]$/.test(session.stage || '') ? 1 : 0;   // B2는 절차 드릴이 스탠스 소유
      xbot.crossGuard = 0;   // 절차 드릴이 가드 팔까지 저작 — 덧대기 보정 은퇴
      xbot.legLock = /^BK_(C1|C2)$/.test(session.stage || '');   // 크로스오버 = 하체 완전 고정(굽힌 자세 스냅샷, 유저) — 실측 표류 0.06m 기법
      xbot.uDribble = /^BK_(C1|C2)$/.test(session.stage || '');   // 공 = 박자 결정론 U자(좌우 손바닥 왕복, 유저 확정)
      const _sbOn = /^BK_(B2|B3|B4|B5|C2)$/.test(session.stage || '');
      xbot.sbWidth = _sbOn ? (session.sbWidth ?? 0) : 0;
      xbot.sbShift = (session.stage === 'BK_C2') ? (session.sbShift ?? 0) : 0;   // 실전만 루트 이동 — 학습 4페이즈는 정지 자세(창이 따라 움직이면 발자국이 밖으로 밀린다)
      xbot.sbJump = _sbOn ? (session.sbJump ?? 0) : 0;
      xbot.relaxLeftArm = (session.stage || '') === 'BK_B1';   // 로우 드리블 — 오른손만 드리블, 왼팔 자연 축 내림
      xbot.phaseDribble = (session.stage || '') === 'BK_B1';   // 공 = 오른손 높이 직결(최고=손, 최저=바닥)
      // 세션 데모(비실전) 공통: CMU 클립이 몸을 돌려도 봇은 정면 유지(유저 원칙)
      xbot.lockYaw = session.active && /^BK_([AB]|C)/.test(session.stage || '');   // 실전에서도 정면 유지(유저)
      let _clip = demoClipFor(session.sport, session.stage);
      // A2/A3 = 2단계 흐름(유저): [0~5s 관찰] 봇은 가만히 서서(idle) 전문가 영상 보기 → [5s~ 따라하기].
      // 뉴턴 전환 문법(유저 확정): 시범(영상만·도트바) → 마크 Preview 워밍 등장+음성 → 따라하기.
      //   3·2·1은 실전 트리거(C1) 전용 — 학습 내 전환엔 안 씀(복싱 문법과 통일).
      // ★ A2 는 STEP_SEG 에 항목이 없어 stepPreviewSec() 이 0 을 준다 → **폴백 3.0s 가 실사용 값**이
      //   되어 있었다(유저: 미리보기를 너무 짧게 지나가 화살표를 볼 수도 없다). 런지 한 사이클은
      //   DESC 1.1 + HOLD 3.0 + RISE 1.6 = 5.7s 라 3초로는 동작이 절반도 안 보인다.
      //   한 사이클(5.7s)을 온전히 보여주는 값 = 5.8s. 더 늘리면 씬 프리뷰(8s 루프)에서 따라하기
      //   구간이 1초밖에 안 남아 화살표를 볼 수 없다 — 감상과 실습의 균형점.
      const A2_WATCH = session.stage === 'A2' ? 5.8 : (stepPreviewSec(session.stage) || 3.0);
      session._a2WatchSec = A2_WATCH;   // 인물 페이드아웃이 같은 시계를 보도록 노출(하드컷 방지)
      const BK_A1_RATE = 1.55;   // 옆구리 봇 배속(코치 영상 페이스 맞춤) — 시각 캘리브레이션 노브
      const _watchWin = /^(A2|A3|BK_A[23]|BK_B[12345]|BK_C2)$/.test(session.stage || '') && !session._followLatch;   // 실전도 정속 프리뷰 1회 먼저(유저)
      if (/^BK_C[135]$/.test(session.stage || '')) session._followLatch = true;   // C2만 프리뷰 있음
      const _stepPv = STEP_SEG[session.stage || ''] && _stepId === session.stage;   // 스텝백 = 재생 횟수로 판정
      const aWatching = _watchWin && (_stepPv ? _stepLoops < stepLoops(session.stage) : session.t < A2_WATCH);
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
        const T0 = 5.4, TD = 6.5, T1 = 8.1, HOLD = 3.0;   // 5→3초(유저): 카운트 3·2·1 → 팡
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
      // A1 옆구리 = hj_sidebend(26s 루틴) 루프. 자연 속도는 코치 영상(핑퐁 6.9s 주기)보다 느려
      // '따라하는' 느낌이 안 났음(유저) → 배속 캘리브레이션 노브. 더 빠르게/느리게는 이 상수만.
      else if (session.stage === 'BK_A1') _phase = session.t * BK_A1_RATE;
      else if (/^BK_A[23]$/.test(session.stage)) {   // A2·A3 = cmu13_30 구간 루프
        // 전환구간 잘라 순수 동작만 (유저: 앞 2초 이전 동작 겹침) — A2 하이니 7.5~9.8, A3 스쿼트 12.0~14.2
        const SEG = { BK_A2: [7.5, 9.8], BK_A3: [12.0, 14.2] }[session.stage];
        _phase = SEG[0] + (session.t % (SEG[1] - SEG[0]));
      }
      else if (session.stage === 'BK_B1') {
        if (session.bkB1EyesUp && (session.bkB1P2t ?? 9) < 2.6) {
          // 10회 완료 직후: 허리 펴고 정면 보며 잠깐 정지(음성 듣는 동안) — 공 자동 숨김(idle)
          _clip = 'idle';
          xbot.stanceWiden = 0;
        } else if (session.bkB1Setup) {
          // 셋업 시연(유저): 공 빼고(idle은 공 게이트 미통과 → 자동 숨김) 자연 서기에서
          //   다리를 '실제로' 벌린다 — 절차적 램프(0.8s 대기 → 2.2s에 걸쳐 어깨너비+)
          _clip = 'idle';
          xbot.stanceWiden = session.bkB1Widen ?? 0;   // 세션이 계산한 모음(-0.25)→벌림(1.15) 램프
        } else {   // bp_dribble 네이티브 루프 — 구간 창·핑퐁 불필요
          xbot.stanceWiden = 1;
        }
      }
      // 06_13 프리스타일 전체 루프는 이동·컷 구간이 섞여 어색(유저) — 안정 핸들 구간만 창 반복.
      else if (/^BK_(B2|B3|B4|B5|C2)$/.test(session.stage || '')) {
        const rate = session.clipRate ?? 1;   // B3=0.5배속(유저 학습 progression)
        _phase = (session.t * rate) % (xbot.actions.bkStance?.dur || 2.5);
      }   // 신규 소스(공 튀기며 손으로 옮기기) 최적 루프 4.4~7.9s — 경계 0.02m·손 전환 3회 실측
      else if (session.stage === 'BK_B3') {   // 프리스타일은 어느 구간도 안 맞물림(최적 0.183m) → 핑퐁 = 불연속 0
        const SP3 = 6.3, m3 = session.t % (SP3 * 2);
        _phase = 7.6 + (m3 < SP3 ? m3 : SP3 * 2 - m3);
      }
      // playDemo는 무조건 — stepbackDemo 분기 삭제 때 else가 체인에 붙어 위상 스테이지 전부에서
      // 재생이 건너뛰어졌던 사고(클립이 idle로 남음).
      xbot.playDemo(_clip, h, session.stage === 'BX_READY', _phase);
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
    // 잽·잽·훅 구간엔 바닥 스텝 마크가 필요 없다(유저: "잽잽훅에 이게 필요해?").
    //   콤보는 전부 상체·벽에서 일어나는데, 팩 타임라인이 시간축으로 스텝/오더 마크를 계속 깔아
    //   발밑에 큰 원반이 떠 화면을 잡아먹었다. 이 스테이지에서만 바닥 토큰 층을 내린다.
    //   (스텝이 실제로 의미 있는 A2·B2·C2 는 그대로 둔다)
    const _noFloorTok = session.active && session.curStage?.id === 'BX_C3';
    if (_noFloorTok !== _tokHidden) { tokens.root.visible = !_noFloorTok; _tokHidden = _noFloorTok; }
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

  // ── 하프톤 스킨 토글 (⣿) — FX Lab 후보랩에서 확정한 '그라디언트 + 하프톤 마스크' ─────
  //   정본 markState 는 그대로 두고 표면만 점으로 뚫는다. 색·7상태·모션·계약은 손대지 않는다.
  //   마크 재질 전부에 같은 유니폼을 밀어 넣는다(팩 마커 + 세션 웨이브).
  {
    let htOn = false;
    // FX Lab(다른 탭)에서 슬라이더를 움직이면 여기에 즉시 반영된다 — localStorage + storage 이벤트.
    //   랩과 시뮬을 오가며 눈으로 맞추는 게 이 작업의 전부라, 실시간이 아니면 쓸모가 없다.
    const HT_KEY = 'newton-ht';
    let htP = { pitch: 0.055, gain: 1.15, soft: 0.55, wave: 0.6, glow: 0, inner: 0 };
    try { Object.assign(htP, JSON.parse(localStorage.getItem(HT_KEY) || '{}')); } catch (e) { /* 저장본 없음 */ }
    const btn = document.getElementById('btn-ht');
    const apply = () => {
      const push = m => { const u = m?.uniforms; if (!u?.uHT) return;
        u.uHT.value = htOn ? 1 : 0;
        u.uHTPitch.value = htP.pitch; u.uHTGain.value = htP.gain;
        u.uHTSoft.value = htP.soft;   u.uHTWave.value = htP.wave;
        u.uHTGlow.value = htP.glow;   u.uHTInner.value = htP.inner; };
      tokens.scene?.traverse?.(o => push(o.material));
      scene.traverse(o => push(o.material));
      if (btn) { btn.style.borderColor = htOn ? 'var(--accent)' : 'var(--line)';
        btn.style.color = htOn ? 'var(--accent)' : 'var(--text)'; }
    };
    btn?.addEventListener('click', () => { htOn = !htOn; apply(); });
    window.addEventListener('storage', ev => {
      if (ev.key !== HT_KEY || !ev.newValue) return;
      try { Object.assign(htP, JSON.parse(ev.newValue)); apply(); } catch (e) { /* 무시 */ }
    });
    // 재질은 스테이지마다 새로 만들어지므로 주기적으로 다시 밀어준다(토글·값 유지)
    setInterval(() => { if (htOn) apply(); }, 700);
  }

  // ★ DEV 가드를 뗐다. 랩(personlab-live 등)이 이 핸들로 시뮬을 조종하는데, 배포본엔
  //   __dbg 가 아예 없어서 랩이 60초를 헛돌다 '시뮬 로드 실패'로 죽었다 — 유저가 본
  //   "웹에서 안 뜬다 / 왜 이렇게 느리냐"의 정체. 내부 도구 리포라 노출 비용은 없다.
  // 랩 → 시뮬 실시간 마크 룩 미리보기(유저) + 구(하늘) 램프 토글(scenes.html 버튼)
  window.__applyMarkLook = applyMarkLook;
  try { new BroadcastChannel('newton-marklook').onmessage = e => applyMarkLook(e.data || {}); } catch { /* 미지원 브라우저 */ }
  window.__dbg = {
    extractPose, retargetToClip,   // 비디오 모캡 (dev)
    rig, xbot, state, session, sceneScope, camera, controls, tokens, effects, scene, editor3d, sceneUI, FXP, designStore, TCFG, editCam, editControls, judge, THREE,
    renderer, composer, demoVideo, renderDemoPanel, renderBxPerson,
    get floorObj() { return floorObj; },
    get floorGL() { return floorGL; },
    get wallGL() { return wallGL; },
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


  // ── 제품 뷰 체험 패널 — 개발자 패널 없이 팩 전환·세션 조작을 한 곳에서 ──
  //    실제 동작은 전부 기존 컨트롤에 위임한다(로직 이중화 금지). 표시 상태만 여기서 동기화.
  {
    const $$ = id => document.getElementById(id);
    const pp = $$('play-panel');
    if (pp) {
      const relay = (id) => document.getElementById(id)?.click();
      pp.querySelectorAll('.pp-pack').forEach(b => b.addEventListener('click', () => {
        document.querySelector(`[data-pack=${b.dataset.pp}]`)?.click();
      }));
      $$('pp-start').addEventListener('click', () => (session.active ? relay('btn-tap') : startSessionFor(state.pack)));
      $$('pp-prev').addEventListener('click', () => session.prev());
      $$('pp-tap').addEventListener('click', () => relay('btn-tap'));
      $$('pp-next').addEventListener('click', () => session.next(true));   // 체험 조작은 음성 대기 없이 즉시
      $$('pp-mute').addEventListener('click', () => relay('btn-tts'));   // 음소거 = 기존 TTS 토글에 위임
      $$('pp-view').addEventListener('click', () => relay('btn-view'));
      $$('pp-stop').addEventListener('click', () => relay('btn-session-stop'));
      // 토글 3종 — 시야콘 · 낮/밤 · 빔 지면 커버리지. 상태는 기존 전역 플래그를 그대로 읽는다.
      // 패널 접기/펼치기 — 상태 유지(브랜드 줄만 남는다)
      const fold = (on) => { pp.classList.toggle('folded', on); localStorage.setItem('newton.panelFold', on ? '1' : '0');
        requestAnimationFrame(() => dispatchEvent(new Event('resize'))); };   // 씬 폭 실측 갱신
      // 접기 쉐브론 제거(유저) — 패널은 항상 펼쳐 둔다
      if (localStorage.getItem('newton.panelFold') === '1') fold(true);
      $$('pp-cone').addEventListener('click', () => relay('btn-cone'));
      $$('pp-day').addEventListener('click', () => relay('btn-day'));
      $$('pp-beam').addEventListener('click', () => relay('btn-real'));
      // 전체화면 = F키만(버튼 없음, 유저). 웹페이지가 크롬 주소창을 직접 감출 방법은
      // 전체화면 API뿐이라 이걸 쓰되, 패널에 토글을 두지 않고 단축키로만 자연스럽게.
      window.addEventListener('keydown', e => {
        if (e.key !== 'f' && e.key !== 'F') return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      });
      // 뷰포트가 바뀌면 캔버스·CSS3D 정합을 즉시 다시 맞춘다(안 하면 프레임이 어긋난 채 남는다)
      document.addEventListener('fullscreenchange', () => resize());
      // 제품 뷰 = 어떤 팩을 골라도 '그 팩의 1인칭 체험 첫 화면'에서 시작한다(유저).
      //   개발자 뷰는 기존대로 자유 3D 프리뷰 유지.
      const productStart = () => {
        if (document.body.classList.contains('dev')) return;
        // ★ 팩 토큰이 로드되기 전에 세션을 시작하면 렙 판정이 '즉시 완료'로 떨어지고,
        //   음성 타임아웃(2.5s) 탈출구를 타고 스테이지가 ~2초 간격으로 폭주한다
        //   (유저: 탭이 안 먹는 것처럼 보임 — 실은 이미 지나가 버림. nextN 계측으로 확정).
        //   아래 250ms 인터벌이 재시도하므로 로드 완료 시 자동으로 시작된다.
        if (!session.active && tokens.events?.length) startSessionFor(state.pack);
      };
      pp.querySelectorAll('.pp-pack').forEach(b => b.addEventListener('click', () => setTimeout(productStart, 400)));
      setTimeout(productStart, 900);   // 최초 진입
      setInterval(() => {
        const live = !!session?.active;
        $$('pp-idle').style.display = live ? 'none' : '';
        $$('pp-live').style.display = live ? '' : 'none';
        pp.querySelectorAll('.pp-pack').forEach(b => b.classList.toggle('on', b.dataset.pp === state.pack));
        if (!document.body.classList.contains('dev') && session.active && session.sport !== state.pack) startSessionFor(state.pack);
        const st = session?.curStage;
        // 타이틀 규약 `<코드> · <구간> — <한 줄>`을 셋으로 쪼개 위계를 만든다(유저):
        //   코드=배지 / 구간=배지 옆 작은 글씨 / 한 줄=큰 타이틀
        const lbl = live ? (st?.label || '—') : '';
        const [head, ...rest] = lbl.split(' — ');
        const [code, ...seg] = head.split(' · ');
        $$('pp-code').textContent = live ? code.trim() : '';
        $$('pp-seg').textContent = live ? seg.join(' · ').trim() : '';
        $$('pp-stage').textContent = live ? (rest.join(' — ').trim() || code.trim()) : '세션을 시작하면 코치가 안내합니다';
        $$('pp-meta').textContent = live ? [st?.cue, st?.foot].filter(Boolean).join(' · ') : '';
        $$('pp-idx').textContent = live ? `${(session.stageIdx || 0) + 1} / ${session.stages.length}` : '체험';
        const vLb = $$('pp-view').querySelector('span');
        if (vLb) vLb.textContent = /1인칭/.test(document.getElementById('btn-view')?.textContent || '') ? '1인칭' : '3인칭';
        $$('pp-mute').style.opacity = /🔇|off/i.test(document.getElementById('btn-tts')?.textContent || '') ? '.45' : '1';
        $$('pp-cone').classList.toggle('on', !!coneOn);
        $$('pp-day').classList.toggle('on', !!FXP.day);
        $$('pp-day').textContent = FXP.day ? '낮' : '밤';   // 라벨이 현재 모드를 말한다(유저)
        $$('pp-beam').classList.toggle('on', rig.visualize !== false);   // 커버리지 표시 중이면 on
        if (!document.body.classList.contains('dev') && !session.active) productStart();
      }, 250);
    }
  }
  // ── 좌측 체험 랩 — 보정 스위치는 실제 계산 경로를 끈다(장식 아님) ──
  {
    const $ = id => document.getElementById(id);
    const lab = $('lab-panel');
    if (lab) {
      const sw = (id, key) => {
        const el = $(id);
        el.addEventListener('click', () => { rig.stab[key] = !rig.stab[key]; el.classList.toggle('on', rig.stab[key]); });
      };
      sw('sw-raw', 'raw'); sw('sw-lp', 'omegaLP'); sw('sw-ff', 'servoFF'); sw('sw-gb', 'gimbal');
      $('lab-run').addEventListener('click', () => {
        ttsOn = false;                       // 중간(READY) 대사 억제 — 점프 중엔 말하지 않는다
        startSessionFor('running');
        const s = session, i = s.stages.findIndex(x => x.id === 'C2');
        ttsOn = true;
        if (i >= 0) { s.stageIdx = i; s.t = 0; s._enter(); }
        fpUserSet = true; setFp(false);   // 3인칭 고정 프레이밍
      });
      $('lab-burst')?.addEventListener('click', () => {   // 스테이지 재진입 = 실제 과도 구간
        const st = session.curStage; if (!st) return;
        session.t = 0; session._enter(); rig.resetOmega?.();
      });
      setInterval(() => {
        if (lab.classList.contains('folded')) return;
        $('lab-err').textContent = (rig.errorCm ?? 0).toFixed(1);
        $('lab-omega').textContent = (rig.omegaDps ?? 0).toFixed(0);
        $('lab-phase').textContent = rig.budget?.phase === 'swing' ? '스윙' : '스탠스';
      }, 200);
    }
  }
  // 빌드 스탬프 — 캐시된 구버전 확인용 + 실시간 진단(스테이지·탭·차단 사유).
  //   유저 화면 스크린샷 한 장으로 '버튼이 죽었는지 / next 가 막혔는지'를 판독하기 위한 계기판.
  {
    document.querySelectorAll('.nt-diag').forEach(el => el.remove());   // HMR 잔재 계기판 제거
    const bs = document.createElement('div');
    bs.className = 'nt-diag';
    bs.style.cssText = 'position:absolute;bottom:4px;left:306px;z-index:29;font-size:11px;color:rgba(160,166,176,.9);pointer-events:none;font-family:monospace;background:rgba(0,0,0,.35);padding:2px 6px;border-radius:4px';
    // 진단 바 — 기본 숨김(유저 08-05: 이제 지워달라). ?diag=1 로만 표시 — 계측기 자체는 남긴다.
    //   ★ cssText **뒤에** 꺼야 한다 — cssText 대입이 인라인 스타일을 통째로 갈아치워
    //     앞서 준 display:none 이 지워지고 있었다(유저: 아직도 보인다).
    if (!new URLSearchParams(location.search).get('diag')) bs.style.display = 'none';
    document.body.appendChild(bs);
    let tapN = 0, nextN = 0;
    const _ot = session.tapAdvance.bind(session);
    session.tapAdvance = () => { tapN++; return _ot(); };
    const _on = session.next.bind(session);
    session.next = (f) => { nextN++; return _on(f); };
    const TAG = typeof __BUILD_TAG__ !== 'undefined' ? __BUILD_TAG__ : 'dev';
    // ── 블랙박스: 유저의 실제 조작·상태 전이를 기록 — 계기판 클릭 = 클립보드 복사 ──
    const EV = window.__evlog = [('load ' + new Date().toTimeString().slice(0, 8))];
    const ev = m => { EV.push(new Date().toTimeString().slice(3, 8) + ' ' + m); if (EV.length > 60) EV.shift(); };
    // 예외도 블랙박스에 — 매 프레임 죽는 코드가 있으면 여기 찍힌다(중복은 1회만)
    const seenErr = new Set();
    window.addEventListener('error', e => {
      const m = String(e.error && e.error.stack || e.message).slice(0, 160);
      if (!seenErr.has(m)) { seenErr.add(m); ev('ERR ' + m); }
    });
    window.addEventListener('unhandledrejection', e => {
      const m = 'REJ ' + String(e.reason && e.reason.stack || e.reason).slice(0, 160);
      if (!seenErr.has(m)) { seenErr.add(m); ev(m); }
    });
    document.addEventListener('pointerdown', e => {
      const t = e.target.closest('button, [data-pack], canvas');
      if (!t) return;
      ev('클릭 ' + (t.id || t.dataset?.pack || t.dataset?.pp || t.tagName).slice(0, 24) + ' "' + (t.textContent || '').trim().slice(0, 14) + '"');
    }, true);
    const _oe = session._enter.bind(session);
    session._enter = () => { const r = _oe(); ev('스테이지→' + session.curStage?.id); return r; };
    const _os = session.start.bind(session);
    session.start = (sp) => { ev('세션시작 ' + sp); return _os(sp); };
    const _ostop = session.stop.bind(session);
    session.stop = () => { ev('세션중지'); return _ostop(); };
    bs.style.pointerEvents = 'auto'; bs.style.cursor = 'pointer';
    bs.title = '클릭 = 진단 로그 복사';
    bs.addEventListener('click', () => {
      const dump = bs.textContent + '\n' + EV.join('\n');
      navigator.clipboard?.writeText(dump).then(() => { bs.style.background = '#2a6'; setTimeout(() => bs.style.background = 'rgba(0,0,0,.35)', 600); });
    });
    setInterval(() => {
      const st = session.active ? (session.curStage?.id || '?') : 'IDLE';
      // 지면·벽 프레임이 '실제로 그리는' 스테이지 — 세션과 다르면 그게 곧 버그다(빨간 경고)
      let fv = '—', wv = '—';
      try {
        if (typeof floorGLOn !== 'undefined' && floorGLOn && floorGL?.stage) fv = floorGL.stage;
        else if (typeof loadedFloorView !== 'undefined' && loadedFloorView)
          fv = loadedFloorView.match(/stage=([A-Za-z0-9_]+)/)?.[1] || 'READY';
      } catch (e) { fv = 'ERR'; }
      try { if (typeof wallGLOn !== 'undefined' && wallGLOn && wallGL?.stage) wv = wallGL.stage; } catch (e) { wv = 'ERR'; }
      const mm = session.active && ((fv !== '—' && fv !== st) || (wv !== '—' && wv !== st));
      // 게이트 입력 원시값 — 어느 조건이 거짓이라 갱신이 막히는지 화면이 직접 말하게 한다
      let gate = '';
      try {
        const want = (session.active && (session.sport === 'running' || session.sport === 'basketball'))
          ? FLOOR_FRAMES[session.curStage?.id] : null;
        gate = ` · want ${want ? (want.src.match(/stage=([A-Za-z0-9_]+)/)?.[1] || 'READY') : 'null'}`
             + ` fp${rig?._fp ? 1 : 0} gl${typeof floorGLOn !== 'undefined' && floorGLOn ? 1 : 0}`;
      } catch (e) { gate = ' · gateERR'; }
      bs.textContent = `v10 · build ${TAG} · 세션 ${st} · 지면 ${fv} · 벽 ${wv} · tap ${tapN} · next ${nextN}${gate}`
        + (session.pinStage ? ' · PIN' : '') + (mm ? '  ⚠ 화면≠세션' : '');
      bs.style.color = mm ? '#ff6666' : 'rgba(170,176,186,.95)';
      bs.style.fontSize = '13px';
    }, 300);
  }

  // ── 검은 판 탐지기 (?blackprobe=1) ─────────────────────────────────────────
  //   '드리블 중 검정 사각형'을 코드로 추측하다 세 번 틀렸다. 추측을 그만두고 화면에 묻는다.
  //   합성이 끝난 프레임을 직접 읽어 가장 큰 순수-검정 덩어리를 찾고, 그 중심으로 레이를 쏴서
  //   거기 있는 메시를 이름·재질·블렌딩까지 콘솔에 찍는다. 헤드리스로는 못 하는 일 —
  //   preserveDrawingBuffer:false 라 앱 자신의 rAF 안에서 읽어야만 실제 픽셀이 나온다.
  //   결과는 콘솔이 아니라 '화면 위'에 띄운다 — 스크린샷 한 장이면 범인이 보인다.
  const BLACK_PROBE = new URLSearchParams(location.search).get('blackprobe') === '1';
  let _bpN = 0, _bpBuf = null, _bpLast = '', _bpEl = null;
  const _bpRay = new THREE.Raycaster();
  function blackProbe() {
    if (!BLACK_PROBE || (_bpN++ % 20)) return;
    const gl = renderer.getContext(), c = renderer.domElement;
    const W = c.width, H = c.height;
    if (!_bpBuf || _bpBuf.length !== W * H * 4) _bpBuf = new Uint8Array(W * H * 4);
    try { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, _bpBuf); } catch (e) { return; }
    // 8px 격자에서 가장 긴 순수-검정 가로줄 (그 줄의 세로 두께도 함께 잰다)
    const S = 8; let best = 0, bx = 0, by = 0;
    const dark = (x, y) => { const i = ((H - 1 - y) * W + x) * 4;
      return _bpBuf[i] < 10 && _bpBuf[i + 1] < 10 && _bpBuf[i + 2] < 10; };
    for (let y = 0; y < H; y += S) { let run = 0, st = 0;
      for (let x = 0; x < W; x += S) {
        if (dark(x, y)) { if (!run) st = x; run += S; if (run > best) { best = run; bx = st + run / 2; by = y; } }
        else run = 0;
      } }
    if (best < 140) { _bpLast = ''; return; }   // 얇은 줄·자막 그림자는 무시
    let th = 0; for (let y = by; y < H && dark(bx, y); y += S) th += S;
    const key = `${Math.round(bx / 40)},${Math.round(by / 40)},${Math.round(best / 40)}`;
    if (key === _bpLast) return;   // 같은 덩어리는 한 번만
    _bpLast = key;
    // 화면 좌표 → NDC → 레이캐스트 (보이는 것 전부, 앞에서부터)
    // ── 이분 탐색: 레이캐스트 대신 '가려보고 사라지는가'로 범인을 특정한다 ─────────
    //   레이캐스트는 두 번 헛짚었다(선 반경 함정 → 그 다음엔 검정을 만들 수 없는 가산 재질만 나왔다).
    //   화면에 실제로 검정을 칠하는 주체는 '그것을 끄면 검정이 사라지는 것'이다. 그것만이 증거다.
    //   검출된 순간에만 도는 진단이라 몇 프레임 끊기는 건 감수한다.
    const _pi = ((H - 1 - by) * W + bx) * 4;   // 원본 프레임의 검정점 (탐색 중 덮어쓰기 전에 잡아둔다)
    const x0 = Math.max(0, bx - best / 2), y0 = by;
    const rw = Math.min(W - x0, best), rh = Math.min(H - y0, Math.max(8, th));
    const _rb = new Uint8Array(rw * rh * 4);
    const stillBlack = () => {
      renderFrame(clock.elapsedTime);
      try { gl.readPixels(x0, H - y0 - rh, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, _rb); } catch (e) { return true; }
      let d = 0; for (let i = 0; i < _rb.length; i += 4)
        if (_rb[i] < 10 && _rb[i + 1] < 10 && _rb[i + 2] < 10) d++;
      return d / (rw * rh) > 0.5;
    };
    const label = o => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const U = m?.uniforms || {};
      const u = k => (U[k] ? (typeof U[k].value === 'number' ? +U[k].value.toFixed(3) : '·') : '-');
      return { name: o.name || m?._src || '(무명)', type: o.type, order: o.renderOrder,
        mat: m ? m.type : '-', blending: m ? m.blending : '-', opacity: m ? m.opacity : '-',
        u: `uDay ${u('uDay')} uPhase ${u('uPhase')} uProg ${u('uProg')} uFade ${u('uFade')} uGain ${u('uGain')} uShape ${u('uShape')}` };
    };
    // 한 층에서 '끄면 검정이 사라지는' 자식을 찾고, 찾으면 그 안으로 들어간다
    const findCulprit = (node, depth) => {
      const kids = node.children.filter(o => o.visible);
      for (const k of kids) {
        k.visible = false;
        const gone = !stillBlack();
        k.visible = true;
        if (gone) return depth < 6 && k.children.length ? (findCulprit(k, depth + 1) || k) : k;
      }
      return null;
    };
    let culprit = null;
    try { culprit = findCulprit(scene, 0); } catch (e) { console.warn('[BLACKPROBE] 이분 탐색 실패', e); }
    renderFrame(clock.elapsedTime);   // 화면 원복
    const hits = [];
    if (culprit) {
      hits.push(label(culprit));
      for (let p = culprit.parent, i = 0; p && p !== scene && i < 3; p = p.parent, i++)
        hits.push({ ...label(p), name: '↑부모: ' + (p.name || '(무명)') });
    }
    const head = `검정 판 ${best}×${th}px · ${session.stage} t=${(session.t || 0).toFixed(1)}`;
    console.log('[BLACKPROBE]', head); console.table(hits);
    (window.__blackHits ||= []).push({ stage: session.stage, t: +(session.t || 0).toFixed(1), w: best, h: th, hits });
    // 화면 배지 — 유저가 콘솔을 열 필요 없이 스크린샷만 주면 되게
    if (!_bpEl) {
      _bpEl = document.createElement('div');
      _bpEl.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;max-width:620px;'
        + 'background:rgba(250,48,48,.94);color:#fff;padding:10px 13px;border-radius:10px;pointer-events:none;'
        + 'font:600 12.5px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;box-shadow:0 6px 28px rgba(0,0,0,.5)';
      document.body.appendChild(_bpEl);
    }
    _bpEl.textContent = '⬛ ' + head + '\n'
      + (hits.length
        ? hits.map((h, i) => `${i + 1}. ${h.name} · ${h.mat} · order ${h.order} · blend ${h.blending} · op ${h.opacity}\n     ${h.u}`).join('\n')
          + `\n검정점 픽셀 = rgba(${_bpBuf[_pi]},${_bpBuf[_pi + 1]},${_bpBuf[_pi + 2]},${_bpBuf[_pi + 3]})`
        : '범인 없음 — 씬의 어떤 개체를 꺼도 검정이 안 사라진다.\n  → 후처리(컴포저 grade/bloom) 또는 배경 자체다.');
  }

  // ── 씬 스테이지 모드 (?scene=BX_A1[&view=wall|floor]) ─────────────────────────
  //   영상용 정면 라이브 뷰: 시뮬 그 자체가 실시간으로 돌고, 카메라만 정면 고정 + UI 숨김.
  //   파라미터가 없으면 코드 경로 자체가 죽어 있어 기존 동작·성능에 영향이 없다.
  const SCENE_STAGE = (() => {
    const q = new URLSearchParams(location.search);
    const scene = q.get('scene');
    if (!scene) return null;
    // 검은 커튼 — 부팅 UI·로딩 스피너가 씬 전환마다 번쩍이던 것(유저). 준비되면 걷는다.
    const cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483647;transition:opacity .7s ease';
    (document.body || document.documentElement).appendChild(cover);
    const view = q.get('view') || (/^BX_/.test(scene) ? 'wall' : 'floor');
    // 배경 이식 — ?bg=<url> 이면 3D 실내를 끄고 그 자리에 실사 배경을 깐다.
    //   투사 그래픽만 남기고 캔버스를 투명하게 두면, 화면 자체가 곧 합성 결과가 된다.
    //   (?alpha=1 이 함께 있어야 한다 — 렌더러 알파는 생성 시점에 정해진다)
    //   ?bgdim=0~0.9 로 배경만 어둡게. 투사 그래픽 밝기는 그대로다.
    window.__sceneLoop = Math.max(2, +q.get('sceneloop') || 8);   // 씬 루프 주기(초)
    const bg = q.get('bg') || '';
    const bgdim = Math.max(-0.6, Math.min(0.9, +q.get('bgdim') || 0));
    const S = { scene, view, ui: false, sport: false, cover, okT: 0, bg, bgdim };
    // ★ 배경·어둡기는 **리로드 없이** 바꾼다. 값을 바꿀 때마다 iframe 을 새로 띄우면
    //   앱이 매번 부팅되어 '팩 데이터 로드중'이 뜬다(유저 지적). 밖에서 이 함수를 부르면 즉시 반영.
    // ★ WebGL 캔버스를 정확히 집는다. document.querySelector('canvas') 는 타임라인 UI 캔버스를
    //   먼저 잡아서 배경을 #timeline-wrap 에 칠하고 있었다(실측: 배경이 아예 안 보임).
    //   renderer 는 이 시점에 아직 없을 수 있으므로, 없으면 화면에서 가장 큰 캔버스를 고른다.
    const glCanvas = () => window.__dbg?.renderer?.domElement
      || [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    // 영상 배경은 CSS background 로 못 깐다 — 캔버스와 **같은 부모** 안에 <video> 를 깔고
    //   z-index -1 로 뒤에 둔다. 같은 스태킹 컨텍스트라 캔버스의 mix-blend-mode(가산)가 그대로 먹는다.
    //   id 는 고정 — 씬 스테이지·내보내기의 DOM 청소가 이 하나만 살려 둔다.
    const isVid = u => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || '');
    window.__setSceneBg = (url, dim) => {
      const had = S.bg;                    // 리로드 판단용 — '있던 걸 껐는가'를 봐야 한다
      S.bg = url || '';
      S.bgdim = Math.max(-0.6, Math.min(0.9, +dim || 0));
      // bgdim: 양수 = 어둡게 · 음수 = 밝게. 0 = 원본.
      const d = S.bgdim;
      // ★ 배경은 **캔버스 바로 부모**에 깐다. mix-blend-mode 는 같은 스태킹 컨텍스트
      //   안에서만 섞이는데, body 에 깔면 캔버스는 그 사이 컨테이너와 섞여 '가산이 안 먹는다'
      //   (유저 신고). 부모에 깔면 캔버스가 그 배경을 직접 backdrop 으로 본다.
      const cv = glCanvas();
      const host = cv?.parentElement;
      if (host) {
        // <video> 의 inset:0 이 먹으려면 부모가 위치 지정돼 있어야 한다. static 일 때만 올린다
        // (absolute 인 컨테이너를 relative 로 바꾸면 레이아웃이 통째로 움직인다).
        if (getComputedStyle(host).position === 'static') host.style.setProperty('position', 'relative', 'important');
        let v = document.getElementById('__bgvid');
        if (isVid(S.bg)) {
          if (!v) {
            v = document.createElement('video');
            v.id = '__bgvid'; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
            v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none';
            host.insertBefore(v, host.firstChild);
          }
          if (v.dataset.src !== S.bg) { v.dataset.src = S.bg; v.src = S.bg; v.play?.().catch(() => {}); }
          // 어둡기는 filter 로 — 영상에만 걸리고 캔버스(형제)는 안 건드린다
          v.style.filter = d ? `brightness(${(1 - d).toFixed(3)})` : '';
          // ★ 부모 배경은 **비워야** 한다. host 는 스태킹 컨텍스트가 아니라(z-index auto)
          //   z-index:-1 인 영상은 루트 컨텍스트로 올라가 부모·body 배경보다 **아래**에 그려진다.
          //   여기에 #000 을 칠하면 배경이 통째로 검게 가려진다(실측: 프레임 전체가 검정).
          //   검은 바닥은 <html> 이 깔아 준다(아래 documentElement).
          host.style.setProperty('background', 'transparent', 'important');
        } else {
          v?.remove();
          const veil = d > 0 ? `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})),`
                  : d < 0 ? `linear-gradient(rgba(255,255,255,${-d}),rgba(255,255,255,${-d})),` : '';
          host.style.setProperty('background', S.bg ? `${veil}#000 url("${S.bg}") center/cover no-repeat` : '', 'important');
        }
        host.style.setProperty('isolation', 'auto', 'important');   // 격리되면 블렌드가 갇힌다
      }
      document.documentElement.style.background = S.bg ? '#000' : '';
      document.body.style.setProperty('background', S.bg ? 'transparent' : '', 'important');
      // 3D 실내 복귀는 껐던 무대를 되살려야 해서 리로드가 필요하다 — 단 **껐을 때만**이다.
      //   무조건 리로드하면, 배경 없는 씬에서 scenes.html 이 값을 밀어넣을 때마다(pushAll →
      //   __setSceneBg('')) 앱이 스스로 새로고침한다. 그게 씬 전환을 통째로 삼켰다:
      //   f.src 를 새 씬으로 바꿔 놓으면 그 이동이 시작되기 전에 옛 문서가 자기를 리로드해
      //   src 속성만 새 씬이고 화면은 계속 BX_READY 였다(유저: 뭘 눌러도 복싱 1로 간다).
      if (!S.bg && had) location.reload();
    };
    S.isVid = isVid;
    if (bg) window.__setSceneBg(bg, bgdim);
    // 촬영 조정값 — scenes.html 슬라이더가 직접 쓴다. 기본값 = 손대기 전과 픽셀 동일.
    //   fp: 1인칭(앱 토글 사용) · opacity/blend: 실사 공간에 얹을 때의 합성 손잡이
    //   grade/bgGrade: 색 보정 {b 밝기, c 대비, s 채도, h 색상각}. 투사(캔버스)와 배경(영상·사진)을
    //     따로 잡는다 — 둘은 물리적으로 다른 광원이라 같이 만지면 반드시 한쪽이 틀어진다.
    //   uiScale: 투사 판 크기. hide: 씬에서 뺄 개체 키 목록(__sceneList() 가 주는 그 키).
    window.__sceneAdj = { zoom: 1, pan: 0, tilt: 0, dolly: 1, exposure: 1, bloom: 0.55,
      uiX: 0, uiY: 0, uiScale: 1, fp: false, opacity: 1, blend: 'normal',
      grade: { b: 1, c: 1, s: 1, h: 0 }, bgGrade: { b: 1, c: 1, s: 1, h: 0 }, hide: [] };
    // 개체 목록 — 지금 화면에 실제로 그려지는 것만. 키는 이름 우선(리로드해도 같다),
    //   이름이 없으면 타입으로 묶는다. scenes.html 체크박스가 이 키를 그대로 쓴다.
    window.__sceneList = () => {
      const seen = new Map();
      window.__dbg?.scene?.traverse(o => {
        if (o.isLight || o.isScene || !(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return;
        const key = o.name || '#' + o.type;
        const e = seen.get(key) || { key, n: 0, on: false };
        e.n++; e.on = e.on || o.visible;
        seen.set(key, e);
      });
      return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
    };
    // 합성 — 캔버스를 실사 배경 위에 어떻게 얹을지.
    //   screen = 가산광. 프로젝터는 빛을 **더하는** 장치라 이게 물리적으로 맞고,
    //   벽의 질감·그림자가 투사면을 통해 그대로 비쳐 훨씬 자연스럽다.
    //   normal = 불투명 잉크. 그래픽 연출용.
    window.__setComposite = (opacity, blend) => {
      const c = glCanvas();
      if (!c) return;
      c.style.opacity = opacity ?? 1;
      c.style.mixBlendMode = blend || 'normal';
    };
    return S;
  })();
  // 실사 배경일 때 무대(3D 실내·바닥·벽)를 끄고 투사광만 남긴다. 판별은 유니폼 키 —
  //   fx-core 공용 GLSL 때문에 셰이더 소스 문자열 매칭은 무대까지 통과시킨다(실측).
  //   ★ 매 프레임 다시 걸어야 한다: 앱이 스테이지 진입·주간 조명에서 되돌려 놓는다.
  const SB_KEEP = /^(uTrail|uCropOff|uField|uHT|uHalo|uProg|uPhase|uMark)/;
  const SB_STAGE = /^(uGrid|uLines|uScan|uBoost|uAccent|uHalf|uKey|uTint)$/;
  function sceneStageBg() {
    if (!SCENE_STAGE?.bg) return;
    // 배경 CSS 가 아직 안 붙었으면 붙인다 — 최초 호출 시점엔 캔버스가 없을 수 있다.
    const cv0 = renderer?.domElement, host0 = cv0?.parentElement;
    const gone = SCENE_STAGE.isVid?.(SCENE_STAGE.bg) ? !document.getElementById('__bgvid') : !host0?.style.backgroundImage;
    if (host0 && gone) window.__setSceneBg?.(SCENE_STAGE.bg, SCENE_STAGE.bgdim);
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    const hasU = (m, re) => !!m.uniforms && Object.keys(m.uniforms).some(k => re.test(k));
    // ★ 이 씬의 투사면 **하나만** 켠다. 예전엔 바닥·벽 판을 둘 다 켰는데, 러닝·농구(지면 씬)에서
    //   벽 판이 카메라 앞 1.9m 에 그대로 서 있었다 — 1인칭 화면 아래쪽의 **검은 사각형**의 정체다
    //   (유저: "달리기에서 이상한 검정색 무언가 보여 계속"). 벽 판 텍스처는 복싱용 어두운 판이라
    //   지면 씬에서는 내용도 틀렸다. 반대 방향(복싱에서 바닥 판)도 같이 막힌다.
    const stageUI = SCENE_STAGE.view === 'wall' ? window.__dbg?.wallGL?.mesh : window.__dbg?.floorGL?.mesh;
    const otherUI = SCENE_STAGE.view === 'wall' ? window.__dbg?.floorGL?.mesh : window.__dbg?.wallGL?.mesh;
    if (otherUI) otherUI.visible = false;
    const UI = new Set([stageUI].filter(Boolean));
    scene.traverse(o => {
      if (o === otherUI) { o.visible = false; return; }
      if (o.isLight) return;
      if (UI.has(o)) { o.visible = true; return; }
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      const keep = (m.type === 'ShaderMaterial' && hasU(m, SB_KEEP) && !hasU(m, SB_STAGE))
                || (m.type === 'MeshBasicMaterial' && !!m.map);
      if (!keep) o.visible = false;
    });
  }
  // ── 씬 룩: 색 보정 · 개체 숨김 · 투사 판 위치/크기 ───────────────────────────
  //   전부 **매 프레임** 다시 건다. 앱이 스테이지 진입·주간 조명·리스폰에서 되돌려 놓는다
  //   (이 파일 위쪽에 같은 함정이 이미 여러 번 기록돼 있다).
  const _look = { grade: '', bgGrade: '' };
  const _filt = (g, extra = '') => {
    const s = `brightness(${g?.b ?? 1}) contrast(${g?.c ?? 1}) saturate(${g?.s ?? 1}) hue-rotate(${g?.h ?? 0}deg)${extra}`;
    return /^brightness\(1\) contrast\(1\) saturate\(1\) hue-rotate\(0deg\)$/.test(s) ? '' : s;
  };
  function applySceneLook(A) {
    if (!A) return;
    // ① 색 보정 — 투사(캔버스)와 배경(영상/사진)은 **다른 광원**이라 따로 잡는다.
    //    CSS filter 라 렌더 파이프라인을 안 건드리고, 스크린샷에 그대로 찍힌다(= 보이는 대로).
    //    ★ 캔버스의 mix-blend-mode 는 그대로 산다. filter 는 블렌드 **전에** 적용된다.
    const cv = renderer?.domElement;
    if (cv) { const f = _filt(A.grade); if (f !== _look.grade) { cv.style.filter = f; _look.grade = f; } }
    const bv = document.getElementById('__bgvid');
    if (bv) {
      // 배경 어둡기(bgdim)는 이미 brightness 로 들어가 있다 — 색 보정과 곱해서 한 문자열로 만든다.
      const dim = SCENE_STAGE?.bgdim || 0;
      const f = _filt({ ...(A.bgGrade || {}), b: (A.bgGrade?.b ?? 1) * (1 - dim) });
      if (f !== _look.bgGrade) { bv.style.filter = f; _look.bgGrade = f; }
    }
    // ② 개체 숨김 — 키는 __sceneList() 가 주는 것과 같다(이름 우선, 없으면 '#타입').
    const hide = A.hide;
    if (A.capBg) window.__capBg = A.capBg;   // 대지 배경(투명/단색/그라디언트) — 저장본 복원
    if (hide?.length) {
      const H = new Set(hide);
      scene.traverse(o => { if (H.has(o.name || '#' + o.type)) o.visible = false; });
    }
    // ③ 투사 판 위치·크기 — 카메라와 별개로 대지 판만 움직이고 키운다.
    //    ★ 되돌리기 가능하게: 지난 프레임에 더한 값을 빼고 새 값을 더한다. 앱이 매 프레임
    //      위치를 다시 쓰든 안 쓰든 결과가 같다(누적 어긋남 방지).
    //    ※ 크기는 원래 투사 광학·설치 거리에서 **계산되는 값**이다(computeStation()). 여기서
    //      메시만 키우는 건 그 계산을 우회한 연출값이다 — 스펙을 바꿔야 하면 투사 폭(s-wallw)으로.
    //    ★ wallGL/floorGL 은 이 함수보다 아래에서 const 로 선언된다 — 직접 참조하면 TDZ 예외가
    //      매 프레임 터져 이 뒤가 통째로 안 돈다(실측: UI 조정 무반응). __dbg 게터로 우회.
    const uiMesh = SCENE_STAGE?.view === 'wall' ? window.__dbg?.wallGL?.mesh : window.__dbg?.floorGL?.mesh;
    if (uiMesh) {
      const vert = SCENE_STAGE?.view === 'wall' ? 'y' : 'z';   // 바닥은 카메라 up 이 -Z 라 화면 상하 = z
      uiMesh.position.x -= A._ax || 0; uiMesh.position[vert] -= A._av || 0;
      uiMesh.position.x += A.uiX || 0; uiMesh.position[vert] += A.uiY || 0;
      A._ax = A.uiX || 0; A._av = A.uiY || 0;
      // ★ 크기는 '지난 값을 나누고 새 값을 곱하는' 방식이면 안 된다 — floorGL 이 매 프레임
      //   자기 scale 을 다시 써서, 한 번 곱한 뒤로는 A._ak 가 같아 건너뛰고 앱 값만 남는다
      //   (실측: 슬라이더 1.6 인데 mesh.scale 1.0). 원본 배율을 한 번 잡아 두고 **매 프레임**
      //   base×k 로 덮는다. 이 함수는 루프 마지막에 도니 우리가 마지막에 쓴다.
      //   ★★ 원본을 '한 번만' 잡으면 안 된다. 첫 프레임엔 renderDesignFrame 이 아직 자기 배율을
      //     안 써서 mesh.scale 이 생성 기본값 (1,1,1) 이다. 그걸 원본으로 굳히면 이후 매 프레임
      //     1 로 덮어써서, 지오메트리 2600×1600 짜리 UI 판이 2600m 크기로 그려진다 = 화면 밖.
      //     (실측: _uiBase [1,1] · meshScale [1,1] · UI 통째로 실종 — 유저: 정보 UI 안 보여)
      //     대신 **자가 치유**: 우리가 마지막에 쓴 값과 다르면 앱이 새로 쓴 것이니 그게 새 원본.
      const k = A.uiScale || 1;
      if (A._uiOut == null || Math.abs(uiMesh.scale.x - A._uiOut) > 1e-9) A._uiBase = uiMesh.scale.clone();
      A._ak = k;
      uiMesh.scale.set(A._uiBase.x * k, A._uiBase.y * k, A._uiBase.z * k);
      A._uiOut = uiMesh.scale.x;
    }
  }

  function tickSceneStage() {
    if (!SCENE_STAGE) return;
    const S = SCENE_STAGE;
    if (!S.ui) {   // DOM 감시 — 늦게 생성되는 위젯(클립 카드·패널)도 생기는 즉시 숨긴다
      S.ui = true;
      const sweep = () => {
        const keep = new Set();
        for (let n = renderer.domElement; n; n = n.parentElement) keep.add(n);
        for (const anc of keep) {
          if (!anc.parentElement) continue;
          for (const sib of anc.parentElement.children) {
            // #__bgvid = 실사 배경 영상. 캔버스의 형제라 이 청소에 딱 걸린다(실측: 배경이 안 보임).
            if (!keep.has(sib) && sib.id !== '__bgvid' && sib.tagName !== 'SCRIPT' && sib.tagName !== 'STYLE') sib.style.display = 'none';
          }
        }
      };
      sweep();
      // ★ 제품 뷰 CSS 가 #stage 에 패널 자리 마진(좌 326·우 320)을 남긴다 — 패널을 숨겨도
      //   마진은 남아 캔버스가 창−646px 로 잠긴다(유저: "노트북에서 너무 안 보여"의 절반).
      //   씬 스테이지는 캔버스 조상 마진을 전부 걷어 창 전체를 쓴다.
      for (let n = renderer.domElement.parentElement; n && n !== document.body; n = n.parentElement)
        n.style.setProperty('margin', '0', 'important');
      // 패널을 display:none 해도 resize 이벤트는 안 온다 → renderer 가 부팅 시(패널 열림) 크기로
      // 남아 캔버스가 CSS 로 늘려지거나 우측 검은 띠가 생긴다(화질 열화의 정체). 숨긴 직후 재측정.
      window.dispatchEvent(new Event('resize'));
      new MutationObserver(() => { sweep(); window.dispatchEvent(new Event('resize')); })
        .observe(document.body, { childList: true, subtree: true });
      if (typeof controls !== 'undefined' && controls) controls.enabled = false;
    }
    // 사용자 봇은 카메라와 벽 사이에 서서 화면을 가린다 — 스테이지 뷰에선 숨김(매 프레임: 리스폰 대비)
    if (xbot?.group) xbot.group.visible = false;
    if (xbot?.model) xbot.model.visible = false;
    sceneStageBg();   // 실사 배경 모드면 무대를 끄고 캔버스를 비운다(매 프레임)
    // 종목 전환(1회) — BK_* = 농구 · A1/A2/A3 = 러닝 · BX_* = 복싱(기본)
    if (!S.sport) {
      const want = /^BK_/.test(S.scene) ? '농구' : /^BX_/.test(S.scene) ? null : '러닝';   // BX_* 외 접두 없음 = 러닝(READY·A·T·P·C·FIN)
      if (want) {
        const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === want);
        if (btn) btn.click();
      }
      S.sport = true;
    }
    // 세션 진입 + 씬 점프 — 그리고 **씬 고정**: 자동 진행으로 넘어가면 되감아 무한 루프(촬영용)
    if (!session.active) document.getElementById('btn-session')?.click();
    else if (session.curStage?.id !== S.scene) {
      session.pinStage = null;   // 아직 목표 씬이 아니다 — 여기까지는 정상 진행으로 데려간다
      // 다른 씬으로 넘어갔다 = 즉시 되돌린다(씬 고정)
      const i = session.stages.findIndex(x => x.id === S.scene);
      if (i >= 0) { session.stageIdx = i; session.t = 0; session._enter(); }
    } else {
      // 목표 씬에 도착했다 = 여기서 못을 박는다. session.next() 가 이 못을 보고 넘어가지
      //   않으므로, 다음 씬이 한 프레임 비치는 일도 없고 타이머도 끝(링 100%·GO)까지 간다.
      session.pinStage = S.scene;
      // ★ 루프 주기 — 스테이지 자체 dur 에 맡기면 씬마다 3~6초로 제각각이라 8초 클립을 뽑을 때
      //   중간에 두 번 되감긴다(유저 08-03). 씬 고정 상태에서도 일정 주기로 다시 시작시킨다.
      //   ?sceneloop=<초> 로 조절. 기본 8 — 익스포터 기본 길이와 맞췄다.
      // ★★ 단, 코치 클립에 박자를 건 스테이지(dur = 클립 길이)는 그 길이를 쓴다. 8초로 자르면
      //   10.5초 클립이 스테이지 위에서 계속 밀려 '타이밍이 아무것도 안 맞는' 상태가 된다(유저).
      // ★★★ 주기는 스테이지 주기의 **정수배**여야 한다. 8 초로 잘라 두면 6 초짜리 콤보(BX_C3)가
      //   두 바퀴째 2 초 지점에서 다시 시작해, 씬을 열자마자 **이미 맞은 노드(2번)가 채워진 채**
      //   보인다(유저: "잽잽훅 처음에 이거 왜 나와"). 올림해서 배수로 맞추면 위상이 영구히 유지되고
      //   길이도 요청값보다 짧아지지 않는다. dur 6 · 요청 8 → 12초.
      const _sd = session.curStage?.dur, _want = window.__sceneLoop || 8;
      const _period = _sd > 0 ? Math.ceil(_want / _sd) * _sd : _want;
      if (session.t >= _period) {
        session.t = 0; session._enter();
        // ★ 영상도 같이 되감는다. setGhostClip 은 같은 클립이면 조기 반환해서 영상만 계속
        //   흐르고 세션 시계만 0 이 됐다 — 시계가 둘로 갈리는 근본 지점이었다.
        //   박자는 영상 시계(clipT)로 도는데 스테이지 종료는 세션 시계라, 둘이 어긋나면
        //   마크가 엉뚱한 자세에 뜨고 카운터가 튄다.
        if (demoVideo && demoVideo.duration) { try { demoVideo.currentTime = 0; } catch (e) {} }
      }
    }
    // 커튼 걷기 — 씬에 실제 진입해 1.5초 안정된 뒤 페이드아웃(1회)
    if (S.cover) {
      if (session.curStage?.id === S.scene) S.okT++;
      if (S.okT > 90) {
        const c = S.cover; S.cover = null;
        c.style.opacity = '0';
        setTimeout(() => c.remove(), 800);
      }
    }
    // 카메라 정면 고정 — 망원(FOV 9°)이라 사실상 무왜곡 정면
    //   ★ A = 씬 스테이지 조정값. scenes.html 슬라이더가 이 객체를 직접 쓴다(리로드 없음).
    //     zoom  : 화각 배율 (작을수록 확대)   pan/tilt : 프레임 이동   dolly : 거리 배율
    const A = window.__sceneAdj;
    applySceneLook(A);   // 색 보정 · 개체 숨김 · 투사 판 위치/크기 (평면·1인칭 공통)
    // 1인칭 — 앱 토글을 그대로 쓴다(종목별 화각·VOR·가독 보정이 딸려 온다). 이때는
    //   씬 스테이지가 카메라를 건드리지 않는다. 밖에서 다시 잡으면 그 보정이 전부 빠진다.
    // ★ 캐시한 플래그가 아니라 **앱의 실제 상태**(fpMode)와 비교한다. 스테이지 진입이
    //   자기 판단으로 시점을 뒤집으므로(main.js:1077), 캐시로 두면 한 번 어긋난 뒤 영영 안 돌아온다.
    if (!!A.fp !== fpMode) {
      window.__setFp?.(!!A.fp);
      A._fpFov = camera.fov;   // setFp 가 종목별로 잡아 둔 기준 화각. 매 프레임 곱하면 발산한다
    }
    if (A.fp) {
      // 1인칭 각도 — 눈의 위치·VOR 은 앱이 잡고(위 fpMode 블록), 그 위에 요/피치/화각만 얹는다.
      //   이 함수는 루프의 **마지막**에 돌므로 여기서 덮으면 그 프레임에 그대로 반영된다.
      //   pan/tilt 단위는 라디안 — 슬라이더 ±1.5 = ±86°.
      const yaw = A.pan || 0, tilt = A.tilt || 0;
      if (yaw || tilt) {
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        e.y += yaw; e.x += tilt;
        camera.quaternion.setFromEuler(e);
      }
      // 거리 — 시선 뒤로 물러난다(1 = 눈 위치 그대로). 1인칭 '어깨너머'까지 커버.
      if (A.dolly && A.dolly !== 1) camera.translateZ((A.dolly - 1) * 2.0);
      camera.fov = (A._fpFov || 60) * (A.zoom || 1);
      camera.updateProjectionMatrix();
      FX.exposure = A.exposure ?? 1;
      FX.bloomStrength = A.bloom ?? 0.55;
      return;
    }
    const half = 4.5 * (A.zoom || 1);
    if (S.view === 'wall') {
      const wc = rig._wallCenter || { cx: 0, cy: 1.5 };
      let wz = -2.0;
      if (rig.wallFill) wz = rig.wallFill.getWorldPosition(new THREE.Vector3()).z;
      const dist = (rig.wallH / 2) / Math.tan(THREE.MathUtils.degToRad(half)) * (A.dolly || 1);
      const cx = (wc.cx ?? 0) + (A.pan || 0), cy = (wc.cy ?? 1.5) + (A.tilt || 0);
      camera.fov = 9 * (A.zoom || 1); camera.position.set(cx, cy, wz + dist);
      camera.lookAt(cx, cy, wz);
    } else {
      // 수직 탑다운은 세로로 긴 빔 레인이 와이드 화면에서 가는 스트립으로만 남는다(유저:
      // "노트북에서 너무 안 보여"). 기본 평면 뷰 = 뒤·위 3/4 앵글 — 레인이 원근으로
      // 화면을 채우고 바닥 텍스트 방향도 유지된다. tilt 슬라이더 = 존 중심 앞뒤 이동 유지.
      const cz = -1.3 + (A.tilt || 0);
      const k = A.dolly || 1;
      camera.fov = 26 * (A.zoom || 1); camera.up.set(0, 1, 0);
      camera.position.set(A.pan || 0, 2.9 * k, cz + 3.0 * k);
      camera.lookAt(A.pan || 0, 0, cz - 0.5);
    }
    camera.updateProjectionMatrix();
    FX.exposure = A.exposure ?? 1;          // 노출
    FX.bloomStrength = A.bloom ?? 0.55;     // 글로우 세기
    // (투사 판 위치·크기는 applySceneLook 으로 옮겼다 — 1인칭에서도 먹어야 하므로)
  }

  let _dotStage = '', _dotMax = 0;   // 도트 진행바 — 스테이지별 최대 진행(되감김 방지)
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
        const fdoc = fdocNow();
        // 반복형 스테이지(워밍업)의 도트 로딩바 = 시간이 아니라 '남은 횟수' 진행도.
        // 기존엔 --dur CSS 애니메이션이라 반복을 아무리 해도 안 차 보였음(유저: '프로그래스바가 안 찬다').
        // B1 헤더 스왑 — repTotal 게이트 '밖'이어야 한다: 셋업 동안 틱이 repTotal=null로 두고
        // 리턴하므로 게이트 안에 넣으면 정작 셋업에서 실행이 안 된다(유저: 안 되었는데).
        if (session.active && session.stages?.[session.stageIdx]?.id === 'BK_B1') {
          const sTitle = fdoc?.getElementById('s-title'), sCue = fdoc?.getElementById('s-cue');
          if (sTitle) {
            const want = session.bkB1Setup ? 'Wide Stance' : 'Low Dribble';
            const cue = session.bkB1Setup ? 'Feet wider than shoulders — knees bent'
              : (session.bkB1EyesUp ? 'Eyes up — keep the beat' : "Stay low — Curry's beat");
            if (sTitle.textContent !== want) sTitle.textContent = want;
            if (sCue && sCue.textContent !== cue) sCue.textContent = cue;
          }
          const dots = fdoc?.getElementById('s-dots');   // 셋업(Wide Stance)엔 진행 도트 무의미 — 숨김(유저)
          const dv = session.bkB1Setup ? 'hidden' : '';
          if (dots && dots.style.visibility !== dv) dots.style.visibility = dv;
          // Success 컴포넌트(피그마 130-2984): 배지 + 3·2·1 카운트다운 링
          const succ = fdoc?.getElementById('s-succ');
          if (succ) {
            const on = session.bkB1Succ != null;
            const dsp = on ? 'flex' : 'none';
            if (succ.style.display !== dsp) succ.style.display = dsp;   // 매 프레임 스타일 쓰기 금지 — CSS3D iframe 리컴포짓 플리커(검은 사각, 유저)
            if (on) {
              const nEl = fdoc.getElementById('succ-n');
              if (nEl && nEl.textContent !== String(session.bkB1Succ)) nEl.textContent = String(session.bkB1Succ);
              const frac = Math.max(0, Math.min(1, session.bkB1SuccFrac ?? 0));   // 세션이 관찰-시프트 반영해 계산
              const arc = fdoc.getElementById('succ-arc');
              const off = (615.7 * frac).toFixed(0);
              if (arc && arc.style.strokeDashoffset !== off) arc.style.strokeDashoffset = off;
              const dot = fdoc.getElementById('succ-dot');
              if (dot) { const a = -Math.PI / 2 + (1 - frac) * 2 * Math.PI;
                dot.setAttribute('cx', (110 + 98 * Math.cos(a)).toFixed(1));
                dot.setAttribute('cy', (110 + 98 * Math.sin(a)).toFixed(1)); }
            }
          }
        }
        // 스텝백 프리뷰 타이머 = 실제 영상 재생 횟수(0/2 → 1/2 → 2/2). 링 한 바퀴 = 영상 1회.
        //   HTML의 자체 CSS 애니메이션/인터벌은 배속·시작 위상과 어긋나므로 여기서 직접 구동한다.
        if (STEP_SEG[session.stages?.[session.stageIdx]?.id || ''] && fdoc) {
          const num = fdoc.getElementById('prev-num');
          const arc = fdoc.querySelector('#prev-ring .arc'), tip = fdoc.querySelector('#prev-ring .tip');
          const LOOPS = stepLoops(session.stages?.[session.stageIdx]?.id || '');
          const txt = Math.min(LOOPS, _stepLoops) + '/' + LOOPS;
          if (num && num.textContent !== txt) num.textContent = txt;
          if (arc) {
            if (arc.style.animation !== 'none') arc.style.animation = 'none';
            const off = (1727.9 * (1 - _stepFrac)).toFixed(0);
            if (arc.style.strokeDashoffset !== off) arc.style.strokeDashoffset = off;
          }
          if (tip) {
            if (tip.style.animation !== 'none') tip.style.animation = 'none';
            const rot = 'rotate(' + (_stepFrac * 360).toFixed(0) + 'deg)';
            if (tip.style.transform !== rot) tip.style.transform = rot;
          }
          // 마지막 회차가 끝나는 순간 프리뷰 행을 즉시 감춘다 — CSS 타임아웃에 맡기면 다음 장면
          // 전환 프레임에 타이머가 미세하게 비쳐 거슬린다(유저).
          const prow = fdoc.getElementById('prev-row');
          if (prow) {
            const d = (session._followLatch || _stepLoops >= LOOPS) ? 'none' : '';
            if (prow.style.display !== d) prow.style.display = d;
          }
        }
        const _sid = session.stages?.[session.stageIdx]?.id || '';
        if (session.repTotal) {
          // 전 스테이지 동일 컴포넌트(유저) — 러닝과 같은 연속 채움. 과거 BK_B*를 막았던 건
          // 폭 쓰기 재래스터로 인한 검은 플래시(드리블마다) 때문. 재발하면 여기부터 본다.
          const clip = fdoc?.querySelector('.dclip');
          if (clip) {
            // repFrac = 회차 사이도 채우는 연속값(깊이·발높이). 정수 회차만 쓰면 뚝뚝 끊긴다(유저).
            let done = session.repFrac != null
              ? Math.max(0, Math.min(1, session.repFrac))
              : 1 - Math.max(0, Math.min(1, session.repLeft / session.repTotal));
            // 진행바는 되감기지 않는다 — 깊이·발높이가 섞인 연속값은 일어설 때 줄어들어
            // 스쿼트에서 찼다 빠졌다 했다(유저). 스테이지가 바뀔 때만 0으로 리셋.
            if (_dotStage !== _sid) { _dotStage = _sid; _dotMax = 0; }
            done = _dotMax = Math.max(_dotMax, done);
            if (clip.style.animation !== 'none') clip.style.animation = 'none';
            const wpx = (600 * done).toFixed(0) + 'px';   // 1px 양자화 — 매 프레임 폭 쓰기가 리컴포짓 플리커 유발
            if (clip.style.width !== wpx) clip.style.width = wpx;
          }
        }
        if (tp) {
          const col = tp.i > 0.7 ? '#ff8a5a' : tp.i > 0.45 ? '#ffcf9a' : '#fff';   // 강도 온도색
          // 타이틀 = 현재 구간명(리커버/스프린트 등). 보조텍스트 없음(유저).
          const title = fdoc?.getElementById('s-title');
          const nm = tp.n.charAt(0).toUpperCase() + tp.n.slice(1).toLowerCase();   // 앞글자만 대문자(유저): EASY→Easy, SPRINT→Sprint
          if (title && title.textContent !== nm) title.textContent = nm;
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
    // ── 실전(C 라이브) — Figma 128:261: km 카운터(0→목표 5km, 실시간 count) + SPM + Pace ──
    {
      const inLive = session.active && session.sport === 'running' && /^C[2-5]$/.test(session.stage || '');
      if (inLive) {
        const TARGET_KM = 5, LIVE_SECS = 22;   // 목표 5km(유저 세팅), 라이브 구간 동안 0→5 채움(데모)
        const _prevKm = session._liveKm ?? 0;
        session._liveKm = Math.min(TARGET_KM, _prevKm + (_uiDt / LIVE_SECS) * TARGET_KM);
        try {
          const fdoc = fdocNow();
          const kn = fdoc?.getElementById('km-n');
          if (kn) { const v = session._liveKm.toFixed(2); if (kn.textContent !== v) kn.textContent = v; }
          const tgtSpm = Math.round(60 / (tokens._beatT || 0.39));
          const sme = fdoc?.getElementById('spm-me'); if (sme) { const v = window.__mySpm ? String(window.__mySpm) : '--'; if (sme.textContent !== v) sme.textContent = v; }
          const stg = fdoc?.getElementById('spm-tgt'); if (stg && stg.textContent !== String(tgtSpm)) stg.textContent = tgtSpm;
          // 페이스: 목표=고정 5'42", 내 페이스=케이던스 비례 근사(빠른 케이던스=빠른 페이스)
          const fmtPace = s => { s = Math.round(s); return Math.floor(s / 60) + '’' + String(s % 60).padStart(2, '0') + '”'; };
          const pt = fdoc?.getElementById('pace-tgt'); if (pt && pt.textContent !== '5’42”') pt.textContent = '5’42”';
          const pm = fdoc?.getElementById('pace-me');
          const meSec = window.__mySpm ? 342 * tgtSpm / window.__mySpm : null;
          if (pm) { const v = meSec != null ? fmtPace(meSec) : '—'; if (pm.textContent !== v) pm.textContent = v; }
          // ── 페이스 유지 팩(?pacepack=1)이 먹는 값 ──
          //   목표 거리 = 남은 거리 계산의 기준. 누적 편차 = 목표 페이스로 갔을 때 대비 실제로 더/덜 쓴 초.
          //   거리 증분(km)에 초/km 차이를 곱해 쌓는다 — 이게 템포런의 실제 판정 단위(뱅크)다.
          const kt = fdoc?.getElementById('km-tgt');
          if (kt) { const v = TARGET_KM.toFixed(2); if (kt.textContent !== v) kt.textContent = v; }
          if (meSec != null) session._paceBank = (session._paceBank ?? 0) + (meSec - 342) * (session._liveKm - _prevKm);
          const pb = fdoc?.getElementById('pace-bank');
          if (pb) { const v = String(Math.round(session._paceBank ?? 0)); if (pb.textContent !== v) pb.textContent = v; }
        } catch (e) { /* iframe 로드 전 */ }
      } else if (!/^C[2-5]$/.test(session.stage || '')) {
        session._liveKm = null; session._paceBank = 0;   // 라이브 벗어나면 리셋(재진입 0부터)
      }
    }
    // 케이던스 메트로놈(사운드 우선 — 러닝 교수법: 목표 SPM은 귀로 먼저). 팩 박자 동기 클릭.
    // 실전=연습 통일(유저): P뿐 아니라 C 실전에서도 소리가 페이스를 가르친다.
    // 소리(ttsOn)와 케이던스 실측은 분리한다 — 한 조건에 묶여 있어서 음소거하거나
    //   구간 점프로 ttsOn 이 잠깐 꺼지면 __mySpm 이 갱신을 멈췄고, 그 값을 먹는 SPM·페이스가
    //   '--'·'—' 로 굳어 버렸다(유저: 페이스 숫자가 멈춤). 계기는 소리와 무관하게 계속 돈다.
    if (session.active && /^[PC]\d$/.test(session.stage || '') && session.sport === 'running') {
      // 훈련 구간 케이던스 = 메트로놈 템포에 반영 (전력 빠르게·회복 느리게). 소리가 페이스를 가르침.
      const metroBeatT = tokens._beatT / (trainPhase()?.c || session.curStage?.cadence || 1);
      const ph = Math.floor(state.time / metroBeatT);
      if (ttsOn && tokens._beatT > 0.2 && ph !== _metroPh) {
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
          const me = fdocNow()?.getElementById("spm-me");
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
    // 3인칭 러닝 전진 팔로우 — 봇 z 델타를 '같은 프레임에 즉시' 카메라·타깃에 적용(스무딩 X → 쓔욱 없음).
    // 게이트 없음: 라이브 전진뿐 아니라 FIN 진입 시 봇이 원점으로 순간 텔레포트(dz≈+드리프트)하는 것도 같이 잡아
    // 카메라가 리셋된 봇/리포트를 그대로 프레이밍(회색 보이드·멀리서 오는 UI 없음). 프리뷰 idle은 봇 정지라 dz≈0.
    // 추종 정본 = xbot.getAnchor()(골반 본). 그룹 z만 보던 시절엔 CMU 클립이 옆으로 가거나
    // 뒤로 돌면 카메라가 봇을 놓쳤음(유저: '3인칭 카메라도 나를 안 따라와'). 빔 풋프린트와
    // 같은 앵커를 쓰므로 봇·빔·카메라가 한 몸으로 움직인다. x도 함께 따라감(측면 컷 대응).
    if (!studioActive && (state.pack === 'running' || state.pack === 'basketball') && !fpMode) {
      const dx = body.x - lastBodyX, dz = body.z - lastBodyZ;
      camera.position.x += dx; camera.position.z += dz;
      controls.target.x += dx; controls.target.z += dz;
      lastBodyX = body.x; lastBodyZ = body.z;
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
        + ` · 시야 낙하 ${gazeRange.near.toFixed(1)}~${Math.min(gazeRange.far, 9.9).toFixed(1)}m${gazeInfo}`
        + (state.pack === 'basketball' && _occStat.n > 0
            ? ` · 빔 차폐 지금 ${(100 * _occStat.now).toFixed(0)}%(${_occStat.hand}) 평균 ${(100 * _occStat.sum / _occStat.n).toFixed(1)}% 최악 ${(100 * _occStat.worst).toFixed(0)}%`
            : '');
    } else if (geomEl && state.pack === 'basketball' && _occStat.n > 0) {
      const avg = 100 * _occStat.sum / _occStat.n;
      geomEl.textContent =
        `빔 차폐 실측 · 지금 ${(100 * _occStat.now).toFixed(0)}% (${_occStat.hand})`
        + ` · 누적 평균 ${avg.toFixed(1)}% · 최악 프레임 ${(100 * _occStat.worst).toFixed(0)}%`
        + ` · 조리개 종아리 밴드(바깥 6cm) · 표본 ${_occStat.n}프레임`;
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
      const dayOn = (FXP.day || FXP.markBlend === 'ink') ? 1 : 0;
      // 중앙 화살표 (LINE ① 이동 촉)
      const [ax, , az] = P(0.25);
      bkArrow.position.set(ax, 0.018, az);
      bkArrow.rotation.z = heading;
      bkArrow._mesh.material.clippingPlanes = cp;
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
    renderWallGrid();    // 복싱 벽 배경 그리드
    renderBxPerson();    // 복싱 벽면 인물 시범 (정본 포트)
    renderJointMarkers();   // 관절 추종 마커 (증명 데모)
    renderDesignFrame();  // 벽 = 스테이지별 대지 프레임(CSS3D). 프레임 스테이지는 기존 벽 UI 숨김(사람+배경만)
    applyBallOcclusion();  // 공이 빔을 실제로 가리는 순간만 그 지점 UI를 꺼트림(광학 정직성)
    applyEditOverrides();  // 배치 편집(유저): 드래그로 옮긴 벽·인물 위치를 세션 덮어쓰기 후 재적용
    tickSceneStage();     // ?scene= 씬 스테이지(영상용 정면 라이브 뷰) — 파라미터 없으면 no-op
    renderFrame(clock.elapsedTime);   // 블룸 + 그레인·비네트 컴포저 (scene.js FX)
    blackProbe();   // ?blackprobe=1 — 검은 판이 어느 메시인지 콘솔에 찍는다(기본 꺼짐)
  }


  // ── 빔 차폐(농구): 공이 렌즈–바닥 광경로를 가로막으면 그 지점 UI가 실제로 안 보인다 ──
  //   유저 요구: 숨기지 말고 정직하게. 왼종아리 마운트 실측 — 오른손 드리블 0%,
  //   왼손 드리블 평균 11%(최악 프레임 100%), 크로스오버 중앙 통과 15%.
  //   판정 = 조리개(무릎)→토큰 중심 선분과 공 구(반지름 0.12) 교차. 가려지면 그 토큰만 소등.
  function applyBallOcclusion() {
    const g = session?.G?.[session.stage];
    if (!g || !g.visible || state.pack !== 'basketball' || !xbot?.ball?.visible) { _occRestore(); return; }
    const A = _apertureWorld();
    if (!A) { _occRestore(); return; }
    const B = xbot.ball.position, R = 0.12;
    _occRestore();
    _occMeasure(A, B, R);   // 계측 — 검은 원반 그래픽은 폐기(유저). 표현은 실제 UI 소등뿐
    // 조리개 코앞(0.13m)의 공은 빔의 각도 사분면을 통째로 덮는다 → 일부 토큰만이 아니라
    // 투사 UI '전체'가 함께 어두워지는 게 실제다(유저). 차단 비율만큼 전부 감광.
    const k = _occStat.now <= 0 ? 1 : Math.max(0.06, 1 - _occStat.now);
    if (k >= 0.999) return;
    g.traverse((o) => {
      const m = o.material;
      if (!o.visible || !m || m.opacity === undefined) return;
      // 링·마크는 ShaderMaterial(uGain이 밝기 담당) — opacity만 낮추면 화면이 안 변한다(유저: 안 깜빡임)
      const U = m.uniforms && m.uniforms.uGain;
      _occTouched.push([m, m.opacity, U ? U.value : null]);
      m.opacity *= k;
      if (U) U.value *= k;
    });
    const fe = floorObj?.element;   // 지면 프레임(CSS3D)도 같은 광경로 — 함께 어두워져야 한다
    if (fe) { _occCss = fe.style.opacity; fe.style.opacity = String(k); }
  }

  // ── 차폐 계측 + 실제 그림자 시각화 ──
  //   필드 격자 25점의 순간 차단율을 재고(평균·최악 누적), 조리개→공 연장선이 바닥에 만드는
  //   그림자 원반을 실제 크기로 그린다. 수치가 어디서 나오는지 눈으로 확인 가능하게.

  // 실제 조리개 위치 — 포드는 무릎 뼈가 아니라 종아리 바깥면에 붙는다(산업디자인 실측:
  // 밴드 바깥으로 약 6cm, 무릎 아래 4cm). 이 6cm가 그림자 쐐기를 필드 밖으로 밀어내
  // 차단률을 몇 배 낮춘다 — 뼈 중심으로 재면 하드웨어보다 나쁘게 나온다.
  const _POD_OUT = 0.06, _POD_DOWN = 0.04;
  function _apertureWorld() {
    const K = xbot.getKneeWorld?.();
    if (!K) return null;
    const hipX = xbot._hips ? xbot._hips.matrixWorld.elements[12] : 0;
    const side = K.x <= hipX ? -1 : 1;   // 장착 다리 바깥 방향
    return new THREE.Vector3(K.x + side * _POD_OUT, K.y - _POD_DOWN, K.z);
  }
  const _occField = (() => { const a = []; for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) for (const z of [-2.6, -3.0, -3.4, -3.8, -4.1]) a.push(new THREE.Vector3(x, 0, z)); return a; })();
  const _occStat = { now: 0, sum: 0, n: 0, worst: 0, hand: '—' };
  function _occMeasure(A, B, R) {
    const d = new THREE.Vector3(), c = new THREE.Vector3();
    let hit = 0;
    for (const P of _occField) {
      d.copy(P).sub(A); const len = d.length(); d.divideScalar(len);
      const t = Math.max(0, Math.min(len, c.copy(B).sub(A).dot(d)));
      c.copy(A).addScaledVector(d, t);
      if (c.distanceTo(B) < R) hit++;
    }
    _occStat.now = hit / _occField.length;
    _occStat.sum += _occStat.now; _occStat.n++;
    _occStat.worst = Math.max(_occStat.worst, _occStat.now);
    const hipX = xbot._hips ? xbot._hips.matrixWorld.elements[12] : 0;
    _occStat.hand = B.x > hipX + 0.08 ? '오른손' : B.x < hipX - 0.08 ? '왼손' : '중앙 통과';
  }
  if (import.meta.env.DEV) window.__occ = _occStat;
  function resetOccStat() { _occStat.sum = 0; _occStat.n = 0; _occStat.worst = 0; }
  const _occTouched = [];
  let _occCss = null;
  function _occRestore() {
    if (_occCss !== null && floorObj?.element) { floorObj.element.style.opacity = _occCss; _occCss = null; }
    for (const [m, op, g] of _occTouched) { m.opacity = op; if (g !== null && m.uniforms?.uGain) m.uniforms.uGain.value = g; }
    _occTouched.length = 0;
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
  // ★ HMR 재실행 잔재 청소 — 이전 실행이 남긴 CSS3D 레이어가 새 레이어 '위'에 떠서
  //   이전 스테이지 화면이 얼어붙은 채 보인다(유저 블랙박스: 세션 A1 · 지면 A2/READY 고착의 정체).
  //   새 탭은 잔재가 없어 재현이 안 됐고, 리로드를 여러 번 거친 탭일수록 쌓였다.
  document.querySelectorAll('.nt-css3d').forEach(el => el.remove());
  cssRenderer.domElement.classList.add('nt-css3d');
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
  let _lastSport = null;   // 팩 전환 감지 — 재진입 시 UI 인트로를 처음처럼 재생
  // 복싱 벽 UI의 WebGL 경로 — CSS3D는 DOM 레이어(z6)라 벽 앞의 x봇 위로 그대로 통과한다.
  // 같은 씬의 평면이면 깊이 테스트가 가림을 담당하고 빔 페더·차폐 소등도 자동 상속한다.
  const WALLGL = new URLSearchParams(location.search).get('wallgl') !== '0';
  const wallGL = new WallGL();
  scene.add(wallGL.mesh);
  wallGL.preload();   // 진입 전에 이미지 굽기 — 첫 화면 팝 방지(녹화 대비)
  let wallGLOn = false;

  // ── 바닥 프레임 occlusion 오버레이 ──
  //   CSS3D(z6)는 DOM 레이어라 3D 깊이가 없어 x봇 다리 위로 둥둥 뜸. 해결: x봇만 투명 배경으로
  //   프레임 위(z7)에 재렌더 → 프레임이 다리 뒤로 사라져 "발밑에 밟히는" 착시. HTML 모션은 그대로 유지.
  const OCCL_LAYER = 1;
  const occlRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  occlRenderer.setPixelRatio(window.devicePixelRatio || 1);
  occlRenderer.setClearColor(0x000000, 0);
  Object.assign(occlRenderer.domElement.style, { position: 'fixed', pointerEvents: 'none', zIndex: '7' });   // display 토글 금지 — 재표시 첫 프레임 검정 플래시
  if (new URLSearchParams(location.search).get('occl') === '1') document.body.appendChild(occlRenderer.domElement);   // 기본: DOM 밖 (DIAG는 아래 선언 — TDZ 부트 크래시 사고)
  const occlCam = camera.clone();
  // 오버레이 = 프레임 위 몸을 재렌더해 프레임을 몸에 가림(발밑 밟힘). 2번째 GL이라 메인 IBL(PMREM) 재사용
  // 불가 → 원본 재질은 검게 나옴. Lambert 대체재질 + 씬 조명을 오버레이 레이어에도 켜서 3D 음영 유지(2D 방지).
  const OCCL_MAT = new THREE.MeshLambertMaterial({ color: 0xb9bcc4 });
  let occlLightsReady = false;
  // 검은 플래시 이분법 진단(유저 재현 전용): URL에 ?noccl=1 → 오클루전 오버레이 끔 · ?nocss=1 → 지면 프레임 끔.
  //   어느 쪽을 껐을 때 플래시가 사라지는지로 범인 레이어를 30초 만에 특정한다.
  const DIAG = new URLSearchParams(location.search);
  // (진단 종료) 검은 깜빡임 범인 확정: 2번째 WebGL 캔버스(오클루전 오버레이) 컴포지팅.
  //   캔버스를 DOM에서 제거(525917f)한 빌드에서 유저 실환경 깜빡임 소멸 확인 — 마젠타 판별 불필요.
  // 오클루전 오버레이 기본 ON 복구 — 꺼두니 지면 프레임이 봇 몸을 관통(유저 스크린샷).
  //   검은 플리커의 실제 근본(무한 CSS 애니메이션·iframe 쓰기 폭주·전환 공백)은 별도 수정으로
  //   제거됨(20c829c·91fcc70·1cae990). 재발 시 격리: ?noccl=1
  // 완전 제거(유저 재보고: display 토글 수정으로도 재발) — 2번째 GL 컨텍스트의 존재 자체가
  // 컴포지터 검정 프레임의 마지막 남은 자체 레이어. 기본 = 캔버스를 DOM에 아예 안 붙인다.
  // 관통(프레임이 봇 위에 그려짐)은 알려진 트레이드오프 — KNOWN-ISSUES에 후속 설계 기록.
  const NO_OCCL = DIAG.get('occl') !== '1';
  const NO_CSS = DIAG.get('nocss') === '1';
  function renderFloorOcclusion(active) {
    if (NO_OCCL) active = false;
    // display 토글 금지(유저 실측 이분법: 오버레이 재활성과 함께 검은 프레임 재발) —
    // none→block 재표시 첫 프레임에 GL 버퍼가 붙기 전 불투명 검정이 노출된다.
    // 항상 표시 상태로 두고, 비활성일 땐 투명 클리어만 한다(비용 0에 가깝고 플래시 없음).
    if (!active || !xbot.model) {
      if (occlRenderer._hadContent) { occlRenderer.clear(); occlRenderer._hadContent = false; }
      return;
    }
    occlRenderer._hadContent = true;
    const cvr = renderer.domElement.getBoundingClientRect();
    if (occlRenderer._sw !== cvr.width || occlRenderer._sh !== cvr.height) {
      occlRenderer.setSize(cvr.width, cvr.height);
      occlRenderer._sw = cvr.width; occlRenderer._sh = cvr.height;
    }
    occlRenderer.domElement.style.left = cvr.left + 'px';
    occlRenderer.domElement.style.top = cvr.top + 'px';
    // x봇 본만 오클루전 레이어에 등록(로드/팩교체 대응 — 본 수십개라 가벼움). 오버레이 카메라는 이 레이어만 렌더.
    xbot.group.traverse(o => o.layers.enable(OCCL_LAYER));
    // 농구공은 scene 직속(그룹 밖)이라 오클루전 실루엣에서 빠져 있었음 → CSS3D 지면 프레임이
    // 공 앞을 덮어 '공이 투사 레이어 아래로 들어감'(유저). 공도 오클루더로 등록.
    if (xbot.ball) xbot.ball.layers.enable(OCCL_LAYER);
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
  // 스텝백 4페이즈 누적 구간(초)은 session.js가 단일 소스(마크 배치가 같은 표를 쓴다).
  //   한 루프 = 구간/배속 + 끝프레임 정지 1초.  프리뷰 = STEP_LOOPS 루프.
  //   학습(B2~B5) = 0.5배속 + 구간 끝 1초 정지 + 프리뷰 2회 / 실전(C2) = 정속·정지 없음·프리뷰 1회(유저)
  const stepRate = id => (id === 'BK_C2' ? 1.0 : 0.5);
  const stepHold = id => (id === 'BK_C2' ? 0.0 : 1.0);
  const stepLoops = id => (id === 'BK_C2' ? 1 : 2);
  const STEP_RATE = 0.5, STEP_HOLD = 1.0, STEP_LOOPS = 2;
  const stepLoopSec = id => (STEP_SEG[id] ? STEP_SEG[id] / stepRate(id) + stepHold(id) : 0);
  const stepPreviewSec = id => stepLoopSec(id) * stepLoops(id);
  // 운동중 A/B/C 지면 화면 — 세로 공통 프레임(floor-scene.html)에 stage 주입. 시작화면과 달리 중앙 발자국은 유지.
  for (const id of ['A1', 'A2', 'A3', 'P1', 'P2', 'P3', 'C2', 'C3', 'C4', 'C5',
                    'BK_A1', 'BK_A2', 'BK_A3', 'BK_B1', 'BK_B2', 'BK_B3', 'BK_B4', 'BK_B5', 'BK_C2', 'BK_C3', 'BK_C4']) {
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
  // (제거) session.frameMarkOff — 세션에 '켜지 말 스테이지' 목록을 넘기던 방식은 순서에 의존했다:
  //   session.start() 가 여기보다 4천 줄 먼저 돌아 첫 진입에서 undefined 였고, 그 1프레임에 구버전
  //   마크가 샜다. 지금은 세션이 진입 시 항상 끄고 main.js 가 켤 곳만 켠다(단방향, 순서 무관).
  // ── iframe 제거(검은 사각 플리커 근본): 3D 변환 아래 iframe은 내용 repaint마다 자체 프로세스가
  // 텍스처를 재래스터하고, 그 사이 컴포지터가 '불투명 검정' 폴백을 그린다(유저 녹화: 프레임 윤곽 그대로
  // 검은 사각 + 흰 타이틀만 잔존 = iframe 레이어의 알파 소실). 스로틀·쓰기차단·더블버퍼로도 경로가 남는 한
  // 재발했으므로, 문서를 fetch해 same-document Shadow DOM div에 주입 — iframe 래스터 경로 자체를 없앤다.
  // 스타일은 shadow 스코프로 격리(더블 버퍼 두 문서의 셀렉터 충돌 방지), <script>는 파사드로 실행.
  const _floorFontFaces = new Set();   // @font-face는 shadow 안에서 무시됨(Chrome) → 문서 head에 1회 승격
  const mkFloorFrame = () => {
    const f = document.createElement('div');
    f.style.willChange = 'transform';
    f.style.backfaceVisibility = 'hidden';
    f.attachShadow({ mode: 'open' });
    f._doc = null;   // contentDocument 파사드 — 기존 소비처(옵셔널 체이닝) 그대로 호환
    Object.defineProperty(f, 'contentDocument', { get() { return this._doc; } });
    return f;
  };
  async function loadFloorDoc(buf, url) {
    const tok = buf._loadTok = (buf._loadTok || 0) + 1;
    const html = await (await fetch(url)).text();
    if (buf._loadTok !== tok) return false;   // 더 새 로드가 시작됨 — 폐기
    const srcDoc = new DOMParser().parseFromString(html, 'text/html');
    const sr = buf.shadowRoot;
    sr.innerHTML = '';
    const abs = rel => new URL(rel, new URL(url, location.href)).href;
    // 진행 중 애니메이션 = 3D 변환 레이어(1600×2670)의 지속 재래스터 → 검정 타일 플래시의 마지막
    // 남은 발생원(유저 재보고, 진입 후 수 초 + 전환마다 타이밍 일치). 모든 애니메이션을 즉시
    // 완료시켜 최종 상태로 고정 — fill(both)이 살아 있어 디자인된 최종 투명도·배치는 그대로.
    // 복원 진단: ?anim=1
    if (new URLSearchParams(location.search).get('anim') !== '1') {
      // 전면 정지는 과잉(전환 연출·관찰 카운트다운까지 죽음 — 유저). 재래스터를 일으키는 건
      // 페인트 속성 애니메이션(width 등)뿐 — transform/opacity는 컴포지터 전용이라 무해.
      // 표적 정지: 도트 로딩바(width 애니메이션)만.
      const kill = srcDoc.createElement('style');
      kill.textContent = '.dclip{animation:none !important}';
      (srcDoc.body || srcDoc.documentElement).appendChild(kill);
    }
    // 런타임 상대경로 리베이스 — 주입 스크립트가 img.src='assets/…'를 넣으면 메인 문서 기준으로
    // 풀려 404(전환 카드 일러스트 소실, 유저). 셰도루트 옵저버로 상대 src를 프레임 기준 절대화.
    buf._srcObs?.disconnect();
    const rebaseImg = (el) => {
      if (el.tagName !== 'IMG') return;
      const v = el.getAttribute('src');
      if (v && !/^(https?:|data:|\/)/.test(v)) el.src = abs(v);
    };
    buf._srcObs = new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'attributes') rebaseImg(m.target);
        for (const n of m.addedNodes || []) { if (n.nodeType === 1) { rebaseImg(n); n.querySelectorAll?.('img[src]').forEach(rebaseImg); } }
      }
    });
    buf._srcObs.observe(sr, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
    for (const st of srcDoc.querySelectorAll('style')) {
      for (const face of st.textContent.match(/@font-face\s*{[^}]*}/g) || []) {
        const rebased = face.replace(/url\('([^']+)'\)/g, (m, u) => `url('${abs(u)}')`);
        if (_floorFontFaces.has(rebased)) continue;
        _floorFontFaces.add(rebased);
        const fs = document.createElement('style'); fs.textContent = rebased; document.head.appendChild(fs);
      }
      const s2 = document.createElement('style'); s2.textContent = st.textContent; sr.appendChild(s2);
    }
    for (const n of [...srcDoc.body.children]) if (n.tagName !== 'SCRIPT') sr.appendChild(document.importNode(n, true));
    for (const im of sr.querySelectorAll('img[src]')) {   // 상대 src → 문서(ready-view/) 기준 절대화
      const s = im.getAttribute('src');
      if (!/^([a-z]+:|\/)/i.test(s)) im.setAttribute('src', abs(s));
    }
    // <script> 실행 — document→shadowRoot·location→원 URL 파사드 (문서들은 same-origin 정적 HTML)
    const fakeLoc = new URL(url, location.href);
    const fakeDoc = {
      getElementById: id => sr.getElementById(id),
      querySelector: s => sr.querySelector(s),
      querySelectorAll: s => sr.querySelectorAll(s),
      createElement: t => document.createElement(t),
      documentElement: buf,   // floor-timer: documentElement.style.setProperty('--dur') — CSS 변수는 shadow 안까지 상속
      body: sr,
    };
    const loadCbs = [];
    const fakeWin = {   // floor*.html이 쓰는 window 표면만: load 콜백 + FLOOR_SCENES(floor-scenes.js가 세팅)
      addEventListener: (t, cb) => { if (t === 'load' && cb) loadCbs.push(cb); },
      get FLOOR_SCENES() { return window.FLOOR_SCENES; },
      set FLOOR_SCENES(v) { window.FLOOR_SCENES = v; },
    };
    for (const sc of srcDoc.querySelectorAll('script')) {
      const code = sc.getAttribute('src') ? await (await fetch(abs(sc.getAttribute('src')))).text() : sc.textContent;
      if (buf._loadTok !== tok) return false;
      try { new Function('document', 'location', 'window', code)(fakeDoc, fakeLoc, fakeWin); }
      catch (e) { console.warn('[floor-doc]', url, e); }
    }
    loadCbs.forEach(cb => { try { cb(); } catch (e) {} });
    buf._doc = fakeDoc;
    return buf._loadTok === tok;
  }
  let floorIframe = mkFloorFrame();      // 이름 유지(소비처 최소 diff) — 실체는 shadow div 버퍼
  let floorIframeBack = mkFloorFrame();
  floorIframeBack.style.visibility = 'hidden';
  // 래퍼 div가 3D 변환을 받는다 — 버퍼는 래퍼 안에 무변환 배치.
  const floorWrap = document.createElement('div');
  floorWrap.style.overflow = 'hidden';
  for (const f of [floorIframe, floorIframeBack]) {
    floorWrap.appendChild(f);
    f.style.position = 'absolute';
    f.style.inset = '0';
  }
  const floorObj = new CSS3DObject(floorWrap);
  if (typeof NO_CSS !== 'undefined' && NO_CSS) floorWrap.style.display = 'none';
  floorObj.visible = false;
  frameCssScene.add(floorObj);
  let loadedFloorView = null, loadedFloorGL = false;   // 어떤 백엔드(GL/CSS3D)가 로드했는지도 기억 — 전환 프레임 fp 공백 레이스에서 스테일 분열 방지
  // ── 바닥 UI WebGL 경로(B안, 플래그 병행) — CSS3D와 같은 변환을 받는 평면. 깊이 테스트로 x봇에 가려진다.
  //   ?floorgl=1 일 때 floor-scene.html 스테이지만 이 경로를 타고, 나머지는 기존 CSS3D 그대로.
  //   기본값 = WebGL. 되돌리려면 ?floorgl=0 (CSS3D 문서 경로가 그대로 남아 있다).
  // 지면 WebGL 경로 기본 복귀 — 고착의 진범은 GL 경로가 아니라 tickA1Coach 의 now 미정의
  //   크래시(v9 수정)였다. 응급 OFF(v8) 동안 최신 컴포넌트(배지·아크·케이던스, floorgl 전용)가
  //   구식 CSS3D 폴백으로 대체돼 보였다(유저 지적). 도피구는 ?floorgl=0 유지.
  const FLOORGL = new URLSearchParams(location.search).get('floorgl') !== '0';
  const floorGL = new FloorGL();
  // 지면 UI(제목·SPM·페이스)는 마크 판정 토큰 '앞'에 온다 — 토큰이 글자를 덮어 안 읽히던 것(유저).
  //   ★ 메시의 renderOrder 를 올려도 소용없다. three 는 (groupOrder, renderOrder, depth) 순으로
  //     정렬하고 groupOrder 는 '내려오다 만난 Group 의 renderOrder'다. 토큰은 group.renderOrder=5
  //     인 Group 아래에 있고(tokens.js) floorGL.mesh 는 scene 직속이라 groupOrder 0 —
  //     즉 자기 renderOrder 가 몇이든 토큰보다 항상 먼저 그려졌다. 그래서 Group 으로 감싼다.
  //   9 = 마크(≤6)·글리프(7)·파문(8) 위, 궤적 토큰(14) 아래.
  const floorUILayer = new THREE.Group();
  floorUILayer.renderOrder = 9;
  floorUILayer.add(floorGL.mesh);
  scene.add(floorUILayer);
  floorGL.preload();   // 진입 전에 이미지 굽기 — 첫 화면 팝 방지(녹화 대비)
  let floorGLOn = false;   // 이번 프레임에 WebGL 경로가 담당하는가
  const fdocNow = () => (floorGLOn ? floorGL.doc : floorIframe.contentDocument);
  let _uiDt = 0.016;      // loop에서 매 프레임 실시간 dt 주입 (UI 앵커 저역통과용)
  let _wasLive = false;   // 라이브 진입 에지 감지 — loopShiftZ 드리프트 재정렬용
  let _tokHidden = false;   // 바닥 토큰 층을 이 프레임에 내려놨는가(BX_C3 전용 — 에지에서만 토글)
  let _fpSmooth = null;   // 프레임·발자국 앵커용 저역통과 풋프린트 — 빔 흔들림(투사오차 지터) 제거해 글자 삐걱임 방지
  const _rV = new THREE.Vector3(), _fV = new THREE.Vector3(), _uV = new THREE.Vector3(0, 1, 0), _mBasis = new THREE.Matrix4();
  // 봇 오클루전 마스크(botOverlay)는 제거됐다 — 바닥 UI가 WebGL 평면이 되면서
  // 가림은 깊이 버퍼가 담당한다. 실루엣 캡슐이 몸보다 커서 생기던 '기괴한 마스크 자국'(유저)도 함께 소멸.
  function renderDesignFrame() {
    // 팩이 바뀌었거나 세션이 끊겼으면 로드 캐시를 비운다 → 재진입 시 t=0 부터 인트로 재생.
    // (예전엔 러닝→복싱→러닝 왕복에서 같은 src 라 재로드가 안 돼 애니메이션이 이미 끝난 상태로 보였다)
    const _sp = session.active ? session.sport : null;
    if (_sp !== _lastSport) { _lastSport = _sp; loadedView = null; loadedFloorView = null; loadedFloorGL = false; }
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
    const shown = !!view && !!wc;   // 벽 좌표 준비 전엔 숨김 — 재진입 초기 _wallCenter undefined일 때 프레임이 (0,1.4) '중앙'으로 튀는 플래시 방지
    // WebGL 경로가 담당하는 뷰면 CSS3D는 끈다(둘 중 하나만 그린다 — 이중 표시 금지)
    wallGLOn = shown && WALLGL && WallGL.handles(view);
    frameObj.visible = shown && !wallGLOn;
    wallGL.mesh.visible = wallGLOn;
    if (shown) {
      if (wallGLOn && wallGL.stage !== session.curStage?.id) loadedView = null;   // 자가 치유 — 지면과 동일 불변식
      if (view !== loadedView) {   // 다른 뷰만 로드(같은 뷰 재진입=그대로)
        const dur = STAGE_DUR[session.curStage?.id] ?? session.curStage?.dur ?? 8;
        const needsDur = view.includes('scene.html') || view.includes('timer.html');
        if (wallGLOn) wallGL.load(session.curStage?.id, { dur, src: view });
        else frameIframe.src = import.meta.env.BASE_URL + view + (needsDur ? '&dur=' + dur : '');
        loadedView = view;
      }
      if (wallGLOn) wallGL.update(_uiDt);
      // 매 프레임 벽 정합 — 대지 2600×1600 → 벽(wallW×wallH), x/y 독립 스케일(aspect 무관, 이식 안전)
      frameObj.position.set(wc.cx, wc.cy, WALL_Z + 0.02);
      frameObj.rotation.set(0, 0, 0);
      frameObj.scale.set(rig.wallW / FRAME_W, rig.wallH / FRAME_H, 1);
      // UI 평면은 demoPanel(주황 전문가, +0.035)·판정 토큰보다 앞 — CSS3D 시절의 쌓임 순서를 지킨다.
      // x봇은 standZ(1.6m)에 서므로 여전히 UI를 가린다(이 이식의 목적).
      wallGL.mesh.position.set(wc.cx, wc.cy, WALL_Z + 0.05);
      wallGL.mesh.quaternion.copy(frameObj.quaternion);
      wallGL.mesh.scale.copy(frameObj.scale);
      // 구 UI 선별 숨김 — 유지: demoPanel(주황 전문가)·격자 배경 / 숨김: 세션 큐
      // (거울"나"·HUD 는 제거됨 — 여기서 매 프레임 숨기던 것이 곧 죽어 있었다는 증거였다)
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
        [session.paceLight, session.countGroup, session.countRing,
         session.wSlotFS, session.wSlotFL, session.wSlotFM, session.wCount]
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
    const fView = isFloorSport ? FLOOR_FRAMES[session.curStage?.id] : null;   // 실전도 기본 타이틀 구조는 유지(유저)
    const fp = rig._fp;   // 무릎 투사 풋프린트 (rig.update가 매 프레임 세팅)
    // WebGL 경로가 담당하는 스테이지면 CSS3D는 끈다(둘 중 하나만 그린다 — 이중 표시 금지).
    floorGLOn = FLOORGL && !!fView && !!fp && FloorGL.handles(fView.src);
    const floorShown = !!fView && !!fp;
    floorObj.visible = floorShown && !floorGLOn;
    floorObj.userData.shown = floorShown;   // 코치 패널 등 '프레임 기준계' 소비처용(경로 무관)
    floorGL.mesh.visible = floorGLOn;
    // 👁 커버리지 채움판(footFill, 원시 빔 추종)과 플로어 프레임(저역통과 앵커)이 같은 자리에
    // 미세 오프셋 2겹으로 보임(유저) → 프레임 표시 중엔 채움판 숨김, 빔 라인(floorBeam)은 유지
    if (rig.footFill) rig.footFill.visible =
      (state.pack === 'running' || state.pack === 'basketball') && rig.visualize !== false && !floorShown;
    // 시작 페이지(READY/BK_READY)=발자국까지 전부 숨김(UI 전담). A/B/C 운동중=발자국은 콘텐츠라 유지, 프레임은 헤더만 대체.
    const isStartPage = session.curStage?.id === 'READY' || session.curStage?.id === 'BK_READY';
    // ★ 옛 3D UI 숨김의 기준은 '프레임이 준비됐나(floorShown)'가 아니라 '이 스테이지가 프레임을 쓰나(fView)'다.
    //   floorShown 은 rig._fp(무릎 투사 풋프린트)를 기다리는데 그건 부팅·스테이지 진입 직후 몇 프레임 비어 있다.
    //   그 창에서 숨김이 아예 안 돌아 구버전 UI(슬롯 텍스트 "CURRY · STEP-BACK 3"·"READY" / TAP 원 / 발자국 마크)가
    //   새어 보였다(유저: 모든 바닥 UI에서 로딩 때 샌다). 모든 바닥 스테이지·두 종목 공통 문제였다.
    const floorWanted = !!fView;
    // 전환·타이머·리포트 = 풀스크린 지면 그래픽 → 옛 운동 3D UI 전부 숨김(겹침 방지).
    const fullFrame = floorWanted && /floor-(transition|timer|report)\.html/.test(fView.src);
    // ★ 발자국 판정 마크(G그룹) 표시 — **여기가 유일한 출처다. 반드시 매 프레임 무조건 돈다.**
    //   세션은 진입 시 끄기만 하므로(session.js _enter), 켜는 쪽이 하나라도 안 돌면 마크는
    //   영영 안 보인다. 예전엔 켜는 줄이 `if (floorShown)` 안에만 있었다 — floorShown 은
    //   ① 러닝·농구이고 ② rig._fp(무릎 투사)가 준비된 프레임에서만 참이라,
    //   **복싱은 영구히 꺼지고** 지면 종목도 진입 직후 몇 프레임은 꺼졌다
    //   (유저 08-04: "모든 mark 판정 토큰들이 다 사라진 상태"). 조건 안에 두지 말 것.
    //   숨기는 경우는 하나뿐: 지면 프레임이 화면을 전담할 때(시작 페이지·전환/타이머/리포트).
    const gStage = session.G && session.G[session.curStage?.id];
    if (gStage) gStage.visible = !(floorWanted && (isStartPage || fullFrame));
    // 팩 판정 토큰 필드 표시 정책(단일 소스): 세션 중엔 라이브에만, 릴리즈(C4)는 슛 집중 위해 제외.
    // 비실전(스트레칭·전환·리포트)에 무관한 마커가 떠 있던 근본(유저 전 화면 검수 지적).
    // 농구 실전(BK_C2)은 마크 판정 토큰만 쓴다 — 팩 판정 필드(레인·존)는 끈다(유저).
    if (isFloorSport) tokens.floorRoot.visible = !(floorWanted && (isStartPage || fullFrame))
      && (!session.active || (session.isLive && session.stage !== 'BK_C4' && session.stage !== 'BK_C2'));
    // 프레임이 헤더(타이틀·큐·페이즈)를 담으므로 발자국 아래 3D 보조 텍스트 슬롯 전부 숨김(중복 제거, 유저).
    //   여기가 단일 출처 — 예전엔 이 블록이 if (floorShown) 안에 있어서 로딩 중엔 안 돌았다.
    if (floorWanted) {
      [session.countGroup, session.countRing].forEach(o => { if (o) o.visible = false; });
      // 라이브(C 실전)는 _paceTick이 광점·페이스레인을 매 프레임 관리 — 프레임 켜져도 끄지 않음(러닝·판정 비주얼 유지).
      if (!session.isLive && session.paceLight) session.paceLight.visible = false;
      if (fullFrame) {
        [session.a1arc, session.a1L, session.a1R, session.a3foot, session.paceLane, session.paceLight,
         ...(session.a3zones || []), ...(session.paceFeet || []).map(f => f && f.group), ...(session.a2 || []).map(a => a && a.pg)]
          .forEach(o => { if (o) o.visible = false; });
      }
      // (마크 G그룹 표시는 위 gStage 한 줄이 단일 출처 — 여기서 또 만지지 않는다)
    }
    // 실전(BK_C2)은 지면 프레임 타이틀만 쓰고, 세션이 그리는 위/아래 큐 텍스트는 끈다(유저).
    if (session.active && session.stage === 'BK_C2') {
      [session.countGroup, session.countRing].forEach(o => { if (o) o.visible = false; });
    }
    if (floorShown) {
      // ★ 자가 치유 불변식 — 어떤 레이스 경로로 꼬였든, GL 캔버스가 그리는 스테이지가
      //   세션 스테이지와 다르면 무조건 재로드한다(유저: 화면이 이전 스테이지에 얼어붙음 반복).
      //   개별 레이스를 하나씩 막는 방식은 두 번 실패했다 — 결과 상태를 매 프레임 검증하는 게 정답.
      if (floorGLOn && floorGL.stage !== session.curStage?.id) loadedFloorView = null;
      if (fView.src !== loadedFloorView || floorGLOn !== loadedFloorGL) {
        const dur = STAGE_DUR[session.curStage?.id] ?? session.curStage?.dur ?? 8;
        const _sid2 = session.curStage?.id;
        const pv = stepPreviewSec(_sid2), pvn = pv ? stepLoops(_sid2) : 0;
        if (floorGLOn) {
          floorGL.load(_sid2, { dur, pv: pv || 3, pvn, src: fView.src });
        } else {
        floorWrap.style.width = fView.w + 'px';    // 래퍼가 CSS3D 변환·크기의 주체
        floorWrap.style.height = fView.h + 'px';
        const pvSuffix = pv ? `&pv=${pv.toFixed(2)}&pvn=${pvn}` : '';
        const durSuffix = fView.src.includes('floor-scene.html') ? '&dur=' + dur + pvSuffix : '';
        // 더블 버퍼 교체 — 새 문서는 뒤 버퍼(shadow div)에 주입되고, 완성된 뒤에만 앞으로 나온다(검은 공백 0)
        const back = floorIframeBack;
        back.style.width = fView.w + 'px';
        back.style.height = fView.h + 'px';
        loadFloorDoc(back, import.meta.env.BASE_URL + fView.src + durSuffix).then(ok => {
          // ★ 자가 치유(CSS3D 판) — 실패·유실 로드는 loadedFloorView 를 풀어 다음 프레임에 재시도.
          //   예전엔 로드 시작 시점에 래치를 걸어 놔서, 스왑이 유실되면(전환 레이스) 빈 지면이
          //   '이미 로드됨'으로 영영 남았다(유저: 러닝 훈련·실전 케이던스·아치 HUD 실종의 정체).
          if (!ok || back !== floorIframeBack) { loadedFloorView = null; return; }
          back.style.visibility = '';
          floorIframe.style.visibility = 'hidden';
          const t = floorIframe; floorIframe = back; floorIframeBack = t;
        });
        }
        loadedFloorView = fView.src; loadedFloorGL = floorGLOn;
        _fpSmooth = null;   // 스테이지 전환 = 앵커 스냅(슬라이딩 방지)
      }
      if (floorGLOn) floorGL.update(_uiDt);
      // ★ 지면 UI 위상을 세션에 넘긴다 — floorGL 은 **자기 시계**로 돈다(씬 프리뷰에서 특히).
      //   실측: session.t%8 = 4.76 일 때 floorGL.t%8 = 0.25. 발자국만 세션 시계를 보고 있어서
      //   하단 패널·CTA(플로어 시계)와 영영 안 맞았다(유저 3회 신고). 한 시계로 통일한다.
      if (floorGLOn) session.readyPhase = (floorGL.t || 0) % 8;
      else session.readyPhase = null;
      // 읽는 UI(프레임·발자국)는 빔 흔들림(투사오차 지터, 무릎 각속도 비례 — 다리 스윙 때 최대)을 그대로
      // 따르면 글자가 삐걱임(유저). 앵커를 저역통과(≈90ms 시정수)해 인물 총체 이동만 남기고 지터 제거.
      // 빔·토큰은 원본 rig._fp 그대로라 '정직한 흔들림' 유지 — 읽기용 콘텐츠만 안정화.
      if (!_fpSmooth) _fpSmooth = { ox: fp.ox, oz: fp.oz, fx: fp.fx, fz: fp.fz };
      // 큰 점프(스테이지 전환 텔레포트, 실전 드리프트→FIN 원점)는 즉시 스냅 — 안 하면 리포트가 멀리서 쓔욱 따라옴(유저 영상).
      // 작은 지터(러닝 다리 스윙 각속도)만 저역통과(≈50ms)로 안정화.
      const _jump = Math.hypot(fp.ox - _fpSmooth.ox, fp.oz - _fpSmooth.oz);
      // ★ 앵커 시정수는 **모드가 정한다**(유저 08-05: 제자리 뷰에서 발자국이 따로 논다).
      //   ① 실전(달림) = 12ms — 빔·카메라(원본 rig._fp)와 같은 위상. 예전 50ms 는 다리 스윙
      //      3Hz 에서 ~54° 지연이라 지면 그림이 빔 위에서 미끄러졌다.
      //   ② 제자리(비실전: 스트레칭·학습) = 0.7s — 런지·하이니처럼 무릎이 크게 움직이면 투사
      //      풋프린트가 그만큼 헤엄쳐 지면 UI 가 몸 따라 출렁였다. 사람이 제자리에 서 있는
      //      장면에서는 지면 그림이 **바닥에 붙어 있어야** 맞다. 시야만 흔들리고 그림은 고정.
      const _inPlace = session.active && !session.isLive;
      const aUI = _jump > 1.0 ? 1 : (1 - Math.exp(-_uiDt / (_inPlace ? 0.7 : 0.012)));
      _fpSmooth.ox += (fp.ox - _fpSmooth.ox) * aUI;
      _fpSmooth.oz += (fp.oz - _fpSmooth.oz) * aUI;
      _fpSmooth.fx += (fp.fx - _fpSmooth.fx) * aUI;
      _fpSmooth.fz += (fp.fz - _fpSmooth.fz) * aUI;
      const _fl = Math.hypot(_fpSmooth.fx, _fpSmooth.fz) || 1;
      const sfp = { ox: _fpSmooth.ox, oz: _fpSmooth.oz, fx: _fpSmooth.fx / _fl, fz: _fpSmooth.fz / _fl };
      sfp.rx = -sfp.fz; sfp.rz = sfp.fx;   // right = (-fwd.z, fwd.x) — projector와 동일 규약
      const dMid = (rig.fpNear + rig.fpFar) / 2;   // 발자국·토큰 밴드 앵커용(아래 stageG에서 사용)
      // 균일 스케일(비율 유지) — 폭=커버리지 레인폭(투사 범위 유지, 유저: 범위 조정 금지).
      const laneW = 2 * rig._halfAt(dMid);
      // ★ 투사 비율 = 전 스테이지 동일(유저: 시작화면만 비율이 달라지면 안 됨 — A1 비율이 정답).
      //   콘 길이 맞춤(covL min)은 시작화면만 작게 만들어 철회. 콘 밖으로 새는 하단은
      //   캔버스 콘텐츠 스케일/앵커(floorgl r2.scale·pivot)로 캔버스 안에서 해결한다.
      const sUni = laneW / fView.w;
      // UI 프레임 전방위치 = 타이틀(board-y 176)이 커버리지 far끝(빨간 투사 끝라인 ≈ fpFar) 아래 고정 간격(0.12m)에 오도록.
      //   → 빨간 끝라인에서 타이틀까지 내려오는 거리를 전 스테이지 동일하게(유저 image 21). 대지 중심 앵커(dMid)가 아니라 far끝 기준.
      // ★ far 앵커 고정 — 전진 오프셋은 두 번 다 커버리지 이탈을 냈다(08-05 재발). 절대 더하지 말 것.
      const boardFwd = (rig.fpFar - 0.12) - (1335 - 176) * sUni;
      const cx = sfp.ox + sfp.fx * boardFwd, cz = sfp.oz + sfp.fz * boardFwd;
      // 로컬축 → 월드: 대지 폭(+X)→풋프린트 우측, 대지 높이(+Y=위쪽/제목)→전방(far), 법선(+Z)→상방.
      _rV.set(sfp.rx, 0, sfp.rz); _fV.set(sfp.fx, 0, sfp.fz);
      _mBasis.makeBasis(_rV, _fV, _uV);
      floorObj.quaternion.setFromRotationMatrix(_mBasis);
      floorObj.position.set(cx, 0.012, cz);
      floorObj.scale.set(sUni, sUni, 1);
      // ★ READY 발자국은 **대지(캔버스) 좌표계**에 붙인다(유저 #138). 고정 로컬 z(-0.75)로 두면
      //   리그가 도는 종목에서 통째로 어긋난다 — 실측: 러닝 대지 yaw 0°·z -1.08 / 농구 yaw -173.7°·
      //   z +1.41 인데 발은 양쪽 다 z -0.75 라, 농구에선 대지에서 2.5m 밖에 따로 놓여 있었다.
      //   캔버스 발자국 중심 y1821 = CTA 슬롯과 같은 띠. 회전도 대지와 같이 준다.
      {
        const RF = session.readyFeet;
        if (RF && RF.length) {
          const dF = (1335 - 1821) * sUni;              // 대지 중심(1335) 기준 앞뒤 오프셋
          const SPREAD = 0.189;                          // = FootMark.READY_SPREAD (피그마 342:3057)
          for (let i = 0; i < RF.length; i++) {
            const dX = (i === 0 ? -1 : 1) * SPREAD;
            RF[i].group.position.set(cx + sfp.fx * dF + sfp.rx * dX, 0.013,
                                     cz + sfp.fz * dF + sfp.rz * dX);
            RF[i].group.quaternion.copy(floorObj.quaternion);   // 대지와 같은 자세(눕힘+요)
          }
        }
      }
      // WebGL 평면 = 같은 변환(CSS3D는 요소 +Y가 화면 아래 = 로컬 -Y라 평면 지오메트리와 축이 일치한다)
      floorGL.mesh.quaternion.copy(floorObj.quaternion);
      floorGL.mesh.position.copy(floorObj.position);
      floorGL.mesh.scale.copy(floorObj.scale);
      // 지면 UI 텍스트 구간엔 마크 토큰 광을 쏘지 않는다 — 토큰이 글자 위를 지나며 가독성을
      //   무너뜨리던 것(유저). 레이어 순서로 앞뒤는 이미 갈렸고, 이건 그 뒤로 지나가는 토큰을
      //   블러 마스크로 깎아 '은은하게' 만드는 쪽. 텍스트가 없는 프레임이면 amt 0 = 무효.
      UI_MASK.amt = 0;
      if (floorGLOn) floorGL.uiMask(UI_MASK);
      session.frameSlots = null;   // 슬롯 카드 레이아웃 은퇴(유저: 시범→따라하기 순차 문법으로 확정)
      try {
        // 라이브(B 페이스·C 실전) = 최소 UI(유저): 진입 2.5s 후 타이틀·큐·도트 페이드 — 판정 큐만 남김.
        const doc = fdocNow();
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
      // 슬롯·풀스크린 숨김은 위 floorWanted 블록이 단일 출처로 담당한다(로딩 중에도 돌아야 해서 밖으로 나갔다).
      // 발자국 판정 마크(G그룹) 정렬. 시작 페이지·풀스크린 프레임=숨김.
      const stageG = session.G && session.G[session.curStage?.id];
      if (stageG) {
        // 표시 여부는 위 gStage 한 줄이 정한다(단일 출처). 여기는 **정렬만** 한다 —
        //   이 블록은 floorShown(러닝·농구 + rig._fp 준비)에서만 도는데, 표시까지 여기서
        //   정하면 복싱과 진입 직후 프레임에서 마크가 통째로 사라진다.
        if (isStartPage || fullFrame) {
          /* 프레임이 화면 전체를 갖는다 — 정렬도 불필요 */
        } else if (session.isLive) {
          // 실전(라이브)은 세션 root가 인물 이동을 추종 — G그룹은 저작 기본(원점·무회전) 유지.
          stageG.position.set(0, 0, 0); stageG.quaternion.identity();
        } else if (/^(A1|BK_A2|BK_A3|BK_B1|BK_B2|BK_B3)$/.test(session.curStage?.id || '')) {
          // 봇-정합 스테이지: 재앵커(밴드 시프트) 제외 + 스테이지별 전방 오프셋만 —
          // 투사 법칙(가이드는 서기 앞 0.4~2.1m 창 안): 실측 감사에서 B1 28/30·B2 16/17
          // 메쉬가 존 밖(반달 절단)이라 필드 통째 전진. 원점 고정이 여기서 오프셋을 매 프레임
          // 지우고 있었으므로 오프셋을 이 브랜치가 직접 소유한다(단일 출처).
          // 봇을 -1.15 → 0으로 되돌린 만큼(+1.15) 가이드 필드도 당겨온다. 안 당기면 토큰이 투사창
          // far 경계로 밀려 지면 UI 제목 줄 위에 겹친다(유저 신고). 봇 기준 원래 거리 복원:
          //   A2 = 0.70m 앞(-1.85+1.15) · A3 = 1.10m 앞(유저: 제목·도트 줄에서 더 떨어뜨려 안정 배치)
          //   A3 링은 헤일로가 커서 0.52m 이격으로는 도트 줄과 붙어 보였음 → 0.97m 이격
          const FWD = { BK_A2: 0.80, BK_A3: 0.75 };   // B단계 신설계는 BK_STAND(봇 발밑) 기준 저작 — 시프트 불필요
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
    if (session.active && (!session.isLive || session.stage === 'BK_C4' || session.stage === 'BX_C2')) tokens.floorRoot.visible = false;
    // 항상 렌더 — 표시/숨김 전환에도 CSS3D transform 항상 동기(재진입 시 위치 어긋남·잔류 방지)
    cssRenderer.render(frameCssScene, camera);
    // ── 바닥 프레임 occlusion: x봇만 투명 오버레이로 프레임(z6) 위(z7)에 다시 그려 다리 뒤로 밟히게 ──
    renderFloorOcclusion(floorObj.visible);
  }

  // 셰이더 선컴파일 — 첫 화면이 유독 버벅이던 진짜 이유.
  //   마크·인물·발자국·풋마크 셰이더는 '처음 그려지는 프레임'에 컴파일된다. 세션에 들어가는
  //   순간 수십 개가 한꺼번에 컴파일되면서 프레임이 통째로 멈춘다(GPU 드라이버 동기 작업이라
  //   rAF가 그 자리에서 막힌다). 에셋만 미리 구워봐야 이건 안 없어진다.
  //   compile()은 traverse(=숨긴 것 포함)라 아직 안 보이는 UI·토큰 재질까지 함께 굽는다.
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('[Newton] precompile:', e); }
  loop();
}

boot().catch(err => {
  console.error('[Newton] boot failed:', err);
  document.getElementById('loading').innerHTML =
    `<span style="color:#ff5c8a">로드 실패: ${err.message}</span>`;
});
