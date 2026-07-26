import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// 화면 룩 파라미터 — FX Lab에서 확정한 값이 기본, 프로 편집 모드가 라이브 조절
export const FX = {
  bloomThreshold: 0.55,
  bloomStrength: 0.55,
  bloomRadius: 0.6,
  grain: 0,
  vignette: 0.12,
  exposure: 1.0,
};

// FilmPass 대체 — 가벼운 그레인+비네트+노출 (톤 왜곡 없음), 디더로 밴딩 제거
const GrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uGrain: { value: FX.grain },
    uVignette: { value: FX.vignette },
    uExposure: { value: FX.exposure },
    uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uExposure, uTime;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= uExposure;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.45, 0.95, d) * uVignette;
      c.rgb += (hash(vUv * 913.7 + fract(uTime) * 7.0) - 0.5) * uGrain;   // 필름 그레인
      c.rgb += (hash(vUv * 517.3) - 0.5) * (2.0 / 255.0);                  // 디더 (밴딩 제거)
      gl_FragColor = c;
    }`,
};

// 좌표계: X Bot은 원점에서 -Z(벽 방향)를 바라봄. 바닥 투사 레인은 -Z 앞쪽.
export const WALL_Z = -1.8;   // 벽을 인물 가까이 (복싱 훈련 거리)
export const FLOOR_Y = 0.001;

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;  // 투사면 클리핑 — 모든 UI는 투사면 안에서만
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0e12);
  scene.fog = new THREE.Fog(0x0c0e12, 9, 20);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.05, 60);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 1.2;
  controls.maxDistance = 14;

  // ── 조명 ──────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0x39424f, 0x11141a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4fc3f7, 0.35);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  // ── 바닥 ──────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x171a20, roughness: 0.92, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(120, 240, 0x232833, 0x1b202a);
  grid.position.y = 0.002;
  scene.add(grid);

  // ── 벽면 (복싱 팩 전용) ────────────────────────────────
  const wallGroup = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.95 })
  );
  wall.position.set(0, 1.6, WALL_Z);
  wall.receiveShadow = true;
  wallGroup.add(wall);
  const wallGrid = new THREE.GridHelper(5, 10, 0x2a3140, 0x232a37);
  wallGrid.rotation.x = Math.PI / 2;
  wallGrid.position.set(0, 1.6, WALL_Z + 0.005);
  wallGroup.add(wallGrid);
  scene.add(wallGroup);

  // 빔 투사는 projector.js(무릎 모듈 / 후방 스테이션)가 전담

  // ── 투사면 실측 텍스처 (ambientCG CC0) — 룩 스튜디오 칩과 연동 ──
  // 바닥 = 잔디/러닝 트랙/보도블럭, 벽 = 텍스처 사용 시 석고벽. 'none' = 기본 다크 스크린.
  const texLoader = new THREE.TextureLoader();
  const surfCache = {};
  const BASE_URL = import.meta.env.BASE_URL;
  function loadSurf(file, repX, repY) {
    return new Promise(resolve => {
      texLoader.load(`${BASE_URL}tex/${file}`, tex => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repX, repY);
        tex.anisotropy = 4;
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      });
    });
  }
  async function getSurf(key) {
    if (surfCache[key]) return surfCache[key];
    if (key === 'grass') surfCache.grass = await loadSurf('grass.jpg', 60, 60);
    else if (key === 'paving') surfCache.paving = await loadSurf('paving.jpg', 50, 50);
    else if (key === 'plaster') surfCache.plaster = await loadSurf('plaster.jpg', 2.5, 1.6);
    else if (key === 'track') {
      // 러닝 트랙 = 민트/연두 우레탄 (유저: 초록/연두빛 트랙 — 한국 공원 트랙) + 그레인 + 레인 라인
      const asphalt = await new Promise(res => {
        const im = new Image();
        im.onload = () => res(im);
        im.src = `${BASE_URL}tex/asphalt.jpg`;
      });
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#6FA88C'; g.fillRect(0, 0, 512, 512);            // 민트-세이지 그린 베이스
      g.globalAlpha = 0.34; g.globalCompositeOperation = 'overlay';   // 아스팔트 = 그레인 질감만(어둡게 안 함)
      g.drawImage(asphalt, 0, 0, 512, 512);
      g.globalAlpha = 0.12; g.globalCompositeOperation = 'saturation'; // 채도 살짝 낮춰 무광 실사감
      g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(248,248,244,0.85)';                          // 흰 레인 라인
      g.fillRect(96, 0, 7, 512); g.fillRect(409, 0, 7, 512);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(60, 60);
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;
      surfCache.track = tex;
    }
    else if (key === 'dirt') {
      // 연한 흙/콘크리트 포장길 (유저: 공원 산책로) — 아스팔트 그레인 위 밝은 웜베이지 + 미세 균열/이음선
      const asphalt = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = `${BASE_URL}tex/asphalt.jpg`; });
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#C4BBA4'; g.fillRect(0, 0, 512, 512);            // 밝은 웜베이지 콘크리트
      g.globalAlpha = 0.4; g.globalCompositeOperation = 'overlay';    // 아스팔트 = 자잘한 그레인
      g.drawImage(asphalt, 0, 0, 512, 512);
      g.globalAlpha = 0.16; g.globalCompositeOperation = 'saturation'; // 채도 낮춰 흙빛 무광
      g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // 포장 이음선 (가로·세로 옅은 균열)
      g.strokeStyle = 'rgba(120,110,92,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 262); g.moveTo(256, 0); g.lineTo(250, 512); g.stroke();
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(24, 24);
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;
      surfCache.dirt = tex;
    }
    else if (key === 'indoorwood') {
      // 실내 마루 = 런타임 베이크 (플랭크 + 심 + 결) — 외부 에셋 불필요
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      const rnd = (() => { let s0 = 7; return () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; })();
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 128;
        for (let px = -1; px < 3; px++) {
          const x = px * 256 + off, y = row * 64;
          const tone = 0.82 + rnd() * 0.30;
          g.fillStyle = `rgb(${Math.round(168 * tone)}, ${Math.round(126 * tone)}, ${Math.round(84 * tone)})`;
          g.fillRect(x, y, 256, 64);
          g.strokeStyle = 'rgba(70,48,30,0.55)'; g.lineWidth = 2;
          g.strokeRect(x + 1, y + 1, 254, 62);
          g.strokeStyle = 'rgba(90,62,40,0.25)'; g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            const gy = y + 10 + rnd() * 46;
            g.beginPath(); g.moveTo(x + 6, gy); g.lineTo(x + 250, gy + (rnd() - 0.5) * 6); g.stroke();
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(26, 26);
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;
      surfCache.indoorwood = tex;
    }
    else if (key === 'wallpaper') {
      // 실내 벽지 = 런타임 베이크 (아이보리 화이트 + 연한 세로 결)
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#F7F4EE'; g.fillRect(0, 0, 256, 256);
      const rnd = (() => { let s0 = 13; return () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; })();
      for (let x = 0; x < 256; x += 2) {
        const a = 0.020 + rnd() * 0.045;
        g.fillStyle = rnd() < 0.5 ? `rgba(210,202,188,${a})` : `rgba(255,255,255,${a})`;
        g.fillRect(x, 0, 1 + rnd() * 1.5, 256);
      }
      for (let i = 0; i < 90; i++) {   // 미세 섬유 노이즈
        g.fillStyle = `rgba(196,188,174,${0.03 + rnd() * 0.04})`;
        g.fillRect(rnd() * 256, rnd() * 256, 1, 3 + rnd() * 9);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(9, 5);
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;
      surfCache.wallpaper = tex;
    }
    return surfCache[key];
  }
  let surfSeq = 0;
  let curSurfKey = null;   // 현재 투사면 테마 (none=다크) — 주간 하늘 톤이 이걸 따른다
  // 주간 하늘/안개 톤 = 표면 테마 인지: 다크 바닥 위 밝은 하늘은 부조화 (유저 교정 —
  // '바닥은 검정인데 배경이 흰색') → 어두운 표면일 땐 흐린 하늘도 어둡게
  function daySky() { if (curSurfKey === 'indoor') return 0xEFEBE2; return (!curSurfKey || curSurfKey === 'none') ? 0x7E858F : 0xB9C0CA; }
  function applyDayAmbience() {
    if (!dayMode) return;
    const sky = daySky();
    scene.background.setHex(sky);
    scene.fog.color.setHex(sky);
  }
  let courtLines = null;
  async function setSurfaces(key) {
    const seq = ++surfSeq;   // 연타 시 마지막 선택만 반영
    curSurfKey = (!key || key === 'none') ? null : key;
    if (!key || key === 'none') {
      floor.material.map = null;
      floor.material.color.setHex(dayMode ? 0x666C76 : 0x171a20);   // 주간 다크 = 젖은 아스팔트 톤
      wall.material.map = null;
      wall.material.color.setHex(dayMode ? 0x767C86 : 0x1c2028);
      wall.material.emissive?.setHex(0x000000);
      floor.material.needsUpdate = true;
      wall.material.needsUpdate = true;
      grid.visible = true;
      wallGrid.visible = true;
      if (courtLines) courtLines.visible = false;
      applyDayAmbience();
      return;
    }
    const [fTex, wTex] = await Promise.all([getSurf(key === 'indoor' || key === 'court' ? 'indoorwood' : key), getSurf('plaster')]);
    if (seq !== surfSeq) return;
    // 농구 코트(유저: 기본 배경): 마루 바닥 + 하프코트 라인 오버레이(런타임 베이크, 외부 에셋 0)
    if (!courtLines) {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const g = c.getContext('2d');
      const M = 1024 / 16;   // 16m 대지 → px/m
      g.strokeStyle = 'rgba(250,250,245,0.85)'; g.lineWidth = 7; g.lineJoin = 'round';
      const rc = (x, z, w, h) => g.strokeRect((x + 8) * M, (z + 8) * M, w * M, h * M);
      const arc = (x, z, r, a0, a1) => { g.beginPath(); g.arc((x + 8) * M, (z + 8) * M, r * M, a0, a1); g.stroke(); };
      rc(-7.5, -7.5, 15, 15);                    // 외곽(하프코트 15×15 근사)
      rc(-2.45, -7.5, 4.9, 5.8);                 // 페인트존(키) — 골대는 -z 끝
      arc(0, -1.7, 1.8, 0, Math.PI);             // 자유투 원(전방 반원)
      arc(0, -6.325, 6.75, 0.18, Math.PI - 0.18);// 3점 아크
      arc(0, 7.5, 1.8, Math.PI, Math.PI * 2);    // 센터서클(근측 절반)
      const tex2 = new THREE.CanvasTexture(c); tex2.colorSpace = THREE.SRGBColorSpace; tex2.anisotropy = 4;
      courtLines = new THREE.Mesh(new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({ map: tex2, transparent: true, depthWrite: false }));
      courtLines.rotation.x = -Math.PI / 2; courtLines.position.y = 0.006; courtLines.renderOrder = 1;
      scene.add(courtLines);
    }
    courtLines.visible = key === 'court';
    floor.material.map = fTex;
    wall.material.map = wTex;
    if (key === 'indoor' || key === 'court') {
      // 실내: 마루 + 형광등 아래 '진짜 흰' 벽 — 조명 감쇠를 이기도록 자발광 가산
      floor.material.color.setHex(dayMode ? 0xF6F1E8 : 0xD8D0C2);
      wall.material.map = await getSurf('wallpaper');   // 세로 결 벽지 (민무늬 기각)
      wall.material.color.setHex(0xFFFFFF);
      wall.material.emissive?.setHex(dayMode ? 0x6E6A63 : 0x57534B);
    } else {
      wall.material.emissive?.setHex(0x000000);
      floor.material.color.setHex(dayMode ? 0xDBDBDB : 0x8a8a8a);   // 주간=약감쇠(v12.4 통일), 야간=톤 다운
      wall.material.color.setHex(dayMode ? 0xE2E2E2 : 0x9a9a9a);
    }
    floor.material.needsUpdate = true;
    wall.material.needsUpdate = true;
    grid.visible = false;                     // 실측 표면엔 그리드 라인 제거
    wallGrid.visible = false;
    applyDayAmbience();
  }

  // ── 카메라 프리셋 ─────────────────────────────────────
  const CAM_PRESETS = {
    running:    { pos: [2.9, 2.1, 2.9],  look: [0, 0.7, -0.6] },
    boxing:     { pos: [3.5, 1.9, 3.9],  look: [0, 1.1, -0.1] },   // 봇(standZ≈1.6)+벽(-1.8) 동시 프레이밍
    basketball: { pos: [3.4, 2.6, 2.6],  look: [0, 0.6, -1.0] },
  };

  function applyCamera(pack) {
    const p = CAM_PRESETS[pack] || CAM_PRESETS.running;
    camera.position.set(...p.pos);
    controls.target.set(...p.look);
    controls.update();
  }

  function setPackEnvironment(pack, hasWall) {
    wallGroup.visible = !!hasWall;
    applyCamera(pack);
  }

  // ── 주간 모드 — '낮에도 보이는 투사'가 제품 스토리 (MEMS 레이저 주광 가시) ──
  const hemi = scene.children.find(o => o.isHemisphereLight);
  let dayMode = false;
  function setDaylight(on) {
    dayMode = !!on;
    FX.day = dayMode;
    if (dayMode) {
      // 주간 = '밝은 실내/흐린 야외' 톤 — 순백 바닥은 1인칭에서 화면 전체가 백열되므로 금지.
      // 하늘·안개 톤은 표면 테마를 따른다 (daySky — 다크 바닥 위 흰 하늘 부조화 방지)
      const sky = daySky();
      scene.background.setHex(sky);
      scene.fog.color.setHex(sky); scene.fog.near = 14; scene.fog.far = 40;
      hemi.color.setHex(0xDCE4EE); hemi.groundColor.setHex(0x7E848C); hemi.intensity = 1.1;
      key.intensity = 1.6; key.color.setHex(0xFFF3E0);
      rim.intensity = 0.12;
      if (!floor.material.map) floor.material.color.setHex(0x666C76);
      if (!wall.material.map) wall.material.color.setHex(0x767C86);
      if (floor.material.map) floor.material.color.setHex(0xDBDBDB);
      if (wall.material.map) wall.material.color.setHex(0xE2E2E2);
    } else {
      scene.background.setHex(0x0c0e12);
      scene.fog.color.setHex(0x0c0e12); scene.fog.near = 9; scene.fog.far = 20;
      hemi.color.setHex(0x39424f); hemi.groundColor.setHex(0x11141a); hemi.intensity = 1.1;
      key.intensity = 1.5; key.color.setHex(0xffffff);
      rim.intensity = 0.35;
      if (!floor.material.map) floor.material.color.setHex(0x171a20);
      if (!wall.material.map) wall.material.color.setHex(0x1c2028);
      if (floor.material.map) floor.material.color.setHex(0x8a8a8a);
      if (wall.material.map) wall.material.color.setHex(0x9a9a9a);
    }
    floor.material.needsUpdate = true;
    wall.material.needsUpdate = true;
  }

  // ── 후처리: 블룸(마크·이펙트 발광) + 그레인·비네트 ─────
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth / 2, container.clientHeight / 2),
    FX.bloomStrength, FX.bloomRadius, FX.bloomThreshold);
  composer.addPass(bloomPass);
  const gradePass = new ShaderPass(GrainVignetteShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  function renderFrame(timeSec) {
    bloomPass.threshold = FX.bloomThreshold + (FX.day ? 0.38 : 0);
    bloomPass.strength = FX.bloomStrength;
    bloomPass.radius = FX.bloomRadius;
    gradePass.uniforms.uGrain.value = FX.grain;
    gradePass.uniforms.uVignette.value = FX.vignette;
    gradePass.uniforms.uExposure.value = FX.exposure;
    gradePass.uniforms.uTime.value = timeSec;
    composer.render();
  }

  function resize() {
    // 캔버스의 명시적 px 크기가 부모 폭을 지탱하는 순환 차단 — 측정 전 0으로 접었다 실측
    // (편집 종료 후 패널 복귀 시 stage가 1700px로 남아 우측 버튼들이 화면 밖으로 밀리던 버그)
    renderer.domElement.style.width = '0px';
    renderer.domElement.style.height = '0px';
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w / 2, h / 2);
  }
  window.addEventListener('resize', resize);

  // 무한 지면: 바닥·그리드를 기준점 따라 텍스처 주기(2m) 스냅 이동 — 패턴 연속이라 눈에 안 보임
  function followFloor(z) {
    const snapped = Math.round(z / 2) * 2;
    floor.position.z = snapped;
    grid.position.z = snapped;
  }

  return { renderer, scene, camera, controls, setPackEnvironment, resize, renderFrame, composer, setSurfaces, setDaylight, followFloor, setRenderCamera: cam => { renderPass.camera = cam; } };
}
