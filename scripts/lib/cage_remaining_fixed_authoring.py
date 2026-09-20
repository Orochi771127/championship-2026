"""Original modular authoring for the remaining fixed-window OPM cage fields.

Research overlays were used only to identify broad functional roles. They are
never loaded, traced, sampled, or used as textures by this module.
"""
import json,math

FIELDS=('field_cm13_01','field_cm14_01','field_cm18_01','field_cm24_01','field_cm25_01','field_cm26_01')
SURFACES={
    'field_cm13_01':'sanctum-floor','field_cm14_01':'memorial-floor','field_cm18_01':'garden-floor',
    'field_cm24_01':'temple-floor','field_cm25_01':'zoo-floor','field_cm26_01':'ranch-floor'}

def prepare(d,_cell_id):
    colors={
        'sanctum-floor':(.18,.38,.34),'memorial-floor':(.12,.23,.22),'garden-floor':(.34,.68,.23),
        'temple-floor':(.32,.22,.12),'zoo-floor':(.43,.58,.35),'ranch-floor':(.40,.67,.22),
        'ivory':(.83,.84,.73),'stone':(.28,.32,.34),'dark-stone':(.09,.13,.17),'wood':(.31,.13,.045),
        'stone-light':(.66,.70,.68),'stone-mid':(.40,.44,.43),'stone-warm':(.52,.39,.28),
        'moss':(.16,.33,.24),'root':(.20,.105,.065),'bronze':(.48,.28,.08),
        'wood-hi':(.61,.34,.11),'leaf':(.12,.46,.16),'grass-hi':(.48,.78,.17),'water':(.05,.46,.71),
        'flower-a':(.98,.71,.10),'flower-b':(.92,.18,.38),'flower-c':(.79,.73,.96),'flame':(1.0,.25,.015),
        'spirit':(.18,.92,.72),'metal':(.18,.20,.19),'hay':(.88,.67,.16),'soil':(.30,.20,.09),
        'white':(.90,.91,.84),'red':(.68,.055,.035),'cyan':(.08,.75,.86)}
    for name,color in colors.items():
        if name not in d.M:d.material(name,color,.55 if name in ('ivory','white') else .79,
            emission=.8 if name in ('flame','spirit','cyan') else 0)

def rect(d,name,x,y,w,h,mat,z=.01,depth=.035,bevel=.01):
    return d.slab(name,[(x,y),(x+w,y),(x+w,y+h),(x,y+h)],z,z+depth,mat,bevel)

def ngon(d,name,cx,cy,rx,ry,mat,z=.02,depth=.035,n=8):
    pts=[(cx+math.cos(i*math.tau/n)*rx,cy+math.sin(i*math.tau/n)*ry) for i in range(n)]
    return d.slab(name,pts,z,z+depth,mat,.008)

def steps(d,name,x,y,w,h,mat='stone-light',levels=4):
    """Low stepped massing: depth without hiding a hex connector edge."""
    step_h=h/levels
    for level in range(levels):
        inset=level*w*.055
        rect(d,f'{name}-{level}',x+inset,y+level*step_h,w-inset*2,step_h+1,mat,
             .012+level*.026,.026,.008)

def low_wall(d,name,x,y,w,h,mat='stone-mid'):
    rect(d,name+'-foot',x,y,w,h,mat,.012,.048,.012)
    rect(d,name+'-cap',x-1,y-1,w+2,max(2,h*.48),'stone-light',.060,.025,.009)

def paving_rhythm(d,name,x,y,w,h,mat='stone-light',count=5):
    gap=max(1,w*.025);tile=(w-gap*(count-1))/count
    for index in range(count):
        rect(d,f'{name}-{index}',x+index*(tile+gap),y,tile,h,mat,.012,.018,.006)

def beam(d,name,x1,y1,x2,y2,width,mat='root',z=.03,depth=.028):
    dx=x2-x1;dy=y2-y1;length=max(.001,math.hypot(dx,dy));px=-dy/length*width*.5;py=dx/length*width*.5
    return d.slab(name,[(x1+px,y1+py),(x2+px,y2+py),(x2-px,y2-py),(x1-px,y1-py)],z,z+depth,mat,.007)

def root_cluster(d,name,cx,cy):
    ngon(d,name+'-stump',cx,cy,10,12,'root',.034,.060,7)
    branches=((cx-10,cy+4,7,5),(cx-18,cy+9,8,4),(cx+10,cy+3,7,5),
              (cx+19,cy+8,9,4),(cx-4,cy-10,5,7),(cx-7,cy-19,4,8))
    for index,(x,y,rx,ry) in enumerate(branches):
        ngon(d,f'{name}-root-{index}',x,y,rx,ry,'root',.030,.035,7)

def temple_gateway(d,x,y,w,h,name='temple-gateway'):
    post_w=w*.14
    rect(d,name+'-left-post',x+w*.12,y+h*.24,post_w,h*.68,'stone-light',.02,.085,.012)
    rect(d,name+'-right-post',x+w*.74,y+h*.24,post_w,h*.68,'stone-light',.02,.085,.012)
    rect(d,name+'-lintel',x+w*.07,y+h*.20,w*.86,h*.16,'red',.10,.045,.012)
    roof=[(x,y+h*.22),(x+w*.18,y+h*.04),(x+w*.82,y+h*.04),(x+w,y+h*.22),(x+w*.86,y+h*.30),(x+w*.14,y+h*.30)]
    d.slab(name+'-roof',roof,.145,.205,'stone-warm',.014)
    rect(d,name+'-opening-shadow',x+w*.34,y+h*.39,w*.32,h*.49,'dark-stone',.018,.025,.006)
    rect(d,name+'-threshold',x+w*.28,y+h*.82,w*.44,h*.10,'bronze',.055,.025,.006)

def shrine_column(d,x,y,w,h,name='sanctum-column'):
    rect(d,name+'-base',x+w*.07,y+h*.72,w*.86,h*.22,'ivory',.01,.05,.014)
    rect(d,name+'-shaft',x+w*.29,y+h*.13,w*.42,h*.67,'ivory',.06,.06,.012)
    rect(d,name+'-cap',x+w*.12,y+h*.04,w*.76,h*.20,'white',.125,.035,.012)

def flame_bowl(d,x,y,w,h,phase=0,name='ritual-flame'):
    rect(d,name+'-plinth',x+w*.12,y+h*.62,w*.76,h*.30,'dark-stone',.01,.05,.012)
    ngon(d,name+'-bowl',x+w*.5,y+h*.57,w*.34,h*.18,'stone',.065,.04)
    sway=(-.10,-.03,.07,.12)[phase%4]
    ngon(d,name+'-light',x+w*(.5+sway),y+h*.32,w*(.18+(phase%2)*.035),h*.25,'flame',.112,.025,6)

def grave_marker(d,x,y,w,h,phase=0,name='memory-marker'):
    rect(d,name+'-base',x+w*.08,y+h*.72,w*.84,h*.20,'dark-stone',.01,.045,.012)
    rect(d,name+'-stele',x+w*.25,y+h*.16,w*.50,h*.62,'stone',.055,.055,.018)
    rect(d,name+'-sigil',x+w*(.39+(phase%2)*.04),y+h*.32,w*.18,h*.17,'spirit',.116,.012,.005)

def wisp(d,x,y,w,h,phase=0,name='memory-wisp'):
    px=(.34,.50,.66,.50)[phase%4];py=(.58,.32,.50,.70)[phase%4]
    ngon(d,name+'-halo',x+w*px,y+h*py,w*.18,h*.18,'spirit',.065,.025,8)
    rect(d,name+'-trail',x+w*(px-.035),y+h*(py+.12),w*.07,h*.26,'spirit',.055,.012,.004)

def flower_patch(d,x,y,w,h,phase=0,name='flower-patch'):
    rect(d,name+'-soil',x+w*.05,y+h*.12,w*.90,h*.76,'soil',.008,.025,.016)
    colors=('flower-a','flower-b','flower-c')
    for i in range(5):
        px=.16+((i*37+phase*11)%71)/100;py=.24+((i*23+phase*7)%55)/100
        ngon(d,name+'-bloom',x+w*px,y+h*py,w*.075,h*.075,colors[(i+phase)%3],.048,.022,6)

def garden_post(d,x,y,w,h,phase=0,name='garden-post'):
    rect(d,name+'-stem',x+w*.43,y+h*.17,w*.14,h*.73,'wood',.01,.045,.008)
    rect(d,name+'-flag',x+w*.50,y+h*(.15+(phase%3)*.025),w*.38,h*.23,
         ('flower-a','flower-b','flower-c')[phase%3],.06,.02,.006)

def altar(d,x,y,w,h,phase=0,name='temple-altar'):
    rect(d,name+'-deck',x+w*.06,y+h*.46,w*.88,h*.40,'wood',.01,.055,.016)
    rect(d,name+'-cloth',x+w*.28,y+h*.39,w*.44,h*.32,'red',.07,.018,.008)
    for i in range(2):
        rect(d,name+'-candle',x+w*(.20+i*.60),y+h*.24,w*.09,h*.25,'ivory',.065,.025,.005)
        ngon(d,name+'-flame',x+w*(.245+i*.60+(phase-1.5)*.008),y+h*(.20-(phase%2)*.025),w*.065,h*.09,'flame',.095,.016,6)

def fence(d,x,y,w,h,name='animal-fence'):
    rect(d,name+'-rail-a',x+w*.03,y+h*.28,w*.94,h*.10,'wood',.02,.045,.01)
    rect(d,name+'-rail-b',x+w*.03,y+h*.60,w*.94,h*.10,'wood',.02,.045,.01)
    for px in (.08,.46,.84):rect(d,name+'-post',x+w*px,y+h*.10,w*.09,h*.78,'wood-hi',.066,.04,.01)

def trough(d,x,y,w,h,phase=0,name='care-trough'):
    rect(d,name+'-body',x+w*.05,y+h*.35,w*.90,h*.49,'wood',.01,.05,.018)
    rect(d,name+'-inside',x+w*.15,y+h*.42,w*.70,h*.26,'dark-stone',.065,.016,.008)
    fill=('water','hay','grass-hi')[phase%3]
    rect(d,name+'-fill',x+w*.20,y+h*.46,w*.60,h*.15,fill,.084,.01,.005)

def rock_pool(d,x,y,w,h,name='zoo-rock-pool'):
    ngon(d,name+'-pool',x+w*.48,y+h*.56,w*.40,h*.28,'water',.012,.022,8)
    for px,py in ((.13,.28),(.75,.22),(.80,.72)):
        ngon(d,name+'-rock',x+w*px,y+h*py,w*.14,h*.12,'stone',.04,.05,7)

def barn_module(d,x,y,w,h,name='ranch-module'):
    rect(d,name+'-body',x+w*.04,y+h*.24,w*.92,h*.63,'white',.01,.055,.018)
    rect(d,name+'-roof',x,y+h*.10,w,h*.27,'red',.07,.045,.012)
    rect(d,name+'-door',x+w*.39,y+h*.50,w*.24,h*.37,'wood',.12,.024,.008)

def core(fid,d):
    if fid=='field_cm13_01':
        rect(d,'sanctum-axis',82,49,28,105,'stone-light',.008,.020,.006)
        paving_rhythm(d,'sanctum-court',48,111,96,18,'ivory',6)
        steps(d,'sanctum-steps',58,136,76,24,'stone-light',4)
        rect(d,'sanctum-dais',53,52,86,47,'stone-mid',.020,.050,.012)
        rect(d,'sanctum-dais-inset',61,59,70,32,'sanctum-floor',.072,.025,.010)
        paving_rhythm(d,'sanctum-dais-tiles',63,62,66,8,'ivory',5)
        ngon(d,'sanctum-medallion',96,81,12,8,'bronze',.100,.025,8)
        low_wall(d,'sanctum-rear-wall',30,34,132,8,'stone-mid')
        low_wall(d,'sanctum-side-wall-left',31,48,8,42,'stone-mid')
        low_wall(d,'sanctum-side-wall-right',153,48,8,42,'stone-mid')
        rect(d,'sanctum-threshold',36,158,120,8,'ivory',.008,.025,.008)
    elif fid=='field_cm14_01':
        rect(d,'memorial-path',22,91,196,16,'stone-mid',.008,.025,.008)
        paving_rhythm(d,'memorial-stones',32,94,174,10,'stone-light',9)
        low_wall(d,'memorial-rear-left',22,41,66,7,'dark-stone')
        low_wall(d,'memorial-rear-right',112,40,72,7,'dark-stone')
        low_wall(d,'memorial-lower-wall',146,145,64,7,'dark-stone')
        for index,(x,y,rx,ry) in enumerate(((39,65,10,7),(101,72,12,8),(154,61,9,6),(194,131,11,7))):
            ngon(d,f'memorial-moss-{index}',x,y,rx,ry,'moss',.010,.022,7)
        root_cluster(d,'memorial-root-cluster',110,76)
    elif fid=='field_cm18_01':
        # A small water garden gives the many breeze markers a shared scene
        # instead of leaving them as isolated props on a flat green field.
        ngon(d,'garden-pond',72,101,42,19,'water',.008,.020,10)
        for index,(x,y,rx,ry) in enumerate(((111,52,14,7),(29,143,13,7),(66,164,14,7))):
            ngon(d,f'garden-flower-bank-{index}',x,y,rx,ry,'soil',.009,.020,9)
            for bloom in range(4):
                angle=bloom*math.tau/4+index*.35
                ngon(d,f'garden-bank-bloom-{index}-{bloom}',x+math.cos(angle)*rx*.55,y+math.sin(angle)*ry*.55,2.2,2.2,
                     ('flower-a','flower-b','flower-c')[(index+bloom)%3],.034,.014,6)
        rect(d,'garden-bridge-deck',47,91,50,18,'wood-hi',.034,.040,.01)
        for plank in range(6):rect(d,f'garden-bridge-plank-{plank}',49+plank*8,93,6,14,'wood',.078,.016,.004)
        for index,(x,y) in enumerate(((42,118),(53,125),(64,131),(76,132),(87,126))):
            ngon(d,f'garden-step-stone-{index}',x,y,5,3.3,'stone-light',.015,.022,7)
    elif fid=='field_cm24_01':
        rect(d,'temple-runner',31,40,34,57,'red',.008,.022,.008)
        rect(d,'temple-dais',20,24,56,27,'stone-warm',.020,.052,.012)
        rect(d,'temple-dais-inset',26,29,44,16,'temple-floor',.074,.022,.008)
        steps(d,'temple-steps',27,49,42,24,'stone-light',4)
        low_wall(d,'temple-rear-wall',16,17,64,7,'stone-mid')
        low_wall(d,'temple-side-left',15,27,7,28,'stone-mid')
        low_wall(d,'temple-side-right',74,27,7,28,'stone-mid')
        paving_rhythm(d,'temple-court',20,79,56,12,'stone-light',4)
    elif fid=='field_cm25_01':
        paving_rhythm(d,'zoo-service-path',18,78,156,12,'stone-light',9)
        ngon(d,'zoo-central-pool',126,55,34,17,'water',.008,.022,10)
        for index,(x,y,rx,ry) in enumerate(((95,47,8,6),(151,43,9,6),(155,67,7,5))):
            ngon(d,f'zoo-pool-rock-{index}',x,y,rx,ry,'stone',.030,.042,7)
        rect(d,'zoo-viewing-deck',18,51,48,20,'wood',.010,.032,.010)
        for rail in range(4):rect(d,f'zoo-deck-slat-{rail}',22+rail*11,54,7,14,'wood-hi',.046,.014,.004)
    else:
        paving_rhythm(d,'ranch-path',25,94,190,14,'soil',10)
        ngon(d,'ranch-paddock-left',69,58,46,26,'soil',.006,.018,10)
        ngon(d,'ranch-paddock-right',171,57,42,24,'soil',.006,.018,10)
        for index,(x,y) in enumerate(((46,44),(82,66),(149,43),(188,67))):
            rect(d,f'ranch-hay-bale-{index}',x,y,17,10,'hay',.025,.036,.012)
            for stripe in range(2):rect(d,f'ranch-hay-band-{index}-{stripe}',x+4+stripe*7,y,2,10,'wood',.064,.010,.002)
        fence(d,95,32,50,22,'ranch-central-gate')

def build(field,d,cell_id):
    import bpy
    fid=field['id'];d.LAYER='base';core(fid,d);anchors=[]
    for record in field['objects']:
        d.LAYER='decor';before=set(bpy.context.scene.objects);x,y,w,h=d.placed_cell_bounds(record);seq=record['sequenceId']
        pad=max(1,min(w,h)*.08);x+=pad;y+=pad;w-=2*pad;h-=2*pad
        if fid=='field_cm13_01':
            if seq in (2,3):flame_bowl(d,x,y,w,h,cell_id-(2 if seq==2 else 6),'sanctum-animated-flame');role='ritual-flame'
            elif seq==0:shrine_column(d,x,y,w,h,'sanctum-column');role='column'
            else:grave_marker(d,x,y,w,h,0,'sanctum-seal');role='sanctum-seal'
        elif fid=='field_cm14_01':
            if seq==4:wisp(d,x,y,w,h,(cell_id-4) if cell_id in (4,5,6) else 0,'memorial-wisp');role='memory-wisp'
            elif seq in (0,1,3,5,6,7):grave_marker(d,x,y,w,h,seq,'memorial-marker');role='memory-marker'
            else:flame_bowl(d,x,y,w,h,seq,'memorial-lantern');role='lantern'
        elif fid=='field_cm18_01':
            if seq in (0,1,6,7,8,9):garden_post(d,x,y,w,h,cell_id,'garden-breeze-marker');role='breeze-marker'
            else:flower_patch(d,x,y,w,h,seq,'garden-flower-bed');role='flower-bed'
        elif fid=='field_cm24_01':
            if seq==0:altar(d,x,y,w,h,max(0,cell_id),'animated-temple-altar');role='altar'
            elif seq==1:temple_gateway(d,x,y,w,h,'temple-gateway');role='gateway'
            else:flame_bowl(d,x,y,w,h,0,'temple-incense-bowl');role='incense-bowl'
        elif fid=='field_cm25_01':
            if seq==16:trough(d,x,y,w,h,max(0,cell_id-16),'animated-zoo-feeder');role='feeder'
            elif seq in (0,2,3,4,5):fence(d,x,y,w,h,'zoo-fence');role='fence'
            elif seq in (11,13):rock_pool(d,x,y,w,h,'zoo-water-rock');role='water-rock'
            else:trough(d,x,y,w,h,seq,'zoo-care-station');role='care-station'
        else:
            if seq==4:trough(d,x,y,w,h,max(0,cell_id-4),'animated-ranch-trough');role='trough'
            elif seq in (0,1):barn_module(d,x,y,w,h,'ranch-barn-module');role='barn-module'
            elif seq==2:fence(d,x,y,w,h,'ranch-fence');role='fence'
            else:flower_patch(d,x,y,w,h,seq,'ranch-hay-patch');role='hay-patch'
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement'];obj['objectSequenceId']=seq;obj['sourceCellId']=cell_id
        anchors.append({'sourceOrdinal':record['order'],'role':role,'anchorNative':record['placement']})
    d.LAYER='base';bpy.context.scene['natureFeatures']=json.dumps(['numeric-native-hex-union','original-fixed-window-environment-family','independent-opm-cell-bank'])
    return anchors
