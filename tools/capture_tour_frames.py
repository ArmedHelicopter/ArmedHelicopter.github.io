# -*- coding: utf-8 -*-
"""
Captures fixed architectural views, 13 FPV seek frames, a live-vs-seek check,
41-point camera path telemetry, and raycast clearance diagnostics from file://.

Usage:
  python tools/capture_tour_frames.py [output_dir]
"""

import json
import math
import os
import sys
import time
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

DEFAULT_OUT = (
    r"C:\Users\Administrator\.gemini\antigravity\brain"
    r"\f0ac36da-f49c-46d9-b199-8115657a0953\scratch\round_1"
)
URL = "file:///E:/_ryanDev/github_front/index.html"

FIXED_VIEWS = [
    ("overview", [21.2, 15.8, 26.2], [0.0, 3.5, 0.8]),
    ("lake", [24.0, 3.2, -2.0], [14.0, 0.8, -8.0]),
    ("archway", [0.0, 2.35, 31.2], [0.0, 4.6, 15.5]),
    ("library", [7.8, 10.6, -8.6], [0.0, 9.2, -9.8]),
    ("hills", [-6.0, 9.0, 30.0], [-40.0, 6.0, -20.0]),
]

FPV_TS = [0.0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.56, 0.64, 0.72, 0.80, 0.88, 1.0]


def norm3(v):
    m = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return [v[0] / m, v[1] / m, v[2] / m]


def angle_deg(a, b):
    d = max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    return math.degrees(math.acos(d))


def image_mean_diff(path_a, path_b):
    ia = Image.open(path_a).convert("RGB")
    ib = Image.open(path_b).convert("RGB")
    diff = ImageChops.difference(ia, ib)
    hist = diff.histogram()
    total = ia.width * ia.height * 3
    sq = sum((i % 256) * c for i, c in enumerate(hist))
    return sq / float(total)


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    os.makedirs(out_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"]
        )
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.set_default_timeout(180000)

        page_errors = []
        console_errors = []
        forest_logs = []

        page.on("pageerror", lambda e: page_errors.append(str(e)))

        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)
            elif "Forest carpet" in msg.text:
                forest_logs.append(msg.text)

        page.on("console", on_console)

        page.goto(URL)
        time.sleep(5.0)

        # Wait ~7 more seconds (~12s total) of genuine live autoplay, capture & compare with seek
        time.sleep(7.0)
        page.evaluate(
            "() => { window.__WHU_DEBUG__.pauseAutoplay(true); document.body.dataset.hideUi = 'true'; }"
        )
        time.sleep(0.25)
        live_st = page.evaluate("() => window.__WHU_DEBUG__.getAutoplayState()")
        live_path = os.path.join(out_dir, "live_12s.png")
        page.screenshot(path=live_path)

        page.evaluate(f"() => {{ window.__WHU_DEBUG__.seekAutoplay({live_st['progress']}); document.body.dataset.hideUi = 'true'; }}")
        time.sleep(0.25)
        seek_cmp_path = os.path.join(out_dir, "seek_at_12s.png")
        page.screenshot(path=seek_cmp_path)
        live_diff = image_mean_diff(live_path, seek_cmp_path)

        # Fixed architectural views
        for name, pos, tgt in FIXED_VIEWS:
            page.evaluate(
                f"() => window.__WHU_DEBUG__.setCamera({pos}, {tgt}, {{ stage: 'explore', hideUi: true }})"
            )
            time.sleep(0.45)
            page.screenshot(path=os.path.join(out_dir, f"view_{name}.png"))

        # 13 FPV seek frames (UI hidden)
        fpv_states = []
        for idx, t in enumerate(FPV_TS):
            st = page.evaluate(
                f"() => {{ const s = window.__WHU_DEBUG__.seekAutoplay({t}); document.body.dataset.hideUi = 'true'; return s; }}"
            )
            time.sleep(0.35)
            fpv_states.append(st)
            page.screenshot(path=os.path.join(out_dir, f"fpv_{idx:02d}_t{int(round(t*100)):03d}.png"))

        # 41-point path telemetry & smoothness checks
        path_samples = []
        for i in range(41):
            t = i / 40.0
            st = page.evaluate(f"() => window.__WHU_DEBUG__.seekAutoplay({t})")
            look_vec = norm3(
                [
                    st["cameraTarget"][j] - st["cameraPos"][j]
                    for j in range(3)
                ]
            )
            st["lookDir"] = look_vec
            path_samples.append(st)

        max_step_deg = 0.0
        max_step_t = 0.0
        for i in range(1, len(path_samples)):
            ang = angle_deg(path_samples[i - 1]["lookDir"], path_samples[i]["lookDir"])
            if ang > max_step_deg:
                max_step_deg = ang
                max_step_t = path_samples[i]["t"] if "t" in path_samples[i] else path_samples[i]["progress"]

        stops = page.evaluate("() => window.__WHU_DEBUG__.getAutoplayStops()")
        metrics = page.evaluate("() => window.__WHU_DEBUG__.getMetrics()")
        clearance = page.evaluate("() => window.__WHU_DEBUG__.probeAutoplayClearance(160)")

        browser.close()

    report = {
        "url": URL,
        "pageErrors": page_errors,
        "consoleErrors": console_errors,
        "forestLogs": forest_logs,
        "metrics": metrics,
        "stops": stops,
        "maxStepLookDeltaDeg": round(max_step_deg, 2),
        "maxStepLookDeltaAt": round(max_step_t, 4),
        "liveProgressAt12s": live_st["progress"],
        "liveVsSeekMeanChannelDiff": round(live_diff, 3),
        "clearance": {
            "blockingCount": len(clearance["blocking"]),
            "blocking": clearance["blocking"],
            "foliageCount": len(clearance["foliage"]),
            "maxFwdAttAngleDeg": clearance["maxFwdAttAngleDeg"],
        },
        "pathSamples": path_samples,
    }
    report_path = os.path.join(out_dir, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(json.dumps({k: v for k, v in report.items() if k != "pathSamples"}, indent=2, ensure_ascii=False))
    print(f"Saved screenshots and report to {out_dir}")


if __name__ == "__main__":
    main()
