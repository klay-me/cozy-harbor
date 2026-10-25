// Chimney smoke: soft toon puffs that rise, swell and fade. Industry puffs grey and often,
// cottages puff a light wisp when someone is cooking or heating.
import * as THREE from 'three';
import { ramp } from './toon';
import { ENV } from './shared';

const MAX = 700;

interface Puff { x: number; y: number; z: number; vx: number; vz: number; age: number; life: number; size: number; grey: number }

export class Smoke {
  private mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private M = new THREE.Matrix4();
  private Q = new THREE.Quaternion();
  private S = new THREE.Vector3();
  private V = new THREE.Vector3();
  private C = new THREE.Color();
  wind = new THREE.Vector2(0.25, 0.1);
  private flameMesh: THREE.InstancedMesh;
  private flames: Puff[] = [];

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(0.5, 1);
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, transparent: true, opacity: 0.82, depthWrite: false });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, ENV);
      // at night smoke is lit a little warmer by the town lights
      sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.75, 0.72, 0.8), uGlow * 0.6);');
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 2;
    this.mesh.userData.world = true;
    scene.add(this.mesh);
    // fire: bright tongues that lick upwards and shrink
    const fg = new THREE.ConeGeometry(0.22, 0.6, 6);
    fg.translate(0, 0.3, 0);
    this.flameMesh = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 300);
    this.flameMesh.frustumCulled = false;
    this.flameMesh.count = 0;
    this.flameMesh.userData.world = true;
    scene.add(this.flameMesh);
  }
  flame(x: number, y: number, z: number) {
    if (this.flames.length >= 300) return;
    this.flames.push({ x, y, z, vx: (Math.random() - 0.5) * 0.2, vz: (Math.random() - 0.5) * 0.2, age: 0, life: 0.5 + Math.random() * 0.5, size: 0.7 + Math.random() * 0.8, grey: Math.random() });
  }

  /** grey: 0 white wisp .. 1 dark industrial smoke; size scales the puff */
  emit(x: number, y: number, z: number, grey: number, size = 1) {
    if (this.puffs.length >= MAX) return;
    this.puffs.push({ x, y, z, vx: (Math.random() - 0.5) * 0.1, vz: (Math.random() - 0.5) * 0.1, age: 0, life: 2.6 + Math.random() * 1.6 + grey * 1.5, size: (0.16 + Math.random() * 0.06) * size, grey });
  }

  update(dt: number) {
    let n = 0;
    const { M, Q, S, V, C } = this;
    this.puffs = this.puffs.filter(p => {
      p.age += dt;
      if (p.age >= p.life) return false;
      const k = p.age / p.life;
      p.y += dt * (0.55 - k * 0.25);
      p.x += (p.vx + this.wind.x * k) * dt;
      p.z += (p.vz + this.wind.y * k) * dt;
      const s = p.size * (0.6 + k * 2.2) * (k > 0.75 ? 1 - (k - 0.75) * 3.2 : 1);
      if (s <= 0.01) return false;
      M.compose(V.set(p.x, p.y, p.z), Q.identity(), S.set(s, s * 0.9, s));
      this.mesh.setMatrixAt(n, M);
      const v = 0.97 - p.grey * 0.42 + k * p.grey * 0.15;
      this.mesh.setColorAt(n, C.setRGB(v, v * 0.99, v * 1.01));
      n++;
      return true;
    });
    this.mesh.count = n;
    let nf = 0;
    this.flames = this.flames.filter(p => {
      p.age += dt;
      if (p.age >= p.life) return false;
      const k = p.age / p.life;
      p.y += dt * 1.1; p.x += p.vx * dt; p.z += p.vz * dt;
      const sc = p.size * (1 - k * 0.8);
      M.compose(V.set(p.x, p.y, p.z), Q.identity(), S.set(sc, sc * (1.2 + Math.sin(p.age * 30) * 0.2), sc));
      this.flameMesh.setMatrixAt(nf, M);
      this.flameMesh.setColorAt(nf, C.setRGB(1, 0.45 + 0.4 * (1 - k) * p.grey + 0.2 * (1 - k), 0.15 * (1 - k)));
      nf++;
      return true;
    });
    this.flameMesh.count = nf;
    this.flameMesh.instanceMatrix.needsUpdate = true;
    if (this.flameMesh.instanceColor) this.flameMesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
