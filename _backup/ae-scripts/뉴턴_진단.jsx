// 진단 2 — 레이어의 **마스크·트랜스폼·소스 해석·프로젝트 색 설정**까지 전부 뽑는다.
//   1차 진단은 이펙트만 봤다. 마스크는 이펙트 목록에 안 들어가서 놓쳤다(08-05).
//   ★ alert 안 쓴다 — AE 알림창이 메인 창 뒤로 깔려 클릭이 안 먹는 일이 있었다.
//   결과: 바탕화면 뉴턴_진단결과.txt (덮어씀)
(function () {
    var o = [];
    function L(s) { o.push(s); }

    L('=== 프로젝트 ===');
    try {
        L('  비트depth = ' + app.project.bitsPerChannel);
        L('  선형 블렌딩 = ' + app.project.linearBlending);
        L('  작업 색공간 = ' + (app.project.workingSpace || '(없음)'));
        L('  색 관리 = ' + (app.project.colorManagementEnabled !== undefined ? app.project.colorManagementEnabled : '?'));
    } catch (e) { L('  (읽기 실패) ' + e); }

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        for (var i = 1; i <= app.project.numItems; i++)
            if (app.project.item(i) instanceof CompItem) { comp = app.project.item(i); break; }
    }
    if (!(comp instanceof CompItem)) {
        var g = new File('C:/Users/user/Desktop/뉴턴_진단결과.txt');
        g.encoding = 'UTF-8'; g.open('w'); g.write('컴프를 못 찾았습니다.'); g.close(); return;
    }

    L('');
    L('=== 컴프 ===');
    L('  ' + comp.name + '  ' + comp.width + 'x' + comp.height +
      '  ' + comp.frameRate.toFixed(3) + 'fps  ' + comp.duration.toFixed(2) + 's' +
      '  픽셀종횡비=' + comp.pixelAspect + '  해상도=' + comp.resolutionFactor.join('/'));

    for (var n = 1; n <= comp.numLayers; n++) {
        var lay = comp.layer(n);
        L('');
        L('[' + n + '] ' + lay.name + '   on=' + lay.enabled + '  adj=' + (lay.adjustmentLayer ? 'Y' : 'N') +
          '  blend=' + lay.blendingMode + '  3D=' + lay.threeDLayer);

        // 소스 해석
        try {
            if (lay.source) {
                var s = lay.source;
                L('    소스: ' + s.name + '  ' + s.width + 'x' + s.height +
                  '  픽셀종횡비=' + s.pixelAspect +
                  (s.frameRate ? '  ' + s.frameRate.toFixed(3) + 'fps' : '') +
                  '  알파=' + (s.mainSource && s.mainSource.alphaMode !== undefined ? s.mainSource.alphaMode : '?'));
                if (s.mainSource && s.mainSource.file) L('    파일: ' + s.mainSource.file.fsName);
            }
        } catch (e) { L('    (소스 읽기 실패) ' + e); }

        // 트랜스폼 — 코너핀 좌표가 컴프 좌표와 맞으려면 여기가 정규화돼 있어야 한다
        try {
            var tg = lay.property('ADBE Transform Group');
            var names = [['ADBE Anchor Point', '앵커'], ['ADBE Position', '위치'],
                         ['ADBE Scale', '크기'], ['ADBE Rotate Z', '회전'], ['ADBE Opacity', '불투명도']];
            var ts = [];
            for (var t = 0; t < names.length; t++) {
                var pp = tg.property(names[t][0]);
                if (pp) ts.push(names[t][1] + '=' + String(pp.value) + (pp.numKeys ? '(키' + pp.numKeys + ')' : ''));
            }
            L('    변형: ' + ts.join('  '));
        } catch (e) { L('    (변형 읽기 실패) ' + e); }

        // ★ 마스크 — 1차 진단이 놓친 부분
        try {
            var mk = lay.property('ADBE Mask Parade');
            if (!mk || mk.numProperties === 0) L('    마스크: 없음');
            else {
                L('    마스크 ' + mk.numProperties + '개');
                for (var m = 1; m <= mk.numProperties; m++) {
                    var M = mk.property(m);
                    var fe = '', ex = '', op = '';
                    try { fe = String(M.property('ADBE Mask Feather').value); } catch (e2) {}
                    try { ex = String(M.property('ADBE Mask Offset').value); } catch (e2) {}
                    try { op = String(M.property('ADBE Mask Opacity').value); } catch (e2) {}
                    var pts = '';
                    try {
                        var sh = M.property('ADBE Mask Shape').value;
                        pts = sh.vertices.length + '점  ' +
                              sh.vertices.map(function (v) { return '(' + Math.round(v[0]) + ',' + Math.round(v[1]) + ')'; }).join(' ');
                    } catch (e2) { pts = '(모양 읽기 실패)'; }
                    L('      ' + m + '. ' + M.name + '  모드=' + M.maskMode + '  반전=' + M.inverted +
                      '  페더=' + fe + '  확장=' + ex + '  불투명도=' + op);
                    L('         ' + pts);
                }
            }
        } catch (e) { L('    (마스크 읽기 실패) ' + e); }

        // 이펙트
        try {
            var fx = lay.property('ADBE Effect Parade');
            if (!fx || fx.numProperties === 0) L('    이펙트: 없음');
            else for (var e3 = 1; e3 <= fx.numProperties; e3++) {
                var ef = fx.property(e3), vs = [];
                for (var p = 1; p <= ef.numProperties; p++) {
                    var pr = ef.property(p), v = '';
                    try { v = String(pr.value); } catch (err) { v = '?'; }
                    if (v.length < 46) vs.push(pr.name + '=' + v + (pr.numKeys ? '(키' + pr.numKeys + ')' : ''));
                }
                L('    fx: ' + ef.name + ' [' + ef.matchName + '] on=' + ef.enabled + '  ' + vs.join(' · '));
            }
        } catch (e) { L('    (이펙트 읽기 실패) ' + e); }
    }

    var f = new File('C:/Users/user/Desktop/뉴턴_진단결과.txt');
    f.encoding = 'UTF-8'; f.open('w'); f.write(o.join('\n')); f.close();
})();
