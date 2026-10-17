"""Lossless, sequence-addressable pages of the owner's selected character pixels.

Reads only explicit selected records. It never rescales, changes native animation
tables, or publishes. Each cropped RGBA frame is checked again after WebP decode.
"""
import argparse,copy,hashlib,json,math,subprocess
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
MAX_PAGE=2048
PAD=1
def digest(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_text('utf8'))
def write(p,d):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(d,separators=(',',':'),ensure_ascii=False)+'\n',encoding='utf8',newline='\n')

def pages(rows):
    """Bounded, deterministic shelf packing, retaining the original trim boxes."""
    todo=sorted(rows.items(),key=lambda kv:(-kv[1]['frame']['h'],-kv[1]['frame']['w'],kv[0]))
    current=[];x=y=row_h=used_w=0
    for key,row in todo:
        w,h=row['frame']['w']+2*PAD,row['frame']['h']+2*PAD
        if max(w,h)>MAX_PAGE:raise ValueError('FRAME_EXCEEDS_PAGE_LIMIT:'+key)
        if x+w>MAX_PAGE:x=0;y+=row_h;row_h=0
        if y+h>MAX_PAGE:
            yield math.ceil(used_w/16)*16,math.ceil((y+row_h)/16)*16,current
            current=[];x=y=row_h=used_w=0
        current.append((key,x+PAD,y+PAD));x+=w;row_h=max(row_h,h);used_w=max(used_w,x)
    if current:yield math.ceil(used_w/16)*16,math.ceil((y+row_h)/16)*16,current

def build(config,selection,build,source_root):
    source=(config.get('assetRoot') or selection['root'])+config['folder']+'/'
    def source_bytes(name):
        rel=source+name;expected=build[rel]
        for p in dict.fromkeys([source_root/rel,ROOT/rel]):
            if p.is_file():
                b=p.read_bytes()
                if len(b)==expected['bytes'] and digest(b)==expected['sha256']:return b
        raise ValueError('UNVERIFIED_PUBLIC_INPUT:'+rel)
    raw=source_bytes('runtime.review.json');runtime=json.loads(raw)
    atlas=runtime['sides']['main']['atlases']
    if len(atlas)!=1:raise ValueError('SOURCE_MULTI_ATLAS_REQUIRES_EXPLICIT_SUPPORT:'+config['entityId'])
    original=json.loads(source_bytes(atlas[0]['data']));image_bytes=source_bytes(atlas[0]['image'])
    import io
    image=Image.open(io.BytesIO(image_bytes)).convert('RGBA')
    version=digest(raw)[:16]
    relative=source+'ranch-streaming-v1/'+version+'/'
    target=ROOT/relative;target.mkdir(parents=True,exist_ok=True)
    remaining=set(original['frames']);sequence_groups=[]
    for seq in runtime['sides']['main']['animations']:
        keys=list(dict.fromkeys(f['texture'] for f in seq['frames'] if f['texture'] in remaining))
        if keys:sequence_groups.append(keys);remaining.difference_update(keys)
    # Nearby raw sequences share a modest page, avoiding one request per pose.
    # Eggs retain separate idle/hatch groups. No sequence entry is rewritten.
    groups=[];stride=1 if len(runtime['sides']['main']['animations'])<=4 else 4
    for i in range(0,len(sequence_groups),stride):groups.append([k for g in sequence_groups[i:i+stride] for k in g])
    if remaining:groups.append(sorted(remaining))
    previous=read(target/'runtime.review.json') if (target/'runtime.review.json').exists() else None
    records=[];mapping={};frame_hashes={}
    for group in groups:
        for width,height,placements in pages({k:original['frames'][k] for k in group}):
            data=copy.deepcopy(original);data['frames']={};canvas=Image.new('RGBA',(width,height))
            for key,x,y in placements:
                old=original['frames'][key];f=old['frame'];cell=image.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
                canvas.paste(cell,(x,y));updated=copy.deepcopy(old);updated['frame'].update(x=x,y=y);data['frames'][key]=updated
                frame_hashes[key]=digest(cell.tobytes())
            temporary=target/'page.pending.webp';canvas.save(temporary,'WEBP',lossless=True,exact=True,method=4)
            packed_bytes=temporary.read_bytes();name='main-'+digest(packed_bytes)[:16]+'.webp';temporary.replace(target/name)
            data['meta'].update(image=name,size={'w':width,'h':height});encoded=(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n').encode('utf8');data_name='main-'+digest(encoded)[:16]+'.json';(target/data_name).write_bytes(encoded)
            with Image.open(target/name) as decoded:
                decoded=decoded.convert('RGBA')
                for key,row in data['frames'].items():
                    f=row['frame'];pixels=decoded.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
                    if digest(pixels)!=frame_hashes[key]:raise ValueError('PACKED_RGBA_DRIFT:'+key)
                    normalized=copy.deepcopy(row);normalized['frame']=original['frames'][key]['frame']
                    if normalized!=original['frames'][key]:raise ValueError('PACKED_FRAME_CONTRACT_DRIFT:'+key)
                    mapping[key]=len(records)
            records.append({'data':data_name,'image':name,'width':width,'height':height,'bytes':len(packed_bytes),'dataSha256':digest(encoded),'imageSha256':digest(packed_bytes)})
    updated=copy.deepcopy(runtime);updated['sides']['main']['atlases']=[{'data':r['data'],'image':r['image']} for r in records]
    for a in updated['sides']['sub']['atlases']:
        for key in ['data','image']:a[key]='../../'+a[key]
    updated['streaming']={'schemaVersion':1,'side':'main','texturePages':mapping,'pages':records,'sourceRuntimeSha256':digest(raw),'sourceImageSha256':digest(image_bytes)}
    write(target/'runtime.review.json',updated)
    if previous and previous.get('streaming',{}).get('sourceRuntimeSha256')==digest(raw):
        kept={r[k] for r in records for k in ['data','image']}
        for page in previous.get('streaming',{}).get('pages',[]):
            for key in ['data','image']:
                name=page[key];old_path=(target/name).resolve()
                if name not in kept and old_path.parent==target.resolve():old_path.unlink(missing_ok=True)
    for side in ['main','sub']:
        if updated['sides'][side]['animations']!=runtime['sides'][side]['animations']:raise ValueError('ANIMATION_DRIFT')
    for key in ['artProfile','reviewGeometry','timing','sourceBankSha256','motionContractSha256']:
        if updated.get(key)!=runtime.get(key):raise ValueError('RUNTIME_CONTRACT_DRIFT:'+key)
    return {'entityId':config['entityId'],'sourceRuntimeSha256':digest(raw),'sourceImageSha256':digest(image_bytes),'runtimePath':relative+'runtime.review.json','runtimeSha256':digest((target/'runtime.review.json').read_bytes()),'frameCount':len(mapping),'pageCount':len(records),'sourceBytes':len(image_bytes),'packedBytes':sum(r['bytes'] for r in records),'sourceRgbaBytes':image.width*image.height*4,'packedRgbaBytes':sum(r['width']*r['height']*4 for r in records),'framePixelHashes':frame_hashes}

def main():
    p=argparse.ArgumentParser();p.add_argument('--entities',nargs='+');p.add_argument('--all-selected',action='store_true');p.add_argument('--input-root',type=Path,default=ROOT);p.add_argument('--public-build',type=Path,required=True);args=p.parse_args()
    selection=read(ROOT/'src/data/championship/accepted-original-character-selection.r1.json');files={r['path']:r for r in read(args.public_build)['files']}
    if not args.entities and not args.all_selected:p.error('Choose explicit --entities or --all-selected')
    configs=selection['characters'] if args.all_selected else [next(c for c in selection['characters'] if c['entityId']==e) for e in args.entities]
    records=[]
    for c in configs:
        r=build(c,selection,files,args.input_root);records.append(r);print(json.dumps({k:r[k] for k in ['entityId','frameCount','pageCount','sourceBytes','packedBytes']}),flush=True)
    species_by_entity={c['entityId']:c['speciesId'] for c in configs}
    manifest={'schemaVersion':1,'scope':'Lossless sequence-addressable derivative of exact public owner-selected pixels; publication pending normal release review','characters':[{**{k:r[k] for k in ['entityId','sourceRuntimeSha256','sourceImageSha256','runtimePath','runtimeSha256']},'speciesId':species_by_entity[r['entityId']]} for r in records]}
    write(ROOT/'src/data/championship/ranch-streaming-selection.r1.json',manifest)
    write(ROOT/'reports/loading-first-frames-20261017/packing-verification.json',{'sourcePublicCommit':read(args.public_build)['commit'],'framesVerified':sum(r['frameCount'] for r in records),'characters':records})
if __name__=='__main__':main()
