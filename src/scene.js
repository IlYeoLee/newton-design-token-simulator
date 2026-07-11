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
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x171a20, roughness: 0.92, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(24, 48, 0x232833, 0x1b202a);
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

  // ── 카메라 프리셋 ─────────────────────────────────────
  const CAM_PRESETS = {
    running:    { pos: [2.9, 2.1, 2.9],  look: [0, 0.7, -0.6] },
    boxing:     { pos: [2.6, 1.7, 1.7],  look: [0, 1.2, -1.2] },
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

  // ── 후처리: 블룸(마크·이펙트 발광) + 그레인·비네트 ─────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth / 2, container.clientHeight / 2),
    FX.bloomStrength, FX.bloomRadius, FX.bloomThreshold);
  composer.addPass(bloomPass);
  const gradePass = new ShaderPass(GrainVignetteShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  function renderFrame(timeSec) {
    bloomPass.threshold = FX.bloomThreshold;
    bloomPass.strength = FX.bloomStrength;
    bloomPass.radius = FX.bloomRadius;
    gradePass.uniforms.uGrain.value = FX.grain;
    gradePass.uniforms.uVignette.value = FX.vignette;
    gradePass.uniforms.uExposure.value = FX.exposure;
    gradePass.uniforms.uTime.value = timeSec;
    composer.render();
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w / 2, h / 2);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, controls, setPackEnvironment, resize, renderFrame, composer };
}
