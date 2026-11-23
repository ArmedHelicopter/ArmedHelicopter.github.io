import * as THREE from 'three';

const MOOD_LABELS = {
  spring: '晴空樱雪',
  sunset: '樱霞暮色',
};

/**
 * Coordinates the sunlit Blue · White · Pink HTML overlays, 3D-projected landmark pins,
 * unfolding portfolio chronicle drawer, Full CV modal, and live GPU telemetry readout.
 */
export function createUIController({
  profile,
  chapters,
  onEnterPortal,
  onSkipIntro,
  onReplayIntro,
  onToggleMood,
  onToggleMute,
  onSelectChapter,
  onResetOverview,
  onToggleScrollMode,
  onToggleAutoplayPause,
  onSkipAutoplay,
  onOpenCv,
  getDebugMetrics,
}) {
  const portalOverlay = document.getElementById('portal-overlay');
  const campusHud = document.getElementById('campus-hud');
  const enterBtn = document.getElementById('enter-portal-btn');
  const skipBtn = document.getElementById('skip-intro-btn');
  const replayBtn = document.getElementById('replay-intro-btn');
  const autoplayStopLabel = document.getElementById('autoplay-stop-label');
  const autoplayProgressFill = document.getElementById('autoplay-progress-fill');
  const autoplayToggleBtn = document.getElementById('autoplay-toggle-btn');
  const skipAutoplayBtn = document.getElementById('skip-autoplay-btn');
  const moodBtns = document.querySelectorAll('[data-action="toggle-mood"]');
  const soundBtns = document.querySelectorAll('[data-action="toggle-sound"]');
  const cvBtn = document.getElementById('open-cv-btn');
  const resetViewBtn = document.getElementById('reset-view-btn');
  const scrollModeBtn = document.getElementById('scroll-mode-btn');

  const pinsLayer = document.getElementById('pins-layer');
  const axisDock = document.getElementById('axis-dock');

  const drawer = document.getElementById('chronicle-drawer');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const drawerBody = document.getElementById('drawer-body');
  const drawerPrevBtn = document.getElementById('drawer-prev-btn');
  const drawerNextBtn = document.getElementById('drawer-next-btn');

  const telemetryBtn = document.getElementById('telemetry-pill');
  const telemetryPanel = document.getElementById('telemetry-panel');

  const cvModal = document.getElementById('cv-modal');
  const cvCloseBtn = document.getElementById('cv-close-btn');
  const cvBody = document.getElementById('cv-body');

  const toastEl = document.getElementById('toast-banner');

  let activeChapterIdx = 0;
  let drawerOpen = false;
  let telemetryExpanded = false;
  let toastTimer = null;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  function copyEmail(email) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(
        () => showToast(`已复制邮箱：${email}`),
        () => showToast(`邮箱地址：${email}`)
      );
    } else {
      showToast(`邮箱地址：${email}`);
    }
  }

  // Build 3D Landmark Pins
  const pinElements = chapters.map((ch, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'landmark-pin';
    btn.dataset.idx = String(idx);
    btn.setAttribute('aria-label', `${ch.landmarkName} — ${ch.sectionTitle}`);
    btn.innerHTML = `
      <span class="pin-dot"></span>
      <span class="pin-tag">
        <span class="pin-code">${ch.index}</span>
        <span class="pin-name">${ch.shortLabel.replace(/^\d+\s*/, '')}</span>
      </span>
    `;
    btn.addEventListener('click', () => selectChapter(idx));
    pinsLayer.appendChild(btn);
    return {
      el: btn,
      anchor: new THREE.Vector3(...ch.anchor),
    };
  });

  // Build Bottom Axis Dock buttons
  const dockButtons = chapters.map((ch, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dock-step';
    btn.textContent = ch.sectionTitle;
    btn.addEventListener('click', () => selectChapter(idx));
    axisDock.insertBefore(btn, resetViewBtn);
    return btn;
  });

  function renderDrawer(idx) {
    const ch = chapters[idx];
    if (!ch) return;

    const badgesHtml = ch.badges.map((b) => `<span class="chapter-badge">${b}</span>`).join('');
    const itemsHtml = ch.items
      .map((item) => {
        const stacks = item.stack.map((s) => `<span class="stack-chip">${s}</span>`).join('');
        const links = (item.links || [])
          .map(
            (lnk) =>
              `<a class="entry-link" href="${lnk.url}" target="_blank" rel="noopener noreferrer">${lnk.label}</a>`
          )
          .join('');
        const copyBtn = item.copyEmail
          ? `<button type="button" class="entry-link entry-copy" data-copy-email="${item.copyEmail}">复制邮箱 ${item.copyEmail}</button>`
          : '';

        return `
          <article class="chronicle-entry">
            <div class="entry-head">
              <span class="entry-tag">${item.tag}</span>
              <h3 class="entry-title">${item.title}</h3>
            </div>
            <p class="entry-desc">${item.description}</p>
            <div class="entry-stacks">${stacks}</div>
            ${links || copyBtn ? `<div class="entry-actions">${links}${copyBtn}</div>` : ''}
          </article>
        `;
      })
      .join('');

    drawerBody.innerHTML = `
      <div class="drawer-kicker">
        <span class="kicker-dot" style="background:${ch.accentColor || '#e67aa3'}"></span>
        <span>${ch.landmarkName}</span>
      </div>
      <h2 class="drawer-title">${ch.sectionTitle}</h2>
      <p class="drawer-subtitle">${ch.subtitle}</p>
      <div class="drawer-badges">${badgesHtml}</div>
      <p class="drawer-summary">${ch.summary}</p>
      <div class="drawer-entries">${itemsHtml}</div>
    `;

    drawerBody.querySelectorAll('[data-copy-email]').forEach((btn) => {
      btn.addEventListener('click', () => copyEmail(btn.dataset.copyEmail));
    });

    drawerPrevBtn.textContent = `← ${chapters[(idx - 1 + chapters.length) % chapters.length].shortLabel}`;
    drawerNextBtn.textContent = `${chapters[(idx + 1) % chapters.length].shortLabel} →`;
  }

  function renderCvModal() {
    const highlightsHtml = profile.highlights.map((h) => `<li>${h}</li>`).join('');
    const projectsHtml = chapters
      .flatMap((ch) => ch.items.filter((i) => (i.links && i.links.length > 0) || i.tag.includes('DESIGN')))
      .map(
        (item) => `
          <div class="cv-item">
            <div class="cv-item-top">
              <strong>${item.title}</strong>
              <span class="cv-item-tag">${item.tag}</span>
            </div>
            <p>${item.description}</p>
            <div class="cv-item-links">
              ${(item.links || [])
                .map(
                  (l) =>
                    `<a href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label}</a>`
                )
                .join('')}
            </div>
          </div>
        `
      )
      .join('');

    cvBody.innerHTML = `
      <div class="cv-header">
        <div>
          <p class="cv-kicker">${profile.coords} · ${profile.handle}</p>
          <h2>${profile.name}</h2>
          <p class="cv-affil">${profile.affiliation}</p>
        </div>
        <div class="cv-header-actions">
          <a class="pill-btn pill-primary" href="${profile.githubUrl}" target="_blank" rel="noopener noreferrer">GitHub 主页</a>
          <button type="button" class="pill-btn" id="cv-copy-email-btn">复制邮箱</button>
        </div>
      </div>
      <div class="cv-section">
        <h3>研究方向与工程坐标</h3>
        <div class="drawer-badges">${profile.interests.map((i) => `<span class="chapter-badge">${i}</span>`).join('')}</div>
        <ul class="cv-list">${highlightsHtml}</ul>
      </div>
      <div class="cv-section">
        <h3>代表性开源与视觉交付物</h3>
        <div class="cv-grid">${projectsHtml}</div>
      </div>
    `;

    const copyBtn = document.getElementById('cv-copy-email-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyEmail(profile.email));
    }
  }

  renderCvModal();

  function syncDockActive(activeIndex) {
    dockButtons.forEach((b, i) => b.classList.toggle('is-active', i === activeIndex));
    if (resetViewBtn) resetViewBtn.classList.toggle('is-active', activeIndex === -1);
  }

  function selectChapter(idx, { focusCamera = true } = {}) {
    activeChapterIdx = ((idx % chapters.length) + chapters.length) % chapters.length;
    drawerOpen = true;
    drawer.classList.add('is-open');
    renderDrawer(activeChapterIdx);

    pinElements.forEach((p, i) => p.el.classList.toggle('is-active', i === activeChapterIdx));
    syncDockActive(activeChapterIdx);

    if (focusCamera) {
      onSelectChapter?.(chapters[activeChapterIdx], activeChapterIdx);
    }
  }

  function closeDrawer({ syncOverview = true } = {}) {
    drawerOpen = false;
    drawer.classList.remove('is-open');
    pinElements.forEach((p) => p.el.classList.remove('is-active'));
    if (syncOverview && document.body.dataset.stage === 'explore') {
      syncDockActive(-1);
    } else {
      syncDockActive(null);
    }
  }

  function openCvModal() {
    cvModal.classList.add('is-open');
    cvModal.setAttribute('aria-hidden', 'false');
  }

  function closeCvModal() {
    cvModal.classList.remove('is-open');
    cvModal.setAttribute('aria-hidden', 'true');
  }

  function setStage(stage) {
    document.body.dataset.stage = stage;
    const pinsVisible = stage === 'explore';
    pinsLayer.style.opacity = pinsVisible ? '1' : '0';
    pinsLayer.style.pointerEvents = 'none';
    if (!pinsVisible) {
      pinElements.forEach(({ el }) => {
        el.style.pointerEvents = 'none';
      });
    }
    if (stage === 'portal') {
      portalOverlay.classList.add('is-active');
      campusHud.classList.remove('is-active');
      closeDrawer({ syncOverview: false });
      closeCvModal();
    } else if (stage === 'flythrough') {
      portalOverlay.classList.remove('is-active');
      campusHud.classList.remove('is-active');
    } else if (stage === 'autoplay') {
      portalOverlay.classList.remove('is-active');
      campusHud.classList.add('is-active');
      closeDrawer({ syncOverview: false });
      closeCvModal();
    } else {
      portalOverlay.classList.remove('is-active');
      campusHud.classList.add('is-active');
      if (!drawerOpen) {
        syncDockActive(-1);
      }
    }
  }

  function updateAutoplay({ progress = 0, paused = false, stopIndex = 0, stopLabel = '' } = {}) {
    if (autoplayStopLabel && stopLabel) {
      autoplayStopLabel.textContent = stopLabel;
    }
    if (autoplayProgressFill) {
      const pct = Math.max(0, Math.min(100, progress * 100));
      autoplayProgressFill.style.width = `${pct.toFixed(1)}%`;
    }
    if (autoplayToggleBtn) {
      autoplayToggleBtn.textContent = paused ? '继续' : '暂停';
      autoplayToggleBtn.setAttribute('aria-pressed', String(paused));
    }
    if (document.body.dataset.stage === 'autoplay') {
      syncDockActive(stopIndex);
    }
  }

  function syncMood(mood) {
    document.body.dataset.mood = mood;
    const label = MOOD_LABELS[mood] || (mood === 'sunset' ? '樱霞暮色' : '晴空樱雪');
    moodBtns.forEach((btn) => {
      btn.textContent = `光影 · ${label}`;
    });
  }

  function syncMuted(muted) {
    soundBtns.forEach((btn) => {
      btn.textContent = muted ? '静音' : '音效';
      btn.setAttribute('aria-pressed', String(!muted));
    });
  }

  // Project 3D landmark anchors onto screen coordinates for pins
  // Bounds stay in sync with styles.css (--drawer-width: 380px, --drawer-gap: 20px)
  const projVec = new THREE.Vector3();
  function updatePins(camera, viewportW, viewportH, visible) {
    pinsLayer.style.opacity = visible ? '1' : '0';
    pinsLayer.style.pointerEvents = 'none';
    if (!visible) {
      pinElements.forEach(({ el }) => {
        el.style.pointerEvents = 'none';
      });
      return;
    }

    const isMobile = viewportW <= 768;
    const minY = isMobile ? 116 : 76;
    const maxY = isMobile && drawerOpen ? viewportH * 0.46 : viewportH - (isMobile ? 76 : 84);
    const maxX = !isMobile && drawerOpen ? viewportW - 416 : viewportW - 24;

    pinElements.forEach(({ el, anchor }) => {
      projVec.copy(anchor).project(camera);
      const inFront = projVec.z < 1;
      const x = (projVec.x * 0.5 + 0.5) * viewportW;
      const y = (-projVec.y * 0.5 + 0.5) * viewportH;
      const inBounds = x > 24 && x < maxX && y > minY && y < maxY;

      if (!inFront || !inBounds) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } else {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    });
  }

  function updateTelemetry() {
    if (!getDebugMetrics) return;
    const m = getDebugMetrics();
    const triK = typeof m.triangles === 'number' ? (m.triangles / 1000).toFixed(1) : '--';
    const vramStr = typeof m.vramMB === 'number' ? m.vramMB.toFixed(1) : (m.vramMB ?? '--');
    const moodKey = m.mood || document.body.dataset.mood || 'spring';
    const moodLabel = MOOD_LABELS[moodKey] ? `${moodKey} (${MOOD_LABELS[moodKey]})` : moodKey;
    const stageLabel = m.stage || document.body.dataset.stage || 'portal';
    const shadowSizeLabel = m.shadowMapSize ? `${m.shadowMapSize}×${m.shadowMapSize}` : '--';

    telemetryBtn.innerHTML = `<span>DC ${m.drawCalls} · TRI ${triK}k</span><span class="tel-vram"> · VRAM ${vramStr}MB</span><span class="tel-fps"> · ${m.fps} FPS</span>`;

    if (telemetryExpanded) {
      telemetryPanel.innerHTML = `
        <div class="tel-head">WebGL 渲染与显存遥测</div>
        <div class="tel-row"><span>Stage / Mood</span><strong>${stageLabel} · ${moodLabel}</strong></div>
        <div class="tel-row tel-accent"><span>Frame Rate</span><strong>${m.fps} FPS</strong></div>
        <div class="tel-row"><span>Draw Calls</span><strong>${m.drawCalls}</strong></div>
        <div class="tel-row"><span>Triangles</span><strong>${Number(m.triangles || 0).toLocaleString()}</strong></div>
        <div class="tel-row"><span>Geometries</span><strong>${m.geometries}</strong></div>
        <div class="tel-row"><span>Procedural Textures</span><strong>${m.textures} (${m.textureKB} KB)</strong></div>
        <div class="tel-row tel-accent"><span>Estimated VRAM</span><strong>${vramStr} MB</strong></div>
        <div class="tel-sep"></div>
        <div class="tel-row"><span>Shadow Mode</span><strong>${m.staticShadowMode ?? 'static-bake'}</strong></div>
        <div class="tel-row"><span>Shadow Map Size</span><strong>${shadowSizeLabel}</strong></div>
        <div class="tel-row"><span>Shadow Rebakes</span><strong>${m.rebakeCount ?? 1}</strong></div>
        <div class="tel-row"><span>External Assets</span><strong>0 (Zero-CDN)</strong></div>
      `;
    }
  }

  // Wire controls
  enterBtn.addEventListener('click', () => onEnterPortal?.());
  skipBtn.addEventListener('click', () => onSkipIntro?.());
  replayBtn.addEventListener('click', () => onReplayIntro?.());
  moodBtns.forEach((b) => b.addEventListener('click', () => onToggleMood?.()));
  soundBtns.forEach((b) => b.addEventListener('click', () => onToggleMute?.()));
  if (autoplayToggleBtn) {
    autoplayToggleBtn.addEventListener('click', () => onToggleAutoplayPause?.());
  }
  if (skipAutoplayBtn) {
    skipAutoplayBtn.addEventListener('click', () => onSkipAutoplay?.());
  }
  cvBtn.addEventListener('click', () => {
    onOpenCv?.();
    openCvModal();
  });
  cvCloseBtn.addEventListener('click', closeCvModal);
  cvModal.addEventListener('click', (e) => {
    if (e.target === cvModal) closeCvModal();
  });
  drawerCloseBtn.addEventListener('click', () => closeDrawer());
  drawerPrevBtn.addEventListener('click', () => selectChapter(activeChapterIdx - 1));
  drawerNextBtn.addEventListener('click', () => selectChapter(activeChapterIdx + 1));
  resetViewBtn.addEventListener('click', () => {
    closeDrawer();
    onResetOverview?.();
  });

  if (scrollModeBtn) {
    scrollModeBtn.addEventListener('click', () => onToggleScrollMode?.());
  }

  function syncScrollMode(enabled) {
    if (!scrollModeBtn) return;
    scrollModeBtn.textContent = enabled ? '滚轮 · 顺览' : '滚轮 · 缩放';
    scrollModeBtn.classList.toggle('is-tour', Boolean(enabled));
    scrollModeBtn.setAttribute('aria-pressed', String(Boolean(enabled)));
  }

  function isCvOpen() {
    return cvModal.classList.contains('is-open');
  }

  telemetryBtn.addEventListener('click', () => {
    telemetryExpanded = !telemetryExpanded;
    telemetryPanel.classList.toggle('is-open', telemetryExpanded);
    telemetryBtn.setAttribute('aria-expanded', String(telemetryExpanded));
    updateTelemetry();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cvModal.classList.contains('is-open')) closeCvModal();
      else if (drawerOpen) closeDrawer();
    }
  });

  return {
    setStage,
    updateAutoplay,
    syncDockActive,
    syncMood,
    syncMuted,
    syncScrollMode,
    selectChapter,
    closeDrawer,
    openCvModal,
    closeCvModal,
    isCvOpen,
    showToast,
    updatePins,
    updateTelemetry,
  };
}
