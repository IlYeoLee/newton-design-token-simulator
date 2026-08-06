# 인수인계 — 발 벌리기(BK_B1 셋업) 지면 토큰 · 띠 프레임 · Success 재설계

**작업일** 2026-08-07
**발단** 유저: "농구 드리블 전에 다리를 좌우 너비로 넓히는 거, 그 바닥 토큰을 추출해야 한다.
이 정도 각도(초광각 띠 프레임)에 담기려면 각도 그리드 그려서 계산하고, 발과 좌우 화살표가
보이도록 기울여 봐라."
**결론** 시선각을 실측으로 풀고, 그 프레임에서 모션을 미리 보는 랩을 세웠고, 그 과정에서
발자국 룩의 **구조적 결함 세 가지**가 드러나 정본을 고쳤다.

---

## 1. 무엇이 생겼나

| 파일 | 내용 |
|---|---|
| `scripts/_grid_b1stance.mjs` | **각도 그리드 계산기** — 눈·토큰 실측 → 하향각·방위각 → pitch 스윕 → 띠 적합 구간 |
| `stancelab.html` | **띠 프레임 랩** — 모션·상태 8종·룩 후보·Success 후보·크기·격자·블렌딩 |
| `scripts/ae_stance_tilt.jsx` | **에펙 기울기 리그** — 같은 카메라·같은 곡선을 AE 컴프로 세운다 |
| `src/mark-versions.js` | 룩 후보(`VERSIONS`) + **Success 후보**(`SUCCESS_CANDS`) 등록소 — footlab·stancelab 공유 |
| `src/session.js` | `B1_SETUP` · `bkB1SetupPose` — 셋업 곡선 정본. `FootMark`·`floorArrow`·`BRAND` export |
| `src/main.js` | `GAZE.STANCE = -55` — 셋업 막 전용 시선각 |
| `src/mark-look.json` | 정본 갱신: `imp 0` · `plantar 0.55` · `loadGain 0.45` · `loadBase 0.06` · `states.tap` 림 |

---

## 2. 각도 — 왜 −55°인가

목표 프레임은 유저 레퍼런스 **1816×510 = 3.561:1**. 이건 새 화각이 아니라
**16:9 렌더(vfov 60°, `main.js` fpMode)의 중앙 49.9% 띠**다. 가로 화각은 그대로 91.5°,
세로만 32.16°로 잘린다.

`node scripts/_grid_b1stance.mjs` 실측(BK_B1 벌림 완료, 눈 y 1.69 · z −1.809):

```
요소       전방 d(m)      하향각(°)       방위각(°)
footL     0.87~1.52     62.9~48.1      -25.8~+3.6
footR     0.87~1.52     62.9~48.1       -4.9~+24.8
arrowL    0.88~0.99     62.6~59.7      -16.4~-3.3
arrowR    0.88~0.99     62.6~59.7       +1.6~+14.8

띠 안에 넷 다 들어오는 pitch : -63° ~ -47°
정중앙 정렬각                 : -55.3°   (ndcY ±0.225 = 띠의 45%, |ndcX| ≤ 0.30)
```

`GAZE.MAT(-52°)`도 들어오긴 하나 `yMin -0.327 / yMax +0.125`로 띠 하단에 붙는다.
그래서 셋업 막에만 `GAZE.STANCE(-55)`를 물렸다 — `MAT`을 건드리면 스텝백 B2~B4가 같이 움직인다.

**비율·화각이 바뀌면 다시 돌린다**: `node scripts/_grid_b1stance.mjs [비율] [vfov] [렌더aspect]`

---

## 3. 곡선은 한 곳에서 온다 — `bkB1SetupPose`

랩에 타이밍을 옮겨 적으면 그 순간 두 벌이 된다(이 리포가 반복해 밟은 패턴).
`session.js`의 한 함수가 시뮬 틱·stancelab·AE 스크립트에 같은 값을 준다.

```
0.0 ─ 0.8   대기
0.8 ─ 3.0   벌림  half 0.14 → 0.28 m  (smoothstep)  · 화살표 draw-on = 벌어짐 진행
    0.7 ─ 3.5   화살표 등장 창
3.0         Success (glow 1회 — 파문 시계 uSuccT 스탬프)
3.0 ─ 4.2   퇴장 (footOp 1 → 0)
6.0         막 종료 (SETUP)
```

`B1_SETUP` 상수(`Z`·`AZ`·`AX`·`ALEN`·`ASCALE`·`HALF0/1`)가 좌표 정본이고,
빌드 코드도 여기서 파생시켰다. 숫자를 바꾸려면 이 한 곳만 만진다.

---

## 4. 드러난 결함 넷 — 전부 "배선이 한쪽에만 있던" 문제였다

### ① 고춧가루 — 압력장 포화 + LUT 고원

유저: "안에만 빨갛고 영역이 날카롭게 구분된다."

```
fx-core plantar():  blob = loadBase + (ball+heel+toe)·loadGain − 0.34·arch
종전값           :  loadGain 1.45 · loadBase 0.22   → 볼·뒤꿈치에서 blob > 1 → clamp
mkR              :  q = 1 − 압력  → 그 구역 q 가 0 에 박힌다
palette.js STOPS :  [red@0, red@0.30, ...]  → LUT 0.00~0.30 이 **순수 red 고원**
```

두 개가 겹쳐 **단색 빨강 섬 + 날카로운 경계**가 됐다. 실측(같은 프레임 4장):

| loadGain / base | 결과 |
|---|---|
| 1.45 / 0.22 | 빨강 섬 · 경계 뚜렷 |
| 0.70 / 0.10 | 줄지만 여전히 딱딱 |
| **0.45 / 0.06** | **섬 소멸, 연속 그라디언트** ✔ |
| 창(tLo/tHi)만 넓힘 | 몸통만 샌드, **섬은 그대로** — 창은 처방이 아니다 |

섬이 둘로 남는 건 `uPlantar`가 국소 최댓값을 만들기 때문이라 그것도 눕혔다:
`plantar 0.84 → 0.55` (0.35 은 더 매끈하지만 0.20 이하는 압력 정보가 사라진다).

### ② 각인 점 — Success 만 껐더니 나머지 상태에 남았다

`SUCCESS_CANDS`는 `states['2']` 오버라이드라 Success 슬롯만 만진다. 각인은 **base 룩**이다.

```
M0(각인 0) 고른 뒤 상태별 uImp
  Success 0 · Active 0.98 · Preview 0.98 · Locked 0.98
```

정본 `imp 0.98 → 0`, `states['2'] 0.85 → 0`, `states['4'] 1 → 0`,
그리고 마지막으로 `states.tap 0.98 → 0`(Locked 이 이 슬롯을 참조한다).

### ③ 상태 전환 — 크로스페이드가 세션 발자국만 안 탔다

유저: "Success 로 전환될 때 중간다리 모션이 없다."

`tokens.js` MARKFX_FRAG 의 `uXfade`/`uStatePrev`/`uPrevProg` 분기(0.28s)는 진작 있었고
`Marker`(팩 판정 토큰)는 처음부터 탔다. `FootMark._ph` 만 `uPhase` 를 뒤집었다.
`Marker` 안에 인라인돼 있던 규약을 `startMarkXfade`/`tickMarkXfade` 로 꺼내
`FootMark._ph`(uPhase 바꾸기 **전에**)와 `tickWaves` 에 물렸다.

`setMarkStateLook` 의 리셋 KEYS 에 `loadGain·loadBase·flow·plantar·tLo·tHi·halo·pool·noise·dotMode`
가 빠져 있어 같이 채웠다 — 없으면 그 상태를 지난 재질이 값을 영영 들고 다닌다.

### ④ 화살표가 밝은 바닥에서 안 보였다

`drawStemArrow` 의 스템 그라디언트가 LUT **0.55/0.64/0.76/0.88/0.97**(코랄→샌드→프리즘),
촉 글리프도 `lut(0.95)` 로 **상수**였다. LINE 정본의 다른 획은 전부 `A.heat` 를 타는데 여기만 빠졌다.

- 스템·촉을 `hv(v) = clamp(v + (heat−0.5)·1.1)` 로 — `heat 0.5` 는 종전과 픽셀 동일(회귀 없음)
- `tickFlowArrows`: 주간(잉크)이면 `heatDay`(기본 0.15)로 낮춰 넘긴다.
  마크가 같은 무대에서 가산광을 못 쓰는 것과 **같은 이유·같은 처방**이다.

> ⚠ `floorArrow(x, z, deg, color, …)` 의 **color 인자는 죽어 있다** — `makeFlowArrow` 가 안 받는다.
> 색을 바꾸려면 `heat` 를 만진다. 인자 옆에 주석으로 못박아 뒀다.

### ⑤ footlab 이 정본을 안 받았다

"파일이 이긴다" 규칙(`_def` 스냅샷 비교)이 **최상위 키에만** 걸려 있었고
상태 오버라이드는 `Object.assign(OV, saved.states)` 한 줄이라 localStorage 가 통째로 덮었다.
`_defStates` 스냅샷을 추가해 같은 판정을 상태에도 적용했다.

검증(옛 저장본 `tap.imp 0.98 · op 0 · edgeShade 0.26`, `states.2 imp 0.85 · w 0.72` 심고 새로고침):

```
OV.tap    op 0.1 · imp 0 · edgeShade 0.7 · edgeW 0.028   (파일 ✔)
OV['2']   imp 0 · w 1.8                                   (파일 ✔)
P.imp 0 · P.plantar 0.55                                  (파일 ✔)
```

---

## 5. Locked / Tap2 — 각인을 끈 대가와 그 처방

각인이 몸통이던 슬롯이라 `imp 0` 이 되자 형태가 안 잡혔다(유저: "완전 투명한 건 너무 안 보인다").
가장 불리한 무대(밝은 바닥)에서 6안 실측:

| 안 | 결과 |
|---|---|
| `op 0`(종전) | 형태 안 읽힘 |
| `op 0.18` / `0.28` | 읽히지만 **고스트 성격을 잃는다** |
| `op 0.28` + 림 강화 | 거의 흰 덩어리 — Preview 와 위계가 겹친다 |
| **`op 0.10` · `edgeW 0.028` · `edgeShade 0.70` · `bloom 0.26`** | **속은 비고 림이 형태를 든다** ✔ |

'무채 고스트'는 **안 채워 보이는 게 정체성**이라 필이 아니라 림으로 올렸다.
되돌리기: `states.tap` 의 op/edgeW/edgeShade/bloom 을 `0 / 0.01 / 0.26 / 0.165` 로.

---

## 6. 에펙으로 넘기기 — `scripts/ae_stance_tilt.jsx`

파일 > 스크립트 > 스크립트 파일 실행… > `scripts/ae_stance_tilt.jsx`

세워 주는 것:

| | 값 | 출처 |
|---|---|---|
| 컴프 | 1816×510 · 30fps · 6.0s | 유저 레퍼런스 · `B1_SETUP.SETUP` |
| 축약 | **1 m = 1000 px** | 리포 지면 대지 규약(1 px = 1 mm) |
| 카메라 | 눈높이 1690px · 하향 55° · Zoom 885px | 실측 · `GAZE.STANCE` · 세로화각 32.16° 역산 |
| 지면 | 3D 솔리드 · X회전 90° | 여기 얹은 2D 그림이 같은 원근을 탄다 |
| 토큰 | FOOT L/R(z 1190, x ∓140→∓280) · ARROW L/R(z 930, x ±40) | `B1_SETUP` |
| 모션 | 매 프레임 구운 키프레임 | `bkB1SetupPose` |
| 가이드 | 30cm 격자 · FLOOR (기본 꺼짐) | 크기 판단용 |

**Zoom 을 화각 필드로 넣지 말 것.** AE 의 '화각'은 긴 변 기준이라 띠 프레임에서 어긋난다.
스크립트는 `zoom = (높이/2) / tan(세로화각/2)` 로 넣고, 그 결과 가로 화각이 91.5°(= 16:9 원본과 동일)가 된다.

**이징을 손으로 찍지 말 것.** 시뮬은 `smoothstep(3t²−2t³)` 이라 스크립트가 매 프레임 값을 굽는다.
AE 기본 이지이즈는 그 곡선이 아니고, 랩과 영상이 미묘하게 안 맞는 원인이 된다.

FOOT/ARROW 솔리드를 실제 그림으로 교체하되 **3D · X회전 90° · 위치**만 유지하면 원근은 그대로 걸린다.
화살표 draw-on 은 `CTRL — draw-on(prog)` 널의 슬라이더에 물려 있다.

---

## 7. 확인하는 법

```bash
npx vite --port 5199                    # 먼저 띄운다
node scripts/_grid_b1stance.mjs         # 각도 그리드 재계산 (비율·화각 인자 가능)
open http://127.0.0.1:5199/stancelab.html   # 띠 프레임에서 모션·상태·후보
open http://127.0.0.1:5199/footlab.html     # 8상태 갤러리 — 정본이 반영됐는지
npx vite build                          # 통과해야 한다
```

랩 계측 훅: `window.__lab`(stancelab — LOOK·mats()·rebuild·setPh) ·
`window.__fl`(footlab — P·DEF·OV·DEF_STATES·LOOK). 정본과 저장본 중 어느 쪽이 이겼는지 여기서 읽는다.

---

## 8. 합성 — 목표 판과 알파 추출

### 목표 판 실측 (`03-[농구]합성전.mp4`)

```
3840×2160 · 29.97fps · 29.9s
실사 / 띠 솔기 :  y = 1080  — **정확히 화면 절반**
띠             :  3840×1080 = 3.556:1
이 리포의 프레임 계산 :        3.561:1   → 사실상 동일. 기울기를 다시 풀 필요가 없다.
```

### 알파 추출이란

투사 UI 만 남기고 **배경을 투명하게** 뽑는 것. 실사 위에 얹으려면(합성) UI 뒤가 비어 있어야 한다.
이 리포에는 두 경로가 있다.

| | 방식 | 언제 |
|---|---|---|
| `export_ui.mjs --alpha` | 렌더러가 배경을 안 칠하고 알파 채널을 그대로 들고 나온다 | 세션이 안 만드는 화면 |
| `alpha_floor.mjs` | 이미 **검은 배경**으로 구운 시퀀스에서 휘도 문턱 아래를 완전 투명으로 깎는다 | 사후 정리 |
| **`export_stance_alpha.mjs`** (신규) | stancelab 을 그대로 찍는다 — 세션 곡선을 `t` 로 직접 구동 | 셋업 막 |

문턱 방식이 성립하는 이유: 투사광은 **가산**이라 '검정 = 빛 없음 = 투명'이다.
문턱을 추측하면 안 되는 이유: 알파 감마가 어두운 톤을 들어올릴 때 거의-검정 배경까지 같이 올라가
알파 20~30 짜리 **베일**이 판 전체에 남는다. 그 베일이 배경을 미세하게 깎고, 노이즈라 압축이
안 돼 용량을 몇 배로 부풀린다(실측: 알파>0 픽셀의 88.6% 가 알파 40 미만이었다).
그래서 **플레이트 코너 픽셀을 재서** 정한다.

### `scripts/export_stance_alpha.mjs`

```bash
npx vite --port 5199                                   # 먼저 띄운다
node scripts/export_stance_alpha.mjs                   # 3840×1080 · 30fps · 0~4.4s
node scripts/export_stance_alpha.mjs --blend add       # 어두운 플레이트용(레이어 Add)
node scripts/export_stance_alpha.mjs --mov             # ProRes 4444 로 묶기
```

`export_ui.mjs` 를 안 쓴 이유: 그건 결정론을 위해 **세션을 안 돌려서** 셋업 막을 재현 못 한다.
`export_live_ui.mjs` 는 돌리지만 띠 크롭이 없다. stancelab 은 이미 세션과 같은 곡선을
`t` 로 직접 구동하므로 세션 없이도 결정론적이고, **랩에서 본 화면이 그대로 나온다**.

검증(1920×540, t 3.0): 코너 알파 0 · 알파>0 픽셀 2.34% · 최대 알파 255.
`ffmpeg -i plate.png -i f0000.png -filter_complex "[0][1]overlay=0:1080"` 로 실제 판에 얹어 확인했다.

> 에펙에서 알파를 **Straight** 로 해석할 것. Premultiplied 로 잡히면 가산광 가장자리가 검게 먹는다
> (`ae_import.jsx` 가 이미 밟은 함정).

---

## 9. 남은 일

- **발 크기 미결 — 측정이 아직 안 끝났다.** 정본은 `FOOT_LEN_M = 0.30`.
  유저가 "바닥 타일이 하나에 한 30cm"라고 했는데 그 전제를 실사로 검증하려다 두 번 실패했다:
  ① 마크 세로 길이 대 셀 가로 피치를 비교했다 — **−55° 원근에 눌린 세로와 가로는 못 잰다**(무효).
  ② 실사 신발(성인 280mm)을 자로 쓰려고 자동 런 검출을 했는데 신발 행을 못 잡았다(8px 검출).
  다음 사람은 **신발 양 끝을 손으로 찍어** 그 행의 셀 피치와 비교할 것. 그게 셀의 실치수고,
  거기서 마크 배율이 나온다. 랩의 '발 길이' 슬라이더로 값을 고른 뒤 `tokens.js FOOT_LEN_M` 에 박는다.
- **Success 후보 미확정.** `SUCCESS_CANDS` 에 M0~M4 가 있고 base 층(압력)만 정본에 구웠다.
  Success 슬롯의 밝기·창은 아직 유저가 안 골랐다.
- **크로스페이드 0.28s 는 `Marker` 값을 그대로 가져온 것**이라 발자국에 맞는 길이인지 안 쟀다.
- **`stancelab` 의 배경은 임시**(`public/textures/tmp_stance_bg.png` = 유저 레퍼런스). 정식 무대가 아니다.
