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

  const PIXEL_UNIT = 0.035; // ~1.34m compact Guardian Tales chibi (~58% head-to-body ratio)

  // Lush silver back-hair bell curtain anchored behind shoulders (extends cleanly to ankle/knee level)
  const backHairPivot = new THREE.Group();
  backHairPivot.position.set(0, 0.74, -0.024);
  const backHairMesh = makeSlot('backHair', 30 * PIXEL_UNIT, 25 * PIXEL_UNIT, 0, -0.25, 0, parts.backHair);
  backHairPivot.add(backHairMesh);
  rigFlip.add(backHairPivot);

  // Stubby Guardian Tales legs + white-soled navy sneakers (soles land cleanly on y=0.02)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.10, 0.29, -0.008);
  leftLegPivot.add(makeSlot('leftLeg', 7 * PIXEL_UNIT, 9 * PIXEL_UNIT, 0, -0.125, 0, parts.leftLeg || parts.leg));
  rigFlip.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.10, 0.29, -0.004);
  rightLegPivot.add(makeSlot('rightLeg', 7 * PIXEL_UNIT, 9 * PIXEL_UNIT, 0, -0.125, 0, parts.rightLeg || parts.leg));
  rigFlip.add(rightLegPivot);

  // Compact white-zipped powder sky-blue tracksuit torso (waist pivot y=0.26)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.26, 0.004);
  torsoPivot.add(makeSlot('torso', 15 * PIXEL_UNIT, 11 * PIXEL_UNIT, 0, 0.17, 0, parts.torso));
  rigFlip.add(torsoPivot);

  // Outstretched A-pose stubby sleeves mounted at OUTER jacket shoulders (zero chest overlap!)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.20, 0.29, 0.008);
  leftArmPivot.add(makeSlot('leftArm', 9 * PIXEL_UNIT, 10 * PIXEL_UNIT, -0.09, -0.11, 0, parts.leftArm || parts.arm));
  torsoPivot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.20, 0.29, 0.010);
  rightArmPivot.add(makeSlot('rightArm', 9 * PIXEL_UNIT, 10 * PIXEL_UNIT, 0.09, -0.11, 0, parts.rightArm || parts.arm));
  torsoPivot.add(rightArmPivot);

  // Iconic plump-cheeked Guardian Tales head with sculpted halo hair + front chest hair locks
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.32, 0.018);
  const headMesh = makeSlot('head', 30 * PIXEL_UNIT, 26 * PIXEL_UNIT, 0, 0.32, 0, parts.headOpen);
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
  const dirShadowGeo = new THREE.PlaneGeometry(0.86, 1.58);
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

  function applyPose({ walking, elapsed, speedFrac, facingX }) {
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

    const snapPx = (v) => Math.round(v / 0.00875) * 0.00875;

    if (walking) {
      const s = Math.sin(walkPhase);
      const absS = Math.abs(s);
      // Alternating grounded foot-step cycle with crisp orthogonal X-stride & foot lift
      const stepL = Math.max(0, s) * 0.056 * speedFrac;
      const stepR = Math.max(0, -s) * 0.056 * speedFrac;
      leftLegPivot.position.set(-0.10 - s * 0.026 * speedFrac, 0.29 + snapPx(stepL), -0.008);
      rightLegPivot.position.set(0.10 + s * 0.026 * speedFrac, 0.29 + snapPx(stepR), -0.004);

      torsoPivot.position.y = 0.26 + snapPx(absS * 0.022 * speedFrac);
      torsoPivot.scale.set(1, 1, 1);
      headPivot.position.y = 0.32 + snapPx(absS * 0.026 * speedFrac);
      leftArmPivot.position.y = 0.29 - snapPx(s * 0.024 * speedFrac);
      rightArmPivot.position.y = 0.29 + snapPx(s * 0.024 * speedFrac);
      backHairPivot.position.y = 0.74 + snapPx(absS * 0.026 * speedFrac);
      backHairPivot.scale.set(1, 1, 1);
      headMesh.material.map = parts.headOpen;
      headMesh.material.emissiveMap = parts.headOpen;
      return;
    }

    // Crisp orthogonal Guardian Tales Spine breathing bounce & eye blink
    const b = Math.sin(elapsed * 3.4);
    const bLag = Math.sin(elapsed * 3.4 - 0.65);
    leftLegPivot.position.set(-0.10, 0.29, -0.008);
    rightLegPivot.position.set(0.10, 0.29, -0.004);

    torsoPivot.position.y = 0.26 + snapPx(b * 0.014);
    torsoPivot.scale.set(1, 1, 1);
    headPivot.position.y = 0.32 + snapPx(bLag * 0.018);
    leftArmPivot.position.y = 0.29 + snapPx(bLag * 0.014);
    rightArmPivot.position.y = 0.29 + snapPx(bLag * 0.014);
    backHairPivot.position.y = 0.74 + snapPx(bLag * 0.014);
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
