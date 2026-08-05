// 지면 UI 통일 감사 — 같은 뜻인데 값이 두 벌인 곳을 찾는다.
import fs from 'fs';
const s = fs.readFileSync('src/floorgl.js', 'utf8');
const lines = s.split('\n');
const hit = (re, why) => {
  const out = [];
  lines.forEach((l, i) => { if (re.test(l) && !/^\s*(\/\/|\*)/.test(l)) out.push([i + 1, l.trim().slice(0, 96)]); });
  if (out.length) { console.log('\n■ ' + why); out.forEach(([n, t]) => console.log('  ' + String(n).padStart(5) + '  ' + t)); }
  return out.length;
};
let n = 0;
n += hit(/\bsafeW\([^)]*\)\s*-\s*(?!48\b)\d+/, '안전폭 여백이 48 이 아닌 곳 (아크 규약과 어긋남)');
n += hit(/Math\.min\(\s*\d{3,}\s*,\s*safeW/, '아크/폭 상한을 숫자로 박은 곳 (LAYOUT.PROG.wMax 를 쓸 것)');
n += hit(/\bF\((?:700|400|500),\s*(?:9[0-9]|1[0-9]{2})\b/, '타이틀급 활자를 숫자로 박은 곳 (LAYOUT.TYPE / TOK 를 쓸 것)');
n += hit(/\+\s*h\s*\*\s*\.\d|\*\s*h\s*\*\s*\.\d|y\s*\+\s*h\s*\*\s*\./, '세로를 분수로 배치한 곳 (h/2 규약 위반 — 높이 바뀌면 정렬 깨짐)');
n += hit(/CX\s*\+\s*[1-9]\b/, '중앙에 매직넘버 보정을 더한 곳');
n += hit(/rgba\(255,255,255,\s*\.(?:05|25|95|22|06)\d*\)/, '유리 알약 수치를 직접 적은 곳 (TOK 를 쓸 것)');
n += hit(/^\s*const .*= *\/\^\(.*\)\$\/\.test/, '스테이지 목록을 정규식으로 따로 든 곳 (CAPS 와 어긋날 수 있음)');
console.log('\n총 ' + n + '건');
