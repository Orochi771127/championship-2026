"""Observe original registration RAM, then probe the carried post-registration branch.

Original stylus replay has no RAM writes. The subsequent Unicorn carried-flag
probe is explicitly controlled; it is not proof of normal carried UI gameplay.
Full memory/checkpoints remain in the private directory.
"""
import argparse, hashlib, json, shutil, struct
from pathlib import Path
from desmume.emulator import DeSmuME
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

def main():
    p=argparse.ArgumentParser()
    for k in ['rom','state','private-dir','out']:p.add_argument('--'+k,required=True)
    a=p.parse_args(); private=Path(a.private_dir); private.mkdir(parents=True,exist_ok=True)
    raw=Path(a.rom).read_bytes(); sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    ramfile=private/'registered.ram'; regfile=private/'registered-registers.json'
    provenance=private/'registered-source.json'
    identity={'romSha256':sha,'stateSha256':hashlib.sha256(Path(a.state).read_bytes()).hexdigest()}
    if provenance.exists():assert json.loads(provenance.read_text())==identity
    if not ramfile.exists() or not provenance.exists():
        rom=private/'probe.nds'; shutil.copyfile(a.rom,rom)
        emu=DeSmuME(); emu.volume_set(0); emu.open(str(rom),auto_resume=False)
        emu.savestate.load_file(str(Path(a.state).resolve())); emu.resume(); saved=[]
        def capture(address,size):
            if not saved:
                regs=emu.memory.register_arm9
                values=[getattr(regs,'r'+str(i)) for i in range(13)]+[regs.sp,regs.lr]
                ramfile.write_bytes(bytes(emu.memory.unsigned[0x02000000:0x02400000:1]))
                regfile.write_text(json.dumps(values),encoding='utf-8'); saved.append(True)
            return True
        emu.memory.register_exec(0x0211aa60,capture,4)
        emu.input.touch_set_pos(128,94)
        for _ in range(6):emu.cycle()
        emu.input.touch_release()
        for _ in range(270):
            emu.cycle()
            if saved:break
        assert saved,'normal stylus did not reach actor registration'
        provenance.write_text(json.dumps(identity),encoding='utf-8')
        emu.close()
    ram=ramfile.read_bytes(); registers=json.loads(regfile.read_text()); results=[]
    for carried in [0,1]:
        cpu=Uc(UC_ARCH_ARM,UC_MODE_ARM); cpu.mem_map(0x02000000,0x800000); cpu.mem_write(0x02000000,ram)
        cpu.mem_map(0x04000000,0x1000)
        get=lambda a:struct.unpack('<I',cpu.mem_read(a,4))[0]
        put=lambda a,v:cpu.mem_write(a,struct.pack('<I',v&0xffffffff))
        for i,reg in enumerate([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3,UC_ARM_REG_R4,UC_ARM_REG_R5,UC_ARM_REG_R6,UC_ARM_REG_R7,UC_ARM_REG_R8,UC_ARM_REG_R9,UC_ARM_REG_R10,UC_ARM_REG_R11,UC_ARM_REG_R12,UC_ARM_REG_SP,UC_ARM_REG_LR]):cpu.reg_write(reg,registers[i])
        stack=registers[13]; put(stack+0x38,carried)
        # Resolve the scene's manager through the original getter itself.
        cpu.reg_write(UC_ARM_REG_LR,0x027f0000); cpu.emu_start(0x0211b324,0x027f0000,count=1000)
        manager=cpu.reg_read(UC_ARM_REG_R0)
        entities=[get(manager+0xc+i*4) for i in range(32)]
        entities=[e for e in entities if e]
        def rows():
            result=[]
            for i,e in enumerate(entities):
                w=get(e+0x704); ai=w+0x73c; actor=get(w+0x34)
                result.append({'index':i,'individualSlot':get(get(w+0x110)+4),'visible':get(e+0x6d4),'positionQ12':[get(actor+0x24+j*4) for j in range(3)],
                  'wildState':cpu.mem_read(w+8,1)[0],'wildRequest':get(w+0x18),
                  'aiState':cpu.mem_read(ai+8,1)[0],'aiRequest':get(ai+0x18),
                  'aiFields':{f'{o:03x}':get(ai+o) for o in range(0x30,0x280,4)}})
            return result
        domains={get(e+0x704)+offset:f'{i}:{name}' for i,e in enumerate(entities)
          for name,offset in [('wild',0),('ai',0x73c),('primary',0x520),('secondary',0x630)]}
        # The getter above does not alter callee-saved registers or entry stack.
        cpu.reg_write(UC_ARM_REG_LR,registers[14]); cpu.reg_write(UC_ARM_REG_SP,stack)
        rolls=[]; dispatch=[]
        def hook(machine,pc,size,user):
            if pc==0x020431d4:rolls.append({'channel':cpu.reg_read(UC_ARM_REG_R0)})
            elif pc==0x02043230:rolls[-1]['value']=cpu.reg_read(UC_ARM_REG_R0)
            elif pc==0x02043e78:dispatch.append({'domain':domains.get(cpu.reg_read(UC_ARM_REG_R0),'other'),
              'state':cpu.reg_read(UC_ARM_REG_R1),'event':cpu.reg_read(UC_ARM_REG_R2)})
        cpu.hook_add(UC_HOOK_CODE,hook)
        before={'guard':get(0x0212acb4),'entities':rows()}
        cpu.emu_start(0x0211aa60,0x0211aa9c,count=3000000)
        assert cpu.reg_read(UC_ARM_REG_PC)==0x0211aa9c
        results.append({'carried':carried,'before':before,'after':rows(),'rolls':rolls,'dispatch':dispatch})
    Path(a.out).write_text(json.dumps({'status':'CONTROLLED_POST_REGISTRATION_BRANCH_ONLY','runtimeEligible':False,
      'romSha256':sha,'normalStateSha256':hashlib.sha256(Path(a.state).read_bytes()).hexdigest(),
      'limits':'Carried flag is controlled after normal registration; no carried source selection or full gameplay acceptance.', 'cases':results},indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps([{'carried':r['carried'],'rolls':len(r['rolls']),'dispatches':len(r['dispatch'])} for r in results]))
if __name__=='__main__':main()
