/*
 * AE_SubtitleWave_Template.jsx
 * 자막(EN/KR) + 파형이 한 덩어리로 아래에서 떠오르는 자막 세트
 * 파형은 오디오 비의존 — 불규칙하지만 완전히 루프되는 표현식으로 구동
 *
 * 사용법:
 *   1) 메인 컴프를 열어서 타임라인 활성화
 *   2) File > Scripts > Run Script File... 로 이 파일 실행
 *   3) 복제는 'SUB 01' 레이어 하나만 Ctrl+D
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
        enText:    "NEWTON SIMULATOR",
        krText:    "뉴턴 시뮬레이터",

        enFont:    "Supreme-Bold",              // Supreme-Regular/Medium/Extrabold ...
        krFont:    "Freesentation-6SemiBold",   // Freesentation-4Regular/7Bold ...

        enSize:    Math.round(H * 0.028),
        krSize:    Math.round(H * 0.021),
        krOpacity: 80,

        bottomPct: 0.11,                        // 화면 하단에서 띄울 비율
        gapMul:    1.15,                        // EN/KR 줄 간격 (enSize 배수)

        // ---- 그룹 전체 등장 ----
        dur:       4,                           // 자막 1세트 길이(초)
        riseDist:  Math.round(H * 0.022),
        riseDur:   0.55,
        fadeOut:   0.30,

        // ---- 자막 등장 ----
        revealBy:  "char",                      // "char" 글자별 / "word" 단어별 / "line" 줄 통째로
        inDur:     0.90,                        // 전부 나타나는 데 걸리는 시간(초). 길수록 잔잔
        krDelay:   0.14,                        // 한글 줄이 영문보다 늦게 시작
        riseMul:   0.22,                        // 등장할 때 밀려 올라오는 거리 (글자 크기 배수)

        /* ---- 그림자 2겹 ----
           넓은 것 = 글자 주위에 넓게 퍼지는 그늘. 배경 분리를 담당.
           좁은 것 = 글자 윤곽을 또렷하게. 넓은 것만 쓰면 흐물거린다. */
        shdWideOpacity:  68,                            // %
        shdWideSoft:     Math.round(H * 0.040),
        shdTightOpacity: 62,                            // %
        shdTightSoft:    Math.round(H * 0.005),
        shdTightDist:    1,
        shdAngle:        180,                           // 180 = 정아래

        // ---- 파형 ----
        waveStyle: "dot",                       // "bar" = 캡슐 막대 / "dot" = 원형 점
        barCount:  7,                           // 두 스타일 공통 (세로줄 개수)

        // bar 스타일
        barW:      Math.round(H * 0.0028),
        barGapMul: 2.1,
        barMaxH:   Math.round(H * 0.016),
        barMinH:   Math.round(H * 0.0028),

        // dot 스타일
        dotSize:     Math.round(H * 0.0042),    // 점 지름
        dotGapMul:   2.1,                       // 점 가로 간격 (dotSize 배수)
        dotStackMul: 1.55,                      // 점 세로 간격 (dotSize 배수)
        dotMax:      5,                         // 가운데 줄의 최대 점 개수

        waveGap:   Math.round(H * 0.058),       // 파형과 영문줄 사이 간격
        loopDur:   4.5,                         // 루프 주기(초). 길수록 느긋하고 부드럽다
        idleFloor: 0.10                         // 잠잠할 때도 남는 최소 움직임
    };
    // =================================================================

    var missing = [];
    function resolveFont(wanted) {
        try {
            var all = app.fonts.allFonts, i;
            for (i = 0; i < all.length; i++) {
                if (all[i].postScriptName === wanted) return wanted;
            }
            var key = wanted.toLowerCase().replace(/[-\s_]/g, "");
            for (i = 0; i < all.length; i++) {
                var ps = all[i].postScriptName.toLowerCase().replace(/[-\s_]/g, "");
                if (ps === key || ps.indexOf(key) === 0) return all[i].postScriptName;
            }
        } catch (e) { return wanted; }
        missing.push(wanted);
        return wanted;
    }

    /* 레이어 스타일은 스크립트 제어가 불안정해서 이펙트로 처리.
       한 겹으론 안 된다 — 넓게만 주면 흐물거리고 좁게만 주면 배경과 안 떨어진다. */
    function addShadow(lay) {
        var fx = lay.property("ADBE Effect Parade");
        function drop(name, opacityPct, dist, soft) {
            try {
                var ds = fx.addProperty("ADBE Drop Shadow");
                ds.name = name;
                ds.property(1).setValue([0, 0, 0, 1]);                       // Shadow Color
                ds.property(2).setValue(Math.round(opacityPct / 100 * 255)); // Opacity (0~255)
                ds.property(3).setValue(CFG.shdAngle);                       // Direction
                ds.property(4).setValue(dist);                               // Distance
                ds.property(5).setValue(soft);                               // Softness
            } catch (e) {}
        }
        drop("SHADOW wide",  CFG.shdWideOpacity,  0, CFG.shdWideSoft);
        drop("SHADOW tight", CFG.shdTightOpacity, CFG.shdTightDist, CFG.shdTightSoft);
    }

    function ease(prop, keyIdx) {
        try {
            prop.setTemporalEaseAtKey(keyIdx,
                [new KeyframeEase(0, 75)], [new KeyframeEase(0, 75)]);
        } catch (e) {}
    }

    // 버전에 따라 matchName 이 안 먹을 수 있어 인덱스로 폴백한다
    function pick(parent, matchName, idx) {
        try { var p = parent.property(matchName); if (p) return p; } catch (e) {}
        return parent.property(idx);
    }

    app.beginUndoGroup("Subtitle Group + Waveform");

    var enFont = resolveFont(CFG.enFont);
    var krFont = resolveFont(CFG.krFont);

    // ---- 템플릿 컴프: 자막 + 파형 + 그룹 널이 전부 여기 들어간다 --------
    var tpl = app.project.items.addComp(
        "SUB_TEMPLATE", comp.width, comp.height,
        comp.pixelAspect, CFG.dur, comp.frameRate
    );

    var krY = Math.round(tpl.height * (1 - CFG.bottomPct));
    var enY = Math.round(krY - CFG.enSize * CFG.gapMul);
    var cx  = tpl.width / 2, cy = tpl.height / 2;

    // 부모 널은 위치/스케일만 물려주고 투명도는 안 물려준다.
    // parent 를 이름이 아니라 관계로 참조해야 복제해도 안 깨진다.
    var opExpr = 'try { value * parent.transform.opacity / 100 } catch (e) { value }';

    /* 텍스트 레이어 1개 = 폰트/크기 고정 + 글자별 등장 애니메이션.
       EN/KR 을 한 레이어에 섞으면 Essential Properties 로 텍스트를
       덮어쓰는 순간 글자별 스타일이 리셋되므로 반드시 레이어를 분리한다. */
    function makeLine(txt, font, size, y, opacity, delay, label) {
        var lay = tpl.layers.addText(txt);
        lay.name = label;

        var src = lay.property("ADBE Text Properties").property("ADBE Text Document");
        var doc = src.value;
        doc.resetCharStyle();
        doc.font          = font;
        doc.fontSize      = size;
        doc.fillColor     = [1, 1, 1];
        doc.applyFill     = true;
        doc.applyStroke   = false;
        doc.justification = ParagraphJustification.CENTER_JUSTIFY;
        src.setValue(doc);

        var xf = lay.property("ADBE Transform Group");
        xf.property("ADBE Position").setValue([cx, y]);
        xf.property("ADBE Opacity").setValue(opacity);

        /* Range Selector Offset 0 -> 100 = 왼쪽부터 순서대로 등장.
           블러는 뺐다 — 페이드+살짝 밀림만 남겨야 '촤라락' 하지 않는다. */
        var anim = lay.property("ADBE Text Properties")
                      .property("ADBE Text Animators")
                      .addProperty("ADBE Text Animator");
        anim.name = "IN";

        var props = anim.property("ADBE Text Animator Properties");
        props.addProperty("ADBE Text Opacity").setValue(0);
        props.addProperty("ADBE Text Position 3D").setValue([0, size * CFG.riseMul, 0]);

        var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");

        /* Based On: 1 글자 / 2 공백제외 글자 / 3 단어 / 4 줄.
           단어 단위로 끊으면 이동 횟수가 확 줄어서 훨씬 차분해진다.
           Ease High/Low 를 100 으로 올려야 각 단위가 툭 튀지 않고 녹아든다. */
        var UNIT = { "char": 1, "word": 3, "line": 4 };
        try {
            var adv = sel.property("ADBE Text Range Advanced");
            pick(adv, "ADBE Text Range Type2",   2).setValue(UNIT[CFG.revealBy] || 3);
            pick(adv, "ADBE Text Range Max Ease", 7).setValue(100);   // Ease High
            pick(adv, "ADBE Text Range Min Ease", 8).setValue(100);   // Ease Low
        } catch (e) {}

        var off = sel.property("ADBE Text Percent Offset");
        off.setValueAtTime(delay, 0);
        off.setValueAtTime(delay + CFG.inDur, 100);
        ease(off, 1); ease(off, 2);

        addShadow(lay);
        return lay;
    }

    // ---- 파형 -----------------------------------------------------------
    /* 두 스타일 다 같은 오실레이터를 쓴다.
       루프 주기 T 의 정수배(1,2,3) 하모닉만 더하므로 T 마다 정확히
       제자리로 돌아오고, 줄마다 위상이 달라 규칙성이 눈에 안 띈다.
       bar = 둥근 캡슐이 늘었다 줄었다 / dot = 원형 점이 쌓였다 줄었다 */
    function oscExpr(ph) {
        return 'var P = ' + ph.toFixed(4) + ';\n' +
               'var w = Math.PI * 2 / ' + CFG.loopDur + ';\n' +
               'var v = 0.5\n' +
               '      + 0.32 * Math.sin(w * 1 * time + P * 1.7)\n' +
               '      + 0.14 * Math.sin(w * 2 * time + P * 2.9 + 1.1)\n' +
               '      + 0.06 * Math.sin(w * 3 * time + P * 4.1 + 2.3);\n' +
               'v = Math.max(' + CFG.idleFloor + ', Math.min(1, v));\n';
    }

    var isDot = (CFG.waveStyle === "dot");
    var wave  = tpl.layers.addShape();
    wave.name = isDot ? "WAVE dots" : "WAVE bars";

    var wxf = wave.property("ADBE Transform Group");
    wxf.property("ADBE Anchor Point").setValue([0, 0]);
    wxf.property("ADBE Position").setValue([cx, enY - CFG.waveGap]);

    var root = wave.property("ADBE Root Vectors Group");
    var step = isDot ? CFG.dotSize * CFG.dotGapMul : CFG.barW * CFG.barGapMul;
    var mid  = (CFG.barCount - 1) / 2;

    for (var s = 0; s < CFG.barCount; s++) {
        // 가운데가 높고 바깥이 낮은 종 모양 프로파일
        var weight = 0.32 + 0.68 * Math.sin(Math.PI * (s + 0.5) / CFG.barCount);
        // 황금각 위상 — 줄끼리 같이 움직이지 않게 고르게 흩어진다
        var osc = oscExpr(s * 2.399963);

        var grp = root.addProperty("ADBE Vector Group");
        grp.name = (isDot ? "DOT " : "BAR ") + (s + 1);
        var gc = grp.property("ADBE Vectors Group");

        if (isDot) {
            // 점 하나 + 리피터. 복사 개수를 진폭으로 구동하면 점이 쌓인다
            var el = gc.addProperty("ADBE Vector Shape - Ellipse");
            el.property("ADBE Vector Ellipse Size").setValue([CFG.dotSize, CFG.dotSize]);
            el.property("ADBE Vector Ellipse Position").setValue([(s - mid) * step, 0]);

            gc.addProperty("ADBE Vector Graphic - Fill")
              .property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);

            var maxN  = Math.max(1, Math.round(CFG.dotMax * weight));
            var nExpr = osc + 'var n = Math.round(1 + ' + (maxN - 1) + ' * v);\n';

            var rep = gc.addProperty("ADBE Vector Filter - Repeater");
            pick(rep, "ADBE Vector Repeater Copies", 1).expression = nExpr + 'n';
            // Offset 을 -(n-1)/2 로 두면 점 기둥이 가운데 기준으로 위아래 대칭이 된다
            pick(rep, "ADBE Vector Repeater Offset", 2).expression = nExpr + '-(n - 1) / 2';
            pick(pick(rep, "ADBE Vector Repeater Transform", 4),
                 "ADBE Vector Repeater Position", 2)
                .setValue([0, -CFG.dotSize * CFG.dotStackMul]);
        } else {
            var rect = gc.addProperty("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Position").setValue([(s - mid) * step, 0]);
            rect.property("ADBE Vector Rect Roundness").setValue(CFG.barW / 2);
            rect.property("ADBE Vector Rect Size").expression =
                osc + '[' + CFG.barW + ', ' + CFG.barMinH + ' + ' +
                (CFG.barMaxH * weight - CFG.barMinH).toFixed(2) + ' * v]';

            gc.addProperty("ADBE Vector Graphic - Fill")
              .property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);
        }
    }
    addShadow(wave);

    // 한글 -> 영문 순서로 만들어야 영문이 타임라인 위로 올라옴
    var krLay = makeLine(CFG.krText, krFont, CFG.krSize, krY, CFG.krOpacity, CFG.krDelay, "KR");
    var enLay = makeLine(CFG.enText, enFont, CFG.enSize, enY, 100,           0,           "EN");

    // ---- 그룹 부모 널: 이 하나에 전부 묶인다 ---------------------------
    var grpNull = tpl.layers.addNull(CFG.dur);
    grpNull.name = "GROUP";
    grpNull.moveToBeginning();
    grpNull.enabled = false;
    grpNull.label = 9;

    var gxf  = grpNull.property("ADBE Transform Group");
    var gPos = gxf.property("ADBE Position");
    var gOp  = gxf.property("ADBE Opacity");

    // 아래에서 위로 떠오르며 페이드인 -> 유지 -> 페이드아웃
    gPos.setValueAtTime(0, [cx, cy + CFG.riseDist]);
    gPos.setValueAtTime(CFG.riseDur, [cx, cy]);
    ease(gPos, 1); ease(gPos, 2);

    gOp.setValueAtTime(0, 0);
    gOp.setValueAtTime(CFG.riseDur * 0.8, 100);
    gOp.setValueAtTime(CFG.dur - CFG.fadeOut, 100);
    gOp.setValueAtTime(CFG.dur - 0.03, 0);
    for (var g = 1; g <= 4; g++) ease(gOp, g);

    var kids = [enLay, krLay, wave];
    for (var c = 0; c < kids.length; c++) {
        kids[c].parent = grpNull;
        kids[c].property("ADBE Transform Group").property("ADBE Opacity").expression = opExpr;
    }

    // ---- 두 줄 다 Essential Properties 로 노출 ------------------------
    //  복제한 레이어마다 EN/KR 텍스트를 따로 바꿀 수 있게 하는 핵심 부분
    var egpOK = true;
    var enSrc = enLay.property("ADBE Text Properties").property("ADBE Text Document");
    var krSrc = krLay.property("ADBE Text Properties").property("ADBE Text Document");
    try {
        tpl.motionGraphicsTemplateName = "SUB_TEMPLATE";
        enSrc.addToMotionGraphicsTemplateAs(tpl, "영문 자막");
        krSrc.addToMotionGraphicsTemplateAs(tpl, "한글 자막");
    } catch (e) {
        try {
            enSrc.addToMotionGraphicsTemplate(tpl);
            krSrc.addToMotionGraphicsTemplate(tpl);
        } catch (e2) { egpOK = false; }
    }

    // ---- 메인 컴프에 배치: 레이어 한 개 ---------------------------------
    var inst = comp.layers.add(tpl);
    inst.name = "SUB 01";

    app.endUndoGroup();

    alert(
        "완료.\n\n" +
        "영문: " + enFont + " / " + CFG.enSize + "px\n" +
        "한글: " + krFont + " / " + CFG.krSize + "px\n" +
        (missing.length ? "!! 못 찾은 폰트: " + missing.join(", ") + "\n" : "") +
        "파형: " + CFG.waveStyle + " 스타일 / " + CFG.loopDur + "초 루프\n" +
        "Essential Properties: " + (egpOK ? "적용됨" : "실패") + "\n\n" +
        "복제: 'SUB 01' 하나만 Ctrl+D → 시간 이동 →\n" +
        "레이어 펼치기 > Essential Properties 에서 영문/한글 텍스트만 수정"
    );

})();
