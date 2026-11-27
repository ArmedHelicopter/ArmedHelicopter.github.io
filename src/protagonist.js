import * as THREE from 'three';

const ANCHORS = {
  archway: [0.4, 0.15, 22.4],
  sakura: [1.8, 2.24, 2.15],
  library: [1.4, 4.62, -6.8],
  lingbo: [15.4, 0.642, -7.8],
  overview: [0.4, 0.15, 22.4],
};

/**
 * Guardian-Tales-inspired 2D Spine multi-part articulated pixel-art chibi protagonist.
 * Features silver-white waist-length hair, powder sky-blue tracksuit (jacket & pants),
 * dark navy sneakers, idle bouncy breathing/follow-through + blinking, and lively run cycle.
 */
export function createProtagonist(textures) {
  const group = new THREE.Group();
  group.name = 'oursongs-protagonist';

  const parts = textures.protagonistParts();
  const slotMats = [];

  function createSlotMat(tex) {
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: new THREE.Color('#f4e8dc'),
      emissive: new THREE.Color('#1a1410'),
      emissiveMap: tex,
      emissiveIntensity: 0.0,
      roughness: 0.92,
      metalness: 0.0,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    mat.customProgramCacheKey = () => 'chibi_shadow_norm_v2';
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `
        #include <normal_fragment_begin>
        normal = normalize((viewMatrix * vec4(0.0, 0.88, 0.47, 0.0)).xyz);
        nonPerturbedNormal = normal;
        `
      );
    };
    slotMats.push(mat);
    return mat;
  }

  function makeSlot(name, w, h, px, py, pz, tex) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(px, py, 0);
    const mat = createSlotMat(tex);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.position.z = pz;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }

  const rigBillboard = new THREE.Group();
  group.add(rigBillboard);

  const rigFlip = new THREE.Group();
  rigBillboard.add(rigFlip);

  const PIXEL_UNIT = 0.0185; // ~1.48m tall total hero height

  // Back hair curtain anchored cleanly at neck/shoulder height ending at mid-thigh
  const backHairPivot = new THREE.Group();
  backHairPivot.position.set(0, 0.88, -0.022);
  const backHairMesh = makeSlot('backHair', 48 * PIXEL_UNIT, 52 * PIXEL_UNIT, 0, -0.22, 0, parts.backHair);
  backHairPivot.add(backHairMesh);
  rigFlip.add(backHairPivot);

  // Legs (hip pivot at y=0.45 -> soles cleanly touch y=0.02)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.105, 0.46, -0.008);
  leftLegPivot.add(makeSlot('leftLeg', 18 * PIXEL_UNIT, 26 * PIXEL_UNIT, 0, -0.22, 0, parts.leg));
  rigFlip.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.105, 0.46, 0.004);
  rightLegPivot.add(makeSlot('rightLeg', 18 * PIXEL_UNIT, 26 * PIXEL_UNIT, 0, -0.22, 0, parts.leg));
  rigFlip.add(rightLegPivot);

  // Fitted sky-blue zip track jacket torso (waist pivot y=0.44)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.44, 0.0);
  torsoPivot.add(makeSlot('torso', 28 * PIXEL_UNIT, 28 * PIXEL_UNIT, 0, 0.22, 0, parts.torso));
  rigFlip.add(torsoPivot);

  // Arms hanging naturally at her sides inside torso hierarchy
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.20, 0.36, -0.006);
  leftArmPivot.add(makeSlot('leftArm', 14 * PIXEL_UNIT, 24 * PIXEL_UNIT, -0.01, -0.19, 0, parts.arm));
  torsoPivot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.20, 0.36, 0.010);
  rightArmPivot.add(makeSlot('rightArm', 14 * PIXEL_UNIT, 24 * PIXEL_UNIT, 0.01, -0.19, 0, parts.arm));
  torsoPivot.add(rightArmPivot);

  // Chibi head with open & blink sprites
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.39, 0.016);
  const headMesh = makeSlot('head', 48 * PIXEL_UNIT, 44 * PIXEL_UNIT, 0, 0.29, 0, parts.headOpen);
  headPivot.add(headMesh);
  torsoPivot.add(headPivot);

  // Soft radial elliptical contact AO grounding sneakers onto stone/planks
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 48;
  aoCanvas.height = 48;
  const aoCtx = aoCanvas.getContext('2d');
  const aoGrad = aoCtx.createRadialGradient(24, 24, 2, 24, 24, 22);
  aoGrad.addColorStop(0.0, 'rgba(14, 20, 38, 0.68)');
  aoGrad.addColorStop(0.55, 'rgba(14, 20, 38, 0.34)');
  aoGrad.addColorStop(1.0, 'rgba(14, 20, 38, 0.0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 48, 48);
  const contactAoTex = new THREE.CanvasTexture(aoCanvas);
  const contactAoGeo = new THREE.PlaneGeometry(0.84, 0.50);
  contactAoGeo.rotateX(-Math.PI / 2);
  const contactAoMat = new THREE.MeshBasicMaterial({
    map: contactAoTex,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const contactAoMesh = new THREE.Mesh(contactAoGeo, contactAoMat);
  contactAoMesh.position.y = 0.020;
  group.add(contactAoMesh);

  // Unified directional silhouette shadow matching exact key-light ~2 o'clock cast direction
  const dirShadowGeo = new THREE.PlaneGeometry(0.68, 1.78);
  dirShadowGeo.rotateX(-Math.PI / 2);
  dirShadowGeo.translate(0, 0, 0.68);
  const dirShadowMat = new THREE.MeshBasicMaterial({
    map: textures.chibiShadowMap(),
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    toneMapped: false,
  });
  const dirShadowMesh = new THREE.Mesh(dirShadowGeo, dirShadowMat);
  dirShadowMesh.position.y = 0.025;
  dirShadowMesh.rotation.y = Math.atan2(9.5, -30);
  group.add(dirShadowMesh);

  const baseAnchorPos = new THREE.Vector3(...ANCHORS.archway);
  const targetPos = new THREE.Vector3(...ANCHORS.archway);
  group.position.copy(targetPos);

  let currentStopId = 'archway';
  let currentMoodName = 'amber';
  let walkPhase = 0;

  function refreshShadowState() {
    const isNight = currentMoodName === 'night' || currentMoodName === 'sunset' || currentMoodName === 'convergence';
    const inPorchShade = currentStopId === 'library';
    dirShadowMat.opacity = isNight ? 0.32 : inPorchShade ? 0.36 : 0.74;
    contactAoMat.opacity = isNight ? 0.62 : 0.68;
  }

  function setAnchor(stopId = 'archway', snap = false) {
    currentStopId = stopId || 'archway';
    const coords = ANCHORS[stopId] || ANCHORS.archway;
    baseAnchorPos.set(coords[0], coords[1], coords[2]);
    targetPos.copy(baseAnchorPos);
    if (snap || group.position.distanceTo(targetPos) > 10.0) {
      group.position.copy(targetPos);
    }
    refreshShadowState();
  }

  function setMood(mood) {
    currentMoodName = mood;
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    for (const mat of slotMats) {
      if (isNight) {
        mat.color.set('#dce4f4');
        mat.emissive.set('#3e5078');
        mat.emissiveIntensity = 0.22;
      } else {
        mat.color.set('#f4e8dc');
        mat.emissive.set('#1a1410');
        mat.emissiveIntensity = 0.0;
      }
    }
    if (isNight) {
      dirShadowMesh.rotation.y = Math.atan2(-26, -5);
      dirShadowMesh.scale.set(1.0, 1.0, 0.85);
    } else {
      dirShadowMesh.rotation.y = Math.atan2(9.5, -30);
      dirShadowMesh.scale.set(1.0, 1.0, 1.0);
    }
    refreshShadowState();
  }

  function applyPose({ walking, elapsed, speedFrac, facingX }) {
    rigFlip.scale.x = facingX < -0.02 ? -1 : 1;

    if (walking) {
      const s = Math.sin(walkPhase);
      const absS = Math.abs(s);
      const hop = absS * 0.068 * speedFrac;
      rigFlip.position.y = hop;
      rigFlip.rotation.z = -0.055 * speedFrac;

      leftLegPivot.rotation.z = s * 0.42 * speedFrac;
      rightLegPivot.rotation.z = -s * 0.42 * speedFrac;
      leftArmPivot.rotation.z = -s * 0.36 * speedFrac - 0.06;
      rightArmPivot.rotation.z = s * 0.36 * speedFrac + 0.06;

      torsoPivot.scale.set(1 + 0.02 * absS, 1 - 0.03 * absS, 1);
      headPivot.rotation.z = 0.045 * Math.cos(walkPhase);
      backHairPivot.rotation.z = -0.10 * speedFrac + Math.sin(walkPhase * 2) * 0.055;
      backHairPivot.position.y = 0.88 + hop * 0.45;
      headMesh.material.map = parts.headOpen;
      headMesh.material.emissiveMap = parts.headOpen;
      return;
    }

    // Guardian Tales bouncy idle breathing, secondary hair sway & calm eye blink
    const b = Math.sin(elapsed * 3.1);
    const bLag = Math.sin(elapsed * 3.1 - 0.65);
    rigFlip.position.y = 0;
    rigFlip.rotation.z = 0;
    leftLegPivot.rotation.z = 0;
    rightLegPivot.rotation.z = 0;

    torsoPivot.position.y = 0.44 + b * 0.016;
    torsoPivot.scale.set(1 - b * 0.018, 1 + b * 0.024, 1);
    leftArmPivot.rotation.z = -0.06 + bLag * 0.045;
    rightArmPivot.rotation.z = 0.06 - bLag * 0.045;
    headPivot.rotation.z = bLag * 0.024;
    backHairPivot.position.y = 0.88 + bLag * 0.014;
    backHairPivot.rotation.z = Math.sin(elapsed * 2.1 - 0.8) * 0.045;

    const blinkCycle = elapsed % 3.9;
    const isBlink = elapsed > 0.25 && blinkCycle > 3.74;
    const nextTex = isBlink ? parts.headBlink : parts.headOpen;
    if (headMesh.material.map !== nextTex) {
      headMesh.material.map = nextTex;
      headMesh.material.emissiveMap = nextTex;
    }
  }

  function update(dt, elapsed, camera) {
    if (camera) {
      const dx = camera.position.x - group.position.x;
      const dz = camera.position.z - group.position.z;
      rigBillboard.rotation.y = Math.atan2(dx, dz);
    }

    if (dt <= 0) {
      applyPose({ walking: false, elapsed: 0, speedFrac: 0, facingX: 1 });
      return;
    }

    // Gentle autonomous stroll within +/- 0.85m around the current campus stop in idle live viewing
    const strollSlot = Math.floor(elapsed / 8.0);
    const localTime = elapsed % 8.0;
    const activeTransition = group.position.distanceTo(baseAnchorPos) > 1.25;
    if (!activeTransition) {
      const patOffset = localTime < 5.5 ? ((strollSlot % 2) * 2 - 1) * 0.68 : 0;
      targetPos.set(baseAnchorPos.x + patOffset, baseAnchorPos.y, baseAnchorPos.z);
    }

    const dxMove = targetPos.x - group.position.x;
    const dist = group.position.distanceTo(targetPos);
    if (dist > 0.02) {
      const stepDist = Math.min(dist, dt * 2.4);
      const dir = targetPos.clone().sub(group.position).normalize();
      group.position.addScaledVector(dir, stepDist);
      walkPhase += dt * 11.5;
      applyPose({
        walking: true,
        elapsed,
        speedFrac: THREE.MathUtils.clamp(dist / 0.3, 0.35, 1.0),
        facingX: Math.abs(dxMove) > 0.01 ? dxMove : 1,
      });
    } else {
      group.position.copy(targetPos);
      applyPose({ walking: false, elapsed, speedFrac: 0, facingX: 1 });
    }
  }

  return {
    group,
    setAnchor,
    setMood,
    update,
  };
}
