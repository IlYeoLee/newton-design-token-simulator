import { defineConfig } from 'vite';

// 빌드 스탬프 — 화면 좌하단에 노출 (유저가 보는 번들이 어느 빌드인지 즉시 식별: 캐시 혼선 종결)
const BUILD_TAG = new Date().toISOString().slice(5, 16).replace('T', ' ');

export default defineConfig({
  base: './',   // GitHub Pages 등 서브경로 배포 대응
  server: { host: '127.0.0.1', port: 5199 },
  assetsInclude: ['**/*.fbx'],
  define: { __BUILD_TAG__: JSON.stringify(BUILD_TAG) },
});
