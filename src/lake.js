import * as THREE from 'three';
import { mergeSafe, xform, lockStatic, roofGroup } from './geo.js';
import { applyWorldPlanarUVs, shoreX, WATER_Y } from './materials.js';

/**
 * Independent component: Seamless East Lake (东湖) with planar reflection & GLSL water,
 * granite seawalls, Lingbo Pier (凌波门水上栈桥), Lakeside Pavilion (凌波亭), and Tour Boats.
 */
export function createLakeComponent(textures, palette) {
  const group = new THREE.Group();
  group.name = 'component-east-lake-lingbo';

  const graniteGeos = [];
  const pierGeos = [];

  const reflectRT = new THREE.WebGLRenderTarget(512, 320, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    samples: 0,
  });
  let reflectW = 512;
  let reflectH = 320;
  function setReflectionSize(w, h) {
    if (w === reflectW && h === reflectH) return;
    reflectW = w;
    reflectH = h;
    reflectRT.setSize(w, h);
  }
  const reflectCam = new THREE.PerspectiveCamera();

  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: palette.sharedTimeUniform,
      uDeepColor: { value: new THREE.Color('#0c353f') },
      uShallowColor: { value: new THREE.Color('#1d545d') },
      uSkyColor: { value: new THREE.Color('#cfe9ff') },
      uHorizonColor: palette.horizonColorUniform,
      uSunColor: { value: new THREE.Color('#fff6e4') },
      uSunDir: { value: new THREE.Vector3(28, 22, 19).normalize() },
      uSunsetWarmth: palette.sunsetWarmthUniform,
      tReflection: { value: null },
      uHasReflection: { value: 0.0 },
      uReflectMatrix: { value: new THREE.Matrix4() },
      tShadowMap: undefined,
      uShadowMap: { value: null },
      uHasShadowMap: { value: 0.0 },
      uShadowMatrix: { value: new THREE.Matrix4() },
      uShadowMapSize: { value: new THREE.Vector2(2048, 2048) },
      uShadowBias: { value: -0.00024 },
      uBoatPos: { value: new THREE.Vector2(16.8, -3.2) },
      uBoatCs: { value: new THREE.Vector2(1.0, 0.0) },
      uLinearOutput: { value: 0.0 },
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
      uniform vec2 uBoatPos;
      uniform vec2 uBoatCs;
      uniform float uLinearOutput;
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
        float spread = 2.0;
        float sum = 0.0;
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / 5.0) * spread;
          float th = fi * 2.3999632;
          vec2 off = rot * (vec2(cos(th), sin(th)) * r) * texel;
          sum += step(compare, unpackRGBAToDepth(texture2D(uShadowMap, proj.xy + off)));
        }
        return sum * 0.2;
      }

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

      vec4 evalDualWaveGrad(vec2 p, float t, float camDist, float vy) {
        float footprint = camDist * 0.018 / max(vy, 0.08);
        const mat2 ROT37 = mat2(0.80, -0.60, 0.60, 0.80);
        const mat2 ROT37_T = mat2(0.80, 0.60, -0.60, 0.80);
        vec2 q = p;
        vec2 macroG = vec2(0.0);
        vec2 capG = vec2(0.0);

        float freqs[5];
        freqs[0] = 0.72; freqs[1] = 1.38; freqs[2] = 2.65; freqs[3] = 5.40; freqs[4] = 10.80;
        float amps[5];
        amps[0] = 0.034; amps[1] = 0.030; amps[2] = 0.036; amps[3] = 0.026; amps[4] = 0.018;
        vec2 vels[5];
        vels[0] = vec2(0.62, -0.48); vels[1] = vec2(-0.72, 0.55);
        vels[2] = vec2(0.85, 0.62);  vels[3] = vec2(-1.05, -0.72); vels[4] = vec2(1.30, -0.85);

        vec2 rp = q;
        mat2 invAcc = mat2(1.0);
        for (int i = 0; i < 5; i++) {
          if (i >= 3 && camDist > 42.0) break;
          float f = freqs[i];
          float aa = 1.0 / (1.0 + f * f * footprint * footprint * 0.35);
          vec3 ng = noiseGrad2D(rp * f + vels[i] * t);
          vec2 gWorld = (invAcc * ng.yz) * f * amps[i] * aa;
          if (i < 2) macroG += gWorld;
          else       capG   += gWorld;
          rp = ROT37 * rp;
          invAcc = invAcc * ROT37_T;
        }
        float horizonSmooth = smoothstep(0.008, 0.09, vy) * mix(1.0, 0.35, smoothstep(30.0, 160.0, camDist));
        return vec4(macroG * horizonSmooth, capG * horizonSmooth);
      }

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
        float dPav = max(0.0, sdHexagon2D(p - vec2(10.72, -3.2), 1.54));
        float distShore = min(min(dWest, dPav), min(min(dNorth, dSouth), min(dNorthOuter, dSouthOuter)));

        float dMain = sdBox2D(p - vec2(14.33, -7.8), vec2(5.07, 0.60));
        float dArm1 = sdBox2D(p - vec2(15.4, -8.6), vec2(0.575, 3.4));
        float dArm2 = sdBox2D(p - vec2(18.4, -8.2), vec2(0.575, 2.8));
        float dEnd = sdBox2D(p - vec2(16.9, -11.4), vec2(1.6, 0.475));
        float dCause = sdBox2D(p - vec2(10.72, -5.8), vec2(0.68, 1.40));
        float dPier = min(min(min(dMain, dArm1), min(dArm2, dEnd)), dCause);

        float dPilings = (p.x > 7.4 && p.x < 20.6 && p.y > -13.2 && p.y < -3.8)
          ? evalPilingsDist(p)
          : 100.0;

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec4 wg = evalDualWaveGrad(p, uTime, camDist, V.y);

        float shoreRipple = cos(distShore * 9.5 - uTime * 2.4) * smoothstep(1.8, 0.04, distShore) * 0.022 * detailFade;
        float pilingRipple = cos(dPilings * 13.5 - uTime * 2.2) * smoothstep(1.15, 0.02, dPilings) * 0.018 * detailFade;
        vec2 windUv = vec2(p.x * 0.82 + p.y * 0.57, -p.x * 0.57 + p.y * 0.82);
        vec2 calmFloor = vec2(0.82, 0.57) * (
          cos(windUv.x * 3.8 - uTime * 2.1 + sin(windUv.y * 1.4)) * 0.022 +
          cos(windUv.x * 8.2 - uTime * 2.9 + cos(windUv.y * 2.6)) * 0.014
        ) * detailFade;
        vec2 grad = wg.xy * 1.95 + wg.zw * 2.25 + calmFloor * 1.65 + vec2(shoreRipple + pilingRipple, shoreRipple - pilingRipple) * 0.95;

        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
        // Schlick Fresnel with lively miniature shallow grazing curve
        float cosTheta = max(0.0, dot(N, V));
        float fresnel = 0.045 + 0.955 * pow(1.0 - cosTheta, 3.2);

        float shoreDepth = mix(0.22, 2.4, smoothstep(0.0, 2.6, distShore));
        vec2 bpRel = p - uBoatPos;
        vec2 bpLoc = vec2(bpRel.x * uBoatCs.x + bpRel.y * uBoatCs.y, -bpRel.x * uBoatCs.y + bpRel.y * uBoatCs.x);
        float bowTaper = clamp((bpLoc.x - 0.62) / 1.22, 0.0, 1.0);
        float halfBeam = mix(0.60, 0.14, smoothstep(0.0, 1.0, bowTaper));
        float dBoat = sdBox2D(bpLoc - vec2(0.16, 0.0), vec2(1.66, halfBeam));
        float waterDepth = shoreDepth;
        vec3 absorption = exp(-waterDepth * vec3(4.5, 2.5, 1.6));
        float shallowMask = 1.0 - smoothstep(0.0, 2.4, distShore);
        vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(absorption.g * 0.42 + shallowMask * 0.2, 0.0, 1.0));

        float shadowFactor = sampleKeyShadow(vShadowCoord);
        float pierAO = mix(0.70, 1.0, smoothstep(-0.35, 1.85, dPier));
        float pierUnderMask = smoothstep(-0.25, 1.15, dPier);
        float boatAO = mix(0.64, 1.0, smoothstep(0.0, 0.48, dBoat));
        float pavAO = mix(0.74, 1.0, smoothstep(0.0, 1.25, dPav));
        float shoreContact = mix(0.38, 1.0, smoothstep(0.0, 1.25, distShore));
        float litDiffuse = mix(0.48, 1.0, shadowFactor) * pierAO * boatAO * pavAO * shoreContact;
        baseWater *= litDiffuse;

        vec3 R = reflect(-V, N);
        float ry = clamp(R.y, 0.0, 1.0);
        float waveShading = 1.0 + clamp(dot(grad, vec2(0.8, 1.4)) * 4.5, -0.22, 0.28);
        vec3 skyFallback = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 0.38, ry)) * waveShading;
        vec3 reflCol = skyFallback;
        if (uHasReflection > 0.5 && vReflectCoord.w > 0.001) {
          vec2 rawUv = (vReflectCoord.xy / vReflectCoord.w) * 0.5 + 0.5;
          float distDamp = 1.0 / (1.0 + camDist * 0.024);
          vec2 wavePerturb = wg.xy * vec2(0.24, 1.05) * distDamp + wg.zw * vec2(0.42, 1.65);
          vec2 perturb = wavePerturb * vec2(0.055, 0.135) + calmFloor * vec2(0.022, 0.048);
          vec2 reflUv = clamp(rawUv + perturb, vec2(0.002), vec2(0.998));
          vec3 sampledRefl = texture2D(tReflection, reflUv).rgb;
          float inBounds =
            smoothstep(-0.04, 0.0, rawUv.x) *
            smoothstep(1.04, 1.0, rawUv.x) *
            smoothstep(-0.04, 0.0, rawUv.y) *
            smoothstep(1.04, 1.0, rawUv.y);
          reflCol = mix(skyFallback, sampledRefl, inBounds);
        }
        reflCol *= mix(0.42, 1.0, mix(shadowFactor, 1.0, 0.35) * pierUnderMask);

        float reflWeight = clamp((mix(0.16, 0.25, uSunsetWarmth) + fresnel * 0.64) * mix(0.38, 1.0, pierUnderMask), 0.0, 0.78);
        vec3 col = mix(baseWater * waveShading, reflCol, reflWeight);
        float wetContact =
          mix(0.64, 1.0, smoothstep(-0.04, 0.42, dPier)) *
          mix(0.84, 1.0, smoothstep(0.0, 0.22, dPilings)) *
          mix(0.72, 1.0, smoothstep(0.0, 0.48, distShore));
        col *= wetContact;

        vec3 H = normalize(vec3(uSunDir.x, uSunDir.y * 0.85, uSunDir.z) + V);
        float specMask = shadowFactor * smoothstep(-0.04, 0.38, dPier) * smoothstep(0.0, 0.32, dPav);
        float ndh = max(0.0, dot(N, H));
        float specSharp = pow(ndh, 150.0) * 0.72 * specMask;
        float specSparkle = pow(ndh, 34.0) * 0.24 * specMask;
        float microGlint = pow(max(0.0, dot(normalize(vec3(-grad.x * 2.2, 1.0, -grad.y * 2.2)), H)), 90.0) * 0.36 * specMask;

        vec3 sunHorizDir = normalize(vec3(uSunDir.x, 0.52, uSunDir.z));
        float sunCrest = pow(max(0.0, dot(N, sunHorizDir)), 3.0);
        float sunsetGrazing = pow(1.0 - cosTheta, 1.65) * 0.42 + sunCrest * 0.45;
        float sunsetAmber = pow(max(0.0, dot(N, normalize(sunHorizDir + V * 0.35))), 48.0) * 0.58;
        float sunsetWash = (sunsetGrazing + sunsetAmber) * uSunsetWarmth * mix(0.10, 1.0, shadowFactor * pierAO);
        col += uSunColor * (specSharp + specSparkle + microGlint);
        col += mix(vec3(0.96, 0.68, 0.76), vec3(1.0, 0.74, 0.42), clamp(sunCrest + sunsetAmber, 0.0, 1.0)) * sunsetWash;

        float wallEdgeDist = min(min(dWest, dNorth), min(dSouth, min(dNorthOuter, dSouthOuter)));
        float meniscusWave = 0.55 + 0.45 * sin((p.x * 3.4 + p.y * 2.6) + uTime * 2.1);
        float meniscus = smoothstep(0.18, 0.0, wallEdgeDist) * meniscusWave;
        float pilingMeniscus = smoothstep(0.28, 0.0, dPilings) * (0.55 + 0.45 * cos(dPilings * 28.0 - uTime * 2.2));
        float boatRing = smoothstep(0.62, 0.02, max(0.0, dBoat)) * (0.52 + 0.48 * cos(max(0.0, dBoat) * 22.0 - uTime * 2.4));
        col += mix(uShallowColor, vec3(0.96, 0.98, 1.0), 0.82) * (meniscus * 0.16 + pilingMeniscus * 0.22 + boatRing * 0.34) * mix(0.62, 1.0, shadowFactor);

        float horizonHaze = smoothstep(68.0, 148.0, camDist);
        col = mix(col, uHorizonColor, horizonHaze);

        float openOpaque = smoothstep(0.15, 1.1, distShore);
        float depthAlpha = mix(1.0 - exp(-waterDepth * 2.5), 1.0, openOpaque);
        float specLuma = clamp(dot(uSunColor * (specSharp + specSparkle), vec3(0.3, 0.6, 0.1)), 0.0, 1.0);
        float alpha = clamp(max(mix(depthAlpha, 1.0, fresnel * 0.68), specLuma * 0.85), 0.88, 1.0);
        alpha *= 1.0 - smoothstep(148.0, 161.5, camDist);

        gl_FragColor = vec4(col, alpha);
        if (uLinearOutput < 0.5) {
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      }
    `,
  });

  const R_LAKE = 163.0;
  const zNorthMax = -154.0;
  const zSouthMax = 144.0;
  const eastLakeShape = new THREE.Shape();
  eastLakeShape.moveTo(7.98, -9.03);
  eastLakeShape.lineTo(7.98, 15.18);
  eastLakeShape.lineTo(26.4, 15.18);
  for (let i = 1; i <= 48; i++) {
    const z = THREE.MathUtils.lerp(-15.2, zNorthMax, i / 48);
    eastLakeShape.lineTo(shoreX(z) - 0.65, -z);
  }
  const angN = Math.atan2(-zNorthMax, shoreX(zNorthMax) - 0.65);
  const angS = Math.atan2(-zSouthMax, shoreX(zSouthMax) - 0.65);
  for (let i = 1; i <= 36; i++) {
    const a = THREE.MathUtils.lerp(angN, angS, i / 36);
    eastLakeShape.lineTo(Math.cos(a) * R_LAKE, Math.sin(a) * R_LAKE);
  }
  for (let i = 0; i <= 48; i++) {
    const z = THREE.MathUtils.lerp(zSouthMax, 9.05, i / 48);
    eastLakeShape.lineTo(shoreX(z) - 0.65, -z);
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

  const eastLakeBedGeo = new THREE.PlaneGeometry(36, 64);
  const eastLakeBed = new THREE.Mesh(eastLakeBedGeo, palette.lakeBedMat);
  eastLakeBed.rotation.x = -Math.PI / 2;
  eastLakeBed.position.set(25.5, -0.56, -3.0);
  eastLakeBed.receiveShadow = true;
  group.add(eastLakeBed);

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
  const shoalMesh = new THREE.Mesh(shoalGeo, palette.shoalMat);
  shoalMesh.receiveShadow = true;
  group.add(shoalMesh);

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

      // Organic weathered shoreline boulders & mossy shelf stones along outer bank curbs
      if (i % 2 === 0 && i < 10) {
        const rockR = 0.36 + (i % 3) * 0.12;
        const boulder = new THREE.DodecahedronGeometry(rockR, 0);
        xform(
          boulder,
          [midX - 0.12, 0.20, midZ],
          [i * 0.7, i * 1.1, i * 0.4],
          [1.35, 0.62, 1.18]
        );
        graniteGeos.push(boulder);

        const waterRock = new THREE.DodecahedronGeometry(rockR * 0.78, 0);
        xform(
          waterRock,
          [midX + 0.46, 0.12, midZ + signZ * 0.35],
          [i * 0.9, i * 0.5, 0.2],
          [1.25, 0.55, 1.10]
        );
        graniteGeos.push(waterRock);
      }
    }
  }

  // Dressed granite seawalls & breakwater bastions
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

  for (const [bx, bz] of [
    [31.4, 9.05],
    [26.4, -15.2],
  ]) {
    const bastion = new THREE.CylinderGeometry(0.48, 0.56, 1.02, 8);
    xform(bastion, [bx, 0.14, bz]);
    graniteGeos.push(bastion);
  }

  for (let i = 0; i < 7; i++) {
    const northStep = new THREE.BoxGeometry(0.38, 0.28, 6.2);
    xform(northStep, [9.28 + i * 0.34, 0.38 - i * 0.12, -11.7]);
    graniteGeos.push(northStep);

    const southStep = new THREE.BoxGeometry(0.38, 0.28, 9.9);
    xform(southStep, [9.86 + i * 0.32, 0.36 - i * 0.12, 3.65]);
    graniteGeos.push(southStep);
  }
  for (let i = 0; i < 2; i++) {
    const nFoot = new THREE.BoxGeometry(11.4 - i * 0.6, 0.28, 0.44);
    xform(nFoot, [20.9, 0.22 - i * 0.18, -14.92 + i * 0.34]);
    graniteGeos.push(nFoot);

    const sFoot = new THREE.BoxGeometry(16.2 - i * 0.6, 0.28, 0.44);
    xform(sFoot, [23.4, 0.22 - i * 0.18, 8.78 - i * 0.34]);
    graniteGeos.push(sFoot);
  }

  // Iconic Lingbo Pier (凌波门水上栈桥) starting cleanly flush outside Tier 2 quay wall (zero overlap)
  const pierY = 0.56;
  const pierZ = -7.8;
  const mainPier = new THREE.BoxGeometry(10.14, 0.15, 1.2);
  xform(mainPier, [14.33, pierY, pierZ]);
  applyWorldPlanarUVs(mainPier, 0.28, 0.28, false);
  pierGeos.push(mainPier);

  for (const sz of [-0.54, 0.54]) {
    const edgeCurb = new THREE.BoxGeometry(10.14, 0.08, 0.09);
    xform(edgeCurb, [14.33, pierY + 0.1, pierZ + sz]);
    applyWorldPlanarUVs(edgeCurb, 0.28, 0.28, false);
    pierGeos.push(edgeCurb);
  }
  const quayThreshold = new THREE.BoxGeometry(0.44, 0.15, 1.34);
  xform(quayThreshold, [9.06, pierY, pierZ]);
  graniteGeos.push(quayThreshold);

  // Non-overlapping flush pier cross-arms & end connector (eliminates T-junction Z-fighting)
  const crossArm1N = new THREE.BoxGeometry(1.15, 0.15, 3.6);
  xform(crossArm1N, [15.4, pierY, pierZ - 2.4]);
  applyWorldPlanarUVs(crossArm1N, 0.28, 0.28, true);
  pierGeos.push(crossArm1N);

  const crossArm1S = new THREE.BoxGeometry(1.15, 0.15, 2.0);
  xform(crossArm1S, [15.4, pierY, pierZ + 1.6]);
  applyWorldPlanarUVs(crossArm1S, 0.28, 0.28, true);
  pierGeos.push(crossArm1S);

  const crossArm2N = new THREE.BoxGeometry(1.15, 0.15, 3.6);
  xform(crossArm2N, [18.4, pierY, pierZ - 2.4]);
  applyWorldPlanarUVs(crossArm2N, 0.28, 0.28, true);
  pierGeos.push(crossArm2N);

  const crossArm2S = new THREE.BoxGeometry(1.15, 0.15, 1.8);
  xform(crossArm2S, [18.4, pierY, pierZ + 1.5]);
  applyWorldPlanarUVs(crossArm2S, 0.28, 0.28, true);
  pierGeos.push(crossArm2S);

  const endConnect = new THREE.BoxGeometry(1.85, 0.14, 0.95);
  xform(endConnect, [16.9, pierY, pierZ - 3.6]);
  applyWorldPlanarUVs(endConnect, 0.28, 0.28, false);
  pierGeos.push(endConnect);

  function addPierPile(px, pz) {
    const pile = new THREE.CylinderGeometry(0.082, 0.092, 1.24, 10);
    xform(pile, [px, -0.05, pz]);
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

  const southLanding = new THREE.BoxGeometry(1.65, 0.24, 4.4);
  xform(southLanding, [8.95, 0.44, 6.6]);
  graniteGeos.push(southLanding);

  const southWalkway = new THREE.BoxGeometry(1.55, 0.24, 6.4);
  xform(southWalkway, [9.25, 0.44, 1.3]);
  graniteGeos.push(southWalkway);

  // Connecting granite landing & steps centered cleanly onto Lingbo Pavilion's south flat face (zero water overhang)
  const pavSouthBridge = new THREE.BoxGeometry(1.22, 0.20, 1.38);
  xform(pavSouthBridge, [10.72, 0.46, -1.15]);
  graniteGeos.push(pavSouthBridge);
  const pavSouthCorner = new THREE.BoxGeometry(1.60, 0.20, 1.15);
  xform(pavSouthCorner, [9.72, 0.46, -1.05]);
  graniteGeos.push(pavSouthCorner);
  addPierPile(11.2, -1.55);
  addPierPile(10.2, -1.55);

  const pavSouthStep1 = new THREE.BoxGeometry(1.18, 0.14, 0.40);
  xform(pavSouthStep1, [10.72, 0.54, -1.68]);
  graniteGeos.push(pavSouthStep1);
  const pavSouthStep2 = new THREE.BoxGeometry(1.18, 0.14, 0.36);
  xform(pavSouthStep2, [10.72, 0.60, -1.86]);
  graniteGeos.push(pavSouthStep2);

  // Flush non-overlapping causeway stopping clean at mainPier south curb (z = -7.20 -> zero Z-fighting)
  const causewayBridge = new THREE.BoxGeometry(1.35, 0.15, 2.8);
  xform(causewayBridge, [10.72, pierY, -5.8]);
  applyWorldPlanarUVs(causewayBridge, 0.28, 0.28, true);
  pierGeos.push(causewayBridge);

  const pavNorthStep1 = new THREE.BoxGeometry(1.20, 0.14, 0.40);
  xform(pavNorthStep1, [10.72, 0.57, -4.55]);
  graniteGeos.push(pavNorthStep1);
  const pavNorthStep2 = new THREE.BoxGeometry(1.20, 0.14, 0.36);
  xform(pavNorthStep2, [10.72, 0.61, -4.35]);
  graniteGeos.push(pavNorthStep2);

  for (const cz of [-5.2, -6.4]) {
    for (const cx of [10.22, 11.22]) {
      addPierPile(cx, cz);
    }
  }

  // Lakeside hexagonal viewing pavilion (凌波亭) offset cleanly eastward clear of Tier 2 retaining pilasters
  const pavX = 10.72;
  const pavZ = -3.2;
  const pavBase = new THREE.CylinderGeometry(1.42, 1.52, 1.02, 6);
  xform(pavBase, [pavX, 0.17, pavZ]);
  graniteGeos.push(pavBase);
  const pavStep1 = new THREE.CylinderGeometry(1.66, 1.74, 0.40, 6);
  xform(pavStep1, [pavX, -0.08, pavZ]);
  graniteGeos.push(pavStep1);
  const pavStep2 = new THREE.CylinderGeometry(1.88, 1.96, 0.40, 6);
  xform(pavStep2, [pavX, -0.22, pavZ]);
  graniteGeos.push(pavStep2);

  const lakesideRoof = roofGroup(
    {
      halfW: 1.22,
      halfD: 1.22,
      H: 0.90,
      mode: 'hip',
      lift: 0.24,
      segU: 14,
      segV: 8,
      soffitInward: 0.46,
      rafters: true,
    },
    palette.roofMats
  );
  lakesideRoof.position.set(pavX, 1.94, pavZ);
  group.add(lakesideRoof);

  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const cx = pavX + Math.cos(a) * 1.00;
    const cz = pavZ + Math.sin(a) * 1.00;
    const plinth = new THREE.CylinderGeometry(0.11, 0.12, 0.10, 8);
    xform(plinth, [cx, 0.72, cz]);
    graniteGeos.push(plinth);

    const col = new THREE.CylinderGeometry(0.065, 0.07, 1.20, 10);
    col.translate(cx, 1.34, cz);
    const colM = new THREE.Mesh(col, palette.crimsonColumnMat);
    colM.castShadow = true;
    group.add(colM);
  }

  // East Lake sightseeing tour boats (smooth painted timber hull & warm glowing cabin glass)
  const boatHullMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f4efe6'),
    roughness: 0.42,
    metalness: 0.04,
  });
  const boatDeckMat = new THREE.MeshStandardMaterial({
    map: palette.barkMat.map,
    color: new THREE.Color('#d2b48c'),
    roughness: 0.76,
    metalness: 0.0,
  });
  const boatRoofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3b6472'),
    roughness: 0.5,
    metalness: 0.05,
  });
  const boatTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8e3b46'),
    roughness: 0.5,
    metalness: 0.05,
  });
  const boatWindowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#132638'),
    emissive: new THREE.Color('#ff9836'),
    emissiveIntensity: 0.12,
    roughness: 0.18,
    metalness: 0.04,
    envMapIntensity: 0.18,
  });

  function buildTourBoat() {
    const b = new THREE.Group();

    // Sculpted curved wooden/cream sightseeing hull (ExtrudeGeometry boat plan!)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.85, -0.68);
    hullShape.lineTo(0.85, -0.74);
    hullShape.quadraticCurveTo(1.75, -0.62, 2.28, 0.0);
    hullShape.quadraticCurveTo(1.75, 0.62, 0.85, 0.74);
    hullShape.lineTo(-1.85, 0.68);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: 10,
    });
    hullGeo.rotateX(-Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, boatHullMat);
    hull.castShadow = true;
    b.add(hull);

    // Flush beveled crimson waterline rub-rail & teak planked main deck
    const trimGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 10,
    });
    trimGeo.rotateX(-Math.PI / 2);
    const trim = new THREE.Mesh(trimGeo, boatTrimMat);
    trim.position.y = 0.22;
    trim.scale.set(1.008, 1.0, 1.008);
    b.add(trim);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.24), boatDeckMat);
    deck.position.set(-0.15, 0.62, 0);
    b.add(deck);

    // Observation cabin with dark wood mullions & brass roof ribs (tall panes clear of awning overhang)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.78, 1.02), boatHullMat);
    cabin.position.set(-0.35, 1.02, 0);
    cabin.castShadow = true;
    b.add(cabin);
    for (const wx of [-1.05, -0.45, 0.15]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 1.08), boatWindowMat);
      pane.position.set(wx, 1.08, 0);
      b.add(pane);
    }

    // Streamlined peacock-teal awning roof + corner stanchions keeping cabin windows unoccluded from above
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.10, 1.14), boatRoofMat);
    roof.position.set(-0.30, 1.47, 0);
    roof.castShadow = true;
    b.add(roof);
    const roofCrown = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.08, 0.88), boatRoofMat);
    roofCrown.position.set(-0.30, 1.54, 0);
    b.add(roofCrown);

    for (const sx of [-1.45, 0.85]) {
      for (const sz of [-0.56, 0.56]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.82, 6), boatDeckMat);
        post.position.set(sx, 1.00, sz);
        b.add(post);
      }
    }

    // Subtle curved foredeck coaming (stray bare mast removed for crisp tour-boat silhouette)
    const bowRail = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 10, Math.PI), boatDeckMat);
    bowRail.rotation.x = Math.PI / 2;
    bowRail.rotation.z = -Math.PI / 2;
    bowRail.position.set(1.52, 0.76, 0);
    b.add(bowRail);

    b.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    });
    return b;
  }

  const tourBoats = [
    { cx: 16.8, cz: -3.2, radius: 0.35, omega: 0.14, phase: 0.8, seed: 4101 },
    { cx: 34.0, cz: -3.5, radius: 2.8, omega: 0.11, phase: 1.9, seed: 4102 },
    { cx: 56.0, cz: -38.0, radius: 3.8, omega: 0.10, phase: 3.1, seed: 4103 },
  ].map((cfg) => {
    const boat = buildTourBoat();
    boat.scale.setScalar(0.78);
    boat.renderOrder = 2;
    group.add(boat);
    return { config: cfg, boat };
  });

  const lakeGraniteMesh = new THREE.Mesh(mergeSafe(graniteGeos), palette.graniteMat);
  lakeGraniteMesh.castShadow = true;
  lakeGraniteMesh.receiveShadow = true;
  group.add(lakeGraniteMesh);

  const pierMesh = new THREE.Mesh(mergeSafe(pierGeos), palette.pierMat);
  pierMesh.castShadow = true;
  pierMesh.receiveShadow = true;
  group.add(pierMesh);

  // Warm lantern fixture inside Lingbo Pavilion & slender mooring bollard at pier tip for night life
  const pavLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), palette.lampGlowMat);
  pavLantern.position.set(pavX, 1.85, pavZ);
  group.add(pavLantern);

  const bollardBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.28), palette.graniteMat);
  bollardBase.position.set(18.7, pierY + 0.08, pierZ);
  bollardBase.castShadow = true;
  bollardBase.receiveShadow = true;
  group.add(bollardBase);
  const bollardCollar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.18), palette.darkTimberMat);
  bollardCollar.position.set(18.7, pierY + 0.14, pierZ);
  bollardCollar.castShadow = true;
  group.add(bollardCollar);

  const pierBollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.65, 8), palette.darkTimberMat);
  pierBollard.position.set(18.7, pierY + 0.36, pierZ);
  pierBollard.castShadow = true;
  group.add(pierBollard);
  const pierLanternCollar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.22), palette.darkTimberMat);
  pierLanternCollar.position.set(18.7, pierY + 0.62, pierZ);
  group.add(pierLanternCollar);
  const pierLantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.16), palette.lampGlowMat);
  pierLantern.position.set(18.7, pierY + 0.72, pierZ);
  group.add(pierLantern);
  const pierLanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.10, 4), palette.darkTimberMat);
  pierLanternCap.rotation.y = Math.PI * 0.25;
  pierLanternCap.position.set(18.7, pierY + 0.86, pierZ);
  pierLanternCap.castShadow = true;
  group.add(pierLanternCap);
  for (const fx of [-0.08, 0.08]) {
    for (const fz of [-0.08, 0.08]) {
      const lPost = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.20, 0.025), palette.darkTimberMat);
      lPost.position.set(18.7 + fx, pierY + 0.72, pierZ + fz);
      group.add(lPost);
    }
  }

  lockStatic(group);

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
    new THREE.Vector3(7.9, -0.6, -34.0),
    new THREE.Vector3(68.0, 0.3, 24.0)
  );

  function syncShadowLight(keyLight) {
    if (keyLight && keyLight.shadow && keyLight.shadow.map) {
      waterUniforms.uShadowMap.value = keyLight.shadow.map.texture;
      waterUniforms.uShadowMatrix.value.copy(keyLight.shadow.matrix);
      waterUniforms.uShadowMapSize.value.copy(keyLight.shadow.mapSize);
      waterUniforms.uHasShadowMap.value = 1.0;
    }
  }

  function updateWaterReflection(renderer, scene, camera, keyLight, setSkyLinearOutput, foliageComponent, protagonistGroup = null) {
    if (camera.position.y <= WATER_Y + 0.02) {
      waterUniforms.uHasReflection.value = 0.0;
      syncShadowLight(keyLight);
      return;
    }

    camera.updateMatrixWorld();
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    if (!_frustum.intersectsBox(_lakeBounds)) {
      waterUniforms.uHasReflection.value = 0.0;
      syncShadowLight(keyLight);
      return;
    }

    _reflForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (
      camera.position.x < 4.5 &&
      camera.position.z < 14.0 &&
      camera.position.z > -6.0 &&
      _reflForward.x < 0.25 &&
      camera.position.y < 10.5
    ) {
      waterUniforms.uHasReflection.value = 0.0;
      syncShadowLight(keyLight);
      return;
    }

    reflectCam.position.set(camera.position.x, 2 * WATER_Y - camera.position.y, camera.position.z);

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
    const prevProtagonistVis = protagonistGroup ? protagonistGroup.visible : true;

    eastLakeMesh.visible = false;
    if (protagonistGroup) protagonistGroup.visible = false;
    foliageComponent?.setReflectionVisibility(false);
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
    if (protagonistGroup) protagonistGroup.visible = prevProtagonistVis;
    foliageComponent?.setReflectionVisibility(true);
    eastLakeMesh.visible = true;

    waterUniforms.tReflection.value = reflectRT.texture;
    waterUniforms.uHasReflection.value = 1.0;
    syncShadowLight(keyLight);
  }

  function setMood(mood) {
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    waterUniforms.uSunDir.value.copy(palette.sunDirUniform.value);
    if (isNight) {
      boatWindowMat.color.set('#08080a');
      boatWindowMat.roughness = 0.92;
      boatWindowMat.emissiveIntensity = 1.45;
      waterUniforms.uDeepColor.value.set('#09152c');
      waterUniforms.uShallowColor.value.set('#13284d');
      waterUniforms.uSkyColor.value.set('#1c335c');
      waterUniforms.uSunColor.value.set('#b8d2ff');
    } else {
      boatWindowMat.color.set('#132638');
      boatWindowMat.roughness = 0.18;
      boatWindowMat.emissiveIntensity = 0.10;
      waterUniforms.uDeepColor.value.set('#1d4450');
      waterUniforms.uShallowColor.value.set('#33696e');
      waterUniforms.uSkyColor.value.set('#e6cfaf');
      waterUniforms.uSunColor.value.set('#ffe3a8');
    }
  }

  function update(dt, elapsed) {
    tourBoats.forEach(({ config, boat }, idx) => {
      const t = elapsed * config.omega + config.phase;
      const px = config.cx + Math.cos(t) * config.radius;
      const pz = config.cz + Math.sin(t) * config.radius * 0.7;
      const heading = Math.atan2(Math.cos(t) * config.radius * 0.7, -Math.sin(t) * config.radius);
      const bob = Math.sin(elapsed * 1.6 + config.phase) * 0.06;
      const roll = Math.sin(elapsed * 1.2 + config.phase) * 0.05;
      boat.position.set(px, WATER_Y + 0.18 + bob, pz);
      boat.rotation.set(roll, -heading + Math.PI * 0.5, roll * 0.4);
      boat.updateMatrix();
      if (idx === 0) {
        const yaw = -heading + Math.PI * 0.5;
        waterUniforms.uBoatPos.value.set(px, pz);
        waterUniforms.uBoatCs.value.set(Math.cos(yaw), -Math.sin(yaw));
      }
    });
  }

  return {
    group,
    setMood,
    update,
    updateWaterReflection,
    setReflectionSize,
    setWaterLinearOutput: (enabled) => {
      waterUniforms.uLinearOutput.value = enabled ? 1.0 : 0.0;
    },
    syncShadowLight,
  };
}
