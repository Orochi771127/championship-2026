"""Derive only this batch's selected displays from preserved full masters."""
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageChops,ImageStat

ROOT=Path(__file__).resolve().parents[1]
FOLDERS=['approved-dex-closeout-20261019','approved-equipped-closeout-20261019']
archive=ROOT/'.tmp/closeout-before-final-displays';archive.mkdir(parents=True,exist_ok=True)
changes={};records=[]
for folder in FOLDERS:
    manifest=json.loads((ROOT/f'docs/art/production/characters/{folder}/manifest.json').read_text(encoding='utf8'))
    for row in manifest['entries']:
        for kind,size in [('display',768),('thumbnail',96)]:
            old=ROOT/row[kind]['src']
            assert old.relative_to(ROOT).as_posix().startswith('assets/production/database-closeout-20261019/')
            image=Image.open(row['master']['path']).convert('RGBA')
            image.thumbnail((size,size),Image.Resampling.LANCZOS)
            temporary=archive/(old.name+'.final.webp')
            image.save(temporary,format='WEBP',lossless=kind=='thumbnail',quality=90,alpha_quality=100,method=6,exact=True)
            decoded=Image.open(temporary).convert('RGBA')
            assert decoded.getchannel('A').tobytes()==image.getchannel('A').tobytes()
            if kind=='thumbnail':assert decoded.tobytes()==image.tobytes()
            mask=image.getchannel('A').point(lambda value:255 if value>200 else 0)
            mae=sum(ImageStat.Stat(ImageChops.difference(image.convert('RGB'),decoded.convert('RGB')),mask).mean)/3
            assert mae<9
            data=temporary.read_bytes();digest=hashlib.sha256(data).hexdigest()
            new=old.with_name(old.name.split('.')[0]+'.'+kind+'.'+digest[:16]+'.webp')
            if old!=new:
                assert not new.exists()
                temporary.rename(new)
                backup=archive/old.name
                if not backup.exists():old.rename(backup)
            relative=new.relative_to(ROOT).as_posix()
            changes[old.relative_to(ROOT).as_posix()]={'src':relative,'sha256':digest,'width':image.width,'height':image.height,'bytes':len(data)}
            records.append({'speciesIndex':row['speciesIndex'],'role':kind,**changes[old.relative_to(ROOT).as_posix()],
                'alphaIdenticalToResizedMaster':True,'opaqueRgbMeanAbsoluteError':mae,'originalUnchanged':True})

paths=['src/data/championship/database-hero-portraits.public.v1.json','docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json',
 'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json','assets/production/PUBLIC_RUNTIME_INDEX.json',
 *[f'docs/art/production/characters/{folder}/manifest.json'for folder in FOLDERS]]
def update(value):
    if isinstance(value,dict):
        selected=changes.get(value.get('src',value.get('path')))
        if selected:
            for key in list(value):
                if key in selected:value[key]=selected[key]
            if 'path'in value:value['path']=selected['src']
            if 'operation'in value:value['operation']='LANCZOS_CONTAIN_768_WEBP_Q90_ALPHA100'if'.display.'in selected['src']else'LANCZOS_CONTAIN_96_EXACT_RGBA_LOSSLESS_WEBP'
        for item in value.values():update(item)
    elif isinstance(value,list):
        for i,item in enumerate(value):
            if isinstance(item,str)and item in changes:value[i]=changes[item]['src']
            else:update(item)
for name in paths:
    path=ROOT/name;value=json.loads(path.read_text(encoding='utf8'));update(value)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
for name in paths[1:3]:
    path=ROOT/name;value=json.loads(path.read_text(encoding='utf8'));rows=value['files']if'ALLOWLIST'in name else value['publicPlaytest']['files']
    for row in rows:
        if row['path']in[paths[0],paths[3]]:row['sha256']=hashlib.sha256((ROOT/row['path']).read_bytes()).hexdigest()
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
(ROOT/'docs/reports/dex-workspace-closeout-2026-10-19/rendition-verification.json').write_text(json.dumps({'detailMaxEdge':768,'quality':90,'thumbnailMaxEdge':96,'rows':records},indent=2)+'\n',encoding='utf8')
print(json.dumps({'selectedMediaBytes':sum(r['bytes']for r in records),'maxOpaqueRgbMae':max(r['opaqueRgbMeanAbsoluteError']for r in records)}))
