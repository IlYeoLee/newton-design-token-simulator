/*
 * AE_SubtitleCard_Live.jsx
 * 전부 프리컴프 하나에 들어있고, 메인 컴프에는 레이어 1개만 생긴다.
 * 컨테이너는 컷당 한 번만 올라오고, 대사는 Source Text 키프레임으로 갈아끼운다.
 *
 *   메인 컴프
 *    └ SUB 01                 ← 이 레이어 하나. 등장 애니메이션도 여기
 *        └ SUB_TEMPLATE
 *            CARD             ← 폭 자동 맞춤
 *            AVATAR / AVATAR_RING / WAVE
 *            EN / KR          ← Source Text 키프레임으로 대사 전환
 *
 * 사용법:
 *   1) 메인 컴프를 열어서 타임라인 활성화
 *   2) File > Scripts > Run Script File... 로 이 파일 실행
 *   3) 대사 추가: SUB_TEMPLATE 안으로 들어가 EN/KR 의 Source Text 에 키프레임
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
        enText:    "Follow through.",
        krText:    "팔로우스루 유지.",

        enFont:    "Supreme-Medium",            // Supreme-Regular/Medium/Bold/Extrabold ...
        krFont:    "Freesentation-6SemiBold",   // Freesentation-4Regular/7Bold ...

        /* 웹 GIF 용이라 표시 크기가 고정이고 플레이어 UI 제약도 없다.
           카드 배경이 대비를 만들어 주므로 영상 자막 권장치보다 작아도 된다. */
        enSize:    Math.round(H * 0.026),
        krSize:    Math.round(H * 0.019),
        krOn:      false,                       // false = 영문만. 카드 높이도 알아서 줄어든다
        krOpacity: 80,

        // 자간 (1/1000 em). 양수면 넓어지고 음수면 좁아진다
        enTracking: -20,
        krTracking: -20,

        // ---- 아바타 ----
        avatarPath:  "C:\\Users\\user\\Downloads\\농구프로필.png",
        avatarFocus: [0.492, 0.285],            // 원의 중심이 될 지점 (0~1). 내리면 상반신
        avatarCrop:  0.31,                      // 원 안에 들어갈 이미지 가로 비율
        avatarR:     Math.round(H * 0.016),     // 아바타 반지름(px)
        avatarGap:   Math.round(H * 0.014),     // 아바타 ~ 파형 사이

        ringOn:      false,
        ringGap:     Math.round(H * 0.0035),    // 사진 가장자리 ~ 링 사이 여백
        ringWidth:   Math.round(H * 0.0018),
        ringColor:   [1, 1, 1],
        ringOpacity: 65,                        // %

        // ---- 카드 ----
        cardColor:   [0, 0, 0],                 // #000000
        cardOpacity: 30,                        // % — 낮출수록 배경이 비친다
        padX:        Math.round(H * 0.055),     // 카드 좌우 여백
        padY:        Math.round(H * 0.030),     // 카드 위아래 여백
        anchor:      "bottom",                  // "top" = 상단 / "bottom" = 하단
        edgePct:     0.045,                     // 화면 가장자리에서 띄울 비율 (덩어리 바깥쪽 기준)
        minTextW:    Math.round(H * 0.16),      // 자막이 짧아도 유지할 최소 텍스트 폭
        // 카드 폭이 바뀔 때의 스프링. 애플 모션 같은 쫀득한 탄성
        springFreq:  17,                        // 진동 속도. 높을수록 촘촘하게 떤다
        springDecay: 9,                         // 감쇠. 낮을수록 오래 튕긴다 (6 = 찰짐, 14 = 얌전)
        openFrom:    0.55,                      // 첫 등장 때 카드가 시작하는 폭 비율

        gapRowCard:  Math.round(H * 0.007),     // 아바타·파형 ~ 카드 위쪽
        gapEnKr:     Math.round(H * 0.012),     // 영문 ~ 한글

        textColor:   [1, 1, 1],

        // ---- 등장/퇴장 (컷당 한 번, 전체가 한 덩어리로) ----
        dur:       6,                           // 컷 길이(초). 타임라인에서 늘리면 됨
        fadeIn:    0.45,
        fadeOut:   0.35,
        riseDist:  Math.round(H * 0.022),       // 아래에서 올라오는 거리(px)
        overshoot: 1.1,                         // 쫀득함. 0 = 없음, 1.7 = 표준

        /* ---- 자막 등장 (대사마다) ----
           글자별로 하나씩 나타내면 다 뜰 때까지 기다리느라 읽을 시간이 줄어든다.
           줄 통째로 올라오게 하면 즉시 다 읽히므로 체감 노출 시간이 길어진다. */
        inDur:     0.45,                        // 줄이 올라오며 나타나는 시간
        krDelay:   0.08,                        // 한글 줄이 영문보다 늦게 시작
        txtRise:   Math.round(H * 0.013),       // 줄이 아래에서 올라오는 거리(px)

        // ---- 미니 파형 ----
        waveStyle: "bar",                       // "bar" = 캡슐 막대 / "dot" = 원형 점
        barCount:  7,
        loopDur:   3.2,                         // 루프 주기(초). 짧을수록 활발하다
        waveAmp:   1.4,                         // 진폭 배율
        idleFloor: 0.08
    };
    // =================================================================

    var AVR   = CFG.avatarR;
    var isDot = (CFG.waveStyle === "dot");

    var BAR = { w: H * 0.0028, gap: 2.2, maxH: H * 0.018, minH: H * 0.0028 };
    var DOT = { size: H * 0.0034, gap: 2.1, stack: 1.5, max: 4 };

    var waveW = isDot
        ? ((CFG.barCount - 1) * DOT.size * DOT.gap + DOT.size)
        : ((CFG.barCount - 1) * BAR.w * BAR.gap + BAR.w);
    var waveH = isDot
        ? ((DOT.max - 1) * DOT.size * DOT.stack + DOT.size)
        : BAR.maxH;

    var row1H = Math.max((AVR + CFG.ringGap) * 2, waveH);
    var enH   = CFG.enSize * 0.72;              // 대문자 높이 (베이스라인 위)
    var krH   = CFG.krSize * 0.72;

    // 카드 안에는 텍스트만. 아바타와 파형은 카드 바깥 위쪽에 뜬다.
    var CH = Math.round(CFG.padY * 2 + enH +
                        (CFG.krOn ? CFG.gapEnKr + krH : 0));

    /* edgePct 는 덩어리(아바타·파형 + 카드) 바깥쪽 가장자리 기준이다.
       카드 기준으로 잡으면 상단 배치에서 위쪽 아바타가 화면 밖으로 밀린다. */
    var cx      = comp.width / 2;
    var blockH  = row1H + CFG.gapRowCard + CH;
    var cardTop, row1CY;

    if (CFG.anchor === "top") {
        var blockTop = Math.round(H * CFG.edgePct);
        row1CY  = Math.round(blockTop + row1H / 2);
        cardTop = Math.round(blockTop + row1H + CFG.gapRowCard);
    } else {
        cardTop = Math.round(H * (1 - CFG.edgePct) - CH);
        row1CY  = Math.round(cardTop - CFG.gapRowCard - row1H / 2);
    }
    var cardCY = Math.round(cardTop + CH / 2);

    var enY = Math.round(cardTop + CFG.padY + enH);
    var krY = Math.round(enY + CFG.gapEnKr + krH);
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

    // 버전에 따라 matchName 이 안 먹을 수 있어 인덱스로 폴백한다
    function pick(parent, matchName, idx) {
        try { var p = parent.property(matchName); if (p) return p; } catch (e) {}
        return parent.property(idx);
    }

    app.beginUndoGroup("Subtitle Card (Live)");

    /* 이전 실행 결과를 지운다. 단 '지금 열어둔 컴프' 안의 것만 건드린다.
       프로젝트 전체를 훑으면 다른 컷용으로 복제해둔 SUB_TEMPLATE 2, 3 ...
       까지 날아간다. 여기서 지우는 템플릿은 이 컴프가 실제로 쓰던 것뿐이다. */
    var OLD = ["SUB 01", "CONTAINER", "CARD", "WAVE", "AVATAR", "AVATAR_RING"];
    var doomed = [];
    for (var d = comp.numLayers; d >= 1; d--) {
        var lay = comp.layer(d), nm = lay.name, hit = (nm.indexOf("SUBTXT") === 0);
        for (var o = 0; o < OLD.length && !hit; o++) if (nm === OLD[o]) hit = true;
        try {
            if (lay.source instanceof CompItem &&
                lay.source.name.indexOf("SUB_TEMPLATE") === 0) {
                hit = true;
                doomed.push(lay.source);
            }
        } catch (e) {}
        if (hit) lay.remove();
    }
    // 다른 컴프에서도 쓰이는 템플릿이면 남겨둔다
    for (var q = 0; q < doomed.length; q++) {
        try { if (doomed[q].usedIn.length === 0) doomed[q].remove(); } catch (e) {}
    }

    var enFont = resolveFont(CFG.enFont);
    var krFont = resolveFont(CFG.krFont);

    var avatarSrc = null;
    try {
        var f = new File(CFG.avatarPath);
        if (f.exists) avatarSrc = app.project.importFile(new ImportOptions(f));
    } catch (e) {}

    /* 컴프 이름을 붙여둬야 프로젝트 패널에서 어느 컷 것인지 구분된다.
       Restyle 스크립트는 "SUB_TEMPLATE" 접두어로 찾으므로 이름이 길어져도 된다. */
    var tpl = app.project.items.addComp(
        "SUB_TEMPLATE — " + comp.name, comp.width, comp.height,
        comp.pixelAspect, CFG.dur, comp.frameRate
    );

    /* 대사가 바뀌는 시각의 기준점 = 컴포지션 마커.
       카드 폭 계산과 글자 등장 애니메이션이 둘 다 이 시각을 쓴다.
       마커를 찍을 때마다 등장이 다시 재생되고 카드도 다시 맞춰진다.

       Source Text 를 읽지 않는 게 핵심이다. 텍스트 애니메이터 안에서
       같은 레이어의 sourceText 를 읽으면 AE 가 순환 참조로 보고
       표현식을 꺼버려서, 글자가 통째로 사라진다. */
    /* 지금 유효한 Source Text 홀드 키프레임의 시각 t0 을 구한다.
       대사를 바꿀 때마다 t0 이 바뀌므로 등장 애니메이션이 다시 재생되고
       카드 폭도 그 대사에 맞춰 다시 계산된다. 마커를 따로 찍을 필요가 없다.

       주의: 이 조각은 트랜스폼(Position/Opacity)에만 쓴다.
       텍스트 애니메이터의 Range Selector 안에서 같은 레이어의 sourceText 를
       읽으면 AE 가 순환 참조로 보고 표현식을 꺼버려 글자가 통째로 사라진다. */
    function T0(ref) {
        return 'var t0 = 0;\n' +
               'try {\n' +
               '  var st = ' + ref + '.text.sourceText;\n' +
               '  if (st.numKeys > 0) {\n' +
               '    var kk = st.nearestKey(time);\n' +
               '    if (kk.time > time && kk.index > 1) kk = st.key(kk.index - 1);\n' +
               '    if (kk.time <= time) t0 = kk.time;\n' +
               '  }\n' +
               '} catch (_e1) {}\n';
    }

    // ---- 카드 --------------------------------------------------------
    var card = tpl.layers.addShape();
    card.name = "CARD";
    var cxf = card.property("ADBE Transform Group");
    cxf.property("ADBE Anchor Point").setValue([0, 0]);
    cxf.property("ADBE Position").setValue([cx, cardCY]);

    /* 같은 컴프 안의 EN / KR 을 직접 읽는다 — 프리컴프 밖에서는
       sourceRectAtTime 이 글자 폭이 아니라 컴프 크기를 돌려주므로
       카드와 텍스트는 반드시 같은 컴프 안에 있어야 한다. */
    /* 애니메이터가 없으니 글자 폭이 등장 중에 변하지 않는다.
       마커 직후에 재도 정확하므로 짧은 대사도 안전하다. */
    var SAMPLE = "0.08";
    var cgc = card.property("ADBE Root Vectors Group")
                  .addProperty("ADBE Vector Group")
                  .property("ADBE Vectors Group");
    var crect = cgc.addProperty("ADBE Vector Shape - Rect");
    crect.property("ADBE Vector Rect Roundness").setValue(CH / 2);   // 완전한 알약
    /* 감쇠 스프링. 이전 마커의 폭에서 현재 마커의 폭으로 가되,
       목표를 지나쳤다가 몇 번 튕기며 잦아든다.
         w(e) = cur + (prev - cur) * exp(-d*e) * (cos(f*e) + (d/f)*sin(f*e))
       sin 항이 있어야 e=0 에서 속도가 0 이라 출발이 툭 튀지 않는다.
       smooth() 는 이동평균이라 부드럽기만 하고 탄성이 안 생긴다. */
    /* 표현식이 죽어도 카드는 남아야 한다. 정적 값을 먼저 넣어두고,
       스프링 계산은 통째로 try 안에서만 하고 실패하면 기본 폭으로 떨어진다. */
    crect.property("ADBE Vector Rect Size")
         .setValue([CFG.minTextW + CFG.padX * 2, CH]);

    crect.property("ADBE Vector Rect Size").expression =
        'var S = ' + SAMPLE + ', CH = ' + CH + ';\n' +
        '// 같은 컴프의 EN / KR 글자 폭을 직접 잰다\n' +
        'function wAt(t) {\n' +
        '  var a = 0;\n' +
        '  try { a = Math.max(a, thisComp.layer("EN").sourceRectAtTime(t, false).width); } catch (x1) {}\n' +
        '  try { a = Math.max(a, thisComp.layer("KR").sourceRectAtTime(t, false).width); } catch (x2) {}\n' +
        '  return Math.max(a, ' + CFG.minTextW + ') + ' + (CFG.padX * 2) + ';\n' +
        '}\n' +
        'var w = wAt(time);\n' +           // 스프링이 실패해도 이 폭은 항상 유효하다
        'try {\n' +
        '  var t0 = 0, tp = 0, first = true;\n' +
        '  var st = thisComp.layer("EN").text.sourceText;\n' +
        '  if (st.numKeys > 0) {\n' +
        '    var kk = st.nearestKey(time);\n' +
        '    var i = (kk.time > time && kk.index > 1) ? kk.index - 1 : kk.index;\n' +
        '    t0 = st.key(i).time;\n' +
        '    if (i > 1) { tp = st.key(i - 1).time; first = false; }\n' +
        '  }\n' +
        '  var cur  = wAt(t0 + S);\n' +
        '  // 첫 마커엔 직전 폭이 없다 -> 좁은 폭에서 열리며 튕기게 한다\n' +
        '  var prev = first ? cur * ' + CFG.openFrom + ' : wAt(tp + S);\n' +
        '  var el = Math.max(time - t0, 0);\n' +
        '  var f = ' + CFG.springFreq + ', d = ' + CFG.springDecay + ';\n' +
        '  // 감쇠 스프링. sin 항이 있어야 시작 속도가 0 이라 출발이 안 튄다\n' +
        '  var g = Math.exp(-d * el) * (Math.cos(f * el) + (d / f) * Math.sin(f * el));\n' +
        '  var sp = cur + (prev - cur) * g;\n' +
        '  if (isFinite(sp) && sp > 0) w = sp;\n' +
        '} catch (_err) {}\n' +
        '[w, CH]';

    var cfill = cgc.addProperty("ADBE Vector Graphic - Fill");
    cfill.property("ADBE Vector Fill Color").setValue(
        [CFG.cardColor[0], CFG.cardColor[1], CFG.cardColor[2], 1]);
    try { cfill.property("ADBE Vector Fill Opacity").setValue(CFG.cardOpacity); } catch (e) {}

    // ---- 아바타 ------------------------------------------------------
    /* 마스크는 트랜스폼 이전(레이어 좌표)에 적용되므로
       마스크 반지름을 스케일로 나눠줘야 화면에서 원하는 크기가 나온다.
       앵커포인트를 원 중심에 두면 포지션만으로 정확히 프레이밍된다. */
    if (avatarSrc) {
        var av = tpl.layers.add(avatarSrc);
        av.name = "AVATAR";

        var iw = avatarSrc.width;
        var fxp = CFG.avatarFocus[0] * iw, fyp = CFG.avatarFocus[1] * avatarSrc.height;
        var sc  = (AVR * 2) / (CFG.avatarCrop * iw);

        var axf = av.property("ADBE Transform Group");
        axf.property("ADBE Anchor Point").setValue([fxp, fyp]);
        axf.property("ADBE Scale").setValue([sc * 100, sc * 100]);
        axf.property("ADBE Position").setValue([avatarCX, row1CY]);

        var mr = AVR / sc, kp = 0.5523, msh = new Shape();
        msh.closed      = true;
        msh.vertices    = [[fxp, fyp - mr], [fxp + mr, fyp],
                           [fxp, fyp + mr], [fxp - mr, fyp]];
        msh.inTangents  = [[-mr * kp, 0], [0, -mr * kp], [mr * kp, 0], [0, mr * kp]];
        msh.outTangents = [[mr * kp, 0], [0, mr * kp], [-mr * kp, 0], [0, -mr * kp]];

        var mk = av.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        mk.name = "CIRCLE";
        mk.property("ADBE Mask Shape").setValue(msh);
        mk.property("ADBE Mask Feather").setValue([1, 1]);
    }

    // ---- 아바타 원형 아웃라인 -------------------------------------------
    /* 사진에 직접 스트로크를 못 준다 — 마스크 경계에는 선이 안 생긴다.
       그래서 같은 중심에 원 하나를 따로 그린다. */
    if (CFG.ringOn && avatarSrc) {
        var ring = tpl.layers.addShape();
        ring.name = "AVATAR_RING";
        var rxf = ring.property("ADBE Transform Group");
        rxf.property("ADBE Anchor Point").setValue([0, 0]);
        rxf.property("ADBE Position").setValue([avatarCX, row1CY]);
        rxf.property("ADBE Opacity").setValue(CFG.ringOpacity);

        var rgc = ring.property("ADBE Root Vectors Group")
                      .addProperty("ADBE Vector Group")
                      .property("ADBE Vectors Group");
        var rd = (AVR + CFG.ringGap) * 2;
        var rel = rgc.addProperty("ADBE Vector Shape - Ellipse");
        rel.property("ADBE Vector Ellipse Size").setValue([rd, rd]);
        rel.property("ADBE Vector Ellipse Position").setValue([0, 0]);

        var rst = rgc.addProperty("ADBE Vector Graphic - Stroke");
        rst.property("ADBE Vector Stroke Color").setValue(
            [CFG.ringColor[0], CFG.ringColor[1], CFG.ringColor[2], 1]);
        rst.property("ADBE Vector Stroke Width").setValue(CFG.ringWidth);
    }

    // ---- 미니 파형 -----------------------------------------------------
    /* 하모닉 합은 셋이 동시에 정렬되는 일이 드물어서 그냥 두면 값이
       0.3~0.7 안에서만 논다 = 소극적으로 보인다. waveAmp 로 진폭을 키운다.
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
    /* EN/KR 을 한 레이어에 섞으면 글자별 스타일이 편집할 때마다 깨지므로
       레이어를 분리한다. 대사가 늘어나도 레이어는 이 둘로 고정이고,
       줄 전환은 Source Text 홀드 키프레임이 담당한다. */
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

        /* 텍스트 애니메이터를 안 쓴다 — 줄 통째로 트랜스폼만 움직인다.
           글자별 애니메이터는 다 나타날 때까지 못 읽어서 체감 시간을 깎아먹고,
           애니메이터 안에서 마커/텍스트를 참조하면 순환 참조 위험도 있다.
           마커를 찍을 때마다 아래에서 다시 올라온다. */
        var xf = lay.property("ADBE Transform Group");

        xf.property("ADBE Position").expression =
            T0("thisLayer") +
            'var d = ' + delay + ';\n' +
            'var k = ease(time, t0 + d, t0 + d + ' + CFG.inDur + ', 1, 0);\n' +
            '[' + cx + ', ' + y + ' + ' + CFG.txtRise + ' * k]';

        // 투명도는 위치보다 살짝 먼저 도달해야 흐릿하게 끌리지 않는다
        xf.property("ADBE Opacity").expression =
            T0("thisLayer") +
            'var d = ' + delay + ';\n' +
            opacity + ' * ease(time, t0 + d, t0 + d + ' +
            (CFG.inDur * 0.75).toFixed(2) + ', 0, 1)';
        return lay;
    }

    // 한글 -> 영문 순서로 만들어야 영문이 타임라인 위로 올라옴
    if (CFG.krOn) makeLine(CFG.krText, krFont, CFG.krSize, krY,
                           CFG.krOpacity, CFG.krDelay, "KR", CFG.krTracking);
    makeLine(CFG.enText, enFont, CFG.enSize, enY,
             100,           0,           "EN", CFG.enTracking);

    // ---- 메인 컴프: 레이어 한 개 ---------------------------------------
    /* 등장 애니메이션을 프리컴프 레이어 자체에 걸었기 때문에
       카드 · 아바타 · 파형 · 자막이 전부 한 덩어리로 같이 올라온다.
       따로 애니메이션을 주면 미세하게 어긋나서 깨져 보인다. */
    var inst = comp.layers.add(tpl);
    inst.name = "SUB 01";
    inst.label = 9;
    inst.outPoint = CFG.dur;

    var ifx = inst.property("ADBE Effect Parade");
    function ctrl(name, val) {
        var sl = ifx.addProperty("ADBE Slider Control");
        sl.name = name;
        sl.property(1).setValue(val);
    }
    ctrl("FADE IN",  CFG.fadeIn);
    ctrl("FADE OUT", CFG.fadeOut);
    ctrl("RISE",     CFG.riseDist);

    var ixf = inst.property("ADBE Transform Group");

    // inPoint/outPoint 기준이라 레이어 길이를 끌면 페이드가 알아서 따라온다
    ixf.property("ADBE Opacity").expression =
        'var fi = Math.max(effect("FADE IN")(1),  0.01);\n' +
        'var fo = Math.max(effect("FADE OUT")(1), 0.01);\n' +
        'var a = ease(time, inPoint, inPoint + fi, 0, 100);\n' +
        'var b = ease(time, outPoint - fo, outPoint, 100, 0);\n' +
        'Math.min(a, b)';

    /* easeOutBack — 목표 지점을 살짝 지나쳤다가 되돌아와 안착한다.
       이 미세한 오버슈트가 '쫀득한' 감각을 만든다. */
    ixf.property("ADBE Position").expression =
        'var fi = Math.max(effect("FADE IN")(1), 0.01) * 1.5;\n' +
        'var r  = effect("RISE")(1);\n' +
        'var t  = Math.min(Math.max((time - inPoint) / fi, 0), 1);\n' +
        'var c1 = ' + CFG.overshoot + ', c3 = c1 + 1;\n' +
        'var p  = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);\n' +
        '[value[0], value[1] + r * (1 - p)]';

    app.endUndoGroup();

    alert(
        "완료. 메인 컴프에는 'SUB 01' 레이어 1개뿐입니다.\n\n" +
        "영문: " + enFont + " / " + CFG.enSize + "px\n" +
        "한글: " + krFont + " / " + CFG.krSize + "px\n" +
        (missing.length ? "!! 못 찾은 폰트: " + missing.join(", ") + "\n" : "") +
        "아바타: " + (avatarSrc ? avatarSrc.name : "불러오기 실패 — CFG.avatarPath 확인") + "\n" +
        "카드 높이: " + CH + "px (내용에서 자동 계산)\n\n" +
        "대사 추가 ('SUB 01' 더블클릭해서 SUB_TEMPLATE 안에서):\n" +
        "  1) EN / KR 의 Source Text 스톱워치 켜기 (최초 1회)\n" +
        "  2) 다음 대사 시점으로 이동 -> 화면에서 글자 더블클릭 -> 타이핑\n\n" +
        "마커는 필요 없습니다. Source Text 키프레임만 찍으면\n" +
        "등장 애니메이션과 카드 폭이 그 시점 기준으로 다시 계산됩니다.\n" +
        "(EN 과 KR 의 키프레임 시각을 맞춰 주세요)\n\n" +
        "컷 길이는 'SUB 01' 레이어를 타임라인에서 늘리면 됩니다."
    );

})();
