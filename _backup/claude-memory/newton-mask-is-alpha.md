---
name: newton-mask-is-alpha
description: 뉴턴 마스크 소재는 알파에 들어 있다 — 에펙에서 루마 매트로 걸면 안 된다
metadata: 
  node_type: memory
  type: reference
  originSessionId: 72b091b5-046c-4c1a-be2a-0c1351d5f549
  modified: 2026-08-06T02:50:58.846Z
---

지면 UI 마스크(`mask_P1_*.png`)는 **알파 채널**에 들어 있다. 에펙에서
**「알파 반전 매트」(Alpha Inverted Matte)** 로 걸어야 한다.

「루마 반전 매트」로 걸면 띠 **아래 전체가 통째로 지워진다** — 띠 바깥은 알파가 0 인데
RGB 는 흰색이라, 휘도로 읽으면 전부 흰색으로 읽히기 때문이다. 증상은 "착지하는 토큰이
반으로 잘려 보인다"(실측 2026-08-06). ffmpeg 으로 검증할 때도 `format=gray` 가 아니라
`alphaextract` 를 써야 같은 결과가 나온다.

원본 마스크는 대지 **y0 부터 y1276** 까지 덮는데 이건 너무 넓다 — 위로는 제목 위 빈
공간이 띠로 드러나고, 아래로는 착지 토큰(대지 y1609, 반지름 451)의 머리를 잘라먹는다.
판의 실제 글자 범위는 **대지 y175~1045** 다. 양 끝을 부드럽게 깎아 **y132~1139** 로
줄인 것이 `03_마스크_다듬음`.

한글판 애펙 용어: 루마 반전 매트 = Luma Inverted Matte · 알파 반전 매트 = Alpha Inverted Matte.

[[newton-sim-direct-export]] · [[ae-script-rules]]
