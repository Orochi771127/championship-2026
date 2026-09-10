"""Execute the original reaction dispatcher/handler from verified OVL18 bytes.

Synthetic resident memory; requests, audio and division are intercepted. This
oracle proves bounded control flow, not normal gameplay reachability or pixels.
No runtime catalog is used to construct the original reaction parameters.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    a = ap.parse_args()
    raw = a.rom.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom = NintendoDSRom(raw)
    ov = rom.loadArm9Overlays()[18]
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x2000000, 0x800000)
    u.mem_write(rom.arm9RamAddress, bytes(decompress(rom.arm9)))
    u.mem_write(ov.ramAddress, bytes(ov.data))
    actor, body, profile, stop = 0x2300000, 0x2301000, 0x2302000, 0x27f0000
    events = []
    signed = lambda n: n if n < 0x80000000 else n - 0x100000000
    get = lambda p: int.from_bytes(u.mem_read(p, 4), 'little')
    def put(p, n): u.mem_write(p, struct.pack('<I', n & 0xffffffff))
    def ret(n=0):
        u.reg_write(UC_ARM_REG_R0, n & 0xffffffff)
        u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))
    def hook(_, at, size, user):
        if at == 0x2047984:
            events.append(['sequence', u.reg_read(UC_ARM_REG_R1)])
            ret()
        elif at == 0x2115410:
            events.append(['feedback', signed(get(actor + 0x198))])
            ret()
        elif at == 0x2044100: ret(0)  # No external queued command in these cases.
        elif at == 0x2065858: ret(1)  # Existing auxiliary sound is active.
        elif at == 0x2065840:
            events.append(['auxiliary', u.reg_read(UC_ARM_REG_R1)])
            ret()
        elif at == 0x202b558:
            n, d = signed(u.reg_read(UC_ARM_REG_R0)), signed(u.reg_read(UC_ARM_REG_R1))
            assert d
            q = abs(n) // abs(d) * (-1 if (n < 0) != (d < 0) else 1)
            u.reg_write(UC_ARM_REG_R1, (n - q * d) & 0xffffffff)
            ret(q)
    u.hook_add(UC_HOOK_CODE, hook)
    def run(at, r0=actor, r1=0):
        u.reg_write(UC_ARM_REG_R0, r0)
        u.reg_write(UC_ARM_REG_R1, r1)
        u.reg_write(UC_ARM_REG_SP, 0x27e0000)
        u.reg_write(UC_ARM_REG_LR, stop)
        u.emu_start(at, stop, count=10000)
        assert u.reg_read(UC_ARM_REG_PC) == stop
        return signed(u.reg_read(UC_ARM_REG_R0))
    def reset(species=34, slow=0, flip=0):
        u.mem_write(actor, bytes(0x3000))
        put(actor + 0x3c, body)
        put(actor + 0x114, profile)
        put(actor + 0x17c, slow)
        put(profile, species)
        put(profile + 0x1c, 50)
        put(body + 0x6dc, flip)
        for off in [0x190, 0x194, 0x198, 0x19c, 0x1a8, 0x1c0, 0x1c8]: put(actor + off, -1)
        events.clear()
    fields = {'sequence':0x190,'icon':0x198,'alternateIcon':0x19c,'ticks':0x1a0,
              'completion':0x1c4,'alternate':0x194,'alternateTicks':0x1bc,
              'alternateCount':0x1b8,'secondTicks':0x1c8,'flipTicks':0x1a4,
              'auxiliaryRepeat':0x1b4}
    reactions = []
    for reaction in range(31):
        # Only state 9 reaches this handler; other states keep their own oracles.
        reset()
        if reaction in [1, 23, 24]:
            # Their movement helper needs terrain; skip execution, not fabricate it.
            reactions.append(dict(id=reaction, handler='MOVEMENT_SEPARATE_ORACLE'))
            continue
        state = run(0x21156b4, r1=reaction)
        settings = {k:signed(get(actor + off)) for k,off in fields.items()}
        row = dict(id=reaction, state=state, settings=settings, conditionDelta=get(profile+0x1c)-50, variants=[])
        if state == 9:
            for slow in [0,1]:
                for flip in [0,1]:
                    reset(slow=slow, flip=flip)
                    run(0x21156b4, r1=reaction)
                    run(0x2119880)
                    entry = list(events)
                    samples = []
                    for tick in range(1, 401):
                        events.clear()
                        # Isolate handler completion from animation playback. The
                        # real species animation is separately exercised in JS.
                        put(body + 0x7c, 0 if tick >= 73 else 1)
                        result = run(0x2119654)
                        samples.append([tick, get(body+0x6dc), result, list(events)])
                        if result != -1: break
                    assert samples[-1][2] == 1
                    row['variants'].append(dict(slow=slow,flip=flip,entry=entry,samples=samples))
        reactions.append(row)
    requests = []
    for species in range(228):
        for slow in [0,1]:
            reset(species, slow)
            outputs = []
            for sequence in range(40):
                events.clear()
                run(0x2112378, r1=sequence)
                outputs.append(events[0][1] if events else None)
            requests.append(dict(species=species,slow=slow,outputs=outputs))
    report = dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=sha,
        overlay18Sha256=hashlib.sha256(bytes(ov.data)).hexdigest(),
        boundaries=['Synthetic resident; no normal-path reachability or hardware rendering claim',
                    'No pending commands; active auxiliary sound; signed division intercepted',
                    'Animation active flag stays 1 until update 73; playback tested separately',
                    'Movement reactions 1/23/24 and jump 5 use existing movement CPU receipts'],
        reactions=reactions,requests=requests,
        summary=dict(reactionIds=31, handlerVariants=sum(len(r.get('variants',[])) for r in reactions),
                     handlerUpdates=sum(len(v['samples']) for r in reactions for v in r.get('variants',[])),
                     wrapperRequests=len(requests)*40))
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(report,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(report['summary']))


if __name__ == '__main__': main()
