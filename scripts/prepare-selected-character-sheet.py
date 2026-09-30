"""Prepare reviewed selected concepts using the existing donor decoder/assembler.

Offline only. Does not submit paid jobs or guess a new character's semantics.
Each character supplies a reviewed brief and exact source-verified derivations.
"""
import argparse
import importlib.util
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('selected_shared', ROOT/'scripts/selected-character-sheet.py')
S = importlib.util.module_from_spec(spec); spec.loader.exec_module(S)
gate_spec = importlib.util.spec_from_file_location('morphology_gate', ROOT/'scripts/character-morphology-gate.py')
M = importlib.util.module_from_spec(gate_spec); gate_spec.loader.exec_module(M)
table_spec = importlib.util.spec_from_file_location('source_table_preflight', ROOT/'scripts/prepare-character-batch-preflight.py')
T = importlib.util.module_from_spec(table_spec); table_spec.loader.exec_module(T)


def generation_observation(config, review, key):
    if key not in config['postprocessStates']:
        return review['cellObservations'][key]
    # Keep the original review immutable. A separate reviewed shape description
    # prevents e.g. "white silhouette" competing with "normal colors" in one panel.
    observation = config.get('normalColorPoseObservations', {}).get(key)
    S.P.require(isinstance(observation, str) and observation.strip(),
                'NORMAL_COLOR_POSE_DESCRIPTION_REQUIRED_' + key)
    S.P.require(not re.search(r'\b(white|black|red|orange|gray|grey|grayscale|greyscale|silhouette|petrif\w*)\b', observation, re.I),
                'PALETTE_STATE_IN_GEOMETRY_DESCRIPTION_' + key)
    return observation + ' Draw the complete opaque character interior in its normal appearance palette, with a transparent exterior.'


def geometry_guide_tile(image, neutralize):
    if not neutralize:
        return image.copy()
    # Research guide only: retain the exact donor alpha contour and canvas while
    # removing special-state colors that could contradict the generation prompt.
    tile = Image.new('RGBA', image.size, (110, 120, 140, 255))
    tile.putalpha(image.getchannel('A'))
    return tile


def verify_palette_sub_pixels(source, target, palette, offset):
    """Audit-table RGB rounds 5-bit color; decoder truncates it (<=1/channel).
    Alpha and geometry must remain exact, and every visible pixel must map.
    """
    shifted=Image.new('RGBA',source.size);shifted.alpha_composite(source,tuple(offset))
    if shifted.getchannel('A').tobytes()!=target.getchannel('A').tobytes():return False
    entries=[(tuple(int(v) for v in k.split(',')),tuple(v)) for k,v in palette.items()]
    for p,q in zip(shifted.getdata(),target.getdata()):
        if not p[3]:continue
        matches={out for color,out in entries if color[3]==p[3] and max(abs(color[i]-p[i]) for i in range(3))<=1}
        if len(matches)!=1:return False
        mapped=next(iter(matches))
        if mapped[3]!=q[3] or max(abs(mapped[i]-q[i]) for i in range(3))>1:return False
    return True


def reviewed_donor_record(record, config):
    """Bind a new visual review without overwriting the frozen intake record."""
    replacement = config.get('reviewedDonorOverride')
    if not replacement:
        return record
    S.P.require(bool(config.get('donorReviewOverrideReason')), 'REVIEW_OVERRIDE_REASON_REQUIRED')
    S.P.require(S.sha(replacement['path']) == replacement['sha256'], 'REVIEW_OVERRIDE_DRIFT')
    review = S.P.read(Path(replacement['path']))
    S.P.require(review['entityId'] == record['entityId'], 'REVIEW_ENTITY_MISMATCH')
    S.P.require(review['inventorySha256'] == record['donorInventory']['sha256'], 'REVIEW_INVENTORY_MISMATCH')
    S.P.require(review['status'] == 'PASS_DONOR_REVIEW' and not review['unresolvedBlockingIssues'], 'REVIEW_NOT_COMPLETE')
    return {**record, 'donorReview': replacement}


def prepare(config_path):
    config = S.P.read(config_path)
    gate_dir = S.PACK/'selected-concept-jobs/m001_zurumon/stardrip-r01'
    gate_path = gate_dir/'acceptance-selected-pixel-r04.json'; gate = S.P.read(gate_path)
    S.P.require(gate['status']=='PASS_M001_SELECTED_LOCAL_VERTICAL_SLICE' and gate['nextEntityAllowed'], 'M001_GATE_REQUIRED')
    S.P.require(S.sha(gate_dir/gate['candidate']/'bank.json')==gate['sourceBankSha256'], 'M001_ACCEPTED_BANK_DRIFT')
    for proof in gate['proofs']:
        S.P.require(S.sha(gate_dir/proof['path'])==proof['sha256'], 'M001_PROOF_DRIFT')
    entity=config['entityId']; lock_path=S.PACK/'selected-art-intake-20260923/selection-lock.json'
    record=next(r for r in S.P.read(lock_path)['records'] if r['entityId']==entity)
    if config.get('donorInventoryOverride'):
        replacement=config['donorInventoryOverride']
        S.P.require(record['donorInventory'] is None and config.get('donorInventoryOverrideReason'),'ONLY_MISSING_INVENTORY_CAN_BE_ADDED')
        S.P.require(S.sha(replacement['path'])==replacement['sha256'],'INVENTORY_OVERRIDE_DRIFT')
        added=S.P.read(Path(replacement['path']))
        S.P.require(added['entityId']==entity and added['motionContractSha256']==record['motionContract']['sha256'],'INVENTORY_SOURCE_DRIFT')
        S.P.verify_lock(ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK',added['sourceFiles'])
        record={**record,'donorInventory':replacement}
    original_donor_review = record['donorReview']
    record = reviewed_donor_record(record, config)
    # A reviewed appearance repair is immutable and local to this job. Preserve
    # the historical roster selection and bind the replacement bytes explicitly.
    original_concept = record['concept']
    if config.get('selectedConceptOverride'):
        replacement = config['selectedConceptOverride']
        S.P.require(config.get('conceptOverrideReason'), 'CONCEPT_OVERRIDE_REASON_REQUIRED')
        S.P.require(S.sha(replacement['path']) == replacement['sha256'], 'CONCEPT_OVERRIDE_DRIFT')
        record = {**record, 'concept': replacement}
    morphology = M.validate(config.get('morphologyReceipt'), entity,
                           record['concept']['path'], record['donorInventory']['path'])
    for key in ('concept','donorInventory','donorReview','motionContract'):
        S.P.require(S.sha(record[key]['path'])==record[key]['sha256'], 'INPUT_DRIFT_'+key)
    inv=S.P.read(Path(record['donorInventory']['path'])); review=S.P.read(Path(record['donorReview']['path']))
    source_root=ROOT.parent/'自創腳色'
    profile_path=Path(config.get('sourceTableProfile', source_root/'批次開工準備_20260926/profiles'/f'{entity}.json'))
    profile=S.P.read(profile_path)
    images=S.B.source_images(entity,inv)
    independent_sub_checks = {}
    for key in config.get('independentSubCells', []):
        S.P.require(key.startswith('sub/') and key in inv['slots'], 'INDEPENDENT_SUB_KEY')
        S.P.require(review['status']=='PASS_DONOR_REVIEW' and key in review['cellObservations'], 'INDEPENDENT_SUB_NOT_REVIEWED')
        independent_sub_checks[key] = inv['slots'][key]['sourceRgbaSha256']
        row=next(r for r in profile['subAliases'] if int(r['subCell'])==int(key[-3:]))
        if row['classification']=='DETERMINISTIC_PALETTE_MAP':
            import json
            palette=json.loads(row['paletteMapping']);base=f"main/cell_{int(row['matchedMainCell']):03}"
            a=images[inv['slots'][base]['canonical']];b=images[key]
            dx,dy=int(row['offsetDx']),int(row['offsetDy'])
            S.P.require(verify_palette_sub_pixels(a,b,palette,(dx,dy)), 'PALETTE_SUB_SOURCE_PIXELS_'+key)
            independent_sub_checks[key]={'sourceRgbaSha256':inv['slots'][key]['sourceRgbaSha256'],'sourcePixelsVerified':True,'base':base,'paletteMapping':palette,'rgbQuantizationTolerance':1,'alphaAndGeometryExact':True}
    source_table_check=T.validate_source_profile(source_root, profile_path, inv, independent_sub_checks)
    S.P.require(review['status']=='PASS_DONOR_REVIEW' and config['allSourceContactSheetsReviewed'], 'CHARACTER_VISUAL_REVIEW_REQUIRED')
    images=S.B.source_images(entity,inv); canonical={v['canonical'] for v in inv['slots'].values()}
    derived=config['derived']
    for key, rule in derived.items():
        S.P.require(key in canonical and rule['base'] in canonical and rule['base'] not in derived, 'DERIVATION_COVERAGE_OR_ORDER')
        S.P.require(rule['operation'] in ('gray','white','black','red'), 'UNKNOWN_OPERATION')
        S.P.require(images[key].getchannel('A').tobytes()==images[rule['base']].getchannel('A').tobytes(), 'SPECIAL_SHAPE_NOT_EQUAL_'+key)
    markers = config.get('authoredMarkers', {})
    for key, marker in markers.items():
        S.P.require(key in canonical and key not in derived and marker.get('reviewReason'), 'MARKER_REVIEW_REQUIRED')
        points = marker.get('points', [])
        S.P.require(0 < len(points) <= 8 and len({tuple(p) for p in points}) == len(points), 'MARKER_POINTS_INVALID')
        bounds = inv['slots'][key]['visibleBounds']; origin = inv['slots'][key].get('canvasOrigin', inv['sourceOrigin'])
        S.P.require(bounds and (bounds[2]-bounds[0])*(bounds[3]-bounds[1]) <= 8, 'MARKER_SOURCE_NOT_SPARSE')
        S.P.require(all(len(p)==2 and all(type(c) is int for c in p) and bounds[0]+origin[0] <= p[0] < bounds[2]+origin[0] and bounds[1]+origin[1] <= p[1] < bounds[3]+origin[1] for p in points), 'MARKER_NATIVE_BOUNDS_DRIFT')
        S.P.require(marker.get('color') in ('#FFFFFF', '#000000'), 'MARKER_PALETTE_INVALID')
    keys=sorted(canonical-set(derived)-set(markers)); cols,rows=config['grid']
    S.P.require(len(keys)<=cols*rows, 'GRID_TOO_SMALL')
    S.P.require(set(config['postprocessStates']) <= set(keys), 'POSTPROCESS_KEY_NOT_GENERATED')
    observations = {key: generation_observation(config, review, key) for key in keys}
    destination=S.PACK/'selected-concept-jobs'/entity/config['jobName']
    research=ROOT.parent/'_archive/selected-character-jobs'/entity/config['jobName']
    S.P.require(not destination.exists() and not research.exists(), 'IMMUTABLE_JOB_EXISTS')
    concept=Image.open(record['concept']['path']).convert('RGBA')
    S.P.require(list(concept.size)==config['conceptSize'], 'CROP_DIMENSION_DRIFT')
    destination.mkdir(parents=True);research.mkdir(parents=True)
    concept.crop(tuple(config['identityCrop'])).save(destination/'original-identity.png')
    guide=Image.new('RGBA',(cols*256,rows*256),(235,237,241,255)); labeled=guide.copy(); d=ImageDraw.Draw(labeled)
    for n,key in enumerate(keys):
        xy=(n%cols*256,n//cols*256)
        tile=geometry_guide_tile(images[key], key in config['postprocessStates']).resize((256,256),Image.Resampling.NEAREST)
        guide.alpha_composite(tile,xy);labeled.alpha_composite(tile,xy);d.text((xy[0]+8,xy[1]+8),f'{n+1}: {key}',fill='black')
    guide.save(research/'pose-guide.png');labeled.save(research/'pose-guide-labeled.png')
    prompt=[f'Create one ORIGINAL pixel game sprite sheet, exactly {cols} columns x {rows} rows of equal square logical panels.',
      'IMAGE 1 is the sole character APPEARANCE authority. IMAGE 2 supplies only motion, facial visibility, orientation and fixed-canvas position.',
      config['appearanceBrief'],config['motionTranslation'],
      'Completely replace the source character appearance. No text, numbers, labels, dividers, music notes, speed lines, Z letters, stars floating outside the body, ground shadow, glow or backdrop.',
      f'Transparent RGBA. Each panel is a64x64 logical canvas; fixed origin{inv["sourceOrigin"]}, native pixel size1. Preserve broad empty margins, tiny source body scale and exact body locations. Do not center or bottom-align each pose.',
      'Keep all source side/front visibility changes, body tilt, rotation, flattened versus raised shape, and expression aperture. Do not turn the whole sequence into repeated front-facing idle.',
      'Restraint must follow this donor review exactly: '+review['character']['restraint'],
      'Only the explicitly configured derived cells are omitted. For each configured postprocess state, draw its own source-reviewed contour in normal original-character colors for deterministic recoloring.',
      'Crisp tiny pixel clusters, limited palette, hard edges, no soft gradients or antialiased illustration texture.',
      'Donor morphology: '+review['character']['morphology'], 'Donor face visibility: '+review['character']['faceAndExpression'],
      'Ordered panels, row-major; these labels are instructions and must NOT appear in the image:']
    for n,key in enumerate(keys):
        obs=observations[key]
        prompt.append(f'{n+1} row{n//cols+1} col{n%cols+1} {key}: {obs}')
    blank=list(range(len(keys),cols*rows))
    if blank:prompt.append('Leave these final panel numbers completely transparent: '+','.join(str(n+1) for n in blank))
    (destination/'prompt.txt').write_text('\n'.join(prompt)+'\n',encoding='utf-8')
    job={'schemaVersion':1,'entityId':entity,'displayName':config['displayName'],'designVersion':config['designVersion'],
      'selectedConcept':record['concept'],'selectionLockSha256':S.sha(lock_path),'grid':[cols,rows],'keys':keys,'blankPanels':blank,
      'derived':derived,'postprocessStates':config['postprocessStates'],'palette':config['palette'],'sourceOrigin':inv['sourceOrigin'],'nativeCanvas':[64,64],
      'inventory':record['donorInventory'],'review':record['donorReview'],'motionContract':record['motionContract'],'sourceCounts':inv['counts'],
      'runtimeEligible':False,'artAccepted':False,'retainedOldAppearanceMasters':[],
      'references':[str(destination/'original-identity.png'),str(research/'pose-guide.png')],
      'normalization':{'perFrameFit':False,'operation':'WHOLE_SHEET_NEAREST_SHARED_PALETTE_BINARY_ALPHA'},
      'requestSettings':{'model':'gpt_image_2_5','variant':'flare','aspect_ratio':'1:1','count':1,'quality':'high','resolution':'2k','background':'transparent','use_unlim':False},
      'm001AcceptanceSha256':S.sha(gate_path),'morphologyAcceptance':morphology,
      'sourceTableCrosscheck':source_table_check,
      'preparationConfigSha256':S.sha(config_path),'promptSha256':S.sha(destination/'prompt.txt')}
    job['referenceHashes']=[S.sha(p) for p in job['references']]
    if markers:
        job['authoredMarkers'] = markers
    if config.get('selectedConceptOverride'):
        job['previousSelectedConcept'] = original_concept
        job['conceptOverrideReason'] = config['conceptOverrideReason']
    if config.get('reviewedDonorOverride'):
        job['previousDonorReview'] = original_donor_review
        job['donorReviewOverrideReason'] = config['donorReviewOverrideReason']
    S.write_json(destination/'job.json',job)
    S.write_json(destination/'donor-visual-review.json',{'reviewer':'CODEX_AGENT','reviewedAt':'2026-09-25','status':'SOURCE_VISUALS_RECHECKED','notes':review['character'],'conceptInterpretation':config['motionTranslation'],'newAppearanceAccepted':False})
    print(f'PREPARED {entity}: {len(keys)} generation panels + {len(derived)} deterministic masters; {inv["counts"]["slots"]} delivered slots; origin {inv["sourceOrigin"]}')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--config',type=Path,required=True);prepare(p.parse_args().config)
