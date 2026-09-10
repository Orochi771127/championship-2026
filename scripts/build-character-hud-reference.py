"""Original Raising HUD: db_digimon Sub sequence 0, first cell, at 2x.

OVL18 0211FA94 requests resource side 1; 02120490 selects sequence 0 and
0212049C steps by zero. The selected portrait stays still in native observation.
"""
import argparse,hashlib,json,io
from lib.native_object_reference import native_bank,render_native
from pathlib import Path
from ndspy.rom import NintendoDSRom
ROOT=Path(__file__).resolve().parents[1]
REL='assets/production/internal-faithful-baseline/character-hud-v1'
ASSET='art:characters:hud:local-reference:v1'
def sha(b):return hashlib.sha256(b).hexdigest()
def emit(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes((json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode())
def build(archive,rom_path):
    raw=rom_path.read_bytes();rom_sha=sha(raw)
    assert rom_sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw)
    roster=json.loads((ROOT/'assets/production/internal-faithful-baseline/characters-v1/manifest.json').read_text())
    portraits=[];battle=[]
    for binding in roster['speciesBindings']:
        entity=binding['entityId'];bank=entity+'_db_sub'
        folder=archive/'08_FULL_FAMILY_CONVERSION/db_digimon'/bank
        family=json.loads((folder/'family.json').read_text());assert not family['warnings']
        hashes={}
        for source in family['sourceFiles']:
            name=source['name'];source_bytes=(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/db_digimon'/name).read_bytes()
            assert source_bytes==bytes(rom.files[rom.filenames.idOf('db_digimon/'+name)])
            hashes[name]=sha(source_bytes)
        animation=json.loads((folder/'animations.json').read_text())['sequences'][0]
        assert animation['sequenceId']==0
        cell_id=animation['frames'][0]['cellId']
        cells_doc=json.loads((folder/'cells.json').read_text());cell=cells_doc['cells'][cell_id];bounds=cell['bounds']
        pixels,_=render_native(cell,native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/db_digimon',bank,cells_doc))
        buffer=io.BytesIO();pixels.save(buffer,format='PNG');png=buffer.getvalue()
        dest=ROOT/REL/(entity+'.png');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(png)
        portraits.append(dict(speciesId=binding['speciesId'],entityId=entity,src=REL+'/'+entity+'.png',sha256=sha(png),
            width=bounds['maxXExclusive']-bounds['minX'],height=bounds['maxYExclusive']-bounds['minY'],
            origin=[-bounds['minX'],-bounds['minY']],nativeScale=2,sourceBank=bank,sequenceId=0,cell=cell_id,sourceHashes=hashes))
        bank=entity+'_sub';folder=archive/'08_FULL_FAMILY_CONVERSION/digimon'/bank
        family=json.loads((folder/'family.json').read_text());assert not family['warnings']
        hashes={}
        for source in family['sourceFiles']:
            name=source['name'];data=(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon'/name).read_bytes()
            assert data==bytes(rom.files[rom.filenames.idOf('digimon/'+name)]);hashes[name]=sha(data)
        sequences=[dict(id=s['sequenceId'],playbackMode=s['rawWordB'],loopStartFrame=s['loopStartFrame'],
            frames=[dict(cell=f['cellId'],ticks=f['rawDurationTicks']) for f in s['frames']])
            for s in json.loads((folder/'animations.json').read_text())['sequences'] if s['sequenceId'] in [0,5,9]]
        cells_doc=json.loads((folder/'cells.json').read_text());source_cells=cells_doc['cells'];cells=[]
        native=native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon',bank,cells_doc)
        for cell_id in sorted({f['cell'] for s in sequences for f in s['frames']}):
            b=source_cells[cell_id]['bounds'];name=f'cell-{cell_id:03}.png';pixels,_=render_native(source_cells[cell_id],native)
            buffer=io.BytesIO();pixels.save(buffer,format='PNG');png=buffer.getvalue()
            dest=ROOT/REL/'battle'/entity/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(png)
            cells.append(dict(cell=cell_id,src=f'{REL}/battle/{entity}/{name}',sha256=sha(png),
                width=b['maxXExclusive']-b['minX'],height=b['maxYExclusive']-b['minY'],origin=[-b['minX'],-b['minY']]))
        battle.append(dict(speciesId=binding['speciesId'],entityId=entity,sourceBank=bank,sequences=sequences,cells=cells,sourceHashes=hashes))
    # OVL18 0211EC28..ECF0: training_sub sequence 4, explicit frame equal
    # to the cage definition; waiting room is frame 35. No free-running loop.
    bank='training_sub';folder=archive/'08_FULL_FAMILY_CONVERSION/training'/bank
    family=json.loads((folder/'family.json').read_text());hashes={}
    for source in family['sourceFiles']:
        name=source['name'];data=(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/training'/name).read_bytes()
        assert data==bytes(rom.files[rom.filenames.idOf('training/'+name)]);hashes[name]=sha(data)
    cells_doc=json.loads((folder/'cells.json').read_text());native=native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/training',bank,cells_doc)
    seq=json.loads((folder/'animations.json').read_text())['sequences'][4];ranch=[]
    for definition,f in enumerate(seq['frames']):
        cell=cells_doc['cells'][f['cellId']];pixels,_=render_native(cell,native);b=cell['bounds']
        buffer=io.BytesIO();pixels.save(buffer,format='PNG');png=buffer.getvalue();filename=f'ranch/cage-{definition:02}.png'
        dest=ROOT/REL/filename;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(png)
        ranch.append(dict(definition=definition,src=f'{REL}/{filename}',width=pixels.width,height=pixels.height,
            origin=[-b['minX'],-b['minY']],sha256=sha(png),sourceHashes=hashes))
    medals=[]
    # OVL8 result title resource formats database/item_badge%03d, match + 1.
    for title_id in range(61):
        bank=f'item_badge{title_id+1:03}';folder=archive/'08_FULL_FAMILY_CONVERSION/database'/bank
        family=json.loads((folder/'family.json').read_text());hashes={}
        for source in family['sourceFiles']:
            name=source['name'];data=(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/database'/name).read_bytes()
            assert data==bytes(rom.files[rom.filenames.idOf('database/'+name)]);hashes[name]=sha(data)
        cells_doc=json.loads((folder/'cells.json').read_text());cell=cells_doc['cells'][0]
        pixels,_=render_native(cell,native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/database',bank,cells_doc))
        buffer=io.BytesIO();pixels.save(buffer,format='PNG');png=buffer.getvalue();filename=f'medals/{bank}.png'
        dest=ROOT/REL/filename;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(png)
        medals.append(dict(titleId=title_id,src=f'{REL}/{filename}',width=pixels.width,height=pixels.height,sha256=sha(png),sourceHashes=hashes))
    entry=dict(assetId=ASSET,manifestPath=REL+'/manifest.json',runtimeEligible=True,localOnly=True,
        runtimeScope='LOOPBACK_RESEARCH_ONLY',rightsStatus='ROM_COPYRIGHTED_REFERENCE',publicReleasePermitted=False,
        shippingReady=False,humanApproved=False,productionStatus='OWNER_AUTHORIZED_LOCAL_REFERENCE',gameplayBinding='EXTERNAL_EXISTING_RUNTIME')
    emit(ROOT/REL/'manifest.json',dict(schemaVersion=1,**entry,romSha256=rom_sha,portraits=portraits,battle=battle,medals=medals,ranch=ranch,
        binding='OVL18_SELECTED_DB_SUB_SEQUENCE_0_FIRST_FRAME_STATIC'))
    p=ROOT/'assets/production/ART_PRODUCTION_INDEX.json';index=json.loads(p.read_text(encoding='utf-8'))
    index['entries']=[e for e in index['entries'] if e['assetId']!=ASSET]+[entry]
    index['summary']['registeredRuntimeBundles']=len(index['entries']);emit(p,index)
    print(json.dumps(dict(portraits=len(portraits),battleBanks=len(battle),rawFilesVerified=sum(len(p['sourceHashes']) for p in portraits+battle))))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True);p.add_argument('--rom',type=Path,required=True)
    a=p.parse_args();build(a.archive,a.rom)
