// ═══ 마크 룩 프리셋 — 두 벌을 오갈 수 있게 ═══════════════════════════════════
//   '접지 룩'(2026-08-07)으로 갈아타되 **이전 것을 버리지 않는다**. 버튼 하나로 왕복한다.
//
//   classic = 정본 그대로(src/mark-look.json). 값을 여기 복사하지 않는다 —
//             복사하면 footlab 에서 룩을 다시 구웠을 때 둘이 갈린다.
//             새 룩이 건드리는 키만 골라 되돌린다.
//   contact = 접지 룩. 지면 UI 발자국을 '압력이 흐르는 깔창'으로 읽게 하는 조합:
//             ① 깊이는 **마스킹**으로 낸다(필 인셋 + 이너 섀도우). 투명도로 내면 채도가 같이 죽는다.
//             ② 색 축은 샌드~레드. 프리즘(한기)까지 열면 접지 안 한 자리가 하늘색이 된다.
//             ③ 하프톤은 **양**으로 은은하게, 그리고 접지한 자리에만(바깥은 면으로 남는다).
import LOOK from './mark-look.json';

/** 접지 룩이 소유한 키. 되돌릴 때 정본에서 이 키만 복구하면 된다. */
const KEYS = ['imp', 'glow', 'shade', 'rip', 'halo', 'shadeRed', 'dither',
  'edgeSoft', 'edgeW', 'edgeShade', 'edgeShadeW', 'edgeShadeGrad',
  'tLo', 'tHi', 'plantar', 'loadGain', 'loadBase', 'bands', 'pool'];

export const PRESETS = {
  classic: {
    label: '정본 룩',
    // 정본에 그 키가 없으면 0 으로 되돌린다 — 새 룩이 켠 것을 끄는 게 '되돌리기'다.
    look: Object.fromEntries(KEYS.map(k => [k, LOOK[k] ?? 0])),
    ht: { amt: 0, pitch: 0.055, wave: 0.6, glow: 0 },
  },
  contact: {
    label: '접지 룩',
    look: { imp: 0, glow: 0, shade: 0, rip: 0, halo: 0, shadeRed: 0, dither: 0,
            edgeSoft: 1, edgeW: 0.10, edgeShade: 0.38, edgeShadeW: 1.0, edgeShadeGrad: 1,
            tLo: 0.02, tHi: 0.86,
            plantar: 1, loadGain: 1.7, loadBase: 0.10, bands: 0, pool: 0.9 },
    ht: { amt: 0.22, pitch: 0.011, wave: 0, glow: 0.15 },
  },
};

export const LOOK_KEY = 'newton-look-preset';
export const currentPreset = () => {
  try { return PRESETS[localStorage.getItem(LOOK_KEY)] ? localStorage.getItem(LOOK_KEY) : 'contact'; }
  catch (e) { return 'contact'; }   // 저장소가 막힌 환경 — 새 룩이 기본이다
};
export const savePreset = name => { try { localStorage.setItem(LOOK_KEY, name); } catch (e) { /* 무시 */ } };

/** 하프톤은 룩 키가 아니라 유니폼이라 따로 민다(applyMarkLook 맵에 없다). */
export function pushHT(mat, ht) {
  const u = mat?.uniforms; if (!u?.uHT) return;
  u.uHT.value = ht.amt;
  u.uHTPitch.value = ht.pitch; u.uHTWave.value = ht.wave; u.uHTGlow.value = ht.glow;
}
