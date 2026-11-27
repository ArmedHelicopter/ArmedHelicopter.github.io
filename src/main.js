import * as THREE from 'three';
import { PROFILE, CHAPTERS } from './data.js';
import { createTextureFactory } from './textures.js';
import { createCampusPalette } from './materials.js';
import { createTerrainComponent } from './terrain.js';
import { createDormitoryComponent } from './dormitory.js';
import { createLibraryComponent } from './library.js';
import { createScienceComponent } from './science.js';
import { createLakeComponent } from './lake.js';
import { createFoliageComponent } from './foliage.js';
import { createArchway } from './archway.js';
import { createCampusDiorama } from './campus.js';
import { createLightingSystem } from './lighting.js';
import { createCameraController } from './camera.js';
import { createProtagonist } from './protagonist.js';
import { createHD2DPostFX } from './postfx.js';
import { createAudioEngine } from './audio.js';
import { createUIController } from './ui.js';

const TOUR_STOPS = ['overview', 'chapter:0', 'chapter:1', 'chapter:2', 'chapter:3'];

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function reportProgress(pct, label) {
  const fill = document.getElementById('loading-bar-fill');
  const pctEl = document.getElementById('loading-status-pct');
  const txtEl = document.getElementById('loading-status-text');
  if (fill) fill.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (txtEl && label) txtEl.textContent = label;
  await nextFrame();
}

function dismissLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;
  setTimeout(() => {
    screen.classList.add('is-loaded');
  }, 180);
  setTimeout(() => {
    screen.style.display = 'none';
  }, 940);
}

function showWebGLFallback() {
  const screen = document.getElementById('loading-screen');
  if (screen) screen.style.display = 'none';
  const fallback = document.getElementById('webgl-fallback');
  if (!fallback) return;
  fallback.hidden = false;
  const list = document.getElementById('fallback-links');
  if (list) {
    list.innerHTML = CHAPTERS.flatMap((ch) => ch.items)
      .filter((i) => i.links && i.links.length > 0)
      .map(
        (i) =>
          `<li><strong>${i.title}</strong> — ${i.description} <a href="${i.links[0].url}" target="_blank" rel="noopener noreferrer">${i.links[0].label}</a></li>`
      )
      .join('');
  }
}

async function init() {
  await reportProgress(12, '正在初始化 WebGL 渲染管线...');
  const canvas = document.getElementById('whu-canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch {
    showWebGLFallback();
    return;
  }

  if (!renderer || !renderer.getContext()) {
    showWebGLFallback();
    return;
  }

  let currentDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, window.innerWidth / window.innerHeight, 0.5, 320);

  await reportProgress(32, '正在生成像素程序化材质与贴图...');
  const textures = createTextureFactory(renderer);
  const lighting = createLightingSystem(scene, renderer);
  const palette = createCampusPalette(textures);

  await reportProgress(56, '正在拼装国立武大牌坊与老斋舍组件...');
  const archway = createArchway(textures);
  const terrain = createTerrainComponent(textures, palette);
  const dormitory = createDormitoryComponent(textures, palette);

  await reportProgress(78, '正在构建老图书馆、理学楼、东湖凌波门与樱林...');
  const library = createLibraryComponent(textures, palette);
  const science = createScienceComponent(textures, palette);
  const lake = createLakeComponent(textures, palette);
  const foliage = createFoliageComponent(textures, palette);
  const campus = createCampusDiorama(textures, { palette, terrain, dormitory, library, science, lake, foliage });
  const protagonist = createProtagonist(textures);
  const postfx = createHD2DPostFX(renderer, window.innerWidth, window.innerHeight, currentDpr);

  scene.add(campus.group);
  scene.add(archway.group);
  scene.add(protagonist.group);

  let currentMood = 'amber';
  lighting.setMood(currentMood);
  archway.setMood(currentMood);
  campus.setMood(currentMood);
  protagonist.setMood(currentMood);
  postfx.setMood(currentMood);

  // Expose every major object as an independent modifiable component
  window.__WHU_COMPONENTS__ = {
    archway,
    terrain,
    dormitory,
    library,
    science,
    lake,
    foliage,
    protagonist,
    lighting,
    postfx,
  };

  await reportProgress(92, '正在烘焙静态日光阴影与预编译着色器...');
  // Bake static shadows once after initial world placement
  lighting.bakeStaticShadows();

  const audio = createAudioEngine();

  let fps = 60;
  let frameCounter = 0;
  let fpsTimer = 0;
  let telemetryTimer = 0;

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const autoplayDisabled = urlParams?.get('autoplay') === '0';
  const debugTelemetry = urlParams?.get('debug') === '1';
  document.body.dataset.debug = debugTelemetry ? 'true' : 'false';

  let tourIndex = 0; // -1 = portal, 0 = overview, 1..4 = chapters 0..3
  let scrollTourEnabled = false;

  function renderWithReflection() {
    campus.updateWaterReflection(renderer, scene, camera, lighting.getKeyLight(), lighting.setSkyLinearOutput, protagonist.group);
    lighting.setSkyLinearOutput(true);
    campus.setWaterLinearOutput(true);
    postfx.render(scene, camera);
    lighting.setSkyLinearOutput(false);
    campus.setWaterLinearOutput(false);
  }

  function getMetrics() {
    const texStats = textures.getStats();
    const lightStats = lighting.getStats();
    const sceneStats = postfx.getSceneStats();
    const tris = sceneStats.triangles || renderer.info.render.triangles;
    const shadowBytes = 2048 * 2048 * 4;
    const reflectBytes = 512 * 320 * 4;
    const geoBytes = tris * 3 * 32;
    const vramMB = +((texStats.totalBytes + shadowBytes + reflectBytes + geoBytes) / (1024 * 1024)).toFixed(1);

    return {
      drawCalls: sceneStats.calls || renderer.info.render.calls,
      triangles: tris,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      textureKB: texStats.totalKB,
      vramMB,
      fps,
      stage: cameraRig.getStage(),
      mood: currentMood,
      tourIndex,
      scrollTourEnabled,
      staticShadowMode: lightStats.staticShadowMode,
      shadowMapSize: lightStats.shadowMapSize,
      rebakeCount: lightStats.rebakeCount,
    };
  }

  let ui = null;

  const cameraRig = createCameraController(camera, canvas, {
    onStageChange(nextStage, meta) {
      ui?.setStage(nextStage);
      if (nextStage === 'explore' && tourIndex < 0) {
        tourIndex = 0;
      } else if (nextStage === 'portal') {
        tourIndex = -1;
      }
      if (nextStage === 'explore' && meta?.reason === 'autoplay-complete') {
        ui?.showToast('巡游完成 · 已停留在全景俯瞰视角，可拖拽或点击地标探索');
      }
    },
    onPortalProgress(progress) {
      archway.updatePortal(progress, performance.now() * 0.001);
    },
    onAutoplayProgress(info) {
      ui?.updateAutoplay(info);
      if (info?.stopId) {
        protagonist.setAnchor(info.stopId);
      }
    },
    onAutoplayInterrupt() {
      ui?.syncDockActive(null);
      ui?.showToast('已切换至自由探索视角');
    },
  });

  function applyTourIndex(nextIdx, { snap = false } = {}) {
    tourIndex = ((nextIdx % TOUR_STOPS.length) + TOUR_STOPS.length) % TOUR_STOPS.length;
    if (tourIndex === 0) {
      ui.closeDrawer({ syncOverview: true });
      ui.syncDockActive(-1);
      cameraRig.resetOverview(snap);
    } else {
      const chIdx = tourIndex - 1;
      const ch = CHAPTERS[chIdx] || CHAPTERS[0];
      if (snap) {
        cameraRig.focusLandmark(ch.camPos, ch.camTarget, true);
        ui.selectChapter(chIdx, { focusCamera: false });
      } else {
        ui.selectChapter(chIdx, { focusCamera: true });
      }
    }
  }

  function stepTour(dir = 1) {
    const stage = cameraRig.getStage();
    if (stage === 'autoplay') {
      cameraRig.interruptAutoplayToExplore();
      if (dir > 0) {
        applyTourIndex(1, { snap: false });
      } else {
        cameraRig.resetOverview(false);
      }
      return { stage: cameraRig.getStage(), tourIndex };
    }
    if (stage === 'portal') {
      if (dir > 0) {
        tourIndex = 0;
        audio.playPortalOpen();
        cameraRig.startFlythrough();
      }
      return { stage: cameraRig.getStage(), tourIndex };
    }
    if (stage === 'flythrough') {
      return { stage, tourIndex };
    }

    if (dir < 0 && tourIndex <= 0) {
      tourIndex = 0;
      ui.showToast('已在全景起点 · 向下滚动顺序游览');
      return { stage, tourIndex };
    }
    const nextIdx = dir > 0 ? (tourIndex + 1) % TOUR_STOPS.length : tourIndex - 1;
    applyTourIndex(nextIdx, { snap: false });
    return { stage: cameraRig.getStage(), tourIndex };
  }

  ui = createUIController({
    profile: PROFILE,
    chapters: CHAPTERS,
    onEnterPortal() {
      tourIndex = 0;
      audio.playPortalOpen();
      cameraRig.startFlythrough();
    },
    onSkipIntro() {
      tourIndex = 1;
      cameraRig.enterExplore(true);
      ui.selectChapter(0, { focusCamera: false });
    },
    onReplayIntro() {
      tourIndex = 0;
      audio.playPortalOpen();
      cameraRig.startAutoplay();
    },
    onToggleAutoplayPause() {
      const st = cameraRig.getAutoplayState();
      cameraRig.pauseAutoplay(!st.paused);
    },
    onSkipAutoplay() {
      tourIndex = 0;
      cameraRig.skipAutoplay(false);
    },
    onOpenCv() {
      if (cameraRig.getStage() === 'autoplay') {
        cameraRig.pauseAutoplay(true);
      }
    },
    onToggleMood() {
      currentMood = currentMood === 'amber' ? 'night' : 'amber';
      lighting.setMood(currentMood);
      archway.setMood(currentMood);
      campus.setMood(currentMood);
      protagonist.setMood(currentMood);
      postfx.setMood(currentMood);
      ui.syncMood(currentMood);
    },
    onToggleMute() {
      const next = audio.setMuted(!audio.isMuted());
      ui.syncMuted(next);
    },
    onSelectChapter(ch, idx) {
      tourIndex = idx + 1;
      audio.playLandmarkSelect();
      protagonist.setAnchor(ch.id);
      cameraRig.focusLandmark(ch.camPos, ch.camTarget);
    },
    onResetOverview() {
      tourIndex = 0;
      ui.syncDockActive(-1);
      protagonist.setAnchor('overview');
      cameraRig.resetOverview();
    },
    onToggleScrollMode() {
      scrollTourEnabled = !scrollTourEnabled;
      ui.syncScrollMode(scrollTourEnabled);
      ui.showToast(
        scrollTourEnabled
          ? '已切回「滚轮顺览」：向下滚动按序参观校园（Ctrl+滚轮可缩放）'
          : '已切至「滚轮缩放」：滚动调节远近视角'
      );
    },
    getDebugMetrics: getMetrics,
  });

  if (autoplayDisabled) {
    ui.setStage('explore');
    cameraRig.enterExplore(true);
  } else {
    ui.setStage('autoplay');
    cameraRig.startAutoplay();
  }
  ui.syncMood(currentMood);
  ui.syncMuted(audio.isMuted());
  ui.syncScrollMode(scrollTourEnabled);

  // Smooth Wheel-Scroll Sequential Campus Tour + Ctrl/Toggle Zoom
  let wheelAccum = 0;
  let wheelResetTimer = null;
  let lastTourStepTime = 0;

  window.addEventListener(
    'wheel',
    (e) => {
      if (ui.isCvOpen()) return;

      // Preserve native vertical scroll when reading inside the Chronicle Drawer
      const drawerEl = e.target && e.target.closest ? e.target.closest('#chronicle-drawer') : null;
      if (drawerEl) {
        const bodyEl = document.getElementById('drawer-body');
        if (bodyEl && bodyEl.scrollHeight > bodyEl.clientHeight + 4) {
          const canScrollDown = bodyEl.scrollTop + bodyEl.clientHeight < bodyEl.scrollHeight - 2;
          const canScrollUp = bodyEl.scrollTop > 2;
          if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
            return;
          }
        }
      }

      if (e.ctrlKey || e.altKey || !scrollTourEnabled) {
        if (cameraRig.getStage() === 'autoplay') {
          cameraRig.interruptAutoplayToExplore();
        }
        if (cameraRig.getStage() === 'explore') {
          e.preventDefault();
          cameraRig.zoomBy(e.deltaY);
        }
        return;
      }

      e.preventDefault();
      const now = performance.now();
      if (now - lastTourStepTime < 720) {
        wheelAccum = 0;
        return;
      }

      wheelAccum += e.deltaY;
      clearTimeout(wheelResetTimer);
      wheelResetTimer = setTimeout(() => {
        wheelAccum = 0;
      }, 260);

      if (Math.abs(wheelAccum) >= 50) {
        const dir = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        lastTourStepTime = now;
        stepTour(dir);
      }
    },
    { passive: false }
  );

  // Keyboard sequential navigation (ArrowDown / PageDown, ArrowUp / PageUp) + D debug toggle
  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      const next = document.body.dataset.debug !== 'true';
      document.body.dataset.debug = next ? 'true' : 'false';
      if (next) ui.updateTelemetry();
      return;
    }
    if (ui.isCvOpen()) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      stepTour(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      stepTour(-1);
    }
  });

  // Immediate frame 0 render & synchronous shader pre-compilation
  cameraRig.update(0);
  campus.updateCampus(0, 0, camera.position);
  lighting.update(0);
  protagonist.update(0, 0, camera);
  if (cameraRig.getStage() === 'portal') {
    archway.updatePortal(0, 0);
  }
  renderer.compile(scene, camera);
  renderWithReflection();
  ui.updatePins(camera, window.innerWidth, window.innerHeight, cameraRig.getStage() === 'explore');

  window.__WHU_READY__ = true;
  await reportProgress(100, '构建完成 · 拖动旋转 / 滚轮缩放自由浏览');
  dismissLoadingScreen();

  canvas.addEventListener('webglcontextrestored', () => {
    lighting.bakeStaticShadows();
    renderWithReflection();
  });

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(currentDpr);
    renderer.setSize(w, h);
    postfx.setSize(w, h, currentDpr);
  }
  window.addEventListener('resize', onResize);

  let lastTime = null;
  let paused = false;
  let perfFrames = 0;
  let perfTimeSum = 0;
  let reflReduced = false;

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) {
      lastTime = null;
      perfFrames = 0;
      perfTimeSum = 0;
    }
  });

  function renderFrame(now) {
    requestAnimationFrame(renderFrame);
    if (paused) return;

    let rawDt = 0;
    if (lastTime === null) {
      lastTime = now;
    } else {
      rawDt = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
    }

    if (rawDt > 0 && rawDt < 0.25) {
      perfFrames += 1;
      perfTimeSum += rawDt;
      if (perfFrames >= 45) {
        const avgMs = (perfTimeSum / perfFrames) * 1000;
        perfFrames = 0;
        perfTimeSum = 0;
        if (avgMs > 22 && currentDpr > 0.85) {
          currentDpr = Math.max(0.85, +(currentDpr - 0.2).toFixed(2));
          renderer.setPixelRatio(currentDpr);
          renderer.setSize(window.innerWidth, window.innerHeight);
          postfx.setSize(window.innerWidth, window.innerHeight, currentDpr);
        }
        if (avgMs > 24 && currentDpr <= 1.0 && !reflReduced) {
          reflReduced = true;
          campus.setReflectionSize(320, 200);
        }
      }
    }

    const dt = Math.min(0.05, rawDt);
    const elapsed = now * 0.001;

    cameraRig.update(dt);
    campus.updateCampus(dt, elapsed, camera.position);
    lighting.update(elapsed);
    protagonist.update(dt, elapsed, camera);
    if (cameraRig.getStage() === 'portal') {
      archway.updatePortal(0, elapsed);
    }

    renderWithReflection();

    ui.updatePins(camera, window.innerWidth, window.innerHeight, cameraRig.getStage() === 'explore');

    frameCounter += 1;
    fpsTimer += rawDt;
    telemetryTimer += rawDt;
    if (fpsTimer >= 0.5) {
      fps = Math.max(1, Math.round(frameCounter / fpsTimer));
      frameCounter = 0;
      fpsTimer = 0;
    }
    if (telemetryTimer >= 0.35) {
      telemetryTimer = 0;
      if (document.body.dataset.debug === 'true') {
        ui.updateTelemetry();
      }
    }
  }

  requestAnimationFrame(renderFrame);

  // Deterministic automation & self-verification hook
  window.__WHU_DEBUG__ = {
    jumpTo(target) {
      document.body.dataset.hideUi = 'false';
      if (target === 'portal') {
        ui.closeCvModal();
        tourIndex = -1;
        cameraRig.enterPortal();
      } else if (target === 'mid-fly') {
        ui.closeCvModal();
        cameraRig.jumpMidFly(0.42);
      } else if (target === 'overview') {
        ui.closeCvModal();
        ui.closeDrawer();
        tourIndex = 0;
        cameraRig.enterExplore(true);
      } else if (target === 'cv') {
        tourIndex = 0;
        cameraRig.enterExplore(true);
        ui.openCvModal();
      } else if (typeof target === 'string' && target.startsWith('chapter:')) {
        const idx = parseInt(target.split(':')[1], 10) || 0;
        const ch = CHAPTERS[idx] || CHAPTERS[0];
        ui.closeCvModal();
        tourIndex = idx + 1;
        cameraRig.focusLandmark(ch.camPos, ch.camTarget, true);
        ui.selectChapter(idx, { focusCamera: false });
      }
      renderWithReflection();
      ui.updatePins(camera, window.innerWidth, window.innerHeight, cameraRig.getStage() === 'explore');
      ui.updateTelemetry();
    },
    setCamera(posArr, targetArr, opts = {}) {
      const { fov = 24, stage = 'explore', hideUi = false, closeDrawer = true, portalOpen = 1 } = opts;
      if (closeDrawer) ui.closeDrawer();
      ui.closeCvModal();
      document.body.dataset.hideUi = hideUi ? 'true' : 'false';
      cameraRig.setCameraDirect(posArr, targetArr, { fov, stage, portalOpen });
      protagonist.update(0, performance.now() * 0.001, camera);
      renderWithReflection();
      ui.updatePins(camera, window.innerWidth, window.innerHeight, cameraRig.getStage() === 'explore');
      ui.updateTelemetry();
    },
    seekAutoplay(progress01) {
      ui.closeCvModal();
      ui.closeDrawer();
      document.body.dataset.hideUi = 'false';
      const st = cameraRig.seekAutoplay(progress01);
      protagonist.setAnchor(st.stopId, true);
      protagonist.update(0, performance.now() * 0.001, camera);
      renderWithReflection();
      ui.updatePins(camera, window.innerWidth, window.innerHeight, false);
      ui.updateTelemetry();
      return st;
    },
    pauseAutoplay(paused = true) {
      return cameraRig.pauseAutoplay(paused);
    },
    getAutoplayStops() {
      return cameraRig.getAutoplayStops();
    },
    getAutoplayState() {
      return cameraRig.getAutoplayState();
    },
    probeAutoplayClearance(samples = 160) {
      const prevState = cameraRig.getAutoplayState();
      const prevHideUi = document.body.dataset.hideUi || 'false';
      const raycaster = new THREE.Raycaster();
      raycaster.camera = camera;
      raycaster.near = 0.05;

      const dirs = [
        { name: 'forward', local: new THREE.Vector3(0, 0, -1), far: 3.0 },
        { name: 'left', local: new THREE.Vector3(-1, 0, 0), far: 1.0 },
        { name: 'right', local: new THREE.Vector3(1, 0, 0), far: 1.0 },
        { name: 'up', local: new THREE.Vector3(0, 1, 0), far: 1.0 },
        { name: 'down', local: new THREE.Vector3(0, -1, 0), far: 1.0 },
      ];
      const worldDir = new THREE.Vector3();
      const blocking = [];
      const foliage = [];
      let maxFwdAttAngleDeg = 0;

      scene.updateMatrixWorld(true);
      for (let i = 0; i < samples; i++) {
        const t = samples > 1 ? i / (samples - 1) : 0;
        const st = cameraRig.seekAutoplay(t);
        if (st.fwdAttAngleDeg > maxFwdAttAngleDeg) maxFwdAttAngleDeg = st.fwdAttAngleDeg;
        camera.updateMatrixWorld(true);

        for (const d of dirs) {
          worldDir.copy(d.local).applyQuaternion(camera.quaternion).normalize();
          raycaster.far = d.far;
          raycaster.set(camera.position, worldDir);
          const hits = raycaster.intersectObjects(scene.children, true);
          for (const h of hits) {
            if (h.object.isPoints || h.object.isSprite || h.object.isLine) continue;
            const entry = {
              t: +t.toFixed(4),
              dir: d.name,
              dist: +h.distance.toFixed(3),
              name: h.object.name || h.object.type || 'mesh',
            };
            if (h.object.name === 'foliage') {
              foliage.push(entry);
            } else {
              blocking.push(entry);
            }
            break;
          }
        }
      }

      if (prevState.active) {
        cameraRig.seekAutoplay(prevState.progress);
        cameraRig.pauseAutoplay(prevState.paused);
      } else if (prevState.stage === 'explore') {
        cameraRig.setCameraDirect(prevState.cameraPos, prevState.cameraTarget, {
          fov: prevState.fov,
          stage: 'explore',
          hideUi: prevHideUi === 'true',
        });
      }
      document.body.dataset.hideUi = prevHideUi;
      renderWithReflection();
      ui.updateTelemetry();
      return { blocking, foliage, maxFwdAttAngleDeg: +maxFwdAttAngleDeg.toFixed(2) };
    },
    stepTour,
    getTourState() {
      return {
        stage: cameraRig.getStage(),
        tourIndex,
        stop: tourIndex >= 0 ? TOUR_STOPS[tourIndex] : 'portal',
        scrollTourEnabled,
      };
    },
    setMood(mood) {
      currentMood = mood === 'night' || mood === 'sunset' || mood === 'convergence' ? 'night' : 'amber';
      lighting.setMood(currentMood);
      archway.setMood(currentMood);
      campus.setMood(currentMood);
      protagonist.setMood(currentMood);
      postfx.setMood(currentMood);
      ui.syncMood(currentMood);
      renderWithReflection();
      ui.updateTelemetry();
    },
    getMetrics,
  };
}

init();
