"""Offline m001 production preflight; delegates decoding and pixel I/O to existing tools.

No network, model invocation, source-image export, runtime writes or approval promotion.
64px proofs contain only the existing authored setting. Derivation proposals are metadata.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'docs/art/production/characters/appearance-refresh-v1'
WORK = ROOT / 'docs/art/production/original-character-cage-r1/m001-pipeline-v1'
ENTITY = 'm001_zurumon'


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(result)
    finally:
        sys.dont_write_bytecode = previous
    return result


SOURCE = module('production_motion_source', 'build-character-appearance-workflow.py')
PIXEL = module('production_pixel_io', 'compile-pixel-character-bank.py')
require, read, encoded, sha = SOURCE.require, SOURCE.read, SOURCE.encoded, SOURCE.sha


def verify_lock(root, entries):
    for relative, digest in entries.items():
        path = SOURCE.contained(root, relative)
        require(path.is_file() and sha(path.read_bytes()) == digest, f'INPUT_DRIFT {relative}')


def verify_motion(expected, actual):
    require(encoded(expected) == encoded(actual), 'MOTION_CONTRACT_DRIFT')


def canvas_origin(bounds):
    union = [min(b[0] for b in bounds), min(b[1] for b in bounds),
             max(b[2] for b in bounds), max(b[3] for b in bounds)]
    require(union[2] - union[0] <= 64 and union[3] - union[1] <= 64, 'NATIVE_UNION_EXCEEDS_64')
    origin = [(64 - (union[2] - union[0])) // 2 - union[0],
              (64 - (union[3] - union[1])) // 2 - union[1]]
    return union, origin


def place_authored(pose, palette, origin):
    bounds = PIXEL.valid_bounds(pose['nativeBounds'], pose['key'])
    grid = PIXEL.validate_grid(pose['pixels'], len(palette), pose['key'])
    require((len(grid[0]), len(grid)) == (bounds[2] - bounds[0], bounds[3] - bounds[1]), 'GRID_BOUNDS_DRIFT')
    image = PIXEL.indexed_image(grid, palette).convert('RGBA')
    box = image.getchannel('A').getbbox()
    require(box is not None, 'EMPTY_AUTHORED_POSE')
    x, y = origin[0] + bounds[0], origin[1] + bounds[1]
    expected = (x + box[0], y + box[1], x + box[2], y + box[3])
    require(0 <= expected[0] < expected[2] <= 64 and 0 <= expected[1] < expected[3] <= 64, 'AUTHORED_PIXELS_CLIPPED')
    canvas = Image.new('RGBA', (64, 64))
    canvas.alpha_composite(image, (x, y))
    require(canvas.getchannel('A').getbbox() == expected, 'AUTHORED_PLACEMENT_DRIFT')
    return canvas


def palette_relation(source, target):
    """Prove a pointwise color lookup only; this confers no action/state semantics."""
    if source.size != target.size or source.getchannel('A').tobytes() != target.getchannel('A').tobytes():
        return None
    mapping = {}
    for a, b in zip(source.get_flattened_data(), target.get_flattened_data()):
        if not a[3]:
            continue
        if a in mapping and mapping[a] != b:
            return None
        mapping[a] = b
    values = set(mapping.values())
    kind = 'SOLID_ALPHA_FILL' if len(values) == 1 else 'PALETTE_LOOKUP'
    solid = next(iter(values)) if len(values) == 1 else None
    return {'operationClass': kind, 'sourceColorCount': len(mapping), 'targetColorCount': len(values),
            'deterministicFill': list(solid) if solid in ((0, 0, 0, 255), (255, 255, 255, 255)) else None,
            'relationSha256': sha(encoded(sorted([list(a) + list(b) for a, b in mapping.items()]))),
            'stateSemantics': 'UNKNOWN_REQUIRES_EXISTING_CONTRACT',
            'productionRule': 'AUTHOR_ORIGINAL_TARGET_PALETTE_OR_FILL_BEFORE_USE',
            'approvedForProduction': False}


def derive_silhouette(image, color):
    require(tuple(color) in ((0, 0, 0, 255), (255, 255, 255, 255)), 'UNPROVEN_SILHOUETTE_FILL')
    result = Image.new('RGBA', image.size)
    result.paste(tuple(color), (0, 0, image.width, image.height), image.getchannel('A'))
    require(result.getchannel('A').tobytes() == image.getchannel('A').tobytes(), 'SILHOUETTE_ALPHA_DRIFT')
    return result


def build(archive):
    lock = read(WORK / 'inputs.lock.json')
    verify_lock(ROOT, lock['repoFiles'])
    generated = PACK / 'generated/entities' / ENTITY
    evidence = read(generated / 'source-evidence.json')
    verify_lock(archive, evidence['files'])
    contract = read(generated / 'motion-contract.json')
    origin_audit = read(generated / 'origin-audit.json')
    base = archive / '02_CHARACTERS/use-ready-pixi-hd4x-224'
    roster = read(base / 'manifest.json')
    entity = next(e for e in roster['entities'] if e['entityId'] == ENTITY)
    summary, fresh = SOURCE.audit_entity(archive, base, entity, origin_audit['summary']['structure'])
    verify_motion(contract, fresh['motion-contract.json'])
    require(summary['sourcePixelMismatchCount'] == 0, 'SOURCE_PIXEL_MISMATCH')
    slots, groups, crops, alpha_groups = {}, {}, {}, defaultdict(list)
    for side in ('main', 'sub'):
        cells = read(archive / '08_FULL_FAMILY_CONVERSION/digimon' / f'{ENTITY}_{side}' / 'cells.json')
        bank = SOURCE.native_bank(archive / '07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon', f'{ENTITY}_{side}', cells)
        for cell in cells['cells']:
            key = f"{side}/cell_{cell['cellIndex']:03d}"
            image, _ = SOURCE.render_native(cell, bank)
            box = image.getchannel('A').getbbox()
            require(box is not None, 'M001_UNEXPECTED_BLANK')
            crop = image.crop(box)
            digest = sha(encoded(list(crop.size)) + crop.tobytes())
            b = cell['bounds']
            bounds = [b['minX'], b['minY'], b['maxXExclusive'], b['maxYExclusive']]
            visible = [bounds[0] + box[0], bounds[1] + box[1], bounds[0] + box[2], bounds[1] + box[3]]
            canonical = groups.setdefault(digest, key)
            slots[key] = {'canonical': canonical, 'nativeRgbaSha256': digest, 'nativeBounds': bounds,
                          'visibleBounds': visible, 'sameAsCell': canonical if canonical != key else None}
            if canonical == key:
                crops[key] = crop
                alpha_hash = sha(encoded(list(crop.size)) + crop.getchannel('A').tobytes())
                alpha_groups[alpha_hash].append(key)
    require(len(slots) == 83 and len(groups) == 53, 'M001_NATIVE_COVERAGE_DRIFT')
    union, origin = canvas_origin([v['nativeBounds'] for v in slots.values()])
    for slot in slots.values():
        own, parent = slot['visibleBounds'], slots[slot['canonical']]['visibleBounds']
        slot['sourceTranslationFromCanonical'] = [own[0] - parent[0], own[1] - parent[1]]
    setting_path = PACK / 'pixel-v2/settings' / ENTITY / 'setting.json'
    setting = read(setting_path)
    require(setting['entityId'] == ENTITY and setting['selectedOption'] == 'B', 'DESIGN_DIRECTION_DRIFT')
    palette = PIXEL.parse_palette(setting['palette'])
    authored = {p['key']: p for p in setting['poses']}
    files, proof_rows = {}, []
    for key, pose in authored.items():
        require(key in slots and pose['nativeBounds'] == slots[key]['nativeBounds'], 'AUTHOR_SOURCE_BOUNDS_DRIFT')
        image = place_authored(pose, palette, origin)
        filename = f"proof64/{key.replace('/', '-')}.png"
        files[filename] = PIXEL.png_bytes(image)
        proof_rows.append({'key': key, 'image': filename, 'alphaBounds': list(image.getchannel('A').getbbox()),
                           'status': 'EXISTING_SETTING_COORDINATE_PROOF_ONLY'})
    relations = []
    for members in alpha_groups.values():
        # Richest source palette is a useful proposed parent, never automatic art approval.
        parent = max(members, key=lambda k: len(set(crops[k].get_flattened_data())))
        for target in members:
            if target != parent:
                relation = palette_relation(crops[parent], crops[target])
                if relation:
                    relations.append({'source': parent, 'target': target, **relation})
    derived_rows = []
    for relation in relations:
        parent, target = relation['source'], relation['target']
        if (parent in authored and relation['deterministicFill'] is not None
                and slots[parent]['nativeBounds'] == slots[target]['nativeBounds']
                and slots[parent]['visibleBounds'] == slots[target]['visibleBounds']):
            original_art = place_authored(authored[parent], palette, origin)
            derived = derive_silhouette(original_art, relation['deterministicFill'])
            filename = f"proof64/{target.replace('/', '-')}-derived.png"
            files[filename] = PIXEL.png_bytes(derived)
            derived_rows.append({'key': target, 'source': parent, 'image': filename,
                                 'status': 'SOURCE_PROVEN_FILL_OF_AUTHORED_ALPHA_QA_PENDING'})
    contract_hash = sha(encoded(contract))
    design = {k: v for k, v in setting.items() if k in ('designVersion', 'identityDesign', 'palette', 'faceRules', 'ornamentRules')}
    jobs = []
    compiler_hash = sha(Path(__file__).read_bytes())
    derived_by_key = {row['key']: row for row in derived_rows}
    for canonical in groups.values():
        members = [key for key, v in slots.items() if v['canonical'] == canonical]
        dependencies = {'motion': contract_hash, 'design': sha(encoded(design)),
                        'source': slots[canonical]['nativeRgbaSha256'], 'compiler': compiler_hash,
                        'authored': sha(encoded(authored[canonical])) if canonical in authored else None}
        status = 'SETTING_PROOF_REQUIRES_FULL_QA' if canonical in authored else 'ART_REQUIRED_OR_EXPLICIT_DERIVATION'
        parent_job = None
        if canonical in derived_by_key:
            parent = derived_by_key[canonical]['source']
            dependencies['derivedParentArt'] = sha(encoded(authored[parent]))
            dependencies['derivedRule'] = sha(encoded(next(r for r in relations if r['target'] == canonical)))
            parent_job = f'{ENTITY}/{parent}'
            status = 'DERIVED_PROOF_REQUIRES_FULL_QA'
        jobs.append({'jobId': f'{ENTITY}/{canonical}', 'cacheKey': sha(encoded(dependencies)),
                     'dependencies': dependencies, 'dependsOnJob': parent_job, 'slots': members, 'status': status,
                     'automaticGenerationAllowed': False})
    first = origin_audit['cells'][0]
    scale = first['effectiveSourcePixelScale']
    pivot_native = [(first['currentAnchor'][axis] * first['currentSourceSize'][size] - first['inferredCurrentSourceOrigin'][i]) / scale
                    for i, (axis, size) in enumerate((('x', 'w'), ('y', 'h')))]
    preview_anchor = [(origin[i] + pivot_native[i]) / 64 for i in (0, 1)]
    plan = {'schemaVersion': 1, 'entityId': ENTITY, 'status': 'OFFLINE_PREFLIGHT_ONLY',
            'runtimeEligible': False, 'shippingReady': False, 'nextEntityAllowed': False,
            'motionContractPath': (generated / 'motion-contract.json').relative_to(ROOT).as_posix(),
            'motionContractSha256': contract_hash, 'timingPolicy': contract['timingPolicy'],
            'semanticPolicy': contract['semanticPolicy'],
            'counts': {'mainCells': 65, 'subCells': 18, 'mainSequences': 40, 'subSequences': 13,
                       'slots': len(slots), 'nativeMasters': len(groups), 'historicalHdMasters': summary['uniqueNonblankMasters'],
                       'alphaGroups': len(alpha_groups), 'derivationProposals': len(relations),
                       'settingProofs': len(proof_rows), 'derivedProofs': len(derived_rows), 'fullMotionValidated': 0},
            'geometry': {'size': [64, 64], 'nativePixelScale': 1, 'sourceBoundsUnion': union,
                         'sourceOrigin': origin, 'originMeaning': 'NCER_ZERO_NOT_AUTOMATIC_GROUND_CONTACT',
                         'baselineReference': first['texture'], 'baselinePixelsPerNativePixel': scale,
                         'baselinePivotInNativeCoordinates': pivot_native, 'proposedCalibratedAnchor': preview_anchor,
                         'anchorStatus': 'BASELINE_FIRST_CELL_CALIBRATION_NOT_RUNTIME_ACCEPTANCE',
                         'runtimeCompatibility': 'BLOCKED_EXISTING_M001_384x352_GUARD',
                         'runtimeAction': 'ASSET_QA_FIRST_THEN_ASSESS_PACKAGING_OR_BOUNDED_ADAPTER'},
            'slots': slots, 'jobs': jobs, 'derivationProposals': relations, 'proofs': proof_rows,
            'derivedProofs': derived_rows,
            'promotionGates': ['ALL_ART', 'ORIGINAL_IDENTITY_REVIEW', 'DONOR_POSE_AND_LANDMARKS',
                               'ALL_53_TIMELINES', 'TECHNICAL_PACKAGE', 'EXISTING_LOADER', 'NORMAL_PATH'],
            'modelPolicy': {'preferred': 'gpt-image-2.5-sunburst-2026-09-08', 'paidCallsAuthorized': False,
                            'generationCallsMade': 0, 'modelResponseReceiptRequired': True},
            'sourceFilesVerified': len(evidence['files']), 'sourcePixelsExported': False}
    files['preflight.json'] = encoded(plan)
    files['receipt.json'] = encoded({'schemaVersion': 1, 'files': {name: sha(data) for name, data in sorted(files.items())},
                                     'inputLockSha256': sha((WORK / 'inputs.lock.json').read_bytes()),
                                     'compilerSha256': compiler_hash})
    return files, plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--entity', default=ENTITY, choices=[ENTITY], help='Other entities are locked until m001 passes')
    parser.add_argument('--archive', type=Path, default=ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK')
    parser.add_argument('--output', type=Path, default=WORK / 'generated')
    parser.add_argument('--check', action='store_true', help='Read-only byte-for-byte verification')
    args = parser.parse_args()
    output = args.output.resolve()
    allowed = (WORK / 'generated').resolve(), (ROOT / '.tmp/character-production').resolve()
    require(any(output == p or output.is_relative_to(p) for p in allowed), 'OUTPUT_NOT_IN_PREFLIGHT_AREA')
    files, plan = build(args.archive.resolve())
    SOURCE.publish(files, output, args.check)
    print(json.dumps({'status': plan['status'], 'counts': plan['counts'], 'output': str(output), 'check': args.check}))


if __name__ == '__main__':
    main()
