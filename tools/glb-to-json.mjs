// Converts public/models/town.glb into a self-contained glTF JSON (buffers as data URIs).
import fs from 'fs';
const src = process.argv[2], dst = process.argv[3];
const buf = fs.readFileSync(src);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;
const bin = buf.slice(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
json.buffers = [{ byteLength: bin.length, uri: 'data:application/octet-stream;base64,' + bin.toString('base64') }];
fs.writeFileSync(dst, JSON.stringify(json));
console.log('wrote', dst, Math.round(fs.statSync(dst).size / 1024), 'KB');
