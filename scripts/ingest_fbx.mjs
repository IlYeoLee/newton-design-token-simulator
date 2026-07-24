// 외부 FBX 정식 인제스트 파이프라인 — "아무 FBX든 던지면 X봇 장착까지".
//   node scripts/ingest_fbx.mjs <a.fbx> <b.fbx> ...
// 절차: ①리그 판별 → mixamorig면 무변환 통과, 그 외 Blender 리타겟(월드 2패스·절대높이·접지정렬)
//       ②수치 QA 게이트: 프레임 지터(°)·발 최저/최고·힙 범위 — 기준 미달이면 REJECT(적재 안 함)
//       ③통과분 assets/imported/<슬러그>.fbx + manifest.json → 앱이 자동 등록(코드 수정 불필요)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

globalThis.window = { URL: { createObjectURL: () => 'blob:x' } };
globalThis.Blob = globalThis.Blob || class {};
globalThis.document = { createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {}, setAttribute: () => {}, style: {} }) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const OUT_DIR = 'assets/imported';
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

const loadFbx = (f) => {
  const b = fs.readFileSync(f);
  return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), './');
};
const xbot = loadFbx('assets/xbot.fbx');

function rigOf(g) {
  const names = new Set(); g.traverse(o => { if (o.isBone) names.add(o.name); });
  if ([...names].some(n => n.startsWith('mixamorig'))) return 'MIXAMO';
  if (names.has('pelvis') && names.has('spine_01')) return 'UE';
  if (names.has('Chest') && names.has('Spine1')) return 'MOTIFECT';
  return '기타(' + [...names].slice(0, 3).join(',') + ')';
}

function qa(fbxPath) {
  const g = loadFbx(fbxPath);
  const clip = g.animations[0];
  if (!clip) return { ok: false, why: '애니 없음' };
  let jit = 0;
  for (const tr of clip.tracks) if (tr.name.endsWith('.quaternion')) {
    const v = tr.values;
    for (let i = 4; i < v.length; i += 4) {
      const a = new THREE.Quaternion(v[i-4], v[i-3], v[i-2], v[i-1])
        .angleTo(new THREE.Quaternion(v[i], v[i+1], v[i+2], v[i+3])) * 180 / Math.PI;
      if (a > jit) jit = a;
    }
  }
  const mixer = new THREE.AnimationMixer(xbot);
  const act = mixer.clipAction(clip); act.play();
  const F = { L: xbot.getObjectByName('mixamorigLeftFoot'), R: xbot.getObjectByName('mixamorigRightFoot'), H: xbot.getObjectByName('mixamorigHips') };
  const v3 = new THREE.Vector3();
  let fmin = 1e9, hmin = 1e9, hmax = -1e9;
  const n = Math.floor(clip.duration * 30);
  for (let i = 0; i < n; i++) {
    mixer.setTime(i / 30); xbot.updateMatrixWorld(true);
    for (const k of ['L', 'R']) { v3.setFromMatrixPosition(F[k].matrixWorld); fmin = Math.min(fmin, v3.y); }
    v3.setFromMatrixPosition(F.H.matrixWorld); hmin = Math.min(hmin, v3.y); hmax = Math.max(hmax, v3.y);
  }
  act.stop(); mixer.uncacheClip(clip);
  const why = [];
  const jitLimit = arguments.length && false ? 0 : (qa._native ? 55 : 35);   // 네이티브(Mixamo)는 완화
  if (jit > jitLimit) why.push(`지터 ${jit.toFixed(0)}°>${jitLimit}°`);
  if (fmin > 15) why.push(`발 최저 ${fmin.toFixed(0)}cm 부양`);
  if (fmin < -8) why.push(`발 ${fmin.toFixed(0)}cm 매몰`);
  if (hmax > 250 || hmin < -20) why.push(`힙 범위 이상 ${hmin.toFixed(0)}~${hmax.toFixed(0)}cm`);
  return { ok: why.length === 0, why: why.join(' · ') || '통과', jit, fmin, dur: clip.duration };
}

for (const src of process.argv.slice(2)) {
  const slug = path.basename(src).replace(/\.fbx$/i, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  let staged = src, rig;
  try { rig = rigOf(loadFbx(src)); } catch (e) { console.log(`✗ ${slug}: 로드 실패 (${e.message.slice(0, 40)})`); continue; }
  if (rig !== 'MIXAMO') {
    staged = `/tmp/ingest_${slug}.fbx`;
    try {
      execFileSync(BLENDER, ['-b', '-P', 'scripts/blender_retarget.py', '--', src, staged], { stdio: 'pipe', timeout: 600000 });
    } catch (e) { console.log(`✗ ${slug}: Blender 변환 실패 [${rig}]`); continue; }
  }
  qa._native = rig === 'MIXAMO';
  const r = qa(staged);
  const tag = rig === 'MIXAMO' ? '무변환' : `Blender(${rig})`;
  if (!r.ok) { console.log(`✗ ${slug.padEnd(28)} ${tag.padEnd(18)} REJECT — ${r.why}`); continue; }
  fs.copyFileSync(staged, path.join(OUT_DIR, slug + '.fbx'));
  manifest[slug] = { grounded: rig !== 'MIXAMO', rig, dur: +r.dur.toFixed(2), jit: +r.jit.toFixed(1) };
  console.log(`✓ ${slug.padEnd(28)} ${tag.padEnd(18)} 지터 ${r.jit.toFixed(1)}° · 발 ${r.fmin.toFixed(0)}cm · ${r.dur.toFixed(1)}s → 장착`);
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`\nmanifest: ${Object.keys(manifest).length}개 클립 — 앱 새로고침 시 자동 등록`);
