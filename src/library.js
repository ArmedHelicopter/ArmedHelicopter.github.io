import * as THREE from 'three';
import { mergeSafe, xform, lockStatic, roofGroup, fitBoxFacadeUVs } from './geo.js';

/**
 * Independent component: Old Library (樱顶老图书馆) on Lion Hill Crest
 * plus Flanking Cherry Crest Courtyard Wings (文理侧翼).
 */
export function createLibraryComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-old-library';

  const graniteGeos = [];
  const warmStoneGeos = [];

  const libGroup = new THREE.Group();
  libGroup.position.set(0, 4.55, -9.8);
  group.add(libGroup);

  const podium = new THREE.BoxGeometry(9.6, 0.55, 7.8);
  xform(podium, [0, 4.55 + 0.27, -9.5]);
  graniteGeos.push(podium);

  // Articulated dado panels & horizontal granite stringcourses framing Old Library podium
  const podiumTrim = new THREE.BoxGeometry(9.82, 0.12, 8.02);
  xform(podiumTrim, [0, 4.55 + 0.54, -9.5]);
  warmStoneGeos.push(podiumTrim);
  for (const sx of [-4.6, -2.4, 2.4, 4.6]) {
    for (const sz of [-13.42, -5.58]) {
      const pPil = new THREE.BoxGeometry(0.32, 0.56, 0.16);
      xform(pPil, [sx, 4.55 + 0.28, sz]);
      warmStoneGeos.push(pPil);
    }
  }
  for (const sz of [-12.6, -10.8, -8.8, -6.6]) {
    for (const sx of [-4.82, 4.82]) {
      const pPil = new THREE.BoxGeometry(0.16, 0.56, 0.32);
      xform(pPil, [sx, 4.55 + 0.28, sz]);
      warmStoneGeos.push(pPil);
    }
  }

  for (let s = 0; s < 6; s++) {
    const st = new THREE.BoxGeometry(3.2, 0.12, 0.34);
    xform(st, [0, 4.55 + s * 0.09, -5.5 + s * -0.22]);
    graniteGeos.push(st);
  }

  // Corner podium steps near south-east forecourt leading up onto extended Old Library podium
  for (let s = 0; s < 4; s++) {
    const cStep = new THREE.BoxGeometry(1.45, 0.14, 0.32);
    xform(cStep, [3.4, 4.55 + 0.07 + s * 0.12, -5.50 - s * 0.24]);
    graniteGeos.push(cStep);
  }

  const libMainHall = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(7.8, 2.72, 5.4), 7.8, 2.72, 5.4, 7.4),
    palette.libWallMat
  );
  libMainHall.position.set(0, 0.55 + 1.36, 0);
  libMainHall.castShadow = true;
  libMainHall.receiveShadow = true;
  libGroup.add(libMainHall);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pilaster = new THREE.BoxGeometry(0.42, 2.72, 0.42);
      xform(pilaster, [sx * 3.8, 4.55 + 0.55 + 1.36, -9.8 + sz * 2.6]);
      warmStoneGeos.push(pilaster);
    }
  }

  const lowerFrieze = new THREE.Mesh(new THREE.BoxGeometry(7.68, 0.18, 5.32), palette.darkTimberMat);
  lowerFrieze.position.set(0, 0.55 + 2.68, 0);
  lowerFrieze.castShadow = true;
  libGroup.add(lowerFrieze);

  // Portico seated cleanly below lowerSkirtRoof's upturned southern eave (zero roof collision)
  const porchHall = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(3.0, 2.16, 1.55), 3.0, 2.16, 1.55, 7.4),
    palette.libWallMat
  );
  porchHall.position.set(0, 0.55 + 1.08, 3.12);
  porchHall.castShadow = true;
  porchHall.receiveShadow = true;
  libGroup.add(porchHall);

  const porchRoof = roofGroup(
    {
      halfW: 1.82,
      halfD: 0.98,
      H: 0.66,
      mode: 'xieshan',
      inset: 0.42,
      lift: 0.18,
      segU: 16,
      segV: 10,
      soffitInward: 0.56,
      rafters: true,
    },
    palette.roofMats
  );
  porchRoof.position.set(0, 0.55 + 2.16, 3.24);
  libGroup.add(porchRoof);

  const lowerSkirtRoof = roofGroup(
    {
      halfW: 4.26,
      halfD: 3.18,
      H: 1.02,
      mode: 'ring',
      ring: 1.35,
      lift: 0.34,
      segU: 24,
      segV: 10,
      soffitInward: 1.15,
      rafters: true,
    },
    palette.roofMats
  );
  lowerSkirtRoof.position.set(0, 0.55 + 2.76, 0);
  libGroup.add(lowerSkirtRoof);

  const upperHall = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(5.6, 1.52, 3.7), 5.6, 1.52, 3.7, 7.4),
    palette.libWallMat
  );
  upperHall.position.set(0, 0.55 + 3.82 + 0.76, 0);
  upperHall.castShadow = true;
  upperHall.receiveShadow = true;
  libGroup.add(upperHall);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const uPil = new THREE.BoxGeometry(0.32, 1.56, 0.32);
      xform(uPil, [sx * 2.74, 4.55 + 0.55 + 4.58, -9.8 + sz * 1.78]);
      warmStoneGeos.push(uPil);
    }
  }
  for (const px of [-2.85, -1.75, -0.65, 0.65, 1.75, 2.85]) {
    for (const pz of [-1.96, 1.96]) {
      const col = new THREE.CylinderGeometry(0.055, 0.06, 1.34, 8);
      col.translate(px, 0.55 + 4.55, pz);
      const cMesh = new THREE.Mesh(col, palette.crimsonColumnMat);
      cMesh.castShadow = true;
      libGroup.add(cMesh);
    }
  }
  const upperFrieze = new THREE.Mesh(new THREE.BoxGeometry(6.25, 0.28, 4.35), palette.darkTimberMat);
  upperFrieze.position.set(0, 0.55 + 5.20, 0);
  upperFrieze.castShadow = true;
  libGroup.add(upperFrieze);

  const upperBalustrade = new THREE.BoxGeometry(5.68, 0.24, 3.88);
  xform(upperBalustrade, [0, 4.55 + 0.55 + 3.90, -9.8]);
  graniteGeos.push(upperBalustrade);

  const upperMainRoof = roofGroup(
    {
      halfW: 3.75,
      halfD: 2.65,
      H: 1.62,
      mode: 'xieshan',
      inset: 1.1,
      lift: 0.36,
      segU: 24,
      segV: 12,
      soffitInward: 1.12,
      rafters: true,
    },
    palette.roofMats
  );
  upperMainRoof.position.set(0, 0.55 + 5.20, 0);
  libGroup.add(upperMainRoof);

  // Refined slender 2-tier lotus pedestal & graduated 5-ring 宝顶 spire (unified teal glaze)
  const finialBaseTier = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.44, 0.14, 8),
    palette.glazedRidgeMat
  );
  finialBaseTier.position.set(0, 0.55 + 6.72, 0);
  finialBaseTier.castShadow = true;
  libGroup.add(finialBaseTier);
  const finialUpperTier = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.34, 0.12, 8),
    palette.glazedRidgeMat
  );
  finialUpperTier.position.set(0, 0.55 + 6.83, 0);
  finialUpperTier.castShadow = true;
  libGroup.add(finialUpperTier);

  const baodingPts = [];
  const bSteps = 44;
  for (let i = 0; i <= bSteps; i++) {
    const t = i / bSteps;
    const y = t * 1.24;
    let r = 0.26 * (1 - t * 0.62);
    if (t < 0.78) {
      const wave = Math.sin(t * Math.PI * 10.0);
      r += Math.max(0, wave) * 0.08;
    } else {
      const u = (t - 0.78) / 0.22;
      r = 0.14 * Math.cos(u * Math.PI * 0.49);
    }
    baodingPts.push(new THREE.Vector2(Math.max(0.015, r), y));
  }
  const baodingGeo = new THREE.LatheGeometry(baodingPts, 24);
  const baodingMesh = new THREE.Mesh(baodingGeo, palette.glazedRidgeMat);
  baodingMesh.position.set(0, 0.55 + 6.90, 0);
  baodingMesh.castShadow = true;
  libGroup.add(baodingMesh);

  // Flanking Cherry Crest Courtyard Wings (>1.4m clear gap from Old Library eaves & pilasters)
  for (const sx of [-1, 1]) {
    const wingX = sx * 7.20;
    const wingY = 4.55;
    const wingZ = -8.6;

    const sidePodium = new THREE.BoxGeometry(3.10, 0.26, 3.10);
    xform(sidePodium, [wingX, wingY + 0.13, wingZ]);
    graniteGeos.push(sidePodium);

    const sideHall = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(2.80, 2.08, 2.80), 2.80, 2.08, 2.80, 3.8),
      palette.dormWallMat
    );
    sideHall.position.set(wingX, wingY + 0.26 + 1.04, wingZ);
    sideHall.castShadow = true;
    sideHall.receiveShadow = true;
    group.add(sideHall);

    const sideRoof = roofGroup(
      {
        halfW: 1.60,
        halfD: 1.66,
        H: 0.90,
        mode: 'hip',
        lift: 0.20,
        segU: 16,
        segV: 8,
        soffitInward: 0.60,
        rafters: true,
      },
      palette.roofMats
    );
    sideRoof.position.set(wingX, wingY + 2.28, wingZ);
    group.add(sideRoof);
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
