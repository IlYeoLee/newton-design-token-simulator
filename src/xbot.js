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
import vmCrossoverClipJson from '../assets/mocap/xclip-vm_crossover.json?url';
import vmStepbackClipJson from '../assets/mocap/xclip-vm_stepback.json?url';   // 커리 스텝백 레퍼런스 영상 모캡(후방 시점)   // 크로스 잽 드리블 실사 비디오모캡(유저 제공 소스)
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
    regJson('vm_crossover', vmCrossoverClipJson);
    regJson('vm_stepback', vmStepbackClipJson);   // BK_B2~C2 측면 스텝백 — 실측 좌표와 같은 소스   // BK_B2 크로스오버 — 정면·제자리·와이드 스탠스 실사 드릴
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
    this._vmClips = new Set(['quadStretch', 'vm_crossover', 'vm_stepback', 'cmu_stretch', 'cmu_dribble_low', 'cmu_crossover_shot', 'jumpingJacks', 'mf_jump_shot', 'mf_marathon', 'mf_layup']);
    // keepRootXZ 베이크 클립(몸이 실제 이동) — 재생 시 힙 XZ 고정(_lockInPlace) 제외 대상
    this._rootClips = new Set(['mf_boxing_footwork', 'sfu_jogging', 'cmu_crossover_turn', 'rk_stepback', 'mf_sprint_start', 'cmu_dribble_fwd', 'cmu_dribble_back', 'cmu_dribble_side']);
    for (const k of ['bl_crossover', 'mf_dribble', 'mf_block', 'mf_chest_pass', 'mf_sprint_start', 'bp_dribble', 'fab_crossover', 'lb_dribble', 'rk_stepback', 'sfu_jumprope', 'sfu_jogging', 'cmu_stretch2', 'cmu_stretch3', 'cmu_warmup_routine', 'cmu_crossover_turn', 'cmu_dribble_shot',
      'hj_legswing', 'hj_jjack', 'hj_squat', 'hj_sidelunge', 'hj_kneehug', 'hj_sidebend', 'neckStretch', 'armStretch', 'airSquat', 'jogging', 'bkBlock', 'stomp_press',
      // idle = Mixamo Breathing Idle. **이미 호흡이 들어 있는 클립**이라 호흡 레이어를 또 얹으면
      //   웅크린 warmup 프레임이 18% 섞여 서 있는 자세가 구부정해진다(관찰 구간이 그 자세를 쓴다).
      'idle']) this._vmClips.add(k);
    // 접지 베이크 완료 클립 — 재생 시 per-frame 발 클램프 제외(점프와 싸우며 덜커덩 만들던 것).
    // 접지는 리타겟 스크립트가 클립 전 구간 1회 정렬(소스 독립 설계 — 어떤 팩이 와도 동일).
    this._groundedClips = new Set(['cmu_stretch', 'cmu_stretch2', 'cmu_stretch3', 'cmu_warmup_routine',
      'cmu_dribble_low', 'cmu_crossover_shot', 'cmu_crossover_turn', 'cmu_dribble_shot',
      'mf_jump_shot', 'mf_layup', 'mf_marathon', 'mf_boxing_footwork', 'mf_dribble', 'mf_block', 'mf_chest_pass', 'mf_sprint_start', 'sfu_jumprope', 'sfu_jogging', 'rk_stepback', 'cmu_dribble_fwd', 'cmu_dribble_back', 'cmu_dribble_side']);

    // ── 외부 이식 클립 자동 등록: assets/imported/*.fbx — 코드 수정 없이 인제스트만으로 장착 ──
    // 아래 auto 블록과 같은 이유로 Set 리터럴 초기화 '뒤'에 있어야 한다. 앞에 뒀더니
    // this._vmClips 가 아직 undefined 라 add 에서 전부 TypeError 로 죽었다(이식 클립 5개 전멸).
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
    // 허벅지 본 — 다리 '선'이 필요한 가이드(A2 런지 화살표)가 쓴다. 무릎만으로는 방향이 안 나온다.
    this._hipL = xbot.getObjectByName('mixamorigLeftUpLeg');
    this._hipR = xbot.getObjectByName('mixamorigRightUpLeg');
    this._head = xbot.getObjectByName('mixamorigHead');
    this._footL = xbot.getObjectByName('mixamorigLeftToeBase') || xbot.getObjectByName('mixamorigLeftFoot');
    this._footR = xbot.getObjectByName('mixamorigRightToeBase') || xbot.getObjectByName('mixamorigRightFoot');
    this._wristR = xbot.getObjectByName('mixamorigRightHand');
    this._wristL = xbot.getObjectByName('mixamorigLeftHand');   // 크로스오버 — 공이 활성 손을 따라간다
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
  _relaxArms(side) {   // side 'L'|'R' = 그쪽 팔만 (B1: 오른손 드리블 유지, 왼팔만 축 내림)
    if (!this._neutralPose) return;
    const t = this._breathT || 0;
    for (const n of ['mixamorigLeftShoulder', 'mixamorigRightShoulder', 'mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftForeArm', 'mixamorigRightForeArm']) {
      if (side && !n.includes(side === 'L' ? 'Left' : 'Right')) continue;
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

  /** 다리 세그먼트(엉덩이·무릎·발) 월드 좌표 — 지면 가이드가 **실제 다리 선**에 붙을 때 쓴다.
   *  A2 런지: 뒷다리는 hip→foot 지면 투영이 '펴는 방향', 앞다리는 hip→knee 가 '굽히는 방향'. */
  getLegs() {
    const w = o => o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
    return { hipL: w(this._hipL), kneeL: w(this._kneeL), footL: w(this._footL),
             hipR: w(this._hipR), kneeR: w(this._kneeR), footR: w(this._footR) };
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
      const yaw = this.group.rotation.y;
      const px = -Math.sin(yaw), pz = -Math.cos(yaw);   // 팩 정면(그룹 요 — 컷 방향)
      // ★ 제자리 데모(관찰·워밍업·스텝백 프리뷰)에선 **팩 정면 고정**(유저 08-06: 시작값을 봇에 고정하면 될 일).
      //   러닝·복싱은 아래처럼 상수를 돌려주는데 농구만 골반을 실측해 따라간다. 그런데 데모 구간의
      //   봇은 제자리에 서서 클립만 도는 상태라 **따라갈 컷이 없다** — 그런데도 클립 첫 프레임의
      //   골반 요(스텝백은 정면에서 ~174°)가 그대로 대지 방향이 돼서, 세션 시작에 대지와 인물이
      //   통째로 휘돌아 꽂혔다. 컷 추종은 실제로 경로를 도는 라이브(update)에서만 의미가 있다.
      if (this._inDemo || this.lockYaw || this.legLock) return new THREE.Vector3(px, 0, pz);
      const a = this.getAnchor();
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
    this._inDemo = true;   // 제자리 데모 — getForward 가 팩 정면을 고정한다(휘돌기 방지)
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
    // 클립이 방금 쓴 힙 높이 — 발자국 IK 크라우치의 **절대 기준**(아래 _applyFootIK 주석 참조).
    if (this._hips) this._hipsClipY = this._hips.position.y;
    // 루트모션 데모 클립은 XZ 고정 해제, 접지 베이크 클립은 per-frame 클램프 해제(덜커덩 방지)
    if (this._rootClips?.has(key) && !this.demoInPlace) {
      this._lockFingers(); this.model.position.x = 0; this.model.position.z = 0; this.model.updateMatrixWorld(true);
      // 루트 클립도 접지는 해야 한다 — rk_stepback(스텝백)에서 봇이 공중에 떠 보였음(유저).
      //   XZ만 고정하고 Y는 발바닥 기준으로 내린다.
      this._clampFeet?.();
    }
    else this._lockInPlace?.();
    // 요 잔류 방지: lockYaw/legLock이 얼려둔 rotation.y가 스테이지를 떠나도 남아
    // T-2 등에서 봇이 뒤돌아 보였다(유저). 비활성 + 비루트 클립이면 기본 정면(π) 복원.
    // demoInPlace 면 루트 클립이라도 **제자리 취급**이다 — 요 고정도 같이 살아나야 한다.
    //   (유저 08-10: 인물이 뒤를 돌고 있다. 124_06 은 레이업이라 클립이 몸을 돌린다.)
    const _rootNow = !!this._rootClips?.has(key) && !this.demoInPlace;
    if (!this.lockYaw && !this.legLock && !_rootNow && Math.abs(this.model.rotation.y - Math.PI) > 0.01) {
      // 스냅 복원은 한 프레임에 확 돌아 '뚝' 끊겨 보였다(유저) — 부드럽게 최단 경로 보간(≈0.25s)
      let d0 = Math.PI - this.model.rotation.y;
      while (d0 > Math.PI) d0 -= Math.PI * 2; while (d0 < -Math.PI) d0 += Math.PI * 2;
      this.model.rotation.y += d0 * Math.min(1, (this._dt || 0.016) * 8);
      this.model.updateMatrixWorld(true);
    }
    // 요 고정(lockYaw, 세션 데모 공통 원칙 — 유저): CMU 프리스타일 클립이 몸을 돌려도(B2 뒤돌기)
    // 화면의 봇은 항상 정면(-z 응시)을 유지한다. 골반 로컬 +Z(몸 정면, getAnchor 규약)의 요를 재서
    // 모델 루트를 역회전 — _lockInPlace가 힙 XZ를 원점에 고정하므로 원점 회전 = 제자리 회전.
    if (this.lockYaw && this._hips && !_rootNow) {
      // 닫힌형 보정 — 누적(+=) 피드백은 폭주했다(실측: rotation.y -67rad, 위치 미터 요동
      // = 검은 프레임의 한 원인). 같은 y축 회전이라 분해: yawClip = yawWorld − rotation.y.
      this.model.updateMatrixWorld(true);
      const e = this._hips.matrixWorld.elements;
      const yawWorld = Math.atan2(e[8], e[10]);
      const yawClip = yawWorld - this.model.rotation.y;
      let want = Math.PI - yawClip;
      while (want > Math.PI * 2) want -= Math.PI * 2; while (want < 0) want += Math.PI * 2;
      this.model.rotation.y = want;
      this.model.updateMatrixWorld(true);
      this._lockInPlace?.();
    }
    if (this._armNeutralClips?.has(key)) this._relaxArms();   // 팔만 중립 — 다리는 실측 유지 (유저: '손만 자연스럽게')
    else if (this.relaxLeftArm) this._relaxArms('L');   // B1 로우 드리블 — 왼팔만 자연 축 내림 (유저: 오른손 드리블, 반대손 내리기)
    // ★ 루트 클립은 접지 베이크를 믿으면 안 된다(08-10, 유저: 발이 공중에 떠 있다).
    //   베이크는 클립 **전 구간**의 최저발을 0에 맞춘 것 — 위상 창(rk_stepback [8.7,10.5])만
    //   틀면 그 창의 최저발은 공중이다. 위 루트 분기(585)가 클램프를 해도 여기가 y=0 으로
    //   되돌리고 있었다. 루트+접지 클립은 per-frame 클램프로 보낸다(_clampFeet 스무딩이 있다).
    this._applyFootIK();     // (구) 마크 좌표로 다리를 끌던 경로 — 지금은 스텝백에서 안 쓴다
    this._applyFootLock();   // (신) 클립이 몸을 움직이고, 닿은 발만 고정
    if (this._groundedClips?.has(key) && !this._rootClips?.has(key) && !this._footIK) { this.model.position.y = 0; this._yOff = undefined; this.model.updateMatrixWorld(true); }
    else this._clampFeet();   // 데모 클립 루트 높이 미보정 → 봇 공중부양(유저: 'x봇이 공중에 떠있는데') 방지
    // 데모 중 공 관리 (playDemo는 여태 공을 안 건드려 이전 live 위치가 멀리 남아있었음 — 유저: '공이 저 멀리').
    // 드리블 클립일 때만 손에 붙여 튕기고, 그 외(idle·스탠스·사이드스텝·READY)엔 숨김.
    if (this.ball) {
      // 공 게이트 — 클립 이름 화이트리스트로는 B단계 클립(크로스오버·124_0x)에서 공이 안 보였다.
      // _dribbleBall은 오른손목 Y의 하강→상승 전환을 실측 검출하므로 클립 종류를 안 가린다.
      // (08-10) rk_stepback 은 여기 **안 넣는다** — 스텝백 화면은 1인칭이라 손에 붙인 공이
      //   카메라 코앞의 거대 공으로 찍힌다(스틸 실측). 공 연출이 필요해지면 fp 게이트부터.
      if (this._extBall) { /* 세션이 공을 몬다(BK_C2 슛 궤적) — 여기서 만지면 매 프레임 도로 숨긴다 */ }
      else if (this.mode === 'basketball' && /dribble|crossover|cmu124_0[3-6]|cmu86_14/.test(key)) this._dribbleBall(this._demoT || 0, dt);
      else this.ball.visible = false;
    }
    // vm_crossover 깊이 보정 — 모노큘러 포즈는 팔 깊이(z)가 몸쪽으로 압축돼 손이 몸통 뒤에 붙는다
    // (유저 지적). 축 실측(현재 자세): Arm 로컬 z+(L)/z−(R) 25° → 손 전방 0.20m. 18°만 가산.
    if (key === 'vm_crossover') {
      const D2 = Math.PI / 180, Bn = n => this.model.getObjectByName(n);
      const rq = (b, ax, deg) => b && b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(ax, deg * D2));
      // 팔 = 공 추종(유저: 공 속도/방향에 손이 따라오게). U자 공의 실제 위치에서 팔 각을 유도:
      //   '내 쪽일수록(near) + 낮을수록(drop)' 아래로 뻗는 푸시 — 공이 빠르면 팔도 빨라진다.
      let zL = 24, zR = 24, xL = 0, xR = 0;
      if (this.uDribble && this.ball?.visible && this._hips) {
        const bp = this.ball.position, he2 = this._hips.matrixWorld.elements;
        const cx3 = he2[12], SIDE = 0.45, TOP = 0.72, rB = 0.12;
        const drop = 1 - Math.max(0, Math.min(1, (bp.y - rB) / (TOP - rB)));
        const nearL = Math.max(0, 1 - Math.abs(bp.x - (cx3 - SIDE)) / (SIDE * 1.2));
        const nearR = Math.max(0, 1 - Math.abs(bp.x - (cx3 + SIDE)) / (SIDE * 1.2));
        zL = 20 + nearL * (18 + 32 * drop); xL = nearL * drop * 15;
        zR = 20 + nearR * (18 + 32 * drop); xR = nearR * drop * 15;
      }
      rq(Bn('mixamorigLeftArm'), new THREE.Vector3(0, 0, 1), zL);
      rq(Bn('mixamorigLeftArm'), new THREE.Vector3(1, 0, 0), xL);
      rq(Bn('mixamorigRightArm'), new THREE.Vector3(0, 0, 1), -zR);
      rq(Bn('mixamorigRightArm'), new THREE.Vector3(1, 0, 0), -xR);
      rq(Bn('mixamorigSpine'), new THREE.Vector3(1, 0, 0), 18);       // 상체 숙임(유저: 더 허리 숙이고)
      rq(Bn('mixamorigLeftFoot'), new THREE.Vector3(1, 0, 0), -18);   // 까치발 해제 — 실측 뒤꿈치 0.09~0.11m 공중
      rq(Bn('mixamorigRightFoot'), new THREE.Vector3(1, 0, 0), -18);  //   (X+=발 펴기 규약이므로 X−=뒤꿈치 내림)
      this.model.updateMatrixWorld(true);
      this._clampFeet?.();
    }
    // 다리 고정 노브(legLock, main B2 구동) — 크로스오버 연습은 하체 고정·무릎 굽힘이 기본(유저).
    // 프리스타일 클립은 발이 따라 움직이므로, 진입 프레임의 다리 포즈를 스냅샷해 매 프레임 하체만
    // 덮어쓴다(상체·팔은 클립 그대로). stanceWiden·_clampFeet은 이 위에 그대로 얹힌다.
    if (!this.legLock) this._legSnap = null;
    else if (key) {
      // Hips 회전 포함 — 다리만 얼리면 힙 롤·피치가 얼린 다리를 통째로 흔든다(실측 발 표류 0.63m).
      //   상체 스웨이는 척추 체인이 담당하므로 힙 회전 고정에도 살아 있다.
      const LEGS = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
      if (!this._legSnap || this._legSnap.key !== key) {
        this._legSnap = { key, q: {}, yaw: this.model.rotation.y };   // 요까지 스냅샷 — lockYaw가 프레임마다
        for (const n of LEGS) { const b = this.model.getObjectByName('mixamorig' + n); if (b) this._legSnap.q[n] = b.quaternion.clone(); }
        // 크라우치 강화(유저: 스쿼트처럼 더 굽히고 넓게) — 스냅샷에 직접 굽힘·벌림을 굽는다.
        //   축 규약: hip X+=굴곡·Z±=벌림(L+/R−) · Leg X−=무릎 · Foot X+=접지 보상 (전부 기존 실측)
        const D3 = Math.PI / 180;
        const mul = (n, ax, deg) => { const q = this._legSnap.q[n]; if (q) q.multiply(new THREE.Quaternion().setFromAxisAngle(ax, deg * D3)); };
        const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);
        mul('LeftUpLeg', AZ, 12); mul('RightUpLeg', AZ, -12);
        mul('LeftUpLeg', AX, 20); mul('RightUpLeg', AX, 20);
        mul('LeftLeg', AX, -32); mul('RightLeg', AX, -32);
        mul('LeftFoot', AX, 14); mul('RightFoot', AX, 14);
      }                                                               // 루트를 돌리면 얼린 다리가 호를 그림(실측 0.95m)
      for (const n of LEGS) { const b = this.model.getObjectByName('mixamorig' + n); const q = this._legSnap.q[n]; if (b && q) b.quaternion.copy(q); }
      this.model.rotation.y = this._legSnap.yaw;
      this.model.updateMatrixWorld(true);
      this._clampFeet?.();
    }
    // 스텝백 스탠스 구동(sbWidth, 미터) — 레퍼런스 영상 실측 4국면(0.39/0.42/0.92/0.21m)을
    //   직접 재현한다. 모캡 지터 없이 지면 발자국과 같은 좌표로 서게 하는 게 목적(유저).
    //   힙 외전으로 폭을 만들고, 넓어질수록 무릎을 굽혀 실제 스텝백 로딩 자세가 되게 한다.
    if (this.sbWidth > 0 && key) {
      const D = Math.PI / 180, B = n => this.model.getObjectByName(n);
      const base = 0.76;   // bkStance 클립 실측 기본 폭(라이브 측정) — 여기서부터 좁히거나 넓힌다
      const k = Math.max(-1.2, Math.min(1.9, (this.sbWidth - base) / 0.16));   // ±0.16m당 1.0 (착지 0.92m까지)
      const rz = (b, deg) => b && b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg * D));
      const rx = (b, deg) => b && b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * D));
      rz(B('mixamorigLeftUpLeg'), 7 * k); rz(B('mixamorigRightUpLeg'), -7 * k);   // 폭
      const kp = Math.max(0, k);                                                   // 로딩은 넓어질 때만
      rx(B('mixamorigLeftUpLeg'), 9 * kp); rx(B('mixamorigRightUpLeg'), 9 * kp);
      rx(B('mixamorigLeftLeg'), -14 * kp); rx(B('mixamorigRightLeg'), -14 * kp);   // 무릎 로딩
      rx(B('mixamorigLeftFoot'), 7 * kp);  rx(B('mixamorigRightFoot'), 7 * kp);
      rx(B('mixamorigSpine'), 5 * kp);
      this.model.updateMatrixWorld(true);
      this._clampFeet?.();
      // 루트 측면 이동 + 점프 — 폭만 바꾸면 '스텝을 밟는다'가 안 보인다(유저)
      if (this.sbShift !== undefined) this.group.position.x = this.sbShift || 0;
      if (this.sbJump) { this.model.position.y = (this.model.position.y || 0) + this.sbJump; this._yOff = undefined; }
      this.model.updateMatrixWorld(true);
    }
    // 스탠스 벌림 노브(stanceWiden 0..1, main B1 구동) — 클립 스탠스가 어깨보다 좁아(실측 0.56m→)
    // 기본기 시범이 안 됨(유저·wikiHow 기본기: 발은 어깨보다 넓게). 힙 외전 ±7도.
    // 부호는 라이브 실측: z(-,+)는 좁힘(0.56→0.42), z(+,-)가 벌림.
    if (Math.abs(this.stanceWiden) > 0.001 && key) {   // 음수 = 다리 모음(셋업 시작 자세)
      const k = this.stanceWiden, D = Math.PI / 180;
      const B = n => this.model.getObjectByName(n);
      const rz = (b, deg) => b && b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg * D));
      rz(B('mixamorigLeftUpLeg'), 7 * k);
      rz(B('mixamorigRightUpLeg'), -7 * k);
      this.model.updateMatrixWorld(true);
      this._clampFeet?.();
    }
    // 크로스오버 가드 팔(crossGuard 0..1, main B2 구동) — 레퍼런스(wikiHow): 드리블 반대 팔을
    // 앞-아래로 뻗어 실드. 축은 라이브 캘리브레이션: LeftArm 로컬 z+ 30° → 손목 (0,-0.16,-0.15) 하전방.
    // 오른팔은 미러(z−). 드리블 손은 _db._actR(공 활성 손)에서 읽는다 — 손이 바뀌면 가드도 바뀐다.
    if (this.crossGuard > 0.001 && key) {
      const actR = !this._db || this._db._actR !== false;
      const b = this.model.getObjectByName(actR ? 'mixamorigLeftArm' : 'mixamorigRightArm');
      if (b) {
        const ang = (actR ? 1 : -1) * 20 * (Math.PI / 180) * this.crossGuard;
        b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang));
        this.model.updateMatrixWorld(true);
      }
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
    this._inDemo = true;
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

  /** ══ 발자국 IK — 지면 발자국 **좌표 그대로** 다리를 구동한다(유저 08-10). ══
   *
   *  왜 클립 크롭이 아니라 IK 인가: 보유 클립엔 이 안무가 **없다**. rk_stepback 창을 상관으로
   *  골랐더니(0.978) 실제로는 '정지 → 슛 → 정지' 였다 — 실측: 8.4~9.4s 완전 정지(손 1.00 고정),
   *  9.5~9.9 손이 1.0→1.6 으로 상승(슛), 9.9~12.8 다시 정지. 상관이 높았던 건 가이드도
   *  '홀드 → 변화 → 홀드' 모양이라 **모양만** 맞았기 때문이다(유저: 발자국 나오는데 손을 올린다).
   *  발자국은 좌표다. 좌표가 있으면 다리는 풀 수 있다 — 그게 IK다.
   *
   *  targets = 힙 기준 **로컬 미터** {L:{x,z}, R:{x,z}} · y=0(접지). null 이면 클립 그대로.
   *  상체·팔은 클립이 계속 소유한다(드리블·시선) — 다리만 좌표를 따른다. */
  setFootIK(t) {
    if (!t) { this._footIK = null; this._footIKS = null; return; }
    // ★ 목표를 **시간 저역통과**로 받는다(유저 08-10: 다리가 달달 떨린다).
    //   가이드 시계(stepVidT)는 코치 **영상의 currentTime** 이라 30fps 계단 + 시크 노이즈가
    //   섞인다. 렌더는 60fps 라 그 계단이 그대로 발목 목표의 떨림이 된다. τ≈0.05s 면
    //   안무 지연은 눈에 안 보이고(3프레임) 계단만 사라진다.
    const S = this._footIKS;
    if (!S) { this._footIKS = { L: { ...t.L }, R: { ...t.R } }; this._footIK = this._footIKS; return; }
    const k = Math.min(1, (this._dt ?? 0.016) / 0.05);
    for (const s of ['L', 'R']) {
      for (const c of ['x', 'y', 'z', 'roll'])
        S[s][c] = (S[s][c] ?? 0) + ((t[s][c] ?? 0) - (S[s][c] ?? 0)) * k;
      S[s].mv = t[s].mv;   // 플래그는 안 섞는다(불리언)
    }
    this._footIK = S;
  }

  /** ══ 발 고정(foot lock) — **클립이 몸을 움직이고, IK 는 닿은 발만 붙든다.** ══
   *  유저 08-10: "발만 바닥 지면에 둔 채로 움직임 값을 보정해줄 수 있나. 모든 움직임이
   *  공중에 떠서 진행되는 게 아쉽다."  이 방향이 맞다 — 체중이동·무게중심·접지 순서 같은
   *  '사람의 물리'는 실측 클립이 이미 갖고 있다. 우리가 할 일은 **미끄러짐만 없애는 것**이다.
   *  마크에서 발 목표를 만들어 다리를 통째로 끌던 방식(인형 관절 느낌)과 정반대다. */
  /** 컷·되감김에서 래치를 버린다 — 옛 자리를 물고 있으면 다리가 그리로 끌려가 튄다. */
  resetFootLock() { this._lockLatch = {}; }

  _applyFootLock() {
    if (!this.footLock || !this._hips) return;
    const V = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    if (!this._lockLatch) this._lockLatch = {};
    const ank = this._ankleY ?? (this._ankleY = 0.06);
    for (const side of ['Left', 'Right']) {
      const ft = this.model.getObjectByName('mixamorig' + side + 'Foot');
      if (!ft) continue;
      const F = V(ft), key = side[0];
      // 접지 = 발목이 바인드 높이 +4cm 안. 그 위(스윙)는 **손대지 않는다** — 클립 그대로 둔다.
      // 히스테리시스 — 붙는 문턱(4cm)과 떨어지는 문턱(10cm)을 벌린다. 같은 값이면
      //   발이 문턱 근처에서 떨었다 붙었다 하며 **다리가 튄다**(유저 08-10 스샷).
      const on = this._lockLatch[key];
      if (on ? F.y <= ank + 0.10 : F.y <= ank + 0.04) {
        const L = on || (this._lockLatch[key] = { x: F.x, z: F.z });
        this._ikLeg(side, new THREE.Vector3(L.x, ank, L.z), 0);
      } else this._lockLatch[key] = null;
    }
    this.model.updateMatrixWorld(true);
  }

  _applyFootIK() {
    const T = this._footIK; if (!T || !this._hips) return;
    this.model.updateMatrixWorld(true);
    let hp = new THREE.Vector3().setFromMatrixPosition(this._hips.matrixWorld);
    // ★ 크라우치 — 발을 과감히 벌리려면 **힙이 내려와야 한다**(다리 길이는 유한하다).
    //   실제 스텝백도 벌릴수록 앉는다 — 같은 물리다. 힙 **본**을 내린다(모델 y 는 접지 클램프 몫).
    //   ★★ 반드시 **개루프**로: 힙 월드 높이를 재서 되먹이면 접지 클램프(_clampFeet)와 서로
    //   보정하며 발산한다(실측: 크라우치 −11m · 모델 y +10.9m 로 몸이 찢어졌다). 클램프가 높이를
    //   되돌려 놓으니 컨트롤러가 자기 효과를 못 보고 영영 더 요구한다. 그래서 **목표 스탠스 폭**
    //   하나에서만 계산한다 — 피드백 없음, 발산 없음. 절대 대입(+=금지, 프레임당 최대 19회 호출).
    {
      const W = Math.hypot(T.L.x - T.R.x, T.L.z - T.R.z);
      const sc = this.model.getWorldScale(new THREE.Vector3()).y || 1;
      const drop = Math.min(0.34, Math.max(0, (W - 0.60) * 0.42) + (this.ikCrouchAdd || 0));   // 폭 0.6m 넘는 만큼 + 장면 보정
      const tgt = -drop / sc;
      // ★ 저역통과는 **프레임당 한 번만** 전진시킨다(유저 08-10: 다리가 달달 떨린다).
      //   playDemo 는 한 프레임에 최대 19회 돈다(실측). 호출마다 전진시키면 그 프레임의
      //   호출 수에 따라 크라우치가 확 갔다 천천히 갔다 해서 **프레임 단위로 덜컹거린다**.
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - (this._ikCrouchT || 0) > 4) {
        this._ikCrouchT = now;
        this._ikCrouch = (this._ikCrouch ?? 0) + (tgt - (this._ikCrouch ?? 0)) * Math.min(1, (this._dt ?? 0.016) * 10);   // 출렁임 억제(유저: 휘청거린다)와 장면 보정 반응의 절충
      }
      this._hips.position.y = (this._hipsClipY ?? this._hips.position.y) + this._ikCrouch;
      this.model.updateMatrixWorld(true);
      hp = new THREE.Vector3().setFromMatrixPosition(this._hips.matrixWorld);
    }
    // 봇은 유저를 마주본다(모델 yaw π) — 로컬 x·z 를 월드로 돌린다. yaw 는 모델 회전에서 읽는다.
    const yaw = this.model.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const world = (p) => new THREE.Vector3(
      hp.x + p.x * cy + p.z * sy, p.y || 0, hp.z - p.x * sy + p.z * cy);   // y = 체공 높이
    // ★ **디딘 발은 월드에 박는다**(유저 08-10: 다리가 달달 떨린다 · 접지면이 미끄러진다).
    //   목표가 힙 상대라 힙이 흔들리면(크라우치·클립 스웨이·접지 클램프) 디딘 발이 그대로
    //   따라 흔들렸다 — 실측 디딘발 프레임간 이동 p95 0.04~0.08m. 사람은 반대다: 발은
    //   땅에 박히고 **몸이 그 위를 지나간다.** 그래서 옮기는 중이 아니면 착지 순간의 월드
    //   좌표를 물고 있는다. 떨림도 같이 죽는다(힙 노이즈가 발에 안 실린다).
    if (!this._ikLatch) this._ikLatch = {};
    const solve = (side, q) => {
      const w = world(q);
      if (q.mv) { this._ikLatch[side] = null; return w; }
      const L = this._ikLatch[side];
      if (!L) { this._ikLatch[side] = w.clone(); return w; }
      L.y = w.y;   // 높이는 따라간다(착지 롤·클램프) — 박히는 건 바닥 위 자리(xz)다
      return L;
    };
    this._ikLeg('Left', solve('L', T.L), T.L.roll || 0);
    this._ikLeg('Right', solve('R', T.R), T.R.roll || 0);
    this.model.updateMatrixWorld(true);
  }

  /** 다리 길이(엉덩→무릎→발목, 월드 미터) — 크라우치 한계 계산의 기준. 바인드에서 1회 실측. */
  _measureLegLen() {
    const B = n => this.model.getObjectByName('mixamorigLeft' + n);
    const up = B('UpLeg'), lo = B('Leg'), ft = B('Foot');
    if (!up || !lo || !ft) return 0.85;
    const V = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    return V(up).distanceTo(V(lo)) + V(lo).distanceTo(V(ft));
  }

  /** 2본 IK — 무릎 각(코사인 법칙) → 엉덩 조준 → 발바닥 수평. 폴 벡터는 클립이 준 무릎 방향 유지. */
  _ikLeg(side, tgt, roll = 0) {
    const B = n => this.model.getObjectByName('mixamorig' + side + n);
    const up = B('UpLeg'), lo = B('Leg'), ft = B('Foot');
    if (!up || !lo || !ft) return;
    const V = () => new THREE.Vector3();
    const P0 = V().setFromMatrixPosition(up.matrixWorld);
    const P1 = V().setFromMatrixPosition(lo.matrixWorld);
    const P2 = V().setFromMatrixPosition(ft.matrixWorld);
    const l1 = P0.distanceTo(P1), l2 = P1.distanceTo(P2);
    if (!(l1 > 1e-4 && l2 > 1e-4)) return;
    // 발목 목표 = 발바닥이 지면에 오도록 발목 높이만큼 띄운다(바인드 발목 높이 = 그 값).
    //   tgt.y = 체공 높이(가이드가 '이 발은 지금 공중'이라고 말할 때만 >0) — 슬라이딩 방지.
    const aim = tgt.clone();
    aim.y = (this._ankleY ?? (this._ankleY = Math.max(0.02, P2.y))) + (tgt.y || 0);
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    // ★ **닿을 수 있는 자리로 먼저 당긴다**(유저 08-10: 왼발이 계속 공중에 있다).
    //   다리 길이는 유한한데 목표가 그보다 멀면, IK 는 다리를 쭉 편 채 목표 **방향**만 보고
    //   발이 지면 위에 뜬 채 멈춘다(실측: 목표 y=0 인데 실제 발 0.15m). 사람은 그럴 때 골반을
    //   옮겨 체중을 싣지만 이 봇은 골반이 제자리에 묶여 있다 — 그래서 높이를 지키고
    //   **수평 거리만** 줄인다. 발이 뜨는 것보다 덜 벌어지는 게 낫다.
    {
      const maxR = (l1 + l2) * 0.98, dy = aim.y - P0.y;
      const hMax = Math.sqrt(Math.max(0.0004, maxR * maxR - dy * dy));
      const hx = aim.x - P0.x, hz = aim.z - P0.z, hd = Math.hypot(hx, hz);
      if (hd > hMax) { const k2 = hMax / hd; aim.x = P0.x + hx * k2; aim.z = P0.z + hz * k2; }
    }
    const d = cl(P0.distanceTo(aim), Math.abs(l1 - l2) + 0.02, l1 + l2 - 0.02);
    // ① 무릎: 현재 내각 → 목표 내각 만큼만 더 굽힌다(로컬 X 음수 = 굽힘, 기존 실측 규약)
    const ang = (a, b, c) => Math.acos(cl((a * a + b * b - c * c) / (2 * a * b), -1, 1));
    const cur = ang(l1, l2, cl(P0.distanceTo(P2), 1e-3, l1 + l2 - 1e-3));
    lo.rotateX(-(ang(l1, l2, d) - cur));
    this.model.updateMatrixWorld(true);
    // ② 엉덩: 발목이 목표를 향하도록 월드 회전 델타를 로컬로 환산해 얹는다
    const A = V().setFromMatrixPosition(ft.matrixWorld).sub(P0).normalize();
    const Bv = aim.clone().sub(P0).normalize();
    // ★ 조준 각을 제한한다 — 한 프레임에 다리를 통째로 휙 돌리면 그게 '다리 튕김'이다.
    //   클립이 발을 크게 옮기는 프레임(스윙 진입)에 목표가 멀어지면서 실제로 그렇게 됐다.
    const aim2 = Math.acos(Math.max(-1, Math.min(1, A.dot(Bv))));
    const axis2 = A.clone().cross(Bv);
    // ★ 축이 죽는 경우(두 방향이 거의 반대·거의 같음)는 **건너뛴다**. setFromUnitVectors 는
    //   그때 임의 축을 골라 다리를 180° 뒤집는다 — 실측 힙각 179.7°/프레임의 정체.
    // 90° 를 넘는 요구는 한 프레임의 정상 동작이 아니다(컷·래치 잔재) — 그 프레임은 건너뛴다.
    if (axis2.lengthSq() < 1e-8 || aim2 > Math.PI / 2) { this.model.updateMatrixWorld(true); return; }
    const MAXA = 0.6;   // rad/프레임(≈34°) — 넘으면 그만큼만 돌리고 다음 프레임에 마저
    const qd = (aim2 > MAXA)
      ? new THREE.Quaternion().setFromAxisAngle(axis2.normalize(), MAXA)
      : new THREE.Quaternion().setFromUnitVectors(A, Bv);
    const pq = up.parent.getWorldQuaternion(new THREE.Quaternion());
    up.quaternion.premultiply(pq.clone().invert().multiply(qd).multiply(pq));
    this.model.updateMatrixWorld(true);
    // ③ 무릎 방향 고정(폴 벡터) — 2본 IK 는 무릎이 축 둘레로 자유라 목표가 멀어질 때
    //   좌우로 돌아간다. 그게 '다리가 휘청거린다'의 정체다(유저 08-10). 무릎을 **몸 앞**으로
    //   못박는다: 힙→발목 축 둘레로 다리 전체를 돌려 무릎 투영을 전방에 맞춘다.
    {
      const H = V().setFromMatrixPosition(up.matrixWorld);
      const A2 = V().setFromMatrixPosition(ft.matrixWorld);
      const K = V().setFromMatrixPosition(lo.matrixWorld);
      const ax = A2.clone().sub(H).normalize();
      const kv = K.clone().sub(H); kv.addScaledVector(ax, -kv.dot(ax));            // 축에 수직인 성분
      const yaw2 = this.model.rotation.y;
      const fwd = new THREE.Vector3(Math.sin(yaw2), 0, Math.cos(yaw2));            // 몸 정면
      const want2 = fwd.clone(); want2.addScaledVector(ax, -want2.dot(ax));
      const folded = A2.distanceTo(H) < (l1 + l2) * 0.45;   // 접힌 다리는 축이 불안정하다
      if (!folded && kv.lengthSq() > 1e-6 && want2.lengthSq() > 1e-6) {
        kv.normalize(); want2.normalize();
        let ang2 = Math.acos(Math.max(-1, Math.min(1, kv.dot(want2))));
        if (kv.clone().cross(want2).dot(ax) < 0) ang2 = -ang2;
        const q2 = new THREE.Quaternion().setFromAxisAngle(ax, ang2 * 0.8);        // 0.8 = 과교정 방지
        const pq2 = up.parent.getWorldQuaternion(new THREE.Quaternion());
        up.quaternion.premultiply(pq2.clone().invert().multiply(q2).multiply(pq2));
        this.model.updateMatrixWorld(true);
      }
    }
    // ④ 발바닥 수평 — 발이 다리를 따라 기울면 뒤꿈치가 땅을 뚫는다. 바인드 발 자세(월드)를
    //   몸 yaw 만 얹어 되돌린다(한 번만 캡처 — 클립이 바꿔도 기준은 바인드다).
    if (!this._footBindQ) this._footBindQ = {};
    if (!this._footBindQ[side]) this._footBindQ[side] = ft.getWorldQuaternion(new THREE.Quaternion());
    const want = this._footBindQ[side].clone();
    const fpq = ft.parent.getWorldQuaternion(new THREE.Quaternion());
    ft.quaternion.copy(fpq.invert().multiply(want));
    // 롤 — 로컬 X. 부호 규약은 기존 실측과 같다(+X = 발끝 위/도르시플렉션, crouch 접지 보상이 쓰는 그 축).
    if (roll) ft.rotateX(roll);
  }

  /** 지면 화면(세션 컴플리트·전환·카운트다운)에서 3인칭 봇 머리를 아래로 숙여 바닥 UI를 응시.
   *  ★ '클립이 매 프레임 head 를 재설정한다'는 가정은 **틀린 프레임이 있다**(08-10 실측):
   *    위상 잠금(stepVidT)으로 action.time 을 같은 값으로 다시 쓰면 믹서가 그 틱에 본을
   *    안 건드리는 경우가 있고, 그때 rotateX 가 누적돼 목이 초당 몇 바퀴씩 돌았다
   *    (유저: "목이 미친듯이 떨려 360도로"). 트레이스: mx 0.27→0.27(재설정 없음) 직후
   *    hp 0.27→0.65 — 24°가 한 번 더 얹힘.
   *  그래서 멱등으로: 지난 틱에 우리가 써 둔 값 그대로면(믹서 미개입) 기저 자세로 되돌린 뒤 얹는다. */
  _applyHeadPitch(dt) {
    if (!this._head) return;
    const tgt = this.headPitch || 0;
    this._headPitchCur = (this._headPitchCur || 0) + (tgt - (this._headPitchCur || 0)) * (1 - Math.exp(-(dt || 0.016) / 0.5));
    if (Math.abs(this._headPitchCur) < 1e-4) { this._headPitchQ = null; return; }
    const q = this._head.quaternion;
    if (this._headPitchQ && q.equals(this._headPitchQ)) q.copy(this._headBaseQ);
    this._headBaseQ = (this._headBaseQ || new THREE.Quaternion()).copy(q);
    this._head.rotateX(this._headPitchCur);
    this._headPitchQ = (this._headPitchQ || new THREE.Quaternion()).copy(q);
    this.model.updateMatrixWorld(true);
  }

  update(packTime, dt = 0.016) {
    if (!this.model || !this.mode) return;
    this._inDemo = false;   // 라이브 = 실제로 경로를 돈다 → 골반 실측 컷 추종 복귀
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
    // 드리블 v6 — 유저 정밀 스펙: '내려가는 손'에 공이 끝까지 붙어 내려가고, 손이 완전히
    // 내려가면 공은 바닥, 올라가는 (반대)손에 붙어 따라 올라간다. 비행 구간을 최소화하고
    // 캐리(밀착)를 기본 상태로 — 크로스오버에서 공이 손을 정확히 따르는 게 핵심.
    //   CARRY: 활성 손바닥에 밀착(손 하강·상승 동행) → 손바닥이 바닥권(BOUNCE_H)에서
    //   하강을 마치면 RELEASE → 짧은 자유낙하 → 바닥 스쿼시 → 받는 손으로 0.1s 블렌드 캐치.
    const ball = this.ball;
    if (!ball || !this._wristR || !this._wristL) return;
    ball.visible = true;
    const r = 0.12, PALM = 0.13, G = 9.8, BOUNCE_H = 0.34, BLEND = 0.10;
    // getWorldPosition = 조상 체인 강제 갱신 — bp_dribble 등에서 matrixWorld가 stale(y≈-0.02)해
    // 공이 바닥에 붙었음(유저). setFromMatrixPosition은 갱신 없이 읽어 이 버그를 만든다.
    const wR = new THREE.Vector3(); this._wristR.getWorldPosition(wR);
    const wL = new THREE.Vector3(); this._wristL.getWorldPosition(wL);
    const S = this._db = this._db || { t: 0, mode: 'carry', hnd: 'R', vyR: 0, vyL: 0,
      pR: wR.y, pL: wL.y, bT: 0, bx: wR.x, by: wR.y, bz: wR.z, blend: 9, fx: 0, fz: 0, idleT: 0 };
    S.t += dt;
    const vyRr = (wR.y - S.pR) / Math.max(1e-3, dt), vyLr = (wL.y - S.pL) / Math.max(1e-3, dt);
    S.vyR += (vyRr - S.vyR) * 0.5; S.vyL += (vyLr - S.vyL) * 0.5;
    S.pR = wR.y; S.pL = wL.y;
    const palm = (h) => { const w = h === 'R' ? wR : wL; return { x: w.x + (h === 'R' ? 0.06 : -0.06), y: w.y - PALM, z: w.z - 0.07 }; };
    const vy = (h) => (h === 'R' ? S.vyR : S.vyL);
    const other = (h) => (h === 'R' ? 'L' : 'R');

    // 손 정지 감지(양손 다 진동 없음 1.6s) — 공은 손 옆 바닥에
    if (Math.abs(S.vyR) < 0.15 && Math.abs(S.vyL) < 0.15) S.idleT += dt; else S.idleT = 0;
    if (S.idleT > 1.6) {
      const p = palm(S.hnd);
      ball.scale.set(1, 1, 1); ball.position.set(p.x, r, p.z);
      return;
    }

    let x, y, z, squash = 0;
    // ── U자 결정론 모드(uDribble, main B2/C2 구동 — 유저 확정): 공은 '무조건' 일정 박자로
    //    왼손바닥 ↔ 오른손바닥을 U자로 왕복한다. 끝단 12%는 손 밀착(드웰), 꼭짓점은 두 손 중앙 바닥.
    //    손 신호 검출(노이즈)에 의존하지 않아 박자·형태가 절대 안 깨진다. 손 위치는 라이브 추적.
    if (this.phaseDribble) {
      // B1 로우 드리블(유저): 손 y 최고점 = 공이 손에 붙음, 최저점 = 공이 바닥에 '퉁'.
      // 오른손목 높이를 러닝 min/max 엔벨로프로 정규화해 공 높이에 직결 — 클립 박자와 어긋날 수 없다.
      const wy = wR.y;
      if (wy < 0.15) return;   // 퇴화 호출 가드 — 포즈 미적용 프레임(y≈0)이 공을 바닥에 못 박음
      // 엔벨로프 적응은 손 진동 주기(약 1.6s)보다 느려야 한다. 1.2/s로 뒀더니 하한이 손을 그대로
      // 따라가 k가 항상 0 = 공이 바닥에 붙어 있었음(유저). 0.10/s면 한 주기 안에서 폭이 유지된다.
      S.pHi = Math.max(wy, (S.pHi ?? wy) - 0.10 * dt);
      S.pLo = Math.min(wy, (S.pLo ?? wy) + 0.10 * dt);
      const span = Math.max(0.10, S.pHi - S.pLo);
      const k = Math.max(0, Math.min(1, (wy - S.pLo) / span));
      const py = wy - PALM;
      const bx = wR.x, bz = (this._hips ? this._hips.matrixWorld.elements[14] : wR.z) - 0.30;
      const by = r + k * Math.max(0, py - r);
      const sq = k < 0.10 ? 1 - k / 0.10 : 0;
      const syP = 1 - 0.30 * sq, sxzP = 1 + 0.22 * sq;
      ball.scale.set(sxzP, syP, sxzP);
      ball.position.set(bx, Math.max(0, by - r) + r * syP, Math.min(bz, wR.z));
      return;
    }
    if (this.uDribble) {
      // 손과 완전 분리(유저 확정): 몸 기준 '고정' U자 — 좌우 ±0.45m·높이 0.72m 꼭짓점을
      // 0.8s 박자로 왕복, 꼭짓점 사이는 바닥 중앙 경유. 레퍼런스 주석 궤적 그대로.
      const PER = 0.9, DW = 0.22;   // DW = 손 체류(유저: 손에 더 머물고) · 반주기 0.92s 동기
      S.uT = (S.uT ?? 0) + dt;
      // 위상 잠금(유저: 왼손 닿음→중앙 바닥→오른손 닿음 100%): 자유 타이머는 클립 루프(3.5s)와
      // 표류(공 주기 1.8s×2≠3.5). 손높이차 부호 전환 = 공이 바닥 중앙을 지나는 순간으로 정의하고
      // 그 순간 uT를 목표 위상으로 절반씩 끌어당긴다(팝 없이 수렴).
      const dHands = wL.y - wR.y;
      if (S.uSign !== undefined && Math.sign(dHands) !== S.uSign && Math.abs(dHands) > 0.015) {
        const tgt = dHands < 0 ? PER * 0.5 : PER * 1.5;   // L이 내려감=오른쪽行 중간, 반대면 왼쪽行 중간
        let err = tgt - (S.uT % (PER * 2));
        if (err > PER) err -= PER * 2; if (err < -PER) err += PER * 2;
        S.uT += err * 0.5;
      }
      if (Math.abs(dHands) > 0.015) S.uSign = Math.sign(dHands);
      const cyc = ((S.uT % (PER * 2)) + PER * 2) % (PER * 2);
      const goingR = cyc < PER;
      const q = (goingR ? cyc : cyc - PER) / PER;
      const he0 = this._hips ? this._hips.matrixWorld.elements : null;
      const cx0 = he0 ? he0[12] : 0, cz0 = (he0 ? he0[14] : 0) - 0.34;
      const SIDE = 0.45;
      // 세로 재결합(유저): 끝단 높이 = 그쪽 손바닥 실높이 — 손이 최고점일 때 공이 손에 붙고,
      //   손이 내려간 U 중간엔 공이 바닥. 가로 경로는 고정 U 유지(손 좌우 노이즈 무시).
      const yL2 = Math.max(0.45, Math.min(0.95, wL.y - PALM));
      const yR2 = Math.max(0.45, Math.min(0.95, wR.y - PALM));
      const from = { x: cx0 + (goingR ? -SIDE : SIDE), y: goingR ? yL2 : yR2, z: cz0 };
      const to = { x: cx0 + (goingR ? SIDE : -SIDE), y: goingR ? yR2 : yL2, z: cz0 };
      const fy = from.y, ty2 = to.y;
      if (q < DW) { x = from.x; y = fy; z = from.z; }
      else if (q > 1 - DW) { x = to.x; y = ty2; z = to.z; }
      else {
        const u = (q - DW) / (1 - 2 * DW);
        const vx2 = (from.x + to.x) / 2, vz2 = (from.z + to.z) / 2;
        // 낙하는 빠르고(이즈인·중력 가속) 상승은 느리게(이즈아웃·감속) — 유저.
        // 시간 배분도 비대칭: 내려가는 데 38%, 올라오는 데 62%. 가로 이동은 등속에 가깝게 유지해
        //   손 사이 경로가 일그러지지 않게 별도 이즈(가로 k는 완만한 스무스스텝).
        const DN = 0.30;   // 낙하 30% : 상승 70% — 내려갈 땐 빠르게 꽂히고 올라올 땐 느리게(유저)
        if (u < DN) {
          const k = u / DN, kx = k * k * (3 - 2 * k);
          y = fy - (fy - r) * (k * k * k * k);        // 이즈인 쿼틱 = 바닥 직전 최고속(더 세게 꽂힘)
          x = from.x + (vx2 - from.x) * kx; z = from.z + (vz2 - from.z) * kx;
        } else {
          const k = (u - DN) / (1 - DN), kx = k * k * (3 - 2 * k);
          y = r + (ty2 - r) * (1 - Math.pow(1 - k, 2.2));   // 이즈아웃 = 손에 닿기 직전 거의 정지
          x = vx2 + (to.x - vx2) * kx; z = vz2 + (to.z - vz2) * kx;
          if (k < 0.22) squash = 1 - k / 0.22;   // 임팩트 스쿼시 확대
        }
      }
      if (this._hips) { const hz3 = this._hips.matrixWorld.elements[14]; z = Math.min(z, hz3 - 0.26); }
      const sy2 = 1 - 0.32 * squash, sxz2 = 1 + 0.24 * squash;
      ball.scale.set(sxz2, sy2, sxz2);
      ball.position.set(x, Math.max(0, y - r) + r * sy2, z);
      return;
    }
    if (S.mode === 'carry') {
      const p = palm(S.hnd);
      x = p.x; y = Math.max(r, p.y); z = p.z;
      // 캐치 직후 블렌드 — 바닥 지점에서 손바닥으로 부드럽게 흡착(순간이동 방지)
      if (S.blend < BLEND) {
        S.blend += dt; const k = Math.min(1, S.blend / BLEND), e = k * k * (3 - 2 * k);
        x = S.fx + (x - S.fx) * e; y = r + (y - r) * e; z = S.fz + (z - S.fz) * e;
      }
      // 릴리즈 = '하강을 마치는 순간'(속도 부호 전환). armed = 하강 관측 후에만.
      const vh = vy(S.hnd);
      if (vh < -0.30) S.armed = true;
      if (S.armed && vh >= -0.05 && p.y > r + 0.04) {
        S.armed = false;
        // U자 비행 시작(유저 레퍼런스): 릴리즈 손 → 중앙 바닥 꼭짓점 → 받는 손. 받는 손은
        // 라이브 추적(도착 순간 정확히 그 손바닥) — 크로스오버는 반대 손, 아니면 같은 손.
        const o = other(S.hnd);
        S.cat = vy(o) > -0.25 ? o : S.hnd;
        S.mode = 'fly'; S.fT = 0;
        S.p0 = { x, y: Math.max(y, r + 0.06), z };
      }
    }
    if (S.mode === 'fly') {
      S.fT += dt;
      const tp = palm(S.cat);
      const ty = Math.max(r + 0.06, tp.y);
      const tDown = Math.sqrt(2 * Math.max(0.02, S.p0.y - r) / G);
      const tUp = Math.sqrt(2 * Math.max(0.02, ty - r) / G);
      const vxm = (S.p0.x + tp.x) / 2, vzm = (S.p0.z + tp.z) / 2;   // U 꼭짓점 = 두 손의 중앙 바닥
      if (S.fT <= tDown) {
        const q = S.fT / tDown;
        y = S.p0.y - (S.p0.y - r) * q * q;                            // 가속 낙하
        x = S.p0.x + (vxm - S.p0.x) * q; z = S.p0.z + (vzm - S.p0.z) * q;
      } else if (S.fT < tDown + tUp) {
        const q = (S.fT - tDown) / tUp;
        y = r + (ty - r) * (1 - (1 - q) * (1 - q));                   // 감속 상승 — 손바닥에 소프트 도착
        x = vxm + (tp.x - vxm) * q; z = vzm + (tp.z - vzm) * q;
        if (q < 0.15) squash = 1 - q / 0.15;
      } else {
        S.mode = 'carry'; S.hnd = S.cat; S.blend = 9; S.armed = false;
        const p2 = palm(S.hnd); x = p2.x; y = Math.max(r, p2.y); z = p2.z;
      }
      if (S.fT <= tDown && S.p0.y - y < 0.02 && S.fT > 0) { /* no-op */ }
    }
    // 관통 방지 — 공은 항상 힙보다 앞(-z)
    if (this._hips) {
      const hz = this._hips.matrixWorld.elements[14];
      z = Math.min(z, hz - 0.26);
    }
    const air = Math.max(0, Math.min(1, (y - r) / 0.15));
    squash = Math.max(squash, 1 - air) * (y - r < 0.03 ? 1 : 0.4);
    const sy = 1 - 0.32 * squash, sxz = 1 + 0.24 * squash;
    ball.scale.set(sxz, sy, sxz);
    ball.position.set(x, Math.max(0, y - r) + r * sy, z);
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
