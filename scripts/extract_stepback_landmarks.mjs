// 스텝백 영상 → 프레임별 **정규화 이미지 좌표** 랜드마크(33개) 실측.
//   worldLandmarks(미터)는 posemocap 이 이미 쓰지만, 강조 타원은 **패널 uv** 에 앉으므로
//   image-space 가 필요하다. 모델·wasm 은 이미 로컬(public/models · public/mediapipe-wasm).
//   실행: vite 5199 떠 있는 상태에서  node scripts/extract_stepback_landmarks.mjs [클립.mp4]
//   ★ 대상은 인자다 — 클립을 갈면(08-07 stepback_fwd → stepback_pack) **그 클립에서** 다시 뽑는다.
//     크롭·패딩이 다르면 image-space uv 는 같은 테이크여도 어긋난다(유저: 원이 발에 안 붙음).
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
const SRC = process.argv[2] || 'stepback_fwd.mp4';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 300)));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle2', timeout: 60000 });

const out = await p.evaluate(async (SRC) => {
  const { FilesetResolver, PoseLandmarker } = await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
  const lm = await PoseLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: '/models/pose_landmarker_full.task' },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  const v = document.createElement('video');
  v.src = '/' + SRC; v.muted = true;
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('load fail')); });
  const seek = t => new Promise(res => { const on = () => { v.removeEventListener('seeked', on); res(); }; v.addEventListener('seeked', on); v.currentTime = t; });
  const FPS = 30, dur = v.duration, frames = [];
  for (let i = 0; i * (1 / FPS) < dur - 1e-3; i++) {
    const t = i / FPS;
    await seek(t);
    const r = lm.detectForVideo(v, Math.round(t * 1000));
    const L = r.landmarks?.[0];
    if (!L) { frames.push({ t: +t.toFixed(3), lm: null }); continue; }
    // x,y = 0..1 이미지 좌표(y 아래로 증가) · vis = 가시도
    frames.push({ t: +t.toFixed(3), lm: L.map(q => [+q.x.toFixed(4), +q.y.toFixed(4), +(q.visibility ?? 1).toFixed(3)]) });
  }
  lm.close();
  return { src: SRC, w: v.videoWidth, h: v.videoHeight, dur, fps: FPS, n: frames.length, frames };
}, SRC);
await b.close();
writeFileSync(`assets/mocap/${SRC.replace(/\.\w+$/, '')}-landmarks.json`, JSON.stringify(out));
const miss = out.frames.filter(f => !f.lm).length;
console.log(`${out.w}x${out.h} ${out.dur.toFixed(2)}s · ${out.n} frames · 미검출 ${miss}`);
