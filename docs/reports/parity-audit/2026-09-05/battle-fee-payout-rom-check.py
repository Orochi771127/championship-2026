"""Recheck Title Battle money fields from the owner's exact YDIJ ROM.

Research-only, static binary evidence. No product code/catalog/report is an
input. No controlled emulator execution or full control-flow proof is claimed.
Requires Python packages ndspy and capstone. Retains small instruction windows
and numeric assertions only; it never writes ROM/overlay binary payloads.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import struct

import capstone
from capstone.arm import ARM_OP_IMM, ARM_OP_MEM
import ndspy.codeCompression
import ndspy.rom


EXPECTED_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
TITLE_TABLE = 0x020CD004
TITLE_STRIDE = 0x28
TITLE_COUNT = 62


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", type=Path, default=Path("R:/" + EXPECTED_ROM_SHA256 + ".nds"))
    parser.add_argument("--out", type=Path, default=Path(__file__).with_suffix(".json"))
    args = parser.parse_args()
    raw = args.rom.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != EXPECTED_ROM_SHA256:
        raise SystemExit(f"ROM_SHA256_MISMATCH: {digest}")
    rom = ndspy.rom.NintendoDSRom(raw)
    overlays = rom.loadArm9Overlays()
    arm9 = ndspy.codeCompression.decompress(rom.arm9)
    decoder = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
    decoder.detail = True
    assertions = []

    def check(label, actual, expected):
        passed = actual == expected
        assertions.append({"id": label, "actual": actual, "expected": expected, "passed": passed})

    def word(overlay_id, address):
        overlay = overlays[overlay_id]
        offset = address - overlay.ramAddress
        if offset < 0 or offset + 4 > len(overlay.data):
            raise ValueError(f"Outside OVL{overlay_id}: {address:#x}")
        return struct.unpack_from("<I", overlay.data, offset)[0]

    def instruction(overlay_id, address):
        overlay = overlays[overlay_id]
        offset = address - overlay.ramAddress
        return next(decoder.disasm(bytes(overlay.data[offset:offset + 4]), address))

    def asm(overlay_id, address, mnemonic, operands):
        insn = instruction(overlay_id, address)
        check(f"OVL{overlay_id}:{address:#010x}", [insn.mnemonic, insn.op_str], [mnemonic, operands])

    def literal(overlay_id, address, expected_pointer):
        insn = instruction(overlay_id, address)
        operand = insn.operands[1]
        check(f"literal_load_{address:#010x}",
              [insn.mnemonic, operand.type, insn.reg_name(operand.mem.base)],
              ["ldr", ARM_OP_MEM, "pc"])
        literal_address = address + 8 + operand.mem.disp
        resolved = word(overlay_id, literal_address)
        check(f"literal_value_{address:#010x}", resolved, expected_pointer)
        return {"instruction": f"OVL{overlay_id}:{address:#010x}",
                "pcRule": "ARM instruction address + 8 + signed displacement",
                "literalAddress": f"{literal_address:#010x}",
                "resolvedPointer": f"{resolved:#010x}"}

    check("game_code", rom.idCode.decode("ascii"), "YDIJ")
    check("rom_bytes", len(raw), 64 * 1024 * 1024)
    check("arm9_ram_address", rom.arm9RamAddress, 0x02000000)
    check("ovl8_ram_address", overlays[8].ramAddress, 0x0210B300)
    check("ovl10_ram_address", overlays[10].ramAddress, 0x0210B300)

    records = []
    for index in (0, 1, 61):
        address = TITLE_TABLE + index * TITLE_STRIDE
        values = struct.unpack_from("<10i", arm9, address - rom.arm9RamAddress)
        records.append({"recordIndex": index, "address": f"{address:#010x}",
                        "fields": {f"field{offset:02X}": value for offset, value in zip(range(0, TITLE_STRIDE, 4), values)}})
    check("record0_money_fields", [records[0]["fields"]["field20"], records[0]["fields"]["field24"]], [7000, 150])
    check("record1_money_fields", [records[1]["fields"]["field20"], records[1]["fields"]["field24"]], [18000, 600])
    check("record61_money_fields", [records[2]["fields"]["field20"], records[2]["fields"]["field24"]], [2500, 0])

    literals = {
        "feeColumn": literal(10, 0x02112608, TITLE_TABLE + 0x24),
        "rewardColumn": literal(10, 0x02112894, TITLE_TABLE + 0x20),
        "walletCap": literal(8, 0x0210EACC, 9_999_999),
    }

    # Fee column -> controller+0xD538 -> affordability compare -> wallet debit.
    for address, mnemonic, operands in [
        (0x02112600, "mov", "r0, #0x28"),
        (0x02112604, "mul", "r3, r1, r0"),
        (0x02112610, "ldr", "r3, [r2, r3]"),
        (0x02112614, "add", "r2, r5, #0xd000"),
        (0x02112618, "str", "r3, [r2, #0x538]"),
        (0x02112788, "add", "r0, r5, #0xd000"),
        (0x02112790, "ldr", "r0, [r0, #0x538]"),
        (0x02112794, "ldr", "r1, [r1, #4]"),
        (0x02112798, "ldr", "r1, [r1, #0x4c8]"),
        (0x0211279C, "cmp", "r1, r0"),
        (0x021127A0, "bhs", "#0x2112804"),
        (0x021123CC, "add", "r0, r5, #0xd000"),
        (0x021123D0, "ldr", "r4, [r0, #0x538]"),
        (0x021123F8, "ldr", "r2, [r0, #0x4c8]"),
        (0x02112404, "sub", "r2, r2, r4"),
        (0x02112408, "str", "r2, [r0, #0x4c8]"),
        (0x02112438, "add", "r1, r5, #0xd000"),
        (0x0211243C, "ldr", "r4, [r0, #0x4c8]"),
        (0x02112440, "ldr", "r3, [r1, #0x538]"),
        (0x02112448, "sub", "r3, r4, r3"),
        (0x0211244C, "str", "r3, [r0, #0x4c8]"),
        (0x02112450, "str", "r2, [r1, #0x538]"),
        # Reward column -> session+0xC94 (same record stride, separate column).
        (0x0211288C, "mov", "r1, #0x28"),
        (0x02112890, "mul", "r2, r0, r1"),
        (0x0211289C, "ldr", "r1, [r1, r2]"),
        (0x021128A4, "str", "r1, [r4, #0xc94]"),
    ]:
        asm(10, address, mnemonic, operands)

    # OVL8 pending reward gates and wallet credit, separate from fee subtraction.
    for address, mnemonic, operands in [
        (0x0210D104, "ldr", "r0, [r0, #0xcac]"),
        (0x0210D10C, "cmp", "r0, #0"),
        (0x0210D110, "streq", "r2, [r5, #0x7fc]"),
        (0x0210D124, "mov", "r1, #0"),
        (0x0210D128, "str", "r1, [r5, #0x408]"),
        (0x0210D160, "ldr", "r0, [r1, #0xc98]"),
        (0x0210D164, "cmp", "r0, #1"),
        (0x0210D168, "ldreq", "r0, [r1, #0xca0]"),
        (0x0210D16C, "cmpeq", "r0, #0x3d"),
        (0x0210D174, "popeq", "{r4, r5, pc}"),
        (0x0210D178, "ldr", "r0, [r5, #0x7fc]"),
        (0x0210D17C, "cmp", "r0, #0"),
        (0x0210D184, "popeq", "{r4, r5, pc}"),
        (0x0210D188, "ldr", "r1, [r1, #0xc94]"),
        (0x0210D190, "str", "r1, [r5, #0x408]"),
        (0x0210EAB0, "ldr", "r2, [r4, #0x4c8]"),
        (0x0210EAB4, "ldr", "r1, [r5, #0x408]"),
        (0x0210EAB8, "mov", "r0, #0"),
        (0x0210EABC, "add", "r1, r2, r1"),
        (0x0210EAC0, "str", "r1, [r4, #0x4c8]"),
        (0x0210EAC4, "str", "r0, [r5, #0x408]"),
        (0x0210EAC8, "ldr", "r1, [r4, #0x4c8]"),
        (0x0210EAD0, "cmp", "r1, r0"),
        (0x0210EAD4, "strhs", "r0, [r4, #0x4c8]"),
    ]:
        asm(8, address, mnemonic, operands)

    windows = []
    for overlay_id, label, start, end in [
        (10, "fee_read_and_controller_store", 0x021125E8, 0x02112620),
        (10, "affordability_compare", 0x02112784, 0x021127B4),
        (10, "fee_debit_animated_and_instant", 0x021123CC, 0x02112454),
        (10, "reward_read_and_session_store", 0x02112840, 0x021128B0),
        (8, "reward_gate_and_pending", 0x0210D0C8, 0x0210D1A0),
        (8, "wallet_credit_and_cap", 0x0210EAB0, 0x0210EAE0),
    ]:
        ov = overlays[overlay_id]
        decoded = decoder.disasm(bytes(ov.data[start - ov.ramAddress:end - ov.ramAddress]), start)
        windows.append({"overlay": overlay_id, "label": label, "start": f"{start:#010x}",
                        "endExclusive": f"{end:#010x}",
                        "instructions": [{"address": f"{insn.address:#010x}", "mnemonic": insn.mnemonic,
                                          "operands": insn.op_str} for insn in decoded]})

    failed = [a for a in assertions if not a["passed"]]
    output = {
        "schemaVersion": 1,
        "scope": "RESEARCH_ONLY_STATIC_ROM_INSTRUCTION_AND_FIELD_CHECK",
        "rom": {"path": str(args.rom.resolve()), "sha256": digest, "sizeBytes": len(raw),
                "gameCode": rom.idCode.decode("ascii"), "arm9RamAddress": f"{rom.arm9RamAddress:#010x}"},
        "toolVersions": {"python": platform.python_version(),
                         "ndspy": importlib.metadata.version("ndspy"), "capstone": capstone.__version__},
        "inputs": ["Exact owner-supplied ROM only; no product catalog or external research file was read"],
        "table": {"base": f"{TITLE_TABLE:#010x}", "strideBytes": TITLE_STRIDE,
                  "recordCountContext": TITLE_COUNT,
                  "note": "The 62-record count is context, not independently established by this script."},
        "records": records, "literals": literals,
        "staticInterpretation": {"entryDebitField": "field24", "resultRewardField": "field20",
                                 "record0EntryDebit": 150, "record0ResultRewardBeforeGates": 7000,
                                 "walletCap": 9_999_999,
                                 "record61Warning": "field20=2500 is not automatic entitlement: mode=1 and matchIndex=61 returns before pending is assigned."},
        "assertions": assertions, "disassemblyWindows": windows,
        "validation": {"assertions": len(assertions), "passed": len(assertions) - len(failed),
                       "failed": len(failed), "status": "PASS" if not failed else "FAIL"},
        "limitations": [
            "Static instruction/data chains only; controlled emulator gameplay comparison was not performed.",
            "This is not a full CFG, alias analysis, or emulation of the caller state and selected-record resolver.",
            "Cube face, entry mode, reward mode, and battle type mappings are not equated or fully traced here.",
            "Entry timing, cancel/refund rules, rank/title/qualification writers, and per-creature battle writeback are not established here.",
            "No original save persistence timing or browser transaction recovery policy is inferred from these instructions.",
            "Only records 0, 1, and 61 are sampled; this is not an exhaustive title-table semantic audit.",
            "Assertion strings use the recorded Capstone rendering; a different Capstone version may need mnemonic alias review, not a gameplay conclusion.",
        ],
    }
    args.out.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ROM_SHA256_MATCH {digest}")
    print("RECORD_0 entry_debit_field24=150 result_reward_field20=7000")
    print(f"STATIC_ROM_CHECK {output['validation']['status']} assertions={len(assertions)} passed={len(assertions)-len(failed)} failed={len(failed)}")
    print("CONTROLLED_GAMEPLAY_CHECK NOT_PERFORMED")
    print(f"OUTPUT {args.out.resolve()}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
