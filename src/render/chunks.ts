// Map-wide instanced scenery (trees, bushes, grass, rocks) split into square chunks so that
// three.js can skip whatever is off screen or out of the shadow area, and drop small details
// in the distance. The code that places instances keeps writing into one full-size "source"
// InstancedMesh as before (never added to the scene); rebuild() copies it out into the chunks.
import * as THREE from 'three';

const CHUNK = 16; // tiles per chunk side

interface Part { body: THREE.InstancedMesh; line?: THREE.InstancedMesh; center: THREE.Vector3; radius: number }

export class Chunks {
  group = new THREE.Group();
  private parts = new Map<number, Part>();

  /**
   * @param src      full-size mesh the instances are written into
   * @param line     outline material drawn with the same instances (optional)
   * @param maxDist  how far from the camera these are still drawn
   */
  constructor(readonly src: THREE.InstancedMesh, private half: number, private line?: { geo: THREE.BufferGeometry; mat: THREE.Material }, public maxDist = Infinity) {}

  rebuild() {
    const src = this.src, n = src.count, M = new THREE.Matrix4(), C = new THREE.Color();
    const n2 = Math.ceil((this.half * 2) / CHUNK);
    const buckets = new Map<number, number[]>();
    const arr = src.instanceMatrix.array;
    for (let i = 0; i < n; i++) {
      const x = arr[i * 16 + 12] + this.half, z = arr[i * 16 + 14] + this.half;
      const cx = Math.max(0, Math.min(n2 - 1, Math.floor(x / CHUNK))), cz = Math.max(0, Math.min(n2 - 1, Math.floor(z / CHUNK)));
      const k = cz * n2 + cx;
      let b = buckets.get(k);
      if (!b) buckets.set(k, b = []);
      b.push(i);
    }
    for (const [k, p] of this.parts) if (!buckets.has(k)) { p.body.count = 0; if (p.line) p.line.count = 0; }
    for (const [k, idx] of buckets) {
      let p = this.parts.get(k);
      if (!p || p.body.instanceMatrix.count < idx.length) {
        if (p) { this.group.remove(p.body); p.body.dispose(); if (p.line) { this.group.remove(p.line); } }
        p = this.make(Math.ceil(idx.length * 1.25) + 4);
        this.parts.set(k, p);
      }
      const body = p.body;
      idx.forEach((i, j) => {
        src.getMatrixAt(i, M); body.setMatrixAt(j, M);
        if (src.instanceColor) { src.getColorAt(i, C); body.setColorAt(j, C); }
      });
      body.count = idx.length;
      body.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      body.computeBoundingSphere();
      p.center.copy(body.boundingSphere!.center);
      p.radius = body.boundingSphere!.radius;
      if (p.line) { p.line.count = idx.length; p.line.boundingSphere = body.boundingSphere!.clone(); }
    }
  }

  private make(cap: number): Part {
    const src = this.src;
    const body = new THREE.InstancedMesh(src.geometry, src.material, cap);
    body.castShadow = src.castShadow; body.receiveShadow = src.receiveShadow;
    body.count = 0;
    this.group.add(body);
    let line: THREE.InstancedMesh | undefined;
    if (this.line) {
      line = new THREE.InstancedMesh(this.line.geo, this.line.mat, cap);
      line.instanceMatrix = body.instanceMatrix;
      line.count = 0;
      this.group.add(line);
    }
    return { body, line, center: new THREE.Vector3(), radius: 0 };
  }

  /** hide chunks beyond maxDist (and everything when the source is hidden, e.g. flowers in winter) */
  cull(cam: THREE.Vector3, fogFar: number) {
    const on = this.src.visible, far = Math.min(this.maxDist, fogFar);
    for (const p of this.parts.values()) {
      const vis = on && p.body.count > 0 && cam.distanceTo(p.center) - p.radius < far;
      p.body.visible = vis;
      if (p.line) p.line.visible = vis;
    }
  }
}
