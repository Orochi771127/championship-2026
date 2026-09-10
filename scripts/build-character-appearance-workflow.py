#!/usr/bin/env python3
"""Deterministic research-only motion/reuse audit with opt-in external pose guides.

Generated evidence is separate from artist selections/approvals. Existing changed
outputs are refused; --check is read-only and detects byte drift. Python + Pillow.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from collections import Counter
from pathlib import Path

from PIL import Image, ImageChops

SCHEMA = 1
PRIORITY = ('m201', 'm001', 'm226', 'e000', 'm222', 'm228', 'm352', 'm431')
CLASSIFICATION = 'RESEARCH_ONLY'


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def contained(root, relative):
    path = (root / relative).resolve()
    require(path.is_relative_to(root.resolve()), f'Path escapes source root: {relative}')
    return path


def signed(value, bits):
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


def normalize_sequences(entity, side, runtime_side, decoded, cell_ids):
    source = decoded['sequences']
    runtime = runtime_side['animations']
    require(len(source) == decoded['sequenceCount'] == len(runtime), f'{entity}/{side}: sequence count drift')
    require(len({s['sequenceId'] for s in source}) == len(source), 'Duplicate source sequence ID')
    require([s['sequenceId'] for s in source] == [s['id'] for s in runtime], f'{entity}/{side}: sequence ID/order drift')
    result = []
    for seq, current in zip(source, runtime):
        mode = seq['rawWordB']
        require(mode in (1, 2), f'{entity}/{side}: unsupported raw mode {mode}')
        require(current['playbackMode'] == mode, f'{entity}/{side}: raw mode drift')
        require(0 <= seq['loopStartFrame'] < len(seq['frames']), 'Invalid loop start')
        require(current.get('loopStartFrame', 0) == seq['loopStartFrame'], 'Loop start drift')
        require(seq['frameCount'] == len(seq['frames']) == len(current['frames']), 'Sequence frame count drift')
        frames = []
        for index, (frame, current_frame) in enumerate(zip(seq['frames'], current['frames'])):
            require(frame['frameIndex'] == index, 'Source frame index drift')
            cell, ticks = frame['cellId'], frame['rawDurationTicks']
            require(cell in cell_ids, f'Unknown source cell reference {entity}/{side}/{cell}')
            require(isinstance(ticks, int) and ticks > 0, 'Invalid duration ticks')
            key = f'{entity}/{side}/cell_{cell:03d}'
            require(current_frame['cell'] == cell and current_frame['texture'] == key, 'Source cell/texture reference drift')
            require(current_frame['ticks'] == ticks, 'Source duration tick drift')
            frames.append({'frameIndex': index, 'cell': cell, 'ticks': ticks, 'texture': key,
                           'rawMarker': frame['rawMarker']})
        result.append({'id': seq['sequenceId'], 'playbackMode': mode, 'loopStartFrame': seq['loopStartFrame'],
                       'rawWordA': seq['rawWordA'], 'frames': frames})
    require(sum(len(s['frames']) for s in result) == decoded['totalFrameCount'], 'Total frame count drift')
    return result


def visible_equal(left, right):
    if left.size != right.size:
        return False
    # Ignore RGB of transparent pixels, which the historical sheet keyer retained.
    return (left.getchannel('A').tobytes() == right.getchannel('A').tobytes()
            and ImageChops.multiply(ImageChops.difference(left, right).convert('RGB'),
                                    left.getchannel('A').convert('RGB')).getbbox() is None)


def native_bank(raw_folder, stem, cells):
    """Read NCER per-cell VRAM transfers, NCBR linear / NCGR tiled pixels.

    Used in memory for evidence equality and explicit external reference guides.
    Original source bank metadata must match the existing decoded cell bank.
    """
    ncer = (raw_folder / f'{stem}.ncer').read_bytes()
    require(ncer[:4] == b'RECN' and ncer[16:20] == b'KBEC', 'Unsupported NCER')
    count, bank_type = struct.unpack_from('<HH', ncer, 24)
    require(count == cells['cellCount'] and bank_type == cells['bankType'] == 1, 'NCER bank mismatch')
    require(struct.unpack_from('<I', ncer, 32)[0] == cells['mappingType'], 'NCER mapping drift')
    records = 24 + struct.unpack_from('<I', ncer, 28)[0]
    oam_base = records + count * 16
    for cell in cells['cells']:
        record = struct.unpack_from('<HHIhhhh', ncer, records + cell['cellIndex'] * 16)
        bounds = cell['bounds']
        require(record[:2] == (cell['oamCount'], cell['rawCellAttribute']), 'NCER record drift')
        require(record[3:] == (bounds['maxXExclusive'], bounds['maxYExclusive'], bounds['minX'], bounds['minY']), 'NCER bounds drift')
        for index, oam in enumerate(cell['oamEntries']):
            require(struct.unpack_from('<HHH', ncer, oam_base + record[2] + index*6)
                    == (oam['rawAttr0'], oam['rawAttr1'], oam['rawAttr2']), 'Raw OAM drift')
    transfer_offset = struct.unpack_from('<I', ncer, 36)[0]
    transfers = None
    if transfer_offset:
        block = 24 + transfer_offset
        maximum, relative = struct.unpack_from('<II', ncer, block)
        transfers = [struct.unpack_from('<II', ncer, block + relative + i*8) for i in range(count)]
        require(all(size <= maximum for _, size in transfers), 'VRAM transfer exceeds bank maximum')
    linear_path = raw_folder / f'{stem}.ncbr'
    linear = linear_path.exists()
    payload = (linear_path if linear else raw_folder / f'{stem}.ncgr').read_bytes()
    require(payload[:4] == b'RGCN' and payload[16:20] == b'RAHC', 'Unsupported graphics')
    pixel_format = struct.unpack_from('<I', payload, 28)[0]
    require(pixel_format in (3, 4), 'Unsupported pixel format')
    size, data_offset = struct.unpack_from('<II', payload, 40)
    start = 24 + data_offset
    graphics = payload[start:start+size]
    require(len(graphics) == size, 'Graphics payload truncated')
    colors = (raw_folder / f'{stem}.nclr').read_bytes()
    require(colors[:4] == b'RLCN' and colors[16:20] == b'TTLP', 'Unsupported palette')
    color_size, color_offset = struct.unpack_from('<II', colors, 32)
    raw_colors = colors[24+color_offset:24+color_offset+color_size]
    palette = [((c & 31)*255//31, ((c >> 5) & 31)*255//31, ((c >> 10) & 31)*255//31, 255)
               for c, in struct.iter_unpack('<H', raw_colors)]
    return {'graphics': graphics, 'palette': palette, 'transfers': transfers,
            'linear': linear, 'bpp': 4 if pixel_format == 3 else 8, 'mapping': cells['mappingType']}


def render_native(cell, bank):
    b = cell['bounds']
    image = Image.new('RGBA', (max(1, b['maxXExclusive']-b['minX']), max(1, b['maxYExclusive']-b['minY'])))
    source_offset, source_size = (bank['transfers'][cell['cellIndex']] if bank['transfers'] else (0, len(bank['graphics'])))
    graphics = bank['graphics'][source_offset:source_offset+source_size]
    require(len(graphics) == source_size, 'VRAM transfer outside graphics')
    for oam in cell['oamEntries']:
        require(not oam['affine'], 'Affine cell requires explicit original transform decoder')
        if oam['disabled']:
            continue
        width, height = oam['width'], oam['height']
        base = oam['tileIndex'] * (32 << bank['mapping'])
        for y in range(height):
            for x in range(width):
                sx = width-1-x if oam['horizontalFlip'] else x
                sy = height-1-y if oam['verticalFlip'] else y
                pixel = (sy*width+sx if bank['linear'] else
                         ((sy//8)*(width//8)+sx//8)*64 + (sy%8)*8 + sx%8)
                address = base + pixel*bank['bpp']//8
                require(address < len(graphics), 'OAM references outside VRAM transfer')
                index = graphics[address]
                if bank['bpp'] == 4:
                    index = (index >> (4*(pixel%2))) & 15
                if index:
                    palette_index = index + (oam['paletteBank']*16 if bank['bpp'] == 4 else 0)
                    dx, dy = oam['x']+x-b['minX'], oam['y']+y-b['minY']
                    require(0 <= dx < image.width and 0 <= dy < image.height, 'Visible OAM pixel outside signed bounds')
                    image.putpixel((dx,dy), bank['palette'][palette_index])
    return image, {'sourceOffsetBytes': source_offset, 'transferSizeBytes': source_size,
                   'layout': 'LINEAR_NCBR' if bank['linear'] else 'TILED_NCGR', 'bitsPerPixel': bank['bpp']}


def audit_entity(archive, base, entity, structure):
    eid = entity['entityId']
    runtime_path = contained(base, entity['runtime'])
    folder = runtime_path.parent
    runtime, manifest = read(runtime_path), read(folder / 'manifest.json')
    require(runtime['entityId'] == manifest['entityId'] == eid, 'Entity identity drift')
    require(set(runtime['sides']) == {'main', 'sub'}, f'{eid}: unexpected sides')
    source_files = {}

    def record(path):
        relative = path.relative_to(archive).as_posix()
        source_files[relative] = sha(path.read_bytes())
        return relative

    record(runtime_path)
    record(folder / 'manifest.json')
    contract = {'schemaVersion': SCHEMA, 'classification': CLASSIFICATION, 'entityId': eid,
                'timingPolicy': 'RAW_TICKS_ONLY_NO_ASSUMED_HZ', 'semanticPolicy': 'RAW_SEQUENCE_IDS_ONLY', 'sides': {}}
    groups, slot_rows, origin_rows = {}, [], []
    scales, effective_origins = Counter(), Counter()
    for side in ('main', 'sub'):
        family = archive / '08_FULL_FAMILY_CONVERSION' / 'digimon' / f'{eid}_{side}'
        cells_doc, anim_doc = read(family / 'cells.json'), read(family / 'animations.json')
        record(family / 'cells.json')
        record(family / 'animations.json')
        record(family / 'family.json')
        for path in sorted((archive / '07_RAW_NITRO_ART_BY_ROM_DIRECTORY' / 'digimon').glob(f'{eid}_{side}.*')):
            record(path)
        cells = cells_doc['cells']
        bank = native_bank(archive / '07_RAW_NITRO_ART_BY_ROM_DIRECTORY' / 'digimon', f'{eid}_{side}', cells_doc)
        ids = [cell['cellIndex'] for cell in cells]
        require(len(cells) == cells_doc['cellCount'] == manifest[side]['cellCount'], 'Cell count drift')
        require(len(set(ids)) == len(ids), 'Duplicate source cell ID')
        frames = manifest[side]['frameManifest']
        keys = [f'{eid}/{side}/cell_{i:03d}' for i in ids]
        require(set(frames) == set(keys), 'Stable frame key drift')
        sequences = normalize_sequences(eid, side, runtime['sides'][side], anim_doc, set(ids))
        contract['sides'][side] = {'frameKeys': keys, 'sequences': sequences}
        pages = []
        atlas_frames = {}
        for page in runtime['sides'][side]['atlases']:
            data_path, image_path = contained(folder, page['data']), contained(folder, page['image'])
            record(data_path)
            record(image_path)
            page_doc = read(data_path)
            require(not (set(atlas_frames) & set(page_doc['frames'])), 'Duplicate atlas key')
            atlas_frames.update(page_doc['frames'])
            image = Image.open(image_path).convert('RGBA')
            require(max(image.size) <= 2048, 'Atlas exceeds 2048 limit')
            pages.append(image)
        require(set(atlas_frames) == set(keys), 'Atlas key drift')
        for cell, key in zip(cells, keys):
            entry, atlas = frames[key], atlas_frames[key]
            require(not atlas['rotated'], 'Rotated source cells need explicit decode')
            for prop in ('frame', 'spriteSourceSize', 'sourceSize', 'anchor'):
                require(entry[prop] == atlas[prop], f'Manifest/atlas placement drift {key}')
            rect = atlas['frame']
            page = pages[entry['page']]
            require(0 <= rect['x'] and 0 <= rect['y'] and rect['x'] + rect['w'] <= page.width
                    and rect['y'] + rect['h'] <= page.height, f'Invalid atlas rectangle {key}')
            crop = page.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
            # Manifest hdRgbaSha256 describes the pre-alpha-composite cutout.
            # Atlas compositing clears hidden RGB, so hash the actual payload
            # separately; source-evidence locks both the PNG and its manifest.
            blank = crop.getchannel('A').getbbox() is None
            require(blank == entry['isBlank'], f'Blank slot drift {key}')
            native_path = family / 'cells' / f"cell-{cell['cellIndex']:03d}.png"
            record(native_path)
            generic_decoded = Image.open(native_path).convert('RGBA')
            native, transfer = render_native(cell, bank)
            bounds = cell['bounds']
            expected_size = (max(1, bounds['maxXExclusive'] - bounds['minX']),
                             max(1, bounds['maxYExclusive'] - bounds['minY']))
            require(native.size == expected_size, f'Decoded canvas/bounds drift {key}')
            for oam in cell['oamEntries']:
                require(oam['x'] == signed(oam['rawAttr1'] & 511, 9), f'OAM signed x drift {key}')
                require(oam['y'] == signed(oam['rawAttr0'] & 255, 8), f'OAM signed y drift {key}')
            native_box = native.getchannel('A').getbbox()
            source_alpha = ([bounds['minX'] + native_box[0], bounds['minY'] + native_box[1],
                             bounds['minX'] + native_box[2], bounds['minY'] + native_box[3]] if native_box else None)
            scale, equivalent, inferred_origin = None, False, None
            placement = atlas['spriteSourceSize']
            if source_alpha and not blank:
                native_crop = native.crop(native_box)
                sx, sy = crop.width / native_crop.width, crop.height / native_crop.height
                if sx == sy and sx >= 1 and sx.is_integer():
                    scale = int(sx)
                    equivalent = visible_equal(native_crop.resize(crop.size, Image.Resampling.NEAREST), crop)
                if equivalent:
                    inferred_origin = [placement['x'] - source_alpha[0] * scale,
                                       placement['y'] - source_alpha[1] * scale]
                    scales[scale] += 1
                    effective_origins[tuple(inferred_origin)] += 1
            elif not source_alpha and blank:
                equivalent = True
            # Strict reuse: exact current source RGBA + dimensions within entity.
            group_hash = sha(encoded([crop.width, crop.height, sha(crop.tobytes())]))
            group_id = f'{eid}:master:{group_hash[:16]}' if not blank else None
            if group_id:
                group = groups.setdefault(group_id, {'masterId': group_id, 'canonical': key,
                    'sourceRgbaSha256': sha(crop.tobytes()), 'size': list(crop.size), 'members': []})
                group['members'].append(key)
            slot_rows.append({'texture': key, 'masterId': group_id, 'isBlank': blank,
                              'sourceRgbaSha256': sha(crop.tobytes()), 'sourceSize': list(crop.size),
                              'declaredPreCompositeRgbaSha256': entry['hdRgbaSha256'].lower()})
            origin_rows.append({'texture': key, 'side': side, 'isBlank': blank, 'signedCellBounds': bounds,
                'rawCellAttribute': cell['rawCellAttribute'], 'oamEntries': cell['oamEntries'],
                'decodedSource': native_path.relative_to(archive).as_posix(),
                'generic08PixelsMatchTransferAwareDecode': visible_equal(generic_decoded, native),
                'sourceTransfer': transfer,
                'signedSourceAlphaBounds': source_alpha, 'currentSpriteSourceSize': placement,
                'currentSourceSize': atlas['sourceSize'], 'currentAnchor': atlas['anchor'],
                'effectiveSourcePixelScale': scale, 'decodedPixelsMatchCurrent': equivalent,
                'inferredCurrentSourceOrigin': inferred_origin,
                'landmarksStatus': 'MANUAL_POSE_REVIEW_REQUIRED', 'effectClassification': 'UNCLASSIFIED_REQUIRES_VISUAL_REVIEW'})
        for image in pages:
            image.close()
    # A single source-space frame of reference for both Main and Sub. No body
    # contact assumptions: NCER origin is distinct from actual ground/feet.
    matched = [r for r in origin_rows if r['inferredCurrentSourceOrigin'] is not None]
    pixel_mismatches = [r['texture'] for r in origin_rows if not r['decodedPixelsMatchCurrent']]
    proposal = {'status': 'SOURCE_PIXEL_CORRESPONDENCE_REQUIRES_REVIEW', 'atlasMaximum': 2048}
    changed = 0
    side_scales = {side: sorted({r['effectiveSourcePixelScale'] for r in matched if r['side'] == side}) for side in ('main', 'sub')}
    references = {side: next((r['inferredCurrentSourceOrigin'] for r in matched if r['side'] == side), None) for side in ('main', 'sub')}
    for row in matched:
        reference = references[row['side']]
        current = row['inferredCurrentSourceOrigin']
        delta = [current[0] - reference[0], current[1] - reference[1]]
        row['currentOriginDriftFromFirstNonblankOnSide'] = delta
        changed += delta != [0, 0]
    reference_scale = matched[0]['effectiveSourcePixelScale'] if matched else None
    scale_changed = sum(r['effectiveSourcePixelScale'] != reference_scale for r in matched)
    if matched and not pixel_mismatches:
        # Contact-sheet fitting varies per pose. Lock one measured native scale.
        min_x = min(r['signedSourceAlphaBounds'][0] * reference_scale for r in matched)
        min_y = min(r['signedSourceAlphaBounds'][1] * reference_scale for r in matched)
        max_x = max(r['signedSourceAlphaBounds'][2] * reference_scale for r in matched)
        max_y = max(r['signedSourceAlphaBounds'][3] * reference_scale for r in matched)
        margin = 16
        origin = [margin - min(0, min_x), margin - min(0, min_y)]
        canvas = [origin[0] + max(0, max_x) + margin, origin[1] + max(0, max_y) + margin]
        for row in origin_rows:
            if row['inferredCurrentSourceOrigin'] is not None:
                b = row['signedSourceAlphaBounds']
                scale = reference_scale
                row['proposedSpriteSourceSize'] = {'x': origin[0] + b[0] * scale, 'y': origin[1] + b[1] * scale,
                                                   'w': (b[2] - b[0]) * scale, 'h': (b[3] - b[1]) * scale}
        proposal = {'status': 'GEOMETRIC_PROPOSAL_NOT_APPROVED_EXPORT', 'sourcePixelScale': reference_scale,
            'scaleReference': matched[0]['texture'], 'currentEffectiveScalesBySide': side_scales,
            'sourcePixelScaleBySide': {side: reference_scale for side in ('main', 'sub')},
            'commonSourceOrigin': origin, 'logicalCanvas': canvas, 'anchor': {'x': origin[0]/canvas[0], 'y': origin[1]/canvas[1]},
            'marginPixels': margin, 'atlasMaximum': 2048,
            'formula': 'logical = commonSourceOrigin + sourceCoordinate * sourcePixelScaleBySide[side]',
            'runtimeCompatibility': 'REQUIRES_SCENE_SCALE_AND_ANCHOR_QA_BEFORE_EXPORT',
            'groundOrEffectLandmarks': 'UNKNOWN_REQUIRES_VISUAL_AND_RUNTIME_TRACE'}
    contract_hash = sha(encoded(contract))
    summary = {'entityId': eid, 'kind': entity['kind'], 'sourceOrdinal': entity['ordinal'], 'sourceBatch': entity['batchNumber'],
        'structure': structure, 'slotCount': len(slot_rows), 'sequenceCount': sum(len(s['sequences']) for s in contract['sides'].values()),
        'uniqueNonblankMasters': len(groups), 'blankSlots': sum(r['isBlank'] for r in slot_rows),
        'motionContractSha256': contract_hash, 'motionContract': f'entities/{eid}/motion-contract.json',
        'currentOriginVariantCount': len(effective_origins), 'originChangedFromFirstNonblankSlots': changed,
        'sourcePixelMismatchCount': len(pixel_mismatches), 'effectiveSourcePixelScales': sorted(scales),
        'nonUniformScaleSlots': scale_changed,
        'generic08RendererMismatchSlots': sum(not r['generic08PixelsMatchTransferAwareDecode'] for r in origin_rows),
        'designStatus': 'AWAITING_TWO_OPTIONS', 'runtimeEligible': False, 'shippingReady': False}
    outputs = {'motion-contract.json': contract,
        'source-reuse.json': {'schemaVersion': SCHEMA, 'classification': CLASSIFICATION, 'entityId': eid,
            'reusePolicy': 'EXACT_RGBA_AND_DIMENSIONS_WITHIN_ENTITY_ONLY_PLACEMENT_RETAINED_PER_SLOT',
            'masters': list(groups.values()), 'slots': slot_rows},
        'origin-audit.json': {'schemaVersion': SCHEMA, 'classification': CLASSIFICATION, 'entityId': eid,
            'placementStatus': 'CURRENT_ATLAS_RECENTERED' if len(effective_origins) > 1 else 'REQUIRES_VISUAL_REVIEW',
            'summary': summary, 'pixelMismatchKeys': pixel_mismatches, 'exportProposal': proposal, 'cells': origin_rows},
        'source-evidence.json': {'schemaVersion': SCHEMA, 'classification': CLASSIFICATION, 'entityId': eid,
            'files': source_files}}
    return summary, outputs


def build(archive):
    archive = archive.resolve()
    base = archive / '02_CHARACTERS/use-ready-pixi-hd4x-224'
    manifest_path = base / 'manifest.json'
    manifest = read(manifest_path)
    entities = manifest['entities']
    require(len(entities) == manifest['entityCount'] == 224, 'Expected 224 entities')
    require(len({e['entityId'] for e in entities}) == 224, 'Duplicate entity ID')
    source_batches = Counter(e['batchNumber'] for e in entities)
    require(dict(source_batches) == {i: 32 for i in range(1, 8)}, 'Original 7x32 batches drift')
    native_catalog_path = archive / '02_CHARACTERS/native-224-catalog/O2_CHARACTER_CATALOG_MANIFEST.json'
    structures = {r['entityId']: r['structuralOutlierStatus'] for r in read(native_catalog_path)['records']}
    catalog, files = [], {}
    for entity in entities:
        summary, output = audit_entity(archive, base, entity, structures[entity['entityId']])
        catalog.append(summary)
        for name, content in output.items():
            files[f"entities/{entity['entityId']}/{name}"] = encoded(content)
        if len(catalog) % 32 == 0:
            print(json.dumps({'auditedEntities': len(catalog), 'total': 224}), flush=True)
    prefixes = {e['entityId'].split('_')[0]: e['entityId'] for e in entities}
    priority = [prefixes[p] for p in PRIORITY]
    ordered = priority + [e['entityId'] for e in entities if e['entityId'] not in priority]
    for index in range(56):
        ids = ordered[index*4:index*4+4]
        files[f'packets/packet-{index+1:02d}.json'] = encoded({'schemaVersion': SCHEMA,
            'packetNumber': index+1, 'entityIds': ids, 'designOptionsPerEntity': 2,
            'selectionStatus': 'PENDING_OWNER_SELECTION', 'policy': 'APPROVALS_STORED_OUTSIDE_GENERATED_TREE'})
    totals = {key: sum(e[key] for e in catalog) for key in ('slotCount', 'sequenceCount', 'uniqueNonblankMasters', 'blankSlots',
                                                         'originChangedFromFirstNonblankSlots', 'sourcePixelMismatchCount', 'generic08RendererMismatchSlots', 'nonUniformScaleSlots')}
    totals.update({'entityCount': 224, 'packetCount': 56, 'sourceBatchCount': 7,
                   'recenteredEntities': sum(e['currentOriginVariantCount'] > 1 for e in catalog)})
    files['catalog.json'] = encoded({'schemaVersion': SCHEMA, 'classification': CLASSIFICATION, 'totals': totals,
        'sourceManifestSha256': sha(manifest_path.read_bytes()), 'sourceStructureCatalogSha256': sha(native_catalog_path.read_bytes()),
        'motionContractHashes': {e['entityId']: e['motionContractSha256'] for e in catalog}, 'entities': catalog})
    files['packets.json'] = encoded({'schemaVersion': SCHEMA, 'packetCount': 56,
        'packets': [{'packetNumber': i+1, 'entityIds': ordered[i*4:i*4+4], 'path': f'packets/packet-{i+1:02d}.json'} for i in range(56)],
        'originalBatches': [{'batchNumber': i, 'entityIds': [e['entityId'] for e in entities if e['batchNumber'] == i]} for i in range(1, 8)]})
    files['receipt.json'] = encoded({'schemaVersion': SCHEMA, 'classification': CLASSIFICATION, 'totals': totals,
        'files': {key: sha(data) for key, data in sorted(files.items())},
        'artGenerated': False, 'runtimeIntegrated': False, 'humanApproved': False,
        'limitations': ['Source-coordinate audit is not anatomical landmark approval.',
            'Historical atlas recentering is quantified; current runtime coordinates have not been changed.',
            'Motion action names and gameplay trigger completeness are not inferred from art.']})
    return files


def source_origin_guide(native, cell, proposal):
    """Place decoded pixels using one origin and scale, never fit or bottom-align."""
    scale = proposal['sourcePixelScale']
    origin = proposal['commonSourceOrigin']
    bounds = cell['bounds']
    logical = Image.new('RGBA', tuple(proposal['logicalCanvas']))
    enlarged = native.resize((native.width*scale, native.height*scale), Image.Resampling.NEAREST)
    logical.alpha_composite(enlarged, (origin[0]+bounds['minX']*scale, origin[1]+bounds['minY']*scale))
    alpha = native.getchannel('A').getbbox()
    if alpha:
        expected = (origin[0]+(bounds['minX']+alpha[0])*scale, origin[1]+(bounds['minY']+alpha[1])*scale,
                    origin[0]+(bounds['minX']+alpha[2])*scale, origin[1]+(bounds['minY']+alpha[3])*scale)
        require(logical.getchannel('A').getbbox() == expected, 'Guide clipped source geometry')
    else:
        require(logical.getchannel('A').getbbox() is None, 'Guide changed blank cell')
    return logical


def reference_guides(archive, artifacts):
    """First four source-only guides, opt-in and external to product repository."""
    catalog = json.loads(artifacts['catalog.json'])
    entities = [next(e for e in catalog['entities'] if e['entityId'].startswith(p+'_')) for p in PRIORITY[:4]]
    files, report = {}, []
    for entity in entities:
        eid = entity['entityId']
        audit = json.loads(artifacts[f'entities/{eid}/origin-audit.json'])
        proposal = audit['exportProposal']
        require(proposal['status'] == 'GEOMETRIC_PROPOSAL_NOT_APPROVED_EXPORT', f'Unverified geometry {eid}')
        frames = []
        for side in ('main', 'sub'):
            cell_bank = read(archive/'08_FULL_FAMILY_CONVERSION/digimon'/f'{eid}_{side}'/'cells.json')
            bank = native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon', f'{eid}_{side}', cell_bank)
            for cell in cell_bank['cells']:
                native, _ = render_native(cell, bank)
                guide = source_origin_guide(native, cell, proposal)
                stream = io.BytesIO()
                guide.save(stream, format='PNG', optimize=False)
                path = f"{eid}/{side}/cell-{cell['cellIndex']:03d}.png"
                files[path] = stream.getvalue()
                frames.append({'texture': f"{eid}/{side}/cell_{cell['cellIndex']:03d}", 'path': path,
                    'sha256': sha(files[path]), 'isBlank': guide.getchannel('A').getbbox() is None})
        report.append({'entityId': eid, 'role': 'RESEARCH_REFERENCE_GUIDE_NOT_REDRAW_CANDIDATE',
            'motionContractSha256': entity['motionContractSha256'], 'geometry': proposal, 'frames': frames,
            'humanApproved': False, 'runtimeEligible': False, 'shippingReady': False})
    files['guide-index.json'] = encoded({'schemaVersion': SCHEMA, 'classification': CLASSIFICATION,
        'entityCount': 4, 'entities': report, 'policy': 'SOURCE_PIXELS_FOR_PRIVATE_POSE_REFERENCE_ONLY',
        'landmarkQa': 'PENDING', 'runtimeCanvasAdapterQa': 'PENDING'})
    return files


def publish(files, output, check=False):
    output = output.resolve()
    problems = []
    # Validate everything before creating anything. No replace/force flag exists.
    for relative, payload in files.items():
        target = contained(output, relative)
        if target.exists() and target.read_bytes() != payload:
            problems.append(f'DRIFT {relative}')
        elif check and not target.exists():
            problems.append(f'MISSING {relative}')
    if check and output.exists():
        problems.extend(f'UNEXPECTED {p.relative_to(output).as_posix()}' for p in output.rglob('*')
                        if p.is_file() and p.relative_to(output).as_posix() not in files)
    require(not problems, '\n'.join(problems[:30]))
    if not check:
        for relative, payload in files.items():
            target = contained(output, relative)
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--export-reference-guides', type=Path,
                        help='Opt-in first four source-only PNG guides; destination must be outside product repo and archive')
    args = parser.parse_args()
    require(not args.output.resolve().is_relative_to(args.archive_root.resolve()), 'Output must be outside source archive')
    files = build(args.archive_root)
    publish(files, args.output, args.check)
    if args.export_reference_guides:
        target = args.export_reference_guides.resolve()
        require(not target.is_relative_to(args.archive_root.resolve()), 'Guides must not modify source archive')
        repo = next((p for p in (Path.cwd(), *Path.cwd().parents) if (p/'.git').exists()), None)
        require(repo is not None, 'Run guide export from product Git checkout')
        require(not target.is_relative_to(repo.resolve()), 'Source guide PNGs must remain outside product repository')
        guide_files = reference_guides(args.archive_root.resolve(), files)
        publish(guide_files, target, args.check)
        print(json.dumps({'referenceGuideFiles': len(guide_files), 'guideIndexSha256': sha(guide_files['guide-index.json'])}))
    print(json.dumps({'status': 'CHECK_PASS' if args.check else 'GENERATED', 'fileCount': len(files),
                      'receiptSha256': sha(files['receipt.json']), 'totals': json.loads(files['catalog.json'])['totals']}))


if __name__ == '__main__':
    main()
