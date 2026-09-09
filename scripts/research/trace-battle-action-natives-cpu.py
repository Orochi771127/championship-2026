"""Original CPU checks for actor primitives and move pointer rewriting.

Only numeric inputs, outputs and delegated helper calls are exported. Geometry
uses a synthetic NCER bank. Animation helper returns are controlled explicitly;
this receipt does not claim a complete encounter or loaded effect resources.
"""
import argparse, hashlib, json, math, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

def main():
    p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);args=p.parse_args()
    raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ovl=rom.loadArm9Overlays()[19]
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x400000);u.mem_map(0x04000000,0x1000)
    u.mem_write(0x02000000,arm);u.mem_write(ovl.ramAddress,bytes(ovl.data))
    A,B,P,H,BANK,RECORD,INDEX=0x02300000,0x02301000,0x02302000,0x02303000,0x02304000,0x02305000,0x02306000
    STOP,STACK=0x023F0000,0x023E0000
    put=lambda a,v:u.mem_write(a,struct.pack('<I',v&0xffffffff))
    half=lambda a,v:u.mem_write(a,struct.pack('<H',v&65535))
    get=lambda a:struct.unpack('<I',u.mem_read(a,4))[0]
    signed=lambda v:v if v<0x80000000 else v-0x100000000
    native_args=[];calls=[];helper_value=3
    helper_arities={0x02047c5c:1,0x02047e38:1,0x02047c6c:1,0x020479a4:3,0x0204730c:3,0x0203eae8:1}
    def hook(_u,address,size,data):
        if address==0x02054a34:
            value=native_args[u.reg_read(UC_ARM_REG_R1)]
        elif address in helper_arities:
            values=[signed(u.reg_read(r)) for r in [UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2][:helper_arities[address]]]
            calls.append({'address':address,'args':values});value=helper_value
        else:return
        u.reg_write(UC_ARM_REG_R0,value&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
    def hardware(_u,access,address,size,value,data):
        if address==0x040002b4:
            n=int.from_bytes(u.mem_read(0x040002b8,8),'little');put(address,math.isqrt(n))
    u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_READ,hardware,begin=0x040002b4,end=0x040002b4)
    cases=[]
    natives=[0x0211cf34,0x0211cf70,0x0211cfac,0x0211d1fc,0x0211d274,0x0211d318,0x0211d360,
             0x0211d384,0x0211d4d0,0x0211d5a0,0x0211e0d4,0x0211e164,0x0211e36c,0x0211e554,0x0211e570]
    watched=[(B,0x6d0),(P,0),(P,4),(P,8),(B,0x5b),(A,0x24),(A,0x84),(A,0x970),(B,8),(B,12)]
    for native in natives:
        for variant in range(6):
            u.mem_write(A,bytes(0x7000));put(A+4,B);put(A+0x2c,P);put(A+0xc8,H);put(H+4,H+16);put(H+16,BANK)
            half(BANK,1);half(BANK+2,1);put(BANK+4,RECORD);put(A+0x70,INDEX);put(INDEX,INDEX+16);half(INDEX+16,0)
            # record box is [highX,highY,lowX,lowY]; native primitive reads it.
            for offset,value in [(8,24),(10,8),(12,-16),(14,-32)]:half(RECORD+offset,value)
            put(A+4,4096) if native in [0x0211d1fc,0x0211d274,0x0211e164] else None
            put(A+8,4096);u.mem_write(A+0x58,bytes([7]));put(A+0x24,B);put(A+0x84,99);put(A+0x970,B)
            u.mem_write(B+0x5b,bytes([1]));put(P,100);put(P+4,200);put(P+8,300)
            scalar=[0,1,4096,65535,-4096,-1234567][variant]
            native_args=[A,scalar,8192]
            if native in [0x0211e0d4,0x0211e570]:native_args=[A,B if variant else 0]
            if native==0x0211e164:
                native_args=[0,A if variant else 0];put(A+0x24,([0,0,200,416,500,-200][variant])*4096);put(A+0x28,100*4096);put(A+0x2c,0)
            if native==0x0211e36c:native_args=[scalar]
            if native in [0x0211d1fc,0x0211d274,0x0211d318,0x0211d360,0x0211d384,0x0211d4d0,0x0211d5a0] and variant==0:native_args[0]=0
            # E570 has no null guard. Keep a valid pointer in its second slot.
            if native==0x0211e570:native_args=[A,B]
            memory=[]
            for obj in [A,B,P,H,H+16,BANK,RECORD,INDEX]:
                for off in range(0,0xc0 if obj==RECORD else 0x9a0 if obj==A else 0x700 if obj==B else 32,4):
                    v=get(obj+off)
                    if v:memory.append([obj,off,v])
            # Halfword/byte reads need address-accurate memory in the JS oracle.
            calls.clear()
            for reg,value in [(UC_ARM_REG_R0,0),(UC_ARM_REG_SP,STACK),(UC_ARM_REG_LR,STOP)]:u.reg_write(reg,value)
            try:u.emu_start(native,STOP,count=20000)
            except Exception as error:raise RuntimeError(f'{native:08X} variant {variant} PC {u.reg_read(UC_ARM_REG_PC):08X}') from error
            assert u.reg_read(UC_ARM_REG_PC)==STOP
            cases.append({'address':native,'args':native_args,'memory':memory,'helperValue':helper_value,'calls':list(calls),
                'result':signed(u.reg_read(UC_ARM_REG_R0)),'writes':[[obj,off,get(obj+off)] for obj,off in watched]})
    roots=[]
    for value in [-1,0,1,2,3,4,15,4095,4096,4097,8192,65536,1048576,0x7fffffff]:
        native_args=[value];u.reg_write(UC_ARM_REG_SP,STACK);u.reg_write(UC_ARM_REG_LR,STOP)
        u.emu_start(0x0211e2c4,STOP,count=20000);assert u.reg_read(UC_ARM_REG_PC)==STOP
        roots.append({'input':value,'result':signed(u.reg_read(UC_ARM_REG_R0))})
    rewrites=[]
    for kind in [0,1,2,3]:
        for p1 in [0,0x02120674,0x02120754,0x02120900]:
            for p2 in [0,0x02120d8a,0x02124d82,0x021212d5]:
                put(A+0x20,B);put(B+0xc,kind);put(B+0x1c,p1);put(B+0x28,p2)
                for reg,value in [(UC_ARM_REG_R2,B),(UC_ARM_REG_R7,A)]:u.reg_write(reg,value)
                u.emu_start(0x0211c174,0x0211c1d4,count=100)
                assert u.reg_read(UC_ARM_REG_PC)==0x0211c1d4
                rewrites.append({'field0C':kind,'pointer1C':p1,'pointer28':p2,'result1C':get(B+0x1c),'result28':get(B+0x28)})
    speeds=[]
    # 021140D4..021140E8 assigns owner+14 = 020C1374 + species*84.
    assert get(0x0211427C)==0x020C1374
    for species in range(228):
        at=0x020C1374+species*0x84;put(A+0x14,at)
        row={'speciesId':species,'movementBase':struct.unpack('<f',u.mem_read(at+0x2c,4))[0]}
        for entry,key in [(0x02114320,'walkQ12'),(0x0211436c,'runQ12')]:
            for reg,value in [(UC_ARM_REG_R0,A),(UC_ARM_REG_SP,STACK),(UC_ARM_REG_LR,STOP)]:u.reg_write(reg,value)
            u.emu_start(entry,STOP,count=200000);assert u.reg_read(UC_ARM_REG_PC)==STOP
            row[key]=signed(u.reg_read(UC_ARM_REG_R0))
        speeds.append(row)
    output={'romSha256':sha,'overlay19Sha256':hashlib.sha256(bytes(ovl.data)).hexdigest(),
        'boundary':'Synthetic actor/cell memory; animation helpers return controlled 3; original ARM executes all tested native bodies',
        'cases':cases,'sqrt':roots,'rewrites':rewrites,'speciesSpeeds':speeds}
    Path(args.out).write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'{len(cases)} native cases, {len(roots)} sqrt cases, {len(rewrites)} pointer rewrite cases')

if __name__=='__main__':main()
