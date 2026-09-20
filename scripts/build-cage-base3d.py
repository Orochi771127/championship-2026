"""Original, editable Blender Cage look-development masters.

Run with Blender --background --factory-startup --python this-file -- --field field_cm28_01.
Only numeric layout evidence is read. No research/reference raster is imported.
This is a visual candidate, not a gameplay, collision, or shipping authority.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import shutil
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_authoring_coordinates import placed_cell_bounds
from lib.cage_sports_authoring import build_sports_family
from lib.cage_nature_authoring import FIELDS as STAGE2_BATCH3, SURFACES as NATURE_SURFACES, prepare_nature_materials, build_nature_family
from lib.cage_hex_authoring import field_footprint
from lib.cage_animated_surface_authoring import FIELDS as STAGE3_BATCH1, SURFACES as ANIMATED_SURFACES, prepare as prepare_animated_surface, build as build_animated_surface
OUT = ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
ELEVATION = math.radians(52)
S, C = math.sin(ELEVATION), math.cos(ELEVATION)
UNIT = 16
RNG = random.Random(20260919)
M = {}
LAYER = 'base'
FIELD_ID = None
LOOK = 'structural-v1'
MATERIAL_INPUT = None
STAGE2_BATCH1 = ('field_cm30_01', 'field_cm31_01', 'field_cm34_01', 'field_cm05_01')
STAGE2_BATCH2 = ('field_cm03_01','field_cm04_01','field_cm27_01')


def daylight():
    return LOOK in ('daylight-v2', 'seam-v3')


def seam_materials():
    """Field-local coordinates with a lattice periodic under native ranch offsets.

    u=x/16+y/8, v=x/16-y/8. A bay shift (48,88) adds (14,-8),
    and a column shift (96,0) adds (6,6): checker parity is preserved.
    Position (not per-object Generated coordinates) also fixes apron/base phase.
    """
    mat=M['checker']; nodes,links=mat.node_tree.nodes,mat.node_tree.links
    checker=next(n for n in nodes if n.type=='TEX_CHECKER')
    geometry=nodes.new('ShaderNodeNewGeometry')
    combine=nodes.new('ShaderNodeCombineXYZ')
    k=UNIT/math.sqrt(2)
    for axis,sign in [('X',1),('Y',-1)]:
        dot=nodes.new('ShaderNodeVectorMath'); dot.operation='DOT_PRODUCT'
        dot.inputs[1].default_value=(k*(1/16+sign*S/8),k*(1/16-sign*S/8),0)
        links.new(geometry.outputs['Position'],dot.inputs[0])
        links.new(dot.outputs['Value'],combine.inputs[axis])
    links.new(combine.outputs[0],checker.inputs['Vector'])
    checker.inputs['Scale'].default_value=1
    M['tile']=M['checker'].copy(); M['tile'].name='clinic-porcelain-tiles'
    tiles=next(n for n in M['tile'].node_tree.nodes if n.type=='TEX_CHECKER')
    tiles.inputs['Color1'].default_value=(.48,.66,.75,1)
    tiles.inputs['Color2'].default_value=(.76,.87,.91,1)
    M['soil']=M['clay'].copy(); M['soil'].name='woodland-fine-earth'
    earth=next(n for n in M['soil'].node_tree.nodes if n.type=='VALTORGB')
    earth.color_ramp.elements[0].color=(.12,.065,.026,1)
    earth.color_ramp.elements[1].color=(.30,.19,.075,1)
    material('rubber',(.018,.055,.10),.76,.04)
    material('medical-teal',(.025,.42,.48),.40,.10)
    material('medical-screen',(.01,.12,.22),.22,.25)
    material('pipe',(.50,.60,.64),.5,.2)
    material('metal',(.035,.12,.23),.48,.55)
    material('training-red',(.57,.035,.025),.43,.04)
    material('gym-floor',(.34,.16,.065),.52,0)
    # Original procedural timber, not a sampled research texture. Rubber is
    # reserved for exercise mats, preserving the gym's warm-floor identity.
    mat=M['gym-floor']; nodes,links=mat.node_tree.nodes,mat.node_tree.links
    coords=nodes.new('ShaderNodeTexCoord'); mapping=nodes.new('ShaderNodeVectorMath')
    mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(.5,9,1)
    links.new(coords.outputs['Object'],mapping.inputs[0])
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3
    links.new(mapping.outputs[0],noise.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(.18,.07,.021,1)
    ramp.color_ramp.elements[1].color=(.45,.24,.10,1)
    links.new(noise.outputs['Fac'],ramp.inputs[0])
    links.new(ramp.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
    if FIELD_ID=='field_cm29_01' and MATERIAL_INPUT:
        mat=M['metal']; nodes,links=mat.node_tree.nodes,mat.node_tree.links
        coords=nodes.new('ShaderNodeTexCoord')
        texture=nodes.new('ShaderNodeTexImage'); texture.name='Reviewed-ComfyUI-lid-micrograin'
        texture.image=bpy.data.images.load(str(MATERIAL_INPUT));texture.image.pack()
        texture.extension='EXTEND';links.new(coords.outputs['Generated'],texture.inputs['Vector'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.14
        bump.inputs['Distance'].default_value=.006
        links.new(texture.outputs['Color'],bump.inputs['Height'])
        links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])


def world(x, y, z=0):
    return Vector(((x+y/S)/(UNIT*math.sqrt(2)), (x-y/S)/(UNIT*math.sqrt(2)), z))


def material(name, color, roughness=.4, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    M[name] = mat
    return mat


def materials():
    material('porcelain', (.79,.89,.92), .27, .18)
    material('steel', (.16,.26,.32), .3, .65)
    material('navy', (.022,.09,.17), .31, .5)
    material('blue', (.024,.31,.61), .28, .3)
    material('cyan', (.015,.7,.9), .24, .3, 2)
    material('line', (.85,.88,.78), .7)
    material('soil', (.08,.055,.024), 1)
    material('bark', (.22,.105,.036), .9)
    material('wood', (.48,.24,.08), .55)
    material('leaf-dark', (.025,.19,.045), .58)
    material('leaf', (.13,.43,.045), .5)
    material('leaf-light', (.39,.64,.075), .5)
    material('flower', (.99,.61,.13), .62)
    glass = material('glass', (.22,.69,.84), .16, .15)
    bsdf = glass.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Transmission Weight'].default_value = .5
    bsdf.inputs['IOR'].default_value = 1.45
    for name, colors in [('clay', ((.30,.115,.049,1),(.47,.23,.105,1))),
                         ('grass', ((.055,.18,.04,1),(.18,.34,.055,1)))]:
        mat=material(name, colors[0][:3], .85)
        nodes, links=mat.node_tree.nodes, mat.node_tree.links
        noise=nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value=85
        noise.inputs['Detail'].default_value=3
        ramp=nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=colors[0]
        ramp.color_ramp.elements[1].color=colors[1]
        links.new(noise.outputs['Fac'],ramp.inputs[0])
        links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=.12
        bump.inputs['Distance'].default_value=.04
        links.new(noise.outputs['Fac'],bump.inputs['Height'])
        links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])
    mat=material('checker', (.15,.5,.85), .25, .12)
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    tex=nodes.new('ShaderNodeTexCoord')
    checker=nodes.new('ShaderNodeTexChecker')
    checker.inputs['Color1'].default_value=(.018,.25,.64,1)
    checker.inputs['Color2'].default_value=(.42,.77,.98,1)
    checker.inputs['Scale'].default_value=.8
    links.new(tex.outputs['Object'],checker.inputs['Vector'])
    links.new(checker.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])


def daylight_materials():
    """Versioned material look; no geometry, gameplay or placement authority."""
    for name,color,roughness,metal in [
            ('porcelain',(.88,.94,1),.22,.12),('navy',(.008,.038,.12),.28,.48),
            ('blue',(.008,.17,.57),.25,.40),('steel',(.07,.13,.20),.30,.72),
            ('line',(.96,.98,1),.66,0)]:
        shader=M[name].node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=(*color,1)
        shader.inputs['Roughness'].default_value=roughness
        shader.inputs['Metallic'].default_value=metal
    material('rim-panel',(.035,.15,.32),.28,.45)
    material('silver',(.44,.61,.74),.20,.80)
    material('net-cord',(.025,.065,.105),.64,.05)
    # Fine surface texture modulates a controlled palette, not the field footprint.
    mat=M['clay']; nodes,links=mat.node_tree.nodes,mat.node_tree.links
    shader=nodes.get('Principled BSDF'); noise=next(n for n in nodes if n.type=='TEX_NOISE')
    noise.inputs['Scale'].default_value=190
    ramp=next(n for n in nodes if n.type=='VALTORGB')
    ramp.color_ramp.elements[0].color=(.235,.059,.026,1)
    ramp.color_ramp.elements[1].color=(.46,.17,.064,1)
    if MATERIAL_INPUT:
        # Mirrored coordinates repeat continuously; no unverified seamless claim.
        geometry=nodes.new('ShaderNodeNewGeometry')
        separate=nodes.new('ShaderNodeSeparateXYZ'); links.new(geometry.outputs['Position'],separate.inputs[0])
        combine=nodes.new('ShaderNodeCombineXYZ')
        for axis in ('X','Y'):
            scale=nodes.new('ShaderNodeMath'); scale.operation='MULTIPLY'; scale.inputs[1].default_value=.7
            mirror=nodes.new('ShaderNodeMath'); mirror.operation='PINGPONG'; mirror.inputs[1].default_value=1
            links.new(separate.outputs[axis],scale.inputs[0]); links.new(scale.outputs[0],mirror.inputs[0])
            links.new(mirror.outputs[0],combine.inputs[axis])
        texture=nodes.new('ShaderNodeTexImage'); texture.name='ComfyUI-original-track-albedo'
        texture.image=bpy.data.images.load(str(MATERIAL_INPUT)); texture.image.pack()
        texture.extension='EXTEND'; links.new(combine.outputs[0],texture.inputs['Vector'])
        grey=nodes.new('ShaderNodeRGBToBW'); links.new(texture.outputs['Color'],grey.inputs[0])
        blend=nodes.new('ShaderNodeMixRGB'); blend.blend_type='MIX'; blend.inputs[0].default_value=.34
        links.new(noise.outputs['Fac'],blend.inputs[1]); links.new(grey.outputs[0],blend.inputs[2])
        links.new(blend.outputs[0],ramp.inputs[0])
    bump=next(n for n in nodes if n.type=='BUMP')
    bump.inputs['Strength'].default_value=.20; bump.inputs['Distance'].default_value=.018
    # Soft mowing bands and fine turf grain; no grass meshes over walkable cells.
    mat=M['grass']; nodes,links=mat.node_tree.nodes,mat.node_tree.links
    ramp=next(n for n in nodes if n.type=='VALTORGB')
    ramp.color_ramp.elements[0].color=(.028,.16,.011,1)
    ramp.color_ramp.elements[1].color=(.19,.39,.036,1)
    geometry=nodes.new('ShaderNodeNewGeometry'); wave=nodes.new('ShaderNodeTexWave')
    wave.wave_type='BANDS'; wave.bands_direction='X'; wave.inputs['Scale'].default_value=1.3
    links.new(geometry.outputs['Position'],wave.inputs['Vector'])
    band=nodes.new('ShaderNodeValToRGB')
    band.color_ramp.elements[0].color=(.72,.83,.69,1); band.color_ramp.elements[1].color=(1,1,1,1)
    links.new(wave.outputs['Fac'],band.inputs[0])
    mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
    links.new(ramp.outputs['Color'],mix.inputs[1]); links.new(band.outputs['Color'],mix.inputs[2])
    links.new(mix.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
    # A glazed blue-white tiled practice apron belongs to this sports field only.
    mat=M['checker']; nodes,links=mat.node_tree.nodes,mat.node_tree.links
    checker=next(n for n in nodes if n.type=='TEX_CHECKER')
    checker.inputs['Color1'].default_value=(.014,.20,.62,1)
    checker.inputs['Color2'].default_value=(.56,.83,.98,1)
    checker.inputs['Scale'].default_value=1.55
    shader=nodes.get('Principled BSDF'); shader.inputs['Roughness'].default_value=.19
    shader.inputs['Coat Weight'].default_value=.38


def finish(obj, name, mat, bevel=0):
    obj.name=name
    obj['cageLayer']=LAYER
    obj['cageFieldId']=FIELD_ID
    obj.data.materials.append(M[mat])
    if bevel:
        mod=obj.modifiers.new('manufactured-soft-edges','BEVEL')
        mod.width=bevel
        mod.segments=3
        obj.modifiers.new('weighted-corner-normals','WEIGHTED_NORMAL')
    return obj


def box(name, center, size, mat, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj=bpy.context.object
    obj.scale=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj,name,mat,bevel)


def beam(name, a, b, width, depth, mat, bevel=.015):
    a,b=Vector(a),Vector(b)
    obj=box(name,(a+b)/2,(width,depth,(b-a).length),mat,bevel)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj


def sphere(name, pos, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=pos)
    obj=bpy.context.object
    obj.scale=scale
    for poly in obj.data.polygons:
        poly.use_smooth=True
    return finish(obj,name,mat)


def curve(name, points, radius, mat, cyclic=False):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.resolution_u=2
    data.bevel_depth=radius
    data.bevel_resolution=2
    spline=data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):
        p.co=(*co,1)
    spline.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(M[mat])
    obj['cageLayer']=LAYER
    obj['cageFieldId']=FIELD_ID
    return obj


def slab(name, points, z0, z1, mat, bevel=.02):
    count=len(points)
    verts=[world(x,y,z) for z in (z0,z1) for x,y in points]
    # screen-down to world-XY has a negative determinant.
    faces=[tuple(range(count)),tuple(reversed(range(count,count*2)))]
    faces += [(i,count+i,count+(i+1)%count,(i+1)%count) for i in range(count)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat,bevel)


def foliage(name, center, radius, count):
    """Folded leaf meshes, not sphere stand-ins. Seeded and batched per plant."""
    verts,faces,slots=[],[],[]
    for i in range(count):
        a=RNG.uniform(0,math.tau)
        h=RNG.uniform(-1,1)
        direction=Vector((math.sqrt(1-h*h)*math.cos(a),math.sqrt(1-h*h)*math.sin(a),h))
        p=Vector(center)+direction*radius*(RNG.random()**.23)
        axis=Vector((math.cos(a),math.sin(a),RNG.uniform(-.15,.9))).normalized()
        across=Vector((-math.sin(a),math.cos(a),0))
        size=RNG.uniform(.10,.23)
        points=[p-axis*size,p-across*size*.42+Vector((0,0,.028)),p+axis*size,
                p+across*size*.42+Vector((0,0,.028)),p+Vector((0,0,.065))]
        start=len(verts)
        verts.extend(points)
        faces.extend([(start+j,start+(j+1)%4,start+4) for j in range(4)])
        slots.extend([RNG.choices([0,1,2],[2,5,3])[0]]*4)
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj['cageLayer']=LAYER
    obj['cageFieldId']=FIELD_ID
    for mat in ['leaf-dark','leaf','leaf-light']:
        mesh.materials.append(M[mat])
    for face,slot in zip(mesh.polygons,slots):
        face.material_index=slot
    return obj


def planter(x,y,large=False):
    p=world(x,y)
    side=.85 if large else .65
    box('planter-porcelain',p+Vector((0,0,.31)),(side,side,.62),'porcelain',.055)
    box('planter-soil',p+Vector((0,0,.63)),(side*.81,side*.81,.035),'soil',.01)
    foliage('planter-foliage',p+Vector((0,0,.85)),side*.58,150)
    if large:
        top=p+Vector((0,0,2.8))
        beam('tree-trunk',p+Vector((0,0,.62)),top,.12,.12,'bark')
        for i in range(9):
            a=RNG.random()*math.tau
            r=RNG.random()*.85
            h=RNG.uniform(1.7,3.15)
            center=p+Vector((math.cos(a)*r,math.sin(a)*r,h))
            beam('tree-branch',p+Vector((0,0,1.55)),center,.065,.065,'bark',.005)
            foliage('tree-canopy',center,.53,190)


def rail(a,b,posts=True):
    a,b=Vector(a),Vector(b)
    length=(b-a).length
    segments=max(1,round(length/2.4))
    for i in range(segments):
        p=a.lerp(b,i/segments)
        q=a.lerp(b,(i+1)/segments)
        beam('glass-panel',p+Vector((0,0,.83)),q+Vector((0,0,.83)),.065,1.22,'glass',.018)
        beam('rail-top',p+Vector((0,0,1.48)),q+Vector((0,0,1.48)),.13,.12,'porcelain')
        beam('rail-base',p+Vector((0,0,.17)),q+Vector((0,0,.17)),.19,.25,'porcelain')
    if posts:
        for i in range(segments+1):
            p=a.lerp(b,i/segments)
            box('rail-pillar',p+Vector((0,0,.8)),(.3,.3,1.6),'porcelain')
            box('rail-cap',p+Vector((0,0,1.64)),(.39,.39,.12),'navy')
            sphere('rail-beacon',p+Vector((0,0,1.75)),(.085,.085,.07),'cyan')


def platform(field):
    # Field-local canvas, never a ranch placement offset or a pre-applied crop.
    points=[(x,y) for x,y in field['outlineNative']]
    if LOOK=='seam-v3':
        points=field_footprint(ROOT,field)['outline']
    if LOOK=='seam-v3':
        # Shallow shared tray edge: tall fascia at every edge projects over a
        # neighboring surface after the native stagger/crop. Never move fields.
        slab(field['id']+'-foundation',points,-.24,-.035,'navy',0)
        surface='gym-floor' if field['id'] in ('field_cm05_01','field_cm34_01','field_cm04_01') else 'grass' if field['id']=='field_cm03_01' else field['surface']
        surface=NATURE_SURFACES.get(field['id'],surface)
        surface=ANIMATED_SURFACES.get(field['id'],surface)
        floor=slab(field['id']+'-surface',points,-.035,0,surface,0)
        # Record actual Blender mesh vertices, not just the intended polygon.
        measured=[]
        for vertex in floor.data.vertices:
            p=floor.matrix_world@vertex.co
            if abs(p.z)<1e-6:
                measured.append([round((p.x+p.y)*UNIT/math.sqrt(2),4),
                                 round((p.x-p.y)*UNIT*S/math.sqrt(2),4)])
        bpy.context.scene['hexFloorMeshNative']=json.dumps(measured)
        for a,b in zip(points,points[1:]+points[:1]):
            p,q=world(*a,-.035),world(*b,-.035)
            beam('flush-porcelain-joint',p,q,.045,.055,'porcelain',.006)
            if b[0]<a[0]:
                beam('shallow-blue-fascia',p-Vector((0,0,.12)),q-Vector((0,0,.12)),.04,.16,'blue',.006)
                beam('continuous-rim-light',p-Vector((0,0,.20)),q-Vector((0,0,.20)),.025,.026,'cyan',.003)
        return points
    slab(field['id']+'-foundation',points,-1.1,-.06,'navy',.04)
    slab(field['id']+'-surface',points,-.06,0,field['surface'],.012)
    for i,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
        p,q=world(*a,-.1),world(*b,-.1)
        beam('porcelain-edge',p,q,.10,.12,'porcelain',.02)
        if (q-p).length>.7:
            beam('edge-light',p.lerp(q,.12)-Vector((0,0,.24)),p.lerp(q,.88)-Vector((0,0,.24)),.085,.09,'cyan')
            if a[1]>=60 and b[1]>=60:
                mid=p.lerp(q,.5)
                box('edge-service-panel',mid-Vector((0,0,.42)),(.32,.3,.73),'porcelain')
            if LOOK=='daylight-v2':
                span=(q-p).length
                for section in range(max(1,int(span/1.3))):
                    n=max(1,int(span/1.3)); start=(section+.10)/n; end=(section+.90)/n
                    beam('rim-inset-panel',p.lerp(q,start)-Vector((0,0,.67)),
                         p.lerp(q,end)-Vector((0,0,.67)),.075,.36,'rim-panel',.018)
                    beam('rim-silver-toe',p.lerp(q,start)-Vector((0,0,.94)),
                         p.lerp(q,end)-Vector((0,0,.94)),.07,.035,'silver',.008)
    return points


def bench(x,y):
    p=world(x,y)
    for dx in (-.65,.65):
        for dy in (-.2,.2):
            box('bench-foot',p+Vector((dx,dy,.25)),(.08,.08,.5),'steel',.01)
    for dy in (-.23,0,.23):
        box('bench-seat',p+Vector((0,dy,.54)),(1.7,.18,.1),'wood')
    for dx in (-.65,.65):
        box('bench-upright',p+Vector((dx,.25,.8)),(.065,.065,.7),'steel',.01)
    for z in (.83,1.04):
        box('bench-back',p+Vector((0,.27,z)),(1.7,.09,.16),'wood')


def hurdle(x,y):
    p=world(x,y)
    for dx in (-.65,.65):
        box('hurdle-foot',p+Vector((dx,0,.045)),(.12,.8,.09),'steel',.025)
        box('hurdle-post',p+Vector((dx,0,.5)),(.08,.09,.96),'blue',.018)
    box('hurdle-bar',p+Vector((0,0,.94)),(1.5,.1,.15),'porcelain',.025)
    for dx in (-.5,0,.5):
        box('hurdle-stripe',p+Vector((dx,-.058,.94)),(.16,.012,.1),'blue',.004)
    if daylight():
        for dx in (-.65,.65):
            box('hurdle-ceramic-sleeve',p+Vector((dx,0,.42)),(.135,.14,.65),'porcelain',.024)
            box('hurdle-blue-inset',p+Vector((dx,-.077,.43)),(.062,.012,.44),'blue',.006)
            box('hurdle-lock-collar',p+Vector((dx,0,.78)),(.16,.16,.09),'silver',.013)
            for dy in (-.28,.28):
                box('hurdle-foot-pad',p+Vector((dx,dy,.055)),(.19,.19,.11),'navy',.035)
            box('hurdle-base-beacon',p+Vector((dx,-.105,.15)),(.065,.035,.035),'cyan',.008)


def training_net(x,y,angle=0):
    """New mesh at the original placement; never sourced from the ROM raster."""
    p=world(x,y)
    axis=Vector((math.cos(angle),math.sin(angle),0))
    a,b=p-axis*.65,p+axis*.65
    for foot in (a,b):
        beam('training-net-post',foot,foot+Vector((0,0,1.7)),.095,.095,'porcelain')
        box('training-net-foot',foot+Vector((0,0,.05)),(.2,.2,.1),'navy')
    beam('training-net-top',a+Vector((0,0,1.65)),b+Vector((0,0,1.65)),.07,.07,'blue')
    for i in range(1,9):
        t=i/9
        q=a.lerp(b,t)
        cord='net-cord' if daylight() else 'steel'
        radius=.010 if daylight() else .008
        curve('training-net-weave-vertical',[q+Vector((0,0,.15)),q+Vector((0,0,1.65))],radius,cord)
        curve('training-net-weave-horizontal',[a+Vector((0,0,.15+1.5*t)),b+Vector((0,0,.15+1.5*t))],radius,cord)
    if daylight():
        beam('net-lower-tension-rail',a+Vector((0,0,.16)),b+Vector((0,0,.16)),.052,.065,'blue')
        for foot in (a,b):
            beam('net-blue-upright',foot+Vector((0,0,.18)),foot+Vector((0,0,1.51)),.12,.12,'blue',.018)
            box('net-porcelain-cap',foot+Vector((0,0,1.64)),(.15,.15,.10),'porcelain',.025)
            box('net-ankle-collar',foot+Vector((0,0,.21)),(.17,.17,.12),'silver',.018)


def sports(field):
    global LAYER
    # Independent field-local running area; retain its clay + green infield theme.
    LAYER='base'
    if LOOK=='daylight-v2':
        # The lower practice surface remains flat and changes no collision/ownership.
        apron=[(48,119),(144,119),(144,176),(136,184),(88,200),(88,192),(48,176)]
        slab('sports-blue-white-practice-apron',apron,.001,.006,'checker',0)
        curve('practice-apron-transition',[world(48,119,.018),world(144,119,.018)],.032,'porcelain')
    infield=[(96+60*math.cos(i*math.tau/96),72+20*math.sin(i*math.tau/96)) for i in range(96)]
    slab('sports-grass-infield',infield,.001,.003,'grass',0)
    for lane in range(5):
        rx=88-lane*5
        ry=39-lane*4
        points=[world(96+rx*math.cos(t),72+ry*math.sin(t),.009) for t in [i*math.tau/128 for i in range(128)]]
        curve('track-lane-%d'%lane,points,.017 if daylight() else .009,'line',True)
    if daylight():
        # Painted track ticks, not new objects or interaction targets.
        for lane in range(4):
            rx=88-lane*5; ry=39-lane*4; t=1.04
            a=world(96+rx*math.cos(t),72+ry*math.sin(t),.02)
            b=world(96+(rx-5)*math.cos(t),72+(ry-4)*math.sin(t),.02)
            curve('track-start-tick', [a,b],.018,'line')
    LAYER='decor'
    anchors=[]
    for placement in field['objects']:
        sequence=placement['sequenceId']
        x,y=placement['placement']
        before=set(bpy.context.scene.objects)
        if sequence in (0,1):
            hurdle(x,y)
            role='hurdle'
        elif sequence in (2,3,4):
            training_net(x,y,{2:math.pi/2,3:math.pi/4,4:0}[sequence])
            role='training-net'
        else:
            raise ValueError('Unreviewed sport object sequence: '+str(sequence))
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=placement['order']
            obj['sourceAnchorNative']=[x,y]
        anchors.append({'sourceOrdinal':placement['order'],'sequenceId':sequence,
                        'anchorNative':[x,y],'role':role,
                        'geometryStatus':'ORIGINAL_MESH_DRAFT_NOT_PIXEL_REPRODUCTION'})
    return anchors


def hollow_pipe(center,length=2.6,radius=.34):
    """New annular mesh; source pipe image is never imported or traced."""
    verts=[]; faces=[]; n=32; center=Vector(center)
    for y,r in [(-length/2,radius),(length/2,radius),(-length/2,radius*.72),(length/2,radius*.72)]:
        verts.extend(center+Vector((r*math.cos(i*math.tau/n),y,r*math.sin(i*math.tau/n))) for i in range(n))
    for a,b in [(0,1),(2,0),(1,3),(3,2)]:
        for i in range(n):
            j=(i+1)%n; faces.append((a*n+i,a*n+j,b*n+j,b*n+i))
    mesh=bpy.data.meshes.new('hollow-training-tube'); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new('hollow-training-tube',mesh); bpy.context.collection.objects.link(obj)
    return finish(obj,'hollow-training-tube','pipe',.018)


def nursery_tree(x,y,small=False):
    p=world(x-2 if small else x,y); height=2.4 if small else 3.2; radius=.34 if small else .56
    beam('tree-trunk',p,p+Vector((0,0,height*.8)),.15,.15,'bark',.02)
    for i in range(7):
        a=i*math.tau/7; z=height-(i%3)*.32
        tip=p+Vector((math.cos(a)*radius*.50,math.sin(a)*radius*.50,z))
        beam('tree-branch',p+Vector((0,0,height*.52)),tip,.05,.05,'bark',.006)
        foliage('leaf-cluster',tip,radius*.63,95)
    for i in range(4):
        a=i*math.pi/2
        beam('root',p+Vector((math.cos(a)*.35,math.sin(a)*.35,.02)),p+Vector((0,0,.35)),.12,.11,'bark')


def medical_bed(x,y):
    # Asymmetric original cell has 22px left / 26px right of its unchanged pivot.
    p=world(x+1,y)
    box('bed-pedestal',p+Vector((0,0,.35)),(1.55,2,.6),'navy',.14)
    box('bed-shell',p+Vector((0,0,.68)),(1.75,2.15,.4),'porcelain',.14)
    box('teal-mattress',p+Vector((0,0,.93)),(1.42,1.94,.18),'medical-teal',.16)
    box('pillow',p+Vector((0,.63,1.08)),(1.08,.47,.18),'porcelain',.10)
    box('headboard',p+Vector((0,.99,1.12)),(1.75,.12,.82),'porcelain',.07)
    box('bed-front-inset',p+Vector((0,-1.088,.63)),(.8,.025,.14),'blue',.02)
    box('bed-indicator',p+Vector((0,-1.108,.63)),(.35,.02,.026),'cyan',.008)


def new_family(field):
    """Starting-cage family roles reviewed against research; new independent meshes."""
    global LAYER
    anchors=[]; LAYER='base'
    if FIELD_ID=='field_cm16_01':
        # Low fixed service fixtures stay in the core, not invented OPM entries.
        # Cabinet and rear bay are presentation only, as in the reference core.
        p=world(14,49)
        box('fixed-supply-cabinet',p+Vector((0,0,.72)),(.55,1.28,1.44),'porcelain',.045)
        for z in (.45,.82,1.16):
            box('supply-drawer',p+Vector((.29,0,z)),(.02,1.08,.20),'blue',.008)
        medical_bed(67,35)
        p=world(87,41)
        box('rear-bay-privacy-panel',p+Vector((0,0,.7)),(.08,1.15,1.4),'glass',.02)
        box('rear-bay-blue-post',p+Vector((0,-.55,.7)),(.12,.12,1.4),'blue',.02)
    LAYER='decor'
    for record in field['objects']:
        x,y=record['placement']; seq=record['sequenceId']; before=set(bpy.context.scene.objects)
        if FIELD_ID=='field_cm01_01':
            if seq==1:
                p=world(x-8,y-5)
                for offset in [(-.36,0,.37),(.36,0,.37),(0,0,.97)]:hollow_pipe(p+Vector(offset))
                role='three-hollow-training-pipes'
            elif seq in (0,2):
                nursery_tree(x,y,small=seq==2); role='tree'
            elif seq==3:
                for i in range(6):
                    p=world(x+i*2.9,y+i*1.1)
                    box('rear-fence-slat',p+Vector((0,0,.8)),(.15,.20,1.6),'wood',.025)
                role='rear-fence'
            else:raise ValueError('Unreviewed woodland object')
        elif FIELD_ID=='field_cm16_01':
            if seq==1:
                medical_bed(x,y); role='medical-bed'
            elif seq==7:
                p=world(x+3,y)
                box('rolling-chair-base',p+Vector((0,0,.1)),(.45,.4,.12),'steel',.035)
                beam('chair-post',p,p+Vector((0,0,.40)),.07,.07,'steel')
                box('chair-seat',p+Vector((0,0,.45)),(.53,.45,.14),'medical-teal',.065)
                box('chair-back',p+Vector((0,.19,.64)),(.52,.1,.32),'medical-teal',.055)
                role='medical-chair'
            else:raise ValueError('Unreviewed clinic object')
        else:raise ValueError('Unreviewed family')
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order']; obj['sourceAnchorNative']=[x,y]
        anchors.append({'sourceOrdinal':record['order'],'sequenceId':seq,'anchorNative':[x,y],
                        'role':role,'geometryStatus':'ORIGINAL_MESH_DRAFT_NOT_PIXEL_REPRODUCTION'})
    return anchors


def cylinder(name, center, radius, depth, mat, direction=(0,0,1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=center)
    obj=bpy.context.object
    obj.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
    return finish(obj,name,mat,.025)


def exercise_bike(x,y,compact=False):
    """Independent flywheel cycle. The narrow source cell has its own wall model."""
    p=world(x+7 if compact else x,y-6)
    scale=.68 if compact else 1
    def v(a,b,c):return p+Vector((a*scale,b*scale,c))
    for dx in (-.52,.52):
        beam('cycle-stabilizer',v(dx,-.33,.08),v(dx,.33,.08),.11*scale,.11*scale,'navy')
    beam('cycle-chassis',v(-.52,0,.17),v(.52,0,.17),.15*scale,.18*scale,'porcelain')
    cylinder('cycle-flywheel',v(.15,0,.43),.29*scale,.19*scale,'blue',(0,1,0))
    cylinder('cycle-flywheel-hub',v(.15,-.11,.43),.12*scale,.035*scale,'silver',(0,1,0))
    beam('cycle-seat-tube',v(-.38,0,.17),v(-.36,0,.96),.10*scale,.11*scale,'steel')
    box('cycle-saddle',v(-.36,0,1),( .43*scale,.36*scale,.13*scale),'navy',.04)
    beam('cycle-front-tube',v(.35,0,.25),v(.52,0,1.12),.10*scale,.12*scale,'porcelain')
    beam('cycle-handle',v(.52,-.33,1.12),v(.52,.33,1.12),.09*scale,.09*scale,'navy')
    box('cycle-console',v(.52,0,1.17),(.21*scale,.26*scale,.06*scale),'medical-screen',.015)
    for sign in (-1,1):
        beam('cycle-crank',v(.15,sign*.17,.43),v(.15+sign*.15,sign*.17,.27),.04*scale,.04*scale,'silver')
        box('cycle-pedal',v(.15+sign*.15,sign*.25,.27),(.18*scale,.18*scale,.07*scale),'rubber',.012)


def punching_station(x,y):
    p=world(x-2,y-7)
    box('punch-station-base',p+Vector((0,0,.07)),(1.12,.9,.14),'rubber',.08)
    beam('punch-stand',p+Vector((.44,.27,.12)),p+Vector((.44,.27,2.6)),.12,.12,'steel')
    beam('punch-hanger',p+Vector((.44,.27,2.6)),p+Vector((-.12,0,2.6)),.13,.13,'steel')
    beam('punch-chain',p+Vector((-.12,0,2.6)),p+Vector((-.12,0,2.38)),.04,.04,'silver')
    cylinder('training-punchbag',p+Vector((-.12,0,1.43)),.32,1.86,'training-red')
    for z in (.54,2.32):cylinder('punchbag-collar',p+Vector((-.12,0,z)),.33,.11,'navy')
    box('punchbag-front-mark',p+Vector((-.12,-.324,1.74)),(.12,.018,.40),'porcelain',.025)


def weight_bench(x,y):
    p=world(x,y-12)
    for dx in (-.88,.88):
        beam('weight-rack-foot',p+Vector((dx,-.8,.08)),p+Vector((dx,.8,.08)),.14,.14,'steel')
        beam('weight-rack-post',p+Vector((dx,.50,.08)),p+Vector((dx,.50,1.80)),.13,.13,'porcelain')
        box('barbell-cradle',p+Vector((dx,.45,1.71)),(.24,.26,.12),'blue',.025)
    beam('bench-support',p+Vector((0,-.7,.12)),p+Vector((0,.7,.12)),.20,.20,'steel')
    for dy in (-.6,.6):beam('bench-leg',p+Vector((0,dy,.12)),p+Vector((0,dy,.61)),.17,.17,'steel')
    box('weight-bench-cushion',p+Vector((0,0,.67)),(.62,1.9,.20),'medical-teal',.09)
    beam('barbell',p+Vector((-1.18,.5,1.81)),p+Vector((1.18,.5,1.81)),.07,.07,'silver')
    for sign in (-1,1):
        for offset,radius in [(.97,.35),(1.10,.28)]:
            cylinder('barbell-plate',p+Vector((sign*offset,.5,1.81)),radius,.09,'training-red',(1,0,0))


def lockers(x,y,count):
    # Low rear fixtures stay in the core. No new collision or OPM objects.
    for i in range(count):
        p=world(x+i*10,y+i*5)
        box('rear-locker',p+Vector((0,0,.66)),(.56,.58,1.32),'porcelain',.035)
        box('locker-door',p+Vector((0,-.30,.68)),(.46,.025,1.13),'blue',.015)
        box('locker-handle',p+Vector((.14,-.324,.65)),(.045,.035,.16),'silver',.008)
        for z in (.94,1.01,1.08):
            box('locker-vent',p+Vector((0,-.324,z)),(.25,.016,.018),'navy',.003)


def stage2_family(field):
    """Reviewed static sports/medical family, same immutable per-cell contract."""
    global LAYER
    LAYER='base';anchors=[]
    if FIELD_ID=='field_cm30_01':
        # Compact clay training lanes, not a tiny copy of the full oval stadium.
        for lane in range(4):
            yy=44+lane*6
            curve('small-track-straight',[world(3,yy,.012),world(93,yy,.012)],.018,'line')
            curve('small-track-turn',[world(5,76+lane*4,.012),world(31,90+lane*4,.012),
                  world(57,90+lane*3,.012),world(91,77+lane*3,.012)],.018,'line')
    elif FIELD_ID=='field_cm31_01':
        for offset in (0,96):
            medical_bed(67+offset,35)
            p=world(87+offset,41)
            box('clinic-privacy-screen',p+Vector((0,0,.7)),(.08,1.15,1.4),'glass',.02)
            box('clinic-screen-post',p+Vector((0,-.55,.7)),(.12,.12,1.4),'blue',.02)
        p=world(14,49)
        box('clinic-supply-cabinet',p+Vector((0,0,.72)),(.55,1.28,1.44),'porcelain',.045)
        for z in (.45,.82,1.16):box('clinic-supply-drawer',p+Vector((.29,0,z)),(.02,1.08,.20),'blue',.008)
        p=world(126,59)
        box('clinic-treatment-table',p+Vector((0,0,.40)),(1.45,.74,.13),'medical-teal',.08)
        box('clinic-treatment-pedestal',p+Vector((0,0,.20)),(.8,.48,.4),'porcelain',.06)
    elif FIELD_ID in ('field_cm34_01','field_cm05_01'):
        lockers(48,23,4) if FIELD_ID=='field_cm34_01' else lockers(170,33,6)
        if FIELD_ID=='field_cm05_01':
            for x in (71,95,119):
                p=world(x,48)
                box('rear-step-machine-base',p+Vector((0,0,.24)),(.9,.9,.48),'navy',.08)
                beam('step-machine-column',p+Vector((0,.18,.45)),p+Vector((0,.18,1.55)),.15,.15,'porcelain')
                box('step-machine-console',p+Vector((0,.18,1.58)),(.62,.43,.12),'medical-screen',.035)
                for dx in (-.23,.23):box('step-machine-pedal',p+Vector((dx,-.22,.58)),(.26,.64,.11),'rubber',.025)
            slab('stretching-mat',[(7,143),(51,123),(99,148),(56,172)],.01,.08,'blue',.02)
            p=world(57,137)
            for dx in (-.18,.18):cylinder('mat-dumbbell-weight',p+Vector((dx,0,.15)),.13,.10,'training-red',(1,0,0))
            beam('mat-dumbbell-handle',p+Vector((-.18,0,.15)),p+Vector((.18,0,.15)),.05,.05,'silver')
    LAYER='decor'
    for record in field['objects']:
        x,y=record['placement'];seq=record['sequenceId'];before=set(bpy.context.scene.objects)
        if FIELD_ID=='field_cm30_01' and seq==1:
            hurdle(x-2,y);role='hurdle'
        elif FIELD_ID=='field_cm31_01' and seq==1:
            medical_bed(x,y);role='medical-bed'
        elif FIELD_ID=='field_cm31_01' and seq==7:
            p=world(x+3,y)
            box('clinic-chair-base',p+Vector((0,0,.1)),(.45,.4,.12),'steel',.035)
            beam('clinic-chair-post',p,p+Vector((0,0,.40)),.07,.07,'steel')
            box('clinic-chair-seat',p+Vector((0,0,.45)),(.53,.45,.14),'medical-teal',.065)
            box('clinic-chair-back',p+Vector((0,.19,.64)),(.52,.1,.32),'medical-teal',.055)
            role='medical-chair'
        elif FIELD_ID in ('field_cm34_01','field_cm05_01') and seq in (1,3):
            exercise_bike(x,y,compact=seq==3);role='compact-wall-cycle' if seq==3 else 'exercise-bike'
        elif FIELD_ID in ('field_cm34_01','field_cm05_01') and seq==0:
            punching_station(x,y);role='punching-station'
        elif FIELD_ID=='field_cm05_01' and seq==2:
            weight_bench(x,y);role='weight-bench'
        else:raise ValueError(f'Unreviewed stage 2 object: {FIELD_ID}/{seq}')
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=[x,y]
        anchors.append({'sourceOrdinal':record['order'],'sequenceId':seq,'anchorNative':[x,y],
                        'role':role,'geometryStatus':'ORIGINAL_MESH_DRAFT_NOT_PIXEL_REPRODUCTION'})
    return anchors


def structural_lid():
    """Flat closed service cover, not a walkable field or a new OPM prop."""
    panel=[(8,29),(45,13),(86,28),(86,82),(51,99),(9,82)]
    slab('closed-lid-inset',panel,.002,.014,'metal',0)
    curve('recessed-panel-border',[world(x,y,.02) for x,y in panel],.016,'silver',True)
    # Flat inspection slots / screws remain inside this one lid's canvas.
    for x,y in [(13,31),(80,32),(14,79),(79,79)]:
        sphere('flush-lid-fastener',world(x,y,.035),(.065,.065,.018),'silver')
    for x in (36,42,48,54,60):
        curve('lid-vent',[world(x,52,.023),world(x,67,.023)],.025,'steel')
    curve('lid-status-light',[world(64,73,.024),world(74,73,.024)],.026,'cyan')


def set_camera(scene, bounds, scale=5):
    x,y,width,height=bounds
    target=world(x+width/2,y+height/2)
    direction=Vector((C/math.sqrt(2),-C/math.sqrt(2),S))
    bpy.ops.object.camera_add(location=target+direction*60)
    camera=bpy.context.object
    camera.name='locked-orthographic-camera'
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.sensor_fit='HORIZONTAL'
    camera.data.ortho_scale=width/UNIT
    scene.camera=camera
    scene.render.resolution_x=round(width*scale)
    scene.render.resolution_y=round(height*scale)
    scene.render.resolution_percentage=100


def evaluated_world_vertices(obj):
    # World-aligned AABBs falsely reject tall rotated banners and diagonal rope
    # sections. Test the actual evaluated mesh, including bevel/curve thickness.
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh=evaluated.to_mesh()
    try:return [evaluated.matrix_world@v.co for v in mesh.vertices]
    finally:evaluated.to_mesh_clear()


def preflight_object_bounds(field,scene):
    """Fail before costly renders, using the same effective windows as export."""
    from bpy_extras.object_utils import world_to_camera_view
    main_camera=scene.camera
    resolution=(scene.render.resolution_x,scene.render.resolution_y)
    try:
        for record in field['objects']:
            selected=[o for o in scene.objects if o.get('cageLayer')=='decor' and o.get('sourceObjectOrdinal')==record['order']]
            if not selected:raise ValueError(f'Missing independently modelled object: {record["order"]}')
            set_camera(scene,placed_cell_bounds(record),4)
            bpy.context.view_layer.update()
            for obj in selected:
                for point in evaluated_world_vertices(obj):
                    v=world_to_camera_view(scene,scene.camera,point)
                    if not (-.001<=v.x<=1.001 and -.001<=v.y<=1.001):
                        raise ValueError(f'Preflight object exceeds source cell: {obj.name} ordinal={record["order"]} projected={tuple(v)}')
            camera=scene.camera;scene.camera=main_camera;bpy.data.objects.remove(camera,do_unlink=True)
    finally:
        if scene.camera!=main_camera:
            camera=scene.camera;scene.camera=main_camera;bpy.data.objects.remove(camera,do_unlink=True)
        scene.render.resolution_x,scene.render.resolution_y=resolution


def export_modular_parts(field,directory,scene):
    """Upstream parts producer for the EXISTING cage authoring compositor."""
    from bpy_extras.object_utils import world_to_camera_view
    scale=4
    decor=[o for o in scene.objects if o.get('cageLayer')=='decor']
    base=[o for o in scene.objects if o.get('cageLayer')=='base']
    main_camera=scene.camera
    def sha(path):
        return hashlib.sha256(path.read_bytes()).hexdigest().upper()
    for obj in decor:
        if LOOK=='seam-v3':
            # Bake static cast shadows over the full field so a cell's immutable
            # sprite bounds cannot cut a tall tree shadow into a rectangle.
            obj.visible_camera=False
        else:
            obj.hide_render=True
    scene.render.filepath=str(directory/'base.png')
    bpy.ops.render.render(write_still=True)
    for obj in decor:
        obj.visible_camera=True
        obj.hide_render=True
    for obj in base:
        if LOOK=='seam-v3':
            obj.hide_render=True
        else:
            obj.is_shadow_catcher=True
    entries=[]
    object_dir=directory/'object-cells'
    object_dir.mkdir(exist_ok=True)
    for record in field['objects']:
        selected=[o for o in decor if o.get('sourceObjectOrdinal')==record['order']]
        if not selected:
            raise ValueError('Missing independently modelled object')
        for obj in selected:
            obj.hide_render=False
        set_camera(scene,placed_cell_bounds(record),scale)
        bpy.context.view_layer.update()
        # Validate mesh bounds before rendering; never hide clipping by alpha trimming.
        for obj in selected:
            for point in evaluated_world_vertices(obj):
                v=world_to_camera_view(scene,scene.camera,point)
                if not (-.001<=v.x<=1.001 and -.001<=v.y<=1.001):
                    raise ValueError(f'Object geometry exceeds source cell: {obj.name} ordinal={record["order"]} projected={tuple(v)}')
        name=f"obj-{record['order']:03d}"
        path=object_dir/(name+'.png')
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        if record['horizontalFlip'] or record['verticalFlip']:
            # Mechanical canonicalization only. Render at the effective placed
            # window; invert the source flips so the EXISTING compositor can
            # reapply them around the original pivot. Keep a byte-check witness.
            import numpy as np
            witness=directory/'placed-object-cells';witness.mkdir(exist_ok=True)
            shutil.copy2(path,witness/path.name)
            rendered=bpy.data.images.load(str(path),check_existing=False)
            rendered.colorspace_settings.name='Non-Color';rendered.alpha_mode='STRAIGHT'
            pixels=np.asarray(rendered.pixels[:],dtype=np.float32).reshape(rendered.size[1],rendered.size[0],4)
            if record['horizontalFlip']:pixels=pixels[:,::-1,:]
            if record['verticalFlip']:pixels=pixels[::-1,:,:]
            rendered.pixels.foreach_set(np.ascontiguousarray(pixels).reshape(-1))
            rendered.save();bpy.data.images.remove(rendered)
        entries.append({'objectId':name,'sourceOrdinal':record['order'],'sequenceId':record['sequenceId'],
                        'size':record['size'],'placement':record['placement'],'pivot':record['pivot'],
                        'horizontalFlip':record['horizontalFlip'],'verticalFlip':record['verticalFlip'],
                        'src':f'object-cells/{name}.png','sha256':sha(path)})
        for obj in selected:
            obj.hide_render=True
        part_camera=scene.camera
        scene.camera=main_camera
        bpy.data.objects.remove(part_camera,do_unlink=True)
    for obj in base:
        obj.is_shadow_catcher=False
        obj.hide_render=False
    for obj in decor:
        obj.hide_render=False
    scene.render.resolution_x=field['worldSize'][0]
    scene.render.resolution_y=field['worldSize'][1]
    spec_path=directory/'spec.json'
    manifest={'schemaVersion':1,'fieldId':field['id'],'status':'ART_PROPOSAL','pixelScale':scale,
              'runtimeEligible':False,'shippingReady':False,'humanApproved':False,
              'sourceSpec':'spec.json','sourceSpecSha256':sha(spec_path),
              'generation':{'tool':'Blender 5.2','role':'UPSTREAM_INDEPENDENT_PARTS_ONLY',
                            'scriptSha256':sha(Path(__file__)),'originalRasterInputs':[],
                            'helperSha256':{name:sha(ROOT/'scripts/lib'/name) for name in ['cage_authoring_coordinates.py','cage_sports_authoring.py','cage_nature_authoring.py','cage_hex_authoring.py','cage-authoring-geometry.mjs','cage_animated_surface_authoring.py']},
                            'footprintAuthority':'EXISTING_NATIVE_SHAPE_MASK_UNION' if LOOK=='seam-v3' else 'LEGACY_ENVELOPE',
                            'flipExport':'Inverse raster flip from effective placed-cell bounds; original compositor reapplies original flags and pivot.',
                            'look':LOOK,'reviewStatus':'VISUAL_CANDIDATE_NOT_APPROVED' if daylight() else 'STRUCTURAL_DRAFT_NOT_ACCEPTED',
                            'seamContract':({'version':3,'checkerUV':'x/16+y/8,x/16-y/8',
                                             'trayDepthUnits':.24,'coordinateAuthority':'UNCHANGED_NATIVE_ART_PLAN',
                                             'lidOutlineAuthority':'Native bay lattice 96x112, stagger 48x88; art-only contour, ground unchanged',
                                             'shadowExport':'Static fixed-placement shadows in full-canvas core; prop cells contain geometry only. Regenerate core when props change.',
                                             'sportsSurface':'Entire field_cm02_01 is clay except the grass infield; NO checker apron. Owner correction 2026-09-20.'} if LOOK=='seam-v3' else None),
                            'materialInput':({'src':str(MATERIAL_INPUT.relative_to(ROOT)).replace('\\','/'),'sha256':sha(MATERIAL_INPUT)} if MATERIAL_INPUT else None)},
              'core':{'src':'base.png','sha256':sha(directory/'base.png')},'objects':entries,
              'consumer':'scripts/build-cage-authoring-proof.py --modular-pack',
              'formula':'(placement - pivot) * pixelScale'}
    (directory/'modular-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')


def render_field(field,args,frame_index=0):
    global LAYER,FIELD_ID
    FIELD_ID=field['id']
    LAYER='base'
    if 'ringRopePartition' in bpy.context.scene:del bpy.context.scene['ringRopePartition']
    if 'natureFeatures' in bpy.context.scene:del bpy.context.scene['natureFeatures']
    RNG.seed(20260920+field['definitionIndex'])
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    if not M:
        materials()
        if daylight():
            daylight_materials()
        if LOOK=='seam-v3':
            seam_materials()
    if FIELD_ID in STAGE2_BATCH3:prepare_nature_materials(sys.modules[__name__])
    if FIELD_ID in STAGE3_BATCH1:prepare_animated_surface(sys.modules[__name__],frame_index)
    platform(field)
    if FIELD_ID=='field_cm29_01':structural_lid()
    anchors=sports(field) if FIELD_ID=='field_cm02_01' else new_family(field) if FIELD_ID in ('field_cm01_01','field_cm16_01') else stage2_family(field) if FIELD_ID in STAGE2_BATCH1 else build_sports_family(field,sys.modules[__name__]) if FIELD_ID in STAGE2_BATCH2 else build_nature_family(field,sys.modules[__name__]) if FIELD_ID in STAGE2_BATCH3 else []
    if FIELD_ID in STAGE3_BATCH1:anchors=build_animated_surface(field,sys.modules[__name__],frame_index)
    owners={obj.get('cageFieldId') for obj in bpy.context.scene.objects}
    if owners!={FIELD_ID}:
        raise ValueError('A field asset contains geometry from a different field')
    directory=(OUT/LOOK/'fields'/FIELD_ID) if daylight() else OUT/'fields'/FIELD_ID
    if frame_index:directory=directory/'animation'/f'{frame_index:02d}'
    directory.mkdir(parents=True,exist_ok=True)
    if daylight():
        shutil.copy2(OUT/'fields'/FIELD_ID/'spec.json',directory/'spec.json')
    width,height=field['nativeSize']
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.cycles.device='CPU'
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.world.color=(.35,.35,.35)
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.64,.8,1,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.32 if daylight() else .6
    # Translation-invariant sun: independently exported pieces share lighting.
    bpy.ops.object.light_add(type='SUN',location=world(80,-40,18))
    key=bpy.context.object
    key.name='large-daylight-softbox'
    key.data.energy=2.8 if daylight() else 2
    key.data.angle=.12 if daylight() else .2
    target=world(175,70)
    key.rotation_euler=(target-key.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX'
    scene.view_settings.exposure=.15 if daylight() else .7
    if daylight():
        scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.color_depth='8'
    bounds=[0,0,width,height]
    scale=4
    set_camera(scene,bounds,scale)
    bpy.context.view_layer.update()
    from bpy_extras.object_utils import world_to_camera_view
    projection_errors=[]
    for x,y in [(0,0),(width,0),(width,height),(0,height),(width/2,height/2)]:
        projected=world_to_camera_view(scene,scene.camera,world(x,y))
        observed=(projected.x*scene.render.resolution_x,(1-projected.y)*scene.render.resolution_y)
        expected=(x*scale,y*scale)
        projection_errors.append(math.dist(observed,expected))
    if max(projection_errors)>.02:
        raise ValueError('Orthographic/native-coordinate calibration failed')
    scene['status']='INDEPENDENT_FIELD_GEOMETRY_DRAFT_NOT_RUNTIME_APPROVED'
    scene['fieldId']=FIELD_ID
    scene['numeric_layout']='FIELD_LOCAL_NATIVE_ORIGIN_0_0_NO_CROP_NO_NEIGHBOR'
    scene['collision_authority']='UNCHANGED_EXISTING_GAME_DATA'
    scene['source_reference_rasters_loaded']=False
    scene['projection']='52-degree orthographic, 16 native pixels per world unit'
    if args.parts:preflight_object_bounds(field,scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/'master.blend'))
    scene.render.filepath=str(directory/'frame-00.png')
    bpy.ops.render.render(write_still=True)
    layer_files=[]
    if args.layers:
        decor=[obj for obj in scene.objects if obj.get('cageLayer')=='decor']
        base=[obj for obj in scene.objects if obj.get('cageLayer')=='base']
        for obj in decor:
            obj.hide_render=True
        scene.render.filepath=str(directory/'base.png')
        bpy.ops.render.render(write_still=True)
        layer_files.append('base.png')
        for obj in decor:
            obj.hide_render=False
        for obj in base:
            obj.is_shadow_catcher=True
        scene.render.filepath=str(directory/'objects-shadow.png')
        bpy.ops.render.render(write_still=True)
        layer_files.append('objects-shadow.png')
        for obj in base:
            obj.is_shadow_catcher=False
    if args.parts:
        export_modular_parts(field,directory,scene)
    report={'status':'INDEPENDENT_FIELD_GEOMETRY_DRAFT_NOT_RUNTIME_APPROVED','fields':[FIELD_ID],
            'fieldId':FIELD_ID,'geometryOwnerIds':sorted(owners),'neighborFieldIds':[],
            'sourceCropApplied':False,'objectAnchors':anchors,'frameIndex':frame_index,
            'source':'procedural original Blender geometry; numeric placement evidence only',
            'camera':{'elevationDegrees':52,'nativePixelsPerUnit':UNIT,'boundsNative':bounds,'renderScale':scale},
            'objects':len(bpy.data.objects),'materials':len(bpy.data.materials),
            'renderSize':[scene.render.resolution_x,scene.render.resolution_y],
            'maxProjectionErrorPixels':max(projection_errors),
            'experimentalLayers':layer_files,'look':LOOK,'independentPartsExported':args.parts,
            'layerLimit':'Independent props are offline exports; runtime actor depth sorting is not integrated.',
            'sourceRastersLoaded':False,'runtimeEligible':False,
            'ringRopePartition':json.loads(scene['ringRopePartition']) if 'ringRopePartition' in scene else None,
            'natureFeatures':json.loads(scene['natureFeatures']) if 'natureFeatures' in scene else None,
            'hexFootprint':field_footprint(ROOT,field) if LOOK=='seam-v3' else None,
            'hexFloorMeshNative':json.loads(scene['hexFloorMeshNative']) if LOOK=='seam-v3' else None,
            'openGates':['per-field visual refinement','exact silhouette and ground-coverage check','full active catalog models','layered occlusion','mobile browser validation']}
    (directory/'render-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('CAGE_INDEPENDENT_FIELD_COMPLETE '+json.dumps({k:v for k,v in report.items() if k!='ringRopePartition'}))


def render_surface_animation(field,args):
    sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest().upper()
    if len(field['frames'])!=2 or any(o['sequenceFrameCount']!=1 for o in field['objects']):
        raise ValueError('Only original two-frame surfaces with static object sequences are supported')
    if not args.parts:raise ValueError('Surface animation requires independent parts export')
    for index in range(len(field['frames'])):render_field(field,args,index)
    directory=OUT/LOOK/'fields'/field['id']
    manifest=json.loads((directory/'modular-manifest.json').read_text(encoding='utf8'))
    frames=[]
    for index,timing in enumerate(field['frames']):
        prefix='' if index==0 else f'animation/{index:02d}/'
        part=json.loads((directory/prefix/'modular-manifest.json').read_text(encoding='utf8'))
        if len(part['objects'])!=len(manifest['objects']):raise ValueError('Animation object count drift')
        for actual,wanted in zip(part['objects'],manifest['objects']):
            if {k:v for k,v in actual.items() if k!='sha256'}!={k:v for k,v in wanted.items() if k!='sha256'}:
                raise ValueError('Static animation object placement changed between phases')
            # Blender embeds master filename and render timestamp in PNG metadata.
            # Compare the actual pixels, not those intentionally different stamps.
            import numpy as np
            images=[bpy.data.images.load(str(path),check_existing=False) for path in
                    (directory/prefix/actual['src'],directory/wanted['src'])]
            try:
                arrays=[]
                for image in images:
                    values=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(values);arrays.append(values)
                if not np.array_equal(*arrays):raise ValueError('Static animation object pixels changed between phases')
            finally:
                for image in images:bpy.data.images.remove(image)
        frames.append({**{k:timing[k] for k in ('durationMs','durationRawTicks','durationEvidence')},
                       'src':prefix+'base.png','sha256':sha(directory/prefix/'base.png')})
    manifest['coreFrames']=frames
    manifest['generation']['animationRole']='Two offline surface states; original runtime timing; static OPM only'
    (directory/'modular-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')


def main():
    global LOOK,MATERIAL_INPUT
    parser=argparse.ArgumentParser(description='Export independent fields, never a fused ranch image.')
    parser.add_argument('--samples',type=int,default=32)
    parser.add_argument('--layers',action='store_true')
    parser.add_argument('--parts',action='store_true',help='Export canonical object cells for the original compositor')
    parser.add_argument('--field',action='append',choices=['field_cm28_01','field_cm02_01','field_cm01_01','field_cm16_01','field_cm29_01',*STAGE2_BATCH1,*STAGE2_BATCH2,*STAGE2_BATCH3,*STAGE3_BATCH1])
    parser.add_argument('--look',choices=['structural-v1','daylight-v2','seam-v3'],default='structural-v1')
    parser.add_argument('--material-input',type=Path,help='Reviewed original ComfyUI material, inside this workpack')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    LOOK=args.look
    if LOOK=='daylight-v2' and args.field!=['field_cm02_01']:
        raise ValueError('Daylight v2 is a sports-only pilot; pass exactly --field field_cm02_01')
    if LOOK!='seam-v3' and any(f not in ('field_cm28_01','field_cm02_01') for f in (args.field or [])):
        raise ValueError('New field families require the seam-v3 shared material contract')
    if args.material_input:
        MATERIAL_INPUT=args.material_input.resolve()
        if not daylight() or not MATERIAL_INPUT.is_relative_to(OUT.resolve()) or not MATERIAL_INPUT.is_file():
            raise ValueError('Material input must be a reviewed local workpack raster for daylight v2')
    catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf8'))
    fields={f['id']:f for f in catalog['fields']}
    for fid in dict.fromkeys(args.field or ['field_cm28_01','field_cm02_01']):
        if fid in STAGE3_BATCH1:render_surface_animation(fields[fid],args)
        else:render_field(fields[fid],args)


if __name__=='__main__':
    main()
