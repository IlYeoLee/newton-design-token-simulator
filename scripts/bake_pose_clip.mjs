// 실사 영상 → MediaPipe 포즈 → X Bot AnimationClip JSON 베이크 (오프라인 1회)
// 사용: node scripts/bake_pose_clip.mjs </video.mp4> <outName> [fps] [smooth]
//   예: node scripts/bake_pose_clip.mjs /quad_src.mp4 quad_stretch 24 0.4
// 전제: dev 서버(localhost:5199) 가동 — 페이지의 __dbg.extractPose/retargetToClip 사용
// 출력: assets/mocap/xclip-<outName>.json (Bandai 클립과 동일 규약 — xbot.js regJson 로드)

import puppeteer from 'puppeteer';
import fs from 'fs';

// pingpong: 'pp' — 정방향+역방향 이어붙여 심리스 루프(끝포즈≠시작포즈 소스용, dur 2배)
const [, , vid = '/quad_src.mp4', name = 'quad_stretch', fps = '24', smooth = '0.4', pingpong = ''] = process.argv;
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
page.setDefaultTimeout(300000);
page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle2' });
await page.waitForFunction('!!window.__dbg && !!window.__dbg.xbot && !!window.__dbg.xbot.model');

const json = await page.evaluate(async (vid, fps, smooth, pingpong) => {
  const d = window.__dbg;
  const pose = await d.extractPose(vid, fps);
  if (!pose.frames.length) throw new Error('포즈 프레임 0 — 영상에서 사람 미검출');
  if (pingpong === 'pp') {
    const fwd = pose.frames, T = fwd[fwd.length - 1].t, dt = 1 / pose.fps;
    const rev = fwd.slice(0, -1).reverse().map((f, i) => ({ t: +(T + dt * (i + 1)).toFixed(3), lm: f.lm }));
    pose.frames = fwd.concat(rev);
    pose.dur = pose.frames[pose.frames.length - 1].t + dt;
  }
  const clip = d.retargetToClip(pose, d.xbot.model, { smooth });
  return JSON.stringify({ n: pose.frames.length, dur: clip.duration, json: d.THREE.AnimationClip.toJSON(clip) });
}, vid, +fps, +smooth, pingpong);

const { n, dur, json: clipJson } = JSON.parse(json);
const out = `assets/mocap/xclip-${name}.json`;
fs.writeFileSync(out, JSON.stringify(clipJson));
console.log(`${out}: ${dur.toFixed(2)}s · 프레임 ${n} · ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
await browser.close();
