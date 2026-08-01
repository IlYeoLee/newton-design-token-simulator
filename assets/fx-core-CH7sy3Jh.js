(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))c(n);new MutationObserver(n=>{for(const e of n)if(e.type==="childList")for(const i of e.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&c(i)}).observe(document,{childList:!0,subtree:!0});function o(n){const e={};return n.integrity&&(e.integrity=n.integrity),n.referrerPolicy&&(e.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?e.credentials="include":n.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function c(n){if(n.ep)return;n.ep=!0;const e=o(n);fetch(n.href,e)}})();const E={red:"#FA3030",coral:"#FE6E3C",sand:"#FEC389",prism:"#D1FEFF"},W={ink:"#FFFFFF",inkDark:"#0A0A0A",hi:"#ECECEC",lo:"#D0D0D0",paper:"#FAFAFA",surface:"#F2F2F2",t1:"#3B3B3B",t2:"#757575",t3:"#525252"},r0=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)],x0=Object.fromEntries(Object.entries({...E,...W}).map(([t,a])=>[t,parseInt(a.slice(1),16)])),q=t=>`vec3(${r0(t).map(o=>(o/255).toFixed(4)).join(", ")})`,S0=(t,a=1)=>`rgba(${r0(t).join(",")},${a})`,h0=[[E.red,0],[E.red,.3],[E.coral,.56],[E.sand,.86],[E.prism,1]],d0=1;function u0(t){const a=String(t).toUpperCase();return/^#([0-9A-F])\1\1\1\1\1$/.test(a)||Object.values(W).some(o=>o.toUpperCase()===a)?!0:Object.values(E).some(o=>o.toUpperCase()===a)}function C0(t){return t&&((!Array.isArray(t.stops)||!t.stops.every(([o])=>u0(o)))&&(t.stops=h0.map(o=>[...o])),t.sat=d0,t)}function e0(t,a,o,c,n){let e=0;o[0]=0,c[0]=-1e20,c[1]=1e20;for(let i=1;i<n;i++){let r=(t[i]+i*i-(t[o[e]]+o[e]*o[e]))/(2*i-2*o[e]);for(;r<=c[e];)e--,r=(t[i]+i*i-(t[o[e]]+o[e]*o[e]))/(2*i-2*o[e]);e++,o[e]=i,c[e]=r,c[e+1]=1e20}e=0;for(let i=0;i<n;i++){for(;c[e+1]<i;)e++;a[i]=(i-o[e])*(i-o[e])+t[o[e]]}}function l0(t,a){const o=new Float32Array(a),c=new Int32Array(a),n=new Float32Array(a+1),e=new Float32Array(a);for(let i=0;i<a;i++){for(let r=0;r<a;r++)e[r]=t[r*a+i];e0(e,o,c,n,a);for(let r=0;r<a;r++)t[r*a+i]=o[r]}for(let i=0;i<a;i++){for(let r=0;r<a;r++)e[r]=t[i*a+r];e0(e,o,c,n,a);for(let r=0;r<a;r++)t[i*a+r]=o[r]}}function i0(t,a){const c=new Float32Array(a*a),n=new Float32Array(a*a);let e=0,i=0,r=0;for(let m=0;m<a*a;m++){const f=t[m*4+3]/255;c[m]=f>=1?0:f<=0?1e20:Math.pow(Math.max(0,.5-f),2),n[m]=f>=1?1e20:f<=0?0:Math.pow(Math.max(0,f-.5),2),f>.5&&(e+=m%a,i+=m/a|0,r++)}l0(c,a),l0(n,a);const u=new Float32Array(a*a);for(let m=0;m<a*a;m++)u[m]=(Math.sqrt(c[m])-Math.sqrt(n[m]))/a;return{data:u,N:a,cx:r?e/r/a:.5,cy:r?i/r/a:.5}}function z(t,a=512){const o="_raster"+a;if(t[o])return t[o];const c=document.createElement("canvas");c.width=c.height=a;const n=c.getContext("2d"),e=Math.min(a/t.naturalWidth,a/t.naturalHeight);n.drawImage(t,0,0,t.naturalWidth*e,t.naturalHeight*e);const i=n.getImageData(0,0,a,a).data;let r=a,u=a,m=-1,f=-1;for(let p=0;p<a;p++)for(let l=0;l<a;l++)i[(p*a+l)*4+3]>8&&(l<r&&(r=l),l>m&&(m=l),p<u&&(u=p),p>f&&(f=p));return t[o]=m<0?{canvas:c,x:0,y:0,w:a,h:a}:{canvas:c,x:r,y:u,w:m-r+1,h:f-u+1},t[o]}function I0(t,a,o=!1){const c=z(t,a),n=document.createElement("canvas");n.width=n.height=a;const e=n.getContext("2d"),i=Math.min(a*$/c.w,a*$/c.h),r=c.w*i,u=c.h*i;return o&&(e.translate(0,a),e.scale(1,-1)),e.drawImage(c.canvas,c.x,c.y,c.w,c.h,(a-r)/2,(a-u)/2,r,u),i0(e.getImageData(0,0,a,a).data,a)}function A0(t,a,o,c=!1){const n=z(t,o),e=a?z(a,o):null,i=Math.min(o*$/n.w,o*$/n.h),r=n.w*i,u=n.h*i,m=(o-r)/2,f=(o-u)/2,p=C=>{const v=document.createElement("canvas");v.width=v.height=o;const w=v.getContext("2d");return c&&(w.translate(0,o),w.scale(1,-1)),w.drawImage(C.canvas,n.x,n.y,n.w,n.h,m,f,r,u),i0(w.getImageData(0,0,o,o).data,o)},l=p(n),h=e?p(e):null,d=new Float32Array(o*o*2);for(let C=0;C<o*o;C++)d[C*2]=l.data[C],d[C*2+1]=h?h.data[C]:1;return{data:d,N:o,cx:l.cx,cy:l.cy,inCx:h?h.cx:l.cx,inCy:h?h.cy:l.cy,hasInner:!!h}}const T0=1.9922,f0=.78,$=.52,b0=f0/$,M0=1.18,p0={size:.85,gx:-.025,gy:.195,rot:6,shadow:"glow",shadowK:.75,blend:"add"};function v0(t,a,o,c,n=p0){const e=Math.round(o*.75),i=n.shadow==="none"?0:n.shadowK??.75,r=u=>c(t,String(a),o/2,o/2,e,u);return n.shadow==="drop"&&i>.001?(t.save(),t.globalAlpha=Math.min(1,i*.7),t.translate(o*.018,o*.024),r({color:"rgba(120,18,18,.95)",glow:0,glowColor:"rgba(0,0,0,0)"}),t.restore(),r({glow:0,glowColor:"rgba(0,0,0,0)"})):r(n.shadow==="glow"?{glow:26*i,glowColor:"rgba(255,140,90,.85)"}:{glow:0,glowColor:"rgba(0,0,0,0)"}),n.blend==="knock"}function y0(t,a){const o=t.getImageData(0,0,a,a),c=t.createImageData(a,a);for(let n=0;n<a*a;n++){const e=o.data[n*4+3]/255,i=Math.round(255*(1-e));c.data[n*4]=c.data[n*4+1]=c.data[n*4+2]=i,c.data[n*4+3]=255}t.putImageData(c,0,0)}const R0={RATIO:140/600,opacity(t){return t===0?.5:t===2||t===4?0:1},anchor(t,a,o){return{x:((a?1-t.x:t.x)-.5)*o,y:(.5-t.y)*o,s:t.s||1}}},Q=t=>(t/=255,t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)),Z=t=>(t=Math.max(0,Math.min(1,t)),Math.round(255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)));function n0(t,a,o){t=Q(t),a=Q(a),o=Q(o);const c=Math.cbrt(.4122214708*t+.5363325363*a+.0514459929*o),n=Math.cbrt(.2119034982*t+.6806995451*a+.1073969566*o),e=Math.cbrt(.0883024619*t+.2817188376*a+.6299787005*o);return[.2104542553*c+.793617785*n-.0040720468*e,1.9779984951*c-2.428592205*n+.4505937099*e,.0259040371*c+.7827717662*n-.808675766*e]}function m0(t,a,o){const c=(t+.3963377774*a+.2158037573*o)**3,n=(t-.1055613458*a-.0638541728*o)**3,e=(t-.0894841775*a-1.291485548*o)**3;return[Z(4.0767416621*c-3.3077115913*n+.2309699292*e),Z(-1.2684380046*c+2.6097574011*n-.3413193965*e),Z(-.0041960863*c-.7034186147*n+1.707614701*e)]}const s0=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)];function P0(t,a=1,o=new Uint8Array(256*4)){const c=[...t].sort((n,e)=>n[1]-e[1]);for(let n=0;n<256;n++){const e=n/255;let i=0;for(;i<c.length-2&&e>c[i+1][1];)i++;const[r,u]=c[i],[m,f]=c[i+1],p=Math.max(0,Math.min(1,(e-u)/Math.max(1e-5,f-u))),l=n0(...s0(r)),h=n0(...s0(m)),d=m0(l[0]+(h[0]-l[0])*p,(l[1]+(h[1]-l[1])*p)*a,(l[2]+(h[2]-l[2])*p)*a);o.set([...d,255],n*4)}return o}const _0=`
float refEdge(vec2 uv){
  float h = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
  float v = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.90, uv.y);
  return h * v;                        // mask-composite: intersect
}`,L0=`
#define CUT_BAND 0.13
// 디포커스 비중 — 0 이면 순수 마스크 페더(형태 완전 보존), 1 이면 옛 방식(형태 뭉갬).
//   유저 지적으로 0.22 까지 내렸다: 바닥에 닿는 끝만 살짝 풀리고 다리 실루엣은 남는다.
#define CUT_DEFOCUS 0.22
// 하단 잘림 처리 — 알파로 지우는 게 아니라 **아래로 갈수록 초점이 나가며 배경에 녹는다**
//   (유저 레퍼런스: 확산 유리 실루엣). 호출자는 .y(디포커스)로 날카로운 마스크를 넓은 블러
//   쪽으로 크로스페이드하고, .x(알파)를 마지막에 곱한다. 디포커스가 알파보다 훨씬 위에서
//   시작해야 '흐려지다 녹는다'로 읽힌다 — 같이 시작하면 그냥 페이드아웃이다.
// ★ botM 은 반드시 **폭 전체 평균**이어야 한다. 열마다 판정하면 프레임 안에서 끝나는 열
//   (팔·손)만 또렷이 남아 세로로 찢어진 조각처럼 보인다 — 실제 사고(유저 스샷).
//   잘림은 프레임의 성질이지 열의 성질이 아니다.
vec2 cutFade(float x, float y, float botM, float t){
  float cut = smoothstep(0.04, 0.26, botM);   // 이 프레임이 몸을 가로질렀나
  if (cut < 0.01) return vec2(1.0, 0.0);
  // 저주파만 — x 고주파를 넣으면 그게 곧 세로 줄무늬다. 은은한 숨쉬기가 목적.
  float wob = 0.5 * sin(x * 1.7 + t * 0.45) + 0.5 * sin(t * 0.31);
  float band = CUT_BAND * (0.88 + 0.14 * wob);
  // ★ 디포커스(실루엣 → 넓은 가우시안 크로스페이드)를 주력으로 쓰면 **형태가 뭉개진다** —
  //   다리 두 개가 한 덩이로 붙어 '인위적인 블러'로 읽혔다(유저 스샷). 이제 주력은 **마스크 페더**다:
  //   실루엣은 끝까지 유지되고 밀도만 사라진다. 디포커스는 가장 아래에서 살짝만 거든다.
  //   길이도 늘렸다 — 짧은 페더는 경계가 선으로 보여서 결국 '잘렸다'로 읽힌다.
  float a = smoothstep(0.0, band * 2.30, y);
  a = a * a * (3.0 - 2.0 * a);            // 부드러운 S — 시작이 급하면 그 자체가 가로선이 된다
  float d = smoothstep(band * 1.15, 0.0, y) * CUT_DEFOCUS;
  return vec2(mix(1.0, clamp(a, 0.0, 1.0), cut), d * cut);
}`,k0=`
#define P_GAMMA 1.15    // 온도 곡선 (1.38은 대역을 LUT 평지로 밀어넣었다)
#define P_GAIN  0.96    // LUT 상단 여유(순백 방지)
#define P_LO    0.40    // LUT t=0~0.3 은 RED 단색 평지 — 대역 하한이 그 위여야 계조가 산다
//   uPHi = 대역 상단. **면마다 다르다** — 낮출수록 레드~오렌지(채도 0.73~0.79)에만 머물러 쨍해진다.
//          ⚠ '0.86 이면 SAND(#FEC389)에 닿는다'고 적혀 있었으나 **틀렸다**(07-31 실측):
//            t = pow(0.86, P_GAMMA) * P_GAIN = 0.807 로, SAND 스톱(t 0.86)에 못 닿는다.
//            그래서 벽 인물에 중황이 면적 0.0% 였고 램프 위쪽 절반이 통째로 코랄 근방이었다.
//          벽 인물 0.95(중황이 실재하는 최소치) / 바닥 코치판·데모판 0.64.
//          게인·알파로는 못 바꾼다 — 명도가 이미 0.92 라 곱해봐야 클리핑될 뿐이다(실측).
// 런타임 유니폼 — 이 GLSL 을 include 하는 호스트 3곳(바닥 코치판·데모판·벽 인물)이 전부
//   uniforms 에 선언하고 매 프레임 주입한다. 하나라도 빠지면 그 인물만 0(=무채·대역없음)이 된다.
//   uPSat   = 룩 채도. 구 '#define P_SAT 1.32' 고정값이 기본이다.
//             (여기에 백틱을 쓰면 이 GLSL 템플릿 리터럴이 끊겨 앱이 통째로 죽는다 — 실제 사고.)
//             (바닥 코치판엔 uSat 유니폼이 있었는데 셰이더 본문에서 한 번도 안 읽혔다 — 죽은 손잡이.
//              "채도 슬라이더 하나가 인물·마크 둘 다 움직인다"는 주석이 실제로는 마크만 움직였다.)
//   uPSweep = 세로 열 그라디언트 폭. **0 이면 도입 전과 픽셀 동일** — 안전한 롤백 지점.
uniform float uPSat, uPSweep, uPHi, uPDepth;
//   uPExp = **이 클립의 마스크 안쪽 평균 휘도**(호스트가 4Hz 로 실측해 주입). 0.5 = 무보정.
//     클립마다 노출이 달라 같은 셰이더가 다른 색을 냈다 — 복싱(어두운 탱크톱)은 진하고
//     러닝(밝은 옷·햇빛)은 하얗게. 셰이더 안의 어떤 값으로도 못 맞춘다: 입력 분포가 다르니까.
//     그래서 색을 정하기 **전에** 두 소스를 같은 밝기 분포로 옮긴다.
uniform float uPExp;
//   uPInk / uPInkT = **명암 잉크** (유저 확정 07-31: "바닥 지면에 뉴턴 빨간 레드를 실제 인물의
//     명암이 진한 부분에 잉크로 넣어라 — 아직도 밝다"). 세기 · 문턱(이 밝기 아래를 그늘로 본다).
//     uPInk 0 = 도입 전과 픽셀 동일(롤백 지점). 바닥(personLook)에만 걸린다 — 벽은 personColor 직행.
uniform float uPInk, uPInkT;
// 잉크 색 = 팔레트 RED 그 자체. **LUT 를 경유하지 않는다** — personColor 의 대역 하한이 P_LO(0.40)
//   이라 t 는 아무리 낮춰도 0.33 아래로 못 가고, LUT 의 순수 RED 평지(t ≤ 0.30)에 영영 못 닿는다.
//   T 를 미는 방식으로 '더 빨갛게'를 시도하면 여기서 막힌다 — 그게 '아직도 밝다'의 구조적 원인이다.
#define P_INK ${q(E.red)}
//   uPDepth = 영상의 국소 대비(옷 주름·결)를 온도로 옮기는 양 = '은은한 디테일 밀도'.
//             벽 매핑엔 이 경로가 아예 없다(높이만 본다) — 좌우 랩에서 보이는 질감 차이가 이것.
//             0.88 이 원래 값인데 밝은 맨살이 뽀얗게 뜨는 걸 막으려 0.34 로 내렸었다. 지금은
//             명도 상한·세로 램프가 그 문제를 따로 막으므로 올려도 된다.
//   uPCoral = **코랄 억제**(유저 규약: "RED · 중황 · 코랄이 고루 보이되 코랄 양은 일부만").
//     코랄은 LUT 램프의 한가운데(t 0.56)에 앉는다. T 가 고르게 퍼지면 한가운데가 곧 최대 면적이고,
//     특히 벽은 T 가 '높이'라 코랄이 **몸통**(사람에서 가장 넓은 부위)에 그대로 깔린다.
//     그래서 코랄이 앉는 T 를 피벗으로 잡고 양쪽으로 밀어낸다 — 머리는 RED 평지까지, 발은 SAND 까지
//     내려가/올라가고 코랄은 좁은 띠로 남는다. 새 색을 만들지 않는다: 배분만 바꾼다.
//     0 = 도입 전과 픽셀 동일(롤백 지점).
uniform float uPCoral;
vec3 personColor(float T){
  T = clamp(T, 0.0, 1.0);
  if (uPCoral > 0.001) {
    // 코랄이 앉는 T 를 감마·게인·대역에서 역산한다 — uPHi 를 바꿔도 피벗이 따라온다(상수로 박으면 어긋난다).
    float tc = pow(0.56 / P_GAIN, 1.0 / P_GAMMA);
    float Tc = clamp((tc - P_LO) / max(uPHi - P_LO, 1e-4), 0.0, 1.0);
    T = clamp(Tc + (T - Tc) * (1.0 + uPCoral * 1.6), 0.0, 1.0);
  }
  float t = P_LO + T * (uPHi - P_LO);   // 공용 대역으로 정규화
  t = pow(t, P_GAMMA) * P_GAIN;
  vec3 c = lut(clamp(t, 0.0, 1.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, uPSat), 0.0, 1.0);
}
// 인물 룩 — 바닥 코치판·데모판이 쓰는 톤 결정자.
//   ⚠ '복싱·러닝·농구가 공유하는 단 하나의 톤 결정자'라고 적혀 있었지만 **사실이 아니었다**.
//     벽 인물(main.js bxPerson)은 이 함수를 호출하지 않고 personColor(세로 램프)를 직접 쓴다.
//     그래서 같은 사람인데 바닥은 두께로, 벽은 높이로 색이 정해졌고 팔다리 색이 갈렸다(유저 지적).
//     지금은 아래 vHeat 로 같은 세로 램프를 쓴다 — 매핑은 사실상 통일됐지만, '한 함수'는 아직 아니다.
//   규칙: ① 얼굴만 완전 블러(이목구비 소거) ② 몸은 옷주름·결이 살아있되 매끄럽게
//        ③ 말단·가장자리는 뽀얀 우유빛으로 빠지고 코어만 채도 높게(그라디언트)
//        ④ 어두운 덩어리 금지 — 고키. 투사광이라 검정은 곧 '빛 없음'이다.
//   thick = 두께장(블러 마스크·방사 필드, 가장자리 0 → 코어 1)
//   lumS  = 원본 휘도(선명 — 몸의 결)      lumB = 블러 휘도(얼굴용)
//   mIn   = 내부 침식 마스크               face = 얼굴 대역 가중
#define P_MILK  0.28    // 하이라이트·얼굴이 우유빛으로 빠지는 양(전신 희석 금지)
//   ⚠ 밝기를 깎아 그늘을 만들면 안 된다. 알파가 min(aOut, lum*1.6)로 밝기에 묶여 있어
//     어두운 옷 픽셀만 알파 0.85로 떨어지고 뒤 벽·그리드가 비친다(실측: 0.985→0.847, 유저 신고).
//     투사광에선 '어둡게' = '투명하게'다. 그래서 그늘은 LUT 상단(딥레드)으로, 하이라이트는
//     하단(샌드)으로 — 양끝 다 R≈1이라 알파는 어디서도 안 떨어진다.
#define P_TEX   4.2     // 국소 대비(옷 결·주름)를 온도로 옮기는 배율.
                        //   6.8 은 대비를 포화시켜 밝은 옷·햇빛 받은 다리가 통째로 램프 꼭대기(흰)로 갔다.
                        //   ★ 질감은 **여기서** 가져온다 — 국소 평균과의 차이라 클립 노출에
                        //   무관하다. 절대 밝기(P_ABS)로 가져오면 밝게 찍은 클립이 통째로
                        //   램프 위로 밀려 러닝 코치만 하얘진다(유저: 다리색이 다르다).
#define P_ABS   0.26    // 절대 밝기를 반영하는 비율 — 낮을수록 클립 노출차에 둔감.
                        //   07-31 에 질감 살리려고 0.72 까지 올렸다가 되돌린다(0.18 → 0.72 → 0.26).
                        //   질감은 P_TEX(국소 대비)가 담당한다. 노출은 클립마다 다르지만
                        //   국소 대비는 다르지 않다 — 그게 두 종목 인물 색을 맞추는 유일한 길.
#define P_LUMLED 0.72   // T 를 '영상의 밝기'가 얼마나 주도하나. 0 = 종전(형상장 단독).
#define P_VERTMIX 0.35   // 1.0(세로 램프 단독 = 1차원)에서 낮춤 — 두께가 다시 색을 만든다(유저)   // T 결정에서 '세로 램프'가 차지하는 비중. 1 = 벽 인물과 완전 동일 매핑(유저 확정:
                         //   '벽면이 좋아 벽면스타일대로 바닥을 고쳐줘'). 0 으로 내리면 옛 두께 기반으로 돌아간다.
#define P_PIVOT 0.34    // 대역 확장 피벗 — 코어 실사용 T(≈0.15)보다 위. 이 값 기준으로 T 가 벌어진다.
vec3 personLook(float thick, float lumS, float lumB, float mIn, float face, float vTop){
  // 노출 정규화 — 이 클립의 평균을 0.5 로 옮긴다. 대비(=질감)는 비율이라 그대로 살아남고,
  //   '어떤 카메라로 얼마나 밝게 찍었나'만 상쇄된다.
  float kExp = 0.5 / max(uPExp, 0.06);
  lumS *= kExp; lumB *= kExp;
  // 절대 휘도를 그대로 읽으면 클립 노출차가 곧 색차가 된다 — 밝게 찍은 러닝·농구 코치가
  //   통째로 LUT 밝은 쪽(SAND)으로 밀려 하얘졌다(유저: "왜 러닝 농구는 더 하얘?").
  //   피부색이 아니라 노출이다. 그래서 국소 평균(lumB)은 노출로 보고 대부분 상쇄하고,
  //   국소 대비(lumS - lumB)만 결로 읽는다 — 옷 주름·미묘한 톤차가 여기 다 들어있다.
  float d = (lumS - lumB) * (1.0 - face) * P_TEX;       // 얼굴은 결 제거(이목구비 은닉)
  // 소프트 새추레이션 — clamp 로 자르면 큰 대비 영역이 통째로 양 끝에 붙어 종이장처럼
  //   포스터화된다(유저 스샷). x/(1+|x|)는 작은 결은 그대로, 큰 대비만 압축한다.
  float detail = d / (1.0 + abs(d) * 1.6);
  float base = mix(0.5, lumB, P_ABS);                   // 절대 밝기는 34%만
  // 하이키 — 07-31 에 감마 0.62 로 중간톤을 밀어 올렸는데, 그건 **전역 리프트**라
  //   어두운 소스(복싱 탱크톱)는 버티고 밝은 소스(러닝 코치의 밝은 옷·햇빛 다리)만
  //   램프 꼭대기로 밀려 하얘졌다 — 두 종목 인물 톤이 갈리던 나머지 절반(유저).
  //   0.88 = 거의 선형. 밝기 배분은 소스가 정하고, 우리는 대역만 정한다.
  float shade = pow(clamp(smoothstep(0.08, 0.80, base) + detail, 0.0, 1.0), 0.88);
  float lum = mix(mix(lumS, lumB, 0.50), lumB, face);   // 우유빛 하이라이트 판정용
  // LUT 실측 방향: T=0 → RED(#FA3030) · T≈0.86 → SAND(#FEC389) · T=1 → ICE.
  //   즉 T가 낮을수록 진하다. 두꺼운 코어·그늘 = 낮은 T(진한 코랄레드),
  //   얇은 말단·하이라이트·얼굴 = 높은 T(뽀얀 살구).
  float th = smoothstep(0.25, 0.95, thick);   // 두께장 정규화 — H의 실사용 범위가 좁다
  // 코어(th=1)는 딥코랄 t≈0.42, 사지(th≈0.4)는 코랄 t≈0.60, 말단·얼굴은 뽀얀 살구.
  //   구 1.0 - th*0.60 은 두께장이 1에 못 닿는 실제 값에서 전신을 살구빛으로 띄웠다(유저).
    // ★ 두께장 단독으로 T 를 정하면 안 된다(07-31 유저 지적). 벽 인물은 T 를 '높이'로 정하는데
  //   바닥만 '두께'로 정하고 있었다 — 같은 사람인데 팔다리 색이 완전히 갈렸다:
  //     몸통 t≈0.47(코랄레드) / 팔·다리 t≈0.82(샌드). 얇은 부위가 두 번 벌받는 구조였다.
  //   벽과 같은 세로 램프(머리 0.06 → 발 0.98)를 주 결정자로 두고, 두께는 보조로만 남긴다.
  //   P_VERTMIX 0 이면 옛 동작(두께 단독), 1 이면 벽과 완전 동일. 0.85 = 거의 벽 매핑.
  float vHeat = pow(clamp(1.0 - vTop, 0.0, 1.0), 1.35) * 0.92 + 0.06;
  // 형상장(두께·높이)은 바탕으로 남기고, **영상의 밝기(shade)가 색을 주도**한다 = 듀오톤.
  //   밝을수록 램프 위(흰빛), 어두울수록 아래(코랄레드) — 레퍼런스의 질감이 여기서 나온다.
  float form = mix(0.95 - th * 0.80, vHeat, P_VERTMIX);
  float T0 = mix(form, shade, P_LUMLED)
           + (shade - 0.5) * uPDepth * mIn * (1.0 - face * 0.7) + face * 0.26;
  // 대역 확장(uPSweep) — 왜 필요한가:
  //   두께장은 블러된 실루엣이라 몸통 '안쪽'이 전부 1.0 에 포화한다. 그래서 T 가 좁은 구간
  //   (코어 ≈0.15 ~ 말단 ≈0.63)에만 앉고, 그 대부분이 LUT 중·상단(살구~샌드)이라 면적으로 보면
  //   뽀얀 색이 지배한다 — 유저가 본 "바닥 인물은 채도가 낮고 흐리멍텅".
  //   벽 인물은 T 를 세로로 0.06~0.98 훑어서 진한 레드가 큰 면적을 차지한다. 채도 배수(uPSat)는
  //   원래부터 양쪽이 같았다 — 차이는 '대역을 얼마나 쓰는가'였다.
  //   ⚠ 시도 1(기각) — 벽처럼 세로 그라디언트를 더했다. T 를 뽀얀 쪽으로만 밀어 더 창백해졌다:
  //     평균채도 0.592 → 0.568 (실측, sweep 0 → 0.8).
  //   ⚠ 시도 2(아래 구현, 기본 0) — 피벗 기준 양방향 대비 확장. 평균채도는 0.593 → 0.584 로 내려가지만
  //     국소 Δ색상은 0.581 → 0.748 (+29%) 로 올라간다. 즉 '평균 채도'가 아니라 '대비'를 벌리는 손잡이다.
  //     처음에 이걸 뭉뚱그려 기각이라고 적었는데 부정확했다 — 용도가 다른 것이었다.
  //     이유: LUT 램프(RED #FA3030 → SAND #FEC389 → ICE)는 구간마다 채도가 비슷하다. T 를 어디로
  //     옮겨도 '색상'만 바뀌고 '채도'는 안 오른다 — 대역 확장은 채도 문제의 해법이 아니었다.
  //     실제로 채도를 올리는 손잡이는 uPSat 하나뿐이다(sat 1→2 에서 0.594 → 0.636 실측).
  //   그래도 손잡이는 남긴다: 색상·명암 대비를 벌리는 용도로는 유효하고, 같은 시도의 반복을 막는다.
  //   sweep = 0 이면 gain 1.0 → 도입 전과 픽셀 동일(현재 기본값).
  float T = clamp(P_PIVOT + (T0 - P_PIVOT) * (1.0 + uPSweep * 1.6), 0.0, 1.0);
  vec3 c = personColor(T);
  // 우유빛에서 **두께 항을 뺐다**(계수 0). 벽 인물엔 이 항이 아예 없고, 이게 팔다리를 크림색으로
  //   띄운 나머지 절반이었다(두께 0.35 인 팔이 흰색 9.6%). 얼굴 항은 남긴다 — 이목구비 은닉은
  //   제품 요구사항이고 벽과의 차이가 아니라 바닥 코치판의 역할이다.
  float milk = clamp(pow(1.0 - clamp(thick, 0.0, 1.0), 4.5) * 0.0
                     + face * 0.9 + smoothstep(0.72, 1.00, shade) * mIn * 0.0, 0.0, 1.0);   // 하이라이트 항도 0 —
  //   밝은 맨살(팔·다리)이 이 항으로 크림색이 됐다. 벽 인물엔 우유빛 자체가 없다. 얼굴만 남긴다.
  c = clamp(mix(c, vec3(1.0, 0.95, 0.90), milk * P_MILK), 0.0, 1.0);
  // ── 명암 잉크 — 실제 인물의 그늘을 뉴턴 RED 로 ─────────────────────────────
  //   왜 위의 shade 로는 안 되는가: shade 는 절대 밝기를 P_ABS(0.18)만 반영한다. 노출차에 안 흔들리는
  //   톤을 얻으려고 그렇게 설계했지만, 그 대가로 **실제 명암이 색에 거의 안 실린다** — 순흑에서
  //   순백까지 가도 shade 는 0.42~0.75 밖에 안 움직이고, uPDepth(0.34)를 곱하면 T 이동은 ±0.05 뿐이다.
  //   그래서 어두운 옷·그늘이 밝은 살구로 나온다. 잉크는 그 억제를 우회해 **원본 블러 휘도(lumB)** 를
  //   직접 본다 — 블러라서 이목구비·주름이 아니라 '명암 덩어리'만 잡힌다(유저 표현 그대로).
  //   ★ 밝기를 깎지 않는다(위 ⚠ 규약): RED 는 R=0.98 이라 알파 게이트 min(aOut, lum*1.6)에 안 걸린다.
  //     그늘이 어두워지는 게 아니라 **빨개진다** — 투사광에서 검정은 '빛 없음'이고 그건 그늘이 아니다.
  //   ★ 얼굴은 0.3 배만 — 이목구비 은닉이 제품 요구사항이라, 잉크가 얼굴 명암을 되살리면 안 된다.
  float dark = 1.0 - smoothstep(uPInkT - 0.20, uPInkT + 0.20, lumB);
  float ink = clamp(dark * mIn * (1.0 - face * 0.7) * uPInk, 0.0, 1.0);
  return clamp(mix(c, P_INK, ink), 0.0, 1.0);
}`,D0=`
uniform float uRadius, uPool, uContract, uShape, uSeed;
uniform sampler2D uSDF2, uSDFWarn;
// 깔창 각인 — 겉(신발) 안에 찍히는 맨발 자국. uSDF2.g 가 그 실루엣의 SDF.
//   uImp 0 = 완전 비활성(각인 도입 전과 픽셀 동일 — 안전한 롤백 지점)
//   uImpScale/uImpCtr: 자국을 무게중심 기준으로 축소해 깔창 여백을 만든다.
//     실측(같은 550 프레임): 신발 184×373 / 맨발 157×374 — **세로 여백이 0**(맨발이 1px 더 길다).
//     그래서 1:1 로 겹치면 발가락·뒤꿈치가 외곽선에 붙어 삐져나온 것으로 읽힌다.
//     균일 침식(sd + inset)으로 줄이면 안 된다 — 발가락 같은 작은 덩이가 먼저 소멸한다.
//     축소는 비율을 지키므로 발가락이 남는다.
//   uImpOff: 미세 이동. 축소만으로는 안 되는 국소 불일치가 있다 — 실측: 신발 발가락 박스가
//     맨발 엄지발가락보다 좁아서, 축소 0.93 에서도 **엄지 하나만** 외곽 밖으로 나갔다(8.5% 면적).
//     좌우 미러는 x 부호를 뒤집어야 하므로 호스트가 오른발에서 x 를 반전해 주입한다.
//   uImpRot: 각인 기울기(rad). 신발 실루엣과 맨발 자국은 원본에서 축이 미세하게 다르다 —
//     크기·위치만으로는 안 맞는 자리가 남아서 회전이 따로 필요하다. 좌우 미러는 부호가 뒤집힌다.
//   uImpShade: 자국 이너 섀도우 세기. 경계 **안쪽**에서 최대, 안으로 갈수록 사라진다.
//     **빛을 빼서** 만들지 않는다 — 잉크 모드에서는 알파가 줄면 바닥이 비쳐 '밝은 선'이 되고,
//     가산 모드에서는 애초에 뺄 수가 없다. 색을 얹어서 만든다(기본 흰색 = 프로토타입 규약).
//   uImpSharp: 자국 아웃라인 선명도(0 무름 ~ 1 또렷). AA 폭과 도트 가장자리 페이드를 같이 조인다.
//   uImpShadeCol · uRipCol: 팔레트 색 선택(0 흰 · 1 샌드 · 2 코랄 · 3 레드) — 새 색은 안 만든다.
uniform float uImp, uImpPitch, uImpDot, uImpGlow, uImpEdge, uImpScale, uImpRot, uImpShade, uImpSharp, uImpShadeCol;
uniform vec2 uImpCtr, uImpOff;
// 파동(리플) — 실루엣 **등거리선**을 따라 퍼진다. uRip 0 = 도입 전과 픽셀 동일.
//   유저 지적: 지금 파동이 단순 원형 파장이라 발자국 위에서 따로 놀고, 퍼짐이 과하거나 쨍하다.
//   부호거리로 몰면 파면이 형태를 따라간다 — 발형은 발 모양, 원형은 원. 토큰이 늘어도 파동은 하나다.
//   uRipGrad: 파동을 단색 대신 **뉴턴 LUT 그라디언트**로. 0 = 단색(uRipCol) · 1 = 완전 LUT.
//     갓 나온 파면이 상단(백열)이고 퍼질수록 하단(적)으로 식는다 — "모든 것은 온도다" 규약을
//     파동에도 그대로 적용한 것. 색을 새로 만드는 게 아니라 있는 LUT 를 훑는다.
uniform float uRip, uRipSpeed, uRipWidth, uRipReach, uRipCol, uRipGrad;
// ── 족저 압력장 · 등고선 ────────────────────────────────────────────────────
//   유저 레퍼런스: Nike Free 압력맵 / 인솔 프레셔 맵. 핵심은 색이 아니라 **색을 정하는 입력**이다.
//   지금까지는 '중심에서의 거리'였다 — 그래서 아무리 색을 풍부하게 해도 압력 분포가 아니라
//   그라디언트 칠한 원반으로 읽혔다(유저: 너무 도형 같다 · 섬세한 미학이 없다).
//   uPlantar: 압력장 혼합(0 = 옛 방사 · 1 = 압력장). 발형은 해부학 핫스팟, 원형은 중심 압력.
//   uBands:   등고선 단계 수(0 = 연속). 레퍼런스의 계단 밴드가 '데이터'로 읽히게 하는 장치.
//   uBandSoft: 밴드 경계 무름(0 = 칼금 · 1 = 뭉근).
uniform float uPlantar, uBands, uBandSoft;
// uSilFit: 실루엣이 쿼드에서 차지하는 비율(기준 0.78 대비). 1 = 옛 그대로.
//   ext·해부학 좌표는 '0.78 로 구웠을 때' 기준의 uv 값이라, 채움비가 바뀌면 같이 줄어야 한다.
uniform float uEdgeShade, uEdgeW, uEdgeSoft, uDither, uSilFit;
// uShadeRed / uShadeRedW: **음영 자리에 까는 뉴턴 RED 블룸** (유저: 바닥 색에 가장 빨간 뉴턴 레드가
//   부족하다 — 음영 지는 부분에 은은한 블러로). 이너 섀도우는 LUT 상단(PRISM)이라 형태는 잡아도
//   화면에서 빨강이 옅다. 같은 자리에 훨씬 **넓은 가우시안**으로 RED 를 한 겹 깔면, 경계선이 아니라
//   '음영의 온도'로 읽힌다. 새 색이 아니다 — 팔레트 RED 그대로다(규칙 ①).
//   uShadeRed 0 = 도입 전과 픽셀 동일(롤백 지점). uShadeRedW = 엣지 폭의 배수(클수록 더 흐리게 번짐).
uniform float uShadeRed, uShadeRedW;
/** 압력 0~1 (1 = 최고압). 발형은 자국 깊이 × 해부학 가중, 원형은 중심이 최고압.
 *  좌표는 uv[-1,1]. 오른발은 실루엣 SDF 자체가 미러라 별도 분기가 필요 없다. */
float plantar(vec2 pQ, float sdIn, float sd){
  // 해부학 좌표는 채움비 0.78 기준으로 잡은 값이라, 쿼드가 넓어지면 되돌려 읽어야 자리가 맞는다.
  vec2 p = pQ / max(uSilFit, 0.05);
  float blob;
  if (uShape < 0.5) {                       // 존 원 — 해부학이 없다. 중심 압력 + 약한 비대칭.
    float r = length(p) / max(0.46 * uRadius, 1e-3);   // p 는 이미 uSilFit 로 되돌려 읽은 좌표
    return clamp(1.0 - r * r * 0.92, 0.0, 1.0);
  }
  // 압력장은 **신발 전체**에 깔린다. 자국 깊이만 쓰면 자국 바깥(신발 안)이 전부 압력 0 =
  //   최저 대역으로 깔려서 그라디언트가 실루엣의 일부만 덮는다(유저 지적).
  //   겉(신발) 깊이가 바탕이고, 자국 안쪽이 실제 접지라 그 위에서 압력이 올라간다.
  float sfd = max(uSilFit, 0.05);   // 깊이 램프도 실루엣 축척을 따라간다
  float dShoe = clamp(-sd / (0.30 * sfd), 0.0, 1.0);
  float dFoot = clamp(-sdIn / (0.13 * sfd), 0.0, 1.0);
  float depth = dShoe * (0.42 + 0.58 * dFoot);
  // 해부학 핫스팟: 앞꿈치 볼(최대) · 뒤꿈치(중간) · 엄지(부분). 레퍼런스의 적/황 자리.
  vec2 b = (p - vec2(0.02, 0.30)) / vec2(0.34, 0.20);  float ball = exp(-dot(b, b));
  vec2 h = (p - vec2(0.00, -0.44)) / vec2(0.26, 0.22); float heel = exp(-dot(h, h));
  vec2 g = (p - vec2(0.17, 0.56)) / vec2(0.15, 0.13);  float toe  = exp(-dot(g, g));
  vec2 a = (p - vec2(-0.13, -0.02)) / vec2(0.22, 0.26); float arch = exp(-dot(a, a));
  blob = 0.30 + 1.00 * ball + 0.62 * heel + 0.50 * toe - 0.34 * arch;
  return clamp(depth * blob, 0.0, 1.0);
}
/** 윤곽선 — **두 겹**이다: 얇고 또렷한 코어 라인 + 그 밖으로 넓게 풀리는 소프트.
 *  한 겹 가우시안(exp(-(sd/w)^2))은 굵기만 있고 위계가 없어 투박하다(유저: 촌스러운 아웃라인).
 *  코어 폭에 fwidth 하한을 둬 어느 배율에서도 1~2px 로 유지되고, 소프트가 그 밖을 받아
 *  '칼로 자른 띠'가 아니라 그려진 선으로 읽힌다. */
float edgeLine(float sd, float w){
  float fw = max(fwidth(sd), 1e-5);
  float cw = max(w * 0.42, 1.4 * fw);
  float sw = max(w * 2.30, 3.2 * fw);
  float c = exp(-pow(abs(sd) / cw, 2.0));
  float s = exp(-pow(abs(sd) / sw, 1.5));
  return clamp(c + s * 0.30, 0.0, 1.0);
}
/** 등고선 — 연속 온도를 N단으로 계단화하되 경계는 무르게. 0이면 그대로 통과. */
float contour(float t){
  if (uBands < 0.5) return t;
  float n = floor(uBands + 0.5);
  float s = t * n;
  float f = fract(s);
  // ★ 화면공간 하한 — 고정 uv 무름만 두면 확대할수록 밴드 경계가 계단으로 드러난다(유저: 면으로 드드득).
  float aa = max(fwidth(s), 1e-5) * 1.25;
  float soft = max(clamp(uBandSoft, 0.02, 1.0) * 0.5, aa);
  return (floor(s) + smoothstep(0.5 - soft, 0.5 + soft, f)) / n;
}
// 색 = src/palette.js 단일 소스. 유채는 4색뿐(규칙 ①), 무채는 상태 부호(규칙 ②).
//   은퇴: C_CREAM(#FEE2C6 — 팔레트에 없던 9번째 색) → SAND
//         C_WINE·C_BRICK(암적) → SAND·CORAL  (유저: 워닝에 어두운색 금지)
//         C_EXCL(#EE2827) → RED · C_RIMG(미세 웜그레이) → 무채 lo 로 통합
#define C_RED   ${q(E.red)}
#define C_CORAL ${q(E.coral)}
#define C_SAND  ${q(E.sand)}
#define C_ICE   ${q(E.prism)}
#define C_CREAM C_SAND
#define C_GRAYF ${q(W.hi)}
#define C_GRAYL ${q(W.lo)}
#define C_RIMG  C_GRAYL
#define C_WINE  C_SAND
#define C_BRICK C_CORAL
#define C_EXCL  C_RED
/** 팔레트 색 선택 — 유채는 4색뿐이라는 규칙(palette.js ①)을 셰이더에서도 그대로 강제한다.
 *  0 흰(PRISM) · 1 샌드 · 2 코랄 · 3 레드. 인덱스 밖은 흰색으로 떨어진다.
 *  ★ 반드시 위 #define C_* 뒤에 와야 한다 — 앞에 두면 색 상수가 아직 없어 셰이더가 통째로 죽는다. */
vec3 palPick(float i){
  return i < 0.5 ? C_ICE : i < 1.5 ? C_SAND : i < 2.5 ? C_CORAL : C_RED;
}
/** 디더용 자립 해시 — 호스트의 fxhash 에 기대면 fxlab·parity 처럼 자체 공통부를 쓰는 곳에서
 *  셰이더가 통째로 죽는다(실제로 죽였다). MARK_GLSL 은 lut 외에는 자립해야 한다. */
float mkHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mkUndul(float ang, float t){
  return sin(ang*2.0 + t*1.1)*0.45 + sin(ang*3.0 - t*0.73 + 1.7)*0.33 + sin(ang*5.0 + t*0.41 + 4.2)*0.22;
}
// 일반화 부호 거리 — 존 원 / 발형이 같은 상태 머신을 공유 (1.9922 = float SDF 디코드 정본 계수)
float mkSD(vec2 p, float u1){
  // ★ 존 원은 SDF 가 아니라 **해석적 원**이라 채움비를 자동으로 안 따라간다. uSilFit 을 안 곱하면
  //   평면만 QUAD_K 배로 커지고 원은 그대로여서 원이 1.5배로 부푼다(유저: 원형이 과하게 커졌다).
  if (uShape < 0.5) return length(p) * (1.0 + u1 * uNoise * 0.04) - 0.46 * uRadius * max(uSilFit, 0.05);
  vec2 suv = p * 0.5 + 0.5;
  return texture2D(uSDF2, vec2(suv.x, 1.0 - suv.y)).r * 1.9922 / max(uRadius, 0.3) + u1 * uNoise * 0.02;
}
// 안쪽(맨발 자국) 부호거리 — 겉과 **같은 프레임**에서 구운 G 채널이라 좌표 변환이 필요 없다.
//   일렁임(u1)은 안 얹는다: 각인은 프린트라 겉 윤곽처럼 숨쉬면 '두 장이 따로 논다'로 읽힌다.
float mkSDIn(vec2 p){
  float s = max(uImpScale, 0.05);
  // 샘플 좌표라 변환은 전부 **역방향**이다 — 자국을 +θ 로 돌려 보이려면 좌표를 −θ 로 돌린다.
  vec2 d = p - uImpOff - uImpCtr;
  float ca = cos(uImpRot), sa = sin(uImpRot);
  d = vec2(d.x * ca + d.y * sa, -d.x * sa + d.y * ca);
  vec2 q = d / s + uImpCtr;                         // s<1 → 더 바깥을 읽으므로 자국이 작아진다
  vec2 suv = q * 0.5 + 0.5;
  // 거리에 s 를 되곱해야 p 공간의 참 거리가 된다 — 안 곱하면 축소할수록 AA·글로우 폭이 함께 부푼다
  return texture2D(uSDF2, vec2(suv.x, 1.0 - suv.y)).g * 1.9922 / max(uRadius, 0.3) * s;
}
/** 필 램프 좌표 0..1 — 존 원은 중심거리, **발형은 실루엣 안쪽 깊이(sd)**.
 *  발 위에 원형 그라디언트를 씌우면 발가락·아치·뒤꿈치가 램프를 가로질러 잘려서
 *  '빨간 원에 발 마스크를 덮은 얼룩'으로 읽힌다(유저: 발자국 퀄리티·튄다).
 *  깊이 기반이면 빛이 실루엣을 따라 고여서 발 모양 자체가 읽힌다. */
float mkR(vec2 uv, vec2 gc, float scale, float sd){
  float r = length(uv - gc) / max(scale, 1e-4);
  // 깊이가 주(主), 중심 거리는 종(從) — 무게중심 이동(Hold 뒤꿈치 고임·Success 블룸)은 남긴다.
  float base = uShape < 0.5 ? r : clamp(mix(clamp(1.0 + sd / 0.40, 0.0, 1.0), r, 0.28), 0.0, 1.4);
  if (uPlantar < 0.001) return base;
  // 압력장으로 갈아탄다 — q 는 '차가운 정도'라 1-압력이다. 그 위에 등고선을 씌운다.
  float pr = plantar(uv, mkSDIn(uv), sd);
  return contour(clamp(mix(base, 1.0 - pr, clamp(uPlantar, 0.0, 1.0)), 0.0, 1.4));
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
// ── 필 램프 = 뉴턴 LUT 한 벌 ────────────────────────────────────────────────
//   예전엔 상태마다 손으로 짠 2~3스톱 okmix 였다(Preview 는 CORAL→SAND 딱 2스톱).
//   그래서 ① 스톱 사이 smoothstep 이음매가 띠로 보이고 ② 쓰는 색이 2개뿐이라 단색처럼 읽혔다
//   (유저: "부드럽지 않은 그라디언트 + 색이 풍부하지 않다"). 정작 이 프로젝트 원칙은
//   "모든 것은 온도다 — 하나의 LUT를 공유"인데 MARK 필만 그 밖에 있었다.
//   LUT 는 OKLab 으로 256스텝 보간해 구운 것이라 이음매가 원천적으로 없고 4색을 다 지난다.
//   상태의 정체성은 이제 색 조합이 아니라 **온도 창(lo~hi)** 이 정한다.
#define T_PREV_LO 0.30
#define T_PREV_HI 0.99
#define T_HOT_LO  0.10
#define T_HOT_HI  1.00
#define T_ACT_LO  0.06
#define T_ACT_HI  1.00
#define T_HOLD_LO 0.04
#define T_HOLD_HI 0.97
// 온도 → 색. **뉴턴 LUT 한 벌만** 쓴다.
vec3 fillT(float q, float lo, float hi){
  float x = clamp(mix(lo, hi, clamp(q, 0.0, 1.0)), 0.0, 1.0);
  // ★ 밴딩(유저: 드드득)의 정체는 등고선이 아니라 **LUT 가 8비트 256단계**라는 것이다.
  //   원처럼 넓고 완만한 그라디언트에서는 인접 단계 사이가 눈에 보이는 띠가 된다.
  //   화면공간 해시로 조회 좌표를 1단계 미만 흔들면 띠가 잡티로 흩어져 사라진다(디더링 정석).
  x = clamp(x + (mkHash(gl_FragCoord.xy) - 0.5) * uDither, 0.0, 1.0);
  // 뉴턴 LUT 만 쓴다 — 유채는 RED·CORAL·SAND·PRISM 4색뿐이라는 규칙 ①(palette.js).
  //   압력맵용 별도 계열 램프를 넣었다가 유저 지적으로 되돌렸다. 다시 만들지 말 것.
  return lut(x);
}
vec3 fillPreview(float q){ return fillT(q, T_PREV_LO, T_PREV_HI); }
vec3 fillHot(float q){     return fillT(q, T_HOT_LO,  T_HOT_HI);  }
vec3 fillActive(float q){  return fillT(q, T_ACT_LO,  T_ACT_HI);  }
vec3 fillHold(float q){    return fillT(q, T_HOLD_LO, T_HOLD_HI); }
// Success 는 코어가 가장 뜨겁고(하한이 낮다) 바깥이 백열로 열린다 — 승리의 온도.
// 상한을 1.0(순백) 이 아니라 0.92 로 — 순백까지 열면 코어와 분리된 흰 링이 생긴다(유저: 아이스 과함).
vec3 fillSuccess(float q){ return fillT(q, 0.03, 1.00); }
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
  // 필 전용 소프트 엣지 — 우리 UI 의 강점은 그라디언트의 부드러움인데, 하드 마스크가 경계에
  //   선을 그어 원반처럼 보이게 했다(유저). 안쪽으로 uEdgeW 만큼 페더링해 형태가 색으로 읽히게.
  float feath = smoothstep(0.0, max(uEdgeW, 1e-4), -sd);
  float inFill = mix(inside, inside * feath, clamp(uEdgeSoft, 0.0, 1.0));
  float outPos = max(sd, 0.0);
  // 점선 = 회피 계약 (일렁임과 분리한 저주기 — '털 뜯김' 방지 확정판)
  float dashM = (uContract > 0.5 && uContract < 1.5)
              ? smoothstep(0.30, 0.60, 0.5 + 0.5 * sin(ang * 10.0)) : 1.0;
  float sf = max(uSilFit, 0.05);
  float ext = (uShape < 0.5 ? 0.46 * uRadius : 0.72) * sf;
  vec2 gcBall = uShape < 0.5 ? vec2(0.0) : vec2(0.0, 0.20) * sf;
  vec2 gcHeel = uShape < 0.5 ? vec2(0.0, -0.5 * ext) : vec2(0.0, -0.32) * sf;
  vec4 A = vec4(0.0);
  // Hold 진행 아크는 **이너 섀도우 뒤에** 얹어야 한다 — 섀도우가 훨씬 넓고 밝아서 얇은 림을
  //   덮어버리고, 삐져나온 조각만 남아 '떠 있는 초승달' 로 읽혔다(유저 확대 스샷).
  float holdA = 0.0; vec3 holdC = vec3(0.0);
  float fillGain = clamp(uPool * 1.6, 0.0, 1.35);

  if (state < 0.5) {            // ── Preview: 아웃라인 → 소프트 필 차오름 (strong=라이브 '다음' 적열 강조)
    float f = prog;
    float breath = 1.0 + 0.05 * sin(t * 2.0) * (0.4 + uNoise);
    // 중심 핫스팟 완화(유저 재지적: 가운데 원 또렷) — 하한↑ + 폴오프 넓혀 부드러운 전이(하드 원 제거)
    // 하한(0.36)은 옛 방사 그라디언트의 중앙 핫스팟을 눌러 두려던 것이다. 압력장에선 중앙이
    //   이미 부드러우므로 그 하한이 램프 상단(고압)을 통째로 잘라 먹는다 — 켜지면 걷어낸다.
    float q = mix(0.36, 0.02, clamp(uPlantar, 0.0, 1.0)) + (1.0 - mix(0.36, 0.02, clamp(uPlantar, 0.0, 1.0))) * mkR(uv, gcBall, ext * 1.18 * breath, sd);
    vec3 fillCol = mix(C_CREAM, mix(fillPreview(q), fillHot(q), strong), f);
    float fillA = mix(0.42, 0.82, f) * fillGain;
    lay(A, fillCol, fillA * inFill);
    // 아웃라인 폐기(유저 지시) — 형태는 아래 이너 섀도우가 잡는다. Hold 진행 림만 예외.

  } else if (state < 1.5) {     // ── Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 타이밍)
    float gradR = uShape < 0.5 ? ext * 1.75 : 2.15;   // 폴오프 넓힘 = 중앙 적열 원 완화(유저)
    float qf = mix(0.34, 0.02, clamp(uPlantar, 0.0, 1.0));
    float q = qf + (1.0 - qf) * mkR(uv, gcBall, gradR, sd);    // 중심 하한↑ — 적열이 은은하게 퍼짐
    q *= 1.0 + 0.025 * sin(t * 3.1 + q * 5.0) * uNoise;
    lay(A, fillActive(q), inFill * min(fillGain * 1.15, 1.0));
    // 헤일로 폭: 발형은 실루엣이 얇아 존 원과 같은 폭이면 윤곽을 통째로 삼킨다(유저: 튄다)
    float hw = max((uShape < 0.5 ? 0.115 - 0.075 * prog : 0.062 - 0.040 * prog) * uW, 0.014);
    // 헤일로는 필의 **연장**이다 — 예전엔 SAND→ICE 별도 로브를 위에 얹어서 실루엣 경계에
    //   색이 튀는 띠(유저: "아이스링 경계가 너무 세서 하나로 자연스럽게 안 이어진다")가 생겼다.
    //   같은 LUT 를 필의 상한(T_ACT_HI)에서 이어받아 1.0 까지 올리면 경계에서 색이 연속이다.
    //   감쇠도 지수 1.3(어깨가 각짐) → 2.0 가우시안으로 바꿔 꼬리가 부드럽게 풀린다.
    float hk = clamp(outPos / max(hw, 1e-4), 0.0, 3.0);
    float h = exp(-hk * hk * 0.9) * (1.0 - inside);
    // ★ 헤일로 꼭대기를 LUT 1.0(순백)까지 올리지 않는다 — 그게 '과한 아이스'의 실체였다.
    //   0.90 에서 멈추면 흰 링이 아니라 뜨거운 모래빛 잔광이 되고, 필과 계속 한 몸으로 읽힌다.
    //   세기도 0.50 → 0.34 로. 밝기로 존재감을 내면 형태가 먹힌다.
    vec3 hCol = lut(clamp(mix(T_ACT_HI, 0.90, smoothstep(0.0, 1.6, hk)), 0.0, 1.0));
    lay(A, hCol, h * uHalo * (0.50 + 0.14 * sin(t * 5.0)) * dashM);   // 0.34 로 내렸다가 흐려졌다(유저) — 복귀
  } else if (state < 2.5) {     // ── Hold: 실루엣 아웃라인을 따라 그려지는 진행 스트로크
    float pr = prog;
    vec2 gc = mix(gcBall, gcHeel, pr);
    float q = mkR(uv, gc, ext * 1.02, sd);
    float qh = max(q - 0.24 * pr, 0.0);
    lay(A, fillHold(qh), inFill * min(fillGain, 1.0) * 0.95);
    // ── Hold 전용 아웃라인 (유저 확정 방향) ────────────────────────────────
    //   예전 구조는 '중심에서 각도로 훑는 레이저 감지' 였다: 미완주 구간까지 무채 트랙(C_RIMG)을
    //   깔았고, 그 회색이 밝은 이너 섀도우 **위에** 얹혀 12시 자리에 홈이 파였다(유저 확대 스샷).
    //   이제 트랙을 아예 그리지 않는다 — **지나온 구간만** 실루엣 등거리선 위에 스트로크로 그린다.
    //   ① 스트로크는 실루엣을 따라간다(sd 기준이라 발이면 발 모양, 원이면 원)
    //   ② 길이를 따라 색이 흐른다(진한 빨강 → 선단 민트)
    //   ③ 양끝은 가우시안으로 흐려진다 — 폭과 알파를 **함께** 줄여야 잘린 끝이 안 생긴다
    float fw = max(fwidth(sd), 1e-5);
    float strokeW = max(0.026 * uW, 1.6 * fw);
    float dRim = abs(sd + 0.008);              // 실루엣 살짝 안쪽에 얹는다
    // 진행 좌표: 0(시작) → pr(선단). 양끝 블러 폭은 각도 단위.
    float BLUR = 0.16;                          // ≈58° — 이보다 짧으면 끝이 눈에 띈다
    float head = clamp(pr, 0.0, 1.0);
    float aIn  = smoothstep(0.0, BLUR, a01);                    // 시작 쪽 블러
    float aOut = smoothstep(head + BLUR * 0.10, head - BLUR, a01);  // 선단 쪽 블러
    float body = aIn * aOut * smoothstep(0.0, 0.04, pr);
    // 폭도 같이 좁아진다 — 알파만 줄이면 '가늘어지지 않고 흐려지기만' 해서 잘린 끝으로 읽힌다.
    float wk = mix(0.16, 1.0, body);
    float rn = dRim / max(strokeW * wk, 1e-5);
    float stroke = exp(-rn * rn * 1.5) * dashM;
    // 길이 방향 그라디언트 — 지나온 쪽은 LUT 저역(진한 빨강), 선단으로 갈수록 상단(민트)
    vec3 strokeCol = lut(clamp(mix(0.02, 1.0, clamp(a01 / max(head, 0.001), 0.0, 1.0)), 0.0, 1.0));
    holdC = strokeCol;
    holdA = stroke * body * 0.95;
    // 선단 광점 — 지금 어디까지 왔는지 한 점으로 읽히게. 가우시안이라 각이 안 진다.
    float hd = (a01 - head) / 0.09;
    float tip = exp(-hd * hd) * step(0.02, pr) * step(pr, 0.995);
    holdC = mix(holdC, lut(1.0), clamp(tip, 0.0, 1.0));
    holdA = max(holdA, stroke * tip * 0.95);
  } else if (state < 3.5) {     // ── Success: 진홍 블룸 → 잔상 소멸
    float e = 1.0 - pow(1.0 - prog, 2.6);
    float q = mkR(uv, gcBall, uShape < 0.5 ? ext * 1.3 : 1.75, sd);
    float fillA = (prog < 0.4 ? 1.0 : pow(1.0 - (prog - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    lay(A, fillSuccess(q / (0.55 + 0.55 * e)), inFill * fillA);
    float flash = exp(-prog * 9.0);
    // 성공 섬광 — 예전엔 순 ICE 0.8 이라 흰 띠가 코어와 분리돼 보였다(유저: 아이스가 과하다).
    //   LUT 상단(0.88)으로 낮추고 세기도 절반 — 필의 온도 연장이라 경계가 안 생긴다.
    // 섬광 아웃라인 폐기 — 이너 섀도우가 대신한다

  } else if (state < 4.5) {     // ── Miss: 온기가 식어 회색 고스트 → 무음 소멸
    float cool = smoothstep(0.0, 0.4, prog);
    float gone = pow(1.0 - max(prog - 0.45, 0.0) / 0.55, 1.6);
    float q = mkR(uv, gcBall, ext, sd);
    lay(A, mix(fillPreview(q), C_GRAYF, cool), inFill * mix(0.55, 0.24, cool) * gone * fillGain);


  } else if (state < 5.5) {     // ── Warning: 사구→코랄 리니어 + 느낌표 점멸 (유저: 어두운색 금지 → 암적 폐기)
    float ly = clamp(0.5 - uv.y / (2.2 * ext), 0.0, 1.0);
    // 워닝도 같은 램프를 쓴다 — 예전엔 SAND→CORAL 세로 선형이라 혼자 다른 그림이었다(유저: 촌스러움).
    lay(A, fillT(mix(ly, mkR(uv, gcBall, ext * 1.1, sd), 0.55), 0.10, 0.72), inFill * min(fillGain * 1.05, 1.0));
    float wScale = 0.44 * ext;
    vec2 wuv = uv / wScale * 0.5 + 0.5;
    float wSD = texture2D(uSDFWarn, vec2(wuv.x, 1.0 - wuv.y)).r * (2.0 * wScale);
    float aaW = max(fwidth(wSD), 0.0015);
    float exM = smoothstep(aaW, -aaW, wSD) * inside;
    lay(A, C_EXCL * 1.25, exM * (0.85 + 0.15 * sin(t * 5.5)));
  } else {                       // ── Locked: 회색 아웃라인 + (숫자는 호스트 오버레이)
    lay(A, C_GRAYF, inFill * 0.30 * fillGain);


  }
  // ── 실루엣 이너 섀도우 (아웃라인 대체) ──────────────────────────────────
  //   유저 지시: 아웃라인은 전부 빼고(Hold 진행 림만 남김) 이너 섀도우로 세련되게.
  //   선을 긋지 않고 **경계 안쪽을 눌러** 형태를 만든다. 그리는 선이 없으니 '촌스러운 아웃라인'이
  //   원천적으로 생기지 않고, 부드러운 그라디언트라는 이 UI 의 강점과 같은 언어가 된다.
  //   색은 압력 램프의 **저역**(가장 어두운 쪽)이라 색과 형태가 한 몸이다 — 따로 노는 회색 선이 아니다.
  // 음영 적열 블룸 — 섀도우보다 **먼저** 얹는다. 위에 프리즘이 와야 형태를 잡는 경계는 그대로고,
  //   빨강은 그 뒤로 넓게 번진다(순서를 뒤집으면 빨간 테두리가 생겨 아웃라인으로 읽힌다).
  //   ★ A.a 를 곱해 **이미 그려진 자리에서만** 달군다 — 빈 곳에 빨강을 새로 켜면 그건 음영이 아니라
  //     또 하나의 토큰이다. Miss·Locked 처럼 필이 옅은 상태에선 자동으로 같이 옅어진다.
  if (uShadeRed > 0.001) {
    float rw = max(uEdgeW * max(uShadeRedW, 0.2), 1e-4);
    float bl = exp(-pow(max(-sd, 0.0) / rw, 2.0)) * inside;   // 가우시안 = 각이 안 지는 번짐
    lay(A, C_RED, bl * uShadeRed * A.a);
  }
  if (uEdgeShade > 0.001) {
    float ins = exp(-pow(max(-sd, 0.0) / max(uEdgeW * 0.9, 1e-4), 1.1)) * inside;
    // 섀도우 색 = LUT 상단(PRISM · 하얀 민트). 빛으로 그리는 매체에서 어두운 색을 얹으면
    //   그건 그림자가 아니라 때다 — 이미 밝고 화사한 팔레트라 밝은 쪽으로 눌러야 형태가 산다(유저).
    lay(A, lut(1.0), ins * uEdgeShade);
  }
  if (holdA > 0.001) lay(A, holdC, holdA);   // 진행 아크를 섀도우 위로 — 덮이지 않게
  // ── 깔창 각인 (발형 전용) ────────────────────────────────────────────────
  //   유저 레퍼런스: 나이키 깔창 — 매끈한 깔창 외곽 **안**에 맨발 압력 자국이 도트로 프린트.
  //   구성: 겉(R 채널)이 토큰 본체·상태를 그리고, 안(G 채널)이 그 위에 무늬로 얹힌다.
  //   ★ 새 색을 만들지 않는다 — 정본 팔레트(CREAM·ICE)만 밝기로 얹는다(유채 4색 규칙).
  //   ★ 상태를 침범하지 않는다 — 각인은 '무늬'라서 Preview~Locked 어디서든 같은 그림이고,
  //     세기만 상태 알파(A.a)를 따라간다. 상태마다 다른 각인을 주면 토큰이 두 종류가 된다.
  if (uShape > 0.5 && uImp > 0.001) {
    float sdIn = mkSDIn(uv);
    // 아웃라인 선명도 — uImpSharp 1 이면 AA 를 화면 최소폭까지 조여 '깔끔하게 잘린' 경계가 된다.
    // 무름 범위를 크게 넓힌다 — 예전엔 sharp 0.75 에서 계수가 1 이라 사실상 1픽셀 칼금이었다(유저).
    //   경계를 sd 단위로도 풀어야 확대해도 부드럽다: 화면 AA 만으로는 항상 1px 경계다.
    float sfi = max(uSilFit, 0.05);
    float aaI  = max(max(fwidth(sdIn) * mix(3.4, 0.9, clamp(uImpSharp, 0.0, 1.0)),
                         mix(0.055, 0.004, clamp(uImpSharp, 0.0, 1.0)) * sfi), 0.0015);
    float inIn = smoothstep(aaI, -aaI, sdIn) * inside;   // 신발 안 ∩ 맨발 안
    float pit  = max(uImpPitch, 0.008);
    // 도트 격자 — 프로토타입 foot-*-dots.svg 규약: 정사각 격자, 점 지름 = 피치의 50%
    //   (실측: 간격 1.8px · 지름 0.9px on 48px 폭). 그래서 uImpDot 기본 0.25(=반지름/피치).
    vec2  cc  = fract(uv / pit) - 0.5;
    float dd  = length(cc) * pit;
    float rad = pit * clamp(uImpDot, 0.03, 0.5);
    float dAA = max(fwidth(dd), 1e-5) * 1.2;
    float dSoft = max(pit * mix(0.34, 0.12, clamp(uImpSharp, 0.0, 1.0)), dAA);
    float dotM = smoothstep(rad + dSoft, rad - dSoft, dd);
    // 자국 안쪽 깊이 — 가장자리는 옅고 안으로 갈수록 또렷(프린트 잉크가 고인 느낌).
    //   전면 균일하게 찍으면 도트가 실루엣을 무시하고 격자만 보인다.
    //   선명하게 갈수록 램프도 같이 좁아져야 한다 — 안 그러면 경계만 또렷하고 안쪽이 무르다.
    float depR = mix(0.185, 0.018, clamp(uImpSharp, 0.0, 1.0)) * sfi;
    float dep = smoothstep(0.0, depR, -sdIn);
    // 가장자리에서 0.34 로 남으면 도트 영역이 그 밝기로 뚝 끊긴다 — 0 까지 내려 배경과 어우러지게.
    lay(A, C_CREAM, inIn * dotM * uImp * (0.06 + 0.94 * dep));
    // 이너 섀도우 — 경계 **안쪽**에서 최대, 안으로 갈수록 사라진다. 자국이 '눌려 들어간' 자리로 읽힌다.
    //   빛을 빼지 않는다(위 uImpShade 주석): LUT 저역(RED)을 얹어 어느 바닥에서도 그림자로 읽히게.
    // 각인 음영에도 같은 블룸을 — 음영은 실루엣이든 자국이든 하나의 언어여야 한다.
    //   세기 0.7 배: 자국 음영은 실루엣 음영 **안에** 겹쳐 앉으므로 같은 값이면 두 겹이 쌓여 과열된다.
    if (uShadeRed > 0.001) {
      float rwI = max(uImpEdge * max(uShadeRedW, 0.2), 1e-4);
      float blI = exp(-pow(max(-sdIn, 0.0) / rwI, 2.0)) * inIn;
      lay(A, C_RED, blI * uShadeRed * uImp * 0.7);
    }
    if (uImpShade > 0.001) {
      float ins = exp(-pow(max(-sdIn, 0.0) / max(uImpEdge, 1e-4), 1.15)) * inIn;
      lay(A, palPick(uImpShadeCol), ins * uImpShade * uImp);
    }
    // 윤곽 글로우는 이제 선택 사항(기본 0) — 이너 섀도우가 경계를 만드는 쪽이 정본이다.
    if (uImpGlow > 0.001) {
      float rimIn = exp(-pow(abs(sdIn) / max(uImpEdge, 1e-4), 1.6)) * inside;
      lay(A, C_ICE, rimIn * uImpGlow * uImp);
    }
  }
  // ── 파동(리플) — 윤곽에서 바깥으로 나아가는 한 겹의 파면 ────────────────────
  //   outPos = max(sd,0) 이라 파면은 실루엣 **바깥**으로만 간다(안쪽 필을 안 건드린다).
  //   fade 로 퍼질수록 옅어져야 '은은하게'가 된다 — 등속·등세기면 그게 곧 '쨍함'이다.
  // ── 파동은 **상태가 정한다** ──────────────────────────────────────────────
  //   전 상태에 같은 파동을 얹으면 아무 뜻도 안 된다(유저 지적). 상태마다 말하는 게 다르다:
  //     Hold    = 진행에 따라 서서히 차오르는 연속 파면 (유지가 쌓인다)
  //     Success = 한 번 터지고 끝나는 단발 (진행이 곧 파면 위치 — 반복하지 않는다)
  //     나머지  = 없음. Active 의 타이밍은 헤일로 수축이 이미 말하고 있다.
  float ripAmt = 0.0, ripCyc = 0.0, ripK = 1.0;
  if (state > 1.5 && state < 2.5) {          // Hold — 차오름
    ripAmt = uRip * (0.20 + 0.80 * prog);
    ripCyc = fract(t * max(uRipSpeed, 0.01) + uSeed * 0.159);
  } else if (state > 2.5 && state < 3.5) {   // Success — 단발
    ripAmt = uRip * 1.6;
    ripCyc = clamp(prog / 0.80, 0.0, 1.0);
    ripK   = 1.9;                            // 더 멀리 나간다 ('팡')
  }
  if (ripAmt > 0.001) {
    // 시각은 인자 t 로 받는다 — 호스트가 uTime 을 MARK_GLSL 뒤에 선언하므로 여기선 못 쓴다.
    float cyc = ripCyc;
    float front = cyc * uRipReach * ripK;
    float band = exp(-pow((outPos - front) / max(uRipWidth, 1e-3), 2.0));
    // 온도: 갓 나온 파면이 뜨겁고(상단) 퍼질수록 식는다(하단). band 로 파면 중심을 한 겹 더 달군다.
    float lt  = clamp(0.34 + (1.0 - cyc) * 0.52 + band * 0.22, 0.0, 1.0);
    vec3  rc  = mix(palPick(uRipCol), lut(lt), clamp(uRipGrad, 0.0, 1.0));
    lay(A, rc, band * pow(1.0 - cyc, 1.6) * ripAmt * 0.5 * dashM);
  }
  // NaN 스크럽 — 위 분기 어디서든 비정상 값이 새면 '보이지 않음'으로 떨어뜨린다.
  //   NaN 과의 비교는 항상 false 이므로 step() 이 0 을 골라 준다(GLSL ES 1.0 에서 신뢰 가능한 유일한 방법).
  //   투사 UI 는 가산광이라 '없음'이 안전한 기본값이다 — 검은 판보다 백 배 낫다.
  A *= step(vec4(-1.0), A) * step(A, vec4(1e6));
  return A;
}`;function w0(t,a,o,c){t.lineWidth=4*a;const n=c.arrow;n.line==="dash"?t.setLineDash([12*a*n.gap,10*n.gap]):n.line==="dot"?(t.setLineDash([.5,12*n.gap]),t.lineCap="round",t.lineWidth=5*a):t.setLineDash([]),o!=null&&n.line!=="solid"&&n.line!=="taper"&&(t.lineDashOffset=-o*40*n.speed)}function F0(t,a,o,c,n,e={}){const i=n.lut,r=n.arrow||{},u=r.w??1,m=r.speed??1,f=r.glow??1,p=e.pulse??1,l=o/256,h=a/2,d=c*.9*m%1,C=e.prog!=null?Math.max(0,Math.min(1,e.prog)):Math.min(1,d/.55),v=e.prog!=null?1:d>.88?(1-d)/.12:1;t.clearRect(0,0,a,o);const w=v*(.45+.55*p),s=o-24*l,S=58*l,M=s+(S-s)*C,T=(_,L)=>i(_).replace("rgb(","rgba(").replace(")",`,${L.toFixed(3)})`),x=1.1*l*u,I=13*l*u,y=t.createLinearGradient(0,s,0,M);if(y.addColorStop(0,T(.55,0)),y.addColorStop(.1,T(.64,.45*w)),y.addColorStop(.32,T(.76,.85*w)),y.addColorStop(.62,T(.88,.98*w)),y.addColorStop(1,T(.97,w)),t.globalAlpha=1,t.fillStyle=y,t.beginPath(),t.moveTo(h-x/2,s),t.lineTo(h+x/2,s),t.lineTo(h+I/2,M),t.lineTo(h-I/2,M),t.closePath(),t.fill(),t.globalAlpha=w,C>.28&&!e.noTip){const _=34*l*(.7+.3*u),L=Math.min(1,(C-.28)/.22)*w,P=M+_*.3;t.globalAlpha=L;const A={color:i(.95),glowColor:i(.85),glow:12*f};n.glyph&&(n.glyph(t,"LIFT_TIP",h,P,_,A)||n.glyph(t,"TIP_TRI",h,P,_*.93,A))||(t.strokeStyle=i(.95),t.lineWidth=13*l*u,t.lineCap="round",t.lineJoin="round",t.shadowColor=i(.9),t.shadowBlur=18*l*f,t.beginPath(),t.moveTo(h-26*l,P+14*l),t.lineTo(h,P-16*l),t.lineTo(h+26*l,P+14*l),t.stroke())}t.globalAlpha=1,t.shadowBlur=0}function B0(t,a,o,c,n,e,i={}){const r=e.lut,u=e.arrow||{},m=u.w??1,f=u.glow??1,p=o/256;t.clearRect(0,0,a,o);const l=c.map(([s,S])=>[s*a,S*o]);if(l.length<2)return;const h=48,d=[],C=s=>{if(l.length===2)return[l[0][0]+(l[1][0]-l[0][0])*s,l[0][1]+(l[1][1]-l[0][1])*s];const S=s*(l.length-1),M=Math.min(l.length-2,Math.floor(S)),T=S-M,x=l[Math.max(0,M-1)],I=l[M],y=l[M+1],_=l[Math.min(l.length-1,M+2)],L=(P,A,R,B)=>.5*(2*A+(-P+R)*T+(2*P-5*A+4*R-B)*T*T+(-P+3*A-3*R+B)*T*T*T);return[L(x[0],I[0],y[0],_[0]),L(x[1],I[1],y[1],_[1])]};for(let s=0;s<=h;s++)d.push(C(s/h));const v=Math.max(0,Math.min(1,i.prog!=null?i.prog:n*.55%1)),w=Math.max(1,Math.round(h*v));t.lineCap="round";for(let s=1;s<=w;s++){const S=s/w;t.globalAlpha=Math.pow(S,1.5),t.strokeStyle=r(.45+.5*S),t.lineWidth=(1.6+3.2*S)*p*m,t.beginPath(),t.moveTo(d[s-1][0],d[s-1][1]),t.lineTo(d[s][0],d[s][1]),t.stroke()}if(v>.25){const s=d[w][0],S=d[w][1],M=d[Math.max(0,w-2)][0],T=d[Math.max(0,w-2)][1],x=Math.atan2(S-T,s-M)+Math.PI/2,I=30*p*(.7+.3*m);t.save(),t.translate(s,S),t.rotate(x),t.globalAlpha=Math.min(1,(v-.25)/.2);const y={color:r(.95),glowColor:r(.85),glow:12*f};e.glyph&&(e.glyph(t,"LIFT_TIP",0,0,I,y)||e.glyph(t,"TIP_TRI",0,0,I*.93,y))||(t.strokeStyle=r(.95),t.lineWidth=9*p*m,t.lineJoin="round",t.lineCap="round",t.beginPath(),t.moveTo(-18*p,12*p),t.lineTo(0,-14*p),t.lineTo(18*p,12*p),t.stroke()),t.restore()}t.globalAlpha=1}function c0(t,a,o,c,n,e){n=n||{};const i=e.lut,r=n.style||e.arrow.line,u=!!n.closed,m=[0];for(let h=1;h<a.length;h++)m.push(m[h-1]+Math.hypot(a[h][0]-a[h-1][0],a[h][1]-a[h-1][1]));const f=m[m.length-1]||1,p=h=>{h=(h%f+f)%f;let d=1;for(;d<m.length-1&&m[d]<h;)d++;const C=(h-m[d-1])/Math.max(1e-4,m[d]-m[d-1]);return[a[d-1][0]+(a[d][0]-a[d-1][0])*C,a[d-1][1]+(a[d][1]-a[d-1][1])*C,Math.atan2(a[d][1]-a[d-1][1],a[d][0]-a[d-1][0])]},l=e.arrow;if(r==="chevron"){const h=(26*c+8)*l.gap,d=Math.max(2,Math.floor(f/h));t.shadowColor=i(Math.min(1,l.heat+.2)),t.shadowBlur=8*c*l.glow;for(let C=0;C<d;C++){const v=C*h+o*42*l.speed%h;if(!u&&v>f-4)continue;const[w,s,S]=p(v),M=7.5*c,T=8.5*c,x=.45+.4*Math.sin(v/f*6.283-o*2.2*l.speed);t.strokeStyle=i(l.heat-.05+x*.3),t.lineWidth=3.2*c,t.lineJoin="round",t.lineCap="round",t.save(),t.translate(w,s),t.rotate(S),t.beginPath(),t.moveTo(-T*.5,-M),t.lineTo(T*.5,0),t.lineTo(-T*.5,M),t.stroke(),t.restore()}return!0}if(r==="comet"){const h=o*.35*l.speed%1*f,d=f*l.tail,C=Math.max(24,a.length*2);t.lineCap="round";for(let s=0;s<C;s++){const S=h-s/C*d,M=h-(s+1)/C*d;if(!u&&M<0)break;const T=1-s/C,[x,I]=p(S),[y,_]=p(M);!u&&Math.hypot(y-x,_-I)>f*.4||(t.globalAlpha=Math.pow(T,1.6),t.strokeStyle=i(Math.max(.05,l.heat-.2)+T*.55),t.lineWidth=(1.5+T*4.5)*c,T>.72?(t.shadowColor=i(Math.min(1,l.heat+.3)),t.shadowBlur=T*12*c*l.glow):t.shadowBlur=0,t.beginPath(),t.moveTo(x,I),t.lineTo(y,_),t.stroke())}t.globalAlpha=1,t.lineCap="butt",t.shadowBlur=0;const[v,w]=p(h);return t.fillStyle=rgba(W.ink,.95),t.shadowColor=i(.9),t.shadowBlur=16*c,t.beginPath(),t.arc(v,w,2.6*c,0,7),t.fill(),t.shadowBlur=0,!0}if(t.strokeStyle=n.color||i(l.heat),t.shadowColor=i(Math.min(1,l.heat+.15)),t.shadowBlur=(n.glow??8)*c*l.glow,r==="taper")for(let h=1;h<a.length;h++)t.lineWidth=(.5+h/a.length*4.5)*c,t.beginPath(),t.moveTo(a[h-1][0],a[h-1][1]),t.lineTo(a[h][0],a[h][1]),t.stroke();else w0(t,c,o,e),t.beginPath(),a.forEach(([h,d],C)=>C?t.lineTo(h,d):t.moveTo(h,d)),u&&t.closePath(),t.stroke();return t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,t.shadowBlur=0,!0}function E0(t,a,o,c,n,e){const i=13*c.halo,r=e.lut;t.clearRect(0,0,a,a),t.lineJoin="round";const u=a/220,m=a/2,f=18*o.round*u,p=40*u,l=48*u,h=a-80*u,d=a-96*u,C=[],v=(s,S,M,T)=>{for(let x=0;x<=1;x+=.12)C.push([s+(M-s)*x,S+(T-S)*x])};v(p+f,l,p+h-f,l),v(p+h,l+f,p+h,l+d-f),v(p+h-f,l+d,p+f,l+d),v(p,l+d-f,p,l+f),t.shadowColor=r(.6),t.shadowBlur=i*.8;const w=4*e.arrow.w*u;if(e.arrow.line==="solid"?(t.setLineDash([10*o.dash*u,8*u]),t.lineDashOffset=-n*22*u,t.strokeStyle=r(.45),t.lineWidth=w,t.beginPath(),t.roundRect(p,l,h,d,f),t.stroke(),t.setLineDash([]),t.lineDashOffset=0):c0(t,C,n,e.arrow.w*u,{color:r(.45),closed:!0},e),o.prog!=null&&o.prog>.001){const s=[],S=(A,R,B,D,U)=>{for(let O=1;O<=U;O++)s.push([A+(B-A)*O/U,R+(D-R)*O/U])},M=(A,R,B,D,U)=>{for(let O=1;O<=U;O++){const j=B+(D-B)*O/U;s.push([A+f*Math.cos(j),R+f*Math.sin(j)])}},T=Math.PI/2,x=p+h,I=l+d,y=p+h/2;s.push([y,l]),S(y,l,x-f,l,8),M(x-f,l+f,-T,0,6),S(x,l+f,x,I-f,10),M(x-f,I-f,0,T,6),S(x-f,I,p+f,I,14),M(p+f,I-f,T,Math.PI,6),S(p,I-f,p,l+f,10),M(p+f,l+f,Math.PI,Math.PI+T,6),S(p+f,l,y,l,8);let _=0;for(let A=1;A<s.length;A++)_+=Math.hypot(s[A][0]-s[A-1][0],s[A][1]-s[A-1][1]);const L=_*Math.min(1,o.prog);t.save(),t.setLineDash([10*o.dash*u,8*u]),t.lineDashOffset=-(h/2-f)-n*22*u,t.strokeStyle=r(.9),t.lineWidth=w*1.3,t.lineCap="round",t.shadowColor=r(.92),t.shadowBlur=i*1.3,t.beginPath(),t.moveTo(s[0][0],s[0][1]);let P=0;for(let A=1;A<s.length&&P<L;A++){const R=Math.hypot(s[A][0]-s[A-1][0],s[A][1]-s[A-1][1]);if(P+R<=L)t.lineTo(s[A][0],s[A][1]),P+=R;else{const B=(L-P)/R;t.lineTo(s[A-1][0]+(s[A][0]-s[A-1][0])*B,s[A-1][1]+(s[A][1]-s[A-1][1])*B),P=L}}t.stroke(),t.setLineDash([]),t.restore()}o.feet>.05&&e.foot&&(e.foot(t,!1,m-16*o.feet*u,m+6*u,26*o.feet*u),e.foot(t,!0,m+16*o.feet*u,m+6*u,26*o.feet*u)),t.shadowBlur=0}function O0(t,a,o,c,n,e,i,r){const u=13*c.halo,m=4*e.arrow.w*(a/220),f=e.lut;t.clearRect(0,0,a,a),t.lineJoin="round";const p=a/220,l=i||[[45*p,130*p],[110*p,60*p],[175*p,110*p]],h=r??n*.5%1,d=Math.min(1,h*1.25)*(l.length-1),C=Math.min(l.length-1,Math.floor(d+.35));t.shadowColor=f(.7),t.shadowBlur=u;const v=[[l[0][0],l[0][1]]];for(let w=1;w<=l.length-1;w++){const s=Math.max(0,Math.min(1,d-(w-1)));if(s<=0)break;v.push([l[w-1][0]+(l[w][0]-l[w-1][0])*s,l[w-1][1]+(l[w][1]-l[w-1][1])*s])}v.length>1&&c0(t,v,n,e.arrow.w*p,{color:f(.62)},e),t.setLineDash([4*p,7*p]),t.lineDashOffset=0,t.globalAlpha=.3,t.strokeStyle=f(.45),t.lineWidth=m,t.beginPath(),l.forEach(([w,s],S)=>S?t.lineTo(w,s):t.moveTo(w,s)),t.stroke(),t.globalAlpha=1,t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,l.forEach(([w,s],S)=>{const M=S===C,T=M?1+Math.sin(n*6)*.14:1;t.strokeStyle=f(M?.8:.45),t.lineWidth=m*(M?1.3:.9),t.shadowBlur=M?u*1.6:u*.6,t.beginPath(),t.arc(w,s,12*o.node*T*p,0,Math.PI*2),t.stroke(),e.num&&(t.globalAlpha=S<=C?1:.45,e.num(t,String(S+1),w,s,16*o.numS*T*p,Math.round(14*o.numS*p)),t.globalAlpha=1)}),t.shadowBlur=0}function G0(t,a,o,c,n,e,i){const r=e.lut,u=13*c.halo,m=a/220,f=a/2,p=e.arrow&&e.arrow.w||1,l=(x,I)=>r(x).replace("rgb(","rgba(").replace(")",`,${I})`);t.clearRect(0,0,a,a),t.lineJoin="round",t.lineCap="round";const h=(o.r!=null?o.r:.42)*a,d=h*(o.rt!=null?o.rt:.36),C=3.4*p*m,v=i!=null?Math.max(0,Math.min(1,i)):n*(o.tempo||.6)%1,w=Math.pow(v,1.6),s=Math.max(0,(v-.9)/.1);t.save(),t.translate(f,f);const S=(x,I,y,_=1)=>{if(x<=.6)return;const L=C*2.6*_,P=Math.max(.1,x-L),A=x+L,R=t.createRadialGradient(0,0,P,0,0,A);R.addColorStop(0,l(I-.05,0)),R.addColorStop(.5,l(I,y*.85)),R.addColorStop(1,l(I-.05,0)),t.globalAlpha=1,t.fillStyle=R,t.shadowBlur=0,t.beginPath(),t.arc(0,0,A,0,Math.PI*2),t.fill(),t.globalAlpha=Math.min(1,y*1.1),t.lineWidth=C*.85,t.strokeStyle=r(Math.min(.98,I+.12)),t.shadowColor=r(.88),t.shadowBlur=u*.6,t.beginPath(),t.arc(0,0,x,0,Math.PI*2),t.stroke(),t.shadowBlur=0},M=t.createRadialGradient(0,0,0,0,0,d*1.08);M.addColorStop(0,l(.6,.1+.18*s)),M.addColorStop(.65,l(.5,.05+.08*s)),M.addColorStop(1,l(.5,0)),t.globalAlpha=1,t.fillStyle=M,t.beginPath(),t.arc(0,0,d*1.08,0,Math.PI*2),t.fill();const T=1+.02*Math.sin(n*2.6);S(d*T,.55+.4*s,.5+.45*s,.9);for(let x=2;x>=0;x--){const I=Math.pow(Math.max(0,v-x*.05),1.6),y=h-(h-d)*I,_=x===0?.6+.4*w:.18/x*(1-s);S(y,.55+.4*w,_*(1-s*.45),1.15-.35*w)}s>.01&&S(d*(1+1.4*s),.9,(1-s)*.8,1.1),t.globalAlpha=.6+.3*s,t.shadowColor=r(.85),t.shadowBlur=u*(.9+s),t.fillStyle=r(.62+.3*s),t.beginPath(),t.arc(0,0,C*.85+3*m*s,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}function U0(t,a,o,c,n,e,i,r){const u=e.lut,m=13*c.halo,f=a/220,p=a/2,l=e.arrow&&e.arrow.w||1,h=l*f,d=(b,k)=>u(b).replace("rgb(","rgba(").replace(")",","+k+")");t.clearRect(0,0,a,a),t.lineJoin="round",t.lineCap="round";const C=a*.42*(o.spread!=null?o.spread:1),w=(r||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([b,k])=>[p+b*C,p+k*C]),s=80,S=[];for(let b=0;b<=s;b++){const k=b/s*(w.length-1),F=Math.min(w.length-2,Math.floor(k)),G=k-F,H=w[Math.max(0,F-1)],K=w[F],N=w[F+1],t0=w[Math.min(w.length-1,F+2)],a0=(X,J,Y,o0)=>.5*(2*J+(-X+Y)*G+(2*X-5*J+4*Y-o0)*G*G+(-X+3*J-3*Y+o0)*G*G*G);S.push([a0(H[0],K[0],N[0],t0[0]),a0(H[1],K[1],N[1],t0[1])])}const M=b=>{const k=Math.max(0,Math.min(s,b*s)),F=Math.floor(k),G=k-F,H=S[F],K=S[Math.min(s,F+1)];return[H[0]+(K[0]-H[0])*G,H[1]+(K[1]-H[1])*G]},T=.68;let x,I,y;if(i!=null)x=Math.max(0,Math.min(1,i)),I=1,y=0;else{const b=n*(o.tempo||.42)%1;if(b<T)x=b/T,I=1,y=0;else{const k=(b-T)/(1-T);x=1,I=1-k*k,y=k}}if(I<=.012)return;const _=x*x*x*(x*(6*x-15)+10),L=Math.min(1,16*x*x*(1-x)*(1-x));o.taper!=null&&o.taper;const P=.36*(o.tail!=null?o.tail:1),A=o.width!=null?o.width:1;{const b=t.createLinearGradient(S[0][0],S[0][1],S[s][0],S[s][1]);b.addColorStop(0,d(.46,0)),b.addColorStop(.3,d(.46,.03*I)),b.addColorStop(.8,d(.46,.045*I)),b.addColorStop(1,d(.46,0)),t.globalAlpha=1,t.strokeStyle=b,t.lineWidth=9*h,t.shadowColor=u(.6),t.shadowBlur=m*2,t.beginPath(),S.forEach(([k,F],G)=>G?t.lineTo(k,F):t.moveTo(k,F)),t.stroke(),t.shadowBlur=0}const R=40,B=Math.max(0,_-P*(1-y)),D=[];for(let b=0;b<=R;b++)D.push(M(B+(_-B)*(b/R)));const U=()=>{t.beginPath(),D.forEach(([b,k],F)=>F?t.lineTo(b,k):t.moveTo(b,k)),t.stroke()},O=()=>{const b=t.createLinearGradient(D[0][0],D[0][1],D[R][0],D[R][1]);return b.addColorStop(0,d(.55,0)),b.addColorStop(.4,d(.56,0)),b.addColorStop(.68,d(.6,.09)),b.addColorStop(.88,d(.64,.24)),b.addColorStop(1,d(.68,.44)),b},j=1+.5*L;t.globalAlpha=I,t.strokeStyle=O(),t.lineWidth=(20+10*L)*h*A,t.shadowColor=u(.72),t.shadowBlur=m*2.2,U(),t.strokeStyle=O(),t.lineWidth=(10+5*L)*h*A,t.shadowBlur=m*1,U(),t.shadowBlur=0;for(let b=1;b<=R;b++){const k=b/R;t.globalAlpha=Math.pow(k,2.2)*.95*I,t.strokeStyle=u(.55+.38*k),t.lineWidth=(1.6+6.5*Math.pow(k,.7))*h*A*j,t.beginPath(),t.moveTo(D[b-1][0],D[b-1][1]),t.lineTo(D[b][0],D[b][1]),t.stroke()}const V=D[R][0],g=D[R][1];t.globalAlpha=.8*I,t.fillStyle=u(.6),t.shadowColor=u(.8),t.shadowBlur=m*1.6,t.beginPath(),t.arc(V,g,(9+5*L)*h*A,0,Math.PI*2),t.fill(),t.globalAlpha=I,t.fillStyle=u(.93),t.shadowBlur=m*.6,t.beginPath(),t.arc(V,g,(3.4+1.8*L)*h*A,0,Math.PI*2),t.fill(),t.globalAlpha=1,t.shadowBlur=0}function H0(t,a,o,c,n,e,i){const r=e.lut,u=13*c.halo,m=a/220,f=a/2,p=e.arrow&&e.arrow.w||1;t.clearRect(0,0,a,a),t.lineJoin="round",t.lineCap="round";const l=(o.r!=null?o.r:.3)*a,h=o.width!=null?o.width:1,d=4.2*p*m*h,C=o.dir!=null?o.dir:1,v=(o.sweep!=null?o.sweep:.66)*Math.PI*2,w=i!=null?Math.max(0,Math.min(1,i)):n*(o.tempo||.5)%1,s=-Math.PI/2+C*w*Math.PI*2;t.save(),t.translate(f,f),t.globalAlpha=.16,t.lineWidth=d*.7,t.strokeStyle=r(.44),t.shadowColor=r(.6),t.shadowBlur=u*.4,t.beginPath(),t.arc(0,0,l,0,Math.PI*2),t.stroke(),t.shadowBlur=0;const S=16;for(let L=0;L<S;L++){const P=L/(S-1),A=s-C*P*v,R=s-C*(P+1.2/S)*v;t.globalAlpha=(1-P)*.9,t.strokeStyle=r(.55+.35*(1-P)),t.lineWidth=d*(.55+.55*(1-P)),t.shadowColor=r(.8),t.shadowBlur=u*(.4+.5*(1-P)),t.beginPath(),t.arc(0,0,l,Math.min(A,R),Math.max(A,R),!1),t.stroke()}t.shadowBlur=0;const M=Math.cos(s)*l,T=Math.sin(s)*l,x=s+C*Math.PI/2,I=8*m*h;t.save(),t.translate(M,T),t.rotate(x+Math.PI/2),t.globalAlpha=1;const y=3.4*I*(.7+.3*p),_={color:r(.96),glowColor:r(.9),glow:u*1.2};e.glyph&&(e.glyph(t,"LIFT_TIP",0,0,y,_)||e.glyph(t,"TIP_TRI",0,0,y*.93,_))||(t.rotate(-Math.PI/2),t.strokeStyle=r(.96),t.lineWidth=d*.9,t.shadowColor=r(.9),t.shadowBlur=u*1.2,t.beginPath(),t.moveTo(-I,-I*.9),t.lineTo(I*.5,0),t.lineTo(-I,I*.9),t.stroke()),t.restore(),t.globalAlpha=.62,t.shadowColor=r(.75),t.shadowBlur=u*.6,t.fillStyle=r(.6),t.beginPath(),t.arc(0,0,d*.6,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}export{L0 as C,p0 as G,R0 as M,W as N,E as P,b0 as Q,_0 as R,T0 as S,M0 as Z,$ as a,f0 as b,A0 as c,v0 as d,I0 as e,E0 as f,O0 as g,G0 as h,y0 as i,U0 as j,H0 as k,P0 as l,F0 as m,D0 as n,z as o,c0 as p,x0 as q,B0 as r,i0 as s,S0 as t,C0 as u,k0 as v,h0 as w,d0 as x};
