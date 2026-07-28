# 인수인계 — 2026-07-28 (2차)

새 세션에서 이 파일만 읽으면 이어서 작업할 수 있게 쓴 문서.
관련: `PROJECTION-SPEC.md`(투사 실물 규격·시선 설계), `BEAM-OCCLUSION.md`(차폐 실측).

리포: `IlYeoLee/newton-design-token-simulator` · 배포 https://ilyeolee.github.io/newton-design-token-simulator/
운영: **유저는 5199(vite dev)에서 본다.** 수정 후 `npx vite build` → "5199 새로고침"이라고 알릴 것.
배포는 `dist/`를 gh-pages 워크트리(`/tmp/ghp`)에 rsync 후 푸시. 배포 전 라이브 QA 필수(아래 참고).

## 작업 규칙 (유저 지시)

- **UI 배치·크기·색은 브라우저 검증 없이 코드만 넣고 넘긴다.** 브라우저는 숫자로만 확인되는 것(안 보이는 원인·타이밍·물리·콘솔 에러)에만.
- **하드코딩 금지.** 지면 UI는 룩시스템 토큰(`FootMark`/`floorRing`/`makeFlowArrow`/`drawTrajectory`)만 쓴다.
- 매 단계 한 줄씩 실시간 보고. 커밋은 자주.

## 지금 상태 (이번 세션에서 끝낸 것)

- **스텝백 4단계 자동화** — `session.js` `SB_POSE`(단계별 누적 포즈) + `STEP_SEG`(영상 구간 컷)만 고치면 1/4~4/4가 전부 따라온다. 발마다 독립 타이밍, 타닥 착지, 앞꿈치 접지(`uToe`), L·R 글리프.
- **실전(BK_C2)** — 정속 프리뷰 1회 → 끊김 없이 연속 → 스텝백 3점 3회 → 리포트. 마크 판정 토큰만 남기고 나머지 토큰·프레임 제거.
- **보이스/UX 라이팅** — 농구 전부 커리 1인칭, 복싱은 "고수에게 배우고 그 고수와 맞붙는다"로 단일화. 코치 보이스 3팩 동일(`scripts/gen_voice.mjs`, `--only`로 부분 재생성).
- **장면 타이틀 규칙** — `<코드> · <구간 n/N> — <한 줄>` 41개 통일.
- **제품/개발자 모드 분기** — 기본은 제품 뷰(좌 체험 랩 + 씬 + 우 조작 패널), `D`키·`?dev=1`로 개발자 뷰. 겉면은 NEWTON 다크 컬러 시스템(Figma 222-37297) + Supreme/Freesentation.
- **체험 랩** — 보정 구성요소 토글 + **RAW**(방향 고정 해제: 헤딩 스윙 0° → 352°) + 고개 각도 4단 사다리(정면 −8 / 원경 −20 / 중경 −30 / 근경 −40).
- 렌더 버그 수정: 검은 사각형·붉은 판(빈 프레임이 크로마 통과), 루프 깜빡임(시크 전 프레임 고정), HMR 검은 화면(항상 full-reload), 배포본 TDZ·팩 로드 레이스.

## 다음 작업 — 바닥 HTML UI를 WebGL로 (B안, 단계적)

**문제**: 바닥 UI(`floor-*.html`)는 CSS3DRenderer가 그리는 별도 DOM 레이어라 WebGL 깊이 버퍼를 공유하지 못한다 →
x봇 위로 통과한다. 지금은 봇 실루엣을 캔버스로 덮는 마스크(`updateFloorClipHole`)로 가려놨는데 원리적 한계다.

**해법 B(확정)**: 바닥 UI를 마크 토큰과 같은 방식(canvas 2D → `CanvasTexture` → 평면)으로 그린다.
깊이 테스트·빔 페더·차폐 소등을 자동 상속하고 마스크 오버레이를 삭제할 수 있다.
(A안 = foreignObject SVG 래스터화는 폰트 인라인 3.2MB·CSS 애니메이션 재굽기 때문에 기각)

**절차 — 4단계 전부 완료(`333298f`, `b82ddbe`)**
1. ~~CSS3D 경로는 그대로 두고 캔버스 버전을 플래그 뒤에 신설~~
2. ~~헤드리스 비교 검증~~
3. ~~기본값 전환~~ — 기본이 WebGL, `?floorgl=0`이면 옛 CSS3D 경로
4. ~~`updateFloorClipHole`(봇 실루엣 마스크) 삭제~~ — 가림은 깊이 버퍼가 담당

**① 완료분** — `src/floorgl.js`. `floor-scene.html`(러닝·농구 운동중 18스테이지)을 canvas 2D →
`CanvasTexture` 평면으로 이식. 노드가 **그리기 스펙 겸 DOM 스텁**이라 `main.js`의 구동 코드
(`fdoc.getElementById(…).textContent/style`)는 한 줄도 안 고쳤다 — `fdocNow()`가 경로만 갈아끼운다.
- 씬 소속 + `depthTest:true` 이므로 x봇 가림은 깊이 버퍼가 담당(마스크 불필요).
- 캔버스는 대지의 절반 해상도(`K=0.5`), 다시 그리기는 값 변화 있을 때만·최대 22fps.
- 장면 데이터(`floor-scenes.js`)와 OffBit 폰트를 `index.html`에 등록(캔버스가 읽어야 해서).
- 검증: 18스테이지 전수 진입 에러 0·전부 렌더(`tmp_qa_floorwalk.mjs`), 기본 경로 회귀 에러 0.
- 이식하며 뺀 것: 0.7초 페이드는 즉시 전환, 링 회전 팁 SVG는 같은 자리 빨간 점,
  `follow-view`(빈 박스, 시각 요소 없음)는 생략.

**전 문서 이식 완료** — 시작화면·운동중·전환·카운트다운·리포트 17개 화면 전수 진입 에러 0.
곁가지로 잡은 것: `impactRing`(복싱 주먹 임팩트, `depthTest:false`)이 러닝·농구 씬에 남아
x봇 위로 그려지던 버그. **지금 씬에 depthTest를 끈 메시는 0개다** — 새 토큰을 만들 때 이 불변식을 깨지 말 것.

## ★ 다음 작업 — 바닥 UI 모션 전부 이식 (유저 확정)

WebGL 이식은 **레이아웃만** 옮겼고 CSS 애니메이션을 거의 안 옮겼다. 유저 판정: "모든 지면 UI의
모션·인터랙션이 싹 다 사라졌다". WebGL 경로는 유지하고(되돌리지 않는다) 아래를 `src/floorgl.js`에
캔버스 변환으로 옮긴다. 모든 값은 각 원본 HTML의 `@keyframes`에서 그대로 가져온 것.

**공통 원칙**: 눕힌 프레임에서 세로 translate는 원근상 '멀리서 날아옴'이 된다 → 등장은 제자리
scale+fade로. 단 이미 바닥에 붙어 있는 요소의 '떠오름'(footBob·cardFloat)은 원본대로 translate.

| 문서 | 모션 | 파라미터 |
|---|---|---|
| floor / floor-bk | `charLoop` 타이틀 글자 웨이브 | 3s ease-in-out ×3, delay `i*0.09` · opacity .5→1 · translateY −16px @12% |
| | `fadeUpCentered` strip·devs·hero | .8~.9s cubic-bezier(.2,.75,.2,1), delay .35 / .5 / .7 |
| | `footBob` 발 탭 | 3s cubic-bezier(.4,0,.3,1) ×3, delay 1.5s · Y 0→46→6→44→0 |
| | `arrowBob` 화살표 | 3s ×3 delay 1.5s · Y 0→14→0→13→0 |
| | `glowLive` 하단 글로우 | 7s ×3 · translate(−16,10) scale 1.06 · opacity .85→1 |
| | 배터리 링 채움 | ✅ 이식됨 (delay 900+i*160ms, 1.5s) |
| floor-scene | `chIn` 타이틀 캐스케이드 / `sUpFlat` | ✅ 이식됨 |
| | `demoOutFlat` 프리뷰 행 퇴장 | .45s @ `--pvOut` |
| transition | `glowDrift` 배경 글로우 | 15s ×3 · translate/scale 1.05~1.13 / rotate ±4° |
| | `titleIn` / `charWave` | .85s .10s · 2.4s delay `.9+i*.05` ×3, Y −16px @29% |
| | `cardIn` + `cardFloat` | .8s delay .38/.54 · 4s·4.4s ×3, Y −13px |
| | `sPop` 체크·배지 | .6s cubic-bezier(.34,1.56,.64,1), delay .95 / 1.0 · scale .5→1.12→1 |
| | `sUpC` + `btnFloatC` + `btnPulse` | .8s .95s · 3.6s Y −18px · 3s 글로우 |
| timer | `ringPop` + `ringBreath` | .8s .35s scale .6→1.05→1 · 3s drop-shadow |
| | `numPulse` 숫자 바뀔 때마다 | .45s scale 1.5→1 opacity 0→1 |
| report | `ringPop`·`ringBreath`·`charWave`·`titleIn` | 위와 동일 |
| | `progFill` + 퍼센트 카운트업 | ✅ 이식됨 (1.4s delay .5s) |
| | stats `sUp` / btn `sUp`+`btnPulse` | .7s delay 1.15 / 1.35 |

**구현 메모**: `_paint_*()`에서 `this.t` 기반으로 각 요소의 진행도를 구해 `ctx.translate/scale/globalAlpha`로
적용하면 된다. 반복 횟수(×3)는 `t < 주기*3` 조건으로. 이징은 `cubic-bezier`를 근사 함수로 대체해도 무방.

## 바닥 UI 성능 — 이 작업과 함께 (계획)

지금은 대지 한 장을 통째로 다시 그려 `CanvasTexture`로 올린다(K=0.75 → 1200×2003 = **9.6MB/장**).
정지 화면은 서명 비교로 걸러져 **실측 1.0회/초**지만, 도트바·링이 움직이는 구간은 24fps까지 올라간다.

**해법**: 정적 텍스트(타이틀·캡션·라벨)와 움직이는 요소(도트바·프리뷰 링·숫자)를 **별도 평면으로 분리**.
움직이는 쪽 캔버스는 600×260 남짓이라 매 프레임 올려도 수백 KB다. 정적 쪽은 값이 바뀔 때만.
`src/floorgl.js`의 `_paint()`를 두 캔버스로 쪼개고 `mesh`를 두 개 두면 된다(변환은 같은 값 복사).

## 남은 이슈

| # | 내용 |
|---|---|
| 1 | ~~바닥 UI WebGL 이식~~ 완료. 이식하며 깎은 것: 0.7초 페이드→즉시, 링 회전 팁 SVG→빨간 점, 카드 inset 글로우→블러 스트로크 근사 |
| 2 | 스텝백 방향: 영상은 사이드(실측 오른발 u 0.53→-0.19), 마크는 앞으로 전진. **C안(대각선 = 뒤+옆, L·R 교차 금지) 합의됨** — `SB_POSE`만 고치면 됨 |
| 3 | `Quiet On`(복싱)·`Press On`(농구)은 카피에만 있고 구현 없음. 개입은 SAFE/BOOST/햅틱 셋뿐 |
| 4 | 실전 C2 판정을 유저 발 위치로 연결(지금은 영상 재생 위치 기준 시범) |
