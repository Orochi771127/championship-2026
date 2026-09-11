"""Research-only CPU probe: is the championship run block part of the saved player record?

The rounds probe recorded the cursor, total, flags, category and prize at
+0xCA0..+0xCAC of some structure, but not which structure. The tamer rank is a
known saved field at player+0x0AE8. If both reach their struct through the same
global pointer, the run survives a save; if not, a tournament is one sitting.

Resolves the base pointer each site loads from its own literal pool and compares.
Reads the ROM only; writes no production asset and no save.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROM_SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
# Tournament run writers recorded 2026-09-10.
RUN_SITES = [0x02111C1C, 0x0211220C, 0x02112238, 0x02112858, 0x02112B48]
RUN_FIELDS = {0xCA0: "category", 0xCA4: "roundCursor", 0xCA8: "totalRounds", 0xCAC: "roundFlags", 0xC94: "prize"}
TAMER_RANK = 0x0AE8


def load(rom_path):
    raw = Path(rom_path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if sha != ROM_SHA:
        raise SystemExit(f"unexpected ROM {sha}")
    rom = NintendoDSRom(raw)
    images = {"arm9": (rom.arm9RamAddress, bytes(decompress(rom.arm9)))}
    for index, overlay in rom.loadArm9Overlays().items():
        images[f"ovl{index}"] = (overlay.ramAddress, bytes(overlay.data))
    return images


def word_at(images, address, prefer=None):
    """Overlays share address space, so the image the code came from wins."""
    order = ([prefer] if prefer in images else []) + [n for n in images if n != prefer]
    for name in order:
        base, data = images[name]
        if base <= address < base + len(data) - 3:
            return struct.unpack_from("<I", data, address - base)[0]
    return None


def regions_of(images, address):
    """Overlays share address space, so an address can sit in several images."""
    return [name for name, (base, data) in images.items() if base <= address < base + len(data)]


def resolve_base(images, site, back=0x60):
    """Walk back from a store and resolve the literal the base register came from."""
    for name in regions_of(images, site):
        found = resolve_in(images, name, site, back)
        if found:
            return {**found, "overlay": name}
    return None


def resolve_in(images, name, site, back):  # noqa: D401
    base, data = images[name]
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    start = site - back
    text = {i.address: (i.mnemonic, i.op_str) for i in md.disasm(data[start - base:site - base + 4], start)}
    store = text.get(site)
    if not store or not store[0].startswith("str"):
        return None
    holder = store[1].split("[")[1].split(",")[0].strip("] ")
    # Most recent `ldr <holder>, [<ptr>]` before the store, then the literal <ptr> came from.
    for address in sorted((a for a in text if a < site), reverse=True):
        mnemonic, ops = text[address]
        if not mnemonic.startswith("ldr"):
            continue
        dest = ops.split(",")[0].strip()
        if dest != holder:
            continue
        inner = ops.split("[")[1].split("]")[0].split(",")[0].strip() if "[" in ops else None
        if inner is None:
            return None
        for earlier in sorted((a for a in text if a < address), reverse=True):
            m2, o2 = text[earlier]
            if m2.startswith("ldr") and o2.split(",")[0].strip() == inner and "pc," in o2.replace(" ", ""):
                offset = int(o2.split("#")[1].rstrip("]"), 0)
                return {"globalPointerAt": f"{earlier + 8 + offset:08X}",
                        "globalValue": word_at(images, earlier + 8 + offset, name),
                        "resolvedVia": f"{address:08X}"}
        return None
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rom", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    images = load(args.rom)

    run = []
    for site in RUN_SITES:
        resolved = resolve_base(images, site)
        run.append({"site": f"{site:08X}", **(resolved or {"overlay": None, "globalPointerAt": None})})

    # Every ARM9/overlay access to player+0x0AE8, to find that struct's own global.
    rank = []
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    for name, (base, data) in images.items():
        for insn in md.disasm(data, base):
            if insn.mnemonic.startswith(("ldr", "str")) and f"#0x{TAMER_RANK:x}]" in insn.op_str:
                resolved = resolve_in(images, name, insn.address, 0x60)
                if resolved:
                    rank.append({"site": f"{insn.address:08X}", "overlay": name, **resolved})
                if len(rank) >= 12:
                    break
        if len(rank) >= 12:
            break

    fmt = lambda v: f"{v:08X}" if isinstance(v, int) else None
    run_globals = sorted({fmt(e.get("globalValue")) for e in run if e.get("globalValue")})
    rank_globals = sorted({fmt(e.get("globalValue")) for e in rank if e.get("globalValue")})
    shared = sorted(set(run_globals) & set(rank_globals))

    report = {
        "evidence": "STATIC_DECODE",
        "inputClass": "ROM_CODE_READ_NOT_LIVE_PLAY",
        "romSha256": ROM_SHA,
        "question": "Do the championship run fields and the saved tamer rank reach their struct through the same global?",
        "runFields": {f"0x{k:03X}": v for k, v in RUN_FIELDS.items()},
        "runSites": run,
        "tamerRankSites": rank,
        "runGlobals": run_globals,
        "tamerRankGlobals": rank_globals,
        "sharedGlobals": shared,
        "verdict": ("SAME_STRUCT_RUN_IS_IN_THE_SAVED_RECORD" if shared and shared == run_globals
                    else "DIFFERENT_STRUCTS_RUN_IS_NOT_THE_SAVED_RECORD" if run_globals and rank_globals and not shared
                    else "UNRESOLVED"),
        "limits": [
            "Sharing a base global places the fields in one struct; it does not prove the save writes that whole struct.",
            "Resolution walks back a fixed window from each store and stops at the first matching literal load.",
        ],
    }
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("runGlobals", "tamerRankGlobals", "sharedGlobals", "verdict")}, indent=1))


if __name__ == "__main__":
    main()
