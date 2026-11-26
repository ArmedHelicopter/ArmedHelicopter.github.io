import * as THREE from 'three';

const ANCHORS = {
  archway: [1.5, 0.14, 20.6],
  sakura: [1.8, 0.15, 6.2],
  library: [4.2, 4.64, -3.6],
  lingbo: [14.6, 0.66, -7.8],
  overview: [1.5, 0.14, 20.6],
};

/**
 * Hard-edged 2.5D pixel-art chibi protagonist standing inside the 3D WHU diorama.
 * Casts a real directional sunlight shadow plus a subtle ground contact shadow.
 */
export function createProtagonist(textures) {
  const group = new THREE.Group();
  group.name = 'oursongs-protagonist';

  const frame0 = textures.protagonistFrame(0);
  const frame1 = textures.protagonistFrame(1);

  const spriteGeo = new THREE.PlaneGeometry(1.15, 1.53);
  spriteGeo.translate(0, 0.765, 0);

  const spriteMat = new THREE.MeshLambertMaterial({
    map: frame0,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: frame0,
    emissiveIntensity: 0.14,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: frame0,
    alphaTest: 0.5,
  });

  const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
  spriteMesh.castShadow = true;
  spriteMesh.receiveShadow = false;
  spriteMesh.customDepthMaterial = depthMat;
  group.add(spriteMesh);

  // Soft ground contact-shadow disc beneath sneakers
  const contactGeo = new THREE.CircleGeometry(0.42, 16);
  contactGeo.rotateX(-Math.PI / 2);
  const contactMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#141d30'),
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const contactDisc = new THREE.Mesh(contactGeo, contactMat);
  contactDisc.position.y = 0.015;
  group.add(contactDisc);

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
  beacon.position.set(0.06, 0.65, 0.02);
  spriteMesh.add(beacon);

  const targetPos = new THREE.Vector3(...ANCHORS.archway);
  group.position.copy(targetPos);

  let currentFrame = 0;

  function setAnchor(stopId = 'archway', snap = false) {
    const coords = ANCHORS[stopId] || ANCHORS.archway;
    targetPos.set(coords[0], coords[1], coords[2]);
    if (snap || group.position.distanceTo(targetPos) > 10.0) {
      group.position.copy(targetPos);
    }
  }

  function setMood(mood) {
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    spriteMat.emissiveIntensity = isNight ? 0.42 : 0.14;
    contactMat.opacity = isNight ? 0.42 : 0.34;
    beaconMat.opacity = isNight ? 1.0 : 0.82;
  }

  function update(dt, elapsed, camera) {
    if (group.position.distanceToSquared(targetPos) > 0.0004) {
      const alpha = Math.min(1, dt * 6.0);
      group.position.lerp(targetPos, alpha);
    }

    // Cylindrical Y-axis billboard facing camera upright without leaning back
    if (camera) {
      const dx = camera.position.x - group.position.x;
      const dz = camera.position.z - group.position.z;
      spriteMesh.rotation.y = Math.atan2(dx, dz);
    }

    // Gentle idle pixel step & hair sway (~2.6 Hz) + subtle breathing bob
    const nextFrame = Math.floor(elapsed * 2.6) % 2;
    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      const tex = currentFrame === 0 ? frame0 : frame1;
      spriteMat.map = tex;
      spriteMat.emissiveMap = tex;
      depthMat.map = tex;
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
