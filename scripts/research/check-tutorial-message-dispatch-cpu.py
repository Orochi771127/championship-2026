"""Replay the original Raising tutorial's message selector, not its UI.
The VM argument reader and text renderer are explicit controlled seams.
Outputs IDs and evidence metadata only; no ROM code, pixels or strings.
"""
import argparse
import hashlib
import json
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

parser = argparse.ArgumentParser()
parser.add_argument('--rom', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
raw = Path(args.rom).read_bytes()
sha = hashlib.sha256(raw).hexdigest()
assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom = NintendoDSRom(raw)
arm = bytes(decompress(rom.arm9))
u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
u.mem_map(0x02000000, 0x00800000)
u.mem_write(0x02000000, arm)
stop, stack = 0x027f0000, 0x027ef000
index, text_id, rendered = 0, None, None

def finish(value=0):
    u.reg_write(UC_ARM_REG_R0, value)
    u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))

def hook(_, address, size, user):
    global text_id, rendered
    if address == 0x02054a34:
        assert u.reg_read(UC_ARM_REG_R1) == 0
        finish(index << 12)
    elif address == 0x0207d234:
        text_id = u.reg_read(UC_ARM_REG_R1)
        finish(text_id)  # Controlled text handle, not a copied string.
    elif address == 0x0208568c:
        rendered = u.reg_read(UC_ARM_REG_R1)
        finish()

u.hook_add(UC_HOOK_CODE, hook)
expected = list(range(1495, 1527)) + [1553, 1554, 1564, 1565]
cases = []
for index, wanted in enumerate(expected):
    text_id, rendered = None, None
    u.reg_write(UC_ARM_REG_SP, stack)
    u.reg_write(UC_ARM_REG_LR, stop)
    u.reg_write(UC_ARM_REG_R0, 0x02600000)
    u.emu_start(0x02085ef4, stop, count=1000)
    assert u.reg_read(UC_ARM_REG_PC) == stop
    assert rendered == text_id == wanted, (index, wanted, text_id, rendered)
    cases.append({'selector': index, 'vmArgumentQ12': index << 12, 'textId': text_id, 'passed': True})
receipt = {
    'romSha256': sha, 'function': '02085EF4', 'table': '020CBC64',
    'evidence': 'BOUNDED_ORIGINAL_CPU_MESSAGE_DISPATCH',
    'scope': '36 Raising tutorial message selectors; not full tutorial progression or visual acceptance',
    'seams': ['VM argument reader returns selector Q12', 'text-bank lookup returns numeric handle', 'message renderer records handle'],
    'normalOnboardingAccepted': False, 'cases': cases,
}
Path(args.out).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': len(cases), 'firstMissingRange': [1495, 1514], 'additionalRaisingIds': expected[32:]}))
