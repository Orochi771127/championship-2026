"""Append four exact original revisions confirmed by the owner in this session."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SOURCES={140:('libfile_f6ce63e83f1881919ebce2285bc3c927','81b361ae2c8a3cccae307554cba55334146544fbc8a30a92a20e70dfa4e8f3ed','v3'),
171:('libfile_b4d93bff2ce48191ae2a41b679f8acab','77e05781e2ae3b609b29b3154f491f8f691998f95a7fa31fb07b8b06856c8baa','confirmed-original'),
172:('libfile_e3f6675169048191a7ef423903d07282','9329adfcc317be8e42e23eb522199a4d96e954c101b028c80fc56a72565e7080','confirmed-original')}
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf8'))
def write(p,j):
 target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--masters',type=Path,required=True);args=parser.parse_args()
 hp='src/data/championship/database-hero-portraits.public.v1.json';ip='assets/production/PUBLIC_RUNTIME_INDEX.json';ap='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';bp='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
 heroes,index,allow,inputs=map(read,[hp,ip,ap,bp]);assert len(heroes['entries'])==188
 identities=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getDatabaseDisplayEntry as get}from './src/championship/database/databaseDisplayCatalog.js';console.log(JSON.stringify([140,171,172].map(get)))"],cwd=ROOT,text=True,encoding='utf8'))
 manifest={'baseCommit':'84a537240db5f97ea16801838893749908cce186','priorEntriesSha256':sha(json.dumps(heroes['entries'],ensure_ascii=False,separators=(',',':')).encode()),'entries':[]}
 for identity in identities:
  n=identity['speciesIndex'];lib,expected,version=SOURCES[n];source=args.masters/f'{n}-approved.png';data=source.read_bytes();assert sha(data)==expected
  approval={'status':'owner_approved','messageIds':['Sentinel_24da216c09388191bc6efb41ecb9e45e','Sentinel_ed3a6a45a20081919cbb7eaf175fb838']if n==140 else['Sentinel_626f2dcbfd608191bb60061488184aa5'],'contextMessageId':'Sentinel_ab6654203538819189a323a84e21a5bb'if n==140 else'Sentinel_39d205fd2a8c8191be0bd14c05a3cffa','ownerQuote':'可以以後再繼續下一批'if n==140 else'對那個是定稿的版本','scope':'Exact 140 v3 delivered 2026-10-17 08:47:50 UTC; later angle correction was for136, not140. Old awaiting label is superseded by recovered batch approval.'if n==140 else'Exact existing original displayed for AW43/171 and AW44/172, identified by these Library IDs; no redesign.'}
  original=Image.open(source).convert('RGBA');row={k:identity[k]for k in['speciesIndex','speciesId','displayCode']};record={**row,'master':{'path':str(source.resolve()),'libraryFileId':lib,'sha256':expected,'version':version,'dimensions':list(original.size)},'approval':approval,'purpose':'EXACT_APPROVED_ORIGINAL_SINGLE_IMAGE_ONLY'}
  record['master']['bytes']=len(data)
  if n==140:
   record['master']['deliveredAtUtc']='2026-10-17T08:47:50Z';record['approval']['followupMessageId']='Sentinel_bf47c2563d9481918498b2bb0a4f7368'
  else:
   record['master'].update({'libraryVersion':0,'fileId':'file_00000000f2b081f5a670ce4b3c3f8282'if n==171 else'file_000000000cb081f596a5ef28ae7efee8','sourceFileName':'exec-44a1b22c-8194-4ad6-aa61-1bb1900ffb0b.png'if n==171 else'exec-25f34b19-49e8-4fff-873d-e814ecc50e85.png'})
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
 write(ap,allow);write(bp,inputs);write('docs/art/production/characters/approved-dex-140171172-20261020/manifest.json',manifest)
 print(json.dumps({'added':list(SOURCES),'total':len(heroes['entries']),'bytes':sum(r[k]['bytes']for r in manifest['entries']for k in['display','thumbnail'])}))
if __name__=='__main__':main()
