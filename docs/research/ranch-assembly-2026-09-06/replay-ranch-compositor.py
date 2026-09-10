"""Replay original ARM9 tile-copy loops with exact ROM field arrays (research only).

No function stubs, no graphics output, no application/save mutation. Inputs are
decoded research fixtures; only generic algorithms may be ported into src/.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import capstone
import ndspy.rom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import *

SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
OUT = Path(__file__).with_name("native-compositor-receipt.json")
CTX, OBJ, NBS, ATR, COL = 0x02200000, 0x02210000, 0x02214000, 0x02218000, 0x02218100
AB, CB, TILES, ATTRS, COLS, OWNERS = 0x02219000, 0x0221a000, 0x02220000, 0x02230000, 0x02240000, 0x02250000
IDS, SIZES, STACK = 0x02260000, 0x02260100, 0x023ef000


def build(path):
    raw = Path(path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA, "ROM_HASH_MISMATCH"
    rom = ndspy.rom.NintendoDSRom(raw)
    uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    uc.mem_map(0x02000000, 0x400000)
    for section in rom.loadArm9().sections:
        if section.data and not 0x02000000 <= section.ramAddress < 0x02400000:
            lo = section.ramAddress & ~0xfff
            uc.mem_map(lo, (section.ramAddress-lo+len(section.data)+0xfff) & ~0xfff)
        uc.mem_write(section.ramAddress, bytes(section.data))

    def w(addr, *values):
        uc.mem_write(addr, struct.pack('<'+'I'*len(values), *[v & 0xffffffff for v in values]))

    def rd(addr):
        return struct.unpack('<I', uc.mem_read(addr, 4))[0]

    def run(start, end, regs):
        uc.reg_write(UC_ARM_REG_SP, STACK)
        for reg, value in regs.items(): uc.reg_write(reg, value)
        uc.emu_start(start, end, count=1000000)
        assert uc.reg_read(UC_ARM_REG_PC) == end, "INSTRUCTION_BUDGET_EXHAUSTED"

    inputs = {}
    source_receipts = []

    def source(name):
        if name in inputs: return inputs[name]
        payloads = {}
        for extension in ('nbs', 'atr', 'col'):
            p = f'training/{name}.{extension}'
            fid = rom.filenames.idOf(p)
            if fid is None:
                assert name == 'training_bg_wall' and extension != 'nbs'
                continue
            data = bytes(rom.files[fid]); payloads[extension] = data
            source_receipts.append({'path': p, 'fileId': fid, 'sha256': hashlib.sha256(data).hexdigest()})
        nbs = payloads['nbs']; width, height = struct.unpack_from('<II', nbs, 8)
        assert nbs[:4] == b'NBSR' and len(nbs) == 20+width*height*2
        row = {'width': width, 'height': height, 'tiles': list(struct.unpack_from('<'+'H'*(width*height), nbs, 20))}
        if 'atr' in payloads:
            atr, col = payloads['atr'], payloads['col']
            assert struct.unpack_from('<II', atr, 8) == (width, height)
            assert tuple(col[1:3]) == (width, height)
            row.update(attributes=list(atr[16:]), collision=list(col[3:]))
        inputs[name] = row
        return row

    masks = list(uc.mem_read(rd(0x02082790), 16))
    defs = []
    for i in range(37):
        p = rd(0x020c8cc0+i*40)
        name = bytes(uc.mem_read(p, 40)).split(b'\0')[0].decode('ascii')
        defs.append({'definition': i, 'fieldId': name, 'shape': rd(0x020c8cbc+i*40)})
        source(name)
    source('training_bg_wall')

    native_initial = {'tiles':0, 'attributes':1, 'collision':0, 'owners':-1}
    def initialize(width, initial=None):
        # Nonzero initial planes make skip-vs-overwrite visible in the oracle.
        size = width*24
        initial = initial or {'tiles':17, 'attributes':9, 'collision':7, 'owners':-1}
        uc.mem_write(TILES, struct.pack('<'+'H'*size, *([initial['tiles']]*size)))
        uc.mem_write(ATTRS, bytes([initial['attributes']])*size)
        uc.mem_write(COLS, bytes([initial['collision']])*size)
        uc.mem_write(OWNERS, struct.pack('<'+'i'*size, *([initial['owners']]*size)))
        w(CTX+0x3000, TILES, ATTRS, COLS, OWNERS)
        w(CTX+0x3020, width, 24)
        w(CTX+0x3030, IDS)
        w(STACK+0x1c, CTX)
        w(STACK+0x30, 0)
        w(STACK+0x34, COL, ATR, OBJ)
        w(STACK+0x6c, COL, ATR)
        w(CTX+0x301c, 0)  # filler index 0 for isolated filler copy

    def copy(step, width):
        inp = inputs[step['fieldId']]
        sw, sh = inp['width'], inp['height']
        uc.mem_write(NBS, struct.pack('<'+'H'*(sw*sh), *inp['tiles']))
        w(OBJ+0x309c, sw, sh, NBS)
        w(IDS, step['definition'])
        if step['mode'] == 'wall':
            w(STACK+0x4c, OBJ)
            w(STACK+0x68, SIZES)
            w(SIZES, 0)
            w(CTX+0x3010, width//6, 1)
            run(0x02082bc4, 0x02082cc8, {UC_ARM_REG_R11: step['tileBase']})
            return
        w(ATR, sw, sh, AB)
        w(COL+8, CB)
        uc.mem_write(AB, bytes(inp['attributes']))
        uc.mem_write(CB, bytes(inp['collision']))
        anchor = step['anchor']
        row = anchor % 2
        origin_x = anchor//2*12 + row*6
        if step['mode'] == 'ordinary' and not (masks[step['shape']] & 1): origin_x += 6
        offset = row*8*width + origin_x
        if step['mode'] == 'ordinary':
            w(STACK+0x5c, offset)
            run(0x02082874, 0x02082994, {UC_ARM_REG_R4: row*8, UC_ARM_REG_R11: step['tileBase']})
        else:
            w(STACK+0x54, offset)
            w(STACK+0x40, step['tileBase'])
            run(0x02082a90, 0x02082ba0, {UC_ARM_REG_R0: sh, UC_ARM_REG_R4: row*8,
                                         UC_ARM_REG_R5: sw, UC_ARM_REG_R7: NBS})

    def digest(width):
        return {name: hashlib.sha256(bytes(uc.mem_read(addr, width*24*stride))).hexdigest()
                for name, addr, stride in [('tiles',TILES,2),('attributes',ATTRS,1),('collision',COLS,1),('owners',OWNERS,4)]}

    cases = []
    for slots in (14, 16, 18, 20):
        width = slots//2*12
        for row in defs[:36]:
            mask = masks[row['shape']]
            anchors = [0] if row['definition'] == 35 else [a for a in range(4, slots)
                if not ((mask << a) & ~((1 << slots)-1)) and not (a%2 and mask & 0xaa)]
            for anchor in sorted(set(anchors[:2]+anchors[-2:])):
                step = dict(row, mode='ordinary', anchor=anchor, tileBase=128)
                initialize(width); copy(step,width)
                cases.append({'name':f"rank{slots}-{row['definition']}-{anchor}", 'width':width, 'steps':[step], 'digests':digest(width)})
        for anchor in (4,5,slots-2,slots-1):
            step = dict(defs[36], mode='filler', anchor=anchor, tileBase=256)
            initialize(width); copy(step,width)
            cases.append({'name':f'filler{slots}-{anchor}','width':width,'steps':[step],'digests':digest(width)})
        wall = {'fieldId':'training_bg_wall','definition':-1,'mode':'wall','tileBase':512}
        # Actual mixed-size assembly, fixed Waiting Room and all uncovered slots.
        steps = [dict(defs[35],mode='ordinary',anchor=0,tileBase=128),
                 dict(defs[0],mode='ordinary',anchor=4,tileBase=512),
                 dict(defs[1],mode='ordinary',anchor=6,tileBase=1024)]
        occupied = 15 | (1<<4) | (7<<6)
        steps += [dict(defs[36],mode='filler',anchor=a,tileBase=2048) for a in range(4,slots) if not occupied & (1<<a)]
        steps.append(wall)
        initialize(width)
        for step in steps: copy(step,width)
        cases.append({'name':f'mixed{slots}','width':width,'steps':steps,'digests':digest(width)})
        initialize(width, native_initial)
        for step in steps: copy(step,width)
        cases.append({'name':f'mixed-native-initial{slots}','width':width,'initial':native_initial,
                      'steps':steps,'digests':digest(width)})
        initialize(width); copy(wall,width)
        cases.append({'name':f'wall{slots}','width':width,'steps':[wall],'digests':digest(width)})

    # Execute the four native record-initialization segments including actual
    # definition/anchor setters. This proves writes, not a full New Game trace.
    initial_records = []
    for lo,hi in [(0x02067c64,0x02067c84),(0x02067e68,0x02067e88),
                  (0x02068070,0x02068090),(0x02068270,0x02068290)]:
        record = STACK+0x6d8
        uc.mem_write(record, bytes(0x64))
        run(lo,hi,{})
        initial_records.append({'start':hex(lo),'endExclusive':hex(hi),'definitionIndex':rd(record+4),
                                'shapeIndex':uc.mem_read(record+8,1)[0], 'anchor':uc.mem_read(record+0x60,1)[0]})
    assert [(v['definitionIndex'],v['anchor']) for v in initial_records] == [(35,0),(0,8),(1,4),(15,7)]
    windows = []
    cs = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
    for name,lo,hi in [('ordinary',0x02082874,0x02082994),('filler',0x02082a90,0x02082ba0),
                       ('wall',0x02082bc4,0x02082cc8),('attribute-reader',0x0207cac8,0x0207cae8),
                       ('filler-attribute-reader',0x0207c9c4,0x0207c9e8),('collision-reader',0x0207cc50,0x0207cc5c),
                       ('plane-initialization',0x0208263c,0x020826b4),('rank-dimensions',0x02082290,0x020822cc),
                       ('waiting-room-initial-record',0x02067c64,0x02067c84),
                       ('starting-cage-0',0x02067e68,0x02067e88),('starting-cage-1',0x02068070,0x02068090),
                       ('starting-cage-15',0x02068270,0x02068290)]:
        data=bytes(uc.mem_read(lo,hi-lo))
        windows.append({'name':name,'start':hex(lo),'endExclusive':hex(hi),'sha256':hashlib.sha256(data).hexdigest(),
                        'instructions':[{'address':hex(i.address),'op':i.mnemonic,'args':i.op_str} for i in cs.disasm(data,lo)]})
    return {'schemaVersion':1,'romSha256':SHA,'classification':'RESEARCH_ONLY_NOT_RUNTIME_INPUT',
            'method':'ORIGINAL_ARM9_COPY_LOOPS_AND_HELPERS_NO_STUBS_SYNTHETIC_CONTEXT_REAL_FIELD_ARRAYS',
            'initialPlanes':{'tiles':17,'attributes':9,'collision':7,'owners':-1},
            'nativeInitialPlanes':native_initial,'initialCageRecordWrites':initial_records,
            'height':24,'sources':inputs,'sourceReceipts':source_receipts,'cases':cases,'caseCount':len(cases),
            'instructionWindows':windows,'limits':['Isolated loops; no live camera, objects or animations.',
            'Field arrays stay research-only; runtime must receive eligible data from its existing authorities.',
            'Definitions and anchors are explicit test contexts; no legacy-save migration policy is implied.']}


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--rom',default=f'R:/{SHA}.nds');p.add_argument('--check',action='store_true')
    args=p.parse_args();out=build(args.rom);encoded=json.dumps(out,ensure_ascii=False,indent=2)+'\n'
    if args.check: assert OUT.read_text(encoding='utf-8')==encoded,'STALE_COMPOSITOR_RECEIPT'
    else: OUT.write_text(encoded,encoding='utf-8',newline='\n')
    print(json.dumps({'caseCount':out['caseCount'],'sourceCount':len(out['sources']),'check':args.check}))
