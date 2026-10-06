"""Build one refinement batch of the opus round for any prop family module.

Same two-pass method as ``build-cage-opus-r1.py`` (which stays frozen because
its hash is recorded in the first batch's manifests): the measure pass records
each object's worst animation cell, ``cage_opus_containment.solve_table`` turns
that into one fixed placement per object, and the render pass applies it in
every cell while exporting the full cell bank.

    blender -b --python scripts/build-cage-opus-family.py -- \
        --round opm-opus-r2 --module cage_opus_clinic_authoring --measure
    blender -b --python scripts/build-cage-opus-family.py -- \
        --round opm-opus-r2 --module cage_opus_clinic_authoring

A family module provides ``FIELDS``, ``SURFACES``, ``CONTRACTS``, ``prepare``,
``build`` and ``DEPENDENCIES`` (the other modules its geometry is built from,
so their hashes are recorded too).  Outputs never overwrite an earlier round.
"""
import argparse
import copy
import importlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.cage_object_animation_contract import extract, extract_variable, assert_unchanged, \
    assert_variable_unchanged, sha

WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'

loader = importlib.util.spec_from_file_location('opus_family_base3d', ROOT / 'scripts/build-cage-base3d.py')
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


def contract_for(field_id, variable):
    return extract_variable(ROOT, field_id) if variable else extract(ROOT, field_id)


def bind_geometry(field, contract, cell_id):
    """Per-frame size and pivot for variable-window fields (never padded)."""
    bound = copy.deepcopy(field)
    for record, obj in zip(bound['objects'], contract['objects']):
        frame = next((f for f in obj['frames'] if f['cellId'] == cell_id), obj['frames'][0])
        record['size'] = frame['size']
        record['pivot'] = frame['pivot']
        record['boundCellId'] = frame['cellId']
        record['variableFrameGeometry'] = obj.get('variableFrameGeometry', False)
    return bound


def stamp(folder, cell_id, contract, table_sha, authoring, containment, status, variable):
    path = folder / 'modular-manifest.json'
    manifest = json.loads(path.read_text(encoding='utf8'))
    manifest['status'] = status
    manifest['sourceCellId'] = cell_id
    manifest['consumer'] = 'Full-layout refinement review only; not runtime animation'
    manifest['generation'].update({
        'clockHz': None, 'reviewMode': contract['reviewMode'],
        **{key: sha(path_) for key, path_ in producers(authoring, containment).items()},
        'fitTableSha256': table_sha, 'perFrameGeometry': variable,
        'artDirectionInputs': list(getattr(authoring, 'ART_DIRECTION_INPUTS', ['LOCAL_RESEARCH_INTENT_ONLY'])),
        'conceptReference': getattr(authoring, 'CONCEPT_REFERENCE', None),
        'newGenerationCalls': 0,
        'referenceUse': 'Research rasters viewed locally for functional intent only; '
                        'never uploaded, loaded, traced, sampled, textured or exported',
    })
    path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', required=True, help='output folder name, e.g. opm-opus-r2')
    parser.add_argument('--module', required=True, help='family module in scripts/lib')
    parser.add_argument('--samples', type=int, default=16)
    parser.add_argument('--field', action='append')
    parser.add_argument('--measure', action='store_true')
    parser.add_argument('--base-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    authoring = importlib.import_module('lib.' + args.module)
    containment = importlib.import_module('lib.' + getattr(authoring, 'CONTAINMENT', 'cage_opus_containment'))
    out = WORK / args.round
    if out.resolve() == (WORK / 'opm-opus-r1').resolve():
        raise SystemExit('ROUND_R1_IS_FROZEN_USE_build-cage-opus-r1.py')
    args.layers = False
    args.parts = not args.measure
    selected = tuple(args.field or authoring.FIELDS)
    unknown = set(selected) - set(authoring.FIELDS)
    if unknown:
        raise SystemExit('FIELDS_NOT_IN_FAMILY:' + ','.join(sorted(unknown)))
    variable = set(getattr(authoring, 'VARIABLE_WINDOW_FIELDS', ()))
    status = f"REFINEMENT_{args.round.upper().replace('-', '_')}_REVIEW_ONLY"

    destination = out / 'measure-pass' if args.measure else out
    d.OUT = destination
    d.LOOK = 'seam-v3'
    d.STAGE3_BATCH1 = selected
    d.STAGE2_BATCH3 = tuple(f for f in d.STAGE2_BATCH3 if f not in selected)
    # render_field also dispatches some fields to legacy builders hard-wired in
    # build-cage-base3d (e.g. cm01/cm16, the stage-2 batches).  For a field this
    # family owns, those must build nothing, or two designs would be stacked.
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
        contract = contract_for(field_id, field_id in variable)
        authoring.CONTRACTS[field_id] = contract
        field = json.loads((WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
        target = destination / 'fields' / field_id
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WORK / 'fields' / field_id / 'spec.json', target / 'spec.json')
        (target / 'object-animation-contract.json').write_text(json.dumps(contract, indent=2) + '\n',
                                                                encoding='utf8')
        # The field root (cell 0) is the candidate the layout and audits read.  Some
        # contracts never use cell 0 (e.g. cm16 uses cells 1 and 7); it is still
        # rendered, every object showing the first pose of its own sequence.
        for cell_id in ([0] if args.base_only else sorted({0} | set(cells(contract)))):
            bound = bind_geometry(field, contract, cell_id) if field_id in variable else field
            d.render_field(bound, args, cell_id)
            folder = destination / 'seam-v3/fields' / field_id
            if cell_id:
                folder = folder / 'animation' / f'{cell_id:02d}'
            if not args.measure:
                stamp(folder, cell_id, contract, table_sha, authoring, containment, status, field_id in variable)
        reports = [report for key, report in sorted(containment.REPORTS.items()) if key[0] == field_id]
        (target / 'footprint-fit.json').write_text(json.dumps({
            'status': 'OPUS_FOOTPRINT_FIT_RECORD_REVIEW_ONLY', 'fieldId': field_id, 'round': args.round,
            'pass': containment.MODE['pass'], 'workingInsetNativePx': containment.WORKING_INSET,
            'minimumLegibleScale': containment.MINIMUM_LEGIBLE_SCALE, 'cells': reports,
        }, indent=2) + '\n', encoding='utf8')
        if args.measure:
            solved[field_id] = containment.solve_table(field_id)
        (assert_variable_unchanged if field_id in variable else assert_unchanged)(ROOT, contract)
        print('OPUS_FAMILY_CELL_BANK_EXPORTED', args.round, field_id, len(cells(contract)))

    if args.measure:
        out.mkdir(parents=True, exist_ok=True)
        previous = json.loads(table_path.read_text(encoding='utf8'))['fields'] if table_path.exists() else {}
        previous.update(solved)
        table_path.write_text(json.dumps({
            'status': 'OPUS_FIXED_PLACEMENT_PER_SOURCE_OBJECT', 'round': args.round, 'module': args.module,
            'purpose': 'One placement per source object from its worst animation cell, applied to every cell.',
            'workingInsetNativePx': containment.WORKING_INSET, 'fields': previous,
        }, indent=2) + '\n', encoding='utf8')
        summary = {fid: {key: (row['mode'], row['factor']) for key, row in rows.items()}
                   for fid, rows in solved.items()}
        print('OPUS_FAMILY_MEASURE_PASS_COMPLETE', json.dumps(summary))
    else:
        print('OPUS_FAMILY_RENDER_PASS_COMPLETE_CLOCK_UNRESOLVED', args.round)


if __name__ == '__main__':
    main()
