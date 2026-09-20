"""Export validated original-character candidate banks to loopback review bundles."""
import argparse
import importlib.util
from pathlib import Path

from PIL import Image


ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sheet_jobs',ROOT/'scripts/character-sheet-job.py')
J=importlib.util.module_from_spec(spec);spec.loader.exec_module(J)
P=J.P
CONFIG={
    'm003_nyokimon':{'candidate':'candidate-hf-batch-r03','review':'higgsfield-r03','folder':'m003_nyokimon-hf-r03'},
    'm004_bubbmon':{'candidate':'candidate-hf-batch-r03','review':'higgsfield-r03','folder':'m004_bubbmon-hf-r03'},
    'm005_pitchmon':{'candidate':'candidate-hf-batch-r06','review':'higgsfield-r06','folder':'m005_pitchmon-hf-r06'},
    'm006_punimon':{'candidate':'candidate-hf-batch-r06','review':'higgsfield-r06','folder':'m006_punimon-hf-r06'},
    'm007_botamon':{'candidate':'candidate-hf-batch-r06','review':'higgsfield-r06','folder':'m007_botamon-hf-r06'},
    'm008_poyomon':{'candidate':'candidate-hf-batch-r03','review':'higgsfield-r03','folder':'m008_poyomon-hf-r03'},
    'm009_mokumon':{'candidate':'candidate-hf-batch-r06','review':'higgsfield-r06','folder':'m009_mokumon-hf-r06'},
    'm010_yukimibotamon':{'candidate':'candidate-hf-batch-r02','review':'higgsfield-r01','folder':'m010_yukimibotamon-hf-r01'},
    'm011_yuramon':{'candidate':'candidate-hf-batch-r02','review':'higgsfield-r02','folder':'m011_yuramon-hf-r02'},
    'm012_petimon':{'candidate':'candidate-hf-batch-r03','review':'higgsfield-r03','folder':'m012_petimon-hf-r03'},
    'm101_caprimon':{'candidate':'candidate-hf-batch-r06','review':'higgsfield-r06','folder':'m101_caprimon-hf-r06'},
    'm102_koromon':{'candidate':'candidate-hf-batch-r03','review':'higgsfield-r03','folder':'m102_koromon-hf-r03'},
    'm103_tanemon':{'candidate':'candidate-hf-batch-r03','review':'higgsfield-r03','folder':'m103_tanemon-hf-r03'},
    'm104_tunomon':{'candidate':'candidate-hf-batch-r02','review':'higgsfield-r02','folder':'m104_tunomon-hf-r02'},
}
ALLOWED=tuple(CONFIG)
SPECIES={'m003_nyokimon':'species-010','m004_bubbmon':'species-011','m005_pitchmon':'species-012',
         'm006_punimon':'species-013','m007_botamon':'species-014','m008_poyomon':'species-015',
         'm009_mokumon':'species-016','m010_yukimibotamon':'species-017','m011_yuramon':'species-018',
         'm012_petimon':'species-019','m101_caprimon':'species-020','m102_koromon':'species-021',
         'm103_tanemon':'species-022','m104_tunomon':'species-023'}


def build(entity):
    config=CONFIG[entity];source=J.JOBS/entity/config['candidate']
    bank=P.read(source/'bank.json')
    contract=P.read(P.PACK/'generated/entities'/entity/'motion-contract.json')
    inventory=P.read(J.D.BASE/entity/'inventory.json')
    visual=P.read(J.JOBS/entity/config['review']/'visual-validation.json')
    P.require(visual['status'].startswith('PASS_CANDIDATE_VISUAL'),'VISUAL_GATE_NOT_PASSED')
    normal_game_qa=visual.get('limits',{}).get('normalGameQa','PENDING')
    runtime=P.read(ROOT/'assets/production/internal-faithful-baseline/characters-v1'/entity/'runtime.json')
    origin=inventory['sourceOrigin']
    P.require(bank['entityId']==entity and bank['sourceOrigin']==origin,'ENTITY_ORIGIN_DRIFT')
    files={};geometry={'frames':{}}
    for side in ('main','sub'):
        atlas=Image.open(source/f'{side}-atlas.png').convert('RGBA');frames={}
        for key,record in bank['cells'].items():
            if not key.startswith(side+'/'):continue
            image=Image.open(source/record['image']).convert('RGBA')
            P.require(image.size==(64,64) and set(image.getchannel('A').get_flattened_data())<={0,255},'INVALID_CELL '+key)
            P.require(P.sha((source/record['image']).read_bytes())==record['sha256'],'CELL_DRIFT '+key)
            bounds=image.getchannel('A').getbbox();P.require(bounds is not None,'EMPTY_CELL '+key)
            index=int(key[-3:]);bx,by,ex,ey=bounds;texture=entity+'/'+key
            frames[texture]={'frame':{'x':index%8*64+bx,'y':index//8*64+by,'w':ex-bx,'h':ey-by},
                             'rotated':False,'trimmed':True,
                             'spriteSourceSize':{'x':bx,'y':by,'w':ex-bx,'h':ey-by},
                             'sourceSize':{'w':64,'h':64}}
            geometry['frames'][texture]={'blank':False,'scale':1,'origin':origin,'sourceSize':[64,64],
                                         'nativeBounds':[bx-origin[0],by-origin[1],ex-origin[0],ey-origin[1]]}
        source_sequences=contract['sides'][side]['sequences']
        P.require(len(runtime['sides'][side]['animations'])==len(source_sequences),'SEQUENCE_COUNT_DRIFT')
        for animation in runtime['sides'][side]['animations']:
            expected=next(sequence for sequence in source_sequences if sequence['id']==animation['id'])
            P.require(animation['playbackMode']==expected['playbackMode']
                      and animation.get('loopStartFrame',0)==expected['loopStartFrame'],'TIMING_DRIFT')
            P.require([(frame['cell'],frame['ticks'],frame['texture']) for frame in animation['frames']]
                      ==[(frame['cell'],frame['ticks'],frame['texture']) for frame in expected['frames']],'SEQUENCE_DRIFT')
        runtime['sides'][side]['atlases']=[{'image':f'{side}.png','data':f'{side}.json'}]
        files[f'{side}.png']=(source/f'{side}-atlas.png').read_bytes()
        files[f'{side}.json']=P.encoded({'frames':frames,'meta':{'image':f'{side}.png','format':'RGBA8888',
                                                                 'size':{'w':atlas.width,'h':atlas.height},'scale':'1'}})
    runtime['artProfile']={'style':'ORIGINAL_HIGGSFIELD_CANDIDATE','scale':1,'filter':'nearest',
                           'logicalCanvas':[64,64],'anchor':{'x':origin[0]/64,'y':origin[1]/64},
                           'alphaBoundary':'TRANSPARENT','reviewOnly':True,'runtimeEligible':False,
                           'shippingReady':False,'publicReleasePermitted':False,
                           'designVersion':bank['designVersion']}
    runtime['reviewGeometry']=geometry
    runtime['sourceBankSha256']=P.sha((source/'bank.json').read_bytes())
    runtime['motionContractSha256']=P.sha((P.PACK/'generated/entities'/entity/'motion-contract.json').read_bytes())
    files['runtime.review.json']=P.encoded(runtime)
    files['manifest.json']=P.encoded({'entityId':entity,'reviewOnly':True,'humanApproved':False,
        'runtimeEligible':False,'shippingReady':False,'publicReleasePermitted':False,
        'sourceBankSha256':runtime['sourceBankSha256'],'files':{key:P.sha(value) for key,value in files.items()},
        'nativeOrigin':origin,'nativeCanvas':[64,64],'packedPixelsPerNativePixel':1,
        'normalGameQa':normal_game_qa,'usage':'Loopback candidate review only. No default production replacement.'})
    destination=ROOT/'assets/production/internal-character-review'/config['folder']
    P.SOURCE.publish(files,destination,False)
    # Review HUD and battle art must come from the same original candidate.
    # The normal game otherwise falls back to the ROM-derived db_sub portrait,
    # which would make an apparently successful route an invalid art proof.
    hud_files={};hud_cells=[]
    hud_path=destination.relative_to(ROOT).as_posix()+'/hud-r01/'
    for key in ['main/cell_000']+[key for key in bank['cells'] if key.startswith('sub/')]:
        image=Image.open(source/bank['cells'][key]['image']).convert('RGBA')
        bounds=image.getchannel('A').getbbox();P.require(bounds is not None,'EMPTY_HUD_CELL '+key)
        crop=image.crop(bounds);name=key.replace('/','-')+'.png';data=P.PIXEL.png_bytes(crop)
        hud_files[name]=data
        row={'src':hud_path+name,'width':crop.width,'height':crop.height,
             'origin':[origin[0]-bounds[0],origin[1]-bounds[1]],'sha256':P.sha(data),
             'cell':int(key[-3:])}
        if key.startswith('main'):
            portrait={**row,'speciesId':SPECIES[entity],'entityId':entity,'nativeScale':2,
                      'sourceBank':entity+'_main','sequenceId':0,
                      'derivation':'ORIGINAL_CANDIDATE_MAIN_CELL_000_VISIBLE_RGBA',
                      'originalCellSha256':bank['cells'][key]['sha256']}
        else:hud_cells.append(row)
    hud_files['manifest.json']=P.encoded({'entityId':entity,'sourceBankSha256':runtime['sourceBankSha256'],
        'reviewOnly':True,'runtimeEligible':False,'publicReleasePermitted':False,'portrait':portrait,
        'battle':{'speciesId':SPECIES[entity],'cells':hud_cells,'sequences':[
            {'id':sequence['id'],'playbackMode':sequence['playbackMode'],
             'loopStartFrame':sequence.get('loopStartFrame',0),
             'frames':[{'cell':frame['cell'],'ticks':frame['ticks']} for frame in sequence['frames']]}
            for sequence in contract['sides']['sub']['sequences'] if sequence['id'] in [0,5,9]]}})
    P.SOURCE.publish(hud_files,destination/'hud-r01',False)
    print('EXPORTED',entity,destination)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('entity',choices=ALLOWED)
    build(parser.parse_args().entity)
