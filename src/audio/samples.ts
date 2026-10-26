// Recorded sounds (public/audio/world.json, packed by tools/pack-world.py): helpers to decode them,
// loop them without a seam and play short clips or random windows of longer recordings.

export interface WSample { b: AudioBuffer; loop: number }

export async function loadPack(ctx: AudioContext, file: string) {
  const out = new Map<string, WSample>();
  const res = await fetch(new URL(file, document.baseURI).href);
  const data: Record<string, string | { d: string; loop: number }> = await res.json();
  await Promise.all(Object.entries(data).map(async ([k, v]) => {
    const e = typeof v === 'string' ? { d: v, loop: 0 } : v;
    const bin = atob(e.d), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    try { out.set(k, { b: await ctx.decodeAudioData(arr.buffer), loop: e.loop }); } catch { /* skip a clip the browser can't decode */ }
  }));
  return out;
}

/**
 * A looping source that starts at a random point. MP3 adds a little silence at the start that some
 * browsers keep, so the loop points skip it: the packer crossfaded exactly `loop` seconds.
 */
export function loopSource(ctx: AudioContext, s: WSample, dest: AudioNode) {
  const src = ctx.createBufferSource();
  src.buffer = s.b; src.loop = true;
  const d = s.b.getChannelData(0);
  let lead = 0;
  while (lead < Math.min(d.length, 4096) && Math.abs(d[lead]) < 1e-3) lead++;
  if (lead >= 4096) lead = 0;
  const start = lead / s.b.sampleRate;
  const len = s.loop > 0 ? Math.min(s.loop, s.b.duration - start) : s.b.duration;
  src.loopStart = start; src.loopEnd = start + len;
  src.connect(dest);
  src.start(0, start + Math.random() * len * 0.9);
  return src;
}

export interface ClipOpts { at?: number; vol?: number; rate?: number; pan?: number; offset?: number; dur?: number; hp?: number; lp?: number }

/** play a clip, or with `dur` a window of it (faded in and out so it never clicks) */
export function clip(ctx: AudioContext, b: AudioBuffer, dest: AudioNode, o: ClipOpts = {}) {
  const t = o.at ?? ctx.currentTime;
  const rate = o.rate ?? 1;
  const src = ctx.createBufferSource();
  src.buffer = b; src.playbackRate.value = rate;
  let head: AudioNode = src;
  for (const [type, f] of [['highpass', o.hp], ['lowpass', o.lp]] as [BiquadFilterType, number | undefined][]) {
    if (!f) continue;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f;
    head.connect(flt); head = flt;
  }
  const g = ctx.createGain();
  const vol = o.vol ?? 1;
  if (o.dur) {
    const f = Math.min(0.25, o.dur / 4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + f);
    g.gain.setValueAtTime(vol, t + o.dur - f);
    g.gain.linearRampToValueAtTime(0, t + o.dur);
  } else g.gain.value = vol;
  head.connect(g);
  if (o.pan) {
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan));
    g.connect(p).connect(dest);
  } else g.connect(dest);
  const off = o.offset ?? 0;
  src.start(t, off, o.dur ? o.dur * rate : undefined);
  return src;
}

/** a random window of a long recording (a few gulls, one sheep, a snatch of chatter) */
export function snippet(ctx: AudioContext, s: WSample, dest: AudioNode, dur: number, o: ClipOpts = {}) {
  const span = Math.max(0, s.b.duration - dur * (o.rate ?? 1) - 0.1);
  return clip(ctx, s.b, dest, { ...o, dur, offset: 0.05 + Math.random() * span });
}

export function pickOf(m: Map<string, WSample>, base: string) {
  const all = ['', '_a', '_b', '_c', '_d'].map(x => m.get(base + x)).filter(Boolean) as WSample[];
  return all.length ? all[Math.floor(Math.random() * all.length)] : undefined;
}
