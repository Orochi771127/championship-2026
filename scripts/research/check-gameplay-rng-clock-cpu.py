"""Isolated original ARM clock decoder + boot RNG seeder probes, not live play.

Only the external RTC result is supplied. Original BCD decoder, callback case1,
seeder and rolls execute on the original CPU. No ROM bytes go to runtime.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    arm = bytes(decompress(NintendoDSRom(raw).arm9))
    uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    uc.mem_map(0x02000000, 0x800000)
    uc.mem_write(0x02000000, arm)
    get = lambda a: struct.unpack('<I', uc.mem_read(a, 4))[0]
    put = lambda a, v: uc.mem_write(a, struct.pack('<I', v))
    reg = uc.reg_read
    # Original SDK callback case 1's globals are read from its own literal pool.
    clock_object = get(0x02010978)
    packed_time = get(0x02010980)
    output, stop = 0x02500000, 0x027FE000
    clock_reads = []

    def hook(machine, address, size, user):
        if address == 0x0201034C:
            dest = reg(UC_ARM_REG_R0)
            clock_reads.append(dest)
            for i, value in enumerate(decoded): put(dest + 4*i, value)
            machine.reg_write(UC_ARM_REG_R0, 0)
            machine.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))

    uc.hook_add(UC_HOOK_CODE, hook)

    def execute(entry, end, r0=0):
        for register, value in [(UC_ARM_REG_SP, 0x027FF000), (UC_ARM_REG_LR, stop), (UC_ARM_REG_R0, r0)]:
            uc.reg_write(register, value)
        uc.emu_start(entry, end, count=2000000)
        assert reg(UC_ARM_REG_PC) == end

    cases = []
    for hour, minute, second in [(0,0,0), (0,0,1), (7,0,0), (13,20,50), (23,59,59), (12,34,56)]:
        bcd = lambda n: (n // 10)*16 + n % 10
        packed = bcd(hour) | bcd(minute) << 8 | bcd(second) << 16
        put(packed_time, packed)
        put(clock_object + 0xC, output)
        execute(0x02010580, 0x020105CC, clock_object)
        decoded = [get(output + i*4) for i in range(3)]
        assert decoded == [hour, minute, second]
        # Same SDK's time-to-seconds consumer verifies the word ordering.
        execute(0x02010B1C, stop, output)
        seconds_since_midnight = reg(UC_ARM_REG_R0)
        assert seconds_since_midnight == hour*3600 + minute*60 + second
        clock_reads.clear()
        execute(0x02043240, stop)
        assert len(clock_reads) == 1
        state = {'seeds': [get(0x02104D20 + 4*i) for i in range(217)],
                 'cursors': [get(0x02105084 + 4*i) for i in range(217)]}
        cases.append({'clock': {'hour': hour, 'minute': minute, 'second': second}, 'packedBcd': packed,
                      'decoded': decoded, 'secondsSinceMidnight': seconds_since_midnight, 'rng': state})
    receipt = {'status': 'CONTROLLED_CPU_CLOCK_AND_SEEDER_PASS_NOT_NORMAL_HUNT', 'romSha256': sha,
               'sites': ['02010580..020105CC', '02010988 BCD', '02010B1C time-to-seconds', '02043240', '020431D4'],
               'boundary': 'External RTC decoded result supplied at synchronous SDK call 0201034C; no live boot claim',
               'cases': cases}
    with Path(args.out).open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'cases': len(cases)}))


if __name__ == '__main__': main()
