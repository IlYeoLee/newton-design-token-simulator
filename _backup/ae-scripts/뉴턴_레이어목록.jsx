// 진단 — 컴프의 모든 레이어와 붙은 이펙트를 통째로 파일로 뽑는다.
//   ★ alert 를 쓰지 않는다. AE 알림창이 메인 창 뒤로 깔려 클릭이 안 먹는 일이 있었다
//     (08-05: '멈춘 것처럼 보였는데 실은 Script Alert 가 모달로 대기 중'이었다).
//   결과: 바탕화면 뉴턴_레이어목록.txt — 다 돌면 그 파일이 새로 생긴다.
(function () {
    var out = [];

    out.push('=== 프로젝트 아이템 ===');
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        var kind = (it instanceof CompItem) ? 'COMP' : (it instanceof FootageItem) ? 'FOOT' : 'FOLD';
        var file = '';
        try { if (it.mainSource && it.mainSource.file) file = it.mainSource.file.fsName; } catch (e) {}
        out.push(kind + ' | ' + it.name + (file ? '  <- ' + file : ''));
    }

    out.push('');
    out.push('=== 컴프별 레이어 (위 = 앞) ===');
    for (var c = 1; c <= app.project.numItems; c++) {
        var comp = app.project.item(c);
        if (!(comp instanceof CompItem)) continue;
        out.push('');
        out.push('[COMP] ' + comp.name + '  ' + comp.width + 'x' + comp.height +
                 '  ' + comp.frameRate.toFixed(2) + 'fps  layers=' + comp.numLayers);
        for (var L = 1; L <= comp.numLayers; L++) {
            var lay = comp.layer(L), src = '', srcName = '';
            try {
                if (lay.source) {
                    srcName = lay.source.name;
                    if (lay.source.mainSource && lay.source.mainSource.file)
                        src = lay.source.mainSource.file.name;
                }
            } catch (e) {}
            var op = '';
            try { op = lay.opacity ? lay.opacity.value : ''; } catch (e) {}
            out.push('  ' + L + '. ' + lay.name +
                     ' | src=' + srcName + ' | file=' + (src || '-') +
                     ' | adj=' + (lay.adjustmentLayer ? 'Y' : 'N') +
                     ' | blend=' + lay.blendingMode +
                     ' | on=' + lay.enabled + ' | opacity=' + op);
            var fx = lay.property('ADBE Effect Parade');
            if (fx && fx.numProperties) {
                for (var e2 = 1; e2 <= fx.numProperties; e2++) {
                    var ef = fx.property(e2);
                    var vals = [];
                    for (var p = 1; p <= ef.numProperties; p++) {
                        var pr = ef.property(p), v = '';
                        try { v = String(pr.value); } catch (err) { v = '?'; }
                        if (v.length < 40) vals.push(pr.name + '=' + v);
                    }
                    out.push('       fx: ' + ef.name + ' [' + ef.matchName + '] on=' + ef.enabled +
                             '  ' + vals.join(' · '));
                }
            }
        }
    }

    var f = new File('C:/Users/user/Desktop/뉴턴_레이어목록.txt');
    f.encoding = 'UTF-8'; f.open('w'); f.write(out.join('\n')); f.close();
    // 알림 대신 프로젝트 패널 상태로 끝난 걸 알 수 있게 — 파일이 생기면 완료다.
})();
