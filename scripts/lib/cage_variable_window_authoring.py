"""Original hot-spring and power-plant props with per-frame OPM windows."""
import json,math
FIELDS=('field_cm19_01','field_cm22_01')
SURFACES={'field_cm19_01':'spring-floor','field_cm22_01':'power-floor'}

def prepare(d,_cell_id):
    colors={'spring-floor':(.24,.42,.32),'power-floor':(.25,.32,.27),'spring-water':(.08,.48,.62),
            'spring-foam':(.62,.92,.83),'spring-stone':(.25,.31,.30),'spring-wood':(.42,.22,.08),
            'power-metal':(.38,.42,.38),'power-dark':(.07,.11,.13),'power-red':(.72,.06,.035),
            'power-cyan':(.08,.92,1.0),'power-yellow':(.98,.72,.04),'power-white':(.85,.87,.80)}
    for name,color in colors.items():
        if name not in d.M:d.material(name,color,.55 if name in ('spring-foam','power-white') else .78,
            emission=.9 if name in ('power-cyan','power-yellow','spring-foam') else 0)

def rect(d,name,x,y,w,h,mat,z=.01,depth=.035,bevel=.01):
    return d.slab(name,[(x,y),(x+w,y),(x+w,y+h),(x,y+h)],z,z+depth,mat,bevel)
def ngon(d,name,cx,cy,rx,ry,mat,z=.02,depth=.03,n=8):
    pts=[(cx+math.cos(i*math.tau/n)*rx,cy+math.sin(i*math.tau/n)*ry) for i in range(n)]
    return d.slab(name,pts,z,z+depth,mat,.007)

def spring_fixture(d,x,y,w,h,phase=0,name='spring-fixture'):
    rect(d,name+'-stone',x+w*.04,y+h*.12,w*.92,h*.76,'spring-stone',.01,.045,.015)
    rect(d,name+'-water',x+w*.14,y+h*.24,w*.72,h*.46,'spring-water',.062,.016,.012)
    for i in range(3):
        px=.28+((i*29+phase*13)%47)/100;py=.35+((i*17+phase*7)%26)/100
        ngon(d,name+'-bubble',x+w*px,y+h*py,w*.055,h*.07,'spring-foam',.085,.012,7)

def spring_accessory(d,x,y,w,h,kind=0,name='spring-accessory'):
    if kind%3==0:
        rect(d,name+'-deck',x+w*.05,y+h*.22,w*.90,h*.62,'spring-wood',.01,.05,.012)
        for i in range(3):rect(d,name+'-slat',x+w*(.16+i*.25),y+h*.28,w*.10,h*.48,'spring-stone',.065,.012,.004)
    elif kind%3==1:
        rect(d,name+'-base',x+w*.10,y+h*.62,w*.80,h*.25,'spring-stone',.01,.05,.012)
        rect(d,name+'-spout',x+w*.40,y+h*.12,w*.20,h*.58,'spring-wood',.065,.04,.01)
    else:
        ngon(d,name+'-rock',x+w*.50,y+h*.54,w*.42,h*.34,'spring-stone',.01,.075,7)

def steam_window(d,x,y,w,h,phase=0,name='spring-steam'):
    # This object intentionally scales to the numeric per-frame window. The
    # tiny frame remains a small bubble instead of being padded to the large one.
    if w<=12 or h<=12:
        ngon(d,name+'-bubble',x+w*.5,y+h*.5,w*.34,h*.34,'spring-foam',.04,.025,8);return
    for i in range(7):
        px=.10+((i*17+phase*9)%79)/100;py=.22+((i*29+phase*5)%57)/100
        ngon(d,name+'-cloud',x+w*px,y+h*py,w*(.08+(i%3)*.018),h*(.12+(i%2)*.025),'spring-foam',.045+i*.003,.018,8)

def power_fixture(d,x,y,w,h,kind=0,name='power-fixture'):
    # Numeric source windows remain authoritative, but the authored machinery
    # intentionally leaves breathing room inside them so dense cm22 anchors do
    # not collapse into one unreadable pile in the full cage view.
    x+=w*.15;y+=h*.09;w*=.70;h*=.82
    ngon(d,name+'-base',x+w*.50,y+h*.77,w*.45,h*.17,'power-dark',.01,.05,8)
    if kind%2==0:
        ngon(d,name+'-tower',x+w*.50,y+h*.43,w*.17,h*.35,'power-metal',.065,.055,8)
        for py in (.22,.42,.60):
            ngon(d,name+'-crossbar',x+w*.50,y+h*py,w*.34,h*.075,'power-white',.122,.022,8)
        ngon(d,name+'-core',x+w*.50,y+h*.40,w*.075,h*.19,'power-cyan',.148,.018,8)
    else:
        ngon(d,name+'-cabinet',x+w*.50,y+h*.45,w*.39,h*.32,'power-white',.065,.05,8)
        rect(d,name+'-panel',x+w*.25,y+h*.28,w*.50,h*.26,'power-dark',.12,.014,.006)
        rect(d,name+'-meter',x+w*.34,y+h*.34,w*.13,h*.10,'power-cyan',.138,.009,.003)
        rect(d,name+'-meter',x+w*.53,y+h*.34,w*.13,h*.10,'power-yellow',.138,.009,.003)

def power_pulse(d,x,y,w,h,phase=0,name='power-pulse'):
    if w<=20 or h<=20:
        ngon(d,name+'-spark',x+w*.5,y+h*.5,w*.36,h*.36,'power-cyan',.05,.025,6);return
    x+=w*.19;y+=h*.08;w*=.62;h*=.84
    ngon(d,name+'-coil-base',x+w*.50,y+h*.83,w*.42,h*.11,'power-metal',.01,.05,8)
    for i in range(4):
        px=.22+i*.18;offset=((phase+i)%3-1)*.05
        ngon(d,name+'-arc',x+w*(px+offset),y+h*.46,w*.045,h*.34,
             'power-cyan' if (i+phase)%2==0 else 'power-yellow',.07+i*.008,.018,8)
    ngon(d,name+'-coil-cap',x+w*.50,y+h*.15,w*.25,h*.08,'power-white',.112,.024,8)

def core(fid,d):
    if fid=='field_cm19_01':
        rect(d,'spring-central-pool',108,28,168,62,'spring-water',.008,.022,.018)
        rect(d,'spring-boardwalk',22,83,340,10,'spring-wood',.008,.025,.008)
    else:
        rect(d,'power-service-grid',18,88,156,8,'power-metal',.008,.024,.008)
        for i in range(4):
            rect(d,'power-reactor-cabinet',24+i*37,27,30,27,'power-white',.008,.045,.01)
            rect(d,'power-reactor-panel',29+i*37,33,20,11,'power-dark',.055,.012,.004)
            rect(d,'power-reactor-status',35+i*37,47,8,3,'power-red' if i%2==0 else 'power-cyan',.07,.007,.002)
        rect(d,'power-cable-spine',20,62,151,7,'power-red',.008,.028,.006)

def build(field,d,cell_id):
    import bpy
    fid=field['id'];d.LAYER='base';core(fid,d);anchors=[]
    for record in field['objects']:
        d.LAYER='decor';before=set(bpy.context.scene.objects);x,y,w,h=d.placed_cell_bounds(record);seq=record['sequenceId']
        pad=max(.6,min(w,h)*.055);x+=pad;y+=pad;w-=2*pad;h-=2*pad
        if fid=='field_cm19_01':
            if seq==11:steam_window(d,x,y,w,h,cell_id,'variable-spring-steam');role='variable-steam-window'
            elif seq==5:spring_fixture(d,x,y,w,h,cell_id-5,'animated-spring-fixture');role='spring-fixture'
            else:spring_accessory(d,x,y,w,h,seq,'spring-accessory');role='spring-accessory'
        else:
            if seq in (5,6,7,8):power_pulse(d,x,y,w,h,cell_id,'variable-power-pulse');role='variable-power-pulse'
            else:power_fixture(d,x,y,w,h,seq,'power-fixture');role='power-fixture'
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement'];obj['objectSequenceId']=seq;obj['sourceCellId']=cell_id
        anchors.append({'sourceOrdinal':record['order'],'role':role,'anchorNative':record['placement']})
    d.LAYER='base';bpy.context.scene['natureFeatures']=json.dumps(['numeric-native-hex-union','per-frame-opm-window','independent-variable-cell-bank'])
    return anchors
