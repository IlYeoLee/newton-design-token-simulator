---
name: ae-color-tag
description: AE 합성용 파일은 색공간 태그를 박거나 PNG 시퀀스로 준다 — 태그 없는 ProRes는 색이 어긋난다
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae626350-496c-43a4-9310-f203bdfdd7ea
  modified: 2026-08-05T06:44:38.424Z
---

ffmpeg 로 만든 ProRes 를 AE 에 넣으면 **파일 단위로 색을 정확히 맞춰도 화면에서 벌어진다.**
`color_space`·`color_transfer`·`color_primaries` 가 `unknown` 으로 남기 때문이다.
AE 는 색 관리가 켜져 있으면 이걸 임의로 해석해서 원본 푸티지와 다른 변환을 건다.

두 가지 중 하나로 해결한다.

```
① PNG 시퀀스로 준다        sRGB 고정 — 해석 여지가 아예 없다. 제일 확실하다.
② mov 에 태그를 박는다
   -vf "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
   -movflags +write_colr
```

`-color_primaries bt709` 같은 출력 옵션만으로는 ProRes 에 안 실린다 — `setparams` 필터와
`write_colr` 를 같이 써야 네 항목이 다 채워진다(2026-08-05 실측).

색이 안 맞는다고 할 때 플레이트를 의심하기 전에 **AE 레이어에 뭐가 얹혀 있는지 먼저 본다.**
실제로 원인이 불투명도 85 + 곡선 + 사진 필터였던 적이 있다.

관련: [[ffmpeg-blend-rgb]] · [[ae-script-rules]]
