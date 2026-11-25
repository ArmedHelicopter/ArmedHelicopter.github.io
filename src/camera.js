import * as THREE from 'three';

const OVERVIEW_POS = new THREE.Vector3(21.2, 15.8, 26.2);
const OVERVIEW_TARGET = new THREE.Vector3(0.0, 3.5, 0.8);

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

function wrapPi(a) {
  let r = (a + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
}

const KF = [
  { pos: [0.0, 2.7, 36.5], att: [0.0, 5.0, 15.5], w: 0.85, v: 1.15, stop: { id: 'archway', index: 0, label: '01/04 · 国立武汉大学牌坊' } },
  { pos: [0.0, 2.2, 23.0], att: [0.0, 4.4, 15.5], w: 0.72, v: 1.05 },
  { pos: [0.0, 1.78, 17.5], att: [0.0, 2.9, 8.0], w: 0.32, v: 1.05 },
  { pos: [0.0, 1.75, 13.0], att: [0.0, 3.2, 2.0], w: 0.25, v: 1.05 },
  { pos: [0.0, 2.35, 9.6], att: [0.0, 4.1, 0.4], w: 0.48, v: 0.85, stop: { id: 'sakura', index: 1, label: '02/04 · 老斋舍 & 樱花大道' } },
  { pos: [0.0, 3.6, 5.6], att: [0.0, 5.1, -0.8], w: 0.58, v: 0.72 },
  { pos: [0.0, 7.0, 2.4], att: [0.0, 7.2, -1.2], w: 0.52, v: 0.68 },
  { pos: [0.0, 9.8, -1.0], att: [0.0, 9.0, -9.8], w: 0.58, v: 0.52, stop: { id: 'library', index: 2, label: '03/04 · 樱顶老图书馆' } },
  { pos: [5.4, 11.8, -3.2], att: [9.5, 8.8, -9.2], w: 0.72, v: 0.50 },
  { pos: [11.4, 8.4, -7.4], att: [23.0, 6.2, -8.4], w: 0.80, v: 0.56 },
  { pos: [16.8, 4.6, -12.4], att: [23.2, 3.5, -6.0], w: 0.74, v: 0.54 },
  { pos: [21.8, 3.4, -13.2], att: [20.5, 2.8, -5.2], w: 0.56, v: 0.46, stop: { id: 'lingbo', index: 3, label: '04/04 · 东湖凌波门' } },
  { pos: [26.0, 3.2, -9.2], att: [16.5, 2.6, -3.8], w: 0.54, v: 0.50 },
  { pos: [28.4, 4.2, -2.6], att: [11.5, 2.9, -1.2], w: 0.62, v: 0.68 },
  { pos: [29.8, 7.6, 6.2], att: [6.5, 3.7, 4.6], w: 0.70, v: 0.84 },
  { pos: [29.4, 11.6, 15.2], att: [2.8, 4.0, 6.0], w: 0.78, v: 0.88 },
  { pos: [27.4, 14.2, 21.4], att: [1.4, 3.9, 4.0], w: 0.86, v: 0.84, stop: { id: 'overview', index: -1, label: '俯瞰全景 · 珞珈校园' } },
  { pos: [24.6, 15.3, 24.6], att: [0.6, 3.7, 2.0], w: 0.92, v: 0.80 },
  { pos: OVERVIEW_POS.toArray(), att: OVERVIEW_TARGET.toArray(), w: 0.96, v: 0.76 },
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
  const AUTOPLAY_DURATION = 34.0;

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

  function kfScalar(key, tParam) {
    const maxI = KF.length - 1;
    const idx = THREE.MathUtils.clamp(tParam, 0, 1) * maxI;
    const i = Math.min(maxI - 1, Math.floor(idx));
    const f = idx - i;
    const sm = f * f * (3 - 2 * f);
    return THREE.MathUtils.lerp(KF[i][key], KF[i + 1][key], sm);
  }

  const progressTable = new Float64Array(CURVE_DIVS + 1);
  {
    const ds = totalCurveLength / CURVE_DIVS;
    let accumT = 0;
    progressTable[0] = 0;
    for (let k = 1; k <= CURVE_DIVS; k++) {
      const uMid = (k - 0.5) / CURVE_DIVS;
      const sMid = uMid * totalCurveLength;
      const tMid = autoplayPosCurve.getUtoTmapping(uMid);
      const v =
        kfScalar('v', tMid) *
        (0.35 + 0.65 * smooth01(0, 6, sMid)) *
        (0.15 + 0.85 * smooth01(0, 10, totalCurveLength - sMid));
      accumT += ds / Math.max(v, 0.05);
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
  const _attPt = new THREE.Vector3();
  const _attDir = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _tanTmp = new THREE.Vector3();
  const _tanMinus = new THREE.Vector3();
  const _tanPlus = new THREE.Vector3();
  const WINDOW_OFFSETS = [-4, -2, 0, 2, 4];
  const WINDOW_WEIGHTS = [1, 2, 3, 2, 1];
  let lastFwdAttAngleDeg = 0;
  let lastAutoStopId = null;

  function sampleRollAt(uSample) {
    const uM = THREE.MathUtils.clamp(uSample - 1.5 / totalCurveLength, 0, 1);
    const uP = THREE.MathUtils.clamp(uSample + 1.5 / totalCurveLength, 0, 1);
    autoplayPosCurve.getTangentAt(uM, _tanMinus);
    autoplayPosCurve.getTangentAt(uP, _tanPlus);
    const hM = Math.atan2(_tanMinus.x, _tanMinus.z);
    const hP = Math.atan2(_tanPlus.x, _tanPlus.z);
    const duMeters = Math.max(0.25, (uP - uM) * totalCurveLength);
    const yawRate = wrapPi(hP - hM) / duMeters;
    const tpS = autoplayPosCurve.getUtoTmapping(uSample);
    return THREE.MathUtils.clamp(yawRate * 0.65 * kfScalar('v', tpS), -0.028, 0.028);
  }

  function applyAutoplayAt(rawT) {
    const clampedT = THREE.MathUtils.clamp(rawT, 0, 1);
    const u = uFromProgress(clampedT);
    const tp = autoplayPosCurve.getUtoTmapping(u);

    autoplayPosCurve.getPoint(tp, _autoPos);
    autoplayAttCurve.getPoint(tp, _attPt);

    _fwd.set(0, 0, 0);
    for (let i = 0; i < WINDOW_OFFSETS.length; i++) {
      const uS = THREE.MathUtils.clamp(u + WINDOW_OFFSETS[i] / totalCurveLength, 0, 1);
      autoplayPosCurve.getTangentAt(uS, _tanTmp);
      _fwd.addScaledVector(_tanTmp, WINDOW_WEIGHTS[i]);
    }
    _fwd.normalize();
    _fwd.y -= 0.1;
    _fwd.normalize();

    _attDir.copy(_attPt).sub(_autoPos).normalize();
    lastFwdAttAngleDeg = THREE.MathUtils.radToDeg(
      Math.acos(THREE.MathUtils.clamp(_fwd.dot(_attDir), -1, 1))
    );

    const w = kfScalar('w', tp);
    _dir.copy(_fwd).multiplyScalar(1 - w).addScaledVector(_attDir, w).normalize();
    _autoLook.copy(_autoPos).addScaledVector(_dir, 10);

    const targetFov = THREE.MathUtils.lerp(50, 44, smoothstepJS(0.88, 1.0, clampedT));
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    let avgRoll = 0;
    for (let i = 0; i < WINDOW_OFFSETS.length; i++) {
      const uS = THREE.MathUtils.clamp(u + WINDOW_OFFSETS[i] / totalCurveLength, 0, 1);
      avgRoll += sampleRollAt(uS) * WINDOW_WEIGHTS[i];
    }
    const lakeLevel = 1.0 - 0.9 * smoothstepJS(0.35, 0.45, clampedT) * smoothstepJS(0.72, 0.60, clampedT);
    avgRoll = (avgRoll / 9) * lakeLevel;

    camera.position.copy(_autoPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(_autoLook);
    camera.rotateZ(avgRoll);
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
    if (camera.fov !== 44) {
      camera.fov = 44;
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
    if (camera.fov !== 44) {
      camera.fov = 44;
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

  function setCameraDirect(posArr, targetArr, { fov = 44, stage: nextStage = 'explore', portalOpen = 1 } = {}) {
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
    if (camera.fov !== 44) {
      camera.fov = 44;
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
    if (camera.fov !== 44) {
      camera.fov = 44;
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
      if (camera.fov !== 44) {
        camera.fov = 44;
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
          if (camera.fov !== 44) {
            camera.fov = 44;
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
