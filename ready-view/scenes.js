// 복싱 운동중 화면 데이터 — 공통 템플릿(scene.html)에 stage별로 주입.
//   phase: 0=START · 1=WARM UP(A) · 2=DRILL(B) · 3=FIGHT(C). 현재 phase 볼드 + sub(n/N).
//   coach/you 숫자·dotsOn 은 라이브 판정·세션 시간으로 채울 자리(지금은 정적 샘플).
//   say/cues = 하단 자막. '지시'가 아니라 '동기부여'다(유저 08-03) — 벽 앞 사용자는 스피커로
//   코치 음성을 듣고 있어 같은 지시를 글로 또 읽을 이유도, 읽을 새도 없다. 지시는 음성이 전담.
//   판정 토큰(화살표·타겟·가드)은 여기서 그리지 않음 — 룩 시스템 토큰(session.js _buildBoxing)이 전담.
window.PHASES = ['START', 'STRETCH', 'LEARN', 'STRIKE!'];
window.SCENES = {
  // ── A · 준비운동 (WARM UP) ──
  BX_A1: { title:'NECK & SHOULDER ROLLS', phase:1, sub:'1/3',
    coach:{num:'8',unit:'Rolls'}, you:{num:'8',unit:'Rolls'},
    say:'Easing in', cues:['Nice','That’s it','Loose already'], dots:10, dotsOn:0.5, combos:[] },
  BX_A2: { title:'IN & OUT FOOTWORK', phase:1, sub:'2/3',
    coach:{num:'6',unit:'Steps'}, you:{num:'6',unit:'Steps'},
    say:'Feeling light', cues:['Nice','Bouncy','That’s it'], dots:10, dotsOn:1.5, combos:[] },
  BX_A3: { title:'LIGHT JAB', phase:1, sub:'3/3',
    coach:{num:'6',unit:'Jabs'}, you:{num:'6',unit:'Jabs'},
    say:'Sharp', cues:['Nice snap','That’s it','Looking good'], dots:10, dotsOn:2.5, combos:[] },
  // ── B · 사전 익히기 (DRILL) ──
  BX_B1: { title:'HOLD YOUR GUARD', phase:2, sub:'1/3',
    coach:{num:'3.0',unit:'Sec'}, you:{num:'3.0',unit:'Sec'},
    say:'Rock solid', cues:['Holding','Nice','Strong'], dots:10, dotsOn:3.5, combos:[] },
  BX_B2: { title:'SLIP & EVADE', phase:2, sub:'2/3',
    coach:{num:'6',unit:'Slips'}, you:{num:'6',unit:'Slips'},
    say:'Slick', cues:['Untouchable','Nice','Can’t catch you'], dots:10, dotsOn:5, combos:[] },
  BX_B3: { title:'JAB SWEEP', phase:2, sub:'3/3',
    coach:{num:'6',unit:'Sweeps'}, you:{num:'6',unit:'Sweeps'},
    say:'Dialled in', cues:['On target','Nice','Sharp'], dots:10, dotsOn:6, combos:[] },
  // ── C · 실전 (FIGHT) ──
  BX_C1: { title:'START SIGNAL', phase:3, sub:'',
    coach:{num:'3',unit:'Go'}, you:{num:'',unit:''},
    say:'3, 2, 1 — spar!', dots:10, dotsOn:7, combos:[] },
  BX_C2: { title:'JAB SPAR', phase:3, sub:'1/3',
    coach:{num:'—',unit:'Hits'}, you:{num:'5',unit:'Hits'},
    say:'Let’s go', cues:['Nice','Sharp','Keep it up'], dots:10, dotsOn:8, combos:['Jab!'] },
  BX_C3: { title:'COMBINATION', phase:3, sub:'2/3',
    coach:{num:'—',unit:'Combo'}, you:{num:'2',unit:'Combo'},
    say:'Rhythm’s good', cues:['Nice combo','On fire','Keep it up'], dots:10, dotsOn:9, combos:['2x Combo!'] },
  BX_C4: { title:'COOL DOWN', phase:3, sub:'3/3',
    coach:{num:'—',unit:''}, you:{num:'—',unit:''},
    say:'Great work', cues:['Well done','Strong session','Nice one'], dots:10, dotsOn:10, combos:[] },
};
