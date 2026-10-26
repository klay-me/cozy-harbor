# Upgrade-line models: fishing pier and port, vegetable field, compost heap, greenhouse, mechanised farm,
# hydroponic farm. Executed at the end of tools/models.py (after models_resize.py), so they are built at
# their final footprint and are not regrouped. Fronts face -Y; the fishery family's front is the water side.

def fishpier():
    """3 x 2: stone quay, a bigger net shed, a crane and a sailing smack."""
    p = root('fishpier')
    box(p, (2.8, 1.8, 0.12), (0, 0.1, 0.06), P['stone2'], bevel=0.03, name='plate')
    # net shed with a hipped red roof
    box(p, (1.3, 0.9, 0.75), (-0.65, 0.4, 0.5), '#D6EEF8', bevel=0.03, name='shed')
    for x in (-1.3, 0.0):
        box(p, (0.07, 0.94, 0.76), (x, 0.4, 0.5), P['white'], bevel=0.01, name='trim')
    gable_fill(p, 1.3, 0.9, 0.45, 0.87, '#D6EEF8', y0=0.4, x0=-0.65)
    roof(p, 1.3, 0.9, 0.47, 0.87, '#E8665A', thick=0.08, oh=0.13, x0=-0.65, y0=0.4, ridge=P['white'])
    door(p, -0.95, -0.06, 0.12, w=0.3, h=0.46, col=P['blue'], arch=False)
    window(p, -0.4, -0.06, 0.55, w=0.22, h=0.22, shutters=P['blue'])
    torus(p, 0.1, 0.03, (-0.65, -0.07, 1.0), P['red'], rot=(math.pi / 2, 0, 0), name='lifebuoy')
    # stone quay out over the water (front)
    box(p, (2.6, 0.7, 0.24), (0.1, -1.1, 0.0), P['stone'], bevel=0.03, name='quay')
    for i in range(6):
        box(p, (0.05, 0.72, 0.245), (-1.1 + i * 0.48, -1.1, 0.0), P['stone2'], bevel=0, name='quayjoint')
    for x in (-0.9, 0.3, 1.2):
        cyl(p, 0.05, 0.06, 0.14, (x, -1.38, 0.18), P['dark'], seg=8, name='bollard')
    # little crane
    box(p, (0.07, 0.07, 1.1), (0.75, -0.55, 0.6), P['beam'], bevel=0.008, name='cranepost')
    box(p, (0.7, 0.06, 0.06), (0.75, -0.85, 1.12), P['beam'], rot=(0, 0, math.pi / 2), bevel=0.006, name='cranearm')
    cyl(p, 0.006, 0.006, 0.45, (0.75, -1.15, 0.88), P['dark'], seg=4, bevel=0, name='rope')
    crate(p, 0.68, -1.2, 0.12, 0.2, '#8CC8EA')
    # fish crates and drying racks on the yard
    for i, (x, y) in enumerate(((0.35, 0.65), (0.6, 0.65), (0.48, 0.65))):
        crate(p, x, y, 0.12 + (0.2 if i == 2 else 0), 0.2, '#9CC7E6' if i % 2 else '#E2A86A')
    for k in range(2):
        x = 0.85 + k * 0.4
        for y in (-0.2, 0.5):
            box(p, (0.04, 0.04, 0.55), (x, y, 0.38), P['beam'], bevel=0.006, name='rackpost')
        box(p, (0.04, 0.74, 0.03), (x, 0.15, 0.64), P['beam'], bevel=0, name='rackbar')
        for i in range(4):
            ball(p, 0.05, (x, -0.1 + i * 0.17, 0.53), '#8CC8EA', scale=(0.5, 0.8, 1.6), name='dryfish')
    # the smack, tied along the quay
    b = root('bob_boat')
    b.parent = p
    b.location = (-0.2, -1.75, -0.05)
    hull = [(-0.75, 0.14), (0.75, 0.14), (0.6, -0.06), (-0.6, -0.06)]
    poly_prism(b, hull, 0.4, (0, 0, 0.0), '#3F6FA8', rot=(0, 0, 0), name='hull')
    box(b, (1.3, 0.34, 0.03), (0, 0, 0.13), P['wood'], bevel=0.006, name='deck')
    box(b, (0.3, 0.26, 0.2), (-0.35, 0, 0.24), P['white'], bevel=0.02, name='cabin')
    cyl(b, 0.02, 0.025, 0.9, (0.15, 0, 0.6), P['beam'], seg=6, name='mast')
    poly_prism(b, [(0, 0), (0.5, 0), (0, 0.7)], 0.02, (0.17, 0, 0.2), P['cloth'], rot=(math.pi / 2, 0, 0), name='sail')

def fishport():
    """3 x 2: brick ice house and cannery-ready warehouse, steel crane, a steam trawler."""
    p = root('fishport')
    box(p, (2.8, 1.8, 0.12), (0, 0.1, 0.06), '#C2BBB0', bevel=0.03, name='plate')
    # brick warehouse with saw-tooth roof
    box(p, (1.6, 1.0, 0.95), (-0.55, 0.4, 0.6), P['brick'], bevel=0.03, name='hall')
    for k in range(4):
        box(p, (1.62, 1.02, 0.02), (-0.55, 0.4, 0.3 + k * 0.2), P['brick2'], bevel=0, name='course')
    sawtooth(p, 1.6, 1.0, 1.07, 3, '#8C7A6B', x0=-0.55, y0=0.4)
    box(p, (0.5, 0.05, 0.6), (-0.9, -0.11, 0.42), '#6E7A86', bevel=0.01, name='rolldoor')
    for i in range(6):
        box(p, (0.5, 0.055, 0.015), (-0.9, -0.115, 0.17 + i * 0.1), '#5B6670', bevel=0, name='rollslat')
    window_row(p, (-0.35, 0.0), -0.1, 0.75, w=0.22, h=0.26)
    box(p, (0.9, 0.06, 0.2), (-0.55, -0.12, 1.2), P['white'], bevel=0.01, name='signboard')
    box(p, (0.3, 0.07, 0.1), (-0.55, -0.14, 1.2), P['blue'], kind='G', bevel=0.005, name='signfish')
    # ice house: round white tank
    cyl(p, 0.28, 0.28, 0.9, (0.6, 0.55, 0.57), '#EEF3F7', seg=16, name='icetank')
    cyl(p, 0.3, 0.3, 0.05, (0.6, 0.55, 1.03), '#9FB3C3', seg=16, name='tanklid')
    chimney(p, 0.15, 0.75, 0.12, 1.25, r=0.08, col='#7E8A9A', cap=P['dark'])
    smoke(p, 0.15, 0.75, 1.4)
    # concrete quay with a steel crane
    box(p, (2.7, 0.75, 0.26), (0.05, -1.12, 0.0), '#BDB6AA', bevel=0.03, name='quay')
    box(p, (2.7, 0.06, 0.06), (0.05, -1.47, 0.16), '#F2C14E', bevel=0, name='quayedge')
    for x in (-1.0, 0.0, 1.0):
        cyl(p, 0.05, 0.06, 0.14, (x, -1.4, 0.2), P['dark'], seg=8, name='bollard')
    box(p, (0.3, 0.3, 0.12), (0.95, -0.95, 0.2), '#F2C14E', bevel=0.01, name='cranebase')
    box(p, (0.1, 0.1, 1.3), (0.95, -0.95, 0.9), '#F2C14E', bevel=0.01, name='cranetower')
    box(p, (0.08, 1.0, 0.08), (0.95, -1.3, 1.52), '#F2C14E', rot=(0.15, 0, 0), bevel=0.006, name='cranejib')
    cyl(p, 0.006, 0.006, 0.6, (0.95, -1.75, 1.3), P['dark'], seg=4, bevel=0, name='rope')
    crate(p, 0.88, -1.82, 0.95, 0.18, '#8CC8EA')
    for x in (0.3, 0.5):
        barrel(p, x, -0.65, 0.12, 0.1, 0.24)
    # the trawler
    b = root('bob_boat')
    b.parent = p
    b.location = (-0.35, -1.85, -0.05)
    hull = [(-0.85, 0.18), (0.9, 0.18), (0.7, -0.08), (-0.75, -0.08)]
    poly_prism(b, hull, 0.46, (0, 0, 0.0), '#2F4E7A', name='hull')
    box(b, (1.6, 0.46, 0.04), (0, 0, 0.17), '#B5523B', bevel=0.008, name='rail')
    box(b, (1.5, 0.38, 0.03), (0, 0, 0.19), P['wood'], bevel=0.006, name='deck')
    box(b, (0.45, 0.32, 0.3), (-0.35, 0, 0.36), P['white'], bevel=0.02, name='wheelhouse')
    box(b, (0.46, 0.02, 0.1), (-0.35, -0.16, 0.42), P['glass'], kind='G', bevel=0, name='bridgeglass')
    cyl(b, 0.06, 0.07, 0.35, (-0.05, 0, 0.55), '#E8665A', seg=10, name='funnel')
    cyl(b, 0.02, 0.02, 0.8, (0.45, 0, 0.6), P['dark'], seg=6, name='mast')
    box(b, (0.02, 0.5, 0.02), (0.45, 0, 0.85), P['dark'], bevel=0, name='boom')

def vegfield():
    """3 x 3: long beds, a little irrigation canal and a pump, a covered packing table."""
    p = root('vegfield')
    box(p, (2.85, 2.85, 0.06), (0, 0, 0.03), '#B98A5A', bevel=0.02, name='soil')
    crops = [('#8FD16A', 'cab'), ('#F2766B', 'tom'), ('#F2A541', 'car'), ('#6DB36A', 'let'), ('#A487CF', 'cab'), ('#8FD16A', 'let')]
    for r in range(6):
        y = -1.15 + r * 0.4
        box(p, (2.0, 0.26, 0.08), (-0.35, y, 0.08), '#9B6B44', bevel=0.02, name='bed')
        col, kind = crops[r]
        for i in range(8):
            x = -1.25 + i * 0.26
            if kind == 'tom':
                cyl(p, 0.012, 0.012, 0.34, (x, y, 0.25), P['wood2'], seg=4, name='stake')
                ball(p, 0.07, (x, y, 0.21), P['leaf'], kind='L', name='vine')
                ball(p, 0.035, (x + 0.03, y - 0.04, 0.23), col, name='tomato')
            elif kind == 'car':
                ball(p, 0.05, (x, y, 0.15), '#6DB36A', scale=(0.6, 0.6, 1.4), kind='L', name='tops')
            else:
                ball(p, 0.075, (x, y, 0.15), col, scale=(1, 1, 0.75), name='cabbage')
    # irrigation canal down the right side, with a hand pump
    box(p, (0.16, 2.6, 0.05), (0.85, 0.0, 0.07), '#7E8A9A', bevel=0.01, name='canal')
    box(p, (0.1, 2.55, 0.02), (0.85, 0.0, 0.1), P['water'], bevel=0, name='canalwater')
    box(p, (0.2, 0.2, 0.3), (0.85, 1.2, 0.2), P['stone2'], bevel=0.02, name='pumpbase')
    cyl(p, 0.04, 0.04, 0.3, (0.85, 1.2, 0.48), P['metal'], seg=8, name='pump')
    box(p, (0.3, 0.03, 0.03), (0.95, 1.2, 0.6), P['metal'], rot=(0, -0.3, 0), bevel=0, name='pumphandle')
    # packing shed with crates of vegetables
    for x in (1.0, 1.35):
        for y in (-1.1, -0.45):
            box(p, (0.05, 0.05, 0.55), (x, y, 0.3), P['beam'], bevel=0.006, name='post')
    roof(p, 0.5, 0.8, 0.18, 0.58, P['green'], thick=0.05, oh=0.06, x0=1.18, y0=-0.78, rot_z=math.pi / 2)
    for i, col in enumerate(('#8FD16A', '#F2766B', '#F2A541')):
        crate(p, 1.18, -1.05 + i * 0.25, 0.06, 0.2)
        for k in range(3):
            ball(p, 0.04, (1.12 + k * 0.06, -1.05 + i * 0.25, 0.3), col, name='harvest')
    cyl(p, 0.1, 0.08, 0.16, (1.2, 0.3, 0.1), '#D9B27A', seg=10, name='basket')
    flowers(p, 1.2, 0.8, 0.1)

def compost():
    """2 x 2: three slatted bins of dark compost, a wheelbarrow and a pitchfork."""
    p = root('compost')
    box(p, (1.75, 1.75, 0.06), (0, 0, 0.03), '#A88B66', bevel=0.02, name='ground')
    for i, (x, h) in enumerate(((-0.52, 0.42), (0.0, 0.34), (0.52, 0.24))):
        y = 0.35
        for sx in (-0.23, 0.23):
            box(p, (0.04, 0.5, 0.42), (x + sx, y, 0.27), P['wood'], bevel=0.006, name='binside')
        box(p, (0.5, 0.04, 0.42), (x, y + 0.25, 0.27), P['wood'], bevel=0.006, name='binback')
        for k in range(3):
            box(p, (0.5, 0.03, 0.05), (x, y - 0.25, 0.12 + k * 0.12), P['wood2'], bevel=0.004, name='slat')
        ball(p, 0.24, (x, y, 0.06 + h * 0.5), ['#5A3F2B', '#6E4E34', '#8A6A3E'][i], scale=(1, 1, h * 2.2), seg=10, rings=6, name='heap')
        if i == 2:
            for k in range(4):
                ball(p, 0.05, (x - 0.12 + k * 0.08, y - 0.05, 0.3), ['#E9B94A', '#D47B3F', '#8FD16A', '#C9583F'][k], name='leaves')
    # wheelbarrow
    box(p, (0.36, 0.26, 0.12), (0.35, -0.4, 0.22), '#6FA8DC', rot=(0.0, 0.2, 0), bevel=0.03, name='barrow')
    ball(p, 0.14, (0.35, -0.4, 0.27), '#5A3F2B', scale=(1.1, 0.8, 0.4), name='load')
    cyl(p, 0.08, 0.08, 0.04, (0.12, -0.4, 0.09), P['dark'], seg=12, rot=(math.pi / 2, 0, 0), name='wheel')
    for y in (-0.5, -0.3):
        cyl(p, 0.015, 0.015, 0.4, (0.62, y, 0.22), P['wood2'], seg=5, rot=(0, 1.2, 0), name='barrowarm')
    # pitchfork leaning on a bin
    cyl(p, 0.015, 0.015, 0.75, (-0.75, -0.05, 0.38), P['wood2'], seg=5, rot=(0.25, 0, 0), name='forkhandle')
    for k in range(3):
        cyl(p, 0.008, 0.008, 0.14, (-0.78 + k * 0.03, -0.14, 0.73), P['metal'], seg=4, rot=(0.25, 0, 0), name='tine')
    cyl(p, 0.16, 0.13, 0.2, (-0.5, -0.5, 0.14), '#D9B27A', seg=12, name='basket')

def greenhouse():
    """3 x 3: a glasshouse with a boiler room (smoke in winter) and rows of plants inside."""
    p = root('greenhouse')
    box(p, (2.85, 2.85, 0.1), (0, 0, 0.05), '#D3CABC', bevel=0.03, name='plate')
    L, D, H = 2.2, 1.8, 0.75     # glass box (length along X, depth along Y, wall height)
    x0, y0 = -0.15, 0.15
    box(p, (L, D, 0.12), (x0, y0, 0.16), P['stone'], bevel=0.02, name='sill')
    # plants inside, visible through the glass
    for r in range(3):
        y = y0 - 0.55 + r * 0.55
        box(p, (L - 0.3, 0.3, 0.12), (x0, y, 0.27), '#9B6B44', bevel=0.015, name='bench')
        for i in range(8):
            x = x0 - L / 2 + 0.3 + i * 0.23
            col = ['#6DB36A', '#8FD16A', '#F2766B'][(i + r) % 3]
            ball(p, 0.085, (x, y, 0.42), P['leaf'] if col != '#F2766B' else '#6DB36A', kind='L', name='plant')
            if col == '#F2766B':
                ball(p, 0.035, (x + 0.03, y - 0.06, 0.45), col, name='tomato')
    # glass walls and roof: white frame with pale blue panes (glow a little at night)
    glass = '#CFE8F2'
    for sy in (-1, 1):
        box(p, (L, 0.03, H), (x0, y0 + sy * D / 2, 0.22 + H / 2), glass, bevel=0.004, name='pane')
    for sx in (-1, 1):
        box(p, (0.03, D, H), (x0 + sx * L / 2, y0, 0.22 + H / 2), glass, bevel=0.004, name='pane')
    gable_fill(p, 0.03, D, 0.55, 0.22 + H, glass, y0=y0, x0=x0 - L / 2)
    gable_fill(p, 0.03, D, 0.55, 0.22 + H, glass, y0=y0, x0=x0 + L / 2)
    a = math.atan2(0.55, D / 2)
    side = math.hypot(0.55, D / 2)
    for sy in (-1, 1):
        box(p, (L + 0.04, side, 0.025), (x0, y0 + sy * D / 4, 0.22 + H + 0.275), '#DDF0F7', rot=(sy * a, 0, 0), bevel=0.003, kind='G', name='roofglass')
    for i in range(7):
        x = x0 - L / 2 + i * L / 6
        for sy in (-1, 1):
            box(p, (0.035, 0.035, H), (x, y0 + sy * D / 2, 0.22 + H / 2), P['white'], bevel=0.004, name='mullion')
            box(p, (0.035, side, 0.035), (x, y0 + sy * D / 4, 0.22 + H + 0.29), P['white'], rot=(sy * a, 0, 0), bevel=0.004, name='rafter')
    for sy in (-1, 1):
        box(p, (L + 0.04, 0.04, 0.04), (x0, y0 + sy * D / 2, 0.22 + H), P['white'], bevel=0.004, name='eave')
    box(p, (L + 0.06, 0.05, 0.05), (x0, y0, 0.22 + H + 0.55), P['white'], bevel=0.004, name='ridge')
    door(p, x0 - 0.5, y0 - D / 2 - 0.01, 0.22, w=0.3, h=0.5, col='#CFE8F2', arch=False)
    # boiler room with a brick chimney on the right
    box(p, (0.45, 0.6, 0.6), (1.15, 0.85, 0.4), P['brick'], bevel=0.02, name='boiler')
    roof(p, 0.45, 0.6, 0.2, 0.7, '#8C7A6B', thick=0.05, oh=0.05, x0=1.15, y0=0.85)
    chimney(p, 1.25, 1.0, 0.7, 0.55, r=0.07, col=P['brick2'], square=True)
    smoke(p, 1.25, 1.0, 1.3)
    for i in range(3):
        ball(p, 0.06, (1.05 + i * 0.05, 0.45, 0.16), P['dark'], name='coal')
    flowers(p, -1.15, -1.15, 0.1)
    flowers(p, 0.9, -1.15, 0.1, [P['white'], P['yellow']])

def mechfarm():
    """4 x 4: a metal barn, twin silos, a red tractor, and a big wheat field."""
    p = root('mechfarm')
    box(p, (3.85, 3.85, 0.06), (0, 0, 0.03), '#B9D38A', bevel=0.02, name='meadow')
    # wheat field (front two thirds)
    box(p, (3.6, 2.2, 0.08), (0, -0.7, 0.05), P['soil'], bevel=0.02, name='field')
    for r in range(7):
        y = -1.65 + r * 0.31
        box(p, (3.45, 0.05, 0.02), (0, y + 0.15, 0.095), '#93663E', bevel=0, name='furrow')
        for i in range(14):
            x = -1.6 + i * 0.245 + (0.06 if r % 2 else 0)
            if r < 2 and i > 8:
                continue      # the harvested corner
            h = 0.26 + random.random() * 0.06
            cyl(p, 0.075, 0.0, h, (x, y, 0.09 + h / 2), P['wheat'] if (i + r) % 3 else '#E5B53E', seg=6, name='wheat', smooth=False)
    for i in range(3):
        cyl(p, 0.13, 0.13, 0.22, (0.75 + i * 0.32, -1.55, 0.15), P['hay'], seg=14, rot=(math.pi / 2, 0, 0.2 * i), name='bale')
    # metal barn
    box(p, (1.5, 1.0, 0.8), (-0.95, 1.2, 0.45), '#C9D2DA', bevel=0.02, name='barn')
    for i in range(9):
        box(p, (0.02, 1.02, 0.8), (-1.65 + i * 0.175, 1.2, 0.45), '#AFBAC5', bevel=0, name='rib')
    cyl(p, 0.5, 0.5, 1.5, (-0.95, 1.2, 0.85), '#8FA2B4', seg=20, rot=(0, math.pi / 2, 0), name='vault')
    box(p, (0.6, 0.05, 0.6), (-0.95, 0.69, 0.4), '#E8665A', bevel=0.01, name='barndoor')
    box(p, (0.02, 0.055, 0.6), (-0.95, 0.685, 0.4), P['white'], bevel=0, name='doorline')
    # twin silos
    for k, x in enumerate((0.45, 0.95)):
        cyl(p, 0.26, 0.26, 1.5, (x, 1.35, 0.8), '#E8E2D6', seg=16, name='silo')
        ball(p, 0.26, (x, 1.35, 1.55), '#6FA8DC', scale=(1, 1, 0.7), name='dome')
        for z in (0.35, 0.8, 1.25):
            cyl(p, 0.27, 0.27, 0.03, (x, 1.35, z), P['stone2'], seg=16, bevel=0, name='band')
    box(p, (0.6, 0.06, 0.06), (0.7, 1.35, 1.45), P['metal'], bevel=0, name='conveyor')
    # tractor
    t = (1.25, 0.15)
    box(p, (0.5, 0.26, 0.2), (t[0], t[1], 0.25), '#D9443A', bevel=0.03, name='tractorbody')
    box(p, (0.22, 0.24, 0.24), (t[0] - 0.12, t[1], 0.47), '#D9443A', bevel=0.02, name='cab')
    box(p, (0.2, 0.25, 0.14), (t[0] - 0.12, t[1], 0.48), P['glass'], kind='G', bevel=0.005, name='cabglass')
    for (dx, r) in ((-0.15, 0.15), (0.2, 0.09)):
        for dy in (-0.16, 0.16):
            cyl(p, r, r, 0.08, (t[0] + dx, t[1] + dy, r), P['dark'], seg=14, rot=(math.pi / 2, 0, 0), name='tyre')
    cyl(p, 0.025, 0.03, 0.2, (t[0] + 0.15, t[1] + 0.06, 0.45), P['dark'], seg=6, name='exhaust')
    # fuel tank and a fence
    cyl(p, 0.16, 0.16, 0.5, (1.55, 1.3, 0.3), '#7CC36A', seg=14, rot=(0, math.pi / 2, 0), name='tank')
    fence(p, -1.85, 0.48, 1.85, 0.48, P['white'], n=18)

def hydroponic():
    """3 x 3: a white modern block with glass floors of glowing grow lights and roof solar panels."""
    p = root('hydroponic')
    box(p, (2.85, 2.85, 0.12), (0, 0, 0.06), '#E2DDD3', bevel=0.03, name='plate')
    W_, D_ = 2.3, 1.7
    y0 = 0.3
    floors = 3
    for f in range(floors):
        z = 0.12 + f * 0.55
        box(p, (W_, D_, 0.08), (0, y0, z + 0.04), '#F4F1EA', bevel=0.02, name='slab')
        # glass band with grow lights behind
        box(p, (W_ - 0.1, D_ - 0.1, 0.45), (0, y0, z + 0.31), '#BFD9E6', bevel=0.01, name='glassband')
        for i in range(9):
            x = -W_ / 2 + 0.2 + i * 0.235
            box(p, (0.16, 0.05, 0.35), (x, y0 - D_ / 2 + 0.03, z + 0.3), '#B98BE0' if (i + f) % 2 else '#F08AC8', kind='G', bevel=0.004, name='growlight')
            ball(p, 0.06, (x, y0 - D_ / 2 + 0.09, z + 0.16), '#6DB36A', kind='L', name='leafy')
        for x in (-W_ / 2, W_ / 2):
            box(p, (0.08, D_, 0.5), (x, y0, z + 0.3), '#F4F1EA', bevel=0.01, name='endwall')
    top = 0.12 + floors * 0.55
    box(p, (W_ + 0.06, D_ + 0.06, 0.1), (0, y0, top + 0.05), '#F4F1EA', bevel=0.02, name='roof')
    for c in range(4):
        for r in range(2):
            box(p, (0.46, 0.55, 0.03), (-0.8 + c * 0.53, y0 - 0.35 + r * 0.7, top + 0.22), '#2F4E7A', rot=(0.35, 0, 0), bevel=0.006, name='panel')
    # water tanks and pipes on the right
    for k in range(2):
        cyl(p, 0.18, 0.18, 0.7, (1.2, -0.6 + k * 0.45, 0.47), '#7FB8D6', seg=14, name='watertank')
        cyl(p, 0.19, 0.19, 0.04, (1.2, -0.6 + k * 0.45, 0.83), '#5D8FD0', seg=14, bevel=0, name='tanklid')
    cyl(p, 0.03, 0.03, 0.5, (1.0, -0.37, 0.75), P['metal'], seg=8, rot=(0, math.pi / 2, 0), name='pipe')
    door(p, -0.6, y0 - D_ / 2 - 0.02, 0.12, w=0.34, h=0.42, col=P['glass'], arch=False)
    box(p, (0.7, 0.06, 0.16), (0.3, y0 - D_ / 2 - 0.03, top - 0.12), P['white'], bevel=0.01, name='signboard')
    box(p, (0.5, 0.07, 0.08), (0.3, y0 - D_ / 2 - 0.05, top - 0.12), '#7CC36A', kind='G', bevel=0.004, name='signleaf')
    flowers(p, -1.2, -1.2, 0.1)
    flowers(p, 1.2, -1.2, 0.1, [P['white'], P['purple']])

for f in (fishpier, fishport, vegfield, compost, greenhouse, mechfarm, hydroponic):
    f()
