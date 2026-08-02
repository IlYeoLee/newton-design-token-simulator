# 3초 테스트 3종 — 4K · 투명배경 · 에펙용 ProRes 4444 한 파일씩
#   스테이지는 '인물 + 투사 UI + 판정토큰'이 실제로 같이 나오는 곳으로 골랐다(실측):
#     러닝 A3(하이니)    — 시범 인물 → 발자국 토큰으로 넘어간다
#     농구 BK_B3(스텝백) — 코치 인물 + 골대 마크 + 콘 + DRILL 브레드크럼
#     복싱 BX_B3(잽 스윕) — 벽 인물 + 타겟 링 + 스윕 토큰
#   --alphafloor 는 대지 패널의 옅은 배경 워시를 잘라 낸다. 이게 없으면 프레임 전체가
#   알파 12/255 로 남아 에펙에서 어두운 사각형으로 보인다(실측: 농구 불투명 97.5%).
$ErrorActionPreference = 'Continue'
Set-Location C:\Users\user\dev\newton-design-token-simulator
# ★ 경로에 한글을 쓰지 말 것 — PowerShell 이 .ps1 을 ANSI 로 읽어 'AE_4K_투명' 이
#   'AE_4K_?щ챸' 로 깨졌고 세 종목 전부 mkdir ENOENT 로 죽었다(실측).
$OUT = 'out/AE_4K'
# --pad 1.15  : 대지 밖으로 퍼지는 파동이 프레임 가장자리에서 잘리지 않게 사방 여백
# --alphafloor: 대지 패널의 옅은 배경 워시를 잘라 낸다(없으면 프레임 전체가 알파 12/255)
# --alphagamma: 그 위에서 어두운 톤의 알파를 들어 올린다(머리카락 회색이 지워지던 것)
# --ss 1      : 08-02 인물 룩(personAura 5중 합성)이 RT 를 더 써서 ss2 가 VRAM 에 안 들어간다
$runs = @(
  @{ sport='running';    stage='A3';    w=2302; t0=0.6; af=0.12 },
  @{ sport='basketball'; stage='BK_B3'; w=2302; t0=1.0; af=0.12 },
  @{ sport='boxing';     stage='BX_B3'; w=3840; t0=1.0; af=0.12 }
)
foreach ($r in $runs) {
  Write-Output "################ $($r.sport) / $($r.stage) ################"
  node scripts/export_video.mjs --sport $r.sport --session --stage $r.stage --play `
    --flat --alpha --alphafloor $r.af --alphagamma 0.5 --pad 1.15 `
    --t0 $r.t0 --dur 3 --fps 60 --w $r.w --ss 1 --out $OUT
  Write-Output "################ done: $($r.sport) ################"
}
