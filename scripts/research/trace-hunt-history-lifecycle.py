"""Private original UI observer for Hunt history save/load reads and writes.

Stylus input and cycles only. Optional history injection is an explicitly
controlled serialization probe, never normal-generation acceptance. All ROM,
battery saves, checkpoints and screenshots remain inside --private-dir.
"""
import argparse
import hashlib
import json
import shutil
import os
import subprocess
from pathlib import Path
import sys
from desmume.emulator import DeSmuME


def use_private_host(private):
    # Windows interface uses the executable directory for its default battery
    # path. A Store Python host cannot write there and silently falls back to
    # RAM; reset then loses its save. Keep the host and every battery write here.
    if os.name!='nt' or Path(sys.executable).resolve().is_relative_to(private):return
    runner=private/'runner';runner.mkdir(exist_ok=True);base=Path(sys.base_prefix)
    for source in [base/'python.exe',*base.glob('*.dll')]:
        target=runner/source.name
        if not target.exists():shutil.copyfile(source,target)
    shutil.copytree(base/'DLLs',runner/'DLLs',dirs_exist_ok=True)
    paths=[str(runner/'DLLs')]+[x for x in sys.path if x and Path(x).exists() and Path(x)!=base/'DLLs']
    (runner/f'python{sys.version_info.major}{sys.version_info.minor}._pth').write_text('\n'.join(paths)+'\nimport site\n',encoding='utf8',newline='\n')
    raise SystemExit(subprocess.run([str(runner/'python.exe'),'-X','utf8',str(Path(__file__).resolve()),*sys.argv[1:]]).returncode)


def main():
    ap=argparse.ArgumentParser()
    for key in ['rom','state','private-dir']:ap.add_argument('--'+key,required=True)
    args=ap.parse_args();state_path=Path(args.state).resolve();private=Path(args.private_dir).resolve();private.mkdir(parents=True,exist_ok=True)
    use_private_host(private)
    source=Path(args.rom);sha=hashlib.sha256(source.read_bytes()).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=private/'original.nds'
    if not rom.exists():shutil.copyfile(source,rom)
    assert hashlib.sha256(rom.read_bytes()).hexdigest()==sha
    for name in ['Battery','States','Cheats']:(private/name).mkdir(exist_ok=True)
    os.chdir(private)
    emu=DeSmuME();emu.volume_set(0);emu.open(str(rom),auto_resume=False);emu.savestate.load_file(str(state_path));emu.resume()
    word=lambda a:emu.memory.unsigned[a:a+4:4][0]
    tick,sequence=0,0;events=[];actions=[];snapshots=[];watched=set();cycling=False
    def watch():
        player=word(0x020FBA08)
        if not 0x2000000<=player<0x2400000:return
        history=word(player+0x2c)
        if not 0x2000000<=history<0x2400000 or history in watched:return
        watched.add(history)
        for kind,start,size in [('history',history,96),('history-cursor',player+0x30,4),('modifiers',0x0210AF4C,0x134)]:
            def callback(a,n,k=kind):
                if cycling and len(events)<20000:
                    r=emu.memory.register_arm9
                    events.append({'kind':k,'access':'read','tick':tick,'address':a,'size':n,'pc':r.pc,'lr':r.lr})
                return True
            def changed(a,n,k=kind):
                if cycling and len(events)<20000:
                    r=emu.memory.register_arm9
                    events.append({'kind':k,'access':'write','tick':tick,'address':a,'size':n,'pc':r.pc,'lr':r.lr})
                return True
            emu.memory.register_read(start,callback,size);emu.memory.register_write(start,changed,size)
    def snapshot():
        player=word(0x020FBA08)
        if not 0x2000000<=player<0x2400000:return {'player':player}
        at=word(player+0x2c)
        if not 0x2000000<=at<0x2400000:return {'player':player,'historyAddress':at}
        rows=[]
        for i in range(4):
            a=at+i*24
            rows.append({'speciesIndex':word(a),'biomeIndex':word(a+4),'trait':word(a+8),
                'name':bytes(emu.memory.unsigned[a+12:a+24]).decode('utf-16-le').split('\0')[0]})
        modifiers=[]
        for i in range(16):
            order=word(0x020A1358+i*4);n=emu.memory.unsigned[order:order+2:2][0]
            base=word(0x020CC4C0+i*4)
            modifiers.append(list(emu.memory.unsigned[base:base+n]))
        return {'player':player,'historyAddress':at,'cursor':word(player+0x30),'history':rows,'modifiers':modifiers}
    def show():
        nonlocal sequence
        sequence+=1;watch();s=snapshot();path=private/f'frame-{sequence:03}.png';emu.screenshot().save(path)
        snapshots.append({'sequence':sequence,'tick':tick,'snapshot':s})
        out={'romSha256':sha,'sourceStateSha256':hashlib.sha256(state_path.read_bytes()).hexdigest(),'tick':tick,'actions':actions,'snapshot':s,'snapshots':snapshots,'events':events}
        (private/'history-lifecycle.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
        print(json.dumps({'tick':tick,'screenshot':str(path),'events':len(events),'snapshot':s},ensure_ascii=False),flush=True)
    show()
    for line in sys.stdin:
        command=json.loads(line);actions.append({'tick':tick,**command})
        if command.get('quit'):break
        if 'touch' in command:emu.input.touch_set_pos(*command['touch'])
        if command.get('release'):emu.input.touch_release()
        if 'buttons' in command:emu.input.keypad_update(command['buttons'])
        if command.get('reset'):emu.reset();emu.resume()
        if 'exportBackup' in command:
            name=command['exportBackup'];assert name.replace('-','').isalnum()
            # Native exportData accepts .sav; the Python .dsv docstring is stale.
            assert emu.backup.export_file(str(private/(name+'.sav')))
        if 'importBackup' in command:
            # Read-only import into the isolated emulator, never overwrite source.
            backup=Path(command['importBackup']);assert backup.is_absolute() and backup.suffix in ['.dsv','.sav']
            assert emu.backup.import_file(str(backup))
        if 'controlledHistory' in command:
            # This only changes an isolated test copy, never the supplied state.
            player=word(0x020FBA08);at=word(player+0x2c)
            row=command['controlledHistory'];assert 0<=row['slot']<4
            at+=row['slot']*24
            for offset,key in [(0,'speciesIndex'),(4,'biomeIndex'),(8,'trait')]:emu.memory.unsigned[at+offset:at+offset+4:4]=[row[key]]
            b=row['name'][:5].encode('utf-16-le').ljust(12,b'\0')
            emu.memory.unsigned[at+12:at+24:1]=list(b)
        if 'controlledCursor' in command:
            cursor=command['controlledCursor'];assert 0<=cursor<3
            emu.memory.unsigned[word(0x020FBA08)+0x30:word(0x020FBA08)+0x34:4]=[cursor]
        if 'controlledModifier' in command:
            row=command['controlledModifier'];assert 0<=row['biomeIndex']<16 and 0<=row['value']<=15
            order=word(0x020A1358+row['biomeIndex']*4);count=emu.memory.unsigned[order:order+2:2][0]
            assert 0<=row['index']<count
            at=word(0x020CC4C0+row['biomeIndex']*4)+row['index']
            emu.memory.unsigned[at]=row['value']
        for _ in range(command.get('frames',0)):
            tick+=1;cycling=True
            try:emu.cycle(False)
            finally:cycling=False
        if 'checkpoint' in command:
            name=command['checkpoint'];assert name.replace('-','').isalnum()
            emu.savestate.save_file(str(private/(name+'.dst')))
        show()


if __name__=='__main__':main()
