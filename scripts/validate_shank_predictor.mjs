import fs from 'fs';
const BVH=new URL('../public/mocap/run_normal.bvh', import.meta.url);
const txt=fs.readFileSync(BVH,'utf8').split(/\r?\n/);
const joints=[]; const stack=[]; let cur=null;
for(const raw of txt){const line=raw.trim();
 if(/^(ROOT|JOINT)\s+(\S+)/.test(line)){const j={name:line.split(/\s+/)[1],parent:stack.length?stack[stack.length-1]:null,channels:[]};joints.push(j);cur=j;}
 else if(line==='{')stack.push(cur); else if(line==='}')stack.pop();
 else if(/^CHANNELS/.test(line)){const p=line.split(/\s+/);cur.channels=p.slice(2,2+ +p[1]);}
 else if(line.startsWith('End Site'))stack.push({name:'__end',channels:[]});}
let col=0;for(const j of joints){j.col=col;col+=j.channels.length;}
const byName=Object.fromEntries(joints.map(j=>[j.name,j]));
const iF=txt.findIndex(l=>/^Frames:/.test(l.trim()));
const dt=+txt[iF+1].trim().split(/\s+/)[2];
const frames=txt.slice(iF+2).filter(l=>l.trim()).map(l=>l.trim().split(/\s+/).map(Number));
const D=Math.PI/180;
const Rx=a=>[[1,0,0],[0,Math.cos(a),-Math.sin(a)],[0,Math.sin(a),Math.cos(a)]];
const Ry=a=>[[Math.cos(a),0,Math.sin(a)],[0,1,0],[-Math.sin(a),0,Math.cos(a)]];
const Rz=a=>[[Math.cos(a),-Math.sin(a),0],[Math.sin(a),Math.cos(a),0],[0,0,1]];
const mm=(A,B)=>A.map((r,i)=>B[0].map((_,j)=>A[i][0]*B[0][j]+A[i][1]*B[1][j]+A[i][2]*B[2][j]));
const T=A=>[[A[0][0],A[1][0],A[2][0]],[A[0][1],A[1][1],A[2][1]],[A[0][2],A[1][2],A[2][2]]];
function localR(j,f){let M=[[1,0,0],[0,1,0],[0,0,1]];for(let k=0;k<j.channels.length;k++){const ch=j.channels[k],v=f[j.col+k];if(ch==='Xrotation')M=mm(M,Rx(v*D));else if(ch==='Yrotation')M=mm(M,Ry(v*D));else if(ch==='Zrotation')M=mm(M,Rz(v*D));}return M;}
function worldR(name,f){const ch=[];let j=byName[name];while(j){ch.unshift(j);j=j.parent?byName[j.parent]:null;}let M=[[1,0,0],[0,1,0],[0,0,1]];for(const jj of ch)M=mm(M,localR(jj,f));return M;}
const ang=(A,B)=>{let tr=0;for(let i=0;i<3;i++)for(let k=0;k<3;k++)tr+=A[k][i]*B[k][i];return Math.acos(Math.max(-1,Math.min(1,(tr-1)/2)));};
const W=frames.map(f=>worldR('LowerLeg_R',f));
// constant-angular-velocity predictor: predict W[i+1] = dR * W[i], dR = W[i] * W[i-1]^T
const dist=0.5, cmOf=rad=>Math.tan(rad)*dist*100;
let ezoh=[],ecv=[];
for(let i=1;i<W.length-1;i++){
  const eZ=ang(W[i],W[i+1]);                 // ZOH: no prediction, error = motion over dt
  const dR=mm(W[i],T(W[i-1]));               // world delta over last frame
  const pred=mm(dR,W[i]);                    // extrapolate one frame
  const eC=ang(pred,W[i+1]);
  ezoh.push(eZ); ecv.push(eC);
}
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
// split swing (high motion) vs stance (low)
const zohSwing=ezoh.filter(e=>e/dt/D>200), idxSwing=ezoh.map((e,i)=>e/dt/D>200?i:-1).filter(i=>i>=0);
const cvSwing=idxSwing.map(i=>ecv[i]);
console.log('예측기 검증 (실측 러닝 모캡, 등각속도 예측, 호라이즌='+(dt*1000).toFixed(0)+'ms ≈ 지연 30ms)');
console.log('전구간 RMS 지향오차:  ZOH(예측無)='+cmOf(rms(ezoh)).toFixed(2)+'cm  →  CV예측='+cmOf(rms(ecv)).toFixed(2)+'cm');
console.log('스윙구간 RMS:         ZOH='+cmOf(rms(zohSwing)).toFixed(2)+'cm  →  CV예측='+cmOf(rms(cvSwing)).toFixed(2)+'cm');
console.log('→ 측정된 지연오차 감소율(ffCancel): 전구간='+(1-rms(ecv)/rms(ezoh)).toFixed(2)+'  스윙='+(1-rms(cvSwing)/rms(zohSwing)).toFixed(2));
