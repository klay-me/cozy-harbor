import './style.css';
import { Game } from './sim/game';
import { BUILDINGS, BuildingId, BUILD_MENU } from './sim/data';
import { View } from './render/view';
import { Hud, Tool } from './ui/hud';
import { makeThumbs } from './render/thumbs';
import { Sound } from './audio/sound';
import { loadModels } from './render/assets';
import type { RotateMode } from './render/camera';

const SAVE_KEY = 'cozy-harbor-save-v1';

async function boot() {
  const stage = document.getElementById('stage')!;
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = '正在搭建小镇…';
  document.body.appendChild(loading);
  try {
    // the .glb is used normally; some hosts only serve JSON, so an embedded .json copy is the fallback
    try { await loadModels(new URL('models/town.glb', document.baseURI).href); }
    catch { await loadModels(new URL('models/town.json', document.baseURI).href); }
  }
  catch (e) {
    loading.textContent = '模型加载失败，请刷新页面重试。';
    console.error(e);
    return;
  }
  loading.remove();
  if (location.hash.startsWith('#gallery')) {
    const { gallery } = await import('./dev/gallery');
    gallery(stage, { snow: location.hash.includes('snow') ? 0.8 : 0, glow: location.hash.includes('night') ? 1 : 0 });
    return;
  }
  const hudEl = document.getElementById('hud')!;
  const floats = document.getElementById('floats')!;
  let view: View;
  try { view = new View(stage, floats); }
  catch {
    document.body.insertAdjacentHTML('beforeend', '<div class="fail">这台设备的浏览器不支持 WebGL，暂时玩不了。</div>');
    return;
  }

  const sound = new Sound();
  const unlock = () => sound.unlock();
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  let rotMode: RotateMode = 'look';
  try { if (localStorage.getItem('cozy-harbor-rotate') === 'orbit') rotMode = 'orbit'; } catch { /* ignore */ }
  view.rig.mode = rotMode;
  view.onThunder = d => setTimeout(() => sound.play('thunder'), d * 1000);

  const allTypes = BUILD_MENU.flatMap(c => c.items);
  const hud = new Hud(hudEl, {
    tool: t => setTool(t),
    speed: s => { game.speed = s; },
    save: () => save(true),
    newGame: () => start(new Game(Math.floor(Math.random() * 1e9))),
    upgrade: b => game.upgrade(b),
    upgradeAll: () => game.upgradeAll(),
    demolish: b => { game.demolish(b.x, b.z); select(null); },
    close: () => select(null),
    focus: b => { const c = game.center(b); view.rig.jumpTo(c.x - view.half, c.z - view.half); },
    audio: p => sound.set(p),
    rotateMode: m => { view.rig.mode = m; try { localStorage.setItem('cozy-harbor-rotate', m); } catch { /* ignore */ } },
    click: () => sound.play('click'),
  }, makeThumbs(allTypes));
  hud.setAudio(sound.settings, rotMode);

  let game: Game;
  let tool: Tool = 'select';
  let selected: number | null = null;
  let roadStart: { x: number; z: number } | null = null;

  function start(g: Game) {
    game = g;
    view.setGame(g);
    hud.setGame(g);
    setTool('select');
    select(null);
  }
  function save(announce = false) {
    try {
      localStorage.setItem(SAVE_KEY, game.serialize());
      if (announce) game.notify('已保存', 'good');
    } catch {
      if (announce) game.notify('保存失败：浏览器不允许本地存储', 'warn');
    }
  }
  function setTool(t: Tool) {
    tool = t;
    hud.setTool(t);
    view.setGrid(t !== 'select');
    if (t === 'select' || t === 'demolish' || t === 'road') view.showGhost(null);
    view.showRoadPath(null);
    roadStart = null;
    if (t !== 'select') select(null);
    document.body.dataset.tool = t;
  }
  function select(id: number | null) {
    selected = id;
    const b = id ? game.buildings.get(id) ?? null : null;
    hud.select(b);
    view.select(b);
  }

  // ---------- load ----------
  let saved: string | null = null;
  try { saved = localStorage.getItem(SAVE_KEY); } catch { /* storage blocked */ }
  start((saved && Game.load(saved)) || new Game(20261025));
  setInterval(() => save(false), 30000);

  // ---------- input ----------
  const canvas = view.renderer.domElement;
  let hover: { x: number; z: number } | null = null;
  let down: { x: number; y: number; btn: number; moved: boolean; id: number } | null = null;
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; a: number; cx: number; cy: number } | null = null;
  let touchGhost: string | null = null;

  const anchor = (t: BuildingId, p: { x: number; z: number }) => {
    const [w, h] = BUILDINGS[t].size;
    return { x: p.x - Math.floor((w - 1) / 2), z: p.z - Math.floor((h - 1) / 2) };
  };
  function updatePreview() {
    if (!hover) return;
    if (tool === 'road') {
      const path = roadStart ? game.roadPath(roadStart.x, roadStart.z, hover.x, hover.z) : [[hover.x, hover.z] as [number, number]];
      view.showRoadPath(path, (x, z) => game.roadTileOk(x, z));
    } else if (tool !== 'select' && tool !== 'demolish') {
      const a = anchor(tool, hover);
      view.showGhost(tool, a.x, a.z, game.canPlace(tool, a.x, a.z).ok);
    }
  }
  function act(p: { x: number; z: number }) {
    if (tool === 'select') {
      const b = game.at(p.x, p.z);
      select(b ? b.id : null);
    } else if (tool === 'demolish') {
      game.demolish(p.x, p.z);
    } else if (tool !== 'road') {
      const a = anchor(tool, p);
      game.place(tool, a.x, a.z);
      updatePreview();
    }
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        down = null; roadStart = null; view.showRoadPath(null);
        return;
      }
    }
    down = { x: e.clientX, y: e.clientY, btn: e.button, moved: false, id: e.pointerId };
    const p = view.pick(e.clientX, e.clientY);
    if (e.button === 0 && tool === 'road' && p) { roadStart = p; hover = p; updatePreview(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      const prev = touches.get(e.pointerId)!;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        view.rig.zoom(pinch.d / d);
        view.rig.rotate(ang - pinch.a);
        view.rig.panPixels(cx - pinch.cx, cy - pinch.cy);
        pinch = { d, a: ang, cx, cy };
        return;
      }
      if (down && down.id === e.pointerId && tool !== 'road') {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
        if (down.moved) view.rig.panPixels(e.clientX - prev.x, e.clientY - prev.y);
      }
    } else if (down) {
      const dx = e.movementX, dy = e.movementY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
      if (down.moved) {
        // right or left drag moves the map, middle drag turns the view
        if (down.btn === 1) view.rig.rotate(-dx * 0.004);
        else if (down.btn === 2 || (down.btn === 0 && tool !== 'road')) view.rig.panPixels(dx, dy);
      }
    }
    const p = view.pick(e.clientX, e.clientY);
    if (p && (!hover || p.x !== hover.x || p.z !== hover.z)) {
      if (e.pointerType !== 'touch' || tool === 'road') { hover = p; updatePreview(); }
    }
  });
  const end = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
    }
    if (!down || down.id !== e.pointerId) return;
    const d = down;
    down = null;
    if (e.type === 'pointercancel') { roadStart = null; view.showRoadPath(null); return; }
    const p = view.pick(e.clientX, e.clientY);
    if (d.btn === 2 && !d.moved) { setTool('select'); return; }
    if (d.btn !== 0) return;
    if (tool === 'road') {
      if (roadStart && p) game.placeRoads(game.roadPath(roadStart.x, roadStart.z, p.x, p.z));
      roadStart = null;
      hover = p; updatePreview();
      if (e.pointerType === 'touch') view.showRoadPath(null);
      return;
    }
    if (d.moved || !p) return;
    if (e.pointerType === 'touch' && tool !== 'select' && tool !== 'demolish') {
      // first tap previews, second tap on the same spot builds
      const k = `${tool}:${p.x},${p.z}`;
      hover = p; updatePreview();
      if (touchGhost !== k) { touchGhost = k; return; }
      touchGhost = null;
    }
    act(p);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  const keys = new Set<string>();
  addEventListener('keydown', e => {
    if ((e.target as HTMLElement).closest('input,textarea')) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'escape') { setTool('select'); select(null); }
    if (k === ' ') { e.preventDefault(); game.speed = game.speed === 0 ? 1 : 0; }
    if (k === 'x') setTool(tool === 'demolish' ? 'select' : 'demolish');
    for (const t of Object.keys(BUILDINGS) as BuildingId[]) if (BUILDINGS[t].hotkey?.toLowerCase() === k) setTool(tool === t ? 'select' : t);
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  // ---------- loop ----------
  let last = performance.now();
  let mixT = 0;
  let lastHour = -1;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const pan = 18 * dt * (view.rig.dist / 22);
    if (keys.has('w') || keys.has('arrowup')) view.rig.pan(0, pan);
    if (keys.has('s') || keys.has('arrowdown')) view.rig.pan(0, -pan);
    if (keys.has('a') || keys.has('arrowleft')) view.rig.pan(-pan, 0);
    if (keys.has('d') || keys.has('arrowright')) view.rig.pan(pan, 0);
    if (keys.has('q')) view.rig.rotate(1.5 * dt);
    if (keys.has('e')) view.rig.rotate(-1.5 * dt);
    game.update(dt);
    for (const s of game.sfx.splice(0)) sound.play(s);
    if (game.events.length) sound.play('produce');
    mixT -= dt;
    if (mixT <= 0) { mixT = 0.5; sound.setScene(view.weatherMix(), game.season); }
    const hourNow = Math.floor(game.hour);
    if (hourNow !== lastHour) { if (hourNow === 6 && lastHour === 5) sound.play('bell'); lastHour = hourNow; }
    if (selected && !game.buildings.has(selected)) select(null);
    view.render(dt, dt * game.speed);
    hud.update(dt);
  }
  requestAnimationFrame(frame);
  // test hook
  (window as any).__cozy = { get game() { return game; }, view, setTool, select, sound };
}

boot();
