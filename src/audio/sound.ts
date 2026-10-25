// All audio is synthesised with Web Audio: a gentle generative tune, seaside ambience
// that follows the weather, and short sound effects. No audio files are needed.

export interface AudioSettings { music: number; sfx: number; muted: boolean }
const KEY = 'cozy-harbor-audio';
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Chord { bass: number; tones: number[] }
const CH: Record<string, Chord> = {
  C: { bass: 48, tones: [60, 64, 67] },
  G: { bass: 43, tones: [59, 62, 67] },
  Am: { bass: 45, tones: [57, 60, 64] },
  F: { bass: 41, tones: [57, 60, 65] },
  Em: { bass: 40, tones: [59, 64, 67] },
  Dm: { bass: 50, tones: [62, 65, 69] },
};
const PROGRESSIONS = [['C', 'G', 'Am', 'F'], ['F', 'G', 'Em', 'Am'], ['C', 'Am', 'F', 'G'], ['Am', 'F', 'C', 'G'], ['F', 'C', 'Dm', 'G']];
const SCALE = [64, 67, 69, 72, 74, 76, 79, 81, 84]; // C major pentatonic, mid register
const RHYTHMS = [[0, 3, 6, 8, 12], [0, 4, 6, 10, 12, 14], [2, 6, 8, 11], [0, 2, 4, 8, 10], [0, 6, 8, 14], [0, 3, 8, 10, 12]];
const BPM = 80;
const STEP = 60 / BPM / 4;

export class Sound {
  ctx: AudioContext | null = null;
  settings: AudioSettings = { music: 0.6, sfx: 0.7, muted: false };
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private rainGain!: GainNode;
  private windGain!: GainNode;
  private next = 0;
  private step = 0;
  private bar = 0;
  private prog = PROGRESSIONS[0];
  private rhythm = RHYTHMS[0];
  private melodyIdx = 4;
  private w = { rain: 0, storm: 0, sunny: 1 };
  private birdT = 4;
  private last: Record<string, number> = {};

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (s) this.settings = { ...this.settings, ...s };
    } catch { /* storage blocked */ }
  }

  /** Must be called from a user gesture; browsers keep audio silent until then. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 7000;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    // shared noise buffer
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
    this.apply();
    this.next = ctx.currentTime + 0.3;
    setInterval(() => this.schedule(), 50);
  }

  set(p: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
    this.apply();
  }
  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(s.sfx * 0.8, t, 0.1);
  }

  /** Weather mix from the renderer, each 0..1. */
  setWeather(rain: number, storm: number, sunny: number) {
    this.w = { rain, storm, sunny };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.22, t, 0.5);
    this.windGain.gain.setTargetAtTime(0.015 + storm * 0.09 + rain * 0.02, t, 0.5);
    this.musicFilter.frequency.setTargetAtTime(7000 - rain * 3800 - storm * 1800, t, 0.8);
  }

  // ---------- building blocks ----------
  private src(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    s.loopStart = Math.random();
    return s;
  }
  private envGain(t: number, attack: number, peak: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }
  private tone(type: OscillatorType, f: number, t: number, attack: number, peak: number, decay: number, dest: AudioNode, fEnd?: number, cutoff = 0) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + attack + decay);
    const g = this.envGain(t, attack, peak, decay);
    if (cutoff) {
      const lp = this.ctx!.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = cutoff;
      o.connect(lp).connect(g);
    } else o.connect(g);
    g.connect(dest);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }
  private hiss(t: number, attack: number, peak: number, decay: number, type: BiquadFilterType, f: number, dest: AudioNode, fEnd?: number, q = 1) {
    const s = this.src();
    const flt = this.ctx!.createBiquadFilter();
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t);
    if (fEnd) flt.frequency.exponentialRampToValueAtTime(fEnd, t + attack + decay);
    const g = this.envGain(t, attack, peak, decay);
    s.connect(flt).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + attack + decay + 0.05);
  }

  // ---------- music ----------
  private pluck(m: number, t: number, vol: number, dur = 0.9) {
    this.tone('triangle', mtof(m), t, 0.006, vol, dur, this.musicBus, undefined, 2600);
    this.tone('sine', mtof(m + 12), t, 0.004, vol * 0.25, dur * 0.5, this.musicBus);
  }
  private bell(m: number, t: number, vol: number) {
    this.tone('sine', mtof(m), t, 0.003, vol, 1.6, this.musicBus);
    this.tone('sine', mtof(m) * 2.76, t, 0.002, vol * 0.3, 0.5, this.musicBus);
  }
  private pad(ch: Chord, t: number, dur: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.8);
    g.gain.setValueAtTime(0.045, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    lp.connect(g).connect(this.musicBus);
    for (const m of ch.tones) for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m - 12);
      o.detune.value = det;
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.5);
    }
  }
  private bass(m: number, t: number) {
    this.tone('sine', mtof(m - 12), t, 0.01, 0.16, 0.7, this.musicBus);
    this.tone('triangle', mtof(m), t, 0.01, 0.05, 0.4, this.musicBus, undefined, 600);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted && this.settings.music === 0) return;
    if (this.next < ctx.currentTime - 0.3) this.next = ctx.currentTime + 0.05; // tab was in the background
    while (this.next < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) {
        this.bar++;
        if (this.bar % 4 === 0) this.prog = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
        this.rhythm = RHYTHMS[Math.floor(Math.random() * RHYTHMS.length)];
      }
    }
    // birds when the weather is nice
    this.birdT -= 0.05;
    if (this.birdT <= 0) {
      this.birdT = 3 + Math.random() * 7;
      if (this.w.sunny > 0.5) this.bird();
    }
  }
  private playStep(s: number, t: number) {
    const ch = CH[this.prog[this.bar % 4]];
    if (s === 0) { this.pad(ch, t, STEP * 16); this.bass(ch.bass, t); }
    if (s === 8 || (s === 14 && Math.random() < 0.4)) this.bass(ch.bass + (s === 14 ? 7 : 0), t);
    // gentle shaker on the off-beats in fair weather
    if (s % 4 === 2 && this.w.rain < 0.3) this.hiss(t, 0.004, 0.018, 0.06, 'highpass', 7000, this.musicBus);
    if (!this.rhythm.includes(s)) return;
    if (this.w.rain > 0.4 && Math.random() < 0.35) return; // sparser tune in the rain
    // melody: a random walk on the pentatonic scale that lands on chord tones on strong beats
    this.melodyIdx = Math.max(0, Math.min(SCALE.length - 1, this.melodyIdx + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
    let note = SCALE[this.melodyIdx];
    if (s === 0 || s === 8) {
      const tones = ch.tones.map(x => x + 12);
      note = tones.reduce((a, b) => Math.abs(b - note) < Math.abs(a - note) ? b : a);
    }
    const phraseEnd = this.bar % 4 === 3 && s >= 12;
    this.pluck(note, t, 0.13, phraseEnd ? 1.6 : 0.8);
    if (s === 0 && this.bar % 2 === 1) this.bell(ch.tones[2] + 24, t + STEP * 2, 0.035);
  }

  // ---------- ambience ----------
  private startAmbience() {
    const ctx = this.ctx!;
    // waves: low noise breathing slowly
    const waves = this.src(true);
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 420;
    const wg = ctx.createGain(); wg.gain.value = 0.07;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.045;
    lfo.connect(lfoG).connect(wg.gain);
    waves.connect(wl).connect(wg).connect(this.ambBus);
    waves.start(); lfo.start();
    // wind
    const wind = this.src(true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.015;
    wind.connect(bp).connect(this.windGain).connect(this.ambBus);
    wind.start();
    // rain
    const rain = this.src(true);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(hp).connect(lp).connect(this.rainGain).connect(this.ambBus);
    rain.start();
  }
  private bird() {
    const t = this.ctx!.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2400 + Math.random() * 1200;
    for (let i = 0; i < n; i++) this.tone('sine', base, t + i * 0.11, 0.01, 0.03, 0.07, this.ambBus, base * 1.45);
  }

  // ---------- effects ----------
  play(name: string) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const gap: Record<string, number> = { road: 0.08, produce: 0.3, error: 0.25, click: 0.05 };
    if (gap[name] && now - (this.last[name] ?? 0) < gap[name]) return;
    this.last[name] = now;
    const t = now + 0.01, out = this.sfxBus;
    switch (name) {
      case 'place':
        this.tone('sine', 190, t, 0.005, 0.5, 0.18, out, 70);
        this.hiss(t, 0.003, 0.25, 0.08, 'bandpass', 1400, out, undefined, 1.5);
        [76, 79, 84].forEach((m, i) => this.tone('triangle', mtof(m), t + 0.06 + i * 0.05, 0.004, 0.09, 0.3, out));
        break;
      case 'road':
        this.hiss(t, 0.003, 0.18, 0.07, 'bandpass', 900, out, undefined, 2);
        this.tone('sine', 300, t, 0.003, 0.12, 0.06, out, 200);
        break;
      case 'demolish':
        this.hiss(t, 0.01, 0.45, 0.45, 'lowpass', 1600, out, 180);
        this.tone('sine', 110, t, 0.005, 0.4, 0.3, out, 45);
        break;
      case 'click':
        this.tone('sine', 880, t, 0.003, 0.08, 0.05, out, 1100);
        break;
      case 'error':
        this.tone('square', 233, t, 0.005, 0.06, 0.1, out, undefined, 900);
        this.tone('square', 196, t + 0.12, 0.005, 0.06, 0.14, out, undefined, 900);
        break;
      case 'upgrade':
        [67, 72, 76, 79].forEach((m, i) => this.tone('triangle', mtof(m), t + i * 0.07, 0.004, 0.12, 0.45, out));
        this.tone('sine', mtof(91), t + 0.3, 0.003, 0.05, 0.8, out);
        break;
      case 'quest':
        [72, 76, 79, 84, 88].forEach((m, i) => {
          this.tone('sine', mtof(m), t + i * 0.09, 0.003, 0.12, 1.2, out);
          this.tone('sine', mtof(m) * 2.76, t + i * 0.09, 0.002, 0.03, 0.4, out);
        });
        break;
      case 'produce': {
        const m = SCALE[Math.floor(Math.random() * SCALE.length)] + 12;
        this.tone('sine', mtof(m), t, 0.003, 0.035, 0.25, out);
        break;
      }
      case 'thunder': {
        this.hiss(t, 0.005, 0.35, 0.25, 'highpass', 1500, this.ambBus);
        this.hiss(t + 0.05, 0.08, 0.6, 3.2, 'lowpass', 320, this.ambBus, 60);
        this.hiss(t + 0.4, 0.2, 0.3, 2.4, 'lowpass', 180, this.ambBus, 50);
        break;
      }
    }
  }
}
