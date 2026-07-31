// ─────────────────────────────────────────────────────────────
// 내보낸 투사 영상을 에펙에 얹는다 — out/ 의 ProRes 4444(.mov)를 전부 임포트해 컴프를 만든다.
//
//   에펙에서: 파일 > 스크립트 > 스크립트 파일 실행… > 이 파일
//   현재 열려 있는 프로젝트에 폴더 하나(newton)만 추가한다. 기존 컴프는 안 건드린다.
//
//   두 종류가 들어온다 — 파일 이름으로 구분해 다르게 세팅한다.
//   ① _alpha  : 투사광만 · 배경 투명. 알파는 Straight(렌더러가 premultipliedAlpha:false).
//              투사는 '쏘는 빛'이라 레이어 블렌딩을 Add 로 둔다 — 실사 위에 얹는 정석.
//              Normal 로 두면 빛이 배경을 가려 뿌옇게 보인다(이게 '색이 죽어 보이던' 원인).
//   ② 그 외   : 무대·색감 전부 들어 있는 '화면 그대로'. 알파가 없으므로 Normal.
// ─────────────────────────────────────────────────────────────
(function () {
  var root = new File($.fileName).parent.parent;              // scripts/ 의 부모 = 리포 루트
  var dirs = ['/out/preview5s', '/out/asis', '/out'];
  var files = [], seen = {};
  for (var d = 0; d < dirs.length; d++) {
    var f = new Folder(root.fsName + dirs[d]);
    if (!f.exists) continue;
    var got = f.getFiles('*.mov');
    for (var g = 0; g < got.length; g++) {
      if (seen[got[g].name]) continue;                        // out/ 하위 중복 방지
      seen[got[g].name] = 1; files.push(got[g]);
    }
  }
  if (!files.length) { alert('out/ 에 .mov 가 없습니다.\n먼저 export_video.mjs 를 돌리세요.'); return; }

  app.beginUndoGroup('newton 투사 영상 임포트');
  var bin = app.project.items.addFolder('newton (' + files.length + ')');
  var lines = [];
  for (var i = 0; i < files.length; i++) {
    var hasAlpha = /_alpha/.test(files[i].name);
    var fo = app.project.importFile(new ImportOptions(files[i]));
    fo.parentFolder = bin;
    // 알파 해석 — 자동 추측에 맡기면 Premultiplied 로 잡혀 가산광 가장자리가 검게 먹는다.
    if (hasAlpha) { try { fo.mainSource.alphaMode = AlphaMode.STRAIGHT; } catch (e) {} }

    var comp = app.project.items.addComp(
      fo.name.replace(/\.mov$/i, ''), fo.width, fo.height,
      fo.pixelAspect, fo.duration, (1 / fo.frameDuration));
    comp.parentFolder = bin;
    comp.bgColor = [0, 0, 0];                                 // 가산광은 검정 위에서 제 색이 나온다
    var lyr = comp.layers.add(fo);
    lyr.blendingMode = hasAlpha ? BlendingMode.ADD : BlendingMode.NORMAL;
    lines.push((hasAlpha ? '[투명·Add] ' : '[그대로·Normal] ') + comp.name);
    if (i === 0) comp.openInViewer();
  }
  app.endUndoGroup();
  alert('컴프 ' + files.length + '개 — 프로젝트 패널 "' + bin.name + '" 폴더\n\n'
      + lines.join('\n')
      + '\n\n· _alpha = 투사광만 + 투명 배경, 알파 Straight, 블렌딩 Add\n'
      + '· 그 외  = 무대·색감 그대로, 블렌딩 Normal\n'
      + '가산광은 검정 배경 위에서 화면과 같은 색이 나옵니다.');
})();
