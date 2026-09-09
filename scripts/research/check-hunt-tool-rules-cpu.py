"""Independent instruction probes of Hunt tools; synthetic Unicorn actors.

No DeSmuME/player save writes. Art/audio/event sinks are inert; all formula and
branch bodies run from the hash-locked original ARM9/OVL0. Divider MMIO and RNG
are explicit adapters in the receipt, never claims of an untouched playthrough.
"""
import argparse
import json
import struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *
from hunt_original_probe import load_rom, ROM_SHA


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    _, arm, overlay = load_rom()
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x400000)
    u.mem_write(0x02000000, arm)
    u.mem_write(overlay.ramAddress, bytes(overlay.data))
    W, AI, ACTOR, RECORD, TOOL = 0x02300000, 0x02301000, 0x02302000, 0x02303000, 0x02304000
    STACK, STOP = 0x023EF000, 0x023F0000
    def put(a, value): u.mem_write(a, struct.pack('<I', value & 0xffffffff))
    def get(a): return struct.unpack('<i', u.mem_read(a, 4))[0]
    def reg(r): return u.reg_read(r)
    def ret(value=0):
        u.reg_write(UC_ARM_REG_R0, value & 0xffffffff)
        u.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))
    events, rng_calls = [], []
    sample = 0
    def hook(uc, address, size, data):
        if address == 0x02002738:
            num = reg(UC_ARM_REG_R0); den = reg(UC_ARM_REG_R1)
            quotient = -1 if den == 0 else (num << 32) // den
            ret((quotient + 0x80000) >> 20)
        elif address == 0x020669B8: ret(W)
        elif address == 0x0210C18C:
            target = reg(UC_ARM_REG_R0)
            u.mem_write(target, bytes(12)); ret(target)
        elif address == 0x02066630:
            events.append(reg(UC_ARM_REG_R2)); ret()
        elif address == 0x020431D4:
            rng_calls.append(['channel', reg(UC_ARM_REG_R0)]); ret(sample)
        elif address == 0x0210B5E4:
            rng_calls.append(['wild', reg(UC_ARM_REG_R1)]); ret(sample)
        elif address == 0x02043EF4:
            events.append(reg(UC_ARM_REG_R1)); ret()
        elif address in [0x02047904, 0x0203EA30, 0x0210BC60, 0x02044114]: ret()
    u.hook_add(UC_HOOK_CODE, hook)
    def run(start, registers, stop=STOP):
        u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, STOP)
        for r, value in registers.items(): u.reg_write(r, value & 0xffffffff)
        u.emu_start(start, stop, count=10000)
        assert reg(UC_ARM_REG_PC) == stop, hex(reg(UC_ARM_REG_PC))
        return reg(UC_ARM_REG_R0)
    put(AI + 0x30, W); put(AI + 0x34, RECORD); put(AI + 0x40, ACTOR)
    put(W + 0x34, ACTOR); put(W + 0x110, RECORD)
    rates, effectiveness, shot_reactions, rope_transitions = [], [], [], []
    for species in range(228):
        sp = 0x020C1374 + species * 0x84
        put(AI + 0x38, sp)
        for override in [0, 1, 2]:
            put(AI + 0x1a4, int(override == 1)); put(W + 0x40c, int(override == 2))
            values = [run(0x0210F0A4, {UC_ARM_REG_R0:AI, UC_ARM_REG_R1:i}) for i in range(13)]
            effectiveness.append({'speciesIndex':species, 'override':override, 'values':values})
        for rope in range(12):
            put(TOOL + 0x48, rope); put(TOOL + 0x44, sp)
            put(TOOL + 0x3c, 0); put(RECORD + 0x58, 210)
            response = u.mem_read(sp + 0x70, 1)[0]
            generation = get(sp + 12)
            run(0x02115838, {UC_ARM_REG_R1:generation, UC_ARM_REG_R0:max(0, response - 1),
                UC_ARM_REG_R5:TOOL, UC_ARM_REG_R4:W}, 0x02115980)
            rates.append([species, rope, get(TOOL + 0x3c)])
    for species in [0, 8, 10, 30, 50, 90, 120, 160, 200, 227]:
        put(AI + 0x38, 0x020C1374 + species * 0x84)
        for status in range(3):
            for strength in [1, 2]:
                for response in range(1, 4):
                    for sample in [0, 1, 102]:
                        for offset, value in [(0x1a4,0), (0x1b4,850), (0x54,0)]: put(AI + offset, value)
                        put(W + 0x40c, 0); put(W + 0x51c, 359)
                        put(RECORD + 12, 7)
                        put(ACTOR + 0x24, 300 * 4096); put(ACTOR + 0x28, 200 * 4096)
                        rng_calls.clear()
                        run(0x0210E748, {UC_ARM_REG_R0:AI, UC_ARM_REG_R1:strength,
                            UC_ARM_REG_R2:status, UC_ARM_REG_R3:response})
                        shot_reactions.append({'speciesIndex':species,'strength':strength,'statusSelector':status,
                            'response':response,'sample':sample,'rngCalls':list(rng_calls),
                            'shotShakeTicks':get(AI+0x1b4),'returnAiState':get(AI+0x54),
                            'awakeCounter':get(RECORD+12), 'destinationQ12':[get(AI+0x48),get(AI+0x4c),get(AI+0x50)]})
    # Full state entry caps and numerical transitions, with blocked strong-pull
    # input so no unmodelled moving target/vector normalizer is substituted.
    put(0x0212AC80,0); put(0x0212ACB8,0); put(0x0212AC48,0)
    put(TOOL+0x44,0x020C1374 + 8*0x84); put(TOOL+0x38,360)
    put(TOOL+0x34,360); put(TOOL+0x30,360); put(TOOL+0x3c,3584); put(TOOL+0x40,0)
    put(W+0x4e8,1000); put(W+0x4ec,1000); put(W+0x4fc,1)
    state = 3
    for distance in [39]*3 + [40]*15 + [79,80,160,39,80,40,39,161]:
        events.clear()
        u.mem_write(0x0210A730, struct.pack('<HHH',distance,0,1))
        before = state
        next_state = run(0x02114F54,{UC_ARM_REG_R0:TOOL,UC_ARM_REG_R1:state})
        if next_state != 0xffffffff:
            state = next_state
            # Execute the exact functional part of each state entry, excluding
            # sprite configuration. Function 4 entry has one sound sink.
            if state == 3: run(0x02115D68,{UC_ARM_REG_R4:TOOL, UC_ARM_REG_R0:0},0x02115D74)
            elif state == 4: run(0x02115EE8,{UC_ARM_REG_R0:TOOL})
            elif state == 5: run(0x02116050,{UC_ARM_REG_R0:TOOL})
        rope_transitions.append({'distance':distance,'before':before,'state':state,'hp':get(W+0x4e8),
            'durability':get(TOOL+0x30),'cap':get(TOOL+0x34),'accumulatorQ12':get(TOOL+0x40),'events':list(events)})
    status_cases, bounce_cases = [], []
    ai_status = {'poisonPending':0x1bc,'stunPending':0x1c0,'poisonElapsed':0x1c4,
        'poisonDuration':0x1c8,'blindTicks':0x1cc,'recoveryTicks':0x1d4}
    wild_status = {'currentHp':0x4e8,'maxHp':0x4ec,'maxAwakeCounter':0x51c,'poisoned':0x334,'blinded':0x40c}
    individual_status = {'satiety':8,'awakeCounter':12}
    base_status = {'currentHp':100,'maxHp':210,'maxAwakeCounter':359,'awakeCounter':400,'satiety':6,
        'poisonPending':0,'stunPending':0,'poisonElapsed':0,'poisonDuration':600,
        'poisoned':0,'blinded':0,'blindTicks':0,'recoveryTicks':0}
    variants = [({},0),({'awakeCounter':-3},0),({'currentHp':209,'recoveryTicks':360},0),
        ({'currentHp':0,'recoveryTicks':360,'satiety':0},0),({'recoveryTicks':359},0),
        ({'poisonPending':1},0),({'poisonPending':1},49),({'poisonPending':2},0),
        ({'stunPending':1},0),({'stunPending':2},0),({'blinded':1,'blindTicks':1},0),
        ({'blinded':1,'blindTicks':2},0),({'poisoned':1,'poisonElapsed':179},0),
        ({'poisoned':1,'poisonElapsed':180},0),({'poisoned':1,'poisonElapsed':600,'recoveryTicks':360},0),
        ({'poisoned':1,'poisonElapsed':599,'recoveryTicks':360},0)]
    for changes,sample in variants:
        before = {**base_status,**changes}
        for mapping,address in [(ai_status,AI),(wild_status,W),(individual_status,RECORD)]:
            for name,offset in mapping.items(): put(address+offset,before[name])
        put(RECORD+0x58,before['maxHp'])
        events.clear();rng_calls.clear()
        run(0x0210D3DC,{UC_ARM_REG_R0:AI})
        after = {name:get(address+offset) for mapping,address in [(ai_status,AI),(wild_status,W),(individual_status,RECORD)] for name,offset in mapping.items()}
        status_cases.append({'before':before,'sample':sample,'after':after,'events':list(events),'rngCalls':list(rng_calls)})
    put(W+0x130,4);put(W+0x134,4);put(W+0x12c,1);put(ACTOR+0x2c,0)
    for tick in range(7):
        before={'amplitude':get(W+0x130),'velocity':get(W+0x134),'zQ12':get(ACTOR+0x2c)}
        assert before['amplitude']>0
        run(0x0210BFC4,{UC_ARM_REG_R5:W,UC_ARM_REG_R4:ACTOR},0x0210C010)
        bounce_cases.append({'before':before,'after':{'amplitude':get(W+0x130),'velocity':get(W+0x134),'zQ12':get(ACTOR+0x2c)}})
    output = {'romSha256':ROM_SHA, 'kind':'CONTROLLED_CPU_NOT_LIVE_GAMEPLAY',
        'adapters':['Nitro signed divider MMIO', 'controlled RNG', 'object lookup', 'zero target anchor', 'audio/art/event sinks'],
        'ropeRates':rates,'effectiveness':effectiveness,'shotReactions':shot_reactions,'ropeTransitions':rope_transitions,
        'wildStatus':status_cases,'bindingBounce':bounce_cases}
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({k:len(v) for k,v in output.items() if isinstance(v,list)}))


if __name__ == '__main__': main()
