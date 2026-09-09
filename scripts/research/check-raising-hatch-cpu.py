"""Original egg state, age-clock and ancestry choice; no rendering substitutes."""
import argparse,hashlib,itertools,json
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser()
    for k in ['rom','out']:ap.add_argument('--'+k,required=True)
    a=ap.parse_args();raw=Path(a.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    r=NintendoDSRom(raw);o=r.loadArm9Overlays()[18];u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
    u.mem_write(r.arm9RamAddress,bytes(decompress(r.arm9)));u.mem_write(o.ramAddress,bytes(o.data))
    actor,record,body,stop=0x2500000,0x2501000,0x2502000,0x27f0000
    context=0x2128c60;params={};requests=[];target=None
    def get(at,n=4):return int.from_bytes(u.mem_read(at,n),'little')
    def put(at,v,n=4):u.mem_write(at,(v&((1<<(8*n))-1)).to_bytes(n,'little'))
    def reg(r):return u.reg_read(r)
    def finish(v=0):u.reg_write(UC_ARM_REG_R0,v&0xffffffff);u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
    def hook(_,at,size,user):
        nonlocal target
        if at==0x207bc7c:finish(params['running'])
        elif at==0x207bc8c:finish(params['minuteDelta'])
        elif at==0x2044100:finish(int(params.get('touch',False)))
        elif at==0x2047c48:finish(int(params.get('animationComplete',False)))
        elif at==0x2047984:requests.append(reg(UC_ARM_REG_R1));finish()
        elif at==0x203ea30:finish()
        elif at==0x20431d4:finish(params['roll'])
        elif at==0x21173c0:target=reg(UC_ARM_REG_R1);u.emu_stop()
    u.hook_add(UC_HOOK_CODE,hook)
    def run(at,expectStop=True):
        u.reg_write(UC_ARM_REG_R0,actor);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
        u.emu_start(at,stop,count=20000)
        if expectStop:assert reg(UC_ARM_REG_PC)==stop
        return reg(UC_ARM_REG_R0)
    clocks=[]
    for running,remainder,minuteDelta in itertools.product([0,1],range(5),range(8)):
        params=dict(running=running,minuteDelta=minuteDelta);put(context+0x3c,remainder);put(context+0x50,111)
        run(0x211e194);clocks.append(dict(**params,remainder=remainder,afterRemainder=get(context+0x3c),ageDelta=get(context+0x50)))
    eggs=[]
    for phase,age,delta,touches,touch,complete in itertools.product([0,1],[0,59,60,61],[0,1,2],[0,2,3],[False,True],[False,True]):
        params=dict(touch=touch,animationComplete=complete);requests=[]
        u.mem_write(actor,bytes(0x800));put(actor+0x114,record);put(actor+0x3c,body)
        put(record,0);put(record+0x18c,age);put(actor+0x428,60);put(actor+0x1e4,touches);put(actor+0xe,phase,1);put(context+0x50,delta)
        result=run(0x211c7c4)
        eggs.append(dict(phase=phase,age=age,delta=delta,touches=touches,touch=touch,complete=complete,
                         afterAge=get(record+0x18c),afterTouches=get(actor+0x1e4),afterPhase=get(actor+0xe,1),result=result,requests=requests))
    selections=[]
    for first,second,roll in itertools.product([228,14],[228,12],range(102)):
        params=dict(roll=roll);target=None;put(actor+0x114,record);put(actor+0x46c,0x26);put(record+0x140,first);put(record+0x158,second)
        run(0x2116db8,False);assert target is not None
        selections.append(dict(first=first,second=second,roll=roll,target=target))
    Path(a.out).write_text(json.dumps(dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,
        clocks=clocks,eggs=eggs,selections=selections),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(f'PASS: {len(clocks)} clock, {len(eggs)} egg, {len(selections)} hatch choices')

if __name__=='__main__':main()
