---
name: newton-file-line-endings
description: "뉴턴 리포는 파일마다 줄바꿈이 다르다(footlab=CRLF, index=LF) — 일괄 치환 스크립트가 통째로 플립시킨다"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8a15c782-41ce-434a-8824-17a75c88810d
  modified: 2026-08-11T23:34:28.402Z
---

뉴턴 시뮬레이터 리포(`newton-design-token-simulator`)는 `core.autocrlf=false`이고 파일마다 줄바꿈이 다르다: **footlab.html·src/main.js = CRLF**, index.html = LF.

**Why:** 08-12에 파이썬 `io.open(..., newline='')` 일괄 치환으로 footlab을 고쳤더니 CRLF가 전부 LF로 플립돼 3250줄짜리 가짜 diff가 커밋됐다(440b1f9). 병렬 세션과 머지할 때 전 파일이 충돌 지뢰가 된다. 4ed7709로 원복.

**How to apply:** footlab.html 등 CRLF 파일은 Edit/Write 도구로만 고친다(줄바꿈 보존). 파이썬으로 일괄 치환해야 하면 바이너리로 읽고 쓰거나 `newline='\r\n'`을 명시한다. 커밋 전 `git diff --stat`에서 수정 줄 수가 비정상적으로 크면 플립을 의심할 것. [[verify-before-claiming-fixed]]
