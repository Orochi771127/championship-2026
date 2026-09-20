"""Prepare/import bounded multi-character image jobs; no network or paid calls.

Reuses source review, native decoder, palette relations and complete-bank packing.
Generation outputs are candidates until independent visual and game acceptance.
"""
import argparse
import importlib.util
import json
import statistics
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sheet_jobs',ROOT/'scripts/character-sheet-job.py')
J=importlib.util.module_from_spec(spec);spec.loader.exec_module(J)
P=J.P
ALLOWED=('m003_nyokimon','m004_bubbmon','m005_pitchmon','m006_punimon','m007_botamon','m008_poyomon','m009_mokumon',
         'm010_yukimibotamon','m011_yuramon','m012_petimon','m101_caprimon','m102_koromon','m103_tanemon',
         'm104_tunomon','m105_tokomon')


def prep_batch(entity):
    # m102 r02 proved the white state needed the donor-measured two-pixel
    # occupancy tolerance. Keep that first immutable preparation as provenance.
    return 'batch-r04' if entity == 'm102_koromon' else 'batch-r02'


def load(entity):
    P.require(entity in ALLOWED,'OUTSIDE_AUTHORIZED_BATCH')
    acceptance=P.read(P.WORK/'full-sheet-r05/acceptance.json')
    P.require(acceptance['status']=='PASS_M001_LOCAL_VERTICAL_SLICE','M001_NOT_ACCEPTED')
    P.require(P.sha((P.WORK/'full-sheet-r05/compiled-final/bank.json').read_bytes())==acceptance['sourceBankSha256'],'STALE_M001_ACCEPTANCE')
    J.D.validate(entity)
    inv=P.read(J.D.BASE/entity/'inventory.json')
    setting=P.read(P.PACK/'pixel-v2/settings'/entity/'setting.json')
    return inv,setting


def source_images(entity,inv):
    archive=ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK';images={}
    for side in ('main','sub'):
        name=f'{entity}_{side}'
        doc=P.read(archive/'08_FULL_FAMILY_CONVERSION/digimon'/name/'cells.json')
        raw=P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon',name,doc)
        for cell in doc['cells']:
            key=f"{side}/cell_{cell['cellIndex']:03d}";im,_=P.SOURCE.render_native(cell,raw)
            b=inv['slots'][key]['nativeBounds'];o=inv['sourceOrigin']
            tile=Image.new('RGBA',(64,64));tile.alpha_composite(im,(o[0]+b[0],o[1]+b[1]));images[key]=tile
    return images


def is_explicit_restraint(observation):
    value=observation.lower()
    return ('restrain' in value or 'binding' in value) and 'pre-restraint' not in value


def build_generation_prompt(entity,inv,setting,job,review):
    """Build the paid full-sheet prompt from hash-bound review and identity data.

    This keeps slot order and donor semantics machine-derived.  The prompt never
    relies on a manually retyped cell list, which is the most expensive place
    for a production batch to drift.
    """
    identity=setting['identityDesign']
    fixed='; '.join(identity['fixedTraits'])
    face=' '.join(setting.get('faceRules',[]))
    ornament=' '.join(setting.get('ornamentRules',[]))
    lines=[
        'Create a complete ORIGINAL pixel-game animation sheet.',
        'Reference IMAGE 1 is our ORIGINAL identity seed and the only appearance/style authority.',
        ('IMAGE 2 is a research MOTION/LAYOUT GUIDE only: preserve every occupied slot pose, facing, '
         'whole-body deformation, expression visibility, restrained/unrestrained state, native scale and local origin, '
         'while replacing every commercial-character appearance with the original identity from IMAGE 1.'),
        'Do not copy source RGB colors, recognizable markings, face design or proprietary character appearance.',
        '',
        f"Original identity ({setting['designVersion']}): {setting['sourceUse']}",
        f'Fixed identity traits: {fixed}.',
        f'Face rules: {face}',
        f'Ornament rules: {ornament}',
        f"Morphology contract: {review['character']['morphology']}",
        f"Locomotion contract: {review['character']['locomotion']}",
        f"Expression contract: {review['character']['faceAndExpression']}",
        f"Appendage prohibition: {review['character']['appendages']}",
        f"Restraint contract: {review['character']['restraint']}",
        '',
        ('OUTPUT: exactly 8 columns by 6 rows, 48 equal square cells, transparent RGBA canvas, no grid lines, '
         'words, labels, numbers, ground shadows, glow halo, background, decorations, anti-aliasing or painterly effects.'),
        ('Each cell represents one logical 64x64 image enlarged uniformly 4x for this sheet. Keep the creature VERY SMALL '
         'inside each cell at the position and relative size shown by IMAGE 2, with broad transparent margins.'),
        ('Do not center, bottom-align, crop, rotate or resize cells independently. Use one shared scale and translation '
         'for the complete sheet.'),
        f"Shared native origin is {job['sourceOrigin']}. Preserve crisp nearest-neighbor pixel clusters and the limited palette.",
        'Gold-brown binding is a separate physical prop, never anatomy. No tweening and no invented actions.',
        ('Preserve expression changes per slot; the facial window may stretch, compress, shift or become occluded exactly '
         'as the guide shows. Do not paste one identical face on every pose.'),
        '',
        'Read occupied slots left-to-right, top-to-bottom. The following indices are instructions only; do not print them:'
    ]
    for number,key in enumerate(job['keys'],1):
        lines.append(f"{number}: {key}: {review['cellObservations'][key]}")
    blanks=', '.join(str(n+1) for n in job['blankPanels'])
    lines.extend(['',f'All remaining slots [{blanks}] must be fully transparent and empty.',
                  'This is production sprite art, not a poster or presentation character sheet.'])
    return '\n'.join(lines)+'\n'


def generation_request(entity):
    batch=prep_batch(entity)
    return {'provider':'HIGGSFIELD','model':'gpt_image_2_5','aspectRatio':'4:3','count':1,
            'quality':'high','resolution':'2k','background':'transparent','useUnlim':False,
            'references':['original-identity.png',
              (ROOT.parent/'_archive/character-sheet-jobs-v1'/entity/batch/'pose-guide.png').as_posix()],
            'policy':'one full sheet; targeted grouped repair only after structural and visual inspection'}


def prepare(entity):
    inv,setting=load(entity);images=source_images(entity,inv)
    palette=P.PIXEL.parse_palette(setting['palette'])
    seeds={p['key']:P.place_authored(p,palette,inv['sourceOrigin']) for p in setting['poses']}
    proposed=([(44,8,'red',(0,0),0),(47,8,'black',(0,0),0),(48,0,'black',(0,0),2),
               (61,63,'gray',(2,2),4),(64,0,'white',(0,0),2)]
              if entity=='m101_caprimon' else
              [(43,8,'red',(0,0),0),(46,8,'black',(0,0),0),(47,0,'black',(0,0),0),
               (60,10,'gray',(0,0),0),(63,0,'white',(0,0),2)]
              if entity=='m102_koromon' else
              [(43,8,'red',(0,0),0),(46,8,'black',(0,0),0),(47,0,'black',(0,0),0),
               (60,10,'gray',(0,0),0),(63,0,'white',(0,0),0)]
              if entity.startswith(('m003','m011','m012')) else
              [(43,8,'red',(0,0),0),(44,8,'black',(0,0),0),(45,0,'black',(0,0),0),
               (58,10,'gray',(0,0),0),(61,0,'white',(0,0),0)]
              if entity.startswith(('m009','m103')) else
              # This contract stops at main062, so the shared default's main064
              # does not exist and its main044/main061 targets are aliases of
              # main042/main010. The special states sit two indices lower.
              [(42,8,'red',(0,0),0),(45,8,'black',(0,0),0),(46,0,'black',(0,0),0),
               (59,10,'gray',(0,0),0),(62,0,'white',(0,0),0)]
              if entity=='m105_tokomon' else
              [(44,8,'red',(0,0),0),(47,8,'black',(0,0),0),(48,0,'black',(0,0),0),
               (61,10,'gray',(0,0),0),(64,0,'white',(0,0),0)])
    derived={};not_derived=[]
    canonical={r['canonical'] for r in inv['slots'].values()}
    for target,base,operation,translation,max_alpha_mismatch in proposed:
        key=f'main/cell_{target:03d}';parent=inv['slots'][f'main/cell_{base:03d}']['canonical']
        proof=P.palette_relation(images[parent],images[key])
        source_alpha=images[parent].getchannel('A')
        shifted_alpha=Image.new('L',source_alpha.size)
        shifted_alpha.paste(source_alpha,translation)
        target_alpha=images[key].getchannel('A')
        alpha_mismatch=sum((source>0)!=(target>0)
                           for source,target in zip(shifted_alpha.get_flattened_data(),target_alpha.get_flattened_data()))
        if proof is None and operation in ('black','red') and translation==(0,0) and alpha_mismatch==0:
            proof={'operationClass':'EXACT_ALPHA_ORIGINAL_COLOR_RULE','sourceAlphaSha256':P.sha(images[parent].getchannel('A').tobytes()),
                   'targetColorCount':len({p for p in images[key].get_flattened_data() if p[3]}),
                   'limitation':'Color relation is not a global donor LUT; use original authored face marks and palette, never donor RGB.'}
        if proof is None and alpha_mismatch<=max_alpha_mismatch:
            proof={'operationClass':'TRANSLATED_NEAR_ALPHA_ORIGINAL_COLOR_RULE',
                   'sourceAlphaSha256':P.sha(source_alpha.tobytes()),
                   'targetAlphaSha256':P.sha(target_alpha.tobytes()),
                   'translation':list(translation),'alphaOccupancyMismatchPixels':alpha_mismatch,
                   'maximumAllowedMismatchPixels':max_alpha_mismatch,
                   'targetColorCount':len({p for p in images[key].get_flattened_data() if p[3]}),
                   'limitation':'Donor alpha is proof only. Translate and recolor the original-character base; never transfer donor pixels or RGB.'}
        if proof:
            derived[key]={'base':parent,'operation':operation,'translation':list(translation),'sourceProof':proof}
        else:not_derived.append(key)
    keys=sorted(canonical-set(seeds)-set(derived))
    P.require(len(keys)<=48,'GRID_TOO_SMALL')
    job={'schemaVersion':1,'batchId':'hf-batch-20260920-01','entityId':entity,'grid':[8,6],
         'keys':keys,'blankPanels':list(range(len(keys),48)),'retainedMasters':list(seeds),'derived':derived,
         'nonDerivableSpecialCells':not_derived,'sourceOrigin':inv['sourceOrigin'],'nativeCanvas':[64,64],
         'inventorySha256':P.sha((J.D.BASE/entity/'inventory.json').read_bytes()),
         'reviewSha256':P.sha((J.D.BASE/entity/'review.json').read_bytes()),'designSha256':inv['designSha256'],
         'designVersion':setting['designVersion'],'sourceCounts':inv['counts'],
         'reviewScope':'STANDARD_POSE_READABILITY_ACCEPTED_MULTI_POSE_CANDIDATE_ONLY',
         'runtimeEligible':False,'artAccepted':False,'palette':setting['palette']}
    identity=Image.new('RGBA',(512,512))
    seed_images=list(seeds.values())
    if len(seed_images)==1:
        identity.alpha_composite(seed_images[0].resize((512,512),Image.Resampling.NEAREST))
    else:
        # A low pose alone underspecifies tall/curl donors. Show every retained
        # original key pose on one transparent reference without donor pixels.
        for index,image in enumerate(seed_images[:4]):
            y=128 if len(seed_images)<=2 else (index//2)*256
            identity.alpha_composite(image.resize((256,256),Image.Resampling.NEAREST),
                                     ((index%2)*256,y))
    destination=J.JOBS/entity/prep_batch(entity)
    review=P.read(J.D.BASE/entity/'review.json')
    prompt=build_generation_prompt(entity,inv,setting,job,review)
    P.SOURCE.publish({'job.json':P.encoded(job),'original-identity.png':P.PIXEL.png_bytes(identity),
                      'prompt.txt':prompt.encode('utf-8'),
                      'generation-request.json':P.encoded(generation_request(entity))},destination,False)
    guide=Image.new('RGBA',(2048,1536))
    for n,key in enumerate(keys):guide.alpha_composite(images[key].resize((256,256),Image.Resampling.NEAREST),(n%8*256,n//8*256))
    research=ROOT.parent/'_archive/character-sheet-jobs-v1'/entity/prep_batch(entity)
    P.SOURCE.publish({'pose-guide.png':P.PIXEL.png_bytes(guide)},research,False)
    print(entity,'GENERATE',len(keys),'RETAIN',len(seeds),'DERIVE',len(derived),'SPECIAL_AUTHOR',not_derived)


def inspect_sheet(entity,source):
    """Measure one completed full sheet before importing it.

    This proposes one scale and one translation for the complete provider
    sheet.  It intentionally never fits or recenters individual cells, so the
    provider's relative motion stays intact while the character returns to the
    donor's native-size envelope and source origin.
    """
    inv,_=load(entity);job=P.read(J.JOBS/entity/prep_batch(entity)/'job.json')
    image=Image.open(source).convert('RGBA')
    P.require(abs(image.width/image.height-4/3)<.015,'GRID_RATIO_DRIFT')
    P.require(image.getchannel('A').getextrema()[0]==0,'TRANSPARENT_ALPHA_REQUIRED')
    normalized=image.resize((8*64,6*64),Image.Resampling.NEAREST)
    measurements=[];ratios=[]
    for n,key in enumerate(job['keys']):
        panel=normalized.crop((n%8*64,n//8*64,n%8*64+64,n//8*64+64))
        actual=panel.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox()
        P.require(actual is not None,'EMPTY_SHEET_PANEL '+key)
        visible=inv['slots'][key]['visibleBounds'];origin=inv['sourceOrigin']
        expected=[visible[i]+origin[i%2] for i in range(4)]
        aw,ah=actual[2]-actual[0],actual[3]-actual[1]
        ew,eh=expected[2]-expected[0],expected[3]-expected[1]
        ratios.extend((ew/aw,eh/ah))
        measurements.append({'key':key,'panel':n,'actualAt64':list(actual),
                             'expected':expected,'actualSize':[aw,ah],'expectedSize':[ew,eh]})
    scale=max(1,min(64,round(64*statistics.median(ratios))))
    scaled=image.resize((8*scale,6*scale),Image.Resampling.NEAREST)
    deltas=[]
    for n,item in enumerate(measurements):
        panel=scaled.crop((n%8*scale,n//8*scale,n%8*scale+scale,n//8*scale+scale))
        actual=panel.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox()
        deltas.append((item['expected'][0]-actual[0],item['expected'][1]-actual[1]))
    offset=[round(statistics.median(value[0] for value in deltas)),
            round(statistics.median(value[1] for value in deltas))]
    unexpected=[]
    for n in job['blankPanels']:
        panel=scaled.crop((n%8*scale,n//8*scale,n%8*scale+scale,n//8*scale+scale))
        if panel.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox():
            unexpected.append(n)
    print(json.dumps({'entityId':entity,'source':source.as_posix(),'sourceSize':list(image.size),
                      'alphaExtrema':list(image.getchannel('A').getextrema()),
                      'suggestedSampleSize':scale,'suggestedSharedOffset':offset,
                      'unexpectedOccupiedPanels':unexpected,'measurements':measurements},indent=2))


def import_sheet(entity,source,job_id,sample_size,offset,output):
    inv,setting=load(entity);folder=J.JOBS/entity/prep_batch(entity);job=P.read(folder/'job.json')
    donor_review=P.read(J.D.BASE/entity/'review.json')
    P.require(job['inventorySha256']==P.sha((J.D.BASE/entity/'inventory.json').read_bytes()),'INVENTORY_DRIFT')
    P.require(job['reviewSha256']==P.sha((J.D.BASE/entity/'review.json').read_bytes()),'REVIEW_DRIFT')
    P.require(job['designSha256']==inv['designSha256'],'IDENTITY_DRIFT')
    palette=P.PIXEL.parse_palette(setting['palette']);image=Image.open(source).convert('RGBA')
    P.require(abs(image.width/image.height-4/3)<.015,'GRID_RATIO_DRIFT')
    P.require(image.getchannel('A').getextrema()[0]==0,'TRANSPARENT_ALPHA_REQUIRED')
    small=image.resize((8*sample_size,6*sample_size),Image.Resampling.NEAREST)
    # Restraint is a separate original gold prop, not a recolor of body
    # features.  Only cells explicitly reviewed as restrained may use those
    # extra colors; ordinary horns, eyes and accents stay in the OC palette.
    restraint_keys={key for key,observation in donor_review['cellObservations'].items()
                    if is_explicit_restraint(observation)}
    masters={p['key']:P.place_authored(p,palette,inv['sourceOrigin']) for p in setting['poses']};reviews=[]
    for n,key in enumerate(job['keys']):
        panel=small.crop((n%8*sample_size,n//8*sample_size,n%8*sample_size+sample_size,n//8*sample_size+sample_size))
        panel.putdata(quantize_repair(panel,palette,128,key in restraint_keys))
        b=panel.getbbox();dx,dy=offset
        P.require(b and 0<=b[0]+dx<b[2]+dx<=64 and 0<=b[1]+dy<b[3]+dy<=64,'EMPTY_OR_CLIPPED '+key)
        tile=Image.new('RGBA',(64,64));tile.alpha_composite(panel,tuple(offset));masters[key]=tile
        if entity=='m003_nyokimon' and key=='main/cell_063':
            # This donor white cell has a distinct alpha contour. Author its
            # original contour once, then fill deterministically.
            masters[key]=P.derive_silhouette(tile,(255,255,255,255))
        o=inv['sourceOrigin'];v=inv['slots'][key]['visibleBounds']
        expected=[v[i]+o[i%2] for i in range(4)];actual=list(tile.getbbox())
        reviews.append({'key':key,'panel':n,'sourceVisibleBounds':expected,'candidateVisibleBounds':actual,
                        'boundsDelta':[actual[i]-expected[i] for i in range(4)],'poseExpressionRestraintQa':'PENDING'})
    for key,rule in job['derived'].items():
        base=masters[rule['base']];op=rule['operation']
        translation=tuple(rule.get('translation',(0,0)))
        if translation!=(0,0):
            translated=Image.new('RGBA',base.size)
            translated.alpha_composite(base,translation)
            base=translated
        if op in ('white','black'):
            tile=P.derive_silhouette(base,(255,255,255,255) if op=='white' else (0,0,0,255))
            if op=='black' and rule['sourceProof']['targetColorCount']>1:
                tile.putdata([(255,255,255,255) if p==palette[4] else q for p,q in zip(base.get_flattened_data(),tile.get_flattened_data())])
        elif op=='gray':
            g=base.convert('L');tile=Image.merge('RGBA',(g,g,g,base.getchannel('A')))
        else:
            tile=base.copy();tile.putdata([(0,0,0,0) if p[3]==0 else (102,34,22,255) if sum(p[:3])<240 else (220,72,28,255) if sum(p[:3])<520 else (255,206,91,255) for p in base.get_flattened_data()])
        masters[key]=tile
    if entity=='m010_yukimibotamon':
        # These three donor states use contours that differ from the ordinary
        # compact master, so their alpha must be authored by the sheet.  Their
        # state color is still deterministic: provider color must not decide a
        # black silhouette, stone gray or white evolution silhouette.
        black_source=masters['main/cell_048']
        black=P.derive_silhouette(black_source,(0,0,0,255))
        black.putdata([(255,255,255,255) if source in palette[4:6] else target
                       for source,target in zip(black_source.get_flattened_data(),black.get_flattened_data())])
        masters['main/cell_048']=black
        stone_source=masters['main/cell_061']
        gray=stone_source.convert('L')
        masters['main/cell_061']=Image.merge('RGBA',(gray,gray,gray,stone_source.getchannel('A')))
        masters['main/cell_064']=P.derive_silhouette(masters['main/cell_064'],(255,255,255,255))
    if entity in ('m011_yuramon','m012_petimon'):
        # The compact black and stone states have donor-specific contours that
        # are not alpha-equivalent to the ordinary identity seed for these
        # contracts. Author those two contours once in the whole sheet, then
        # apply state colors without another generation or provider-selected
        # special-state colors.
        black_source=masters['main/cell_047']
        black=P.derive_silhouette(black_source,(0,0,0,255))
        black.putdata([(255,255,255,255) if source in palette[4:6] else target
                       for source,target in zip(black_source.get_flattened_data(),black.get_flattened_data())])
        masters['main/cell_047']=black
        stone_source=masters['main/cell_060']
        gray=stone_source.convert('L')
        masters['main/cell_060']=Image.merge('RGBA',(gray,gray,gray,stone_source.getchannel('A')))
    plan={'slots':{k:{**v,'sourceTranslationFromCanonical':v['translation']} for k,v in inv['slots'].items()}}
    source_unexpected_panels=[n for n in job['blankPanels'] if small.crop(
        (n%8*sample_size,n//8*sample_size,n%8*sample_size+sample_size,n//8*sample_size+sample_size)
    ).getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox()]
    meta={'designVersion':entity+'-hf-batch-r01','sourceOrigin':inv['sourceOrigin'],
          'authoredMasters':len(job['retainedMasters']),'derivedMasters':len(job['derived']),'generatedCandidateMasters':len(job['keys']),
          'deliveredSlots':inv['counts']['slots'],'requiredSlots':inv['counts']['slots'],
          'availableSequences':inv['counts']['sequences'],'requiredSequences':inv['counts']['sequences'],
          'generationTool':'HIGGSFIELD','modelVersion':'gpt_image_2_5','higgsfieldCalls':1,'generationCalls':1,
          'providerJobId':job_id,'sourceImageSha256':P.sha(source.read_bytes()),
          'normalization':{'sampleSize':sample_size,'sharedOffset':offset,'perCellResize':False,'bboxRecenter':False},
          'donorReviewSha256':job['reviewSha256'],'identityReview':'PENDING_MULTI_POSE',
          # A provider may draw inside panels that the manifest explicitly
          # reserves as blank. Preserve that raw-sheet evidence, but never
          # import it as a master or treat it as an unresolved bank panel.
          'sourceUnexpectedOccupiedPanels':source_unexpected_panels,
          'ignoredOutOfManifestPanels':source_unexpected_panels,
          'unexpectedOccupiedPanels':[]}
    J.M.assemble(masters,plan,{'entityId':entity,'palette':setting['palette']},{},reviews,meta,J.JOBS/entity/output,job)


def inspect_repairs(entity):
    """Measure repair sheets without mutating or accepting their artwork.

    The suggestion is one scale and one translation per sheet.  It is evidence
    for a manual choice, never a per-cell auto-fit.
    """
    inv,_=load(entity);folder=J.JOBS/entity/'repair-batch-r01';report=[]
    for kind in ('bound','normal'):
        job_path=folder/f'{kind}-job.json';source=folder/f'{kind}-raw.png'
        if not job_path.exists() and not source.exists():
            continue
        P.require(job_path.exists() and source.exists(),'INCOMPLETE_REPAIR_GROUP '+kind)
        job=P.read(job_path)
        image=Image.open(source).convert('RGBA');cols,rows=job['grid']
        P.require(image.getchannel('A').getextrema()[0]==0,'TRANSPARENT_ALPHA_REQUIRED')
        normalized=image.resize((cols*64,rows*64),Image.Resampling.NEAREST)
        measurements=[];ratios=[]
        for n,key in enumerate(job['keys']):
            panel=normalized.crop((n%cols*64,n//cols*64,n%cols*64+64,n//cols*64+64))
            alpha=panel.getchannel('A').point(lambda value:255 if value>=128 else 0)
            actual=alpha.getbbox();P.require(actual is not None,'EMPTY_REPAIR_PANEL '+key)
            visible=inv['slots'][key]['visibleBounds'];origin=inv['sourceOrigin']
            expected=[visible[i]+origin[i%2] for i in range(4)]
            aw,ah=actual[2]-actual[0],actual[3]-actual[1]
            ew,eh=expected[2]-expected[0],expected[3]-expected[1]
            ratios.extend((ew/aw,eh/ah))
            measurements.append({'key':key,'panel':n,'actualAt64':list(actual),
                                 'expected':expected,'actualSize':[aw,ah],'expectedSize':[ew,eh]})
        scale=max(1,min(64,round(64*statistics.median(ratios))))
        scaled=image.resize((cols*scale,rows*scale),Image.Resampling.NEAREST)
        deltas=[]
        for n,item in enumerate(measurements):
            panel=scaled.crop((n%cols*scale,n//cols*scale,n%cols*scale+scale,n//cols*scale+scale))
            actual=panel.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox()
            deltas.append((item['expected'][0]-actual[0],item['expected'][1]-actual[1]))
        offset=[round(statistics.median(value[0] for value in deltas)),
                round(statistics.median(value[1] for value in deltas))]
        unexpected=[]
        for n in range(len(job['keys']),cols*rows):
            panel=scaled.crop((n%cols*scale,n//cols*scale,n%cols*scale+scale,n//cols*scale+scale))
            if panel.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox():
                unexpected.append(n)
        report.append({'kind':kind,'source':source.as_posix(),'sourceSize':list(image.size),
                       'grid':job['grid'],'alphaExtrema':list(image.getchannel('A').getextrema()),
                       'suggestedSampleSize':scale,'suggestedSharedOffset':offset,
                       'unexpectedOccupiedPanels':unexpected,'measurements':measurements})
    print(json.dumps({'entityId':entity,'reports':report},indent=2))


def quantize_repair(image,palette,threshold,allow_restraint):
    restraint=[(89,65,29,255),(193,139,38,255),(250,208,101,255)]
    colors=palette[1:]+(restraint if allow_restraint else [])
    return [(0,0,0,0) if pixel[3]<threshold else
            min(colors,key=lambda color:sum((color[channel]-pixel[channel])**2 for channel in range(3)))
            for pixel in image.get_flattened_data()]


def import_repairs(entity):
    inv,setting=load(entity);palette=P.PIXEL.parse_palette(setting['palette'])
    folder=J.JOBS/entity/'repair-batch-r01';plan=P.read(folder/'import-plan.json')
    P.require(plan['entityId']==entity and plan['alphaThreshold']==128,'INVALID_REPAIR_PLAN')
    base=J.JOBS/entity/plan['baseDirectory'];prior=P.read(base/'bank.json')
    P.require(prior['entityId']==entity and prior['sourceOrigin']==inv['sourceOrigin'],'REPAIR_BASE_IDENTITY_DRIFT')
    canonical={slot['canonical'] for slot in inv['slots'].values()}
    masters={key:Image.open(base/prior['cells'][key]['image']).convert('RGBA') for key in canonical}
    records={record['key']:record for record in P.read(base/'cell-review.json')}
    imported=[];normalizations=[];files={'repair-import-plan.json':(folder/'import-plan.json').read_bytes()}
    for group in plan['groups']:
        job=P.read(folder/f"{group['kind']}-job.json");source=folder/group['source']
        P.require(job['entityId']==entity and job['kind']==group['kind'],'REPAIR_JOB_DRIFT')
        P.require(P.sha(source.read_bytes())==group['sourceSha256'],'REPAIR_SOURCE_DRIFT')
        image=Image.open(source).convert('RGBA');cols,rows=job['grid'];sample=group['sampleSize']
        P.require(image.getchannel('A').getextrema()[0]==0,'TRANSPARENT_ALPHA_REQUIRED')
        small=image.resize((cols*sample,rows*sample),Image.Resampling.NEAREST)
        small.putdata(quantize_repair(small,palette,plan['alphaThreshold'],group['kind']=='bound'))
        unexpected=[]
        for n in range(len(job['keys']),cols*rows):
            panel=small.crop((n%cols*sample,n//cols*sample,n%cols*sample+sample,n//cols*sample+sample))
            if panel.getchannel('A').getbbox():unexpected.append(n)
        P.require(not unexpected,'UNEXPECTED_OCCUPIED_REPAIR_PANELS')
        dx,dy=group['sharedOffset']
        for n,key in enumerate(job['keys']):
            P.require(key in masters,'NON_CANONICAL_REPAIR_TARGET '+key)
            panel=small.crop((n%cols*sample,n//cols*sample,n%cols*sample+sample,n//cols*sample+sample))
            bounds=panel.getchannel('A').getbbox();P.require(bounds is not None,'EMPTY_REPAIR_PANEL '+key)
            P.require(0<=bounds[0]+dx<bounds[2]+dx<=64 and 0<=bounds[1]+dy<bounds[3]+dy<=64,'REPAIR_CLIPPED '+key)
            tile=Image.new('RGBA',(64,64));tile.alpha_composite(panel,(dx,dy));masters[key]=tile
            origin=inv['sourceOrigin'];visible=inv['slots'][key]['visibleBounds']
            expected=[visible[i]+origin[i%2] for i in range(4)]
            record=records.get(key,{'key':key})
            record.update({'repairGroup':group['kind'],'providerJobId':group['jobId'],
                           'sourcePanel':n,'sourceVisibleBounds':expected,
                           'candidateVisibleBounds':list(tile.getchannel('A').getbbox()),
                           'sharedNormalization':{'sampleSize':sample,'offset':[dx,dy]},
                           'semanticReview':group['semanticReview'],
                           'poseExpressionRestraintQa':'TARGETED_REPAIR_IMPORTED_FULL_REVIEW_PENDING'})
            records[key]=record;imported.append(key)
        files[f"repair-sources/{group['kind']}-raw.png"]=source.read_bytes()
        normalizations.append({'kind':group['kind'],'jobId':group['jobId'],'grid':job['grid'],
                               'sampleSize':sample,'sharedOffset':[dx,dy],
                               'perCellResize':False,'bboxRecenter':False,
                               'sourceSha256':group['sourceSha256']})
    # Stone is a deterministic state of the repaired low pose, so it must be
    # regenerated after main/cell_010 changes.
    deterministic=[]
    if entity=='m004_bubbmon':
        base_image=masters['main/cell_010'];gray=base_image.convert('L')
        masters['main/cell_061']=Image.merge('RGBA',(gray,gray,gray,base_image.getchannel('A')))
        deterministic.append({'key':'main/cell_061','base':'main/cell_010','operation':'grayscale'})
    for key,rule in plan.get('deterministicDerivations',{}).items():
        base_key=rule['base'];operation=rule['operation']
        P.require(key in masters and base_key in masters,'INVALID_DETERMINISTIC_DERIVATION '+key)
        base_image=masters[base_key]
        if operation=='grayscale':
            gray=base_image.convert('L')
            derived=Image.merge('RGBA',(gray,gray,gray,base_image.getchannel('A')))
        elif operation in ('black','white'):
            fill=(0,0,0,255) if operation=='black' else (255,255,255,255)
            derived=P.derive_silhouette(base_image,fill)
        elif operation=='black_with_pale_features':
            derived=P.derive_silhouette(base_image,(0,0,0,255))
            pale_sources={tuple(color) for color in rule.get('paleSourceColors',[
                rule.get('paleSourceColor',(255,240,181,255))])}
            pale_target=tuple(rule.get('paleTargetColor',(248,244,232,255)))
            derived.putdata([pale_target if source in pale_sources else target
                             for source,target in zip(base_image.get_flattened_data(),derived.get_flattened_data())])
        elif operation=='stone_gray':
            # Preserve a source-proven distinct petrified contour while
            # replacing provider-selected colors with a deterministic compact
            # three-tone stone palette. Alpha and internal light/dark regions
            # remain authored OC pixels; no donor RGB is transferred.
            dark=tuple(rule.get('darkColor',(78,82,75,255)))
            mid=tuple(rule.get('midColor',(135,140,126,255)))
            light=tuple(rule.get('lightColor',(196,201,184,255)))
            def stone(pixel):
                if pixel[3]==0:return (0,0,0,0)
                luminance=(pixel[0]*299+pixel[1]*587+pixel[2]*114)//1000
                return dark if luminance<64 else mid if luminance<160 else light
            derived=base_image.copy();derived.putdata([stone(pixel) for pixel in base_image.get_flattened_data()])
        elif operation=='binding_band':
            # Deterministic generic restraint prop for a reviewed bound cell
            # whose generated panel omitted it. This uses the accepted OC body
            # bounds only; no donor pixels or donor RGB are transferred.
            derived=base_image.copy();bounds=derived.getchannel('A').getbbox()
            P.require(bounds is not None,'EMPTY_BINDING_BASE '+base_key)
            x0,y0,x1,y1=bounds
            y=max(y0,min(y1-2,y0+round((y1-y0)*float(rule.get('heightRatio',.68)))))
            padding=int(rule.get('padding',0));draw=ImageDraw.Draw(derived)
            dark=tuple(rule.get('darkColor',(193,139,38,255)))
            light=tuple(rule.get('lightColor',(244,196,94,255)))
            left=max(0,x0-padding);right=min(63,x1-1+padding)
            alpha=base_image.getchannel('A')
            # Paint only over occupied OC pixels.  Extending to the bbox edges
            # made a one-pixel restraint look like a detached floor or pole on
            # very small creatures; clipping both tones to the body reads as a
            # physical wrap and cannot change the candidate silhouette.
            for x in range(left,right+1):
                if alpha.getpixel((x,y)):
                    draw.point((x,y),fill=dark)
                if y+1<64 and alpha.getpixel((x,y+1)):
                    draw.point((x,y+1),fill=light)
        elif operation=='binding_band_vertical':
            # Some very low body plans read a horizontal restraint as a ground
            # line.  Put the band across the body width instead, between the
            # facial window and rear appendage.  Geometry still comes only from
            # the accepted original candidate bbox.
            derived=base_image.copy();bounds=derived.getchannel('A').getbbox()
            P.require(bounds is not None,'EMPTY_BINDING_BASE '+base_key)
            x0,y0,x1,y1=bounds
            x=max(x0,min(x1-2,x0+round((x1-x0)*float(rule.get('widthRatio',.62)))))
            padding=int(rule.get('padding',0));draw=ImageDraw.Draw(derived)
            dark=tuple(rule.get('darkColor',(193,139,38,255)))
            light=tuple(rule.get('lightColor',(244,196,94,255)))
            top=max(0,y0-padding);bottom=min(63,y1-1+padding)
            alpha=base_image.getchannel('A')
            for y in range(top,bottom+1):
                if alpha.getpixel((x,y)):
                    draw.point((x,y),fill=dark)
                if x+1<64 and alpha.getpixel((x+1,y)):
                    draw.point((x+1,y),fill=light)
        else:
            raise ValueError('UNKNOWN_DETERMINISTIC_DERIVATION '+operation)
        masters[key]=derived
        record=records.get(key,{'key':key});record.update({
            'deterministicDerivation':{'base':base_key,'operation':operation},
            'semanticReview':rule['evidence'],
            'candidateVisibleBounds':list(derived.getchannel('A').getbbox()),
            'poseExpressionRestraintQa':'DETERMINISTIC_SPECIAL_STATE_FULL_REVIEW_PENDING'})
        records[key]=record
        deterministic.append({'key':key,'base':base_key,'operation':operation,'evidence':rule['evidence']})
    anchor_corrections=[]
    for key,correction in plan.get('anchorCorrections',{}).items():
        P.require(key in masters and len(correction['translation'])==2,'INVALID_ANCHOR_CORRECTION '+key)
        dx,dy=correction['translation'];source_image=masters[key]
        corrected=Image.new('RGBA',(64,64));corrected.alpha_composite(source_image,(dx,dy))
        P.require(corrected.getchannel('A').getbbox() is not None,'EMPTY_ANCHOR_CORRECTION '+key)
        masters[key]=corrected
        record=records.get(key,{'key':key});record.update({
            'deterministicAnchorCorrection':[dx,dy],
            'anchorCorrectionEvidence':correction['evidence'],
            'candidateVisibleBounds':list(corrected.getchannel('A').getbbox()),
            'poseExpressionRestraintQa':'DONOR_BOUNDS_ANCHOR_CORRECTED_FULL_REVIEW_PENDING'})
        records[key]=record
        anchor_corrections.append({'key':key,'translation':[dx,dy],'evidence':correction['evidence']})
    assembly_plan={'slots':{key:{**slot,'sourceTranslationFromCanonical':slot['translation']}
                            for key,slot in inv['slots'].items()}}
    changed=[]
    for key,record in prior['cells'].items():
        expected=Image.new('RGBA',(64,64));expected.alpha_composite(masters[record['canonical']],tuple(record['translation']))
        if Image.open(base/record['image']).convert('RGBA').tobytes()!=expected.tobytes():changed.append(key)
    metadata={'designVersion':entity+'-'+plan['outputDirectory'].replace('candidate-',''),'repairSourceBankSha256':P.sha((base/'bank.json').read_bytes()),
              'repairedMasters':imported,'deterministicallyRegenerated':deterministic,'changedSlots':changed,
              'repairNormalizations':normalizations,'generationTool':'HIGGSFIELD','modelVersion':'gpt_image_2_5',
              'higgsfieldCalls':prior.get('higgsfieldCalls',1)+len(plan['groups']),
              'generationCalls':prior.get('generationCalls',1)+len(plan['groups']),
              'repairProviderJobIds':[group['jobId'] for group in plan['groups']],
              'deterministicAnchorCorrections':anchor_corrections,
              'fullMotionQa':'PENDING_ALL_GENERATED_CELLS','normalGameQa':'NOT_RUN',
              'artReview':'PENDING','runtimeEligible':False}
    mapping={'baseBankSha256':metadata['repairSourceBankSha256'],'importPlan':plan,
             'repairJobs':[P.read(folder/f"{group['kind']}-job.json") for group in plan['groups']]}
    destination=J.JOBS/entity/plan['outputDirectory']
    J.M.assemble(masters,assembly_plan,prior,files,list(records.values()),metadata,destination,mapping)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('entity',choices=ALLOWED);ap.add_argument('--prepare',action='store_true')
    ap.add_argument('--inspect-sheet',type=Path)
    ap.add_argument('--inspect-repairs',action='store_true')
    ap.add_argument('--import-repairs',action='store_true')
    ap.add_argument('--import-sheet',type=Path);ap.add_argument('--job-id');ap.add_argument('--sample-size',type=int,default=64)
    ap.add_argument('--offset',nargs=2,type=int,default=[0,0]);ap.add_argument('--output',default='candidate-hf-batch-r01');a=ap.parse_args()
    if a.prepare:prepare(a.entity)
    elif a.inspect_sheet:inspect_sheet(a.entity,a.inspect_sheet)
    elif a.inspect_repairs:inspect_repairs(a.entity)
    elif a.import_repairs:import_repairs(a.entity)
    elif a.import_sheet and a.job_id:import_sheet(a.entity,a.import_sheet,a.job_id,a.sample_size,a.offset,a.output)
    else:ap.error('Choose prepare or import with completed provider job ID')
