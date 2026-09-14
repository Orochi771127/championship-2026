"""Bounded native replay of the recovery-cage star loop, OVL18 02110FB0..021110D4.

The original resident update runs this block right after the status-icon
selector (02110EC8..02110FAC). It starts common sequence 32 on the resident's
effect animator at +0x310 when the resident's cage record (+0x120, definition
at +4 via ARM9 02050028) is 15, 18 or 28 and the resident is not in state
6/7/20; stops only on state 6; rests 120 updates after each play; and redraws
at the body position lifted by 0x1000 on every playing update.

The ARM instructions run in Unicorn from the ROM. Only the animator/renderer
entries are intercepted: 02047904 (start), 02047C48 (finished), 02047A08
(advance) and 0211DF10 (submit). The intercepted animator is a one-shot of the
catalog's own sequence-32 tick total, so this receipt proves the control flow,
not NANR playback or hardware rendering.

Usage: python check-raising-recovery-stars-cpu.py --rom <YDIJ.nds> --out <receipt.json>
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R4, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
START, STOP = 0x02110FB0, 0x021110D8
ACTOR, BODY, CAGE, STACK = 0x02300000, 0x02301000, 0x02302000, 0x023F0000
ANIM = ACTOR + 0x310

ap = argparse.ArgumentParser()
ap.add_argument("--rom", required=True)
ap.add_argument("--out", required=True)
a = ap.parse_args()
raw = Path(a.rom).read_bytes()
assert hashlib.sha256(raw).hexdigest() == SHA, "ROM_HASH_MISMATCH"
rom = NintendoDSRom(raw)
repo = Path(__file__).resolve().parents[2]
catalog = json.loads((repo / "src/data/championship/catalogs/raising-feedback.r1.json").read_text(encoding="utf-8"))
sequence = next(s for s in catalog["sequences"] if s["id"] == 32)
assert sequence["playbackMode"] == 1
play_ticks = sum(f["ticks"] for f in sequence["frames"])

u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
u.mem_map(0x02000000, 0x400000)
for section in rom.loadArm9().sections:
    if section.data and 0x02000000 <= section.ramAddress < 0x02400000:
        u.mem_write(section.ramAddress, bytes(section.data))
ovl18 = rom.loadArm9Overlays()[18]
u.mem_write(ovl18.ramAddress, bytes(ovl18.data))
assert u.mem_read(START, 4) == struct.pack("<I", 0xE5940448), "OVL18_ALIGNMENT"  # ldr r0,[r4,#0x448]

def put(at, n): u.mem_write(at, struct.pack("<i", n))
def get(at): return struct.unpack("<i", u.mem_read(at, 4))[0]

anim = {"active": False, "ticks": 0}
calls = []
def ret(value=0):
    u.reg_write(UC_ARM_REG_R0, value)
    u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))

def hook(_, address, size, user):
    if address not in (0x02047904, 0x02047C48, 0x02047A08, 0x0211DF10):
        return
    r0, r1, r2 = (u.reg_read(r) for r in (UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2))
    assert r0 == ANIM, f"UNEXPECTED_ANIMATOR {r0:#x} at {address:#x}"
    if address == 0x02047904:
        calls.append(["start", r1]); anim.update(active=True, ticks=0); ret()
    elif address == 0x02047C48:
        calls.append(["finished"]); ret(0 if anim["active"] else 1)
    elif address == 0x02047A08:
        calls.append(["advance", r1]); anim["ticks"] += r1 >> 12
        if anim["ticks"] >= play_ticks: anim["active"] = False
        ret()
    else:
        calls.append(["submit", r1, r2, [get(ANIM + 0x24), get(ANIM + 0x28), get(ANIM + 0x2C)], get(ANIM + 0x34)]); ret()

u.hook_add(UC_HOOK_CODE, hook)
put(ACTOR + 0x3C, BODY)
put(ACTOR + 0x120, CAGE)
put(ACTOR + 0x448, 0)
put(ACTOR + 0x44C, 0)

# One continuous timeline: every branch (start, blocked start, carried stop,
# continue through 7/20, cage change without a carry, restart) in order.
timeline = []
def span(count, state, cage):
    timeline.extend([(state, cage)] * count)
span(400, 1, 15)   # two full plays and rests in the mini infirmary
span(1, 6, 15)     # carried: stops
span(20, 1, 14)    # ordinary cage: never starts
span(20, 7, 28)    # state 7 blocks a start even in the infirmary
span(59, 1, 28)    # starts
span(30, 20, 28)   # state 20 does not stop a running loop
span(10, 7, 28)    # neither does 7
span(60, 1, 18)    # cage changed without state 6: loop keeps running
span(1, 6, 18)
span(40, 20, 18)   # state 20 blocks the restart after a stop
span(260, 1, 18)   # hot spring: restarts and cycles

updates = []
for index, (state, cage) in enumerate(timeline):
    calls.clear()
    position = [0x100000 + index * 0x800, 0x80000 + (index % 7) * 0x1000, (index % 3) * 0x1000]
    u.mem_write(BODY + 0x24, struct.pack("<3i", *position))
    put(BODY + 0x34, 0x40 + index % 5)
    u.mem_write(ACTOR + 8, bytes([state]))
    put(CAGE + 4, cage)
    u.reg_write(UC_ARM_REG_R4, ACTOR)
    u.reg_write(UC_ARM_REG_SP, STACK)
    u.emu_start(START, STOP, count=2000)
    assert u.reg_read(UC_ARM_REG_PC) == STOP
    updates.append({"state": state, "cageDefinitionIndex": cage, "positionQ12": position, "body34": 0x40 + index % 5,
                    "active": get(ACTOR + 0x448), "rest": get(ACTOR + 0x44C), "calls": [list(c) for c in calls]})

receipt = {
    "romSha256": SHA,
    "evidence": "BOUNDED_NATIVE_REPLAY",
    "range": "OVL18 02110FB0..021110D4",
    "boundary": "ROM instructions executed; animator start/finished/advance and sprite submit intercepted. The intercepted animator is a one-shot of catalog sequence 32's tick total. No NANR playback or hardware rendering claim.",
    "sequence": 32,
    "sequenceTicks": play_ticks,
    "updates": updates,
}
Path(a.out).write_text(json.dumps(receipt, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
starts = sum(1 for x in updates for c in x["calls"] if c[0] == "start")
submits = sum(1 for x in updates for c in x["calls"] if c[0] == "submit")
print(json.dumps({"updates": len(updates), "starts": starts, "submits": submits, "playTicks": play_ticks}))
