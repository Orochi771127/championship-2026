"""Controlled original-ROM Shot probe. Only selected Shot index/quantity are
changed in an isolated process; no HP, AI, RNG, stack or outcome is injected.
Player saves and source states are never written. Not an untouched playthrough.
"""
import json
from pathlib import Path
from desmume.emulator import DeSmuME
from hunt_original_probe import ROM_SHA

root=Path(__file__).resolve().parents[2]
private=root.parent/'_archive/hunt-confirmation-2026-09-08'
emu=DeSmuME();emu.volume_set(0);emu.open(str(private/'original.nds'),auto_resume=False)
emu.savestate.load_file(str(private/'bound_after_release.dst'));emu.resume()
word=lambda a:emu.memory.unsigned[a:a+4:4][0]
tick=0;events=[];injections=[];shot=None;writes=[];animationCalls=[]
def changed(address,size):
    r=emu.memory.register_arm9
    writes.append({'tick':tick,'pc':r.pc,'instruction':emu.memory.get_next_instruction(),'address':address,'size':size,
      'value':word(0x027e3a70),'registers':[getattr(r,'r'+str(i)) for i in range(13)]})
    return True
emu.memory.register_write(0x027e3a70,changed,4)
def hook(address,size):
    global shot
    r=emu.memory.register_arm9
    if address==0x0202E188 and r.sp==0x027e3a90:
        animationCalls.append({'tick':tick,'caller':r.lr,'registers':[getattr(r,'r'+str(i)) for i in range(13)],
                               'callerStack':[word(r.sp+i*4) for i in range(20)]})
    elif address==0x02122710:
        if shot is None:
            shot=r.r0
            inventory=word(word(0x020FBA08)+4)
            emu.memory.write_long(shot+0x34,8)
            emu.memory.write_short(inventory+0xa40+16,99)
            injections.extend([{'address':shot+0x34,'value':8},{'address':inventory+0xa40+16,'value':99}])
    elif address==0x021225FC:
        manager=word(0x0210AA1C);camera=word(manager+0xBAA4)
        events.append({'tick':tick,'target':r.r1,'event':r.r2,'stack':r.sp,
                       'payload':list(emu.memory.unsigned[r.r3:r.r3+4:1]),'cameraTopQ12':word(camera+0x8c) if camera else 0,
                       'cameraTopPixels':word(0x0212AC48),'previousWrites':writes[-6:],'animationCalls':animationCalls[-3:]})
    return True
for address in [0x0202E188,0x02122710,0x021225FC]:emu.memory.register_exec(address,hook,4)
def frames(n):
    global tick
    for _ in range(n):emu.cycle();tick+=1
emu.input.touch_set_pos(92,182);frames(6);emu.input.touch_release();frames(6)
for attempt in range(18):
    manager=word(0x0210AA1C);obj=word(manager+12+7*4);wild=word(obj+0x704);actor=word(wild+0x34)
    x=(word(actor+0x24)>>12)-word(0x0212ACB8)
    y=(word(actor+0x28)>>12)-word(0x0212AC48)-5
    if 0<=x<256 and 0<=y<168:emu.input.touch_set_pos(x,y)
    frames(65);emu.input.touch_release();frames(3)
out=root/'reports/hunt-core-two-stage-2026-09-08/spread-original-input.json'
out.write_text(json.dumps({'sourceSha256':ROM_SHA,'controlledChanges':injections,
  'boundary':'Selected index and quantity only; actual caller stack, event path and RNG unchanged.',
  'events':events},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'shot':shot,'events':len(events),'responseBytes':sorted(set(e['payload'][2] for e in events))}))
