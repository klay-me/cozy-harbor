# Packs the recorded world sounds (weather, nature, buildings) into public/audio/world.json
# ({name: {"d": base64 mp3, "loop": seconds or 0}}). Loops are cut with a crossfade so they repeat
# without a seam; every clip is loudness-normalised so the levels in sound.ts/town.ts mean something.
#
# Sources (see CREDITS.md for each file's author and licence):
#   blanket/   github.com/rafaelmardojai/blanket            data/resources/sounds/  (CC0 / CC BY / public domain)
#   moodist/   github.com/remvze/moodist                    public/sounds/          (CC0 / Pixabay Content License)
#   cc0/       github.com/lavenderdotpet/CC0-Public-Domain-Sounds                   (CC0: Kenney, rubberduck)
# Usage: python3 tools/pack-world.py <blanket sounds dir> <moodist sounds dir> <cc0 repo dir>
import subprocess, base64, json, os, sys, tempfile
import numpy as np

BL, MO, CC = sys.argv[1:4]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'audio', 'world.json')
SR = 44100
KI, KR = f'{CC}/kenney_impactsounds/Audio', f'{CC}/kenney_rpgaudio/Audio'

# name: (file, start, length, kind)  kind: 'loop' crossfaded loop, 'raw' already loops, 'clip' one-shot
# stereo loops keep their width; clips are mono (they get panned to the building in the game)
LOOPS = {
  'rain_l':  (f'{BL}/rain.ogg', 20, 40),
  'rain_h':  (f'{MO}/rain/heavy-rain.mp3', 0.5, 19),
  'wind':    (f'{BL}/wind.ogg', 0.2, 12),
  'gale':    (f'{MO}/nature/howling-wind.mp3', 4, 30),
  'waves':   (f'{BL}/waves.ogg', 8, 40),
  'birds':   (f'{BL}/birds.ogg', 6, 40),
  'night':   (f'{BL}/summer-night.ogg', 2, 36),
  'fire':    (f'{BL}/fireplace.ogg', 2, 18),
  'crowd':   (f'{MO}/urban/crowd.mp3', 4, 30),
  'water':   (f'{BL}/stream.ogg', 30, 20),
}
RAW = {
  'industry': f'{CC}/100-cc0-sfx-2/sfx100v2_loop_machine_02.ogg',
}
# long recordings the game plays short random windows of
BEDS = {
  'gulls': (f'{MO}/animals/seagulls.mp3', 0, 40),
  'sheep': (f'{MO}/animals/sheep.mp3', 0, 30),
}
THUNDER = {   # one roll each, cut from a recording with long gaps between claps
  'thunder_a': (f'{MO}/rain/thunder.mp3', 0.6, 15),
  'thunder_b': (f'{MO}/rain/thunder.mp3', 21.2, 14),
  'thunder_c': (f'{MO}/rain/thunder.mp3', 47.3, 15),
  'thunder_far': (f'{CC}/100-cc0-sfx-2/sfx100v2_thunder_01.ogg', 0, 4.6),
}
CLIPS = {
  'chop_a': f'{KR}/chop.ogg', 'chop_b': f'{KI}/impactWood_heavy_000.ogg', 'chop_c': f'{KI}/impactWood_heavy_002.ogg', 'chop_d': f'{KI}/impactWood_heavy_004.ogg',
  'saw': f'{CC}/30-cc0-sfx-loops/saw.ogg',
  'anvil_a': f'{KI}/impactPlate_heavy_000.ogg', 'anvil_b': f'{KI}/impactPlate_heavy_002.ogg', 'anvil_c': f'{KI}/impactPlate_heavy_004.ogg',
  'pick_a': f'{KI}/impactMining_000.ogg', 'pick_b': f'{KI}/impactMining_002.ogg', 'pick_c': f'{KI}/impactMining_004.ogg',
  'hammer_a': f'{KI}/impactPlank_medium_000.ogg', 'hammer_b': f'{KI}/impactPlank_medium_002.ogg', 'hammer_c': f'{CC}/100-CC0-wood-metal-SFX/wood_hammer_01.ogg',
  'splash_a': f'{CC}/40-cc0-water-splash-slime-sfx/splash_02.ogg', 'splash_b': f'{CC}/40-cc0-water-splash-slime-sfx/splash_03.ogg', 'splash_c': f'{CC}/40-cc0-water-splash-slime-sfx/splash_04.ogg',
  'creak_a': f'{KR}/creak1.ogg', 'creak_b': f'{KR}/creak2.ogg', 'creak_c': f'{KR}/creak3.ogg',
  'clink_a': f'{KI}/impactGlass_light_000.ogg', 'clink_b': f'{KI}/impactGlass_light_002.ogg', 'clink_c': f'{KI}/impactGlass_light_004.ogg',
  'loom_a': f'{KI}/impactWood_light_000.ogg', 'loom_b': f'{KI}/impactWood_light_003.ogg',
  'cart': f'{CC}/30-cc0-sfx-loops/rolling.ogg',
  'coins': f'{KR}/handleCoins.ogg', 'coins_b': f'{KR}/handleCoins2.ogg',
  'bell_hit': f'{KI}/impactBell_heavy_001.ogg',
}


def decode(path, start=0.0, length=None, ch=2):
  cmd = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', path]
  if length: cmd += ['-t', str(length)]
  cmd += ['-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-']
  a = np.frombuffer(subprocess.run(cmd, check=True, capture_output=True).stdout, dtype=np.float32)
  return a.reshape(-1, ch).copy()

def rms_db(a):
  return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)

def norm(a, target_db=None, peak=0.89):
  if target_db is not None: a = a * 10 ** ((target_db - rms_db(a)) / 20)
  p = np.abs(a).max()
  return a * (peak / p) if p > peak else a

def fade(a, t_in, t_out):
  n_in, n_out = int(t_in * SR), int(t_out * SR)
  if n_in: a[:n_in] *= np.linspace(0, 1, n_in)[:, None]
  if n_out: a[-n_out:] *= np.linspace(1, 0, n_out)[:, None] ** 2
  return a

def loop(path, start, length, xf=2.0):
  a = decode(path, start, length + xf)
  n, x = int(length * SR), int(xf * SR)
  a = a[:n + x]
  t = np.linspace(0, np.pi / 2, x)[:, None]
  head, tail = a[:x].copy(), a[n:n + x]
  a = a[:n]
  a[:x] = head * np.sin(t) + tail * np.cos(t)    # equal-power: the end flows into the start
  return a

def encode(a, br):
  with tempfile.TemporaryDirectory() as d:
    raw, mp3 = f'{d}/a.f32', f'{d}/a.mp3'
    a.astype(np.float32).tofile(raw)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(a.shape[1]), '-i', raw,
                    '-b:a', br, mp3], check=True)
    return base64.b64encode(open(mp3, 'rb').read()).decode()

out = {}
for k, (f, s, l) in LOOPS.items():
  out[k] = {'d': encode(norm(loop(f, s, l), -20), '80k'), 'loop': l}
for k, f in RAW.items():
  a = norm(decode(f), -20)
  out[k] = {'d': encode(a, '80k'), 'loop': len(a) / SR}
for k, (f, s, l) in BEDS.items():
  out[k] = {'d': encode(norm(decode(f, s, l, 1), -20), '64k'), 'loop': 0}
for k, (f, s, l) in THUNDER.items():
  out[k] = {'d': encode(norm(fade(decode(f, s, l), 0.005, 3), peak=0.95), '80k'), 'loop': 0}
for k, f in CLIPS.items():
  out[k] = {'d': encode(norm(fade(decode(f, ch=1), 0, 0.02), peak=0.95), '80k'), 'loop': 0}

json.dump(out, open(OUT, 'w'))
for k, v in out.items(): print(f'{k:12s} {len(v["d"]) * 3 // 4 // 1024:5d} KB')
print(os.path.getsize(OUT) // 1024, 'KB total')
