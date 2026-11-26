import * as THREE from 'three';

const OVERVIEW_POS = new THREE.Vector3(21.2, 15.8, 26.2);
const OVERVIEW_TARGET = new THREE.Vector3(0.0, 3.5, 0.8);
const CINEMA_FOV = 42;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function smooth01(e0, e1, x) {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

const KF = [
  { pos: [0.0, 2.7, 36.5], att: [0.0, 4.8, 15.5], stop: { id: 'archway', index: 0, label: '01/04 · 国立武汉大学牌坊' } },
  { pos: [0.0, 2.25, 24.0], att: [0.0, 4.0, 12.0] },
  { pos: [0.0, 2.05, 14.5], att: [0.0, 3.6, 2.0] },
  { pos: [0.0, 3.1, 8.2], att: [0.0, 5.0, -1.8], stop: { id: 'sakura', index: 1, label: '02/04 · 老斋舍 & 樱花大道' } },
  { pos: [0.0, 6.8, 2.6], att: [0.0, 8.0, -8.5] },
  { pos: [0.6, 10.6, -1.6], att: [0.8, 9.2, -9.8], stop: { id: 'library', index: 2, label: '03/04 · 樱顶老图书馆' } },
  { pos: [6.8, 11.2, -4.4], att: [14.0, 8.2, -8.8] },
  { pos: [13.6, 7.2, -9.6], att: [19.0, 4.8, -7.2] },
  { pos: [20.6, 3.8, -13.4], att: [17.8, 2.8, -5.2], stop: { id: 'lingbo', index: 3, label: '04/04 · 东湖凌波门' } },
  { pos: [26.2, 3.3, -9.2], att: [14.5, 2.7, -3.5] },
  { pos: [28.6, 4.4, -2.0], att: [10.5, 3.0, -0.6] },
  { pos: [29.8, 8.2, 7.2], att: [5.5, 3.8, 3.6] },
  { pos: [28.6, 12.6, 16.8], att: [2.0, 4.0, 3.8], stop: { id: 'overview', index: -1, label: '俯瞰全景 · 珞珈校园' } },
  { pos: [25.6, 15.0, 23.4], att: [0.6, 3.7, 1.8] },
  { pos: OVERVIEW_POS.toArray(), att: OVERVIEW_TARGET.toArray() },
];

/**
 * Choreographed multi-stage camera controller:
 * 1) 'autoplay': Default-on FPV CatmullRomCurve3 landmark tour (牌坊 -> 老斋舍 -> 老图 -> 凌波门 -> 俯瞰)
 * 2) 'portal': Optional archway threshold view with gentle mouse parallax
 * 3) 'flythrough': Quick 3.2s pass through central archway bay to overview
 * 4) 'explore': Damped spherical orbit with smooth landmark focus & touch/drag interruption
 */
export function createCameraController(
  camera,
  domElement,
  { onStageChange, onPortalProgress, onAutoplayProgress, onAutoplayInterrupt }
) {
  let stage = 'autoplay';
  let flyElapsed = 0;
  let flyFrozen = false;
  const FLY_DURATION = 3.2;

  let autoplayElapsed = 0;
  let autoplayPaused = false;
  const AUTOPLAY_DURATION = 42.0;

  const pointer = { x: 0, y: 0 };
  const smoothPointer = { x: 0, y: 0 };

  const posCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 3.25, 31.2),
    new THREE.Vector3(0, 2.7, 21.0),
    new THREE.Vector3(0, 2.7, 13.8),
    new THREE.Vector3(0, 4.8, 6.2),
    OVERVIEW_POS.clone(),
  ]);

  const lookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.15, 15.5),
    new THREE.Vector3(0, 3.6, 6.5),
    new THREE.Vector3(0, 4.7, -2.0),
    OVERVIEW_TARGET.clone(),
  ]);

  // Deterministic cinematic FPV drone flight: 牌坊 -> 樱花大道 & 老斋舍 -> 樱顶老图书馆 -> 东湖凌波门 -> 全景俯瞰
  const CURVE_DIVS = 2000;
  const autoplayPosCurve = new THREE.CatmullRomCurve3(
    KF.map((k) => new THREE.Vector3(...k.pos)),
    false,
    'centripetal',
    0.5
  );
  autoplayPosCurve.arcLengthDivisions = CURVE_DIVS;
  const autoplayAttCurve = new THREE.CatmullRomCurve3(
    KF.map((k) => new THREE.Vector3(...k.att)),
    false,
    'centripetal',
    0.5
  );
  autoplayAttCurve.arcLengthDivisions = CURVE_DIVS;

  const curveLengths = autoplayPosCurve.getLengths(CURVE_DIVS);
  const totalCurveLength = curveLengths[curveLengths.length - 1] || 1;

  // Pre-bake uniform-arc-length samples + zero-phase 3-pass C2 smoothing (eliminates knot shudder)
  function smoothVecArray(arr, radius, passes, normalizeOut) {
    let cur = arr.map((v) => v.clone());
    const first = arr[0].clone();
    const last = arr[arr.length - 1].clone();
    for (let pass = 0; pass < passes; pass++) {
      const next = new Array(cur.length);
      for (let i = 0; i < cur.length; i++) {
        const edgeR = Math.min(radius, i, cur.length - 1 - i);
        if (edgeR <= 0) {
          next[i] = cur[i].clone();
          continue;
        }
        const sum = new THREE.Vector3();
        for (let j = i - edgeR; j <= i + edgeR; j++) sum.add(cur[j]);
        sum.divideScalar(2 * edgeR + 1);
        if (normalizeOut) sum.normalize();
        next[i] = sum;
      }
      next[0].copy(first);
      next[cur.length - 1].copy(last);
      cur = next;
    }
    return cur;
  }

  let bakedPos = [];
  let bakedDir = [];
  for (let k = 0; k <= CURVE_DIVS; k++) {
    const u = k / CURVE_DIVS;
    const tp = autoplayPosCurve.getUtoTmapping(u);
    const p = autoplayPosCurve.getPoint(tp);
    const a = autoplayAttCurve.getPoint(tp);
    bakedPos.push(p);
    bakedDir.push(a.sub(p).normalize());
  }
  bakedPos = smoothVecArray(bakedPos, 18, 3, false);
  bakedDir = smoothVecArray(bakedDir, 58, 3, true);

  // Angular-velocity-limited speed profile: caps peak pan rate (~12 deg/s) to eliminate stroboscopic judder
  const progressTable = new Float64Array(CURVE_DIVS + 1);
  {
    const ds = totalCurveLength / CURVE_DIVS;
    let accumT = 0;
    progressTable[0] = 0;
    for (let k = 1; k <= CURVE_DIVS; k++) {
      const uMid = (k - 0.5) / CURVE_DIVS;
      const sMid = uMid * totalCurveLength;
      const dAngRad = Math.acos(THREE.MathUtils.clamp(bakedDir[k].dot(bakedDir[k - 1]), -1, 1));
      const angPerMeter = dAngRad / ds;
      const edge = (0.42 + 0.58 * smooth01(0, 7, sMid)) * (0.28 + 0.72 * smooth01(0, 12, totalCurveLength - sMid));
      const turnCap = 0.052 / Math.max(angPerMeter, 0.01);
      const v = edge * Math.min(1.0, turnCap);
      accumT += ds / Math.max(v, 0.12);
      progressTable[k] = accumT;
    }
    const totalTime = progressTable[CURVE_DIVS] || 1;
    for (let k = 0; k <= CURVE_DIVS; k++) {
      progressTable[k] /= totalTime;
    }
    progressTable[CURVE_DIVS] = 1;
  }

  function uFromProgress(rawT) {
    const p = THREE.MathUtils.clamp(rawT, 0, 1);
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let lo = 0;
    let hi = CURVE_DIVS;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (progressTable[mid] <= p) lo = mid;
      else hi = mid;
    }
    const span = progressTable[hi] - progressTable[lo];
    const frac = span > 1e-9 ? (p - progressTable[lo]) / span : 0;
    return (lo + frac) / CURVE_DIVS;
  }

  function progressFromU(u) {
    const c = THREE.MathUtils.clamp(u, 0, 1) * CURVE_DIVS;
    const lo = Math.min(CURVE_DIVS - 1, Math.floor(c));
    const frac = c - lo;
    return THREE.MathUtils.lerp(progressTable[lo], progressTable[lo + 1], frac);
  }

  const AUTOPLAY_STOPS = KF.map((k, idx) => {
    if (!k.stop) return null;
    const sampleIdx = Math.round((idx / (KF.length - 1)) * CURVE_DIVS);
    const uStop = curveLengths[sampleIdx] / totalCurveLength;
    return {
      ...k.stop,
      tStart: idx === 0 ? 0 : progressFromU(uStop),
    };
  }).filter(Boolean);

  const smoothLookAt = new THREE.Vector3(...KF[0].att);

  function getStopForProgress(rawT) {
    let current = AUTOPLAY_STOPS[0];
    for (let i = 0; i < AUTOPLAY_STOPS.length; i++) {
      if (rawT >= AUTOPLAY_STOPS[i].tStart) current = AUTOPLAY_STOPS[i];
    }
    return current;
  }

  const _autoPos = new THREE.Vector3();
  const _autoLook = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  let lastFwdAttAngleDeg = 0;
  let lastAutoStopId = null;

  function applyAutoplayAt(rawT) {
    const clampedT = THREE.MathUtils.clamp(rawT, 0, 1);
    const u = uFromProgress(clampedT);
    const c = u * CURVE_DIVS;
    const lo = Math.min(CURVE_DIVS - 1, Math.floor(c));
    const hi = lo + 1;
    const frac = c - lo;

    _autoPos.copy(bakedPos[lo]).lerp(bakedPos[hi], frac);
    _dir.copy(bakedDir[lo]).lerp(bakedDir[hi], frac).normalize();

    const loPrev = Math.max(0, lo - 1);
    const hiNext = Math.min(CURVE_DIVS, hi + 1);
    _fwd.copy(bakedPos[hiNext]).sub(bakedPos[loPrev]).normalize();

    lastFwdAttAngleDeg = THREE.MathUtils.radToDeg(
      Math.acos(THREE.MathUtils.clamp(_fwd.dot(_dir), -1, 1))
    );
    _autoLook.copy(_autoPos).addScaledVector(_dir, 10);

    if (camera.fov !== CINEMA_FOV) {
      camera.fov = CINEMA_FOV;
      camera.updateProjectionMatrix();
    }

    camera.position.copy(_autoPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(_autoLook);
    smoothLookAt.copy(_autoLook);

    const doorProgress = _autoPos.z > 10 ? smoothstepJS(36, 20, _autoPos.z) : 1;
    onPortalProgress?.(doorProgress);

    const stop = getStopForProgress(clampedT);
    lastAutoStopId = stop.id;
    onAutoplayProgress?.({
      progress: clampedT,
      paused: autoplayPaused,
      stopIndex: stop.index,
      stopId: stop.id,
      stopLabel: stop.label,
    });
  }

  function smoothstepJS(e0, e1, x) {
    const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  const target = OVERVIEW_TARGET.clone();
  const desiredTarget = OVERVIEW_TARGET.clone();
  const spherical = new THREE.Spherical();
  const desiredSpherical = new THREE.Spherical();

  function syncSphericalFromPos(posVec, tgtVec) {
    const offset = posVec.clone().sub(tgtVec);
    spherical.setFromVector3(offset);
    desiredSpherical.copy(spherical);
  }
  syncSphericalFromPos(OVERVIEW_POS, OVERVIEW_TARGET);

  let tweenActive = false;
  let tweenElapsed = 0;
  const TWEEN_DURATION = 1.05;
  const tweenStartPos = new THREE.Vector3();
  const tweenEndPos = new THREE.Vector3();
  const tweenStartTarget = new THREE.Vector3();
  const tweenEndTarget = new THREE.Vector3();

  const activePointers = new Map();
  let lastPinchDist = null;
  let isDragging = false;
  let prevDrag = { x: 0, y: 0 };

  function getPortalBasePos() {
    const aspect = camera.aspect || 1.6;
    if (aspect < 0.85) {
      if (camera.fov !== 58) {
        camera.fov = 58;
        camera.updateProjectionMatrix();
      }
      return new THREE.Vector3(0, 3.9, 44.5);
    }
    if (camera.fov !== CINEMA_FOV) {
      camera.fov = CINEMA_FOV;
      camera.updateProjectionMatrix();
    }
    return new THREE.Vector3(0, 3.25, 31.2);
  }

  function applyPortalCamera(dt) {
    smoothPointer.x += (pointer.x - smoothPointer.x) * Math.min(1, dt * 4.5);
    smoothPointer.y += (pointer.y - smoothPointer.y) * Math.min(1, dt * 4.5);
    const base = getPortalBasePos();
    camera.position.set(
      base.x + smoothPointer.x * 0.65,
      base.y + smoothPointer.y * 0.25,
      base.z
    );
    const lookY = (camera.aspect || 1.6) < 0.85 ? 3.55 : 4.15;
    camera.lookAt(0, lookY, 15.5);
  }

  function startAutoplay() {
    stage = 'autoplay';
    autoplayElapsed = 0;
    autoplayPaused = false;
    flyFrozen = false;
    tweenActive = false;
    lastAutoStopId = null;
    onStageChange?.('autoplay');
    applyAutoplayAt(0);
  }

  function pauseAutoplay(paused = true) {
    if (stage !== 'autoplay') return false;
    autoplayPaused = Boolean(paused);
    const rawT = THREE.MathUtils.clamp(autoplayElapsed / AUTOPLAY_DURATION, 0, 1);
    const stop = getStopForProgress(rawT);
    onAutoplayProgress?.({
      progress: rawT,
      paused: autoplayPaused,
      stopIndex: stop.index,
      stopId: stop.id,
      stopLabel: stop.label,
    });
    return autoplayPaused;
  }

  function seekAutoplay(progress01 = 0) {
    stage = 'autoplay';
    autoplayPaused = true;
    tweenActive = false;
    flyFrozen = false;
    const clamped = THREE.MathUtils.clamp(progress01, 0, 1);
    autoplayElapsed = clamped * AUTOPLAY_DURATION;
    onStageChange?.('autoplay');
    applyAutoplayAt(clamped);
    return getAutoplayState();
  }

  function skipAutoplay(snap = false) {
    if (stage !== 'autoplay') return;
    autoplayPaused = false;
    enterExplore(snap);
  }

  function interruptAutoplayToExplore() {
    if (stage !== 'autoplay') return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const fallbackTarget = camera.position.clone().addScaledVector(forward, 15);
    fallbackTarget.y = Math.max(0.6, Math.min(fallbackTarget.y, camera.position.y - 1.2));
    if (fallbackTarget.distanceTo(camera.position) < 13.5) {
      fallbackTarget.copy(camera.position).addScaledVector(forward, 15);
      fallbackTarget.y = Math.max(0.4, fallbackTarget.y);
    }

    stage = 'explore';
    autoplayPaused = false;
    tweenActive = false;
    if (camera.fov !== CINEMA_FOV) {
      camera.fov = CINEMA_FOV;
      camera.updateProjectionMatrix();
    }
    target.copy(fallbackTarget);
    desiredTarget.copy(fallbackTarget);
    syncSphericalFromPos(camera.position, fallbackTarget);
    desiredSpherical.phi = THREE.MathUtils.clamp(desiredSpherical.phi, 0.34, 1.22);
    desiredSpherical.radius = THREE.MathUtils.clamp(desiredSpherical.radius, 13, 46);
    onPortalProgress?.(1);
    onStageChange?.('explore');
    onAutoplayInterrupt?.();
  }

  function getAutoplayStops() {
    return AUTOPLAY_STOPS.map(({ id, index, label, tStart }) => ({ id, index, label, tStart }));
  }

  function getAutoplayState() {
    const rawT = THREE.MathUtils.clamp(autoplayElapsed / AUTOPLAY_DURATION, 0, 1);
    const effectiveT = stage === 'autoplay' ? rawT : 1;
    const stop = getStopForProgress(effectiveT);
    return {
      active: stage === 'autoplay',
      paused: autoplayPaused,
      progress: effectiveT,
      stopIndex: stop.index,
      stopId: stop.id,
      stopLabel: stop.label,
      stage,
      fov: +camera.fov.toFixed(2),
      fwdAttAngleDeg: +lastFwdAttAngleDeg.toFixed(2),
      cameraPos: camera.position.toArray().map((n) => +n.toFixed(3)),
      cameraTarget:
        stage === 'autoplay'
          ? _autoLook.toArray().map((n) => +n.toFixed(3))
          : target.toArray().map((n) => +n.toFixed(3)),
    };
  }

  function setCameraDirect(posArr, targetArr, { fov = CINEMA_FOV, stage: nextStage = 'explore', portalOpen = 1 } = {}) {
    autoplayPaused = false;
    flyFrozen = false;
    tweenActive = false;
    stage = nextStage;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const nextPos = new THREE.Vector3(...posArr);
    const nextTgt = new THREE.Vector3(...targetArr);
    camera.position.copy(nextPos);
    target.copy(nextTgt);
    desiredTarget.copy(nextTgt);
    syncSphericalFromPos(nextPos, nextTgt);
    camera.lookAt(nextTgt);
    onPortalProgress?.(portalOpen);
    onStageChange?.(stage);
  }

  function enterPortal() {
    stage = 'portal';
    autoplayPaused = false;
    tweenActive = false;
    flyFrozen = false;
    flyElapsed = 0;
    onPortalProgress?.(0);
    applyPortalCamera(1);
    onStageChange?.('portal');
  }

  function startFlythrough() {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      enterExplore(true);
      return;
    }

    stage = 'flythrough';
    flyElapsed = 0;
    flyFrozen = false;
    tweenActive = false;
    onStageChange?.('flythrough');
  }

  function enterExplore(snap = false) {
    stage = 'explore';
    flyFrozen = false;
    if (camera.fov !== CINEMA_FOV) {
      camera.fov = CINEMA_FOV;
      camera.updateProjectionMatrix();
    }
    onPortalProgress?.(1);
    if (snap) {
      target.copy(OVERVIEW_TARGET);
      desiredTarget.copy(OVERVIEW_TARGET);
      camera.position.copy(OVERVIEW_POS);
      syncSphericalFromPos(OVERVIEW_POS, OVERVIEW_TARGET);
      camera.lookAt(target);
      tweenActive = false;
    } else {
      resetOverview();
    }
    onStageChange?.('explore');
  }

  function jumpMidFly(progress = 0.42) {
    stage = 'flythrough';
    flyFrozen = true;
    flyElapsed = progress * FLY_DURATION;
    if (camera.fov !== CINEMA_FOV) {
      camera.fov = CINEMA_FOV;
      camera.updateProjectionMatrix();
    }
    const t = easeInOutCubic(progress);
    const p = posCurve.getPoint(t);
    const l = lookCurve.getPoint(t);
    camera.position.copy(p);
    camera.lookAt(l);
    const doorProgress = Math.min(1, progress / 0.35);
    onPortalProgress?.(doorProgress);
    onStageChange?.('flythrough');
  }

  function focusLandmark(camPosArr, camTargetArr, snap = false) {
    if (stage !== 'explore') {
      if (stage === 'autoplay') {
        target.copy(_autoLook);
        desiredTarget.copy(_autoLook);
      }
      stage = 'explore';
      autoplayPaused = false;
      flyFrozen = false;
      if (camera.fov !== CINEMA_FOV) {
        camera.fov = CINEMA_FOV;
        camera.updateProjectionMatrix();
      }
      onPortalProgress?.(1);
      onStageChange?.('explore');
    }
    const nextPos = new THREE.Vector3(...camPosArr);
    const nextTgt = new THREE.Vector3(...camTargetArr);

    if (snap) {
      tweenActive = false;
      target.copy(nextTgt);
      desiredTarget.copy(nextTgt);
      camera.position.copy(nextPos);
      syncSphericalFromPos(nextPos, nextTgt);
      camera.lookAt(target);
      return;
    }

    tweenStartPos.copy(camera.position);
    tweenStartTarget.copy(target);
    tweenEndPos.copy(nextPos);
    tweenEndTarget.copy(nextTgt);
    tweenElapsed = 0;
    tweenActive = true;
  }

  function resetOverview(snap = false) {
    focusLandmark(OVERVIEW_POS.toArray(), OVERVIEW_TARGET.toArray(), snap);
  }

  function onPointerMove(e) {
    const rect = domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }

    if (stage !== 'explore') return;

    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDist !== null) {
        const delta = lastPinchDist - dist;
        desiredSpherical.radius = THREE.MathUtils.clamp(desiredSpherical.radius + delta * 0.06, 13, 46);
      }
      lastPinchDist = dist;
      tweenActive = false;
      return;
    }

    if (isDragging) {
      const dx = e.clientX - prevDrag.x;
      const dy = e.clientY - prevDrag.y;
      prevDrag = { x: e.clientX, y: e.clientY };

      desiredSpherical.theta -= dx * 0.0065;
      desiredSpherical.phi = THREE.MathUtils.clamp(desiredSpherical.phi - dy * 0.0055, 0.34, 1.22);
      tweenActive = false;
    }
  }

  function onPointerDown(e) {
    if (stage === 'autoplay') {
      interruptAutoplayToExplore();
    }
    if (stage !== 'explore') return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 1) {
      isDragging = true;
      prevDrag = { x: e.clientX, y: e.clientY };
    }
    lastPinchDist = null;
  }

  function onPointerUp(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) lastPinchDist = null;
    if (activePointers.size === 0) isDragging = false;
  }

  function zoomBy(deltaY) {
    if (stage !== 'explore') return;
    desiredSpherical.radius = THREE.MathUtils.clamp(desiredSpherical.radius + deltaY * 0.022, 13, 46);
    tweenActive = false;
  }

  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  function update(dt) {
    if (stage === 'autoplay') {
      if (!autoplayPaused) {
        autoplayElapsed += dt;
        const rawT = Math.min(1, autoplayElapsed / AUTOPLAY_DURATION);
        applyAutoplayAt(rawT);
        if (rawT >= 1) {
          stage = 'explore';
          autoplayPaused = false;
          if (camera.fov !== CINEMA_FOV) {
            camera.fov = CINEMA_FOV;
            camera.updateProjectionMatrix();
          }
          target.copy(OVERVIEW_TARGET);
          desiredTarget.copy(OVERVIEW_TARGET);
          camera.position.copy(OVERVIEW_POS);
          syncSphericalFromPos(OVERVIEW_POS, OVERVIEW_TARGET);
          camera.lookAt(OVERVIEW_TARGET);
          onPortalProgress?.(1);
          onStageChange?.('explore', { reason: 'autoplay-complete' });
        }
      }
      return;
    }

    if (stage === 'portal') {
      onPortalProgress?.(0);
      applyPortalCamera(dt);
      return;
    }

    if (stage === 'flythrough') {
      if (!flyFrozen) {
        flyElapsed += dt;
        const rawT = Math.min(1, flyElapsed / FLY_DURATION);
        const t = easeInOutCubic(rawT);
        const pos = posCurve.getPoint(t);
        const look = lookCurve.getPoint(t);
        camera.position.copy(pos);
        camera.lookAt(look);

        const doorProgress = Math.min(1, rawT / 0.35);
        onPortalProgress?.(doorProgress);

        if (rawT >= 1) {
          stage = 'explore';
          target.copy(OVERVIEW_TARGET);
          desiredTarget.copy(OVERVIEW_TARGET);
          syncSphericalFromPos(OVERVIEW_POS, OVERVIEW_TARGET);
          onStageChange?.('explore');
        }
      }
      return;
    }

    if (tweenActive) {
      tweenElapsed += dt;
      const raw = Math.min(1, tweenElapsed / TWEEN_DURATION);
      const e = raw * raw * raw * (raw * (raw * 6.0 - 15.0) + 10.0); // smootherstep
      camera.position.lerpVectors(tweenStartPos, tweenEndPos, e);
      camera.position.y += Math.sin(e * Math.PI) * 1.8; // gentle drone arc lift
      target.lerpVectors(tweenStartTarget, tweenEndTarget, e);
      desiredTarget.copy(target);
      syncSphericalFromPos(camera.position, target);
      smoothLookAt.lerp(target, Math.min(1, dt * 10.0));
      camera.lookAt(smoothLookAt);
      if (raw >= 1) tweenActive = false;
      return;
    }

    const damping = Math.min(1, dt * 7.5);
    spherical.theta += (desiredSpherical.theta - spherical.theta) * damping;
    spherical.phi += (desiredSpherical.phi - spherical.phi) * damping;
    spherical.radius += (desiredSpherical.radius - spherical.radius) * damping;
    target.lerp(desiredTarget, damping);

    const offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  }

  function getStage() {
    return stage;
  }

  function dispose() {
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  return {
    startAutoplay,
    pauseAutoplay,
    seekAutoplay,
    skipAutoplay,
    interruptAutoplayToExplore,
    getAutoplayStops,
    getAutoplayState,
    setCameraDirect,
    enterPortal,
    startFlythrough,
    enterExplore,
    jumpMidFly,
    focusLandmark,
    resetOverview,
    zoomBy,
    update,
    getStage,
    dispose,
  };
}
