"""Publish the nine exact equipped hero revisions approved in the current task."""
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
BACKUP=Path('R:/Projects/Championship2026/自創腳色/_批次素材備份/20261017T230453Z_7ZIP')
IDS=[142,143,145,149,151,155,156,158,183]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
def write(p,j):
    target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
hp='src/data/championship/database-hero-portraits.public.v1.json'
ap='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'
ip='assets/production/PUBLIC_RUNTIME_INDEX.json'
bp='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
heroes,allow,index,inputs=map(read,[hp,ap,ip,bp])
assert len(heroes['entries'])==146
identities=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getDatabaseDisplayEntry as get} from './src/championship/database/databaseDisplayCatalog.js';console.log(JSON.stringify("+json.dumps(IDS)+".map(get)))"],cwd=ROOT,text=True))
manifest={'scope':'Nine complete single-image equipped heroes. Body-only and separate-weapon references are not finalized encyclopedia portraits.',
 'approval':{'status':'owner_approved','evidence':'Current user reply in this task, 2026-10-19: 確認，9 張持裝圖都採用並整合','scope':'These nine exact equipped hero revisions; original packaging acceptance limits remain historical provenance.'},'entries':[]}
for identity in identities:
    number=identity['speciesIndex']
    refs=json.loads((BACKUP/f'02_角色索引/species-{number}/02_圖鑑美術索引.json').read_text(encoding='utf8'))
    asset=next(a for a in refs['assets'] if a['asset_role']=='equipped_hero')
    source=BACKUP/asset['original_member']['relative_payload_path']
    data=source.read_bytes();record=asset['manifest_record']
    assert sha(data)==record['source_sha256']
    original=Image.open(source).convert('RGBA')
    row={k:identity[k] for k in ['speciesIndex','speciesId','displayCode']}
    delivery={**row,'master':{'path':str(source),'sha256':sha(data),'libraryFileId':asset['library_file_id'],'version':asset['source_version'],'dimensions':list(original.size)},'approval':manifest['approval'],'purpose':'COMPLETE_EQUIPPED_HERO_SINGLE_IMAGE'}
    for kind,size in [('display',864),('thumbnail',128)]:
        image=original.copy();image.thumbnail((size,size),Image.Resampling.LANCZOS)
        relative=f'assets/production/database-closeout-20261019/species-{number}.{kind}.webp'
        image.save(ROOT/relative,format='WEBP',lossless=kind=='thumbnail',quality=95,alpha_quality=100,method=6,exact=True)
        encoded=(ROOT/relative).read_bytes()
        decoded=Image.open(ROOT/relative).convert('RGBA')
        assert decoded.getchannel('A').tobytes()==image.getchannel('A').tobytes()
        if kind=='thumbnail':assert decoded.tobytes()==image.tobytes()
        hashed=(ROOT/relative).with_name(Path(relative).stem+'.'+sha(encoded)[:16]+'.webp')
        (ROOT/relative).rename(hashed)
        relative=hashed.relative_to(ROOT).as_posix()
        media={'src':relative,'width':image.width,'height':image.height,'sha256':sha(encoded)}
        delivery[kind]={**media,'bytes':len(encoded),'operation':f'LANCZOS_CONTAIN_{size}_EXACT_RGBA_LOSSLESS_WEBP' if kind=='thumbnail' else 'LANCZOS_CONTAIN_864_WEBP_Q95_ALPHA100','alphaExactlyMatchesResizedMaster':True}
        if kind=='display':row.update(media)
        else:row['thumbnail']=media
        allow['assets'].append({'id':f'species-{number}:database-{"hero" if kind=="display" else "thumbnail"}',**media})
        selected={'path':relative,'sha256':media['sha256']}
        allow['files'].append(selected);inputs['files'].append(relative);inputs['publicPlaytest']['files'].append(selected)
    assert not any(e['speciesIndex']==number for e in heroes['entries'])
    heroes['entries'].append(row);manifest['entries'].append(delivery)
heroes['entries'].sort(key=lambda e:e['speciesIndex'])
write(hp,heroes)
allow['assets'].sort(key=lambda e:e['id'])
index['assets']=[{'id':e['id'],'src':e['src'],'sha256':e['sha256'],**({'width':e['width'],'height':e['height']} if 'width'in e else {})} for e in allow['assets']]
write(ip,index)
for rows in [allow['files'],inputs['publicPlaytest']['files']]:
    for r in rows:
        if r['path'] in [hp,ip]:r['sha256']=sha((ROOT/r['path']).read_bytes())
write(ap,allow);write(bp,inputs)
write('docs/art/production/characters/approved-equipped-closeout-20261019/manifest.json',manifest)
print(json.dumps({'portraits':len(heroes['entries']),'equippedAdded':IDS}))
