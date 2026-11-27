import * as THREE from 'three';
import {
  mergeSafe,
  xform,
  lockStatic,
  taperedTubeAlong,
  puffGeometry,
  crossedSprayGeometry,
  petalGeometry,
} from './geo.js';
import { mulberry32 } from './textures.js';
import { shoreX, luojiaHeight } from './materials.js';

/**
 * Independent component: Branching Yoshino Cherry Trees (樱花树), Luojia Camphor Forest (香樟林),
 * 480 Fallen Petals, 420 Fluttering Petals, and 180 Golden Bokeh Dust / Night Fireflies.
 */
export function createFoliageComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-sakura-foliage';

  const rand = mulberry32(20260325);
  const dummy = new THREE.Object3D();

  function buildBranchingTreeGeo(seed = 1, spread = 1.0) {
    const r = mulberry32(seed);
    const parts = [];
    const leanX = (r() - 0.5) * 0.42;
    const leanZ = (r() - 0.5) * 0.42;
    const midX = (r() - 0.5) * 0.22;
    const midZ = (r() - 0.5) * 0.22;

    // Graceful curved trunk with natural root buttress flares extending outward at ground level
    parts.push(
      taperedTubeAlong(
        [
          new THREE.Vector3(0, -0.08, 0),
          new THREE.Vector3(midX * 0.3, 0.24, midZ * 0.3),
          new THREE.Vector3(midX, 0.72, midZ),
          new THREE.Vector3(leanX * 0.72, 1.18, leanZ * 0.68),
          new THREE.Vector3(leanX, 1.54, leanZ),
        ],
        0.33,
        0.075,
        8,
        7
      )
    );
    for (let rf = 0; rf < 3; rf++) {
      const ra = (rf / 3) * Math.PI * 2 + r() * 0.7;
      parts.push(
        taperedTubeAlong(
          [
            new THREE.Vector3(Math.cos(ra) * 0.08, 0.26, Math.sin(ra) * 0.08),
            new THREE.Vector3(Math.cos(ra) * 0.28, 0.04, Math.sin(ra) * 0.28),
            new THREE.Vector3(Math.cos(ra) * 0.44, -0.06, Math.sin(ra) * 0.44),
          ],
          0.085,
          0.025,
          5,
          3
        )
      );
    }

    const twigTips = [];
    const boughCount = 4 + (seed % 2);
    for (let b = 0; b < boughCount; b++) {
      const ang = (b / boughCount) * Math.PI * 2 + (r() - 0.5) * 0.44;
      const reach = (0.94 + r() * 0.34) * spread;
      const startH = 1.15 + r() * 0.26;
      const midH = 1.92 + r() * 0.24;
      const topH = 2.42 + r() * 0.34;
      const bx = leanX + Math.cos(ang) * reach;
      const bz = leanZ + Math.sin(ang) * reach;
      const perp = ang + Math.PI * 0.5;
      const bend = (r() - 0.5) * 0.28;

      parts.push(
        taperedTubeAlong(
          [
            new THREE.Vector3(leanX * 0.85, startH, leanZ * 0.85),
            new THREE.Vector3(
              leanX + Math.cos(ang) * reach * 0.30 + Math.cos(perp) * bend * 0.5,
              1.66 + r() * 0.16,
              leanZ + Math.sin(ang) * reach * 0.30 + Math.sin(perp) * bend * 0.5
            ),
            new THREE.Vector3(
              leanX + Math.cos(ang) * reach * 0.68 + Math.cos(perp) * bend,
              midH + 0.16,
              leanZ + Math.sin(ang) * reach * 0.68 + Math.sin(perp) * bend
            ),
            new THREE.Vector3(bx, topH, bz),
          ],
          0.064,
          0.018,
          6,
          6
        )
      );
      twigTips.push([bx, topH, bz]);

      for (let st = -1; st <= 1; st += 2) {
        const subAng = ang + st * (0.48 + r() * 0.36);
        const subR = (0.36 + r() * 0.22) * spread;
        const midSubX = leanX + Math.cos(ang) * reach * 0.72 + Math.cos(subAng) * subR * 0.45;
        const midSubZ = leanZ + Math.sin(ang) * reach * 0.72 + Math.sin(subAng) * subR * 0.45;
        const sx = bx + Math.cos(subAng) * subR;
        const sy = topH + 0.05 + r() * 0.20;
        const sz = bz + Math.sin(subAng) * subR;
        parts.push(
          taperedTubeAlong(
            [
              new THREE.Vector3(leanX + Math.cos(ang) * reach * 0.68 + Math.cos(perp) * bend, midH + 0.14, leanZ + Math.sin(ang) * reach * 0.68 + Math.sin(perp) * bend),
              new THREE.Vector3(midSubX, topH + 0.06, midSubZ),
              new THREE.Vector3(sx, sy, sz),
            ],
            0.022,
            0.007,
            5,
            4
          )
        );
        twigTips.push([sx, sy, sz]);
      }
    }

    return { trunkGeo: mergeSafe(parts), twigTips };
  }

  const sakuraTreeCoords = [
    { pos: [-9.8, 0.15, 30.0], scale: 1.12 },
    { pos: [11.4, 0.15, 30.0], scale: 1.10 },
    { pos: [-10.0, 0.15, 22.8], scale: 1.14 },
    { pos: [12.2, 0.15, 22.8], scale: 1.10 },
    { pos: [-11.0, 0.15, 19.2], scale: 1.10 },
    { pos: [12.6, 0.15, 19.2], scale: 1.08 },
    { pos: [-10.8, 0.15, 15.8], scale: 1.08 },
    { pos: [12.4, 0.15, 15.8], scale: 1.06 },

    { pos: [-9.2, 0.1, 10.6], scale: 1.08 },
    { pos: [8.6, 0.1, 10.4], scale: 1.04 },
    { pos: [-11.0, 0.1, 10.2], scale: 1.06 },
    { pos: [9.8, 0.1, 11.6], scale: 1.04 },

    { pos: [-8.6, 0.1, 8.6], scale: 1.04 },
    { pos: [7.6, 0.1, 9.2], scale: 0.98 },
    { pos: [-10.2, 0.1, 8.2], scale: 1.02 },
    { pos: [8.2, 0.1, 8.0], scale: 0.96 },
    { pos: [-8.8, 0.15, 5.4], scale: 1.06 },
    { pos: [6.8, 0.15, 5.8], scale: 0.94 },
    { pos: [-10.2, 0.25, 5.0], scale: 1.04 },
    { pos: [7.4, 0.12, 6.9], scale: 0.94 },

    { pos: [-10.6, 2.15, 2.3], scale: 1.08 },
    { pos: [-12.4, 2.15, 0.6], scale: 1.04 },
    { pos: [-11.4, 2.15, -2.4], scale: 1.06 },

    { pos: [-11.8, 4.55, -6.0], scale: 1.02 },
    { pos: [-13.2, 4.55, -8.8], scale: 1.04 },
    { pos: [-13.2, 4.55, -14.6], scale: 1.02 },
    { pos: [-6.4, 4.55, -17.4], scale: 0.98 },
    { pos: [3.2, 4.55, -17.8], scale: 0.96 },
    { pos: [-4.6, 4.55, -6.4], scale: 0.96 },
    { pos: [-3.2, 4.55, -7.2], scale: 0.90 },
  ];

  const trunkGeos = [];
  const soilMoundGeos = [];
  const outerSprayMatrices = [];
  const innerSprayMatrices = [];
  const sakuraRimMatrices = [];
  const sakuraRimColors = [];
  const _sShadeBot = new THREE.Color('#cf7d9e');
  const _sShadeMid = new THREE.Color('#f7c4d8');
  const _sShadeTop = new THREE.Color('#ffffff');
  const _gShadeBot = new THREE.Color('#355c3c');
  const _gShadeMid = new THREE.Color('#669452');
  const _gShadeTop = new THREE.Color('#a8cb70');
  const _fShadeBot = new THREE.Color('#466c48');
  const _fShadeTop = new THREE.Color('#96ba64');

  function gradCrownColor(bot, mid, top, h01) {
    const t = THREE.MathUtils.clamp(h01, 0, 1);
    const out = new THREE.Color();
    if (t < 0.5) return out.lerpColors(bot, mid, t * 2);
    return out.lerpColors(mid, top, (t - 0.5) * 2);
  }

  sakuraTreeCoords.forEach((tree, idx) => {
    const s = tree.scale;
    const rotY = (idx * 1.73) % (Math.PI * 2);
    const { trunkGeo, twigTips } = buildBranchingTreeGeo(300 + idx, 1.0);
    xform(trunkGeo, tree.pos, [0, rotY, 0], [s, s, s]);
    trunkGeos.push(trunkGeo);

    const mound = new THREE.CylinderGeometry(0.28 * s, 0.56 * s, 0.11, 10);
    xform(mound, [tree.pos[0], tree.pos[1] + 0.03, tree.pos[2]]);
    soilMoundGeos.push(mound);

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const tr = mulberry32(700 + idx * 13);

    // Sculpted detail:2 multi-lobe botanical blossom clouds spaced cleanly around twigs + tiny feather accents
    const sprayAnchors = [...twigTips, [0, 2.94, 0], [0.28, 2.74, -0.22], [-0.26, 2.72, 0.24]];
    sprayAnchors.forEach((pt, pIdx) => {
      const lx = pt[0] + (tr() - 0.5) * 0.34;
      const ly = pt[1] + (tr() - 0.35) * 0.26;
      const lz = pt[2] + (tr() - 0.5) * 0.34;

      const wx = tree.pos[0] + (lx * cos - lz * sin) * s;
      const wy = tree.pos[1] + ly * s;
      const wz = tree.pos[2] + (lx * sin + lz * cos) * s;

      // Subtle inner depth puff recessed strictly inside forks + dense feathery alpha-tested exterior sprays
      if (pIdx % 4 === 0) {
        dummy.position.set(wx, wy - 0.08 * s, wz);
        dummy.rotation.set((tr() - 0.5) * 0.48, tr() * Math.PI * 2, (tr() - 0.5) * 0.48);
        const coreScale = (0.16 + tr() * 0.06) * s;
        dummy.scale.set(coreScale, coreScale * 0.85, coreScale);
        dummy.updateMatrix();
        innerSprayMatrices.push(dummy.matrix.clone());
      }

      // Layered feathery multi-plane alpha-tested blossom spray (unflipped soft canopy normals)
      dummy.position.set(wx, wy, wz);
      dummy.rotation.set((tr() - 0.5) * 0.40, tr() * Math.PI * 2, (tr() - 0.5) * 0.40);
      const rScale = (0.76 + tr() * 0.28) * s;
      dummy.scale.set(rScale, rScale * 0.84, rScale);
      dummy.updateMatrix();
      sakuraRimMatrices.push(dummy.matrix.clone());
      const sH01 = (ly - 1.75) / 1.25 + (-lx * 0.12 + lz * 0.18) * 0.35;
      sakuraRimColors.push(gradCrownColor(_sShadeBot, _sShadeMid, _sShadeTop, sH01));

      // Staggered offset outer blossom sprig for lacy floral perimeter
      const ly2 = ly + 0.08 + tr() * 0.18;
      dummy.position.set(
        wx + (tr() - 0.5) * 0.36 * s,
        wy + (ly2 - ly) * s,
        wz + (tr() - 0.5) * 0.36 * s
      );
      dummy.rotation.set((tr() - 0.5) * 0.42, tr() * Math.PI * 2, (tr() - 0.5) * 0.42);
      const r2Scale = (0.64 + tr() * 0.24) * s;
      dummy.scale.set(r2Scale, r2Scale * 0.82, r2Scale);
      dummy.updateMatrix();
      sakuraRimMatrices.push(dummy.matrix.clone());
      const sH02 = (ly2 - 1.75) / 1.25 + (-lx * 0.12 + lz * 0.18) * 0.35;
      sakuraRimColors.push(gradCrownColor(_sShadeBot, _sShadeMid, _sShadeTop, sH02));

      // Soften close-up sakura edges with an extra delicate wispy petal tuft on foreground trees
      if (tree.pos[2] > -2 && pIdx % 2 === 1) {
        dummy.position.set(
          wx + (tr() - 0.5) * 0.44 * s,
          wy + (tr() - 0.25) * 0.24 * s,
          wz + (tr() - 0.5) * 0.44 * s
        );
        dummy.rotation.set((tr() - 0.5) * 0.55, tr() * Math.PI * 2, (tr() - 0.5) * 0.55);
        const r3Scale = (0.48 + tr() * 0.18) * s;
        dummy.scale.set(r3Scale, r3Scale * 0.78, r3Scale);
        dummy.updateMatrix();
        sakuraRimMatrices.push(dummy.matrix.clone());
        sakuraRimColors.push(gradCrownColor(_sShadeBot, _sShadeMid, _sShadeTop, sH02 + 0.08));
      }
    });
  });

  const greenTreeCoords = [
    [-14.5, 0.1, 12.5, 1.3],
    [18.8, 0.1, 22.5, 1.22],
    [-14.8, 2.2, -3.5, 1.35],
    [-16.2, 3.6, -11.0, 1.4],
    [-12.2, 4.0, -19.8, 1.38],
    [-3.5, 4.0, -20.8, 1.42],
    [4.6, 3.4, -20.8, 1.38],
    [-15.5, 1.8, 5.5, 1.25],
    [-17.2, 0.2, 16.5, 1.2],
    [22.8, 0.1, 20.5, 1.22],
    [14.2, 0.1, -19.8, 1.24],
    [17.8, 0.1, -19.4, 1.22],
    [20.8, 0.1, -20.2, 1.18],
    [23.5, 0.1, -20.8, 1.16],
    [-21.5, 0, 24.0, 1.38],
    [-26.0, 0, 18.0, 1.44],
    [-31.0, 0, 10.5, 1.48],
    [-23.5, 0, 8.5, 1.36],
    [-27.5, 0, 0.5, 1.45],
    [-35.0, 0, -4.0, 1.52],
    [-24.0, 0, -8.5, 1.42],
    [-31.0, 0, -16.5, 1.50],
    [-21.0, 0, -21.0, 1.42],
    [-12.5, 0, -22.5, 1.44],
    [-4.5, 0, -23.0, 1.40],
    [5.0, 0, -22.0, 1.38],
    [13.5, 0, -23.5, 1.35],
    [21.0, 0, -24.0, 1.32],
    [-42.0, 0, 22.0, 1.55],
    [-46.0, 0, 6.0, 1.60],
    [-44.0, 0, -12.0, 1.58],
    [-38.0, 0, -28.0, 1.54],
    [-26.0, 0, -34.0, 1.52],
    [-14.0, 0, -36.0, 1.48],
    [-2.0, 0, -34.0, 1.46],
    [10.0, 0, -35.0, 1.42],
    [-24.0, 0, 32.0, 1.40],
    [-34.0, 0, 34.0, 1.48],
    [22.0, 0, 22.0, 1.34],
    [28.0, 0, 16.5, 1.30],
    [26.0, 0, 34.0, 1.34],
    [-46.0, 0, -40.0, 1.5],
    [-54.0, 0, -34.0, 1.52],
    [-60.0, 0, -26.0, 1.5],
    [-64.0, 0, -16.0, 1.46],
    [-56.0, 0, -44.0, 1.5],
    [-40.0, 0, -52.0, 1.48],
    [-24.0, 0, -56.0, 1.44],
    [-4.0, 0, -56.0, 1.4],
    [16.0, 0, -52.0, 1.36],
    [30.0, 0, -48.0, 1.32],
    [-50.0, 0, -8.0, 1.46],
    [-58.0, 0, 2.0, 1.42],
    [-52.0, 0, 14.0, 1.4],
    [-44.0, 0, 30.0, 1.38],
    [-36.0, 0, 42.0, 1.34],
    [30.0, 0, 24.0, 1.3],
    [40.0, 0, 20.0, 1.32],
    [48.0, 0, 16.0, 1.34],
  ];

  const camphorSprayMatrices = [];
  const camphorRimMatrices = [];
  const camphorRimColors = [];
  greenTreeCoords.forEach(([gx, gy, gz, gs], idx) => {
    if (gx > shoreX(gz) - 3.4 || (gz > -19.2 && gz < 13.2 && gx > 5.5)) return;
    // Prevent green camphor crowns from intersecting into nearby sakura blossom crowns
    const hitsSakura = sakuraTreeCoords.some(
      (st) => Math.hypot(gx - st.pos[0], gz - st.pos[2]) < 4.5
    );
    if (hitsSakura) return;
    const baseH = Math.max(gy, luojiaHeight(gx, gz) - 0.08);
    const { trunkGeo, twigTips } = buildBranchingTreeGeo(500 + idx, 0.92);
    const rotY = idx * 1.1;
    xform(trunkGeo, [gx, baseH, gz], [0, rotY, 0], [gs, gs, gs]);
    trunkGeos.push(trunkGeo);

    if (Math.hypot(gx, gz) < 62) {
      const mound = new THREE.CylinderGeometry(0.32 * gs, 0.64 * gs, 0.12, 10);
      xform(mound, [gx, baseH + 0.03, gz]);
      soilMoundGeos.push(mound);
    }

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const tr = mulberry32(950 + idx * 17);
    const anchors = [
      ...twigTips,
      [0, 3.05, 0],
      [0.28, 2.75, 0.28],
      [-0.28, 2.80, -0.24],
      [0.52, 2.15, 0.35],
      [-0.50, 2.10, -0.35],
      [0.0, 2.25, 0.45],
      [0.42, 2.65, -0.36],
      [-0.42, 2.55, 0.36],
    ];
    anchors.forEach((pt, pIdx) => {
      const lx = pt[0] + (tr() - 0.5) * 0.38;
      const ly = pt[1] + (tr() - 0.35) * 0.26;
      const lz = pt[2] + (tr() - 0.5) * 0.38;
      const wx = gx + (lx * cos - lz * sin) * gs;
      const wy = baseH + ly * gs;
      const wz = gz + (lx * sin + lz * cos) * gs;

      if (pIdx % 3 === 0) {
        dummy.position.set(wx, wy - 0.06 * gs, wz);
        dummy.rotation.set((tr() - 0.5) * 0.42, tr() * Math.PI * 2, (tr() - 0.5) * 0.42);
        const coreSc = (0.30 + tr() * 0.12) * gs;
        dummy.scale.set(coreSc, coreSc * 0.84, coreSc);
        dummy.updateMatrix();
        camphorSprayMatrices.push(dummy.matrix.clone());
      }

      dummy.position.set(wx, wy, wz);
      dummy.rotation.set((tr() - 0.5) * 0.38, tr() * Math.PI * 2, (tr() - 0.5) * 0.38);
      const r1Sc = (1.06 + tr() * 0.32) * gs;
      dummy.scale.set(r1Sc, r1Sc * 0.84, r1Sc);
      dummy.updateMatrix();
      camphorRimMatrices.push(dummy.matrix.clone());
      const gH01 = (ly - 1.70) / 1.35 + (-lx * 0.12 + lz * 0.18) * 0.35;
      camphorRimColors.push(gradCrownColor(_gShadeBot, _gShadeMid, _gShadeTop, gH01));

      const ly2 = ly + 0.10 + tr() * 0.18;
      dummy.position.set(wx + (tr() - 0.5) * 0.40 * gs, wy + (ly2 - ly) * gs, wz + (tr() - 0.5) * 0.40 * gs);
      dummy.rotation.set((tr() - 0.5) * 0.38, tr() * Math.PI * 2, (tr() - 0.5) * 0.38);
      const r2Sc = (0.92 + tr() * 0.28) * gs;
      dummy.scale.set(r2Sc, r2Sc * 0.82, r2Sc);
      dummy.updateMatrix();
      camphorRimMatrices.push(dummy.matrix.clone());
      const gH02 = (ly2 - 1.70) / 1.35 + (-lx * 0.12 + lz * 0.18) * 0.35;
      camphorRimColors.push(gradCrownColor(_gShadeBot, _gShadeMid, _gShadeTop, gH02));
    });

    // Root-base fern tuft grounding camphor trunk smoothly into hillside lawn
    if (Math.hypot(gx, gz) < 48) {
      dummy.position.set(gx + (tr() - 0.5) * 0.32, baseH + 0.18, gz + (tr() - 0.5) * 0.32);
      dummy.rotation.set(0, tr() * Math.PI * 2, 0);
      const fSc = 0.42 + tr() * 0.16;
      dummy.scale.set(fSc * 1.25, fSc * 0.62, fSc * 1.25);
      dummy.updateMatrix();
      camphorRimMatrices.push(dummy.matrix.clone());
      camphorRimColors.push(gradCrownColor(_gShadeBot, _gShadeMid, _gShadeTop, 0.22));
    }
  });

  const pavX = 9.25;
  const pavZ = -3.2;
  const shrubCoords = [
    [16.0, 0.42, -18.8, 1.15],
    [18.0, 0.42, -18.7, 1.12],
    [20.0, 0.42, -18.9, 1.1],
    // Waterside reeds & hillside shrubs tucked along East Lake shoreline curbs & boulders
    [25.6, 0.36, -15.3, 0.92],
    [23.8, 0.36, -15.4, 0.96],
    [29.8, 0.36, 9.4, 1.02],
    [27.4, 0.36, 9.6, 0.95],
    [24.2, 0.36, 9.8, 0.88],
    [32.2, 0.36, 11.2, 1.08],
  ];
  shrubCoords.forEach(([sx, sy, sz, ss], idx) => {
    const sr = mulberry32(1400 + idx * 29);
    for (let k = 0; k < 3; k++) {
      const px = sx + (sr() - 0.5) * 0.44;
      const py = sy + (sr() - 0.4) * 0.28;
      const pz = sz + (sr() - 0.5) * 0.64;
      const inPierBox = px >= 7.8 && px <= 20.0 && pz >= -9.2 && pz <= -6.4;
      const inPavRad = Math.hypot(px - pavX, pz - pavZ) < 2.25;
      const nearSeawall = pz > -17.2 && pz < 11.0 && px > 6.6 && py < 3.5;
      if (inPierBox || inPavRad || nearSeawall) continue;
      dummy.position.set(px, py, pz);
      dummy.rotation.set((sr() - 0.5) * 0.35, sr() * Math.PI * 2, (sr() - 0.5) * 0.35);
      const sc = (0.58 + sr() * 0.24) * ss;
      dummy.scale.set(sc * 1.15, sc * 0.78, sc * 1.15);
      dummy.updateMatrix();
      camphorRimMatrices.push(dummy.matrix.clone());
      camphorRimColors.push(gradCrownColor(_gShadeBot, _gShadeMid, _gShadeTop, 0.35 + k * 0.3));
    }
  });

  // Undergrowth hillside fern beds scattered across both NW and NE/E lakeside hillsides (MINOR #1)
  for (let i = 0; i < 95; i++) {
    const eastSide = i >= 65;
    const ux = eastSide ? 9.5 + rand() * 19.0 : -18.0 - rand() * 44.0;
    const uz = eastSide ? -36.0 + rand() * 20.0 : -46.0 + rand() * 76.0;
    if (ux > shoreX(uz) - 3.0) continue;
    const uh = luojiaHeight(ux, uz);
    if (uh < 0.38) continue;
    dummy.position.set(ux, uh + 0.20, uz);
    dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    const uSc = 0.62 + rand() * 0.44;
    dummy.scale.set(uSc * 1.25, uSc * 0.65, uSc * 1.25);
    dummy.updateMatrix();
    camphorRimMatrices.push(dummy.matrix.clone());
    camphorRimColors.push(gradCrownColor(_gShadeBot, _gShadeMid, _gShadeTop, 0.25 + (i % 3) * 0.25));
  }

  const allTrunksMesh = new THREE.Mesh(mergeSafe(trunkGeos), palette.barkMat);
  allTrunksMesh.castShadow = true;
  allTrunksMesh.receiveShadow = true;
  group.add(allTrunksMesh);

  if (soilMoundGeos.length > 0) {
    const soilMoundsMesh = new THREE.Mesh(mergeSafe(soilMoundGeos), palette.soilMat);
    soilMoundsMesh.receiveShadow = true;
    group.add(soilMoundsMesh);
  }

  const sprayCardGeo = puffGeometry({ detail: 2, seed: 42, lump: 0.24, freq: 2.4, flatten: 0.22, soften: 0.85 });
  const rimSprayGeo = crossedSprayGeometry(0.95, 4);
  const farSprayGeo = crossedSprayGeometry(1.62, 4);
  function buildFoliageInstanced(
    matrices,
    mat,
    depthMat,
    colPalette = null,
    { castShadow = true, receiveShadow = true, geo = sprayCardGeo, colors = null } = {}
  ) {
    const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
    inst.name = 'foliage';
    inst.castShadow = castShadow;
    inst.receiveShadow = receiveShadow;
    if (depthMat) inst.customDepthMaterial = depthMat;
    matrices.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    if (colors && colors.length === matrices.length) {
      for (let i = 0; i < matrices.length; i++) {
        inst.setColorAt(i, colors[i]);
      }
      inst.instanceColor.needsUpdate = true;
    } else if (colPalette && colPalette.length > 0) {
      const palCols = colPalette.map((hex) => new THREE.Color(hex));
      const colRand = mulberry32(4109);
      for (let i = 0; i < matrices.length; i++) {
        inst.setColorAt(i, palCols[Math.floor(colRand() * palCols.length)]);
      }
      inst.instanceColor.needsUpdate = true;
    }
    return inst;
  }

  if (outerSprayMatrices.length > 0) {
    const sakuraOuterInst = buildFoliageInstanced(
      outerSprayMatrices,
      palette.sakuraOuterMat,
      null,
      ['#ffffff', '#fff2f6', '#ffe6f0', '#ffdbe9'],
      { castShadow: false, receiveShadow: false }
    );
    group.add(sakuraOuterInst);
  }

  const sakuraInnerInst = buildFoliageInstanced(
    innerSprayMatrices,
    palette.sakuraInnerMat,
    null,
    ['#ffffff', '#fad4e2', '#f7cbdc', '#ffe6f0'],
    { castShadow: false, receiveShadow: false }
  );
  group.add(sakuraInnerInst);

  const camphorInst = buildFoliageInstanced(camphorSprayMatrices, palette.camphorLeafMat, null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  group.add(camphorInst);

  const sakuraRimInst = buildFoliageInstanced(
    sakuraRimMatrices,
    palette.sakuraRimMat,
    palette.sakuraDepthMat,
    null,
    { castShadow: true, receiveShadow: false, geo: rimSprayGeo, colors: sakuraRimColors }
  );
  group.add(sakuraRimInst);

  const camphorRimInst = buildFoliageInstanced(
    camphorRimMatrices,
    palette.camphorRimMat,
    palette.camphorDepthMat,
    null,
    { castShadow: true, receiveShadow: false, geo: rimSprayGeo, colors: camphorRimColors }
  );
  group.add(camphorRimInst);

  const farForestMatrices = [];
  const farForestColors = [];
  const farSakuraMatrices = [];
  const forestRand = mulberry32(20261125);
  for (let gx = -112; gx <= 56; gx += 3.5) {
    for (let gz = -96; gz <= 92; gz += 3.5) {
      if (farForestMatrices.length >= 2600) break;
      const fx = gx + (forestRand() - 0.5) * 2.2;
      const fz = gz + (forestRand() - 0.5) * 2.2;
      if (fx >= -19.5 && fx <= 15.5 && fz >= -19.5 && fz <= 40.5) continue;
      if (fx >= shoreX(fz) - 3.2) continue;
      const h = luojiaHeight(fx, fz);
      if (h <= 0.65) continue;
      const clearing =
        Math.sin(fx * 0.08 + 1.3) * Math.cos(fz * 0.07 - 0.7) + 0.3 * Math.sin((fx + fz) * 0.17);
      if (clearing <= -0.88) continue;

      const isInner = Math.abs(fx) < 58 && Math.abs(fz) < 58;
      const isCherryAccent = isInner && fx < -16 && fz < 28 && forestRand() < 0.085 && farSakuraMatrices.length < 180;
      const clusterCount = isInner ? 3 + (forestRand() > 0.5 ? 1 : 0) : 3;
      for (let c = 0; c < clusterCount && farForestMatrices.length < 2600; c++) {
        const px = fx + (forestRand() - 0.5) * 1.6;
        const pz = fz + (forestRand() - 0.5) * 1.6;
        if (pz > -18.0 && pz < 12.0 && px > 6.5) continue;
        const ph = luojiaHeight(px, pz);
        if (ph <= 0.58 || px >= shoreX(pz) - 2.6) continue;
        const py = ph + 0.36 + forestRand() * 0.72;
        dummy.position.set(px, py, pz);
        dummy.rotation.set(
          (forestRand() - 0.5) * 0.24,
          forestRand() * Math.PI * 2,
          (forestRand() - 0.5) * 0.24
        );
        const sc = (isInner ? 1.24 : 1.65) + forestRand() * 0.62;
        dummy.scale.set(sc * 1.28, sc * 0.78, sc * 1.28);
        dummy.updateMatrix();
        if (isCherryAccent) {
          farSakuraMatrices.push(dummy.matrix.clone());
        } else {
          farForestMatrices.push(dummy.matrix.clone());
          const fH01 = clusterCount > 1 ? c / (clusterCount - 1) : 0.6;
          farForestColors.push(new THREE.Color().lerpColors(_fShadeBot, _fShadeTop, fH01));
        }
      }
    }
  }
  const farForestInst = buildFoliageInstanced(
    farForestMatrices,
    palette.farForestMat,
    null,
    null,
    { castShadow: false, receiveShadow: false, geo: farSprayGeo, colors: farForestColors }
  );
  group.add(farForestInst);

  if (farSakuraMatrices.length > 0) {
    const farSakuraInst = buildFoliageInstanced(
      farSakuraMatrices,
      palette.farSakuraMat,
      null,
      ['#fff5f8', '#f8d4e2', '#eec2d4'],
      { castShadow: false, receiveShadow: false, geo: farSprayGeo }
    );
    group.add(farSakuraInst);
  }

  // Fallen Sakura Petals & 420 Fluttering Petals
  const petalGeo = petalGeometry(0.115);
  const petalMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color('#ffcadf'),
    emissive: new THREE.Color('#ffdce9'),
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });

  const fallenCount = 620;
  const fallenInst = new THREE.InstancedMesh(petalGeo, petalMat, fallenCount);
  for (let i = 0; i < fallenCount; i++) {
    let safeX;
    let pz;
    let py = 0.145;
    if (i < 420) {
      const px = (rand() - 0.5) * 20.0;
      pz = 4.6 + rand() * 25.0;
      safeX = pz <= 9.4 ? Math.min(px, 7.3) : px;
    } else {
      // Natural fallen blossom petal carpets concentrated around sakura tree bases
      const tr = sakuraTreeCoords[(i - 420) % sakuraTreeCoords.length];
      const ang = rand() * Math.PI * 2;
      const rad = 0.35 + rand() * 1.45;
      safeX = tr.pos[0] + Math.cos(ang) * rad;
      pz = tr.pos[2] + Math.sin(ang) * rad;
      py = tr.pos[1] + 0.04;
    }
    dummy.position.set(safeX, py, pz);
    dummy.rotation.set(-Math.PI / 2, 0, rand() * Math.PI * 2);
    const sc = 0.75 + rand() * 0.75;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    fallenInst.setMatrixAt(i, dummy.matrix);
  }
  fallenInst.instanceMatrix.needsUpdate = true;
  group.add(fallenInst);

  const airPetalCount = 420;
  const airPetals = new THREE.InstancedMesh(petalGeo, petalMat, airPetalCount);
  const petalState = Array.from({ length: airPetalCount }, () => {
    let x = (rand() - 0.5) * 26.0;
    const y = 0.6 + rand() * 11.5;
    const z = -12.0 + rand() * 40.0;
    if (x > 7.8 && y < 1.15) x -= 16.0;
    return {
      x,
      y,
      z,
      vx: 0.35 + rand() * 0.45,
      vy: 0.45 + rand() * 0.55,
      vz: 0.18 + rand() * 0.35,
      phase: rand() * Math.PI * 2,
      spin: 1.2 + rand() * 2.2,
      scale: 0.52 + rand() * 0.48,
    };
  });
  group.add(airPetals);

  // Subtle sun-mote & firefly bokeh strictly over land & canopy edges (never blurry grey discs on water)
  const bokehCount = 110;
  const bokehPositions = new Float32Array(bokehCount * 3);
  const bokehSeeds = Array.from({ length: bokehCount }, (_, idx) => {
    const r = mulberry32(8801 + idx * 31);
    const x = -18 + r() * 24.5;
    const y = 2.0 + r() * 8.5;
    const z = -15 + r() * 48;
    bokehPositions[idx * 3] = x;
    bokehPositions[idx * 3 + 1] = y;
    bokehPositions[idx * 3 + 2] = z;
    return { x, y, z, amp: 0.22 + r() * 0.35, spd: 0.6 + r() * 0.9, ph: r() * Math.PI * 2 };
  });
  const bokehGeo = new THREE.BufferGeometry();
  bokehGeo.setAttribute('position', new THREE.BufferAttribute(bokehPositions, 3));
  const bokehMat = new THREE.PointsMaterial({
    map: textures.bokehDot('firefly-dot'),
    size: 0.22,
    color: new THREE.Color('#ffe09c'),
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const bokehPoints = new THREE.Points(bokehGeo, bokehMat);
  bokehPoints.frustumCulled = false;
  group.add(bokehPoints);

  lockStatic(group);
  airPetals.matrixAutoUpdate = false;
  bokehPoints.matrixAutoUpdate = false;

  function setReflectionVisibility(visible) {
    airPetals.visible = visible;
    fallenInst.visible = visible;
    farForestInst.visible = visible;
    sakuraInnerInst.visible = visible;
  }

  function setMood(mood) {
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    if (isNight) {
      petalMat.color.set('#9ab0d8');
      petalMat.emissive.set('#4c5f8a');
      petalMat.emissiveIntensity = 0.16;
      petalMat.opacity = 0.72;
      bokehMat.color.set('#ffbe55');
      bokehMat.opacity = 0.68;
      bokehMat.size = 0.30;
    } else {
      petalMat.color.set('#ffd0dc');
      petalMat.emissive.set('#ffe2dc');
      petalMat.emissiveIntensity = 0.25;
      petalMat.opacity = 0.88;
      bokehMat.color.set('#ffe09c');
      bokehMat.opacity = 0.16;
      bokehMat.size = 0.22;
    }
  }

  function update(dt, elapsed, camPos = null) {
    for (let i = 0; i < airPetalCount; i++) {
      const p = petalState[i];
      p.y -= p.vy * dt;
      p.x += Math.sin(elapsed * 1.3 + p.phase) * p.vx * dt;
      p.z += Math.cos(elapsed * 1.1 + p.phase) * p.vz * dt;

      if (p.y < 0.25) {
        p.y = 10.5 + (i % 5) * 0.6;
      }
      if (p.x > 14) p.x = -14;
      if (p.x < -14) p.x = 14;
      if (p.x > 8.1 && p.y < 0.85) {
        p.x -= 16.0;
      }

      let nearFade = 1.0;
      if (p.x > 7.8 && p.y < 1.15) {
        nearFade *= THREE.MathUtils.clamp((p.y - 0.55) / 0.60, 0.0, 1.0);
      }
      if (camPos) {
        const dx = p.x - camPos.x;
        const dy = p.y - camPos.y;
        const dz = p.z - camPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 2.4) nearFade = 0.0;
        else if (dist < 4.8) nearFade *= (dist - 2.4) / 2.4;
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(
        elapsed * p.spin + p.phase,
        elapsed * p.spin * 0.7 + p.phase,
        Math.sin(elapsed * 2.0 + p.phase) * 0.8
      );
      dummy.scale.setScalar(p.scale * nearFade);
      dummy.updateMatrix();
      airPetals.setMatrixAt(i, dummy.matrix);
    }
    airPetals.instanceMatrix.needsUpdate = true;

    const bAttr = bokehGeo.attributes.position;
    for (let i = 0; i < bokehCount; i++) {
      const s = bokehSeeds[i];
      bAttr.setXYZ(
        i,
        s.x + Math.sin(elapsed * s.spd + s.ph) * s.amp,
        s.y + Math.sin(elapsed * s.spd * 0.7 + s.ph * 1.3) * (s.amp * 0.55),
        s.z + Math.cos(elapsed * s.spd * 0.85 + s.ph) * s.amp
      );
    }
    bAttr.needsUpdate = true;
  }

  return {
    group,
    setMood,
    update,
    setReflectionVisibility,
  };
}
