# -*- coding: utf-8 -*-
import os
import time
from playwright.sync_api import sync_playwright

views = [
    ('overview', [24, 26, 36], [0, 4, 0]),
    ('lingbo_water', [20, 2.8, -3.5], [14, 0.5, -8.0]),
    ('lingbo_shore_clipping', [12.5, 3.2, 5.5], [8.0, 0.4, 3.0]),
    ('sakura_avenue', [-2, 2.0, 11], [-1, 2.6, 2]),
    ('old_library', [-1, 9.2, 4], [0, 7.8, -8])
]

os.makedirs('audit_shots', exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:8765/index.html')
    time.sleep(3.5)
    page.evaluate('''() => {
      const ls = document.getElementById('loading-screen');
      if (ls) ls.style.display = 'none';
      const po = document.getElementById('portal-overlay');
      if (po) po.style.display = 'none';
      const ch = document.getElementById('campus-hud');
      if (ch) ch.style.display = 'none';
    }''')
    for name, pos, tgt in views:
        page.evaluate(f'''() => {{
            if (window.__WHU_DEBUG__ && window.__WHU_DEBUG__.setCamera) {{
                window.__WHU_DEBUG__.setCamera({pos}, {tgt}, {{ stage: 'explore', hideUi: true }});
            }} else if (window.camera) {{
                window.camera.position.set({pos[0]}, {pos[1]}, {pos[2]});
                window.camera.lookAt({tgt[0]}, {tgt[1]}, {tgt[2]});
            }}
        }}''')
        time.sleep(0.8)
        page.screenshot(path=f'audit_shots/{name}.png')
        print(f'Captured audit_shots/{name}.png')
    browser.close()
print('All views captured successfully!')
