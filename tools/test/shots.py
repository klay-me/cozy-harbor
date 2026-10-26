# Headless screenshots of the built game (npm run build first). Loads tools/test/save-era2.json,
# then runs a list of steps from a JSON file: [{"js": "...", "click": [x,y], "key": "t", "wait": ms, "shot": "name"}].
# The game is reachable from js as window.__cozy (game, view, hud, sound, select, setTool).
# Usage: python3 tools/test/shots.py steps.json   (screenshots land in tools/test/shots/, or $OUT)
import subprocess, time, json, sys, random
PORT=random.randint(5000,9000)
from playwright.sync_api import sync_playwright
import os
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,"..",".."))
D=os.environ.get("OUT", os.path.join(HERE,"shots"))+"/"
os.makedirs(D, exist_ok=True)
SAVE=open(os.path.join(HERE,"save-era2.json")).read()
srv=subprocess.Popen(["python3","-m","http.server",str(PORT),"-d",os.path.join(ROOT,"dist")],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
steps=json.load(open(sys.argv[1]))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"])
    pg=b.new_page(viewport={"width":1280,"height":760}); pg.route("**/fonts.g*/**",lambda r:r.abort())
    pg.on("pageerror",lambda e:print("ERR",e,flush=True))
    pg.on("console",lambda c:print("CON",c.text[:300],flush=True) if c.type in("error",) and "ERR_FAILED" not in c.text else None)
    pg.add_init_script("localStorage.setItem('cozy-harbor-save-v2', "+json.dumps(SAVE)+")")
    pg.goto("http://localhost:"+str(PORT)+"/index.html",wait_until="commit")
    pg.wait_for_timeout(9000)
    for st in steps:
        if 'js' in st: print(st.get('name',''), pg.evaluate(st['js']), flush=True)
        if 'click' in st: pg.mouse.click(*st['click'])
        if 'key' in st: pg.keyboard.press(st['key'])
        pg.wait_for_timeout(st.get('wait',500))
        if 'shot' in st: pg.screenshot(path=D+st['shot']+".png", timeout=200000, animations="disabled")
finally:
  srv.kill()
