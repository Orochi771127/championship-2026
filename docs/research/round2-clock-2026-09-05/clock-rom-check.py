"""Research-only static clock checks against the Owner's exact YDIJ cartridge.

No runtime, decoded archive, external project or existing gameplay report is an
input. Requires ndspy and capstone. Emits bounded instruction receipts only.
This does not claim controlled execution, complete indirect-call coverage, or a
fully traced toolbar/mode matrix.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import capstone
import ndspy.codeCompression
import ndspy.rom

SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
BASE = 0x0210AA94


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", type=Path, default=Path("R:/" + SHA + ".nds"))
    parser.add_argument("--out", type=Path, default=Path(__file__).with_suffix(".json"))
    args = parser.parse_args()
    raw = args.rom.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SHA:
        raise SystemExit("ROM_SHA256_MISMATCH: " + digest)
    rom = ndspy.rom.NintendoDSRom(raw)
    overlays = rom.loadArm9Overlays()
    regions = {"ARM9": (rom.arm9RamAddress, ndspy.codeCompression.decompress(rom.arm9))}
    regions.update({f"OVL{k}": (v.ramAddress, bytes(v.data)) for k, v in overlays.items()})
    cs = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
    assertions = []

    def check(label, actual, expected):
        assertions.append({"id": label, "actual": actual, "expected": expected, "passed": actual == expected})

    def word(region, address):
        base, data = regions[region]
        return struct.unpack_from("<I", data, address - base)[0]

    def instruction(region, address):
        base, data = regions[region]
        return next(cs.disasm(data[address-base:address-base+4], address))

    def asm(region, address, mnemonic, operands):
        i = instruction(region, address)
        check(f"{region}:{address:#010x}", [i.mnemonic, i.op_str], [mnemonic, operands])

    def window(region, start, end):
        return {"region": region, "start": f"{start:#010x}", "endExclusive": f"{end:#010x}",
                "instructions": [{"address": f"a{addr:#010x}"[1:], "mnemonic": instruction(region, addr).mnemonic,
                                  "operands": instruction(region, addr).op_str} for addr in range(start, end, 4)]}

    check("game_code", rom.idCode.decode(), "YDIJ")
    check("cascade", [word("ARM9", 0x020C8A4C + 4*i) for i in range(5)], [4, 8, 24, 60, 400])
    check("clock_base_literal", word("ARM9", 0x02098800), BASE)
    check("elapsed_conversion_divisor", word("ARM9", 0x0207BB84), 33514)
    check("new_game_clock_source", word("ARM9", 0x0200119C), BASE + 0x24)
    check("timer_counter_register", word("ARM9", 0x02008A00), 0x04000100)
    check("raising_vtable_common_update", word("OVL18", 0x021289A4), 0x0207AFF8)
    check("end_day_state_entry", word("OVL18", 0x021281FC), 0x0210FA30)
    check("end_day_state_update", word("OVL18", 0x02128214), 0x0210FAA4)
    # External primary hardware implementation sources establish these nominal
    # LCD/timer constants. They are NOT numbers stored in this ROM.
    frame_cycles, bus_hz = 355 * 6 * 263, 33_513_982
    frame_tick_deltas = sorted({((p + frame_cycles) // 64) - (p // 64) for p in range(64)})
    check("derived_timer_tick_deltas_per_nominal_native_frame", frame_tick_deltas, [8752, 8753])
    check("derived_elapsed_units_per_nominal_native_frame", sorted({(t * 64) // 33514 for t in frame_tick_deltas}), [16])
    for address, mnemonic, operands in [
        (0x020987AC, "ldr", "r5, [r2, #0xc]"), (0x020987B0, "ldr", "r3, [r2, #8]"),
        (0x020987B4, "mov", "r0, #0x16"), (0x020987B8, "mul", "r4, r5, r3"),
        (0x020987BC, "str", "r4, [r1, #0x38]"), (0x020987C0, "ldr", "lr, [r2, #4]"),
        (0x020987C4, "mul", "r3, r5, r0"), (0x020987C8, "mul", "ip, lr, r4"),
        (0x020987CC, "str", "ip, [r1, #0x34]"), (0x020987D0, "ldr", "r4, [r2]"),
        (0x020987D4, "rsb", "r0, r5, r5, lsl #3"), (0x020987D8, "mul", "lr, r4, lr"),
        (0x020987DC, "mul", "ip, r4, ip"), (0x020987E4, "str", "ip, [r1, #0x2c]"),
        (0x020987E8, "str", "r3, [r1, #0x10]"), (0x020987EC, "str", "r0, [r1, #0x24]"),
        (0x020987F0, "ldr", "r0, [r2, #0x10]"), (0x020987F4, "str", "r0, [r1, #0x18]"),
        (0x02001024, "bl", "#0x207b9e4"), (0x0200102C, "ldr", "r0, [r0]"),
        (0x0207B9E8, "mov", "r1, #0"), (0x0207BA0C, "strb", "r1, [r0]"),
        (0x02001030, "bl", "#0x207bb8c"), (0x02001034, "bl", "#0x207bbd4"),
        (0x0207BBBC, "str", "r0, [r1, #4]"),
        (0x0207BA20, "ldr", "r1, [r0, #0x28]"), (0x0207BA28, "popne", "{r4, r5, r6, pc}"),
        (0x0207BA2C, "ldr", "r0, [r0, #0x20]"), (0x0207BA34, "popeq", "{r4, r5, r6, pc}"),
        (0x0207BA38, "bl", "#0x200896c"), (0x0207BA9C, "subs", "r5, r4, r2"),
        (0x0207BAA0, "sbc", "r0, r6, ip"), (0x0207BAA4, "lsl", "r1, r0, #6"),
        (0x0207BAAC, "orr", "r1, r1, r5, lsr #26"), (0x0207BAB0, "lsl", "r0, r5, #6"),
        (0x0207BAB4, "bl", "#0x202b4f0"), (0x0207BABC, "ldr", "r2, [r1, #8]"),
        (0x0207BAC0, "adds", "r0, r2, r0"), (0x0207BAC4, "str", "r0, [r1, #8]"),
        (0x0207BACC, "ldr", "r5, [r0, #0x18]"), (0x0207BAD8, "bl", "#0x202b764"),
        (0x0207BAE4, "ldr", "r2, [r1, #4]"), (0x0207BAE8, "add", "r3, r2, r0"),
        (0x0207BAEC, "str", "r3, [r1, #4]"), (0x0207BAF0, "ldr", "r2, [r1, #0x2c]"),
        (0x0207BB00, "str", "r2, [r1, #4]"), (0x0207BB08, "cmp", "r2, #0x63"),
        (0x0207BB0C, "addlo", "r2, r2, #1"), (0x0207BB10, "strblo", "r2, [r1]"),
        (0x0207BB14, "mul", "r1, r0, r5"), (0x0207BB24, "str", "r1, [r0, #8]"),
        (0x0207BB54, "bl", "#0x207bcfc"), (0x0207BB58, "cmp", "r0, #0x16"),
        (0x0207BB60, "bl", "#0x207bbd4"), (0x0207BB6C, "str", "r1, [r0, #0x1c]"),
        (0x0207BD08, "ldr", "r0, [r0, #4]"), (0x0207BD0C, "ldr", "r1, [r1, #0xc]"),
        (0x0207BD18, "ldr", "r1, [r1, #8]"), (0x0207BD40, "ldr", "r1, [r1, #0xc]"),
        (0x0207BD58, "ldr", "r0, [pc, #4]"), (0x0207BD5C, "ldrb", "r0, [r0]"),
        (0x0207B018, "bl", "#0x207ba18"), (0x0207AF64, "bl", "#0x207bbd4"),
        (0x0207AEA0, "bl", "#0x207bc68"), (0x0207AEA4, "bl", "#0x207bbd4"),
        (0x0207BC38, "str", "r2, [r0, #8]"), (0x0207BC44, "str", "r1, [r0, #0x20]"),
        (0x0207BBFC, "str", "r1, [r0, #8]"), (0x0207BC04, "str", "r1, [r0, #0x20]"),
        (0x020088C0, "mov", "r2, #0xc1"), (0x020088C8, "strh", "r2, [r3]"),
        (0x020437DC, "mov", "r0, r5"), (0x020437E0, "ldr", "r1, [r0]"),
        (0x020437E4, "ldr", "r1, [r1, #8]"), (0x020437E8, "blx", "r1"),
        (0x020437EC, "bl", "#0x2008f70"), (0x0204382C, "beq", "#0x20437dc"),
        (0x02043838, "b", "#0x20437dc"), (0x02008F7C, "mov", "r0, #1"),
        (0x02008F80, "mov", "r1, r0"), (0x02008F84, "bl", "#0x2006388"),
        (0x020063B4, "str", "r2, [r1, #0xff8]"), (0x020063C8, "tst", "r4, r0"),
        (0x020063CC, "popne", "{r4, r5, r6, pc}"), (0x020063E8, "tst", "r4, r0"),
        (0x020063EC, "beq", "#0x20063dc"),
    ]:
        asm("ARM9", address, mnemonic, operands)

    # End-day helper: (end - current) + (day - end) + start = day-current+start.
    for address, mnemonic, operands in [
        (0x0210FABC, "bl", "#0x207bd30"), (0x0210FAC4, "bl", "#0x207bcfc"),
        (0x0210FAD8, "mla", "ip, r4, r0, r6"), (0x0210FAE8, "sub", "r2, r0, r3"),
        (0x0210FAEC, "sub", "r4, r3, ip"), (0x0210FAF4, "add", "r1, r4, r2"),
        (0x0210FAF8, "add", "r0, r1, r0"), (0x0210FAFC, "bl", "#0x207bd88"),
        (0x0210EBBC, "bl", "#0x207bc14"),
        (0x0210FA34, "bl", "#0x207bbd4"),
        (0x0211DED8, "bl", "#0x20437d0"),
        (0x0211DEC8, "bl", "#0x211ce88"), (0x0211DEDC, "bl", "#0x211cfcc"),
        (0x0211CE8C, "bl", "#0x207ae74"), (0x0211D0C8, "bl", "#0x207af50"),
        (0x0211CF90, "lsr", "r0, r0, #1"), (0x0211CF94, "bl", "#0x207bdac"),
        (0x0211CFD8, "bl", "#0x207bdac"),
    ]:
        asm("OVL18", address, mnemonic, operands)
    for address, pointer in [(0x0210FB24,0x020C8A58),(0x0210FB28,BASE+0x10),
                             (0x0210FB2C,BASE+0x38),(0x0210FB30,BASE+0x24),
                             (0x0211CFC8,0x020C8A5C),(0x0211D0D0,0x020C8A5C)]:
        check(f"OVL18_literal_{address:#x}", word("OVL18",address), pointer)
    asm("OVL0",0x02116CA4,"ldr","r0, [r0, #0xa8]")
    asm("OVL0",0x02116CA8,"cmp","r0, #2")
    asm("OVL0",0x02116CAC,"beq","#0x2116cb4")
    asm("OVL0",0x02116CB0,"bl","#0x207bc14")
    asm("OVL19",0x02110004,"ldr","r0, [r0, #0xa8]")
    asm("OVL19",0x02110008,"cmp","r0, #6")
    asm("OVL19",0x02110010,"bl","#0x207bc14")
    asm("OVL17",0x0210C364,"bl","#0x210c218")
    asm("OVL17",0x0210C21C,"bl","#0x207ae74")
    asm("OVL17",0x0210C374,"bl","#0x20437d0")
    asm("OVL17",0x0210C2C0,"bl","#0x207af50")

    calls = []
    targets = {0x0207BA18:"update",0x0207BB8C:"set_minutes_and_start",0x0207BBD4:"stop",
               0x0207BC14:"resume",0x0207BC54:"lock",0x0207BC68:"unlock",0x0207BD88:"add_minutes",
               0x0207BDAC:"set_elapsed_divisor"}
    for region,(base,data) in regions.items():
        for off in range(0,len(data)-3,4):
            w = struct.unpack_from("<I",data,off)[0]
            if w & 0x0E000000 != 0x0A000000: continue
            delta=w&0xFFFFFF
            if delta & 0x800000: delta-=1<<24
            target=base+off+8+4*delta
            if target in targets:
                calls.append({"region":region,"site":f"{base+off:#010x}","target":f"{target:#010x}",
                              "meaning":targets[target],"kind":"BL" if w&0x01000000 else "B"})
    windows=[window("ARM9",0x020987A0,0x020987F8),window("ARM9",0x0207BA18,0x0207BB80),
             window("ARM9",0x0207BB8C,0x0207BBCC),window("ARM9",0x0207BBD4,0x0207BC0C),
             window("ARM9",0x0207BC14,0x0207BC4C),window("ARM9",0x0207BC9C,0x0207BCC4),
             window("ARM9",0x0207BCCC,0x0207BCF4),window("ARM9",0x0207BCFC,0x0207BD28),
             window("OVL18",0x0210FAA4,0x0210FB24),window("OVL0",0x02116C78,0x02116CC4),
             window("OVL19",0x0210FFFC,0x02110034), window("ARM9",0x020437D0,0x0204383C),
             window("ARM9",0x02008F70,0x02008F8C), window("ARM9",0x02006388,0x020063F4),
             window("OVL18",0x0211DEA8,0x0211DEFC),window("OVL18",0x0211CF78,0x0211CF9C),
             window("OVL18",0x0211CFCC,0x0211CFDC)]
    result={"schemaVersion":1,"scope":"RESEARCH_ONLY_STATIC_BINARY_RECHECK",
            "romSha256":digest,"romPath":str(args.rom),"clockBase":f"{BASE:#010x}",
            "derivedInitialFields":{"minuteOfYear":0,"yearByte":0,"minutesPerDay":1440,"minutesPerSeason":11520,
                "minutesPerYear":46080,"dayStartMinutes":420,"dayEndMinutes":1320,"elapsedUnitsPerWorldMinute":400},
            "normalElapsedFormula":"u = floor((timerDelta64 << 6) / 33514); remainder += u; minutes += floor(remainder / divisor); remainder %= divisor",
            "nominalNativeCadence":{"status":"DERIVED_FROM_ROM_CALL_CHAIN_AND_PRIMARY_HARDWARE_IMPLEMENTATIONS",
                "busCyclesPerFrame":frame_cycles,"busClockHz":bus_hz,"baseDivisorNativeFramesPerWorldMinute":25,
                "normalTrainingDivisor":200,"normalTrainingNativeFramesPerWorldMinute":12.5,
                "normalTrainingCanonical400UnitsPerFrame":32,
                "elapsedUnitsPerFrame":16,"frameSecondsNumerator":frame_cycles,"frameSecondsDenominator":bus_hz,
                "scope":"Regular unlagged VBlank cadence. Does not assert a controlled trace or emulate arbitrary CPU-stall jitter.",
                "primarySources":[
                    "https://github.com/devkitPro/libnds/blob/master/include/nds/timers.h",
                    "https://github.com/devkitPro/calico/blob/master/include/calico/nds/irq.h",
                    "https://github.com/devkitPro/calico/blob/master/include/calico/gba/timer.h",
                    "https://github.com/melonDS-emu/melonDS/blob/master/src/GPU.cpp"]},
            "limits":["Timer-counter input, not a recovered 60 fps constant.",
                "New Game assigns dayStartMinutes after reset; derivedInitialFields minuteOfYear=0 describes reset only.",
                "400 is the initialized base divisor. OVL18 scene entry unconditionally sets 200; scene exit restores 400. Normal Training therefore consumes 16 raw elapsed units per native frame with divisor 200.",
                "22-hour check happens after adding minutes; it is not a pre-update clamp.",
                "Stop/resume clear sub-minute remainder and elapsed baseline in the ROM.",
                "Explicit End Day state entry stops (clearing remainder), then its update adds minutes. The add helper does not itself wrap year; later day processing requires further tracing.",
                "Direct ARM B/BL census excludes indirect calls, Thumb paths and data aliases; absence alone does not prove a paused mode.",
                "Only identified numeric mode gates are proved; no complete toolbar/cube/UI crosswalk is asserted."],
            "assertions":assertions,"summary":{"passed":sum(x["passed"] for x in assertions),"total":len(assertions)},
            "directClockCallSites":calls,"instructionWindows":windows}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["summary"]))
    return 0 if all(x["passed"] for x in assertions) else 1


if __name__ == "__main__":
    raise SystemExit(main())
