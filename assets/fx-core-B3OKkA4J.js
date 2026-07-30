(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))c(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&c(i)}).observe(document,{childList:!0,subtree:!0});function e(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function c(s){if(s.ep)return;s.ep=!0;const a=e(s);fetch(s.href,a)}})();const O={red:"#FA3030",coral:"#FE6E3C",sand:"#FEC389",prism:"#D1FEFF"},W={ink:"#FFFFFF",inkDark:"#0A0A0A",hi:"#ECECEC",lo:"#D0D0D0",paper:"#FAFAFA",surface:"#F2F2F2",t1:"#3B3B3B",t2:"#757575",t3:"#525252"},nt=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)],pt=Object.fromEntries(Object.entries({...O,...W}).map(([t,o])=>[t,parseInt(o.slice(1),16)])),H=t=>`vec3(${nt(t).map(e=>(e/255).toFixed(4)).join(", ")})`,mt=(t,o=1)=>`rgba(${nt(t).join(",")},${o})`,rt=[[O.red,0],[O.red,.3],[O.coral,.56],[O.sand,.86],[O.prism,1]],it=1;function ct(t){const o=String(t).toUpperCase();return/^#([0-9A-F])\1\1\1\1\1$/.test(o)||Object.values(W).some(e=>e.toUpperCase()===o)?!0:Object.values(O).some(e=>e.toUpperCase()===o)}function wt(t){return t&&((!Array.isArray(t.stops)||!t.stops.every(([e])=>ct(e)))&&(t.stops=rt.map(e=>[...e])),t.sat=it,t)}function ot(t,o,e,c,s){let a=0;e[0]=0,c[0]=-1e20,c[1]=1e20;for(let i=1;i<s;i++){let r=(t[i]+i*i-(t[e[a]]+e[a]*e[a]))/(2*i-2*e[a]);for(;r<=c[a];)a--,r=(t[i]+i*i-(t[e[a]]+e[a]*e[a]))/(2*i-2*e[a]);a++,e[a]=i,c[a]=r,c[a+1]=1e20}a=0;for(let i=0;i<s;i++){for(;c[a+1]<i;)a++;o[i]=(i-e[a])*(i-e[a])+t[e[a]]}}function et(t,o){const e=new Float32Array(o),c=new Int32Array(o),s=new Float32Array(o+1),a=new Float32Array(o);for(let i=0;i<o;i++){for(let r=0;r<o;r++)a[r]=t[r*o+i];ot(a,e,c,s,o);for(let r=0;r<o;r++)t[r*o+i]=e[r]}for(let i=0;i<o;i++){for(let r=0;r<o;r++)a[r]=t[i*o+r];ot(a,e,c,s,o);for(let r=0;r<o;r++)t[i*o+r]=e[r]}}function ht(t,o){const c=new Float32Array(o*o),s=new Float32Array(o*o);let a=0,i=0,r=0;for(let m=0;m<o*o;m++){const d=t[m*4+3]/255;c[m]=d>=1?0:d<=0?1e20:Math.pow(Math.max(0,.5-d),2),s[m]=d>=1?1e20:d<=0?0:Math.pow(Math.max(0,d-.5),2),d>.5&&(a+=m%o,i+=m/o|0,r++)}et(c,o),et(s,o);const u=new Float32Array(o*o);for(let m=0;m<o*o;m++)u[m]=(Math.sqrt(c[m])-Math.sqrt(s[m]))/o;return{data:u,N:o,cx:r?a/r/o:.5,cy:r?i/r/o:.5}}function ft(t,o=512){const e="_raster"+o;if(t[e])return t[e];const c=document.createElement("canvas");c.width=c.height=o;const s=c.getContext("2d"),a=Math.min(o/t.naturalWidth,o/t.naturalHeight);s.drawImage(t,0,0,t.naturalWidth*a,t.naturalHeight*a);const i=s.getImageData(0,0,o,o).data;let r=o,u=o,m=-1,d=-1;for(let p=0;p<o;p++)for(let l=0;l<o;l++)i[(p*o+l)*4+3]>8&&(l<r&&(r=l),l>m&&(m=l),p<u&&(u=p),p>d&&(d=p));return t[e]=m<0?{canvas:c,x:0,y:0,w:o,h:o}:{canvas:c,x:r,y:u,w:m-r+1,h:d-u+1},t[e]}function Ct(t,o,e=!1){const c=ft(t,o),s=document.createElement("canvas");s.width=s.height=o;const a=s.getContext("2d"),i=Math.min(o*.78/c.w,o*.78/c.h),r=c.w*i,u=c.h*i;return e&&(a.translate(0,o),a.scale(1,-1)),a.drawImage(c.canvas,c.x,c.y,c.w,c.h,(o-r)/2,(o-u)/2,r,u),ht(a.getImageData(0,0,o,o).data,o)}const xt={RATIO:140/600,opacity(t){return t===0?.5:t===2||t===4?0:1},anchor(t,o,e){return{x:((o?1-t.x:t.x)-.5)*e,y:(.5-t.y)*e,s:t.s||1}}},Y=t=>(t/=255,t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)),Q=t=>(t=Math.max(0,Math.min(1,t)),Math.round(255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)));function at(t,o,e){t=Y(t),o=Y(o),e=Y(e);const c=Math.cbrt(.4122214708*t+.5363325363*o+.0514459929*e),s=Math.cbrt(.2119034982*t+.6806995451*o+.1073969566*e),a=Math.cbrt(.0883024619*t+.2817188376*o+.6299787005*e);return[.2104542553*c+.793617785*s-.0040720468*a,1.9779984951*c-2.428592205*s+.4505937099*a,.0259040371*c+.7827717662*s-.808675766*a]}function dt(t,o,e){const c=(t+.3963377774*o+.2158037573*e)**3,s=(t-.1055613458*o-.0638541728*e)**3,a=(t-.0894841775*o-1.291485548*e)**3;return[Q(4.0767416621*c-3.3077115913*s+.2309699292*a),Q(-1.2684380046*c+2.6097574011*s-.3413193965*a),Q(-.0041960863*c-.7034186147*s+1.707614701*a)]}const lt=t=>[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)];function Mt(t,o=1,e=new Uint8Array(256*4)){const c=[...t].sort((s,a)=>s[1]-a[1]);for(let s=0;s<256;s++){const a=s/255;let i=0;for(;i<c.length-2&&a>c[i+1][1];)i++;const[r,u]=c[i],[m,d]=c[i+1],p=Math.max(0,Math.min(1,(a-u)/Math.max(1e-5,d-u))),l=at(...lt(r)),h=at(...lt(m)),f=dt(l[0]+(h[0]-l[0])*p,(l[1]+(h[1]-l[1])*p)*o,(l[2]+(h[2]-l[2])*p)*o);e.set([...f,255],s*4)}return e}const bt=`
#define CUT_BAND 0.13
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
  float a = smoothstep(0.0, band * 0.85, y) * (0.55 + 0.45 * smoothstep(0.0, band * 2.6, y));
  float d = smoothstep(band * 3.0, 0.0, y);
  return vec2(mix(1.0, clamp(a, 0.0, 1.0), cut), d * cut);
}`,At=`
#define P_GAMMA 1.15    // 온도 곡선 (1.38은 대역을 LUT 평지로 밀어넣었다)
#define P_GAIN  0.96    // LUT 상단 여유(순백 방지)
#define P_SAT   1.32    // 룩시스템 '쟁한' 고채도
#define P_LO    0.40    // LUT t=0~0.3 은 RED 단색 평지 — 대역 하한이 그 위여야 계조가 산다
#define P_HI    0.86
vec3 personColor(float T){
  float t = P_LO + clamp(T, 0.0, 1.0) * (P_HI - P_LO);   // 공용 대역으로 정규화
  t = pow(t, P_GAMMA) * P_GAIN;
  vec3 c = lut(clamp(t, 0.0, 1.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, P_SAT), 0.0, 1.0);
}
// 인물 룩 — 복싱·러닝·농구가 공유하는 단 하나의 톤 결정자(유저 레퍼런스: setup-injury 프로토).
//   규칙: ① 얼굴만 완전 블러(이목구비 소거) ② 몸은 옷주름·결이 살아있되 매끄럽게
//        ③ 말단·가장자리는 뽀얀 우유빛으로 빠지고 코어만 채도 높게(그라디언트)
//        ④ 어두운 덩어리 금지 — 고키. 투사광이라 검정은 곧 '빛 없음'이다.
//   thick = 두께장(블러 마스크·방사 필드, 가장자리 0 → 코어 1)
//   lumS  = 원본 휘도(선명 — 몸의 결)      lumB = 블러 휘도(얼굴용)
//   mIn   = 내부 침식 마스크               face = 얼굴 대역 가중
#define P_MILK  0.28    // 하이라이트·얼굴이 우유빛으로 빠지는 양(전신 희석 금지)
#define P_DEPTH 0.88    // 그늘이 '진해지는' 양 — 밝기가 아니라 온도로만
//   ⚠ 밝기를 깎아 그늘을 만들면 안 된다. 알파가 min(aOut, lum*1.6)로 밝기에 묶여 있어
//     어두운 옷 픽셀만 알파 0.85로 떨어지고 뒤 벽·그리드가 비친다(실측: 0.985→0.847, 유저 신고).
//     투사광에선 '어둡게' = '투명하게'다. 그래서 그늘은 LUT 상단(딥레드)으로, 하이라이트는
//     하단(샌드)으로 — 양끝 다 R≈1이라 알파는 어디서도 안 떨어진다.
#define P_TEX   3.0     // 국소 대비(옷 결·주름)를 온도로 옮기는 배율
#define P_ABS   0.18    // 절대 밝기를 반영하는 비율 — 낮을수록 클립 노출차에 둔감
vec3 personLook(float thick, float lumS, float lumB, float mIn, float face){
  // 절대 휘도를 그대로 읽으면 클립 노출차가 곧 색차가 된다 — 밝게 찍은 러닝·농구 코치가
  //   통째로 LUT 밝은 쪽(SAND)으로 밀려 하얘졌다(유저: "왜 러닝 농구는 더 하얘?").
  //   피부색이 아니라 노출이다. 그래서 국소 평균(lumB)은 노출로 보고 대부분 상쇄하고,
  //   국소 대비(lumS - lumB)만 결로 읽는다 — 옷 주름·미묘한 톤차가 여기 다 들어있다.
  float d = (lumS - lumB) * (1.0 - face) * P_TEX;       // 얼굴은 결 제거(이목구비 은닉)
  // 소프트 새추레이션 — clamp 로 자르면 큰 대비 영역이 통째로 양 끝에 붙어 종이장처럼
  //   포스터화된다(유저 스샷). x/(1+|x|)는 작은 결은 그대로, 큰 대비만 압축한다.
  float detail = d / (1.0 + abs(d) * 1.6);
  float base = mix(0.5, lumB, P_ABS);                   // 절대 밝기는 34%만
  float shade = clamp(smoothstep(0.08, 0.80, base) + detail, 0.0, 1.0);
  float lum = mix(mix(lumS, lumB, 0.50), lumB, face);   // 우유빛 하이라이트 판정용
  // LUT 실측 방향: T=0 → RED(#FA3030) · T≈0.86 → SAND(#FEC389) · T=1 → ICE.
  //   즉 T가 낮을수록 진하다. 두꺼운 코어·그늘 = 낮은 T(진한 코랄레드),
  //   얇은 말단·하이라이트·얼굴 = 높은 T(뽀얀 살구).
  float th = smoothstep(0.25, 0.95, thick);   // 두께장 정규화 — H의 실사용 범위가 좁다
  // 코어(th=1)는 딥코랄 t≈0.42, 사지(th≈0.4)는 코랄 t≈0.60, 말단·얼굴은 뽀얀 살구.
  //   구 1.0 - th*0.60 은 두께장이 1에 못 닿는 실제 값에서 전신을 살구빛으로 띄웠다(유저).
  float T = clamp(0.95 - th * 0.80 + (shade - 0.5) * P_DEPTH * mIn * (1.0 - face * 0.7)
                  + face * 0.26, 0.0, 1.0);
  vec3 c = personColor(T);
  // 얇은 곳(손·머리카락)과 얼굴, 그리고 하이라이트만 우유빛 — 2.2제곱이라 몸통은 거의 안 뜬다.
  float milk = clamp(pow(1.0 - clamp(thick, 0.0, 1.0), 2.2) * 0.9
                     + face * 0.9 + smoothstep(0.72, 1.00, shade) * mIn * 0.6, 0.0, 1.0);
  return clamp(mix(c, vec3(1.0, 0.95, 0.90), milk * P_MILK), 0.0, 1.0);
}`,yt=`
uniform float uRadius, uPool, uContract, uShape, uSeed;
uniform sampler2D uSDF2, uSDFWarn;
// 색 = src/palette.js 단일 소스. 유채는 4색뿐(규칙 ①), 무채는 상태 부호(규칙 ②).
//   은퇴: C_CREAM(#FEE2C6 — 팔레트에 없던 9번째 색) → SAND
//         C_WINE·C_BRICK(암적) → SAND·CORAL  (유저: 워닝에 어두운색 금지)
//         C_EXCL(#EE2827) → RED · C_RIMG(미세 웜그레이) → 무채 lo 로 통합
#define C_RED   ${H(O.red)}
#define C_CORAL ${H(O.coral)}
#define C_SAND  ${H(O.sand)}
#define C_ICE   ${H(O.prism)}
#define C_CREAM C_SAND
#define C_GRAYF ${H(W.hi)}
#define C_GRAYL ${H(W.lo)}
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
/** 필 램프 좌표 0..1 — 존 원은 중심거리, **발형은 실루엣 안쪽 깊이(sd)**.
 *  발 위에 원형 그라디언트를 씌우면 발가락·아치·뒤꿈치가 램프를 가로질러 잘려서
 *  '빨간 원에 발 마스크를 덮은 얼룩'으로 읽힌다(유저: 발자국 퀄리티·튄다).
 *  깊이 기반이면 빛이 실루엣을 따라 고여서 발 모양 자체가 읽힌다. */
float mkR(vec2 uv, vec2 gc, float scale, float sd){
  float r = length(uv - gc) / max(scale, 1e-4);
  if (uShape < 0.5) return r;
  // 깊이가 주(主), 중심 거리는 종(從) — 무게중심 이동(Hold 뒤꿈치 고임·Success 블룸)은 남긴다.
  return clamp(mix(clamp(1.0 + sd / 0.40, 0.0, 1.0), r, 0.28), 0.0, 1.4);
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
    float q = 0.36 + 0.64 * mkR(uv, gcBall, ext * 1.18 * breath, sd);
    vec3 fillCol = mix(C_CREAM, mix(fillPreview(q), fillHot(q), strong), f);
    float fillA = mix(0.42, 0.82, f) * fillGain;
    lay(A, fillCol, fillA * inside);
    float ow = 0.016 * uW;
    float stroke = exp(-pow(abs(sd) / max(ow, 1e-4), 2.0)) * dashM;
    lay(A, C_SAND, stroke * (0.95 - 0.62 * f));
  } else if (state < 1.5) {     // ── Active: 적열 필 + 얼음빛 헤일로 수축 (수축 완료 = 타이밍)
    float gradR = uShape < 0.5 ? ext * 1.75 : 2.15;   // 폴오프 넓힘 = 중앙 적열 원 완화(유저)
    float q = 0.34 + 0.66 * mkR(uv, gcBall, gradR, sd);    // 중심 하한↑ — 적열이 은은하게 퍼짐
    q *= 1.0 + 0.025 * sin(t * 3.1 + q * 5.0) * uNoise;
    lay(A, fillActive(q), inside * min(fillGain * 1.15, 1.0));
    // 헤일로 폭: 발형은 실루엣이 얇아 존 원과 같은 폭이면 윤곽을 통째로 삼킨다(유저: 튄다)
    float hw = max((uShape < 0.5 ? 0.115 - 0.075 * prog : 0.062 - 0.040 * prog) * uW, 0.014);
    float h = exp(-pow(outPos / max(hw, 1e-4), 1.3)) * (1.0 - inside);
    vec3 hCol = mix(C_SAND, C_ICE, smoothstep(0.15, 0.9, outPos / hw));
    lay(A, hCol, h * uHalo * (0.50 + 0.14 * sin(t * 5.0)) * dashM);
  } else if (state < 2.5) {     // ── Hold: 코닉 진행 림 + 열이 뒤꿈치로 고임
    float pr = prog;
    vec2 gc = mix(gcBall, gcHeel, pr);
    float q = mkR(uv, gc, ext * 1.02, sd);
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
    float q = mkR(uv, gcBall, uShape < 0.5 ? ext * 1.3 : 1.75, sd);
    float fillA = (prog < 0.4 ? 1.0 : pow(1.0 - (prog - 0.4) / 0.6, 1.4)) * max(min(fillGain * 1.2, 1.0), 0.85);
    lay(A, fillSuccess(q / (0.55 + 0.55 * e)), inside * fillA);
    float flash = exp(-prog * 9.0);
    lay(A, C_ICE, exp(-pow(abs(sd) / max(0.02 * uW, 1e-4), 2.0)) * flash * 0.8);
  } else if (state < 4.5) {     // ── Miss: 온기가 식어 회색 고스트 → 무음 소멸
    float cool = smoothstep(0.0, 0.4, prog);
    float gone = pow(1.0 - max(prog - 0.45, 0.0) / 0.55, 1.6);
    float q = mkR(uv, gcBall, ext, sd);
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
  // 실루엣 이너 엣지(발형 전용) — 윤곽이 빛으로 그려져야 '발자국'으로 읽힌다.
  //   필 + 바깥 글로우만 있으면 어떤 실루엣이든 둥근 얼룩으로 뭉개진다(유저: 발자국 퀄리티).
  if (uShape > 0.5 && state < 2.5) {
    float edgeIn = exp(-pow(max(-sd, 0.0) / max(0.05 * uW, 1e-4), 1.5)) * inside;
    lay(A, C_SAND, edgeIn * 0.34);
  }
  // NaN 스크럽 — 위 분기 어디서든 비정상 값이 새면 '보이지 않음'으로 떨어뜨린다.
  //   NaN 과의 비교는 항상 false 이므로 step() 이 0 을 골라 준다(GLSL ES 1.0 에서 신뢰 가능한 유일한 방법).
  //   투사 UI 는 가산광이라 '없음'이 안전한 기본값이다 — 검은 판보다 백 배 낫다.
  A *= step(vec4(-1.0), A) * step(A, vec4(1e6));
  return A;
}`;function ut(t,o,e,c){t.lineWidth=4*o;const s=c.arrow;s.line==="dash"?t.setLineDash([12*o*s.gap,10*s.gap]):s.line==="dot"?(t.setLineDash([.5,12*s.gap]),t.lineCap="round",t.lineWidth=5*o):t.setLineDash([]),e!=null&&s.line!=="solid"&&s.line!=="taper"&&(t.lineDashOffset=-e*40*s.speed)}function St(t,o,e,c,s,a={}){const i=s.lut,r=s.arrow||{},u=r.w??1,m=r.speed??1,d=r.glow??1,p=a.pulse??1,l=e/256,h=o/2,f=c*.9*m%1,v=a.prog!=null?Math.max(0,Math.min(1,a.prog)):Math.min(1,f/.55),T=a.prog!=null?1:f>.88?(1-f)/.12:1;t.clearRect(0,0,o,e);const C=T*(.45+.55*p),n=e-24*l,x=58*l,S=n+(x-n)*v,A=(I,D)=>i(I).replace("rgb(","rgba(").replace(")",`,${D.toFixed(3)})`),w=1.1*l*u,M=13*l*u,k=t.createLinearGradient(0,n,0,S);if(k.addColorStop(0,A(.55,0)),k.addColorStop(.1,A(.64,.45*C)),k.addColorStop(.32,A(.76,.85*C)),k.addColorStop(.62,A(.88,.98*C)),k.addColorStop(1,A(.97,C)),t.globalAlpha=1,t.fillStyle=k,t.beginPath(),t.moveTo(h-w/2,n),t.lineTo(h+w/2,n),t.lineTo(h+M/2,S),t.lineTo(h-M/2,S),t.closePath(),t.fill(),t.globalAlpha=C,v>.28&&!a.noTip){const I=34*l*(.7+.3*u),D=Math.min(1,(v-.28)/.22)*C,R=S+I*.3;t.globalAlpha=D;const b={color:i(.95),glowColor:i(.85),glow:12*d};s.glyph&&(s.glyph(t,"LIFT_TIP",h,R,I,b)||s.glyph(t,"TIP_TRI",h,R,I*.93,b))||(t.strokeStyle=i(.95),t.lineWidth=13*l*u,t.lineCap="round",t.lineJoin="round",t.shadowColor=i(.9),t.shadowBlur=18*l*d,t.beginPath(),t.moveTo(h-26*l,R+14*l),t.lineTo(h,R-16*l),t.lineTo(h+26*l,R+14*l),t.stroke())}t.globalAlpha=1,t.shadowBlur=0}function vt(t,o,e,c,s,a,i={}){const r=a.lut,u=a.arrow||{},m=u.w??1,d=u.glow??1,p=e/256;t.clearRect(0,0,o,e);const l=c.map(([n,x])=>[n*o,x*e]);if(l.length<2)return;const h=48,f=[],v=n=>{if(l.length===2)return[l[0][0]+(l[1][0]-l[0][0])*n,l[0][1]+(l[1][1]-l[0][1])*n];const x=n*(l.length-1),S=Math.min(l.length-2,Math.floor(x)),A=x-S,w=l[Math.max(0,S-1)],M=l[S],k=l[S+1],I=l[Math.min(l.length-1,S+2)],D=(R,b,_,F)=>.5*(2*b+(-R+_)*A+(2*R-5*b+4*_-F)*A*A+(-R+3*b-3*_+F)*A*A*A);return[D(w[0],M[0],k[0],I[0]),D(w[1],M[1],k[1],I[1])]};for(let n=0;n<=h;n++)f.push(v(n/h));const T=Math.max(0,Math.min(1,i.prog!=null?i.prog:s*.55%1)),C=Math.max(1,Math.round(h*T));t.lineCap="round";for(let n=1;n<=C;n++){const x=n/C;t.globalAlpha=Math.pow(x,1.5),t.strokeStyle=r(.45+.5*x),t.lineWidth=(1.6+3.2*x)*p*m,t.beginPath(),t.moveTo(f[n-1][0],f[n-1][1]),t.lineTo(f[n][0],f[n][1]),t.stroke()}if(T>.25){const n=f[C][0],x=f[C][1],S=f[Math.max(0,C-2)][0],A=f[Math.max(0,C-2)][1],w=Math.atan2(x-A,n-S)+Math.PI/2,M=30*p*(.7+.3*m);t.save(),t.translate(n,x),t.rotate(w),t.globalAlpha=Math.min(1,(T-.25)/.2);const k={color:r(.95),glowColor:r(.85),glow:12*d};a.glyph&&(a.glyph(t,"LIFT_TIP",0,0,M,k)||a.glyph(t,"TIP_TRI",0,0,M*.93,k))||(t.strokeStyle=r(.95),t.lineWidth=9*p*m,t.lineJoin="round",t.lineCap="round",t.beginPath(),t.moveTo(-18*p,12*p),t.lineTo(0,-14*p),t.lineTo(18*p,12*p),t.stroke()),t.restore()}t.globalAlpha=1}function st(t,o,e,c,s,a){s=s||{};const i=a.lut,r=s.style||a.arrow.line,u=!!s.closed,m=[0];for(let h=1;h<o.length;h++)m.push(m[h-1]+Math.hypot(o[h][0]-o[h-1][0],o[h][1]-o[h-1][1]));const d=m[m.length-1]||1,p=h=>{h=(h%d+d)%d;let f=1;for(;f<m.length-1&&m[f]<h;)f++;const v=(h-m[f-1])/Math.max(1e-4,m[f]-m[f-1]);return[o[f-1][0]+(o[f][0]-o[f-1][0])*v,o[f-1][1]+(o[f][1]-o[f-1][1])*v,Math.atan2(o[f][1]-o[f-1][1],o[f][0]-o[f-1][0])]},l=a.arrow;if(r==="chevron"){const h=(26*c+8)*l.gap,f=Math.max(2,Math.floor(d/h));t.shadowColor=i(Math.min(1,l.heat+.2)),t.shadowBlur=8*c*l.glow;for(let v=0;v<f;v++){const T=v*h+e*42*l.speed%h;if(!u&&T>d-4)continue;const[C,n,x]=p(T),S=7.5*c,A=8.5*c,w=.45+.4*Math.sin(T/d*6.283-e*2.2*l.speed);t.strokeStyle=i(l.heat-.05+w*.3),t.lineWidth=3.2*c,t.lineJoin="round",t.lineCap="round",t.save(),t.translate(C,n),t.rotate(x),t.beginPath(),t.moveTo(-A*.5,-S),t.lineTo(A*.5,0),t.lineTo(-A*.5,S),t.stroke(),t.restore()}return!0}if(r==="comet"){const h=e*.35*l.speed%1*d,f=d*l.tail,v=Math.max(24,o.length*2);t.lineCap="round";for(let n=0;n<v;n++){const x=h-n/v*f,S=h-(n+1)/v*f;if(!u&&S<0)break;const A=1-n/v,[w,M]=p(x),[k,I]=p(S);!u&&Math.hypot(k-w,I-M)>d*.4||(t.globalAlpha=Math.pow(A,1.6),t.strokeStyle=i(Math.max(.05,l.heat-.2)+A*.55),t.lineWidth=(1.5+A*4.5)*c,A>.72?(t.shadowColor=i(Math.min(1,l.heat+.3)),t.shadowBlur=A*12*c*l.glow):t.shadowBlur=0,t.beginPath(),t.moveTo(w,M),t.lineTo(k,I),t.stroke())}t.globalAlpha=1,t.lineCap="butt",t.shadowBlur=0;const[T,C]=p(h);return t.fillStyle=rgba(W.ink,.95),t.shadowColor=i(.9),t.shadowBlur=16*c,t.beginPath(),t.arc(T,C,2.6*c,0,7),t.fill(),t.shadowBlur=0,!0}if(t.strokeStyle=s.color||i(l.heat),t.shadowColor=i(Math.min(1,l.heat+.15)),t.shadowBlur=(s.glow??8)*c*l.glow,r==="taper")for(let h=1;h<o.length;h++)t.lineWidth=(.5+h/o.length*4.5)*c,t.beginPath(),t.moveTo(o[h-1][0],o[h-1][1]),t.lineTo(o[h][0],o[h][1]),t.stroke();else ut(t,c,e,a),t.beginPath(),o.forEach(([h,f],v)=>v?t.lineTo(h,f):t.moveTo(h,f)),u&&t.closePath(),t.stroke();return t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,t.shadowBlur=0,!0}function kt(t,o,e,c,s,a){const i=13*c.halo,r=a.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const u=o/220,m=o/2,d=18*e.round*u,p=40*u,l=48*u,h=o-80*u,f=o-96*u,v=[],T=(n,x,S,A)=>{for(let w=0;w<=1;w+=.12)v.push([n+(S-n)*w,x+(A-x)*w])};T(p+d,l,p+h-d,l),T(p+h,l+d,p+h,l+f-d),T(p+h-d,l+f,p+d,l+f),T(p,l+f-d,p,l+d),t.shadowColor=r(.6),t.shadowBlur=i*.8;const C=4*a.arrow.w*u;if(a.arrow.line==="solid"?(t.setLineDash([10*e.dash*u,8*u]),t.lineDashOffset=-s*22*u,t.strokeStyle=r(.45),t.lineWidth=C,t.beginPath(),t.roundRect(p,l,h,f,d),t.stroke(),t.setLineDash([]),t.lineDashOffset=0):st(t,v,s,a.arrow.w*u,{color:r(.45),closed:!0},a),e.prog!=null&&e.prog>.001){const n=[],x=(b,_,F,B,E)=>{for(let G=1;G<=E;G++)n.push([b+(F-b)*G/E,_+(B-_)*G/E])},S=(b,_,F,B,E)=>{for(let G=1;G<=E;G++){const $=F+(B-F)*G/E;n.push([b+d*Math.cos($),_+d*Math.sin($)])}},A=Math.PI/2,w=p+h,M=l+f,k=p+h/2;n.push([k,l]),x(k,l,w-d,l,8),S(w-d,l+d,-A,0,6),x(w,l+d,w,M-d,10),S(w-d,M-d,0,A,6),x(w-d,M,p+d,M,14),S(p+d,M-d,A,Math.PI,6),x(p,M-d,p,l+d,10),S(p+d,l+d,Math.PI,Math.PI+A,6),x(p+d,l,k,l,8);let I=0;for(let b=1;b<n.length;b++)I+=Math.hypot(n[b][0]-n[b-1][0],n[b][1]-n[b-1][1]);const D=I*Math.min(1,e.prog);t.save(),t.setLineDash([10*e.dash*u,8*u]),t.lineDashOffset=-(h/2-d)-s*22*u,t.strokeStyle=r(.9),t.lineWidth=C*1.3,t.lineCap="round",t.shadowColor=r(.92),t.shadowBlur=i*1.3,t.beginPath(),t.moveTo(n[0][0],n[0][1]);let R=0;for(let b=1;b<n.length&&R<D;b++){const _=Math.hypot(n[b][0]-n[b-1][0],n[b][1]-n[b-1][1]);if(R+_<=D)t.lineTo(n[b][0],n[b][1]),R+=_;else{const F=(D-R)/_;t.lineTo(n[b-1][0]+(n[b][0]-n[b-1][0])*F,n[b-1][1]+(n[b][1]-n[b-1][1])*F),R=D}}t.stroke(),t.setLineDash([]),t.restore()}e.feet>.05&&a.foot&&(a.foot(t,!1,m-16*e.feet*u,m+6*u,26*e.feet*u),a.foot(t,!0,m+16*e.feet*u,m+6*u,26*e.feet*u)),t.shadowBlur=0}function _t(t,o,e,c,s,a,i,r){const u=13*c.halo,m=4*a.arrow.w*(o/220),d=a.lut;t.clearRect(0,0,o,o),t.lineJoin="round";const p=o/220,l=i||[[45*p,130*p],[110*p,60*p],[175*p,110*p]],h=r??s*.5%1,f=Math.min(1,h*1.25)*(l.length-1),v=Math.min(l.length-1,Math.floor(f+.35));t.shadowColor=d(.7),t.shadowBlur=u;const T=[[l[0][0],l[0][1]]];for(let C=1;C<=l.length-1;C++){const n=Math.max(0,Math.min(1,f-(C-1)));if(n<=0)break;T.push([l[C-1][0]+(l[C][0]-l[C-1][0])*n,l[C-1][1]+(l[C][1]-l[C-1][1])*n])}T.length>1&&st(t,T,s,a.arrow.w*p,{color:d(.62)},a),t.setLineDash([4*p,7*p]),t.lineDashOffset=0,t.globalAlpha=.3,t.strokeStyle=d(.45),t.lineWidth=m,t.beginPath(),l.forEach(([C,n],x)=>x?t.lineTo(C,n):t.moveTo(C,n)),t.stroke(),t.globalAlpha=1,t.setLineDash([]),t.lineCap="butt",t.lineDashOffset=0,l.forEach(([C,n],x)=>{const S=x===v,A=S?1+Math.sin(s*6)*.14:1;t.strokeStyle=d(S?.8:.45),t.lineWidth=m*(S?1.3:.9),t.shadowBlur=S?u*1.6:u*.6,t.beginPath(),t.arc(C,n,12*e.node*A*p,0,Math.PI*2),t.stroke(),a.num&&(t.globalAlpha=x<=v?1:.45,a.num(t,String(x+1),C,n,16*e.numS*A*p,Math.round(14*e.numS*p)),t.globalAlpha=1)}),t.shadowBlur=0}function Tt(t,o,e,c,s,a,i){const r=a.lut,u=13*c.halo,m=o/220,d=o/2,p=a.arrow&&a.arrow.w||1,l=(w,M)=>r(w).replace("rgb(","rgba(").replace(")",`,${M})`);t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const h=(e.r!=null?e.r:.42)*o,f=h*(e.rt!=null?e.rt:.36),v=3.4*p*m,T=i!=null?Math.max(0,Math.min(1,i)):s*(e.tempo||.6)%1,C=Math.pow(T,1.6),n=Math.max(0,(T-.9)/.1);t.save(),t.translate(d,d);const x=(w,M,k,I=1)=>{if(w<=.6)return;const D=v*2.6*I,R=Math.max(.1,w-D),b=w+D,_=t.createRadialGradient(0,0,R,0,0,b);_.addColorStop(0,l(M-.05,0)),_.addColorStop(.5,l(M,k*.85)),_.addColorStop(1,l(M-.05,0)),t.globalAlpha=1,t.fillStyle=_,t.shadowBlur=0,t.beginPath(),t.arc(0,0,b,0,Math.PI*2),t.fill(),t.globalAlpha=Math.min(1,k*1.1),t.lineWidth=v*.85,t.strokeStyle=r(Math.min(.98,M+.12)),t.shadowColor=r(.88),t.shadowBlur=u*.6,t.beginPath(),t.arc(0,0,w,0,Math.PI*2),t.stroke(),t.shadowBlur=0},S=t.createRadialGradient(0,0,0,0,0,f*1.08);S.addColorStop(0,l(.6,.1+.18*n)),S.addColorStop(.65,l(.5,.05+.08*n)),S.addColorStop(1,l(.5,0)),t.globalAlpha=1,t.fillStyle=S,t.beginPath(),t.arc(0,0,f*1.08,0,Math.PI*2),t.fill();const A=1+.02*Math.sin(s*2.6);x(f*A,.55+.4*n,.5+.45*n,.9);for(let w=2;w>=0;w--){const M=Math.pow(Math.max(0,T-w*.05),1.6),k=h-(h-f)*M,I=w===0?.6+.4*C:.18/w*(1-n);x(k,.55+.4*C,I*(1-n*.45),1.15-.35*C)}n>.01&&x(f*(1+1.4*n),.9,(1-n)*.8,1.1),t.globalAlpha=.6+.3*n,t.shadowColor=r(.85),t.shadowBlur=u*(.9+n),t.fillStyle=r(.62+.3*n),t.beginPath(),t.arc(0,0,v*.85+3*m*n,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}function Rt(t,o,e,c,s,a,i,r){const u=a.lut,m=13*c.halo,d=o/220,p=o/2,l=a.arrow&&a.arrow.w||1,h=l*d,f=(y,L)=>u(y).replace("rgb(","rgba(").replace(")",","+L+")");t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const v=o*.42*(e.spread!=null?e.spread:1),C=(r||[[-.95,.5],[-.48,-.42],[0,-.8],[.48,-.42],[.95,.5]]).map(([y,L])=>[p+y*v,p+L*v]),n=80,x=[];for(let y=0;y<=n;y++){const L=y/n*(C.length-1),P=Math.min(C.length-2,Math.floor(L)),q=L-P,U=C[Math.max(0,P-1)],K=C[P],N=C[P+1],V=C[Math.min(C.length-1,P+2)],g=(j,J,X,tt)=>.5*(2*J+(-j+X)*q+(2*j-5*J+4*X-tt)*q*q+(-j+3*J-3*X+tt)*q*q*q);x.push([g(U[0],K[0],N[0],V[0]),g(U[1],K[1],N[1],V[1])])}const S=y=>{const L=Math.max(0,Math.min(n,y*n)),P=Math.floor(L),q=L-P,U=x[P],K=x[Math.min(n,P+1)];return[U[0]+(K[0]-U[0])*q,U[1]+(K[1]-U[1])*q]},A=.68;let w,M,k;if(i!=null)w=Math.max(0,Math.min(1,i)),M=1,k=0;else{const y=s*(e.tempo||.42)%1;if(y<A)w=y/A,M=1,k=0;else{const L=(y-A)/(1-A);w=1,M=1-L*L,k=L}}if(M<=.012)return;const I=w*w*w*(w*(6*w-15)+10),D=Math.min(1,16*w*w*(1-w)*(1-w));e.taper!=null&&e.taper;const R=.36*(e.tail!=null?e.tail:1),b=e.width!=null?e.width:1;{const y=t.createLinearGradient(x[0][0],x[0][1],x[n][0],x[n][1]);y.addColorStop(0,f(.46,0)),y.addColorStop(.3,f(.46,.03*M)),y.addColorStop(.8,f(.46,.045*M)),y.addColorStop(1,f(.46,0)),t.globalAlpha=1,t.strokeStyle=y,t.lineWidth=9*h,t.shadowColor=u(.6),t.shadowBlur=m*2,t.beginPath(),x.forEach(([L,P],q)=>q?t.lineTo(L,P):t.moveTo(L,P)),t.stroke(),t.shadowBlur=0}const _=40,F=Math.max(0,I-R*(1-k)),B=[];for(let y=0;y<=_;y++)B.push(S(F+(I-F)*(y/_)));const E=()=>{t.beginPath(),B.forEach(([y,L],P)=>P?t.lineTo(y,L):t.moveTo(y,L)),t.stroke()},G=()=>{const y=t.createLinearGradient(B[0][0],B[0][1],B[_][0],B[_][1]);return y.addColorStop(0,f(.55,0)),y.addColorStop(.4,f(.56,0)),y.addColorStop(.68,f(.6,.09)),y.addColorStop(.88,f(.64,.24)),y.addColorStop(1,f(.68,.44)),y},$=1+.5*D;t.globalAlpha=M,t.strokeStyle=G(),t.lineWidth=(20+10*D)*h*b,t.shadowColor=u(.72),t.shadowBlur=m*2.2,E(),t.strokeStyle=G(),t.lineWidth=(10+5*D)*h*b,t.shadowBlur=m*1,E(),t.shadowBlur=0;for(let y=1;y<=_;y++){const L=y/_;t.globalAlpha=Math.pow(L,2.2)*.95*M,t.strokeStyle=u(.55+.38*L),t.lineWidth=(1.6+6.5*Math.pow(L,.7))*h*b*$,t.beginPath(),t.moveTo(B[y-1][0],B[y-1][1]),t.lineTo(B[y][0],B[y][1]),t.stroke()}const Z=B[_][0],z=B[_][1];t.globalAlpha=.8*M,t.fillStyle=u(.6),t.shadowColor=u(.8),t.shadowBlur=m*1.6,t.beginPath(),t.arc(Z,z,(9+5*D)*h*b,0,Math.PI*2),t.fill(),t.globalAlpha=M,t.fillStyle=u(.93),t.shadowBlur=m*.6,t.beginPath(),t.arc(Z,z,(3.4+1.8*D)*h*b,0,Math.PI*2),t.fill(),t.globalAlpha=1,t.shadowBlur=0}function It(t,o,e,c,s,a,i){const r=a.lut,u=13*c.halo,m=o/220,d=o/2,p=a.arrow&&a.arrow.w||1;t.clearRect(0,0,o,o),t.lineJoin="round",t.lineCap="round";const l=(e.r!=null?e.r:.3)*o,h=e.width!=null?e.width:1,f=4.2*p*m*h,v=e.dir!=null?e.dir:1,T=(e.sweep!=null?e.sweep:.66)*Math.PI*2,C=i!=null?Math.max(0,Math.min(1,i)):s*(e.tempo||.5)%1,n=-Math.PI/2+v*C*Math.PI*2;t.save(),t.translate(d,d),t.globalAlpha=.16,t.lineWidth=f*.7,t.strokeStyle=r(.44),t.shadowColor=r(.6),t.shadowBlur=u*.4,t.beginPath(),t.arc(0,0,l,0,Math.PI*2),t.stroke(),t.shadowBlur=0;const x=16;for(let D=0;D<x;D++){const R=D/(x-1),b=n-v*R*T,_=n-v*(R+1.2/x)*T;t.globalAlpha=(1-R)*.9,t.strokeStyle=r(.55+.35*(1-R)),t.lineWidth=f*(.55+.55*(1-R)),t.shadowColor=r(.8),t.shadowBlur=u*(.4+.5*(1-R)),t.beginPath(),t.arc(0,0,l,Math.min(b,_),Math.max(b,_),!1),t.stroke()}t.shadowBlur=0;const S=Math.cos(n)*l,A=Math.sin(n)*l,w=n+v*Math.PI/2,M=8*m*h;t.save(),t.translate(S,A),t.rotate(w+Math.PI/2),t.globalAlpha=1;const k=3.4*M*(.7+.3*p),I={color:r(.96),glowColor:r(.9),glow:u*1.2};a.glyph&&(a.glyph(t,"LIFT_TIP",0,0,k,I)||a.glyph(t,"TIP_TRI",0,0,k*.93,I))||(t.rotate(-Math.PI/2),t.strokeStyle=r(.96),t.lineWidth=f*.9,t.shadowColor=r(.9),t.shadowBlur=u*1.2,t.beginPath(),t.moveTo(-M,-M*.9),t.lineTo(M*.5,0),t.lineTo(-M,M*.9),t.stroke()),t.restore(),t.globalAlpha=.62,t.shadowColor=r(.75),t.shadowBlur=u*.6,t.fillStyle=r(.6),t.beginPath(),t.arc(0,0,f*.6,0,Math.PI*2),t.fill(),t.restore(),t.globalAlpha=1,t.shadowBlur=0}export{bt as C,yt as M,W as N,O as P,rt as S,_t as a,Ct as b,Tt as c,kt as d,Rt as e,It as f,Mt as g,St as h,ft as i,st as j,pt as k,xt as l,vt as m,wt as n,At as o,it as p,mt as r,ht as s};
