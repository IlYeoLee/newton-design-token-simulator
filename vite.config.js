import { defineConfig } from 'vite';
import { resolve } from 'path';

// 빌드 스탬프 — 화면 좌하단에 노출 (유저가 보는 번들이 어느 빌드인지 즉시 식별: 캐시 혼선 종결)
const BUILD_TAG = new Date().toISOString().slice(5, 16).replace('T', ' ');

export default defineConfig({
  base: './',   // GitHub Pages 등 서브경로 배포 대응
  server: { host: '127.0.0.1', port: 5199 },
  assetsInclude: ['**/*.fbx'],
  define: { __BUILD_TAG__: JSON.stringify(BUILD_TAG) },
  build: {
    rollupOptions: {
      // MPA: fxlab(룩 시스템)을 빌드에 편입 — 시뮬과 셰이더·SDF·규약 모듈을 공유하기 위한 전제
      // (public/ 단독 파일이던 시절엔 import 자체가 불가해 손복사 2벌 드리프트가 구조적으로 반복됐음)
      input: { main: resolve(__dirname, 'index.html'), fxlab: resolve(__dirname, 'fxlab.html') },
    },
  },
});
