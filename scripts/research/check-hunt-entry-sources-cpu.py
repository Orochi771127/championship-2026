"""Controlled original CPU Gate node/day-night source probes. Research only.

The loaded model and RAM remain private. Execute the original node resolver,
divider, rotation, normalization and dot product. Hardware arithmetic is the
only adapter; returned Gate facts are not meshes/textures or captured wilds.
"""
import argparse
import hashlib
import json
import math
import struct
import zlib
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *


def main():
    ap=argparse.ArgumentParser()
    for name in ['rom','gate-state','out']:ap.add_argument('--'+name,required=True)
    args=ap.parse_args()
    raw=Path(args.rom).read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ovl=rom.loadArm9Overlays()[12]
    state=Path(args.gate_state).read_bytes();data=zlib.decompress(state[32:]);marker=struct.pack('<5I',4,8,24,60,400)
    hit=data.index(marker);assert data.find(marker,hit+1)==-1
    ram=data[hit-0xc8a4c:hit-0xc8a4c+0x400000]
    assert ram[0x1000:0x1200]==arm[0x1000:0x1200]
    assert ram[ovl.ramAddress-0x2000000:ovl.ramAddress-0x2000000+64]==ovl.data[:64]
    uc=Uc(UC_ARCH_ARM,UC_MODE_ARM);uc.mem_map(0x2000000,0x800000);uc.mem_write(0x2000000,ram)
    uc.mem_map(0x4000000,0x1000)
    get=lambda a:struct.unpack('<I',uc.mem_read(a,4))[0]
    put=lambda a,n:uc.mem_write(a,struct.pack('<I',n&0xffffffff))
    reg=uc.reg_read
    s32=lambda n:n if n<0x80000000 else n-0x100000000
    def hw(machine,access,address,size,value,user):
        if 0x40002a0<=address<0x40002b0:
            mode=int.from_bytes(uc.mem_read(0x4000280,2),'little')&3
            n=int.from_bytes(uc.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
            d=int.from_bytes(uc.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
            q=(-1 if n>=0 else 1) if d==0 else (abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
            rem=n if d==0 else n-q*d
            uc.mem_write(0x40002a0,(q&0xffffffffffffffff).to_bytes(8,'little'))
            uc.mem_write(0x40002a8,(rem&0xffffffffffffffff).to_bytes(8,'little'))
        if address==0x40002b4:
            mode=int.from_bytes(uc.mem_read(0x40002b0,2),'little')&1
            n=int.from_bytes(uc.mem_read(0x40002b8,8 if mode else 4),'little')
            put(0x40002b4,math.isqrt(n))
    uc.hook_add(UC_HOOK_MEM_READ,hw,begin=0x4000280,end=0x40002bf)
    observation={}
    def hook(machine,address,size,user):
        if address==0x210d228:observation['angle']=reg(UC_ARM_REG_R4)
        if address==0x210d264:observation['sunVector']=[s32(get(reg(UC_ARM_REG_SP)+0x24+i*4)) for i in range(3)]
        if address==0x210d290:observation['dotQ12']=s32(reg(UC_ARM_REG_R0))
    uc.hook_add(UC_HOOK_CODE,hook)
    stack,stop,out,obj=0x27e0000,0x27f0000,0x2500000,0x2501000
    def run(start,regs):
        uc.reg_write(UC_ARM_REG_SP,stack);uc.reg_write(UC_ARM_REG_LR,stop)
        for r,n in regs.items():uc.reg_write(r,n&0xffffffff)
        uc.emu_start(start,stop,count=1000000)
        assert reg(UC_ARM_REG_PC)==stop,hex(reg(UC_ARM_REG_PC))
        return reg(UC_ARM_REG_R0)
    # Native OVL12 world object is static, and owns the model resolver used at
    # 0210F02C. Probe all records even when the save has not unlocked the nodes.
    positions=[]
    for i in range(17):
        ok=run(0x210c9d8,{UC_ARM_REG_R0:0x2118790+0x5c,UC_ARM_REG_R1:i,UC_ARM_REG_R2:out})
        assert ok==1,(i,ok)
        positions.append({'gateRecordIndex':i,'positionQ12':[s32(get(out+j*4)) for j in range(3)]})
    assert positions[0]['positionQ12']==[21152,277715,-313654], 'match the untouched Gate node observer'
    vectors=[]
    for node in positions:
        for hour in range(24):
            for j,n in enumerate(node['positionQ12']):put(obj+0x108+j*4,n)
            put(0x210aa98,hour*60)
            observation={}
            night=run(0x210d1a4,{UC_ARM_REG_R0:obj})
            vectors.append({'gateRecordIndex':node['gateRecordIndex'],'hour':hour,'night':night,**observation})
    result={'status':'CONTROLLED_GATE_SOURCE_CPU_NOT_BROWSER_ACCEPTANCE','runtimeEligible':False,
        'romSha256':sha,'stateSha256':hashlib.sha256(state).hexdigest(),
        'boundaries':['loaded private original Gate model','controlled clock hour 0..23','DS divider/sqrt register adapter'],
        'positions':positions,'vectors':vectors}
    Path(args.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'positions':len(positions),'vectors':len(vectors),'grassNightHours':[v['hour'] for v in vectors if v['gateRecordIndex']==0 and v['night']]}))


if __name__=='__main__':main()
