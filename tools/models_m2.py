# Upgrade-line models. Executed at the end of tools/models.py (after models_resize.py), built natively at
# their final footprint and never regrouped. Every level of a line shares one footprint, so the first level
# fills the spare ground with a yard that the later levels build over:
#   fishery -> fishpier -> fishport      4 x 3, the front (-Y) is the water side; quays and boats hang out over it
#   garden -> vegfield                   4 x 3
#   greenhouse -> hydroponic             3 x 3
#   herbalist -> clinic -> hospital      3 x 3
#   farm -> mechfarm                     4 x 4
# Scale follows the houses: doors 0.42 high, windows 0.24, a storey 0.6-0.7.

def part(p, name, loc):
    """an animated sub-group (see tools/models_anim.py): children are placed relative to the pivot"""
    e = bpy.data.objects.new(name, None)
    COL.objects.link(e)
    e.parent = p
    e.location = loc
    return e

def plate(p, w, h, col, z=0.1):
    box(p, (w - 0.2, h - 0.2, z), (0, 0, z / 2), col, bevel=0.03, name='plate')

def piling(p, x, y, h=0.7, top=0.16, r=0.05, col=None):
    cyl(p, r, r, h, (x, y, top - h / 2), col or P['beam'], seg=8, name='piling')

def jetty(p, x, y0, y1, w=0.5, z=0.16):
    """a plank jetty from y0 (shore) out to y1 (water), with pilings"""
    L = abs(y1 - y0)
    yc = (y0 + y1) / 2
    box(p, (w, L, 0.06), (x, yc, z), P['wood'], bevel=0.01, name='dock')
    n = int(L / 0.16)
    for i in range(n):
        box(p, (w + 0.02, 0.014, 0.065), (x, y0 - (i + 0.5) * L / n, z + 0.003), P['wood2'], bevel=0, name='plank')
    for k in range(int(L / 0.55) + 1):
        yy = y0 - 0.15 - k * 0.55
        if yy < y1 + 0.05:
            yy = y1 + 0.08
        for sx in (-1, 1):
            piling(p, x + sx * (w / 2 - 0.04), yy, 0.75, z + 0.1)

def fish_rack(p, x, y, length=0.8, h=0.6, cols=None):
    """a drying rack along X; the row of fish hangs from a pivot on the bar and sways in the wind"""
    cols = cols or ['#F5A35C', '#9CC7E6', '#F5A35C', '#B9D9EF', '#E9B94A', '#9CC7E6']
    for sx in (-1, 1):
        box(p, (0.04, 0.04, h), (x + sx * length / 2, y, h / 2 + 0.1), P['beam'], bevel=0.006, name='rackpost')
    box(p, (length + 0.1, 0.035, 0.035), (x, y, h + 0.1), P['beam'], bevel=0.004, name='rackbar')
    e = part(p, 'swingx_fish', (x, y, h + 0.08))
    n = max(3, int(length / 0.14))
    for i in range(n):
        fx = -length / 2 + 0.08 + i * (length - 0.16) / (n - 1)
        cyl(e, 0.004, 0.004, 0.08, (fx, 0, -0.04), P['dark'], seg=3, bevel=0, name='string')
        ball(e, 0.045, (fx, 0, -0.14), cols[i % len(cols)], scale=(0.55, 0.35, 1.6), name='fish')

def net_frame(p, x, y, w=0.7, h=0.55, col='#7FA88C'):
    """two poles with a fishing net draped between them, swaying from the top rail"""
    for sx in (-1, 1):
        cyl(p, 0.022, 0.026, h + 0.15, (x + sx * w / 2, y, (h + 0.15) / 2 + 0.1), P['beam'], seg=6, name='netpole')
    box(p, (w + 0.08, 0.03, 0.03), (x, y, h + 0.22), P['beam'], bevel=0.004, name='netrail')
    e = part(p, 'swingx_nets', (x, y, h + 0.2))
    box(e, (w - 0.06, 0.012, h - 0.12), (0, 0, -(h - 0.12) / 2), col, bevel=0, name='net')
    for i in range(5):
        box(e, (0.012, 0.016, h - 0.12), (-w / 2 + 0.06 + i * (w - 0.12) / 4, 0, -(h - 0.12) / 2), shade(col, 0.75), bevel=0, name='netcord')
    for k in range(3):
        box(e, (w - 0.06, 0.016, 0.012), (0, 0, -0.08 - k * (h - 0.2) / 2), shade(col, 0.75), bevel=0, name='netcord')
    for i in range(3):
        ball(e, 0.03, (-w / 3 + i * w / 3, -0.01, -(h - 0.12)), '#F2C14E', name='float')

def rowboat(p, x, y, z, col, rz=0.0, name='hull'):
    hull = [(-0.36, 0.08), (0.36, 0.08), (0.28, -0.04), (-0.28, -0.04)]
    poly_prism(p, hull, 0.28, (x, y, z), col, rot=(0, 0, rz), name=name)
    c, s = math.cos(rz), math.sin(rz)
    box(p, (0.6, 0.22, 0.03), (x, y, z + 0.07), P['wood'], rot=(0, 0, rz + math.pi / 2), bevel=0.006, name='boatfloor')
    box(p, (0.06, 0.24, 0.035), (x, y, z + 0.1), P['wood2'], rot=(0, 0, rz + math.pi / 2), bevel=0.006, name='seat')

def rope_coil(p, x, y, z=0.12, r=0.09):
    for k in range(2):
        torus(p, r - k * 0.03, 0.018, (x, y, z + 0.02 + k * 0.03), '#D9B27A', seg=14, rseg=6, name='rope')

def fishbasket(p, x, y, z=0.12):
    cyl(p, 0.09, 0.07, 0.12, (x, y, z + 0.06), '#C9A56A', seg=10, name='basket')
    for k in range(3):
        ball(p, 0.035, (x - 0.03 + k * 0.03, y, z + 0.13), ['#9CC7E6', '#F5A35C', '#B9D9EF'][k], scale=(1.4, 0.6, 0.6), name='catch')

def lamp_post(p, x, y, z=0.1, h=0.8, col=None):
    cyl(p, 0.02, 0.025, h, (x, y, z + h / 2), col or P['dark'], seg=6, name='lamppost')
    box(p, (0.1, 0.1, 0.12), (x, y, z + h + 0.06), '#FFE29A', bevel=0.015, kind='G', name='lamplight')
    cyl(p, 0.09, 0.0, 0.07, (x, y, z + h + 0.15), col or P['dark'], seg=4, rot=(0, 0, math.pi / 4), name='lamptop', smooth=False)

def gull(p, x, y, z):
    ball(p, 0.04, (x, y, z), P['white'], scale=(1.4, 0.8, 0.8), name='gull')
    ball(p, 0.022, (x + 0.05, y, z + 0.03), P['white'], name='gullhead')
    cyl(p, 0.008, 0.0, 0.03, (x + 0.075, y, z + 0.03), P['orange'], seg=4, rot=(0, math.pi / 2, 0), name='beak')

# ---------------------------------------------------------------- fishing line (4 x 3, water at -Y)
def fishery():
    """Level 1, wood: a fisher's cottage, a smokehouse, drying racks and nets, a jetty with a rowboat."""
    p = root('fishery')
    plate(p, 4, 3, '#E3D3AE')
    box(p, (3.8, 0.35, 0.08), (0, -1.22, 0.06), '#EADBB4', bevel=0.02, name='sand')
    # cottage (back left)
    cx, cy = -1.05, 0.62
    box(p, (1.3, 0.95, 0.12), (cx, cy, 0.16), P['stone'], bevel=0.03, name='base')
    box(p, (1.15, 0.8, 0.6), (cx, cy, 0.52), '#D6EEF8', bevel=0.03, name='walls')
    for x in (cx - 0.575, cx + 0.575):
        box(p, (0.06, 0.84, 0.62), (x, cy, 0.52), P['white'], bevel=0.01, name='trim')
    gable_fill(p, 1.15, 0.8, 0.42, 0.82, '#D6EEF8', y0=cy, x0=cx)
    roof(p, 1.15, 0.8, 0.44, 0.82, '#EF7F63', thick=0.08, oh=0.13, x0=cx, y0=cy, ridge=P['white'])
    door(p, cx - 0.25, cy - 0.41, 0.22, col=P['blue'])
    window(p, cx + 0.22, cy - 0.41, 0.58, shutters=P['blue'], box_col=P['pink'])
    window(p, cx + 0.585, cy, 0.58, face='right', shutters=P['blue'])
    torus(p, 0.09, 0.028, (cx + 0.22, cy - 0.43, 0.9), P['red'], rot=(math.pi / 2, 0, 0), name='lifebuoy')
    box(p, (0.16, 0.16, 0.4), (cx - 0.3, cy + 0.2, 1.25), P['stone2'], bevel=0.02, name='chimney')
    smoke(p, cx - 0.3, cy + 0.2, 1.5)
    # smokehouse (a small plank hut with a stove pipe)
    sx, sy = 0.05, 0.95
    box(p, (0.55, 0.5, 0.48), (sx, sy, 0.34), P['wood'], bevel=0.02, name='smokehut')
    for k in range(4):
        box(p, (0.56, 0.51, 0.015), (sx, sy, 0.16 + k * 0.11), P['wood2'], bevel=0, name='board')
    roof(p, 0.55, 0.5, 0.18, 0.58, '#8C7A6B', thick=0.05, oh=0.06, x0=sx, y0=sy)
    box(p, (0.2, 0.04, 0.3), (sx, sy - 0.26, 0.27), P['beam'], bevel=0.006, name='hutdoor')
    chimney(p, sx + 0.16, sy + 0.1, 0.7, 0.3, r=0.04, col='#6E6E78', cap=P['dark'], i=1)
    # racks and nets in the yard
    fish_rack(p, 0.95, 0.85, 0.9)
    fish_rack(p, 0.95, 0.3, 0.9)
    net_frame(p, -0.15, 0.15, 0.7)
    # an upturned boat on trestles, being tarred
    for y in (-1.15, -0.55):
        box(p, (0.3, 0.05, 0.2), (-1.5, y, 0.2), P['beam'], bevel=0.006, name='trestle')
    poly_prism(p, [(-0.14, 0.04), (0.14, 0.04), (0.11, -0.08), (-0.11, -0.08)], 0.8, (-1.5, -0.85, 0.34), '#3F6FA8', rot=(math.pi, 0, math.pi / 2), name='upturned')
    cyl(p, 0.07, 0.07, 0.1, (-1.1, -1.0, 0.15), P['dark'], seg=10, name='tarpot')
    # barrels, baskets and rope on the shore
    barrel(p, 1.55, -0.2, 0.1, 0.1, 0.26)
    barrel(p, 1.32, -0.28, 0.1, 0.1, 0.26)
    fishbasket(p, 0.35, -0.75)
    fishbasket(p, 0.15, -0.95)
    rope_coil(p, 1.25, -0.95)
    crate(p, 1.6, -0.8, 0.1, 0.2, '#E2A86A')
    fence(p, -1.85, 1.35, 1.85, 1.35, P['wood'], n=16)
    # jetty and rowboat out on the water
    jetty(p, 0.75, -1.3, -2.35, w=0.5)
    lamp_post(p, 0.98, -2.2, 0.19, 0.55, P['beam'])
    b = part(p, 'bob_boat', (1.35, -1.95, -0.04))
    rowboat(b, 0, 0, 0, P['red'])
    cyl(b, 0.01, 0.01, 0.5, (0.04, 0.05, 0.18), P['wood2'], seg=4, rot=(0.9, 0, 0), name='oar')
    gull(p, 0.62, -2.3, 0.26)

def fishpier():
    """Level 2, stone: a two-storey net loft, a brick smokehouse, a stone quay with a wooden crane and a smack."""
    p = root('fishpier')
    plate(p, 4, 3, '#CFC6B6', 0.12)
    # net loft (back left): stone ground floor, timber upper floor
    cx, cy = -0.95, 0.6
    box(p, (1.5, 1.0, 0.55), (cx, cy, 0.4), P['stone2'], bevel=0.03, name='ground')
    box(p, (1.6, 1.1, 0.06), (cx, cy, 0.7), P['beam'], bevel=0.012, name='floorbeam')
    box(p, (1.5, 1.0, 0.55), (cx, cy, 1.0), '#D6EEF8', bevel=0.03, name='loft')
    for x in (-0.7, -0.25, 0.25, 0.7):
        box(p, (0.05, 0.03, 0.55), (cx + x, cy - 0.51, 1.0), P['beam'], bevel=0.006, name='timber')
    gable_fill(p, 1.5, 1.0, 0.5, 1.28, '#D6EEF8', y0=cy, x0=cx)
    roof(p, 1.5, 1.0, 0.52, 1.28, '#E8665A', thick=0.08, oh=0.13, x0=cx, y0=cy, ridge=P['white'])
    box(p, (0.5, 0.05, 0.46), (cx - 0.35, cy - 0.5, 0.36), P['beam'], bevel=0.01, name='bigdoor')
    for k in range(4):
        box(p, (0.012, 0.055, 0.44), (cx - 0.53 + k * 0.12, cy - 0.505, 0.36), P['wood2'], bevel=0, name='doorboard')
    window(p, cx + 0.35, cy - 0.51, 0.42, shutters=P['blue'])
    window_row(p, (cx - 0.4, cx + 0.05, cx + 0.45), cy - 0.51, 1.0, shutters=P['blue'])
    box(p, (0.06, 0.06, 0.4), (cx + 0.62, cy - 0.62, 1.32), P['beam'], rot=(0.6, 0, 0), bevel=0.006, name='hoistbeam')
    cyl(p, 0.005, 0.005, 0.45, (cx + 0.62, cy - 0.78, 1.18), P['dark'], seg=4, bevel=0, name='rope')
    torus(p, 0.1, 0.03, (cx, cy - 0.52, 1.43), P['red'], rot=(math.pi / 2, 0, 0), name='lifebuoy')
    # brick smokehouse
    sx, sy = 0.55, 0.95
    box(p, (0.7, 0.55, 0.65), (sx, sy, 0.45), P['brick'], bevel=0.02, name='smokehouse')
    roof(p, 0.7, 0.55, 0.22, 0.77, '#8C7A6B', thick=0.06, oh=0.06, x0=sx, y0=sy)
    door(p, sx - 0.12, sy - 0.29, 0.12, w=0.22, h=0.38, col=P['beam'], arch=False)
    chimney(p, sx + 0.2, sy + 0.1, 0.8, 0.45, r=0.08, col=P['brick2'], square=True, i=1)
    fish_rack(p, 1.45, 0.75, 0.6)
    net_frame(p, 0.2, 0.15, 0.7, col='#6F9BB5')
    # yard: fish crates, salt barrels, a hand cart
    for i, (x, y, z) in enumerate(((1.1, 0.05, 0.12), (1.35, 0.05, 0.12), (1.22, 0.05, 0.34), (1.6, 0.1, 0.12))):
        crate(p, x, y, z, 0.2, ['#9CC7E6', '#E2A86A'][i % 2])
    for x in (-0.15, 0.05):
        barrel(p, x, -0.55, 0.12, 0.1, 0.26)
    box(p, (0.36, 0.24, 0.06), (0.65, -0.5, 0.25), P['wood'], bevel=0.01, name='cartbed')
    for sy_ in (-0.14, 0.14):
        cyl(p, 0.1, 0.1, 0.03, (0.65, -0.5 + sy_, 0.18), P['wood2'], seg=12, rot=(math.pi / 2, 0, 0), name='wheel')
    fishbasket(p, 0.65, -0.5, 0.22)
    # stone quay along the whole water front, a pier out into the water
    box(p, (3.95, 0.7, 0.3), (0, -1.55, 0.0), P['stone'], bevel=0.03, name='quay')
    for i in range(9):
        box(p, (0.03, 0.72, 0.305), (-1.75 + i * 0.44, -1.55, 0.0), P['stone2'], bevel=0, name='quayjoint')
    box(p, (0.7, 0.9, 0.3), (1.25, -2.3, 0.0), P['stone'], bevel=0.03, name='pier')
    for x in (-1.6, -0.6, 0.4, 1.0, 1.5):
        cyl(p, 0.05, 0.06, 0.14, (x, -1.86 if x < 0.9 else -2.7, 0.2), P['dark'], seg=8, name='bollard')
    rope_coil(p, -1.2, -1.45, 0.15)
    lamp_post(p, -1.75, -1.4, 0.15, 0.7)
    lamp_post(p, 1.5, -2.55, 0.15, 0.7)
    # wooden crane on the pier: slews between the smack and the quay
    e = part(p, 'spiny_crane', (1.1, -2.1, 0.15))
    cyl(e, 0.11, 0.13, 0.1, (0, 0, 0.05), P['stone2'], seg=10, name='cranebase')
    cyl(e, 0.045, 0.055, 1.1, (0, 0, 0.6), P['wood2'], seg=8, name='crane')
    box(e, (0.06, 0.85, 0.06), (0, -0.35, 1.12), P['wood2'], bevel=0.01, name='boom')
    box(e, (0.03, 0.5, 0.03), (0, -0.2, 0.92), P['wood2'], rot=(-0.62, 0, 0), bevel=0.004, name='brace')
    box(e, (0.14, 0.14, 0.12), (0, 0.13, 1.1), P['stone2'], bevel=0.015, name='counterweight')
    cyl(e, 0.006, 0.006, 0.4, (0, -0.72, 0.9), P['dark'], seg=4, bevel=0, name='rope')
    crate(e, 0, -0.72, 0.56, 0.16, '#9CC7E6')
    # the smack, tied along the quay
    b = part(p, 'bob_boat', (-0.4, -2.25, -0.05))
    hull = [(-0.75, 0.14), (0.75, 0.14), (0.6, -0.06), (-0.6, -0.06)]
    poly_prism(b, hull, 0.4, (0, 0, 0.0), '#3F6FA8', rot=(0, 0, math.pi / 2), name='hull')
    box(b, (1.3, 0.34, 0.03), (0, 0, 0.13), P['wood'], bevel=0.006, name='deck')
    box(b, (1.42, 0.42, 0.04), (0, 0, 0.15), P['white'], bevel=0.008, name='rail')
    box(b, (0.3, 0.26, 0.2), (-0.35, 0, 0.24), P['white'], bevel=0.02, name='cabin')
    box(b, (0.32, 0.28, 0.04), (-0.35, 0, 0.36), P['red'], bevel=0.01, name='cabinroof')
    cyl(b, 0.02, 0.025, 0.95, (0.15, 0, 0.62), P['beam'], seg=6, name='mast')
    poly_prism(b, [(0, 0), (-0.55, 0), (0, 0.75)], 0.02, (0.17, 0, 0.22), P['cloth'], rot=(0, 0, math.pi / 2), name='sail')
    for k in range(3):
        crate(b, 0.3 + k * 0.12, 0.08 * (k % 2), 0.15, 0.1, '#9CC7E6')
    gull(p, -1.3, -1.55, 0.36)
    gull(p, 1.55, -2.15, 0.36)

def fishport():
    """Level 3, brick and steel: a cold store, an ice tower, a concrete quay with a steel crane and a steam trawler."""
    p = root('fishport')
    plate(p, 4, 3, '#C9C3B8', 0.12)
    # cold store with a saw-tooth roof (back left)
    cx, cy = -0.8, 0.6
    box(p, (2.0, 1.1, 1.0), (cx, cy, 0.62), P['brick'], bevel=0.03, name='hall')
    for k in range(4):
        box(p, (2.02, 1.12, 0.02), (cx, cy, 0.3 + k * 0.22), P['brick2'], bevel=0, name='course')
    sawtooth(p, 2.0, 1.1, 1.12, 3, '#7E8A9A', x0=cx, y0=cy)
    for i, x in enumerate((-0.55, 0.05)):
        box(p, (0.5, 0.05, 0.55), (cx + x, cy - 0.56, 0.42), '#6E7A86', bevel=0.01, name='rolldoor')
        for k in range(6):
            box(p, (0.5, 0.055, 0.012), (cx + x, cy - 0.565, 0.18 + k * 0.09), '#5B6670', bevel=0, name='rollslat')
    window(p, cx + 0.6, cy - 0.56, 0.45, w=0.24, h=0.26)
    window_row(p, (cx - 0.6, cx - 0.2, cx + 0.2, cx + 0.6), cy - 0.56, 0.88, w=0.2, h=0.18)
    box(p, (1.1, 0.06, 0.2), (cx - 0.2, cy - 0.58, 1.25), P['white'], bevel=0.01, name='signboard')
    box(p, (0.36, 0.07, 0.11), (cx - 0.2, cy - 0.6, 1.25), P['blue'], kind='G', bevel=0.005, name='signfish')
    # ice tower and a steam engine house (right)
    cyl(p, 0.3, 0.3, 1.2, (1.25, 0.85, 0.72), '#EEF3F7', seg=18, name='icetank')
    for z in (0.5, 0.9, 1.25):
        cyl(p, 0.31, 0.31, 0.03, (1.25, 0.85, z), '#9FB3C3', seg=18, bevel=0, name='tankband')
    ball(p, 0.3, (1.25, 0.85, 1.32), '#9FB3C3', scale=(1, 1, 0.45), name='tanktop')
    box(p, (0.06, 0.06, 1.2), (1.0, 0.6, 0.72), P['dark'], rot=(0, 0.0, 0), bevel=0, name='ladder')
    box(p, (0.6, 0.5, 0.55), (0.4, 0.95, 0.4), '#C9D2DA', bevel=0.02, name='enginehouse')
    flat_roof(p, 0.64, 0.54, 0.68, '#7E8A9A')
    chimney(p, 0.55, 1.05, 0.75, 0.75, r=0.07, col='#7E8A9A', cap=P['dark'], i=1)
    cyl(p, 0.035, 0.035, 0.7, (0.85, 0.85, 0.55), P['metal'], seg=8, rot=(0, math.pi / 2, 0), name='pipe')
    # ice blocks and fish boxes stacked on pallets
    for (x, y) in ((0.6, 0.15), (1.05, 0.15), (1.5, 0.2)):
        box(p, (0.38, 0.32, 0.04), (x, y, 0.14), P['wood'], bevel=0.005, name='pallet')
    for k in range(4):
        box(p, (0.16, 0.14, 0.14), (0.52 + (k % 2) * 0.17, 0.15, 0.24 + (k // 2) * 0.15), '#D7F0FA', bevel=0.02, kind='G', name='ice')
    for k in range(5):
        box(p, (0.17, 0.13, 0.1), (0.97 + (k % 2) * 0.18, 0.12 + (k % 3) * 0.02, 0.21 + (k // 2) * 0.11), '#5D8FD0', bevel=0.012, name='fishbox')
    for x in (1.42, 1.6):
        barrel(p, x, 0.2, 0.16, 0.09, 0.24)
    # concrete quay with a rail track and a little rail cart
    box(p, (3.95, 0.8, 0.32), (0, -1.5, 0.0), '#BDB6AA', bevel=0.03, name='quay')
    box(p, (3.95, 0.07, 0.07), (0, -1.88, 0.17), '#F2C14E', bevel=0, name='quayedge')
    for y in (-1.3, -1.12):
        box(p, (3.9, 0.025, 0.03), (0, y, 0.18), '#6E7A86', bevel=0, name='rail')
    for i in range(16):
        box(p, (0.06, 0.3, 0.02), (-1.85 + i * 0.25, -1.21, 0.165), P['beam'], bevel=0, name='sleeper')
    box(p, (0.42, 0.28, 0.14), (-1.2, -1.21, 0.3), '#5D8FD0', bevel=0.015, name='railcart')
    for k in range(3):
        box(p, (0.1, 0.1, 0.08), (-1.32 + k * 0.12, -1.21, 0.41), '#D7F0FA', bevel=0.01, name='ice')
    for x in (-1.7, -0.6, 0.5, 1.7):
        cyl(p, 0.05, 0.065, 0.14, (x, -1.82, 0.22), P['dark'], seg=8, name='bollard')
    lamp_post(p, -1.75, -1.65, 0.16, 0.9, '#5B6670')
    lamp_post(p, 1.75, -1.65, 0.16, 0.9, '#5B6670')
    # steel crane on the quay: a portal on legs, the jib slews around
    cxr, cyr = 1.15, -1.3
    for dx in (-0.2, 0.2):
        for dy in (-0.15, 0.15):
            box(p, (0.06, 0.06, 0.55), (cxr + dx, cyr + dy, 0.43), '#F2C14E', bevel=0.006, name='craneleg')
    box(p, (0.5, 0.42, 0.08), (cxr, cyr, 0.72), '#F2C14E', bevel=0.01, name='portal')
    e = part(p, 'spiny_crane', (cxr, cyr, 0.76))
    box(e, (0.32, 0.3, 0.25), (0, 0.05, 0.13), '#F2C14E', bevel=0.02, name='cranecab')
    box(e, (0.3, 0.02, 0.1), (0, -0.11, 0.18), P['glass'], kind='G', bevel=0, name='cabglass')
    box(e, (0.08, 0.08, 0.6), (0, 0.05, 0.55), '#F2C14E', bevel=0.008, name='cranetower')
    box(e, (0.07, 1.1, 0.07), (0, -0.4, 0.85), '#F2C14E', rot=(0.18, 0, 0), bevel=0.006, name='cranejib')
    box(e, (0.18, 0.18, 0.14), (0, 0.32, 0.4), P['dark'], bevel=0.015, name='counterweight')
    cyl(e, 0.006, 0.006, 0.5, (0, -0.92, 0.5), P['dark'], seg=4, bevel=0, name='rope')
    box(e, (0.18, 0.18, 0.12), (0, -0.92, 0.2), '#5D8FD0', bevel=0.015, name='load')
    # the steam trawler
    b = part(p, 'bob_boat', (-0.45, -2.35, -0.05))
    hull = [(-0.95, 0.18), (1.0, 0.18), (0.78, -0.08), (-0.82, -0.08)]
    poly_prism(b, hull, 0.5, (0, 0, 0.0), '#2F4E7A', rot=(0, 0, math.pi / 2), name='hull')
    box(b, (1.92, 0.52, 0.05), (0, 0, 0.17), '#B5523B', bevel=0.008, name='hullband')
    box(b, (1.75, 0.42, 0.03), (0, 0, 0.2), P['wood'], bevel=0.006, name='deck')
    box(b, (0.5, 0.36, 0.32), (-0.35, 0, 0.37), P['white'], bevel=0.02, name='wheelhouse')
    box(b, (0.52, 0.38, 0.04), (-0.35, 0, 0.54), '#B5523B', bevel=0.01, name='whroof')
    box(b, (0.02, 0.3, 0.1), (-0.09, 0, 0.44), P['glass'], kind='G', bevel=0, name='bridgeglass')
    cyl(b, 0.07, 0.08, 0.38, (0.05, 0, 0.55), '#E8665A', seg=10, name='funnel')
    cyl(b, 0.085, 0.085, 0.05, (0.05, 0, 0.72), P['dark'], seg=10, bevel=0, name='funneltop')
    cyl(b, 0.02, 0.02, 0.9, (0.55, 0, 0.62), P['dark'], seg=6, name='mast')
    box(b, (0.6, 0.02, 0.02), (0.75, 0, 0.6), P['dark'], rot=(0, 0.6, 0), bevel=0, name='boom')
    box(b, (0.3, 0.3, 0.08), (0.7, 0, 0.25), '#6F9BB5', bevel=0.02, name='trawlnet')
    for k in range(3):
        ball(b, 0.035, (0.6 + k * 0.1, 0.14, 0.3), '#F2C14E', name='float')
    smoke(p, -0.45 + 0.05, -2.35, 0.72, 2)
    gull(p, 0.2, -2.0, 0.95)
    gull(p, -1.5, -1.35, 0.45)

# ---------------------------------------------------------------- vegetable line (4 x 3)
CROPS = [('#8FD16A', 'cab'), ('#F2766B', 'tom'), ('#F2A541', 'car'), ('#6DB36A', 'let'), ('#A487CF', 'cab'), ('#E9C94A', 'pump')]
def crop_row(p, x0, x1, y, kind, col, step=0.26, bed=True, bed_w=0.3):
    if bed:
        box(p, (x1 - x0 + 0.16, bed_w, 0.08), ((x0 + x1) / 2, y, 0.1), '#9B6B44', bevel=0.02, name='bed')
    n = int((x1 - x0) / step) + 1
    for i in range(n):
        x = x0 + i * (x1 - x0) / max(1, n - 1)
        if kind == 'tom':
            cyl(p, 0.012, 0.012, 0.36, (x, y, 0.3), P['wood2'], seg=4, name='stake')
            ball(p, 0.075, (x, y, 0.25), P['leaf'], name='vine')
            ball(p, 0.035, (x + 0.035, y - 0.045, 0.27), col, name='tomato')
        elif kind == 'car':
            ball(p, 0.055, (x, y, 0.19), '#6DB36A', scale=(0.6, 0.6, 1.4), name='tops')
            ball(p, 0.03, (x, y - 0.05, 0.15), col, name='carrot')
        elif kind == 'pump':
            ball(p, 0.08, (x, y, 0.18), P['leaf'], scale=(1.2, 1, 0.5), name='pumpleaf')
            if i % 2 == 0:
                ball(p, 0.07, (x + 0.05, y - 0.05, 0.19), P['orange'], scale=(1, 1, 0.8), name='pumpkin')
        else:
            ball(p, 0.08, (x, y, 0.19), col, scale=(1, 1, 0.75), name='cabbage')

def scarecrow(p, x, y, shirt='#E8665A', h=0.75):
    """a straw man on a pole; his shirt and sleeves flap in the wind"""
    cyl(p, 0.02, 0.02, h, (x, y, h / 2 + 0.06), P['beam'], seg=5, name='scarepole')
    box(p, (0.42, 0.03, 0.03), (x, y, h * 0.72 + 0.06), P['beam'], bevel=0, name='scarearm')
    ball(p, 0.08, (x, y, h + 0.1), P['straw'], name='scarehead')
    cyl(p, 0.14, 0.0, 0.1, (x, y, h + 0.2), P['thatch2'], seg=8, name='hat')
    cyl(p, 0.15, 0.15, 0.015, (x, y, h + 0.16), P['thatch2'], seg=10, bevel=0, name='hatbrim')
    e = part(p, 'swingx_scarecrow', (x, y, h * 0.72 + 0.1))
    box(e, (0.17, 0.09, 0.24), (0, 0, -0.1), shirt, bevel=0.015, name='shirt')
    for sx in (-1, 1):
        box(e, (0.12, 0.07, 0.07), (sx * 0.14, 0, -0.03), shade(shirt, 0.88), bevel=0.01, name='sleeve')
        ball(e, 0.03, (sx * 0.21, 0, -0.06), P['straw'], scale=(1, 1, 1.6), name='straw')
    box(e, (0.18, 0.1, 0.04), (0, 0, -0.24), P['beam'], bevel=0.005, name='belt')

def tool_shed(p, x, y, w=0.6, d=0.5, roof_col=None, wall=None):
    box(p, (w, d, 0.48), (x, y, 0.3), wall or P['wood'], bevel=0.02, name='shed')
    for k in range(4):
        box(p, (w + 0.01, d + 0.01, 0.012), (x, y, 0.12 + k * 0.12), P['wood2'], bevel=0, name='board')
    roof(p, w, d, 0.2, 0.54, roof_col or P['green'], thick=0.05, oh=0.06, x0=x, y0=y)
    gable_fill(p, w, d, 0.18, 0.54, wall or P['wood'], x0=x, y0=y)
    box(p, (0.2, 0.04, 0.34), (x - w / 4, y - d / 2 - 0.01, 0.25), P['beam'], bevel=0.006, name='sheddoor')
    for k in range(2):
        cyl(p, 0.012, 0.012, 0.45, (x + w / 4 + k * 0.08, y - d / 2 - 0.04, 0.3), P['wood2'], seg=4, rot=(0.15, 0, 0), name='toolhandle')

def chicken(p, x, y, rz=0.0, col=None):
    col = col or P['white']
    ball(p, 0.06, (x, y, 0.16), col, scale=(1.3, 0.9, 1), rot=(0, 0, rz), name='hen')
    c, s = math.cos(rz), math.sin(rz)
    ball(p, 0.035, (x + 0.06 * c, y + 0.06 * s, 0.22), col, name='henhead')
    ball(p, 0.012, (x + 0.07 * c, y + 0.07 * s, 0.26), P['red'], name='comb')
    cyl(p, 0.012, 0.0, 0.03, (x + 0.095 * c, y + 0.095 * s, 0.22), P['orange'], seg=4, rot=(0, math.pi / 2, rz), name='beak')

def bean_teepee(p, x, y):
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        cyl(p, 0.01, 0.01, 0.55, (x + math.cos(a) * 0.08, y + math.sin(a) * 0.08, 0.36), P['wood2'], seg=4, rot=(math.sin(a) * 0.3, -math.cos(a) * 0.3, 0), name='beanpole')
        ball(p, 0.05, (x + math.cos(a) * 0.08, y + math.sin(a) * 0.08, 0.3), P['leaf'], name='beanleaf')
    ball(p, 0.05, (x, y, 0.55), P['leaf2'], name='beanleaf')

def garden():
    """Level 1: a fenced kitchen garden with a few beds, a tool shed, hens, and a freshly dug plot waiting."""
    p = root('garden')
    plate(p, 4, 3, '#9ED36A', 0.06)
    box(p, (2.4, 2.4, 0.04), (-0.55, -0.05, 0.08), '#B98A5A', bevel=0.02, name='soil')
    for (x0, y0, x1, y1) in ((-1.8, -1.3, 0.7, -1.3), (0.7, -1.3, 0.7, 1.2), (0.7, 1.2, -1.8, 1.2), (-1.8, 1.2, -1.8, -1.3)):
        fence(p, x0, y0, x1, y1, P['wood'], n=int(math.hypot(x1 - x0, y1 - y0) / 0.22))
    for r, (col, kind) in enumerate(CROPS[:4]):
        crop_row(p, -1.5, 0.25, -0.95 + r * 0.42, kind, col, step=0.29)
    bean_teepee(p, -1.45, 0.85)
    bean_teepee(p, -1.1, 0.85)
    scarecrow(p, 0.2, 0.85, '#E8665A')
    # the dug plot on the right: furrows waiting to become a field
    box(p, (1.0, 1.9, 0.04), (1.35, -0.2, 0.08), '#A87A4E', bevel=0.02, name='tilled')
    for i in range(5):
        box(p, (0.06, 1.75, 0.04), (0.95 + i * 0.2, -0.2, 0.11), '#93663E', bevel=0.01, name='furrow')
    cyl(p, 0.012, 0.012, 0.6, (1.75, -1.05, 0.33), P['wood2'], seg=4, rot=(0.0, 0.5, 0), name='spade')
    box(p, (0.1, 0.02, 0.12), (1.6, -1.05, 0.08), P['metal'], rot=(0, 0.5, 0), bevel=0.004, name='spadeblade')
    tool_shed(p, 1.35, 1.0)
    # hens, a water butt and a basket of the harvest
    for (x, y, rz) in ((0.95, 0.35, 0.3), (1.25, 0.5, 2.5), (1.6, 0.3, 4.0)):
        chicken(p, x, y, rz, P['white'] if x < 1.5 else '#E2A86A')
    cyl(p, 0.13, 0.13, 0.3, (0.95, 1.25, 0.22), P['wood'], seg=12, name='waterbutt')
    cyl(p, 0.11, 0.11, 0.01, (0.95, 1.25, 0.37), P['water'], seg=12, bevel=0, name='water')
    cyl(p, 0.1, 0.08, 0.14, (0.4, -1.35, 0.13), '#D9B27A', seg=10, name='basket')
    for i in range(3):
        ball(p, 0.045, (0.37 + i * 0.03, -1.35, 0.22), CROPS[i][0], name='harvest')
    flowers(p, -1.8, -1.35, 0.1)

def vegfield():
    """Level 2: the whole plot under long beds, a stone canal along the front with a turning water wheel, a packing shed."""
    p = root('vegfield')
    plate(p, 4, 3, '#9ED36A', 0.06)
    box(p, (3.75, 2.3, 0.04), (0, 0.2, 0.08), '#B98A5A', bevel=0.02, name='soil')
    for r, (col, kind) in enumerate(CROPS):
        crop_row(p, -1.65, 0.45 if r >= 3 else 1.6, -0.75 + r * 0.38, kind, col, step=0.27, bed_w=0.26)
    # stone canal along the front, little channels off it, and a water wheel turning in it
    box(p, (3.8, 0.3, 0.12), (0, -1.22, 0.1), P['stone2'], bevel=0.02, name='canal')
    box(p, (3.75, 0.2, 0.02), (0, -1.22, 0.16), P['water'], bevel=0, name='canalwater')
    for x in (-1.2, -0.2):
        box(p, (0.1, 0.25, 0.03), (x, -0.98, 0.13), P['stone2'], bevel=0.005, name='sluice')
        box(p, (0.06, 0.22, 0.01), (x, -0.98, 0.15), P['water'], bevel=0, name='sluicewater')
    wx, wy = 0.9, -1.22
    for sy in (-1, 1):
        box(p, (0.08, 0.05, 0.42), (wx, wy + sy * 0.17, 0.33), P['beam'], bevel=0.006, name='wheelpost')
    e = part(p, 'spinz_wheel', (wx, wy, 0.42))
    for k in range(2):
        torus(e, 0.3, 0.02, (0, -0.06 + k * 0.12, 0), P['wood2'], rot=(math.pi / 2, 0, 0), seg=18, rseg=6, name='rim')
    cyl(e, 0.04, 0.04, 0.3, (0, 0, 0), P['dark'], seg=8, rot=(math.pi / 2, 0, 0), name='hub')
    for k in range(8):
        a = k * math.pi / 4
        box(e, (0.03, 0.14, 0.3), (math.cos(a) * 0.15, 0, math.sin(a) * 0.15), P['wood2'], rot=(0, math.pi / 2 - a, 0), bevel=0, name='spoke')
        box(e, (0.1, 0.14, 0.02), (math.cos(a) * 0.3, 0, math.sin(a) * 0.3), P['wood'], rot=(0, -a, 0), bevel=0, name='paddle')
    # packing shed: open sides, crates of produce
    sx_, sy_ = 1.2, 0.85
    for x in (sx_ - 0.4, sx_ + 0.4):
        for y in (sy_ - 0.3, sy_ + 0.3):
            box(p, (0.05, 0.05, 0.6), (x, y, 0.38), P['beam'], bevel=0.006, name='post')
    roof(p, 0.95, 0.75, 0.22, 0.68, P['green'], thick=0.05, oh=0.06, x0=sx_, y0=sy_)
    box(p, (0.7, 0.4, 0.04), (sx_, sy_ + 0.1, 0.35), P['wood'], bevel=0.006, name='table')
    for i, col in enumerate(('#8FD16A', '#F2766B', '#F2A541')):
        crate(p, sx_ - 0.25 + i * 0.25, sy_ - 0.2, 0.08, 0.2)
        for k in range(3):
            ball(p, 0.04, (sx_ - 0.31 + i * 0.25 + k * 0.06, sy_ - 0.2, 0.32), col, name='harvest')
    for k in range(4):
        ball(p, 0.06, (sx_ - 0.2 + k * 0.13, sy_ + 0.1, 0.43), ['#8FD16A', '#A487CF', '#E9C94A', '#F2766B'][k], name='produce')
    # hand cart loaded for market, scarecrows, back fence
    box(p, (0.4, 0.26, 0.06), (1.55, -0.05, 0.26), P['wood'], bevel=0.01, name='cartbed')
    for sy in (-0.15, 0.15):
        cyl(p, 0.1, 0.1, 0.03, (1.55, -0.05 + sy, 0.18), P['wood2'], seg=12, rot=(math.pi / 2, 0, 0), name='wheel')
    for k in range(3):
        crate(p, 1.45 + k * 0.1, -0.05, 0.29, 0.12, '#E2A86A')
    scarecrow(p, -0.6, 0.98, '#6FA8DC')
    scarecrow(p, 1.0, -0.4, '#F0A04B', 0.7)
    fence(p, -1.85, 1.38, 0.6, 1.38, P['wood'], n=12)
    flowers(p, 1.75, 0.35, 0.1)

def compost():
    """2 x 2: three slatted bins of dark compost at different ages, a wheelbarrow, a rake and a pitchfork."""
    p = root('compost')
    plate(p, 2, 2, '#A88B66', 0.06)
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
    box(p, (1.6, 0.06, 0.08), (0, 0.62, 0.52), P['beam'], bevel=0.006, name='lid')
    box(p, (0.4, 0.04, 0.16), (0.0, 0.08, 0.6), P['white'], bevel=0.01, name='sign')
    box(p, (0.12, 0.045, 0.08), (0.0, 0.07, 0.6), P['green'], bevel=0.004, name='signleaf')
    # leaf pile and wheelbarrow
    for k in range(6):
        ball(p, 0.1, (-0.55 + (k % 3) * 0.12, -0.45 + (k // 3) * 0.1, 0.1 + (k // 3) * 0.05), ['#E9B94A', '#D47B3F', '#C9583F'][k % 3], scale=(1, 1, 0.6), name='leafpile')
    box(p, (0.36, 0.26, 0.12), (0.35, -0.4, 0.22), '#6FA8DC', rot=(0.0, 0.2, 0), bevel=0.03, name='barrow')
    ball(p, 0.14, (0.35, -0.4, 0.27), '#5A3F2B', scale=(1.1, 0.8, 0.4), name='load')
    cyl(p, 0.08, 0.08, 0.04, (0.12, -0.4, 0.09), P['dark'], seg=12, rot=(math.pi / 2, 0, 0), name='wheel')
    for y in (-0.5, -0.3):
        cyl(p, 0.015, 0.015, 0.4, (0.62, y, 0.22), P['wood2'], seg=5, rot=(0, 1.2, 0), name='barrowarm')
    cyl(p, 0.015, 0.015, 0.75, (-0.8, -0.05, 0.38), P['wood2'], seg=5, rot=(0.25, 0, 0), name='forkhandle')
    for k in range(3):
        cyl(p, 0.008, 0.008, 0.14, (-0.83 + k * 0.03, -0.14, 0.73), P['metal'], seg=4, rot=(0.25, 0, 0), name='tine')
    cyl(p, 0.015, 0.015, 0.7, (0.8, 0.0, 0.36), P['wood2'], seg=5, rot=(-0.2, 0, 0), name='rakehandle')
    box(p, (0.22, 0.03, 0.03), (0.8, 0.07, 0.7), P['metal'], rot=(-0.2, 0, 0), bevel=0, name='rakehead')
    chicken(p, -0.2, -0.75, 1.2, '#E2A86A')

# ---------------------------------------------------------------- medical line (3 x 3)
def bench(p, x, y, rz=0.0, col=None):
    c, s = math.cos(rz), math.sin(rz)
    box(p, (0.42, 0.14, 0.035), (x, y, 0.22), col or P['wood'], rot=(0, 0, rz), bevel=0.006, name='benchseat')
    box(p, (0.42, 0.03, 0.12), (x - 0.07 * s, y + 0.07 * c, 0.3), col or P['wood'], rot=(0, 0, rz), bevel=0.006, name='benchback')
    for k in (-1, 1):
        box(p, (0.03, 0.12, 0.12), (x + k * 0.18 * c, y + k * 0.18 * s, 0.15), P['dark'], rot=(0, 0, rz), bevel=0, name='benchleg')

def beehive(p, x, y):
    box(p, (0.16, 0.16, 0.08), (x, y, 0.14), P['wood2'], bevel=0.01, name='hivestand')
    for k in range(3):
        cyl(p, 0.12 - k * 0.03, 0.1 - k * 0.03, 0.08, (x, y, 0.22 + k * 0.07), P['straw'], seg=12, name='skep')
    box(p, (0.05, 0.02, 0.03), (x, y - 0.11, 0.21), P['dark'], bevel=0, name='hivedoor')

def red_cross(p, x, y, z, s=0.3, face='front'):
    rz = 0 if face == 'front' else math.pi / 2
    if face == 'front':
        box(p, (s, 0.06, s), (x, y, z), P['white'], bevel=0.02, name='signbox')
        box(p, (s * 0.7, 0.07, s * 0.2), (x, y - 0.02, z), P['red'], kind='G', bevel=0.005, name='cross')
        box(p, (s * 0.2, 0.07, s * 0.7), (x, y - 0.02, z), P['red'], kind='G', bevel=0.005, name='cross')

def herbalist():
    """Level 1: a herb-roofed cottage, raised herb beds, drying racks, bee skeps and a swinging mortar sign."""
    p = root('herbalist')
    plate(p, 3, 3, '#A9D47A', 0.08)
    # cottage at the back, its door on the same axis as the clinic's and hospital's
    cx, cy = -0.35, 0.6
    box(p, (1.45, 1.05, 0.12), (cx, cy, 0.14), P['stone'], bevel=0.03, name='base')
    box(p, (1.3, 0.9, 0.66), (cx, cy, 0.53), '#F3E9D2', bevel=0.03, name='walls')
    for x in (-0.65, 0.65):
        box(p, (0.07, 0.94, 0.68), (cx + x, cy, 0.53), P['beam'], bevel=0.01, name='post')
    box(p, (1.36, 0.96, 0.06), (cx, cy, 0.88), P['beam'], bevel=0.01, name='plate')
    gable_fill(p, 1.3, 0.9, 0.48, 0.9, '#F3E9D2', x0=cx, y0=cy)
    roof(p, 1.3, 0.9, 0.5, 0.9, '#5E9C6A', thick=0.08, oh=0.14, x0=cx, y0=cy, ridge=P['beam'])
    door(p, cx - 0.2, cy - 0.46, 0.2, col='#5E9C6A')
    window(p, cx + 0.3, cy - 0.46, 0.56, shutters='#5E9C6A', box_col=P['purple'])
    window(p, cx + 0.66, cy, 0.56, face='right', shutters='#5E9C6A')
    box(p, (0.16, 0.16, 0.45), (cx + 0.35, cy + 0.2, 1.38), P['stone2'], bevel=0.02, name='chimney')
    smoke(p, cx + 0.35, cy + 0.2, 1.62)
    # herb bundles drying under the eave, swaying
    e = part(p, 'swingx_herbs', (cx + 0.1, cy - 0.58, 0.95))
    for i in range(5):
        cyl(e, 0.004, 0.004, 0.1, (-0.4 + i * 0.2, 0, -0.05), P['dark'], seg=3, bevel=0, name='string')
        ball(e, 0.05, (-0.4 + i * 0.2, 0, -0.14), ['#8FD16A', '#C7A6F2', '#F2CF5B', '#6DB36A', '#E59AC0'][i], scale=(0.8, 0.8, 1.5), name='herbs')
    # mortar sign on a bracket at the corner
    box(p, (0.3, 0.03, 0.03), (cx + 0.82, cy - 0.47, 0.98), P['beam'], bevel=0, name='signarm')
    e = part(p, 'swingx_sign', (cx + 0.9, cy - 0.47, 0.96))
    box(e, (0.03, 0.26, 0.22), (0, 0, -0.14), P['white'], bevel=0.01, name='signboard')
    cyl(e, 0.06, 0.04, 0.08, (-0.02, 0, -0.15), '#5E9C6A', seg=10, name='mortar')
    # raised herb beds in front, with a stone path to the door
    for i, cols in enumerate(((P['purple'], '#C7A6F2'), ('#8FD16A', P['yellow']), ('#E59AC0', P['white']), ('#6DB36A', '#F2CF5B'))):
        bx, by = 0.15 + (i % 2) * 0.7, -0.45 - (i // 2) * 0.55
        box(p, (0.55, 0.4, 0.14), (bx, by, 0.15), P['wood'], bevel=0.015, name='raisedbed')
        box(p, (0.5, 0.35, 0.02), (bx, by, 0.22), '#7A5236', bevel=0, name='bedsoil')
        for k in range(4):
            hx, hy = bx - 0.15 + (k % 2) * 0.3, by - 0.08 + (k // 2) * 0.16
            ball(p, 0.08, (hx, hy, 0.28), P['leaf'], scale=(1, 1, 0.8), name='herbbush')
            ball(p, 0.03, (hx, hy, 0.35), cols[k % 2], name='bloom')
    for k in range(5):
        cyl(p, 0.1, 0.1, 0.03, (cx - 0.2 + (k % 2) * 0.05, -0.05 - k * 0.27, 0.1), P['stone'], seg=10, bevel=0.005, name='steppingstone')
    # drying frames, bee skeps, baskets and pots by the side
    fish_rack(p, -1.0, -0.55, 0.6, 0.5, cols=['#8FD16A', '#C7A6F2', '#F2CF5B', '#6DB36A'])
    beehive(p, 1.15, 0.9)
    beehive(p, 1.15, 0.5)
    for k in range(3):
        cyl(p, 0.07, 0.055, 0.1, (-1.1 + k * 0.17, -1.15, 0.13), P['terracotta'], seg=10, name='pot')
        ball(p, 0.06, (-1.1 + k * 0.17, -1.15, 0.22), P['leaf2'], name='potplant')
    cyl(p, 0.1, 0.08, 0.14, (0.9, 0.05, 0.15), '#D9B27A', seg=10, name='basket')
    fence(p, -1.4, 1.35, 1.4, 1.35, P['wood'], n=12)

def clinic():
    """Level 2: a two-storey brick clinic with a red-cross sign, a canopied entrance, benches and an ambulance cart."""
    p = root('clinic')
    plate(p, 3, 3, '#E2DDD3', 0.12)
    cx, cy = -0.15, 0.55
    W, D = 2.2, 1.15
    box(p, (W, D, 0.58), (cx, cy, 0.41), P['brick'], bevel=0.03, name='ground')
    box(p, (W + 0.04, D + 0.04, 0.06), (cx, cy, 0.71), P['white'], bevel=0.01, name='band')
    box(p, (W, D, 0.58), (cx, cy, 1.03), P['brick'], bevel=0.03, name='upper')
    for k in range(5):
        box(p, (W + 0.01, D + 0.01, 0.015), (cx, cy, 0.25 + k * 0.2 if k < 2 else 0.6 + k * 0.17), P['brick2'], bevel=0, name='course')
    box(p, (W + 0.1, D + 0.1, 0.08), (cx, cy, 1.36), P['white'], bevel=0.015, name='cornice')
    roof(p, W, D, 0.42, 1.4, '#5A6B7F', thick=0.07, oh=0.08, x0=cx, y0=cy, ridge=P['dark'])
    gable_fill(p, W, D, 0.42, 1.4, P['brick'], x0=cx, y0=cy)
    fy = cy - D / 2 - 0.005
    window_row(p, (cx - 0.8, cx - 0.45, cx + 0.45, cx + 0.8), fy, 0.45, w=0.22, h=0.26)
    window_row(p, (cx - 0.8, cx - 0.45, cx, cx + 0.45, cx + 0.8), fy, 1.05, w=0.22, h=0.26)
    door(p, cx, fy, 0.12, w=0.32, h=0.44, col=P['glass'], arch=False)
    box(p, (0.7, 0.4, 0.04), (cx, fy - 0.2, 0.66), '#8FD1C4', bevel=0.01, name='canopy')
    for sx in (-1, 1):
        cyl(p, 0.02, 0.02, 0.52, (cx + sx * 0.3, fy - 0.36, 0.38), P['white'], seg=6, name='canopypost')
    box(p, (0.6, 0.3, 0.05), (cx, fy - 0.17, 0.14), P['stone'], bevel=0.01, name='step')
    red_cross(p, cx, fy - 0.02, 1.62, 0.3)
    for x in (cx - 0.65, cx + 0.65):
        box(p, (0.22, 0.12, 0.42), (x, cy + 0.15, 1.75), P['brick2'], bevel=0.02, name='chimney')
    window(p, cx + W / 2 + 0.005, cy, 0.45, face='right', w=0.22, h=0.26)
    window(p, cx + W / 2 + 0.005, cy, 1.05, face='right', w=0.22, h=0.26)
    # flag on a pole
    cyl(p, 0.02, 0.025, 1.5, (0.95, -0.3, 0.85), P['white'], seg=6, name='flagpole')
    e = part(p, 'flag_clinic', (0.95, -0.3, 1.55))
    box(e, (0.34, 0.02, 0.22), (0.17, 0, -0.11), P['white'], bevel=0.004, name='flagcloth')
    box(e, (0.14, 0.025, 0.05), (0.17, 0, -0.11), P['red'], bevel=0, name='flagcross')
    box(e, (0.05, 0.025, 0.14), (0.17, 0, -0.11), P['red'], bevel=0, name='flagcross')
    # front yard: path, benches, flowerbeds, a horse ambulance waiting
    box(p, (0.5, 1.0, 0.02), (cx, -0.85, 0.13), P['stone'], bevel=0.005, name='path')
    bench(p, -0.95, -0.55, 0.0)
    bench(p, 0.6, -0.55, 0.0)
    for x in (-1.0, -0.45, 0.45):
        box(p, (0.4, 0.22, 0.1), (x, -1.15, 0.17), P['stone2'], bevel=0.01, name='planter')
        for k in range(3):
            ball(p, 0.08, (x - 0.12 + k * 0.12, -1.15, 0.27), P['leaf'], scale=(1, 1, 0.8), kind='L', name='bush')
            ball(p, 0.03, (x - 0.12 + k * 0.12, -1.18, 0.34), [P['pink'], P['yellow'], P['white']][k], name='flower')
    ax, ay = 1.05, -0.95
    box(p, (0.5, 0.3, 0.3), (ax, ay, 0.38), P['white'], bevel=0.03, name='ambcart')
    box(p, (0.52, 0.32, 0.05), (ax, ay, 0.55), '#D6E2E8', bevel=0.01, name='ambroof')
    box(p, (0.12, 0.31, 0.1), (ax, ay, 0.4), P['red'], bevel=0, name='ambcross')
    for sy in (-0.16, 0.16):
        cyl(p, 0.13, 0.13, 0.03, (ax, ay + sy, 0.2), P['wood2'], seg=14, rot=(math.pi / 2, 0, 0), name='wheel')
    for sy in (-0.1, 0.1):
        box(p, (0.4, 0.02, 0.02), (ax - 0.4, ay + sy, 0.3), P['wood2'], rot=(0, -0.2, 0), bevel=0, name='shaft')
    tree_small(p, 1.2, 0.95, 1.1)
    tree_small(p, -1.25, -0.15, 0.9)

def hospital():
    """Level 3: a four-storey modern hospital with a glass lobby, an ambulance bay, a roof helipad and a flag."""
    p = root('hospital')
    plate(p, 3, 3, '#E2DDD3', 0.12)
    cx, cy = -0.15, 0.6
    W, D = 2.3, 1.1
    fl = 0.55
    for f in range(4):
        z = 0.12 + f * fl
        box(p, (W, D, fl - 0.02), (cx, cy, z + fl / 2), P['white'], bevel=0.025, name='storey')
        box(p, (W + 0.04, D + 0.04, 0.05), (cx, cy, z + fl - 0.01), '#D6E2E8', bevel=0.008, name='floorband')
        if f > 0:
            for i in range(6):
                window(p, cx - 0.95 + i * 0.38, cy - D / 2 - 0.005, z + 0.27, w=0.22, h=0.26)
        for sy in (-0.3, 0.3):
            window(p, cx + W / 2 + 0.005, cy + sy, z + 0.27, face='right', w=0.2, h=0.26)
            window(p, cx - W / 2 - 0.005, cy + sy, z + 0.27, face='left', w=0.2, h=0.26)
    top = 0.12 + 4 * fl
    flat_roof(p, W + 0.04, D + 0.04, top, '#C9D2DA', x0=cx, y0=cy, parapet='#EDF2F5')
    # teal stripe up the stair tower and the red cross on it
    box(p, (0.5, 0.06, 4 * fl), (cx + 0.75, cy - D / 2 - 0.02, 0.12 + 2 * fl), '#8FD1C4', bevel=0.01, name='stairtower')
    red_cross(p, cx + 0.75, cy - D / 2 - 0.08, top - 0.35, 0.36)
    # glass lobby in front of the ground floor
    box(p, (1.2, 0.45, 0.5), (cx - 0.35, cy - D / 2 - 0.22, 0.37), '#BFD9E6', bevel=0.015, kind='G', name='lobby')
    for i in range(5):
        box(p, (0.03, 0.47, 0.5), (cx - 0.95 + i * 0.3, cy - D / 2 - 0.22, 0.37), P['white'], bevel=0, name='mullion')
    box(p, (1.4, 0.75, 0.06), (cx - 0.35, cy - D / 2 - 0.3, 0.66), P['white'], bevel=0.012, name='canopy')
    door(p, cx - 0.35, cy - D / 2 - 0.455, 0.12, w=0.34, h=0.4, col=P['glass'], arch=False)
    box(p, (0.8, 0.06, 0.12), (cx - 0.35, cy - D / 2 - 0.66, 0.66), '#8FD1C4', kind='G', bevel=0.008, name='signboard')
    # roof: helipad, plant room, flag
    hx, hy = cx - 0.45, cy
    cyl(p, 0.42, 0.42, 0.04, (hx, hy, top + 0.1), '#7E8A9A', seg=20, bevel=0, name='helipad')
    torus(p, 0.36, 0.015, (hx, hy, top + 0.125), P['white'], seg=20, rseg=4, name='padring')
    box(p, (0.05, 0.26, 0.01), (hx - 0.1, hy, top + 0.125), P['white'], bevel=0, name='h')
    box(p, (0.05, 0.26, 0.01), (hx + 0.1, hy, top + 0.125), P['white'], bevel=0, name='h')
    box(p, (0.2, 0.05, 0.01), (hx, hy, top + 0.125), P['white'], bevel=0, name='h')
    box(p, (0.5, 0.45, 0.3), (cx + 0.6, cy + 0.15, top + 0.23), '#C9D2DA', bevel=0.02, name='plantroom')
    e = part(p, 'spiny_vent', (cx + 0.6, cy + 0.15, top + 0.38))
    cyl(e, 0.13, 0.13, 0.04, (0, 0, 0.02), P['metal'], seg=12, name='fanring')
    for k in range(4):
        box(e, (0.22, 0.05, 0.01), (0, 0, 0.03), P['dark'], rot=(0.3, 0, k * math.pi / 4), bevel=0, name='fanblade')
    cyl(p, 0.015, 0.02, 0.7, (cx + 1.0, cy - 0.3, top + 0.4), P['metal'], seg=6, name='flagpole')
    e = part(p, 'flag_hospital', (cx + 1.0, cy - 0.3, top + 0.72))
    box(e, (0.34, 0.02, 0.22), (0.17, 0, -0.11), P['white'], bevel=0.004, name='flagcloth')
    box(e, (0.14, 0.025, 0.05), (0.17, 0, -0.11), P['red'], bevel=0, name='flagcross')
    box(e, (0.05, 0.025, 0.14), (0.17, 0, -0.11), P['red'], bevel=0, name='flagcross')
    # ambulance bay on the right, drop-off lane in front
    box(p, (2.8, 0.55, 0.02), (0, -1.15, 0.13), '#9AA3AD', bevel=0.005, name='lane')
    for i in range(7):
        box(p, (0.2, 0.04, 0.01), (-1.2 + i * 0.4, -1.15, 0.145), P['white'], bevel=0, name='lanemark')
    ax, ay = 1.0, -0.55
    box(p, (0.3, 0.55, 0.26), (ax, ay, 0.31), P['white'], bevel=0.03, name='ambulance')
    box(p, (0.3, 0.18, 0.2), (ax, ay - 0.33, 0.27), P['white'], bevel=0.03, name='ambcab')
    box(p, (0.28, 0.03, 0.1), (ax, ay - 0.42, 0.31), P['glass'], kind='G', bevel=0, name='windscreen')
    box(p, (0.31, 0.56, 0.05), (ax, ay, 0.3), P['red'], bevel=0, name='ambstripe')
    box(p, (0.2, 0.08, 0.05), (ax, ay - 0.15, 0.47), '#6FA8DC', kind='G', bevel=0.005, name='beacon')
    for sx in (-0.15, 0.15):
        for sy in (-0.3, 0.15):
            cyl(p, 0.06, 0.06, 0.04, (ax + sx, ay + sy, 0.18), P['dark'], seg=10, rot=(0, math.pi / 2, 0), name='wheel')
    tree_small(p, -1.25, -0.6, 1.0)
    tree_small(p, 1.25, 0.95, 1.1)
    bench(p, -0.95, -0.15, 0.0, '#8FD1C4')
    flowers(p, 0.5, -0.65, 0.1)

# ---------------------------------------------------------------- grain line (4 x 4)
def wheat_field(p, x0, y0, w, d, rows, cols, skip=None, z=0.09):
    box(p, (w, d, 0.06), ((x0 + w / 2), (y0 + d / 2), 0.06), P['soil'], bevel=0.02, name='field')
    for r in range(rows):
        y = y0 + 0.15 + r * (d - 0.3) / max(1, rows - 1)
        box(p, (w - 0.15, 0.05, 0.02), (x0 + w / 2, y + (d - 0.3) / max(1, rows - 1) / 2, z + 0.005), '#93663E', bevel=0, name='furrow')
        for i in range(cols):
            if skip and skip(r, i):
                continue
            x = x0 + 0.15 + i * (w - 0.3) / max(1, cols - 1) + (0.05 if r % 2 else 0)
            h = 0.26 + random.random() * 0.06
            cyl(p, 0.07, 0.0, h, (x, y, z + h / 2), P['wheat'] if (i + r) % 3 else '#E5B53E', seg=6, name='wheat', smooth=False)

def hay_bale(p, x, y, rz=0.0):
    cyl(p, 0.14, 0.14, 0.22, (x, y, 0.2), P['hay'], seg=14, rot=(math.pi / 2, 0, rz), name='bale')
    cyl(p, 0.145, 0.145, 0.02, (x, y, 0.2), P['thatch2'], seg=14, rot=(math.pi / 2, 0, rz), bevel=0, name='baleband')

def wind_pump(p, x, y, h=1.3, col=None, metal=False):
    """a lattice tower with a little windmill that turns with the wind"""
    col = col or P['wood2']
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(p, (0.04, 0.04, h), (x + sx * 0.12, y + sy * 0.12, h / 2 + 0.06), col, rot=(-sy * 0.08, sx * 0.08, 0), bevel=0, name='towerleg')
    for k in range(3):
        box(p, (0.3, 0.3, 0.025), (x, y, 0.35 + k * h / 3.5), col, bevel=0, name='towerring')
    box(p, (0.1, 0.25, 0.1), (x, y + 0.02, h + 0.1), col, bevel=0.01, name='gearbox')
    poly_prism(p, [(0, 0), (0.3, 0), (0.3, 0.2)], 0.015, (x, y + 0.15, h + 0.05), P['red'] if not metal else P['metal'], name='tailvane')
    e = part(p, 'spinz_sails', (x, y - 0.12, h + 0.1))
    n = 12 if metal else 4
    for k in range(n):
        a = k * 2 * math.pi / n
        if metal:
            box(e, (0.05, 0.015, 0.3), (math.cos(a) * 0.17, 0, math.sin(a) * 0.17), P['metal'], rot=(0, -a + math.pi / 2, 0.35), bevel=0, name='blade')
        else:
            box(e, (0.03, 0.015, 0.36), (math.cos(a) * 0.18, 0, math.sin(a) * 0.18), P['wood'], rot=(0, -a + math.pi / 2, 0), bevel=0, name='sailarm')
            box(e, (0.1, 0.012, 0.26), (math.cos(a) * 0.2 + math.cos(a + math.pi / 2) * 0.05, 0.005, math.sin(a) * 0.2 + math.sin(a + math.pi / 2) * 0.05), P['cloth'], rot=(0, -a + math.pi / 2, 0), bevel=0, name='sailcloth')
    cyl(e, 0.04, 0.04, 0.06, (0, 0, 0), P['dark'], seg=8, rot=(math.pi / 2, 0, 0), name='hub')

def farm():
    """Level 1: a farmhouse and barn, a wind pump, a wheat field, hay bales, a plough and a scarecrow."""
    p = root('farm')
    plate(p, 4, 4, '#A9D47A', 0.06)
    # farmhouse (back left)
    hx, hy = -1.3, 1.3
    box(p, (1.0, 0.8, 0.12), (hx, hy, 0.12), P['stone'], bevel=0.03, name='base')
    box(p, (0.9, 0.7, 0.6), (hx, hy, 0.48), P['cream'], bevel=0.03, name='walls')
    gable_fill(p, 0.9, 0.7, 0.42, 0.78, P['cream'], x0=hx, y0=hy)
    roof(p, 0.9, 0.7, 0.44, 0.78, P['thatch'], thick=0.15, oh=0.14, bevel=0.06, seg=3, x0=hx, y0=hy, ridge=P['thatch2'])
    door(p, hx - 0.15, hy - 0.36, 0.18, col=P['blue'])
    window(p, hx + 0.22, hy - 0.36, 0.52, shutters=P['blue'], box_col=P['pink'])
    box(p, (0.16, 0.16, 0.45), (hx + 0.25, hy + 0.15, 1.2), P['stone2'], bevel=0.02, name='chimney')
    smoke(p, hx + 0.25, hy + 0.15, 1.45)
    # red barn
    bx, by = -0.05, 1.35
    box(p, (1.0, 0.85, 0.72), (bx, by, 0.42), '#E2725B', bevel=0.025, name='barn')
    for x in (bx - 0.5, bx + 0.5):
        box(p, (0.05, 0.89, 0.72), (x, by, 0.42), P['white'], bevel=0.008, name='trim')
    gable_fill(p, 1.0, 0.85, 0.45, 0.78, '#E2725B', x0=bx, y0=by)
    roof(p, 1.0, 0.85, 0.47, 0.78, '#8C7A6B', thick=0.07, oh=0.11, x0=bx, y0=by, ridge=P['dark'])
    box(p, (0.42, 0.04, 0.5), (bx, by - 0.43, 0.33), P['white'], bevel=0.008, name='barndoorframe')
    box(p, (0.36, 0.05, 0.44), (bx, by - 0.435, 0.32), '#C9583F', bevel=0.006, name='barndoor')
    for d in (1, -1):
        box(p, (0.02, 0.055, 0.56), (bx, by - 0.44, 0.32), P['white'], rot=(0, d * 0.68, 0), bevel=0, name='brace')
    box(p, (0.2, 0.04, 0.18), (bx, by - 0.43, 0.95), P['white'], bevel=0.006, name='loftdoor')
    wind_pump(p, 1.05, 1.35, 1.2)
    cyl(p, 0.25, 0.25, 0.15, (1.5, 1.15, 0.13), P['wood'], seg=14, name='trough')
    cyl(p, 0.22, 0.22, 0.01, (1.5, 1.15, 0.21), P['water'], seg=14, bevel=0, name='troughwater')
    # wheat field over the front two thirds, one corner reaped
    wheat_field(p, -1.85, -1.85, 3.7, 2.25, 6, 13, skip=lambda r, i: r < 2 and i > 9)
    for i, (x, y) in enumerate(((1.35, -1.6), (1.65, -1.45), (1.5, -1.2))):
        hay_bale(p, x, y, 0.4 * i)
    scarecrow(p, -0.2, -0.7, '#6FA8DC', 0.8)
    # plough and fence by the yard
    box(p, (0.5, 0.05, 0.05), (0.6, 0.55, 0.25), P['wood2'], rot=(0, 0.25, 0), bevel=0, name='ploughbeam')
    box(p, (0.12, 0.1, 0.12), (0.38, 0.55, 0.14), P['metal'], rot=(0, -0.5, 0), bevel=0.01, name='ploughshare')
    for sx in (-1, 1):
        box(p, (0.3, 0.025, 0.025), (0.9, 0.55 + sx * 0.08, 0.38), P['wood2'], rot=(0, -0.6, 0), bevel=0, name='ploughhandle')
    fence(p, -1.85, 0.62, 1.85, 0.62, P['white'], n=18)
    for (x, y, rz) in ((-0.9, 0.85, 0.5), (-0.6, 0.95, 2.6), (0.6, 0.9, 4.0)):
        chicken(p, x, y, rz)

def mechfarm():
    """Level 2: a steel barn, twin silos with a conveyor, a metal windmill, and a tractor driving up and down the field."""
    p = root('mechfarm')
    plate(p, 4, 4, '#B9D38A', 0.06)
    wheat_field(p, -1.85, -1.85, 3.7, 2.35, 7, 15, skip=lambda r, i: r < 2)
    # stubble where the tractor works
    for i in range(14):
        box(p, (0.12, 0.03, 0.04), (-1.6 + i * 0.25, -1.5, 0.11), '#D8B85A', bevel=0, name='stubble')
        box(p, (0.12, 0.03, 0.04), (-1.5 + i * 0.25, -1.2, 0.11), '#D8B85A', bevel=0, name='stubble')
    # steel barn
    bx, by = -1.0, 1.25
    box(p, (1.6, 1.05, 0.8), (bx, by, 0.46), '#C9D2DA', bevel=0.02, name='barn')
    for i in range(9):
        box(p, (0.02, 1.07, 0.8), (bx - 0.75 + i * 0.19, by, 0.46), '#AFBAC5', bevel=0, name='rib')
    cyl(p, 0.53, 0.53, 1.6, (bx, by, 0.86), '#8FA2B4', seg=20, rot=(0, math.pi / 2, 0), name='vault')
    box(p, (0.7, 0.05, 0.62), (bx, by - 0.53, 0.42), '#E8665A', bevel=0.01, name='barndoor')
    box(p, (0.02, 0.055, 0.62), (bx, by - 0.535, 0.42), P['white'], bevel=0, name='doorline')
    window(p, bx + 0.6, by - 0.53, 0.55, w=0.22, h=0.2)
    lamp_post(p, bx - 0.55, by - 0.6, 0.06, 0.65)
    # combine harvester parked by the barn
    hx, hy = 0.15, 0.6
    box(p, (0.6, 0.36, 0.3), (hx, hy, 0.36), '#7CC36A', bevel=0.03, name='combine')
    box(p, (0.24, 0.3, 0.24), (hx + 0.15, hy, 0.62), '#7CC36A', bevel=0.02, name='combinecab')
    box(p, (0.22, 0.31, 0.16), (hx + 0.15, hy, 0.64), P['glass'], kind='G', bevel=0.005, name='cabglass')
    box(p, (0.12, 0.7, 0.14), (hx - 0.38, hy, 0.24), '#F2C14E', bevel=0.02, name='header')
    for k in range(5):
        box(p, (0.03, 0.66, 0.02), (hx - 0.44, hy, 0.18 + k * 0.025), '#D8A63A', bevel=0, name='reel')
    cyl(p, 0.035, 0.035, 0.5, (hx + 0.1, hy + 0.2, 0.62), '#7CC36A', seg=8, rot=(0.6, 0, 0.8), name='spout')
    for sx, r in ((-0.15, 0.15), (0.22, 0.1)):
        for sy in (-0.2, 0.2):
            cyl(p, r, r, 0.08, (hx + sx, hy + sy, r + 0.05), P['dark'], seg=14, rot=(math.pi / 2, 0, 0), name='tyre')
    # twin silos with a conveyor up to the top
    for x in (0.65, 1.15):
        cyl(p, 0.26, 0.26, 1.55, (x, 1.35, 0.84), '#E8E2D6', seg=16, name='silo')
        ball(p, 0.26, (x, 1.35, 1.61), '#6FA8DC', scale=(1, 1, 0.7), name='dome')
        for z in (0.4, 0.85, 1.3):
            cyl(p, 0.27, 0.27, 0.03, (x, 1.35, z), P['stone2'], seg=16, bevel=0, name='band')
    box(p, (0.6, 0.06, 0.06), (0.9, 1.35, 1.52), P['metal'], bevel=0, name='conveyor')
    box(p, (0.08, 0.08, 1.4), (1.5, 1.0, 0.8), P['metal'], rot=(0.45, 0, 0), bevel=0, name='elevator')
    box(p, (0.3, 0.3, 0.2), (1.5, 0.75, 0.16), '#C9D2DA', bevel=0.02, name='hopper')
    cyl(p, 0.16, 0.16, 0.5, (1.55, 0.3, 0.26), '#7CC36A', seg=14, rot=(0, math.pi / 2, 0), name='tank')
    for k in range(3):
        cyl(p, 0.07, 0.07, 0.18, (-1.7 + k * 0.16, 0.55, 0.15), '#E8665A' if k % 2 else '#5D8FD0', seg=10, name='drum')
    wind_pump(p, 1.55, -0.05, 1.4, P['metal'], metal=True)
    fence(p, -1.85, 0.42, -0.4, 0.42, P['white'], n=8)
    # the tractor: drives along the stubble rows while the farm works (drive_ part, see src/render/animation.ts)
    t = part(p, 'drive_tractor', (0.0, -1.35, 0.06))
    box(t, (0.46, 0.24, 0.18), (0, 0, 0.2), '#D9443A', bevel=0.03, name='tractorbody')
    box(t, (0.2, 0.22, 0.22), (-0.11, 0, 0.4), '#D9443A', bevel=0.02, name='cab')
    box(t, (0.18, 0.23, 0.13), (-0.11, 0, 0.41), P['glass'], kind='G', bevel=0.005, name='cabglass')
    box(t, (0.22, 0.26, 0.03), (-0.11, 0, 0.53), '#D9443A', bevel=0.01, name='cabroof')
    for (dx, r) in ((-0.13, 0.13), (0.17, 0.08)):
        for dy in (-0.15, 0.15):
            cyl(t, r, r, 0.07, (dx, dy, r), P['dark'], seg=14, rot=(math.pi / 2, 0, 0), name='tyre')
    cyl(t, 0.022, 0.028, 0.18, (0.13, 0.06, 0.38), P['dark'], seg=6, name='exhaust')
    box(t, (0.12, 0.5, 0.05), (-0.36, 0, 0.12), P['metal'], bevel=0.008, name='harrow')
    for k in range(5):
        box(t, (0.03, 0.03, 0.08), (-0.36, -0.2 + k * 0.1, 0.07), P['metal'], bevel=0, name='tine')

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
            ball(p, 0.085, (x, y, 0.42), P['leaf'] if col != '#F2766B' else '#6DB36A', name='plant')
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
        box(p, (L + 0.04, side, 0.025), (x0, y0 + sy * D / 4, 0.22 + H + 0.275), '#DDF0F7', rot=(-sy * a, 0, 0), bevel=0.003, kind='G', name='roofglass')
    for i in range(7):
        x = x0 - L / 2 + i * L / 6
        for sy in (-1, 1):
            box(p, (0.035, 0.035, H), (x, y0 + sy * D / 2, 0.22 + H / 2), P['white'], bevel=0.004, name='mullion')
            box(p, (0.035, side, 0.035), (x, y0 + sy * D / 4, 0.22 + H + 0.29), P['white'], rot=(-sy * a, 0, 0), bevel=0.004, name='rafter')
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
            ball(p, 0.06, (x, y0 - D_ / 2 + 0.09, z + 0.16), '#6DB36A', name='leafy')
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


def greenhouse_more():
    """roof vents that open while the greenhouse works, seedlings and tools outside"""
    p = bpy.data.objects['greenhouse']
    L, D, H = 2.2, 1.8, 0.75
    x0, y0 = -0.15, 0.15
    a = math.atan2(0.55, D / 2)
    s = math.hypot(0.55, D / 2)
    zr = 0.22 + H + 0.55
    for vx in (x0 - 0.55, x0 + 0.55):
        e = part(p, 'swingx_skylight', (vx, y0 - 0.02, zr + 0.03))
        dy, dz = -(D / 2) / s, -0.55 / s
        box(e, (0.5, 0.34, 0.03), (0, dy * 0.18 + 0.01, dz * 0.18 + 0.02), P['white'], rot=(a, 0, 0), bevel=0.004, name='ventframe')
        box(e, (0.44, 0.3, 0.035), (0, dy * 0.18 + 0.01, dz * 0.18 + 0.02), '#DDF0F7', rot=(a, 0, 0), bevel=0.003, kind='G', name='ventglass')
    # seedling trays on a trestle table by the door
    box(p, (0.7, 0.3, 0.04), (0.55, -1.15, 0.36), P['wood'], bevel=0.006, name='table')
    for sx in (-1, 1):
        box(p, (0.04, 0.26, 0.24), (0.55 + sx * 0.3, -1.15, 0.22), P['wood2'], bevel=0, name='trestle')
    for k in range(3):
        box(p, (0.2, 0.24, 0.04), (0.33 + k * 0.22, -1.15, 0.4), P['terracotta'], bevel=0.006, name='tray')
        for j in range(4):
            ball(p, 0.03, (0.27 + k * 0.22 + (j % 2) * 0.1, -1.2 + (j // 2) * 0.1, 0.45), P['sprout'], name='seedling')
    cyl(p, 0.12, 0.12, 0.3, (-1.15, -0.85, 0.25), P['wood'], seg=12, name='waterbutt')
    cyl(p, 0.1, 0.1, 0.01, (-1.15, -0.85, 0.4), P['water'], seg=12, bevel=0, name='water')
    cyl(p, 0.06, 0.05, 0.1, (-0.85, -1.05, 0.15), '#6DB36A', seg=10, name='wateringcan')
    cyl(p, 0.01, 0.01, 0.14, (-0.78, -1.05, 0.2), '#6DB36A', seg=4, rot=(0, 0.9, 0), name='spout')
    for k in range(5):
        ball(p, 0.07, (1.0 + (k % 3) * 0.1, 0.35 + (k // 3) * 0.08, 0.14 + (k // 3) * 0.06), P['dark'], name='coal')

def hydroponic_more():
    """a cooling unit with a fan, a little electric delivery van with its lights on"""
    p = bpy.data.objects['hydroponic']
    box(p, (0.45, 0.4, 0.32), (1.15, 0.85, 0.28), '#C9D2DA', bevel=0.02, name='coolingunit')
    for k in range(4):
        box(p, (0.46, 0.41, 0.012), (1.15, 0.85, 0.16 + k * 0.06), '#9FB3C3', bevel=0, name='fin')
    e = part(p, 'spiny_vent', (1.15, 0.85, 0.45))
    cyl(e, 0.15, 0.15, 0.03, (0, 0, 0.01), P['metal'], seg=12, name='fanring')
    for k in range(4):
        box(e, (0.26, 0.06, 0.01), (0, 0, 0.02), P['dark'], rot=(0.3, 0, k * math.pi / 4), bevel=0, name='fanblade')
    vx, vy = 0.6, -1.0
    box(p, (0.55, 0.28, 0.24), (vx, vy, 0.3), P['white'], bevel=0.03, name='van')
    box(p, (0.2, 0.28, 0.16), (vx - 0.33, vy, 0.26), P['white'], bevel=0.03, name='vancab')
    box(p, (0.03, 0.26, 0.1), (vx - 0.43, vy, 0.3), P['glass'], kind='G', bevel=0, name='windscreen')
    box(p, (0.56, 0.29, 0.06), (vx, vy, 0.3), '#7CC36A', bevel=0, name='vanstripe')
    for sy in (-0.09, 0.09):
        box(p, (0.02, 0.05, 0.03), (vx - 0.44, vy + sy, 0.21), '#FFE29A', kind='G', bevel=0, name='headlight')
    for sx in (-0.3, 0.15):
        for sy in (-0.14, 0.14):
            cyl(p, 0.06, 0.06, 0.04, (vx + sx, vy + sy, 0.18), P['dark'], seg=10, rot=(math.pi / 2, 0, 0), name='wheel')
    for k in range(3):
        crate(p, vx + 0.42, vy - 0.1 + k * 0.1, 0.12, 0.12, '#8FD16A')

for f in (fishery, fishpier, fishport, garden, vegfield, compost, greenhouse, hydroponic, herbalist, clinic, hospital, farm, mechfarm):
    f()
greenhouse_more()
hydroponic_more()
