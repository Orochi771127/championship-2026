"""Hash-bound original-character sheet jobs using the existing bank assembler.

One approved character at a time. Generation is an explicit separate tool call.
"""
import argparse
import importlib.util
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
    s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
D=module('donor_gate','character-donor-review.py');M=module('sheet_assembler','m001-full-sheet.py');P=D.P
JOBS=P.PACK/'sheet-jobs-v1'
ENTITY='m002_choromon'

def inputs():
    pilot=P.WORK/'full-sheet-r05/acceptance.json';a=P.read(pilot)
    P.require(a['status']=='PASS_M001_LOCAL_VERTICAL_SLICE' and a['nextEntityAllowed'],'M001_GATE_CLOSED')
    P.require(P.sha((P.WORK/'full-sheet-r05/compiled-final/bank.json').read_bytes())==a['sourceBankSha256'],'M001_ACCEPTANCE_STALE')
    D.validate(ENTITY)
    inv=P.read(D.BASE/ENTITY/'inventory.json');setting=P.read(P.PACK/'pixel-v2/settings'/ENTITY/'setting.json')
    return inv,setting,pilot

def prepare():
    inv,setting,pilot=inputs();origin=inv['sourceOrigin'];palette=P.PIXEL.parse_palette(setting['palette'])
    seeds={p['key']:P.place_authored(p,palette,origin) for p in setting['poses']}
    derived={'main/cell_047':{'base':'main/cell_044','operation':'black_with_original_teal_marks'},
             'main/cell_048':{'base':'main/cell_000','operation':'black_with_original_teal_marks'},
             'main/cell_061':{'base':'main/cell_010','operation':'grayscale'},
             'main/cell_064':{'base':'main/cell_000','operation':'white'}}
    keys=[k for k,r in inv['slots'].items() if k==r['canonical'] and k not in seeds and k not in derived]
    P.require(len(keys)==44 and len(seeds)==3,'M002_COVERAGE_CHANGED')
    job={'schemaVersion':1,'entityId':ENTITY,'grid':[8,6],'keys':keys,'blankPanels':list(range(44,48)),
         'retainedMasters':list(seeds),'derived':derived,'sourceOrigin':origin,'palette':setting['palette'],
         'inventorySha256':P.sha((D.BASE/ENTITY/'inventory.json').read_bytes()),
         'reviewSha256':P.sha((D.BASE/ENTITY/'review.json').read_bytes()),'pilotAcceptanceSha256':P.sha(pilot.read_bytes()),
         'designSha256':inv['designSha256'],'runtimeEligible':False,'artReview':'PENDING',
         'normalization':{'perCellScale':False,'bboxRecenter':False,'nativeCanvas':[64,64]}}
    identity=Image.new('RGBA',(768,256))
    for n,(k,im) in enumerate(seeds.items()):identity.alpha_composite(im.resize((256,256),Image.Resampling.NEAREST),(n*256,0))
    P.SOURCE.publish({'job.json':P.encoded(job),'original-identity.png':P.PIXEL.png_bytes(identity)},JOBS/ENTITY/'input',False)
    archive=ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK';doc=P.read(archive/'08_FULL_FAMILY_CONVERSION/digimon'/f'{ENTITY}_main/cells.json')
    raw=P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon',ENTITY+'_main',doc)
    sheet=Image.new('RGBA',(1536,1152));labels=Image.new('RGBA',sheet.size);draw=ImageDraw.Draw(labels)
    for n,k in enumerate(keys):
        im,_=P.SOURCE.render_native(doc['cells'][int(k[-3:])],raw);b=inv['slots'][k]['nativeBounds'];c=Image.new('RGBA',(64,64));c.alpha_composite(im,(origin[0]+b[0],origin[1]+b[1]))
        xy=(n%8*192,n//8*192);sheet.alpha_composite(c.resize((192,192),Image.Resampling.NEAREST),xy)
        draw.text((xy[0]+3,xy[1]+3),f'{n}: {k}',fill='black')
    labeled=Image.new('RGBA',sheet.size,'#e9ebee');labeled.alpha_composite(sheet);labeled.alpha_composite(labels)
    P.SOURCE.publish({'pose-guide.png':P.PIXEL.png_bytes(sheet),'pose-guide-labeled.png':P.PIXEL.png_bytes(labeled)},ROOT.parent/'_archive/character-sheet-jobs-v1'/ENTITY,False)
    print('READY:44 generated panels +3 retained +4 derived =51 masters /83 slots; generation NOT submitted')

def import_sheet(source,output,sample_size=64,offset=(0,0),repair_path=None):
    inv,setting,pilot=inputs();job=P.read(JOBS/ENTITY/'input/job.json')
    P.require(job['inventorySha256']==P.sha((D.BASE/ENTITY/'inventory.json').read_bytes()) and job['reviewSha256']==P.sha((D.BASE/ENTITY/'review.json').read_bytes()) and job['designSha256']==inv['designSha256'],'JOB_INPUT_DRIFT')
    P.require(job['pilotAcceptanceSha256']==P.sha(pilot.read_bytes()),'PILOT_ACCEPTANCE_DRIFT')
    palette=P.PIXEL.parse_palette(setting['palette']);im=Image.open(source).convert('RGBA');cols,rows=job['grid'];ox,oy=offset
    P.require(abs(im.width/im.height-cols/rows)<.03,'SHEET_GRID_ASPECT_DRIFT');P.require(im.getchannel('A').getextrema()[0]==0,'REAL_ALPHA_REQUIRED')
    small=im.resize((cols*sample_size,rows*sample_size),Image.Resampling.NEAREST)
    small.putdata([(0,0,0,0) if c[3]<128 else min(palette[1:],key=lambda p:sum((c[j]-p[j])**2 for j in range(3))) for c in small.get_flattened_data()])
    masters={p['key']:P.place_authored(p,palette,inv['sourceOrigin']) for p in setting['poses']};reviews=[];files={'raw-sheet.png':source.read_bytes()}
    for n,k in enumerate(job['keys']):
        panel=small.crop((n%cols*sample_size,n//cols*sample_size,(n%cols+1)*sample_size,(n//cols+1)*sample_size));b=panel.getbbox()
        P.require(b is not None and 0<=b[0]+ox<b[2]+ox<=64 and 0<=b[1]+oy<b[3]+oy<=64,'EMPTY_OR_CLIPPED_PANEL '+k)
        tile=Image.new('RGBA',(64,64));tile.alpha_composite(panel,(ox,oy));masters[k]=tile
        reviews.append({'key':k,'panel':n,'alphaBounds':tile.getbbox(),'sourceNativeBounds':inv['slots'][k]['visibleBounds'],'status':'PENDING_VISUAL_REVIEW'})
    if repair_path:
        repair=P.read(repair_path);P.require(repair['entityId']==ENTITY,'REPAIR_ENTITY_DRIFT')
        P.require(repair['baseSheetSha256']==P.sha(source.read_bytes()),'REPAIR_SHEET_DRIFT')
        for k,translation in repair['placements'].items():
            base=masters[k];b=base.getbbox();dx,dy=translation
            P.require(0<=b[0]+dx<b[2]+dx<=64 and 0<=b[1]+dy<b[3]+dy<=64,'PLACEMENT_CLIPPED '+k)
            tile=Image.new('RGBA',(64,64));tile.alpha_composite(base,(dx,dy));masters[k]=tile
        fix_path=repair_path.parent/repair['sheet'];P.require(P.sha(fix_path.read_bytes())==repair['sheetSha256'],'REPAIR_INPUT_DRIFT')
        fix=Image.open(fix_path).convert('RGBA');P.require(abs(fix.width/fix.height-1.5)<.01,'REPAIR_LAYOUT_DRIFT')
        fix=fix.resize((192,128),Image.Resampling.NEAREST)
        fix.putdata([(0,0,0,0) if c[3]<128 else min(palette[1:],key=lambda p:sum((c[j]-p[j])**2 for j in range(3))) for c in fix.get_flattened_data()])
        for n,row in enumerate(repair['panels']):
            panel=fix.crop((n%3*64,n//3*64,n%3*64+64,n//3*64+64));b=panel.getbbox();dx,dy=row['offset']
            P.require(b and 0<=b[0]+dx<b[2]+dx<=64 and 0<=b[1]+dy<b[3]+dy<=64,'REPAIR_CLIPPED '+row['key'])
            tile=Image.new('RGBA',(64,64));tile.alpha_composite(panel,(dx,dy));masters[row['key']]=tile
        edits={}
        for k in repair['hideOccludedFrontMarks']:
            tile=masters[k];changed=[]
            for y in range(64):
                for x in range(64):
                    before=tile.getpixel((x,y))
                    if before in (palette[2],palette[3]):
                        changed.append([x,y,palette.index(before),5]);tile.putpixel((x,y),palette[5])
            edits[k]=changed
        files.update({'repair-sheet.png':fix_path.read_bytes(),'repair-manifest.json':P.encoded(repair),'occluded-mark-edits.json':P.encoded(edits)})
    # Dark silhouettes and grayscale come from our own new pixels, never donor pixels.
    for k,rule in job['derived'].items():
        base=masters[rule['base']];operation=rule['operation']
        if operation=='white':tile=P.derive_silhouette(base,(255,255,255,255))
        elif operation=='grayscale':
            l=base.convert('L');tile=Image.merge('RGBA',(l,l,l,base.getchannel('A')))
        else:
            tile=P.derive_silhouette(base,(0,0,0,255));tile.putdata([(255,255,255,255) if c in (palette[2],palette[3]) else p for c,p in zip(base.get_flattened_data(),tile.get_flattened_data())])
        masters[k]=tile
    # Red special state has a distinct donor pose. Apply a palette transform to
    # the authored pose, retaining its original teal face marks for expression.
    fire=masters['main/cell_044'].copy();lut={p:((125,31,24,255) if n in(1,7,11) else (229,78,23,255) if n in(6,8,10) else (255,190,65,255)) for n,p in enumerate(palette) if n not in(0,2,3,4)}
    fire.putdata([lut.get(p,p) for p in fire.get_flattened_data()]);masters['main/cell_044']=fire
    plan={'slots':{k:{**r,'sourceTranslationFromCanonical':r['translation']} for k,r in inv['slots'].items()}}
    meta={'designVersion':'m002-original-sheet-r01','authoredMasters':3,'derivedMasters':4,'generatedCandidateMasters':44,
          'deliveredSlots':83,'availableSequences':53,'normalization':{'sampleSize':sample_size,'offset':list(offset),'perFrameResize':False,'bboxAutoFit':False},
          'generationSourceSize':list(im.size),'unexpectedOccupiedPanels':[n for n in job['blankPanels'] if small.crop((n%cols*sample_size,n//cols*sample_size,(n%cols+1)*sample_size,(n//cols+1)*sample_size)).getbbox()],
          'donorReviewSha256':job['reviewSha256'],'sourceOrigin':inv['sourceOrigin'],'generationTool':'BUILTIN_IMAGEGEN','modelVersion':'NOT_EXPOSED'}
    if repair_path:
        meta.update({'designVersion':'m002-original-sheet-r02','repairManifestSha256':P.sha(repair_path.read_bytes()),'generationCalls':2,
                     'placementPolicy':'EXPLICIT_SOURCE_REVIEWED_OFFSETS_NO_AUTO_CENTER'})
        for row in reviews:row['alphaBounds']=masters[row['key']].getbbox()
    M.assemble(masters,plan,{'entityId':ENTITY,'palette':setting['palette']},files,reviews,meta,JOBS/ENTITY/output,job)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--prepare',action='store_true');ap.add_argument('--import-sheet',type=Path);ap.add_argument('--output',default='candidate-r01');ap.add_argument('--sample-size',type=int,default=64);ap.add_argument('--offset',nargs=2,type=int,default=[0,0]);ap.add_argument('--repair',type=Path);a=ap.parse_args()
    if a.prepare:prepare()
    elif a.import_sheet:import_sheet(a.import_sheet,a.output,a.sample_size,a.offset,a.repair)
    else:ap.error('Choose --prepare or --import-sheet')
