"""Capture upgrade-line and animation galleries from the production build.

Usage: npm run build && python3 tools/test/gallery-shot.py [model_name ...]
Also accepts model_name-pose for a static swinging-part pose.
Install: pip install playwright && python3 -m playwright install chromium
Optional env: CHROMIUM_EXECUTABLE_PATH; OUT (default tools/test/shots/).
Screenshots and screenshots.json are ignored; any page/asset failure exits nonzero.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FLAGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--autoplay-policy=no-user-gesture-required"]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("models", nargs="*", help="Exact atlas root names, optionally followed by -pose")
    args = parser.parse_args()
    for name in args.models:
        if not re.fullmatch(r"[a-z0-9_]+(?:-pose)?", name):
            parser.error(f"Invalid model name: {name}")
    if not (ROOT / "dist/index.html").is_file():
        parser.error("dist/index.html missing; run npm run build first")
    out = Path(os.environ.get("OUT", ROOT / "tools/test/shots"))
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT / "dist")))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    shots = ["gallery-lines", "gallery-m2", "gallery-anim"]
    shots.extend(f"gallery-one={name}" for name in args.models)
    failures, results = [], []
    try:
        with sync_playwright() as p:
            launch = {"args": FLAGS}
            if os.environ.get("CHROMIUM_EXECUTABLE_PATH"):
                launch["executable_path"] = os.environ["CHROMIUM_EXECUTABLE_PATH"]
            browser = p.chromium.launch(**launch)
            page = browser.new_page(viewport={"width": 1600, "height": 1200}, device_scale_factor=1)
            page.route("**/fonts.g*/**", lambda route: route.abort())
            page.on("pageerror", lambda error: failures.append(str(error)))
            page.on("response", lambda response: failures.append(f"{response.status} {response.url}")
                    if response.status >= 400 and not response.url.endswith("favicon.ico") else None)
            page.on("console", lambda message: failures.append(message.text)
                    if message.type == "error" and "ERR_FAILED" not in message.text
                    and "404 (Not Found)" not in message.text else None)
            for shot in dict.fromkeys(shots):
                before = len(failures)
                url = f"http://127.0.0.1:{server.server_port}/index.html#{shot}"
                # Hash-only navigation would keep the previous gallery mounted.
                page.goto("about:blank")
                page.goto(url, wait_until="commit")
                page.wait_for_selector('[data-gallery-ready="true"]', timeout=120000)
                # Wait for fonts and an actual animation frame, not just model download.
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(600)
                page.keyboard.press("Space")
                models = page.locator('[data-gallery-ready="true"]').get_attribute("data-gallery-models").split(",")
                if shot.startswith("gallery-one="):
                    expected = shot.split("=", 1)[1].removesuffix("-pose")
                    if models != [expected]:
                        failures.append(f"Expected {expected}, rendered {models}")
                filename = shot.replace("=", "-") + ".png"
                page.screenshot(path=str(out / filename), timeout=200000, animations="disabled")
                result = {"gallery": shot, "models": models, "file": filename,
                          "errors": failures[before:]}
                results.append(result)
                print(f"{shot}: {len(models)} models -> {out / filename}", flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
        (out / "screenshots.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    if failures:
        raise SystemExit("Gallery errors:\n" + "\n".join(failures))


if __name__ == "__main__":
    main()
