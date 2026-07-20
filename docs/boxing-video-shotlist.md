# 복싱 벽 코치 — 힉스필드 영상 샷 리스트 (10 클립)

> 생성 대상: `public/ghost/<파일명>` 에 드롭하면 코드가 자동 반영 (미반입 시 기본 클립 폴백).
> 역할 설계: **A·B = 코치 시범(따라 하기) / C = 상대 스파링**.

## 공통 스펙 (10개 전부 지켜야 함)

- **배경**: **순수 초록 그린스크린** (#00b140 계열). 파이프라인이 초록 우세도로 인물을 추출 —
  배경에 초록 그림자·반사·의상 초록 금지. 배경이 초록이 아니면 벽에 안 입혀짐.
- **프레이밍**: 전신, 정면, 카메라 고정(팬/줌 없음). 인물이 프레임 안에 발끝~머리 다 들어옴.
- **아이덴티티**: 사용자 인물 프로필 이미지 = image→video 앵커 (동일 인물 유지).
- **의상**: 복싱 트레이닝복(민소매/반팔). 초록·형광 금지.
- **루프성(A·B·READY)**: 시작·끝 포즈가 같아 매끄럽게 반복되게. 3~5초.
- **C 클립**: 6초, 동적 OK.
- **fps**: 30. 세로 프레이밍(인물 세로 꽉 참)이지만 16:9 캔버스에 중앙 배치되므로 인물 중앙 정렬.

---

## A단계 — 준비운동 (코치 시범, 루프)

| 파일 | 스테이지 | 동작 | 모션 프롬프트 |
|---|---|---|---|
| `bx_a1_neck.mp4` | BX_A1 목·어깨 풀기 | 목·어깨 크게 원으로 천천히 | full-body boxer facing camera, slow large neck and shoulder rolls, relaxed, loops seamlessly, static camera, solid green screen background |
| `bx_a2_step.mp4` | BX_A2 스텝 인·아웃 | 앞뒤 가벼운 스텝, 무게 앞발 | boxer light in-and-out footwork, bouncing forward and back on front foot, boxing stance, static camera, green screen |
| `bx_a3_jab.mp4` | BX_A3 잽 폼 | 어깨에서 잽 뻗고 바로 회수, 가볍게 | boxer throwing light lead jabs from the shoulder and snapping back to guard, relaxed tempo, static camera, green screen |

## B단계 — 사전 익히기 (코치 시범, 루프)

| 파일 | 스테이지 | 동작 | 모션 프롬프트 |
|---|---|---|---|
| `bx_b1_guard.mp4` | BX_B1 가드 유지 | 가드 박스 단단히, 미세 바운스만 | boxer holding a tight high guard, fists by the cheeks, small rhythmic bounce, holding position, static camera, green screen |
| `bx_b2_slip.mp4` | BX_B2 회피 슬립 | 머리 좌우 슬립(위빙) | boxer slipping the head left and right, upper-body weaving, guard up, smooth rhythm, static camera, green screen |
| `bx_b3_jab.mp4` | BX_B3 잽 스윕 | 빈틈 노려 잽 뻗기 | boxer stepping in with a committed lead jab into an opening, then returning to guard, static camera, green screen |

## C단계 — 실전 (상대 스파링, 6초)

| 파일 | 스테이지 | 동작 | 모션 프롬프트 |
|---|---|---|---|
| `bx_c2_spar.mp4` | BX_C2 잽 대련 | 상대가 잽 던지는 대련 리듬 | opponent boxer trading jabs at sparring rhythm, advancing and resetting, aggressive but controlled, static camera, green screen |
| `bx_c3_combo.mp4` | BX_C3 잽잽훅 콤비 | 잽-잽-훅 콤비네이션, 속도감 | opponent boxer throwing a jab-jab-hook combination with increasing speed, dynamic, static camera, green screen |
| `bx_c4_cooldown.mp4` | BX_C4 마무리 호흡 | 가드 내리고 깊은 호흡 | boxer lowering the guard, deep breathing, shoulders relaxing, cooling down, slow, static camera, green screen |

## 대기 (이미 있음, 재생성 불필요)

| 파일 | 스테이지 | 상태 |
|---|---|---|
| `bx_idle_guard.mp4` | BX_READY | ✅ 반입됨 (가드 바운스 대기) |

---

## 백그라운드 리스크 (생성 전 확인)

생성형 영상 모델은 배경을 완벽한 단색 초록으로 유지 못 할 수 있음(그림자·색번짐).
초록 유지가 불안정하면 대안: **아무 배경으로 생성 → MediaPipe 세그멘테이션으로 인물 추출**
(코드에 `selfie_segmenter.tflite` 폴백 경로 이미 존재 — 파이프라인 소스만 세그로 전환).
먼저 1개(bx_a3_jab) 뽑아서 크로마키 정합 확인 후 나머지 9개 진행 권장.
