// 인물(코치 판)이 **실제로 보이는 스테이지**를 실측한다 — 코드 목록(COACH_IDS)이 아니라 화면 기준.
//   각 스테이지에서 관찰 구간·따라하기 구간 두 시점을 돌려 보고, 코치 판 메시의
//   visible / 화면 점유 bbox(대지 좌표계 아님, 뷰포트 px)를 잰다.
//   판정: 코치 재질은 uField 유니폼을 가진 유일한 메시다(main.js ensureCoach).
//
//   node scripts/_probe_coach.mjs            # 러닝+농구 전 스테이지
import puppeteer from 'puppeteer';

const IDS = ['A1', 'A2', 'A3', 'BK_A1', 'BK_A2', 'BK_A3', 'BK_B1', 'BK_B2', 'BK_B3', 'BK_B4', 'BK_B5', 'BK_C2'];
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 140)));
await p.setViewport({ width: 1280, height: 800 });
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction('window.__dbg && window.__dbg.session', { timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

const rows = [];
for (const id of IDS) {
  for (const phase of ['관찰', '따라하기']) {
    const r = await p.evaluate(async (id, phase) => {
      const D = window.__dbg, S = D.session;
      // ★ 스테이지 진입은 **익스포터와 같은 관용구**(export_video.mjs:415 · session.js _gateAdvance).
      //   state.pack 만 바꾸고 stage 를 대입하면 세션이 안 열려 판이 통째로 안 뜬다(전부 '없음'의 원인).
      const sport = id.startsWith('BK_') ? 'basketball' : 'running';
      // ★ state.pack 도 같이 — 코치 판 틱의 게이트가 pack 을 본다(main.js:2795). 이게 빠져서 판이 0개였다.
      D.state.pack = sport;
      if (!S.active || S._sport !== sport) { S.start(sport); S._sport = sport; }
      const i = (S.stages || []).findIndex(x => x.id === id);
      if (i >= 0) { S.stageIdx = i; S.t = 0; S._enter(); }
      S._followLatch = phase === '따라하기';
      // 몇 프레임 흘려 판이 올라오게 한다(영상 readyState·필드 RT)
      for (let i = 0; i < 40; i++) { S.t = (phase === '따라하기' ? 9 : 2) + i * 0.033; await new Promise(r => requestAnimationFrame(r)); }
      // 코치 판 = uField 유니폼을 가진 메시
      let hit = null, found = 0, hidden = 0;
      D.scene.traverse(o => {
        if (!(o.isMesh && o.material?.uniforms?.uField)) return;
        found++;
        let vis = o.visible; for (let q = o.parent; q; q = q.parent) vis = vis && q.visible;
        if (vis) hit = o; else hidden++;
      });
      const vids = [...document.querySelectorAll('video')].map(v => v.readyState);
      if (!hit) return { vis: false, found, hidden, vids: vids.join(',') };
      // 화면 점유 — 바운딩박스 8점을 투영해 뷰포트 px 로
      const box = new D.THREE.Box3().setFromObject(hit);
      const cam = D.camera, W = window.innerWidth, H = window.innerHeight;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        const v = new D.THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
        const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { vis: true, w: Math.round(x1 - x0), h: Math.round(y1 - y0), cx: Math.round((x0 + x1) / 2), cy: Math.round((y0 + y1) / 2),
               op: +(hit.material.uniforms.uFade?.value ?? 1).toFixed(2) };
    }, id, phase);
    rows.push({ id, phase, ...r });
    console.log(`${id.padEnd(8)} ${phase.padEnd(5)} ${r.vis ? `보임 · ${r.w}x${r.h}px @(${r.cx},${r.cy}) fade ${r.op}` : `없음 (판 ${r.found ?? 0}개·숨김 ${r.hidden ?? 0} · video readyState [${r.vids ?? ''}])`}`);
  }
}
console.log('\n인물 보이는 스테이지:', [...new Set(rows.filter(r => r.vis).map(r => r.id))].join(', ') || '(없음)');
await b.close();
