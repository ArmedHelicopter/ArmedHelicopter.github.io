# -*- coding: utf-8 -*-
"""
Records the high-fidelity 6-second dynamic tour from the full 288k-triangle scene
and saves it as portal-banner.webp and portal-banner.gif.
"""

import os
import shutil
import time
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

FRAME_DIR = r"e:\_ryanDev\github_front\_frames_full"
if os.path.exists(FRAME_DIR):
    shutil.rmtree(FRAME_DIR)
os.makedirs(FRAME_DIR, exist_ok=True)

WIDTH = 1200
HEIGHT = 420
TOTAL_FRAMES = 90 # 6.0 seconds at 15 fps
FPS = 15

print(f"Launching Playwright to capture {TOTAL_FRAMES} frames of the full 3D scene...")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
    page.goto("http://127.0.0.1:8765/index.html")
    time.sleep(3.5) # Wait for scene to load completely

    # Hide HTML overlays so we capture the pure, majestic 3D scene
    page.evaluate("""() => {
      const ls = document.getElementById('loading-screen');
      if (ls) ls.style.display = 'none';
      const po = document.getElementById('portal-overlay');
      if (po) po.style.display = 'none';
      const ch = document.getElementById('campus-hud');
      if (ch) ch.style.display = 'none';
    }""")

    print("Capturing frames...")
    for frame_idx in range(TOTAL_FRAMES):
        t = frame_idx / float(TOTAL_FRAMES) # 0.0 to 1.0

        # Programmatic camera move from Archway through bay onto avenue and sweeping upward
        page.evaluate(f"""(t) => {{
          if (window.camera) {{
            // Forward glide and gentle banking
            const z = 31.5 * (1.0 - t * 0.72);
            const x = Math.sin(t * Math.PI * 1.2) * 4.2;
            const y = 3.2 + Math.sin(t * Math.PI) * 4.8;
            window.camera.position.set(x, y, z);
            
            const tgtX = Math.sin(t * Math.PI) * 1.5;
            const tgtY = 4.2 + Math.sin(t * Math.PI) * 2.2;
            const tgtZ = 15.5 * (1.0 - t * 0.85);
            window.camera.lookAt(tgtX, tgtY, tgtZ);
          }}
        }}""", t)

        frame_path = os.path.join(FRAME_DIR, f"frame_{frame_idx:04d}.png")
        page.screenshot(path=frame_path)

    browser.close()

print(f"Captured {TOTAL_FRAMES} frames. Adding elegant overlay badges and saving...")

frame_files = sorted([os.path.join(FRAME_DIR, f) for f in os.listdir(FRAME_DIR) if f.endswith(".png")])
images = [Image.open(f) for f in frame_files]

for img in images:
    draw = ImageDraw.Draw(img)
    # Bottom right button: "推门入珈 →"
    btn_w, btn_h = 210, 48
    bx = WIDTH - btn_w - 32
    by = HEIGHT - btn_h - 28
    draw.rounded_rectangle([bx, by, bx + btn_w, by + btn_h], radius=24, fill=(255, 255, 255, 230), outline=(255, 255, 255, 255), width=2)
    draw.text((bx + 34, by + 12), "推门入珈  →", fill=(20, 41, 66))

    # Top left badge: "国立武汉大学 · 3D 校园"
    draw.rounded_rectangle([28, 24, 28 + 260, 24 + 42], radius=21, fill=(255, 255, 255, 220), outline=(255, 255, 255, 255), width=1)
    draw.text((46, 35), "国立武汉大学 · 3D 校园", fill=(20, 41, 66))

out_webp = r"e:\_ryanDev\github_front\profile-readme\portal-banner.webp"
images[0].save(
    out_webp,
    format="WEBP",
    save_all=True,
    append_images=images[1:],
    duration=int(1000 / FPS),
    loop=0,
    quality=75,
    method=6
)

print(f"Saved full-fidelity {out_webp} ({os.path.getsize(out_webp)/(1024*1024):.2f} MB)!")

shutil.rmtree(FRAME_DIR)
print("Done!")
