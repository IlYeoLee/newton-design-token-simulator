// Bandai BVH → X Bot AnimationClip JSON 오프라인 변환기
// 사용: node scripts/retarget_bvh.mjs
// 출력: assets/mocap/xclip-<name>.json  (THREE.AnimationClip.parse로 로드)

import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Bandai 22본 → Mixamo (target bone name → source bone name)
const NAMES = {
  mixamorigHips: 'Hips',
  mixamorigSpine: 'Spine',
  mixamorigSpine2: 'Chest',
  mixamorigNeck: 'Neck',
  mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'Shoulder_L',
  mixamorigLeftArm: 'UpperArm_L',
  mixamorigLeftForeArm: 'LowerArm_L',
  mixamorigLeftHand: 'Hand_L',
  mixamorigRightShoulder: 'Shoulder_R',
  mixamorigRightArm: 'UpperArm_R',
  mixamorigRightForeArm: 'LowerArm_R',
  mixamorigRightHand: 'Hand_R',
  mixamorigLeftUpLeg: 'UpperLeg_L',
  mixamorigLeftLeg: 'LowerLeg_L',
  mixamorigLeftFoot: 'Foot_L',
  mixamorigLeftToeBase: 'Toes_L',
  mixamorigRightUpLeg: 'UpperLeg_R',
  mixamorigRightLeg: 'LowerLeg_R',
  mixamorigRightFoot: 'Foot_R',
  mixamorigRightToeBase: 'Toes_R',
};

// 체인 방향 정렬용: 타깃 본 → 방향 기준이 되는 자식 본
const CHAIN = {
  mixamorigHips: 'mixamorigSpine',
  mixamorigSpine: 'mixamorigSpine2',
  mixamorigSpine2: 'mixamorigNeck',
  mixamorigNeck: 'mixamorigHead',
  mixamorigLeftShoulder: 'mixamorigLeftArm',
  mixamorigLeftArm: 'mixamorigLeftForeArm',
  mixamorigLeftForeArm: 'mixamorigLeftHand',
  mixamorigRightShoulder: 'mixamorigRightArm',
  mixamorigRightArm: 'mixamorigRightForeArm',
  mixamorigRightForeArm: 'mixamorigRightHand',
  mixamorigLeftUpLeg: 'mixamorigLeftLeg',
  mixamorigLeftLeg: 'mixamorigLeftFoot',
  mixamorigLeftFoot: 'mixamorigLeftToeBase',
  mixamorigRightUpLeg: 'mixamorigRightLeg',
  mixamorigRightLeg: 'mixamorigRightFoot',
  mixamorigRightFoot: 'mixamorigRightToeBase',
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ── X Bot 스켈레톤 로드 ──────────────────────────────────────
console.log('X Bot FBX 파싱…');
const fbxBuf = fs.readFileSync(path.join(ROOT, 'assets/xbot.fbx'));
const ab = fbxBuf.buffer.slice(fbxBuf.byteOffset, fbxBuf.byteOffset + fbxBuf.byteLength);
const xbot = new FBXLoader().parse(ab, './');
let target = null;
xbot.traverse(o => { if (o.isSkinnedMesh && !target) target = o; });
if (!target) throw new Error('SkinnedMesh 없음');
console.log('  본 수:', target.skeleton.bones.length);

// ── 변환 ─────────────────────────────────────────────────────
const outDir = path.join(ROOT, 'assets/mocap');
fs.mkdirSync(outDir, { recursive: true });

// Bandai 리그는 본 로컬축이 +X 체인(레스트 포즈가 옆으로 누움) — Mixamo(+Y 체인)와 규약이 달라
// 소스 월드 회전을 그대로 복사하면 몸이 눕는다. 클립 프레임0에서 소스·타깃의 본 방향을
// 최소 회전으로 정렬하는 per-bone localOffsets를 만들어 보정한다: R_out = R_src(t) · L,
// L = R_src0⁻¹ · Q(d_target→d_source) · R_target(bind)
function computeLocalOffsets(res) {
  const srcRoot = new THREE.Group();
  srcRoot.add(res.skeleton.bones[0]);
  const mixer = new THREE.AnimationMixer(srcRoot);
  mixer.clipAction(res.clip).play();
  mixer.update(0);
  srcRoot.updateMatrixWorld(true);

  target.skeleton.pose();
  xbot.updateMatrixWorld(true);

  const srcBone = n => res.skeleton.bones.find(b => b.name === n);
  const tgtBone = n => target.skeleton.bones.find(b => b.name === n);
  const wq = o => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(o.matrixWorld));
  const wp = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

  const offsets = {};
  for (const [tName, sName] of Object.entries(NAMES)) {
    const tB = tgtBone(tName), sB = srcBone(sName);
    if (!tB || !sB) continue;
    const rT = wq(tB), rS = wq(sB);
    let ref = rT.clone();
    const childT = CHAIN[tName] && tgtBone(CHAIN[tName]);
    const childS = CHAIN[tName] && srcBone(NAMES[CHAIN[tName]]);
    if (childT && childS) {
      const dT = wp(childT).sub(wp(tB)).normalize();
      const dS = wp(childS).sub(wp(sB)).normalize();
      ref = new THREE.Quaternion().setFromUnitVectors(dT, dS).multiply(rT);
    }
    const L = rS.clone().invert().multiply(ref);
    offsets[tName] = new THREE.Matrix4().makeRotationFromQuaternion(L);
  }
  return offsets;
}

for (const name of ['dash_normal', 'run_normal', 'walk_right']) {
  const text = fs.readFileSync(path.join(ROOT, `public/mocap/${name}.bvh`), 'utf8');
  const res = new BVHLoader().parse(text);
  const localOffsets = computeLocalOffsets(res);
  const hipsBindPos = target.skeleton.bones.find(b => b.name === 'mixamorigHips').position.clone();
  const clip = SkeletonUtils.retargetClip(target, res.skeleton, res.clip, {
    hip: 'Hips',            // 소스 본명 기준
    names: NAMES,
    scale: 1,
    localOffsets,
  });
  clip.name = name;

  // 트랙명 변환: `.bones[X].prop`(SkinnedMesh 전용) → `X.prop`(노드명 바인딩)
  // 런타임 mixer 루트가 FBX Group이라 skeleton이 없어 .bones[] 문법은 바인딩 실패함
  for (const t of clip.tracks) {
    t.name = t.name.replace(/^\.bones\[([^\]]+)\]/, '$1');
  }

  // 제자리화 + 높이 정규화: 루트 이동은 시뮬레이터 경로가 담당 → XZ는 바인드 위치에 고정,
  // Y는 프레임0을 바인드 힙 높이에 맞추고 바운스(델타)만 유지 (소스 리그와 절대 높이 다름)
  const hipTrack = clip.tracks.find(t => t.name.endsWith('Hips.position'));
  if (hipTrack) {
    const v = hipTrack.values;
    const y0 = v[1];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = hipsBindPos.x;
      v[i + 1] = v[i + 1] - y0 + hipsBindPos.y;
      v[i + 2] = hipsBindPos.z;
    }
  }

  const json = THREE.AnimationClip.toJSON(clip);
  const out = path.join(outDir, `xclip-${name}.json`);
  fs.writeFileSync(out, JSON.stringify(json));
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`  ${name}: ${clip.duration.toFixed(2)}s · 트랙 ${clip.tracks.length} · ${kb}KB`);
}
console.log('완료');
