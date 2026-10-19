"""Use the two exact newly approved equipped originals; never generate or change poses."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCES={201:('libfile_1a56d8086a308191a96d6b128bb3be9b','503bbb48f1bfbb0665039d8ce70bc482238c28434d0068ce384f09fdfee9ec4f'),
         202:('libfile_ba2c62c72cf081919b9a97f1ff8aaaf4','cd06efa67f8ab341b07beee21a699ba2b5f3e8e9f1223bf50b8d904746b814cf')}
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf8'))
def write(p,j):
    target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--masters',type=Path,required=True);args=parser.parse_args()
    hp='src/data/championship/database-hero-portraits.public.v1.json';ip='assets/production/PUBLIC_RUNTIME_INDEX.json'
    ap='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';bp='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
    heroes,index,allow,inputs=map(read,[hp,ip,ap,bp]);assert len(heroes['entries'])==182
    identities=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getDatabaseDisplayEntry as get}from './src/championship/database/databaseDisplayCatalog.js';console.log(JSON.stringify([201,202].map(get)))"],cwd=ROOT,text=True,encoding='utf8'))
    approval={'status':'owner_approved','messageId':'Sentinel_e0c3b3d5f0e08191994201ed99309bed','ownerQuote':'可以',
      'questionMessageId':'Sentinel_fdd813279510819199d378476a796c33','scope':'Right-hand equipped versions explicitly approved for formal encyclopedia: 201 hammer, grip and wood/metal brushwork; 202 staff, coffin shield and two-hand holding. Body and independent equipment remain animation references; no animation changes.'}
    manifest={'baseCommit':'374686287dae6a55ab9c5eae75f823b9fed67d66','approval':approval,'priorEntriesSha256':sha(json.dumps(heroes['entries'],ensure_ascii=False,separators=(',',':')).encode()),'entries':[]}
    for identity in identities:
        n=identity['speciesIndex'];lib,expected=SOURCES[n];source=args.masters/f'{n}-equipped-approved.png';data=source.read_bytes();assert sha(data)==expected
        original=Image.open(source).convert('RGBA');row={k:identity[k]for k in ['speciesIndex','speciesId','displayCode']}
        record={**row,'master':{'path':str(source.resolve()),'libraryFileId':lib,'sha256':expected,'dimensions':list(original.size)},'approval':approval,'purpose':'APPROVED_EQUIPPED_SINGLE_IMAGE_ONLY'}
        for kind,size in [('display',768),('thumbnail',96)]:
            image=original.copy();image.thumbnail((size,size),Image.Resampling.LANCZOS)
            dest=ROOT/f'assets/production/database-repair-20261019/species-{n}.{kind}.webp'
            image.save(dest,format='WEBP',lossless=kind=='thumbnail',quality=90,alpha_quality=100,method=6,exact=True)
            encoded=dest.read_bytes();decoded=Image.open(dest).convert('RGBA');assert decoded.getchannel('A').tobytes()==image.getchannel('A').tobytes()
            if kind=='thumbnail':assert decoded.tobytes()==image.tobytes()
            hashed=dest.with_name(dest.stem+'.'+sha(encoded)[:16]+'.webp');dest.rename(hashed);relative=hashed.relative_to(ROOT).as_posix()
            media={'src':relative,'width':image.width,'height':image.height,'sha256':sha(encoded)}
            record[kind]={**media,'bytes':len(encoded),'alphaExactlyMatchesResizedMaster':True}
            if kind=='display':row.update(media)
            else:row['thumbnail']=media
            asset={'id':f'species-{n}:database-{"hero"if kind=="display"else"thumbnail"}','src':relative,'sha256':media['sha256'],'width':media['width'],'height':media['height']}
            index['assets'].append(asset);allow['assets'].append(asset);selected={'path':relative,'sha256':media['sha256']}
            allow['files'].append(selected);inputs['files'].append(relative);inputs['publicPlaytest']['files'].append(selected)
        heroes['entries'].append(row);manifest['entries'].append(record)
    heroes['entries'].sort(key=lambda e:e['speciesIndex'])
    for value in [index,allow]:value['assets'].sort(key=lambda r:r['id'])
    write(hp,heroes);write(ip,index)
    for rows in [allow['files'],inputs['publicPlaytest']['files']]:
        for row in rows:
            if row['path']in [hp,ip]:row['sha256']=sha((ROOT/row['path']).read_bytes())
    write(ap,allow);write(bp,inputs);write('docs/art/production/characters/approved-equipped-201202-20261019/manifest.json',manifest)
    print(json.dumps({'added':[201,202],'total':len(heroes['entries']),'bytes':sum(r[k]['bytes']for r in manifest['entries']for k in ['display','thumbnail'])}))

if __name__=='__main__':main()
