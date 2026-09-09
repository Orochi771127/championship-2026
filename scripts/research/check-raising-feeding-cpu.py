"""Original OVL18 feeding approach oracle and functional ranch inputs.

Private ROM/RAM are mandatory inputs. Runtime output contains only consumed
gameplay fields (no images, tile IDs, palettes, scripts, ROM bytes or pointers).
"""
import argparse, hashlib, itertools, json, math, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser()
    for k in ['rom','ram','out','ground']:ap.add_argument('--'+k,required=True)
    a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[18]
    assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
    word=lambda at:struct.unpack_from('<I',ram,at-0x2000000)[0]
    ground=[];sources=[]
    for definition in range(37):
        ptr=word(0x20c8cc0+definition*40)
        name=ram[ptr-0x2000000:ptr-0x2000000+40].split(b'\0')[0].decode('ascii')
        files={ext:bytes(rom.files[rom.filenames.idOf('training/'+name+'.'+ext)]) for ext in ['nbs','atr','col']}
        width,height=struct.unpack_from('<II',files['nbs'],8)
        tiles=struct.unpack_from('<'+'H'*(width*height),files['nbs'],20)
        atr=files['atr'][16:];col=files['col'][3:]
        # Each run describes writes to the gameplay planes. Render tile data
        # are discarded here, including nonzero tile IDs and their ordering.
        cells=[]
        for tile,attribute,clearance in zip(tiles,atr,col):
            if definition==36:
                write=bool(tile);owner=write and not attribute&1;terrain=0 if owner else -1
            else:
                write=bool(tile) or not attribute&1;owner=write and attribute!=1
                terrain=(1 if attribute&1 else 2 if attribute&2 else 3 if attribute&4 else 0) if owner else -1
            cell=[int(owner),terrain,clearance if write else 0]
            if cells and cells[-1][1:]==cell:cells[-1][0]+=1
            else:cells.append([1,*cell])
        # Original random position samples the source clearance map before
        # global composition. Retain runs of those consumed numeric values.
        clearanceRuns=[]
        for value in col:
            if clearanceRuns and clearanceRuns[-1][1]==value:clearanceRuns[-1][0]+=1
            else:clearanceRuns.append([1,value])
        ground.append(dict(definitionIndex=definition,width=width,height=height,runs=cells,clearanceRuns=clearanceRuns))
        sources.append(dict(definitionIndex=definition,files={k:hashlib.sha256(v).hexdigest() for k,v in files.items()}))
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x4000000,0x1000)
    actor,food=0x22e2d40,0x22835a8;stop=0x27f0000;calls=[];rolls=[];rollCursor=0
    get=lambda at,n=4:int.from_bytes(u.mem_read(at,n),'little')
    def put(at,n,size=4):u.mem_write(at,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
    def vec(at):return list(struct.unpack('<3i',u.mem_read(at,12)))
    def putvec(at,v):u.mem_write(at,struct.pack('<3i',*v))
    def finish(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
    def hook(_,at,size,user):
        nonlocal rollCursor
        if at==0x203ea30:calls.append(['audio',u.reg_read(UC_ARM_REG_R0)]);finish()
        elif at==0x20431d4 and rolls:
            calls.append(['rng',u.reg_read(UC_ARM_REG_R0)]);finish(rolls[rollCursor%len(rolls)]);rollCursor+=1
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
        calls.clear();u.mem_write(0x2000000,ram)
        u.mem_write(0x2500000,bytes(0x40000));u.mem_write(0x27de000,bytes(0x4000))
    def run(at,*values):
        for reg,value in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3],values):u.reg_write(reg,value&0xffffffff)
        u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
        u.emu_start(at,stop,count=200000)
        assert u.reg_read(UC_ARM_REG_PC)==stop,hex(u.reg_read(UC_ARM_REG_PC))
        return u.reg_read(UC_ARM_REG_R0)
    stations=[]
    for x,y,occupied in itertools.product([40,99,100,101,160],[40,99,100,101,160],range(16)):
        reset();putvec(food+0x64,[409600,409600,0]);putvec(0x2500000,[x*4096,y*4096,0])
        for i in range(4):put(food+0x1f4+i*4,actor if occupied&(1<<i) else 0)
        result=run(0x210bd5c,food,0x2500000,0x2500010)
        stations.append(dict(position=[x*4096,y*4096,0],occupied=occupied,result=result if result<4 else -1,
                             target=vec(0x2500010) if result<4 else None))
    movement=[]
    rng=random.Random(20260908)
    for mode,state,slow,fast,terrain in itertools.product([0,1],[2,3],[0,1],[0,1],[0,1,2,3]):
        reset();body=get(actor+0x3c)
        terrainGrid=get(word(0x21122b8));clearanceGrid=get(word(0x2112298))
        # Explicit uniform fields exercise obstruction and every movement mode;
        # real mixed ground is verified separately by the compositor oracle.
        for grid,value in [(terrainGrid,[0,1,2,4][terrain]),(clearanceGrid,4)]:
            u.mem_write(get(grid+8),bytes([value])*(get(grid)*get(grid+4)))
        position=[100*4096+17,100*4096+9,0];target=[rng.randint(50,180)*4096,rng.randint(45,145)*4096,0]
        angle=rng.randrange(360)*4096;desired=rng.randrange(360)*4096
        putvec(body+0x24,position);putvec(actor+0x128,target)
        for off,val in [(8,state),(0x150,mode),(0x14c,60),(0x148,angle),(0x134,desired),(0x158,4),(0x17c,slow),(0x404,fast),(0x418,0),(0x41c,0),(0x184,food)]:put(actor+off,val,1 if off in [8,0x158] else 4)
        run(0x2111a40,actor)
        movement.append(dict(input=dict(positionQ12=position,destinationQ12=target,mode=mode,state=state,slow=slow,fast=fast,
                angleQ12=angle,desiredAngleQ12=desired,terrain=terrain,clearance=4,ticks=60,threshold=4),
            output=dict(positionQ12=vec(body+0x24),destinationQ12=vec(actor+0x128),directionQ12=vec(actor+0x15c),mode=get(actor+0x150),
                angleQ12=get(actor+0x148),desiredAngleQ12=get(actor+0x134),ticks=get(actor+0x14c),threshold=get(actor+0x158,1),flipBits=get(body+0x6dc))))
    spawns=[]
    for definition in range(36):
        for anchor in [0,4]:
            reset();cage=0x2500000;f=ground[definition];rolls=[rng.randrange(103) for _ in range(1000)];rollCursor=0
            clearance=[v for count,v in f['clearanceRuns'] for _ in range(count)]
            for off,value in [(4,definition),(8,word(0x20c8cbc+definition*40)),(0x20,f['width']),(0x24,f['height']),(0x28,0x2510000),(0x60,anchor)]:put(cage+off,value,1 if off in [8,0x60] else 4)
            u.mem_write(0x2510000,bytes(clearance));run(0x20500bc,0x2520000,cage)
            spawns.append(dict(definition=definition,anchor=anchor,rolls=rolls[:rollCursor],positionQ12=vec(0x2520000),calls=list(calls)))
    openTiles=[]
    terrain=[1 if ((x//3+y//2)%4==0 or y<2 or y>21) else 0 for y in range(24) for x in range(84)]
    for x,y,central in itertools.product([-35,0,13,50,83],[0,8,23],[0,1]):
        reset();grid=get(0x2128c6c);put(grid,84);put(grid+4,24);u.mem_write(get(grid+8),bytes(terrain))
        put(actor+0x46c,0x26);put(0x2500000,x);put(0x2500004,y);rolls=[51];rollCursor=0
        distance=run(0x2112408,actor,0x2500000,0x2500004,central)
        signed=lambda n:n if n<0x80000000 else n-0x100000000
        openTiles.append(dict(x=x,y=y,centralBand=bool(central),output=dict(x=signed(get(0x2500000)),y=signed(get(0x2500004)),distance=distance),calls=list(calls)))
    for central in [0,1]:
        reset();grid=get(0x2128c6c);sparse=[1]*(84*24);sparse[6*84+40]=0;put(grid,84);put(grid+4,24);u.mem_write(get(grid+8),bytes(sparse))
        put(actor+0x46c,0x26);put(0x2500000,0);put(0x2500004,0);rolls=[51];rollCursor=0
        distance=run(0x2112408,actor,0x2500000,0x2500004,central)
        openTiles.append(dict(x=0,y=0,centralBand=bool(central),terrain=sparse,output=dict(x=signed(get(0x2500000)),y=signed(get(0x2500004)),distance=distance),calls=list(calls)))
    rolls=[]
    reset();sine=word(0x21122a8)
    # Values used by movement at its 360 integer headings, not a graphics table.
    headings=[]
    for degree in range(360):
        turn=math.trunc(degree*65535/360);idx=turn>>4
        headings.append(list(struct.unpack('<hh',u.mem_read(sine+idx*4,4))))
    Path(a.ground).write_text(json.dumps(dict(schemaVersion=1,contract='RAISING_NATIVE_FEEDING.v1',fields=ground,headings=headings),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    out=dict(classification='RESEARCH_ONLY',romSha256=sha,ramSha256=hashlib.sha256(ram).hexdigest(),
             sourceReceipts=sources,stations=stations,movement=movement,spawns=spawns,headings=headings,
             openTileGround=dict(width=84,height=24,terrain=terrain),openTiles=openTiles,
             presentationStubs=['0203EA30 audio only'],mechanicalFunctions=['0210BD5C','02111A40','02113BD4','02002A6C','02003098','020500BC','02112408','0207C9E8','0207CC24'])
    Path(a.out).write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(dict(stations=len(stations),movement=len(movement),spawns=len(spawns),ground=len(ground))))

if __name__=='__main__':main()
