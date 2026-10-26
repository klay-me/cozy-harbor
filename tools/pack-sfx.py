# Packs the sampled sound effects into public/audio/sfx.json ({name: base64 mp3}).
# Sources (all CC0, by Kenney, https://kenney.nl):
#   kcity/  Starter Kit City Builder sounds  (github.com/KenneyNL/Starter-Kit-City-Builder, folder sounds/)
#   kui/    Interface Sounds                 (github.com/Calinou/kenney-interface-sounds, addons/kenney_interface_sounds/)
# Run from a folder holding kcity/ and kui/:  python3 /path/to/tools/pack-sfx.py
import subprocess, base64, json, os
M = {
 'place_a':'kcity/placement-a.ogg','place_b':'kcity/placement-b.ogg','place_c':'kcity/placement-c.ogg','place_d':'kcity/placement-d.ogg',
 'demolish_a':'kcity/removal-a.ogg','demolish_b':'kcity/removal-b.ogg','demolish_c':'kcity/removal-c.ogg','demolish_d':'kcity/removal-d.ogg',
 'rotate':'kcity/rotate.ogg','toggle':'kui/toggle_002.wav','click':'kui/click_003.wav','select':'kui/select_002.wav',
 'open':'kui/maximize_008.wav','close':'kui/minimize_008.wav','error':'kui/error_006.wav','confirm':'kui/confirmation_002.wav',
 'drop':'kui/drop_002.wav','pluck':'kui/pluck_001.wav','tick':'kui/tick_002.wav','bong':'kui/bong_001.wav','glass':'kui/glass_002.wav',
 'amb_day':'kcity/ambience.ogg',
}
out={}
for k,f in M.items():
    dst=f'mp3/{k}.mp3'
    br='56k' if k.startswith('amb') else '96k'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f,'-ac','1','-ar','44100','-b:a',br,dst],check=True)
    out[k]=base64.b64encode(open(dst,'rb').read()).decode()
json.dump(out,open('/home/claude/cozy-harbor/public/audio/sfx.json','w'))
print(os.path.getsize('/home/claude/cozy-harbor/public/audio/sfx.json')//1024,'KB')
