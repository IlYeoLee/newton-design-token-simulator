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
import { WALL_Z } from './scene.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEditor3D({ dom, tokens, getCamera, getControls, getDoc, onEdit, getScene, onSceneChange, onTool }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitW = new THREE.Vector3();
  let enabled = false;
  let tool = 'select';      // 'select' | 'mark' — 팔레트와 동기 (2D 캔버스와 같은 도구 모델)
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
    ray.setFromCamera(ndc, getCamera());
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
    const v = worldV.clone().project(getCamera());
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
  let lastClick = null;   // { x, y, sig, t }
  function pickAt(e, sc, currentKey) {
    const list = pickList(e, sc);
    if (!list.length) { lastClick = null; return null; }
    const sig = list.map(c => c.kind + ':' + c.key).join('|');
    let i = 0;
    const now = performance.now();
    if (lastClick && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 8 && lastClick.sig === sig) {
      const cur = list.findIndex(c => c.key === currentKey);
      // 더블클릭(350ms 내)은 순환하지 않음 — 글자 진입용. 천천히 재클릭 = 겹침 순환.
      if (now - lastClick.t < 350) i = Math.max(0, cur);
      else i = cur >= 0 ? (cur + 1) % list.length : 0;
    }
    lastClick = { x: e.clientX, y: e.clientY, sig, t: now };
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
    getControls().enabled = false;
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
    getControls().enabled = true;
    dom.style.cursor = '';
  }

  /** '＋ 토큰 넣기' — 3D에서 직접: 투사면 평면 교차 → 역매핑 → addMark */
  function addMarkAt(e) {
    const doc = getDoc(); if (!doc) return false;
    const L = tokens.layout;
    const wallMode = L.mode === 'static';        // 복싱: 저작 대상은 벽 타겟
    const parent = wallMode ? tokens.wallRoot : tokens.floorRoot;
    const pW = new THREE.Vector3();
    parent.getWorldPosition(pW);
    const plane = wallMode
      ? new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, WALL_Z + 0.02))
      : new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, pW.y, 0));
    if (!ray.ray.intersectPlane(plane, hitW)) return false;
    const local = parent.worldToLocal(hitW.clone());
    let id = null;
    if (wallMode) {
      const W = L.WALL;
      id = doc.addMark(clamp(local.x / W.XS, -1, 1), maxT(doc) + 0.6);
      doc.moveXY(id, clamp(local.x / W.XS, -1, 1), clamp((local.y - W.Y0) / W.YS, -1, 1.2));
    } else if (L.mode === 'advance') {
      id = doc.addMark(clamp(local.x / L.X_SCALE, -1, 1), Math.max(0, -(local.z + L.STRIKE_AHEAD) / L.V));
    } else if (L.mode === 'spatial') {
      const nx = clamp(local.x / L.SCALE, -1.5, 1.5);
      id = doc.addMark(nx, maxT(doc) + 0.6);
      doc.moveXY(id, nx, clamp(local.z / L.SCALE, -1.5, 1.5));
    }
    if (id == null) return false;
    doc.select(id);
    onEdit();
    setToolFn('select');   // 배치 즉시 선택 복귀 (2D 캔버스와 동일 관례)
    return true;
  }
  function maxT(doc) { let m = 0; for (const mk of doc.marks) m = Math.max(m, mk.t); return m; }
  function setToolFn(t) {
    tool = t;
    dom.style.cursor = t === 'mark' ? 'crosshair' : '';
    if (t === 'mark' && hoverRing) hoverRing.visible = false;
    onTool?.(t);
  }

  function onDown(e) {
    if (!enabled || e.button !== 0) return;
    setNdc(e);
    const sc = getScene?.();
    if (!sc && tool === 'mark') { if (addMarkAt(e)) return; }
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
  let _hoverAt = 0;
  function onMove(e) {
    if (!enabled) return;
    if (drag) { applyDrag(e); return; }
    if (e.buttons) return;                       // 궤도 회전 중 — 호버 검사 생략
    if (tool === 'mark') { dom.style.cursor = 'crosshair'; return; }
    const now = performance.now();               // 호버 픽 스로틀 — 레이캐스트+Box3 매 move는 과함
    if (now - _hoverAt < 40) return;
    _hoverAt = now;
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
  // 더블클릭 = 캔버스 인라인 텍스트 편집 (피그마: 그 자리에서 바로 타이핑)
  let inlineInput = null;
  function closeInline(commit = true) {
    if (!inlineInput) return;
    const el = inlineInput; inlineInput = null;
    el.remove();
    if (commit) onSceneChange?.('end');
  }
  function openInlineText(cand, sc) {
    closeInline(false);
    let txtEl = null;
    cand.obj.traverse(c => { if (!txtEl && c.userData?.el?.type === 'text') txtEl = c.userData.el; });
    // 요소 화면 위치에 입력창 (선택 링 중심)
    const box = new THREE.Box3().setFromObject(cand.obj);
    const c = box.getCenter(new THREE.Vector3()).project(getCamera());
    const r = dom.getBoundingClientRect();
    const x = r.left + (c.x * 0.5 + 0.5) * r.width;
    const y = r.top + (-c.y * 0.5 + 0.5) * r.height;
    const inp = document.createElement('input');
    inp.id = 'inline-text';
    inp.value = txtEl?.content ?? '';
    inp.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);z-index:60;
      min-width:120px;width:${Math.max(120, (inp.value.length + 2) * 13)}px;padding:7px 10px;text-align:center;
      background:rgba(12,14,18,.95);color:#FFF3DC;border:1.5px solid #FA3030;border-radius:8px;
      font:600 14px Pretendard,-apple-system,sans-serif;outline:none;box-shadow:0 4px 18px rgba(0,0,0,.5);`;
    inp.addEventListener('input', () => {
      sc.scope.setText({ content: inp.value });                      // 타이핑 즉시 장면 반영
      inp.style.width = Math.max(120, (inp.value.length + 2) * 13) + 'px';
    });
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') closeInline();
      if (ev.key === 'Escape') closeInline();
      ev.stopPropagation();
    });
    inp.addEventListener('blur', () => closeInline());
    document.body.appendChild(inp);
    inlineInput = inp;
    inp.focus(); inp.select();
  }
  dom.addEventListener('dblclick', e => {
    if (!enabled) return;
    const sc = getScene?.();
    if (!sc) return;
    setNdc(e);
    const hasText = o => {
      let f = false;
      o.traverse(c => { if (c.userData?.el?.type === 'text') f = true; });
      return f;
    };
    // 커서 아래 후보 중 글자 보유 요소 우선 (TAP ×2 같은 묶음의 글자 직행)
    const cand = pickList(e, sc).find(c => hasText(c.obj))
      ?? (sc.scope.sel >= 0 ? { key: sc.scope.sel, obj: sc.session.sceneElements(sc.scope.stageId).find(x => x.i === sc.scope.sel)?.o } : null);
    if (!cand?.obj || !hasText(cand.obj)) return;
    if (sc.scope.sel !== cand.key) { sc.scope.pick(cand.key); ringAround(cand.obj, !!sc.scope.wall); onSceneChange?.('pick'); }
    openInlineText(cand, sc);
  });

  return {
    setTool: setToolFn,
    setEnabled(on) {
      enabled = !!on;
      if (!on) { if (drag) endDrag(); dom.style.cursor = ''; if (hoverRing) hoverRing.visible = false; closeInline(false); }
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
