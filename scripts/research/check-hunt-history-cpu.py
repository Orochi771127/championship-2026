"""Execute original Hunt return/history and save/load instructions in isolation.

Controlled RAM inputs are test vectors, not normal entry acceptance. ROM, RAM
and packed saves stay private; only functional projections enter the receipt.
"""
import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

BASE=0x02000000
SHA='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'


def main():
    ap=argparse.ArgumentParser()
    for k in ['rom','field','out']:ap.add_argument('--'+k,required=True)
    args=ap.parse_args();raw=Path(args.rom).read_bytes();assert hashlib.sha256(raw).hexdigest()==SHA
    rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ovl=rom.loadArm9Overlays()[0]
    state=Path(args.field).read_bytes();data=zlib.decompress(state[32:]);marker=struct.pack('<5I',4,8,24,60,400)
    hit=data.index(marker);assert data.find(marker,hit+1)==-1
    ram=data[hit-0xC8A4C:hit-0xC8A4C+0x400000]
    assert ram[0x1000:0x1200]==arm[0x1000:0x1200]
    assert ram[ovl.ramAddress-BASE:ovl.ramAddress-BASE+64]==bytes(ovl.data[:64])
    uc=Uc(UC_ARCH_ARM,UC_MODE_ARM);uc.mem_map(BASE,0x800000)
    def word(a):return int.from_bytes(uc.mem_read(a,4),'little')
    def half(a):return int.from_bytes(uc.mem_read(a,2),'little')
    def put(a,v):uc.mem_write(a,struct.pack('<I',v&0xffffffff))
    def reg(r):return uc.reg_read(r)
    def reset():
        uc.mem_write(BASE,ram);uc.mem_write(0x027D0000,bytes(0x20000))
        for r in range(UC_ARM_REG_R0,UC_ARM_REG_R12+1):uc.reg_write(r,0)
        uc.reg_write(UC_ARM_REG_SP,0x027D0000);uc.reg_write(UC_ARM_REG_LR,0x027F0000)
    def run(start,end):
        uc.emu_start(start,end,count=2000000);assert reg(UC_ARM_REG_PC)==end,hex(reg(UC_ARM_REG_PC))
    def name(a):return bytes(uc.mem_read(a,12)).decode('utf-16-le').split('\0')[0]
    def history():
        p=word(0x020FBA08);h=word(p+0x2c)
        return {'cursor':word(p+0x30),'entries':[{'speciesIndex':word(h+i*24),'biomeIndex':word(h+i*24+4),
                 'trait':word(h+i*24+8),'name':name(h+i*24+12)} for i in range(4)]}
    def set_history(entries,cursor):
        p=word(0x020FBA08);h=word(p+0x2c);put(p+0x30,cursor)
        for i,e in enumerate(entries):
            a=h+i*24
            for o,k in [(0,'speciesIndex'),(4,'biomeIndex'),(8,'trait')]:put(a+o,e[k])
            uc.mem_write(a+12,e['name'].encode('utf-16-le')[:10].ljust(12,b'\0'))
    def rng():return {k:[word(a+i*4) for i in range(217)] for k,a in [('seeds',0x02104D20),('cursors',0x02105084)]}
    reset();player=word(0x020FBA08)
    catalogs=[]
    for i in range(16):
        p=word(0x020A1358+i*4);n=half(p)
        catalogs.append([half(p+2+j*2) for j in range(n)])
    def modifiers(padding=False):
        return [list(uc.mem_read(word(0x020CC4C0+i*4),len(c)+(len(c)%2 if padding else 0))) for i,c in enumerate(catalogs)]
    def set_modifiers(rows):
        for i,row in enumerate(rows):uc.mem_write(word(0x020CC4C0+i*4),bytes(row))
    rolls=[]
    def hook(m,a,size,user):
        if a==0x020431D4:rolls.append({'channel':reg(UC_ARM_REG_R0),'caller':reg(UC_ARM_REG_LR)})
        elif a==0x02043230:rolls[-1]['value']=reg(UC_ARM_REG_R0)
    uc.hook_add(UC_HOOK_CODE,hook)
    # Original empty-history constructor, including its real default name.
    uc.reg_write(UC_ARM_REG_R10,player);uc.reg_write(UC_ARM_REG_R6,word(0x02068820));uc.reg_write(UC_ARM_REG_R7,0)
    run(0x02068824,0x020688C8);initial=history();assert initial['cursor']==0
    entries=[{'speciesIndex':38+i,'biomeIndex':i,'trait':i,'name':f'HIST{i}'} for i in range(4)]
    selections=[]
    for biome in range(16):
        for chosen in [-1,0,1,2,3]:
            reset();e=[dict(x,biomeIndex=33) for x in entries]
            if chosen>=0:e[chosen]['biomeIndex']=biome
            if chosen==0:e[1]['biomeIndex']=biome  # first match wins
            set_history(e,2);put(0x0212ABE4+0xf4,0xffffffff)
            uc.reg_write(UC_ARM_REG_R4,0);uc.reg_write(UC_ARM_REG_R6,0);uc.reg_write(UC_ARM_REG_R7,0xffffffff);uc.reg_write(UC_ARM_REG_R8,biome)
            run(0x0211A600,0x0211A660)
            slot=word(0x0212ABE4+0xf4)
            selections.append({'biomeIndex':biome,'history':history(),'selected':None if slot==0xffffffff else {'slot':slot,'entry':history()['entries'][slot]}})
    returns=[]
    cases=[]
    for value in [0,1,7,8,15,254,255]:cases.append((f'normal-byte-{value}',[(0,0)],0,-1,0,38,value))
    cases += [('duplicate-first-match',[(0,0),(0,0)],0,-1,0,38,6),
              ('recaptured-clear-selected',[(38,2)],0,1,2,38,6),
              ('carried-returned',[(38,1)],1,-1,2,38,6),
              ('carried-lost-wrap',[],1,-1,2,38,6),
              ('mixed-return',[(38,1),(38,2),(0,0)],1,1,1,38,6)]
    for cursor in range(3):cases.append((f'carried-lost-cursor-{cursor}',[],1,-1,cursor,38,6))
    for value in [0,1,2,3,8,255]:cases.append((f'controlled-mask700-species0-{value}',[],1,-1,0,0,value))
    # All 228 species exercise return resource updates, RNG and zero divisors.
    cases.append(('all-species-return',[(i,0) for i in range(228)],0,-1,0,38,6))
    for label,cards,carried,selected,cursor,pending_species,value in cases:
        reset();rolls=[];e=[dict(x) for x in entries];e[3]['speciesIndex']=pending_species;e[3]['biomeIndex']=0
        set_history(e,cursor);before_history=history();rows=[[0]*len(c) for c in catalogs];rows[0][0]=value;set_modifiers(rows)
        # Catalog first species is read from the actual ROM. Synthetic species0
        # records above mean 'first catalog species' except the explicit 700 mask cases.
        effective=[(catalogs[0][0]&0xfff if i==0 and label!='all-species-return' else i,tag) for i,tag in cards]
        at=0x02600000;uc.mem_write(at,bytes(max(1,len(cards))*0x1c8))
        for i,(species,tag) in enumerate(effective):put(at+i*0x1c8,species);put(at+i*0x1c8+0x48,tag)
        put(player+0x10,0);put(player+0x20,at);put(player+0x24,len(cards));put(player+0xc0,37)
        put(0x0212ABE4+0x50,carried);put(0x0212ABE4+0xf4,selected)
        before_rng=rng();before_modifiers=modifiers()
        run(0x02118AB8,0x02119804)
        results=[{'speciesIndex':word(at+i*0x1c8),'sourceTag':word(at+i*0x1c8+0x48),
                  'field008':word(at+i*0x1c8+8),'field00c':word(at+i*0x1c8+12),'field178':word(at+i*0x1c8+0x178)} for i in range(len(cards))]
        returns.append({'case':label,'biomeIndex':0,'carriedAtEntry':bool(carried),'releasedSlot':None if selected==-1 else selected,
                        'historyBefore':before_history,'historyAfter':history(),'modifiersBefore':before_modifiers,'modifiersAfter':modifiers(),
                        'recordsBefore':[{'speciesIndex':i,'sourceTag':tag} for i,tag in effective],'recordsAfter':results,
                        'rngBefore':before_rng,'rngAfter':rng(),'rolls':rolls})
    species=[]
    for i in range(228):
        at=0x020C1374+i*0x84;species.append({'speciesIndex':i,'field1c':uc.mem_read(at+0x1c,1)[0],'field20':half(at+0x20),'field22':half(at+0x22)})
    # Original codecs, not a Python imitation. Roundtrip nonzero traits to
    # expose omitted fields; poison temporary slot3 to show loader preserves it.
    saves=[]
    for cursor in range(3):
        reset();set_history(entries,cursor);before=history();rows=[[(i+j*3+cursor)%16 for j in range(len(c)+(len(c)%2))] for i,c in enumerate(catalogs)];set_modifiers(rows)
        sp=0x027D0000;uc.reg_write(UC_ARM_REG_R4,0);run(0x02069F2C,0x0206A018)
        packed_history=bytes(uc.mem_read(sp+0xca0,60));packed_cursor=word(sp+0xc9c)&3
        dest=0x02680000;uc.reg_write(UC_ARM_REG_R3,0x020A1358);uc.reg_write(UC_ARM_REG_R1,dest);uc.reg_write(UC_ARM_REG_R6,0);uc.reg_write(UC_ARM_REG_R12,0)
        run(0x02072958,0x020729B4);packed_size=reg(UC_ARM_REG_R6)
        # Reconstruct the history load stack from the original encoded fields.
        uc.mem_write(sp+0x1070,packed_history);put(sp+0x106c,packed_cursor)
        stale=[dict(x,speciesIndex=100+i,trait=7,name='STALE') for i,x in enumerate(entries)];set_history(stale,2)
        run(0x0206AF34,0x0206B058);after=history()
        set_modifiers([[255]*len(row) for row in rows]);uc.reg_write(UC_ARM_REG_R3,0x020A1358);uc.reg_write(UC_ARM_REG_R0,dest);uc.reg_write(UC_ARM_REG_R6,0);uc.reg_write(UC_ARM_REG_R12,0)
        run(0x0207AD30,0x0207AD8C)
        saves.append({'case':f'cursor-{cursor}','historyBefore':before,'loadBaseline':{'cursor':2,'entries':stale},'historyAfter':after,
                      'modifiersBefore':rows,'modifiersAfter':modifiers(True),'packedModifierByteCount':packed_size})
    out={'schemaVersion':1,'classification':'RESEARCH_ONLY','runtimeEligible':False,'romSha256':SHA,'sourceStateSha256':hashlib.sha256(state).hexdigest(),
         'scope':'Controlled original ARM9/OVL0 instructions; excludes UI prefix of return, binary compression/flash transport and normal browser entry.',
         'initialHistory':initial,'selectionVectors':selections,'packedSpeciesCatalogs':catalogs,'speciesInputs':species,'returnVectors':returns,'saveVectors':saves,
         'normalSpawnRuntimeBound':False,'normalEntryCapturePlayable':False}
    Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({'returns':len(returns),'saveRoundtrips':len(saves),'returnRecords':sum(len(v['recordsAfter']) for v in returns),'out':args.out}))


if __name__=='__main__':main()
