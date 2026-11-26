import * as THREE from 'three';
import { mergeSafe, xform, lockStatic, roofGroup, fitBoxFacadeUVs } from './geo.js';

function buildArchedGateTower(w, h, d, archR, archH) {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  shape.moveTo(-hw, 0);
  shape.lineTo(-archR, 0);
  shape.lineTo(-archR, archH - archR);
  shape.absarc(0, archH - archR, archR, Math.PI, 0, true);
  shape.lineTo(archR, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, h);
  shape.lineTo(-hw, h);
  shape.closePath();

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 18,
  });
  g.translate(0, 0, -d * 0.5);
  return g;
}

/**
 * Independent component: Old Dormitory (老斋舍) with 4 stone wings,
 * 3 Roman arched gates with matching framed entrance doors, 3 curved peacock-blue pavilions,
 * 108-step staircase (百步梯) with solid masonry spandrel walls & newel pillars,
 * and Tier 2 south courtyard portal.
 */
export function createDormitoryComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-old-dormitory';

  const graniteGeos = [];
  const warmStoneGeos = [];

  const dormGroup = new THREE.Group();
  dormGroup.position.set(0, 2.15, -0.8);
  group.add(dormGroup);

  const wingXPositions = [-6.6, -2.35, 2.35, 6.6];
  wingXPositions.forEach((wx, idx) => {
    const wLen = idx === 0 || idx === 3 ? 3.5 : 3.2;
    const wingGeo = fitBoxFacadeUVs(new THREE.BoxGeometry(wLen, 2.55, 2.5), wLen, 2.55, 2.5, 3.5);
    const wing = new THREE.Mesh(wingGeo, palette.dormWallMat);
    wing.position.set(wx, 1.28, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
    dormGroup.add(wing);

    for (const pxOff of [-wLen * 0.44, 0, wLen * 0.44]) {
      for (const sz of [-1, 1]) {
        const dPil = new THREE.BoxGeometry(0.18, 2.58, 0.20);
        xform(dPil, [wx + pxOff, 2.15 + 1.29, -0.8 + sz * 1.22]);
        warmStoneGeos.push(dPil);
      }
    }
    for (const bandY of [0.88, 1.74]) {
      const band = new THREE.BoxGeometry(wLen + 0.14, 0.09, 2.64);
      xform(band, [wx, 2.15 + bandY, -0.8]);
      graniteGeos.push(band);
    }
    const eaveCornice = new THREE.BoxGeometry(wLen + 0.22, 0.12, 2.76);
    xform(eaveCornice, [wx, 2.15 + 2.52, -0.8]);
    graniteGeos.push(eaveCornice);

    const slab = new THREE.BoxGeometry(wLen + 0.16, 0.18, 2.72);
    xform(slab, [wx, 2.15 + 2.6, -0.8]);
    warmStoneGeos.push(slab);

    for (const sz of [-1, 1]) {
      const rail = new THREE.BoxGeometry(wLen + 0.12, 0.34, 0.12);
      xform(rail, [wx, 2.15 + 2.82, -0.8 + sz * 1.26]);
      graniteGeos.push(rail);
    }

    const roofSkylight = new THREE.BoxGeometry(wLen * 0.56, 0.16, 1.05);
    xform(roofSkylight, [wx, 2.15 + 2.74, -0.8]);
    warmStoneGeos.push(roofSkylight);
    const skylightCap = new THREE.BoxGeometry(wLen * 0.60, 0.07, 1.14);
    xform(skylightCap, [wx, 2.15 + 2.84, -0.8]);
    graniteGeos.push(skylightCap);
  });

  const gateOffsets = [-4.55, 0, 4.55];
  gateOffsets.forEach((gx) => {
    const worldX = gx;
    const worldY = 2.15;
    const worldZ = -0.8;

    const towerGeo = buildArchedGateTower(1.65, 2.85, 2.95, 0.48, 1.9);
    xform(towerGeo, [worldX, worldY, worldZ]);
    warmStoneGeos.push(towerGeo);

    // Unmistakable framed white-trim glass double entrance doors recessed shallowly at mouth of ALL 3 Roman arches
    const doorPortalZ = worldZ + 1.18;
    const doorSurround = new THREE.BoxGeometry(1.04, 1.82, 0.14);
    xform(doorSurround, [worldX, worldY + 0.91, doorPortalZ - 0.04]);
    graniteGeos.push(doorSurround);

    const doorFrameWhite = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.66, 0.06), palette.warmStoneMat);
    doorFrameWhite.position.set(worldX, worldY + 0.84, doorPortalZ + 0.03);
    group.add(doorFrameWhite);

    const doorGlass = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(0.76, 1.48, 0.08), 0.76, 1.48, 0.08, 2.2),
      palette.libWallMat
    );
    doorGlass.position.set(worldX, worldY + 0.80, doorPortalZ + 0.05);
    group.add(doorGlass);

    const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.62, 0.10), palette.warmStoneMat);
    centerMullion.position.set(worldX, worldY + 0.84, doorPortalZ + 0.055);
    group.add(centerMullion);

    const transomBar = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.07, 0.10), palette.warmStoneMat);
    transomBar.position.set(worldX, worldY + 1.32, doorPortalZ + 0.055);
    group.add(transomBar);

    const cornice = new THREE.BoxGeometry(1.82, 0.18, 3.12);
    xform(cornice, [worldX, worldY + 2.88, worldZ]);
    graniteGeos.push(cornice);

    const pavY = worldY + 2.96;
    for (const px of [-0.62, 0.62]) {
      for (const pz of [-0.88, 0.88]) {
        const plinth = new THREE.BoxGeometry(0.34, 0.12, 0.34);
        xform(plinth, [worldX + px, pavY + 0.07, worldZ + pz]);
        graniteGeos.push(plinth);

        const drum = new THREE.CylinderGeometry(0.14, 0.18, 0.14, 10);
        xform(drum, [worldX + px, pavY + 0.19, worldZ + pz]);
        graniteGeos.push(drum);

        const col = new THREE.CylinderGeometry(0.075, 0.08, 0.80, 10);
        col.translate(worldX + px, pavY + 0.65, worldZ + pz);
        const colMesh = new THREE.Mesh(col, palette.crimsonColumnMat);
        colMesh.castShadow = true;
        group.add(colMesh);
      }
    }

    const pavLantern = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.24), palette.lampGlowMat);
    pavLantern.position.set(worldX, pavY + 0.94, worldZ);
    group.add(pavLantern);

    const pavRoof = roofGroup(
      {
        halfW: 1.18,
        halfD: 1.32,
        H: 0.88,
        mode: 'xieshan',
        inset: 0.52,
        lift: 0.22,
        segU: 16,
        segV: 10,
        soffitInward: 0.52,
        rafters: true,
      },
      palette.roofMats
    );
    pavRoof.position.set(worldX, pavY + 0.98, worldZ);
    group.add(pavRoof);
  });

  // Grand 108-Step Staircase (百步梯) with projecting granite nosings & shaded dark stone risers
  const darkRiserGeos = [];
  const stepCount = 34;
  for (let i = 0; i < stepCount; i++) {
    const t = i / (stepCount - 1);
    const sy = 0.12 + t * 2.02;
    const sz = 8.15 - t * 3.85;
    const step = new THREE.BoxGeometry(2.60, 0.065, 0.17);
    xform(step, [0, sy, sz + 0.015]);
    graniteGeos.push(step);
    const riser = new THREE.BoxGeometry(2.58, 0.068, 0.055);
    xform(riser, [0, sy - 0.04, sz + 0.075]);
    darkRiserGeos.push(riser);
  }
  const risersMesh = new THREE.Mesh(mergeSafe(darkRiserGeos), palette.darkTimberMat);
  risersMesh.receiveShadow = true;
  group.add(risersMesh);

  const spandrelShape = new THREE.Shape();
  spandrelShape.moveTo(-1.95, -1.24);
  spandrelShape.lineTo(1.95, -1.24);
  spandrelShape.lineTo(-1.95, 0.88);
  spandrelShape.closePath();

  for (const sx of [-1.36, 1.36]) {
    const ramp = new THREE.BoxGeometry(0.22, 0.42, 4.24);
    xform(ramp, [sx, 1.24, 6.22], [0.48, 0, 0]);
    graniteGeos.push(ramp);

    const spandrelGeo = new THREE.ExtrudeGeometry(spandrelShape, { depth: 0.18, bevelEnabled: false });
    spandrelGeo.rotateY(-Math.PI / 2);
    xform(spandrelGeo, [sx + 0.09, 1.24, 6.22]);
    warmStoneGeos.push(spandrelGeo);

    // Flush stair-head & foot granite newel plinths grounding diagonal cheek walls cleanly
    const stairNewel = new THREE.BoxGeometry(0.32, 0.56, 0.32);
    xform(stairNewel, [Math.sign(sx) * 1.44, 2.26, 4.30]);
    graniteGeos.push(stairNewel);
    const newelCap = new THREE.BoxGeometry(0.38, 0.10, 0.38);
    xform(newelCap, [Math.sign(sx) * 1.44, 2.57, 4.30]);
    graniteGeos.push(newelCap);

    const footPlinth = new THREE.BoxGeometry(0.30, 0.36, 0.38);
    xform(footPlinth, [sx, 0.22, 8.20]);
    graniteGeos.push(footPlinth);
    const footCap = new THREE.BoxGeometry(0.34, 0.08, 0.42);
    xform(footCap, [sx, 0.42, 8.20]);
    graniteGeos.push(footCap);
  }

  // Solid ashlar stone causeway pier supporting the central terrace bridge solidly down to Tier 1 earth
  const terraceWalk = new THREE.BoxGeometry(2.6, 0.14, 8.75);
  xform(terraceWalk, [0, 2.15, 0.02]);
  graniteGeos.push(terraceWalk);
  const terracePierBase = new THREE.BoxGeometry(2.38, 0.48, 8.60);
  xform(terracePierBase, [0, 1.90, 0.02]);
  warmStoneGeos.push(terracePierBase);

  // Symmetrical Dormitory facade forecourt apron framing 2 clean granite-curbed turf parterres
  const frontApron = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.06, 0.94), palette.plazaMat);
  frontApron.position.set(0, 2.065, 0.86);
  frontApron.receiveShadow = true;
  group.add(frontApron);
  const frontApronFoundation = new THREE.BoxGeometry(11.36, 0.38, 0.92);
  xform(frontApronFoundation, [0, 1.88, 0.86]);
  warmStoneGeos.push(frontApronFoundation);
  const apronCurbS = new THREE.BoxGeometry(11.4, 0.09, 0.12);
  xform(apronCurbS, [0, 2.075, 1.32]);
  graniteGeos.push(apronCurbS);

  // Flush dressed granite flagstone promenade & solid masonry bed connecting Left & Right Roman arches cleanly into lawn
  const crossPromenade = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.06, 1.38), palette.plazaMat);
  crossPromenade.position.set(0, 2.065, 2.55);
  crossPromenade.receiveShadow = true;
  group.add(crossPromenade);
  const crossFoundation = new THREE.BoxGeometry(11.36, 0.38, 1.36);
  xform(crossFoundation, [0, 1.88, 2.55]);
  warmStoneGeos.push(crossFoundation);
  const crossCurbS = new THREE.BoxGeometry(11.4, 0.09, 0.14);
  xform(crossCurbS, [0, 2.07, 3.24]);
  graniteGeos.push(crossCurbS);
  const crossCurbN = new THREE.BoxGeometry(11.4, 0.09, 0.14);
  xform(crossCurbN, [0, 2.07, 1.86]);
  graniteGeos.push(crossCurbN);

  for (const gx of [-4.55, 4.55]) {
    const spurWalk = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 2.15), palette.plazaMat);
    spurWalk.position.set(gx, 2.065, 1.48);
    spurWalk.receiveShadow = true;
    group.add(spurWalk);
    const spurFoundation = new THREE.BoxGeometry(1.40, 0.38, 2.12);
    xform(spurFoundation, [gx, 1.88, 1.48]);
    warmStoneGeos.push(spurFoundation);

    const thresholdStep = new THREE.BoxGeometry(1.56, 0.11, 0.42);
    xform(thresholdStep, [gx, 2.09, 0.72]);
    graniteGeos.push(thresholdStep);

    for (const sx of [-0.75, 0.75]) {
      const curb = new THREE.BoxGeometry(0.12, 0.09, 2.15);
      xform(curb, [gx + sx, 2.07, 1.48]);
      graniteGeos.push(curb);
    }
  }

  // Tier 2 South Courtyard recessed blind-arch stone portal + stepped granite landing & court path
  const courtyardPortal = buildArchedGateTower(1.85, 2.45, 0.28, 0.56, 1.85);
  xform(courtyardPortal, [0, 2.15, -4.30]);
  warmStoneGeos.push(courtyardPortal);
  const courtyardCornice = new THREE.BoxGeometry(2.04, 0.18, 0.42);
  xform(courtyardCornice, [0, 4.64, -4.30]);
  graniteGeos.push(courtyardCornice);
  const portalStep1 = new THREE.BoxGeometry(2.38, 0.14, 0.92);
  xform(portalStep1, [0, 2.13, -4.00]);
  graniteGeos.push(portalStep1);
  const portalStep2 = new THREE.BoxGeometry(1.98, 0.14, 0.54);
  xform(portalStep2, [0, 2.22, -4.18]);
  graniteGeos.push(portalStep2);
  const courtyardDoor = new THREE.Mesh(new THREE.BoxGeometry(1.20, 1.92, 0.14), palette.darkTimberMat);
  courtyardDoor.position.set(0, 3.12, -4.36);
  courtyardDoor.castShadow = true;
  courtyardDoor.receiveShadow = true;
  group.add(courtyardDoor);
  const courtyardPatio = new THREE.Mesh(new THREE.BoxGeometry(3.40, 0.07, 3.10), palette.plazaMat);
  courtyardPatio.position.set(0, 2.082, -2.92);
  courtyardPatio.receiveShadow = true;
  group.add(courtyardPatio);
  // Lateral dressed stone garden path linking courtyard portal & rear lawn cleanly across Tier 1
  const rearGardenWalk = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.07, 1.32), palette.plazaMat);
  rearGardenWalk.position.set(0, 2.078, -3.22);
  rearGardenWalk.receiveShadow = true;
  group.add(rearGardenWalk);
  for (const sz of [-3.88, -2.56]) {
    const rCurb = new THREE.BoxGeometry(15.6, 0.09, 0.12);
    xform(rCurb, [0, 2.085, sz]);
    graniteGeos.push(rCurb);
  }
  for (const sx of [-1.72, 1.72]) {
    const pCurb = new THREE.BoxGeometry(0.12, 0.09, 3.10);
    xform(pCurb, [sx, 2.09, -2.92]);
    graniteGeos.push(pCurb);
  }
  for (const sx of [-1.25, 1.25]) {
    const cPlanter = new THREE.BoxGeometry(0.68, 0.28, 0.68);
    xform(cPlanter, [sx, 2.29, -3.85]);
    graniteGeos.push(cPlanter);
  }

  const dormGraniteMesh = new THREE.Mesh(mergeSafe(graniteGeos), palette.graniteMat);
  dormGraniteMesh.castShadow = true;
  dormGraniteMesh.receiveShadow = true;
  group.add(dormGraniteMesh);

  const dormWarmStoneMesh = new THREE.Mesh(mergeSafe(warmStoneGeos), palette.warmStoneMat);
  dormWarmStoneMesh.castShadow = true;
  dormWarmStoneMesh.receiveShadow = true;
  group.add(dormWarmStoneMesh);

  lockStatic(group);

  return {
    group,
    setMood() {},
  };
}
