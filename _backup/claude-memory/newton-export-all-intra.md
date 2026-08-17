---
name: newton-export-all-intra
description: 뉴턴 시뮬레이터 영상 추출 — 프레임 단위로 시크하는 모든 소스 영상은 반드시 올-인트라여야 한다. 아니면 인물이 조용히 사라진다.
metadata: 
  node_type: memory
  type: project
  originSessionId: ae626350-496c-43a4-9310-f203bdfdd7ea
  modified: 2026-08-03T19:10:20.573Z
---

`newton-design-token-simulator` 의 `scripts/export_video.mjs` 는 프레임마다
`video.currentTime` 을 직접 찍어 시크한다. 따라서 **그 익스포터가 건드리는 모든 영상**
(코치 클립 `public/ghost/*.mp4`, 실사 배경 `public/_bg/*.mp4`)은 **올-인트라**여야 한다.

```bash
ffmpeg -i 원본.mp4 -c:v libx264 -crf 16 -g 1 -pix_fmt yuv420p -movflags +faststart -an 출력.mp4
# 확인: 키프레임 수 == 전체 프레임 수
ffprobe -v error -select_streams v:0 -show_entries frame=key_frame -of csv=p=0 파일.mp4 | grep -c '^1'
```

**안 지키면 생기는 일** (2026-08-04, 8시간 소모): 키프레임이 1개뿐이면 시크할 때마다
디코더가 맨 앞부터 그 지점까지 전부 다시 디코드한다. 클립 중반이 가장 비싸고, 그 비용이
익스포터의 3초 안전장치를 넘기면 디코드 전 상태로 스크린샷이 찍힌다 = **그 프레임에
인물이 없다**. 실측 240프레임 중 132장(55%) 실종, 렌더 시간도 2배.

**진단 서명 — 이 조합이면 무조건 이것이다**
- `buffered` 가 클립 전체를 덮고 `networkState` IDLE, `error` null 인데 `readyState` 만 1
  → 데이터가 없어서가 아니라 **디코드가 안 끝난 것**
- 느린 프레임 구간과 인물 실종 구간이 정확히 일치
- 앱 카운터(지오메트리·텍스처·프로그램·씬오브젝트·JS힙)는 전부 평평 = 누수 아님
- 스크린샷을 빼도 동일 = PNG 파이프라인 아님
- 옛 커밋을 워크트리로 꺼내 돌려도 동일 = 코드 회귀 아님

**헛다리 짚지 말 것**: 이 증상은 "어제는 됐는데 오늘 안 된다"로 나타나서 코드 회귀처럼
보인다. 아니다. 어제는 프레임당 1.77초라 3초 안에 들어왔고 오늘은 4.8초라 못 들어온 것뿐,
버그는 처음부터 있었다. 속도가 임계를 넘는 순간 드러난다.

`scripts/measure_flicker.mjs` 는 이 실패를 **못 잡는다** — 알파 변화량을 보는데 복싱은
배경을 구워 알파가 전부 255다. 알파 산출물(지면) 전용이다. 배경 포함 산출물은 색상으로 재야 한다.

익스포터가 이제 `⚠ 비디오 시크 실패 N건` 을 출력한다(커밋 4620da9). 0 이 아니면 의심할 것.
관련: [[newton-export-server]]
