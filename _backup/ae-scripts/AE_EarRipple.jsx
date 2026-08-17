/*
 * AE_EarRipple.jsx
 * 귀에서 퍼져나가는 동심원 파형. 블러 없이 깔끔한 링 도형 + 흰색 이너 쉐도우.
 *
 * 사용법:
 *   1) 메인 컴프를 열어서 타임라인 활성화
 *   2) File > Scripts > Run Script File... 로 이 파일 실행
 *   3) 생긴 'EAR_RIPPLE' 레이어를 귀 위치로 드래그
 */

(function () {

    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("메인 컴프를 열고(타임라인 클릭해서 활성화) 다시 실행하세요.");
        return;
    }

    var H = comp.height;

    // ===== 설정: 여기만 고치면 됨 =====================================
    var CFG = {
        ringCount: 4,                           // 동시에 보이는 링 개수
        minD:      Math.round(H * 0.10),        // 생겨날 때 가로 지름
        maxD:      Math.round(H * 0.62),        // 사라질 때 가로 지름
        aspect:    1.28,                        // 세로/가로 비율. 1 = 정원, 클수록 세로로 긴 타원
        strokeMin: Math.round(H * 0.0020),      // 다 퍼졌을 때 선 굵기
        strokeMax: Math.round(H * 0.0065),      // 막 생겼을 때 선 굵기
        peak:      70,                          // 링 최대 불투명도 (%)
        color:     [1, 1, 1],                   // 링 색
        loopDur:   3.6,                         // 링 하나가 퍼지는 데 걸리는 시간(초)

        // ---- 흰색 이너 쉐도우 (레이어 스타일) ----
        innerOn:      true,
        innerColor:   [1, 1, 1],
        innerOpacity: 85,                       // %
        innerSize:    Math.round(H * 0.006),    // 안쪽으로 번지는 폭
        innerChoke:   18,                       // % — 높을수록 테두리에 딱 붙는다
        innerAngle:   -90                       // 위에서 들어오는 빛
    };
    // =================================================================

    // 버전에 따라 matchName 이 안 먹을 수 있어 인덱스로 폴백한다
    function pick(parent, matchName, idx) {
        try { var p = parent.property(matchName); if (p) return p; } catch (e) {}
        return parent.property(idx);
    }

    app.beginUndoGroup("Ear Ripple");

    var lay = comp.layers.addShape();
    lay.name = "EAR_RIPPLE";
    lay.label = 11;

    var xf = lay.property("ADBE Transform Group");
    xf.property("ADBE Anchor Point").setValue([0, 0]);
    xf.property("ADBE Position").setValue([comp.width / 2, H / 2]);

    var root = lay.property("ADBE Root Vectors Group");

    /* 링 하나의 수명을 0~1 로 정규화한 t 로 전부 구동한다.
       링마다 t 를 1/N 씩 어긋나게 두면 일정한 간격으로 계속 뿜어져 나온다.
       % 연산이라 루프 이음매가 없다 — 블러나 페이드 트릭이 필요 없다. */
    function lifeExpr(idx) {
        return 'var T = ' + CFG.loopDur + ';\n' +
               'var t = ((time / T) + ' + (idx / CFG.ringCount).toFixed(4) + ') % 1;\n';
    }

    for (var i = 0; i < CFG.ringCount; i++) {
        var life = lifeExpr(i);

        var grp = root.addProperty("ADBE Vector Group");
        grp.name = "RING " + (i + 1);
        var gc = grp.property("ADBE Vectors Group");

        var el = gc.addProperty("ADBE Vector Shape - Ellipse");
        el.property("ADBE Vector Ellipse Position").setValue([0, 0]);
        // 퍼지는 속도가 처음엔 빠르고 끝에 느려져야 소리처럼 보인다
        el.property("ADBE Vector Ellipse Size").expression =
            life +
            'var e = 1 - Math.pow(1 - t, 2);\n' +
            'var d = ' + CFG.minD + ' + ' + (CFG.maxD - CFG.minD) + ' * e;\n' +
            '[d, d * ' + CFG.aspect + ']';

        var st = gc.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(
            [CFG.color[0], CFG.color[1], CFG.color[2], 1]);
        // 퍼질수록 가늘어진다
        st.property("ADBE Vector Stroke Width").expression =
            life + (CFG.strokeMax) + ' + ' + (CFG.strokeMin - CFG.strokeMax) + ' * t';

        /* 투명도는 스트로크가 아니라 그룹 Transform 에 건다.
           스트로크 Opacity 는 레이어 스타일(이너 쉐도우)과 합성 순서가 얽혀서
           변화가 안 보이는 경우가 있다. 그룹 Transform 은 그 위에서 걸리므로
           항상 결과에 반영된다.
           sin 곡선이라 생길 때도 사라질 때도 툭 튀지 않는다. */
        var gt = grp.property("ADBE Vector Transform Group");
        pick(gt, "ADBE Vector Group Opacity", 7).expression =
            life + 'Math.sin(Math.PI * t) * ' + CFG.peak;
    }

    // ---- 흰색 이너 쉐도우 ----------------------------------------------
    /* 이너 쉐도우는 이펙트가 아니라 레이어 스타일이라 스크립트 지원이
       버전마다 다르다. 실패하면 아래 알림에 표시되고, 수동으로
       Layer > Layer Styles > Inner Shadow 한 번만 켜면 된다. */
    var innerOK = false;
    if (CFG.innerOn) {
        try {
            var styles = lay.property("ADBE Layer Styles");
            var sh = styles.addProperty("ADBE Inner Shadow");
            pick(sh, "ADBE Inner Shadow-0002", 2).setValue(
                [CFG.innerColor[0], CFG.innerColor[1], CFG.innerColor[2], 1]);  // Color
            pick(sh, "ADBE Inner Shadow-0003", 3).setValue(CFG.innerOpacity);   // Opacity
            pick(sh, "ADBE Inner Shadow-0004", 4).setValue(0);                  // Use Global Light
            pick(sh, "ADBE Inner Shadow-0005", 5).setValue(CFG.innerAngle);     // Angle
            pick(sh, "ADBE Inner Shadow-0006", 6).setValue(0);                  // Distance
            pick(sh, "ADBE Inner Shadow-0007", 7).setValue(CFG.innerChoke);     // Choke
            pick(sh, "ADBE Inner Shadow-0008", 8).setValue(CFG.innerSize);      // Size
            innerOK = true;
        } catch (e) {}
    }

    app.endUndoGroup();

    alert(
        "완료.\n\n" +
        "링 " + CFG.ringCount + "개 / " + CFG.loopDur + "초 주기\n" +
        "지름 " + CFG.minD + "px -> " + CFG.maxD + "px\n" +
        "이너 쉐도우: " + (innerOK
            ? "적용됨"
            : "실패 — EAR_RIPPLE 선택 후\n  Layer > Layer Styles > Inner Shadow 를 수동으로 추가\n" +
              "  (색 흰색 / Distance 0 / Choke " + CFG.innerChoke +
              "% / Size " + CFG.innerSize + ")") + "\n\n" +
        "'EAR_RIPPLE' 레이어를 귀 위치로 드래그하세요."
    );

})();
