"""Original Blender meshes for athletics, dojo and ring. No research rasters."""
import math
from .cage_authoring_coordinates import placed_cell_bounds, partition_segment


def build_sports_family(field,d):
    from mathutils import Vector
    import bpy
    def screen(x,y,z=0):return d.world(x,y+z*d.UNIT*d.C,z)
    def tag_new(before,record):
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement']
    def segment(name,a,b,z,mat='line',radius=.025):
        return d.curve(name,[d.world(*a,z),d.world(*b,z)],radius,mat)
    for name,color in [('sand',(.62,.43,.18)),('tatami',(.19,.36,.19)),
                       ('tatami-edge',(.045,.14,.10)),('ring-canvas',(.045,.34,.48))]:
        if name not in d.M:d.material(name,color,.78)
    anchors=[];d.LAYER='base';fid=field['id']
    if fid=='field_cm03_01':
        # A compact athletics track follows this field's own footprint; no
        # neighboring cage is baked into this core, no original logo is copied.
        outer=[(5,53),(283,53),(283,85),(235,113),(235,173),(192,194),
               (144,170),(96,194),(53,172),(53,113),(5,85)]
        d.slab('athletics-clay-track',outer,.001,.008,'clay',0)
        d.slab('athletics-grass-infield',[(68,82),(220,82),(220,153),(68,153)],.009,.013,'grass',0)
        for lane in range(5):
            path=[(8+lane*3,54+lane*4),(280-lane*3,54+lane*4),
                  (280-lane*3,84-lane),(234-lane*3,112+lane),
                  (234-lane*3,171-lane*4),(54+lane*3,171-lane*4),
                  (54+lane*3,112+lane),(8+lane*3,84-lane)]
            d.curve('continuous-athletics-lane',[d.world(*p,.016) for p in path],.016,'line',True)
        d.slab('long-jump-runup',[(77,89),(188,89),(188,97),(77,97)],.015,.025,'clay',0)
        d.slab('long-jump-sand',[(189,85),(215,85),(215,103),(189,103)],.015,.06,'sand',.015)
        for yy in (90,96):segment('runup-white-line',(77,yy),(186,yy),.033,radius=.018)
        segment('takeoff-board',(182,89),(182,97),.037,radius=.06)
        for r in (15,26,37):
            d.curve('throw-sector-arc',[d.world(175+r*math.cos(t),143-r*.5*math.sin(t),.03)
                    for t in [i*math.pi/64 for i in range(15,60)]],.019,'line')
        # Low rear rail remains below the mandatory top crop's safe height.
        for x in range(12,281,24):
            p=d.world(x,35)
            d.box('athletics-rear-support',p+Vector((0,0,.40)),(.16,.16,.8),'porcelain')
        segment('athletics-rear-rail',(12,35),(276,35),.82,'porcelain',.055)
    elif fid=='field_cm04_01':
        # Three independent bay panels with woven, edged tatami; same global
        # floor coordinate system as other facilities, no camera reorientation.
        for bay in range(3):
            ox=bay*96
            points=[(ox+6,30),(ox+48,9),(ox+90,30),(ox+90,82),(ox+48,103),(ox+6,82)]
            d.slab('tatami-underlay',points,.002,.055,'tatami-edge',.015)
            inner=[(ox+9,32),(ox+48,12),(ox+87,32),(ox+87,80),(ox+48,100),(ox+9,80)]
            d.slab('woven-tatami-panel',inner,.055,.075,'tatami',.012)
            for y in (39,53,67,80):
                segment('tatami-panel-seam',(ox+10,y),(ox+86,y),.08,'tatami-edge',.02)
            segment('tatami-center-seam',(ox+48,13),(ox+48,99),.08,'tatami-edge',.018)
        # Fine weave is procedural material, never sampled from reference art.
        mat=d.M['tatami'];nodes,links=mat.node_tree.nodes,mat.node_tree.links
        tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=180
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.10;bump.inputs['Distance'].default_value=.01
        links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])
    elif fid=='field_cm27_01':
        deck=[(17,116),(96,76),(174,116),(96,156)]
        d.slab('ring-base-apron',deck,.0,.40,'blue',.025)
        d.slab('ring-padded-canvas',deck,.40,.46,'ring-canvas',.035)
        # Original abstract training marks; no extracted championship logo/text.
        d.curve('ring-center-mark',[d.world(96+15*math.cos(i*math.tau/64),116+7*math.sin(i*math.tau/64),.47)
                                    for i in range(64)],.035,'porcelain',True)
        for mirrored in (False,True):
            for step in range(3):
                t=3-step
                a=(37,126);b=(60,138);v=(-3,5)
                points=[(p[0]+k*v[0],p[1]+k*v[1]) for p,k in [(a,t),(b,t),(b,t-1),(a,t-1)]]
                if mirrored:points=[(192-x,y) for x,y in reversed(points)]
                d.slab('ring-access-step',points,.01,.13+step*.13,'porcelain',.015)
        # Each rope is partitioned at numeric cell-window intersections. Any
        # uncovered span remains fixed core geometry, not a missing/extra OPM.
        order=[1,2,3,4,7,8,0,5,6,9]
        cells=[(i,field['objects'][i]) for i in order]
        chain=[]
        for level,z in enumerate((.9,1.35,1.8)):
            for side,(a,b) in enumerate(zip(deck,deck[1:]+deck[:1])):
                shift=z*d.UNIT*d.C
                aa=(a[0],a[1]-shift);bb=(b[0],b[1]-shift)
                pieces=partition_segment(aa,bb,cells,margin=1.1)
                for piece in pieces:
                    owner=piece['owner'];d.LAYER='base' if owner is None else 'decor'
                    obj=d.curve('ring-rope-%d-%d'%(level,side),[screen(*piece['a'],z),screen(*piece['b'],z)],.028,'porcelain' if level!=1 else 'blue')
                    if owner is not None:
                        obj['sourceObjectOrdinal']=owner;obj['sourceAnchorNative']=field['objects'][owner]['placement']
                chain.append({'level':level,'side':side,'z':z,'pieces':pieces})
        bpy.context.scene['ringRopePartition']=__import__('json').dumps(chain)
    for record in field['objects']:
        d.LAYER='decor';before=set(bpy.context.scene.objects)
        x,y=record['placement'];seq=record['sequenceId'];ordinal=record['order']
        if fid=='field_cm03_01':
            p=d.world(x,y-3)
            if seq==2:
                p=d.world(x,y-1)
                d.box('training-cone-foot',p+Vector((0,0,.035)),(.40,.40,.07),'navy',.035)
                bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.18,radius2=.035,depth=.65,location=p+Vector((0,0,.37)))
                d.finish(bpy.context.object,'training-cone','training-red',.01)
                d.cylinder('cone-reflective-band',p+Vector((0,0,.34)),.13,.10,'line');role='training-cone'
            elif seq==1:
                d.box('high-jump-mat',p+Vector((0,0,.20)),(1.22,1.05,.40),'blue',.12)
                for dx in (-.7,.7):d.beam('jump-standard',p+Vector((dx,.25,0)),p+Vector((dx,.25,1.20)),.065,.065,'silver')
                d.beam('high-jump-bar',p+Vector((-.7,.25,1.00)),p+Vector((.7,.25,1.00)),.045,.045,'porcelain')
                role='high-jump-mat-and-bar'
            else:
                for i in range(3):
                    q=p+Vector(((i-1)*.42,0,0))
                    for yy in (-.38,.38):d.beam('folded-hurdle-leg',q+Vector((0,yy,0)),q+Vector((0,yy,.90)),.06,.06,'silver')
                    d.beam('folded-hurdle-crossbar',q+Vector((0,-.4,.92)),q+Vector((0,.4,.92)),.12,.12,'medical-teal')
                role='folded-hurdle-rack'
        elif fid=='field_cm04_01':
            bx,by,w,h=placed_cell_bounds(record)
            if seq in (0,1):
                # Tall narrow source cells: wall-side banner and structural post.
                p=screen(bx+(12.5 if seq==0 else 8),by+56,0)
                d.box('dojo-wall-post',p+Vector((0,0,2.1)),(.28,.28,4.2),'wood',.025)
                if seq==0:
                    def banner_point(xx,yy):return screen(xx,yy,(by+56-yy)/(d.UNIT*d.C))
                    mesh=bpy.data.meshes.new('dojo-banner')
                    mesh.from_pydata([banner_point(xx,yy) for xx,yy in [(bx+3,by+17),(bx+12,by+17),(bx+12,by+46),(bx+3,by+46)]],[],[(0,1,2,3)])
                    mesh.update();obj=bpy.data.objects.new('dojo-banner',mesh);bpy.context.collection.objects.link(obj)
                    d.finish(obj,'dojo-banner','porcelain')
                    # Abstract bars, not copied characters or a raster label.
                    for yy in (by+23,by+30,by+37):d.curve('dojo-banner-mark',[banner_point(bx+5,yy),banner_point(bx+10,yy)],.045,'navy')
                role='dojo-banner-post' if seq==0 else 'dojo-timber-post'
            else:
                for i in range(9):
                    p=screen(bx+4+i*6,by+28+i*2.5,0)
                    d.box('dojo-rear-screen-slat',p+Vector((0,0,1)),(.28,.28,2),'wood',.025)
                role='dojo-wood-screen'
        else:
            if ordinal in (0,5,6,9):
                px,py={0:(17,116),5:(174,116),6:(96,76),9:(96,156)}[ordinal]
                p=d.world(px,py)
                d.box('ring-corner-post',p+Vector((0,0,1.10)),(.20,.20,2.2),'navy',.04)
                for z in (.9,1.35,1.8):d.box('ring-corner-pad',p+Vector((0,0,z)),(.27,.27,.22),'training-red' if ordinal in (0,9) else 'blue',.06)
            if seq==0:
                bx,by,w,h=placed_cell_bounds(record)
                for i in range(3):
                    p=screen(bx+8+i*13,by+20,.45)
                    d.beam('ring-light-yoke',screen(bx+8+i*13,by+12,.45),p,.05,.05,'silver')
                    d.cylinder('ring-rear-light',p,.22,.38,'navy',(0,-1,0))
                    d.sphere('ring-light-lens',p+Vector((0,-.20,0)),(.16,.03,.16),'line')
                d.curve('ring-light-bar',[screen(bx+6,by+12,.45),screen(bx+39,by+12,.45)],.06,'silver')
                role='ring-light-rack'
            else:role='ring-corner-and-ropes' if ordinal in (0,5,6,9) else 'ring-rope-section'
        tag_new(before,record)
        anchors.append({'sourceOrdinal':ordinal,'sequenceId':seq,'anchorNative':[x,y],
                        'role':role,'geometryStatus':'ORIGINAL_MESH_DRAFT_NOT_PIXEL_REPRODUCTION'})
    return anchors
