// ─────────────────────────────────────────────────────────────
// 에디터 v3 Phase A — 3D 장면 직접 선택·드래그
//
//   피그마 모델: 라이브 3D 뷰가 곧 캔버스. 클릭 = 선택, 드래그 = 이동.
//   데이터 소스는 StudioDoc 그대로 — undo·속성패널·2D 캔버스와 자동 동기.
//   좌표 역매핑은 tokens._mapFloor/_mapWall의 역함수 (레이아웃 모드별).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEditor3D({ dom, camera, controls, tokens, getDoc, onEdit }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitW = new THREE.Vector3();
  let enabled = false;
  let drag = null;          // { id, surface, foot, plane, parent }
  let emptyDown = null;     // 빈 곳 클릭 시작점 — 이동 없이 떼면 선택 해제

  function setNdc(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  function pick(e) {
    setNdc(e);
    let best = null;
    for (const ev of tokens.events) {
      if (!ev.marker || ev.srcToken?._docId == null || !ev.marker.group.visible) continue;
      const hit = ray.intersectObject(ev.marker.fx, false)[0];
      if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, ev };
    }
    return best?.ev || null;
  }

  function beginDrag(ev, e) {
    const p = new THREE.Vector3();
    ev.marker.group.getWorldPosition(p);
    const n = ev.surface === 'wall' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    drag = {
      id: ev.srcToken._docId, surface: ev.surface, foot: ev.foot,
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, p),
      parent: ev.marker.group.parent,
    };
    controls.enabled = false;
    try { dom.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트(테스트)는 캡처 불가 */ }
    dom.style.cursor = 'grabbing';
  }

  function applyDrag(e) {
    setNdc(e);
    if (!ray.ray.intersectPlane(drag.plane, hitW)) return;
    const doc = getDoc(); if (!doc || !doc.get(drag.id)) return;
    const local = drag.parent.worldToLocal(hitW.clone());
    const L = tokens.layout;
    if (drag.surface === 'wall') {
      const W = L.WALL;
      doc.moveXY(drag.id, clamp(local.x / W.XS, -1, 1), clamp((local.y - W.Y0) / W.YS, -1, 1.2));
    } else if (L.mode === 'advance') {
      const c = (L.CAL && L.CAL[drag.foot]) || { x: 0, z: 0 };
      doc.move(drag.id,
        clamp((local.x - c.x) / L.X_SCALE, -1, 1),
        Math.max(0, -(local.z - c.z + L.STRIKE_AHEAD) / L.V));
    } else if (L.mode === 'spatial') {
      doc.moveXY(drag.id, clamp(local.x / L.SCALE, -1.5, 1.5), clamp(local.z / L.SCALE, -1.5, 1.5));
    } else return;   // static 바닥(복싱 스탠스)은 저작 대상 아님
    onEdit();
  }

  function endDrag() {
    drag = null;
    controls.enabled = true;
    dom.style.cursor = '';
  }

  function onDown(e) {
    if (!enabled || e.button !== 0) return;
    const ev = pick(e);
    if (ev) {
      getDoc()?.select(ev.srcToken._docId);
      beginDrag(ev, e);
    } else {
      emptyDown = { x: e.clientX, y: e.clientY };
    }
  }
  function onMove(e) {
    if (!enabled) return;
    if (drag) { applyDrag(e); return; }
    if (e.buttons) return;                       // 궤도 회전 중 — 호버 검사 생략
    dom.style.cursor = pick(e) ? 'grab' : '';
  }
  function onUp(e) {
    if (!enabled) return;
    if (drag) { endDrag(); return; }
    if (emptyDown && Math.hypot(e.clientX - emptyDown.x, e.clientY - emptyDown.y) < 4)
      getDoc()?.select(null);                    // 빈 곳 클릭 = 선택 해제 (피그마 관례)
    emptyDown = null;
  }

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);

  return {
    setEnabled(on) {
      enabled = !!on;
      if (!on) { if (drag) endDrag(); dom.style.cursor = ''; this.syncSelection(); }
    },
    /** doc 선택 ↔ 3D 마커 윤곽 동기 (선택 변경·리빌드 후 호출) */
    syncSelection() {
      const sel = enabled ? getDoc()?.selection : null;
      for (const ev of tokens.events)
        ev.marker?.setSelected?.(sel != null && ev.srcToken?._docId === sel);
    },
  };
}
