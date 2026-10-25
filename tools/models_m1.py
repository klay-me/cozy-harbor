# Milestone 1 models: houses for the later tiers, workshops, industry, power and civic buildings.
# Executed inside tools/models.py (shares its helpers and palette).

def smoke(p, x, y, z, i=0):
    """Marks a chimney top: the game puffs smoke here while the building works."""
    e = bpy.data.objects.new(f'smoke_{p.name}_{i}', None)
    COL.objects.link(e)
    e.parent = p
    e.location = (x, y, z)
    return e

def chimney(p, x, y, z0, h, r=0.12, col=None, cap=None, i=0, square=False):
    col = col or P['brick']
    if square:
        box(p, (r * 2, r * 2, h), (x, y, z0 + h / 2), col, bevel=0.02, name='chimney')
        box(p, (r * 2 + 0.06, r * 2 + 0.06, 0.06), (x, y, z0 + h), cap or shade(col, 0.85), bevel=0.012, name='chimcap')
    else:
        cyl(p, r, r * 1.12, h, (x, y, z0 + h / 2), col, seg=12, name='stack')
        cyl(p, r * 1.2, r * 1.2, 0.07, (x, y, z0 + h - 0.03), cap or shade(col, 0.8), seg=12, name='stackcap')
        for k in range(2):
            cyl(p, r * 1.15, r * 1.15, 0.03, (x, y, z0 + h * (0.35 + 0.3 * k)), P['white'], seg=12, bevel=0, name='stackband')
    smoke(p, x, y, z0 + h + 0.05, i)

def flat_roof(p, w, d, z, col, x0=0, y0=0, parapet=None):
    box(p, (w, d, 0.08), (x0, y0, z + 0.04), col, bevel=0.02, name='flatroof')
    if parapet:
        for sx in (-1, 1):
            box(p, (0.06, d, 0.12), (x0 + sx * (w / 2 - 0.03), y0, z + 0.12), parapet, bevel=0.01, name='parapet')
            box(p, (w, 0.06, 0.12), (x0, y0 + sx * (d / 2 - 0.03), z + 0.12), parapet, bevel=0.01, name='parapet')

def roof_y(p, w, d, h, z0, col, thick=0.08, oh=0.12, x0=0, y0=0, ridge=None, rows=True):
    """Gable roof whose ridge runs along Y (w across X, d along Y)."""
    hw = w / 2
    a = math.atan2(h, hw)
    s = math.hypot(hw, h)
    L = s + oh
    for sgn in (-1, 1):
        ux, uz = sgn * hw / s, -h / s
        nx, nz = sgn * h / s, hw / s
        cx, cz = ux * L / 2 + nx * thick / 2, z0 + h + uz * L / 2 + nz * thick / 2
        box(p, (L, d + 2 * oh, thick), (x0 + cx, y0, cz), col, rot=(0, sgn * a, 0), bevel=0.025, name='roof')
        if rows and thick < 0.12:
            dark = shade(col, 0.84)
            k = 0
            while 0.09 + k * 0.12 < L - 0.04:
                dd = 0.09 + k * 0.12
                box(p, (0.035, d + 2 * oh - 0.02, 0.022), (x0 + ux * dd + nx * (thick + 0.006), y0, z0 + h + uz * dd + nz * (thick + 0.006)), dark, rot=(0, sgn * a, 0), bevel=0.006, seg=1, name='tilerow')
                k += 1
    if ridge:
        cyl(p, thick * 0.75, thick * 0.75, d + 2 * oh + 0.02, (x0, y0, z0 + h + thick * 0.55), ridge, seg=10, rot=(math.pi / 2, 0, 0), name='ridge')

def window_row(p, xs, y, z, face='front', w=0.2, h=0.24, **kw):
    for x in xs:
        window(p, x, y, z, face=face, w=w, h=h, **kw)

def sawtooth(p, w, d, z0, n, col, glass=True, x0=0, y0=0):
    """Factory sawtooth roof: n ridges along X, glazing facing back (+Y)."""
    step = d / n
    for i in range(n):
        y = y0 - d / 2 + step * (i + 0.5)
        poly_prism(p, [(-step / 2, 0), (step / 2, 0), (step / 2, 0.36)], w, (x0, y, z0), col, bevel=0.015, name='tooth')
        if glass:
            box(p, (w - 0.1, 0.03, 0.3), (x0, y + step / 2 - 0.02, z0 + 0.18), P['glass'], kind='G', bevel=0.004, name='skylight')

def tree_small(p, x, y, s=1.0, col=None):
    cyl(p, 0.035 * s, 0.045 * s, 0.25 * s, (x, y, 0.125 * s), P['trunk'], seg=6, name='trunk')
    ball(p, 0.19 * s, (x, y, 0.36 * s), col or P['leaf'], kind='L', name='crown')
    ball(p, 0.13 * s, (x + 0.08 * s, y - 0.05 * s, 0.47 * s), P['leaf2'], kind='L', name='crown')

def fence(p, x0, y0, x1, y1, col=None, n=None):
    col = col or P['white']
    L = math.hypot(x1 - x0, y1 - y0)
    n = n or max(2, int(L / 0.2))
    rz = math.atan2(y1 - y0, x1 - x0)
    for i in range(n + 1):
        t = i / n
        box(p, (0.035, 0.035, 0.2), (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.1), col, bevel=0.006, name='picket')
    box(p, (L, 0.025, 0.03), ((x0 + x1) / 2, (y0 + y1) / 2, 0.15), col, rot=(0, 0, rz), bevel=0.004, name='rail')

# ---------------------------------------------------------------- houses
BRICKS = ['#D46E58', '#C9795C', '#B9654F', '#D98C62']
TECH_ROOF = ['#5A6B7F', '#7E5A4E', '#4E6E5E', '#6B5A7E']
def house_technician(v):
    p = root(f'house_technician_{v}')
    bc = BRICKS[v]
    box(p, (1.7, 1.55, 0.14), (0, 0.02, 0.07), P['stone2'], bevel=0.03, name='base')
    box(p, (1.42, 1.15, 1.75), (0, 0.06, 1.0), bc, bevel=0.03, name='walls')
    # brick courses
    for k in range(9):
        box(p, (1.435, 1.165, 0.018), (0, 0.06, 0.24 + k * 0.19), shade(bc, 0.86), bevel=0, name='course')
    for z in (0.7, 1.32):
        box(p, (1.5, 1.23, 0.06), (0, 0.06, z), P['stone'], bevel=0.012, name='cornice')
    box(p, (1.56, 1.29, 0.1), (0, 0.06, 1.9), P['stone'], bevel=0.02, name='cornice')
    # mansard-ish roof with dormers
    roof(p, 1.42, 1.15, 0.42, 1.95, TECH_ROOF[v], thick=0.08, oh=0.08, y0=0.06, ridge=P['dark'])
    gable_fill(p, 1.42, 1.15, 0.42, 1.95, bc, y0=0.06)
    for x in (-0.36, 0.36):
        box(p, (0.26, 0.24, 0.26), (x, -0.36, 2.12), bc, bevel=0.015, name='dormer')
        roof(p, 0.26, 0.26, 0.12, 2.25, TECH_ROOF[v], thick=0.04, oh=0.04, x0=x, y0=-0.36)
        window(p, x, -0.49, 2.12, w=0.14, h=0.14)
    door(p, 0, -0.52, 0.14, w=0.3, h=0.46, col='#4E6E8E')
    box(p, (0.5, 0.18, 0.05), (0, -0.62, 0.62), P['stone'], bevel=0.01, name='hood')
    window_row(p, (-0.46, 0.46), -0.52, 0.42, w=0.22, h=0.3)
    for z in (1.0, 1.6):
        window_row(p, (-0.46, 0.0, 0.46), -0.52, z, w=0.22, h=0.3, box_col=P['red'] if (v + int(z * 10)) % 2 else None)
        window_row(p, (-0.25, 0.25), 0.06, z, face='right', w=0.2, h=0.28)
    chimney(p, -0.5, 0.35, 1.9, 0.6, r=0.1, col=shade(bc, 0.9), square=True)
    box(p, (0.36, 0.14, 0.06), (0, -0.62, 0.03), P['stone'], bevel=0.015, name='step')
    barrel(p, 0.7, -0.6, 0.0, 0.09, 0.22)
    flowers(p, -0.7, -0.62, 0.1)

CIT_ACCENT = ['#F2766B', '#6FA8DC', '#7CC36A', '#F2B33D']
def house_citizen(v):
    p = root(f'house_citizen_{v}')
    ac = CIT_ACCENT[v]
    box(p, (1.75, 1.6, 0.12), (0, 0, 0.06), '#DCD6CC', bevel=0.03, name='base')
    floors = 5
    fh = 0.48
    box(p, (1.36, 1.2, fh * floors), (0, 0.08, 0.12 + fh * floors / 2), '#F4F1EA', bevel=0.03, name='tower')
    # coloured side panel and balconies
    box(p, (0.36, 1.22, fh * floors - 0.1), (0.52, 0.08, 0.12 + fh * floors / 2), ac, bevel=0.02, name='panel')
    for f in range(floors):
        z = 0.12 + fh * f + fh * 0.5
        window_row(p, (-0.42, -0.08), -0.53, z, w=0.24, h=0.26)
        window(p, 0.52, -0.53, z, w=0.2, h=0.26)
        if f >= 1:
            box(p, (0.78, 0.22, 0.04), (-0.25, -0.62, z - 0.18), '#E9E4DA', bevel=0.01, name='balcony')
            box(p, (0.78, 0.02, 0.14), (-0.25, -0.72, z - 0.1), P['glass'], kind='G', bevel=0.003, name='railglass')
            if (f + v) % 2:
                ball(p, 0.06, (-0.55, -0.66, z - 0.1), P['leaf'], kind='L', name='plant')
        window_row(p, (-0.3, 0.2), 0.08, z, face='left', w=0.22, h=0.26)
    top = 0.12 + fh * floors
    flat_roof(p, 1.42, 1.26, top, '#CFC8BC', y0=0.08, parapet='#E9E4DA')
    # roof garden and water tank
    for x, y in ((-0.35, -0.2), (-0.1, 0.25)):
        ball(p, 0.12, (x, y, top + 0.18), P['leaf2'], kind='L', name='rooftree')
    cyl(p, 0.16, 0.16, 0.3, (0.38, 0.3, top + 0.25), '#B9C2CF', seg=12, name='tank')
    door(p, -0.2, -0.53, 0.12, w=0.36, h=0.42, col=P['glass'], arch=False)
    box(p, (0.6, 0.3, 0.04), (-0.2, -0.7, 0.62), ac, bevel=0.01, name='canopy')
    tree_small(p, 0.68, -0.62, 0.8)

# ---------------------------------------------------------------- era 1 additions
def sheepfarm():
    p = root('sheepfarm')
    box(p, (2.8, 2.8, 0.06), (0, 0, 0.03), '#9ED36A', bevel=0.02, name='meadow')
    for x0, y0, x1, y1 in ((-1.3, -1.3, 1.3, -1.3), (1.3, -1.3, 1.3, 1.3), (1.3, 1.3, -1.3, 1.3), (-1.3, 1.3, -1.3, -1.3)):
        fence(p, x0, y0, x1, y1, P['wood'], n=12)
    # barn
    box(p, (1.1, 0.8, 0.6), (-0.65, 0.65, 0.36), '#C9583F', bevel=0.03, name='barn')
    gable_fill(p, 1.1, 0.8, 0.45, 0.66, '#C9583F', x0=-0.65, y0=0.65)
    roof(p, 1.1, 0.8, 0.45, 0.66, '#7E8A9A', thick=0.07, oh=0.1, x0=-0.65, y0=0.65, ridge=P['dark'])
    box(p, (0.4, 0.05, 0.42), (-0.65, 0.24, 0.27), P['white'], bevel=0.01, name='barndoor')
    box(p, (0.34, 0.06, 0.36), (-0.65, 0.235, 0.27), '#A84A35', bevel=0.008, name='barndoor')
    # hay bales and trough
    for x, y in ((0.2, 0.9), (0.45, 0.95), (0.32, 0.92)):
        cyl(p, 0.14, 0.14, 0.22, (x, y, 0.16 + (0.18 if x == 0.32 else 0)), P['hay'], seg=12, rot=(0, math.pi / 2, 0), name='hay')
    box(p, (0.5, 0.18, 0.12), (0.7, -0.05, 0.12), P['wood2'], bevel=0.015, name='trough')
    box(p, (0.44, 0.12, 0.02), (0.7, -0.05, 0.18), P['water'], bevel=0, name='troughwater')
    # sheep
    random.seed(31)
    for i, (x, y) in enumerate(((-0.6, -0.5), (-0.1, -0.8), (0.4, -0.55), (0.85, -0.85), (0.1, -0.15), (0.75, 0.45), (-0.95, -0.95))):
        rz = random.uniform(0, 6.28)
        ball(p, 0.16, (x, y, 0.2), '#FFFAF0', scale=(1.25, 0.9, 0.85), name='fleece', rot=(0, 0, rz))
        hx, hy = x + math.cos(rz) * 0.2, y + math.sin(rz) * 0.2
        ball(p, 0.07, (hx, hy, 0.24), '#3B3346', scale=(1.2, 0.9, 1), name='head', rot=(0, 0, rz))
        for lx, ly in ((0.08, 0.06), (-0.08, 0.06), (0.08, -0.06), (-0.08, -0.06)):
            c, s = math.cos(rz), math.sin(rz)
            cyl(p, 0.02, 0.02, 0.12, (x + lx * c - ly * s, y + lx * s + ly * c, 0.06), '#3B3346', seg=5, name='leg')
    tree_small(p, 1.0, 1.0, 1.1)

def study():
    p = root('study')
    box(p, (1.7, 1.6, 0.12), (0, 0, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.3, 0.95, 0.7), (0, 0.15, 0.47), '#F7E9D0', bevel=0.03)
    for x in (-0.65, 0.65):
        for y in (-0.33, 0.63):
            box(p, (0.08, 0.08, 0.72), (x, y, 0.47), P['beam'], bevel=0.01, name='post')
    gable_fill(p, 1.3, 0.95, 0.5, 0.82, '#F7E9D0', y0=0.15)
    roof(p, 1.3, 0.95, 0.5, 0.82, '#5D8FD0', thick=0.08, oh=0.14, y0=0.15, ridge=P['beam'])
    door(p, 0, -0.33, 0.12, w=0.28, h=0.44, col='#A06A42')
    window_row(p, (-0.38, 0.38), -0.33, 0.5, w=0.24, h=0.24, shutters='#5D8FD0')
    # bell on a little post and a book sign
    box(p, (0.05, 0.05, 0.9), (0.72, -0.6, 0.45), P['beam'], bevel=0.008, name='bellpost')
    box(p, (0.3, 0.05, 0.05), (0.62, -0.6, 0.88), P['beam'], bevel=0.006, name='bellarm')
    cyl(p, 0.08, 0.05, 0.12, (0.52, -0.6, 0.78), P['gold'], seg=12, name='bell')
    box(p, (0.34, 0.06, 0.24), (0, -0.39, 0.9), P['white'], bevel=0.01, name='signboard')
    box(p, (0.12, 0.07, 0.14), (-0.06, -0.4, 0.9), '#E8665A', rot=(0, 0, 0.15), bevel=0.006, name='book')
    box(p, (0.12, 0.07, 0.14), (0.07, -0.4, 0.9), '#6FA8DC', rot=(0, 0, -0.15), bevel=0.006, name='book')
    # bench and tree
    box(p, (0.5, 0.14, 0.04), (-0.55, -0.62, 0.2), P['wood'], bevel=0.008, name='bench')
    for sx in (-0.2, 0.2):
        box(p, (0.04, 0.12, 0.18), (-0.55 + sx, -0.62, 0.09), P['wood2'], bevel=0.005, name='benchleg')
    tree_small(p, -0.7, 0.75, 0.9)

def church():
    p = root('church')
    box(p, (2.7, 2.7, 0.12), (0, 0, 0.06), '#E9E1D2', bevel=0.03, name='churchyard')
    # nave
    box(p, (1.2, 1.9, 1.05), (0.2, 0.2, 0.64), P['plaster'], bevel=0.03, name='nave')
    poly_prism(p, [(-0.6, 0), (0.6, 0), (0, 0.7)], 1.9, (0.2, 0.2, 1.16), P['plaster'], rot=(0, 0, math.pi / 2), bevel=0.02, name='navegable')
    roof_y(p, 1.2, 1.9, 0.72, 1.16, '#C9583F', thick=0.09, oh=0.12, x0=0.2, y0=0.2, ridge=P['beam'])
    for y in (-0.35, 0.2, 0.75):
        for sx in (-1, 1):
            window(p, 0.2 + sx * 0.61, y, 0.75, face='right' if sx > 0 else 'left', w=0.16, h=0.42)
    # rose window on the front gable and the door
    cyl(p, 0.2, 0.2, 0.04, (0.2, -0.76, 1.4), P['white'], seg=18, rot=(math.pi / 2, 0, 0), name='roseframe')
    cyl(p, 0.16, 0.16, 0.05, (0.2, -0.765, 1.4), '#E9B8D6', seg=18, rot=(math.pi / 2, 0, 0), kind='G', name='rose')
    door(p, 0.2, -0.76, 0.12, w=0.36, h=0.6, col='#8A5A3C')
    # bell tower
    tx, ty = -0.75, -0.55
    box(p, (0.62, 0.62, 2.1), (tx, ty, 1.17), P['stone'], bevel=0.03, name='tower')
    for k in range(5):
        box(p, (0.64, 0.64, 0.03), (tx, ty, 0.5 + k * 0.4), P['stone2'], bevel=0, name='course')
    box(p, (0.7, 0.7, 0.08), (tx, ty, 2.25), P['stone2'], bevel=0.015, name='belfry')
    box(p, (0.66, 0.66, 0.4), (tx, ty, 2.49), P['stone'], bevel=0.02, name='belfrywall')
    # arched bell openings: a dark recess standing proud of the wall, with a white frame
    for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        rz = 0 if sx == 0 else math.pi / 2
        box(p, (0.2, 0.03, 0.26), (tx + sx * 0.342, ty + sy * 0.342, 2.45), P['dark'], rot=(0, 0, rz), bevel=0.004, name='louvre')
        cyl(p, 0.1, 0.1, 0.03, (tx + sx * 0.342, ty + sy * 0.342, 2.58), P['dark'], seg=12, rot=(math.pi / 2, 0, rz), name='louvrearch')
        box(p, (0.28, 0.025, 0.04), (tx + sx * 0.355, ty + sy * 0.355, 2.31), P['white'], rot=(0, 0, rz), bevel=0.004, name='sill')
    cyl(p, 0.47, 0.0, 0.85, (tx, ty, 3.12), '#5D8FD0', seg=4, rot=(0, 0, math.pi / 4), name='spire', smooth=False)
    box(p, (0.03, 0.03, 0.3), (tx, ty, 3.65), P['gold'], bevel=0, name='cross')
    box(p, (0.16, 0.03, 0.03), (tx, ty, 3.7), P['gold'], bevel=0, name='cross')
    cyl(p, 0.13, 0.13, 0.03, (tx, ty - 0.315, 1.85), P['white'], seg=16, rot=(math.pi / 2, 0, 0), name='clock')
    window(p, tx, ty - 0.31, 1.25, w=0.14, h=0.34)
    # yard trees and path
    for x, y in ((1.05, -0.9), (1.1, 0.9), (-0.9, 0.8)):
        tree_small(p, x, y, 1.1, P['pine'] if x < 0 else None)
    box(p, (0.36, 0.6, 0.02), (0.2, -1.05, 0.13), '#D8CBB5', bevel=0.005, name='path')

# ---------------------------------------------------------------- era 2
def woodshed():
    p = root('woodshed')
    box(p, (1.7, 1.6, 0.08), (0, 0, 0.04), '#B9A285', bevel=0.02, name='yard')
    for x in (-0.65, 0.35):
        for y in (-0.15, 0.6):
            box(p, (0.07, 0.07, 0.75), (x, y, 0.45), P['beam'], bevel=0.01, name='post')
    roof(p, 1.15, 0.9, 0.3, 0.82, '#8B6A4E', thick=0.07, oh=0.12, x0=-0.15, y0=0.22, ridge=P['beam'])
    # stacked split firewood
    for row in range(4):
        for i in range(7):
            x = -0.55 + i * 0.13 + (row % 2) * 0.06
            cyl(p, 0.055, 0.055, 0.62, (x, 0.22, 0.14 + row * 0.11), '#A86C3E' if (i + row) % 2 else '#B87A48', seg=6, rot=(math.pi / 2, 0, 0), name='split')
    for i in range(7):
        cyl(p, 0.05, 0.05, 0.01, (-0.55 + i * 0.13, -0.09, 0.14), '#F1C99A', seg=6, rot=(math.pi / 2, 0, 0), bevel=0, name='endcap')
    # chopping block and basket
    cyl(p, 0.17, 0.2, 0.24, (0.6, -0.4, 0.16), '#A86C3E', seg=12, name='stump')
    cyl(p, 0.02, 0.02, 0.36, (0.6, -0.4, 0.42), P['beam'], seg=6, rot=(0.4, 0, 0), name='handle')
    box(p, (0.03, 0.14, 0.08), (0.6, -0.47, 0.29), P['metal'], rot=(0.4, 0, 0), bevel=0.008, name='axehead')
    cyl(p, 0.16, 0.13, 0.2, (0.6, 0.45, 0.14), '#D9B27A', seg=12, name='basket')
    for i in range(3):
        cyl(p, 0.04, 0.04, 0.3, (0.55 + i * 0.05, 0.45, 0.28), '#B87A48', seg=6, rot=(0.3 * (i - 1), math.pi / 2, 0), name='kindling')
    chimney(p, -0.6, 0.62, 0.8, 0.3, r=0.07, col=P['stone2'], square=True)

def claypit():
    p = root('claypit')
    box(p, (1.75, 1.75, 0.06), (0, 0, 0.03), '#C9A27A', bevel=0.02, name='ground')
    cyl(p, 0.62, 0.5, 0.06, (0.1, 0.05, 0.05), '#B5714E', seg=20, name='pit', smooth=True)
    cyl(p, 0.48, 0.48, 0.02, (0.1, 0.05, 0.085), '#8EC5D9', seg=20, bevel=0, name='puddle')
    for i in range(6):
        a = i * 1.05
        ball(p, 0.11, (0.1 + math.cos(a) * 0.62, 0.05 + math.sin(a) * 0.62, 0.08), '#D98A5F', scale=(1.2, 1, 0.6), name='mound')
    # shed and drying racks
    box(p, (0.5, 0.42, 0.45), (-0.55, 0.55, 0.28), P['wood'], bevel=0.02, name='shed')
    roof(p, 0.56, 0.48, 0.2, 0.5, '#7E8A9A', thick=0.05, oh=0.06, x0=-0.55, y0=0.55)
    for k in range(3):
        box(p, (0.5, 0.05, 0.03), (0.55, -0.55 + k * 0.08, 0.32 - k * 0.07), P['wood2'], bevel=0.004, name='rack')
        for i in range(4):
            box(p, (0.08, 0.06, 0.05), (0.38 + i * 0.11, -0.55 + k * 0.08, 0.36 - k * 0.07), '#D98A5F', bevel=0.008, name='clayblock')
    # wheelbarrow and shovel
    box(p, (0.24, 0.16, 0.1), (-0.5, -0.45, 0.16), '#7E8A9A', bevel=0.015, name='barrow')
    cyl(p, 0.06, 0.06, 0.03, (-0.36, -0.45, 0.07), P['dark'], seg=10, rot=(0, math.pi / 2, 0), name='wheel')
    cyl(p, 0.012, 0.012, 0.5, (-0.25, 0.1, 0.25), P['beam'], seg=5, rot=(0.3, 0.2, 0), name='shovel')

def brickworks():
    p = root('brickworks')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), P['stone2'], bevel=0.03, name='base')
    # beehive kiln
    cyl(p, 0.52, 0.42, 0.55, (-0.3, 0.25, 0.4), P['brick'], seg=16, name='kiln')
    ball(p, 0.42, (-0.3, 0.25, 0.66), P['brick'], scale=(1, 1, 0.7), seg=16, rings=8, name='dome')
    for k in range(3):
        cyl(p, 0.525 - k * 0.03, 0.525 - k * 0.03, 0.03, (-0.3, 0.25, 0.2 + k * 0.17), P['brick2'], seg=16, bevel=0, name='course')
    box(p, (0.26, 0.1, 0.24), (-0.3, -0.22, 0.25), '#2E2633', bevel=0.02, name='mouth')
    box(p, (0.2, 0.05, 0.14), (-0.3, -0.24, 0.24), '#F2A541', kind='G', bevel=0.01, name='fire')
    chimney(p, 0.35, 0.55, 0.12, 1.55, r=0.13, col=P['brick'])
    # brick pallets
    for px, py in ((0.45, -0.4), (0.45, -0.05)):
        box(p, (0.42, 0.3, 0.05), (px, py, 0.15), P['wood2'], bevel=0.006, name='pallet')
        for lz in range(3):
            for i in range(3):
                box(p, (0.12, 0.26, 0.07), (px - 0.13 + i * 0.13, py, 0.21 + lz * 0.075), '#D9674F' if (i + lz) % 2 else '#E07A5F', bevel=0.008, name='brick')
    box(p, (0.5, 0.36, 0.42), (-0.55, -0.55, 0.33), P['wood'], bevel=0.02, name='hut')
    roof(p, 0.56, 0.42, 0.2, 0.54, '#5A6B7F', thick=0.05, oh=0.06, x0=-0.55, y0=-0.55)

def weaver():
    p = root('weaver')
    box(p, (1.75, 1.6, 0.12), (0, 0.02, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.45, 1.1, 0.75), (0, 0.12, 0.5), '#F3E1EA', bevel=0.03, name='walls')
    sawtooth(p, 1.45, 1.1, 0.875, 3, '#B87AA3', x0=0, y0=0.12)
    box(p, (1.5, 1.15, 0.05), (0, 0.12, 0.875), P['white'], bevel=0.01, name='band')
    window_row(p, (-0.5, -0.17, 0.17, 0.5), -0.44, 0.52, w=0.2, h=0.34)
    door(p, 0.62, -0.44, 0.12, w=0.22, h=0.4, col='#8A5A7C', arch=False)
    # hanging cloth lengths outside
    for i, col in enumerate(('#E9B8D6', '#9ED3F0', '#FFE07A', '#C7A6F2')):
        box(p, (0.14, 0.02, 0.4), (-0.6 + i * 0.2, -0.62, 0.42), col, bevel=0.004, name='cloth')
    box(p, (0.95, 0.03, 0.03), (-0.3, -0.62, 0.64), P['beam'], bevel=0, name='line')
    for x in (-0.75, 0.15):
        box(p, (0.04, 0.04, 0.64), (x, -0.62, 0.32), P['beam'], bevel=0.005, name='linepost')
    # wool sacks
    for x in (0.55, 0.75):
        ball(p, 0.13, (x, -0.66, 0.2), '#FFFAF0', scale=(1, 0.9, 1.1), name='woolsack')

def tailor():
    p = root('tailor')
    box(p, (1.65, 1.5, 0.12), (0, 0.02, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.3, 1.0, 0.62), (0, 0.12, 0.43), '#DCEBF8', bevel=0.03)
    box(p, (1.42, 1.12, 0.07), (0, 0.12, 0.77), P['beam'], bevel=0.012)
    box(p, (1.3, 1.0, 0.55), (0, 0.12, 1.08), '#DCEBF8', bevel=0.03)
    gable_fill(p, 1.3, 1.0, 0.5, 1.36, '#DCEBF8', y0=0.12)
    roof(p, 1.3, 1.0, 0.52, 1.36, '#6B5A7E', thick=0.08, oh=0.13, y0=0.12, ridge=P['beam'])
    # shop window with a dress form
    box(p, (0.62, 0.04, 0.42), (-0.25, -0.39, 0.42), P['white'], bevel=0.01, name='shopframe')
    box(p, (0.56, 0.05, 0.36), (-0.25, -0.395, 0.42), P['glass'], kind='G', bevel=0.004, name='shopglass')
    awning_striped(p, -0.25, -0.5, 0.72, 0.7, 0.26, ['#7FB6E0', P['white']], tilt=0.4, stripes=5)
    door(p, 0.4, -0.39, 0.12, w=0.24, h=0.42, col='#6B5A7E')
    window_row(p, (-0.35, 0.35), -0.39, 1.08, w=0.22, h=0.24, box_col=P['pink'])
    # dress form on the step and sign with scissors
    cyl(p, 0.015, 0.015, 0.3, (0.72, -0.6, 0.27), P['dark'], seg=5, name='stand')
    ball(p, 0.09, (0.72, -0.6, 0.48), '#7FB6E0', scale=(1, 0.8, 1.4), name='dress')
    box(p, (0.03, 0.26, 0.2), (0.67, -0.25, 1.05), P['gold'], bevel=0.01, name='signboard')
    for a in (-0.4, 0.4):
        box(p, (0.02, 0.16, 0.025), (0.655, -0.25, 1.05), P['metal'], rot=(a, 0, 0), bevel=0, name='scissors')

def mine():
    p = root('mine')
    box(p, (1.75, 1.75, 0.08), (0, 0, 0.04), '#A39A8C', bevel=0.02, name='yard')
    # rocky hill with the adit
    ball(p, 0.7, (-0.15, 0.45, 0.1), '#9C9488', scale=(1.25, 0.9, 0.85), seg=10, rings=6, name='hill')
    ball(p, 0.4, (0.45, 0.6, 0.1), '#B1A99C', scale=(1, 0.9, 0.9), seg=8, rings=5, name='hill')
    box(p, (0.5, 0.3, 0.5), (-0.15, -0.15, 0.3), '#2E2633', bevel=0.03, name='adit')
    for sx in (-1, 1):
        box(p, (0.07, 0.07, 0.56), (-0.15 + sx * 0.27, -0.3, 0.32), P['beam'], bevel=0.01, name='prop')
    box(p, (0.66, 0.08, 0.08), (-0.15, -0.3, 0.6), P['beam'], bevel=0.01, name='lintel')
    lantern(p, 0.15, -0.34, 0.45)
    # rails and a mine cart
    for sx in (-0.07, 0.07):
        box(p, (0.025, 1.0, 0.02), (-0.15 + sx, -0.75, 0.09), P['metal'], bevel=0, name='rail')
    for i in range(6):
        box(p, (0.22, 0.04, 0.02), (-0.15, -0.35 - i * 0.15, 0.085), P['wood2'], bevel=0, name='sleeper')
    box(p, (0.24, 0.3, 0.16), (-0.15, -0.65, 0.2), '#7E8A9A', bevel=0.02, name='minecart')
    for sy in (-0.1, 0.1):
        cyl(p, 0.045, 0.045, 0.28, (-0.15, -0.65 + sy, 0.12), P['dark'], seg=8, rot=(0, math.pi / 2, 0), name='axle')
    ball(p, 0.12, (-0.15, -0.65, 0.3), '#6E6A73', scale=(1, 1.1, 0.5), name='load')
    # spoil heap and pick
    ball(p, 0.28, (0.6, -0.5, 0.06), '#8C8F9C', scale=(1, 1, 0.6), seg=8, rings=5, name='heap')
    cyl(p, 0.015, 0.015, 0.4, (0.55, 0.05, 0.25), P['beam'], seg=5, rot=(0.5, 0, 0.4), name='pick')

def smithy():
    p = root('smithy')
    box(p, (1.7, 1.6, 0.12), (0, 0.02, 0.06), P['stone2'], bevel=0.03, name='base')
    box(p, (1.0, 0.95, 0.75), (-0.3, 0.25, 0.5), P['stone'], bevel=0.03, name='walls')
    gable_fill(p, 1.0, 0.95, 0.45, 0.87, P['stone'], x0=-0.3, y0=0.25)
    roof(p, 1.0, 0.95, 0.47, 0.87, '#5A6B7F', thick=0.08, oh=0.12, x0=-0.3, y0=0.25, ridge=P['dark'])
    door(p, -0.45, -0.23, 0.12, w=0.3, h=0.46, col='#5A4A3E', arch=False)
    window(p, -0.05, -0.23, 0.5, w=0.2, h=0.2)
    chimney(p, -0.62, 0.45, 0.85, 0.6, r=0.11, col=P['stone2'], square=True)
    # open forge under a lean-to
    for x in (0.25, 0.75):
        box(p, (0.07, 0.07, 0.68), (x, -0.45, 0.46), P['beam'], bevel=0.01, name='post')
    poly_prism(p, [(-0.5, 0.82), (0.45, 0.66), (0.45, 0.72), (-0.5, 0.88)], 0.65, (0.5, 0.0, 0), '#8B6A4E', bevel=0.01, name='leanto')
    box(p, (0.36, 0.36, 0.3), (0.55, 0.15, 0.27), P['brick'], bevel=0.02, name='forge')
    box(p, (0.24, 0.24, 0.04), (0.55, 0.15, 0.43), '#F2A541', kind='G', bevel=0.01, name='embers')
    box(p, (0.26, 0.12, 0.08), (0.55, -0.25, 0.32), P['dark'], bevel=0.015, name='anvil')
    box(p, (0.1, 0.1, 0.2), (0.55, -0.25, 0.18), P['wood2'], bevel=0.01, name='anvilblock')
    box(p, (0.03, 0.12, 0.03), (0.6, -0.25, 0.38), P['metal'], rot=(0, 0, 0.6), bevel=0, name='hammer')
    # tool rack
    for i in range(3):
        cyl(p, 0.012, 0.012, 0.32, (0.15 + i * 0.07, 0.65, 0.3), P['beam'], seg=5, name='toolhandle')
        box(p, (0.05, 0.03, 0.07), (0.15 + i * 0.07, 0.65, 0.48), P['metal'], bevel=0.005, name='toolhead')
    barrel(p, 0.8, 0.55, 0.12, 0.1, 0.24)

def park():
    p = root('park')
    box(p, (1.8, 1.8, 0.06), (0, 0, 0.03), '#8FD16A', bevel=0.03, name='lawn')
    # curving path
    for i in range(9):
        t = i / 8
        x, y = -0.85 + t * 1.7, -0.3 + math.sin(t * 3.0) * 0.35
        cyl(p, 0.14, 0.14, 0.02, (x, y, 0.065), '#EADBBE', seg=10, bevel=0, name='pathstone')
    cyl(p, 0.3, 0.3, 0.05, (0.35, 0.45, 0.07), P['stone'], seg=18, name='pond')
    cyl(p, 0.26, 0.26, 0.02, (0.35, 0.45, 0.1), P['water'], seg=18, bevel=0, name='pondwater')
    ball(p, 0.04, (0.28, 0.42, 0.12), P['white'], scale=(1.4, 1, 1), name='duck')
    for x, y, s, c in ((-0.6, 0.55, 1.2, None), (-0.15, 0.7, 0.9, P['pine']), (0.7, -0.6, 1.1, None), (-0.7, -0.65, 0.8, '#F2A5C0')):
        tree_small(p, x, y, s, c)
    box(p, (0.42, 0.14, 0.04), (0.15, -0.55, 0.2), P['wood'], bevel=0.008, name='bench')
    box(p, (0.42, 0.03, 0.12), (0.15, -0.49, 0.28), P['wood'], bevel=0.006, name='benchback')
    flowers(p, 0.75, 0.0, 0.1)
    flowers(p, -0.25, 0.1, 0.09, [P['white'], P['purple']])
    lantern(p, -0.35, -0.2, 0.5)
    cyl(p, 0.015, 0.015, 0.46, (-0.35, -0.2, 0.25), P['dark'], seg=5, name='lamppost')

def guild():
    p = root('guild')
    box(p, (1.75, 1.6, 0.14), (0, 0.02, 0.07), P['stone'], bevel=0.03, name='base')
    box(p, (1.4, 1.05, 0.7), (0, 0.15, 0.49), '#F5E4C3', bevel=0.03)
    box(p, (1.52, 1.17, 0.07), (0, 0.15, 0.86), P['beam'], bevel=0.012)
    box(p, (1.4, 1.05, 0.6), (0, 0.15, 1.19), '#F5E4C3', bevel=0.03)
    for x in (-0.7, -0.35, 0, 0.35, 0.7):
        box(p, (0.05, 0.03, 0.6), (x, -0.39, 1.19), P['beam'], bevel=0.006, name='timber')
    for sx in (-1, 1):
        box(p, (0.03, 0.03, 0.55), (sx * 0.52, -0.395, 1.19), P['beam'], rot=(0, sx * 0.6, 0), bevel=0.005, name='brace')
    gable_fill(p, 1.4, 1.05, 0.62, 1.49, '#F5E4C3', y0=0.15)
    roof(p, 1.4, 1.05, 0.64, 1.49, '#9B4D3E', thick=0.08, oh=0.13, y0=0.15, ridge=P['beam'])
    door(p, 0, -0.38, 0.14, w=0.34, h=0.5, col='#7A4E32')
    window_row(p, (-0.45, 0.45), -0.38, 0.5, w=0.24, h=0.26, shutters='#9B4D3E')
    window_row(p, (-0.18, 0.18), -0.4, 1.17, w=0.2, h=0.24, box_col=P['red'])
    # guild banner and gear sign
    box(p, (0.24, 0.03, 0.36), (-0.52, -0.42, 1.18), '#3E6FA8', bevel=0.006, name='banner')
    cyl(p, 0.09, 0.09, 0.03, (-0.52, -0.44, 1.2), P['gold'], seg=8, rot=(math.pi / 2, 0, 0), name='gear', smooth=False)
    cyl(p, 0.2, 0.2, 0.04, (0, -0.46, 1.68), P['white'], seg=16, rot=(math.pi / 2, 0, 0), name='clockface')
    crate(p, 0.7, -0.62, 0.12, 0.2)
    barrel(p, -0.72, -0.6, 0.12, 0.09, 0.22)

# ---------------------------------------------------------------- era 3
def factory():
    p = root('factory')
    box(p, (2.75, 2.75, 0.12), (0, 0, 0.06), '#A8A39A', bevel=0.03, name='yard')
    # main hall with sawtooth roof
    box(p, (2.0, 1.6, 0.95), (-0.2, 0.4, 0.6), '#B9654F', bevel=0.03, name='hall')
    for k in range(4):
        box(p, (2.015, 1.615, 0.02), (-0.2, 0.4, 0.3 + k * 0.2), shade('#B9654F', 0.85), bevel=0, name='course')
    sawtooth(p, 2.0, 1.6, 1.075, 4, '#5A6B7F', x0=-0.2, y0=0.4)
    box(p, (2.06, 1.66, 0.05), (-0.2, 0.4, 1.075), P['stone'], bevel=0.01, name='band')
    window_row(p, (-0.95, -0.55, -0.15, 0.25, 0.65), -0.41, 0.62, w=0.24, h=0.42)
    box(p, (0.5, 0.05, 0.6), (0.6, -0.41, 0.42), '#5A6B7F', bevel=0.01, name='rolldoor')
    for k in range(6):
        box(p, (0.5, 0.06, 0.012), (0.6, -0.42, 0.15 + k * 0.1), shade('#5A6B7F', 0.8), bevel=0, name='slat')
    # blast furnace and stacks
    cyl(p, 0.36, 0.3, 1.25, (0.95, 0.9, 0.75), '#6E6A73', seg=14, name='furnace')
    for k in range(3):
        cyl(p, 0.37, 0.37, 0.04, (0.95, 0.9, 0.35 + k * 0.35), P['dark'], seg=14, bevel=0, name='hoop')
    box(p, (0.12, 0.6, 0.12), (0.95, 0.5, 1.2), '#7E8A9A', bevel=0.01, name='pipe')
    chimney(p, -0.95, 1.05, 0.12, 2.3, r=0.16, col=P['brick'], i=0)
    chimney(p, -0.45, 1.1, 0.12, 2.0, r=0.14, col=P['brick'], i=1)
    # ore and coal heaps, ingots
    ball(p, 0.3, (-0.9, -0.9, 0.1), '#8C8F9C', scale=(1, 1, 0.55), seg=8, rings=5, name='oreheap')
    ball(p, 0.3, (-0.3, -0.95, 0.1), '#4A4752', scale=(1, 1, 0.55), seg=8, rings=5, name='coalheap')
    for lz in range(3):
        for i in range(3 - lz):
            box(p, (0.3, 0.1, 0.07), (0.85, -0.9 + (i + lz * 0.5) * 0.12, 0.16 + lz * 0.075), '#B9C2CF', bevel=0.012, name='ingot')

def plant_modern():
    p = root('plant_modern')
    box(p, (2.75, 2.75, 0.12), (0, 0, 0.06), '#D6D2CA', bevel=0.03, name='yard')
    box(p, (2.1, 1.5, 0.9), (0, 0.45, 0.57), '#EEF1F5', bevel=0.04, name='hall')
    box(p, (2.12, 1.52, 0.18), (0, 0.45, 0.84), '#6FA8DC', bevel=0.02, name='stripe')
    flat_roof(p, 2.14, 1.54, 1.02, '#CFD6DF', y0=0.45, parapet='#E2E7EE')
    # solar panels on the roof
    for i in range(4):
        box(p, (0.4, 0.5, 0.03), (-0.7 + i * 0.46, 0.45, 1.2), '#2F4E7A', rot=(0.4, 0, 0), bevel=0.006, name='panel')
    box(p, (1.6, 0.05, 0.36), (0, -0.31, 0.46), P['glass'], kind='G', bevel=0.01, name='glazing')
    for x in (-0.6, 0, 0.6):
        box(p, (0.03, 0.06, 0.36), (x, -0.32, 0.46), '#E2E7EE', bevel=0, name='mullion')
    # office block with sign
    box(p, (0.7, 0.6, 1.3), (-0.9, -0.75, 0.77), '#F4F1EA', bevel=0.03, name='office')
    for z in (0.5, 0.85, 1.2):
        box(p, (0.55, 0.05, 0.2), (-0.9, -1.06, z), P['glass'], kind='G', bevel=0.005, name='officeglass')
    flat_roof(p, 0.74, 0.64, 1.42, '#CFD6DF', x0=-0.9, y0=-0.75)
    box(p, (0.5, 0.06, 0.16), (-0.9, -1.07, 1.58), '#F2766B', bevel=0.01, name='logo')
    # loading bay with boxes
    for i in range(3):
        box(p, (0.24, 0.24, 0.24), (0.4 + i * 0.3, -0.85, 0.24), '#F2F4F8', bevel=0.02, name='applbox')
        box(p, (0.25, 0.04, 0.05), (0.4 + i * 0.3, -0.97, 0.3), '#6FA8DC', bevel=0, name='applband')
    chimney(p, 0.9, 1.05, 1.02, 0.5, r=0.09, col='#B9C2CF')
    tree_small(p, 1.1, -0.5, 0.9)

def cannery():
    p = root('cannery')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), '#C9C4BB', bevel=0.03, name='base')
    box(p, (1.4, 1.0, 0.8), (-0.05, 0.25, 0.52), '#DCE8EE', bevel=0.03, name='hall')
    poly_prism(p, [(-0.5, 0), (0.5, 0), (0, 0.32)], 1.4, (-0.05, 0.25, 0.92), '#DCE8EE', bevel=0.015, name='gable')
    roof(p, 1.4, 1.0, 0.32, 0.92, '#5D8FD0', thick=0.07, oh=0.1, x0=-0.05, y0=0.25, ridge=P['white'])
    window_row(p, (-0.5, -0.1, 0.3), -0.25, 0.55, w=0.24, h=0.3)
    box(p, (0.36, 0.05, 0.44), (0.5, -0.25, 0.34), '#5D8FD0', bevel=0.01, name='door')
    # big can sign
    cyl(p, 0.16, 0.16, 0.3, (-0.6, -0.4, 1.0), '#D9DDE4', seg=14, name='bigcan')
    cyl(p, 0.165, 0.165, 0.14, (-0.6, -0.4, 1.0), '#F2766B', seg=14, bevel=0, name='label')
    box(p, (0.04, 0.04, 0.42), (-0.6, -0.4, 0.62), P['dark'], bevel=0, name='signpost')
    chimney(p, 0.45, 0.6, 0.92, 0.55, r=0.09, col='#B9C2CF')
    # fish crates and stacked cans
    crate(p, 0.6, -0.6, 0.12, 0.2, '#8CC8EA')
    crate(p, 0.35, -0.65, 0.12, 0.2, '#8CC8EA')
    for i in range(3):
        cyl(p, 0.05, 0.05, 0.1, (-0.2 + i * 0.11, -0.6, 0.17), '#D9DDE4', seg=10, name='can')
    cyl(p, 0.05, 0.05, 0.1, (-0.145, -0.6, 0.27), '#D9DDE4', seg=10, name='can')

def brewery():
    p = root('brewery')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.0, 1.0, 0.85), (-0.3, 0.2, 0.55), '#E8C9A0', bevel=0.03, name='hall')
    gable_fill(p, 1.0, 1.0, 0.45, 0.97, '#E8C9A0', x0=-0.3, y0=0.2)
    roof(p, 1.0, 1.0, 0.47, 0.97, '#3E9A6C', thick=0.08, oh=0.12, x0=-0.3, y0=0.2, ridge=P['beam'])
    door(p, -0.3, -0.3, 0.12, w=0.3, h=0.46, col='#7A4E32')
    window(p, -0.62, -0.3, 0.55, w=0.18, h=0.24)
    # copper kettles
    for x, y, r in ((0.55, 0.45, 0.24), (0.55, -0.05, 0.2)):
        cyl(p, r, r, 0.5, (x, y, 0.37), '#D98C4E', seg=16, name='kettle')
        ball(p, r, (x, y, 0.62), '#E09A5C', scale=(1, 1, 0.6), name='kettletop')
        cyl(p, 0.03, 0.03, 0.25, (x, y, 0.85), '#D98C4E', seg=8, name='kettlepipe')
    chimney(p, -0.6, 0.55, 0.97, 0.45, r=0.08, col=P['brick'], square=True)
    # barrels and a beer sign
    for x in (0.1, 0.32):
        barrel(p, x, -0.62, 0.12, 0.1, 0.26)
    barrel(p, 0.21, -0.62, 0.38, 0.09, 0.22)
    box(p, (0.3, 0.04, 0.22), (-0.3, -0.33, 0.85), '#F2C14E', bevel=0.01, name='signboard')

def powerplant():
    p = root('powerplant')
    box(p, (2.75, 2.75, 0.12), (0, 0, 0.06), '#A8A39A', bevel=0.03, name='yard')
    box(p, (1.8, 1.2, 1.15), (-0.3, 0.55, 0.7), '#C47A5E', bevel=0.03, name='turbinehall')
    for k in range(5):
        box(p, (1.815, 1.215, 0.02), (-0.3, 0.55, 0.3 + k * 0.2), shade('#C47A5E', 0.85), bevel=0, name='course')
    gable_fill(p, 1.8, 1.2, 0.35, 1.27, '#C47A5E', x0=-0.3, y0=0.55)
    roof(p, 1.8, 1.2, 0.36, 1.27, '#5A6B7F', thick=0.08, oh=0.08, x0=-0.3, y0=0.55, ridge=P['dark'])
    window_row(p, (-1.0, -0.6, -0.2, 0.2), -0.06, 0.75, w=0.2, h=0.55)
    # cooling tower
    cyl(p, 0.55, 0.38, 0.9, (0.85, 0.65, 0.57), '#D9D4CB', seg=18, name='coolinglow')
    cyl(p, 0.38, 0.48, 0.65, (0.85, 0.65, 1.34), '#D9D4CB', seg=18, name='coolinghigh')
    cyl(p, 0.49, 0.49, 0.06, (0.85, 0.65, 1.66), '#BDB6AA', seg=18, bevel=0, name='coolingrim')
    smoke(p, 0.85, 0.65, 1.72, 0)
    chimney(p, -1.0, 0.95, 1.27, 1.2, r=0.13, col=P['brick'], i=1)
    # coal conveyor and heap
    box(p, (0.14, 1.0, 0.08), (-0.3, -0.45, 0.6), '#7E8A9A', rot=(0.45, 0, 0), bevel=0.01, name='conveyor')
    ball(p, 0.4, (-0.3, -0.95, 0.1), '#4A4752', scale=(1.2, 1, 0.55), seg=8, rings=5, name='coalheap')
    # pylon
    for sx in (-1, 1):
        box(p, (0.04, 0.04, 1.1), (1.0 + sx * 0.12, -0.8, 0.6), '#7E8A9A', rot=(0, sx * 0.1, 0), bevel=0, name='pylonleg')
    box(p, (0.6, 0.04, 0.04), (1.0, -0.8, 1.05), '#7E8A9A', bevel=0, name='pylonarm')
    for sx in (-0.25, 0.25):
        box(p, (0.05, 0.05, 0.08), (1.0 + sx, -0.8, 1.0), P['white'], bevel=0.01, name='insulator')

def heatplant():
    p = root('heatplant')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), '#B5ADA0', bevel=0.03, name='base')
    box(p, (1.2, 1.0, 0.75), (-0.15, 0.25, 0.5), P['brick'], bevel=0.03, name='boilerhouse')
    for k in range(3):
        box(p, (1.215, 1.015, 0.02), (-0.15, 0.25, 0.3 + k * 0.2), P['brick2'], bevel=0, name='course')
    flat_roof(p, 1.24, 1.04, 0.875, '#7E8A9A', x0=-0.15, y0=0.25)
    door(p, -0.15, -0.25, 0.12, w=0.32, h=0.48, col='#5A6B7F', arch=False)
    window_row(p, (-0.55, 0.25), -0.25, 0.55, w=0.2, h=0.26)
    chimney(p, 0.5, 0.6, 0.12, 1.6, r=0.12, col=P['brick'])
    # insulated pipes heading out to the street
    for y, col in ((-0.45, '#E8E2D6'), (-0.6, '#F2766B')):
        box(p, (1.4, 0.09, 0.09), (0, y, 0.25), col, bevel=0.02, name='heatpipe')
    for x in (-0.6, 0.0, 0.6):
        box(p, (0.06, 0.3, 0.22), (x, -0.52, 0.13), '#7E8A9A', bevel=0.01, name='pipestand')
    box(p, (0.3, 0.3, 0.4), (0.62, 0.0, 0.32), '#7E8A9A', bevel=0.03, name='pump')
    cyl(p, 0.08, 0.08, 0.04, (0.62, -0.16, 0.4), '#F2766B', seg=10, rot=(math.pi / 2, 0, 0), name='gauge')

def school():
    p = root('school')
    box(p, (1.8, 1.7, 0.12), (0, 0, 0.06), '#E9E1D2', bevel=0.03, name='yard')
    box(p, (1.5, 0.9, 0.9), (0, 0.3, 0.57), '#F7E3C3', bevel=0.03)
    for k in range(2):
        box(p, (1.515, 0.915, 0.04), (0, 0.3, 0.55 + k * 0.38), P['white'], bevel=0, name='band')
    gable_fill(p, 1.5, 0.9, 0.4, 1.02, '#F7E3C3', y0=0.3)
    roof(p, 1.5, 0.9, 0.42, 1.02, '#E8665A', thick=0.08, oh=0.12, y0=0.3, ridge=P['white'])
    # little clock gable / bell cupola
    box(p, (0.24, 0.24, 0.3), (0, 0.3, 1.55), P['white'], bevel=0.02, name='cupola')
    cyl(p, 0.2, 0.0, 0.25, (0, 0.3, 1.82), '#E8665A', seg=4, rot=(0, 0, math.pi / 4), name='cupolaroof', smooth=False)
    door(p, 0, -0.15, 0.12, w=0.3, h=0.44, col='#5D8FD0')
    window_row(p, (-0.55, -0.28, 0.28, 0.55), -0.15, 0.4, w=0.18, h=0.24)
    window_row(p, (-0.55, -0.28, 0, 0.28, 0.55), -0.15, 0.78, w=0.18, h=0.22)
    # playground: swing and ball
    for x in (-0.65, -0.25):
        box(p, (0.04, 0.04, 0.5), (x, -0.62, 0.3), '#F2B33D', bevel=0.006, name='swingpost')
    box(p, (0.46, 0.04, 0.04), (-0.45, -0.62, 0.55), '#F2B33D', bevel=0.006, name='swingbar')
    box(p, (0.14, 0.08, 0.02), (-0.45, -0.62, 0.22), '#6FA8DC', bevel=0.004, name='seat')
    ball(p, 0.07, (0.5, -0.6, 0.19), '#F2766B', name='ball')
    box(p, (0.03, 0.03, 0.75), (0.75, -0.65, 0.5), P['white'], bevel=0, name='flagpole')
    box(p, (0.02, 0.22, 0.14), (0.75, -0.54, 0.8), '#F2766B', bevel=0.004, name='flag')

def clinic():
    p = root('clinic')
    box(p, (1.75, 1.6, 0.12), (0, 0, 0.06), '#E2DDD3', bevel=0.03, name='base')
    box(p, (1.4, 1.0, 0.95), (0, 0.25, 0.6), '#FFFFFF', bevel=0.03, name='walls')
    flat_roof(p, 1.44, 1.04, 1.075, '#D6E2E8', y0=0.25, parapet='#EDF2F5')
    box(p, (1.42, 1.02, 0.1), (0, 0.25, 0.45), '#8FD1C4', bevel=0.01, name='stripe')
    door(p, 0, -0.25, 0.12, w=0.36, h=0.44, col=P['glass'], arch=False)
    box(p, (0.62, 0.3, 0.04), (0, -0.4, 0.62), '#8FD1C4', bevel=0.01, name='canopy')
    window_row(p, (-0.5, 0.5), -0.25, 0.32, w=0.24, h=0.22)
    window_row(p, (-0.5, -0.17, 0.17, 0.5), -0.25, 0.82, w=0.22, h=0.24)
    # red cross sign
    box(p, (0.34, 0.06, 0.34), (0, -0.27, 1.25), P['white'], bevel=0.02, name='signbox')
    box(p, (0.24, 0.07, 0.07), (0, -0.29, 1.25), P['red'], kind='G', bevel=0.005, name='cross')
    box(p, (0.07, 0.07, 0.24), (0, -0.29, 1.25), P['red'], kind='G', bevel=0.005, name='cross')
    flowers(p, -0.65, -0.55, 0.1)
    flowers(p, 0.65, -0.55, 0.1, [P['white'], P['pink']])
    box(p, (0.04, 0.4, 0.2), (0.75, 0.2, 0.15), '#B9C2CF', rot=(0, 0, 0), bevel=0.006, name='bikerack')

def townhall():
    p = root('townhall')
    box(p, (2.75, 2.75, 0.14), (0, 0, 0.07), '#E2D9C8', bevel=0.03, name='plaza')
    box(p, (2.2, 1.2, 1.3), (0, 0.55, 0.8), '#F4E7CF', bevel=0.03, name='hall')
    box(p, (2.28, 1.28, 0.1), (0, 0.55, 1.47), P['stone'], bevel=0.02, name='cornice')
    roof(p, 2.2, 1.2, 0.5, 1.52, '#5D8FD0', thick=0.08, oh=0.06, y0=0.55, ridge=P['gold'])
    gable_fill(p, 2.2, 1.2, 0.5, 1.52, '#F4E7CF', y0=0.55)
    # portico with columns and pediment
    for x in (-0.55, -0.2, 0.2, 0.55):
        cyl(p, 0.07, 0.08, 0.95, (x, -0.2, 0.62), P['white'], seg=12, name='column')
    box(p, (1.4, 0.4, 0.1), (0, -0.15, 1.13), P['white'], bevel=0.02, name='entablature')
    poly_prism(p, [(-0.75, 0), (0.75, 0), (0, 0.35)], 0.4, (0, -0.15, 1.18), P['white'], rot=(0, 0, math.pi / 2), bevel=0.015, name='pediment')
    box(p, (1.3, 0.5, 0.06), (0, -0.25, 0.17), P['stone'], bevel=0.01, name='steps')
    box(p, (1.1, 0.35, 0.06), (0, -0.2, 0.23), P['stone'], bevel=0.01, name='steps')
    door(p, 0, -0.06, 0.24, w=0.4, h=0.62, col='#7A4E32')
    window_row(p, (-0.9, 0.9), -0.06, 0.7, w=0.22, h=0.44)
    window_row(p, (-0.9, -0.45, 0.45, 0.9), -0.06, 1.2, w=0.2, h=0.22)
    # clock tower
    box(p, (0.5, 0.5, 0.8), (0, 0.55, 2.2), '#F4E7CF', bevel=0.03, name='tower')
    cyl(p, 0.17, 0.17, 0.04, (0, 0.29, 2.3), P['white'], seg=16, rot=(math.pi / 2, 0, 0), name='clockface')
    cyl(p, 0.38, 0.0, 0.6, (0, 0.55, 2.9), '#5D8FD0', seg=8, name='towerroof', smooth=False)
    ball(p, 0.06, (0, 0.55, 3.24), P['gold'], name='finial')
    # flags and trees
    for x, col in ((-1.1, P['red']), (1.1, P['blue'])):
        box(p, (0.03, 0.03, 1.2), (x, -0.9, 0.7), P['white'], bevel=0, name='flagpole')
        box(p, (0.02, 0.3, 0.2), (x, -0.75, 1.15), col, bevel=0.004, name='flag')
    for x in (-0.95, 0.95):
        tree_small(p, x, 0.0, 1.0)

def university():
    p = root('university')
    box(p, (2.75, 2.75, 0.12), (0, 0, 0.06), '#E2D9C8', bevel=0.03, name='quad')
    box(p, (2.3, 0.9, 1.2), (0, 0.85, 0.72), '#C9795C', bevel=0.03, name='mainwing')
    for k in range(5):
        box(p, (2.315, 0.915, 0.02), (0, 0.85, 0.3 + k * 0.2), shade('#C9795C', 0.86), bevel=0, name='course')
    roof(p, 2.3, 0.9, 0.4, 1.32, '#4E6E5E', thick=0.07, oh=0.08, y0=0.85, ridge=P['dark'])
    gable_fill(p, 2.3, 0.9, 0.4, 1.32, '#C9795C', y0=0.85)
    for sx in (-1, 1):
        box(p, (0.7, 1.2, 0.9), (sx * 0.95, -0.15, 0.57), '#C9795C', bevel=0.03, name='sidewing')
        roof_y(p, 0.7, 1.2, 0.3, 1.02, '#4E6E5E', thick=0.07, oh=0.06, x0=sx * 0.95, y0=-0.15)
        poly_prism(p, [(-0.35, 0), (0.35, 0), (0, 0.3)], 1.2, (sx * 0.95, -0.15, 1.02), '#C9795C', rot=(0, 0, math.pi / 2), bevel=0.01, name='winggable')
        for y in (-0.55, -0.15, 0.25):
            window(p, sx * 0.6, y, 0.6, face='right' if sx < 0 else 'left', w=0.16, h=0.3)
    window_row(p, (-0.75, -0.35, 0.35, 0.75), 0.39, 0.62, w=0.18, h=0.36)
    window_row(p, (-0.75, -0.35, 0, 0.35, 0.75), 0.39, 1.08, w=0.16, h=0.22)
    # central tower with dome
    box(p, (0.5, 0.5, 1.0), (0, 0.6, 1.5), '#C9795C', bevel=0.03, name='tower')
    door(p, 0, 0.35, 0.12, w=0.32, h=0.56, col='#4E6E5E')
    cyl(p, 0.3, 0.3, 0.1, (0, 0.6, 2.05), P['stone'], seg=12, name='drum')
    ball(p, 0.3, (0, 0.6, 2.1), '#7FB6A6', scale=(1, 1, 0.9), seg=14, rings=8, name='dome')
    ball(p, 0.05, (0, 0.6, 2.42), P['gold'], name='finial')
    # quad lawn with a tree and statue
    box(p, (1.1, 0.8, 0.03), (0, -0.55, 0.135), '#8FD16A', bevel=0.01, name='lawn')
    tree_small(p, -0.3, -0.6, 1.1)
    cyl(p, 0.1, 0.12, 0.2, (0.3, -0.55, 0.24), P['stone'], seg=8, name='plinth')
    ball(p, 0.08, (0.3, -0.55, 0.42), P['stone2'], scale=(1, 1, 1.6), name='statue')

# ---------------------------------------------------------------- era 4
def factory_small():
    p = root('factory_small')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), '#C9C4BB', bevel=0.03, name='base')
    box(p, (1.1, 0.9, 0.8), (-0.3, 0.3, 0.52), '#E2DDD3', bevel=0.03, name='hall')
    flat_roof(p, 1.14, 0.94, 0.92, '#B5ADA0', x0=-0.3, y0=0.3)
    window_row(p, (-0.6, -0.3, 0.0), -0.15, 0.55, w=0.2, h=0.3)
    # cement silos and a kiln tube
    for x in (0.45, 0.75):
        cyl(p, 0.15, 0.15, 1.2, (x, 0.45, 0.72), '#D9D4CB', seg=14, name='silo')
        cyl(p, 0.15, 0.0, 0.15, (x, 0.45, 1.39), '#BDB6AA', seg=14, name='silotop')
    cyl(p, 0.11, 0.11, 1.2, (0.2, -0.4, 0.32), '#9C9488', seg=12, rot=(0, math.pi / 2 - 0.08, 0), name='kilntube')
    for x in (-0.25, 0.2, 0.65):
        box(p, (0.08, 0.2, 0.22), (x, -0.4, 0.13), '#7E8A9A', bevel=0.01, name='kilnstand')
    chimney(p, -0.65, 0.6, 0.92, 0.75, r=0.1, col='#B9C2CF')
    for i in range(3):
        box(p, (0.2, 0.18, 0.16), (-0.6 + i * 0.22, -0.65, 0.2), '#C9C4BB', bevel=0.03, name='cementbag')

def windturbine():
    p = root('windturbine')
    box(p, (1.6, 1.6, 0.06), (0, 0, 0.03), '#9ED36A', bevel=0.03, name='meadow')
    cyl(p, 0.3, 0.32, 0.12, (0, 0, 0.12), '#D6D2CA', seg=14, name='footing')
    cyl(p, 0.06, 0.11, 2.6, (0, 0, 1.45), P['white'], seg=14, name='mast')
    box(p, (0.18, 0.42, 0.18), (0, 0.04, 2.8), P['white'], bevel=0.05, name='nacelle')
    s = root('spinz_rotor')
    s.parent = p
    s.location = (0, -0.2, 2.8)
    ball(s, 0.09, (0, -0.04, 0), P['white'], scale=(1, 1.4, 1), name='hub')
    for i in range(3):
        a = i * 2 * math.pi / 3
        box(s, (0.09, 0.03, 1.15), (math.sin(a) * 0.6, 0, math.cos(a) * 0.6), P['white'], rot=(0, a, 0), bevel=0.012, name='blade')
        box(s, (0.095, 0.035, 0.12), (math.sin(a) * 1.1, -0.002, math.cos(a) * 1.1), '#F2766B', rot=(0, a, 0), bevel=0.008, name='tip')
    flowers(p, 0.5, -0.5, 0.1)
    flowers(p, -0.55, 0.4, 0.09, [P['white'], P['yellow']])

def solar():
    p = root('solar')
    box(p, (1.7, 1.7, 0.06), (0, 0, 0.03), '#B9D38A', bevel=0.03, name='meadow')
    for r in range(2):
        for c in range(3):
            x, y = -0.5 + c * 0.5, -0.32 + r * 0.66
            box(p, (0.04, 0.04, 0.3), (x, y + 0.12, 0.18), '#7E8A9A', bevel=0, name='leg')
            box(p, (0.46, 0.5, 0.03), (x, y, 0.32), '#2F4E7A', rot=(0.5, 0, 0), bevel=0.008, name='panel')
            for k in range(2):
                box(p, (0.46, 0.012, 0.035), (x, y - 0.1 + k * 0.2, 0.32 + (0.1 - k * 0.2) * math.tan(0.5) * -1 * 0), '#5D8FD0', rot=(0.5, 0, 0), bevel=0, name='cellline')
    box(p, (0.3, 0.2, 0.3), (0.65, 0.7, 0.2), '#E2E7EE', bevel=0.02, name='inverter')
    box(p, (0.1, 0.02, 0.06), (0.65, 0.59, 0.27), '#7CC36A', kind='G', bevel=0, name='led')

def hydro():
    p = root('hydro')
    box(p, (2.75, 2.75, 0.1), (0, 0, 0.05), '#C9C4BB', bevel=0.03, name='base')
    # curved concrete dam wall along the back
    for i in range(7):
        a = -0.6 + i * 0.2
        box(p, (0.42, 0.4, 0.9), (math.sin(a) * 1.0, 0.75 + (1 - math.cos(a)) * -0.8, 0.5), '#D9D4CB', rot=(0, 0, -a), bevel=0.02, name='damblock')
    box(p, (2.3, 0.2, 0.08), (0, 0.72, 0.98), '#BDB6AA', bevel=0.01, name='damtop')
    for x in (-0.5, 0, 0.5):
        box(p, (0.24, 0.06, 0.6), (x, 0.52, 0.45), '#9ED3F0', bevel=0.01, name='spillway')
    # turbine house
    box(p, (1.4, 0.8, 0.7), (0, -0.3, 0.45), '#E2E7EE', bevel=0.03, name='turbinehouse')
    flat_roof(p, 1.44, 0.84, 0.8, '#5D8FD0', y0=-0.3)
    window_row(p, (-0.45, 0, 0.45), -0.7, 0.5, w=0.24, h=0.3)
    door(p, 0.55, -0.7, 0.1, w=0.22, h=0.36, col='#5D8FD0', arch=False)
    for x in (-0.9, 0.9):
        for sx in (-1, 1):
            box(p, (0.04, 0.04, 1.1), (x + sx * 0.1, -0.9, 0.6), '#7E8A9A', rot=(0, sx * 0.1, 0), bevel=0, name='pylonleg')
        box(p, (0.5, 0.04, 0.04), (x, -0.9, 1.05), '#7E8A9A', bevel=0, name='pylonarm')

def purifier():
    p = root('purifier')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), '#D6E2E8', bevel=0.03, name='base')
    box(p, (0.9, 0.8, 0.6), (-0.4, 0.3, 0.42), '#F4F7FA', bevel=0.04, name='hall')
    flat_roof(p, 0.94, 0.84, 0.72, '#8FD1C4', x0=-0.4, y0=0.3)
    window_row(p, (-0.6, -0.2), -0.1, 0.45, w=0.2, h=0.26)
    # air towers with green leaves on top
    for x, y, h in ((0.45, 0.45, 1.2), (0.55, -0.15, 0.9)):
        cyl(p, 0.18, 0.2, h, (x, y, 0.12 + h / 2), '#E2E7EE', seg=14, name='airtower')
        for k in range(3):
            cyl(p, 0.205, 0.205, 0.04, (x, y, 0.3 + k * h * 0.28), '#8FD1C4', seg=14, bevel=0, name='band')
        ball(p, 0.22, (x, y, 0.15 + h), P['leaf'], scale=(1, 1, 0.6), kind='L', name='greencap')
    box(p, (0.5, 0.06, 0.3), (-0.4, -0.13, 0.95), '#7CC36A', bevel=0.02, name='leafsign')
    flowers(p, -0.7, -0.6, 0.1)
    flowers(p, 0.0, -0.62, 0.1, [P['white'], P['yellow']])

def recycler():
    p = root('recycler')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), '#C9C4BB', bevel=0.03, name='base')
    box(p, (1.1, 0.9, 0.7), (-0.25, 0.3, 0.47), '#7CC36A', bevel=0.03, name='hall')
    roof(p, 1.1, 0.9, 0.25, 0.82, '#E2E7EE', thick=0.06, oh=0.08, x0=-0.25, y0=0.3)
    gable_fill(p, 1.1, 0.9, 0.25, 0.82, '#7CC36A', x0=-0.25, y0=0.3)
    box(p, (0.5, 0.05, 0.46), (-0.25, -0.16, 0.36), '#E2E7EE', bevel=0.01, name='bay')
    # recycling arrows sign
    for i in range(3):
        a = i * 2 * math.pi / 3
        box(p, (0.14, 0.04, 0.04), (-0.25 + math.cos(a) * 0.1, -0.19, 0.95 + math.sin(a) * 0.1), P['white'], rot=(0, -a - math.pi / 2, 0), bevel=0.005, name='arrow')
    # sorted bins and bales
    for i, col in enumerate(('#6FA8DC', '#F2B33D', '#F2766B')):
        box(p, (0.2, 0.2, 0.24), (0.55, -0.55 + i * 0.25, 0.24), col, bevel=0.02, name='bin')
    for i in range(2):
        box(p, (0.24, 0.24, 0.2), (-0.65 + i * 0.27, -0.6, 0.22), '#B9C2CF', bevel=0.02, name='bale')

def hospital():
    p = root('hospital')
    box(p, (2.75, 2.75, 0.12), (0, 0, 0.06), '#E2DDD3', bevel=0.03, name='grounds')
    box(p, (2.2, 1.0, 1.7), (0, 0.6, 0.97), '#FFFFFF', bevel=0.03, name='block')
    box(p, (1.0, 1.0, 1.0), (-0.6, -0.3, 0.62), '#FFFFFF', bevel=0.03, name='wing')
    flat_roof(p, 2.24, 1.04, 1.82, '#D6E2E8', y0=0.6, parapet='#EDF2F5')
    flat_roof(p, 1.04, 1.04, 1.12, '#D6E2E8', x0=-0.6, y0=-0.3)
    for z in (0.55, 0.95, 1.35):
        window_row(p, (0.1, 0.4, 0.7, 1.0), 0.09, z, w=0.2, h=0.24)
    for z in (0.45, 0.85):
        window_row(p, (-0.85, -0.35), -0.81, z, w=0.22, h=0.24)
    door(p, 0.45, 0.09, 0.12, w=0.4, h=0.42, col=P['glass'], arch=False)
    box(p, (0.7, 0.4, 0.05), (0.45, -0.1, 0.6), '#8FD1C4', bevel=0.01, name='canopy')
    box(p, (0.4, 0.07, 0.4), (-0.1, 0.08, 1.6), P['white'], bevel=0.02, name='signbox')
    box(p, (0.28, 0.08, 0.08), (-0.1, 0.06, 1.6), P['red'], kind='G', bevel=0.005, name='cross')
    box(p, (0.08, 0.08, 0.28), (-0.1, 0.06, 1.6), P['red'], kind='G', bevel=0.005, name='cross')
    # helipad
    cyl(p, 0.35, 0.35, 0.03, (0.6, 0.6, 1.88), '#7E8A9A', seg=18, bevel=0, name='helipad')
    box(p, (0.05, 0.25, 0.01), (0.5, 0.6, 1.9), P['white'], bevel=0, name='h')
    box(p, (0.05, 0.25, 0.01), (0.7, 0.6, 1.9), P['white'], bevel=0, name='h')
    box(p, (0.2, 0.05, 0.01), (0.6, 0.6, 1.9), P['white'], bevel=0, name='h')
    for x, y in ((1.05, -0.8), (0.4, -0.95)):
        tree_small(p, x, y, 1.0)

def theatre():
    p = root('theatre')
    box(p, (2.75, 2.75, 0.12), (0, 0, 0.06), '#E9E1D2', bevel=0.03, name='plaza')
    # drum-shaped auditorium behind a grand facade
    cyl(p, 1.0, 1.0, 1.2, (0, 0.45, 0.72), '#F2D7C9', seg=24, name='drum')
    cyl(p, 1.05, 1.05, 0.1, (0, 0.45, 1.37), P['stone'], seg=24, name='drumcornice')
    ball(p, 0.95, (0, 0.45, 1.4), '#B87AA3', scale=(1, 1, 0.45), seg=20, rings=8, name='dome')
    ball(p, 0.08, (0, 0.45, 1.85), P['gold'], name='finial')
    box(p, (1.8, 0.4, 1.3), (0, -0.55, 0.77), '#F7E9D0', bevel=0.03, name='facade')
    for x in (-0.7, -0.35, 0, 0.35, 0.7):
        cyl(p, 0.06, 0.07, 0.95, (x, -0.8, 0.62), P['white'], seg=12, name='column')
    box(p, (1.86, 0.3, 0.12), (0, -0.75, 1.15), P['white'], bevel=0.02, name='entablature')
    poly_prism(p, [(-0.93, 0), (0.93, 0), (0, 0.32)], 0.3, (0, -0.72, 1.21), P['white'], rot=(0, 0, math.pi / 2), bevel=0.015, name='pediment')
    for x in (-0.35, 0, 0.35):
        door(p, x, -0.76, 0.12, w=0.2, h=0.42, col='#8A3A4E')
    window_row(p, (-0.55, 0.55), -0.76, 0.8, w=0.16, h=0.26)
    # masks and posters
    for x, col in ((-0.12, '#F2C14E'), (0.12, '#F2766B')):
        ball(p, 0.08, (x, -0.88, 1.32), col, scale=(1, 0.4, 1.15), name='mask')
    for x in (-1.15, 1.15):
        cyl(p, 0.1, 0.1, 0.6, (x, -1.0, 0.42), '#F7E9D0', seg=12, name='posterpillar')
        cyl(p, 0.12, 0.12, 0.05, (x, -1.0, 0.74), '#8A3A4E', seg=12, name='pillarcap')
    box(p, (1.4, 0.5, 0.06), (0, -1.05, 0.15), P['stone'], bevel=0.01, name='steps')

def lab():
    p = root('lab')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), '#E2E7EE', bevel=0.03, name='base')
    box(p, (1.3, 1.0, 1.0), (-0.1, 0.25, 0.62), '#F4F7FA', bevel=0.04, name='block')
    box(p, (1.32, 1.02, 0.32), (-0.1, 0.25, 0.62), P['glass'], kind='G', bevel=0.02, name='glassband')
    flat_roof(p, 1.34, 1.04, 1.12, '#CFD6DF', x0=-0.1, y0=0.25, parapet='#E2E7EE')
    # observatory dome and antenna
    cyl(p, 0.3, 0.3, 0.2, (0.2, 0.35, 1.3), '#E2E7EE', seg=16, name='domebase')
    ball(p, 0.3, (0.2, 0.35, 1.4), '#B9C2CF', scale=(1, 1, 0.9), seg=16, rings=8, name='obsdome')
    box(p, (0.08, 0.45, 0.06), (0.2, 0.35, 1.62), '#2E2633', rot=(0.5, 0, 0), bevel=0.01, name='slit')
    cyl(p, 0.015, 0.015, 0.6, (-0.55, 0.5, 1.45), '#7E8A9A', seg=5, name='antenna')
    ball(p, 0.04, (-0.55, 0.5, 1.77), P['red'], kind='G', name='beacon')
    door(p, -0.1, -0.25, 0.12, w=0.32, h=0.42, col=P['glass'], arch=False)
    box(p, (0.5, 0.25, 0.04), (-0.1, -0.38, 0.58), '#8FD1C4', bevel=0.01, name='canopy')
    # little satellite dish
    cyl(p, 0.2, 0.05, 0.08, (0.6, -0.5, 0.45), '#E2E7EE', seg=14, rot=(0.6, 0, 0), name='dish')
    cyl(p, 0.02, 0.02, 0.35, (0.6, -0.45, 0.25), '#7E8A9A', seg=5, name='dishpost')

# ---------------------------------------------------------------- deposits
def ore_iron():
    p = root('ore_iron')
    random.seed(41)
    for i in range(5):
        a = i * 1.3
        ball(p, random.uniform(0.09, 0.15), (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.05), '#8C8F9C', scale=(1.2, 1, 0.7), seg=7, rings=5, name='orerock', rot=(0, 0, a))
        ball(p, 0.035, (math.cos(a) * 0.22, math.sin(a) * 0.22 - 0.05, 0.12), '#E0A080', seg=6, rings=4, name='orefleck')

def ore_coal():
    p = root('ore_coal')
    random.seed(43)
    for i in range(5):
        a = i * 1.3 + 0.4
        ball(p, random.uniform(0.09, 0.15), (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.05), '#4A4752', scale=(1.2, 1, 0.7), seg=7, rings=5, name='coalrock', rot=(0, 0, a))

# ---------------------------------------------------------------- bridges (one road tile over a river)
def bridge_deck(p, rails):
    box(p, (1.0, 0.98, 0.06), (0, 0, 0.05), P['wood2'], bevel=0.01, name='beam')
    for i in range(7):
        box(p, (0.135, 0.94, 0.04), (-0.43 + i * 0.143, 0, 0.09), '#C9925E' if i % 2 else '#BA8455', bevel=0.008, name='plank')
    for x in (-0.38, 0.38):
        for y in (-0.38, 0.38):
            cyl(p, 0.05, 0.05, 0.7, (x, y, -0.3), P['beam'], seg=8, name='piling')
    if rails:
        for y in (-0.46, 0.46):
            for x in (-0.45, 0.0, 0.45):
                box(p, (0.06, 0.06, 0.26), (x, y, 0.22), P['wood'], bevel=0.01, name='railpost')
            box(p, (1.02, 0.05, 0.05), (0, y, 0.33), P['wood'], bevel=0.01, name='rail')
            box(p, (1.02, 0.03, 0.03), (0, y, 0.2), P['wood2'], bevel=0.005, name='rail')

def bridge():
    bridge_deck(root('bridge'), True)

def bridge_plain():
    bridge_deck(root('bridge_plain'), False)

# ---------------------------------------------------------------- survival buildings
def garden():
    p = root('garden')
    box(p, (2.8, 2.8, 0.06), (0, 0, 0.03), '#B98A5A', bevel=0.02, name='soil')
    for x0, y0, x1, y1 in ((-1.35, -1.35, 1.35, -1.35), (1.35, -1.35, 1.35, 1.35), (1.35, 1.35, -1.35, 1.35)):
        fence(p, x0, y0, x1, y1, P['wood'], n=12)
    crops = [('#8FD16A', 'cab'), ('#F2766B', 'tom'), ('#F2A541', 'car'), ('#6DB36A', 'let')]
    for r in range(4):
        y = -1.0 + r * 0.6
        box(p, (2.3, 0.36, 0.08), (-0.1, y, 0.08), '#9B6B44', bevel=0.02, name='bed')
        col, kind = crops[r]
        for i in range(7):
            x = -1.1 + i * 0.33
            if kind == 'tom':
                cyl(p, 0.012, 0.012, 0.36, (x, y, 0.26), P['wood2'], seg=4, name='stake')
                ball(p, 0.08, (x, y, 0.22), P['leaf'], kind='L', name='vine')
                ball(p, 0.04, (x + 0.04, y - 0.05, 0.24), col, name='tomato')
            elif kind == 'car':
                ball(p, 0.06, (x, y, 0.15), '#6DB36A', scale=(0.6, 0.6, 1.4), kind='L', name='tops')
                ball(p, 0.035, (x, y - 0.05, 0.12), col, name='carrot')
            else:
                ball(p, 0.09, (x, y, 0.16), col, scale=(1, 1, 0.75), name='cabbage')
    # scarecrow and tool shed
    cyl(p, 0.02, 0.02, 0.7, (1.0, 0.95, 0.35), P['beam'], seg=5, name='scarepole')
    box(p, (0.4, 0.03, 0.03), (1.0, 0.95, 0.5), P['beam'], bevel=0, name='scarearm')
    ball(p, 0.08, (1.0, 0.95, 0.72), P['straw'], name='scarehead')
    cyl(p, 0.13, 0.0, 0.1, (1.0, 0.95, 0.82), P['thatch2'], seg=8, name='hat')
    box(p, (0.16, 0.08, 0.2), (1.0, 0.95, 0.45), '#E8665A', bevel=0.01, name='shirt')
    box(p, (0.5, 0.4, 0.42), (-1.05, 1.05, 0.25), P['wood'], bevel=0.02, name='shed')
    roof(p, 0.56, 0.46, 0.2, 0.46, P['green'], thick=0.05, oh=0.05, x0=-1.05, y0=1.05)
    cyl(p, 0.1, 0.08, 0.16, (0.6, -1.25, 0.1), '#D9B27A', seg=10, name='basket')
    for i in range(3):
        ball(p, 0.05, (0.57 + i * 0.03, -1.25, 0.2), crops[i][0], name='harvest')

def herbalist():
    p = root('herbalist')
    box(p, (1.7, 1.6, 0.12), (0, 0, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.2, 0.95, 0.68), (-0.1, 0.2, 0.46), '#F3E9D2', bevel=0.03)
    gable_fill(p, 1.2, 0.95, 0.48, 0.8, '#F3E9D2', x0=-0.1, y0=0.2)
    roof(p, 1.2, 0.95, 0.5, 0.8, '#5E9C6A', thick=0.08, oh=0.13, x0=-0.1, y0=0.2, ridge=P['beam'])
    door(p, -0.35, -0.28, 0.12, w=0.26, h=0.42, col='#5E9C6A')
    window(p, 0.15, -0.28, 0.5, w=0.24, h=0.24, shutters='#5E9C6A', box_col=P['purple'])
    # hanging herb bundles under the eave and a mortar sign
    for i in range(4):
        cyl(p, 0.004, 0.004, 0.14, (-0.5 + i * 0.22, -0.4, 0.86), P['dark'], seg=3, bevel=0, name='string')
        ball(p, 0.05, (-0.5 + i * 0.22, -0.4, 0.76), ['#8FD16A', '#C7A6F2', '#F2CF5B', '#6DB36A'][i], scale=(0.8, 0.8, 1.4), name='herbs')
    box(p, (0.03, 0.26, 0.22), (0.56, -0.25, 0.95), P['white'], bevel=0.01, name='signboard')
    cyl(p, 0.06, 0.04, 0.08, (0.545, -0.25, 0.92), '#5E9C6A', seg=10, name='mortar')
    # herb garden
    for i, col in enumerate((P['purple'], '#8FD16A', P['yellow'], '#C7A6F2')):
        ball(p, 0.1, (0.5 + (i % 2) * 0.25, -0.5 - (i // 2) * 0.22, 0.14), P['leaf'], scale=(1, 1, 0.7), kind='L', name='herbbush')
        ball(p, 0.035, (0.5 + (i % 2) * 0.25, -0.5 - (i // 2) * 0.22, 0.22), col, name='bloom')
    box(p, (0.6, 0.5, 0.05), (0.62, -0.6, 0.09), '#9B6B44', bevel=0.01, name='herbbed')

def firestation():
    p = root('firestation')
    box(p, (1.75, 1.65, 0.12), (0, 0, 0.06), P['stone2'], bevel=0.03, name='base')
    box(p, (1.1, 1.0, 0.8), (-0.2, 0.2, 0.52), '#E8665A', bevel=0.03, name='hall')
    gable_fill(p, 1.1, 1.0, 0.4, 0.92, '#E8665A', x0=-0.2, y0=0.2)
    roof(p, 1.1, 1.0, 0.42, 0.92, '#5A6B7F', thick=0.08, oh=0.12, x0=-0.2, y0=0.2, ridge=P['dark'])
    box(p, (0.6, 0.05, 0.56), (-0.2, -0.3, 0.42), '#9B4D3E', bevel=0.01, name='bigdoor')
    for k in range(5):
        box(p, (0.6, 0.06, 0.012), (-0.2, -0.31, 0.2 + k * 0.1), shade('#9B4D3E', 0.8), bevel=0, name='slat')
    box(p, (0.5, 0.06, 0.1), (-0.2, -0.32, 0.82), P['white'], bevel=0.01, name='signboard')
    # watch tower with bell
    box(p, (0.36, 0.36, 1.4), (0.55, 0.45, 0.82), '#E8665A', bevel=0.02, name='tower')
    box(p, (0.42, 0.42, 0.05), (0.55, 0.45, 1.55), P['white'], bevel=0.01, name='towerdeck')
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(p, (0.04, 0.04, 0.3), (0.55 + sx * 0.17, 0.45 + sy * 0.17, 1.72), P['white'], bevel=0, name='towerpost')
    cyl(p, 0.27, 0.0, 0.22, (0.55, 0.45, 1.98), '#5A6B7F', seg=4, rot=(0, 0, math.pi / 4), name='towerroof', smooth=False)
    cyl(p, 0.07, 0.05, 0.1, (0.55, 0.45, 1.72), P['gold'], seg=10, name='bell')
    # hand cart with water barrel and buckets
    box(p, (0.36, 0.24, 0.06), (0.45, -0.5, 0.2), P['wood'], bevel=0.01, name='cartbed')
    for sy in (-0.14, 0.14):
        cyl(p, 0.09, 0.09, 0.03, (0.45, -0.5 + sy, 0.13), P['dark'], seg=10, rot=(math.pi / 2, 0, 0), name='wheel')
    cyl(p, 0.1, 0.1, 0.2, (0.45, -0.5, 0.33), '#E8665A', seg=12, name='waterbarrel')
    for i in range(3):
        cyl(p, 0.05, 0.04, 0.08, (-0.65 + i * 0.12, -0.6, 0.16), '#E8665A', seg=8, name='bucket')

def police():
    p = root('police')
    box(p, (1.7, 1.6, 0.12), (0, 0, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.3, 1.0, 0.95), (0, 0.2, 0.6), '#DCE6F0', bevel=0.03, name='walls')
    box(p, (1.4, 1.1, 0.08), (0, 0.2, 1.1), '#3E5C8A', bevel=0.015, name='cornice')
    roof(p, 1.3, 1.0, 0.36, 1.14, '#3E5C8A', thick=0.07, oh=0.08, y0=0.2, ridge=P['dark'])
    gable_fill(p, 1.3, 1.0, 0.36, 1.14, '#DCE6F0', y0=0.2)
    door(p, 0, -0.3, 0.12, w=0.3, h=0.46, col='#3E5C8A')
    box(p, (0.5, 0.2, 0.04), (0, -0.4, 0.66), '#3E5C8A', bevel=0.01, name='canopy')
    window_row(p, (-0.42, 0.42), -0.3, 0.45, w=0.22, h=0.24)
    window_row(p, (-0.42, 0.0, 0.42), -0.3, 0.88, w=0.2, h=0.2)
    # blue lantern and badge
    cyl(p, 0.015, 0.015, 0.2, (0.3, -0.36, 0.72), P['dark'], seg=5, rot=(math.pi / 2, 0, 0), name='lampbracket')
    box(p, (0.08, 0.08, 0.1), (0.3, -0.46, 0.7), '#9ED3F0', kind='G', bevel=0.01, name='bluelamp')
    cyl(p, 0.11, 0.11, 0.03, (0, -0.31, 1.0), P['gold'], seg=6, rot=(math.pi / 2, 0, 0), name='badge', smooth=False)
    # bicycle and bench
    for x in (0.5, 0.75):
        cyl(p, 0.08, 0.08, 0.02, (x, -0.62, 0.1), P['dark'], seg=12, rot=(math.pi / 2, 0, 0), name='bikewheel')
    box(p, (0.25, 0.02, 0.02), (0.625, -0.62, 0.17), '#3E5C8A', bevel=0, name='bikeframe')
    box(p, (0.42, 0.14, 0.04), (-0.55, -0.6, 0.2), P['wood'], bevel=0.008, name='bench')
    flowers(p, -0.75, -0.25, 0.09)
