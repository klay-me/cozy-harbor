// Pulls a sparse set of notes out of the FluidR3_GM soundfonts (CC BY 3.0, via gleitz/midi-js-soundfonts)
// into one small JSON file per instrument: { "C4": "<base64 mp3>", ... }.
// Usage: node tools/extract-samples.mjs <path to FluidR3_GM>
import fs from 'fs';
import path from 'path';

const src = process.argv[2];
const out = new URL('../public/audio/', import.meta.url).pathname;
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const note = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
// instrument -> [lowest midi, highest midi]; we keep every third semitone in range
const PICK = {
  acoustic_guitar_nylon: [45, 81], marimba: [57, 93], glockenspiel: [72, 105], flute: [60, 93],
  pizzicato_strings: [43, 79], acoustic_bass: [28, 55], celesta: [60, 96], kalimba: [60, 93],
  ocarina: [60, 93], xylophone: [69, 102], music_box: [69, 102], accordion: [48, 81],
  woodblock: [72, 84], tubular_bells: [60, 72],
  // added for richer arrangements per era
  orchestral_harp: [48, 90], string_ensemble_1: [43, 79], french_horn: [41, 72], clarinet: [52, 84],
  cello: [36, 64], vibraphone: [60, 93], electric_piano_1: [48, 84], timpani: [38, 50], trumpet: [55, 82],
};
for (const [inst, [lo, hi]] of Object.entries(PICK)) {
  const file = path.join(src, `${inst}-mp3.js`);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const all = {};
  for (const m of text.matchAll(/"([A-G]b?\d)":\s*"data:audio\/mp3;base64,([^"]+)"/g)) all[m[1]] = m[2];
  const keep = {};
  for (let m = lo; m <= hi; m += 3) if (all[note(m)]) keep[note(m)] = all[note(m)];
  fs.writeFileSync(path.join(out, `${inst}.json`), JSON.stringify(keep));
  console.log(inst, Object.keys(keep).length, 'notes', Math.round(JSON.stringify(keep).length / 1024), 'KB');
}
