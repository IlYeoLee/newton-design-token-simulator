---
name: newton-floor-content-fit
description: "뉴턴 지면 UI — 발자국·인물은 콘텐츠 투사영역에 맞추고, 인물은 넣기 전에 크롭해 크기감을 통일한다"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae626350-496c-43a4-9310-f203bdfdd7ea
  modified: 2026-08-05T16:48:34.169Z
---

뉴턴 지면(바닥) UI 작업에서 발자국과 인물(코치 영상)을 배치할 때:

1. **콘텐츠 투사영역(CONTENT 밴드)에 맞춰서 넣는다.** 대지 좌표 아무 데나 두지 않는다.
   `floorgl.js LAYOUT.CONTENT_Y0 ~ CONTENT_Y1` 이 "인물 영상·판정 마크가 쓰는 영역"으로
   이미 선언돼 있다. 3D 발마크는 `yToFwd(y, boardFwd, sUni)` 로 밴드를 전방 거리로 환산해 맞춘다.
2. **인물은 넣기 전에 크롭해서 크기감을 먼저 맞춘다.** 소스 영상마다 인물이 프레임에서 차지하는
   비율이 제각각이라, 그대로 넣고 w/h 로 조절하면 화면마다 인물 크기가 달라 보인다.
   크롭으로 인물 점유 비율(ph)을 통일한 뒤 배치한다.

**Why:** 좌표를 손으로 박으면 요소가 서로를 가리는지 여부가 순전히 운이고, 그때마다 말로 고쳐야 했다.
인물도 소스마다 크기감이 달라 "같은 시스템"으로 안 읽혔다.

**How to apply:** 새 스테이지·새 코치 영상을 추가할 때 ① 밴드에서 자리를 정하고 ② 소스를 먼저
크롭해 ph 를 맞춘 뒤 ③ 배치한다. 배치 후 눈으로 보정하는 순서로 하지 않는다.

관련: [[newton-floor-legibility]] · [[newton-export-all-intra]]
