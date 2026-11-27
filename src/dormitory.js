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
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 20,
  });
  g.translate(0, 0, -d * 0.5);
  return g;
}

function buildVaultSoffit(archR, archH, depth) {
  // Semi-cylindrical interior tunnel soffit shell (inner surface dark-shaded granite)
  const g = new THREE.CylinderGeometry(archR * 0.99, archR * 0.99, depth, 16, 1, true, 0, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.rotateY(Math.PI / 2);
  g.translate(0, archH - archR, 0);
  return g;
}

/**
 * Independent component: Old Dormitory (老斋舍) with:
 * - 4 courtyard wings featuring open skywells (天井) & sloped turquoise front glazed eaves
 * - 3 completely OPEN Roman vaulted through-archways (zero blocked doors!)
 * - Continuous 108-step staircase (百步梯) rising cleanly through the central arch straight up to 樱顶
 * - 3 enclosed cream-stone rooftop pavilion halls (千字文/学生会亭) with crimson windows & circular oculus gables
 */
export function createDormitoryComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-old-dormitory';

  const graniteGeos = [];
  const warmStoneGeos = [];
  const darkVaultGeos = [];

  const dormGroup = new THREE.Group();
  dormGroup.position.set(0, 2.15, -0.8);
  group.add(dormGroup);

  const wingXPositions = [-6.65, -2.30, 2.30, 6.65];
  wingXPositions.forEach((wx, idx) => {
    const wLen = idx === 0 || idx === 3 ? 3.5 : 3.2;

    // Front & rear wing bars enclosing an authentic sunken open 天井 courtyard well
    const frontBarGeo = fitBoxFacadeUVs(new THREE.BoxGeometry(wLen, 2.55, 0.88), wLen, 2.55, 0.88, 3.5);
    const frontBar = new THREE.Mesh(frontBarGeo, palette.dormWallMat);
    frontBar.position.set(wx, 1.28, 0.82);
    frontBar.castShadow = true;
    frontBar.receiveShadow = true;
    dormGroup.add(frontBar);

    const rearBarGeo = fitBoxFacadeUVs(new THREE.BoxGeometry(wLen, 2.55, 0.72), wLen, 2.55, 0.72, 3.5);
    const rearBar = new THREE.Mesh(rearBarGeo, palette.dormWallMat);
    rearBar.position.set(wx, 1.28, -0.88);
    rearBar.castShadow = true;
    rearBar.receiveShadow = true;
    dormGroup.add(rearBar);

    for (const sx of [-1, 1]) {
      const endWall = new THREE.BoxGeometry(0.44, 2.56, 2.48);
      xform(endWall, [wx + sx * (wLen * 0.5 - 0.22), 2.15 + 1.28, -0.8]);
      warmStoneGeos.push(endWall);
    }

    // Recessed courtyard deck at mid-height
    const skywellFloor = new THREE.BoxGeometry(wLen - 0.75, 0.14, 1.0);
    xform(skywellFloor, [wx, 2.15 + 1.78, -0.8 + 0.02]);
    graniteGeos.push(skywellFloor);

    // Facade pilasters, stringcourses & rooftop parapet balustrade rails
    for (const pxOff of [-wLen * 0.44, 0, wLen * 0.44]) {
      for (const sz of [-1, 1]) {
        const dPil = new THREE.BoxGeometry(0.18, 2.58, 0.18);
        xform(dPil, [wx + pxOff, 2.15 + 1.29, -0.8 + sz * 1.22]);
        warmStoneGeos.push(dPil);
      }
    }
    for (const bandY of [0.88, 1.74]) {
      const band = new THREE.BoxGeometry(wLen + 0.14, 0.09, 2.62);
      xform(band, [wx, 2.15 + bandY, -0.8]);
      graniteGeos.push(band);
    }
    const eaveCornice = new THREE.BoxGeometry(wLen + 0.22, 0.12, 2.74);
    xform(eaveCornice, [wx, 2.15 + 2.52, -0.8]);
    graniteGeos.push(eaveCornice);

    // Signature sloped peacock-turquoise glazed tile front wing eaves (02054597.jpg)
    const wingGlazeEave = new THREE.Mesh(
      new THREE.BoxGeometry(wLen + 0.16, 0.09, 0.42),
      palette.glazedTileMat
    );
    wingGlazeEave.position.set(wx, 1.98, 1.26);
    wingGlazeEave.rotation.x = 0.36;
    wingGlazeEave.castShadow = true;
    dormGroup.add(wingGlazeEave);

    const rearGlazeEave = new THREE.Mesh(
      new THREE.BoxGeometry(wLen + 0.16, 0.09, 0.38),
      palette.glazedTileMat
    );
    rearGlazeEave.position.set(wx, 1.98, -1.24);
    rearGlazeEave.rotation.x = -0.36;
    dormGroup.add(rearGlazeEave);

    for (const sz of [-1, 1]) {
      const rail = new THREE.BoxGeometry(wLen + 0.12, 0.30, 0.12);
      xform(rail, [wx, 2.15 + 2.74, -0.8 + sz * 1.25]);
      graniteGeos.push(rail);
    }
  });

  // Outer wing end stone piers closing the east and west flanks cleanly with matching facade glazing
  for (const sx of [-1, 1]) {
    const flankWall = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(0.46, 2.55, 2.56), 0.46, 2.55, 2.56, 3.2),
      palette.dormWallMat
    );
    flankWall.position.set(sx * 8.42, 2.15 + 1.28, -0.8);
    flankWall.castShadow = true;
    flankWall.receiveShadow = true;
    group.add(flankWall);
    const flankCoping = new THREE.BoxGeometry(0.54, 0.14, 2.74);
    xform(flankCoping, [sx * 8.42, 2.15 + 2.58, -0.8]);
    graniteGeos.push(flankCoping);
  }

  // Three completely OPEN Roman vaulted through-archways + ascending stairs + enclosed rooftop pavilion halls
  const gateOffsets = [-4.55, 0, 4.55];
  gateOffsets.forEach((gx) => {
    const worldX = gx;
    const worldY = 2.15;
    const worldZ = -0.8;
    const archR = 0.58;
    const archH = 2.12;
    const gateDepth = 3.04;

    const towerGeo = buildArchedGateTower(1.80, 2.94, gateDepth, archR, archH);
    xform(towerGeo, [worldX, worldY, worldZ]);
    warmStoneGeos.push(towerGeo);

    // Projecting granite archivolt rings & keystones on both front & back arch portals (tunnel left completely OPEN!)
    for (const faceZ of [worldZ + gateDepth * 0.5 + 0.02, worldZ - gateDepth * 0.5 - 0.02]) {
      const archRing = new THREE.TorusGeometry(archR + 0.03, 0.055, 6, 16, Math.PI);
      xform(archRing, [worldX, worldY + archH - archR, faceZ]);
      graniteGeos.push(archRing);

      const keystone = new THREE.BoxGeometry(0.16, 0.22, 0.10);
      xform(keystone, [worldX, worldY + archH + 0.04, faceZ]);
      graniteGeos.push(keystone);

      const medallion = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12);
      xform(medallion, [worldX, worldY + 2.48, faceZ], [Math.PI / 2, 0, 0]);
      graniteGeos.push(medallion);
    }

    // Hollow interior barrel-vault soffit & crimson side passage doors inside the open archway
    const vaultGeo = buildVaultSoffit(archR, archH, gateDepth - 0.04);
    xform(vaultGeo, [worldX, worldY, worldZ]);
    darkVaultGeos.push(vaultGeo);

    // Interior tunnel steps + warm glowing tunnel ceiling lantern so through-passage reads cleanly
    const isCenter = gx === 0;
    const tunnelStepN = isCenter ? 10 : 6;
    for (let s = 0; s < tunnelStepN; s++) {
      const ft = s / (tunnelStepN - 1);
      const stepY = worldY + 0.05 + ft * (isCenter ? 1.02 : 0.14);
      const stepZ = worldZ + 1.34 - ft * 2.68;
      const step = new THREE.BoxGeometry(1.12, 0.08, 0.30);
      xform(step, [worldX, stepY, stepZ]);
      graniteGeos.push(step);
    }

    const tunnelLantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), palette.lampGlowMat);
    tunnelLantern.position.set(worldX, worldY + archH - 0.14, worldZ + 0.45);
    group.add(tunnelLantern);

    const cornice = new THREE.BoxGeometry(1.94, 0.18, 3.16);
    xform(cornice, [worldX, worldY + 2.94, worldZ]);
    graniteGeos.push(cornice);

    // Enclosed Cream-Stone Rooftop Pavilion Hall (千字文/学生会亭 e72c464a.jpg)
    const pavY = worldY + 3.03;
    const hallPlinth = new THREE.BoxGeometry(1.86, 0.12, 2.24);
    xform(hallPlinth, [worldX, pavY + 0.06, worldZ]);
    graniteGeos.push(hallPlinth);

    // South & North 5-bay crimson-mullioned glazed hall core
    const hallCore = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(1.52, 0.88, 1.96), 1.52, 0.88, 1.96, 2.4),
      palette.libWallMat
    );
    hallCore.position.set(worldX, pavY + 0.52, worldZ);
    hallCore.castShadow = true;
    hallCore.receiveShadow = true;
    group.add(hallCore);

    // Solid East & West cream stone end walls + stepped frieze & corner pilasters
    for (const sx of [-1, 1]) {
      const endStone = new THREE.BoxGeometry(0.18, 0.90, 2.02);
      xform(endStone, [worldX + sx * 0.72, pavY + 0.52, worldZ]);
      warmStoneGeos.push(endStone);

      // Crimson entrance door on end wall (e72c464a.jpg)
      const sideDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.62, 0.36),
        palette.crimsonColumnMat
      );
      sideDoor.position.set(worldX + sx * 0.82, pavY + 0.42, worldZ + 0.56);
      group.add(sideDoor);
    }

    // Exterior crimson-columned loggia trim & white granite 柱础 drum bases
    for (const px of [-0.74, 0.74]) {
      for (const pz of [-0.94, 0, 0.94]) {
        const plinth = new THREE.BoxGeometry(0.24, 0.08, 0.24);
        xform(plinth, [worldX + px, pavY + 0.12, worldZ + pz]);
        graniteGeos.push(plinth);
        const col = new THREE.CylinderGeometry(0.055, 0.06, 0.78, 8);
        col.translate(worldX + px, pavY + 0.54, worldZ + pz);
        const colMesh = new THREE.Mesh(col, palette.crimsonColumnMat);
        colMesh.castShadow = true;
        group.add(colMesh);
      }
    }

    const pavRoof = roofGroup(
      {
        halfW: 1.24,
        halfD: 1.38,
        H: 0.90,
        mode: 'xieshan',
        inset: 0.54,
        lift: 0.24,
        segU: 16,
        segV: 10,
        soffitInward: 0.54,
        rafters: true,
      },
      palette.roofMats
    );
    pavRoof.position.set(worldX, pavY + 0.96, worldZ);
    group.add(pavRoof);

    // Twin signature circular gable oculus vents (双圆气窗) on East & West 山花 gables (e72c464a.jpg)
    for (const sx of [-1, 1]) {
      for (const oz of [-0.20, 0.20]) {
        const oculus = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10),
          palette.darkTimberMat
        );
        oculus.rotation.z = Math.PI / 2;
        oculus.position.set(worldX + sx * 0.71, pavY + 1.32, worldZ + oz);
        group.add(oculus);
      }
    }
  });

  // Grand 108-Step Staircase (百步梯) — lower flight (plaza -> dorm court) + upper open flight (through central arch -> 樱顶)
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

  // Upper open flight continuing straight from Tier 1 north of the central arch up through Tier 2 canyon onto 樱顶
  const upperStepCount = 26;
  for (let i = 0; i < upperStepCount; i++) {
    const t = i / (upperStepCount - 1);
    const sy = 3.16 + t * 1.40;
    const sz = -2.20 - t * 3.88;
    const step = new THREE.BoxGeometry(2.02, 0.075, 0.20);
    xform(step, [0, sy, sz]);
    graniteGeos.push(step);
    const riser = new THREE.BoxGeometry(2.00, 0.075, 0.06);
    xform(riser, [0, sy - 0.045, sz + 0.07]);
    darkRiserGeos.push(riser);
  }
  const upperStairBed = new THREE.BoxGeometry(2.14, 1.48, 3.80);
  xform(upperStairBed, [0, 3.10, -4.15]);
  warmStoneGeos.push(upperStairBed);

  // Turquoise glazed corridor bridge lintel spanning above the upper flight at Tier 2 crest (04d2763a.jpg)
  const stairBridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.24, 0.72), palette.warmStoneMat);
  stairBridgeBeam.position.set(0, 5.26, -4.45);
  stairBridgeBeam.castShadow = true;
  group.add(stairBridgeBeam);
  const stairBridgeRoof = roofGroup(
    {
      halfW: 1.48,
      halfD: 0.56,
      H: 0.42,
      mode: 'xieshan',
      inset: 0.24,
      lift: 0.10,
      segU: 10,
      segV: 6,
      soffitInward: 0.26,
      rafters: false,
    },
    palette.roofMats
  );
  stairBridgeRoof.position.set(0, 5.38, -4.45);
  group.add(stairBridgeRoof);

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

  // Central promenade & symmetrical Dormitory South forecourt apron + lateral arch walkways
  const terraceWalk = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.07, 3.65), palette.plazaMat);
  terraceWalk.position.set(0, 2.13, 2.52);
  terraceWalk.receiveShadow = true;
  group.add(terraceWalk);
  const terracePierBase = new THREE.BoxGeometry(2.38, 0.48, 3.55);
  xform(terracePierBase, [0, 1.88, 2.52]);
  warmStoneGeos.push(terracePierBase);

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

    // Rear open patio exiting out the north mouth of left & right open Roman archways
    const rearCourtPad = new THREE.Mesh(new THREE.BoxGeometry(2.10, 0.07, 2.10), palette.plazaMat);
    rearCourtPad.position.set(gx, 2.078, -3.10);
    rearCourtPad.receiveShadow = true;
    group.add(rearCourtPad);

    for (const sx of [-0.75, 0.75]) {
      const curb = new THREE.BoxGeometry(0.12, 0.09, 2.15);
      xform(curb, [gx + sx, 2.07, 1.48]);
      graniteGeos.push(curb);
    }
  }

  // Lateral rear dressed garden path behind the Dormitory wings (split cleanly around the open center stairway)
  for (const [rx, rw] of [[-4.75, 6.8], [4.75, 6.8]]) {
    const rearWalk = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.07, 1.32), palette.plazaMat);
    rearWalk.position.set(rx, 2.078, -3.22);
    rearWalk.receiveShadow = true;
    group.add(rearWalk);
    for (const sz of [-3.88, -2.56]) {
      const rCurb = new THREE.BoxGeometry(rw, 0.09, 0.12);
      xform(rCurb, [rx, 2.085, sz]);
      graniteGeos.push(rCurb);
    }
  }

  const dormGraniteMesh = new THREE.Mesh(mergeSafe(graniteGeos), palette.graniteMat);
  dormGraniteMesh.castShadow = true;
  dormGraniteMesh.receiveShadow = true;
  group.add(dormGraniteMesh);

  const dormWarmStoneMesh = new THREE.Mesh(mergeSafe(warmStoneGeos), palette.warmStoneMat);
  dormWarmStoneMesh.castShadow = true;
  dormWarmStoneMesh.receiveShadow = true;
  group.add(dormWarmStoneMesh);

  const dormVaultMesh = new THREE.Mesh(mergeSafe(darkVaultGeos), palette.darkTimberMat);
  dormVaultMesh.receiveShadow = true;
  group.add(dormVaultMesh);

  lockStatic(group);

  return {
    group,
    setMood() {},
  };
}
