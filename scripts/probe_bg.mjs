// 배경 영상이 **내보내기 브라우저에서 실제로 디코드되는지** 확인한다.
//   에펙에서 열린다고 헤드리스 크롬에서 열리는 게 아니다 — HEVC(특히 10bit)는 크롬 빌드·OS
//   조합에 따라 아예 지원이 없다. 지원이 없으면 배경이 그냥 검게 나오는데, 그건 렌더를
//   다 돌린 뒤에야 보인다. 먼저 묻는다.
//   사용: node scripts/probe_bg.mjs "C:\path\video.mp4" [...]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const files = process.argv.slice(2).filter(f => fs.existsSync(f));
if (!files.length) { console.error('사용: node scripts/probe_bg.mjs <영상파일…>'); process.exit(1); }

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('about:blank');

for (const f of files) {
  const buf = fs.readFileSync(f);
  const b64 = buf.subarray(0, Math.min(buf.length, 40 * 1024 * 1024)).toString('base64');   // 앞 40MB 만
  const r = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' }));
    const v = document.createElement('video');
    v.muted = true; v.src = url;
    const out = await new Promise(res => {
      const t = setTimeout(() => res({ ok: false, why: '타임아웃(10초) — 디코더가 못 엶' }), 10000);
      v.onloadeddata = () => { clearTimeout(t); res({ ok: true, w: v.videoWidth, h: v.videoHeight, rs: v.readyState }); };
      v.onerror = () => { clearTimeout(t); res({ ok: false, why: `error code ${v.error?.code} ${v.error?.message || ''}` }); };
    });
    // 실제로 '그림'이 있는지 — 크기만 읽히고 프레임이 검은 경우가 있다
    if (out.ok) {
      try {
        v.currentTime = 0.5;
        await new Promise(r2 => { v.onseeked = r2; setTimeout(r2, 2000); });
        const c = document.createElement('canvas'); c.width = 32; c.height = 32;
        c.getContext('2d').drawImage(v, 0, 0, 32, 32);
        const d = c.getContext('2d').getImageData(0, 0, 32, 32).data;
        let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
        out.lum = Math.round(s / 1024);
      } catch (e) { out.lum = -1; }
    }
    URL.revokeObjectURL(url);
    return out;
  }, b64);
  const name = path.basename(f);
  if (!r.ok) console.log(`✗ ${name}\n    디코드 실패 — ${r.why}`);
  else if ((r.lum ?? 0) <= 2) console.log(`✗ ${name}\n    ${r.w}×${r.h} 로 열리지만 프레임이 검음(평균 휘도 ${r.lum}) — 디코더가 실제로는 못 푼다`);
  else console.log(`✓ ${name}\n    ${r.w}×${r.h} · readyState ${r.rs} · 평균 휘도 ${r.lum} — 배경으로 쓸 수 있다`);
}
await browser.close();
