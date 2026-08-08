// A2 종아리 정본을 에펙에 얹는다 — 있는 것만 골라서 전부.
//
//   ① FULL  파형 포함 완성본 (검정배경 · Normal)
//   ② MARKS 파형 뺀 판 (--norip) — 파형을 따로 얹을 때 쓰는 잉크 판
//   ③ RIP   구운 파형 시퀀스 (가산) — 있으면 Add 로 얹는다
//
//   PNG 시퀀스가 아니라 ProRes 를 문다. 시퀀스(장당 9MB × 483장)는 AE 가 프레임마다
//   디코드하다 메모리로 튕긴다 — 그게 원인이었다.
//
//   실사 위에 얹을 때: 판은 Normal, 파형·글로우는 Add (또는 Effect > Channel > UnMult).
//   투사는 가산광이라 Normal 로 두면 빛이 배경을 가려 뿌옇게 보인다.
(function () {
  var ROOT = "C:/Users/Administrator/projects/newton-design-token-simulator/out/";
  var ITEMS = [
    { path: ROOT + "A2_V3/A2_CALF_16s_FULL_ProRes422HQ.mov",     name: "A2_CALF_FULL",  add: false },
    { path: ROOT + "A2_MARKS/A2_CALF_16s_MARKS_ProRes422HQ.mov", name: "A2_CALF_MARKS", add: false },
    { path: ROOT + "A2_RIP/A2_RIP_ProRes4444.mov",               name: "A2_CALF_RIP",   add: true  },
  ];

  app.beginUndoGroup("NEWTON A2 종아리 임포트");
  var bin = app.project.items.addFolder("newton — A2 종아리 16.1s");
  var made = [], missing = [];

  for (var i = 0; i < ITEMS.length; i++) {
    var it = ITEMS[i], f = new File(it.path);
    if (!f.exists) { missing.push(it.name); continue; }

    var fo = app.project.importFile(new ImportOptions(f));
    fo.parentFolder = bin;
    // 가산 소재는 알파를 Straight 로 — Premultiplied 로 잡히면 가장자리가 검게 먹는다
    if (it.add) { try { fo.mainSource.alphaMode = AlphaMode.STRAIGHT; } catch (e) {} }

    var comp = app.project.items.addComp(
      it.name, fo.width, fo.height, fo.pixelAspect, fo.duration, (1 / fo.frameDuration));
    comp.parentFolder = bin;
    comp.bgColor = [0, 0, 0];               // 가산광은 검정 위에서 제 색이 나온다

    var lyr = comp.layers.add(fo);
    lyr.blendingMode = it.add ? BlendingMode.ADD : BlendingMode.NORMAL;
    made.push(it.name + "  " + fo.width + "x" + fo.height
              + "  " + comp.duration.toFixed(2) + "s @" + Math.round(1 / fo.frameDuration) + "fps"
              + (it.add ? "  [Add]" : "  [Normal]"));
    if (made.length === 1) comp.openInViewer();
  }

  app.endUndoGroup();

  alert((made.length ? "얹었습니다 (" + made.length + ")\n\n  " + made.join("\n  ") : "가져올 파일이 없습니다.")
      + (missing.length ? "\n\n아직 없는 것 (렌더 전):\n  " + missing.join("\n  ") : "")
      + "\n\n구성: 관찰 5.8s + 2렙 x 5.15s = 16.1s"
      + "\n렙1 LEFT CALF STRETCH / 렙2 RIGHT CALF STRETCH (자막·글로우·카운트 같이 교대)"
      + "\n\n실사 위에 얹을 때 → 판은 Normal, 파형/글로우는 Add");
})();
