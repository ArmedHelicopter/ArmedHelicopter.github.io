import * as THREE from 'three';

const OVERVIEW_POS = new THREE.Vector3(21.2, 15.8, 26.2);
const OVERVIEW_TARGET = new THREE.Vector3(0.0, 3.5, 0.8);

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

const AUTOPLAY_STOPS = [
  { id: 'archway', index: 0, label: '01/04 · 国立武汉大学牌坊', tStart: 0.0, tMid: 0.14 },
  { id: 'sakura', index: 1, label: '02/04 · 老斋舍 & 樱花大道', tStart: 0.25, tMid: 0.38 },
  { id: 'library', index: 2, label: '03/04 · 樱顶老图书馆', tStart: 0.49, tMid: 0.61 },
  { id: 'lingbo', index: 3, label: '04/04 · 东湖凌波门', tStart: 0.72, tMid: 0.83 },
  { id: 'overview', index: -1, label: '俯瞰全景 · 珞珈校园', tStart: 0.91, tMid: 1.0 },
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
  const AUTOPLAY_DURATION = 26.0;

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

  // Straight-in central-axis FPV: 牌坊 → 中轴 carpet → 百步梯 → 老斋舍 → 老图拉升 → 凌波门 → 俯瞰
  const autoplayPosPoints = [
    new THREE.Vector3(0.0, 2.55, 36.2), // 0: South Plaza approach
    new THREE.Vector3(0.0, 2.35, 31.2), // 1: Stop 01 - 国立武汉大学牌坊 (all 4 冲天柱 finials + 抱鼓石 + sky headroom)
    new THREE.Vector3(0.0, 1.95, 14.4), // 2: Through central bay (x∈[-2.04,2.04], y<4.52)
    new THREE.Vector3(0.0, 1.95, 10.6), // 3: Straight along the ceremonial carpet
    new THREE.Vector3(0.0, 2.15, 7.6), // 4: Foot of the 108-step staircase
    new THREE.Vector3(0.0, 3.0, 6.0), // 5: Ascending the stairs
    new THREE.Vector3(0.0, 4.4, 3.4), // 6: Stop 02 - Crest onto Tier 1, 老斋舍 dead ahead
    new THREE.Vector3(0.0, 7.6, -0.6), // 7: Rising over the dormitory roofline (central 歇山顶 crest ≈ 7.19)
    new THREE.Vector3(0.0, 8.6, -4.8), // 8: Over Tier 2 south edge, library ahead
    new THREE.Vector3(0.2, 9.5, -6.2), // 9: Stop 03 - 樱顶老图书馆 hero
    new THREE.Vector3(4.0, 8.2, -4.0), // 10: 拉升 - begin eastward pull-up over the cliff
    new THREE.Vector3(9.5, 6.4, -6.0), // 11: Over the lakeside promenade
    new THREE.Vector3(13.5, 4.4, -7.6), // 12: Lingbo Pier approach
    new THREE.Vector3(15.6, 3.4, -9.8), // 13: Stop 04 - 凌波亭 + pier + open lake
    new THREE.Vector3(19.5, 4.6, -6.4), // 14: Sweep past the pier
    new THREE.Vector3(21.5, 6.6, 1.2), // 15: Ascent above East Lake
    new THREE.Vector3(22.6, 11.2, 12.5), // 16: Wide banking sweep
    OVERVIEW_POS.clone(), // 17: Final Overview
  ];

  const autoplayLookPoints = [
    new THREE.Vector3(0.0, 4.5, 15.5),
    new THREE.Vector3(0.0, 4.65, 15.5),
    new THREE.Vector3(0.0, 3.2, 7.0),
    new THREE.Vector3(0.0, 3.0, 4.0),
    new THREE.Vector3(0.0, 3.4, 2.2),
    new THREE.Vector3(0.0, 4.2, 0.5),
    new THREE.Vector3(0.0, 5.2, -1.5),
    new THREE.Vector3(0.0, 6.4, -5.5),
    new THREE.Vector3(0.0, 7.4, -9.8),
    new THREE.Vector3(0.0, 8.2, -9.8),
    new THREE.Vector3(1.0, 7.2, -8.4),
    new THREE.Vector3(12.0, 2.8, -7.4),
    new THREE.Vector3(13.5, 1.8, -8.4),
    new THREE.Vector3(14.6, 1.5, -10.8),
    new THREE.Vector3(16.0, 1.4, -12.0),
    new THREE.Vector3(12.0, 3.2, -2.0),
    new THREE.Vector3(2.0, 3.4, 0.2),
    OVERVIEW_TARGET.clone(),
  ];

  const autoplayPosCurve = new THREE.CatmullRomCurve3(autoplayPosPoints, false, 'centripetal', 0.5);
  autoplayPosCurve.arcLengthDivisions = 400;
  const autoplayLookCurve = new THREE.CatmullRomCurve3(autoplayLookPoints, false, 'centripetal', 0.5);
  autoplayLookCurve.arcLengthDivisions = 400;

  // Map each control point index to its normalized arc-length u in [0, 1]
  function findCurveUForControlPoint(idx) {
    const targetT = idx / (autoplayPosPoints.length - 1);
    const lengths = autoplayPosCurve.getLengths(400);
    const totalLen = lengths[lengths.length - 1] || 1;
    const sampleIdx = Math.round(targetT * 400);
    return lengths[sampleIdx] / totalLen;
  }

  const knotTable = [
    { t: 0.0, u: 0.0 },
    { t: 0.14, u: findCurveUForControlPoint(1) }, // Archway
    { t: 0.38, u: findCurveUForControlPoint(6) }, // 108 Steps & Old Dormitory
    { t: 0.61, u: findCurveUForControlPoint(9) }, // Old Library hero
    { t: 0.83, u: findCurveUForControlPoint(13) }, // Lingbo Pavilion & Pier
    { t: 1.0, u: 1.0 },
  ];

  const smoothLookAt = new THREE.Vector3(0.0, 4.5, 15.5);

  function mapTimeToU(rawT) {
    const t = THREE.MathUtils.clamp(rawT, 0, 1);
    for (let i = 0; i < knotTable.length - 1; i++) {
      const a = knotTable[i];
      const b = knotTable[i + 1];
      if (t <= b.t || i === knotTable.length - 2) {
        const span = Math.max(1e-5, b.t - a.t);
        const s = THREE.MathUtils.clamp((t - a.t) / span, 0, 1);
        const w = s * s * (3.0 - 2.0 * s); // Smooth C1 zero-jerk easing across intervals
        return THREE.MathUtils.lerp(a.u, b.u, w);
      }
    }
    return 1;
  }

  function getStopForProgress(rawT) {
    let current = AUTOPLAY_STOPS[0];
    for (let i = 0; i < AUTOPLAY_STOPS.length; i++) {
      if (rawT >= AUTOPLAY_STOPS[i].tStart) current = AUTOPLAY_STOPS[i];
    }
    return current;
  }

  const _autoPos = new THREE.Vector3();
  const _autoLook = new THREE.Vector3();
  let lastAutoStopId = null;

  function applyAutoplayAt(rawT) {
    const clampedT = THREE.MathUtils.clamp(rawT, 0, 1);
    const u = mapTimeToU(clampedT);
    const tParam = autoplayPosCurve.getUtoTmapping(u);

    autoplayPosCurve.getPoint(tParam, _autoPos);
    autoplayLookCurve.getPoint(tParam, _autoLook);

    const dormFovBoost = 5.0 * Math.exp(-Math.pow((clampedT - 0.38) / 0.085, 2));
    const targetFov = THREE.MathUtils.lerp(48 + dormFovBoost, 44, smoothstepJS(0.86, 1.0, clampedT));
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    camera.position.copy(_autoPos);
    smoothLookAt.lerp(_autoLook, 0.18);
    camera.lookAt(smoothLookAt);

    // Open archway sakura veil smoothly before passing through central bay
    const doorProgress = THREE.MathUtils.clamp(clampedT / 0.14, 0, 1);
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
