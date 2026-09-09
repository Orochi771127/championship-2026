"""Read-only original Raising observer. ROM/state/screenshots stay private.

JSON stdin provides stylus/key/frame inputs and read/write/exec observations.
There is deliberately no RAM mutation command. Use the same checkpoint for
controlled before/after comparisons; this is not a product runtime dependency.
"""
import argparse,hashlib,json,os,shutil,struct,sys
from pathlib import Path
from desmume.emulator import DeSmuME

def main():
    ap=argparse.ArgumentParser()
    for key in ['rom','state','private-dir']:ap.add_argument('--'+key,required=True)
    a=ap.parse_args();private=Path(a.private_dir).resolve();private.mkdir(parents=True,exist_ok=True)
    source=Path(a.rom).resolve();state=Path(a.state).resolve()
    sha=hashlib.sha256(source.read_bytes()).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=private/'original.nds'
    if not rom.exists():shutil.copyfile(source,rom)
    assert hashlib.sha256(rom.read_bytes()).hexdigest()==sha
    os.chdir(private)
    emu=DeSmuME();emu.volume_set(0);emu.open(str(rom),auto_resume=False)
    emu.savestate.load_file(str(state));emu.resume()
    events=[];actions=[];sequence=0;tick=0;enabled=True;capture=None;capture_start=None;ram_hooks={};ram_counts={}
    word=lambda at:emu.memory.unsigned[at:at+4:4][0]
    def snapshot():
        nonlocal sequence
        sequence+=1
        image=private/f'frame-{sequence:03}.png';emu.screenshot().save(image)
        ram=bytes(emu.memory.unsigned[0x02000000:0x02400000:1])
        (private/'latest.ram').write_bytes(ram)
        root=word(0x020fba08)
        roots=[word(root+i*4) for i in range(20)] if 0x2000000<=root<0x2400000 else []
        meta={'romSha256':sha,'stateSha256':hashlib.sha256(state.read_bytes()).hexdigest(),
              'sequence':sequence,'tick':tick,'root':root,'rootWords':roots,'actions':actions,'events':events}
        (private/'observations.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8',newline='\n')
        print(json.dumps({'sequence':sequence,'tick':tick,'root':hex(root),'rootWords':[hex(n) for n in roots],
                          'events':len(events),'screenshot':str(image)}),flush=True)
    def watch(spec):
        at=int(spec['address'],0) if isinstance(spec['address'],str) else spec['address'];size=spec['size']
        assert 0x2000000<=at<at+size<=0x2400000 and size<=0x10000
        def changed(address,width):
            if enabled and len(events)<25000:
                regs=emu.memory.register_arm9
                events.append({'kind':'write','tick':tick,'address':address,'size':width,'pc':regs.pc,'lr':regs.lr,
                               'r0':regs.r0,'r1':regs.r1,'r2':regs.r2,'r3':regs.r3})
            return True
        emu.memory.register_write(at,changed,size)
    def hook(at):
        at=int(at,0) if isinstance(at,str) else at
        def hit(address,width):
            nonlocal capture_start
            if enabled and len(events)<25000:
                regs=emu.memory.register_arm9
                events.append({'kind':'exec','tick':tick,'address':address,'pc':regs.pc,'lr':regs.lr,
                               'registers':[getattr(regs,'r'+str(i)) for i in range(13)]})
                if address in ram_hooks and ram_counts.get(address,0)<ram_hooks[address]:
                    ordinal=ram_counts.get(address,0);ram_counts[address]=ordinal+1
                    name=f'hook-{address:08x}-{ordinal:02}.ram'
                    (private/name).write_bytes(bytes(emu.memory.unsigned[0x02000000:0x02400000:1]))
                    events[-1]['ramSnapshot']=name
                if capture and address==int(capture['address'],0) and capture_start is None:capture_start=tick
            return True
        emu.memory.register_exec(at,hit,4)
    snapshot()
    for line in sys.stdin:
        c=json.loads(line);actions.append({'tick':tick,**c})
        if c.get('quit'):break
        if 'watch' in c:watch(c['watch'])
        if 'capture' in c:
            capture=c['capture'];capture_start=None;hook(capture['address'])
        for address in c.get('hooks',[]):hook(address)
        for spec in c.get('ramAtHooks',[]):
            address=int(spec['address'],0);limit=spec.get('limit',1)
            assert 0x2000000<=address<0x2400000 and isinstance(limit,int) and 1<=limit<=16
            ram_hooks[address]=limit;ram_counts[address]=0;hook(address)
        if 'observe' in c:enabled=bool(c['observe'])
        if c.get('clearEvents'):events.clear()
        if 'touch' in c:emu.input.touch_set_pos(*c['touch'])
        if c.get('release'):emu.input.touch_release()
        if 'buttons' in c:emu.input.keypad_update(c['buttons'])
        if c.get('reload'):emu.savestate.load_file(str(state));emu.resume()
        for _ in range(c.get('frames',0)):
            tick+=1;emu.cycle(False)
            if capture and capture_start is not None and tick-capture_start<=capture['frames'] and (tick-capture_start)%capture['interval']==0:
                emu.screenshot().save(private/f'capture-{tick:06}.png')
        if 'checkpoint' in c:
            name=c['checkpoint'];assert name.replace('-','').isalnum()
            emu.savestate.save_file(str(private/(name+'.dst')))
        snapshot()
    emu.close()

if __name__=='__main__':main()
