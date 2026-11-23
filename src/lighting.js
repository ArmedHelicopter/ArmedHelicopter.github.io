import * as THREE from 'three';

/**
 * Photoreal sunlit springtime Blue · White · Pink lighting system:
 * - Procedural PMREM sky+sun environment map (`scene.environment`) for realistic PBR reflections
 *   on peacock-blue glazed tiles, glass windows, granite & water
 * - Layered volumetric-style sky dome with multi-octave sunlit cumulus & cirrus clouds
 * - Strong warm raking sunlight vs. cool sky-shadow contrast + static 2048x2048 shadow baking
 */
export function createLightingSystem(scene, renderer) {
  const MOODS = {
    spring: {
      zenith: '#1866bb',
      upperMid: '#4da6ed',
      lowerMid: '#9cd2fa',
      horizon: '#f7ebf2',
      sunHalo: '#fff6e4',
      cloudLit: '#ffffff',
      cloudShadow: '#a7c6e4',
      fogColor: '#d7ebfc',
      fogDensity: 0.0026,
      keyColor: '#fff2d8',
      keyIntensity: 3.15,
      keyPos: [28, 22, 19],
      hemiSky: '#8cc4f5',
      hemiGround: '#5f7285',
      hemiIntensity: 0.62,
      rimColor: '#ffd9e6',
      rimIntensity: 0.34,
      frontFillIntensity: 0.16,
      envIntensity: 0.58,
      beamColor: '#fff4fa',
      beamOpacity: 0.045,
      pointColor: '#ffd4e6',
      pointIntensity: 3.5,
    },
    sunset: {
      zenith: '#283f7c',
      upperMid: '#6b67ab',
      lowerMid: '#db93b7',
      horizon: '#ffd2c5',
      sunHalo: '#ffe2bf',
      cloudLit: '#fff0f3',
      cloudShadow: '#9b8bb8',
      fogColor: '#efc4d8',
      fogDensity: 0.0029,
      keyColor: '#ffbe92',
      keyIntensity: 2.65,
      keyPos: [-24, 17, 16],
      hemiSky: '#9ea2dc',
      hemiGround: '#6b5a74',
      hemiIntensity: 0.56,
      rimColor: '#ff9ec4',
      rimIntensity: 0.52,
      frontFillIntensity: 0.14,
      envIntensity: 0.52,
      beamColor: '#ffc6de',
      beamOpacity: 0.065,
      pointColor: '#ffb870',
      pointIntensity: 14,
    },
  };

  function resolveMoodKey(name) {
    if (name === 'sunset' || name === 'convergence') return 'sunset';
    return 'spring';
  }

  /* ---------------------------------------------------------------------- */
  /* 1. Procedural PMREM Sky Environment Map (Zero External HDRI)           */
  /* ---------------------------------------------------------------------- */
  const pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader();
  let envRT = null;

  function buildSkyEnvMap(cfg) {
    const envScene = new THREE.Scene();
    const envSkyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color(cfg.zenith) },
        uMid: { value: new THREE.Color(cfg.lowerMid) },
        uHor: { value: new THREE.Color(cfg.horizon) },
        uSun: { value: new THREE.Color(cfg.sunHalo) },
        uSunDir: { value: new THREE.Vector3(...cfg.keyPos).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHor;
        uniform vec3 uSun;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 ground = mix(vec3(0.28, 0.36, 0.34), uHor * 0.65, smoothstep(-0.6, 0.0, h));
          vec3 sky = mix(uHor, uMid, smoothstep(0.0, 0.28, h));
          sky = mix(sky, uTop, smoothstep(0.25, 0.85, h));
          vec3 col = h < 0.0 ? ground : sky;
          float sd = max(0.0, dot(d, uSunDir));
          col += uSun * (pow(sd, 12.0) * 0.6 + pow(sd, 96.0) * 2.2);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const envSphere = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), envSkyMat);
    envScene.add(envSphere);

    const nextRT = pmremGen.fromScene(envScene, 0.03);
    envSphere.geometry.dispose();
    envSkyMat.dispose();
    if (envRT) envRT.dispose();
    envRT = nextRT;
    scene.environment = envRT.texture;
    scene.environmentIntensity = cfg.envIntensity;
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Layered Atmospheric Sky Dome + Sunlit Volumetric-Style Clouds       */
  /* ---------------------------------------------------------------------- */
  const skyUniforms = {
    uZenith: { value: new THREE.Color(MOODS.spring.zenith) },
    uUpperMid: { value: new THREE.Color(MOODS.spring.upperMid) },
    uLowerMid: { value: new THREE.Color(MOODS.spring.lowerMid) },
    uHorizon: { value: new THREE.Color(MOODS.spring.horizon) },
    uSunHalo: { value: new THREE.Color(MOODS.spring.sunHalo) },
    uCloudLit: { value: new THREE.Color(MOODS.spring.cloudLit) },
    uCloudShadow: { value: new THREE.Color(MOODS.spring.cloudShadow) },
    uSunDir: { value: new THREE.Vector3(...MOODS.spring.keyPos).normalize() },
    uTime: { value: 0 },
    uLinearOutput: { value: 0.0 },
  };

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(175, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uUpperMid;
        uniform vec3 uLowerMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunHalo;
        uniform vec3 uCloudLit;
        uniform vec3 uCloudShadow;
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uLinearOutput;
        varying vec3 vWorldPos;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fbm5(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = rot * p * 2.03 + vec2(3.1, 7.4);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;

          float t1 = smoothstep(-0.22, 0.0, h);
          float t2 = smoothstep(-0.02, 0.24, h);
          float t3 = smoothstep(0.20, 0.78, h);

          vec3 col = mix(uHorizon, uLowerMid, t1);
          col = mix(col, uUpperMid, t2);
          col = mix(col, uZenith, t3);

          // Multi-layered photographic cumulus & cirrus clouds with sun-side self-shadowing
          if (h > -0.04) {
            vec2 skyUv = dir.xz / (max(0.09, h + 0.24)) * 1.15;
            vec2 drift = vec2(uTime * 0.006, uTime * 0.002);

            float base = fbm5(skyUv * 1.35 + drift);
            float detail = fbm5(skyUv * 3.1 - drift * 0.8);
            float density = smoothstep(0.49, 0.76, base * 0.72 + detail * 0.28);

            // Sample density slightly toward sun to give realistic bright top vs cool shadowed underside
            vec2 sunStep = normalize(uSunDir.xz + vec2(0.001)) * 0.075;
            float baseTowardSun = fbm5((skyUv + sunStep) * 1.35 + drift);
            float selfLit = clamp(0.55 + (base - baseTowardSun) * 4.2 + h * 0.45, 0.0, 1.0);

            float sunForward = pow(max(0.0, dot(dir, uSunDir)), 6.0);
            vec3 cloudCol = mix(uCloudShadow, uCloudLit, selfLit) + uSunHalo * sunForward * 0.22;

            // High wispy cirrus layer
            float cirrus = smoothstep(0.56, 0.82, fbm5(skyUv * 2.4 + vec2(8.0, 2.5) + drift * 0.5));
            col = mix(col, mix(uCloudLit, uHorizon, 0.15), cirrus * 0.28 * smoothstep(0.0, 0.22, h));

            float horizonFade = smoothstep(-0.02, 0.14, h) * smoothstep(0.95, 0.45, h);
            col = mix(col, cloudCol, density * horizonFade * 0.88);
          }

          float sunDot = max(0.0, dot(dir, uSunDir));
          col += uSunHalo * (pow(sunDot, 12.0) * 0.16 + pow(sunDot, 96.0) * 0.34);

          gl_FragColor = vec4(col, 1.0);
          if (uLinearOutput < 0.5) {
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        }
      `,
    })
  );
  skyDome.matrixAutoUpdate = false;
  skyDome.updateMatrix();
  scene.add(skyDome);

  /* ---------------------------------------------------------------------- */
  /* 3. Subtle Volumetric Spring Sunbeams Slanting Past the Archway Eaves   */
  /* ---------------------------------------------------------------------- */
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(MOODS.spring.beamColor) },
      uOpacity: { value: MOODS.spring.beamOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float xFade = smoothstep(0.0, 0.44, vUv.x) * smoothstep(1.0, 0.56, vUv.x);
        float yFade = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
        gl_FragColor = vec4(uColor, xFade * yFade * uOpacity);
      }
    `,
  });

  const beamGroup = new THREE.Group();
  const beamConfigs = [
    { pos: [-1.4, 5.4, 15.8], rot: [-0.28, 0.25, -0.36], scale: [3.2, 6.2, 1] },
    { pos: [0.8, 5.6, 15.7], rot: [-0.28, 0.25, -0.34], scale: [3.6, 6.5, 1] },
  ];
  const beamGeo = new THREE.PlaneGeometry(1, 1);
  beamConfigs.forEach((bc) => {
    const m = new THREE.Mesh(beamGeo, beamMat);
    m.position.set(...bc.pos);
    m.rotation.set(...bc.rot);
    m.scale.set(...bc.scale);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    beamGroup.add(m);
  });
  scene.add(beamGroup);

  /* ---------------------------------------------------------------------- */
  /* 4. Atmospheric Fog, Sun Key Light, Sky Hemisphere & Rim Contrast       */
  /* ---------------------------------------------------------------------- */
  scene.fog = new THREE.FogExp2(MOODS.spring.fogColor, MOODS.spring.fogDensity);

  const keyLight = new THREE.DirectionalLight(MOODS.spring.keyColor, MOODS.spring.keyIntensity);
  keyLight.position.set(...MOODS.spring.keyPos);
  keyLight.target.position.set(2, 0, 1);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 4;
  keyLight.shadow.camera.far = 105;
  keyLight.shadow.camera.left = -24;
  keyLight.shadow.camera.right = 25;
  keyLight.shadow.camera.top = 24;
  keyLight.shadow.camera.bottom = -25;
  keyLight.shadow.bias = -0.00022;
  keyLight.shadow.normalBias = 0.014;
  scene.add(keyLight);
  scene.add(keyLight.target);
  keyLight.target.updateMatrixWorld();

  const hemiLight = new THREE.HemisphereLight(
    MOODS.spring.hemiSky,
    MOODS.spring.hemiGround,
    MOODS.spring.hemiIntensity
  );
  scene.add(hemiLight);

  const rimLight = new THREE.DirectionalLight(MOODS.spring.rimColor, MOODS.spring.rimIntensity);
  rimLight.position.set(-20, 14, -24);
  scene.add(rimLight);

  const frontFill = new THREE.DirectionalLight('#fff6fa', MOODS.spring.frontFillIntensity);
  frontFill.position.set(-6, 10, 34);
  scene.add(frontFill);

  const localLightCoords = [
    [0, 4.2, 16.8],
    [-4.2, 5.2, 0.2],
    [0.4, 8.8, -8.5],
    [13.5, 2.4, -7.8],
  ];
  const pointLights = localLightCoords.map(([x, y, z]) => {
    const pl = new THREE.PointLight(MOODS.spring.pointColor, MOODS.spring.pointIntensity, 18, 1.6);
    pl.position.set(x, y, z);
    pl.castShadow = false;
    scene.add(pl);
    return pl;
  });

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  let currentMood = 'spring';
  let rebakeCount = 0;

  function bakeStaticShadows() {
    renderer.shadowMap.needsUpdate = true;
    rebakeCount += 1;
  }

  function setMood(moodName) {
    const key = resolveMoodKey(moodName);
    const cfg = MOODS[key];
    currentMood = key;

    skyUniforms.uZenith.value.set(cfg.zenith);
    skyUniforms.uUpperMid.value.set(cfg.upperMid);
    skyUniforms.uLowerMid.value.set(cfg.lowerMid);
    skyUniforms.uHorizon.value.set(cfg.horizon);
    skyUniforms.uSunHalo.value.set(cfg.sunHalo);
    skyUniforms.uCloudLit.value.set(cfg.cloudLit);
    skyUniforms.uCloudShadow.value.set(cfg.cloudShadow);
    skyUniforms.uSunDir.value.set(...cfg.keyPos).normalize();

    scene.fog.color.set(cfg.fogColor);
    scene.fog.density = cfg.fogDensity;

    keyLight.color.set(cfg.keyColor);
    keyLight.intensity = cfg.keyIntensity;
    keyLight.position.set(...cfg.keyPos);

    hemiLight.color.set(cfg.hemiSky);
    hemiLight.groundColor.set(cfg.hemiGround);
    hemiLight.intensity = cfg.hemiIntensity;

    rimLight.color.set(cfg.rimColor);
    rimLight.intensity = cfg.rimIntensity;
    frontFill.intensity = cfg.frontFillIntensity;

    beamMat.uniforms.uColor.value.set(cfg.beamColor);
    beamMat.uniforms.uOpacity.value = cfg.beamOpacity;

    pointLights.forEach((pl) => {
      pl.color.set(cfg.pointColor);
      pl.intensity = cfg.pointIntensity;
    });

    buildSkyEnvMap(cfg);
    bakeStaticShadows();
    return currentMood;
  }

  function update(elapsed) {
    skyUniforms.uTime.value = elapsed;
  }

  function getStats() {
    return {
      mood: currentMood,
      shadowMapSize: '2048×2048',
      staticShadowMode: 'Static Baked (autoUpdate=false)',
      rebakeCount,
    };
  }

  return {
    setMood,
    bakeStaticShadows,
    update,
    getStats,
    getKeyLight: () => keyLight,
    setSkyLinearOutput: (enabled) => {
      skyUniforms.uLinearOutput.value = enabled ? 1.0 : 0.0;
    },
  };
}
