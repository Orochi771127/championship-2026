"""Controlled original-CPU checks; no ROM bytes or runtime fixtures in output.

Executes OVL12 0210F7D0 (only UI/input helpers are stubbed), ARM9's initial
Gate visibility loop and OVL8's rank/match unlock scanner. These tests do not
claim a complete original gameplay session or a traced source of the waiver.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R4, UC_ARM_REG_R5, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
BASE, STOP, GLOBAL, PLAYER, SELF = 0x02000000, 0x027f0000, 0x02500000, 0x02510000, 0x02520000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    raw = Path(args.rom).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA
    rom = NintendoDSRom(raw)
    arm, overlays = bytes(decompress(rom.arm9)), rom.loadArm9Overlays()
    records = []
    for index in range(17):
        at = 0x020c9558 - rom.arm9RamAddress + index * 36
        fee = struct.unpack_from('<H', arm, at + 0x18)[0]
        kind, parameter = struct.unpack_from('<II', arm, at + 0x1c)
        records.append(dict(recordIndex=index, entranceFeeBits=fee, unlockKind=kind, unlockParameter=parameter))

    def setup(overlay):
        u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(BASE, 0x800000)
        u.mem_write(rom.arm9RamAddress, arm)
        z = overlays[overlay]
        u.mem_write(z.ramAddress, bytes(z.data))
        put = lambda at, n: u.mem_write(at, struct.pack('<I', n & 0xffffffff))
        read = lambda at: struct.unpack('<I', u.mem_read(at, 4))[0]
        # Every selected routine loads the same original GameData singleton.
        put(0x020fba08, GLOBAL)
        put(GLOBAL + 4, PLAYER)
        u.reg_write(UC_ARM_REG_R0, SELF)
        u.reg_write(UC_ARM_REG_SP, 0x027e0000)
        u.reg_write(UC_ARM_REG_LR, STOP)
        return u, put, read

    fee_cases = []
    for row in records:
        for bits in sorted(set([0, max(0, row['entranceFeeBits']-1), row['entranceFeeBits'], row['entranceFeeBits']+1, 9999999])):
            for waiver in [0, 1]:
                u, put, read = setup(12)
                put(PLAYER + 0x4c8, bits)
                put(GLOBAL + 0xeb8, waiver)
                put(SELF + 0x48, row['recordIndex'])
                put(SELF + 0x220, SELF + 0x1000)
                events = []

                def hook(cpu, address, size, unused):
                    if address in [0x02044100, 0x0210c364, 0x0210f1e0, 0x0204409c]:
                        if address == 0x0204409c:
                            events.append(address)
                        cpu.reg_write(UC_ARM_REG_R0, row['recordIndex'] if address == 0x0210f1e0 else 0)
                        cpu.reg_write(UC_ARM_REG_PC, cpu.reg_read(UC_ARM_REG_LR))

                u.hook_add(UC_HOOK_CODE, hook)
                u.emu_start(0x0210f7d0, STOP, count=1000)
                assert u.reg_read(UC_ARM_REG_PC) == STOP
                accepted = u.reg_read(UC_ARM_REG_R0) == 6
                after = read(PLAYER + 0x4c8)
                assert accepted == (waiver != 0 or bits >= row['entranceFeeBits'])
                assert after == bits - (row['entranceFeeBits'] if accepted and waiver == 0 else 0)
                fee_cases.append(dict(recordIndex=row['recordIndex'], bits=bits, waiver=waiver, accepted=accepted, afterBits=after))

    u, put, read = setup(8)
    u.reg_write(UC_ARM_REG_R5, PLAYER)
    u.emu_start(0x02067920, 0x02067954, count=1000)
    initial = [read(PLAYER + 0x2ac + 4*i) for i in range(17)]
    assert initial == [2 if r['unlockKind'] == 0 else 0 for r in records]

    unlock_cases = []
    for old, new in [(0, n) for n in range(10)] + [(n, n+1) for n in range(9)]:
        for won, match in [(0, 0), (1, 7), (1, 45), (1, 46), (0, 46)]:
            u, put, read = setup(8)
            for i, state in enumerate(initial): put(PLAYER + 0x2ac + 4*i, state)
            u.mem_write(PLAYER + 0xae8, struct.pack('<H', old))
            put(SELF + 0x804, new)
            put(GLOBAL + 0xc98, won)
            put(GLOBAL + 0xca0, match)
            u.emu_start(0x0210cfd8, STOP, count=3000)
            assert u.reg_read(UC_ARM_REG_PC) == STOP
            actual = [read(SELF + 0x3c0 + 4*i) for i in range(read(SELF + 0x404))]
            expected = [r['recordIndex'] for r in records if
                (r['unlockKind'] == 1 and old < r['unlockParameter'] <= new) or
                (r['unlockKind'] == 2 and won == 1 and r['unlockParameter'] == match)]
            assert actual == expected
            unlock_cases.append(dict(oldRank=old, newRank=new, won=bool(won), matchIndex=match, revealed=actual))

    output = dict(schemaVersion=1, classification='RESEARCH_ONLY', runtimeEligible=False,
        romSha256=SHA, routines=['OVL12:0210F7D0', 'ARM9:02067920..02067954', 'OVL8:0210CFD8'],
        records=records, initialVisibility=initial, feeCases=fee_cases, unlockCases=unlock_cases,
        waiverSource='PARTIAL: init clears at ARM9 020688E0; load decodes bit27 at 0206AE24; natural acquisition remains UNKNOWN_REQUIRES_TRACE',
        limitations=['UI/input helpers stubbed for admission', 'controlled progression inputs', 'no physical device or complete original session'])
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(f'PASS: {len(fee_cases)} fee cases, {len(unlock_cases)} unlock cases, 17 initial visibility values')


if __name__ == '__main__':
    main()
