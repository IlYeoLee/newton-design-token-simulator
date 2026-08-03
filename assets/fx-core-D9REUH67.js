const G={red:"#FA3030",coral:"#FE6E3C",sand:"#FEC389",prism:"#D1FEFF"},W={ink:"#FFFFFF",inkDark:"#0A0A0A",hi:"#ECECEC",lo:"#D0D0D0",paper:"#FAFAFA",surface:"#F2F2F2",t1:"#3B3B3B",t2:"#757575",t3:"#525252"},r0=a=>[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)],C0=Object.fromEntries(Object.entries({...G,...W}).map(([a,t])=>[a,parseInt(t.slice(1),16)])),K=a=>`vec3(${r0(a).map(o=>(o/255).toFixed(4)).join(", ")})`,b0=(a,t=1)=>`rgba(${r0(a).join(",")},${t})`,u0=[[G.red,0],[G.red,.3],[G.coral,.56],[G.sand,.86],[G.prism,1]],d0=1;function f0(a){const t=String(a).toUpperCase();return/^#([0-9A-F])\1\1\1\1\1$/.test(t)||Object.values(W).some(o=>o.toUpperCase()===t)?!0:Object.values(G).some(o=>o.toUpperCase()===t)}function v0(a){return a&&((!Array.isArray(a.stops)||!a.stops.every(([o])=>f0(o)))&&(a.stops=u0.map(o=>[...o])),a.sat=d0,a)}function l0(a,t,o,i,n){let l=0;o[0]=0,i[0]=-1e20,i[1]=1e20;for(let r=1;r<n;r++){let u=(a[r]+r*r-(a[o[l]]+o[l]*o[l]))/(2*r-2*o[l]);for(;u<=i[l];)l--,u=(a[r]+r*r-(a[o[l]]+o[l]*o[l]))/(2*r-2*o[l]);l++,o[l]=r,i[l]=u,i[l+1]=1e20}l=0;for(let r=0;r<n;r++){for(;i[l+1]<r;)l++;t[r]=(r-o[l])*(r-o[l])+a[o[l]]}}function e0(a,t){const o=new Float32Array(t),i=new Int32Array(t),n=new Float32Array(t+1),l=new Float32Array(t);for(let r=0;r<t;r++){for(let u=0;u<t;u++)l[u]=a[u*t+r];l0(l,o,i,n,t);for(let u=0;u<t;u++)a[u*t+r]=o[u]}for(let r=0;r<t;r++){for(let u=0;u<t;u++)l[u]=a[r*t+u];l0(l,o,i,n,t);for(let u=0;u<t;u++)a[r*t+u]=o[u]}}function i0(a,t){const i=new Float32Array(t*t),n=new Float32Array(t*t);let l=0,r=0,u=0;for(let x=0;x<t*t;x++){const d=a[x*4+3]/255;i[x]=d>=1?0:d<=0?1e20:Math.pow(Math.max(0,.5-d),2),n[x]=d>=1?1e20:d<=0?0:Math.pow(Math.max(0,d-.5),2),d>.5&&(l+=x%t,r+=x/t|0,u++)}e0(i,t),e0(n,t);const f=new Float32Array(t*t);for(let x=0;x<t*t;x++)f[x]=(Math.sqrt(i[x])-Math.sqrt(n[x]))/t;return{data:f,N:t,cx:u?l/u/t:.5,cy:u?r/u/t:.5}}function z(a,t=512){const o="_raster"+t;if(a[o])return a[o];const i=document.createElement("canvas");i.width=i.height=t;const n=i.getContext("2d"),l=Math.min(t/a.naturalWidth,t/a.naturalHeight);n.drawImage(a,0,0,a.naturalWidth*l,a.naturalHeight*l);const r=n.getImageData(0,0,t,t).data;let u=t,f=t,x=-1,d=-1;for(let h=0;h<t;h++)for(let e=0;e<t;e++)r[(h*t+e)*4+3]>8&&(e<u&&(u=e),e>x&&(x=e),h<f&&(f=h),h>d&&(d=h));return a[o]=x<0?{canvas:i,x:0,y:0,w:t,h:t}:{canvas:i,x:u,y:f,w:x-u+1,h:d-f+1},a[o]}function I0(a,t,o=!1){const i=z(a,t),n=document.createElement("canvas");n.width=n.height=t;const l=n.getContext("2d"),r=Math.min(t*j/i.w,t*j/i.h),u=i.w*r,f=i.h*r;return o&&(l.translate(0,t),l.scale(1,-1)),l.drawImage(i.canvas,i.x,i.y,i.w,i.h,(t-u)/2,(t-f)/2,u,f),i0(l.getImageData(0,0,t,t).data,t)}function A0(a,t,o,i=!1){const n=z(a,o),l=t?z(t,o):null,r=Math.min(o*j/n.w,o*j/n.h),u=n.w*r,f=n.h*r,x=(o-u)/2,d=(o-f)/2,h=v=>{const R=document.createElement("canvas");R.width=R.height=o;const A=R.getContext("2d");return i&&(A.translate(0,o),A.scale(1,-1)),A.drawImage(v.canvas,n.x,n.y,n.w,n.h,x,d,u,f),i0(A.getImageData(0,0,o,o).data,o)},e=h(n),c=l?h(l):null,s=new Float32Array(o*o*2);for(let v=0;v<o*o;v++)s[v*2]=e.data[v],s[v*2+1]=c?c.data[v]:1;return{data:s,N:o,cx:e.cx,cy:e.cy,inCx:c?c.cx:e.cx,inCy:c?c.cy:e.cy,hasInner:!!c}}const T0=1.9922,h0=.78,j=.52,M0=h0/j,R0=1.18,p0={size:.85,gx:-.025,gy:.195,rot:6,shadow:"glow",shadowK:.75,blend:"add"};function y0(a,t,o,i,n=p0){const l=Math.round(o*.75),r=n.shadow==="none"?0:n.shadowK??.75,u=f=>i(a,String(t),o/2,o/2,l,f);return n.shadow==="drop"&&r>.001?(a.save(),a.globalAlpha=Math.min(1,r*.7),a.translate(o*.018,o*.024),u({color:"rgba(120,18,18,.95)",glow:0,glowColor:"rgba(0,0,0,0)"}),a.restore(),u({glow:0,glowColor:"rgba(0,0,0,0)"})):u(n.shadow==="glow"?{glow:26*r,glowColor:"rgba(255,140,90,.85)"}:{glow:0,glowColor:"rgba(0,0,0,0)"}),n.blend==="knock"}function L0(a,t){const o=a.getImageData(0,0,t,t),i=a.createImageData(t,t);for(let n=0;n<t*t;n++){const l=o.data[n*4+3]/255,r=Math.round(255*(1-l));i.data[n*4]=i.data[n*4+1]=i.data[n*4+2]=r,i.data[n*4+3]=255}a.putImageData(i,0,0)}const P0={RATIO:140/600,opacity(a){return a===0?.5:a===2||a===4?0:1},anchor(a,t,o){return{x:((t?1-a.x:a.x)-.5)*o,y:(.5-a.y)*o,s:a.s||1}}},Q=a=>(a/=255,a<=.04045?a/12.92:Math.pow((a+.055)/1.055,2.4)),Z=a=>(a=Math.max(0,Math.min(1,a)),Math.round(255*(a<=.0031308?12.92*a:1.055*Math.pow(a,1/2.4)-.055)));function n0(a,t,o){a=Q(a),t=Q(t),o=Q(o);const i=Math.cbrt(.4122214708*a+.5363325363*t+.0514459929*o),n=Math.cbrt(.2119034982*a+.6806995451*t+.1073969566*o),l=Math.cbrt(.0883024619*a+.2817188376*t+.6299787005*o);return[.2104542553*i+.793617785*n-.0040720468*l,1.9779984951*i-2.428592205*n+.4505937099*l,.0259040371*i+.7827717662*n-.808675766*l]}function m0(a,t,o){const i=(a+.3963377774*t+.2158037573*o)**3,n=(a-.1055613458*t-.0638541728*o)**3,l=(a-.0894841775*t-1.291485548*o)**3;return[Z(4.0767416621*i-3.3077115913*n+.2309699292*l),Z(-1.2684380046*i+2.6097574011*n-.3413193965*l),Z(-.0041960863*i-.7034186147*n+1.707614701*l)]}const s0=a=>[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)];function k0(a,t=1,o=new Uint8Array(256*4)){const i=[...a].sort((n,l)=>n[1]-l[1]);for(let n=0;n<256;n++){const l=n/255;let r=0;for(;r<i.length-2&&l>i[r+1][1];)r++;const[u,f]=i[r],[x,d]=i[r+1],h=Math.max(0,Math.min(1,(l-f)/Math.max(1e-5,d-f))),e=n0(...s0(u)),c=n0(...s0(x)),s=m0(e[0]+(c[0]-e[0])*h,(e[1]+(c[1]-e[1])*h)*t,(e[2]+(c[2]-e[2])*h)*t);o.set([...s,255],n*4)}return o}const _0=`
float refEdge(vec2 uv){
  float h = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
  float v = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.90, uv.y);
  return h * v;                        // mask-composite: intersect
}`,D0=`
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
}`,F0=`
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
// 잉크 색 = 팔레트 RED 그 자체. **LUT 를 경유하지 않는다** — personColor 의 대역 하한이 P_LO(0.40)
//   이라 t 는 아무리 낮춰도 0.33 아래로 못 가고, LUT 의 순수 RED 평지(t ≤ 0.30)에 영영 못 닿는다.
//   T 를 미는 방식으로 '더 빨갛게'를 시도하면 여기서 막힌다 — 그게 '아직도 밝다'의 구조적 원인이다.
#define P_INK ${K(G.red)}
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
`,B0=`
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
uniform float uEdgeShadeW, uEdgeShadeCol;   // 실루엣 이너 섀도우 면적 배율 · 팔레트 색(0흰/1샌드/2코랄/3레드) — 유저: 면적·색 조정
uniform float uIceOld;   // 1 = 아이스 컷 이전(하늘색) 램프 — 비교 미리보기용 토글(유저)
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
#define C_RED   ${K(G.red)}
#define C_CORAL ${K(G.coral)}
#define C_SAND  ${K(G.sand)}
#define C_ICE   ${K(G.prism)}
#define C_CREAM C_SAND
#define C_GRAYF ${K(W.hi)}
#define C_GRAYL ${K(W.lo)}
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
vec3 fillPreview(float q){ return fillT(q, T_PREV_LO, T_PREV_HI); }
vec3 fillHot(float q){     return fillT(q, T_HOT_LO,  T_HOT_HI);  }
vec3 fillActive(float q){  return fillT(q, T_ACT_LO,  T_ACT_HI);  }
vec3 fillHold(float q){    return fillT(q, T_HOLD_LO, T_HOLD_HI); }
// Success 는 코어가 가장 뜨겁고(하한이 낮다) 바깥이 백열로 열린다 — 승리의 온도.
// 상한을 1.0(순백) 이 아니라 0.92 로 — 순백까지 열면 코어와 분리된 흰 링이 생긴다(유저: 아이스 과함).
vec3 fillSuccess(float q){ return fillT(q, mix(0.02, 0.03, uIceOld), mix(0.78, 1.00, uIceOld)); }   // 신 = 피그마 성공 정본(163:8908) 쨍한 레드-코랄 · 구 = 백열/아이스
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
}`;function w0(a,t,o,i){a.lineWidth=4*t;const n=i.arrow;n.line==="dash"?a.setLineDash([12*t*n.gap,10*n.gap]):n.line==="dot"?(a.setLineDash([.5,12*n.gap]),a.lineCap="round",a.lineWidth=5*t):a.setLineDash([]),o!=null&&n.line!=="solid"&&n.line!=="taper"&&(a.lineDashOffset=-o*40*n.speed)}function E0(a,t,o,i,n,l={}){const r=n.lut,u=n.arrow||{},f=u.w??1,x=u.speed??1,d=u.glow??1,h=l.pulse??1,e=o/256,c=e*(l.scale??1),s=t/2,v=i*.9*x%1,R=l.prog!=null?Math.max(0,Math.min(1,l.prog)):Math.min(1,v/.55),A=l.prog!=null?1:v>.88?(1-v)/.12:1;a.clearRect(0,0,t,o);const m=A*(.45+.55*h),T=o-24*e,P=58*e,M=T+(P-T)*R,w=(L,F)=>r(L).replace("rgb(","rgba(").replace(")",`,${F.toFixed(3)})`),p=1.1*c*f,S=13*c*f,b=42*c*(.7+.3*f),k=!l.noTip&&R>.28?Math.min(1,(R-.28)/.22)*b*.42:0,y=M+k,C=a.createLinearGradient(0,T,0,y);if(C.addColorStop(0,w(.55,0)),C.addColorStop(.18,w(.64,.3*m)),C.addColorStop(.4,w(.76,.8*m)),C.addColorStop(.65,w(.88,.98*m)),C.addColorStop(1,w(.97,m)),a.save(),a.filter=`blur(${7*c}px)`,a.globalAlpha=.55,a.fillStyle=C,a.beginPath(),a.moveTo(s-p,T),a.lineTo(s+p,T),a.lineTo(s+S*.95,y),a.lineTo(s-S*.95,y),a.closePath(),a.fill(),a.restore(),a.globalAlpha=1,a.fillStyle=C,a.beginPath(),a.moveTo(s-p/2,T),a.lineTo(s+p/2,T),a.lineTo(s+S/2,y),a.lineTo(s-S/2,y),a.closePath(),a.fill(),a.globalAlpha=m,R>.28&&!l.noTip){const L=b,F=Math.min(1,(R-.28)/.22)*m,_=M+L*.3;a.globalAlpha=F;const B={color:r(.95),glowColor:r(.85),glow:12*d};n.glyph&&(n.glyph(a,"LIFT_TIP",s,_,L,B)||n.glyph(a,"TIP_TRI",s,_,L*.93,B))||(a.strokeStyle=r(.95),a.lineWidth=13*c*f,a.lineCap="round",a.lineJoin="round",a.shadowColor=r(.9),a.shadowBlur=18*c*d,a.beginPath(),a.moveTo(s-26*c,_+14*c),a.lineTo(s,_-16*c),a.lineTo(s+26*c,_+14*c),a.stroke())}a.globalAlpha=1,a.shadowBlur=0}function x0(a,t,o,i,n,l,r={}){const u=l.lut,f=l.arrow||{},x=f.w??1,d=f.glow??1,h=o/256*(r.scale??1);a.clearRect(0,0,t,o);const e=i.map(([w,p])=>[w*t,p*o]);if(e.length<2)return;const c=48,s=[],v=w=>{if(e.length===2)return[e[0][0]+(e[1][0]-e[0][0])*w,e[0][1]+(e[1][1]-e[0][1])*w];const p=w*(e.length-1),S=Math.min(e.length-2,Math.floor(p)),b=p-S,k=e[Math.max(0,S-1)],y=e[S],C=e[S+1],L=e[Math.min(e.length-1,S+2)],F=(_,B,E,H)=>.5*(2*B+(-_+E)*b+(2*_-5*B+4*E-H)*b*b+(-_+3*B-3*E+H)*b*b*b);return[F(k[0],y[0],C[0],L[0]),F(k[1],y[1],C[1],L[1])]};for(let w=0;w<=c;w++)s.push(v(w/c));const R=Math.max(0,Math.min(1,r.prog!=null?r.prog:n*.55%1)),A=Math.max(1,Math.round(c*R)),m=r.alpha??1,T=r.tail??.22;a.lineCap="round";const P=42*h*(.7+.3*x);let M=A;if(R>.28){let w=0;const p=P*.42*Math.min(1,(R-.28)/.22);for(;M>1&&w<p;)w+=Math.hypot(s[M][0]-s[M-1][0],s[M][1]-s[M-1][1]),M--}for(const w of[0,1])for(let p=1;p<=M;p++){const S=p/A,b=Math.min(1,S/T),k=b*b*(3-2*b)*m;a.globalAlpha=w?k:k*.16*S,a.strokeStyle=u(.55+.42*S),a.lineWidth=(1.1+11.9*S)*h*x*(w?1:1.9),a.beginPath(),a.moveTo(s[p-1][0],s[p-1][1]),a.lineTo(s[p][0],s[p][1]),a.stroke()}if(R>.28){const w=s[Math.max(0,A-2)][0],p=s[Math.max(0,A-2)][1],S=Math.atan2(s[A][1]-p,s[A][0]-w)+Math.PI/2,b=s[A][0]-Math.sin(S)*P*.3,k=s[A][1]+Math.cos(S)*P*.3;a.save(),a.translate(b,k),a.rotate(S),a.globalAlpha=Math.min(1,(R-.28)/.22)*m;const y={color:u(.95),glowColor:u(.85),glow:12*d};l.glyph&&(l.glyph(a,"LIFT_TIP",0,0,P,y)||l.glyph(a,"TIP_TRI",0,0,P*.93,y))||(a.strokeStyle=u(.95),a.lineWidth=9*h*x,a.lineJoin="round",a.lineCap="round",a.beginPath(),a.moveTo(-18*h,12*h),a.lineTo(0,-14*h),a.lineTo(18*h,12*h),a.stroke()),a.restore()}a.globalAlpha=1}function S0(a,t,o,i,n,l){n=n||{};const r=l.lut,u=n.style||l.arrow.line,f=!!n.closed,x=[0];for(let c=1;c<t.length;c++)x.push(x[c-1]+Math.hypot(t[c][0]-t[c-1][0],t[c][1]-t[c-1][1]));const d=x[x.length-1]||1,h=c=>{c=(c%d+d)%d;let s=1;for(;s<x.length-1&&x[s]<c;)s++;const v=(c-x[s-1])/Math.max(1e-4,x[s]-x[s-1]);return[t[s-1][0]+(t[s][0]-t[s-1][0])*v,t[s-1][1]+(t[s][1]-t[s-1][1])*v,Math.atan2(t[s][1]-t[s-1][1],t[s][0]-t[s-1][0])]},e=l.arrow;if(u==="chevron"){const c=(26*i+8)*e.gap,s=Math.max(2,Math.floor(d/c));a.shadowColor=r(Math.min(1,e.heat+.2)),a.shadowBlur=8*i*e.glow;for(let v=0;v<s;v++){const R=v*c+o*42*e.speed%c;if(!f&&R>d-4)continue;const[A,m,T]=h(R),P=7.5*i,M=8.5*i,w=.45+.4*Math.sin(R/d*6.283-o*2.2*e.speed);a.strokeStyle=r(e.heat-.05+w*.3),a.lineWidth=3.2*i,a.lineJoin="round",a.lineCap="round",a.save(),a.translate(A,m),a.rotate(T),a.beginPath(),a.moveTo(-M*.5,-P),a.lineTo(M*.5,0),a.lineTo(-M*.5,P),a.stroke(),a.restore()}return!0}if(u==="comet"){const c=o*.35*e.speed%1*d,s=d*e.tail,v=Math.max(24,t.length*2);a.lineCap="round";for(let m=0;m<v;m++){const T=c-m/v*s,P=c-(m+1)/v*s;if(!f&&P<0)break;const M=1-m/v,[w,p]=h(T),[S,b]=h(P);!f&&Math.hypot(S-w,b-p)>d*.4||(a.globalAlpha=Math.pow(M,1.6),a.strokeStyle=r(Math.max(.05,e.heat-.2)+M*.55),a.lineWidth=(1.5+M*4.5)*i,M>.72?(a.shadowColor=r(Math.min(1,e.heat+.3)),a.shadowBlur=M*12*i*e.glow):a.shadowBlur=0,a.beginPath(),a.moveTo(w,p),a.lineTo(S,b),a.stroke())}a.globalAlpha=1,a.lineCap="butt",a.shadowBlur=0;const[R,A]=h(c);return a.fillStyle=rgba(W.ink,.95),a.shadowColor=r(.9),a.shadowBlur=16*i,a.beginPath(),a.arc(R,A,2.6*i,0,7),a.fill(),a.shadowBlur=0,!0}if(a.strokeStyle=n.color||r(e.heat),a.shadowColor=r(Math.min(1,e.heat+.15)),a.shadowBlur=(n.glow??8)*i*e.glow,u==="taper")for(let c=1;c<t.length;c++)a.lineWidth=(.5+c/t.length*4.5)*i,a.beginPath(),a.moveTo(t[c-1][0],t[c-1][1]),a.lineTo(t[c][0],t[c][1]),a.stroke();else w0(a,i,o,l),a.beginPath(),t.forEach(([c,s],v)=>v?a.lineTo(c,s):a.moveTo(c,s)),f&&a.closePath(),a.stroke();return a.setLineDash([]),a.lineCap="butt",a.lineDashOffset=0,a.shadowBlur=0,!0}function G0(a,t,o,i,n,l){const r=13*i.halo,u=l.lut;a.clearRect(0,0,t,t),a.lineJoin="round";const f=t/220,x=t/2,d=18*o.round*f,h=40*f,e=48*f,c=t-80*f,s=t-96*f,v=[],R=(m,T,P,M)=>{for(let w=0;w<=1;w+=.12)v.push([m+(P-m)*w,T+(M-T)*w])};R(h+d,e,h+c-d,e),R(h+c,e+d,h+c,e+s-d),R(h+c-d,e+s,h+d,e+s),R(h,e+s-d,h,e+d),a.shadowColor=u(.6),a.shadowBlur=r*.8;const A=4*l.arrow.w*f;if(l.arrow.line==="solid"?(a.setLineDash([10*o.dash*f,8*f]),a.lineDashOffset=-n*22*f,a.strokeStyle=u(.45),a.lineWidth=A,a.beginPath(),a.roundRect(h,e,c,s,d),a.stroke(),a.setLineDash([]),a.lineDashOffset=0):S0(a,v,n,l.arrow.w*f,{color:u(.45),closed:!0},l),o.prog!=null&&o.prog>.001){const m=[],T=(C,L,F,_,B)=>{for(let E=1;E<=B;E++)m.push([C+(F-C)*E/B,L+(_-L)*E/B])},P=(C,L,F,_,B)=>{for(let E=1;E<=B;E++){const H=F+(_-F)*E/B;m.push([C+d*Math.cos(H),L+d*Math.sin(H)])}},M=Math.PI/2,w=h+c,p=e+s,S=h+c/2;m.push([S,e]),T(S,e,w-d,e,8),P(w-d,e+d,-M,0,6),T(w,e+d,w,p-d,10),P(w-d,p-d,0,M,6),T(w-d,p,h+d,p,14),P(h+d,p-d,M,Math.PI,6),T(h,p-d,h,e+d,10),P(h+d,e+d,Math.PI,Math.PI+M,6),T(h+d,e,S,e,8);let b=0;for(let C=1;C<m.length;C++)b+=Math.hypot(m[C][0]-m[C-1][0],m[C][1]-m[C-1][1]);const k=b*Math.min(1,o.prog);a.save(),a.setLineDash([10*o.dash*f,8*f]),a.lineDashOffset=-(c/2-d)-n*22*f,a.strokeStyle=u(.9),a.lineWidth=A*1.3,a.lineCap="round",a.shadowColor=u(.92),a.shadowBlur=r*1.3,a.beginPath(),a.moveTo(m[0][0],m[0][1]);let y=0;for(let C=1;C<m.length&&y<k;C++){const L=Math.hypot(m[C][0]-m[C-1][0],m[C][1]-m[C-1][1]);if(y+L<=k)a.lineTo(m[C][0],m[C][1]),y+=L;else{const F=(k-y)/L;a.lineTo(m[C-1][0]+(m[C][0]-m[C-1][0])*F,m[C-1][1]+(m[C][1]-m[C-1][1])*F),y=k}}a.stroke(),a.setLineDash([]),a.restore()}o.feet>.05&&l.foot&&(l.foot(a,!1,x-16*o.feet*f,x+6*f,26*o.feet*f),l.foot(a,!0,x+16*o.feet*f,x+6*f,26*o.feet*f)),a.shadowBlur=0}function O0(a,t,o,i,n,l,r,u){const f=13*i.halo,x=4*l.arrow.w*(t/220),d=l.lut;a.clearRect(0,0,t,t),a.lineJoin="round";const h=t/220,e=r||[[45*h,130*h],[110*h,60*h],[175*h,110*h]],c=u??n*.5%1,s=Math.min(1,c*1.25)*(e.length-1),v=Math.min(e.length-1,Math.floor(s+.35));a.shadowColor=d(.7),a.shadowBlur=f;const R=p=>{const S=Math.max(0,Math.min(e.length-2,Math.floor(p))),b=p-S;return[e[S][0]+(e[S+1][0]-e[S][0])*b,e[S][1]+(e[S+1][1]-e[S][1])*b]},A=o.comet!=null?o.comet:1,m=o.tailLen!=null?o.tailLen:.5;if(a.save(),a.shadowBlur=0,a.globalAlpha=o.rail!=null?o.rail:.22,a.strokeStyle=d(.6),a.lineWidth=2.2*h,a.lineCap="round",a.setLineDash([.01,8*h]),a.beginPath(),e.forEach(([p,S],b)=>b?a.lineTo(p,S):a.moveTo(p,S)),a.stroke(),a.setLineDash([]),a.restore(),s>.02){for(let p=0;p<26;p++){const S=p/25,b=s-m*S;if(b<=0)break;const k=R(b);a.save(),a.shadowBlur=0,a.fillStyle=d(.55-.18*S),a.globalAlpha=(1-S)*(1-S)*.85,a.beginPath(),a.arc(k[0],k[1],4.7*h*A*(1-S*.75),0,Math.PI*2),a.fill(),a.restore()}if(s<e.length-1-.001&&s-Math.floor(s)>.03){const p=R(s);a.save(),a.fillStyle=d(.62),a.shadowColor=d(.8),a.shadowBlur=11*h*A,a.beginPath(),a.arc(p[0],p[1],5.6*h*A,0,Math.PI*2),a.fill(),a.fillStyle=d(.95),a.globalAlpha=.95,a.beginPath(),a.arc(p[0],p[1],2.1*h*A,0,Math.PI*2),a.fill(),a.restore()}}a.globalAlpha=1,a.lineCap="butt";const T=o.done!=null,P=o.done||0,M=o.vd||[],w=o.acc!=null?o.acc:e.length-1;e.forEach(([p,S],b)=>{const k=b<P,y=M[b]||null,C=!k&&b===v&&!T,L=C?1+Math.sin(n*6)*.14:1,F=12*o.node*L*h*(b===w?1.34:1);k&&y!=="miss"&&(a.shadowBlur=f*1.4,a.shadowColor=d(.5),a.fillStyle=d(y==="near"?.5:.36),a.beginPath(),a.arc(p,S,F*.88,0,Math.PI*2),a.fill()),k||(a.save(),a.translate(p,S),c0(a,d,F,C?.8:.5,C?.9:.5,x*.9,f),a.restore()),a.strokeStyle=y==="hit"?G.prism:y==="near"?G.sand:y==="miss"?W.lo:d(k?.62:C?.8:.45),a.lineWidth=x*(C?1.3:y?1.15:.9),a.shadowBlur=C?f*1.6:y&&y!=="miss"?f*1.3:f*.6,y&&y!=="miss"&&(a.shadowColor=y==="hit"?G.prism:G.sand),a.beginPath(),a.arc(p,S,F,0,Math.PI*2),a.stroke(),l.num&&(k&&y!=="miss"?(a.save(),a.globalCompositeOperation="destination-out",a.shadowBlur=0,l.num(a,String(b+1),p,S,16*o.numS*L*h,Math.round(14*o.numS*h)),a.restore()):(a.globalAlpha=b<=v?1:.6,l.num(a,String(b+1),p,S,16*o.numS*L*h,Math.round(14*o.numS*h)),a.globalAlpha=1))}),a.shadowBlur=0}function c0(a,t,o,i,n,l,r,u=1){if(o<=.6)return;const f=(c,s)=>t(c).replace("rgb(","rgba(").replace(")",`,${s})`),x=l*2.6*u,d=Math.max(.1,o-x),h=o+x,e=a.createRadialGradient(0,0,d,0,0,h);e.addColorStop(0,f(i-.05,0)),e.addColorStop(.5,f(i,n*.85)),e.addColorStop(1,f(i-.05,0)),a.globalAlpha=1,a.fillStyle=e,a.shadowBlur=0,a.beginPath(),a.arc(0,0,h,0,Math.PI*2),a.fill(),a.globalAlpha=Math.min(1,n*1.1),a.lineWidth=l*.85,a.strokeStyle=t(Math.min(.98,i+.12)),a.shadowColor=t(.88),a.shadowBlur=r*.6,a.beginPath(),a.arc(0,0,o,0,Math.PI*2),a.stroke(),a.shadowBlur=0}function U0(a,t,o,i,n,l,r){const u=l.lut,f=13*i.halo,x=t/220,d=t/2,h=l.arrow&&l.arrow.w||1,e=(w,p)=>u(w).replace("rgb(","rgba(").replace(")",`,${p})`);a.clearRect(0,0,t,t),a.lineJoin="round",a.lineCap="round";const c=(o.r!=null?o.r:.42)*t,s=c*(o.rt!=null?o.rt:.36),v=3.4*h*x,R=r!=null?Math.max(0,Math.min(1,r)):n*(o.tempo||.6)%1,A=Math.pow(R,1.6),m=Math.max(0,(R-.9)/.1);a.save(),a.translate(d,d);const T=(w,p,S,b=1)=>c0(a,u,w,p,S,v,f,b),P=a.createRadialGradient(0,0,0,0,0,s*1.08);P.addColorStop(0,e(.6,.1+.18*m)),P.addColorStop(.65,e(.5,.05+.08*m)),P.addColorStop(1,e(.5,0)),a.globalAlpha=1,a.fillStyle=P,a.beginPath(),a.arc(0,0,s*1.08,0,Math.PI*2),a.fill();const M=1+.02*Math.sin(n*2.6);T(s*M,.55+.4*m,.5+.45*m,.9);for(let w=2;w>=0;w--){const p=Math.pow(Math.max(0,R-w*.05),1.6),S=c-(c-s)*p,b=w===0?.6+.4*A:.18/w*(1-m);T(S,.55+.4*A,b*(1-m*.45),1.15-.35*A)}m>.01&&T(s*(1+1.4*m),.9,(1-m)*.8,1.1),a.globalAlpha=.6+.3*m,a.shadowColor=u(.85),a.shadowBlur=f*(.9+m),a.fillStyle=u(.62+.3*m),a.beginPath(),a.arc(0,0,v*.85+3*x*m,0,Math.PI*2),a.fill(),a.restore(),a.globalAlpha=1,a.shadowBlur=0}function H0(a,t,o,i,n,l,r,u){const f=l.lut,x=13*i.halo,d=t/220,h=t/2,e=l.arrow&&l.arrow.w||1,c=e*d,s=(I,D)=>f(I).replace("rgb(","rgba(").replace(")",","+D+")");a.clearRect(0,0,t,t),a.lineJoin="round",a.lineCap="round";const v=t*.42*(o.spread!=null?o.spread:1),A=(u||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([I,D])=>[h+I*v,h+D*v]),m=80,T=[];for(let I=0;I<=m;I++){const D=I/m*(A.length-1),O=Math.min(A.length-2,Math.floor(D)),U=D-O,q=A[Math.max(0,O-1)],$=A[O],N=A[O+1],a0=A[Math.min(A.length-1,O+2)],t0=(X,J,Y,o0)=>.5*(2*J+(-X+Y)*U+(2*X-5*J+4*Y-o0)*U*U+(-X+3*J-3*Y+o0)*U*U*U);T.push([t0(q[0],$[0],N[0],a0[0]),t0(q[1],$[1],N[1],a0[1])])}const P=I=>{const D=Math.max(0,Math.min(m,I*m)),O=Math.floor(D),U=D-O,q=T[O],$=T[Math.min(m,O+1)];return[q[0]+($[0]-q[0])*U,q[1]+($[1]-q[1])*U]},M=.68;let w,p,S;if(r!=null)w=Math.max(0,Math.min(1,r)),p=1,S=0;else{const I=n*(o.tempo||.42)%1;if(I<M)w=I/M,p=1,S=0;else{const D=(I-M)/(1-M);w=1,p=1-D*D,S=D}}if(p<=.012)return;const b=w*w*w*(w*(6*w-15)+10),k=Math.min(1,16*w*w*(1-w)*(1-w));o.taper!=null&&o.taper;const y=.36*(o.tail!=null?o.tail:1),C=o.width!=null?o.width:1;{const I=a.createLinearGradient(T[0][0],T[0][1],T[m][0],T[m][1]);I.addColorStop(0,s(.46,0)),I.addColorStop(.3,s(.46,.03*p)),I.addColorStop(.8,s(.46,.045*p)),I.addColorStop(1,s(.46,0)),a.globalAlpha=1,a.strokeStyle=I,a.lineWidth=9*c,a.shadowColor=f(.6),a.shadowBlur=x*2,a.beginPath(),T.forEach(([D,O],U)=>U?a.lineTo(D,O):a.moveTo(D,O)),a.stroke(),a.shadowBlur=0}const L=40,F=Math.max(0,b-y*(1-S)),_=[];for(let I=0;I<=L;I++)_.push(P(F+(b-F)*(I/L)));const B=()=>{a.beginPath(),_.forEach(([I,D],O)=>O?a.lineTo(I,D):a.moveTo(I,D)),a.stroke()},E=()=>{const I=a.createLinearGradient(_[0][0],_[0][1],_[L][0],_[L][1]);return I.addColorStop(0,s(.55,0)),I.addColorStop(.4,s(.56,0)),I.addColorStop(.68,s(.6,.09)),I.addColorStop(.88,s(.64,.24)),I.addColorStop(1,s(.68,.44)),I},H=1+.5*k;a.globalAlpha=p,a.strokeStyle=E(),a.lineWidth=(20+10*k)*c*C,a.shadowColor=f(.72),a.shadowBlur=x*2.2,B(),a.strokeStyle=E(),a.lineWidth=(10+5*k)*c*C,a.shadowBlur=x*1,B(),a.shadowBlur=0;for(let I=1;I<=L;I++){const D=I/L;a.globalAlpha=Math.pow(D,2.2)*.95*p,a.strokeStyle=f(.55+.38*D),a.lineWidth=(1.6+6.5*Math.pow(D,.7))*c*C*H,a.beginPath(),a.moveTo(_[I-1][0],_[I-1][1]),a.lineTo(_[I][0],_[I][1]),a.stroke()}const V=_[L][0],g=_[L][1];a.globalAlpha=.8*p,a.fillStyle=f(.6),a.shadowColor=f(.8),a.shadowBlur=x*1.6,a.beginPath(),a.arc(V,g,(9+5*k)*c*C,0,Math.PI*2),a.fill(),a.globalAlpha=p,a.fillStyle=f(.93),a.shadowBlur=x*.6,a.beginPath(),a.arc(V,g,(3.4+1.8*k)*c*C,0,Math.PI*2),a.fill(),a.globalAlpha=1,a.shadowBlur=0}function q0(a,t,o,i,n,l,r){const u=o.r!=null?o.r:.3,f=o.dir!=null?o.dir:1,x=(o.sweep!=null?o.sweep:.66)*Math.PI*2,d=r??n*(o.tempo!=null?o.tempo:.5)%1,h=-Math.PI/2+f*d*Math.PI*2,e=16,c=[];for(let s=0;s<=e;s++){const v=h-f*(1-s/e)*x;c.push([.5+Math.cos(v)*u,.5+Math.sin(v)*u])}x0(a,t,t,c,n,l,{prog:1,tail:o.tail!=null?o.tail:.68,scale:(o.scale!=null?o.scale:1)*(o.width!=null?o.width:1)})}export{D0 as C,p0 as G,P0 as M,W as N,G as P,M0 as Q,_0 as R,T0 as S,R0 as Z,j as a,h0 as b,U0 as c,y0 as d,q0 as e,E0 as f,H0 as g,O0 as h,L0 as i,A0 as j,I0 as k,G0 as l,k0 as m,B0 as n,z as o,S0 as p,C0 as q,x0 as r,i0 as s,b0 as t,v0 as u,F0 as v,u0 as w,d0 as x};
