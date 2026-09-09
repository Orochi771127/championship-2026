"""Execute bounded original ARM writers in Unicorn. ROM stays research-only.

Requires ndspy, capstone, unicorn. --out is a numeric receipt, not an asset pack.
RNG B7=37, target position, and animation completion are controlled inputs;
this is a CPU dataflow replay, not a live DeSmuME playthrough or full wild AI.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3, UC_ARM_REG_R4, UC_ARM_REG_R5, UC_ARM_REG_R7, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

p = argparse.ArgumentParser()
p.add_argument("--rom", required=True)
p.add_argument("--out", required=True)
a = p.parse_args()
raw = Path(a.rom).read_bytes()
sha = hashlib.sha256(raw).hexdigest()
assert sha == "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
rom = NintendoDSRom(raw)
arm = bytes(decompress(rom.arm9))
overlays = rom.loadArm9Overlays()
decoder=Cs(CS_ARCH_ARM,CS_MODE_ARM)
static_links=[]
for module,address,expected in [
 (0,0x02119BB8,"str r2, [r0, r3, lsl #2]"), (0,0x02119BC4,"add ip, ip, #0x1c8"),
 (0,0x0211A944,"bl #0x2062100"),(0,0x0211A95C,"bl #0x211b3ec"),(0,0x0211AA5C,"bl #0x2065eb0"),
 (None,0x02065FA8,"bl #0x206489c"),(None,0x02066008,"bl #0x206489c"),
 (None,0x020648E8,"bl #0x210b924"),(0,0x0210B930,"str r1, [r4, #0x110]"),
 (0,0x02116E58,"bl #0x2044100"),(0,0x02116E6C,"str r1, [r4, #0x3c]"),
 (0,0x021178A0,"str r3, [r0, #0x24]"),
 (14,0x0210C084,"bl #0x2061bb4"),(14,0x0210C0CC,"str r0, [r1, #0x24]"),
 (None,0x02061BD8,"mov r0, #0x1cc"),(None,0x02061FB8,"cmp lr, #0x10")]:
    base,code=(0x02000000,arm) if module is None else (overlays[module].ramAddress,bytes(overlays[module].data))
    ins=next(decoder.disasm(code[address-base:address-base+4],address))
    actual=f"{ins.mnemonic} {ins.op_str}"
    assert actual==expected,(hex(address),actual,expected)
    static_links.append({"module":"ARM9" if module is None else f"OVL{module}","address":hex(address),"instruction":actual})
u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
u.mem_map(0x02000000, 0x400000)
u.mem_write(0x02000000, arm)
u.mem_write(overlays[0].ramAddress, bytes(overlays[0].data))
R, W, ACTOR, TOOL, SCENE = 0x02301000, 0x02302000, 0x02304000, 0x02305000, 0x02306000
P, PLAYER, MANAGER, CARD, POOL = 0x02308000, 0x02309000, 0x0230B000, 0x02310000, 0x02320000
STACK, STOP = 0x023E0000, 0x023F0000
def put(addr, value): u.mem_write(addr, struct.pack("<I", value & 0xffffffff))
def get(addr): return struct.unpack("<I", u.mem_read(addr, 4))[0]
def reg(r): return u.reg_read(r)
def ret(value=0): u.reg_write(UC_ARM_REG_R0, value); u.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))
events, stubs = [], set()
active_overlay = 0
rng_b7 = 37
def hook(uc, address, size, data):
    if address == 0x020431D4:
        assert reg(UC_ARM_REG_R0) == 0xB7
        stubs.add("controlled_RNG_B7_result"); ret(rng_b7)
    elif address == 0x020669B8:
        stubs.add("object_lookup_returns_bound_W"); ret(W)
    elif active_overlay == 0 and address == 0x0210C18C:
        stubs.add("target_anchor_Q12_0_0"); out = reg(UC_ARM_REG_R0)
        put(out, 0); put(out+4, 0); put(out+8, 0); ret(out)
    elif address == 0x02002738:
        # FX_Div uses the DS divider and rounds the 64-bit quotient to Q12.
        stubs.add("DS_FX_Div_hardware_adapter")
        num, den = reg(UC_ARM_REG_R0), reg(UC_ARM_REG_R1)
        ret(((num << 32) // den + 0x80000) >> 20)
    elif address == 0x02044100:
        stubs.add("hand_event_16"); ret(1 if reg(UC_ARM_REG_R1) == 0x16 else 0)
    elif address == 0x02043F90:
        events.append(reg(UC_ARM_REG_R1)); stubs.add("event_dispatch_observed"); ret()
    elif address == 0x02066630:
        events.append(reg(UC_ARM_REG_R2)); stubs.add("AI_event_dispatch_observed_not_consumed"); ret()
    elif address in [0x02047904, 0x0203EA30, 0x02047C48, 0x0207B784, 0x02043860] or (
            active_overlay == 0 and address in [0x0210BC60, 0x0210C048, 0x0211DC1C]):
        stubs.add(hex(address)); ret()
u.hook_add(UC_HOOK_CODE, hook)
def run(start, end=STOP, registers=None):
    u.reg_write(UC_ARM_REG_SP, STACK)
    u.reg_write(UC_ARM_REG_LR, STOP)
    for r,v in (registers or {}).items(): u.reg_write(r,v)
    u.emu_start(start, end, count=1000000)
    assert reg(UC_ARM_REG_PC) == end, f"did not finish: {reg(UC_ARM_REG_PC):08x}"

# One species-008 individual. Execute its HP branch with controlled B7 output.
species = 8
species_at = 0x020C1374 + species * 0x84
rung = struct.unpack("<H", u.mem_read(species_at+0x30,2))[0]
base_hp = struct.unpack("<h", u.mem_read(0x020CA008+rung*16,2))[0]
next_hp = struct.unpack("<H", u.mem_read(0x020CA008+min(rung+1,24)*16,2))[0]
put(R, species); put(R+0xAC, base_hp)
hp_vectors=[]
for vector_rung in [0,1,24]:
    low=struct.unpack("<h",u.mem_read(0x020CA008+vector_rung*16,2))[0]
    high=struct.unpack("<H",u.mem_read(0x020CA008+min(vector_rung+1,24)*16,2))[0]
    for rng_b7 in [0,37,102]:
        put(R+0xAC,low)
        run(0x0206232C,0x02062378,{UC_ARM_REG_R7:R,UC_ARM_REG_R1:min(vector_rung+1,24)})
        hp_vectors.append({"baseHp":low,"nextRungHp":high,"randomB7":rng_b7,"currentHp":get(R+0x50),"maxHp":get(R+0x58)})
rng_b7=37
put(R+0xAC,base_hp)
run(0x0206232C, 0x02062378, {UC_ARM_REG_R7:R, UC_ARM_REG_R1:min(rung+1,24)})
assert get(R+0x50) == get(R+0x58) == 210
put(W+0x110,R); put(W+0x34,ACTOR)
run(0x0210BA00, 0x0210BA28, {UC_ARM_REG_R4:W})
assert get(W+0x4E8) == get(W+0x4EC) == 210
put(TOOL+0x48,0)
run(0x02115ACC, registers={UC_ARM_REG_R0:TOOL})
assert get(TOOL+0x30)==360
put(TOOL+0x44,species_at); put(TOOL+0x40,0)
run(0x0211585C, 0x02115980, {UC_ARM_REG_R5:TOOL, UC_ARM_REG_R4:W, UC_ARM_REG_R0:0})
assert get(TOOL+0x3C)==3584
put(0x0212AC80,0); put(0x0212ACB8,0); put(0x0212AC48,0)
u.mem_write(0x0210A730,struct.pack("<HHH",60,0,1))
pull=[]
while get(W+0x4E8)>0:
    run(0x02114F54, registers={UC_ARM_REG_R0:TOOL,UC_ARM_REG_R1:4})
    pull.append([len(pull)+1,get(W+0x4E8),get(TOOL+0x30),get(TOOL+0x40)])
    assert len(pull)<360
assert get(R+0x50)==210

# Independent boundary vectors, including the non-modulo accumulator behavior.
vectors=[]
for distance, rate, ticks in [(39,3584,1),(40,3584,4),(79,5000,5),(80,3584,3),(160,3584,1),(161,3584,1)]:
    put(W+0x4E8,500); put(W+0x4EC,500); put(W+0x4FC,1)
    put(TOOL+0x30,360); put(TOOL+0x34,360); put(TOOL+0x3C,rate); put(TOOL+0x40,0)
    u.mem_write(0x0210A730,struct.pack("<HHH",distance,0,1))
    values=[]
    for tick in range(ticks):
        run(0x02114F54, registers={UC_ARM_REG_R0:TOOL,UC_ARM_REG_R1:4})
        values.append([get(W+0x4E8),get(TOOL+0x30),get(TOOL+0x40)])
    vectors.append({"distance":distance,"damageQ12":rate,"movementBlocked":True,"frames":values})
put(W+0x4E8,0); put(W+0x4EC,210); put(W+0x4FC,0)

# The down animation completion writes readiness at 0210CBCC..E4. Enter this
# boundary explicitly; the animation engine itself is not emulated here.
run(0x0210CBCC,0x0210CBE8,{UC_ARM_REG_R4:W})
assert get(W+0x50C)==2 and get(W+0x4F8)==1
put(0x020FBA08,P); put(P+4,PLAYER); put(P+0x20,CARD); put(P+0x24,0)
put(0x0212AC1C,SCENE); put(PLAYER+0xA84,1); put(W+0x510,0)
# Use the event-16 branch, preserving its stack scratch and exact capacity sum.
run(0x0210CBF4,0x0210D0E8,{UC_ARM_REG_R4:W})
assert 0x20 in events and get(W+0x50C)==3 and get(P+0x24)==0
put(SCENE+0x3C,0); put(0x0212ACB4,0); u.mem_write(SCENE+0x10,struct.pack("<H",10))
run(0x02117458,0x021178A4,{UC_ARM_REG_R5:SCENE})
assert get(P+0x24)==1 and get(CARD)==species and get(CARD+0x50)==210

# Result overlay 14, not the unrelated OVL4 name-edit module.
u.mem_write(overlays[14].ramAddress,bytes(overlays[14].data))
active_overlay = 14
put(0x0210AA18,MANAGER); put(MANAGER+8,POOL); put(MANAGER+4,0)
run(0x0210C03C)
assert get(P+0x24)==0 and get(MANAGER+4)==1 and get(POOL)==1
assert get(POOL+4)==species and get(POOL+4+0x50)==210
receipt={
 "status":"BOUNDED_NATIVE_CPU_DATAFLOW_REPLAY_PASS_NOT_LIVE_PLAYTHROUGH",
 "romSha256":sha,"arm9Sha256":hashlib.sha256(arm).hexdigest(),
 "overlays":{str(i):{"base":hex(overlays[i].ramAddress),"sha256":hashlib.sha256(overlays[i].data).hexdigest()} for i in [0,14]},
 "input":{"speciesIndex":species,"baseHp":base_hp,"nextRungHp":next_hp,"randomB7":37,
          "ropeIndex":0,"coefficient":80,"durabilityByte":6,"generation":1,"temperament71":1,"gCost":12,
          "dxQ12":60*4096,"dyQ12":0},
 "output":{"initialHp":210,"damageQ12":3584,"pullTicks":len(pull),"lastPull":pull[-1],
           "wildHpAtCapture":0,"cardHp":210,"homeHp":get(POOL+4+0x50),"homeCount":get(MANAGER+4),"cardCountAfterHome":get(P+0x24)},
 "staticLinkInstructions":static_links,"hpInitializationVectors":hp_vectors,"pullFrames":pull,"ropeBoundaryVectors":vectors,"controlledBoundaries":sorted(stubs),
 "excluded":["live spawn distribution and RNG state","full wild AI and event 11 consumer","native pointer/tool routing",
             "animation renderer before insertion subphase","original hardware save serialization"]}
Path(a.out).write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
print(json.dumps(receipt["output"]))
