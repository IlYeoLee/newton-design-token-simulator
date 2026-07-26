(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))n(l);new MutationObserver(l=>{for(const e of l)if(e.type==="childList")for(const s of e.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function a(l){const e={};return l.integrity&&(e.integrity=l.integrity),l.referrerPolicy&&(e.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?e.credentials="include":l.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function n(l){if(l.ep)return;l.ep=!0;const e=a(l);fetch(l.href,e)}})();function V(t,o,a,n,l){let e=0;a[0]=0,n[0]=-1e20,n[1]=1e20;for(let s=1;s<l;s++){let r=(t[s]+s*s-(t[a[e]]+a[e]*a[e]))/(2*s-2*a[e]);for(;r<=n[e];)e--,r=(t[s]+s*s-(t[a[e]]+a[e]*a[e]))/(2*s-2*a[e]);e++,a[e]=s,n[e]=r,n[e+1]=1e20}e=0;for(let s=0;s<l;s++){for(;n[e+1]<s;)e++;o[s]=(s-a[e])*(s-a[e])+t[a[e]]}}function N(t,o){const a=new Float32Array(o),n=new Int32Array(o),l=new Float32Array(o+1),e=new Float32Array(o);for(let s=0;s<o;s++){for(let r=0;r<o;r++)e[r]=t[r*o+s];V(e,a,n,l,o);for(let r=0;r<o;r++)t[r*o+s]=a[r]}for(let s=0;s<o;s++){for(let r=0;r<o;r++)e[r]=t[s*o+r];V(e,a,n,l,o);for(let r=0;r<o;r++)t[s*o+r]=a[r]}}function a0(t,o){const n=new Float32Array(o*o),l=new Float32Array(o*o);let e=0,s=0,r=0;for(let u=0;u<o*o;u++){const d=t[u*4+3]/255;n[u]=d>=1?0:d<=0?1e20:Math.pow(Math.max(0,.5-d),2),l[u]=d>=1?1e20:d<=0?0:Math.pow(Math.max(0,d-.5),2),d>.5&&(e+=u%o,s+=u/o|0,r++)}N(n,o),N(l,o);const h=new Float32Array(o*o);for(let u=0;u<o*o;u++)h[u]=(Math.sqrt(n[u])-Math.sqrt(l[u]))/o;return{data:h,N:o,cx:r?e/r/o:.5,cy:r?s/r/o:.5}}function l0(t,o=512){const a="_raster"+o;if(t[a])return t[a];const n=document.createElement("canvas");n.width=n.height=o;const l=n.getContext("2d"),e=Math.min(o/t.naturalWidth,o/t.naturalHeight);l.drawImage(t,0,0,t.naturalWidth*e,t.naturalHeight*e);const s=l.getImageData(0,0,o,o).data;let r=o,h=o,u=-1,d=-1;for(let m=0;m<o;m++)for(let i=0;i<o;i++)s[(m*o+i)*4+3]>8&&(i<r&&(r=i),i>u&&(u=i),m<h&&(h=m),m>d&&(d=m));return t[a]=u<0?{canvas:n,x:0,y:0,w:o,h:o}:{canvas:n,x:r,y:h,w:u-r+1,h:d-h+1},t[a]}function r0(t,o,a=!1){const n=l0(t,o),l=document.createElement("canvas");l.width=l.height=o;const e=l.getContext("2d"),s=Math.min(o*.78/n.w,o*.78/n.h),r=n.w*s,h=n.h*s;return a&&(e.translate(0,o),e.scale(1,-1)),e.drawImage(n.canvas,n.x,n.y,n.w,n.h,(o-r)/2,(o-h)/2,r,h),a0(e.getImageData(0,0,o,o).data,o)}const i0={RATIO:140/600,opacity(t){return t===0?.5:t===2||t===4?0:1},anchor(t,o,a){return{x:((o?1-t.x:t.x)-.5)*a,y:(.5-t.y)*a,s:t.s||1}}},K=t=>(t/=255,t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)),W=t=>(t=Math.max(0,Math.min(1,t)),Math.round(255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)));function g(t,o,a){t=K(t),o=K(o),a=K(a);const n=Math.cbrt(.4122214708*t+.5363325363*o+.0514459929*a),l=Math.cbrt(.2119034982*t+.6806995451*o+.1073969566*a),e=Math.cbrt(.0883024619*t+.2817188376*o+.6299787005*a);return[.2104542553*n+.793617785*l-.0040720468*e,1.9779984951*n-2.428592205*l+.4505937099*e,.0259040371*n+.7827717662*l-.808675766*e]}function n0(t,o,a){const n=(t+.3963377774*o+.2158037573*a)**3,l=(t-.1055613458*o-.0638541728*a)**3,e=(t-.0894841775*o-1.291485548*a)**3;return[W(4.0767416621*n-3.3077115913*l+.2309699292*e),W(-1.2684380046*n+2.6097574011*l-.3413193965*e),W(-.0041960863*n-.7034186147*l+1.707614701*e)]}const t0=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)];function c0(t,o=1,a=new Uint8Array(256*4)){const n=[...t].sort((l,e)=>l[1]-e[1]);for(let l=0;l<256;l++){const e=l/255;let s=0;for(;s<n.length-2&&e>n[s+1][1];)s++;const[r,h]=n[s],[u,d]=n[s+1],m=Math.max(0,Math.min(1,(e-h)/Math.max(1e-5,d-h))),i=g(...t0(r)),c=g(...t0(u)),f=n0(i[0]+(c[0]-i[0])*m,(i[1]+(c[1]-i[1])*m)*o,(i[2]+(c[2]-i[2])*m)*o);a.set([...f,255],l*4)}return a}const h0=`
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
}`;function s0(t,o,a,n){t.lineWidth=4*o;const l=n.arrow;l.line==="dash"?t.setLineDash([12*o*l.gap,10*l.gap]):l.line==="dot"?(t.setLineDash([.5,12*l.gap]),t.lineCap="round",t.lineWidth=5*o):t.setLineDash([]),a!=null&&l.line!=="solid"&&l.line!=="taper"&&(t.lineDashOffset=-a*40*l.speed)}function o0(t,o,a,n,l,e){l=l||{};const s=e.lut,r=l.style||e.arrow.line,h=!!l.closed,u=[0];for(let c=1;c<o.length;c++)u.push(u[c-1]+Math.hypot(o[c][0]-o[c-1][0],o[c][1]-o[c-1][1]));const d=u[u.length-1]||1,m=c=>{c=(c%d+d)%d;let f=1;for(;f<u.length-1&&u[f]<c;)f++;const b=(c-u[f-1])/Math.max(1e-4,u[f]-u[f-1]);return[o[f-1][0]+(o[f][0]-o[f-1][0])*b,o[f-1][1]+(o[f][1]-o[f-1][1])*b,Math.atan2(o[f][1]-o[f-1][1],o[f][0]-o[f-1][0])]},i=e.arrow;if(r==="chevron"){const c=(26*n+8)*i.gap,f=Math.max(2,Math.floor(d/c));t.shadowColor=s(Math.min(1,i.heat+.2)),t.shadowBlur=8*n*i.glow;for(let b=0;b<f;b++){const k=b*c+a*42*i.speed%c;if(!h&&k>d-4)continue;const[x,p,y]=m(k),S=7.5*n,v=8.5*n,w=.45+.4*Math.sin(k/d*6.283-a*2.2*i.speed);t.strokeStyle=s(i.heat-.05+w*.3),t.lineWidth=3.2*n,t.lineJoin="round",t.lineCap="round",t.save(),t.translate(x,p),t.rotate(y),t.beginPath(),t.moveTo(-v*.5,-S),t.lineTo(v*.5,0),t.lineTo(-v*.5,S),t.stroke(),t.restore()}return!0}if(r==="comet"){const c=a*.35*i.speed%1*d,f=d*i.tail,b=Math.max(24,o.length*2);t.lineCap="round";for(let p=0;p<b;p++){const y=c-p/b*f,S=c-(p+1)/b*f;if(!h&&S<0)break;const v=1-p/b,[w,M]=m(y),[R,_]=m(S);!h&&Math.hypot(R-w,_-M)>d*.4||(t.globalAlpha=Math.pow(v,1.6),t.strokeStyle=s(Math.max(.05,i.heat-.2)+v*.55),t.lineWidth=(1.5+v*4.5)*n,v>.72?(t.shadowColor=s(Math.min(1,i.heat+.3)),t.shadowBlur=v*12*n*i.glow):t.shadowBlur=0,t.beginPath(),t.moveTo(w,M),t.lineTo(R,_),t.stroke())}t.globalAlpha=1,t.lineCap="butt",t.shadowBlur=0;const[k,x]=m(c);return t.fillStyle="rgba(255,243,220,0.95)",t.shadowColor=s(.9),t.shadowBlur=16*n,t.beginPath(),t.arc(k,x,2.6*n,0,7),t.fill(),t.shadowBlur=0,!0}if(t.strokeStyle=l.color||s(i.heat),t.shadowColor=s(Math.min(1,i.heat+.15)),t.shadowBlur=(l.glow??8)*n*i.glow,r==="taper")for(let c=1;c<o.length;c++)t.lineWidth=(.5+c/o.length*4.5)*n,t.beginPath(),t.moveTo(o[c-1][0],o[c-1][1]),t.lineTo(o[c][0],o[c][1]),t.stroke();else s0(t,n,a,e),t.beginPath(),o.forEach(([c,f],b)=>b?t.lineTo(c,f):t.moveTo(c,f)),h&&t.closePath(),t.stroke();return t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,t.shadowBlur=0,!0}function f0(t,o,a,n,l,e){const s=13*n.halo,r=e.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const h=o/220,u=o/2,d=18*a.round*h,m=40*h,i=48*h,c=o-80*h,f=o-96*h,b=[],k=(p,y,S,v)=>{for(let w=0;w<=1;w+=.12)b.push([p+(S-p)*w,y+(v-y)*w])};k(m+d,i,m+c-d,i),k(m+c,i+d,m+c,i+f-d),k(m+c-d,i+f,m+d,i+f),k(m,i+f-d,m,i+d),t.shadowColor=r(.6),t.shadowBlur=s*.8;const x=4*e.arrow.w*h;e.arrow.line==="solid"?(t.setLineDash([10*a.dash*h,8*h]),t.lineDashOffset=-l*22*h,t.strokeStyle=r(.45),t.lineWidth=x,t.beginPath(),t.roundRect(m,i,c,f,d),t.stroke(),t.setLineDash([]),t.lineDashOffset=0):o0(t,b,l,e.arrow.w*h,{color:r(.45),closed:!0},e),a.feet>.05&&e.foot&&(e.foot(t,!1,u-16*a.feet*h,u+6*h,26*a.feet*h),e.foot(t,!0,u+16*a.feet*h,u+6*h,26*a.feet*h)),t.shadowBlur=0}function u0(t,o,a,n,l,e,s,r){const h=13*n.halo,u=4*e.arrow.w*(o/220),d=e.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const m=o/220,i=s||[[45*m,130*m],[110*m,60*m],[175*m,110*m]],c=r??l*.5%1,f=Math.min(1,c*1.25)*(i.length-1),b=Math.min(i.length-1,Math.floor(f+.35));t.shadowColor=d(.7),t.shadowBlur=h;const k=[[i[0][0],i[0][1]]];for(let x=1;x<=i.length-1;x++){const p=Math.max(0,Math.min(1,f-(x-1)));if(p<=0)break;k.push([i[x-1][0]+(i[x][0]-i[x-1][0])*p,i[x-1][1]+(i[x][1]-i[x-1][1])*p])}k.length>1&&o0(t,k,l,e.arrow.w*m,{color:d(.62)},e),t.setLineDash([4*m,7*m]),t.lineDashOffset=0,t.globalAlpha=.3,t.strokeStyle=d(.45),t.lineWidth=u,t.beginPath(),i.forEach(([x,p],y)=>y?t.lineTo(x,p):t.moveTo(x,p)),t.stroke(),t.globalAlpha=1,t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,i.forEach(([x,p],y)=>{const S=y===b,v=S?1+Math.sin(l*6)*.14:1;t.strokeStyle=d(S?.8:.45),t.lineWidth=u*(S?1.3:.9),t.shadowBlur=S?h*1.6:h*.6,t.beginPath(),t.arc(x,p,12*a.node*v*m,0,Math.PI*2),t.stroke(),e.num&&(t.globalAlpha=y<=b?1:.45,e.num(t,String(y+1),x,p,16*a.numS*v*m,Math.round(14*a.numS*m)),t.globalAlpha=1)}),t.shadowBlur=0}function d0(t,o,a,n,l,e,s){const r=e.lut,h=13*n.halo,u=o/220,d=o/2,m=e.arrow&&e.arrow.w||1,i=(w,M)=>r(w).replace("rgb(","rgba(").replace(")",`,${M})`);t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const c=(a.r!=null?a.r:.42)*o,f=c*(a.rt!=null?a.rt:.36),b=3.4*m*u,k=s!=null?Math.max(0,Math.min(1,s)):l*(a.tempo||.6)%1,x=Math.pow(k,1.6),p=Math.max(0,(k-.9)/.1);t.save(),t.translate(d,d);const y=(w,M,R,_=1)=>{if(w<=.6)return;const I=b*2.6*_,O=Math.max(.1,w-I),G=w+I,D=t.createRadialGradient(0,0,O,0,0,G);D.addColorStop(0,i(M-.05,0)),D.addColorStop(.5,i(M,R*.85)),D.addColorStop(1,i(M-.05,0)),t.globalAlpha=1,t.fillStyle=D,t.shadowBlur=0,t.beginPath(),t.arc(0,0,G,0,Math.PI*2),t.fill(),t.globalAlpha=Math.min(1,R*1.1),t.lineWidth=b*.85,t.strokeStyle=r(Math.min(.98,M+.12)),t.shadowColor=r(.88),t.shadowBlur=h*.6,t.beginPath(),t.arc(0,0,w,0,Math.PI*2),t.stroke(),t.shadowBlur=0},S=t.createRadialGradient(0,0,0,0,0,f*1.08);S.addColorStop(0,i(.6,.1+.18*p)),S.addColorStop(.65,i(.5,.05+.08*p)),S.addColorStop(1,i(.5,0)),t.globalAlpha=1,t.fillStyle=S,t.beginPath(),t.arc(0,0,f*1.08,0,Math.PI*2),t.fill();const v=1+.02*Math.sin(l*2.6);y(f*v,.55+.4*p,.5+.45*p,.9);for(let w=2;w>=0;w--){const M=Math.pow(Math.max(0,k-w*.05),1.6),R=c-(c-f)*M,_=w===0?.6+.4*x:.18/w*(1-p);y(R,.55+.4*x,_*(1-p*.45),1.15-.35*x)}p>.01&&y(f*(1+1.4*p),.9,(1-p)*.8,1.1),t.globalAlpha=.6+.3*p,t.shadowColor=r(.85),t.shadowBlur=h*(.9+p),t.fillStyle=r(.62+.3*p),t.beginPath(),t.arc(0,0,b*.85+3*u*p,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}function m0(t,o,a,n,l,e,s,r){const h=e.lut,u=13*n.halo,d=o/220,m=o/2,i=e.arrow&&e.arrow.w||1,c=i*d,f=(C,A)=>h(C).replace("rgb(","rgba(").replace(")",","+A+")");t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const b=o*.42*(a.spread!=null?a.spread:1),x=(r||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([C,A])=>[m+C*b,m+A*b]),p=80,y=[];for(let C=0;C<=p;C++){const A=C/p*(x.length-1),B=Math.min(x.length-2,Math.floor(A)),q=A-B,T=x[Math.max(0,B-1)],P=x[B],$=x[B+1],Q=x[Math.min(x.length-1,B+2)],Z=(F,H,U,z)=>.5*(2*H+(-F+U)*q+(2*F-5*H+4*U-z)*q*q+(-F+3*H-3*U+z)*q*q*q);y.push([Z(T[0],P[0],$[0],Q[0]),Z(T[1],P[1],$[1],Q[1])])}const S=C=>{const A=Math.max(0,Math.min(p,C*p)),B=Math.floor(A),q=A-B,T=y[B],P=y[Math.min(p,B+1)];return[T[0]+(P[0]-T[0])*q,T[1]+(P[1]-T[1])*q]},v=.68;let w,M,R;if(s!=null)w=Math.max(0,Math.min(1,s)),M=1,R=0;else{const C=l*(a.tempo||.42)%1;if(C<v)w=C/v,M=1,R=0;else{const A=(C-v)/(1-v);w=1,M=1-A*A,R=A}}if(M<=.012)return;const _=w*w*w*(w*(6*w-15)+10),I=Math.min(1,16*w*w*(1-w)*(1-w));a.taper!=null&&a.taper;const O=.36*(a.tail!=null?a.tail:1),G=a.width!=null?a.width:1;t.globalAlpha=.045*M,t.strokeStyle=h(.46),t.lineWidth=9*c,t.shadowColor=h(.6),t.shadowBlur=u*2,t.beginPath(),y.forEach(([C,A],B)=>B?t.lineTo(C,A):t.moveTo(C,A)),t.stroke(),t.shadowBlur=0;const D=40,J=Math.max(0,_-O*(1-R)),L=[];for(let C=0;C<=D;C++)L.push(S(J+(_-J)*(C/D)));const Y=()=>{t.beginPath(),L.forEach(([C,A],B)=>B?t.lineTo(C,A):t.moveTo(C,A)),t.stroke()},E=()=>{const C=t.createLinearGradient(L[0][0],L[0][1],L[D][0],L[D][1]);return C.addColorStop(0,f(.55,0)),C.addColorStop(.45,f(.58,.05)),C.addColorStop(.82,f(.62,.18)),C.addColorStop(1,f(.68,.4)),C},e0=1+.5*I;t.globalAlpha=M,t.strokeStyle=E(),t.lineWidth=(20+10*I)*c*G,t.shadowColor=h(.72),t.shadowBlur=u*2.2,Y(),t.strokeStyle=E(),t.lineWidth=(10+5*I)*c*G,t.shadowBlur=u*1,Y(),t.shadowBlur=0;for(let C=1;C<=D;C++){const A=C/D;t.globalAlpha=Math.pow(A,1.35)*.95*M,t.strokeStyle=h(.55+.38*A),t.lineWidth=(1.6+6.5*Math.pow(A,.7))*c*G*e0,t.beginPath(),t.moveTo(L[C-1][0],L[C-1][1]),t.lineTo(L[C][0],L[C][1]),t.stroke()}const X=L[D][0],j=L[D][1];t.globalAlpha=.8*M,t.fillStyle=h(.6),t.shadowColor=h(.8),t.shadowBlur=u*1.6,t.beginPath(),t.arc(X,j,(9+5*I)*c*G,0,Math.PI*2),t.fill(),t.globalAlpha=M,t.fillStyle=h(.93),t.shadowBlur=u*.6,t.beginPath(),t.arc(X,j,(3.4+1.8*I)*c*G,0,Math.PI*2),t.fill(),t.globalAlpha=1,t.shadowBlur=0}function p0(t,o,a,n,l,e,s){const r=e.lut,h=13*n.halo,u=o/220,d=o/2,m=e.arrow&&e.arrow.w||1;t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const i=(a.r!=null?a.r:.3)*o,c=a.width!=null?a.width:1,f=4.2*m*u*c,b=a.dir!=null?a.dir:1,k=(a.sweep!=null?a.sweep:.66)*Math.PI*2,x=s!=null?Math.max(0,Math.min(1,s)):l*(a.tempo||.5)%1,p=-Math.PI/2+b*x*Math.PI*2;t.save(),t.translate(d,d),t.globalAlpha=.16,t.lineWidth=f*.7,t.strokeStyle=r(.44),t.shadowColor=r(.6),t.shadowBlur=h*.4,t.beginPath(),t.arc(0,0,i,0,Math.PI*2),t.stroke(),t.shadowBlur=0;const y=16;for(let R=0;R<y;R++){const _=R/(y-1),I=p-b*_*k,O=p-b*(_+1.2/y)*k;t.globalAlpha=(1-_)*.9,t.strokeStyle=r(.55+.35*(1-_)),t.lineWidth=f*(.55+.55*(1-_)),t.shadowColor=r(.8),t.shadowBlur=h*(.4+.5*(1-_)),t.beginPath(),t.arc(0,0,i,Math.min(I,O),Math.max(I,O),!1),t.stroke()}t.shadowBlur=0;const S=Math.cos(p)*i,v=Math.sin(p)*i,w=p+b*Math.PI/2;t.save(),t.translate(S,v),t.rotate(w),t.globalAlpha=1,t.strokeStyle=r(.96),t.lineWidth=f*.9,t.shadowColor=r(.9),t.shadowBlur=h*1.2;const M=8*u*c;t.beginPath(),t.moveTo(-M,-M*.9),t.lineTo(M*.5,0),t.lineTo(-M,M*.9),t.stroke(),t.restore(),t.globalAlpha=.62,t.shadowColor=r(.75),t.shadowBlur=h*.6,t.fillStyle=r(.6),t.beginPath(),t.arc(0,0,f*.6,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}export{h0 as M,u0 as a,r0 as b,d0 as c,f0 as d,m0 as e,p0 as f,c0 as g,l0 as h,o0 as i,s0 as j,i0 as k,a0 as s};
