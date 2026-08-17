// 뉴턴 — 지면 기울기 맞추기 · 좌 (1인칭 발밑 컷)
//
//   선택한 레이어를 **그 자리 그대로** 두고, 지면 원근에 맞는 사다리꼴로만 눕힌다.
//   위치·크기·회전은 건드리지 않는다. 코너핀만 쓴다.
//
//   ── 각도의 출처 (감으로 정하지 않았다) ──────────────────────────────────────
//   소스 `PRESS ON _ #3-2.mov` (4096×2160) 의 코트 타일 이음매를 실측했다.
//   카메라 정면으로 뻗는 지면 세로줄의 화면상 좌우 간격 s(y) 는 s = k·(y − y_h) 로
//   소실선에서 선형으로 벌어진다. 프레임 y=300~1700 을 15밴드로 재고 로버스트 회귀:
//
//       1.0s  y_h = −2515 px = −1.1644 H   (R² 0.997, n 13)
//       3.0s  y_h = −2545 px = −1.1784 H   (R² 0.996, n 15)
//       5.0s  y_h = −2547 px = −1.1790 H   (R² 0.997, n 15)
//       → 채택 −1.174 H
//
//   즉 지평선이 프레임 위쪽 밖으로 화면 높이의 1.17배 지점에 있다. 발밑을 내려다보는
//   1인칭이라 정상이다. 초점거리는 몰라도 되고 쓰지도 않았다 — 지면 사각형의 사다리꼴
//   모양은 소실점 하나로 결정된다.
//
//   ⚠ 이 클립은 **10초쯤부터 카메라가 틸트업**한다(10.0s 에서 y_h 가 −0.251 H 까지 올라간다).
//     위 값은 발밑을 보는 앞 구간(0~6초) 것이다. UI 를 뒤 구간에 얹을 거면 아래 YH_RATIO 를
//     바꿔야 하고, 컷 안에서 카메라가 움직이면 고정 코너핀으로는 끝까지 안 맞는다.
//
//   ★ 판의 좌우 방향은 카메라 정면 기준으로 놓는다(소실점 x = 프레임 중앙).
//     코트 라인 방향이 아니다 — 뉴턴_지면합성.jsx 의 시뮬 투영값도 좌우대칭이다.
//   ★ alert 를 쓰지 않는다. 결과는 바탕화면 '뉴턴_지면기울기_좌_결과.txt'.

(function () {
    var CLIP_HINT = '#3-2';        // 배경 클립을 자동으로 찾을 때 쓰는 이름 조각
    var YH_RATIO  = -1.174;        // 소실선 y ÷ 소스 프레임 높이 (실측값)
    var STRENGTH  = 1.0;           // 기울기 세기. 1.0 = 실측 그대로 · 0.7 처럼 낮추면 덜 눕는다

    var L = [];
    function log(s) { L.push(String(s)); }
    function save() {
        try {
            var f = new File(Folder.desktop.fsName + '/뉴턴_지면기울기_좌_결과.txt');
            f.encoding = 'UTF-8'; f.open('w'); f.write(L.join('\r\n')); f.close();
        } catch (e) {}
    }
    function r(n) { return Math.round(n * 10) / 10; }

    log('=== 지면 기울기 · 좌 (1인칭) · 소실선비 ' + YH_RATIO + ' ===');
    try { log('AE ' + app.version); } catch (e) {}

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { log('✗ 활성 컴프 없음 — 컴프를 열고 다시 실행'); save(); return; }
    log('컴프 "' + comp.name + '" ' + comp.width + '×' + comp.height);

    var sel = comp.selectedLayers;
    if (!sel.length) { log('✗ 선택 레이어 없음 — 기울일 레이어를 클릭하고 다시 실행'); save(); return; }

    // ── 소실점을 컴프 좌표로 ────────────────────────────────────────────────
    // 배경 클립이 크롭·확대돼 있어도 sourcePointToComp 가 그대로 환산해 준다.
    var bg = null;
    for (var i = 1; i <= comp.numLayers; i++) {
        var Ly = comp.layer(i);
        var nm = Ly.name + ' ' + (Ly.source ? Ly.source.name : '');
        if (nm.indexOf(CLIP_HINT) >= 0) { bg = Ly; break; }
    }

    var V;
    if (bg && bg.sourcePointToComp && bg.source) {
        V = bg.sourcePointToComp([bg.source.width / 2, YH_RATIO * bg.source.height]);
        log('기준 배경 "' + bg.name + '" ' + bg.source.width + '×' + bg.source.height +
            ' → 소실점 컴프좌표 (' + r(V[0]) + ', ' + r(V[1]) + ')');
    } else {
        V = [comp.width / 2, YH_RATIO * comp.height];
        log('배경 클립("' + CLIP_HINT + '") 을 못 찾음 → 컴프 프레임을 기준으로 계산');
        log('소실점 컴프좌표 (' + r(V[0]) + ', ' + r(V[1]) + ')');
    }

    app.beginUndoGroup('지면 기울기 · 좌');

    for (var s = 0; s < sel.length; s++) {
        var Lay = sel[s];
        if (bg && Lay === bg) { log('· "' + Lay.name + '" 는 기준 배경 — 건너뜀'); continue; }
        try {
            var w = Lay.source ? Lay.source.width  : comp.width;
            var h = Lay.source ? Lay.source.height : comp.height;
            log('레이어 "' + Lay.name + '" 소스 ' + w + '×' + h);

            if (!Lay.sourcePointToComp) { log('  ✗ 좌표 변환을 지원하지 않는 레이어'); continue; }
            if (Lay.threeDLayer) { log('  · 3D 가 켜져 있어 껐다 (코너핀은 2D 에서 쓴다)'); Lay.threeDLayer = false; }

            var rz = Lay.property('ADBE Transform Group').property('ADBE Rotate Z').value;
            if (Math.abs(rz) > 0.01) log('  ⚠ Z회전 ' + r(rz) + '° — 사각형이 기울어 있어 결과가 어긋날 수 있다');

            // 현재 화면에 보이는 네 모서리 (트랜스폼 반영, 이펙트 제외)
            var A = Lay.sourcePointToComp([0, 0]), B = Lay.sourcePointToComp([w, 0]);
            var C = Lay.sourcePointToComp([0, h]), D = Lay.sourcePointToComp([w, h]);
            var yt = (A[1] + B[1]) / 2, yb = (C[1] + D[1]) / 2;

            var t = (yb - yt) / (yb - V[1]) * STRENGTH;   // 하단 변에서 소실점까지의 진행률
            log('  화면 y ' + r(yt) + ' ~ ' + r(yb) + ' · 먼쪽 축소율 ' + r((1 - t) * 100) + '%');
            if (!(t > 0 && t < 1)) { log('  ✗ 축소율이 범위를 벗어남 (t=' + r(t) + ') — 레이어가 소실선 위/너머에 있다'); continue; }

            // 아래 변은 고정하고, 위 변만 소실점 쪽으로 당긴다
            var Ap = [C[0] + t * (V[0] - C[0]), C[1] + t * (V[1] - C[1])];
            var Bp = [D[0] + t * (V[0] - D[0]), D[1] + t * (V[1] - D[1])];
            var TL = Lay.compPointToSource(Ap), TR = Lay.compPointToSource(Bp);

            var par = Lay.property('ADBE Effect Parade');
            for (var d = par.numProperties; d >= 1; d--)
                if (par.property(d).matchName === 'ADBE Corner Pin') par.property(d).remove();

            var cp = par.addProperty('ADBE Corner Pin');
            cp.property('ADBE Corner Pin-0001').setValue(TL);       // 좌상 (먼 쪽)
            cp.property('ADBE Corner Pin-0002').setValue(TR);       // 우상 (먼 쪽)
            cp.property('ADBE Corner Pin-0003').setValue([0, h]);   // 좌하 (가까운 쪽) — 그대로
            cp.property('ADBE Corner Pin-0004').setValue([w, h]);   // 우하 (가까운 쪽) — 그대로
            log('  ✓ 코너핀 · 상단 ' + r(TL[0]) + ',' + r(TL[1]) + ' → ' + r(TR[0]) + ',' + r(TR[1]) +
                ' (원래 0,0 → ' + w + ',0)');
        } catch (e) {
            log('  ✗ 오류: ' + e + (e.line ? ' (line ' + e.line + ')' : ''));
        }
    }

    app.endUndoGroup();
    save();
})();
