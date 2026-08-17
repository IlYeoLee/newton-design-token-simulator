---
name: newton-air-target-ui-feedback
description: 잽잽훅 진입 시 이전 스테이지처럼 되돌아가던 다운시프트 회귀 — 08-11 수정 완료 (7a2b05c)
metadata: 
  node_type: memory
  type: project
  originSessionId: 8a15c782-41ce-434a-8824-17a75c88810d
  modified: 2026-08-10T21:40:18.549Z
---

"잽잽훅 앞에 UI가 공중에 너무 많이 떠 있다 / 이전 잽대련처럼 살아난다"는 유저 신고의 정체는
미관 문제가 아니라 **회귀 버그**였다: 복싱 C3(잽잽훅) 진입 1.2초 만에 judge 의 무의미한 miss
연속(수행자는 실사 실루엣인데 프로브는 xbot 손목)으로 다운시프트가 발동해 B1→…→C2(잽 대련)를
다시 돌았다. `_missStreak` 가 스테이지 전환에서 리셋 안 되던 것도 합산 원인.
2026-08-11 수정 커밋 7a2b05c (merge-trial, 리포 `dev\newton-design-token-simulator`).

**Why:** 유저 신고가 미관 불평처럼 보여도 "이전 화면이 다시 나온다"류는 스테이지 회귀부터 의심.

**How to apply:** 복싱 판정을 실전 연결하기 전까지 `reportVerdict` 의 복싱 가드를 풀지 말 것.
프로브로 재현할 땐 스크린샷·산출물을 리포 밖에 쓸 것 — vite always-full-reload 가 리포 안
아무 파일 변경에도 페이지를 리로드시켜 실험을 오염시킨다(scripts/_probe_c3_leak.mjs 참고).
[[verify-before-claiming-fixed]]
