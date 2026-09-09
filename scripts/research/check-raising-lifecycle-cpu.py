"""Original CPU oracle for the integrated Raising lifecycle; private inputs only.

The functional catalog contains consumed numbers, never code, images or RAM.
Synthetic CPU scenarios are explicitly separate from live-game/video acceptance.
"""
import argparse, hashlib, json, math, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

ap=argparse.ArgumentParser()
for key in ['rom','ram','out','catalog']: ap.add_argument('--'+key,required=True)
a=ap.parse_args(); raw=Path(a.rom).read_bytes(); ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[18]
assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
word=lambda at:struct.unpack_from('<I',ram,at-0x2000000)[0]
half=lambda at:struct.unpack_from('<H',ram,at-0x2000000)[0]
signed=lambda n:n if n<0x80000000 else n-0x100000000
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x4000000,0x1000)
actor=0x2500000;record=0x2501000;body=0x2502000;stop=0x27f0000
get=lambda at,n=4:int.from_bytes(u.mem_read(at,n),'little')
def put(at,n,size=4):u.mem_write(at,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
def finish(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
calls=[];rolls=[];cursor=0;params={}
def hook(_,at,size,user):
    global cursor
    if params.get('training'):
        if at==0x207bc9c:finish(params['season']);return
        if at==0x2050360:finish(params['level']);return
        if at==0x207e750:finish();return
    if params.get('timeline'):
        if at==0x20662f4:finish(0x2560000+u.reg_read(UC_ARM_REG_R1)*0x100);return
        if at==0x2047304:finish(u.reg_read(UC_ARM_REG_R0)+4);return
        if at==0x2047e58:finish(0x257e000);return
        if at==0x2047c78:put(u.reg_read(UC_ARM_REG_R0)+4,u.reg_read(UC_ARM_REG_R1));finish();return
        if at in [0x20438b0,0x2043b4c,0x20472c4,0x20472cc,0x20472ec,0x2047904,0x20479a4,0x2064984,0x2065a64,0x2111834,0x2111998,0x21153c8,0x211df10]:finish();return
        if at==0x2047d98:finish(32);return
        if at==0x257f100:
            put(u.reg_read(UC_ARM_REG_R1)+4,0x40000);finish();return
        if params.get('trainingTimeline') and at==0x2112734:finish(0);return
    if params.get('waste') and at==0x2047904:finish();return
    if params.get('waste') and at==0x21213e4:
        obj=u.reg_read(UC_ARM_REG_R0);rec=u.reg_read(UC_ARM_REG_R1);put(rec+16,1)
        for offset in range(3):put(obj+0x64+offset*4,get(rec+4+offset*4))
        finish();return
    if params.get('waste') and at==0x20502d8:
        position=u.reg_read(UC_ARM_REG_R0);u.mem_write(position,bytes(12));finish(position);return
    if at==0x20431d4:
        assert cursor<len(rolls),hex(u.reg_read(UC_ARM_REG_LR))
        calls.append(['rng',u.reg_read(UC_ARM_REG_R0)]);finish(rolls[cursor]);cursor+=1
    elif at==0x2062074:finish()
    elif at==0x206206c:finish(len(params['roster']))
    elif at==0x20620e0:finish(record if u.reg_read(UC_ARM_REG_R1)==0 else 0x2520000+u.reg_read(UC_ARM_REG_R1)*0x200)
    elif at in [0x208c2d4,0x208c2a0,0x208c2b4]:finish(0)
    elif at==0x2112378:
        calls.append(['sequence',u.reg_read(UC_ARM_REG_R1)]);finish()
    elif at==0x257f000:finish()
    elif at in [0x2043860,0x20034f4,0x2044100] and params.get('growth'):finish(0)
    elif at in [0x210e4dc,0x207bc7c] and params.get('growth'):finish(1)
    elif at==0x207bc9c and params.get('growth'):finish(0)
    elif at==0x207bccc and params.get('growth'):finish(420)
    elif at==0x203ea30:
        calls.append(['audio',u.reg_read(UC_ARM_REG_R0)]);finish()
    elif at==0x210bc4c and params.get('overnight'):
        food=u.reg_read(UC_ARM_REG_R0);data=get(food+0x3c);put(data+0x18,0)
        remaining=params['foodActors'];remaining.remove(food)
        put(params['cage']+0x48,remaining[0] if remaining else 0);put(params['cage']+0x4c,len(remaining))
        for i,p in enumerate(remaining):put(p+0x34,remaining[(i+1)%len(remaining)])
        finish()
    elif at==0x20500bc and params.get('overnight'):
        position=u.reg_read(UC_ARM_REG_R0);put(position,0x30000);put(position+4,0x40000);put(position+8,0);finish()
    elif at==0x210e380 and params.get('overnight'):
        ok=params['spawnSuccess'];calls.append(['wasteSpawn',u.reg_read(UC_ARM_REG_R1),ok]);finish(int(ok))
    elif at in [0x207e67c,0x207d068,0x2120364,0x21262b0,0x208bfd4]:
        calls.append(['presentation',hex(at)]);finish()
def hardware(_,access,at,size,value,user):
    if 0x40002a0<=at<0x40002b0:
        mode=get(0x4000280,2)&3
        n=int.from_bytes(u.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
        d=int.from_bytes(u.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
        assert d
        q=(abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
        put(0x40002a0,q,8);put(0x40002a8,n-q*d,8)
    elif at==0x40002b4:put(at,math.isqrt(get(0x40002b8,8 if get(0x40002b0,2)&1 else 4)))
u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_READ,hardware,begin=0x4000280,end=0x40002bf)
def reset():
    global cursor
    calls.clear();cursor=0;u.mem_write(0x2000000,ram);u.mem_write(0x2500000,bytes(0x80000));u.mem_write(0x27de000,bytes(0x4000))
def run(at,*args):
    for reg,value in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3],args):u.reg_write(reg,value&0xffffffff)
    u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
    try:u.emu_start(at,stop,count=1000000)
    except Exception:
        print('CPU boundary',hex(u.reg_read(UC_ARM_REG_PC)),[hex(u.reg_read(r)) for r in [UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3]],params);raise
    assert u.reg_read(UC_ARM_REG_PC)==stop,hex(u.reg_read(UC_ARM_REG_PC))
    return signed(u.reg_read(UC_ARM_REG_R0))
def write_json(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')

species_base=word(0x2113368); rules_base=word(0x211335c)
rules=[]
for i in range(179):
    count,pointer,_=struct.unpack_from('<III',ram,rules_base+i*12-0x2000000)
    rules.append([dict(target=word(pointer+j*60),kind=half(pointer+j*60+4),thresholds=[half(pointer+j*60+k) for k in range(6,58,2)]) for j in range(count)] if pointer else [])
rank_capacity=word(0x2113374);rank_generation=word(0x211337c)
life_base=word(0x2113380);waste_base=word(0x208551c)
catalog=dict(schemaVersion=1,contract='RAISING_LIFECYCLE_RULES.v1',rules=rules,
    species=[dict(sleepMin=half(species_base+i*132+0x24),sleepMax=half(species_base+i*132+0x26),life=half(species_base+i*132+0x28),capacity=ram[species_base+i*132+0x1d-0x2000000],family=word(species_base+i*132+0x18)) for i in range(228)],
    ranks=[dict(capacity=word(rank_capacity+i*36),generation=word(rank_generation+i*36)) for i in range(10)],
    extendedLife=[word(life_base+i*4) for i in range(7)],wasteThresholds=[word(waste_base+i*4) for i in range(7)])
cages=[]
for i in range(36):
    reset();run(0x2050030,0x2540000,i)
    ptr=get(0x2540018);count=word(ptr);offset=1;commands=[]
    for j in range(count):
        kind=word(ptr+offset*4);length=4 if kind==6 else 2
        commands.append([signed(word(ptr+(offset+k)*4)) for k in range(length)]);offset+=length
    programs=[]
    for slot in range(3):
        p=get(0x254000c+slot*4);weight=word(p);n=word(p+4)
        programs.append(dict(weight=weight,commands=[[signed(word(p+8+j*8)),signed(word(p+12+j*8))] for j in range(n)]))
    cages.append(dict(capacity=get(0x2540009,1),commands=commands,programs=programs,entryReaction=signed(word(word(0x21194ac)+i*40))))
catalog['cages']=cages
catalog['personalityAversion']=[word(word(0x21165fc)+i*4) for i in range(8)]
catalog['conditionModifiers']={key:[signed(word(word(at)+(22+k)*4)) for k in range(5)] for key,at in [('summer',0x21161a8),('winter',0x21161ac),('level2',0x21161b0),('level3',0x21161b4)]}
catalog['trainingModifiers']={key:[signed(word(word(at)+k*4)) for k in range(28)] for key,at in [('summer',0x211457c),('winter',0x2114580),('level1',0x2114584),('level2',0x2114588),('spread',0x211458c)]}
write_json(a.catalog,catalog)
inputs=json.loads(Path('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json').read_text(encoding='utf-8'))['individualVectors']
narrow={'03c':1,'03d':1,'044':1,'046':2,'194':2}
def put_profile(p,at=record):
    for key,value in p['fields'].items():put(at+int(key,16),value)
    for key,value in p['narrowFields'].items():put(at+int(key,16),value,narrow[key])
    u.mem_write(at+0x2c,p['name'].encode('utf-16-le')+bytes(12-len(p['name'])*2))
def read_profile(p,at=record):
    return dict(fields={k:get(at+int(k,16)) for k in p['fields']},narrowFields={k:get(at+int(k,16),n) for k,n in narrow.items()},name=p['name'])
evolution=[];prng=random.Random(20260908)
for i in range(228):
    for variation in range(12):
        reset();p=inputs[i]['after'];put_profile(p)
        put(actor+0x114,record);put(actor+0x118,species_base+i*132);put(actor+0x11c,body);put(body+0x6fc,0x2504000)
        put(actor+0x428,catalog['species'][i]['life'])
        rank=variation%10;roster=[i]+([200]*15 if variation==10 else [21] if variation==9 else [])
        params={'roster':roster};player=word(word(word(0x211336c))+4);put(player+0xae8,rank,2)
        for j,s in enumerate(roster[1:],1):put(0x2520000+j*0x200,s)
        for at in [0x100,0x104,0x108,0x10c,0x110,0x114,0x118,0x11c,0x120,0x124,0x128]:put(record+at,[0,100,1000][variation%3])
        if variation%3==2:
            for at in range(0x58,0x84,4):put(record+at,9999)
        put(record+0x24,variation*10);put(record+0x28,variation*8);put(record+0x3c,variation,1);put(record+0x3d,variation%8,1)
        put(record+0x20,49 if variation==3 else 50);put(record+0x4c,1 if variation==4 else 0)
        if variation>=6:
            for at in range(0x144,0x170,4):put(record+at,[228,27,28][variation%3])
        rolls=[0,1,2,100,101,102][variation%6:]+[51]*20
        before=read_profile(p);lifetime=variation%2
        result=run(0x2112734,actor,lifetime)
        evolution.append(dict(speciesIndex=i,rank=rank,roster=roster,lifetime=lifetime,rolls=rolls[:cursor],before=before,after=read_profile(p),result=result,
            actor={f'{k:03x}':get(actor+k) for k in [0x1e8,0x1f0,0x1f4,0x428,0x454,0x464]},calls=list(calls)))
sleep=[]
for i in range(8,228):
    for variation in range(4):
        reset();params={};p=inputs[i]['after'];put_profile(p);put(actor+0x114,record);put(actor+0x118,species_base+i*132);put(actor+0x3c,body)
        put(actor+0x46c,0x26+i%16);rolls=[variation*34]*8
        before=read_profile(p);run(0x2118240,actor);entered=read_profile(p)
        put(record+0x17c,catalog['species'][i]['sleepMin']+variation-2)
        beforeExit=read_profile(p);run(0x21182b4,actor)
        sleep.append(dict(speciesIndex=i,poolSlot=i%16,before=before,entered=entered,beforeExit=beforeExit,after=read_profile(p),rolls=rolls[:cursor],calls=list(calls)))
        put(record+0x50,1);morningBefore=read_profile(p);cursor=0;calls.clear();run(0x211ca00,actor)
        sleep[-1]['morning']=dict(before=morningBefore,after=read_profile(p),waitFrames=get(actor+0xe,1),rolls=rolls[:cursor],calls=list(calls))
overnight=[];growth=[]
for variation in range(168):
    reset();p=inputs[[0,8,27,71,135,181,211][variation%7]]['after'];definition=[0,15,18,24,25,28,35][variation%7]
    cage=0x2540000;scene=0x2530000;root=word(word(0x2085514));put(root+0x84,cage);put(scene+0x3014,1);run(0x2050030,cage,definition)
    residents=[];before=[];count=variation%3+1;minutes=[1,60,120,240,241,540,900,1320][variation%8]
    for j in range(count):
        act=0x2550000+j*0x1000;rec=act+0x800;residents.append(act);put_profile(p,rec)
        put(rec+0x18c,[0,1,500][(variation+j)%3]);put(rec+8,(variation+j)%9);put(rec+0x174,variation%5*60);put(rec+0x170,variation%3*59)
        put(rec+0x190,variation%7*120);put(rec+0x138,int(j==1));put(rec+0x1ac,variation%8*120);put(rec+0x1b0,variation%4*100)
        put(act+0x114,rec);put(act+0x118,species_base+get(rec)*132);put(act+0x120,cage)
        if definition in [15,18,28]:
            effects=[cmd for cmd in cages[definition]['commands'] if cmd[0]==6];put(act+0x234,len(effects),1);put(act+0x238,act+0x600)
            for k,(_,interval,kind,delta) in enumerate(effects):put(act+0x600+k*12,interval);put(act+0x604+k*12,kind,1);put(act+0x608+k*12,delta)
        before.append(read_profile(p,rec))
    put(cage+0x38,residents[0]);put(cage+0x3c,count)
    for j,act in enumerate(residents):put(act+0x34,residents[(j+1)%count])
    foodActors=[];foods=[]
    for j in range(variation%4):
        act=0x2560000+j*0x1000;rec=act+0x300;foodActors.append(act)
        food=dict(protein=bool(j%2),remaining=16,freshness=0 if variation%5==0 else 1000,present=True);foods.append(food)
        put(act,act+0x800);put(act+0x820,0x257f000);put(act+0x3c,rec);put(rec+0x10,food['remaining']);put(rec+0x14,food['freshness']);put(rec+0x18,1);put(rec+0x1c,int(food['protein']))
    put(cage+0x48,foodActors[0] if foodActors else 0);put(cage+0x4c,len(foodActors))
    for j,act in enumerate(foodActors):put(act+0x34,foodActors[(j+1)%len(foodActors)])
    put(cage+0x5c,variation%5);params=dict(overnight=True,cage=cage,foodActors=list(foodActors),spawnSuccess=variation%2==0)
    rolls=[variation%103]*64;night=bool(variation%2);run(0x2084ca0,scene,minutes,int(night))
    overnight.append(dict(input=dict(definition=definition,minutes=minutes,night=night,wasteCount=variation%5,spawnSuccess=params['spawnSuccess'],foods=foods,rolls=rolls[:cursor]),
        before=before,after=[read_profile(p,act+0x800) for act in residents],foodsAfter=[dict(protein=bool(get(act+0x31c)),remaining=get(act+0x310),freshness=get(act+0x314),present=bool(get(act+0x318))) for act in foodActors],calls=list(calls)))
    for j,act in enumerate(residents):put_profile(before[j],act+0x800)
    current=residents[variation%count];state=[1,4,5,6,8][variation%5];put(current+8,state,1)
    actorOffsets=[0x404,0x408,0x40c,0x410,0x414,0x418,0x41c,0x428,0x430,0x45c,0x460,0x470]
    for offset in actorOffsets:put(current+offset,0)
    put(current+0x40c,count);put(current+0x428,10000);put(current+0x470,0x36+variation%count);put(current+0x45c,-1)
    put(current+0x234,0,1);params['growth']=True;cursor=0;calls.clear()
    actorBefore={f'{k:03x}':get(current+k) for k in actorOffsets};run(0x2114a10,current,variation%3)
    growth.append(dict(before=before[variation%count],residents=before,after=read_profile(p,current+0x800),actorBefore=actorBefore,actorAfter={f'{k:03x}':get(current+k) for k in actorOffsets},
        input=dict(state=state,ageDelta=variation%3,mode=0,minute=420,ranchSize=get(cage+9,1),generation=word(species_base+before[variation%count]['fields']['000']*132+12),baseUnit=60,effects=[]),rolls=rolls[:cursor],calls=list(calls)))
rebirth=[];waste=[];timelines=[]
for i in range(228):
    for force in [False,True]:
        reset();params={};p=inputs[i]['after'];put_profile(p);put(record+0x24,i%12);put(record+0x3c,i%101,1)
        put(actor+0x114,record);put(actor+0x118,species_base+i*132);put(actor+0x11c,body)
        before=read_profile(p);result=run(0x21164e4,actor,int(force))
        rebirth.append(dict(before=before,after=read_profile(p),force=force,target=signed(get(actor+0x1e8)),state=result))
for definition in range(36):
    for filled in [0,1,2,4,39,40]:
        reset();params={'waste':True};cage=0x2540000;scene=0x2530000;pool=0x2550000;objects=0x2560000
        run(0x2050030,cage,definition);put(word(word(0x210e448))+0x9c,pool);put(scene+0x1c4,objects)
        for j in range(filled):put(pool+j*24+16,1)
        count=min(filled,catalog['cages'][definition]['capacity']);put(cage+0x5c,count)
        # The Cage origin accessor consumes its native geometry. Here its
        # scene position is zero; actual local coordinates are in the live trace.
        put(0x27e0000,cage);result=run(0x210e380,scene,21,0x100000,0x80000)
        if result: output=dict(slot=(result-objects)//0x120,cageDefinitionIndex=get(pool+filled*24),speciesIndex=get(pool+filled*24+20),positionQ12=[get(result+0x64),get(result+0x68),get(result+0x6c)],present=bool(get(pool+filled*24+16)))
        else:output=None
        waste.append(dict(definition=definition,filled=filled,cageCount=count,output=output))
for target in [1,27,181]:
    reset();params={'timeline':True};put(actor+0x218,1);put(actor+0x1e8,target);put(actor+0x1ec,21);put(actor+0x3c,body);put(actor+0x11c,body)
    put(body+4,4096);put(body+0x24,0x80000);put(body+0x28,0x60000)
    put(word(0x211af74),0);put(word(0x211af7c)+8,0,1);put(word(0x211af88),0);put(word(0x211af8c),672)
    put(word(0x211af70),0x2540000);put(0x257e002,-16,2);put(0x257e006,0,2)
    frames=[]
    for tick in range(400):
        result=run(0x211a338,actor);frames.append(dict(phase=get(actor+0xe,1),elapsed=get(actor+0x10,2),period=get(actor+0x1e4),result=result))
        if result!=-1:break
    assert frames[-1]['result']!=-1
    timelines.append(dict(target=target,frames=frames))
disappearanceTimelines=[]
for wait in [30]:
    reset();params={'timeline':True};put(actor+0x218,1);put(actor+0x1e8,-1);put(actor+0x3c,body);put(actor+0x1e4,15)
    put(body+0x24,0x80000);put(body+0x28,0x60000)
    for at in [0x211c468,0x211c474]:put(word(at),0)
    put(word(0x211c478),672);effectFrames=wait;frames=[];put(actor+0xbc,1)
    for tick in range(250):
        result=run(0x211c038,actor);frames.append(dict(phase=get(actor+0xe,1),elapsed=get(actor+0x10,2),result=result))
        # The draw callback 0211C778 invokes 0211DF10 for this effect only
        # when phase == 3. Its native sequence 15 is a 30-tick one-shot.
        if get(actor+0xe,1)==3:
            effectFrames-=1
            if effectFrames<=0:put(actor+0xbc,0)
        if result!=-1:break
    assert frames[-1]['result']==0
    disappearanceTimelines.append(dict(effectDuration=wait,frames=frames))
trainingTimelines=[]
for count in [0,1,2,3,5,10]:
    reset();params={'timeline':True,'trainingTimeline':True};put(actor+0x3c,body);put(actor+0x114,record);put(actor+0x1d8,0x2550000);put(actor+0x1e0,0x2560000);put(actor+0x1de,count,2)
    put(actor+0xe,0 if count else 1,1);put(0x25501b2,1,1)
    for lane in [0x2550000,0x25501b8]:put(lane,0x257f000);put(0x257f00c,0x257f100)
    frames=[]
    for tick in range(1200):
        result=run(0x2119b50,actor);frames.append(dict(phase=get(actor+0xe,1),emitted=get(actor+0x1dc,2),result=result))
        if result!=-1:break
    assert frames[-1]['result']==1
    trainingTimelines.append(dict(count=count,frames=frames))
training=[]
for kind in range(28):
    for variation in range(24):
        reset();i=[8,27,71,135,181,211][variation%6];p=inputs[i]['after'];put_profile(p)
        put(actor+0x114,record);put(actor+0x118,species_base+i*132);put(actor+0x120,0x2540000)
        params={'training':True,'season':variation%4,'level':variation%3}
        delta=[-100,-1,0,1,10,100][variation%6];rolls=[0,1,50,51,100,102][variation%6:]+[51]*8
        if variation>=12:
            for at in range(0x58,0x84,4):put(record+at,get(record+0xa8+(at-0x58)*2)+(1 if variation%2 else -1))
        put(record+0x134,int(variation%7==0));put(record+0x174,240 if variation%2 else 0)
        before=read_profile(p)
        if kind<22:run(0x2113c2c,actor,kind,delta)
        else:
            put(0x2540800,kind-22);put(0x2540804,delta);run(0x211459c,actor,0x2540800,-1)
        training.append(dict(kind=kind,delta=delta,season=params['season'],level=params['level'],before=before,after=read_profile(p),rolls=rolls[:cursor],calls=list(calls)))
write_json(a.out,dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,ramSha256=hashlib.sha256(ram).hexdigest(),evolution=evolution,sleep=sleep,overnight=overnight,growth=growth,rebirth=rebirth,waste=waste,evolutionTimelines=timelines,disappearanceTimelines=disappearanceTimelines,training=training,trainingTimelines=trainingTimelines,
    exclusions=['UI/audio calls recorded as stubs; synthetic CPU inputs are not live-game acceptance','Overnight oracle stubs ground position and waste allocation result; food render/delete list wiring is a boundary stub. Original food quantity logic and all profile arithmetic execute.','Evolution timeline executes original phase control with character-resource, sprite and visual-effect calls stubbed; it does not validate pixels or audio.','Waste initializer 021213E4 is stubbed; the original allocator executes.','Disappearance effect completion uses decoded NANR sequence-15 duration 30 ticks; no live death scene is claimed.','Training popup CPU cases stub rendering and force the evolution-selector boundary to return zero; training writers and evolution predicates have separate vectors.','Critical-illness actor entry and complete Home reconstruction have code trace and app coverage, not a complete original CPU scene differential.']))
print('PASS',len(evolution),'original eligibility calls;',sum(len(r) for r in rules),'ordered evolution rules')
print('PASS',len(sleep),'sleep entry/exit pairs;',len(overnight),'overnight calls')
