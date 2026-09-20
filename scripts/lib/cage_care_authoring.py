"""Original care/laboratory prop family for offline cage cell-bank rendering.

The geometry uses only numeric object windows and original functional roles.
No research raster is loaded, traced, sampled, or used as a texture.
"""
import json
import math
from pathlib import Path


FIELDS=('field_cm17_01','field_cm06_01')
SURFACES={'field_cm17_01':'care-floor','field_cm06_01':'lab-floor'}


def prepare(d, _cell_id):
    colors={
        'care-floor':(.52,.72,.82),'lab-floor':(.23,.39,.42),
        'care-white':(.82,.86,.84),'care-white-hi':(.96,.97,.93),
        'care-navy':(.035,.07,.14),'care-teal':(.06,.52,.58),
        'care-cyan':(.12,.91,1.0),'care-amber':(.98,.37,.035),
        'care-green':(.20,.86,.22),'care-glass':(.25,.74,.66),
        'care-metal':(.25,.28,.29),'care-cushion':(.06,.35,.44),
    }
    for name,color in colors.items():
        if name not in d.M:
            d.material(name,color,.42 if name in ('care-white','care-white-hi') else .72,
                       emission=.55 if name in ('care-cyan','care-green','care-amber') else 0)


def _inset_objects(d,objects,cx,cy,factor):
    """Inset presentation meshes while keeping numeric source anchors intact."""
    center=d.world(cx,cy,0)
    for obj in objects:
        obj.location.x=center.x+(obj.location.x-center.x)*factor
        obj.location.y=center.y+(obj.location.y-center.y)*factor
        obj.scale.x*=factor
        obj.scale.y*=factor


def _point_in_polygon(point,polygon):
    x,y=point;inside=False
    for i,(x1,y1) in enumerate(polygon):
        x2,y2=polygon[(i+1)%len(polygon)]
        if (y1>y)!=(y2>y):
            cross=x1+(y-y1)*(x2-x1)/(y2-y1)
            if x<cross:inside=not inside
    return inside


def _inset_polygon(polygon,factor=.70):
    cx=sum(p[0] for p in polygon)/len(polygon);cy=sum(p[1] for p in polygon)/len(polygon)
    return [(cx+(x-cx)*factor,cy+(y-cy)*factor) for x,y in polygon]


def _rect(d,name,x,y,w,h,mat,z=.01,depth=.035,bevel=.012):
    return d.slab(name,[(x,y),(x+w,y),(x+w,y+h),(x,y+h)],z,z+depth,mat,bevel)


def _ngon(d,name,cx,cy,rx,ry,mat,z=.01,depth=.035,n=8,bevel=.01):
    points=[(cx+math.cos(i*math.tau/n)*rx,cy+math.sin(i*math.tau/n)*ry) for i in range(n)]
    return d.slab(name,points,z,z+depth,mat,bevel)


def _floor_panel(d,name,x,y,w,h,accent='care-teal'):
    # Low nested plates break up the large flat floor without claiming any
    # collision or walkability authority.
    _rect(d,name+'-frame',x,y,w,h,'care-white',.004,.009,.008)
    _rect(d,name+'-inset',x+w*.05,y+h*.08,w*.90,h*.84,'care-navy',.013,.005,.005)
    _rect(d,name+'-accent',x+w*.14,y+h*.42,w*.72,max(1.2,h*.08),accent,.019,.004,.002)


def _indicator(d,x,y,w,h,mat='care-cyan',name='equipment-indicator'):
    return _rect(d,name,x,y,w,h,mat,.051,.012,.004)


def _frame(d,name,x,y,w,h,mat='care-white'):
    edge=max(.75,min(w,h)*.09)
    _rect(d,name+'-top',x,y,w,edge,mat,.025,.045)
    _rect(d,name+'-bottom',x,y+h-edge,w,edge,mat,.025,.045)
    _rect(d,name+'-left',x,y,edge,h,mat,.025,.045)
    _rect(d,name+'-right',x+w-edge,y,edge,h,mat,.025,.045)


def _console(d,x,y,w,h,phase=0,name='status-console'):
    _rect(d,name+'-plinth',x+w*.08,y+h*.72,w*.84,h*.22,'care-metal',.008,.036,.012)
    _rect(d,name+'-body',x,y,w,h*.82,'care-white',.015,.055,.018)
    _rect(d,name+'-recess',x+w*.12,y+h*.12,w*.76,h*.50,'care-navy',.058,.014,.006)
    _rect(d,name+'-screen-hood',x+w*.08,y+h*.05,w*.84,h*.10,'care-teal',.075,.012,.005)
    bars=3
    for i in range(bars):
        lit=(i+phase)%bars
        _indicator(d,x+w*(.20+i*.20),y+h*(.25+lit*.045),w*.11,h*.075,
                   'care-cyan' if i!=phase%bars else 'care-green',name+'-signal')


def _bed(d,x,y,w,h,name='recovery-bed'):
    _rect(d,name+'-floor-shadow',x+w*.02,y+h*.42,w*.96,h*.43,'care-metal',.006,.025,.025)
    _rect(d,name+'-base',x+w*.07,y+h*.31,w*.86,h*.48,'care-white',.032,.055,.025)
    _rect(d,name+'-navy-band',x+w*.10,y+h*.40,w*.80,h*.34,'care-navy',.066,.018,.01)
    _rect(d,name+'-cushion',x+w*.13,y+h*.23,w*.74,h*.36,'care-cushion',.087,.026,.018)
    _rect(d,name+'-headrest',x+w*.16,y+h*.12,w*.28,h*.22,'care-teal',.115,.025,.014)
    _rect(d,name+'-left-rail',x+w*.08,y+h*.28,w*.06,h*.52,'care-white-hi',.105,.025,.008)
    _rect(d,name+'-right-rail',x+w*.86,y+h*.28,w*.06,h*.52,'care-white-hi',.105,.025,.008)


def _pod(d,x,y,w,h,phase=0,name='cultivation-pod'):
    _ngon(d,name+'-shell',x+w*.50,y+h*.50,w*.40,h*.48,'care-white',.012,.05,8,.02)
    _ngon(d,name+'-chamber',x+w*.50,y+h*.45,w*.29,h*.34,'care-navy',.064,.014,8,.012)
    level=(.18,.32,.47,.61,.70)[phase%5]
    _rect(d,name+'-fluid',x+w*.25,y+h*(.74-level*.55),w*.50,h*level*.55,'care-glass',.079,.01,.008)
    _indicator(d,x+w*.31,y+h*.82,w*.38,h*.07,'care-cyan' if phase%2==0 else 'care-green',name+'-status')


def _mast(d,x,y,w,h,phase=0,name='scanner-mast'):
    _rect(d,name+'-stem',x+w*.39,y+h*.15,w*.22,h*.78,'care-metal',.01,.045,.01)
    _rect(d,name+'-head',x+w*.15,y+h*.03,w*.70,h*.28,'care-white',.048,.042,.016)
    _indicator(d,x+w*(.23 if phase%2==0 else .52),y+h*.11,w*.25,h*.08,
               'care-cyan' if phase%2==0 else 'care-amber',name+'-pulse')


def _bench(d,x,y,w,h,phase=0,name='care-bench'):
    _rect(d,name+'-base',x+w*.04,y+h*.40,w*.92,h*.50,'care-white',.01,.05,.018)
    _rect(d,name+'-top',x+w*.02,y+h*.24,w*.96,h*.24,'care-navy',.062,.025,.012)
    for i in range(3):
        _indicator(d,x+w*(.17+i*.22),y+h*(.30+(phase%2)*.025),w*.12,h*.08,
                   'care-green' if i==(phase%3) else 'care-cyan',name+'-light')


def _module(d,x,y,w,h,phase=0,name='utility-module'):
    _ngon(d,name+'-body',x+w*.50,y+h*.50,w*.44,h*.44,'care-white',.012,.052,8,.017)
    _rect(d,name+'-vent',x+w*.20,y+h*.30,w*.60,h*.38,'care-navy',.065,.012,.008)
    for i in range(3):
        _indicator(d,x+w*(.27+i*.17),y+h*(.39+(i+phase)%2*.08),w*.09,h*.05,
                   'care-cyan',name+'-vent-light')


def _hospital_core(d):
    # A new open diagnostic suite: central bed plus a low rear console. These
    # are fixed core geometry, never synthetic OPM entries.
    _bed(d,59,62,69,42,'central-diagnostic-bed')
    _console(d,57,35,35,23,0,'rear-care-console')
    _console(d,98,32,39,24,1,'rear-analysis-console')
    _floor_panel(d,'care-floor-panel-left',28,123,39,23)
    _floor_panel(d,'care-floor-panel-right',119,123,39,23,'care-cyan')
    _rect(d,'care-room-guide-stripe',37,153,115,4,'care-teal',.006,.01,.005)


def _laboratory_core(d):
    # Original new composition: fixed analysis island, wall strip and empty
    # central service lanes. Collision remains owned by existing game data.
    _bench(d,58,128,73,32,0,'central-analysis-island')
    _rect(d,'rear-laboratory-service-rail',160,30,160,7,'care-metal',.008,.03,.008)
    for i in range(4):
        module_x=165+i*38
        _rect(d,'rear-service-cabinet',module_x,34,29,20,'care-white',.008,.045,.009)
        _rect(d,'rear-service-recess',module_x+4,39,21,9,'care-navy',.055,.012,.004)
        _indicator(d,module_x+8,50,13,3,'care-cyan' if i%2==0 else 'care-green','rear-service-light')
    _pod(d,178,45,39,50,2,'fixed-cultivation-pod-a')
    _pod(d,266,45,39,50,4,'fixed-cultivation-pod-b')
    _floor_panel(d,'laboratory-floor-panel-a',25,129,42,22)
    _floor_panel(d,'laboratory-floor-panel-b',105,129,42,22,'care-green')
    _rect(d,'laboratory-safe-lane',34,164,109,4,'care-teal',.006,.01,.005)


def build(field,d,cell_id):
    import bpy
    fid=field['id'];authored_before=set(bpy.context.scene.objects);d.LAYER='base'
    if fid=='field_cm17_01':_hospital_core(d)
    elif fid=='field_cm06_01':_laboratory_core(d)
    else:raise ValueError('UNSUPPORTED_CARE_FIELD')
    factors={'field_cm06_01':1.0,'field_cm17_01':1.0}
    width,height=field['nativeSize']
    core_objects=set(bpy.context.scene.objects)-authored_before
    _inset_objects(d,core_objects,width/2,height/2,factors[fid])
    anchors=[]
    for record in field['objects']:
        d.LAYER='decor';before=set(bpy.context.scene.objects)
        x,y,w,h=d.placed_cell_bounds(record);seq=record['sequenceId']
        if fid=='field_cm17_01':
            if seq==0:_mast(d,x+1,y+1,w-2,h-2,cell_id,'mobile-vital-mast');role='vital-mast'
            elif seq==1:_console(d,x+3,y+1,w-6,h-2,0,'overhead-diagnostic-rail');role='diagnostic-rail'
            elif seq==2:_bench(d,x+2,y+2,w-4,h-4,cell_id,'care-service-bank');role='service-bank'
            else:_rect(d,'service-bank-plinth',x+2,y+3,w-4,h-5,'care-metal',.012,.052,.014);role='service-plinth'
        else:
            if seq==0:_bench(d,x+2,y+4,w-4,h-7,0,'mobile-lab-workstation');role='lab-workstation'
            elif seq==1:_bench(d,x+2,y+2,w-4,h-4,0,'wall-lab-bench');role='lab-bench'
            elif seq==2:_mast(d,x+2,y+2,w-4,h-4,cell_id,'ceiling-sample-indicator');role='sample-indicator'
            elif seq==3:_console(d,x+2,y+2,w-4,h-4,cell_id,'portable-analysis-console');role='analysis-console'
            elif seq==4:_module(d,x+2,y+2,w-4,h-4,0,'sealed-utility-module');role='utility-module'
            elif seq==5:_module(d,x+2,y+2,w-4,h-4,0,'compact-sample-module');role='sample-module'
            else:_pod(d,x+2,y+2,w-4,h-4,max(0,cell_id-8),'cultivation-pod');role='cultivation-pod'
        record_objects=set(bpy.context.scene.objects)-before
        _inset_objects(d,record_objects,x+w/2,y+h/2,.82)
        suppress_in_full=not _point_in_polygon((x+w/2,y+h/2),_inset_polygon(field['outlineNative']))
        for obj in record_objects:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement']
            obj['objectSequenceId']=seq;obj['sourceCellId']=cell_id
            obj['fullFrameSuppressedOutsideFootprint']=suppress_in_full
            obj.hide_render=suppress_in_full
        anchors.append({'sourceOrdinal':record['order'],'role':role,'anchorNative':record['placement']})
    feature_by_field={
        'field_cm06_01':['paired-cultivation-pods','large-analysis-island','cyan-sample-indicators'],
        'field_cm17_01':['central-hospital-bed','paired-medical-monitors','open-diagnostic-suite'],
    }
    d.LAYER='base'
    bpy.context.scene['natureFeatures']=json.dumps(['numeric-native-hex-union','original-care-equipment-family','independent-opm-cell-bank','visual-geometry-inset-v1','outside-anchor-full-frame-suppression-v1',*feature_by_field[fid]])
    return anchors
