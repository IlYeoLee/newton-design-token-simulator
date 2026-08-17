// 뉴턴 — 9 · 8 · 7 카운트다운 모션
//
//   ── 두 가지로 동작한다 ─────────────────────────────────────────────────────
//     · 텍스트 레이어를 **선택하고** 실행 → 그 레이어들에 모션만 건다.
//       글자·폰트·크기는 손대지 않는다. 선택한 순서(위→아래)대로 9, 8, 7 자리를 준다.
//     · **아무것도 선택하지 않고** 실행 → Supreme 으로 9·8·7 텍스트 레이어 3장을
//       컴프 한가운데 만들고 모션까지 건다.
//
//   시작 시각은 **현재 시간 표시기 위치**다. 거기서부터 HOLD 초씩 이어 붙는다.
//
//   ★ 모션은 스케일 팝 + 페이드뿐이다. 블러·글로우·회전은 넣지 않았다 — 필요하면 직접.
//   ★ 값은 전부 아래 상수다. 숫자를 3·2·1 로 바꾸려면 NUMS 만 고치면 된다.
//   ★ 한국어판이라 프로퍼티는 matchName 으로 잡는다.
//   ★ alert 를 쓰지 않는다(AE 알림창이 메인 창 뒤로 깔린다). 결과는 바탕화면
//     '카운트다운_결과.txt'.

(function () {
    var NUMS       = ['9', '8', '7'];
    var FONT       = 'Supreme-Medium';   // Supreme-Regular / Medium / Bold / Extrabold ...
    var SIZE_RATIO = 0.20;               // 새로 만들 때 글자 크기 = 컴프 높이 × 이 비율
    var COLOR      = [1, 1, 1];          // 새로 만들 때 글자색

    var HOLD       = 1.0;                // 숫자 하나가 화면에 있는 시간(초)
    var IN_T       = 0.18;               // 등장에 쓰는 시간
    var OUT_T      = 0.22;               // 퇴장에 쓰는 시간
    var IN_SCALE   = 130;                // 등장 시작 크기 %
    var OUT_SCALE  = 88;                 // 퇴장 끝 크기 %
    var CENTER_ANCHOR = true;            // 앵커를 글자 한가운데로 옮긴다(자리는 유지). 팝이 중심에서 커지게

    var L = [];
    function log(s) { L.push(String(s)); }
    function save() {
        try {
            var f = new File(Folder.desktop.fsName + '/카운트다운_결과.txt');
            f.encoding = 'UTF-8'; f.open('w'); f.write(L.join('\r\n')); f.close();
        } catch (e) {}
    }
    function r2(n) { return Math.round(n * 100) / 100; }

    log('=== 카운트다운 ' + NUMS.join(' · ') + ' · ' + FONT + ' ===');
    try { log('AE ' + app.version); } catch (e) {}

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { log('✗ 활성 컴프 없음 — 컴프를 열고 다시 실행'); save(); return; }
    log('컴프 "' + comp.name + '" ' + comp.width + '×' + comp.height + ' · ' + comp.frameRate.toFixed(3) + 'fps');

    var START = comp.time;
    log('시작 ' + r2(START) + 's · 숫자당 ' + HOLD + 's · 전체 ' + r2(NUMS.length * HOLD) + 's');

    // ── 이징 ────────────────────────────────────────────────────────────────
    function ease(prop, idx, inInf, outInf, dim) {
        var ei = [], eo = [];
        for (var d = 0; d < dim; d++) { ei.push(new KeyframeEase(0, inInf)); eo.push(new KeyframeEase(0, outInf)); }
        try {
            prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            prop.setTemporalEaseAtKey(idx, ei, eo);
        } catch (e) { log('    · 이징 실패(키 ' + idx + '): ' + e); }
    }

    // ── 모션 걸기 ───────────────────────────────────────────────────────────
    function motion(Lay, t0) {
        var tg = Lay.property('ADBE Transform Group');
        var Sc = tg.property('ADBE Scale'), Op = tg.property('ADBE Opacity');
        var t1 = t0 + IN_T, t2 = t0 + HOLD - OUT_T, t3 = t0 + HOLD;
        if (t2 < t1) { t2 = (t1 + t3) / 2; log('    ⚠ HOLD 가 짧아 유지 구간이 없다'); }

        // 기존 키 정리 (이 레이어의 스케일·불투명도만)
        while (Sc.numKeys > 0) Sc.removeKey(1);
        while (Op.numKeys > 0) Op.removeKey(1);

        var base = Sc.value;                     // 원래 크기를 100% 로 보고 배율을 곱한다
        function sc(p) { return [base[0] * p / 100, base[1] * p / 100]; }

        Sc.setValueAtTime(t0, sc(IN_SCALE));
        Sc.setValueAtTime(t1, sc(100));
        Sc.setValueAtTime(t2, sc(100));
        Sc.setValueAtTime(t3, sc(OUT_SCALE));
        Op.setValueAtTime(t0, 0);
        Op.setValueAtTime(t1, 100);
        Op.setValueAtTime(t2, 100);
        Op.setValueAtTime(t3, 0);

        ease(Sc, 1, 0, 85, 2); ease(Sc, 2, 85, 0, 2); ease(Sc, 3, 0, 0, 2); ease(Sc, 4, 75, 0, 2);
        ease(Op, 1, 0, 70, 1); ease(Op, 2, 70, 0, 1); ease(Op, 3, 0, 0, 1); ease(Op, 4, 60, 0, 1);

        Lay.inPoint  = t0;
        Lay.outPoint = t3;
        log('    ' + r2(t0) + 's ~ ' + r2(t3) + 's · 키 스케일 ' + Sc.numKeys + ' 불투명도 ' + Op.numKeys);
    }

    function centerAnchor(Lay) {
        if (!CENTER_ANCHOR) return;
        var tg = Lay.property('ADBE Transform Group');
        var A = tg.property('ADBE Anchor Point'), P = tg.property('ADBE Position');
        if (A.numKeys || P.numKeys) { log('    ⚠ 앵커/위치에 키가 있어 중앙 정렬을 건너뜀'); return; }
        var rz = tg.property('ADBE Rotate Z').value;
        if (Math.abs(rz) > 0.01) { log('    ⚠ Z회전 ' + rz + '° — 중앙 정렬이 어긋날 수 있다'); }
        var rc = Lay.sourceRectAtTime(comp.time, false);
        var a0 = A.value, sc = tg.property('ADBE Scale').value, p0 = P.value;
        var a1 = [rc.left + rc.width / 2, rc.top + rc.height / 2];
        A.setValue(a1);
        P.setValue([p0[0] + (a1[0] - a0[0]) * sc[0] / 100,
                    p0[1] + (a1[1] - a0[1]) * sc[1] / 100]);
    }

    app.beginUndoGroup('카운트다운 ' + NUMS.join(''));

    var sel = comp.selectedLayers;

    if (sel.length) {
        // ── 선택한 레이어에 모션만 ──────────────────────────────────────────
        var ord = sel.slice(0).sort(function (a, b) { return a.index - b.index; });   // 위에 있는 것부터
        log('선택 ' + ord.length + '장 — 모션만 건다 (글자·폰트는 안 건드림)');
        for (var i = 0; i < ord.length; i++) {
            var Lay = ord[i];
            log('  "' + Lay.name + '"');
            try {
                centerAnchor(Lay);
                motion(Lay, START + i * HOLD);
            } catch (e) { log('    ✗ 오류: ' + e + (e.line ? ' (line ' + e.line + ')' : '')); }
        }
        if (ord.length !== NUMS.length)
            log('· 선택 ' + ord.length + '장 / 숫자 ' + NUMS.length + '개 — 선택한 장수만큼만 이어 붙였다');
    } else {
        // ── 새로 만들기 ────────────────────────────────────────────────────
        var size = Math.round(comp.height * SIZE_RATIO);
        log('선택 없음 — ' + FONT + ' ' + size + 'px 로 ' + NUMS.length + '장 새로 만든다');
        for (var k = NUMS.length - 1; k >= 0; k--) {          // 뒤부터 만들어 9 가 맨 위에 오게
            try {
                var T = comp.layers.addText(NUMS[k]);
                T.name = '카운트 ' + NUMS[k];
                var tp = T.property('ADBE Text Properties').property('ADBE Text Document');
                var doc = tp.value;
                doc.font = FONT;
                doc.fontSize = size;
                doc.applyFill = true; doc.fillColor = COLOR; doc.applyStroke = false;
                try { doc.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (e) {}
                tp.setValue(doc);
                var got = tp.value.font;
                log('  "' + T.name + '" 폰트 되읽기 "' + got + '"' + (got === FONT ? '' : '  ⚠ 요청과 다르다 — 폰트가 없을 수 있다'));

                T.property('ADBE Transform Group').property('ADBE Position').setValue([comp.width / 2, comp.height / 2]);
                centerAnchor(T);
                motion(T, START + k * HOLD);
            } catch (e) { log('  ✗ "' + NUMS[k] + '" 오류: ' + e + (e.line ? ' (line ' + e.line + ')' : '')); }
        }
    }

    app.endUndoGroup();
    save();
})();
