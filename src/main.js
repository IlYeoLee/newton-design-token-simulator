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
import { getLUT, FXP, rebuildLUT, lutColor, GLYPHS, FX_GLSL } from './fxlut.js';
import { createEditor3D } from './editor3d.js';
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
  const { renderer, scene, camera, controls, setPackEnvironment, resize, renderFrame, setSurfaces, setDaylight, followFloor, setRenderCamera } = createScene(stage);

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
          if (dlab.arrow) {
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
  const STAGE_GAZE_DEG = { A: -42, B: -38, T: -30, C: -18 };
  function sessionGazeTarget() {
    // 벽 종목(복싱): 시선은 벽 정면 — 코치(y≈1.0~1.7)·타겟(y≈1.14)이 전부 시야에 안정적으로.
    // 눈높이 1.6m·벽앞 1.75m 기준 -8° ≈ 벽 중심 응시 (버그였음: 'BX_'의 B가 익히기 -38°로 매칭돼 바닥만 봄)
    if (session.curStage?.wall) return -8;
    const id = session.curStage?.id || '';
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
    const standZ = zU + dCamReq;                               // 유저가 서야 할 z (유닛 뒤)
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
    setFPView(on);   // 1인칭 가독 보정 — 순번 감쇠 완화 + 마크·레인 게인 (시선 각도 눌림)
    setBtnActive(fpBtn, fpMode);
    controls.enabled = !fpMode;
    // 진짜 눈 시점: 자기 몸은 시야를 가리지 않음 + 인간 유효 시야각
    xbot.model.visible = !fpMode;
    // 1인칭 화각 = 종목별: 복싱(제자리·벽 응시)은 사람 체감에 맞게 좁게 —
    // 85° 광각은 모니터에서 3.4m 벽 투사(실제 체감 36°=1.5m 앞 55인치 TV급)를 과소하게 보이게 함
    camera.fov = fpMode ? (state.pack === 'boxing' ? 58 : 85) : 50;
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
  const FP_FWD_FIXED = new THREE.Vector3(0, 0, -1);   // 세션 1인칭 시선 방위 (전 종목 전방 -z)

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
    captionEl.innerHTML = `<b>🔊 ${who}</b> · ${text}`;
    captionEl.style.opacity = '1';
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { captionEl.style.opacity = '0'; }, 4500);
  }
  const sessionHud = document.getElementById('session-hud');
  const hudStageEl = document.getElementById('hud-stage');
  const hudIdxEl = document.getElementById('hud-idx');
  // 세션이 판정 오차를 소비 (페이스 라이트 = 타이밍 오차의 공간 번역, C3 흔들림 시연)
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
    // 스테이지 라벨을 바닥에 문장으로 깔던 상태 슬롯 은퇴 — 세션 HUD 카드 + 세션 FS 슬롯('LEARN 3/4')과
    // 3중 중복이었고 발자국·가이드를 덮는 두 번째 주범. 투사면 = 훈련 큐 전용 원칙.
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
  session.judge = judge;   // 판정 오차 소비 (페이스 라이트·FIN 겹쳐보기·C3 흔들림)
  // 단계 중간 음성 큐 — 시범→실행 전환("이제 같이") 등 코칭 3층 문법의 동작 큐 채널
  session.say = (who, line) => { showCaption(who, line); speak(who, line, 'cue:' + line.slice(0, 16)); };
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
    session.start(sport);
    panel.setPlaying(true, true);
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
    // 세션 중지 = 데모 루프 재개 — 일시정지 잔존으로 봇이 얼어 보이던 문제
    state.playing = true;
    document.getElementById('pause-chip')?.style.setProperty('display', 'none');
    panel.setPlaying(true, false);
    if (sessionStageEl) sessionStageEl.textContent = '—';
    if (sessionHud) sessionHud.style.display = 'none';
    sceneUI.setStatus('');
    sceneUI.setInstruction('');
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
    const SURF_DEFS = [['none', '다크'], ['grass', '잔디'], ['track', '트랙'], ['paving', '보도블럭']];
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
      ${metaRow('WEAR', st.wear, '#8fd8df')}
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
        uTime: { value: 0 }, uNoise: { value: 0.55 }, uW: { value: 1 }, uDetail: { value: 0.62 }, uTrailGain: { value: 1 }, uGrain: { value: 0 }, uTone: { value: 0 },
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
        uniform sampler2D uTrail, uLUT, uHeat; uniform float uTime, uNoise, uW, uDetail, uTrailGain, uGrain, uTone;
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
          // 얼굴 대역(상단) = 이목구비 의도적 은닉 — 실사 결 제거 + 강한 확산
          float faceW = smoothstep(0.70, 0.84, uv.y) * (1.0 - smoothstep(0.965, 1.0, uv.y));
          T = clamp(T + (dlum - 0.5) * uDetail * 0.3 * m * (1.0 - faceW), 0.0, 1.0);
          T = max(T, trail * 0.6);
          // 형태: 몸 = 크리스프 실루엣 + 약한 확산 헤일로 / 얼굴 = 확산 필드만 (블러 블롭)
          float soft = clamp(H * 1.55, 0.0, 1.0);
          float shape = mix(max(m * 0.85, soft * 0.28), soft, faceW);
          shape = max(shape, trail * 0.5);
          vec3 col = mix(thermo(T), lut(clamp(T * 0.96, 0.0, 1.0)), uTone) * shape;   // 뉴턴톤 기본 = 룩 팔레트
          col += (fxhash(uv * 977.0 + uTime) - 0.5) * (2.0 / 255.0);
          col += (fxhash(uv * 1661.0 + uTime * 3.0) - 0.5) * uGrain;
          // 검은 필드 = 패널 전체 차폐 (레퍼런스: 흑 배경 위 발광) — 가장자리만 페이드
          float field = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x)
                      * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
          col *= field;
          // 컴포저 OutputPass(linear→sRGB) 역변환 상쇄 (tokens.js uOut=1 규약)
          col = clamp(col, 0.0, 1.0);
          col = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
          gl_FragColor = vec4(col, field * 0.92);   // 프리멀티: 벽 차폐 후 가산 = 랩 합성식
        }`,
      transparent: true, depthWrite: false,
      // out = col + dst·(1−a) — 랩의 base·(1−a·0.88)+col 과 동일 (프리멀티 커스텀 블렌딩)
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  demoPanel.rotation.x = -Math.PI / 2;
  demoPanel.position.set(0, 0.016, -1.45);
  demoPanel.renderOrder = 7;
  demoPanel.visible = false;
  scene.add(demoPanel);
  let demoLastT = 0;
  const demoCrop = { cx: 0.5, cy: 0.5, sx: 1, sy: 1 };
  // 실사 시범 모드: 'off' | 'floor'(러닝 A 시범 — 휴면) | 'wall'(복싱 벽 실사 시험).
  // 실시간 세그 실사는 기각(구멍·플리커·프레임 드랍 — 스톡 다수로 실증). 'wall'은
  // 사전에 매트를 구운 소스(알파 영상/스틸 시퀀스)가 준비된 경우에만 켠다.
  const DEMO_CLIP_MODE = 'wall';   // 크로마 코치 가동 (그린스크린 실사 — Magnific/Freepik 무료)
  const GHOST_H = 2.0;             // 고스트 패널 세로(m) — 인물 여백 10% 감안 실키 ≈1.75m
  // ── 스테이지별 고스트 클립 (유저 AI 크로마 소스 반입 지점) ──────────────────
  //    public/ghost/<파일명>에 떨어뜨리면 코드 수정 없이 스테이지 전환 시 자동 교체.
  //    파일 없음(404) → 기본 클립 폴백. 스펙·프롬프트 = docs/ghost-clips.md
  const GHOST_DEFAULT = import.meta.env.BASE_URL + 'coach_chroma.mp4';
  //    맵에 없는 스테이지(BX_T1 전환·BX_FIN 리포트) = 고스트 자체를 안 띄움 (인물 불필요 장면)
  const GHOST_CLIPS = {
    BX_READY: ['bx_idle_guard.mp4', '상대 대기 — 가드 바운스'],
    BX_A1:    ['bx_warm_neck.mp4', '시범 — 목·어깨 풀기'],
    BX_A2:    ['bx_warm_step.mp4', '시범 — 스텝 인·아웃'],
    BX_A3:    ['bx_warm_jab.mp4', '시범 — 잽 폼 6회'],
    BX_B1:    ['bx_opp_jab_slow.mp4', '상대 — 느린 잽 (가드 버티기)'],
    BX_B2:    ['bx_opp_straight.mp4', '상대 — 스트레이트 (슬립)'],
    BX_B3:    ['bx_opp_opening.mp4', '상대 — 가드 열림 (잽 타이밍)'],
    BX_T2:    ['bx_idle_bounce.mp4', '상대 — 대련 직전 바운스'],
    BX_C1:    ['bx_idle_bounce.mp4', '상대 — 대련 직전 바운스'],
    BX_C2:    ['bx_spar_live.mp4', '상대 — 잽 대련 리듬'],
    BX_C3:    ['bx_spar_combo.mp4', '상대 — 잽잽훅 콤비'],
    BX_C4:    ['bx_cooldown.mp4', '상대 — 마무리 호흡'],
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
    demoPanel.scale.set(GHOST_H * (9 / 16) / 0.62, GHOST_H / 0.93, 1);
    demoVideo.addEventListener('loadedmetadata', () => {
      const A = 9 / 16, va = demoVideo.videoWidth / demoVideo.videoHeight;
      const s = va > A ? [A / va, 1] : [1, va / A];
      trailMat.uniforms.uCropS.value.set(s[0], s[1]);
      heatMaskMat.uniforms.uCropS.value.set(s[0], s[1]);
      demoPanel.material.uniforms.uCropS.value.set(s[0], s[1]);
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
      // 전신 스탠딩: 패널 바닥 = 벽 투사 하단 (발이 잘리지 않게 — 실물 키 스케일의 전제)
      const wallBot = (wc?.cy ?? 1.4) - rig.wallH / 2;
      demoPanel.position.set(wc ? wc.cx : 0, wallBot + GHOST_H / 2 + 0.01, WALL_Z + 0.035);
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
          gl_FragColor = vec4(col, 1.0);   // 가산: 검정 = 무기여 (라이브 출력 규약)
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
      tokens.update(0, 0);
      xbot.playDemo(demoClipFor(session.sport, session.stage), h);
      rig.update(0, h);
      tokens.setShake(rig.shake.x, rig.shake.y);
      // 이 분기는 아래 followFloor 호출을 건너뛰어(early return) 무한 지면(그리드·바닥)이
      // 세션 시작 직전 스튜디오 대기 루프가 드리프트시킨 옛 z에 멈춰있었음 — 1인칭 카메라는
      // xbot의 새로 리셋된 위치를 따라가는데 바닥만 수백m 밖에 남아 "그냥 뿌옇게"(사실은 바닥
      // 자체가 시야 밖) 보였던 원인. READY/준비 단계에서도 동기화.
      if (data.sport === 'running') followFloor(xbot.group.position.z);
      return;
    }
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
    rig, xbot, state, session, sceneScope, camera, controls, tokens, effects, scene, editor3d, sceneUI, FXP, designStore, TCFG, editCam, editControls, judge, THREE,
    renderer, demoVideo, renderDemoPanel, renderBxPerson,
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
        // 세션 중엔 시선 방위 고정(-z 전방) — 데모 봇의 골반 회전(제자리 달리기·걷기)이
        // 카메라를 좌우로 요잉시켜 프레임을 무너뜨리던 문제. 피치는 세션 단계값이 계속 담당.
        const fwd = session.active ? FP_FWD_FIXED : xbot.getForward();
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
    // 장비 시각화(인식 볼륨·최적 링)는 커버리지 시각화와 같은 층 — 실물 뷰(👁)에선 숨김.
    // 훈련 장면의 주인공은 투사 UI: 설비 설명 그래픽이 큐를 압도하지 않는다.
    const boxOn = state.pack === 'boxing' && !fpMode && rig.visualize !== false;
    trackVol.visible = trackEdge.visible = boxOn;
    optRing.visible = camMark.visible = boxOn;

    // 농구 방향·리듬 큐 — 렌더는 전부 카탈로그 토큰 (화살표 촉·자루는 tickFlowArrows가 급이)
    const bkOn = state.pack === 'basketball' && rig._fp;
    bkArrow.visible = bkLane.visible = bkOn;
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
    session.tickWaves();              // 스테이지 파동 링 시계 (프리뷰 포함)
    renderGhostLayer();
    renderDemoPanel();   // A 시범 구간 실사 클립 (휴면)
    renderBxPerson();    // 복싱 벽면 인물 시범 (정본 포트)
    renderFrame(clock.elapsedTime);   // 블룸 + 그레인·비네트 컴포저 (scene.js FX)
  }
  loop();
}

boot().catch(err => {
  console.error('[Newton] boot failed:', err);
  document.getElementById('loading').innerHTML =
    `<span style="color:#ff5c8a">로드 실패: ${err.message}</span>`;
});
