// 뉴턴 — 지면 UI 실사 합성 (러닝 · 농구 공용)
//
//   선택한 UI 레이어에 **시뮬레이터의 실제 원근**을 코너핀으로 씌운다. 실행하면 끝난다.
//
//   ── 각도의 출처 ───────────────────────────────────────────────────────────
//   사진에서 역산하지 않았다. 앱을 띄워 **지면 판 네 모서리를 실제 1인칭 카메라로 투영**해
//   읽은 값이다(2026-08-06 실측):
//       카메라  눈높이 1.686 m · 수직 화각 60° · 종횡비 1.225
//       판      월드 (0, 0.012, −1.083) · 1600×2670 × 0.00069 = 1.104 × 1.842 m
//               z −0.17(발 앞) ~ −2.004(먼 쪽)
//
//   ★ 러닝·농구 공용이다. 지면 투사 스펙이 종목 공통으로 통합돼 있고(projector.js:231-236,
//     유저 승인 08-05 — 예전엔 농구만 fixedPad 라 카드 폭이 1.4m vs 1.1m 로 갈렸다),
//     1인칭 화각도 둘 다 60° 다(main.js:828, 복싱만 58°).
//
//   ★ 가까운 두 모서리의 NDC y 가 −1.7 대 = 화면 아래 밖이다. 정상이다. 1인칭에서 판의
//     발치는 프레임 밖으로 빠진다 — 코너핀이 컴프 밖에 찍히는 게 맞다.
//
//   ★ alert 를 쓰지 않는다(AE 알림창이 메인 창 뒤로 깔려 멈춘 것처럼 보인다).
//     결과는 바탕화면 '뉴턴_지면합성_결과.txt'.
//   ★ 3D 를 켜지 않는다. Position 은 [w/2, h/2] — 그래야 코너핀 좌표가 컴프 좌표와 같아진다
//     (뉴턴_벽면코너핀_거실.jsx 에서 검증된 규약).

(function () {
    var SIM_ASPECT = 1.225;
    var NDC = {                      // 시뮬 카메라 투영 결과
        TL: [-0.31839, -0.00893],    // 먼 쪽 왼
        TR: [ 0.28285,  0.00428],    // 먼 쪽 오른
        BL: [-0.63957, -1.76685],    // 가까운 쪽 왼
        BR: [ 0.67714, -1.70341]     // 가까운 쪽 오른
    };

    var L = [];
    function log(s) { L.push(String(s)); }
    function save() {
        try {
            var f = new File(Folder.desktop.fsName + '/뉴턴_지면합성_결과.txt');
            f.encoding = 'UTF-8'; f.open('w'); f.write(L.join('\r\n')); f.close();
        } catch (e) {}
    }

    log('=== 뉴턴 지면 합성 (러닝·농구 공용) ===');
    try { log('AE ' + app.version); } catch (e) {}

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { log('✗ 활성 컴프 없음 — 컴프를 열고 다시 실행'); save(); return; }
    log('컴프 "' + comp.name + '" ' + comp.width + '×' + comp.height);

    var sel = comp.selectedLayers;
    if (!sel.length) { log('✗ 선택 레이어 없음 — UI 레이어를 클릭하고 다시 실행'); save(); return; }

    // NDC → 컴프 px. 수직 화각(60°)은 유지하고 가로만 종횡비 차이로 보정한다.
    var compAspect = comp.width / comp.height;
    var ax = SIM_ASPECT / compAspect;
    log('컴프 종횡비 ' + compAspect.toFixed(4) + ' · 가로 보정 ×' + ax.toFixed(4));
    function P(n) { return [(n[0] * ax + 1) / 2 * comp.width, (1 - n[1]) / 2 * comp.height]; }

    var TL = P(NDC.TL), TR = P(NDC.TR), BL = P(NDC.BL), BR = P(NDC.BR);
    log('핀(컴프px)  먼쪽   ' + Math.round(TL[0]) + ',' + Math.round(TL[1]) +
        '   ' + Math.round(TR[0]) + ',' + Math.round(TR[1]));
    log('           가까운쪽 ' + Math.round(BL[0]) + ',' + Math.round(BL[1]) +
        '   ' + Math.round(BR[0]) + ',' + Math.round(BR[1]));

    app.beginUndoGroup('뉴턴 지면 합성');

    for (var i = 0; i < sel.length; i++) {
        var Lay = sel[i];
        var w = Lay.source ? Lay.source.width : comp.width;
        var h = Lay.source ? Lay.source.height : comp.height;
        log('레이어 "' + Lay.name + '" 소스 ' + w + '×' + h);
        try {
            Lay.threeDLayer = false;
            var tg = Lay.property('ADBE Transform Group');
            tg.property('ADBE Anchor Point').setValue([w / 2, h / 2]);
            tg.property('ADBE Position').setValue([w / 2, h / 2]);
            tg.property('ADBE Scale').setValue([100, 100]);
            tg.property('ADBE Rotate Z').setValue(0);
            tg.property('ADBE Opacity').setValue(100);

            var par = Lay.property('ADBE Effect Parade');
            for (var d = par.numProperties; d >= 1; d--)
                if (par.property(d).matchName === 'ADBE Corner Pin') par.property(d).remove();

            var cp = par.addProperty('ADBE Corner Pin');
            cp.property('ADBE Corner Pin-0001').setValue(TL);
            cp.property('ADBE Corner Pin-0002').setValue(TR);
            cp.property('ADBE Corner Pin-0003').setValue(BL);
            cp.property('ADBE Corner Pin-0004').setValue(BR);
            log('  ✓ 코너핀 적용 · 되읽기 ' + cp.property('ADBE Corner Pin-0001').value.toString() +
                ' / ' + cp.property('ADBE Corner Pin-0004').value.toString());
        } catch (e) {
            log('  ✗ 오류: ' + e + (e.line ? ' (line ' + e.line + ')' : ''));
        }
    }

    app.endUndoGroup();
    save();
})();
