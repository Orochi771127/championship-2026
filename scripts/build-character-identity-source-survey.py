"""Read-only full-roster source witnesses for identity design; no new art claims."""
import argparse
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('identity_source_review',ROOT/'scripts/review-character-pixel-settings.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

def build(archive, output):
    catalog=r.read(r.PACK/'generated/catalog.json')
    records=[];output.mkdir(parents=True,exist_ok=True)
    for entity in catalog['entities']:
        eid=entity['entityId']; family=archive/'08_FULL_FAMILY_CONVERSION/digimon'/f'{eid}_main'
        cells=r.read(family/'cells.json');bank=r.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon',f'{eid}_main',cells)
        chosen=None
        for cell in cells['cells']:
            im,_=r.SOURCE.render_native(cell,bank)
            if im.getchannel('A').getbbox():chosen=(cell,im);break
        if chosen is None:raise ValueError(f'No nonblank reference: {eid}')
        cell,im=chosen;name=f'{eid}.png';im.save(output/name)
        records.append({'entityId':eid,'kind':entity['kind'],'sourceOrdinal':entity['sourceOrdinal'],
            'sourceBatch':entity['sourceBatch'],'slotCount':entity['slotCount'],'uniqueNonblankMasters':entity['uniqueNonblankMasters'],
            'sequenceCount':entity['sequenceCount'],'structure':entity['structure'],
            'motionContractSha256':entity['motionContractSha256'],'witnessKey':f"main/cell_{cell['cellIndex']:03d}",
            'nativeBounds':cell['bounds'],'sourceImage':name,'sourceImageSha256':r.digest((output/name).read_bytes()),
            'classification':'RESEARCH_ONLY_SOURCE_REFERENCE','newAppearanceAuthored':False})
    if len(records)!=224 or len({e['entityId'] for e in records})!=224:raise ValueError('Incomplete roster')
    groups=[records[:8],records[8:80],records[80:152],records[152:224]]
    for group_index,group in enumerate(groups):
        for offset in range(0,len(group),24):
            page=group[offset:offset+24]; sheet=Image.new('RGB',(1440,80+250*((len(page)+3)//4)),'#e8e8de');d=ImageDraw.Draw(sheet)
            d.text((20,18),f'SOURCE REFERENCE ONLY / GROUP {group_index} / PAGE {offset//24+1} / NO NEW ART',fill='#27333a')
            for n,item in enumerate(page):
                x=n%4*360;y=80+n//4*250;im=Image.open(output/item['sourceImage']).convert('RGBA')
                d.text((x+12,y+10),item['entityId'],fill='#27333a')
                scale=max(1,min(4,330//im.width,175//im.height));big=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
                sheet.paste(big,(x+12,y+35),big)
                d.text((x+12,y+218),f"{item['witnessKey']} | {im.width}x{im.height} | {item['uniqueNonblankMasters']} masters",fill='#52605e')
            sheet.save(output/f'group-{group_index}-page-{offset//24+1}.png')
        (output/f'group-{group_index}.json').write_bytes(r.encoded(group))
    totals={'entities':len(records),'regular':sum(e['kind']!='egg' for e in records),'eggs':sum(e['kind']=='egg' for e in records),
            'slots':sum(e['slotCount'] for e in records),'sequences':sum(e['sequenceCount'] for e in records),
            'uniqueNonblankMasters':sum(e['uniqueNonblankMasters'] for e in records)}
    (output/'index.json').write_bytes(r.encoded({'classification':'RESEARCH_ONLY_SOURCE_REFERENCE','totals':totals,'records':records}))
    print(totals)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive-root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();build(a.archive_root,a.output)
