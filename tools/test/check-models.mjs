// node tools/test/check-models.mjs — no browser or Blender required.
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { measureNode, footprintWarnings } from '../check-models.mjs';

const doc = new Document(), buffer = doc.createBuffer();
const position = doc.createAccessor().setType('VEC3').setNormalized(true).setBuffer(buffer)
  .setArray(new Int16Array([0, 0, 0, 16384, 32767, 32767, -32767, -32767, -32767]));
const indices = doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(new Uint16Array([0, 1]));
const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices));
const root = doc.createNode('model').setTranslation([10, 20, 30]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
const child = doc.createNode('p_doorframe').setTranslation([1, 2, 3]).setScale([2, 0.5, 3]).setMesh(mesh);
root.addChild(child);
doc.createScene().addChild(root);
const bounds = measureNode(root), door = measureNode(child, root);
const close = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${v} != ${expected[i]}`));
close(bounds.min, [1, 2, 3]);
close(bounds.max, [1 + 2 * 16384 / 32767, 2.5, 6]);
close(door.size, bounds.size);
assert.equal(door.size[1], 0.5, 'Inherited scale must be included in door height');
assert.equal(measureNode(doc.createNode('empty')), null);
const make = (min, max) => ({ min, max, size: max.map((v, i) => v - min[i]) });
assert.equal(footprintWarnings(make([-1, 0, -1], [1.05, 1, 1]), [2, 2]).length, 0, '0.05 is allowed');
assert.equal(footprintWarnings(make([-0.85, 0, -0.85], [0.85, 1, 0.85]), [2, 2]).length, 0, 'Exactly 15% smaller is allowed');
assert.ok(footprintWarnings(make([-1, 0, -1], [1.051, 1, 1]), [2, 2]).some(s => s.includes('X超界')));
assert.ok(footprintWarnings(make([-0.84, 0, -1], [0.84, 1, 1]), [2, 2]).some(s => s.includes('X偏小')));
assert.ok(footprintWarnings(make([0, 0, -1], [2, 1, 1]), [2, 2]).some(s => s.includes('X超界')), 'An off-center mesh must not pass merely because its width fits');
console.log('PASS: quantized normalized positions, indexed vertices, child transforms, root removal, door scale, exact warning thresholds and off-center bounds');
