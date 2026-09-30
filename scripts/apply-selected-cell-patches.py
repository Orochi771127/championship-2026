"""Apply an explicit, hash-pinned artist pixel patch manifest to a selected bank.

All image sources are original candidate masters. Source motion metadata is
reused by the existing assembler; donor RGB is never read by this renderer.
"""
import argparse
import importlib.util
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('selected_patch_reuse',ROOT/'scripts/selected-character-sheet.py')
S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)


def apply_original_color_mask(tile, edits, palette):
    """Keep explicitly reviewed native lights/flames inside an original silhouette."""
    for x,y,index in edits:
        S.P.require(0<=x<tile.width and 0<=y<tile.height,'COLOR_MASK_OUTSIDE_CANVAS')
        S.P.require(tile.getpixel((x,y))[3]==255,'COLOR_MASK_OUTSIDE_ORIGINAL')
        S.P.require(0<=index<len(palette) and palette[index][3]==255,'COLOR_MASK_INVALID_COLOR')
        tile.putpixel((x,y),palette[index])
    return tile


def build(jobdir, manifest_path):
    manifest=S.P.read(manifest_path);job=S.P.read(jobdir/'job.json')
    base=jobdir/manifest['baseDirectory'];output=jobdir/manifest['outputDirectory']
    S.P.require(base.resolve().parent==jobdir.resolve() and output.resolve().parent==jobdir.resolve(),'PATH_OUTSIDE_JOB')
    S.P.require(not output.exists(),'IMMUTABLE_OUTPUT_EXISTS')
    S.P.require(S.sha(jobdir/'job.json')==manifest['jobSha256'],'JOB_DRIFT')
    S.P.require(S.sha(base/'bank.json')==manifest['baseBankSha256'],'BASE_BANK_DRIFT')
    for field in ('selectedConcept','inventory','review','motionContract'):
        S.P.require(S.sha(job[field]['path'])==job[field]['sha256'],'INPUT_DRIFT_'+field)
    prior=S.P.read(base/'bank.json');inv=S.P.read(Path(job['inventory']['path']))
    palette=S.P.PIXEL.parse_palette(job['palette'])
    # The inventory also owns sparse independent states (for example eye-only
    # Main cells). They are deliberately absent from generated job keys, but a
    # later bounded patch must retain their verified prior pixels.
    master_keys={row['canonical'] for row in inv['slots'].values()}-set(job['derived'])
    S.P.require(set(job['keys'])<=master_keys,'JOB_MASTER_OUTSIDE_INVENTORY')
    masters={}
    for key in sorted(master_keys):
        row=prior['cells'][key];path=base/row['image']
        S.P.require(S.sha(path)==row['sha256'],'ORIGINAL_MASTER_DRIFT')
        masters[key]=Image.open(path).convert('RGBA')
    reviews={r['key']:r for r in S.P.read(base/'cell-review.json')}
    for key, patch in manifest['patches'].items():
        S.P.require(key in master_keys,'UNKNOWN_PATCH_KEY')
        if patch.get('replaceOriginalGeneratedImage'):
            replacement=patch['replaceOriginalGeneratedImage'];path=jobdir/replacement['path']
            S.P.require(path.resolve().is_relative_to(jobdir.resolve()),'PATCH_IMAGE_OUTSIDE_JOB')
            S.P.require(S.sha(path)==replacement['sha256'],'PATCH_IMAGE_DRIFT')
            image=Image.open(path).convert('RGBA')
            S.P.require(image.size==(64,64) and set(image.getchannel('A').get_flattened_data())<={0,255},'INVALID_PATCH_IMAGE')
            masters[key]=image
        if patch.get('copyOriginalMaster'):
            S.P.require(patch['copyOriginalMaster'] in masters,'UNKNOWN_ORIGINAL_PARENT')
            masters[key]=masters[patch['copyOriginalMaster']].copy()
        im=masters[key]
        if patch.get('deformOriginalRegion'):
            edit=patch['deformOriginalRegion'];src=tuple(edit['sourceRect']);dst=tuple(edit['targetRect'])
            S.P.require(im.getbbox()==src,'EXPLICIT_DEFORMATION_SOURCE_RECT_DRIFT')
            S.P.require(0<=dst[0]<dst[2]<=64 and 0<=dst[1]<dst[3]<=64,'DEFORMATION_CLIPS')
            S.P.require(bool(edit.get('artistReason')),'ARTIST_DEFORMATION_REASON_REQUIRED')
            fragment=im.crop(src).resize((dst[2]-dst[0],dst[3]-dst[1]),Image.Resampling.NEAREST)
            im=Image.new('RGBA',(64,64));im.alpha_composite(fragment,(dst[0],dst[1]))
        if patch.get('translate'):
            dx,dy=patch['translate'];b=im.getbbox()
            S.P.require(0<=b[0]+dx<b[2]+dx<=64 and 0<=b[1]+dy<b[3]+dy<=64,'TRANSLATION_CLIPS')
            tile=Image.new('RGBA',(64,64));tile.alpha_composite(im,(dx,dy));im=tile
        for edit in patch.get('fills',[]):
            x0,y0,x1,y1=edit['rect'];color=palette[edit['paletteIndex']]
            for y in range(y0,y1):
                for x in range(x0,x1):
                    if not im.getpixel((x,y))[3]:continue
                    if edit.get('interiorOnly',False) and not all(0<=x+dx<64 and 0<=y+dy<64 and im.getpixel((x+dx,y+dy))[3] for dx,dy in ((-1,0),(1,0),(0,-1),(0,1))):continue
                    im.putpixel((x,y),color)
        for x,y,index in patch.get('pixels',[]):
            S.P.require(0<=x<64 and 0<=y<64,'PATCH_OUTSIDE_CANVAS')
            if patch.get('requireOpaque',True):S.P.require(im.getpixel((x,y))[3]==255,'PATCH_OUTSIDE_ORIGINAL_BODY_'+key)
            im.putpixel((x,y),palette[index])
        masters[key]=im
        reviews[key]={**reviews[key],'artistPatchSha256':S.sha(manifest_path),'patchReason':patch['reason'],
                      'artAccepted':False,'poseExpressionRestraintQa':'PENDING_VISUAL_REVIEW'}
    for key in manifest.get('normalColorPatchedKeys',[]):
        S.P.require(key in manifest['patches'] and key in job['postprocessStates'],'UNDECLARED_NORMAL_STATE_PATCH')
        im=masters[key];op=job['postprocessStates'][key]
        if op=='gray':
            gray=im.convert('L');masters[key]=Image.merge('RGBA',(gray,gray,gray,im.getchannel('A')))
        elif op=='red':
            im.putdata([(0,0,0,0) if not p[3] else (max(60,min(255,int(sum(p[:3])/3*1.3))),int(p[1]*.35),int(p[2]*.2),255) for p in im.get_flattened_data()])
        elif op in ('black','white'):
            v=255 if op=='white' else 0;masters[key]=S.P.derive_silhouette(im,(v,v,v,255))
        else:raise ValueError('UNSUPPORTED_PATCH_STATE_'+op)
    # Existing distinct black-state alpha can be recolored without generating
    # again. Pale face marks are explicit original-art coordinates only.
    for key,op in job['postprocessStates'].items():
        if op!='black':continue
        tile=S.P.derive_silhouette(masters[key],(0,0,0,255))
        for x,y in manifest.get('originalLightMasks',{}).get(key,[]):
            S.P.require(tile.getpixel((x,y))[3]==255,'LIGHT_MASK_OUTSIDE_ORIGINAL')
            tile.putpixel((x,y),(255,255,255,255))
        apply_original_color_mask(tile,manifest.get('originalColorMasks',{}).get(key,[]),palette)
        masters[key]=tile
    for key,rule in job['derived'].items():
        im=masters[rule['base']];op=rule['operation']
        if op in ('black','white'):
            v=255 if op=='white' else 0;tile=S.P.derive_silhouette(im,(v,v,v,255))
            for x,y in manifest.get('originalLightMasks',{}).get(key,[]):
                S.P.require(im.getpixel((x,y))[3]==255,'LIGHT_MASK_OUTSIDE_ORIGINAL')
                tile.putpixel((x,y),(255,255,255,255))
        elif op=='gray':
            gray=im.convert('L');tile=Image.merge('RGBA',(gray,gray,gray,im.getchannel('A')))
        elif op=='red':
            tile=im.copy()
            tile.putdata([(0,0,0,0) if not p[3] else (max(60,min(255,int(sum(p[:3])/3*1.3))),int(p[1]*.35),int(p[2]*.2),255) for p in im.get_flattened_data()])
        else:
            raise ValueError('UNSUPPORTED_PATCH_DERIVATION_'+op)
        if key in manifest.get('originalColorMasks',{}):
            S.P.require(op=='black','COLOR_MASK_REQUIRES_BLACK_STATE')
            apply_original_color_mask(tile,manifest['originalColorMasks'][key],palette)
        masters[key]=tile
        reviews[key]={**reviews[key],'artistPatchSha256':S.sha(manifest_path),'artAccepted':False,
                      'poseExpressionRestraintQa':'PENDING_PARENT_AND_LIGHT_MASK_REVIEW'}
    metadata={**prior,'designVersion':manifest['designVersion'],'higgsfieldCalls':len(manifest['providerJobIds']),
              'providerJobIds':manifest['providerJobIds'],'pixelPatchManifestSha256':S.sha(manifest_path),
              'artReview':'PENDING_VISUAL_REVIEW','runtimeEligible':False,
              'repairedMasters':list(manifest['patches']),'originalLightMasks':manifest.get('originalLightMasks',{}),
              'originalColorMasks':manifest.get('originalColorMasks',{}),
              'explicitArtistDeformations':[k for k,p in manifest['patches'].items() if p.get('deformOriginalRegion')],
              'automaticPerFrameFit':False}
    for name in ('cells','sequences'):metadata.pop(name,None)
    plan={'slots':{k:{**v,'sourceTranslationFromCanonical':v['translation']} for k,v in inv['slots'].items()}}
    S.F.assemble(masters,plan,prior,{},list(reviews.values()),metadata,output,manifest)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--job',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True)
    a=p.parse_args();build(a.job.resolve(),a.manifest.resolve())
