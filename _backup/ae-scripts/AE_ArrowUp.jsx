/*
 * AE_ArrowUp.jsx
 * 위로 흘러 올라가는 흰색 화살표(셰브런). 끊김 없이 무한 루프.
 *
 * 사용법:
 *   1) 메인 컴프를 열어서 타임라인 활성화
 *   2) File > Scripts > Run Script File... 로 이 파일 실행
 *   3) 생긴 'ARROW_UP' 레이어를 원하는 위치로 드래그
 *      (아래로 흐르게 하려면 레이어 Rotation 을 180 으로)
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
        count:     5,                           // 동시에 보이는 화살표 개수. 많을수록 흐름이 촘촘
        chevW:     Math.round(H * 0.130),        // 화살표 폭 (양 끝 사이)
        chevH:     Math.round(H * 0.052),        // 화살표 높이 (꼭짓점 깊이)
        strokeW:   Math.round(H * 0.009),        // 선 굵기
        span:      Math.round(H * 0.380),        // 아래에서 위까지 이동 거리
        gapMul:    1.00,                         // 화살표 사이 간격 배율 (1 = 균등)

        color:     [1, 1, 1],
        peak:      100,                          // 최대 불투명도 (%)
        loopDur:   3.4,                          // 한 개가 아래에서 위까지 가는 시간(초)

        scaleEnd:  92,                           // 위로 갈수록 줄어드는 정도(%). 100 = 그대로
        easing:    1.35,                         // 감속 강도. 1 = 등속, 클수록 위에서 느려진다
        fade:      0.65                          // 페이드 곡선. 낮을수록 오래 보여 흐름이 이어진다
    };
    // =================================================================

    // 버전에 따라 matchName 이 안 먹을 수 있어 인덱스로 폴백한다
    function pick(parent, matchName, idx) {
        try { var p = parent.property(matchName); if (p) return p; } catch (e) {}
        return parent.property(idx);
    }

    app.beginUndoGroup("Arrow Up");

    // 다시 실행해도 쌓이지 않게 이전 것을 지운다
    for (var i = comp.numLayers; i >= 1; i--) {
        if (comp.layer(i).name === "ARROW_UP") comp.layer(i).remove();
    }

    var lay = comp.layers.addShape();
    lay.name = "ARROW_UP";
    lay.label = 11;

    var xf = lay.property("ADBE Transform Group");
    xf.property("ADBE Anchor Point").setValue([0, 0]);
    xf.property("ADBE Position").setValue([comp.width / 2, H / 2]);

    var root = lay.property("ADBE Root Vectors Group");
    var w2 = CFG.chevW / 2, h2 = CFG.chevH / 2;

    /* 화살표 하나의 수명을 0~1 로 정규화한 t 로 전부 구동한다.
       t 를 1/N 씩 어긋나게 두면 일정한 간격으로 계속 흘러 올라간다.
       % 연산이라 루프 이음매가 없고, 양 끝에서 불투명도가 0 이라
       속도 곡선을 어떻게 주든 이어붙인 자국이 안 보인다. */
    function lifeExpr(idx) {
        return 'var T = ' + CFG.loopDur + ';\n' +
               'var t = ((time / T) + ' +
                   (idx * CFG.gapMul / CFG.count).toFixed(4) + ') % 1;\n' +
               'var e = 1 - Math.pow(1 - t, ' + CFG.easing + ');\n';
    }

    for (var k = 0; k < CFG.count; k++) {
        var life = lifeExpr(k);

        var grp = root.addProperty("ADBE Vector Group");
        grp.name = "ARROW " + (k + 1);
        var gc = grp.property("ADBE Vectors Group");

        // ^ 모양 열린 패스. 스트로크의 둥근 캡·조인이 부드러움을 만든다
        var path = gc.addProperty("ADBE Vector Shape - Group");
        var sh = new Shape();
        sh.closed      = false;
        sh.vertices    = [[-w2, h2], [0, -h2], [w2, h2]];
        sh.inTangents  = [[0, 0], [0, 0], [0, 0]];
        sh.outTangents = [[0, 0], [0, 0], [0, 0]];
        path.property("ADBE Vector Shape").setValue(sh);

        var st = gc.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(
            [CFG.color[0], CFG.color[1], CFG.color[2], 1]);
        st.property("ADBE Vector Stroke Width").setValue(CFG.strokeW);
        try {
            pick(st, "ADBE Vector Stroke Line Cap", 5).setValue(2);   // Round Cap
            pick(st, "ADBE Vector Stroke Line Join", 6).setValue(2);  // Round Join
        } catch (e) {}

        var gt = grp.property("ADBE Vector Transform Group");

        // 아래(+) 에서 위(-) 로
        pick(gt, "ADBE Vector Position", 2).expression =
            life + '[0, ' + (CFG.span / 2).toFixed(1) + ' - ' + CFG.span + ' * e]';

        // 위로 갈수록 살짝 작아져서 멀어지는 느낌
        pick(gt, "ADBE Vector Scale", 3).expression =
            life + 'var s = 100 + ' + (CFG.scaleEnd - 100) + ' * e;\n[s, s]';

        /* sin 곡선이라 생길 때도 사라질 때도 툭 튀지 않는다.
           지수를 1 보다 낮추면 곡선이 평평해져서 화살표가 더 오래 보이고,
           앞뒤가 겹치는 구간이 길어져 흐름이 끊기지 않는다. */
        pick(gt, "ADBE Vector Group Opacity", 7).expression =
            life + 'Math.pow(Math.sin(Math.PI * t), ' + CFG.fade + ') * ' + CFG.peak;
    }

    app.endUndoGroup();

    alert(
        "완료.\n\n" +
        "화살표 " + CFG.count + "개 / " + CFG.loopDur + "초 주기\n" +
        "이동 거리 " + CFG.span + "px / 폭 " + CFG.chevW + "px\n\n" +
        "'ARROW_UP' 레이어를 원하는 위치로 드래그하세요.\n" +
        "아래로 흐르게 하려면 레이어 Rotation 을 180 으로."
    );

})();
