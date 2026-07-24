// 접지 자동 추출 파이프라인 — 클립 FK로 발 접지 시퀀스(t, 좌/우, x, z)를 뽑아
// assets/mocap/contacts-<이름>.json 으로 저장. 세션 발자국 가이드는 이 데이터에서 자동 생성
// (하드코딩 좌표 금지 — 마크가 접지에서 나오므로 봇이 정의상 정확히 밟는다).
//   node scripts/extract_contacts.mjs cmu_crossover_shot mf_layup ...
// 이름은 assets/mocap/xclip-<이름>.json (리타겟 산출물) 기준.
import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const xbBuf = fs.readFileSync('assets/xbot.fbx');
const xb = new FBXLoader().parse(xbBuf.buffer.slice(xbBuf.byteOffset, xbBuf.byteOffset + xbBuf.byteLength), './');
const F = { L: xb.getObjectByName('mixamorigLeftFoot'), R: xb.getObjectByName('mixamorigRightFoot') };

function extract(name) {
  const clip = THREE.AnimationClip.parse(JSON.parse(fs.readFileSync(`assets/mocap/xclip-${name}.json`, 'utf8')));
  const mixer = new THREE.AnimationMixer(xb);
  const action = mixer.clipAction(clip); action.play();
  const v = new THREE.Vector3();
  const n = Math.floor(clip.duration * 60);
  const series = { L: [], R: [] };
  for (let i = 0; i < n; i++) {
    mixer.setTime(i / 60); xb.updateMatrixWorld(true);
    for (const k of ['L', 'R']) { v.setFromMatrixPosition(F[k].matrixWorld); series[k].push({ t: i / 60, x: v.x / 100, y: v.y / 100, z: v.z / 100 }); }
  }
  // 접지 = 발이 낮고(<12cm) 수평속도 낮은 구간의 시작 1이벤트
  const contacts = [];
  for (const k of ['L', 'R']) {
    let inC = false;
    for (let i = 2; i < n; i++) {
      const s = series[k][i], p = series[k][i - 2];
      const speed = Math.hypot(s.x - p.x, s.z - p.z) / (2 / 60);
      const low = s.y < 0.12;
      if (low && speed < 0.6 && !inC) { inC = true; contacts.push({ t: +s.t.toFixed(2), side: k, x: +s.x.toFixed(2), z: +s.z.toFixed(2) }); }
      if (!low || speed > 1.2) inC = false;
    }
  }
  contacts.sort((a, b) => a.t - b.t);
  action.stop(); mixer.uncacheClip(clip);
  const out = { clip: name, duration: +clip.duration.toFixed(2), contacts };
  fs.writeFileSync(`assets/mocap/contacts-${name}.json`, JSON.stringify(out, null, 1));
  console.log(name, `${clip.duration.toFixed(2)}s`, `접지 ${contacts.length}개`, JSON.stringify(contacts));
}

for (const name of process.argv.slice(2)) extract(name);
