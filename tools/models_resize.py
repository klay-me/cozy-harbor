# Bigger, more varied footprints: move or scale an existing model to its new size and fill the
# extra ground with detail. Executed at the end of tools/models.py, after every model is built.

PLATES = ('p_base', 'p_yard', 'p_deck', 'p_meadow', 'p_plaza', 'p_grounds', 'p_quad', 'p_churchyard', 'p_soil', 'p_ground', 'p_lawn')

def regroup(name, w, h, sx=0.0, sy=0.0, scale=1.0, plate='#D3CABC'):
    root = bpy.data.objects[name]
    for c in list(root.children):
        if c.name.split('.')[0] in PLATES:
            bpy.data.objects.remove(c, do_unlink=True)
            continue
        c.location = (c.location.x * scale + sx, c.location.y * scale + sy, c.location.z * scale)
        c.scale = (c.scale.x * scale, c.scale.y * scale, c.scale.z * scale)
    box(root, (w - 0.2, h - 0.2, 0.1), (0, 0, 0.05), plate, bevel=0.03, name='plate')
    return root

def log_pile(p, x, y, n=3, length=0.7, along_x=False):
    for row in range(n):
        for i in range(n - row):
            off = (i - (n - row - 1) / 2) * 0.2
            px, py = (x, y + off) if not along_x else (x + off, y)
            cyl(p, 0.1, 0.1, length, (px, py, 0.2 + row * 0.18), '#B87A48', seg=10, rot=(0, math.pi / 2, 0) if not along_x else (math.pi / 2, 0, 0), name='pilelog')

def table_umbrella(p, x, y, col):
    cyl(p, 0.16, 0.16, 0.04, (x, y, 0.32), P['wood'], seg=12, name='tabletop')
    cyl(p, 0.03, 0.04, 0.26, (x, y, 0.18), P['beam'], seg=6, name='tableleg')
    for dx in (-0.22, 0.22):
        cyl(p, 0.06, 0.06, 0.16, (x + dx, y, 0.12), P['wood2'], seg=8, name='stool')
    cyl(p, 0.012, 0.012, 0.6, (x, y, 0.6), P['white'], seg=5, name='umbrellapole')
    cyl(p, 0.32, 0.0, 0.16, (x, y, 0.92), col, seg=8, name='umbrella', smooth=False)

def headstone(p, x, y, r=0.0):
    box(p, (0.12, 0.05, 0.16), (x, y, 0.18), P['stone2'], rot=(0, 0, r), bevel=0.02, name='headstone')

def extras():
    # ---- 3 x 2 (main building moves left, the yard fills the right)
    p = regroup('sawmill', 3, 2, sx=-0.5, plate='#C9A77E')
    log_pile(p, 0.95, -0.2, 3, 0.8)
    log_pile(p, 0.95, 0.55, 2, 0.6)
    for i in range(4):
        box(p, (0.5, 0.22, 0.045), (0.95, -0.75, 0.12 + i * 0.05), '#F2CF93' if i % 2 else '#E8BD80', bevel=0.006, name='plank')
    p = regroup('warehouse', 3, 2, sx=-0.5)
    for (x, y, z, s_) in ((0.75, -0.55, 0.1, 0.26), (1.05, -0.55, 0.1, 0.26), (0.9, -0.55, 0.36, 0.24), (0.8, -0.1, 0.1, 0.22), (1.1, 0.45, 0.1, 0.24), (1.1, 0.45, 0.34, 0.2)):
        crate(p, x, y, z, s_)
    for i in range(4):
        ball(p, 0.12, (0.7 + (i % 2) * 0.25, 0.45 + (i // 2) * 0.05, 0.2 + (i // 2) * 0.16), '#F1E0B5', scale=(1, 0.85, 0.75), name='sack')
    box(p, (0.06, 0.06, 1.2), (1.3, 0.0, 0.7), P['beam'], bevel=0.008, name='cranepost')
    box(p, (0.6, 0.05, 0.05), (1.05, 0.0, 1.27), P['beam'], bevel=0.006, name='cranearm')
    cyl(p, 0.006, 0.006, 0.5, (0.8, 0.0, 1.0), P['dark'], seg=4, bevel=0, name='rope')
    crate(p, 0.8, 0.0, 0.62, 0.18, '#F0C080')
    p = regroup('tavern', 3, 2, sx=-0.5, plate='#E2D3B5')
    table_umbrella(p, 0.85, -0.45, P['red'])
    table_umbrella(p, 0.95, 0.35, '#3E9A6C')
    for i in range(6):
        x = 0.45 + i * 0.18
        lantern(p, x, -0.85, 0.78 + 0.05 * math.sin(i * 1.2))
    box(p, (1.0, 0.012, 0.012), (0.9, -0.85, 0.85), P['dark'], bevel=0, name='stringline')
    for x in (0.45, 1.35):
        cyl(p, 0.015, 0.015, 0.85, (x, -0.85, 0.42), P['beam'], seg=5, name='linepole')
    flowers(p, 1.3, 0.75, 0.1)
    p = regroup('brickworks', 3, 2, sx=-0.5, plate='#B9AE9F')
    for x in (0.6, 1.3):
        for y in (-0.6, 0.6):
            box(p, (0.05, 0.05, 0.6), (x, y, 0.4), P['beam'], bevel=0.006, name='shedpost')
    roof(p, 0.85, 1.35, 0.18, 0.7, '#8B6A4E', thick=0.05, oh=0.06, x0=0.95, y0=0.0)
    for r_ in range(4):
        for i in range(6):
            box(p, (0.1, 0.06, 0.05), (0.7 + i * 0.1, -0.45 + r_ * 0.3, 0.14), '#D98A5F', bevel=0.006, name='greenbrick')
    p = regroup('weaver', 3, 2, sx=-0.5)
    for i, col in enumerate(('#E9B8D6', '#9ED3F0', '#FFE07A')):
        cyl(p, 0.17, 0.17, 0.26, (0.8 + (i % 2) * 0.4, -0.4 + i * 0.4, 0.23), P['wood'], seg=12, name='vat')
        cyl(p, 0.15, 0.15, 0.02, (0.8 + (i % 2) * 0.4, -0.4 + i * 0.4, 0.36), col, seg=12, bevel=0, name='dye')
    for i in range(3):
        ball(p, 0.12, (1.25, 0.7 - i * 0.03, 0.2 + i * 0.12), '#FFFAF0', scale=(1, 0.9, 1.0), name='woolsack')
    p = regroup('firestation', 3, 2, sx=-0.5)
    box(p, (0.05, 0.05, 1.1), (1.2, 0.5, 0.65), P['beam'], bevel=0.006, name='hosepole')
    box(p, (0.5, 0.05, 0.05), (1.0, 0.5, 1.18), P['beam'], bevel=0.006, name='hosebar')
    for i in range(3):
        box(p, (0.03, 0.03, 0.75), (0.85 + i * 0.12, 0.5, 0.78), '#F2CF93', bevel=0, name='hose')
    cyl(p, 0.3, 0.3, 0.12, (0.95, -0.35, 0.16), P['stone'], seg=16, name='cistern')
    cyl(p, 0.26, 0.26, 0.02, (0.95, -0.35, 0.22), P['water'], seg=16, bevel=0, name='cisternwater')
    box(p, (0.36, 0.24, 0.06), (0.95, 0.05, 0.2), '#E8665A', bevel=0.01, name='cart2')
    for sy in (-0.14, 0.14):
        cyl(p, 0.09, 0.09, 0.03, (0.95, 0.05 + sy, 0.13), P['dark'], seg=10, rot=(math.pi / 2, 0, 0), name='wheel')
    p = regroup('guild', 3, 2, sx=-0.5, plate='#E2D3B5')
    box(p, (0.6, 0.28, 0.06), (0.95, -0.4, 0.34), P['wood'], bevel=0.01, name='workbench')
    for x in (0.7, 1.2):
        box(p, (0.05, 0.24, 0.3), (x, -0.4, 0.17), P['wood2'], bevel=0.005, name='benchleg')
    box(p, (0.2, 0.1, 0.06), (0.85, -0.42, 0.4), P['metal'], bevel=0.01, name='vice')
    log_pile(p, 1.0, 0.45, 2, 0.6)
    box(p, (0.03, 0.03, 0.6), (1.35, -0.75, 0.3), P['beam'], bevel=0, name='signpost')
    box(p, (0.3, 0.03, 0.18), (1.35, -0.75, 0.62), '#3E6FA8', bevel=0.01, name='guildsign')
    p = regroup('cannery', 3, 2, sx=-0.5)
    box(p, (0.14, 1.0, 0.06), (0.9, 0.0, 0.42), '#7E8A9A', rot=(0.0, 0, 0), bevel=0.01, name='conveyor')
    for y in (-0.4, 0.0, 0.4):
        box(p, (0.05, 0.05, 0.38), (0.9, y, 0.2), '#7E8A9A', bevel=0, name='convleg')
        cyl(p, 0.05, 0.05, 0.1, (0.9, y, 0.5), '#D9DDE4', seg=10, name='can')
    for i in range(2):
        box(p, (0.4, 0.3, 0.05), (1.25, -0.5 + i * 0.9, 0.12), P['wood2'], bevel=0.006, name='pallet')
        for k in range(6):
            cyl(p, 0.05, 0.05, 0.1, (1.12 + (k % 3) * 0.13, -0.58 + i * 0.9 + (k // 3) * 0.14, 0.2), '#F2766B', seg=10, name='canstack')
    p = regroup('purifier', 3, 2, sx=-0.5, plate='#D6E2E8')
    for i in range(2):
        box(p, (0.7, 0.6, 0.08), (0.95, -0.45 + i * 0.85, 0.12), P['stone'], bevel=0.02, name='filterbed')
        box(p, (0.62, 0.52, 0.02), (0.95, -0.45 + i * 0.85, 0.17), '#7FC8C0', bevel=0, kind='C', name='filterwater')
        for k in range(3):
            ball(p, 0.06, (0.75 + k * 0.2, -0.45 + i * 0.85, 0.2), P['leaf'], kind='L', name='reedclump')

    # ---- 2x2 / 3x3 models grown uniformly to their new size
    regroup('market', 3, 3, scale=1.5, plate='#EFE2C8')
    regroup('park', 3, 3, scale=1.5, plate='#8FD16A')
    regroup('claypit', 3, 3, scale=1.5, plate='#C9A27A')
    regroup('school', 3, 3, scale=1.4, plate='#E9E1D2')
    regroup('solar', 3, 3, scale=1.5, plate='#B9D38A')
    regroup('recycler', 3, 3, scale=1.45)
    regroup('factory_small', 3, 3, scale=1.45, plate='#C9C4BB')
    regroup('factory', 4, 4, scale=1.3, plate='#A8A39A')
    regroup('powerplant', 4, 4, scale=1.3, plate='#A8A39A')
    regroup('university', 4, 4, scale=1.3, plate='#E2D9C8')
    regroup('theatre', 4, 4, scale=1.3, plate='#E9E1D2')

    # ---- deeper or wider than before, with a new back or side yard
    p = regroup('church', 3, 4, sy=-0.5, plate='#E9E1D2')
    for x in (-1.25, 1.25):
        box(p, (0.08, 1.2, 0.18), (x, 1.3, 0.19), P['stone2'], bevel=0.02, name='yardwall')
    box(p, (2.58, 0.08, 0.18), (0, 1.88, 0.19), P['stone2'], bevel=0.02, name='yardwall')
    for i, (x, y) in enumerate(((-0.8, 1.1), (-0.4, 1.15), (0.1, 1.05), (0.55, 1.2), (-0.6, 1.55), (0.3, 1.55))):
        headstone(p, x, y, (i % 3 - 1) * 0.1)
    tree_small(p, 1.0, 1.5, 1.2, P['pine'])
    tree_small(p, -1.0, 1.6, 1.0)
    p = regroup('sheepfarm', 4, 3, sx=-0.5, plate='#9ED36A')
    for x0, y0, x1, y1 in ((0.9, -1.3, 1.85, -1.3), (1.85, -1.3, 1.85, 1.3), (1.85, 1.3, 0.9, 1.3)):
        fence(p, x0, y0, x1, y1, P['wood'], n=6)
    box(p, (0.6, 0.5, 0.45), (1.35, 0.8, 0.27), P['wood'], bevel=0.02, name='shearshed')
    roof(p, 0.66, 0.56, 0.22, 0.5, '#7E8A9A', thick=0.05, oh=0.05, x0=1.35, y0=0.8)
    random.seed(77)
    for (x, y) in ((1.2, -0.7), (1.55, -0.2), (1.25, 0.2)):
        rz = random.uniform(0, 6.28)
        ball(p, 0.15, (x, y, 0.2), '#FFFAF0', scale=(1.25, 0.9, 0.85), name='fleece', rot=(0, 0, rz))
        ball(p, 0.07, (x + math.cos(rz) * 0.19, y + math.sin(rz) * 0.19, 0.24), '#3B3346', name='head')
    p = regroup('townhall', 4, 3, sx=-0.5, plate='#E2D9C8')
    cyl(p, 0.35, 0.38, 0.18, (1.35, 0.0, 0.18), P['stone'], seg=18, name='basin')
    cyl(p, 0.3, 0.3, 0.02, (1.35, 0.0, 0.27), P['water'], seg=18, bevel=0, name='pool')
    cyl(p, 0.06, 0.08, 0.36, (1.35, 0.0, 0.42), P['stone2'], seg=10, name='pillar')
    for y in (-0.9, 0.9):
        box(p, (0.6, 0.3, 0.12), (1.35, y, 0.16), '#8FD16A', bevel=0.03, name='hedge')
        flowers(p, 1.35, y, 0.1)
    p = regroup('plant_modern', 4, 3, sx=-0.5, plate='#D6D2CA')
    for i, y in enumerate((-0.6, 0.1, 0.8)):
        cyl(p, 0.22, 0.22, 0.7, (1.4, y, 0.45), '#E2E7EE', seg=14, name='tank')
        ball(p, 0.22, (1.4, y, 0.8), '#E2E7EE', scale=(1, 1, 0.5), name='tanktop')
        cyl(p, 0.225, 0.225, 0.08, (1.4, y, 0.35), '#6FA8DC', seg=14, bevel=0, name='tankband')

extras()
