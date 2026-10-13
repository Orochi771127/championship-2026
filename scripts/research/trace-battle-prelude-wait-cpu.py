"""Original special-prelude wait exit, with controlled actor adapters (2026-10-13).

Question: when the owner's raw-33 pose never reports finished (0211D3A8 ->
02047C48 reads actor+0x7C), does the original 0x02120900 script leave the
prelude by any other path (timeout, counter, re-request)?

The ARM9 VM and every OVL19 native outside the listed seams execute from the
original image. Geometry and animation completion are explicit inputs, exactly
as in trace-battle-focus-cpu.py; this is not an encounter replay. No ROM art or
binary payload is written. ndspy is used when installed; otherwise a minimal
header/overlay-table/BLZ reader of the same verified image is used.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

ROM_SHA256 = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'


def _blz(data):
    data = bytes(data)
    header, extra = struct.unpack_from('<II', data, len(data) - 8)
    header_len, encoded_len = header >> 24, header & 0xffffff
    out = bytearray(data) + bytearray(extra)
    src, dst, end = len(data) - header_len, len(out), len(data) - encoded_len
    while src > end:
        src -= 1
        flags = data[src]
        for _ in range(8):
            if src <= end:
                break
            if flags & 0x80:
                src -= 2
                v = data[src] | (data[src + 1] << 8)
                for _ in range((v >> 12) + 3):
                    dst -= 1
                    out[dst] = out[dst + (v & 0xfff) + 3]
            else:
                src -= 1
                dst -= 1
                out[dst] = data[src]
            flags = (flags << 1) & 0xff
    return bytes(out)


def load_image(raw):
    try:
        from ndspy.rom import NintendoDSRom
        from ndspy.codeCompression import decompress
        rom = NintendoDSRom(raw)
        overlay = rom.loadArm9Overlays()[19]
        return bytes(decompress(rom.arm9)), overlay.ramAddress, bytes(overlay.data)
    except ImportError:
        pass
    offset, _, ram, size = struct.unpack_from('<4I', raw, 0x20)
    fat, _, table, table_size = struct.unpack_from('<4I', raw, 0x48)
    arm9 = bytearray(raw[offset:offset + size])
    params = arm9.find(struct.pack('<II', 0xdec00621, 0x2106c0de)) - 0x1c
    compressed_end = struct.unpack_from('<I', arm9, params + 0x14)[0]
    if compressed_end:
        n = compressed_end - ram
        arm9 = bytearray(_blz(arm9[:n])) + arm9[n:]
    for k in range(table_size // 32):
        oid, oram, _, _, _, _, fid, flags = struct.unpack_from('<8I', raw, table + k * 32)
        if oid == 19:
            start, stop = struct.unpack_from('<2I', raw, fat + fid * 8)
            data = raw[start:stop]
            return bytes(arm9), oram, _blz(data) if flags >> 24 & 1 else bytes(data)
    raise ValueError('OVL19 missing')


def replay(raw, ticks, pose_ticks, return_ticks, pose_completes, frame_limit):
    arm, overlay_ram, overlay = load_image(raw)
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x800000)
    u.mem_write(0x02000000, arm)
    u.mem_write(overlay_ram, overlay)
    u.mem_map(0x04000000, 0x1000)
    VM, ARGS, STOP, STACK = 0x02600000, 0x02601000, 0x027F0000, 0x027E0000
    SPRITE, OWNER, ACTION, OWNER_SPRITE = 0x02610000, 0x02611000, 0x02612000, 0x02613000
    reg = u.reg_read
    put = lambda a, n: u.mem_write(a, struct.pack('<I', n & 0xffffffff))
    get = lambda a: struct.unpack('<I', u.mem_read(a, 4))[0]
    signed = lambda n: n if n < 0x80000000 else n - 0x100000000
    state = {'sequence': 8, 'sequenceStart': 0}
    frame_calls = []
    sequence_requests = []
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
            u.mem_write(0x40002A8, ((n - q * d) & 0xffffffffffffffff).to_bytes(8, 'little'))
        if address == 0x40002B4:
            mode = int.from_bytes(u.mem_read(0x40002B0, 2), 'little') & 1
            put(address, math.isqrt(int.from_bytes(u.mem_read(0x40002B8, 8 if mode else 4), 'little')))

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
    positions = {SPRITE: [180 * 4096, 120 * 4096, 0]}
    calls = []

    def hook(machine, address, size, user):
        if address not in arities:
            return
        a = args(arities[address])
        value = 0
        calls.append(f'0x{address:08X}')
        if address == 0x211CFF4: value = OWNER_SPRITE
        elif address == 0x211CE7C: value = 180 * 4096
        elif address == 0x211CE94: value = 120 * 4096
        elif address == 0x211CFD8: value = 4096
        elif address == 0x211D238: value = -16 * 4096
        elif address == 0x211D298: value = 32 * 4096
        elif address == 0x211D2BC: value = (state['sequence'] + 1) * 4096
        elif address == 0x211D360: value = return_ticks * 4096
        elif address == 0x211D3A8:
            # Seam: 02047C48 is actor+0x7C == 0. With pose_completes false the
            # owner's raw-33 select has been replaced by a sequence whose
            # animator never clears +0x7C.
            value = int(pose_completes and frame - state['sequenceStart'] >= pose_ticks)
        elif address == 0x211D44C and a[0] == OWNER_SPRITE:
            state['sequence'] = ((a[1] >> 12) & 255) - 1
            state['sequenceStart'] = frame
            sequence_requests.append({'frame': frame, 'rawSequence': state['sequence']})
        elif address in [0x211D1A8, 0x211D1C4, 0x211D1E0]:
            value = positions.get(a[0], [0, 0, 0])[(address - 0x211D1A8) // 0x1C]
        elif address == 0x211D3C8: positions.setdefault(a[0], [0, 0, 0])[:2] = a[1:3]
        elif address == 0x211D418: positions.setdefault(a[0], [0, 0, 0])[2] = a[1]
        u.reg_write(UC_ARM_REG_R0, value & 0xffffffff)
        u.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))

    u.hook_add(UC_HOOK_MEM_READ, hardware, begin=0x4000280, end=0x40002BF)
    u.hook_add(UC_HOOK_CODE, hook)

    def invoke(pc, values):
        for r, value in zip([UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3], values):
            u.reg_write(r, value)
        u.reg_write(UC_ARM_REG_SP, STACK)
        u.reg_write(UC_ARM_REG_LR, STOP)
        u.emu_start(pc, STOP, count=1000000)
        if reg(UC_ARM_REG_PC) != STOP:
            raise ValueError(f'CPU budget exhausted at {reg(UC_ARM_REG_PC):#x}')

    for i, value in enumerate([SPRITE, OWNER, ACTION, ticks * 4096, 0, 0, 260 * 4096, 120 * 4096]):
        put(ARGS + 4 * i, value)
    invoke(0x020548D4, [VM, 0x02120900, 8, ARGS])
    active = True
    for frame in range(frame_limit):
        calls.clear()
        invoke(0x02054980, [VM])
        active = bool(get(VM + 0x190) & 1)
        frame_calls.append(tuple(calls))
        if not active:
            break
    tail = sorted(set(frame_calls[-64:]))
    return {'input': {'zoomInTicks': ticks, 'poseTicks': pose_ticks, 'returnTicks': return_ticks,
                      'poseCompletes': pose_completes, 'frameLimit': frame_limit},
            'framesExecuted': len(frame_calls), 'activeAfterLastFrame': active,
            'ownerSequenceRequests': sequence_requests,
            'distinctNativeCallSequencesInLast64Frames': [list(t) for t in tail]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', required=True)
    parser.add_argument('--out', required=True)
    options = parser.parse_args()
    raw = Path(options.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == ROM_SHA256
    # Move 435 (field22 = 15) on species 174 projects 84 frames: 15/68/15.
    cases = [replay(raw, 15, 68, 15, True, 240), replay(raw, 15, 68, 15, False, 3600)]
    result = {'scope': 'ORIGINAL_ARM9_VM_CONTROLLED_ACTOR_ADAPTERS', 'romSha256': sha, 'entry': '0x02120900',
              'boundaries': ['Synthetic geometry and animation completion inputs',
                             'Shows only the script exit condition; not an encounter replay'],
              'cases': cases}
    Path(options.out).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    print([(c['input']['poseCompletes'], c['framesExecuted'], c['activeAfterLastFrame']) for c in cases])
