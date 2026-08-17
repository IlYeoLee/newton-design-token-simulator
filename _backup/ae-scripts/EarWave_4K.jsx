// EarWave_4K.jsx — 귀에서 퍼지는 흰색 파형 (4K / 5초 / 알파)
// AE > File > Scripts > Run Script File... 로 실행

(function () {
    // ── 튜닝 노브 (여기만 고치고 다시 실행) ──────────────────────────
    var CFG = {
        w: 3840, h: 2160, fps: 30, dur: 5,
        count: 4,                 // 파형 개수
        ellipse: [1100, 1500],    // 타원 기본 크기(px) — 세로로 긴 달걀형
        tilt: -18,                // 기울기(도)

        intro: true,              // true=0에서 다 모였다가 퍼짐(루프 아님) / false=이음매 없는 무한루프
        stagger: 0.35,            // 파형끼리 터져나오는 간격(초)
        cycle: 3.5,               // 파형 하나가 0→끝까지 가는 시간(초)
        startScale: 0,            // 시작 크기(%)
        endScale: 170,            // 끝 크기(%)
        ease: 0.85,               // 1=등속, 낮을수록 초반에 확 커짐

        stroke: 5,                // 선 두께(px) — 얇게
        feather: 8,               // 선 패더(번짐)
        fillOpacity: 7,           // 내부 채움(%) — 0이면 선만

        gradAngle: 200,           // 라인 그라디언트 방향(도)
        gradAmount: 30,           // 얼마나 지워질지(%) — 높을수록 한쪽이 많이 사라짐
        gradSoft: 700,            // 그라디언트 폭(px) — 클수록 은은

        glowOpacity: 35,          // 안쪽 은은한 흰 빛(%) — 0이면 끔
        glowSize: 60
    };
    // ────────────────────────────────────────────────────────────

    function setProp(grp, names, val) {   // 이름/matchName 중 하나 걸리면 세팅
        for (var n = 0; n < names.length; n++) {
            try { grp.property(names[n]).setValue(val); return true; } catch (e) {}
        }
        return false;
    }

    if (!app.project) { alert("프로젝트를 먼저 여세요."); return; }
    app.beginUndoGroup("EarWave 4K");

    var comp = app.project.items.addComp("EarWave_4K", CFG.w, CFG.h, 1, CFG.dur, CFG.fps);
    comp.bgColor = [0, 0, 0];

    var bg = comp.layers.addSolid([0, 0, 0], "BG_BLACK (필요시 켜기)", CFG.w, CFG.h, 1);
    bg.enabled = false;
    bg.locked = true;

    var ctrl = comp.layers.addNull(CFG.dur);
    ctrl.name = "EAR_CTRL (이걸 귀에 맞춰 이동/크기조절)";
    ctrl.property("Transform").property("Position").setValue([CFG.w / 2, CFG.h / 2]);

    // 파형 i 의 진행도 t(0~1) 를 만드는 앞부분
    function head(i) {
        if (CFG.intro) {
            return "t=(time-" + (i * CFG.stagger).toFixed(3) + ")/" + CFG.cycle + ";\n" +
                   "var out=(t<0||t>1);\n";
        }
        return "t=(time/" + CFG.dur + "+" + (i / CFG.count) + ")%1;\nvar out=false;\n";
    }

    for (var i = CFG.count - 1; i >= 0; i--) {
        var L = comp.layers.addShape();
        L.name = "wave_" + (i + 1);
        L.moveBefore(ctrl);

        var c = L.property("ADBE Root Vectors Group")
                 .addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        c.addProperty("ADBE Vector Shape - Ellipse")
         .property("ADBE Vector Ellipse Size").setValue(CFG.ellipse);
        var st = c.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue([1, 1, 1, 1]);
        st.property("ADBE Vector Stroke Width").setValue(CFG.stroke);
        var fl = c.addProperty("ADBE Vector Graphic - Fill");
        fl.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);
        fl.property("ADBE Vector Fill Opacity").setValue(CFG.fillOpacity);

        var tr = L.property("Transform");
        tr.property("Rotation").setValue(CFG.tilt);
        tr.property("Scale").expression = head(i) +
            "if(out){[0,0]}else{s=" + CFG.startScale + "+(" + CFG.endScale + "-" + CFG.startScale +
            ")*Math.pow(t," + CFG.ease + ");[s,s]}";
        tr.property("Opacity").expression = head(i) +
            "out?0:100*Math.min(t/0.12,1)*Math.pow(1-t,1.3)";

        var fx = L.property("ADBE Effect Parade");

        // 라인 그라디언트: 한쪽으로 갈수록 알파가 서서히 빠짐
        if (CFG.gradAmount > 0) {
            var wipe = fx.addProperty("ADBE Linear Wipe");
            setProp(wipe, ["Transition Completion"], CFG.gradAmount);
            setProp(wipe, ["Wipe Angle"], CFG.gradAngle);
            setProp(wipe, ["Feather"], CFG.gradSoft);
        }

        // 패더
        if (CFG.feather > 0) {
            var blur;
            try { blur = fx.addProperty("ADBE Gaussian Blur 2"); }
            catch (e) { blur = fx.addProperty("ADBE Fast Blur"); }
            blur.property(1).setValue(CFG.feather);
            try { blur.property("Repeat Edge Pixels").setValue(false); } catch (e) {}
        }

        if (CFG.glowOpacity > 0) {   // 레이어 스타일 = 레이어 알파 안쪽에만 그려짐
            try {
                var ig = L.property("ADBE Layer Styles").addProperty("innerGlow");
                setProp(ig, ["Opacity", "innerGlow/opacity"], CFG.glowOpacity);
                setProp(ig, ["Color", "innerGlow/color"], [1, 1, 1, 1]);
                setProp(ig, ["Size", "innerGlow/blur"], CFG.glowSize);
            } catch (e) {}
        }

        L.parent = ctrl;
    }

    comp.openInViewer();
    app.endUndoGroup();
})();
