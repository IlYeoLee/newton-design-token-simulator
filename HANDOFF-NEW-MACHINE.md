# 새 기계 인수인계 — 클로드가 이 문서 하나로 다시 시작한다 (2026-08-18 작성)

> 노트북 반납으로 로컬이 사라졌다. 이 문서 + 백업 브랜치 + 드라이브 폴더가 전부다.
> 새 기계에서 클로드를 열면 이 문서를 먼저 읽힌 뒤 일을 시작할 것.

## 0. 프로젝트가 무엇인가
- **뉴턴 시뮬레이터**: 전시 키오스크 웹앱. 빔프로젝터로 바닥·벽에 훈련 UI를 쏘는
  가상 코치 시뮬레이션(복싱·러닝·농구). 라이브:
  https://ilyeolee.github.io/newton-design-token-simulator/
- **뉴턴 UX북**: 제품 설명 웹북. GitHub Pages 배포(newton-uxbook).
- **열화상(person-aura-filter)**: 크로마키 이미지 열화상 필터 랩(별도 앱, 5173).

## 1. 새 기계 셋업 순서 (그대로 따라 하면 됨)
1. 리포 클론 (모두 github.com/IlYeoLee):
   `newton-design-token-simulator`(작업 브랜치: merge-trial 또는 CLAUDE.md 의 정본 브랜치 확인),
   `newton-uxbook`, `person-aura-filter`
2. **클로드 메모리 복원** — 시뮬 리포 `backup/local-only-2026-08-17` 브랜치의
   `_backup/claude-memory/*` 를 `C:\Users\<계정>\.claude\projects\<프로젝트키>\memory\` 로 복사.
   이걸 해야 클로드가 이 프로젝트의 규칙·함정·정본 위치를 전부 기억한 채 시작한다.
3. 같은 브랜치에서 로컬 전용 자산 복원:
   - `_backup/bg-oversize/*` → `복원방법.txt`대로 합쳐 `public/_bg/` 에 (95MB 초과 배경 2개)
   - `public/_bg` 의 나머지(≤95MB)는 gh-pages 브랜치에서 회수
   - `_backup/뉴턴_LUT` → 원하는 위치(원래 Documents\뉴턴_LUT)
   - `_backup/ae-scripts/*` → 에펙 Scripts 폴더(문서\Adobe\After Effects <버전>\Scripts)
   - `scripts/_probe_*.mjs` = 계측 도구(이미 merge-trial 에 커밋됨)
4. `npm i` → `npx vite --port 5199` (유저는 항상 5199 로 본다)
5. 배포 절차·작업 규칙은 **CLAUDE.md**(리포 루트)가 정본 — 특히:
   rsync --delete 금지 · gh-pages 워크트리 · >95MB 배포 제외 · 커밋 메시지에 근거 쓰기
6. UX북 브랜치: main(배포) · lanyard-3d · figma-ko-en-sync(피그마 한영 원고 이식 작업분)

## 2. 대용량 자산은 구글드라이브
드라이브(star1004da@gmail.com) `뉴턴_반납백업_2026-08-17` 폴더.
상세 지도 = 폴더 안 **「뉴턴 백업 최종 지도 v2」** 문서. 요약:
- 컨셉영상 본편: `뉴턴_AE_최종/09_시뮬레이터_1인칭` (조립설명.txt 포함)
- 에펙 재편집: `에펙_프로젝트/` — 컷편집 aep 3개(최신) + *_최신 푸티지 폴더 +
  Desktop_루트_aep(농구.aep 등 21개) + 자동저장 + `에펙_스크립트_전체`(자막 템플릿 25종)
- READY 렌더 최종: `뉴턴_READY_최종_2K`
- 스테이징: 클로드 메모리 사본·LUT·bg 원본·UX북 원본(깃과 이중화)

## 3. 반납 시점의 프로젝트 상태 (2026-08-18)
- 시뮬 라이브 = merge-trial 872ed1d 계열 배포(main-aUi6rdNR 이후). 어트랙트 =
  복싱 BX_READY 라이브 대기, 20초 무터치 자동 복귀, 랩 진입 시 정본 리셋(?fresh=1),
  '뉴턴이 이렇게 생긴 이유' 읽기 페이지(근거 9섹션 + 고정 목차 + 스크롤 리빌),
  BK_C2 = 스텝백→진짜 슛(공이 골대로) ×3 (클립 = cmu_dribble_shot 창 [1.9,4.5]).
- 병렬 세션 정본 브랜치: b2-slip-clip-rebuild (CLAUDE.md 참조). merge-trial 과
  상호 머지된 상태였음 — 시작 전 `git log --oneline -30` 으로 최신 정본 확인할 것.
- **미결 항목**: ① BK_C2 '걸어 들어가며' 도입부(클립 루트모션 이식 필요)
  ② 농구 B2 따라하기 1인칭 전환의 자연 흐름 E2E 재검증
  ③ 일레븐랩스 키는 반납 때 로테이션 권장했음 — 새 키 발급 후
     `ELEVENLABS_API_KEY=... node scripts/gen_voice.mjs --only <파일명>` 으로 재생성 가능
     (대사 원문은 session.js 리터럴에서 자동 추출)

## 4. 계정·서비스
- GitHub: IlYeoLee / 드라이브·문서: star1004da@gmail.com
- 피그마 근거 보드 원본: 파일키 MsAnO7Itu9sORPSZBt0oRj (30:2 어펜딕스 5장),
  UX북 한영 원고: 메모리 newton-uxbook-figma-source 참조
- 일레븐랩스: 보이스 매핑은 scripts/gen_voice.mjs 상단(션/커리/고수 voice_id)
