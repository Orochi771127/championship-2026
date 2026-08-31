#!/usr/bin/env python3
"""Produce a source-free Gate Earth static trace from an owner-supplied YDIJ ROM."""

import argparse
import hashlib
import json
import struct
from pathlib import Path

try:
    from ndspy.rom import NintendoDSRom
except ImportError as error:
    raise SystemExit("ndspy is required for this opt-in research script.") from error


EXPECTED_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
EXPECTED_OVL12_SHA256 = "489bc406b5af7da905b5a283f0778cf342612a5bd359ec6548a5699c3ad08a97"


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def read_u32(payload, offset):
    return struct.unpack_from("<I", payload, offset)[0]


def arm_bl_target(address, instruction):
    if instruction & 0x0F000000 != 0x0B000000:
        raise ValueError(f"0x{address:08X} is not an ARM BL instruction")
    displacement = instruction & 0x00FFFFFF
    if displacement & 0x00800000:
        displacement -= 0x01000000
    return (address + 8 + displacement * 4) & 0xFFFFFFFF


def occurrences(payload, needle):
    results = []
    cursor = 0
    while True:
        found = payload.find(needle, cursor)
        if found < 0:
            return results
        results.append(found)
        cursor = found + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rom", required=True, help="Path to the owner-supplied YDIJ ROM")
    parser.add_argument(
        "--out",
        default="docs/art/production/vfx/GATE_EARTH_OVL12_TRACE_V1.json",
        help="Source-free report output path",
    )
    args = parser.parse_args()

    rom_payload = Path(args.rom).read_bytes()
    rom_hash = sha256(rom_payload)
    if rom_hash != EXPECTED_ROM_SHA256:
        raise SystemExit(f"Unexpected ROM SHA-256: {rom_hash}")
    rom = NintendoDSRom(rom_payload)
    if bytes(rom.idCode) != b"YDIJ":
        raise SystemExit(f"Unexpected game code: {bytes(rom.idCode)!r}")

    overlays = rom.loadArm9Overlays()
    overlay = overlays[12]
    ovl12 = bytes(overlay.data)
    if sha256(ovl12) != EXPECTED_OVL12_SHA256 or overlay.ramAddress != 0x0210B300 or len(ovl12) != 39200:
        raise SystemExit("OVL12 identity verification failed")

    world_path = "gate_select/3D_worldMap_model.nsbmd"
    earth_path = "gate_select/earth.nsbmd"
    world_id = rom.filenames.idOf(world_path)
    earth_id = rom.filenames.idOf(earth_path)
    if (world_id, earth_id) != (5382, 5398):
        raise SystemExit(f"Unexpected Gate asset IDs: {(world_id, earth_id)}")

    base = overlay.ramAddress
    caller_call = 0x0210F108
    wrapper = arm_bl_target(caller_call, read_u32(ovl12, caller_call - base))
    model_load_call = 0x0210C6FC
    model_loader = arm_bl_target(model_load_call, read_u32(ovl12, model_load_call - base))
    folder_literal = read_u32(ovl12, 0x0210F110 - base)
    model_literal = read_u32(ovl12, 0x0210F114 - base)
    if (wrapper, model_loader, folder_literal, model_literal) != (
        0x0210C6D8,
        0x0208AF6C,
        0x02114754,
        0x02114760,
    ):
        raise SystemExit("OVL12 loader-chain verification failed")
    if ovl12[folder_literal - base :].split(b"\0", 1)[0] != b"gate_select":
        raise SystemExit("Gate folder literal verification failed")
    if ovl12[model_literal - base :].split(b"\0", 1)[0] != b"3D_worldMap_model":
        raise SystemExit("Gate model literal verification failed")

    code_blobs = [("ARM9", rom.arm9RamAddress, bytes(rom.arm9))]
    code_blobs.extend((f"OVL{overlay_id}", item.ramAddress, bytes(item.data)) for overlay_id, item in overlays.items())
    earth_ascii_hits = []
    for name, blob_base, payload in code_blobs:
        for offset in occurrences(payload.lower(), b"earth"):
            tail = payload[offset : offset + 32].split(b"\0", 1)[0].decode("ascii", "replace")
            earth_ascii_hits.append({"binary": name, "address": f"0x{blob_base + offset:08X}", "text": tail})

    earth_id_u16_hits = occurrences(ovl12, struct.pack("<H", earth_id))
    earth_id_u32_hits = occurrences(ovl12, struct.pack("<I", earth_id))
    report = {
        "schemaVersion": 1,
        "traceId": "championship-gate-earth-ovl12-trace-v1",
        "scope": "STATIC_CODE_TRACE_SOURCE_FREE",
        "rom": {"gameCode": "YDIJ", "sha256": rom_hash, "payloadIncluded": False, "sourcePathIncluded": False},
        "overlay": {
            "id": 12,
            "fileId": overlay.fileID,
            "ramBase": "0x0210B300",
            "size": len(ovl12),
            "sha256": sha256(ovl12),
            "payloadIncluded": False,
        },
        "assets": {
            "worldMap": {"fileId": world_id, "size": len(rom.files[world_id]), "sha256": sha256(rom.files[world_id])},
            "earth": {"fileId": earth_id, "size": len(rom.files[earth_id]), "sha256": sha256(rom.files[earth_id])},
        },
        "worldMapLoaderChain": {
            "caller": "0x0210F0EC",
            "wrapperCall": "0x0210F108",
            "wrapper": f"0x{wrapper:08X}",
            "modelLoadCall": "0x0210C6FC",
            "modelLoader": f"0x{model_loader:08X}",
            "arguments": {"folder": "gate_select", "model": "3D_worldMap_model"},
            "status": "ROM_VERIFIED",
        },
        "earthConsumerSearch": {
            "ovl12AsciiEarthHits": 0,
            "ovl12EarthFileIdU16Hits": len(earth_id_u16_hits),
            "ovl12EarthFileIdU32Hits": len(earth_id_u32_hits),
            "romCodeAsciiEarthHits": earth_ascii_hits,
            "status": "NO_GATE_SELECT_EARTH_CONSUMER_PROVEN",
        },
        "runtimeDecision": {
            "gateWorldMap": "ELIGIBLE_FOR_BOUNDED_INTEGRATION",
            "gateEarth": "REFERENCE_ONLY_DO_NOT_MOUNT",
            "reason": "The verified Gate Select loader names only 3D_worldMap_model. OVL12 contains neither the Earth asset name nor its file ID; the sole Earth code string belongs to battle/earth_hit.",
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote source-free Gate Earth trace: {out}")


if __name__ == "__main__":
    main()
