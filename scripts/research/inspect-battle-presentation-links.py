"""Read-only, bounded YDIJ OVL19 presentation evidence; never a runtime importer.

Usage: python scripts/research/inspect-battle-presentation-links.py ROM OUT_JSON
Requires the existing research environment's ndspy and capstone.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys

from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from ndspy.rom import NintendoDSRom

EXPECTED_ROM = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"


def inspect(rom_path):
    raw = Path(rom_path).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != EXPECTED_ROM:
        raise ValueError("This bounded address receipt applies only to the recorded YDIJ ROM")
    rom = NintendoDSRom(raw)
    overlay = rom.loadArm9Overlays()[19]
    data, base = bytes(overlay.data), overlay.ramAddress
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)

    def u32(address):
        if not base <= address <= base + len(data) - 4:
            raise ValueError(f"Address outside OVL19: {address:#x}")
        return struct.unpack_from("<I", data, address - base)[0]

    def cstring(address):
        if not base <= address < base + len(data):
            raise ValueError(f"String outside OVL19: {address:#x}")
        return data[address - base:].split(b"\0", 1)[0].decode("ascii")

    def instructions(start, end):
        return [{"address": f"0x{i.address:08X}", "mnemonic": i.mnemonic, "operands": i.op_str}
                for i in md.disasm(data[start - base:end - base], start)]

    def loader(call, directory_literal, asset_literal, expected):
        op = instructions(call, call + 4)[0]
        if op["mnemonic"] != "bl" or int(op["operands"].removeprefix("#"), 16) != 0x0208AF6C:
            raise ValueError("Expected generic model-loader branch")
        directory, name = cstring(u32(directory_literal)), cstring(u32(asset_literal))
        if f"{directory}/{name}" != expected:
            raise ValueError("Unexpected effect name")
        return {"call": f"0x{call:08X}", "target": "0x0208AF6C",
                "directoryLiteral": f"0x{directory_literal:08X}",
                "nameLiteral": f"0x{asset_literal:08X}", "logicalAsset": expected}

    direct = [loader(0x0211B03C, 0x0211B144, 0x0211B148, "battle/hypereffect"),
              loader(0x0211B0E8, 0x0211B168, 0x0211B16C, "battle/hypereffect_ring")]
    # The existing loader census establishes five entries. This reads those
    # entries only; it does not infer selector semantics from asset names.
    table = u32(0x0211A3F0)
    names = [cstring(u32(table + 4 * i)) for i in range(5)]
    if names != ["hitspark_small", "hitspark_big", "s_impact_s", "s_impact_b", "earth_hit"]:
        raise ValueError("Unexpected five-entry effect table")
    if cstring(u32(0x0211A3F4)) != "battle":
        raise ValueError("Unexpected effect directory")
    return {
        "schemaVersion": 1, "scope": "RESEARCH_ONLY_STATIC_BINARY_READ",
        "romSha256": digest, "gameCode": bytes(rom.idCode).decode("ascii"),
        "overlay": 19, "overlayBase": f"0x{base:08X}",
        "overlaySha256": hashlib.sha256(data).hexdigest(),
        "directModelLoaders": direct,
        "indexedModelLoader": {"call": "0x0211A260", "table": f"0x{table:08X}",
                               "entries": names, "selectorSemantics": "UNKNOWN_REQUIRES_TRACE"},
        "instructionWindows": {
            "indexedModelLoader": instructions(0x0211A24C, 0x0211A264),
            "hyperModelLoader": instructions(0x0211B02C, 0x0211B040),
            "hyperRingModelLoader": instructions(0x0211B0D8, 0x0211B0EC),
            "childActorNativePrefix": instructions(0x0211DF68, 0x0211E080)
        },
        "limits": ["No emulator execution or original battle replay in this receipt",
                   "No mapping from video attacks to these asset names",
                   "Camera, zoom ratio, timing, effect selection and compositing remain untraced",
                   "No ROM art copied, no runtime changes, no shipping permission implied"]
    }


if __name__ == "__main__":
    result = inspect(sys.argv[1])
    target = Path(sys.argv[2])
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"PASS: 2 named loaders, 5 table entries, 4 bounded instruction windows -> {target}")
