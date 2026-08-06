// ─────────────────────────────────────────────────────────────
// 투사영역 이탈 검사 — **마크가 빔 밖으로 나오면 실패**한다 (유저 08-06: 안 되는 건 안 된다).
//
//   왜 감시자가 필요한가: 지금까지의 클램프(SB_BOX·sbU·sbV)는 전부 **원점**만 막았다.
//   마크는 중심이 창 안이어도 몸이 밖으로 나간다. 화살표 쪽 주석은 이미 그 병을 적어 뒀는데
//   (AR_MARGIN: "클램프는 원점만 막는데 메시는 진행 방향으로 더 뻗는다") 발마크·존 원은
//   그 처방을 못 받았다. 규칙만 적고 감시자를 안 만들면 또 샌다 — 오늘 하루가 그 증거다.
//
//   판정: 마크 **잉크** 사각형 네 귀퉁이가 전부 빔 사다리꼴 안인가.
//     빔 = fpNear <= d <= fpFar  그리고  |x - ox| <= _halfAt(d)
//   ★ 쿼드가 아니라 잉크로 잰다. 쿼드 한 변 0.619m 는 파동·헤일로 여백까지 포함한 값이라
//     (SIL_FIT 0.52 — "실루엣이 쿼드의 2/3만 쓴다") 그걸로 재면 항상 실패하고, 항상 실패하는
//     검사는 아무도 안 본다. 여백은 beamAlphaAt 소프트 페이드가 0 으로 스러뜨린다.
//
//   실행:  npx vite --port 5199 띄운 상태에서
//     node scripts/check_beam_fit.mjs            # 기준 = 좌우 0.07m · 앞뒤 0.16m
//     RX=0.60 node scripts/check_beam_fit.mjs    # 민감도 확인용 — 전건 실패해야 정상이다
//
//   ★ 민감도를 꼭 한 번 돌려 볼 것. 0 건 통과가 '안 새는 것'인지 '검사가 죽은 것'인지는
//     실패를 만들어 봐야 갈린다(실측: 0.16 → 0/26 · 0.60 → 26/26).
// ─────────────────────────────────────────────────────────────
import puppeteer from 'puppeteer';

// ★ 발은 원이 아니라 **길쭉하다** — 좌우 반폭 0.07m · 앞뒤 반길이 0.16m (실루엣 300×120mm).
//   원으로 재면 좌우를 실제의 2.3배로 조이게 되고, 그러면 스탠스가 뭉개진다(실측: 0.19m 로 눌려
//   스탠스 링크가 안 보이는 길이가 됐다). 배치(_beamFit)와 **같은 기하**로 재야 검사가 정직하다.

const RX = +(process.env.RX || 0.07);   // 좌우 반폭(m)
const RZ = +(process.env.RZ || 0.16);   // 앞뒤 반길이(m)
const URL = process.env.URL || 'http://127.0.0.1:5199/';

// 스테이지별 검사 시각 = 영상 재생 위치(stepVidT). 구간 시작·중간·끝을 다 본다 —
//   이탈은 보통 '가장 크게 벌린 프레임' 한 곳에서만 난다.
const VTS = { BK_B2: [0, 0.3, 0.6], BK_B3: [0.7, 1.0, 1.44],
              BK_B4: [1.5, 1.7, 1.81], BK_B5: [1.85, 1.95, 2.5, 3.1] };

const b = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => { document.querySelector('[data-pack=basketball]')?.click(); });
await new Promise(r => setTimeout(r, 2500));
// 팩 전환이 부트를 다시 돌리는 창이 있다 — __dbg 가 잠깐 사라진다(첫 판에 여기서 죽었다).
await p.waitForFunction('!!(window.__dbg&&window.__dbg.session)', { timeout: 60000 });
await p.evaluate(() => { window.__dbg.session.start('basketball'); });
await new Promise(r => setTimeout(r, 1500));

console.log(`투사영역 이탈 검사 — 잉크 좌우 ${RX}m · 앞뒤 ${RZ}m\n`);
let bad = 0, n = 0, minMargin = Infinity;
for (const [id, vts] of Object.entries(VTS)) {
  for (const vt of vts) {
    await p.evaluate(({ id, vt }) => {
      const s = window.__dbg.session;
      const i = s.stages.findIndex(x => x.id === id);
      if (i >= 0 && s.stageIdx !== i) { s.stageIdx = i; s.t = 0; s._enter(); }
      // 관찰 구간을 건너뛰고 따라하기 상태로 고정 — 가이드가 떠 있어야 잴 게 있다.
      clearInterval(window.__vtPin);
      window.__vtPin = setInterval(() => { s.stepVidT = vt; s._followLatch = true; s._aWatchEnd = 0; }, 8);
    }, { id, vt });
    await new Promise(r => setTimeout(r, 1400));
    const r = await p.evaluate(({ id, vt, RX, RZ }) => {
      const D = window.__dbg, THREE = D.THREE, s = D.session, rig = s.rig, fp = rig._fp;
      const H = { BK_B2: s.bkB2x, BK_B3: s.bkB3x, BK_B4: s.bkB4x, BK_B5: s.bkB5x }[id];
      const out = [];
      for (const [k, fm] of [['L', H.fRl || H.sL2], ['R', H.fRr || H.sR2]]) {
        if (!fm) continue;
        const w = new THREE.Vector3(); fm.group.getWorldPosition(w);
        let worst = null;
        for (const dx of [-RX, RX]) for (const dz of [-RZ, RZ]) {
          const x = w.x + dx, z = w.z + dz;
          const d = fp.oz - z;                                 // 전방 거리
          const over = Math.abs(x - fp.ox) - rig._halfAt(d);   // >0 = 좌우 이탈
          const dOver = Math.max(rig.fpNear - d, d - rig.fpFar);  // >0 = 앞뒤 이탈
          const m = Math.max(over, dOver);
          if (!worst || m > worst.m) worst = { m: +m.toFixed(4), d: +d.toFixed(3), over: +over.toFixed(4), dOver: +dOver.toFixed(4) };
        }
        out.push({ k, ...worst });
      }
      return { id, vt, out };
    }, { id, vt, RX, RZ });
    for (const o of r.out) {
      n++;
      const ok = o.m <= 0;
      if (!ok) bad++; else minMargin = Math.min(minMargin, -o.m);
      console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${r.id} vt=${String(r.vt).padEnd(5)} ${o.k}  여유 ${(-o.m).toFixed(3)}m  (전방 ${o.d}m · 좌우 ${o.over} · 앞뒤 ${o.dOver})`);
    }
  }
}
console.log('\n' + '─'.repeat(72));
if (bad) {
  console.log(`\n실패 ${bad}/${n}건 — 마크가 투사영역 밖으로 나간다`);
  console.log('처방: session.js _beamFit 의 반경(SB_FIT_U 좌우 · SB_FIT_V 앞뒤)을 키우거나,');
  console.log('      무대(SB_BOX)를 창 안쪽으로 좁힌다. 원점만 클램프하면 안 된다 — 몸의 반경까지 넣어야 한다.');
  console.log('      ★ 좌우를 발 길이로 조이지 말 것. 발은 길쭉하고, 원으로 조이면 스탠스가 뭉갠다(0.44 → 0.19m).');
  process.exitCode = 1;
} else {
  console.log(`\n통과 — ${n}건 전부 창 안. 최소 여유 ${minMargin.toFixed(3)}m`);
  console.log('민감도 확인:  RX=0.60 node scripts/check_beam_fit.mjs  → 전건 실패해야 검사가 살아 있는 것이다.');
}
await b.close();
