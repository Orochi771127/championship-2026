"""Inventory every original character timeline against the live atlas contract.

Reads the owner's ROM directly. Only hashes, numeric timelines and differences
are written; this is source research, not a full-game regression run.
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom

ROOT=Path(__file__).resolve().parents[2]
SHA='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'

def read_sequences(raw):
    assert raw[:4]==b'RNAN' and raw[16:20]==b'KNBA'
    count,total,seq,frames,results=struct.unpack_from('<HHIII',raw,24)
    output=[]
    for i in range(count):
        length,loop,kind,mode,offset=struct.unpack_from('<HHIII',raw,24+seq+i*16)
        # Cell-index elements only. Never silently discard an original SRT
        # or translation element if a different source bank is introduced.
        assert kind==0x10000, f'UNSUPPORTED_NANR_ELEMENT:{kind:#x}'
        timeline=[]
        for j in range(length):
            result,ticks,marker=struct.unpack_from('<IHH',raw,24+frames+offset+j*8)
            assert marker==0xBEEF
            cell=struct.unpack_from('<H',raw,24+results+result)[0]
            timeline.append(dict(cell=cell,ticks=ticks))
        output.append(dict(id=i,playbackMode=mode,loopStartFrame=loop,frames=timeline))
    assert sum(len(s['frames'])for s in output)==total
    return output

def main():
    p=argparse.ArgumentParser();p.add_argument('--rom',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    raw=a.rom.read_bytes();assert hashlib.sha256(raw).hexdigest()==SHA;rom=NintendoDSRom(raw)
    base=ROOT/'assets/production/internal-faithful-baseline/characters-v1'
    manifest=json.loads((base/'manifest.json').read_text());entries=[];differences=[]
    for record in manifest['records']:
        entity=record['entityId'];runtime=json.loads((base/record['runtime']).read_text());banks={}
        for directory,suffix in [('digimon','main'),('digimon','sub'),('db_digimon','db_main'),('db_digimon','db_sub')]:
            path=f'{directory}/{entity}_{suffix}.nanr';data=bytes(rom.files[rom.filenames.idOf(path)]);sequences=read_sequences(data)
            side=suffix if directory=='digimon'else None
            if side:
                packed=[dict(id=s['id'],playbackMode=s['playbackMode'],loopStartFrame=s.get('loopStartFrame',0),
                    frames=[dict(cell=f['cell'],ticks=f['ticks'])for f in s['frames']])for s in runtime['sides'][side]['animations']]
                if packed!=sequences:differences.append(dict(entityId=entity,side=side,original=sequences,current=packed))
            banks[suffix]=dict(path=path,sha256=hashlib.sha256(data).hexdigest(),sequences=sequences)
        entries.append(dict(entityId=entity,speciesIds=[b['speciesId']for b in manifest['speciesBindings']if b['entityId']==entity],banks=banks))
    report=dict(classification='STATIC_BINARY_READ',romSha256=SHA,
        summary=dict(speciesBindings=len(manifest['speciesBindings']),uniqueCharacters=len(entries),banks=len(entries)*4,
            sequences=sum(len(b['sequences'])for e in entries for b in e['banks'].values()),
            runtimeTimelineMismatches=len(differences)),
        boundaries=['numeric sequence identity and duration comparison only','not proof that every behavior is reachable in normal gameplay'],
        characters=entries,differences=differences)
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(report['summary']))
    for d in differences:print(d['entityId'],d['side'])
if __name__=='__main__':main()
