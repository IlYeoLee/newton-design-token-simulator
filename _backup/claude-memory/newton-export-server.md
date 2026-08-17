---
name: newton-export-server
description: 뉴턴 영상 추출은 전용 설정으로 띄운 서버에 붙인다 — 포트 번호는 보장이 아니다. 붙기 전에 리로드 여부를 실측할 것
metadata:
  node_type: memory
  type: project
  originSessionId: ae626350-496c-43a4-9310-f203bdfdd7ea
  modified: 2026-08-06T17:54:52.833Z
---

`newton-design-token-simulator` 의 `vite.config.js` 에는 `always-full-reload` 플러그인이 있다
(Three.js 씬이 HMR 부분 교체를 못 견뎌서 넣은 것). **어떤 파일이든** 바뀌면 페이지를 통째로
새로고침한다. 영상 추출은 프레임당 수 초씩 수십 분을 도니, 그 사이 소스를 한 번만 저장해도
`window.__dbg` 가 사라지고 렌더가 통째로 죽는다.

```
Error: Execution context was destroyed, most likely because of a navigation.
```

**해법 — 전용 서버(5200)로 돌린다** (커밋 4bebc10 · `vite.export.config.js`):
```bash
npm run dev:export     # 5200 · always-full-reload 제거 · hmr:false · watch 는 켜 둠
node scripts/export_video.mjs --url http://127.0.0.1:5200/ ...
```

★ **`--url` 을 반드시 준다.** 기본값이 `http://127.0.0.1:5199/`(개발 서버)라, 안 주면
전용 서버를 띄워 놓고도 리로드 도는 쪽으로 물린다. 2026-08-07 에 이걸로 렌더 하나 죽였다.

★★ **포트 번호는 아무것도 보장하지 않는다. 보장하는 건 설정이다.**
2026-08-07 에 5200 에 붙여 렌더 셋을 연달아 죽였다. 원인: 누군가 `npm run dev` 를 하나 더
띄웠는데 5199 가 잡혀 있어 **vite 가 자동으로 5200 으로 밀려 들어가 있었다**. 즉 5200 에
떠 있던 건 익스포트 서버가 아니라 `always-full-reload` 가 살아 있는 **개발 서버**였다.
붙기 전에 **실측**한다 — 두 방법 다 30초면 된다:
```bash
# ① 그 포트를 무엇이 물고 있나 (설정 인자가 보이는지)
powershell "Get-NetTCPConnection -LocalPort 5200 -State Listen | %{ (Get-CimInstance Win32_Process -Filter \"ProcessId=$($_.OwningProcess)\").CommandLine }"
#   → '--config vite.export.config.js' 가 없으면 그건 개발 서버다
# ② 실제로 리로드하는지 (puppeteer framenavigated 를 세면서 소스 한 번 저장)
```
포트가 점유돼 있으면 **남의 프로세스를 죽이지 말고** 다른 포트로 띄운다:
```bash
npx vite --config vite.export.config.js --port 5300 --strictPort --host 127.0.0.1
node scripts/export_ui.mjs --url http://127.0.0.1:5300/ ...
```

**5200 으로 돌면 렌더 중에도 리포를 계속 편집해도 된다**(유저 확인 2026-08-07). 그게 이
서버의 존재 이유다 — 설정 파일 주석 그대로: *"편집과 렌더를 동시에 해도 서로 안 밟는다."*
`hmr:false` + 플러그인 제거라 페이지에 리로드를 **알릴 통로가 없다**. 워처는 켜 둔다
(캐시 무효화용) — 껐더니 서버 띄운 시점 코드로 얼어붙어 구버전이 뽑혔다.
워크트리와 달리 같은 폴더를 보므로 고친 UI 가 **다음 렌더부터 바로** 반영된다.

**예외 하나 — vite 설정 파일**(`vite.config.js` · `vite.export.config.js`)은 렌더 중에
건드리면 안 된다. vite 는 **설정 파일이 바뀌면 서버를 재시작**한다(2026-08-04 실측).

관련: [[newton-export-all-intra]] · [[ae-unmult-alpha]]
