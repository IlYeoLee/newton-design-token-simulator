import"./modulepreload-polyfill-B5Qt9EMX.js";import{W as _,S as q,O as H,C as k,c as O,j,M as z,P as Y,k as J}from"./fxlut-DQdnSjAt.js";import{v as K}from"./fx-core-CgxR2OaG.js";const w=360,g=560,Q=document.getElementById("cv"),F=new _({canvas:Q,antialias:!0,preserveDrawingBuffer:!0});F.setPixelRatio(1);F.setSize(720,g,!1);const W=new q,X=new H(0,720,g,0,-1,1),d=document.createElement("video");d.src="ready-view/assets/bk_sidebend_pp.webm";d.muted=!0;d.loop=!0;d.playsInline=!0;d.crossOrigin="anonymous";d.style.display="none";document.body.appendChild(d);const h=256,I=()=>{const e=document.createElement("canvas");return e.width=e.height=h,e},P=I(),U=I(),$=I(),G=new k(P),L=new k(U),N=new k($);for(const e of[G,L,N])e.colorSpace=O;function Z(){if(d.readyState<2)return;const e=P.getContext("2d",{willReadFrequently:!0});e.clearRect(0,0,h,h),e.drawImage(d,0,0,h,h);const t=e.getImageData(0,0,h,h),o=t.data;for(let a=0;a<o.length;a+=4){const s=o[a]/255,u=o[a+1]/255,f=o[a+2]/255,y=1-Math.min(1,Math.max(0,(u-Math.max(s,f)-.04)/.1)),x=.299*s+.587*u+.114*f;o[a]=y*255,o[a+1]=y*x*255,o[a+2]=0,o[a+3]=255}e.putImageData(t,0,0);for(const[a,s]of[[U,12],[$,2]]){const u=a.getContext("2d");u.clearRect(0,0,h,h),u.filter=`blur(${s}px)`,u.drawImage(P,0,0),u.filter="none"}G.needsUpdate=L.needsUpdate=N.needsUpdate=!0}const ee=`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uLUT, uSrc, uField, uFieldN;
  uniform float uMode, uGain, uVCap, uBg, uDetail, uWDet;
  vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v, 0.004, 0.996), 0.5)).rgb; }
  `+K+`
  void main(){
    vec2 uv = vUv;
    vec2 fld  = texture2D(uField,  uv).rg;      // 넓은 블러 = 두께장·노출
    vec2 fldN = texture2D(uFieldN, uv).rg;      // 좁은 블러 = 결
    // ★ 실루엣 판정은 **선명한 마스크**로 한다. 블러된 필드로 하면 26px 블러에 다 녹아
    //   mEro 가 0 이 되고 화면이 배경만 남는다(실제로 그렇게 됐다). 앱도 maskAA(선명)를 쓴다.
    float m = texture2D(uSrc, uv).r;
    float mEro = smoothstep(0.16, 0.52, m);
    vec3 bg = vec3(uBg);
    if (mEro < 0.02) { gl_FragColor = vec4(bg, 1.0); return; }
    float thick = clamp(fld.r * 1.60, 0.0, 1.0);
    float lumB = fld.g / max(fld.r, 0.02);
    float lumS = mix(lumB, fldN.g / max(fldN.r, 0.02), clamp(uDetail * 2.4, 0.0, 1.0));
    float mIn = smoothstep(0.55, 0.95, m);
    vec3 col;
    if (uMode < 0.5) {
      col = personLook(thick, lumS, lumB, mIn, 0.0, uv.y) * mEro * uGain;   // 바닥 경로
    } else {
      float vert = pow(1.0 - uv.y, 1.35) * 0.92 + 0.06;                      // 벽 경로 = 높이만 본다
      // uWDet > 0 이면 영상의 국소 대비(결)를 벽 경로에도 섞는다 — 원래 벽엔 이 경로가 없다.
      float dd = (lumS - lumB) * 3.0; dd = dd / (1.0 + abs(dd) * 1.6);
      col = personColor(clamp(vert + dd * uWDet * 0.5, 0.0, 1.0)) * mEro * uGain;
    }
    float vmx = max(col.r, max(col.g, col.b));
    if (vmx > uVCap) col *= uVCap / vmx;                                     // 명도 상한(양쪽 동일 조건)
    gl_FragColor = vec4(mix(bg, col, mEro), 1.0);
  }`,te=()=>({uLUT:{value:J()},uSrc:{value:G},uField:{value:L},uFieldN:{value:N},uMode:{value:0},uGain:{value:1.12},uVCap:{value:.9},uBg:{value:.42},uDetail:{value:.42},uPDepth:{value:.34},uWDet:{value:0},uPSat:{value:1.32},uPSweep:{value:0},uPHi:{value:.64},uPInk:{value:.85},uPInkT:{value:.42},uPCoral:{value:0}}),i=[0,1].map(e=>{const t=new j({uniforms:te(),vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",fragmentShader:ee});t.uniforms.uMode.value=e;const o=new z(new Y(w,g),t);return o.position.set(w/2+e*w,g/2,0),W.add(o),t}),m=(e,t)=>{const o=document.getElementById(e),a=document.getElementById(e+"V"),s=()=>{a.textContent=(+o.value).toFixed(2),t(+o.value)};o.addEventListener("input",s),s()};m("sat",e=>i.forEach(t=>t.uniforms.uPSat.value=e));m("hiA",e=>i[0].uniforms.uPHi.value=e);m("hiB",e=>i[1].uniforms.uPHi.value=e);m("gain",e=>i.forEach(t=>t.uniforms.uGain.value=e));m("vcap",e=>i.forEach(t=>t.uniforms.uVCap.value=e));m("dep",e=>i.forEach(t=>t.uniforms.uPDepth.value=e));m("ink",e=>i.forEach(t=>t.uniforms.uPInk.value=e));m("inkT",e=>i.forEach(t=>t.uniforms.uPInkT.value=e));m("coral",e=>i.forEach(t=>t.uniforms.uPCoral.value=e));m("wdet",e=>i[1].uniforms.uWDet.value=e);m("bg",e=>i.forEach(t=>t.uniforms.uBg.value=e));const V=(e,t,o)=>"#"+[e,t,o].map(a=>Math.round(a).toString(16).padStart(2,"0")).join("").toUpperCase(),C=(e,t,o)=>{e/=255,t/=255,o/=255;const a=Math.max(e,t,o),s=Math.min(e,t,o),u=a-s;let f=0;return u>1e-6&&(f=a===e?(t-o)/u%6:a===t?(o-e)/u+2:(e-t)/u+4),{h:Math.round((f*60+360)%360),s:a===0?0:u/a,v:a}},oe=document.querySelector("#tb tbody"),ae=document.getElementById("sum");function ne(){const e=F.getContext(),t=new Uint8Array(720*g*4);e.readPixels(0,0,720,g,e.RGBA,e.UNSIGNED_BYTE,t);const o=Math.round(+document.getElementById("bg").value*255),a=n=>Math.abs(t[n]-o)+Math.abs(t[n+1]-o)+Math.abs(t[n+2]-o)>26,s=[[],[]];for(const n of[0,1]){let v=1e9,p=-1;for(let l=0;l<g;l++)for(let S=n*w;S<(n+1)*w;S++)a(((g-1-l)*720+S)*4)&&(l<v&&(v=l),l>p&&(p=l));if(p<0){s[n]=new Array(8).fill(null);continue}for(let l=0;l<8;l++){const S=Math.round(v+(p-v)*l/8),r=Math.round(v+(p-v)*(l+1)/8),c=[],D=[],T=[];for(let b=S;b<r;b++)for(let E=n*w;E<(n+1)*w;E++){const M=((g-1-b)*720+E)*4;a(M)&&(c.push(t[M]),D.push(t[M+1]),T.push(t[M+2]))}if(c.length<20){s[n].push(null);continue}const B=b=>b.sort((E,M)=>E-M)[b.length>>1];s[n].push([B(c),B(D),B(T)])}}let u="",f=0,y=0,x=0;for(let n=0;n<8;n++){const v=s[0][n],p=s[1][n],l=r=>r?`<span class="sw" style="background:${V(...r)}"></span>${V(...r)} S${C(...r).s.toFixed(2)} V${C(...r).v.toFixed(2)}`:"—";let S="—";if(v&&p){const r=C(...v),c=C(...p);f+=r.s-c.s,y+=r.v-c.v,x++,S=`<span class="${Math.abs(r.s-c.s)<.06?"ok":Math.abs(r.s-c.s)<.14?"warn":"bad"}">ΔS ${(r.s-c.s>=0?"+":"")+(r.s-c.s).toFixed(2)} · ΔV ${(r.v-c.v>=0?"+":"")+(r.v-c.v).toFixed(2)}</span>`}u+=`<tr><td>${n+1}/8</td><td>${l(v)}</td><td>${l(p)}</td><td>${S}</td></tr>`}oe.innerHTML=u,ae.innerHTML=x?`평균 <code>ΔS ${(f/x>=0?"+":"")+(f/x).toFixed(3)}</code> · <code>ΔV ${(y/x>=0?"+":"")+(y/x).toFixed(3)}</code>
       — 0 에 가까울수록 두 매핑이 같은 색을 낸다. 배경은 양쪽 동일하므로 섞임 오차가 없다.`:"인물 픽셀을 못 찾음 — 영상이 아직 로드 중일 수 있다."}let R=0;function A(e){requestAnimationFrame(A),Z(),F.render(W,X),e-R>500&&(R=e,ne())}window.__lab={video:d,cSrc:P,cWide:U,cNarrow:$,mats:i};d.play().catch(()=>{});requestAnimationFrame(A);
