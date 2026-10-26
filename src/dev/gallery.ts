// Developer view: open the game with #gallery to see every model side by side.
import * as THREE from 'three';
import { getModel, hasModel } from '../render/assets';
import { worldMaterial, ENV } from '../render/shared';
import { outlineMat } from '../render/toon';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animatePart, type AnimatedPart } from '../render/animation';
import { footprintGrid, linePlacements, UPGRADE_LINES, type GalleryPlacement } from './gallery-lines';

const NAMES = ['house_peasant_0', 'house_peasant_1', 'house_worker_0', 'house_worker_1', 'depot', 'warehouse',
  'lumberjack', 'sawmill', 'fishery', 'farm', 'mill', 'bakery', 'market', 'tavern',
  'tree_round', 'tree_pine', 'bush', 'rock', 'lamp', 'boat', 'cart', 'villager_body'];

const NAMES_ANIM = ['bigwarehouse', 'depot', 'lumberjack', 'smithy', 'mine', 'church', 'firestation', 'townhall', 'school', 'police', 'tavern', 'weaver', 'guild', 'lab', 'heatplant', 'warehouse'];
const NAMES_BIG = ['sawmill', 'fishery', 'warehouse', 'tavern', 'brickworks', 'weaver', 'firestation', 'guild', 'cannery', 'purifier', 'church', 'sheepfarm', 'townhall', 'hospital', 'plant_modern', 'market', 'farm', 'factory'];
const NAMES_M1 = ['house_technician_0', 'house_technician_1', 'house_citizen_0', 'house_citizen_2', 'study', 'church',
  'sheepfarm', 'woodshed', 'claypit', 'brickworks', 'weaver', 'tailor', 'mine', 'smithy', 'park', 'guild', 'ore_iron', 'ore_coal',
  'factory', 'cannery', 'brewery', 'powerplant', 'heatplant', 'school', 'clinic', 'townhall', 'university',
  'factory_small', 'plant_modern', 'windturbine', 'solar', 'hydro', 'purifier', 'recycler', 'hospital', 'theatre', 'lab', 'garden', 'herbalist', 'firestation', 'police', 'bridge'];
/** upgrade lines: #gallery-m2 */
const NAMES_M2 = ['fishery', 'fishpier', 'fishport', 'garden', 'vegfield', 'compost', 'greenhouse', 'hydroponic', 'farm', 'mechfarm'];

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
  const one = /one=([a-z_0-9]+)/.exec(location.hash)?.[1];
  const list = one ? [one] : location.hash.includes('anim') ? NAMES_ANIM : location.hash.includes('big') ? NAMES_BIG : location.hash.includes('m1') ? NAMES_M1 : location.hash.includes('m2') ? NAMES_M2 : NAMES;
  const cols = location.hash.includes('big') || location.hash.includes('anim') ? 6 : location.hash.includes('m1') ? 8 : location.hash.includes('m2') ? 5 : 6;
  const lines = location.hash.includes('lines') && !one;
  const sp = location.hash.includes('big') || location.hash.includes('anim') ? 4.6 : 3.4;
  const placements: GalleryPlacement[] = lines ? linePlacements() : list.map((name, i) => ({
    name, x: one ? 0 : (i % cols) * sp - (cols - 1) * sp / 2,
    z: one ? 0 : Math.floor(i / cols) * (sp + 0.4) - 5,
  }));
  const parts: { part: AnimatedPart; id: number; depot: boolean }[] = [];
  const contentBounds = new THREE.Box3();
  const labelLayer = document.createElement('div');
  labelLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:5';
  const labels: { el: HTMLElement; at: THREE.Vector3 }[] = [];
  const label = (text: string, at: THREE.Vector3, heading = false) => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;white-space:pre;text-align:center;font:${heading ? '600 13px' : '12px'}/1.4 sans-serif;color:#34495a;background:#fff9edec;padding:3px 7px;border-radius:5px;transform:translate(-50%,0)`;
    labelLayer.appendChild(el);
    labels.push({ el, at });
    contentBounds.expandByPoint(at);
  };
  for (const { name } of placements) if (!hasModel(name)) throw new Error(`Gallery model missing: ${name}`);
  placements.forEach((placement, i) => {
    const n = placement.name;
    const m = getModel(n);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(m.body, mat), new THREE.Mesh(m.line, outlineMat(0.022)));
    for (const a of m.anims) {
      const o = new THREE.Group();
      o.add(new THREE.Mesh(a.geo.body, mat), new THREE.Mesh(a.geo.line, outlineMat(0.018)));
      o.position.set(...a.at);
      o.userData.base = o.position.y;
      // #gallery-anim-pose: show swinging parts at the top of their stroke
      if (location.hash.includes('pose')) {
        if (a.kind === 'swingX') o.rotation.x = a.name === 'axe' ? 1.3 : 0.6;
        if (a.kind === 'swingZ') o.rotation.z = -1.0;
        if (a.kind === 'spinY') o.rotation.y = 1.2;
      }
      g.add(o);
      parts.push({ part: { o, kind: a.kind, name: a.name, t: i * 0.37, amp: 0 }, id: i, depot: n === 'depot' });
    }
    if (n === 'villager_body' && lines) {
      const head = getModel('villager_head');
      g.add(new THREE.Mesh(head.body, mat), new THREE.Mesh(head.line, outlineMat(0.012)));
    } else if (n === 'villager_body') {
      ['villager_head', 'villager_head_straw', 'villager_head_cap', 'villager_head_bun'].forEach((h, k) => {
        const hm = getModel(h);
        const p = new THREE.Group();
        p.add(new THREE.Mesh(getModel('villager_body').body, mat), new THREE.Mesh(hm.body, mat), new THREE.Mesh(hm.line, outlineMat(0.012)));
        p.position.set(k * 0.45 - 0.7, 0, 0.6);
        g.add(p);
      });
    }
    g.position.set(placement.x, 0, placement.z);
    scene.add(g);
    contentBounds.expandByObject(g);
    if (lines) {
      if (placement.size) {
        const grid = footprintGrid(placement.size);
        grid.position.copy(g.position);
        scene.add(grid);
        contentBounds.expandByObject(grid);
      }
      if (placement.caption) label(placement.caption, new THREE.Vector3(placement.x, 0, placement.z + (placement.size?.[1] ?? 1) / 2 + 0.35));
    }
  });
  if (lines) {
    container.appendChild(labelLayer);
    UPGRADE_LINES.forEach((row, i) => label(row.title, new THREE.Vector3(-9.2, 0, (i - 2) * 6 - 2.1), true));
    const hint = document.createElement('div');
    hint.textContent = '升级线尺度对照 · 每格 1 单位 · 左列：农舍 + 居民\n拖动旋转 / 右键平移 / 滚轮缩放 · 空格暂停 · R 重置全景';
    hint.style.cssText = 'position:fixed;top:12px;left:12px;white-space:pre;font:12px/1.6 sans-serif;padding:8px 12px;background:#fff9edee;color:#34495a;border-radius:8px;z-index:6';
    container.appendChild(hint);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#9fd27c' }));
  scene.add(ground);
  const cam = lines ? new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 200)
    : new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
  const rows = Math.ceil(list.length / cols);
  const far = location.hash.includes('big') || location.hash.includes('anim') ? 1.5 : location.hash.includes('m1') ? 1.45 : 1;
  cam.position.set(2 * far, 17 * far, 19 * far + (rows - 4) * 1.5);
  cam.lookAt(0, 0, (rows - 4) * 1.8 + 0.5);
  if (one) { cam.position.set(1.2, 3.2, 5.2); cam.lookAt(0, 1.2, 0); }
  const controls = new OrbitControls(cam, r.domElement);
  controls.target.set(0, one ? 1.2 : 0, one ? 0 : (rows - 4) * 1.8 + 0.5);
  controls.maxPolarAngle = Math.PI * 0.48;
  const fitGallery = () => {
    const center = contentBounds.getCenter(new THREE.Vector3());
    if (cam instanceof THREE.PerspectiveCamera) {
      const direction = cam.position.clone().sub(controls.target).normalize();
      cam.position.copy(center).add(direction);
      cam.lookAt(center);
      cam.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const tanX = tanY * cam.aspect;
      let distance = 1;
      for (const x of [contentBounds.min.x, contentBounds.max.x]) {
        for (const y of [contentBounds.min.y, contentBounds.max.y]) {
          for (const z of [contentBounds.min.z, contentBounds.max.z]) {
            const relative = new THREE.Vector3(x, y, z).sub(center);
            distance = Math.max(distance, relative.dot(direction) + Math.max(Math.abs(relative.dot(right)) / tanX, Math.abs(relative.dot(up)) / tanY));
          }
        }
      }
      cam.position.copy(center).addScaledVector(direction, distance * 1.12);
      controls.target.copy(center);
      controls.update();
      return;
    }
    cam.position.copy(center).add(new THREE.Vector3(1.5, 32, 35));
    cam.lookAt(center);
    cam.updateMatrixWorld();
    const screenBounds = contentBounds.clone().applyMatrix4(cam.matrixWorldInverse);
    const size = screenBounds.getSize(new THREE.Vector3());
    const aspect = innerWidth / innerHeight;
    const halfHeight = Math.max(size.y / 2, size.x / (2 * aspect)) * 1.16;
    Object.assign(cam, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight, zoom: 1 });
    cam.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  };
  fitGallery();
  let paused = false, time = 0;
  addEventListener('keydown', e => {
    if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
    if (e.code === 'KeyR') fitGallery();
  });
  addEventListener('resize', () => {
    r.setSize(innerWidth, innerHeight);
    if (cam instanceof THREE.PerspectiveCamera) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
    fitGallery();
  });
  const clock = new THREE.Clock(), projected = new THREE.Vector3();
  const pose = location.hash.includes('pose');
  container.dataset.galleryModels = placements.map(p => p.name).join(',');
  const loop = () => {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!paused && !pose) {
      time += dt;
      for (const { part, id, depot } of parts) animatePart(part, {
        gdt: dt, wind: 0.8, bellOn: true, fireOn: true, working: true, depot, time, id,
      });
    }
    controls.update();
    r.render(scene, cam);
    for (const { el, at } of labels) {
      projected.copy(at).project(cam);
      el.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`;
      el.hidden = projected.z < -1 || projected.z > 1;
    }
    container.dataset.galleryReady = 'true';
  };
  loop();
}
