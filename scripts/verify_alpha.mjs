// 내보낸 영상이 '에펙에서 진짜 투명한가'를 파일에서 직접 확인한다.
//   PNG 시퀀스가 투명해도 인코딩에서 알파가 날아가면(픽셀 포맷을 잘못 고르면) 에펙에선
//   검은 배경으로 열린다 — 유저가 가장 싫어하는 실패다. 그래서 .mov 를 다시 디코드해서 본다.
//   사용: node scripts/verify_alpha.mjs out/final3s/*.mov   (경로 여러 개 가능)
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { PNG } from 'pngjs';

const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const files = process.argv.slice(2).filter(f => /\.(mov|mp4|webm)$/i.test(f));
if (!files.length) { console.error('사용: node scripts/verify_alpha.mjs <영상파일…>'); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'newton_verify_'));
let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`✗ ${f} — 파일 없음`); bad++; continue; }
  // 픽셀 포맷 — 알파를 가진 포맷이어야 한다(yuva444p10le = ProRes 4444 + 알파)
  let fmt = '?', dim = '?';
  try {
    const j = JSON.parse(execFileSync(FF.replace(/ffmpeg(\.exe)?$/, (m) => m.replace('ffmpeg', 'ffprobe')),
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', f], { encoding: 'utf8' }));
    const v = j.streams.find(s => s.codec_type === 'video');
    fmt = v.pix_fmt; dim = `${v.width}×${v.height}`;
  } catch {
    // ffmpeg-static 에는 ffprobe 가 없을 수 있다 — 디코드 결과로만 판정한다(그게 진짜 증거다).
  }
  // 중간 프레임을 RGBA 로 뽑아 알파를 직접 읽는다
  const png = path.join(tmp, 'f.png');
  execFileSync(FF, ['-y', '-v', 'error', '-i', f, '-vf', 'select=eq(n\\,10)', '-vframes', '1',
    '-pix_fmt', 'rgba', png], { stdio: ['ignore', 'ignore', 'inherit'] });
  const p = PNG.sync.read(fs.readFileSync(png));
  const at = (x, y) => p.data[(y * p.width + x) * 4 + 3];
  const corner = Math.max(at(0, 0), at(p.width - 1, 0), at(0, p.height - 1), at(p.width - 1, p.height - 1));
  let opaque = 0;
  for (let i = 3; i < p.data.length; i += 4) if (p.data[i] >= 8) opaque++;
  const cov = opaque / (p.width * p.height) * 100;
  const ok = corner <= 8 && cov > 0.05 && cov < 99.5;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${path.basename(f)}`);
  console.log(`    ${dim} · ${fmt} · 디코드 ${p.width}×${p.height}`);
  console.log(`    모서리 알파 ${corner}/255 ${corner <= 8 ? '(투명 ✓)' : '(← 배경이 불투명하다)'} · 불투명 픽셀 ${cov.toFixed(2)}%`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `\n✗ ${bad}개 실패` : '\n✅ 전부 투명 배경으로 확인됨 — 에펙에 그대로 임포트하면 됩니다.');
process.exit(bad ? 1 : 0);
