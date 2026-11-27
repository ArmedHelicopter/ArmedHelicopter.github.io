import * as THREE from 'three';
import { mergeSafe, xform, lockStatic } from './geo.js';
import { applyWorldPlanarUVs, shoreX, luojiaHeight } from './materials.js';

/**
 * Independent component: Luojia Mountain Mainland Terrain, Sunlit Granite Plazas,
 * Tiered Ashlar Retaining Terraces, and Campus Avenue Streetlamps.
 */
export function createTerrainComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-luojia-terrain';

  const graniteGeos = [];
  const ashlarGeos = [];
  const grassGeos = [];

  function buildTerrainBlock(zList, uSteps, xMin, xMaxFn) {
    const verts = [];
    const uvs = [];
    const idx = [];
    const cols = uSteps + 1;
    for (let iz = 0; iz < zList.length; iz++) {
      const z = zList[iz];
      const xMax = xMaxFn(z);
      for (let iu = 0; iu <= uSteps; iu++) {
        const u = iu / uSteps;
        const uSkew = 1.0 - Math.pow(1.0 - u, 1.55);
        const x = THREE.MathUtils.lerp(xMin, xMax, uSkew);
        const y = luojiaHeight(x, z);
        verts.push(x, y, z);
        uvs.push(x * 0.04, z * 0.04);
      }
    }
    for (let iz = 0; iz < zList.length - 1; iz++) {
      for (let iu = 0; iu < uSteps; iu++) {
        const a = iz * cols + iu;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const northZList = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    northZList.push(-15.2 - Math.pow(1.0 - u, 1.65) * (172.0 - 15.2));
  }
  const westZList = [];
  for (let i = 0; i <= 14; i++) {
    westZList.push(THREE.MathUtils.lerp(-15.2, 9.05, i / 14));
  }
  const southZList = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    southZList.push(9.05 + Math.pow(u, 1.65) * (172.0 - 9.05));
  }

  const fullZList = [
    ...northZList.slice(0, -1),
    ...westZList.slice(0, -1),
    ...southZList,
  ];
  const mainlandGeos = [
    buildTerrainBlock(fullZList, 40, -172.0, () => 8.0),
    buildTerrainBlock(northZList, 14, 8.0, (z) => shoreX(z) + 1.6),
    buildTerrainBlock(southZList, 14, 8.0, (z) => shoreX(z) + 1.6),
  ];
  const mainlandMesh = new THREE.Mesh(mergeSafe(mainlandGeos), palette.hillMat);
  mainlandMesh.receiveShadow = true;
  group.add(mainlandMesh);

  const campusLawnShape = new THREE.Shape();
  campusLawnShape.moveTo(-16.2, -15.5);
  campusLawnShape.lineTo(12.1, -15.5);
  campusLawnShape.lineTo(12.1, -9.05);
  campusLawnShape.lineTo(8.0, -9.05);
  campusLawnShape.lineTo(8.0, 15.2);
  campusLawnShape.lineTo(-16.2, 15.2);
  campusLawnShape.closePath();
  const landGeo = new THREE.ExtrudeGeometry(campusLawnShape, { depth: 0.42, bevelEnabled: false });
  landGeo.rotateX(-Math.PI / 2);
  landGeo.translate(0, -0.4, 0);
  const lPos = landGeo.attributes.position;
  const lUv = landGeo.attributes.uv;
  for (let i = 0; i < lPos.count; i++) {
    lUv.setXY(i, lPos.getX(i) * 0.04, lPos.getZ(i) * 0.04);
  }
  grassGeos.push(landGeo);

  // Split Archway Plaza into South Foreground & North Archway-to-Avenue slabs
  const plazaSouth = new THREE.BoxGeometry(24.6, 0.24, 29.3);
  xform(plazaSouth, [0, 0.01, 23.85]);
  const plazaSouthMesh = new THREE.Mesh(plazaSouth, palette.plazaMat);
  plazaSouthMesh.receiveShadow = true;
  group.add(plazaSouthMesh);

  const plazaNorth = new THREE.BoxGeometry(21.7, 0.24, 5.0);
  xform(plazaNorth, [-2.95, 0.01, 6.7]);
  const plazaNorthMesh = new THREE.Mesh(plazaNorth, palette.plazaMat);
  plazaNorthMesh.receiveShadow = true;
  group.add(plazaNorthMesh);

  // Central ceremonial axis walk
  const axisWalk = new THREE.BoxGeometry(6.4, 0.26, 38.0);
  xform(axisWalk, [0, 0.02, 18.0]);
  const axisMesh = new THREE.Mesh(axisWalk, palette.avenueMat);
  axisMesh.receiveShadow = true;
  group.add(axisMesh);

  for (const sx of [-1, 1]) {
    const southEdgeCurb = new THREE.BoxGeometry(0.36, 0.32, 29.5);
    xform(southEdgeCurb, [sx * 12.3, 0.14, 23.85]);
    graniteGeos.push(southEdgeCurb);
  }
  const frontPlazaCurb = new THREE.BoxGeometry(24.96, 0.32, 0.36);
  xform(frontPlazaCurb, [0, 0.14, 38.5]);
  graniteGeos.push(frontPlazaCurb);

  // Forecourt planters, avenue curbs, and 6 heritage streetlamps
  const soilGeos = [];
  const lampShaftGeos = [];
  const lampHeadGeos = [];
  for (const sx of [-1, 1]) {
    for (const [pzCenter, xCenter, pw, pd] of [
      [19.2, sx < 0 ? -10.4 : 12.2, 3.6, 9.4],
      [30.2, sx < 0 ? -9.6 : 11.4, 4.4, 5.6],
    ]) {
      const planterOuter = new THREE.BoxGeometry(pw, 0.34, pd);
      xform(planterOuter, [xCenter, 0.17, pzCenter]);
      graniteGeos.push(planterOuter);

      const planterLawn = new THREE.BoxGeometry(pw - 0.5, 0.38, pd - 0.5);
      xform(planterLawn, [xCenter, 0.19, pzCenter]);
      grassGeos.push(planterLawn);

      const planterMulch = new THREE.BoxGeometry(pw - 1.55, 0.40, pd - 1.65);
      xform(planterMulch, [xCenter, 0.20, pzCenter]);
      soilGeos.push(planterMulch);
    }

    const curb = new THREE.BoxGeometry(0.32, 0.42, 16.0);
    xform(curb, [sx * 6.0, 0.21, 7.2]);
    graniteGeos.push(curb);

    for (const lz of [11.0, 8.0, 5.0]) {
      const plinth = new THREE.BoxGeometry(0.38, 0.48, 0.38);
      xform(plinth, [sx * 6.0, 0.38, lz]);
      graniteGeos.push(plinth);

      const shaft = new THREE.CylinderGeometry(0.055, 0.07, 1.65, 8);
      xform(shaft, [sx * 6.0, 1.38, lz]);
      lampShaftGeos.push(shaft);

      const head = new THREE.BoxGeometry(0.24, 0.3, 0.24);
      xform(head, [sx * 6.0, 2.32, lz]);
      lampHeadGeos.push(head);

      // Lantern corner frame posts & base trim
      for (const fx of [-0.11, 0.11]) {
        for (const fz of [-0.11, 0.11]) {
          const post = new THREE.BoxGeometry(0.03, 0.32, 0.03);
          xform(post, [sx * 6.0 + fx, 2.32, lz + fz]);
          lampShaftGeos.push(post);
        }
      }
      const collar = new THREE.BoxGeometry(0.28, 0.05, 0.28);
      xform(collar, [sx * 6.0, 2.16, lz]);
      lampShaftGeos.push(collar);

      const cap = new THREE.ConeGeometry(0.22, 0.14, 4);
      xform(cap, [sx * 6.0, 2.53, lz], [0, Math.PI * 0.25, 0]);
      lampShaftGeos.push(cap);
    }
  }

  // Dressed granite tree planter curbs framing all sakura trees rooted in the stone plaza with dark mulch beds
  for (const [px, pz] of [
    [-8.6, 8.6],
    [4.8, 8.6],
    [-8.8, 5.4],
    [5.8, 6.9],
    [-9.2, 10.6],
    [7.6, 10.4],
    [3.8, 5.6],
  ]) {
    const pitCurb = new THREE.BoxGeometry(1.55, 0.18, 1.55);
    xform(pitCurb, [px, 0.16, pz]);
    graniteGeos.push(pitCurb);

    const pitSoil = new THREE.BoxGeometry(1.22, 0.21, 1.22);
    xform(pitSoil, [px, 0.17, pz]);
    soilGeos.push(pitSoil);
  }
  const lampShaftsMesh = new THREE.Mesh(mergeSafe(lampShaftGeos), palette.darkTimberMat);
  lampShaftsMesh.castShadow = true;
  lampShaftsMesh.receiveShadow = true;
  group.add(lampShaftsMesh);

  const lampHeadsMesh = new THREE.Mesh(mergeSafe(lampHeadGeos), palette.lampGlowMat);
  group.add(lampHeadsMesh);

  for (const sx of [-1, 1]) {
    for (const lz of [11.0, 8.0, 5.0]) {
      const halo = new THREE.Sprite(palette.lampHaloMat);
      halo.position.set(sx * 6.0, 2.34, lz);
      halo.scale.set(1.15, 1.15, 1);
      group.add(halo);
    }
  }

  // Tier 1 Terrace (Old Dormitory level) retaining walls & balustrades
  const tier1Body = new THREE.BoxGeometry(23.6, 2.02, 15.2);
  xform(tier1Body, [-3.6, 1.01, -3.2]);
  applyWorldPlanarUVs(tier1Body, 0.28, 0.34);
  ashlarGeos.push(tier1Body);

  const tier1EastCoping = new THREE.BoxGeometry(0.46, 0.16, 15.36);
  xform(tier1EastCoping, [8.14, 2.06, -3.2]);
  graniteGeos.push(tier1EastCoping);

  for (const tz of [-3.6, -1.2, 1.2, 3.6]) {
    const pil = new THREE.BoxGeometry(0.28, 2.08, 0.42);
    xform(pil, [8.22, 1.04, tz]);
    graniteGeos.push(pil);
  }

  const tier1Lawn = new THREE.BoxGeometry(23.2, 0.18, 14.8);
  xform(tier1Lawn, [-3.6, 1.97, -3.2]);
  grassGeos.push(tier1Lawn);

  const tier1BalustradeL = new THREE.BoxGeometry(13.9, 0.26, 0.22);
  xform(tier1BalustradeL, [-8.45, 2.26, 4.32]);
  graniteGeos.push(tier1BalustradeL);

  const tier1BalustradeR = new THREE.BoxGeometry(6.7, 0.26, 0.22);
  xform(tier1BalustradeR, [4.85, 2.26, 4.32]);
  graniteGeos.push(tier1BalustradeR);

  const tier1EastCurb = new THREE.BoxGeometry(0.18, 0.12, 5.92);
  xform(tier1EastCurb, [8.08, 2.20, 1.36]);
  graniteGeos.push(tier1EastCurb);
  const tier1EastRail = new THREE.BoxGeometry(0.22, 0.10, 5.98);
  xform(tier1EastRail, [8.08, 2.74, 1.36]);
  graniteGeos.push(tier1EastRail);
  const tier1PostZs = [-1.5, 0.45, 2.4, 4.28];
  tier1PostZs.forEach((pz, idx) => {
    const post = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    xform(post, [8.08, 2.48, pz]);
    graniteGeos.push(post);
    const cap = new THREE.BoxGeometry(0.28, 0.08, 0.28);
    xform(cap, [8.08, 2.82, pz]);
    graniteGeos.push(cap);
    if (idx < tier1PostZs.length - 1) {
      const zNext = tier1PostZs[idx + 1];
      for (let b = 1; b <= 3; b++) {
        const bz = THREE.MathUtils.lerp(pz, zNext, b / 4);
        const bal = new THREE.BoxGeometry(0.08, 0.46, 0.08);
        xform(bal, [8.08, 2.46, bz]);
        graniteGeos.push(bal);
      }
    }
  });

  const tier1CornerNewel = new THREE.BoxGeometry(0.32, 0.72, 0.32);
  xform(tier1CornerNewel, [-15.32, 2.42, 4.32]);
  graniteGeos.push(tier1CornerNewel);
  const tier1CornerCap = new THREE.BoxGeometry(0.38, 0.08, 0.38);
  xform(tier1CornerCap, [-15.32, 2.82, 4.32]);
  graniteGeos.push(tier1CornerCap);

  // Tier 2 Terrace (Lion Hill Crest / Old Library & Science Building level) with open central stair canyon at x=[-1.10, +1.10]
  const tier2BodyW = new THREE.BoxGeometry(13.1, 4.42, 15.0);
  xform(tier2BodyW, [-7.65, 2.21, -11.9]);
  applyWorldPlanarUVs(tier2BodyW, 0.46, 0.52);
  ashlarGeos.push(tier2BodyW);

  const tier2BodyE = new THREE.BoxGeometry(7.9, 4.42, 15.0);
  xform(tier2BodyE, [5.05, 2.21, -11.9]);
  applyWorldPlanarUVs(tier2BodyE, 0.46, 0.52);
  ashlarGeos.push(tier2BodyE);

  const tier2BodyCenterN = new THREE.BoxGeometry(2.2, 4.42, 13.3);
  xform(tier2BodyCenterN, [0.0, 2.21, -12.75]);
  applyWorldPlanarUVs(tier2BodyCenterN, 0.46, 0.52);
  ashlarGeos.push(tier2BodyCenterN);

  const tier2EastCoping = new THREE.BoxGeometry(0.56, 0.22, 15.28);
  xform(tier2EastCoping, [8.96, 4.42, -11.9]);
  graniteGeos.push(tier2EastCoping);

  const tier2EastLedge = new THREE.BoxGeometry(0.32, 0.24, 15.16);
  xform(tier2EastLedge, [9.06, 2.24, -11.9]);
  graniteGeos.push(tier2EastLedge);

  const tier2EastBasePlinth = new THREE.BoxGeometry(0.42, 0.56, 15.24);
  xform(tier2EastBasePlinth, [9.06, 0.28, -11.9]);
  graniteGeos.push(tier2EastBasePlinth);

  const tier2SouthCoping = new THREE.BoxGeometry(8.05, 0.22, 0.48);
  xform(tier2SouthCoping, [5.12, 4.42, -4.34]);
  graniteGeos.push(tier2SouthCoping);

  const tier2SouthCopingW = new THREE.BoxGeometry(13.25, 0.22, 0.48);
  xform(tier2SouthCopingW, [-7.72, 4.42, -4.34]);
  graniteGeos.push(tier2SouthCopingW);

  const tier2WestCoping = new THREE.BoxGeometry(0.52, 0.22, 13.6);
  xform(tier2WestCoping, [-14.06, 4.42, -11.0]);
  graniteGeos.push(tier2WestCoping);

  const tier2PilasterZs = [-18.9, -16.8, -14.7, -12.6, -10.5, -8.4, -6.4, -4.7];
  tier2PilasterZs.forEach((pz, pIdx) => {
    const pil = new THREE.BoxGeometry(0.34, 4.48, 0.48);
    xform(pil, [9.06, 2.24, pz]);
    graniteGeos.push(pil);

    const cap = new THREE.BoxGeometry(0.44, 0.18, 0.58);
    xform(cap, [9.06, 4.44, pz]);
    graniteGeos.push(cap);

    if (pIdx < tier2PilasterZs.length - 1) {
      const midZ = (pz + tier2PilasterZs[pIdx + 1]) * 0.5;
      const panel = new THREE.BoxGeometry(0.12, 1.56, 1.48);
      xform(panel, [9.03, 3.24, midZ]);
      applyWorldPlanarUVs(panel, 0.46, 0.52);
      ashlarGeos.push(panel);

      const lowerPanel = new THREE.BoxGeometry(0.12, 1.42, 1.48);
      xform(lowerPanel, [9.03, 1.28, midZ]);
      applyWorldPlanarUVs(lowerPanel, 0.46, 0.52);
      ashlarGeos.push(lowerPanel);
    }
  });
  for (const px of [-13.95, -11.6, -9.2, -6.8, -4.4, -2.0, 1.2, 3.8, 6.4, 8.85]) {
    const sPil = new THREE.BoxGeometry(0.46, 4.48, 0.32);
    xform(sPil, [px, 2.24, -4.34]);
    graniteGeos.push(sPil);
  }
  for (const wz of [-7.1, -10.2, -13.3, -16.4]) {
    const wPil = new THREE.BoxGeometry(0.34, 4.48, 0.46);
    xform(wPil, [-14.06, 2.24, wz]);
    graniteGeos.push(wPil);
  }

  const tier2LawnW = new THREE.BoxGeometry(12.7, 0.18, 14.6);
  xform(tier2LawnW, [-7.65, 4.48, -11.9]);
  grassGeos.push(tier2LawnW);
  const tier2LawnE = new THREE.BoxGeometry(7.5, 0.18, 14.6);
  xform(tier2LawnE, [5.05, 4.48, -11.9]);
  grassGeos.push(tier2LawnE);
  const tier2LawnCenterN = new THREE.BoxGeometry(2.2, 0.18, 12.9);
  xform(tier2LawnCenterN, [0.0, 4.48, -12.75]);
  grassGeos.push(tier2LawnCenterN);

  // Dressed granite perimeter walkway across the Tier 2 terrace south ridge & connecting Old Library + Science forecourt
  const tier2Forecourt = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.06, 3.2), palette.plazaMat);
  tier2Forecourt.position.set(-2.5, 4.565, -7.25);
  tier2Forecourt.receiveShadow = true;
  group.add(tier2Forecourt);
  const tier2WalkE = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.06, 1.35), palette.plazaMat);
  tier2WalkE.position.set(4.95, 4.565, -5.20);
  tier2WalkE.receiveShadow = true;
  group.add(tier2WalkE);
  const tier2WalkW = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.06, 1.35), palette.plazaMat);
  tier2WalkW.position.set(-7.50, 4.565, -5.20);
  tier2WalkW.receiveShadow = true;
  group.add(tier2WalkW);

  const tier2EastCurb = new THREE.BoxGeometry(0.22, 0.14, 14.4);
  xform(tier2EastCurb, [8.86, 4.62, -11.6]);
  graniteGeos.push(tier2EastCurb);
  const tier2EastRail = new THREE.BoxGeometry(0.26, 0.11, 14.46);
  xform(tier2EastRail, [8.86, 5.34, -11.6]);
  graniteGeos.push(tier2EastRail);

  const eastNewelZs = [...tier2PilasterZs, -4.45];
  eastNewelZs.forEach((pz, idx) => {
    const post = new THREE.BoxGeometry(0.26, 0.86, 0.26);
    xform(post, [8.86, 4.98, pz]);
    graniteGeos.push(post);
    const cap = new THREE.BoxGeometry(0.32, 0.10, 0.32);
    xform(cap, [8.86, 5.44, pz]);
    graniteGeos.push(cap);
    if (idx < eastNewelZs.length - 1) {
      const zNext = eastNewelZs[idx + 1];
      const count = Math.abs(zNext - pz) > 1.0 ? 3 : 1;
      for (let b = 1; b <= count; b++) {
        const bz = THREE.MathUtils.lerp(pz, zNext, b / (count + 1));
        const bal = new THREE.BoxGeometry(0.09, 0.54, 0.09);
        xform(bal, [8.86, 4.96, bz]);
        graniteGeos.push(bal);
      }
    }
  });

  const tier2SouthCurb = new THREE.BoxGeometry(7.72, 0.14, 0.22);
  xform(tier2SouthCurb, [5.03, 4.62, -4.45]);
  graniteGeos.push(tier2SouthCurb);
  const tier2SouthRail = new THREE.BoxGeometry(7.78, 0.11, 0.26);
  xform(tier2SouthRail, [5.03, 5.34, -4.45]);
  graniteGeos.push(tier2SouthRail);

  const southNewelXs = [1.2, 3.8, 6.4, 8.86];
  southNewelXs.forEach((px, idx) => {
    if (px < 8.8) {
      const post = new THREE.BoxGeometry(0.26, 0.86, 0.26);
      xform(post, [px, 4.98, -4.45]);
      graniteGeos.push(post);
      const cap = new THREE.BoxGeometry(0.32, 0.10, 0.32);
      xform(cap, [px, 5.44, -4.45]);
      graniteGeos.push(cap);
    }
    if (idx < southNewelXs.length - 1) {
      const xNext = southNewelXs[idx + 1];
      for (let b = 1; b <= 3; b++) {
        const bx = THREE.MathUtils.lerp(px, xNext, b / 4);
        const bal = new THREE.BoxGeometry(0.09, 0.54, 0.09);
        xform(bal, [bx, 4.96, -4.45]);
        graniteGeos.push(bal);
      }
    }
  });

  // Completed South-West & West-Return Balustrades terminating in a corner newel anchored into Lion Hill
  const tier2SouthCurbW = new THREE.BoxGeometry(12.8, 0.14, 0.22);
  xform(tier2SouthCurbW, [-7.60, 4.62, -4.45]);
  graniteGeos.push(tier2SouthCurbW);
  const tier2SouthRailW = new THREE.BoxGeometry(12.86, 0.11, 0.26);
  xform(tier2SouthRailW, [-7.60, 5.34, -4.45]);
  graniteGeos.push(tier2SouthRailW);

  const southWestNewelXs = [-13.95, -10.8, -7.6, -4.4, -1.2];
  southWestNewelXs.forEach((px, idx) => {
    const isCorner = idx === 0;
    const post = new THREE.BoxGeometry(isCorner ? 0.34 : 0.26, isCorner ? 0.94 : 0.86, isCorner ? 0.34 : 0.26);
    xform(post, [px, isCorner ? 5.02 : 4.98, -4.45]);
    graniteGeos.push(post);
    const cap = new THREE.BoxGeometry(isCorner ? 0.42 : 0.32, 0.10, isCorner ? 0.42 : 0.32);
    xform(cap, [px, isCorner ? 5.52 : 5.44, -4.45]);
    graniteGeos.push(cap);
    if (idx < southWestNewelXs.length - 1) {
      const xNext = southWestNewelXs[idx + 1];
      for (let b = 1; b <= 3; b++) {
        const bx = THREE.MathUtils.lerp(px, xNext, b / 4);
        const bal = new THREE.BoxGeometry(0.09, 0.54, 0.09);
        xform(bal, [bx, 4.96, -4.45]);
        graniteGeos.push(bal);
      }
    }
  });

  // Stairwell canyon side guardrails linking central arch stair landing cleanly to Tier 2 crest
  for (const sx of [-1.2, 1.2]) {
    const canyonCurb = new THREE.BoxGeometry(0.22, 0.14, 1.85);
    xform(canyonCurb, [sx, 4.62, -5.25]);
    graniteGeos.push(canyonCurb);
    const canyonRail = new THREE.BoxGeometry(0.26, 0.11, 1.85);
    xform(canyonRail, [sx, 5.34, -5.25]);
    graniteGeos.push(canyonRail);
    const endPost = new THREE.BoxGeometry(0.26, 0.86, 0.26);
    xform(endPost, [sx, 4.98, -6.12]);
    graniteGeos.push(endPost);
    const endCap = new THREE.BoxGeometry(0.32, 0.10, 0.32);
    xform(endCap, [sx, 5.44, -6.12]);
    graniteGeos.push(endCap);
    for (const bz of [-4.95, -5.55]) {
      const bal = new THREE.BoxGeometry(0.09, 0.54, 0.09);
      xform(bal, [sx, 4.96, bz]);
      graniteGeos.push(bal);
    }
  }

  const tier2WestCurb = new THREE.BoxGeometry(0.22, 0.14, 12.2);
  xform(tier2WestCurb, [-13.95, 4.62, -10.50]);
  graniteGeos.push(tier2WestCurb);
  const tier2WestRail = new THREE.BoxGeometry(0.26, 0.11, 12.26);
  xform(tier2WestRail, [-13.95, 5.34, -10.50]);
  graniteGeos.push(tier2WestRail);

  const westNewelZs = [-4.45, -7.5, -10.5, -13.5, -16.5];
  westNewelZs.forEach((pz, idx) => {
    if (idx > 0) {
      const isEnd = idx === westNewelZs.length - 1;
      const post = new THREE.BoxGeometry(isEnd ? 0.36 : 0.26, isEnd ? 1.02 : 0.86, isEnd ? 0.36 : 0.26);
      xform(post, [-13.95, isEnd ? 5.04 : 4.98, pz]);
      graniteGeos.push(post);
      const cap = new THREE.BoxGeometry(isEnd ? 0.44 : 0.32, 0.10, isEnd ? 0.44 : 0.32);
      xform(cap, [-13.95, isEnd ? 5.58 : 5.44, pz]);
      graniteGeos.push(cap);
    }
    if (idx < westNewelZs.length - 1) {
      const zNext = westNewelZs[idx + 1];
      for (let b = 1; b <= 3; b++) {
        const bz = THREE.MathUtils.lerp(pz, zNext, b / 4);
        const bal = new THREE.BoxGeometry(0.09, 0.54, 0.09);
        xform(bal, [-13.95, 4.96, bz]);
        graniteGeos.push(bal);
      }
    }
  });

  // Perimeter sloped hillside ridges
  const slopeConfigs = [
    { pos: [-17.5, 0.95, -5.0], rx: 6.2, rz: 10.5, h: 2.3 },
    { pos: [-11.5, 1.9, -15.6], rx: 8.5, rz: 5.2, h: 4.1 },
    { pos: [-1.0, 1.6, -18.4], rx: 12.6, rz: 5.8, h: 3.6 },
    { pos: [-17.2, 0.7, 6.8], rx: 5.2, rz: 6.8, h: 1.7 },
  ];
  const hillGeos = slopeConfigs.map((b) => {
    const g = new THREE.SphereGeometry(1.0, 20, 14);
    xform(g, [b.pos[0], b.pos[1] * 0.55, b.pos[2]], [0, 0, 0], [b.rx, b.h * 0.72, b.rz]);
    return g;
  });
  const hillSlopeMesh = new THREE.Mesh(mergeSafe(hillGeos), palette.hillMat);
  hillSlopeMesh.receiveShadow = true;
  hillSlopeMesh.castShadow = true;
  group.add(hillSlopeMesh);

  // Subtle serpentine woodland garden footpath across NW & N outer hillside (no bright white isolated rocks)
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const tx = THREE.MathUtils.lerp(-14.0, -46.0, t) + Math.sin(t * 4.5) * 3.2;
    const tz = THREE.MathUtils.lerp(18.0, -34.0, t) + Math.cos(t * 3.2) * 2.4;
    const th = luojiaHeight(tx, tz);
    if (th < 0.35) continue;
    const stepStone = new THREE.DodecahedronGeometry(0.62, 0);
    xform(stepStone, [tx, th - 0.02, tz], [0.1, i * 0.9, 0.05], [1.35, 0.14, 1.10]);
    graniteGeos.push(stepStone);
  }

  // Stone-rimmed mulch tree pits for Tier 2 forecourt sakura trees (Round 13 MINOR #1)
  for (const [tx, tz] of [[-4.6, -6.4], [-3.2, -7.2]]) {
    const pitCurb = new THREE.BoxGeometry(1.42, 0.16, 1.42);
    xform(pitCurb, [tx, 4.62, tz]);
    graniteGeos.push(pitCurb);
    const pitSoil = new THREE.BoxGeometry(1.12, 0.19, 1.12);
    xform(pitSoil, [tx, 4.63, tz]);
    soilGeos.push(pitSoil);
  }

  const graniteBatch = new THREE.Mesh(mergeSafe(graniteGeos), palette.graniteMat);
  graniteBatch.castShadow = true;
  graniteBatch.receiveShadow = true;
  group.add(graniteBatch);

  const ashlarBatch = new THREE.Mesh(mergeSafe(ashlarGeos), palette.ashlarMat);
  ashlarBatch.castShadow = true;
  ashlarBatch.receiveShadow = true;
  group.add(ashlarBatch);

  const grassBatch = new THREE.Mesh(mergeSafe(grassGeos), palette.grassMat);
  grassBatch.receiveShadow = true;
  group.add(grassBatch);

  const soilBatch = new THREE.Mesh(mergeSafe(soilGeos), palette.soilMat);
  soilBatch.receiveShadow = true;
  group.add(soilBatch);

  lockStatic(group);

  return {
    group,
    setMood() {},
  };
}
