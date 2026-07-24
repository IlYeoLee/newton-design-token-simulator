# Blender 헤드리스 리타겟 — 임의 리그(UE 마네킹 등) FBX 애니 → X봇(mixamorig) FBX.
# three.js FBXLoader가 언리얼 좌표계/단위를 잘못 읽어 깨지던 문제의 정공법:
# Blender의 검증된 FBX 임포터로 소스를 '정확한 월드 트랜스폼'으로 읽고,
# 월드공간 델타 회전(R_src(t)·R_srcRest⁻¹)을 X봇 레스트에 곱해 프레임별 베이크한다.
#   blender -b -P scripts/blender_retarget.py -- <source.fbx> <out.fbx> [ue|auto]
import bpy, sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
XBOT = "assets/xbot.fbx"

UE_MAP = {  # mixamorig → UE5 마네킹
    'mixamorigHips': 'pelvis', 'mixamorigSpine': 'spine_01', 'mixamorigSpine1': 'spine_03',
    'mixamorigSpine2': 'spine_05', 'mixamorigNeck': 'neck_01', 'mixamorigHead': 'head',
    'mixamorigLeftShoulder': 'clavicle_l', 'mixamorigLeftArm': 'upperarm_l',
    'mixamorigLeftForeArm': 'lowerarm_l', 'mixamorigLeftHand': 'hand_l',
    'mixamorigRightShoulder': 'clavicle_r', 'mixamorigRightArm': 'upperarm_r',
    'mixamorigRightForeArm': 'lowerarm_r', 'mixamorigRightHand': 'hand_r',
    'mixamorigLeftUpLeg': 'thigh_l', 'mixamorigLeftLeg': 'calf_l',
    'mixamorigLeftFoot': 'foot_l', 'mixamorigLeftToeBase': 'ball_l',
    'mixamorigRightUpLeg': 'thigh_r', 'mixamorigRightLeg': 'calf_r',
    'mixamorigRightFoot': 'foot_r', 'mixamorigRightToeBase': 'ball_r',
}

MF_MAP = {  # mixamorig → Motifect (Hips/Spine1/Spine2/Chest/Neck1...)
    'mixamorigHips': 'Hips', 'mixamorigSpine': 'Spine1', 'mixamorigSpine1': 'Spine2',
    'mixamorigSpine2': 'Chest', 'mixamorigNeck': 'Neck1', 'mixamorigHead': 'Head',
    'mixamorigLeftShoulder': 'LeftShoulder', 'mixamorigLeftArm': 'LeftArm',
    'mixamorigLeftForeArm': 'LeftForeArm', 'mixamorigLeftHand': 'LeftHand',
    'mixamorigRightShoulder': 'RightShoulder', 'mixamorigRightArm': 'RightArm',
    'mixamorigRightForeArm': 'RightForeArm', 'mixamorigRightHand': 'RightHand',
    'mixamorigLeftUpLeg': 'LeftLeg', 'mixamorigLeftLeg': 'LeftShin',
    'mixamorigLeftFoot': 'LeftFoot', 'mixamorigLeftToeBase': 'LeftToeBase',
    'mixamorigRightUpLeg': 'RightLeg', 'mixamorigRightLeg': 'RightShin',
    'mixamorigRightFoot': 'RightFoot', 'mixamorigRightToeBase': 'RightToeBase',
}

def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=True, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    return arm, new

bpy.ops.wm.read_factory_settings(use_empty=True)
src_arm, src_objs = import_fbx(SRC)
tgt_arm, tgt_objs = import_fbx(XBOT)
scn = bpy.context.scene

# 소스 리그 자동 감지: UE(pelvis) / Motifect(Hips+Chest) / 그 외 UE_MAP 기본
_src_bones = set(b.name for b in src_arm.data.bones)
if 'pelvis' in _src_bones:
    pass  # UE_MAP 그대로
elif 'Chest' in _src_bones:
    UE_MAP = MF_MAP
    print('[rt] source rig: Motifect (Hips=오브젝트)')
else:
    print('[rt] source rig: UE(기본) — 본 목록:', sorted(list(_src_bones))[:8])

# Blender는 mixamo 본을 'mixamorig:Hips'(콜론)로 읽음 — 양쪽 표기 해석
def T(name):
    if name in tgt_arm.data.bones: return name
    alt = name.replace('mixamorig', 'mixamorig:')
    if alt in tgt_arm.data.bones: return alt
    raise KeyError(name)
UE_MAP = { (k if k in tgt_arm.data.bones else k.replace('mixamorig', 'mixamorig:')): v for k, v in UE_MAP.items() }
HIP_T = 'mixamorigHips' if 'mixamorigHips' in tgt_arm.data.bones else 'mixamorig:Hips'

# 소스 액션 프레임 범위
act = (src_arm.animation_data and src_arm.animation_data.action)
if not act:
    for o in src_objs:
        if o.animation_data and o.animation_data.action: act = o.animation_data.action; break
f0, f1 = (int(act.frame_range[0]), int(act.frame_range[1])) if act else (1, 100)
print(f"[rt] frames {f0}..{f1}")

# 레스트 월드 회전 캡처 (프레임 f0에서 소스 '첫 포즈'가 아니라 진짜 rest = edit bone 기준)
def rest_world_rot(arm, bone):
    return (arm.matrix_world @ arm.data.bones[bone].matrix_local).to_quaternion()

def pose_world_rot(arm, bone):
    return (arm.matrix_world @ arm.pose.bones[bone].matrix).to_quaternion()

HIP_OBJ = UE_MAP.get(HIP_T) not in src_arm.data.bones
pairs = []
for t, s in UE_MAP.items():
    if t in tgt_arm.pose.bones and s in src_arm.pose.bones:
        pairs.append((t, s, rest_world_rot(tgt_arm, t), rest_world_rot(src_arm, s)))
print(f"[rt] mapped bones: {len(pairs)}  hipObj: {HIP_OBJ}")

# 힙 스케일 (서있는 높이 비율) — 소스 rest 힙 월드높이 vs X봇
scn.frame_set(f0)
bpy.context.view_layer.update()
if HIP_OBJ:
    hip0 = src_arm.matrix_world.translation.copy()
    hipR0 = src_arm.matrix_world.to_quaternion()
    src_hip_h = hip0.z
else:
    src_hip_h = (src_arm.matrix_world @ src_arm.data.bones[UE_MAP[HIP_T]].matrix_local).translation.z
    src_hip = UE_MAP[HIP_T]
    hip0 = (src_arm.matrix_world @ src_arm.pose.bones[src_hip].matrix).translation.copy()
tgt_hip_h = (tgt_arm.matrix_world @ tgt_arm.data.bones[HIP_T].matrix_local).translation.z
# 스케일 k = 다리 길이 비율(허벅지+정강이) — 첫 프레임이 쪼그린 자세여도 안전
def leg_len(arm, up, lo, foot):
    b = arm.data.bones
    if up in b and lo in b and foot in b:
        return (b[up].head_local - b[lo].head_local).length + (b[lo].head_local - b[foot].head_local).length
    return None
UP_T, LO_T, FT_T = T('mixamorigLeftUpLeg'), T('mixamorigLeftLeg'), T('mixamorigLeftFoot')
tll = leg_len(tgt_arm, UP_T, LO_T, FT_T)
sll = leg_len(src_arm, UE_MAP[UP_T], UE_MAP[LO_T], UE_MAP[FT_T])
# 소스 스케일: armature 오브젝트 스케일 반영
if sll is not None: sll *= (src_arm.matrix_world.to_scale().z)
if tll is not None: tll *= (tgt_arm.matrix_world.to_scale().z)
k = (tll / sll) if (tll and sll) else (tgt_hip_h / max(1e-6, src_hip_h))
print(f"[rt] hip: srcH {src_hip_h:.3f} tgtH {tgt_hip_h:.3f} legRatio k {k:.3f}")
tgt_hip_rest = (tgt_arm.matrix_world @ tgt_arm.data.bones[HIP_T].matrix_local).translation.copy()
tgt_hip_rest_q = (tgt_arm.matrix_world @ tgt_arm.data.bones[HIP_T].matrix_local).to_quaternion()

# 타겟 새 액션
tgt_arm.animation_data_create()
new_act = bpy.data.actions.new("retarget")
tgt_arm.animation_data.action = new_act
for pb in tgt_arm.pose.bones: pb.rotation_mode = 'QUATERNION'

for f in range(f0, f1 + 1):
    scn.frame_set(f)
    bpy.context.view_layer.update()
    for tname, sname, tRest, sRest in pairs:
        delta = pose_world_rot(src_arm, sname) @ sRest.inverted()
        world_q = delta @ tRest
        pb = tgt_arm.pose.bones[tname]
        # 월드 → 본 로컬: parent(pose) 월드행렬 역 · world
        if pb.parent:
            parent_w = tgt_arm.matrix_world @ pb.parent.matrix
        else:
            parent_w = tgt_arm.matrix_world
        # matrix_basis 설정: local = (parent_w · bone_rest_local_offset)⁻¹ · world
        rest_local = tgt_arm.data.bones[tname].matrix_local
        parent_rest = tgt_arm.data.bones[tname].parent.matrix_local if tgt_arm.data.bones[tname].parent else Matrix.Identity(4)
        offset = parent_rest.inverted() @ rest_local
        basis_q = (parent_w.to_quaternion() @ offset.to_quaternion()).inverted() @ world_q
        pb.rotation_quaternion = basis_q
        pb.keyframe_insert('rotation_quaternion', frame=f)
    # 힙: 오브젝트 힙(Motifect)이면 회전도 여기서 처리
    if HIP_OBJ:
        world_q = (src_arm.matrix_world.to_quaternion() @ hipR0.inverted()) @ tgt_hip_rest_q
        pbh = tgt_arm.pose.bones[HIP_T]
        rest_local_h = tgt_arm.data.bones[HIP_T].matrix_local
        basis_qh = (tgt_arm.matrix_world.to_quaternion() @ rest_local_h.to_quaternion()).inverted() @ world_q
        pbh.rotation_quaternion = basis_qh
        pbh.keyframe_insert('rotation_quaternion', frame=f)
    # 힙 위치: 월드 델타 × k + 타겟 레스트
    hipw = src_arm.matrix_world.translation if HIP_OBJ else (src_arm.matrix_world @ src_arm.pose.bones[src_hip].matrix).translation
    d = (hipw - hip0) * k
    world_p = tgt_hip_rest + d
    pb = tgt_arm.pose.bones[HIP_T]
    rest_local = tgt_arm.data.bones[HIP_T].matrix_local
    local_p = (tgt_arm.matrix_world @ rest_local).inverted() @ world_p
    pb.location = local_p
    pb.keyframe_insert('location', frame=f)
    bpy.context.view_layer.update()

# 소스 삭제, 타겟만 FBX 익스포트 (애니 포함)
for o in src_objs:
    try: bpy.data.objects.remove(o, do_unlink=True)
    except Exception: pass
scn.frame_start, scn.frame_end = f0, f1
bpy.ops.object.select_all(action='DESELECT')
for o in tgt_objs: o.select_set(True)
bpy.context.view_layer.objects.active = tgt_arm
bpy.ops.export_scene.fbx(filepath=OUT, use_selection=True, bake_anim=True,
                         bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                         add_leaf_bones=False, mesh_smooth_type='OFF')
print(f"[rt] exported {OUT}")
