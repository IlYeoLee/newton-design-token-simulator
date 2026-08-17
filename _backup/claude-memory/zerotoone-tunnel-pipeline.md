---
name: zerotoone-tunnel-pipeline
description: 제로투원 터널+GUI 스와이프 영상 — originkit 원본 이식 파이프라인과 산출물 위치
metadata: 
  node_type: memory
  type: project
  originSessionId: e49de6d5-95e7-4ae8-84f8-ff7ba8f600b5
  modified: 2026-08-10T20:32:29.021Z
---

제로투원 컨셉영상용 "갤러리 터널 → 시뮬레이터 GUI 3장 스와이프" 8초 클립 (2026-08-11 제작).

- 산출물: `C:\Users\user\Desktop\제로투원_터널구현\` — PNG시퀀스 240장(30fps) + 터널GUI_1920x1080_30fps.mp4
- originkit gallery-tunnel은 three.js WebGL 컴포넌트. 원본 소스는 페이지 403이지만 헤드리스 브라우저로 네트워크 스니핑하면 supabase의 `component-modules/gallery-tunnel/*.mjs`가 그대로 잡힌다 (정식 API는 키 필요·일 10회 제한).
- 이식 핵심 상수(preset base): grid 4×4 stretched, 터널 2×1.8×깊이1, 링 15개, 슬랩 확률 0.5, 라인 #B0B0B0 50%, fog near0 far14.25, speed He+=1/frame@60fps → z=-0.05He, 카메라 lerp 0.1, 클릭 부스트 ×10 (= "빨려들어감" 가속으로 사용, 1.2s부터).
- **유저 결정: 원본의 컬러 슬랩(6색)은 구리다고 전부 제거** — 슬랩은 디자인시스템 이미지로만. 원본의 정사각 크롭도 셀 비율(바닥 0.5:1, 벽 1:0.45) 기준 센터 크롭으로 교체(왜곡 방지, 바닥/벽 텍스처 세트 분리).
- 이후 세련화 요청으로 추가된 것: 지수 가속 커브(1.2→4.7s, ×14), 모션 트레일(잔상 — scene.background 제거 + preserveDrawingBuffer:true 필수), 컷 직전 줌 휩, 짧은 플래시, 격자 라인 얇게(0.0016)+흐르는 그라디언트 밴드+투명도 0.38+버텍스컬러로 중심부 페이드, 비네팅 강, GUI 캐러셀 양옆 카드 어둡고 흐리게(124px 피크), 텍스처 밉맵+이방성 16x.
- 최종 9.5초(285f@30): 타이틀 0-3s → 터널 가속 → 컷 f146 → GUI 러닝 f145/농구 f195/복싱 f240 스와이프.
- **타이틀: "supreme"은 수프림 브랜드가 아니라 Fontshare의 Supreme 서체를 뜻함** (한 번 뱃지로 잘못 만들어 혼남). "Newton Simulator"(대소문자 혼용), Supreme-Bold 700(woff2, fontshare에서 다운, scratchpad\fonts), 흰 단색 96px 자간 -5%, 트래킹-인 + 석-아웃 모션.
- **최종 룩: 레퍼런스(포트폴리오 터널 사이트) 미감** — 이미지가 셀을 꽉 채우면 촌스러움. 슬랩을 셀보다 작은 세로 카드(바닥 0.26×0.46, 벽 0.22×0.40)로, 확률 0.3, 크기 지터 0.8~1.15, 라인 투명도 0.25. 여백이 미감의 핵심.
- 파이프라인: tunnel.html(three.js 이식 + GUI 스와이프 DOM, renderFrame(n) 결정론) + capture.js(puppeteer-core + 시스템 Edge + 내장 http 서버 — file://는 모듈 import 막힘) → PNG → ffmpeg. 스크립트는 세션 scratchpad에 있으므로 재작업 시 이 구조로 재구성.
- GUI 순서: 러닝 → 농구 → 복싱 (스와이프 f150, f195 @30fps). 소재: Downloads의 러닝/농구/복싱유아이.mov(2188×1320 60fps), Documents\시뮬레이터영상\1-20.png.
