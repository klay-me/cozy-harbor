"""
Builds every model of the game in Blender and exports public/models/town.glb.

Run with Blender's Python module:
    python tools/models.py

Conventions
- 1 Blender unit = 1 map tile. Each model is centred on its footprint at z = 0.
- The front of a building faces -Y in Blender (+Z in three.js after glTF export).
- Every top-level empty is one model. Child mesh names carry hints for the game:
    spinz_* / spinx_*  rotating parts (pivot at the object origin)
    bob_*              parts that bob on the water
- Material name prefixes: C_ plain colour, G_ glows at night, L_ leaves (recoloured by season),
  T_ tinted per instance (clothes, cargo).
"""
import bpy, bmesh, math, os, random
from mathutils import Vector

random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'town.glb')

# ---------- scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
COL = bpy.context.scene.collection

def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

MATS = {}
def mat(col, kind='C'):
    key = kind + col
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(f"{kind}_{col.lstrip('#')}")
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin(col), 1)
    MATS[key] = m
    return m

# palette
P = dict(
    cream='#FFF1D6', plaster='#FBEEDA', stone='#D3CABC', stone2='#B9AE9F', wood='#C48451', wood2='#9B6440',
    beam='#6E4631', door='#8A5A3C', white='#FFFFFF', glass='#58789F', thatch='#EDC567', thatch2='#D3A445',
    brick='#D46E58', brick2='#B85A47', leaf='#6DBB57', leaf2='#82C964', pine='#4E9A63', pine2='#64B276',
    trunk='#8A5D3F', pink='#FF9FB2', yellow='#FFE07A', red='#EE5D5D', orange='#F5A04C', metal='#C2CBD4',
    cloth='#FFF8EA', gold='#F4C84B', soil='#A8774A', wheat='#F2CF5B', sprout='#9ED36A', hay='#E9C35F',
    dark='#3B3346', skin='#FFD9B8', hair='#7A4A2E', blue='#6FA8DC', teal='#5DB7B0', green='#6DB36A', purple='#A487CF',
    water='#7FD3EF', terracotta='#D9825B', straw='#F0D27A',
)

def finish(bm, name, m, parent, loc, rot, bevel, seg, smooth, angle=40):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    o = bpy.data.objects.new('p_' + name, me)
    COL.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    if bevel > 0:
        md = o.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = seg
        md.limit_method = 'ANGLE'
        md.angle_limit = math.radians(35)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(angle))
    if parent is not None:
        o.parent = parent
    return o

def box(p, size, loc, col, rot=(0, 0, 0), bevel=0.025, seg=2, kind='C', name='box'):
    if min(size) < 0.12:
        seg = 1
    bevel = min(bevel, min(size) * 0.3)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    return finish(bm, name, mat(col, kind), p, loc, rot, bevel, seg, False)

def cyl(p, r1, r2, h, loc, col, seg=16, rot=(0, 0, 0), bevel=0.015, kind='C', name='cyl', smooth=True):
    if max(r1, r2) < 0.08:
        seg = min(seg, 8)
        bevel = 0
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)
    return finish(bm, name, mat(col, kind), p, loc, rot, bevel if r2 > 0 else 0, 2, smooth)

def ball(p, r, loc, col, scale=(1, 1, 1), seg=12, rings=8, kind='C', name='ball', rot=(0, 0, 0)):
    if r < 0.07:
        seg, rings = min(seg, 8), min(rings, 5)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    return finish(bm, name, mat(col, kind), p, loc, rot, 0, 1, True, 80)

def poly_prism(p, pts, depth, loc, col, rot=(0, 0, 0), bevel=0.02, kind='C', name='prism'):
    """Extrude a polygon given in the YZ plane along X by `depth`."""
    bm = bmesh.new()
    a = [bm.verts.new((-depth / 2, y, z)) for y, z in pts]
    b = [bm.verts.new((depth / 2, y, z)) for y, z in pts]
    n = len(pts)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat(col, kind), p, loc, rot, bevel, 2, False)

def torus(p, R, r, loc, col, rot=(0, 0, 0), seg=20, rseg=8, name='torus'):
    bm = bmesh.new()
    verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            ring.append(bm.verts.new((x, y, z)))
        verts.append(ring)
    for i in range(seg):
        for j in range(rseg):
            a, b = verts[i][j], verts[(i + 1) % seg][j]
            c, d = verts[(i + 1) % seg][(j + 1) % rseg], verts[i][(j + 1) % rseg]
            bm.faces.new((a, b, c, d))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat(col), p, loc, rot, 0, 1, True, 80)

def root(name):
    o = bpy.data.objects.new(name, None)
    COL.objects.link(o)
    return o

# ---------- architectural helpers ----------
def gable_fill(p, w, d, h, z0, col, y0=0, x0=0):
    """Triangular attic wall under a gable roof whose ridge runs along X."""
    return poly_prism(p, [(-d / 2, 0), (d / 2, 0), (0, h)], w, (x0, y0, z0), col, bevel=0.015)

def shade(hexcol, f):
    h = hexcol.lstrip('#')
    return '#' + ''.join(f'{max(0, min(255, int(int(h[i:i + 2], 16) * f))):02X}' for i in (0, 2, 4))

def roof(p, w, d, h, z0, col, thick=0.08, oh=0.12, bevel=0.025, seg=2, x0=0, y0=0, ridge=None, rot_z=0):
    """Two thick roof panels meeting at a ridge along X. w along X, d across."""
    hd = d / 2
    a = math.atan2(h, hd)
    s = math.hypot(hd, h)
    L = s + oh
    parts = []
    for sgn in (-1, 1):
        # ridge point to eave, extended by the overhang
        ry, rz = 0, z0 + h
        uy, uz = sgn * hd / s, -h / s
        ey, ez = ry + uy * L, rz + uz * L
        ny, nz = sgn * h / s, hd / s
        cy, cz = (ry + ey) / 2 + ny * thick / 2, (rz + ez) / 2 + nz * thick / 2
        pt = box(p, (w + 2 * oh, L, thick), (0, 0, 0), col, rot=(-sgn * a, 0, 0), bevel=bevel, seg=seg, name='roof')
        loc = Vector((x0, y0 + cy, cz))
        if rot_z:
            loc = Vector((x0 + (cy) * -math.sin(rot_z), y0 + cy * math.cos(rot_z), cz))
            pt.rotation_euler = (-sgn * a, 0, rot_z)
            pt.rotation_mode = 'ZXY'
        pt.location = loc
        parts.append(pt)
        if thick < 0.12:
            # rows of tiles: thin strips laid across the slope
            dark = shade(col, 0.84)
            k, step = 0, 0.12
            while 0.09 + k * step < L - 0.04:
                dd = 0.09 + k * step
                py = ry + uy * dd + ny * (thick + 0.006)
                pz = rz + uz * dd + nz * (thick + 0.006)
                box(p, (w + 2 * oh - 0.02, 0.035, 0.022), (x0, y0 + py, pz), dark, rot=(-sgn * a, 0, 0), bevel=0.006, seg=1, name='tilerow')
                k += 1
    if ridge:
        r = cyl(p, thick * 0.75, thick * 0.75, w + 2 * oh + 0.02, (x0, y0, z0 + h + thick * 0.55), ridge, seg=10, rot=(0, math.pi / 2, rot_z), name='ridge')
        parts.append(r)
    return parts

def window(p, x, y, z, face='front', w=0.24, h=0.24, shutters=None, box_col=None):
    """A framed glowing window. face: front (-Y), right (+X), left (-X), back (+Y)."""
    rz = {'front': 0, 'back': math.pi, 'right': math.pi / 2, 'left': -math.pi / 2}[face]
    def at(dx, dy, dz):
        c, s = math.cos(rz), math.sin(rz)
        return (x + dx * c - dy * s, y + dx * s + dy * c, z + dz)
    box(p, (w + 0.07, 0.04, h + 0.07), at(0, 0, 0), P['white'], rot=(0, 0, rz), bevel=0.01, name='frame')
    box(p, (w, 0.05, h), at(0, -0.008, 0), P['glass'], rot=(0, 0, rz), bevel=0.004, kind='G', name='glass')
    box(p, (0.025, 0.055, h), at(0, -0.012, 0), P['white'], rot=(0, 0, rz), bevel=0, name='mullion')
    if shutters:
        for sx in (-1, 1):
            box(p, (0.08, 0.03, h + 0.05), at(sx * (w / 2 + 0.07), -0.01, 0), shutters, rot=(0, 0, rz), bevel=0.008, name='shutter')
    if box_col:
        box(p, (w + 0.1, 0.1, 0.07), at(0, -0.06, -h / 2 - 0.05), P['wood2'], rot=(0, 0, rz), bevel=0.01, name='flowerbox')
        for i, fx in enumerate((-w / 3, 0, w / 3)):
            ball(p, 0.045, at(fx, -0.07, -h / 2 + 0.0), box_col if i != 1 else P['yellow'], name='flower')

def door(p, x, y, z, w=0.26, h=0.42, col=None, face='front', arch=True):
    rz = {'front': 0, 'back': math.pi, 'right': math.pi / 2, 'left': -math.pi / 2}[face]
    c, s = math.cos(rz), math.sin(rz)
    box(p, (w + 0.06, 0.04, h + 0.03), (x, y, z + h / 2), P['beam'], rot=(0, 0, rz), bevel=0.01, name='doorframe')
    box(p, (w, 0.05, h), (x - 0.0 * s, y - 0.008 * c, z + h / 2 - 0.01), col or P['door'], rot=(0, 0, rz), bevel=0.01, name='door')
    if arch:
        cyl(p, w / 2, w / 2, 0.05, (x, y - 0.008 * c, z + h - 0.01), col or P['door'], seg=14, rot=(math.pi / 2, 0, rz), name='arch')
    ball(p, 0.02, (x + (w * 0.3) * c, y - 0.04 * c, z + h * 0.45), P['gold'], name='knob')

def flowers(p, x, y, r=0.12, cols=None):
    cols = cols or [P['pink'], P['yellow'], P['red']]
    ball(p, r, (x, y, r * 0.8), P['leaf'], scale=(1, 1, 0.8), kind='L', name='bush')
    for i in range(4):
        a = i * 1.7
        ball(p, 0.04, (x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.7, r * 1.35), cols[i % len(cols)], name='flower')

def crate(p, x, y, z, s=0.22, col=None):
    box(p, (s, s, s), (x, y, z + s / 2), col or '#E2A86A', bevel=0.015, name='crate')
    box(p, (s + 0.01, s * 0.15, s + 0.01), (x, y, z + s / 2), P['wood2'], bevel=0.005, name='crateband')

def barrel(p, x, y, z=0, r=0.11, h=0.28):
    cyl(p, r * 0.9, r * 0.9, h, (x, y, z + h / 2), P['wood'], seg=12, name='barrel')
    for bz in (0.25, 0.75):
        cyl(p, r * 0.95, r * 0.95, 0.025, (x, y, z + h * bz), P['beam'], seg=12, bevel=0, name='hoop')

def lantern(p, x, y, z):
    box(p, (0.07, 0.07, 0.09), (x, y, z), '#FFE29A', bevel=0.01, kind='G', name='lantern')
    box(p, (0.09, 0.09, 0.02), (x, y, z + 0.055), P['dark'], bevel=0.005, name='lanterncap')

def awning_striped(p, x, y, z, w, d, cols, tilt=0.35, stripes=6, rz=0):
    sw = w / stripes
    c, s = math.cos(rz), math.sin(rz)
    for i in range(stripes):
        dx = -w / 2 + sw * (i + 0.5)
        box(p, (sw + 0.002, d, 0.035), (x + dx * c, y + dx * s, z), cols[i % len(cols)], rot=(tilt, 0, rz), bevel=0.006, name='awning')
    # scalloped edge
    for i in range(stripes):
        dx = -w / 2 + sw * (i + 0.5)
        ey = -d / 2 * math.cos(tilt)
        ball(p, sw * 0.42, (x + dx * c - ey * s, y + dx * s + ey * c, z - d / 2 * math.sin(tilt) - 0.02), cols[i % len(cols)], scale=(1, 0.35, 0.8), name='scallop')

# ======================================================================
#                                BUILDINGS
# ======================================================================
WALLS = [P['cream'], '#FFDCD2', '#DCEBF8', '#E0F2DC']
SHUTTERS = ['#6FA8DC', '#E8665A', '#6DB36A', '#F0A04B']
def house_peasant(v):
    p = root(f'house_peasant_{v}')
    wall = WALLS[v]
    box(p, (1.55, 1.3, 0.14), (0, 0.02, 0.07), P['stone'], bevel=0.035, name='base')
    box(p, (1.2, 0.95, 0.7), (0, 0.04, 0.49), wall, bevel=0.03)
    for x in (-0.6, 0.6):
        for y in (-0.435, 0.515):
            box(p, (0.08, 0.08, 0.72), (x, y, 0.49), P['wood2'], bevel=0.012, name='post')
    box(p, (1.26, 1.01, 0.06), (0, 0.04, 0.86), P['wood2'], bevel=0.012, name='plate')
    gable_fill(p, 1.2, 0.95, 0.5, 0.89, wall, y0=0.04)
    roof(p, 1.2, 0.95, 0.52, 0.89, P['thatch'], thick=0.17, oh=0.16, bevel=0.07, seg=3, y0=0.04, ridge=P['thatch2'])
    door(p, -0.26, -0.44, 0.14, col=SHUTTERS[v])
    window(p, 0.27, -0.44, 0.55, shutters=SHUTTERS[v], box_col=P['pink'])
    window(p, 0.61, 0.04, 0.55, face='right', shutters=SHUTTERS[v])
    window(p, -0.61, 0.04, 0.55, face='left', shutters=SHUTTERS[v])
    box(p, (0.2, 0.2, 0.55), (0.33, 0.28, 1.3), P['stone2'], bevel=0.03, name='chimney')
    box(p, (0.25, 0.25, 0.05), (0.33, 0.28, 1.58), P['stone'], bevel=0.015, name='chimcap')
    flowers(p, -0.62, -0.55)
    flowers(p, 0.66, -0.56, 0.1, [P['yellow'], P['white']])
    box(p, (0.3, 0.1, 0.05), (-0.26, -0.56, 0.03), P['stone'], bevel=0.015, name='step')
    # small picket fence along the side
    for i in range(4):
        box(p, (0.035, 0.035, 0.22), (0.78, -0.25 + i * 0.22, 0.11), P['white'], bevel=0.008, name='picket')
    box(p, (0.03, 0.7, 0.035), (0.78, 0.08, 0.17), P['white'], bevel=0.005, name='rail')

ROOFS = ['#E8665A', '#5D8FD0', '#6DB36A', '#F0A04B']
def house_worker(v):
    p = root(f'house_worker_{v}')
    rc = ROOFS[v]
    box(p, (1.65, 1.45, 0.16), (0, 0.02, 0.08), P['stone'], bevel=0.035, name='base')
    box(p, (1.3, 1.05, 0.62), (0, 0.04, 0.47), P['plaster'], bevel=0.03)
    box(p, (1.44, 1.19, 0.08), (0, 0.04, 0.82), P['beam'], bevel=0.015, name='floorbeam')
    box(p, (1.4, 1.15, 0.62), (0, 0.04, 1.15), P['plaster'], bevel=0.03)
    # timber framing on the upper floor
    for x in (-0.68, -0.23, 0.23, 0.68):
        box(p, (0.06, 0.03, 0.62), (x, -0.545, 1.15), P['beam'], bevel=0.008, name='timber')
    for sx in (-1, 1):
        box(p, (0.03, 0.03, 0.56), (sx * 0.455, -0.548, 1.15), P['beam'], rot=(0, sx * 0.62, 0), bevel=0.006, name='brace')
    box(p, (1.42, 0.03, 0.06), (0, -0.545, 1.43), P['beam'], bevel=0.008, name='timber')
    gable_fill(p, 1.4, 1.15, 0.62, 1.46, P['plaster'], y0=0.04)
    roof(p, 1.4, 1.15, 0.66, 1.46, rc, thick=0.085, oh=0.14, bevel=0.03, y0=0.04, ridge=P['beam'])
    # roof tile rows
    door(p, -0.32, -0.49, 0.16, w=0.28, h=0.46, col='#9A5E3E')
    lantern(p, -0.09, -0.53, 0.58)
    window(p, 0.3, -0.49, 0.5, w=0.26, h=0.26, shutters=rc)
    window(p, -0.45, -0.55, 1.12, w=0.22, h=0.24, box_col=P['pink'])
    window(p, 0.45, -0.55, 1.12, w=0.22, h=0.24, box_col=P['red'])
    window(p, 0.71, 0.04, 1.12, face='right', w=0.22, h=0.24)
    window(p, -0.71, 0.04, 1.12, face='left', w=0.22, h=0.24)
    window(p, -0.66, 0.04, 0.47, face='left', w=0.24, h=0.24, shutters=rc)
    cyl(p, 0.11, 0.11, 0.04, (0.71, 0.04, 1.66), P['glass'], seg=14, rot=(0, math.pi / 2, 0), kind='G', name='roundwin')
    box(p, (0.22, 0.22, 0.75), (0.42, 0.32, 1.9), P['brick'], bevel=0.025, name='chimney')
    box(p, (0.27, 0.27, 0.05), (0.42, 0.32, 2.28), P['brick2'], bevel=0.015, name='chimcap')
    box(p, (0.36, 0.14, 0.06), (-0.32, -0.6, 0.03), P['stone'], bevel=0.015, name='step')
    flowers(p, 0.7, -0.62, 0.11)
    barrel(p, -0.72, -0.55, 0.0, 0.09, 0.22)

def depot():
    p = root('depot')
    box(p, (2.9, 2.9, 0.22), (0, 0, 0.11), P['stone'], bevel=0.04, name='quay')
    for i in range(7):
        box(p, (2.92, 0.06, 0.04), (0, -1.3 + i * 0.43, 0.205), P['stone2'], bevel=0.0, name='paving')
    # main hall
    box(p, (1.9, 1.25, 0.95), (-0.25, 0.45, 0.7), P['cream'], bevel=0.03)
    box(p, (1.96, 1.31, 0.07), (-0.25, 0.45, 1.18), P['beam'], bevel=0.015)
    gable_fill(p, 1.9, 1.25, 0.6, 1.21, P['cream'], y0=0.45, x0=-0.25)
    roof(p, 1.9, 1.25, 0.62, 1.21, P['blue'], thick=0.09, oh=0.14, x0=-0.25, y0=0.45, ridge=P['beam'])
    door(p, -0.25, -0.18, 0.22, w=0.36, h=0.52, col='#5A86B8')
    for x in (-0.85, 0.35):
        window(p, x, -0.18, 0.78, w=0.26, h=0.28, shutters=P['blue'], box_col=P['pink'])
    # clock tower
    box(p, (0.72, 0.72, 1.95), (1.0, 0.75, 1.19), P['plaster'], bevel=0.03, name='tower')
    for z in (0.6, 1.4):
        box(p, (0.78, 0.78, 0.07), (1.0, 0.75, z), P['beam'], bevel=0.012)
    cyl(p, 0.62, 0.0, 0.75, (1.0, 0.75, 2.53), P['red'], seg=4, rot=(0, 0, math.pi / 4), name='spire', smooth=False)
    cyl(p, 0.2, 0.2, 0.05, (1.0, 0.38, 1.78), P['white'], seg=20, rot=(math.pi / 2, 0, 0), kind='G', name='clock')
    box(p, (0.025, 0.02, 0.14), (1.0, 0.35, 1.82), P['dark'], bevel=0, name='hand')
    box(p, (0.1, 0.02, 0.025), (1.04, 0.35, 1.78), P['dark'], bevel=0, name='hand')
    cyl(p, 0.022, 0.022, 0.7, (1.0, 0.75, 3.2), P['beam'], seg=8, name='pole')
    box(p, (0.42, 0.02, 0.26), (1.22, 0.75, 3.38), P['red'], bevel=0.008, name='flag')
    # cargo on the quay
    crate(p, 0.65, -0.55, 0.22)
    crate(p, 0.92, -0.62, 0.22, 0.2, '#F0C080')
    crate(p, 0.78, -0.58, 0.44, 0.18)
    barrel(p, -1.15, -0.45, 0.22)
    barrel(p, -0.9, -0.6, 0.22)
    # pier toward the water
    box(p, (0.9, 1.5, 0.08), (-0.2, -2.0, 0.2), P['wood'], bevel=0.015, name='pier')
    for i in range(8):
        box(p, (0.92, 0.02, 0.085), (-0.2, -1.32 - i * 0.18, 0.205), P['wood2'], bevel=0, name='plank')
    for x in (-0.6, 0.2):
        for y in (-1.4, -2.65):
            cyl(p, 0.06, 0.06, 0.7, (x, y, -0.1), P['beam'], seg=8, name='piling')
    lantern(p, 0.25, -2.65, 0.32)
    # crane
    cyl(p, 0.05, 0.06, 1.3, (1.15, -1.0, 0.86), P['wood2'], seg=8, name='crane')
    box(p, (0.07, 0.9, 0.07), (1.15, -1.38, 1.47), P['wood2'], bevel=0.01, name='boom')
    cyl(p, 0.008, 0.008, 0.5, (1.15, -1.78, 1.2), P['dark'], seg=4, name='rope', bevel=0)
    crate(p, 1.15, -1.78, 0.84, 0.17, '#E9B370')

def warehouse():
    p = root('warehouse')
    box(p, (1.75, 1.6, 0.12), (0, 0.02, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.45, 1.2, 0.95), (0, 0.1, 0.59), '#E2725B', bevel=0.03)
    for x in (-0.725, 0.725):
        box(p, (0.06, 1.24, 0.96), (x, 0.1, 0.59), P['white'], bevel=0.01, name='trim')
    gable_fill(p, 1.45, 1.2, 0.62, 1.06, '#E2725B', y0=0.1)
    roof(p, 1.45, 1.2, 0.66, 1.06, '#7E8A9A', thick=0.08, oh=0.12, y0=0.1, ridge=P['dark'])
    # big doors with white X bracing
    box(p, (0.72, 0.05, 0.74), (0, -0.5, 0.49), '#C9583F', bevel=0.012, name='bigdoor')
    box(p, (0.78, 0.04, 0.06), (0, -0.53, 0.86), P['white'], bevel=0.008)
    for sx in (-1, 1):
        box(p, (0.05, 0.04, 0.95), (0, -0.53, 0.49), P['white'], rot=(0, sx * 0.77, 0), bevel=0.006, name='xbrace')
    box(p, (0.04, 0.045, 0.74), (0, -0.53, 0.49), P['white'], bevel=0.006)
    # hay loft door and hoist beam on the gable
    box(p, (0.3, 0.04, 0.26), (0, -0.5, 1.2), P['white'], bevel=0.008)
    box(p, (0.24, 0.05, 0.2), (0, -0.51, 1.2), '#C9583F', bevel=0.006)
    box(p, (0.06, 0.4, 0.06), (0, -0.6, 1.5), P['beam'], bevel=0.008, name='hoist')
    cyl(p, 0.006, 0.006, 0.3, (0, -0.78, 1.33), P['dark'], seg=4, bevel=0, name='rope')
    crate(p, 0.6, -0.66, 0.12, 0.24)
    crate(p, 0.6, -0.66, 0.36, 0.2, '#F0C080')
    crate(p, 0.32, -0.7, 0.12, 0.2)
    for i, x in enumerate((-0.45, -0.7, -0.58)):
        ball(p, 0.12, (x, -0.66 + (0.05 if i == 2 else 0), 0.22 + (0.16 if i == 2 else 0)), '#F1E0B5', scale=(1, 0.85, 0.75), name='sack')

def lumberjack():
    p = root('lumberjack')
    box(p, (1.7, 1.6, 0.08), (0, 0, 0.04), '#B9A285', bevel=0.02, name='yard')
    # log cabin: stacked logs
    for i in range(6):
        z = 0.12 + i * 0.11
        cyl(p, 0.06, 0.06, 1.1, (-0.25, -0.2 - 0.0, z), '#B87A48', seg=10, rot=(0, math.pi / 2, 0), name='log')
        cyl(p, 0.06, 0.06, 1.1, (-0.25, 0.6, z), '#B87A48', seg=10, rot=(0, math.pi / 2, 0), name='log')
        cyl(p, 0.06, 0.06, 0.86, (-0.78, 0.2, z + 0.055), '#A86C3E', seg=10, rot=(math.pi / 2, 0, 0), name='log')
        cyl(p, 0.06, 0.06, 0.86, (0.28, 0.2, z + 0.055), '#A86C3E', seg=10, rot=(math.pi / 2, 0, 0), name='log')
    box(p, (1.0, 0.76, 0.66), (-0.25, 0.2, 0.42), '#9E6538', bevel=0.02, name='core')
    gable_fill(p, 1.1, 0.86, 0.42, 0.78, '#B87A48', y0=0.2, x0=-0.25)
    roof(p, 1.1, 0.86, 0.45, 0.78, P['green'], thick=0.09, oh=0.14, x0=-0.25, y0=0.2, ridge=P['beam'])
    door(p, -0.42, -0.27, 0.06, w=0.24, h=0.4, col=P['door'], arch=False)
    window(p, -0.02, -0.27, 0.48, w=0.2, h=0.2, shutters=P['green'])
    # log pile with light end caps
    for row, (n, z) in enumerate([(3, 0.14), (2, 0.33), (1, 0.52)]):
        for i in range(n):
            y = -0.45 + (i - (n - 1) / 2) * 0.21
            cyl(p, 0.1, 0.1, 0.72, (0.55, y + 0.15, z), '#B87A48', seg=12, rot=(0, math.pi / 2, 0), name='pilelog')
            for ex in (-0.361, 0.361):
                cyl(p, 0.085, 0.085, 0.01, (0.55 + ex, y + 0.15, z), '#F1C99A', seg=12, rot=(0, math.pi / 2, 0), bevel=0, name='endcap')
    # chopping stump with axe
    cyl(p, 0.17, 0.2, 0.24, (0.5, 0.58, 0.16), '#A86C3E', seg=14, name='stump')
    cyl(p, 0.16, 0.16, 0.01, (0.5, 0.58, 0.285), '#F1C99A', seg=14, bevel=0, name='ring')
    cyl(p, 0.02, 0.02, 0.38, (0.5, 0.58, 0.44), P['beam'], seg=6, rot=(0.35, 0, 0), name='handle')
    box(p, (0.03, 0.14, 0.08), (0.5, 0.51, 0.3), P['metal'], rot=(0.35, 0, 0), bevel=0.008, name='axehead')
    flowers(p, -0.75, -0.55, 0.1)

def sawmill():
    p = root('sawmill')
    box(p, (1.75, 1.6, 0.12), (0, 0.02, 0.06), P['wood'], bevel=0.02, name='deck')
    for i in range(9):
        box(p, (1.76, 0.015, 0.125), (0, -0.7 + i * 0.18, 0.062), P['wood2'], bevel=0, name='plank')
    for x in (-0.7, 0.45):
        for y in (-0.35, 0.65):
            box(p, (0.08, 0.08, 0.8), (x, y, 0.52), P['beam'], bevel=0.012, name='post')
    box(p, (1.2, 0.08, 0.8), (-0.12, 0.66, 0.52), '#E9C38F', bevel=0.02, name='backwall')
    roof(p, 1.3, 1.1, 0.45, 0.92, P['red'], thick=0.08, oh=0.14, x0=-0.12, y0=0.15, ridge=P['beam'])
    gable_fill(p, 0.06, 1.1, 0.45, 0.92, '#E9C38F', y0=0.15, x0=-0.75)
    # saw table and log being cut
    box(p, (0.95, 0.34, 0.3), (-0.2, 0.05, 0.27), P['wood2'], bevel=0.015, name='table')
    cyl(p, 0.12, 0.12, 0.85, (-0.2, 0.05, 0.54), '#B87A48', seg=12, rot=(0, math.pi / 2, 0), name='log')
    # plank stacks
    for i in range(5):
        box(p, (0.6, 0.22, 0.045), (0.2 + (i % 2) * 0.02, -0.6, 0.15 + i * 0.05), '#F2CF93' if i % 2 else '#E8BD80', bevel=0.006, name='plank')
    for i in range(3):
        box(p, (0.5, 0.2, 0.045), (-0.55, -0.62, 0.15 + i * 0.05), '#F2CF93', bevel=0.006, name='plank')
    # water wheel on the side (spins around X)
    w = root('spinx_wheel')
    w.parent = p
    w.location = (0.78, 0.1, 0.5)
    cyl(w, 0.08, 0.08, 0.2, (0, 0, 0), P['beam'], seg=10, rot=(0, math.pi / 2, 0), name='hub')
    for side in (-0.08, 0.08):
        torus(w, 0.42, 0.025, (side, 0, 0), P['wood2'], rot=(0, math.pi / 2, 0), seg=24, rseg=6, name='rim')
    for i in range(8):
        a = i * math.pi / 4
        box(w, (0.2, 0.05, 0.44), (0, math.sin(a) * 0.24, math.cos(a) * 0.24), P['wood'], rot=(a, 0, 0), bevel=0.008, name='spoke')
        box(w, (0.22, 0.14, 0.03), (0, math.sin(a) * 0.43, math.cos(a) * 0.43), P['wood'], rot=(a, 0, 0), bevel=0.006, name='paddle')
    # the round saw (spins around Y in Blender, Z in game)
    s = root('spinz_saw')
    s.parent = p
    s.location = (0.2, -0.05, 0.5)
    cyl(s, 0.24, 0.24, 0.025, (0, 0, 0), P['metal'], seg=24, rot=(math.pi / 2, 0, 0), name='blade')
    for i in range(16):
        a = i * math.pi / 8
        box(s, (0.05, 0.026, 0.05), (math.cos(a) * 0.25, 0, math.sin(a) * 0.25), P['metal'], rot=(0, -a + math.pi / 4, 0), bevel=0, name='tooth')
    cyl(s, 0.05, 0.05, 0.05, (0, 0, 0), P['dark'], seg=10, rot=(math.pi / 2, 0, 0), name='hub')

def mill():
    p = root('mill')
    box(p, (1.5, 1.5, 0.1), (0, 0, 0.05), P['stone'], bevel=0.03, name='base')
    cyl(p, 0.62, 0.66, 0.42, (0, 0.05, 0.31), P['stone2'], seg=8, name='foot', smooth=False)
    cyl(p, 0.42, 0.56, 1.4, (0, 0.05, 1.22), P['cream'], seg=8, name='tower', smooth=False)
    cyl(p, 0.48, 0.48, 0.07, (0, 0.05, 1.0), P['wood2'], seg=8, bevel=0.01, name='band', smooth=False)
    cyl(p, 0.5, 0.0, 0.62, (0, 0.05, 2.22), '#C9583F', seg=8, name='cap', smooth=False)
    ball(p, 0.07, (0, 0.05, 2.55), P['gold'], name='finial')
    door(p, 0, -0.56, 0.1, w=0.26, h=0.42, col='#C9583F')
    window(p, 0, -0.46, 1.25, w=0.16, h=0.2)
    window(p, 0, -0.42, 1.7, w=0.13, h=0.16)
    for i, (x, y) in enumerate(((0.52, -0.5), (0.36, -0.62), (0.45, -0.56))):
        ball(p, 0.11, (x, y, 0.2 + (0.14 if i == 2 else 0)), '#F3E4BE', scale=(1, 0.85, 0.85), name='sack')
    # sails (spin around Y in Blender)
    s = root('spinz_sails')
    s.parent = p
    s.location = (0, -0.48, 1.9)
    ball(s, 0.1, (0, -0.05, 0), P['beam'], name='hub')
    for i in range(4):
        a = i * math.pi / 2
        c, sn = math.cos(a), math.sin(a)
        box(s, (0.06, 0.04, 1.0), (sn * 0.5, 0, c * 0.5), P['beam'], rot=(0, a, 0), bevel=0.008, name='spar')
        # cloth panel beside each spar
        ox, oz = c * 0.12, -sn * 0.12
        box(s, (0.2, 0.02, 0.72), (sn * 0.6 + ox, 0.01, c * 0.6 + oz), P['cloth'], rot=(0, a, 0), bevel=0.006, name='sail')
        for k in range(4):
            d = 0.3 + k * 0.2
            box(s, (0.24, 0.025, 0.02), (sn * d + ox, -0.01, c * d + oz), P['wood2'], rot=(0, a, 0), bevel=0, name='lath')

def bakery():
    p = root('bakery')
    box(p, (1.65, 1.5, 0.12), (0, 0.02, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.35, 1.05, 0.42), (0, 0.15, 0.33), P['brick'], bevel=0.025, name='brickwall')
    box(p, (1.35, 1.05, 0.5), (0, 0.15, 0.79), '#FFE6BF', bevel=0.025)
    box(p, (1.41, 1.11, 0.06), (0, 0.15, 1.05), P['beam'], bevel=0.012)
    gable_fill(p, 1.35, 1.05, 0.5, 1.08, '#FFE6BF', y0=0.15)
    roof(p, 1.35, 1.05, 0.52, 1.08, P['orange'], thick=0.085, oh=0.13, y0=0.15, ridge=P['brick2'])
    # shop window and door
    box(p, (0.6, 0.06, 0.4), (0.28, -0.38, 0.5), P['white'], bevel=0.015, name='shopframe')
    box(p, (0.52, 0.07, 0.32), (0.28, -0.385, 0.5), '#FFD58A', bevel=0.006, kind='G', name='shopglass')
    for x in (0.1, 0.28, 0.46):
        ball(p, 0.06, (x, -0.43, 0.4), '#C9803E', scale=(1.4, 0.7, 0.7), name='loaf')
    door(p, -0.32, -0.38, 0.12, w=0.26, h=0.44, col='#E8665A')
    awning_striped(p, 0.0, -0.53, 0.84, 1.2, 0.34, [P['red'], P['white']], tilt=0.42, stripes=8)
    window(p, 0.0, -0.38, 1.25, w=0.2, h=0.2, box_col=P['yellow'])
    # round bread sign
    box(p, (0.03, 0.22, 0.03), (0.72, -0.35, 0.95), P['beam'], bevel=0.005)
    cyl(p, 0.14, 0.14, 0.03, (0.72, -0.48, 0.8), P['gold'], seg=18, rot=(0, math.pi / 2, 0), name='sign')
    ball(p, 0.07, (0.705, -0.48, 0.8), '#B86A2C', scale=(0.5, 1.3, 0.8), name='signbread')
    # tall chimney
    cyl(p, 0.14, 0.17, 0.95, (0.42, 0.42, 1.55), P['brick'], seg=10, name='chimney')
    cyl(p, 0.18, 0.18, 0.06, (0.42, 0.42, 2.03), P['brick2'], seg=10, name='chimcap')
    # bread stand outside
    box(p, (0.4, 0.22, 0.24), (0.45, -0.68, 0.24), P['wood'], bevel=0.015, name='stand')
    for x in (0.34, 0.47, 0.58):
        ball(p, 0.055, (x, -0.68, 0.39), '#D9944F', scale=(1.3, 0.8, 0.7), name='loaf')
    box(p, (0.5, 0.16, 0.04), (-0.45, -0.68, 0.22), P['wood2'], bevel=0.008, name='bench')
    for x in (-0.65, -0.25):
        box(p, (0.04, 0.12, 0.2), (x, -0.68, 0.1), P['beam'], bevel=0.005)

def market():
    p = root('market')
    box(p, (1.85, 1.85, 0.08), (0, 0, 0.04), '#EFE2C8', bevel=0.025, name='plaza')
    for i in range(5):
        box(p, (1.86, 0.02, 0.085), (0, -0.74 + i * 0.37, 0.042), '#E0CFAE', bevel=0, name='joint')
    # fountain
    cyl(p, 0.36, 0.38, 0.2, (0, 0, 0.18), P['stone'], seg=20, name='basin')
    cyl(p, 0.31, 0.31, 0.02, (0, 0, 0.27), P['water'], seg=20, bevel=0, name='pool')
    cyl(p, 0.06, 0.08, 0.36, (0, 0, 0.43), P['stone2'], seg=10, name='pillar')
    cyl(p, 0.16, 0.06, 0.08, (0, 0, 0.63), P['stone'], seg=14, name='bowl')
    ball(p, 0.06, (0, 0, 0.72), P['water'], name='spout')
    stalls = [(-0.55, -0.55, 0, [P['red'], P['white']], [P['red'], '#F5A35C', P['red']]),
              (0.55, -0.55, 0, [P['blue'], P['white']], [P['sprout'], P['sprout'], '#F2CF5B']),
              (-0.55, 0.6, math.pi, [P['yellow'], P['white']], ['#F5A35C', '#FFE07A', '#F5A35C']),
              (0.55, 0.6, math.pi, [P['green'], P['white']], ['#B9D9EF', '#F5A35C', '#B9D9EF'])]
    for x, y, rz, stripes, goods in stalls:
        c = math.cos(rz)
        box(p, (0.62, 0.34, 0.26), (x, y, 0.21), P['wood'], rot=(0, 0, rz), bevel=0.015, name='counter')
        for sx in (-0.29, 0.29):
            box(p, (0.04, 0.04, 0.62), (x + sx * c, y + 0.15 * c, 0.39), P['beam'], bevel=0.006, name='stallpost')
        awning_striped(p, x, y - 0.02 * c, 0.74, 0.7, 0.5, stripes, tilt=0.32 * c, stripes=6, rz=rz)
        for i, g in enumerate(goods):
            for k in range(3):
                ball(p, 0.045, (x + (-0.18 + i * 0.18 + (k - 1) * 0.045) * c, y - 0.04 * c + (k % 2) * 0.05, 0.37 + (k == 1) * 0.03), g, seg=10, rings=7, name='produce')
    crate(p, 0.85, 0.05, 0.08, 0.18)
    crate(p, -0.85, 0.05, 0.08, 0.18, '#F0C080')

def tavern():
    p = root('tavern')
    box(p, (1.7, 1.55, 0.12), (0, 0.02, 0.06), P['stone'], bevel=0.03, name='base')
    box(p, (1.3, 1.05, 0.6), (0, 0.15, 0.42), '#F5E4C3', bevel=0.025)
    box(p, (1.44, 1.2, 0.08), (0, 0.15, 0.76), P['beam'], bevel=0.015)
    box(p, (1.46, 1.2, 0.6), (0, 0.15, 1.1), '#F5E4C3', bevel=0.025)
    for x in (-0.7, -0.35, 0.0, 0.35, 0.7):
        box(p, (0.06, 0.03, 0.6), (x, -0.46, 1.1), P['beam'], bevel=0.008, name='timber')
        box(p, (0.06, 0.03, 0.6), (x * 0.9, -0.39, 0.42), P['beam'], bevel=0.008, name='timber')
    box(p, (1.48, 0.03, 0.06), (0, -0.46, 1.38), P['beam'], bevel=0.008)
    gable_fill(p, 1.46, 1.2, 0.6, 1.4, '#F5E4C3', y0=0.15)
    roof(p, 1.46, 1.2, 0.64, 1.4, '#3E9A6C', thick=0.09, oh=0.14, y0=0.15, ridge=P['beam'])
    door(p, 0.0, -0.39, 0.12, w=0.3, h=0.46, col='#7A4E32')
    for x in (-0.42, 0.42):
        window(p, x, -0.39, 0.45, w=0.22, h=0.22)
        window(p, x * 1.2 - (0.08 if x < 0 else -0.08) * 0, -0.47, 1.08, w=0.2, h=0.22, box_col=P['red'])
    window(p, 0.0, -0.47, 1.08, w=0.16, h=0.22)
    lantern(p, -0.22, -0.44, 0.55)
    lantern(p, 0.22, -0.44, 0.55)
    # hanging mug sign
    box(p, (0.03, 0.3, 0.03), (0.78, -0.3, 0.98), P['beam'], bevel=0.005, name='bracket')
    box(p, (0.03, 0.26, 0.2), (0.78, -0.4, 0.82), '#F4C84B', bevel=0.012, name='signboard')
    cyl(p, 0.05, 0.05, 0.1, (0.765, -0.4, 0.82), P['white'], seg=10, name='mug')
    box(p, (0.5, 0.18, 0.04), (0.0, 0.8, 1.9), P['beam'], bevel=0.01, name='ridgeboard')
    box(p, (0.2, 0.2, 0.6), (-0.4, 0.45, 1.95), P['brick'], bevel=0.02, name='chimney')
    # outdoor table and barrels
    cyl(p, 0.18, 0.18, 0.04, (-0.55, -0.68, 0.32), P['wood'], seg=14, name='tabletop')
    cyl(p, 0.03, 0.04, 0.3, (-0.55, -0.68, 0.16), P['beam'], seg=8, name='tableleg')
    for dx in (-0.25, 0.15):
        cyl(p, 0.07, 0.07, 0.18, (-0.55 + dx, -0.72, 0.09), P['wood2'], seg=10, name='stool')
    cyl(p, 0.015, 0.015, 0.7, (-0.55, -0.68, 0.6), P['white'], seg=6, name='umbrellapole')
    cyl(p, 0.36, 0.0, 0.18, (-0.55, -0.68, 0.96), P['red'], seg=8, name='umbrella', smooth=False)
    barrel(p, 0.55, -0.66, 0.12)
    barrel(p, 0.75, -0.6, 0.12, 0.1, 0.24)

# ======================================================================
#                       NATURE, PEOPLE, VEHICLES, PROPS
# ======================================================================
def tree_round():
    p = root('tree_round')
    cyl(p, 0.05, 0.08, 0.4, (0, 0, 0.2), P['trunk'], seg=8, name='trunk')
    for (x, y, z, r, c) in [(0, 0, 0.58, 0.3, P['leaf']), (0.14, 0.05, 0.78, 0.2, P['leaf2']), (-0.13, -0.06, 0.72, 0.19, P['leaf']), (0.02, -0.12, 0.86, 0.15, P['leaf2'])]:
        ball(p, r, (x, y, z), c, seg=10, rings=7, kind='L', name='leaves')

def tree_pine():
    p = root('tree_pine')
    cyl(p, 0.05, 0.07, 0.3, (0, 0, 0.15), P['trunk'], seg=8, name='trunk')
    for (z, r, h, c) in [(0.45, 0.34, 0.48, P['pine']), (0.7, 0.27, 0.42, P['pine2']), (0.92, 0.19, 0.36, P['pine'])]:
        cyl(p, r, 0.0, h, (0, 0, z), c, seg=10, kind='L', name='needles', smooth=False)

def bush():
    p = root('bush')
    for (x, y, r) in [(0, 0, 0.18), (0.14, 0.05, 0.13), (-0.12, 0.04, 0.12)]:
        ball(p, r, (x, y, r * 0.8), P['leaf2'], scale=(1, 1, 0.85), kind='L', name='bush')
    ball(p, 0.035, (0.05, -0.12, 0.22), P['pink'], name='flower')
    ball(p, 0.035, (-0.1, -0.08, 0.18), P['yellow'], name='flower')

def rock():
    p = root('rock')
    for (x, y, r, c) in [(0, 0, 0.36, '#BDB6AA'), (0.32, 0.18, 0.22, '#ADA597'), (-0.28, -0.2, 0.18, '#C9C2B6')]:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        for v in bm.verts:
            v.co *= 0.85 + random.random() * 0.3
            v.co.z *= 0.75
        finish(bm, 'rock', mat(c), p, (x, y, r * 0.45), (0, 0, random.random() * 3), 0, 1, False)

def villager():
    # body: clothes are white and get tinted per person in the game
    p = root('villager_body')
    cyl(p, 0.1, 0.12, 0.2, (0, 0, 0.17), P['white'], seg=12, kind='T', name='torso')
    ball(p, 0.1, (0, 0, 0.27), P['white'], scale=(1, 0.95, 0.6), kind='T', name='shoulders')
    for x in (-0.05, 0.05):
        ball(p, 0.045, (x, -0.01, 0.04), P['beam'], scale=(1, 1.3, 0.7), name='foot')
    for x in (-0.11, 0.11):
        ball(p, 0.04, (x, 0, 0.19), P['skin'], name='hand')
    heads = {
        'villager_head': None,
        'villager_head_straw': 'straw',
        'villager_head_cap': 'cap',
        'villager_head_bun': 'bun',
    }
    for name, hat in heads.items():
        h = root(name)
        ball(h, 0.15, (0, 0, 0.45), P['skin'], seg=14, rings=9, name='face')
        if hat != 'bun':
            ball(h, 0.155, (0, 0.025, 0.49), P['hair'], scale=(1, 1, 0.8), seg=14, rings=9, name='hair')
        else:
            ball(h, 0.155, (0, 0.03, 0.49), '#3E2A20', scale=(1, 1, 0.82), seg=14, rings=9, name='hair')
            ball(h, 0.07, (0, 0.1, 0.62), '#3E2A20', name='bun')
        for x in (-0.05, 0.05):
            ball(h, 0.018, (x, -0.135, 0.44), P['dark'], name='eye')
            ball(h, 0.025, (x * 1.6, -0.12, 0.405), '#FFB0A8', scale=(1, 0.5, 0.6), name='blush')
        if hat == 'straw':
            cyl(h, 0.24, 0.24, 0.02, (0, 0, 0.56), P['straw'], seg=16, name='brim')
            cyl(h, 0.12, 0.1, 0.1, (0, 0, 0.62), P['straw'], seg=14, name='crown')
            cyl(h, 0.122, 0.122, 0.025, (0, 0, 0.59), P['red'], seg=14, bevel=0, name='ribbon')
        if hat == 'cap':
            ball(h, 0.155, (0, 0.01, 0.52), '#5D8FD0', scale=(1, 1, 0.65), name='cap')
            box(h, (0.16, 0.12, 0.02), (0, -0.15, 0.53), '#5D8FD0', bevel=0.01, name='visor')

def cart():
    p = root('cart')
    box(p, (0.42, 0.3, 0.06), (0, 0, 0.2), P['wood'], bevel=0.01, name='bed')
    for y in (-0.15, 0.15):
        box(p, (0.42, 0.03, 0.1), (0, y, 0.27), P['wood2'], bevel=0.006, name='side')
    for y in (-0.17, 0.17):
        cyl(p, 0.11, 0.11, 0.035, (0, y, 0.12), P['wood2'], seg=12, rot=(math.pi / 2, 0, 0), name='wheel')
        cyl(p, 0.03, 0.03, 0.04, (0, y, 0.12), P['dark'], seg=8, rot=(math.pi / 2, 0, 0), name='axle')
    for y in (-0.11, 0.11):
        box(p, (0.32, 0.025, 0.025), (0.34, y, 0.24), P['wood2'], rot=(0, -0.25, 0), bevel=0.004, name='handle')
    c = root('cart_cargo')
    box(c, (0.3, 0.22, 0.16), (0, 0, 0.32), P['white'], bevel=0.02, kind='T', name='cargo')

def boat():
    p = root('boat')
    hull = [(-0.42, 0.14), (0.48, 0.14), (0.36, -0.02), (-0.32, -0.04)]
    poly_prism(p, hull, 0.3, (0, 0, 0), '#F7F2E6', rot=(0, 0, math.pi / 2), name='hull')
    box(p, (0.32, 0.86, 0.04), (0, 0.02, 0.15), '#5D8FD0', bevel=0.01, name='trimband')
    box(p, (0.24, 0.72, 0.03), (0, 0.02, 0.1), P['wood'], bevel=0.006, name='floor')
    cyl(p, 0.015, 0.015, 0.7, (0, -0.05, 0.45), P['beam'], seg=6, name='mast')
    poly_prism(p, [(0.0, 0.18), (0.0, 0.76), (0.32, 0.2)], 0.012, (0, -0.06, 0), P['cloth'], rot=(0, 0, math.pi / 2), name='sail')
    box(p, (0.16, 0.14, 0.12), (0, 0.22, 0.2), '#E2A86A', bevel=0.012, name='fishcrate')

def lamp():
    p = root('lamp')
    cyl(p, 0.05, 0.06, 0.06, (0, 0, 0.03), P['dark'], seg=8, name='lampbase')
    cyl(p, 0.018, 0.018, 0.75, (0, 0, 0.42), P['dark'], seg=6, name='lamppost')
    box(p, (0.11, 0.11, 0.13), (0, 0, 0.84), '#FFE29A', bevel=0.015, kind='G', name='lamplight')
    cyl(p, 0.1, 0.0, 0.08, (0, 0, 0.94), P['dark'], seg=4, rot=(0, 0, math.pi / 4), name='lamptop', smooth=False)

# ---------- milestone 1 models ----------
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models_m1.py'), encoding='utf-8').read())

# ---------- build all ----------
for v in range(4):
    house_peasant(v)
    house_worker(v)
    house_technician(v)
    house_citizen(v)
for f in (depot, warehouse, lumberjack, sawmill, mill, bakery, market, tavern,
          tree_round, tree_pine, bush, rock, villager, cart, boat, lamp,
          sheepfarm, study, church, woodshed, claypit, brickworks, weaver, tailor, mine, smithy, park, guild,
          factory, plant_modern, cannery, brewery, powerplant, heatplant, school, townhall, university,
          factory_small, windturbine, solar, hydro, purifier, recycler, theatre, lab, ore_iron, ore_coal, bridge, bridge_plain, firestation, police):
    f()
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models_resize.py'), encoding='utf-8').read())
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models_m2.py'), encoding='utf-8').read())
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models_anim.py'), encoding='utf-8').read())
# chimney smoke markers on the older houses
for o in list(bpy.data.objects):
    if o.parent is None and o.name.startswith('house_peasant_'):
        smoke(o, 0.33, 0.28, 1.62)
    if o.parent is None and o.name.startswith('house_worker_'):
        smoke(o, 0.42, 0.32, 2.32)
    if o.parent is None and o.name == 'bakery':
        smoke(o, 0.42, 0.42, 2.06)
    if o.parent is None and o.name == 'tavern':
        smoke(o, -0.9, 0.45, 2.27)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_texcoords=False, export_animations=False, export_cameras=False, export_lights=False)
names = [o.name for o in bpy.data.objects if o.parent is None]
print('roots:', ' '.join(sorted(names)))
print('exported', OUT, os.path.getsize(OUT) // 1024, 'KB')
print('next: node tools/compress-models.mjs public/models/town.glb public/models/town.glb')
