// Loads the Blender-made models (public/models/town.glb) and turns each one into
// a single merged geometry with baked colours, plus an outline shell and animated parts.
//
// Vertex attributes produced:
//   color  - material base colour
//   glow   - 1 on windows and lamps (lit at night)
//   leaf   - 1 on foliage (recoloured by season)
//   tint   - 1 on parts tinted per instance (clothes, cargo)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface ModelGeo { body: THREE.BufferGeometry; line: THREE.BufferGeometry }
export interface AnimPart { geo: ModelGeo; at: [number, number, number]; kind: 'spinZ' | 'spinX' | 'bob' }
export interface Model extends ModelGeo { anims: AnimPart[]; height: number }

const models = new Map<string, Model>();

export function getModel(name: string): Model {
  const m = models.get(name);
  if (!m) throw new Error(`missing model ${name}`);
  return m;
}
export function hasModel(name: string) { return models.has(name); }

function prepare(mesh: THREE.Mesh, rel: THREE.Matrix4): THREE.BufferGeometry {
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  g.setAttribute('normal', src.getAttribute('normal').clone());
  if (src.index) g.setIndex(src.index.clone());
  g.applyMatrix4(rel);
  const n = g.getAttribute('position').count;
  const m = mesh.material as THREE.MeshStandardMaterial;
  const name = m.name || '';
  const c = m.color;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  const flag = (p: string) => new THREE.BufferAttribute(new Float32Array(n).fill(name.startsWith(p) ? 1 : 0), 1);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('glow', flag('G_'));
  g.setAttribute('leaf', flag('L_'));
  g.setAttribute('tint', flag('T_'));
  return g;
}

function build(meshes: { mesh: THREE.Mesh; rel: THREE.Matrix4 }[]): ModelGeo {
  const body = mergeGeometries(meshes.map(({ mesh, rel }) => prepare(mesh, rel)), false)!;
  body.computeBoundingSphere();
  // outline shell: weld coincident vertices and use the averaged normals to push the hull out
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', body.getAttribute('position').clone());
  if (body.index) shell.setIndex(body.index.clone());
  const welded = mergeVertices(shell, 1e-4);
  welded.computeVertexNormals();
  welded.computeBoundingSphere();
  return { body, line: welded };
}

/**
 * Reads either a .glb or a glTF JSON whose buffer is embedded as base64. The JSON form is
 * repacked into a .glb in memory, because some hosts forbid fetching data: URLs.
 */
async function fetchGlb(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, 4);
  if (String.fromCharCode(...head) === 'glTF') return buf;
  const json = JSON.parse(new TextDecoder().decode(buf));
  const uri: string = json.buffers?.[0]?.uri ?? '';
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = atob(b64);
  const binBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) binBytes[i] = bin.charCodeAt(i);
  delete json.buffers[0].uri;
  const pad = (n: number) => (4 - (n % 4)) % 4;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jp = pad(jsonBytes.length), bp = pad(binBytes.length);
  const total = 12 + 8 + jsonBytes.length + jp + 8 + binBytes.length + bp;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out), u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length + jp, true); dv.setUint32(16, 0x4e4f534a, true);
  u8.set(jsonBytes, 20); u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jp);
  let o = 20 + jsonBytes.length + jp;
  dv.setUint32(o, binBytes.length + bp, true); dv.setUint32(o + 4, 0x004e4942, true);
  u8.set(binBytes, o + 8);
  jsonBytes = new Uint8Array(0);
  return out;
}

export async function loadModels(url: string) {
  const gltf = await new GLTFLoader().parseAsync(await fetchGlb(url), '');
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  for (const rootObj of scene.children) {
    const inv = new THREE.Matrix4().copy(rootObj.matrixWorld).invert();
    const statics: { mesh: THREE.Mesh; rel: THREE.Matrix4 }[] = [];
    const anims: AnimPart[] = [];
    // animated sub-groups are empties named spinz_*, spinx_*, bob_*
    const animRoots = new Set<THREE.Object3D>();
    rootObj.traverse(o => { if (/^(spinz|spinx|bob)_/.test(o.name)) animRoots.add(o); });
    for (const a of animRoots) {
      const ainv = new THREE.Matrix4().copy(a.matrixWorld).invert();
      const parts: { mesh: THREE.Mesh; rel: THREE.Matrix4 }[] = [];
      a.traverse(o => { if ((o as THREE.Mesh).isMesh) parts.push({ mesh: o as THREE.Mesh, rel: new THREE.Matrix4().multiplyMatrices(ainv, o.matrixWorld) }); });
      const p = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(inv, a.matrixWorld));
      const kind = a.name.startsWith('spinz') ? 'spinZ' : a.name.startsWith('spinx') ? 'spinX' : 'bob';
      if (parts.length) anims.push({ geo: build(parts), at: [p.x, p.y, p.z], kind });
    }
    rootObj.traverse(o => {
      if (!(o as THREE.Mesh).isMesh) return;
      let q: THREE.Object3D | null = o;
      while (q && q !== rootObj) { if (animRoots.has(q)) return; q = q.parent; }
      statics.push({ mesh: o as THREE.Mesh, rel: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
    });
    if (!statics.length) continue;
    const geo = build(statics);
    geo.body.computeBoundingBox();
    models.set(rootObj.name, { ...geo, anims, height: geo.body.boundingBox!.max.y });
  }
  return models;
}
