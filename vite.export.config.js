// 내보내기 전용 데브 서버 — 렌더 도중 페이지가 새로고침되지 않는 서버.
//
//   문제: vite.config.js 의 always-full-reload 플러그인은 **어떤 파일이든** 바뀌면 페이지를
//   통째로 새로고침한다. Three.js 씬이 HMR 부분 교체를 못 견뎌서 넣은 것이고 개발할 땐 맞다.
//   그런데 내보내기는 프레임당 수백 ms 씩 수 분을 돈다 — 그 사이 누가(사람이든 다른 세션이든)
//   소스를 한 번만 저장해도 window.__dbg 가 사라지고 렌더가 통째로 죽는다.
//   실측(08-04): 복싱 --scene BX_C3 익스포트가 warm() 단계에서 사망.
//     'Execution context was destroyed, most likely because of a navigation.'
//     같은 시각 src/session.js 가 수정 중이었고, 부팅 20초 동안 페이지가 4번 리로드됐다.
//
//   해법: 같은 파일을 보되 **리로드만 안 하는** 서버를 따로 띄운다.
//     · always-full-reload 플러그인 제거 · HMR 끔 · 감시 전부 무시
//     저장 미들웨어(__presets 등)는 그대로 살려 둔다 — 익스포터가 씬 저장본을 읽어야 한다.
//
//   워크트리와의 차이: 워크트리는 **다른 체크아웃**이라 커밋해서 옮기기 전엔 UI 수정이 안 보인다.
//   이 서버는 같은 폴더를 본다 — 고친 UI 가 **다음 렌더부터 바로** 반영되고, 렌더 도중에만
//   안 흔들린다. 편집과 렌더를 동시에 해도 서로 안 밟는다.
//
//   쓰는 법:
//     npm run dev:export                                   # 5200 포트, 렌더용
//     node scripts/export_video.mjs --url http://127.0.0.1:5200/ --scene BX_C3 ...
//   개발용 5199 는 평소대로 같이 띄워 두면 된다(둘은 독립).

import base from './vite.config.js';

export default {
  ...base,
  plugins: (base.plugins || []).filter(p => p.name !== 'always-full-reload'),
  server: {
    ...base.server,
    port: 5200,
    strictPort: true,        // 5201 로 슬쩍 옮겨가면 --url 이 딴 서버를 가리킨다
    hmr: false,              // HMR 채널 자체를 끈다 — full-reload 를 보낼 통로가 없어진다
    watch: { ignored: ['**'] },   // 파일 감시 없음. 변경은 '다음 요청'에 트랜스폼되어 반영된다
  },
};
