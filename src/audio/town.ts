// The town you can hear: every building near the camera makes its own sound, panned to where it
// stands on screen and louder the closer you zoom in. Recorded sounds (world.json) where we have them,
// synthesised ones until they load and for the few we don't (ship horn, steam, turbine).
//   beds   – continuous layers whose volume follows how much of it is nearby (crowd, industry, water, fire)
//   events – short sounds on a timer per building type (axe, saw, anvil, sheep, splash, horn …)
import { familyOf, type BuildingId } from '../sim/data';
import { clip, loopSource, pickOf, snippet, type WSample } from './samples';

export interface Source { type: BuildingId; w: number; pan: number; working: boolean; fire: boolean }

type Bed = 'crowd' | 'industry' | 'water' | 'fire';
const BED_OF: Partial<Record<BuildingId, Bed>> = {
  market: 'crowd', tavern: 'crowd', theatre: 'crowd', depot: 'crowd',
  brickworks: 'industry', steelworks: 'industry', coalplant: 'industry', cementworks: 'industry', cannery: 'industry',
  appliances: 'industry', coalmine: 'industry', heatplant: 'industry', recycler: 'industry', weaver: 'industry',
  fishery: 'water', hydro: 'water', sawmill: 'water',
};
type Ev = 'chop' | 'saw' | 'anvil' | 'pick' | 'splash' | 'sheep' | 'creak' | 'clink' | 'horn' | 'steam' | 'whoosh' | 'hammer' | 'loom' | 'cart' | 'chime' | 'kids';
/** event, seconds between (min, max) */
const EV_OF: Partial<Record<BuildingId, [Ev, number, number]>> = {
  lumberjack: ['chop', 1.4, 2.6], sawmill: ['saw', 4, 7], smithy: ['anvil', 2, 3.5], steelworks: ['anvil', 3, 5],
  ironmine: ['pick', 1.5, 3], coalmine: ['cart', 5, 9], fishery: ['splash', 3, 6], sheepfarm: ['sheep', 5, 11],
  mill: ['creak', 3.5, 6], tavern: ['clink', 2.5, 5], depot: ['horn', 25, 45], coalplant: ['steam', 6, 10],
  windturbine: ['whoosh', 1.6, 1.8], firewood: ['chop', 2, 3.5], tailor: ['loom', 3, 5], weaver: ['loom', 1.5, 2.5],
  bakery: ['chime', 12, 20], school: ['kids', 9, 16], brickworks: ['hammer', 3, 5], guild: ['hammer', 4, 7],
  claypit: ['pick', 2.5, 4], cementworks: ['steam', 7, 12],
};

export class TownSounds {
  private beds = new Map<Bed, { g: GainNode; p: StereoPannerNode; synth: GainNode }>();
  private rec = new Map<string, WSample>();
  private recBed = new Set<Bed>();
  private timers = new Map<Ev, number>();
  private crowdT = 0;
  private crowdW = 0; private crowdPan = 0;
  private srcs: Source[] = [];
  private night = 0;

  constructor(private ctx: AudioContext, private out: AudioNode, private noise: AudioBuffer) {
    this.makeBeds();
  }

  // ---------- helpers ----------
  private chain(pan: number, vol: number, t: number, dur: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.out);
    void vol; void dur;
    return g;
  }
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  private noiseSrc(t: number, dur: number, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = loop;
    s.start(t, Math.random() * 1.5);
    if (!loop) s.stop(t + dur + 0.05);
    return s;
  }
  private filt(type: BiquadFilterType, f: number, q = 1) {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }
  private osc(type: OscillatorType, f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  // ---------- beds ----------
  private makeBeds() {
    const ctx = this.ctx;
    const mk = (b: Bed, head: AudioNode) => {
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createStereoPanner();
      const synth = ctx.createGain();
      head.connect(synth).connect(g).connect(p).connect(this.out);
      this.beds.set(b, { g, p, synth });
    };
    // crowd murmur: band of noise with a slow wobble, plus babble blips scheduled in update()
    {
      const n = this.noiseSrc(ctx.currentTime, 0, true);
      const bp = this.filt('bandpass', 650, 0.8), lp = this.filt('lowpass', 1400);
      const am = ctx.createGain(); am.gain.value = 0.7;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.31;
      const lg = ctx.createGain(); lg.gain.value = 0.3;
      lfo.connect(lg).connect(am.gain); lfo.start();
      n.connect(bp).connect(lp).connect(am);
      mk('crowd', am);
    }
    // industry: low machine hum and rumble
    {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55; o1.start();
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 110.6; o2.start();
      const n = this.noiseSrc(ctx.currentTime, 0, true);
      const lp = this.filt('lowpass', 260, 0.7), nlp = this.filt('lowpass', 180);
      const mix = ctx.createGain();
      const g1 = ctx.createGain(); g1.gain.value = 0.25; const g2 = ctx.createGain(); g2.gain.value = 0.08; const g3 = ctx.createGain(); g3.gain.value = 1.4;
      o1.connect(g1).connect(lp); o2.connect(g2).connect(lp); n.connect(nlp).connect(g3).connect(mix); lp.connect(mix);
      // a slow chug
      const lfo = ctx.createOscillator(); lfo.frequency.value = 1.6;
      const lg = ctx.createGain(); lg.gain.value = 0.25;
      const am = ctx.createGain(); am.gain.value = 0.75;
      lfo.connect(lg).connect(am.gain); lfo.start();
      mix.connect(am);
      mk('industry', am);
    }
    // water lapping and wheels splashing
    {
      const n = this.noiseSrc(ctx.currentTime, 0, true);
      const bp = this.filt('bandpass', 900, 0.6);
      const am = ctx.createGain(); am.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
      const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg).connect(am.gain); lfo.start();
      n.connect(bp).connect(am);
      mk('water', am);
    }
    // fire roar (crackles are events)
    {
      const n = this.noiseSrc(ctx.currentTime, 0, true);
      const lp = this.filt('lowpass', 420, 0.5);
      const g = ctx.createGain(); g.gain.value = 1.5;
      n.connect(lp).connect(g);
      mk('fire', g);
    }
  }

  /** recordings arrived: beds switch over from the synthesised layers */
  useSamples(m: Map<string, WSample>) {
    this.rec = m;
    for (const [b, n] of this.beds) {
      const s = m.get(b);
      if (!s) continue;
      const g = this.ctx.createGain(); g.gain.value = 0;
      loopSource(this.ctx, s, g);
      g.connect(n.g);
      g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5);
      n.synth.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      this.recBed.add(b);
    }
  }

  /** called a few times a second with what is near the camera */
  update(srcs: Source[], night: number) {
    this.srcs = srcs;
    this.night = night;
    const t = this.ctx.currentTime;
    const acc = new Map<Bed, { w: number; pan: number }>();
    for (const s of srcs) {
      const bed: Bed | undefined = s.fire ? 'fire' : s.working ? (BED_OF[s.type] ?? BED_OF[familyOf(s.type)]) : undefined;
      if (!bed) continue;
      const a = acc.get(bed) ?? { w: 0, pan: 0 };
      a.w += s.w; a.pan += s.pan * s.w;
      acc.set(bed, a);
    }
    const LEVEL: Record<Bed, number> = { crowd: 0.05, industry: 0.09, water: 0.035, fire: 0.16 };
    const REC: Record<Bed, number> = { crowd: 0.32, industry: 0.22, water: 0.2, fire: 0.5 };
    for (const [b, n] of this.beds) {
      const a = acc.get(b);
      const w = a ? Math.min(1.4, a.w) : 0;
      const lvl = this.recBed.has(b) ? REC[b] : LEVEL[b];
      // markets and taverns quieten at night, taverns less so
      const k = b === 'crowd' ? 1 - night * 0.55 : 1;
      n.g.gain.setTargetAtTime(Math.sqrt(w) * lvl * k, t, 0.6);
      n.p.pan.setTargetAtTime(a && a.w > 0 ? a.pan / a.w : 0, t, 0.6);
    }
    const c = acc.get('crowd');
    this.crowdW = c ? Math.min(1.4, c.w) * (1 - night * 0.55) : 0;
    this.crowdPan = c && c.w ? c.pan / c.w : 0;
  }

  /** runs every 50 ms: fire whichever building sounds are due */
  tick(dt: number) {
    if (!this.srcs.length) return;
    // babble: little vowel-ish blips over the crowd bed
    this.crowdT -= dt;
    if (this.crowdT <= 0) {
      this.crowdT = 0.07 + Math.random() * 0.2;
      if (this.crowdW > 0.04 && !this.recBed.has('crowd')) this.voice(this.crowdPan + (Math.random() - 0.5) * 0.4, Math.sqrt(this.crowdW) * 0.035);
    }
    // fire crackles
    const crack = this.recBed.has('fire') ? 3 : 12;   // the recording crackles by itself
    for (const s of this.srcs) if (s.fire && Math.random() < dt * crack * Math.min(1, s.w * 2)) this.crackle(s.pan, Math.sqrt(s.w) * 0.12);
    // per type
    const best = new Map<Ev, Source[]>();
    for (const s of this.srcs) {
      const e = EV_OF[s.type] ?? EV_OF[familyOf(s.type)];
      if (!e || !s.working || s.fire) continue;
      (best.get(e[0]) ?? best.set(e[0], []).get(e[0])!).push(s);
    }
    for (const [ev, list] of best) {
      let tm = this.timers.get(ev) ?? Math.random() * 2;
      tm -= dt * Math.min(3, 0.6 + list.length * 0.4);   // more of them, more often
      if (tm <= 0) {
        const typ = list[0].type, e = (EV_OF[typ] ?? EV_OF[familyOf(typ)])!;
        tm = e[1] + Math.random() * (e[2] - e[1]);
        // pick one of them, louder ones more often
        let r = Math.random() * list.reduce((a, s) => a + s.w, 0), s = list[0];
        for (const x of list) { r -= x.w; if (r <= 0) { s = x; break; } }
        const v = Math.sqrt(s.w);
        if (v > 0.05 && !(this.night > 0.7 && (ev === 'kids' || ev === 'sheep' || ev === 'chime'))) this.play(ev, s.pan, v);
      }
      this.timers.set(ev, tm);
    }
  }

  // ---------- event sounds ----------
  /** one of the recorded variants of a sound; false if none is loaded */
  private hit(base: string, t: number, pan: number, vol: number, rate = 1, o: { lp?: number; hp?: number } = {}) {
    const s = pickOf(this.rec, base);
    if (!s) return false;
    clip(this.ctx, s.b, this.out, { at: t, pan, vol, rate: rate * (0.93 + Math.random() * 0.14), ...o });
    return true;
  }
  private play(ev: Ev, pan: number, v: number) {
    const t = this.ctx.currentTime + 0.02;
    if (this.rec.size && this.playRec(ev, t, pan, v)) return;
    switch (ev) {
      case 'chop': this.thunk(t, pan, v * 0.5, 850, 110); if (Math.random() < 0.15) this.thunk(t + 0.45, pan, v * 0.4, 800, 100); break;
      case 'hammer': for (let i = 0; i < 3; i++) this.thunk(t + i * 0.28, pan, v * 0.32, 1500, 220); break;
      case 'saw': this.saw(t, pan, v); break;
      case 'anvil': { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) this.ping(t + i * 0.38, pan, v * 0.18, 1150 + Math.random() * 60); break; }
      case 'pick': this.ping(t, pan, v * 0.1, 900, 0.18); this.thunk(t, pan, v * 0.2, 600, 90); break;
      case 'cart': this.rumble(t, pan, v * 0.25); break;
      case 'splash': this.splash(t, pan, v * 0.3); break;
      case 'sheep': this.sheep(t, pan, v * 0.16); break;
      case 'creak': this.creak(t, pan, v * 0.12); break;
      case 'clink': this.ping(t, pan, v * 0.06, 3100, 0.25); this.ping(t + 0.06, pan, v * 0.05, 3700, 0.2); break;
      case 'horn': this.horn(t, pan, v * 0.22); break;
      case 'steam': this.steam(t, pan, v * 0.12); break;
      case 'whoosh': this.whoosh(t, pan, v * 0.1); break;
      case 'loom': for (let i = 0; i < 4; i++) this.thunk(t + i * 0.16, pan, v * 0.12, 2200, 300); break;
      case 'chime': [1568, 1976, 2349].forEach((f, i) => this.ping(t + i * 0.12, pan, v * 0.05, f, 0.6)); break;
      case 'kids': for (let i = 0; i < 3; i++) this.voice(pan, v * 0.05, 2.2, t + i * 0.12); break;
    }
  }
  /** recorded version of each event; false where there is none (horn, steam, turbine) */
  private playRec(ev: Ev, t: number, pan: number, v: number) {
    const r = this.rec;
    switch (ev) {
      case 'chop':
        this.hit('chop', t, pan, v * 0.55, 0.9);
        if (Math.random() < 0.2) this.hit('chop', t + 0.5 + Math.random() * 0.15, pan, v * 0.45, 0.9);
        return true;
      case 'hammer': for (let i = 0; i < 3; i++) this.hit('hammer', t + i * (0.3 + Math.random() * 0.05), pan, v * 0.4); return true;
      case 'saw': {
        const s = r.get('saw'); if (!s) return false;
        const dur = 1.2 + Math.random() * 0.9;
        clip(this.ctx, s.b, this.out, { at: t, pan, vol: v * 0.3, rate: 0.75 + Math.random() * 0.1, dur, offset: Math.random() * 0.4, lp: 7000 });
        return true;
      }
      case 'anvil': {
        // the recorded strike plus a quiet ring so it reads as an anvil rather than a plate
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          this.hit('anvil', t + i * 0.42, pan, v * 0.4, 1.15);
          this.ping(t + i * 0.42, pan, v * 0.07, 1150 + Math.random() * 60);
        }
        return true;
      }
      case 'pick': return this.hit('pick', t, pan, v * 0.4);
      case 'cart': {
        const s = r.get('cart'); if (!s) return false;
        for (let i = 0; i < 2; i++) clip(this.ctx, s.b, this.out, { at: t + i * 0.9, pan, vol: v * 0.3, rate: 0.8, lp: 3000 });
        return true;
      }
      case 'splash': return this.hit('splash', t, pan, v * 0.32, 0.85, { lp: 5000 });
      case 'sheep': {
        const s = r.get('sheep'); if (!s) return false;
        snippet(this.ctx, s, this.out, 2.4, { at: t, pan, vol: v * 0.55, hp: 280 });
        return true;
      }
      case 'creak': return this.hit('creak', t, pan, v * 0.32, 0.8);
      case 'clink': this.hit('clink', t, pan, v * 0.2); return this.hit('clink', t + 0.07 + Math.random() * 0.1, pan, v * 0.16);
      case 'loom': for (let i = 0; i < 4; i++) this.hit('loom', t + i * 0.17, pan, v * 0.22, 1.2); return true;
      case 'chime': return this.hit('bell_hit', t, pan, v * 0.12, 1.6);
      case 'kids': {
        const s = r.get('crowd'); if (!s) return false;
        snippet(this.ctx, s, this.out, 2.2, { at: t, pan, vol: v * 0.35, rate: 1.35, hp: 400 });
        return true;
      }
    }
    return false;
  }

  private thunk(t: number, pan: number, v: number, f: number, low: number) {
    const g = this.chain(pan, v, t, 0.2);
    this.env(g, t, 0.003, v, 0.09);
    const n = this.noiseSrc(t, 0.12), bp = this.filt('bandpass', f, 1.4);
    n.connect(bp).connect(g);
    const g2 = this.chain(pan, v, t, 0.2);
    this.env(g2, t, 0.004, v * 1.2, 0.14);
    const o = this.osc('sine', low, t, 0.16);
    o.frequency.exponentialRampToValueAtTime(low * 0.5, t + 0.15);
    o.connect(g2);
  }
  private ping(t: number, pan: number, v: number, f: number, dec = 0.7) {
    // inharmonic partials: metal
    [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.1]].forEach(([m, a]) => {
      const g = this.chain(pan, v, t, dec);
      this.env(g, t, 0.002, v * a, dec * (1.2 - m / 10));
      this.osc('sine', f * m, t, dec * 1.2).connect(g);
    });
    const g = this.chain(pan, v, t, 0.05);
    this.env(g, t, 0.001, v * 0.8, 0.02);
    this.noiseSrc(t, 0.03).connect(this.filt('highpass', 4000)).connect(g);
  }
  private saw(t: number, pan: number, v: number) {
    const dur = 1.1 + Math.random() * 0.8;
    const g = this.chain(pan, v, t, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.05, t + 0.15);
    g.gain.setValueAtTime(v * 0.05, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = this.osc('sawtooth', 190, t, dur);
    o.frequency.linearRampToValueAtTime(150, t + dur);   // bogs down in the log
    const bp = this.filt('bandpass', 2300, 2);
    o.connect(bp).connect(g);
    const n = this.noiseSrc(t, dur), hp = this.filt('bandpass', 4500, 1.5);
    const ng = this.ctx.createGain(); ng.gain.value = 0.6;
    n.connect(hp).connect(ng).connect(g);
  }
  private splash(t: number, pan: number, v: number) {
    const g = this.chain(pan, v, t, 0.5);
    this.env(g, t, 0.01, v, 0.45);
    const n = this.noiseSrc(t, 0.5), lp = this.filt('lowpass', 2400, 0.8);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    n.connect(lp).connect(g);
  }
  private sheep(t: number, pan: number, v: number) {
    const f0 = 230 + Math.random() * 90, dur = 0.55 + Math.random() * 0.25;
    const o = this.osc('sawtooth', f0, t, dur);
    o.frequency.linearRampToValueAtTime(f0 * 0.88, t + dur);
    const vib = this.osc('sine', 7, t, dur), vg = this.ctx.createGain(); vg.gain.value = f0 * 0.04;
    vib.connect(vg).connect(o.frequency);
    const g = this.chain(pan, v, t, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.06);
    g.gain.setValueAtTime(v, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [f, q] of [[750, 6], [1200, 7], [2500, 8]]) o.connect(this.filt('bandpass', f, q)).connect(g);
  }
  private creak(t: number, pan: number, v: number) {
    const dur = 0.5;
    const o = this.osc('sawtooth', 70, t, dur);
    o.frequency.linearRampToValueAtTime(95, t + dur);
    const g = this.chain(pan, v, t, dur);
    this.env(g, t, 0.08, v, 0.4);
    o.connect(this.filt('bandpass', 900, 4)).connect(g);
  }
  private horn(t: number, pan: number, v: number) {
    // a ship's horn: two low notes, the second longer
    [[0, 0.5], [0.7, 1.4]].forEach(([d, len]) => {
      const g = this.chain(pan, v, t + d, len);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(v, t + d + 0.12);
      g.gain.setValueAtTime(v, t + d + len - 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
      const lp = this.filt('lowpass', 520, 1.5);
      for (const f of [98, 147, 196.5]) this.osc('sawtooth', f, t + d, len).connect(lp);
      lp.connect(g);
    });
  }
  private steam(t: number, pan: number, v: number) {
    const g = this.chain(pan, v, t, 2.2);
    this.env(g, t, 0.15, v, 2);
    this.noiseSrc(t, 2.3).connect(this.filt('highpass', 2600, 0.7)).connect(g);
  }
  private whoosh(t: number, pan: number, v: number) {
    const g = this.chain(pan, v, t, 0.9);
    this.env(g, t, 0.35, v, 0.5);
    const bp = this.filt('bandpass', 500, 1.2);
    bp.frequency.exponentialRampToValueAtTime(260, t + 0.85);
    this.noiseSrc(t, 0.9).connect(bp).connect(g);
  }
  private rumble(t: number, pan: number, v: number) {
    const g = this.chain(pan, v, t, 1.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    this.noiseSrc(t, 1.7).connect(this.filt('lowpass', 220, 1)).connect(g);
    for (let i = 0; i < 5; i++) this.ping(t + 0.2 + i * 0.24, pan, v * 0.08, 700 + Math.random() * 80, 0.12);
  }
  private crackle(pan: number, v: number) {
    const t = this.ctx.currentTime + Math.random() * 0.05;
    const g = this.chain(pan, v, t, 0.02);
    this.env(g, t, 0.001, v, 0.012 + Math.random() * 0.02);
    this.noiseSrc(t, 0.04).connect(this.filt('highpass', 2500 + Math.random() * 2500)).connect(g);
  }
  /** one syllable of distant chatter: noise through two vowel formants */
  private voice(pan: number, v: number, pitch = 1, at?: number) {
    const t = at ?? this.ctx.currentTime + 0.01;
    const dur = 0.08 + Math.random() * 0.16;
    const VOW = [[700, 1100], [400, 1700], [300, 2300], [550, 900], [500, 1400]];
    const [f1, f2] = VOW[Math.floor(Math.random() * VOW.length)];
    const g = this.chain(pan, v, t, dur);
    this.env(g, t, 0.02, v, dur);
    const o = this.osc('sawtooth', (140 + Math.random() * 110) * pitch, t, dur);
    o.connect(this.filt('bandpass', f1 * pitch, 5)).connect(g);
    o.connect(this.filt('bandpass', f2 * pitch, 7)).connect(g);
  }
}
