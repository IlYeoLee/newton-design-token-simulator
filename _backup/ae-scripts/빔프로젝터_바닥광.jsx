// 빔프로젝터 바닥광 — 1인칭 러닝 컴프의 바닥에 빔 발광 footprint 를 얹는다.
// 실행: 파일 > 스크립트 > 스크립트 파일 실행
// alert 안 씀. 결과는 바탕화면 빔프로젝터_바닥광_로그.txt + 타임라인 상단 두 레이어로 확인.

// ── 튜닝 ───────────────────────────────────────────────────────────────
// 전부 화면 비율(0~1). 영상 분석값 기준 기본치 — 눈으로 보고 여기만 고치면 된다.
var CFG = {
    centerX:    0.500,  // 빔 중심 (소실점이 화면 정중앙 근처)
    topY:       0.300,  // 빔이 닿는 가장 먼 지점의 높이. 낮출수록 멀리 뻗음
    flip:       true,   // true = 먼 쪽이 넓음(기본). false = 발밑이 넓음
    farHalf:    0.235,  // 먼 쪽(위) 반폭
    nearHalf:   0.125,  // 발밑(아래) 반폭 — 둘 차이가 벌어질수록 부채꼴이 심해진다
    bottomPad:  0.060,  // 화면 아래로 더 내려 잘리게 (아래 경계선 안 보이게)
    cornerR:    0.055,  // 먼 쪽 두 모서리 라운드 반경
    feather:    0.035,  // 마스크 페더

    centerDip:  35,     // 가운데를 어둡게 (%). 0 이면 균일, 클수록 가장자리만 밝다
    dipScale:   0.55,   // 어두워지는 안쪽 영역 크기 (빔 폭 대비)

    brightness: 26,     // 바닥이 밝아지는 양 — "아주 밝게" 원하면 여기부터
    contrast:   8,
    hazeOpacity: 16,    // 공기 중 빛 느낌(가산). 0 이면 밝기만 적용
    hazeColor:  [1.00, 0.96, 0.88]  // 살짝 따뜻한 흰빛
};
var NAME_BRIGHT = "PJT_바닥밝기";
var NAME_HAZE   = "PJT_빔헤이즈";
// ───────────────────────────────────────────────────────────────────────

var K = 0.5523;  // 원 근사 베지어 상수

function log(lines) {
    var f = new File(Folder.desktop.fsName + "/빔프로젝터_바닥광_로그.txt");
    f.encoding = "UTF-8";
    f.open("w"); f.write(lines.join("\n")); f.close();
}

// 사다리꼴 + 먼 쪽 모서리 라운드.
// 꼭짓점 순서 고정: [발밑좌, 발밑우, 우측변, 먼쪽우, 먼쪽좌, 좌측변] — 순서 바꾸지 말 것.
function beamShape(w, h, scale) {
    var cx = CFG.centerX * w;
    var yB = h * (1 + CFG.bottomPad);   // 아래 = 발밑
    var yT = h * CFG.topY;              // 위 = 먼 쪽
    var big = Math.max(CFG.nearHalf, CFG.farHalf) * w * scale;
    var sml = Math.min(CFG.nearHalf, CFG.farHalf) * w * scale;
    var near = CFG.flip ? sml : big;
    var far  = CFG.flip ? big : sml;

    // 라운드 반경 — 먼 쪽 변 절반, 옆변 길이 절반을 넘지 않게 자른다
    var side = Math.sqrt((far - near) * (far - near) + (yB - yT) * (yB - yT));
    var r = Math.min(CFG.cornerR * w * scale, far * 0.9, side * 0.4);
    var ux = (near - far) / side, uy = (yB - yT) / side;  // 먼쪽모서리 → 발밑 방향

    var CrX = cx + far, ClX = cx - far;            // 먼 쪽 모서리
    var p1r = [CrX + ux * r, yT + uy * r];         // 우측변 위 (모서리에서 r 내려옴)
    var p2r = [CrX - r,      yT];                  // 먼 쪽 변 위 (모서리에서 r 안쪽)
    var p2l = [ClX + r,      yT];
    var p1l = [ClX - ux * r, yT + uy * r];

    var s = new Shape();
    s.vertices = [[cx - near, yB], [cx + near, yB], p1r, p2r, p2l, p1l];
    s.inTangents  = [[0,0], [0,0], [0,0], [(CrX-p2r[0])*K, 0], [(ClX-p2l[0])*K, 0], [0,0]];
    s.outTangents = [[0,0], [0,0], [(CrX-p1r[0])*K, (yT-p1r[1])*K], [0,0], [0,0],
                     [(ClX-p1l[0])*K, (yT-p1l[1])*K]];
    s.closed = true;
    return s;
}

function addBeamMask(layer, w, h, scale, mode, opacity, feather) {
    var m = layer.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
    m.maskMode = mode;
    m.property("ADBE Mask Shape").setValue(beamShape(w, h, scale));
    var fx = feather * w;
    m.property("ADBE Mask Feather").setValue([fx, fx]);
    m.property("ADBE Mask Opacity").setValue(opacity);
    return m;
}

// 바깥 = 빔 전체, 안쪽 = 가운데를 깎아 가장자리만 밝게
function addBeamMasks(layer, w, h) {
    addBeamMask(layer, w, h, 1, MaskMode.ADD, 100, CFG.feather);
    if (CFG.centerDip > 0)
        addBeamMask(layer, w, h, CFG.dipScale, MaskMode.SUBTRACT, CFG.centerDip, CFG.feather * 1.7);
}

var out = [];
app.beginUndoGroup("빔프로젝터 바닥광");
try {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        out.push("ERROR: 컴프가 열려있지 않다. 타임라인에서 컴프를 연 뒤 다시 실행.");
    } else {
        var w = comp.width, h = comp.height;

        // 재실행해도 쌓이지 않게 기존 것 먼저 제거
        for (var i = comp.numLayers; i >= 1; i--) {
            var n = comp.layer(i).name;
            if (n === NAME_BRIGHT || n === NAME_HAZE) comp.layer(i).remove();
        }

        // 선택한 레이어가 있으면 그 바로 위에 넣는다(UI 레이어 아래에 깔고 싶을 때).
        var anchor = comp.selectedLayers.length ? comp.selectedLayers[0] : null;

        // ① 바닥 밝기 — 조정 레이어 + 빔 마스크
        var bright = comp.layers.addSolid([0, 0, 0], NAME_BRIGHT, w, h, 1);
        bright.adjustmentLayer = true;
        var bc = bright.property("ADBE Effect Parade").addProperty("ADBE Brightness & Contrast 2");
        bc.property(1).setValue(CFG.brightness);  // 한국어판 대응: 이름 말고 인덱스
        bc.property(2).setValue(CFG.contrast);
        addBeamMasks(bright, w, h);

        // ② 빔 헤이즈 — 발밑이 제일 밝고 멀어질수록 사라지는 가산 광
        var haze = comp.layers.addSolid(CFG.hazeColor, NAME_HAZE, w, h, 1);
        haze.blendingMode = BlendingMode.ADD;
        haze.property("ADBE Transform Group").property("ADBE Opacity").setValue(CFG.hazeOpacity);
        var ramp = haze.property("ADBE Effect Parade").addProperty("ADBE Ramp");
        ramp.property(1).setValue([CFG.centerX * w, h]);            // 시작점(발밑)
        ramp.property(2).setValue(CFG.hazeColor);                   // 시작색
        ramp.property(3).setValue([CFG.centerX * w, h * CFG.topY]); // 끝점(먼 쪽)
        ramp.property(4).setValue([0, 0, 0]);                       // 끝색 = 가산에서 무효
        addBeamMasks(haze, w, h);

        if (anchor) { bright.moveBefore(anchor); haze.moveBefore(anchor); }
        haze.moveAfter(bright);

        // 자체 점검 — 마스크/이펙트/방향이 실제로 맞는지
        var ok = true;
        var wantMasks = CFG.centerDip > 0 ? 2 : 1;
        var layers = [bright, haze];
        for (var k = 0; k < 2; k++) {
            var L = layers[k];
            var mp = L.property("ADBE Mask Parade");
            var v = mp.property(1).property("ADBE Mask Shape").value.vertices;
            var nfx = L.property("ADBE Effect Parade").numProperties;
            var wBottom = v[1][0] - v[0][0];   // 발밑 폭
            var wTop    = v[3][0] - v[4][0];   // 먼 쪽 변 폭(라운드 제외)
            out.push(L.name + " : 마스크 " + mp.numProperties + "개, 꼭짓점 " + v.length + "개, 이펙트 " + nfx + "개");
            out.push("  발밑폭 " + Math.round(wBottom) + "px / 먼쪽폭 " + Math.round(wTop) + "px → "
                   + (wBottom > wTop ? "아래(발밑)가 넓음" : "위(먼 쪽)가 넓음"));
            if (mp.numProperties !== wantMasks || v.length !== 6 || nfx !== 1
                || (wBottom > wTop) === CFG.flip) ok = false;
        }
        out.push(ok ? "OK — 정상 생성" : "ERROR — 위 수치 확인 필요");
        out.push("컴프: " + comp.name + " (" + w + "x" + h + ")");
        out.push("삽입 위치: " + (anchor ? ("'" + anchor.name + "' 바로 위") : "최상단"));
    }
} catch (e) {
    out.push("ERROR: " + e.toString() + " (line " + e.line + ")");
}
app.endUndoGroup();
log(out);
