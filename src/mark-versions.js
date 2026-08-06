// 발자국 룩 **후보** 등록소 — footlab(정지 뷰)·stancelab(띠 프레임 모션)이 같은 표를 본다.
//   랩마다 표를 따로 두면 후보가 두 벌이 되고, 그게 이 리포가 반복해 밟은 함정이다.
// ── 버전 비교(유저 08-06) — 오늘 발자국 룩이 바뀐 지점을 버튼으로 오간다 ──────────────
//   왜: 커밋 로그로는 "어느 쪽이 예쁜가"를 못 고른다. 값을 나란히 **눌러 보는** 게 디자인 결정의
//   유일한 방법이고 그게 이 랩의 존재 이유다. 각 항목은 그 커밋이 **실제로 바꾼 값만** 담는다
//   (전체 룩 스냅샷이 아니다 — 스냅샷을 깔면 그 뒤의 다른 수정까지 되돌아간다).
export const VERSIONS = {
  // ★ 3일 전(유저 요청) — 다른 항목과 달리 **전체 스냅샷**이다. 그래서 라벨에 그렇게 적는다.
  //   근거: mark-look.json 은 08-03 에 커밋이 없다. 그날 화면에 떠 있던 값은 08-02 14:17
  //   `fa2e8d6 발자국 헤일로 완화 + 룩2 페이드 흙탕 밴드 제거` 가 마지막이다 — 그게 이 값이다.
  //   지금과 23개 키가 다르다. 큰 것만: 세기 0.98→0.7 · 도트 0.25→0.34 · 글로우 0.26→0
  //   · 섀도우 0.3→0 · 이너섀도우 0.34→1.4 · 파동 0.5→0(제거) · 헤일로 0.45→0.3 · 폭 1.6→0.95.
  //   ⚠ 되돌리면 그 뒤 사흘의 수정도 같이 사라진다(스냅샷의 대가). 눌러서 **보는** 용도다.
  v03: { label: '08-02 14:17 (3일 전) — 전체 스냅샷 · 파동 있고 헤일로 넓고 이너섀도우 얕던 때',
         // ★ **그날 파일의 전 키**를 그대로 적는다(델타가 아니다). 처음엔 '지금과 다른 값'만
         //   담았는데, 그때 우연히 같았던 키(edge·bandSoft)가 빠져서 적용하면 랩 기본값이 대신
         //   구워졌다 — 실측으로 43개 중 2개가 어긋났다. 스냅샷은 전 키가 아니면 스냅샷이 아니다.
         P: { imp: 0.98, scale: 0.83, offx: -0.043, offy: -0.031, irot: 5.5, pitch: 0.027,
              dot: 0.25, glow: 0.26, shade: 0.3, sharp: 0.74, edge: 0.038, w: 1.6, halo: 0.45,
              pool: 0.82, noise: 0, prog: 0.55, tilt: -2, bloom: 0.125, blur: 0, gsize: 0.8,
              gsh: 0.6, gx: -0.085, gy: 0.16, grot: 4, rip: 0.5, ripReach: 0.5,
              ripWidth: 0.125, ripSpeed: 0.4, ripGrad: 1, plantar: 0.84, bands: 24,
              bandSoft: 1, edgeShade: 0.34, shadeRed: 0, shadeRedW: 3.4, edgeW: 0.01,
              edgeSoft: 0, dither: 0.011,
              // 08-02 엔 없던 키 — 그땐 이 축 자체가 없었다. 이너섀도우 폭만 당시 셰이더 기본(1)로.
              edgeShadeW: 1, edgeShadeGrad: 0, edgeShadeG0: 1, edgeShadeG1: 0.55,
              dotMode: 0 },   // dotMode 0 = 도트 그라디언트 실험 이전
         // ★ 색·합성은 **P 밖 독립 변수**다(shadeCol·dotCol·edgeShadeCol·gBlend…).
         //   P 에 넣어 두면 조용히 무시된다 — 처음 판이 정확히 그래서 반쪽이었다.
         vars: { shadeCol: 1, dotCol: 1, edgeShadeCol: 0, gBlend: 'add' },
         states: null },
  v0: { label: '09:25 — 단색 순백 도트 · 이너 섀도우 1.4/4 (유저가 더 좋다고 한 저장본)',
        P: { edgeShade: 1.4, edgeShadeW: 4, dotMode: 0 }, states: null },
  v1: { label: '13:31 — 각인 도트를 압력 온도 그라디언트로(주황→연주황). 각인이 필에 녹는다',
        P: { edgeShade: 1.4, edgeShadeW: 4, dotMode: 1 }, states: null },
  v2: { label: '13:40 — v1 + 실루엣 이너 섀도우 완화(1.4→0.95, 폭 4→5)',
        P: { edgeShade: 0.95, edgeShadeW: 5, dotMode: 1 }, states: null },
  v3: { label: '14:28 — v2 + 상태별 온도 창·명도(색으로 상태 구분) + 도트를 그 창 안으로',
        P: { edgeShade: 0.95, edgeShadeW: 5, dotMode: 2 },
        states: { '0': { tLo: 0.52, tHi: 0.76, op: 0.42, bloom: 0.03 },
                  '1': { tLo: 0.12, tHi: 0.84, op: 0.88, bloom: 0.10 },
                  '2': { tLo: 0.06, tHi: 0.90, op: 1.00, bloom: 0.22 },
                  '4': { tLo: 0.02, tHi: 0.30, op: 1.00, bloom: 0.36 } } },
};
