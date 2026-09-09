"""Original Hunt touch replay. Requires py-desmume; never writes emulated RAM.

Supply an isolated directory for the ROM copy, screenshots and emulator states.
Only semantic observations are exported to the repository. The script observes
one actual target to aim a stylus; it does not inject spawn/HP/RNG/animation data.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from desmume.emulator import DeSmuME
from hunt_movement_observer import HuntMovementObserver
from hunt_animation_observer import HuntAnimationObserver

ROM_SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'

def main():
    parser = argparse.ArgumentParser()
    for key in ['rom', 'state', 'private-dir', 'out']:
        parser.add_argument('--' + key, required=True)
    parser.add_argument('--movement-out', help='Optional selected-actor movement semantic receipt')
    parser.add_argument('--animation-out', help='Optional selected-actor NANR semantic receipt')
    args = parser.parse_args()
    raw = Path(args.rom).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == ROM_SHA
    private = Path(args.private_dir).resolve()
    private.mkdir(parents=True, exist_ok=True)
    isolated_rom = private / 'original.nds'
    if not isolated_rom.exists():
        shutil.copyfile(args.rom, isolated_rom)
    assert hashlib.sha256(isolated_rom.read_bytes()).hexdigest() == ROM_SHA
    emu = DeSmuME()
    emu.volume_set(0)
    emu.open(str(isolated_rom), auto_resume=False)
    emu.savestate.load_file(str(Path(args.state).resolve()))
    emu.resume()
    word = lambda address: emu.memory.unsigned[address:address + 4:4][0]
    half = lambda address: emu.memory.unsigned[address:address + 2:2][0]
    byte = lambda address: emu.memory.unsigned[address]
    player = word(0x020FBA08)
    assert word(player + 0x10) == 0 and word(0x0212AC4C) == 15
    assert word(player + 0x24) == 0
    manager = word(0x0210AA1C)
    obj = word(manager + 12 + 7 * 4)
    wild = word(obj + 0x704)
    actor = word(wild + 0x34)
    record = word(wild + 0x110)
    assert word(record) == 10 and word(wild + 0x4E8) == 210
    tick, phase, rope_address = 0, 'entry', None
    hand_controller = None
    selected_ai8 = False
    wild_random_max = None
    sampler_address = None
    events, frames, actions, pictures = [], [], [], []
    movement = HuntMovementObserver(emu, wild, lambda: tick) if args.movement_out else None
    animation = HuntAnimationObserver(emu, wild, lambda: tick) if args.animation_out else None

    def target():
        return {'hp': word(wild + 0x4E8), 'maxHp': word(wild + 0x4EC),
                'sourceHp': word(record + 0x50), 'sourceMaxHp': word(record + 0x58),
                'ai': byte(wild + 0x744), 'bound': word(wild + 0x118),
                'ready': word(wild + 0x4F8), 'downPhase': word(wild + 0x50C),
                'downClock': [word(wild + offset) for offset in [0x11C, 0x120, 0x124, 0x128]],
                'aiFields': {hex(offset): word(wild + 0x73C + offset) for offset in
                             [0x54, 0x58, 0x6C, 0x70, 0x78, 0x7C, 0x84, 0x98, 0x1B0]},
                'movementRestricted': word(wild + 0x4FC),
                'worldQ12': [word(actor + 0x24), word(actor + 0x28)],
                'camera': [word(0x0212ACB8), word(0x0212AC48)],
                'cardCount': word(player + 0x24)}

    def hook(address, size):
        nonlocal rope_address, hand_controller, selected_ai8, wild_random_max, sampler_address
        if animation:
            animation.observe(address)
            if address not in base_hooks and not (movement and address in movement.POINTS):
                return True
        if movement:
            movement.observe(address)
            if address not in base_hooks:
                return True
        regs = emu.memory.register_arm9
        if address == 0x02110CAC:
            selected_ai8 = regs.r0 == wild + 0x73C
        if address in [0x02110D0C, 0x02110DC8, 0x02110E10, 0x02110FFC] and not selected_ai8:
            return True
        if address == 0x0210B5E4:
            wild_random_max = regs.r1 if regs.r0 == wild else None
            if wild_random_max is None:
                return True
        if address in [0x0210B628, 0x0210B650] and wild_random_max is None:
            return True
        if address in [0x02111890, 0x021118B4] and regs.r4 != wild + 0x73C:
            return True
        if address == 0x02113F8C:
            sampler_address = regs.r0
        if address == 0x02114040 and word(sampler_address + 0x1120) > 60:
            return True
        if address in [0x02110CAC, 0x02111300, 0x02111420, 0x02111644, 0x02111744,
                       0x02111800, 0x021118C4, 0x02111E8C] and regs.r0 != wild + 0x73C:
            return True
        if address in [0x0210C01C, 0x0210C034] and regs.r0 != wild:
            return True
        if address in [0x0210BF2C, 0x0210BFB8] and regs.r5 != wild:
            return True
        if address == 0x0211793C:
            hand_controller = regs.r0
        if address == 0x0210C3C8 and regs.r0 != wild:
            return True
        if address == 0x0204409C and (regs.r0 not in [wild, wild + 0x73C] or regs.r1 not in [0x11, 0x13, 0x16, 0x20, 0x23]):
            return True
        event = {'tick': tick, 'phase': phase, 'pc': hex(address),
                 'r0': regs.r0, 'r1': regs.r1, 'r2': regs.r2,
                 'target': target()}
        if address == 0x0210C01C:
            event['clockStart'] = [regs.r1, regs.r2, regs.r3, 0]
        if address == 0x021171F0:
            event['handController'] = {'phase': byte(regs.r0 + 0xE), 'counter': half(regs.r0 + 0x10)}
        if address in [0x0210B628, 0x0210B650]:
            event['wildRandom'] = {'max': wild_random_max, 'value': regs.r0}
            wild_random_max = None
        if address == 0x02111890:
            event['collisionBlocked'] = bool(regs.r0)
        if address in [0x02113F8C, 0x02114040, 0x021141D8, 0x02114298, 0x02114388, 0x021145C8, 0x02114340]:
            sampler = sampler_address if address != 0x02114388 else regs.r0
            event['sampler'] = {
                'last': [word(sampler + offset) for offset in [0x1110, 0x1114]],
                'next': word(sampler + 0x1118), 'count': word(sampler + 0x111C), 'counter': word(sampler + 0x1120),
                'slots': [{'variant': word(sampler + i * 0xD8 + 0x104),
                           'positionQ12': [word(sampler + i * 0xD8 + offset) for offset in [0x54, 0x58]],
                           'animationActive': word(sampler + i * 0xD8 + 0xAC)} for i in range(20)]}
            if address == 0x02113F8C:
                event['sampleInput'] = [regs.r1, regs.r2]
            if address == 0x021145C8:
                event['shapeCenterQ12'] = [word(sampler + offset) for offset in [0x1188, 0x118C]]
        if address == 0x02114F54:
            rope_address = regs.r0
            event['rope'] = {name: word(rope_address + offset) for name, offset in
                             [('durability', 0x30), ('maxDurability', 0x34), ('damageQ12', 0x3C),
                              ('accumulatorQ12', 0x40), ('ropeIndex', 0x48), ('targetIndex', 0x4C)]}
            species = word(rope_address + 0x44)
            event['rope']['temperament71'] = byte(species + 0x71)
        if address == 0x0211502C:
            event['input'] = {'dxQ12': regs.r1, 'dyQ12': regs.r4, 'movementBlocked': bool(word(wild + 0x4FC))}
        if address == 0x02115274:
            event['afterRope'] = {'durability': word(rope_address + 0x30), 'accumulatorQ12': word(rope_address + 0x40), 'hp': word(wild + 0x4E8)}
        events.append(event)
        return True

    base_hooks = {0x02114F54, 0x0211502C, 0x02115274, 0x0211585C, 0x0210C3C8, 0x0210CBCC, 0x02113B74,
                    0x021178A0, 0x0204409C, 0x02117458, 0x02114728, 0x021149DC,
                    0x02110CAC, 0x02111300, 0x02111420, 0x02111644, 0x02111744, 0x02111800,
                    0x021118C4, 0x02111E8C, 0x0210C01C, 0x0210C034, 0x0210BF2C, 0x0210BFB8,
                    0x0211793C, 0x021171F0, 0x02111890, 0x021118B4,
                    0x02110D0C, 0x02110DC8, 0x02110E10, 0x02110FFC,
                    0x0210B5E4, 0x0210B628, 0x0210B650,
                    0x02113F8C, 0x02114040, 0x021141D8, 0x02114298, 0x02114388, 0x021145C8, 0x02114340}
    for address in base_hooks | (movement.POINTS if movement else set()) | (animation.POINTS if animation else set()):
        emu.memory.register_exec(address, hook, 4)
    if movement:
        movement.install_return = lambda address: emu.memory.register_exec(address, hook, 4)

    def act(kind, count, x=None, y=None):
        nonlocal tick
        action = {'phase': phase, 'kind': kind, 'count': count, 'startTick': tick + 1}
        if kind == 'touch':
            action.update(x=x, y=y)
            assert 0 <= x <= 255 and 0 <= y <= 191
            emu.input.touch_set_pos(x, y)
        elif kind == 'release':
            emu.input.touch_release()
        actions.append(action)
        for _ in range(count):
            tick += 1
            emu.cycle(False)
            frame = {'tick': tick, 'phase': phase, **target(),
                     'touch': [half(a) for a in [0x0210A730, 0x0210A732, 0x0210A734]]}
            if rope_address:
                frame['rope'] = [word(rope_address + offset) for offset in [0x30, 0x34, 0x3C, 0x40]]
            if hand_controller:
                frame['handController'] = {'phase': byte(hand_controller + 0xE), 'counter': half(hand_controller + 0x10)}
            frames.append(frame)
            if animation:
                animation.end_frame(frame)

    def screenshot(label):
        path = private / (label + '.png')
        emu.screenshot().save(path)
        emu.savestate.save_file(str(private / (label + '.dst')))
        pictures.append({'label': label, 'tick': tick, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

    def screen_position():
        state = target()
        return [round(q / 4096 - c) for q, c in zip(state['worldQ12'], state['camera'])]

    initial = target()
    act('release', 2)
    phase = 'hand_camera'
    act('touch', 6, 36, 182); act('release', 6)
    for _ in range(8):
        x, y = screen_position()
        dx, dy = max(-70, min(70, 120 - x)), max(-60, min(60, 85 - y))
        if abs(dx) + abs(dy) < 5:
            break
        act('touch', 3, 120, 85); act('touch', 3, 120 + dx, 85 + dy); act('release', 3)
    phase = 'rope_circle'
    act('touch', 6, 64, 182); act('release', 6)
    x, y = screen_position()
    assert 52 <= x <= 204 and 52 <= y <= 136, (x, y)
    for dx, dy in [(-32, 0), (-24, -24), (0, -32), (24, -24), (32, 0), (24, 24), (0, 32), (-24, 24), (-32, 0)]:
        act('touch', 2, x + dx, y + dy)
    screenshot('circle_before_release')
    act('release', 50)
    screenshot('bound_after_release')
    assert target()['bound'] == 1, target()
    phase = 'rope_pull'
    x, y = screen_position()
    act('touch', 4, x, y - 5)
    act('touch', 1, min(x + 56, 238), y - 5)
    for _ in range(300):
        if target()['ready']:
            break
        act('wait', 1)
    screenshot('down_hand_ready')
    assert target()['hp'] == 0 and target()['ready'] == 1, target()
    phase = 'hand_collection'
    act('release', 3); act('touch', 6, 36, 182); act('release', 6)
    x, y = screen_position()
    act('touch', 4, x, y - 5); act('release', 100)
    screenshot('on_card')
    assert word(player + 0x24) == 1, target()
    card = word(player + 0x20)
    output = {'status': 'NATIVE_TOUCH_CAPTURE_PASS_NOT_WEB_PARITY', 'romSha256': ROM_SHA,
              'stateSha256': hashlib.sha256(Path(args.state).read_bytes()).hexdigest(),
              'gateIndex': 0, 'wildIndex': 7, 'speciesIndex': 10, 'initial': initial,
              'final': target(), 'card': {'speciesIndex': word(card), 'currentHp': word(card + 0x50), 'maxHp': word(card + 0x58)},
              'inputAuthority': 'DeSmuME stylus API only; no emulated memory writes or forced animation completion',
              'aiming': 'Script reads actual target position to aim and pan; all actions and calibrated native touch coordinates retained',
              'limits': ['One gate, one native encounter, one input sequence; not all AI states', 'No original battery-save claim', 'No browser capture parity claim'],
              'actions': actions, 'pictures': pictures, 'events': events, 'frames': frames}
    Path(args.out).write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
    if movement:
        assert movement.active is None, 'Unreturned native movement call'
        movement_output = {'romSha256': ROM_SHA, 'stateSha256': output['stateSha256'],
                           'inputAuthority': output['inputAuthority'], 'wildIndex': 7,
                           'status': 'OBSERVED_MOVEMENT_NOT_NORMAL_BROWSER_ACCEPTANCE',
                           'calls': movement.calls, 'captureFinal': output['final'], 'card': output['card']}
        with Path(args.movement_out).open('w', encoding='utf-8', newline='\n') as stream:
            stream.write(json.dumps(movement_output, indent=2) + '\n')
    if animation:
        animation_output = {'romSha256': ROM_SHA, 'stateSha256': output['stateSha256'],
                            'inputAuthority': output['inputAuthority'], 'overlay': 0,
                            'wildIndex': 7, 'speciesIndex': 10, 'entityId': 'm003_nyokimon',
                            'status': 'ORIGINAL_TOUCH_ANIMATION_OBSERVATION_NOT_NORMAL_WEB_ACCEPTANCE',
                            'calls': animation.calls, 'frames': animation.frames,
                            'captureFinal': output['final'], 'card': output['card']}
        with Path(args.animation_out).open('w', encoding='utf-8', newline='\n') as stream:
            stream.write(json.dumps(animation_output, indent=2) + '\n')
    print(json.dumps({key: output[key] for key in ['status', 'initial', 'final', 'card']}))

if __name__ == '__main__':
    main()
