// PNG IHDR 를 직접 읽는다 — 비트깊이·컬러타입이 용량의 진짜 원인인지.
//   IHDR: [8바이트 시그니처][길이4][타입4][폭4][높이4][비트깊이1][컬러타입1]
//   컬러타입 0=회색 2=RGB 3=팔레트 4=회색+알파 6=RGBA
import fs from 'node:fs';
import path from 'node:path';

const CT = { 0: '회색', 2: 'RGB', 3: '팔레트', 4: '회색+알파', 6: 'RGBA' };
const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();

for (const f of [files[0], files[Math.floor(files.length / 2)]]) {
  const fd = fs.openSync(path.join(DIR, f), 'r');
  const b = Buffer.alloc(26);
  fs.readSync(fd, b, 0, 26, 0);
  fs.closeSync(fd);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const depth = b[24], ct = b[25];
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1;
  const raw = w * h * ch * (depth / 8);
  const sz = fs.statSync(path.join(DIR, f)).size;
  console.log(`${f}`);
  console.log(`  ${w}x${h} · 비트깊이 ${depth} · 컬러타입 ${ct}(${CT[ct]}) · 채널 ${ch}`);
  console.log(`  무압축 ${(raw / 1024 / 1024).toFixed(1)}MB → 파일 ${(sz / 1024 / 1024).toFixed(1)}MB (압축률 ${(sz / raw * 100).toFixed(0)}%)`);
  if (depth > 8) console.log(`  ★ 비트깊이 ${depth} — 8비트면 용량이 절반이 된다`);
  if (ct === 6) console.log(`  ★ 알파 채널 있음 — 검정배경 판엔 불필요(채널 25% 낭비)`);
  console.log('');
}
