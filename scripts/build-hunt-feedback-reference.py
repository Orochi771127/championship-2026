"""Package unchanged owner-ROM tool cells for loopback-only comparison."""
import argparse, hashlib, json, runpy, io
from lib.native_object_reference import native_bank,render_native
from pathlib import Path
from ndspy.rom import NintendoDSRom
helpers=runpy.run_path(str(Path(__file__).with_name('build-raising-feedback-reference.py')))
SHA,emit,digest,ROOT=(helpers[key] for key in ['SHA','emit','digest','ROOT'])

REL='assets/production/internal-faithful-baseline/hunt-feedback-v1'
ASSET='art:vfx:hunt-feedback:local-reference:v1'
BANKS={'SHOT':['bullet_nomal','bullet_sleep','bullet_stun'],
       'MEAT':['niku_nomal','niku_big','niku_poison','niku_stun'],
       'DECOY':['decoy','decoy2'],'LIGHT':['digilight','digilight2'],
       'BOMB':['bom_nomal','bom_sleep','bom_stun','bom_flash'],
       'MINE':['smallmine','hugemine'],'CAPTURE_TRAP':['digicach','digiprison']}

def build(archive,rom_path):
    raw=rom_path.read_bytes();assert digest(raw)==SHA
    rom=NintendoDSRom(raw);banks=[];raw_count=0
    for kind,names in BANKS.items():
        for item,name in enumerate(names):
            bank='e002_hunt_'+name
            folder=archive/'08_FULL_FAMILY_CONVERSION/common'/bank
            family=json.loads((folder/'family.json').read_text());assert not family['warnings']
            hashes={}
            for source in family['sourceFiles']:
                filename=source['name'];data=(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common'/filename).read_bytes()
                assert data==bytes(rom.files[rom.filenames.idOf('common/'+filename)])
                hashes[filename]=digest(data);raw_count+=1
            cells=[]
            cells_doc=json.loads((folder/'cells.json').read_text());native=native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common',bank,cells_doc)
            for cell in cells_doc['cells']:
                i=cell['cellIndex'];b=cell['bounds'];filename=f'cell-{i:03}.png'
                pixels,_=render_native(cell,native);buffer=io.BytesIO();pixels.save(buffer,format='PNG');png=buffer.getvalue();dest=ROOT/REL/bank/filename
                dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(png)
                cells.append(dict(cell=i,src=f'{REL}/{bank}/{filename}',sha256=digest(png),
                    width=b['maxXExclusive']-b['minX'],height=b['maxYExclusive']-b['minY'],origin=[-b['minX'],-b['minY']]))
            sequences=[dict(id=s['sequenceId'],playbackMode=s['rawWordB'],loopStartFrame=s['loopStartFrame'],
                frames=[dict(cell=f['cellId'],ticks=f['rawDurationTicks']) for f in s['frames']])
                for s in json.loads((folder/'animations.json').read_text())['sequences']]
            banks.append(dict(kind=kind,itemIndex=item,bank=bank,cells=cells,sequences=sequences,sourceHashes=hashes))
    entry=dict(assetId=ASSET,manifestPath=REL+'/manifest.json',runtimeEligible=True,localOnly=True,
        runtimeScope='LOOPBACK_RESEARCH_ONLY',rightsStatus='ROM_COPYRIGHTED_REFERENCE',publicReleasePermitted=False,
        shippingReady=False,humanApproved=False,productionStatus='OWNER_AUTHORIZED_LOCAL_REFERENCE',gameplayBinding='EXTERNAL_EXISTING_RUNTIME')
    emit(ROOT/REL/'manifest.json',dict(schemaVersion=1,**entry,banks=banks,romSha256=SHA))
    path=ROOT/'assets/production/ART_PRODUCTION_INDEX.json';index=json.loads(path.read_text())
    index['entries']=[e for e in index['entries'] if e['assetId']!=ASSET]+[entry]
    index['summary']['registeredRuntimeBundles']=len(index['entries']);emit(path,index)
    print(json.dumps(dict(banks=len(banks),cells=sum(len(b['cells']) for b in banks),rawFilesVerified=raw_count)))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True);p.add_argument('--rom',type=Path,required=True)
    args=p.parse_args();build(args.archive,args.rom)
