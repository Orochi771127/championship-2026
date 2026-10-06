"""Build refinement round opus-r1 for the facility family (lab, factory, ward).

Two passes.  The measure pass builds every animation cell cheaply and records,
per source object, the worst cell's geometry against every convex container the
object may use; ``cage_opus_containment.solve_table`` turns that into one fixed
placement per object (one shared scale per sequence).  The render pass applies
that placement in every cell and exports the full cell bank.

Outputs live in ``cage-base3d-v1/opm-opus-r1``; no earlier batch is touched.
"""
import argparse
import importlib.util
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.cage_object_animation_contract import extract, assert_unchanged, sha
from lib import cage_opus_containment as containment
from lib import cage_opus_facility_authoring as authoring

WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT = WORK / 'opm-opus-r1'
MEASURE = OUT / 'measure-pass'
FIELDS = authoring.FIELDS
PRODUCERS = {
    'producerSha256': Path(__file__),
    'facilityAuthoringSha256': ROOT / 'scripts/lib/cage_opus_facility_authoring.py',
    'containmentSha256': ROOT / 'scripts/lib/cage_opus_containment.py',
    'footprintFitSha256': ROOT / 'scripts/lib/cage_footprint_fit.py',
    'scriptSha256': ROOT / 'scripts/build-cage-base3d.py',
}

loader = importlib.util.spec_from_file_location('opus_r1_base3d', ROOT / 'scripts/build-cage-base3d.py')
d = importlib.util.module_from_spec(loader)
sys.modules[loader.name] = d
loader.loader.exec_module(d)


def cells(contract):
    return sorted({frame['cellId'] for obj in contract['objects'] for frame in obj['frames']})


def cheap_camera(original):
    """Measure pass needs geometry, not pixels; shrink the output, not the maths."""
    def set_camera(scene, bounds, scale=5):
        original(scene, bounds, scale)
        scene.render.resolution_percentage = 4
    return set_camera


def stamp(folder, field_id, cell_id, contract, table_sha):
    path = folder / 'modular-manifest.json'
    manifest = json.loads(path.read_text(encoding='utf8'))
    manifest['status'] = 'REFINEMENT_OPUS_R1_REVIEW_ONLY'
    manifest['sourceCellId'] = cell_id
    manifest['consumer'] = 'Full-layout refinement review only; not runtime animation'
    manifest['generation'].update({
        'clockHz': None, 'reviewMode': contract['reviewMode'],
        **{key: sha(path_) for key, path_ in PRODUCERS.items()},
        'fitTableSha256': table_sha,
        'artDirectionInputs': ['LOCAL_RESEARCH_INTENT_ONLY'],
        'conceptReference': None,
        'newGenerationCalls': 0,
        'referenceUse': 'Research rasters viewed locally for functional intent only; '
                        'never uploaded, loaded, traced, sampled, textured or exported',
    })
    path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples', type=int, default=16)
    parser.add_argument('--field', action='append', choices=list(FIELDS))
    parser.add_argument('--measure', action='store_true')
    parser.add_argument('--base-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    args.layers = False
    args.parts = not args.measure
    selected = tuple(args.field or FIELDS)

    destination = MEASURE if args.measure else OUT
    d.OUT = destination
    d.LOOK = 'seam-v3'
    d.STAGE3_BATCH1 = selected
    d.STAGE2_BATCH3 = tuple(f for f in d.STAGE2_BATCH3 if f not in selected)
    d.ANIMATED_SURFACES.update(authoring.SURFACES)
    d.prepare_animated_surface = authoring.prepare
    d.build_animated_surface = authoring.build
    containment.reset()
    table_path = OUT / 'fit-table.json'
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
        target = destination / 'fields' / field_id
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WORK / 'fields' / field_id / 'spec.json', target / 'spec.json')
        (target / 'object-animation-contract.json').write_text(json.dumps(contract, indent=2) + '\n',
                                                                encoding='utf8')
        for cell_id in ([0] if args.base_only else cells(contract)):
            d.render_field(field, args, cell_id)
            folder = destination / 'seam-v3/fields' / field_id
            if cell_id:
                folder = folder / 'animation' / f'{cell_id:02d}'
            if not args.measure:
                stamp(folder, field_id, cell_id, contract, table_sha)
        reports = [report for key, report in sorted(containment.REPORTS.items()) if key[0] == field_id]
        (target / 'footprint-fit.json').write_text(json.dumps({
            'status': 'OPUS_R1_FOOTPRINT_FIT_RECORD_REVIEW_ONLY', 'fieldId': field_id,
            'pass': containment.MODE['pass'], 'workingInsetNativePx': containment.WORKING_INSET,
            'minimumLegibleScale': containment.MINIMUM_LEGIBLE_SCALE, 'cells': reports,
        }, indent=2) + '\n', encoding='utf8')
        if args.measure:
            solved[field_id] = containment.solve_table(field_id)
        assert_unchanged(ROOT, contract)
        print('OPUS_R1_CELL_BANK_EXPORTED', field_id, len(cells(contract)))

    if args.measure:
        OUT.mkdir(parents=True, exist_ok=True)
        previous = json.loads(table_path.read_text(encoding='utf8'))['fields'] if table_path.exists() else {}
        previous.update(solved)
        table_path.write_text(json.dumps({
            'status': 'OPUS_R1_FIXED_PLACEMENT_PER_SOURCE_OBJECT',
            'purpose': 'One placement per source object and one scale per sequence, taken from the '
                       'worst animation cell, applied identically to every cell.',
            'workingInsetNativePx': containment.WORKING_INSET, 'fields': previous,
        }, indent=2) + '\n', encoding='utf8')
        summary = {fid: {key: (row['mode'], row['factor']) for key, row in rows.items()}
                   for fid, rows in solved.items()}
        print('OPUS_R1_MEASURE_PASS_COMPLETE', json.dumps(summary))
    else:
        print('OPUS_R1_RENDER_PASS_COMPLETE_CLOCK_UNRESOLVED')


if __name__ == '__main__':
    main()
