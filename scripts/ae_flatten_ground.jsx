// 선택한 레이어를 '바닥에 누운 것처럼' 납작하게 누른다 — 2D 로만. 3D 도 카메라도 안 쓴다.
//
//   쓰는 법: 눌릴 레이어(A2 판 등)를 **선택**하고 실행. 끝.
//            Corner Pin 이펙트가 붙고 네 귀퉁이가 사다리꼴로 잡힌다.
//            마음에 안 들면 아래 PITCH·NEAR 만 바꿔 다시 실행(이펙트를 갱신한다).
//
//   각도 근거: 실사 트랙 레인선 소실점 실측(measure_track_vp.mjs · 잔차 0.6%)
//              하향각 31.61° · 세로화각 60° · 눈높이 1.55m(추정, 크기만 정함)
//
//   ★ 한글판 AE 대응: 이펙트는 표시이름이 아니라 matchName('ADBE Corner Pin')으로 붙이고,
//     귀퉁이 속성은 이름 대신 **인덱스 1~4**로 잡는다(좌상·우상·좌하·우하 순서는 고정이다).
(function () {
  // ── 만지는 값 ────────────────────────────────────────────
  var PITCH = 48;      // 하향각(도). **클수록 정면**에 가깝다. 실측 소실점값은 31.61 인데
                       //   유저가 "각이 너무 죽었다"고 해서 올렸다(08-07). 실사와 정확히
                       //   맞추려면 31.61 로 되돌린다 — 지금은 보기 좋은 쪽으로 튜닝한 값이다.
  var NEAR  = 0.60;    // 판 앞모서리까지 거리(m). **작게 두는 게 정면에 가깝다**(아래 표)
  var EYE   = 1.55;    // 눈높이(m)
  var MPP   = 0.000687 * 1.25;   // 대지 1px = 0.687mm · --pad 1.25 반영
  //
  //   실측표 — 칸 = 세로압축% / 위폭%  (둘 다 100% 면 원본 그대로 = 완전 정면)
  //
  //            NEAR=0.6      1.2       2.0       3.0
  //     31.61°  41%/ 35%   36%/ 43%   31%/ 51%   27%/ 58%
  //        40°  42%/ 40%   38%/ 47%   33%/ 54%   28%/ 60%
  //     ★  48°  45%/ 45%   40%/ 50%   35%/ 56%   31%/ 62%
  //        55°  48%/ 50%   43%/ 54%   38%/ 60%   33%/ 65%
  //        62°  52%/ 55%      —          —          —
  //
  //   ★ NEAR 를 키우면 수렴(위폭)은 완만해지지만 세로는 **더** 눌린다 — 둘이 반대로 간다.
  //     '더 정면으로'는 PITCH 를 올리는 쪽이 맞다. NEAR 는 0.6 에 두는 게 낫다.
  // ────────────────────────────────────────────────────────

  var comp = app.project.activeItem;
  if (!(comp && comp instanceof CompItem)) { alert('컴프를 먼저 여세요.'); return; }
  var sel = comp.selectedLayers.slice();
  if (!sel.length) { alert('납작하게 누를 레이어를 선택하고 다시 실행하세요.'); return; }

  var rad = function (d) { return d * Math.PI / 180; };
  var th = rad(PITCH);

  app.beginUndoGroup('바닥에 눕히기');
  var done = [], note = '';

  for (var i = 0; i < sel.length; i++) {
    var L = sel[i];
    if (L instanceof CameraLayer || L instanceof LightLayer) continue;

    var W = L.source ? L.source.width : comp.width;
    var H = L.source ? L.source.height : comp.height;
    var DM = H * MPP, FAR = NEAR + DM;               // 판의 실제 깊이(m)

    // 핀홀 투영 — 깊이 d 의 지면점이 광축에서 얼마나 벗어나 보이나
    var proj = function (d) {
      var phi = Math.atan(EYE / d), a = phi - th, r = Math.sqrt(EYE * EYE + d * d);
      return { y: Math.tan(a), w: 1 / (r * Math.cos(a)) };
    };
    var n = proj(NEAR), f2 = proj(FAR);

    var shrink = f2.w / n.w;                          // 먼 쪽이 좁아지는 비율
    var squash = Math.abs(f2.y - n.y) / (n.w * DM);   // 세로 압축 비율(대략)
    if (!isFinite(shrink) || shrink <= 0 || shrink > 1) shrink = 0.35;
    if (!isFinite(squash) || squash <= 0 || squash > 1) squash = 0.41;

    var topY = H * (1 - squash);                      // 위 모서리가 내려온 자리
    var halfTop = W * shrink / 2, cx = W / 2;

    // 기존 이펙트가 있으면 재사용(값만 갱신) — 여러 번 실행해도 안 쌓인다
    var fx = null;
    try { fx = L.property('Effects').property('바닥 눕히기'); } catch (e) {}
    if (!fx) {
      try { fx = L.property('Effects').addProperty('ADBE Corner Pin'); }
      catch (e1) { try { fx = L.property('Effects').addProperty('Corner Pin'); } catch (e2) { fx = null; } }
      if (fx) { try { fx.name = '바닥 눕히기'; } catch (e) {} }
    }
    if (!fx) { note = '\n\n★ Corner Pin 이펙트를 못 붙였습니다.'; continue; }

    // 인덱스 1~4 = 좌상 · 우상 · 좌하 · 우하 (언어 무관)
    fx.property(1).setValue([cx - halfTop, topY]);    // 좌상 (먼 쪽)
    fx.property(2).setValue([cx + halfTop, topY]);    // 우상
    fx.property(3).setValue([0, H]);                  // 좌하 (가까운 쪽 — 폭 그대로)
    fx.property(4).setValue([W, H]);                  // 우하

    done.push(L.name + '  세로 ' + Math.round(squash * 100) + '% · 위폭 ' + Math.round(shrink * 100) + '%');
  }

  app.endUndoGroup();

  alert((done.length ? '눕혔습니다 (' + done.length + ')\n\n  ' + done.join('\n  ') : '적용된 레이어가 없습니다.')
      + '\n\n하향각 ' + PITCH + '° (실사 레인선 소실점 실측)'
      + '\n\n더 정면으로 → PITCH 를 올린다 (55 / 62)'
      + '\n더 납작하게 → PITCH 를 내린다 (40 / 31.61=실측)'
      + '\n다시 실행하면 같은 이펙트의 값만 갱신된다.' + note);
})();
