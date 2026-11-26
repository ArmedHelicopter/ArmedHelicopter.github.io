import * as THREE from 'three';

/**
 * Lightweight HD-2D post-processing pass:
 * 1) Renders linear HDR scene into an MSAA WebGLRenderTarget (falls back gracefully if HalfFloat/MSAA unsupported)
 * 2) Separable 7-tap Gaussian blur at 1/3 resolution
 * 3) Tilt-shift miniature focal band + warm highlight bloom + indigo edge vignette + single-pass ACESFilmic & sRGB
 */
export function createHD2DPostFX(renderer, width, height, dpr = 1) {
  const isWebGL2 = renderer.capabilities.isWebGL2;
  const maxSamples = isWebGL2 ? Math.min(4, renderer.capabilities.maxSamples || 0) : 0;
  const rtType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;

  let curW = Math.max(1, Math.round(width * dpr));
  let curH = Math.max(1, Math.round(height * dpr));

  const sceneRT = new THREE.WebGLRenderTarget(curW, curH, {
    type: rtType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    samples: maxSamples,
  });

  const blurW = Math.max(64, Math.round(curW / 3));
  const blurH = Math.max(64, Math.round(curH / 3));

  const blurA = new THREE.WebGLRenderTarget(blurW, blurH, {
    type: rtType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
  });

  const blurB = new THREE.WebGLRenderTarget(blurW, blurH, {
    type: rtType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
  });

  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  const blurMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tInput: { value: sceneRT.texture },
      uDir: { value: new THREE.Vector2(1 / blurW, 0) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tInput;
      uniform vec2 uDir;
      varying vec2 vUv;
      void main() {
        vec3 sum = texture2D(tInput, vUv).rgb * 0.227027;
        sum += texture2D(tInput, vUv + uDir * 1.3846).rgb * 0.316216;
        sum += texture2D(tInput, vUv - uDir * 1.3846).rgb * 0.316216;
        sum += texture2D(tInput, vUv + uDir * 3.2308).rgb * 0.070270;
        sum += texture2D(tInput, vUv - uDir * 3.2308).rgb * 0.070270;
        gl_FragColor = vec4(sum, 1.0);
      }
    `,
  });

  const compositeMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tScene: { value: sceneRT.texture },
      tBlur: { value: blurB.texture },
      uBloomThreshold: { value: 0.78 },
      uBloomStrength: { value: 0.26 },
      uBloomTint: { value: new THREE.Vector3(1.05, 0.96, 0.84) },
      uVignetteTint: { value: new THREE.Vector3(0.08, 0.11, 0.20) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tScene;
      uniform sampler2D tBlur;
      uniform float uBloomThreshold;
      uniform float uBloomStrength;
      uniform vec3 uBloomTint;
      uniform vec3 uVignetteTint;
      varying vec2 vUv;

      void main() {
        vec3 sharp = texture2D(tScene, vUv).rgb;
        vec3 blurCol = texture2D(tBlur, vUv).rgb;

        // Tilt-shift miniature focal band centered slightly below mid-screen
        float coc = smoothstep(0.18, 0.50, abs(vUv.y - 0.50));
        vec3 col = mix(sharp, blurCol, coc * 0.76);

        // Warm highlight bloom in linear HDR space
        vec3 hi = max(blurCol - vec3(uBloomThreshold), vec3(0.0));
        col += hi * uBloomTint * uBloomStrength;

        // Soft indigo miniature diorama vignette
        float rDist = length((vUv - 0.5) * vec2(1.22, 1.0));
        float vig = smoothstep(0.44, 0.98, rDist);
        col = mix(col, mix(col * 0.62, uVignetteTint * 0.45, 0.35), vig * 0.34);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const fsScene = new THREE.Scene();
  const fsMesh = new THREE.Mesh(quadGeo, blurMat);
  fsMesh.frustumCulled = false;
  fsScene.add(fsMesh);

  function setSize(w, h, nextDpr = 1) {
    const nw = Math.max(1, Math.round(w * nextDpr));
    const nh = Math.max(1, Math.round(h * nextDpr));
    if (nw === curW && nh === curH) return;
    curW = nw;
    curH = nh;
    sceneRT.setSize(curW, curH);
    const nbw = Math.max(64, Math.round(curW / 3));
    const nbh = Math.max(64, Math.round(curH / 3));
    blurA.setSize(nbw, nbh);
    blurB.setSize(nbw, nbh);
  }

  function setMood(mood) {
    const isNight = mood === 'night' || mood === 'sunset' || mood === 'convergence';
    if (isNight) {
      compositeMat.uniforms.uBloomThreshold.value = 0.56;
      compositeMat.uniforms.uBloomStrength.value = 0.44;
      compositeMat.uniforms.uBloomTint.value.set(1.10, 0.92, 0.72);
      compositeMat.uniforms.uVignetteTint.value.set(0.04, 0.07, 0.16);
    } else {
      compositeMat.uniforms.uBloomThreshold.value = 0.78;
      compositeMat.uniforms.uBloomStrength.value = 0.26;
      compositeMat.uniforms.uBloomTint.value.set(1.05, 0.96, 0.84);
      compositeMat.uniforms.uVignetteTint.value.set(0.10, 0.12, 0.20);
    }
  }

  const lastSceneStats = { calls: 0, triangles: 0 };

  function render(scene, camera) {
    const prevTarget = renderer.getRenderTarget();
    const prevToneMapping = renderer.toneMapping;
    const prevXr = renderer.xr.enabled;

    renderer.toneMapping = THREE.NoToneMapping;
    renderer.xr.enabled = false;

    // 1. Render main linear HDR scene into sceneRT
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    lastSceneStats.calls = renderer.info.render.calls;
    lastSceneStats.triangles = renderer.info.render.triangles;

    // 2. Horizontal blur -> blurA
    const bw = blurA.width;
    const bh = blurA.height;
    fsMesh.material = blurMat;
    blurMat.uniforms.tInput.value = sceneRT.texture;
    blurMat.uniforms.uDir.value.set(1.4 / bw, 0);
    renderer.setRenderTarget(blurA);
    renderer.render(fsScene, orthoCam);

    // 3. Vertical blur -> blurB
    blurMat.uniforms.tInput.value = blurA.texture;
    blurMat.uniforms.uDir.value.set(0, 1.4 / bh);
    renderer.setRenderTarget(blurB);
    renderer.render(fsScene, orthoCam);

    // 4. Composite sharp focal band + bloom + vignette + ACES/sRGB output to screen
    renderer.toneMapping = prevToneMapping;
    fsMesh.material = compositeMat;
    renderer.setRenderTarget(prevTarget);
    renderer.render(fsScene, orthoCam);

    renderer.xr.enabled = prevXr;
  }

  function dispose() {
    sceneRT.dispose();
    blurA.dispose();
    blurB.dispose();
    quadGeo.dispose();
    blurMat.dispose();
    compositeMat.dispose();
  }

  return {
    render,
    setSize,
    setMood,
    getSceneStats: () => lastSceneStats,
    dispose,
  };
}
