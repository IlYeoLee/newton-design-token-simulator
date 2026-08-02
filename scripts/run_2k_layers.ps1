# 2K 레이어 추출 — 3종목 × 3레이어
#
#   해상도는 **대지 원본**이다(러닝·농구 1600×2670 · 복싱 2600×1600).
#   4K 로 올리면 대지를 확대하는 꼴이라 선예도는 안 오르고 GPU 메모리만 넘긴다.
#   여기에 --pad 1.15 여백이 붙어 출력은 1840×3070 / 2990×1840.
#
#   레이어 셋을 에펙에서 겹친다:
#     L-person — 인물. 씬 실제 알파(실루엣 마스크) → 검정·머리카락 회색까지 살아 있다. Normal.
#     L-tokens — 판정토큰. 가산광이라 커버리지 알파가 없다 → 휘도 알파. Screen.
#     L-ui     — 투사 UI 글자. 휘도 알파. Screen.
#
#   러닝만 2.4초다 — A3 는 t≈3.0 에서 시범이 끝나 코치 판이 꺼진다(앱 정상 동작).
$ErrorActionPreference = 'Continue'
Set-Location C:\Users\user\dev\newton-design-token-simulator
$OUT = 'out/2K_layers'
$runs = @(
  @{ sport='running';    stage='A3';    w=1600; t0=0.4; dur=2.4 },
  @{ sport='basketball'; stage='BK_B3'; w=1600; t0=1.0; dur=3.0 },
  @{ sport='boxing';     stage='BX_B3'; w=2600; t0=1.0; dur=3.0 }
)
foreach ($r in $runs) {
  foreach ($layer in @('person', 'tokens', 'ui')) {
    Write-Output "######## $($r.sport) / $($r.stage) / $layer ########"
    node scripts/export_video.mjs --sport $r.sport --session --stage $r.stage --play `
      --flat --alpha --alphafloor 0.12 --alphagamma 0.5 --pad 1.15 --layer $layer `
      --t0 $r.t0 --dur $r.dur --fps 60 --w $r.w --ss 1 --out $OUT
  }
}
Write-Output "######## ALL DONE ########"
