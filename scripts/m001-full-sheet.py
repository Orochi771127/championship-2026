"""One-sheet m001 candidate assembly; reuses established decoder and native bank.

Research-only donor pixels are written outside the product repository. Generation
is invoked separately. This script never submits jobs or approves artwork.
"""
from pathlib import Path
import argparse
import importlib.util
import json
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('m001_preflight',ROOT/'scripts/prepare-character-production.py')
P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
WORK=P.WORK/'full-sheet-r01'
NATIVE=P.WORK/'native-r05/compiled'
RESEARCH=ROOT.parent/'_archive/m001-full-sheet-r01'
COLS,ROWS=8,6

def prepare():
    _,plan=P.build(ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK')
    bank=P.read(NATIVE/'bank.json')
    existing={v['canonical'] for v in bank['cells'].values()}
    keys=[k for k,v in plan['slots'].items() if k==v['canonical'] and k not in existing]
    P.require(len(keys)==43,'UNEXPECTED_REMAINING_MASTER_COUNT')
    mapping={'entityId':P.ENTITY,'grid':[COLS,ROWS],'keys':keys,'blankPanels':list(range(len(keys),COLS*ROWS)),
             'retainedMasters':sorted(existing),'nativeBankSha256':P.sha((NATIVE/'bank.json').read_bytes()),
             'sourceContractSha256':plan['motionContractSha256'],'runtimeEligible':False,
             'postprocessStates':{'main/cell_047':'black_silhouette','main/cell_048':'black_silhouette','main/cell_061':'grayscale'}}
    archive=ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK'
    cells=P.read(archive/'08_FULL_FAMILY_CONVERSION/digimon/m001_zurumon_main/cells.json')
    raw=P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon','m001_zurumon_main',cells)
    reference=Image.new('RGBA',(COLS*192,ROWS*192),(235,237,241,255))
    annotated=reference.copy();labels=ImageDraw.Draw(annotated)
    for i,key in enumerate(keys):
        cell=cells['cells'][int(key[-3:])];im,_=P.SOURCE.render_native(cell,raw)
        b=plan['slots'][key]['nativeBounds'];canvas=Image.new('RGBA',(64,64))
        canvas.alpha_composite(im,(31+b[0],38+b[1]))
        tile=canvas.resize((192,192),Image.Resampling.NEAREST);xy=(i%COLS*192,i//COLS*192)
        reference.alpha_composite(tile,xy);annotated.alpha_composite(tile,xy)
        labels.text((xy[0]+8,xy[1]+8),key,fill=(20,20,20,255))
    identity=Image.new('RGBA',(768,768))
    for i,key in enumerate(k for k in sorted(existing) if k!='main/cell_064'):
        im=Image.open(NATIVE/bank['cells'][key]['image']).convert('RGBA')
        identity.alpha_composite(im.resize((256,256),Image.Resampling.NEAREST),(i%3*256,i//3*256))
    P.SOURCE.publish({'panel-map.json':P.encoded(mapping),'original-identity.png':P.PIXEL.png_bytes(identity)},WORK/'input',False)
    P.SOURCE.publish({'donor-motion-guide.png':P.PIXEL.png_bytes(reference),'donor-motion-guide-labeled.png':P.PIXEL.png_bytes(annotated)},RESEARCH,False)
    print(json.dumps({'newMasterPanels':len(keys),'retainedMasters':len(existing),'referencePath':str(RESEARCH/'donor-motion-guide.png')}))

def import_sheet(source, output='compiled', sample_side=64):
    mapping=P.read(WORK/'input/panel-map.json');native=P.read(NATIVE/'bank.json')
    P.require(mapping['nativeBankSha256']==P.sha((NATIVE/'bank.json').read_bytes()),'NATIVE_BANK_DRIFT')
    _,plan=P.build(ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK')
    P.require(plan['motionContractSha256']==mapping['sourceContractSha256'],'CONTRACT_DRIFT')
    palette=P.PIXEL.parse_palette(native['palette'])
    im=Image.open(source).convert('RGBA')
    P.require(abs(im.width/im.height-COLS/ROWS)<0.03,'GRID_ASPECT_MISMATCH')
    P.require(im.getchannel('A').getextrema()[0]==0,'GENERATED_ALPHA_REQUIRED')
    # One uniform sheet transform. No independent sprite centering or fit.
    small=im.resize((COLS*sample_side,ROWS*sample_side),Image.Resampling.NEAREST)
    small.putdata([(0,0,0,0) if p[3]<128 else min(palette[1:],key=lambda c:sum((c[j]-p[j])**2 for j in range(3))) for p in small.get_flattened_data()])
    masters={};files={'original-sheet.png':source.read_bytes()};reviews=[]
    offset=(0,0) if sample_side==64 else (12,6)
    extra_panels=[]
    for i in mapping['blankPanels']:
        x,y=i%COLS*sample_side,i//COLS*sample_side
        if small.crop((x,y,x+sample_side,y+sample_side)).getchannel('A').getbbox():extra_panels.append(i)
    for key in mapping['retainedMasters']:
        masters[key]=Image.open(NATIVE/native['cells'][key]['image']).convert('RGBA')
    for i,key in enumerate(mapping['keys']):
        x,y=i%COLS*sample_side,i//COLS*sample_side
        tile=Image.new('RGBA',(64,64));tile.alpha_composite(small.crop((x,y,x+sample_side,y+sample_side)),offset)
        bbox=tile.getchannel('A').getbbox()
        P.require(bbox is not None,f'EMPTY_GENERATED_PANEL {key}')
        files['base-candidates/'+key.replace('/','-')+'.png']=P.PIXEL.png_bytes(tile)
        state=mapping['postprocessStates'].get(key)
        if state=='black_silhouette':tile=P.derive_silhouette(tile,(0,0,0,255))
        elif state=='grayscale':
            gray=tile.convert('L');tile=Image.merge('RGBA',(gray,gray,gray,tile.getchannel('A')))
        masters[key]=tile
        reviews.append({'key':key,'panel':i,'alphaBounds':list(bbox),'touchesPanelEdge':any([bbox[0]==0,bbox[1]==0,bbox[2]==64,bbox[3]==64]),'sourceVisibleBoundsOn64':[v+plan['geometry']['sourceOrigin'][j%2] for j,v in enumerate(plan['slots'][key]['visibleBounds'])],
                        'stateTransform':state,'poseExpressionRestraintQa':'PENDING','geometryQa':'PENDING','artAccepted':False})
    metadata={'designVersion':'m001-full-sheet-candidate-r01',
              'unexpectedOccupiedPanels':extra_panels,'generationSourceSize':list(im.size),
              'normalization':{'operation':'UNIFORM_WHOLE_SHEET_NEAREST_SHARED_PALETTE_BINARY_ALPHA','panelSampleSize':sample_side,'sharedOffset':list(offset),'perFrameFit':False}}
    assemble(masters,plan,native,files,reviews,metadata,WORK/output,mapping)

def assemble(masters,plan,native,files,reviews,metadata,destination,mapping):
    """Shared complete-bank assembly for initial generation and bounded repairs."""
    P.require(set(masters)=={s['canonical'] for s in plan['slots'].values()},'MASTER_COVERAGE_GAP')
    delivered={}
    for key,slot in plan['slots'].items():
        tile=masters[slot['canonical']];dx,dy=slot['sourceTranslationFromCanonical']
        if dx or dy:
            box=tile.getchannel('A').getbbox()
            P.require(0<=box[0]+dx<box[2]+dx<=64 and 0<=box[1]+dy<box[3]+dy<=64,'TRANSLATED_PIXELS_CLIPPED')
            shifted=Image.new('RGBA',(64,64));shifted.alpha_composite(tile,(dx,dy));tile=shifted
        filename='cells/'+key.replace('/','-')+'.png';files[filename]=P.PIXEL.png_bytes(tile)
        delivered[key]={'image':filename,'canonical':slot['canonical'],'translation': [dx,dy],'sha256':P.sha(files[filename]),'alphaBounds':list(tile.getchannel('A').getbbox())}
    contract=P.read(P.PACK/'generated/entities'/native.get('entityId',P.ENTITY)/'motion-contract.json')
    sequences=[{'side':side,'sequence':s,'available':True,'missing':[]} for side,v in contract['sides'].items() for s in v['sequences']]
    bank={**native,'designVersion':'m001-full-sheet-candidate-r01','cells':delivered,'sequences':sequences,
          'authoredMasters':9,'derivedMasters':1,'generatedCandidateMasters':43,'deliveredSlots':83,'availableSequences':53,
          'fullMotionQa':'PENDING_ALL_GENERATED_CELLS','normalGameQa':'NOT_RUN','artReview':'PENDING','runtimeEligible':False,
          'generationTool':'BUILTIN_IMAGEGEN','modelVersion':'NOT_EXPOSED','higgsfieldCalls':0,
          **metadata}
    files['bank.json']=P.encoded(bank);files['cell-review.json']=P.encoded(reviews)
    for side,count in [(side,sum(k.startswith(side+'/') for k in delivered)) for side in ('main','sub')]:
        columns=8;rows=(count+columns-1)//columns
        atlas=Image.new('RGBA',(columns*64,rows*64))
        contact=Image.new('RGB',(columns*144,rows*162),'#26323f');draw=ImageDraw.Draw(contact)
        for n in range(count):
            from io import BytesIO
            key=f'{side}/cell_{n:03d}';tile=Image.open(BytesIO(files[delivered[key]['image']])).convert('RGBA')
            atlas.alpha_composite(tile,(n%columns*64,n//columns*64))
            large=tile.resize((128,128),Image.Resampling.NEAREST);contact.paste(large,(n%columns*144+8,n//columns*162+8),large)
            draw.text((n%columns*144+8,n//columns*162+139),f'{side} cell {n:03d}',fill='white')
        files[f'{side}-atlas.png']=P.PIXEL.png_bytes(atlas);files[f'{side}-contact.png']=P.PIXEL.png_bytes(contact)
    files['receipt.json']=P.encoded({'scriptSha256':P.sha(Path(__file__).read_bytes()),'panelMapSha256':P.sha(P.encoded(mapping)),'files':{k:P.sha(v) for k,v in sorted(files.items())}})
    P.SOURCE.publish(files,destination,False)
    print(f'CANDIDATE_MASTERS={len(masters)} SLOTS={len(delivered)} SEQUENCES={len(sequences)} ART_ACCEPTED=false RUNTIME_ELIGIBLE=false')

def patch_sheet(manifest_path,check=False):
    """Explicit pixel placements and edits; no bbox fitting or generation calls."""
    patch=P.read(manifest_path);source=manifest_path.parent/patch['sheet']
    base=P.WORK/patch['baseDirectory'];prior=P.read(base/'bank.json')
    P.require(P.sha((base/'bank.json').read_bytes())==patch['baseBankSha256'],'REPAIR_BASE_DRIFT')
    P.require(P.sha(source.read_bytes())==patch['sheetSha256'],'REPAIR_SHEET_DRIFT')
    _,plan=P.build(ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK')
    P.require(plan['motionContractSha256']==patch['motionContractSha256'],'CONTRACT_DRIFT')
    palette=P.PIXEL.parse_palette(prior['palette'])
    cols,rows=patch['grid'];side=patch['panelSampleSize']
    sheet=Image.open(source).convert('RGBA')
    P.require(abs(sheet.width/sheet.height-cols/rows)<0.01,'REPAIR_GRID_ASPECT_MISMATCH')
    P.require(sheet.getchannel('A').getextrema()[0]==0,'REPAIR_ALPHA_REQUIRED')
    small=sheet.resize((cols*side,rows*side),Image.Resampling.NEAREST)
    def quantize(pixel):
        if pixel[3]<128:return (0,0,0,0)
        candidates=palette[1:]
        if patch.get('quantization')=='HUE_GATED_GREEN':
            r,g,b,_=pixel
            if not (g>=r+8 and g>=b+3):candidates=[c for i,c in enumerate(palette) if i not in (0,7)]
        return min(candidates,key=lambda c:sum((c[j]-pixel[j])**2 for j in range(3)))
    small.putdata([quantize(p) for p in small.get_flattened_data()])
    masters={k:Image.open(base/v['image']).convert('RGBA') for k,v in prior['cells'].items() if k==v['canonical']}
    files={str(p.relative_to(base)).replace('\\','/'):p.read_bytes() for p in (base/'base-candidates').glob('*.png')}
    files['repair-sheet.png']=source.read_bytes();files['repair-manifest.json']=P.encoded(patch)
    reviews=P.read(base/'cell-review.json');records={r['key']:r for r in reviews}
    for entry in patch['panels']:
        key=entry['key'];i=entry['panel'];ox,oy=entry['offset']
        P.require(key in masters and 0<=i<cols*rows,'INVALID_REPAIR_TARGET')
        tile=Image.new('RGBA',(64,64));panel=small.crop((i%cols*side,i//cols*side,i%cols*side+side,i//cols*side+side))
        b=panel.getchannel('A').getbbox();P.require(b is not None,'EMPTY_REPAIR_PANEL')
        P.require(0<=b[0]+ox<b[2]+ox<=64 and 0<=b[1]+oy<b[3]+oy<=64,'REPAIR_CLIPPED')
        tile.alpha_composite(panel,(ox,oy))
        for edit in entry.get('pixelEdits',[]):
            x,y,before,after=edit
            P.require(tile.getpixel((x,y))==palette[before],f'PIXEL_EDIT_SOURCE_DRIFT {key} {x},{y}')
            tile.putpixel((x,y),palette[after])
        # Explicit original-pixel landmark adjustments. All masks are evaluated
        # before moving anything so touching droplets cannot change selection.
        moving=[];occupied=set()
        for move in entry.get('pixelMoves',[]):
            pixels=[]
            for x,y in move['pixels']:
                P.require((x,y) not in occupied and tile.getpixel((x,y))[3]==255,'REPAIR_MOVE_MASK_DRIFT')
                occupied.add((x,y));pixels.append((x,y,tile.getpixel((x,y))))
            moving.append((pixels,move['translation']))
        for x,y in occupied:tile.putpixel((x,y),(0,0,0,0))
        for pixels,(dx,dy) in moving:
            for x,y,color in pixels:
                x+=dx;y+=dy
                P.require(0<=x<64 and 0<=y<64 and tile.getpixel((x,y))[3]==0,'REPAIR_MOVE_COLLISION_OR_CLIPPING')
                tile.putpixel((x,y),color)
        files['base-candidates/'+key.replace('/','-')+'.png']=P.PIXEL.png_bytes(tile)
        if entry.get('state')=='grayscale':
            gray=tile.convert('L');tile=Image.merge('RGBA',(gray,gray,gray,tile.getchannel('A')))
        masters[key]=tile
        records[key].update({'repair':entry,'alphaBounds':list(tile.getchannel('A').getbbox()),'visualRepairQa':'KNOWN_DEFECT_CORRECTED_FULL_REVIEW_PENDING'})
    for entry in patch.get('derived',[]):
        key=entry['key'];base_image=masters[entry['base']]
        if entry['operation']=='palette_swap':
            lut=entry['paletteIndexMap']
            P.require(len(lut)==len(palette) and lut[0]==0 and all(0<v<len(palette) for v in lut[1:]),'INVALID_STATE_PALETTE_MAP')
            tile=base_image.copy();tile.putdata([palette[lut[palette.index(p)]] for p in base_image.get_flattened_data()])
        else:
            P.require(entry['operation']=='dark_silhouette_white_eye_mask','UNKNOWN_DERIVATION')
            tile=P.derive_silhouette(base_image,(0,0,0,255))
            # The eye mask selects our original identity pixels, never donor pixels.
            for x,y in entry['whiteEyePixels']:
                P.require(base_image.getpixel((x,y))==palette[6],f'WHITE_EYE_MASK_NOT_ORIGINAL_CREAM {key} {x},{y}')
                tile.putpixel((x,y),(255,255,255,255))
        masters[key]=tile
        files['base-candidates/'+key.replace('/','-')+'.png']=P.PIXEL.png_bytes(base_image)
        records[key].update({'repair':entry,'stateTransform':entry['operation'],'alphaBounds':list(tile.getchannel('A').getbbox()),'visualRepairQa':'KNOWN_DEFECT_CORRECTED_FULL_REVIEW_PENDING'})
    changed=[]
    for key,record in prior['cells'].items():
        expected=Image.new('RGBA',(64,64))
        expected.alpha_composite(masters[record['canonical']],tuple(record['translation']))
        if Image.open(base/record['image']).convert('RGBA').tobytes()!=expected.tobytes():changed.append(key)
    metadata={k:prior[k] for k in ('unexpectedOccupiedPanels','generationSourceSize','normalization')}
    metadata.update({'designVersion':patch['designVersion'],'repairSourceBankSha256':patch['baseBankSha256'],
                     'repairSheetSha256':patch['sheetSha256'],'repairedMasters':[r['key'] for r in patch['panels']+patch.get('derived',[])],
                     'changedSlots':changed,'repairNormalization':{'panelSampleSize':side,'perFrameResize':False,'placement':'EXPLICIT_REVIEWED_OFFSETS','bboxAutoFit':False},
                     'repairGenerationCalls':patch.get('generationCalls',1),
                     'cumulativeGenerationCallsForFullSheet':prior.get('cumulativeGenerationCallsForFullSheet',1)+patch.get('generationCalls',1)})
    destination=manifest_path.parent/patch.get('outputDirectory','compiled')
    P.require(destination.resolve().parent==manifest_path.parent.resolve(),'REPAIR_OUTPUT_MUST_BE_DIRECT_CHILD')
    if check:
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            temp=Path(temp);assemble(masters,plan,prior,files,reviews,metadata,temp,patch)
            generated={str(p.relative_to(temp)).replace('\\','/'):p.read_bytes() for p in temp.rglob('*') if p.is_file()}
            # Historical receipts retain the original tool hash. A newer script
            # may reproduce the same artifacts; all other receipt fields and
            # every payload byte must still match.
            old_receipt=P.read(destination/'receipt.json');new_receipt=P.read(temp/'receipt.json')
            P.require({k:v for k,v in old_receipt.items() if k!='scriptSha256'}=={k:v for k,v in new_receipt.items() if k!='scriptSha256'},'REPAIR_REBUILD_RECEIPT_DRIFT')
            generated['receipt.json']=(destination/'receipt.json').read_bytes()
            P.SOURCE.publish(generated,destination,True)
    else:assemble(masters,plan,prior,files,reviews,metadata,destination,patch)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--prepare',action='store_true');p.add_argument('--import-sheet',type=Path);p.add_argument('--output',choices=['compiled','compiled-aligned'],default='compiled');p.add_argument('--sample-side',type=int,choices=[64,40],default=64);p.add_argument('--patch',type=Path);p.add_argument('--check',action='store_true');a=p.parse_args()
    if a.prepare:prepare()
    elif a.import_sheet:import_sheet(a.import_sheet,a.output,a.sample_side)
    elif a.patch:patch_sheet(a.patch,a.check)
    else:p.error('Choose --prepare, --import-sheet or --patch')
