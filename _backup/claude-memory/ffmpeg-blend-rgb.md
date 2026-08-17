---
name: ffmpeg-blend-rgb
description: ffmpeg blend(곱하기·가산)는 반드시 RGB로 강제해야 한다 — YUV에서 돌면 색이 망가진다
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae626350-496c-43a4-9310-f203bdfdd7ea
  modified: 2026-08-05T06:44:22.793Z
---

ffmpeg 의 `blend=all_mode=multiply` / `addition` 은 입력이 YUV 면 **Y·U·V 채널을 그대로**
연산한다. 크로마까지 곱해지므로 결과가 초록이나 마젠타로 완전히 망가진다.

두 입력 모두 `format=gbrp` 로 바꾸고, 연산 뒤에 다시 원하는 픽셀 포맷으로 돌린다.

```
[0:v]format=gbrp[a];[1:v]scale=W:H,format=gbrp[b];[a][b]blend=all_mode=multiply,format=yuv422p10le
```

2026-08-05 에 두 번 당했다. 한 번은 벽 보정판을 ProRes 로 구울 때(전체가 초록),
한 번은 프로젝터 빔을 가산으로 미리보기할 때(전체가 마젠타).
PNG 입력이라 RGB 일 것 같아도, 출력 코덱이 YUV 면 필터그래프가 먼저 변환해 버린다.

관련: [[ae-color-tag]] · [[ae-script-rules]]
