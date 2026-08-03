import { defineConfig } from 'vite';
import { resolve } from 'path';
import { writeFileSync, readFileSync } from 'fs';

// 빌드 스탬프 — 화면 좌하단에 노출 (유저가 보는 번들이 어느 빌드인지 즉시 식별: 캐시 혼선 종결)
const BUILD_TAG = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' KST';   // 로컬(한국) 시각 — UTC 태그가 '왜 아직 오전이냐' 혼란을 만들었음

export default defineConfig({
  base: './',   // GitHub Pages 등 서브경로 배포 대응
  // ★ 산출·임시 폴더는 감시하지 않는다. 아래 always-full-reload 는 '어떤 파일이든' 바뀌면
  //   페이지를 새로고침하는데, 영상 내보내기는 out/ 에 PNG 를 수백 장 쓴다. 그러면 렌더 도중
  //   페이지가 리로드돼 window.__dbg 가 사라지고, 그 뒤 프레임이 전부 텅 빈 채로 저장된다
  //   (실측: 종목을 연달아 뽑으면 첫 종목만 성공하고 나머지가 480장 전부 빈 프레임).
  //   증상이 조용해서 오래 갔다 — 컨텍스트 손실도, WebGL 에러도, 페이지 에러도 안 뜬다.
  server: {
    host: '127.0.0.1', port: 5199,
    watch: { ignored: ['**/out/**', '**/tmp_*', '**/tmp_*/**', '**/node_modules/**'] },
    // ★ 데브에선 아무것도 캐시하지 않는다. public/ 정적 파일(영상·PNG·SVG)은 HMR 대상이
    //   아니라서, 같은 파일명으로 에셋을 갈면 브라우저가 옛것을 계속 썼다. 매번 Ctrl+Shift+R
    //   해야 했던 이유다(유저). 데브 서버에만 걸리고 빌드 산출물에는 영향이 없다.
    headers: { 'Cache-Control': 'no-store' },
  },
  plugins: [{
    // Three.js 씬은 HMR 부분 교체를 못 견딘다 — 모듈만 갈리면 씬·렌더러가 반쯤 죽어
    // 화면이 검게 변하고 판이 붉게 남는다(유저: 커밋할 때마다). 저장 시 항상 전체 새로고침.
    name: 'always-full-reload',
    handleHotUpdate({ server }) { server.ws.send({ type: 'full-reload' }); return []; },
  }, {
    // 데브 전용: 발자국 랩(footlab)이 잡은 MARK 룩을 **리포에** 저장한다.
    //   예전엔 랩이 localStorage 에만 저장해서, 다른 기기에서 열면 수정 전 값이 나오고
    //   시뮬로 옮길 때도 코드 기본값만 갔다(유저가 다른 노트북에서 발견). 값의 집이 필요하다.
    name: 'dev-save-mark-look',
    configureServer(server) {
      server.middlewares.use('/__save-look', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only'); }
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          try {
            const obj = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!obj || typeof obj !== 'object') throw new Error('bad body');
            // ★ 통째 교체가 아니라 **병합**이다 — 부분 저장(또는 실수로 보낸 일부 키)이
            //   나머지 값을 통째로 날리면 안 된다. 실제로 테스트 POST 하나로 정본이 날아갔다.
            const p = resolve(__dirname, 'src/mark-look.json');
            let cur = {};
            try { cur = JSON.parse(readFileSync(p, 'utf8')); } catch { /* 첫 저장 */ }
            const next = { ...cur, ...obj };
            next._ = "MARK(발형·존원) 룩 정본. footlab.html '코드에 저장'이 이 파일을 덮어쓴다.";
            writeFileSync(p, JSON.stringify(next, null, 2) + '\n');
            res.end('saved');
          } catch (e) { res.statusCode = 400; res.end('bad json: ' + e.message); }
        });
      });
    },
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
      // ★ 여기 없는 HTML 은 **배포본에 아예 안 들어간다**. 데브 서버는 파일을 그냥 서빙해서
      //   로컬에선 멀쩡히 보이는데 배포하면 404 — 랩을 새로 만들 때마다 반복될 함정이다
      //   (유저: "하드 새로고침해도 웹에 안 뜬다"). 랩을 추가하면 이 줄도 같이 고칠 것.
      input: {
        main:     resolve(__dirname, 'index.html'),
        fxlab:    resolve(__dirname, 'fxlab.html'),
        footlab:  resolve(__dirname, 'footlab.html'),
        parity:   resolve(__dirname, 'parity.html'),
        personlab:     resolve(__dirname, 'personlab.html'),
        personlabLive: resolve(__dirname, 'personlab-live.html'),
        scenes:        resolve(__dirname, 'scenes.html'),
      },
    },
  },
});
