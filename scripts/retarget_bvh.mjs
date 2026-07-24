// BVH(Bandai·CMU) → X Bot AnimationClip JSON 오프라인 변환기
// 사용: node scripts/retarget_bvh.mjs [jobName ...]  (무인자 = 전체 JOBS)
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

// CMU Graphics Lab BVH(una-dinosauria/cmu-mocap 변환) 31본 → Mixamo
const CMU_NAMES = {
  mixamorigHips: 'Hips',
  mixamorigSpine: 'LowerBack',
  mixamorigSpine1: 'Spine',
  mixamorigSpine2: 'Spine1',
  mixamorigNeck: 'Neck',
  mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'LeftShoulder',
  mixamorigLeftArm: 'LeftArm',
  mixamorigLeftForeArm: 'LeftForeArm',
  mixamorigLeftHand: 'LeftHand',
  mixamorigRightShoulder: 'RightShoulder',
  mixamorigRightArm: 'RightArm',
  mixamorigRightForeArm: 'RightForeArm',
  mixamorigRightHand: 'RightHand',
  mixamorigLeftUpLeg: 'LeftUpLeg',
  mixamorigLeftLeg: 'LeftLeg',
  mixamorigLeftFoot: 'LeftFoot',
  mixamorigLeftToeBase: 'LeftToeBase',
  mixamorigRightUpLeg: 'RightUpLeg',
  mixamorigRightLeg: 'RightLeg',
  mixamorigRightFoot: 'RightFoot',
  mixamorigRightToeBase: 'RightToeBase',
};

// Motifect AI 팩(76본, Hips=그룹·LeftLeg=허벅지·LeftShin=정강이 규약) → Mixamo.
// 소스 FBX는 라이선스상 재배포 금지 → 저장소엔 리타겟 산출 JSON만 커밋(원본은 ~/Downloads 참조)
const MF_NAMES = {
  mixamorigHips: 'Hips',
  mixamorigSpine: 'Spine1',
  mixamorigSpine1: 'Spine2',
  mixamorigSpine2: 'Chest',
  mixamorigNeck: 'Neck1',
  mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'LeftShoulder',
  mixamorigLeftArm: 'LeftArm',
  mixamorigLeftForeArm: 'LeftForeArm',
  mixamorigLeftHand: 'LeftHand',
  mixamorigRightShoulder: 'RightShoulder',
  mixamorigRightArm: 'RightArm',
  mixamorigRightForeArm: 'RightForeArm',
  mixamorigRightHand: 'RightHand',
  mixamorigLeftUpLeg: 'LeftLeg',
  mixamorigLeftLeg: 'LeftShin',
  mixamorigLeftFoot: 'LeftFoot',
  mixamorigLeftToeBase: 'LeftToeBase',
  mixamorigRightUpLeg: 'RightLeg',
  mixamorigRightLeg: 'RightShin',
  mixamorigRightFoot: 'RightFoot',
  mixamorigRightToeBase: 'RightToeBase',
};
const MF_DIR = '/Users/iil-yeo/Downloads/motifect_sports_and_athletics_v1_0_fbx/Animations';

// 변환 잡: BVH 파일 → 클립. trim=[초,초] 구간 발췌, fps=키 리샘플(용량·노이즈)
const JOBS = {
  dash_normal: { file: 'public/mocap/dash_normal.bvh', names: NAMES, hip: 'Hips' },
  run_normal: { file: 'public/mocap/run_normal.bvh', names: NAMES, hip: 'Hips' },
  walk_right: { file: 'public/mocap/walk_right.bvh', names: NAMES, hip: 'Hips' },
  kick_normal: { file: 'public/mocap/kick_normal.bvh', names: NAMES, hip: 'Hips' },
  // 차분 구간 발췌 + 0.78배 슬로우 — 실속도 재생이 마네킹에선 '촐싹거림'으로 보임(유저)
  cmu_stretch: { file: 'public/mocap/cmu/42_01.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, trim: [0.5, 8.8], slow: 0.78 },
  cmu_dribble_low: { file: 'public/mocap/cmu/06_13.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true },
  cmu_crossover_shot: { file: 'public/mocap/cmu/06_14.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_jump_shot: { file: `${MF_DIR}/basketball_jump_shot.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_dribble: { file: `${MF_DIR}/basketball_dribble.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_layup: { file: `${MF_DIR}/basketball_layup.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_marathon: { file: `${MF_DIR}/marathon_pace_run.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
};

// FBX 소스 로드 → {skeleton, clip} (BVHLoader 반환과 동형).
// Motifect류는 Hips가 Bone이 아니라 Group — 같은 이름의 Bone으로 치환해 스켈레톤 루트로 편입
// (트랙은 노드명 바인딩이라 그대로 재생, retargetClip hip 옵션도 유효해짐)
function loadFbxSource(file) {
  const buf = fs.readFileSync(file);
  const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), './');
  let sm = null; g.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; });
  if (!sm) throw new Error(`SkinnedMesh 없음: ${file}`);
  let bones = sm.skeleton.bones;
  const hips = g.getObjectByName('Hips');
  if (hips && !hips.isBone) {
    const hb = new THREE.Bone(); hb.name = 'Hips';
    hb.position.copy(hips.position); hb.quaternion.copy(hips.quaternion); hb.scale.copy(hips.scale);
    [...hips.children].forEach(c => hb.add(c));
    hips.parent.add(hb); hips.parent.remove(hips);
    bones = [hb, ...bones];
  }
  const clip = g.animations[0];
  if (!clip) throw new Error(`애니메이션 없음: ${file}`);
  return { skeleton: new THREE.Skeleton(bones), clip };
}

// 체인 방향 정렬용: 타깃 본 → 방향 기준이 되는 자식 본
const CHAIN = {
  mixamorigHips: 'mixamorigSpine',
  mixamorigSpine: 'mixamorigSpine2',
  mixamorigSpine1: 'mixamorigSpine2',   // CMU 전용(Bandai엔 Spine1 미매핑 — 미사용)
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
function computeLocalOffsets(res, names) {
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
  for (const [tName, sName] of Object.entries(names)) {
    const tB = tgtBone(tName), sB = srcBone(sName);
    if (!tB || !sB) continue;
    const rT = wq(tB), rS = wq(sB);
    let ref = rT.clone();
    const childT = CHAIN[tName] && tgtBone(CHAIN[tName]);
    const childS = CHAIN[tName] && srcBone(names[CHAIN[tName]]);
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

const wanted = process.argv.slice(2);
for (const name of (wanted.length ? wanted : Object.keys(JOBS))) {
  const job = JOBS[name];
  if (!job) { console.warn(`잡 없음: ${name}`); continue; }
  const srcPath = job.file.startsWith('/') ? job.file : path.join(ROOT, job.file);
  const res = job.type === 'fbx' ? loadFbxSource(srcPath) : new BVHLoader().parse(fs.readFileSync(srcPath, 'utf8'));
  const localOffsets = computeLocalOffsets(res, job.names);
  const hipsBindPos = target.skeleton.bones.find(b => b.name === 'mixamorigHips').position.clone();
  let clip = SkeletonUtils.retargetClip(target, res.skeleton, res.clip, {
    hip: job.hip,           // 소스 본명 기준
    names: job.names,
    scale: 1,
    localOffsets,
  });
  clip.name = name;
  // 발췌·리샘플: trim=[t0,t1] 구간만, fps 지정 시 등간격 리샘플(용량·지터 정리)
  if (job.trim || job.fps) {
    const [t0, t1] = job.trim || [0, clip.duration];
    const slow = job.slow || 1;   // <1 = 슬로우 재생을 클립에 베이크 (dur = 구간/slow)
    const fps = job.fps || 30, n = Math.max(2, Math.round((t1 - t0) / slow * fps));
    const tracks = [];
    for (const tr of clip.tracks) {
      const isQ = tr.name.endsWith('.quaternion');
      const size = isQ ? 4 : 3;
      const interp = tr.createInterpolant();
      const times = new Float32Array(n + 1), values = new Float32Array((n + 1) * size);
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * (i / n);
        const v = interp.evaluate(Math.min(t, clip.duration - 1e-4));
        times[i] = (t - t0) / slow;
        values.set(v.slice(0, size), i * size);
      }
      tracks.push(isQ ? new THREE.QuaternionKeyframeTrack(tr.name, times, values)
        : new THREE.VectorKeyframeTrack(tr.name, times, values));
    }
    clip = new THREE.AnimationClip(name, (t1 - t0) / slow, tracks);
  }

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
    // CMU: 소스 리그 키가 커서(단위 상이) Y 델타를 신장비로 스케일 (Bandai는 기존 그대로 k=1)
    const k = job.yScale && y0 > 1e-6 ? hipsBindPos.y / y0 : 1;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = hipsBindPos.x;
      v[i + 1] = (v[i + 1] - y0) * k + hipsBindPos.y;
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
