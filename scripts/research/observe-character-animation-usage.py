"""Read original animation banks and observe actual emulator requests.

Research only: output must be a private directory outside the product tree.
No emulated RAM, RNG, speed, or gameplay state is modified.
"""
import argparse
import hashlib
import json
import os
import struct
from collections import Counter
from pathlib import Path
from ndspy.rom import NintendoDSRom
from desmume.emulator import DeSmuME

SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', required=True)
    ap.add_argument('--state', required=True)
    ap.add_argument('--private-dir', required=True)
    ap.add_argument('--frames', type=int, default=1200)
    ap.add_argument('--capture-interval', type=int, default=120)
    a = ap.parse_args()
    assert 1 <= a.frames <= 10000 and 1 <= a.capture_interval <= a.frames
    rom_path, state = Path(a.rom).resolve(), Path(a.state).resolve()
    out = Path(a.private_dir).resolve()
    assert not out.is_relative_to(Path(__file__).resolve().parents[2])
    out.mkdir(parents=True, exist_ok=True)
    raw = rom_path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA
    rom = NintendoDSRom(raw)
    banks = []

    def walk(folder, prefix=''):
        for i, name in enumerate(folder.files):
            path = prefix + name
            if not name.lower().endswith('.nanr'):
                continue
            data = rom.files[folder.firstID + i]
            if data[:4] != b'RNAN' or data[16:20] != b'KNBA':
                continue
            count, total, seq, frames, results = struct.unpack_from('<HHIII', data, 24)
            sequences = []
            for n in range(count):
                length, loop, typ, mode, off = struct.unpack_from('<HHIII', data, 24 + seq + n * 16)
                timeline = []
                for f in range(length):
                    result, ticks, marker = struct.unpack_from('<IHH', data, 24 + frames + off + f * 8)
                    assert marker == 0xBEEF
                    cell = struct.unpack_from('<H', data, 24 + results + result)[0]
                    timeline.append([cell, ticks])
                sequences.append(dict(id=n, type=typ, mode=mode, loopStart=loop, frames=timeline))
            assert sum(len(s['frames']) for s in sequences) == total
            banks.append(dict(path=path, sha256=hashlib.sha256(data).hexdigest(), sequences=sequences))
        for name, child in folder.folders:
            walk(child, prefix + name + '/')

    walk(rom.filenames)
    (out / 'banks.json').write_text(json.dumps(banks) + '\n', encoding='utf-8', newline='\n')
    # DeSmuME creates battery data beside the ROM, so use a private copy.
    private_rom = out / 'original.nds'
    if not private_rom.exists():
        private_rom.write_bytes(raw)
    assert hashlib.sha256(private_rom.read_bytes()).hexdigest() == SHA
    os.chdir(out)
    emu = DeSmuME()
    emu.volume_set(0)
    emu.open(str(private_rom), auto_resume=False)
    emu.savestate.load_file(str(state))
    emu.resume()
    word = lambda at: emu.memory.unsigned[at:at + 4:4][0]
    half = lambda at: emu.memory.unsigned[at:at + 2:2][0]
    byte = lambda at: emu.memory.unsigned[at]
    valid = lambda p: 0x02000000 <= p < 0x023ffff0
    tick, calls, actors, samples = 0, [], set(), []
    residents, state_requests = {}, []

    def raising_hook(address, width):
        r = emu.memory.register_arm9
        body, profile = word(r.r0 + 0x3c), word(r.r0 + 0x114)
        if valid(body) and valid(profile):
            residents[body] = r.r0
            actors.add(body)
            state_requests.append(dict(tick=tick, resident=f'{r.r0:08x}', actor=f'{body:08x}',
                species=word(profile), state=byte(r.r0+8), requested=r.r1,
                slow=word(r.r0+0x17c), caller=f'{r.lr:08x}'))
        return True

    def hook(address, width):
        r = emu.memory.register_arm9
        if valid(r.r0):
            actors.add(r.r0)
            calls.append(dict(tick=tick, address=f'{address:08x}', actor=f'{r.r0:08x}',
                              requested=r.r1, caller=f'{r.lr:08x}'))
        return True

    # Both conditional and forced requests; state-loaded actors are discovered
    # even when a repeated conditional request does not restart the animation.
    emu.memory.register_exec(0x02047984, hook, 4)
    emu.memory.register_exec(0x02047904, hook, 4)
    emu.memory.register_exec(0x02112378, raising_hook, 4)
    emu.screenshot().save(out / 'frame-0000.png')
    for tick in range(1, a.frames + 1):
        emu.cycle(False)
        for actor in sorted(actors):
            sequence, frame = word(actor + 0x8c), word(actor + 0x70)
            if not valid(sequence) or not valid(frame):
                continue
            first, content = word(sequence + 12), word(frame)
            if not valid(first) or not valid(content):
                continue
            sample = dict(tick=tick, actor=f'{actor:08x}', sequence=byte(actor + 0x58),
                frame=(frame-first)//8, cell=half(content), ticks=half(frame+4),
                frameCount=half(sequence), mode=word(sequence+8), loopStart=half(sequence+2),
                elapsedQ12=word(actor+0x80), speedQ12=word(actor+0x84), active=word(actor+0x7c),
                flip=byte(actor+0x14))
            if actor in residents:
                resident = residents[actor]
                sample.update(state=byte(resident+8), species=word(word(resident+0x114)),
                    positionQ12=[int.from_bytes(bytes(emu.memory.unsigned[actor+0x24+i*4:actor+0x28+i*4:1]), 'little', signed=True) for i in range(3)])
            samples.append(sample)
        if tick % a.capture_interval == 0:
            emu.screenshot().save(out / f'frame-{tick:04}.png')
    emu.close()
    receipt = dict(classification='BOUNDED_NATIVE_REPLAY', romSha256=SHA,
        stateSha256=hashlib.sha256(state.read_bytes()).hexdigest(), state=str(state),
        inputs=[dict(frames=a.frames, mutation=False)], calls=calls, stateRequests=state_requests, samples=samples,
        boundaries=['One existing Raising checkpoint; no fresh boot or all-species claim.',
                    'Actor addresses are not species IDs; sequence numbers have bank-local meaning.'])
    (out / 'usage.json').write_text(json.dumps(receipt) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(dict(banks=len(banks), frames=a.frames, calls=len(calls), samples=len(samples),
                         actors=len(actors), requests=dict(Counter(c['requested'] for c in calls)))))


if __name__ == '__main__':
    main()
