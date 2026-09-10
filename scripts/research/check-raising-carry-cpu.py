"""Bounded original OVL18 carry/flight replay; source ROM and RAM stay private."""
import argparse, hashlib, itertools, json, math, random, struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser()
    for key in ['rom','ram','out']:ap.add_argument('--'+key,required=True)
    a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
    assert hashlib.sha256(raw).hexdigest()=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    from ndspy.rom import NintendoDSRom
    overlay=NintendoDSRom(raw).loadArm9Overlays()[18]
    for start,end in [(0x2118948,0x2119520),(0x2112408,0x21125ac)]:
        assert ram[start-0x2000000:end-0x2000000]==bytes(overlay.data[start-overlay.ramAddress:end-overlay.ramAddress])
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x4000000,0x1000)
    actor=0x22e2d40;stop=0x27f0000;body=0;height=33;terrain=0;settled=False;open_call=None
    get=lambda at,n=4:int.from_bytes(u.mem_read(at,n),'little')
    def put(at,n,size=4):u.mem_write(at,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
    def vec(at):return list(struct.unpack('<3i',u.mem_read(at,12)))
    def putvec(at,v):u.mem_write(at,struct.pack('<3i',*v))
    def finish(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
    def hook(_,at,size,user):
        nonlocal settled,open_call
        if at in [0x203ea30,0x2044100]:finish()
        elif at==0x2047d98:finish(height)
        elif at==0x211913c:settled=True;u.reg_write(UC_ARM_REG_PC,stop)
        elif at==0x2112408:
            xptr=u.reg_read(UC_ARM_REG_R1);yptr=u.reg_read(UC_ARM_REG_R2)
            open_call={'x':int.from_bytes(u.mem_read(xptr,4),'little',signed=True),'y':get(yptr)}
            put(xptr,15);put(yptr,12);finish(3)
    def hardware(_,access,at,size,value,user):
        if 0x40002a0<=at<0x40002b0:
            mode=get(0x4000280,2)&3
            n=int.from_bytes(u.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
            d=int.from_bytes(u.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
            assert d
            q=(abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1);put(0x40002a0,q,8);put(0x40002a8,n-q*d,8)
        elif at==0x40002b4:put(at,math.isqrt(get(0x40002b8,8 if get(0x40002b0,2)&1 else 4)))
    u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_READ,hardware,begin=0x4000280,end=0x40002bf)
    def reset():
        nonlocal body,settled,open_call
        u.mem_write(0x2000000,ram);body=get(actor+0x3c);settled=False;open_call=None
        u.mem_write(0x27de000,bytes(0x4000))
    def run(address):
        u.reg_write(UC_ARM_REG_R0,actor);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
        u.emu_start(address,stop,count=100000);assert u.reg_read(UC_ARM_REG_PC)==stop,hex(u.reg_read(UC_ARM_REG_PC))
    carried=[];flights=[];r=random.Random(910)
    for height,x,y in itertools.product([9,32,65],[1,80,180],[1,90,180]):
        reset();previous=[80*4096,100*4096,81920];velocity=[r.randint(-40960,40960),r.randint(-40960,40960),0]
        putvec(body+0x24,previous);putvec(actor+0x13c,velocity);put(0x210a730,x,2);put(0x210a732,y,2);put(0x2128c88,0)
        run(0x2118b04);carried.append(dict(height=height,pointer=dict(x=x,y=y),previous=previous,velocity=velocity,position=vec(body+0x24),output=vec(actor+0x13c)))
    for phase,terrain,z,velocity in itertools.product([0,1,2],[0,1],[0,4096,81920,150000],[[0,0,0],[2048,-2048,-1229],[40000,20000,20000],[-40000,-20000,-20000]]):
        reset();position=[100*4096,100*4096,z];destination=[124*4096,100*4096,0]
        putvec(body+0x24,position);putvec(actor+0x13c,velocity);putvec(actor+0x128,destination);put(actor+0xe,phase,1)
        put(actor+0x434,0);put(0x2128c78,672);put(0x209f714,0)
        grid=get(0x2128c6c);put(grid,84);put(grid+4,24);u.mem_write(get(grid+8),bytes([terrain])*(84*24))
        owners=get(0x2128ccc);u.mem_write(owners,bytes(84*25*4))
        run(0x2118c34)
        flights.append(dict(input=dict(positionQ12=position,velocityQ12=velocity,destinationQ12=destination,phase=phase),terrain=terrain,openCall=open_call,
            output=dict(positionQ12=vec(body+0x24),velocityQ12=vec(actor+0x13c),destinationQ12=vec(actor+0x128),phase=get(actor+0xe,1),contact=bool(get(body+0x440)),settled=settled)))
    output=dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=hashlib.sha256(raw).hexdigest(),ramSha256=hashlib.sha256(ram).hexdigest(),
        boundaries=['audio suppressed','no queued grab command','height supplied to original getter','open-tile helper supplied tile 15,12 distance 3; helper has separate native oracle','flight stops before cage membership'],carried=carried,flights=flights)
    Path(a.out).write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(dict(carried=len(carried),flights=len(flights))))
if __name__=='__main__':main()
