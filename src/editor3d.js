// ─────────────────────────────────────────────────────────────
// 에디터 v3 — 3D 장면 직접 선택·드래그 (피그마 모델)
//
//   라이브 3D 뷰가 곧 캔버스. 클릭 = 선택, 드래그 = 이동.
//   두 스코프를 한 손으로:
//     · 팩(토큰) — StudioDoc 마크 (undo·속성패널·2D 캔버스 자동 동기)
//     · 장면(컷) — 세션 스테이지 요소(글자·링·화살표·발…) = SceneScope 패치
//   좌표 역매핑은 tokens._mapFloor/_mapWall의 역함수 (레이아웃 모드별).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEditor3D({ dom, camera, controls, tokens, getDoc, onEdit, getScene, onSceneChange }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitW = new THREE.Vector3();
  let enabled = false;
  let drag = null;          // 팩: { id, surface, foot, plane, parent } / 장면: { sceneKey, obj, plane, wall }
  let emptyDown = null;     // 빈 곳 클릭 시작점 — 이동 없이 떼면 선택 해제

  // 장면 요소 선택 링 (요소 크기에 맞춰 스케일)
  let sceneRing = null;
  function ensureRing() {
    if (sceneRing) return sceneRing;
    sceneRing = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.09, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    sceneRing.renderOrder = 8;
    sceneRing.visible = false;
    tokens.root.parent?.add(sceneRing) ?? tokens.root.add(sceneRing);
    return sceneRing;
  }
  function ringAround(obj, wall) {
    const r = ensureRing();
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) { r.visible = false; return; }
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const rad = Math.max(0.12, Math.hypot(wall ? s.x : s.x, wall ? s.y : s.z) * 0.62);
    r.scale.setScalar(rad);
    if (wall) { r.rotation.set(0, 0, 0); r.position.set(c.x, c.y, c.z + 0.03); }
    else { r.rotation.set(-Math.PI / 2, 0, 0); r.position.set(c.x, Math.max(0.016, box.min.y + 0.004), c.z); }
    r.visible = true;
  }

  function setNdc(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  // ── 팩 토큰 픽 ──
  function pickPack(e) {
    let best = null;
    for (const ev of tokens.events) {
      if (!ev.marker || ev.srcToken?._docId == null || !ev.marker.group.visible) continue;
      const hit = ray.intersectObject(ev.marker.fx, false)[0];
      if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, ev };
    }
    return best?.ev || null;
  }

  // ── 장면 요소 픽 (글자·링·화살표·발… — 그룹 재귀) ──
  function pickScene(e, sc) {
    let best = null;
    for (const { i, o } of sc.session.sceneElements(sc.scope.stageId)) {
      if (!o.visible) continue;
      const hit = ray.intersectObject(o, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, key: i, obj: o };
    }
    return best;
  }

  function beginPackDrag(ev, e) {
    const p = new THREE.Vector3();
    ev.marker.group.getWorldPosition(p);
    const n = ev.surface === 'wall' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    drag = {
      id: ev.srcToken._docId, surface: ev.surface, foot: ev.foot,
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, p),
      parent: ev.marker.group.parent,
    };
    grab(e);
  }
  function beginSceneDrag(hit, e, sc) {
    const p = new THREE.Vector3();
    hit.obj.getWorldPosition(p);
    const wall = !!sc.scope.wall;
    const n = wall ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    drag = {
      sceneKey: hit.key, obj: hit.obj, wall,
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, p),
    };
    grab(e);
  }
  function grab(e) {
    controls.enabled = false;
    try { dom.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트(테스트)는 캡처 불가 */ }
    dom.style.cursor = 'grabbing';
  }

  function applyDrag(e) {
    setNdc(e);
    if (!ray.ray.intersectPlane(drag.plane, hitW)) return;

    // 장면 요소 드래그 — SceneScope 패치 (오버라이드 저장·undo 병합)
    if (drag.sceneKey != null) {
      const sc = getScene?.(); if (!sc) return;
      const local = drag.obj.parent.worldToLocal(hitW.clone());
      sc.scope.dragTo(drag.sceneKey, local.x, drag.wall ? local.y : -local.z);
      ringAround(drag.obj, drag.wall);
      onSceneChange?.('drag');
      return;
    }

    // 팩 토큰 드래그 — StudioDoc
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
    const wasScene = drag?.sceneKey != null;
    drag = null;
    if (wasScene) onSceneChange?.('end');
    controls.enabled = true;
    dom.style.cursor = '';
  }

  function onDown(e) {
    if (!enabled || e.button !== 0) return;
    setNdc(e);
    const sc = getScene?.();
    if (sc) {
      const hit = pickScene(e, sc);
      if (hit) {
        sc.scope.pick(hit.key);
        ringAround(hit.obj, !!sc.scope.wall);
        onSceneChange?.('pick');
        beginSceneDrag(hit, e, sc);
        return;
      }
    } else {
      const ev = pickPack(e);
      if (ev) {
        getDoc()?.select(ev.srcToken._docId);
        beginPackDrag(ev, e);
        return;
      }
    }
    emptyDown = { x: e.clientX, y: e.clientY };
  }
  function onMove(e) {
    if (!enabled) return;
    if (drag) { applyDrag(e); return; }
    if (e.buttons) return;                       // 궤도 회전 중 — 호버 검사 생략
    setNdc(e);
    const sc = getScene?.();
    dom.style.cursor = (sc ? pickScene(e, sc) : pickPack(e)) ? 'grab' : '';
  }
  function onUp(e) {
    if (!enabled) return;
    if (drag) { endDrag(); return; }
    if (emptyDown && Math.hypot(e.clientX - emptyDown.x, e.clientY - emptyDown.y) < 4) {
      const sc = getScene?.();
      if (sc) { sc.scope.pick(-1); if (sceneRing) sceneRing.visible = false; onSceneChange?.('pick'); }
      else getDoc()?.select(null);               // 빈 곳 클릭 = 선택 해제 (피그마 관례)
    }
    emptyDown = null;
  }

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);

  return {
    setEnabled(on) {
      enabled = !!on;
      if (!on) { if (drag) endDrag(); dom.style.cursor = ''; }
      this.syncSelection();
    },
    /** 선택 ↔ 3D 윤곽 동기 (선택 변경·리빌드·스코프 전환 후 호출) */
    syncSelection() {
      const sc = enabled ? getScene?.() : null;
      // 팩 마커 링
      const sel = (enabled && !sc) ? getDoc()?.selection : null;
      for (const ev of tokens.events)
        ev.marker?.setSelected?.(sel != null && ev.srcToken?._docId === sel);
      // 장면 요소 링
      if (sc && sc.scope.sel >= 0) {
        const el = sc.session.sceneElements(sc.scope.stageId).find(x => x.i === sc.scope.sel);
        if (el) { ringAround(el.o, !!sc.scope.wall); return; }
      }
      if (sceneRing) sceneRing.visible = false;
    },
  };
}
