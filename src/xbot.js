import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BK_SCALE } from './tokens.js';   // 농구 경로 스케일 — 토큰과 공유(봇·마크 좌표 일치)
import { buildDrillClips } from './drills.js';   // 절차적 준비운동 드릴(A단계)

import xbotUrl from '../assets/xbot.fbx?url';
import runUrl from '../assets/anim-standard-run.fbx?url';
import hookUrl from '../assets/anim-hook.fbx?url';
import dribbleUrl from '../assets/anim-basketball-dribble.fbx?url';
import sidestepUrl from '../assets/anim-basketball-sidestep.fbx?url';
import warmupUrl from '../assets/warming_up.fbx?url';   // Mixamo 'Warming Up' — 스트레칭 검증용
// Mixamo 실측 모캡 (X Bot 리그 = 동일 스켈레톤, 리타겟 불필요) — 복싱·농구 준비운동/스텝
import boxJabUrl from '../assets/anim-box-jab.fbx?url';       // Lead Jab
import boxComboUrl from '../assets/anim-box-combo.fbx?url';   // Jab Cross
import boxGuardUrl from '../assets/anim-box-guard.fbx?url';   // Boxing (가드·풋워크)
import bkStanceUrl from '../assets/anim-bk-stance.fbx?url';   // Ready Idle (애슬레틱 스탠스)
import breathingIdleUrl from '../assets/anim-breathing-idle.fbx?url';   // Mixamo 'Breathing Idle' — 러닝 대기 자연 호흡
import jumpingJacksUrl from '../assets/anim-jumping-jacks.fbx?url';   // Mixamo 'Jumping Jacks' — 러닝 준비운동(실측 모캡)
import neckStretchUrl from '../assets/anim-neck-stretch.fbx?url';   // Mixamo 'Neck Stretching' — 전환 대기 정리(실측)
import armStretchUrl from '../assets/anim-arm-stretch.fbx?url';     // Mixamo 'Arm Stretching' — 전환 대기 정리(실측)
import airSquatUrl from '../assets/anim-air-squat.fbx?url';         // Mixamo 'Air Squat' — 농구 스쿼트(실측, 힙Y 정상)
import lbDribbleUrl from '../assets/anim-lb-dribble.fbx?url';       // Sketchfab 'LeBron Dribbles'(CC-BY, LasquetiSpice) — mixamorig 네이티브 드리블 3s
import bpDribbleUrl from '../assets/anim-bp-dribble.fbx?url';       // Sketchfab 'Dribbles Invisible Ball'(CC-BY, 동일 제작자) — 네이티브 1.6s 루프
import blCrossoverUrl from '../assets/anim-bl-crossover.fbx?url';   // Fab 크로스오버 → Blender 정식 리타겟(월드델타 베이크) 산출 mixamorig
import joggingUrl from '../assets/anim-jogging.fbx?url';            // Mixamo 'Jogging' — 예비(워밍업 조깅)
import bkBlockUrl from '../assets/anim-bk-block.fbx?url';           // Mixamo 'Defender'(점프 블록) — 농구 수비 예비
// Bandai Namco Research MotionDataset (CC BY-NC) — BVH 실측 리타겟 클립
import bkRunClipJson from '../assets/mocap/xclip-run_normal.json?url';
import bkDashClipJson from '../assets/mocap/xclip-dash_normal.json?url';
import bkKickClipJson from '../assets/mocap/xclip-kick_normal.json?url';
// 실사 영상 비디오모캡 (scripts/bake_pose_clip.mjs — MediaPipe 리타겟)
import quadStretchClipJson from '../assets/mocap/xclip-quad_stretch.json?url';
// CMU Graphics Lab 실측 모캡 (무료 라이선스, scripts/retarget_bvh.mjs)
import cmuStretchClipJson from '../assets/mocap/xclip-cmu_stretch.json?url';           // 42_01 전신 풀기
import cmuDribbleLowClipJson from '../assets/mocap/xclip-cmu_dribble_low.json?url';    // 06_13 로우 프리스타일 드리블
import cmuCrossoverClipJson from '../assets/mocap/xclip-cmu_crossover_shot.json?url';  // 06_14 크로스오버+슛
// Motifect Sports 팩 (유료 소스, 리타겟 산출물만 커밋 — 원본 FBX 재배포 금지)
import mfJumpShotClipJson from '../assets/mocap/xclip-mf_jump_shot.json?url';   // BK_C4 릴리즈 점프샷
import mfMarathonClipJson from '../assets/mocap/xclip-mf_marathon.json?url';    // 예비: 러닝 페이스 런
import mfLayupClipJson from '../assets/mocap/xclip-mf_layup.json?url';          // 예비: 레이업
// SFU/NUS 모캡 DB (무료·무가입, mocap.cs.sfu.ca) — 외부 무료팩 100% 이식 성공 사례
import sfuJumpRopeClipJson from '../assets/mocap/xclip-sfu_jumprope.json?url';  // 줄넘기 (워밍업 후보)
import sfuJoggingClipJson from '../assets/mocap/xclip-sfu_jogging.json?url';    // 조깅 (루트모션 보존)
// 햇지런 워밍업 영상 비디오모캡 (유저 제공 warmup_src.mp4 → 운동별 구간 베이크)
import hjLegswingClipJson from '../assets/mocap/xclip-hj_legswing.json?url';   // 레그 스윙 (A3)
import hjJjackClipJson from '../assets/mocap/xclip-hj_jjack.json?url';         // 점핑잭
import hjSquatClipJson from '../assets/mocap/xclip-hj_squat.json?url';         // 스쿼트
import hjSidelungeClipJson from '../assets/mocap/xclip-hj_sidelunge.json?url'; // 사이드 런지
import hjKneehugClipJson from '../assets/mocap/xclip-hj_kneehug.json?url';     // 니 허그
import hjSidebendClipJson from '../assets/mocap/xclip-hj_sidebend.json?url';   // 사이드 밴드
// CMU 추가분 — 스트레칭·워밍업 루틴·농구
import cmuStretch2ClipJson from '../assets/mocap/xclip-cmu_stretch2.json?url';           // 77_21 스트레칭
import cmuStretch3ClipJson from '../assets/mocap/xclip-cmu_stretch3.json?url';           // 83_22 스트레칭(장편)
import cmuWarmupRoutineClipJson from '../assets/mocap/xclip-cmu_warmup_routine.json?url';// 14_06 워밍업 루틴
import cmuCrossoverTurnClipJson from '../assets/mocap/xclip-cmu_crossover_turn.json?url';// 06_12 크로스오버+턴
import cmuDribbleShotClipJson from '../assets/mocap/xclip-cmu_dribble_shot.json?url';    // 06_15 드리블→슛
import rkStepbackClipJson from '../assets/mocap/xclip-rk_stepback.json?url';
import importedManifest from '../assets/imported/manifest.json';   // 인제스트 파이프라인 산출(scripts/ingest_fbx.mjs)
import autoManifest from '../assets/mocap/auto/auto-manifest.json';   // 대량 리타겟 자동 산출(--auto)
import cmuDribbleFwdClipJson from '../assets/mocap/xclip-cmu_dribble_fwd.json?url';   // CMU 06_02 전진 드리블(이동)
import cmuDribbleBackClipJson from '../assets/mocap/xclip-cmu_dribble_back.json?url'; // CMU 06_06 후진 드리블(이동)
import cmuDribbleSideClipJson from '../assets/mocap/xclip-cmu_dribble_side.json?url'; // CMU 06_08 사이드 드리블(이동)
import fabCrossoverClipJson from '../assets/mocap/xclip-fab_crossover.json?url';   // Fab 크로스오버(UE 마네킹→리타겟, 힙 회전만+런타임 클램프)
import mfDribbleBlUrl from '../assets/anim-mf-dribble-bl.fbx?url';        // Motifect 드리블 → Blender 리타겟(오브젝트 힙·다리비율 스케일)
import mfBlockClipJson from '../assets/mocap/xclip-mf_block.json?url';            // Motifect 블록 시도(수비 점프)
import mfChestPassClipJson from '../assets/mocap/xclip-mf_chest_pass.json?url';   // Motifect 체스트 패스
import mfSprintBlUrl from '../assets/anim-mf-sprint-bl.fbx?url'; // Motifect 스프린트 스타트 → Blender 리타겟    // Rokoko Vision 비디오 모캡 — 스텝백 튜토리얼(파운드→45°스텝백→개더→슛)
// Mixamo Stomping 좌+우(미러) 오프라인 합성 — 프레스(원 꾹 밟기) 교대 클립
import stompPressClipJson from '../assets/mocap/xclip-stomp_press.json?url';
import walkRightClipJson from '../assets/mocap/xclip-walk_right.json?url';   // 걷기(제자리 베이크) — C5 자연 감속용

// X Bot = 투사된 토큰 UI를 "따라하는 사람" 역할.
// 모든 안무는 팩 시간(packTime)의 순수 함수 → 루프/시크/속도 변경에 안전.

const RUN_PHASE_R = 0.47;   // 런 클립 오른발 착지 위상 — 판정 계측 2차 캘리브레이션 (잔차 +90ms 반영)
const HOOK_IMPACT = 0.34;   // 훅 클립에서 임팩트 지점 위상 (시각 튜닝값)

export class XBot {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();   // 팩별 루트 이동용
    scene.add(this.group);
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.decelK = 0;   // C5 자연 감속 진행도 0~1 (session이 구동, 러닝 라이브 전용)
    this.mode = null;
    this.schedule = null;
    this.feet = [];
  }

  async load() {
    const loader = new FBXLoader();
    const [xbot, runFbx, hookFbx, dribbleFbx, sidestepFbx, warmupFbx, boxJabFbx, boxComboFbx, boxGuardFbx, bkStanceFbx, breathingIdleFbx, jumpingJacksFbx, neckStretchFbx, armStretchFbx, airSquatFbx, joggingFbx, bkBlockFbx, lbDribbleFbx, bpDribbleFbx, blCrossoverFbx, mfDribbleBlFbx, mfSprintBlFbx] = await Promise.all([
      loader.loadAsync(xbotUrl),
      loader.loadAsync(runUrl),
      loader.loadAsync(hookUrl),
      loader.loadAsync(dribbleUrl),
      loader.loadAsync(sidestepUrl),
      loader.loadAsync(warmupUrl),
      loader.loadAsync(boxJabUrl),
      loader.loadAsync(boxComboUrl),
      loader.loadAsync(boxGuardUrl),
      loader.loadAsync(bkStanceUrl),
      loader.loadAsync(breathingIdleUrl),
      loader.loadAsync(jumpingJacksUrl),
      loader.loadAsync(neckStretchUrl),
      loader.loadAsync(armStretchUrl),
      loader.loadAsync(airSquatUrl),
      loader.loadAsync(joggingUrl),
      loader.loadAsync(bkBlockUrl),
      loader.loadAsync(lbDribbleUrl),
      loader.loadAsync(bpDribbleUrl),
      loader.loadAsync(blCrossoverUrl),
      loader.loadAsync(mfDribbleBlUrl),
      loader.loadAsync(mfSprintBlUrl),
    ]);

    xbot.scale.setScalar(0.01);
    xbot.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        if (o.material) {
          o.material = new THREE.MeshStandardMaterial({
            color: 0x9aa4b5, roughness: 0.55, metalness: 0.25,
          });
        }
      }
      if (o.isBone && /ToeBase$|Foot$/.test(o.name)) this.feet.push(o);
    });
    this.model = xbot;
    this.group.add(xbot);

    this.mixer = new THREE.AnimationMixer(xbot);
    const reg = (name, fbx) => {
      const clip = fbx.animations[0];
      if (!clip) return;
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions[name] = { action, dur: clip.duration };
    };
    reg('run', runFbx);
    reg('hook', hookFbx);
    reg('dribble', dribbleFbx);
    reg('sidestep', sidestepFbx);
    reg('warmup', warmupFbx);
    reg('boxJab', boxJabFbx);       // 복싱 잽 폼
    reg('boxCombo', boxComboFbx);   // 복싱 잽-크로스 콤비
    reg('boxGuard', boxGuardFbx);   // 복싱 가드·풋워크
    reg('bkStance', bkStanceFbx);   // 농구 애슬레틱 스탠스
    reg('idle', breathingIdleFbx);  // 러닝 대기 자연 호흡 idle
    reg('jumpingJacks', jumpingJacksFbx);  // 러닝 준비운동 — 점핑잭(실측 모캡, 절차적 대체)
    reg('neckStretch', neckStretchFbx);    // 전환 대기 — 목 스트레칭(Mixamo 실측)
    reg('armStretch', armStretchFbx);      // 전환 대기 — 팔 스트레칭(Mixamo 실측)
    reg('airSquat', airSquatFbx);          // 농구 스쿼트(Mixamo 실측 — 힙Y 정상 하강)
    reg('jogging', joggingFbx);            // 예비 — 조깅(Mixamo 실측)
    reg('bkBlock', bkBlockFbx);            // 예비 — 농구 점프 블록(Mixamo 실측)

    // 실측 모캡 클립 (Bandai BVH → 오프라인 리타겟)
    // 모캡 JSON은 ?url 임포트(런타임 fetch) — 번들에 인라인하면 main.js가 100MB+로 폭증.
    const _clipJobs = [];
    const regJson = (name, url) => {
      _clipJobs.push(fetch(url).then(r => r.json()).then(json => {
        const clip = THREE.AnimationClip.parse(json);
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        this.actions[name] = { action, dur: clip.duration };
      }).catch(e => console.warn('클립 로드 실패', name, e)));
    };
    regJson('bkRun', bkRunClipJson);
    regJson('bkDash', bkDashClipJson);
    regJson('bkKick', bkKickClipJson);
    regJson('quadStretch', quadStretchClipJson);   // FIN 쿨다운 쿼드 스트레치 — quad_src.mp4 실사 비디오모캡
    regJson('cmu_stretch', cmuStretchClipJson);            // A1 전신 풀기
    regJson('cmu_dribble_low', cmuDribbleLowClipJson);     // BK_A3·BK_B3 로우 드리블·컷
    regJson('cmu_crossover_shot', cmuCrossoverClipJson);   // BK_B1·B2 크로스오버+슛
    regJson('mf_jump_shot', mfJumpShotClipJson);
    regJson('mf_marathon', mfMarathonClipJson);
    regJson('mf_layup', mfLayupClipJson);
    regJson('sfu_jumprope', sfuJumpRopeClipJson);
    regJson('sfu_jogging', sfuJoggingClipJson);
    regJson('walk', walkRightClipJson);   // 걷기 — C5 자연 감속(런→조깅→걷기)
    regJson('hj_legswing', hjLegswingClipJson);
    regJson('hj_jjack', hjJjackClipJson);
    regJson('hj_squat', hjSquatClipJson);
    regJson('hj_sidelunge', hjSidelungeClipJson);
    regJson('hj_kneehug', hjKneehugClipJson);
    regJson('hj_sidebend', hjSidebendClipJson);
    regJson('cmu_stretch2', cmuStretch2ClipJson);
    regJson('cmu_stretch3', cmuStretch3ClipJson);
    regJson('cmu_warmup_routine', cmuWarmupRoutineClipJson);
    regJson('cmu_crossover_turn', cmuCrossoverTurnClipJson);
    regJson('cmu_dribble_shot', cmuDribbleShotClipJson);
    regJson('rk_stepback', rkStepbackClipJson);   // 클린 AI 모캡 — B단계 스텝 소스 후보
    reg('lb_dribble', lbDribbleFbx);   // mixamorig 네이티브(Sketchfab) — 리타겟 0, 원본 품질
    reg('bp_dribble', bpDribbleFbx);   // 네이티브 드리블 2호(1.6s 루프)
    reg('bl_crossover', blCrossoverFbx);   // Blender 리타겟 검증 1호 — 성공 시 Fab UE 애니 전체 개방
    // ── 외부 이식 클립 자동 등록: assets/imported/*.fbx — 코드 수정 없이 인제스트만으로 장착 ──
    {
      const urls = import.meta.glob('../assets/imported/*.fbx', { eager: true, query: '?url', import: 'default' });
      for (const [pth, url] of Object.entries(urls)) {
        const nm = 'imp_' + pth.split('/').pop().replace(/\.fbx$/i, '');
        try {
          const fbx = await loader.loadAsync(url);
          reg(nm, fbx);
          this._vmClips.add(nm);
          const meta = importedManifest[nm.slice(4)];
          if (meta?.grounded) this._groundedClips.add(nm);
        } catch (e) { console.warn('이식 클립 로드 실패', nm, e); }
      }
    }
    regJson('fab_crossover', fabCrossoverClipJson);   // 유저 확보 Fab 크로스오버
    reg('mf_dribble', mfDribbleBlFbx);
    regJson('mf_block', mfBlockClipJson);
    regJson('mf_chest_pass', mfChestPassClipJson);
    regJson('cmu_dribble_fwd', cmuDribbleFwdClipJson);
    regJson('cmu_dribble_back', cmuDribbleBackClipJson);
    regJson('cmu_dribble_side', cmuDribbleSideClipJson);
    reg('mf_sprint_start', mfSprintBlFbx);
    regJson('stomp_press', stompPressClipJson);   // 프레스 원 꾹 밟기 (Stomping L+R 합성)
    // 실측 모캡 클립 = 실사람 미세 움직임 포함 → playDemo 호흡 레이어 제외 대상(섞으면 포즈 희석)
    this._vmClips = new Set(['quadStretch', 'cmu_stretch', 'cmu_dribble_low', 'cmu_crossover_shot', 'jumpingJacks', 'mf_jump_shot', 'mf_marathon', 'mf_layup']);
    // keepRootXZ 베이크 클립(몸이 실제 이동) — 재생 시 힙 XZ 고정(_lockInPlace) 제외 대상
    this._rootClips = new Set(['mf_boxing_footwork', 'sfu_jogging', 'cmu_crossover_turn', 'rk_stepback', 'mf_sprint_start', 'cmu_dribble_fwd', 'cmu_dribble_back', 'cmu_dribble_side']);
    for (const k of ['bl_crossover', 'mf_dribble', 'mf_block', 'mf_chest_pass', 'mf_sprint_start', 'bp_dribble', 'fab_crossover', 'lb_dribble', 'rk_stepback', 'sfu_jumprope', 'sfu_jogging', 'cmu_stretch2', 'cmu_stretch3', 'cmu_warmup_routine', 'cmu_crossover_turn', 'cmu_dribble_shot',
      'hj_legswing', 'hj_jjack', 'hj_squat', 'hj_sidelunge', 'hj_kneehug', 'hj_sidebend', 'neckStretch', 'armStretch', 'airSquat', 'jogging', 'bkBlock', 'stomp_press']) this._vmClips.add(k);
    // 접지 베이크 완료 클립 — 재생 시 per-frame 발 클램프 제외(점프와 싸우며 덜커덩 만들던 것).
    // 접지는 리타겟 스크립트가 클립 전 구간 1회 정렬(소스 독립 설계 — 어떤 팩이 와도 동일).
    this._groundedClips = new Set(['cmu_stretch', 'cmu_stretch2', 'cmu_stretch3', 'cmu_warmup_routine',
      'cmu_dribble_low', 'cmu_crossover_shot', 'cmu_crossover_turn', 'cmu_dribble_shot',
      'mf_jump_shot', 'mf_layup', 'mf_marathon', 'mf_boxing_footwork', 'mf_dribble', 'mf_block', 'mf_chest_pass', 'mf_sprint_start', 'sfu_jumprope', 'sfu_jogging', 'rk_stepback', 'cmu_dribble_fwd', 'cmu_dribble_back', 'cmu_dribble_side']);

    // ── 대량 리타겟 클립 자동 등록: assets/mocap/auto/*.json (--auto 산출) ──
    // 반드시 _vmClips/_rootClips/_groundedClips의 Set 리터럴 초기화 뒤에 — 앞에 두면 재할당이 auto 플래그를 전부 지움(루트클립 힙 고정→발 미끄러짐).
    {
      const jsons = import.meta.glob('../assets/mocap/auto/*.json', { eager: true, query: '?url', import: 'default' });
      for (const [pth, url] of Object.entries(jsons)) {
        if (pth.endsWith('auto-manifest.json')) continue;
        const nm = 'auto_' + pth.split('/').pop().replace(/\.json$/i, '');
        const meta = autoManifest[nm.slice(5)] || {};
        if (meta.qaFail) continue;   // 시각 QA 불합격 — 파일은 보존(재리타겟 후보), 등록만 차단
        try {
          regJson(nm, url);
          this._vmClips.add(nm);
          this._groundedClips.add(nm);
          if (meta.root) this._rootClips.add(nm);
        } catch (e) { console.warn('auto 클립 등록 실패', nm, e); }
      }
    }
    await Promise.all(_clipJobs);   // 모든 모캡 클립 fetch+parse 완료 대기 (이후 this.actions 사용 보장)

    this._hips = xbot.getObjectByName('mixamorigHips');
    this._kneeR = xbot.getObjectByName('mixamorigRightLeg');
    this._kneeL = xbot.getObjectByName('mixamorigLeftLeg');   // 미러 시 프로젝터 앵커 스위칭용
    this._head = xbot.getObjectByName('mixamorigHead');
    this._footL = xbot.getObjectByName('mixamorigLeftToeBase') || xbot.getObjectByName('mixamorigLeftFoot');
    this._footR = xbot.getObjectByName('mixamorigRightToeBase') || xbot.getObjectByName('mixamorigRightFoot');
    this._wristR = xbot.getObjectByName('mixamorigRightHand');
    this._shoulderR = xbot.getObjectByName('mixamorigRightArm');
    this._elbowR = xbot.getObjectByName('mixamorigRightForeArm');

    // 농구 드리블 공 — 손 옆에서 박자에 맞춰 튕김 (물리 없이 스크립트 바운스)
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xd7622a, roughness: 0.75, metalness: 0.04 }),
    );
    this.ball.castShadow = true;
    this.ball.visible = false;
    this.scene.add(this.ball);

    // 손가락+손목 본 — 모캡 리타겟 시 벌어지는(splay)·꺾이는 아티팩트 방지:
    // 로드 직후 바인드 포즈를 캡처하되, 손가락 마디는 '이완 손'(마디당 22° 굴곡, 엄지 8°)으로
    // 고정 — 바인드 그대로면 쫙 편 판자손이라 모든 동작에서 어색(유저: '손동작 너무 어색').
    // 굴곡 축 = 로컬 X+ (수치 프로빙: 팁이 손바닥 쪽으로 — X-는 역젖힘, Z는 측면 꺾임).
    this._fingerBones = [];
    const _curlQ = new THREE.Quaternion();
    xbot.traverse(o => {
      if (o.isBone && /Hand(Thumb|Index|Middle|Ring|Pinky)\d|Hand$/.test(o.name)) {
        o.userData.rest = o.quaternion.clone();   // 바인드 포즈
        const m = o.name.match(/Hand(Thumb|Index|Middle|Ring|Pinky)\d/);
        if (m) {
          const deg = m[1] === 'Thumb' ? 8 : 22;
          _curlQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg));
          o.userData.rest.multiply(_curlQ);       // 이완 커브를 고정 타깃에 베이크
        }
        this._fingerBones.push(o);
      }
    });

    this._buildDrills();   // 절차적 준비운동 드릴 등록 (봇이 실제 그 동작 수행)
  }

  /** 준비운동(A단계) 드릴 클립을 스켈레톤에 저작·등록.
      베이스 = idle(Breathing Idle) 프레임0 = 똑바로 선 자연 포즈. (warmup 프레임0은 웅크린 대기라
      드릴이 전부 크라우치로 보였음 — 유저 지적. idle 없으면 warmup 폴백) */
  _buildDrills() {
    const baseKey = this.actions.idle ? 'idle' : (this.actions.warmup ? 'warmup' : null);
    const wa = this.actions[baseKey]; if (!wa) return;
    for (const k in this.actions) { const a = this.actions[k].action; a.stop(); a.setEffectiveWeight(k === baseKey ? 1 : 0); a.play(); a.paused = true; }
    wa.action.time = 0; this.mixer.update(0);
    const want = [
      'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead',
      'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot',
      'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigRightArm', 'mixamorigRightForeArm',
      'mixamorigLeftShoulder', 'mixamorigRightShoulder',
    ];
    const neutral = {};
    for (const n of want) { const b = this.model.getObjectByName(n); if (b) neutral[n] = b.quaternion.clone(); }
    this._neutralPose = neutral;   // 팔 중립 덮어쓰기(_relaxArms)용 보관
    this._armNeutralClips = new Set(['auto_cmu144_17', 'auto_cmu144_17_one', 'auto_cmu144_11']);   // 팔 어색 모캡(머리 뒤로 올라감 등) — 팔만 중립 덮어쓰기, 다리 리듬은 유지
    const clips = buildDrillClips(neutral);
    for (const id in clips) {
      const action = this.mixer.clipAction(clips[id]);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions[id] = { action, dur: clips[id].duration };
    }
    for (const k in this.actions) { this.actions[k].action.stop(); this.actions[k].action.setEffectiveWeight(1); }
  }

  /** 팔 전체를 중립(늘어뜨림)으로 덮어쓰기 — 모캡 클립의 어색한 팔만 무력화(다리는 실측 유지).
      대상 클립: _armNeutralClips (예: cmu144_17 교대 런지 — 유저: '손만 자연스럽게') */
  _relaxArms() {
    if (!this._neutralPose) return;
    const t = this._breathT || 0;
    for (const n of ['mixamorigLeftShoulder', 'mixamorigRightShoulder', 'mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftForeArm', 'mixamorigRightForeArm']) {
      const b = this.model.getObjectByName(n), q = this._neutralPose[n];
      if (!b || !q) continue;
      b.quaternion.copy(q);
      // 미세 스웨이(±2°) — 판자팔 방지, 좌우 위상 어긋나게 (유저: '자연스럽게 내리자')
      if (n.endsWith('Arm')) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(t * 1.3 + (n.includes('Left') ? 0 : 1.7)) * 0.035));
    }
    this.model.updateMatrixWorld(true);
  }

  /** 손가락·손목을 바인드 중립으로 고정 — 클립의 벌어진 손 아티팩트 덮어씀 */
  _lockFingers() {
    for (const b of this._fingerBones) b.quaternion.copy(b.userData.rest);
  }

  /** 판정용 실측 지점 (왼발/오른발/리드 주먹/몸 중심) */
  getProbes() {
    const w = o => o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
    return { footL: w(this._footL), footR: w(this._footR), wrist: w(this._wristR), hips: w(this._hips) };
  }

  /** 그림자 검증용 오른팔 세그먼트 (어깨·팔꿈치·손목 월드 좌표) */
  getRightArm() {
    const w = o => o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
    return { shoulder: w(this._shoulderR), elbow: w(this._elbowR), wrist: w(this._wristR) };
  }

  /** 눈 위치 (머리 본 + 오프셋) — 1인칭 시점/시야 콘 기준. 헤드밥은 본 추적으로 자동 반영 */
  getEyeWorld() {
    if (!this._head) return null;
    return new THREE.Vector3().setFromMatrixPosition(this._head.matrixWorld)
      .add(new THREE.Vector3(0, 0.11, 0));
  }

  /** 머리 본 월드 쿼터니언 — 1인칭 시선을 실제 머리 회전에 붙이기 위한 것(목돌리기 등).
      기준 쿼터니언(_headQ0, 첫 호출 시 캡처) 대비 상대 회전을 반환해, 시선이 목 움직임을 따라 흔들림. */
  getHeadSwing() {
    if (!this._head) return null;
    const q = new THREE.Quaternion();
    this._head.getWorldQuaternion(q);
    if (!this._headQ0) this._headQ0 = q.clone();
    return q.multiply(this._headQ0.clone().invert());   // Δ = 현재 · 기준⁻¹
  }
  resetHeadSwing() { this._headQ0 = null; }

  /** 프로젝터 모듈 기준 무릎 본 — 하드웨어는 항상 '월드 오른쪽 다리'에 고정(유저 확정).
      A2 비주얼 미러(scale.x<0) 시 월드-오른쪽에 있는 건 Left 본 → 스위칭. */
  getKneeWorld() {
    // 장착 다리 = 왼다리(유저 확정, 기하 검증): 오른손 드리블은 공이 오른쪽에서 튀므로
    // 광원을 왼다리 바깥에 둬야 광원-공 간격이 최대 → 그림자 쐐기가 필드 밖(우측)으로 밀린다.
    // 실측: 중앙 바운스(x+0.13)에서 오른다리 장착은 그림자가 정중앙(x+0.12), 왼다리는 x+0.33 가장자리.
    // 미러 시 반대 체인(오른다리) 사용 — 기존 규약 유지.
    const k = this.group.scale.x < 0 ? this._kneeR : this._kneeL;
    if (!k) return null;
    return new THREE.Vector3().setFromMatrixPosition(k.matrixWorld);
  }

  /** 정강이 방향(무릎→발목, 정규화) — 프로젝터 사출 축. 미러 시 Left 체인 사용(위와 동일 사유) */
  getRightShinDir() {
    const mir = this.group.scale.x < 0;   // 장착 = 왼다리(getKneeWorld와 동일 사유) — 이름은 역사적 잔재
    const k = mir ? this._kneeR : this._kneeL, f = mir ? this._footR : this._footL;
    if (!k || !f) return null;
    const knee = new THREE.Vector3().setFromMatrixPosition(k.matrixWorld);
    const ankle = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld);
    return ankle.sub(knee).normalize();
  }

  /** X Bot 몸체(그룹) 월드 위치 — 무릎 편차 계산의 기준 */
  /** 몸 앵커(추종 정본) — 그룹 트랜스폼이 아니라 실제 골반 본 월드행렬에서 위치·전방을 읽는다.
   *  루트모션 클립의 옆이동·클립 내 회전(뒤로 돌기)은 그룹이 모르는 변화라, 그룹을 보던
   *  빔프로젝터 풋프린트와 3인칭 카메라가 봇을 놓쳤음(유저: '나를 정확히 안 따라와').
   *  빔·카메라·지면 UI는 전부 이 하나를 소비 → 한 몸처럼 움직인다.
   *  위치는 강체 부착이므로 필터 없음(지연=떨어져 보임).
   *  전방은 저역통과(τ=0.6s, 짐벌 응답과 동일) + 데드존 20°: 골반은 걸음마다 ±수십도 흔들리므로
   *  그대로 쓰면 가이드 필드가 매 스텝 회전한다. 데드존 안이면 팩 정면(그룹 요) 유지, 넘으면 몸을 따라감
   *  = '진짜 도는 동작'만 추종. */
  getAnchor(dt = this._dt || 0.016) {
    if (this._anchor) return this._anchor;   // 프레임당 1회 계산 — 소비자가 여럿이라 필터가 중복 진행되면 τ가 망가짐
    const g = this.group.position;
    if (!this._hips) return (this._anchor = { x: g.x, z: g.z, fx: 0, fz: -1 });
    const e = this._hips.matrixWorld.elements;
    let fx = e[8], fz = e[10];   // 골반 로컬 +Z = 몸 정면 (READY 실측: getForward와 일치)
    const n = Math.hypot(fx, fz);
    if (n > 1e-4) { fx /= n; fz /= n; } else { fx = 0; fz = -1; }
    if (!this._anchFwd) this._anchFwd = { fx, fz };
    const a = 1 - Math.exp(-dt / 0.6);
    // 180° 근처 뒤집힘에서 최단 회전으로 붙게 — 성분 보간 후 재정규화(각도 언랩 불필요한 크기)
    this._anchFwd.fx += (fx - this._anchFwd.fx) * a;
    this._anchFwd.fz += (fz - this._anchFwd.fz) * a;
    const m = Math.hypot(this._anchFwd.fx, this._anchFwd.fz);
    if (m < 1e-3) { this._anchFwd.fx = fx; this._anchFwd.fz = fz; }
    else { this._anchFwd.fx /= m; this._anchFwd.fz /= m; }
    return (this._anchor = { x: e[12], z: e[14], fx: this._anchFwd.fx, fz: this._anchFwd.fz });
  }

  getBodyPos() {
    const a = this.getAnchor();
    return new THREE.Vector3(a.x, 0, a.z);
  }

  /** 몸 전방 벡터 (월드, 수평) — 농구는 골반 실측(컷·턴 추종), 러닝/복싱은 팩 기준 방향 고정 */
  getForward() {
    if (this.mode === 'basketball') {
      const a = this.getAnchor();
      const yaw = this.group.rotation.y;
      const px = -Math.sin(yaw), pz = -Math.cos(yaw);   // 팩 정면(그룹 요 — 컷 방향)
      // 데드존: 골반이 팩 정면에서 20° 안쪽이면 걸음 흔들림으로 보고 정면 유지
      return (a.fx * px + a.fz * pz) > 0.94
        ? new THREE.Vector3(px, 0, pz)
        : new THREE.Vector3(a.fx, 0, a.fz);
    }
    return new THREE.Vector3(0, 0, -1);  // 러닝/복싱: 전진·벽 방향
  }

  /** 팩 전환: 이벤트 스케줄에서 안무 데이터 구축 */
  setPack(packData, tokenEvents) {
    this._lastPack = [packData, tokenEvents];
    this.verifyClip = null;
    // 모든 액션 정지 + 가중치 복원 (stop()은 weight를 리셋하지 않음 — 검증 모드 잔재 방지)
    for (const k in this.actions) { const x = this.actions[k]; x.action.stop(); x.action.setEffectiveWeight(1); }
    this.mode = packData.sport;
    this.decelK = 0; this._dcT = 0; this._dcZ = null;   // C5 감속 상태 리셋
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);

    if (this.mode === 'running') {
      const rights = tokenEvents.filter(e => e.foot === 'right').map(e => e.t);
      const stride = rights.length >= 2
        ? (rights[rights.length - 1] - rights[0]) / (rights.length - 1)
        : 0.76;
      // 전문가 팩: botClip = 가이드를 추출한 원천 BVH의 리타겟 클립.
      // 팩 t가 클립 시간축 그대로라 packTime%사이클 = 클립 위상 — 발이 마크에 저절로 맞는다.
      const clipKey = packData.botClip && this.actions[packData.botClip] ? packData.botClip : 'run';
      this.schedule = { t0: rights[0] ?? 0, stride, V: 2.5, clipKey };  // 실측 2.5m/s 전진
      const a = this.actions[clipKey];
      a.action.play(); a.action.paused = true;
      this.model.rotation.y = Math.PI;   // -Z(전진 방향) 바라보기
    }

    if (this.mode === 'boxing') {
      const punches = tokenEvents.filter(e => e.surface === 'wall').map(e => e.t).sort((x, y) => x - y);
      const a = this.actions.hook;
      // 클립의 유효 구간만 사용 (도입/마무리 잘라내 과속 재생 방지)
      const seg0 = a.dur * 0.12, seg1 = a.dur * 0.78;
      let minGap = Infinity;
      for (let i = 1; i < punches.length; i++) minGap = Math.min(minGap, punches[i] - punches[i - 1]);
      const ts = Math.max(1, (seg1 - seg0) / Math.max(0.5, (isFinite(minGap) ? minGap : 1) * 0.92));
      this.schedule = { punches, ts, seg0, effDur: (seg1 - seg0) / ts };
      this._bxT = 0;
      a.action.play(); a.action.paused = true;
      this.model.rotation.y = Math.PI;
    }

    if (this.mode === 'basketball') {
      // 스텝 마크 경로: (t, x, z) 시퀀스
      const pts = tokenEvents
        .filter(e => e.surface === 'floor' && e.marker)
        .map(e => ({ t: e.t, x: e.srcToken.nx * BK_SCALE, z: e.srcToken.ny * BK_SCALE }))
        .sort((a, b) => a.t - b.t);
      // 플랜트 이벤트: 경로 방향 전환각 > 35°인 마크 = 컷 순간 (사이드 런지 원샷)
      const plants = [];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const v1 = Math.atan2(b.x - a.x, b.z - a.z);
        const v2 = Math.atan2(c.x - b.x, c.z - b.z);
        let dA = Math.abs(v2 - v1);
        if (dA > Math.PI) dA = Math.PI * 2 - dA;
        if (dA > THREE.MathUtils.degToRad(35)) plants.push(pts[i].t);
      }
      // 플랜트+가속 원샷: 실측 dash (정지→폭발 출발 = 컷인 본질)
      const ss = this.actions.bkDash || this.actions.sidestep;
      const SS_EFF = ss ? ss.dur : 0.55;
      const ssTs = 1;
      this.schedule = { path: pts, plants, ssTs, ssEff: SS_EFF, ssImpact: 0.35 };

      // 발-지면 동기: 이동 거리로 런 위상을 굴림 (풋 스케이팅 제거)
      this._bkPhase = 0;
      this._bkPrev = null;
      this._bkYaw = 0;    // model PI 기준: 초기 진행(-Z) = group yaw 0
      this._bkRunW = 0;
      this._bkPlantW = 0;
      const run = this.actions.bkRun || this.actions.run;
      const drb = this.actions.dribble;
      run.action.play(); run.action.paused = true; run.action.setEffectiveWeight(0);
      drb.action.play(); drb.action.paused = true; drb.action.setEffectiveWeight(1);
      if (ss) { ss.action.play(); ss.action.paused = true; ss.action.setEffectiveWeight(0); }
      this.model.rotation.y = Math.PI;
    }
  }

  setVerify(name) {
    this.verifyClip = name || null;
    this._vT = 0;
    if (!name && this._lastPack) this.setPack(this._lastPack[0], this._lastPack[1]);
  }

  /** 세션 비실전 단계 시연 — 지정 클립을 제자리 재생(코치가 동작을 보여줌).
      드릴은 지정 관절만 움직이므로(발목 돌리기=발만) 저강도 호흡 레이어(warmup 0.12)를
      깔아 전신이 살아 보이게 — '인물이 완전 정지' 오인 방지 */
  playDemo(name, dt, hold = false, phaseTime = null) {
    this._dt = dt; this._anchor = null;   // 프레임 시작 = 몸 앵커 캐시 무효화
    const key = this.actions[name] ? name : (this.actions.warmup ? 'warmup' : null);
    if (!key) return;
    const breathW = (key !== 'warmup' && !this._vmClips?.has(key) && this.actions.warmup) ? 0.18 : 0;
    // 스테이지 전환 크로스페이드(0.3s) — 즉시 가중치 스위치가 만들던 포즈 팝 제거
    if (this._demoKey !== key) { this._demoPrev = this._demoKey; this._demoKey = key; this._demoXf = 0; }
    this._demoXf = Math.min(1, (this._demoXf ?? 1) + dt / 0.3);
    const xf = this._demoXf, prev = this._demoPrev;
    for (const k in this.actions) {
      const x = this.actions[k]; x.action.play(); x.action.paused = true;
      const w = k === key ? xf : (k === prev ? 1 - xf : 0);
      x.action.setEffectiveWeight(Math.max(w, k === 'warmup' ? breathW * xf : 0));
    }
    const a = this.actions[key];
    // hold=가드 정지: 메인 클립은 대표 프레임에 고정(움직임 X), 호흡 레이어만 진행 → '가드 하고 가만히'
    this._breathT = (this._breathT || 0) + dt;
    // warmup=프레임0(손 내린 중립 서있기, 러닝 대기용) / 그 외=0.5·dur 대표 프레임(복싱 가드 등)
    if (hold) { a.action.time = key === 'warmup' ? 0 : 0.5 * a.dur; }
    else if (phaseTime != null) { a.action.time = phaseTime % a.dur; }   // 세션 스테이지 시간에 위상 잠금 → 씬 가이드(링·카운트)와 동기
    else { this._demoT = (this._demoT || 0) + dt; a.action.time = this._demoT % a.dur; }
    if (breathW) { const w = this.actions.warmup; w.action.time = (this._breathT * 0.5) % w.dur; }
    // demoStandZ: 세션이 지정한 서기 위치(복싱 = 카메라 인식 링) — 매 프레임 원점 리셋이
    // 외부 배치를 덮어쓰던 버그의 뿌리 (유저: '세션 시작해도 인물이 안 물러남')
    this.group.position.set(0, 0, this.demoStandZ || 0);
    this.mixer.update(0);
    // 루트모션 데모 클립은 XZ 고정 해제, 접지 베이크 클립은 per-frame 클램프 해제(덜커덩 방지)
    if (this._rootClips?.has(key)) { this._lockFingers(); this.model.position.x = 0; this.model.position.z = 0; this.model.updateMatrixWorld(true); }
    else this._lockInPlace?.();
    if (this._armNeutralClips?.has(key)) this._relaxArms();   // 팔만 중립 — 다리는 실측 유지 (유저: '손만 자연스럽게')
    if (this._groundedClips?.has(key)) { this.model.position.y = 0; this._yOff = undefined; this.model.updateMatrixWorld(true); }
    else this._clampFeet();   // 데모 클립 루트 높이 미보정 → 봇 공중부양(유저: 'x봇이 공중에 떠있는데') 방지
    // 데모 중 공 관리 (playDemo는 여태 공을 안 건드려 이전 live 위치가 멀리 남아있었음 — 유저: '공이 저 멀리').
    // 드리블 클립일 때만 손에 붙여 튕기고, 그 외(idle·스탠스·사이드스텝·READY)엔 숨김.
    if (this.ball) {
      // 공 게이트 — 클립 이름 화이트리스트로는 B단계 클립(크로스오버·124_0x)에서 공이 안 보였다.
      // _dribbleBall은 오른손목 Y의 하강→상승 전환을 실측 검출하므로 클립 종류를 안 가린다.
      if (this.mode === 'basketball' && /dribble|crossover|cmu124_0[3-6]|cmu86_14/.test(key)) this._dribbleBall(this._demoT || 0, dt);
      else this.ball.visible = false;
    }
    // 런지 깊이 노브(lungeDeepen 0..1, main A2가 구동) — CMU 144_17이 얕아(무릎 h 47cm)
    // 누름 구간에만 무릎·힙 굴곡을 가산해 '푹' 내려가게. 발은 아래 _clampFeet가 재접지.
    if (this.lungeDeepen > 0.001 && key && key.startsWith('auto_cmu144_1')) {
      const k = this.lungeDeepen, D = Math.PI / 180;
      const B = n => this.model.getObjectByName(n);
      const rx = (b, deg) => b && b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * D));
      // 앞다리(144_11=왼발) 중심 소량 가산 — 뒷무릎 가산 금지(뒤꿈치 차올림·튀김 전례)
      rx(B('mixamorigLeftUpLeg'), 14 * k);
      rx(B('mixamorigLeftLeg'), -22 * k);
      rx(B('mixamorigRightUpLeg'), -8 * k);   // 뒷다리 신전만
      rx(B('mixamorigRightFoot'), 12 * k);    // 뒷발 살짝 펴기 — 발가락 접힘 완화 (유저)
      rx(B('mixamorigSpine'), 3 * k);
      this.model.updateMatrixWorld(true);
      this._clampFeet?.();
    }
    // 최종 월드 확정 — 루트모션 상쇄(모델 오프셋) 이후를 rig가 읽도록. 미갱신 시 무릎 모듈이
    // 상쇄 전 원시 힙 위치(런 클립 최대 0.9m 앞)에 놓여 '프로젝터가 몸에서 떨어져 떠다님'.
    // (팩 경로는 판정 캘리브레이션이 기존 타이밍에 적합돼 있어 건드리지 않음)
    this.model.updateMatrixWorld(true);
    this._applyHeadPitch(dt);
  }

  /** 스텝백 합성 시연 — 네이티브 조각 3개를 이어붙임(관절 왜곡 0, 전부 검증된 클립):
      드리블(Mixamo) → 개더 0.35s 동안 '루트만' 0.48m 후방 이동(커리 실측 분리) → 실측 점프샷(mf).
      리타겟 신뢰 못하는 상황에서 품질 보장하는 유일한 길 = 검증된 포즈 + 절차적 루트 (stomp_press 전례). */
  stepbackDemo(dt) {
    const dribble = this.actions.dribble, shot = this.actions.mf_jump_shot;
    if (!dribble || !shot) return;
    this._dt = dt; this._anchor = null;   // 프레임 시작 = 몸 앵커 캐시 무효화
    const CYC = 4.2, GATH = 1.4;
    const T = (this._sbT = ((this._sbT || 0) + dt) % CYC);
    const xf = Math.min(1, Math.max(0, (T - GATH) / 0.25));
    for (const k in this.actions) {
      const x = this.actions[k]; x.action.play(); x.action.paused = true;
      x.action.setEffectiveWeight(k === 'dribble' ? 1 - xf : (k === 'mf_jump_shot' ? xf : 0));
    }
    dribble.action.time = T % dribble.dur;
    shot.action.time = Math.min(Math.max(0, T - GATH), shot.dur - 0.001);
    // 백스텝 분리 — 개더 구간 루트 슬라이드(이즈아웃). 포즈는 그대로, 몸 전체만 뒤로.
    const sep = Math.min(1, Math.max(0, (T - (GATH + 0.05)) / 0.35));
    const ofs = 0.48 * (1 - Math.pow(1 - sep, 2));
    this.group.position.set(0, 0, (this.demoStandZ || 0) + ofs);
    this.mixer.update(0);
    if (xf > 0.5) { this._lockFingers(); this.model.position.y = 0; this._yOff = undefined; this.model.position.x = 0; this.model.position.z = 0; this.model.updateMatrixWorld(true); }
    else { this._lockInPlace(); this._clampFeet?.(); }
    if (this.ball) {
      if (xf < 0.5) { this.ball.visible = true; this._dribbleBall(T, dt); }
      else this.ball.visible = false;
    }
    this.model.updateMatrixWorld(true);
    this._applyHeadPitch(dt);
  }

  /** 지면 화면(세션 컴플리트·전환·카운트다운)에서 3인칭 봇 머리를 아래로 숙여 바닥 UI를 응시.
      클립이 매 프레임 head.quaternion을 재설정하므로 그 위에 로컬 X 피치를 덧대면 누적 없이 안정. */
  _applyHeadPitch(dt) {
    if (!this._head) return;
    const tgt = this.headPitch || 0;
    this._headPitchCur = (this._headPitchCur || 0) + (tgt - (this._headPitchCur || 0)) * (1 - Math.exp(-(dt || 0.016) / 0.5));
    if (Math.abs(this._headPitchCur) < 1e-4) return;
    this._head.rotateX(this._headPitchCur);
    this.model.updateMatrixWorld(true);
  }

  update(packTime, dt = 0.016) {
    if (!this.model || !this.mode) return;
    this._dt = dt; this._anchor = null;   // 프레임 시작 = 몸 앵커 캐시 무효화

    // 모션 검증: 실측 모캡을 제자리 재생 — 무릎 투사가 버티는지 rig가 측정
    if (this.verifyClip && this.actions[this.verifyClip]) {
      for (const k in this.actions) {
        const x = this.actions[k];
        x.action.play(); x.action.paused = true;
        x.action.setEffectiveWeight(k === this.verifyClip ? 1 : 0);
      }
      const a = this.actions[this.verifyClip];
      this._vT = (this._vT || 0) + dt;
      a.action.time = this._vT % a.dur;
      this.mixer.update(0);
      this.group.position.set(0, 0, 0);
      // 루트모션 클립(keepRootXZ 베이크)은 힙 XZ 고정 금지 — 고정하면 이동량만큼 발이 미끄러짐
      if (this._rootClips?.has(this.verifyClip)) {
        this._lockFingers();
        this.model.position.x = 0; this.model.position.z = 0;
        this.model.updateMatrixWorld(true);
      } else this._lockInPlace?.();
      // 접지 베이크 클립 = 클램프 금지(점프 보존·덜커덩 제거), 그 외만 per-frame 접지
      if (this._groundedClips?.has(this.verifyClip)) { this.model.position.y = 0; this._yOff = undefined; this.model.updateMatrixWorld(true); }
      else this._clampFeet?.();   // 프리뷰/검증 클립 접지 (root 높이 미보정 방지)
      return;
    }

    if (this.mode === 'running') {
      const { t0, stride, V, clipKey } = this.schedule;
      const a = this.actions[clipKey || 'run'];
      // C5 자연 감속(decelK 0→1): 런→조깅→걷기 크로스페이드 + 전진속도 실감속.
      // 슬로모(liveSpeed) 아님 — 클립은 항상 정속 재생, 몸의 보법·속도만 느려진다.
      const dk = Math.min(1, this.decelK || 0);
      const wRun = Math.max(0, 1 - dk * 2), wWalk = Math.max(0, dk * 2 - 1), wJog = 1 - wRun - wWalk;
      // 가중치 확정 — playDemo(세션 드릴)가 잡아둔 가중치(run=0·드릴=1)가 남으면
      // 라이브/복귀 시 봇이 드릴 포즈로 얼어붙는다 (유저: '실전에서 가만히 멈춤')
      for (const k in this.actions) {
        const x = this.actions[k];
        x.action.play(); x.action.paused = true;
        x.action.setEffectiveWeight(k === (clipKey || 'run') ? wRun : k === 'jogging' ? wJog : k === 'walk' ? wWalk : 0);
      }
      if (clipKey && clipKey !== 'run') {
        // 원천 클립 직결: 팩 t = 클립 t (사이클 타일링) → 위상 보정 상수 불필요.
        // 주의: 클립 dur(0.767s=마지막 키프레임)와 사이클(0.8s=프레임 수×dt)이 달라
        // phase×dur로 스케일하면 사이클 내에서 위상이 밀린다 — 시간 그대로 쓰고 클램프.
        a.action.time = Math.min(((packTime % stride) + stride) % stride, a.dur - 1e-4);
      } else {
        const phase = (((packTime - t0) / stride) % 1 + 1) % 1;
        a.action.time = ((phase + RUN_PHASE_R) % 1) * a.dur;
      }
      if (dk > 0) {
        // 조깅·걷기는 자유 위상(정속 재생) — 감속 중엔 마크 위상 잠금이 무의미
        this._dcT = (this._dcT || 0) + dt;
        const jg = this.actions.jogging, wk = this.actions.walk;
        if (jg) jg.action.time = this._dcT % jg.dur;
        if (wk) wk.action.time = this._dcT % wk.dur;
      }
      this.mixer.update(0);
      // 실제 전진: 지면 고정 마크를 향해 이동. 감속 중엔 속도 적분(런 2.5→조깅 1.7→걷기 1.1 m/s)
      if (dk > 0) {
        if (this._dcZ == null) this._dcZ = -V * packTime;   // 감속 시작 지점에서 연속 이어받기
        const v = dk < 0.5 ? V + (1.7 - V) * dk * 2 : 1.7 + (1.1 - 1.7) * (dk - 0.5) * 2;
        this.group.position.z = (this._dcZ -= v * dt);
      } else {
        this._dcT = 0; this._dcZ = null;
        this.group.position.z = -V * packTime;
      }
      this._lockInPlace();
    }

    if (this.mode === 'boxing') {
      const { punches, ts, seg0, effDur } = this.schedule;
      const a = this.actions.hook;
      for (const k in this.actions) {   // 가중치 단독 확정 (드릴 잔존 방지)
        const x = this.actions[k];
        x.action.play(); x.action.paused = true;
        x.action.setEffectiveWeight(k === 'hook' ? 1 : 0);
      }
      let target = 0;  // 기본: 가드 포즈
      for (const tp of punches) {
        const start = tp - HOOK_IMPACT * effDur;
        if (packTime >= start && packTime < start + effDur) {
          target = seg0 + (packTime - start) * ts;
          break;
        }
      }
      // 펀치 진행은 즉시(타이밍 유지), 가드 복귀는 부드럽게 (스냅 방지)
      if (target >= this._bxT) this._bxT = target;
      else this._bxT += (target - this._bxT) * Math.min(1, dt * 7);
      a.action.time = Math.min(this._bxT, a.dur - 0.001);
      this.mixer.update(0);
      this._lockInPlace();
    }

    if (this.mode === 'basketball') {
      const { path } = this.schedule;
      const run = this.actions.bkRun || this.actions.run;
      const drb = this.actions.dribble;
      for (const k in this.actions) {   // 드릴 잔존 가중치 클리어 — 아래 자체 블렌딩이 필요한 것만 다시 세움
        const x = this.actions[k];
        x.action.play(); x.action.paused = true; x.action.setEffectiveWeight(0);
      }

      if (path.length >= 2) {
        const p = this._samplePath(packTime);
        // 이동량 → 런 위상 (발이 구른 만큼만 전진 = 스케이팅 제거)
        let speed = 0;
        if (this._bkPrev) {
          const md = Math.hypot(p.x - this._bkPrev.x, p.z - this._bkPrev.z);
          const STRIDE = 1.9;                      // Bandai run 1사이클 이동 거리 (m)
          this._bkPhase = (this._bkPhase + md / STRIDE) % 1;
          speed = dt > 0.0001 ? md / dt : 0;
        }
        this._bkPrev = { x: p.x, z: p.z };
        this.group.position.set(p.x, 0, p.z);

        // 플랜트 윈도: 실측 dash 원샷 (임팩트 = 플랜트 이벤트 정렬)
        const { plants, ssTs, ssEff, ssImpact } = this.schedule;
        const ss = this.actions.bkDash || this.actions.sidestep;
        let inPlant = false, plantAnimT = 0;
        for (const tp of plants) {
          const s = tp - ssImpact * ssEff;
          if (packTime >= s && packTime < s + ssEff) {
            inPlant = true;
            plantAnimT = (packTime - s) * ssTs;
            break;
          }
        }

        // 3-way 크로스페이드: 플랜트 > 런(이동) > 드리블(정지)
        const plantTarget = inPlant ? 1 : 0;
        this._bkPlantW += (plantTarget - this._bkPlantW) * Math.min(1, dt * 10);
        const speedW = Math.min(1, Math.max(0, (speed - 0.35) / 0.8));
        this._bkRunW += (speedW - this._bkRunW) * Math.min(1, dt * 8);
        const pw = this._bkPlantW;
        const rw = this._bkRunW * (1 - pw);
        run.action.setEffectiveWeight(rw);
        drb.action.setEffectiveWeight(Math.max(0, 1 - pw - rw));
        if (ss) {
          ss.action.setEffectiveWeight(pw);
          if (inPlant) ss.action.time = Math.min(plantAnimT, ss.dur - 0.001);
        }
        run.action.time = this._bkPhase * run.dur;
        drb.action.time = packTime % drb.dur;

        // BK_C4 릴리즈 — 실측 점프샷 원샷(Motifect): 감속 정지 위에 슛 동작을 크로스페이드.
        // 장면 지시('밸런스 잡고 릴리즈')와 봇 동작 일치. 시간은 자체 진행(경로 감속과 분리).
        const shot = this.actions.mf_jump_shot;
        if (this.bkShot && shot) {
          this._bkShotT = (this._bkShotT ?? 0) + dt;
          this._bkShotW = Math.min(1, (this._bkShotW ?? 0) + dt / 0.25);
          const w = this._bkShotW;
          run.action.setEffectiveWeight(rw * (1 - w));
          drb.action.setEffectiveWeight(Math.max(0, 1 - pw - rw) * (1 - w));
          if (ss) ss.action.setEffectiveWeight(pw * (1 - w));
          shot.action.setEffectiveWeight(w);
          shot.action.time = Math.min(this._bkShotT, shot.dur - 0.001);
        } else { this._bkShotT = 0; this._bkShotW = 0; }

        // 농구 선수는 스텝백·컷 중에도 정면(수비/골대)을 향한다 — 이동만 하고 회전 안 함.
        // (이동 방향으로 회전시키면 스텝백 때 뒤를 보게 되고 빔프가 뒤로 쏨)
        this.group.rotation.y = 0;   // model.rotY(PI)로 -Z 정면 유지
      }
      this.mixer.update(0);
      this._lockInPlace();
    }

    if (this.mode === 'basketball') {
      // 슛 릴리즈 중엔 스크립트 바운스 공 숨김 (릴리즈 순간 공이 바닥에서 튀면 어색)
      if ((this._bkShotW || 0) > 0.5) this.ball.visible = false;
      else this._dribbleBall(packTime, dt);
    } else if (this.ball) this.ball.visible = false;
    // 슛(접지 베이크 클립) 지배 중엔 클램프 해제 — 점프 릴리즈를 per-frame 접지가 끌어내리지 않게
    if ((this._bkShotW || 0) > 0.5) { this.model.position.y = 0; this._yOff = undefined; }
    else this._clampFeet();
    this._applyHeadPitch(dt);
  }

  // 손 구동 바운스 — 손목 높이의 실제 하강→상승 전환(=푸시 접촉 순간)을 검출해
  // 공이 정확히 그 타이밍에 손에 닿고, 다음 접촉까지 바닥을 찍고 돌아온다 (유저:
  // '손이 떨어지고 닿는 정확한 타이밍에 공이 튀게'). 고정 주기 스크립트 바운스 은퇴.
  _dribbleBall(_, dt = 0.016) {
    const ball = this.ball;
    if (!ball || !this._wristR) return;
    ball.visible = true;
    const w = new THREE.Vector3().setFromMatrixPosition(this._wristR.matrixWorld);
    const r = 0.12;
    const S = this._db = this._db || { t: 0, prevY: w.y, vy: 0, lastLow: -9, period: 0.55, minY: w.y, handLowY: w.y, hx: w.x, hz: w.z };
    S.t += dt;
    const vyRaw = (w.y - S.prevY) / Math.max(1e-3, dt);
    S.vy = S.vy + (vyRaw - S.vy) * 0.5;
    // 손 최저권 추적(적응형): 하강→상승 전환 + 최저권 근처 = 접촉 이벤트
    S.minY += (Math.min(S.minY + 0.2, w.y) - S.minY) * 0.02;
    const wasDesc = S.prevVy < -0.05, nowRise = S.vy >= -0.02;
    if (wasDesc && nowRise && w.y < S.minY + 0.22 && S.t - S.lastLow > 0.25) {
      const gap = S.t - S.lastLow;
      if (gap < 1.4) S.period = S.period + (gap - S.period) * 0.5;   // 실측 주기 추정(EMA)
      S.lastLow = S.t;
      S.handLowY = w.y;
    }
    S.prevY = w.y; S.prevVy = S.vy;
    // 손 XZ는 부드럽게 추종 (팔 스윙 지터 제거). 오프셋 0.06 = 손바닥 앞(손 안에 박히지 않게)
    S.hx += (w.x + 0.06 - S.hx) * Math.min(1, dt * 14);
    S.hz += (w.z - S.hz) * Math.min(1, dt * 14);
    const since = S.t - S.lastLow;
    if (since > 1.6) {
      // 드리블 정지(손 진동 없음) — 공은 손 옆 바닥에 얌전히
      ball.scale.set(1, 1, 1);
      ball.position.set(S.hx, r, S.hz);
      return;
    }
    // 진짜 중력 포물선: 접촉높이(손)에서 자유낙하 → 바닥 → 같은 높이 복귀.
    //   주기 T는 높이에서 물리로 나온다(T = 2√(2h/g)) — 손 리듬(S.period)으로 시간축을 늘렸더니
    //   높이와 주기가 따로 놀아 '퉁퉁 치는' 느낌이 없었음(유저). 손 최저점 이벤트는 위상만 리셋(스냅),
    //   그 사이엔 물리 주기로 계속 튄다(리듬이 느리면 여러 번 튀는 게 물리적으로 맞다).
    const G = 9.8;
    const hTop = Math.max(S.handLowY - r * 0.2, r + 0.05);
    const T = 2 * Math.sqrt(2 * Math.max(0.02, hTop - r) / G);
    const u = (since % T) / T;
    const tt = (u - 0.5) * T;                    // 바닥 통과 = 사이클 중앙
    const y = r + 0.5 * G * tt * tt;             // u=0/1 → 정확히 hTop(손 높이)에서 손과 만남
    const air = (y - r) / Math.max(0.05, hTop - r);
    const squash = Math.max(0, 1 - air / 0.12);
    const speed = Math.abs(1 - 2 * u);
    const sy = 1 - 0.35 * squash + 0.16 * speed * (1 - squash);
    const sxz = 1 + 0.28 * squash - 0.08 * speed * (1 - squash);
    ball.scale.set(sxz, sy, sxz);
    ball.position.set(S.hx, Math.max(0, y - r) + r * sy, S.hz);
  }

  _samplePath(t) {
    const path = this.schedule.path;
    if (t <= path[0].t) return { ...path[0], dirX: 0, dirZ: 0 };
    if (t >= path[path.length - 1].t) return { ...path[path.length - 1], dirX: 0, dirZ: 0 };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / Math.max(b.t - a.t, 0.001);
        const e = k * k * (3 - 2 * k); // smoothstep — 스텝 간 가감속
        return {
          x: a.x + (b.x - a.x) * e,
          z: a.z + (b.z - a.z) * e,
          dirX: b.x - a.x,
          dirZ: b.z - a.z,
        };
      }
    }
    return { ...path[0], dirX: 0, dirZ: 0 };
  }

  /** 루트 모션 제거: 골반 XZ를 그룹 원점에 고정 */
  _lockInPlace() {
    this._lockFingers();
    if (!this._hips) return;
    this.model.position.x = 0;
    this.model.position.z = 0;
    this.model.updateMatrixWorld(true);
    const hw = new THREE.Vector3().setFromMatrixPosition(this._hips.matrixWorld);
    const gw = new THREE.Vector3();
    this.group.getWorldPosition(gw);
    this.model.position.x = -(hw.x - gw.x);
    this.model.position.z = -(hw.z - gw.z);
  }

  /** 발이 바닥 아래로 파고들거나 공중부양하지 않도록 Y 보정 (스무딩 — 프레임 팝 방지) */
  _clampFeet() {
    if (!this.feet.length) return;
    this.model.position.y = 0;
    this.model.updateMatrixWorld(true);
    let minY = Infinity;
    const v = new THREE.Vector3();
    for (const f of this.feet) {
      v.setFromMatrixPosition(f.matrixWorld);
      minY = Math.min(minY, v.y);
    }
    if (!isFinite(minY)) return;
    // 호버 0.02→0.005: 최저발을 지면 2cm 위에 두던 상수가 '발이 안 닿는' 부양감의 주범(유저).
    const targetY = Math.abs(minY) > 0.005 ? -minY + 0.005 : 0;
    if (this._yOff === undefined) this._yOff = targetY;
    const diff = targetY - this._yOff;
    // 큰 편차(클립 전환·포즈 점프)는 스냅, 평시는 빠른 추종(지연 부양 방지) — 미세 팝만 스무딩
    if (Math.abs(diff) > 0.08) this._yOff = targetY;
    else this._yOff += diff * Math.min(1, (this._dt ?? 0.016) * 24);
    this.model.position.y = this._yOff;
  }
}
