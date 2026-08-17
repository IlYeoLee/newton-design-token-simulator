/*
 * AE_SubtitleCard_Restyle.jsx
 * 프로젝트 안의 모든 SUB_TEMPLATE* 컴프를 순회하며 레이아웃만 갈아끼운다.
 * 대사(Source Text 키프레임)와 타이밍은 건드리지 않는다.
 *
 * 쓰는 법:
 *   1) 아래 CFG 를 원하는 레이아웃으로 수정
 *      (AE_SubtitleCard_Live.jsx 의 CFG 와 같은 값을 쓰면 된다)
 *   2) File > Scripts > Run Script File... 로 실행
 *   -> SUB_TEMPLATE, SUB_TEMPLATE 2, 3 ... 전부에 한 번에 적용된다
 *
 * 동작 방식:
 *   카드 / 아바타 / 링 / 파형은 지우고 새로 만든다 (레이아웃이라 버릴 게 없다).
 *   EN / KR 텍스트 레이어는 지우지 않고 폰트·크기·색·위치만 바꾼다.
 *   Source Text 에 키프레임이 있으면 키마다 스타일을 덮어써서 대사를 보존한다.
 */

(function () {

    // ===== 설정: AE_SubtitleCard_Live.jsx 의 CFG 와 맞추면 된다 ==========
    // (크기는 각 컴프의 높이 기준으로 그때그때 계산된다)
    var CFG = {
        enFont:    "Supreme-Medium",
        krFont:    "Freesentation-6SemiBold",

        enSizePct: 0.026,                       // 화면 높이 대비
        krSizePct: 0.019,
        krOn:      false,                       // false = 영문만
        krOpacity: 80,
        krText:    "가슴을 세우세요.",           // KR 을 새로 만들 때만 쓰인다

        enTracking: -20,                        // 자간 (1/1000 em)
        krTracking: -20,

        // ---- 아바타 ----
        /* 사진을 바꾸려면 여기에 새 경로를 넣는다. 빈 문자열이면
           기존 레이어의 사진을 그대로 재활용한다(레이아웃만 갱신). */
        avatarPath:  "C:\\Users\\user\\Desktop\\복싱얼굴.PNG",
        avatarFocus: [0.490, 0.455],
        avatarCrop:  0.72,
        avatarRPct:  0.016,
        avatarGapPct: 0.014,

        ringOn:      false,
        ringGapPct:  0.0035,
        ringWPct:    0.0018,
        ringColor:   [1, 1, 1],
        ringOpacity: 65,

        // ---- 카드 ----
        cardColor:   [0, 0, 0],
        cardOpacity: 30,
        padXPct:     0.055,
        padYPct:     0.030,
        anchor:      "bottom",                  // "top" / "bottom"
        edgePct:     0.045,
        minTextWPct: 0.16,
        gapRowCardPct: 0.007,
        gapEnKrPct:  0.012,

        textColor:   [1, 1, 1],

        springFreq:  17,
        springDecay: 9,
        openFrom:    0.55,

        // ---- 자막 등장 ----
        inDur:       0.45,
        krDelay:     0.08,
        txtRisePct:  0.013,

        // ---- 미니 파형 ----
        waveStyle: "bar",                       // "bar" / "dot"
        barCount:  7,
        loopDur:   3.2,
        waveAmp:   1.4,
        idleFloor: 0.08,

        // ---- 메인 컴프 인스턴스 ----
        refreshInstances: true,                 // SUB 레이어의 등장 표현식도 갱신
        overshoot: 1.1,
        fadeIn:    0.40,                        // 슬라이더가 없는 레이어에만 새로 넣는 초기값
        fadeOut:   0.35,
        riseDistPct: 0.022
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

    // 버전에 따라 matchName 이 안 먹을 수 있어 인덱스로 폴백한다
    function pick(parent, matchName, idx) {
        try { var p = parent.property(matchName); if (p) return p; } catch (e) {}
        return parent.property(idx);
    }

    // 이미 있으면 값을 건드리지 않는다 — 컷마다 다르게 맞춰뒀을 수 있다
    function ensureSlider(layer, name, val) {
        var fx = layer.property("ADBE Effect Parade");
        for (var i = 1; i <= fx.numProperties; i++) {
            if (fx.property(i).name === name) return;
        }
        var sl = fx.addProperty("ADBE Slider Control");
        sl.name = name;
        sl.property(1).setValue(val);
    }

    function findLayer(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) return comp.layer(i);
        }
        return null;
    }

    // ---- 템플릿 컴프 하나를 다시 꾸민다 ---------------------------------
    function restyle(tpl, enFont, krFont) {
        var H = tpl.height, cx = tpl.width / 2;

        var enSize = Math.round(H * CFG.enSizePct);
        var krSize = Math.round(H * CFG.krSizePct);
        var AVR    = Math.round(H * CFG.avatarRPct);
        var avGap  = Math.round(H * CFG.avatarGapPct);
        var ringGap = Math.round(H * CFG.ringGapPct);
        var padX   = Math.round(H * CFG.padXPct);
        var padY   = Math.round(H * CFG.padYPct);
        var minTW  = Math.round(H * CFG.minTextWPct);
        var gapRC  = Math.round(H * CFG.gapRowCardPct);
        var gapEK  = Math.round(H * CFG.gapEnKrPct);
        var txtRise = Math.round(H * CFG.txtRisePct);

        var isDot = (CFG.waveStyle === "dot");
        var BAR = { w: H * 0.0028, gap: 2.2, maxH: H * 0.018, minH: H * 0.0028 };
        var DOT = { size: H * 0.0034, gap: 2.1, stack: 1.5, max: 4 };

        var waveW = isDot
            ? ((CFG.barCount - 1) * DOT.size * DOT.gap + DOT.size)
            : ((CFG.barCount - 1) * BAR.w * BAR.gap + BAR.w);
        var waveH = isDot
            ? ((DOT.max - 1) * DOT.size * DOT.stack + DOT.size)
            : BAR.maxH;

        var row1H = Math.max((AVR + (CFG.ringOn ? ringGap : 0)) * 2, waveH);
        var enH   = enSize * 0.72;
        var krH   = krSize * 0.72;
        var CH    = Math.round(padY * 2 + enH + (CFG.krOn ? gapEK + krH : 0));

        var cardTop, row1CY;
        if (CFG.anchor === "top") {
            var blockTop = Math.round(H * CFG.edgePct);
            row1CY  = Math.round(blockTop + row1H / 2);
            cardTop = Math.round(blockTop + row1H + gapRC);
        } else {
            cardTop = Math.round(H * (1 - CFG.edgePct) - CH);
            row1CY  = Math.round(cardTop - gapRC - row1H / 2);
        }
        var cardCY = Math.round(cardTop + CH / 2);
        var enY    = Math.round(cardTop + padY + enH);
        var krY    = Math.round(enY + gapEK + krH);

        var row1W    = AVR * 2 + avGap + waveW;
        var avatarCX = Math.round(cx - row1W / 2 + AVR);
        var waveCX   = Math.round(cx + row1W / 2 - waveW / 2);

        /* 아바타 소스는 기존 레이어에서 회수한다. 없으면 아바타를 못 만든다.
           (Live 스크립트로 한 번은 만들어져 있어야 한다) */
        var oldAv = findLayer(tpl, "AVATAR");
        var avSrc = NEW_AVATAR || (oldAv ? oldAv.source : null);

        // 레이아웃 레이어는 통째로 버리고 새로 만든다
        var junk = ["CARD", "AVATAR", "AVATAR_RING", "WAVE"];
        for (var i = tpl.numLayers; i >= 1; i--) {
            var nm = tpl.layer(i).name;
            for (var j = 0; j < junk.length; j++) {
                if (nm === junk[j]) { tpl.layer(i).remove(); break; }
            }
        }

        var SAMPLE = "0.08";

        // ---- 파형 (맨 먼저 만들고 moveToEnd -> 텍스트 아래로) ------------
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
        wave.moveToEnd();
        var wxf = wave.property("ADBE Transform Group");
        wxf.property("ADBE Anchor Point").setValue([0, 0]);
        wxf.property("ADBE Position").setValue([waveCX, row1CY]);

        var wroot = wave.property("ADBE Root Vectors Group");
        var step  = isDot ? DOT.size * DOT.gap : BAR.w * BAR.gap;
        var mid   = (CFG.barCount - 1) / 2;

        for (var s = 0; s < CFG.barCount; s++) {
            var weight = 0.32 + 0.68 * Math.sin(Math.PI * (s + 0.5) / CFG.barCount);
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
                var maxN  = Math.max(1, Math.round(DOT.max * weight));
                var nExpr = osc + 'var n = Math.round(1 + ' + (maxN - 1) + ' * v);\n';
                var rep = gc.addProperty("ADBE Vector Filter - Repeater");
                pick(rep, "ADBE Vector Repeater Copies", 1).expression = nExpr + 'n';
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

        // ---- 링 ----------------------------------------------------
        if (CFG.ringOn && avSrc) {
            var ring = tpl.layers.addShape();
            ring.name = "AVATAR_RING";
            ring.moveToEnd();
            var rxf = ring.property("ADBE Transform Group");
            rxf.property("ADBE Anchor Point").setValue([0, 0]);
            rxf.property("ADBE Position").setValue([avatarCX, row1CY]);
            rxf.property("ADBE Opacity").setValue(CFG.ringOpacity);
            var rgc = ring.property("ADBE Root Vectors Group")
                          .addProperty("ADBE Vector Group")
                          .property("ADBE Vectors Group");
            var rd = (AVR + ringGap) * 2;
            var rel = rgc.addProperty("ADBE Vector Shape - Ellipse");
            rel.property("ADBE Vector Ellipse Size").setValue([rd, rd]);
            rel.property("ADBE Vector Ellipse Position").setValue([0, 0]);
            var rst = rgc.addProperty("ADBE Vector Graphic - Stroke");
            rst.property("ADBE Vector Stroke Color").setValue(
                [CFG.ringColor[0], CFG.ringColor[1], CFG.ringColor[2], 1]);
            rst.property("ADBE Vector Stroke Width").setValue(Math.round(H * CFG.ringWPct));
        }

        // ---- 아바타 -------------------------------------------------
        if (avSrc) {
            var av = tpl.layers.add(avSrc);
            av.name = "AVATAR";
            av.moveToEnd();

            var iw = avSrc.width;
            var fxp = CFG.avatarFocus[0] * iw, fyp = CFG.avatarFocus[1] * avSrc.height;
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

        // ---- 카드 ---------------------------------------------------
        var card = tpl.layers.addShape();
        card.name = "CARD";
        card.moveToEnd();
        var cxf = card.property("ADBE Transform Group");
        cxf.property("ADBE Anchor Point").setValue([0, 0]);
        cxf.property("ADBE Position").setValue([cx, cardCY]);

        var cgc = card.property("ADBE Root Vectors Group")
                      .addProperty("ADBE Vector Group")
                      .property("ADBE Vectors Group");
        var crect = cgc.addProperty("ADBE Vector Shape - Rect");
        crect.property("ADBE Vector Rect Roundness").setValue(CH / 2);
        crect.property("ADBE Vector Rect Size").setValue([minTW + padX * 2, CH]);
        crect.property("ADBE Vector Rect Size").expression =
            'var S = ' + SAMPLE + ', CH = ' + CH + ';\n' +
            'function wAt(t) {\n' +
            '  var a = 0;\n' +
            '  try { a = Math.max(a, thisComp.layer("EN").sourceRectAtTime(t, false).width); } catch (x1) {}\n' +
            '  try { a = Math.max(a, thisComp.layer("KR").sourceRectAtTime(t, false).width); } catch (x2) {}\n' +
            '  return Math.max(a, ' + minTW + ') + ' + (padX * 2) + ';\n' +
            '}\n' +
            'var w = wAt(time);\n' +
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
            '  var prev = first ? cur * ' + CFG.openFrom + ' : wAt(tp + S);\n' +
            '  var el = Math.max(time - t0, 0);\n' +
            '  var f = ' + CFG.springFreq + ', d = ' + CFG.springDecay + ';\n' +
            '  var g = Math.exp(-d * el) * (Math.cos(f * el) + (d / f) * Math.sin(f * el));\n' +
            '  var sp = cur + (prev - cur) * g;\n' +
            '  if (isFinite(sp) && sp > 0) w = sp;\n' +
            '} catch (_err) {}\n' +
            '[w, CH]';

        var cfill = cgc.addProperty("ADBE Vector Graphic - Fill");
        cfill.property("ADBE Vector Fill Color").setValue(
            [CFG.cardColor[0], CFG.cardColor[1], CFG.cardColor[2], 1]);
        try { cfill.property("ADBE Vector Fill Opacity").setValue(CFG.cardOpacity); } catch (e) {}

        // ---- 텍스트: 지우지 않고 스타일만 갈아끼운다 --------------------
        /* Source Text 에 키프레임이 있으면 값을 통째로 setValue 할 수 없다.
           키마다 TextDocument 를 꺼내 스타일만 바꿔 다시 넣어야
           대사 내용과 키프레임 시각이 그대로 살아남는다. */
        function restyleText(lay, font, size, y, opacity, delay, tracking) {
            var src = lay.property("ADBE Text Properties").property("ADBE Text Document");

            function styled(doc) {
                doc.font          = font;
                doc.fontSize      = size;
                doc.fillColor     = CFG.textColor;
                doc.applyFill     = true;
                doc.applyStroke   = false;
                doc.justification = ParagraphJustification.CENTER_JUSTIFY;
                try { doc.tracking = tracking; } catch (e) {}
                return doc;
            }

            if (src.numKeys > 0) {
                for (var k = 1; k <= src.numKeys; k++) src.setValueAtKey(k, styled(src.keyValue(k)));
            } else {
                src.setValue(styled(src.value));
            }

            var xf = lay.property("ADBE Transform Group");
            xf.property("ADBE Position").expression =
                T0("thisLayer") +
                'var d = ' + delay + ';\n' +
                'var k = ease(time, t0 + d, t0 + d + ' + CFG.inDur + ', 1, 0);\n' +
                '[' + cx + ', ' + y + ' + ' + txtRise + ' * k]';
            xf.property("ADBE Opacity").expression =
                T0("thisLayer") +
                'var d = ' + delay + ';\n' +
                opacity + ' * ease(time, t0 + d, t0 + d + ' +
                (CFG.inDur * 0.75).toFixed(2) + ', 0, 1)';
        }

        var enLay = findLayer(tpl, "EN");
        if (enLay) restyleText(enLay, enFont, enSize, enY, 100, 0, CFG.enTracking);

        var krLay = findLayer(tpl, "KR");
        if (!CFG.krOn) {
            if (krLay) krLay.remove();
        } else {
            if (!krLay) {
                krLay = tpl.layers.addText(CFG.krText);
                krLay.name = "KR";
            }
            restyleText(krLay, krFont, krSize, krY, CFG.krOpacity, CFG.krDelay, CFG.krTracking);
        }

        return enLay ? true : false;
    }

    /* 지금 유효한 Source Text 홀드 키프레임의 시각 t0.
       트랜스폼에서만 쓴다 — 텍스트 애니메이터 안에서 쓰면 순환 참조가 된다. */
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

    // =================================================================
    app.beginUndoGroup("Subtitle Card Restyle");

    var enFont = resolveFont(CFG.enFont);
    var krFont = resolveFont(CFG.krFont);

    // 사진을 바꾸는 경우에만 임포트한다. 한 번만 하고 모든 템플릿이 공유한다.
    var NEW_AVATAR = null;
    if (CFG.avatarPath) {
        try {
            var af = new File(CFG.avatarPath);
            if (af.exists) NEW_AVATAR = app.project.importFile(new ImportOptions(af));
        } catch (e) {}
    }

    var templates = [];
    for (var p = 1; p <= app.project.numItems; p++) {
        var it = app.project.item(p);
        if (it instanceof CompItem && it.name.indexOf("SUB_TEMPLATE") === 0) templates.push(it);
    }

    var done = 0, noText = 0;
    for (var t = 0; t < templates.length; t++) {
        if (restyle(templates[t], enFont, krFont)) done++; else noText++;
    }

    // ---- 메인 컴프들의 SUB 인스턴스 등장 표현식도 갱신 ------------------
    /* 슬라이더 '값' 은 건드리지 않는다 — 컷마다 다르게 맞춰뒀을 수 있다.
       표현식만 최신 CFG(overshoot 등) 로 다시 쓴다. */
    var inst = 0;
    if (CFG.refreshInstances) {
        for (var c = 1; c <= app.project.numItems; c++) {
            var cp = app.project.item(c);
            if (!(cp instanceof CompItem)) continue;
            if (cp.name.indexOf("SUB_TEMPLATE") === 0) continue;
            for (var L = 1; L <= cp.numLayers; L++) {
                var lay = cp.layer(L);
                try {
                    if (!lay.source || !(lay.source instanceof CompItem)) continue;
                    if (lay.source.name.indexOf("SUB_TEMPLATE") !== 0) continue;

                    /* 프로젝트 패널에서 컴프를 직접 끌어다 놓은 레이어에는
                       슬라이더가 없다. 표현식이 없는 슬라이더를 참조하면
                       페이드가 통째로 죽으므로 없는 것만 채워 넣는다. */
                    ensureSlider(lay, "FADE IN",  CFG.fadeIn);
                    ensureSlider(lay, "FADE OUT", CFG.fadeOut);
                    ensureSlider(lay, "RISE",     Math.round(cp.height * CFG.riseDistPct));

                    var x = lay.property("ADBE Transform Group");
                    x.property("ADBE Opacity").expression =
                        'var fi = Math.max(effect("FADE IN")(1),  0.01);\n' +
                        'var fo = Math.max(effect("FADE OUT")(1), 0.01);\n' +
                        'var a = ease(time, inPoint, inPoint + fi, 0, 100);\n' +
                        'var b = ease(time, outPoint - fo, outPoint, 100, 0);\n' +
                        'Math.min(a, b)';
                    x.property("ADBE Position").expression =
                        'var fi = Math.max(effect("FADE IN")(1), 0.01) * 1.5;\n' +
                        'var r  = effect("RISE")(1);\n' +
                        'var t  = Math.min(Math.max((time - inPoint) / fi, 0), 1);\n' +
                        'var c1 = ' + CFG.overshoot + ', c3 = c1 + 1;\n' +
                        'var p  = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);\n' +
                        '[value[0], value[1] + r * (1 - p)]';
                    inst++;
                } catch (e) {}
            }
        }
    }

    app.endUndoGroup();

    alert(
        (templates.length ? "" : "!! SUB_TEMPLATE 컴프를 못 찾았습니다.\n\n") +
        "템플릿 " + done + "개 갱신" +
        (noText ? " (EN 레이어 없는 " + noText + "개는 건너뜀)" : "") + "\n" +
        "인스턴스 " + inst + "개 표현식 갱신\n" +
        (CFG.avatarPath
            ? "프로필 사진: " + (NEW_AVATAR ? NEW_AVATAR.name + " 로 교체" : "불러오기 실패 — 경로 확인") + "\n"
            : "프로필 사진: 기존 것 유지\n") +
        "영문: " + enFont + "\n" +
        (CFG.krOn ? "한글: " + krFont + "\n" : "한글: 사용 안 함\n") +
        (missing.length ? "!! 못 찾은 폰트: " + missing.join(", ") + "\n" : "") +
        "\n대사와 타이밍은 그대로 보존됩니다."
    );

})();
