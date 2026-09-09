"""Execute all remaining 18 OVL19 native bodies against controlled hosts.

Original ARM9 velocity helpers execute; external camera/resource/audio and
angle/vector helpers are recorded controlled boundaries, not gameplay proof.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE,UC_HOOK_MEM_WRITE,UC_HOOK_MEM_READ
from unicorn.arm_const import *

def main():
    p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True)
    p.add_argument('--native-math',action='store_true');args=p.parse_args()
    raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ovl=rom.loadArm9Overlays()[19]
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x400000);u.mem_map(0x04000000,0x1000)
    u.mem_write(0x02000000,arm);u.mem_write(ovl.ramAddress,bytes(ovl.data))
    A,B,OWNER,TARGET,SPRITE,TARGET_SPRITE,POS,MOVE=range(0x2300000,0x2308000,0x1000)
    WORLD=0x2310000;VM=A+0x2a0;STOP=0x23f0000;STACK=0x23e0000
    put=lambda a,v:u.mem_write(a,struct.pack('<I',v&0xffffffff))
    get=lambda a:struct.unpack('<I',u.mem_read(a,4))[0]
    signed=lambda v:v if v<0x80000000 else v-0x100000000
    native_args=[];calls=[];writes=set();settings={}
    arities={0x20472ec:2,0x20472cc:2,0x2047904:2,0x20479a4:3,0x2111808:1,0x2111834:1,
      0x21117c4:3,0x21117e8:1,0x20460e4:3,0x211b264:3,0x207f810:2,0x2003098:2,
      0x2047d98:1,0x211afa4:4,0x203ea30:3,0x20669d8:2,0x2066a40:2}
    if args.native_math:
        for address in [0x2003098,0x20669d8,0x2066a40]:del arities[address]
    def hook(_u,address,size,data):
        if address==0x2054a34:value=native_args[u.reg_read(UC_ARM_REG_R1)]
        elif address in arities:
            values=[signed(u.reg_read(reg)) for reg in [UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3][:arities[address]]]
            if address==0x211afa4:values[3]=[signed(get(values[3]+i*4)) for i in range(3)]
            value=settings.get(str(address),3)
            if address==0x2066a40:
                vec=[values[1]//2,-values[1]//4,0]
                dest=u.reg_read(UC_ARM_REG_R2)
                for i,n in enumerate(vec):put(dest+i*4,n)
                calls.append({'address':address,'args':values,'result':vec});value=0
            else:calls.append({'address':address,'args':values,'result':value})
        else:return
        u.reg_write(UC_ARM_REG_R0,value&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
    def changed(_u,access,address,size,value,data):
        if A<=address<WORLD+0x50000 or address==0x4000000:
            for offset in range(size):writes.add(address+offset)
    u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_WRITE,changed)
    def divider(uc,access,address,size,value,data):
        if 0x40002a0<=address<0x40002b0:
            mode=int.from_bytes(u.mem_read(0x4000280,2),'little')&3
            n=int.from_bytes(u.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
            d=int.from_bytes(u.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
            assert d
            q=(abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
            u.mem_write(0x40002a0,(q&0xffffffffffffffff).to_bytes(8,'little'))
            u.mem_write(0x40002a8,((n-q*d)&0xffffffffffffffff).to_bytes(8,'little'))
    u.hook_add(UC_HOOK_MEM_READ,divider,begin=0x4000280,end=0x40002bf)
    # Every nonzero initial word, including lookup constants the native reads.
    def setup():
        u.mem_write(A,bytes(0x60000));put(0x2131c40,WORLD)
        for address,value in [(A+0xe4,OWNER),(A+0xe8,TARGET),(A+0x20,MOVE),(B+0x2c,POS),
          (OWNER+4,SPRITE),(OWNER+0x2c,POS),(TARGET+4,TARGET_SPRITE),(MOVE+0x10,2),(MOVE+0x1c,0x2120900),
          (MOVE+0x60,3),(POS,100*4096),(POS+4,80*4096),(POS+8,7*4096),
          (SPRITE+0x24,100*4096),(SPRITE+0x28,80*4096),(SPRITE+0x2c,7*4096),
          (SPRITE+0x44,123),(TARGET_SPRITE+0x24,220*4096),(TARGET_SPRITE+0x28,150*4096),
          (0x4000000,0x4001100)]:put(address,value)
    def snapshot():
        rows=[]
        for lo,hi in [(A,WORLD+0x49000),(0x2131bdc,0x2131bf4),(0x212ffb8,0x2130130),(0x2131c40,0x2131c44),(0x4000000,0x4000004)]:
            for at in range(lo,hi,4):
                v=get(at)
                if v:rows.append([at,v])
        return rows
    def run(address,steps=1):
        initial=snapshot();frames=[]
        for frame in range(steps):
            calls.clear();writes.clear()
            for reg,val in [(UC_ARM_REG_R0,VM),(UC_ARM_REG_SP,STACK),(UC_ARM_REG_LR,STOP)]:u.reg_write(reg,val)
            try:u.emu_start(address,STOP,count=100000)
            except Exception as e:raise RuntimeError(f'{address:08X} frame {frame} PC {u.reg_read(UC_ARM_REG_PC):08X}') from e
            assert u.reg_read(UC_ARM_REG_PC)==STOP
            frames.append({'result':signed(u.reg_read(UC_ARM_REG_R0)),'calls':list(calls),
              'writes':[[at,u.mem_read(at,1)[0]] for at in sorted(writes)]})
        return {'address':address,'args':native_args.copy(),'vmAddress':VM,'settings':settings.copy(),'initial':initial,'frames':frames}
    cases=[]
    natives=[0x211cdfc,0x211d06c,0x211d0a4,0x211d0d4,0x211d134,0x211d604,0x211d668,0x211d6cc,
      0x211df68,0x211e088,0x211e1f4,0x211e338,0x211e3a0,0x211e430,0x211e4cc,0x211e9fc]
    for address in natives:
      for variant in range(6):
        setup();native_args=[A,[0,4096,8192,45056,-4096,-1234567][variant],-8192,4096]
        settings={str(0x2111808):variant%2,str(0x2111834):variant//2%2,str(0x211b264):WORLD+0x1f218+0x394 if variant else 0}
        if address==0x211df68:
            put(OWNER+0x94,A if variant%2 else 0)
            for i in range([0,1,2,23,24,0][variant]):put(A+0x24+i*4,B)
        if address==0x211e088:
            for i in range(4):put(A+0x970+i*4,B+i*4)
            VM=A+0x2a0+variant*0x1b4
        else:VM=A+0x2a0
        if address==0x211e3a0:put(WORLD+0x47884,[0,1,15,16,17,0xffffffff][variant])
        if address==0x211e430 and variant%2:put(MOVE+0x1c,0)
        if address==0x211e4cc:native_args[1]=[-4096,0,4096,8192,12288,16384][variant]
        if address==0x211e9fc:native_args=[B,A]
        if address in [0x211d604,0x211d668,0x211d6cc] and variant==0:native_args[0]=0
        cases.append(run(address))
    # Two complete controlled target-motion lifecycles per family, plus branch
    # boundary starts; compare each frame's result, calls and memory writes.
    for address in [0x211e5a0,0x211ea68]:
      for family in range(4):
        setup();put(MOVE+0x10,family);native_args=[B,A];VM=A+0x2a0;settings={str(0x20669d8):1234}
        cases.append(run(address,100))
      for state in range(10):
        setup();put(A+8,state);put(A+12,-1);put(A+0x18,2048);native_args=[B,A];VM=A+0x2a0;settings={str(0x20669d8):-456}
        cases.append(run(address,2))
    report={'romSha256':sha,'overlay19Sha256':hashlib.sha256(bytes(ovl.data)).hexdigest(),
      'boundary':'All 18 bodies execute original ARM. Camera/audio/resource delegates are controlled, not full encounter acceptance.',
      'nativeMath':args.native_math,
      'nativeCount':18,'cases':cases,'frameCount':sum(len(c['frames']) for c in cases)}
    Path(args.out).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f"{len(cases)} cases / {report['frameCount']} frames")
if __name__=='__main__':main()
