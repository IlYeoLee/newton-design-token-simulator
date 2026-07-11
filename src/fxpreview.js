// ─────────────────────────────────────────────────────────────
// 룩 스튜디오 미리보기 셀 — FX Lab의 라이브 캔버스를 시뮬 안에 이식
//   터짐(루프) · 발자국 SDF 파문 · 레인 광류 · MARK 7상태(칩 전환).
//   raw WebGL(three 무관) — FXP 라이브 파라미터와 공유 LUT를 매 프레임 반영.
// ─────────────────────────────────────────────────────────────
import { FXP, rebuildLUT, FX_GLSL } from './fxlut.js';

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
const HEAD = 'precision highp float;\nuniform sampler2D uLUT;\nuniform vec2 uRes;\n'
  + FX_GLSL.replace('uniform sampler2D uLUT;', '')
  + '\nvec3 lutv(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }\n';

// ── 터짐 (리퀴드 — 시뮬 effects.js와 동일 수식) ──
const BURST_FRAG = HEAD + `
uniform float uT, uW, uHalo, uNoise, uEmber;
void main(){
  vec2 uv = (gl_FragCoord.xy - uRes*0.5) / (uRes.y*0.5);
  float d0 = length(uv);
  float ang = atan(uv.y, uv.x);
  float t = uT;
  float ein = smoothstep(0.0, 0.06, t);
  float e = 1.0 - pow(1.0 - t, 2.6);
  float fade = pow(1.0 - t, 1.5) * ein;
  float u1 = fxundul(ang, t * 2.2);
  float wob = u1 + (fxfbm(vec2(ang * 1.3 + t, d0 * 2.0)) - 0.5) * 0.5;
  float d = d0 * (1.0 + wob * uNoise * 0.10);
  float R = 0.06 + e * 0.84;
  float W = (0.028 + e * 0.09) * uW;
  float heat = exp(-pow((d - R) / W, 2.0)) + exp(-pow((d - R) / (W * 4.6), 2.0)) * 0.42 * uHalo;
  float e2 = 1.0 - pow(1.0 - clamp(t - 0.14, 0.0, 1.0) / 0.86, 2.6);
  float R2 = 0.06 + e2 * 0.756;
  heat += (exp(-pow((d - R2) / W, 2.0)) + exp(-pow((d - R2) / (W * 4.6), 2.0)) * 0.42 * uHalo) * 0.38;
  heat *= fade;
  heat += smoothstep(R, R * 0.2, d0) * uEmber * fade * (0.8 + 0.2 * wob);
  heat += exp(-d0 * 6.5) * pow(1.0 - t, 2.2) * 1.15;
  float sweep = 0.09 * sin(ang - t * 2.4) + 0.05 * sin(ang * 2.0 + t * 1.1);
  vec3 col = lutv(clamp(heat * (0.95 - 0.28 * t) + sweep * min(heat, 1.0), 0.0, 1.0)) * min(heat, 1.4);
  gl_FragColor = vec4(vec3(0.047,0.055,0.075) + col, 1.0);
}`;

// ── 발자국 — SDF 윤곽 파문 (착지 플래시 → 잔열 → 파문) ──
const FOOT_FRAG = HEAD + `
uniform float uT, uW, uHalo, uNoise, uEmber;
uniform sampler2D uSDF;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float sd = (texture2D(uSDF, vec2(uv.x, 1.0 - uv.y)).r - 0.5019) * 1.0;
  float t = uT;
  float ein = smoothstep(0.0, 0.06, t);
  float e = 1.0 - pow(1.0 - t, 2.4);
  float R = e * 0.4;
  float W = (0.03 + e * 0.06) * uW;
  float fade = pow(1.0 - t, 1.4) * ein;
  float wob = fxfbm(uv * 6.0 + t * 1.2);
  float sdw = sd + (wob - 0.5) * uNoise * 0.05;
  float ring = exp(-pow((sdw - R) / W, 2.0));
  float halo = exp(-pow((sdw - R) / (W * 3.2), 2.0)) * 0.35 * uHalo;
  float inFoot = smoothstep(0.012, -0.012, sd);
  float flash = inFoot * pow(1.0 - t, 2.6) * 0.8 * ein;
  float ember = inFoot * uEmber * fade * (0.72 + 0.28 * wob);
  float heat = (ring + halo) * fade + flash + ember;
  vec3 col = lutv(clamp(heat * (0.95 - 0.25 * t), 0.0, 1.0)) * min(heat, 1.35);
  gl_FragColor = vec4(vec3(0.047,0.055,0.075) + col, 1.0);
}`;

// ── 레인 + 방향 화살표 광류 ──
const LANE_FRAG = HEAD + `
uniform float uTime, uW, uHalo;
float segSD(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime;
  float wave = sin(uv.y * 5.2 + t * 1.4) * 0.012;
  float x = uv.x - 0.5 + wave;
  float along = uv.y;
  float latD = abs(x);
  float coreW = 0.006 * uW;
  float lane = exp(-pow(latD / coreW, 2.0)) + exp(-pow(latD / (coreW * 7.0), 2.0)) * 0.32 * uHalo;
  float pulse = smoothstep(0.25, 0.55, 0.5 + 0.5 * sin(along * 34.0 - t * 6.0));
  lane *= 0.35 + 0.65 * pulse;
  lane *= smoothstep(0.02, 0.12, along) * smoothstep(0.98, 0.80, along);
  float ahead = fract(t * 0.5);
  float ay = 0.62 + ahead * 0.18;
  vec2 p = vec2(x, uv.y);
  float ch = min(segSD(p, vec2(-0.075, ay - 0.05), vec2(0.0, ay)),
                 segSD(p, vec2(0.075, ay - 0.05), vec2(0.0, ay)));
  float chW = 0.009 * uW;
  float arrow = (exp(-pow(ch / chW, 2.0)) + exp(-pow(ch / (chW * 5.0), 2.0)) * 0.4 * uHalo) * pow(1.0 - ahead, 1.6) * 1.25;
  float heat = lane * 0.85 + arrow;
  float sweep = 0.10 * sin(along * 3.0 - t * 1.6);
  vec3 col = lutv(clamp(along * 0.55 + 0.25 + arrow * 0.35 + sweep, 0.0, 1.0)) * min(heat, 1.4);
  gl_FragColor = vec4(vec3(0.047,0.055,0.075) + col, 1.0);
}`;

// ── MARK 7상태 (파동 상태 언어 — Hold 수위·Miss 위상붕괴 포함) ──
const MARK_FRAG = HEAD + `
uniform float uTime, uState, uW, uHalo, uPool, uSweepA, uWobble;
float band(float sd, float w, float haloAmp){
  return exp(-pow(sd / w, 2.0)) + exp(-pow(sd / (w * 5.0), 2.0)) * haloAmp * uHalo;
}
void main(){
  vec2 uv0 = (gl_FragCoord.xy - uRes*0.5) / (uRes.y*0.5);
  float tc = fract(uTime * 0.45);
  vec2 uv = uv0;
  if (uState > 3.5 && uState < 4.5) uv -= vec2(tc * 0.34, -tc * 0.13);
  float d = length(uv);
  float ang = atan(uv.y, uv.x);
  float a01 = fract(0.25 - ang / 6.2832);
  float u1 = fxundul(ang, uTime * 1.6);
  float Rz = 0.5;
  float sd = d * (1.0 + u1 * uWobble * 0.05) - Rz;
  float edgeW = 0.014 * uW;
  float edge = band(abs(sd), edgeW, 0.45);
  float poolN = fxfbm(uv * 2.6 + vec2(uTime * 0.18, -uTime * 0.12));
  float pool = smoothstep(0.02, -0.10, sd) * (0.55 + 0.45 * poolN) * (uPool * 1.82);
  float heat = 0.0; float alpha = 1.0; float desat = 0.0; float amber = 0.0; float hot = 0.0;
  if (uState < 0.5) {            // Preview
    alpha = mix(0.6, 0.35, 0.5 + 0.5 * sin(uTime * 2.2));
    heat = edge * 0.85 + pool * 0.10;
  } else if (uState < 1.5) {     // Active
    float off = 0.5 * (1.0 - tc);
    float cR = band(abs(sd - off), 0.011 * uW, 0.4) * (0.3 + 0.7 * tc);
    heat = edge + pool * 0.4 + cR;
    hot = tc * 0.22 + cR * 0.2;
  } else if (uState < 2.5) {     // Hold: 열 수위 차오름 + 수면 찰랑임
    float pr = tc < 0.68 ? tc / 0.68 : 1.0 - (tc - 0.68) / 0.32;
    float lvl = mix(-Rz * 1.05, Rz * 1.1, pr);
    float surf = sin(uv.x * 9.0 - uTime * 3.2) * 0.018 + sin(uv.x * 15.0 + uTime * 4.4) * 0.008;
    float inside = smoothstep(0.015, -0.015, sd);
    float fillLvl = smoothstep(0.012, -0.012, uv.y - (lvl + surf)) * inside;
    float surfGlow = exp(-pow((uv.y - (lvl + surf)) / 0.03, 2.0)) * inside * 1.1;
    heat = edge * 0.6 + fillLvl * (0.5 + 0.25 * poolN) + surfGlow + pool * 0.12;
    hot = surfGlow * 0.3;
  } else if (uState < 3.5) {     // Success
    float e = 1.0 - pow(1.0 - tc, 2.6);
    float wob = (fxundul(ang, uTime * 2.2) + (fxfbm(vec2(ang * 1.3 + tc, d * 2.0)) - 0.5) * 0.5) * uWobble * 0.06;
    float flash = exp(-tc * 8.0) * 1.7;
    float rip = band(abs(sd + wob - e * 0.55), (0.028 + e * 0.09) * uW, 0.42) * pow(1.0 - tc, 1.5);
    rip += band(abs(sd + wob - max(e - 0.16, 0.0) * 0.5), (0.03 + e * 0.07) * uW, 0.42) * pow(1.0 - tc, 1.5) * 0.38;
    heat = pool * flash + edge * pow(1.0 - tc, 1.4) + rip;
    hot = flash * 0.25;
  } else if (uState < 4.5) {     // Miss: 위상 붕괴
    float chaos = fxfbm(uv * 5.0 + uTime * 1.5) - 0.5;
    float sdb = sd + chaos * tc * 0.28;
    alpha = pow(1.0 - tc, 1.7) * 0.75;
    heat = band(abs(sdb), edgeW * (1.0 + tc * 3.0), 0.45) * 0.8 + pool * 0.2 * (1.0 - tc);
    hot = -tc * 0.3;
  } else if (uState < 5.5) {     // Warning: 파형 떨림 + 앰버
    float jit = sin(ang * 22.0 + uTime * 18.0) * 0.012 + (fxfbm(uv * 8.0 + uTime * 3.0) - 0.5) * 0.02;
    float sdj = sd + jit;
    float off = 0.5 * (1.0 - tc);
    heat = band(abs(sdj), edgeW, 0.45) + pool * 0.4 + band(abs(sdj - off), 0.011 * uW, 0.4) * 0.5;
    amber = band(abs(sd - 0.16), edgeW * 2.2, 0.5) * (0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 7.0)));
  } else {                       // Locked
    heat = edge * 0.5 + pool * 0.16;
    desat = 1.0;
  }
  float sweep = (0.10 * sin(ang - uTime * 1.9) + 0.05 * sin(ang * 2.0 + uTime * 0.9)) * uSweepA;
  vec3 col = lutv(clamp(heat * 0.72 + hot + sweep * min(heat, 1.0), 0.0, 1.0)) * min(heat, 1.35) * alpha;
  col += vec3(1.0, 0.62, 0.22) * amber * 0.85;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * 0.62, desat);
  gl_FragColor = vec4(vec3(0.047,0.055,0.075) + col, 1.0);
}`;

// ── raw WebGL 셀 ──────────────────────────────
function glCell(canvas, frag) {
  const gl = canvas.getContext('webgl');
  const sh = (ty, src) => {
    const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('[fxpreview]', gl.getShaderInfoLog(s));
    return s;
  };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), canvas.width, canvas.height);
  const lutTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lutTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(pr, 'uLUT'), 0);
  return {
    gl, pr,
    u: n => gl.getUniformLocation(pr, n),
    syncLUT(data) {
      gl.useProgram(pr);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    },
    draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); },
  };
}

// 발형 SDF (FX Lab과 동일) — 1회 계산
function footSDF() {
  const N = 160;
  const oc = document.createElement('canvas'); oc.width = oc.height = N;
  const g = oc.getContext('2d');
  g.fillStyle = '#fff';
  g.save(); g.translate(N / 2, N / 2); g.scale(N / 128, N / 128); g.rotate(-0.09);
  g.beginPath(); g.ellipse(-1, -16, 13, 18, 0.06, 0, 7); g.fill();
  g.beginPath(); g.ellipse(3, 24, 9.5, 12, -0.05, 0, 7); g.fill();
  g.beginPath(); g.ellipse(1, 4, 8, 14, 0, 0, 7); g.fill();
  for (let i = 0; i < 5; i++) {
    const a = -1.0 + i * 0.44;
    g.beginPath(); g.arc(Math.sin(a) * 15 - 1, -37 - Math.cos(a) * 3.5 + Math.abs(a) * 6, 4.4 - Math.abs(i - 1.4) * 0.55, 0, 7); g.fill();
  }
  g.restore();
  const img = g.getImageData(0, 0, N, N).data;
  const inside = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) inside[i] = img[i * 4 + 3] > 128 ? 1 : 0;
  const bx = [], by = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    if (inside[i] !== inside[i - 1] || inside[i] !== inside[i + 1] || inside[i] !== inside[i - N] || inside[i] !== inside[i + N]) { bx.push(x); by.push(y); }
  }
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let best = 1e9;
    for (let k = 0; k < bx.length; k++) {
      const dx = x - bx[k], dy = y - by[k];
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    let d = Math.sqrt(best);
    if (inside[y * N + x]) d = -d;
    out[y * N + x] = Math.max(0, Math.min(255, Math.round((d / (N / 2)) * 127 + 128)));
  }
  return { data: out, N };
}

const MARK_STATES = ['Preview', 'Active', 'Hold', 'Success', 'Miss', 'Warning', 'Locked'];

/** 룩 스튜디오 미리보기 행 구성 — isVisible()이 true인 동안만 렌더 */
export function buildFxPreviews(host, isVisible) {
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
  const row = el('<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;"></div>');
  host.appendChild(row);
  const cell = (label, w, h) => {
    const c = el(`<div style="background:rgba(20,23,29,.85);border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center;">
      <canvas width="${w * 2}" height="${h * 2}" style="width:${w}px;height:${h}px;border-radius:6px;display:block;"></canvas>
      <div style="font-size:10px;color:var(--dim);margin-top:5px;">${label}</div></div>`);
    row.appendChild(c);
    return c.querySelector('canvas');
  };

  const burst = glCell(cell('터짐 — 열 파문', 150, 150), BURST_FRAG);
  const foot = glCell(cell('발자국 — 윤곽 파문', 150, 150), FOOT_FRAG);
  const lane = glCell(cell('레인 + 화살표', 150, 150), LANE_FRAG);
  const markCanvas = cell('MARK 판정 토큰', 150, 150);
  const mark = glCell(markCanvas, MARK_FRAG);
  // MARK 상태 칩
  const markCell = markCanvas.parentElement;
  const chips = el('<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;margin-top:5px;"></div>');
  markCell.appendChild(chips);
  let markState = 1;
  MARK_STATES.forEach((name, i) => {
    const b = el(`<button style="padding:2px 6px;border:1px solid ${i === 1 ? '#fec389' : 'var(--line)'};border-radius:99px;background:none;color:${i === 1 ? '#fec389' : 'var(--dim)'};font-size:9px;cursor:pointer;">${name}</button>`);
    b.onclick = () => {
      markState = i;
      chips.querySelectorAll('button').forEach((x, j) => {
        x.style.borderColor = i === j ? '#fec389' : 'var(--line)';
        x.style.color = i === j ? '#fec389' : 'var(--dim)';
      });
    };
    chips.appendChild(b);
  });

  // 발형 SDF 업로드 (unit 1)
  {
    const { gl } = foot;
    const { data, N } = footSDF();
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, N, N, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.useProgram(foot.pr); gl.uniform1i(foot.u('uSDF'), 1);
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!isVisible()) return;
    const lut = rebuildLUT();     // 스탑·채도 변경 즉시 반영 (256×4B — 무시 가능 비용)
    const g = FXP.graphics, m = FXP.mark;
    const T = (g.duration * 1600);
    const t = (ts % T) / T;
    burst.syncLUT(lut);
    burst.gl.uniform1f(burst.u('uT'), t);
    burst.gl.uniform1f(burst.u('uW'), g.width);
    burst.gl.uniform1f(burst.u('uHalo'), g.halo);
    burst.gl.uniform1f(burst.u('uNoise'), g.noise);
    burst.gl.uniform1f(burst.u('uEmber'), g.ember);
    burst.draw();
    foot.syncLUT(lut);
    foot.gl.uniform1f(foot.u('uT'), t);
    foot.gl.uniform1f(foot.u('uW'), g.width);
    foot.gl.uniform1f(foot.u('uHalo'), g.halo);
    foot.gl.uniform1f(foot.u('uNoise'), g.noise);
    foot.gl.uniform1f(foot.u('uEmber'), g.ember);
    foot.draw();
    lane.syncLUT(lut);
    lane.gl.uniform1f(lane.u('uTime'), ts / 1000);
    lane.gl.uniform1f(lane.u('uW'), g.width);
    lane.gl.uniform1f(lane.u('uHalo'), g.halo);
    lane.draw();
    mark.syncLUT(lut);
    mark.gl.uniform1f(mark.u('uTime'), ts / 1000);
    mark.gl.uniform1f(mark.u('uState'), markState);
    mark.gl.uniform1f(mark.u('uW'), m.core);
    mark.gl.uniform1f(mark.u('uHalo'), m.halo);
    mark.gl.uniform1f(mark.u('uPool'), m.pool);
    mark.gl.uniform1f(mark.u('uSweepA'), m.sweep);
    mark.gl.uniform1f(mark.u('uWobble'), m.wobble);
    mark.draw();
  }
  requestAnimationFrame(frame);
}
