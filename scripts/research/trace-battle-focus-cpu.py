"""Bounded original special-prelude VM replay with explicit actor adapters.

The ARM9 VM, fixed-point arithmetic, square root and trig natives execute from
the original image. Synthetic actor geometry/animation adapters are inputs,
not an original encounter. No source art is exported.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *


def replay(raw, ticks=15, pose_ticks=68, return_ticks=15):
    rom = NintendoDSRom(raw)
    arm = bytes(decompress(rom.arm9))
    overlay = rom.loadArm9Overlays()[19]
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x800000)
    u.mem_write(0x02000000, arm)
    u.mem_write(overlay.ramAddress, bytes(overlay.data))
    u.mem_map(0x04000000, 0x1000)
    VM, ARGS, STOP, STACK = 0x02600000, 0x02601000, 0x027F0000, 0x027E0000
    SPRITE, OWNER, ACTION, OWNER_SPRITE = 0x02610000, 0x02611000, 0x02612000, 0x02613000
    reg = u.reg_read
    put = lambda a, n: u.mem_write(a, struct.pack('<I', n & 0xffffffff))
    get = lambda a: struct.unpack('<I', u.mem_read(a, 4))[0]
    signed = lambda n: n if n < 0x80000000 else n - 0x100000000
    state = {'sequence': 8, 'sequenceStart': 0, 'zoomQ12': 4096, 'camera': None,
             'cameraEnabled': False, 'tintIndex': None}
    calls, frames = [], []
    frame = 0

    def hardware(machine, access, address, size, value, user):
        if 0x40002A0 <= address < 0x40002B0:
            mode = int.from_bytes(u.mem_read(0x4000280, 2), 'little') & 3
            n = int.from_bytes(u.mem_read(0x4000290, 4 if mode == 0 else 8), 'little', signed=True)
            d = int.from_bytes(u.mem_read(0x4000298, 8 if mode == 2 else 4), 'little', signed=True)
            if not d:
                raise ValueError('Unexpected zero divisor in bounded prelude')
            q = abs(n) // abs(d) * (-1 if (n < 0) != (d < 0) else 1)
            u.mem_write(0x40002A0, (q & 0xffffffffffffffff).to_bytes(8, 'little'))
            u.mem_write(0x40002A8, ((n-q*d) & 0xffffffffffffffff).to_bytes(8, 'little'))
        if address == 0x40002B4:
            mode = int.from_bytes(u.mem_read(0x40002B0, 2), 'little') & 1
            n = int.from_bytes(u.mem_read(0x40002B8, 8 if mode else 4), 'little')
            put(address, math.isqrt(n))

    def args(n):
        vm = reg(UC_ARM_REG_R0)
        depth = get(vm + 0x188)  # ARM9 02054A34 reads current SP, not frameBase.
        return [signed(get(vm + 8 + (depth - 1 - i) * 4)) for i in range(n)]

    arities = {0x211CEC4: 2, 0x211CEFC: 2, 0x211CFF4: 1, 0x211CE7C: 1,
               0x211CE94: 1, 0x211CFD8: 1, 0x211D1FC: 1, 0x211D238: 1,
               0x211D298: 1, 0x211D2BC: 1, 0x211D3A8: 1, 0x211D360: 1,
               0x211D44C: 2, 0x211D54C: 3, 0x211D3C8: 3, 0x211D418: 2,
               0x211D514: 2, 0x211D1A8: 1, 0x211D1C4: 1, 0x211D1E0: 1,
               0x211D06C: 0, 0x211D0A4: 0, 0x211D0D4: 2, 0x211D134: 1,
               0x211CDFC: 2, 0x211CE5C: 1, 0x211E1F4: 1, 0x211E0D4: 2}
    positions = {SPRITE: [180*4096, 120*4096, 0]}

    def hook(machine, address, size, user):
        if address not in arities:
            return
        a = args(arities[address]); value = 0
        calls.append({'frame': frame, 'native': f'0x{address:08X}', 'args': a})
        if address == 0x211CFF4: value = OWNER_SPRITE
        elif address == 0x211CE7C: value = 180*4096
        elif address == 0x211CE94: value = 120*4096
        elif address == 0x211CFD8: value = 4096
        elif address == 0x211D1FC: value = 0
        elif address == 0x211D238: value = -16*4096
        elif address == 0x211D298: value = 32*4096
        elif address == 0x211D2BC: value = (state['sequence']+1)*4096
        elif address == 0x211D360: value = return_ticks*4096
        elif address == 0x211D3A8: value = int(frame-state['sequenceStart'] >= pose_ticks)
        elif address == 0x211D44C and a[0] == OWNER_SPRITE:
            state['sequence'] = ((a[1] >> 12) & 255)-1
            state['sequenceStart'] = frame
        elif address == 0x211D06C: state['cameraEnabled'] = True
        elif address == 0x211D0A4: state['cameraEnabled'] = False
        elif address == 0x211D0D4: state['camera'] = a
        elif address == 0x211D134: state['zoomQ12'] = a[0]
        elif address == 0x211CDFC: state['tintIndex'] = (a[1] >> 12) % 11
        elif address == 0x211CE5C: state['tintIndex'] = None
        elif address in [0x211D1A8, 0x211D1C4, 0x211D1E0]:
            value = positions.get(a[0], [0, 0, 0])[(address-0x211D1A8)//0x1C]
        elif address == 0x211D3C8: positions.setdefault(a[0], [0,0,0])[:2] = a[1:3]
        elif address == 0x211D418: positions.setdefault(a[0], [0,0,0])[2] = a[1]
        u.reg_write(UC_ARM_REG_R0, value & 0xffffffff)
        u.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))

    u.hook_add(UC_HOOK_MEM_READ, hardware, begin=0x4000280, end=0x40002BF)
    u.hook_add(UC_HOOK_CODE, hook)

    def invoke(pc, values):
        for r, value in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3], values):
            u.reg_write(r, value)
        u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, STOP)
        u.emu_start(pc, STOP, count=1000000)
        if reg(UC_ARM_REG_PC) != STOP:
            raise ValueError(f'CPU budget exhausted at {reg(UC_ARM_REG_PC):#x}')

    arguments = [SPRITE,OWNER,ACTION,ticks*4096,0,0,260*4096,120*4096]
    for i, value in enumerate(arguments): put(ARGS+4*i, value)
    invoke(0x020548D4, [VM,0x02120900,8,ARGS])
    for frame in range(240):
        invoke(0x02054980, [VM])
        frames.append({'frame': frame, **state, 'active': bool(get(VM+0x190)&1)})
        if not get(VM+0x190)&1: break
    if frames[-1]['active']: raise ValueError('Prelude did not finish')
    return {'input':{'zoomInTicks':ticks,'poseTicks':pose_ticks,'returnTicks':return_ticks},
            'frames':frames,'nativeCalls':calls}


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--rom',required=True);parser.add_argument('--out',required=True)
    options=parser.parse_args();raw=Path(options.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    result={'scope':'ORIGINAL_ARM9_VM_CONTROLLED_ACTOR_ADAPTERS','romSha256':sha,
            'entry':'0x02120900','boundaries':['Synthetic geometry and animation completion inputs',
            'Original VM, Q12, sqrt, sin, cos and atan execute; no encounter or launch-state acceptance'],
            'cases':[replay(raw,*values) for values in [(15,68,15),(8,20,6),(20,8,31)]]}
    Path(options.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print([(c['input'],len(c['frames'])) for c in result['cases']])
