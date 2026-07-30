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
  alphaOut: false,   // 영상 내보내기 — 알파를 휘도에서 뽑는다
};

// FilmPass 대체 — 가벼운 그레인+비네트+노출 (톤 왜곡 없음), 디더로 밴딩 제거
const GrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uGrain: { value: FX.grain },
    uVignette: { value: FX.vignette },
    uExposure: { value: FX.exposure },
    uTime: { value: 0 },
    uAlphaOut: { value: 0 },   // 1 = 알파를 '빛의 세기'에서 뽑는다(영상 내보내기용)
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uExposure, uTime, uAlphaOut;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= uExposure;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.45, 0.95, d) * uVignette;
      c.rgb += (hash(vUv * 913.7 + fract(uTime) * 7.0) - 0.5) * uGrain;   // 필름 그레인
      c.rgb += (hash(vUv * 517.3) - 0.5) * (2.0 / 255.0);                  // 디더 (밴딩 제거)
      // ★ 투사는 가산광이다 — '빛이 있는 만큼'이 곧 불투명도다.
      //   블룸 패스가 알파를 1 로 채워 투명 내보내기가 안 되던 것의 해법이기도 하다:
      //   알파를 따로 보존하려 애쓰는 대신 휘도에서 뽑으면 물리적으로도 맞고 매트도 깨끗하다.
      if (uAlphaOut > 0.5) {
        float L = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c.rgb, clamp(L * 1.8, 0.0, 1.0));
      } else gl_FragColor = c;
    }`,
};

// 좌표계: X Bot은 원점에서 -Z(벽 방향)를 바라봄. 바닥 투사 레인은 -Z 앞쪽.
export const WALL_Z = -1.8;   // 벽을 인물 가까이 (복싱 훈련 거리)
export const FLOOR_Y = 0.001;

export function createScene(container) {
  // ?alpha=1 — 배경 투명 렌더러(영상 내보내기용). 실시간엔 불필요하고 합성 비용만 든다.
  //   alpha:false 로 만들면 캔버스에 알파 채널 자체가 없어 어떤 방법으로도 투명이 안 나온다.
  const WANT_ALPHA = new URLSearchParams(location.search).get('alpha') === '1';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: WANT_ALPHA, premultipliedAlpha: false });
  if (WANT_ALPHA) renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // 비스듬히 보는 바닥은 이방성 필터링이 화질을 좌우한다 — 4는 너무 낮아 코트 라인이 뭉갰다(유저)
  const MAXANISO = renderer.capabilities.getMaxAnisotropy();
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

  // ── 농구 골대 (절차 생성, 외부 에셋 0 / 규격 근사: 림 3.05m, 백보드 1.8×1.05) ──
  // 코트 -z 끝(페인트존 z=-7.5 라인)에 배치, +z(플레이어) 향함. 농구+코트 표면일 때만 표시.
  const hoop = (() => {
    const g = new THREE.Group();
    const rimY = 3.05, rimZ = -7.0, rimR = 0.225;   // 림 중심(높이/전방 위치/반지름)
    const boardZ = rimZ - 0.15;                       // 백보드 면 = 림 뒤 0.15m
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.3 });
    // 백보드(반투명 유리 톤) + 흰 테두리
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xEDF2F7, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.55 }));
    board.position.set(0, rimY + 0.375, boardZ - 0.015);
    board.castShadow = true; g.add(board);
    // 슈터스 스퀘어(백보드 조준 사각, 주황 라인)
    const sq = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.59, 0.45, 0.001)),
      new THREE.LineBasicMaterial({ color: 0xE8622A }));
    sq.position.set(0, rimY + 0.19, boardZ + 0.02); g.add(sq);
    // 림(주황 토러스, 수평)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.014, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xE8622A, roughness: 0.4, metalness: 0.5 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(0, rimY, rimZ);
    rim.castShadow = true; g.add(rim);
    // 그물(흰 라인, 위 큰 링→아래 작은 링 12가닥 + 중간 링 2)
    const N = 12, drop = 0.4, botR = 0.09;
    const ring = (r, y) => Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, y, rimZ + Math.sin(a) * r);
    });
    const top = ring(rimR, rimY), mid = ring((rimR + botR) / 2, rimY - drop * 0.5), bot = ring(botR, rimY - drop);
    const pts = [];
    for (let i = 0; i < N; i++) {                     // 세로 가닥
      pts.push(top[i], mid[i], mid[i], bot[i]);
    }
    for (let i = 0; i < N; i++) {                      // 가로 링 2개(교차 대각)
      pts.push(mid[i], mid[(i + 1) % N], bot[i], bot[(i + 1) % N]);
    }
    const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xF5F5F0, transparent: true, opacity: 0.75 }));
    g.add(net);
    // 지지 폴(바닥→백보드 뒤 수직) + 연결 암
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, board.position.y + 0.4, 12), dark);
    pole.position.set(0, (board.position.y + 0.4) / 2, boardZ - 0.35);
    pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 10), dark);
    arm.rotation.x = Math.PI / 2; arm.position.set(0, board.position.y, boardZ - 0.18); g.add(arm);
    g.visible = false;
    scene.add(g);
    return g;
  })();
  let curPack = null;
  function updateHoopVisible() {
    // 코트 계열 표면에서만 골대를 세운다. court_tile(촬영지 조립식 타일, 농구 새 기본)을 빠뜨려
    //   기본 표면을 바꾼 순간 골대가 사라졌다(유저) — 코트 키를 추가할 땐 이 목록도 같이 본다.
    hoop.visible = curPack === 'basketball' && ['court', 'court_tile', 'court_gray', 'court_black'].includes(curSurfKey);
  }

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
        tex.anisotropy = MAXANISO;
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
    else if (key === 'court_tile') {
      // 조립식 타일 코트 — 실제 촬영지(유저 레퍼런스 사진). 밝은 쿨그레이 + 25cm 타일 + 타공 패턴.
      //   512px = 1m (타일 4×4) 로 굽고 바닥 120m 에 repeat 120 → 512px/m.
      //   구 court_black/gray(0x263041 네이비)는 촬영지와 정반대 톤이라 이걸 기본으로 쓴다.
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      const T = 128;   // 25cm 타일
      g.fillStyle = '#DCDEDF'; g.fillRect(0, 0, 512, 512);
      for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
        const x = tx * T, y = ty * T;
        const n = ((tx * 7 + ty * 13) % 5) / 5;   // 결정론적 미세 톤차 — 타일마다 살짝 다른 사출 색
        g.fillStyle = `rgb(${(214 + n * 10) | 0},${(217 + n * 10) | 0},${(219 + n * 10) | 0})`;
        g.fillRect(x, y, T, T);
        g.strokeStyle = 'rgba(150,156,161,0.5)'; g.lineWidth = 2;   // 타일 이음선
        g.strokeRect(x + 1, y + 1, T - 2, T - 2);
        // 타공(배수 구멍) — 레퍼런스는 작은 라운드 사각이 '둘씩 짝지어' 촘촘히 깔린다.
        //   구 3×3(23px)은 너무 성겨서 확대하면 격자무늬처럼 보였다 → 4×4 셀 × 셀당 2개 = 32개/타일.
        g.strokeStyle = 'rgba(156,163,169,0.62)'; g.lineWidth = 1.1;
        const CELL = T / 4;                       // 32px = 6.25cm 셀
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const cx = x + i * CELL, cy = y + j * CELL;
          for (let h = 0; h < 2; h++) {           // 좌우 한 쌍
            g.beginPath(); g.roundRect(cx + 4 + h * 13, cy + 5, 11, CELL - 10, 3.5); g.stroke();
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(120, 120);   // 바닥 120m → 1m 당 한 장
      tex.anisotropy = MAXANISO;
      tex.colorSpace = THREE.SRGBColorSpace;
      surfCache.court_tile = tex;
    }
    else if (key === 'ivorywood') {
      // 밝은 아이보리 마루 — 복싱 기본 표면. 유저 확정 방향:
      //   ① indoorwood(rgb 168,126,84)는 진한 오크라 탠에 가깝고 ② 중성 라미네이트로 빼봤더니
      //   "채도가 너무 없어" ③ 정답은 '밝고 깨끗하되 따뜻한 아이보리'.
      //   그래서 명도는 라미네이트만큼 올리고 웜(R−B ≈ 26)은 남긴다.
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      const PH = 74;   // 널 폭 ≈ 14.5cm
      for (let row = 0; row * PH < 512 + PH; row++) {
        const off = (row % 2) * 190;
        for (let px = -1; px < 3; px++) {
          const x = px * 380 + off, y = row * PH;
          const tone = 0.962 + rnd() * 0.072;
          g.fillStyle = `rgb(${Math.min(255, 238 * tone) | 0}, ${Math.min(255, 226 * tone) | 0}, ${Math.min(255, 212 * tone) | 0})`;
          g.fillRect(x, y, 380, PH);
          g.strokeStyle = 'rgba(196,178,152,0.34)'; g.lineWidth = 1.4;   // 널 이음선 — 웜 그레이
          g.strokeRect(x + 0.7, y + 0.7, 380 - 1.4, PH - 1.4);
          g.strokeStyle = 'rgba(204,187,162,0.20)'; g.lineWidth = 1;     // 결
          for (let k = 0; k < 3; k++) {
            const gy = y + 12 + rnd() * (PH - 24);
            g.beginPath(); g.moveTo(x + 8, gy); g.lineTo(x + 372, gy + (rnd() - 0.5) * 5); g.stroke();
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(46, 46);
      tex.anisotropy = MAXANISO;
      tex.colorSpace = THREE.SRGBColorSpace;
      surfCache.ivorywood = tex;
    }
    else if (key === 'track') {
      // 러닝 트랙 = 민트/연두 우레탄 (유저: 초록/연두빛 트랙 — 한국 공원 트랙) + 그레인 + 레인 라인
      const asphalt = await new Promise(res => {
        const im = new Image();
        im.onload = () => res(im);
        im.src = `${BASE_URL}tex/asphalt.jpg`;
      });
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      // 촬영지 트랙(유저 레퍼런스)은 훨씬 옅고 노란기 있는 세이지다 — 구 #6FA88C 는 채도가 두 배쯤 높았다.
      g.fillStyle = '#B7C6AA'; g.fillRect(0, 0, 512, 512);            // 페일 세이지 우레탄
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
      tex.anisotropy = MAXANISO;
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
      tex.anisotropy = MAXANISO;
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
      tex.anisotropy = MAXANISO;
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
      tex.anisotropy = MAXANISO;
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
  let courtLines = null, courtZones = null;
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
      if (courtZones) courtZones.visible = false;
      updateHoopVisible();
      applyDayAmbience();
      return;
    }
    const isCourtColor = key === 'court_gray' || key === 'court_black';   // 회색/검정 코트 = 솔리드 바닥 + 라인
    //   ⚠ 실내를 촬영지 톤(중성 라미네이트)으로 갈아봤으나 되돌렸다 — 복싱이 이 표면을 기본으로 쓰는데
    //     채도가 빠져 통째로 밋밋해졌다(유저: '복싱도 이전버전이 더 나아 채도가 너무 없어').
    //     레퍼런스 사진과의 색온도 차이보다 복싱 화면의 톤이 우선이다.
    //   실내(복싱 기본) = 밝은 아이보리 마루 / 우드 코트 = 진한 체육관 파켓. 분리한다.
    const floorKey = key === 'indoor' ? 'ivorywood' : key === 'court' ? 'indoorwood' : key;
    const [fTex, wTex] = await Promise.all([isCourtColor ? null : getSurf(floorKey), getSurf('plaster')]);
    if (seq !== surfSeq) return;
    // 농구 코트(유저: 기본 배경): 마루 바닥 + 하프코트 라인 오버레이(런타임 베이크, 외부 에셋 0)
    if (!courtLines) {
      // 코트 라인 = SDF 셰이더. 캔버스 텍스처를 폐기한 이유:
      //   2048px/16m = 128px/m 라, 무릎 높이까지 다가가면 1m 가 화면 수백 px 을 먹어 라인이
      //   그대로 확대돼 뭉갠다(유저: '농구장 바닥 확대하면 너무 깨져서'). 해상도를 또 올리는 건
      //   4096² RGBA = 67MB 를 쓰고도 배율만 2배 미루는 미봉책이다.
      //   거리장으로 그리면 배율과 무관하게 항상 1px 경계 — fwidth 로 화면공간 AA 까지 정확하다.
      //   (얇은 지오메트리는 스치는 각도에서 심하게 어른거려 기각. 투사 시점은 늘 스치는 각도다.)
      //   uv → 월드(x,z) 매핑은 옛 캔버스 좌표계와 동일: x = 16u-8 · z = 8-16v.
      const LINE_HALF = 0.025;   // 실물 라인폭 5cm (구 캔버스는 14px/128px·m ≈ 11cm 로 굵었다)
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xfafaf5) }, uOpacity: { value: 0.85 }, uHalf: { value: LINE_HALF } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity, uHalf;
          const float FAR = 1e3;
          float dRect(vec2 p, vec2 c, vec2 h){          // 사각 외곽선까지의 거리
            vec2 d = abs(p - c) - h;
            return abs(min(max(d.x, d.y), 0.0) + length(max(d, 0.0)));
          }
          float dArc(vec2 p, vec2 c, float r, float zMin){   // 원호 — z 하한으로 반원·부분호를 자른다
            return p.y < zMin ? FAR : abs(length(p - c) - r);
          }
          float dArcMax(vec2 p, vec2 c, float r, float zMax){
            return p.y > zMax ? FAR : abs(length(p - c) - r);
          }
          void main(){
            vec2 p = vec2(vUv.x * 16.0 - 8.0, 8.0 - vUv.y * 16.0);   // (월드 x, 월드 z)
            float d = dRect(p, vec2(0.0, 0.0), vec2(7.5, 7.5));      // 외곽 하프코트 15×15
            d = min(d, dRect(p, vec2(0.0, -4.6), vec2(2.45, 2.9)));  // 페인트존(키)
            d = min(d, dArc(p, vec2(0.0, -1.7), 1.8, -1.7));         // 자유투 반원(전방)
            d = min(d, dArc(p, vec2(0.0, -6.325), 6.75, -5.115));    // 3점 아크(양끝 살짝 잘림)
            d = min(d, dArcMax(p, vec2(0.0, 7.5), 1.8, 7.5));        // 센터서클 근측 절반
            float aa = max(fwidth(d), 1e-5);                          // 화면공간 폭 — 배율 무관 AA
            float a = 1.0 - smoothstep(uHalf - aa, uHalf + aa, d);
            if (a < 0.004) discard;
            gl_FragColor = vec4(uColor, a * uOpacity);
          }`,
        transparent: true, depthWrite: false,
      });
      courtLines = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat);
      courtLines.rotation.x = -Math.PI / 2; courtLines.position.y = 0.006; courtLines.renderOrder = 1;
      scene.add(courtLines);
    }
    if (!courtZones) {
      // 타일 색 구역(레퍼런스 사진의 '두 톤 밴드') — 코트 안은 밝은 타일, 바깥은 진한 타일.
      //   반복 텍스처(repeat 120)엔 구울 수 없다. 한 장이 1m 라 구역 같은 대형 패턴을 담을 자리가 없다.
      //   그래서 곱셈 블렌딩 평면을 바닥 바로 위에 깔아 '타일을 갈아 끼운 것처럼' 톤만 눌러준다.
      //   라인과 같은 SDF 규약이라 여기도 배율 무관하게 경계가 선명하다.
      // ⚠ MultiplyBlending 으로 '밝기를 눌러' 구현했다가 기각 — 이 씬은 EffectComposer(HDR RT + 블룸 +
      //   톤매핑)를 거치는데, 그 경로에서 곱셈 블렌딩이 의도대로 안 먹고 바닥이 통째로 흰색으로
      //   날아갔다(실측: 존 on → 흰 바닥·라인 소실 / off → 정상). 블렌드 모드에 의존하지 않는
      //   일반 알파 오버레이로 간다 — '진한 타일을 그 구역에 깔았다'가 원래 의도이기도 하다.
      const zmat = new THREE.ShaderMaterial({
        uniforms: { uTint: { value: new THREE.Color(0xB6BABE) },   // 진한 타일색
          uOut: { value: 0.5 }, uKey: { value: 0.22 } },           // 바깥 존 · 페인트존 덮는 양
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          varying vec2 vUv; uniform vec3 uTint; uniform float uOut, uKey;
          float sdBox(vec2 p, vec2 h){ vec2 d = abs(p) - h; return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
          void main(){
            vec2 p = vec2(vUv.x * 60.0 - 30.0, 30.0 - vUv.y * 60.0);   // (월드 x, 월드 z)
            float sdC = sdBox(p, vec2(7.5));                            // 코트 경계
            float outside = smoothstep(-fwidth(sdC), fwidth(sdC), sdC);
            float sdK = sdBox(p - vec2(0.0, -4.6), vec2(2.45, 2.9));    // 페인트존
            float key = 1.0 - smoothstep(-fwidth(sdK), fwidth(sdK), sdK);
            // 대지 가장자리는 서서히 풀어 60m 사각 경계가 드러나지 않게
            float edge = 1.0 - smoothstep(22.0, 29.5, max(abs(p.x), abs(p.y)));
            float a = max(outside * uOut, key * uKey) * edge;
            if (a < 0.004) discard;
            gl_FragColor = vec4(uTint, a);
          }`,
        transparent: true, depthWrite: false,
      });
      courtZones = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), zmat);
      courtZones.rotation.x = -Math.PI / 2; courtZones.position.y = 0.005; courtZones.renderOrder = 0;
      scene.add(courtZones);
    }
    courtZones.visible = key === 'court_tile';   // 조립식 타일 코트에만 — 우드·솔리드 코트는 단색이 맞다
    courtLines.visible = key === 'court' || key === 'court_tile' || isCourtColor;
    floor.material.map = isCourtColor ? null : fTex;
    wall.material.map = wTex;
    if (isCourtColor) {
      // 회색/검정 코트 = 솔리드 바닥 + 흰 라인. 벽은 실내 스타일.
      // 푸른 톤 블렌드(유저): 중립 회색/검정 대신 쿨 블루그레이 — 코트에 살짝 파란 기운.
      //
      // ★ 검정 코트가 '검은 구멍'으로 보이던 근본 (유저 5회 신고 '드리블 중 검정 박스'):
      //   0x0f1420(rgb 15,20,32)을 무광(roughness .92)으로 깔면 야간 앰비언트에서 화면에
      //   rgb(2,2,2)로 찍힌다 — 실측값이다. 그건 바닥이 아니라 공백이라, 코트 가장자리나
      //   밝은 요소 사이로 그 면이 드러날 때마다 '검은 판'이 생긴 것처럼 보인다.
      //   실제 검은 스포츠 바닥은 광택이 있어 빛을 되쏜다. 광택을 주면 면이 면으로 읽힌다.
      floor.material.color.setHex(key === 'court_black' ? 0x263041 : 0x2b3240);
      floor.material.roughness = key === 'court_black' ? 0.42 : 0.6;
      floor.material.metalness = key === 'court_black' ? 0.22 : 0.12;
      wall.material.map = await getSurf('wallpaper');
      wall.material.color.setHex(0xFFFFFF);
      wall.material.emissive?.setHex(dayMode ? 0x6E6A63 : 0x57534B);
    } else if (key === 'court_tile' || key === 'track') {
      // 촬영지 톤(타일코트·트랙) — 하이키·저채도. 텍스처가 이미 밝으니 색 틴트는 거의 중립으로 둔다.
      //   벽은 실내와 같은 깨끗한 흰 벽으로: 두 촬영지 다 야외지만 회색 plaster 는 노이즈가 도드라져
      //   하이키 톤을 깨뜨린다. 투사면은 어차피 실물이 아니라 '빔이 닿는 밝은 면'이면 된다.
      const tile = key === 'court_tile';
      floor.material.roughness = tile ? 0.78 : 0.92;   // 플라스틱 타일은 무광 우레탄보다 살짝 광택
      floor.material.metalness = tile ? 0.04 : 0.05;
      // ⚠ 0xFFFFFF 는 안 된다 — 텍스처가 이미 밝은데(타일 #DCDEDF) 흰 틴트를 곱하면 주간 키라이트에서
      //   흰색으로 클리핑돼 타일 무늬와 라인이 통째로 사라진다(위에서 내려다볼수록 심함, 실측).
      //   헤드룸을 남겨 무늬가 끝까지 읽히게 한다.
      floor.material.color.setHex(dayMode ? 0xDCDEDF : 0xBFC4C9);
      wall.material.map = await getSurf('wallpaper');
      wall.material.color.setHex(0xFFFFFF);
      wall.material.emissive?.setHex(dayMode ? 0x6E6A63 : 0x57534B);
    } else if (key === 'indoor' || key === 'court') {
      // 실내: 마루 + 형광등 아래 '진짜 흰' 벽 — 조명 감쇠를 이기도록 자발광 가산
      floor.material.roughness = 0.92; floor.material.metalness = 0.05;   // 코트 광택 원복
      //   아이보리 마루는 텍스처가 이미 밝으니 틴트는 살짝 웜하게만(흰색이면 결이 날아간다).
      floor.material.color.setHex(key === 'indoor' ? (dayMode ? 0xF7F2E9 : 0xD8D0C2) : (dayMode ? 0xF6F1E8 : 0xD8D0C2));
      wall.material.map = await getSurf('wallpaper');   // 세로 결 벽지 (민무늬 기각)
      wall.material.color.setHex(0xFFFFFF);
      wall.material.emissive?.setHex(dayMode ? 0x6E6A63 : 0x57534B);
    } else {
      wall.material.emissive?.setHex(0x000000);
      floor.material.roughness = 0.92; floor.material.metalness = 0.05;   // 코트 광택 원복
      floor.material.color.setHex(dayMode ? 0xDBDBDB : 0x8a8a8a);   // 주간=약감쇠(v12.4 통일), 야간=톤 다운
      wall.material.color.setHex(dayMode ? 0xE2E2E2 : 0x9a9a9a);
    }
    floor.material.needsUpdate = true;
    wall.material.needsUpdate = true;
    grid.visible = false;                     // 실측 표면엔 그리드 라인 제거
    wallGrid.visible = false;
    updateHoopVisible();
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
    curPack = pack;
    updateHoopVisible();
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
  // (컴포저에 멀티샘플 타깃을 직접 넘겨 봤으나 첫 화면이 단색으로 렌더되는 회귀가 나서 되돌림.
  //  계단현상은 SMAAPass 같은 후처리 AA로 따로 잡아야 한다 — HANDOFF 참조.)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // NaN 스크럽 — 어떤 재질 셰이더가 NaN/Inf 픽셀을 내면 UnrealBloom 밉 블러가 그걸
  // '계단형 검은 블록'으로 화면에 번지게 한다(유저 녹화의 검은 사각 모양과 일치).
  // 발생원을 개별 사냥하는 대신 블룸 입력 길목에서 무해화: NaN→0, 밝기 상한 클램프.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);'
      + 'if(c.r!=c.r||c.g!=c.g||c.b!=c.b||c.a!=c.a)c=vec4(0.0);gl_FragColor=clamp(c,0.0,60.0);}',
  }));
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
    gradePass.uniforms.uAlphaOut.value = FX.alphaOut ? 1 : 0;
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

  return { renderer, scene, camera, controls, setPackEnvironment, resize, renderFrame, composer, setSurfaces, setDaylight, followFloor, wall, wallGroup, hoop, setRenderCamera: cam => { renderPass.camera = cam; } };
}
