import copy, hashlib, json, math, sys
from pathlib import Path
from PIL import Image

ROOT=Path('assets/production/characters/battle-packed-20261013')
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
selection=json.loads(Path('src/data/championship/accepted-original-character-selection.r1.json').read_text())
if '--check' in sys.argv:
    manifest=json.loads((ROOT/'manifest.json').read_text());checked=0
    for record in manifest['characters']:
        source=Path(selection['root'])/record['sourceFolder'];target=ROOT/record['entity']
        assert sha(source/'main.webp')==record['sourceImageSha256']
        old=json.loads((source/'main.json').read_text());runtime=json.loads((target/'runtime.review.json').read_text())
        baseline=json.loads((source/'runtime.review.json').read_text())
        for key in ('entityId','artProfile','timing','reviewGeometry','sourceBankSha256','motionContractSha256'):
            assert runtime[key]==baseline[key],('runtime drift',key)
        for side in ('main','sub'):assert runtime['sides'][side]['animations']==baseline['sides'][side]['animations']
        seen=set()
        with Image.open(source/'main.webp') as image:
            for page in record['pages']:
                assert sha(target/page['image'])==page['imageSha256'];assert sha(target/page['data'])==page['dataSha256']
                data=json.loads((target/page['data']).read_text())
                with Image.open(target/page['image']) as new:
                    assert [new.width,new.height]==[page['width'],page['height']]
                    for key,row in data['frames'].items():
                        assert key not in seen;seen.add(key)
                        original=old['frames'][key];f=original['frame'];n=row['frame']
                        before=image.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
                        after=new.crop((n['x'],n['y'],n['x']+n['w'],n['y']+n['h'])).tobytes()
                        assert before==after and hashlib.sha256(before).hexdigest()==record['framePixelHashes'][key]
                        check=copy.deepcopy(row);check['frame']=f;assert check==original;checked+=1
        assert seen==set(old['frames'])
    print(json.dumps({'verifiedFrames':checked,'pixelAndRuntimeContracts':'PASS'}));sys.exit(0)
ROOT.mkdir(parents=True,exist_ok=True)
MAX=2048;PAD=1
def overlap(a,b):
    x,y,w,h=a;u,v,s,t=b
    return x<u+s and u<x+w and y<v+t and v<y+h
def contains(a,b):
    x,y,w,h=a;u,v,s,t=b
    return x<=u and y<=v and x+w>=u+s and y+h>=v+t
def pack(frames,sort):
    remaining=sorted([(key,r['frame']['w']+2*PAD,r['frame']['h']+2*PAD) for key,r in frames.items()],key=sort)
    pages=[]
    while remaining:
        free=[(0,0,MAX,MAX)];placed=[]
        while True:
            candidates=[]
            for i,(key,w,h) in enumerate(remaining):
                for x,y,fw,fh in free:
                    if w<=fw and h<=fh:candidates.append(((min(fw-w,fh-h),max(fw-w,fh-h),y,x,key),i,(x,y,w,h)))
            if not candidates:break
            _,index,rect=min(candidates);key,w,h=remaining.pop(index);placed.append((key,rect))
            x,y,w,h=rect;split=[]
            for fx,fy,fw,fh in free:
                f=(fx,fy,fw,fh)
                if not overlap(f,rect):split.append(f);continue
                if x>fx:split.append((fx,fy,x-fx,fh))
                if x+w<fx+fw:split.append((x+w,fy,fx+fw-x-w,fh))
                if y>fy:split.append((fx,fy,fw,y-fy))
                if y+h<fy+fh:split.append((fx,y+h,fw,fy+fh-y-h))
            unique=list(dict.fromkeys(split))
            free=[r for i,r in enumerate(unique) if not any(i!=j and contains(other,r) for j,other in enumerate(unique))]
        if not placed:raise RuntimeError('Frame exceeds page limit')
        width=math.ceil(max(x+w for _,(x,y,w,h) in placed)/16)*16
        height=math.ceil(max(y+h for _,(x,y,w,h) in placed)/16)*16
        pages.append((width,height,placed))
    return pages

records=[]
for species in (189,212,207,210,177,190):
    c=next(c for c in selection['characters'] if c['speciesId']==f'species-{species}')
    folder=Path(selection['root'])/c['folder'];atlas=json.loads((folder/'main.json').read_text())
    records.append({'species':c['speciesId'],'entity':c['entityId'],'folder':str(folder),'sourceFolder':c['folder'],
        'baseRgbaBytes':atlas['meta']['size']['w']*atlas['meta']['size']['h']*4,'compressedBytes':(folder/'main.webp').stat().st_size})
reports=[]
for record in records:
    folder=Path(record['folder']);original=json.loads((folder/'main.json').read_text())
    candidates=[pack(original['frames'],sort) for sort in (lambda r:(-r[1]*r[2],r[0]),lambda r:(-max(r[1],r[2]),-r[1]*r[2],r[0]))]
    pages=min(candidates,key=lambda ps:sum(w*h for w,h,_ in ps))
    target=ROOT/record['entity'];target.mkdir(exist_ok=True)
    page_info=[];verified=0;frame_hashes={}
    with Image.open(folder/'main.webp') as source:
        source.load()
        for index,(width,height,placements) in enumerate(pages):
            image=Image.new('RGBA',(width,height),(0,0,0,0));data=copy.deepcopy(original);data['frames']={}
            for key,(x,y,w,h) in placements:
                row=original['frames'][key];f=row['frame'];cell=source.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
                image.paste(cell,(x+PAD,y+PAD));updated=copy.deepcopy(row);updated['frame']['x']=x+PAD;updated['frame']['y']=y+PAD;data['frames'][key]=updated
            name=f'main-{index:02}.webp';data['meta'].update(image=name,size={'w':width,'h':height})
            image.save(target/name,'WEBP',lossless=True,exact=True,method=4)
            (target/f'main-{index:02}.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
            with Image.open(target/name) as decoded:
                decoded.load()
                for key,row in data['frames'].items():
                    old=original['frames'][key];f=old['frame'];n=row['frame']
                    before=source.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
                    after=decoded.crop((n['x'],n['y'],n['x']+n['w'],n['y']+n['h'])).tobytes()
                    assert before==after,('pixel drift',key)
                    frame_hashes[key]=hashlib.sha256(before).hexdigest()
                    check=copy.deepcopy(row);check['frame']=old['frame'];assert check==old,('frame contract drift',key)
                    verified+=1
            data_name=f'main-{index:02}.json'
            page_info.append({'image':name,'data':data_name,'width':width,'height':height,'rgbaBytes':width*height*4,
                'compressedBytes':(target/name).stat().st_size,'imageSha256':sha(target/name),'dataSha256':sha(target/data_name)})
    runtime=json.loads((folder/'runtime.review.json').read_text())
    runtime['sides']['main']['atlases']=[{'image':p['image'],'data':p['data']} for p in page_info]
    for atlas in runtime['sides']['sub']['atlases']:
        for key in ('image','data'):atlas[key]='../../accepted-20261010/'+record['sourceFolder']+'/'+atlas[key]
    (target/'runtime.review.json').write_text(json.dumps(runtime,separators=(',',':'))+'\n')
    result={'species':record['species'],'entity':record['entity'],'oldRgbaBytes':record['baseRgbaBytes'],'newRgbaBytes':sum(p['rgbaBytes'] for p in page_info),
        'oldCompressedBytes':record['compressedBytes'],'newCompressedBytes':sum(p['compressedBytes'] for p in page_info),'verifiedFrames':verified,'pages':page_info,
        'unchangedContract':'all frame fields except atlas x/y; original w/h, sourceSize, spriteSourceSize, pivot, rotation and trim retained',
        'sourceFolder':record['sourceFolder'],'sourceImageSha256':sha(folder/'main.webp'),'sourceDataSha256':sha(folder/'main.json'),
        'runtimeSha256':sha(target/'runtime.review.json'),'framePixelHashes':frame_hashes}
    reports.append(result);print(json.dumps({k:v for k,v in result.items() if k!='framePixelHashes'}),flush=True)
summary={'oldRgbaMiB':sum(r['oldRgbaBytes'] for r in reports)/1048576,'newRgbaMiB':sum(r['newRgbaBytes'] for r in reports)/1048576,
    'oldCompressedMiB':sum(r['oldCompressedBytes'] for r in reports)/1048576,'newCompressedMiB':sum(r['newCompressedBytes'] for r in reports)/1048576,
    'verifiedFrames':sum(r['verifiedFrames'] for r in reports),'records':reports}
manifest={'schemaVersion':1,'assetId':'art:characters:battle-packed:20261013','root':ROOT.as_posix()+'/',
    'scope':'Only six approved tutorial Battle species; lossless repack of all Main frames, no scale/timing/gameplay change',
    'ownerAuthorization':'Owner delegated six-character lossless Battle atlas integration and publication after pixel/frame/runtime validation.',
    'rightsDocumentVerified':False,'commercialReleaseAccepted':False,'measurement':'RGBA8_BASE_ESTIMATE_NOT_GPU_USAGE',
    **{k:v for k,v in summary.items() if k!='records'},'characters':reports}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='records'}),flush=True)
