"""Research-only static decode of the OVL10 tournament round-count writers.

Establishes how many rounds each entry sets up, where the count comes from, and
which entries are single-match. Reads the Owner's SHA-256-verified YDIJ ROM only;
no ROM bytes enter the product.
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROM_SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
# Session block offsets, named for the sites that consume them.
CURSOR, TOTAL, FLAGS, CATEGORY, PRIZE = 0xca4, 0xca8, 0xcac, 0xca0, 0xc94
# Every str into TOTAL, found by scanning the LDR/STR immediate encoding rather
# than a linear disassembly: OVL19 interleaves data with code.
WRITERS = [0x02111C34, 0x0211220C, 0x02112250, 0x02112870, 0x02112B5C, 0x02112BF0, 0x02112C7C]
DESCRIPTOR_TABLE = 0x02114D40   # OVL10 static; +0x08 and +0x0C hold the two descriptors.
CATEGORY_TABLE = 0x02114D48     # ldr r1,[r0,r2,lsl#2] at 02110AA0: one word per category.
OPPONENT_SELECTOR = 0x02110A90  # called with (category, roundCursor)
MODE_DISPATCH = 0x021110DC      # +0xC98 picks the tournament path (0) or the free path (2)
ARM9_STATIC_END = 0x020F99D8    # header 0x28/0x2C; anything above this is runtime BSS.


def scan_offset(data, base, offset):
    """Every ldr/str with this 12-bit immediate offset, alignment-independent."""
    out = []
    for at in range(0, len(data) - 3, 4):
        word = struct.unpack_from('<I', data, at)[0]
        if (word >> 26) & 3 != 1 or (word >> 25) & 1 != 0:
            continue
        if word & 0xfff != offset:
            continue
        out.append({'address': f'{base + at:08X}', 'op': 'ldr' if (word >> 20) & 1 else 'str',
                    'byte': bool((word >> 22) & 1), 'rn': (word >> 16) & 15, 'rd': (word >> 12) & 15})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == ROM_SHA, f'unexpected ROM {sha}'
    rom = NintendoDSRom(raw)
    arm9 = bytes(decompress(rom.arm9))
    arm9_base = rom.arm9RamAddress
    ovl = {i: (bytes(o.data), o.ramAddress) for i, o in rom.loadArm9Overlays().items()}
    ov10, ov10_base = ovl[10]
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)

    def ov10_word(address):
        return struct.unpack_from('<I', ov10, address - ov10_base)[0]

    def arm9_bytes(address, length):
        return arm9[address - arm9_base:address - arm9_base + length]

    def context(address, back=0x28, forward=0x8):
        start, end = address - back, address + forward
        return [f'{i.address:08X}  {i.mnemonic} {i.op_str}'
                for i in md.disasm(ov10[start - ov10_base:end - ov10_base], start)]

    # Where the count comes from: an immediate 1, or a byte loaded from a record.
    entries = []
    for site in WRITERS:
        lines = context(site)
        body = ' ; '.join(lines)
        literal = 'ldrb' in body
        entries.append({'site': f'{site:08X}', 'source': 'DESCRIPTOR_BYTE' if literal else 'IMMEDIATE',
                        'disassembly': lines})
    assert sum(e['source'] == 'DESCRIPTOR_BYTE' for e in entries) == 2, 'expected two table-driven entries'

    descriptors = {}
    for field, name in ((0x08, 'championship'), (0x0C, 'world')):
        pointer = ov10_word(DESCRIPTOR_TABLE + field)
        record = arm9_bytes(pointer, 16)
        descriptors[name] = {
            'tableField': f'0x{field:02X}',
            'descriptor': f'{pointer:08X}',
            'rounds': record[0],
            'prize': struct.unpack_from('<I', record, 4)[0],
            'field08': struct.unpack_from('<I', record, 8)[0],
            'field0C': f'{struct.unpack_from("<I", record, 12)[0]:08X}',
            'rawBytes': record.hex(),
        }
    assert descriptors['championship']['rounds'] == 3
    assert descriptors['world']['rounds'] == 5

    # Per-round opponent: 02110A90 reads categoryTable[category]->+0x0C as an array
    # of 8-byte {u8 poolSize, u32 poolPointer} records indexed by the round cursor,
    # draws a uniform index over poolSize, and reads a 20-byte team record.
    opponent = {'selector': f'{OPPONENT_SELECTOR:08X}', 'arguments': ['category', 'roundCursor'],
                'recordStride': 8, 'teamStride': 20, 'draw': 'uniform over poolSize',
                'modeDispatch': {'site': f'{MODE_DISPATCH:08X}', 'field': '0xC98',
                                 '0': 'tournament pool path, arena forced to 10',
                                 '2': 'free path: arena drawn from {0,1,2,3,4,5,7}, team index = +0xCA0'},
                'categories': {}}
    for name, info in descriptors.items():
        lst = int(info['field0C'], 16)
        rounds = []
        for r in range(info['rounds']):
            rec = arm9_bytes(lst + r * 8, 8)
            pointer = struct.unpack_from('<I', rec, 4)[0]
            rounds.append({'round': r, 'poolSize': rec[0], 'poolPointer': f'{pointer:08X}',
                           'poolResolvable': pointer < ARM9_STATIC_END})
        opponent['categories'][name] = {'roundList': f'{lst:08X}', 'rounds': rounds}
    pools = [r for c in opponent['categories'].values() for r in c['rounds']]
    # The pools chain end to end: base + poolSize*20 is the next pool's base.
    ordered = sorted(pools, key=lambda r: int(r['poolPointer'], 16))
    opponent['poolsContiguous'] = all(
        int(a['poolPointer'], 16) + a['poolSize'] * 20 == int(b['poolPointer'], 16)
        for a, b in zip(ordered, ordered[1:]))
    opponent['poolTotalTeams'] = sum(r['poolSize'] for r in pools)
    opponent['poolContents'] = ('UNKNOWN_REQUIRES_TRACE: every pool pointer lands above the ARM9 '
                                'static image end, in runtime BSS. No NitroFS file supplies it, so '
                                'the team records need a live RAM read, not a ROM decode.')

    result = {
        'evidence': 'STATIC_DECODE',
        'inputClass': 'ROM_CODE_AND_TABLE_READ_NOT_LIVE_PLAY',
        'romSha256': ROM_SHA,
        'sessionBlock': {
            'roundCursor': f'0x{CURSOR:03X}', 'totalRounds': f'0x{TOTAL:03X}',
            'roundFlags': f'0x{FLAGS:03X}', 'category': f'0x{CATEGORY:03X}', 'prize': f'0x{PRIZE:03X}',
        },
        'consumers': {
            'finalRoundTest': {'site': '0210D204', 'overlay': 19,
                'meaning': 'gated on category==1 and +0xC98==0, marks the final round when cursor >= total-1'},
            'payoutGate': {'site': '0210D0C8', 'overlay': 8,
                'meaning': 'walks flags[0..cursor-1]; any zero clears the paid flag'},
            'roundRecorder': {'site': '0210E280', 'overlay': 19,
                'meaning': 'writes flags[cursor] then advances the cursor'},
        },
        'totalRoundsWriters': entries,
        'descriptors': descriptors,
        'accesses': {
            'totalRounds': {f'ovl{i}': scan_offset(d, b, TOTAL) for i, (d, b) in ovl.items()
                            if scan_offset(d, b, TOTAL)},
        },
        'opponentSelection': opponent,
        'conclusion': (
            'Five OVL10 entries store an immediate 1 into the total-round slot; two load it as a '
            'byte from an ARM9 descriptor reached through the OVL10 table at 02114D40. Those two '
            'give 3 rounds (prize 50,000) and 5 rounds (prize 300,000), and the 5-round entry also '
            'copies the descriptor +0x04 prize into the session prize slot. This fixes the round '
            'counts and the entries that use them. Per-round opponent selection is decoded as '
            'far as its shape - a uniform draw over a fixed per-round pool size, 6/6/4 for the '
            '3-round category and 4/3/2/2/1 for the 5-round one - but every pool pointer lands in '
            'runtime BSS, so the team records themselves stay UNKNOWN_REQUIRES_TRACE.'),
    }
    Path(args.out).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'championshipRounds': descriptors['championship']['rounds'],
                      'worldRounds': descriptors['world']['rounds'],
                      'immediateEntries': sum(e['source'] == 'IMMEDIATE' for e in entries),
                      'poolSizes': {k: [r['poolSize'] for r in v['rounds']]
                                    for k, v in opponent['categories'].items()},
                      'poolsContiguous': opponent['poolsContiguous'],
                      'poolTotalTeams': opponent['poolTotalTeams'],
                      'poolsResolvable': any(r['poolResolvable'] for r in pools)}))


if __name__ == '__main__':
    main()
