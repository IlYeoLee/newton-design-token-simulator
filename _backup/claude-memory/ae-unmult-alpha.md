---
name: ae-unmult-alpha
description: 유저는 에펙에서 Unmult 를 쓴다 — 알파 포함 추출을 말리지 말 것. 다만 --alpha 는 --beam 을 함축해 룩이 바뀐다
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5650e7ba-d392-434c-89f5-20e404b2a87c
  modified: 2026-08-06T17:28:00.541Z
---

뉴턴 영상 추출에서 **알파를 넣어 뽑는 걸 말리지 않는다.** 유저는 에펙에서 **Unmult**
플러그인을 쓴다 — 검은 배경이 딸려 와도 휘도에서 매트를 뽑아 주므로, 알파가 있든
없든 합성이 성립한다(유저 2026-08-07: "UNMULT 플러그인 쓰면 알파 포함해도 된다고,
내가 그거 쓸 거거든").

**Why:** "검정영상으로 뽑겠다"는 말에 `--alpha` 를 빼라고 권했는데, 유저의 합성
파이프라인에선 그 구분이 의미가 없다. 출력 형식을 내가 좁힐 일이 아니다.

**How to apply:** 기본은 **알파 포함**으로 안내한다.
```bash
node scripts/export_video.mjs --url http://127.0.0.1:5200/ \
  --scene READY --play --alpha --w 2560 --fps 30 --dur 8 --uiscale 1 --out out/...
```

**단, 이건 계속 말해야 한다** — `--alpha` 는 채널만 붙이는 스위치가 아니다
(`scripts/export_video.mjs`):
- `--beam` 을 **함축**한다(93행) → 빔 패스가 켜져 **그림 자체가 달라진다**
- 알파를 **휘도에서** 뽑는다(`FX.alphaOut`, 441행)
- 코덱이 `prores_ks 4444 / yuva444p10le` 로 간다(905행)

즉 알파 유무는 컨테이너 차이가 아니라 **룩 차이**다. 같은 룩으로 알파만 원하면
`--beam` 이 켜진 걸 감안하고 봐야 한다.

관련: [[newton-mask-is-alpha]] · [[ae-color-tag]] · [[newton-export-server]]
