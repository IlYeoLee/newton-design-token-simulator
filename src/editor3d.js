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

  // 장면 요소 선택 링 — 2톤(안 흰 / 밖 다크): 어떤 배경(주간·실물 확인)에서도 보임
  let sceneRing = null, hoverRing = null;
  function makeRing(inner, outer, color, opacity, order) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = order;
    return m;
  }
  function ensureRing() {
    if (sceneRing) return sceneRing;
    sceneRing = new THREE.Group();
    sceneRing.add(makeRing(1.10, 1.24, 0x0c0e12, 0.85, 8));   // 다크 컨트라스트
    sceneRing.add(makeRing(1.00, 1.10, 0xffffff, 0.95, 9));   // 흰 코어
    sceneRing.visible = false;
    (tokens.root.parent || tokens.root).add(sceneRing);
    return sceneRing;
  }
  function ensureHover() {
    if (hoverRing) return hoverRing;
    hoverRing = makeRing(1.0, 1.07, 0xffffff, 0.3, 8);
    hoverRing.visible = false;
    (tokens.root.parent || tokens.root).add(hoverRing);
    return hoverRing;
  }
  function placeRing(r, obj, wall) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) { r.visible = false; return; }
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const rad = Math.max(0.12, Math.hypot(sz.x, wall ? sz.y : sz.z) * 0.62);
    r.scale.setScalar(rad);
    if (wall) { r.rotation.set(0, 0, 0); r.position.set(c.x, c.y, c.z + 0.03); }
    else { r.rotation.set(-Math.PI / 2, 0, 0); r.position.set(c.x, Math.max(0.016, box.min.y + 0.004), c.z); }
    r.visible = true;
  }
  function ringAround(obj, wall) { placeRing(ensureRing(), obj, wall); }

  function setNdc(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  // ── 후보 수집: 팩(마커) / 장면(요소) 을 같은 형태로 ──
  function candidates(sc) {
    const out = [];
    if (sc) {
      for (const { i, o } of sc.session.sceneElements(sc.scope.stageId))
        if (o.visible) out.push({ kind: 'scene', key: i, obj: o, hitObj: o, recursive: true });
    } else {
      for (const ev of tokens.events)
        if (ev.marker && ev.srcToken?._docId != null && ev.marker.group.visible)
          out.push({ kind: 'pack', key: ev.srcToken._docId, obj: ev.marker.group, hitObj: ev.marker.fx, recursive: false, ev });
    }
    return out;
  }
  const ASSIST_PX = 16;   // strict 미스 시 화면 반경 어시스트 (링 구멍·빈틈 클릭 구제)
  function screenPx(worldV, rect) {
    const v = worldV.clone().project(camera);
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  }
  /** 커서 기준 정렬된 near-set: strict 히트(거리순) 뒤에 어시스트 후보(픽셀거리순) */
  function pickList(e, sc) {
    const rect = dom.getBoundingClientRect();
    const cands = candidates(sc);
    const strict = [], assist = [];
    for (const c of cands) {
      const hit = ray.intersectObject(c.hitObj, c.recursive)[0];
      if (hit) { strict.push({ c, d: hit.distance }); continue; }
      const center = new THREE.Box3().setFromObject(c.obj).getCenter(new THREE.Vector3());
      const px = screenPx(center, rect);
      const dpx = Math.hypot(px.x - e.clientX, px.y - e.clientY);
      if (dpx <= ASSIST_PX) assist.push({ c, d: dpx });
    }
    strict.sort((a, b) => a.d - b.d);
    assist.sort((a, b) => a.d - b.d);
    return [...strict, ...assist].map(x => x.c);
  }
  // 스택 순환: 같은 지점 재클릭 = 겹친 다음 요소
  let lastClick = null;   // { x, y, sig, i }
  function pickAt(e, sc, currentKey) {
    const list = pickList(e, sc);
    if (!list.length) { lastClick = null; return null; }
    const sig = list.map(c => c.kind + ':' + c.key).join('|');
    let i = 0;
    if (lastClick && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 8 && lastClick.sig === sig) {
      const cur = list.findIndex(c => c.key === currentKey);
      i = cur >= 0 ? (cur + 1) % list.length : 0;
    }
    lastClick = { x: e.clientX, y: e.clientY, sig, i };
    return list[i];
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
    const currentKey = sc ? sc.scope.sel : getDoc()?.selection;
    const hit = pickAt(e, sc, currentKey);
    if (hit) {
      if (hoverRing) hoverRing.visible = false;
      if (hit.kind === 'scene') {
        sc.scope.pick(hit.key);
        ringAround(hit.obj, !!sc.scope.wall);
        onSceneChange?.('pick');
        beginSceneDrag({ key: hit.key, obj: hit.obj }, e, sc);
      } else {
        getDoc()?.select(hit.key);
        beginPackDrag(hit.ev, e);
      }
      return;
    }
    emptyDown = { x: e.clientX, y: e.clientY };
  }
  function onMove(e) {
    if (!enabled) return;
    if (drag) { applyDrag(e); return; }
    if (e.buttons) return;                       // 궤도 회전 중 — 호버 검사 생략
    setNdc(e);
    const sc = getScene?.();
    const over = pickList(e, sc)[0] || null;
    dom.style.cursor = over ? 'grab' : '';
    // 호버 프리하이라이트 — 무엇이 잡힐지 미리 보여줌 (선택과 동일 대상이면 생략)
    const currentKey = sc ? sc.scope.sel : getDoc()?.selection;
    if (over && over.key !== currentKey) placeRing(ensureHover(), over.obj, sc ? !!sc.scope.wall : over.ev?.surface === 'wall');
    else if (hoverRing) hoverRing.visible = false;
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
      if (!on) { if (drag) endDrag(); dom.style.cursor = ''; if (hoverRing) hoverRing.visible = false; }
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
