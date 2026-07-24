import * as THREE from 'three';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

// ─────────────────────────────────────────────────────────────
// 무료 로컬 비디오 모캡 파이프라인 (DeepMotion 대체)
//   영상 → MediaPipe PoseLandmarker(33개 3D 월드 관절/프레임) → mixamorig 본 회전 → AnimationClip.
//   프로젝트에 이미 @mediapipe/tasks-vision + 로컬 wasm 존재 → PoseLandmarker만 추가.
// ─────────────────────────────────────────────────────────────

export async function makePoseLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + 'mediapipe-wasm');
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: import.meta.env.BASE_URL + 'models/pose_landmarker_full.task' },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

function seekTo(video, t) {
  return new Promise((res) => {
    const on = () => { video.removeEventListener('seeked', on); res(); };
    video.addEventListener('seeked', on);
    video.currentTime = t;
  });
}

/** 영상 URL → {fps,w,h,dur,frames:[{t, lm:[[x,y,z]×33]}]} (worldLandmarks, 미터, 원점=골반중심) */
export async function extractPose(videoUrl, fps = 24) {
  const landmarker = await makePoseLandmarker();
  const video = document.createElement('video');
  video.src = videoUrl; video.muted = true; video.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error('video load fail')); });
  const dur = video.duration, dt = 1 / fps, frames = [];
  for (let t = 0; t < dur - 1e-3; t += dt) {
    await seekTo(video, t);
    const r = landmarker.detectForVideo(video, Math.round(t * 1000));
    const wl = r.worldLandmarks?.[0];
    if (wl && wl.length >= 33) frames.push({ t: +t.toFixed(3), lm: wl.map(p => [p.x, p.y, p.z]) });
  }
  landmarker.close();
  return { fps, w: video.videoWidth, h: video.videoHeight, dur, frames };
}

// ── 리타겟: MediaPipe worldLandmarks → mixamorig 본 로컬 회전 → AnimationClip ──
// 에임 기반 스윙: 각 본의 바인드 방향(→자식)을 랜드마크 방향으로 회전. 체인은 부모 스윙을 누적 전파.
// MP 좌표계(미터, 원점=골반, y아래)를 씬(y위)로 basis 변환 — 부호는 opts로 튜닝(브라우저 검증).
const CHAINS = [
  ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot'],
  ['mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot'],
  ['mixamorigLeftArm', 'mixamorigLeftForeArm'],
  ['mixamorigRightArm', 'mixamorigRightForeArm'],
];
// 본 → [자식 본(바인드 방향 기준), 랜드마크 a, 랜드마크 b] (월드방향 = P[b]-P[a])
const AIM = {
  mixamorigLeftUpLeg: ['mixamorigLeftLeg', 23, 25], mixamorigLeftLeg: ['mixamorigLeftFoot', 25, 27], mixamorigLeftFoot: ['mixamorigLeftToeBase', 27, 31],
  mixamorigRightUpLeg: ['mixamorigRightLeg', 24, 26], mixamorigRightLeg: ['mixamorigRightFoot', 26, 28], mixamorigRightFoot: ['mixamorigRightToeBase', 28, 32],
  mixamorigLeftArm: ['mixamorigLeftForeArm', 11, 13], mixamorigLeftForeArm: ['mixamorigLeftHand', 13, 15],
  mixamorigRightArm: ['mixamorigRightForeArm', 12, 14], mixamorigRightForeArm: ['mixamorigRightHand', 14, 16],
};
const CHAIN_PARENT = { mixamorigLeftUpLeg: 'mixamorigHips', mixamorigRightUpLeg: 'mixamorigHips', mixamorigLeftArm: 'mixamorigLeftShoulder', mixamorigRightArm: 'mixamorigRightShoulder' };

// 월드 accumQ → 부모 상대 로컬 쿼터니언을 트랙에 push (+저역통과)
function pushLocal(bone, parent, accumQ, tracks, prevLocal, smooth) {
  const localQ = accumQ[parent].clone().invert().multiply(accumQ[bone]);
  if (smooth && prevLocal[bone]) localQ.slerp(prevLocal[bone], smooth);
  prevLocal[bone] = localQ.clone();
  tracks[bone].push(localQ);
}

// 몸통 리타겟에 쓰는 척추 체인·가중치 — 가슴 델타(어깨 랜드마크 basis)를 체인에 분배
const SPINE_CHAIN = [['mixamorigSpine', 0.45], ['mixamorigSpine1', 0.75], ['mixamorigSpine2', 1.0]];

export function retargetToClip(poseData, model, opts = {}) {
  const fx = opts.fx ?? 1, fy = opts.fy ?? -1, fz = opts.fz ?? -1;   // MP→씬 축 부호(기본: y뒤집기, z뒤집기)
  const smooth = opts.smooth ?? 0.35;   // 프레임간 회전 저역통과(노이즈)
  let skel = null; model.updateMatrixWorld(true);
  model.traverse(o => { if (o.isSkinnedMesh && o.skeleton) skel = o.skeleton; });
  if (!skel) throw new Error('no skeleton');
  // 바인드 포즈 월드 위치/쿼터니언 (boneInverses^-1)
  const bindQ = {}, bindP = {}, boneOf = {};
  skel.bones.forEach((b, i) => {
    boneOf[b.name] = b;
    const m = skel.boneInverses[i].clone().invert();
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(p, q, s); bindQ[b.name] = q; bindP[b.name] = p;
  });
  const toScene = (lm) => new THREE.Vector3(fx * lm[0], fy * lm[1], fz * lm[2]);
  const tracks = {}; for (const n in AIM) tracks[n] = [];
  for (const [n] of SPINE_CHAIN) tracks[n] = [];
  tracks.mixamorigNeck = []; tracks.mixamorigHead = [];
  const times = [];
  const prevLocal = {};
  const _b = new THREE.Vector3(), _rest = new THREE.Vector3();
  // (lateral, up) 두 방향 → 정규직교 basis 회전행렬. delta = M_target · M_bindᵀ
  const basisOf = (l, u) => {
    const L = l.clone().normalize();
    const F = new THREE.Vector3().crossVectors(L, u).normalize();   // left×up=fwd (좌표계 규약)
    const U = new THREE.Vector3().crossVectors(F, L).normalize();
    return new THREE.Matrix4().makeBasis(L, U, F);
  };
  const deltaOf = (lB, uB, lT, uT) => new THREE.Quaternion().setFromRotationMatrix(
    basisOf(lT, uT).multiply(basisOf(lB, uB).transpose()));
  // 몸통·머리 캘리브레이션 — 영상 도입부(중립 서기) 평균 basis를 기준으로 한 '상대 델타' 리타겟.
  // MP 절대축을 바인드축과 직접 비교하면 랜드마크 계통 편차(어깨 전방 치우침·코-귀 하향축)가
  // 상수 숙임/굽음으로 남음 — 기준 프레임 상대화로 제거 (전제: 도입부=중립. quad_src류 소스 규약)
  const N0 = Math.min(6, poseData.frames.length);
  const ref = { chL: new THREE.Vector3(), chU: new THREE.Vector3(), hdL: new THREE.Vector3(), hdU: new THREE.Vector3() };
  for (let i = 0; i < N0; i++) {
    const P = poseData.frames[i].lm.map(toScene);
    const shMid = P[11].clone().add(P[12]).multiplyScalar(0.5);
    const hipMid = P[23].clone().add(P[24]).multiplyScalar(0.5);
    const earMid = P[7].clone().add(P[8]).multiplyScalar(0.5);
    const hl = P[7].clone().sub(P[8]);
    ref.chL.add(P[11].clone().sub(P[12])); ref.chU.add(shMid.sub(hipMid));
    ref.hdL.add(hl); ref.hdU.add(new THREE.Vector3().crossVectors(P[0].clone().sub(earMid), hl).normalize());
  }
  for (const fr of poseData.frames) {
    times.push(fr.t);
    const P = fr.lm.map(toScene);
    const accumQ = {};   // 본별 리타겟 월드 쿼터니언
    // ── 몸통: 어깨(11,12)·힙(23,24) 랜드마크 basis → 가슴 델타를 척추 체인에 분배 ──
    const shMid = P[11].clone().add(P[12]).multiplyScalar(0.5);
    const hipMid = P[23].clone().add(P[24]).multiplyScalar(0.5);
    const chestDelta = deltaOf(ref.chL, ref.chU, P[11].clone().sub(P[12]), shMid.clone().sub(hipMid));
    // 머리: 귀(7,8) 좌우축 + (귀중점→코) 전방 → up 재구성
    const earMid = P[7].clone().add(P[8]).multiplyScalar(0.5);
    const headLat = P[7].clone().sub(P[8]);
    const headUp = new THREE.Vector3().crossVectors(P[0].clone().sub(earMid), headLat).normalize();
    const headDelta = deltaOf(ref.hdL, ref.hdU, headLat, headUp);
    accumQ.mixamorigHips = bindQ.mixamorigHips.clone();   // 골반=바인드 (다리는 월드 에임이라 자동 보정)
    let par = 'mixamorigHips';
    for (const [bone, w] of SPINE_CHAIN) {
      const d = new THREE.Quaternion().slerp(chestDelta, w);   // identity→chest 분배
      accumQ[bone] = d.multiply(bindQ[bone]);
      pushLocal(bone, par, accumQ, tracks, prevLocal, smooth);
      par = bone;
    }
    const neckDelta = chestDelta.clone().slerp(headDelta, 0.5);
    accumQ.mixamorigNeck = neckDelta.multiply(bindQ.mixamorigNeck.clone());
    pushLocal('mixamorigNeck', 'mixamorigSpine2', accumQ, tracks, prevLocal, smooth);
    accumQ.mixamorigHead = headDelta.clone().multiply(bindQ.mixamorigHead.clone());
    pushLocal('mixamorigHead', 'mixamorigNeck', accumQ, tracks, prevLocal, smooth);
    // 어깨는 가슴을 따라감 → 팔 체인의 deltaParent가 가슴 델타가 됨
    accumQ.mixamorigLeftShoulder = chestDelta.clone().multiply(bindQ.mixamorigLeftShoulder.clone());
    accumQ.mixamorigRightShoulder = chestDelta.clone().multiply(bindQ.mixamorigRightShoulder.clone());
    for (const chain of CHAINS) {
      let parentName = CHAIN_PARENT[chain[0]];
      if (!accumQ[parentName]) accumQ[parentName] = bindQ[parentName].clone();   // 부모(루트/어깨)는 바인드 유지
      for (const bone of chain) {
        const [childBone, ia, ib] = AIM[bone];
        _rest.copy(bindP[childBone]).sub(bindP[bone]).normalize();               // 바인드 월드 방향(본→자식)
        const deltaParent = accumQ[parentName].clone().multiply(bindQ[parentName].clone().invert());
        const restMoved = _rest.clone().applyQuaternion(deltaParent);            // 부모 스윙 반영된 rest 방향
        const target = _b.copy(P[ib]).sub(P[ia]).normalize();                    // 랜드마크 타겟 방향
        const swing = new THREE.Quaternion().setFromUnitVectors(restMoved, target);
        const worldQ = swing.clone().multiply(deltaParent).multiply(bindQ[bone]);
        accumQ[bone] = worldQ;
        const localQ = accumQ[parentName].clone().invert().multiply(worldQ);     // 로컬 = 부모월드^-1 * 월드
        if (smooth && prevLocal[bone]) localQ.slerp(prevLocal[bone], smooth);
        prevLocal[bone] = localQ.clone();
        tracks[bone].push(localQ);
        parentName = bone;   // 체인 하강: 다음 본의 부모 = 이 본
      }
    }
  }
  // 트랙 → 클립
  const kt = [];
  const T = new Float32Array(times);
  for (const n in tracks) {
    const arr = tracks[n]; if (!arr.length) continue;
    const buf = new Float32Array(arr.length * 4);
    arr.forEach((q, i) => { buf[i * 4] = q.x; buf[i * 4 + 1] = q.y; buf[i * 4 + 2] = q.z; buf[i * 4 + 3] = q.w; });
    kt.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', T, buf));
  }
  return new THREE.AnimationClip('mocap', poseData.dur, kt);
}

