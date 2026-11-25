# -*- coding: utf-8 -*-
"""
Records a seamless 6-second FPV banner from the zero-dependency single-file scene:
fly in through the archway → 108 steps → old dormitory → pull up at the library,
then ease back out — a closed cosine loop (start == end pose, so it tiles forever).
Drives the REAL autoplay spline via window.__WHU_DEBUG__.seekAutoplay so the banner
exactly matches the shipped camera rig. Water, sakura petals & boats keep moving.
"""

import os
import math
import shutil
import time
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

ROOT = r"e:\_ryanDev\github_front"
FRAME_DIR = os.path.join(ROOT, "_frames_full")
if os.path.exists(FRAME_DIR):
    shutil.rmtree(FRAME_DIR)
os.makedirs(FRAME_DIR, exist_ok=True)

WIDTH = 1100
HEIGHT = 385
FPS = 18
DURATION = 6.0
TOTAL_FRAMES = int(FPS * DURATION)
QUALITY = 66

# FPV spline segment 0 → 0.28 (archway → dormitory → library hero) ping-ponged
SEGMENT_END = 0.28


def load_cjk_font(size):
    """PIL's default bitmap font has no CJK glyphs — pull a real system font."""
    for path in (
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\Deng.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


FONT_BADGE = load_cjk_font(17)
FONT_CTA = load_cjk_font(19)

print(f"Launching Playwright to capture {TOTAL_FRAMES} frames at {WIDTH}x{HEIGHT} ...")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
    page.goto("file:///" + os.path.join(ROOT, "index.html").replace("\\", "/"))
    page.wait_for_function("""() => {
      const s = document.getElementById('loading-screen');
      return s && s.classList.contains('is-loaded');
    }""", timeout=30000)
    time.sleep(0.6)

    # Hide every HTML overlay for a pure 3D capture
    page.evaluate("""() => {
      for (const id of ['loading-screen','portal-overlay','campus-hud']) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
      document.body.dataset.hideUi = 'true';
    }""")

    print("Capturing frames (seamless cosine loop)...")
    for frame_idx in range(TOTAL_FRAMES):
        t = frame_idx / float(TOTAL_FRAMES)
        # 0 → SEGMENT_END → 0, zero velocity at both turnarounds (seamless)
        progress = SEGMENT_END * 0.5 * (1.0 - math.cos(math.pi * t))
        page.evaluate("(p) => { window.__WHU_DEBUG__.seekAutoplay(p); }", progress)
        frame_path = os.path.join(FRAME_DIR, f"frame_{frame_idx:04d}.png")
        page.screenshot(path=frame_path)

    browser.close()

print(f"Captured {TOTAL_FRAMES} frames. Compositing overlay badges...")

frame_files = sorted([os.path.join(FRAME_DIR, f) for f in os.listdir(FRAME_DIR) if f.endswith(".png")])
images = [Image.open(f).convert("RGBA") for f in frame_files]

for img in images:
    draw = ImageDraw.Draw(img)
    # Bottom-right CTA
    btn_w, btn_h = 196, 46
    bx = WIDTH - btn_w - 30
    by = HEIGHT - btn_h - 26
    draw.rounded_rectangle([bx, by, bx + btn_w, by + btn_h], radius=23,
                           fill=(255, 255, 255, 232), outline=(255, 255, 255, 255), width=2)
    draw.text((bx + 30, by + 12), "推门入珈  →", font=FONT_CTA, fill=(20, 41, 66))
    # Top-left badge
    draw.rounded_rectangle([26, 22, 26 + 248, 22 + 40], radius=20,
                           fill=(255, 255, 255, 224), outline=(255, 255, 255, 255), width=1)
    draw.text((44, 33), "国立武汉大学 · 3D 校园", font=FONT_BADGE, fill=(20, 41, 66))

out_webp = os.path.join(ROOT, "profile-readme", "portal-banner.webp")
images[0].save(
    out_webp,
    format="WEBP",
    save_all=True,
    append_images=images[1:],
    duration=int(1000 / FPS),
    loop=0,
    quality=QUALITY,
    method=4,
)

mb = os.path.getsize(out_webp) / (1024 * 1024)
print(f"Saved {out_webp} ({mb:.2f} MB, {TOTAL_FRAMES} frames @ {FPS}fps, q{QUALITY})")

shutil.rmtree(FRAME_DIR)
print("Done!")