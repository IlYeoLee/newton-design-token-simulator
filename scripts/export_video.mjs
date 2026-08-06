// ─────────────────────────────────────────────────────────────
// 초고화질 영상 내보내기 — 실사 합성용
//
//   화면 녹화를 쓰지 않는 이유: rAF 가 실시간에 묶여 프레임이 빠지고(이 프로젝트에서
//   반복 확인됨), 모니터 해상도에 갇히고, 녹화 코덱이 한 번 더 압축한다.
//   대신 시계를 우리가 밀면서 한 프레임씩 렌더한다 → 드롭 0 · 4K 자유 · 무손실.
//
//   PNG 는 최종물이 아니라 중간 단계다. ffmpeg 가 바로 영상으로 묶는다.
//
//   사용:
//     node scripts/export_video.mjs --sport running --dur 3 --fps 30 --w 2560
//     node scripts/export_video.mjs --sport boxing --dur 5 --fps 60 --w 3840 --beam
//     node scripts/export_video.mjs --sport boxing --flat --dur 6 --fps 60 --w 2600   ← 정면 직교
//
//   옵션
//     --sport  running|boxing|basketball   기본 running
//     --dur    초 (기본 3)     --fps 기본 30      --w 가로 px (기본 2560, 16:9)
//     --flat   원근 없는 정면 직교 뷰. 카메라를 투사면 법선에 정렬한다.
//              2D 캔버스만 뽑는 export_ui.mjs 와 달리 판정 토큰(3D 셰이더 메시)이 들어온다.
//              화면비는 투사면 대지 비율(벽 2600x1600 · 지면 1600x2670) — 16:9 로 두면 늘어난다.
//     --ss     수퍼샘플링 배율 1~3 (기본: --flat 이면 2, 아니면 1).
//              N배로 렌더하고 영상만 줄인다 — 셰이더 가장자리·얇은 선의 계단이 여기서 죽는다.
//              PNG 시퀀스는 줄이지 않는다(에펙엔 원본을 주는 게 낫다).
//     --uiscale 대지 캔버스 배율. 기본은 '출력'의 1.5배(--flat 기준).
//              ⚠ 렌더 해상도(--ss 배)에 맞추지 말 것: 벽 기준 5200x3200 = 66MB 텍스처를 매 프레임
//              올리게 되고 블룸 타깃까지 겹쳐 74프레임에서 GPU 컨텍스트를 잃는다(실측).
//     --beam   투사광만 — 바닥·벽·봇·씬을 끄고 검은 배경. 에펙에서 Screen 으로 얹으면 된다.
//     --ht     하프톤 스킨 켜기
//     --alpha  배경 투명 (PNG/ProRes 4444). 기본은 검은 배경(가산 합성용)
//     --session  세션 시작(1인칭). 기본은 시작 화면(팩 타임라인)
//     --out    산출 경로 (기본 out/)
// ─────────────────────────────────────────────────────────────
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
};
// ★ --scene 을 주면 종목은 씬 id 에서 나온다. --sport 를 따로 안 줬을 때 기본 'running' 이
//   남아 있으면 복싱 씬을 러닝 팩으로 렌더하고 파일명까지 running 으로 나온다(실제로 겪음).
const SCENE_ID = String(arg('scene', '') || '');
const SPORT = arg('sport', /^BK_/.test(SCENE_ID) ? 'basketball' : /^BX_/.test(SCENE_ID) ? 'boxing' : 'running');
// ★ 씬 저장본 — scenes.html '이 씬 저장'이 쓴 값을 그대로 읽는다. 화면에서 맞춘 게 곧 녹화값이다.
//   CLI 플래그를 주면 그것이 이긴다(한 번만 다르게 뽑고 싶을 때). 'has' 로 **명시 여부**를 본다 —
//   arg() 는 기본값과 '안 준 것'을 구분 못 해서, 저장본이 항상 덮이는 사고가 난다.
const has = k => process.argv.includes(`--${k}`);
let PRESET = {};
if (SCENE_ID) {
  try { PRESET = JSON.parse(fs.readFileSync(path.join('public', '_presets.json'), 'utf8'))[SCENE_ID] || {}; }
  catch { /* 저장본 없음 — 전부 CLI/기본값 */ }
  if (Object.keys(PRESET).length) console.log(`  씬 저장본 적용: ${SCENE_ID} (public/_presets.json)`);
  // ★ 저장본이 없으면 **크게 알린다.** 예전엔 조용히 기본값으로 갔다 — 배경도 색보정도 카메라도
  //   없이 렌더가 끝나는데 아무 말이 없어서, 다 뽑고 나서야 안다. 이 리포가 반복해서 당한
  //   '조용한 실패' 계열이다(out/ 리로드·ss2 투명 프레임과 같은 종류).
  else console.log(`\n  ⚠ ${SCENE_ID} 의 씬 저장본이 없다 — 배경·색보정·카메라가 전부 **기본값**으로 간다.`
    + `\n    scenes.html 에서 '이 씬 저장'을 먼저 하거나, --bg 등을 직접 줄 것.\n`);
}
// 저장본 → CLI 순으로 고른다. 색 보정처럼 중첩된 값은 아래에서 따로 합친다.
const pick = (k, pk, d) => has(k) ? arg(k, d) : (PRESET[pk ?? k] ?? d);
const pickN = (k, pk, d) => { const v = pick(k, pk, d); const n = +v; return Number.isFinite(n) ? n : d; };
const DUR = +arg('dur', 3);
const FPS = +arg('fps', 30);
const W = +arg('w', 2560);
// ★ --flat : 원근 없는 정면 뷰. 카메라를 직교로 바꿔 투사면 법선에 정렬한다.
//   2D 캔버스만 뽑는 export_ui.mjs 와 달리 판정 토큰(3D 셰이더 메시, 면 앞 z −1.05~−1.43)이
//   그대로 들어온다. 화면비는 투사면 대지 비율을 따른다 — 16:9 로 두면 늘어난다.
const FLAT = !!arg('flat', false);
const FBASE = SPORT === 'boxing' ? [2600, 1600] : [1600, 2670];   // 벽 / 지면 대지 px
// 수퍼샘플링 — N배로 렌더하고 영상만 줄인다. 셰이더 가장자리·얇은 선의 계단이 여기서 죽는다.
// PNG 시퀀스는 줄이지 않는다(에펙에 원본을 주는 게 항상 낫다).
// ★ 4K(--w 3840) 에서는 ss 1 이어야 한다. ss 2 면 렌더면이 7680×4726 = 3600만 픽셀이라
//   GPU 메모리를 넘긴다 — 에러도 컨텍스트 손실도 없이 **전부 투명한 프레임**이 나온다(실측:
//   복싱 3840 ss2 프리플라이트 불투명 0.00%, ss1 로 내리면 49.5%). 08-02 에 인물 룩이
//   personAura 5중 합성으로 바뀌며 RT 가 늘어, 지면 2302 도 ss2 가 안 들어가게 됐다.
const SS = Math.min(3, Math.max(1, +arg('ss', FLAT ? (W >= 3000 ? 1 : 2) : 1)));
const H = FLAT ? Math.round(W * FBASE[1] / FBASE[0]) : Math.round(W * 9 / 16);
// --pad : 대지 바깥 여백 배율. 직교 절두체를 대지에 딱 맞추면 대지를 넘어가는 것이 화면
//   가장자리에서 **칼같이 잘린다** — 발자국 파동이 프레임 밖으로 퍼질 때 좌우가 잘려 보이던
//   원인(유저 신고). 1.15 면 사방에 7.5% 씩 여유가 생긴다. 대지의 픽셀 배율은 그대로 두고
//   출력 크기만 그만큼 키우므로 선예도는 변하지 않는다.
const PAD = Math.max(1, Math.min(2, +arg('pad', 1) || 1));
const WP = Math.round(W * PAD), HP = Math.round(H * PAD);   // 실제 출력(여백 포함)
const ALPHA0 = !!arg('alpha', false);   // 배경 투명 PNG/ProRes 4444
// ★ --alpha 는 --beam 을 함축한다. 알파를 휘도에서 뽑는 방식(scene.js FX.alphaOut)이라
//   무대(바닥·벽·봇)가 켜져 있으면 밝은 무대까지 불투명해진다 — 투명 매트가 안 나온다.
//   예전엔 알파 코드가 if(beam) 안에만 있어서 --alpha 단독은 조용히 검은 배경이 나왔다.
const BEAM = !!arg('beam', false) || ALPHA0;
const HT = !!arg('ht', false);
const SESSION = !!arg('session', false);
// ★ --stage — 세션은 READY 에서 '발 두 번 탭' 게이트를 기다린다. 헤드리스엔 그 입력이 없으므로
//   --session 만 주면 인트로 1.1초 재생 뒤 화면이 완전히 정지한다(실측: 러닝 5초 300프레임 중
//   69프레임째부터 231장이 바이트 단위로 동일). 판정 토큰은 애초에 READY 에 없다.
//   실전 스테이지로 바로 넣으려면 id 를 지정한다. --liststages 로 목록.
// --flatground : 평면 카메라를 판 메시가 아니라 **설계 좌표의 지면**에 세운다.
//   READY 처럼 판이 꺼져 있는 스테이지 전용(판 메시 행렬이 없어 카메라가 허공을 본다).
const FLATGROUND = !!arg('flatground', false);
const STAGE = arg('stage', '');
const LISTSTAGES = !!arg('liststages', false);
// --play : 시뮬을 실제로 돌린다(봇·물리). 스크럽으로 못 살리는 상태 누적형 화면용 — 위 루프 주석 참조.
const PLAY = !!arg('play', false);
// --pin : 합성용 '설계 그대로' 모드. 판정 마크를 x봇 발 추적에서 떼어 설계 좌표에 못 박는다.
//   평면 판에서 봇은 이미 숨겨지는데 마크 위치는 계속 조종하고 있어서, 안 보이는 봇의 걸음이
//   발자국을 흔든다(실측 85px 점프). 에펙 합성은 설계를 정확히 옮기는 게 목적이라 끊는다.
const PIN = !!arg('pin', false);
// --norip : 마크의 **발모양 파형**(MARK 셰이더 Success 의 uRip)을 끈다.
//   팡(원형)은 별도 쿼드라 --layer 로 뺄 수 있지만, 이 파형은 마크 셰이더 안에 있어서
//   레이어로는 못 뺀다. 유니폼을 매 프레임 0 으로 눌러 끈다.
//   에펙에서 파형을 직접 만들어 얹으려는 경우에 쓴다(팡과 같은 방침).
const NORIP = !!arg('norip', false);
// --alphafloor : 이 밝기(0~1) 아래는 완전 투명. 대지 패널의 검정 배경이 옅은 알파로 남아
//   투사면 사각형이 통째로 비쳐 보이던 것(유저 지적)을 잘라 낸다. 0.06~0.12 부터 시도.
const AFLOOR = +arg('alphafloor', 0) || 0;
// --t0 : 시작 시각(초). 스테이지 도입부가 통째로 비어 있는 화면이 있다 — 러닝 A3 는 t<1 이
//   불투명 0.00% 다. 3초짜리에선 그 1초가 치명적이다.
const T0 = +arg('t0', 0) || 0;
// --alphagamma : 어두운 톤의 알파를 들어 올린다(1 = 예전과 동일, 0.5 권장).
//   투사는 가산광이라 alpha = 빛의 세기인데, 그 선형 관계가 어두운 부분을 통째로 지운다 —
//   머리카락 회색(휘도 0.10)이 알파 0.18. 0.5 를 주면 0.57 이 된다. 배경(휘도≈0)은 그대로 0.
//   ※ '전부 불투명(100% 잉크)'은 이 파이프라인에서 안 된다. 인물·마크가 가산 블렌딩이라
//     커버리지 알파 자체가 없다 — 씬 알파를 그대로 내보내면 인물이 사라지고 대지 판의
//     불투명 검정 사각형만 남는다(실측 확인). 감마가 실제로 쓸 수 있는 손잡이다.
const AGAMMA = +arg('alphagamma', 1) || 1;
// --layer : 레이어를 갈라서 뽑는다. 에펙에서 겹쳐 쓰면 통합본보다 자유롭고, 무엇보다
//   **인물을 진짜 잉크(검정 포함)로 뽑을 수 있는 유일한 방법**이다.
//     person — 인물 판만. 알파를 휘도가 아니라 씬 실제 알파(실루엣 마스크)로 쓴다.
//              통합 프레임에서 이게 안 됐던 건 인물에 알파가 없어서가 아니라 대지 UI 판의
//              불투명 검정 배경이 화면을 덮었기 때문이다 — 혼자 두면 문제가 사라진다.
//     tokens — 판정토큰만. 가산광이라 커버리지 알파가 없다 → 휘도 알파, 에펙에서 Screen.
//     ui     — 투사 UI 대지만. 휘도 알파, 에펙에서 Screen.
//     all    — 기존 통합본(기본값).
const LAYER = String(arg('layer', 'all'));
if (!/^(all|person|tokens|ui|noburst|burst)$/.test(LAYER)) {
  console.error('--layer 는 all|person|tokens|ui|noburst|burst'); process.exit(1);
}
const INKA = LAYER === 'person';   // 인물 단독일 때만 잉크 알파
// --bg : 배경 이미지/영상을 **시뮬레이터 안에** 깔고 통째로 내보낸다.
//   알파로 뽑아서 에펙에서 합성하는 대신, 캔버스를 투명하게 두고 그 뒤에 배경을 깔면
//   스크린샷이 곧 최종 합성물이다. 알파·키잉 단계가 통째로 사라지므로
//   가장자리 등고선·검정 소실·프리멀티 문제가 원천적으로 안 생긴다.
//   파일은 public/_bg/ 로 복사해 vite 가 서빙하게 한다(로컬 경로는 브라우저가 못 연다).
//   저장본의 배경은 브라우저 경로(`/_bg/x.mp4`)라 파일 경로로 바꿔 준다.
const BG = has('bg') ? arg('bg', '') : (PRESET.bg ? path.join('public', PRESET.bg.replace(/^\//, '')) : '');
// --bgfit : cover(꽉 채움·기본) | contain(전체 보이기) | 100% 100%(늘리기)
const BGFIT = String(arg('bgfit', 'cover'));
// --bgdim : 배경 밝기. 양수 = 어둡게 · 음수 = 밝게 (씬 모드는 앱과 같은 −0.6~0.9 범위).
const BGDIM = Math.max(SCENE_ID ? -0.6 : 0, Math.min(0.9, pickN('bgdim', null, 0)));
// --scene : 앱의 **씬 스테이지 모드**(index.html?scene=ID)를 그대로 뽑는다.
//   화면녹화하던 바로 그 화면이다. --flat/--beam/--alpha 를 쓰지 않으므로 알파·격리에서
//   생기던 문제(가장자리 등고선·검정 소실·무대 누수)가 원천적으로 없다.
//   화면녹화는 디스플레이 픽셀에 갇히지만(실측 3292×1874·19.6fps 드롭) 여기선 안 갇힌다:
//   --w 1920 --ss 2 로 주면 **레이아웃은 1920 그대로, 출력은 3840×2160** 이다.
const SCENE = SCENE_ID;
// 씬 스테이지 촬영 조정 — scenes.html 의 슬라이더와 **같은 객체**(window.__sceneAdj)를 채운다.
//   화면에서 '지금 값 복사'로 뽑은 문자열이 그대로 여기 옵션이 된다. 보이는 대로 녹화된다.
//   --fp 는 1인칭(러닝·농구의 실제 시야). 1인칭에서도 --pan/--tilt(라디안)로 각도를 준다.
const ADJ = {
  fp: has('fp') ? true : !!PRESET.fp,
  zoom: pickN('zoom', null, 1), pan: pickN('pan', null, 0), tilt: pickN('tilt', null, 0),
  dolly: pickN('dolly', null, 1), exposure: pickN('exposure', null, 1), bloom: pickN('bloom', null, 0.55),
  uiX: pickN('uix', 'uiX', 0), uiY: pickN('uiy', 'uiY', 0), uiScale: pickN('uiscale2', 'uiScale', 1),
  // 씬 스테이지 기본 합성은 화면(scenes.html)과 같은 screen — normal 이면 지면 투사 판의
  //   어두운 면이 실사 배경 위에 검은 사각형으로 남는다. 배경이 없으면 둘의 결과가 같다.
  opacity: pickN('opacity', null, 1), blend: String(pick('blend', null, SCENE_ID ? 'screen' : 'normal')),
  // 색 보정 · 개체 숨김은 화면에서만 잡는다(플래그로 넣기엔 값이 많다) — 저장본이 유일한 출처.
  grade: PRESET.grade || { b: 1, c: 1, s: 1, h: 0 },
  bgGrade: PRESET.bgGrade || { b: 1, c: 1, s: 1, h: 0 },
  // --hide a,b : 저장본 hide 에 개체 키를 더한다(키는 scenes.html '개체 삭제' 목록과 동일).
  hide: [...(PRESET.hide || []), ...String(arg('hide', '')).split(',').filter(Boolean)],
};
const OUT = arg('out', 'out');
const URLBASE = arg('url', 'http://127.0.0.1:5199/');
// UI 캔버스 배율 — 실시간 기본 0.75. 4K 내보내기엔 2 이상이어야 확대 흐림이 없다.
// 평면 뷰는 투사면이 화면을 꽉 채우므로 대지 1px = 출력 1px 이상이어야 한다.
// 평면 뷰는 투사면이 화면을 꽉 채운다 — 대지 캔버스를 '출력'의 1.5배로 잡는다.
//   렌더 해상도(SS 배)에 맞추면 벽 기준 5200×3200 = 66MB 텍스처를 매 프레임 올리게 되고,
//   블룸 타깃까지 겹쳐 GPU 가 74프레임에서 컨텍스트를 잃었다(실측). 어차피 줄여서 내보내므로
//   출력의 1.5배면 선예도는 그대로고 메모리는 절반이다.
// ★ 기본값은 '대지 ≥ 출력'에 여유 5% 만. 예전 기본(출력의 1.5배)은 4K 에서 한계를 넘었다:
//   러닝 2302 → 배율 2.16 → 대지 3453×5762 ≈ 80MB, 복싱 3840 → 2.22 → 5759×3544 ≈ 82MB.
//   위 주석의 66MB 함정 그대로다. 증상이 고약하다 — 컨텍스트 손실 에러도, 삼각형 0 도 아니고
//   그냥 '완전 투명한 프레임'이 480장 쌓인다(실측: 8초 4K 러닝·복싱 전량 손실).
//   대지가 출력보다 크기만 하면 선예도는 같다. 그 이상은 어차피 줄이면서 버려진다.
// ★ **평면(--flat)은 이 벽이 훨씬 앞에 있다**(2026-08-06 실측, 지면 BK_B1):
//     --w 2048 → uiscale 1.34 → 대지 2150×3588(31MB) ✅
//     --w 3072 → uiscale 2.02 → 대지 3226×5384(69MB) ❌ 프리플라이트 불투명 0.06% = 전량 투명
//   위 주석이 4K 기준으로 쓰여 있어 '2K 대는 안전'으로 읽었는데, 지면 대지는 1600×2670 세로판이라
//   같은 폭에서도 대지가 더 크다. 기준은 --w 가 아니라 **대지 픽셀 수(50MB 아래)** 다.
//   평면에서 폭을 올릴 땐 --uiscale 을 직접 내리고, 새 해상도는 --dur 1 로 먼저 찔러 볼 것.
const UISCALE = +arg('uiscale', FLAT ? Math.min(3, Math.max(1, W / FBASE[0] * 1.05))
                                     : (W >= 3000 ? 2 : 1.25));
const ALPHA = ALPHA0;

// 불투명 픽셀 비율(%) — '빈 프레임'을 파일 크기 대신 실제 알파로 판정한다.
//   알파 8 미만은 사실상 투명. 에펙에서 배경이 검게 보이는 사고는 여기서 100% 가 나오는 것으로
//   즉시 잡힌다 — 배경까지 불투명하다는 뜻이니까.
const { PNG } = await import('pngjs');
const coverage = async (file) => {
  const png = PNG.sync.read(fs.readFileSync(file));
  let n = 0;
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] >= 8) n++;
  return n / (png.width * png.height) * 100;
};

// 색 다양도(%) — 알파가 없는 렌더에서 '빈 화면'을 잡는다.
//   균일한 한 색으로 덮인 프레임은 다양도가 0 에 수렴한다. 내용이 있으면 밝기 분포가 퍼진다.
//   64단계 히스토그램에서 '전체의 0.2% 이상을 차지하는 칸'이 몇 개인지로 센다.
const variety = async (file) => {
  const png = PNG.sync.read(fs.readFileSync(file));
  const n = png.width * png.height, h = new Array(64).fill(0);
  for (let i = 0; i < png.data.length; i += 4) {
    const l = (png.data[i] * 0.299 + png.data[i + 1] * 0.587 + png.data[i + 2] * 0.114);
    h[Math.min(63, l >> 2)]++;
  }
  const used = h.filter(c => c > n * 0.002).length;
  return used <= 1 ? 0 : used;   // 칸이 하나뿐 = 단색 = 빈 화면
};

// --bg 파일을 public/_bg/ 로 복사한다 — 브라우저는 로컬 절대경로를 못 열고, vite 는 public/ 을
//   루트로 서빙한다. ★ 출력 크기에 맞춰 미리 줄여 두는 게 안전하다: 8208×5348 원본을 그대로
//   물리면 디코드에만 175MB 가 든다(가로×세로×4). 3840 출력에 8208 소스는 어차피 버려진다.
let BGURL = '';
// 영상 배경은 CSS 로 못 깐다 — 앱의 __setSceneBg 가 <video> 를 캔버스 뒤에 깐다(같은 스태킹
//   컨텍스트라 가산 합성 그대로). 프레임 단위 시크는 아래 <video> 동기화 블록이 이미 처리한다.
//   ★ 원본 .mov 를 그대로 주지 말 것 — long-GOP 시크가 프레임당 수 초다.
//     scripts/make_bg_proxy.mjs 로 전 키프레임 프록시를 먼저 만들어라.
const BGVID = /\.(mp4|mov|webm|m4v)$/i.test(String(BG || ''));
if (BG) {
  const src = String(BG);
  if (!fs.existsSync(src)) { console.error(`✗ --bg 파일이 없습니다: ${src}`); process.exit(1); }
  const dir = path.join('public', '_bg');
  fs.mkdirSync(dir, { recursive: true });
  // ★ 렌더 중에 public/ 에 쓰면 vite 가 새로고침해 렌더가 죽는다(HANDOFF-0802 ⑦).
  //   이미 _bg 안에 있는 파일(프록시)은 복사하지 않는다 — 안전하고 200MB 를 아낀다.
  let dst = path.resolve(src);
  if (path.dirname(dst) !== path.resolve(dir)) {
    dst = path.join(dir, path.basename(src).replace(/[^\w.\-]/g, '_'));
    fs.copyFileSync(src, dst);
  }
  BGURL = '/_bg/' + path.basename(dst);
  if (BGVID && /\.mov$/i.test(dst)) console.warn('  ⚠ .mov 원본입니다 — 시크가 매우 느립니다. make_bg_proxy.mjs 로 프록시를 만드세요.');
  console.log(`  배경: ${path.basename(src)} → ${BGURL} (${(fs.statSync(dst).size / 1048576).toFixed(0)}MB${BGVID ? ' · 영상' : ''})`);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'newton_export_'));
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
// ★ 스테이지를 태그에 넣는다 — 안 넣으면 같은 종목의 다른 스테이지가 서로를 덮어쓴다
//   (실측: 스테이지 7개를 훑었더니 종목당 마지막 것만 남았다).
const tag = `${SPORT}${STAGE ? '_' + STAGE : ''}${SESSION ? '_session' : ''}${FLAT ? '_flat' : ''}${BEAM ? '_beam' : ''}${HT ? '_ht' : ''}${ALPHA ? '_alpha' : ''}${AGAMMA !== 1 && !INKA ? `_g${AGAMMA}` : ''}${LAYER !== 'all' ? `_L-${LAYER}` : ''}_${W}p${FPS}`;
console.log(`▶ ${tag} — ${N}프레임 (출력 ${WP}×${HP} · 렌더 ${WP * SS}×${HP * SS}(SS×${SS}) · ${FPS}fps · ${DUR}s · UI 배율 ${UISCALE}${FLAT ? ' · 평면 직교' : ''}${PAD > 1 ? ` · 여백 ×${PAD}` : ''})`);

// GPU 우선(맥은 metal). 실패하면 소프트웨어로 떨어진다 — 느리지만 결과는 같다.
const browser = await puppeteer.launch({
  headless: 'new',
  // ANGLE 백엔드는 OS 마다 다르다 — 맥은 metal, 윈도는 d3d11. 틀린 값을 주면 조용히
  // 소프트웨어(SwiftShader)로 떨어져 프레임당 수 초씩 느려진다.
  args: ['--no-sandbox', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`,
    '--enable-gpu', '--enable-unsafe-swiftshader', `--window-size=${WP},${HP}`,
    // ★ 크롬은 GPU 메모리 예산을 스스로 낮게 잡고, 넘으면 **조용히** 텍스처 업로드를 버린다
    //   (에러도 컨텍스트 손실도 없이 전부 투명한 프레임). 다른 크롬 창이 VRAM 을 먹고 있으면
    //   그 예산이 더 줄어 4K 가 통째로 안 나온다 — 실측: 아침엔 35MP 가 됐는데 사용자 크롬이
    //   5.4GB 를 잡은 뒤엔 7MP 도 실패했다. 예산을 명시해 그 조기 축출을 막는다.
    '--force-gpu-mem-available-mb=4096', '--disable-gpu-program-cache'],
});
const page = await browser.newPage();
// ★ 가상 시계 — 페이지의 모든 시간을 우리가 민다.
//   이게 없으면 셰이더 uTime·three.Clock 이 '실시간'으로 돈다. 프레임 하나 렌더에 1~2초가
//   걸리므로 애니메이션이 그만큼 앞질러 가고, 결과 영상이 미친 듯이 빨라진다(유저: 너무 빠름).
//   performance.now·Date.now·rAF 타임스탬프를 전부 __vt 로 묶으면 시간은 우리 것이 된다.
await page.evaluateOnNewDocument(() => {
  window.__vt = 0;
  const P = performance;
  P.now = () => window.__vt;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(window.__vt));
  const D0 = 1735689600000;
  Date.now = () => D0 + window.__vt;
  // ★ <video> 는 미디어 클록으로 돈다 — performance.now 를 가로채도 안 묶인다.
  //   재생을 그대로 두면 프레임 한 장 렌더에 걸리는 실제 시간(0.2~0.5초)만큼 영상이 앞질러 가
  //   인물만 12~30배로 빨라진다(유저: "16배속한 것처럼"). 루프에서 pause() 만으론 부족하다 —
  //   앱이 매 틱 play() 를 다시 부른다(실측: bhandle_pp.mp4 가 계속 paused:false).
  //   재생 자체를 막고, 프레임마다 currentTime 을 우리가 직접 찍는다.
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  // ★ 그런데 앱은 '재생 중인가'로 인물을 그릴지 정한다 —
  //     main.js: uLive = (readyState>=2 && !ended && !paused) · 코치 판은 uReady 가 같은 역할.
  //   재생을 막아 두면 paused 가 영원히 true 라 게이트가 닫힌 채로 남는다. 실측 증상:
  //   복싱 벽 인물이 아예 안 그려지고 흐린 열구름(uHeat 필드)만 남았다(BX_B3·BX_C2 두 장 확인).
  //   프레임은 실제로 들어와 있으니(우리가 currentTime 을 찍어 시크한다) 게이트만 열어 준다.
  //   유니폼을 밖에서 덮어쓰는 방법은 안 된다 — 앱이 매 틱 자기 값으로 다시 쓴다.
  //   ⚠ 이걸 켰으면 시크 완료를 **반드시** 기다려야 한다(아래 requestVideoFrameCallback).
  //     게이트만 열고 기다리지 않으면 빈 디코드가 그대로 찍혀 인물이 깜빡인다 — 실제로 그랬다.
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get: () => false, configurable: true });
});
await page.setViewport({ width: WP, height: HP, deviceScaleFactor: SS });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
// ★ 렌더 도중 페이지가 리로드되면 window.__dbg 가 사라지고 이후 프레임이 전부 텅 빈다.
//   vite 의 always-full-reload 플러그인이 out/ 에 쌓이는 PNG 를 소스 변경으로 보고 새로고침한
//   것이 원인이었다(vite.config.js 의 watch.ignored 로 막았다). 다시 새면 조용히 넘기지 않는다.
let reloaded = 0;
page.on('framenavigated', f => { if (f === page.mainFrame()) reloaded++; });
// --bg 를 쓰면 캔버스도 투명해야 뒤의 배경이 비친다(?alpha=1 이 렌더러 알파를 켠다).
await page.goto(`${URLBASE}?dev=1&uiscale=${UISCALE}${(ALPHA || BGURL) ? '&alpha=1' : ''}${SCENE ? `&scene=${encodeURIComponent(SCENE)}` : ''}`, { waitUntil: 'networkidle2', timeout: 180000 });
await page.waitForFunction('!!window.__dbg?.session', { timeout: 120000 });
// 부팅 동안에도 가상 시계를 밀어 준다 — 안 그러면 초기화가 시간 0 에 얼어붙는다.
const warm = async (ms, step = 16.7) => {
  for (let v = 0; v < ms; v += step) {
    await page.evaluate(vv => { window.__vt = vv; }, v);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  }
};
await new Promise(r => setTimeout(r, 9000));   // 에셋 로드(실시간 대기)
await warm(1200);                              // 가상 시계로 초기 애니메이션 워밍업

await page.evaluate(p => { window.__play = p; }, PLAY);
await page.evaluate(v => { window.__afloor = v; }, AFLOOR);
await page.evaluate(a => { window.__wantAlpha = a; }, ALPHA);
// 영상 배경은 body CSS 경로를 타면 안 된다(url() 로 영상은 안 깔린다) — 앱의 <video> 경로로 넘긴다.
await page.evaluate(v => { window.__bgUrl = v; }, BGVID ? '' : BGURL);
await page.evaluate(v => { window.__bgVid = v; }, BGVID);
await page.evaluate(v => { window.__bgFit = v; }, BGFIT);
await page.evaluate(v => { window.__bgDim = v; }, BGDIM);
await page.evaluate(v => { window.__agamma = v; }, AGAMMA);
await page.evaluate(v => { window.__layer = v; }, LAYER);
// 세션이 매 프레임 읽는 플래그 — 마크를 봇 발 추적에서 떼어 설계 좌표에 고정(session.js A2).
await page.evaluate(v => { window.__pin = v; const s = window.__dbg?.session; if (s) s.pinMarks = v; }, PIN);
await page.evaluate(v => { window.__norip = v; }, NORIP);
await page.evaluate(v => { window.__inka = v; }, INKA);
await page.evaluate(v => { window.__unclip = v; }, PAD > 1);
await page.evaluate(v => { window.__flatGround = v; }, FLATGROUND);
// ── 씬 스테이지: 화면에서 맞춘 값을 그대로 넘긴다 ─────────────────────────────
//   __sceneAdj 는 앱이 매 프레임 읽는 **살아 있는 객체**라 한 번만 넣으면 된다.
//   영상 배경도 여기서 건다 — scenes.html 이 부르는 것과 같은 함수라 결과가 화면과 같다.
if (SCENE) {
  const ok = await page.evaluate(({ adj, bg, dim, vid }) => {
    if (!window.__sceneAdj) return 'no-adj';
    Object.assign(window.__sceneAdj, adj);
    window.__setComposite?.(adj.opacity, adj.blend);
    if (vid && bg) window.__setSceneBg?.(bg, dim);
    return 'ok';
  }, { adj: ADJ, bg: BGURL, dim: BGDIM, vid: BGVID });
  if (ok !== 'ok') console.warn(`  ⚠ 씬 조정값을 못 넣었습니다(${ok}) — ?scene= 이 붙어 있는지 확인`);
  else console.log(`  조정: ${ADJ.fp ? '1인칭' : '고정'} zoom ${ADJ.zoom} pan ${ADJ.pan} tilt ${ADJ.tilt} dolly ${ADJ.dolly} exp ${ADJ.exposure} bloom ${ADJ.bloom} blend ${ADJ.blend}`);
  await warm(1500);   // 1인칭 전환·배경 첫 프레임이 자리 잡을 시간
} else if (BGVID) {
  console.error('✗ 영상 배경은 --scene 과 함께 써야 합니다(앱의 <video> 배경 경로).'); process.exit(1);
}
// ★ stage 를 구조분해에 반드시 넣을 것 — 빠뜨리면 브라우저 전역의 #stage DOM 요소가 잡힌다
//   (id 를 가진 요소는 window 의 프로퍼티가 된다). 실측: '없는 스테이지: [object HTMLElement]'.
await page.evaluate(({ sport, beam, ht, session, stage, listStages }) => {
  const d = window.__dbg;
  // 화면 정리 — 캔버스 말고는 전부 숨긴다.
  //   개별 선택자로 지우면 자막·클립 미리보기·빌드 스탬프처럼 빠뜨린 게 반드시 새어 나온다(실측).
  //   반대로 간다: 캔버스를 품은 조상만 남기고 나머지 DOM 을 통째로 숨긴다.
  //   ★ 한 번만 쓸면 안 된다 — session.start() 나 클립 재생이 '나중에' 새 DOM 을 만든다.
  //     실측: 클립 미리보기 패널(rgba(14,16,21,.92) z=30, 안에 <video>)이 우상단에 검은 알약으로
  //     남았다. 세션 시작이 청소 뒤라 청소를 피해 간 것. 그래서 함수로 두고 매 프레임 다시 쓴다.
  //   ★ 인라인 style 로 숨기면 안 된다 — 앱이 el.style.display 를 다시 쓰면 !important 까지 통째로
  //     날아간다(main.js:2854 ghostPrev). 스타일시트의 !important 규칙은 인라인 일반 선언을 이긴다.
  if (!document.getElementById('__exp')) {
    const st = document.createElement('style'); st.id = '__exp';
    st.textContent = '.__exphide{display:none!important}';
    document.head.appendChild(st);
  }
  window.__sweep = () => {
    const cvs = d.renderer.domElement;
    const keep = new Set();
    for (let el = cvs; el && el !== document.documentElement; el = el.parentElement) keep.add(el);
    document.querySelectorAll('body *').forEach(el => {
      // #__bgvid = 실사 배경 영상(캔버스의 형제). 여기 걸리면 배경이 통째로 사라진다.
      if (!keep.has(el) && el.id !== '__bgvid' && !el.contains(cvs)) el.classList.add('__exphide');
    });
    keep.forEach(el => { el.style.setProperty('background', 'transparent', 'important'); });
    // ★ --bg : 투명 캔버스 뒤에 배경을 깐다. 스크린샷이 곧 최종 합성물이다 —
    //   알파로 뽑아 에펙에서 키잉하는 단계가 통째로 사라진다.
    if (window.__bgUrl) {
      // ★ 반드시 !important 로. 바로 위 keep 루프가 캔버스 조상(body 포함)에
      //   'background: transparent !important' 를 걸어 두기 때문에 일반 인라인 선언은 진다.
      //   이 파일 위쪽에 같은 함정이 이미 기록돼 있었는데 그대로 밟았다.
      // --bgdim : 배경만 어둡게(0 = 원본). 검은 반투명 레이어를 배경 위에 겹친다 —
      //   filter 를 쓰면 캔버스까지 같이 어두워지므로 배경 레이어 안에서 해결한다.
      const dim = window.__bgDim || 0;
      const veil = dim > 0 ? `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ` : '';
      document.body.style.setProperty('background',
        `${veil}#000 url("${window.__bgUrl}") center/${window.__bgFit} no-repeat`, 'important');
      const st = document.getElementById('stage');
      if (st) st.style.setProperty('background', 'transparent', 'important');
    } else {
      // ★ 영상 배경(#__bgvid)은 z-index:-1 로 캔버스 뒤에 깔린다. 음수 z-index 는 **body 배경보다
      //   아래**에 그려지므로, 여기서 body 를 불투명 검정으로 두면 배경이 통째로 가려진다
      //   (실측: 배경 영상이 완전히 검은 프레임으로 나왔다). 영상 배경일 땐 body 를 비워 둔다.
      document.body.style.background = (window.__wantAlpha || window.__bgVid) ? 'transparent' : '#000';
      if (window.__wantAlpha) { const st = document.getElementById('stage'); if (st) st.style.background = 'transparent'; }
    }
  };
  window.__sweep();
  // 종목 전환은 좌측 버튼을 눌러야 한다 — state.pack 대입만으로는 씬이 안 바뀐다.
  const packBtn = { running: '러닝', boxing: '복싱', basketball: '농구' }[sport];
  [...document.querySelectorAll('button')].find(b => b.textContent.trim() === packBtn)?.click();
  if (ht) document.getElementById('btn-ht')?.click();
  if (session) {
    d.session.start(sport);
    if (stage || listStages) {
      const ids = (d.session.stages || []).map(s => s.id);
      window.__stages = ids;
      if (stage) {
        const i = ids.indexOf(stage);
        // 스테이지 점프는 세션이 스스로 쓰는 관용구 그대로 (session.js _gateAdvance)
        if (i >= 0) { d.session.stageIdx = i; d.session.t = 0; d.session._enter(); }
        else window.__stageErr = `없는 스테이지: ${stage}`;
      }
    }
  }
  if (beam) {
    // ── 투사광만 ─────────────────────────────────────────────────────────────
    //   실사 합성용. 우리가 '쏘는 빛'만 남기고 무대(바닥·벽·봇·골대·그리드)를 전부 끈다.
    //   판별 기준은 재질이다 — 투사광은 ShaderMaterial(MARKFX·LANEFX·인물) 이거나
    //   맵을 가진 MeshBasicMaterial(투사 UI 평면)이다. PBR 재질은 전부 무대다.
    // background 를 null 로 두면 setSurfaces/applyDayAmbience 가 .setHex 를 부르다 죽는다
    //   (실측: 페이지 에러 2건). 검은 Color 로 둔다 — 결과는 같고 에러가 없다.
    if (d.scene.background?.setHex) d.scene.background.setHex(0x000000);
    if (d.scene.fog?.color?.setHex) d.scene.fog.color.setHex(0x000000);
    if (window.__wantAlpha) {
      // ★ 컴포저(EffectComposer)가 프레임 전체를 알파 1 로 덮는다 — 이게 '투명이 안 되던' 이유다.
      //   RenderPass.clearAlpha 를 0 으로 두면 배경이 비어 있는 채로 블룸·그레이드를 탄다.
      d.scene.background = null;
      d.renderer.setClearColor(0x000000, 0);
      const rp = d.composer?.passes?.[0];
      if (rp) rp.clearAlpha = 0;
      d.FXP && (d.FXP.__x = 1);
      // 알파는 그레이드 패스가 휘도에서 뽑는다(scene.js FX.alphaOut).
      //   --ink 면 끈다: 씬이 실제로 쓴 알파를 그대로 내보내 어두운 톤(머리카락 회색)을 살린다.
      import('/src/scene.js').then(m => {
        // 인물 단독 레이어만 씬 실제 알파를 쓴다 — 그래야 검정·머리카락 회색이 살아남는다.
        m.FX.alphaOut = !window.__inka;
        m.FX.alphaFloor = window.__inka ? 0 : (window.__afloor || 0);
        m.FX.alphaGamma = window.__agamma || 1;
        m.FX.inkAlpha = !!window.__inka;
      }).catch(() => {});
    }
    else {
      d.renderer.setClearColor(0x000000, 1);
      // ★ 배경이 Color 가 아니면 위의 setHex 가 조용히 건너뛴다 — 실내 환경 텍스처가 그대로
      //   남아 화면을 통째로 덮는다(실측: 8초 240프레임이 전부 균일한 아이보리로 나왔다).
      //   알파 모드는 background=null 로 지워서 이 문제가 안 드러났다. Color 로 갈아 끼운다 —
      //   null 로 두면 setSurfaces/applyDayAmbience 가 .setHex 를 부르다 죽는다(위 주석 참조).
      if (!d.scene.background?.isColor) d.scene.background = new d.THREE.Color(0x000000);
    }
    // ★ 유지 규칙은 **화이트리스트**다. 예전엔 '셰이더거나 선이면 투사광' 휴리스틱에 이름
    //   블랙리스트(courtLines·courtZones·hoop)를 덧대는 방식이었는데, 무대에 새 요소가 생길
    //   때마다 반드시 샌다. 실제로 두 번 샜다: ① 농구 코트 사이드라인(LineSegments, '선 =
    //   투사광' 통과) ② 복싱 원근 그리드(uGrid/uLines/uScan 셰이더, '셰이더 = 투사광' 통과).
    //   유저 요구는 "인물·UI·판정토큰만, 배경은 절대 안 나오게"이므로 방향을 뒤집는다.
    //   판별은 **유니폼 키**로 한다 — fragmentShader 문자열 매칭은 못 쓴다. 이 프로젝트의
    //   셰이더는 fx-core 의 공용 GLSL(markState·personLook·refEdge)을 통째로 붙여 쓰므로
    //   무대 셰이더 소스에도 uProg·uPhase 같은 이름이 섞여 들어온다(실측: 그리드가 통과했다).
    const has = (m, re) => !!m.uniforms && Object.keys(m.uniforms).some(k => re.test(k));
    const PERSON_U = /^(uTrail|uCropOff|uField)/;                  // 인물 판(벽 데모 · 코치 클립)
    const TOKEN_U  = /^(uHT|uHalo|uProg|uPhase|uMark)/;            // 판정토큰(마크 FX · 링)
    const STAGE_U  = /^(uGrid|uLines|uScan|uBoost|uAccent|uHalf|uKey|uTint)$/;   // 무대(그리드·코트)
    // ★ '팡'(effects.burst) 전용 판별 — 이 쿼드만 uIntensity·uForward·uFPOrigin 을 갖는다.
    //   왜 따로 빼나: 이건 씬에서 THREE.AdditiveBlending 으로 그리는 **순수한 빛**이라
    //   커버리지 알파가 없다. 알파로 뽑아 Normal 로 얹으면 그 넓은 자락이 어두운 물감이 되어
    //   바닥에 빨간 그림자 박스를 만든다(실측). 인물·발자국·원형토큰은 잉크가 예쁜데
    //   팡만 그렇다(유저). 그래서 팡만 검정으로 빼서 AE 에서 가산으로 얹는다.
    //   ※ uFPOrigin·uFPNear 류는 쓰면 안 된다 — 1인칭 빔 클리핑용이라 토큰 재질도 다 갖고 있다
    //     (그걸로 잡았다가 판정토큰이 통째로 팡 레이어로 넘어갔다). 아래 셋은 effects.js 전용.
    const BURST_U  = /^(uIntensity|uEmber|uForward)$/;
    const L = window.__layer || 'all';
    const isBurst = m => has(m, BURST_U);
    // noburst = 팡 빼고 전부(잉크) · burst = 팡만(빛)
    const wantPerson = L === 'all' || L === 'person' || L === 'noburst';
    const wantToken  = L === 'all' || L === 'tokens' || L === 'noburst';
    const wantUI     = L === 'all' || L === 'ui' || L === 'noburst';
    const wantBurst  = L === 'all' || L === 'burst' || L === 'tokens';
    // ★ 한 번만 쓸면 안 된다 — DOM 청소(__sweep)와 같은 이유다. 앱은 스테이지 진입·코트
    //   재구성 때 무대 개체를 **새로 만든다**. 셋업 때 숨긴 건 그 새 개체가 아니다.
    //   증상이 고약하다: 대부분 프레임은 멀쩡한데 한두 장에서만 코트 사이드라인이 살아나
    //   프레임 가장자리까지 뻗는다 → 그 프레임만 모서리 알파 255 → 에펙에서 검은 사각형이
    //   번쩍인다(실측: BK_B3 f1). 매 프레임 다시 건다.
    window.__isolate3d = () => {
      // 세션은 이 시점 이후에 만들어질 수 있다 — 매 프레임 다시 건다(DOM 청소와 같은 이유).
      if (d.session) d.session.pinMarks = !!window.__pin;
      // ★ 배경 지우기도 여기 있어야 한다. 셋업에서 한 번만 칠하면 앱이 매 틱 주간 조명을
      //   다시 적용하며 되돌려 놓는다 — 검은 배경으로 뽑았는데 아이보리 실내가 그대로 남았다(실측).
      // --bg 도 알파와 같다: 캔버스를 비워야 그 뒤에 깔아 둔 배경 사진/영상이 보인다.
      //   불투명 검정으로 클리어하면(clearColor alpha=1) 배경을 통째로 덮어 버린다.
      if (window.__wantAlpha || window.__bgUrl) { d.scene.background = null; d.renderer.setClearColor(0x000000, 0); }
      else {
        d.renderer.setClearColor(0x000000, 1);
        if (!d.scene.background?.isColor) d.scene.background = new d.THREE.Color(0x000000);
        else d.scene.background.setHex(0x000000);
      }
      if (d.scene.fog?.color?.setHex) d.scene.fog.color.setHex(0x000000);
      if (d.xbot?.root) d.xbot.root.visible = false;
      const UI = new Set([d.floorGL?.mesh, d.wallGL?.mesh].filter(Boolean));
      d.scene.traverse(o => {
        if (o.isLight) { o.intensity = 0; return; }
        if (/Grid|Axes|Box3/.test(o.type)) { o.visible = false; return; }
        if (UI.has(o)) { o.visible = wantUI; return; }
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m) return;
        // --norip : 발모양 파형 끄기. 마크 셰이더 안에 있어 레이어로는 못 빼므로 유니폼을 누른다.
        //   앱이 매 프레임 룩 스토어에서 다시 써넣으므로 여기서도 매 프레임 눌러야 한다.
        if (window.__norip && m.uniforms && m.uniforms.uRip) m.uniforms.uRip.value = 0;
        const isShader = m.type === 'ShaderMaterial' && !has(m, STAGE_U);
        // 글리프·아이콘은 마크의 자식이라 토큰 레이어에 딸려 간다(맵을 문 MeshBasic).
        // 팡은 uHalo 를 갖고 있어 TOKEN_U 에도 걸린다 — 먼저 가로채야 분리가 된다.
        if (isBurst(m)) { o.visible = wantBurst; return; }
        const keep = (isShader && has(m, PERSON_U) && wantPerson)
                  || (isShader && has(m, TOKEN_U) && wantToken)
                  || (m.type === 'MeshBasicMaterial' && !!m.map && wantToken);
        if (!keep) { o.visible = false; return; }
        // ★ 투사면 밖 하드 클리핑 해제 — 대지 경계에서 파동이 칼같이 잘리던 것(유저 신고).
        //   앱은 실사용에서 투사광이 스크린 밖으로 새는 걸 막으려 clippingPlanes 를 건다.
        //   내보내기는 그 여백까지 담는 게 목적이라 (--pad) 여기선 푼다.
        if (window.__unclip && m.clippingPlanes?.length) m.clippingPlanes = null;
      });
    };
    window.__isolate3d();
  }
  window.__sweep();   // ★ session.start 뒤에 한 번 더 — 클립 미리보기 패널이 그때 생긴다
}, { sport: SPORT, beam: BEAM, ht: HT, session: SESSION, stage: STAGE, listStages: LISTSTAGES });

if (SESSION && (STAGE || LISTSTAGES)) {
  const { ids, err } = await page.evaluate(() => ({ ids: window.__stages, err: window.__stageErr }));
  if (LISTSTAGES) { console.log(`${SPORT} 스테이지: ${(ids || []).join(' ')}`); await browser.close(); process.exit(0); }
  if (err) { console.error(`✗ ${err}\n  있는 것: ${(ids || []).join(' ')}`); await browser.close(); process.exit(1); }
  console.log(`  스테이지 ${STAGE} 진입`);
}

await page.evaluate(p => { window.__pad = p; }, PAD);
if (FLAT) await page.evaluate(sport => {
  // ── 평면 정면 뷰 ────────────────────────────────────────────────────────
  //   투사면(벽 또는 지면) 메시의 로컬 축을 월드로 옮겨 그 법선 위에 직교 카메라를 세운다.
  //   원근이 0이므로 대지 좌표가 화면 좌표로 1:1 사상된다 — 피그마 프레임과 같은 그림.
  //   판정 토큰은 면 앞 z −1.05~−1.43 에 있어 이 절두체 안에 그대로 들어온다.
  const d = window.__dbg, T = d.THREE;
  // ★ READY 는 지면 판이 **꺼져 있다** — 'GREADY = 시작 페이지는 프레임 전담' 정책으로 main 이 끈다
  //   (session.js). 그러면 판 메시의 월드 행렬이 안 잡혀 카메라가 허공을 보고 프레임이 통째로 빈다
  //   (실측 08-06: --session --stage READY 가 항상 최대 불투명 0.00%).
  //   발자국(readyFeet)은 root 소속 예외라 살아 있으므로, 판 대신 **설계 좌표의 지면**에 카메라를 세운다.
  if (window.__flatGround) {
    const S = 0.000687;                      // sUni — 대지 1px = 0.687mm
    const hw = 1600 * S / 2, hh = 2670 * S / 2;
    // 대지 중심 z — 발자국(월드 −0.745)이 대지 y1821 에 앉고 대지 중심은 y1335 이므로
    //   중심은 발자국보다 (1821−1335)·sUni = 0.334m **뒤(먼 쪽, −z)** 다.
    const cz = -0.745 - 0.334;
    const cam = new T.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 40);
    window.__fitFlat = () => {
      cam.position.set(0, 10, cz);
      cam.up.set(0, 0, -1);                  // 화면 위쪽 = 먼 쪽(−z)
      cam.lookAt(0, 0, cz);
      cam.updateMatrixWorld(true);
    };
    window.__fitFlat();
    (d.sceneScope?.setRenderCamera ?? (c => { d.composer.passes[0].camera = c; }))(cam);
    d.composer.passes[0].camera = cam;
    window.__flatCam = cam;
    return;
  }
  const surf = sport === 'boxing' ? d.wallGL?.mesh : d.floorGL?.mesh;
  if (!surf) { window.__flatErr = '투사면 메시 없음'; return; }
  surf.visible = true;
  surf.updateWorldMatrix(true, false);
  const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  surf.matrixWorld.decompose(p, q, s);
  const g = surf.geometry.parameters;                       // PlaneGeometry(대지 px)
  // 절두체를 --pad 배로 넓힌다 — 대지를 넘어가는 파동·글로우가 가장자리에서 잘리지 않게.
  const PADF = window.__pad || 1;
  const hw = g.width * s.x / 2 * PADF, hh = g.height * s.y / 2 * PADF;
  const n = new T.Vector3(0, 0, 1).applyQuaternion(q);      // 면 법선(앞쪽)
  const dist = Math.max(hw, hh) * 4 + 5;
  const cam = new T.OrthographicCamera(-hw, hw, hh, -hh, 0.01, dist * 3);
  // ★ 매 프레임 투사면에 다시 맞춘다 — 한 번만 계산하면 안 된다.
  //   러닝은 주자가 전진하면서 지면 UI 평면이 z 로 계속 움직인다(main.js followFloor·loopShiftZ).
  //   고정 카메라는 곧 평면을 절두체 밖으로 흘려보내 화면이 통째로 빈다
  //   (실측: 러닝 C2·A3·P2 전부 0.4~1초 뒤 평균 알파 28 → 0.4, 즉 빈 프레임).
  //   벽(복싱)·농구는 투사면이 제자리라 이 버그가 안 드러났다.
  //   대지 크기·스케일은 안 변하므로 절두체는 그대로 두고 위치·자세만 다시 잡는다.
  window.__fitFlat = () => {
    surf.updateWorldMatrix(true, false);
    surf.matrixWorld.decompose(p, q, s);
    const nn = new T.Vector3(0, 0, 1).applyQuaternion(q);
    cam.position.copy(p).addScaledVector(nn, dist);
    cam.up.copy(new T.Vector3(0, 1, 0).applyQuaternion(q));
    cam.lookAt(p);
    cam.updateMatrixWorld(true);
  };
  window.__fitFlat();
  // 렌더 카메라만 갈아 끼운다 — 앱은 매 틱 자기 camera 를 움직이지만 그건 이제 안 쓰인다.
  (d.sceneScope?.setRenderCamera ?? (c => { d.composer.passes[0].camera = c; }))(cam);
  d.composer.passes[0].camera = cam;
  window.__flatCam = cam;
}, SPORT);

await page.evaluate(() => {
  // 좌패널을 숨겨도 캔버스는 예전 폭으로 굳어 있다 — 리사이즈를 강제해 뷰포트를 꽉 채운다(검은 띠 제거).
  const st = document.getElementById('stage');
  if (st) { st.style.position = 'fixed'; st.style.inset = '0'; st.style.width = '100%'; st.style.height = '100%'; }
  window.dispatchEvent(new Event('resize'));
});
// ★ 영상 정지·시범 래치 해제는 **여기서 한 번만** 한다.
//   매 프레임 하면 두 가지가 깨진다: pause() 가 진행 중인 시크를 취소하고(깜빡임),
//   _followLatch 를 계속 밀면 세션 진행이 망가져 마크가 제 차례가 아닌데 발화한다(유저 신고).
await page.evaluate(() => {
  for (const v of document.querySelectorAll('video')) { try { HTMLMediaElement.prototype.pause.call(v); } catch (e) {} }
  const s = window.__dbg?.session;
  if (s) s._followLatch = false;   // 시범(코치 클립)을 붙잡아 둔다 — 인물이 내보내기의 목적이다
});
await new Promise(r => setTimeout(r, 2500));
// ★ 비디오 디코더 예열 — 캡처 첫 프레임은 디코더가 콜드다. 첫 시크가 3초 안전장치에 걸리면
//   그 동안 메인스레드가 묶여 앱의 rAF 가 안 돌고, 캔버스에는 **직전 그림이 그대로** 남는다.
//   스크린샷은 캔버스를 찍으므로 결과 PNG 가 바이트 단위로 동일해진다 = 앞부분 통짜 정지.
//   실측(08-05 · BX_C3 310프레임): f00000~f00017 18장이 완전 동일, 시크 실패 76건.
//   여기서 클립 전체에 걸쳐 몇 군데 미리 시크해 두면 첫 프레임부터 디코더가 따뜻하다.
//   ⚠ 이건 실시간 대기다(캡처 전 1회). 프레임 루프 안으로 옮기지 말 것.
await page.evaluate(async () => {
  const vids = [...document.querySelectorAll('video')].filter(v => isFinite(v.duration) && v.duration > 0);
  await Promise.all(vids.map(async v => {
    for (const f of [0, 0.33, 0.66, 0]) {
      await new Promise(r => {
        let done = false; const fin = () => { if (done) return; done = true; r(); };
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(fin);
        else v.addEventListener('seeked', fin, { once: true });
        v.currentTime = Math.min(v.duration * f, v.duration - 0.01);
        setTimeout(fin, 4000);
      });
    }
  }));
});
// 안정화 동안 늦게 붙은 DOM 까지 마지막으로 한 번. (매 프레임 쓸면 800개 스타일 재계산으로
// 프레임 시간이 2.7s→5.6s 로 뛰고 컨텍스트도 더 일찍 잃는다 — 실측.)
await page.evaluate(() => window.__sweep?.());
// ★ --flat 이 실제로 걸렸는지 한 번 확인하고 넘어간다. 조용히 실패하면 원근 그림이 나오는데,
//   그건 '조금 이상한 영상'이라 눈으로는 버그로 안 보이고 카메라 각도 문제처럼 보인다.
if (FLAT) {
  const st = await page.evaluate(() => ({
    err: window.__flatErr, cam: window.__dbg?.composer?.passes?.[0]?.camera?.type,
    same: window.__dbg?.composer?.passes?.[0]?.camera === window.__flatCam,
  }));
  if (st.err) { console.error(`✗ --flat 실패: ${st.err}`); process.exit(1); }
  if (st.cam !== 'OrthographicCamera' || !st.same) {
    console.error(`✗ --flat 실패: 렌더 카메라가 ${st.cam} (직교로 안 바뀜)`); process.exit(1);
  }
  console.log(`  평면 직교 카메라 적용됨`);
}

// ★ 프리플라이트 — 화면이 실제로 채워질 때까지 기다렸다가 캡처를 시작한다.
//   빈 결과가 두 갈래에서 나온다: ① GPU 메모리가 모자라 텍스처 업로드가 조용히 실패
//   (컨텍스트도 안 죽고 WebGL 에러도 없고 삼각형도 0 이 아니다), ② 지면 UI 가 rig._fp 를
//   기다리느라 아직 안 켜진 상태(floorGLOn=false). 둘 다 '기다렸다 다시 보기'로 갈린다 —
//   ①이면 끝까지 비어 있고, ②면 몇 초 안에 채워진다.
//   판별은 **불투명 픽셀 비율**로 한다. 예전엔 PNG 파일 크기로 갈랐는데(수십 KB = 빈 프레임),
//   --alphafloor 를 켜면 옅은 배경 워시가 사라져 '내용이 있는데도' 6KB 로 압축된다 —
//   멀쩡한 러닝 A3 를 빈 화면으로 오판해 중단시켰다(실측). pngjs 는 이미 devDependency 다.
{
  //   ★ 그냥 기다리면 안 된다 — 시간은 우리가 미는 것이라, rAF 만 돌려선 장면이 영원히
  //     시각 0 에 멈춰 있다. 러닝 A3 는 시각 0 이 원래 비어 있고 t 가 흘러야 채워진다
  //     (실측: f0 0.00% → f1 4.54%). 시계를 안 밀고 12초를 기다렸더니 멀쩡한 러닝을
  //     '빈 화면'으로 오판해 중단시켰다. 그러니 프리플라이트도 실제로 시계를 민다.
  // ★ --play 일 때는 시계를 우리가 못 민다(상태 누적형이라 밀면 안 된다). 그런데 프리플라이트는
  //   T0 지점을 보려 하므로, **시뮬이 T0 에 닿을 때까지 기다렸다가** 재야 한다. 안 그러면 관찰
  //   구간(A2·BK_B3 는 앞부분이 시범이라 마크가 숨겨져 있다)을 재고 "아무것도 없다"로 중단한다
  //   (실측 08-06: A2·BK_B3 둘 다 불투명 0.00~0.05% 로 오탐, 해상도를 올려도 그대로).
  if (PLAY && T0 > 0) {
    const t0w = Date.now();
    for (;;) {
      const st = await page.evaluate(() => window.__dbg?.session?.t ?? window.__dbg?.state?.time ?? 0);
      if (st >= T0 - 0.05) { console.log(`  시뮬 t=${st.toFixed(2)}s 도달 — 프리플라이트 시작`); break; }
      if (Date.now() - t0w > (T0 + 20) * 1000) { console.log(`  ⚠ t=${st.toFixed(2)}s 에서 멈춤 — 그대로 진행`); break; }
      await new Promise(r => setTimeout(r, 250));
    }
  }
  const probe = path.join(TMP, 'probe.png');
  let kb = 0, ok = false;
  for (const t of [T0, T0 + 0.25, T0 + 0.5, T0 + 1, T0 + 2, T0 + 3]) {   // 초 — 몇 지점만 보면 충분하다
    await page.evaluate(tt => new Promise(res => {
      const d = window.__dbg;
      window.__vt = 1200 + tt * 1000;
      if (!window.__play) { d.state.playing = false; d.state.time = tt; if (d.session?.active) d.session.t = tt; }
      for (const g of [d.floorGL, d.wallGL]) if (g) { g._lastPaint = -1; g._sig = null; }
      requestAnimationFrame(() => { window.__fitFlat?.(); requestAnimationFrame(res); });
    }), t);
    await page.screenshot({ path: probe, type: 'png', omitBackground: ALPHA });
    // ★ 알파 렌더는 '불투명 픽셀 비율'로, 검은 배경 렌더는 '색이 몇 가지나 있나'로 판정한다.
    //   불투명 판정은 알파가 없으면 항상 100% 라 무조건 통과한다 — 그 구멍 때문에 균일한
    //   아이보리 화면 240장을 13분 걸려 뽑고도 성공으로 보고했다(실측). 다시는 안 되게 막는다.
    kb = Math.max(kb, ALPHA ? await coverage(probe) : await variety(probe));
    if (kb >= 0.15) { ok = true; break; }     // 알파: 불투명 0.15% · 검은배경: 색 다양도 0.15%
  }
  fs.rmSync(probe, { force: true });
  if (!ok) {
    console.error(`✗ 처음 3초 어디에도 그려진 것이 없습니다(최대 불투명 ${kb.toFixed(2)}%).`);
    console.error(`  GPU 메모리 부족이 유력합니다 — --uiscale 을 낮추거나(지금 ${UISCALE.toFixed(2)}) --w 를 줄이세요.`);
    await browser.close(); process.exit(1);
  }
  console.log(`  화면 채워짐 확인 (불투명 ${kb.toFixed(2)}%)`);
}

const t0 = Date.now();
let done = 0;
// ★ 스테이지 시작 전 프레임은 버린다(--play 전용).
//   실측(08-05 · BX_C3): 캡처 시작 시점의 session.t 가 **-0.338** 이었고, 0 을 넘을 때까지
//   18프레임이 걸렸다. 그동안 화면은 통째로 정지 — f00000~f00017 이 **바이트 단위로 동일**하다.
//   (비디오는 정상이었다: readyState 4 · currentTime 정상 증가. 디코더 문제가 아니었다.)
//   가상 시계는 계속 밀되 세션이 실제로 시작한 프레임부터 저장한다.
let saved = 0;                    // 저장한 프레임 수 — 파일 번호는 이걸 쓴다
const PRE_MAX = 240;              // 안전장치: 이만큼 밀어도 안 시작하면 그냥 저장한다
for (let i = 0; saved < N; i++) {
  const t = T0 + i / FPS;
  if (i - saved > PRE_MAX) { console.log('  ⚠ 프리롤 한계 — session.t 가 끝내 0 을 못 넘었습니다'); }
  // ★ 4K + 큰 uiscale 은 GPU 메모리를 넘겨 컨텍스트를 잃는다(실측: 3840·배율2.5 에서 11프레임째
  //   __dbg 통째로 소실). 죽으면 조용히 끝내고 여기까지 뽑은 프레임으로 영상을 묶는다.
  if (reloaded > 1) {
    console.error(`
✗ 프레임 즈음 페이지가 리로드됐습니다 — 이후 프레임은 전부 빈 화면이 됩니다.`);
    console.error('  vite 가 산출 파일을 소스 변경으로 보고 새로고침했을 수 있습니다(vite.config.js watch.ignored 확인).');
    break;
  }
  // ★ __dbg?.state 만 보면 안 된다 — WebGL 컨텍스트를 잃어도 JS 객체는 멀쩡히 남는다.
  //   그러면 렌더만 조용히 죽어 '완전 투명한 프레임'이 계속 쌓인다(실측: 4K 세 종목을 연달아
  //   돌렸더니 2·3번째가 480장 전부 불투명 픽셀 0.00% — 20분을 통째로 날렸다).
  //   컨텍스트를 직접 물어본다.
  const alive = await page.evaluate(() => {
    const d = window.__dbg; if (!d?.state) return false;
    const gl = d.renderer?.getContext?.();
    return !(gl && gl.isContextLost && gl.isContextLost());
  }).catch(() => false);
  if (!alive) { console.log(`\n⚠ ${i}프레임에서 WebGL 컨텍스트 손실 — uiscale 을 낮추거나 종목을 하나씩 돌리세요.`); break; }
  await page.evaluate(tt => new Promise(res => {
    const d = window.__dbg;
    window.__vt = 1200 + tt * 1000;          // 가상 시계 — 셰이더·클록이 전부 이걸 본다
    // ★ 투사 UI 강제 재도색 — 게이트가 두 겹이라 둘 다 풀어야 한다(export_ui.mjs 와 같은 수법).
    //   ① _lastPaint: UI_FPS(기본 12) 스로틀. 실시간 예산용인데 내보내기는 프레임당 수 초 걸리는
    //      오프라인 렌더라 의미가 없다. ?uifps=60 으로 올려도 안 된다 — 가상 시계 간격이 정확히
    //      1/60 이라 `t - _lastPaint < 1/UI_FPS` 가 부동소수점 경계에 걸려 한 프레임 걸러 스킵한다.
    //   ② _sig: floorgl 의 서명 비교. _sigOf() 가 시간을 Math.round(t*24) 로 24Hz 양자화하므로
    //      60fps 로 뽑아도 지면 UI 는 24fps 로 덜컹인다.
    //   실측: 이 두 줄 없이 러닝 5초 299쌍 중 232쌍이 완전 중복 — 씬은 도는데 UI 만 멈춰 있다.
    for (const g of [d.floorGL, d.wallGL]) if (g) { g._lastPaint = -1; g._sig = null; }
    if (window.__flatCam) d.composer.passes[0].camera = window.__flatCam;   // 앱이 되돌려 놓지 못하게
    // ★ 시간 모델 두 가지.
    //   기본(스크럽): playing=false 로 두고 t 를 직접 꽂는다. 앱이 시간의 순수 함수인 부분
    //     (셰이더 토큰·UI 트윈)은 이걸로 완벽히 재현된다.
    //   --play(시뮬): 재생을 켜고 가상 시계가 밀게 둔다. 봇·물리처럼 '상태를 쌓아 가는' 것은
    //     스크럽으로 되살릴 수 없다 — 실측: 러닝 C2 는 스크럽에서 0.95초 뒤 완전 정지한다
    //     (라이브 수치가 봇 프로브에서 오는데 봇이 얼어 있어서). 가상 시계가 우리 것이라
    //     재생을 켜도 결정론은 그대로다: 같은 명령 = 같은 프레임.
    if (window.__play) { d.state.playing = true; }
    else { d.state.playing = false; d.state.time = tt; if (d.session?.active) d.session.t = tt; }
    // ★ <video> 를 가상 시계에 묶는다 — 이게 '16배속'의 진짜 원인이었다.
    //   performance.now·Date.now·rAF 는 우리가 가로챘지만 미디어 클록은 못 가로챈다.
    //   비디오는 실제 시간으로 계속 재생되는데 프레임 한 장 렌더에 0.2~0.5초가 걸리므로,
    //   내보낸 1/60초 사이에 영상은 0.2~0.5초어치 진행한다(실측: 가상 시계 +0.0167s 동안
    //   bhandle_pp.mp4 의 currentTime 이 1.0초 이동). 인물 실루엣만 12~30배로 빨라진다.
    //   UI·토큰은 가상 시계라 정상 속도 → '사람만 미친 듯이 빠른' 그림이 된다.
    //   재생을 멈추고 프레임마다 currentTime 을 직접 찍는다. 시크는 비동기라 기다려야 한다.
    // ★ 깜빡임(유저 신고)의 원인이 이 블록에 세 겹으로 있었다. 실측: 러닝 180장 중 28장에서
    //   불투명 커버리지가 10% ↔ 4.7% 로 진동 — 인물이 한 프레임 걸러 통째로 사라졌다.
    //     ① 매 프레임 pause() 를 다시 불렀다. paused 를 false 로 덮어 뒀으니 이 줄이 항상
    //        실행되고, 시크 직전의 pause() 는 진행 중인 시크를 취소한다.
    //        → 정지는 셋업에서 한 번만 한다(아래 __pauseAll).
    //     ② setTimeout(…, 250) 은 **실제 시간**이다. 4K 는 프레임 하나에 1~2초가 걸려
    //        시크가 안 끝났는데도 250ms 뒤 렌더로 넘어갔다 — 그 프레임은 빈 디코드다.
    //     ③ 'seeked' 는 '시크가 끝났다'일 뿐 '그 프레임이 텍스처에 올라갔다'가 아니다.
    //        requestVideoFrameCallback 이 정확히 후자를 알려 준다.
    //     ④ **같은 값을 다시 써도 시크가 안 걸린다** — 이게 '한 번 빠지면 영영 안 돌아오는' 정체다.
    //        옛 코드는 (currentTime === want && readyState >= 2) 일 때만 통과시키고, 아니면
    //        v.currentTime = want 를 썼다. 그런데 currentTime 이 **이미** want 인데 디코드만
    //        비어 있는 경우(readyState 1 = HAVE_METADATA), 같은 값 대입은 no-op 이라 seeked 도
    //        requestVideoFrameCallback 도 영원히 안 온다 → 3초 안전장치로 넘어가고 그 프레임은
    //        빈 디코드. 다음 프레임도 같은 상태로 시작하니 회복 지점이 없다.
    //        실측(08-04 · BX_READY 240프레임): 3.87s 이후 readyState 가 1 로 고정, 인물이
    //        116~219 프레임 통째로 실종(55%). 어제 코드로 재현해도 같아서 코드 회귀가 아니었다 —
    //        프레임당 시간이 2.4s → 4.8s 로 늘며 3초 안전장치가 시크보다 먼저 터지기 시작한 것이
    //        방아쇠였고, 위 no-op 이 그걸 영구화했다.
    //        → 판정 기준을 **readyState 로** 바꾸고, 안 올라왔으면 값을 흔들어 진짜 시크를 건다.
    const vids = [...document.querySelectorAll('video')].filter(v => isFinite(v.duration) && v.duration > 0);
    Promise.all(vids.map(async v => {
      const want = v.loop ? (tt % v.duration) : Math.min(tt, v.duration);
      //     ⑤ **이벤트를 기다리면 안 된다.** requestVideoFrameCallback·seeked 는 렌더링 스텝에
      //        얹혀 오는데, 앱은 프레임 하나에 5~9초씩 WebGL 을 돌며 메인스레드를 붙잡는다.
      //        시크 자체는 끝났는데 통지가 그 뒤로 밀려서, 안전장치가 먼저 터지고 그 프레임은
      //        디코드 전 상태(readyState 1)로 찍힌다 = 인물 실종. 재시도해도 같은 이유로 또 밀린다.
      //        실측(08-04): buffered 0.00-8.00 (클립 전체가 버퍼에 있음) · networkState 1 (IDLE) ·
      //        error null 인데 readyState 만 1 — 데이터가 없어서가 아니라 통지가 안 온 것이다.
      //        → 상태를 **폴링**한다. setTimeout 은 메인스레드가 잠깐이라도 비면 돌고,
      //          그때 readyState 가 갱신돼 있다. 이벤트 도착 여부와 무관해진다.
      //        ★ 폴링으로 바꿔 봤지만(08-04) 회복률이 안 늘고 프레임당 시간만 2배가 됐다.
      //          근본은 대기 방식이 아니라 **프레임당 시간이 3초를 넘긴 것**이다. 1.77초로
      //          돌아가면 이 경합은 애초에 안 생긴다(어제 240/240 성공이 그 증거).
      //          그래서 대기는 문서 §6 이 검증한 원래 방식으로 되돌리고, **놓친 프레임을
      //          세는 것만** 남긴다 — 조용히 실패하지 않는 게 이 수정의 전부다.
      const ok = () => Math.abs(v.currentTime - want) < 1e-3 && v.readyState >= 2;
      if (!ok()) {
        await new Promise(r => {
          let settled = false;
          const fin = () => { if (settled) return; settled = true; r(); };
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => fin());
          else v.addEventListener('seeked', fin, { once: true });
          v.currentTime = want;
          setTimeout(fin, 3000);        // 안전장치. 짧으면 그게 곧 깜빡임이다
        });
      }
      // 통지가 왔든 안 왔든, 프레임이 실제로 올라왔는지로 판정한다.
      if (v.readyState < 2) window.__seekMiss = (window.__seekMiss || 0) + 1;
    })).then(() => {
      // 첫 rAF 는 앱의 갱신·렌더가 끝난 뒤에 돈다(앱 루프가 먼저 등록돼 있다) — 거기서 무대를
      // 다시 끄고 카메라를 투사면에 다시 맞추면, 두 번째 틱의 렌더가 그 상태로 그린다.
      requestAnimationFrame(() => { window.__isolate3d?.(); window.__fitFlat?.(); requestAnimationFrame(res); });
    });
  }), t);
  if (process.env.NEWTON_PROBE) {
    const p = await page.evaluate(() => {
      const s = window.__dbg?.session, v = [...document.querySelectorAll('video')].filter(x => isFinite(x.duration) && x.duration > 0);
      return { st: s?.t, stage: s?.stage?.id ?? s?.cur?.id, playing: window.__dbg?.state?.playing,
               vid: v.map(x => `${(x.currentTime).toFixed(3)}/${x.readyState}`).join(' ') };
    });
    console.log(`  probe f${i}  t=${t.toFixed(3)}  session.t=${p.st?.toFixed?.(3)}  stage=${p.stage}  play=${p.playing}  vid=${p.vid}`);
  }
  if (PLAY && saved === 0 && (i - saved) <= PRE_MAX) {
    const notYet = await page.evaluate(() => (window.__dbg?.session?.t ?? 0) < 0).catch(() => false);
    if (notYet) continue;   // 아직 스테이지 전 — 시계만 밀고 버린다
    // 저장을 시작하는 이 프레임이 스테이지 0초다. 벽/지면 UI 는 자기 누적기(_uiDt·실시간)로
    //   도는데 세션과 시작점이 다르면 그만큼 어긋난다 — 점수가 링보다 먼저 오른다.
    //   여기서 한 번 맞춰 두면 이후로는 둘 다 실시간이라 계속 같이 간다.
    await page.evaluate(() => {
      const d = window.__dbg;
      for (const g of [d?.wallGL, d?.floorGL]) if (g) { g.t = 0; g._lastPaint = -1; g._sig = null; }
    }).catch(() => {});
  }
  await page.screenshot({ path: path.join(TMP, `f${String(saved).padStart(5, '0')}.png`), type: 'png', omitBackground: ALPHA });
  saved++;
  // ★ 첫 프레임에 아무것도 안 그려졌으면 즉시 멈춘다. 컨텍스트가 살아 있어도 씬이 통째로
  //   비어 있으면(무대 끄기가 과했거나 카메라가 엉뚱한 곳을 보면) 끝까지 빈 프레임만 쌓인다.
  if (saved === 1) {
    const tri = await page.evaluate(() => window.__dbg?.renderer?.info?.render?.triangles ?? -1);
    if (tri === 0) {
      console.error('✗ 첫 프레임에 그려진 삼각형이 0개 — 빈 영상이 됩니다. 중단합니다.');
      await browser.close(); process.exit(1);
    }
    if (i > 0) console.log(`\n  프리롤 ${i}프레임 버림 (스테이지 시작 전)`);
    // 프리플라이트에서 이미 내용 있는 프레임을 확인했으므로 여기선 더 볼 게 없다.
  }
  done = saved;
  if (saved % 10 === 0 || saved === N) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${saved}/${N}  ${el.toFixed(0)}s  (${(el / saved).toFixed(2)}s/프레임)   `);
  }
}
process.stdout.write('\n');
// 렌더가 끝난 시점에 캔버스 밖 DOM 이 아직 보이면 그건 프레임에 새어 든 것이다 — 조용히 넘기지 않는다.
const leaked = await page.evaluate(() => {
  const cvs = window.__dbg?.renderer?.domElement; if (!cvs) return [];
  return [...document.querySelectorAll('body *')]
    .filter(el => !el.contains(cvs) && getComputedStyle(el).display !== 'none'
                  && el.getBoundingClientRect().width > 0)
    .map(el => `${el.tagName}#${el.id || ''}.${el.className || ''}`.slice(0, 60)).slice(0, 8);
}).catch(() => []);
if (leaked.length) console.log(`⚠ 캔버스 밖에서 보이는 요소 ${leaked.length}건 — 프레임에 섞였을 수 있습니다:`, leaked);
// 시크가 끝내 안 끝난 프레임 — 그 프레임엔 인물(코치 클립)이 빠져 있다. 조용히 넘기면
//   '인물이 깜빡인다'로 나중에 발견된다(실측 08-04: 240장 중 132장 실종을 육안으로 알았다).
const seekMiss = await page.evaluate(() => window.__seekMiss || 0).catch(() => 0);
if (seekMiss) console.log(`⚠ 비디오 시크 실패 ${seekMiss}건 — 그만큼의 프레임에 인물이 빠졌습니다.`);
else console.log('  비디오 시크 전부 성공 — 인물 빠진 프레임 없음');
if (!done) { console.log('프레임이 하나도 없습니다 — 중단.'); await browser.close(); process.exit(1); }
if (done < N) console.log(`  (${done}/${N} 프레임으로 묶습니다 — ${(done / FPS).toFixed(1)}초)`);

// ffmpeg 는 선택이다 — 에펙에 얹을 최종물은 PNG 시퀀스이고, .mov 는 편의용 사본일 뿐이다.
// (윈도엔 시스템 ffmpeg 가 없는 기기가 있다 — 그때 여기서 죽으면 뽑아 둔 프레임까지 날린다.
//  ffmpeg-static 이 깔려 있으면 그 바이너리를 쓴다: 시스템 설치 없이 .mov/.mp4 가 나온다.)
const FF = await import('ffmpeg-static').then(m => m.default).catch(() => 'ffmpeg');
const hasFF = (() => {
  try { execFileSync(FF, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
})();
// ★ 프레임을 먼저 산출 폴더로 옮기고 나서 인코딩한다 — 순서가 중요하다.
//   예전엔 TMP 에서 바로 인코딩하고 그 뒤에 옮겼다. mp4 인코딩이 실패하면 예외가 스크립트를
//   죽여 20분치 4K 프레임이 임시 폴더에 갇혔다(실측: 홀수 높이 3841 로 libx264 가 죽음).
//   렌더가 끝난 프레임은 무조건 먼저 건진다. 인코딩은 그다음 문제다.
const seq = path.join(OUT, `${tag}_png`);
fs.rmSync(seq, { recursive: true, force: true });
fs.renameSync(TMP, seq);
const SRC = path.join(seq, 'f%05d.png');
const made = [`${seq}${path.sep}  (PNG 시퀀스 ${done}장 · ${W * SS}×${H * SS}${ALPHA ? ' · 알파 보존' : ''})`];

// 인코딩은 실패해도 넘어간다 — 최종물은 PNG 시퀀스이고 .mov/.mp4 는 편의용 사본이다.
const enc = (label, out, args) => {
  try { execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', SRC, ...args, out],
    { stdio: ['ignore', 'ignore', 'ignore'] }); made.push(out); }
  catch { console.log(`⚠ ${label} 인코딩 실패 — 건너뜁니다(PNG 시퀀스는 위에 있습니다).`); }
};
if (hasFF) {
  // ProRes 4444 — 에펙에 그대로 임포트. 홀수 크기도 받는다.
  // SS 배로 렌더했으면 여기서 줄인다 — lanczos 로 내리는 게 GPU 안티에일리어싱보다 깨끗하다.
  const DOWN = SS > 1 ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : [];
  enc('ProRes', path.join(OUT, `${tag}.mov`),
    [...DOWN, '-c:v', 'prores_ks', '-profile:v', '4444',
     '-pix_fmt', ALPHA ? 'yuva444p10le' : 'yuv444p10le']);
  // 미리보기용 H.264 — ★ 짝수 크기로 내려야 한다. 평면 뷰는 대지 비율을 따르므로 홀수가 흔하다
  //   (벽 3840×2363 · 지면 2302×3841). libx264 는 홀수 높이를 못 쓴다.
  // ★ 미리보기는 **하위 폴더로 내린다**. 알파가 없는 검은 배경 파일이고 압축도 세다
  //   (실측: 3초 4K 농구가 1.17MB). 최종물 .mov 와 이름이 한 글자 차이라 에펙에 이걸 잘못
  //   넣으면 정확히 "배경이 검고 블러가 뭉갠" 그림이 나온다. 아예 섞이지 않게 분리한다.
  const PV = path.join(OUT, 'preview_black_bg_NOT_for_AE');
  fs.mkdirSync(PV, { recursive: true });
  enc('H.264 미리보기', path.join(PV, `${tag}_preview.mp4`),
    ['-vf', `scale=${W - (W % 2)}:${H - (H % 2)}:flags=lanczos`,
     '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p']);
} else console.log('ⓘ ffmpeg 없음 — PNG 시퀀스만 냅니다(에펙은 이걸 그대로 읽습니다).');

// ── 검수 ────────────────────────────────────────────────────────────────────
//   "에펙에서 열었더니 배경이 검다"를 여기서 잡는다. 3장만 보면 놓친다 — 한 프레임만
//   불투명해도 그 순간 검은 사각형이 번쩍인다(실측: 농구 BK_B3 f1 만 모서리 알파 255).
//   깜빡임도 같이 본다: 커버리지가 프레임 사이에서 크게 진동하면 인물이 사라졌다 나타난 것이다.
if (ALPHA && done) {
  const step = Math.max(1, Math.floor(done / 20));
  const pick = [...new Set([...Array(done).keys()].filter(i => i % step === 0).concat(done - 1))];
  const rep = [];
  for (const i of pick) {
    const f = path.join(seq, `f${String(i).padStart(5, '0')}.png`);
    if (!fs.existsSync(f)) continue;
    const png = PNG.sync.read(fs.readFileSync(f));
    const at = (x, y) => png.data[(y * png.width + x) * 4 + 3];
    const c = [at(0, 0), at(png.width - 1, 0), at(0, png.height - 1), at(png.width - 1, png.height - 1)];
    rep.push({ i, cov: await coverage(f), corner: Math.max(...c) });
  }
  const worst = rep.reduce((a, b) => (b.corner > a.corner ? b : a), rep[0]);
  const covs = rep.map(r => r.cov);
  const swing = Math.max(...covs) - Math.min(...covs);
  console.log(`  검수 ${rep.length}장 · 불투명 ${Math.min(...covs).toFixed(2)}~${Math.max(...covs).toFixed(2)}%`
    + ` · 모서리 알파 최대 ${worst.corner} (f${worst.i})`);
  const bad = rep.filter(r => r.cov < 0.05 || r.corner > 8);
  for (const r of bad) console.log(`  ✗ f${r.i}: 불투명 ${r.cov.toFixed(2)}% · 모서리 알파 ${r.corner}`);
  if (bad.length) console.log(`⚠ 검수 실패 ${bad.length}건 — 빈 프레임이거나 배경이 투명하지 않습니다.`);
  else console.log('  ✓ 배경 투명 확인 (네 모서리 알파 0) · 내용 있음');
  if (swing > 3) console.log(`⚠ 커버리지가 ${swing.toFixed(1)}%p 진동합니다 — 깜빡임 의심. scripts/measure_flicker.mjs 로 확인하세요.`);
}
console.log('\n✅ ' + made.join('\n   '));
if (errs.length) console.log(`⚠ 페이지 에러 ${errs.length}건:`, errs.slice(0, 3));
await browser.close();
