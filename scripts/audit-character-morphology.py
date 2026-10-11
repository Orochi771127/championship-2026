"""Read-only catalog audit; builds a blocked, hash-pinned morphology review queue.

Reuses donor inventories and the existing Main/Sub audit. Never submits jobs,
infers limbs from filenames, approves art, or changes source artwork.
"""
import argparse
import ast
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'docs/art/production/characters/appearance-refresh-v1'

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig')) if p.is_file() else None

def rows(p):
    with p.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def write(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def audit(source, output):
    source = source.resolve(); output = output.resolve()
    if output.exists() or output.is_relative_to(source):
        raise ValueError('USE_NEW_OUTPUT_OUTSIDE_SOURCE_TREE')
    files = sorted(p for p in source.rglob('*') if p.is_file())
    manifest=[]; issues=[]; documents=[]
    for p in files:
        item={'path':str(p.relative_to(source)), 'bytes':p.stat().st_size, 'sha256':sha(p)}
        try:
            ext=p.suffix.lower()
            if ext=='.png':
                with Image.open(p) as im:
                    im.load();item.update(size=list(im.size),mode=im.mode)
            elif ext=='.csv':
                data=rows(p);item.update(rows=len(data),columns=list(data[0]) if data else [])
            elif ext=='.json':
                data=read(p);item.update(jsonType=type(data).__name__,entries=len(data) if isinstance(data,(list,dict)) else None)
            elif ext in ('.md','.py','.txt'):
                text=p.read_text(encoding='utf-8-sig');item['lines']=len(text.splitlines())
                documents.append({'path':item['path'],'content':text})
                if ext=='.py':ast.parse(text)
            elif ext=='.xlsx':
                with ZipFile(p) as z:
                    xml=[n for n in z.namelist() if n.endswith('.xml')]
                    for n in xml:ElementTree.fromstring(z.read(n))
                    item['xmlPartsParsed']=len(xml)
            item['readStatus']='READ_AND_PARSED'
        except Exception as error:
            item['readStatus']='ERROR';issues.append({'path':item['path'],'error':str(error)})
        manifest.append(item)
    index=source/'10_原作對應主索引.csv';catalog=rows(index)
    if len(catalog)!=224 or len({r['entityId'] for r in catalog})!=224:
        raise ValueError('ROSTER_IDENTITY_DRIFT')
    reuse=read(source/'224角色_Main_Sub_審核/14_給生產管線的重用審核.json')
    reused={r['entityId']:r for r in reuse['entities']}
    oversize=rows(source/'224角色_Main_Sub_審核/13_原生超過64像素格.csv')
    oversize_ids={r['entityId'] for r in oversize}
    queue=[];candidate_paths=set()
    for r in catalog:
        eid=r['entityId'];donor=PACK/'donor-review-v1'/eid
        inv=read(donor/'inventory.json');review=read(donor/'review.json')
        chosen=source/r['正式選定稿'] if r['正式選定稿'] else None
        candidates=[p.strip() for p in r['全部候選'].split('|') if p.strip()]
        candidate_paths.update(candidates)
        for rel in candidates:
            p=(source/rel).resolve()
            if not p.is_relative_to(source) or not p.is_file():issues.append({'entityId':eid,'missingCandidate':rel})
        blockers=['MORPHOLOGY_COMPATIBILITY_REVIEW_REQUIRED']
        if not chosen or not chosen.is_file():blockers.append('CONCEPT_SELECTION_REQUIRED')
        if not inv:blockers.append('DONOR_INVENTORY_REQUIRED')
        if not review or review.get('status')!='PASS_DONOR_REVIEW':blockers.append('FULL_DONOR_VISUAL_REVIEW_REQUIRED')
        if eid in oversize_ids:blockers.append('NATIVE_OVER_64_GEOMETRY_EXCEPTION')
        if eid=='m002_choromon':blockers.append('OWNER_REJECTED_TALL_BELL_FOR_LOW_BODY')
        metrics={}
        if inv:
            for key,v in inv['slots'].items():
                b=v.get('visibleBounds')
                if b:metrics[key]={'boundsFromOrigin':b,'width':b[2]-b[0],'height':b[3]-b[1],'canonical':v['canonical'],'translation':v['translation']}
        bounds=metrics.get('main/cell_000',{})
        ratio=bounds.get('width',0)/max(1,bounds.get('height',0))
        # Only a queue prefilter. A cell000 aspect ratio is NOT anatomical truth.
        envelope='wide' if ratio>1.35 else 'tall' if 0<ratio<.75 else 'balanced'
        rr=reused.get(eid,{})
        queue.append({'entityId':eid,'family':r['種族'],'generation':r['世代'],
          'selectedConcept':{'path':str(chosen),'sha256':sha(chosen)} if chosen and chosen.is_file() else None,
          'candidatePaths':candidates,'inventory':{'path':str(donor/'inventory.json'),'sha256':sha(donor/'inventory.json')} if inv else None,
          'donorReviewStatus':review.get('status') if review else 'MISSING',
          'donorCharacterNotes':review.get('character',{}) if review else {},
          'sourceOrigin':inv.get('sourceOrigin') if inv else None,'sourceCounts':inv.get('counts') if inv else None,
          'poseMetrics':metrics,'prefilterGroup':r['世代']+'|'+r['種族']+'|'+envelope,
          'prefilterIsMorphologyApproval':False,'anatomyClass':'REQUIRES_VISUAL_CONFIRMATION',
          'subReuseResult':rr.get('subReuseResult'),'subExceptions':[p['subCell'] for p in rr.get('subCellsPlan',[]) if p['classification']!='EXACT_PIXELS_AND_ORIGIN'],
          'status':'BLOCKED_MORPHOLOGY_REVIEW','blockers':blockers,'eligibleForPaidGeneration':False})
    output.mkdir(parents=True)
    write(output/'files.json',manifest);write(output/'documents-read.json',documents)
    write(output/'morphology-queue.json',{'schemaVersion':1,'sourceIndexSha256':sha(index),'entries':queue,'newPaidSubmissions':0})
    summary={'source':str(source),'filesRead':len(files),'directoriesRead':len(list(source.rglob('*')))-len(files),
      'extensions':dict(Counter(p.suffix.lower() for p in files)),'fileReadErrors':issues,
      'entities':len(queue),'selectedConcepts':sum(bool(r['selectedConcept']) for r in queue),
      'uniqueCandidatePaths':len(candidate_paths),'unassignedDonorRows':len(rows(source/'13_未指定donor.csv')),
      'donorReviewStatuses':dict(Counter(r['donorReviewStatus'] for r in queue)),
      'nativeOver64Entities':len(oversize_ids),'nativeOver64Slots':len(oversize),
      'subClassificationsRecomputedFromRows':dict(Counter(r['classification'] for r in rows(source/'224角色_Main_Sub_審核/02_Sub逐格對應Main.csv'))),
      'groups':dict(Counter(r['prefilterGroup'] for r in queue)),
      'visualReviewScope':'Contact sheets are review aids, not automatic visual approval; anatomy remains explicitly unreviewed.',
      'rawRomRedecodePerformed':False,'creditsSpent':0}
    write(output/'summary.json',summary)
    font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',14)
    pictures=sorted(p for p in source.rglob('*.png') if not p.relative_to(source).parts[0] in ('生成成果','224角色_Main_Sub_審核'))
    pages=[]
    for page in range(0,len(pictures),20):
        board=Image.new('RGB',(1600,1650),'#e8ecf0');draw=ImageDraw.Draw(board);members=[]
        for i,p in enumerate(pictures[page:page+20]):
            im=Image.open(p).convert('RGB');im.thumbnail((310,360))
            x=(i%5)*320;y=(i//5)*412;board.paste(im,(x+(320-im.width)//2,y))
            label=str(p.relative_to(source));draw.text((x+4,y+363),label[:32],font=font,fill='black');draw.text((x+4,y+384),label[32:64],font=font,fill='black');members.append(label)
        name=f'concept-contact-{page//20+1:02}.jpg';board.save(output/name,quality=90);pages.append({'page':name,'files':members})
    write(output/'contact-index.json',pages)
    print(json.dumps({k:v for k,v in summary.items() if k!='groups'},ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=ROOT.parent/'自創腳色');p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();audit(a.source,a.output)
