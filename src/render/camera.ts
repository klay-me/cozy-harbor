// Strategy-game camera: a tilted view of a ground target with smooth pan/zoom.
// Rotation has two modes:
//   'look'  - the camera turns on the spot, like turning your head (default)
//   'orbit' - the camera circles around the point in the middle of the screen
import * as THREE from 'three';

export type RotateMode = 'look' | 'orbit';

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  target = new THREE.Vector3();
  yaw = 0.6;
  dist = 26;
  mode: RotateMode = 'orbit';
  private goal = { yaw: 0.6, dist: 26, target: new THREE.Vector3() };
  bounds = 30;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 600);
  }

  private tilt(dist: number) { return 0.78 + (dist - 8) / 52 * 0.25; } // steeper when zoomed out
  private horiz(dist: number) { return Math.cos(this.tilt(dist)) * dist; }
  private clamp(v: THREE.Vector3) {
    const b = this.bounds;
    v.x = Math.max(-b, Math.min(b, v.x));
    v.z = Math.max(-b, Math.min(b, v.z));
  }

  /** Pan by a delta in world units: dx to the right of the view, dz forward. */
  pan(dx: number, dz: number) {
    const s = Math.sin(this.goal.yaw), c = Math.cos(this.goal.yaw);
    this.goal.target.x += dx * c - dz * s;
    this.goal.target.z += -dx * s - dz * c;
    this.clamp(this.goal.target);
  }
  /** Move the view immediately (used by drag panning so the map sticks to the cursor). */
  shift(dx: number, dz: number) {
    this.goal.target.x += dx; this.goal.target.z += dz;
    this.clamp(this.goal.target);
    this.target.x = this.goal.target.x; this.target.z = this.goal.target.z;
    this.update(0);
    this.camera.updateMatrixWorld();
  }
  /** Drag the ground with the pointer: the point under the cursor follows it. */
  panPixels(px: number, py: number) {
    const k = this.dist * 0.0021;
    this.pan(-px * k, py * k);
  }
  /** Positive turns the view to the left. */
  rotate(d: number) {
    if (this.mode === 'orbit') { this.goal.yaw += d; return; }
    // keep the camera where it is and swing the look direction around it
    const r = this.horiz(this.goal.dist);
    const px = this.goal.target.x + Math.sin(this.goal.yaw) * r;
    const pz = this.goal.target.z + Math.cos(this.goal.yaw) * r;
    this.goal.yaw += d;
    this.goal.target.set(px - Math.sin(this.goal.yaw) * r, 0, pz - Math.cos(this.goal.yaw) * r);
    this.clamp(this.goal.target);
    // apply at once so the camera does not drift along an arc while easing
    this.yaw = this.goal.yaw;
    this.target.copy(this.goal.target);
    this.dist = this.goal.dist;
  }
  zoom(f: number) { this.goal.dist = Math.max(8, Math.min(60, this.goal.dist * f)); }
  jumpTo(x: number, z: number) { this.goal.target.set(x, 0, z); }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 12);
    this.target.lerp(this.goal.target, k);
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.dist += (this.goal.dist - this.dist) * k;
    const t = this.tilt(this.dist);
    const h = Math.sin(t) * this.dist, r = Math.cos(t) * this.dist;
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * r, h, this.target.z + Math.cos(this.yaw) * r);
    this.camera.lookAt(this.target);
  }
}
