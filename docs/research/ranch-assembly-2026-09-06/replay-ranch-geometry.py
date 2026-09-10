"""Execute exact YDIJ placement and field-origin instructions, research only.

Requires ndspy, capstone and unicorn. No emulated game/save or artwork is emitted.
The isolated calls use synthetic records; this is not a live gameplay trace.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import capstone
import ndspy.rom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3, UC_ARM_REG_R4, UC_ARM_REG_R5, UC_ARM_REG_SP, UC_ARM_REG_LR

SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
OUT = Path(__file__).with_name("native-geometry-receipt.json")
CTX, SPRITES, STACK, STOP = 0x02300000, 0x02302000, 0x023f0000, 0x023ff000


def build(rom_path):
    raw = Path(rom_path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError("ROM_SHA256_MISMATCH")
    rom = ndspy.rom.NintendoDSRom(raw)
    uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    uc.mem_map(0x02000000, 0x400000)
    for section in rom.loadArm9().sections:
        if section.data and not 0x02000000 <= section.ramAddress < 0x02400000:
            lo = section.ramAddress & ~0xfff
            size = (section.ramAddress - lo + len(section.data) + 0xfff) & ~0xfff
            uc.mem_map(lo, size)
        uc.mem_write(section.ramAddress, bytes(section.data))
    ov = rom.loadArm9Overlays()[15]
    uc.mem_write(ov.ramAddress, bytes(ov.data))

    def read32(address):
        return struct.unpack("<I", uc.mem_read(address, 4))[0]

    def write32(address, value):
        uc.mem_write(address, struct.pack("<I", value & 0xffffffff))

    def execute(start, end, registers):
        uc.reg_write(UC_ARM_REG_SP, STACK)
        uc.reg_write(UC_ARM_REG_LR, STOP)
        for reg, value in registers.items():
            uc.reg_write(reg, value)
        uc.emu_start(start, end, count=20000)
        # Instruction budget exhaustion must never become an accepted vector.
        from unicorn.arm_const import UC_ARM_REG_PC
        assert uc.reg_read(UC_ARM_REG_PC) == end

    masks = list(uc.mem_read(0x0210db40, 16))
    field_mask_address = read32(0x02082790)
    field_masks = list(uc.mem_read(field_mask_address, 16))
    assert masks == field_masks
    definition_shapes = [read32(0x020c8cbc + i * 40) for i in range(36)]
    assert all(0 <= shape < 16 for shape in definition_shapes)
    vectors = []
    for slots in (14, 16, 18, 20):
        locked = (0xffffffff << slots) & 0xffffffff
        for shape, mask in enumerate(masks):
            for slot in range(20):
                for occupied in (locked, locked | (1 << slot)):
                    uc.mem_write(CTX, bytes(0x100))
                    uc.mem_write(SPRITES, bytes(0xf0))
                    write32(CTX + 0x34, SPRITES)
                    write32(CTX + 0x40, occupied)
                    uc.mem_write(SPRITES + 0xe0, bytes([shape]))
                    execute(0x0210c118, STOP, {UC_ARM_REG_R0: CTX, UC_ARM_REG_R1: 0, UC_ARM_REG_R2: slot})
                    ok = bool(uc.reg_read(UC_ARM_REG_R0))
                    assert ok == ((mask & (occupied >> slot)) == 0)
                    after = read32(CTX + 0x40)
                    x, y = read32(SPRITES + 0x24), read32(SPRITES + 0x28)
                    if ok:
                        assert (x, y) == ((2 + 24 * (slot // 2) + 12 * (slot % 2)) * 4096,
                                          (8 + 22 * (slot % 2)) * 4096)
                        assert after == occupied | (mask << slot)
                        assert uc.mem_read(SPRITES + 0xe1, 1)[0] == slot
                        assert read32(SPRITES + 0xd8) == 1
                    else:
                        assert after == occupied and x == y == 0
                    vectors.append({"unlockedSlots": slots, "shape": shape, "slot": slot,
                                    "occupiedBefore": occupied, "ok": ok, "occupiedAfter": after,
                                    "xFixed": x, "yFixed": y})

    field_vectors = []
    for shape, mask in enumerate(masks):
        for slot in range(20):
            write32(STACK + 0x1c, CTX)
            write32(CTX + 0x3020, 120)  # max-rank tilemap row stride; no art consumer mocked
            write32(CTX + 0x3030, SPRITES)
            execute(0x020827b0, 0x020827f8, {UC_ARM_REG_R3: shape, UC_ARM_REG_R5: slot})
            x = uc.reg_read(UC_ARM_REG_R0)
            y = uc.reg_read(UC_ARM_REG_R4)
            offset = uc.reg_read(UC_ARM_REG_R1)
            assert x == 12 * (slot // 2) + 6 * (slot % 2) + (0 if mask & 1 else 6)
            assert y == 8 * (slot % 2)
            assert offset == y * 120 + x
            field_vectors.append({"shape": shape, "slot": slot, "destinationTileX": x,
                                  "destinationTileY": y, "destinationOffset": offset})

    cs = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
    windows = []
    for name, lo, hi in [("board-placement", 0x0210c118, 0x0210c234),
                         ("rank-cover-switch", 0x0210c638, 0x0210c720),
                         ("shape-writer", 0x02050030, 0x020500a0),
                         ("saved-anchor-get-set", 0x020500ac, 0x020500bc),
                         ("editor-restore-consumer", 0x0210c834, 0x0210c8ac),
                         ("field-input-consumer", 0x02082150, 0x02082194),
                         ("field-tile-origin", 0x0208279c, 0x02082818),
                         ("field-top-source-crop", 0x02082874, 0x020828bc)]:
        payload = bytes(uc.mem_read(lo, hi-lo))
        windows.append({"name": name, "image": "OVL15" if lo >= 0x0210b300 else "ARM9",
                        "start": hex(lo), "endExclusive": hex(hi), "sha256": hashlib.sha256(payload).hexdigest(),
                        "instructions": [{"address": hex(i.address), "op": i.mnemonic, "args": i.op_str}
                                         for i in cs.disasm(payload, lo)]})
    return {"schemaVersion": 1, "classification": "RESEARCH_ONLY_NO_RUNTIME_ASSETS",
            "romSha256": SHA, "overlay15Sha256": hashlib.sha256(bytes(ov.data)).hexdigest(),
            "method": "ISOLATED_ORIGINAL_ARM_EXECUTION_SYNTHETIC_RECORDS_NO_FUNCTION_STUBS",
            "boardPlacementEntry": "OVL15 0x0210C118", "maskTable": {"boardAddress": "0x0210DB40",
            "fieldAddress": hex(field_mask_address), "values": masks},
            "definitionShapeAddress": "ARM9 0x020C8CBC stride 40", "definitionShapes": definition_shapes,
            "placementVectorCount": len(vectors), "placementVectors": vectors,
            "fieldVectorCount": len(field_vectors), "fieldVectors": field_vectors, "instructionWindows": windows,
            "limits": ["Synthetic records are not a live original gameplay trace.",
                       "Board origin is not Training pixel origin.",
                       "Field results are tilemap destination coordinates before source row cropping and row-wrap composition.",
                       "Original compositor also crops 3 source tile rows for the upper row and may wrap horizontally.",
                       "Waiting Room and empty-space filler require separate composition handling.",
                       "No actor placement, camera transform, save migration or shipping acceptance is established."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rom", default=f"R:/{SHA}.nds")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = build(args.rom)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        assert OUT.read_text(encoding="utf-8") == encoded, "STALE_GEOMETRY_RECEIPT"
    else:
        OUT.write_text(encoded, encoding="utf-8", newline="\n")
    print(json.dumps({"placementVectors": result["placementVectorCount"], "fieldVectors": result["fieldVectorCount"],
                      "maskValues": result["maskTable"]["values"], "definitionShapes": result["definitionShapes"],
                      "receipt": str(OUT), "check": args.check}))
