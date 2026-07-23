import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

// ── FBX 애니 로드 + mixamorig 리타겟 (순수 로컬, 바인드 차이 보정) ──
//   Motifect 등: 뼈 이름=Hips/LeftArm...(mixamorig 접두어만 없음), 스켈레톤 구조 동일.
//   접두어 리네임만 하면 스케일·접지는 맞으나 바인드가 다른 팔이 뒤틀림 → 각 본에
//   newLocal = targetBind · inv(sourceBind) · sourceLocal 을 적용(바인드 차이만 보정, 스케일 그대로).
export async function loadRetargetedFbx(url, xbotModel) {
  const fbx = await new FBXLoader().loadAsync(url);
  const clip = (fbx.animations && fbx.animations[0]);
  if (!clip) throw new Error('no animation in fbx');
  // 소스 바인드 로컬(로드 직후 rest)
  const srcBind = {};
  fbx.traverse(o => { if (o.isBone && !srcBind[o.name]) srcBind[o.name] = o.quaternion.clone(); });
  // 타겟(x봇) 스켈레톤 + 바인드 로컬(boneInverses → 월드 → 로컬)
  let tgtSkel = null; xbotModel.traverse(o => { if (o.isSkinnedMesh && o.skeleton) tgtSkel = o.skeleton; });
  if (!tgtSkel) throw new Error('no target skeleton');
  const bw = {};
  tgtSkel.bones.forEach((b, i) => {
    const m = tgtSkel.boneInverses[i].clone().invert();
    const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); bw[b.name] = q;
  });
  const tgtBind = {}, tgtNames = new Set();
  tgtSkel.bones.forEach(b => {
    tgtNames.add(b.name);
    const p = (b.parent && b.parent.isBone && bw[b.parent.name]) ? bw[b.parent.name] : new THREE.Quaternion();
    tgtBind[b.name] = p.clone().invert().multiply(bw[b.name]);
  });
  const tracks = [], qs = new THREE.Quaternion(), qt = new THREE.Quaternion();
  for (const tr of clip.tracks) {
    if (!/\.quaternion$/.test(tr.name)) continue;
    const src = tr.name.replace(/\.quaternion$/, '');
    const tgt = src.startsWith('mixamorig') ? src : 'mixamorig' + src;
    if (!tgtNames.has(tgt) || !srcBind[src] || !tgtBind[tgt]) continue;
    const corr = tgtBind[tgt].clone().multiply(srcBind[src].clone().invert());   // targetBind · inv(sourceBind)
    const v = tr.values, n = tr.times.length, out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      qs.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
      qt.copy(corr).multiply(qs);                                                 // newLocal = corr · sourceLocal
      out[i * 4] = qt.x; out[i * 4 + 1] = qt.y; out[i * 4 + 2] = qt.z; out[i * 4 + 3] = qt.w;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(tgt + '.quaternion', tr.times, out));
  }
  if (!tracks.length) throw new Error('no matching bone tracks');
  return new THREE.AnimationClip('fbx_' + (clip.name || 'c'), clip.duration, tracks);
}

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
  const times = [];
  const prevLocal = {};
  const _b = new THREE.Vector3(), _rest = new THREE.Vector3();
  for (const fr of poseData.frames) {
    times.push(fr.t);
    const P = fr.lm.map(toScene);
    const accumQ = {};   // 본별 리타겟 월드 쿼터니언
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

