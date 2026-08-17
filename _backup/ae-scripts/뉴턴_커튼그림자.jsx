// 뉴턴 — 커튼 그림자를 배경 위에 곱하기로 얹는다.
//
//   평탄화하면서 지운 창빛/그림자를 되돌린다. 배경에 굽지 않고 **레이어로** 둔다 —
//   세기를 나중에 불투명도 하나로 만질 수 있고, 원본 배경을 안 건드린다.
//
//   ★ 자리가 전부다. 맨 위에 얹으면 인물한테까지 그림자가 져서 바로 가짜 티가 난다.
//     배경 **바로 위**, 시뮬 합성물·인물보다 **아래**.
//
//   ★ 곱하기(Multiply). 그림자는 빛을 빼는 것이라 이게 물리적으로 맞다.
//     (유저의 "블렌딩 모드 안 쓴다"는 시뮬 UI 레이어 얘기 — 그건 잉크로 얹는다.)
//
//   ★ 크기 조절 없음. 창빛_*.png 는 배경과 같은 8208×5348 이라 그대로 겹친다.
//     스케일을 건드리면 번짐 기울기가 깨져 바로 인공적으로 보인다.
//
//   ★ 파일명을 딱 맞추지 않는다(08-05: "배경 레이어를 못 찾았습니다"로 실패).
//     푸티지를 교체하면 프로젝트 아이템 이름이 옛 이름으로 남는다. 그래서 레이어 이름·
//     소스 이름·파일 이름 **셋 중 아무데나** '배경' + '정면/측면' 이 있으면 배경으로 본다.
//     프리컴프 안이든 밖이든 상관없다 — app.project.item() 이 전부 훑는다.

(function () {

    // ── 손잡이 ────────────────────────────────────────────────────────────
    // 세기(%). 100 이 기본이다 — 세기는 PNG 자체가 들고 있다(빛 받는 곳 255 = 변화 없음,
    //   그늘 최저 199 = 22% 만 내려간다). 약하게 하려면 60~80 으로.
    //   ⚠ 08-05: 예전 PNG 는 최대 221 이라 곱하기에서 화면 전체가 21% 균일하게 어두워질 뿐
    //     무늬는 12% 였다. 거기에 불투명도 15% 를 걸어서 "아무 효과 없음"이 됐다.
    var OPACITY = 100;
    var DIR = "C:/Users/user/Desktop/";
    // ─────────────────────────────────────────────────────────────────────

    function names(lay) {
        var n = { layer: lay.name || "", src: "", file: "" };
        try {
            if (lay.source) {
                n.src = lay.source.name || "";
                if (lay.source.mainSource && lay.source.mainSource.file)
                    n.file = lay.source.mainSource.file.name || "";
            }
        } catch (e) {}
        return n;
    }

    // '배경' 이 들어 있으면 배경 후보. 어느 쪽인지는 '정면'/'측면' 으로 가린다.
    function sideOf(lay) {
        var n = names(lay), all = n.layer + " " + n.src + " " + n.file;
        if (all.indexOf("배경") < 0) return null;
        if (all.indexOf("정면") >= 0) return "정면";
        if (all.indexOf("측면") >= 0) return "측면";
        return null;
    }

    function footageFor(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            try {
                if (it instanceof FootageItem && it.mainSource && it.mainSource.file
                    && it.mainSource.file.name === name) return it;
            } catch (e) {}
        }
        var f = new File(DIR + name);
        if (!f.exists) return null;
        return app.project.importFile(new ImportOptions(f));
    }

    var comps = [];
    for (var c = 1; c <= app.project.numItems; c++)
        if (app.project.item(c) instanceof CompItem) comps.push(app.project.item(c));
    if (!comps.length) { alert("컴포지션이 없습니다."); return; }

    app.beginUndoGroup("뉴턴 커튼 그림자");

    var log = [], added = 0, missing = {}, seen = [];

    for (var ci = 0; ci < comps.length; ci++) {
        var comp = comps[ci];

        // 다시 돌려도 쌓이지 않게 이전 것을 먼저 지운다
        for (var d = comp.numLayers; d >= 1; d--)
            if (comp.layer(d).name.indexOf("커튼 그림자") === 0) comp.layer(d).remove();

        // 아래에서 위로 훑는다. 위에서부터 넣으면 인덱스가 밀린다.
        for (var L = comp.numLayers; L >= 1; L--) {
            var lay = comp.layer(L), n = names(lay);
            seen.push(comp.name + " | " + n.layer + " | src=" + n.src + " | file=" + (n.file || "-"));

            var side = sideOf(lay);
            if (!side) continue;

            var want = "창빛_" + side + ".png";
            var ft = footageFor(want);
            if (!ft) { missing[want] = true; continue; }

            var add = comp.layers.add(ft, comp.duration);
            add.name = "커튼 그림자 · " + side;
            add.moveBefore(lay);                    // 배경 바로 위
            add.blendingMode = BlendingMode.MULTIPLY;
            add.opacity.setValue(OPACITY);
            add.startTime = 0;
            added++;
            log.push("  " + comp.name + " → " + (n.layer || n.src) + " 위 [" + side + "]");
        }
    }

    app.endUndoGroup();

    var miss = [];
    for (var k in missing) miss.push(k);

    if (added === 0) {
        // 왜 못 찾았는지 눈으로 볼 수 있게 남긴다 — 다음 수정이 추측이 아니게.
        var f = new File("C:/Users/user/Desktop/뉴턴_레이어목록.txt");
        f.encoding = "UTF-8"; f.open("w");
        f.write("커튼 그림자: 배경 레이어를 못 찾았습니다.\n" +
                "찾는 조건 = 레이어/소스/파일 이름 어딘가에 '배경' + ('정면' 또는 '측면')\n\n" +
                seen.join("\n"));
        f.close();
        alert("배경 레이어를 못 찾았습니다.\n\n" +
              "본 레이어 목록을 저장했습니다:\n바탕화면 → 뉴턴_레이어목록.txt\n\n" +
              "이 파일을 보고 조건을 고치면 됩니다." +
              (miss.length ? "\n\n⚠ 바탕화면에 없는 파일:\n  " + miss.join("\n  ") : ""));
        return;
    }

    alert("커튼 그림자 " + added + "장 추가\n\n" + log.join("\n") +
          "\n\n곱하기 · 불투명도 " + OPACITY + "% · 크기 조절 없음" +
          (miss.length ? "\n\n⚠ 바탕화면에 없는 파일:\n  " + miss.join("\n  ") : "") +
          "\n\n세기 조절 = 이 레이어의 불투명도");
})();
