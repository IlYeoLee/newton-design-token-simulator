(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const e of n)if(e.type==="childList")for(const s of e.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function a(n){const e={};return n.integrity&&(e.integrity=n.integrity),n.referrerPolicy&&(e.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?e.credentials="include":n.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function i(n){if(n.ep)return;n.ep=!0;const e=a(n);fetch(n.href,e)}})();const q={red:"#FA3030",coral:"#FE6E3C",sand:"#FEC389",prism:"#D1FEFF"},$={ink:"#FFFFFF",inkDark:"#0A0A0A",hi:"#ECECEC",lo:"#D0D0D0",paper:"#FAFAFA",surface:"#F2F2F2",t1:"#3B3B3B",t2:"#757575",t3:"#525252"},lt=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)],pt=Object.fromEntries(Object.entries({...q,...$}).map(([t,o])=>[t,parseInt(o.slice(1),16)])),O=t=>`vec3(${lt(t).map(a=>(a/255).toFixed(4)).join(", ")})`,mt=(t,o=1)=>`rgba(${lt(t).join(",")},${o})`,st=[[q.red,0],[q.red,.3],[q.coral,.56],[q.sand,.86],[q.prism,1]],it=1;function ct(t){const o=String(t).toUpperCase();return/^#([0-9A-F])\1\1\1\1\1$/.test(o)||Object.values($).some(a=>a.toUpperCase()===o)?!0:Object.values(q).some(a=>a.toUpperCase()===o)}function wt(t){return t&&((!Array.isArray(t.stops)||!t.stops.every(([a])=>ct(a)))&&(t.stops=st.map(a=>[...a])),t.sat=it,t)}function tt(t,o,a,i,n){let e=0;a[0]=0,i[0]=-1e20,i[1]=1e20;for(let s=1;s<n;s++){let r=(t[s]+s*s-(t[a[e]]+a[e]*a[e]))/(2*s-2*a[e]);for(;r<=i[e];)e--,r=(t[s]+s*s-(t[a[e]]+a[e]*a[e]))/(2*s-2*a[e]);e++,a[e]=s,i[e]=r,i[e+1]=1e20}e=0;for(let s=0;s<n;s++){for(;i[e+1]<s;)e++;o[s]=(s-a[e])*(s-a[e])+t[a[e]]}}function ot(t,o){const a=new Float32Array(o),i=new Int32Array(o),n=new Float32Array(o+1),e=new Float32Array(o);for(let s=0;s<o;s++){for(let r=0;r<o;r++)e[r]=t[r*o+s];tt(e,a,i,n,o);for(let r=0;r<o;r++)t[r*o+s]=a[r]}for(let s=0;s<o;s++){for(let r=0;r<o;r++)e[r]=t[s*o+r];tt(e,a,i,n,o);for(let r=0;r<o;r++)t[s*o+r]=a[r]}}function ht(t,o){const i=new Float32Array(o*o),n=new Float32Array(o*o);let e=0,s=0,r=0;for(let p=0;p<o*o;p++){const m=t[p*4+3]/255;i[p]=m>=1?0:m<=0?1e20:Math.pow(Math.max(0,.5-m),2),n[p]=m>=1?1e20:m<=0?0:Math.pow(Math.max(0,m-.5),2),m>.5&&(e+=p%o,s+=p/o|0,r++)}ot(i,o),ot(n,o);const f=new Float32Array(o*o);for(let p=0;p<o*o;p++)f[p]=(Math.sqrt(i[p])-Math.sqrt(n[p]))/o;return{data:f,N:o,cx:r?e/r/o:.5,cy:r?s/r/o:.5}}function dt(t,o=512){const a="_raster"+o;if(t[a])return t[a];const i=document.createElement("canvas");i.width=i.height=o;const n=i.getContext("2d"),e=Math.min(o/t.naturalWidth,o/t.naturalHeight);n.drawImage(t,0,0,t.naturalWidth*e,t.naturalHeight*e);const s=n.getImageData(0,0,o,o).data;let r=o,f=o,p=-1,m=-1;for(let u=0;u<o;u++)for(let l=0;l<o;l++)s[(u*o+l)*4+3]>8&&(l<r&&(r=l),l>p&&(p=l),u<f&&(f=u),u>m&&(m=u));return t[a]=p<0?{canvas:i,x:0,y:0,w:o,h:o}:{canvas:i,x:r,y:f,w:p-r+1,h:m-f+1},t[a]}function Ct(t,o,a=!1){const i=dt(t,o),n=document.createElement("canvas");n.width=n.height=o;const e=n.getContext("2d"),s=Math.min(o*.78/i.w,o*.78/i.h),r=i.w*s,f=i.h*s;return a&&(e.translate(0,o),e.scale(1,-1)),e.drawImage(i.canvas,i.x,i.y,i.w,i.h,(o-r)/2,(o-f)/2,r,f),ht(e.getImageData(0,0,o,o).data,o)}const xt={RATIO:140/600,opacity(t){return t===0?.5:t===2||t===4?0:1},anchor(t,o,a){return{x:((o?1-t.x:t.x)-.5)*a,y:(.5-t.y)*a,s:t.s||1}}},H=t=>(t/=255,t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)),J=t=>(t=Math.max(0,Math.min(1,t)),Math.round(255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)));function et(t,o,a){t=H(t),o=H(o),a=H(a);const i=Math.cbrt(.4122214708*t+.5363325363*o+.0514459929*a),n=Math.cbrt(.2119034982*t+.6806995451*o+.1073969566*a),e=Math.cbrt(.0883024619*t+.2817188376*o+.6299787005*a);return[.2104542553*i+.793617785*n-.0040720468*e,1.9779984951*i-2.428592205*n+.4505937099*e,.0259040371*i+.7827717662*n-.808675766*e]}function ft(t,o,a){const i=(t+.3963377774*o+.2158037573*a)**3,n=(t-.1055613458*o-.0638541728*a)**3,e=(t-.0894841775*o-1.291485548*a)**3;return[J(4.0767416621*i-3.3077115913*n+.2309699292*e),J(-1.2684380046*i+2.6097574011*n-.3413193965*e),J(-.0041960863*i-.7034186147*n+1.707614701*e)]}const at=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)];function At(t,o=1,a=new Uint8Array(256*4)){const i=[...t].sort((n,e)=>n[1]-e[1]);for(let n=0;n<256;n++){const e=n/255;let s=0;for(;s<i.length-2&&e>i[s+1][1];)s++;const[r,f]=i[s],[p,m]=i[s+1],u=Math.max(0,Math.min(1,(e-f)/Math.max(1e-5,m-f))),l=et(...at(r)),h=et(...at(p)),d=ft(l[0]+(h[0]-l[0])*u,(l[1]+(h[1]-l[1])*u)*o,(l[2]+(h[2]-l[2])*u)*o);a.set([...d,255],n*4)}return a}const Mt=`
#define P_GAMMA 1.38    // 온도 곡선 — 어두운 부위를 더 깊게
#define P_GAIN  0.96    // LUT 상단 여유(순백 방지)
#define P_SAT   1.32    // 룩시스템 '쟁한' 고채도
#define P_LO    0.22    // 인물이 앉는 온도 대역 — 이 밖으로 나가면 팩마다 색이 갈린다
#define P_HI    0.86
vec3 personColor(float T){
  float t = P_LO + clamp(T, 0.0, 1.0) * (P_HI - P_LO);   // 공용 대역으로 정규화
  t = pow(t, P_GAMMA) * P_GAIN;
  vec3 c = lut(clamp(t, 0.0, 1.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, P_SAT), 0.0, 1.0);
}`,bt=`
uniform float uRadius, uPool, uContract, uShape, uSeed;
uniform sampler2D uSDF2, uSDFWarn;
// 색 = src/palette.js 단일 소스. 유채는 4색뿐(규칙 ①), 무채는 상태 부호(규칙 ②).
//   은퇴: C_CREAM(#FEE2C6 — 팔레트에 없던 9번째 색) → SAND
//         C_WINE·C_BRICK(암적) → SAND·CORAL  (유저: 워닝에 어두운색 금지)
//         C_EXCL(#EE2827) → RED · C_RIMG(미세 웜그레이) → 무채 lo 로 통합
#define C_RED   ${O(q.red)}
#define C_CORAL ${O(q.coral)}
#define C_SAND  ${O(q.sand)}
#define C_ICE   ${O(q.prism)}
#define C_CREAM C_SAND
#define C_GRAYF ${O($.hi)}
#define C_GRAYL ${O($.lo)}
#define C_RIMG  C_GRAYL
#define C_WINE  C_SAND
#define C_BRICK C_CORAL
#define C_EXCL  C_RED
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
  // ★ GLSL pow(x,y) 는 x<0 에서 정의되지 않는다(대개 NaN). 아래 Success·Miss 분기는
  //   pow(1.0 - prog, ...) · pow(1.0 - (prog-0.4)/0.6, ...) 처럼 prog 로 밑을 만든다.
  //   구동자가 prog 를 1 을 아주 살짝 넘겨 주면(1.0000002) 밑이 음수 → NaN 이 나오고,
  //   NaN 은 색·알파를 타고 흘러 판 전체를 rgba(0,0,0,255) 로 만든다.
  //   야간(가산)에선 0 이 더해져 안 보이지만, 주간 잉크(NormalBlending)에선 알파가 채워져
  //   그 자리를 통째로 검게 지운다 — 유저가 다섯 번 신고한 '드리블 중 검정 판'의 실체.
  prog = clamp(prog, 0.0, 1.0);
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
    float stroke = exp(-pow(abs(sd) / max(ow, 1e-4), 2.0)) * dashM;
    lay(A, C_SAND, stroke * (0.95 - 0.62 * f));
  } else if (state < 1.5) {     // ── Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 타이밍)
    float gradR = uShape < 0.5 ? ext * 1.75 : 2.15;   // 폴오프 넓힘 = 중앙 적열 원 완화(유저)
    float q = 0.34 + 0.66 * length(uv - gcBall) / gradR;   // 중심 하한↑ — 적열이 은은하게 퍼짐
    q *= 1.0 + 0.025 * sin(t * 3.1 + q * 5.0) * uNoise;
    lay(A, fillActive(q), inside * min(fillGain * 1.15, 1.0));
    float hw = max((0.115 - 0.075 * prog) * uW, 0.018);
    float h = exp(-pow(outPos / max(hw, 1e-4), 1.3)) * (1.0 - inside);
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
    lay(A, C_ICE, exp(-pow(abs(sd) / max(0.02 * uW, 1e-4), 2.0)) * flash * 0.8);
  } else if (state < 4.5) {     // ── Miss: 온기가 식어 회색 고스트 → 무음 소멸
    float cool = smoothstep(0.0, 0.4, prog);
    float gone = pow(1.0 - max(prog - 0.45, 0.0) / 0.55, 1.6);
    float q = length(uv - gcBall) / ext;
    lay(A, mix(fillPreview(q), C_GRAYF, cool), inside * mix(0.55, 0.24, cool) * gone * fillGain);
    lay(A, mix(C_SAND, C_GRAYL, cool), exp(-pow(abs(sd) / max(0.014 * uW, 1e-4), 2.0)) * 0.85 * gone);
  } else if (state < 5.5) {     // ── Warning: 사구→코랄 리니어 + 느낌표 점멸 (유저: 어두운색 금지 → 암적 폐기)
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
    lay(A, C_GRAYL, exp(-pow(abs(sd) / max(0.015 * uW, 1e-4), 2.0)) * 0.8 * dashM);
  }
  // NaN 스크럽 — 위 분기 어디서든 비정상 값이 새면 '보이지 않음'으로 떨어뜨린다.
  //   NaN 과의 비교는 항상 false 이므로 step() 이 0 을 골라 준다(GLSL ES 1.0 에서 신뢰 가능한 유일한 방법).
  //   투사 UI 는 가산광이라 '없음'이 안전한 기본값이다 — 검은 판보다 백 배 낫다.
  A *= step(vec4(-1.0), A) * step(A, vec4(1e6));
  return A;
}`;function ut(t,o,a,i){t.lineWidth=4*o;const n=i.arrow;n.line==="dash"?t.setLineDash([12*o*n.gap,10*n.gap]):n.line==="dot"?(t.setLineDash([.5,12*n.gap]),t.lineCap="round",t.lineWidth=5*o):t.setLineDash([]),a!=null&&n.line!=="solid"&&n.line!=="taper"&&(t.lineDashOffset=-a*40*n.speed)}function yt(t,o,a,i,n,e={}){const s=n.lut,r=n.arrow||{},f=r.w??1,p=r.speed??1,m=r.glow??1,u=e.pulse??1,l=a/256,h=o/2,d=i*.9*p%1,y=e.prog!=null?Math.max(0,Math.min(1,e.prog)):Math.min(1,d/.55),v=e.prog!=null?1:d>.88?(1-d)/.12:1;t.clearRect(0,0,o,a);const w=v*(.45+.55*u),c=a-24*l,x=58*l,S=c+(x-c)*y,M=(R,L)=>s(R).replace("rgb(","rgba(").replace(")",`,${L.toFixed(3)})`),C=1.1*l*f,b=13*l*f,k=t.createLinearGradient(0,c,0,S);if(k.addColorStop(0,M(.55,0)),k.addColorStop(.1,M(.64,.45*w)),k.addColorStop(.32,M(.76,.85*w)),k.addColorStop(.62,M(.88,.98*w)),k.addColorStop(1,M(.97,w)),t.globalAlpha=1,t.fillStyle=k,t.beginPath(),t.moveTo(h-C/2,c),t.lineTo(h+C/2,c),t.lineTo(h+b/2,S),t.lineTo(h-b/2,S),t.closePath(),t.fill(),t.globalAlpha=w,y>.28&&!e.noTip){const R=34*l*(.7+.3*f),L=Math.min(1,(y-.28)/.22)*w,D=S+R*.3;t.globalAlpha=L;const T={color:s(.95),glowColor:s(.85),glow:12*m};n.glyph&&(n.glyph(t,"LIFT_TIP",h,D,R,T)||n.glyph(t,"TIP_TRI",h,D,R*.93,T))||(t.strokeStyle=s(.95),t.lineWidth=13*l*f,t.lineCap="round",t.lineJoin="round",t.shadowColor=s(.9),t.shadowBlur=18*l*m,t.beginPath(),t.moveTo(h-26*l,D+14*l),t.lineTo(h,D-16*l),t.lineTo(h+26*l,D+14*l),t.stroke())}t.globalAlpha=1,t.shadowBlur=0}function St(t,o,a,i,n,e,s={}){const r=e.lut,f=e.arrow||{},p=f.w??1,m=f.glow??1,u=a/256;t.clearRect(0,0,o,a);const l=i.map(([c,x])=>[c*o,x*a]);if(l.length<2)return;const h=48,d=[],y=c=>{if(l.length===2)return[l[0][0]+(l[1][0]-l[0][0])*c,l[0][1]+(l[1][1]-l[0][1])*c];const x=c*(l.length-1),S=Math.min(l.length-2,Math.floor(x)),M=x-S,C=l[Math.max(0,S-1)],b=l[S],k=l[S+1],R=l[Math.min(l.length-1,S+2)],L=(D,T,I,U)=>.5*(2*T+(-D+I)*M+(2*D-5*T+4*I-U)*M*M+(-D+3*T-3*I+U)*M*M*M);return[L(C[0],b[0],k[0],R[0]),L(C[1],b[1],k[1],R[1])]};for(let c=0;c<=h;c++)d.push(y(c/h));const v=Math.max(0,Math.min(1,s.prog!=null?s.prog:n*.55%1)),w=Math.max(1,Math.round(h*v));t.lineCap="round";for(let c=1;c<=w;c++){const x=c/w;t.globalAlpha=Math.pow(x,1.5),t.strokeStyle=r(.45+.5*x),t.lineWidth=(1.6+3.2*x)*u*p,t.beginPath(),t.moveTo(d[c-1][0],d[c-1][1]),t.lineTo(d[c][0],d[c][1]),t.stroke()}if(v>.25){const c=d[w][0],x=d[w][1],S=d[Math.max(0,w-2)][0],M=d[Math.max(0,w-2)][1],C=Math.atan2(x-M,c-S)+Math.PI/2,b=30*u*(.7+.3*p);t.save(),t.translate(c,x),t.rotate(C),t.globalAlpha=Math.min(1,(v-.25)/.2);const k={color:r(.95),glowColor:r(.85),glow:12*m};e.glyph&&(e.glyph(t,"LIFT_TIP",0,0,b,k)||e.glyph(t,"TIP_TRI",0,0,b*.93,k))||(t.strokeStyle=r(.95),t.lineWidth=9*u*p,t.lineJoin="round",t.lineCap="round",t.beginPath(),t.moveTo(-18*u,12*u),t.lineTo(0,-14*u),t.lineTo(18*u,12*u),t.stroke()),t.restore()}t.globalAlpha=1}function nt(t,o,a,i,n,e){n=n||{};const s=e.lut,r=n.style||e.arrow.line,f=!!n.closed,p=[0];for(let h=1;h<o.length;h++)p.push(p[h-1]+Math.hypot(o[h][0]-o[h-1][0],o[h][1]-o[h-1][1]));const m=p[p.length-1]||1,u=h=>{h=(h%m+m)%m;let d=1;for(;d<p.length-1&&p[d]<h;)d++;const y=(h-p[d-1])/Math.max(1e-4,p[d]-p[d-1]);return[o[d-1][0]+(o[d][0]-o[d-1][0])*y,o[d-1][1]+(o[d][1]-o[d-1][1])*y,Math.atan2(o[d][1]-o[d-1][1],o[d][0]-o[d-1][0])]},l=e.arrow;if(r==="chevron"){const h=(26*i+8)*l.gap,d=Math.max(2,Math.floor(m/h));t.shadowColor=s(Math.min(1,l.heat+.2)),t.shadowBlur=8*i*l.glow;for(let y=0;y<d;y++){const v=y*h+a*42*l.speed%h;if(!f&&v>m-4)continue;const[w,c,x]=u(v),S=7.5*i,M=8.5*i,C=.45+.4*Math.sin(v/m*6.283-a*2.2*l.speed);t.strokeStyle=s(l.heat-.05+C*.3),t.lineWidth=3.2*i,t.lineJoin="round",t.lineCap="round",t.save(),t.translate(w,c),t.rotate(x),t.beginPath(),t.moveTo(-M*.5,-S),t.lineTo(M*.5,0),t.lineTo(-M*.5,S),t.stroke(),t.restore()}return!0}if(r==="comet"){const h=a*.35*l.speed%1*m,d=m*l.tail,y=Math.max(24,o.length*2);t.lineCap="round";for(let c=0;c<y;c++){const x=h-c/y*d,S=h-(c+1)/y*d;if(!f&&S<0)break;const M=1-c/y,[C,b]=u(x),[k,R]=u(S);!f&&Math.hypot(k-C,R-b)>m*.4||(t.globalAlpha=Math.pow(M,1.6),t.strokeStyle=s(Math.max(.05,l.heat-.2)+M*.55),t.lineWidth=(1.5+M*4.5)*i,M>.72?(t.shadowColor=s(Math.min(1,l.heat+.3)),t.shadowBlur=M*12*i*l.glow):t.shadowBlur=0,t.beginPath(),t.moveTo(C,b),t.lineTo(k,R),t.stroke())}t.globalAlpha=1,t.lineCap="butt",t.shadowBlur=0;const[v,w]=u(h);return t.fillStyle=rgba($.ink,.95),t.shadowColor=s(.9),t.shadowBlur=16*i,t.beginPath(),t.arc(v,w,2.6*i,0,7),t.fill(),t.shadowBlur=0,!0}if(t.strokeStyle=n.color||s(l.heat),t.shadowColor=s(Math.min(1,l.heat+.15)),t.shadowBlur=(n.glow??8)*i*l.glow,r==="taper")for(let h=1;h<o.length;h++)t.lineWidth=(.5+h/o.length*4.5)*i,t.beginPath(),t.moveTo(o[h-1][0],o[h-1][1]),t.lineTo(o[h][0],o[h][1]),t.stroke();else ut(t,i,a,e),t.beginPath(),o.forEach(([h,d],y)=>y?t.lineTo(h,d):t.moveTo(h,d)),f&&t.closePath(),t.stroke();return t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,t.shadowBlur=0,!0}function vt(t,o,a,i,n,e){const s=13*i.halo,r=e.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const f=o/220,p=o/2,m=18*a.round*f,u=40*f,l=48*f,h=o-80*f,d=o-96*f,y=[],v=(c,x,S,M)=>{for(let C=0;C<=1;C+=.12)y.push([c+(S-c)*C,x+(M-x)*C])};v(u+m,l,u+h-m,l),v(u+h,l+m,u+h,l+d-m),v(u+h-m,l+d,u+m,l+d),v(u,l+d-m,u,l+m),t.shadowColor=r(.6),t.shadowBlur=s*.8;const w=4*e.arrow.w*f;e.arrow.line==="solid"?(t.setLineDash([10*a.dash*f,8*f]),t.lineDashOffset=-n*22*f,t.strokeStyle=r(.45),t.lineWidth=w,t.beginPath(),t.roundRect(u,l,h,d,m),t.stroke(),t.setLineDash([]),t.lineDashOffset=0):nt(t,y,n,e.arrow.w*f,{color:r(.45),closed:!0},e),a.feet>.05&&e.foot&&(e.foot(t,!1,p-16*a.feet*f,p+6*f,26*a.feet*f),e.foot(t,!0,p+16*a.feet*f,p+6*f,26*a.feet*f)),t.shadowBlur=0}function kt(t,o,a,i,n,e,s,r){const f=13*i.halo,p=4*e.arrow.w*(o/220),m=e.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const u=o/220,l=s||[[45*u,130*u],[110*u,60*u],[175*u,110*u]],h=r??n*.5%1,d=Math.min(1,h*1.25)*(l.length-1),y=Math.min(l.length-1,Math.floor(d+.35));t.shadowColor=m(.7),t.shadowBlur=f;const v=[[l[0][0],l[0][1]]];for(let w=1;w<=l.length-1;w++){const c=Math.max(0,Math.min(1,d-(w-1)));if(c<=0)break;v.push([l[w-1][0]+(l[w][0]-l[w-1][0])*c,l[w-1][1]+(l[w][1]-l[w-1][1])*c])}v.length>1&&nt(t,v,n,e.arrow.w*u,{color:m(.62)},e),t.setLineDash([4*u,7*u]),t.lineDashOffset=0,t.globalAlpha=.3,t.strokeStyle=m(.45),t.lineWidth=p,t.beginPath(),l.forEach(([w,c],x)=>x?t.lineTo(w,c):t.moveTo(w,c)),t.stroke(),t.globalAlpha=1,t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,l.forEach(([w,c],x)=>{const S=x===y,M=S?1+Math.sin(n*6)*.14:1;t.strokeStyle=m(S?.8:.45),t.lineWidth=p*(S?1.3:.9),t.shadowBlur=S?f*1.6:f*.6,t.beginPath(),t.arc(w,c,12*a.node*M*u,0,Math.PI*2),t.stroke(),e.num&&(t.globalAlpha=x<=y?1:.45,e.num(t,String(x+1),w,c,16*a.numS*M*u,Math.round(14*a.numS*u)),t.globalAlpha=1)}),t.shadowBlur=0}function _t(t,o,a,i,n,e,s){const r=e.lut,f=13*i.halo,p=o/220,m=o/2,u=e.arrow&&e.arrow.w||1,l=(C,b)=>r(C).replace("rgb(","rgba(").replace(")",`,${b})`);t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const h=(a.r!=null?a.r:.42)*o,d=h*(a.rt!=null?a.rt:.36),y=3.4*u*p,v=s!=null?Math.max(0,Math.min(1,s)):n*(a.tempo||.6)%1,w=Math.pow(v,1.6),c=Math.max(0,(v-.9)/.1);t.save(),t.translate(m,m);const x=(C,b,k,R=1)=>{if(C<=.6)return;const L=y*2.6*R,D=Math.max(.1,C-L),T=C+L,I=t.createRadialGradient(0,0,D,0,0,T);I.addColorStop(0,l(b-.05,0)),I.addColorStop(.5,l(b,k*.85)),I.addColorStop(1,l(b-.05,0)),t.globalAlpha=1,t.fillStyle=I,t.shadowBlur=0,t.beginPath(),t.arc(0,0,T,0,Math.PI*2),t.fill(),t.globalAlpha=Math.min(1,k*1.1),t.lineWidth=y*.85,t.strokeStyle=r(Math.min(.98,b+.12)),t.shadowColor=r(.88),t.shadowBlur=f*.6,t.beginPath(),t.arc(0,0,C,0,Math.PI*2),t.stroke(),t.shadowBlur=0},S=t.createRadialGradient(0,0,0,0,0,d*1.08);S.addColorStop(0,l(.6,.1+.18*c)),S.addColorStop(.65,l(.5,.05+.08*c)),S.addColorStop(1,l(.5,0)),t.globalAlpha=1,t.fillStyle=S,t.beginPath(),t.arc(0,0,d*1.08,0,Math.PI*2),t.fill();const M=1+.02*Math.sin(n*2.6);x(d*M,.55+.4*c,.5+.45*c,.9);for(let C=2;C>=0;C--){const b=Math.pow(Math.max(0,v-C*.05),1.6),k=h-(h-d)*b,R=C===0?.6+.4*w:.18/C*(1-c);x(k,.55+.4*w,R*(1-c*.45),1.15-.35*w)}c>.01&&x(d*(1+1.4*c),.9,(1-c)*.8,1.1),t.globalAlpha=.6+.3*c,t.shadowColor=r(.85),t.shadowBlur=f*(.9+c),t.fillStyle=r(.62+.3*c),t.beginPath(),t.arc(0,0,y*.85+3*p*c,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}function Rt(t,o,a,i,n,e,s,r){const f=e.lut,p=13*i.halo,m=o/220,u=o/2,l=e.arrow&&e.arrow.w||1,h=l*m,d=(A,_)=>f(A).replace("rgb(","rgba(").replace(")",","+_+")");t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const y=o*.42*(a.spread!=null?a.spread:1),w=(r||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([A,_])=>[u+A*y,u+_*y]),c=80,x=[];for(let A=0;A<=c;A++){const _=A/c*(w.length-1),P=Math.min(w.length-2,Math.floor(_)),F=_-P,G=w[Math.max(0,P-1)],E=w[P],z=w[P+1],N=w[Math.min(w.length-1,P+2)],V=(K,W,j,g)=>.5*(2*W+(-K+j)*F+(2*K-5*W+4*j-g)*F*F+(-K+3*W-3*j+g)*F*F*F);x.push([V(G[0],E[0],z[0],N[0]),V(G[1],E[1],z[1],N[1])])}const S=A=>{const _=Math.max(0,Math.min(c,A*c)),P=Math.floor(_),F=_-P,G=x[P],E=x[Math.min(c,P+1)];return[G[0]+(E[0]-G[0])*F,G[1]+(E[1]-G[1])*F]},M=.68;let C,b,k;if(s!=null)C=Math.max(0,Math.min(1,s)),b=1,k=0;else{const A=n*(a.tempo||.42)%1;if(A<M)C=A/M,b=1,k=0;else{const _=(A-M)/(1-M);C=1,b=1-_*_,k=_}}if(b<=.012)return;const R=C*C*C*(C*(6*C-15)+10),L=Math.min(1,16*C*C*(1-C)*(1-C));a.taper!=null&&a.taper;const D=.36*(a.tail!=null?a.tail:1),T=a.width!=null?a.width:1;{const A=t.createLinearGradient(x[0][0],x[0][1],x[c][0],x[c][1]);A.addColorStop(0,d(.46,0)),A.addColorStop(.3,d(.46,.03*b)),A.addColorStop(.8,d(.46,.045*b)),A.addColorStop(1,d(.46,0)),t.globalAlpha=1,t.strokeStyle=A,t.lineWidth=9*h,t.shadowColor=f(.6),t.shadowBlur=p*2,t.beginPath(),x.forEach(([_,P],F)=>F?t.lineTo(_,P):t.moveTo(_,P)),t.stroke(),t.shadowBlur=0}const I=40,U=Math.max(0,R-D*(1-k)),B=[];for(let A=0;A<=I;A++)B.push(S(U+(R-U)*(A/I)));const Y=()=>{t.beginPath(),B.forEach(([A,_],P)=>P?t.lineTo(A,_):t.moveTo(A,_)),t.stroke()},X=()=>{const A=t.createLinearGradient(B[0][0],B[0][1],B[I][0],B[I][1]);return A.addColorStop(0,d(.55,0)),A.addColorStop(.4,d(.56,0)),A.addColorStop(.68,d(.6,.09)),A.addColorStop(.88,d(.64,.24)),A.addColorStop(1,d(.68,.44)),A},rt=1+.5*L;t.globalAlpha=b,t.strokeStyle=X(),t.lineWidth=(20+10*L)*h*T,t.shadowColor=f(.72),t.shadowBlur=p*2.2,Y(),t.strokeStyle=X(),t.lineWidth=(10+5*L)*h*T,t.shadowBlur=p*1,Y(),t.shadowBlur=0;for(let A=1;A<=I;A++){const _=A/I;t.globalAlpha=Math.pow(_,2.2)*.95*b,t.strokeStyle=f(.55+.38*_),t.lineWidth=(1.6+6.5*Math.pow(_,.7))*h*T*rt,t.beginPath(),t.moveTo(B[A-1][0],B[A-1][1]),t.lineTo(B[A][0],B[A][1]),t.stroke()}const Q=B[I][0],Z=B[I][1];t.globalAlpha=.8*b,t.fillStyle=f(.6),t.shadowColor=f(.8),t.shadowBlur=p*1.6,t.beginPath(),t.arc(Q,Z,(9+5*L)*h*T,0,Math.PI*2),t.fill(),t.globalAlpha=b,t.fillStyle=f(.93),t.shadowBlur=p*.6,t.beginPath(),t.arc(Q,Z,(3.4+1.8*L)*h*T,0,Math.PI*2),t.fill(),t.globalAlpha=1,t.shadowBlur=0}function It(t,o,a,i,n,e,s){const r=e.lut,f=13*i.halo,p=o/220,m=o/2,u=e.arrow&&e.arrow.w||1;t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const l=(a.r!=null?a.r:.3)*o,h=a.width!=null?a.width:1,d=4.2*u*p*h,y=a.dir!=null?a.dir:1,v=(a.sweep!=null?a.sweep:.66)*Math.PI*2,w=s!=null?Math.max(0,Math.min(1,s)):n*(a.tempo||.5)%1,c=-Math.PI/2+y*w*Math.PI*2;t.save(),t.translate(m,m),t.globalAlpha=.16,t.lineWidth=d*.7,t.strokeStyle=r(.44),t.shadowColor=r(.6),t.shadowBlur=f*.4,t.beginPath(),t.arc(0,0,l,0,Math.PI*2),t.stroke(),t.shadowBlur=0;const x=16;for(let L=0;L<x;L++){const D=L/(x-1),T=c-y*D*v,I=c-y*(D+1.2/x)*v;t.globalAlpha=(1-D)*.9,t.strokeStyle=r(.55+.35*(1-D)),t.lineWidth=d*(.55+.55*(1-D)),t.shadowColor=r(.8),t.shadowBlur=f*(.4+.5*(1-D)),t.beginPath(),t.arc(0,0,l,Math.min(T,I),Math.max(T,I),!1),t.stroke()}t.shadowBlur=0;const S=Math.cos(c)*l,M=Math.sin(c)*l,C=c+y*Math.PI/2,b=8*p*h;t.save(),t.translate(S,M),t.rotate(C+Math.PI/2),t.globalAlpha=1;const k=3.4*b*(.7+.3*u),R={color:r(.96),glowColor:r(.9),glow:f*1.2};e.glyph&&(e.glyph(t,"LIFT_TIP",0,0,k,R)||e.glyph(t,"TIP_TRI",0,0,k*.93,R))||(t.rotate(-Math.PI/2),t.strokeStyle=r(.96),t.lineWidth=d*.9,t.shadowColor=r(.9),t.shadowBlur=f*1.2,t.beginPath(),t.moveTo(-b,-b*.9),t.lineTo(b*.5,0),t.lineTo(-b,b*.9),t.stroke()),t.restore(),t.globalAlpha=.62,t.shadowColor=r(.75),t.shadowBlur=f*.6,t.fillStyle=r(.6),t.beginPath(),t.arc(0,0,d*.6,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}export{bt as M,$ as N,q as P,st as S,kt as a,Ct as b,_t as c,vt as d,Rt as e,It as f,At as g,yt as h,dt as i,nt as j,pt as k,xt as l,St as m,wt as n,Mt as o,it as p,mt as r,ht as s};
