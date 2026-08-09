// BVH(Bandai·CMU) → X Bot AnimationClip JSON 오프라인 변환기
// 사용: node scripts/retarget_bvh.mjs [jobName ...]  (무인자 = 전체 JOBS)
// 출력: assets/mocap/xclip-<name>.json  (THREE.AnimationClip.parse로 로드)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
// Rokoko Vision(AI 비디오 모캡) 골격 — 클린 데이터, 손가락 포함. Spine 4개 → 3개 분배.
const RK_NAMES = {
  mixamorigHips: 'Hips',
  mixamorigSpine: 'Spine1',
  mixamorigSpine1: 'Spine3',
  mixamorigSpine2: 'Spine4',
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
  mixamorigLeftUpLeg: 'LeftThigh',
  mixamorigLeftLeg: 'LeftShin',
  mixamorigLeftFoot: 'LeftFoot',
  mixamorigLeftToeBase: 'LeftToe',
  mixamorigRightUpLeg: 'RightThigh',
  mixamorigRightLeg: 'RightShin',
  mixamorigRightFoot: 'RightFoot',
  mixamorigRightToeBase: 'RightToe',
};
// 언리얼(UE5) 마네킹 골격 — Fab 마켓 표준 리깅 (root/pelvis/spine_01..05/clavicle_l...)
const UE_NAMES = {
  mixamorigHips: 'pelvis',
  mixamorigSpine: 'spine_01',
  mixamorigSpine1: 'spine_03',
  mixamorigSpine2: 'spine_05',
  mixamorigNeck: 'neck_01',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'clavicle_l',
  mixamorigLeftArm: 'upperarm_l',
  mixamorigLeftForeArm: 'lowerarm_l',
  mixamorigLeftHand: 'hand_l',
  mixamorigRightShoulder: 'clavicle_r',
  mixamorigRightArm: 'upperarm_r',
  mixamorigRightForeArm: 'lowerarm_r',
  mixamorigRightHand: 'hand_r',
  mixamorigLeftUpLeg: 'thigh_l',
  mixamorigLeftLeg: 'calf_l',
  mixamorigLeftFoot: 'foot_l',
  mixamorigLeftToeBase: 'ball_l',
  mixamorigRightUpLeg: 'thigh_r',
  mixamorigRightLeg: 'calf_r',
  mixamorigRightFoot: 'foot_r',
  mixamorigRightToeBase: 'ball_r',
};
// CMU daz-friendly BVH (outworldz/cgspeed 변환본: hip/abdomen/chest/lCollar...)
const DAZ_NAMES = {
  mixamorigHips: 'hip', mixamorigSpine: 'abdomen', mixamorigSpine1: 'chest',
  mixamorigNeck: 'neck', mixamorigHead: 'head',
  mixamorigLeftShoulder: 'lCollar', mixamorigLeftArm: 'lShldr', mixamorigLeftForeArm: 'lForeArm', mixamorigLeftHand: 'lHand',
  mixamorigRightShoulder: 'rCollar', mixamorigRightArm: 'rShldr', mixamorigRightForeArm: 'rForeArm', mixamorigRightHand: 'rHand',
  mixamorigLeftUpLeg: 'lThigh', mixamorigLeftLeg: 'lShin', mixamorigLeftFoot: 'lFoot',
  mixamorigRightUpLeg: 'rThigh', mixamorigRightLeg: 'rShin', mixamorigRightFoot: 'rFoot',
};
const MF_DIR = '/Users/iil-yeo/Downloads/motifect_sports_and_athletics_v1_0_fbx/Animations';

// SFU/NUS: 접두사 없는 Mixamo 본명(Hips/Spine/Spine1/Neck/…) — Spine2 없음
const SFU_NAMES = {
  mixamorigHips: 'Hips', mixamorigSpine: 'Spine', mixamorigSpine1: 'Spine1',
  mixamorigNeck: 'Neck', mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'LeftShoulder', mixamorigLeftArm: 'LeftArm', mixamorigLeftForeArm: 'LeftForeArm', mixamorigLeftHand: 'LeftHand',
  mixamorigRightShoulder: 'RightShoulder', mixamorigRightArm: 'RightArm', mixamorigRightForeArm: 'RightForeArm', mixamorigRightHand: 'RightHand',
  mixamorigLeftUpLeg: 'LeftUpLeg', mixamorigLeftLeg: 'LeftLeg', mixamorigLeftFoot: 'LeftFoot', mixamorigLeftToeBase: 'LeftToeBase',
  mixamorigRightUpLeg: 'RightUpLeg', mixamorigRightLeg: 'RightLeg', mixamorigRightFoot: 'RightFoot', mixamorigRightToeBase: 'RightToeBase',
};

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
  mf_block: { file: `${MF_DIR}/basketball_block_attempt.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_chest_pass: { file: `${MF_DIR}/basketball_chest_pass.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_sprint_start: { file: `${MF_DIR}/sprint_start_blocks.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true, keepRootXZ: true },
  mf_layup: { file: `${MF_DIR}/basketball_layup.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_marathon: { file: `${MF_DIR}/marathon_pace_run.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true },
  mf_boxing_footwork: { file: `${MF_DIR}/boxing_stance_footwork.fbx`, type: 'fbx', names: MF_NAMES, hip: 'Hips', fps: 30, yScale: true, keepRootXZ: true },
  // SFU/NUS 모캡 DB (mocap.cs.sfu.ca, 무료·무가입) — Mixamo 무프리픽스 본명 = 직결 맵
  sfu_jumprope: { file: 'public/mocap/sfu/0005_JumpRope001.bvh', names: SFU_NAMES, hip: 'Hips', fps: 30, yScale: true },
  sfu_jogging: { file: 'public/mocap/sfu/0005_Jogging001.bvh', names: SFU_NAMES, hip: 'Hips', fps: 30, yScale: true, keepRootXZ: true },
  // CMU 추가분 — 스트레칭 전용·워밍업 루틴·농구
  cmu_stretch2: { file: 'public/mocap/cmu/77_21.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true },                       // 77_21 stretching (10.9s)
  cmu_stretch3: { file: 'public/mocap/cmu/83_22.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true },                       // 83_22 stretching (44.8s)
  cmu_warmup_routine: { file: 'public/mocap/cmu/14_06.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true },                 // 14_06 점핑잭·조깅·스쿼트·트위스트·스트레치 (44.7s)
  cmu_crossover_turn: { file: 'public/mocap/cmu/06_12.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, keepRootXZ: true }, // 06_12 크로스오버+90도턴 드리블
  cmu_dribble_shot: { file: 'public/mocap/cmu/06_15.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true },                   // 06_15 드리블→슛 (4.6s)
  // Rokoko Vision 비디오 모캡 (스텝백 튜토리얼 12.8s) — 실제 이동 보존(keepRootXZ)
  rk_stepback: { file: 'assets/anim-rk-stepback.fbx', type: 'fbx', names: RK_NAMES, hip: 'Hips', fps: 30, yScale: true, keepRootXZ: true },
  // Fab 크로스오버 (UE 마네킹 리깅, 유저 다운로드)
  fab_crossover: { file: 'assets/anim-fab-crossover.fbx', type: 'fbx', names: UE_NAMES, hip: 'pelvis', fps: 30, noHipPos: true },
  // CMU 06 신규 — 전진/후진/사이드 드리블(이동형: keepRootXZ)
  cmu_dribble_fwd: { file: 'public/mocap/cmu/06_02.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, keepRootXZ: true },
  cmu_dribble_back: { file: 'public/mocap/cmu/06_06.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, keepRootXZ: true },
  cmu_dribble_side: { file: 'public/mocap/cmu/06_08.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, keepRootXZ: true },
  // ── 대량 자동 이식(--auto): 에이전트 인덱스 선별 32종 ──
  cmu06_03: { file: 'public/mocap/cmu/06_03.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu06_04: { file: 'public/mocap/cmu/06_04.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu06_05: { file: 'public/mocap/cmu/06_05.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu06_07: { file: 'public/mocap/cmu/06_07.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu06_09: { file: 'public/mocap/cmu/06_09.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu06_10: { file: 'public/mocap/cmu/06_10.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu06_11: { file: 'public/mocap/cmu/06_11.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu86_14: { file: 'public/mocap/cmu/86_14.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu124_03: { file: 'public/mocap/cmu/124_03.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball' },
  cmu124_04: { file: 'public/mocap/cmu/124_04.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball' },
  cmu124_05: { file: 'public/mocap/cmu/124_05.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball' },
  cmu124_06: { file: 'public/mocap/cmu/124_06.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
  cmu13_18: { file: 'public/mocap/cmu/13_18.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'boxing' },
  cmu14_02: { file: 'public/mocap/cmu/14_02.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'boxing' },
  cmu14_03: { file: 'public/mocap/cmu/14_03.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'boxing' },
  cmu143_23: { file: 'public/mocap/cmu/143_23.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'boxing' },
  cmu144_20: { file: 'public/mocap/cmu/144_20.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'boxing' },
  cmu88_09: { file: 'public/mocap/cmu/88_09.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'stretch' },
  cmu88_10: { file: 'public/mocap/cmu/88_10.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'stretch' },
  cmu88_11: { file: 'public/mocap/cmu/88_11.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'stretch' },
  cmu114_10: { file: 'public/mocap/cmu/114_10.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'stretch' },
  cmu114_12: { file: 'public/mocap/cmu/114_12.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'stretch' },
  cmu141_13: { file: 'public/mocap/cmu/141_13.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'stretch' },
  cmu13_29: { file: 'public/mocap/cmu/13_29.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'warmup' },
  cmu13_30: { file: 'public/mocap/cmu/13_30.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'warmup' },
  cmu14_14: { file: 'public/mocap/cmu/14_14.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'warmup' },
  cmu14_20: { file: 'public/mocap/cmu/14_20.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'warmup' },
  cmu86_02: { file: 'public/mocap/cmu/86_02.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'warmup', keepRootXZ: true, yaw180: true },
  cmu144_17: { file: 'public/mocap/cmu/144_17.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'lunge' },
  cmu144_11: { file: 'public/mocap/cmu/144_11.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'lunge' },
  cmu144_12: { file: 'public/mocap/cmu/144_12.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'lunge' },
  cmu144_18: { file: 'public/mocap/cmu/144_18.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'lunge' },
  cmu02_03: { file: 'public/mocap/cmu/02_03.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'run', keepRootXZ: true, yaw180: true },
  cmu09_01: { file: 'public/mocap/cmu/09_01.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'run', keepRootXZ: true, yaw180: true },
  cmu07_12: { file: 'public/mocap/cmu/07_12.bvh', names: DAZ_NAMES, hip: 'hip', fps: 30, yScale: true, cat: 'walk', keepRootXZ: true, yaw180: true },
  // ── CMU 102 = **농구 풋워크 전용 세트**(BK-B-CURRICULUM §0-1) — 스텝백 조각 재료(08-10) ──
  //   페인트·수비 풋워크라 몸이 실제로 이동한다 → keepRootXZ. 본명 Hips = una-dinosauria(CMU_NAMES).
  //   18/19 FeintLeft/RightMove: '딛는 척 → 반대로 끊기' — 스텝백 하체와 가장 가까운 보유 원본.
  cmu102_13: { file: 'public/mocap/cmu/102_13.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true },  // OffensiveMoveGoRight
  cmu102_14: { file: 'public/mocap/cmu/102_14.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true },  // OffensiveMoveGoLeft
  cmu102_18: { file: 'public/mocap/cmu/102_18.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true },  // FeintLeftMoveRight
  cmu102_19: { file: 'public/mocap/cmu/102_19.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true },  // FeintRightMoveLeft
  cmu102_27: { file: 'public/mocap/cmu/102_27.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true },  // DefensiveMoveSideToSide
  cmu102_28: { file: 'public/mocap/cmu/102_28.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true },  // DefensiveMoveSideToSide
  // ── stretch 키워드 전수 이식(2차): una-dinosauria BVH(Hips 본명 = CMU_NAMES) ──
  cmu49_18: { file: 'public/mocap/cmu/49_18.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },   // 한발 밸런스+팔 뻗기
  cmu49_19: { file: 'public/mocap/cmu/49_19.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu49_20: { file: 'public/mocap/cmu/49_20.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu74_02: { file: 'public/mocap/cmu/74_02.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },   // 비네트: 하품·스트레치 등
  cmu74_03: { file: 'public/mocap/cmu/74_03.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu74_04: { file: 'public/mocap/cmu/74_04.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu74_05: { file: 'public/mocap/cmu/74_05.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu74_06: { file: 'public/mocap/cmu/74_06.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu74_07: { file: 'public/mocap/cmu/74_07.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu74_08: { file: 'public/mocap/cmu/74_08.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu86_03: { file: 'public/mocap/cmu/86_03.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },  // 걷기·달리기·스트레치 종합
  cmu86_04: { file: 'public/mocap/cmu/86_04.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu86_06: { file: 'public/mocap/cmu/86_06.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu86_07: { file: 'public/mocap/cmu/86_07.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu86_08: { file: 'public/mocap/cmu/86_08.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu86_11: { file: 'public/mocap/cmu/86_11.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu88_04: { file: 'public/mocap/cmu/88_04.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },  // 스트레치+카트휠·플립
  cmu111_32: { file: 'public/mocap/cmu/111_32.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },  // 기지개+하품
  cmu113_23: { file: 'public/mocap/cmu/113_23.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },
  cmu114_16: { file: 'public/mocap/cmu/114_16.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' }, // 앉아서 스트레치
  cmu133_08: { file: 'public/mocap/cmu/133_08.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true }, // 스트레치 워크
  cmu133_09: { file: 'public/mocap/cmu/133_09.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu133_10: { file: 'public/mocap/cmu/133_10.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch', keepRootXZ: true },
  cmu143_30: { file: 'public/mocap/cmu/143_30.bvh', names: CMU_NAMES, hip: 'Hips', fps: 30, yScale: true, cat: 'stretch' },  // 기지개+하품
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
  // 멀티 스킨드메시 FBX(Rokoko 등): 첫 메시 스켈레톤이 부분 본만 가짐 → 계층 전체 본 통합
  {
    const all = []; const seen = new Set();
    g.traverse(o => { if (o.isBone && !seen.has(o.name)) { seen.add(o.name); all.push(o); } });
    if (all.length > bones.length) bones = all;
  }
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

// ★ URL.pathname 은 윈도우에서 '/C:/...' 를 내놓아 resolve 가 'C:\C:\...' 를 만든다 — fileURLToPath 가 정답.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const AUTO = process.argv.includes('--auto');
const wanted = process.argv.slice(2).filter(a => a !== '--auto');
const AUTO_DIR = path.join(ROOT, 'assets/mocap/auto');
if (AUTO) fs.mkdirSync(AUTO_DIR, { recursive: true });
const AUTO_MAN = path.join(AUTO_DIR, 'auto-manifest.json');
const autoMan = AUTO && fs.existsSync(AUTO_MAN) ? JSON.parse(fs.readFileSync(AUTO_MAN, 'utf8')) : {};
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

  // fkHip: 힙 위치를 소스 FK '월드좌표'에서 재계산 — 로컬 트랙 단위/부모 스케일/축이 뒤엉킨
  // 리그(UE 마네킹 등)에서 트랙값 스케일링이 폭주하는 문제의 정공법. 스케일 k = 바인드 힙높이/소스 서있는 힙높이.
  if (job.noHipPos) {
    // 업축 뒤엉킨 리그(일부 Fab/UE 익스포트): 힙 위치 신뢰 불가 → 바인드 상수 고정(회전만).
    // 접지는 런타임 per-frame 클램프가 담당 (grounded 세트에 넣지 말 것).
    const hipT = clip.tracks.find(t => t.name.endsWith('Hips.position'));
    if (hipT) for (let i = 0; i < hipT.times.length; i++) {
      hipT.values[i * 3] = hipsBindPos.x; hipT.values[i * 3 + 1] = hipsBindPos.y; hipT.values[i * 3 + 2] = hipsBindPos.z;
    }
  }
  if (job.fkHip) {
    const hipT = clip.tracks.find(t => t.name.endsWith('Hips.position'));
    if (hipT) {
      const srcHip = res.skeleton.bones.find(b => b.name === job.hip);
      let srcRoot = srcHip; while (srcRoot.parent) srcRoot = srcRoot.parent;
      const smixer = new THREE.AnimationMixer(srcRoot);
      smixer.clipAction(res.clip).play();
      const wv = new THREE.Vector3();
      smixer.setTime(1e-4); srcRoot.updateMatrixWorld(true);
      wv.setFromMatrixPosition(srcHip.matrixWorld);
      const y0w = wv.y, x0w = wv.x, z0w = wv.z;
      const k = hipsBindPos.y / Math.max(1e-6, y0w);
      const times = hipT.times, vals = hipT.values;
      for (let i = 0; i < times.length; i++) {
        smixer.setTime(Math.max(1e-4, times[i] * (job.slow || 1) + (job.trim ? job.trim[0] : 0)));
        srcRoot.updateMatrixWorld(true);
        wv.setFromMatrixPosition(srcHip.matrixWorld);
        vals[i * 3] = job.keepRootXZ ? (wv.x - x0w) * k + hipsBindPos.x : hipsBindPos.x;
        vals[i * 3 + 1] = (wv.y - y0w) * k + hipsBindPos.y;
        vals[i * 3 + 2] = job.keepRootXZ ? (wv.z - z0w) * k + hipsBindPos.z : hipsBindPos.z;
      }
    }
  }
  // 제자리화 + 높이 정규화: 루트 이동은 시뮬레이터 경로가 담당 → XZ는 바인드 위치에 고정,
  // Y는 프레임0을 바인드 힙 높이에 맞추고 바운스(델타)만 유지 (소스 리그와 절대 높이 다름)
  const hipTrack = (job.fkHip || job.noHipPos) ? null : clip.tracks.find(t => t.name.endsWith('Hips.position'));
  if (hipTrack) {
    const v = hipTrack.values;
    const y0 = v[1], x0 = v[0], z0 = v[2];
    // CMU: 소스 리그 키가 커서(단위 상이) Y 델타를 신장비로 스케일 (Bandai는 기존 그대로 k=1)
    const k = job.yScale && y0 > 1e-6 ? hipsBindPos.y / y0 : 1;
    for (let i = 0; i < v.length; i += 3) {
      // keepRootXZ: 풋워크류(몸이 실제 이동)는 XZ 델타 보존 — 제자리화하면 이동량만큼
      // 발이 미끄러짐(복싱 풋워크 4.3m 슬라이드 실측). 기본은 기존 제자리화(팩 경로가 이동 담당).
      if (job.keepRootXZ) {
        v[i] = (v[i] - x0) * k + hipsBindPos.x;
        v[i + 2] = (v[i + 2] - z0) * k + hipsBindPos.z;
      } else {
        v[i] = hipsBindPos.x;
        v[i + 2] = hipsBindPos.z;
      }
      v[i + 1] = (v[i + 1] - y0) * k + hipsBindPos.y;
    }
  }

  // yaw180: 소스 전진 방향이 X봇 전방(-z)과 반대인 클립 보정 — 힙 위치 델타·회전 180°
  if (job.yaw180 && hipTrack) {
    const v = hipTrack.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = 2 * hipsBindPos.x - v[i];
      v[i + 2] = 2 * hipsBindPos.z - v[i + 2];
    }
    const hq = clip.tracks.find(t => t.name.endsWith('Hips.quaternion'));
    if (hq) { const q = hq.values; for (let i = 0; i < q.length; i += 4) {
      const x = q[i], y = q[i+1], z = q[i+2], w = q[i+3];
      q[i] = z; q[i+1] = w; q[i+2] = -x; q[i+3] = -y;   // Ry(π) ⊗ q
    } }
  }

  // 접지 베이크 — 클립 전 구간 FK로 최저 발 높이를 바인드 발 높이에 1회 정렬.
  // 런타임 per-frame 클램프가 점프 클립과 매 프레임 싸우며 만들던 덜커덩(수직 홱당김) 제거:
  // 이 클립들은 재생 시 클램프를 끈다(xbot._groundedClips).
  {
    const feet = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot']
      .map(n => xbot.getObjectByName(n)).filter(Boolean);
    const v = new THREE.Vector3();
    const minFeetY = () => { let m = Infinity; for (const f of feet) { v.setFromMatrixPosition(f.matrixWorld); m = Math.min(m, v.y); } return m; };
    target.skeleton.pose(); xbot.updateMatrixWorld(true);
    const bindMin = minFeetY();
    const mixer = new THREE.AnimationMixer(xbot);
    mixer.clipAction(clip).play();
    let clipMin = Infinity;
    const ns = Math.max(2, Math.round(clip.duration * 30));
    for (let i = 0; i <= ns; i++) {
      mixer.setTime(clip.duration * i / ns - 1e-4 > 0 ? clip.duration * i / ns - 1e-4 : 0);
      xbot.updateMatrixWorld(true);
      clipMin = Math.min(clipMin, minFeetY());
    }
    mixer.stopAllAction(); mixer.uncacheRoot(xbot);
    const hip = clip.tracks.find(t => t.name.endsWith('Hips.position'));
    if (hip && isFinite(clipMin)) {
      const shift = clipMin - bindMin;
      for (let i = 1; i < hip.values.length; i += 3) hip.values[i] -= shift;
      console.log(`  ${name}: 접지 베이크 시프트 ${(-shift).toFixed(1)}cm`);
    }
    target.skeleton.pose(); xbot.updateMatrixWorld(true);
  }

  const json = THREE.AnimationClip.toJSON(clip);
  const out = AUTO ? path.join(AUTO_DIR, `${name}.json`) : path.join(outDir, `xclip-${name}.json`);
  fs.writeFileSync(out, JSON.stringify(json));
  if (AUTO) { autoMan[name] = { root: !!job.keepRootXZ, dur: +clip.duration.toFixed(2), cat: job.cat || '' }; fs.writeFileSync(AUTO_MAN, JSON.stringify(autoMan, null, 1)); }
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`  ${name}: ${clip.duration.toFixed(2)}s · 트랙 ${clip.tracks.length} · ${kb}KB${AUTO ? ' [auto]' : ''}`);
}
console.log('완료');
