"""Connect three owner-approved equipped edits with padded contain derivatives."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SOURCES={159:('libfile_ced993054f708191b1becc34d000bd58','c5111cf1720479b220dcd3eec6bb85c5bfc30e48fc14080d187aa3e4f1ea9371','equipped-v1-approved'),160:('libfile_d09f3751c9688191b6689bd18924acf8','a840927493e4ee09a2591d7ccdf4e7bfc3ac4915945fb0f612a13e53a42045bd','equipped-v1-approved'),162:('libfile_0673347901fc8191bc5f495b9596646d','c5e88262e3fc761bcf928a9f68b03690909a6443e27de724054b55108733a69e','equipped-v1-approved')}
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf8'))
def write(p,j):
 target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--masters',type=Path,required=True);args=parser.parse_args()
 hp='src/data/championship/database-hero-portraits.public.v1.json';ip='assets/production/PUBLIC_RUNTIME_INDEX.json';ap='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';bp='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
 heroes,index,allow,inputs=map(read,[hp,ip,ap,bp]);assert len(heroes['entries'])==191
 identities=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getDatabaseDisplayEntry as get}from './src/championship/database/databaseDisplayCatalog.js';console.log(JSON.stringify([159,160,162].map(get)))"],cwd=ROOT,text=True,encoding='utf8'))
 manifest={'baseCommit':'4ff116e263625b00a5e21b52af6e61b70ff143f9','priorEntriesSha256':sha(json.dumps(heroes['entries'],ensure_ascii=False,separators=(',',':')).encode()),'entries':[]}
 for identity in identities:
  n=identity['speciesIndex'];lib,expected,version=SOURCES[n];source=args.masters/f'{n}-approved.png';data=source.read_bytes();assert sha(data)==expected
  approval={'status':'owner_approved_equipped_for_dex','messageId':'Sentinel_de491859e2f081918d538a162a8f91fb','contextMessageId':'Sentinel_d1ddde2a6b388191998846ce13ec3f08','ownerQuote':'好，可以上圖鑑了','bodyOnlyPriorApprovalId':'Sentinel_0f7cc91128e0819186506ecf5789edf0','scope':{159:'Long-handled scythe',160:'Floating satellite modules and ring formation; no handheld weapon',162:'White platinum blue long spear'}[n],'generatedEditBodyPixelParityClaim':False}
  original=Image.open(source).convert('RGBA');clean=original.copy();clean.putalpha(clean.getchannel('A').point([0 if value<=8 else value for value in range(256)]))
  row={k:identity[k]for k in['speciesIndex','speciesId','displayCode']};record={**row,'master':{'path':str(source.resolve()),'libraryFileId':lib,'sha256':expected,'version':version,'dimensions':list(original.size),'bytes':len(data),'libraryVersion':0},'approval':approval,'normalization':{'sourceMasterUntouched':True,'alphaNoiseThresholdBeforeResize':8,'wholeCanvasContain':True,'cropApplied':False,'bodyRepaintingApplied':False,'generatedEditBodyPixelParityClaim':False},'purpose':'OWNER_APPROVED_EQUIPPED_GENERATED_EDIT_DISPLAY'}
  file_records={159: ('file_000000009bc081f5b5d4d715c7ba4d42', 'species-159_幽幕死神_裝備圖鑑候選_v1_待確認.png'), 160: ('file_00000000a62c81f5ad63258aa6aafca9', 'species-160_星界入侵體_裝備圖鑑候選_v1_待確認.png'), 162: ('file_00000000431881f581fb806bfe036ee5', 'species-162_耀裁天使_裝備圖鑑候選_v1_待確認.png')}
  record['master'].update({'fileId':file_records[n][0],'sourceFileName':file_records[n][1]})
  for kind,size,pad in[('display',768,16),('thumbnail',96,4)]:
   body=clean.copy();body.thumbnail((size-pad*2,size-pad*2),Image.Resampling.LANCZOS);image=Image.new('RGBA',(size,size));image.paste(body,((size-body.width)//2,(size-body.height)//2));dest=ROOT/f'assets/production/database-repair-20261019/species-{n}.{kind}.webp';image.save(dest,format='WEBP',lossless=kind=='thumbnail',quality=90,alpha_quality=100,method=6,exact=True)
   encoded=dest.read_bytes();decoded=Image.open(dest).convert('RGBA');assert decoded.getchannel('A').tobytes()==image.getchannel('A').tobytes()
   if kind=='thumbnail':assert decoded.tobytes()==image.tobytes()
   hashed=dest.with_name(dest.stem+'.'+sha(encoded)[:16]+'.webp');dest.rename(hashed);relative=hashed.relative_to(ROOT).as_posix();media={'src':relative,'width':image.width,'height':image.height,'sha256':sha(encoded)};record[kind]={**media,'bytes':len(encoded),'alphaExactlyMatchesNormalizedContain':True,'paddingPx':pad,'normalizedAlphaBBox':list(image.getchannel('A').getbbox())}
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
 write(ap,allow);write(bp,inputs);write('docs/art/production/characters/approved-equipped-159160162-20261020/manifest.json',manifest)
 print(json.dumps({'added':list(SOURCES),'total':len(heroes['entries']),'bytes':sum(r[k]['bytes']for r in manifest['entries']for k in['display','thumbnail'])}))
if __name__=='__main__':main()
