#!/usr/bin/env python3
"""Transcribe the battle script VM's opcode table and OVL19's script blob.

The 52-entry dispatch table lives in ARM9 at 0x020BDEAC; the bytecode it runs
lives in overlay 19 at 0x021204A0. Both are read back out of the cartridge on
every run, and the script blob is decoded here with the same operand sizes the
product VM uses -- if a size were wrong the linear decode would not land exactly
on the byte where ARM code resumes, and this script would refuse to write.

The ROM is evidence, not a repository asset. Point the script at it with --rom
or the YDIJ_ROM environment variable.

    python scripts/build-battle-script-catalog.py --rom /path/to/YDIJ.nds
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import struct
import sys
from collections import Counter
from pathlib import Path

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
ROM_TITLE = b"DIGIMONCHAMP"
ROM_CODE = b"YDIJ"

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"
OUT_NAME = "battle-scripts.r1.json"

OPCODE_TABLE = 0x020BDEAC
OPCODE_COUNT = 52
OPCODE_STRIDE = 8
# The table ends where the compiler placed the two stack-overflow asserts.
TABLE_TERMINATOR = 0x020BE04C
TERMINATOR_TEXT = b"script.cpp\x00\x00Script Stack Overflow!\n\x00"

SCRIPT_BLOB_START = 0x021204A0
SCRIPT_BLOB_END = 0x0212FDA4

MOVE_TABLE = 0x020CFF9C
MOVE_STRIDE = 0x68
MOVE_COUNT = 596
MOVE_SCRIPT_FIELDS = (0x1C, 0x28, 0x3C)

# Byte length of each instruction, counting the opcode. Everything not listed is
# a bare opcode byte.
TWO_BYTE = (0x02, 0x03, 0x05, 0x06, 0x07, 0x09, 0x0A)
FIVE_BYTE = (0x01, 0x28, 0x29, 0x2A, 0x31, 0x32)
JUMP_OPS = (0x28, 0x29, 0x2A, 0x31)
CALL_OP = 0x31
CALL_NATIVE_OP = 0x32
RETURN_OP = 0x33

NAMES = [
    "NOP", "PUSH_IMM32", "PUSH_LOCAL", "PUSH_SLOT194", "LOAD_INDIRECT",
    "PUSH_LOCAL_ADDRESS", "POP_TO_LOCAL", "POP_TO_SLOT194", "STORE_INDIRECT",
    "PUSH_ZEROS", "POP_N", "ADD", "SUB", "MUL", "DIV_UNSIGNED", "MOD_UNSIGNED",
    "INC", "DEC", "DUP", "ADD_FX", "SUB_FX", "MUL_FX", "DIV_FX", "MOD_FX",
    "INC_FX", "DEC_FX", "INDEX_FX", "AND", "OR", "XOR", "LOGICAL_AND",
    "LOGICAL_OR", "LOGICAL_NOT", "BITWISE_NOT", "NEGATE", "SHL", "SHR_LOGICAL",
    "SHL_2", "SHR_ARITHMETIC", "COMPARE3_UNSIGNED", "JUMP", "JUMP_IF_ZERO",
    "JUMP_IF_NONZERO", "EQ", "NE", "LT", "LE", "GE", "GT", "CALL",
    "CALL_NATIVE", "RETURN",
]


def sizes():
    table = {op: 1 for op in range(OPCODE_COUNT)}
    for op in TWO_BYTE:
        table[op] = 2
    for op in FIVE_BYTE:
        table[op] = 5
    return table


SIZE = sizes()


class Image:
    """A loaded module addressed by its RAM address."""

    def __init__(self, name, data, rom, ram, size):
        self.name = name
        self.ram = ram
        self.size = size
        self.buf = data[rom:rom + size]

    def bytes(self, ram, length):
        start = ram - self.ram
        if start < 0 or start + length > len(self.buf):
            raise SystemExit("0x%08X+%d is outside %s" % (ram, length, self.name))
        return self.buf[start:start + length]

    def u8(self, ram):
        return self.bytes(ram, 1)[0]

    def u32(self, ram):
        return struct.unpack_from("<I", self.bytes(ram, 4), 0)[0]


def load(rom_path):
    data = rom_path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != ROM_SHA256:
        raise SystemExit("ROM sha256 %s is not the transcribed cartridge" % digest)
    if data[0x00:0x0C] != ROM_TITLE or data[0x0C:0x10] != ROM_CODE:
        raise SystemExit("header title/code is not DIGIMONCHAMP / YDIJ")

    arm9 = Image("arm9", data,
                 struct.unpack_from("<I", data, 0x20)[0],
                 struct.unpack_from("<I", data, 0x28)[0],
                 struct.unpack_from("<I", data, 0x2C)[0])

    fat = struct.unpack_from("<I", data, 0x48)[0]
    ovt = struct.unpack_from("<I", data, 0x50)[0]
    ovt_size = struct.unpack_from("<I", data, 0x54)[0]
    overlay19 = None
    for index in range(ovt_size // 32):
        entry = ovt + index * 32
        if struct.unpack_from("<I", data, entry)[0] != 19:
            continue
        ram = struct.unpack_from("<I", data, entry + 4)[0]
        size = struct.unpack_from("<I", data, entry + 8)[0]
        file_id = struct.unpack_from("<I", data, entry + 24)[0]
        start = struct.unpack_from("<I", data, fat + file_id * 8)[0]
        end = struct.unpack_from("<I", data, fat + file_id * 8 + 4)[0]
        overlay19 = Image("ovl19", data, start, ram, min(size, end - start))
    if overlay19 is None:
        raise SystemExit("overlay 19 is not in the ARM9 overlay table")
    return arm9, overlay19


def read_opcode_table(arm9):
    handlers, adjusts = [], []
    for op in range(OPCODE_COUNT):
        handlers.append(arm9.u32(OPCODE_TABLE + op * OPCODE_STRIDE))
        adjusts.append(arm9.u32(OPCODE_TABLE + op * OPCODE_STRIDE + 4))
    if OPCODE_TABLE + OPCODE_COUNT * OPCODE_STRIDE != TABLE_TERMINATOR:
        raise SystemExit("the opcode table does not end at the assert strings")
    if arm9.bytes(TABLE_TERMINATOR, len(TERMINATOR_TEXT)) != TERMINATOR_TEXT:
        raise SystemExit("the bytes after the opcode table are not the overflow assert")
    if set(adjusts) != {0}:
        raise SystemExit("a pointer-to-member adjust word is non-zero")
    low, high = min(handlers), max(handlers)
    if sorted(set(handlers)) != sorted(handlers):
        raise SystemExit("two opcodes share a handler")
    return handlers, low, high


def decode_blob(overlay):
    """Linear decode of the whole blob. Returns per-offset instruction records."""
    blob = overlay.bytes(SCRIPT_BLOB_START, SCRIPT_BLOB_END - SCRIPT_BLOB_START)
    at = 0
    boundaries = set()
    order = []
    while at < len(blob):
        op = blob[at]
        if op >= OPCODE_COUNT:
            raise SystemExit("byte 0x%02X at 0x%08X is not an opcode"
                             % (op, SCRIPT_BLOB_START + at))
        size = SIZE[op]
        operand = None
        if size == 2:
            operand = blob[at + 1]
        elif size == 5:
            operand = struct.unpack_from("<I", blob, at + 1)[0]
        boundaries.add(at)
        order.append((at, op, size, operand))
        at += size
    if at != len(blob):
        raise SystemExit("the linear decode overran the blob by %d bytes" % (at - len(blob)))
    return blob, order, boundaries


def move_script_entries(arm9):
    entries = set()
    for index in range(MOVE_COUNT):
        record = arm9.bytes(MOVE_TABLE + index * MOVE_STRIDE, MOVE_STRIDE)
        for field in MOVE_SCRIPT_FIELDS:
            value = struct.unpack_from("<I", record, field)[0]
            if value:
                entries.add(value)
    return sorted(entries)


def build(arm9, overlay):
    handlers, handler_low, handler_high = read_opcode_table(arm9)
    blob, order, boundaries = decode_blob(overlay)

    used = Counter(op for _at, op, _size, _operand in order)
    natives = Counter()
    call_targets = set()
    off_boundary = []
    for at, op, _size, operand in order:
        if op in JUMP_OPS and operand:
            target = operand - SCRIPT_BLOB_START
            if target not in boundaries:
                off_boundary.append((SCRIPT_BLOB_START + at, operand))
            if op == CALL_OP:
                call_targets.add(operand)
        elif op == CALL_NATIVE_OP:
            natives[operand] += 1
    if off_boundary:
        raise SystemExit("%d jump targets miss an instruction boundary" % len(off_boundary))

    move_entries = move_script_entries(arm9)
    for entry in move_entries:
        if entry - SCRIPT_BLOB_START not in boundaries:
            raise SystemExit("move script entry 0x%08X is not an instruction boundary" % entry)

    routines = []
    for entry in sorted(set(move_entries) | call_targets):
        at = entry - SCRIPT_BLOB_START
        length = 0
        instructions = 0
        while True:
            op = blob[at + length]
            instructions += 1
            length += SIZE[op]
            if op == RETURN_OP:
                break
        routines.append({
            "ramAddress": "0x%08X" % entry,
            "blobOffset": entry - SCRIPT_BLOB_START,
            "byteLength": length,
            "instructionCount": instructions,
            "reachedFrom": ("MOVE_RECORD_AND_CALL" if entry in set(move_entries) and entry in call_targets
                            else "MOVE_RECORD" if entry in set(move_entries) else "SCRIPT_CALL"),
        })

    opcodes = []
    for op in range(OPCODE_COUNT):
        opcodes.append({
            "code": op,
            "codeHex": "0x%02X" % op,
            "name": NAMES[op],
            "bytes": SIZE[op],
            "handler": "0x%08X" % handlers[op],
            "occurrencesInBattleScripts": used.get(op, 0),
        })

    return {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:battle-scripts",
        "sourceEvidence": "VERIFIED_BINARY_STRUCTURE",
        "rom": {"sha256": ROM_SHA256, "title": ROM_TITLE.decode(), "code": ROM_CODE.decode()},
        "vm": {
            "dispatchSite": "ARM9:0x020549D4",
            "initSite": "ARM9:0x020548D4",
            "runSite": "ARM9:0x02054980",
            "yieldSite": "ARM9:0x02054A24",
            "opcodeTableBase": "0x%08X" % OPCODE_TABLE,
            "opcodeTableStride": OPCODE_STRIDE,
            "opcodeCount": OPCODE_COUNT,
            "opcodeCountEvidence": (
                "the table ends at 0x%08X, where the compiler placed 'script.cpp' and "
                "'Script Stack Overflow!' for the two handlers that check the stack, so "
                "entry 52 would start inside those strings" % TABLE_TERMINATOR
            ),
            "handlerSpan": ["0x%08X" % handler_low, "0x%08X" % handler_high],
            "slotCount": 96,
            "callStackLimit": 0x5E,
            "callNativeStackLimit": 0x60,
        },
        "blob": {
            "module": "ovl19",
            "ramBase": "0x%08X" % SCRIPT_BLOB_START,
            "ramEnd": "0x%08X" % SCRIPT_BLOB_END,
            "byteLength": len(blob),
            "instructionCount": len(order),
            "decodeEvidence": (
                "a linear decode from the base with these operand sizes consumes the "
                "blob exactly and stops on the byte where ARM code resumes; every jump "
                "and call target lands on an instruction boundary"
            ),
            "encoding": "base64",
            "base64": base64.b64encode(blob).decode("ascii"),
        },
        "opcodes": opcodes,
        "opcodesUnusedByBattleScripts": [op for op in range(OPCODE_COUNT) if not used.get(op)],
        "moveRecordEntryPoints": ["0x%08X" % entry for entry in move_entries],
        "nativeTargets": [
            {"address": "0x%08X" % address, "callSites": count}
            for address, count in sorted(natives.items())
        ],
        "routineCount": len(routines),
        "routines": routines,
    }


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

    arm9, overlay19 = load(rom_path)
    payload = build(arm9, overlay19)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / OUT_NAME
    with target.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")
    print("%d opcodes, %d bytes of bytecode, %d instructions, %d routines, %d natives -> %s"
          % (payload["vm"]["opcodeCount"], payload["blob"]["byteLength"],
             payload["blob"]["instructionCount"], payload["routineCount"],
             len(payload["nativeTargets"]), target.name))
    return 0


if __name__ == "__main__":
    sys.exit(main())
