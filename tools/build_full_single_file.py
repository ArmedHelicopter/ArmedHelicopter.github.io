# -*- coding: utf-8 -*-
"""
Combines the full Wuhan University 3D campus into a TRUE 100% single-file HTML:
- Inlines styles.css into <style>
- Inlines dist/bundle.js (app modules + three.js engine + BufferGeometryUtils) into <script type="module">
  → zero external JS/CSS/image/model/audio references; works from file:// with no server
- Preserves the full scene (terrain, archway, dormitory, library, lake shader, boats, city skyline),
  full UI, CV modal, drawer, telemetry pill
- Adds the loading progress bar + silky-smooth gimbal camera controller

Rebuild after editing src/:  python tools/build_full_single_file.py
"""

import subprocess
import os
import glob

# Resolve esbuild without hitting the network: local install > npx cache > plain npx
def find_esbuild():
    candidates = [
        os.path.join('node_modules', '.bin', 'esbuild.cmd'),
        os.path.join('node_modules', 'esbuild', 'bin', 'esbuild'),
    ]
    candidates += glob.glob(
        os.path.expandvars(
            r'%LOCALAPPDATA%\npm-cache\_npx\*\node_modules\@esbuild\win32-x64\esbuild.exe'
        )
    )
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return 'npx esbuild'

# 1. First ensure dist/bundle.js is up to date (three.js itself is bundled in — zero external files)
subprocess.run([
    find_esbuild(), 'src/main.js',
    '--bundle', '--format=esm',
    '--alias:three=./vendor/three.module.min.js',
    '--alias:three/addons/utils/BufferGeometryUtils.js=./vendor/jsm/utils/BufferGeometryUtils.js',
    '--outfile=dist/bundle.js'
], check=True, shell=True)

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

with open('dist/bundle.js', 'r', encoding='utf-8') as f:
    bundle_js = f.read()

# Add loading progress bar style to CSS
loading_css = """
/* Loading Progress Bar Overlay */
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3d8fcb 0%, #7ec4f4 48%, #fce2ee 100%);
  transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.75s;
}
.loading-screen.is-loaded {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.loading-box {
  width: 90%;
  max-width: 380px;
  padding: 2.5rem 2rem;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 20px 50px rgba(20, 41, 66, 0.18), 0 4px 12px rgba(255, 255, 255, 0.8) inset;
  text-align: center;
}
.loading-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: #1f8fa8;
  background: rgba(31, 143, 168, 0.12);
  padding: 4px 12px;
  border-radius: 99px;
  margin-bottom: 0.85rem;
}
.loading-title {
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #142942;
  margin-bottom: 0.35rem;
}
.loading-sub {
  font-size: 0.85rem;
  color: #5a728d;
  margin-bottom: 1.8rem;
}
.loading-bar-track {
  width: 100%;
  height: 8px;
  background: rgba(20, 41, 66, 0.08);
  border-radius: 99px;
  overflow: hidden;
  position: relative;
  margin-bottom: 0.85rem;
}
.loading-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #1f8fa8 0%, #35b7c9 60%, #e67aa3 100%);
  border-radius: 99px;
  transition: width 0.3s ease;
}
.loading-status-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #6a829e;
}
"""

html_template = f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ruining Yang · 国立武汉大学立体沙盘主页</title>
    <meta
      name="description"
      content="Ruining Yang (@ArmedHelicopter) — 武汉大学人工智能本科生的交互式 3D 校园主页：晴空樱花下穿过国立武汉大学牌坊，在阳光珞珈校园中展开科研、工程与叙事履历。"
    />
    <meta name="theme-color" content="#6fb6e8" />
    <link
      rel="icon"
      type="image/svg+xml"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%236fb6e8'/%3E%3Cstop offset='1' stop-color='%23fde3ee'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='7' fill='url(%23g)'/%3E%3Ccircle cx='26' cy='7' r='3' fill='%23e67aa3'/%3E%3Crect x='5' y='14' width='22' height='2' fill='%231f8fa8'/%3E%3Crect x='10' y='10' width='12' height='2' fill='%231f8fa8'/%3E%3Crect x='10' y='12' width='12' height='4' fill='%23fff'/%3E%3Crect x='6' y='16' width='20' height='3' fill='%23fff'/%3E%3Crect x='6' y='11' width='2.4' height='16' fill='%23fff'/%3E%3Crect x='23.6' y='11' width='2.4' height='16' fill='%23fff'/%3E%3Crect x='12' y='8' width='2.4' height='19' fill='%23fff'/%3E%3Crect x='17.6' y='8' width='2.4' height='19' fill='%23fff'/%3E%3Crect x='4' y='27' width='24' height='1.6' rx='.8' fill='%23142942' opacity='.35'/%3E%3C/svg%3E"
    />
    <style>
{css}
{loading_css}
    </style>
  </head>
  <body data-stage="autoplay" data-mood="spring">
    <!-- Loading Progress Bar Overlay -->
    <div id="loading-screen" class="loading-screen" aria-label="沙盘构建进度">
      <div class="loading-box">
        <div class="loading-badge">WUHAN UNIVERSITY · 1893</div>
        <h2 class="loading-title">国立武汉大学</h2>
        <p class="loading-sub">3D 校园立体沙盘 · Ruining Yang</p>
        <div class="loading-bar-track">
          <div id="loading-bar-fill" class="loading-bar-fill"></div>
        </div>
        <div class="loading-status-row">
          <span id="loading-status-text">正在初始化珞珈山沙盘...</span>
          <span id="loading-status-pct">0%</span>
        </div>
      </div>
    </div>

    <canvas id="whu-canvas" aria-label="武汉大学晴空樱花 3D 校园交互场景"></canvas>

    <!-- Stage 1: Portal Overlay -->
    <section id="portal-overlay" class="portal-overlay" aria-label="入珈门扉">
      <header class="portal-topbar">
        <div class="coord-chip">
          <span class="pulse-dot" aria-hidden="true"></span>
          <span>WHU · 30.536°N 114.364°E</span>
        </div>
        <div class="action-cluster">
          <button type="button" class="pill-btn" data-action="toggle-mood">光影 · 晴空樱雪</button>
          <button type="button" class="pill-btn" data-action="toggle-sound" aria-pressed="true">音效</button>
        </div>
      </header>

      <div class="portal-footer">
        <div class="portal-identity">
          <h1 class="portal-name">Ruining Yang</h1>
          <p class="portal-sub">武汉大学 · 人工智能 · Deep Learning / AI4S / BCI</p>
          <p class="portal-scroll-hint">向下滚动滚轮或点击 · 穿坊游览校园</p>
        </div>
        <div class="portal-actions">
          <button type="button" id="enter-portal-btn" class="cta-portal">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span>推门入珈</span>
          </button>
          <button type="button" id="skip-intro-btn" class="skip-link">跳过开场</button>
        </div>
      </div>
    </section>

    <!-- Stage 3: Aerial Campus Exploration HUD -->
    <div id="campus-hud" class="campus-hud">
      <header class="hud-topbar">
        <div class="brand-lockup">
          <span class="pulse-dot" aria-hidden="true"></span>
          <div class="brand-text">
            <strong>Ruining Yang</strong>
            <span>@ArmedHelicopter · WHU</span>
          </div>
        </div>

        <div class="action-cluster">
          <div class="telemetry-wrap">
            <button
              type="button"
              id="telemetry-pill"
              class="pill-btn mono-pill"
              aria-expanded="false"
              title="查看渲染、静态阴影与显存优化统计"
            >
              DC -- · TRI -- · 60 FPS
            </button>
            <div id="telemetry-panel" class="telemetry-panel" role="region" aria-label="渲染与显存统计"></div>
          </div>
          <button type="button" id="replay-intro-btn" class="pill-btn">重播巡游</button>
          <button type="button" class="pill-btn" data-action="toggle-mood">光影 · 晴空樱雪</button>
          <button type="button" class="pill-btn" data-action="toggle-sound" aria-pressed="true">音效</button>
          <button type="button" id="open-cv-btn" class="pill-btn pill-primary">完整履历</button>
        </div>
      </header>

      <!-- 3D Projected Landmark Pins -->
      <div id="pins-layer" class="pins-layer" aria-label="校园地标坐标"></div>

      <!-- Right Unfolding Chronicle Drawer / Mobile Bottom Sheet -->
      <aside id="chronicle-drawer" class="chronicle-drawer" aria-label="履历展开抽屉">
        <div class="drawer-toolbar">
          <span class="drawer-rail-hint">珞珈行迹 · Chronicle</span>
          <button type="button" id="drawer-close-btn" class="icon-close" aria-label="收起履历面板">✕</button>
        </div>
        <div id="drawer-body" class="drawer-body"></div>
        <div class="drawer-nav">
          <button type="button" id="drawer-prev-btn" class="nav-step-btn">← 上一站</button>
          <button type="button" id="drawer-next-btn" class="nav-step-btn">下一站 →</button>
        </div>
      </aside>

      <!-- Autoplay FPV Tour Status Pill -->
      <div id="autoplay-bar" class="autoplay-bar" role="region" aria-label="FPV 自动巡游控制">
        <div class="autoplay-meta">
          <span class="pulse-dot" aria-hidden="true"></span>
          <span id="autoplay-stop-label" class="autoplay-stop-label">01/04 · 国立武汉大学牌坊</span>
        </div>
        <div class="autoplay-track" aria-hidden="true">
          <div id="autoplay-progress-fill" class="autoplay-progress-fill"></div>
        </div>
        <div class="autoplay-actions">
          <button type="button" id="autoplay-toggle-btn" class="autoplay-btn">暂停</button>
          <button type="button" id="skip-autoplay-btn" class="autoplay-btn autoplay-btn-primary">跳过巡游</button>
        </div>
      </div>

      <!-- Bottom Campus Axis Dock -->
      <nav id="axis-dock" class="axis-dock" aria-label="校园轴线导航">
        <button type="button" id="reset-view-btn" class="dock-step dock-reset">全景视角</button>
        <button
          type="button"
          id="scroll-mode-btn"
          class="dock-step dock-mode"
          title="滚轮向下按顺序游览各个地标；按住 Ctrl + 滚轮可随时缩放视角"
        >
          滚轮 · 顺览
        </button>
      </nav>
    </div>

    <!-- Full CV Executive Sheet Modal -->
    <div id="cv-modal" class="cv-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="完整履历总览">
      <div class="cv-sheet">
        <button type="button" id="cv-close-btn" class="icon-close cv-close" aria-label="关闭履历总览">✕</button>
        <div id="cv-body"></div>
      </div>
    </div>

    <div id="toast-banner" class="toast-banner" role="status" aria-live="polite"></div>

    <!-- Non-WebGL Graceful Fallback -->
    <main id="webgl-fallback" class="webgl-fallback" hidden>
      <div class="fallback-card">
        <h1>Ruining Yang · @ArmedHelicopter</h1>
        <p>武汉大学人工智能本科生 · Deep Learning / AI4S / BCI · 2025302193007@whu.edu.cn</p>
        <p class="fallback-note">当前浏览器环境未开启 WebGL，已为您展示静态履历摘要：</p>
        <ul id="fallback-links"></ul>
      </div>
    </main>

    <!-- Inlined Full Application Bundle -->
    <script type="module">
{bundle_js}

      // Smooth progress bar completion trigger
      const loadFill = document.getElementById('loading-bar-fill');
      const loadPct = document.getElementById('loading-status-pct');
      const loadTxt = document.getElementById('loading-status-text');
      const loadScreen = document.getElementById('loading-screen');
      if (loadFill && loadScreen) {{
        loadFill.style.width = '100%';
        if (loadPct) loadPct.textContent = '100%';
        if (loadTxt) loadTxt.textContent = '构建完成 · 欢迎推门入珈';
        setTimeout(() => {{
          loadScreen.classList.add('is-loaded');
        }}, 350);
      }}
    </script>
  </body>
</html>
"""

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

with open('standalone.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

print("Successfully written 100% full-fidelity single-file index.html and standalone.html!")
