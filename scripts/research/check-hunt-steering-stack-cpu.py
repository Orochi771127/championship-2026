"""Research-only CPU probe of OVL0 unassigned steering stack inputs.
Synthetic scratch values never enter player saves or production assets.
"""
import argparse, hashlib, json, struct, zlib
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_SP, UC_ARM_REG_PC

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--state',required=True);ap.add_argument('--out',required=True);args=ap.parse_args()
    raw=Path(args.state).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='3b1a13a0e517722f094d0a6454f773a3b2f55b6f0b0994d4788447b5650940ae'
    data=zlib.decompress(raw[32:]);offset=data.index(struct.pack('<5I',4,8,24,60,400))-0xC8A4C;ram=data[offset:offset+0x400000]
    m=Uc(UC_ARCH_ARM,UC_MODE_ARM);m.mem_map(0x02000000,0x800000);m.mem_write(0x02000000,ram)
    def get(a):return struct.unpack('<I',m.mem_read(a,4))[0]
    def put(a,v):m.mem_write(a,struct.pack('<I',v&0xffffffff))
    def vec(a,v=None):
        if v is not None:m.mem_write(a,struct.pack('<3i',*v))
        else:return list(struct.unpack('<3i',m.mem_read(a,12)))
    wild=get(get(get(0x0210AA1C)+12+7*4)+0x704);ai=wild+0x73C;actor=get(wild+0x34);attr=get(get(0x0210AA1C)+8)
    m.reg_write(UC_ARM_REG_SP,0x027FF000);m.reg_write(UC_ARM_REG_R0,ai)
    m.emu_start(0x02111300,0x02111324,count=100)
    assert m.reg_read(UC_ARM_REG_PC)==0x02111324
    enter8Direction=vec(ai+0x60);assert enter8Direction==[0,1,0]
    rows=[];before=[-3100,1700,0]
    for flags in [0,0x20,0x40,0x60]:
        for low in range(16):
            for scratch in [[0,0,0],[4096,-4096,99],[-8192,2048,-99]]:
                vec(actor+0x24,[65536,65536,0]);put(ai+0x1A0,0);vec(ai+0x60,before)
                m.mem_write(get(attr+8)+2*get(attr)+2,bytes([flags|low]))
                # push 9 registers, sub sp,0x54: local +0x48 is entry SP-0x30.
                vec(0x027FF000-0x30,scratch)
                m.reg_write(UC_ARM_REG_SP,0x027FF000);m.reg_write(UC_ARM_REG_R0,ai);m.reg_write(UC_ARM_REG_R1,3)
                m.emu_start(0x0210D8B4,0x0210DEEC,count=1000)
                assert m.reg_read(UC_ARM_REG_PC)==0x0210DEEC
                rows.append({'attribute':flags|low,'before':before,'scratchBefore':scratch,'scratchAfter':vec(0x027FF000-0x30),'directionAfter':vec(ai+0x60)})
    groups=[rows[i:i+3] for i in range(0,len(rows),3)]
    for g in groups:
        dependent=len({tuple(r['directionAfter']) for r in g})>1
        assert dependent == ((g[0]['attribute']&15)>=12)
        assert all(r['scratchAfter'][2]==0 for r in g)
    result={'evidence':'BOUNDED_NATIVE_REPLAY','inputClass':'SYNTHETIC_STACK_INPUTS_NOT_LIVE_PLAY','stateSha256':sha,'entry':'0210D8B4','stop':'0210DEEC','enter8Direction':enter8Direction,'cases':rows,'conclusion':'12..15 read unwritten stack X/Y; all tested flag classes depend on prior scratch. 0..11 overwrite X/Y. Z is always initialized to zero. This does not establish a live caller stack producer or authorize a replacement direction.'}
    Path(args.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps({'cases':len(rows),'stackDependentGroups':sum((g[0]['attribute']&15)>=12 for g in groups)}))
if __name__=='__main__':main()
