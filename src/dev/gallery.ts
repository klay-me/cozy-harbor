// Developer view: open the game with #gallery to see every model side by side.
import * as THREE from 'three';
import { getModel, hasModel } from '../render/assets';
import { worldMaterial, ENV } from '../render/shared';
import { outlineMat } from '../render/toon';

const NAMES = ['house_peasant_0', 'house_peasant_1', 'house_worker_0', 'house_worker_1', 'depot', 'warehouse',
  'lumberjack', 'sawmill', 'fishery', 'farm', 'mill', 'bakery', 'market', 'tavern',
  'tree_round', 'tree_pine', 'bush', 'rock', 'lamp', 'boat', 'cart', 'villager_body'];

export function gallery(container: HTMLElement, opts: { snow?: number; glow?: number } = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight);
  container.appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe8f3');
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x8c9a6a, 1.3));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
  sun.position.set(-6, 10, 8);
  scene.add(sun);
  const mat = worldMaterial();
  ENV.uSnow.value = opts.snow ?? 0;
  ENV.uGlow.value = opts.glow ?? 0;
  const cols = 6;
  NAMES.filter(hasModel).forEach((n, i) => {
    const m = getModel(n);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(m.body, mat), new THREE.Mesh(m.line, outlineMat(0.022)));
    for (const a of m.anims) {
      const o = new THREE.Group();
      o.add(new THREE.Mesh(a.geo.body, mat), new THREE.Mesh(a.geo.line, outlineMat(0.018)));
      o.position.set(...a.at);
      g.add(o);
    }
    if (n === 'villager_body') {
      ['villager_head', 'villager_head_straw', 'villager_head_cap', 'villager_head_bun'].forEach((h, k) => {
        const hm = getModel(h);
        const p = new THREE.Group();
        p.add(new THREE.Mesh(getModel('villager_body').body, mat), new THREE.Mesh(hm.body, mat), new THREE.Mesh(hm.line, outlineMat(0.012)));
        p.position.set(k * 0.45 - 0.7, 0, 0.6);
        g.add(p);
      });
    }
    g.position.set((i % cols) * 3.4 - 8.5, 0, Math.floor(i / cols) * 3.6 - 5);
    scene.add(g);
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#9fd27c' }));
  scene.add(ground);
  const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
  cam.position.set(2, 17, 19);
  cam.lookAt(0, 0, 0.5);
  const loop = () => { requestAnimationFrame(loop); r.render(scene, cam); };
  loop();
}
