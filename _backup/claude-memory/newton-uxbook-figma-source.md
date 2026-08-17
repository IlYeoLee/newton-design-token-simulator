---
name: newton-uxbook-figma-source
description: 뉴턴 UX북의 한영 원고 원본은 피그마 영한검수 캔버스 — 파일 키와 추출 방법
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6d71e26d-0225-41f1-b717-309a00c8b439
  modified: 2026-08-08T07:51:18.792Z
---

뉴턴 UX북(`IlYeoLee/newton-uxbook`, 로컬 `C:\Users\user\dev\newton-uxbook`)의 **한/영 카피 원본은 피그마**다.

- 파일 키 `iekYw8KLesjQHZAbL7tQcn` (26MEP_ux북), 검수 캔버스 노드 `43:31` = `영한검수`
- 그 안에 `한글버전` / `Newton 영어 버전` 두 SECTION, 각각 `WEB` 프레임에 텍스트 76개가 **같은 순서로** 들어있다 → 인덱스로 짝지으면 한영 매핑이 나온다
- 피그마는 줄바꿈에 **U+2028**(LINE SEPARATOR)을 쓴다. `\n` 으로 정규화하지 않으면 매칭이 전부 깨진다
- 라벨(`(2) Play On, Step by Step`)과 제목이 피그마에선 **별도 텍스트 노드**인데 책에선 `라벨\n제목` 한 문자열이다. 제목만 갈아끼우면 라벨이 사라진다

추출은 MCP 없이 REST 로 된다: `GET api.figma.com/v1/files/<키>/nodes?ids=43:31` + `X-Figma-Token` 헤더. 토큰은 figma.com/settings → Security → Personal access tokens (계정 메뉴는 **좌측 상단**). 조직 계정이면 관리자가 막아둘 수 있다.

반영 지점: 한글은 `build.py` 의 `TEXT_PATCHES`(원본 `structure_full.json` 의 `.x` 를 키로), 영문은 `translations.json`(반영 후 한글이 키). 관련 [[newton-concept-video-package]]
