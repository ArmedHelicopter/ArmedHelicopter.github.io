import * as THREE from 'three';
import { mergeSafe, xform } from './geo.js';

const ANCHORS = {
  archway: [0.4, 0.15, 22.4],
  sakura: [1.8, 2.24, 2.15],
  library: [3.4, 5.11, -5.95],
  lingbo: [15.4, 0.642, -7.8],
  overview: [0.4, 0.15, 22.4],
};

/**
 * Hard-edged 2.5D pixel-art chibi protagonist standing inside the 3D WHU diorama.
 * Includes a soft contact disc AND a pure-geometry directional human-silhouette ground shadow
 * aligned to the active East sun/moon key light vector.
 */
export function createProtagonist(textures) {
  const group = new THREE.Group();
  group.name = 'oursongs-protagonist';

  const frame0 = textures.protagonistFrame(0);
  const frame1 = textures.protagonistFrame(1);

  const spriteGeo = new THREE.PlaneGeometry(1.18, 1.48);
  spriteGeo.translate(0, 0.74, 0);

  const spriteMat = new THREE.MeshStandardMaterial({
    map: frame0,
    color: new THREE.Color('#f6e8d8'),
    emissive: new THREE.Color('#2a1e16'),
    emissiveMap: frame0,
    emissiveIntensity: 0.03,
    roughness: 0.92,
    metalness: 0.0,
    alphaTest: 0.48,
    side: THREE.DoubleSide,
  });
  spriteMat.customProgramCacheKey = () => 'chibi_shadow_norm_v2';
  spriteMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `
      #include <normal_fragment_begin>
      normal = normalize((viewMatrix * vec4(0.0, 0.88, 0.47, 0.0)).xyz);
      nonPerturbedNormal = normal;
      `
    );
  };

  const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
  spriteMesh.castShadow = false;
  spriteMesh.receiveShadow = true;
  group.add(spriteMesh);

  // Soft radial elliptical contact AO grounding sneakers directly onto stone/planks
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

  // Unified single-piece soft-feathered directional shadow silhouette anchored smoothly at her sneakers
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
  // Exact keyLight vector (-12 - 2, 28, 30 - 1) -> shadowDir (+14, -29) matching lamps & pillars
  dirShadowMesh.rotation.y = Math.atan2(14, -29);
  group.add(dirShadowMesh);

  // Subtle #ff3b3b red lens indicator glow aligned at camera chest height
  const beaconGeo = new THREE.PlaneGeometry(0.06, 0.06);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff3b3b'),
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0.08, 0.62, 0.02);
  spriteMesh.add(beacon);

  const targetPos = new THREE.Vector3(...ANCHORS.archway);
  group.position.copy(targetPos);

  let currentFrame = 0;
  let currentStopId = 'archway';
  let currentMoodName = 'amber';

  function refreshShadowState() {
    const isNight = currentMoodName === 'night' || currentMoodName === 'sunset' || currentMoodName === 'convergence';
    const inPorchShade = currentStopId === 'library';
    dirShadowMat.opacity = isNight ? 0.32 : inPorchShade ? 0.16 : 0.74;
    contactAoMat.opacity = isNight ? 0.62 : 0.68;
  }

  function setAnchor(stopId = 'archway', snap = false) {
    currentStopId = stopId || 'archway';
    const coords = ANCHORS[stopId] || ANCHORS.archway;
    targetPos.set(coords[0], coords[1], coords[2]);
    if (snap || group.position.distanceTo(targetPos) > 10.0) {
      group.position.copy(targetPos);
    }
    refreshShadowState();
  }

  function setMood(mood) {
    currentMoodName = mood;
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    if (isNight) {
      spriteMat.color.set('#bcc6dc');
      spriteMat.emissive.set('#222c46');
      spriteMat.emissiveIntensity = 0.08;
      dirShadowMesh.rotation.y = Math.atan2(-26, -5);
      dirShadowMesh.scale.set(1.0, 1.0, 0.85);
      beaconMat.opacity = 1.0;
    } else {
      spriteMat.color.set('#e8d5c2');
      spriteMat.emissive.set('#1a1410');
      spriteMat.emissiveIntensity = 0.0;
      dirShadowMesh.rotation.y = Math.atan2(14, -29);
      dirShadowMesh.scale.set(1.0, 1.0, 1.0);
      beaconMat.opacity = 0.85;
    }
    refreshShadowState();
  }

  function update(dt, elapsed, camera) {
    if (group.position.distanceToSquared(targetPos) > 0.0004) {
      const alpha = Math.min(1, dt * 6.0);
      group.position.lerp(targetPos, alpha);
    }

    if (camera) {
      const dx = camera.position.x - group.position.x;
      const dz = camera.position.z - group.position.z;
      spriteMesh.rotation.y = Math.atan2(dx, dz);
    }

    const nextFrame = Math.floor(elapsed * 2.6) % 2;
    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      const tex = currentFrame === 0 ? frame0 : frame1;
      spriteMat.map = tex;
      spriteMat.emissiveMap = tex;
    }
    spriteMesh.position.y = Math.sin(elapsed * 2.6) * 0.018;
    beacon.visible = (Math.floor(elapsed * 1.8) % 5) !== 0;
  }

  return {
    group,
    setAnchor,
    setMood,
    update,
  };
}
