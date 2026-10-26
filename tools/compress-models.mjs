// Shrinks public/models/town.glb: drops duplicate data, quantizes vertex positions and normals to
// 14/8-bit integers (KHR_mesh_quantization, no decoder needed). MESHOPT=1 also packs with meshopt,
// which needs the meshopt WebAssembly decoder at load time, so the game does not use it.
// Usage: node tools/compress-models.mjs public/models/town.glb public/models/town.glb
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';

const [src, dst] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
const before = fs.statSync(src).size;
await doc.transform(
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }), // not materials: their names carry the glow / leaf / tint flags
  prune({ keepLeaves: true, keepAttributes: false }),
  quantize({ quantizePosition: 14, quantizeNormal: 8, cleanup: false }),
  ...(process.env.MESHOPT ? [meshopt({ encoder: MeshoptEncoder, level: 'medium' })] : []),
);
await io.write(dst, doc);
console.log(`${src}: ${Math.round(before / 1024)} KB -> ${Math.round(fs.statSync(dst).size / 1024)} KB`);
