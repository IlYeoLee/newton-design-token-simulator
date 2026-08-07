// 러닝 지면 UI 기울기 리그 — 실사 트랙(러닝보정 Topaz Gigapixel 4x)의 원근을 그대로 세운다.
//
//   쓰는 법: 지면에 눕힐 레이어(UI 이미지)를 **선택**하고 이 스크립트를 실행한다.
//            선택한 레이어가 3D 로 바뀌어 바닥에 눕고, 실사와 같은 원근을 타는 카메라가 선다.
//            아무것도 안 고르면 카메라와 격자만 세운다(크기 감 잡을 때).
//
//   ─ 각도는 어디서 왔나 ────────────────────────────────────────────────
//   실사 레인선의 소실점을 실측했다(measure_track_vp.mjs · 바탕화면):
//     소실점  (847, -31)  [1672x941 기준]  →  원본 6688x3764 에서 (3388, -124)
//     지평선이 화면 중심보다 501.5px 위 · 가로로는 중심에서 11px (사실상 정면)
//     선별 잔차 최대 10.6px = 폭의 0.6% — 한 점에서 만난다
//   f 와 하향각은 한 쌍이라 화각을 정해야 각이 정해진다:
//     40° → 21.20°   50° → 26.43°   60° → 31.61°   70° → 36.73°
//   VFOV 기본값 60° 은 리포의 1인칭 렌더(main.js fpMode)와 같은 값이라 시뮬과 어긋나지 않는다.
//   ★ 화각을 바꾸면 PITCH 도 위 표대로 같이 바꿀 것. 하나만 바꾸면 원근이 깨진다.
//
//   축약 규약: 1 m = 1000 px  (리포 지면 대지와 같다 — 1 px = 1 mm)
//   ae_stance_tilt.jsx(농구 셋업)와 같은 리그 구조다.
(function () {
  // ── 만지는 값 ──────────────────────────────────────────────
  var VFOV  = 60;        // 세로 화각(도). 바꾸면 PITCH 도 위 표대로.
  var PITCH = 31.61;     // 하향각(도) — 실측 소실점에서 역산
  var EYE_M = 1.55;      // ★ 이 값만 실측이 아니다. 러닝 POV 눈높이 추정.
                         //   기울기에는 영향이 없고 **크기(스케일)만** 정한다.
                         //   실사와 UI 크기가 안 맞으면 여기만 만진다.
  var MPX   = 1000;      // 1 m = 1000 px
  // ──────────────────────────────────────────────────────────

  var comp = app.project.activeItem;
  if (!(comp && comp instanceof CompItem)) { alert('컴프를 먼저 여세요.'); return; }

  var rad = function (d) { return d * Math.PI / 180; };
  var W = comp.width, H = comp.height;
  var EYE = EYE_M * MPX;
  var zoom = (H / 2) / Math.tan(rad(VFOV) / 2);   // AE '화각' 필드는 긴 변 기준이라 손으로 넣지 말 것
  var sel = comp.selectedLayers.slice();          // 아래에서 선택이 바뀌므로 미리 복사

  app.beginUndoGroup('러닝 지면 기울기');

  // ── 카메라: 눈높이에서 PITCH 만큼 내려다본다
  var camName = 'EYE -' + PITCH + 'deg (러닝)';
  var cam = null;
  for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === camName) cam = comp.layer(i);
  if (!cam) cam = comp.layers.addCamera(camName, [W / 2, H / 2]);
  cam.property('Zoom').setValue(zoom);
  cam.property('Position').setValue([0, -EYE, 0]);
  // 시선이 바닥(y=0)과 만나는 지점을 바라본다 → 그 방향이 곧 하향각이다
  cam.property('Point of Interest').setValue([0, 0, EYE / Math.tan(rad(PITCH))]);

  // ── 선택한 레이어를 바닥에 눕힌다
  var laid = [];
  for (var k = 0; k < sel.length; k++) {
    var L = sel[k];
    if (L instanceof CameraLayer || L instanceof LightLayer) continue;
    L.threeDLayer = true;
    L.property('X Rotation').setValue(90);       // 바닥에 눕힘 (Y회전·Z회전은 안 건드린다)
    L.property('Y Rotation').setValue(0);
    L.property('Z Rotation').setValue(0);
    // 발밑에서 앞쪽으로 — 소실점이 가로 중앙이라 x 는 0
    L.property('Position').setValue([0, 0, EYE / Math.tan(rad(PITCH))]);
    laid.push(L.name);
  }

  // ── 30cm 격자 (크기 판단용, 기본 꺼짐)
  var gname = 'GUIDE — 30cm 격자';
  var has = false;
  for (var g = 1; g <= comp.numLayers; g++) if (comp.layer(g).name === gname) has = true;
  // ★ 격자는 **보조**다 — 실패해도 리그(카메라·바닥)는 서야 한다. 통째로 감싼다.
  //   그리고 이펙트를 표시이름('Grid')으로 붙이면 한글판에서 죽는다(유저 실측: 73행에서 중단).
  //   matchName('ADBE Grid')은 언어와 무관하다 — 항상 이걸 쓴다.
  if (!has) {
    try {
      var grid = comp.layers.addSolid([0.25, 0.25, 0.25], gname, 12 * MPX, 24 * MPX, 1);
      grid.threeDLayer = true;
      grid.property('X Rotation').setValue(90);
      grid.property('Position').setValue([0, 0, 8 * MPX]);
      var fx = null;
      try { fx = grid.property('Effects').addProperty('ADBE Grid'); }
      catch (e1) { try { fx = grid.property('Effects').addProperty('Grid'); } catch (e2) { fx = null; } }
      if (fx) {
        try { fx.property('Size From').setValue(3); } catch (e) {}
        try { fx.property('Width').setValue(0.30 * MPX); } catch (e) {}
        try { fx.property('Height').setValue(0.30 * MPX); } catch (e) {}
        try { fx.property('Border').setValue(3); } catch (e) {}
      }
      grid.enabled = false;
    } catch (eGrid) { /* 격자 없이 간다 */ }
  }

  app.endUndoGroup();

  alert('러닝 지면 리그를 세웠습니다.\n\n'
      + '카메라 : 눈높이 ' + EYE_M + 'm · 하향 ' + PITCH + '° · Zoom ' + Math.round(zoom) + 'px (세로화각 ' + VFOV + '°)\n'
      + '축약   : 1 m = ' + MPX + ' px\n'
      + '근거   : 실사 레인선 소실점 실측 · 잔차 최대 0.6%\n\n'
      + (laid.length
          ? '바닥에 눕힌 레이어 (' + laid.length + '):\n  ' + laid.join('\n  ')
          : '선택된 레이어가 없어 카메라·격자만 세웠습니다.\n'
          + '지면에 눕힐 레이어를 고르고 다시 실행하세요.')
      + '\n\n크기가 실사와 안 맞으면 스크립트 위쪽 EYE_M 만 만지세요.\n'
      + '화각을 바꾸려면 VFOV 와 PITCH 를 표대로 **같이** 바꿔야 합니다.');
})();
