"""Original selection + individual constructor + post-constructor CPU oracle.

The ROM and RAM stay private. JSON is RESEARCH_ONLY test evidence; no source
module imports it. Unlike trace-hunt-live-encounter.py this executes 02062C28.
Actor/resource registration is a separate boundary, explicitly not claimed.
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

ROM_SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
BASE = 0x02000000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', required=True)
    ap.add_argument('--field', required=True)
    ap.add_argument('--entry-evidence', default='docs/research/HUNT_ENTRY_ENVIRONMENT_REPLAY_2026-09-06.json')
    ap.add_argument('--out', required=True)
    ap.add_argument('--include-carried', action='store_true')
    ap.add_argument('--carried-only', action='store_true')
    args = ap.parse_args()
    raw = Path(args.rom).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == ROM_SHA
    rom = NintendoDSRom(raw)
    arm = bytes(decompress(rom.arm9))
    ovl = rom.loadArm9Overlays()[0]
    blob = Path(args.field).read_bytes()
    data = zlib.decompress(blob[32:])
    marker = struct.pack('<5I', 4, 8, 24, 60, 400)
    hit = data.index(marker)
    assert data.find(marker, hit + 1) == -1
    ram = data[hit - 0xC8A4C:hit - 0xC8A4C + 0x400000]
    assert ram[0x1000:0x1200] == arm[0x1000:0x1200]
    assert ram[ovl.ramAddress-BASE:ovl.ramAddress-BASE+64] == bytes(ovl.data[:64])
    live = json.loads(Path(args.entry_evidence).read_text(encoding='utf-8'))
    bounds = [e for e in live['initialization'] if e['kind'] == 'spawn-boundary']
    uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    uc.mem_map(BASE, 0x800000)

    def u32(at): return struct.unpack('<I', uc.mem_read(at, 4))[0]
    def put(at, n): uc.mem_write(at, struct.pack('<I', n & 0xffffffff))
    def reg(r): return uc.reg_read(r)
    def utf16(at, limit=64):
        units = []
        for i in range(limit):
            n = struct.unpack('<H', uc.mem_read(at + i*2, 2))[0]
            if n == 0: break
            units.append(n)
        return ''.join(chr(n) for n in units)
    def rng_snapshot():
        return {k: [u32(at+i*4) for i in range(217)] for k, at in [('seeds',0x02104D20),('cursors',0x02105084)]}
    def reset(rng):
        uc.mem_write(BASE, ram)
        uc.mem_write(0x02500000, bytes(0x200000))
        uc.mem_write(0x027D0000, bytes(0x20000))
        for k, at in [('seeds',0x02104D20),('cursors',0x02105084)]:
            for i, n in enumerate(rng[k]): put(at+i*4, n)
        uc.reg_write(UC_ARM_REG_SP, 0x027E0000)
        uc.reg_write(UC_ARM_REG_LR, 0x027F0000)
    def finish(value=0):
        uc.reg_write(UC_ARM_REG_R0, value)
        uc.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))
    # Named only where independently established. Other fields retain offsets.
    scalar_offsets = ([0,4,8,12,16,20,24,0x1c,0x20,0x24,0x28,0x38,0x40,0x48,0x4c]
                      + list(range(0x50,0x194,4)) + list(range(0x198,0x1c8,4)))
    def project(at):
        return {'fields': {f'{off:03x}': u32(at+off) for off in scalar_offsets}, 'name':utf16(at+0x2c, 6),
                'narrowFields':{f'{off:03x}':int.from_bytes(uc.mem_read(at+off,size),'little')
                                for off,size in [(0x3c,1),(0x3d,1),(0x44,1),(0x46,2),(0x194,2)]}}
    scratch, rolls, calls, candidates, selected_table, posts = 0x02500000, [], [], [], None, []
    candidate_input = None
    def hook(machine, address, size, user):
        nonlocal scratch, selected_table, candidate_input
        if address == 0x02050604:
            size = reg(UC_ARM_REG_R0)
            assert 0 < size < 0x10000
            at = scratch
            scratch += (size+31)&~31
            finish(at)
        elif address == 0x02050610: finish()
        elif address == 0x020431D4:
            channel = reg(UC_ARM_REG_R0)
            rolls.append({'channel':channel, 'caller':reg(UC_ARM_REG_LR)})
        elif address == 0x02043230:
            rolls[-1]['value'] = reg(UC_ARM_REG_R0)
        elif address == 0x02062100:
            calls.append({'speciesIndex':reg(UC_ARM_REG_R2), 'traitOverride':reg(UC_ARM_REG_R3), 'rngStart':len(rolls)})
        elif address == 0x02062C28:
            posts.append({'before':project(reg(UC_ARM_REG_R1)), 'rngStart':len(rolls), 'address':reg(UC_ARM_REG_R1)})
        elif address == 0x0211A59C:
            selected_table = reg(UC_ARM_REG_R5)
        elif address == 0x0211B934:
            table, catalog, modifiers = reg(UC_ARM_REG_R5), reg(UC_ARM_REG_R8), reg(UC_ARM_REG_R11)
            count, catalog_count = reg(UC_ARM_REG_R7), reg(UC_ARM_REG_R9)
            entries = struct.unpack('<'+'H'*count, uc.mem_read(table+4,count*2))
            ids = struct.unpack('<'+'H'*catalog_count, uc.mem_read(catalog+2,catalog_count*2))
            candidate_input = {'entries':[{'speciesIndex':n&0xfff,'weight':(n>>12)&7} for n in entries],
                               'speciesOrder':[n&0xfff for n in ids],
                               'reductionBytes':list(uc.mem_read(modifiers,catalog_count))}
        elif address == 0x0211A680:
            n, at = reg(UC_ARM_REG_R0), reg(UC_ARM_REG_R4)
            candidates.extend(struct.unpack('<'+'H'*n, uc.mem_read(at, n*2)))
    uc.hook_add(UC_HOOK_CODE, hook)
    reset(bounds[0]['rng'])
    player = u32(0x020FBA08)
    assert u32(player+0x24) == 0, 'carried-record branch needs a separate oracle'
    # Only this original context is used; no fabricated substitute for released records.
    pool_vectors = []
    cases = [('observed-entry',bounds[0]['rng']), ('continued-after-pool',bounds[1]['rng']),
             ('controlled-released-candidate',bounds[0]['rng']), ('controlled-depleted-released',bounds[0]['rng'])]
    if args.include_carried or args.carried_only: cases.append(('controlled-carried',bounds[0]['rng']))
    observed_first = None
    for case, rng in cases:
        reset(rng)
        scratch, rolls, calls, candidates, posts = 0x02500000, [], [], [], []
        released = None
        carried = None
        if case == 'controlled-carried':
            uc.mem_write(0x02620000, observed_first)
            put(player+0x20,0x02620000); put(player+0x24,1)
            carried = {'individual':project(0x02620000), 'biomeIndex':u32(player+0x10)//2}
        if case in ['controlled-released-candidate','controlled-depleted-released']:
            released = {'speciesIndex':38,'trait':8,'name':'テスト個体'}
            at = u32(player+0x2c)
            put(at,released['speciesIndex']); put(at+4,u32(player+0x10)//2); put(at+8,released['trait'])
            uc.mem_write(at+12,released['name'].encode('utf-16-le')+b'\0\0')
            if case == 'controlled-depleted-released':
                biome = u32(player+0x10)//2
                n = struct.unpack('<H',uc.mem_read(u32(0x020A1358+biome*4),2))[0]
                uc.mem_write(u32(0x020CC4C0+biome*4),bytes([254])*n)
        put(0x0212ABE4+0x68, 0)
        uc.emu_start(0x0211A568, 0x0211AA44, count=4000000)
        assert reg(UC_ARM_REG_PC) == 0x0211AA44
        count, pool = u32(0x0212ABE4+0x68), u32(0x0212ABE4+0x108)
        assert count == len(calls) + (1 if carried else 0) == len(posts) + (1 if carried else 0) and 0 < count <= 24
        records = [project(pool+i*0x1c8) for i in range(count)]
        if released: assert any(r['fields']['048']==2 and r['name']==released['name'] for r in records)
        for p in posts: p['after'] = project(p.pop('address'))
        after = rng_snapshot()
        if case == 'observed-entry':
            observed_first = bytes(uc.mem_read(pool,0x1c8))
            assert after == bounds[1]['rng'], 'full original RNG boundary must match live entry'
            assert [r['fields']['000'] for r in records] == [r['speciesIndex'] for r in live['wildRecords']]
            assert [r['fields']['050'] for r in records] == [r['sourceHp'] for r in live['wildRecords']]
        pool_vectors.append({'case':case, 'rngBefore':rng, 'rngAfter':after,
                             'baseCount':struct.unpack('<H',uc.mem_read(selected_table,2))[0],
                             'candidateInput':candidate_input, 'candidates':candidates, 'released':released,
                             'calls':calls, 'rolls':rolls, 'records':records, 'posts':posts})
        if carried:
            at=u32(player+0x2c)+3*0x18
            pool_vectors[-1].update(carried=carried, historyWrite={'slot':3,'entry':{
                'speciesIndex':u32(at),'biomeIndex':u32(at+4),'trait':u32(at+8),'name':utf16(at+12,6)}})
    # Functional constructor input facts are research fixtures, not ROM records.
    # These never enter the product bundle. Resolve ancestry only for gen > 1.
    species = []
    ancestry_base = u32(0x02062DA4)
    for i in range(228):
        at = 0x020C1374+i*0x84
        b = bytes(uc.mem_read(at,0x84))
        w = lambda off: struct.unpack_from('<I',b,off)[0]
        h = lambda off: struct.unpack_from('<H',b,off)[0]
        gen = w(0x0c)
        ancestors = []
        if 1 < gen < 6 or i == 173:
            ptr = u32(ancestry_base+i*12-0x58)
            n = u32(ptr)
            assert n < 100
            ancestors = [u32(ptr+4+j*4) for j in range(n)]
        species.append({'speciesIndex':i, 'generation':gen, 'attribute':w(0x10), 'baseName':utf16(w(8)),
                        'field1c':b[0x1c], 'field1e':b[0x1e], 'field20':h(0x20), 'field22':h(0x22),
                        'rungs':[h(0x30),h(0x32),h(0x34),h(0x36),b[0x38],b[0x39],*b[0x3c:0x41]],
                        'aiSelectors':[w(0x48),w(0x4c)], 'aiPairs':[[w(o),w(o+4)] for o in [0x50,0x58,0x60]],
                        'ancestors':ancestors})
    individual_vectors = []
    # Every real species, with continuing original RNG, exercises zero divisors,
    # the generation-six exception and ancestry retries beyond the Grass batch.
    reset(bounds[0]['rng'])
    individual_rng_before = rng_snapshot()
    rolls, calls, posts = [], [], []
    for i in range(228):
        start = len(rolls)
        at = 0x02580000
        uc.mem_write(at, bytes(0x1c8))
        uc.reg_write(UC_ARM_REG_SP, 0x027E0000)
        put(0x027E0000, 0)
        uc.reg_write(UC_ARM_REG_R0, at)
        uc.reg_write(UC_ARM_REG_R1, 0)
        uc.reg_write(UC_ARM_REG_R2, i)
        uc.reg_write(UC_ARM_REG_R3, 0xffffffff)
        uc.reg_write(UC_ARM_REG_LR, 0x027F0000)
        uc.emu_start(0x02062100, 0x027F0000, count=100000)
        assert reg(UC_ARM_REG_PC) == 0x027F0000
        built = project(at)
        uc.reg_write(UC_ARM_REG_R0, 0)
        uc.reg_write(UC_ARM_REG_R1, at)
        uc.reg_write(UC_ARM_REG_LR, 0x027F0000)
        uc.emu_start(0x02062C28, 0x027F0000, count=100000)
        assert reg(UC_ARM_REG_PC) == 0x027F0000
        individual_vectors.append({'speciesIndex':i, 'before':built, 'after':project(at), 'rolls':rolls[start:]})
    individual_rng_after = rng_snapshot()
    candidate_vectors = []
    # Controlled byte inputs exercise the original reduction operator separately
    # from the actual entry. They are not labeled as live game histories.
    for label, byte_value in [('actual-state',None), ('zero',0), ('odd-one',1), ('two',2), ('four',4), ('saturated',254)]:
        reset(bounds[0]['rng'])
        scratch = 0x02500000
        player = u32(0x020FBA08)
        biome = u32(player+0x10)//2
        order_at = u32(0x020A1358+biome*4)
        n = struct.unpack('<H',uc.mem_read(order_at,2))[0]
        modifier_at = u32(0x020CC4C0+biome*4)
        if byte_value is not None: uc.mem_write(modifier_at,bytes([byte_value])*n)
        uc.reg_write(UC_ARM_REG_R0,selected_table)
        uc.reg_write(UC_ARM_REG_R1,0x025A0000)
        uc.reg_write(UC_ARM_REG_LR,0x027F0000)
        uc.emu_start(0x0211B8E4,0x027F0000,count=100000)
        assert reg(UC_ARM_REG_PC)==0x027F0000
        count = reg(UC_ARM_REG_R0)
        values = list(struct.unpack('<'+'H'*count,uc.mem_read(0x025A0000,count*2))) if count else []
        assert rng_snapshot()==bounds[0]['rng']
        candidate_vectors.append({'case':label,'input':candidate_input,'candidates':values})
    result = {'status':'FULL_INDIVIDUAL_POOL_CPU_PASS_NOT_NORMAL_ENTRY_ACCEPTANCE', 'runtimeEligible':False,
              'romSha256':ROM_SHA, 'fieldStateSha256':hashlib.sha256(blob).hexdigest(),
              'entryEvidenceSha256':hashlib.sha256(Path(args.entry_evidence).read_bytes()).hexdigest(),
              'controlledBoundaries':['isolated scratch allocator and free', 'loaded field resources from private checkpoint'],
              'excluded':['actor registration and AI initialization', 'position and same-species grouping', 'normal browser integration'],
              'speciesInputs':species, 'poolVectors':pool_vectors, 'individualVectors':individual_vectors,
              'individualRngBefore':individual_rng_before,'individualRngAfter':individual_rng_after,
              'candidateVectors':candidate_vectors}
    if args.carried_only:
        result['poolVectors'] = [v for v in pool_vectors if v['case']=='controlled-carried']
        for key in ['individualVectors','individualRngBefore','individualRngAfter','speciesInputs','candidateVectors']:del result[key]
    Path(args.out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':result['status'],'vectors':[{'case':v['case'],'count':len(v['records']),'rngCalls':len(v['rolls'])} for v in pool_vectors]}))


if __name__ == '__main__': main()
