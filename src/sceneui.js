import { PAL, NEU, rgba } from './palette.js';
// ─────────────────────────────────────────────────────────────
// 장면 UI 시스템 — 투사면 위 타이포그래피의 "고정 슬롯" 규정 (에디터 v3 Phase D)
//
//   설계 문서의 슬롯 규칙을 코드로 강제:
//     · 상태(STATUS)  = 텍스트 밴드 우측 (F-M / W-M)
//     · 지시문(INSTR) = PRIME 면 텍스트 밴드 중앙 (F-L / W-L)
//     · 보조(SUB)     = 하단 밴드 — DEAD 존 바로 너머 (F-CUE)
//     · 타이틀(TITLE) = 텍스트 밴드 좌측 상시 (W-M / F-M)
//   존 규정(지면, 몸 기준 전방거리): DEAD 0~1.4m(발밑 금지) · SUB 1.5~1.9 ·
//     ACTION = 토큰 전용 · TEXT 밴드 = 풋프린트 끝단 0.85m.
//   타이포: 캡높이 스케일 F-XL .42m/L .26/M .15/CUE .11 · W-XL .30/L .18/M .11.
//   잉크: 웜 크림 #FFF3DC(히트 LUT 상단과 동일 온도) + 웜 글로우 — 숫자 텍스처와 한 언어.
//   원칙: 투사면 밖 그래픽 금지 — 모든 슬롯은 풋프린트-상대 배치 + 클리핑.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const SCENE_UI = {
  font: "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif",
  ink: NEU.ink,
  weights: { display: 300, strong: 700 },
  type: {                                   // 캡높이(m) — 면·역할별 고정 스케일
    'F-XL': 0.42, 'F-L': 0.26, 'F-M': 0.15, 'F-CUE': 0.11,
    'W-XL': 0.30, 'W-L': 0.18, 'W-M': 0.11, 'W-CUE': 0.08,
  },
  zones: { DEAD: 1.4, SUB: [1.5, 1.9], TEXT_DEPTH: 0.85 },   // 지면 전방거리(m)
  wallBand: { top: 0.22, sideInset: 0.88 },  // 벽: 상단 밴드 깊이(m)·좌우 앵커 비율
};

function makeTextTexture(text, capM, { weight = 300 } = {}) {
  const capPx = 72;                          // 캡높이 고정 px — 평면 크기로 실측 환산
  const pad = capPx * 0.6;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 4;
  const mx = cv.getContext('2d');
  mx.font = `${weight} ${capPx}px ${SCENE_UI.font}`;
  const w = Math.ceil(mx.measureText(text).width);
  cv.width = Math.max(4, w + pad * 2); cv.height = capPx * 2;
  const cx = cv.getContext('2d');
  cx.font = `${weight} ${capPx}px ${SCENE_UI.font}`;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.shadowColor = rgba(PAL.coral, .9); cx.shadowBlur = capPx * 0.30;   // 웜 글로우
  cx.fillStyle = SCENE_UI.ink;
  cx.fillText(text, cv.width / 2, cv.height / 2);
  cx.shadowBlur = 0;
  cx.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, aspect: cv.width / cv.height, heightM: (capM / capPx) * cv.height };
}

class Slot {
  constructor(parent, role /* 타이포 스케일 키 */, align = 'center', dim = 1) {
    this.role = role; this.align = align;
    this.dim = dim;   // 슬롯 위계 감광 — 타이틀·스펙은 큐(토큰)보다 항상 어둡다
    this.mesh = null; this.parent = parent;
    this.text = ''; this.opacity = 0; this.target = 0;
    this.clip = null; this.widthM = 0;
  }
  set(text, { weight } = {}) {
    text = text || '';
    if (text === this.text) { this.target = text ? 1 : 0; return; }
    this.text = text;
    if (this.mesh) { this.parent.remove(this.mesh); this.mesh.material.map.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    if (!text) { this.target = 0; return; }
    const { tex, aspect, heightM } = makeTextTexture(text, SCENE_UI.type[this.role], { weight });
    const h = heightM, w = h * aspect;
    this.widthM = w;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: this.clip }));
    this.mesh.renderOrder = 6;
    this.parent.add(this.mesh);
    this.target = 1;
  }
  /** 앵커 정렬 보정 — left면 왼끝을 앵커에, right면 오른끝을 앵커에 */
  shift() { return this.align === 'left' ? this.widthM / 2 : this.align === 'right' ? -this.widthM / 2 : 0; }
  setClip(planes) { this.clip = planes; if (this.mesh) this.mesh.material.clippingPlanes = planes; }
  tick(dt) {
    if (!this.mesh) return;
    this.opacity += (this.target - this.opacity) * Math.min(1, dt * 6);
    this.mesh.material.opacity = this.opacity * 0.92 * this.dim;
  }
}

export class SceneUI {
  constructor(scene, wallZ) {
    this.wallZ = wallZ;
    this.floorG = new THREE.Group();          // 풋프린트 추종 (매 프레임 재배치)
    this.wallG = new THREE.Group();           // 벽 풋프린트 추종
    scene.add(this.floorG, this.wallG);
    this.hasWall = false;
    // 위계: 타이틀(브랜딩) 0.5 · 스펙(sub) 0.65 — 판정 큐(토큰)가 항상 가장 밝다
    this.f = {
      title:  new Slot(this.floorG, 'F-M', 'left', 0.5),
      instr:  new Slot(this.floorG, 'F-L'),
      status: new Slot(this.floorG, 'F-M', 'right'),
      sub:    new Slot(this.floorG, 'F-CUE', 'center', 0.65),
    };
    this.w = {
      title:  new Slot(this.wallG, 'W-M', 'left', 0.5),
      instr:  new Slot(this.wallG, 'W-L'),
      status: new Slot(this.wallG, 'W-M', 'right'),
      sub:    new Slot(this.wallG, 'W-CUE', 'center', 0.65),
    };
    this._instrTimer = null;
  }
  /** 규정: 지시문·타이틀·상태는 종목의 PRIME 면에만 (복싱=벽, 그 외=지면) */
  setSport(sport, hasWall) {
    this.hasWall = !!hasWall;
    const off = this.hasWall ? this.f : this.w;
    for (const k of ['title', 'instr', 'status', 'sub']) off[k]?.set('');
  }
  _prime() { return this.hasWall ? this.w : this.f; }
  setClip(floorPlanes, wallPlanes) {
    for (const s of Object.values(this.f)) s.setClip(floorPlanes || null);
    for (const s of Object.values(this.w)) s.setClip(wallPlanes || null);
  }
  setTitle(text) { this._prime().title.set(text); this._reflow(); }
  setStatus(text) { this._prime().status.set(text, { weight: 700 }); this._reflow(); }
  setInstruction(text, holdMs = 4500) {
    const slot = this._prime().instr;
    this._instrOn = !!text;
    slot.set(text);
    clearTimeout(this._instrTimer);
    if (text && holdMs) this._instrTimer = setTimeout(() => { this._instrOn = false; slot.target = 0; this._reflow(); }, holdMs);
    this._reflow();
  }
  /** 슬롯 우선순위 규정: 지시문 > 상태 > 타이틀 — 같은 텍스트 밴드에서 충돌 방지 */
  _reflow() {
    const P = this._prime();
    const instrOn = !!(P.instr.text && this._instrOn);
    if (P.status.text) P.status.target = instrOn ? 0 : 1;
    if (P.title.text) P.title.target = (instrOn || P.status.text) ? 0 : 1;
  }
  /** 스펙 스탬프 — PRIME 면 보조 밴드 (지면=SUB 존, 벽=하단).
      도입부 증거 표기: holdMs 뒤 자동 소멸 — 운동 중 상시 수치는 소음 (표기 원칙) */
  setSub(text, holdMs = 6000) {
    const slot = this._prime().sub;
    slot.set(text);
    clearTimeout(this._subTimer);
    if (text && holdMs) this._subTimer = setTimeout(() => { slot.target = 0; }, holdMs);
  }

  /** 슬롯을 현재 투사 풋프린트의 규정 밴드에 재배치 (매 프레임) */
  update(dt, rig) {
    for (const s of Object.values(this.f)) s.tick(dt);
    for (const s of Object.values(this.w)) s.tick(dt);

    // 지면 — rig._fp: 원점(ox,oz)+전방(fx,fz)/우측(rx,rz) 단위벡터
    const f = rig?._fp;
    this.floorG.visible = !this.hasWall && !!f;
    if (this.floorG.visible) {
      const far = rig.fpFar ?? 3.2;
      const Z = SCENE_UI.zones;
      const rotZ = Math.atan2(f.fx, f.fz) + Math.PI;   // 로컬 위 = 전방 (러너가 정방향으로 읽음)
      const half = rig._halfAt ? rig._halfAt(far - Z.TEXT_DEPTH / 2) : 0.9;
      const put = (slot, d, off) => {
        if (!slot.mesh) return;
        const o = off + slot.shift();
        slot.mesh.position.set(f.ox + f.fx * d + f.rx * o, 0.014, f.oz + f.fz * d + f.rz * o);
        slot.mesh.rotation.set(-Math.PI / 2, 0, rotZ);
      };
      const dText = far - Z.TEXT_DEPTH / 2;
      put(this.f.title, dText, -half * 0.90);
      put(this.f.instr, dText, 0);
      put(this.f.status, dText, half * 0.90);
      // 스펙 스탬프는 레인(중앙 광류)을 비켜 우측 — 텍스트가 큐 위에 겹치지 않는다 (표기 원칙)
      const subHalf = rig._halfAt ? rig._halfAt((Z.SUB[0] + Z.SUB[1]) / 2) : 0.7;
      put(this.f.sub, (Z.SUB[0] + Z.SUB[1]) / 2, subHalf * 0.52);
    }

    // 벽 — 풋프린트(cx,cy,wallW,wallH) 상단 밴드
    const wc = rig?._wallCenter;
    this.wallG.visible = this.hasWall && !!wc && rig.wallW > 0;
    if (this.wallG.visible) {
      const B = SCENE_UI.wallBand;
      const y = wc.cy + rig.wallH / 2 - B.top;
      const hx = (rig.wallW / 2) * B.sideInset;
      const putW = (slot, x) => { if (slot.mesh) slot.mesh.position.set(x + slot.shift(), y, this.wallZ + 0.03); };
      putW(this.w.title, wc.cx - hx);
      putW(this.w.instr, wc.cx);
      putW(this.w.status, wc.cx + hx);
      if (this.w.sub.mesh) this.w.sub.mesh.position.set(wc.cx, wc.cy - rig.wallH / 2 + 0.16, this.wallZ + 0.03);   // 하단 스펙 밴드
    }
  }
}
