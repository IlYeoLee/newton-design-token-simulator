# 인수인계 — 발자국 재구축 (2026-08-06)

시뮬레이터를 조각부터 다시 세우는 작업. 페이지 3개가 새로 생겼고, 정본 셰이더는 **한 군데**만
고쳤다. 세 페이지 다 `npm run dev` (5199) 로 바로 열린다.

| 페이지 | URL | 무엇 |
|---|---|---|
| `sim.html` | `/sim.html` | 재건 ① — 발자국 2개. 하프톤(압력 농도) |
| `heatmap7.html` | `/heatmap7.html` | 7상태 비교판. 윗줄 원본 · 아랫줄 그라디언트판 |
| `shoes-connected.html` | `/shoes-connected.html` | 레퍼런스 앱 화면 이식(SVG·의존성 0) |

---

## 정본 변경 — 딱 하나

`src/tokens.js` MARKFX 하프톤 블록. **도트 농도 = 압력** 규약을 하프톤 스킨에도 걸었다.

```glsl
float prH   = plantar(uv, mkSDIn(uv), sdh);
float press = mix(1.0, 0.40 + 0.60 * prH, clamp(uPlantar, 0.0, 1.0));
float rad   = pit * 0.5 * clamp((0.62 + 0.30*band) * uHTGain * edge * press, 0.0, 1.0);
```

- 각인 도트(`fx-core.js` `press`)가 이미 쓰던 규약이다. 새 계산이 아니라 **같은 규약의 이식**.
- 바닥값이 각인(0.16)과 다르다(0.40). 각인은 필 **위에** 얹히지만 하프톤은 필을 **대체**해서,
  0.16 까지 떨어뜨리면 저압부가 점이 아니라 **구멍**이 되어 형태가 끊긴다.
- `uHT` 는 어디서도 기본 0(FX Lab 토글)이라 **기존 화면은 무변화**. 본 시뮬·footlab 로드 확인함.
- 롤백 지점: `uPlantar = 0` 이면 예전 동작 그대로.

---

## 페이지별 요점

### `sim.html` — 재건 ①
정본 부품만 조립한다. `footSDFTexture` + `makeMarkFXMaterial` + `FOOT_PLANE_M × QUAD_K`(성인 240mm)
+ 벌림 각 ∓3° + 좌우 간격 0.189m(`FootMark.READY_SPREAD`, 피그마 342:3057).
`window.__sim = { scene, cam, mats }` 로 열려 있다 — 다음 조각은 여기 붙인다.

### `heatmap7.html` — 7상태
`ROWS` 두 줄. 윗줄은 `setMarkStateLook` 까지만(원본), 아랫줄은 그 위에 `HEAT_LOOK` 을 덮는다.
그라디언트판의 핵심은 하중 두 개를 **뒤집은** 것이다:

```js
loadBase: 0.5, loadGain: 0.6   // 정본 기본은 base 낮고 gain 높다
```
`loadGain` 이 세면 해부학 블롭(앞볼·뒤꿈치)이 값을 지배해 프린트 형상을 덮는다. 바닥값을 올리고
블롭을 낮추면 값이 곧 `plantar` 의 depth 항(= 깔창 깊이 × 맨발 프린트 깊이) 이 되어, **값 자체가**
발가락 갈라짐과 아치 파임을 갖는다.

상태 배치도 바뀌었다 — **Success ↔ Miss 를 맞바꿨고**(예전 Miss 의 밝은 룩이 성공으로 읽혔다),
Miss 는 회색조다(`buildLUT(STOPS, 0)` — 새 색이 아니라 같은 색의 채도 0).

### `shoes-connected.html` — 레퍼런스 화면
600×900 한 파일, SVG + CSS, 의존성 0. 깔창 패스는 리포 자산 `foot-out-l.svg` 그대로.
좌/우 짝의 차이는 **열 세기 하나**(`HEAT.L` / `HEAT.R`) — 도형·하프톤·베젤은 같은 부품이다.

아치는 마스크에 **검정을 얹어 실제로 뚫었다**(도형을 덮은 게 아니라 진짜 알파):
```svg
<mask id="ht"><rect fill="url(#dots)"/><ellipse … fill="url(#arch)"/></mask>
```

---

## 다음 사람이 밟을 지뢰 (전부 실측으로 밟았다)

1. **`uNumTex` 가 null 이면 화면이 통째로 빈다.** sampler2D 가 0번 유닛을 다른 타입과 공유해
   프로그램 검증이 깨진다(`VALIDATE_STATUS false`). 안 써도 아무 텍스처나 물려 둘 것.
2. **GLSL 은 JS 템플릿 리터럴 안이다.** 주석에 백틱 하나 쓰면 앱이 통째로 죽는다
   (`SyntaxError: Unexpected identifier`). 커밋 a156295 가 같은 사고다.
3. **후처리 없는 페이지는 `uOut = 0`.** 1 로 두면 OutputPass 역변환이 상쇄 없이 걸려 들뜬다.
4. **마스크는 바깥 좌표계다**(SVG). 안쪽 `transform` 을 같이 받으면 도트가 타원이 된다.
5. **CSS `font` 단축속성에 `family:inherit` 은 못 쓴다.** 'inherit' 이 글꼴 *이름* 으로 파싱돼
   조판이 통째로 기본 산세리프로 떨어진다. `font-family` 를 따로 쓸 것.
6. **vite 가 리로드 중일 때 스크린샷을 찍으면 빈 프레임이 나온다.** 소스 저장 직후 한 번은 버린다
   (`HANDOFF` 관련: `newton-export-server` 메모 참조 — 렌더 중 리포에 쓰지 말 것).
7. **Locked 는 무채다.** `markState` ph3 이 LUT 이 아니라 회색을 직접 그린다(규칙 ②: 무채는 상태
   부호). 램프를 태우려면 상태 정의를 고쳐야 한다 — 손대지 않았다.

## 버린 시도 (다시 하지 말 것)

- **열화상 램프**(파랑→시안→노랑). 유채 4색 규칙 위반이라 되돌렸다. `fx-core.js` 가 이미
  *"압력맵용 별도 계열 램프를 넣었다가 유저 지적으로 되돌렸다. 다시 만들지 말 것"* 이라 적어 뒀다.
- **색 축(온도 창) 넓히기**(`tLo/tHi`). 대비는 늘지만 상태 정체성이 깨진다 — Preview 가 흙빛,
  Success 가 얼음색으로 넘어간다. 창은 상태의 것이다.
- **`loadBase` 0.85 이상.** 압력이 1 로 포화해 전체가 한 색 판때기가 된다.
- **각인을 채움으로 써서 형상 그리기.** `uImpDot` 상한을 열면 solid 는 되지만, 겹쳐 그리는 방식
  자체가 요구와 어긋났다(유저: 합쳐서 그리지 말고 그라디언트만으로).

## 열린 것

- `heatmap7.html` Preview 가 평평하게 죽는다. 하중이 아니라 **그 상태 저장본**이 램프를 누른다 —
  footlab 의 Preview 슬롯을 봐야 한다.
- Miss 와 Locked 가 둘 다 무채다. 지금은 명도로 갈리지만 나란히 놓으면 헷갈릴 여지가 있다.
- `HEAT_LOOK` 값은 footlab 에서 눈으로 잡아 여기로 옮기는 게 정석이다(지금은 코드에 직접 박혀 있다).
