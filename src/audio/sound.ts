// Audio: sample-based music (music.ts), weather and time-of-day ambience, and sound effects.
// Instrument samples are FluidR3_GM (CC BY 3.0); ambience and some effects are synthesised.
import { Music, Sampler, SONGS, Inst } from './music';

export interface AudioSettings { music: number; sfx: number; muted: boolean }
const KEY = 'cozy-harbor-audio';
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];

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
  private waveGain!: GainNode;
  private sampler!: Sampler;
  private music!: Music;
  private w = { rain: 0, storm: 0, sunny: 1, night: 0, snow: 0 };
  private birdT = 4; private gullT = 9; private cricketT = 1;
  private last: Record<string, number> = {};
  private wantSong = 'spring';

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
    this.musicFilter.frequency.value = 12000;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.sampler = new Sampler(ctx, new URL('audio/', document.baseURI).href);
    this.music = new Music(ctx, this.sampler, this.musicBus, (t, vol, hp, dec) => this.hiss(t, 0.003, vol, dec, 'highpass', hp, this.musicBus));
    for (const i of ['marimba', 'glockenspiel', 'xylophone', 'kalimba', 'tubular_bells', 'woodblock'] as Inst[]) this.sampler.load(i);
    this.startAmbience();
    this.apply();
    this.music.want(this.wantSong);
    setInterval(() => this.tick(), 50);
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
    this.musicBus.gain.setTargetAtTime(s.music * 4.0, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx * 1.6, t, 0.05);
    this.ambBus.gain.setTargetAtTime(s.sfx * 0.8, t, 0.1);
  }

  /** Called a few times a second with the current scene so music and ambience follow it. */
  setScene(m: { rain: number; storm: number; sunny: number; night: number; snow: number }, season: string) {
    this.w = m;
    const song = m.night > 0.6 ? 'night' : m.rain > 0.4 ? 'rain' : season;
    this.wantSong = SONGS[song] ? song : 'spring';
    if (!this.ctx) return;
    this.music.want(this.wantSong);
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(m.rain * 0.22, t, 0.5);
    this.windGain.gain.setTargetAtTime(0.012 + m.storm * 0.09 + m.rain * 0.02 + m.snow * 0.03, t, 0.5);
    this.waveGain.gain.setTargetAtTime(0.06 + m.storm * 0.05, t, 0.5);
    this.musicFilter.frequency.setTargetAtTime(12000 - m.rain * 6000 - m.storm * 3000, t, 0.8);
  }
  currentSong() { return this.music?.current() ?? ''; }

  private tick() {
    if (!this.ctx) return;
    this.music.schedule();
    const dt = 0.05;
    // daytime birds and gulls, night crickets
    this.birdT -= dt; this.gullT -= dt; this.cricketT -= dt;
    if (this.birdT <= 0) { this.birdT = 3 + Math.random() * 6; if (this.w.sunny > 0.5 && this.w.night < 0.3 && this.w.snow < 0.3) this.bird(); }
    if (this.gullT <= 0) { this.gullT = 8 + Math.random() * 14; if (this.w.night < 0.3 && this.w.storm < 0.3) this.gull(); }
    if (this.cricketT <= 0) { this.cricketT = 0.6 + Math.random() * 0.9; if (this.w.night > 0.6 && this.w.rain < 0.2 && this.w.snow < 0.2) this.cricket(); }
  }

  // ---------- building blocks ----------
  private src(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
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

  // ---------- ambience ----------
  private startAmbience() {
    const ctx = this.ctx!;
    const waves = this.src(true);
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 420;
    this.waveGain = ctx.createGain(); this.waveGain.gain.value = 0.06;
    const swell = ctx.createGain(); swell.gain.value = 1;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(swell.gain);
    waves.connect(wl).connect(swell).connect(this.waveGain).connect(this.ambBus);
    waves.start(); lfo.start();
    const wind = this.src(true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.012;
    wind.connect(bp).connect(this.windGain).connect(this.ambBus);
    wind.start(0, 0.7);
    const rain = this.src(true);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(hp).connect(lp).connect(this.rainGain).connect(this.ambBus);
    rain.start(0, 1.3);
  }
  private bird() {
    const t = this.ctx!.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2400 + Math.random() * 1400;
    for (let i = 0; i < n; i++) this.tone('sine', base * (1 + (i % 2) * 0.12), t + i * 0.1, 0.01, 0.025, 0.07, this.ambBus, base * 1.45);
  }
  private gull() {
    const t = this.ctx!.currentTime + 0.05;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const s = t + i * 0.28;
      this.tone('triangle', 1650, s, 0.03, 0.02, 0.24, this.ambBus, 1050, 2600);
      this.tone('sine', 3300, s, 0.03, 0.006, 0.2, this.ambBus, 2100);
    }
  }
  private cricket() {
    const t = this.ctx!.currentTime + 0.02;
    for (let i = 0; i < 3; i++) this.hiss(t + i * 0.045, 0.003, 0.012, 0.025, 'bandpass', 4300, this.ambBus, undefined, 18);
  }

  // ---------- effects ----------
  private note(inst: Inst, m: number, t: number, vol: number, dur = 0) { this.sampler?.play(inst, m, t, vol, this.sfxBus, dur); }
  play(name: string) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const gap: Record<string, number> = { road: 0.08, produce: 0.35, error: 0.25, click: 0.05, coin: 0.4 };
    if (gap[name] && now - (this.last[name] ?? 0) < gap[name]) return;
    this.last[name] = now;
    const t = now + 0.01, out = this.sfxBus;
    switch (name) {
      case 'place':
        this.tone('sine', 190, t, 0.005, 0.45, 0.18, out, 70);
        this.note('woodblock', 76, t, 0.5);
        [76, 79, 84].forEach((m, i) => this.note('glockenspiel', m, t + 0.07 + i * 0.06, 0.35));
        break;
      case 'road':
        this.hiss(t, 0.003, 0.16, 0.07, 'bandpass', 900, out, undefined, 2);
        this.note('woodblock', 84, t, 0.25);
        break;
      case 'demolish':
        this.hiss(t, 0.01, 0.45, 0.45, 'lowpass', 1600, out, 180);
        this.tone('sine', 110, t, 0.005, 0.4, 0.3, out, 45);
        break;
      case 'click':
        this.note('marimba', 84, t, 0.28);
        break;
      case 'error':
        this.note('marimba', 62, t, 0.4);
        this.note('marimba', 61, t + 0.12, 0.4);
        break;
      case 'upgrade':
        [67, 71, 74, 79, 83].forEach((m, i) => this.note('xylophone', m + 12, t + i * 0.07, 0.4));
        break;
      case 'quest':
        [72, 76, 79, 84].forEach((m, i) => this.note('glockenspiel', m + 12, t + i * 0.11, 0.4));
        this.note('xylophone', 96, t + 0.5, 0.3);
        break;
      case 'produce':
        this.note('kalimba', PENTA[Math.floor(Math.random() * PENTA.length)], t, 0.16);
        break;
      case 'coin':
        this.note('glockenspiel', 95, t, 0.25);
        this.note('glockenspiel', 100, t + 0.08, 0.25);
        break;
      case 'bell':
        [67, 64, 60].forEach((m, i) => this.note('tubular_bells', m, t + i * 0.7, 0.35));
        break;
      case 'season':
        [60, 64, 67, 72, 76].forEach((m, i) => this.note('celesta', m + 12, t + i * 0.12, 0.35));
        break;
      case 'thunder':
        this.hiss(t, 0.005, 0.35, 0.25, 'highpass', 1500, this.ambBus);
        this.hiss(t + 0.05, 0.08, 0.6, 3.2, 'lowpass', 320, this.ambBus, 60);
        this.hiss(t + 0.4, 0.2, 0.3, 2.4, 'lowpass', 180, this.ambBus, 50);
        break;
    }
  }
}
