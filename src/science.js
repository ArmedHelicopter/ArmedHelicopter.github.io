import * as THREE from 'three';
import { mergeSafe, xform, lockStatic, roofGroup, fitBoxFacadeUVs } from './geo.js';

/**
 * Independent component: College of Science (理学楼 / 老理学院, F. H. Kales, f12aa9d2.jpg)
 * Positioned on the East 樱顶 Crest (6.30, 4.55, -7.65 .. -15.8) overlooking Cherry Blossom Avenue & East Lake:
 * - Octagonal cream-stone main hall with 4 cardinal porticos & projecting turquoise glazed 歇山/披檐 eaves
 * - 16-rib buttressed clerestory drum (扶壁环窗鼓座)
 * - Smooth cream-concrete hemispherical dome with stepped collar & top oculus skylight ring
 * - Semi-circular domed side apse (小穹顶耳室) + turquoise covered breezeway (连廊)
 * - Attached NE turquoise 歇山 pitched wing + 3-story stepped flat-roof rear lab block
 */
export function createScienceComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-science-building';

  const graniteGeos = [];
  const warmStoneGeos = [];
  const darkSlateGeos = [];

  const deckSlateMat = palette.graniteMat.clone();
  deckSlateMat.color.set('#6f747c');
  deckSlateMat.roughness = 0.86;

  const sciX = 6.30;
  const sciY = 4.55;
  const sciZ = -7.65;

  // 1. Octagonal-Cruciform Main Podium & Steps facing South & West onto 樱顶 Forecourt
  const podium = new THREE.CylinderGeometry(2.45, 2.52, 0.42, 8);
  xform(podium, [sciX, sciY + 0.21, sciZ], [0, Math.PI / 8, 0]);
  graniteGeos.push(podium);

  for (let s = 0; s < 4; s++) {
    const stS = new THREE.BoxGeometry(1.55, 0.11, 0.28);
    xform(stS, [sciX, sciY + 0.06 + s * 0.095, sciZ + 2.48 - s * 0.22]);
    graniteGeos.push(stS);

    const stW = new THREE.BoxGeometry(0.28, 0.11, 1.45);
    xform(stW, [sciX - 2.45 + s * 0.22, sciY + 0.06 + s * 0.095, sciZ]);
    graniteGeos.push(stW);
  }

  // 2. 8-Sided Cream-Stone Main Hall (radius 1.72, height 2.32)
  const hallH = 2.32;
  const mainOctHall = new THREE.Mesh(
    new THREE.CylinderGeometry(1.72, 1.74, hallH, 8),
    palette.libWallMat
  );
  mainOctHall.rotation.y = Math.PI / 8;
  mainOctHall.position.set(sciX, sciY + 0.42 + hallH * 0.5, sciZ);
  mainOctHall.castShadow = true;
  mainOctHall.receiveShadow = true;
  group.add(mainOctHall);

  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * (Math.PI / 4);
    const pil = new THREE.BoxGeometry(0.20, hallH + 0.08, 0.20);
    xform(pil, [sciX + Math.cos(a) * 1.72, sciY + 0.42 + hallH * 0.5, sciZ + Math.sin(a) * 1.72], [0, -a, 0]);
    warmStoneGeos.push(pil);
  }

  // Stepped Stone Roof Cornice Parapet & Slate Terrace
  const mainParapet = new THREE.CylinderGeometry(1.86, 1.84, 0.28, 8);
  xform(mainParapet, [sciX, sciY + 0.42 + hallH + 0.14, sciZ], [0, Math.PI / 8, 0]);
  warmStoneGeos.push(mainParapet);

  const roofSlate = new THREE.CylinderGeometry(1.74, 1.74, 0.10, 8);
  xform(roofSlate, [sciX, sciY + 0.42 + hallH + 0.26, sciZ], [0, Math.PI / 8, 0]);
  darkSlateGeos.push(roofSlate);

  // 3. Four Projecting Cardinal Porticos (South Hero Portal + W/N/E 绿琉璃披檐 Bay Projections, f12aa9d2.jpg)
  const cardinalDirs = [
    { name: 'south', rotY: 0, dist: 1.56, w: 1.72, d: 0.94, isPortal: true },
    { name: 'west', rotY: -Math.PI / 2, dist: 1.56, w: 1.68, d: 0.88, isPortal: false },
    { name: 'east', rotY: Math.PI / 2, dist: 1.50, w: 1.56, d: 0.78, isPortal: false },
    { name: 'north', rotY: Math.PI, dist: 1.50, w: 1.62, d: 0.82, isPortal: false },
  ];
  for (const card of cardinalDirs) {
    const cg = new THREE.Group();
    cg.position.set(sciX, sciY + 0.42, sciZ);
    cg.rotation.y = card.rotY;

    const projBody = new THREE.Mesh(
      fitBoxFacadeUVs(new THREE.BoxGeometry(card.w, 2.24, card.d), card.w, 2.24, card.d, 3.2),
      palette.libWallMat
    );
    projBody.position.set(0, 1.12, card.dist);
    projBody.castShadow = true;
    projBody.receiveShadow = true;
    cg.add(projBody);

    const projParapet = new THREE.Mesh(
      new THREE.BoxGeometry(card.w + 0.12, 0.34, card.d + 0.12),
      palette.warmStoneMat
    );
    projParapet.position.set(0, 2.34, card.dist);
    projParapet.castShadow = true;
    cg.add(projParapet);

    if (card.isPortal) {
      // Three-bay stone-framed crimson portal doors + transom windows (f12aa9d2.jpg front!)
      for (const dx of [-0.42, 0, 0.42]) {
        const frame = new THREE.BoxGeometry(0.32, 1.18, 0.09);
        xform(frame, [sciX + dx, sciY + 0.42 + 0.59, sciZ + card.dist + card.d * 0.5 + 0.01]);
        graniteGeos.push(frame);
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.90, 0.11),
          palette.crimsonColumnMat
        );
        door.position.set(dx, 0.46, card.dist + card.d * 0.5 + 0.02);
        cg.add(door);
      }
      const stoneLintel = new THREE.Mesh(
        new THREE.BoxGeometry(card.w + 0.16, 0.24, 0.14),
        palette.graniteMat
      );
      stoneLintel.position.set(0, 1.32, card.dist + card.d * 0.5 + 0.04);
      cg.add(stoneLintel);
    }

    // Iconic projecting green-glazed entrance eave canopy on S/W/E/N wings
    const eaveCanopy = roofGroup(
      {
        halfW: card.w * 0.58,
        halfD: 0.42,
        H: 0.38,
        mode: 'xieshan',
        inset: 0.20,
        lift: 0.10,
        segU: 10,
        segV: 6,
        soffitInward: 0.20,
        rafters: false,
      },
      palette.roofMats
    );
    eaveCanopy.position.set(0, 1.62, card.dist + card.d * 0.5 + 0.18);
    cg.add(eaveCanopy);

    group.add(cg);
  }

  // 4. 16-Rib Buttressed Clerestory Drum (扶壁环窗鼓座, f12aa9d2.jpg center crown!)
  const drumBaseY = sciY + 0.42 + hallH + 0.30;
  const drumH = 0.62;
  const drumR = 1.38;

  const drumWall = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR * 1.02, drumH, 16),
    palette.libWallMat
  );
  drumWall.position.set(sciX, drumBaseY + drumH * 0.5, sciZ);
  drumWall.castShadow = true;
  drumWall.receiveShadow = true;
  group.add(drumWall);

  // 16 radial sloped cream-stone buttress ribs dividing the drum clerestory windows
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = new THREE.BoxGeometry(0.11, drumH + 0.06, 0.26);
    xform(
      rib,
      [sciX + Math.cos(a) * (drumR + 0.06), drumBaseY + drumH * 0.48, sciZ + Math.sin(a) * (drumR + 0.06)],
      [0, -a + Math.PI / 2, 0]
    );
    warmStoneGeos.push(rib);
  }

  const drumRingCap = new THREE.CylinderGeometry(drumR + 0.08, drumR + 0.12, 0.14, 20);
  xform(drumRingCap, [sciX, drumBaseY + drumH + 0.05, sciZ]);
  warmStoneGeos.push(drumRingCap);

  // 5. Monumental Smooth Cream Concrete Hemispherical Dome + Top Oculus Ring (f12aa9d2.jpg)
  const domeBaseY = drumBaseY + drumH + 0.10;
  const domeGeo = new THREE.SphereGeometry(1.36, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.46);
  const domeMesh = new THREE.Mesh(domeGeo, palette.warmStoneMat);
  domeMesh.position.set(sciX, domeBaseY, sciZ);
  domeMesh.scale.set(1.0, 0.88, 1.0);
  domeMesh.castShadow = true;
  domeMesh.receiveShadow = true;
  group.add(domeMesh);

  const oculusRim = new THREE.CylinderGeometry(0.32, 0.36, 0.12, 16);
  xform(oculusRim, [sciX, domeBaseY + 1.36 * 0.88 - 0.02, sciZ]);
  graniteGeos.push(oculusRim);

  const oculusGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.10, 14),
    palette.glazedTileMat
  );
  oculusGlass.position.set(sciX, domeBaseY + 1.36 * 0.88 + 0.01, sciZ);
  group.add(oculusGlass);

  // 6. Semi-Circular Mini-Domed Side Apse (小穹顶耳室) + Glazed Breezeway (连廊) cleanly clear of roofs
  const apseX = 8.28;
  const apseZ = -10.12;
  const apseBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.46, 1.66, 16),
    palette.libWallMat
  );
  apseBody.position.set(apseX, sciY + 0.83, apseZ);
  apseBody.castShadow = true;
  apseBody.receiveShadow = true;
  group.add(apseBody);

  const apseCollar = new THREE.CylinderGeometry(0.50, 0.48, 0.12, 16);
  xform(apseCollar, [apseX, sciY + 1.70, apseZ]);
  warmStoneGeos.push(apseCollar);

  const apseDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
    palette.warmStoneMat
  );
  apseDome.position.set(apseX, sciY + 1.74, apseZ);
  apseDome.castShadow = true;
  group.add(apseDome);

  // Recessed cream-stone transition collar & covered glazed breezeway linking Octagonal Hall -> Apse -> NE Wing
  const linkCollar = new THREE.BoxGeometry(2.30, 2.18, 1.45);
  xform(linkCollar, [6.36, sciY + 1.09, -10.45]);
  warmStoneGeos.push(linkCollar);
  const linkParapet = new THREE.BoxGeometry(2.44, 0.24, 1.56);
  xform(linkParapet, [6.36, sciY + 2.26, -10.45]);
  graniteGeos.push(linkParapet);

  const breezeWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 1.42, 1.72),
    palette.libWallMat
  );
  breezeWall.position.set(6.95, sciY + 0.71, -10.12);
  breezeWall.castShadow = true;
  group.add(breezeWall);

  const breezeRoof = roofGroup(
    {
      halfW: 0.54,
      halfD: 0.90,
      H: 0.38,
      mode: 'xieshan',
      inset: 0.22,
      lift: 0.08,
      segU: 10,
      segV: 6,
      soffitInward: 0.22,
      rafters: false,
    },
    palette.roofMats
  );
  breezeRoof.position.set(6.95, sciY + 1.42, -10.12);
  group.add(breezeRoof);

  // 7. Attached North-East Turquoise 歇山 Wing (clear of Octagonal Hall parapet) + Chinese-Renaissance Lab Annex
  const neWingX = 6.45;
  const neWingZ = -13.15;
  const neWingBody = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(2.85, 2.15, 2.65), 2.85, 2.15, 2.65, 3.6),
    palette.dormWallMat
  );
  neWingBody.position.set(neWingX, sciY + 1.075, neWingZ);
  neWingBody.castShadow = true;
  neWingBody.receiveShadow = true;
  group.add(neWingBody);

  const neWingRoof = roofGroup(
    {
      halfW: 1.56,
      halfD: 1.56,
      H: 0.86,
      mode: 'xieshan',
      inset: 0.52,
      lift: 0.18,
      segU: 16,
      segV: 8,
      soffitInward: 0.52,
      rafters: true,
    },
    palette.roofMats
  );
  neWingRoof.rotation.y = Math.PI / 2;
  neWingRoof.position.set(neWingX, sciY + 2.15, neWingZ);
  group.add(neWingRoof);

  const rearLabX = 6.45;
  const rearLabZ = -15.95;
  const rearLabBody = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(3.05, 2.38, 2.40), 3.05, 2.38, 2.40, 3.6),
    palette.dormWallMat
  );
  rearLabBody.position.set(rearLabX, sciY + 1.19, rearLabZ);
  rearLabBody.castShadow = true;
  rearLabBody.receiveShadow = true;
  group.add(rearLabBody);

  const rearLabSkirtRoof = roofGroup(
    {
      halfW: 1.72,
      halfD: 1.40,
      H: 0.42,
      mode: 'ring',
      ring: 0.48,
      lift: 0.14,
      segU: 14,
      segV: 6,
      soffitInward: 0.46,
      rafters: false,
    },
    palette.roofMats
  );
  rearLabSkirtRoof.position.set(rearLabX, sciY + 2.34, rearLabZ);
  group.add(rearLabSkirtRoof);

  const rearLabParapet = new THREE.BoxGeometry(2.74, 0.24, 2.12);
  xform(rearLabParapet, [rearLabX, sciY + 2.66, rearLabZ]);
  warmStoneGeos.push(rearLabParapet);

  const rearLabDeck = new THREE.BoxGeometry(2.50, 0.10, 1.88);
  xform(rearLabDeck, [rearLabX, sciY + 2.75, rearLabZ]);
  darkSlateGeos.push(rearLabDeck);

  const rearLanternMonitor = new THREE.Mesh(
    fitBoxFacadeUVs(new THREE.BoxGeometry(1.36, 0.42, 1.02), 1.36, 0.42, 1.02, 2.0),
    palette.libWallMat
  );
  rearLanternMonitor.position.set(rearLabX, sciY + 2.98, rearLabZ);
  rearLanternMonitor.castShadow = true;
  group.add(rearLanternMonitor);

  const rearLanternRoof = roofGroup(
    {
      halfW: 0.86,
      halfD: 0.68,
      H: 0.48,
      mode: 'xieshan',
      inset: 0.28,
      lift: 0.12,
      segU: 12,
      segV: 6,
      soffitInward: 0.28,
      rafters: false,
    },
    palette.roofMats
  );
  rearLanternRoof.position.set(rearLabX, sciY + 3.18, rearLabZ);
  group.add(rearLanternRoof);

  const sciGraniteMesh = new THREE.Mesh(mergeSafe(graniteGeos), palette.graniteMat);
  sciGraniteMesh.castShadow = true;
  sciGraniteMesh.receiveShadow = true;
  group.add(sciGraniteMesh);

  const sciWarmStoneMesh = new THREE.Mesh(mergeSafe(warmStoneGeos), palette.warmStoneMat);
  sciWarmStoneMesh.castShadow = true;
  sciWarmStoneMesh.receiveShadow = true;
  group.add(sciWarmStoneMesh);

  const sciSlateMesh = new THREE.Mesh(mergeSafe(darkSlateGeos), deckSlateMat);
  sciSlateMesh.receiveShadow = true;
  group.add(sciSlateMesh);

  lockStatic(group);

  return {
    group,
    setMood() {},
  };
}
