"""Read-only OVL0 -> ARM9 -> NANR observation for one live wild actor.

No animation names are inferred. Hook addresses are overlay-qualified by the
Hunt caller, and frames are recorded after the original emulation cycle.
"""


class HuntAnimationObserver:
    POINTS = {0x0210C048, 0x02047984, 0x02047904, 0x02047A08}

    def __init__(self, emu, wild, tick):
        self.emu, self.wild, self.tick = emu, wild, tick
        self.actor = self.word(wild + 0x34)
        self.calls, self.frames = [], []

    def word(self, address):
        return self.emu.memory.unsigned[address:address + 4:4][0]

    def half(self, address):
        return self.emu.memory.unsigned[address:address + 2:2][0]

    def byte(self, address):
        return self.emu.memory.unsigned[address]

    def snapshot(self):
        actor = self.actor
        sequence = self.word(actor + 0x8C)
        frame = self.word(actor + 0x70)
        frames = self.word(sequence + 0xC)
        content = self.word(frame)
        return {
            'sequenceId': self.byte(actor + 0x58),
            'frameIndex': (frame - frames) // 8,
            'frameCount': self.half(sequence), 'loopStartFrame': self.half(sequence + 2),
            'animationType': self.word(sequence + 4), 'playMode': self.word(sequence + 8),
            'cell': self.half(content), 'durationTicks': self.half(frame + 4),
            'elapsedQ12': self.word(actor + 0x80), 'speedQ12': self.word(actor + 0x84),
            'reverse': self.word(actor + 0x78), 'active': self.word(actor + 0x7C),
            'flipBits': self.byte(actor + 0x14),
        }

    def observe(self, address):
        r = self.emu.memory.register_arm9
        if address == 0x0210C048:
            if r.r0 != self.wild:
                return
            self.calls.append({'tick': self.tick(), 'pc': hex(address),
                               'request': r.r1, 'bound': self.word(self.wild + 0x118),
                               'overrideFlags': [self.word(self.wild + offset) for offset in [0x10C, 0x334, 0x40C]]})
        elif address in self.POINTS and r.r0 == self.actor:
            self.calls.append({'tick': self.tick(), 'pc': hex(address), 'r1': r.r1,
                               'before': self.snapshot()})

    def end_frame(self, target):
        self.frames.append({'tick': self.tick(), 'ai': target['ai'], 'hp': target['hp'],
                            'bound': target['bound'], 'ready': target['ready'],
                            'cardCount': target['cardCount'],
                            'worldQ12': target['worldQ12'], 'camera': target['camera'],
                            'handController': target.get('handController'),
                            'animation': self.snapshot()})
