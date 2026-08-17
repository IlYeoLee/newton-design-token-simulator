---
name: explorer-hang-adobe-coresync
description: 탐색기가 모든 폴더에서 모래시계로 영영 멈추면 범인은 Adobe CoreSync 셸 확장
metadata: 
  node_type: memory
  type: project
  originSessionId: 6d71e26d-0225-41f1-b717-309a00c8b439
  modified: 2026-08-08T01:37:10.436Z
---

유저 PC(Windows 10)에서 탐색기가 **모든 폴더**에서 모래시계로 멈추고 영영 안 풀리는 증상 = **Adobe Creative Cloud 의 CoreSync 셸 확장**이 원인. 2026-08-08 확인.

`C:\Program Files (x86)\Common Files\Adobe\CoreSyncExtension\CoreSync_x64.dll` 가 아이콘 오버레이 3개(`   AccExtIco1~3`, 키 이름 앞 공백 3칸으로 오버레이 15개 제한 큐 앞자리 선점) + 컨텍스트 메뉴 핸들러(`AccExt`, `*` 와 `Folder` 두 곳)로 등록돼 있다. 탐색기가 폴더 뷰를 그릴 때마다 동기 호출되어 블록된다.

**진단 포인트:** 파일 목록 열거(Shell.NameSpace)는 100ms 이하로 멀쩡한데 화면 전환만 멈추면 열거가 아니라 뷰 렌더링 단계 = 오버레이/컨텍스트 핸들러 의심. `Get-ChildItem HKLM:\SOFTWARE\Classes\*\shellex\...` 는 `*` 가 와일드카드로 잡혀 전체 순회하니 `-LiteralPath` 필수.

**즉시 완화(권한 불필요):** `CoreSync`, `CCXProcess`, `Creative Cloud Helper` 프로세스 kill 후 explorer 재시작.

**영구 조치(관리자 필요):** 레지스트리 키 이름 앞에 `-` 붙여 비활성화. 스크립트 `fix-explorer-hang.ps1` (`-Undo` 로 복구). Adobe CC 업데이트하면 재등록되어 **재발한다**.

관련: [[dont-over-build]] — 처음에 갓 클론한 저장소 폴더 탓으로 잘못 좁혔다가 한 턴 날렸다. "로컬에서 폴더가 안 된다"는 시스템 전역 문제일 수 있으니 범위부터 확인할 것.
