# ─────────────────────────────────────────────────────────────
# 영상 → 3D 포즈 → 발 접지 → 팩 자동 생성 (전문가 이식 소스 어댑터 3호: 영상)
#
#   주장: BVH(러닝)·SportVU(커리)에 이어, 일반 영상(유튜브·연습클립)에서도
#   전문가 시그니처를 기계 추출한다. 단 monocular 포즈는 오차가 크므로
#   추출 신뢰도를 sourceError로 정직 표기한다 — 숨기지 않는다.
#
#   입력: 영상 파일(mp4/mov/webm) 또는 프레임 디렉터리(--frames dir --fps N)
#   출력: 포즈 타임라인 JSON + 접지 검출 결과 (+ --pack 시 stepMark 팩)
#
#   폐루프 검증: 시뮬 봇을 캡처한 "정답을 아는 영상"(scripts/capture_frames.mjs)으로
#   접지 타이밍/레인을 팩 원본과 대조 → 영상 추출의 실측 오차 = sourceError 근거.
#
#   모델: assets/models/pose_landmarker_heavy.task (MediaPipe Tasks, float16, ~29MB, git 미포함)
#     curl -L -o assets/models/pose_landmarker_heavy.task \
#       https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
#   의존성: pip3 install mediapipe opencv-python  /  캡처: node scripts/capture_frames.mjs
#   사용:
#     python3 scripts/video_pose_extract.py --video clip.mp4 --out data/pose.json
#     python3 scripts/video_pose_extract.py --frames /tmp/frames --fps 30 --out data/pose.json
# ─────────────────────────────────────────────────────────────
import argparse, json, math, os, sys, glob

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

MODEL = os.path.join(os.path.dirname(__file__), '..', 'assets', 'models', 'pose_landmarker_heavy.task')

# MediaPipe Pose 33 landmark 순서 (Tasks API에는 이름 enum이 없어 명시)
LM_NAMES = [
    'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 'RIGHT_EYE_INNER', 'RIGHT_EYE',
    'RIGHT_EYE_OUTER', 'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT',
    'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW', 'LEFT_WRIST', 'RIGHT_WRIST',
    'LEFT_PINKY', 'RIGHT_PINKY', 'LEFT_INDEX', 'RIGHT_INDEX', 'LEFT_THUMB', 'RIGHT_THUMB',
    'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE',
    'LEFT_HEEL', 'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX',
]
IDX = {n: i for i, n in enumerate(LM_NAMES)}
FOOT_JOINTS = {
    'left':  ['LEFT_HEEL', 'LEFT_FOOT_INDEX', 'LEFT_ANKLE'],
    'right': ['RIGHT_HEEL', 'RIGHT_FOOT_INDEX', 'RIGHT_ANKLE'],
}


def iter_frames(args):
    """(t_ms, BGR 이미지) 시퀀스. 영상 파일 또는 프레임 디렉터리."""
    if args.video:
        cap = cv2.VideoCapture(args.video)
        if not cap.isOpened():
            sys.exit(f'영상 열기 실패: {args.video}')
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        i = 0
        while True:
            ok, img = cap.read()
            if not ok:
                break
            yield i * 1000.0 / fps, img
            i += 1
        cap.release()
    else:
        files = sorted(glob.glob(os.path.join(args.frames, '*.jpg')) +
                       glob.glob(os.path.join(args.frames, '*.png')))
        if not files:
            sys.exit(f'프레임 없음: {args.frames}')
        for i, f in enumerate(files):
            yield i * 1000.0 / args.fps, cv2.imread(f)


def extract_pose(args):
    """프레임별 world landmark (미터 단위, 힙 중점 원점) + 가시도. y는 위가 +로 반전."""
    opts = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    lmk = vision.PoseLandmarker.create_from_options(opts)
    frames, detected = [], 0
    for t_ms, img in iter_frames(args):
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB,
                          data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        res = lmk.detect_for_video(mp_img, int(t_ms))
        row = {'t': round(t_ms / 1000.0, 4)}
        if res.pose_world_landmarks:
            detected += 1
            lms = res.pose_world_landmarks[0]
            row['lm'] = {
                LM_NAMES[i]: [round(p.x, 4), round(-p.y, 4), round(p.z, 4),
                              round(p.visibility, 3)]
                for i, p in enumerate(lms)
            }
        frames.append(row)
    lmk.close()
    return frames, detected


def foot_center(row, side):
    """발 대표점: heel·foot_index·ankle 평균."""
    pts = [row['lm'][j] for j in FOOT_JOINTS[side]]
    return [sum(p[k] for p in pts) / len(pts) for k in range(3)]


def detect_strikes(frames):
    """접지(미드스탠스) 검출 — BVH 추출(expert_pipeline)과 같은 정의로 맞춘다.

    world landmark는 힙 원점이라 스탠스 발이 -V로 후퇴함 → '속도 극소'는 미드스탠스가
    아니라 스탠스 끝 반전점에서 잡힌다(폐루프 실측 +130~270ms 지연). 대신:
      미드스탠스 = 발의 진행축 투영이 전방(+)→후방(-)으로 0을 교차(발이 힙 밑 통과)
                   ∧ 발 높이 하위 40%
    진행축 = 양발 수평 궤적 PCA 1축, 전방 부호 = 스윙(높은 발) 이동 방향."""
    good = [f for f in frames if 'lm' in f]
    if len(good) < 10:
        return [], good
    trs = {side: [foot_center(f, side) for f in good] for side in ('left', 'right')}

    # 진행축: 양발 수평 좌표 PCA 1축 (2x2 공분산 최대 고유벡터)
    pts = [(p[0], p[2]) for tr in trs.values() for p in tr]
    mx = sum(p[0] for p in pts) / len(pts)
    mz = sum(p[1] for p in pts) / len(pts)
    sxx = sum((p[0] - mx) ** 2 for p in pts); szz = sum((p[1] - mz) ** 2 for p in pts)
    sxz = sum((p[0] - mx) * (p[1] - mz) for p in pts)
    th = 0.5 * math.atan2(2 * sxz, sxx - szz)
    ax, az = math.cos(th), math.sin(th)

    # 전방 부호: 스윙 중(높은 발) 이동 방향이 +가 되게
    sweep = 0.0
    for side in ('left', 'right'):
        tr = trs[side]
        ys = [p[1] for p in tr]
        y_hi = min(ys) + (max(ys) - min(ys)) * 0.5
        for i in range(len(tr) - 1):
            if tr[i][1] > y_hi:
                sweep += (tr[i + 1][0] - tr[i][0]) * ax + (tr[i + 1][2] - tr[i][2]) * az
    if sweep < 0:
        ax, az = -ax, -az

    strikes = []
    for side in ('left', 'right'):
        tr = trs[side]
        ys = [p[1] for p in tr]
        y_min, y_max = min(ys), max(ys)
        thr = y_min + (y_max - y_min) * 0.40
        proj = [p[0] * ax + p[2] * az for p in tr]
        for i in range(len(tr) - 1):
            if proj[i] >= 0 and proj[i + 1] < 0 and min(ys[i], ys[i + 1]) <= thr:
                # 0교차 서브프레임 보간
                a = proj[i] / (proj[i] - proj[i + 1])
                t = good[i]['t'] + (good[i + 1]['t'] - good[i]['t']) * a
                if any(s['side'] == side and abs(t - s['t']) < 0.25 for s in strikes):
                    continue
                px = tr[i][0] + (tr[i + 1][0] - tr[i][0]) * a
                py = tr[i][1] + (tr[i + 1][1] - tr[i][1]) * a
                pz = tr[i][2] + (tr[i + 1][2] - tr[i][2]) * a
                strikes.append({'side': side, 't': round(t, 4),
                                'x': round(px, 4), 'y': round(py, 4), 'z': round(pz, 4),
                                'lat': round(px * -az + pz * ax, 4)})  # 진행축 수직(레인) 성분
    strikes.sort(key=lambda s: s['t'])
    return strikes, good


def detect_punches(frames):
    """펀치 검출 — 손목 신전(어깨 중점에서 수평 거리) 국소 최대 ∧ 상위 확장 구간.
    양손 각각 검출해 잽/스트레이트를 손별로 태깅. 리듬(간격)이 복서의 시그니처."""
    good = [f for f in frames if 'lm' in f]
    if len(good) < 10:
        return [], good
    punches = []
    for side in ('LEFT', 'RIGHT'):
        ext, wr = [], []
        for f in good:
            l = f['lm']
            sx = (l['LEFT_SHOULDER'][0] + l['RIGHT_SHOULDER'][0]) / 2
            sz = (l['LEFT_SHOULDER'][2] + l['RIGHT_SHOULDER'][2]) / 2
            w = l[f'{side}_WRIST']
            ext.append(math.hypot(w[0] - sx, w[2] - sz))
            wr.append(w)
        es = sorted(ext)
        thr = es[int(len(es) * 0.75)]          # 상위 25% 확장 = 펀치 후보
        rng = es[-1] - es[0]
        for i in range(1, len(ext) - 1):
            if ext[i] >= thr and ext[i] >= ext[i - 1] and ext[i] >= ext[i + 1] and rng > 0.15:
                if any(p['hand'] == side and abs(good[i]['t'] - p['t']) < 0.35 for p in punches):
                    continue
                punches.append({'hand': side, 't': good[i]['t'], 'ext': round(ext[i], 3),
                                'x': round(wr[i][0], 4), 'y': round(wr[i][1], 4), 'z': round(wr[i][2], 4)})
    punches.sort(key=lambda p: p['t'])
    # 양손 동시 피크(0.2s 이내)는 몸통 회전 부수효과 — 신전 큰 손만 유지
    dedup = []
    for p in punches:
        if dedup and abs(p['t'] - dedup[-1]['t']) < 0.2 and p['hand'] != dedup[-1]['hand']:
            if p['ext'] > dedup[-1]['ext']:
                dedup[-1] = p
            continue
        dedup.append(p)
    return dedup, good


def build_pack_boxing(punches, frames, duration, src_desc, pose_rate):
    """복싱 팩 — targetMark(펀치 시각·손목 위치) + 스탠스 stepMark(발목 평균).
    벽 좌표 규약: x=nx*2.2, y=0.73+ny*1.2 (tokens.js WALL). 힙원점 손목 y → 벽 y로
    힙 높이(~0.9m 가정, assumed)를 더해 근사 — monocular 한계는 sourceError에 명시."""
    good = [f for f in frames if 'lm' in f]
    HIP_H, Y0, YS, XS = 0.9, 0.73, 1.2, 2.2
    tokens = [{'t': 0, 'type': 'pathLane', 'nx': 0, 'ny': 0, 'lifetime': round(duration, 3)}]
    # 스탠스: 발목 위치 시간 평균 (지면 좌표 nx=좌우/1.6·ny=전후/1.6, FLOOR_SCALE)
    for side, foot in (('LEFT', 'left'), ('RIGHT', 'right')):
        ax = sum(f['lm'][f'{side}_ANKLE'][0] for f in good) / len(good)
        az = sum(f['lm'][f'{side}_ANKLE'][2] for f in good) / len(good)
        tokens.append({'t': 0, 'type': 'stepMark', 'foot': foot,
                       'nx': round(ax / 1.6, 4), 'ny': round(-az / 1.6, 4), 'lifetime': round(duration, 3)})
    for n, p in enumerate(punches, 1):
        ny = (p['y'] + HIP_H - Y0) / YS
        nx = p['x'] / XS
        tokens.append({'t': round(p['t'], 4), 'type': 'targetMark',
                       'nx': round(nx, 4), 'ny': round(ny, 4), 'lifetime': 0.22})
        tokens.append({'t': round(p['t'], 4), 'type': 'orderPulse', 'n': n,
                       'nx': round(nx, 4), 'ny': round(ny, 4), 'lifetime': 0.35})
    gaps = [round(punches[i + 1]['t'] - punches[i]['t'], 3) for i in range(len(punches) - 1)]
    return {
        'sport': 'boxing',
        'packName': '복싱 / 영상 자동추출 Pack',
        'dataStatus': 'auto-extracted',
        'source': {
            'name': src_desc,
            'dataType': 'monocular video → MediaPipe Pose(world) → 펀치(손목 신전 피크) 자동 추출 (손 배치 0)',
            'pipeline': 'scripts/video_pose_extract.py --sport boxing',
            'poseDetectRate': round(pose_rate, 3),
            'punchCount': len(punches),
            'avgIntervalSec': round(sum(gaps) / len(gaps), 3) if gaps else None,
            'sourceErrorNote': 'monocular: 펀치 타이밍·리듬은 강건, 타겟 높이는 힙높이 0.9m 가정(assumed) 근사',
        },
        'duration': round(duration, 3),
        'hasWall': True,
        'tokenCombination': ['pathLane', 'stepMark', 'orderPulse', 'targetMark'],
        'tokens': tokens,
        'cues': [],
    }


def build_pack(strikes, duration, src_desc, pose_rate):
    """stepMark 팩 — expert_pipeline과 같은 규약 (nx=좌우/X_SCALE, 시각=접지 t)."""
    X_SCALE = 2.0
    key = 'lat' if all('lat' in s for s in strikes) else 'x'
    cx = sum(s[key] for s in strikes) / len(strikes)
    tokens = [{'t': 0, 'type': 'pathLane', 'nx': 0, 'ny': 0, 'lifetime': round(duration * 0.98, 3)}]
    for n, s in enumerate(strikes, 1):
        nx = round((s[key] - cx) / X_SCALE, 4)
        tokens.append({'t': round(s['t'], 4), 'type': 'stepMark', 'foot': s['side'],
                       'nx': nx, 'ny': 0.35, 'lifetime': 1.19})
        tokens.append({'t': round(s['t'], 4), 'type': 'orderPulse', 'n': n,
                       'nx': nx, 'ny': 0.35, 'lifetime': 1.19})
    return {
        'sport': 'running',
        'packName': '러닝 / 영상 자동추출 Pack',
        'dataStatus': 'auto-extracted',
        'botClip': None,   # 영상 소스는 리타겟 클립 없음 (표준 런 클립 사용)
        'source': {
            'name': src_desc,
            'dataType': 'monocular video → MediaPipe Pose(world) → 발 접지 자동 추출 (손 배치 0)',
            'pipeline': 'scripts/video_pose_extract.py',
            'poseDetectRate': round(pose_rate, 3),
            'sourceErrorNote': 'monocular 3D는 깊이 모호성이 큼 — 접지 타이밍은 강건, 좌우 배치 ±수 cm, 전후 깊이 신뢰 낮음',
        },
        'duration': round(duration, 3),
        'hasWall': False,
        'tokenCombination': ['pathLane', 'stepMark', 'orderPulse'],
        'tokens': tokens,
        'cues': [],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video')
    ap.add_argument('--frames', help='프레임 이미지 디렉터리 (영상 대신)')
    ap.add_argument('--fps', type=float, default=30, help='--frames 사용 시 fps')
    ap.add_argument('--out', default='data/video_pose.json')
    ap.add_argument('--pack', help='팩 JSON 출력 경로 (선택)')
    ap.add_argument('--src-desc', default='영상 소스')
    ap.add_argument('--sport', default='running', choices=['running', 'boxing'])
    args = ap.parse_args()
    if not args.video and not args.frames:
        sys.exit('--video 또는 --frames 필요')

    frames, detected = extract_pose(args)
    n = len(frames)
    rate = detected / n if n else 0
    print(f'■ 포즈 추출: {n}프레임 중 검출 {detected} ({rate*100:.0f}%)')

    duration = frames[-1]['t'] if frames else 0
    if args.sport == 'boxing':
        punches, good = detect_punches(frames)
        print(f'■ 펀치 검출: {len(punches)}건')
        for p in punches:
            print(f"   {p['hand']:5s} t={p['t']:.3f}s  신전={p['ext']*100:.0f}cm  손높이={p['y']*100:+.0f}cm")
        payload = {'source': args.src_desc, 'poseDetectRate': round(rate, 3),
                   'frames': frames, 'punches': punches}
        pack = build_pack_boxing(punches, frames, duration, args.src_desc, rate) if punches else None
        count = f'targetMark {len(punches)}'
    else:
        strikes, good = detect_strikes(frames)
        print(f'■ 접지 검출: {len(strikes)}건')
        for s in strikes:
            print(f"   {s['side']:5s} t={s['t']:.3f}s  x={s['x']*100:+.1f}cm  y={s['y']*100:.1f}cm")
        payload = {'source': args.src_desc, 'poseDetectRate': round(rate, 3),
                   'frames': frames, 'strikes': strikes}
        pack = build_pack(strikes, duration, args.src_desc, rate) if strikes else None
        count = f"stepMark {len(strikes)}"

    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f'→ {args.out}')

    if args.pack and pack:
        with open(args.pack, 'w') as f:
            json.dump(pack, f, ensure_ascii=False, indent=2)
        print(f'→ {args.pack} ({count})')


if __name__ == '__main__':
    main()
