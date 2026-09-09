"""Original running Hunt clock, unchanged isolated saved state. No input or RAM writes."""
from pathlib import Path
import json
from desmume.emulator import DeSmuME
from hunt_original_probe import load_rom, ROM_SHA

root=Path(__file__).resolve().parents[2]
private=root.parent/'_archive/hunt-confirmation-2026-09-08'
load_rom(private/'original.nds')  # Validate the exact source before executing.
emu=DeSmuME();emu.volume_set(0)
emu.open(str(private/'original.nds'),auto_resume=False)
emu.savestate.load_file(str(private/'bound_after_release.dst'));emu.resume()
word=lambda a:emu.memory.unsigned[a:a+4:4][0]
def snapshot(tick):
    player=word(0x020fba08)
    return {'tick':tick,'sessionMode':word(player+0xa8),'deadlineMinute':word(player+0x18),
            'clock':[word(0x0210aa94+4*i) for i in range(18)]}
samples=[snapshot(0)]
for tick in range(1,241):
    emu.cycle()
    if tick%25==0:samples.append(snapshot(tick))
out=root/'reports/hunt-core-two-stage-2026-09-08/clock-original-input.json'
out.write_text(json.dumps({'sourceSha256':ROM_SHA,
    'boundary':'Unmodified bound_after_release state; 240 original frames, no input or RAM writes.',
    'samples':samples},indent=2)+'\n',encoding='utf-8',newline='\n')
assert all(s['clock'][1]-samples[0]['clock'][1]==s['tick']//25 for s in samples)
print(json.dumps({'samples':len(samples),'mode':samples[0]['sessionMode'],'divisor':samples[0]['clock'][6]}))
