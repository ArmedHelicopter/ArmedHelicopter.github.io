import * as THREE from 'three';
import { mergeSafe, xform, lockStatic, roofGroup, octagonalRoofGroup, fitBoxFacadeUVs } from './geo.js';

/**
 * Independent component:
 * 1) Old Library (樱顶老图书馆, F. H. Kales 1935) centered at (0, 4.55, -13.6)
 *    with 3-bay portico colonnade, twin forward-gabled 歇山 corner pavilions,
 *    monumental double-height stack hall, E/W reading wings, carved octagonal chimney turret,
 *    true 8-sided octagonal clerestory drum, 8-cornered turquoise pavilion crown with 4 pediments, & 宝顶 spire.
 * 2) Old School of Liberal Arts (老文学院四合院) quadrangle on West Lion Hill crest (-9.8, 4.55, -10.8).
 */
export function createLibraryComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-old-library';

  const graniteGeos = [];
  const warmStoneGeos = [];

  const libX = 0;
  const libY = 4.55;
  const libZ = -13.6;

  const libGroup = new THREE.Group();
  libGroup.position.set(libX, libY, libZ);
  group.add(libGroup);

  // 1. Stepped Rusticated Granite Podium & Balustraded Central Entrance Stairs
  const podium = new THREE.BoxGeometry(8.6, 0.58, 7.6);
  xform(podium, [libX, libY + 0.29, libZ + 0.5]);
  graniteGeos.push(podium);

  const podiumTrim = new THREE.BoxGeometry(8.8, 0.11, 7.8);
  xform(podiumTrim, [libX, libY + 0.57, libZ + 0.5]);
  warmStoneGeos.push(podiumTrim);

  for (let s = 0; s < 6; s++) {
    const st = new THREE.BoxGeometry(2.55, 0.11, 0.30);
    xform(st, [libX, libY + 0.08 + s * 0.095, libZ + 5.15 - s * 0.24]);
    graniteGeos.push(st);
  }
  for (const sx of [-1.40, 1.40]) {
    const cheek = new THREE.BoxGeometry(0.22, 0.44, 1.55);
    xform(cheek, [libX + sx, libY + 0.34, libZ + 4.60], [0.36, 0, 0]);
    graniteGeos.push(cheek);
    const pier = new THREE.BoxGeometry(0.28, 0.72, 0.28);
    xform(pier, [libX + sx, libY + 0.36, libZ + 5.32]);
    graniteGeos.push(pier);
  }

  // 2. Monumental Double-Height Stack Core (5.6 x 3.25 x 4.4)
  const mainHall = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(5.6, 3.25, 4.4), 5.6, 3.25, 4.4, 6.2),
    palette.libWallMat
  );
  mainHall.position.set(0, 0.58 + 1.625, 0.1);
  mainHall.castShadow = true;
  mainHall.receiveShadow = true;
  libGroup.add(mainHall);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pil = new THREE.BoxGeometry(0.36, 3.28, 0.36);
      xform(pil, [libX + sx * 2.72, libY + 0.58 + 1.64, libZ + 0.1 + sz * 2.12]);
      warmStoneGeos.push(pil);
    }
  }

  // Lower perimeter turquoise 腰檐 skirt eave
  const lowerSkirtRoof = roofGroup(
    {
      halfW: 3.32,
      halfD: 2.70,
      H: 0.74,
      mode: 'ring',
      ring: 0.92,
      lift: 0.24,
      segU: 20,
      segV: 8,
      soffitInward: 0.85,
      rafters: true,
    },
    palette.roofMats
  );
  lowerSkirtRoof.position.set(0, 0.58 + 3.22, 0.1);
  libGroup.add(lowerSkirtRoof);

  // 3. South Entrance Portico (4 tall columns, recessed crimson double portal doors) + 2 Front Forward-Gabled 歇山 Corner Pavilions
  const porchBack = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(2.6, 2.25, 0.75), 2.6, 2.25, 0.75, 4.0),
    palette.libWallMat
  );
  porchBack.position.set(0, 0.58 + 1.12, 2.55);
  porchBack.castShadow = true;
  porchBack.receiveShadow = true;
  libGroup.add(porchBack);

  const portalSurround = new THREE.BoxGeometry(1.38, 1.72, 0.10);
  xform(portalSurround, [libX, libY + 0.58 + 0.86, libZ + 2.94]);
  graniteGeos.push(portalSurround);

  for (const dx of [-0.36, 0.36]) {
    const doorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 1.18, 0.08),
      palette.crimsonColumnMat
    );
    doorLeaf.position.set(dx, 0.58 + 0.59, 2.98);
    libGroup.add(doorLeaf);
  }
  const portalTransom = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(1.06, 0.34, 0.09), 1.06, 0.34, 0.09, 2.0),
    palette.libWallMat
  );
  portalTransom.position.set(0, 0.58 + 1.38, 2.98);
  libGroup.add(portalTransom);

  for (const px of [-1.20, -0.44, 0.44, 1.20]) {
    const colBase = new THREE.BoxGeometry(0.24, 0.14, 0.24);
    xform(colBase, [libX + px, libY + 0.58 + 0.07, libZ + 3.46]);
    graniteGeos.push(colBase);
    const colShaft = new THREE.CylinderGeometry(0.08, 0.095, 2.02, 8);
    xform(colShaft, [libX + px, libY + 0.58 + 1.14, libZ + 3.46]);
    warmStoneGeos.push(colShaft);
  }
  const porticoFrieze = new THREE.BoxGeometry(2.74, 0.34, 1.24);
  xform(porticoFrieze, [libX, libY + 0.58 + 2.30, libZ + 3.05]);
  warmStoneGeos.push(porticoFrieze);

  const porticoRoof = roofGroup(
    {
      halfW: 1.54,
      halfD: 0.92,
      H: 0.60,
      mode: 'xieshan',
      inset: 0.38,
      lift: 0.16,
      segU: 14,
      segV: 8,
      soffitInward: 0.42,
      rafters: false,
    },
    palette.roofMats
  );
  porticoRoof.position.set(0, 0.58 + 2.46, libZ === 0 ? 3.1 : 3.08);
  libGroup.add(porticoRoof);

  // Twin Projecting Forward Corner Reading Pavilions (forward-facing 歇山 ridges facing South, 193a6b98.jpg)
  for (const sx of [-1, 1]) {
    const cornerHall = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(1.75, 2.38, 1.85), 1.75, 2.38, 1.85, 3.6),
      palette.libWallMat
    );
    cornerHall.position.set(sx * 2.22, 0.58 + 1.19, 3.02);
    cornerHall.castShadow = true;
    cornerHall.receiveShadow = true;
    libGroup.add(cornerHall);

    for (const cx of [-0.82, 0.82]) {
      for (const cz of [-0.86, 0.86]) {
        const pil = new THREE.BoxGeometry(0.20, 2.40, 0.20);
        xform(pil, [libX + sx * 2.22 + cx, libY + 0.58 + 1.20, libZ + 3.02 + cz]);
        warmStoneGeos.push(pil);
      }
    }

    const cornerRoof = roofGroup(
      {
        halfW: 1.16,
        halfD: 1.06,
        H: 0.72,
        mode: 'xieshan',
        inset: 0.44,
        lift: 0.18,
        segU: 14,
        segV: 8,
        soffitInward: 0.44,
        rafters: true,
      },
      palette.roofMats
    );
    cornerRoof.rotation.y = Math.PI / 2; // North-South ridge facing hero South elevation!
    cornerRoof.position.set(sx * 2.22, 0.58 + 2.38, 3.02);
    libGroup.add(cornerRoof);
  }

  // 4. East & West Attached 歇山 Reading Wings (x = +-3.55, outer eave +-4.65 -> wide clear corridor east to 理学楼!)
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(1.65, 2.42, 2.90), 1.65, 2.42, 2.90, 3.8),
      palette.dormWallMat
    );
    wing.position.set(sx * 3.45, 0.58 + 1.21, -0.35);
    wing.castShadow = true;
    wing.receiveShadow = true;
    libGroup.add(wing);

    const wingRoof = roofGroup(
      {
        halfW: 1.12,
        halfD: 1.68,
        H: 0.78,
        mode: 'xieshan',
        inset: 0.56,
        lift: 0.20,
        segU: 14,
        segV: 8,
        soffitInward: 0.48,
        rafters: true,
      },
      palette.roofMats
    );
    wingRoof.rotation.y = Math.PI / 2;
    wingRoof.position.set(sx * 3.45, 0.58 + 2.42, -0.35);
    libGroup.add(wingRoof);
  }

  // Signature Carved Octagonal Stone Chimney Turret on rear NW/NE roof shoulder (ffa6c42d.jpg)
  const chimneyBase = new THREE.CylinderGeometry(0.24, 0.28, 1.95, 8);
  xform(chimneyBase, [libX + 2.55, libY + 0.58 + 3.45, libZ - 1.55]);
  warmStoneGeos.push(chimneyBase);
  const chimneyCap = new THREE.CylinderGeometry(0.30, 0.24, 0.22, 8);
  xform(chimneyCap, [libX + 2.55, libY + 0.58 + 4.48, libZ - 1.55]);
  graniteGeos.push(chimneyCap);

  // 5. White-Stone 平坐 Terrace Balustrade + True 8-Sided Octagonal Clerestory Drum + 8-Cornered Crown Roof
  const roofDeckY = 0.58 + 3.36;
  const upperBalustrade = new THREE.BoxGeometry(5.15, 0.28, 4.05);
  xform(upperBalustrade, [libX, libY + roofDeckY + 0.14, libZ + 0.1]);
  graniteGeos.push(upperBalustrade);

  const octRadius = 2.02;
  const octHeight = 1.48;
  const octDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(octRadius, octRadius * 1.02, octHeight, 8),
    palette.libWallMat
  );
  octDrum.rotation.y = Math.PI / 8;
  octDrum.position.set(0, roofDeckY + octHeight * 0.5, 0.1);
  octDrum.castShadow = true;
  octDrum.receiveShadow = true;
  libGroup.add(octDrum);

  // 8 vertical stone corner pilasters & crimson bracket frieze around octagonal drum
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * (Math.PI / 4);
    const px = Math.cos(a) * octRadius;
    const pz = 0.1 + Math.sin(a) * octRadius;
    const pil = new THREE.BoxGeometry(0.20, octHeight + 0.04, 0.20);
    xform(pil, [libX + px, libY + roofDeckY + octHeight * 0.5, libZ + pz], [0, -a, 0]);
    warmStoneGeos.push(pil);

    const col = new THREE.CylinderGeometry(0.045, 0.05, octHeight * 0.85, 8);
    col.translate(px * 1.03, roofDeckY + octHeight * 0.45, pz * 1.03);
    const colM = new THREE.Mesh(col, palette.crimsonColumnMat);
    colM.castShadow = true;
    libGroup.add(colM);
  }

  const octFrieze = new THREE.Mesh(
    new THREE.CylinderGeometry(octRadius * 1.08, octRadius * 1.06, 0.24, 8),
    palette.darkTimberMat
  );
  octFrieze.rotation.y = Math.PI / 8;
  octFrieze.position.set(0, roofDeckY + octHeight + 0.06, 0.1);
  octFrieze.castShadow = true;
  libGroup.add(octFrieze);

  // Iconic 8-Cornered Turquoise Pavilion Crown with 4 Cardinal 歇山山花 Pediments
  const octCrownY = roofDeckY + octHeight + 0.14;
  const octCrownRoof = octagonalRoofGroup(
    {
      radius: 2.86,
      H: 1.56,
      lift: 0.34,
      pediments: true,
      segU: 8,
      segV: 10,
      tilePitch: 0.28,
    },
    palette.roofMats
  );
  octCrownRoof.position.set(0, octCrownY, 0.1);
  libGroup.add(octCrownRoof);

  // 2-tier lotus pedestal + graduated 7-ring 相轮宝顶 spire
  const finialY = octCrownY + 1.52;
  const finialBaseTier = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.40, 0.13, 8),
    palette.glazedRidgeMat
  );
  finialBaseTier.position.set(0, finialY, 0.1);
  finialBaseTier.castShadow = true;
  libGroup.add(finialBaseTier);

  const finialUpperTier = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.30, 0.11, 8),
    palette.glazedRidgeMat
  );
  finialUpperTier.position.set(0, finialY + 0.10, 0.1);
  finialUpperTier.castShadow = true;
  libGroup.add(finialUpperTier);

  const baodingPts = [];
  const bSteps = 44;
  for (let i = 0; i <= bSteps; i++) {
    const t = i / bSteps;
    const y = t * 1.18;
    let r = 0.22 * (1 - t * 0.62);
    if (t < 0.80) {
      const wave = Math.sin(t * Math.PI * 14.0);
      r += Math.max(0, wave) * 0.07;
    } else {
      const u = (t - 0.80) / 0.20;
      r = 0.12 * Math.cos(u * Math.PI * 0.49);
    }
    baodingPts.push(new THREE.Vector2(Math.max(0.015, r), y));
  }
  const baodingMesh = new THREE.Mesh(new THREE.LatheGeometry(baodingPts, 24), palette.glazedRidgeMat);
  baodingMesh.position.set(0, finialY + 0.16, 0.1);
  baodingMesh.castShadow = true;
  libGroup.add(baodingMesh);

  // 6. West Crest Quadrangle — Old School of Liberal Arts (老文学院四合院, 02054597.jpg left)
  const libArtsX = -9.8;
  const libArtsY = 4.55;
  const libArtsZ = -10.8;

  const qPodium = new THREE.BoxGeometry(5.1, 0.30, 5.5);
  xform(qPodium, [libArtsX, libArtsY + 0.15, libArtsZ]);
  graniteGeos.push(qPodium);

  const qBarSpecs = [
    { pos: [libArtsX, libArtsZ + 1.85], size: [4.6, 2.05, 1.15], roof: { hw: 2.55, hd: 0.72, rot: 0 } },
    { pos: [libArtsX, libArtsZ - 1.85], size: [4.6, 2.05, 1.15], roof: { hw: 2.55, hd: 0.72, rot: 0 } },
    { pos: [libArtsX - 1.75, libArtsZ], size: [1.10, 2.05, 2.60], roof: { hw: 2.15, hd: 0.72, rot: Math.PI / 2 } },
    { pos: [libArtsX + 1.75, libArtsZ], size: [1.10, 2.05, 2.60], roof: { hw: 2.15, hd: 0.72, rot: Math.PI / 2 } },
  ];
  for (const bar of qBarSpecs) {
    const [bx, bz] = bar.pos;
    const [bw, bh, bd] = bar.size;
    const wall = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(bw, bh, bd), bw, bh, bd, 3.6),
      palette.dormWallMat
    );
    wall.position.set(bx, libArtsY + 0.30 + bh * 0.5, bz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const bRoof = roofGroup(
      {
        halfW: bar.roof.hw,
        halfD: bar.roof.hd,
        H: 0.68,
        mode: 'xieshan',
        inset: 0.34,
        lift: 0.16,
        segU: 12,
        segV: 6,
        soffitInward: 0.34,
        rafters: false,
      },
      palette.roofMats
    );
    bRoof.rotation.y = bar.roof.rot;
    bRoof.position.set(bx, libArtsY + 0.30 + bh, bz);
    group.add(bRoof);
  }

  const libGraniteMesh = new THREE.Mesh(mergeSafe(graniteGeos), palette.graniteMat);
  libGraniteMesh.castShadow = true;
  libGraniteMesh.receiveShadow = true;
  group.add(libGraniteMesh);

  const libWarmStoneMesh = new THREE.Mesh(mergeSafe(warmStoneGeos), palette.warmStoneMat);
  libWarmStoneMesh.castShadow = true;
  libWarmStoneMesh.receiveShadow = true;
  group.add(libWarmStoneMesh);

  lockStatic(group);

  return {
    group,
    setMood() {},
  };
}
