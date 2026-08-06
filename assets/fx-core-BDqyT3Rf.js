import{v as $,P as g,N as J}from"./palette-Bj20GXDn.js";const u0="MARK(발형·존원) 룩 정본. footlab.html '코드에 저장'이 이 파일을 덮어쓴다.",h0=.7,f0=.85,p0=-.054,m0=-.031,w0=5.5,x0=.027,S0=.34,b0=0,C0=0,v0=.97,I0=.038,A0=1,M0=24,T0=1,L0=.95,R0=.3,y0=.7,P0=0,k0=0,_0=.34,D0=.1,B0=.4,F0=1,E0=1.4,G0=0,O0=8,H0=.01,U0=0,W0=.011,q0=-2,g0=.75,K0=-.07,$0=.12,X0=4,j0=.6,J0=4,z0=1,Y0="glow",Q0="normal",Z0="offbit",V0=.55,N0=.065,aa=.26,ta=4,oa=4,ea=.56,la=.61,na=1,sa={punchLine:{node:1,numS:1,comet:1,tailLen:.5,rail:.22}},ra=-.095,ia=.12,ca=10,da=-.015,ua=.12,ha=-10,fa={op:0,imp:.98,scale:.83,pitch:.027,dot:.25,glow:0,shade:0,sharp:.64,edge:.004,plantar:0,bands:0,bandSoft:0,edgeShade:.26,edgeShadeW:4,edgeShadeGrad:0,edgeShadeG0:0,edgeShadeG1:0,dither:.011,edgeW:.01,edgeSoft:0,shadeRed:0,shadeRedW:.5,rip:0,ripReach:.34,ripWidth:.1,ripSpeed:.4,ripGrad:1,shadeCol:4,edgeShadeCol:4,dotCol:4,ripCol:0,bloom:.165,w:1.15},pa=1,ma=4,wa={0:{sharp:0,op:.56},2:{glow:.55,halo:.45,w:1,bloom:.07,shade:0,imp:1,sharp:0,edge:.004,op:1,tLo:0,tHi:.56},4:{glow:0,halo:.14,w:.7,bloom:.06,shade:0,imp:1,edgeShadeGrad:0,pitch:.048,dot:.13,irot:21,dotCol:4,edge:.004,sharp:0,plantar:1,edgeShadeCol:4,op:.71},tap:{op:0,imp:.98,scale:.83,pitch:.027,dot:.25,glow:0,shade:0,sharp:.64,edge:.004,plantar:0,bands:0,bandSoft:0,edgeShade:.26,edgeShadeW:4,edgeShadeGrad:0,edgeShadeG0:0,edgeShadeG1:0,dither:.011,edgeW:.01,edgeSoft:0,shadeRed:0,shadeRedW:.5,rip:0,ripReach:.34,ripWidth:.1,ripSpeed:.4,ripGrad:1,shadeCol:4,edgeShadeCol:4,dotCol:4,ripCol:0,bloom:.165,w:1.15}},xa=1.45,Sa=.22,ba=.55,Ca={_:"움직임 튜닝(markmotion.js 가 읽는다). 상태 8토큰과 직교 — 여기는 '어떻게 움직이나'만.",stepLead:.3,slideDecay:3,over:.14,overAt:.78,settle:.11,settleHz:2.4,popA:.16,popB:.18,popBAt:.11,airScale:.12,spawnDur:.44,hitDur:.34,arrowRamp:.16,arrowBreath:.06},va={_:u0,imp:h0,scale:f0,offx:p0,offy:m0,irot:w0,pitch:x0,dot:S0,glow:b0,shade:C0,sharp:v0,edge:I0,plantar:A0,bands:M0,bandSoft:T0,w:L0,halo:R0,pool:y0,noise:P0,rip:k0,ripReach:_0,ripWidth:D0,ripSpeed:B0,ripGrad:F0,edgeShade:E0,shadeRed:G0,shadeRedW:O0,edgeW:H0,edgeSoft:U0,dither:W0,tilt:q0,gsize:g0,gx:K0,gy:$0,grot:X0,gsh:j0,shadeCol:J0,ripCol:z0,gShadow:Y0,gBlend:Q0,numSrc:Z0,prog:V0,bloom:N0,blur:aa,edgeShadeW:ta,edgeShadeCol:oa,edgeShadeGrad:ea,edgeShadeG0:la,edgeShadeG1:na,prims:sa,gxL:ra,gyL:ia,grotL:ca,gxR:da,gyR:ua,grotR:ha,tap:fa,op:pa,dotCol:ma,states:wa,loadGain:xa,loadBase:Sa,flow:ba,motion:Ca};function l0(a,t,o,c,s){let e=0;o[0]=0,c[0]=-1e20,c[1]=1e20;for(let r=1;r<s;r++){let h=(a[r]+r*r-(a[o[e]]+o[e]*o[e]))/(2*r-2*o[e]);for(;h<=c[e];)e--,h=(a[r]+r*r-(a[o[e]]+o[e]*o[e]))/(2*r-2*o[e]);e++,o[e]=r,c[e]=h,c[e+1]=1e20}e=0;for(let r=0;r<s;r++){for(;c[e+1]<r;)e++;t[r]=(r-o[e])*(r-o[e])+a[o[e]]}}function n0(a,t){const o=new Float32Array(t),c=new Int32Array(t),s=new Float32Array(t+1),e=new Float32Array(t);for(let r=0;r<t;r++){for(let h=0;h<t;h++)e[h]=a[h*t+r];l0(e,o,c,s,t);for(let h=0;h<t;h++)a[h*t+r]=o[h]}for(let r=0;r<t;r++){for(let h=0;h<t;h++)e[h]=a[r*t+h];l0(e,o,c,s,t);for(let h=0;h<t;h++)a[r*t+h]=o[h]}}function i0(a,t){const c=new Float32Array(t*t),s=new Float32Array(t*t);let e=0,r=0,h=0;for(let b=0;b<t*t;b++){const u=a[b*4+3]/255;c[b]=u>=1?0:u<=0?1e20:Math.pow(Math.max(0,.5-u),2),s[b]=u>=1?1e20:u<=0?0:Math.pow(Math.max(0,u-.5),2),u>.5&&(e+=b%t,r+=b/t|0,h++)}n0(c,t),n0(s,t);const f=new Float32Array(t*t);for(let b=0;b<t*t;b++)f[b]=(Math.sqrt(c[b])-Math.sqrt(s[b]))/t;return{data:f,N:t,cx:h?e/h/t:.5,cy:h?r/h/t:.5}}function N(a,t=512){const o="_raster"+t;if(a[o])return a[o];const c=document.createElement("canvas");c.width=c.height=t;const s=c.getContext("2d"),e=Math.min(t/a.naturalWidth,t/a.naturalHeight);s.drawImage(a,0,0,a.naturalWidth*e,a.naturalHeight*e);const r=s.getImageData(0,0,t,t).data;let h=t,f=t,b=-1,u=-1;for(let d=0;d<t;d++)for(let l=0;l<t;l++)r[(d*t+l)*4+3]>8&&(l<h&&(h=l),l>b&&(b=l),d<f&&(f=d),d>u&&(u=d));return a[o]=b<0?{canvas:c,x:0,y:0,w:t,h:t}:{canvas:c,x:h,y:f,w:b-h+1,h:u-f+1},a[o]}function ya(a,t,o=!1){const c=N(a,t),s=document.createElement("canvas");s.width=s.height=t;const e=s.getContext("2d"),r=Math.min(t*j/c.w,t*j/c.h),h=c.w*r,f=c.h*r;return o&&(e.translate(0,t),e.scale(1,-1)),e.drawImage(c.canvas,c.x,c.y,c.w,c.h,(t-h)/2,(t-f)/2,h,f),i0(e.getImageData(0,0,t,t).data,t)}function Pa(a,t,o,c=!1){const s=N(a,o),e=t?N(t,o):null,r=Math.min(o*j/s.w,o*j/s.h),h=s.w*r,f=s.h*r,b=(o-h)/2,u=(o-f)/2,d=v=>{const P=document.createElement("canvas");P.width=P.height=o;const T=P.getContext("2d");return c&&(T.translate(0,o),T.scale(1,-1)),T.drawImage(v.canvas,s.x,s.y,s.w,s.h,b,u,h,f),i0(T.getImageData(0,0,o,o).data,o)},l=d(s),i=e?d(e):null,n=new Float32Array(o*o*2);for(let v=0;v<o*o;v++)n[v*2]=l.data[v],n[v*2+1]=i?i.data[v]:1;return{data:n,N:o,cx:l.cx,cy:l.cy,inCx:i?i.cx:l.cx,inCy:i?i.cy:l.cy,hasInner:!!i}}const ka=1.9922,Ia=.78,j=.52,_a=Ia/j,Da=1.18,O=va||{},c0={size:O.gsize??.85,gx:O.gx??-.025,gy:O.gy??.195,rot:O.grot??6,gxL:O.gxL,gyL:O.gyL,rotL:O.grotL,gxR:O.gxR,gyR:O.gyR,rotR:O.grotR,shadow:O.gShadow??"glow",shadowK:O.gsh??.75,blend:O.gBlend??"add"};function Ba(a,t=c0){return a?{gx:t.gxR??-t.gx,gy:t.gyR??t.gy,rot:t.rotR??-t.rot}:{gx:t.gxL??t.gx,gy:t.gyL??t.gy,rot:t.rotL??t.rot}}function Fa(a,t,o,c,s=c0){const e=Math.round(o*.75),r=s.shadow==="none"?0:s.shadowK??.75,h=f=>c(a,String(t),o/2,o/2,e,f);return s.shadow==="drop"&&r>.001?(a.save(),a.globalAlpha=Math.min(1,r*.7),a.translate(o*.018,o*.024),h({color:"rgba(120,18,18,.95)",glow:0,glowColor:"rgba(0,0,0,0)"}),a.restore(),h({glow:0,glowColor:"rgba(0,0,0,0)"})):h(s.shadow==="glow"?{glow:26*r,glowColor:"rgba(255,140,90,.85)"}:{glow:0,glowColor:"rgba(0,0,0,0)"}),s.blend==="knock"}function Ea(a,t){const o=a.getImageData(0,0,t,t),c=a.createImageData(t,t);for(let s=0;s<t*t;s++){const e=o.data[s*4+3]/255,r=Math.round(255*(1-e));c.data[s*4]=c.data[s*4+1]=c.data[s*4+2]=r,c.data[s*4+3]=255}a.putImageData(c,0,0)}const Ga={RATIO:140/600,opacity(a){return a===0?.5:a===2||a===4?0:1},anchor(a,t,o){return{x:((t?1-a.x:a.x)-.5)*o,y:(.5-a.y)*o,s:a.s||1}}},Z=a=>(a/=255,a<=.04045?a/12.92:Math.pow((a+.055)/1.055,2.4)),V=a=>(a=Math.max(0,Math.min(1,a)),Math.round(255*(a<=.0031308?12.92*a:1.055*Math.pow(a,1/2.4)-.055)));function s0(a,t,o){a=Z(a),t=Z(t),o=Z(o);const c=Math.cbrt(.4122214708*a+.5363325363*t+.0514459929*o),s=Math.cbrt(.2119034982*a+.6806995451*t+.1073969566*o),e=Math.cbrt(.0883024619*a+.2817188376*t+.6299787005*o);return[.2104542553*c+.793617785*s-.0040720468*e,1.9779984951*c-2.428592205*s+.4505937099*e,.0259040371*c+.7827717662*s-.808675766*e]}function Aa(a,t,o){const c=(a+.3963377774*t+.2158037573*o)**3,s=(a-.1055613458*t-.0638541728*o)**3,e=(a-.0894841775*t-1.291485548*o)**3;return[V(4.0767416621*c-3.3077115913*s+.2309699292*e),V(-1.2684380046*c+2.6097574011*s-.3413193965*e),V(-.0041960863*c-.7034186147*s+1.707614701*e)]}const r0=a=>[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)];function Oa(a,t=1,o=new Uint8Array(256*4)){const c=[...a].sort((s,e)=>s[1]-e[1]);for(let s=0;s<256;s++){const e=s/255;let r=0;for(;r<c.length-2&&e>c[r+1][1];)r++;const[h,f]=c[r],[b,u]=c[r+1],d=Math.max(0,Math.min(1,(e-f)/Math.max(1e-5,u-f))),l=s0(...r0(h)),i=s0(...r0(b)),n=Aa(l[0]+(i[0]-l[0])*d,(l[1]+(i[1]-l[1])*d)*t,(l[2]+(i[2]-l[2])*d)*t);o.set([...n,255],s*4)}return o}const Ha=`
float refEdge(vec2 uv){
  float h = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
  float v = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.90, uv.y);
  return h * v;                        // mask-composite: intersect
}`,Ua=`
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
}`,Wa=`
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
//   uPForm = **레퍼런스 규약**(public/refs/person, 유저 확정 08-01). 0 = 현행 · 1 = 깊이 기반.
//     레퍼런스 다섯 장의 공통 성질은 하나다: **밝기가 형태(깊이)에서 나온다.**
//     가장자리는 검정으로 떨어지고 안쪽 두꺼운 곳이 밝다. 사진의 결(모공·옷 무늬)은 밝기를
//     정하지 않는다 — 지금 매핑의 정반대다(현행은 가장자리가 밝고 안쪽이 진하다).
//     무채축(검정→흰색)을 그대로 쓰면 규칙 ①(유채 4색)을 깬다. 그래서 **뉴턴 LUT 를
//     명도축으로** 쓴다: 깊이 0 → RED 를 어둡게 · 중간 → CORAL/SAND · 최심부 → PRISM(거의 흰빛).
uniform float uPForm;
uniform float uPLo, uPHiL;   // 클립 휘도 실측 범위 — 룩2 의 p5~p95 스트레치(클립 노출·대비 차 상쇄)
uniform float uPLumLin;      // 1 = 이 판의 비디오 텍스처가 sRGB 디코드되어 셰이더 휘도가 **리니어**.
                             //   코치판(SRGBColorSpace)=1 · 데모판(미지정)=0. 측정(lo/hi)은 sRGB 라
                             //   리니어 입력은 sRGB 로 되돌려 **모든 판이 같은 공간**에서 룩2를 탄다.
// 룩2 캘리브레이션 노브 — 재빌드 없이 FXP.person.cal 로 조정, 수렴값이 곧 정본.
uniform float uPCalWave;     // 웨이브 진폭 배율 (기본 1 · 캘리브레이션 시 0)
uniform float uPCalD;        // d(결 신호) 이득
uniform float uPCalW;        // 흰 레이어 전역 이득
uniform float uPCalB;        // band(톤) 오프셋
//   uPInk / uPInkT = **명암 잉크** (유저 확정 07-31: "바닥 지면에 뉴턴 빨간 레드를 실제 인물의
//     명암이 진한 부분에 잉크로 넣어라 — 아직도 밝다"). 세기 · 문턱(이 밝기 아래를 그늘로 본다).
//     uPInk 0 = 도입 전과 픽셀 동일(롤백 지점). 바닥(personLook)에만 걸린다 — 벽은 personColor 직행.
uniform float uPInk, uPInkT;
// 얼굴 아래 밝기 리프트 — 기본 0(끔). 복싱 벽 인물만 켠다. uFaceE = 얼굴 타원(패널 uv, xy=중심 zw=반경)
uniform float uFaceLift;
uniform vec4 uFaceE;
// 잉크 색 = 팔레트 RED 그 자체. **LUT 를 경유하지 않는다** — personColor 의 대역 하한이 P_LO(0.40)
//   이라 t 는 아무리 낮춰도 0.33 아래로 못 가고, LUT 의 순수 RED 평지(t ≤ 0.30)에 영영 못 닿는다.
//   T 를 미는 방식으로 '더 빨갛게'를 시도하면 여기서 막힌다 — 그게 '아직도 밝다'의 구조적 원인이다.
#define P_INK ${$(g.red)}
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
  // (uPForm=1 은 이 함수를 타지 않는다 — 호출부에서 personAura 로 분기. 아래 정의 참조.)
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
}
// ═══ 레퍼런스 규약(uPForm=1) — 마스크 공유 5중 레이어 합성 ══════════════════════
//   injury-check.mp4 픽셀 실측(08-02): 색상 12° 고정 · 명도 0.80~0.95 · 채도만 이동,
//   픽셀 75% 가 mix(흰색, #E0542F, k) 한 축 위. 이 그림은 LUT 램프를 훑어서는 안 나온다 —
//   **같은 실루엣을 여러 겹으로 쌓아야** 나온다(외곽광·중간광·본체·디테일 screen·내부 흰광).
//   재료는 전부 기존 파이프라인에 있다: mBody = 침식 마스크(크리스프 실루엣),
//   wide/narrow = 마스크·휘도 블러 피라미드(CSS 의 blur 42px / 17px 역할).
//   레퍼런스의 흰 배경만 이식하지 않는다 — 투사광에서 흰 배경 = 판 전체 점등이다.
//   screen 합성(1-(1-a)(1-b))은 '흰색으로 희석'과 같은 축이라 실측 구조가 보존된다.
// ═══ 룩2 이식(uPForm=1) — 유저 확정 열화상 룩(인물 필터 앱 2026-08-02)의 GLSL 번역 ═══
//   벽·바닥·전 종목이 이 한 함수로 통일된다(유저: "바닥 벽 동일한 값으로").
//   앱 파이프라인 대응: 표면블러 1(lumS↔lumB 바이래터럴 근사) · 감마0.59/대비0.8/밝기0.5 ·
//   웨이브(세기1.04·속도1.32·밴드1.95, 얼굴·경계 통과 금지) · 얼굴 = 블러휘도+감산(이목구비 소거) ·
//   이너섀도 0.28 · 내부라인 0.14 · 적응 디더 · 아우라 0. 팔레트 = 룩2 스톱 그대로.
//   ⚠ 스톱 #FF4000·#FF8E5E·#FF3300 은 뉴턴 4색 밖 — 유저가 앱에서 확정한 값을 우선 이식했다.
vec3 look2Ramp(float t){
  // [흰색, #FA3030, #FF4000, #FF8E5E, #FF3300] 균등 스톱 (앱 LUT 규약: t=0 이 배경 흰색)
  vec3 c = mix(vec3(1.0), vec3(0.980, 0.188, 0.188), clamp(t * 4.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.251, 0.0), clamp(t * 4.0 - 1.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.557, 0.369), clamp(t * 4.0 - 2.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.2, 0.0), clamp(t * 4.0 - 3.0, 0.0, 1.0));
  return c;
}
vec4 personAura(float mBody, float wide, float lumSharp, float lumBase, float face, vec2 uv, float tSec){
  // ★ lumSharp = **비디오 원본 전해상 휘도**(디스필 적용, 호출부 계산). 저해상 필드 RT 휘도를
  //   쓰면 판이 작은 바닥 코치일수록 결이 사전에 뭉개져 뿌옇게 떴다(유저 진단 정확).
  //   lumBase = 좁은 블러장 휘도(앱 표면블러의 base 역할). 이제 신호가 앱과 같은 구조라
  //   우회 보정(임계 축소·d 이득·숄더) 없이 앱 상수를 그대로 쓴다.
  face = max(face, smoothstep(0.80, 0.90, uv.y));   // 정수리 — 판별 얼굴 대역 상단(0.84)과 크라운 사이 틈이 검붉은 반점으로 남던 것(복싱 실측)
  face = min(1.0, face * 1.5);   // 전이 구간(0.7~0.85)에서 이마 광택이 새어나와 반점 — 빠르게 포화
  if (uPLumLin > 0.5) {
    lumSharp = pow(clamp(lumSharp, 0.0, 1.0), 0.4545);
    lumBase = pow(clamp(lumBase, 0.0, 1.0), 0.4545);
  }
  float lo = uPLo;
  float hi = max(uPHiL, lo + 0.05);
  float ls = clamp((lumSharp - lo) / (hi - lo), 0.0, 1.0);
  float lb = clamp((lumBase - lo) / (hi - lo), 0.0, 1.0);
  // 표면 블러(surface 1, 앱 th=10/255 그대로): 약한 결은 base 로, 강한 경계만 복원
  float d = (ls - lb) * 1.1 * uPCalD;   // 수렴값(08-02 2차 캘리브레이션)
  float keep = clamp((abs(d) - 0.039) / 0.031, 0.0, 1.0);
  keep *= keep;
  float lum = lb + d * keep;
  lum = mix(lum, lb, face);   // 얼굴: 결 제거
  // 톤(룩2): 감마 0.59 → 대비 0.8 → 밝기 +0.5 → 인물 대역 0.3~1.0 (앱과 동일)
  float band = 0.3 + 0.7 * clamp((pow(clamp(lum, 0.0, 1.0), 0.59) - 0.5) * 0.8 + 0.72 + uPCalB, 0.0, 1.0);
  float bandB = 0.3 + 0.7 * clamp((pow(clamp(lb, 0.0, 1.0), 0.59) - 0.5) * 0.8 + 0.72 + uPCalB, 0.0, 1.0);
  band = mix(band, 0.17, face * 0.92);   // 얼굴 저열 — 0.10 은 광나는 구슬처럼 떴다(유저). 살짝 톤을 남긴다
  // ★ 얼굴 아래 리프트 — 가드를 올리면 얼굴·목·가슴이 한 덩어리로 붙어 글러브와 구분이
  //   안 됐다(유저 08-04). 실측: 얼굴 휘도 108 · 가슴 110 — 둘이 사실상 같은 색이었다.
  //   (글러브는 148~159 로 이미 충분히 밝다 — 문제는 얼굴↔가슴이었다)
  //   은닉 범위를 좁히는 걸로는 못 푼다. 좁히면 이목구비가 뜨고 넓히면 글러브를 먹는다.
  //   그래서 **얼굴 타원 바로 아래**만 band 를 올려 목–턱에 경계를 만든다.
  //   uFaceLift = 0 이면 이 항이 통째로 죽는다 — 러닝·농구는 손대지 않는다(기본 0).
  if (uFaceLift > 0.0 && uFaceE.z > 0.0) {
    float dx = (uv.x - uFaceE.x) / max(uFaceE.z, 1e-4);
    float below = (uFaceE.y - uv.y) / max(uFaceE.w, 1e-4);   // 얼굴 아래로 얼마나 (uv.y 는 위로 +)
    //   가로는 얼굴 폭 안, 세로는 타원 아래 0.6~2.4 반경 구간. 얼굴 자체(face)에는 안 건다.
    float lift = smoothstep(0.6, 1.3, below) * (1.0 - smoothstep(2.0, 2.8, below))
               * (1.0 - smoothstep(0.9, 1.7, abs(dx))) * (1.0 - face);
    band = min(1.0, band + uFaceLift * lift);
  }
  // 얇은 부위(팔·다리) 심화 — wide 낮음 = 얇음. 유저: "다리만 조금 더 진하게"
  band = min(1.0, band + 0.115 * (1.0 - smoothstep(0.40, 0.75, wide)) * (1.0 - face));   // 다리가 최심 주황(#FF3300 대)까지 닿게(유저)
  // ⚠ 세로 부위 프로파일(허리·무릎·종아리 대역)은 **폐기** — A1 처럼 크롭된 판에선 uv 가
  //   신체 좌표가 아니라서 허리 밴드가 셔츠 밑단의 붉은 줄무늬로 찍혔다(같은 프레임 대조 실측).
  //   부위 대비는 포즈 없인 안전하게 재현 불가 — stdG 일부 손해를 감수한다.
  // 최상단 소프트 숄더 — 최고열 포화 완화(러닝 hot-tail p10 실측 보정)
  band -= 0.06 * smoothstep(0.88, 1.0, band);
  // Contour 림(룩2 1.0 · 앱 rim = (열−아우라열)·0.9) — 아우라열 근사 = base 톤
  // 림은 두꺼운 부위(몸통)에서만 — 얇은 팔다리에선 위쪽 모서리를 따라 진한 줄이 생겨
  //   면이 두 줄로 갈라져 보였다(유저 #70). wide(마스크 블러)가 낮은 곳 = 얇은 부위.
  float rim = max(0.0, band - bandB) * 0.45 * (1.0 - face) * smoothstep(0.40, 0.75, wide);
  // 웨이브(세기 1.04 · 속도 1.32 · 밴드 1.95) — 얼굴·반투명 경계 통과 금지
  float ta = tSec * 1.32;
  float wc = uv.y / 1.95;
  float wave = 1.0 + 1.04 * uPCalWave * (-0.13
    + 0.18 * sin(6.2832 * (wc * 1.4 - ta * 0.10))
    + 0.09 * sin(6.2832 * (wc * 3.1 + ta * 0.07) + uv.x * 2.0));
  wave = mix(wave, 1.0, face);
  float t = band * mix(1.0, wave, mBody * mBody) + rim;
  // ★ 디더는 **정적**으로 — 시드에 시간(ta)을 섞으면 그레인이 매 프레임 기어다닌다
  //   (유저: "자글자글 너무 싫어"). 밴딩 해소엔 고정 패턴이면 충분하다. 진폭도 축소.
  float dth = (fract(sin(dot(uv * 1483.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5)
            * (0.006 + face * 0.010);
  vec3 c = look2Ramp(clamp(t + dth, 0.0, 1.0));
  // 채도 부스트(유저 최종 요청: "제발 채도 올려줘") — 무채 축 기준 1.28배.
  //   회색 바닥·밝은 코트 위에서 살몬이 먼지빛으로 읽히는 것을 원천 보정.
  float cGray = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(mix(vec3(cGray), c, 1.28), 0.0, 1.0);
  // 흰 레이어 3종 — 앱 원값(이너섀도 0.28×0.75 · 라인 0.24×0.9 · 내부라인 0.14)
  // 피더는 **가장자리로만** — 얇은 팔다리는 마스크 블러가 안쪽까지 번져 (m−wide)가 사지
  //   전체에서 커지고, 흰 띠가 다리 전면을 덮어 하얗게 떴다(유저: 다리가 너무 하얗다).
  float feather = pow(clamp((mBody - wide) * 2.0, 0.0, 1.0), 2.0);
  c = mix(c, vec3(1.0), clamp(feather * 0.24 * uPCalW, 0.0, 1.0));
  // ★ 라인 강도 = 앱 스펙으로 복원(0.41→0.22 · 0.27→0.14). 어느 시점에 ~2배로 드리프트돼
  //   얇은 다리 윗 실루엣이 두꺼운 흰 줄로 떴다(유저 스샷 08-04, A2 런지). 룩2 원값:
  //   라인 0.24×0.9 · 내부라인 0.14 — 앱 화면(유저가 '이쁘다'한 그 그림)의 절반 강도가 정답.
  float line = pow(4.0 * mBody * (1.0 - mBody), 1.5) * smoothstep(0.35, 0.6, mBody);
  c = mix(c, vec3(1.0), clamp(line * 0.22 * uPCalW, 0.0, 1.0));
  float lineIn = sqrt(clamp(abs(ls - lb) * 2.6, 0.0, 1.0)) * (1.0 - face);
  c = mix(c, vec3(1.0), clamp(lineIn * 0.14 * uPCalW, 0.0, 1.0));
  return vec4(clamp(c, 0.0, 1.0) * mBody, mBody);
}
`,qa=`
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
//   uImpDotCol: 각인 **도트** 팔레트 선택(0 흰 · 1 샌드 · 2 코랄 · 3 레드). 예전엔 C_CREAM(=SAND)
//   하드코딩이라 랩에서 만질 수가 없었다(유저 08-05). 음영·파동과 같은 palPick 규약.
// 필 전용 불투명도 — 랩 '투명도 op'. uFade 는 **전부**를 깎아 도트·라인·글리프까지 같이 사라졌다
//   (유저 08-05). op 는 말 그대로 '필(코랄 면)만' 투명해져야 하므로 필 알파에만 곱한다.
uniform float uFillOp;
uniform vec2 uImpCtr, uImpOff;
uniform float uImpDotCol;
// 파동(리플) — 실루엣 **등거리선**을 따라 퍼진다. uRip 0 = 도입 전과 픽셀 동일.
//   유저 지적: 지금 파동이 단순 원형 파장이라 발자국 위에서 따로 놀고, 퍼짐이 과하거나 쨍하다.
//   부호거리로 몰면 파면이 형태를 따라간다 — 발형은 발 모양, 원형은 원. 토큰이 늘어도 파동은 하나다.
//   uRipGrad: 파동을 단색 대신 **뉴턴 LUT 그라디언트**로. 0 = 단색(uRipCol) · 1 = 완전 LUT.
//     갓 나온 파면이 상단(백열)이고 퍼질수록 하단(적)으로 식는다 — "모든 것은 온도다" 규약을
//     파동에도 그대로 적용한 것. 색을 새로 만드는 게 아니라 있는 LUT 를 훑는다.
uniform float uRip, uRipSpeed, uRipWidth, uRipReach, uRipCol, uRipGrad;
// 진행 아크의 감김 — 0 이면 기존(로컬 12시에서 시계방향), 1 이면 화면 기준으로 뒤집는다.
//   지면 토큰은 쿼드가 바닥에 누워(−90° X) 감김이 반대로 읽혀 '먼 쪽에서 반시계로 크게
//   그리며' 등장했다(유저 신고). 종목마다 원하는 게 달라 유니폼으로 뺀다 — 지금은 농구만 1.
uniform float uArcRev;
// ── 족저 압력장 · 등고선 ────────────────────────────────────────────────────
//   유저 레퍼런스: Nike Free 압력맵 / 인솔 프레셔 맵. 핵심은 색이 아니라 **색을 정하는 입력**이다.
//   지금까지는 '중심에서의 거리'였다 — 그래서 아무리 색을 풍부하게 해도 압력 분포가 아니라
//   그라디언트 칠한 원반으로 읽혔다(유저: 너무 도형 같다 · 섬세한 미학이 없다).
//   uPlantar: 압력장 혼합(0 = 옛 방사 · 1 = 압력장). 발형은 해부학 핫스팟, 원형은 중심 압력.
//   uBands:   등고선 단계 수(0 = 연속). 레퍼런스의 계단 밴드가 '데이터'로 읽히게 하는 장치.
//   uBandSoft: 밴드 경계 무름(0 = 칼금 · 1 = 뭉근).
uniform float uPlantar, uBands, uBandSoft;
//   uLoadBall/Heel/Toe = **하중 배분**(marklang LOAD). 기본값이 곧 옛 상수라 안 건드리면 픽셀 동일.
//     이게 없어서 압력장이 전 상태 공통 한 벌이었다 — "앞꿈치에 힘 실어라"를 그림이 말할 수 없었다.
uniform float uLoadBall, uLoadHeel, uLoadToe;
//   uLoadGain = 하중 세기 · uLoadBase = 비접지 바닥(낮출수록 접지 대비가 산다) · uFlow = 딛는 흐름.
//     기본 1 / 0.30 / 0 이면 도입 전과 픽셀 동일(롤백 지점). 색은 손대지 않는다 —
//     앞볼 피크는 이미 lut(0.076)=#FA3030(팔레트 최강)이고, 별도 램프는 금지다(fillT 주석).
//     세지는 길은 **면적과 대비**뿐이다.
uniform float uLoadGain, uLoadBase, uFlow;
// uSilFit: 실루엣이 쿼드에서 차지하는 비율(기준 0.78 대비). 1 = 옛 그대로.
//   ext·해부학 좌표는 '0.78 로 구웠을 때' 기준의 uv 값이라, 채움비가 바뀌면 같이 줄어야 한다.
uniform float uEdgeShade, uEdgeW, uEdgeSoft, uDither, uSilFit;
uniform float uEdgeShadeW, uEdgeShadeCol;   // 실루엣 이너 섀도우 면적 배율 · 팔레트 색(0흰/1샌드/2코랄/3레드) — 유저: 면적·색 조정
uniform float uIceOld;   // 1 = 아이스 컷 이전(하늘색) 램프 — 비교 미리보기용 토글(유저)
uniform float uTLo, uTHi, uDotMode;   // 상태 온도 창(색 축) — 0 = 미설정(각 상태 기본 창)
uniform float uEdgeShadeGrad, uEdgeShadeG0, uEdgeShadeG1;   // 이너 섀도우 LUT 그라디언트(0 단색) · 시작/끝 LUT 위치 — 섬세 조정(유저)
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
  blob = uLoadBase + (uLoadBall * ball + uLoadHeel * heel + uLoadToe * toe) * uLoadGain - 0.34 * arch;
  // ── 딛는 흐름 ─────────────────────────────────────────────────────────────
  //   하중 중심(발 장축)에서 **뒤로 길게 끌리고 앞은 짧게 끊긴다**. 앞뒤 비대칭이 곧 방향이다 —
  //   대칭이면 그냥 얼룩이고, 비대칭이라야 체중이 뒤에서 앞으로 구르는 중으로 읽힌다.
  //   중심은 선언하지 않는다: 하중 배분(uLoad*)에서 자동으로 나온다. 두 벌이 되면 반드시 어긋난다.
  if (uFlow > 0.001) {
    float wsum = max(uLoadBall + uLoadHeel + uLoadToe, 1e-3);
    float cy = (uLoadBall * 0.30 + uLoadHeel * (-0.44) + uLoadToe * 0.56) / wsum;
    float dy = p.y - cy;
    float tail = exp(-pow(max(-dy, 0.0) / 0.62, 2.0));   // 지나온 쪽 — 길게 남는다
    float head = exp(-pow(max( dy, 0.0) / 0.22, 2.0));   // 가는 쪽 — 짧게 끊긴다
    blob += uFlow * max(tail * 0.55, head);
  }
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
#define C_RED   ${$(g.red)}
#define C_CORAL ${$(g.coral)}
#define C_SAND  ${$(g.sand)}
#define C_ICE   ${$(g.prism)}
#define C_CREAM C_SAND
#define C_GRAYF ${$(J.hi)}
#define C_GRAYL ${$(J.lo)}
#define C_RIMG  C_GRAYL
#define C_WINE  C_SAND
#define C_BRICK C_CORAL
#define C_EXCL  C_RED
/** 팔레트 색 선택 — 유채는 4색뿐이라는 규칙(palette.js ①)을 셰이더에서도 그대로 강제한다.
 *  0 흰(PRISM) · 1 샌드 · 2 코랄 · 3 레드. 인덱스 밖은 흰색으로 떨어진다.
 *  ★ 반드시 위 #define C_* 뒤에 와야 한다 — 앞에 두면 색 상수가 아직 없어 셰이더가 통째로 죽는다. */
vec3 palPick(float i){
  // 0 PRISM(#D1FEFF · 하늘빛) · 1 SAND · 2 CORAL · 3 RED · 4 순백
  //   ★ 4(순백)는 나중에 붙였다 — 랩 버튼이 0 을 '흰'이라 불렀지만 실제로는 PRISM 이라,
  //     발자국 각인·이너 섀도우가 통째로 푸른끼를 띠었다(유저 08-05). 인덱스 0~3 의미는
  //     저장본 호환을 위해 건드리지 않고, 진짜 흰색을 4 로 추가한다.
  return i < 0.5 ? C_ICE : i < 1.5 ? C_SAND : i < 2.5 ? C_CORAL : i < 3.5 ? C_RED : vec3(1.0);
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
#define T_PREV_HI mix(0.93, 0.99, uIceOld)   // 아이스 컷(신) ↔ 구 하늘 램프 — uIceOld 토글
#define T_HOT_LO  0.10
#define T_HOT_HI  mix(0.94, 1.00, uIceOld)
#define T_ACT_LO  0.06
#define T_ACT_HI  0.86   // 몸체 상한 = SAND 정점 — 더 진한 주황(유저 2차)
#define T_HOLD_LO 0.04
#define T_HOLD_HI mix(0.89, 0.92, uIceOld)
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
// ★★ **상태 색 축**(유저: 색 조합을 쨍한 빨강부터 연한 주황까지 그라디언트로 구분).
//   상태의 정체성은 '온도 창(lo~hi)'이 정한다고 이 파일이 이미 적어 뒀는데, 그 창이 #define
//   컴파일 상수라 **상태별로 못 움직였다** — 그래서 Active·Warning·Success 가 같은 대역에서
//   뭉쳐 구분이 안 갔고(유저), 결국 외곽선·해칭 같은 **다른 축으로 구분하려는 시도**가 생겼다.
//   창을 uniform 으로 열면 색 하나로 갈린다: uTHi 0 = 미설정 → 각 상태의 기존 창 그대로(픽셀 동일).
//   ※ 규칙은 그대로다 — 새 색을 만들지 않는다. 같은 뉴턴 LUT 의 **다른 구간**을 쓸 뿐이다.
vec3 fillWin(float q, float lo, float hi){
  return (uTHi > 0.0001) ? fillT(q, uTLo, uTHi) : fillT(q, lo, hi);
}
vec3 fillPreview(float q){ return fillWin(q, T_PREV_LO, T_PREV_HI); }
vec3 fillHot(float q){     return fillWin(q, T_HOT_LO,  T_HOT_HI);  }
vec3 fillActive(float q){  return fillWin(q, T_ACT_LO,  T_ACT_HI);  }
vec3 fillHold(float q){    return fillWin(q, T_HOLD_LO, T_HOLD_HI); }
// Success 는 코어가 가장 뜨겁고(하한이 낮다) 바깥이 백열로 열린다 — 승리의 온도.
// 상한을 1.0(순백) 이 아니라 0.92 로 — 순백까지 열면 코어와 분리된 흰 링이 생긴다(유저: 아이스 과함).
vec3 fillSuccess(float q){ return fillWin(q, mix(0.02, 0.03, uIceOld), mix(0.78, 1.00, uIceOld)); }   // 신 = 피그마 성공 정본(163:8908) 쨍한 레드-코랄 · 구 = 백열/아이스
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
  // 진행 각도 — 12시에서 시작해 **시계방향**.
  //   지면 토큰은 쿼드가 바닥에 누워(−90° X) 있어 감김이 뒤집힌다. 그래서 화면에서는
  //   '먼 쪽에서 반시계로 크게 그리며' 등장하는 것으로 읽혔다(유저 신고). 부호를 뒤집어
  //   화면 기준 시계방향으로 맞춘다.
  //   uArcRev 1 = 앞쪽(가까운 쪽)에서 시작해 화면 기준 시계방향. 지금은 농구만.
  float a01 = uArcRev > 0.5 ? fract(0.75 + ang / 6.2832) : fract(0.25 - ang / 6.2832);
  float u1 = mkUndul(ang + uSeed, t * 1.6);
  float sd = mkSD(uv, u1);
  float aa = max(fwidth(sd), 0.004) * 1.4;     // 화면공간 AA
  float inside = smoothstep(aa, -aa, sd);
  // 필 전용 소프트 엣지 — 우리 UI 의 강점은 그라디언트의 부드러움인데, 하드 마스크가 경계에
  //   선을 그어 원반처럼 보이게 했다(유저). 안쪽으로 uEdgeW 만큼 페더링해 형태가 색으로 읽히게.
  float feath = smoothstep(0.0, max(uEdgeW, 1e-4), -sd);
  float inFill = mix(inside, inside * feath, clamp(uEdgeSoft, 0.0, 1.0)) * clamp(uFillOp, 0.0, 1.0);
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
    // 굵기 1.55배 — 얇은 스트로크가 실사 바닥 텍스처에 묻혀 홀드 진행이 안 읽혔다(유저).
    float strokeW = max(0.040 * uW, 1.6 * fw);
    float dRim = abs(sd + 0.008);              // 실루엣 살짝 안쪽에 얹는다
    // 진행 좌표: 0(시작) → pr(선단). 양끝 블러 폭은 각도 단위.
    // 마감 수렴(유저): 진행이 끝나는 순간 링이 12시에서 '한 바퀴 닫혔다'로 읽혀야 한다.
    //   평시 블러 0.16(≈58°)은 부드럽지만, 그대로면 선단·시작 페이드가 12시에서 겹쳐 끝까지
    //   틈이 남는다 → 막판(86%~)에 양끝 블러를 조여 원이 닫히고, 완주 프레임은 풀 링.
    float closeK = smoothstep(0.86, 1.0, pr);
    float BLUR = mix(0.16, 0.035, closeK);
    float head = clamp(pr, 0.0, 1.0);
    float aIn  = smoothstep(0.0, BLUR, a01);                    // 시작 쪽 블러
    float aOut = smoothstep(head + BLUR * 0.10, head - BLUR, a01);  // 선단 쪽 블러
    float body = max(aIn * aOut, step(0.9975, pr)) * smoothstep(0.0, 0.04, pr);
    // 폭도 같이 좁아진다 — 알파만 줄이면 '가늘어지지 않고 흐려지기만' 해서 잘린 끝으로 읽힌다.
    float wk = mix(0.16, 1.0, body);
    float rn = dRim / max(strokeW * wk, 1e-5);
    float stroke = exp(-rn * rn * 1.5) * dashM;
    // 소프트 글로우 겹 — 스트로크보다 3배 넓고 옅은 후광. 복잡한 실사 위에서 궤적의 존재를
    //   먼저 잡아주는 층(빛 언어 유지 — 어두운 외곽선 금지 원칙).
    float glowRim = exp(-rn * rn * 0.17) * dashM;
    // 길이 방향 그라디언트 — 지나온 쪽은 LUT 저역(진한 빨강), 선단으로 갈수록 상단(민트)
    vec3 strokeCol = lut(clamp(mix(0.02, 1.0, clamp(a01 / max(head, 0.001), 0.0, 1.0)), 0.0, 1.0));
    holdC = strokeCol;
    holdA = max(stroke * body * 0.95, glowRim * body * 0.34);
    // 선단 광점 — 지금 어디까지 왔는지 한 점으로 읽히게. 가우시안이라 각이 안 진다.
    float hd = (a01 - head) / 0.12;   // 광점 0.09→0.12 — '지금 어디'가 실사에서도 잡히게
    float tip = exp(-hd * hd) * step(0.02, pr) * step(pr, 0.995);
    holdC = mix(holdC, lut(1.0), clamp(tip, 0.0, 1.0));
    holdA = max(holdA, max(stroke, glowRim * 0.6) * tip);
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
    float shW = max(uEdgeW * 0.9 * clamp(uEdgeShadeW, 0.05, 6.0), 1e-4);
    float ins = exp(-pow(max(-sd, 0.0) / shW, 1.1)) * inside;
    // 섀도우 색 = 팔레트 단색(uEdgeShadeCol) ↔ 뉴턴 LUT 그라디언트(uEdgeShadeGrad).
    //   그라디언트는 **라인을 따라** 흐른다(유저: 깊이 방향이 아니라 윤곽선 자체에 아름답게) —
    //   앞꿈치(G0)→뒤꿈치(G1)로 발 길이 방향을 LUT 로 훑는다. 색을 새로 만들지 않는다(팔레트 규약).
    float shAlong = clamp(uv.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 shCol = mix(palPick(uEdgeShadeCol), lut(mix(uEdgeShadeG0, uEdgeShadeG1, shAlong)), clamp(uEdgeShadeGrad, 0.0, 1.0));
    lay(A, shCol, ins * uEdgeShade);
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
    // ★ 도트 농도 = 압력 (유저 08-06 레퍼런스: 나이키 깔창 — 도트 농도가 곧 압력이다).
    //   전엔 dep(경계로부터의 깊이)만 썼다. plantar 가 만든 볼·뒤꿈치·아치 분포가 **도트에는
    //   하나도 안 실려서**, 압력은 필 색 램프에만 은근히 있고 도트는 발 전체에 균일하게 깔렸다.
    //   격자·피치·점 크기·이너 섀도우는 그대로 두고(스타일 동결) **압력 없는 자리에서 도트를
    //   걷어내기만** 한다 — 아치가 비는 순간 그림이 발자국으로 읽힌다.
    //   최대치 1.0 유지 = 고압부는 도입 전과 동일. uPlantar 0 이면 전 픽셀 동일(롤백 지점).
    float prI = plantar(uv, sdIn, sd);
    float press = mix(1.0, 0.16 + 0.84 * prI, clamp(uPlantar, 0.0, 1.0));
    // 도트 색 = 압력 온도. 전엔 단색이라 알파만 압력을 탔고, 고압부의 지정색(레드)이
    //   그 아래 필(연주황)과 색이 안 이어져 해칭이 통째로 끊겨 보였다(유저 08-06).
    //   압력이 빠질수록 LUT 를 따라 주황(coral t=0.56) → 연주황(sand t=0.86) 으로 식는다 —
    //   필이 이미 그 구간에 있으므로 경계가 사라진다. 새 색은 만들지 않는다(유채 4색 규칙).
    //   ※ 지정 팔레트색(uImpDotCol)은 **극성을 뒤집는 원인**이라 도트에서 은퇴했다(유저 08-06).
    //     선언은 남겨 둔다 — 저장본 호환(랩 버튼)과 다른 소비처가 있다.
    // ★ 도트 색 = **3안 비교용 유니폼**(유저: 버전들 버튼으로 눌러 보게 해줘).
    //   0 = 단색 순백(09:25 저장본 · 각인이 필과 다른 색이라 발가락·아치 형태가 산다)
    //   1 = 압력 온도 그라디언트(13:31) — 저압 연주황 → 고압 순백
    //   2 = 상태 온도 창 안으로 클램프(14:23) — 필과 같은 계열, 극성 고정
    //   기본 0. 랩에서만 갈아 끼운다(mark-look.json dotMode 로도 저장 가능).
    float dotT = clamp(press * dep, 0.0, 1.0);
    vec3 dotSolid = palPick(uImpDotCol);
    vec3 dotGrad  = mix(lut(mix(0.86, 0.56, dotT)), palPick(uImpDotCol), smoothstep(0.72, 1.0, dotT));
    float dwHi = (uTHi > 0.0001) ? uTHi : 0.86;
    float dwLo = (uTHi > 0.0001) ? uTLo : 0.56;
    vec3 dotWin   = lut(mix(dwHi, mix(dwHi, dwLo, 0.65), dotT));
    vec3 dotC = (uDotMode < 0.5) ? dotSolid : (uDotMode < 1.5 ? dotGrad : dotWin);
    lay(A, dotC, inIn * dotM * uImp * (0.06 + 0.94 * dep) * press);
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
}`;function Ma(a,t,o,c){a.lineWidth=4*t;const s=c.arrow;s.line==="dash"?a.setLineDash([12*t*s.gap,10*s.gap]):s.line==="dot"?(a.setLineDash([.5,12*s.gap]),a.lineCap="round",a.lineWidth=5*t):a.setLineDash([]),o!=null&&s.line!=="solid"&&s.line!=="taper"&&(a.lineDashOffset=-o*40*s.speed)}function ga(a,t,o,c,s,e={}){const r=s.lut,h=s.arrow||{},f=h.w??1,b=h.speed??1,u=h.glow??1,d=e.pulse??1,l=o/256,i=l*(e.scale??1),n=t/2,v=c*.9*b%1,P=e.prog!=null?Math.max(0,Math.min(1,e.prog)):Math.min(1,v/.55),T=e.prog!=null?1:v>.88?(1-v)/.12:1;a.clearRect(0,0,t,o);const w=T*(.45+.55*d),L=o-24*l,k=58*l,y=L+(k-L)*P,x=(R,A)=>r(R).replace("rgb(","rgba(").replace(")",`,${A.toFixed(3)})`),p=1.1*i*f,m=13*i*f,S=42*i*(.7+.3*f),D=!e.noTip&&P>.28?Math.min(1,(P-.28)/.22)*S*.42:0,I=y+D,C=a.createLinearGradient(0,L,0,I);C.addColorStop(0,x(.55,0)),C.addColorStop(.18,x(.64,.3*w)),C.addColorStop(.4,x(.76,.8*w)),C.addColorStop(.65,x(.88,.98*w)),C.addColorStop(1,x(.97,w));const _=e.dots?(()=>{const R=Math.abs(I-L),A=Math.max(3,Math.round(R/(9.5*i))),F=c*1.15*b%1,E=(q,W,M)=>{const B=Math.max(0,Math.min(1,(M-q)/(W-q)));return B*B*(3-2*B)},H=[];for(let q=0;q<A;q++){const W=((q+.5)/A+F/A)%1,M=1+.22*Math.sin((W*3-F*2)*Math.PI*2);H.push({y:L+(I-L)*W,r:(p/2+(m/2-p/2)*W)*M,a:(1-.35*E(.72,.92,W))*(1-E(.92,1,W))})}return H})():null;if(a.save(),a.filter=`blur(${7*i}px)`,a.globalAlpha=e.dots?.3:.55,a.fillStyle=C,e.dots){const R=a.globalAlpha;for(const A of _)a.globalAlpha=R*A.a,a.beginPath(),a.arc(n,A.y,Math.max(1.4*i,A.r*1.5),0,Math.PI*2),a.fill();a.globalAlpha=R}else a.beginPath(),a.moveTo(n-p,L),a.lineTo(n+p,L),a.lineTo(n+m*.95,I),a.lineTo(n-m*.95,I),a.closePath(),a.fill();if(a.restore(),a.globalAlpha=1,a.fillStyle=C,e.dots){for(const R of _)a.globalAlpha=R.a,a.beginPath(),a.arc(n,R.y,Math.max(.9*i,R.r*.92),0,Math.PI*2),a.fill();a.globalAlpha=1}else a.beginPath(),a.moveTo(n-p/2,L),a.lineTo(n+p/2,L),a.lineTo(n+m/2,I),a.lineTo(n-m/2,I),a.closePath(),a.fill();if(a.globalAlpha=w,P>.28&&!e.noTip){const R=S,A=Math.min(1,(P-.28)/.22)*w,F=y+R*.3;a.globalAlpha=A;const E={color:r(.95),glowColor:r(.85),glow:12*u};s.glyph&&(s.glyph(a,"LIFT_TIP",n,F,R,E)||s.glyph(a,"TIP_TRI",n,F,R*.93,E))||(a.strokeStyle=r(.95),a.lineWidth=13*i*f,a.lineCap="round",a.lineJoin="round",a.shadowColor=r(.9),a.shadowBlur=18*i*u,a.beginPath(),a.moveTo(n-26*i,F+14*i),a.lineTo(n,F-16*i),a.lineTo(n+26*i,F+14*i),a.stroke())}a.globalAlpha=1,a.shadowBlur=0}function Ta(a,t,o,c,s,e,r={}){const h=e.lut,f=e.arrow||{},b=f.w??1,u=f.glow??1,d=o/256*(r.scale??1);a.clearRect(0,0,t,o);const l=c.map(([x,p])=>[x*t,p*o]);if(l.length<2)return;const i=48,n=[],v=x=>{if(l.length===2)return[l[0][0]+(l[1][0]-l[0][0])*x,l[0][1]+(l[1][1]-l[0][1])*x];const p=x*(l.length-1),m=Math.min(l.length-2,Math.floor(p)),S=p-m,D=l[Math.max(0,m-1)],I=l[m],C=l[m+1],_=l[Math.min(l.length-1,m+2)],R=(A,F,E,H)=>.5*(2*F+(-A+E)*S+(2*A-5*F+4*E-H)*S*S+(-A+3*F-3*E+H)*S*S*S);return[R(D[0],I[0],C[0],_[0]),R(D[1],I[1],C[1],_[1])]};for(let x=0;x<=i;x++)n.push(v(x/i));const P=Math.max(0,Math.min(1,r.prog!=null?r.prog:s*.55%1)),T=Math.max(1,Math.round(i*P)),w=r.alpha??1,L=r.tail??.22;a.lineCap="round";const k=42*d*(.7+.3*b);let y=T;if(P>.28){let x=0;const p=k*.42*Math.min(1,(P-.28)/.22);for(;y>1&&x<p;)x+=Math.hypot(n[y][0]-n[y-1][0],n[y][1]-n[y-1][1]),y--}for(const x of[0,1])for(let p=1;p<=y;p++){const m=p/T,S=Math.min(1,m/L),D=S*S*(3-2*S)*w;a.globalAlpha=x?D:D*.16*m,a.strokeStyle=h(.55+.42*m),a.lineWidth=(1.1+11.9*m)*d*b*(x?1:1.9),a.beginPath(),a.moveTo(n[p-1][0],n[p-1][1]),a.lineTo(n[p][0],n[p][1]),a.stroke()}if(P>.28){const x=n[Math.max(0,T-2)][0],p=n[Math.max(0,T-2)][1],m=Math.atan2(n[T][1]-p,n[T][0]-x)+Math.PI/2,S=n[T][0]-Math.sin(m)*k*.3,D=n[T][1]+Math.cos(m)*k*.3;a.save(),a.translate(S,D),a.rotate(m),a.globalAlpha=Math.min(1,(P-.28)/.22)*w;const I={color:h(.95),glowColor:h(.85),glow:12*u};e.glyph&&(e.glyph(a,"LIFT_TIP",0,0,k,I)||e.glyph(a,"TIP_TRI",0,0,k*.93,I))||(a.strokeStyle=h(.95),a.lineWidth=9*d*b,a.lineJoin="round",a.lineCap="round",a.beginPath(),a.moveTo(-18*d,12*d),a.lineTo(0,-14*d),a.lineTo(18*d,12*d),a.stroke()),a.restore()}a.globalAlpha=1}function La(a,t,o,c,s,e){s=s||{};const r=e.lut,h=s.style||e.arrow.line,f=!!s.closed,b=[0];for(let i=1;i<t.length;i++)b.push(b[i-1]+Math.hypot(t[i][0]-t[i-1][0],t[i][1]-t[i-1][1]));const u=b[b.length-1]||1,d=i=>{i=(i%u+u)%u;let n=1;for(;n<b.length-1&&b[n]<i;)n++;const v=(i-b[n-1])/Math.max(1e-4,b[n]-b[n-1]);return[t[n-1][0]+(t[n][0]-t[n-1][0])*v,t[n-1][1]+(t[n][1]-t[n-1][1])*v,Math.atan2(t[n][1]-t[n-1][1],t[n][0]-t[n-1][0])]},l=e.arrow;if(h==="chevron"){const i=(26*c+8)*l.gap,n=Math.max(2,Math.floor(u/i));a.shadowColor=r(Math.min(1,l.heat+.2)),a.shadowBlur=8*c*l.glow;for(let v=0;v<n;v++){const P=v*i+o*42*l.speed%i;if(!f&&P>u-4)continue;const[T,w,L]=d(P),k=7.5*c,y=8.5*c,x=.45+.4*Math.sin(P/u*6.283-o*2.2*l.speed);a.strokeStyle=r(l.heat-.05+x*.3),a.lineWidth=3.2*c,a.lineJoin="round",a.lineCap="round",a.save(),a.translate(T,w),a.rotate(L),a.beginPath(),a.moveTo(-y*.5,-k),a.lineTo(y*.5,0),a.lineTo(-y*.5,k),a.stroke(),a.restore()}return!0}if(h==="comet"){const i=o*.35*l.speed%1*u,n=u*l.tail,v=Math.max(24,t.length*2);a.lineCap="round";for(let w=0;w<v;w++){const L=i-w/v*n,k=i-(w+1)/v*n;if(!f&&k<0)break;const y=1-w/v,[x,p]=d(L),[m,S]=d(k);!f&&Math.hypot(m-x,S-p)>u*.4||(a.globalAlpha=Math.pow(y,1.6),a.strokeStyle=r(Math.max(.05,l.heat-.2)+y*.55),a.lineWidth=(1.5+y*4.5)*c,y>.72?(a.shadowColor=r(Math.min(1,l.heat+.3)),a.shadowBlur=y*12*c*l.glow):a.shadowBlur=0,a.beginPath(),a.moveTo(x,p),a.lineTo(m,S),a.stroke())}a.globalAlpha=1,a.lineCap="butt",a.shadowBlur=0;const[P,T]=d(i);return a.fillStyle=rgba(J.ink,.95),a.shadowColor=r(.9),a.shadowBlur=16*c,a.beginPath(),a.arc(P,T,2.6*c,0,7),a.fill(),a.shadowBlur=0,!0}if(a.strokeStyle=s.color||r(l.heat),a.shadowColor=r(Math.min(1,l.heat+.15)),a.shadowBlur=(s.glow??8)*c*l.glow,h==="taper")for(let i=1;i<t.length;i++)a.lineWidth=(.5+i/t.length*4.5)*c,a.beginPath(),a.moveTo(t[i-1][0],t[i-1][1]),a.lineTo(t[i][0],t[i][1]),a.stroke();else Ma(a,c,o,e),a.beginPath(),t.forEach(([i,n],v)=>v?a.lineTo(i,n):a.moveTo(i,n)),f&&a.closePath(),a.stroke();return a.setLineDash([]),a.lineCap="butt",a.lineDashOffset=0,a.shadowBlur=0,!0}function Ka(a,t,o,c,s,e){const r=13*c.halo,h=e.lut;a.clearRect(0,0,t,t),a.lineJoin="round";const f=t/220,b=t/2,u=18*o.round*f,d=40*f,l=48*f,i=t-80*f,n=t-96*f,v=[],P=(w,L,k,y)=>{for(let x=0;x<=1;x+=.12)v.push([w+(k-w)*x,L+(y-L)*x])};P(d+u,l,d+i-u,l),P(d+i,l+u,d+i,l+n-u),P(d+i-u,l+n,d+u,l+n),P(d,l+n-u,d,l+u),a.shadowColor=h(.6),a.shadowBlur=r*.8;const T=4*e.arrow.w*f;if(e.arrow.line==="solid"?(a.setLineDash([10*o.dash*f,8*f]),a.lineDashOffset=-s*22*f,a.strokeStyle=h(.45),a.lineWidth=T,a.beginPath(),a.roundRect(d,l,i,n,u),a.stroke(),a.setLineDash([]),a.lineDashOffset=0):La(a,v,s,e.arrow.w*f,{color:h(.45),closed:!0},e),o.prog!=null&&o.prog>.001){const w=[],L=(C,_,R,A,F)=>{for(let E=1;E<=F;E++)w.push([C+(R-C)*E/F,_+(A-_)*E/F])},k=(C,_,R,A,F)=>{for(let E=1;E<=F;E++){const H=R+(A-R)*E/F;w.push([C+u*Math.cos(H),_+u*Math.sin(H)])}},y=Math.PI/2,x=d+i,p=l+n,m=d+i/2;w.push([m,l]),L(m,l,x-u,l,8),k(x-u,l+u,-y,0,6),L(x,l+u,x,p-u,10),k(x-u,p-u,0,y,6),L(x-u,p,d+u,p,14),k(d+u,p-u,y,Math.PI,6),L(d,p-u,d,l+u,10),k(d+u,l+u,Math.PI,Math.PI+y,6),L(d+u,l,m,l,8);let S=0;for(let C=1;C<w.length;C++)S+=Math.hypot(w[C][0]-w[C-1][0],w[C][1]-w[C-1][1]);const D=S*Math.min(1,o.prog);a.save(),a.setLineDash([10*o.dash*f,8*f]),a.lineDashOffset=-(i/2-u)-s*22*f,a.strokeStyle=h(.9),a.lineWidth=T*1.3,a.lineCap="round",a.shadowColor=h(.92),a.shadowBlur=r*1.3,a.beginPath(),a.moveTo(w[0][0],w[0][1]);let I=0;for(let C=1;C<w.length&&I<D;C++){const _=Math.hypot(w[C][0]-w[C-1][0],w[C][1]-w[C-1][1]);if(I+_<=D)a.lineTo(w[C][0],w[C][1]),I+=_;else{const R=(D-I)/_;a.lineTo(w[C-1][0]+(w[C][0]-w[C-1][0])*R,w[C-1][1]+(w[C][1]-w[C-1][1])*R),I=D}}a.stroke(),a.setLineDash([]),a.restore()}o.feet>.05&&e.foot&&(e.foot(a,!1,b-16*o.feet*f,b+6*f,26*o.feet*f),e.foot(a,!0,b+16*o.feet*f,b+6*f,26*o.feet*f)),a.shadowBlur=0}function $a(a,t,o,c,s,e,r,h){const f=13*c.halo,b=4*e.arrow.w*(t/220),u=e.lut;a.clearRect(0,0,t,t),a.lineJoin="round";const d=t/220,l=r||[[45*d,130*d],[110*d,60*d],[175*d,110*d]],i=h??s*.5%1,n=Math.min(1,i*1.25)*(l.length-1),v=Math.min(l.length-1,Math.floor(n+.35));a.shadowColor=u(.7),a.shadowBlur=f;const P=p=>{const m=Math.max(0,Math.min(l.length-2,Math.floor(p))),S=p-m;return[l[m][0]+(l[m+1][0]-l[m][0])*S,l[m][1]+(l[m+1][1]-l[m][1])*S]},T=o.comet!=null?o.comet:1,w=o.tailLen!=null?o.tailLen:.5;if(a.save(),a.shadowBlur=0,a.globalAlpha=o.rail!=null?o.rail:.22,a.strokeStyle=u(.6),a.lineWidth=2.2*d,a.lineCap="round",a.setLineDash([.01,8*d]),a.beginPath(),l.forEach(([p,m],S)=>S?a.lineTo(p,m):a.moveTo(p,m)),a.stroke(),a.setLineDash([]),a.restore(),n>.02){const p=(m,S)=>u(m).replace("rgb(","rgba(").replace(")",`,${S.toFixed(3)})`);for(let m=0;m<26;m++){const S=m/25,D=n-w*S;if(D<=0)break;const I=P(D),C=4.7*d*T*(1-S*.75),_=C*2.1,R=(1-S)*(1-S)*.8,A=a.createRadialGradient(I[0],I[1],0,I[0],I[1],_);A.addColorStop(0,p(.55-.18*S,R)),A.addColorStop(.5,p(.5-.18*S,R*.35)),A.addColorStop(1,p(.45-.18*S,0)),a.save(),a.shadowBlur=0,a.globalAlpha=1,a.fillStyle=A,a.beginPath(),a.arc(I[0],I[1],_,0,Math.PI*2),a.fill(),a.restore()}if(n<l.length-1-.001&&n-Math.floor(n)>.03){const m=P(n);a.save(),a.fillStyle=u(.62),a.shadowColor=u(.8),a.shadowBlur=11*d*T,a.beginPath(),a.arc(m[0],m[1],5.6*d*T,0,Math.PI*2),a.fill(),a.fillStyle=u(.95),a.globalAlpha=.95,a.beginPath(),a.arc(m[0],m[1],2.1*d*T,0,Math.PI*2),a.fill(),a.restore()}}a.globalAlpha=1,a.lineCap="butt";const L=o.done!=null,k=o.done||0,y=o.vd||[],x=o.acc!=null?o.acc:l.length-1;if(l.forEach(([p,m],S)=>{const D=S<k,I=y[S]||null,C=!D&&S===v&&!L,_=C?1+Math.sin(s*6)*.14:1,R=o.pop!=null&&S===k-1&&o.pop<.3?1+.35*(1-o.pop/.3):1,A=12*o.node*_*R*d*(S===x?1.34:1);D&&I!=="miss"&&(a.shadowBlur=f*1.4,a.shadowColor=u(.5),a.fillStyle=u(I==="near"?.5:.36),a.beginPath(),a.arc(p,m,A*.88,0,Math.PI*2),a.fill()),D||(a.save(),a.translate(p,m),d0(a,u,A,C?.8:.5,C?.9:.5,b*.9,f),a.restore()),a.strokeStyle=I==="hit"?g.prism:I==="near"?g.sand:I==="miss"?J.lo:u(D?.62:C?.8:.45),a.lineWidth=b*(C?1.3:I?1.15:.9),a.shadowBlur=C?f*1.6:I&&I!=="miss"?f*1.3:f*.6,I&&I!=="miss"&&(a.shadowColor=I==="hit"?g.prism:g.sand),a.beginPath(),a.arc(p,m,A,0,Math.PI*2),a.stroke(),e.num&&(D&&I!=="miss"?(a.save(),a.globalCompositeOperation="destination-out",a.shadowBlur=0,e.num(a,String(S+1),p,m,16*o.numS*_*d,Math.round(14*o.numS*d)),a.restore()):(a.globalAlpha=S<=v?1:.6,e.num(a,String(S+1),p,m,16*o.numS*_*d,Math.round(14*o.numS*d)),a.globalAlpha=1))}),o.pop!=null&&o.pop<.38&&k>0&&l[k-1]){const[p,m]=l[k-1],S=1-o.pop/.38,D=S*S,I=12*o.node*d*(k-1===(o.acc!=null?o.acc:l.length-1)?1.34:1);a.save();const C=I*(1.6+1.9*(1-S)),_=a.createRadialGradient(p,m,0,p,m,C);_.addColorStop(0,`rgba(255,255,255,${Math.min(1,1.2*D).toFixed(3)})`),_.addColorStop(.35,u(.92).replace("rgb(","rgba(").replace(")",`,${(.8*D).toFixed(3)})`)),_.addColorStop(1,u(.7).replace("rgb(","rgba(").replace(")",",0)")),a.fillStyle=_,a.beginPath(),a.arc(p,m,C,0,Math.PI*2),a.fill(),a.strokeStyle=u(.92),a.globalAlpha=D,a.lineWidth=Math.max(1,6*d*S),a.shadowColor=u(.85),a.shadowBlur=24*d*D,a.beginPath(),a.arc(p,m,I*(1.1+3.4*(1-S)),0,Math.PI*2),a.stroke();const R=Math.max(0,S-.35)/.65;R>0&&(a.globalAlpha=R*R*.6,a.lineWidth=Math.max(1,3.5*d*R),a.beginPath(),a.arc(p,m,I*(1.1+2*(1-R)),0,Math.PI*2),a.stroke()),a.restore()}a.shadowBlur=0}function d0(a,t,o,c,s,e,r,h=1){if(o<=.6)return;const f=(i,n)=>t(i).replace("rgb(","rgba(").replace(")",`,${n})`),b=e*2.6*h,u=Math.max(.1,o-b),d=o+b,l=a.createRadialGradient(0,0,u,0,0,d);l.addColorStop(0,f(c-.05,0)),l.addColorStop(.5,f(c,s*.85)),l.addColorStop(1,f(c-.05,0)),a.globalAlpha=1,a.fillStyle=l,a.shadowBlur=0,a.beginPath(),a.arc(0,0,d,0,Math.PI*2),a.fill(),a.globalAlpha=Math.min(1,s*1.1),a.lineWidth=e*.85,a.strokeStyle=t(Math.min(.98,c+.12)),a.shadowColor=t(.88),a.shadowBlur=r*.6,a.beginPath(),a.arc(0,0,o,0,Math.PI*2),a.stroke(),a.shadowBlur=0}function Xa(a,t,o,c,s,e,r){const h=e.lut,f=13*c.halo,b=t/220,u=t/2,d=e.arrow&&e.arrow.w||1,l=(x,p)=>h(x).replace("rgb(","rgba(").replace(")",`,${p})`);a.clearRect(0,0,t,t),a.lineJoin="round",a.lineCap="round";const i=(o.r!=null?o.r:.42)*t,n=i*(o.rt!=null?o.rt:.36),v=3.4*d*b,P=r!=null?Math.max(0,Math.min(1,r)):s*(o.tempo||.6)%1,T=Math.pow(P,1.6),w=Math.max(0,(P-.9)/.1);a.save(),a.translate(u,u);const L=(x,p,m,S=1)=>d0(a,h,x,p,m,v,f,S),k=a.createRadialGradient(0,0,0,0,0,n*1.08);k.addColorStop(0,l(.6,.1+.18*w)),k.addColorStop(.65,l(.5,.05+.08*w)),k.addColorStop(1,l(.5,0)),a.globalAlpha=1,a.fillStyle=k,a.beginPath(),a.arc(0,0,n*1.08,0,Math.PI*2),a.fill();const y=1+.02*Math.sin(s*2.6);L(n*y,.55+.4*w,.5+.45*w,.9);for(let x=2;x>=0;x--){const p=Math.pow(Math.max(0,P-x*.05),1.6),m=i-(i-n)*p,S=x===0?.6+.4*T:.18/x*(1-w);L(m,.55+.4*T,S*(1-w*.45),1.15-.35*T)}w>.01&&L(n*(1+1.4*w),.9,(1-w)*.8,1.1),a.globalAlpha=.6+.3*w,a.shadowColor=h(.85),a.shadowBlur=f*(.9+w),a.fillStyle=h(.62+.3*w),a.beginPath(),a.arc(0,0,v*.85+3*b*w,0,Math.PI*2),a.fill(),a.restore(),a.globalAlpha=1,a.shadowBlur=0}function ja(a,t,o,c,s,e,r,h){const f=e.lut,b=13*c.halo,u=t/220,d=t/2,l=e.arrow&&e.arrow.w||1,i=l*u,n=(M,B)=>f(M).replace("rgb(","rgba(").replace(")",","+B+")");a.clearRect(0,0,t,t),a.lineJoin="round",a.lineCap="round";const v=t*.42*(o.spread!=null?o.spread:1),T=(h||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([M,B])=>[d+M*v,d+B*v]),w=80,L=[];for(let M=0;M<=w;M++){const B=M/w*(T.length-1),G=Math.min(T.length-2,Math.floor(B)),U=B-G,K=T[Math.max(0,G-1)],X=T[G],a0=T[G+1],t0=T[Math.min(T.length-1,G+2)],o0=(z,Y,Q,e0)=>.5*(2*Y+(-z+Q)*U+(2*z-5*Y+4*Q-e0)*U*U+(-z+3*Y-3*Q+e0)*U*U*U);L.push([o0(K[0],X[0],a0[0],t0[0]),o0(K[1],X[1],a0[1],t0[1])])}const k=M=>{const B=Math.max(0,Math.min(w,M*w)),G=Math.floor(B),U=B-G,K=L[G],X=L[Math.min(w,G+1)];return[K[0]+(X[0]-K[0])*U,K[1]+(X[1]-K[1])*U]},y=.68;let x,p,m;if(r!=null)x=Math.max(0,Math.min(1,r)),p=1,m=0;else{const M=s*(o.tempo||.42)%1;if(M<y)x=M/y,p=1,m=0;else{const B=(M-y)/(1-y);x=1,p=1-B*B,m=B}}if(p<=.012)return;const S=x*x*x*(x*(6*x-15)+10),D=Math.min(1,16*x*x*(1-x)*(1-x));o.taper!=null&&o.taper;const I=.36*(o.tail!=null?o.tail:1),C=o.width!=null?o.width:1;{const M=a.createLinearGradient(L[0][0],L[0][1],L[w][0],L[w][1]);M.addColorStop(0,n(.46,0)),M.addColorStop(.3,n(.46,.03*p)),M.addColorStop(.8,n(.46,.045*p)),M.addColorStop(1,n(.46,0)),a.globalAlpha=1,a.strokeStyle=M,a.lineWidth=9*i,a.shadowColor=f(.6),a.shadowBlur=b*2,a.beginPath(),L.forEach(([B,G],U)=>U?a.lineTo(B,G):a.moveTo(B,G)),a.stroke(),a.shadowBlur=0}const _=40,R=Math.max(0,S-I*(1-m)),A=[];for(let M=0;M<=_;M++)A.push(k(R+(S-R)*(M/_)));const F=()=>{a.beginPath(),A.forEach(([M,B],G)=>G?a.lineTo(M,B):a.moveTo(M,B)),a.stroke()},E=()=>{const M=a.createLinearGradient(A[0][0],A[0][1],A[_][0],A[_][1]);return M.addColorStop(0,n(.55,0)),M.addColorStop(.4,n(.56,0)),M.addColorStop(.68,n(.6,.09)),M.addColorStop(.88,n(.64,.24)),M.addColorStop(1,n(.68,.44)),M},H=1+.5*D;a.globalAlpha=p,a.strokeStyle=E(),a.lineWidth=(20+10*D)*i*C,a.shadowColor=f(.72),a.shadowBlur=b*2.2,F(),a.strokeStyle=E(),a.lineWidth=(10+5*D)*i*C,a.shadowBlur=b*1,F(),a.shadowBlur=0;for(let M=1;M<=_;M++){const B=M/_;a.globalAlpha=Math.pow(B,2.2)*.95*p,a.strokeStyle=f(.55+.38*B),a.lineWidth=(1.6+6.5*Math.pow(B,.7))*i*C*H,a.beginPath(),a.moveTo(A[M-1][0],A[M-1][1]),a.lineTo(A[M][0],A[M][1]),a.stroke()}const q=A[_][0],W=A[_][1];a.globalAlpha=.8*p,a.fillStyle=f(.6),a.shadowColor=f(.8),a.shadowBlur=b*1.6,a.beginPath(),a.arc(q,W,(9+5*D)*i*C,0,Math.PI*2),a.fill(),a.globalAlpha=p,a.fillStyle=f(.93),a.shadowBlur=b*.6,a.beginPath(),a.arc(q,W,(3.4+1.8*D)*i*C,0,Math.PI*2),a.fill(),a.globalAlpha=1,a.shadowBlur=0}function Ja(a,t,o,c,s,e,r){const h=o.r!=null?o.r:.3,f=o.dir!=null?o.dir:1,b=(o.sweep!=null?o.sweep:.66)*Math.PI*2,u=r??s*(o.tempo!=null?o.tempo:.5)%1,d=-Math.PI/2+f*u*Math.PI*2,l=16,i=[];for(let n=0;n<=l;n++){const v=d-f*(1-n/l)*b;i.push([.5+Math.cos(v)*h,.5+Math.sin(v)*h])}Ta(a,t,t,i,s,e,{prog:1,tail:o.tail!=null?o.tail:.68,scale:(o.scale!=null?o.scale:1)*(o.width!=null?o.width:1)})}function za(a,t,o,c,s,e,r={}){const h=Math.max(2,Math.round(r.count??7)),f=r.r??4.4,b=r.flow??.35,u=r.hair??.26,d=r.style||"chain",l=r.color||"255,246,234",i=r.inset??.12,n=r.alpha??1,v=c-t,P=s-o,T=Math.hypot(v,P);if(T<.001||n<=.004)return;const w=v/T,L=P/T,k=t+v*i,y=o+P*i,x=T*(1-i*2);if(x<=0)return;a.save(),d==="chain"&&u>0&&(a.strokeStyle=`rgba(${l},${(u*n).toFixed(3)})`,a.lineWidth=Math.max(1,f*.34),a.beginPath(),a.moveTo(k,y),a.lineTo(k+w*x,y+L*x),a.stroke());const p=e*b%1;for(let m=0;m<h;m++){let S=(m+.5)/h;if(d==="pulse"||d==="dots"||d==="chain"){const A=S-.5;if(S=.5+A+Math.sign(A)*(p/h%(1/h)),S<0||S>1)continue}const D=k+w*x*S,I=y+L*x*S,C=Math.abs(S-.5)*2;let _=f,R=n;if(d==="taper"&&(_=f*(.55+.75*C)),d==="pulse"){const A=((C-p)%1+1)%1;R=n*(.35+.65*Math.max(0,1-Math.abs(A-0)*3))}a.fillStyle=`rgba(${l},${(R*.96).toFixed(3)})`,a.beginPath(),a.arc(D,I,_,0,Math.PI*2),a.fill()}a.restore()}export{Ua as C,c0 as G,va as M,Wa as P,_a as Q,Ha as R,ka as S,Da as Z,j as a,Ia as b,Ga as c,Fa as d,Xa as e,Ja as f,ga as g,ja as h,Ea as i,za as j,$a as k,Pa as l,ya as m,Ka as n,Oa as o,qa as p,N as q,La as r,i0 as s,Ta as t,Ba as u};
