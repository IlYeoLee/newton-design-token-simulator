import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const p=await b.newPage(); await p.setViewport({width:1600,height:900});
await p.goto('http://127.0.0.1:5210/tokens.html?uiscale=0.5',{waitUntil:'networkidle0',timeout:40000});
await new Promise(r=>setTimeout(r,2500));
const rows=await p.evaluate(()=>{
  document.querySelector('#play').click();
  const at=(c,T)=>{ c.gl.resetAnim();
    for(let s=0;s<T;s+=1/30){c.gl.t=s;c.gl._sig=null;c.gl._lastPaint=-1;if(window.__feed)window.__feed(c,s);try{c.gl.update(1/30);}catch{}}
    const B=c.gl._boxes||[]; const pill=B.find(v=>v.k==='pill'), arc=B.find(v=>v.k==='arc');
    return { pill: pill?Math.round(pill.w):0, arc: arc?Math.round(arc.w):0 }; };
  return window.__cells.map(c=>({ id:c.st.id, early:at(c,1.0), late:at(c, /^(A2|A3|BK_A[23]|BK_B[12345])$/.test(c.st.id) ? 9.0 : 6.0) }));
});
const A={A1:'time',A2:'time',A3:'time',P1:'time',P2:'segment',P3:'segment',C1:'count',C2:'time',C3:'time',C4:'distance',C5:'none',
 BK_A1:'time',BK_A3:'time',BK_B1:'reps',BK_B2:'skill',BK_B3:'skill',BK_B4:'skill',BK_B5:'skill',BK_C1:'count',BK_C2:'reps'};
console.log('스테이지    adv       t=1.0  알약/아크    늦은시점 알약/아크    규칙대로?');
for(const r of rows){
  const adv=A[r.id]||'—';
  const e=`${r.early.pill}/${r.early.arc}`, l=`${r.late.pill}/${r.late.arc}`;
  let want='';
  // ★ 접힘은 **알약이 화면의 전부가 아닌 화면(P·C)** 에서만 — 스트레칭·학습은 타이틀이 남아야
  //   한다(유저: 스트레칭할 때 타이틀 없어지니 어색하다). pillLeads 와 같은 판정.
  const leads = !/^(P[0-9]|C[1-5])$/.test(r.id);
  if(adv==='time')    want = leads
      ? (r.late.pill>0 && r.late.arc>0 ? 'ok' : '✗ 알약+아크 둘 다 남아야')
      : (r.late.pill===0 && r.late.arc>0 ? 'ok' : '✗ 접혀서 아크만 남아야');
  else if(adv==='segment'||adv==='hold'||adv==='reps')
                      want = r.late.pill>0 && r.late.arc===0 ? 'ok' : '✗ 링만 남아야';
  else if(adv==='skill') want = r.late.arc===0 ? 'ok' : '✗ 시계 없어야';
  else want='(전용 페인터)';
  console.log('  '+r.id.padEnd(10)+adv.padEnd(10)+e.padEnd(14)+l.padEnd(14)+want);
}
await b.close();
