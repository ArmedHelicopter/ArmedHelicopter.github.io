import * as THREE from 'three';

export const WATER_Y = 0.22;

export function smooth01(e0, e1, v) {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Assigns proportional world-space planar UVs to a box/extrude geometry before merging. */
export function applyWorldPlanarUVs(geo, scaleU = 0.28, scaleV = 0.28, swapHorizontal = false) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !nor || !uv) return geo;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    if (ny >= 0.5) {
      const u = (swapHorizontal ? z : x) * scaleU;
      const v = (swapHorizontal ? x : z) * scaleV;
      uv.setXY(i, u, v);
    } else if (nx >= 0.5) {
      uv.setXY(i, z * scaleU, y * scaleV);
    } else {
      uv.setXY(i, x * scaleU, y * scaleV);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Natural East Lake coastline x = shoreX(z): straight cove west wall at x=8.0, curving SSE/NNW outside bastions. */
export function shoreX(z) {
  if (z <= -15.2) {
    const t = Math.min(1, (-15.2 - z) / 152.0);
    return 26.4 - Math.sin(t * Math.PI * 0.7) * 9.0 + t * 14.0;
  }
  if (z >= 9.05) {
    const t = Math.min(1, (z - 9.05) / 158.0);
    return 31.4 + t * 52.0 + Math.sin(t * Math.PI) * 8.0;
  }
  return 8.0;
}

/** Ground elevation heightfield across Luojia Mountain & East Lake shoreline. */
export function luojiaHeight(x, z) {
  const dWest = Math.max(0, -16.5 - x);
  const dNorth = Math.max(0, -15.5 - z);
  const dSouth = Math.max(0, z - 39.2);
  const dCore = Math.hypot(dWest, dNorth, dSouth);

  let baseBank = -0.02;
  if (z <= -15.2 && x >= 8.0) {
    baseBank = 0.36;
  } else if (z <= -13.5 && x >= 8.0) {
    baseBank = THREE.MathUtils.lerp(-0.02, 0.36, smooth01(-13.5, -15.2, z));
  } else if (z >= 9.05 && x >= 13.8) {
    baseBank = THREE.MathUtils.lerp(-0.02, 0.36, smooth01(13.8, 15.2, x));
  }

  let h = baseBank;
  if (dCore > 0.001) {
    const tEnv = smooth01(0, 42, dCore);
    const hillEnv = tEnv * tEnv;
    const ridgeWave =
      2.6 +
      5.2 * hillEnv +
      2.1 * Math.sin(x * 0.055 + z * 0.032) +
      1.45 * Math.cos(x * 0.088 - z * 0.062) +
      0.85 * Math.sin(z * 0.135 - x * 0.042);
    const rawHill = THREE.MathUtils.lerp(baseBank, Math.max(1.2, ridgeWave), hillEnv);

    if (z < -15.2 || z > 9.05) {
      const distToShore = shoreX(z) - x;
      const bankEnv = smooth01(2.0, 14.0, distToShore);
      h = THREE.MathUtils.lerp(baseBank, rawHill, bankEnv);
    } else {
      h = rawHill;
    }
  }

  if (z <= -15.2 || z >= 9.05) {
    const sx = shoreX(z);
    if (x > sx - 0.15) {
      const dip = smooth01(sx - 0.15, sx + 1.6, x);
      h = THREE.MathUtils.lerp(h, -0.45, dip);
    }
  }
  return h;
}

/**
 * Shared procedural material & shader palette for all independent WHU campus components.
 */
export function createCampusPalette(textures) {
  const pavingMap = textures.paving('plaza-paving', [16, 22], '#e8e3d7', '#c9c3b7', 29);
  const avenueMap = textures.paving('avenue-paving', [6, 16], '#e0dbd1', '#c2bcb1', 37);
  const grassMap = textures.grass('luojia-grass', [22, 22], 53);
  const hillGrassMap = textures.grass('hill-grass', [10, 10], 67);
  const graniteMap = textures.granite('campus-granite', '#e6e0d4', 61);
  const warmStoneMap = textures.granite('warm-limestone', '#e3d9c6', 73);
  const ashlarMap = textures.ashlarStone('campus-ashlar', '#ded2be', 79);
  const pierConcreteMap = textures.concretePier('pier-concrete', 83);
  const barkMap = textures.bark('cherry-bark');
  const tileMaps = textures.glazedTiles('campus-glazed');
  const sakuraCanopyTex = textures.sakuraCanopy('sakura-canopy-vol', '#ffe8f0', '#ffc4d9', 88).map;
  const leafCanopyTex = textures.leafCanopy('leaf-canopy-vol', 91);
  const sakuraSprigTex = textures.sakuraSprig('sakura-sprig-rim', 901);
  const leafSprigTex = textures.leafSprig('leaf-sprig-rim', 922);
  const lampHaloTex = textures.bokehDot('lamp-halo-dot');

  const horizonColorUniform = { value: new THREE.Color('#cfe3f2') };
  const sharedTimeUniform = { value: 0 };
  const sunsetWarmthUniform = { value: 0.0 };
  const sunDirUniform = { value: new THREE.Vector3(-12, 28, 30).normalize() };
  const foliageSssIntensityUniform = { value: 1.0 };

  function attachOrganicGrass(mat, tintBright, tintDeep, withHorizonHaze = false) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassBright = { value: new THREE.Color(tintBright) };
      shader.uniforms.uGrassDeep = { value: new THREE.Color(tintDeep) };
      shader.uniforms.uHorizonColor = horizonColorUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vGrassWorld;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vGrassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
      let frag = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vGrassWorld;
           uniform vec3 uGrassBright;
           uniform vec3 uGrassDeep;
           uniform vec3 uHorizonColor;
           float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
           float gNoise(vec2 p) {
             vec2 i = floor(p); vec2 f = fract(p);
             vec2 u = f * f * (3.0 - 2.0 * f);
             return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
                        mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
           }`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           float nMacro = gNoise(vGrassWorld.xz * 0.14);
           float nMid = gNoise(vGrassWorld.xz * 0.48 + vec2(7.3, 4.1));
           float nMicro = gNoise(vGrassWorld.xz * 1.65 + vec2(2.1, 9.7));
           float patchMix = clamp(nMacro * 0.55 + nMid * 0.30 + nMicro * 0.15, 0.0, 1.0);
           vec3 organicTint = mix(uGrassDeep, uGrassBright, patchMix);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * organicTint * 1.48, 0.68);`
        );
      if (withHorizonHaze) {
        frag = frag.replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
           float hDist = length(cameraPosition - vGrassWorld);
           float hHaze = smoothstep(38.0, 114.0, hDist) * mix(0.45, 0.94, exp(-max(0.0, vGrassWorld.y - 0.2) * 0.08));
           gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizonColor, clamp(hHaze, 0.0, 0.92));`
        );
      }
      shader.fragmentShader = frag;
    };
  }

  function attachUnderwaterAbsorption(mat, waterY = WATER_Y) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sharedTimeUniform;
      shader.uniforms.uSunsetWarmth = sunsetWarmthUniform;
      shader.uniforms.uWaterY = { value: waterY };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vSubWorldPos;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vSubWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vSubWorldPos;
           uniform float uTime;
           uniform float uSunsetWarmth;
           uniform float uWaterY;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           if (vSubWorldPos.y < uWaterY + 0.34) {
             float damp = smoothstep(uWaterY + 0.34, uWaterY + 0.01, vSubWorldPos.y);
             diffuseColor.rgb *= mix(1.0, 0.56, damp);
           }
           if (vSubWorldPos.y < uWaterY) {
             float subDepth = uWaterY - vSubWorldPos.y;
             vec3 beer = exp(-subDepth * vec3(2.35, 0.82, 0.48));
             vec3 scatterTint = mix(vec3(0.06, 0.24, 0.30), vec3(0.14, 0.20, 0.32), uSunsetWarmth);
             vec2 cUv = vSubWorldPos.xz * 1.45;
             float c1 = sin(cUv.x * 2.1 + sin(cUv.y * 1.7 + uTime * 1.6)) * cos(cUv.y * 2.3 - uTime * 1.3);
             float c2 = sin((cUv.x + cUv.y) * 2.8 - uTime * 1.9);
             float caustic = pow(clamp(0.5 + 0.5 * (c1 * 0.6 + c2 * 0.4), 0.0, 1.0), 4.0) * exp(-subDepth * 1.8) * 0.22;
             diffuseColor.rgb = diffuseColor.rgb * beer + scatterTint * (1.0 - beer.r) * 0.45 + vec3(caustic);
           }`
        );
    };
  }

  function attachSakuraBacklight(mat, tintVec, sssAmp = 0.28, unflipDoubleSide = false) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirW = sunDirUniform;
      shader.uniforms.uSssTint = { value: tintVec };
      shader.uniforms.uSssAmp = { value: sssAmp };
      shader.uniforms.uFoliageSssScale = foliageSssIntensityUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vSakuraViewPos;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vSakuraViewPos = -mvPosition.xyz;`
        );
      let frag = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vSakuraViewPos;
           uniform vec3 uSunDirW;
           uniform vec3 uSssTint;
           uniform float uSssAmp;
           uniform float uFoliageSssScale;`
        );
      if (unflipDoubleSide) {
        frag = frag.replace(
          '#include <normal_fragment_begin>',
          `float faceDirection = 1.0;
           vec3 normal = normalize( vNormal );`
        );
      }
      frag = frag
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
           vec3 sunDirV_hl = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
           float wrapLit = clamp(dot(geometryNormal, sunDirV_hl) * 0.5 + 0.5, 0.0, 1.0);
           reflectedLight.directDiffuse += uSssTint * (pow(wrapLit, 1.7) * 0.14 * uFoliageSssScale);`
        )
        .replace(
          '#include <dithering_fragment>',
          `vec3 viewDirW = normalize(vSakuraViewPos);
           vec3 sunDirV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
           float backLit = pow(max(0.0, dot(viewDirW, -sunDirV)), 2.2);
           gl_FragColor.rgb += uSssTint * backLit * uSssAmp * uFoliageSssScale;
           #include <dithering_fragment>`
        );
      shader.fragmentShader = frag;
    };
  }

  const dormFacade = textures.facade('dorm-facade', {
    wall: '#efe5d4',
    cols: 4,
    rows: 3,
    arched: true,
    seed: 108,
  });
  dormFacade.map.repeat.set(2, 1);
  dormFacade.emissiveMap.repeat.set(2, 1);

  const libFacade = textures.facade('lib-facade', {
    wall: '#f2eadc',
    cols: 4,
    rows: 2,
    arched: false,
    seed: 209,
  });
  libFacade.map.repeat.set(2, 1);
  libFacade.emissiveMap.repeat.set(2, 1);

  const plazaMat = new THREE.MeshStandardMaterial({
    map: pavingMap,
    color: new THREE.Color('#e6e2da'),
    roughness: 0.84,
    metalness: 0.02,
  });

  const avenueMat = new THREE.MeshStandardMaterial({
    map: avenueMap,
    color: new THREE.Color('#e2ddd4'),
    roughness: 0.86,
    metalness: 0.02,
  });

  const grassMat = new THREE.MeshStandardMaterial({
    map: grassMap,
    color: new THREE.Color('#dfefd4'),
    roughness: 0.9,
    metalness: 0.02,
  });
  attachOrganicGrass(grassMat, '#9fc472', '#648b53');

  const hillMat = new THREE.MeshStandardMaterial({
    map: hillGrassMap,
    color: new THREE.Color('#c8dfc0'),
    roughness: 0.94,
    metalness: 0.01,
  });
  attachOrganicGrass(hillMat, '#8fb874', '#4a7054', true);

  const lakeBedMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#28362e'),
    roughness: 0.95,
    metalness: 0.02,
  });
  attachUnderwaterAbsorption(lakeBedMat, WATER_Y);

  const shoalMat = new THREE.MeshStandardMaterial({
    map: graniteMap,
    color: new THREE.Color('#2c3a32'),
    roughness: 0.94,
    metalness: 0.02,
  });
  attachUnderwaterAbsorption(shoalMat, WATER_Y);

  const graniteMat = new THREE.MeshStandardMaterial({
    map: graniteMap,
    color: new THREE.Color('#dedad0'),
    roughness: 0.78,
    metalness: 0.03,
  });
  attachUnderwaterAbsorption(graniteMat, WATER_Y);

  const warmStoneMat = new THREE.MeshStandardMaterial({
    map: warmStoneMap,
    color: new THREE.Color('#e4dac7'),
    roughness: 0.86,
    metalness: 0.01,
  });

  const ashlarMat = new THREE.MeshStandardMaterial({
    map: ashlarMap,
    color: new THREE.Color('#e6decf'),
    roughness: 0.78,
    metalness: 0.02,
  });
  attachUnderwaterAbsorption(ashlarMat, WATER_Y);

  const pierMat = new THREE.MeshStandardMaterial({
    map: pierConcreteMap,
    color: new THREE.Color('#dfd9cc'),
    roughness: 0.80,
    metalness: 0.03,
  });
  attachUnderwaterAbsorption(pierMat, WATER_Y);

  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a2326'),
    roughness: 0.78,
    metalness: 0.04,
  });

  const crimsonColumnMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8e3b46'),
    roughness: 0.58,
    metalness: 0.06,
  });

  const glazedTileMat = new THREE.MeshStandardMaterial({
    map: tileMaps.map,
    bumpMap: tileMaps.bumpMap,
    bumpScale: 0.02,
    color: new THREE.Color('#d8eeee'),
    emissive: new THREE.Color('#06323a'),
    emissiveIntensity: 0.04,
    roughness: 0.30,
    metalness: 0.10,
    envMapIntensity: 1.15,
  });

  const glazedRidgeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d5e66'),
    emissive: new THREE.Color('#072c33'),
    emissiveIntensity: 0.04,
    roughness: 0.38,
    metalness: 0.10,
    envMapIntensity: 1.1,
  });

  const dormWallMat = new THREE.MeshStandardMaterial({
    map: dormFacade.map,
    emissive: new THREE.Color('#ffbe78'),
    emissiveMap: dormFacade.emissiveMap,
    emissiveIntensity: 0.0,
    roughness: 0.72,
  });

  const libWallMat = new THREE.MeshStandardMaterial({
    map: libFacade.map,
    emissive: new THREE.Color('#ffc988'),
    emissiveMap: libFacade.emissiveMap,
    emissiveIntensity: 0.0,
    roughness: 0.68,
  });

  const barkMat = new THREE.MeshLambertMaterial({
    map: barkMap,
    color: new THREE.Color('#8f7268'),
  });

  const sakuraOuterMat = new THREE.MeshLambertMaterial({
    map: sakuraCanopyTex,
    color: new THREE.Color('#fff5f9'),
    emissive: new THREE.Color('#f4b4ca'),
    emissiveIntensity: 0.24,
  });
  attachSakuraBacklight(sakuraOuterMat, new THREE.Vector3(1.0, 0.88, 0.92), 0.30);

  const sakuraInnerMat = new THREE.MeshLambertMaterial({
    map: sakuraCanopyTex,
    color: new THREE.Color('#ffe0eb'),
    emissive: new THREE.Color('#e69ab6'),
    emissiveIntensity: 0.22,
  });
  attachSakuraBacklight(sakuraInnerMat, new THREE.Vector3(0.95, 0.74, 0.85), 0.24);

  const sakuraRimMat = new THREE.MeshLambertMaterial({
    map: sakuraSprigTex,
    color: new THREE.Color('#fff7fa'),
    emissive: new THREE.Color('#f4b2ca'),
    emissiveIntensity: 0.10,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  attachSakuraBacklight(sakuraRimMat, new THREE.Vector3(1.0, 0.88, 0.92), 0.26, true);

  const sakuraDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sakuraSprigTex,
    alphaTest: 0.42,
  });

  const camphorLeafMat = new THREE.MeshLambertMaterial({
    map: leafCanopyTex,
    color: new THREE.Color('#e8f6e0'),
    emissive: new THREE.Color('#426e48'),
    emissiveIntensity: 0.12,
  });
  attachSakuraBacklight(camphorLeafMat, new THREE.Vector3(0.58, 0.82, 0.48), 0.20);

  const camphorRimMat = new THREE.MeshLambertMaterial({
    map: leafSprigTex,
    color: new THREE.Color('#e8f6e0'),
    emissive: new THREE.Color('#426e48'),
    emissiveIntensity: 0.07,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  attachSakuraBacklight(camphorRimMat, new THREE.Vector3(0.58, 0.82, 0.48), 0.20, true);

  const camphorDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafSprigTex,
    alphaTest: 0.42,
  });

  const farForestMat = camphorRimMat.clone();
  farForestMat.color.set('#a8c492');
  farForestMat.emissive.set('#33563a');
  farForestMat.emissiveIntensity = 0.07;
  attachSakuraBacklight(farForestMat, new THREE.Vector3(0.55, 0.78, 0.48), 0.18, true);

  const farSakuraMat = sakuraRimMat.clone();
  farSakuraMat.color.set('#f6cedd');
  farSakuraMat.emissive.set('#bc7590');
  farSakuraMat.emissiveIntensity = 0.09;
  attachSakuraBacklight(farSakuraMat, new THREE.Vector3(0.95, 0.78, 0.88), 0.22, true);

  const lampHaloMat = new THREE.SpriteMaterial({
    map: lampHaloTex,
    color: new THREE.Color('#ffd38c'),
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const soilMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#48362a'),
    roughness: 0.96,
    metalness: 0.0,
  });

  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff5dd'),
    emissive: new THREE.Color('#ffd38c'),
    emissiveIntensity: 0.45,
    roughness: 0.26,
  });

  const roofMats = {
    tile: glazedTileMat,
    ridge: glazedRidgeMat,
    gable: warmStoneMat,
    fascia: crimsonColumnMat,
    soffit: darkTimberMat,
  };

  function setMood(mood) {
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    if (isNight) {
      sunDirUniform.value.set(28, 26, 6).normalize();
      sunsetWarmthUniform.value = 0.15;
      foliageSssIntensityUniform.value = 0.08;
      soilMat.color.set('#182034');
      dormWallMat.emissiveIntensity = 1.35;
      libWallMat.emissiveIntensity = 1.45;
      glazedTileMat.color.set('#cce6f8');
      glazedTileMat.roughness = 0.24;
      glazedTileMat.envMapIntensity = 1.48;
      glazedTileMat.emissive.set('#133858');
      glazedTileMat.emissiveIntensity = 0.24;
      glazedRidgeMat.color.set('#38869c');
      glazedRidgeMat.emissive.set('#1d4e74');
      glazedRidgeMat.emissiveIntensity = 0.36;
      // Warm dusty-rose neutral tint cancels blue night sky excess -> moonlit silvery-lavender sakura
      sakuraOuterMat.color.set('#c49eb2');
      sakuraInnerMat.color.set('#96788e');
      sakuraRimMat.color.set('#cbb0c2');
      sakuraOuterMat.emissive.set('#463852');
      sakuraInnerMat.emissive.set('#342840');
      sakuraRimMat.emissive.set('#4a3a56');
      sakuraOuterMat.emissiveIntensity = 0.15;
      sakuraInnerMat.emissiveIntensity = 0.14;
      sakuraRimMat.emissiveIntensity = 0.15;
      // Calibrated cool midnight sage-pine tones (~18% luminance, blends with indigo night lawn)
      camphorLeafMat.color.set('#4c6b6c');
      camphorRimMat.color.set('#4f7070');
      camphorLeafMat.emissive.set('#132436');
      camphorLeafMat.emissiveIntensity = 0.09;
      camphorRimMat.emissive.set('#142638');
      camphorRimMat.emissiveIntensity = 0.08;
      farForestMat.color.set('#3e5a5f');
      farForestMat.emissive.set('#101e30');
      farForestMat.emissiveIntensity = 0.07;
      farSakuraMat.color.set('#b496ac');
      farSakuraMat.emissive.set('#3c3048');
      farSakuraMat.emissiveIntensity = 0.13;
      horizonColorUniform.value.set('#274172');
      lampGlowMat.color.set('#ffcf78');
      lampGlowMat.emissive.set('#ffaa42');
      lampGlowMat.emissiveIntensity = 1.65;
      lampGlowMat.roughness = 0.24;
      lampHaloMat.color.set('#ffbe5e');
      lampHaloMat.opacity = 0.72;
    } else {
      sunDirUniform.value.set(-12, 28, 30).normalize();
      sunsetWarmthUniform.value = 0.55;
      foliageSssIntensityUniform.value = 1.0;
      soilMat.color.set('#48362a');
      dormWallMat.emissiveIntensity = 0.0;
      libWallMat.emissiveIntensity = 0.0;
      glazedTileMat.color.set('#d8eeee');
      glazedTileMat.roughness = 0.36;
      glazedTileMat.envMapIntensity = 0.95;
      glazedTileMat.emissive.set('#06323a');
      glazedTileMat.emissiveIntensity = 0.04;
      glazedRidgeMat.color.set('#1d5e66');
      glazedRidgeMat.emissive.set('#072c33');
      glazedRidgeMat.emissiveIntensity = 0.04;
      sakuraOuterMat.color.set('#fff5f9');
      sakuraInnerMat.color.set('#ffe0eb');
      sakuraRimMat.color.set('#fff7fa');
      sakuraOuterMat.emissive.set('#f4b4ca');
      sakuraInnerMat.emissive.set('#e69ab6');
      sakuraRimMat.emissive.set('#f4b2ca');
      sakuraOuterMat.emissiveIntensity = 0.20;
      sakuraInnerMat.emissiveIntensity = 0.14;
      sakuraRimMat.emissiveIntensity = 0.15;
      camphorLeafMat.color.set('#e8f6e0');
      camphorRimMat.color.set('#e8f6e0');
      camphorLeafMat.emissive.set('#426e48');
      camphorLeafMat.emissiveIntensity = 0.10;
      camphorRimMat.emissive.set('#426e48');
      camphorRimMat.emissiveIntensity = 0.07;
      farForestMat.color.set('#a8c492');
      farForestMat.emissive.set('#33563a');
      farForestMat.emissiveIntensity = 0.07;
      farSakuraMat.color.set('#f6cedd');
      farSakuraMat.emissive.set('#bc7590');
      farSakuraMat.emissiveIntensity = 0.09;
      horizonColorUniform.value.set('#f5d8b4');
      lampGlowMat.color.set('#e5dfd2');
      lampGlowMat.emissive.set('#ffd38c');
      lampGlowMat.emissiveIntensity = 0.02;
      lampGlowMat.roughness = 0.42;
      lampHaloMat.color.set('#ffdd99');
      lampHaloMat.opacity = 0.0;
    }
  }

  return {
    WATER_Y,
    graniteMap,
    horizonColorUniform,
    sharedTimeUniform,
    sunsetWarmthUniform,
    sunDirUniform,
    plazaMat,
    avenueMat,
    grassMat,
    hillMat,
    soilMat,
    lakeBedMat,
    shoalMat,
    graniteMat,
    warmStoneMat,
    ashlarMat,
    pierMat,
    darkTimberMat,
    crimsonColumnMat,
    glazedTileMat,
    glazedRidgeMat,
    dormWallMat,
    libWallMat,
    barkMat,
    sakuraOuterMat,
    sakuraInnerMat,
    sakuraRimMat,
    sakuraDepthMat,
    camphorLeafMat,
    camphorRimMat,
    camphorDepthMat,
    farForestMat,
    farSakuraMat,
    lampHaloMat,
    lampGlowMat,
    roofMats,
    setMood,
  };
}
