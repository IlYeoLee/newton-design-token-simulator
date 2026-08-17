---
name: newton-lut-files
description: Documents\뉴턴_LUT 에 자작 .cube LUT 2종 — 매칭용은 다른 클립에 쓰면 망가진다
metadata: 
  node_type: memory
  type: project
  originSessionId: a3c5908e-5ae1-4556-a778-47c68204bf7e
  modified: 2026-08-10T08:43:17.992Z
---

`C:\Users\user\Documents\뉴턴_LUT\` 에 자작 LUT (2026-08):

- **뉴턴_룩_유니버설.cube** — 룩 전용. WB 없음, 피벗 고정 S커브(CONTRAST 0.22) + 채도 1.15, 스킨 1.06·섀도우 보호. 아무 푸티지에나 안전.
- **뉴턴_추구미_100/60.cube** — 뉴턴_15.mp4(물빠진 촬영본)를 힉스필드 레퍼런스 톤으로 끌어올리는 통계 매칭 보정용. **다른 클립에 쓰면 안 됨** — 05.mp4에 걸었더니 실내 파란 캐스트(WB 게인), 야외 미드톤 어두워짐, 피부 결 뭉개짐.

**Why:** 한 클립 통계로 매칭한 LUT는 그 클립 전용. 범용 룩은 통계 매칭 없이 피벗 고정 커브로.

**How to apply:** 생성 스크립트 방식 — 휘도 커브·WB·채도를 분리 산출(채널별 히스토그램 매칭은 장면 구성 다르면 실패). ffmpeg `lut3d` 로 AE 없이 미리보기·렌더 가능. 결과는 반드시 프레임 따서 실측 확인 ([[verify-before-claiming-fixed]]).
