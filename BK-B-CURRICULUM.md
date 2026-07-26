# 농구 팩 B단계 "사전 익히기" 재설계 — 3단계 커리큘럼 + CMU 클립 매핑

_작성 2026-07-27 · 태스크 #30(농구 스텝연습 + 실전 구성) 설계 문서 · 코드 변경 없음_

목표: 시중 드리블 연습 보조기구처럼 **공 튀기기 → 움직이며 드리블 → 멈추고 뒤로**의 명료한 3단계로
재구성하되, 3단계 전부를 **CMU Motion Capture Database에 실존하는 동작**으로 구현한다.
(가짜 절차 애니메이션 금지 — 지금 B3의 `stepbackDemo`만 예외적으로 합성이며, 아래에 CMU 100% 대체안을 제시)

---

## 0. 사실 확인 요약 (근거)

### 0-1. CMU 사이트 실측 (2026-07-27, `http://` 평문 접속으로 확인)

> ⚠️ HTTPS는 인증서 체인 검증 실패 — **`http://mocap.cs.cmu.edu`** 로만 접근 가능.
> ⚠️ CMU 페이지는 **길이·프레임 수를 인쇄하지 않는다.** 페이지에 있는 숫자는 프레임레이트 `120`뿐.
> 아래 프레임 수는 `.amc` 파일을 실제로 내려받아 센 값(= 측정치, 페이지 인쇄값 아님).

**Subject 6 — 페이지 헤더 원문: `Subject #6 (dribble, shoot basketball)`** (실존 확인)

| Trial | Motion Description (원문 그대로) | 프레임(측정) | 초 @120fps | 로컬 보유 |
|---|---|---|---|---|
| 06_01 | walk | 494 | 4.1 | ✗ |
| 06_02 | basketball - forward dribble | 721 | 6.0 | ✔ |
| 06_03 | basketball - forward dribble | 527 | 4.4 | ✔ |
| 06_04 | basketball - forward dribble | 396 | 3.3 | ✔ |
| 06_05 | basketball - forward dribble | 385 | 3.2 | ✔ |
| 06_06 | basketball - backward dribble | 402 | 3.4 | ✔ |
| 06_07 | basketball - backward dribble | 576 | 4.8 | ✔ |
| 06_08 | basketball - sideways dribble | 342 | 2.9 | ✔ |
| 06_09 | basketball - sideways dribble | 301 | 2.5 | ✔ |
| 06_10 | basketball - forward dribble, 90-degree left turns | 1113 | 9.3 | ✔ |
| 06_11 | basketball - forward dribble, 90-degree right turns | 1146 | 9.6 | ✔ |
| 06_12 | basketball - forward dribble, 90-degree right turns, crossover dribble | 1222 | 10.2 | ✔ |
| 06_13 | basketball - low, fast free style dribble, dribble through legs | 4905 | 40.9 | ✔ |
| 06_14 | basketball - crossover dribble, shoot | 479 | 4.0 | ✔ |
| 06_15 | basketball - dribble, shoot | 545 | 4.5 | ✔ |

**농구 관련 subject 전수** (`subjects.php` 원문 설명)

| Subject | 설명(원문) | 비고 |
|---|---|---|
| 6 | dribble, shoot basketball (15 trials) | 전부 로컬 보유(06_01 제외) |
| 26 | nursery rhymes, basketball, bending (11 trials) | `26_02` = basketball signals (6058fr / 50.5s) |
| 78 | walking (35 trials) | **인덱스 오기재** — 실제 trial 페이지는 subject 102의 클린판(설명 끝에 `CleanedGRS`). 102_22 ≈ 78_24 (+2 오프셋) |
| 86 | sports and various activities (15 trials) | `86_14` = bouncing/shooting/dribble basketball |
| **102** | **Basketball (33 trials)** | 공격·수비 풋워크 전용 세트. mpg 프리뷰 없음(tvd/c3d/amc만) |
| 124 | Sports Related Motions (13 trials) | 03 Shoot / 04 Free Throw / 05 Jump Shot / 06 Lay Up / 11 2 Foot Jump |

**Subject 102 (Basketball) 전체 목록** — 1 RightWideTurn · 2 LeftWideTurn · 3 SuperTightLeft · 4 SuperTightRight ·
5 RunningStraight · 6 RunningWideRight · 7 RunningWideLeft · 8 RunningTighterRight · 9 calibration · 10 RunningNoBall ·
11·12 OffensiveMoveSpinLeft · 13 OffensiveMoveGoRight · 14 OffensiveMoveGoLeft · 15 OffensiveMoveSpinRight ·
16 WalkEvasiveLeft · 17 WalkEvasiveRight · 18 FeintLeftMoveRight · 19 FeintRightMoveLeft · 20 FakeShotBreakRight ·
21 FakeShotBreakLeft · 22 DefensiveStraightNoStop · 23 DefensiveStraightWithStop · 24 DefensiveRightStopToStop ·
25 DefensiveLeftStopToStop · 26 DefensiveMoveZigZag · 27·28 DefensiveMoveSideToSide · 29 Pivoting ·
30 SraightDriveFromStop *(원문 오타)* · 31 RightDrive (left then right) · 32 LeftDrive (right then left) · 33 RightTightTurn

**Subject 124 (Sports Related Motions)** — 03 Basketball Shoot(961fr/8.0s) · 04 Basketball Free Throw(726fr/6.1s) ·
05 Basketball Jump Shot(789fr/6.6s) · 06 Basketball Lay Up(694fr/5.8s) · 11 2 Foot Jump(998fr/8.3s)

**다운로드 URL 규칙** (subject 페이지 HTML의 `HREF` 원문에서 확인)
```
스켈레톤 : http://mocap.cs.cmu.edu/subjects/06/06.asf      (3자리 subject는 /subjects/124/124.asf)
모션     : http://mocap.cs.cmu.edu/subjects/06/06_01.amc
기타     : /subjects/06/06_01.c3d , .tvd , .mpg , .avi
```
- subject 디렉터리·파일명은 **최소 2자리 zero-pad** (`06`, `83`, `102`, `124`)
- trial 번호는 **항상 2자리 zero-pad** (`06_01`, `124_13`, `83_68`)
- **반드시 `http://`** (HTTPS 인증서 체인 무효)
- 검증: 30개 파일 HTTP 200 정상, `06.asf` 7263B — `# AST/ASF file generated using VICON BodyLanguage`로 시작

**미확인 항목 (단정 금지)**
1. CMU 페이지에 인쇄된 길이·프레임 수 — **존재하지 않음**. 위 프레임 수는 전부 amc 측정치.
2. "standing dribble in place" 문구로 기술된 trial — 없음. 최근접 = `86_14`, `06_13`.
3. "one-hand shot", "athletic stance", "ready position" — 사이트 전체 검색 0건.
4. "shuffle", "lateral", "change direction", "land/landing", "bounce" 키워드 — 검색 0건 (착지는 별도 기술되지 않음).
5. subject 83·102·118·127·128의 프레임 수 — 샘플 6개만 측정, 나머지 미측정.
6. subject 78이 102와 프레임 단위로 동일한지 — 설명 일치만 확인, 데이터 diff 미실시.
7. **⚠️ 최대 리스크: subject 102 / 78 / 118 / 127 / 128의 BVH 변환본 입수 가능 여부 미확인** (아래 §4 참조).

### 0-2. 로컬 실측 (보유 클립을 X Bot 리그에 태워 FK로 측정)

리타겟 산출 클립을 `assets/xbot.fbx` 스켈레톤에 바인딩해 30fps로 샘플, 월드 좌표 측정(단위 m):

| 클립 | 구간 | 힙 Y | 무릎각 | 양발 간격 | 오른손 Y | 발 이동 | 바운스 |
|---|---|---|---|---|---|---|---|
| `auto_cmu124_04` (124_04) | 1.2–3.7s | 0.90~0.98 | 109~130° | 0.30~0.31 | 0.67~1.11 | **0.06m** | 4 |
| `auto_cmu86_14` (86_14) | 13.6–16.1s | 1.00~1.06 | 131~147° | 0.20~0.27 | 0.88~1.59 | 0.11m | 3 |
| `auto_cmu06_10` (06_10) | 5.6–8.1s | 1.00~1.03 | 117~136° | 0.04~0.15 | 0.87~1.37 | 0.12m | 3 |
| `cmu_dribble_low` (06_13) | 3.8–6.3s | 0.95~1.07 | 80~149° | 0.09~1.05 | 0.67~1.30 | 0.51m | 4 |
| `cmu_crossover_shot` (06_14) | 전체 3.99s | 0.87~1.07 | 104~180° | 0.11~0.53 | 0.86~1.76 | — | 6 |
| `auto_cmu124_05` (124_05) | 전체 6.57s | 0.84~**1.47** | 91~174° | 0.13~0.62 | 0.69~**2.39** | — | 8 |
| `cmu_dribble_fwd` (06_02) | 전체 6.01s | 1.00~1.08 | 96~174° | 0.11~0.71 | 0.89~1.43 | 5.69m 이동 | 10 |
| `cmu_dribble_side` (06_08) | 전체 2.85s | 0.99~1.13 | 108~174° | 0.13~0.75 | 0.81~1.43 | 3.84m 이동 | 4 |

**핵심 발견**
- **`06_13`(현행 BK_A3/B3 소스)은 "제자리"가 아니다.** 4초 창 어디를 잡아도 발이 최소 0.65m 움직임
  (2.5초 창 최솟값 0.51m). "발은 가만히, 리듬만" 학습에는 부적합.
- **`124_04`(Basketball Free Throw)의 1.2–3.7s 구간이 제자리 공 튀기기의 최적 클립.**
  프리스로 전 루틴(공 몇 번 튕기고 쏘기)의 앞부분 — 발 0.06m 고정 · 어깨너비 0.30m · 무릎 109~130° 굴곡 ·
  오른손 0.67m까지 하강. 이미 리타겟·QA 통과·자동 등록 완료(`auto_cmu124_04`, root:false, 6.05s).
- `86_14`("bouncing basketball") 13.6–16.1s도 서서 튕기기지만 자세가 서 있음(무릎 131~147°) — 스탠스 학습엔 124_04 우위.

---

## 1. 3단계 설계

전체 서사: **공을 튄다 → 튀기며 움직인다 → 튀기다 멈추고 뒤로 뺀다.**
각 단계는 앞 단계의 성공 조건을 그대로 물려받고 하나만 추가한다(누적형).

### B1 · 공 튀기기 — 스탠스와 리듬

| 항목 | 내용 |
|---|---|
| **학습 목표** | 발을 어깨너비로 두고 무릎을 굽힌 낮은 자세에서 **일정한 박자로 8회** 튕긴다 |
| **유저 동작** | 제자리. 발은 지면 마크 위에 고정. 오른손 한 손 드리블. 시선은 앞(바닥 UI) |
| **지면 토큰** | ① 좌·우 `FootMark` 2개를 **실척 0.30m 간격**으로 고정 배치(BK_ZOOM 미적용 — 실제로 밟을 거리)<br>② 오른발 바깥쪽에 **드리블 존 링**(`floorRing`) — 바운스 접촉 순간마다 수축→팽창 1펄스<br>③ 링 중앙 **잔여 카운트 숫자 8→0** (`attachMarkNum` 또는 BK_A3 `bkSquat.num` 캔버스 방식 재사용)<br>④ 스탠스 미달 시 두 발마크가 `ghost()`로 식음 = "더 앉으세요" |
| **성공 판정** | ⑴ **스탠스**: `getProbes().hips.y ≤ 0.95` 유지 (실측 0.90~0.98 기반. BK_A3의 서기 0.98 / 바닥 0.82 축과 동일 스케일)<br>⑵ **발 고정**: `\|footL−markL\|`, `\|footR−markR\|` XZ 거리 ≤ 0.15m (judge `tolP`와 동일값)<br>⑶ **리듬 카운트**: `_dribbleBall` 내부 접촉 이벤트(`S.lastLow` 갱신 = 손목 하강→상승 전환)를 그대로 카운터로 승격. 8회 도달 시 `next()`<br>⑷ **박자 균일도(선택)**: `S.period` EMA 편차 ≤ 0.12s면 prism 색, 아니면 sand |
| **공 처리** | **손에 부착 + 바운스.** `_dribbleBall`이 오른손목 궤적을 그대로 따라감 |

### B2 · 움직이며 드리블 — 스텝 순서 밟기

| 항목 | 내용 |
|---|---|
| **학습 목표** | 드리블을 유지한 채 **①→②→③→④** 순서로 실측 발자국을 밟는다(크로스오버 드라이브 리듬) |
| **유저 동작** | 제자리 4스텝(오른→왼→오른→왼). 앞 두 발은 가볍게, 뒤 두 발은 폭을 크게 |
| **지면 토큰** | 현행 `BK_GUIDE` 실측 접지 마크(06_14 FK 추출 8접지 중 t∈[0.15,3.0] 6개) **그대로 재사용**.<br>현행 B1(①② 집중)과 B2(③④ 집중)를 **한 단계로 병합** — 다음 발 위치는 연결 화살표(`floorArrow`)가 이미 담당.<br>브레이크 바·감속 스트라이프는 B3로 이관(여기선 순서·리듬만) |
| **성공 판정** | ⑴ B1 조건(스탠스·드리블 지속) 유지<br>⑵ **위치**: 각 접지의 발↔마크 XZ 거리 ≤ `judge.tolP` 0.15m<br>⑶ **타이밍**: 접지 시각 − `BK_GUIDE[i].t` 절댓값 ≤ `judge.tolT` 0.12s<br>⑷ **좌우발**: `BK_GUIDE[i].side`와 실제 접지 발 일치 (footL/footR Y 최솟값으로 판별)<br>⑸ 4/4 통과 ×3세트 → `next()` |
| **공 처리** | **손에 부착 + 바운스.** ⚠️ 현행 `playDemo`의 공 게이트가 `key === 'dribble' \|\| 'cmu_dribble_low'`뿐이라 `cmu_crossover_shot`에선 공이 안 보임 — 게이트 확장 필요(§3-1) |

### B3 · 멈추고 뒤로 — 플랜트 · 분리 · 릴리즈

| 항목 | 내용 |
|---|---|
| **학습 목표** | 디딤발에서 **확 멈추고**(브레이크) → **0.48m 뒤로 분리** → 양발 착지 후 **0.16초 안에 릴리즈** |
| **유저 동작** | ④에서 오른발 플랜트 → 백스텝 → 양발 착지 → 슛 폼 |
| **지면 토큰** | 현행 B3 유지(가독 검수 통과분): 플랜트 발자국 ④ + `X`(수비수) + 후방 분리 화살표 + 0.48m 자 눈금 3틱 +<br>착지존 양발 + `SHOOT 0.16s` 수축 링 + `1 PLANT / 2 BACK / 3 SHOOT` 단계 뱃지 + 고스트 스텝 슬라이드.<br>여기에 B2에서 이관한 **브레이크 바 + 감속 스트라이프**를 플랜트 발 앞에 추가 |
| **성공 판정** | ⑴ **플랜트**: 플랜트 시점 전후 0.2s 창에서 `hips` XZ 속도 → 0.4m/s 이하로 하강<br>⑵ **분리**: 플랜트 시점 `hips.z` 대비 착지 시점 `hips.z` 후방 변위 ≥ 0.40m (목표 0.48m, ±0.08 허용)<br>⑶ **양발 동시 착지**: `footL.y`·`footR.y` 최저 도달 시각 차 ≤ 0.10s<br>⑷ **릴리즈 창**: 착지 시각 → `wrist`(오른손목) Y 최댓값 시각 Δt ≤ 0.16s<br>⑸ 3세트 후 `_gateAdvance()` (기존 게이트 로직 그대로 — skill<0.6이면 B1 복귀) |
| **공 처리** | **개더 전까지 바운스 → 슛 크로스페이드 시점(xf>0.5)에 숨김.** 현행 `stepbackDemo`가 이미 이렇게 동작 |

---

## 2. 클립 매핑 표

### (a) 이미 보유 — 신규 리타겟 0 (최우선)

| 단계 | 클립 키 | CMU | CMU 원문 설명 | 길이 | 사용 구간 | 왜 이 단계인가 |
|---|---|---|---|---|---|---|
| **B1** | `auto_cmu124_04` | **124_04** | Basketball Free Throw | 6.05s | **[1.2, 3.7]** 루프 | 프리스로 전 바운스 루틴 = 발 0.06m 고정·어깨너비 0.30m·무릎 109~130° 굴곡. 보유 클립 중 "제자리 공 튀기기" 실측 최적 |
| B1 (대안) | `auto_cmu86_14` | **86_14** | bouncing basketball, shooting basketball, dribble basketball, two handed dribble | 50.47s | [13.6, 16.1] | CMU가 유일하게 "bouncing basketball"로 명시. 다만 자세가 서 있음(무릎 131~147°) |
| B1 (현행) | `cmu_dribble_low` | 06_13 | basketball - low, fast free style dribble, dribble through legs | 40.87s | — | **B1 부적합** — 어느 창에서도 발이 0.5m+ 움직임(실측). 자유 드리블 시연용으로만 |
| **B2** | `cmu_crossover_shot` | **06_14** | basketball - crossover dribble, shoot | 3.99s | 전체(위상 잠금) | 접지 8개가 `contacts-cmu_crossover_shot.json`에 이미 추출됨 → `BK_GUIDE` 마크가 정의상 정확. 봇이 마크를 정확히 밟음 |
| B2 (확장) | `cmu_dribble_side` | 06_08 | basketball - sideways dribble | 2.85s | 전체 | 좌우 이동 드리블. ⚠️ `keepRootXZ` = 3.84m 실이동 → 투사존 이탈. 창 루프 시 위치 점프 |
| B2 (확장) | `cmu_dribble_fwd` / `auto_cmu06_03~05` | 06_02 / 06_03·04·05 | basketball - forward dribble | 6.0 / 4.4 / 3.3 / 3.2s | — | 전진 드리블. 동일 이동 이탈 문제 |
| B2 (확장) | `auto_cmu06_09` | 06_09 | basketball - sideways dribble | 2.51s | — | 짧은 사이드 드리블 |
| **B3** | `cmu_dribble_shot` | **06_15** | basketball - dribble, shoot | 4.54s | 드리블→슛 전체 | **CMU 100% 대체안**: 합성 없이 한 테이크로 "튀기다 쏘기" 성립 |
| B3 | `auto_cmu124_05` | **124_05** | Basketball Jump Shot | 6.57s | 전체 | 힙 Y 0.84→**1.47**(점프), 손 2.39m 도달 = 완전한 점프샷. 릴리즈 파트 CMU 대체 최적 |
| B3 (현행) | `dribble` + `mf_jump_shot` | — | (Mixamo + Motifect) | — | `stepbackDemo` 합성 | **CMU 아님.** 0.48m 분리는 절차적 루트 슬라이드 |

> **B3를 CMU 100%로 만들려면**: `stepbackDemo`의 `dribble`→`auto_cmu124_04`, `mf_jump_shot`→`auto_cmu124_05`(또는 `cmu_dribble_shot`)로 교체.
> 0.48m 루트 슬라이드는 SportVU 커리 실측값이라 유지(모캡이 아니라 **거리 스펙**임 — 절차 애니메이션이 아님).

**보유 클립 상태**: 위 auto_* 전부 `auto-manifest.json` 등재, `qaFail` 없음(불합격은 `cmu88_09`·`cmu07_12` 2건뿐).
`xbot.js`의 `import.meta.glob`이 `assets/mocap/auto/*.json`을 자동 등록하므로 **B1~B3 어느 것도 코드 임포트 추가 불필요**.

### (b) CMU 신규 반입 후보 — 필요할 때만

3단계 자체는 (a)만으로 100% 구현 가능하다. 아래는 **품질 향상 옵션**이며 전부 `subject/trial` 실존 확인 완료.

| 후보 | CMU 원문 설명 | 프레임(측정) | 어느 단계 | 왜 |
|---|---|---|---|---|
| `102_27` | DefensiveMoveSideToSide | 171 (1.4s) | B2 | 좌우 셔플 풋워크 — 드리블 트레이너의 사이드스텝 파트 |
| `102_28` | DefensiveMoveSideToSide | 703 (5.9s) | B2 | 위와 동일·장척 |
| `78_29` / `78_30` | (102_27/28의 CleanedGRS 판) | 미측정 | B2 | 클린 데이터 원하면 이쪽 |
| `102_20` / `102_21` | FakeShotBreakRight / FakeShotBreakLeft | 미측정 | B3 | **슛 페이크 후 급브레이크** = 스텝백의 형제 동작 |
| `102_23` | DefensiveStraightWithStop | 미측정 | B3 | 직진→정지(플랜트) |
| `102_29` | Pivoting | 798 (6.7s) | B3 | 피벗 = 디딤발 고정 |
| `102_30` | SraightDriveFromStop *(원문 오타)* | 미측정 | B2 | 정지→드라이브 출발 |
| `124_11` | 2 Foot Jump | 998 (8.3s) | B3 | 양발 동시 착지의 유일한 명시 trial |
| `127_19` / `127_20` | Run Quick Stop Run | 440 / 미측정 | B3 | 급정지 |
| `16_08` / `16_57` | run/jog, sudden stop | 미측정 | B3 | 급정지 |
| `26_02` | basketball signals | 6058 (50.5s) | — | 팩 외 연출용 |
| `83_33` | sidestep to right then back to left | 미측정 | B2 | 좌우 왕복 스텝 |

> ⚠️ **미확인 — 반입 전 반드시 확인할 것**: 우리 파이프라인(`scripts/retarget_bvh.mjs`)은 **asf/amc가 아니라 BVH를 먹는다**.
> 로컬 `public/mocap/cmu/*.bvh` 72개는 두 계열의 **BVH 변환본**이다(§4-1). subject **102 / 78 / 118 / 127 / 128**이
> 그 변환본 배포에 포함되는지는 확인하지 못했다. 포함되지 않으면 amc→BVH 변환기를 새로 만들어야 하며
> 이는 신규 인프라(비용 큼)다. **subject 6·26·86·124는 이미 변환본을 보유하고 있으므로 안전.**

---

## 3. 구현 순서 (최소 diff)

### 3-1. 공 게이트 확장 — 1줄 (선행 필수)

`src/xbot.js:526` — 현행:
```js
if (this.mode === 'basketball' && (key === 'dribble' || key === 'cmu_dribble_low')) this._dribbleBall(this._demoT || 0, dt);
```
B1의 `auto_cmu124_04`, B2의 `cmu_crossover_shot`에서 공이 안 보이는 원인. 정규식 한 줄로 교체:
```js
if (this.mode === 'basketball' && /dribble|crossover|cmu124_0[3-6]|cmu86_14/.test(key)) this._dribbleBall(this._demoT || 0, dt);
```
`_dribbleBall`은 오른손목 Y의 하강→상승 전환을 실측 검출하므로 클립 종류를 안 가린다.
손 진동이 1.6s 넘게 없으면 공을 손 옆 바닥에 얌전히 놓는다(자동 폴백) — 슛 구간에서 자연스럽게 처리됨.

### 3-2. 봇 클립·위상 (main.js)

`src/main.js:3884` DRILL 맵:
```js
BK_B1: 'auto_cmu124_04',        // 제자리 공 튀기기 (124_04 프리스로 전 바운스 루틴)
BK_B2: 'cmu_crossover_shot',    // 스텝 순서 (06_14) — 현행 유지
BK_B3: 'cmu_crossover_shot',    // stepbackDemo가 덮어씀 — 현행 유지
```

`src/main.js:4002` 위상 잠금:
```js
else if (session.stage === 'BK_B1') _phase = 1.2 + (session.t % 2.5);   // 124_04 안정 구간 루프
else if (session.stage === 'BK_B2') _phase = session.t % 3.99;          // 06_14 전체 1사이클
// BK_B3는 기존 stepbackDemo 경로 유지 (main.js:4005)
```
`auto_cmu124_04`는 `root:false` → `_rootClips`에 없음 → `playDemo`가 `_lockInPlace()`로 힙 XZ를 고정하고,
`_groundedClips`(auto 전부 자동 포함)라 per-frame 클램프도 안 걸린다. **제자리 유지 보장.**

### 3-3. 지면 토큰 (session.js)

- `src/session.js:749~768` `BK_B1` 그룹 — **전면 교체**. 기존 6접지 마크·화살표·JUMP 링을 B2로 이관하고,
  좌우 `FootMark` 2개(x=±0.15, z=BK_STAND) + 드리블 존 `floorRing` + 카운트 캔버스만 남긴다.
  카운트 캔버스는 `BK_A3`의 `bkSquat.num`(session.js:733~739) 생성 코드를 그대로 복사.
- `src/session.js:771~784` `BK_B2` — 기존 마크 6개 유지 + 브레이크 바/스트라이프를 `BK_B3` 그룹으로 이동.
- `src/session.js:789~826` `BK_B3` — 그대로 두고 브레이크 바만 받아옴.
- `src/session.js:1881~1937` 틱 핸들러 — `BK_B1` 핸들러를 스탠스·카운트 로직으로 교체,
  `BK_B2`는 기존 B1+B2 핸들러 병합(마크 6개 전부 활성, dim 분기 제거).
  판정값은 `this.xbot.getProbes()`로 읽는다(`BK_A3` 스쿼트가 `hips.y`를 쓰는 것과 동일 패턴, session.js:1773).

### 3-4. 텍스트·UI (3곳)

| 파일 | 위치 | 내용 |
|---|---|---|
| `src/session.js` | 489~491 | `STAGES.basketball`의 BK_B1~B3 `label`/`voice`/`cue` |
| `src/session.js` | 1340~1342 | `_enterBasketball` FS/FL/FM 지면 카피 |
| `public/ready-view/floor-scenes.js` | 34~36 | `BK_B1/B2/B3`의 `title`·`cue` (영문 지면 프레임) |

참고 카피안:
```
BK_B1  STEP 1/3  "공 튀기기 — 무릎 굽히고 제자리"   / "발은 마크 위에 · 8회"
BK_B2  STEP 2/3  "튀기며 밟기 — ①②③④ 순서"        / "드리블 유지하며"
BK_B3  STEP 3/3  "멈추고 뒤로 — 0.48m 분리"        / "착지 후 0.16초 안에"
```

### 3-5. 검증

```bash
npm run dev                       # localhost:5199
# 콘솔에서 단계 강제 이동
const s=window.__sess; s.stageIdx=s.stages.findIndex(x=>x.id==='BK_B1'); s.t=0; s._enter();
# 클립 단독 미리보기 (모션 미리보기 셀렉트에 auto_* 자동 노출됨)
window.__dbg.xbot.setVerify('auto_cmu124_04');
```

---

## 4. 신규 CMU 클립 반입 절차 (필요 시)

### 4-1. 소스 규약 — 현재 파이프라인은 BVH만 받는다

로컬 `public/mocap/cmu/*.bvh` 72개는 **두 계열의 변환본**이며, 루트 본 이름으로 구분해 이름 맵을 고른다:

| 루트 본 | 계열 | `retarget_bvh.mjs` names | 로컬 예시 |
|---|---|---|---|
| `hip` (소문자) | cgspeed / daz-friendly 변환본 | `DAZ_NAMES`, `hip: 'hip'` | 06_02~06_11, 86_14, 124_03~06, 13_18, 144_17 |
| `Hips` | una-dinosauria/cmu-mocap 변환본 | `CMU_NAMES`, `hip: 'Hips'` | 06_12~06_15, 42_01, 49_*, 74_*, 86_03~86_11, 144_11 |

확인 명령: `sed -n 2p public/mocap/cmu/<파일>.bvh` → `ROOT hip` 또는 `ROOT Hips`.

> CMU 공식 배포(`.asf`/`.amc`)를 직접 쓰려면 amc→BVH 변환 단계가 **새로 필요**하다(현재 미보유 인프라).
> 위 URL 규칙(§0-1)은 원본 확인·라이선스 확인용으로는 유효하나, 파이프라인 입력으로는 바로 못 쓴다.

### 4-2. 반입 명령 라인

```bash
cd /Users/iil-yeo/dev/newton-design-token-simulator

# ① BVH 배치 (변환본을 구해서 이 경로·이 이름으로)
#    public/mocap/cmu/<subject>_<trial>.bvh   예: public/mocap/cmu/102_28.bvh
sed -n 2p public/mocap/cmu/102_28.bvh        # ROOT hip / ROOT Hips 판별

# ② scripts/retarget_bvh.mjs 의 JOBS에 항목 추가 (§4-1 표대로 names/hip 선택)
#    cmu102_28: { file: 'public/mocap/cmu/102_28.bvh', names: DAZ_NAMES, hip: 'hip',
#                 fps: 30, yScale: true, cat: 'basketball', keepRootXZ: true, yaw180: true },
#    · keepRootXZ = 몸이 실제 이동하는 클립(전진/사이드/셔플)에만. 제자리 클립은 생략.
#    · yaw180 = 소스 전진 방향이 X봇 전방(-z)과 반대일 때.

# ③ 리타겟 → assets/mocap/auto/cmu102_28.json + auto-manifest.json 자동 갱신
node scripts/retarget_bvh.mjs cmu102_28 --auto

# ④ 등록은 자동 (xbot.js의 import.meta.glob) — 코드 수정 0.
#    클립 키 = 'auto_cmu102_28', _vmClips/_groundedClips 자동 편입,
#    manifest.root=true면 _rootClips에도 자동 편입.

# ⑤ 시각 QA — 클립당 6프레임 스틸 (dev 서버가 5199에 떠 있어야 함)
node scripts/qa_auto_clips.mjs --only cmu102_28 --out /tmp/newton_qa
#    불합격이면 auto-manifest.json 해당 항목에 "qaFail": "사유" 추가 → 등록만 차단(파일은 보존)

# ⑥ (발자국 가이드가 필요한 클립만) 접지 자동 추출
node scripts/extract_contacts.mjs <이름>
#    ⚠️ 현재 extract_contacts.mjs:15가 'assets/mocap/xclip-<name>.json' 경로를 하드코딩 —
#       auto/ 산출물엔 안 붙는다. auto 클립의 접지가 필요하면 --auto 없이 한 번 더 뽑거나
#       그 한 줄에 auto/ 폴백을 추가할 것.
```

### 4-3. 라이선스

CMU Graphics Lab Motion Capture Database는 무료 이용 가능(기존 32종 대량 이식 전례).
Motifect(유료) 계열만 원본 FBX 재배포 금지 — 리타겟 산출 JSON만 커밋한다는 기존 방침 유지.

---

## 5. 리스크 · 열린 질문

1. **B1 클립이 "프리스로"라는 점** — `124_04`의 앞 2.5초는 분명히 제자리 바운스지만, CMU 라벨은 Free Throw다.
   시연 영상 캡션이나 문서에 "CMU 124_04(프리스로) 앞 구간"으로 정직하게 기재할 것.
2. **`06_13`의 B3 잔존** — 현행 `demoClipFor`에서 `cmu_dribble_low`는 이제 B단계에서 안 쓰인다.
   `main.js:3974` 주석의 "BK_B3 = 로우 드리블 클립의 컷 구간(16~21s)"은 이미 사문(stepbackDemo가 덮어씀) — 정리 대상.
3. **subject 102 BVH 미확인** — 좌우 셔플·페이크·급정지를 넣고 싶다면 여기가 병목. 착수 전 변환본 존재부터 확인.
4. **판정은 전부 봇 프로브 기준** — 현재 시뮬레이터는 실제 사용자를 측정하지 않고 X Bot(=따라하는 사람 역할)의
   본 위치를 읽는다. 위 성공 판정 기준은 그 구조 위에서 "봇이 기준을 만족하는지"를 계측하는 값이며,
   실기기 이식 시에는 동일 물리량(힙 높이·발 XZ·손목 Y)을 센서에서 받도록 대체하면 된다.
5. **`judge`는 라이브(C) 전용** — B단계 판정은 `session.js` 틱 핸들러에서 직접 계산한다
   (`BK_A3` 스쿼트가 `hips.y`로 하는 방식). `judge.tolT/tolP`는 임계값만 빌려 쓴다.
