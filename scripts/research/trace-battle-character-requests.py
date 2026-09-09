"""Run bounded original OVL19 actor requests. Export numeric evidence only.

Synthetic combatant/actor memory and speed helper stubs are explicit. Execution
stops at the real ARM9 animator boundary; no damage, movement or effects claimed.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_PC, UC_ARM_REG_SP, UC_ARM_REG_LR


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom = NintendoDSRom(raw)
    arm, overlay = bytes(decompress(rom.arm9)), rom.loadArm9Overlays()[19]
    code = bytes(overlay.data)
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x400000)
    u.mem_write(0x02000000, arm)
    u.mem_write(overlay.ramAddress, code)
    C, A, STATS, STOP, STACK = 0x02300000, 0x02301000, 0x02302000, 0x023F0000, 0x023E0000
    put = lambda address, value: u.mem_write(address, struct.pack('<I', value & 0xffffffff))
    word = lambda address: struct.unpack('<I', u.mem_read(address, 4))[0]
    observed = []
    stop_after_entry = False
    def hook(_u, address, size, _data):
        if address in [0x02114320, 0x0211436C]:
            u.reg_write(UC_ARM_REG_R0, 4096)  # speed not under test
            u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))
        elif address == 0x02047984:
            observed.append({'actor': u.reg_read(UC_ARM_REG_R0), 'sequenceId': u.reg_read(UC_ARM_REG_R1)})
            u.emu_stop()
        elif stop_after_entry and address == 0x021133EC:
            u.emu_stop()  # no initial request in this hit-reaction branch
        elif stop_after_entry and address == 0x02112820:
            u.emu_stop()  # notification transition, not a sequence request
    handle = u.hook_add(UC_HOOK_CODE, hook)
    def run(pc, r0, r1=0):
        for reg, value in [(UC_ARM_REG_R0,r0),(UC_ARM_REG_R1,r1),(UC_ARM_REG_PC,pc),(UC_ARM_REG_SP,STACK),(UC_ARM_REG_LR,STOP)]:
            u.reg_write(reg,value)
        u.emu_start(pc, STOP, count=10000)
    requests = []
    codes = [0,1,2,4,5,6,7,8,9,10,11,12,18]
    for notification in codes:
        handler = word(0x0211F8A0 + notification * 8)
        assert word(0x0211F8A4 + notification * 8) == 0
        for counter in [0,1,7]:
            for hp in [0,1,520]:
                u.mem_write(C, bytes(0x300)); put(C+4,A); put(C+0x10,STATS); put(C+0x180,counter);put(STATS+0x50,hp)
                observed.clear();run(handler,C)
                assert u.reg_read(UC_ARM_REG_PC) in [STOP,0x02047984]
                if observed: assert observed[0]['actor'] == A
                requests.append({'notification':notification,'counter':counter,'currentHp':hp,
                    'handler':hex(handler),'sequenceId':observed[0]['sequenceId'] if observed else None})
    # Entry selection for reaction variants. Their later movement, revive RNG
    # and HP writers are outside this receipt; stop at the same raw animator.
    entries = []
    stop_after_entry = True
    global_address = word(0x02113CFC)
    GLOBAL = 0x02310000
    put(global_address, GLOBAL)
    scenarios = [(n,0,0,flag) for n in [3,19,20,21] for flag in [0,1]]
    scenarios += [(15,reaction,status,0) for reaction in range(16) for status in range(14)]
    for notification,reaction,status,ending in scenarios:
        handler=word(0x0211F8A0+notification*8)
        u.mem_write(C,bytes(0x300));put(C+4,A);put(C+0x10,STATS);put(STATS+0x50,100)
        put(C+0x84,reaction);put(C+0x158,status);put(GLOBAL+0x1F12C,ending)
        observed.clear();run(handler,C)
        assert u.reg_read(UC_ARM_REG_PC) in [0x02047984,0x021133EC,0x02112820]
        entries.append({'notification':notification,'counter':0,'currentHp':100,
            'hitReaction':reaction,'statusCode':status,'battleEnding':ending,
            'handler':hex(handler),'sequenceId':observed[0]['sequenceId'] if observed else None})
    u.hook_del(handle)
    u.hook_add(UC_HOOK_CODE, lambda _u,address,size,_data: u.emu_stop() if address == STOP else None)
    equal_requests = []
    for current in [0,7,8,9,10,15,35]:
        for requested in [0,7,8,9,10,15,35]:
            u.mem_write(A+0x58,bytes([current]))
            for reg,value in [(UC_ARM_REG_R0,A),(UC_ARM_REG_R1,requested),(UC_ARM_REG_SP,STACK),(UC_ARM_REG_LR,STOP)]:u.reg_write(reg,value)
            u.emu_start(0x02047984,0x02047904,count=1000)
            assert u.reg_read(UC_ARM_REG_PC) in [STOP,0x02047904]
            equal_requests.append({'current':current,'requested':requested,'restart':u.reg_read(UC_ARM_REG_PC)==0x02047904})
    result={'romSha256':sha,'arm9Sha256':hashlib.sha256(arm).hexdigest(),'overlay19Sha256':hashlib.sha256(code).hexdigest(),
        'status':'BOUNDED_CPU_SELECTOR_REPLAY','boundaries':['synthetic combatant and actor pointers','speed helpers return controlled 4096','stop before animation/effect/movement execution','normal launch timing not proved'],
        'requests':requests,'reactionEntries':entries,'equalRequests':equal_requests}
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'{len(requests)} request cases; {len(equal_requests)} repeated-request cases')


if __name__ == '__main__': main()
