import { defineConfig } from 'vite';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

// 빌드 스탬프 — 화면 좌하단에 노출 (유저가 보는 번들이 어느 빌드인지 즉시 식별: 캐시 혼선 종결)
const BUILD_TAG = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' KST';   // 로컬(한국) 시각 — UTC 태그가 '왜 아직 오전이냐' 혼란을 만들었음

export default defineConfig({
  base: './',   // GitHub Pages 등 서브경로 배포 대응
  server: { host: '127.0.0.1', port: 5199 },
  plugins: [{
    // Three.js 씬은 HMR 부분 교체를 못 견딘다 — 모듈만 갈리면 씬·렌더러가 반쯤 죽어
    // 화면이 검게 변하고 판이 붉게 남는다(유저: 커밋할 때마다). 저장 시 항상 전체 새로고침.
    name: 'always-full-reload',
    handleHotUpdate({ server }) { server.ws.send({ type: 'full-reload' }); return []; },
  }, {
    // 데브 전용: 브라우저에서 구운 에셋(마스크 아틀라스 등) 저장 — 베이크 파이프라인 출구
    name: 'dev-save-baked-asset',
    configureServer(server) {
      server.middlewares.use('/__save-baked', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only'); }
        const name = (new URL(req.url, 'http://x').searchParams.get('name') || '').replace(/[^a-z0-9_.-]/gi, '');
        if (!name || !name.endsWith('.png')) { res.statusCode = 400; return res.end('bad name'); }
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          writeFileSync(resolve(__dirname, 'public/person/' + name), Buffer.concat(chunks));
          res.end('saved ' + name);
        });
      });
    },
  }],
  assetsInclude: ['**/*.fbx'],
  define: { __BUILD_TAG__: JSON.stringify(BUILD_TAG) },
  build: {
    chunkSizeWarningLimit: 1200,   // three.js 한 덩어리는 원래 크다 — 경고 기준만 현실화
    rollupOptions: {
      // manualChunks 벤더 분리는 되돌림 — 배포본에서 청크 초기화 순서가 꼬여
      //   'Cannot access b before initialization'(TDZ)이 실제로 발생했다(라이브 검수).
      // MPA: fxlab(룩 시스템)을 빌드에 편입 — 시뮬과 셰이더·SDF·규약 모듈을 공유하기 위한 전제
      // (public/ 단독 파일이던 시절엔 import 자체가 불가해 손복사 2벌 드리프트가 구조적으로 반복됐음)
      input: { main: resolve(__dirname, 'index.html'), fxlab: resolve(__dirname, 'fxlab.html'), footlab: resolve(__dirname, 'footlab.html'), parity: resolve(__dirname, 'parity.html') },
    },
  },
});
