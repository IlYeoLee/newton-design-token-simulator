---
name: newton-uxbook-deploy
description: 뉴턴 UX북 배포는 푸시만으로 안 올라간다 — Pages 빌드를 직접 걸고 라이브를 읽어 확인해야 한다
metadata: 
  node_type: memory
  type: project
  originSessionId: 9b3e5631-d6ed-4097-9451-26aa329e9915
  modified: 2026-08-09T16:21:43.321Z
---

`IlYeoLee/newton-uxbook` 은 GitHub Pages(main 루트) → https://ilyeolee.github.io/newton-uxbook/

**푸시했다고 배포된 게 아니다.** Pages 가 푸시 뒤 빌드를 스스로 안 도는 일이 잦다(짧은 시간에 여러 번 푸시하면 특히). 2026-08-09 세션에서 10여 번의 푸시가 전부 빌드 없이 묻혀, 유저는 몇 시간 전 화면을 보며 "아직 안 된다"고 말하고 있었다.

```
git push origin main lanyard-3d
gh api -X POST repos/IlYeoLee/newton-uxbook/pages/builds --jq '.status'
gh api repos/IlYeoLee/newton-uxbook/pages/builds/latest --jq '.status, .commit'
curl -s https://ilyeolee.github.io/newton-uxbook/index.html | grep -c '방금 넣은 문자열'
```

빌드 완료를 기다리고 **라이브에서 직접 읽어 확인한 뒤에만** "배포했다"고 말한다.

에셋(번들·사진·영상)은 이름이 안 바뀌므로 브라우저가 옛 파일을 계속 썼다. 지금은 `build.py` 가 index.html 을 쓰기 직전에 모든 `assets/…` 주소에 수정시각·크기 도장을 붙인다(`?v=1a2b3c4d`). 손으로 `?v=` 를 붙일 일이 없어야 정상이다.

`main` 과 `lanyard-3d` 는 같은 지점을 가리키게 유지한다(따로 두면 번들에서 충돌). 관련 [[newton-uxbook-figma-source]]
