"""Build Batch E footprint-accurate zoo, ranch and forest candidates.

Two passes.  The measure pass builds every animation cell cheaply and records
the smallest scale each source object needs anywhere in its sequence; the render
pass applies that single scale everywhere, so a prop cannot breathe between
frames.  Neither pass replaces the existing base catalog or an earlier batch.
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
from lib import cage_footprint_refinement as authoring

WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT = WORK / 'opm-footprint-refinement-v1'
MEASURE = OUT / 'measure-pass'
FIELDS = authoring.FIELDS
CONCEPT_DIRECTORY = WORK / 'higgsfield-footprint-families-v1'
CONCEPT_BY_FIELD = {'field_cm25_01': 'zoo-family.png', 'field_cm26_01': 'ranch-family.png',
                    'field_cm11_01': 'forest-family.png'}

loader = importlib.util.spec_from_file_location('footprint_base3d', ROOT / 'scripts/build-cage-base3d.py')
d = importlib.util.module_from_spec(loader)
sys.modules[loader.name] = d
loader.loader.exec_module(d)


def cells(contract):
    return sorted({frame['cellId'] for obj in contract['objects'] for frame in obj['frames']})


def concept_reference(field_id):
    """Original concept board for this family, when one was generated.

    The board is an art-direction guide only.  Blender never loads it, and its
    absence must not silently change what the geometry does.
    """
    name = CONCEPT_BY_FIELD.get(field_id)
    path = CONCEPT_DIRECTORY / name if name else None
    if not path or not path.exists():
        return None
    requests = CONCEPT_DIRECTORY / 'requests.json'
    job = None
    if requests.exists():
        rows = json.loads(requests.read_text(encoding='utf8'))['requests']
        job = next((row.get('jobId') for row in rows if row.get('assetId') == Path(name).stem), None)
    return {'file': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'jobId': job,
            'use': 'visual family guide only; raster not loaded by Blender'}


def cheap_camera(original):
    """Measure pass needs geometry, not pixels; shrink the output, not the maths."""
    def set_camera(scene, bounds, scale=5):
        original(scene, bounds, scale)
        scene.render.resolution_percentage = 4
    return set_camera


def render(field, args, cell_id, destination):
    d.render_field(field, args, cell_id)
    folder = destination / 'seam-v3/fields' / field['id']
    return folder / 'animation' / f'{cell_id:02d}' if cell_id else folder


def stamp(folder, field_id, cell_id, contract, fit_table_sha):
    path = folder / 'modular-manifest.json'
    manifest = json.loads(path.read_text(encoding='utf8'))
    manifest['status'] = 'REFINEMENT_BATCH_E_FOOTPRINT_REVIEW_ONLY'
    manifest['sourceCellId'] = cell_id
    manifest['consumer'] = 'Full-layout refinement review only; not runtime animation'
    manifest['generation'].update({
        'clockHz': None, 'reviewMode': contract['reviewMode'],
        'producerSha256': sha(Path(__file__)),
        'footprintRefinementSha256': sha(ROOT / 'scripts/lib/cage_footprint_refinement.py'),
        'footprintFitSha256': sha(ROOT / 'scripts/lib/cage_footprint_fit.py'),
        'upstreamAuthoringSha256': sha(ROOT / 'scripts/lib/cage_nature_authoring.py')
        if authoring.FAMILY[field_id] == 'nature'
        else sha(ROOT / 'scripts/lib/cage_remaining_fixed_authoring.py'),
        'scriptSha256': sha(ROOT / 'scripts/build-cage-base3d.py'),
        'fitTableSha256': fit_table_sha,
        'artDirectionInputs': ['HIGGSFIELD_FOOTPRINT_FAMILY_CONCEPT'] if concept_reference(field_id) else [],
        'conceptReference': concept_reference(field_id),
        'newGenerationCalls': 0,
        'referenceUse': 'Original AI concept board only; research rasters not uploaded, '
                        'loaded, traced, sampled, or exported',
    })
    path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples', type=int, default=12)
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
    # The forest is also a member of the upstream nature batch; clearing that
    # list stops render_field building it twice, once raw and once refined.
    d.STAGE2_BATCH3 = ()
    d.ANIMATED_SURFACES.update(authoring.SURFACES)
    d.prepare_animated_surface = authoring.prepare
    d.build_animated_surface = authoring.build
    if args.measure:
        d.set_camera = cheap_camera(d.set_camera)
        authoring.TABLE.clear()
    else:
        table_path = OUT / 'fit-table.json'
        if not table_path.exists():
            raise SystemExit('RUN_THE_MEASURE_PASS_FIRST: ' + table_path.as_posix())
        authoring.TABLE.update(json.loads(table_path.read_text(encoding='utf8'))['fields'])
    fit_table_sha = sha(OUT / 'fit-table.json') if not args.measure else None

    for field_id in selected:
        contract = extract(ROOT, field_id)
        field = json.loads((WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
        target = destination / 'fields' / field_id
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WORK / 'fields' / field_id / 'spec.json', target / 'spec.json')
        (target / 'object-animation-contract.json').write_text(
            json.dumps(contract, indent=2) + '\n', encoding='utf8')
        for cell_id in ([0] if args.base_only else cells(contract)):
            folder = render(field, args, cell_id, destination)
            if args.measure:
                continue
            stamp(folder, field_id, cell_id, contract, fit_table_sha)
        reports = [report for key, report in sorted(authoring.REPORTS.items())
                   if key[0] == field_id]
        (target / 'footprint-fit.json').write_text(json.dumps({
            'status': 'FOOTPRINT_FIT_RECORD_REVIEW_ONLY',
            'fieldId': field_id, 'pass': 'measure' if args.measure else 'render',
            'workingInsetNativePx': authoring.WORKING_INSET,
            'preferredMinimumScale': authoring.PREFERRED_MINIMUM_SCALE,
            'cells': reports,
        }, indent=2) + '\n', encoding='utf8')
        assert_unchanged(ROOT, contract)
        print('FOOTPRINT_REFINEMENT_CELL_BANK_EXPORTED', field_id, len(cells(contract)))

    if args.measure:
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / 'fit-table.json').write_text(json.dumps({
            'status': 'FOOTPRINT_FIT_TABLE_MINIMUM_SCALE_PER_SOURCE_OBJECT',
            'purpose': 'One scale per source object across every animation cell, '
                       'so a prop keeps a single size through its sequence.',
            'workingInsetNativePx': authoring.WORKING_INSET,
            'fields': authoring.COLLECTED,
        }, indent=2) + '\n', encoding='utf8')
        print('FOOTPRINT_MEASURE_PASS_COMPLETE', json.dumps(authoring.COLLECTED))
    else:
        print('FOOTPRINT_REFINEMENT_BATCH_E_EXPORTED_CLOCK_UNRESOLVED')


if __name__ == '__main__':
    main()
