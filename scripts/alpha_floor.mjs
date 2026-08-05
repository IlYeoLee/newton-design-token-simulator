// 옅은 베일 끊기 — 휘도가 문턱 아래면 완전 투명으로.
//   왜: alphagamma 0.5 는 어두운 톤(머리카락 회색 등)을 살리려고 알파를 들어올리는데,
//   거의-검정인 배경까지 같이 올라가 판 전체에 알파 20~30 짜리 베일이 남는다.
//   그 베일이 (1) 배경을 미세하게 깎고 (2) 노이즈라 압축이 안 돼 용량을 몇 배로 부풀린다.
//   실측: 알파>0 픽셀의 88.6% 가 알파 40 미만이었다.
//   문턱 위는 손대지 않는다 — 어두운 톤 보존은 그대로다.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const SRC=process.argv[2], OUT=arg('out',SRC+'_floor'), TH=+arg('th',0.05), SOFT=+arg('soft',0.03);
const files=fs.readdirSync(SRC).filter(f=>/\.png$/i.test(f)).sort();
const d=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',path.join(SRC,files[0])]).toString().trim().split(',');
const W=+d[0],H=+d[1]; fs.mkdirSync(OUT,{recursive:true});
const A=path.join(OUT,'_a.raw'); const t0=Date.now();
for(let n=0;n<files.length;n++){
  execFileSync('ffmpeg',['-v','error','-y','-i',path.join(SRC,files[n]),'-pix_fmt','rgba','-f','rawvideo',A]);
  const P=fs.readFileSync(A);
  for(let i=0;i<W*H;i++){const q=i*4;
    const l=(0.299*P[q]+0.587*P[q+1]+0.114*P[q+2])/255;
    if(l<=TH){P[q]=P[q+1]=P[q+2]=P[q+3]=0;}
    else if(l<TH+SOFT){const k=(l-TH)/SOFT;P[q+3]=Math.round(P[q+3]*k*k*(3-2*k));}}
  fs.writeFileSync(A,P);
  execFileSync('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${W}x${H}`,'-i',A,path.join(OUT,files[n])]);
  if((n+1)%30===0||n===files.length-1)process.stdout.write(`\r  ${n+1}/${files.length}  ${((Date.now()-t0)/1000).toFixed(0)}s  `);
}
fs.unlinkSync(A); console.log(`\n✅ ${OUT}`);
