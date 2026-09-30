"""Offline selected-concept sheet adapter. Reuses native decoding and bank assembly.

No network, no paid submissions, no runtime promotion. Immutable job directories;
the complete sheet is sampled uniformly, never fitted or centered per frame.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


B = module('selected_batch_reuse', 'character-batch-job.py')
F = module('selected_fullsheet_reuse', 'm001-full-sheet.py')
P = B.P
PACK = P.PACK
PALETTE = ['#00000000', '#1A2B6B', '#5B7DFF', '#A990FF', '#C9D6FF', '#E6F3FF',
           '#FFD99E', '#F7C6FF', '#8ED6FF', '#FFFFFF', '#B98CFF', '#875242', '#C59154']


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def prepare(destination):
    destination = destination.resolve()
    P.require(destination.is_relative_to(PACK.resolve()), 'JOB_OUTSIDE_ART_PACK')
    P.require(not destination.exists(), 'IMMUTABLE_JOB_ALREADY_EXISTS')
    lockpath = PACK / 'selected-art-intake-20260923/selection-lock.json'
    lock = P.read(lockpath)
    entity = 'm001_zurumon'
    record = next(r for r in lock['records'] if r['entityId'] == entity)
    for field in ('concept', 'donorInventory', 'donorReview', 'motionContract'):
        P.require(sha(record[field]['path']) == record[field]['sha256'], 'INPUT_DRIFT_' + field)
    inv = P.read(Path(record['donorInventory']['path']))
    review = P.read(Path(record['donorReview']['path']))
    P.require(review['status'] == 'PASS_DONOR_REVIEW', 'DONOR_REVIEW_REQUIRED')
    images = B.source_images(entity, inv)
    canonical = {v['canonical'] for v in inv['slots'].values()}
    derived = {}
    for target, base, operation, translation, _ in B.special_proposals(entity, inv, images):
        key = f'main/cell_{target:03d}'
        parent = inv['slots'][f'main/cell_{base:03d}']['canonical']
        # Only exact alpha agreement is accepted. The different gray pose is
        # generated once in normal colors, then recolored without another call.
        if translation == (0, 0) and images[parent].getchannel('A').tobytes() == images[key].getchannel('A').tobytes():
            derived[key] = {'base': parent, 'operation': operation,
                            'sourceAlphaSha256': hashlib.sha256(images[key].getchannel('A').tobytes()).hexdigest()}
    keys = sorted(canonical - set(derived))
    P.require(len(keys) == 49 and len(derived) == 4, 'M001_CANONICAL_PROOF_CHANGED')
    research = ROOT.parent / '_archive/selected-character-jobs' / entity / destination.name
    P.require(not research.exists(), 'RESEARCH_JOB_ALREADY_EXISTS')
    destination.mkdir(parents=True)
    research.mkdir(parents=True)
    # This crop contains the four original pixel appearance views only, with no
    # donor, pose labels, cinematic hero artwork, or invented sleep/effect marks.
    concept = Image.open(record['concept']['path']).convert('RGB')
    P.require(concept.size == (1448, 1086), 'CONCEPT_CROP_DIMENSION_DRIFT')
    concept.crop((918, 162, 1428, 306)).save(destination / 'original-identity.png')
    guide = Image.new('RGBA', (1792, 1792), (235, 237, 241, 255))
    labeled = guide.copy()
    draw = ImageDraw.Draw(labeled)
    for n, key in enumerate(keys):
        xy = (n % 7 * 256, n // 7 * 256)
        tile = images[key].resize((256, 256), Image.Resampling.NEAREST)
        guide.alpha_composite(tile, xy)
        labeled.alpha_composite(tile, xy)
        draw.text((xy[0] + 8, xy[1] + 8), f'{n + 1}: {key}', fill='black')
    guide.save(research / 'pose-guide.png')
    labeled.save(research / 'pose-guide-labeled.png')
    job = {'schemaVersion': 1, 'entityId': entity, 'designVersion': 'selected-stardrip-r01',
           'selectedConcept': record['concept'], 'selectionLockSha256': sha(lockpath),
           'grid': [7, 7], 'keys': keys, 'blankPanels': [], 'derived': derived,
           'postprocessStates': {'main/cell_061': 'gray'}, 'palette': PALETTE,
           'sourceOrigin': inv['sourceOrigin'], 'nativeCanvas': [64, 64],
           'inventory': record['donorInventory'], 'review': record['donorReview'],
           'motionContract': record['motionContract'], 'sourceCounts': inv['counts'],
           'retainedOldAppearanceMasters': [], 'runtimeEligible': False, 'artAccepted': False,
           'references': [str(destination / 'original-identity.png'), str(research / 'pose-guide.png')],
           'normalization': {'perFrameFit': False, 'operation': 'WHOLE_SHEET_NEAREST_SHARED_PALETTE_BINARY_ALPHA'},
           'requestSettings': {'model': 'gpt_image_2_5', 'variant': 'flare', 'aspect_ratio': '1:1',
                               'count': 1, 'quality': 'high', 'resolution': '2k',
                               'background': 'transparent', 'use_unlim': False}}
    lines = [
        'Create one complete ORIGINAL game pixel sprite animation sheet, exactly 7 columns x 7 rows, 49 equal square panels.',
        'IMAGE 1 is the only APPEARANCE authority: our original StarDrip Slime. Blue/violet liquid blob, pale belly, dark blue outline, tiny warm gold star core, pink inner mouth, dark expressive eyes. Simplify details for tiny native pixels.',
        'IMAGE 2 is a MOTION and LAYOUT reference only. Replace the yellow character appearance completely with IMAGE 1 original blue slime. Preserve the pose, facing, open/closed eye, mouth aperture, deformation, floating droplets, binding and exact position of EACH corresponding slot.',
        'No generic identical happy face. Do not copy the yellow source design or colors. No new arms, legs, paws, wings, stars, sparkles, Z letters, spirals, shadows or backdrop.',
        'OUTPUT transparent RGBA square, no text, no numbers, no grid lines, no panels drawn on the image. Exactly 49 panels in row-major order.',
        'Each square panel represents a 64x64 logical canvas. Preserve the VERY SMALL native creature occupancy of IMAGE 2 (roughly 10-24 pixels wide, not a 50px icon). Keep broad empty transparent margins and one fixed scale for ALL panels.',
        'The fixed logical origin is (31,38) in each 64px panel. Match each source location including intentional airborne lift; never center or align the bottom of each sprite independently.',
        'Crisp pixel-art clusters, nearest-neighbor edges, no anti-aliasing, gradients, soft glow or illustration texture. Use the appearance reference palette, plus restrained brown/gold bands only in bound poses.',
        'Restraints are physical bands across the body, NOT decoration or color change. They compress and tilt WITH the pose, leaving the correct facial expression visible.',
        'The gray/stone pose panel must have its exact distinct pose drawn in NORMAL BLUE identity colors; our deterministic pipeline converts that one to grayscale later.',
        'Morphology: ' + review['character']['morphology'],
        'Expression contract: ' + review['character']['faceAndExpression'],
        'Ordered panels (instructions only, never render these labels):',
    ]
    for n, key in enumerate(keys):
        obs = review['cellObservations'][key]
        if key == 'main/cell_061':
            obs = 'Distinct tilted stone-state pose from guide, face contours preserved; draw normal BLUE colors for deterministic gray conversion.'
        lines.append(f'{n+1}, row {n//7+1} col {n%7+1}, {key}: {obs}')
    (destination / 'prompt.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    job['referenceHashes'] = [sha(p) for p in job['references']]
    job['promptSha256'] = sha(destination / 'prompt.txt')
    write_json(destination / 'job.json', job)
    write_json(destination / 'donor-visual-review.json', {
        'reviewer': 'CODEX', 'status': 'SOURCE_VISUALS_RECHECKED_20260923',
        'scope': 'main/sub all-cells and all seven sequence sheets visually inspected',
        'notes': review['character'], 'newAppearanceAccepted': False})
    print(json.dumps({'job': str(destination), 'generatedPanels': len(keys), 'derivedMasters': len(derived)}, ensure_ascii=False))


def import_sheet(destination, sheet, layout_path=None, output_name=None):
    job = P.read(destination / 'job.json')
    for field in ('selectedConcept', 'inventory', 'review', 'motionContract'):
        P.require(sha(job[field]['path']) == job[field]['sha256'], 'IMPORT_INPUT_DRIFT_' + field)
    inv = P.read(Path(job['inventory']['path']))
    raw = Image.open(sheet).convert('RGBA')
    output = destination / (output_name or ('compiled-layout-candidate' if layout_path else 'compiled'))
    P.require(output.resolve().parent == destination.resolve(), 'IMPORT_OUTPUT_OUTSIDE_JOB')
    P.require(not output.exists(), 'IMMUTABLE_CANDIDATE_EXISTS')
    cols, rows = job['grid']
    P.require(abs(raw.width / raw.height - cols / rows) < .01, 'GRID_ASPECT_MISMATCH')
    P.require(raw.getchannel('A').getextrema()[0] == 0, 'REAL_TRANSPARENCY_REQUIRED')
    palette = P.PIXEL.parse_palette(job['palette'])
    layout = P.read(layout_path) if layout_path else None
    if layout:
        P.require(layout['sourceSha256'] == sha(sheet), 'LAYOUT_SOURCE_DRIFT')
        P.require(layout['jobSha256'] == sha(destination / 'job.json'), 'LAYOUT_JOB_DRIFT')
        P.require(set(layout['panels']) == set(job['keys']), 'LAYOUT_COVERAGE_DRIFT')
        P.require(layout['perFrameFit'] is False, 'PER_FRAME_FIT_FORBIDDEN')
    sample_size = tuple(layout['wholeSheetSampleSize']) if layout else (cols * 64, rows * 64)
    alpha_threshold = layout.get('alphaThreshold', 128) if layout else 128
    P.require(type(alpha_threshold) is int and 1 <= alpha_threshold <= 255, 'INVALID_ALPHA_THRESHOLD')
    small = raw.resize(sample_size, Image.Resampling.NEAREST)
    small.putdata([(0, 0, 0, 0) if px[3] < alpha_threshold else min(palette[1:], key=lambda p: sum((p[j]-px[j])**2 for j in range(3))) for px in small.get_flattened_data()])
    masters, reviews = {}, []
    for n, key in enumerate(job['keys']):
        x, y = n % cols * 64, n // cols * 64
        if layout:
            panel = layout['panels'][key]
            crop = small.crop(tuple(panel['sampleRect']))
            ox, oy = panel['offset']
            box = crop.getchannel('A').getbbox()
            P.require(box and 0 <= box[0]+ox < box[2]+ox <= 64 and 0 <= box[1]+oy < box[3]+oy <= 64, 'LAYOUT_CLIPPING_' + key)
            tile = Image.new('RGBA', (64, 64))
            tile.alpha_composite(crop, (ox, oy))
        else:
            tile = small.crop((x, y, x+64, y+64))
        P.require(tile.getchannel('A').getbbox() is not None, 'EMPTY_PANEL_' + key)
        if job['postprocessStates'].get(key) == 'gray':
            gray = tile.convert('L')
            tile = Image.merge('RGBA', (gray, gray, gray, tile.getchannel('A')))
        elif job['postprocessStates'].get(key) == 'red':
            tile.putdata([(0,0,0,0) if not p[3] else (max(60,min(255,int(sum(p[:3])/3*1.3))),int(p[1]*.35),int(p[2]*.2),255) for p in tile.get_flattened_data()])
        elif job['postprocessStates'].get(key) == 'white':
            tile = P.derive_silhouette(tile, (255, 255, 255, 255))
        elif job['postprocessStates'].get(key) == 'black':
            tile = P.derive_silhouette(tile, (0, 0, 0, 255))
        masters[key] = tile
        reviews.append({'key': key, 'panel': n, 'artAccepted': False, 'poseExpressionRestraintQa': 'PENDING'})
    for key, marker in job.get('authoredMarkers', {}).items():
        P.require(key in inv['slots'] and key == inv['slots'][key]['canonical'] and key not in masters, 'MARKER_KEY_DRIFT')
        P.require(marker.get('reviewReason') and marker['color'] in ('#FFFFFF', '#000000'), 'MARKER_REVIEW_REQUIRED')
        tile = Image.new('RGBA', (64,64))
        color = (255,255,255,255) if marker['color'] == '#FFFFFF' else (0,0,0,255)
        P.require(0 < len(marker['points']) <= 8, 'MARKER_POINTS_INVALID')
        for point in marker['points']:
            P.require(len(point)==2 and all(type(c) is int and 0 <= c < 64 for c in point), 'MARKER_OUTSIDE_CANVAS')
            tile.putpixel(tuple(point), color)
        masters[key] = tile
        reviews.append({'key': key, 'deterministicMarker': marker, 'artAccepted': False, 'poseExpressionRestraintQa': 'PENDING'})
    for key, rule in job['derived'].items():
        base = masters[rule['base']]
        op = rule['operation']
        if op == 'white':
            tile = P.derive_silhouette(base, (255, 255, 255, 255))
        elif op == 'gray':
            gray = base.convert('L')
            tile = Image.merge('RGBA', (gray, gray, gray, base.getchannel('A')))
        elif op == 'red':
            # Fixed original-palette recolor, never source RGB or a fresh model.
            tile = base.copy()
            tile.putdata([(0,0,0,0) if not p[3] else (max(60, min(255, int((p[0]+p[1]+p[2])/3*1.3))), int(p[1]*0.35), int(p[2]*0.2), 255) for p in base.get_flattened_data()])
        else:
            P.require(op == 'black', 'UNSUPPORTED_DERIVATION')
            tile = P.derive_silhouette(base, (0, 0, 0, 255))
            # Opaque white eye masks require reviewed ORIGINAL-eye coordinates.
            # Never infer eyes from all highlights or import donor eye pixels.
        masters[key] = tile
        reviews.append({'key': key, 'derived': rule, 'artAccepted': False,
                        'poseExpressionRestraintQa': 'EYE_MASK_REVIEW_REQUIRED' if op == 'black' else 'PENDING'})
    plan = {'slots': {k: {**v, 'sourceTranslationFromCanonical': v['translation']} for k, v in inv['slots'].items()}}
    native = {'entityId': job['entityId'], 'origin': job['sourceOrigin'], 'palette': job['palette'],
              'requiredSlots': inv['counts']['slots'], 'requiredMasters': inv['counts']['masters'], 'requiredSequences': inv['counts']['sequences'],
              'sourceOrigin': job['sourceOrigin'], 'sourceContractSha256': job['motionContract']['sha256']}
    metadata = {'designVersion': job['designVersion'], 'selectedConceptSha256': job['selectedConcept']['sha256'],
                'generationTool': 'HIGGSFIELD', 'modelVersion': 'gpt_image_2_5', 'higgsfieldCalls': 1,
                'authoredMasters': len(job.get('authoredMarkers', {})), 'generatedCandidateMasters': len(job['keys']), 'derivedMasters': len(job['derived']),
                'generationSourceSize': list(raw.size), 'normalization': job['normalization'],
                'artReview': 'PENDING_VISUAL_AND_BLACK_EYE_MASK', 'runtimeEligible': False}
    if layout:
        metadata['normalization'] = {'operation': 'ONE_WHOLE_SHEET_SAMPLE_THEN_EXPLICIT_CROPS_AND_TRANSLATIONS',
                                      'wholeSheetSampleSize': list(sample_size), 'perFrameFit': False,
                                      'alphaThreshold': alpha_threshold,
                                      'layoutSha256': sha(layout_path), 'placementReview': layout['status']}
    metadata['unexpectedOccupiedPanels'] = []
    F.assemble(masters, plan, native, {}, reviews, metadata, output, job)


def merge_repair(destination, manifest_path):
    manifest = P.read(manifest_path)
    job = P.read(destination / 'job.json')
    source = destination / manifest['baseDirectory']
    output = destination / manifest['outputDirectory']
    P.require(output.resolve().parent == destination.resolve(), 'REPAIR_OUTPUT_OUTSIDE_JOB')
    P.require(sha(source / 'bank.json') == manifest['baseBankSha256'], 'REPAIR_BASE_DRIFT')
    sheet = manifest_path.parent / manifest['sheet']
    P.require(sha(sheet) == manifest['sheetSha256'], 'REPAIR_SHEET_DRIFT')
    prior = P.read(source / 'bank.json')
    inv = P.read(Path(job['inventory']['path']))
    palette = P.PIXEL.parse_palette(job['palette'])
    im = Image.open(sheet).convert('RGBA').resize(tuple(manifest['wholeSheetSampleSize']), Image.Resampling.NEAREST)
    im.putdata([(0,0,0,0) if p[3] < 128 else min(palette[1:], key=lambda c:sum((c[j]-p[j])**2 for j in range(3))) for p in im.get_flattened_data()])
    masters = {k: Image.open(source / v['image']).convert('RGBA') for k, v in prior['cells'].items() if k == v['canonical']}
    for key, row in manifest['panels'].items():
        P.require(key in job['keys'], 'UNKNOWN_REPAIR_KEY')
        crop = im.crop(tuple(row['sampleRect']))
        ox, oy = row['offset']; box = crop.getchannel('A').getbbox()
        P.require(box and 0 <= box[0]+ox < box[2]+ox <= 64 and 0 <= box[1]+oy < box[3]+oy <= 64, 'REPAIR_CLIPPED_' + key)
        tile = Image.new('RGBA', (64, 64)); tile.alpha_composite(crop, (ox, oy)); masters[key] = tile
    # These repairs do not alter the parents of the four special derivations.
    P.require(not set(manifest['panels']).intersection(r['base'] for r in job['derived'].values()), 'SPECIAL_PARENT_REQUIRES_REDERIVATION')
    for key, mask in manifest.get('originalEyeMasks', {}).items():
        P.require(job['derived'][key]['operation'] == 'black' and job['derived'][key]['base'] == mask['base'], 'EYE_MASK_BASE_DRIFT')
        for x, y in mask['pixels']:
            P.require(masters[mask['base']].getpixel((x,y)) == palette[1], 'EYE_MASK_NOT_REVIEWED_ORIGINAL_DARK_PIXEL')
            masters[key].putpixel((x,y), (255,255,255,255))
    plan = {'slots': {k: {**v, 'sourceTranslationFromCanonical': v['translation']} for k, v in inv['slots'].items()}}
    metadata = {**prior, 'designVersion': 'selected-stardrip-r02-candidate', 'higgsfieldCalls': 2,
                'repairManifestSha256': sha(manifest_path), 'repairedMasters': list(manifest['panels']),
                'artReview': 'PENDING_VISUAL_AND_BLACK_EYE_MASK', 'runtimeEligible': False,
                'repairNormalization': {'wholeSheetSampleSize': manifest['wholeSheetSampleSize'],
                                        'perFrameFit': False, 'placementReview': 'PROVISIONAL'}}
    # The shared assembler owns cells, sequences and receipt; no stale prior
    # object may shadow those newly produced records through metadata expansion.
    for name in ('cells', 'sequences'):
        metadata.pop(name, None)
    if manifest.get('originalEyeMasks'):
        metadata['artReview'] = 'PENDING_POSE_SCALE_AND_ANCHOR'
        metadata['originalEyeMasks'] = manifest['originalEyeMasks']
        metadata['repairedMasters'] = sorted(set(prior.get('repairedMasters', [])) | set(manifest['originalEyeMasks']))
    F.assemble(masters, plan, prior, {}, P.read(source / 'cell-review.json'), metadata, output, manifest)


def validate_preview(destination, candidate):
    job = P.read(destination / 'job.json')
    source = destination / candidate
    P.require(source.resolve().parent == destination.resolve(), 'CANDIDATE_OUTSIDE_JOB')
    bank = P.read(source / 'bank.json')
    inv = P.read(Path(job['inventory']['path']))
    contract = P.read(Path(job['motionContract']['path']))
    checks = []
    for field in ('selectedConcept', 'inventory', 'review', 'motionContract'):
        P.require(sha(job[field]['path']) == job[field]['sha256'], 'VALIDATION_INPUT_DRIFT_' + field)
    for name, expected in inv['sourceFiles'].items():
        P.require(sha(ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK' / name) == expected, 'DONOR_SOURCE_DRIFT_' + name)
    checks.append('selected concept, inventory, donor review, motion contract and native source file hashes')
    P.require(bank['sourceOrigin'] == inv['sourceOrigin'] == job['sourceOrigin'], 'ORIGIN_METADATA_DRIFT')
    P.require(set(bank['cells']) == set(inv['slots']), 'SLOT_COVERAGE_DRIFT')
    expected = [{'side': side, 'sequence': s, 'available': True, 'missing': []} for side, v in contract['sides'].items() for s in v['sequences']]
    P.require(bank['sequences'] == expected, 'SEQUENCE_TIMING_LOOP_MODE_DRIFT')
    checks.append(f'all {len(expected)} sequence records including ticks, order, loop start and playback mode')
    for key, rec in bank['cells'].items():
        path = source / rec['image']; tile = Image.open(path).convert('RGBA')
        P.require(tile.size == (64,64) and sha(path) == rec['sha256'], 'SIZE_HASH_DRIFT_' + key)
        P.require(set(tile.getchannel('A').get_flattened_data()) <= {0,255}, 'NON_BINARY_ALPHA_' + key)
        slot = inv['slots'][key]
        # A source pose that is fully inside the native canvas cannot justify
        # a generated limb sliced by a tile border. Catch uniform-grid bleed
        # before visual acceptance, while allowing source-proven edge cases.
        bounds = tile.getchannel('A').getbbox()
        source_bounds = slot['visibleBounds']
        ox, oy = slot.get('canvasOrigin', inv['sourceOrigin'])
        if (source_bounds and 0 < source_bounds[0]+ox < source_bounds[2]+ox < 64
                and 0 < source_bounds[1]+oy < source_bounds[3]+oy < 64):
            P.require(bounds and 0 < bounds[0] < bounds[2] < 64 and 0 < bounds[1] < bounds[3] < 64,
                      'UNEXPECTED_BORDER_CLIPPING_' + key)
        expected_translation = list(slot['translation'])
        if 'canvasOrigin' in slot:
            parent_origin = inv['slots'][slot['canonical']]['canvasOrigin']
            expected_translation = [slot['translation'][i] + slot['canvasOrigin'][i] - parent_origin[i] for i in (0, 1)]
            P.require(rec.get('canvasOrigin') == slot['canvasOrigin'] and rec.get('sourceTranslationFromCanonical') == slot['translation'], 'NATIVE_ORIGIN_MAPPING_DRIFT_' + key)
        P.require(rec['canonical'] == slot['canonical'] and rec['translation'] == expected_translation, 'ALIAS_MAPPING_DRIFT_' + key)
        master = Image.open(source / bank['cells'][rec['canonical']]['image']).convert('RGBA')
        expected_tile = Image.new('RGBA', (64,64)); expected_tile.alpha_composite(master, tuple(expected_translation))
        P.require(tile.tobytes() == expected_tile.tobytes(), 'ALIAS_PIXEL_DRIFT_' + key)
    checks.append(f'all {len(bank["cells"])} RGBA64 cells, binary alpha, hashes, canonical pixels and native alias translations')
    checks.append('no output border clipping when donor bounds are strictly inside the native canvas')
    for name, expected_hash in P.read(source / 'receipt.json')['files'].items():
        P.require(sha(source / name) == expected_hash, 'ASSEMBLY_RECEIPT_DRIFT_' + name)
    report = {'status': 'PASS_STRUCTURAL_ONLY', 'candidate': candidate, 'checks': checks,
              'sourceBankSha256': sha(source / 'bank.json'), 'slots': len(bank['cells']),
              'mainSlots': sum(k.startswith('main/') for k in inv['slots']),
              'subSlots': sum(k.startswith('sub/') for k in inv['slots']),
              'canonicalMasters': inv['counts']['masters'], 'sequences': inv['counts']['sequences'],
              'ticksInContract': sum(f['ticks'] for s in bank['sequences'] for f in s['sequence']['frames']),
              'visualAnchorAcceptance': False, 'motionSemanticsAcceptance': False,
              'normalGameQa': 'NOT_RUN', 'runtimeEligible': False, 'nextEntityAllowed': False}
    write_json(destination / ('validation-' + candidate + '.json'), report)
    # A repeat structural check must not overwrite an accepted review page or
    # apply the m001-specific page layout to a different donor.
    if (destination / 'acceptance-selected-pixel-r04.json').exists() or job['entityId'] != 'm001_zurumon':
        print(json.dumps(report, ensure_ascii=False))
        return
    # Reuse the existing review page and actual game timeline implementation.
    template = P.WORK / 'full-sheet-r05/review.html'
    html = template.read_text(encoding='utf-8')
    html = html.replace('compiled-final', candidate)
    html = html.replace('m001 動作返修 r05', 'm001 星滴靈｜候選動作審查')
    html = html.replace('m001｜動作返修 r05', 'm001 星滴靈｜候選動作審查')
    begin = html.index('<p class="muted">'); end = html.index('</p>', begin) + 4
    html = html[:begin] + '<p class="muted">已生成並組裝 Main 65＋Sub 18 格。結構檢查通過；表情、身體姿態與原點定位仍在返修，尚未通過正常遊戲驗收。原點十字線可切換，圖片以原生、4倍、8倍顯示。</p>' + html[end:]
    html = html.replace('保留 ${bank.authoredMasters+bank.derivedMasters} 個母格', '確定性衍生 ${bank.derivedMasters} 格')
    (destination / 'review.html').write_text(html, encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'import', 'merge-repair', 'validate-preview'])
    parser.add_argument('--job', type=Path, required=True)
    parser.add_argument('--sheet', type=Path)
    parser.add_argument('--layout', type=Path)
    parser.add_argument('--candidate', default='compiled-layout-candidate')
    parser.add_argument('--output', help='New immutable import directory inside the job')
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare(args.job)
    elif args.action == 'merge-repair':
        P.require(args.layout is not None, 'REPAIR_MANIFEST_REQUIRED')
        merge_repair(args.job.resolve(), args.layout.resolve())
    elif args.action == 'validate-preview':
        validate_preview(args.job.resolve(), args.candidate)
    else:
        P.require(args.sheet is not None, 'SHEET_REQUIRED')
        import_sheet(args.job.resolve(), args.sheet.resolve(), args.layout, args.output)
