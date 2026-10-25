// Renders each building model once into a small PNG for the build menu.
import * as THREE from 'three';
import { model } from './models';
import { toon, outlineMat } from './toon';
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
  const mat = toon(0xffffff, { vertexColors: true });
  for (const t of types) {
    if (t === 'road') continue;
    const m = model(t, 'peasant', 0);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(m.body, mat), new THREE.Mesh(m.line, outlineMat(0.035)));
    if (m.anim) {
      const a = new THREE.Group();
      a.add(new THREE.Mesh(m.anim.geo.body, mat), new THREE.Mesh(m.anim.geo.line, outlineMat(0.03)));
      a.position.set(...m.anim.at);
      g.add(a);
    }
    scene.add(g);
    const s = Math.max(...BUILDINGS[t].size);
    const d = s * 1.55 + 1.2;
    cam.position.set(d * 0.62, d * 0.62, d * 0.72);
    cam.lookAt(0, 0.45 + (t === 'mill' ? 0.4 : 0), 0);
    r.render(scene, cam);
    out[t] = r.domElement.toDataURL('image/png');
    scene.remove(g);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
