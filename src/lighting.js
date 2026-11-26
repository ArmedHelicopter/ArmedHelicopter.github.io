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
      horizon: '#cfe3f2',
      sunHalo: '#fff6e4',
      cloudLit: '#ffffff',
      cloudShadow: '#a7c6e4',
      fogColor: '#c6dced',
      fogDensity: 0.0058,
      keyColor: '#fff2d8',
      keyIntensity: 2.9,
      keyPos: [28, 22, 19],
      hemiSky: '#8cc4f5',
      hemiGround: '#5f7285',
      hemiIntensity: 0.64,
      rimColor: '#ffd9e6',
      rimIntensity: 0.34,
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
      fogDensity: 0.007,
      keyColor: '#ffbe92',
      keyIntensity: 2.65,
      keyPos: [-24, 17, 16],
      hemiSky: '#9ea2dc',
      hemiGround: '#6b5a74',
      hemiIntensity: 0.62,
      rimColor: '#ff9ec4',
      rimIntensity: 0.52,
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
  function buildCloudNoiseTexture(size = 256) {
    const data = new Uint8Array(size * size * 4);
    const hashP = (ix, iy, period, seed) => {
      const wx = ((ix % period) + period) % period;
      const wy = ((iy % period) + period) % period;
      const s = Math.sin(wx * 127.1 + wy * 311.7 + seed * 74.7) * 43758.5453123;
      return s - Math.floor(s);
    };
    const pNoise = (u, v, period, seed) => {
      const px = u * period;
      const py = v * period;
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      const fx = px - ix;
      const fy = py - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = hashP(ix, iy, period, seed);
      const b = hashP(ix + 1, iy, period, seed);
      const c = hashP(ix, iy + 1, period, seed);
      const d = hashP(ix + 1, iy + 1, period, seed);
      return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
    };
    const pFbm = (u, v, basePeriod, octaves, seed) => {
      let sum = 0;
      let wSum = 0;
      let amp = 0.5;
      let period = basePeriod;
      for (let o = 0; o < octaves; o++) {
        sum += amp * pNoise(u + o * 0.13, v + o * 0.29, period, seed + o * 17);
        wSum += amp;
        amp *= 0.5;
        period *= 2;
      }
      return sum / wSum;
    };
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(pFbm(u, v, 8, 4, 1), 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(pFbm(u, v, 16, 3, 41), 0, 1) * 255);
        data[idx + 2] = Math.round(THREE.MathUtils.clamp(pFbm(u, v, 10, 3, 83), 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  const cloudNoiseTex = buildCloudNoiseTexture(256);

  const skyUniforms = {
    uZenith: { value: new THREE.Color(MOODS.spring.zenith) },
    uUpperMid: { value: new THREE.Color(MOODS.spring.upperMid) },
    uLowerMid: { value: new THREE.Color(MOODS.spring.lowerMid) },
    uHorizon: { value: new THREE.Color(MOODS.spring.horizon) },
    uSunHalo: { value: new THREE.Color(MOODS.spring.sunHalo) },
    uCloudLit: { value: new THREE.Color(MOODS.spring.cloudLit) },
    uCloudShadow: { value: new THREE.Color(MOODS.spring.cloudShadow) },
    uSunDir: { value: new THREE.Vector3(...MOODS.spring.keyPos).normalize() },
    uCloudNoise: { value: cloudNoiseTex },
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
        uniform sampler2D uCloudNoise;
        uniform float uTime;
        uniform float uLinearOutput;
        varying vec3 vWorldPos;

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;

          float t1 = smoothstep(0.008, 0.14, h);
          float t2 = smoothstep(0.09, 0.35, h);
          float t3 = smoothstep(0.26, 0.80, h);

          vec3 col = mix(uHorizon, uLowerMid, t1);
          col = mix(col, uUpperMid, t2);
          col = mix(col, uZenith, t3);

          // Multi-layered photographic cumulus & cirrus clouds via seamless pre-baked FBM LUT
          if (h > -0.04) {
            vec2 skyUv = dir.xz / (max(0.09, h + 0.24)) * 1.15;
            vec2 drift = vec2(uTime * 0.006, uTime * 0.002);

            float base = texture2D(uCloudNoise, (skyUv * 1.35 + drift) * 0.125).r;
            float detail = texture2D(uCloudNoise, (skyUv * 3.1 - drift * 0.8) * 0.0625).g;
            float density = smoothstep(0.49, 0.74, base * 0.72 + detail * 0.28);

            // Sample density slightly toward sun to give realistic bright top vs cool shadowed underside
            vec2 sunStep = normalize(uSunDir.xz + vec2(0.001)) * 0.075;
            float baseTowardSun = texture2D(uCloudNoise, ((skyUv + sunStep) * 1.35 + drift) * 0.125).r;
            float selfLit = clamp(0.55 + (base - baseTowardSun) * 4.2 + h * 0.45, 0.0, 1.0);

            float sunForward = pow(max(0.0, dot(dir, uSunDir)), 6.0);
            vec3 cloudCol = mix(uCloudShadow, uCloudLit, selfLit) + uSunHalo * sunForward * 0.22;

            // High wispy cirrus layer
            float cirrus = smoothstep(0.55, 0.80, texture2D(uCloudNoise, (skyUv * 2.4 + vec2(8.0, 2.5) + drift * 0.5) * 0.1).b);
            col = mix(col, mix(uCloudLit, uHorizon, 0.15), cirrus * 0.28 * smoothstep(0.0, 0.22, h));

            float horizonFade = smoothstep(0.015, 0.16, h) * smoothstep(0.95, 0.45, h);
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
    return pl;
  });

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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

    beamMat.uniforms.uColor.value.set(cfg.beamColor);
    beamMat.uniforms.uOpacity.value = cfg.beamOpacity;

    pointLights.forEach((pl) => {
      if (key === 'sunset') {
        if (!pl.parent) scene.add(pl);
        pl.color.set(cfg.pointColor);
        pl.intensity = cfg.pointIntensity;
      } else if (pl.parent) {
        scene.remove(pl);
      }
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
