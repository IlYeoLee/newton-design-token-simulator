#!/bin/sh
# 두 기기 사이 자동 동기화 — 맥용. 윈도우는 scripts/sync.ps1 을 쓴다.
#
#   sh scripts/sync.sh
#
# 전용 터미널 탭 하나를 잡아두고 거기서 돌린다(vite 탭과 별개). 15초마다
#   변경분 커밋 → git pull --rebase → git push
# 를 한 바퀴 돈다. 충돌이 나면 멈춘다 — 자동으로 풀지 않는다.

INTERVAL=${INTERVAL:-15}      # 한 바퀴 간격(초)
MAX_MB=${MAX_MB:-5}           # 이보다 큰 새 파일은 커밋하지 않는다(내보낸 영상 방어)

cd "$(dirname "$0")/.." || exit 1
[ -d .git ] || { echo "저장소가 아닙니다: $(pwd)"; exit 1; }

TAG=$(hostname -s)
MAX_BYTES=$((MAX_MB * 1024 * 1024))
echo "동기화 시작 — $(pwd)  ($TAG, ${INTERVAL}초 간격)"
echo "멈추려면 Ctrl+C."

while true; do
  # ── 1. 큰 새 파일은 스테이지에서 빼둔다.
  SKIPPED=""
  git status --porcelain --untracked-files=all | grep '^??' | cut -c4- | while read -r f; do
    [ -f "$f" ] || continue
    size=$(wc -c < "$f" | tr -d ' ')
    [ "$size" -gt "$MAX_BYTES" ] && echo "$f"
  done > /tmp/.sync-skip-$$
  SKIPPED=$(cat /tmp/.sync-skip-$$)

  # ── 2. 변경분이 있으면 커밋. 큰 파일은 add 대상에서 제외한다.
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    if [ -n "$SKIPPED" ]; then
      echo "$SKIPPED" | while read -r f; do [ -n "$f" ] && git reset -q -- "$f"; done
      echo "  건너뜀(${MAX_MB}MB 초과): $(echo "$SKIPPED" | tr '\n' ' ')"
    fi
    if [ -n "$(git diff --cached --name-only)" ]; then
      FILES=$(git diff --cached --name-only | tr '\n' ',' | sed 's/,$//' | cut -c1-60)
      git commit -q -m "sync($TAG): $FILES"
      echo "  커밋 $(git log -1 --format='%h %s')"
    fi
  fi
  rm -f /tmp/.sync-skip-$$

  # ── 3. 원격을 당긴다. 충돌이면 되돌리고 멈춘다 — 자동 병합은 사고를 키운다.
  git fetch -q origin
  BEHIND=$(git rev-list --count HEAD..origin/main)
  if [ "$BEHIND" != "0" ]; then
    if ! git pull -q --rebase --autostash origin main; then
      git rebase --abort 2>/dev/null
      echo ""
      echo "충돌 — 자동 동기화를 멈춥니다."
      echo "양쪽 기기에서 같은 파일을 고쳤습니다. 직접 정리한 뒤 이 창을 다시 띄우세요."
      git status --short
      exit 1
    fi
    echo "  당김 ${BEHIND}개 -> $(git log -1 --format='%h %s')"
  fi

  # ── 4. 밀어둘 게 있으면 민다.
  if [ "$(git rev-list --count origin/main..HEAD)" != "0" ]; then
    if git push -q origin main; then echo "  밀어냄"; else echo "  push 실패 — 다음 바퀴에 다시 시도합니다."; fi
  fi

  sleep "$INTERVAL"
done
