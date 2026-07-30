# 두 기기 사이 자동 동기화 — 윈도우용. 맥은 scripts/sync.sh 를 쓴다.
#
#   powershell -ExecutionPolicy Bypass -File scripts\sync.ps1
#
# 전용 터미널 창 하나를 잡아두고 거기서 돌린다(vite 창과 별개). 15초마다
#   변경분 커밋 → git pull --rebase → git push
# 를 한 바퀴 돈다. 충돌이 나면 멈춘다 — 자동으로 풀지 않는다.

param(
  [int]$IntervalSec = 15,   # 한 바퀴 간격
  [int]$MaxFileMB   = 5     # 이보다 큰 새 파일은 커밋하지 않는다(내보낸 영상 방어)
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not (Test-Path (Join-Path $repo '.git'))) { Write-Host "저장소가 아닙니다: $repo" -ForegroundColor Red; exit 1 }

$tag = $env:COMPUTERNAME
# PowerShell이 --format='%h %s' 를 인자로 못 넘긴다(% 를 연산자로 읽는다). 변수로 우회.
$fmt = '%h %s'
Write-Host "동기화 시작 — $repo  ($tag, ${IntervalSec}초 간격)" -ForegroundColor Cyan
Write-Host "멈추려면 Ctrl+C." -ForegroundColor DarkGray

while ($true) {
  # ── 1. 큰 새 파일은 스테이지에서 빼둔다. 지운 뒤 다시 만들면 또 걸리므로 매번 본다.
  $skipped = @()
  foreach ($line in (git status --porcelain --untracked-files=all)) {
    if ($line -notmatch '^\?\?') { continue }
    $f = $line.Substring(3).Trim('"')
    $item = Get-Item -LiteralPath $f -ErrorAction SilentlyContinue
    if ($item -and -not $item.PSIsContainer -and $item.Length -gt ($MaxFileMB * 1MB)) { $skipped += $f }
  }

  # ── 2. 변경분이 있으면 커밋. 큰 파일은 add 대상에서 제외한다.
  if (git status --porcelain) {
    git add -A
    foreach ($f in $skipped) { git reset -q -- $f | Out-Null }
    if ($skipped.Count -gt 0) {
      Write-Host ("  건너뜀(${MaxFileMB}MB 초과): " + ($skipped -join ', ')) -ForegroundColor Yellow
    }
    if (git diff --cached --name-only) {
      $files = (git diff --cached --name-only) -join ', '
      if ($files.Length -gt 60) { $files = $files.Substring(0, 60) + '…' }
      git commit -q -m "sync($tag): $files"
      Write-Host ("  커밋 " + (git log -1 --format="$fmt")) -ForegroundColor Green
    }
  }

  # ── 3. 원격을 당긴다. 충돌이면 되돌리고 멈춘다 — 자동 병합은 사고를 키운다.
  git fetch -q origin
  $behind = git rev-list --count HEAD..origin/main
  if ($behind -ne '0') {
    git pull -q --rebase --autostash origin main
    if ($LASTEXITCODE -ne 0) {
      git rebase --abort 2>$null
      Write-Host ""
      Write-Host "충돌 — 자동 동기화를 멈춥니다." -ForegroundColor Red
      Write-Host "양쪽 기기에서 같은 파일을 고쳤습니다. 직접 정리한 뒤 이 창을 다시 띄우세요." -ForegroundColor Red
      git status --short
      exit 1
    }
    Write-Host ("  당김 " + $behind + "개 -> " + (git log -1 --format="$fmt")) -ForegroundColor Cyan
  }

  # ── 4. 밀어둘 게 있으면 민다.
  if ((git rev-list --count origin/main..HEAD) -ne '0') {
    git push -q origin main
    if ($LASTEXITCODE -eq 0) { Write-Host "  밀어냄" -ForegroundColor Green }
    else { Write-Host "  push 실패 — 다음 바퀴에 다시 시도합니다." -ForegroundColor Yellow }
  }

  Start-Sleep -Seconds $IntervalSec
}
