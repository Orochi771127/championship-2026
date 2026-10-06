"""Build one opus refinement batch for cages whose ground itself animates.

The beach, small beach, volcano and ice field have a two-frame core (the
original surface animation) and only static source objects.  This is the same
two-pass method as ``build-cage-opus-family.py`` (kept unchanged because its
hash is recorded in earlier rounds), plus: every core frame is rendered as its
own cell folder (frame 1 in ``animation/01``, exactly where the existing
surface-animation compositor expects it), the authoring module receives the
cell id as the surface phase, and the root manifest records ``coreFrames``
with the original timing evidence from the field spec.

    blender -b --python scripts/build-cage-opus-surface.py -- \
        --round opm-opus-r10 --module cage_opus_coast_authoring --measure
    blender -b --python scripts/build-cage-opus-surface.py -- \
        --round opm-opus-r10 --module cage_opus_coast_authoring
"""
import argparse
import copy
import hashlib
import importlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.cage_object_animation_contract import extract, assert_unchanged, sha

WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'

loader = importlib.util.spec_from_file_location('opus_surface_base3d', ROOT / 'scripts/build-cage-base3d.py')
d = importlib.util.module_from_spec(loader)
sys.modules[loader.name] = d
loader.loader.exec_module(d)


def cells(contract):
    return sorted({frame['cellId'] for obj in contract['objects'] for frame in obj['frames']})


def cheap_camera(original):
    def set_camera(scene, bounds, scale=5):
        original(scene, bounds, scale)
        scene.render.resolution_percentage = 4
    return set_camera


def producers(authoring, containment):
    rows = {
        'producerSha256': Path(__file__),
        'familyAuthoringSha256': Path(authoring.__file__),
        'containmentSha256': Path(containment.__file__),
        'footprintFitSha256': ROOT / 'scripts/lib/cage_footprint_fit.py',
        'scriptSha256': ROOT / 'scripts/build-cage-base3d.py',
    }
    for name in getattr(authoring, 'DEPENDENCIES', ()):
        rows[f'dependency:{name}'] = ROOT / 'scripts/lib' / f'{name}.py'
    return rows


def stamp(folder, cell_id, contract, table_sha, authoring, containment, status, core_frames):
    path = folder / 'modular-manifest.json'
    manifest = json.loads(path.read_text(encoding='utf8'))
    manifest['status'] = status
    manifest['sourceCellId'] = cell_id
    manifest['consumer'] = 'Full-layout refinement review only; not runtime animation'
    manifest['generation'].update({
        'clockHz': None, 'reviewMode': contract['reviewMode'],
        **{key: sha(path_) for key, path_ in producers(authoring, containment).items()},
        'fitTableSha256': table_sha, 'perFrameGeometry': False,
        'surfacePhase': cell_id % max(1, core_frames), 'coreFrameCount': core_frames,
        'artDirectionInputs': list(getattr(authoring, 'ART_DIRECTION_INPUTS', ['LOCAL_RESEARCH_INTENT_ONLY'])),
        'conceptReference': getattr(authoring, 'CONCEPT_REFERENCE', None),
        'newGenerationCalls': 0,
        'referenceUse': 'Research rasters viewed locally for functional intent only; '
                        'never uploaded, loaded, traced, sampled, textured or exported',
    })
    path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')


def record_core_frames(field, root):
    """Root manifest lists every core frame with the spec's original timing evidence."""
    manifest_path = root / 'modular-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    frames = []
    for index, timing in enumerate(field['frames']):
        prefix = '' if index == 0 else f'animation/{index:02d}/'
        base = root / prefix / 'base.png'
        frames.append({**{k: timing.get(k) for k in ('durationMs', 'durationRawTicks', 'durationEvidence')},
                       'src': prefix + 'base.png', 'sha256': hashlib.sha256(base.read_bytes()).hexdigest().upper()})
    manifest['coreFrames'] = frames
    manifest['generation']['animationRole'] = 'Two offline surface states; original timing evidence; static OPM only'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', required=True)
    parser.add_argument('--module', required=True)
    parser.add_argument('--samples', type=int, default=16)
    parser.add_argument('--field', action='append')
    parser.add_argument('--measure', action='store_true')
    parser.add_argument('--base-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    authoring = importlib.import_module('lib.' + args.module)
    containment = importlib.import_module('lib.' + getattr(authoring, 'CONTAINMENT', 'cage_opus_containment_v2'))
    out = WORK / args.round
    for frozen in ('opm-opus-r1', 'opm-opus-r2', 'opm-opus-r3', 'opm-opus-r4', 'opm-opus-r5', 'opm-opus-r6',
                   'opm-opus-r7', 'opm-opus-r8', 'opm-opus-r9'):
        if out.resolve() == (WORK / frozen).resolve():
            raise SystemExit('EARLIER_ROUND_IS_FROZEN:' + frozen)
    args.layers = False
    args.parts = not args.measure
    selected = tuple(args.field or authoring.FIELDS)
    unknown = set(selected) - set(authoring.FIELDS)
    if unknown:
        raise SystemExit('FIELDS_NOT_IN_FAMILY:' + ','.join(sorted(unknown)))
    status = f"REFINEMENT_{args.round.upper().replace('-', '_')}_REVIEW_ONLY"

    destination = out / 'measure-pass' if args.measure else out
    d.OUT = destination
    d.LOOK = 'seam-v3'
    d.STAGE3_BATCH1 = selected
    d.STAGE2_BATCH3 = tuple(f for f in d.STAGE2_BATCH3 if f not in selected)
    for legacy in ('sports', 'new_family', 'stage2_family', 'build_sports_family', 'build_nature_family'):
        original = getattr(d, legacy)

        def guarded(field, *rest, _original=original, **options):
            return [] if field['id'] in selected else _original(field, *rest, **options)
        setattr(d, legacy, guarded)
    d.ANIMATED_SURFACES.update(authoring.SURFACES)
    d.prepare_animated_surface = authoring.prepare
    d.build_animated_surface = authoring.build
    containment.reset()
    table_path = out / 'fit-table.json'
    if args.measure:
        containment.MODE['pass'] = 'measure'
        d.set_camera = cheap_camera(d.set_camera)
    else:
        containment.MODE['pass'] = 'render'
        if not table_path.exists():
            raise SystemExit('RUN_THE_MEASURE_PASS_FIRST: ' + table_path.as_posix())
        containment.TABLE.update(json.loads(table_path.read_text(encoding='utf8'))['fields'])
    table_sha = sha(table_path) if not args.measure else None

    solved = {}
    for field_id in selected:
        contract = extract(ROOT, field_id)
        authoring.CONTRACTS[field_id] = contract
        field = json.loads((WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
        core_frames = len(field.get('frames') or [None])
        if core_frames not in (1, 2):
            raise SystemExit(f'UNSUPPORTED_CORE_FRAME_COUNT:{field_id}:{core_frames}')
        if core_frames == 2 and any(o['sequenceFrameCount'] != 1 for o in field['objects']):
            raise SystemExit('ANIMATED_CORE_REQUIRES_STATIC_OBJECTS:' + field_id)
        target = destination / 'fields' / field_id
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WORK / 'fields' / field_id / 'spec.json', target / 'spec.json')
        (target / 'object-animation-contract.json').write_text(json.dumps(contract, indent=2) + '\n', encoding='utf8')
        render_cells = sorted({0} | set(cells(contract)) | set(range(core_frames)))
        for cell_id in ([0] if args.base_only else render_cells):
            d.render_field(copy.deepcopy(field), args, cell_id)
            folder = destination / 'seam-v3/fields' / field_id
            if cell_id:
                folder = folder / 'animation' / f'{cell_id:02d}'
            if not args.measure:
                stamp(folder, cell_id, contract, table_sha, authoring, containment, status, core_frames)
        if not args.measure and not args.base_only and core_frames == 2:
            record_core_frames(field, destination / 'seam-v3/fields' / field_id)
        reports = [report for key, report in sorted(containment.REPORTS.items()) if key[0] == field_id]
        (target / 'footprint-fit.json').write_text(json.dumps({
            'status': 'OPUS_FOOTPRINT_FIT_RECORD_REVIEW_ONLY', 'fieldId': field_id, 'round': args.round,
            'pass': containment.MODE['pass'], 'workingInsetNativePx': containment.WORKING_INSET,
            'minimumLegibleScale': containment.MINIMUM_LEGIBLE_SCALE, 'cells': reports,
            'coreFrameCount': core_frames,
        }, indent=2) + '\n', encoding='utf8')
        if args.measure:
            solved[field_id] = containment.solve_table(field_id)
        assert_unchanged(ROOT, contract)
        print('OPUS_SURFACE_CELL_BANK_EXPORTED', args.round, field_id, render_cells)

    if args.measure:
        out.mkdir(parents=True, exist_ok=True)
        previous = json.loads(table_path.read_text(encoding='utf8'))['fields'] if table_path.exists() else {}
        previous.update(solved)
        table_path.write_text(json.dumps({
            'status': 'OPUS_FIXED_PLACEMENT_PER_SOURCE_OBJECT', 'round': args.round, 'module': args.module,
            'purpose': 'One placement per source object from its worst cell, applied to every cell and core frame.',
            'workingInsetNativePx': containment.WORKING_INSET, 'fields': previous,
        }, indent=2) + '\n', encoding='utf8')
        print('OPUS_FAMILY_MEASURE_PASS_COMPLETE', json.dumps({fid: {k: (row['mode'], row['factor'])
                                                                     for k, row in rows.items()}
                                                               for fid, rows in solved.items()}))
    else:
        print('OPUS_FAMILY_RENDER_PASS_COMPLETE_CLOCK_UNRESOLVED', args.round)


if __name__ == '__main__':
    main()
