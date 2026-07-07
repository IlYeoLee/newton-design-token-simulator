import * as THREE from 'three';
import { createScene, WALL_Z } from './scene.js';
import { TokenSystem } from './tokens.js';
import { Effects } from './effects.js';
import { XBot } from './xbot.js';
import { Panel } from './panel.js';
import { ProjectorRig } from './projector.js';
import { WallGhost } from './ghost.js';
import { Judge } from './judge.js';
import { Session } from './session.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;
const PACK_FILES = {
  running: `${BASE}packs/running_cadence_real.json`,
  boxing: `${BASE}packs/boxing_jab_real.json`,
  basketball: `${BASE}packs/basketball_cutin_real.json`,
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
  const { renderer, scene, camera, controls, setPackEnvironment } = createScene(stage);

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

    // 팩별 투사면 기본값 — 농구 컷인은 더 먼 풋프린트 필요
    const farEl = document.getElementById('s-fpfar');
    farEl.value = data.sport === 'basketball' ? 400 : 300;
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
    xbot.model.visible = !fpMode && !(session.active && session.stage !== 'REAL');
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
  bindSlider('s-skill', 'v-skill', v => `${v}%`, v => { judge.skill = v / 100; });
  bindSlider('s-pitch', 'v-pitch', v => `${v}°`, v => { gazePitch = THREE.MathUtils.degToRad(v); });
  bindSlider('s-fpnear', 'v-fpnear', v => `${v}cm`, v => rig.setFootprint(v / 100, rig.fpFar));
  bindSlider('s-fpfar', 'v-fpfar', v => `${v}cm`, v => rig.setFootprint(rig.fpNear, v / 100));
  bindSlider('s-wallw', 'v-wallw', v => `${v}cm`, v => { rig.setWallSize(v / 100, rig.wallH); if (state.pack === 'boxing') computeStation(); });
  bindSlider('s-wallh', 'v-wallh', v => `${v}cm`, v => { rig.setWallSize(rig.wallW, v / 100); if (state.pack === 'boxing') computeStation(); });

  // ── 세션 흐름 프로토 (러닝) — 와이어프레임 v2 A→B→C ──
  const sessionStageEl = document.getElementById('session-stage');
  const captionEl = document.getElementById('voice-caption');
  let captionTimer = null;
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
    if (st.voice) showCaption(st.voice[0], st.voice[1]);
  });
  const sessionBtn = document.getElementById('btn-session');
  function stopSession() {
    if (!session.active) return;
    session.stop();
    sessionBtn.textContent = '세션 시작 (1인칭 전환)';
    if (sessionStageEl) sessionStageEl.textContent = '—';
    if (sessionHud) sessionHud.style.display = 'none';
    setFp(false);           // 중단 → X봇 3인칭 복귀
  }
  sessionBtn?.addEventListener('click', () => {
    if (session.active) { stopSession(); return; }
    if (state.pack !== 'running') switchPack('running');
    state.time = 0; tokens.resetLoop();
    session.start();
    sessionBtn.textContent = '세션 중지';
    if (sessionHud) sessionHud.style.display = 'block';
    setFp(true);            // 시작 → 자동 1인칭 전환
  });
  document.getElementById('btn-tap')?.addEventListener('click', () => session.tapAdvance());
  document.getElementById('btn-stage-prev')?.addEventListener('click', () => session.prev());
  document.getElementById('btn-stage-next')?.addEventListener('click', () => session.next());
  document.getElementById('btn-session-stop')?.addEventListener('click', () => stopSession());
  document.getElementById('btn-view')?.addEventListener('click', () => setFp(!fpMode));

  // ── 복싱 고스트 = 벽면 UI 2D 레이어 ──
  // 훅 모션 봇을 오프스크린 씬에서 정면 직교 카메라로 렌더 → 텍스처를 벽면 평면에 투사
  let ghostMixer = null, ghostRT = null, ghostScene = null, ghostCam = null, ghostLayer = null;
  function ensureGhostBot() {
    if (ghostLayer) return;
    ghostScene = new THREE.Scene();
    const bot = SkeletonUtils.clone(xbot.model);
    bot.traverse(o => {
      if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0xb39ddb });
    });
    bot.position.set(0, 0, 0);
    bot.rotation.y = Math.PI; // 카메라(+Z)를 마주봄
    ghostScene.add(bot);
    ghostMixer = new THREE.AnimationMixer(bot);
    const clip = xbot.actions.hook?.action.getClip();
    if (clip) ghostMixer.clipAction(clip).play();

    ghostRT = new THREE.WebGLRenderTarget(512, 768, { samples: 2 });
    const W = 1.6, H = 2.1;
    ghostCam = new THREE.OrthographicCamera(-W / 2, W / 2, H, 0, 0.1, 10);
    ghostCam.position.set(0, 0, 3);
    ghostCam.lookAt(0, 0, 0);

    ghostLayer = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.85, H * 0.85),
      new THREE.MeshBasicMaterial({
        map: ghostRT.texture, transparent: true, opacity: 0.8, depthWrite: false,
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
    renderer.setRenderTarget(ghostRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(ghostScene, ghostCam);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevAlpha);
  }

  switchPack('running');
  document.getElementById('loading').style.display = 'none';

  const clock = new THREE.Clock();

  // 시뮬 1스텝 (서브스텝 단위 — 백그라운드 탭 스로틀에도 정속·정밀 유지)
  function stepSim(h) {
    const data = state.packs[state.pack];
    if (!data) return;
    // 세션 비실전 단계: 팩 시간 정지, X봇 정지 — UI 단계 검증 모드
    if (session.active && session.stage !== 'REAL') {
      session.update(h);
      state.time = 0;
      tokens.update(0, 0);
      xbot.update(0, 0);
      rig.update(0, h);
      tokens.setShake(rig.shake.x, rig.shake.y);
      return;
    }
    if (session.active) session.update(h);
    state.time += h;
    if (state.time >= data.duration) {
      state.time %= data.duration;
      tokens.resetLoop();
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
    const total = el * state.speed;
    const steps = Math.min(120, Math.max(1, Math.ceil(total / 0.02)));
    const h = total / steps;
    for (let i = 0; i < steps; i++) stepSim(h);
  }, 200);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) clock.getDelta();  // 숨김 구간 이중 진행 방지
    bgLast = performance.now();
  });

  function loop() {
    requestAnimationFrame(loop);
    const rawDt = Math.min(clock.getDelta(), 2.0);

    if (state.playing) {
      // 큰 프레임은 1/50s 서브스텝으로 분할 — rAF 스로틀 시에도 판정 샘플링 정확
      const total = rawDt * state.speed;
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
    effects.update(rawDt);
    panel.drawTimeline(state.time, judge.marks);

    // 도달 범위 = 분석 오버레이 (투사 그래픽 아님) — 시야 콘 토글에서만 표시
    const body = xbot.getBodyPos();
    reach.visible = coneOn && state.pack !== 'boxing';
    reach.position.set(body.x, 0.009, body.z);

    // ── 세션 중 봇 표시: 비실전 단계는 UI만 보이게 숨김 (1인칭 눈은 본에서 유지) ──
    const inSessionPreview = session.active && session.stage !== 'REAL';
    if (session.active) {
      xbot.model.visible = (session.stage === 'REAL') && !fpMode;
    }
    // 카메라는 강제하지 않음 — 3인칭(궤도 자유회전) / 1인칭 모두 사용 가능.
    // 러닝 전진 팔로우는 실제 재생(비세션 or 실전)일 때만.
    if (!inSessionPreview && state.pack === 'running' && !fpMode) {
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
        const tx = eye.x + fwd.x * 0.05, ty = eye.y, tz = eye.z + fwd.z * 0.05;
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
