#!/bin/sh
# 다른 기계에서 항상 최신으로 개발서버 돌리기: ./dev-sync.sh
# 30초마다 자동 git pull — Vite 가 변경을 감지해 브라우저에 즉시 반영한다.
( while true; do git pull --ff-only -q 2>/dev/null; sleep 30; done ) &
# --strictPort: 5199 가 이미 쓰이면 조용히 다른 포트로 새지 말고 즉시 죽어라.
# 없으면 다른 폴더의 서버가 127.0.0.1 을, 이쪽이 [::] 를 잡아 둘 다 뜨고
# 브라우저는 옛날 걸 본다 — 08-03 에 이걸로 작업분이 사라진 줄 알았다.
npm run dev -- --port 5199 --strictPort --host
