"""Original modular industrial cage family; numeric windows remain authoritative."""
import json
import math

FIELDS=('field_cm15_01','field_cm23_01')
SURFACES={'field_cm15_01':'factory-floor','field_cm23_01':'gas-floor'}


def prepare(d,_cell_id):
    colors={'factory-floor':(.30,.27,.22),'gas-floor':(.12,.15,.16),
            'ind-white':(.80,.82,.77),'ind-hi':(.95,.91,.78),'ind-navy':(.035,.055,.09),
            'ind-metal':(.25,.26,.24),'ind-dark':(.075,.085,.08),'ind-cyan':(.05,.90,.95),
            'ind-amber':(.98,.37,.02),'ind-yellow':(.96,.69,.04),'ind-coral':(.75,.07,.025),
            'ind-toxic':(.08,.86,.22)}
    for name,color in colors.items():
        if name not in d.M:d.material(name,color,.48 if name in ('ind-white','ind-hi') else .74,
            emission=.7 if name in ('ind-cyan','ind-amber','ind-toxic') else 0)


def inset_objects(d,objects,cx,cy,factor):
    """Inset presentation geometry without rewriting source OPM anchors."""
    center=d.world(cx,cy,0)
    for obj in objects:
        obj.location.x=center.x+(obj.location.x-center.x)*factor
        obj.location.y=center.y+(obj.location.y-center.y)*factor
        obj.scale.x*=factor
        obj.scale.y*=factor


def point_in_polygon(point,polygon):
    x,y=point;inside=False
    for i,(x1,y1) in enumerate(polygon):
        x2,y2=polygon[(i+1)%len(polygon)]
        if (y1>y)!=(y2>y):
            cross=x1+(y-y1)*(x2-x1)/(y2-y1)
            if x<cross:inside=not inside
    return inside


def inset_polygon(polygon,factor=.70):
    cx=sum(p[0] for p in polygon)/len(polygon);cy=sum(p[1] for p in polygon)/len(polygon)
    return [(cx+(x-cx)*factor,cy+(y-cy)*factor) for x,y in polygon]


def rect(d,name,x,y,w,h,mat,z=.01,depth=.035,bevel=.008):
    return d.slab(name,[(x,y),(x+w,y),(x+w,y+h),(x,y+h)],z,z+depth,mat,bevel)


def ngon(d,name,cx,cy,rx,ry,mat,z=.01,depth=.035,n=10,bevel=.008):
    pts=[(cx+math.cos(i*math.tau/n)*rx,cy+math.sin(i*math.tau/n)*ry) for i in range(n)]
    return d.slab(name,pts,z,z+depth,mat,bevel)


def fan_module(d,name,cx,cy,r):
    ngon(d,name+'-housing',cx,cy,r,r,'ind-white',.048,.036,10,.012)
    ngon(d,name+'-well',cx,cy,r*.70,r*.70,'ind-navy',.086,.014,10,.006)
    for i in range(4):
        angle=i*math.tau/4
        segment(d,name+'-blade',(cx,cy),(cx+math.cos(angle)*r*.53,cy+math.sin(angle)*r*.53),max(1.1,r*.18),'ind-metal',.104)
    ngon(d,name+'-hub',cx,cy,r*.18,r*.18,'ind-cyan',.122,.012,8,.003)


def service_cabinet(d,name,x,y,w,h,accent='ind-cyan'):
    rect(d,name+'-body',x,y,w,h,'ind-white',.012,.048,.012)
    rect(d,name+'-recess',x+w*.12,y+h*.14,w*.76,h*.46,'ind-navy',.063,.012,.005)
    for i in range(3):
        rect(d,name+'-vent',x+w*(.18+i*.23),y+h*.67,w*.11,h*.18,'ind-metal',.079,.008,.002)
    rect(d,name+'-status',x+w*.67,y+h*.08,w*.18,h*.08,accent,.079,.008,.002)


def segment(d,name,a,b,width,mat,z=.05):
    x1,y1=a;x2,y2=b;dx=x2-x1;dy=y2-y1;length=max(.001,math.hypot(dx,dy));nx=-dy/length*width/2;ny=dx/length*width/2
    return d.slab(name,[(x1+nx,y1+ny),(x2+nx,y2+ny),(x2-nx,y2-ny),(x1-nx,y1-ny)],z,z+.035,mat,.006)


def console(d,x,y,w,h,phase=0,name='industrial-console'):
    rect(d,name+'-body',x,y,w,h,'ind-white',.01,.05,.014)
    rect(d,name+'-face',x+w*.13,y+h*.16,w*.74,h*.48,'ind-navy',.063,.012,.006)
    for i in range(3):
        rect(d,name+'-lamp',x+w*(.22+i*.2),y+h*(.28+(phase+i)%2*.09),w*.1,h*.07,
             'ind-amber' if i==phase%3 else 'ind-cyan',.078,.008,.003)


def conveyor(d,x,y,w,h,phase=0,name='conveyor-cell'):
    rect(d,name+'-frame',x+w*.07,y+h*.03,w*.86,h*.94,'ind-white',.008,.045,.012)
    rect(d,name+'-belt',x+w*.18,y+h*.06,w*.64,h*.88,'ind-dark',.055,.012,.006)
    for i in range(3):
        yy=y+h*(.16+((i+phase)%4)*.19)
        rect(d,name+'-moving-slat',x+w*.24,yy,w*.52,h*.075,
             'ind-cyan' if (i+phase)%3==0 else 'ind-metal',.069,.007,.002)


def robot_arm(d,x,y,w,h,phase=0,name='robot-arm'):
    rect(d,name+'-base',x+w*.08,y+h*.70,w*.32,h*.22,'ind-white',.008,.05,.014)
    cx=x+w*.25;cy=y+h*.73
    angles=(-1.00,-.62,-.26,.14,.48,.79,1.02)
    a=angles[phase%len(angles)];joint=(cx+math.cos(a)*w*.20,cy-math.sin(a)*h*.22)
    tip=(joint[0]+math.cos(a*.63)*w*.20,joint[1]-math.sin(a*.63)*h*.18)
    segment(d,name+'-lower',(cx,cy),joint,max(1.3,w*.075),'ind-hi')
    segment(d,name+'-upper',joint,tip,max(1.1,w*.06),'ind-yellow',.09)
    rect(d,name+'-tool',tip[0]-w*.06,tip[1]-h*.07,w*.12,h*.14,'ind-metal',.105,.025,.006)


def scrubber(d,x,y,w,h,phase=0,name='gas-scrubber'):
    ngon(d,name+'-body',x+w*.50,y+h*.50,w*.47,h*.44,'ind-white',.008,.05,10,.014)
    ngon(d,name+'-intake',x+w*.50,y+h*.48,w*.38,h*.31,'ind-navy',.06,.014,10,.01)
    for i in range(5):
        pos=(i+phase)%5
        rect(d,name+'-baffle',x+w*(.18+pos*.13),y+h*.24,w*.055,h*.47,
             'ind-cyan' if i==0 else 'ind-metal',.077,.008,.002)
    rect(d,name+'-status',x+w*.33,y+h*.81,w*.34,h*.07,'ind-amber' if phase>=6 else 'ind-cyan',.078,.007,.002)


def mast(d,x,y,w,h,name='pipe-mast'):
    rect(d,name+'-column',x+w*.31,y+h*.03,w*.38,h*.94,'ind-metal',.01,.046,.008)
    rect(d,name+'-cap',x+w*.15,y+h*.02,w*.70,h*.12,'ind-white',.058,.02,.006)
    rect(d,name+'-base',x+w*.12,y+h*.82,w*.76,h*.15,'ind-white',.058,.02,.006)


def sealed_tank(d,name,cx,cy,rx,ry,phase=0):
    """Large paired-shell tank that still reads at configuration-page scale."""
    ngon(d,name+'-shell',cx,cy,rx,ry,'ind-white',.02,.055,12,.014)
    ngon(d,name+'-window',cx,cy,rx*.63,ry*.62,'ind-navy',.078,.014,12,.008)
    rect(d,name+'-toxic-level',cx-rx*.45,cy-ry*.08,rx*.90,ry*.38,
         'ind-toxic' if phase%2==0 else 'ind-cyan',.094,.009,.004)
    rect(d,name+'-seal-band',cx-rx*.72,cy-ry*.70,rx*1.44,ry*.16,'ind-coral',.102,.009,.003)


def production_press(d,x,y,w,h):
    """One dominant factory landmark: press head feeding a short conveyor."""
    rect(d,'factory-press-plinth',x+w*.05,y+h*.64,w*.90,h*.24,'ind-metal',.012,.05,.014)
    rect(d,'factory-press-body',x+w*.15,y+h*.08,w*.70,h*.58,'ind-white',.025,.065,.018)
    rect(d,'factory-press-throat',x+w*.29,y+h*.23,w*.42,h*.28,'ind-navy',.092,.014,.007)
    rect(d,'factory-press-head',x+w*.39,y+h*.30,w*.22,h*.35,'ind-yellow',.109,.018,.006)
    rect(d,'factory-feed-belt',x-w*.34,y+h*.72,w*.78,h*.17,'ind-dark',.071,.018,.006)
    for i in range(3):
        rect(d,'factory-feed-slat',x-w*(.27-i*.22),y+h*.75,w*.08,h*.11,
             'ind-cyan' if i==1 else 'ind-metal',.091,.007,.002)


def factory_core(d):
    # Keep the rear service wall in the broad left cell; the old five-module
    # strip projected through the field's upper-right void.
    rect(d,'factory-service-rail',12,31,70,7,'ind-metal',.006,.035,.01)
    service_cabinet(d,'factory-wall-module-a',13,43,31,21,'ind-cyan')
    service_cabinet(d,'factory-wall-module-b',48,47,31,21,'ind-amber')
    fan_module(d,'factory-extraction-fan',68,79,10)
    segment(d,'factory-duct-a',(17,73),(59,73),5,'ind-metal',.045)
    production_press(d,101,112,50,43)
    rect(d,'factory-safe-lane',53,167,125,5,'ind-yellow',.006,.01,.003)


def gas_core(d):
    rect(d,'gas-room-rear-deck',10,30,86,14,'ind-metal',.006,.04,.01)
    service_cabinet(d,'gas-filter-console',16,20,34,43,'ind-amber')
    sealed_tank(d,'gas-sealed-tank-a',70,57,19,28,0)
    sealed_tank(d,'gas-sealed-tank-b',103,124,17,25,1)
    segment(d,'gas-pipe-header',(25,89),(104,89),6,'ind-coral',.045)
    segment(d,'gas-pipe-drop',(70,82),(70,89),5,'ind-white',.081)
    # Keep the lower-cell safety marking inside the native hex shoulders.  The
    # old 37..123 span left a visible amber sliver beyond the cell at y=170.
    rect(d,'gas-safe-lane',56,170,72,5,'ind-yellow',.006,.01,.003)


def build(field,d,cell_id):
    import bpy
    fid=field['id'];authored_before=set(bpy.context.scene.objects);d.LAYER='base'
    if fid=='field_cm15_01':factory_core(d)
    elif fid=='field_cm23_01':gas_core(d)
    else:raise ValueError('UNSUPPORTED_INDUSTRIAL_FIELD')
    factors={'field_cm15_01':1.0,'field_cm23_01':.76}
    width,height=field['nativeSize']
    core_objects=set(bpy.context.scene.objects)-authored_before
    inset_objects(d,core_objects,width/2,height/2,factors[fid])
    anchors=[]
    for record in field['objects']:
        d.LAYER='decor';before=set(bpy.context.scene.objects);x,y,w,h=d.placed_cell_bounds(record);seq=record['sequenceId']
        if fid=='field_cm15_01':
            if seq in (2,5):conveyor(d,x+1,y+1,w-2,h-2,max(0,cell_id-(6 if seq==2 else 12)),'moving-conveyor');role='conveyor-cell'
            elif seq==0:robot_arm(d,x+4,y+4,w-8,h-8,cell_id,'assembly-arm-a');role='assembly-arm'
            elif seq==1:robot_arm(d,x+4,y+4,w-8,h-8,cell_id-3,'assembly-arm-b');role='assembly-arm'
            elif seq==3:mast(d,x+1,y+1,w-2,h-2,'short-safety-post');role='safety-post'
            else:mast(d,x+2,y+2,w-4,h-4,'tall-safety-post');role='safety-post'
        else:
            if seq==4:scrubber(d,x+2,y+2,w-4,h-4,max(0,cell_id-4),'animated-gas-scrubber');role='gas-scrubber'
            elif seq==0:console(d,x+2,y+1,w-4,h-2,0,'horizontal-gas-console');role='gas-console'
            elif seq==1:mast(d,x+1,y+2,w-2,h-4,'gas-sensor-mast');role='sensor-mast'
            elif seq==2:console(d,x+3,y+1,w-6,h-2,1,'lower-vent-bank');role='vent-bank'
            else:rect(d,'gas-warning-beacon',x+1,y+1,w-2,h-2,'ind-amber',.03,.05,.008);role='warning-beacon'
        record_objects=set(bpy.context.scene.objects)-before
        inset_objects(d,record_objects,x+w/2,y+h/2,.82)
        suppress_in_full=not point_in_polygon((x+w/2,y+h/2),inset_polygon(field['outlineNative']))
        for obj in record_objects:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement']
            obj['objectSequenceId']=seq;obj['sourceCellId']=cell_id
            obj['fullFrameSuppressedOutsideFootprint']=suppress_in_full
            obj.hide_render=suppress_in_full
        anchors.append({'sourceOrdinal':record['order'],'role':role,'anchorNative':record['placement']})
    # The source placements and animation cell bank remain untouched. Only the
    # rendered meshes are inset to keep every prop inside the irregular union.
    feature_by_field={
        'field_cm15_01':['dominant-production-press','short-conveyor','yellow-robot-arms'],
        'field_cm23_01':['paired-sealed-tanks','toxic-level-windows','red-scrubber-pipework'],
    }
    d.LAYER='base';bpy.context.scene['natureFeatures']=json.dumps(['numeric-native-hex-union','original-modular-industrial-family','independent-opm-cell-bank','visual-geometry-inset-v1','outside-anchor-full-frame-suppression-v1',*feature_by_field[fid]])
    return anchors
