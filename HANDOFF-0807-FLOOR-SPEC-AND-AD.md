# 인수인계 — 2026-08-07 · 지면 조판 규격 + 광고 컷

> 세션이 끊겨도 이어갈 수 있게. **먼저 `CLAUDE.md` → `docs/FLOOR-LAYOUT-SPEC.md` → 이 문서** 순으로 읽을 것.
> 브랜치 `b2-slip-clip-rebuild` · 배포는 `main` → `gh-pages`(rsync, 아래 절차).

## 1. 오늘 닫은 것

- **조판 규격을 문서·코드·검사기로 못박음** — `docs/FLOOR-LAYOUT-SPEC.md` + `scripts/check_floor_bands.mjs`
  밴드 6개(① 투사밖 0~17 ② 라벨 17~200 ③ 타이틀 200~429 ④ 진행 525~680 ⑤ 콘텐츠 776~1980 ⑥ 발밑 1980~2622)
  규칙 7개: 밴드 불겹침 · 타이틀 위는 라벨 하나 · **알약 높이 상수** · **링 지름 고정** ·
  타이머 화면당 하나 · **아크 폭 상수** · 죽은/무제 스테이지 금지. **현재 위반 0건.**
- 상단 금지선은 상수가 아니라 **식**이다: `y = 176 − 0.12/sUni` (main.js boardFwd 앵커에서 도출).
  러닝 y≥1 · 농구 y≥17 → `headY 400 → 200`, 콘텐츠 1004 → **1204px**.
- **FXQ 래스터 품질 스칼라**(`src/fx-core.js`) — `?fxq=3` 이면 5199 에서 **즉시** 고품질.
  마크 안 글리프 캔버스 128→128×k · SVG 글리프 래스터 512→512×k. 기본 1(실시간 예산 유지).
- 스테이지 목록이 **네 곳**에 사본(`session` · `tokenlab` · `floor-scenes` · `run_floor_ui`) — 규칙⑦이 교차 검증.

## 2. 지금 하려던 것 — 농구 광고 컷 (미완)

**컷 = `BK_C2` 관찰 7.2초.** 실전 직전이고, **경로선(`_sbTrail`)이 전부 깔린 유일한 화면**이다.
플레이트: `~/Desktop/화면 기록 2026-08-07 5.26.39.mov` (6.6s · 1794×1016 · 60fps · 실사 코트 · 바닥 UI 없음).

재현 절차 (실측 확인됨):
```
http://127.0.0.1:5199/?fxq=3  →  농구  →  세션 체험하기  →  BK_C2 까지 진행
확인:  __dbg.session.bkC2x.{trA,trB,trC}  →  visible true · _gain 0.42 · _prog 1
```
**함정**: `session.next(true)` 로 강제 전진하면 BK_C2 를 지나 FIN 까지 흘러간다(실측 2회).
`session.pinStage = true` 로 잡거나 자연 진행을 기다릴 것. 팩 버튼을 다시 누르면 복싱으로 튄다.

**관찰된 문제 1건**: 경로선 3개 중 하나가 `_prog 0.14` 로 거의 안 그려짐 —
`_sbTrail` 의 `len = d − IN*2` 가 짧아지는 구간(준비 L → 착지 L 은 실측 0.9m 대인데 `SB_TRAIL_MAX` 상한에 걸림).

## 3. 광고용 발전 계획 — `docs/AD-FLOOR-UI-PLAN.md`

핵심: **제품 룩을 광고 때문에 바꾸지 않는다**(오버레이 프리셋으로만). 새 그래픽 어휘 0개.
3층: A 스케일(FOOT_LEN_M 0.30→0.42, 경로선 _gain 0.42→0.7) · **B 흐름**(순차 draw-on·도트 흐름·파동 부활·완료 팡) ·
C 고스트(`BK_FIN` 의 Ghost Review 어휘를 실전 직전으로).
다음 액션 4개가 그 문서 §4 에 있다.

## 4. 남은 품질 병목 (확대하면 순서대로 걸린다)

1. **발 실루엣 SDF 해상도**(`footSDFTexture`) — 외곽선. FXQ 미적용.
2. **블러 반경이 캔버스 px 상수**(`blur(37px)`·`blur(7px)`) — 캔버스를 키우면 상대적으로 샤프해져 룩이 변한다.
3. **하프톤 피치**(0.027, uv 단위) — 클로즈업에서 점이 커 보인다. 광고에선 줄이는 쪽.

## 5. 배포 절차 (그대로 따라할 것)

```bash
npx vite build
cd /tmp/ghp && git fetch -q origin gh-pages && git reset --hard origin/gh-pages
rsync -a --delete --exclude '.git' <repo>/dist/ /tmp/ghp/
git add -A && git commit -m "deploy: <main sha>" && git push origin gh-pages
```
추출은 **반드시 5200(익스포트 전용 서버)** 에서: `npm run dev:export` → `node scripts/run_floor_ui.mjs --w 2048`
(5199 에 붙이면 소스 저장 한 번에 렌더가 죽는다 — 러너 주석의 경고.)
