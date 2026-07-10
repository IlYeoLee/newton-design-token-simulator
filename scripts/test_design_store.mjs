// 통합 저장소 계약 검증 — 브라우저 없이 도는 순수 로직 테스트.
//   핵심 계약: ① 레거시 3분할 → v1 이행 무손실
//              ② 개별 덮어쓰기 ?? 전역 기본값
//              ③ "되돌리기(delete)" ≠ "0으로 설정"
import { DesignStore, migrate, DESIGN_KEY, LEGACY_SCENE_KEY, LEGACY_STUDIO_KEY } from '../src/studio/store.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

// localStorage 스텁
const mkStorage = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _m: m };
};

console.log('\n① 레거시 이행');
{
  const st = mkStorage({
    [LEGACY_STUDIO_KEY('running')]: JSON.stringify({ tokens: [{ id: 'm1', design: { fill: '#f00' } }] }),
    [LEGACY_STUDIO_KEY('boxing')]: JSON.stringify({ tokens: [{ id: 'b1' }] }),
    [LEGACY_SCENE_KEY]: JSON.stringify({ 'RUN_A1': { patches: { 0: { color: '#0f0' } }, added: [] } }),
  });
  const { store, migrated } = DesignStore.load(st);
  ok('세 레거시 키 모두 이행', migrated.length === 3, `(${migrated.length})`);
  ok('팩 토큰 보존', store.getPack('running').tokens[0].design.fill === '#f00');
  ok('복싱 팩 보존', !!store.getPack('boxing'));
  ok('장면 오버라이드 보존', store.sceneStore().RUN_A1.patches[0].color === '#0f0');
  ok('레거시 원본 미삭제(롤백 여지)', st.getItem(LEGACY_SCENE_KEY) !== null);
}

console.log('\n② 깨진 레거시 항목은 부팅을 죽이지 않는다');
{
  const st = mkStorage({
    [LEGACY_STUDIO_KEY('running')]: '{{{깨진 JSON',
    [LEGACY_SCENE_KEY]: JSON.stringify({ S1: { patches: {}, added: [] } }),
  });
  let threw = false;
  let store;
  try { ({ store } = DesignStore.load(st)); } catch { threw = true; }
  ok('예외 없이 로드', !threw);
  ok('깨진 팩은 버려짐', !store.getPack('running'));
  ok('멀쩡한 장면은 살아남음', !!store.sceneStore().S1);
}

console.log('\n③ v1이 있으면 레거시를 무시');
{
  const st = mkStorage({
    [DESIGN_KEY]: JSON.stringify({ version: 1, global: { colors: { red: '#abc' }, tcfg: {}, scfg: {} }, packs: {}, scenes: {} }),
    [LEGACY_SCENE_KEY]: JSON.stringify({ OLD: { patches: {}, added: [] } }),
  });
  const { store, migrated } = DesignStore.load(st);
  ok('재이행 안 함', migrated.length === 0);
  ok('v1 내용 사용', store.globalGet('colors', 'red') === '#abc');
  ok('레거시 장면 미유입', !store.sceneStore().OLD);
}

console.log('\n④ 전역=기본값, 개별=덮어쓰기');
{
  const store = new DesignStore();
  store.setPack('running', { tokens: [{ id: 'm1' }] });
  store.globalSet('colors', 'reach', '#fa3030');
  const target = { kind: 'mark', sport: 'running', id: 'm1' };

  ok('미지정이면 전역 따름', store.resolve(target, 'fill', 'colors', 'reach') === '#fa3030');
  ok('미지정 = 덮어쓰기 아님', store.isOverridden(target, 'fill') === false);

  store.setOverride(target, 'fill', '#00f');
  ok('개별 지정이 전역을 이김', store.resolve(target, 'fill', 'colors', 'reach') === '#00f');
  ok('덮어쓰기로 인식', store.isOverridden(target, 'fill') === true);

  store.globalSet('colors', 'reach', '#111');
  ok('덮어쓴 건 전역 변경에 안 흔들림', store.resolve(target, 'fill', 'colors', 'reach') === '#00f');

  store.clearOverride(target, 'fill');
  ok('되돌리면 새 전역값 따름', store.resolve(target, 'fill', 'colors', 'reach') === '#111');
  ok('되돌린 뒤 덮어쓰기 아님', store.isOverridden(target, 'fill') === false);
}

console.log('\n⑤ "되돌리기" ≠ "0으로 설정"  ← 계약의 핵심');
{
  const store = new DesignStore();
  store.setPack('running', { tokens: [{ id: 'm1' }] });
  store.globalSet('tcfg', 'blur', 7);
  const t = { kind: 'mark', sport: 'running', id: 'm1' };

  store.setOverride(t, 'blur', 0);
  ok('0은 유효한 덮어쓰기', store.isOverridden(t, 'blur') === true);
  ok('0이 전역 7을 이김', store.resolve(t, 'blur', 'tcfg', 'blur') === 0);

  store.clearOverride(t, 'blur');
  ok('되돌리면 전역 7 복귀', store.resolve(t, 'blur', 'tcfg', 'blur') === 7);
  ok('0과 삭제가 구분됨', store.isOverridden(t, 'blur') === false);
}

console.log('\n⑥ 장면 요소도 같은 인터페이스로');
{
  const store = new DesignStore();
  store.globalSet('colors', 'ink', '#fff');
  const el = { kind: 'el', stageId: 'RUN_B2', idx: 3 };

  ok('없는 스테이지도 resolve 안전', store.resolve(el, 'color', 'colors', 'ink') === '#fff');
  ok('읽기만으론 스테이지 생성 안 함', Object.keys(store.sceneStore()).length === 0);

  store.setOverride(el, 'color', '#0ff');
  ok('요소 덮어쓰기 저장', store.sceneStore().RUN_B2.patches[3].color === '#0ff');
  ok('요소 resolve', store.resolve(el, 'color', 'colors', 'ink') === '#0ff');

  store.clearOverride(el, 'color');
  ok('요소 되돌리기', store.resolve(el, 'color', 'colors', 'ink') === '#fff');
}

console.log('\n⑦ 직렬화에서 _img(런타임 Image) 제외');
{
  const store = new DesignStore();
  store.setPack('running', { tokens: [{ id: 'm1', design: { svgUrl: 'data:x', _img: { huge: 'object' } } }] });
  const st = mkStorage();
  ok('save 성공', store.save(st) === true);
  const raw = st.getItem(DESIGN_KEY);
  ok('_img 미포함', !raw.includes('_img'));
  ok('svgUrl 보존', raw.includes('svgUrl'));
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pass / ${fail} fail\n`);
process.exit(fail === 0 ? 0 : 1);
