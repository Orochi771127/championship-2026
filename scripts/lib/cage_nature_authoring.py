"""Original offline natural-cage geometry. Numeric layout is read-only authority.

No research rasters are loaded. Rocks, foliage and dunes are seeded meshes;
the existing source windows, including zero pivots and flips, own prop export.
"""
import math
from .cage_authoring_coordinates import placed_cell_bounds

FIELDS=('field_cm10_01','field_cm11_01','field_cm12_01','field_cm20_01',
        'field_cm35_01','field_cm37_01','field_cm40_01')
SURFACES={'field_cm10_01':'mountain-air','field_cm11_01':'forest-floor',
          'field_cm12_01':'jungle-floor','field_cm20_01':'dune-sand',
          'field_cm35_01':'basalt','field_cm37_01':'stone','field_cm40_01':'cave-floor'}


def prepare_nature_materials(d):
    colors={'stone':((.22,.28,.30),(.49,.52,.46)),
            'basalt':((.023,.033,.044),(.095,.11,.13)),
            'cave-floor':((.065,.12,.17),(.16,.24,.27)),
            'dune-sand':((.47,.27,.10),(.83,.63,.30)),
            'sandstone':((.33,.17,.07),(.62,.39,.15)),
            'forest-floor':((.075,.14,.025),(.21,.32,.055)),
            'jungle-floor':((.027,.12,.028),(.10,.27,.05))}
    for name,(low,high) in colors.items():
        if name in d.M:continue
        mat=d.material(name,low,.92)
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=12
        noise.inputs['Detail'].default_value=4
        ramp=nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=(*low,1);ramp.color_ramp.elements[1].color=(*high,1)
        links.new(noise.outputs['Fac'],ramp.inputs[0])
        links.new(ramp.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22
        bump.inputs['Distance'].default_value=.024
        grain=nodes.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=115
        grain.inputs['Detail'].default_value=3
        links.new(grain.outputs['Fac'],bump.inputs['Height'])
        links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])
        if name=='dune-sand':
            # World-space mapping keeps sand continuous across ground/dune meshes.
            geometry=nodes.new('ShaderNodeNewGeometry')
            links.new(geometry.outputs['Position'],noise.inputs['Vector'])
            links.new(geometry.outputs['Position'],grain.inputs['Vector'])
            wave=nodes.new('ShaderNodeTexWave');wave.wave_type='BANDS'
            wave.inputs['Scale'].default_value=14;wave.inputs['Distortion'].default_value=7
            links.new(geometry.outputs['Position'],wave.inputs['Vector'])
            mix=nodes.new('ShaderNodeMixRGB');mix.inputs[0].default_value=.24
            links.new(grain.outputs['Fac'],mix.inputs[1]);links.new(wave.outputs['Color'],mix.inputs[2])
            links.new(mix.outputs[0],bump.inputs['Height'])
    for name,color,glow in [('mountain-air',(.20,.44,.60),.15),
                             ('lava',(.98,.13,.006),2),('rope',(.61,.42,.18),0),
                             ('snowcap',(.86,.93,.98),0),('summit-flag',(.96,.63,.035),.25),
                             ('cave-mouth',(.002,.004,.008),0),('cave-crystal',(.03,.68,.96),1.7),
                             ('cave-lantern',(1.0,.29,.025),2.2),
                             ('palm-leaf',(.035,.24,.055),0),('tropical-petal',(.72,.085,.022),0)]:
        if name not in d.M:d.material(name,color,.8,emission=glow)


def build_nature_family(field,d):
    import bpy
    from mathutils import Vector
    fid=field['id'];d.LAYER='base';anchors=[];features=[]
    def screen(x,y,z=0):return d.world(x,y+z*d.UNIT*d.C,z)
    def rock(x,y,rx=8,ry=5,height=.55,mat='stone',name='faceted-rock'):
        # Jagged original low-poly cross section, no reference silhouette trace.
        n=7;verts=[]
        for level in (0,1,2):
            for k in range(n):
                a=k*math.tau/n;r=d.RNG.uniform(.86,1.10)*(1 if level==0 else .88 if level==1 else .57)
                verts.append(d.world(x+math.cos(a)*rx*r,y+math.sin(a)*ry*r,
                                     (0,.62*height,height)[level]))
        faces=[tuple(reversed(range(2*n,3*n)))]
        for level in (0,1):
            for k in range(n):faces.append((level*n+k,(level+1)*n+k,(level+1)*n+(k+1)%n,level*n+(k+1)%n))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        return d.finish(obj,name,mat,.012)
    def frustum(name,x,y,rx0,ry0,rx1,ry1,z0,z1,mat,n=11):
        """Low-poly tapered landmark with an intentionally readable silhouette."""
        verts=[]
        for z,rx,ry in ((z0,rx0,ry0),(z1,rx1,ry1)):
            for index in range(n):
                angle=index*math.tau/n
                verts.append(d.world(x+math.cos(angle)*rx,y+math.sin(angle)*ry,z))
        faces=[tuple(reversed(range(n)))]
        for index in range(n):
            nxt=(index+1)%n
            faces.append((index,nxt,n+nxt,n+index))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        return d.finish(obj,name,mat,.012)
    def ring(name,x,y,outer_x,outer_y,inner_x,inner_y,z,mat,n=11):
        verts=[]
        for index in range(n):
            angle=index*math.tau/n
            verts.append(d.world(x+math.cos(angle)*outer_x,y+math.sin(angle)*outer_y,
                                 z+.035*math.sin(index*2.7)))
            verts.append(d.world(x+math.cos(angle)*inner_x,y+math.sin(angle)*inner_y,
                                 z-.035*math.cos(index*1.9)))
        faces=[]
        for index in range(n):
            nxt=(index+1)%n
            faces.append((index*2,nxt*2,nxt*2+1,index*2+1))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        return d.finish(obj,name,mat,.008)
    def vertical_panel(name,points,mat):
        face=tuple(range(len(points)))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([screen(*point) for point in points],[],[face,tuple(reversed(face))]);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        return d.finish(obj,name,mat,.004)
    def screencurve(name,points,z=.1,radius=.035,mat='rope'):
        return d.curve(name,[screen(*p,z) for p in points],radius,mat)
    def tuft(x,y,scale=1):
        for a in range(5):
            q=(a-2)*1.3*scale
            screencurve('sparse-edge-grass',[(x,y),(x+q*.5,y-3*scale),(x+q,y-5*scale)],.16,.018,'leaf')
    if fid=='field_cm10_01':
        features=['two-rock-ledges','suspended-timber-bridge','open-air-chasm']
        left=[(0,23),(96,23),(96,87),(80,100),(84,169),(96,198),(48,175),(48,110),(0,87)]
        right=[(192,23),(288,23),(288,87),(240,112),(240,174),(192,198),(211,164),(208,113),(192,87)]
        for pts in (left,right):d.slab('mountain-rock-ledge',pts,.001,.06,'stone',0)
        # Deck belongs to the fixed core. OPM cells hold independently exported
        # rope and posts; the sky is opaque within the native field footprint.
        for i in range(28):
            x=77+i*4.8;sag=math.sin(i/27*math.pi)*9
            d.slab('bridge-timber-plank',[(x,113+sag),(x+4.1,113+sag),(x+4.1,145+sag),(x,145+sag)],.02,.11,'wood',.012)
        screencurve('bridge-rear-suspension',[(73+i*7.1,99+14*math.sin(i/20*math.pi)) for i in range(21)],.2,.055)
        for i in range(17):
            x=79+i*8
            screencurve('rear-rope-drop',[(x,101+13*math.sin(i/16*math.pi)),(x,114+9*math.sin(i/16*math.pi))],.18,.026)
        for x,y,r,h in [(32,44,18,1),(65,64,11,.6),(249,46,21,1.5),(266,75,11,.6),(62,153,8,.5),(227,158,7,.4)]:
            rock(x,y,r,r*.5,h)
        for x,y in [(15,65),(78,78),(237,68),(62,165),(228,166)]:tuft(x,y)
        # The immutable vertically flipped windows place two posts on the far
        # ledge. Fixed-core guy ropes visibly connect them to the deck rail.
        for a,b in [((216,124),(208,105)),((207,170),(210,146)),((69,147),(79,144))]:
            screencurve('bridge-ledge-guy-rope',[a,b],.15,.035)
    elif fid=='field_cm20_01':
        features=['wind-rippled-sand','layered-sandstone-outcrops','open-desert-floor']
        for x,y,rx,ry,h in [(25,48,21,11,.8),(58,37,15,8,1.1),(157,42,19,9,.7),(218,137,11,7,.55)]:
            rock(x,y,rx,ry,h,'sandstone','sandstone-outcrop')
            rock(x,y,rx*.71,ry*.7,h*1.4,'sandstone','sandstone-upper-stratum')
        for bx,by,w in [(94,66,62),(159,50,44),(188,145,51)]:
            # Broad low dune crests, not contrasting lines drawn on the sand.
            verts=[];faces=[]
            for row in range(9):
                v=row/8
                for col in range(25):
                    u=col/24
                    verts.append(d.world(bx+(u-.5)*w,by+(v-.5)*13+math.sin(u*math.pi)*3,
                                         .001+.20*math.sin(u*math.pi)*math.sin(v*math.pi)**2))
            for row in range(8):
                for col in range(24):
                    k=row*25+col;faces.append((k,k+25,k+26,k+1))
            mesh=bpy.data.meshes.new('low-wind-dune');mesh.from_pydata(verts,[],faces);mesh.update()
            for face in mesh.polygons:face.use_smooth=True
            obj=bpy.data.objects.new('low-wind-dune',mesh);bpy.context.collection.objects.link(obj)
            d.finish(obj,'low-wind-dune','dune-sand')
    elif fid=='field_cm35_01':
        features=['tapered-volcanic-cone','luminous-recessed-crater','static-lava-fissures']
        # One unmistakable hero landmark replaces the previous scatter of dark
        # stones.  It stays centrally inset so the isometric projection does not
        # visually trespass into the neighbouring cage.
        frustum('small-volcano-cone',48,61,29,22,10,7,.015,.86,'basalt')
        ring('small-volcano-crater-rim',48,61,12,8,6,4,.90,'basalt')
        d.slab('small-volcano-lava-pool',[(43,59),(48,57),(54,59),(54,64),(48,66),(42,63)],.84,.875,'lava',.006)
        for pts in [[(47,67),(42,79),(36,91)],[(54,66),(63,76),(72,83)],[(44,68),(50,82),(48,97)]]:
            # Flat jagged ribbons with tapered tips, not raised glowing tubes.
            left=[];right=[]
            for i,(x,y) in enumerate(pts):
                width=.35 if i in (0,len(pts)-1) else d.RNG.uniform(.8,1.45)
                left.append((x-width,y));right.append((x+width,y+.6))
            d.slab('static-lava-fissure',left+list(reversed(right)),.006,.018,'lava',0)
        for x,y,rx,ry,h in [(21,72,5,4,.32),(76,69,5,4,.38),(27,91,4,3,.25)]:
            rock(x,y,rx,ry,h,'basalt','volcano-flank-rock')
    elif fid=='field_cm37_01':
        features=['single-raised-summit','bright-snowcap','summit-flag','sparse-alpine-grass']
        # High-value silhouette and colour cues separate this one-cell highland
        # from both the cave and the small volcano at configuration scale.
        frustum('small-highland-main-peak',48,61,28,21,8,6,.012,1.05,'stone')
        rock(34,65,13,9,.72,'stone','highland-shoulder')
        rock(63,70,12,8,.62,'stone','highland-shoulder')
        frustum('highland-snowcap',48,60,9,6,4,2.8,.94,1.28,'snowcap',9)
        d.slab('highland-snowcap-top',[(44,59),(48,57),(52,59),(51,62),(47,63),(43,61)],1.275,1.295,'snowcap',.004)
        mast_bottom=d.world(48,58,.98);mast_top=d.world(48,58,1.88)
        d.beam('highland-summit-mast',mast_bottom,mast_top,.055,.055,'summit-flag',.006)
        flag_points=[d.world(48,58,1.80),d.world(68,58,1.60),d.world(48,58,1.40)]
        mesh=bpy.data.meshes.new('highland-summit-flag')
        mesh.from_pydata(flag_points,[],[(0,1,2),(2,1,0)]);mesh.update()
        flag=bpy.data.objects.new('highland-summit-flag',mesh);bpy.context.collection.objects.link(flag)
        d.finish(flag,'highland-summit-flag','summit-flag',.004)
        # A thick triangular outline remains legible after the field is reduced
        # to a roughly 96-pixel configuration-page cell.
        d.beam('highland-summit-flag-edge',flag_points[0],flag_points[1],.052,.052,'summit-flag',.004)
        d.beam('highland-summit-flag-edge',flag_points[1],flag_points[2],.052,.052,'summit-flag',.004)
        for x,y in [(20,75),(72,77),(31,91),(65,94)]:tuft(x,y,.75)
        for x,y in [(26,57),(70,61),(52,91)]:rock(x,y,2.5,1.6,.16)
    elif fid=='field_cm40_01':
        features=['black-arched-cave-mouth','enclosing-rock-wall','blue-crystals','warm-entry-lantern']
        # The dark arched opening is the dominant shape.  Peripheral rocks are
        # deliberately secondary so this no longer reads as another grey hill.
        vertical_panel('cave-black-mouth',[(23,70,.04),(23,56,.42),(27,46,.78),(34,38,1.15),
                                           (41,34,1.38),(48,32,1.48),(55,34,1.38),(62,38,1.15),
                                           (69,46,.78),(73,56,.42),(73,70,.04)],'cave-mouth')
        for x,y,h in [(20,42,1.05),(30,31,1.42),(43,27,1.58),(58,29,1.46),(70,38,1.16),(77,51,.80)]:
            rock(x,y,7,5,h,'cave-floor','cave-arch-rock')
        for x,y,h in [(19,81,.52),(77,82,.46)]:rock(x,y,4,3,h,'stone','cave-edge-rock')
        for x,y,h in [(27,72,.58),(34,79,.43),(69,75,.52)]:rock(x,y,2.4,1.5,h,'cave-crystal','cave-crystal')
        d.beam('cave-lantern-post',screen(61,78,.03),screen(61,78,.62),.025,.025,'stone',.004)
        d.sphere('cave-entry-lantern',screen(61,78,.68),(.16,.16,.22),'cave-lantern')
    elif fid=='field_cm11_01':
        features=['six-broadleaf-trees','three-foreground-shrubs','open-forest-floor']
        for x,y in [(29,158),(110,165),(170,140),(187,89),(160,83)]:
            tuft(x,y,.7);rock(x+5,y+2,2,1.3,.12)
    elif fid=='field_cm12_01':
        features=['seven-frond-palms','rear-rock-outcrop','original-tropical-flower']
        for x,y in [(153,51),(174,65),(184,80)]:rock(x,y,9,5,.75)
        # An original six-petal flower in the fixed core, not an extra OPM.
        for i in range(6):
            a=i*math.tau/6
            d.sphere('tropical-flower-petal',screen(27+7*math.cos(a),70+4*math.sin(a),.3),(.30,.17,.08),'tropical-petal')
        d.sphere('tropical-flower-center',screen(27,70,.45),(.18,.18,.13),'flower')
        for x,y in [(39,74),(95,57),(165,128),(218,160)]:tuft(x,y,1.2)

    for record in field['objects']:
        d.LAYER='decor';before=set(bpy.context.scene.objects)
        xx,yy,w,h=placed_cell_bounds(record);cx=xx+w/2;bottom=yy+h-3
        if fid=='field_cm11_01':
            if record['sequenceId']==0:
                role='broadleaf-tree';p=screen(cx,bottom,.05)
                top=screen(cx-1,yy+18,2.1)
                d.beam('forest-trunk',p,top,.17,.17,'bark',.02)
                # Bounded clusters of actual leaves, not sphere canopy proxies.
                for ox,oy,z,r in [(-8,22,2,.43),(8,21,2.05,.44),(0,14,2.35,.58),(0,29,1.8,.43)]:
                    center=screen(cx+ox,yy+oy,z)
                    d.beam('forest-branch',p.lerp(top,.62),center,.075,.075,'bark',.01)
                    d.foliage('broadleaf-canopy',center,r,360)
            else:
                role='foreground-shrub-zero-pivot'
                for dx,dy in [(-10,25),(0,20),(10,25)]:d.foliage('forest-low-shrub',screen(cx+dx,yy+dy,.55),.42,210)
        elif fid=='field_cm12_01':
            role='frond-palm';top=screen(cx,yy+14,2.5);base=screen(cx+2,record['placement'][1]-1,0)
            d.beam('palm-trunk',base,top,.12,.12,'bark',.015)
            verts=[];faces=[]
            for arm in range(9):
                angle=arm*math.tau/9;length=22+d.RNG.uniform(-3,3)
                path=[]
                for j in range(9):
                    t=j/8;px=cx+math.cos(angle)*length*t;py=yy+14+math.sin(angle)*8*t+6*t*t
                    path.append(screen(px,py,2.5-.7*t))
                    width=.2+3.1*math.sin(math.pi*t)
                    sx=-math.sin(angle)*width;sy=math.cos(angle)*width*.7
                    start=len(verts)
                    verts.extend([screen(px+sx,py+sy,2.5-.7*t),
                                  screen(px,py,2.56-.7*t),
                                  screen(px-sx,py-sy,2.5-.7*t)])
                    if j:
                        faces.extend([(start-3,start,start+1,start-2),
                                      (start-2,start+1,start+2,start-1)])
                d.curve('palm-frond-stem',path,.014,'leaf-dark')
            mesh=bpy.data.meshes.new('palm-leaflets');mesh.from_pydata(verts,[],faces);mesh.update()
            obj=bpy.data.objects.new('palm-leaflets',mesh);bpy.context.collection.objects.link(obj)
            d.finish(obj,'palm-leaflets','palm-leaf')
        elif fid=='field_cm10_01':
            seq=record['sequenceId']
            if seq==1:
                role='front-suspension-rope'
                pts=[(xx+3+(w-6)*i/32,yy+6+12*math.sin(i/32*math.pi)) for i in range(33)]
                screencurve('bridge-front-rope',pts,.2,.045)
                for i in range(1,21):
                    x=xx+3+(w-6)*i/21;y=yy+6+12*math.sin(i/21*math.pi)
                    screencurve('bridge-front-drop',[(x,y),(x,min(yy+h-3,y+8))],.15,.022)
            elif seq==0:
                role='bridge-post-rope-tie'
                screencurve('bridge-post-tie',[(xx+2,yy+5),(cx,yy+9),(xx+w-2,yy+5)],.12,.045)
                screencurve('bridge-post-support',[(cx,yy+8),(cx,bottom)],.08,.09,'wood')
            else:
                role='bridge-anchor-post'
                screencurve('bridge-anchor-post',[(cx,yy+3),(cx,bottom)],.12,.09,'wood')
                for y in (yy+8,yy+11):screencurve('bridge-anchor-binding',[(cx-1.4,y),(cx+1.4,y)],.2,.04)
        else:raise ValueError('Unexpected natural-cage OPM: '+fid)
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement']
        anchors.append({'sourceOrdinal':record['order'],'sequenceId':record['sequenceId'],
                        'sourcePlacement':record['placement'],'role':role,'effectiveCell': [xx,yy,w,h]})
    d.LAYER='base'
    bpy.context.scene['natureFeatures']=__import__('json').dumps(features)
    return anchors
