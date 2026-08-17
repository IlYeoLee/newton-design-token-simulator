---
name: verify-before-claiming-fixed
description: 재현 수단부터 만들고 고칠 것 — 유저에게 확인시키며 짐작으로 다섯 번 헛짚은 일이 있다
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9b3e5631-d6ed-4097-9451-26aa329e9915
  modified: 2026-08-09T16:22:04.107Z
---

2026-08-09 뉴턴 UX북에서 "태블릿만 카드 터치가 안 된다"를 **네 시간** 끌었다. 유저에게 계속 캡처를 요청하며 판정 방식을 다섯 번 바꿨는데 전부 헛짚었다. 진짜 원인은 확대를 여는 그 탭의 합성 click 이 방금 얹힌 딤 위로 떨어져 즉시 닫던 것이었다(마우스는 click 대상이 원래 요소라 데스크톱에선 안 나타남).

**Why:** 짐작으로 고치면 증상이 바뀌며 새 버그가 생기고, 유저는 매번 확인 노동을 떠안는다. 로그를 받아도 내가 잘못 읽었다(`OPEN 확대 열림`이 매번 찍혀 있었는데 못 봤다).

**How to apply:** 기기·환경 특이 버그는 **재현 수단을 먼저 만든다.** 여기서는 CDP 로 크롬을 몰아 진짜 터치를 넣는 `probe/touchtest.js` 를 만들자 원인이 한 번에 잡혔다(`Input.dispatchTouchEvent` + `Emulation.setTouchEmulationEnabled`, Node 24 는 전역 WebSocket 이 있어 의존성 없이 된다). 고친 뒤에도 그 스크립트로 확인하고 올린다 — "확인해줘"라고 하지 않는다.

곁들여: 코드 블록을 크게 지울 때 문법 검사(`node --check`)는 통과해도 지운 이름을 부르는 줄이 남아 실행 시점에 터진다. 지운 식별자를 grep 으로 훑을 것. 관련 [[newton-uxbook-deploy]]
