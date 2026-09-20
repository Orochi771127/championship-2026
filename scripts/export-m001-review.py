"""Export the validated original 64px bank for the existing Pixi loader; no promotion."""
import importlib.util
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('m001_sheet',ROOT/'scripts/m001-full-sheet.py')
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)

def build():
    work=M.P.WORK/'full-sheet-r05'; source=work/'compiled-final'
    M.patch_sheet(work/'repair-final-manifest.json',check=True)
    bank=M.P.read(source/'bank.json')
    plan=M.P.read(M.P.WORK/'generated/preflight.json')
    runtime=M.P.read(ROOT/'assets/production/internal-faithful-baseline/characters-v1/m001_zurumon/runtime.json')
    contract=M.P.read(M.P.PACK/'generated/entities/m001_zurumon/motion-contract.json')
    origin=plan['geometry']['sourceOrigin']
    M.P.require(origin==[31,38] and plan['geometry']['nativePixelScale']==1,'SOURCE_ORIGIN_OR_SCALE_DRIFT')
    files={}; geometry={'frames':{}}
    for side in ['main','sub']:
        atlas=Image.open(source/f'{side}-atlas.png')
        frames={}
        for key,r in bank['cells'].items():
            if not key.startswith(side+'/'):continue
            image=Image.open(source/r['image']).convert('RGBA'); n=int(key[-3:])
            M.P.require(image.size==(64,64),'INVALID_CANVAS')
            M.P.require(M.P.sha((source/r['image']).read_bytes())==r['sha256'],'CELL_DRIFT')
            M.P.require(r['translation']==plan['slots'][key]['sourceTranslationFromCanonical'],'TRANSLATION_DRIFT')
            bounds=image.getchannel('A').getbbox(); texture=bank['entityId']+'/'+key
            # Preserve logical 64px origin, but retain actual visible bounds for the
            # existing selection/decorations code. Transparent padding is not body size.
            bx,by,ex,ey=bounds
            frames[texture]={'frame':{'x':n%8*64+bx,'y':n//8*64+by,'w':ex-bx,'h':ey-by},'rotated':False,'trimmed':True,
                'spriteSourceSize':{'x':bx,'y':by,'w':ex-bx,'h':ey-by},'sourceSize':{'w':64,'h':64}}
            geometry['frames'][texture]={'blank':False,'scale':1,'origin':origin,'sourceSize':[64,64],
                'nativeBounds':[bounds[0]-31,bounds[1]-38,bounds[2]-31,bounds[3]-38]}
        for a in runtime['sides'][side]['animations']:
            c=next(x for x in contract['sides'][side]['sequences'] if x['id']==a['id'])
            M.P.require(a['playbackMode']==c['playbackMode'] and a.get('loopStartFrame',0)==c['loopStartFrame'],'TIMING_DRIFT')
            M.P.require([(f['cell'],f['ticks'],f['texture']) for f in a['frames']]==[(f['cell'],f['ticks'],f['texture']) for f in c['frames']],'SEQUENCE_DRIFT')
        runtime['sides'][side]['atlases']=[{'image':f'{side}.png','data':f'{side}.json'}]
        files[f'{side}.png']=(source/f'{side}-atlas.png').read_bytes()
        files[f'{side}.json']=M.P.encoded({'frames':frames,'meta':{'image':f'{side}.png','format':'RGBA8888','size':{'w':atlas.width,'h':atlas.height},'scale':'1'}})
    runtime['artProfile']={'style':'ORIGINAL_AMBER_GEL','scale':1,'filter':'nearest','logicalCanvas':[64,64],
        'anchor':{'x':31/64,'y':38/64},'alphaBoundary':'TRANSPARENT','reviewOnly':True,'runtimeEligible':False,
        'shippingReady':False,'publicReleasePermitted':False,'designVersion':bank['designVersion']}
    runtime['reviewGeometry']=geometry
    runtime['sourceBankSha256']=M.P.sha((source/'bank.json').read_bytes())
    runtime['motionContractSha256']=M.P.sha((M.P.PACK/'generated/entities/m001_zurumon/motion-contract.json').read_bytes())
    files['runtime.review.json']=M.P.encoded(runtime)
    files['manifest.json']=M.P.encoded({'entityId':bank['entityId'],'reviewOnly':True,'humanApproved':False,
        'runtimeEligible':False,'shippingReady':False,'publicReleasePermitted':False,
        'sourceBankSha256':runtime['sourceBankSha256'],'files':{k:M.P.sha(v) for k,v in files.items()},
        'nativeOrigin':origin,'nativeCanvas':[64,64],'packedPixelsPerNativePixel':1,
        'normalGameQa':'PENDING','usage':'Loopback m001 review only. No default production replacement.'})
    destination=ROOT/'assets/production/internal-character-review/m001-r05-anchored'
    M.P.SOURCE.publish(files,destination,False)
    # The HUD uses db_sub, separate from the moving actor roster. Prove its
    # static source is identical to Main000 before reusing original art.
    archive=ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK'
    db='m001_zurumon_db_sub'
    db_folder=archive/'08_FULL_FAMILY_CONVERSION/db_digimon'/db
    db_cells=M.P.read(db_folder/'cells.json')
    db_animation=M.P.read(db_folder/'animations.json')['sequences'][0]
    db_cell=db_animation['frames'][0]['cellId']
    db_image,_=M.P.SOURCE.render_native(db_cells['cells'][db_cell],M.P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/db_digimon',db,db_cells))
    main_cells=M.P.read(archive/'08_FULL_FAMILY_CONVERSION/digimon/m001_zurumon_main/cells.json')
    main_image,_=M.P.SOURCE.render_native(main_cells['cells'][0],M.P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon','m001_zurumon_main',main_cells))
    db_crop=db_image.crop(db_image.getbbox());main_crop=main_image.crop(main_image.getbbox())
    M.P.require(db_crop.size==main_crop.size and db_crop.tobytes()==main_crop.tobytes(),'HUD_DONOR_NOT_MAIN000')
    hud_files={};hud_cells=[]
    hud_path=destination.relative_to(ROOT).as_posix()+'/hud-r01/'
    for key in ['main/cell_000']+[k for k in bank['cells'] if k.startswith('sub/')]:
        im=Image.open(source/bank['cells'][key]['image']).convert('RGBA');b=im.getbbox();crop=im.crop(b)
        name=key.replace('/','-')+'.png';data=M.P.PIXEL.png_bytes(crop);hud_files[name]=data
        row={'src':hud_path+name,'width':crop.width,'height':crop.height,'origin':[31-b[0],38-b[1]],'sha256':M.P.sha(data),'cell':int(key[-3:])}
        if key.startswith('main'):
            portrait={**row,'speciesId':'species-008','entityId':'m001_zurumon','nativeScale':2,'sourceBank':db,'sequenceId':0,
                'derivation':'SOURCE_DB_SUB_FIRST_CELL_EXACTLY_EQUALS_MAIN000_VISIBLE_RGBA',
                'sourceVisibleRgbaSha256':M.P.sha(db_crop.tobytes()),'originalCellSha256':bank['cells'][key]['sha256']}
        else:hud_cells.append(row)
    hud_files['manifest.json']=M.P.encoded({'entityId':'m001_zurumon','sourceBankSha256':runtime['sourceBankSha256'],
        'reviewOnly':True,'runtimeEligible':False,'publicReleasePermitted':False,'portrait':portrait,
        'battle':{'speciesId':'species-008','cells':hud_cells,'sequences':[
            {'id':s['id'],'playbackMode':s['playbackMode'],'loopStartFrame':s.get('loopStartFrame',0),
             'frames':[{'cell':f['cell'],'ticks':f['ticks']} for f in s['frames']]}
            for s in contract['sides']['sub']['sequences'] if s['id'] in [0,5,9]]}})
    M.P.SOURCE.publish(hud_files,destination/'hud-r01',False)
    print('EXPORTED',destination)

if __name__=='__main__':build()
