import * as THREE from 'three';
import { mergeSafe, xform, lockStatic } from './geo.js';

/**
 * Faithfully models the real National Wuhan University Archway (国立武汉大学牌坊):
 * 四柱三间冲天式 — four octagonal/chamfered white-granite columns piercing above the
 * lintel beams with carved multi-tier cloud-scroll finials (云纹柱头), eight sweeping
 * S-scroll drum-stone buttresses (抱鼓石) with raised circular relief medallions,
 * individual peacock-blue glazed cylindrical roof tiles (筒瓦 + 瓦当 + 滴水) with
 * upturned corner tips (飞檐), white stone corbel brackets, and carved traditional
 * right-to-left calligraphy "學 大 漢 武 立 國" (front) and "醫 農 工 理 法 文" (back).
 */
export function createArchway(textures) {
  const group = new THREE.Group();
  group.name = 'whu-archway';
  group.position.set(0, 0, 15.5);

  const graniteMap = textures.granite('archway-granite', '#f5f2ec', 17);
  graniteMap.repeat.set(2, 2);

  const rosetteBump = textures.rosette('archway-rosette');
  const tileMaps = textures.glazedTiles('archway-glazed', '#18889e');

  const frontPlaqueMap = textures.inscription('plaque-front', ['學', '大', '漢', '武', '立', '國']);
  const backPlaqueMap = textures.inscription('plaque-back', ['醫', '農', '工', '理', '法', '文']);

  const graniteMat = new THREE.MeshStandardMaterial({
    map: graniteMap,
    color: new THREE.Color('#faf8f4'),
    roughness: 0.62,
    metalness: 0.04,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c3c48'),
    roughness: 0.55,
    metalness: 0.12,
  });

  const rosetteMat = new THREE.MeshStandardMaterial({
    map: graniteMap,
    bumpMap: rosetteBump,
    bumpScale: 0.06,
    color: new THREE.Color('#f7f4ee'),
    roughness: 0.56,
    metalness: 0.05,
  });

  const glazedTileMat = new THREE.MeshStandardMaterial({
    map: tileMaps.map,
    bumpMap: tileMaps.bumpMap,
    bumpScale: 0.04,
    color: new THREE.Color('#2ba6b4'),
    emissive: new THREE.Color('#0c5c6b'),
    emissiveIntensity: 0.06,
    roughness: 0.22,
    metalness: 0.12,
    envMapIntensity: 1.2,
  });

  const frontPlaqueMat = new THREE.MeshStandardMaterial({
    map: frontPlaqueMap,
    roughness: 0.52,
    metalness: 0.04,
  });

  const backPlaqueMat = new THREE.MeshStandardMaterial({
    map: backPlaqueMap,
    roughness: 0.52,
    metalness: 0.04,
  });

  const graniteGeos = [];
  const trimGeos = [];
  const rosetteGeos = [];
  const glazedGeos = [];

  /* ---------------------------------------------------------------------- */
  /* 1. Four Chamfered Columns + Carved Multi-Ring Cloud Finials (云纹柱头) */
  /* ---------------------------------------------------------------------- */
  const colSpecs = [
    { x: -6.0, shaftH: 6.75, r: 0.34 },
    { x: -2.42, shaftH: 7.75, r: 0.38 },
    { x: 2.42, shaftH: 7.75, r: 0.38 },
    { x: 6.0, shaftH: 6.75, r: 0.34 },
  ];

  // Cross-section of chamfered square pillar
  function buildChamferedShaft(w, h) {
    const hw = w * 0.5;
    const c = w * 0.12;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + c, -hw);
    shape.lineTo(hw - c, -hw);
    shape.lineTo(hw, -hw + c);
    shape.lineTo(hw, hw - c);
    shape.lineTo(hw - c, hw);
    shape.lineTo(-hw + c, hw);
    shape.lineTo(-hw, hw - c);
    shape.lineTo(-hw, -hw + c);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 4,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // Sculpted cylindrical cloud-scroll capital finial (云纹柱头)
  function buildCloudFinial(radius, height) {
    const parts = [];
    // Lower collar molding
    const collar = new THREE.CylinderGeometry(radius * 1.12, radius * 1.06, 0.14, 16);
    xform(collar, [0, 0.07, 0]);
    parts.push(collar);

    // Main carved cylinder profile via LatheGeometry
    const lathePts = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = 0.14 + t * (height - 0.18);
      // 3 tiers of cloud bands + rounded dome cap
      let r = radius * 1.02;
      if (t < 0.84) {
        const band = Math.sin(t * Math.PI * 6.0);
        r += band * 0.024;
      } else {
        const u = (t - 0.84) / 0.16;
        r *= Math.cos(u * Math.PI * 0.46);
      }
      lathePts.push(new THREE.Vector2(Math.max(0.02, r), y));
    }
    parts.push(new THREE.LatheGeometry(lathePts, 18));

    // Vertical carved cloud-scroll relief ribs around the 3 tiers
    const tiers = [0.28, 0.54, 0.8];
    for (const ty of tiers) {
      const y = ty * height;
      const ring = new THREE.TorusGeometry(radius * 1.03, 0.022, 6, 16);
      xform(ring, [0, y, 0], [Math.PI / 2, 0, 0]);
      parts.push(ring);

      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const boss = new THREE.SphereGeometry(0.036, 6, 4);
        xform(
          boss,
          [Math.cos(ang) * radius * 1.02, y - 0.07, Math.sin(ang) * radius * 1.02],
          [0, -ang, 0],
          [0.8, 1.7, 0.55]
        );
        parts.push(boss);
      }
    }
    return mergeSafe(parts);
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Sweeping S-Scroll Drum-Stone Buttresses (抱鼓石)                    */
  /* ---------------------------------------------------------------------- */
  function buildDrumButtress(colX, dirZ, scale = 1.0) {
    // 2D profile in (z_local, y), extruded along X
    const thickness = 0.34 * scale;
    const L = 1.48 * scale;
    const H = 2.08 * scale;

    // Base stone plinth
    const plinth = new THREE.BoxGeometry(thickness + 0.16, 0.28, L + 0.14);
    xform(plinth, [colX, 0.14, dirZ * (0.28 + L * 0.5)]);
    graniteGeos.push(plinth);

    const subPlinth = new THREE.BoxGeometry(thickness + 0.08, 0.12, L + 0.06);
    xform(subPlinth, [colX, 0.32, dirZ * (0.28 + L * 0.5)]);
    graniteGeos.push(subPlinth);

    // Sweeping double-wave S-scroll profile matching whu_gate_front.jpg
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.36);
    shape.lineTo(L * 0.92, 0.36);
    // Outer round drum belly
    shape.bezierCurveTo(L * 1.05, 0.44, L * 1.06, 0.86, L * 0.86, 0.98);
    // First inward scroll notch
    shape.bezierCurveTo(L * 0.72, 1.04, L * 0.68, 1.18, L * 0.62, 1.32);
    // Second sweeping wave crest
    shape.bezierCurveTo(L * 0.54, 1.52, L * 0.38, 1.62, L * 0.32, 1.84);
    // Top cap lip against the column
    shape.bezierCurveTo(L * 0.28, 1.98, L * 0.16, H, 0, H);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 14,
    });
    // Extrude is in (x_shape=z_dist, y_shape=y, z_extrude=x_width)
    // Rotate so x_shape -> dirZ * z, z_extrude -> x centered at colX
    extrude.translate(0, 0, -thickness * 0.5);
    extrude.rotateY(dirZ > 0 ? -Math.PI / 2 : Math.PI / 2);
    extrude.translate(colX, 0, dirZ * 0.28);
    graniteGeos.push(extrude);

    // Raised circular relief medallions (抱鼓石浮雕圆盘) on left & right faces
    const medZ = dirZ * (0.28 + L * 0.58);
    const medY = 0.76 * scale;
    const medR = 0.34 * scale;

    const disc = new THREE.CylinderGeometry(medR, medR, thickness + 0.11, 18);
    xform(disc, [colX, medY, medZ], [0, 0, Math.PI / 2]);
    rosetteGeos.push(disc);

    for (const sx of [-1, 1]) {
      const ring = new THREE.TorusGeometry(medR * 0.96, 0.025, 6, 18);
      xform(ring, [colX + sx * (thickness * 0.5 + 0.045), medY, medZ], [0, Math.PI / 2, 0]);
      graniteGeos.push(ring);

      // Small spiral scroll boss at upper wave
      const scrollBoss = new THREE.TorusGeometry(0.13 * scale, 0.022, 6, 14);
      xform(
        scrollBoss,
        [colX + sx * (thickness * 0.5 + 0.025), 1.38 * scale, dirZ * (0.28 + L * 0.36)],
        [0, Math.PI / 2, 0]
      );
      graniteGeos.push(scrollBoss);
    }
  }

  colSpecs.forEach((col, idx) => {
    const isInner = idx === 1 || idx === 2;
    const w = col.r * 2;

    // Foot plinth block
    const baseBlock = new THREE.BoxGeometry(w + 0.24, 0.42, w + 0.24);
    xform(baseBlock, [col.x, 0.21, 0]);
    graniteGeos.push(baseBlock);

    // Chamfered shaft
    const shaft = buildChamferedShaft(w, col.shaftH);
    xform(shaft, [col.x, 0.38, 0]);
    graniteGeos.push(shaft);

    // Subtle vertical recessed grooves on front & back faces of column shaft
    for (const sz of [-1, 1]) {
      for (const gx of [-0.11, 0.11]) {
        const rib = new THREE.BoxGeometry(0.025, col.shaftH - 0.5, 0.025);
        xform(rib, [col.x + gx, 0.42 + (col.shaftH - 0.5) * 0.5, sz * (col.r + 0.005)]);
        graniteGeos.push(rib);
      }
    }

    // Carved cloud-scroll finial piercing the sky (冲天柱头)
    const finialH = isInner ? 1.35 : 1.18;
    const finial = buildCloudFinial(col.r * 0.95, finialH);
    xform(finial, [col.x, 0.38 + col.shaftH, 0]);
    graniteGeos.push(finial);

    // Front and back drum-stone buttresses
    const drumScale = isInner ? 1.05 : 0.94;
    buildDrumButtress(col.x, 1, drumScale);
    buildDrumButtress(col.x, -1, drumScale);
  });

  /* ---------------------------------------------------------------------- */
  /* 3. Horizontal Lintels, Parapets, and Glazed Peacock-Blue Tile Eaves    */
  /* ---------------------------------------------------------------------- */
  function buildGlazedEaveSpan({ xCenter, spanW, yEave, cantZ = 0.62, tubeCount = 26 }) {
    // Each bay has a front (+z) and back (-z) cantilevered glazed tile eave
    const halfSpan = spanW * 0.5;

    // White stone corbel brackets (雀替/托座) supporting the eave
    const bracketCount = Math.max(4, Math.round(spanW * 1.5));
    for (const sz of [-1, 1]) {
      for (let i = 0; i < bracketCount; i++) {
        const u = (i + 0.5) / bracketCount;
        const bx = xCenter - halfSpan * 0.92 + u * (spanW * 0.92);
        const corbel = new THREE.BoxGeometry(0.11, 0.16, 0.32);
        xform(corbel, [bx, yEave - 0.12, sz * 0.36]);
        graniteGeos.push(corbel);
      }

      // Continuous dark eave purlin bed
      const purlin = new THREE.BoxGeometry(spanW + 0.18, 0.09, 0.38);
      xform(purlin, [xCenter, yEave - 0.03, sz * 0.38]);
      trimGeos.push(purlin);

      // Sloping glazed roof bed & upturned corners
      const pitch = 0.24;
      for (let i = 0; i < tubeCount; i++) {
        const u = i / (tubeCount - 1); // 0..1 across span
        const s = u * 2 - 1; // -1..1
        const cornerLift = Math.pow(Math.abs(s), 3.2) * 0.16;
        const cornerFlare = s * Math.pow(Math.abs(s), 2.4) * 0.08;
        const tx = xCenter + s * (halfSpan + 0.06) + cornerFlare;

        // Cylindrical 筒瓦 tube
        const tubeLen = cantZ;
        const tube = new THREE.CylinderGeometry(0.042, 0.048, tubeLen, 6);
        const tiltX = sz * (Math.PI / 2 - 0.36 + cornerLift * 0.45);
        const midY = yEave + 0.11 + cornerLift * 0.65;
        const midZ = sz * (0.28 + tubeLen * 0.46);
        xform(tube, [tx, midY, midZ], [tiltX, 0, -s * cornerLift * 0.35]);
        glazedGeos.push(tube);

        // Circular 瓦当 end cap disc at outer tip of each tube
        const tipY = yEave + 0.03 + cornerLift * 0.92;
        const tipZ = sz * (0.28 + tubeLen * 0.88);
        const wadang = new THREE.CylinderGeometry(0.052, 0.052, 0.028, 8);
        xform(wadang, [tx, tipY, tipZ], [Math.PI / 2, 0, 0]);
        glazedGeos.push(wadang);

        // Concave pan tile (板瓦) and pointed drip-tile (滴水) between tubes
        if (i < tubeCount - 1) {
          const panX = tx + (spanW / (tubeCount - 1)) * 0.5;
          const pan = new THREE.BoxGeometry(spanW / tubeCount, 0.025, tubeLen * 0.92);
          xform(pan, [panX, midY - 0.03, midZ], [sz * 0.34, 0, 0]);
          glazedGeos.push(pan);

          const drip = new THREE.ConeGeometry(0.034, 0.07, 4);
          xform(drip, [panX, tipY - 0.035, tipZ], [Math.PI, Math.PI / 4, 0]);
          glazedGeos.push(drip);
        }
      }

      // Upturned flying corner ridge spine (飞檐翘角脊) at both ends of the eave
      for (const sx of [-1, 1]) {
        const horn = new THREE.ConeGeometry(0.065, 0.34, 6);
        xform(
          horn,
          [xCenter + sx * (halfSpan + 0.14), yEave + 0.24, sz * (0.28 + cantZ * 0.85)],
          [sz * 0.85, 0, -sx * 0.55]
        );
        glazedGeos.push(horn);
      }
    }

    // Glazed ridge capping connecting front & back eaves
    const crest = new THREE.CylinderGeometry(0.07, 0.07, spanW + 0.2, 6);
    xform(crest, [xCenter, yEave + 0.22, 0], [0, 0, Math.PI / 2]);
    glazedGeos.push(crest);
  }

  function buildArchwayBay({ xCenter, spanW, yBottom, yEave, yTop, isCentral }) {
    const beamDepth = 0.54;

    // Lower dark trim soffit border (matches dark underside molding in whu_gate_front.jpg)
    const soffit = new THREE.BoxGeometry(spanW + 0.04, 0.08, beamDepth + 0.06);
    xform(soffit, [xCenter, yBottom + 0.04, 0]);
    trimGeos.push(soffit);

    // Main stone lintel beam below the glazed eave
    const lintelH = yEave - (yBottom + 0.08);
    const lintel = new THREE.BoxGeometry(spanW + 0.02, lintelH, beamDepth);
    xform(lintel, [xCenter, yBottom + 0.08 + lintelH * 0.5, 0]);
    graniteGeos.push(lintel);

    // Molded string course frame on lintel
    const lowerLip = new THREE.BoxGeometry(spanW + 0.06, 0.07, beamDepth + 0.05);
    xform(lowerLip, [xCenter, yBottom + 0.13, 0]);
    graniteGeos.push(lowerLip);

    // Detailed peacock-blue glazed tile eaves on front & back
    buildGlazedEaveSpan({
      xCenter,
      spanW: spanW + (isCentral ? 0.18 : 0.1),
      yEave,
      cantZ: isCentral ? 0.66 : 0.56,
      tubeCount: isCentral ? 30 : 20,
    });

    // Upper white granite parapet beam ABOVE the glazed tile eave (a signature detail of WHU's archway!)
    const parapetY0 = yEave + 0.18;
    const parapetH = yTop - parapetY0;
    const parapet = new THREE.BoxGeometry(spanW + 0.02, parapetH, beamDepth * 0.88);
    xform(parapet, [xCenter, parapetY0 + parapetH * 0.5, 0]);
    graniteGeos.push(parapet);

    // Recessed vertical panel grooves on the upper parapet
    const panelCols = isCentral ? 8 : 5;
    for (let i = 1; i < panelCols; i++) {
      const gx = xCenter - spanW * 0.5 + (i / panelCols) * spanW;
      const groove = new THREE.BoxGeometry(0.03, parapetH * 0.72, beamDepth * 0.92);
      xform(groove, [gx, parapetY0 + parapetH * 0.5, 0]);
      graniteGeos.push(groove);
    }

    // Top cornice coping on upper parapet
    const coping = new THREE.BoxGeometry(spanW + 0.08, 0.1, beamDepth * 0.98);
    xform(coping, [xCenter, yTop + 0.04, 0]);
    graniteGeos.push(coping);
  }

  // Central bay: x = -2.42 .. +2.42 (clear span 4.84)
  buildArchwayBay({
    xCenter: 0,
    spanW: 4.46,
    yBottom: 4.52,
    yEave: 5.95,
    yTop: 6.82,
    isCentral: true,
  });

  // Left & Right side bays: x = ±2.42 .. ±6.0 (span 3.58)
  for (const sx of [-1, 1]) {
    buildArchwayBay({
      xCenter: sx * 4.21,
      spanW: 3.22,
      yBottom: 3.92,
      yEave: 5.22,
      yTop: 5.98,
      isCentral: false,
    });
  }

  // Assemble batched static meshes
  const graniteMesh = new THREE.Mesh(mergeSafe(graniteGeos), graniteMat);
  graniteMesh.castShadow = true;
  graniteMesh.receiveShadow = true;
  group.add(graniteMesh);

  const trimMesh = new THREE.Mesh(mergeSafe(trimGeos), darkTrimMat);
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  const rosetteMesh = new THREE.Mesh(mergeSafe(rosetteGeos), rosetteMat);
  rosetteMesh.castShadow = true;
  rosetteMesh.receiveShadow = true;
  group.add(rosetteMesh);

  const glazedMesh = new THREE.Mesh(mergeSafe(glazedGeos), glazedTileMat);
  glazedMesh.castShadow = true;
  glazedMesh.receiveShadow = true;
  group.add(glazedMesh);

  /* ---------------------------------------------------------------------- */
  /* 4. Carved Calligraphy Inscription Plaques (front & back)               */
  /* ---------------------------------------------------------------------- */
  const plaqueGeo = new THREE.PlaneGeometry(4.12, 1.06);
  const frontPlaque = new THREE.Mesh(plaqueGeo, frontPlaqueMat);
  frontPlaque.position.set(0, 5.26, 0.278);
  frontPlaque.receiveShadow = true;
  group.add(frontPlaque);

  const backPlaque = new THREE.Mesh(plaqueGeo, backPlaqueMat);
  backPlaque.position.set(0, 5.26, -0.278);
  backPlaque.rotation.y = Math.PI;
  backPlaque.receiveShadow = true;
  group.add(backPlaque);

  /* ---------------------------------------------------------------------- */
  /* 5. Spring Sakura Portal Light Veil (春风樱扉 — parts on flythrough)    */
  /* ---------------------------------------------------------------------- */
  const veilUniforms = {
    uTime: { value: 0 },
    uOpen: { value: 0 },
    uColorA: { value: new THREE.Color('#d8f0ff') },
    uColorB: { value: new THREE.Color('#ffc4dc') },
  };

  const veilMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: veilUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpen;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      void main() {
        // Soft vertical & horizontal fade so the campus behind stays visible
        float edgeY = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float edgeX = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float wave = 0.5 + 0.5 * sin(vUv.y * 8.0 - uTime * 1.4 + vUv.x * 4.0);
        vec3 col = mix(uColorA, uColorB, 0.45 + 0.35 * wave);
        float alpha = 0.08 * edgeX * edgeY * (1.0 - uOpen);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const leftVeil = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 4.35), veilMat);
  leftVeil.position.set(-1.04, 2.25, 0);
  group.add(leftVeil);

  const rightVeil = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 4.35), veilMat);
  rightVeil.position.set(1.04, 2.25, 0);
  group.add(rightVeil);

  lockStatic(group);
  // Allow the two veil panels to animate smoothly during flythrough
  leftVeil.matrixAutoUpdate = true;
  rightVeil.matrixAutoUpdate = true;

  function setMood(mood) {
    if (mood === 'night' || mood === 'sunset' || mood === 'convergence') {
      veilUniforms.uColorA.value.set('#89a8de');
      veilUniforms.uColorB.value.set('#ffb85c');
      glazedTileMat.color.set('#1f687a');
      glazedTileMat.emissiveIntensity = 0.08;
    } else {
      veilUniforms.uColorA.value.set('#ffe2a8');
      veilUniforms.uColorB.value.set('#ffcad9');
      glazedTileMat.color.set('#2ba6b4');
      glazedTileMat.emissiveIntensity = 0.06;
    }
  }

  function updatePortal(openProgress = 0, elapsed = 0) {
    const p = THREE.MathUtils.clamp(openProgress, 0, 1);
    veilUniforms.uTime.value = elapsed;
    veilUniforms.uOpen.value = p;
    const slide = p * 1.85;
    leftVeil.position.x = -1.04 - slide;
    rightVeil.position.x = 1.04 + slide;
    leftVeil.visible = p < 0.99;
    rightVeil.visible = p < 0.99;
  }

  return {
    group,
    setMood,
    updatePortal,
  };
}
