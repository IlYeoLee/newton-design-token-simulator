---
name: newton-boxing-clip-map
description: 복싱 봇 장면별 클립 정본(08-12 실측 배정) — boxGuard 일괄 시절로 되돌리지 말 것
metadata: 
  node_type: memory
  type: project
  originSessionId: 55a17b04-da38-4a51-9123-c04d723b3c90
  modified: 2026-08-11T19:20:56.403Z
---

**복싱 비실전 장면의 봇 클립은 08-12에 골격 실측(tmp_scan_box.mjs)으로 배정했다** (커밋 3e46fe5, merge-trial).

- READY·T1·T2·B1 = `imp_mx_idle_guard` (가드율 100%, READY hold 폐기)
- A2 = `auto_mx_step_inout` (Mixamo 스텝 fwd 0.60m+back 0.64m 합성, 잔차 3.7cm 제거)
- A3·B3 = `imp_mx_jab_head_med` (헤드 잽 y1.47 ≈ 벽 타겟 1.58 — 구 boxJab은 바디잽 y0.96)
- B2 = `auto_cmu14_02` 창 **[3.5, 5.1]** (좌슬립 3.9s→우슬립 4.7s, 양끝 포즈 일치 → 하드 루프 OK. 전 구간 돌리면 스파링 잡동작 섞임)
- A1 절차 목풀기·C단계 idle 은 기존 유저 확정 유지

**Why:** boxGuard(Mixamo 'Boxing')는 잽·크로스가 섞인 섀도복싱이라 '가드 유지'·'스텝' 장면에서 봇이 펀치를 던졌다. 클립 이름·라벨을 믿지 말고 손 뻗음(방향 무관 수평 ext)·머리 좌우·힙y를 실측해서 골라야 한다.

**How to apply:** 클립 후보 평가는 `tmp_scan_box.mjs <이름> [t0 t1]` (요약/타임라인). 블레이드 스탠스에선 힙 기준 전방 투영이 펀치를 과소평가한다 — ext(수평 거리)로 볼 것.

관련: [[newton-bot-clip-canon]] · [[newton-mixamo-pipeline]]
