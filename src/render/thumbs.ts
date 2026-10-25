// Renders each building model once into a small PNG for the build menu.
import * as THREE from 'three';
import { model } from './models';
import { outlineMat } from './toon';
import { worldMaterial } from './shared';
import { BUILDINGS, BuildingId } from '../sim/data';

export function makeThumbs(types: BuildingId[], size = 112): Record<string, string> {
  const out: Record<string, string> = {};
  let r: THREE.WebGLRenderer;
  try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
  catch { return out; }
  r.setPixelRatio(1);
  r.setSize(size, size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a080, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const mat = worldMaterial();
  for (const t of types) {
    if (t === 'road') continue;
    const m = model(t, 'peasant', 0);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(m.body, mat), new THREE.Mesh(m.line, outlineMat(0.03)));
    for (const a of m.anims) {
      const o = new THREE.Group();
      o.add(new THREE.Mesh(a.geo.body, mat), new THREE.Mesh(a.geo.line, outlineMat(0.025)));
      o.position.set(...a.at);
      g.add(o);
    }
    scene.add(g);
    const s = Math.max(...BUILDINGS[t].size);
    const d = s * 1.5 + 1.4;
    cam.position.set(d * 0.62, d * 0.6 + m.height * 0.3, d * 0.72);
    cam.lookAt(0, m.height * 0.42, 0);
    r.render(scene, cam);
    out[t] = r.domElement.toDataURL('image/png');
    scene.remove(g);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
