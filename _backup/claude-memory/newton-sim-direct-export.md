---
name: newton-sim-direct-export
description: 뉴턴 지면 UI 는 시뮬레이터를 그대로 투명 추출할 수 있다 — 재구성하지 말 것
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 72b091b5-046c-4c1a-be2a-0c1351d5f549
  modified: 2026-08-06T02:50:27.864Z
---

지면 UI 를 에펙에 넘길 때 **레일·토큰을 손으로 다시 만들지 말고 시뮬레이터를 그대로 뽑는다.**

```
node scripts/export_video.mjs --session --stage P1 --play --fp --alpha --norip --ss 1 \
  --dur 10.5 --fps 29.97 --w 3840 --url http://127.0.0.1:5200/ --out <폴더>
```

**Why:** 2026-08-06 에 반나절을 날렸다. 유저가 싫어한 건 "일렁이는 광"(마크 셰이더의
발모양 파형) **하나뿐**이었는데, 나는 그걸 못 찾고 레일을 대지 좌표로 재구성하고,
코너핀 좌표를 역산하고, 마스크 매트를 만들고, 3D 카메라를 짰다. 전부 필요 없었다.
`--norip` 플래그가 처음부터 있었다. 유저: *"진짜로 지금 시뮬레이터에있는거 그자체를
내보내는게 정말 어렵니.... 정말로? ㅠ"*

**How to apply:** 지면 UI 요청이 오면 **먼저 익스포터 플래그부터 다 읽는다.**
`--norip`(파형 끔) · `--pin`(마크를 설계 좌표에 고정) · `--layer`(레이어 분리) ·
`--alphafloor` · `--bg` 가 이미 있다. 재구성은 익스포터로 안 되는 게 확인된 뒤에만.

주의점 세 가지 — `--alpha` 는 `--beam` 을 함축한다(무대가 켜져 있으면 투명 매트가
안 나온다). `--play` 중에는 `--t0` 시크가 안 먹으므로 앞 3~5프레임이 빈다, 길게 뽑아
잘라낸다. 4K 는 `--ss 1` 이어야 한다(ss2 면 GPU 메모리를 넘겨 **에러 없이 전부 투명한
프레임**이 나온다). 4K 315프레임에 약 34분, 프레임당 6.5초.

렌더 뒤엔 `scripts/measure_flicker.mjs <PNG폴더>` 로 깜빡임을 전수 검사한다.

[[newton-export-server]] · [[newton-export-all-intra]] · [[newton-token-rail-parity]]
