// 복싱 운동중 화면 데이터 — 공통 템플릿(scene.html)에 stage별로 주입.
//   phase: 0=START · 1=WARM UP(A) · 2=DRILL(B) · 3=FIGHT(C). 현재 phase 볼드 + sub(n/N).
//   coach/you 숫자·dotsOn 은 라이브 판정·세션 시간으로 채울 자리(지금은 정적 샘플).
//   say = 진입 첫 안내. cues = 장면 동안 비트처럼 흐르는 짧은 코치 콜(실제 말하듯이). 자막이 cues를 순환.
//   판정 토큰(화살표·타겟·가드)은 여기서 그리지 않음 — 룩 시스템 토큰(session.js _buildBoxing)이 전담.
window.PHASES = ['START', 'WARM UP', 'DRILL', 'FIGHT'];
window.SCENES = {
  // ── A · 준비운동 (WARM UP) ──
  BX_A1: { title:'NECK & SHOULDER ROLLS', phase:1, sub:'1/3',
    coach:{num:'8',unit:'Rolls'}, you:{num:'8',unit:'Rolls'},
    say:'Roll your neck and shoulders, slow', cues:['Slow…','Big circles','Other way','Easy — breathe'], dots:10, dotsOn:0.5, combos:[] },
  BX_A2: { title:'IN & OUT FOOTWORK', phase:1, sub:'2/3',
    coach:{num:'6',unit:'Steps'}, you:{num:'6',unit:'Steps'},
    say:'Light on your feet — front and back', cues:['Light feet','Forward…','And back','Stay bouncy'], dots:10, dotsOn:1.5, combos:[] },
  BX_A3: { title:'LIGHT JAB', phase:1, sub:'3/3',
    coach:{num:'6',unit:'Jabs'}, you:{num:'6',unit:'Jabs'},
    say:'Extend from the shoulder, snap back', cues:['Jab!','Snap back','Again!','From the shoulder'], dots:10, dotsOn:2.5, combos:[] },
  // ── B · 사전 익히기 (DRILL) ──
  BX_B1: { title:'HOLD YOUR GUARD', phase:2, sub:'1/3',
    coach:{num:'3.0',unit:'Sec'}, you:{num:'3.0',unit:'Sec'},
    say:'Keep your fists in the box', cues:['Fists up','Hold it…','Tight guard','Steady'], dots:10, dotsOn:3.5, combos:[] },
  BX_B2: { title:'SLIP & EVADE', phase:2, sub:'2/3',
    coach:{num:'6',unit:'Slips'}, you:{num:'6',unit:'Slips'},
    say:'Slip your head left and right', cues:['Slip right!','And left!','Under it','Keep moving'], dots:10, dotsOn:5, combos:[] },
  BX_B3: { title:'JAB SWEEP', phase:2, sub:'3/3',
    coach:{num:'6',unit:'Sweeps'}, you:{num:'6',unit:'Sweeps'},
    say:'Follow the sweep, hit the target', cues:['Follow it','Jab!','On target','Again!'], dots:10, dotsOn:6, combos:[] },
  // ── C · 실전 (FIGHT) ──
  BX_C1: { title:'START SIGNAL', phase:3, sub:'',
    coach:{num:'3',unit:'Go'}, you:{num:'',unit:''},
    say:'3, 2, 1 — spar!', dots:10, dotsOn:7, combos:[] },
  BX_C2: { title:'JAB SPAR', phase:3, sub:'1/3',
    coach:{num:'—',unit:'Hits'}, you:{num:'5',unit:'Hits'},
    say:'Jab when the target shows', cues:['Target up!','Jab!','Nice','Reset','Again!'], dots:10, dotsOn:8, combos:['Jab!'] },
  BX_C3: { title:'COMBINATION', phase:3, sub:'2/3',
    coach:{num:'—',unit:'Combo'}, you:{num:'2',unit:'Combo'},
    say:'Keep the rhythm — jab, jab, hook', cues:['Jab, jab…','Hook!','Rhythm!','Don’t stop'], dots:10, dotsOn:9, combos:['2x Combo!'] },
  BX_C4: { title:'COOL DOWN', phase:3, sub:'3/3',
    coach:{num:'—',unit:''}, you:{num:'—',unit:''},
    say:'Breathe, drop your guard. Well done', cues:['Breathe…','Guard down','Well done','Good work'], dots:10, dotsOn:10, combos:[] },
};
