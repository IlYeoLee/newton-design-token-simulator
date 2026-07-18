# 복싱 고스트(가상 상대) 클립 스펙 — AI 생성용

시나리오: **벽의 인물 = 가상 대련 상대**, 음성의 '고수' = 가이드하는 전문가.
A(준비운동)에서는 전문가 시범 역할, B·C(익히기·실전)에서는 상대 역할.

## 공통 스펙 (모든 클립 동일 — 어기면 룩 변환·전신 스케일이 깨짐)

- **배경**: 순수 크로마 그린 (#00FF00), 균일 조명, 배경에 그림자 금지
- **프레이밍**: **전신 머리~발끝 전부 프레임 안** (상하 여백 각 5~8%), 인물이 프레임 세로의 ~88%
- **화면비**: 세로 9:16 (1080×1920) 권장 — 가로 16:9여도 중앙에 인물이 있으면 커버핏으로 수용
- **카메라**: 고정 (팬·줌·흔들림 금지), 가슴 높이, 정면
- **인물**: 성인 남성 복서 1명, 오소독스 스탠스, 카메라(=사용자)를 정면으로 마주 봄
- **의상**: 복싱 글러브 착용, 상의는 자유 (룩 변환 후 실루엣이 명확한 것이 좋음 — 헐렁한 옷 지양)
- **속도**: 실제 속도 그대로 (슬로모션 금지 — 시뮬이 재생 속도를 제어함)
- **루프**: 각 클립은 시작-끝 자세가 같아서 이어 붙여도 자연스럽게 (idle 자세로 시작·종료)
- **펀치 케이던스**: 공격 클립은 **약 2초에 1회** (팩 리듬 1.95s 간격과 지각 동기)

파일은 `public/ghost/<파일명>` 에 넣으면 코드 수정 없이 스테이지 전환 시 자동 재생.
(파일이 없으면 기본 클립 폴백)

## 스테이지 → 클립 매핑

| 파일명 | 스테이지 | 역할 | 길이 | 동작 |
|---|---|---|---|---|
| `bx_idle_guard.mp4` | READY · T1 · FIN | 상대 | 8~10s 루프 | 가드 올린 채 제자리 바운스, 가벼운 위빙 |
| `bx_warm_neck.mp4` | A1 | 시범 | 10~12s | 목 크게 2회 + 어깨 롤 2회, 천천히 |
| `bx_warm_step.mp4` | A2 | 시범 | 8~10s 루프 | 앞뒤 스텝 인·아웃 6회, 무게 앞발 |
| `bx_warm_jab.mp4` | A3 | 시범 | 8~10s | 느린 잽 6회 — 뻗고 바로 회수, 어깨 강조 |
| `bx_opp_jab_slow.mp4` | B1 (가드 유지) | 상대 | 8s 루프 | 카메라를 향해 느린 잽 ~2초 간격 (사용자는 가드로 버팀) |
| `bx_opp_straight.mp4` | B2 (회피 스텝) | 상대 | 8s 루프 | 카메라를 향한 스트레이트 ~2초 간격 (사용자는 좌우 슬립) |
| `bx_opp_opening.mp4` | B3 (잽 스윕) | 상대 | 8s 루프 | 가드를 내려 몸통·턱 오픈 → 다시 가드 (2초 주기 — 사용자가 잽 넣는 타이밍) |
| `bx_idle_bounce.mp4` | T2 · C1 | 상대 | 5~6s 루프 | 리듬 바운스 + 글러브 맞대기 한 번 (대련 직전 텐션) |
| `bx_spar_live.mp4` | C2 (잽 대련) | 상대 | 8~12s 루프 | 실전 리듬: 잽-가드-스텝 순환, 2초에 1액션 |
| `bx_spar_combo.mp4` | C3 (콤비 가속) | 상대 | 8~12s 루프 | 잽-잽-훅 콤비 + 슬립, 조금 빠른 템포 |
| `bx_cooldown.mp4` | C4 (마무리) | 상대 | 6~8s | 가드 내리고 호흡 정리, 고개 끄덕(리스펙트) |

## AI 생성 프롬프트 (영문 — Veo/Kling/Runway 등)

공통 접두 (모든 프롬프트 앞에 붙이기):

> A single adult male boxer, orthodox stance, boxing gloves, facing the camera directly, full body visible from head to feet with small margins, standing on the floor, pure chroma green screen background (#00FF00), even studio lighting, no shadows on the background, fixed camera at chest height, no camera movement, vertical 9:16, realistic speed.

| 파일명 | 프롬프트 본문 |
|---|---|
| `bx_idle_guard.mp4` | He stays in guard position, bouncing lightly on his feet in place, subtle head weaving, relaxed but alert, seamless loop. |
| `bx_warm_neck.mp4` | He slowly rolls his neck in a full circle twice, then rolls both shoulders backward twice, calm warm-up pace, gloves at his sides. |
| `bx_warm_step.mp4` | He steps forward and backward rhythmically, six times, light bouncing footwork, weight on the front foot, guard half-raised. |
| `bx_warm_jab.mp4` | He throws six slow-motion-like but deliberate practice jabs straight toward the camera, extending from the shoulder and retracting immediately, teaching pace. |
| `bx_opp_jab_slow.mp4` | He throws a controlled slow jab straight at the camera every two seconds, returning to guard between punches, sparring practice intensity. |
| `bx_opp_straight.mp4` | He throws a straight right punch directly at the camera every two seconds, committed but controlled, returning to guard, inviting the viewer to slip sideways. |
| `bx_opp_opening.mp4` | Every two seconds he drops his guard, exposing his chin and torso for one second as an opening, then raises the guard again, repeating rhythmically. |
| `bx_idle_bounce.mp4` | He bounces on his toes with rising energy, taps his gloves together once, stares at the camera, pre-fight tension, seamless loop. |
| `bx_spar_live.mp4` | He spars actively at the camera: jab, guard, lateral step, repeating in a two-second rhythm, realistic light-sparring intensity, seamless loop. |
| `bx_spar_combo.mp4` | He throws jab-jab-hook combinations toward the camera with a slip between combos, slightly faster tempo, athletic sparring rhythm, seamless loop. |
| `bx_cooldown.mp4` | He lowers his guard, exhales visibly, shakes out his arms, and gives a single approving nod to the camera, session finished. |

## 반입 절차

1. 생성된 클립을 위 파일명 그대로 `public/ghost/`에 저장
2. 새로고침 → 복싱 세션 시작 → 스테이지마다 자동 교체 확인
3. 크로마 품질 확인: 인물 안에 구멍·배경 잔녹색이 보이면 배경 균일도가 낮은 것 — 재생성

## 명암 깊이 (히트맵 밀도차의 원천 — 생성 시 강력 권장)

열화상 룩은 원본의 명암을 온도로 읽는다. 평평한 정면 조명이면 밀도차가 안 나온다.
프롬프트에 추가: **"dramatic side lighting, one key light from the side, strong soft shadows
across the body, limbs in front of the torso fall into shadow"** — 몸 앞을 지나는 팔·그늘진
부위가 자연스럽게 어두워져(→깊은 암색) 히트맵 밀도 차이가 원본에서부터 생긴다.
