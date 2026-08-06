// 가이드 룩 실물 확인 — 코치 판과 **같은 셰이더 조각**에 정지 프레임을 물려 렌더한다.
//   (헤드리스에선 비디오가 readyState 2 를 못 넘어서 앱 화면으로는 못 본다.)
import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 1900, height: 340 });
p.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
p.on('console', m => { if (m.type()==='error') console.log('C', m.text().slice(0,300)); });
await p.goto('http://localhost:5199/', { waitUntil:'networkidle2', timeout:60000 });
await new Promise(r=>setTimeout(r,16000));
const res = await p.evaluate(async () => {
  const THREE = window.__dbg.THREE;
  const FX = await import('/src/fx-core.js');
  const HOT = await fetch('/stepback-hotspots.json').then(r=>r.json());
  const CASES = [['pre', 1.10], ['b1', 1.30], ['b1', 1.433], ['b2', 1.700], ['b3', 2.067]];
  const W = 372, H = 311;   // 실제 코치 판 비율(w1.04 : h0.87) — 안 맞추면 토큰이 타원으로 보인다
  const out = document.createElement('canvas'); out.width = W*CASES.length; out.height = H;
  const og = out.getContext('2d');
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const rr = new THREE.WebGLRenderer({ canvas: rc, alpha: true, antialias: true, preserveDrawingBuffer: true });
  rr.setClearColor(0x6b7360, 1);   // 지면 비슷한 배경 — 알파 합성 결과를 보려면 바닥이 있어야 한다
  const tok = new THREE.TextureLoader().load('/ready-view/assets/body-ring.png');
  tok.colorSpace = THREE.SRGBColorSpace;
  const load = u => new Promise(res => { const t = new THREE.TextureLoader().load(u, tt => res(tt)); });
  for (let i = 0; i < CASES.length; i++) {
    const [name, vt] = CASES[i];
    const map = await load('/_gframes/' + name + '.png');
    map.colorSpace = THREE.SRGBColorSpace;
    // 비트 상태 = 앱과 같은 규칙
    let cur = null; for (const bt of HOT.beats) if (vt >= bt.tOn - 1e-6) cur = bt;
    const k = cur ? Math.max(0, Math.min(1, (vt - cur.tOn) / Math.max(0.05, cur.tLand - cur.tOn))) : 0;
    const pop = cur ? Math.max(0, 1 - Math.abs(vt - cur.tLand) / 0.12) : 0;
    const paleK = Math.max(0, Math.min(1, (vt - HOT.beats[0].tOn) / 0.5));
    const gz = 0.025 * (1 + 0.55 * pop) * Math.min(1, k*3 + 0.15), asp = 0.87/1.04;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        map: { value: map }, uLUT: { value: (await import('/src/fxlut.js')).getLUT() }, uTime: { value: 1.2 },
        uPSat: { value: 1.32 }, uPSweep: { value: 0 }, uPHi: { value: 0.86 }, uPDepth: { value: 0.34 },
        uPCoral: { value: 0 }, uPExp: { value: 0.5 }, uPForm: { value: 0 }, uPLo: { value: 0.12 },
        uPHiL: { value: 0.85 }, uPLumLin: { value: 0 }, uPCalWave: { value: 1 }, uPCalD: { value: 1 },
        uPCalW: { value: 1 }, uPCalB: { value: 0 }, uPInk: { value: 0.85 }, uPInkT: { value: 0.42 },
        uFaceLift: { value: 0 }, uFaceE: { value: new THREE.Vector4() },
        uHotE: { value: cur ? new THREE.Vector4(cur.at[0], cur.at[1] + cur.r*0.55, cur.r*1.35, cur.r*2.10) : new THREE.Vector4() },
        uGaze: { value: cur ? new THREE.Vector4(cur.at[0], cur.at[1], gz*asp, gz) : new THREE.Vector4() },
        uHot: { value: cur ? k : 0 }, uPHiPale: { value: 0.86 + (0.97-0.86)*paleK }, uPHiHot: { value: 0.55 },
        uTokTex: { value: tok },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform sampler2D map, uLUT; uniform float uTime;
        vec3 lut(float v){ return texture2D(uLUT, vec2(clamp(v,0.004,0.996),0.5)).rgb; }
        ` + FX.PERSON_GLSL + `
        float m1(vec2 uv){ vec3 c=texture2D(map,uv).rgb; float kk=c.g-max(c.r,c.b);
          float l=dot(c,vec3(0.299,0.587,0.114)); kk*=mix(1.45,1.0,smoothstep(0.08,0.30,l));
          return 1.0-smoothstep(0.04,0.14,kk); }
        void main(){
          vec2 uv=vUv; gHot=hotAt(uv);
          vec3 c=texture2D(map,uv).rgb; float m=m1(uv);
          float lum=dot(c,vec3(0.299,0.587,0.114));
          vec3 col=personGuide(personColor(clamp(lum*1.25,0.0,1.0)));   // ★ 앱과 같은 합류 지점 — personColor 만 부르면 aura 경로를 못 본다
          float a=m;
          vec4 gzc=gazeToken(uv,uTime);
          col=mix(col,gzc.rgb,gzc.a); a=max(a,gzc.a);
          gl_FragColor=vec4(col,a); }`,
    });
    const sc = new THREE.Scene(); const cam = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10); cam.position.z=2;
    sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat));
    rr.render(sc, cam);
    og.drawImage(rc, i*W, 0);
    og.fillStyle='#fff'; og.font='600 15px sans-serif';
    og.fillText(`${name}  vt=${vt}  ${cur?cur.part:'-'}  hot=${(cur?k:0).toFixed(2)}`, i*W+10, 22);
  }
  return out.toDataURL('image/png');
});
const fsp = await import('fs');
fsp.writeFileSync('C:/Users/user/AppData/Local/Temp/claude/C--Users-user/139e2466-2b63-4488-a7b2-cdc869b09bf1/scratchpad/guide.png',
  Buffer.from(res.split(',')[1], 'base64'));
console.log('렌더 완료');
await b.close();
