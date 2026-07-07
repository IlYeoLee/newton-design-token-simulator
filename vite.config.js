import { defineConfig } from 'vite';

export default defineConfig({
  base: './',   // GitHub Pages 등 서브경로 배포 대응
  server: { host: '127.0.0.1', port: 5199 },
  assetsInclude: ['**/*.fbx'],
});
