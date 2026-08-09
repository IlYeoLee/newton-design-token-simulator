@echo off
REM ── 전시용 실행 ────────────────────────────────────────────────────────────
REM  브라우저는 사용자가 화면을 한 번 건드리기 전엔 소리를 막는다(자동재생 정책).
REM  전시장처럼 **아무도 안 만지는 상태로 틀어 두는** 환경에서는 첫 화면 대사가
REM  통째로 안 들린다 — 이건 코드로 못 뚫는다. 정책 자체를 끈 크롬으로 띄운다.
REM
REM  ★ --user-data-dir 이 반드시 있어야 한다. 크롬이 이미 떠 있으면 새 인자는
REM    무시되고 기존 프로세스에 탭만 하나 열린다(= 정책이 그대로 살아 있다).
REM    별도 프로필로 띄워야 이 인자가 실제로 먹는다.
REM
REM  사용: 이 파일을 더블클릭. 종료는 Alt+F4.
REM  로컬 개발서버를 띄우려면 아래 URL 을 http://127.0.0.1:5199/ 로 바꾼다.

set URL=https://ilyeolee.github.io/newton-design-token-simulator/

start "" chrome.exe ^
  --autoplay-policy=no-user-gesture-required ^
  --kiosk ^
  --start-fullscreen ^
  --disable-session-crashed-bubble ^
  --disable-infobars ^
  --noerrdialogs ^
  --user-data-dir="%TEMP%\newton-kiosk" ^
  "%URL%"
