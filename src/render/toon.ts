// Toon shading building blocks: 3-step ramp, outline shell, and a merge helper
// that bakes colour + outline directions into one geometry per model.
import * as THREE from 'three';

export const OUTLINE_COLOR = '#3b3346';

export const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export function toon(color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
}

const outlineCache = new Map<string, THREE.ShaderMaterial>();
export function outlineMat(width = 0.03, color = OUTLINE_COLOR) {
  const key = width + color;
  let m = outlineCache.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uC: { value: new THREE.Color(color) }, uW: { value: width } }]),
    vertexShader: /* glsl */`
uniform float uW;
#include <common>
#include <fog_pars_vertex>
void main(){
  vec4 p = vec4(position + normal * uW, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 mvPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
uniform vec3 uC;
#include <common>
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(uC, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    side: THREE.BackSide,
    fog: true,
  });
  outlineCache.set(key, m);
  return m;
}

export type OutlineType = 'box' | 'cyl' | 'sphere';
export interface Part { p: Float32Array; n: Float32Array; o: Float32Array; c: Float32Array }
export interface PartOpts {
  col: THREE.ColorRepresentation;
  at?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  type?: OutlineType;
  flat?: boolean;
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();

/** Bake a primitive into a coloured part with a closed outline-extrusion direction. */
export function P(geom: THREE.BufferGeometry, o: PartOpts): Part {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  if (o.flat) g.computeVertexNormals();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const on = new Float32Array(n * 3);
  const type = o.type ?? 'box';
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (type === 'box') _v.set(Math.sign(x), Math.sign(y), Math.sign(z));
    else if (type === 'cyl') { const l = Math.hypot(x, z); _v.set(l > 1e-5 ? x / l : 0, Math.sign(y), l > 1e-5 ? z / l : 0); }
    else _v.set(x, y, z).normalize();
    _v.toArray(on, i * 3);
  }
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...(o.at ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))),
    new THREE.Vector3(...(o.scale ?? [1, 1, 1])),
  );
  const r3 = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))));
  g.applyMatrix4(m);
  for (let i = 0; i < n; i++) { _v.fromArray(on, i * 3).applyMatrix3(r3); _v.toArray(on, i * 3); }
  _c.set(o.col);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
  return {
    p: (g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array,
    n: (g.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array,
    o: on, c,
  };
}

export function merge(parts: Part[]) {
  const cat = (k: keyof Part) => {
    const len = parts.reduce((s, p) => s + p[k].length, 0);
    const a = new Float32Array(len);
    let off = 0;
    for (const p of parts) { a.set(p[k], off); off += p[k].length; }
    return a;
  };
  const pos = new THREE.BufferAttribute(cat('p'), 3);
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', pos);
  body.setAttribute('normal', new THREE.BufferAttribute(cat('n'), 3));
  body.setAttribute('color', new THREE.BufferAttribute(cat('c'), 3));
  body.computeBoundingSphere();
  const line = new THREE.BufferGeometry();
  line.setAttribute('position', pos);
  line.setAttribute('normal', new THREE.BufferAttribute(cat('o'), 3));
  line.computeBoundingSphere();
  return { body, line };
}

// primitive shortcuts
export const Box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const Cyl = (a: number, b: number, h: number, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
export const Ball = (r: number, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
export function Gable(w: number, h: number, L: number) {
  const s = new THREE.Shape();
  s.moveTo(-w, -h / 2); s.lineTo(w, -h / 2); s.lineTo(0, h / 2); s.lineTo(-w, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
  g.translate(0, 0, -L / 2);
  return g;
}
