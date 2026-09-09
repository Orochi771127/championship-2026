"""Interactive original stylus replay with environment loader observations.

JSON lines on stdin: {"touch":[x,y],"frames":n}, {"release":true,"frames":n},
{"frames":n}, or {"checkpoint":"name"}. All state/ROM/screenshot files stay
in --private-dir. No emulated memory writes or forced state transitions.
"""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from desmume.emulator import DeSmuME

ROM_SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'


def main():
    parser = argparse.ArgumentParser()
    for name in ['rom', 'state', 'private-dir']:
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    private = Path(args.private_dir).resolve()
    private.mkdir(parents=True, exist_ok=True)
    rom = private / 'entry-original.nds'
    assert hashlib.sha256(Path(args.rom).read_bytes()).hexdigest() == ROM_SHA
    if not rom.exists(): shutil.copyfile(args.rom, rom)
    assert hashlib.sha256(rom.read_bytes()).hexdigest() == ROM_SHA
    emu = DeSmuME()
    emu.volume_set(0)
    emu.open(str(rom), auto_resume=False)
    emu.savestate.load_file(str(Path(args.state).resolve()))
    emu.resume()
    word = lambda a: emu.memory.unsigned[a:a + 4:4][0]
    tick, number = 0, 0
    events, actions, grid_writes, rng_calls, follow_writes = [], [], [], [], []
    loaders, watch_grids = {}, {}
    pending = {}
    hook_errors = []

    def rng():
        return {'seeds': [word(0x02104D20 + i * 4) for i in range(217)],
                'cursors': [word(0x02105084 + i * 4) for i in range(217)]}

    initial_rng = rng()
    player = word(0x020FBA08)

    def gate_write(address, size):
        r = emu.memory.register_arm9
        events.append({'kind': 'gate-index-write', 'tick': tick, 'pc': r.pc, 'lr': r.lr,
                       'registers': [r.r0, r.r1, r.r2, r.r3], 'valueAtCallback': word(address)})
        return True

    emu.memory.register_write(player + 0x10, gate_write, 4)

    def wild_snapshot(wild):
        actor, source = word(wild + 0x34), word(wild + 0x110)
        return {'wildAddress': wild, 'actorAddress': actor,
                'speciesIndex': word(source), 'sourceHp': word(source + 0x50),
                'wildHp': word(wild + 0x4E8), 'maxHp': word(wild + 0x4EC),
                'positionQ12': [word(actor + 0x24), word(actor + 0x28)],
                'aiState': emu.memory.unsigned[wild + 0x744],
                'followFlag': word(wild + 0x73C + 0x1A0), 'followTarget': word(wild + 0x73C + 0x1E4)}

    def wilds():
        # Read only once the Hunt environment has actually loaded.
        if not watch_grids: return []
        manager = word(0x0210AA1C)
        rows = []
        count = word(0x0212ABE4 + 0x68)
        if not 0 <= count <= 24: return []
        for i in range(count):
            obj = word(manager + 0xC + i * 4)
            if not 0x02000000 <= obj < 0x02400000: continue
            wild = word(obj + 0x704)
            if not 0x02000000 <= wild < 0x02400000: continue
            rows.append({'wildIndex': i, **wild_snapshot(wild)})
        return rows

    def string(a):
        if not 0x02000000 <= a < 0x02800000: return None
        return bytes(emu.memory.unsigned[a:a + 192]).split(b'\0')[0].decode('ascii', errors='replace')

    def grid(a):
        width, height, data = word(a), word(a + 4), word(a + 8)
        if not (0 < width <= 256 and 0 < height <= 256 and 0x02000000 <= data < 0x02400000): return None
        raw = bytes(emu.memory.unsigned[data:data + width * height])
        return {'object': a, 'width': width, 'height': height, 'data': data,
                'sha256': hashlib.sha256(raw).hexdigest()}

    def hook(address, size):
        try:
            r = emu.memory.register_arm9
            if not watch_grids and address == 0x0210CFD8:
                events.append({'kind':'gate-node-initialization','tick':tick,'gateRecordIndex':r.r3,
                    'positionQ12':[word(r.r2+i*4) for i in range(3)],'caller':r.lr})
            if watch_grids and address == 0x0204331C:
                events.append({'kind':'probability-call','tick':tick,'threshold':r.r0,'channel':r.r1,
                    'caller':r.lr,'rngStart':len(rng_calls)})
                if r.lr == 0x0211AED0:
                    events.append({'kind':'scene-effect-input','tick':tick,
                        'primaryPresent':r.r4!=0,'threshold':r.r5,'secondaryPresent':r.r7!=0,'parameter':r.r6})
            if not watch_grids and address == 0x0210D1A4:
                pending['gate-variant'] = {'kind':'gate-variant', 'tick':tick, 'object':r.r0,
                    'positionQ12':[word(r.r0+0x108+i*4) for i in range(3)], 'caller':r.lr}
                events.append(pending['gate-variant'])
            if not watch_grids and address == 0x0210D1D4 and 'gate-variant' in pending:
                pending['gate-variant']['hour'] = r.r0
            if not watch_grids and address == 0x0210D29C and 'gate-variant' in pending:
                pending.pop('gate-variant')['night'] = r.r0
            if watch_grids and address == 0x0210D240:
                pending['ai-constructor'] = {'kind':'ai-constructor', 'tick':tick,
                    'aiAddress':r.r0, 'rngStart':len(rng_calls)}
                events.append(pending['ai-constructor'])
            if watch_grids and address == 0x0210D3C8:
                entry = pending.pop('ai-constructor')
                entry.update(rngEnd=len(rng_calls), values={hex(off):word(r.r4+off) for off in [0x54,0x1d8,0x1e0,0x1e4]})
            if watch_grids and address in [0x0210D6FC,0x0210D7E4,0x0210D880]:
                events.append({'kind':'ai-individual-bind', 'tick':tick, 'pc':hex(address),
                    'speciesIndex':word(word(r.r4+0x34)), 'trait':word(word(r.r4+0x34)+0x18),
                    'speciesField2c':word(word(r.r4+0x38)+0x2c),'speedQ12':word(r.r4+0x44),'rngEnd':len(rng_calls)})
            if watch_grids and address in [0x0211B118,0x0211B2F0]:
                events.append({'kind':'group-boundary','pc':hex(address),'tick':tick,'rng':rng(),
                    'rngOffset':len(rng_calls),'wildRecords':wilds(),'sceneEffectActive':word(0x0212ABE4+0xd8)})
            if watch_grids and address == 0x0211B280:
                pending['group-query'] = {'kind':'group-terrain-query','tick':tick,'tile':[r.r1,r.r2]}
                events.append(pending['group-query'])
            if watch_grids and address == 0x0211B284:
                pending.pop('group-query')['terrain'] = r.r0
            if address == 0x02043230:
                rng_calls[-1]['actualValue'] = r.r0
                assert r.r0 == rng_calls[-1]['value'], 'RNG result differs from observed state projection'
            if address == 0x020431D4:
                channel = r.r0
                assert channel < 217
                cursor = word(0x02105084 + channel * 4)
                seed = word(0x02104D20 + channel * 4)
                rng_calls.append({'tick': tick, 'channel': channel, 'cursorBefore': cursor,
                                  'seed': seed, 'caller': r.lr,
                                  'value': (seed + word(0x020BD23C + (0 if cursor >= 103 else cursor) * 4)) % 103})
            if watch_grids and address in [0x0211A568, 0x0211AA44]:
                events.append({'kind': 'spawn-boundary', 'pc': hex(address), 'tick': tick, 'rng': rng()})
            if watch_grids and address in [0x0210BC3C, 0x0210BB28]:
                events.append({'kind': 'actor-initialization', 'pc': hex(address), 'tick': tick,
                               'wild': wild_snapshot(r.r4)})
                if address == 0x0210BC3C:
                    wild = r.r4
                    def follow_changed(a, n, owner=wild):
                        follow_writes.append({'tick': tick, 'wildAddress': owner,
                                              'pcAtCallback': emu.memory.register_arm9.pc,
                                              'address': a, 'size': n, 'valueAtCallback': word(a),
                                              'state': wild_snapshot(owner)})
                        return True
                    emu.memory.register_write(wild + 0x73C + 0x1A0, follow_changed, 4)
                    emu.memory.register_write(wild + 0x73C + 0x1E4, follow_changed, 4)
            if watch_grids and address == 0x0211AA60:
                events.append({'kind': 'actors-registered', 'tick': tick, 'wildRecords': wilds(), 'rng': rng()})
            if watch_grids and address == 0x0210B5E4:
                # Range sampler consumes channel0 and then B2 or B3. Capture
                # its calling context; the original CPU performs both rolls.
                pending['range'] = {'kind': 'range-rng', 'tick': tick, 'caller': r.lr, 'range': r.r1,
                                    'rngStart': len(rng_calls)}
                events.append(pending['range'])
            if watch_grids and address in [0x0210B628, 0x0210B650]:
                pending.pop('range').update(value=r.r0, rngEnd=len(rng_calls))
            if watch_grids and address == 0x0210C408:
                pending['repair'] = {'kind': 'spawn-terrain-repair', 'tick': tick,
                                     'xPointer': r.r1, 'yPointer': r.r2,
                                     'before': [word(r.r1), word(r.r2)], 'queries': []}
                events.append(pending['repair'])
            if 'repair' in pending and address == 0x0207C930:
                w, h, data = word(r.r0), word(r.r0 + 4), word(r.r0 + 8)
                x, y = r.r1, r.r2
                pending['repair']['queries'].append({'tile': [x, y],
                    'blocked': not (0 <= x < w and 0 <= y < h) or bool(emu.memory.unsigned[data + y * w + x] & 1)})
            if 'repair' in pending and address == 0x0210C5EC:
                entry = pending.pop('repair')
                entry.update(radius=r.r4, after=[word(entry['xPointer']), word(entry['yPointer'])])
            if address == 0x02062100:
                events.append({'kind': 'individual-constructor', 'tick': tick,
                               'destination': r.r0, 'speciesIndex': r.r2, 'caller': r.lr})
            if address in [0x0207C858, 0x02087E40]:
                loaders[address] = {'tick': tick, 'loader': hex(address), 'object': r.r0,
                                    'directory': string(r.r1), 'filename': string(r.r2), 'return': r.lr}
                events.append({'kind': 'loader-entry', **loaders[address]})
            if address in [0x0207C8E0, 0x02087FFC]:
                entry = loaders.get(0x0207C858 if address == 0x0207C8E0 else 0x02087E40)
                if entry:
                    value = grid(entry['object'])
                    events.append({'kind': 'loader-return', 'tick': tick, 'loader': entry['loader'], 'grid': value})
                    if value and entry['filename'] and ('hm01' in entry['filename']):
                        watch_grids[entry['loader']] = value
                        def changed(a, n, name=entry['loader']):
                            if len(grid_writes) < 1000:
                                grid_writes.append({'tick': tick, 'grid': name, 'address': a, 'size': n,
                                                    'pc': emu.memory.register_arm9.pc})
                            return True
                        emu.memory.register_write(value['data'], changed, value['width'] * value['height'])
            if address == 0x0204D4CC:
                path = string(r.r0)
                if path and ('hm01' in path or path.endswith('.esc') or path.endswith('.atr')):
                    events.append({'kind': 'file-request', 'tick': tick, 'pc': hex(address), 'path': path})
        except Exception as error:
            hook_errors.append(repr(error))
        return True

    for address in [0x0207C858, 0x0207C8E0, 0x02087E40, 0x02087FFC, 0x0204D4CC,
                    0x020431D4, 0x02043230, 0x0211A568, 0x0211AA44, 0x02062100,
                    0x0210BC3C, 0x0210BB28, 0x0211AA60, 0x0210B5E4, 0x0210B628, 0x0210B650,
                    0x0210C408, 0x0210C5EC, 0x0207C930,
                    0x0210D1A4,0x0210D1D4,0x0210D29C,0x0210D240,0x0210D3C8,
                    0x0210D6FC,0x0210D7E4,0x0210D880,0x0211B118,0x0211B2F0,0x0211B280,
                    0x0210CFD8,0x0204331C,0x0211B284]:
        emu.memory.register_exec(address, hook, 4)

    def flush():
        out = {'romSha256': ROM_SHA, 'stateSha256': hashlib.sha256(Path(args.state).read_bytes()).hexdigest(),
               'inputAuthority': 'Original DeSmuME stylus and cycles; no RAM writes', 'ticks': tick,
               'actions': actions, 'events': events, 'gridWrites': grid_writes,
               'followWrites': follow_writes,
               'rngBefore': initial_rng, 'rngAfter': rng(), 'rngCalls': rng_calls, 'wildRecords': wilds(),
               'nativeHuntIndex': word(player + 0x10),
               'currentGrids': {key: grid(value['object']) for key, value in watch_grids.items()},
               'hookErrors': hook_errors}
        with (private / 'entry-environment.json').open('w', encoding='utf-8', newline='\n') as stream:
            stream.write(json.dumps(out, indent=2) + '\n')
        return out

    def show():
        nonlocal number
        number += 1
        path = private / f'entry-{number:03d}.png'
        emu.screenshot().save(path)
        out = flush()
        print(json.dumps({'tick': tick, 'screenshot': str(path), 'events': len(events),
                          'rngCalls': len(rng_calls), 'wildCount': len(out['wildRecords']),
                          'touch': [emu.memory.unsigned[a:a + 2:2][0] for a in [0x0210A730, 0x0210A732, 0x0210A734]],
                          'gridWrites': len(grid_writes), 'grids': out['currentGrids'], 'errors': hook_errors}), flush=True)

    show()
    for line in sys.stdin:
        command = json.loads(line)
        if command.get('quit'):
            emu.input.touch_release()
            flush()
            break
        count = command.get('frames', 0)
        assert isinstance(count, int) and 0 <= count <= 1800
        if 'touch' in command:
            x, y = command['touch']; assert 0 <= x < 256 and 0 <= y < 192
            emu.input.touch_set_pos(x, y)
        if command.get('release'): emu.input.touch_release()
        actions.append({'startTick': tick + 1, **command})
        for _ in range(count): tick += 1; emu.cycle(False)
        if 'checkpoint' in command:
            name = command['checkpoint']; assert name and all(c.isalnum() or c in '-_' for c in name)
            emu.savestate.save_file(str(private / (name + '.dst')))
        show()
        assert not hook_errors, hook_errors


if __name__ == '__main__':
    main()
