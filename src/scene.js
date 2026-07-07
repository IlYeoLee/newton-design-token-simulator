import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, controls, setPackEnvironment, resize };
}
