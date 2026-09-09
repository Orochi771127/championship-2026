#!/usr/bin/env python3
"""Catalogue the 67 CALL_NATIVE targets the battle scripts reach.

The scripts spend 3,014 of their 23,121 instructions calling out to OVL19, and
this records what each of those 67 routines mechanically is: how many script
arguments it reads, which offsets it loads and stores at what width, what it
calls, and whether it yields. Nothing here names a routine or guesses a meaning;
the offsets are the names, the way B1 named move-record fields.

The ROM is evidence, not a repository asset. Point the script at it with --rom or
the YDIJ_ROM environment variable.

    python scripts/build-battle-native-catalog.py --rom /path/to/YDIJ.nds
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
from pathlib import Path

try:
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM, CS_OP_IMM, CS_OP_REG, CS_OP_MEM
    from capstone.arm import ARM_REG_R1
except ImportError:  # pragma: no cover - the builder is not part of CI
    raise SystemExit("this builder needs capstone: pip install capstone")

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
ROM_TITLE = b"DIGIMONCHAMP"
ROM_CODE = b"YDIJ"

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"
OUT_NAME = "battle-natives.r1.json"
SCRIPT_CATALOG = "battle-scripts.r1.json"

SCRIPT_ARGUMENT = 0x02054A34   # readBattleScriptArgument(vm, n)
SCRIPT_YIELD = 0x02054A24      # yieldBattleScript(vm)

LOAD_WIDTH = {"ldr": "u32", "ldrh": "u16", "ldrb": "u8", "ldrsh": "s16", "ldrsb": "s8"}
STORE_WIDTH = {"str": "u32", "strh": "u16", "strb": "u8"}
CONDITIONS = ("eq", "ne", "lt", "le", "gt", "ge", "hi", "hs", "lo", "ls", "mi", "pl", "vs", "vc", "al")

MD = Cs(CS_ARCH_ARM, CS_MODE_ARM)
MD.detail = True


def base_mnemonic(mnemonic):
    for suffix in CONDITIONS:
        if mnemonic.endswith(suffix) and mnemonic[: -len(suffix)] in {**LOAD_WIDTH, **STORE_WIDTH}:
            return mnemonic[: -len(suffix)]
    return mnemonic


def load_overlay19(data):
    fat = struct.unpack_from("<I", data, 0x48)[0]
    ovt = struct.unpack_from("<I", data, 0x50)[0]
    size = struct.unpack_from("<I", data, 0x54)[0]
    for index in range(size // 32):
        entry = ovt + index * 32
        if struct.unpack_from("<I", data, entry)[0] != 19:
            continue
        ram = struct.unpack_from("<I", data, entry + 4)[0]
        length = struct.unpack_from("<I", data, entry + 8)[0]
        file_id = struct.unpack_from("<I", data, entry + 24)[0]
        start = struct.unpack_from("<I", data, fat + file_id * 8)[0]
        end = struct.unpack_from("<I", data, fat + file_id * 8 + 4)[0]
        return ram, data[start:start + min(length, end - start)]
    raise SystemExit("overlay 19 is not in the ARM9 overlay table")


def disassemble(ram, buffer):
    """Word by word, so a data word cannot halt the stream."""
    out = {}
    for offset in range(0, len(buffer) - 3, 4):
        for instruction in MD.disasm(buffer[offset:offset + 4], ram + offset):
            out[instruction.address] = instruction
    return out


def analyse(instructions, start, end):
    arguments, calls, accesses = set(), [], []
    yields = False
    address = start
    while address < end:
        instruction = instructions.get(address)
        if instruction is not None:
            mnemonic = instruction.mnemonic
            base = base_mnemonic(mnemonic)
            operands = instruction.operands
            if mnemonic.startswith("bl") and operands and operands[0].type == CS_OP_IMM:
                target = operands[0].imm
                if target == SCRIPT_ARGUMENT:
                    index = "computed"
                    for back in range(1, 6):
                        previous = instructions.get(address - 4 * back)
                        if (previous and previous.operands
                                and previous.operands[0].type == CS_OP_REG
                                and previous.operands[0].reg == ARM_REG_R1
                                and previous.mnemonic.startswith("mov")
                                and previous.operands[1].type == CS_OP_IMM):
                            index = previous.operands[1].imm
                            break
                    arguments.add(index)
                elif target == SCRIPT_YIELD:
                    yields = True
                else:
                    calls.append(target)
            if (base in LOAD_WIDTH or base in STORE_WIDTH) and len(operands) == 2 \
                    and operands[1].type == CS_OP_MEM and operands[1].mem.index == 0 \
                    and "pc" not in instruction.op_str and "sp" not in instruction.op_str:
                accesses.append({
                    "offset": operands[1].mem.disp,
                    "offsetHex": "0x%X" % operands[1].mem.disp,
                    "width": LOAD_WIDTH.get(base) or STORE_WIDTH.get(base),
                    "direction": "read" if base in LOAD_WIDTH else "write",
                    "conditional": mnemonic != base,
                })
        address += 4
    numeric = sorted(index for index in arguments if isinstance(index, int))
    return {
        "argumentCount": (numeric[-1] + 1) if numeric else 0,
        "argumentIndexComputed": any(index == "computed" for index in arguments),
        "yields": yields,
        "calls": ["0x%08X" % target for target in sorted(set(calls))],
        "accesses": accesses,
    }


def shape(report):
    if report["yields"]:
        return "YIELD"
    if report["calls"]:
        return "COMPOUND"
    if not report["accesses"]:
        return "TRIVIAL"
    if any(access["direction"] == "write" for access in report["accesses"]):
        return "SETTER"
    return "GETTER"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", default=os.environ.get("YDIJ_ROM"),
                        help="path to the retail YDIJ cartridge image (or set YDIJ_ROM)")
    parser.add_argument("--out", default=str(OUT_DIR), help="catalog output directory")
    args = parser.parse_args()

    if not args.rom:
        parser.error("no ROM given: pass --rom PATH or set YDIJ_ROM. The ROM is "
                     "evidence and is never stored in this repository.")
    rom_path = Path(args.rom)
    if not rom_path.is_file():
        parser.error("ROM not found: %s" % rom_path)

    data = rom_path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != ROM_SHA256:
        raise SystemExit("ROM sha256 %s is not the transcribed cartridge" % digest)
    if data[0x00:0x0C] != ROM_TITLE or data[0x0C:0x10] != ROM_CODE:
        raise SystemExit("header title/code is not DIGIMONCHAMP / YDIJ")

    out_dir = Path(args.out)
    scripts = json.loads((out_dir / SCRIPT_CATALOG).read_text(encoding="utf-8"))
    targets = sorted((int(entry["address"], 16), entry["callSites"]) for entry in scripts["nativeTargets"])
    if not targets:
        raise SystemExit("the script catalog lists no native targets")

    ram, buffer = load_overlay19(data)
    instructions = disassemble(ram, buffer)

    natives = []
    for position, (address, call_sites) in enumerate(targets):
        end = targets[position + 1][0] if position + 1 < len(targets) else address + 0x200
        report = analyse(instructions, address, end)
        natives.append({
            "address": "0x%08X" % address,
            "bytes": end - address,
            "callSites": call_sites,
            "shape": shape(report),
            **report,
        })

    total_calls = sum(entry["callSites"] for entry in natives)
    payload = {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:battle-natives",
        "sourceEvidence": "VERIFIED_BINARY_STRUCTURE",
        "nameEvidence": "MECHANICAL_EXTRACTION_ONLY_NO_NAMES",
        "rom": {"sha256": ROM_SHA256, "title": ROM_TITLE.decode(), "code": ROM_CODE.decode()},
        "region": {
            "module": "ovl19",
            "ramLow": natives[0]["address"],
            "ramHigh": natives[-1]["address"],
            "totalBytes": sum(entry["bytes"] for entry in natives),
            "note": (
                "Each routine's extent is taken as the gap to the next CALL_NATIVE target, "
                "so a routine that shares a region with helpers reads larger than its own body."
            ),
        },
        "method": (
            "For each target the words up to the next target are decoded and scanned for "
            "`bl 0x02054A34` (a script argument read, with the literal index it asks for), "
            "`bl 0x02054A24` (a yield), any other `bl`, and every base-plus-displacement "
            "load or store. Nothing is named and no meaning is inferred."
        ),
        "nativeCount": len(natives),
        "totalCallSites": total_calls,
        "natives": natives,
    }

    target_file = out_dir / OUT_NAME
    with target_file.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")
    print("%d natives, %d bytes, %d call sites -> %s"
          % (len(natives), payload["region"]["totalBytes"], total_calls, target_file.name))
    return 0


if __name__ == "__main__":
    sys.exit(main())
