"""Original ADEC allocation/copy placement and camera dispatch, controlled SDK calls."""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import *

def trace(raw):
    rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ov=rom.loadArm9Overlays()[19]
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x800000)
    u.mem_write(0x02000000,arm);u.mem_write(ov.ramAddress,bytes(ov.data))
    STOP,STACK,BASE,OWNER,TARGET,ACTOR,OFFSET,OUT=0x027f0000,0x027e0000,0x02400000,0x02600000,0x02601000,0x02602000,0x02604000,0x02605000
    reg=u.reg_read;put=lambda a,n:u.mem_write(a,struct.pack('<I',n&0xffffffff))
    get=lambda a:struct.unpack('<I',u.mem_read(a,4))[0]
    signed=lambda n:n if n<0x80000000 else n-0x100000000
    height=0;engagement_calls=[];frame_calls=[];timing_mode=False
    def hook(_,pc,size,data):
        if timing_mode and pc in (0x02114f3c,0x0210d478,0x0211504c,0x0211513c):
            frame_calls.append([pc]);u.reg_write(UC_ARM_REG_PC,STOP);return
        if pc in (0x0208a0c8,0x0208a02c):pass # SDK model animation reset: no actor movement
        elif pc==0x02112820:
            engagement_calls.append([pc,reg(UC_ARM_REG_R0),reg(UC_ARM_REG_R1)])
            put(reg(UC_ARM_REG_R0)+0x17c,reg(UC_ARM_REG_R1));put(reg(UC_ARM_REG_R0)+0x180,-255)
        elif pc in (0x0211b2e8,0x0211b94c,0x0203ea30):
            engagement_calls.append([pc,reg(UC_ARM_REG_R0),reg(UC_ARM_REG_R1)])
        elif pc in (0x0211cc7c,0x02066718,0x02112980,0x02064e20,0x02112d18,0x0210f5d8,0x02119d68,0x02111910,0x02111b04,0x0211b228,0x0210ed70,0x0211b54c):
            frame_calls.append([pc,reg(UC_ARM_REG_R0),reg(UC_ARM_REG_R1)])
        elif pc in (0x0210d5fc,0x0210da00):
            frame_calls.append([pc]);u.reg_write(UC_ARM_REG_PC,STOP);return
        elif pc==0x02047ffc:
            dest,src=reg(UC_ARM_REG_R0),reg(UC_ARM_REG_R1)
            u.mem_write(dest,bytes(u.mem_read(src,0xd4))) # controlled source-sprite copy input
        elif pc==0x02047d98:u.reg_write(UC_ARM_REG_R0,height)
        elif pc==0x02043ef4:u.mem_write(reg(UC_ARM_REG_R0)+8,bytes([reg(UC_ARM_REG_R1)])) # renderer upload boundary
        else:return
        u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
    u.hook_add(UC_HOOK_CODE,hook)
    def run(pc,args):
        for i,n in enumerate(args):
            if i<4:u.reg_write([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3][i],n&0xffffffff)
            else:put(STACK+(i-4)*4,n)
        u.reg_write(UC_ARM_REG_SP,STACK);u.reg_write(UC_ARM_REG_LR,STOP);u.emu_start(pc,STOP,count=100000)
        assert reg(UC_ARM_REG_PC)==STOP,hex(reg(UC_ARM_REG_PC))
        return reg(UC_ARM_REG_R0)
    put(TARGET+4,ACTOR);impacts=[]
    for type in range(5):
      for sample in range(4):
        u.mem_write(BASE+0x22518,bytes(5*64));height=[8,32,67,0][sample]
        xyz=[(123+sample)*4096,(91-sample)*4096,sample*3*4096];offset=[4096*sample,-8192*sample,12288*sample]
        for i,n in enumerate(xyz):put(ACTOR+0x24+i*4,n)
        for i,n in enumerate(offset):put(OFFSET+i*4,n)
        slot=sample
        for i in range(slot):put(BASE+0x22518+type*64+i*4,OWNER)
        result=run(0x0211adec,[BASE,type,OWNER,TARGET,OFFSET]);copy=BASE+0x232d8+type*0xd40+slot*0xd4
        assert result==BASE+0x1b718+type*0x1600+slot*0x160
        put(copy+0x20,0);put(copy+0x34,(-768+xyz[1]//4096+height)*4096)
        run(0x02048378,[copy,OUT])
        projected=[signed(get(OUT+i*4))+offset[i] for i in range(3)]
        impacts.append(dict(type=type,slot=slot,height=height,xyz=xyz,offset=offset,
          copied=[signed(get(copy+0x24+i*4)) for i in range(3)],projected=projected))
    camera=[];WORLD=0x02300000;put(0x02131c40,WORLD)
    for mode in range(10):
      u.mem_write(WORLD+0x1f050,bytes(0x100));put(WORLD+0x1f108,1);put(WORLD+0x1f10c,mode)
      run(0x021117c4,[WORLD,0,12]);active=run(0x02111808,[]);run(0x021117e8,[WORLD])
      camera.append(dict(mode=mode,active=active,restored=[get(WORLD+0x1f108),get(WORLD+0x1f10c)],
        vectorOffset=get(WORLD+0x1f080)-WORLD,speed=get(WORLD+0x1f0c8),
        offset=[signed(get(WORLD+0x1f0a0)),signed(get(WORLD+0x1f0a4))]))
    engagements=[];wrappers=[0x02500000+i*0x1000 for i in range(6)];actors=[0x02510000+i*0x1000 for i in range(6)]
    action=0x02520000;move=0x02522000;team=0x02523000
    for kind in (0,2):
      for mode in range(4):
       for preserve in (False,True):
        engagement_calls.clear()
        for i,(wrapper,actor) in enumerate(zip(wrappers,actors)):
            u.mem_write(wrapper,bytes(0x200));put(wrapper,actor);put(wrapper+4,actor);put(wrapper+0x10,wrapper+0x400)
            put(wrapper+0x450,0 if i==2 else 100);put(wrapper+0x54,team);put(actor+0xd4,0x800000);put(WORLD+0x5e20+i*4,wrapper)
            put(team+i*4,wrapper)
        put(team+0x10,3);put(action+0x20,move);put(move+0x54,mode)
        put(wrappers[3]+0x168,7);put(wrappers[3]+0x17c,15);put(wrappers[3]+0x84,12 if preserve else 3)
        run(0x0210f97c if kind==2 else 0x0210f900,[WORLD,wrappers[0],wrappers[3],action])
        after=dict(locks=[get(p+0x94)==action for p in wrappers],depth=[signed(get(p+0xd4)) for p in actors],
          targetState=get(wrappers[3]+0x168),targetCounter=signed(get(wrappers[3]+0x16c)),notification=get(wrappers[3]+0x17c))
        run(0x0210fa60,[WORLD])
        engagements.append(dict(kind=kind,targetMode=mode,preserve=preserve,after=after,
          releasedLocks=[get(p+0x94) for p in wrappers],releasedDepth=[signed(get(p+0xd4)) for p in actors]))
    branches=[]
    for engaged in (0,1):
        frame_calls.clear()
        for i,p in enumerate(wrappers):put(p+0x94,action if i in (0,3) else 0)
        for i in range(12):
            p=action+i*0x200;put(WORLD+0x47948+i*4,p);put(p,1 if i<2 else 0);put(p+0xe4,wrappers[i%6])
        put(STACK+4,engaged);u.reg_write(UC_ARM_REG_R10,WORLD)
        run(0x0210d478,[])
        branches.append(dict(engaged=engaged,terminal=frame_calls[-1][0],
          objectUpdates=sum(c[0]==0x0211cc7c for c in frame_calls),
          notifications=sum(c[0]==0x02112980 for c in frame_calls),
          animationFlags=[c[2] for c in frame_calls if c[0]==0x02064e20]))
    timing_mode=True;hit_timing=[];gates=[];slowdowns=[]
    for damage in (0,250,251,499,500,999):
      for blocked in (0,1):
       for initial in (0,99):
        put(WORLD+0x1f134,initial);u.reg_write(UC_ARM_REG_R5,damage);u.reg_write(UC_ARM_REG_R8,blocked)
        run(0x02114ed4,[])
        hit_timing.append(dict(damage=damage,blocked=blocked,initial=initial,pause=get(WORLD+0x1f134)))
    for pause in (0,1,4):
      for slow in (0,1,8,9,17):
        frame_calls.clear();put(WORLD+0x1f134,pause);put(WORLD+0x1f138,slow);u.reg_write(UC_ARM_REG_R10,WORLD)
        run(0x0210d42c,[])
        gates.append(dict(pause=pause,slow=slow,after=[get(WORLD+0x1f134),get(WORLD+0x1f138)],runs=frame_calls[-1][0]==0x0210d478))
    for remaining in range(3):
        put(team+0x10,remaining);put(team+0x14,0)
        slowdowns.append(dict(remaining=remaining,duration=run(0x0211272c,[team])))
    return dict(romSha256=hashlib.sha256(raw).hexdigest(),scope='ORIGINAL_ARM_CPU_CONTROLLED_MODEL_RESET_SPRITE_COPY_CELL_HEIGHT_RENDER_UPLOAD_NOTIFICATION_HOST',impacts=impacts,camera=camera,engagements=engagements,frameBranches=branches,hitTiming=hit_timing,timingGates=gates,slowdowns=slowdowns)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    raw=Path(a.rom).read_bytes();assert hashlib.sha256(raw).hexdigest()=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    result=trace(raw);Path(a.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({'impactCases':len(result['impacts']),'cameraCases':len(result['camera'])}))
