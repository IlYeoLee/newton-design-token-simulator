---
name: newton-floor-hint-vocab
description: "뉴턴 지면 UI 어휘 — 안내(힌트)는 도트 아웃라인이 차오르고, 판정은 채움 토큰. 화살표는 sand"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 851569c5-7e50-4b68-8968-351b35457393
  modified: 2026-08-09T20:51:22.596Z
---

**안내와 판정은 다른 어휘를 쓴다** (유저 2026-08-10 확정):
- **안내(힌트·영역)** = 도트 아웃라인, 진행은 **점 단위로 차오름**. 채우지 않는다.
  사각↔원 변주 가능 — `drawStanceBox` 가 round 를 반폭까지 키우면 원형 전용 경로
  (`drawZoneDots`, 점 32개)로 간다.
- **판정(닿았다/해냈다)** = 꽉 찬 토큰(floorRing 상태머신·매트 활성 노드).

**Why:** 농구가 힌트에도 판정 토큰을 써서 "어디가 안내고 어디가 판정인지" 안 갈렸다.
복싱 가드 박스(도트 draw-on)가 이미 안내 어휘의 정본이었다.

**How to apply:**
- 스텝백 목표 존 = stanceBox 프림(round 3.9 · feet 0), prog = 그 발의 이동 진행 q.f.
- 드리블 매트 미점등 노드(on:false) = 채움 없이 도트 원(drawDribbleMat 안 분기).
- 원형을 박스 경로 재활용으로 만들지 말 것 — 상자가 정사각이 아니라(**bw W−80s vs
  bh W−96s**) 원이 찌그러지고, 바탕·차오름 도트 리듬이 어긋나 두 줄로 보인다.
- 지면 화살표 색은 **BRAND.sand**(#FEC389 연한 코랄 — 러닝 목돌리기 그 색).
  팔레트 이름이 통념과 반대: coral 이 진한 주황이다. prism·red 는 지면에서 묻힌다.
- 관찰(영상 설명) 국면엔 지면 큐(화살표·존)를 전부 끈다 — 영상과 동시에 보이면 깨진다.

관련: [[newton-bot-clip-canon]] · [[newton-floor-legibility]]
