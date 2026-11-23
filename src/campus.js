import * as THREE from 'three';
import {
  mergeSafe,
  xform,
  lockStatic,
  roofGroup,
  taperedTubeAlong,
  crossedSprayGeometry,
  petalGeometry,
} from './geo.js';
import { mulberry32 } from './textures.js';

/**
 * Builds the sunlit springtime Wuhan University (WHU) 3D campus diorama:
 * - White-granite Archway Plaza, Sakura Avenue (樱花大道), and tiered Luojia Mountain terrain
 * - Old Dormitory (老斋舍) with 3 extruded Roman arched gates, 3 curved peacock-blue
 *   hip-and-gable pavilions (歇山顶), and the 108-step staircase (百步梯)
 * - Old Library (樱顶老图书馆) on Lion Hill with double-eave curved hip-and-gable roof
 *   (重檐歇山顶), front entrance porch, stone balustrades, and 5-ringed turquoise finial (宝顶)
 * - Flanking Cherry Crest courtyard wings (樱顶文理侧翼)
 * - East Lake (东湖) with custom GLSL animated water shader & Lingbo Pier (凌波门水上栈桥)
 * - Sculptural branching cherry blossom trees crowned with petal-textured multi-tone sakura clouds,
 *   420 fluttering 3D sakura petals (樱吹雪), and 480 fallen petals dusting the stone plaza
 */
export function createCampusDiorama(textures) {
  const group = new THREE.Group();
  group.name = 'whu-campus-diorama';

  const rand = mulberry32(20260325);

  /* ---------------------------------------------------------------------- */
  /* 1. Shared Procedural Textures & Materials                              */
  /* ---------------------------------------------------------------------- */
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
  const sakuraSprigTex = textures.sakuraSprig('sakura-sprig', 901);
  const leafSprigTex = textures.leafSprig('leaf-sprig', 922);

  /** Assigns proportional world-space planar UVs to a box/extrude geometry before merging. */
  function applyWorldPlanarUVs(geo, scaleU = 0.28, scaleV = 0.28, swapHorizontal = false) {
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

  const WATER_Y = 0.22;
  const horizonColorUniform = { value: new THREE.Color('#f7ebf2') };
  const sharedTimeUniform = { value: 0 };
  const sunsetWarmthUniform = { value: 0.0 };

  /** Injects world-space multi-scale organic meadow color variation (+ optional horizon haze) into grass/hill materials. */
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
           diffuseColor.rgb = mix(diffuseColor.rgb, organicTint, 0.55);`
        );
      if (withHorizonHaze) {
        frag = frag.replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
           float hDist = length(cameraPosition - vGrassWorld);
           float hHaze = smoothstep(76.0, 160.0, hDist) * mix(0.45, 1.0, exp(-max(0.0, vGrassWorld.y - 0.2) * 0.06));
           gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizonColor, clamp(hHaze, 0.0, 0.94));`
        );
      }
      shader.fragmentShader = frag;
    };
  }

  /** Injects distance-based aerial perspective blending cleanly into skyDome uHorizon. */
  function attachHorizonHaze(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHorizonColor = horizonColorUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vHazeWorld;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vHazeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vHazeWorld;
           uniform vec3 uHorizonColor;`
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
           float hDist = length(cameraPosition - vHazeWorld);
           float hHaze = smoothstep(76.0, 160.0, hDist) * mix(0.42, 1.0, exp(-max(0.0, vHazeWorld.y - 0.2) * 0.055));
           gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizonColor, clamp(hHaze, 0.0, 0.94));`
        );
    };
  }

  /** Injects physical Beer-Lambert underwater absorption & animated caustics below WATER_Y. */
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
           if (vSubWorldPos.y < uWaterY + 0.04) {
             float damp = smoothstep(uWaterY + 0.04, uWaterY - 0.005, vSubWorldPos.y);
             diffuseColor.rgb *= mix(1.0, 0.78, damp);
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

  const dormFacade = textures.facade('dorm-facade', {
    wall: '#efe5d4',
    cols: 6,
    rows: 3,
    arched: true,
    seed: 108,
  });
  dormFacade.map.repeat.set(3, 1);
  dormFacade.emissiveMap.repeat.set(3, 1);

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
    color: new THREE.Color('#faf7f2'),
    roughness: 0.78,
    metalness: 0.03,
  });

  const avenueMat = new THREE.MeshStandardMaterial({
    map: avenueMap,
    color: new THREE.Color('#f5f1ea'),
    roughness: 0.8,
    metalness: 0.03,
  });

  const grassMat = new THREE.MeshStandardMaterial({
    map: grassMap,
    color: new THREE.Color('#cde2c6'),
    roughness: 0.9,
    metalness: 0.02,
  });
  attachOrganicGrass(grassMat, '#86ba71', '#5a8c54');

  const hillMat = new THREE.MeshStandardMaterial({
    map: hillGrassMap,
    color: new THREE.Color('#b0cba8'),
    roughness: 0.94,
    metalness: 0.01,
  });
  attachOrganicGrass(hillMat, '#75a864', '#4d7a49', true);

  const lakeBedMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a7d84'),
    roughness: 0.92,
    metalness: 0.02,
  });
  attachUnderwaterAbsorption(lakeBedMat, WATER_Y);

  const shoalMat = new THREE.MeshStandardMaterial({
    map: graniteMap,
    color: new THREE.Color('#9dbdb9'),
    roughness: 0.88,
    metalness: 0.02,
  });
  attachUnderwaterAbsorption(shoalMat, WATER_Y);

  const graniteMat = new THREE.MeshStandardMaterial({
    map: graniteMap,
    color: new THREE.Color('#f7f4ee'),
    roughness: 0.65,
    metalness: 0.04,
  });
  attachUnderwaterAbsorption(graniteMat, WATER_Y);

  const warmStoneMat = new THREE.MeshStandardMaterial({
    map: warmStoneMap,
    color: new THREE.Color('#f1e8d8'),
    roughness: 0.68,
    metalness: 0.04,
  });

  const ashlarMat = new THREE.MeshStandardMaterial({
    map: ashlarMap,
    color: new THREE.Color('#f2ebde'),
    roughness: 0.72,
    metalness: 0.03,
  });

  const pierMat = new THREE.MeshStandardMaterial({
    map: pierConcreteMap,
    color: new THREE.Color('#efede8'),
    roughness: 0.72,
    metalness: 0.04,
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

  const glazedTileMat = new THREE.MeshPhysicalMaterial({
    map: tileMaps.map,
    bumpMap: tileMaps.bumpMap,
    bumpScale: 0.04,
    color: new THREE.Color('#2ba6b4'),
    emissive: new THREE.Color('#0c5c6b'),
    emissiveIntensity: 0.06,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.92,
    clearcoatRoughness: 0.14,
  });

  const glazedRidgeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2eb3c4'),
    emissive: new THREE.Color('#0e5866'),
    emissiveIntensity: 0.05,
    roughness: 0.24,
    metalness: 0.1,
    clearcoat: 0.85,
  });

  const dormWallMat = new THREE.MeshStandardMaterial({
    map: dormFacade.map,
    emissive: new THREE.Color('#ffbe78'),
    emissiveMap: dormFacade.emissiveMap,
    emissiveIntensity: 0.12,
    roughness: 0.7,
  });

  const libWallMat = new THREE.MeshStandardMaterial({
    map: libFacade.map,
    emissive: new THREE.Color('#ffc988'),
    emissiveMap: libFacade.emissiveMap,
    emissiveIntensity: 0.14,
    roughness: 0.66,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    color: new THREE.Color('#aa8e85'),
    roughness: 0.86,
    metalness: 0.02,
  });

  // Translucent botanical sakura materials (with subtle sunlit backlight scattering)
  const sunDirUniform = { value: new THREE.Vector3(28, 22, 19).normalize() };
  function attachSakuraBacklight(mat, tintVec) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirW = sunDirUniform;
      shader.uniforms.uSssTint = { value: tintVec };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uSunDirW;
           uniform vec3 uSssTint;`
        )
        .replace(
          '#include <dithering_fragment>',
          `vec3 viewDirW = normalize(vViewPosition);
           vec3 sunDirV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
           float backLit = pow(max(0.0, dot(viewDirW, -sunDirV)), 2.5);
           gl_FragColor.rgb += uSssTint * backLit * 0.26;
           #include <dithering_fragment>`
        );
    };
  }

  const sakuraOuterMat = new THREE.MeshStandardMaterial({
    map: sakuraSprigTex,
    color: new THREE.Color('#fff9fc'),
    emissive: new THREE.Color('#ffe6f0'),
    emissiveIntensity: 0.11,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.0,
  });
  attachSakuraBacklight(sakuraOuterMat, new THREE.Vector3(1.0, 0.86, 0.92));

  const sakuraInnerMat = new THREE.MeshStandardMaterial({
    map: sakuraSprigTex,
    color: new THREE.Color('#ffdbe9'),
    emissive: new THREE.Color('#ffbfd8'),
    emissiveIntensity: 0.14,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.76,
    metalness: 0.0,
  });
  attachSakuraBacklight(sakuraInnerMat, new THREE.Vector3(0.95, 0.72, 0.84));

  const sakuraDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sakuraSprigTex,
    alphaTest: 0.36,
  });

  const camphorLeafMat = new THREE.MeshStandardMaterial({
    map: leafSprigTex,
    color: new THREE.Color('#e8f4e3'),
    emissive: new THREE.Color('#27482d'),
    emissiveIntensity: 0.08,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0.0,
  });

  const camphorDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafSprigTex,
    alphaTest: 0.42,
  });

  const roofMats = {
    tile: glazedTileMat,
    ridge: glazedRidgeMat,
    gable: warmStoneMat,
    fascia: crimsonColumnMat,
    soffit: darkTimberMat,
  };

  const graniteGeos = [];
  const warmStoneGeos = [];
  const ashlarGeos = [];
  const pierGeos = [];
  const grassGeos = [];

  /* ---------------------------------------------------------------------- */
  /* 2. Continuous Luojia Mainland Terrain, Sunlit Plaza & Terraces         */
  /* ---------------------------------------------------------------------- */
  function smooth01(e0, e1, v) {
    const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  // Natural East Lake coastline x = shoreX(z): straight cove west wall at x=8.0, curving SSE/NNW outside bastions
  function shoreX(z) {
    if (z < -15.2) {
      const t = Math.min(1, (-15.2 - z) / 152.0);
      return 26.4 - Math.sin(t * Math.PI * 0.7) * 9.0 + t * 14.0;
    }
    if (z > 9.05) {
      const t = Math.min(1, (z - 9.05) / 158.0);
      return 31.4 + t * 52.0 + Math.sin(t * Math.PI) * 8.0;
    }
    return 8.0;
  }

  function luojiaHeight(x, z) {
    const dWest = Math.max(0, -16.5 - x);
    const dNorth = Math.max(0, -15.5 - z);
    const dSouth = Math.max(0, z - 39.2);
    const dCore = Math.hypot(dWest, dNorth, dSouth);

    let baseBank = -0.02;
    if (z <= -15.2 && x >= 8.0) {
      baseBank = 0.36;
    } else if (z >= 9.05 && x >= 13.8) {
      baseBank = THREE.MathUtils.lerp(-0.02, 0.36, smooth01(13.8, 15.2, x));
    }

    let h = baseBank;
    if (dCore > 0.001) {
      const hillEnv = smooth01(0, 36, dCore);
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
        const dip = smooth01(sx - 0.15, sx + 0.35, x);
        h = THREE.MathUtils.lerp(h, -0.35, dip);
      }
    }
    return h;
  }

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
        // Concentrate resolution toward eastern campus & shoreline
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

  // Ensure monotonically increasing Z from -172 to -15.2 with denser rows near -15.2
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

  const mainlandGeos = [
    buildTerrainBlock(northZList, 36, -172.0, (z) => shoreX(z) + 0.35),
    buildTerrainBlock(westZList, 32, -172.0, () => 8.0),
    buildTerrainBlock(southZList, 36, -172.0, (z) => shoreX(z) + 0.35),
  ];
  const mainlandMesh = new THREE.Mesh(mergeSafe(mainlandGeos), hillMat);
  mainlandMesh.receiveShadow = true;
  group.add(mainlandMesh);

  // Flat inner campus grass apron strictly West of East Lake (x <= 8.0 in cove, x <= 14.2 south)
  const campusLawnShape = new THREE.Shape();
  campusLawnShape.moveTo(-18.5, -39.0);
  campusLawnShape.lineTo(14.2, -39.0);
  campusLawnShape.lineTo(14.2, -9.05);
  campusLawnShape.lineTo(8.0, -9.05);
  campusLawnShape.lineTo(8.0, 15.2);
  campusLawnShape.lineTo(-18.5, 15.2);
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

  // Split Archway Plaza into two non-overlapping slabs strictly clear of East Lake (x >= 8.0, z <= 9.0):
  // 1) South Foreground Plaza (z ∈ [9.2, 38.5], strictly south of the south seawall)
  const plazaSouth = new THREE.BoxGeometry(27.6, 0.24, 29.3);
  xform(plazaSouth, [0, 0.01, 23.85]);
  const plazaSouthMesh = new THREE.Mesh(plazaSouth, plazaMat);
  plazaSouthMesh.receiveShadow = true;
  group.add(plazaSouthMesh);

  // 2) North Archway-to-Avenue Plaza (z ∈ [4.2, 9.2], strictly west of x = 7.9)
  const plazaNorth = new THREE.BoxGeometry(21.7, 0.24, 5.0);
  xform(plazaNorth, [-2.95, 0.01, 6.7]);
  const plazaNorthMesh = new THREE.Mesh(plazaNorth, plazaMat);
  plazaNorthMesh.receiveShadow = true;
  group.add(plazaNorthMesh);

  // Central ceremonial axis carpet leading through the Archway up to the 108-Step Staircase
  const axisWalk = new THREE.BoxGeometry(6.4, 0.26, 38.0);
  xform(axisWalk, [0, 0.02, 18.0]);
  const axisMesh = new THREE.Mesh(axisWalk, avenueMat);
  axisMesh.receiveShadow = true;
  group.add(axisMesh);

  for (const sx of [-1, 1]) {
    const planterOuter = new THREE.BoxGeometry(5.6, 0.34, 6.2);
    xform(planterOuter, [sx * 9.8, 0.17, 20.5]);
    graniteGeos.push(planterOuter);

    const planterLawn = new THREE.BoxGeometry(5.1, 0.38, 5.7);
    xform(planterLawn, [sx * 9.8, 0.19, 20.5]);
    grassGeos.push(planterLawn);

    const curb = new THREE.BoxGeometry(0.32, 0.42, 16.0);
    xform(curb, [sx * 6.0, 0.21, 7.2]);
    graniteGeos.push(curb);

    for (const lz of [12.0, 8.0, 4.2]) {
      const lampPost = new THREE.CylinderGeometry(0.11, 0.13, 1.65, 6);
      xform(lampPost, [sx * 5.3, 0.82, lz]);
      graniteGeos.push(lampPost);

      const lampCap = new THREE.CylinderGeometry(0.16, 0.12, 0.28, 6);
      xform(lampCap, [sx * 5.3, 1.72, lz]);
      graniteGeos.push(lampCap);
    }
  }

  // Tier 1 Terrace (Old Dormitory level): articulated ashlar stone retaining walls + pilasters + lawn cap
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
  xform(tier1Lawn, [-3.6, 2.08, -3.2]);
  grassGeos.push(tier1Lawn);

  // Split Tier 1 South balustrade cleanly around the 108-step stair landing now on the central axis (x ∈ [-1.5, 1.5])
  const tier1BalustradeL = new THREE.BoxGeometry(13.9, 0.26, 0.22);
  xform(tier1BalustradeL, [-8.45, 2.26, 4.32]);
  graniteGeos.push(tier1BalustradeL);

  const tier1BalustradeR = new THREE.BoxGeometry(6.7, 0.26, 0.22);
  xform(tier1BalustradeR, [4.85, 2.26, 4.32]);
  graniteGeos.push(tier1BalustradeR);

  // Tier 1 East cliff balustrade along x = 8.08, z ∈ [-1.6, 4.32]
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

  // Tier 2 Terrace (Lion Hill Crest / Old Library level): dressed ashlar retaining wall, buttresses, blind arches & greenery
  const tier2Body = new THREE.BoxGeometry(21.2, 4.42, 11.6);
  xform(tier2Body, [-1.6, 2.21, -10.2]);
  applyWorldPlanarUVs(tier2Body, 0.26, 0.32);
  ashlarGeos.push(tier2Body);

  // Stepped stone cornice coping + plinth ledge along East & South faces of Tier 2
  const tier2EastCoping = new THREE.BoxGeometry(0.56, 0.22, 11.88);
  xform(tier2EastCoping, [8.96, 4.42, -10.2]);
  graniteGeos.push(tier2EastCoping);

  const tier2EastLedge = new THREE.BoxGeometry(0.32, 0.24, 11.76);
  xform(tier2EastLedge, [9.06, 2.24, -10.2]);
  graniteGeos.push(tier2EastLedge);

  const tier2EastBasePlinth = new THREE.BoxGeometry(0.42, 0.56, 11.84);
  xform(tier2EastBasePlinth, [9.06, 0.28, -10.2]);
  graniteGeos.push(tier2EastBasePlinth);

  const tier2SouthCoping = new THREE.BoxGeometry(10.6, 0.22, 0.48);
  xform(tier2SouthCoping, [3.85, 4.42, -4.34]);
  graniteGeos.push(tier2SouthCoping);

  // Vertical stone pilasters & recessed blind-arch framing bays on Tier 2 East retaining wall
  const tier2PilasterZs = [-15.5, -13.4, -11.3, -9.2, -7.1, -4.9];
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
      applyWorldPlanarUVs(panel, 0.26, 0.32);
      ashlarGeos.push(panel);

      const lowerPanel = new THREE.BoxGeometry(0.12, 1.42, 1.48);
      xform(lowerPanel, [9.03, 1.28, midZ]);
      applyWorldPlanarUVs(lowerPanel, 0.26, 0.32);
      ashlarGeos.push(lowerPanel);
    }
  });
  for (const px of [-9.8, -6.6, -5.0, -2.6, -1.2, 1.2, 3.8, 6.4, 8.85]) {
    const sPil = new THREE.BoxGeometry(0.46, 4.48, 0.32);
    xform(sPil, [px, 2.24, -4.34]);
    graniteGeos.push(sPil);
  }

  const tier2Lawn = new THREE.BoxGeometry(20.8, 0.18, 11.2);
  xform(tier2Lawn, [-1.6, 4.48, -10.2]);
  grassGeos.push(tier2Lawn);

  // Classic stone balustrade along Tier 2 East & South sheer cliff edges (0.83m height above lawn)
  const tier2EastCurb = new THREE.BoxGeometry(0.22, 0.14, 11.2);
  xform(tier2EastCurb, [8.86, 4.62, -10.02]);
  graniteGeos.push(tier2EastCurb);
  const tier2EastRail = new THREE.BoxGeometry(0.26, 0.11, 11.26);
  xform(tier2EastRail, [8.86, 5.34, -10.02]);
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

  // Soft sloped natural hillside ridges framing the west/north perimeter (no harsh box cliffs!)
  const slopeConfigs = [
    { pos: [-17.5, 0.95, -5.0], rx: 6.2, rz: 10.5, h: 2.3 },
    { pos: [-11.5, 1.9, -15.6], rx: 8.5, rz: 5.2, h: 4.1 },
    { pos: [-1.0, 2.1, -16.8], rx: 10.2, rz: 4.6, h: 4.5 },
    { pos: [-17.2, 0.7, 6.8], rx: 5.2, rz: 6.8, h: 1.7 },
  ];
  const hillGeos = slopeConfigs.map((b) => {
    const g = new THREE.CylinderGeometry(0.55, 1.0, b.h, 18, 1);
    xform(g, b.pos, [0, 0, 0], [b.rx, 1, b.rz]);
    return g;
  });
  const hillSlopeMesh = new THREE.Mesh(mergeSafe(hillGeos), hillMat);
  hillSlopeMesh.receiveShadow = true;
  hillSlopeMesh.castShadow = true;
  group.add(hillSlopeMesh);
  const dummy = new THREE.Object3D();

  /* ---------------------------------------------------------------------- */
  /* 3. Old Dormitory (老斋舍) + 3 Roman Arches + 3 Pavilions + 百步梯      */
  /* ---------------------------------------------------------------------- */
  const dormGroup = new THREE.Group();
  dormGroup.position.set(0, 2.15, -0.8);
  group.add(dormGroup);

  const wingXPositions = [-6.6, -2.35, 2.35, 6.6];
  wingXPositions.forEach((wx, idx) => {
    const wLen = idx === 0 || idx === 3 ? 3.5 : 3.2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wLen, 2.55, 2.5), dormWallMat);
    wing.position.set(wx, 1.28, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
    dormGroup.add(wing);

    // 3D colonnade pilasters, horizontal stringcourses & eave cornice on Dormitory wings
    const worldWingX = wx;
    for (const pxOff of [-wLen * 0.44, 0, wLen * 0.44]) {
      for (const sz of [-1, 1]) {
        const dPil = new THREE.BoxGeometry(0.18, 2.58, 0.20);
        xform(dPil, [worldWingX + pxOff, 2.15 + 1.29, -0.8 + sz * 1.22]);
        warmStoneGeos.push(dPil);
      }
    }
    for (const bandY of [0.88, 1.74]) {
      const band = new THREE.BoxGeometry(wLen + 0.14, 0.09, 2.64);
      xform(band, [worldWingX, 2.15 + bandY, -0.8]);
      graniteGeos.push(band);
    }
    const eaveCornice = new THREE.BoxGeometry(wLen + 0.22, 0.12, 2.76);
    xform(eaveCornice, [worldWingX, 2.15 + 2.52, -0.8]);
    graniteGeos.push(eaveCornice);

    const slab = new THREE.BoxGeometry(wLen + 0.16, 0.18, 2.72);
    xform(slab, [worldWingX, 2.15 + 2.6, -0.8]);
    warmStoneGeos.push(slab);

    for (const sz of [-1, 1]) {
      const rail = new THREE.BoxGeometry(wLen + 0.12, 0.34, 0.12);
      xform(rail, [worldWingX, 2.15 + 2.82, -0.8 + sz * 1.26]);
      graniteGeos.push(rail);
    }
  });

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

  const gateOffsets = [-4.55, 0, 4.55];
  gateOffsets.forEach((gx) => {
    const worldX = gx;
    const worldY = 2.15;
    const worldZ = -0.8;

    const towerGeo = buildArchedGateTower(1.65, 2.85, 2.95, 0.48, 1.9);
    xform(towerGeo, [worldX, worldY, worldZ]);
    warmStoneGeos.push(towerGeo);

    const cornice = new THREE.BoxGeometry(1.82, 0.18, 3.12);
    xform(cornice, [worldX, worldY + 2.88, worldZ]);
    graniteGeos.push(cornice);

    const pavY = worldY + 2.96;
    for (const px of [-0.62, 0.62]) {
      for (const pz of [-0.88, 0.88]) {
        const col = new THREE.CylinderGeometry(0.075, 0.08, 1.02, 10);
        col.translate(worldX + px, pavY + 0.51, worldZ + pz);
        const colMesh = new THREE.Mesh(col, crimsonColumnMat);
        colMesh.castShadow = true;
        group.add(colMesh);
      }
    }

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
      roofMats
    );
    pavRoof.position.set(worldX, pavY + 0.98, worldZ);
    group.add(pavRoof);
  });

  // Grand 108-Step Staircase (百步梯) ascending straight up the central axis from the ceremonial carpet
  const stepCount = 18;
  for (let i = 0; i < stepCount; i++) {
    const t = i / (stepCount - 1);
    const sy = 0.14 + t * 2.01;
    const sz = 8.15 - t * 3.85;
    const step = new THREE.BoxGeometry(2.55, 0.16, 0.28);
    xform(step, [0, sy, sz]);
    graniteGeos.push(step);
  }
  for (const sx of [-1.36, 1.36]) {
    const ramp = new THREE.BoxGeometry(0.18, 0.38, 4.15);
    xform(ramp, [sx, 1.24, 6.22], [0.48, 0, 0]);
    graniteGeos.push(ramp);
  }
  const terraceWalk = new THREE.BoxGeometry(2.6, 0.12, 8.75);
  xform(terraceWalk, [0, 2.16, 0.02]);
  graniteGeos.push(terraceWalk);

  // Tier 2 South Courtyard recessed blind-arch stone portal visible cleanly through central arch
  const courtyardPortal = buildArchedGateTower(1.85, 2.45, 0.28, 0.56, 1.85);
  xform(courtyardPortal, [0, 2.15, -4.30]);
  warmStoneGeos.push(courtyardPortal);
  const courtyardCornice = new THREE.BoxGeometry(2.04, 0.18, 0.42);
  xform(courtyardCornice, [0, 4.64, -4.30]);
  graniteGeos.push(courtyardCornice);
  const courtyardDoor = new THREE.Mesh(new THREE.BoxGeometry(1.20, 1.92, 0.14), darkTimberMat);
  courtyardDoor.position.set(0, 3.12, -4.36);
  courtyardDoor.castShadow = true;
  courtyardDoor.receiveShadow = true;
  group.add(courtyardDoor);
  for (const sx of [-1.25, 1.25]) {
    const cPlanter = new THREE.BoxGeometry(0.68, 0.28, 0.68);
    xform(cPlanter, [sx, 2.29, -3.85]);
    graniteGeos.push(cPlanter);
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Old Library (樱顶老图书馆) on Lion Hill Crest                       */
  /* ---------------------------------------------------------------------- */
  const libGroup = new THREE.Group();
  libGroup.position.set(0, 4.55, -9.8);
  group.add(libGroup);

  const podium = new THREE.BoxGeometry(9.6, 0.55, 7.2);
  xform(podium, [0, 4.55 + 0.27, -9.8]);
  graniteGeos.push(podium);

  for (let s = 0; s < 6; s++) {
    const st = new THREE.BoxGeometry(3.2, 0.12, 0.34);
    xform(st, [0, 4.55 + s * 0.09, -6.1 + s * -0.22]);
    graniteGeos.push(st);
  }

  const libMainHall = new THREE.Mesh(new THREE.BoxGeometry(7.8, 2.85, 5.4), libWallMat);
  libMainHall.position.set(0, 0.55 + 1.42, 0);
  libMainHall.castShadow = true;
  libMainHall.receiveShadow = true;
  libGroup.add(libMainHall);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pilaster = new THREE.BoxGeometry(0.42, 2.9, 0.42);
      xform(pilaster, [sx * 3.8, 4.55 + 0.55 + 1.45, -9.8 + sz * 2.6]);
      warmStoneGeos.push(pilaster);
    }
  }

  const lowerFrieze = new THREE.Mesh(new THREE.BoxGeometry(8.15, 0.24, 5.75), darkTimberMat);
  lowerFrieze.position.set(0, 0.55 + 2.72, 0);
  lowerFrieze.castShadow = true;
  libGroup.add(lowerFrieze);

  const porchHall = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.35, 1.45), libWallMat);
  porchHall.position.set(0, 0.55 + 1.18, 2.95);
  porchHall.castShadow = true;
  porchHall.receiveShadow = true;
  libGroup.add(porchHall);

  const porchRoof = roofGroup(
    {
      halfW: 1.95,
      halfD: 1.15,
      H: 0.85,
      mode: 'xieshan',
      inset: 0.45,
      lift: 0.22,
      segU: 16,
      segV: 10,
      soffitInward: 0.65,
      rafters: true,
    },
    roofMats
  );
  porchRoof.position.set(0, 0.55 + 2.35, 3.05);
  libGroup.add(porchRoof);

  const lowerSkirtRoof = roofGroup(
    {
      halfW: 4.85,
      halfD: 3.55,
      H: 1.02,
      mode: 'ring',
      ring: 1.35,
      lift: 0.34,
      segU: 24,
      segV: 10,
      soffitInward: 1.15,
      rafters: true,
    },
    roofMats
  );
  lowerSkirtRoof.position.set(0, 0.55 + 2.68, 0);
  libGroup.add(lowerSkirtRoof);

  const upperHall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.45, 3.7), libWallMat);
  upperHall.position.set(0, 0.55 + 3.45 + 0.72, 0);
  upperHall.castShadow = true;
  upperHall.receiveShadow = true;
  libGroup.add(upperHall);

  // Corner pilasters & clerestory gallery brackets framing upperHall under the upturned eaves
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const uPil = new THREE.BoxGeometry(0.32, 1.5, 0.32);
      xform(uPil, [sx * 2.74, 4.55 + 0.55 + 4.18, -9.8 + sz * 1.78]);
      warmStoneGeos.push(uPil);
    }
  }
  for (const px of [-2.85, -1.75, -0.65, 0.65, 1.75, 2.85]) {
    for (const pz of [-1.96, 1.96]) {
      const col = new THREE.CylinderGeometry(0.055, 0.06, 1.32, 8);
      col.translate(px, 0.55 + 4.16, pz);
      const cMesh = new THREE.Mesh(col, crimsonColumnMat);
      cMesh.castShadow = true;
      libGroup.add(cMesh);
    }
  }
  const upperFrieze = new THREE.Mesh(new THREE.BoxGeometry(6.25, 0.28, 4.35), darkTimberMat);
  upperFrieze.position.set(0, 0.55 + 4.82, 0);
  upperFrieze.castShadow = true;
  libGroup.add(upperFrieze);

  const upperBalustrade = new THREE.BoxGeometry(6.15, 0.28, 4.2);
  xform(upperBalustrade, [0, 4.55 + 0.55 + 3.58, -9.8]);
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
    roofMats
  );
  upperMainRoof.position.set(0, 0.55 + 4.82, 0);
  libGroup.add(upperMainRoof);

  // Sculpted 2-tier octagonal lotus pedestal integrated into the roof ridge under the 宝顶 spire
  const finialBaseTier = new THREE.CylinderGeometry(0.46, 0.54, 0.16, 8);
  xform(finialBaseTier, [0, 4.55 + 0.55 + 6.32, -9.8]);
  graniteGeos.push(finialBaseTier);
  const finialUpperTier = new THREE.CylinderGeometry(0.36, 0.44, 0.14, 8);
  xform(finialUpperTier, [0, 4.55 + 0.55 + 6.45, -9.8]);
  graniteGeos.push(finialUpperTier);

  const baodingPts = [];
  const bSteps = 40;
  for (let i = 0; i <= bSteps; i++) {
    const t = i / bSteps;
    const y = t * 1.18;
    let r = 0.38 * (1 - t * 0.45);
    if (t < 0.82) {
      const wave = Math.sin(t * Math.PI * 10.5);
      r += Math.max(0, wave) * 0.13;
    } else {
      const u = (t - 0.82) / 0.18;
      r = 0.24 * Math.cos(u * Math.PI * 0.48);
    }
    baodingPts.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  const baodingGeo = new THREE.LatheGeometry(baodingPts, 24);
  const baodingMesh = new THREE.Mesh(baodingGeo, glazedRidgeMat);
  baodingMesh.position.set(0, 0.55 + 6.52, 0);
  baodingMesh.castShadow = true;
  libGroup.add(baodingMesh);

  /* ---------------------------------------------------------------------- */
  /* 5. Flanking Cherry Crest Courtyard Wings (理学楼 / 文学院侧翼)          */
  /* ---------------------------------------------------------------------- */
  for (const sx of [-1, 1]) {
    const wingX = sx * 7.6;
    const wingY = 4.55;
    const wingZ = -8.6;

    const sideHall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.25, 3.2), dormWallMat);
    sideHall.position.set(wingX, wingY + 1.12, wingZ);
    sideHall.castShadow = true;
    sideHall.receiveShadow = true;
    group.add(sideHall);

    const sideRoof = roofGroup(
      {
        halfW: 2.55,
        halfD: 2.0,
        H: 1.05,
        mode: 'hip',
        lift: 0.25,
        segU: 16,
        segV: 8,
        soffitInward: 0.72,
        rafters: true,
      },
      roofMats
    );
    sideRoof.position.set(wingX, wingY + 2.22, wingZ);
    group.add(sideRoof);
  }

  /* ---------------------------------------------------------------------- */
  /* 6. Unified Seamless East Lake (东湖) & Lingbo Pier (凌波门水上栈桥)    */
  /* ---------------------------------------------------------------------- */
  const reflectRT = new THREE.WebGLRenderTarget(960, 600, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  const reflectCam = new THREE.PerspectiveCamera();

  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: sharedTimeUniform,
      uDeepColor: { value: new THREE.Color('#135988') },
      uShallowColor: { value: new THREE.Color('#4eb7cf') },
      uSkyColor: { value: new THREE.Color('#cfe9ff') },
      uHorizonColor: horizonColorUniform,
      uSunColor: { value: new THREE.Color('#fff6e4') },
      uSunDir: { value: new THREE.Vector3(28, 22, 19).normalize() },
      uSunsetWarmth: sunsetWarmthUniform,
      tReflection: { value: null },
      uHasReflection: { value: 0.0 },
      uReflectMatrix: { value: new THREE.Matrix4() },
      uShadowMap: { value: null },
      uHasShadowMap: { value: 0.0 },
      uShadowMatrix: { value: new THREE.Matrix4() },
      uShadowMapSize: { value: new THREE.Vector2(2048, 2048) },
      uShadowBias: { value: -0.00024 },
    },
  ]);
  waterUniforms.tReflection.value = reflectRT.texture;

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: waterUniforms,
    vertexShader: `
      #include <fog_pars_vertex>
      uniform mat4 uReflectMatrix;
      uniform mat4 uShadowMatrix;
      varying vec3 vWorldPos;
      varying vec4 vReflectCoord;
      varying vec4 vShadowCoord;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vReflectCoord = uReflectMatrix * wp;
        vShadowCoord = uShadowMatrix * (wp + vec4(0.0, 0.025, 0.0, 0.0));
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <packing>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunsetWarmth;
      uniform sampler2D tReflection;
      uniform float uHasReflection;
      uniform sampler2D uShadowMap;
      uniform float uHasShadowMap;
      uniform vec2 uShadowMapSize;
      uniform float uShadowBias;
      varying vec3 vWorldPos;
      varying vec4 vReflectCoord;
      varying vec4 vShadowCoord;

      float sdBox2D(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }

      float sdSegment2D(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        return length(pa - ba * h);
      }

      float sdHexagon2D(vec2 p, float r) {
        const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
        p = abs(p);
        p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
        p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
        return length(p) * sign(p.y);
      }

      float interleavedGradientNoise(vec2 sc) {
        vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
        return fract(magic.z * fract(dot(sc, magic.xy)));
      }

      float sampleShadowBilinear(vec2 uv, float compare, vec2 texel) {
        vec2 texelPos = uv * uShadowMapSize - 0.5;
        vec2 f = fract(texelPos);
        vec2 base = (floor(texelPos) + 0.5) * texel;
        float s00 = step(compare, unpackRGBAToDepth(texture2D(uShadowMap, base)));
        float s10 = step(compare, unpackRGBAToDepth(texture2D(uShadowMap, base + vec2(texel.x, 0.0))));
        float s01 = step(compare, unpackRGBAToDepth(texture2D(uShadowMap, base + vec2(0.0, texel.y))));
        float s11 = step(compare, unpackRGBAToDepth(texture2D(uShadowMap, base + texel)));
        return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
      }

      // 12-tap Vogel-disk PCF with per-pixel IGN rotation
      float sampleKeyShadow(vec4 sc) {
        if (uHasShadowMap < 0.5 || sc.w <= 0.0) return 1.0;
        vec3 proj = sc.xyz / sc.w;
        if (proj.x < 0.002 || proj.x > 0.998 || proj.y < 0.002 || proj.y > 0.998 || proj.z > 1.0) {
          return 1.0;
        }
        float compare = proj.z + uShadowBias;
        vec2 texel = 1.0 / max(uShadowMapSize, vec2(1.0));
        float angle = interleavedGradientNoise(gl_FragCoord.xy) * 6.2831853;
        float ca = cos(angle);
        float sa = sin(angle);
        mat2 rot = mat2(ca, -sa, sa, ca);
        float spread = 2.4;
        float sum = 0.0;
        for (int i = 0; i < 12; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / 12.0) * spread;
          float th = fi * 2.3999632;
          vec2 off = rot * (vec2(cos(th), sin(th)) * r) * texel;
          sum += sampleShadowBilinear(proj.xy + off, compare, texel);
        }
        return sum / 12.0;
      }

      // Analytic 2D smooth value-noise + gradient (dx, dy)
      vec3 noiseGrad2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        vec2 du = 6.0 * f * (1.0 - f);
        float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
        float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
        float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
        float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
        float k0 = a;
        float k1 = b - a;
        float k2 = c - a;
        float k3 = a - b - c + d;
        float val = k0 + k1 * u.x + k2 * u.y + k3 * u.x * u.y;
        vec2 grad = du * (vec2(k1, k2) + k3 * u.yx);
        return vec3(val, grad);
      }

      // Non-orthogonal 5-octave 37-deg rotated noise-gradient ripples + analytic Toksvig AA
      vec4 evalDualWaveGrad(vec2 p, float t, float camDist, float vy) {
        float footprint = camDist * 0.018 / max(vy, 0.08);
        const mat2 ROT37 = mat2(0.80, -0.60, 0.60, 0.80);
        const mat2 ROT37_T = mat2(0.80, 0.60, -0.60, 0.80);

        vec3 w = noiseGrad2D(p * 0.35 + vec2(t * 0.08, -t * 0.06));
        vec2 q = p + w.yz * 0.45;

        vec2 macroG = vec2(0.0);
        vec2 capG = vec2(0.0);

        float freqs[5];
        freqs[0] = 0.72; freqs[1] = 1.38; freqs[2] = 2.65; freqs[3] = 5.40; freqs[4] = 10.80;
        float amps[5];
        amps[0] = 0.040; amps[1] = 0.034; amps[2] = 0.026; amps[3] = 0.020; amps[4] = 0.015;
        vec2 vels[5];
        vels[0] = vec2(0.62, -0.48); vels[1] = vec2(-0.72, 0.55);
        vels[2] = vec2(0.85, 0.62);  vels[3] = vec2(-1.05, -0.72); vels[4] = vec2(1.30, -0.85);

        vec2 rp = q;
        mat2 invAcc = mat2(1.0);
        for (int i = 0; i < 5; i++) {
          float f = freqs[i];
          float aa = 1.0 / (1.0 + f * f * footprint * footprint * 0.35);
          vec3 ng = noiseGrad2D(rp * f + vels[i] * t);
          vec2 gWorld = (invAcc * ng.yz) * f * amps[i] * aa;
          if (i < 2) macroG += gWorld;
          else       capG   += gWorld;
          rp = ROT37 * rp;
          invAcc = invAcc * ROT37_T;
        }
        // Gentle AA guard only (grazing-angle + very far distance), never kills mid-lake motion
        float horizonSmooth = smoothstep(0.008, 0.09, vy) * mix(1.0, 0.35, smoothstep(30.0, 160.0, camDist));
        return vec4(macroG * horizonSmooth, capG * horizonSmooth);
      }

      // True piling-only SDF (eliminates phantom ring inside square pier cutout)
      float evalPilingsDist(vec2 p) {
        float d = 100.0;
        float colIdx = clamp(floor((p.x - 9.2) / 1.4 + 0.5), 0.0, 7.0);
        float pxMain = 9.2 + colIdx * 1.4;
        float pzMain = p.y < -7.8 ? -8.24 : -7.36;
        d = min(d, length(p - vec2(pxMain, pzMain)) - 0.092);

        float xArm1 = 15.4 + (p.x >= 15.4 ? 0.40 : -0.40);
        d = min(d, length(p - vec2(xArm1, -11.5)) - 0.092);
        d = min(d, length(p - vec2(xArm1, -10.3)) - 0.092);
        d = min(d, length(p - vec2(xArm1, -9.1)) - 0.092);
        d = min(d, length(p - vec2(xArm1, -6.5)) - 0.092);
        d = min(d, length(p - vec2(xArm1, -5.5)) - 0.092);

        float xArm2 = 18.4 + (p.x >= 18.4 ? 0.38 : -0.38);
        d = min(d, length(p - vec2(xArm2, -10.5)) - 0.092);
        d = min(d, length(p - vec2(xArm2, -9.3)) - 0.092);
        d = min(d, length(p - vec2(xArm2, -6.6)) - 0.092);
        d = min(d, length(p - vec2(xArm2, -5.7)) - 0.092);

        float zEnd = -11.4 + (p.y >= -11.4 ? 0.32 : -0.32);
        d = min(d, length(p - vec2(16.2, zEnd)) - 0.092);
        d = min(d, length(p - vec2(17.6, zEnd)) - 0.092);
        d = min(d, length(p - vec2(18.35, zEnd)) - 0.092);

        float xCause = p.x >= 9.55 ? 10.05 : 9.05;
        float zCause = p.y >= -5.8 ? -5.2 : -6.4;
        d = min(d, length(p - vec2(xCause, zCause)) - 0.092);
        return max(0.0, d);
      }

      void main() {
        vec2 p = vWorldPos.xz;
        float camDist = length(cameraPosition - vWorldPos);
        float detailFade = smoothstep(120.0, 8.0, camDist);

        // Continuous East Lake coastal SDF (cove + outer shorelines + hexagonal Pavilion at 9.25, -3.2)
        float dWest = sdSegment2D(p, vec2(8.05, -15.2), vec2(8.05, 9.05));
        float dNorth = sdSegment2D(p, vec2(8.05, -15.2), vec2(26.4, -15.2));
        float dSouth = sdSegment2D(p, vec2(8.05, 9.05), vec2(31.4, 9.05));
        float dNorthOuter = min(
          sdSegment2D(p, vec2(26.4, -15.2), vec2(24.5, -62.0)),
          sdSegment2D(p, vec2(24.5, -62.0), vec2(33.1, -167.2))
        );
        float dSouthOuter = min(
          sdSegment2D(p, vec2(31.4, 9.05), vec2(58.0, 76.0)),
          sdSegment2D(p, vec2(58.0, 76.0), vec2(83.4, 167.0))
        );
        float dPav = max(0.0, sdHexagon2D(p - vec2(9.25, -3.2), 1.62));
        float distShore = min(min(dWest, dPav), min(min(dNorth, dSouth), min(dNorthOuter, dSouthOuter)));

        // Lingbo Pier footprint SDF for soft contact AO & specular shadow masking
        float dMain = sdBox2D(p - vec2(13.9, -7.8), vec2(5.5, 0.60));
        float dArm1 = sdBox2D(p - vec2(15.4, -8.6), vec2(0.575, 3.4));
        float dArm2 = sdBox2D(p - vec2(18.4, -8.2), vec2(0.575, 2.8));
        float dEnd = sdBox2D(p - vec2(16.9, -11.4), vec2(1.6, 0.475));
        float dCause = sdBox2D(p - vec2(9.55, -6.1), vec2(0.68, 1.80));
        float dPier = min(min(min(dMain, dArm1), min(dArm2, dEnd)), dCause);

        float dPilings = evalPilingsDist(p);

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec4 wg = evalDualWaveGrad(p, uTime, camDist, V.y);

        float shoreRipple = cos(distShore * 9.5 - uTime * 2.4) * smoothstep(1.6, 0.04, distShore) * 0.018 * detailFade;
        float pilingRipple = cos(dPilings * 12.0 - uTime * 2.2) * smoothstep(0.95, 0.02, dPilings) * 0.014 * detailFade;
        vec2 grad = wg.xy + wg.zw + vec2(shoreRipple + pilingRipple, shoreRipple - pilingRipple) * 0.7;

        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));

        // Schlick Fresnel
        float cosTheta = max(0.0, dot(N, V));
        float fresnel = 0.035 + 0.965 * pow(1.0 - cosTheta, 4.2);

        // Depth-driven shoal translucency (reveals submerged steps & pilings cleanly)
        float pierShoal = smoothstep(24.0, 18.5, p.x) * smoothstep(-15.5, -13.0, p.y) * smoothstep(9.5, 5.0, p.y);
        float shoreDepth = mix(0.08, 1.85, smoothstep(0.0, 7.5, distShore));
        float waterDepth = mix(shoreDepth, min(shoreDepth, 0.52), pierShoal * 0.82);

        vec3 absorption = exp(-waterDepth * vec3(2.45, 0.88, 0.48));
        float shallowMask = 1.0 - smoothstep(0.0, 7.2, distShore);
        vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(absorption.g * 0.65 + shallowMask * 0.36, 0.0, 1.0));

        // Soft directional shadow reception + contact AO beneath pier, pavilion & all shoreline
        float shadowFactor = sampleKeyShadow(vShadowCoord);
        float pierAO = mix(0.80, 1.0, smoothstep(-0.35, 1.85, dPier));
        float pavAO = mix(0.80, 1.0, smoothstep(0.0, 1.1, dPav));
        float shoreContact = mix(0.72, 1.0, smoothstep(0.0, 2.6, distShore)); // waterline darkening
        float litDiffuse = mix(0.48, 1.0, shadowFactor) * pierAO * pavAO * shoreContact;
        baseWater *= litDiffuse;

        // Dual-scale planar reflection lookup + reflected sky fallback
        vec3 R = reflect(-V, N);
        float ry = clamp(R.y, 0.0, 1.0);
        vec3 skyFallback = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 0.38, ry));
        vec3 reflCol = skyFallback;
        if (uHasReflection > 0.5 && vReflectCoord.w > 0.001) {
          vec2 rawUv = (vReflectCoord.xy / vReflectCoord.w) * 0.5 + 0.5;
          float distDamp = 1.0 / (1.0 + camDist * 0.045);
          vec2 perturb = (wg.xy * vec2(0.55, 0.90) * distDamp + wg.zw * vec2(1.35, 2.20)) * vec2(0.075, 0.125);
          vec2 reflUv = clamp(rawUv + perturb, vec2(0.002), vec2(0.998));
          vec3 sampledRefl = texture2D(tReflection, reflUv).rgb;
          float inBounds =
            smoothstep(-0.04, 0.0, rawUv.x) *
            smoothstep(1.04, 1.0, rawUv.x) *
            smoothstep(-0.04, 0.0, rawUv.y) *
            smoothstep(1.04, 1.0, rawUv.y);
          reflCol = mix(skyFallback, sampledRefl, inBounds);
        }
        reflCol *= mix(0.68, 1.0, mix(shadowFactor, 1.0, 0.35) * mix(pierAO, 1.0, 0.3));

        // Reflection mix weighted by Fresnel (boosted rose-gold sky presence in sunset)
        float reflWeight = clamp(mix(0.14, 0.30, uSunsetWarmth) + fresnel * 0.78, 0.0, 0.90);
        vec3 col = mix(baseWater, reflCol, reflWeight);

        // Sun specular hierarchy + warm sunset rose-gold & amber crest scatter masked by shadowFactor * pierAO
        vec3 H = normalize(uSunDir + V);
        float specMask = shadowFactor * smoothstep(-0.04, 0.38, dPier) * smoothstep(0.0, 0.32, dPav);
        float ndh = max(0.0, dot(N, H));
        float specSharp = pow(ndh, 420.0) * 2.2 * specMask;
        float specSparkle = pow(ndh, 120.0) * 0.45 * specMask;

        vec3 sunHorizDir = normalize(vec3(uSunDir.x, 0.52, uSunDir.z));
        float sunCrest = pow(max(0.0, dot(N, sunHorizDir)), 3.0);
        float sunsetGrazing = pow(1.0 - cosTheta, 1.65) * 0.42 + sunCrest * 0.45;
        float sunsetAmber = pow(max(0.0, dot(N, normalize(sunHorizDir + V * 0.35))), 48.0) * 0.58;
        float sunsetWash = (sunsetGrazing + sunsetAmber) * uSunsetWarmth * mix(0.10, 1.0, shadowFactor * pierAO);
        col += uSunColor * (specSharp + specSparkle);
        col += mix(vec3(0.96, 0.68, 0.76), vec3(1.0, 0.74, 0.42), clamp(sunCrest + sunsetAmber, 0.0, 1.0)) * sunsetWash;

        // Delicate shoreline & piling meniscus foam/highlight
        float meniscusWave = 0.55 + 0.45 * sin((p.x * 3.4 + p.y * 2.6) + uTime * 2.1);
        float meniscus = smoothstep(0.30, 0.0, distShore) * meniscusWave;
        float pilingMeniscus = smoothstep(0.22, 0.0, dPilings) * meniscusWave * 0.65;
        col += mix(uShallowColor, vec3(0.98, 0.99, 1.0), 0.75) * (meniscus * 0.16 + pilingMeniscus * 0.14) * mix(0.55, 1.0, shadowFactor);

        // Distance horizon haze matching skyDome uHorizon
        float horizonHaze = smoothstep(78.0, 160.0, camDist);
        col = mix(col, uHorizonColor, horizonHaze * 0.92);

        // Depth-aware translucency preserving specular sparkle over shallow shoal
        float openOpaque = smoothstep(5.0, 10.5, distShore);
        float depthAlpha = mix(1.0 - exp(-waterDepth * 1.12), 1.0, openOpaque);
        float specLuma = clamp(dot(uSunColor * (specSharp + specSparkle), vec3(0.3, 0.6, 0.1)), 0.0, 1.0);
        float alpha = clamp(max(mix(depthAlpha, 1.0, fresnel * 0.62), specLuma * 0.85), 0.24, 1.0);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  // Single unified East Lake polygon strictly East of shoreX(z), tucked ~0.2m under dry shore banks
  const eastLakeShape = new THREE.Shape();
  eastLakeShape.moveTo(7.98, -9.03);
  eastLakeShape.lineTo(7.98, 15.18);
  eastLakeShape.lineTo(26.4, 15.18);
  for (let i = 1; i <= 24; i++) {
    const z = THREE.MathUtils.lerp(-15.2, -172.0, i / 24);
    eastLakeShape.lineTo(shoreX(z) - 0.12, -z);
  }
  eastLakeShape.lineTo(172.0, 172.0);
  eastLakeShape.lineTo(172.0, -172.0);
  for (let i = 0; i <= 24; i++) {
    const z = THREE.MathUtils.lerp(172.0, 9.05, i / 24);
    eastLakeShape.lineTo(shoreX(z) - 0.12, -z);
  }
  eastLakeShape.lineTo(31.4, -9.03);
  eastLakeShape.closePath();

  const eastLakeGeo = new THREE.ShapeGeometry(eastLakeShape, 24);
  const eastLakeMesh = new THREE.Mesh(eastLakeGeo, waterMat);
  eastLakeMesh.rotation.x = -Math.PI / 2;
  eastLakeMesh.position.y = WATER_Y;
  eastLakeMesh.receiveShadow = true;
  eastLakeMesh.renderOrder = 2;
  group.add(eastLakeMesh);

  // Unified East Lake bed beneath the entire water surface
  const eastLakeBedGeo = new THREE.ShapeGeometry(eastLakeShape, 16);
  const eastLakeBed = new THREE.Mesh(eastLakeBedGeo, lakeBedMat);
  eastLakeBed.rotation.x = -Math.PI / 2;
  eastLakeBed.position.y = -0.56;
  eastLakeBed.receiveShadow = true;
  group.add(eastLakeBed);

  // Sloped pale-limestone nearshore shoal under steps, Pavilion & Lingbo Pier
  const shoalXs = [8.0, 11.5, 16.5, 22.0];
  const shoalYs = [-0.24, -0.26, -0.40, -0.56];
  const shoalVerts = [];
  const shoalUvs = [];
  const shoalIdx = [];
  for (const sz of [-15.1, 8.95]) {
    for (let ix = 0; ix < shoalXs.length; ix++) {
      shoalVerts.push(shoalXs[ix], shoalYs[ix], sz);
      shoalUvs.push(shoalXs[ix] * 0.2, sz * 0.2);
    }
  }
  for (let ix = 0; ix < shoalXs.length - 1; ix++) {
    const a = ix;
    const b = ix + 1;
    const c = ix + shoalXs.length;
    const d = c + 1;
    shoalIdx.push(a, c, b, b, c, d);
  }
  const shoalGeo = new THREE.BufferGeometry();
  shoalGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoalVerts, 3));
  shoalGeo.setAttribute('uv', new THREE.Float32BufferAttribute(shoalUvs, 2));
  shoalGeo.setIndex(shoalIdx);
  shoalGeo.computeVertexNormals();
  const shoalMesh = new THREE.Mesh(shoalGeo, shoalMat);
  shoalMesh.receiveShadow = true;
  group.add(shoalMesh);

  // Granite embankment curbs strictly along North & South curved East Lake shorelines (fading naturally)
  for (const signZ of [-1, 1]) {
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const t0 = (i / segs) * 0.25;
      const t1 = ((i + 1) / segs) * 0.25;
      const z0 = signZ < 0 ? -15.2 - t0 * 152.0 : 9.05 + t0 * 158.0;
      const z1 = signZ < 0 ? -15.2 - t1 * 152.0 : 9.05 + t1 * 158.0;
      const x0 = shoreX(z0);
      const x1 = shoreX(z1);
      const segLen = Math.hypot(x1 - x0, z1 - z0) + 0.12;
      const midX = (x0 + x1) * 0.5;
      const midZ = (z0 + z1) * 0.5;
      const yaw = Math.atan2(-(z1 - z0), x1 - x0);
      const curbSeg = new THREE.BoxGeometry(segLen, 0.56, 0.34);
      xform(curbSeg, [midX, 0.10, midZ], [0, yaw, 0]);
      graniteGeos.push(curbSeg);
    }
  }

  // Faint distant Wuhan city skyline: layered low/mid blocks + wide towers + TV tower, hazed to blue (not white)
  const cityHazeColor = { value: new THREE.Color('#9fb9cd') };

  // City haze: fades by distance only (ignores height) so tall towers turn blue-grey too — no white pillars
  function attachCityHaze(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCityHaze = cityHazeColor;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCityWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld; uniform vec3 uCityHaze;')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\nfloat cD = length(cameraPosition - vCityWorld);\nfloat cHaze = smoothstep(70.0, 165.0, cD);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uCityHaze, clamp(cHaze * 0.9, 0.0, 0.94));');
    };
  }

  function makeCityWindowTexture(seed) {
    const W = 96;
    const H = 192;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    g.fillStyle = '#5c6e82';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 12) {
      g.fillStyle = '#48586a';
      g.fillRect(x, 0, 3, H);
    }
    for (let y = 6; y < H; y += 10) {
      for (let x = 4; x < W; x += 12) {
        const roll = rnd();
        g.fillStyle = roll < 0.26 ? '#f0d49b' : (roll < 0.74 ? '#9fb6c8' : '#71869e');
        g.fillRect(x, y, 6, 7);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    return t;
  }

  function makeCityGlowTexture(seed) {
    const W = 96;
    const H = 192;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    for (let y = 6; y < H; y += 10) {
      for (let x = 4; x < W; x += 12) {
        if (rnd() < 0.22) {
          g.fillStyle = '#ffdca0';
          g.fillRect(x, y, 6, 7);
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    return t;
  }

  const farCityMat = new THREE.MeshStandardMaterial({
    map: makeCityWindowTexture(701),
    emissiveMap: makeCityGlowTexture(702),
    color: new THREE.Color('#8da0b2'),
    emissive: new THREE.Color('#ffedc8'),
    emissiveIntensity: 0.55,
    roughness: 0.92,
    metalness: 0.0,
  });
  attachCityHaze(farCityMat);
  const cityFootMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a6e6a'),
    roughness: 1.0,
    metalness: 0.0,
  });
  attachCityHaze(cityFootMat);
  {
    const cityGeos = [];
    const cityRand = mulberry32(271103);
    const cityX = (ang, r) => Math.cos(ang) * r;
    const cityZ = (ang, r) => 5.2 - Math.sin(ang) * r;
    const addBuilding = (cx, cz, w, d, h, yaw = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.rotateY(yaw);
      g.translate(cx, h * 0.5 - 0.35, cz);
      cityGeos.push(g);
    };

    // Dense low/mid base band along the far shore — grounds the skyline, kills the "pillar" look
    for (let i = 0; i < 46; i++) {
      const ang = -1.25 + (1.6 - -1.25) * (i / 46) + (cityRand() - 0.5) * 0.05;
      const r = 136 + cityRand() * 13;
      if (cityRand() < 0.2) continue;
      addBuilding(cityX(ang, r), cityZ(ang, r), 9 + cityRand() * 10, 9 + cityRand() * 10, 13 + cityRand() * 20, (cityRand() - 0.5) * 0.3);
    }
    // Mid-rise, wider footprints
    for (let i = 0; i < 14; i++) {
      const ang = -1.25 + (1.6 - -1.25) * cityRand();
      const r = 148 + cityRand() * 14;
      addBuilding(cityX(ang, r), cityZ(ang, r), 14 + cityRand() * 9, 14 + cityRand() * 9, 30 + cityRand() * 22, (cityRand() - 0.5) * 0.3);
    }
    // Tall landmarks — wide enough to read as towers, not slender pillars
    const landmarks = [
      [-1.2, 160, 20, 62],
      [-0.9, 158, 24, 78],
      [0.1, 163, 18, 55],
      [0.7, 156, 20, 60],
      [1.35, 151, 18, 50],
    ];
    landmarks.forEach(([ang, r, w, h]) => addBuilding(cityX(ang, r), cityZ(ang, r), w, w, h));

    // Wuhan-style TV tower landmark: tapered shaft + observation pod + spire
    const tvAng = -0.55;
    const tvR = 162;
    const tvX = cityX(tvAng, tvR);
    const tvZ = cityZ(tvAng, tvR);
    const shaft = new THREE.CylinderGeometry(1.7, 3.6, 66, 10);
    shaft.translate(tvX, 32, tvZ);
    cityGeos.push(shaft);
    const pod = new THREE.SphereGeometry(5.4, 12, 10);
    pod.translate(tvX, 53, tvZ);
    cityGeos.push(pod);
    const spire = new THREE.CylinderGeometry(0.5, 0.9, 17, 6);
    spire.translate(tvX, 64, tvZ);
    cityGeos.push(spire);

    const cityMesh = new THREE.Mesh(mergeSafe(cityGeos), farCityMat);
    cityMesh.receiveShadow = false;
    cityMesh.renderOrder = 3;
    group.add(cityMesh);

    // Dark low landmass under the city feet (replaces the pale washed-out far-shore band)
    const shoreGeos = [];
    for (let i = 0; i < 40; i++) {
      const ang = -1.35 + (1.75 - -1.35) * (i / 40);
      const r0 = 118;
      const r1 = 132;
      const seg = new THREE.BoxGeometry(
        Math.hypot(Math.cos(ang) * r1 - Math.cos(ang) * r0, Math.sin(ang) * r1 - Math.sin(ang) * r0) + 4.2,
        2.6,
        15
      );
      const midR = (r0 + r1) * 0.5;
      const yaw = ang + Math.PI * 0.5;
      const b = new THREE.Mesh(seg, cityFootMat);
      b.position.set(cityX(ang, midR), -0.6, cityZ(ang, midR));
      b.rotation.y = -yaw;
      b.updateMatrix();
      shoreGeos.push(b);
    }
    const shoreBand = new THREE.Group();
    shoreGeos.forEach((b) => shoreBand.add(b));
    shoreBand.renderOrder = 2;
    group.add(shoreBand);
  }

  // Continuous dressed granite seawalls wrapping West shore (x=8.0), South shore (z=9.05) & North shore (z=-15.2)
  const westWall = new THREE.BoxGeometry(0.45, 0.95, 24.4);
  xform(westWall, [7.95, 0.12, -3.1]);
  graniteGeos.push(westWall);

  const southWallLen = 23.6;
  const southWall = new THREE.BoxGeometry(southWallLen, 0.95, 0.45);
  xform(southWall, [7.8 + southWallLen * 0.5, 0.12, 9.05]);
  graniteGeos.push(southWall);

  const northWallLen = 18.6;
  const northWall = new THREE.BoxGeometry(northWallLen, 0.95, 0.45);
  xform(northWall, [7.8 + northWallLen * 0.5, 0.12, -15.2]);
  graniteGeos.push(northWall);

  // Octagonal breakwater landing bastions anchoring the east tips of the north & south seawalls cleanly into shore
  for (const [bx, bz] of [
    [31.4, 9.05],
    [26.4, -15.2],
  ]) {
    const bastion = new THREE.CylinderGeometry(0.48, 0.56, 1.02, 8);
    xform(bastion, [bx, 0.14, bz]);
    graniteGeos.push(bastion);
  }

  // 7 descending granite shoreline steps cleanly East of Tier 2 / causeway along open cove segments
  for (let i = 0; i < 7; i++) {
    const northStep = new THREE.BoxGeometry(0.38, 0.28, 6.2);
    xform(northStep, [9.28 + i * 0.34, 0.38 - i * 0.12, -11.7]);
    graniteGeos.push(northStep);

    const southStep = new THREE.BoxGeometry(0.38, 0.28, 9.9);
    xform(southStep, [9.86 + i * 0.32, 0.36 - i * 0.12, 3.65]);
    graniteGeos.push(southStep);
  }
  // Submerged North & South seawall footing steps
  for (let i = 0; i < 2; i++) {
    const nFoot = new THREE.BoxGeometry(14.2, 0.28, 0.36);
    xform(nFoot, [18.7, -0.02 - i * 0.14, -14.88 + i * 0.32]);
    graniteGeos.push(nFoot);

    const sFoot = new THREE.BoxGeometry(19.0, 0.28, 0.36);
    xform(sFoot, [21.3, -0.02 - i * 0.14, 8.76 - i * 0.32]);
    graniteGeos.push(sFoot);
  }

  // Iconic Lingbo Pier (凌波门水上栈桥) with concrete slab joints & submerged pilings (y = -0.67 to +0.57)
  const pierY = 0.56;
  const pierZ = -7.8;
  const mainPier = new THREE.BoxGeometry(11.0, 0.15, 1.2);
  xform(mainPier, [13.9, pierY, pierZ]);
  applyWorldPlanarUVs(mainPier, 0.28, 0.28, false);
  pierGeos.push(mainPier);

  for (const sz of [-0.54, 0.54]) {
    const edgeCurb = new THREE.BoxGeometry(11.0, 0.08, 0.09);
    xform(edgeCurb, [13.9, pierY + 0.1, pierZ + sz]);
    applyWorldPlanarUVs(edgeCurb, 0.28, 0.28, false);
    pierGeos.push(edgeCurb);
  }

  const crossArm1 = new THREE.BoxGeometry(1.15, 0.15, 6.8);
  xform(crossArm1, [15.4, pierY, pierZ - 0.8]);
  applyWorldPlanarUVs(crossArm1, 0.28, 0.28, true);
  pierGeos.push(crossArm1);

  const crossArm2 = new THREE.BoxGeometry(1.15, 0.15, 5.6);
  xform(crossArm2, [18.4, pierY, pierZ - 0.4]);
  applyWorldPlanarUVs(crossArm2, 0.28, 0.28, true);
  pierGeos.push(crossArm2);

  const endConnect = new THREE.BoxGeometry(3.2, 0.14, 0.95);
  xform(endConnect, [16.9, pierY, pierZ - 3.6]);
  applyWorldPlanarUVs(endConnect, 0.28, 0.28, false);
  pierGeos.push(endConnect);

  function addPierPile(px, pz) {
    const pile = new THREE.CylinderGeometry(0.082, 0.092, 1.24, 10);
    xform(pile, [px, -0.05, pz]); // spans y = -0.67 to +0.57
    pierGeos.push(pile);
  }

  for (let px = 9.2; px <= 19.0; px += 1.4) {
    for (const pz of [-0.44, 0.44]) {
      addPierPile(px, pierZ + pz);
    }
  }
  for (const pz of [-11.5, -10.3, -9.1, -6.5, -5.5]) {
    for (const dx of [-0.40, 0.40]) {
      addPierPile(15.4 + dx, pz);
    }
  }
  for (const pz of [-10.5, -9.3, -6.6, -5.7]) {
    for (const dx of [-0.38, 0.38]) {
      addPierPile(18.4 + dx, pz);
    }
  }
  for (const px of [16.2, 17.6, 18.35]) {
    for (const dz of [-0.32, 0.32]) {
      addPierPile(px, pierZ - 3.6 + dz);
    }
  }

  // Stepped lakeside walkway & Pavilion-to-Pier causeway bridge (y = 0.56)
  const southLanding = new THREE.BoxGeometry(1.65, 0.24, 4.4);
  xform(southLanding, [8.95, 0.44, 6.6]);
  graniteGeos.push(southLanding);

  const southWalkway = new THREE.BoxGeometry(1.45, 0.24, 6.4);
  xform(southWalkway, [9.05, 0.44, 1.3]);
  graniteGeos.push(southWalkway);

  for (const wz of [0.2, 2.6]) {
    addPierPile(9.65, wz);
  }

  const pavSouthStep1 = new THREE.BoxGeometry(1.35, 0.14, 0.44);
  xform(pavSouthStep1, [9.2, 0.56, -1.75]);
  graniteGeos.push(pavSouthStep1);
  const pavSouthStep2 = new THREE.BoxGeometry(1.35, 0.14, 0.42);
  xform(pavSouthStep2, [9.25, 0.60, -1.55]);
  graniteGeos.push(pavSouthStep2);

  const causewayBridge = new THREE.BoxGeometry(1.35, 0.15, 3.6);
  xform(causewayBridge, [9.55, pierY, -6.1]);
  applyWorldPlanarUVs(causewayBridge, 0.28, 0.28, true);
  pierGeos.push(causewayBridge);

  const pavNorthStep1 = new THREE.BoxGeometry(1.35, 0.14, 0.42);
  xform(pavNorthStep1, [9.35, 0.57, -4.55]);
  graniteGeos.push(pavNorthStep1);
  const pavNorthStep2 = new THREE.BoxGeometry(1.35, 0.14, 0.40);
  xform(pavNorthStep2, [9.30, 0.61, -4.35]);
  graniteGeos.push(pavNorthStep2);

  for (const cz of [-5.2, -6.4]) {
    for (const cx of [9.05, 10.05]) {
      addPierPile(cx, cz);
    }
  }

  // Lakeside hexagonal viewing pavilion (凌波亭) at pavX = 9.25 on submerged granite steps
  const pavX = 9.25;
  const pavZ = -3.2;
  const pavBase = new THREE.CylinderGeometry(1.50, 1.60, 1.02, 6);
  xform(pavBase, [pavX, 0.17, pavZ]);
  graniteGeos.push(pavBase);
  const pavStep1 = new THREE.CylinderGeometry(1.80, 1.88, 0.40, 6);
  xform(pavStep1, [pavX, -0.08, pavZ]); // top = +0.12 (submerged 10cm below WATER_Y)
  graniteGeos.push(pavStep1);
  const pavStep2 = new THREE.CylinderGeometry(2.06, 2.14, 0.40, 6);
  xform(pavStep2, [pavX, -0.22, pavZ]); // top = -0.02 (submerged 24cm below WATER_Y)
  graniteGeos.push(pavStep2);

  const lakesideRoof = roofGroup(
    {
      halfW: 1.38,
      halfD: 1.38,
      H: 0.94,
      mode: 'hip',
      lift: 0.26,
      segU: 14,
      segV: 8,
      soffitInward: 0.48,
      rafters: true,
    },
    roofMats
  );
  lakesideRoof.position.set(pavX, 1.94, pavZ);
  group.add(lakesideRoof);

  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const col = new THREE.CylinderGeometry(0.065, 0.07, 1.24, 10);
    col.translate(pavX + Math.cos(a) * 1.12, 1.32, pavZ + Math.sin(a) * 1.12);
    const colM = new THREE.Mesh(col, crimsonColumnMat);
    colM.castShadow = true;
    group.add(colM);
  }

  // East Lake sightseeing tour boats (东湖游船) — gentle patrol + bobbing
  const boatHullMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f7f5f0'),
    roughness: 0.45,
    metalness: 0.05,
  });
  const boatDeckMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d9c8a8'),
    roughness: 0.7,
    metalness: 0.0,
  });
  const boatRoofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2f6f8f'),
    roughness: 0.5,
    metalness: 0.05,
  });
  const boatTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c7363a'),
    roughness: 0.5,
    metalness: 0.05,
  });
  const boatWindowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#bfe3f2'),
    roughness: 0.25,
    metalness: 0.1,
  });

  function buildTourBoat(seed) {
    const r = mulberry32(seed);
    const b = new THREE.Group();

    // Hull (soft trapezoid via tapered box + bow wedge)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.62, 1.5), boatHullMat);
    hull.position.y = 0.31;
    hull.castShadow = true;
    b.add(hull);
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.8), boatHullMat);
    bow.position.set(1.9, 0.26, 0);
    bow.rotation.z = -0.5;
    bow.castShadow = true;
    b.add(bow);

    // Waterline trim + deck
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.54, 0.12, 1.54), boatTrimMat);
    trim.position.y = 0.12;
    b.add(trim);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 1.3), boatDeckMat);
    deck.position.set(-0.2, 0.66, 0);
    b.add(deck);

    // Cabin with glazed windows
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.78, 1.14), boatHullMat);
    cabin.position.set(-0.75, 1.08, 0);
    cabin.castShadow = true;
    b.add(cabin);
    const glazing = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.42, 1.16), boatWindowMat);
    glazing.position.set(-0.75, 1.12, 0);
    b.add(glazing);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 1.32), boatRoofMat);
    roof.position.set(-0.75, 1.56, 0);
    roof.castShadow = true;
    b.add(roof);

    // Mast + small pennant
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), boatTrimMat);
    mast.position.set(1.35, 0.9, 0);
    b.add(mast);
    const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.02), boatTrimMat);
    pennant.position.set(1.44, 1.1, 0);
    b.add(pennant);

    b.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    });
    return b;
  }

  const tourBoats = [
    { cx: 34, cz: -34, radius: 3.4, omega: 0.16, phase: 0.0, seed: 4101 },
    { cx: 52, cz: 18, radius: 4.0, omega: 0.13, phase: 1.7, seed: 4102 },
    { cx: 58, cz: -82, radius: 4.4, omega: 0.10, phase: 3.1, seed: 4103 },
  ].map((cfg) => {
    const boat = buildTourBoat(cfg.seed);
    boat.renderOrder = 2;
    group.add(boat);
    return { config: cfg, boat };
  });

  /* ---------------------------------------------------------------------- */
  /* 7. Realistic Branching Yoshino Cherry Trees & Camphor Foliage Sprays   */
  /* ---------------------------------------------------------------------- */
  function buildBranchingTreeGeo(seed = 1, spread = 1.0) {
    const r = mulberry32(seed);
    const parts = [];
    const leanX = (r() - 0.5) * 0.30;
    const leanZ = (r() - 0.5) * 0.30;

    // 4-point S-curved tapered main trunk with root flare
    parts.push(
      taperedTubeAlong(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(leanX * 0.25, 0.55, leanZ * 0.25),
          new THREE.Vector3(leanX * 0.72, 1.12, leanZ * 0.65),
          new THREE.Vector3(leanX, 1.58, leanZ),
        ],
        0.21,
        0.095,
        8,
        9
      )
    );

    const twigTips = [];
    const boughCount = 4 + (seed % 2);
    for (let b = 0; b < boughCount; b++) {
      const ang = (b / boughCount) * Math.PI * 2 + (r() - 0.5) * 0.42;
      const reach = (0.92 + r() * 0.33) * spread;
      const midH = 1.98 + r() * 0.24;
      const topH = 2.40 + r() * 0.34;
      const bx = leanX + Math.cos(ang) * reach;
      const bz = leanZ + Math.sin(ang) * reach;

      // 4-point arched primary boughs
      parts.push(
        taperedTubeAlong(
          [
            new THREE.Vector3(leanX * 0.92, 1.38 + r() * 0.18, leanZ * 0.92),
            new THREE.Vector3(leanX + Math.cos(ang) * reach * 0.28, 1.78 + r() * 0.18, leanZ + Math.sin(ang) * reach * 0.28),
            new THREE.Vector3(leanX + Math.cos(ang) * reach * 0.68, midH + 0.18, leanZ + Math.sin(ang) * reach * 0.68),
            new THREE.Vector3(bx, topH, bz),
          ],
          0.080,
          0.022,
          6,
          8
        )
      );
      twigTips.push([bx, topH, bz]);

      // 3-point curved secondary twigs tucked >=0.35 units inside blossom crowns
      for (let st = -1; st <= 1; st += 2) {
        const subAng = ang + st * (0.45 + r() * 0.35);
        const subR = (0.35 + r() * 0.20) * spread;
        const midSubX = leanX + Math.cos(ang) * reach * 0.72 + Math.cos(subAng) * subR * 0.45;
        const midSubZ = leanZ + Math.sin(ang) * reach * 0.72 + Math.sin(subAng) * subR * 0.45;
        const sx = bx + Math.cos(subAng) * subR;
        const sy = topH + 0.04 + r() * 0.18;
        const sz = bz + Math.sin(subAng) * subR;
        parts.push(
          taperedTubeAlong(
            [
              new THREE.Vector3(leanX + Math.cos(ang) * reach * 0.68, midH + 0.16, leanZ + Math.sin(ang) * reach * 0.68),
              new THREE.Vector3(midSubX, topH + 0.08, midSubZ),
              new THREE.Vector3(sx, sy, sz),
            ],
            0.026,
            0.008,
            5,
            6
          )
        );
        twigTips.push([sx, sy, sz]);
      }
    }

    return { trunkGeo: mergeSafe(parts), twigTips };
  }

  const sakuraTreeCoords = [
    // Outer Archway Plaza framing trees (Stage 1 portal framing)
    { pos: [-8.2, 0.15, 22.8], scale: 1.18 },
    { pos: [8.2, 0.15, 22.8], scale: 1.18 },
    { pos: [-10.4, 0.15, 19.2], scale: 1.12 },
    { pos: [10.4, 0.15, 19.2], scale: 1.12 },
    { pos: [-8.6, 0.15, 15.8], scale: 1.22 },
    { pos: [8.6, 0.15, 15.8], scale: 1.22 },

    // Visible through and safely behind the Archway bays (clear of stone beams & Stop 02 sightline!)
    { pos: [-7.4, 0.1, 10.6], scale: 1.12 },
    { pos: [4.9, 0.1, 10.2], scale: 1.12 },
    { pos: [-8.0, 0.1, 10.6], scale: 1.08 },
    { pos: [7.1, 0.1, 10.6], scale: 1.12 },

    // Main Cherry Blossom Avenue (樱花大道) — parted wide to open the 108-step staircase sightline
    { pos: [-8.6, 0.1, 8.6], scale: 1.08 },
    { pos: [4.8, 0.1, 8.6], scale: 1.08 },
    { pos: [-10.2, 0.1, 8.2], scale: 1.06 },
    { pos: [6.7, 0.1, 8.2], scale: 1.08 },
    { pos: [-8.8, 0.15, 5.4], scale: 1.1 },
    { pos: [3.8, 0.15, 5.6], scale: 1.08 },
    { pos: [-10.2, 0.25, 5.0], scale: 1.06 },
    { pos: [6.8, 0.15, 4.2], scale: 1.16 }, // Screens right archway sightline from Lingbo Pier

    // Flanking Old Dormitory & 108-Step Staircase (clear all 3 gatehouse silhouettes, mirrored on the axis)
    { pos: [-11.4, 2.15, 1.8], scale: 1.1 },
    { pos: [-11.2, 2.15, 2.0], scale: 1.02 },
    { pos: [7.0, 2.15, 2.1], scale: 1.02 },
    { pos: [7.3, 2.15, 1.8], scale: 1.1 },
    { pos: [-12.2, 2.15, -0.5], scale: 1.08 },
    { pos: [7.1, 2.15, -0.4], scale: 1.1 },

    // Around Old Library on Lion Hill Crest (樱顶老图樱云, mirrored on the axis)
    { pos: [-5.9, 4.55, -7.0], scale: 1.15 },
    { pos: [5.9, 4.55, -7.0], scale: 1.15 },
    { pos: [-7.2, 4.55, -6.4], scale: 1.1 },
    { pos: [7.2, 4.55, -6.5], scale: 1.1 },
    { pos: [-5.0, 4.55, -11.2], scale: 1.12 },
    { pos: [5.0, 4.55, -11.2], scale: 1.12 },

    // Lakeside & retaining-wall overhang sakura along promenade
    { pos: [6.9, 0.35, 1.6], scale: 1.1 },
    { pos: [6.8, 0.35, -1.2], scale: 1.08 },
    { pos: [6.5, 2.15, -2.5], scale: 1.04 },
    { pos: [7.4, 4.55, -11.5], scale: 1.04 },
    { pos: [7.8, 4.55, -8.4], scale: 1.06 },
  ];

  const trunkGeos = [];
  const outerSprayMatrices = [];
  const innerSprayMatrices = [];

  sakuraTreeCoords.forEach((tree, idx) => {
    const s = tree.scale;
    const rotY = (idx * 1.73) % (Math.PI * 2);
    const { trunkGeo, twigTips } = buildBranchingTreeGeo(300 + idx, 1.0);
    xform(trunkGeo, tree.pos, [0, rotY, 0], [s, s, s]);
    trunkGeos.push(trunkGeo);

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const tr = mulberry32(700 + idx * 13);

    // Place 3 fuller domed blossom sprays around every twig tip + crown apex
    const sprayAnchors = [...twigTips, [0, 3.05, 0], [0.28, 2.85, -0.22], [-0.26, 2.82, 0.25]];
    sprayAnchors.forEach((pt) => {
      const subCount = 3;
      for (let k = 0; k < subCount; k++) {
        const lx = pt[0] + (tr() - 0.5) * 0.62;
        const ly = pt[1] + (tr() - 0.35) * 0.42;
        const lz = pt[2] + (tr() - 0.5) * 0.62;

        const wx = tree.pos[0] + (lx * cos - lz * sin) * s;
        const wy = tree.pos[1] + ly * s;
        const wz = tree.pos[2] + (lx * sin + lz * cos) * s;

        dummy.position.set(wx, wy, wz);
        dummy.rotation.set((tr() - 0.5) * 0.42, tr() * Math.PI * 2, (tr() - 0.5) * 0.42);
        const cardScale = (0.92 + tr() * 0.42) * s;
        dummy.scale.set(cardScale, cardScale * (0.85 + tr() * 0.22), cardScale);
        dummy.updateMatrix();

        if (ly > 2.45 || tr() > 0.36) {
          outerSprayMatrices.push(dummy.matrix.clone());
        } else {
          innerSprayMatrices.push(dummy.matrix.clone());
        }
      }
    });
  });

  // Green Luojia Camphor trees on campus hills, dry shore banks & continuous West/North-West Luojia ridges
  const greenTreeCoords = [
    [-14.5, 0.1, 12.5, 1.3],
    [14.2, 0.1, 14.5, 1.22], // strictly south of z=9.05 seawall!
    [-14.8, 2.2, -3.5, 1.35],
    [-13.5, 4.5, -10.5, 1.4],
    [-8.5, 4.6, -14.8, 1.38],
    [-3.2, 4.6, -15.6, 1.42],
    [4.2, 4.6, -15.4, 1.38],
    [-15.5, 1.8, 5.5, 1.25],
    [-17.2, 0.2, 16.5, 1.2],
    [18.2, 0.1, 13.8, 1.25],
    [14.2, 0.1, -17.6, 1.28], // north bank greenery behind north seawall
    [20.2, 0.1, -17.2, 1.18],
    // Continuous forested Luojia Mountain flank & northern/southern hills (grounded via luojiaHeight)
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
    [18.0, 0, 28.0, 1.36],
    // Distant Luojia ridge camphor stands (grounded via luojiaHeight) — horizon forest veil
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
  greenTreeCoords.forEach(([gx, gy, gz, gs], idx) => {
    const baseH = Math.max(gy, luojiaHeight(gx, gz) - 0.08);
    const { trunkGeo, twigTips } = buildBranchingTreeGeo(500 + idx, 0.92);
    const rotY = idx * 1.1;
    xform(trunkGeo, [gx, baseH, gz], [0, rotY, 0], [gs, gs, gs]);
    trunkGeos.push(trunkGeo);

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const tr = mulberry32(950 + idx * 17);
    const anchors = [...twigTips, [0, 3.1, 0], [0.3, 2.8, 0.3], [-0.3, 2.85, -0.25]];
    anchors.forEach((pt) => {
      for (let k = 0; k < 2; k++) {
        const lx = pt[0] + (tr() - 0.5) * 0.78;
        const ly = pt[1] + (tr() - 0.35) * 0.45;
        const lz = pt[2] + (tr() - 0.5) * 0.78;
        dummy.position.set(
          gx + (lx * cos - lz * sin) * gs,
          baseH + ly * gs,
          gz + (lx * sin + lz * cos) * gs
        );
        dummy.rotation.set((tr() - 0.5) * 0.38, tr() * Math.PI * 2, (tr() - 0.5) * 0.38);
        const sc = (1.28 + tr() * 0.52) * gs;
        dummy.scale.set(sc, sc * 0.9, sc);
        dummy.updateMatrix();
        camphorSprayMatrices.push(dummy.matrix.clone());
      }
    });
  });

  // Far Luojia ridges are read through terrain undulation + camphor canopy (no smooth "bun" blobs)

  // Cascading ivy & shrubbery safely tucked inward on Tier 2 lawn + North/South shore banks (zero mid-wall/pier clipping)
  const shrubCoords = [
    [8.32, 4.62, -14.8, 1.05],
    [8.32, 4.62, -12.6, 1.02],
    [8.32, 4.62, -10.2, 1.08],
    [8.32, 4.62, -7.8, 1.02],
    [8.32, 4.62, -5.4, 1.05],
    [7.0, 4.62, -4.85, 0.98],
    [4.6, 4.62, -4.85, 0.95],
    // North & South seawall shoreline banks & East promenade screen hedge
    [16.5, 0.42, -16.0, 1.15],
    [22.0, 0.42, -16.0, 1.1],
    [24.5, 0.42, -15.8, 1.05],
    [21.5, 0.42, 10.2, 1.15],
    [26.0, 0.42, 10.2, 1.08],
    [7.4, 0.95, 9.6, 1.25],
    [7.4, 0.95, 6.2, 1.25],
    [7.4, 0.95, 3.0, 1.2],
  ];
  shrubCoords.forEach(([sx, sy, sz, ss], idx) => {
    const sr = mulberry32(1400 + idx * 29);
    for (let k = 0; k < 4; k++) {
      const px = sx + (sr() - 0.5) * 0.48;
      const py = sy + (sr() - 0.4) * 0.36;
      const pz = sz + (sr() - 0.5) * 0.72;
      const inPierBox = px >= 7.8 && px <= 20.0 && pz >= -9.2 && pz <= -6.4;
      const inPavRad = Math.hypot(px - pavX, pz - pavZ) < 2.25;
      if (inPierBox || inPavRad) continue;
      dummy.position.set(px, py, pz);
      dummy.rotation.set((sr() - 0.5) * 0.5, sr() * Math.PI * 2, (sr() - 0.5) * 0.5);
      const sc = (0.78 + sr() * 0.45) * ss;
      dummy.scale.set(sc * 1.1, sc * 0.78, sc * 1.1);
      dummy.updateMatrix();
      camphorSprayMatrices.push(dummy.matrix.clone());
    }
  });

  const allTrunksMesh = new THREE.Mesh(mergeSafe(trunkGeos), barkMat);
  allTrunksMesh.castShadow = true;
  allTrunksMesh.receiveShadow = true;
  group.add(allTrunksMesh);

  const sprayCardGeo = crossedSprayGeometry(1.18, 3);
  function buildFoliageInstanced(matrices, mat, depthMat) {
    const inst = new THREE.InstancedMesh(sprayCardGeo, mat, matrices.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.customDepthMaterial = depthMat;
    matrices.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }

  group.add(buildFoliageInstanced(outerSprayMatrices, sakuraOuterMat, sakuraDepthMat));
  group.add(buildFoliageInstanced(innerSprayMatrices, sakuraInnerMat, sakuraDepthMat));
  group.add(buildFoliageInstanced(camphorSprayMatrices, camphorLeafMat, camphorDepthMat));

  /* ---------------------------------------------------------------------- */
  /* 8. Finalize Static Stone & Lawn Batches                                */
  /* ---------------------------------------------------------------------- */
  const graniteBatch = new THREE.Mesh(mergeSafe(graniteGeos), graniteMat);
  graniteBatch.castShadow = true;
  graniteBatch.receiveShadow = true;
  group.add(graniteBatch);

  const warmStoneBatch = new THREE.Mesh(mergeSafe(warmStoneGeos), warmStoneMat);
  warmStoneBatch.castShadow = true;
  warmStoneBatch.receiveShadow = true;
  group.add(warmStoneBatch);

  const ashlarBatch = new THREE.Mesh(mergeSafe(ashlarGeos), ashlarMat);
  ashlarBatch.castShadow = true;
  ashlarBatch.receiveShadow = true;
  group.add(ashlarBatch);

  const pierBatch = new THREE.Mesh(mergeSafe(pierGeos), pierMat);
  pierBatch.castShadow = true;
  pierBatch.receiveShadow = true;
  group.add(pierBatch);

  const grassBatch = new THREE.Mesh(mergeSafe(grassGeos), grassMat);
  grassBatch.receiveShadow = true;
  group.add(grassBatch);

  /* ---------------------------------------------------------------------- */
  /* 9. Fallen Sakura Petals on the White Plaza + 420 Fluttering Petals     */
  /* ---------------------------------------------------------------------- */
  const petalGeo = petalGeometry(0.085);
  const petalMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color('#ffcadf'),
    emissive: new THREE.Color('#ffdce9'),
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });

  const fallenCount = 480;
  const fallenInst = new THREE.InstancedMesh(petalGeo, petalMat, fallenCount);
  for (let i = 0; i < fallenCount; i++) {
    const px = (rand() - 0.5) * 20.0;
    const pz = 4.6 + rand() * 25.0;
    // Keep fallen petals off East Lake (x >= 7.8 when z <= 9.2)
    const safeX = pz <= 9.4 ? Math.min(px, 7.3) : px;
    dummy.position.set(safeX, 0.145, pz);
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
    let y = 0.6 + rand() * 11.5;
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

  lockStatic(group);
  airPetals.matrixAutoUpdate = false;

  const _reflForward = new THREE.Vector3();
  const _reflTarget = new THREE.Vector3();
  const _reflUp = new THREE.Vector3();
  const _clipPt = new THREE.Vector3();
  const _clipNormal = new THREE.Vector3();
  const _normalMat = new THREE.Matrix3();
  const _clipPlane = new THREE.Vector4();
  const _qVec = new THREE.Vector4();
  const _frustum = new THREE.Frustum();
  const _projScreenMatrix = new THREE.Matrix4();
  const _lakeBounds = new THREE.Box3(
    new THREE.Vector3(7.9, -0.6, -172.0),
    new THREE.Vector3(172.0, 0.3, 172.0)
  );

  function syncShadowLight(keyLight) {
    if (keyLight && keyLight.shadow && keyLight.shadow.map) {
      waterUniforms.uShadowMap.value = keyLight.shadow.map.texture;
      waterUniforms.uShadowMatrix.value.copy(keyLight.shadow.matrix);
      waterUniforms.uShadowMapSize.value.copy(keyLight.shadow.mapSize);
      waterUniforms.uHasShadowMap.value = 1.0;
    }
  }

  function updateWaterReflection(renderer, scene, camera, keyLight, setSkyLinearOutput) {
    if (camera.position.y <= WATER_Y + 0.02) {
      waterUniforms.uHasReflection.value = 0.0;
      syncShadowLight(keyLight);
      return;
    }

    camera.updateMatrixWorld();
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    if (!_frustum.intersectsBox(_lakeBounds)) {
      syncShadowLight(keyLight);
      return;
    }

    // Mirror camera position, look target & up vector across y = WATER_Y
    reflectCam.position.set(camera.position.x, 2 * WATER_Y - camera.position.y, camera.position.z);

    _reflForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _reflTarget.copy(camera.position).add(_reflForward);
    _reflTarget.y = 2 * WATER_Y - _reflTarget.y;

    _reflUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    reflectCam.up.set(-_reflUp.x, _reflUp.y, -_reflUp.z);
    if (reflectCam.up.lengthSq() < 1e-6) {
      reflectCam.up.set(0, 1, 0);
    } else {
      reflectCam.up.normalize();
    }

    reflectCam.fov = camera.fov;
    reflectCam.aspect = camera.aspect;
    reflectCam.near = camera.near;
    reflectCam.far = camera.far;
    reflectCam.lookAt(_reflTarget);
    reflectCam.updateMatrixWorld();
    reflectCam.updateProjectionMatrix();

    // Lengyel oblique near-clip plane at y = WATER_Y - 0.005 so underwater geometry never leaks
    _clipPt.set(0, WATER_Y - 0.005, 0).applyMatrix4(reflectCam.matrixWorldInverse);
    _normalMat.getNormalMatrix(reflectCam.matrixWorldInverse);
    _clipNormal.set(0, 1, 0).applyMatrix3(_normalMat).normalize();
    _clipPlane.set(_clipNormal.x, _clipNormal.y, _clipNormal.z, -_clipPt.dot(_clipNormal));

    const proj = reflectCam.projectionMatrix;
    const pe = proj.elements;
    _qVec.x = (Math.sign(_clipPlane.x) + pe[8]) / pe[0];
    _qVec.y = (Math.sign(_clipPlane.y) + pe[9]) / pe[5];
    _qVec.z = -1.0;
    _qVec.w = (1.0 + pe[10]) / pe[14];

    const dotQ = _clipPlane.dot(_qVec);
    if (Math.abs(dotQ) > 1e-5) {
      const scale = 2.0 / dotQ;
      pe[2] = _clipPlane.x * scale;
      pe[6] = _clipPlane.y * scale;
      pe[10] = _clipPlane.z * scale + 1.0;
      pe[14] = _clipPlane.w * scale;
    }

    waterUniforms.uReflectMatrix.value
      .copy(reflectCam.projectionMatrix)
      .multiply(reflectCam.matrixWorldInverse);

    const prevTarget = renderer.getRenderTarget();
    const prevToneMapping = renderer.toneMapping;
    const prevXr = renderer.xr.enabled;

    eastLakeMesh.visible = false;
    airPetals.visible = false;
    fallenInst.visible = false;
    setSkyLinearOutput?.(true);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.xr.enabled = false;
    renderer.setRenderTarget(reflectRT);
    renderer.clear();
    renderer.render(scene, reflectCam);

    setSkyLinearOutput?.(false);
    renderer.setRenderTarget(prevTarget);
    renderer.toneMapping = prevToneMapping;
    renderer.xr.enabled = prevXr;
    fallenInst.visible = true;
    airPetals.visible = true;
    eastLakeMesh.visible = true;

    waterUniforms.tReflection.value = reflectRT.texture;
    waterUniforms.uHasReflection.value = 1.0;
    syncShadowLight(keyLight);
  }

  function setMood(mood) {
    if (mood === 'sunset' || mood === 'convergence') {
      sunDirUniform.value.set(-24, 17, 16).normalize();
      waterUniforms.uSunDir.value.copy(sunDirUniform.value);
      sunsetWarmthUniform.value = 1.0;
      dormWallMat.emissiveIntensity = 0.92;
      libWallMat.emissiveIntensity = 1.05;
      glazedTileMat.color.set('#2694a4');
      glazedTileMat.emissiveIntensity = 0.12;
      sakuraOuterMat.color.set('#ffeaf2');
      sakuraInnerMat.color.set('#ffc2da');
      cityFootMat.color.set('#5e5a70');
      horizonColorUniform.value.set('#ffd2c5');
      waterUniforms.uDeepColor.value.set('#233b66');
      waterUniforms.uShallowColor.value.set('#5a8ba6');
      waterUniforms.uSkyColor.value.set('#d993b8');
      waterUniforms.uSunColor.value.set('#ffd29c');
      petalMat.color.set('#df9eb8');
      petalMat.emissive.set('#b86f8c');
      petalMat.emissiveIntensity = 0.12;
      petalMat.opacity = 0.72;
    } else {
      sunDirUniform.value.set(28, 22, 19).normalize();
      waterUniforms.uSunDir.value.copy(sunDirUniform.value);
      sunsetWarmthUniform.value = 0.0;
      dormWallMat.emissiveIntensity = 0.12;
      libWallMat.emissiveIntensity = 0.14;
      glazedTileMat.color.set('#2ba6b4');
      glazedTileMat.emissiveIntensity = 0.06;
      sakuraOuterMat.color.set('#fff9fc');
      sakuraInnerMat.color.set('#ffdbe9');
      cityFootMat.color.set('#5a6e6a');
      farCityMat.color.set('#8da0b2');
      cityHazeColor.value.set('#9fb9cd');
      horizonColorUniform.value.set('#f7ebf2');
      waterUniforms.uDeepColor.value.set('#0d4f63');
      waterUniforms.uShallowColor.value.set('#3d9aa8');
      waterUniforms.uSkyColor.value.set('#cfe9ff');
      waterUniforms.uSunColor.value.set('#fff6e4');
      petalMat.color.set('#ffcadf');
      petalMat.emissive.set('#ffdce9');
      petalMat.emissiveIntensity = 0.25;
      petalMat.opacity = 0.88;
    }
  }

  function updateCampus(dt, elapsed, camPos = null) {
    sharedTimeUniform.value = elapsed;

    // East Lake tour boats: gentle circular patrol + wave bob + roll
    for (const { config, boat } of tourBoats) {
      const t = elapsed * config.omega + config.phase;
      const px = config.cx + Math.cos(t) * config.radius;
      const pz = config.cz + Math.sin(t) * config.radius * 0.7;
      const heading = Math.atan2(Math.cos(t) * config.radius * 0.7, -Math.sin(t) * config.radius);
      const bob = Math.sin(elapsed * 1.6 + config.phase) * 0.06;
      const roll = Math.sin(elapsed * 1.2 + config.phase) * 0.05;
      boat.position.set(
        px,
        WATER_Y + 0.18 + bob,
        pz
      );
      boat.rotation.set(roll, -heading + Math.PI * 0.5, roll * 0.4);
      boat.updateMatrix();
    }

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
  }

  return {
    group,
    setMood,
    updateCampus,
    updateWaterReflection,
    syncShadowLight,
  };
}
