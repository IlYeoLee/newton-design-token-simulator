(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const e of n)if(e.type==="childList")for(const s of e.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function a(n){const e={};return n.integrity&&(e.integrity=n.integrity),n.referrerPolicy&&(e.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?e.credentials="include":n.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function i(n){if(n.ep)return;n.ep=!0;const e=a(n);fetch(n.href,e)}})();function V(t,o,a,i,n){let e=0;a[0]=0,i[0]=-1e20,i[1]=1e20;for(let s=1;s<n;s++){let r=(t[s]+s*s-(t[a[e]]+a[e]*a[e]))/(2*s-2*a[e]);for(;r<=i[e];)e--,r=(t[s]+s*s-(t[a[e]]+a[e]*a[e]))/(2*s-2*a[e]);e++,a[e]=s,i[e]=r,i[e+1]=1e20}e=0;for(let s=0;s<n;s++){for(;i[e+1]<s;)e++;o[s]=(s-a[e])*(s-a[e])+t[a[e]]}}function N(t,o){const a=new Float32Array(o),i=new Int32Array(o),n=new Float32Array(o+1),e=new Float32Array(o);for(let s=0;s<o;s++){for(let r=0;r<o;r++)e[r]=t[r*o+s];V(e,a,i,n,o);for(let r=0;r<o;r++)t[r*o+s]=a[r]}for(let s=0;s<o;s++){for(let r=0;r<o;r++)e[r]=t[s*o+r];V(e,a,i,n,o);for(let r=0;r<o;r++)t[s*o+r]=a[r]}}function a0(t,o){const i=new Float32Array(o*o),n=new Float32Array(o*o);let e=0,s=0,r=0;for(let p=0;p<o*o;p++){const m=t[p*4+3]/255;i[p]=m>=1?0:m<=0?1e20:Math.pow(Math.max(0,.5-m),2),n[p]=m>=1?1e20:m<=0?0:Math.pow(Math.max(0,m-.5),2),m>.5&&(e+=p%o,s+=p/o|0,r++)}N(i,o),N(n,o);const f=new Float32Array(o*o);for(let p=0;p<o*o;p++)f[p]=(Math.sqrt(i[p])-Math.sqrt(n[p]))/o;return{data:f,N:o,cx:r?e/r/o:.5,cy:r?s/r/o:.5}}function l0(t,o=512){const a="_raster"+o;if(t[a])return t[a];const i=document.createElement("canvas");i.width=i.height=o;const n=i.getContext("2d"),e=Math.min(o/t.naturalWidth,o/t.naturalHeight);n.drawImage(t,0,0,t.naturalWidth*e,t.naturalHeight*e);const s=n.getImageData(0,0,o,o).data;let r=o,f=o,p=-1,m=-1;for(let u=0;u<o;u++)for(let l=0;l<o;l++)s[(u*o+l)*4+3]>8&&(l<r&&(r=l),l>p&&(p=l),u<f&&(f=u),u>m&&(m=u));return t[a]=p<0?{canvas:i,x:0,y:0,w:o,h:o}:{canvas:i,x:r,y:f,w:p-r+1,h:m-f+1},t[a]}function s0(t,o,a=!1){const i=l0(t,o),n=document.createElement("canvas");n.width=n.height=o;const e=n.getContext("2d"),s=Math.min(o*.78/i.w,o*.78/i.h),r=i.w*s,f=i.h*s;return a&&(e.translate(0,o),e.scale(1,-1)),e.drawImage(i.canvas,i.x,i.y,i.w,i.h,(o-r)/2,(o-f)/2,r,f),a0(e.getImageData(0,0,o,o).data,o)}const i0={RATIO:140/600,opacity(t){return t===0?.5:t===2||t===4?0:1},anchor(t,o,a){return{x:((o?1-t.x:t.x)-.5)*a,y:(.5-t.y)*a,s:t.s||1}}},J=t=>(t/=255,t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)),H=t=>(t=Math.max(0,Math.min(1,t)),Math.round(255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)));function g(t,o,a){t=J(t),o=J(o),a=J(a);const i=Math.cbrt(.4122214708*t+.5363325363*o+.0514459929*a),n=Math.cbrt(.2119034982*t+.6806995451*o+.1073969566*a),e=Math.cbrt(.0883024619*t+.2817188376*o+.6299787005*a);return[.2104542553*i+.793617785*n-.0040720468*e,1.9779984951*i-2.428592205*n+.4505937099*e,.0259040371*i+.7827717662*n-.808675766*e]}function n0(t,o,a){const i=(t+.3963377774*o+.2158037573*a)**3,n=(t-.1055613458*o-.0638541728*a)**3,e=(t-.0894841775*o-1.291485548*a)**3;return[H(4.0767416621*i-3.3077115913*n+.2309699292*e),H(-1.2684380046*i+2.6097574011*n-.3413193965*e),H(-.0041960863*i-.7034186147*n+1.707614701*e)]}const t0=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)];function c0(t,o=1,a=new Uint8Array(256*4)){const i=[...t].sort((n,e)=>n[1]-e[1]);for(let n=0;n<256;n++){const e=n/255;let s=0;for(;s<i.length-2&&e>i[s+1][1];)s++;const[r,f]=i[s],[p,m]=i[s+1],u=Math.max(0,Math.min(1,(e-f)/Math.max(1e-5,m-f))),l=g(...t0(r)),h=g(...t0(p)),d=n0(l[0]+(h[0]-l[0])*u,(l[1]+(h[1]-l[1])*u)*o,(l[2]+(h[2]-l[2])*u)*o);a.set([...d,255],n*4)}return a}const h0=`
uniform float uRadius, uPool, uContract, uShape, uSeed;
uniform sampler2D uSDF2, uSDFWarn;
#define C_RED   vec3(0.980, 0.188, 0.188)
#define C_CORAL vec3(0.996, 0.431, 0.235)
#define C_SAND  vec3(0.996, 0.765, 0.537)
#define C_CREAM vec3(0.996, 0.886, 0.776)
#define C_ICE   vec3(0.820, 0.996, 1.000)
#define C_GRAYF vec3(0.925, 0.925, 0.925)
#define C_GRAYL vec3(0.816, 0.816, 0.816)
#define C_RIMG  vec3(0.816, 0.804, 0.800)
#define C_WINE  vec3(0.318, 0.094, 0.082)
#define C_BRICK vec3(0.718, 0.212, 0.184)
#define C_EXCL  vec3(0.933, 0.157, 0.153)
float mkUndul(float ang, float t){
  return sin(ang*2.0 + t*1.1)*0.45 + sin(ang*3.0 - t*0.73 + 1.7)*0.33 + sin(ang*5.0 + t*0.41 + 4.2)*0.22;
}
// 일반화 부호 거리 — 존 원 / 발형이 같은 상태 머신을 공유 (1.9922 = float SDF 디코드 정본 계수)
float mkSD(vec2 p, float u1){
  if (uShape < 0.5) return length(p) * (1.0 + u1 * uNoise * 0.04) - 0.46 * uRadius;
  vec2 suv = p * 0.5 + 0.5;
  return texture2D(uSDF2, vec2(suv.x, 1.0 - suv.y)).r * 1.9922 / max(uRadius, 0.3) + u1 * uNoise * 0.02;
}
// OKLab 지각 보간 — RGB mix는 중간톤이 회색으로 죽어 '종이 자르듯 턱턱'(유저). OKLab은 채도 유지하며 부드럽게.
// (buildLUT의 rgb2ok/ok2rgb와 동일 규약: 입력을 그대로 OKLab으로 — LUT와 색 일관)
vec3 _l2ok(vec3 c){
  float l=0.4122214708*c.r+0.5363325363*c.g+0.0514459929*c.b;
  float m=0.2119034982*c.r+0.6806995451*c.g+0.1073969566*c.b;
  float s=0.0883024619*c.r+0.2817188376*c.g+0.6299787005*c.b;
  l=pow(max(l,0.0),0.33333333); m=pow(max(m,0.0),0.33333333); s=pow(max(s,0.0),0.33333333);
  return vec3(0.2104542553*l+0.7936177850*m-0.0040720468*s,
              1.9779984951*l-2.4285922050*m+0.4505937099*s,
              0.0259040371*l+0.7827717662*m-0.8086757660*s);
}
vec3 _ok2l(vec3 lab){
  float l=lab.x+0.3963377774*lab.y+0.2158037573*lab.z;
  float m=lab.x-0.1055613458*lab.y-0.0638541728*lab.z;
  float s=lab.x-0.0894841775*lab.y-1.2914855480*lab.z;
  l=l*l*l; m=m*m*m; s=s*s*s;
  return vec3(4.0767416621*l-3.3077115913*m+0.2309699292*s,
             -1.2684380046*l+2.6097574011*m-0.3413193965*s,
             -0.0041960863*l-0.7034186147*m+1.7076147010*s);
}
vec3 okmix(vec3 a, vec3 b, float t){ return _ok2l(mix(_l2ok(a), _l2ok(b), t)); }
vec3 fillPreview(float q){ return okmix(C_CORAL, C_SAND, smoothstep(0.0, 0.733, q)); }
vec3 fillHot(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.0, 0.45, q));
  return okmix(c, C_SAND, smoothstep(0.45, 1.0, q));
}
vec3 fillActive(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.0, 0.479, q));
  c = okmix(c, C_SAND, smoothstep(0.479, 0.607, q));
  return okmix(c, C_ICE, smoothstep(0.607, 0.750, q));
}
vec3 fillHold(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.0, 0.23, q));
  return okmix(c, C_SAND, smoothstep(0.23, 1.0, q));
}
vec3 fillSuccess(float q){
  vec3 c = okmix(C_RED, C_CORAL, smoothstep(0.47, 0.70, q));
  c = okmix(c, C_SAND, smoothstep(0.70, 0.843, q));
  return okmix(c, C_ICE, smoothstep(0.843, 0.931, q));
}
// over 연산 누적 (premultiplied) — 원본 mix(col, X, k) 체인의 기계적 등가 변환
void lay(inout vec4 A, vec3 X, float k){ A.rgb = A.rgb * (1.0 - k) + X * k; A.a = A.a * (1.0 - k) + k; }
vec4 markState(vec2 uv, float state, float prog, float strong, float t){
  float ang = atan(uv.y, uv.x);
  float a01 = fract(0.25 - ang / 6.2832);      // 12시 기준 시계방향
  float u1 = mkUndul(ang + uSeed, t * 1.6);
  float sd = mkSD(uv, u1);
  float aa = max(fwidth(sd), 0.004) * 1.4;     // 화면공간 AA
  float inside = smoothstep(aa, -aa, sd);
  float outPos = max(sd, 0.0);
  // 점선 = 회피 계약 (일렁임과 분리한 저주기 — '털 뜯김' 방지 확정판)
  float dashM = (uContract > 0.5 && uContract < 1.5)
              ? smoothstep(0.30, 0.60, 0.5 + 0.5 * sin(ang * 10.0)) : 1.0;
  float ext = uShape < 0.5 ? 0.46 * uRadius : 0.72;
  vec2 gcBall = uShape < 0.5 ? vec2(0.0) : vec2(0.0, 0.20);
  vec2 gcHeel = uShape < 0.5 ? vec2(0.0, -0.5 * ext) : vec2(0.0, -0.32);
  vec4 A = vec4(0.0);
  float fillGain = clamp(uPool * 1.6, 0.0, 1.35);

  if (state < 0.5) {            // ── Preview: 아웃라인 → 소프트 필 차오름 (strong=라이브 '다음' 적열 강조)
    float f = prog;
    float breath = 1.0 + 0.05 * sin(t * 2.0) * (0.4 + uNoise);
    // 중심 핫스팟 완화(유저 재지적: 가운데 원 또렷) — 하한↑ + 폴오프 넓혀 부드러운 전이(하드 원 제거)
    float q = 0.36 + 0.64 * length(uv - gcBall) / (ext * 1.18 * breath);
    vec3 fillCol = mix(C_CREAM, mix(fillPreview(q), fillHot(q), strong), f);
    float fillA = mix(0.42, 0.82, f) * fillGain;
    lay(A, fillCol, fillA * inside);
    float ow = 0.016 * uW;
    float stroke = exp(-pow(sd / ow, 2.0)) * dashM;
    lay(A, C_SAND, stroke * (0.95 - 0.62 * f));
  } else if (state < 1.5) {     // ── Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 타이밍)
    float gradR = uShape < 0.5 ? ext * 1.75 : 2.15;   // 폴오프 넓힘 = 중앙 적열 원 완화(유저)
    float q = 0.34 + 0.66 * length(uv - gcBall) / gradR;   // 중심 하한↑ — 적열이 은은하게 퍼짐
    q *= 1.0 + 0.025 * sin(t * 3.1 + q * 5.0) * uNoise;
    lay(A, fillActive(q), inside * min(fillGain * 1.15, 1.0));
    float hw = max((0.115 - 0.075 * prog) * uW, 0.018);
    float h = exp(-pow(outPos / hw, 1.3)) * (1.0 - inside);
    vec3 hCol = mix(C_SAND, C_ICE, smoothstep(0.15, 0.9, outPos / hw));
    lay(A, hCol, h * uHalo * (0.50 + 0.14 * sin(t * 5.0)) * dashM);
  } else if (state < 2.5) {     // ── Hold: 코닉 진행 림 + 열이 뒤꿈치로 고임
    float pr = prog;
    vec2 gc = mix(gcBall, gcHeel, pr);
    float q = length(uv - gc) / (ext * 1.02);
    float qh = max(q - 0.24 * pr, 0.0);
    lay(A, fillHold(qh), inside * min(fillGain, 1.0) * 0.95);
    float distToRim = abs(sd - 0.012);
    float fw = max(fwidth(sd), 1e-5);
    // 림 폭: 카탈로그 20px(고정 캔버스) ≡ 실루엣 비례 sd 0.03 — 화면 크기가 가변인
    // 라이브에서도 같은 비율. 원거리 앨리어싱만 fwidth 하한.
    float rimW = max(0.03 * uW, 1.5 * fw);
    float rim = (1.0 - smoothstep(0.0, rimW, distToRim)) * dashM;
    float angDist = a01 - pr; angDist -= floor(angDist + 0.5);   // 랩어라운드 제거
    float pgo = smoothstep(0.09, -0.09, angDist);
    vec3 arcCol = mix(C_RED, C_CORAL, clamp(a01 / max(pr, 0.001), 0.0, 1.0));
    lay(A, mix(C_RIMG, arcCol, pgo), rim * mix(0.42, 0.92, pgo));
    // 진행 선단 = 밝은 '시계 바늘' — 12시서 시계방향으로 도는 게 명확히 읽히게(유저: 타이머처럼 싹)
    float head = smoothstep(0.05, 0.0, abs(angDist)) * step(0.01, pr) * step(pr, 0.995);
    lay(A, C_CREAM, rim * head * 0.95);
  } else if (state < 3.5) {     // ── Success: 진홍 블룸 → 잔상 소멸
    float e = 1.0 - pow(1.0 - prog, 2.6);
    float q = length(uv - gcBall) / (uShape < 0.5 ? ext * 1.3 : 1.75);
    float fillA = (prog < 0.4 ? 1.0 : pow(1.0 - (prog - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    lay(A, fillSuccess(q / (0.55 + 0.55 * e)), inside * fillA);
    float flash = exp(-prog * 9.0);
    lay(A, C_ICE, exp(-pow(abs(sd) / (0.02 * uW), 2.0)) * flash * 0.8);
  } else if (state < 4.5) {     // ── Miss: 온기가 식어 회색 고스트 → 무음 소멸
    float cool = smoothstep(0.0, 0.4, prog);
    float gone = pow(1.0 - max(prog - 0.45, 0.0) / 0.55, 1.6);
    float q = length(uv - gcBall) / ext;
    lay(A, mix(fillPreview(q), C_GRAYF, cool), inside * mix(0.55, 0.24, cool) * gone * fillGain);
    lay(A, mix(C_SAND, C_GRAYL, cool), exp(-pow(sd / (0.014 * uW), 2.0)) * 0.85 * gone);
  } else if (state < 5.5) {     // ── Warning: 암적 리니어 + 느낌표(유저 SVG) 점멸
    float ly = clamp(0.5 - uv.y / (2.2 * ext), 0.0, 1.0);
    lay(A, mix(C_WINE, C_BRICK, ly), inside * min(fillGain * 1.05, 1.0));
    float wScale = 0.44 * ext;
    vec2 wuv = uv / wScale * 0.5 + 0.5;
    float wSD = texture2D(uSDFWarn, vec2(wuv.x, 1.0 - wuv.y)).r * (2.0 * wScale);
    float aaW = max(fwidth(wSD), 0.0015);
    float exM = smoothstep(aaW, -aaW, wSD) * inside;
    lay(A, C_EXCL * 1.25, exM * (0.85 + 0.15 * sin(t * 5.5)));
  } else {                       // ── Locked: 회색 아웃라인 + (숫자는 호스트 오버레이)
    lay(A, C_GRAYF, inside * 0.30 * fillGain);
    lay(A, C_GRAYL, exp(-pow(sd / (0.015 * uW), 2.0)) * 0.8 * dashM);
  }
  return A;
}`;function r0(t,o,a,i){t.lineWidth=4*o;const n=i.arrow;n.line==="dash"?t.setLineDash([12*o*n.gap,10*n.gap]):n.line==="dot"?(t.setLineDash([.5,12*n.gap]),t.lineCap="round",t.lineWidth=5*o):t.setLineDash([]),a!=null&&n.line!=="solid"&&n.line!=="taper"&&(t.lineDashOffset=-a*40*n.speed)}function d0(t,o,a,i,n,e={}){const s=n.lut,r=n.arrow||{},f=r.w??1,p=r.speed??1,m=r.glow??1,u=e.pulse??1,l=a/256,h=o/2,d=i*.9*p%1,A=e.prog!=null?Math.max(0,Math.min(1,e.prog)):Math.min(1,d/.55),S=e.prog!=null?1:d>.88?(1-d)/.12:1;t.clearRect(0,0,o,a);const w=S*(.45+.55*u),c=a-24*l,M=58*l,v=c+(M-c)*A,b=(_,D)=>s(_).replace("rgb(","rgba(").replace(")",`,${D.toFixed(3)})`),C=1.1*l*f,y=13*l*f,k=t.createLinearGradient(0,c,0,v);if(k.addColorStop(0,b(.55,0)),k.addColorStop(.1,b(.64,.45*w)),k.addColorStop(.32,b(.76,.85*w)),k.addColorStop(.62,b(.88,.98*w)),k.addColorStop(1,b(.97,w)),t.globalAlpha=1,t.fillStyle=k,t.beginPath(),t.moveTo(h-C/2,c),t.lineTo(h+C/2,c),t.lineTo(h+y/2,v),t.lineTo(h-y/2,v),t.closePath(),t.fill(),t.globalAlpha=w,A>.28&&!e.noTip){const _=34*l*(.7+.3*f),D=Math.min(1,(A-.28)/.22)*w,T=v+_*.3;t.globalAlpha=D;const B={color:s(.95),glowColor:s(.85),glow:12*m};n.glyph&&(n.glyph(t,"LIFT_TIP",h,T,_,B)||n.glyph(t,"TIP_TRI",h,T,_*.93,B))||(t.strokeStyle=s(.95),t.lineWidth=13*l*f,t.lineCap="round",t.lineJoin="round",t.shadowColor=s(.9),t.shadowBlur=18*l*m,t.beginPath(),t.moveTo(h-26*l,T+14*l),t.lineTo(h,T-16*l),t.lineTo(h+26*l,T+14*l),t.stroke())}t.globalAlpha=1,t.shadowBlur=0}function f0(t,o,a,i,n,e,s={}){const r=e.lut,f=e.arrow||{},p=f.w??1,m=f.glow??1,u=a/256;t.clearRect(0,0,o,a);const l=i.map(([c,M])=>[c*o,M*a]);if(l.length<2)return;const h=48,d=[],A=c=>{if(l.length===2)return[l[0][0]+(l[1][0]-l[0][0])*c,l[0][1]+(l[1][1]-l[0][1])*c];const M=c*(l.length-1),v=Math.min(l.length-2,Math.floor(M)),b=M-v,C=l[Math.max(0,v-1)],y=l[v],k=l[v+1],_=l[Math.min(l.length-1,v+2)],D=(T,B,I,F)=>.5*(2*B+(-T+I)*b+(2*T-5*B+4*I-F)*b*b+(-T+3*B-3*I+F)*b*b*b);return[D(C[0],y[0],k[0],_[0]),D(C[1],y[1],k[1],_[1])]};for(let c=0;c<=h;c++)d.push(A(c/h));const S=Math.max(0,Math.min(1,s.prog!=null?s.prog:n*.55%1)),w=Math.max(1,Math.round(h*S));t.lineCap="round";for(let c=1;c<=w;c++){const M=c/w;t.globalAlpha=Math.pow(M,1.5),t.strokeStyle=r(.45+.5*M),t.lineWidth=(1.6+3.2*M)*u*p,t.beginPath(),t.moveTo(d[c-1][0],d[c-1][1]),t.lineTo(d[c][0],d[c][1]),t.stroke()}if(S>.25){const c=d[w][0],M=d[w][1],v=d[Math.max(0,w-2)][0],b=d[Math.max(0,w-2)][1],C=Math.atan2(M-b,c-v)+Math.PI/2,y=30*u*(.7+.3*p);t.save(),t.translate(c,M),t.rotate(C),t.globalAlpha=Math.min(1,(S-.25)/.2);const k={color:r(.95),glowColor:r(.85),glow:12*m};e.glyph&&(e.glyph(t,"LIFT_TIP",0,0,y,k)||e.glyph(t,"TIP_TRI",0,0,y*.93,k))||(t.strokeStyle=r(.95),t.lineWidth=9*u*p,t.lineJoin="round",t.lineCap="round",t.beginPath(),t.moveTo(-18*u,12*u),t.lineTo(0,-14*u),t.lineTo(18*u,12*u),t.stroke()),t.restore()}t.globalAlpha=1}function o0(t,o,a,i,n,e){n=n||{};const s=e.lut,r=n.style||e.arrow.line,f=!!n.closed,p=[0];for(let h=1;h<o.length;h++)p.push(p[h-1]+Math.hypot(o[h][0]-o[h-1][0],o[h][1]-o[h-1][1]));const m=p[p.length-1]||1,u=h=>{h=(h%m+m)%m;let d=1;for(;d<p.length-1&&p[d]<h;)d++;const A=(h-p[d-1])/Math.max(1e-4,p[d]-p[d-1]);return[o[d-1][0]+(o[d][0]-o[d-1][0])*A,o[d-1][1]+(o[d][1]-o[d-1][1])*A,Math.atan2(o[d][1]-o[d-1][1],o[d][0]-o[d-1][0])]},l=e.arrow;if(r==="chevron"){const h=(26*i+8)*l.gap,d=Math.max(2,Math.floor(m/h));t.shadowColor=s(Math.min(1,l.heat+.2)),t.shadowBlur=8*i*l.glow;for(let A=0;A<d;A++){const S=A*h+a*42*l.speed%h;if(!f&&S>m-4)continue;const[w,c,M]=u(S),v=7.5*i,b=8.5*i,C=.45+.4*Math.sin(S/m*6.283-a*2.2*l.speed);t.strokeStyle=s(l.heat-.05+C*.3),t.lineWidth=3.2*i,t.lineJoin="round",t.lineCap="round",t.save(),t.translate(w,c),t.rotate(M),t.beginPath(),t.moveTo(-b*.5,-v),t.lineTo(b*.5,0),t.lineTo(-b*.5,v),t.stroke(),t.restore()}return!0}if(r==="comet"){const h=a*.35*l.speed%1*m,d=m*l.tail,A=Math.max(24,o.length*2);t.lineCap="round";for(let c=0;c<A;c++){const M=h-c/A*d,v=h-(c+1)/A*d;if(!f&&v<0)break;const b=1-c/A,[C,y]=u(M),[k,_]=u(v);!f&&Math.hypot(k-C,_-y)>m*.4||(t.globalAlpha=Math.pow(b,1.6),t.strokeStyle=s(Math.max(.05,l.heat-.2)+b*.55),t.lineWidth=(1.5+b*4.5)*i,b>.72?(t.shadowColor=s(Math.min(1,l.heat+.3)),t.shadowBlur=b*12*i*l.glow):t.shadowBlur=0,t.beginPath(),t.moveTo(C,y),t.lineTo(k,_),t.stroke())}t.globalAlpha=1,t.lineCap="butt",t.shadowBlur=0;const[S,w]=u(h);return t.fillStyle="rgba(255,243,220,0.95)",t.shadowColor=s(.9),t.shadowBlur=16*i,t.beginPath(),t.arc(S,w,2.6*i,0,7),t.fill(),t.shadowBlur=0,!0}if(t.strokeStyle=n.color||s(l.heat),t.shadowColor=s(Math.min(1,l.heat+.15)),t.shadowBlur=(n.glow??8)*i*l.glow,r==="taper")for(let h=1;h<o.length;h++)t.lineWidth=(.5+h/o.length*4.5)*i,t.beginPath(),t.moveTo(o[h-1][0],o[h-1][1]),t.lineTo(o[h][0],o[h][1]),t.stroke();else r0(t,i,a,e),t.beginPath(),o.forEach(([h,d],A)=>A?t.lineTo(h,d):t.moveTo(h,d)),f&&t.closePath(),t.stroke();return t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,t.shadowBlur=0,!0}function u0(t,o,a,i,n,e){const s=13*i.halo,r=e.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const f=o/220,p=o/2,m=18*a.round*f,u=40*f,l=48*f,h=o-80*f,d=o-96*f,A=[],S=(c,M,v,b)=>{for(let C=0;C<=1;C+=.12)A.push([c+(v-c)*C,M+(b-M)*C])};S(u+m,l,u+h-m,l),S(u+h,l+m,u+h,l+d-m),S(u+h-m,l+d,u+m,l+d),S(u,l+d-m,u,l+m),t.shadowColor=r(.6),t.shadowBlur=s*.8;const w=4*e.arrow.w*f;e.arrow.line==="solid"?(t.setLineDash([10*a.dash*f,8*f]),t.lineDashOffset=-n*22*f,t.strokeStyle=r(.45),t.lineWidth=w,t.beginPath(),t.roundRect(u,l,h,d,m),t.stroke(),t.setLineDash([]),t.lineDashOffset=0):o0(t,A,n,e.arrow.w*f,{color:r(.45),closed:!0},e),a.feet>.05&&e.foot&&(e.foot(t,!1,p-16*a.feet*f,p+6*f,26*a.feet*f),e.foot(t,!0,p+16*a.feet*f,p+6*f,26*a.feet*f)),t.shadowBlur=0}function p0(t,o,a,i,n,e,s,r){const f=13*i.halo,p=4*e.arrow.w*(o/220),m=e.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const u=o/220,l=s||[[45*u,130*u],[110*u,60*u],[175*u,110*u]],h=r??n*.5%1,d=Math.min(1,h*1.25)*(l.length-1),A=Math.min(l.length-1,Math.floor(d+.35));t.shadowColor=m(.7),t.shadowBlur=f;const S=[[l[0][0],l[0][1]]];for(let w=1;w<=l.length-1;w++){const c=Math.max(0,Math.min(1,d-(w-1)));if(c<=0)break;S.push([l[w-1][0]+(l[w][0]-l[w-1][0])*c,l[w-1][1]+(l[w][1]-l[w-1][1])*c])}S.length>1&&o0(t,S,n,e.arrow.w*u,{color:m(.62)},e),t.setLineDash([4*u,7*u]),t.lineDashOffset=0,t.globalAlpha=.3,t.strokeStyle=m(.45),t.lineWidth=p,t.beginPath(),l.forEach(([w,c],M)=>M?t.lineTo(w,c):t.moveTo(w,c)),t.stroke(),t.globalAlpha=1,t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,l.forEach(([w,c],M)=>{const v=M===A,b=v?1+Math.sin(n*6)*.14:1;t.strokeStyle=m(v?.8:.45),t.lineWidth=p*(v?1.3:.9),t.shadowBlur=v?f*1.6:f*.6,t.beginPath(),t.arc(w,c,12*a.node*b*u,0,Math.PI*2),t.stroke(),e.num&&(t.globalAlpha=M<=A?1:.45,e.num(t,String(M+1),w,c,16*a.numS*b*u,Math.round(14*a.numS*u)),t.globalAlpha=1)}),t.shadowBlur=0}function m0(t,o,a,i,n,e,s){const r=e.lut,f=13*i.halo,p=o/220,m=o/2,u=e.arrow&&e.arrow.w||1,l=(C,y)=>r(C).replace("rgb(","rgba(").replace(")",`,${y})`);t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const h=(a.r!=null?a.r:.42)*o,d=h*(a.rt!=null?a.rt:.36),A=3.4*u*p,S=s!=null?Math.max(0,Math.min(1,s)):n*(a.tempo||.6)%1,w=Math.pow(S,1.6),c=Math.max(0,(S-.9)/.1);t.save(),t.translate(m,m);const M=(C,y,k,_=1)=>{if(C<=.6)return;const D=A*2.6*_,T=Math.max(.1,C-D),B=C+D,I=t.createRadialGradient(0,0,T,0,0,B);I.addColorStop(0,l(y-.05,0)),I.addColorStop(.5,l(y,k*.85)),I.addColorStop(1,l(y-.05,0)),t.globalAlpha=1,t.fillStyle=I,t.shadowBlur=0,t.beginPath(),t.arc(0,0,B,0,Math.PI*2),t.fill(),t.globalAlpha=Math.min(1,k*1.1),t.lineWidth=A*.85,t.strokeStyle=r(Math.min(.98,y+.12)),t.shadowColor=r(.88),t.shadowBlur=f*.6,t.beginPath(),t.arc(0,0,C,0,Math.PI*2),t.stroke(),t.shadowBlur=0},v=t.createRadialGradient(0,0,0,0,0,d*1.08);v.addColorStop(0,l(.6,.1+.18*c)),v.addColorStop(.65,l(.5,.05+.08*c)),v.addColorStop(1,l(.5,0)),t.globalAlpha=1,t.fillStyle=v,t.beginPath(),t.arc(0,0,d*1.08,0,Math.PI*2),t.fill();const b=1+.02*Math.sin(n*2.6);M(d*b,.55+.4*c,.5+.45*c,.9);for(let C=2;C>=0;C--){const y=Math.pow(Math.max(0,S-C*.05),1.6),k=h-(h-d)*y,_=C===0?.6+.4*w:.18/C*(1-c);M(k,.55+.4*w,_*(1-c*.45),1.15-.35*w)}c>.01&&M(d*(1+1.4*c),.9,(1-c)*.8,1.1),t.globalAlpha=.6+.3*c,t.shadowColor=r(.85),t.shadowBlur=f*(.9+c),t.fillStyle=r(.62+.3*c),t.beginPath(),t.arc(0,0,A*.85+3*p*c,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}function w0(t,o,a,i,n,e,s,r){const f=e.lut,p=13*i.halo,m=o/220,u=o/2,l=e.arrow&&e.arrow.w||1,h=l*m,d=(x,R)=>f(x).replace("rgb(","rgba(").replace(")",","+R+")");t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const A=o*.42*(a.spread!=null?a.spread:1),w=(r||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([x,R])=>[u+x*A,u+R*A]),c=80,M=[];for(let x=0;x<=c;x++){const R=x/c*(w.length-1),L=Math.min(w.length-2,Math.floor(R)),P=R-L,G=w[Math.max(0,L-1)],O=w[L],Q=w[L+1],Z=w[Math.min(w.length-1,L+2)],z=(K,W,U,E)=>.5*(2*W+(-K+U)*P+(2*K-5*W+4*U-E)*P*P+(-K+3*W-3*U+E)*P*P*P);M.push([z(G[0],O[0],Q[0],Z[0]),z(G[1],O[1],Q[1],Z[1])])}const v=x=>{const R=Math.max(0,Math.min(c,x*c)),L=Math.floor(R),P=R-L,G=M[L],O=M[Math.min(c,L+1)];return[G[0]+(O[0]-G[0])*P,G[1]+(O[1]-G[1])*P]},b=.68;let C,y,k;if(s!=null)C=Math.max(0,Math.min(1,s)),y=1,k=0;else{const x=n*(a.tempo||.42)%1;if(x<b)C=x/b,y=1,k=0;else{const R=(x-b)/(1-b);C=1,y=1-R*R,k=R}}if(y<=.012)return;const _=C*C*C*(C*(6*C-15)+10),D=Math.min(1,16*C*C*(1-C)*(1-C));a.taper!=null&&a.taper;const T=.36*(a.tail!=null?a.tail:1),B=a.width!=null?a.width:1;{const x=t.createLinearGradient(M[0][0],M[0][1],M[c][0],M[c][1]);x.addColorStop(0,d(.46,0)),x.addColorStop(.3,d(.46,.03*y)),x.addColorStop(.8,d(.46,.045*y)),x.addColorStop(1,d(.46,0)),t.globalAlpha=1,t.strokeStyle=x,t.lineWidth=9*h,t.shadowColor=f(.6),t.shadowBlur=p*2,t.beginPath(),M.forEach(([R,L],P)=>P?t.lineTo(R,L):t.moveTo(R,L)),t.stroke(),t.shadowBlur=0}const I=40,F=Math.max(0,_-T*(1-k)),q=[];for(let x=0;x<=I;x++)q.push(v(F+(_-F)*(x/I)));const Y=()=>{t.beginPath(),q.forEach(([x,R],L)=>L?t.lineTo(x,R):t.moveTo(x,R)),t.stroke()},X=()=>{const x=t.createLinearGradient(q[0][0],q[0][1],q[I][0],q[I][1]);return x.addColorStop(0,d(.55,0)),x.addColorStop(.4,d(.56,0)),x.addColorStop(.68,d(.6,.09)),x.addColorStop(.88,d(.64,.24)),x.addColorStop(1,d(.68,.44)),x},e0=1+.5*D;t.globalAlpha=y,t.strokeStyle=X(),t.lineWidth=(20+10*D)*h*B,t.shadowColor=f(.72),t.shadowBlur=p*2.2,Y(),t.strokeStyle=X(),t.lineWidth=(10+5*D)*h*B,t.shadowBlur=p*1,Y(),t.shadowBlur=0;for(let x=1;x<=I;x++){const R=x/I;t.globalAlpha=Math.pow(R,2.2)*.95*y,t.strokeStyle=f(.55+.38*R),t.lineWidth=(1.6+6.5*Math.pow(R,.7))*h*B*e0,t.beginPath(),t.moveTo(q[x-1][0],q[x-1][1]),t.lineTo(q[x][0],q[x][1]),t.stroke()}const j=q[I][0],$=q[I][1];t.globalAlpha=.8*y,t.fillStyle=f(.6),t.shadowColor=f(.8),t.shadowBlur=p*1.6,t.beginPath(),t.arc(j,$,(9+5*D)*h*B,0,Math.PI*2),t.fill(),t.globalAlpha=y,t.fillStyle=f(.93),t.shadowBlur=p*.6,t.beginPath(),t.arc(j,$,(3.4+1.8*D)*h*B,0,Math.PI*2),t.fill(),t.globalAlpha=1,t.shadowBlur=0}function C0(t,o,a,i,n,e,s){const r=e.lut,f=13*i.halo,p=o/220,m=o/2,u=e.arrow&&e.arrow.w||1;t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const l=(a.r!=null?a.r:.3)*o,h=a.width!=null?a.width:1,d=4.2*u*p*h,A=a.dir!=null?a.dir:1,S=(a.sweep!=null?a.sweep:.66)*Math.PI*2,w=s!=null?Math.max(0,Math.min(1,s)):n*(a.tempo||.5)%1,c=-Math.PI/2+A*w*Math.PI*2;t.save(),t.translate(m,m),t.globalAlpha=.16,t.lineWidth=d*.7,t.strokeStyle=r(.44),t.shadowColor=r(.6),t.shadowBlur=f*.4,t.beginPath(),t.arc(0,0,l,0,Math.PI*2),t.stroke(),t.shadowBlur=0;const M=16;for(let D=0;D<M;D++){const T=D/(M-1),B=c-A*T*S,I=c-A*(T+1.2/M)*S;t.globalAlpha=(1-T)*.9,t.strokeStyle=r(.55+.35*(1-T)),t.lineWidth=d*(.55+.55*(1-T)),t.shadowColor=r(.8),t.shadowBlur=f*(.4+.5*(1-T)),t.beginPath(),t.arc(0,0,l,Math.min(B,I),Math.max(B,I),!1),t.stroke()}t.shadowBlur=0;const v=Math.cos(c)*l,b=Math.sin(c)*l,C=c+A*Math.PI/2,y=8*p*h;t.save(),t.translate(v,b),t.rotate(C+Math.PI/2),t.globalAlpha=1;const k=3.4*y*(.7+.3*u),_={color:r(.96),glowColor:r(.9),glow:f*1.2};e.glyph&&(e.glyph(t,"LIFT_TIP",0,0,k,_)||e.glyph(t,"TIP_TRI",0,0,k*.93,_))||(t.rotate(-Math.PI/2),t.strokeStyle=r(.96),t.lineWidth=d*.9,t.shadowColor=r(.9),t.shadowBlur=f*1.2,t.beginPath(),t.moveTo(-y,-y*.9),t.lineTo(y*.5,0),t.lineTo(-y,y*.9),t.stroke()),t.restore(),t.globalAlpha=.62,t.shadowColor=r(.75),t.shadowBlur=f*.6,t.fillStyle=r(.6),t.beginPath(),t.arc(0,0,d*.6,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}export{h0 as M,p0 as a,s0 as b,m0 as c,u0 as d,w0 as e,C0 as f,c0 as g,d0 as h,l0 as i,o0 as j,i0 as k,f0 as l,a0 as s};
