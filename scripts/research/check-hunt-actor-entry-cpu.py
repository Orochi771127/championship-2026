"""Original CPU actor initialization and grouping, plus untouched entry receipt.

No ROM/RAM/grid payload is exported. Only functional inputs, observed queries,
and numeric outputs go to RESEARCH_ONLY tests. Controlled cases are labelled.
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


def main():
    ap = argparse.ArgumentParser()
    for name in ['rom', 'field', 'live', 'out']: ap.add_argument('--'+name, required=True)
    args = ap.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom = NintendoDSRom(raw)
    arm = bytes(decompress(rom.arm9))
    ovl = rom.loadArm9Overlays()[0]
    state = Path(args.field).read_bytes()
    data = zlib.decompress(state[32:])
    marker = struct.pack('<5I', 4,8,24,60,400)
    hit = data.index(marker)
    assert data.find(marker, hit+1) == -1
    ram = data[hit-0xC8A4C:hit-0xC8A4C+0x400000]
    assert ram[0x1000:0x1200] == arm[0x1000:0x1200]
    assert ram[ovl.ramAddress-0x02000000:ovl.ramAddress-0x02000000+64] == ovl.data[:64]
    live = json.loads(Path(args.live).read_text(encoding='utf-8'))
    assert not live['hookErrors'] and live['inputAuthority'] == 'Original DeSmuME stylus and cycles; no RAM writes'
    uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    uc.mem_map(0x02000000, 0x800000)
    uc.mem_write(0x02000000, ram)
    get = lambda a: struct.unpack('<I',uc.mem_read(a,4))[0]
    put = lambda a,n: uc.mem_write(a,struct.pack('<I',n&0xffffffff))
    reg = uc.reg_read
    ai, individual, actor, stack, stop = 0x02500000,0x02501000,0x02502000,0x027D0000,0x027F0000
    controlled, calls, queries = None, [], []
    def finish(value):
        uc.reg_write(UC_ARM_REG_R0,value&0xffffffff)
        uc.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
    def hook(machine,address,size,user):
        if address == 0x020431D4:
            calls.append({'channel':reg(UC_ARM_REG_R0)})
            if controlled is not None:
                value=controlled[len(calls)-1]
                calls[-1]['value']=value
                finish(value)
        elif address == 0x02043230: calls[-1]['value']=reg(UC_ARM_REG_R0)
        elif address == 0x0211B280: queries.append({'tile':[reg(UC_ARM_REG_R1),reg(UC_ARM_REG_R2)]})
        elif address == 0x0211B284: queries[-1]['terrain']=reg(UC_ARM_REG_R0)
    uc.hook_add(UC_HOOK_CODE,hook)
    def run(start,end=stop,registers=None):
        uc.reg_write(UC_ARM_REG_SP,stack)
        uc.reg_write(UC_ARM_REG_LR,stop)
        for r,n in (registers or {}).items():uc.reg_write(r,n&0xffffffff)
        uc.emu_start(start,end,count=3000000)
        assert reg(UC_ARM_REG_PC)==end,hex(reg(UC_ARM_REG_PC))
    ai_vectors=[]
    draws = [[a,b,c] for a in [0,51,102] for b in [0,102] for c in range(103)]
    draws += [[a,1,37] for a in range(103)]
    for controlled in draws:
        calls=[]
        uc.mem_write(ai,bytes(0x280))
        # Start after the prologue, stop before pop. All original constructor
        # arithmetic/state writes execute, including float conversion helpers.
        run(0x0210D240,0x0210D3C8,{UC_ARM_REG_R0:ai})
        ai_vectors.append({'draws':controlled,'calls':calls,
                           'fields':{f'{o:03x}':get(ai+o) for o in [0x54,0x1d8,0x1e0,0x1e4]}})
    controlled=None
    species_inputs=[]
    speed_vectors=[]
    for species in range(228):
        at=0x020C1374+species*0x84
        source={'speciesIndex':species,'movementBase':struct.unpack('<f',uc.mem_read(at+0x2c,4))[0],
                'aiSelectors':[get(at+0x48),get(at+0x4c)]}
        species_inputs.append(source)
        for trait in range(9):
            put(individual,species);put(individual+0x18,trait)
            run(0x0210D5DC,registers={UC_ARM_REG_R0:ai,UC_ARM_REG_R1:actor,UC_ARM_REG_R2:individual,UC_ARM_REG_R3:actor+0x24})
            value=get(ai+0x44)
            speed_vectors.append({'speciesIndex':species,'trait':trait,'speedQ12':value if value<0x80000000 else value-0x100000000})
    def snapshot():return {k:[get(a+i*4) for i in range(217)] for k,a in [('seeds',0x02104D20),('cursors',0x02105084)]}
    groups=[e for e in live['events'] if e['kind']=='group-boundary']
    assert len(groups)==2
    group_vectors=[]
    for case in ['observed-group','controlled-skip-carried','controlled-blocked-limit']:
        uc.mem_write(0x02000000,ram)
        before=groups[0]
        for k,a in [('seeds',0x02104D20),('cursors',0x02105084)]:
            for i,n in enumerate(before['rng'][k]):put(a+i*4,n)
        rows=before['wildRecords']
        for row in rows:
            put(row['actorAddress']+0x24,row['positionQ12'][0]);put(row['actorAddress']+0x28,row['positionQ12'][1])
        first=1 if case=='controlled-skip-carried' else 0
        put(get(0x020FBA08)+0x24,first)
        if case=='controlled-blocked-limit':
            grid=get(get(0x0210AA1C)+4)
            uc.mem_write(get(grid+8),bytes([1])*(get(grid)*get(grid+4)))
        put(stack+0x2c,len(rows))
        calls,queries=[],[]
        run(0x0211B118,0x0211B2F0)
        after=[{ 'speciesIndex':row['speciesIndex'],
                 'positionQ12':[get(row['actorAddress']+0x24),get(row['actorAddress']+0x28),0]} for row in rows]
        if case=='observed-group':
            assert [r['positionQ12'][:2] for r in after]==[r['positionQ12'] for r in groups[1]['wildRecords']]
            assert snapshot()==groups[1]['rng']
        group_vectors.append({'case':case,'firstIndex':first,'rngBefore':before['rng'],'rngAfter':snapshot(),
            'before':[{'speciesIndex':r['speciesIndex'],'positionQ12':r['positionQ12']+[0]} for r in rows],
            'after':after,'rolls':calls,'queries':queries})
    selected_kinds=['gate-variant','spawn-boundary','ai-constructor','ai-individual-bind','range-rng',
                    'spawn-terrain-repair','actor-initialization','actors-registered','scene-effect-input',
                    'group-boundary','group-terrain-query','probability-call']
    entry={'actions':live['actions'],'events':[e for e in live['events'] if e['kind'] in selected_kinds and e.get('rngStart',0)<=492],
           'rngBefore':[e for e in live['events'] if e['kind']=='spawn-boundary'][0]['rng'],
           'rngAfter':groups[1]['rng'],'rolls':live['rngCalls'][:groups[1]['rngOffset']]}
    result={'status':'CPU_AND_OBSERVED_ENTRY_COMPONENTS_NOT_NORMAL_BROWSER_ACCEPTANCE','runtimeEligible':False,
        'romSha256':sha,'stateSha256':hashlib.sha256(state).hexdigest(),
        'liveSha256':hashlib.sha256(Path(args.live).read_bytes()).hexdigest(),
        'aiVectors':ai_vectors,'speciesInputs':species_inputs,'speedVectors':speed_vectors,'groupVectors':group_vectors,'entry':entry}
    with Path(args.out).open('w',encoding='utf-8',newline='\n') as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'ai':len(ai_vectors),'speed':len(speed_vectors),'groups':[(v['case'],len(v['rolls'])) for v in group_vectors],'entryRng':len(entry['rolls'])}))


if __name__=='__main__':main()
