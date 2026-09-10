#!/usr/bin/env python3
"""Independently check bounded OVL0 geometry facts against the supplied ROM.

Research tool only. Reads the ROM and current Championship source files. Does
not read another project's reports/code or emit an overlay/binary payload.
Instruction addresses are search candidates from this repository's existing
captureStrokeRecognizer.js. Conclusions below are limited to checked branches.
Requires the same ndspy/capstone dependencies as existing repository tools.
"""

import argparse
import hashlib
import json
from pathlib import Path

from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from ndspy.rom import NintendoDSRom


EXPECTED_ROM = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
EXPECTED_OVL0 = "538b35fd7fd23080540c3d18d2974f0a54c78bc0ceda6e599340f4696688ebc0"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", required=True)
    parser.add_argument("--out", default=str(Path(__file__).with_suffix(".json")))
    args = parser.parse_args()
    payload = Path(args.rom).read_bytes()
    if sha256(payload) != EXPECTED_ROM:
        raise SystemExit("Wrong ROM SHA-256; no claims generated")
    rom = NintendoDSRom(payload)
    if bytes(rom.idCode) != b"YDIJ":
        raise SystemExit("Wrong game code")
    overlay = rom.loadArm9Overlays()[0]
    code = bytes(overlay.data)
    if overlay.ramAddress != 0x0210B300 or sha256(code) != EXPECTED_OVL0:
        raise SystemExit("Unexpected OVL0 identity")
    decoder = Cs(CS_ARCH_ARM, CS_MODE_ARM)

    def instruction(address):
        offset = address - overlay.ramAddress
        decoded = list(decoder.disasm(code[offset:offset + 4], address))
        if len(decoded) != 1:
            raise ValueError(f"Cannot decode {address:#x}")
        item = decoded[0]
        return {"address": f"0x{address:08X}", "mnemonic": item.mnemonic,
                "operands": item.op_str}

    checks = []

    def check(label, expected, conclusion, limits):
        evidence = []
        for address, expected_mnemonic, expected_operands in expected:
            actual = instruction(address)
            if (actual["mnemonic"], actual["operands"]) != (expected_mnemonic, expected_operands):
                raise AssertionError({"label": label, "expected": [expected_mnemonic, expected_operands], "actual": actual})
            evidence.append(actual)
        checks.append({"id": label, "status": "VERIFIED_THIS_ROM_STATIC_INSTRUCTIONS",
                       "conclusion": conclusion, "limits": limits, "instructions": evidence})

    check("distance_5_has_counter_exception", [
        (0x02114018, "bl", "#0x2002b84"),
        (0x0211401C, "mov", "sb, r0"),
        (0x02114020, "cmp", "sb, #0x5000"),
        (0x02114024, "bgt", "#0x2114044"),
        (0x02114028, "add", "r0, sl, #0x1000"),
        (0x0211402C, "ldr", "r1, [r0, #0x120]"),
        (0x02114030, "add", "r1, r1, #1"),
        (0x02114034, "cmp", "r1, #0x3c"),
        (0x02114038, "str", "r1, [r0, #0x120]"),
        (0x0211403C, "addle", "sp, sp, #0x30"),
        (0x02114040, "pople", "{r3, r4, r5, r6, r7, r8, sb, sl, fp, pc}"),
        (0x02114044, "add", "r2, sl, #0x1000"),
        (0x02114048, "mov", "r0, #0"),
        (0x0211404C, "str", "r0, [r2, #0x120]"),
    ], "The helper result is compared with 0x5000. Values <= threshold increment object+0x1120 and early-return only when the updated signed counter <=60. Values above threshold, or counter expiry, continue and reset that counter.",
       "Do not summarize this as unconditional ignore <=5. Counter update cadence, helper arithmetic, initialization context and complete sampler behavior are not certified here.")

    check("threshold_20_selects_interpolation_branch", [
        (0x02113FD8, "lsl", "r4, r7, #0xc"),
        (0x02113FDC, "lsl", "r5, r6, #0xc"),
        (0x02114050, "cmp", "sb, #0x14000"),
        (0x02114054, "ble", "#0x21141dc"),
        (0x021140A8, "mov", "r0, #0xa"),
        (0x021140AC, "mul", "r3, r2, r0"),
        (0x021140B8, "mul", "r0, r1, r0"),
        (0x02114160, "sub", "sb, sb, #0x14000"),
        (0x021141A8, "cmp", "sb, #0x14000"),
        (0x021141B4, "bgt", "#0x21140ec"),
    ], "Inputs are shifted left12 before helper use. 0x14000 selects a separate repeated insertion branch. That branch subtracts 0x14000 from its scalar and loops while >0x14000; vector components on the branch are multiplied by10 after helper calls.",
       "Threshold20 is not proof of exactly20-pixel inserted spacing. Vector normalization helpers and insertion semantics require further trace.")

    check("twenty_slot_index_wrap", [
        (0x02114204, "ldr", "r6, [r2, #0x118]"),
        (0x02114208, "mov", "r1, #0xd8"),
        (0x0211420C, "mla", "r3, r6, r1, sl"),
        (0x02114214, "str", "r0, [r3, #0x104]"),
        (0x02114270, "ldr", "r0, [r1, #0x118]"),
        (0x02114274, "add", "r0, r0, #1"),
        (0x02114278, "str", "r0, [r1, #0x118]"),
        (0x0211427C, "cmp", "r0, #0x14"),
        (0x02114280, "movge", "r0, #0"),
        (0x02114284, "strge", "r0, [r1, #0x118]"),
        (0x02114198, "ldr", "r0, [r4, #0x118]"),
        (0x0211419C, "cmp", "r0, #0x14"),
        (0x021141A0, "strge", "fp, [r4, #0x118]"),
        (0x021140E8, "mov", "fp, #0"),
    ], "The indexed slots have stride0xD8. The insertion index increments then resets to0 at >=20, in both checked branches. This is circular overwrite behavior, not freeze-after20.",
       "No claim that every slot remains active forever; slot lifetime and active markers are separate semantics.")

    check("six_count_and_twenty_slot_scan", [
        (0x02114390, "add", "r7, r4, #0x1000"),
        (0x02114394, "ldr", "r0, [r7, #0x11c]"),
        (0x02114398, "cmp", "r0, #6"),
        (0x0211439C, "movlt", "r0, #0"),
        (0x021143A0, "poplt", "{r3, r4, r5, r6, r7, r8, sb, pc}"),
        (0x02114458, "add", "r0, r0, #1"),
        (0x0211445C, "cmp", "r0, #0x14"),
        (0x02114460, "add", "lr, lr, #0xd8"),
        (0x02114464, "add", "r5, r5, #0xd8"),
        (0x02114468, "blt", "#0x21143c4"),
    ], "The evaluator returns0 when object+0x111C <6, then scans20 slots at stride0xD8.",
       "The count field's entire lifecycle and per-slot validity are not covered by this bounded check.")

    check("twentyfive_and_fifteen_shape_arithmetic", [
        (0x02114514, "add", "r0, r4, #0x124"),
        (0x02114518, "add", "r1, r4, #0x130"),
        (0x0211451C, "add", "r0, r0, #0x1000"),
        (0x02114520, "add", "r1, r1, #0x1000"),
        (0x02114524, "bl", "#0x2002b84"),
        (0x02114528, "add", "r2, r4, #0x148"),
        (0x0211452C, "add", "r1, r4, #0x13c"),
        (0x02114530, "mov", "r5, r0"),
        (0x02114534, "add", "r0, r1, #0x1000"),
        (0x02114538, "add", "r1, r2, #0x1000"),
        (0x0211453C, "bl", "#0x2002b84"),
        (0x02114540, "mov", "r6, r0"),
        (0x02114544, "cmp", "r5, #0x19000"),
        (0x02114548, "ble", "#0x21145cc"),
        (0x0211454C, "subs", "r0, r5, r6"),
        (0x02114550, "rsbmi", "r0, r0, #0"),
        (0x02114554, "subs", "r1, r5, r6, lsl #1"),
        (0x02114558, "rsbmi", "r1, r1, #0"),
        (0x0211455C, "cmp", "r0, #0xf000"),
        (0x02114560, "cmpge", "r1, #0xf000"),
        (0x02114564, "bge", "#0x21145cc"),
        (0x021145CC, "mov", "r0, #0"),
    ], "A=helper(object+0x1124,object+0x1130), B=helper(object+0x113C,object+0x1148). This tail rejects A<=0x19000. It also rejects when both abs(A-B)>=0xF000 and abs(A-2B)>=0xF000 (under the nonoverflow positive-scalar interpretation). The15 threshold consumes those differences, not an explicitly loaded first/last stroke gap.",
       "Earlier extrema ordering gates also exist. Do not label this Math.max(AABB width,height)>=25 or minimum-AABB-axis>25. Full helper math, overflow behavior, all earlier gates and global absence of a separate closure test are not certified.")

    repo = Path(__file__).resolve().parents[4]
    source = repo / "src/championship/hunt/capture/captureStrokeRecognizer.js"
    report = {
        "schemaVersion": 1,
        "scope": "INDEPENDENT_SUPPLIED_ROM_STATIC_GEOMETRY_BRANCH_CHECK_ONLY",
        "inputs": {"romSha256": EXPECTED_ROM, "romSize": len(payload), "gameCode": "YDIJ",
                   "overlayId": 0, "overlayRamAddress": f"0x{overlay.ramAddress:08X}",
                   "overlaySha256": EXPECTED_OVL0, "overlaySize": len(code),
                   "currentSource": "src/championship/hunt/capture/captureStrokeRecognizer.js",
                   "currentSourceSha256": sha256(source.read_bytes()),
                   "otherProjectFilesRead": False},
        "checks": checks,
        "checkedInstructionCount": sum(len(c["instructions"]) for c in checks),
        "currentImplementationDifferences": [
            "Current sampler's <5 early return omits original checked low-distance counter branch.",
            "Current max20 early return differs from directly checked circular insertion index.",
            "Current >=25 maximum-extent and endpoint15 rules are not equivalent to checked evaluator tail.",
            "Current <=20 interpolation routine must not claim exact original spacing until helper chain is traced."
        ],
        "notVerified": ["Full stroke parity", "ARM9 helper0x02002B84 arithmetic",
                        "Counter update cadence and slot lifetime", "Complete evaluator ordering gates",
                        "Any separate endpoint closure condition", "Spatial query and event0x23 consumer",
                        "Pull/shutter mode semantics", "HP and rope durability writers",
                        "Memory-card capacity/species cost", "Capture/collection/save commit",
                        "Native-to-world gameplay scale", "Live emulator comparison"],
        "binaryPayloadIncluded": False,
        "runtimeCodeChanged": False,
    }
    Path(args.out).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"checks": len(checks), "instructions": report["checkedInstructionCount"],
                      "out": args.out, "status": "PASS_BOUNDED_STATIC_CHECK"}))


if __name__ == "__main__":
    main()
