// Lightning for thunderstorms: a jagged forked bolt from the cloud base to the ground, drawn as
// camera-facing ribbons (a bright core in a blue glow), a re-strike flicker, a burst of light on
// the ground where it hits, and flashes inside the storm clouds between strikes.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();

/** jagged path from a to b: midpoint displacement, more sideways jitter on long spans */
function jag(a: THREE.Vector3, b: THREE.Vector3, depth: number, rough: number, out: THREE.Vector3[]) {
  if (depth === 0) { out.push(b.clone()); return; }
  const m = a.clone().lerp(b, 0.5);
  const len = a.distanceTo(b);
  m.x += (Math.random() - 0.5) * len * rough;
  m.z += (Math.random() - 0.5) * len * rough;
  m.y += (Math.random() - 0.5) * len * rough * 0.3;
  jag(a, m, depth - 1, rough, out);
  jag(m, b, depth - 1, rough, out);
}

/** one ribbon per path, facing the camera, tapering from w0 to w1 */
function ribbon(path: THREE.Vector3[], w0: number, w1: number, cam: THREE.Vector3, pos: number[]) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const wa = THREE.MathUtils.lerp(w0, w1, i / (path.length - 1)) / 2;
    const wb = THREE.MathUtils.lerp(w0, w1, (i + 1) / (path.length - 1)) / 2;
    _v.subVectors(b, a); _c.subVectors(cam, a);
    _s.crossVectors(_v, _c).normalize();
    const a0 = a.clone().addScaledVector(_s, -wa), a1 = a.clone().addScaledVector(_s, wa);
    const b0 = b.clone().addScaledVector(_s, -wb), b1 = b.clone().addScaledVector(_s, wb);
    pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z);
  }
}

export class Lightning {
  group = new THREE.Group();
  private core: THREE.Mesh;
  private glow: THREE.Mesh;
  private light = new THREE.PointLight('#cfe0ff', 0, 40, 1.2);
  private life = 0;
  private restrike = 0;
  /** 0..1, how bright the current strike is right now (for the screen flash and sky) */
  level = 0;
  /** where the last bolt hit */
  at = new THREE.Vector3();

  constructor() {
    const mk = (col: THREE.Color, op: number) => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    }));
    // colours above 1 so the glow pass blooms them
    this.core = mk(new THREE.Color(3.2, 3.3, 4), 1);
    this.glow = mk(new THREE.Color(0.6, 0.8, 2.2), 0.45);
    this.core.frustumCulled = this.glow.frustumCulled = false;
    this.core.visible = this.glow.visible = false;
    this.group.add(this.glow, this.core, this.light);
  }

  /** a new bolt somewhere around the view; returns its distance from the view centre */
  strike(target: THREE.Vector3, cam: THREE.Vector3, ground: (x: number, z: number) => number) {
    // mostly beyond the middle of the screen, so the whole bolt is in view
    const away = Math.atan2(target.z - cam.z, target.x - cam.x);
    const a = away + (Math.random() - 0.5) * 2.2, r = 3 + Math.random() * 18;
    const x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r;
    const hit = new THREE.Vector3(x, Math.max(ground(x, z), -0.28), z);
    const top = new THREE.Vector3(x + (Math.random() - 0.5) * 6, 13 + Math.random() * 3, z + (Math.random() - 0.5) * 6);
    const main = [top.clone()];
    jag(top, hit, 5, 0.45, main);
    const core: number[] = [], glow: number[] = [];
    ribbon(main, 0.28, 0.12, cam, core);
    ribbon(main, 1.1, 0.5, cam, glow);
    // forks: shorter jagged branches peeling off downwards
    const forks = 2 + Math.floor(Math.random() * 4);
    for (let f = 0; f < forks; f++) {
      const i = 2 + Math.floor(Math.random() * (main.length * 0.6));
      const from = main[i];
      const len = 3 + Math.random() * 6;
      const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * len, -len * (0.6 + Math.random() * 0.5), (Math.random() - 0.5) * len));
      const br = [from.clone()];
      jag(from, to, 3, 0.5, br);
      ribbon(br, 0.1, 0.02, cam, core);
      ribbon(br, 0.45, 0.1, cam, glow);
    }
    for (const [m, p] of [[this.core, core], [this.glow, glow]] as const) {
      m.geometry.dispose();
      m.geometry = new THREE.BufferGeometry();
      m.geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    }
    this.light.position.copy(hit).add(new THREE.Vector3(0, 2.5, 0));
    this.at.copy(hit);
    this.life = 0.32;
    this.restrike = Math.random() < 0.6 ? 0.09 + Math.random() * 0.08 : -1;
    return r;
  }

  update(dt: number) {
    this.life -= dt;
    if (this.restrike > 0) {
      this.restrike -= dt;
      // the channel goes dark for a moment and the stroke comes back
      if (this.restrike <= 0) this.life = Math.max(this.life, 0.22);
    }
    const on = this.life > 0 && !(this.restrike > 0 && this.restrike < 0.05);
    const k = on ? Math.min(1, this.life / 0.12) : 0;
    this.level += (k - this.level) * Math.min(1, dt * 40);
    this.core.visible = this.glow.visible = this.level > 0.03;
    (this.core.material as THREE.MeshBasicMaterial).opacity = this.level;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = this.level * 0.45;
    this.light.intensity = this.level * 14;
  }
}
