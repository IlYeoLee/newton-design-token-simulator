---
name: newton-floor-legibility
description: 뉴턴 지면 UI 크기는 감이 아니라 시각도(visual angle)로 역산한다 — 근거는 docs/FLOOR-LEGIBILITY.md
metadata: 
  node_type: memory
  type: project
  originSessionId: ae626350-496c-43a4-9310-f203bdfdd7ea
  modified: 2026-08-05T16:48:53.661Z
---

바닥 투사 UI의 활자·컴포넌트 크기는 **시각도에서 역산**한다. 감으로 정하거나 기존 값을 복사하지 않는다.

```
바닥은 스치는 각도로 보인다:  h = θ · d² / E
  E = 눈높이(신장 × 0.936) · d = √(E² + x²) · x = 발 앞 수평거리
```

목표 시각도 (2026-08-06 확정):
- 1급(타이틀·타이머 숫자) **0.55°** — ISO 9241-303 권장 0.37°의 1.5배. 운동 중 움직임·저대비 투사면·곁눈 훑기 3중 보정
- 2급(배지·단위) **0.37°** — ISO 권장 그대로
- 절대 하한 **0.20°** — Legge & Bigelow 2011 임계 활자 크기

**Why:** 기존 `minFs(y) = 68 − 40·(y/2670)` 은 출처가 없는 선형식이었고, 실측하니 가장 엄격한
외부 기준보다도 1.7~2.5배 보수적이었다. 근거가 없으니 "이거 너무 큰데?"에 답할 수 없어 매번 감으로 다퉜다.

**How to apply:** 크기를 정할 일이 생기면 `docs/FLOOR-LEGIBILITY.md` 를 먼저 읽고,
토큰 갤러리(`/tokens.html`)의 시각도 패널에서 확인한다. 신장 160~180cm 에서 필요 크기가 거의
같으므로(눈이 높아지면 거리도 멀어져 상쇄) 한 벌로 전 사용자를 덮는다.

숫자의 정본은 `floorgl.js` 의 **TOK 객체 하나**다. 페인터 안에 숫자를 다시 적으면 반드시 갈린다.

관련: [[newton-floor-content-fit]]
