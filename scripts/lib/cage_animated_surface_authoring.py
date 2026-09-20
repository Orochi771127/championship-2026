"""Original two-state lava and coastal-water cores; no object-animation shortcut."""
import math
FIELDS=('field_cm07_01','field_cm39_01','field_cm09_01','field_cm21_01')
SURFACES={'field_cm07_01':'volcanic-floor','field_cm39_01':'coastal-water',
          'field_cm09_01':'coastal-water','field_cm21_01':'polar-water'}


def clip_to_cell(points,cell):
    """Clip decorative flat polygons to an authoritative convex native hex."""
    result=list(points)
    for a,b in zip(cell,cell[1:]+cell[:1]):
        def side(p):return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
        source=result;result=[]
        if not source:break
        previous=source[-1];sp=side(previous)
        for current in source:
            sc=side(current)
            if (sp>=0)!=(sc>=0):
                t=sp/(sp-sc)
                result.append(tuple(p+(c-p)*t for p,c in zip(previous,current)))
            if sc>=0:result.append(current)
            previous,sp=current,sc
    # Exact boundary intersections may occur twice; avoid degenerate mesh edges.
    clean=[]
    for p in result:
        if not clean or math.dist(p,clean[-1])>1e-7:clean.append(p)
    if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-7:clean.pop()
    return clean if len(clean)>=3 else []


def coast_x(y):
    return 59+.39*y+7*math.sin(y*.061)


def build_coast_or_ice(field,d,phase):
    """New original shapes; source references supply roles, not traced contours."""
    import bpy
    cells=d.field_footprint(d.ROOT,field)['cells'];anchors=[]
    def flat(name,points,z,mat):
        for cell in cells:
            clipped=clip_to_cell(points,cell['polygon'])
            if clipped:d.slab(name,clipped,.001,z,mat,0)
    def inside(x,y,margin=2):
        for cell in cells:
            p=cell['polygon']
            if all((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])>=margin*math.dist(a,b)
                   for a,b in zip(p,p[1:]+p[:1])):return True
        return False
    if field['id']=='field_cm09_01':
        ys=list(range(-8,209,4))
        flat('original-broad-sandy-coast',[(-8,-8)]+[(coast_x(y),y) for y in ys]+[(-8,208)],.009,'coastal-sand')
        for band in range(3):
            for y in range(10,193,3):
                points=[(coast_x(v)+2+band*3+phase*1.2,v) for v in (y,y+1.5,y+3)]
                if all(inside(*p) for p in points):
                    d.curve('two-state-coastal-foam',[d.world(*p,.02) for p in points],.022/(band+1),'sea-foam')
        for y in range(30,190,17):
            for x in range(110,282,21):
                pts=[(x-3,y+phase*1.5),(x,y-1+phase*1.5),(x+3,y+phase*1.5)]
                if x>coast_x(y)+16 and all(inside(*p,margin=4) for p in pts):
                    d.curve('short-sea-ripple',[d.world(*p,.025) for p in pts],.012,'sea-foam')
        for record in field['objects']:
            before=set(bpy.context.scene.objects);d.LAYER='decor'
            x,y=record['placement'];bend=3 if record['sequenceId']==0 else -3
            d.curve('independent-coastal-palm-trunk',[d.world(x,y,.08),d.world(x+bend*.4,y,1.1),d.world(x+bend,y,2.7)],.095,'bark')
            # Folded fronds stay in the unchanged 64x64 source cell window.
            for i in range(9):
                angle=i*math.tau/9+record['sequenceId']*.21
                dx,dy=math.cos(angle),math.sin(angle)
                cx,cy=x+bend,y
                vertices=[d.world(cx,cy,2.7),d.world(cx+dx*11-dy*2.3,cy+dy*8+dx*2.3,2.92),
                          d.world(cx+dx*25,cy+dy*17,2.38),d.world(cx+dx*11+dy*2.3,cy+dy*8-dx*2.3,2.83),
                          d.world(cx+dx*12,cy+dy*8,3.04)]
                mesh=bpy.data.meshes.new('folded-palm-frond');mesh.from_pydata(vertices,[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]);mesh.update()
                obj=bpy.data.objects.new('folded-palm-frond',mesh);bpy.context.collection.objects.link(obj)
                d.finish(obj,'folded-palm-frond','palm-light' if i%3 else 'palm-dark')
            for obj in set(bpy.context.scene.objects)-before:
                obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement']
            anchors.append({'sourceOrdinal':record['order'],'role':'independent-coastal-palm',
                            'anchorNative':record['placement']})
        features=['four-hex-concave-coast','two-independent-palm-cells','two-state-shoreline']
    else:
        # Low relief only: the visual ice/snow never creates a new collision wall.
        edge=[(x,123+9*math.sin(x*.07)) for x in range(-8,249,4)]
        flat('continuous-snow-shelf',[(-8,-8),(248,-8)]+list(reversed(edge)),.025,'polar-snow')
        for row,y in enumerate(range(130,201,18)):
            for col,x in enumerate(range(5,242,23)):
                cx=x+(row%2)*8;cy=y+3*math.sin(col*1.7)
                radius=8+(col+row)%4
                # Original two-state ice movement stays in the lower water strip.
                shift=phase*(.9 if (col+row)%2 else -.9)
                points=[(cx+shift+math.cos(i*math.tau/6+.13*col)*radius,
                         cy+math.sin(i*math.tau/6+.13*col)*radius*.68) for i in range(6)]
                flat('low-floating-ice-plate',points,.04,'polar-ice')
        for x,y in [(76,44),(105,30),(158,40),(195,49),(63,83),(188,83)]:
            pts=[(x+math.cos(i*math.tau/7)*8,y+math.sin(i*math.tau/7)*4) for i in range(7)]
            flat('low-snow-drift',pts,.08,'polar-snow')
        features=['four-hex-polar-shelf','continuous-snow-ground','two-state-low-ice-floes']
    d.LAYER='base';bpy.context.scene['natureFeatures']=__import__('json').dumps(features)
    return anchors


def prepare(d,phase):
    for name,color in [('volcanic-floor',(.045,.057,.07)),('coastal-water',(.018,.28,.47)),
                       ('coastal-sand',(.67,.48,.21)),('lava-flow',(.95,.15,.007)),
                       ('volcanic-rock',(.095,.085,.075)),('coastal-rock',(.23,.31,.15)),
                       ('sea-foam',(.65,.90,.93)),('polar-water',(.025,.24,.39)),
                       ('polar-snow',(.78,.88,.94)),('polar-ice',(.29,.66,.82)),
                       ('palm-light',(.15,.38,.04)),('palm-dark',(.045,.21,.025))]:
        if name not in d.M:
            mat=d.material(name,color,.87 if name!='coastal-water' else .28,
                           emission=1.1 if name=='lava-flow' else 0)
            nodes,links=mat.node_tree.nodes,mat.node_tree.links
            geo=nodes.new('ShaderNodeNewGeometry')
            noise=nodes.new('ShaderNodeTexNoise');noise.name='original-surface-grain'
            noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=10 if name=='lava-flow' else 60
            links.new(geo.outputs['Position'],noise.inputs['Vector'])
            bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.23
            bump.inputs['Distance'].default_value=.021
            links.new(noise.outputs['Fac'],bump.inputs['Height'])
            links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])
            if name=='lava-flow':
                ramp=nodes.new('ShaderNodeValToRGB')
                ramp.color_ramp.elements[0].position=.3;ramp.color_ramp.elements[0].color=(.065,.012,.003,1)
                ramp.color_ramp.elements[1].position=.72;ramp.color_ramp.elements[1].color=(1,.42,.012,1)
                links.new(noise.outputs['Fac'],ramp.inputs[0])
                for key in ('Base Color','Emission Color'):links.new(ramp.outputs[0],nodes.get('Principled BSDF').inputs[key])
        if name in ('lava-flow','coastal-water','polar-water'):
            d.M[name].node_tree.nodes['original-surface-grain'].inputs['W'].default_value=phase*.45


def build(field,d,phase):
    import bpy
    fid=field['id'];anchors=[];d.LAYER='base'
    if fid in ('field_cm09_01','field_cm21_01'):return build_coast_or_ice(field,d,phase)
    def rock(x,y,size,height,mat='volcanic-rock'):
        pts=[(x+math.cos(i*math.tau/7)*size,y+math.sin(i*math.tau/7)*size*.55) for i in range(7)]
        d.slab('original-layered-edge-rock',pts,.015,height,mat,.04)
        smaller=[(x+(xx-x)*.73,y+(yy-y)*.73) for xx,yy in pts]
        d.slab('original-edge-rock-cap',smaller,height,height+.18,mat,.04)
    if fid=='field_cm07_01':
        # Broad lava terrain rather than a central cone or a suspended tube.
        river=[(80,27),(103,28),(109,57),(99,73),(121,94),(116,118),
               (134,139),(124,173),(110,181),(104,146),(97,127),(103,101),
               (84,82),(93,58)]
        d.slab('flowing-lava-river',river,.001,.012,'lava-flow',0)
        for pts in [[(109,151),(90,177),(74,184),(93,168)],
                    [(122,146),(154,155),(182,181),(168,178),(144,161)]]:
            d.slab('branching-lava-runnel',pts,.001,.013,'lava-flow',0)
        for x,y,s,h in [(22,42,13,.8),(46,31,15,1.1),(157,38,16,1.1),
                         (180,57,10,.7),(69,159,9,.6),(153,171,8,.5),(210,150,11,.6)]:rock(x,y,s,h)
        for x,y in [(38,72),(63,84),(145,91),(175,118),(72,143),(196,166)]:rock(x,y,2,.06)
        features=['four-hex-volcanic-plate','two-state-lava-river','edge-rock-terraces']
    else:
        sand=[(79,16),(96,24),(96,88),(70,101),(75,82),(70,63),(80,42)]
        d.slab('coastal-sand-bank',sand,.001,.007,'coastal-sand',0)
        for band in range(3):
            pts=[]
            for j in range(35):
                y=24+j*2;x=71+math.sin(y*.08)*5-band*5+phase*1.4
                pts.append(d.world(x,y,.025))
            d.curve('shore-foam-line',pts,.017 if band else .027,'sea-foam')
        # Small paired ripples stay strictly within the water, not on the sand.
        for i in range(24):
            x=12+(i%6)*8;y=29+(i//6)*17
            shift=phase*2
            d.curve('moving-water-ripple',[d.world(x-2,y+shift,.02),d.world(x,y+shift-.8,.02),d.world(x+2,y+shift,.02)],.012,'sea-foam')
        for record in field['objects']:
            before=set(bpy.context.scene.objects);d.LAYER='decor'
            for x,y,s,h in [(69,86,6,.35),(79,89,7,.45),(87,83,5,.30)]:rock(x,y,s,h,'coastal-rock')
            for obj in set(bpy.context.scene.objects)-before:
                obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement']
            anchors.append({'sourceOrdinal':record['order'],'role':'coastal-rock-cluster',
                            'anchorNative':record['placement']})
        features=['single-hex-coast','two-state-shore-foam','independent-rock-cluster']
    d.LAYER='base';bpy.context.scene['natureFeatures']=__import__('json').dumps(features)
    return anchors
