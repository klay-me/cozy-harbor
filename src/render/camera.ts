// Strategy-game camera: orbit around a ground target at a fixed tilt, smooth pan/zoom/rotate.
import * as THREE from 'three';

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  target = new THREE.Vector3();
  yaw = 0.6;
  dist = 26;
  private goal = { yaw: 0.6, dist: 26, target: new THREE.Vector3() };
  bounds = 30;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 600);
  }

  /** Pan by a screen-space delta measured in world units (right, forward). */
  pan(dx: number, dz: number) {
    const s = Math.sin(this.goal.yaw), c = Math.cos(this.goal.yaw);
    this.goal.target.x += dx * c - dz * s;
    this.goal.target.z += -dx * s - dz * c;
    const b = this.bounds;
    this.goal.target.x = Math.max(-b, Math.min(b, this.goal.target.x));
    this.goal.target.z = Math.max(-b, Math.min(b, this.goal.target.z));
  }
  panPixels(px: number, py: number) {
    const k = this.dist * 0.0021;
    this.pan(-px * k, py * k);
  }
  rotate(d: number) { this.goal.yaw += d; }
  zoom(f: number) { this.goal.dist = Math.max(8, Math.min(60, this.goal.dist * f)); }
  jumpTo(x: number, z: number) { this.goal.target.set(x, 0, z); }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 12);
    this.target.lerp(this.goal.target, k);
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.dist += (this.goal.dist - this.dist) * k;
    const tilt = 0.78 + (this.dist - 8) / 52 * 0.25; // look steeper when zoomed out
    const h = Math.sin(tilt) * this.dist, r = Math.cos(tilt) * this.dist;
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * r, h, this.target.z + Math.cos(this.yaw) * r);
    this.camera.lookAt(this.target);
  }
}
