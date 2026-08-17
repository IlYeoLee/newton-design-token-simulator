---
name: newton-mixamo-pipeline
description: Mixamo 확보는 API(tmp_mixamo.mjs)로 — 토큰은 유저 크롬 leveldb에서 · xbot.fbx엔 스켈레톤 두 벌
metadata: 
  node_type: memory
  type: reference
  originSessionId: 55a17b04-da38-4a51-9123-c04d723b3c90
  modified: 2026-08-11T19:21:10.578Z
---

**Mixamo 다운로드는 브라우저 조작 없이 API로 끝난다** — `tmp_mixamo.mjs` (리포 루트, gitignore).

- 토큰: 유저가 쓰던 크롬에서 mixamo.com 로그인 → `tmp_grab_token.mjs`가 크롬 프로필 `Local Storage/leveldb`에서 access_token 추출 (새 창 띄우면 유저가 싫어함 — 08-12 실증)
- `search <어>` → `get <product_id> <이름>` (X Bot 캐릭터 id `2dee24f8-3b49-48af-b735-c6377509eaac` 하드코딩 — 유저 프라이머리는 crockscrew라 그대로 쓰면 딴 스켈레톤으로 리타겟됨)
- 받은 FBX는 `node scripts/ingest_fbx.mjs <files>` → assets/imported/ 자동 등록(imp_*), mixamorig면 Blender 불필요(Windows에서 그대로 돌아감)

**클립 합성/베이크 함정 2개 (tmp_bake_inout.mjs 실증):**
1. **xbot.fbx엔 스켈레톤이 두 벌**(본 129개, 이름 전부 중복). traverse로 본을 모아 구우면 같은 이름 트랙이 두 개씩 생겨 재생 때 싸운다(포즈 반토막). 이름당 첫 본만 굽는다.
2. Mixamo 클립 트랙 = 전 본 쿼터니언 + **힙 position 하나뿐** (본별 position/scale 없음). 합성 출력도 같은 구성이면 된다.

카탈로그 참고: 복싱 전용으로 Lead Jab(헤드/바디 변형별), Boxing Idle, 스텝 Fwd/Back(Short/Med/Long — 변위 다름, 합성 시 짝 맞추기), 사이드스텝, 피벗, 블록, 닷지 등 117건.
