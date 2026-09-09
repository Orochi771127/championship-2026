"""Read-only YDIJ instruction receipts; never exports ROM assets for runtime."""
import argparse
import hashlib
import json
from pathlib import Path
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from ndspy.rom import NintendoDSRom

parser = argparse.ArgumentParser()
parser.add_argument("--rom", required=True)
parser.add_argument("--out", required=True)
args = parser.parse_args()
raw = Path(args.rom).read_bytes()
rom_sha = hashlib.sha256(raw).hexdigest()
assert rom_sha == "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
rom = NintendoDSRom(raw)
overlay = rom.loadArm9Overlays()[0]
assert overlay.ramAddress == 0x0210B300
decoder = Cs(CS_ARCH_ARM, CS_MODE_ARM)

checks = {
    "camera_inverse_delta": {
        0x0211CD4C: "sub r0, r0, r5", 0x0211CD50: "sub r1, r1, r6",
        0x0211CD54: "bl #0x211dcf0", 0x0211CD58: "str r5, [r7, #8]",
        0x0211CD60: "str r6, [r7, #0xc]",
        0x0211D17C: "sub r0, r0, r4", 0x0211D180: "sub r1, r1, r5",
        0x0211D184: "bl #0x211dcf0",
    },
    "camera_origin_writer_and_bounds": {
        0x0211DCF4: "ldr r3, [r2, #0xd4]", 0x0211DCF8: "add r3, r3, r0",
        0x0211DCFC: "str r3, [r2, #0xd4]", 0x0211DD00: "ldr r0, [r2, #0x64]",
        0x0211DD04: "add r0, r0, r1", 0x0211DD08: "str r0, [r2, #0x64]",
        0x0211DD0C: "ldr r0, [r2, #0xe4]", 0x0211DD14: "strlt r0, [r2, #0xd4]",
        0x0211DD20: "sub r0, r0, #0x100", 0x0211DD28: "strgt r0, [r2, #0xd4]",
        0x0211DD30: "ldr r1, [r0, #0xdc]", 0x0211DD3C: "strlt r1, [r0, #0x64]",
        0x0211DD48: "sub r1, r1, #0xc0", 0x0211DD50: "strgt r1, [r0, #0x64]",
    },
    "stroke_short_distance_counter": {
        0x02113FD0: "mov r1, #0x3c", 0x02114020: "cmp sb, #0x5000",
        0x02114024: "bgt #0x2114044", 0x02114030: "add r1, r1, #1",
        0x02114034: "cmp r1, #0x3c", 0x02114040: "pople {r3, r4, r5, r6, r7, r8, sb, sl, fp, pc}",
    },
    "stroke_interpolation_and_ring": {
        0x021140A8: "mov r0, #0xa", 0x021140AC: "mul r3, r2, r0",
        0x021140B8: "mul r0, r1, r0", 0x02114160: "sub sb, sb, #0x14000",
        0x0211419C: "cmp r0, #0x14", 0x021141A0: "strge fp, [r4, #0x118]",
        0x0211427C: "cmp r0, #0x14", 0x02114284: "strge r0, [r1, #0x118]",
    },
    "stroke_active_sample_expiration": {
        0x021142F8: "bl #0x2047a08", 0x0211430C: "ldr r0, [sb, #0xc]",
        0x02114310: "cmp r0, #0", 0x02114314: "bne #0x2114328",
        0x02114318: "str r5, [sl, #0x104]", 0x02114320: "sub r0, r0, #1",
        0x02114324: "str r0, [r4]",
    },
}
groups = []
for group, expected in checks.items():
    observed = []
    for address, instruction in expected.items():
        offset = address - overlay.ramAddress
        decoded = next(decoder.disasm(bytes(overlay.data[offset:offset + 4]), address))
        actual = f"{decoded.mnemonic} {decoded.op_str}"
        assert actual == instruction, f"{address:08x}: {actual} != {instruction}"
        observed.append({"address": f"0x{address:08X}", "instruction": actual})
    groups.append({"id": group, "instructions": observed, "pass": True})
receipt = {
    "status": "SPECIFIED_INSTRUCTIONS_VERIFIED_NOT_FULL_CAPTURE_PARITY",
    "romSha256": rom_sha, "overlayId": 0, "overlayRamAddress": "0x0210B300",
    "overlaySha256": hashlib.sha256(overlay.data).hexdigest(),
    "groupCount": len(groups), "instructionCount": sum(len(g["instructions"]) for g in groups),
    "groups": groups,
    "unknown": ["camera lower-bound initialization", "release impulse helper 0x0211DD5C",
                "native stroke tick cadence and animation sample lifetime", "tool HP and durability writers",
                "wild encounter initialization", "on-card insertion and Home commit"]
}
Path(args.out).write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"groups": receipt["groupCount"], "instructions": receipt["instructionCount"], "pass": True}))
