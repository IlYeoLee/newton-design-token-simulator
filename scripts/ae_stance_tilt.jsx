// ─────────────────────────────────────────────────────────────
// 발 벌리기(BK_B1 셋업) 지면 토큰 — **띠 프레임 기울기 리그**를 에펙에 세운다.
//
//   에펙에서: 파일 > 스크립트 > 스크립트 파일 실행… > 이 파일
//   기존 컴프는 안 건드린다. 폴더 하나(newton stance)만 추가한다.
//
// 무엇을 만드나
//   1인칭 눈에서 −55°로 내려다본 바닥을 3D 로 그대로 세운다. 평면(2D)으로 그린 발자국·화살표를
//   지면 레이어에 얹으면 시뮬과 **같은 원근**이 걸린다. 기울기를 눈대중으로 맞추지 않아도 된다.
//
// 값의 출처 — 전부 시뮬 실측이다(임의 수치 없음)
//   눈 높이 1.69 m · 눈 z −1.809          scripts/_grid_b1stance.mjs (BK_B1 벌림 완료 시점)
//   시선 −55°                              main.js GAZE.STANCE — 띠 안에 넷 다 들어오는 −63~−47°의 중앙
//   띠 1816×510 (3.561:1)                  유저 레퍼런스 프레임
//   세로 화각 32.16°                        16:9·vfov 60°(main.js fpMode)의 가로 화각을 유지한 채
//                                            세로만 띠로 자른 값 = 2·atan(tan30°·(16/9)/3.561)
//   발자국 앞거리 1.19 m · 반간격 0.14→0.28  session.js B1_SETUP (Z / HALF0 / HALF1)
//   화살표 앞거리 0.93 m · 꼬리 ±0.04       session.js B1_SETUP (AZ / AX), 길이 0.22 · 배율 1.55
//   발 길이 0.30 m                          tokens.js FOOT_LEN_M
//   모션 곡선                                session.js bkB1SetupPose — 0.8s 대기 → 3.0s 벌림(smoothstep)
//                                            → 3.0s Success → 4.2s 퇴장. 아래 키프레임이 그 곡선이다.
//
// 축약 규약: **1 m = 1000 px** (리포의 지면 대지 규약과 같다 — 1 px = 1 mm)
//   에펙은 Y 가 아래로 자란다. 지면은 y=0, 카메라는 y=−1690 에 둔다.
// ─────────────────────────────────────────────────────────────
(function () {
  var W = 1816, H = 510, FPS = 30, DUR = 6.0;        // 띠 프레임 · 셋업 막 길이(B1_SETUP.SETUP)
  var MPX = 1000;                                     // 1 m = 1000 px
  var EYE_H = 1.69 * MPX;                             // 눈높이
  var PITCH = 55;                                     // 하향각(도) — GAZE.STANCE
  var VFOV = 32.16;                                   // 띠의 세로 화각(도)
  var FOOT_D = 1.19 * MPX, ARROW_D = 0.93 * MPX;      // 눈 기준 앞거리
  var HALF0 = 0.14 * MPX, HALF1 = 0.28 * MPX;         // 발자국 반간격(모음 → 어깨너비+)
  var FOOT_L = 0.30 * MPX;                            // 발 길이
  var ARROW_L = 0.22 * MPX * 1.55, ARROW_X = 0.04 * MPX;
  var T = { WAIT: 0.8, WIDEN: 3.0, EXIT: 4.2 };       // bkB1SetupPose 의 마디

  var rad = function (d) { return d * Math.PI / 180; };

  app.beginUndoGroup('newton 스탠스 기울기 리그');
  var bin = app.project.items.addFolder('newton stance');
  var comp = app.project.items.addComp('BK_B1 스탠스 — 띠 1816x510 · -55deg', W, H, 1, DUR, FPS);
  comp.parentFolder = bin;
  comp.bgColor = [0, 0, 0];                           // 가산광은 검정 위에서 제 색이 나온다(ae_import 와 같은 규약)

  // ── 카메라 ────────────────────────────────────────────────────────────
  //   Zoom 은 화각에서 역산한다. AE 의 '화각' 필드는 긴 변 기준이라 손으로 넣으면 어긋난다.
  //   zoom = (컴프 높이/2) / tan(세로화각/2) → 가로 화각이 자동으로 91.5°가 된다(= 16:9 원본과 동일).
  var zoom = (H / 2) / Math.tan(rad(VFOV) / 2);
  var cam = comp.layers.addCamera('EYE -55deg', [W / 2, H / 2]);
  cam.property('Zoom').setValue(zoom);
  cam.property('Position').setValue([0, -EYE_H, 0]);
  // 관심점 = 눈에서 −55°로 내려간 시선이 바닥(y=0)에 닿는 점. 앞거리 = 눈높이 / tan(55°)
  cam.property('Point of Interest').setValue([0, 0, EYE_H / Math.tan(rad(PITCH))]);

  // ── 지면 ──────────────────────────────────────────────────────────────
  //   X 회전 90° = 레이어가 눕는다. 여기 자식으로 붙인 2D 그림은 전부 같은 원근을 탄다.
  var floor = comp.layers.addSolid([0.06, 0.06, 0.07], 'FLOOR (여기에 배경/그림을 얹는다)',
                                   6 * MPX, 6 * MPX, 1, DUR);
  floor.threeDLayer = true;
  floor.property('Position').setValue([0, 0, 2.4 * MPX]);   // 시선이 닿는 구간이 화면 한가운데 오게
  floor.property('X Rotation').setValue(90);
  floor.enabled = false;                                    // 기본은 꺼 둠 — 참조 격자용

  // 30cm 격자 가이드 — "발이 저 타일 하나만 하냐"를 눈이 아니라 자로 본다
  var grid = comp.layers.addShape();
  grid.name = 'GUIDE 30cm 격자';
  grid.threeDLayer = true;
  grid.property('X Rotation').setValue(90);
  grid.property('Position').setValue([0, 0, FOOT_D]);
  (function () {
    var g = grid.property('Contents');
    for (var i = -8; i <= 8; i++) {
      var v = g.addProperty('ADBE Vector Shape - Group');
      v.name = 'c' + i;
      var pth = new Shape(); pth.vertices = [[i * 300, -2400], [i * 300, 2400]]; pth.closed = false;
      v.property('Contents').addProperty('ADBE Vector Shape - Group').property('Path').setValue(pth);
      var st = v.property('Contents').addProperty('ADBE Vector Graphic - Stroke');
      st.property('Color').setValue([0.36, 0.90, 0.60]);
      st.property('Stroke Width').setValue(i % 3 === 0 ? 4 : 2);
      st.property('Opacity').setValue(i % 3 === 0 ? 55 : 28);
    }
  })();
  grid.enabled = false;

  // ── 토큰 자리 (여기에 여러분의 그림을 교체해 넣는다) ──────────────────
  //   널이 아니라 솔리드로 둔다 — 크기·자리가 눈에 보여야 그림을 갈아 끼우기 쉽다.
  function plate(name, w, h, col, z, x) {
    var L = comp.layers.addSolid(col, name, Math.round(w), Math.round(h), 1, DUR);
    L.threeDLayer = true;
    L.property('X Rotation').setValue(90);               // 바닥에 눕힌다
    L.property('Position').setValue([x, 0, z]);
    L.property('Opacity').setValue(85);
    return L;
  }
  var fL = plate('FOOT L (0.30m)', FOOT_L * 0.62, FOOT_L, [1, 0.36, 0.16], FOOT_D, -HALF0);
  var fR = plate('FOOT R (0.30m)', FOOT_L * 0.62, FOOT_L, [1, 0.36, 0.16], FOOT_D,  HALF0);
  var aL = plate('ARROW L', ARROW_L, ARROW_L * 0.5, [1, 0.76, 0.54], ARROW_D, -ARROW_X);
  var aR = plate('ARROW R', ARROW_L, ARROW_L * 0.5, [1, 0.76, 0.54], ARROW_D,  ARROW_X);
  aL.property('Z Rotation').setValue(0);                 // 촉이 바깥을 향하도록 그림 쪽에서 맞춘다
  aR.property('Z Rotation').setValue(180);

  // ── 모션 — bkB1SetupPose 그대로 ────────────────────────────────────────
  //   ★ 이징을 손으로 찍지 않는다. 시뮬은 smoothstep(3t²−2t³)이라 **매 프레임 값을 굽는다**.
  //     에펙 기본 이지이즈는 그 곡선이 아니라, 랩과 영상이 미묘하게 안 맞는 원인이 된다.
  var nF = Math.round(T.EXIT * FPS) + 1;
  var tt = [], xL = [], xR = [], opF = [], opA = [];
  for (var f = 0; f <= nF; f++) {
    var t = f / FPS;
    var wk = t < T.WAIT ? 0 : Math.min(1, (t - T.WAIT) / (T.WIDEN - T.WAIT));
    var we = wk * wk * (3 - 2 * wk);                          // smoothstep
    var half = HALF0 + (HALF1 - HALF0) * we;
    tt.push(t); xL.push([-half, 0, FOOT_D]); xR.push([half, 0, FOOT_D]);
    opF.push(Math.max(0, Math.min(1, (T.WIDEN + 1.2 - t) / 0.9)) * 100);
    opA.push((t > 0.7 && t < T.WIDEN + 0.5) ? 100 : 0);       // 화살표 등장 창
  }
  fL.property('Position').setValuesAtTimes(tt, xL);
  fR.property('Position').setValuesAtTimes(tt, xR);
  fL.property('Opacity').setValuesAtTimes(tt, opF);
  fR.property('Opacity').setValuesAtTimes(tt, opF);
  aL.property('Opacity').setValuesAtTimes(tt, opA);
  aR.property('Opacity').setValuesAtTimes(tt, opA);

  // 화살표 draw-on(_prog) = 벌어짐 진행 그대로. 그림이 마스크 기반이면 이 슬라이더에 물린다.
  var ctl = comp.layers.addNull(DUR);
  ctl.name = 'CTRL — draw-on(prog)';
  var sl = ctl.property('Effects').addProperty('ADBE Slider Control');
  sl.name = 'prog';
  var pv = [];
  for (var i2 = 0; i2 < tt.length; i2++) {
    var wk2 = tt[i2] < T.WAIT ? 0 : Math.min(1, (tt[i2] - T.WAIT) / (T.WIDEN - T.WAIT));
    pv.push(Math.max(0.15, wk2 * wk2 * (3 - 2 * wk2)) * 100);
  }
  sl.property('Slider').setValuesAtTimes(tt, pv);

  comp.openInViewer();
  app.endUndoGroup();

  alert('스탠스 기울기 리그를 세웠습니다.\n\n' +
        '컴프  : ' + W + '×' + H + ' (3.561:1) · ' + FPS + 'fps · ' + DUR + 's\n' +
        '카메라: 눈높이 1.69m · 하향 ' + PITCH + '° · Zoom ' + Math.round(zoom) + 'px (세로화각 ' + VFOV + '°)\n' +
        '축약  : 1 m = 1000 px\n\n' +
        'FOOT/ARROW 솔리드를 여러분의 그림으로 교체하세요.\n' +
        '3D·X회전 90°·위치만 유지하면 원근은 그대로 걸립니다.\n' +
        'GUIDE 30cm 격자 · FLOOR 는 꺼 뒀습니다(체크로 켜세요).');
})();
