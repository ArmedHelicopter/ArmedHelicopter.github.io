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
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#202636'),
      emissiveMap: tex,
      emissiveIntensity: 0.12,
      roughness: 0.90,
      metalness: 0.0,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    mat.customProgramCacheKey = () => 'chibi_shadow_norm_v3';
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <normal_fragment_begin>',
          `
          #include <normal_fragment_begin>
          normal = normalize((viewMatrix * vec4(0.0, 0.88, 0.47, 0.0)).xyz);
          nonPerturbedNormal = normal;
          `
        )
        .replace(
          '#include <lights_fragment_end>',
          `
          #include <lights_fragment_end>
          float directLum = dot(reflectedLight.directDiffuse, vec3(0.299, 0.587, 0.114));
          reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, vec3(directLum), 0.72);
          float indirectLum = dot(reflectedLight.indirectDiffuse, vec3(0.299, 0.587, 0.114));
          reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vec3(indirectLum), 0.55);
          reflectedLight.indirectDiffuse = max(reflectedLight.indirectDiffuse, diffuseColor.rgb * 0.34);
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

  const PIXEL_UNIT = 0.030; // ~1.41m Guardian Tales chibi heroine (36x48 canvas)

  // Tapered teardrop silver back-hair behind shoulders & torso (no boxy vertical curtain)
  const backHairPivot = new THREE.Group();
  backHairPivot.position.set(0, 0.74, -0.028);
  const backHairMesh = makeSlot('backHair', 30 * PIXEL_UNIT, 32 * PIXEL_UNIT, 0, 0, 0, parts.backHair);
  backHairPivot.add(backHairMesh);
  rigFlip.add(backHairPivot);

  // Slender close-set Guardian Tales legs + navy white-soled sneakers (soles grounded on y=0.02)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.075, 0.35, -0.012);
  leftLegPivot.add(makeSlot('leftLeg', 5 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, -0.15, 0, parts.leftLeg || parts.leg));
  rigFlip.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.075, 0.35, -0.006);
  rightLegPivot.add(makeSlot('rightLeg', 5 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, -0.15, 0, parts.rightLeg || parts.leg));
  rigFlip.add(rightLegPivot);

  // Tapered powder sky-blue tracksuit jacket with crisp white vertical zipper (hip pivot y=0.35)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.35, 0.002);
  torsoPivot.add(makeSlot('torso', 14 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, 0.18, 0, parts.torso));
  rigFlip.add(torsoPivot);

  // Clean outer sleeves with white tracksuit stripe clearly silhouetted beside the waist
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.225, 0.31, 0.006);
  leftArmPivot.add(makeSlot('leftArm', 5 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, -0.16, 0, parts.leftArm || parts.arm));
  torsoPivot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.225, 0.31, 0.008);
  rightArmPivot.add(makeSlot('rightArm', 5 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, -0.16, 0, parts.rightArm || parts.arm));
  torsoPivot.add(rightArmPivot);

  // Delicate slender front hair locks draped over collarbones onto upper jacket (leaving arms & waist free)
  const frontLockLPivot = new THREE.Group();
  frontLockLPivot.position.set(-0.180, 0.45, 0.012);
  frontLockLPivot.add(makeSlot('frontLockL', 4 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, -0.18, 0, parts.frontLockL));
  torsoPivot.add(frontLockLPivot);

  const frontLockRPivot = new THREE.Group();
  frontLockRPivot.position.set(0.180, 0.45, 0.014);
  frontLockRPivot.add(makeSlot('frontLockR', 4 * PIXEL_UNIT, 12 * PIXEL_UNIT, 0, -0.18, 0, parts.frontLockR));
  torsoPivot.add(frontLockRPivot);

  // Feminine Guardian Tales chibi head: lashed jewel eyes, tapered oval chin, parted bangs & coral clip
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.36, 0.018);
  const headMesh = makeSlot('head', 32 * PIXEL_UNIT, 28 * PIXEL_UNIT, 0, 0.30, 0, parts.headOpen);
  headPivot.add(headMesh);
  torsoPivot.add(headPivot);

  // Soft radial elliptical contact AO matched to narrower feminine stance
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
  const contactAoGeo = new THREE.PlaneGeometry(0.56, 0.40);
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
  const dirShadowGeo = new THREE.PlaneGeometry(0.68, 1.48);
  dirShadowGeo.rotateX(-Math.PI / 2);
  dirShadowGeo.translate(0, 0, 0.62);
  const dirShadowMat = new THREE.MeshBasicMaterial({
    map: textures.chibiShadowMap(),
    transparent: true,
    opacity: 0.72,
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
  let poseOverride = null;

  function refreshShadowState() {
    const isNight = currentMoodName === 'night' || currentMoodName === 'sunset' || currentMoodName === 'convergence';
    const inPorchShade = currentStopId === 'library';
    dirShadowMat.opacity = isNight ? 0.32 : inPorchShade ? 0.36 : 0.72;
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
        mat.color.set('#cfdcf5');
        mat.emissive.set('#445888');
        mat.emissiveIntensity = 0.24;
      } else {
        mat.color.set('#ffffff');
        mat.emissive.set('#202636');
        mat.emissiveIntensity = 0.12;
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

  function applyPose({ walking, elapsed = 0, speedFrac = 1, facingX = 1, walkPhase: walkPhaseArg = walkPhase }) {
    rigFlip.scale.x = facingX < -0.02 ? -1 : 1;
    // Keep strictly orthogonal pixel alignment (zero rotation.z tilt) to prevent mixel aliasing
    rigFlip.position.y = 0;
    rigFlip.rotation.z = 0;
    torsoPivot.rotation.z = 0;
    headPivot.rotation.z = 0;
    backHairPivot.rotation.z = 0;
    leftLegPivot.rotation.z = 0;
    rightLegPivot.rotation.z = 0;
    leftArmPivot.rotation.z = 0;
    rightArmPivot.rotation.z = 0;

    const snapPx = (v) => Math.round(v / 0.0075) * 0.0075;

    if (walking) {
      const s = Math.sin(walkPhaseArg);
      const absS = Math.abs(s);
      // Unmistakable Guardian Tales bouncy foot-lift + horizontal leg stride + connected opposite arm swing
      const stepL = Math.max(0, s) * 0.060 * speedFrac;
      const stepR = Math.max(0, -s) * 0.060 * speedFrac;
      leftLegPivot.position.set(-0.075 - snapPx(s * 0.022 * speedFrac), 0.35 + snapPx(stepL), -0.012);
      rightLegPivot.position.set(0.075 + snapPx(s * 0.022 * speedFrac), 0.35 + snapPx(stepR), -0.006);

      torsoPivot.position.y = 0.35 + snapPx(absS * 0.030 * speedFrac);
      torsoPivot.scale.set(1, 1, 1);
      headPivot.position.y = 0.36 + snapPx(absS * 0.030 * speedFrac);
      leftArmPivot.position.set(-0.225 - snapPx(s * 0.015 * speedFrac), 0.31 + snapPx(s * 0.045 * speedFrac), 0.006);
      rightArmPivot.position.set(0.225 + snapPx(s * 0.015 * speedFrac), 0.31 - snapPx(s * 0.045 * speedFrac), 0.008);
      frontLockLPivot.position.set(-0.180 - snapPx(s * 0.015 * speedFrac), 0.45 + snapPx(absS * 0.022 * speedFrac), 0.012);
      frontLockRPivot.position.set(0.180 - snapPx(s * 0.015 * speedFrac), 0.45 + snapPx(absS * 0.022 * speedFrac), 0.014);
      backHairPivot.position.y = 0.74 + snapPx(absS * 0.030 * speedFrac);
      backHairPivot.scale.set(1, 1, 1);
      headMesh.material.map = parts.headOpen;
      headMesh.material.emissiveMap = parts.headOpen;
      return;
    }

    // Crisp orthogonal Guardian Tales Spine breathing bounce, front hair sway & eye blink
    const b = Math.sin(elapsed * 2.6);
    const bLag = Math.sin(elapsed * 2.6 - 0.65);
    const swayL = Math.sin(elapsed * 1.4);
    const swayR = Math.sin(elapsed * 1.4 - 0.8);
    leftLegPivot.position.set(-0.075, 0.35, -0.012);
    rightLegPivot.position.set(0.075, 0.35, -0.006);

    torsoPivot.position.y = 0.35 + snapPx(b * 0.015);
    torsoPivot.scale.set(1, 1, 1);
    headPivot.position.y = 0.36 + snapPx(bLag * 0.018);
    leftArmPivot.position.set(-0.225, 0.31 + snapPx(bLag * 0.015), 0.006);
    rightArmPivot.position.set(0.225, 0.31 + snapPx(bLag * 0.015), 0.008);
    frontLockLPivot.position.set(-0.180 + snapPx(swayL * 0.0075), 0.45 + snapPx(bLag * 0.015), 0.012);
    frontLockRPivot.position.set(0.180 + snapPx(swayR * 0.0075), 0.45 + snapPx(bLag * 0.015), 0.014);
    backHairPivot.position.y = 0.74 + snapPx(bLag * 0.015);
    backHairPivot.scale.set(1, 1, 1);

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

    if (poseOverride) {
      applyPose(poseOverride);
      return;
    }

    if (dt <= 0) {
      applyPose({ walking: false, elapsed: 0, speedFrac: 0, facingX: 1 });
      return;
    }

    // Calm pause at anchor (0..2.2s) before gentle autonomous patrol around the current stop
    const strollSlot = Math.floor(elapsed / 8.0);
    const localTime = elapsed % 8.0;
    const activeTransition = group.position.distanceTo(baseAnchorPos) > 1.25;
    if (!activeTransition) {
      const patOffset = localTime > 2.2 && localTime < 6.0 ? (strollSlot % 2 === 0 ? 0.68 : -0.68) : 0;
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
    setPoseOverride: (pose) => {
      poseOverride = pose || null;
      if (poseOverride) applyPose(poseOverride);
    },
    update,
  };
}
