"""Append four exact original revisions confirmed by the owner in this session."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SOURCES={126:('libfile_22a2040782a48191b97e3c70eebc5ba2','60b176f6c4ef2e3314c3bd1435b59b90dfd0a2967a748f3724b80448ba419641','v5'),
 169:('libfile_0b1604725d3881918e9f999c9d95968e','8e194fcfd408e80ac502b2c74ae8f5414feebba6d930a9056c94d2448daf2b74','v6'),
 170:('libfile_6aa30539ed3481919d36a0d6d3ef422c','eb0da79b79cb49a495f915868883ae4c8881fa34182c79596f906ed243089d5d','v8'),
 173:('libfile_d7c1a53bee788191b756376c5d33c787','f4c30e15489143da8826c107577592cc11f46446b43f41286a4f5d853f9ab65f','v2')}
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf8'))
def write(p,j):
 target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--masters',type=Path,required=True);args=parser.parse_args()
 hp='src/data/championship/database-hero-portraits.public.v1.json';ip='assets/production/PUBLIC_RUNTIME_INDEX.json';ap='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';bp='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
 heroes,index,allow,inputs=map(read,[hp,ip,ap,bp]);assert len(heroes['entries'])==184
 identities=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getDatabaseDisplayEntry as get}from './src/championship/database/databaseDisplayCatalog.js';console.log(JSON.stringify([126,169,170,173].map(get)))"],cwd=ROOT,text=True,encoding='utf8'))
 manifest={'baseCommit':'374686287dae6a55ab9c5eae75f823b9fed67d66','priorEntriesSha256':sha(json.dumps(heroes['entries'],ensure_ascii=False,separators=(',',':')).encode()),'entries':[]}
 for identity in identities:
  n=identity['speciesIndex'];lib,expected,version=SOURCES[n];source=args.masters/f'{n}-approved.png';data=source.read_bytes();assert sha(data)==expected
  approval={'status':'owner_approved','messageId':'Sentinel_4fb1f4571bac8191b0df75f3a531ec06'if n==126 else'Sentinel_dace75b491488191b6528550c1c3b3ce','ownerQuote':'嗯 可以'if n==126 else'對啊，這些都是核准的圖','scope':'Exact original v5 double-leg correction; not early extra-leg variants.'if n==126 else'Exact original AW41 v6, AW42 v8 and AW45 v2 shown in this session. Later three-view back corrections do not revoke these main images.'}
  original=Image.open(source).convert('RGBA');row={k:identity[k]for k in['speciesIndex','speciesId','displayCode']};record={**row,'master':{'path':str(source.resolve()),'libraryFileId':lib,'sha256':expected,'version':version,'dimensions':list(original.size)},'approval':approval,'purpose':'EXACT_APPROVED_ORIGINAL_SINGLE_IMAGE_ONLY'}
  for kind,size in[('display',768),('thumbnail',96)]:
   image=original.copy();image.thumbnail((size,size),Image.Resampling.LANCZOS);dest=ROOT/f'assets/production/database-repair-20261019/species-{n}.{kind}.webp';image.save(dest,format='WEBP',lossless=kind=='thumbnail',quality=90,alpha_quality=100,method=6,exact=True)
   encoded=dest.read_bytes();decoded=Image.open(dest).convert('RGBA');assert decoded.getchannel('A').tobytes()==image.getchannel('A').tobytes()
   if kind=='thumbnail':assert decoded.tobytes()==image.tobytes()
   hashed=dest.with_name(dest.stem+'.'+sha(encoded)[:16]+'.webp');dest.rename(hashed);relative=hashed.relative_to(ROOT).as_posix();media={'src':relative,'width':image.width,'height':image.height,'sha256':sha(encoded)};record[kind]={**media,'bytes':len(encoded),'alphaExactlyMatchesResizedMaster':True}
   if kind=='display':row.update(media)
   else:row['thumbnail']=media
   asset={'id':f'species-{n}:database-{"hero"if kind=="display"else"thumbnail"}','src':relative,'sha256':media['sha256'],'width':media['width'],'height':media['height']};index['assets'].append(asset);allow['assets'].append(asset);selected={'path':relative,'sha256':media['sha256']};allow['files'].append(selected);inputs['files'].append(relative);inputs['publicPlaytest']['files'].append(selected)
  heroes['entries'].append(row);manifest['entries'].append(record)
 heroes['entries'].sort(key=lambda e:e['speciesIndex'])
 for value in[index,allow]:value['assets'].sort(key=lambda r:r['id'])
 write(hp,heroes);write(ip,index)
 for rows in[allow['files'],inputs['publicPlaytest']['files']]:
  for row in rows:
   if row['path']in[hp,ip]:row['sha256']=sha((ROOT/row['path']).read_bytes())
 write(ap,allow);write(bp,inputs);write('docs/art/production/characters/confirmed-dex-next-four-20261019/manifest.json',manifest)
 print(json.dumps({'added':list(SOURCES),'total':len(heroes['entries']),'bytes':sum(r[k]['bytes']for r in manifest['entries']for k in['display','thumbnail'])}))
if __name__=='__main__':main()
