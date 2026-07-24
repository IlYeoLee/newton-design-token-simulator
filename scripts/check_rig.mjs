// FBX 리깅 판별기 — mixamorig(네이티브)/UE/Rokoko/기타 즉시 분류.
//   node scripts/check_rig.mjs <a.fbx> <b.fbx> ...
import fs from 'fs';
globalThis.window = { URL: { createObjectURL: () => 'blob:x' } };
globalThis.Blob = globalThis.Blob || class {};
globalThis.document = { createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {}, setAttribute: () => {}, style: {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

for (const f of process.argv.slice(2)) {
  try {
    const buf = fs.readFileSync(f);
    const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), './');
    const names = new Set(); g.traverse(o => { if (o.isBone) names.add(o.name); });
    const arr = [...names];
    const rig = arr.some(n => n.startsWith('mixamorig')) ? 'MIXAMO★'
      : arr.includes('pelvis') && arr.includes('spine_01') ? 'UE(비추천)'
      : arr.includes('Rokoko_Video_Character') ? 'ROKOKO'
      : '기타(' + arr.slice(0, 3).join(',') + ')';
    const anims = g.animations.map(a => `${a.name.slice(0, 24)} ${a.duration.toFixed(1)}s`).join(' · ') || '애니 없음';
    console.log(`${f.split('/').pop().padEnd(34)} ${rig.padEnd(12)} ${anims}`);
  } catch (e) { console.log(`${f.split('/').pop().padEnd(34)} 로드실패: ${e.message.slice(0, 40)}`); }
}
