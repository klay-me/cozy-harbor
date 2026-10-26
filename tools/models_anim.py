# Moving parts and the big warehouse. Executed at the end of tools/models.py, after models_resize.py.
#
# Animated parts are empties whose name starts with the kind (see src/render/assets.ts):
#   spinz_ / spinx_   spin around the game's Z / X axis        (sails, wheels, saws)
#   spiny_            turn around the vertical axis             (cranes, domes, vents)
#   swingx_ / swingz_ rock around X / Z                         (axes, hammers, bells, signs)
#   flag_             flutter around the pole                   (flags, banners)
#   bob_              bob on water
# The game decides speed and rhythm from the rest of the name (crane, axe, bell …).

def kids(rootname, base):
    """children of a model root whose name is p_<base> or p_<base>.NNN"""
    r = bpy.data.objects[rootname]
    return [c for c in r.children if c.name.split('.')[0] == 'p_' + base]

def kill(rootname, base, near=None, r=0.3):
    for c in kids(rootname, base):
        if near is None or (Vector(c.location) - Vector(near)).length < r:
            bpy.data.objects.remove(c, do_unlink=True)

def first(rootname, base):
    k = kids(rootname, base)
    return Vector(k[0].location) if k else None

def anim(rootname, name, loc):
    e = bpy.data.objects.new(name, None)
    COL.objects.link(e)
    e.parent = bpy.data.objects[rootname]
    e.location = loc
    return e

def flag(rootname, name, top, col, w=0.3, h=0.2, k=1.0, face='x'):
    """a flag hanging from the top of a pole; the empty sits on the pole so it flutters around it"""
    e = anim(rootname, 'flag_' + name, top)
    if face == 'x':
        box(e, (w * k, 0.02 * k, h * k), (w * k / 2, 0, -h * k / 2), col, bevel=0.004, name='flagcloth')
    else:
        box(e, (0.02 * k, w * k, h * k), (0, w * k / 2, -h * k / 2), col, bevel=0.004, name='flagcloth')
    return e

# ---------------------------------------------------------------- harbour crane and flag
c = first('depot', 'crane')
if c is not None:
    kill('depot', 'crane'); kill('depot', 'boom'); kill('depot', 'rope')
    kill('depot', 'crate', near=(1.15, -1.78, 0.93)); kill('depot', 'crateband', near=(1.15, -1.78, 0.93))
    e = anim('depot', 'spiny_crane', (c.x, c.y, 0.22))
    cyl(e, 0.11, 0.13, 0.12, (0, 0, 0.06), P['stone2'], seg=10, name='cranebase')
    cyl(e, 0.05, 0.06, 1.3, (0, 0, 0.7), P['wood2'], seg=8, name='crane')
    box(e, (0.07, 1.0, 0.07), (0, -0.42, 1.3), P['wood2'], bevel=0.01, name='boom')
    box(e, (0.03, 0.62, 0.03), (0, -0.25, 1.08), P['wood2'], rot=(-0.62, 0, 0), bevel=0.004, name='brace')
    box(e, (0.16, 0.16, 0.14), (0, 0.16, 1.28), P['stone2'], bevel=0.015, name='counterweight')
    cyl(e, 0.008, 0.008, 0.46, (0, -0.86, 1.05), P['dark'], seg=4, bevel=0, name='rope')
    crate(e, 0, -0.86, 0.66, 0.17, '#E9B370')
f = first('depot', 'flag')
if f is not None:
    kill('depot', 'flag')
    flag('depot', 'depot', (f.x - 0.21, f.y, f.z + 0.13), P['red'], 0.42, 0.26)

# ---------------------------------------------------------------- lumberjack: an axe splitting logs
kill('lumberjack', 'handle'); kill('lumberjack', 'axehead')
e = anim('lumberjack', 'swingx_axe', (0.5, 0.86, 0.44))
cyl(e, 0.02, 0.02, 0.36, (0, -0.17, -0.06), P['beam'], seg=6, rot=(math.pi / 2 - 0.35, 0, 0), name='handle')
box(e, (0.03, 0.08, 0.14), (0, -0.34, -0.12), P['metal'], rot=(-0.35, 0, 0), bevel=0.008, name='axehead')

# ---------------------------------------------------------------- smithy: hammer on the anvil
kill('smithy', 'hammer')
e = anim('smithy', 'swingz_hammer', (0.8, -0.25, 0.42))
cyl(e, 0.016, 0.016, 0.24, (-0.12, 0, 0), P['beam'], seg=6, rot=(0, math.pi / 2, 0), name='handle')
box(e, (0.07, 0.06, 0.06), (-0.24, 0, -0.01), P['dark'], bevel=0.008, name='hammerhead')

# ---------------------------------------------------------------- mine: a headframe with a winding wheel
for x in (0.38, 0.62):
    box(bpy.data.objects['mine'], (0.05, 0.05, 0.95), (x, 0.05, 0.55), P['beam'], rot=(0.18 if x < 0.5 else -0.18, 0, 0), bevel=0.008, name='headframe')
    box(bpy.data.objects['mine'], (0.05, 0.05, 0.95), (x, 0.32, 0.55), P['beam'], rot=(-0.18 if x < 0.5 else 0.18, 0, 0), bevel=0.008, name='headframe')
box(bpy.data.objects['mine'], (0.34, 0.36, 0.05), (0.5, 0.18, 1.0), P['beam'], bevel=0.008, name='headdeck')
e = anim('mine', 'spinx_wheel', (0.5, 0.18, 1.16))
torus(e, 0.17, 0.02, (0, 0, 0), P['red'], rot=(0, math.pi / 2, 0), seg=18, rseg=5, name='wheelrim')
for i in range(4):
    a = i * math.pi / 4
    box(e, (0.03, 0.02, 0.34), (0, 0, 0), P['red'], rot=(a, 0, 0), bevel=0, name='spoke')
cyl(e, 0.04, 0.04, 0.06, (0, 0, 0), P['dark'], seg=8, rot=(0, math.pi / 2, 0), name='hub')
cyl(bpy.data.objects['mine'], 0.006, 0.006, 0.9, (0.5, 0.01, 0.62), P['dark'], seg=4, bevel=0, name='cable')

# ---------------------------------------------------------------- church: the bell rings on the hour
t = first('church', 'tower')
if t is not None:
    e = anim('church', 'swingx_bell', (t.x, t.y, 2.64))
    cyl(e, 0.012, 0.012, 0.08, (0, 0, -0.03), P['dark'], seg=5, name='yoke')
    cyl(e, 0.09, 0.05, 0.16, (0, 0, -0.14), P['gold'], seg=12, name='bell')
    cyl(e, 0.1, 0.1, 0.03, (0, 0, -0.22), P['gold'], seg=12, name='bellrim')

# ---------------------------------------------------------------- fire station: the alarm bell swings while something burns
b = first('firestation', 'bell')
if b is not None:
    kill('firestation', 'bell')
    e = anim('firestation', 'swingx_firebell', (b.x, b.y, b.z + 0.08))
    cyl(e, 0.07, 0.05, 0.1, (0, 0, -0.08), P['gold'], seg=10, name='bell')
pole = first('firestation', 'tower')
if pole is not None:
    box(bpy.data.objects['firestation'], (0.025, 0.025, 0.5), (pole.x - 0.15, pole.y + 0.15, 2.3), P['white'], bevel=0, name='flagpole')
    flag('firestation', 'fire', (pole.x - 0.15, pole.y + 0.15, 2.52), '#E8665A', 0.26, 0.16)

# ---------------------------------------------------------------- flags on the town hall, school, police
for f in kids('townhall', 'flag'):
    loc, col = Vector(f.location), f.data.materials[0]
    bpy.data.objects.remove(f, do_unlink=True)
    e = anim('townhall', 'flag_th', (loc.x, loc.y - 0.15, loc.z + 0.1))
    o = box(e, (0.02, 0.3, 0.2), (0, 0.15, -0.1), P['red'], bevel=0.004, name='flagcloth')
    o.data.materials[0] = col
f = first('school', 'flag')
if f is not None:
    k = 1.4
    kill('school', 'flag')
    flag('school', 'school', (f.x, f.y - 0.11 * k, f.z + 0.07 * k), '#F2766B', 0.22, 0.14, k=k, face='y')
box(bpy.data.objects['police'], (0.025, 0.025, 0.6), (-0.55, 0.55, 1.45), P['white'], bevel=0, name='flagpole')
flag('police', 'police', (-0.55, 0.55, 1.73), '#3E5C8A', 0.26, 0.16)

# ---------------------------------------------------------------- tavern sign and weaver's cloth sway in the wind
br = first('tavern', 'bracket')
if br is not None:
    kill('tavern', 'signboard'); kill('tavern', 'mug')
    e = anim('tavern', 'swingx_sign', (br.x, br.y - 0.1, br.z - 0.02))
    box(e, (0.03, 0.26, 0.2), (0, 0, -0.14), '#F4C84B', bevel=0.012, name='signboard')
    cyl(e, 0.05, 0.05, 0.1, (-0.015, 0, -0.14), P['white'], seg=10, name='mug')
    cyl(e, 0.004, 0.004, 0.05, (0, -0.1, -0.02), P['dark'], seg=4, bevel=0, name='chain')
    cyl(e, 0.004, 0.004, 0.05, (0, 0.1, -0.02), P['dark'], seg=4, bevel=0, name='chain')
cl = kids('weaver', 'cloth')
if cl:
    line = first('weaver', 'line')
    e = anim('weaver', 'swingx_cloth', (line.x, line.y, line.z))
    for c in cl:
        loc, m = Vector(c.location), c.data.materials[0]
        bpy.data.objects.remove(c, do_unlink=True)
        o = box(e, (0.14, 0.02, 0.4), (loc.x - line.x, 0, loc.z - line.z), P['white'], bevel=0.004, name='cloth')
        o.data.materials[0] = m

# ---------------------------------------------------------------- guild: the gear sign turns, banner flutters
g = first('guild', 'gear')
if g is not None:
    kill('guild', 'gear')
    e = anim('guild', 'spinz_gear', (g.x, g.y - 0.01, g.z))
    cyl(e, 0.09, 0.09, 0.03, (0, 0, 0), P['gold'], seg=8, rot=(math.pi / 2, 0, 0), name='gear', smooth=False)
    for i in range(8):
        a = i * math.pi / 4
        box(e, (0.04, 0.03, 0.04), (math.cos(a) * 0.1, 0, math.sin(a) * 0.1), P['gold'], rot=(0, -a, 0), bevel=0, name='tooth')
    cyl(e, 0.03, 0.03, 0.035, (0, 0, 0), P['dark'], seg=8, rot=(math.pi / 2, 0, 0), name='axle')

# ---------------------------------------------------------------- lab: the dome turns, the dish scans
d = first('lab', 'obsdome')
if d is not None:
    kill('lab', 'obsdome'); kill('lab', 'slit')
    e = anim('lab', 'spiny_dome', (d.x, d.y, d.z))
    ball(e, 0.3, (0, 0, 0), '#B9C2CF', scale=(1, 1, 0.9), seg=16, rings=8, name='obsdome')
    box(e, (0.08, 0.45, 0.06), (0, 0, 0.22), '#2E2633', rot=(0.5, 0, 0), bevel=0.01, name='slit')
d = first('lab', 'dish')
if d is not None:
    kill('lab', 'dish')
    e = anim('lab', 'spiny_dish', (d.x, d.y + 0.05, d.z))
    cyl(e, 0.2, 0.05, 0.08, (0, -0.05, 0), '#E2E7EE', seg=14, rot=(0.6, 0, 0), name='dish')
    cyl(e, 0.01, 0.01, 0.16, (0, -0.1, 0.08), '#7E8A9A', seg=4, rot=(0.6, 0, 0), name='feed')

# ---------------------------------------------------------------- heating plant: a roof ventilator
e = anim('heatplant', 'spiny_vent', (-0.4, 0.45, 0.95))
cyl(bpy.data.objects['heatplant'], 0.06, 0.06, 0.08, (-0.4, 0.45, 0.92), '#7E8A9A', seg=10, name='ventneck')
for i in range(6):
    a = i * math.pi / 3
    box(e, (0.16, 0.02, 0.12), (math.cos(a) * 0.09, math.sin(a) * 0.09, 0.08), '#C9CDD4', rot=(0, 0, a + 0.5), bevel=0, name='vane')
ball(e, 0.08, (0, 0, 0.16), '#B9C2CF', scale=(1, 1, 0.6), name='ventcap')

# ---------------------------------------------------------------- big warehouse (4 x 3)
def bigwarehouse():
    p = root('bigwarehouse')
    box(p, (3.8, 2.8, 0.12), (0, 0, 0.06), P['stone'], bevel=0.03, name='plate')
    for i in range(6):
        box(p, (3.82, 0.04, 0.03), (0, -1.15 + i * 0.46, 0.115), P['stone2'], bevel=0, name='paving')
    hx, hy, hw, hd, hh = -0.45, 0.45, 2.7, 1.6, 1.25
    box(p, (hw, hd, hh), (hx, hy, 0.12 + hh / 2), '#C9583F', bevel=0.03, name='hall')
    for k in range(4):
        box(p, (hw + 0.015, hd + 0.015, 0.025), (hx, hy, 0.35 + k * 0.28), '#B24E37', bevel=0, name='course')
    for x in (hx - hw / 2, hx - hw / 6, hx + hw / 6, hx + hw / 2):
        box(p, (0.1, hd + 0.04, hh + 0.02), (x, hy, 0.12 + hh / 2), P['cream'], bevel=0.01, name='pilaster')
    box(p, (hw + 0.1, hd + 0.1, 0.08), (hx, hy, 0.12 + hh), P['cream'], bevel=0.015, name='cornice')
    gable_fill(p, hw, hd, 0.62, 0.12 + hh + 0.04, '#C9583F', x0=hx, y0=hy)
    roof(p, hw, hd, 0.66, 0.12 + hh + 0.04, '#5A6B7F', thick=0.09, oh=0.14, x0=hx, y0=hy, ridge=P['dark'])
    for x in (hx - 0.8, hx, hx + 0.8):
        box(p, (0.22, 0.3, 0.16), (x, hy + 0.15, 1.95), '#7E8A9A', bevel=0.02, name='roofvent')
    # three loading doors on a raised dock
    fy = hy - hd / 2
    box(p, (hw + 0.2, 0.42, 0.24), (hx, fy - 0.2, 0.24), P['stone2'], bevel=0.02, name='dock')
    for x in (hx - 0.9, hx, hx + 0.9):
        box(p, (0.6, 0.05, 0.72), (x, fy - 0.01, 0.72), '#8A4A3A', bevel=0.012, name='bigdoor')
        box(p, (0.66, 0.04, 0.05), (x, fy - 0.04, 1.09), P['cream'], bevel=0.006, name='doorhead')
        for sx in (-1, 1):
            box(p, (0.04, 0.03, 0.88), (x, fy - 0.04, 0.72), P['cream'], rot=(0, sx * 0.69, 0), bevel=0.004, name='xbrace')
        lantern(p, x + 0.36, fy - 0.06, 1.0)
    cyl(p, 0.22, 0.22, 0.04, (hx, fy, 1.52), P['cream'], seg=18, rot=(math.pi / 2, 0, 0), name='roundframe')
    cyl(p, 0.17, 0.17, 0.05, (hx, fy - 0.005, 1.52), P['glass'], seg=18, rot=(math.pi / 2, 0, 0), kind='G', name='roundglass')
    for y in (hy - 0.4, hy + 0.4):
        window(p, hx + hw / 2, y, 0.75, face='right', w=0.18, h=0.3)
    # goods on the dock
    crate(p, hx - 1.3, fy - 0.3, 0.36, 0.2)
    crate(p, hx - 1.08, fy - 0.3, 0.36, 0.18, '#F0C080')
    for i, x in enumerate((hx + 0.42, hx + 0.6)):
        ball(p, 0.11, (x, fy - 0.3, 0.46), '#F1E0B5', scale=(1, 0.85, 0.75), name='sack')
    # yard on the right: crates, barrels, a cart and the crane
    yx = 1.45
    for i in range(3):
        crate(p, yx + 0.25, 0.85 - i * 0.26, 0.12, 0.24, '#E2A86A' if i % 2 else '#F0C080')
    crate(p, yx + 0.25, 0.72, 0.36, 0.22)
    for i, (x, y) in enumerate(((yx - 0.25, 1.0), (yx - 0.02, 1.05), (yx - 0.14, 0.82))):
        barrel(p, x, y, 0.12)
    box(p, (0.5, 0.32, 0.08), (yx - 0.15, -0.95, 0.3), P['wood'], bevel=0.01, name='cartbed')
    for sy in (-0.18, 0.18):
        cyl(p, 0.11, 0.11, 0.035, (yx - 0.15, -0.95 + sy, 0.18), P['wood2'], seg=12, rot=(math.pi / 2, 0, 0), name='wheel')
    crate(p, yx - 0.25, -0.95, 0.34, 0.18, '#F0C080')
    box(p, (0.3, 0.04, 0.04), (yx + 0.22, -0.95, 0.3), P['wood2'], bevel=0.004, name='cartpole')
    # slewing crane on a stone plinth
    box(p, (0.42, 0.42, 0.24), (yx, -0.2, 0.24), P['stone2'], bevel=0.03, name='plinth')
    e = anim('bigwarehouse', 'spiny_crane', (yx, -0.2, 0.36))
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(e, (0.05, 0.05, 1.5), (sx * 0.1, sy * 0.1, 0.75), '#3E5C8A', bevel=0.006, name='mast')
    for k in range(5):
        box(e, (0.24, 0.24, 0.03), (0, 0, 0.15 + k * 0.32), '#3E5C8A', bevel=0, name='mastring')
    box(e, (0.3, 0.3, 0.22), (0, 0.05, 1.6), P['yellow'], bevel=0.02, name='cab')
    box(e, (0.24, 0.02, 0.12), (0, -0.11, 1.62), P['glass'], kind='G', bevel=0.004, name='cabglass')
    box(e, (0.08, 1.35, 0.08), (0, -0.55, 1.78), P['yellow'], bevel=0.01, name='jib')
    box(e, (0.2, 0.2, 0.18), (0, 0.42, 1.74), P['stone2'], bevel=0.02, name='counterweight')
    cyl(e, 0.007, 0.007, 0.8, (0, -1.15, 1.36), P['dark'], seg=4, bevel=0, name='rope')
    box(e, (0.08, 0.04, 0.05), (0, -1.15, 0.96), P['dark'], bevel=0, name='hook')
    crate(e, 0, -1.15, 0.7, 0.2, '#E9B370')
    flowers(p, -1.75, -1.1, 0.1)
    flowers(p, 0.75, -1.15, 0.09)

bigwarehouse()
