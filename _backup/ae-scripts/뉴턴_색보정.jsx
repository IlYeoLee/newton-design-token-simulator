// 뉴턴 — 합성 전체 색보정(누런기 중화)
//
//   합성본이 원본 실사(인물 영상)보다 누렇다. 실측 2026-08-05:
//     원본 실사 벽  rgb(186~191, 188~195, 189~197)   R−B −3 ~ −6
//     합성본 벽     rgb(192,188,180)                  R−B +12
//   → 파랑을 올리고 빨강을 조금 내려 R−B 를 −4 근처로 옮긴다.
//
//   ★ 프로퍼티는 **matchName** 으로 직접 잡는다. 이름으로 찾으면 한국어판에서 전부 실패한다
//     ('midtone blue' 를 찾는데 실제 이름은 '파랑 균형' — 그래서 값이 0 인 채로 붙었다).
//     진단으로 확인한 값:
//       ADBE Color Balance-0001 빨강 균형 · -0002 녹색 균형 · -0003 파랑 균형
//       ADBE Color Balance (HLS)-0001 색조 · -0002 밝기 · -0003 채도
//     이 버전의 색상 균형은 미드톤/섀도우/하이라이트 구분 없이 채널 3개뿐이다.

(function () {

    // ── 손잡이 — 세기가 부족하거나 과하면 이 네 줄만 고치면 된다 ──────────────
    var RED   = -14;   // 빨강 균형  (음수 = 빨강을 뺀다)
    var GREEN =   3;   // 녹색 균형
    var BLUE  =  22;   // 파랑 균형  (양수 = 파랑을 더한다 = 누런기 제거)
    var SAT   =   4;   // 채도 보충 (중립으로 가며 빠지는 만큼)
    // ────────────────────────────────────────────────────────────────────

    function findComp() {
        var c = app.project.activeItem;
        if (c instanceof CompItem) return c;
        for (var i = 1; i <= app.project.numItems; i++)
            if (app.project.item(i) instanceof CompItem) { var x = app.project.item(i); x.openInViewer(); return x; }
        return null;
    }
    function setP(fx, mn, v, log, label) {
        try {
            var p = fx.property(mn);
            if (!p) { log.push("  · " + label + " — 프로퍼티 없음"); return; }
            p.setValue(v);
            log.push("  · " + p.name + " = " + v);
        } catch (e) { log.push("  · " + label + " 실패: " + e.toString()); }
    }

    var comp = findComp();
    if (!comp) { alert("컴프를 찾을 수 없습니다."); return; }

    app.beginUndoGroup("뉴턴 색보정");

    var NAME = "색보정 · 누런기 중화";
    for (var j = comp.numLayers; j >= 1; j--)
        if (comp.layer(j).name === NAME) comp.layer(j).remove();

    var adj = comp.layers.addSolid([1, 1, 1], NAME, comp.width, comp.height, 1, comp.duration);
    adj.adjustmentLayer = true;
    adj.moveToBeginning();          // 맨 위 = 전체 보정

    var log = [];
    var par = adj.property("ADBE Effect Parade");

    var cb = par.addProperty("ADBE Color Balance");
    log.push("색상 균형");
    setP(cb, "ADBE Color Balance-0001", RED,   log, "빨강");
    setP(cb, "ADBE Color Balance-0002", GREEN, log, "녹색");
    setP(cb, "ADBE Color Balance-0003", BLUE,  log, "파랑");

    var hls = par.addProperty("ADBE Color Balance (HLS)");
    log.push("색상 균형(HLS)");
    setP(hls, "ADBE Color Balance (HLS)-0003", SAT, log, "채도");

    app.endUndoGroup();

    alert("색보정 적용\n\n컴프: " + comp.name +
          "\n레이어: " + NAME + "  (조정 레이어 · 맨 위 · 전체)\n\n" +
          log.join("\n") +
          "\n\n세기 조절 = 이 레이어의 불투명도\n더 세게/약하게 = 스크립트 맨 위 RED·GREEN·BLUE 수정");
})();
