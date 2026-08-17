---
name: mac-nfd-filenames
description: "맥에서 온 한글 파일명은 자소분리(NFD) — ffmpeg/스크립트가 \"파일 없음\"으로 깨진다"
metadata: 
  node_type: memory
  type: reference
  originSessionId: e49de6d5-95e7-4ae8-84f8-ff7ba8f600b5
  modified: 2026-08-10T19:43:43.451Z
---

맥에서 넘어온 한글 파일명(러닝.mov 등)은 NFD(자소분리)로 저장돼 있어, 프롬프트에 입력한 NFC 한글 경로와 문자열이 달라 "Cannot find path"가 나고, ffmpeg에 직접 넘기면 "Illegal byte sequence"가 난다.

**우회**: PowerShell에서 `$_.Name.Normalize([Text.NormalizationForm]::FormC)`로 비교해 파일을 찾은 뒤, ASCII 이름으로 하드링크(`New-Item -ItemType HardLink`, 같은 볼륨이면 복사 비용 0)를 만들어 그 링크로 작업한다. [[zerotoone-tunnel-pipeline]]에서 사용.
