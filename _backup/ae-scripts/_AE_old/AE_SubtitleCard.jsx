/*
 * AE_SubtitleWave_CARD.jsx
 * 세로 스택 자막 카드
 *   1행: [원형 아바타] [미니 파형]   (가운데 정렬)
 *   2행: 영문 자막
 *   3행: 한글 자막
 * 카드 폭은 자막 길이에 맞춰 자동으로 늘어난다 (MOGRT 방식)
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
        enText:    "Keep your chest up.",
        krText:    "가슴을 세우세요.",

        enFont:    "Supreme-Medium",            // Supreme-Regular/Medium/Bold/Extrabold ...
        krFont:    "Freesentation-6SemiBold",   // Freesentation-4Regular/7Bold ...

        enSize:    Math.round(H * 0.022),
        krSize:    Math.round(H * 0.015),
        krOpacity: 80,

        // 자간 (1/1000 em). 양수면 넓어지고 음수면 좁아진다
        enTracking: 15,
        krTracking: -10,

        // ---- 1행: 아바타 + 파형 ----
        avatarPath:  "C:\\Users\\user\\Downloads\\션.png",
        avatarFocus: [0.590, 0.405],            // 원의 중심이 될 지점 (0~1). 내리면 상반신
        avatarCrop:  0.78,                      // 원 안에 들어갈 이미지 가로 비율. 키우면 더 멀리서
        avatarR:     Math.round(H * 0.016),     // 아바타 반지름(px)
        avatarGap:   Math.round(H * 0.012),     // 아바타 ~ 파형 사이

        // ---- 카드 ----
        cardColor:   [0, 0, 0],                 // #000000
        cardOpacity: 40,                        // % — 낮출수록 배경이 비친다
        cardRound:   Math.round(H * 0.022),     // 모서리 둥글기
        padX:        Math.round(H * 0.055),     // 카드 좌우 여백
        padY:        Math.round(H * 0.022),     // 카드 위아래 여백
        bottomPct:   0.055,                     // 화면 하단에서 띄울 비율. 낮출수록 아래로
        minTextW:    Math.round(H * 0.16),      // 자막이 짧아도 유지할 최소 텍스트 폭

        // ---- 행간 ----
        gapRowEn:    Math.round(H * 0.018),     // 1행 ~ 영문
        gapEnKr:     Math.round(H * 0.012),     // 영문 ~ 한글

        textColor:   [1, 1, 1],                 // 글자 + 파형 색

        /* ---- 등장/퇴장 타이밍 ----
           키프레임이 아니라 슬라이더로 들어간다. 스크립트를 다시 안 돌려도
           Effect Controls 에서 바로 조정되고, 레이어 길이를 타임라인에서
           끌면 페이드아웃이 알아서 끝에 붙는다. */
        dur:      4,                            // 자막 1세트 기본 길이(초)
        fadeIn:   0.40,                         // 나타나는 시간
        fadeOut:  0.35,                         // 사라지는 시간
        riseDist: Math.round(H * 0.022),        // 아래에서 올라오는 거리(px)
        inDur:    0.80,                         // 글자가 다 나타나는 시간. 길수록 잔잔
        krDelay:  0.14,                         // 한글 줄이 영문보다 늦게 시작
        riseMul:  0.40,                         // 글자가 밀려 올라오는 거리 (글자 크기 배수)
        overshoot: 1.1,                         // 쫀득함. 0 = 없음, 1.7 = 표준, 2.5 = 과함

        // ---- 미니 파형 ----
        waveStyle: "bar",                       // "bar" = 캡슐 막대 / "dot" = 원형 점
        barCount:  7,                           // 두 스타일 공통 (세로줄 개수)
        loopDur:   3.2,                         // 루프 주기(초). 짧을수록 활발하다
        waveAmp:   1.4,                         // 진폭 배율. 키우면 위아래로 크게 움직인다
        idleFloor: 0.08,                        // 잠잠할 때도 남는 최소 움직임

        // 파형 등장
        waveInDelay: 0.10,                      // 등장 시작 시각(초)
        waveInDur:   0.55,                      // 등장에 걸리는 시간(초)
        waveInScale: 55                         // 시작 크기(%). 여기서 100% 로 커진다
    };
    // =================================================================

    var AVR   = CFG.avatarR;
    var isDot = (CFG.waveStyle === "dot");

    var BAR = { w: H * 0.0028, gap: 2.2, maxH: H * 0.018, minH: H * 0.0028 };
    var DOT = { size: H * 0.0034, gap: 2.1, stack: 1.5, max: 4 };

    /* ---- 세로 스택 레이아웃 --------------------------------------------
       1행(아바타+파형) / 영문 / 한글 을 쌓고 전체 높이에서 카드 높이를 낸다.
       y 를 손으로 찍으면 폰트 크기를 바꿀 때마다 어긋나므로 전부 파생시킨다. */
    var waveW = isDot
        ? ((CFG.barCount - 1) * DOT.size * DOT.gap + DOT.size)
        : ((CFG.barCount - 1) * BAR.w * BAR.gap + BAR.w);
    var waveH = isDot
        ? ((DOT.max - 1) * DOT.size * DOT.stack + DOT.size)
        : BAR.maxH;

    var row1H = Math.max(AVR * 2, waveH);       // 1행 높이
    var enH   = CFG.enSize * 0.72;              // 대문자 높이 (베이스라인 위)
    var krH   = CFG.krSize * 0.72;

    var CH = Math.round(CFG.padY * 2 + row1H + CFG.gapRowEn + enH + CFG.gapEnKr + krH);

    var cx     = comp.width / 2;
    var cardCY = Math.round(H * (1 - CFG.bottomPct) - CH / 2);
    var top    = cardCY - CH / 2 + CFG.padY;

    var row1CY = Math.round(top + row1H / 2);                       // 1행 세로 중심
    var enY    = Math.round(top + row1H + CFG.gapRowEn + enH);      // 영문 베이스라인
    var krY    = Math.round(enY + CFG.gapEnKr + krH);               // 한글 베이스라인

    // 1행은 [아바타][간격][파형] 을 통째로 가운데 정렬
    var row1W    = AVR * 2 + CFG.avatarGap + waveW;
    var avatarCX = Math.round(cx - row1W / 2 + AVR);
    var waveCX   = Math.round(cx + row1W / 2 - waveW / 2);

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

    app.beginUndoGroup("Subtitle Card");

    var enFont = resolveFont(CFG.enFont);
    var krFont = resolveFont(CFG.krFont);

    var avatarSrc = null;
    try {
        var f = new File(CFG.avatarPath);
        if (f.exists) avatarSrc = app.project.importFile(new ImportOptions(f));
    } catch (e) {}

    var tpl = app.project.items.addComp(
        "SUB_TEMPLATE", comp.width, comp.height,
        comp.pixelAspect, CFG.dur, comp.frameRate
    );

    /* ---- 카드 폭 ------------------------------------------------------
       sourceRectAtTime 으로 실제 글자 폭을 재서 카드가 자막 길이를 따라간다.
       세로 스택이라 아바타·파형·텍스트가 전부 가운데 정렬이므로
       가로 위치는 전부 고정값이고, 표현식이 필요한 건 카드 폭 하나뿐이다.
       샘플 시각을 등장 애니메이션이 끝난 뒤로 잡아야 카드가 덜덜 떨지 않는다. */
    var SAMPLE = (CFG.krDelay + CFG.inDur + 0.2).toFixed(2);
    var W_EXPR =
        'var S = ' + SAMPLE + ';\n' +
        'var e = 0, k = 0;\n' +
        'try { e = thisComp.layer("EN").sourceRectAtTime(S, false).width; } catch (err) {}\n' +
        'try { k = thisComp.layer("KR").sourceRectAtTime(S, false).width; } catch (err) {}\n' +
        'var CW = Math.max(e, k, ' + CFG.minTextW + ') + ' + (CFG.padX * 2) + ';\n';

    // ---- 카드 --------------------------------------------------------
    var card = tpl.layers.addShape();
    card.name = "CARD";
    var cxf = card.property("ADBE Transform Group");
    cxf.property("ADBE Anchor Point").setValue([0, 0]);
    cxf.property("ADBE Position").setValue([cx, cardCY]);

    var cgc = card.property("ADBE Root Vectors Group")
                  .addProperty("ADBE Vector Group")
                  .property("ADBE Vectors Group");
    var crect = cgc.addProperty("ADBE Vector Shape - Rect");
    crect.property("ADBE Vector Rect Roundness").setValue(CFG.cardRound);
    crect.property("ADBE Vector Rect Size").expression = W_EXPR + '[CW, ' + CH + ']';

    var cfill = cgc.addProperty("ADBE Vector Graphic - Fill");
    cfill.property("ADBE Vector Fill Color").setValue(
        [CFG.cardColor[0], CFG.cardColor[1], CFG.cardColor[2], 1]);
    try { cfill.property("ADBE Vector Fill Opacity").setValue(CFG.cardOpacity); } catch (e) {}

    // ---- 아바타: 원형 마스크 --------------------------------------------
    /* 마스크는 트랜스폼 이전(레이어 좌표)에 적용되므로
       마스크 반지름을 스케일로 나눠줘야 화면에서 원하는 크기가 나온다.
       앵커포인트를 원 중심에 두면 포지션만으로 정확히 프레이밍된다. */
    if (avatarSrc) {
        var av = tpl.layers.add(avatarSrc);
        av.name = "AVATAR";

        var iw = avatarSrc.width, ih = avatarSrc.height;
        var fxp = CFG.avatarFocus[0] * iw, fyp = CFG.avatarFocus[1] * ih;
        var sc  = (AVR * 2) / (CFG.avatarCrop * iw);          // 배율 (1 = 원본)

        var axf = av.property("ADBE Transform Group");
        axf.property("ADBE Anchor Point").setValue([fxp, fyp]);
        axf.property("ADBE Scale").setValue([sc * 100, sc * 100]);
        axf.property("ADBE Position").setValue([avatarCX, row1CY]);

        var mr = AVR / sc;                                    // 레이어 좌표계 반지름
        var kp = 0.5523, msh = new Shape();
        msh.closed      = true;
        msh.vertices    = [[fxp, fyp - mr], [fxp + mr, fyp],
                           [fxp, fyp + mr], [fxp - mr, fyp]];
        msh.inTangents  = [[-mr * kp, 0], [0, -mr * kp], [mr * kp, 0], [0, mr * kp]];
        msh.outTangents = [[mr * kp, 0], [0, mr * kp], [-mr * kp, 0], [0, -mr * kp]];

        var mk = av.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        mk.name = "CIRCLE";
        mk.property("ADBE Mask Shape").setValue(msh);
        mk.property("ADBE Mask Feather").setValue([1, 1]);    // 계단 방지용 1px
    }

    // ---- 미니 파형 -----------------------------------------------------
    /* 하모닉 합은 셋이 동시에 정렬되는 일이 드물어서 그냥 두면 값이
       0.3~0.7 안에서만 논다 = 소극적으로 보인다. waveAmp 로 진폭을 키워
       위아래로 클리핑까지 밀어붙여야 확실히 움직이는 게 보인다.
       루프 주기 T 의 정수배(1,2,3) 하모닉만 쓰므로 T 마다 정확히 반복된다. */
    var A = CFG.waveAmp;
    function oscExpr(ph) {
        return 'var P = ' + ph.toFixed(4) + ';\n' +
               'var w = Math.PI * 2 / ' + CFG.loopDur + ';\n' +
               'var v = 0.5\n' +
               '      + ' + (0.32 * A).toFixed(3) + ' * Math.sin(w * 1 * time + P * 1.7)\n' +
               '      + ' + (0.14 * A).toFixed(3) + ' * Math.sin(w * 2 * time + P * 2.9 + 1.1)\n' +
               '      + ' + (0.06 * A).toFixed(3) + ' * Math.sin(w * 3 * time + P * 4.1 + 2.3);\n' +
               'v = Math.max(' + CFG.idleFloor + ', Math.min(1, v));\n';
    }

    var wave = tpl.layers.addShape();
    wave.name = "WAVE";
    var wxf = wave.property("ADBE Transform Group");
    wxf.property("ADBE Anchor Point").setValue([0, 0]);
    wxf.property("ADBE Position").setValue([waveCX, row1CY]);

    /* 파형 등장: 투명하고 작게 시작해서 제 크기로.
       막대는 레이어 원점(0,0) 기준으로 좌우 대칭 배치라 앵커가 곧 중심이고,
       따라서 스케일이 가운데에서 균등하게 퍼진다.
       표현식이 아니라 키프레임으로 넣는다 — 타임라인에서 눈으로 확인되고
       마음에 안 들면 키프레임만 끌어서 바로 고칠 수 있다.
       가운데 106% 키프레임이 오버슈트 = 글자와 같은 쫀득한 감각. */
    var wD0 = CFG.waveInDelay, wDD = CFG.waveInDur;

    var wOp = wxf.property("ADBE Opacity");
    wOp.setValueAtTime(wD0, 0);
    wOp.setValueAtTime(wD0 + wDD * 0.8, 100);
    ease(wOp, 1); ease(wOp, 2);

    var wSc = wxf.property("ADBE Scale");
    var over = Math.round(100 + (100 - CFG.waveInScale) * CFG.overshoot * 0.12);
    wSc.setValueAtTime(wD0,             [CFG.waveInScale, CFG.waveInScale]);
    wSc.setValueAtTime(wD0 + wDD * 0.78, [over, over]);
    wSc.setValueAtTime(wD0 + wDD,        [100, 100]);
    ease(wSc, 1); ease(wSc, 2); ease(wSc, 3);

    var wroot = wave.property("ADBE Root Vectors Group");
    var step  = isDot ? DOT.size * DOT.gap : BAR.w * BAR.gap;
    var mid   = (CFG.barCount - 1) / 2;

    for (var s = 0; s < CFG.barCount; s++) {
        // 가운데가 높고 바깥이 낮은 종 모양 프로파일
        var weight = 0.32 + 0.68 * Math.sin(Math.PI * (s + 0.5) / CFG.barCount);
        // 황금각 위상 — 줄끼리 같이 움직이지 않게 고르게 흩어진다
        var osc = oscExpr(s * 2.399963);

        var grp = wroot.addProperty("ADBE Vector Group");
        grp.name = (isDot ? "DOT " : "BAR ") + (s + 1);
        var gc = grp.property("ADBE Vectors Group");

        if (isDot) {
            var el = gc.addProperty("ADBE Vector Shape - Ellipse");
            el.property("ADBE Vector Ellipse Size").setValue([DOT.size, DOT.size]);
            el.property("ADBE Vector Ellipse Position").setValue([(s - mid) * step, 0]);
            gc.addProperty("ADBE Vector Graphic - Fill")
              .property("ADBE Vector Fill Color").setValue(
                  [CFG.textColor[0], CFG.textColor[1], CFG.textColor[2], 1]);

            // 점 하나 + 리피터. 복사 개수를 진폭으로 구동하면 점이 쌓인다
            var maxN  = Math.max(1, Math.round(DOT.max * weight));
            var nExpr = osc + 'var n = Math.round(1 + ' + (maxN - 1) + ' * v);\n';

            var rep = gc.addProperty("ADBE Vector Filter - Repeater");
            pick(rep, "ADBE Vector Repeater Copies", 1).expression = nExpr + 'n';
            // Offset 을 -(n-1)/2 로 두면 점 기둥이 위아래 대칭으로 자란다
            pick(rep, "ADBE Vector Repeater Offset", 2).expression = nExpr + '-(n - 1) / 2';
            pick(pick(rep, "ADBE Vector Repeater Transform", 4),
                 "ADBE Vector Repeater Position", 2)
                .setValue([0, -DOT.size * DOT.stack]);
        } else {
            var rect = gc.addProperty("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Position").setValue([(s - mid) * step, 0]);
            rect.property("ADBE Vector Rect Roundness").setValue(BAR.w / 2);
            rect.property("ADBE Vector Rect Size").expression =
                osc + '[' + BAR.w.toFixed(2) + ', ' + BAR.minH.toFixed(2) + ' + ' +
                (BAR.maxH * weight - BAR.minH).toFixed(2) + ' * v]';
            gc.addProperty("ADBE Vector Graphic - Fill")
              .property("ADBE Vector Fill Color").setValue(
                  [CFG.textColor[0], CFG.textColor[1], CFG.textColor[2], 1]);
        }
    }

    // ---- 자막 두 줄 -----------------------------------------------------
    /* EN/KR 을 한 레이어에 섞으면 Essential Properties 로 텍스트를
       덮어쓰는 순간 글자별 스타일이 리셋되므로 반드시 레이어를 분리한다. */
    function makeLine(txt, font, size, y, opacity, delay, label, tracking) {
        var lay = tpl.layers.addText(txt);
        lay.name = label;

        var src = lay.property("ADBE Text Properties").property("ADBE Text Document");
        var doc = src.value;
        doc.resetCharStyle();
        doc.font          = font;
        doc.fontSize      = size;
        doc.fillColor     = CFG.textColor;
        try { doc.tracking = tracking; } catch (e) {}
        doc.applyFill     = true;
        doc.applyStroke   = false;
        doc.justification = ParagraphJustification.CENTER_JUSTIFY;
        src.setValue(doc);

        var xf = lay.property("ADBE Transform Group");
        xf.property("ADBE Position").setValue([cx, y]);
        xf.property("ADBE Opacity").setValue(opacity);

        /* Range Selector Offset 0 -> 100 = 왼쪽부터 순서대로 등장.
           블러는 뺐다 — 그게 '촤라락' 하고 산만해 보이던 주범이다. */
        var anim = lay.property("ADBE Text Properties")
                      .property("ADBE Text Animators")
                      .addProperty("ADBE Text Animator");
        anim.name = "IN";
        var props = anim.property("ADBE Text Animator Properties");
        props.addProperty("ADBE Text Opacity").setValue(0);
        props.addProperty("ADBE Text Position 3D").setValue([0, size * CFG.riseMul, 0]);
        props.addProperty("ADBE Text Scale 3D").setValue([88, 88, 100]);   // 살짝 작게 -> 제자리

        var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");

        /* Ease High/Low 를 100 으로 올리면 글자마다 가감속이 붙고
           앞뒤 글자가 겹쳐서 넘어간다. 이게 쫀득한 느낌의 핵심. */
        try {
            var adv = sel.property("ADBE Text Range Advanced");
            pick(adv, "ADBE Text Range Max Ease", 7).setValue(100);   // Ease High
            pick(adv, "ADBE Text Range Min Ease", 8).setValue(100);   // Ease Low
        } catch (e) {}

        var off = sel.property("ADBE Text Percent Offset");
        off.setValueAtTime(delay, 0);
        off.setValueAtTime(delay + CFG.inDur, 100);
        ease(off, 1); ease(off, 2);
        return lay;
    }

    // 한글 -> 영문 순서로 만들어야 영문이 타임라인 위로 올라옴
    var krLay = makeLine(CFG.krText, krFont, CFG.krSize, krY,
                         CFG.krOpacity, CFG.krDelay, "KR", CFG.krTracking);
    var enLay = makeLine(CFG.enText, enFont, CFG.enSize, enY,
                         100,           0,           "EN", CFG.enTracking);

    // ---- 두 줄 다 Essential Properties 로 노출 --------------------------
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

    // ---- 메인 컴프: 레이어 한 개 ---------------------------------------
    var inst = comp.layers.add(tpl);
    inst.name = "SUB 01";
    inst.label = 9;

    /* 페이드 타이밍은 슬라이더 3개로만 조정한다.
       inPoint/outPoint 를 기준으로 삼았기 때문에 타임라인에서 레이어를
       늘리거나 줄이면 페이드아웃이 자동으로 끝에 다시 붙는다.
       키프레임이 없으니 스크립트를 다시 돌릴 일도 없다. */
    var ifx = inst.property("ADBE Effect Parade");
    function slider(name, val) {
        var sl = ifx.addProperty("ADBE Slider Control");
        sl.name = name;
        sl.property(1).setValue(val);
        return sl;
    }
    slider("FADE IN",  CFG.fadeIn);
    slider("FADE OUT", CFG.fadeOut);
    slider("RISE",     CFG.riseDist);

    var ixf = inst.property("ADBE Transform Group");

    ixf.property("ADBE Opacity").expression =
        'var fi = Math.max(effect("FADE IN")(1),  0.01);\n' +
        'var fo = Math.max(effect("FADE OUT")(1), 0.01);\n' +
        'var a = ease(time, inPoint, inPoint + fi, 0, 100);\n' +
        'var b = ease(time, outPoint - fo, outPoint, 100, 0);\n' +
        'Math.min(a, b)';

    /* 떠오름은 페이드인보다 느리게 끝나야 툭 멈추지 않는다.
       easeOutBack — 목표 지점을 살짝 지나쳤다가 되돌아와 안착한다.
       이 미세한 오버슈트가 '쫀득한' 감각을 만든다. */
    ixf.property("ADBE Position").expression =
        'var fi = Math.max(effect("FADE IN")(1), 0.01) * 1.5;\n' +
        'var r  = effect("RISE")(1);\n' +
        'var t  = Math.min(Math.max((time - inPoint) / fi, 0), 1);\n' +
        'var c1 = ' + CFG.overshoot + ', c3 = c1 + 1;\n' +
        'var p  = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);\n' +
        '[value[0], value[1] + r * (1 - p)]';

    inst.outPoint = CFG.dur;

    app.endUndoGroup();

    alert(
        "완료.\n\n" +
        "영문: " + enFont + " / " + CFG.enSize + "px\n" +
        "한글: " + krFont + " / " + CFG.krSize + "px\n" +
        (missing.length ? "!! 못 찾은 폰트: " + missing.join(", ") + "\n" : "") +
        "아바타: " + (avatarSrc ? avatarSrc.name : "불러오기 실패 — CFG.avatarPath 확인") + "\n" +
        "카드 높이: " + CH + "px (내용에서 자동 계산)\n" +
        "Essential Properties: " + (egpOK ? "적용됨" : "실패") + "\n\n" +
        "복제: 'SUB 01' 하나만 Ctrl+D → 시간 이동 →\n" +
        "레이어 펼치기 > Essential Properties 에서 영문/한글 텍스트만 수정"
    );

})();
