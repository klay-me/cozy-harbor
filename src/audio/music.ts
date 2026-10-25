// Sample-based background music. Instrument samples are FluidR3_GM (CC BY 3.0).
// Songs are written as scale-degree melodies over Roman-numeral chords; the engine adds
// accompaniment (arpeggios or off-beat strums), bass, pads, sparkles and light percussion.

export type Inst = 'acoustic_guitar_nylon' | 'marimba' | 'glockenspiel' | 'flute' | 'pizzicato_strings' | 'acoustic_bass'
  | 'celesta' | 'kalimba' | 'ocarina' | 'xylophone' | 'music_box' | 'accordion' | 'woodblock' | 'tubular_bells';

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const toMidi = (n: string) => { const m = n.match(/^([A-G]b?)(-?\d)$/)!; return NAMES.indexOf(m[1]) + (Number(m[2]) + 1) * 12; };

export class Sampler {
  private banks = new Map<Inst, { midi: number; buf: AudioBuffer }[]>();
  private loading = new Map<Inst, Promise<void>>();
  constructor(private ctx: AudioContext, private base: string) {}
  load(inst: Inst) {
    if (!this.loading.has(inst)) {
      this.loading.set(inst, (async () => {
        const res = await fetch(`${this.base}${inst}.json`);
        const data: Record<string, string> = await res.json();
        const list: { midi: number; buf: AudioBuffer }[] = [];
        await Promise.all(Object.entries(data).map(async ([n, b64]) => {
          const bin = atob(b64), arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const buf = await this.ctx.decodeAudioData(arr.buffer);
          list.push({ midi: toMidi(n), buf });
        }));
        list.sort((a, b) => a.midi - b.midi);
        this.banks.set(inst, list);
      })().catch(() => { /* missing instrument: stay silent */ }));
    }
    return this.loading.get(inst)!;
  }
  ready(inst: Inst) { return this.banks.has(inst); }
  play(inst: Inst, midi: number, t: number, vol: number, dest: AudioNode, dur = 0, pan = 0) {
    const bank = this.banks.get(inst);
    if (!bank || !bank.length) return;
    let best = bank[0];
    for (const s of bank) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    const src = this.ctx.createBufferSource();
    src.buffer = best.buf;
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    const len = best.buf.duration / src.playbackRate.value;
    const end = dur > 0 ? Math.min(t + dur, t + len) : t + len;
    g.gain.setValueAtTime(vol, Math.max(t + 0.01, end - 0.12));
    g.gain.linearRampToValueAtTime(0.0001, end + 0.1);
    let node: AudioNode = g;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(dest);
    src.start(t);
    src.stop(end + 0.15);
  }
}

// ---------- songs ----------
interface Section { chords: string[]; mel: string }
export interface Song {
  name: string; bpm: number; key: number; form: number[]; sections: Section[];
  lead: Inst; leadOct: number; leadVol: number;
  comp: Inst; style: 'arp' | 'strum' | 'broken';
  bass: Inst; pad?: Inst; sparkle?: Inst; counter?: Inst;
  perc: 'shaker' | 'market' | 'soft' | 'none';
}

export const SONGS: Record<string, Song> = {
  spring: {
    name: '晨光小镇', bpm: 112, key: 60, form: [0, 0, 1, 0], lead: 'flute', leadOct: 0, leadVol: 0.42,
    comp: 'acoustic_guitar_nylon', style: 'arp', bass: 'pizzicato_strings', sparkle: 'glockenspiel', perc: 'shaker',
    sections: [
      { chords: ['I', 'V', 'vi', 'IV'], mel: "5:4 3:2 5:2 1':4 7:2 6:2 | 5:6 4:2 3:2 2:2 3:4 | 6:4 1':2 6:2 5:4 3:4 | 4:2 5:2 6:2 4:2 3:4 2:4" },
      { chords: ['IV', 'V', 'iii', 'vi'], mel: "6:2 6:2 5:2 6:2 1':4 6:4 | 5:2 5:2 4:2 5:2 7:4 5:4 | 3:2 5:2 7:2 5:2 3':4 2':4 | 1':6 7:2 6:8" },
    ],
  },
  summer: {
    name: '夏日集市', bpm: 120, key: 65, form: [0, 1, 0, 1], lead: 'marimba', leadOct: 0, leadVol: 0.5,
    comp: 'acoustic_guitar_nylon', style: 'strum', bass: 'acoustic_bass', sparkle: 'xylophone', perc: 'market',
    sections: [
      { chords: ['I', 'vi', 'IV', 'V'], mel: "1:2 3:2 5:2 3:2 6:4 5:4 | 6:2 1':2 6:2 5:2 3:4 -:4 | 4:2 6:2 1':2 6:2 5:2 4:2 3:4 | 5:4 4:2 3:2 2:8" },
      { chords: ['IV', 'V', 'iii', 'vi'], mel: "1':4 1':2 6:2 4:4 6:4 | 7:4 7:2 5:2 2:4 5:4 | 3':4 2':2 1':2 7:4 5:4 | 6:6 5:2 6:8" },
    ],
  },
  autumn: {
    name: '秋收', bpm: 104, key: 67, form: [0, 0, 1, 0], lead: 'ocarina', leadOct: -1, leadVol: 0.4,
    comp: 'acoustic_guitar_nylon', style: 'broken', bass: 'pizzicato_strings', pad: 'accordion', sparkle: 'glockenspiel', perc: 'soft',
    sections: [
      { chords: ['I', 'iii', 'IV', 'V'], mel: "3:4 5:4 1':6 7:2 | 7:4 5:4 3:8 | 4:2 6:2 1':4 6:2 5:2 4:4 | 5:12 -:4" },
      { chords: ['vi', 'IV', 'I', 'V'], mel: "6:4 1':4 3':6 2':2 | 1':4 6:4 4:8 | 5:2 6:2 5:2 3:2 1:4 3:4 | 2:12 -:4" },
    ],
  },
  winter: {
    name: '雪落港湾', bpm: 92, key: 62, form: [0, 1, 0, 1], lead: 'music_box', leadOct: 0, leadVol: 0.4,
    comp: 'celesta', style: 'arp', bass: 'pizzicato_strings', pad: 'accordion', counter: 'flute', perc: 'none',
    sections: [
      { chords: ['I', 'vi', 'ii', 'V'], mel: "5:6 6:2 5:4 3:4 | 1':6 7:2 6:8 | 4:4 6:4 2':6 1':2 | 7:4 6:4 5:8" },
      { chords: ['IV', 'I', 'ii', 'V'], mel: "6:4 4:4 1':8 | 5:4 3:4 1':8 | 2':4 1':4 6:4 4:4 | 5:12 -:4" },
    ],
  },
  night: {
    name: '晚安', bpm: 76, key: 65, form: [0, 1], lead: 'celesta', leadOct: 0, leadVol: 0.36,
    comp: 'kalimba', style: 'arp', bass: 'acoustic_bass', perc: 'none',
    sections: [
      { chords: ['I', 'iii', 'IV', 'I'], mel: "3:8 5:8 | 7:8 5:8 | 6:4 4:4 1':8 | 5:16" },
      { chords: ['vi', 'IV', 'ii', 'V'], mel: "1':8 6:8 | 4:8 6:8 | 2':4 1':4 6:8 | 7:16" },
    ],
  },
  rain: {
    name: '雨天', bpm: 88, key: 60, form: [0, 1], lead: 'kalimba', leadOct: 0, leadVol: 0.42,
    comp: 'marimba', style: 'broken', bass: 'pizzicato_strings', perc: 'none',
    sections: [
      { chords: ['vi', 'IV', 'I', 'V'], mel: "6:4 1':4 3':8 | 1':4 6:4 4:8 | 5:4 3:4 1:8 | 2:8 5:8" },
      { chords: ['vi', 'iii', 'IV', 'V'], mel: "3':6 2':2 1':8 | 7:6 6:2 5:8 | 6:4 5:4 4:4 3:4 | 2:16" },
    ],
  },
};

const SCALE = [0, 2, 4, 5, 7, 9, 11];
const ROMAN: Record<string, number> = { I: 1, ii: 2, iii: 3, IV: 4, V: 5, vi: 6 };
const degMidi = (key: number, deg: number, oct = 0) => key + 12 * (oct + Math.floor((deg - 1) / 7)) + SCALE[(deg - 1) % 7];
function chordTones(key: number, roman: string) {
  const d = ROMAN[roman];
  return [d, d + 2, d + 4].map(x => degMidi(key, x));
}
interface Note { step: number; midi: number; dur: number }
function parseMelody(key: number, mel: string, oct: number): Note[][] {
  return mel.split('|').map(bar => {
    const notes: Note[] = [];
    let step = 0;
    for (const tok of bar.trim().split(/\s+/)) {
      const [d, len] = tok.split(':');
      const dur = Number(len);
      if (d !== '-') {
        const up = (d.match(/'/g) || []).length, down = (d.match(/,/g) || []).length;
        notes.push({ step, midi: degMidi(key, Number(d.replace(/[',]/g, '')), oct + up - down), dur });
      }
      step += dur;
    }
    return notes;
  });
}

export class Music {
  private song: Song | null = null;
  private bars: { chords: string; notes: Note[] }[] = [];
  private bar = 0;
  private step = 0;
  private next = 0;
  private gain: GainNode;
  private pending: string | null = null;
  constructor(private ctx: AudioContext, private s: Sampler, private out: AudioNode, private noise: (t: number, vol: number, hp: number, dec: number) => void) {
    this.gain = ctx.createGain();
    this.gain.connect(out);
  }
  current() { return this.song?.name ?? ''; }
  /** ask for a song; it starts at the next bar line after a short fade */
  want(id: string) {
    const song = SONGS[id];
    if (!song || this.song === song || this.pending === id) return;
    this.pending = id;
    const insts: Inst[] = [song.lead, song.comp, song.bass, ...(song.pad ? [song.pad] : []), ...(song.sparkle ? [song.sparkle] : []), ...(song.counter ? [song.counter] : [])];
    if (song.perc === 'market') insts.push('woodblock');
    Promise.all(insts.map(i => this.s.load(i))).then(() => {
      if (this.pending !== id) return;
      const t = this.ctx.currentTime;
      const swap = () => {
        this.song = song;
        this.pending = null;
        this.bars = [];
        for (const si of song.form) {
          const sec = song.sections[si];
          const mel = parseMelody(song.key, sec.mel, song.leadOct);
          sec.chords.forEach((c, i) => this.bars.push({ chords: c, notes: mel[i] ?? [] }));
        }
        this.bar = 0; this.step = 0;
        this.next = this.ctx.currentTime + 0.1;
        this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);
      };
      if (!this.song) { swap(); return; }
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(0.0001, t + 2.2);
      setTimeout(swap, 2300);
    });
  }

  schedule() {
    const song = this.song;
    if (!song) return;
    const ctx = this.ctx;
    const st = 60 / song.bpm / 4;
    if (this.next < ctx.currentTime - 0.3) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.3) {
      this.playStep(song, this.bars[this.bar], this.step, this.next, st);
      this.next += st * (this.step % 2 === 0 ? 1.08 : 0.92) ; // gentle swing
      this.step++;
      if (this.step === 16) { this.step = 0; this.bar = (this.bar + 1) % this.bars.length; }
    }
  }

  private playStep(song: Song, bar: { chords: string; notes: Note[] }, s: number, t: number, st: number) {
    const out = this.gain, P = this.s;
    const tones = chordTones(song.key, bar.chords);
    const root = tones[0];
    // melody
    for (const n of bar.notes) if (n.step === s) P.play(song.lead, n.midi, t, song.leadVol * (0.9 + Math.random() * 0.15), out, n.dur * st * 1.1, 0.1);
    // counter melody: chord tone an octave up on the off-bars
    if (song.counter && this.bar % 2 === 1 && (s === 4 || s === 12)) P.play(song.counter, tones[s === 4 ? 2 : 1] + 12, t, 0.16, out, st * 6, -0.2);
    // accompaniment
    if (song.style === 'arp') {
      if (s % 2 === 0) {
        const pat = [root - 12, tones[2] - 12, tones[0], tones[1], tones[2], tones[1], tones[0], tones[2] - 12];
        P.play(song.comp, pat[(s / 2) % 8], t, 0.2, out, st * 3, -0.25);
      }
    } else if (song.style === 'strum') {
      if (s % 4 === 2) tones.forEach((m, i) => P.play(song.comp, m - 12, t + i * 0.012, 0.13, out, st * 1.6, -0.3));
    } else {
      const seq = [root - 12, tones[2] - 12, tones[1], tones[2] - 12];
      if (s % 4 === 0 || s % 4 === 3) P.play(song.comp, seq[(s >> 2) % 4], t, 0.18, out, st * 3, -0.25);
    }
    // bass
    if (s === 0 || s === 8) P.play(song.bass, root - (song.bass === 'acoustic_bass' ? 24 : 24), t, song.bass === 'acoustic_bass' ? 0.5 : 0.35, out, st * 6, 0);
    if (s === 14 && song.perc !== 'none') P.play(song.bass, tones[2] - 24, t, 0.25, out, st * 2, 0);
    // pad holds the chord through the bar
    if (song.pad && s === 0) tones.forEach(m => P.play(song.pad!, m - 12, t, 0.06, out, st * 15, 0.15));
    // sparkle
    if (song.sparkle && s === 0 && this.bar % 2 === 0) tones.forEach((m, i) => P.play(song.sparkle!, m + 24, t + i * st, 0.09, out, st * 2, 0.3));
    // percussion
    if (song.perc === 'shaker' || song.perc === 'market') {
      if (s % 2 === 1) this.noise(t, s % 4 === 3 ? 0.03 : 0.018, 7000, 0.05);
    }
    if (song.perc === 'market' && (s === 6 || s === 14 || s === 11)) P.play('woodblock', s === 11 ? 84 : 78, t, 0.12, out, 0.2, 0.2);
    if (song.perc === 'soft' && s % 4 === 2) this.noise(t, 0.015, 6000, 0.08);
  }
}
