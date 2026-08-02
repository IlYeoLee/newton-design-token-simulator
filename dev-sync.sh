#!/bin/sh
# 다른 기계에서 항상 최신으로 개발서버 돌리기: ./dev-sync.sh
# 30초마다 자동 git pull — Vite 가 변경을 감지해 브라우저에 즉시 반영한다.
( while true; do git pull --ff-only -q 2>/dev/null; sleep 30; done ) &
npm run dev -- --port 5199 --host
