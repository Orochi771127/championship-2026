"""Read-only, selected-actor OVL0 movement observations; no emulated writes."""


class HuntMovementObserver:
    ENTRY = 0x0210D8B4
    POINTS = {
        ENTRY, 0x02088048, 0x0207C9E8, 0x0210D998, 0x0210DEEC, 0x0210DF14,
        0x0210E070, 0x0210E080, 0x0210E0C4, 0x0210E24C,
        0x0210E25C, 0x0210E268, 0x0210E2AC,
    }

    def __init__(self, emu, wild, tick):
        self.emu, self.wild, self.tick = emu, wild, tick
        self.ai = wild + 0x73C
        self.active = None
        self.calls = []
        self.returns = set()
        self.install_return = None

    def word(self, address):
        return self.emu.memory.unsigned[address:address + 4:4][0]

    @staticmethod
    def signed(value):
        return value if value < 0x80000000 else value - 0x100000000

    def vector(self, address):
        return [self.signed(self.word(address + i * 4)) for i in range(3)]

    def snapshot(self):
        actor = self.word(self.ai + 0x40)
        return {
            'aiState': self.emu.memory.unsigned[self.ai + 8],
            'positionQ12': self.vector(actor + 0x24),
            'destinationQ12': self.vector(self.ai + 0x48),
            'directionQ12': self.vector(self.ai + 0x60),
            'speedQ12': self.signed(self.word(self.ai + 0x44)),
            'pull13': self.word(self.ai + 0x58),
            'followFlag': self.word(self.ai + 0x1A0),
            'followTarget': self.word(self.ai + 0x1E4),
            'followTicks': self.word(self.ai + 0x1DC),
            'facing': self.word(actor + 0x6DC),
            'terrainPose': self.word(actor + 0x444),
            'actorActive': self.word(actor + 0x6D0),
            'wildActive': self.word(self.wild + 0x4F0),
            'distanceAccumulatorQ12': self.word(self.ai + 0x5C),
            'camera': [self.signed(self.word(a)) for a in [0x0212ACB8, 0x0212AC48]],
        }

    def observe(self, address):
        r = self.emu.memory.register_arm9
        if self.active and address == self.active['returnAddress']:
            self.active['after'] = self.snapshot()
            self.calls.append(self.active)
            self.active = None
        if address == self.ENTRY and r.r0 == self.ai:
            assert self.active is None, 'Unexpected recursive movement'
            self.active = {'tick': self.tick(), 'mode': r.r1, 'returnAddress': r.lr,
                           'before': self.snapshot(), 'steps': []}
            if r.lr not in self.returns:
                self.returns.add(r.lr)
                self.install_return(r.lr)
            return
        if not self.active or address not in self.POINTS:
            return
        step = {'pc': hex(address), 'r0': r.r0, 'r1': r.r1, 'r2': r.r2}
        if address == 0x02088048:
            width, height = self.word(r.r0), self.word(r.r0 + 4)
            x, y = self.signed(r.r1), self.signed(r.r2)
            data = self.word(r.r0 + 8)
            in_bounds = 0 <= x < width and 0 <= y < height
            step['attribute'] = {'tile': [x, y], 'width': width, 'height': height,
                                 'inBounds': in_bounds,
                                 'value': self.emu.memory.unsigned[data + y * width + x] if in_bounds else 0}
        if address == 0x0207C9E8:
            width, height = self.word(r.r0), self.word(r.r0 + 4)
            x, y = self.signed(r.r1), self.signed(r.r2)
            wrap = self.word(r.r0 + 0x10) == 1
            tx, ty = (x % width, y % height) if wrap else (x, y)
            data = self.word(r.r0 + 8)
            in_bounds = 0 <= tx < width and 0 <= ty < height
            step['terrainGrid'] = {'tile': [x, y], 'width': width, 'height': height,
                                   'wrap': wrap, 'inBounds': in_bounds,
                                   'rawByte': self.emu.memory.unsigned[data + ty * width + tx] if in_bounds else None}
        if address in [0x0210DEEC, 0x0210DF14]:
            step['directionQ12'] = self.vector(self.ai + 0x60)
        if address in [0x0210E070, 0x0210E080, 0x0210E24C, 0x0210E25C, 0x0210E268]:
            step['deltaQ12'] = self.vector(r.sp + 0x48)
            step['candidateQ12'] = self.vector(r.sp + 0x3C)
        if address == 0x0210E24C and r.r0 == 1:
            step['obstacleVectorQ12'] = self.vector(r.sp + 0xC)
        if address == 0x0210E2AC:
            step['tile'] = [self.signed(r.r5), self.signed(r.r10)]
            step['terrain'] = r.r7
            step['obstacle'] = r.r8
            step['secondaryBlocked'] = r.r9
        self.active['steps'].append(step)
